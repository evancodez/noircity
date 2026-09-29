// The hands' clips as data (docs/story/CONTRACTS.md §7.2, §14; lane 2's
// brief): each clip's length and its named marks (seconds from its start).
// Scenes and the brawl rules read them through hands.clip(name), never as
// numbers of their own.
//   duration   seconds        marks   { name: t } (a window: name / nameEnd)
//   hold       the clip holds its last pose until the next one (guard, block)
//   blocking   hands.busy while it runs (default true; a held pose is not)
// FOUNDATION: CONTRACTS §14's timings and lane 2's; the marks the brief does
// not name (reachGlass taken, sip drink, putDown down, ash tap, payWallet
// bill, searchBody found, showMatchbook shown / pocketed, the reload's) are
// the foundation's and keep their names when lane 2 retimes them.
import { HAND_POSES as HP } from './handPoses.js';
// a pose moved in its own frame (metres)
const shift = (P, d) => ({ ...P, p: P.p.map((v, i) => v + d[i]) });
// keys (lane 2): per hand [t, pose, ease?]: a pose name of handPoses.js,
// '@rest' (the set's rest), a pose def, or a pose function; eases 'io'
// (default), 'in', 'out', 'snap', 'lin'. props: [t, action, hand, arg]
// (Hands.propEvent).
// (round 2: the diner's clips - lightUp, drag, ash, reachGlass, sip,
// putDown, payWallet - are object first and live in clips/diner.js)
export const HAND_CLIPS = {
  // ---- the fist fight (scene 2; CONTRACTS §14) ---------------------------------------------
  // (view: the eye's own motion in the brawl, keys [t, { yaw, pitch, roll,
  // fwd, side, down }] in radians / metres, laid on the brawl view by the
  // Controller; the fists ride the eye)
  guard: { duration: 1.0, marks: {}, hold: true, blocking: false, keys: { R: [[0, 'guardR']], L: [[0, 'guardL']] } },
  jabL: {
    duration: 0.24, marks: { contact: 0.09 },
    keys: { R: [[0, 'guardR']], L: [[0, 'guardL'], [0.09, 'jabL', 'snap'], [0.13, 'jabL'], [0.24, 'guardL']] },
    view: [[0, {}], [0.09, { fwd: 0.02, yaw: 0.01 }], [0.24, {}]],
  },
  jabR: {
    duration: 0.24, marks: { contact: 0.09 },
    keys: { L: [[0, 'guardL']], R: [[0, 'guardR'], [0.09, 'jabR', 'snap'], [0.13, 'jabR'], [0.24, 'guardR']] },
    view: [[0, {}], [0.09, { fwd: 0.02, yaw: -0.01 }], [0.24, {}]],
  },
  heavyWind: {
    duration: 0.7, marks: { charged: 0.25 }, hold: true,
    keys: { R: [[0, 'guardR'], [0.25, 'windR'], [0.7, 'windR']], L: [[0, 'guardL'], [0.25, 'balanceL'], [0.7, 'balanceL']] },
    view: [[0, {}], [0.25, { yaw: -0.105, roll: -0.02, down: 0.02 }], [0.7, { yaw: -0.11, roll: -0.025, down: 0.025 }]],
  },
  heavyHit: {
    duration: 0.5, marks: { contact: 0.12 },
    keys: { R: [[0, 'windR'], [0.12, 'hitR', 'snap'], [0.26, 'hitFollowR'], [0.5, 'guardR']], L: [[0, 'balanceL'], [0.2, 'balanceL'], [0.5, 'guardL']] },
    view: [[0, { yaw: -0.105, roll: -0.02 }], [0.12, { yaw: 0.175, roll: 0.03, fwd: 0.04 }, 'snap'], [0.28, { yaw: 0.12, fwd: 0.03 }], [0.5, {}]],
  },
  block: { duration: 0.1, marks: { up: 0.1 }, hold: true, blocking: false, keys: { R: [[0, 'guardR'], [0.1, 'blockR', 'out']], L: [[0, 'guardL'], [0.1, 'blockL', 'out']] } },
  blockHit: {
    duration: 0.3, marks: {},
    keys: { R: [[0, 'blockR'], [0.05, (H) => shift(HP.blockR, [0, -0.015, 0.07]), 'snap'], [0.3, 'blockR']], L: [[0, 'blockL'], [0.05, (H) => shift(HP.blockL, [0, -0.015, 0.07]), 'snap'], [0.3, 'blockL']] },
    view: [[0, {}], [0.05, { pitch: 0.04, fwd: -0.03 }, 'snap'], [0.3, {}]],
  },
  slipL: {
    duration: 0.42, marks: { safe: 0.05, safeEnd: 0.3 },
    keys: { R: [[0, 'guardR'], [0.12, (H) => shift(HP.guardR, [0.05, 0.02, 0])], [0.42, 'guardR']], L: [[0, 'guardL'], [0.12, (H) => shift(HP.guardL, [0.05, 0.02, 0])], [0.42, 'guardL']] },
    view: [[0, {}], [0.12, { side: -0.45, down: 0.12, roll: 0.14 }, 'out'], [0.26, { side: -0.45, down: 0.12, roll: 0.14 }], [0.42, {}]],
  },
  slipR: {
    duration: 0.42, marks: { safe: 0.05, safeEnd: 0.3 },
    keys: { R: [[0, 'guardR'], [0.12, (H) => shift(HP.guardR, [-0.05, 0.02, 0])], [0.42, 'guardR']], L: [[0, 'guardL'], [0.12, (H) => shift(HP.guardL, [-0.05, 0.02, 0])], [0.42, 'guardL']] },
    view: [[0, {}], [0.12, { side: 0.45, down: 0.12, roll: -0.14 }, 'out'], [0.26, { side: 0.45, down: 0.12, roll: -0.14 }], [0.42, {}]],
  },
  hurt: {
    duration: 0.5, marks: { down: 0.05, up: 0.3 },
    keys: { R: [[0, 'guardR'], [0.05, 'hurtR', 'snap'], [0.3, 'hurtR'], [0.5, 'guardR']], L: [[0, 'guardL'], [0.05, 'hurtL', 'snap'], [0.3, 'hurtL'], [0.5, 'guardL']] },
    view: [[0, {}], [0.04, { yaw: 0.157, roll: 0.087 }, 'snap'], [0.2, { yaw: 0.12, roll: 0.06 }], [0.5, {}]],
    flash: 2,
  },
  grab: {
    duration: 0.3, marks: { taken: 0.2 },
    keys: { R: [[0, 'guardR'], [0.2, 'grabR', 'out'], [0.3, 'grabR']], L: [[0, 'guardL']] },
  },
  swingBottle: {
    duration: 0.45, marks: { contact: 0.2 },
    keys: { R: [[0, 'bottleUpR'], [0.2, 'bottleDownR', 'in'], [0.45, 'guardR']], L: [[0, 'guardL']] },
    view: [[0, {}], [0.2, { pitch: -0.05, fwd: 0.03 }], [0.45, {}]],
  },
  swingPlate: {
    duration: 0.45, marks: { contact: 0.2 },
    keys: { R: [[0, 'plateInR'], [0.2, 'plateOutR', 'snap'], [0.45, 'guardR']], L: [[0, 'guardL']] },
    props: [[0.2, 'drop', 'R']],
  },
  swingStool: {
    duration: 0.8, marks: { contact: 0.45 },
    keys: { R: [[0, 'guardR'], [0.2, 'stoolUpR'], [0.45, 'stoolHitR', 'in'], [0.8, 'guardR']], L: [[0, 'guardL'], [0.2, 'stoolUpL'], [0.45, 'stoolHitL', 'in'], [0.8, 'guardL']] },
    view: [[0, {}], [0.2, { yaw: -0.08 }], [0.45, { yaw: 0.14, fwd: 0.04 }, 'in'], [0.8, {}]],
  },
  searchBody: {
    duration: 2.0, marks: { found: 1.4 },
    keys: { R: [[0, 'downR'], [0.6, 'reachR'], [1.1, 'pocketR'], [1.4, 'pocketR'], [2.0, 'reachR']] },
  },
  showMatchbook: {
    duration: 2.4, marks: { shown: 0.8, pocketed: 2.0 },
    keys: { R: [[0, 'downR'], [0.8, 'showR'], [1.2, 'showR'], [1.6, 'showTurnR'], [1.8, 'showTurnR'], [2.2, 'pocketAwayR'], [2.4, 'downR']] },
  },
  // ---- the Tommy gun (fixes 2 and 3) -------------------------------------------------------
  tommyReload: { duration: 2.3, marks: { latch: 0.35, drumOut: 0.8, drumIn: 1.5, bolt: 1.8 } },
  tommyHold: { duration: 1.0, marks: {}, hold: true, blocking: false },
};

// round 2: my fists in the fight (each button an arm, the wind-up, the
// slips, the lean, the cover; src/player/clips/fight.js)
import { FIGHT_CLIPS } from './clips/fight.js';
Object.assign(HAND_CLIPS, FIGHT_CLIPS);
