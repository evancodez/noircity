import * as THREE from 'three';
import {
  NEUTRAL, solvePose, samplePoseKeys, mergePose, eulerQ, LOWER_BONES, UPPER_BONES, ANKLE_Y,
} from './HoodRig.js';

// Procedural AnimationClips for the Hood, built once from pose functions and
// played per Hood through an AnimationMixer.
//
// Every clip is baked as a PAIR: `<name>.lower` (root, hips position +
// rotation, legs) and `<name>.upper` (spine and up). Two channels (lower,
// upper) each cross-fade among their own actions with weights that always
// sum to 1, so an upper-body clip (aim) can ride on any legs (walk, idle)
// and nothing ever blends toward the bind pose (arms inside the coat).
// fire and flinch are ADDITIVE clips (delta rotations) layered on top.
//
// Gaits are generated analytically: each foot's ground contact point moves
// backward at exactly the walking speed during stance (heel strike, flat,
// roll over the ball), so with the root advancing at `speed` the planted
// foot is fixed in the world; the legs are solved with two-bone IK.

export const WALK = { speed: 1.0, T: 1.1 };
export const RUN = { speed: 2.9, T: 0.72 };
const FPS = 30;
const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// baking
export function bake(name, duration, poseFn, { loop = false, armSpace = 'chest', fps = FPS, rootMotion = null, rig = null } = {}) {
  const n = Math.max(2, Math.round(duration * fps) + 1);
  const times = new Float32Array(n);
  const hipsP = new Float32Array(n * 3);
  const bones = [...LOWER_BONES, ...UPPER_BONES];
  const qs = Object.fromEntries(bones.map((b) => [b, new Float32Array(n * 4)]));
  const prev = {};
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * duration;
    times[i] = t;
    const S = solvePose(poseFn(loop && i === n - 1 ? 0 : t), { armSpace, rig });
    hipsP[i * 3] = S.hipsPos.x; hipsP[i * 3 + 1] = S.hipsPos.y; hipsP[i * 3 + 2] = S.hipsPos.z;
    for (const b of bones) {
      const q = S.q[b];
      // keep neighbouring keys on the same hemisphere (no long-way slerps)
      if (prev[b] && prev[b].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      prev[b] = q;
      qs[b].set([q.x, q.y, q.z, q.w], i * 4);
    }
  }
  const lower = [new THREE.VectorKeyframeTrack('hips.position', times, hipsP)];
  for (const b of LOWER_BONES) lower.push(new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, qs[b]));
  const upper = UPPER_BONES.map((b) => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, qs[b]));
  return {
    name, duration, loop, rootMotion,
    lower: new THREE.AnimationClip(name + '.lower', duration, lower),
    upper: new THREE.AnimationClip(name + '.upper', duration, upper),
  };
}

// additive clip: keys = [{ t, bones: { name: [pitch, yaw, roll] } }]
export function bakeAdditive(name, keys, fps = 60) {
  const duration = keys[keys.length - 1].t;
  const n = Math.round(duration * fps) + 1;
  const names = [...new Set(keys.flatMap((k) => Object.keys(k.bones)))];
  const poseKeys = keys.map((k) => ({ t: k.t, pose: Object.fromEntries(names.map((b) => [b, k.bones[b] || [0, 0, 0]])) }));
  const times = new Float32Array(n);
  const vals = Object.fromEntries(names.map((b) => [b, new Float32Array(n * 4)]));
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * duration;
    times[i] = t;
    const P = samplePoseKeys(poseKeys, t);
    for (const b of names) { eulerQ(P[b], q); vals[b].set([q.x, q.y, q.z, q.w], i * 4); }
  }
  const tracks = names.map((b) => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, vals[b]));
  const clip = new THREE.AnimationClip(name, duration, tracks);
  clip.blendMode = THREE.AdditiveAnimationBlendMode;
  return { name, duration, clip, additive: true };
}

// ---------------------------------------------------------------------------
// gait: one foot at phase p (0 = heel strike). Returns the ankle (y, z) and
// the foot's toe-up pitch (deg). Contact point moves back at exactly `speed`.
const HEEL_B = 0.065;  // heel contact behind the ankle
const BALL_F = 0.13;   // ball of the foot ahead of the ankle
function ankleFromContact(anchor, a, mode) {
  const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  if (mode === 'heel') return [ANKLE_Y * c + HEEL_B * s, anchor - HEEL_B - ANKLE_Y * s + HEEL_B * c];
  return [ANKLE_Y * c - BALL_F * s, anchor + BALL_F - ANKLE_Y * s - BALL_F * c];
}
function stanceFoot(s, G) {
  const S = G.speed * G.T, sb = S * G.beta;
  const anchor = G.zOff + sb / 2 - s * sb;
  if (s < G.sHeel) {
    const k = 1 - s / G.sHeel;
    const a = G.strikePitch * k * k;
    const [y, z] = ankleFromContact(anchor, a, 'heel');
    return { y, z, pitch: a };
  }
  if (s > G.sBall) {
    const k = (s - G.sBall) / (1 - G.sBall);
    const a = -G.toePitch * Math.pow(k, 1.6);
    const [y, z] = ankleFromContact(anchor, a, 'ball');
    return { y, z, pitch: a };
  }
  return { y: ANKLE_Y, z: anchor, pitch: 0 };
}
function gaitFoot(p, G) {
  if (p < G.beta) return stanceFoot(p / G.beta, G);
  const s = (p - G.beta) / (1 - G.beta);
  const A = stanceFoot(1, G), B = stanceFoot(0, G);
  // Hermite in z with end tangents along the stance motion (scaled): the
  // foot keeps drifting back a moment after toe-off and retracts slightly
  // before the heel strikes, like a real swing leg
  const S = G.speed * G.T;
  const m = -S * (1 - G.beta) * G.swingTan;
  const s2 = s * s, s3 = s2 * s;
  const z = (2 * s3 - 3 * s2 + 1) * A.z + (s3 - 2 * s2 + s) * m + (-2 * s3 + 3 * s2) * B.z + (s3 - s2) * m;
  // lift: peaks early in the swing (toe clearance), heel kicks up in a run
  const lift = G.lift * Math.pow(Math.sin(Math.PI * Math.pow(s, G.liftSkew)), 1.2);
  const y = lerp(A.y, B.y, sstep(0, 1, s)) + lift;
  const pitch = s < 0.5 ? lerp(A.pitch, G.swingPitch, sstep(0, 0.5, s)) : lerp(G.swingPitch, B.pitch, sstep(0.5, 1, s));
  return { y, z, pitch };
}

