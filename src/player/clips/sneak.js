import * as THREE from 'three';
import { OPEN, RELAX, FISTF, mirror, palm } from '../handPoses.js';

// The hands in the dark (lane B6, scene 8): the 'sneak' set, its poses and
// its clips. The hands ride low in the frame, bare, in the coat's sleeves;
// the scene prints them by the light on me (white in a pool, ink in the
// dark: the exposure shown). Crouched they come a little forward and down
// (the scene blends the rest poses: SNEAK_REST).
//   sn_take    reach and close on a bottle where it stands (H.snTarget), bring it up
//   sn_aim     the bottle drawn back over the shoulder (held while LMB is)
//   sn_throw   the arm comes over, the bottle leaves (mark release)
//   sn_pull    reach to a lever or a cord and draw it along its path (H.snPath; marks grab, pulled)
//   sn_pullL   the same with the left hand (a bottle in the right)
//   sn_blow    one short blow from behind (mark hit), then both hands catch him and lower him
//   sn_coat    the hand goes into the coat for the revolver, and comes away
//   sn_cosh    the blow from behind: the view knocked down, the hands drop
const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
const GRIPB = { i: C(1.1, 1.3, 0.7), m: C(1.15, 1.35, 0.7), r: C(1.2, 1.35, 0.7), l: C(1.25, 1.35, 0.7), t: [0.8, 0.35, 0.55, 0.35, 0.3] };
const EASY = { i: C(0.2, 0.3, 0.15, -0.03), m: C(0.26, 0.36, 0.2), r: C(0.34, 0.44, 0.24, 0.03), l: C(0.42, 0.52, 0.28, 0.06), t: [0.2, 0.1, 0.15, 0.15, 0.2] };

// the rest, standing and crouched (the scene lays the blend on sneakR / sneakL)
export const SNEAK_REST = {
  R: { stand: [0.215, -0.258, -0.43], crouch: [0.2, -0.245, -0.5] },
  L: { stand: [0.19, -0.25, -0.47], crouch: [0.17, -0.235, -0.54] },
};
// [R2-B] the hands low and ready, not claws: the fingers together and
// lightly curled, pointing forward and a little down, the back of each hand
// turned out and up (the art director, round 2: palms down with the
// fingers raised and fanned, held low, they read as claws)
const LOW_F = { i: C(0.32, 0.5, 0.3, -0.05), m: C(0.36, 0.55, 0.32, 0), r: C(0.42, 0.6, 0.34, 0.04), l: C(0.5, 0.65, 0.36, 0.1), t: [0.25, 0.05, 0.3, 0.2, 0.2] };
export const POSES = {
  sneakR: { frame: 'cam', p: [...SNEAK_REST.R.stand], f: [-0.12, -0.3, -0.95], b: [0.7, 0.65, 0.3], F: LOW_F, e: [0.3, -0.56, -0.08] },
  sneakL: mirror({ frame: 'cam', p: [...SNEAK_REST.L.stand], f: [-0.18, -0.28, -0.94], b: [0.72, 0.62, 0.3], F: LOW_F, e: [0.3, -0.56, -0.12] }),
  // the bottle by its neck, up by the shoulder, ready
  sn_holdR: { frame: 'cam', p: [0.2, -0.2, -0.34], f: [-0.25, 0.85, -0.45], b: [0.9, 0.1, 0.4], F: GRIPB, e: [0.3, -0.5, -0.02] },
  // drawn back over the shoulder, the other hand out before me to aim
  sn_backR: { frame: 'cam', p: [0.26, -0.06, -0.12], f: [-0.1, 0.75, 0.65], b: [0.95, 0.1, -0.2], F: GRIPB, e: [0.34, -0.3, 0.12] },
  sn_aimL: mirror({ frame: 'cam', p: [0.12, -0.17, -0.5], f: [-0.05, 0.45, -0.9], b: [0.8, 0.5, 0.3], F: OPEN, e: [0.24, -0.45, -0.2] }),
  // the arm come over: forward and down, open
  sn_outR: { frame: 'cam', p: [0.06, -0.12, -0.6], f: [-0.1, -0.2, -0.97], b: [0.3, 0.95, -0.1], F: OPEN, e: [0.18, -0.32, -0.3] },
  // pulling a lever or a cord down
  sn_pullDownR: { frame: 'cam', p: [0.14, -0.3, -0.42], f: [-0.2, 0.5, -0.84], b: [0.7, 0.2, 0.68], F: GRIPB, e: [0.26, -0.55, -0.1] },
  sn_pullDownL: mirror({ frame: 'cam', p: [0.14, -0.3, -0.42], f: [-0.2, 0.5, -0.84], b: [0.7, 0.2, 0.68], F: GRIPB, e: [0.26, -0.55, -0.1] }),
  // the blow: the fist up by the ear, then down on the back of his neck
  sn_blowUpR: { frame: 'cam', p: [0.2, 0.06, -0.3], f: [-0.3, 0.85, 0.4], b: [0.9, 0.0, 0.4], F: FISTF, e: [0.32, -0.28, 0.05] },
  sn_blowDownR: { frame: 'cam', p: [0.02, -0.12, -0.6], f: [-0.2, -0.5, -0.84], b: [0.4, 0.8, -0.4], F: FISTF, e: [0.16, -0.3, -0.3] },
  // catching him under the arms as he goes: both hands forward, down, open
  sn_catchR: { frame: 'cam', p: [0.14, -0.3, -0.5], f: [-0.4, -0.3, -0.86], b: [0.1, 0.9, -0.3], F: RELAX, e: [0.28, -0.5, -0.2] },
  sn_catchL: mirror({ frame: 'cam', p: [0.14, -0.3, -0.52], f: [-0.4, -0.3, -0.86], b: [0.1, 0.9, -0.3], F: RELAX, e: [0.28, -0.5, -0.2] }),
};

