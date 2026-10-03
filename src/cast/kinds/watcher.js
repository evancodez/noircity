import * as THREE from 'three';
import { NEUTRAL, mergePose, samplePoseKeys, ANKLE_Y } from '../../enemies/HoodRig.js';
import { gaitPose, chainKeys } from '../../enemies/HoodAnim.js';

// The watcher (lane B4, scene 6): tall and narrow, a bowler, a long pale
// raincoat belted at the waist, an umbrella (the scene gives it to him:
// src/scenes/watcher/umbrella.js). Read at 25 m by the outline alone: the
// bowler's round crown and flat brim, the narrow shoulders, the coat to
// mid-shin whose tails stream out behind him when he runs (the coat's
// spring is tipped back by his speed: the scene's afterPose, see
// scenes/watcher/figure.js), one hand holding the bowler on.
// Clips (timing here, poses below; model metres, the figure faces +z, his
// left is +x):
//   watcher_stand   under his umbrella, looking up at a third-floor window
//   watcher_notice  he sees me see him: a start, the umbrella arm drops
//   watcher_run     the sprint: long strides, the left hand on the bowler,
//                   the right arm pumping (the gait is WRUN: its speed is the
//                   clip's, the scene sets the time scale from his real speed)
//   watcher_vault   over a board fence 0.9 m ahead: the right hand plants on
//                   its top rail, the body swings over sideways, he lands
//                   running (root motion: 2.6 m)
//   watcher_carIn   at his car's door: the hand to the handle, in (1.0 s)
const TAU = Math.PI * 2;
const S = Math.sin;
const A = ANKLE_Y;
const P = (over) => mergePose(NEUTRAL, over);
const sm = (x) => x * x * (3 - 2 * x);
const pw = (t, keys) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const u = sm((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])); return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * u; }
  return keys[keys.length - 1][1];
};

// the sprint: a long stride, a short stance, the heel thrown up behind, a
// strong forward lean from the ankles
export const WRUN = {
  speed: 6.0, T: 0.6, beta: 0.2, sHeel: 0.1, sBall: 0.5,
  strikePitch: 5, toePitch: 42, swingPitch: 14, swingTan: 0.32, lift: 0.4, liftSkew: 0.55,
  zOff: 0.04, stepW: 0.055, toeOut: 3,
  hipsY: 0.93, hipsZ: 0.1, bob: 0.06, bobPeak: 0.5, sway: 0.008,
  lean: 25, pelvisYaw: 12, pelvisRoll: 3, twist: 16, breathe: 1.5,
  armSwing: 30, armSwingR: 52, elbow: 90, elbowR: 86, elbowSwing: 16, gunHand: -10, headPitch: 3,
};
function runPose(phase) {
  const G = WRUN;
  const Pp = gaitPose(phase, G);
  // the left hand holds the bowler on: on its crown's front-left, riding
  // the head's bob (the hips' bob) and lean
  const bob = Pp.hipsPos[1] - G.hipsY;
  Pp.handTL = [0.07, 1.735 + bob * 0.95, 0.27];
  Pp.elbowPoleL = [1, 0.1, 0.35];
  Pp.handL = [-70, -10, 40];
  Pp.shoulderL = [0, 0, -8];
  // (the chest turns less toward the right arm's pump: the left is up)
  Pp.chest = [Pp.chest[0], Pp.chest[1] * 0.6, Pp.chest[2]];
  return Pp;
}

// under the umbrella: the handle in the right fist at the chest, the shaft
// up past his head; weight on the left leg; looking up (the window is 30
// degrees above him)
function standPose(t) {
  const b = S(TAU * t / 5), w = 0.6 * S(TAU * t / 7 + 1) + 0.4 * S(TAU * t / 3.1);
  return P({
    hipsPos: [0.015, 0.95, 0], hips: [0, 4, -2 + w], spine: [1, -2, 1], chest: [-3 - 1.2 * b, 0, 0],
    neck: [-8, 2 * w, 0], head: [-22 + 1.5 * b, 5 * w, 0], headRoot: [-28, 0, 0], headLevel: [0.5],
    handTR: [-0.08, 1.2, 0.2], elbowPoleR: [-1, -0.5, -0.2], handR: [0, 0, -80],
    armL: [0.1, -1, 0.05, 0], elbowL: [12], handL: [0, 0, 6],
    footL: [0.12, A, 0.04], footR: [-0.11, A, -0.04], footRotL: [0, 10, 0], footRotR: [0, 14, 0],
  });
}