export function gaitPose(phase, G) {
  const c = Math.cos(TAU * phase), s = Math.sin(TAU * phase);
  const P = mergePose(NEUTRAL, {});
  const L = gaitFoot(phase % 1, G);
  const R = gaitFoot((phase + 0.5) % 1, G);
  P.footL = [G.stepW, L.y, L.z];
  P.footR = [-G.stepW, R.y, R.z];
  P.footRotL = [L.pitch, G.toeOut, 0];
  P.footRotR = [R.pitch, G.toeOut, 0];
  P.kneeL = [0.1, 0.05, 1];
  P.kneeR = [-0.1, 0.05, 1];
  // pelvis: highest at mid-stance in a walk, in the flight phase in a run
  const bobC = Math.cos(2 * TAU * (phase - G.bobPeak));
  P.hipsPos = [G.sway * s, G.hipsY + G.bob * 0.5 * bobC, G.hipsZ];
  P.hips = [G.lean * 0.4, -G.pelvisYaw * c, G.pelvisRoll * s];
  P.spine = [G.lean * 0.35 + 1, (G.pelvisYaw + G.twist * 0.5) * c, -G.pelvisRoll * 0.6 * s];
  P.chest = [G.lean * 0.25 - 2 - G.breathe * bobC, G.twist * 0.5 * c, -G.pelvisRoll * 0.3 * s];
  P.neck = [6, 0, 0];
  P.head = [0, 0, 0];
  P.headRoot = [G.headPitch, 0, 0];
  P.headLevel = [0.85];
  // arms swing in counter-phase with the legs (left arm forward with the
  // right leg); forward swing bends the elbow more
  const fL = -G.armSwing * c, fR = G.armSwingR * c;
  const armDir = (f, x) => { const r = f * Math.PI / 180; return [x, -Math.cos(r), Math.sin(r) + 0.06, 0]; };
  P.armL = armDir(fL, 0.13);
  P.armR = armDir(fR, -0.14);
  P.elbowL = [G.elbow + G.elbowSwing * Math.max(0, fL) / Math.max(1, G.armSwing)];
  P.elbowR = [G.elbowR + G.elbowSwing * 0.6 * Math.max(0, fR) / Math.max(1, G.armSwingR)];
  P.handR = [G.gunHand, 0, -4];
  P.shoulderL = [0, 3 * c, 1.5 * bobC];
  P.shoulderR = [0, 3 * c, -1.5 * bobC];
  return P;
}

export const WALK_G = {
  speed: WALK.speed, T: WALK.T, beta: 0.62, sHeel: 0.13, sBall: 0.6,
  strikePitch: 16, toePitch: 30, swingPitch: 6, swingTan: 0.35, lift: 0.075, liftSkew: 0.8,
  zOff: -0.035, stepW: 0.1, toeOut: 7,
  hipsY: 0.93, hipsZ: 0.0, bob: 0.03, bobPeak: 0.31, sway: 0.018,
  lean: 4, pelvisYaw: 6, pelvisRoll: 3, twist: 8, breathe: 0.5,
  armSwing: 18, armSwingR: 11, elbow: 14, elbowR: 24, elbowSwing: 14, gunHand: -45, headPitch: 3,
};
export const RUN_G = {
  speed: RUN.speed, T: RUN.T, beta: 0.36, sHeel: 0.1, sBall: 0.45,
  strikePitch: 8, toePitch: 42, swingPitch: 4, swingTan: 0.25, lift: 0.2, liftSkew: 0.7,
  zOff: -0.06, stepW: 0.075, toeOut: 5,
  hipsY: 0.885, hipsZ: 0.03, bob: 0.05, bobPeak: 0.43, sway: 0.01,
  lean: 11, pelvisYaw: 9, pelvisRoll: 3, twist: 12, breathe: 1,
  armSwing: 36, armSwingR: 26, elbow: 78, elbowR: 70, elbowSwing: 18, gunHand: -20, headPitch: 6,
};

