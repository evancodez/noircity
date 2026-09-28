import * as THREE from 'three';

// The Hood's skeleton and a pose solver shared by the model (Hood.js) and the
// procedural clips (HoodAnim.js).
//
// Bind pose, model space, metres: feet on y = 0, facing +Z, the character's
// LEFT is +X. Every bone has an identity rotation in the bind pose (arms and
// legs hang straight down), so a clip's quaternion is simply "rotation away
// from hanging straight". Proportions: adult male, 1.82 m with the hat, eye
// ~1.66, shoulder joints 0.38 apart (0.5+ across the padded coat), hip
// sockets 0.19 apart, upper arm 0.30, forearm 0.27, thigh 0.44, shin 0.42.
export const L_THIGH = 0.44;
export const L_SHIN = 0.42;
export const L_UPPER = 0.30;
export const L_FORE = 0.27;
export const HIP_Y = 0.97;          // hips bone (pelvis centre)
export const ANKLE_Y = 0.07;        // ankle above the sole when standing

// [name, parent, x, y, z]  (model-space bind positions)
export const JOINTS = [
  ['root', null, 0, 0, 0],
  ['hips', 'root', 0, HIP_Y, 0],
  ['spine', 'hips', 0, 1.08, -0.005],
  ['chest', 'spine', 0, 1.28, -0.012],
  ['neck', 'chest', 0, 1.485, -0.02],
  ['head', 'neck', 0, 1.575, -0.008],
  ['hat', 'head', 0, 1.71, -0.008],
  ['shoulderL', 'chest', 0.045, 1.42, -0.018],
  ['upperArmL', 'shoulderL', 0.19, 1.425, -0.018],
  ['forearmL', 'upperArmL', 0.19, 1.425 - L_UPPER, -0.018],
  ['handL', 'forearmL', 0.19, 1.425 - L_UPPER - L_FORE, -0.018],
  ['shoulderR', 'chest', -0.045, 1.42, -0.018],
  ['upperArmR', 'shoulderR', -0.19, 1.425, -0.018],
  ['forearmR', 'upperArmR', -0.19, 1.425 - L_UPPER, -0.018],
  ['handR', 'forearmR', -0.19, 1.425 - L_UPPER - L_FORE, -0.018],
  ['thighL', 'hips', 0.095, 0.93, 0],
  ['shinL', 'thighL', 0.095, 0.93 - L_THIGH, 0],
  ['footL', 'shinL', 0.095, ANKLE_Y, 0],
  ['thighR', 'hips', -0.095, 0.93, 0],
  ['shinR', 'thighR', -0.095, 0.93 - L_THIGH, 0],
  ['footR', 'shinR', -0.095, ANKLE_Y, 0],
  // pivot of the coat-hem spring (secondary motion, driven in Hood.update)
  ['coat', 'hips', 0, 1.0, 0],
  // the coat skirt's two halves: at the hip sockets, they copy the thighs
  // while he stands and walks, and lie down along the street (flattened)
  // once he is on the ground (Hood.driveSkirt)
  ['skirtL', 'hips', 0.095, 0.93, 0],
  ['skirtR', 'hips', -0.095, 0.93, 0],
];

export const JOINT_INDEX = Object.fromEntries(JOINTS.map((j, i) => [j[0], i]));
export const BIND = Object.fromEntries(JOINTS.map((j) => [j[0], new THREE.Vector3(j[2], j[3], j[4])]));
export const PARENT = Object.fromEntries(JOINTS.map((j) => [j[0], j[1]]));
// local offset of each joint from its parent (bind rotations are identity)
export const OFFSET = Object.fromEntries(JOINTS.map((j) => [j[0], j[1] ? BIND[j[0]].clone().sub(BIND[j[1]]) : BIND[j[0]].clone()]));