// he sees me see him: a start (the head up and back, the shoulders up),
// the umbrella arm goes slack and drops; then he turns (the scene turns him)
const NOTICE = chainKeys([
  [0, {}],
  [0.12, { chest: [-7, 0, 0], neck: [-12, 0, 0], head: [-30, 0, 0], shoulderL: [0, 0, 5], shoulderR: [0, 0, -5] }],
  [0.4, { handTR: [-0.2, 1.05, 0.22], handR: [0, 0, -60], chest: [-2, -8, 0], head: [-18, -10, 0] }],
  [0.75, { handTR: [-0.26, 0.9, 0.12], elbowPoleR: [-1, -0.3, -0.5], handR: [0, 0, -20], hips: [4, -14, 0], chest: [6, -16, 0], neck: [4, -10, 0], head: [-4, -20, 0], footR: [-0.16, A, -0.12] }],
  [0.95, { hipsPos: [0.02, 0.92, 0.04], hips: [8, -18, 0], spine: [6, -8, 0], chest: [8, -12, 0], head: [0, -14, 0], footR: [-0.14, A + 0.05, -0.2], footRotR: [-20, 10, 0] }],
]);
function noticePose(t) {
  const base = standPose(0);
  const k = samplePoseKeys(NOTICE, t);
  const out = mergePose(base, {});
  for (const key of Object.keys(k)) {
    // (NOTICE's keys are complete poses over NEUTRAL: a bone it never moved
    // keeps the stand's value)
    if (JSON.stringify(k[key]) === JSON.stringify(NEUTRAL[key])) continue;
    out[key] = k[key];
  }
  return out;
}

