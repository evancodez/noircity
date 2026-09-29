import * as THREE from 'three';
import { twoBone } from '../../enemies/HoodRig.js';

// The cast's hands on things (Wave A round 2, owner 2): object first. A
// scene authors where a THING is (a bottle leaving the shelf, tipping over a
// glass); every step, after the figure's clip has posed it (Hood.afterPose),
// the arm is solved so the hand lies on the thing's grip:
//   gripHand(fig, side, objWorld, { r, h, dir, thumb, gap }) -> { wrist, q }
//       the hand bone's world place and turn that puts the palm on the side
//       of a round thing (a bottle's body, a glass) of radius r at height h
//       up its axis, the thumb along the axis (thumb +1: toward its top), the
//       wrist toward `dir` (world; made square to the axis)
//   armTo(fig, side, wrist, q, pole, w) -> the wrist's miss (m)
//       two-bone IK of the upper arm and forearm onto the wrist (the elbow
//       toward `pole`), the hand turned to q; w blends from the clip's own
//       arm (0) to the solved one (1)
//   palmTo(fig, side, point, normal, fwd) -> { wrist, q }   a flat hand (on a
//       counter, on a cork): the palm's centre at point, facing -normal,
//       the fingers toward fwd
// The figures are the Hood's skeleton: a hand hangs with its fingers down
// (-y), its palm toward the body's middle (the right hand's +x, the left
// hand's -x), its thumb forward (+z).
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();

// where the palm's middle is in the hand bone's frame (model units: the
// costume's hands; the open hand's palm centre, tailor.buildOpenHand)
function palmLocal(fig, side) {
  const g = fig.costume && fig.costume.garments ? fig.costume.garments.find((x) => x.kind === 'hands') : null;
  const k = g && g.s ? g.s : 1;
  return new THREE.Vector3(0, -0.05 * k, 0.004);
}

// the world scale of the figure (model units -> metres)
const figScale = (fig) => fig.object.getWorldScale(_s).x;

export function gripHand(fig, side, M, { r = 0.04, h = 0.1, dir, thumb = 1, gap = 0.005, roll = 0 } = {}) {
  const o = new THREE.Vector3().setFromMatrixPosition(M);
  const ax = new THREE.Vector3(0, 1, 0).transformDirection(M);
  const axisPt = o.clone().addScaledVector(ax, h);
  Z.copy(ax).multiplyScalar(thumb);
  // the wrist's way, square to the axis (a turn `roll` about it)
  Y.copy(dir).addScaledVector(Z, -dir.dot(Z));
  if (Y.lengthSq() < 1e-8) Y.set(0, 0, 1).addScaledVector(Z, -Z.z);
  Y.normalize();
  if (roll) Y.applyAxisAngle(Z, roll);
  X.crossVectors(Y, Z).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z));
  // the palm faces the axis: the right hand's +x, the left hand's -x
  const into = side === 'R' ? X : _v.copy(X).negate();
  const palm = axisPt.addScaledVector(into, -(r + gap));
  const wrist = palm.sub(palmLocal(fig, side).multiplyScalar(figScale(fig)).applyQuaternion(q));
  return { wrist, q };
}

// a flat hand: palm on a surface (normal: out of the surface), fingers fwd
export function palmTo(fig, side, point, normal, fwd) {
  const n = new THREE.Vector3().copy(normal).normalize();
  // fingers are the hand's -y; the palm faces the right hand's +x
  Y.copy(fwd).addScaledVector(n, -fwd.dot(n)).normalize().negate();
  X.copy(n).multiplyScalar(side === 'R' ? -1 : 1);
  Z.crossVectors(X, Y).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z));
  const wrist = point.clone().addScaledVector(n, 0.012).sub(palmLocal(fig, side).multiplyScalar(figScale(fig)).applyQuaternion(q));
  return { wrist, q };
}

export function armTo(fig, side, wrist, q, pole, w = 1) {
  if (w <= 0) return 0;
  const b = fig.bones;
  const sh = b['shoulder' + side], ua = b['upperArm' + side], fa = b['forearm' + side], hd = b['hand' + side];
  fig.object.updateMatrixWorld(true);
  const S = new THREE.Vector3().setFromMatrixPosition(ua.matrixWorld);
  const E0 = new THREE.Vector3().setFromMatrixPosition(fa.matrixWorld);
  const W0 = new THREE.Vector3().setFromMatrixPosition(hd.matrixWorld);
  const l1 = S.distanceTo(E0), l2 = E0.distanceTo(W0);
  const qh0 = hd.getWorldQuaternion(new THREE.Quaternion());
  const wT = W0.clone().lerp(wrist, w);
  const qT = qh0.slerp(q, w);
  const qU = new THREE.Quaternion(), qL = new THREE.Quaternion();
  // (the elbow toward the pole; the reach clamped to the arm's length)
  twoBone(S, wT, pole, l1, l2, -1, qU, qL);
  const qSh = sh.getWorldQuaternion(_q);
  ua.quaternion.copy(qSh).invert().multiply(qU);
  fa.quaternion.copy(qU).invert().multiply(qL);
  hd.quaternion.copy(qL).invert().multiply(qT);
  ua.updateMatrixWorld(true);
  return hd.getWorldPosition(_v).distanceTo(wT);
}

// a world matrix for a thing: its base at p, turned by q
export const place = (p, q) => new THREE.Matrix4().compose(p, q, _s.set(1, 1, 1));
// set a thing (a child of some group) to a world matrix
export function setWorld(obj, M) {
  const par = obj.parent;
  if (par) { par.updateMatrixWorld(true); _m.copy(par.matrixWorld).invert().multiply(M); } else _m.copy(M);
  _m.decompose(obj.position, obj.quaternion, _s);
  obj.scale.set(1, 1, 1);
  obj.updateMatrixWorld(true);
}
void _q2;
