import * as THREE from 'three';
import { HAND_POSES, palm, OPEN } from '../../player/handPoses.js';

// The hands on a thing that moves under the player's own mouse (object
// first): the scene decides where the THING is every step (the pencil's
// side on the paper, the dial's knob as it turns) and the hand is solved
// onto its grip - hands.poseForProp - and written into the live poses of
// player/clips/office.js (b2liveR, b2liveL), shown as the hands' still.
//   live(H, { R: 'b2liveR' | poseName | null, L: ... })   what each hand shows
//   holdAt(H, side, prop, worldMatrix, F, e?)             that hand onto the prop at a world place
//   toCam(H, worldMatrix) -> the same matrix in the eye's frame
// (the eye's own lens: the hands' sets that are not guns draw through the
// camera's fov, so a world place is where the hand touches it)
const _m = new THREE.Matrix4(), _i = new THREE.Matrix4();

export function live(H, { R = null, L = null } = {}) {
  const P = HAND_POSES;
  // (a fresh still blends from where the hands are: no jump)
  if (!H.still || H.still.R !== (R ? P[R] : null) || H.still.L !== (L ? P[L] : null)) H.snapshot(0.22);
  H.still = (R || L) ? { R: R ? P[R] : null, L: L ? P[L] : null } : null;
}

// a world matrix -> the eye's frame (the arm roots' parent: the viewmodel root)
export function toCam(H, world) {
  const root = H.vm.root;
  root.updateMatrixWorld(true);
  return _m.copy(_i.copy(root.matrixWorld).invert()).multiply(world);
}

// the hand that holds `prop` with the prop at `world` (a Matrix4): written
// into the live pose of that side
export function holdAt(H, side, prop, world, F, e = null) {
  const pose = H.poseForProp(side, prop, toCam(H, world).clone(), 'cam', F, e);
  const L = HAND_POSES[side === 'R' ? 'b2liveR' : 'b2liveL'];
  L.frame = 'cam'; L.p = pose.p; L.f = pose.f; L.b = pose.b; L.F = F; L.e = pose.e || L.e;
  // (poseForProp writes a left hand's place mirrored for resolve(): resolve
  // mirrors a left pose back, so the pose is kept as it came)
  return L;
}

// a pose written straight into a live slot (cam frame)
export function setLive(side, pose) {
  const L = HAND_POSES[side === 'R' ? 'b2liveR' : 'b2liveL'];
  Object.assign(L, pose);
  return L;
}

// a matrix from a place, the thing's up and its front (+y along up, +z toward fwd)
export function place(pos, up, fwd) {
  const y = up.clone().normalize();
  const x = new THREE.Vector3().crossVectors(y, fwd).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos);
}

// the torn sheet held up in the left hand at a place of the eye's frame:
// the sheet's place is authored (its face to the eye, its top up), the hand
// is solved onto its edge every step
const _cm = new THREE.Matrix4();
const SHEETF = { i: [0.3, 0.35, 0.18, -0.02], m: [0.35, 0.4, 0.2, 0], r: [0.45, 0.5, 0.25, 0.02], l: [0.55, 0.55, 0.28, 0.05], t: [0.65, 0.25, 0.45, 0.1, 0.05] };
// (the defaults: walking, the whole sheet at the frame's lower left, its
// three figures clear of the hand and of the frame's edge; `down` 0..1 takes
// it down out of the frame, into a pocket)
export function holdSheet(H, sheet, { pos = [-0.3, -0.205, -0.62], face = [0.3, 0.35, 1], foot = [-0.08, -1, 0.3], down = 0 } = {}) {
  const cam = H.game.camera;
  cam.updateMatrixWorld();
  const e = down * down * (3 - 2 * down);
  const M = place(new THREE.Vector3(pos[0] - 0.05 * e, pos[1] - 0.42 * e, pos[2] + 0.12 * e), new THREE.Vector3(...face), new THREE.Vector3(...foot));
  _cm.multiplyMatrices(cam.matrixWorld, M);
  return holdAt(H, 'L', sheet, _cm, SHEETF, [-0.3, -0.55, 0.05]);
}

// a palm flat on a thing at a world point (object first: the scene says where
// the thing is this step, the hand is put on it): `n` the way the palm faces
// (into the thing), `f` the way the fingers point, both world; written into
// that side's live pose (show it with live()). The thing moves, the palm rides it.
const _pi = new THREE.Matrix4();
export function palmOn(H, side, p, n, f, F = OPEN, e = null) {
  const root = H.vm.root;
  root.updateMatrixWorld(true);
  _pi.copy(root.matrixWorld).invert();
  const pc = p.clone().applyMatrix4(_pi);
  const nc = n.clone().transformDirection(_pi), fc = f.clone().transformDirection(_pi);
  return setLive(side, palm('cam', pc.toArray(), nc.toArray(), fc.toArray(), F, e || (side === 'R' ? [0.26, -0.45, -0.08] : [-0.26, -0.45, -0.08])));
}
