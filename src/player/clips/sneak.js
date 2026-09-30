import { OPEN, RELAX, FISTF, mirror } from '../handPoses.js';

// The hands in the dark (lane B6, scene 8): the 'sneak' set, its poses and
// its clips. The hands ride low in the frame, bare, in the coat's sleeves;
// the scene prints them by the light on me (white in a pool, ink in the
// dark: the exposure shown). Crouched they come a little forward and down
// (the scene blends the rest poses: SNEAK_REST).
//   sn_take    reach and close on a bottle where it stands (H.snTarget), bring it up
//   sn_aim     the bottle drawn back over the shoulder (held while LMB is)
//   sn_throw   the arm comes over, the bottle leaves (mark release)
//   sn_pull    reach up to a lever or a cord (H.snTarget) and pull it down (marks grab, pulled)
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
export const POSES = {
  sneakR: { frame: 'cam', p: [...SNEAK_REST.R.stand], f: [-0.2, 0.3, -0.93], b: [0.55, 0.78, 0.3], F: EASY, e: [0.3, -0.56, -0.08] },
  sneakL: mirror({ frame: 'cam', p: [...SNEAK_REST.L.stand], f: [-0.28, 0.25, -0.93], b: [0.6, 0.74, 0.3], F: RELAX, e: [0.3, -0.56, -0.12] }),
  // the bottle by its neck, up by the shoulder, ready
  sn_holdR: { frame: 'cam', p: [0.2, -0.2, -0.34], f: [-0.25, 0.85, -0.45], b: [0.9, 0.1, 0.4], F: GRIPB, e: [0.3, -0.5, -0.02] },
  // drawn back over the shoulder, the other hand out before me to aim
  sn_backR: { frame: 'cam', p: [0.26, -0.06, -0.12], f: [-0.1, 0.75, 0.65], b: [0.95, 0.1, -0.2], F: GRIPB, e: [0.34, -0.3, 0.12] },
  sn_aimL: mirror({ frame: 'cam', p: [0.12, -0.17, -0.5], f: [-0.05, 0.45, -0.9], b: [0.8, 0.5, 0.3], F: OPEN, e: [0.24, -0.45, -0.2] }),
  // the arm come over: forward and down, open
  sn_outR: { frame: 'cam', p: [0.06, -0.12, -0.6], f: [-0.1, -0.2, -0.97], b: [0.3, 0.95, -0.1], F: OPEN, e: [0.18, -0.32, -0.3] },
  // pulling a lever or a cord down
  sn_pullDownR: { frame: 'cam', p: [0.14, -0.3, -0.42], f: [-0.2, 0.5, -0.84], b: [0.7, 0.2, 0.68], F: GRIPB, e: [0.26, -0.55, -0.1] },
  // the blow: the fist up by the ear, then down on the back of his neck
  sn_blowUpR: { frame: 'cam', p: [0.2, 0.06, -0.3], f: [-0.3, 0.85, 0.4], b: [0.9, 0.0, 0.4], F: FISTF, e: [0.32, -0.28, 0.05] },
  sn_blowDownR: { frame: 'cam', p: [0.02, -0.12, -0.6], f: [-0.2, -0.5, -0.84], b: [0.4, 0.8, -0.4], F: FISTF, e: [0.16, -0.3, -0.3] },
  // catching him under the arms as he goes: both hands forward, down, open
  sn_catchR: { frame: 'cam', p: [0.14, -0.3, -0.5], f: [-0.4, -0.3, -0.86], b: [0.1, 0.9, -0.3], F: RELAX, e: [0.28, -0.5, -0.2] },
  sn_catchL: mirror({ frame: 'cam', p: [0.14, -0.3, -0.52], f: [-0.4, -0.3, -0.86], b: [0.1, 0.9, -0.3], F: RELAX, e: [0.28, -0.5, -0.2] }),
};

// a reach to the thing the scene points the hands at (H.snTarget: an
// Object3D where the grip is), closed on it; computed once per playing
const reach = (F, e = [0.26, -0.45, -0.2]) => (H, side) => (H.snTarget ? H.holdPoseAt(side, H.snTarget, F, e) : null);

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
    duration: 0.85, marks: { grab: 0.28, pulled: 0.5 },
    keys: { R: [[0, '@rest'], [0.28, reach(GRIPB, [0.3, -0.35, -0.2]), 'out'], [0.34, reach(GRIPB, [0.3, -0.35, -0.2])], [0.5, 'sn_pullDownR', 'snap'], [0.85, '@rest']], L: [[0, '@rest'], [0.85, '@rest']] },
    view: [[0, {}], [0.28, { fwd: 0.12 }], [0.5, { fwd: 0.08, down: 0.04 }], [0.85, {}]],
  },
  sn_blow: {
    duration: 1.5, marks: { hit: 0.2, lowered: 1.2 },
    keys: { R: [[0, '@rest'], [0.12, 'sn_blowUpR', 'out'], [0.2, 'sn_blowDownR', 'snap'], [0.5, 'sn_catchR'], [1.2, 'sn_catchR'], [1.5, '@rest']], L: [[0, '@rest'], [0.35, 'sn_catchL'], [1.2, 'sn_catchL'], [1.5, '@rest']] },
    view: [[0, {}], [0.2, { fwd: 0.16, pitch: -0.1 }, 'snap'], [0.6, { fwd: 0.12, down: 0.2, pitch: -0.3 }], [1.2, { fwd: 0.05, down: 0.35, pitch: -0.42 }], [1.5, {}]],
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