// ---------------------------------------------------------------------------
// poses
export function idlePose(t) {
  const u = t / 4;
  const breath = Math.sin(TAU * u), sway = Math.sin(TAU * u + 0.6), look = Math.sin(TAU * u + 1.2);
  return mergePose(NEUTRAL, {
    hipsPos: [0.014 * sway, 0.952 - 0.003 * Math.abs(sway), 0],
    hips: [0, 2 * sway, 1.6 * sway],
    spine: [3, -1 * sway, -1.0 * sway],
    chest: [-2 - 1.2 * breath, 0, -0.4 * sway],
    neck: [8, 4 * look, 0],
    head: [-5 + 1.5 * Math.sin(TAU * u * 2 + 0.3), 9 * look, 1.5 * sway],
    shoulderL: [0, 0, 0.9 * breath],
    shoulderR: [0, 0, -0.9 * breath],
    armL: [0.115, -1, 0.07 + 0.01 * breath, 0],
    armR: [-0.115, -1, 0.11 + 0.01 * breath, 0],
    footL: [0.12, ANKLE_Y, 0.03],
    footR: [-0.115, ANKLE_Y, -0.02],
    footRotL: [0, 9, 0],
    footRotR: [0, 12, 0],
  });
}

// Aim, upper body: chest turned ~30 deg (right shoulder forward), right arm
// straight at the target (root +Z, shoulder height), head squared to the
// target, left hand in the coat pocket.
const AIM_UPPER = {
  spine: [2, 9, 0],
  chest: [-3, 13, 0],
  neck: [4, -6, 0],
  head: [0, 0, 0],
  headRoot: [6, 2, 2],
  headLevel: [0.92],
  shoulderR: [0, -6, -4],
  shoulderL: [0, 4, 0],
  armR: [0.035, 0.02, 1, 0],
  elbowR: [3],
  handR: [6, 0, 0],
  handTL: [0.215, 0.93, 0.02],
  elbowPoleL: [1, 0.1, -0.7],
  handL: [10, 0, 10],
};
// nearly square, a slight crouch (the reference's shooter by the car): the
// feet only 0.14 m apart front to back, the 30 deg turn is in the torso
const AIM_LOWER = {
  hipsPos: [0.005, 0.945, 0],
  hips: [2, 10, 0],
  footL: [0.14, ANKLE_Y, 0.07],
  footR: [-0.145, ANKLE_Y, -0.07],
  footRotL: [0, 12, 0],
  footRotR: [0, 18, 0],
  kneeL: [0.2, 0, 1],
  kneeR: [-0.15, 0, 1],
};
function aimPose(t) {
  const w = Math.sin(TAU * t / 2);
  const P = mergePose(NEUTRAL, { ...AIM_LOWER, ...AIM_UPPER });
  P.hipsPos[1] += 0.004 * Math.sin(TAU * t / 2 + 1);
  P.chest = [P.chest[0] - 0.8 * w, P.chest[1], P.chest[2]];
  P.armR = [P.armR[0] + 0.004 * Math.sin(TAU * t / 2 + 2), P.armR[1] + 0.006 * w, 1, 0];
  return P;
}

export const keysOf = (arr) => arr.map(([t, over]) => ({ t, pose: mergePose(NEUTRAL, over) }));
// fill each key from the previous one so partial keys hold their values
export function chainKeys(arr) {
  const out = [];
  let prev = mergePose(NEUTRAL, {});
  for (const [t, over] of arr) { prev = mergePose(prev, over); out.push({ t, pose: prev }); }
  return out;
}

