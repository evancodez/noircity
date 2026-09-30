import * as THREE from 'three';
import { palm } from '../handPoses.js';

// The hands in the chase (lane B4, scene 6): bare hands in the coat's
// sleeves, the white cuff. One set, 'run', whose rest poses are live: they
// read RUNHANDS, which the run and escape modes (src/player/modes/) write
// every step before the hands pose:
//   RUNHANDS.mode    'pump'     the arms pumping, a fist rising into each
//                               bottom corner in turn with the stride
//                    'plant'    both palms on a rail (a fence's top, the
//                               ladder's sides): world points, so a hand
//                               stays where it was put while the eye moves
//                    'rail'     one hand on a stair's handrail, the other low
//                    'catch'    thrown forward and down (a stumble)
//   RUNHANDS.phase   the stride (the controller's bob phase: a step each PI)
//   RUNHANDS.k       how far the pump comes up (0 at rest, 1 flat out)
//   RUNHANDS.plantR / plantL   world points for 'plant' (and 'rail': plantR or
//                    plantL, the rail's side), with RUNHANDS.planted 0..1
//   RUNHANDS.cam     the camera (world -> the eye's frame)
// A change of mode blends over RUNHANDS.blend (the modes ease it).
export const RUNHANDS = {
  mode: 'pump', prev: 'pump', w: 1, phase: 0, k: 0, cam: null,
  plantR: new THREE.Vector3(), plantL: new THREE.Vector3(), railSide: 'R', lift: 0,
  set(mode) { if (mode === this.mode) return; this.prev = this.mode; this.mode = mode; this.w = 0; },
  step(dt, rate = 9) { this.w = Math.min(1, this.w + dt * rate); },
};

const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
// a running hand: loosely closed, the thumb along the index
const RUNF = { i: [1.35, 1.65, 1.1, -0.05], m: [1.42, 1.7, 1.1, 0], r: [1.46, 1.72, 1.05, 0.04], l: [1.5, 1.7, 1.0, 0.1], t: [0.4, 0.2, 0.8, 0.6, 0.7] };
// flat on a rail: the fingers over its far side
const PLANTF = { i: C(0.35, 0.5, 0.25, -0.05), m: C(0.4, 0.55, 0.25), r: C(0.45, 0.55, 0.25, 0.04), l: C(0.5, 0.55, 0.25, 0.08), t: [0.3, 0.1, 0.25, 0.2, 0.15] };
// wide open, catching
const OPENF = { i: C(0.12, 0.15, 0.08, -0.08), m: C(0.14, 0.18, 0.1), r: C(0.18, 0.2, 0.1, 0.06), l: C(0.22, 0.24, 0.12, 0.12), t: [0.1, -0.1, 0.1, 0.1, 0.1] };

const sm = (x) => x * x * (3 - 2 * x);
const L3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const lerpF = (A, B, k) => { const o = {}; for (const n of ['i', 'm', 'r', 'l', 't']) o[n] = A[n].map((v, j) => v + (B[n][j] - v) * k); return o; };
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();