// [R2-B] Lowering him (object first): through the blow's catch my hands are
// on HIS body as it folds - each palm on his side under his arm, the
// fingers round his ribs toward his front - read off his bones every step
// (B6 left them held out to him in the air while he went down). The man is
// the nearest figure before me when the blow begins; without one the hands
// keep the still catch above.
const CATCH = { h: null, c: null };
const CATCH_F = { i: C(0.45, 0.5, 0.25, -0.03), m: C(0.5, 0.55, 0.28), r: C(0.55, 0.6, 0.3, 0.03), l: C(0.6, 0.62, 0.32, 0.07), t: [0.3, 0.1, 0.35, 0.2, 0.2] };
const _p = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _q = new THREE.Quaternion(), _mi = new THREE.Matrix4();
function theMan(H) {
  const cur = H.clips[0] || null;
  if (CATCH.h === cur) return CATCH.c;
  CATCH.h = cur; CATCH.c = null;
  const cast = H.game.stage && H.game.stage.cast;
  if (!cast) return null;
  const eye = H.game.camera.position;
  let bd = 2.2;
  for (const c of cast.list) {
    const f = c.fig;
    if (!f || !f.bones || !f.bones.upperArmR) continue;
    const d = Math.hypot(f.pos.x - eye.x, f.pos.z - eye.z);
    if (d < bd) { bd = d; CATCH.c = c; }
  }
  return CATCH.c;
}
function catchOn(H, side, rec) {
  const c = theMan(H);
  const still = side === 'R' ? POSES.sn_catchR : POSES.sn_catchL;
  if (!c) { Object.assign(rec, still); return; }
  const B = c.fig.bones;
  // his frame: his right (-x), up, forward (+z) in the world, from his chest
  B.chest.getWorldQuaternion(_q);
  _x.set(side === 'R' ? -1 : 1, 0, 0).applyQuaternion(_q);   // out of his side (mine)
  _y.set(0, 1, 0).applyQuaternion(_q);
  _z.set(0, 0, 1).applyQuaternion(_q);
  (side === 'R' ? B.upperArmR : B.upperArmL).getWorldPosition(_p);
  // (the palm on his side, a hand's width under the arm's root)
  _p.addScaledVector(_y, -0.12).addScaledVector(_x, -0.02);
  const cam = H.game.camera;
  cam.updateMatrixWorld();
  _mi.copy(cam.matrixWorld).invert();
  const at = _p.clone().applyMatrix4(_mi);
  const n = _x.clone().negate().transformDirection(_mi);
  const dir = _z.clone().multiplyScalar(0.75).addScaledVector(_y, 0.25).transformDirection(_mi);
  const e = _p.clone().addScaledVector(_x, 0.16).addScaledVector(_z, -0.28).addScaledVector(_y, -0.22).applyMatrix4(_mi);
  let P = palm('cam', at.toArray(), n.toArray(), dir.toArray(), CATCH_F, e.toArray());
  if (side === 'L') P = mirror(P);
  Object.assign(rec, P);
}
const liveCatch = (side) => {
  const rec = { ...POSES['sn_catch' + side] };
  return new Proxy(rec, { get(t, key) {
    if (key === 'p') { const H = globalThis.__noir && globalThis.__noir.game.player.hands; if (H) catchOn(H, side, t); }
    return t[key];
  } });
};
POSES.sn_holdHimR = liveCatch('R');
POSES.sn_holdHimL = liveCatch('L');