// deathBack: the reference's centre man. Chest thrown out, arms up and back,
// head back (the hat flies, Hood.js), a stagger step back with the front knee
// bent, then the fall onto the back and a small bounce into a settled pose.
export const DEATH_BACK = chainKeys([
  [0.0, {}],
  // impact: chest punched out, head snaps back, the gun arm flung up ~35 deg
  // above the horizontal, the left dropped ~20 deg below and back, the chest
  // wrenched round to the right: the two arms never mirror each other, so
  // even from directly behind he is not a T-pose
  [0.1, {
    hipsPos: [0, 0.95, 0.05], hips: [-5, -3, 0],
    spine: [-8, -4, 0], chest: [-17, -15, 3], neck: [-10, 0, 0], head: [-24, 10, 0],
    shoulderL: [0, 0, 4], shoulderR: [0, 0, -14],
    armR: [-0.8, 0.68, 0.5, 0], elbowR: [26], handR: [10, 0, 0],
    armL: [0.55, -0.3, -0.55, 0], elbowL: [28], handL: [-20, 0, 0],
    footR: [-0.12, 0.13, -0.12], footRotR: [-18, 8, 0],
  }],
  // the reference's frame: still over his feet, torso back ~25 deg, chest
  // arched, gun arm up and back, a wide stance with the front leg thrust
  // forward
  [0.3, {
    hipsPos: [0.01, 0.88, -0.07], hips: [-10, -8, 3],
    spine: [-8, -4, 0], chest: [-15, -16, 3], neck: [-12, 0, 0], head: [-26, 14, 4],
    armR: [-0.9, 0.67, 0.34, 0], elbowR: [22],
    armL: [0.55, -0.29, -0.58, 0], elbowL: [28],
    footL: [0.13, ANKLE_Y, 0.28], footRotL: [12, 8, 0],
    footR: [-0.14, ANKLE_Y, -0.36], footRotR: [0, 8, 0],
  }],
  // going over: the gun arm flung high over the head, the left out level
  [0.55, {
    hipsPos: [0.01, 0.56, -0.42], hips: [-48, -8, 5],
    spine: [-8, -2, 0], chest: [-10, -10, 2], neck: [-10, 0, 0], head: [-18, 14, 0],
    armR: [-0.5, 0.8, 0.22, 0], elbowR: [24],
    armL: [0.85, 0.05, -0.45, 0], elbowL: [35],
    footL: [0.12, 0.1, 0.24], footRotL: [18, 8, 0], kneeL: [0.1, 0.4, 1],
    footR: [-0.13, ANKLE_Y, -0.32], kneeR: [-0.1, 0.4, 1],
  }],
  [0.78, {
    hipsPos: [0.01, 0.2, -0.72], hips: [-82, -5, 4],
    spine: [-4, 0, 0], chest: [-6, -4, 0], neck: [-6, 0, 0], head: [-16, 18, 0],
    armR: [-0.6, 0.35, -0.72, 0], elbowR: [22],
    armL: [0.86, 0.32, -0.38, 0], elbowL: [30],
    footL: [0.13, 0.32, 0.18], footRotL: [30, 10, 0], kneeL: [0.1, 1, 0.3],
    footR: [-0.15, 0.2, 0.04], footRotR: [25, 10, 0], kneeR: [-0.1, 1, 0.3],
  }],
  [0.92, {
    hipsPos: [0.01, 0.16, -0.78], hips: [-89, -4, 3],
    spine: [3, 0, 0], chest: [4, -2, -2], head: [-8, 26, 4],
    footL: [0.17, 0.09, -0.12], footRotL: [45, 10, 0], kneeL: [0.25, 1, 0.1],
    footR: [-0.2, 0.08, 0.06], footRotR: [55, 15, 0], kneeR: [-0.05, 1, 0.05],
  }],
  // settled (Phase 2b polish): not a plank. The ribcage is pitched ~12 deg
  // up off the street (chest ~0.2 m high, shoulders pressed back), the head
  // rolled ~25 deg to one side; the gun arm lies up beside the head with the
  // forearm bent back over it, the left arm is flung out ~70 deg from the
  // body, palm up: no cross, no mirror symmetry
  [1.15, {
    hipsPos: [0.01, 0.15, -0.8], hips: [-90, -3, 2],
    spine: [5, 0, 0], chest: [7, -3, -3], neck: [-6, 0, 0], head: [-10, 25, 6],
    shoulderL: [-8, 0, 6], shoulderR: [-8, 0, -8],
    armR: [-0.5, -0.12, -0.86, 90], elbowR: [78], handR: [-10, 0, 20],
    armL: [0.93, -0.1, 0.34, 180], elbowL: [16], handL: [0, 0, -12],
    // the right leg out straight, the left knee bent and fallen open to the
    // side (the coat lies on the street, Hood.driveSkirt)
    footL: [0.24, 0.085, -0.02], footRotL: [55, 38, 0], kneeL: [1, 0.3, 0.1],
    footR: [-0.2, 0.085, 0.085], footRotR: [75, 22, 0], kneeR: [-0.35, 1, 0.0],
  }],
]);

// deathKnees: doubled over by a gut shot, drop to the knees, sway, then fall
// forward onto the face.
export const DEATH_KNEES = chainKeys([
  [0.0, {}],
  [0.12, {
    hipsPos: [0, 0.92, -0.04], hips: [8, 0, 0],
    spine: [14, 0, 0], chest: [12, 0, 0], neck: [4, 0, 0], head: [10, 0, 0],
    armL: [0.2, -0.55, 0.75, 0], elbowL: [95], armR: [-0.2, -0.65, 0.6, 0], elbowR: [80],
    footRotL: [0, 8, 0], footRotR: [0, 8, 0],
  }],
  // the heels come up, then the feet trail up and back as the knees drop,
  // so the toes never dig through the street
  [0.24, {
    hipsPos: [0, 0.74, 0.04], hips: [6, 0, 0],
    footL: [0.12, 0.13, -0.05], footRotL: [-40, 6, 0], kneeL: [0.1, 0, 1],
    footR: [-0.12, 0.13, -0.07], footRotR: [-40, 6, 0], kneeR: [-0.1, 0, 1],
  }],
  [0.32, {
    hipsPos: [0, 0.6, 0.05], hips: [5, 0, 0],
    footL: [0.12, 0.2, -0.3], footRotL: [-120, 6, 0],
    footR: [-0.12, 0.2, -0.32], footRotR: [-120, 6, 0],
  }],
  [0.4, {
    hipsPos: [0, 0.54, 0.04], hips: [4, 0, 0],
    spine: [10, 0, 0], chest: [8, 0, 0], head: [14, 0, 0],
    footL: [0.12, 0.1, -0.4], footRotL: [-165, 6, 0], kneeL: [0.1, 0, 1],
    footR: [-0.12, 0.1, -0.42], footRotR: [-165, 6, 0], kneeR: [-0.1, 0, 1],
  }],
  [0.6, {
    hipsPos: [0, 0.55, 0.02], hips: [-3, 0, 3],
    spine: [-2, 0, 0], chest: [-4, 0, -3], neck: [-4, 0, 0], head: [-12, 10, 8],
    armL: [0.22, -1, 0.1, 0], elbowL: [16], armR: [-0.22, -1, 0.15, 0], elbowR: [20],
  }],
  [0.76, {
    hipsPos: [0, 0.47, 0.18], hips: [34, 0, 2],
    spine: [8, 0, 0], chest: [8, 0, 0], neck: [4, 0, 0], head: [18, 6, 4],
    armL: [0.25, -0.8, 0.55, 0], elbowL: [20], armR: [-0.22, -0.8, 0.6, 0], elbowR: [20],
  }],
  [0.92, {
    hipsPos: [0, 0.22, 0.42], hips: [78, 0, 2],
    spine: [4, 0, 0], chest: [2, 0, 0], neck: [-4, 0, 0], head: [-6, 40, 0],
    armL: [0.62, -0.2, 0.72, 0], elbowL: [30], armR: [-0.55, -0.3, 0.75, 0], elbowR: [35],
    footL: [0.13, 0.12, -0.36], footR: [-0.13, 0.14, -0.4],
  }],
  [1.15, {
    hipsPos: [0, 0.15, 0.5], hips: [90, 0, 2],
    spine: [2, 0, 0], chest: [2, 0, 0], neck: [-8, 0, 0], head: [-4, 70, 0],
    armL: [0.3, -0.05, -1, 0], elbowL: [10], handL: [0, 0, 0],
    armR: [-0.55, -0.05, 0.85, 0], elbowR: [45],
    footL: [0.15, 0.1, -0.42], footRotL: [-165, 12, 0], kneeL: [0, -1, 0.1],
    footR: [-0.16, 0.1, -0.4], footRotR: [-165, 12, 0], kneeR: [0, -1, 0.1],
  }],
]);