// over a fence 0.9 m ahead whose top rail is 1.75 m up: the right hand on
// the rail (planted: authored in the clip's start frame, rooted), the jump,
// the legs tucked and swung over to his left, the drop, the landing, the
// run again. Root motion carries him 2.6 m.
const VAULT_RM = (t) => [0.04 * S(Math.PI * Math.min(1, t / 0.7)), pw(t, [[0, 0], [0.16, 0.5], [0.34, 0.95], [0.52, 1.5], [0.68, 2.1], [0.8, 2.6]])];
const VAULT_K = chainKeys([
  [0.0, { ...runPose(0.25) }],
  // the last step in: the right hand reaches for the rail, the left on the hat
  [0.14, { hipsPos: [0.0, 0.86, 0.46], hips: [16, 0, 0], spine: [10, 0, 0], chest: [6, -6, 0], neck: [4, 0, 0], head: [-8, 0, 0],
    handTR: [-0.06, 1.74, 0.9], elbowPoleR: [-1, -0.3, -0.4], handR: [70, 0, 0],
    footL: [0.08, A, 0.55], footR: [-0.08, A + 0.18, 0.2], footRotL: [0, 4, 0], footRotR: [-30, 4, 0], kneeL: [0.1, 0, 1], kneeR: [-0.1, 0, 1] }],
  // up: the hips over the rail, the legs tucked and going over to his left
  [0.32, { hipsPos: [0.12, 1.52, 0.92], hips: [30, -35, 22], spine: [14, -8, 6], chest: [14, -10, 0], neck: [8, 0, 0], head: [-10, 10, 0],
    handTR: [-0.06, 1.74, 0.9], handR: [60, 0, 0], elbowPoleR: [-1, 0.2, -0.3],
    footL: [0.42, 1.28, 0.78], footR: [0.28, 1.22, 0.62], footRotL: [20, 30, 0], footRotR: [20, 30, 0], kneeL: [0.6, 0.6, 0.6], kneeR: [0.5, 0.6, 0.6] }],
  // over: the legs down the far side, the hand leaving the rail
  [0.5, { hipsPos: [0.12, 1.3, 1.36], hips: [10, -18, 10], spine: [8, -4, 2], chest: [6, -4, 0], head: [-6, 4, 0],
    handTR: [-0.1, 1.66, 1.05], handR: [30, 0, 0],
    footL: [0.18, 0.62, 1.62], footR: [0.02, 0.72, 1.5], footRotL: [10, 10, 0], footRotR: [10, 10, 0], kneeL: [0.2, 0.2, 1], kneeR: [0.1, 0.2, 1] }],
  // the landing: a crouch, the feet on the ground, the right arm out for balance
  [0.66, { hipsPos: [0.04, 0.72, 1.98], hips: [22, -6, 4], spine: [12, 0, 0], chest: [8, 0, 0], neck: [8, 0, 0], head: [-14, 0, 0],
    handTR: [-0.34, 1.02, 2.2], elbowPoleR: [-1, 0, -0.3], handR: [0, 0, -20],
    footL: [0.1, A, 2.18], footR: [-0.1, A + 0.02, 1.9], footRotL: [0, 4, 0], footRotR: [-10, 4, 0], kneeL: [0.1, 0, 1], kneeR: [-0.1, 0, 1] }],
  [0.8, { ...runPose(0.75), hipsPos: [0, WRUN.hipsY, 2.6 + WRUN.hipsZ] }],
]);
function vaultPose(t) {
  const p = samplePoseKeys(VAULT_K, t);
  // the left hand stays on the hat all the way over (the head's place moves
  // with the hips: the hand rides it)
  const hp = p.hipsPos;
  p.handTL = [0.07 + (hp[0] || 0), hp[1] + 0.85, hp[2] + 0.22];
  p.elbowPoleL = [1, 0.1, 0.35];
  p.handL = [-70, -10, 40];
  return p;
}
// (the pose is authored in the clip's start frame: the root's travel comes
// out of the hips, the feet and the hands, as castAnim's rooted() does)
function rootedV(t) {
  const p = vaultPose(t);
  const [x, z] = VAULT_RM(t);
  for (const k of ['hipsPos', 'footL', 'footR', 'handTL', 'handTR']) if (p[k]) p[k] = [p[k][0] - x, p[k][1], p[k][2] - z, ...p[k].slice(3)];
  return p;
}

// [C6] over a low thing at a run (a wall to the waist, a stack of crates):
// the right hand on its top at 0.95, the body swung over sideways on it, the
// legs tucked, down running. Root motion 2.3 m.
const LOW_RM = (t) => [0.03 * S(Math.PI * Math.min(1, t / 0.55)), pw(t, [[0, 0], [0.12, 0.55], [0.28, 1.1], [0.44, 1.7], [0.6, 2.3]])];
const LOW_K = chainKeys([
  [0.0, { ...runPose(0.25) }],
  [0.12, { hipsPos: [0.0, 0.88, 0.5], hips: [14, 0, 0], spine: [10, 0, 0], chest: [8, -6, 0], neck: [4, 0, 0], head: [-6, 0, 0],
    handTR: [-0.06, 0.98, 0.92], elbowPoleR: [-1, -0.3, -0.4], handR: [70, 0, 0],
    footL: [0.08, A, 0.62], footR: [-0.08, A + 0.14, 0.25], footRotR: [-25, 4, 0], kneeL: [0.1, 0, 1], kneeR: [-0.1, 0, 1] }],
  [0.28, { hipsPos: [0.1, 1.18, 1.02], hips: [24, -30, 18], spine: [12, -6, 6], chest: [12, -8, 0], head: [-8, 8, 0],
    handTR: [-0.06, 0.98, 0.92], handR: [60, 0, 0], elbowPoleR: [-1, 0.2, -0.3],
    footL: [0.38, 0.9, 0.9], footR: [0.26, 0.86, 0.74], footRotL: [20, 30, 0], footRotR: [20, 30, 0], kneeL: [0.6, 0.6, 0.6], kneeR: [0.5, 0.6, 0.6] }],
  [0.44, { hipsPos: [0.06, 0.86, 1.62], hips: [18, -8, 6], spine: [10, 0, 0], chest: [6, 0, 0], neck: [6, 0, 0], head: [-10, 0, 0],
    handTR: [-0.3, 0.98, 1.75], elbowPoleR: [-1, 0, -0.3], handR: [0, 0, -20],
    footL: [0.1, A, 1.86], footR: [-0.1, A + 0.06, 1.6], footRotR: [-10, 4, 0], kneeL: [0.1, 0, 1], kneeR: [-0.1, 0, 1] }],
  [0.6, { ...runPose(0.75), hipsPos: [0, WRUN.hipsY, 2.3 + WRUN.hipsZ] }],
]);
function lowPose(t) {
  const p = samplePoseKeys(LOW_K, t);
  const hp = p.hipsPos;
  p.handTL = [0.07 + (hp[0] || 0), hp[1] + 0.85, hp[2] + 0.22];
  p.elbowPoleL = [1, 0.1, 0.35];
  p.handL = [-70, -10, 40];
  const [x, z] = LOW_RM(t);
  for (const k of ['hipsPos', 'footL', 'footR', 'handTL', 'handTR']) if (p[k]) p[k] = [p[k][0] - x, p[k][1], p[k][2] - z, ...p[k].slice(3)];
  return p;
}

