import * as THREE from 'three';
import { wrap, RELAX } from '../handPoses.js';

// Both hands on a man's lapels (lane B5, the question): object first. The
// fists are where his coat is: each step the grip points are read off his
// chest (his figure's chest joint, his heading), so when he is pushed back
// against his car, walked to the rail and bent over it, the hands are on
// the cloth all the way. LIVE poses, as clips/drive.js's.
//   LAPELS.man     the Character held (null: the hands drop)
//   LAPELS.camera  the eye
//   LAPELS.k       1 held .. 0 let go
export const LAPELS = { man: null, camera: null, k: 0, bend: 0, t: -1 };
const FISTC = wrap(0.012, { k: 1.25, thumb: [0.7, 0.4, 0.5, 0.5, 0.5] });
const live = () => ({ frame: 'cam', p: [0.1, -0.3, -0.4], f: [0, 1, 0], b: [0, 0, 1], F: FISTC, e: [0.25, -0.55, -0.1] });
const R = live(), L = live();
const _c = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _l = new THREE.Vector3(), _p = new THREE.Vector3();
const _q = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Vector3(), _m = new THREE.Matrix4();

function put(P, pw, fw, bw, ew, cam) {
  _m.copy(cam.matrixWorld).invert();
  const p = _q.copy(pw).applyMatrix4(_m), e = _e.copy(ew).applyMatrix4(_m);
  const f = _f.copy(fw).transformDirection(_m), b = _b.copy(bw).transformDirection(_m);
  P.p[0] = p.x; P.p[1] = p.y; P.p[2] = p.z;
  P.f[0] = f.x; P.f[1] = f.y; P.f[2] = f.z;
  P.b[0] = b.x; P.b[1] = b.y; P.b[2] = b.z;
  P.e[0] = e.x; P.e[1] = e.y; P.e[2] = e.z;
  P.F = FISTC;
}

function refresh() {
  const cam = LAPELS.camera, man = LAPELS.man;
  const t = globalThis.__noir ? globalThis.__noir.game.time : 0;
  const stamp = t + (cam ? cam.matrixWorld.elements[12] * 1e-3 : 0) + LAPELS.bend * 7;
  if (stamp === LAPELS.t) return;
  LAPELS.t = stamp;
  if (!cam || !man) return;
  cam.updateMatrixWorld();
  const ch = man.bones && man.bones.chest;
  if (!ch) return;
  ch.updateWorldMatrix(true, false);
  _c.setFromMatrixPosition(ch.matrixWorld);
  // his frame at the chest: forward (toward me), up, his left
  _f.set(0, 0, 1).transformDirection(ch.matrixWorld);
  _u.set(0, 1, 0).transformDirection(ch.matrixWorld);
  _l.crossVectors(_u, _f).normalize();
  const s = man.fig ? man.fig.scale : 1;
  for (const [P, sgn] of [[R, 1], [L, -1]]) {
    // the lapel: high on his chest, off the middle; the fist on the cloth
    const at = _p.copy(_c).addScaledVector(_u, 0.1 * s).addScaledVector(_f, 0.14 * s).addScaledVector(_l, sgn * 0.085 * s);
    // (palm toward his chest, fingers up and in round the lapel's edge, the
    // back of the hand toward me)
    const fing = new THREE.Vector3().copy(_u).multiplyScalar(0.85).addScaledVector(_l, -sgn * 0.3).addScaledVector(_f, 0.2).normalize();
    const back = new THREE.Vector3().copy(_f);
    back.addScaledVector(fing, -back.dot(fing)).normalize();
    const wrist = at.clone().addScaledVector(back, 0.03).addScaledVector(fing, -0.05);
    // the elbow: down, out, back toward me
    const elbow = wrist.clone().addScaledVector(_l, sgn * 0.2).addScaledVector(_u, -0.22).addScaledVector(_f, 0.24);
    put(P, wrist, fing, back, elbow, cam);
  }
}
const liveProxy = (P) => new Proxy(P, { get(t, key) { if (key === 'p' || key === 'f' || key === 'b' || key === 'e' || key === 'F') refresh(); return t[key]; } });
export const POSES = { lapelR: liveProxy(R), lapelL: liveProxy(L) };
export const SETS = {
  lapels: { skin: 'glove', sleeve: 'coat', R: 'lapelR', L: 'lapelL', brush: 'R' },
};
void RELAX;