// deathSpin: spun half round by a shoulder hit, crumple onto the left side.
// The hips and chest lead the turn from the first frames; the gun arm is
// flung up and back, the left drops across the body, and both fall as the
// turn gathers: never a symmetrical T with rod arms.
const DEATH_SPIN = chainKeys([
  [0.0, {}],
  [0.1, {
    hipsPos: [0, 0.94, 0], hips: [0, -10, 2],
    spine: [-2, -10, 4], chest: [-8, -22, 6], neck: [-4, 0, 0], head: [-12, -8, 8],
    shoulderR: [0, 0, -12], shoulderL: [0, 0, -4],
    armR: [-0.62, 0.62, -0.48, 0], elbowR: [32], handR: [10, 0, 0],
    armL: [-0.3, -0.45, 0.84, 0], elbowL: [52], handL: [0, 0, 20],
  }],
  [0.2, {
    rootYaw: [-45], hipsPos: [0, 0.9, 0], hips: [2, -22, -4],
    spine: [2, -12, 6], chest: [-4, -22, 8], head: [-6, -14, 10],
    armR: [-0.72, 0.1, -0.62, 0], elbowR: [36],
    armL: [-0.25, -0.62, 0.72, 0], elbowL: [62],
    footR: [-0.14, 0.12, -0.06], footRotR: [-12, 8, 0],
  }],
  // mid-turn: the gun arm already falling behind him, the left hand clutched
  // across his belly, the body starting to fold
  [0.3, {
    rootYaw: [-95], hipsPos: [0.015, 0.85, 0.01], hips: [6, -18, -7],
    spine: [6, -9, 0], chest: [4, -14, 2], neck: [2, 0, 0], head: [6, -6, 0],
    armR: [-0.62, -0.55, -0.58, 0], elbowR: [34],
    armL: [-0.35, -0.6, 0.72, 0], elbowL: [70],
  }],
  // the turn carries him round: folding forward and over to his left, the
  // gun arm trailing out behind, the left arm in front of him
  [0.4, {
    rootYaw: [-140], hipsPos: [0.03, 0.8, 0.02], hips: [10, -15, -12],
    spine: [10, -6, -4], chest: [10, -8, -2], neck: [6, 0, 0], head: [16, 4, -8],
    shoulderR: [0, 0, -4], shoulderL: [0, 0, 0],
    armR: [-0.72, -0.3, -0.55, 0], elbowR: [30],
    armL: [0.25, -0.7, 0.65, 0], elbowL: [50],
    footR: [-0.16, 0.12, -0.08], footRotR: [-10, 8, 0], kneeL: [0.4, 0, 1],
  }],
  [0.58, {
    rootYaw: [-178], hipsPos: [0.08, 0.6, -0.04], hips: [10, -8, -30],
    spine: [6, 0, 0], chest: [6, 0, 6], head: [10, 0, 16],
    footR: [-0.16, ANKLE_Y, -0.04], footRotR: [0, 8, 0], kneeL: [0.2, 0, 1], kneeR: [0, 0, 1],
    armL: [0.55, -0.8, 0.2, 0], elbowL: [30], armR: [-0.25, -0.75, -0.45, 0], elbowR: [25],
  }],
  [0.82, {
    rootYaw: [-182], hipsPos: [0.28, 0.26, 0.0], hips: [8, 4, -76],
    spine: [8, 0, 4], chest: [8, 0, 6], neck: [6, 0, 8], head: [8, 0, 20],
    footL: [-0.25, 0.1, 0.12], footRotL: [0, 20, -70], kneeL: [0, 0.3, 1],
    footR: [-0.22, 0.22, 0.2], footRotR: [0, 10, -70], kneeR: [0, 0.3, 1],
    armL: [-0.2, -0.5, 0.8, 0], elbowL: [30], armR: [0.3, -0.7, 0.6, 0], elbowR: [25],
  }],
  [1.1, {
    rootYaw: [-180], hipsPos: [0.3, 0.17, 0.0], hips: [6, 8, -88],
    spine: [8, 0, 4], chest: [10, 0, 5], neck: [5, 0, 10], head: [8, 0, 22],
    footL: [-0.34, 0.08, 0.16], footRotL: [0, 25, -85], kneeL: [0, 0, 1],
    footR: [-0.3, 0.2, 0.26], footRotR: [0, 15, -80], kneeR: [0, 0.2, 1],
    armL: [-0.25, -0.35, 0.9, 0], elbowL: [40], armR: [0.25, -0.75, 0.55, 0], elbowR: [30],
  }],
]);

