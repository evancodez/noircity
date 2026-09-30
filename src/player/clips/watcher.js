import * as THREE from 'three';
import { palm, wrap } from '../handPoses.js';

// The hands at room 304's street window (lane B4, scene 6): two fingers
// part the blind's slats. Object first: the pose is read live from where
// the pressed slat's near edge is (SLAT.blind.fingerAt, world), so the
// fingertips stay on it while the slat goes down and the eye leans in.
//   SLAT.blind   the blind (scenes/watcher/blind.js); SLAT.cam the camera
//   partSlats    the right hand up from below, the index and middle fingers
//                out, their tips on the slat (0.3 s), held there
//   releaseSlats the hand drops away (the slat springs back)
export const SLAT = { blind: null, cam: null };

const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
// two fingers out and a little bent at the tips, pressing; the other two
// and the thumb folded in
const TWO = { i: C(0.1, 0.22, 0.34, -0.05), m: C(0.12, 0.24, 0.34, 0.03), r: C(1.35, 1.65, 0.9, 0.05), l: C(1.4, 1.62, 0.9, 0.1), t: [0.75, 0.35, 0.65, 0.5, 0.45] };
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();

function slatPose() {
  const B = SLAT.blind, cam = SLAT.cam;
  if (!B || !cam) return { frame: 'cam', p: [0.12, -0.3, -0.3], f: [-0.2, 0.3, -0.9], b: [0.3, 0.9, 0.2], F: TWO };
  cam.updateMatrixWorld();
  const inv = _m.copy(cam.matrixWorld).invert();
  const tip = B.fingerAt(_v).applyMatrix4(inv).toArray();
  // the fingers come in from the lower right, pointing ahead, up and in
  const f = new THREE.Vector3(-0.55, 0.06, -0.83).normalize().toArray();
  const n = new THREE.Vector3(0.05, -0.98, -0.2).normalize().toArray();
  // (the palm's middle a finger's length and the knuckles back from the tips)
  const at = [tip[0] - f[0] * 0.13 + 0.004, tip[1] - f[1] * 0.13 + 0.014, tip[2] - f[2] * 0.13];
  return palm('cam', at, n, f, TWO, [at[0] + 0.3, at[1] - 0.22, at[2] + 0.12]);
}
const live = () => {
  const o = { frame: 'cam' };
  Object.defineProperties(o, {
    p: { get() { this._c = slatPose(); return this._c.p; } },
    f: { get() { return (this._c || slatPose()).f; } },
    b: { get() { return (this._c || slatPose()).b; } },
    e: { get() { return (this._c || slatPose()).e; } },
    F: { get() { return (this._c || slatPose()).F; } },
  });
  return o;
};

// my car's door: the right hand closes over its handle (DOOR.at, world: the
// middle of a chrome bar along the car's side, DOOR.out the side's outward
// normal - the stage's cars put the bar there): the palm on the bar's top a
// little back from it toward me, the fingers over it and down round its far
// side, the thumb along it
export const DOOR = { at: null, out: null };
const OVER = wrap(0.011, { k: 1.05, thumb: [0.45, 0.35, 0.25, 0.3, 0.3] });
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
function doorPose() {
  const cam = SLAT.cam;
  if (!DOOR.at || !cam) return { frame: 'cam', p: [0.15, -0.3, -0.35], f: [-0.2, 0.2, -0.95], b: [0.9, 0.3, 0.1], F: OVER };
  cam.updateMatrixWorld();
  const inv = _m.copy(cam.matrixWorld).invert();
  const out = DOOR.out ? _o.copy(DOOR.out) : _o.set(1, 0, 0);
  const at = _v.copy(DOOR.at).addScaledVector(out, 0.042).add(_d.set(0, 0.014, 0)).applyMatrix4(inv).toArray();
  const n = _d.set(0, -1, 0).transformDirection(inv).toArray();
  const f = _d.copy(out).negate().transformDirection(inv).toArray();
  return palm('cam', at, n, f, OVER, [at[0] + 0.18, at[1] - 0.34, at[2] + 0.26]);
}
const liveOf = (fn) => {
  const o = { frame: 'cam' };
  Object.defineProperties(o, {
    p: { get() { this._c = fn(); return this._c.p; } },
    f: { get() { return (this._c || fn()).f; } },
    b: { get() { return (this._c || fn()).b; } },
    e: { get() { return (this._c || fn()).e; } },
    F: { get() { return (this._c || fn()).F; } },
  });
  return o;
};

export const POSES = { slatLiveR: live(), doorLiveR: liveOf(doorPose) };
export const CLIPS = {
  carDoor: { duration: 0.6, hold: true, blend: 0.08, marks: { grip: 0.35, pull: 0.5 }, keys: { R: [[0, 'downR'], [0.35, 'doorLiveR', 'out'], [0.6, 'doorLiveR']] } },
  partSlats: { duration: 0.5, hold: true, blend: 0.1, marks: { touch: 0.3 }, keys: { R: [[0, 'downR'], [0.3, 'slatLiveR', 'out'], [0.5, 'slatLiveR']] } },
  releaseSlats: { duration: 0.4, blend: 0.05, marks: {}, keys: { R: [[0, 'slatLiveR'], [0.4, 'downR', 'in']] } },
};