// a reach to the thing the scene points the hands at (H.snTarget: an
// Object3D where the grip is), closed on it; computed once per playing
const reach = (F, e = [0.26, -0.45, -0.2]) => (H, side) => (H.snTarget ? H.holdPoseAt(side, H.snTarget, F, e) : null);
// the i-th place of the thing's path as the hand pulls it (H.snPath: the
// scene's Object3Ds along the lever handle's arc, or the cord coming off
// its cleat): the hand stays on the grip while the thing moves (object
// first); without a path, the one target
const along = (i, F, e) => (H, side) => {
  const o = (H.snPath && H.snPath[Math.min(i, H.snPath.length - 1)]) || H.snTarget;
  return o ? H.holdPoseAt(side, o, F, e) : null;
};
// a pull: reach, close on the grip, draw it down its path (0.34 to 0.58 s:
// the scene moves the thing on the same clock), let go, back to rest
const pullKeys = (e) => [[0, '@rest'], [0.28, along(0, GRIPB, e), 'out'], [0.34, along(0, GRIPB, e)],
  [0.42, along(1, GRIPB, e), 'lin'], [0.5, along(2, GRIPB, e), 'lin'], [0.58, along(3, GRIPB, e), 'lin'], [0.68, along(3, GRIPB, e)], [0.95, '@rest']];

export const CLIPS = {
  sn_take: {
    duration: 0.7, marks: { take: 0.3 },
    keys: { R: [[0, '@rest'], [0.27, reach(GRIPB), 'out'], [0.34, reach(GRIPB)], [0.7, 'sn_holdR']], L: [[0, '@rest'], [0.7, '@rest']] },
    view: [[0, {}], [0.27, { fwd: 0.18, down: 0.1, pitch: -0.08 }], [0.7, {}]],
  },
  sn_aim: {
    duration: 0.3, marks: {}, hold: true, blocking: false,
    keys: { R: [[0, 'sn_holdR'], [0.3, 'sn_backR', 'out']], L: [[0, '@rest'], [0.3, 'sn_aimL', 'out']] },
  },
  sn_throw: {
    duration: 0.55, marks: { release: 0.1 },
    keys: { R: [[0, 'sn_backR'], [0.1, 'sn_outR', 'snap'], [0.22, 'sn_outR'], [0.55, '@rest']], L: [[0, 'sn_aimL'], [0.2, 'sn_aimL'], [0.55, '@rest']] },
    view: [[0, {}], [0.1, { fwd: 0.05, yaw: -0.02 }, 'snap'], [0.55, {}]],
  },
  sn_pull: {
    duration: 0.95, marks: { grab: 0.28, pulled: 0.58 },
    keys: { R: pullKeys([0.3, -0.35, -0.2]), L: [[0, '@rest'], [0.95, '@rest']] },
    view: [[0, {}], [0.28, { fwd: 0.12 }], [0.58, { fwd: 0.08, down: 0.05 }], [0.95, {}]],
  },
  // (the bottle in the right hand: the left pulls, the right keeps it up)
  sn_pullL: {
    duration: 0.95, marks: { grab: 0.28, pulled: 0.58 },
    keys: { L: pullKeys([-0.3, -0.35, -0.2]), R: [[0, 'sn_holdR'], [0.95, 'sn_holdR']] },
    view: [[0, {}], [0.28, { fwd: 0.12 }], [0.58, { fwd: 0.08, down: 0.05 }], [0.95, {}]],
  },
  // (his fold is 1.1 s - dockhand dh_fold: on his knees at 0.3, down by
  // 0.9 - the eye goes down with him, the hands out to him; control back
  // as he lies)
  sn_blow: {
    duration: 1.15, marks: { hit: 0.2, lowered: 0.95 },
    // ([R2-B] the catch on his body, riding it down: sn_holdHim*)
    keys: { R: [[0, '@rest'], [0.12, 'sn_blowUpR', 'out'], [0.2, 'sn_blowDownR', 'snap'], [0.38, 'sn_holdHimR'], [0.9, 'sn_holdHimR'], [1.15, '@rest']], L: [[0, '@rest'], [0.3, 'sn_holdHimL'], [0.9, 'sn_holdHimL'], [1.15, '@rest']] },
    view: [[0, {}], [0.2, { fwd: 0.16, pitch: -0.1 }, 'snap'], [0.45, { fwd: 0.12, down: 0.16, pitch: -0.28 }], [0.9, { fwd: 0.05, down: 0.32, pitch: -0.45 }], [1.15, {}]],
  },
  sn_coat: {
    duration: 1.0, marks: { in: 0.35 },
    keys: { R: [[0, '@rest'], [0.35, 'coatR'], [0.62, 'coatR'], [1.0, '@rest']], L: [[0, '@rest'], [1.0, '@rest']] },
    view: [[0, {}], [0.35, { pitch: -0.05 }], [1.0, {}]],
  },
  sn_cosh: {
    duration: 0.9, marks: {}, hold: true,
    keys: { R: [[0, '@rest'], [0.2, 'downR']], L: [[0, '@rest'], [0.2, 'downL']] },
    view: [[0, {}], [0.07, { pitch: -0.3, roll: 0.18, down: 0.12, fwd: 0.1 }, 'snap'], [0.9, { pitch: -0.7, roll: 0.4, down: 0.55 }]],
  },
};

export const SETS = {
  sneak: { skin: 'bare', sleeve: 'coat', cuff: true, R: 'sneakR', L: 'sneakL', brush: 'R' },
};