// stagger: thrown back by a heavy hit, two quick steps back, recover. Authored
// with the body travelling back; the travel is extracted as root motion.
const STAGGER_RAW = chainKeys([
  [0.0, {}],
  [0.1, {
    hipsPos: [0, 0.94, -0.05], hips: [-6, 4, 0],
    spine: [-10, 5, 0], chest: [-12, 6, 0], neck: [-6, 0, 0], head: [-15, -6, 4],
    armL: [0.8, -0.3, 0.35, 0], elbowL: [30], armR: [-0.7, -0.2, 0.5, 0], elbowR: [25],
  }],
  [0.22, { footR: [-0.12, 0.15, -0.18], footRotR: [-15, 8, 0], hipsPos: [0, 0.93, -0.14] }],
  [0.32, { footR: [-0.13, ANKLE_Y, -0.34], footRotR: [0, 10, 0], hipsPos: [0, 0.92, -0.22] }],
  [0.46, { footL: [0.12, 0.16, -0.28], footRotL: [-15, 8, 0], hipsPos: [0, 0.92, -0.36], spine: [-4, 2, 0], chest: [-6, 2, 0] }],
  [0.58, { footL: [0.12, ANKLE_Y, -0.54], footRotL: [0, 8, 0], hipsPos: [0, 0.93, -0.46] }],
  [0.8, {
    hipsPos: [0, 0.945, -0.52], hips: [2, 0, 0], spine: [5, 0, 0], chest: [0, 0, 0], neck: [8, 0, 0], head: [-2, 0, 0],
    armL: [0.2, -1, 0.1, 0], elbowL: [16], armR: [-0.2, -1, 0.15, 0], elbowR: [22],
  }],
  [1.2, { hipsPos: [0, 0.955, -0.54], footL: [0.115, ANKLE_Y, -0.52], footR: [-0.115, ANKLE_Y, -0.54], ...Object.fromEntries(['spine', 'chest', 'neck', 'head', 'armL', 'armR', 'elbowL', 'elbowR', 'hips'].map((k) => [k, NEUTRAL[k]])) }],
]);
const STAGGER_RM = (t) => samplePoseKeys(STAGGER_RAW, t).hipsPos[2];
function staggerPose(t) {
  const P = samplePoseKeys(STAGGER_RAW, t);
  const rz = STAGGER_RM(t);
  P.hipsPos = [P.hipsPos[0], P.hipsPos[1], P.hipsPos[2] - rz];
  P.footL = [P.footL[0], P.footL[1], P.footL[2] - rz];
  P.footR = [P.footR[0], P.footR[1], P.footR[2] - rz];
  return P;
}

// ---------------------------------------------------------------------------
// additive overlays
// fire: 5-frame recoil (arm up ~6 deg, wrist flick, chest back, hat nod)
const FIRE_KEYS = [
  { t: 0, bones: {} },
  { t: 0.035, bones: { upperArmR: [-4, 0, 0], handR: [-5, 0, 0], chest: [-1.5, 0, 0], spine: [-0.5, 0, 0], head: [-1.5, 0, 0], shoulderR: [0, -3, 0] } },
  { t: 0.083, bones: { upperArmR: [-3, 0, 0], handR: [-3, 0, 0], chest: [-1.2, 0, 0], spine: [-0.4, 0, 0], head: [2.5, 0, 0], shoulderR: [0, -2, 0] } },
  { t: 0.14, bones: { upperArmR: [-1, 0, 0], handR: [-0.5, 0, 0], chest: [-0.3, 0, 0], head: [1.5, 0, 0] } },
  { t: 0.24, bones: { upperArmR: [0, 0, 0], handR: [0, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], shoulderR: [0, 0, 0] } },
];
// flinch (hit on the LEFT side; mirrored for the right): the torso twists
// away from the hit and is thrown back, the head snaps, the arm flails
function flinchKeys(m) {
  const k = (v) => [v[0], v[1] * m, v[2] * m];
  const armNear = m > 0 ? 'upperArmL' : 'upperArmR', foreNear = m > 0 ? 'forearmL' : 'forearmR';
  const armFar = m > 0 ? 'upperArmR' : 'upperArmL';
  const flail = (a, b) => [a, 0, b * m];
  // (the head snaps hard in the first frames, ahead of the torso; the
  // chest twists ~30 deg so the hit reads from behind too)
  return [
    { t: 0, bones: {} },
    { t: 0.05, bones: { spine: k([-5, 12, 3]), chest: k([-8, 18, 5]), neck: k([-10, 8, 4]), head: k([-22, 16, 12]), [armNear]: flail(-20, 24), [foreNear]: [-24, 0, 0], [armFar]: flail(8, 8) } },
    { t: 0.17, bones: { spine: k([-8, 19, 5]), chest: k([-11, 30, 7]), neck: k([-7, 7, 5]), head: k([-16, 12, 12]), [armNear]: flail(-34, 36), [foreNear]: [-38, 0, 0], [armFar]: flail(14, 12) } },
    { t: 0.36, bones: { spine: k([-3, 9, 2]), chest: k([-4, 12, 2]), neck: k([-2, 3, 1]), head: k([-6, 5, 4]), [armNear]: flail(-12, 12), [foreNear]: [-12, 0, 0], [armFar]: flail(4, 4) } },
    { t: 0.66, bones: { spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], [armNear]: [0, 0, 0], [foreNear]: [0, 0, 0], [armFar]: [0, 0, 0] } },
  ];
}

