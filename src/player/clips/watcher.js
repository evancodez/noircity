import * as THREE from 'three';
import { palm } from '../handPoses.js';

// The hands at room 304's street window (lane B4, scene 6): two fingers
// part the blind's slats. Object first: the pose is read live from where
// the pressed slat's near edge is (SLAT.blind.fingerAt, world), so the
// fingertips stay on it while the slat goes down and the eye leans in.
//   SLAT.blind   the blind (scenes/watcher/blind.js); SLAT.cam the camera
//   partSlats    the right hand up from below, the index and middle fingers
//                out, their tips on the slat (0.3 s), held there
//   releaseSlats the hand drops away (the slat springs back)
export const SLAT = { blind: null, cam: null, at: null };

const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
// two fingers out and a little bent at the tips, pressing; the other two
// and the thumb folded in
// ([R2-B] the thumb tucked over the folded two: it stood out under the
// hand like a pistol's hammer)
const TWO = { i: C(0.1, 0.22, 0.34, -0.05), m: C(0.12, 0.24, 0.34, 0.03), r: C(1.35, 1.65, 0.9, 0.05), l: C(1.4, 1.62, 0.9, 0.1), t: [0.95, 0.55, 0.95, 0.75, 0.55] };
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();

// ([R2-B] SLAT.at: a world point on the pressed slat's near edge, for a
// blind without fingerAt - the room's own, lane B2's)
function slatPose() {
  const B = SLAT.blind, cam = SLAT.cam;
  if ((!B || !B.fingerAt) && !SLAT.at) return { frame: 'cam', p: [0.12, -0.3, -0.3], f: [-0.2, 0.3, -0.9], b: [0.3, 0.9, 0.2], F: TWO };
  if (!cam) return { frame: 'cam', p: [0.12, -0.3, -0.3], f: [-0.2, 0.3, -0.9], b: [0.3, 0.9, 0.2], F: TWO };
  cam.updateMatrixWorld();
  const inv = _m.copy(cam.matrixWorld).invert();
  const tip = (SLAT.at ? _v.copy(SLAT.at) : B.fingerAt(_v)).applyMatrix4(inv).toArray();
  // [R2-B] the hand low and on its side, coming up from the lower right:
  // only the two fingers reach the slit (B4 held it flat, palm down, and at
  // the peek's narrow lens the back of the hand filled the lower right as a
  // pale mitten); on its side its back is turned out to the right, into
  // the shadow of the designed key, and the lit fingers read against it
  const f = new THREE.Vector3(-0.5, 0.32, -0.8).normalize().toArray();
  const n = new THREE.Vector3(-0.55, -0.8, -0.1).normalize().toArray();
  // (the palm's middle a finger's length and the knuckles back from the tips)
  const at = [tip[0] - f[0] * 0.135 + 0.006, tip[1] - f[1] * 0.135 + 0.012, tip[2] - f[2] * 0.135];
  return palm('cam', at, n, f, TWO, [at[0] + 0.26, at[1] - 0.3, at[2] + 0.1]);
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

// my car's door: the right hand to its handle (DOOR.at, world), the
// fingers hooked under it, the thumb on the button
export const DOOR = { at: null };
const HOOK = { i: C(0.7, 0.9, 0.5, -0.02), m: C(0.75, 0.95, 0.5), r: C(0.8, 1.0, 0.55, 0.03), l: C(0.9, 1.05, 0.6, 0.07), t: [0.4, 0.1, 0.3, 0.2, 0.2] };
function doorPose() {
  const cam = SLAT.cam;
  if (!DOOR.at || !cam) return { frame: 'cam', p: [0.15, -0.3, -0.35], f: [-0.2, 0.2, -0.95], b: [0.9, 0.3, 0.1], F: HOOK };
  cam.updateMatrixWorld();
  const inv = _m.copy(cam.matrixWorld).invert();
  const at = _v.copy(DOOR.at).applyMatrix4(inv).toArray();
  // (the palm up under the handle, the fingers ahead along it)
  return palm('cam', [at[0], at[1] - 0.025, at[2] + 0.02], [0.05, 1, 0.1], [-0.35, 0.05, -0.93], HOOK, [at[0] + 0.25, at[1] - 0.28, at[2] + 0.3]);
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
