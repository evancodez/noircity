import * as THREE from 'three';
import { wrap, RELAX, FIST } from '../handPoses.js';

// The hands in the car (lane B5): object first. The wheel turns (the car's
// v.steer, vehicles/models.js's wheel) and both hands ride its rim where
// they grip it, at ten and two; the left hand leaves it to put the revolver
// out of the window (DRIVE.aim eased 0..1 by the scene) and comes back to
// it. The set's two rest poses are LIVE: their fields are read each step
// (Hands.resolve), computed then from the wheel's place in the eye's frame,
// so a hand is never a step behind the thing it holds.
//   DRIVE.car     the Vehicle whose wheel the hands hold (null: hands off)
//   DRIVE.aim     0 .. 1 the left hand out of the window with the gun
//   DRIVE.camera  the eye (set by the scene: game.camera)
//   DRIVE.grip    the lapels (the interrogation): { L, R } world grip
//                 frames { p, n (the palm's way), f (the fingers') } or null
export const DRIVE = { car: null, aim: 0, camera: null, grip: null, lapelK: 0, t: -1, rimR: 0.205 };

const _m = new THREE.Matrix4(), _c = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _n = new THREE.Vector3();
const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _rd = new THREE.Vector3(), _t = new THREE.Vector3(), _f = new THREE.Vector3(), _q = new THREE.Vector3();
const GRIP_F = wrap(0.017, { k: 1.05, thumb: [0.55, 0.35, 0.3, 0.25, 0.3] });
// the gun hand: the grip in the fist, the index along the frame
const GUN_F = { ...wrap(0.016, { k: 1.0 }), i: [0.35, 0.3, 0.15, 0.0], t: [0.6, 0.1, 0.8, 0.35, 0.25] };

// a pose record the Hands read: frame 'cam', true coordinates
const live = () => ({ frame: 'cam', p: [0, -0.3, -0.4], f: [0, 0, -1], b: [0, 1, 0], F: RELAX, e: [0.2, -0.5, 0] });
const R = live(), L = live();

// the grip on the rim at angle a (radians from the wheel's top, + toward
// the car's right), for one hand: the palm on the rim's outside, facing in,
// the fingers round its far side; written into P in the eye's frame
function onRim(P, a, side, W) {
  const { c, u, r, n } = W;
  _rd.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(r, Math.sin(a));   // outward
  _t.copy(u).multiplyScalar(-Math.sin(a)).addScaledVector(r, Math.cos(a));
  const rimC = _p.copy(c).addScaledVector(_rd, DRIVE.rimR);
  // the palm's contact: outward and toward the eye
  _a.copy(_rd).multiplyScalar(0.8).addScaledVector(n, 0.6).normalize();
  const at = _q.copy(rimC).addScaledVector(_a, 0.02);
  // fingers: round the rim's section, away from the eye
  _f.copy(_rd).multiplyScalar(0.6).addScaledVector(n, -0.8).normalize();
  const b = _a;   // the back of the hand faces out of the rim
  // the wrist from the palm's point (handPoses.palm): back 0.018, along -0.047
  const p = at.clone().addScaledVector(b, 0.018).addScaledVector(_f, -0.047);
  P.p[0] = p.x; P.p[1] = p.y; P.p[2] = p.z;
  P.f[0] = _f.x; P.f[1] = _f.y; P.f[2] = _f.z;
  P.b[0] = b.x; P.b[1] = b.y; P.b[2] = b.z;
  P.F = GRIP_F;
  // the elbow: down, out and back toward the body
  P.e[0] = p.x + (side === 'R' ? 0.16 : -0.16); P.e[1] = p.y - 0.3; P.e[2] = p.z + 0.26;
}

// the wheel's frame in the eye's: its centre, its up and right in its plane,
// its face toward the eye
function wheelFrame(cam, car) {
  // (the mount's frame: +x away from the eye, +y up the wheel's face, +z to the
  // car's right - vehicles/models.js; the wheel's turn is its own)
  const mount = car.model.wheelMount;
  mount.updateWorldMatrix(true, false);
  _m.copy(cam.matrixWorldInverse).multiply(mount.matrixWorld);
  _c.set(0, 0, 0).applyMatrix4(_m);
  _u.set(0, 1, 0).transformDirection(_m);
  _r.set(0, 0, 1).transformDirection(_m);
  _n.set(-1, 0, 0).transformDirection(_m);
  return { c: _c, u: _u, r: _r, n: _n };
}