// flinch step (lower body, when he is standing): knocked ~0.15 m away from
// the hit and back. The far foot (away from the hit) steps out first and
// takes the weight while the near foot's toe comes up off the street, then
// the near foot follows. Authored in place with the body travelling; the
// travel is extracted as root motion (x, z) so the planted feet stay put.
const STEP_IDLE = { L: [0.12, 0.03], R: [-0.115, -0.02] };
function flinchStepKeys(m) {
  const F = m > 0 ? 'R' : 'L', N = m > 0 ? 'L' : 'R';
  const sx = -0.1 * m, sz = -0.11;
  const [xF, zF] = STEP_IDLE[F], [xN, zN] = STEP_IDLE[N];
  return chainKeys([
    [0.0, { hipsPos: [0, 0.952, 0], footL: [0.12, ANKLE_Y, 0.03], footR: [-0.115, ANKLE_Y, -0.02] }],
    [0.05, { hipsPos: [0.1 * sx, 0.948, 0.1 * sz], hips: [-3, -6 * m, 3 * m] }],
    [0.13, {
      hipsPos: [0.35 * sx, 0.943, 0.35 * sz], hips: [-4, -8 * m, 4 * m],
      ['foot' + F]: [xF + 0.35 * sx - 0.05 * m, 0.12, zF + 0.4 * sz], ['footRot' + F]: [-15, 10, 0],
    }],
    [0.25, {
      hipsPos: [0.8 * sx, 0.935, 0.8 * sz], hips: [-5, -8 * m, 3 * m],
      // (the stepping foot lands ~6 cm further out than the body travels,
      // so the two shins never overlap in silhouette: Phase 2b polish)
      ['foot' + F]: [xF + sx - 0.06 * m, ANKLE_Y, zF + sz], ['footRot' + F]: [0, 10, 0],
      // weight back on the heel: the near foot's toe lifts
      ['foot' + N]: [xN, 0.087, zN - 0.025], ['footRot' + N]: [18, 8, 0],
    }],
    [0.37, {
      hipsPos: [0.93 * sx, 0.94, 0.93 * sz], hips: [-2, -5 * m, 1 * m],
      ['foot' + N]: [xN + 0.45 * sx, 0.105, zN + 0.55 * sz], ['footRot' + N]: [-4, 8, 0],
    }],
    [0.5, {
      hipsPos: [sx, 0.949, sz], hips: [0, -2 * m, 0],
      ['foot' + N]: [xN + sx, ANKLE_Y, zN + sz], ['footRot' + N]: [0, 8, 0],
    }],
    [0.75, { hipsPos: [sx, 0.952, sz], hips: [0, 0, 0] }],
  ]);
}
function bakeFlinchStep(name, m) {
  const K = flinchStepKeys(m);
  const rm = (t) => { const h = samplePoseKeys(K, t).hipsPos; return [h[0], h[2]]; };
  return bake(name, 0.75, (t) => {
    const P = samplePoseKeys(K, t);
    const [rx, rz] = rm(t);
    P.hipsPos = [P.hipsPos[0] - rx, P.hipsPos[1], P.hipsPos[2] - rz];
    P.footL = [P.footL[0] - rx, P.footL[1], P.footL[2] - rz];
    P.footR = [P.footR[0] - rx, P.footR[1], P.footR[2] - rz];
    return P;
  }, { rootMotion: rm });
}

// ---------------------------------------------------------------------------
let CLIPS = null;
export function getClips() {
  if (CLIPS) return CLIPS;
  const deathLen = 1.15;
  CLIPS = {
    idle: bake('idle', 4, idlePose, { loop: true }),
    walk: bake('walk', WALK.T, (t) => gaitPose(t / WALK.T, WALK_G), { loop: true }),
    run: bake('run', RUN.T, (t) => gaitPose(t / RUN.T, RUN_G), { loop: true }),
    aim: bake('aim', 2, aimPose, { loop: true, armSpace: 'root' }),
    stagger: bake('stagger', 1.2, staggerPose, { rootMotion: STAGGER_RM }),
    deathBack: bake('deathBack', deathLen, (t) => samplePoseKeys(DEATH_BACK, t), { armSpace: 'root' }),
    deathKnees: bake('deathKnees', deathLen, (t) => samplePoseKeys(DEATH_KNEES, t), { armSpace: 'root' }),
    deathSpin: bake('deathSpin', 1.1, (t) => samplePoseKeys(DEATH_SPIN, t), { armSpace: 'root' }),
    fire: bakeAdditive('fire', FIRE_KEYS),
    flinchL: bakeAdditive('flinchL', flinchKeys(1)),
    flinchR: bakeAdditive('flinchR', flinchKeys(-1)),
    flinchStepL: bakeFlinchStep('flinchStepL', 1),
    flinchStepR: bakeFlinchStep('flinchStepR', -1),
  };
  return CLIPS;
}
export const DEATHS = ['deathBack', 'deathKnees', 'deathSpin'];
// when the hat leaves the head (s into the death clip)
export const HAT_OFF = { deathBack: 0.04, deathSpin: 0.18, deathKnees: 0.9 };

// exposed for the headless foot-slide test (tools)
export const _gait = { gaitFoot, WALK_G, RUN_G, gaitPose };