// [C6] under a thing at a run (a fence broken at its foot, a half-shut
// roller door, a tank's legs, a plank): down onto his hip on the wet, the
// legs ahead, the body back, the left hand on the bowler, the right out
// behind him on the ground; carried 3.4 m; up again running. Root motion.
const SLIDE_RM = (t) => [0, pw(t, [[0, 0], [0.12, 0.85], [0.3, 1.95], [0.55, 3.0], [0.72, 3.4]])];
const SLIDE_K = chainKeys([
  [0.0, { ...runPose(0.25) }],
  [0.12, { hipsPos: [0.0, 0.6, 0.95], hips: [-22, 0, 4], spine: [-8, 0, 0], chest: [-6, 0, 0], neck: [10, 0, 0], head: [12, 0, 0],
    handTR: [-0.3, 0.55, 0.7], elbowPoleR: [-1, 0, -0.3], handR: [0, 0, -40],
    footL: [0.1, A + 0.12, 1.7], footR: [-0.12, A + 0.04, 1.35], footRotL: [-30, 0, 0], footRotR: [-10, 0, 0], kneeL: [0.1, 1, 0.4], kneeR: [-0.1, 1, 0.4] }],
  [0.3, { hipsPos: [0.02, 0.3, 1.95], hips: [-38, 0, 8], spine: [-14, 0, 2], chest: [-8, 0, 0], neck: [16, 0, 0], head: [20, 0, 0],
    handTR: [-0.42, 0.1, 1.55], elbowPoleR: [-1, 0.3, -0.2], handR: [0, 0, -20],
    footL: [0.12, A + 0.04, 2.95], footR: [-0.14, A + 0.1, 2.6], footRotL: [-45, 0, 0], footRotR: [-25, 0, 0], kneeL: [0.1, 1, 0.3], kneeR: [-0.1, 1, 0.5] }],
  [0.55, { hipsPos: [0.02, 0.36, 3.0], hips: [-30, 0, 6], spine: [-10, 0, 2], chest: [-4, 0, 0], neck: [12, 0, 0], head: [14, 0, 0],
    handTR: [-0.38, 0.12, 2.75], elbowPoleR: [-1, 0.3, -0.2], handR: [0, 0, -20],
    footL: [0.12, A + 0.04, 3.85], footR: [-0.1, A, 3.3], footRotL: [-30, 0, 0], footRotR: [0, 0, 0], kneeL: [0.1, 1, 0.3], kneeR: [-0.1, 1, 0.8] }],
  [0.72, { ...runPose(0.75), hipsPos: [0, WRUN.hipsY, 3.4 + WRUN.hipsZ] }],
]);
function slidePose(t) {
  const p = samplePoseKeys(SLIDE_K, t);
  const hp = p.hipsPos;
  p.handTL = [0.07 + (hp[0] || 0), hp[1] + 0.85, hp[2] + 0.22 - Math.max(0, 0.95 - hp[1]) * 0.3];
  p.elbowPoleL = [1, 0.1, 0.35];
  p.handL = [-70, -10, 40];
  const [x, z] = SLIDE_RM(t);
  for (const k of ['hipsPos', 'footL', 'footR', 'handTL', 'handTR']) if (p[k]) p[k] = [p[k][0] - x, p[k][1], p[k][2] - z, ...p[k].slice(3)];
  return p;
}