// the gun out of the window: the left arm along the sill, the hand out past
// the pillar, the muzzle on the view's centre far down the road
const AIM_P = new THREE.Vector3(-0.11, -0.13, -0.43);
function aimPose(P) {
  const aimAt = _a.set(0, 0, -25);
  _f.copy(aimAt).sub(AIM_P).normalize();
  // (the knuckles tip down round the grip)
  _f.y -= 0.35; _f.normalize();
  const b = _t.set(-0.85, 0.5, 0.05).normalize();
  P.p[0] = AIM_P.x; P.p[1] = AIM_P.y; P.p[2] = AIM_P.z;
  P.f[0] = _f.x; P.f[1] = _f.y; P.f[2] = _f.z;
  P.b[0] = b.x; P.b[1] = b.y; P.b[2] = b.z;
  P.F = GUN_F;
  P.e[0] = -0.24; P.e[1] = -0.36; P.e[2] = -0.12;
}

const lerp3 = (o, a, b, k) => { for (let i = 0; i < 3; i++) o[i] = a[i] + (b[i] - a[i]) * k; };
const lerpF = (a, b, k) => {
  const o = {};
  for (const key of Object.keys(a)) o[key] = a[key].map((v, i) => v + ((b[key] ? b[key][i] : v) - v) * k);
  return o;
};
const tmpA = live(), tmpB = live();

// one computation a step (the first read of a field does it)
function refresh() {
  const cam = DRIVE.camera, car = DRIVE.car;
  const t = globalThis.__noir ? globalThis.__noir.game.time : 0;
  const stamp = t + (cam ? cam.matrixWorld.elements[12] * 1e-3 + cam.matrixWorld.elements[0] : 0);
  if (stamp === DRIVE.t) return;
  DRIVE.t = stamp;
  if (!cam || !car || !car.model.wheel) return;
  cam.updateMatrixWorld();
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const W = wheelFrame(cam, car);
  const spin = car.model.wheel.rotation.x;
  // (ten and two, riding the rim as it turns: + spin turns it to the left)
  onRim(R, 1.05 + spin, 'R', W);
  onRim(tmpA, -1.05 + spin, 'L', W);
  const k = DRIVE.aim;
  if (k <= 0) { copyPose(L, tmpA); return; }
  aimPose(tmpB);
  // (out of the window along an arc: up off the wheel, then out)
  const e = k * k * (3 - 2 * k);
  lerp3(L.p, tmpA.p, tmpB.p, e);
  L.p[1] += Math.sin(e * Math.PI) * 0.05;
  lerp3(L.f, tmpA.f, tmpB.f, e);
  lerp3(L.b, tmpA.b, tmpB.b, e);
  lerp3(L.e, tmpA.e, tmpB.e, e);
  L.F = lerpF(GRIP_F, GUN_F, e);
}
function copyPose(o, a) { for (const k of ['p', 'f', 'b', 'e']) for (let i = 0; i < 3; i++) o[k][i] = a[k][i]; o.F = a.F; }

// live records: every field read refreshes the step's computation first
const liveProxy = (P) => new Proxy(P, { get(t, key) { if (key === 'p' || key === 'f' || key === 'b' || key === 'e' || key === 'F') refresh(); return t[key]; } });
export const POSES = { driveR: liveProxy(R), driveL: liveProxy(L) };
export const SETS = {
  // driving gloves, the coat's sleeves
  drive: { skin: 'glove', sleeve: 'coat', R: 'driveR', L: 'driveL', brush: 'R' },
};
// the stand-in revolver in the left hand (a prop of lane B5's: props/kinds/tail.js)
export const SOCKETS = {
  tailRevolver: { bone: 'hand', p: [-0.004, -0.03, -0.05], basis: [[1, 0, 0], [0, 0.34, 0.94], [0, -0.94, 0.34]] },
};
void FIST;