// the pump, a right hand (the left is its mirror, half a stride behind):
// u 0 down by the hip (out of the frame), 1 up at the bottom corner
function pumpR(u, k) {
  const up = { p: [0.25, -0.235, -0.38], f: [-0.18, 0.74, -0.64], b: [0.52, 0.46, 0.72], e: [0.31, -0.5, -0.06] };
  const dn = { p: [0.25, -0.62, 0.02], f: [-0.1, 0.4, -0.9], b: [0.9, 0.2, 0.3], e: [0.28, -0.6, 0.18] };
  const kk = sm(Math.min(1, Math.max(0, u))) * k;
  return { frame: 'cam', p: L3(dn.p, up.p, kk), f: L3(dn.f, up.f, kk), b: L3(dn.b, up.b, kk), e: L3(dn.e, up.e, kk), F: RUNF };
}
// a world point into the eye's frame
function toCam(v) {
  const cam = RUNHANDS.cam;
  if (!cam) return [0, -0.3, -0.4];
  cam.updateMatrixWorld();
  _v.copy(v).applyMatrix4(_m.copy(cam.matrixWorld).invert());
  return [_v.x, _v.y, _v.z];
}
// a palm flat on a rail at world point w (the fingers ahead, over it)
function plantAt(w, side) {
  const at = toCam(w);
  const cam = RUNHANDS.cam;
  // (down and ahead in the world, in the eye's frame)
  const down = cam ? _v.set(0, -1, 0).transformDirection(_m.copy(cam.matrixWorld).invert()).toArray() : [0, -1, 0];
  const cf = cam ? new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion) : new THREE.Vector3(0, 0, -1);
  cf.y = 0; if (cf.lengthSq() < 1e-6) cf.set(0, 0, -1); cf.normalize();
  const ahead = cam ? cf.transformDirection(_m.copy(cam.matrixWorld).invert()).toArray() : [0, 0, -1];
  const P = palm('cam', at, down, ahead, PLANTF, side === 'R' ? [at[0] + 0.14, at[1] - 0.3, at[2] + 0.28] : [at[0] - 0.14, at[1] - 0.3, at[2] + 0.28]);
  return P;
}
const mirrorP = (P) => ({ ...P, p: [-P.p[0], P.p[1], P.p[2]], f: [-P.f[0], P.f[1], P.f[2]], b: [-P.b[0], P.b[1], P.b[2]], e: P.e ? [-P.e[0], P.e[1], P.e[2]] : P.e });

function poseOf(mode, side) {
  const R = RUNHANDS;
  if (mode === 'pump') {
    const s = side === 'R' ? 0 : Math.PI;
    const u = 0.5 + 0.5 * Math.sin(R.phase + s);
    const P = pumpR(u, R.k);
    return side === 'R' ? P : mirrorP(P);
  }
  if (mode === 'plant') {
    const P = plantAt(side === 'R' ? R.plantR : R.plantL, side);
    if (R.lift > 0) {
      // (let go: the hand comes off the rail and back into the pump's low)
      const Q = side === 'R' ? pumpR(0.2, 1) : mirrorP(pumpR(0.2, 1));
      return blend(P, Q, R.lift);
    }
    return P;
  }
  if (mode === 'rail') {
    if (side === R.railSide) return plantAt(side === 'R' ? R.plantR : R.plantL, side);
    const P = pumpR(0.15, 0.6);
    return side === 'R' ? P : mirrorP(P);
  }
  if (mode === 'catch') {
    const P = { frame: 'cam', p: [0.16, -0.24, -0.42], f: [-0.2, -0.3, -0.93], b: [0.3, 0.9, -0.2], e: [0.22, -0.45, -0.1], F: OPENF };
    return side === 'R' ? P : mirrorP(P);
  }
  return side === 'R' ? pumpR(0, 0) : mirrorP(pumpR(0, 0));
}
function blend(A, B, k) {
  const n = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  return { frame: 'cam', p: L3(A.p, B.p, k), f: n(L3(A.f, B.f, k)), b: n(L3(A.b, B.b, k)), e: L3(A.e || B.e, B.e || A.e, k), F: lerpF(A.F, B.F, k) };
}
function live(side) {
  const R = RUNHANDS;
  const cur = poseOf(R.mode, side);
  if (R.w >= 1 || R.prev === R.mode) return cur;
  return blend(poseOf(R.prev, side), cur, sm(R.w));
}
// (a pose whose parts are read live: Hands.resolve reads frame, p, f, b, e, F)
const livePose = (side) => ({
  frame: 'cam',
  get p() { this._c = live(side); return this._c.p; },
  get f() { return (this._c || live(side)).f; },
  get b() { return (this._c || live(side)).b; },
  get e() { return (this._c || live(side)).e; },
  get F() { return (this._c || live(side)).F; },
});

export const POSES = { runLiveR: livePose('R'), runLiveL: livePose('L') };
export const SETS = {
  run: { skin: 'bare', sleeve: 'coat', cuff: true, R: 'runLiveR', L: 'runLiveL', brush: 'R' },
};