// at the car's door (it is on his left): he comes to it, the left hand to
// the handle, pulls, ducks in
const CARIN = chainKeys([
  [0, { ...runPose(0) }],
  [0.3, { hipsPos: [0, 0.9, 0.1], hips: [6, 20, 0], chest: [4, 20, 0], head: [-4, 30, 0], handTL: [0.42, 1.0, 0.36], elbowPoleL: [1, -0.3, 0], footL: [0.18, A, 0.2], footR: [-0.1, A, -0.1] }],
  [0.6, { hipsPos: [0.1, 0.84, 0.0], hips: [14, 50, 0], spine: [16, 10, 0], chest: [10, 10, 0], head: [10, 20, 0], handTL: [0.6, 0.98, 0.0], footL: [0.3, A, 0.1] }],
  [1.0, { hipsPos: [0.3, 0.7, -0.1], hips: [30, 80, 0], spine: [30, 10, 0], chest: [20, 0, 0], neck: [20, 0, 0], head: [10, 10, 0], handTL: [0.5, 0.9, -0.2], footL: [0.45, 0.3, 0.1], footR: [0.1, A, -0.1] }],
]);

// What is laid on his clip's pose every step (the chase's afterPose, the
// study preset's): the coat's tails out behind him with his speed v (the
// coat's bone tipped back, a flutter on it), the body rolled into a turn
// (lean -1 .. 1), a look back over the shoulder (look: its time, 0 .. 1 s)
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1), _X = new THREE.Vector3(1, 0, 0);
//   pull: { t, side: 'R' | 'L' } an arm flung out to a crate stack and back
//   (0.7 s: out by 0.2, the yank, back to the run)
export function layOn(h, { v = 0, t = 0, lean = 0, look = null, pull = null } = {}) {
  const b = h.bones;
  const k = Math.min(1, v / 7);
  const flap = 0.09 * Math.sin(t * 11.3) + 0.05 * Math.sin(t * 17.9 + 1);
  const tip = (0.7 + flap) * k;
  _e.set(tip, 0, lean * 0.15 * k);
  b.coat.quaternion.multiply(_q.setFromEuler(_e));
  h.object.rotation.z = -lean * 0.2;
  if (look != null) {
    const w = sm(Math.min(1, look / 0.22)) * (1 - sm(Math.min(1, Math.max(0, (look - 0.62) / 0.3))));
    b.spine.quaternion.multiply(_q.setFromAxisAngle(_Y, 0.35 * w));
    b.chest.quaternion.multiply(_q.setFromAxisAngle(_Y, 0.45 * w));
    b.neck.quaternion.multiply(_q.setFromAxisAngle(_Y, 0.9 * w));
    b.head.quaternion.multiply(_q.setFromAxisAngle(_Y, 0.5 * w));
  }
  if (pull) {
    const w = sm(Math.min(1, pull.t / 0.18)) * (1 - sm(Math.min(1, Math.max(0, (pull.t - 0.3) / 0.4))));
    const sg = pull.side === 'R' ? -1 : 1;
    // (out to the side and back: the upper arm swung out, the chest turned to it)
    b['upperArm' + pull.side].quaternion.premultiply(_q.setFromAxisAngle(_Z, sg * 1.1 * w));
    b['upperArm' + pull.side].quaternion.premultiply(_q.setFromAxisAngle(_X, 0.5 * w));
    b.chest.quaternion.multiply(_q.setFromAxisAngle(_Y, sg * 0.35 * w));
    b.head.quaternion.multiply(_q.setFromAxisAngle(_Y, sg * 0.4 * w));
  }
}