// ---------------------------------------------------------------------------
// One channel (lower or upper) of a Hood's mixer: a set of actions whose
// weights always sum to 1, cross-faded linearly.
class Channel {
  constructor(mixer, part) {
    this.mixer = mixer;
    this.part = part;
    this.slots = new Map();   // name -> { action, w, target, rate }
    this.current = null;
  }
  action(clipPair) {
    return this.mixer.clipAction(clipPair[this.part]);
  }
  play(clipPair, { fade = 0.2, time = null, timeScale = 1 } = {}) {
    const name = clipPair.name;
    if (this.current === name) return this.slots.get(name).action;
    let slot = this.slots.get(name);
    const a = this.action(clipPair);
    if (!slot) {
      slot = { action: a, w: 0, target: 1, rate: 0 };
      this.slots.set(name, slot);
      a.reset();
      a.setLoop(clipPair.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !clipPair.loop;
      a.play();
    }
    if (time != null) a.time = time;
    a.timeScale = timeScale;
    const rate = 1 / Math.max(fade, 1e-3);
    for (const [n, s] of this.slots) { s.target = n === name ? 1 : 0; s.rate = rate; }
    if (fade <= 0) for (const s of this.slots.values()) s.w = s.target;
    this.current = name;
    return a;
  }
  get(name) { const s = this.slots.get(name); return s ? s.action : null; }
  update(dt) {
    let sum = 0;
    for (const [n, s] of this.slots) {
      s.w += Math.sign(s.target - s.w) * Math.min(Math.abs(s.target - s.w), s.rate * dt);
      if (s.w <= 0 && s.target === 0) { s.action.stop(); this.slots.delete(n); continue; }
      sum += s.w;
    }
    for (const s of this.slots.values()) s.action.setEffectiveWeight(sum > 0 ? s.w / sum : 0);
  }
}

// Per-Hood animation state: base clip on both channels, an optional upper
// overlay (aim), additive fire/flinch. Time-scale of the gaits follows speed.
export class HoodAnimator {
  // clips: a costume's own bank (the Hood's clips and its own), or the Hood's
  constructor(root, clips = null) {
    this.clips = clips || getClips();
    this.mixer = new THREE.AnimationMixer(root);
    this.lower = new Channel(this.mixer, 'lower');
    this.upper = new Channel(this.mixer, 'upper');
    this.base = null;
    this.overlay = null;
    this.baseTime = 0;
    this.play('idle', { fade: 0 });
  }

  // base: idle | walk | run | aim | stagger | death*
  play(name, { fade = 0.22, timeScale = 1 } = {}) {
    const C = this.clips;
    const clip = C[name];
    if (!clip) throw new Error('HoodAnimator: no clip ' + name);
    // keep the gait phase when switching between cyclic locomotion clips
    let time = null;
    const prev = this.base && C[this.base];
    const pa = prev && this.lower.get(prev.name);
    if (pa && prev.loop && clip.loop && (name === 'walk' || name === 'run') && (prev.name === 'walk' || prev.name === 'run')) {
      time = ((pa.time / prev.duration) % 1) * clip.duration;
    } else if (!clip.loop) time = 0;
    this.base = name;
    this.baseTime = 0;
    this.lowerOnce = null;
    this.lower.play(clip, { fade, time, timeScale });
    if (!this.overlay || !clip.loop) {
      if (!clip.loop) this.overlay = null;
      this.upper.play(clip, { fade, time: time ?? this.lower.get(clip.name).time, timeScale });
    }
  }

  setTimeScale(s) {
    for (const ch of [this.lower, this.upper]) {
      const a = ch.get(this.base);
      if (a) a.timeScale = s;
    }
  }

  // upper-body overlay (aim) over whatever the legs do; null returns the
  // upper body to the base clip in phase with the legs
  setOverlay(name, fade = 0.2) {
    if (name === this.overlay) return;
    const C = this.clips;
    if (this.base && !C[this.base].loop) return;   // no overlays while dying / staggering
    this.overlay = name;
    if (name) this.upper.play(C[name], { fade });
    else {
      const la = this.lower.get(this.base);
      this.upper.play(C[this.base], { fade, time: la ? la.time : 0, timeScale: la ? la.timeScale : 1 });
    }
  }

  // a one-shot clip on the legs only (the flinch step) over the current
  // base; the upper body keeps its clip. Returns to the base when done.
  playLower(name, fade = 0.08) {
    const C = this.clips;
    if (!this.base || !C[this.base].loop) return false;
    this.lower.play(C[name], { fade, time: 0 });
    this.lowerOnce = { name, t: 0 };
    return true;
  }

  additive(name, weight = 1) {
    const a = this.mixer.clipAction(this.clips[name].clip);
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.setEffectiveWeight(weight);
    a.play();
    return a;
  }

  update(dt) {
    const L = this.lowerOnce;
    if (L) {
      L.t += dt;
      const c = this.clips[L.name];
      if (L.t >= c.duration - 0.2 || this.base === L.name) {
        this.lowerOnce = null;
        const base = this.clips[this.base];
        if (base && base.loop && this.lower.current === L.name) {
          const ua = this.upper.get(this.overlay ? null : base.name);
          this.lower.play(base, { fade: 0.25, time: ua ? ua.time : null });
        }
      }
    }
    this.lower.update(dt);
    this.upper.update(dt);
    this.baseTime += dt;
    this.mixer.update(dt);
  }

  get finished() {
    const clip = this.clips[this.base];
    return !clip.loop && this.baseTime >= clip.duration;
  }
}