// which bones each animation layer owns
export const LOWER_BONES = ['root', 'hips', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
export const UPPER_BONES = ['spine', 'chest', 'neck', 'head', 'shoulderL', 'upperArmL', 'forearmL', 'handL', 'shoulderR', 'upperArmR', 'forearmR', 'handR'];

const D2R = Math.PI / 180;
const _e = new THREE.Euler();
// [pitch, yaw, roll] in degrees, applied yaw -> pitch -> roll ('YXZ').
//   pitch + : the bone's top tips forward (+Z)   (a bow; a limb swings back)
//   yaw   + : the front turns toward +X          (the character turns LEFT)
//   roll  + : the top leans toward -X            (leans to the character's RIGHT)
export function eulerQ(a, out = new THREE.Quaternion()) {
  if (!a) return out.identity();
  _e.set(a[0] * D2R, a[1] * D2R, a[2] * D2R, 'YXZ');
  return out.setFromEuler(_e);
}

const DOWN = new THREE.Vector3(0, -1, 0);
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const _m = new THREE.Matrix4();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

// Rotation taking the hanging bone (-Y) onto dir, then twisting it about its
// own axis. Near "straight up" the shortest arc is ill-defined; swing up
// through the front instead so arms thrown over the head stay continuous.
function limbQ(dir, twistDeg, out) {
  const d = _v1.copy(dir).normalize();
  if (d.dot(DOWN) < -0.9995) out.setFromAxisAngle(X, -Math.PI);
  else out.setFromUnitVectors(DOWN, d);
  if (twistDeg) out.multiply(_q2.setFromAxisAngle(Y, twistDeg * D2R));
  return out;
}

// Rotation whose columns are the basis (x, y, z).
function basisQ(x, y, z, out) {
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

// Two-bone IK in root space. s: upper joint, t: end target, pole: direction
// the middle joint should point (knee forward / elbow back). bend: +1 when
// the lower bone folds toward the upper bone's -Z (a knee), -1 for +Z (an
// elbow). Returns the root-space rotations of the two bones.
export function twoBone(s, t, pole, l1, l2, bend, qUpper, qLower) {
  const d = _v2.subVectors(t, s);
  let len = d.length();
  const dn = d.clone().divideScalar(Math.max(len, 1e-6));
  len = Math.min(Math.max(len, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-4);
  const cosA = (l1 * l1 + len * len - l2 * l2) / (2 * l1 * len);
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  // the knee lies in the plane of d and the pole
  const perp = _v3.copy(pole).addScaledVector(dn, -pole.dot(dn));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(dn, -dn.z);
  perp.normalize();
  const knee = new THREE.Vector3().copy(s).addScaledVector(dn, Math.cos(a) * l1).addScaledVector(perp, Math.sin(a) * l1);
  // upper bone frame: +Y up the bone (knee -> hip), Z toward the pole for a
  // knee (away from it for an elbow), X = Y x Z is the hinge axis
  const yU = new THREE.Vector3().subVectors(s, knee).normalize();
  const zU = perp.clone().multiplyScalar(bend).addScaledVector(yU, -perp.dot(yU) * bend).normalize();
  const xU = new THREE.Vector3().crossVectors(yU, zU).normalize();
  zU.crossVectors(xU, yU).normalize();
  basisQ(xU, yU, zU, qUpper);
  // end point actually reached (target clamped to the chain's reach)
  const end = _v4.copy(s).addScaledVector(dn, len);
  const yL = new THREE.Vector3().subVectors(knee, end).normalize();
  const zL = new THREE.Vector3().crossVectors(xU, yL).normalize();
  basisQ(xU, yL, zL, qLower);
  return knee;
}

// Neutral standing pose parameters. Every clip key is a (partial) override
// of this; all entries are plain number arrays so keys can be interpolated.
//   hipsPos           model-space position of the hips bone
//   hips, spine...    [pitch, yaw, roll] local Euler, degrees
//   headRoot/headLevel  root-space head orientation and how strongly the
//                     head holds it against the torso (keeps the hat level)
//   armL/R            [dx, dy, dz, twist]: upper-arm direction (in `armSpace`)
//   elbowL/R          forward bend, degrees
//   handTL/R          optional wrist target (root space) -> arm IK
//   elbowPoleL/R      elbow direction for the arm IK
//   footL/R           ankle target, root space (leg IK)
//   footRotL/R        [pitch(toe up +), yaw(toe out = away from the body), roll]
//   kneeL/R           knee pole direction, root space
//   rootYaw           [deg] turn of the root bone (deathSpin)
export const NEUTRAL = {
  rootYaw: [0],
  hipsPos: [0, 0.955, 0],
  hips: [0, 0, 0],
  spine: [3, 0, 0],
  chest: [-2, 0, 0],
  neck: [8, 0, 0],
  head: [-5, 0, 0],
  headRoot: [2, 0, 0],
  headLevel: [0],
  shoulderL: [0, 0, 0],
  shoulderR: [0, 0, 0],
  armL: [0.115, -1, 0.07, 0],
  armR: [-0.115, -1, 0.11, 0],
  elbowL: [14],
  elbowR: [24],
  handL: [0, 0, 4],
  handR: [-40, 0, -4],
  footL: [0.115, ANKLE_Y, 0.02],
  footR: [-0.115, ANKLE_Y, 0.0],
  footRotL: [0, 8, 0],
  footRotR: [0, 8, 0],
  kneeL: [0.12, 0, 1],
  kneeR: [-0.12, 0, 1],
};

// Solve a pose to local bone rotations (+ the hips position).
// opts.armSpace: 'chest' (arm directions relative to the shoulder's parent)
// or 'root'. P.handTL/handTR switch that arm to IK.
export function solvePose(P, opts = {}) {
  const armSpace = opts.armSpace || 'chest';
  const out = { hipsPos: new THREE.Vector3(...P.hipsPos), q: {} };
  const rq = {};   // root-space rotations
  const rp = {};   // root-space joint positions
  const local = (name, q) => { out.q[name] = q.clone(); };
  const fk = (name, lq) => {
    const p = PARENT[name];
    rq[name] = rq[p].clone().multiply(lq);
    rp[name] = rp[p].clone().add(OFFSET[name].clone().applyQuaternion(rq[p]));
    local(name, lq);
  };
  // root: a turn about Y only (the spin death); IK targets live in its space
  const rootQ = new THREE.Quaternion().setFromAxisAngle(Y, (P.rootYaw ? P.rootYaw[0] : 0) * D2R);
  out.q.root = rootQ.clone();
  rq.root = new THREE.Quaternion();
  rp.root = new THREE.Vector3();
  rq.hips = eulerQ(P.hips);
  rp.hips = out.hipsPos.clone();
  local('hips', rq.hips);
  fk('spine', eulerQ(P.spine));
  fk('chest', eulerQ(P.chest));
  fk('neck', eulerQ(P.neck));
  // head: blend its FK orientation toward a root-space target
  {
    const lq = eulerQ(P.head);
    const fkq = rq.neck.clone().multiply(lq);
    const w = P.headLevel ? P.headLevel[0] : 0;
    const want = fkq.clone().slerp(eulerQ(P.headRoot), Math.min(1, Math.max(0, w)));
    const lh = rq.neck.clone().invert().multiply(want);
    fk('head', lh);
  }
  for (const s of ['L', 'R']) {
    fk('shoulder' + s, eulerQ(P['shoulder' + s]));
    const sh = 'shoulder' + s, ua = 'upperArm' + s, fa = 'forearm' + s, hd = 'hand' + s;
    const tgt = P['handT' + s];
    if (tgt) {
      const S = rp[sh].clone().add(OFFSET[ua].clone().applyQuaternion(rq[sh]));
      const pole = new THREE.Vector3(...(P['elbowPole' + s] || [s === 'L' ? 1 : -1, 0, -1]));
      const qU = new THREE.Quaternion(), qL = new THREE.Quaternion();
      twoBone(S, new THREE.Vector3(...tgt), pole, L_UPPER, L_FORE, -1, qU, qL);
      fk(ua, rq[sh].clone().invert().multiply(qU));
      fk(fa, rq[ua].clone().invert().multiply(qL));
    } else {
      const a = P['arm' + s];
      const dir = new THREE.Vector3(a[0], a[1], a[2]);
      const qa = new THREE.Quaternion();
      if (armSpace === 'root') {
        limbQ(dir, a[3] || 0, qa);
        fk(ua, rq[sh].clone().invert().multiply(qa));
      } else {
        fk(ua, limbQ(dir, a[3] || 0, qa));
      }
      fk(fa, new THREE.Quaternion().setFromAxisAngle(X, -P['elbow' + s][0] * D2R));
    }
    fk(hd, eulerQ(P['hand' + s]));
  }
  for (const s of ['L', 'R']) {
    const th = 'thigh' + s, sn = 'shin' + s, ft = 'foot' + s;
    const S = rp.hips.clone().add(OFFSET[th].clone().applyQuaternion(rq.hips));
    const qU = new THREE.Quaternion(), qL = new THREE.Quaternion();
    twoBone(S, new THREE.Vector3(...P['foot' + s]), new THREE.Vector3(...P['knee' + s]), L_THIGH, L_SHIN, 1, qU, qL);
    rq[th] = qU; out.q[th] = rq.hips.clone().invert().multiply(qU);
    rq[sn] = qL; out.q[sn] = qU.clone().invert().multiply(qL);
    // foot: root-space orientation; yaw is "toe out" (mirrored for R)
    const fr = P['footRot' + s];
    const yaw = s === 'L' ? fr[1] : -fr[1];
    const roll = s === 'L' ? fr[2] : -fr[2];
    _e.set(-fr[0] * D2R, yaw * D2R, roll * D2R, 'YXZ');
    const qf = new THREE.Quaternion().setFromEuler(_e);
    out.q[ft] = qL.clone().invert().multiply(qf);
  }
  return out;
}

// Catmull-Rom interpolation of pose keys: keys = [{ t, pose }], all poses
// fully specified (merged over NEUTRAL). Returns the pose at time t.
export function samplePoseKeys(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const k1 = keys[i], k2 = keys[Math.min(i + 1, keys.length - 1)];
  const k0 = keys[Math.max(i - 1, 0)], k3 = keys[Math.min(i + 2, keys.length - 1)];
  const span = Math.max(1e-6, k2.t - k1.t);
  const u = Math.min(1, Math.max(0, (t - k1.t) / span));
  const out = {};
  for (const name of Object.keys(k1.pose)) {
    const a = k1.pose[name], b = k2.pose[name];
    if (a == null || b == null) { out[name] = a ?? b; continue; }
    const p0 = k0.pose[name] ?? a, p3 = k3.pose[name] ?? b;
    // tangents scaled for non-uniform key spacing (cardinal spline, tension 0)
    const t0 = Math.max(1e-6, k1.t - k0.t), t3 = Math.max(1e-6, k3.t - k2.t);
    const v = new Array(a.length);
    for (let c = 0; c < a.length; c++) {
      const m1 = k0 === k1 ? 0 : ((b[c] - p0[c]) / (span + t0)) * span;
      const m2 = k3 === k2 ? 0 : ((p3[c] - a[c]) / (t3 + span)) * span;
      const u2 = u * u, u3 = u2 * u;
      v[c] = (2 * u3 - 3 * u2 + 1) * a[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * b[c] + (u3 - u2) * m2;
    }
    out[name] = v;
  }
  return out;
}

export function mergePose(base, over) {
  const o = {};
  for (const k of Object.keys(base)) o[k] = base[k] ? base[k].slice() : base[k];
  for (const k of Object.keys(over || {})) o[k] = over[k] ? over[k].slice() : over[k];
  return o;
}