const COSTUME = {
  body: {
    // narrow: 0.46 across the coat's shoulders, a long back
    torso: [
      [0.95, 0.176, 0.126, 0.13, 0.0, 2.3],
      [1.03, 0.164, 0.118, 0.12, 0.004, 2.3],
      [1.12, 0.166, 0.124, 0.118, 0.008, 2.35],
      [1.22, 0.176, 0.13, 0.12, 0.01, 2.45],
      [1.31, 0.188, 0.13, 0.124, 0.008, 2.7],
      [1.37, 0.195, 0.124, 0.124, 0.0, 3.0],
      [1.41, 0.193, 0.112, 0.114, -0.008, 3.1],
      [1.44, 0.176, 0.1, 0.104, -0.013, 2.9],
      [1.465, 0.142, 0.088, 0.094, -0.017, 2.6],
      [1.484, 0.095, 0.077, 0.083, -0.019, 2.3],
      [1.496, 0.058, 0.062, 0.068, -0.02, 2.2],
    ],
    shoulderX: 0.152, shoulderY: 1.385, upper: 0.31, fore: 0.28, hipX: 0.088,
    neckR: 0.045, neckY: 1.478, headS: 0.95, jaw: 0.22,
  },
  cover: { kind: 'bowler', hatDY: 0.13, hatDZ: 0.004, pitch: 0.07, s: 0.99, brim: 0.145 },
  garments: [
    // the raincoat, belted: pale (it prints as a grey shape in the dark
    // alleys: the runner the eye follows), the belt a dark band
    { kind: 'torso', shade: (th, y) => (Math.abs(y - 1.03) < 0.022 ? 0.008 : 0.3) },
    // to mid-shin, open below the belt, its back hung from the coat's own
    // spring more than from the legs (back 0.18): the tails stream out
    { kind: 'skirt', y0: 1.03, hem: 0.3, split: 0.5, flare: [1.3, 1.36], back: 0.18, folds: 1.0, grow: 0.012, shade: 'coat', hemWave: 0.016 },
    { kind: 'lapels', near: true, top: 1.482, low: 1.16, shade: 'lapel' },
    { kind: 'collar', style: 'stand', h: 0.062, hFront: 0.04, open: 0.5, gap: 0.03, shade: 'collar' },
    { kind: 'sleeves', r: 0.068, cuff: 0.06 },
    { kind: 'legs', r: 0.86 },
    { kind: 'shoes' },
    { kind: 'hands', s: 0.95 },
  ],
  skin: { coat: 0.3, collar: 0.26, lapel: 0.24, hand: 0.022, skin: 0.03, cover: 0.005, trousers: 0.007, shoes: 0.004 },
  collider: 0.28,
};

export default {
  kind: 'watcher', h: 1.9, name: 'watcher',
  costume: COSTUME,
  clips: {
    watcher_stand: { duration: 5, loop: true, def: () => ({ pose: standPose, armSpace: 'root' }) },
    watcher_notice: { duration: 0.95, hold: true, marks: { drop: 0.35 }, def: () => ({ pose: noticePose, armSpace: 'root' }) },
    watcher_run: { duration: WRUN.T, loop: true, def: () => ({ pose: (t) => runPose(t / WRUN.T) }) },
    watcher_vault: { duration: 0.8, marks: { plant: 0.14, over: 0.34, land: 0.66 }, def: () => ({ pose: rootedV, rootMotion: VAULT_RM, fps: 60 }) },
    // [C6] over a waist-high thing, a hand on its top (root motion 2.3 m)
    watcher_lowvault: { duration: 0.6, marks: { plant: 0.12, over: 0.28, land: 0.44 }, def: () => ({ pose: lowPose, rootMotion: LOW_RM, fps: 60 }) },
    // [C6] under a thing on his hip (root motion 3.4 m)
    watcher_slide: { duration: 0.72, marks: { down: 0.12, up: 0.55 }, def: () => ({ pose: slidePose, rootMotion: SLIDE_RM, fps: 60 }) },
    watcher_carIn: { duration: 1.0, hold: true, marks: { handle: 0.3, in: 0.9 }, def: () => ({ pose: (t) => samplePoseKeys(CARIN, t), armSpace: 'root' }) },
  },
  idle: 'watcher_stand',
};
