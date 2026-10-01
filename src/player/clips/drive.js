import * as THREE from 'three';
import { wrap, RELAX, FIST } from '../handPoses.js';
import { SOCKETS as REV_SOCKETS, GRIP_F as REV_GRIP_F, PULL_F as REV_PULL_F } from './revolver.js';

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
export const DRIVE = { car: null, aim: 0, camera: null, grip: null, gun: null, lapelK: 0, t: -1, rimR: 0.205 };

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

// The gun out of the window (object first): the revolver's own path in the
// eye's frame - up from the holster below the frame, then out past the
// pillar at arm's length, its barrel converging on the view's centre far
// down the road, kicked up by a shot and settling - and the left hand on
// its grip wherever it is. DRIVE.gun: { prop (drawn in the hands' scene:
// the scene adds it), kick (0..1, a shot's recoil) }
// [R2] lane B3's .38 (props/kinds/revolver.js: +x right, +y up, the muzzle
// -z, the origin the palm's centre on the stocks), held by B3's own socket
// mirrored for the left hand (clips/revolver.js revolverGripL is that grip
// at B3's ready; here it rides this path). The gun sits low and left of the
// view's centre: a silhouette against the lit road, his car clear above its
// muzzle and its flash. (The stand-in's path ran its barrel along +z: B3's
// gun was held backwards, its muzzle and flash toward the lens; and the
// sights on the centre put the gun and the flash over his car.)
const GRIP = new THREE.Vector3(-0.115, -0.088, -0.42);     // the grip at the aim
const LOW = new THREE.Vector3(-0.16, -0.62, -0.24);        // ... in the holster, out of sight
const CANT = -0.2;                                          // the top rolled out: its right side to the eye
// (the barrel is laid across the view onto a point a metre out on the
// line of the eye: drawn from the left toward the centre it points at his
// car, and it is seen along its length - aimed at the car itself it was
// seen end-on, a lump. The round goes down the eye's line, as the Tommy
// gun's does)
const AIM_AT = new THREE.Vector3(0.02, -0.03, -0.95);
const _gm = new THREE.Matrix4(), _gx = new THREE.Vector3(), _gy = new THREE.Vector3(), _gz = new THREE.Vector3(), _gp = new THREE.Vector3();
const _km = new THREE.Matrix4();
function gunMatrix(k, kick) {
  // (k 0: low in the holster, pointing down and forward; 1: at the aim)
  const e = k * k * (3 - 2 * k);
  _gp.lerpVectors(LOW, GRIP, e);
  _gp.y += Math.sin(e * Math.PI) * 0.05;
  _gp.x -= Math.sin(e * Math.PI) * 0.04;
  // the muzzle's way (the gun's -z): at the aim across onto the eye's line;
  // low, down along the leg
  _gz.copy(AIM_AT).sub(_gp).normalize();
  const low = _t.set(0.1, -0.8, -0.6).normalize();
  _gz.lerp(low, 1 - e).normalize().negate();
  _gy.set(Math.sin(CANT * e), Math.cos(CANT * e), 0);
  _gx.crossVectors(_gy, _gz).normalize();
  _gy.crossVectors(_gz, _gx).normalize();
  _gm.makeBasis(_gx, _gy, _gz).setPosition(_gp);
  // (a shot climbs the muzzle about the grip, 15 degrees, and drives the gun
  // back a little; it settles as the kick does)
  if (kick > 0) {
    _gm.multiply(_km.makeRotationX(0.26 * kick));
    _gm.elements[12] += _gz.x * 0.03 * kick; _gm.elements[13] += _gz.y * 0.03 * kick; _gm.elements[14] += _gz.z * 0.03 * kick;
  }
  return _gm;
}
// the left hand on the grip of the gun at matrix m (the eye's frame): B3's
// socket seats a right hand on it; the left is that grip mirrored (the gun
// mirrored across the eye's x, the right hand solved onto it, the pose
// mirrored back)
const _S = new THREE.Matrix4().makeScale(-1, 1, 1), _mr = new THREE.Matrix4(), _sock = new THREE.Matrix4();
{
  const S = REV_SOCKETS.revolver;
  _sock.makeBasis(...S.basis.map((v) => new THREE.Vector3(...v))).setPosition(...S.p).invert();
}
function onGrip(P, m, kick) {
  _mr.copy(_S).multiply(m).multiply(_S).multiply(_sock);
  const p = _q.setFromMatrixPosition(_mr);
  const f = _a.set(0, 0, -1).transformDirection(_mr), b = _rd.set(0, 1, 0).transformDirection(_mr);
  P.p[0] = -p.x; P.p[1] = p.y; P.p[2] = p.z;
  P.f[0] = -f.x; P.f[1] = f.y; P.f[2] = f.z;
  P.b[0] = -b.x; P.b[1] = b.y; P.b[2] = b.z;
  // (the index draws the trigger as the shot goes)
  P.F = kick > 0.55 ? REV_PULL_F : REV_GRIP_F;
  // the elbow: down, out and back along the car's side
  P.e[0] = P.p[0] - 0.22; P.e[1] = P.p[1] - 0.24; P.e[2] = P.p[2] + 0.3;
}
// the hand gone down to the holster (below the frame)
function holsterPose(P) {
  P.p[0] = -0.2; P.p[1] = -0.62; P.p[2] = -0.22;
  P.f[0] = 0.1; P.f[1] = -0.6; P.f[2] = -0.8;
  P.b[0] = -0.9; P.b[1] = 0.2; P.b[2] = -0.2;
  P.F = GUN_F;
  P.e[0] = -0.3; P.e[1] = -0.8; P.e[2] = 0.1;
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
  const stamp = t + (cam ? cam.matrixWorld.elements[12] * 1e-3 + cam.matrixWorld.elements[0] : 0) + DRIVE.aim * 3.1 + (DRIVE.gun ? DRIVE.gun.kick || 0 : 0) * 7.3;
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
  const k = DRIVE.aim, G = DRIVE.gun;
  // (off the wheel, down to the holster (k < 0.35); up with the gun, out of
  // the window and onto the aim (k > 0.35))
  const k1 = Math.min(1, k / 0.35), k2 = Math.max(0, (k - 0.35) / 0.65);
  if (G && G.prop) G.prop.visible = k2 > 0;
  if (k <= 0) { copyPose(L, tmpA); return; }
  if (k2 <= 0) {
    holsterPose(tmpB);
    const e = k1 * k1 * (3 - 2 * k1);
    lerp3(L.p, tmpA.p, tmpB.p, e); lerp3(L.f, tmpA.f, tmpB.f, e); lerp3(L.b, tmpA.b, tmpB.b, e); lerp3(L.e, tmpA.e, tmpB.e, e);
    L.F = lerpF(GRIP_F, GUN_F, e);
    return;
  }
  const kick = G ? G.kick || 0 : 0;
  const m = gunMatrix(k2, kick);
  // (the path's point is the prop's grip: B3's revolver keeps its origin there)
  if (G && G.prop) {
    const gi = G.gripInv || (G.gripInv = G.prop.userData.grip ? G.prop.userData.grip.clone().invert() : new THREE.Matrix4());
    G.prop.matrix.copy(m).multiply(gi);
    G.prop.matrixWorldNeedsUpdate = true;
  }
  onGrip(L, m, kick);
}
function copyPose(o, a) { for (const k of ['p', 'f', 'b', 'e']) for (let i = 0; i < 3; i++) o[k][i] = a[k][i]; o.F = a.F; }

// live records: every field read refreshes the step's computation first
const liveProxy = (P) => new Proxy(P, { get(t, key) { if (key === 'p' || key === 'f' || key === 'b' || key === 'e' || key === 'F') refresh(); return t[key]; } });
export const POSES = { driveR: liveProxy(R), driveL: liveProxy(L) };
export const SETS = {
  // driving gloves, the coat's sleeves ([R2-B] printed as black leather
  // with its sheen: on the dark rim and out of the window they read)
  drive: { skin: 'glove', leather: true, sleeve: 'coat', R: 'driveR', L: 'driveL', brush: 'R' },
};
void FIST;
