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
import { DF, GRIP, HAND_POSES as HP } from './handPoses.js';
// a pose moved in its own frame (metres)
const shift = (P, d) => ({ ...P, p: P.p.map((v, i) => v + d[i]) });
// keys (lane 2): per hand [t, pose, ease?]: a pose name of handPoses.js,
// '@rest' (the set's rest), a pose def, or a pose function (DF: reach a
// thing where it stands, hold a prop at a place); eases 'io' (default),
// 'in', 'out', 'snap', 'lin'. props: [t, action, hand, arg] (Hands.propEvent).
const ER = [0.3, -0.385, -0.16], EL = [-0.33, -0.385, -0.3];
// the lighter under the cigarette's tip (its top 1.2 cm below it: the tip at
// (0, -0.092, -0.15) in the eye's frame, the lighter just under the frame's
// bottom edge, its flame standing up into it)
const LIGHT = [[0.002, -0.133, -0.156], [0, 0.96, 0.28], [0.3, 0, 1]];
const EF = [0.14, -0.42, -0.06];
const pack = (off) => DF.at('cigarettePack', GRIP.pack, ER, off);
const lighter = (off, F = GRIP.lighter) => DF.at('lighter', F, ER, off);
const lighterUp = (F) => DF.cam('lighter', ...LIGHT, F, EF);
// the cigarette at the lips in the right hand's fingers
// (turned about the cigarette so the fingers point up and in, the wrist
// below and to the right of the mouth)
const cigLips = DF.cam('cigarette', [0.0, -0.088, -0.07], [0.02, -0.05, -1], [0.7, -0.7, 0], HP.cigLipsR ? HP.cigLipsR.F : null, [0.14, -0.42, -0.06]);

// the glass where it stands (or held off it), up at the lips (tilt 0 | 1;
// the hand on its left side, fingers round the front, the wrist below)
const glassAt = (off) => DF.at('glass', GRIP.glass, EL, off);
const glassUp = (k) => DF.cam('glass', [-0.005, -0.17 + 0.012 * k, -0.24], [0, 0.72 - 0.3 * k, 0.69 + 0.25 * k], [0, -1, 0], GRIP.glass, [-0.14, -0.42, -0.02]);
// the wallet up in front, turned to the left (open 0 | 1)
const walletUp = (k) => DF.cam('wallet', [0.035 - 0.02 * k, -0.14, -0.3], [-0.25 - 0.5 * k, 0.2, 0.95], [0, 1, 0.2], GRIP.wallet, [0.2, -0.45, -0.05]);

export const HAND_CLIPS = {
  // ---- the diner (scene 1) -------------------------------------------------------------
  // The right hand lifts the pack and taps it on the counter, puts it down,
  // pulls a cigarette out of it and puts it between the lips; then it takes
  // the lighter (it lies by the right hand, STORY) and brings it up under
  // the tip, the left hand comes up and cups the flame; the thumb flicks the
  // wheel, a flame, the tip catches, the lid snaps shut, the lighter goes
  // back on the counter. The cigarette stays in the lips, glowing low in
  // the frame (the first drag takes it into the right hand's fingers).
  lightUp: {
    duration: 3.2, marks: { tap: 0.5, lips: 1.2, spark: 1.9, flame: 2.0, lit: 2.5, shut: 2.9 },
    keys: {
      R: [[0, '@rest'], [0.28, pack()], [0.34, pack()], [0.44, pack([0, 0.05, 0.01])], [0.5, pack([0, 0.012, 0]), 'snap'], [0.57, pack([0, 0.03, 0])],
        [0.63, pack()], [0.76, 'pullR'], [0.8, 'pullR'], [1.1, cigLips], [1.22, cigLips],
        [1.42, lighter()], [1.47, lighter()], [1.72, lighterUp(GRIP.lighter)], [1.86, lighterUp(GRIP.lighter)], [1.92, lighterUp(GRIP.flick), 'snap'],
        [2.86, lighterUp(GRIP.flick)], [2.93, lighterUp(GRIP.lighter), 'snap'], [3.08, lighter([0, 0.012, 0])], [3.13, lighter()], [3.2, 'restR']],
      L: [[0, '@rest'], [1.55, '@rest'], [1.85, 'cupL'], [2.85, 'cupL'], [3.2, '@rest']],
    },
    props: [[0.34, 'take', 'R', 'cigarettePack'], [0.63, 'put', 'R'], [0.78, 'take', 'R', 'cigarette'], [1.2, 'toMouth', 'R'], [1.46, 'take', 'R', 'lighter'],
      [2.0, 'flame', 'R', 1], [2.5, 'tip', 'M', 'lit'], [2.9, 'flame', 'R', 0], [3.13, 'put', 'R']],
  },
  // the hand comes up (the cigarette to the lips if it is in the fingers),
  // the ember flares, the hand comes down with it; the smoke breathed out
  // (mark exhale) drifts up into the lamp's cone
  drag: {
    duration: 2.4, marks: { glow: 0.8, exhale: 1.6 },
    keys: { R: [[0, '@rest'], [0.45, cigLips], [1.0, cigLips], [1.5, 'cigRestR']] },
    props: [[0.5, 'toMouth', 'R'], [0.6, 'glow', 'M', 3], [1.02, 'glow', 'M', 1], [1.04, 'fromMouth', 'R']],
    brush: 'R',
  },
  // a tap over the ashtray: a fleck falls
  ash: {
    duration: 0.8, marks: { tap: 0.4 },
    keys: { R: [[0, '@rest'], [0.3, 'ashR'], [0.4, 'ashTapR', 'snap'], [0.5, 'ashR'], [0.8, 'cigRestR']] },
  },
  // the left hand takes the tumbler off the counter
  reachGlass: {
    duration: 0.8, marks: { taken: 0.5 },
    keys: { L: [[0, '@rest'], [0.44, glassAt()], [0.5, glassAt()], [0.8, glassAt([0, 0.05, 0.02])]] },
    props: [[0.5, 'take', 'L', 'glass']],
    brush: 'L',
  },
  // the glass comes up to the bottom centre of the frame, tilts toward the
  // eye so the amber runs to the rim, a third of it goes; down again (sip
  // takes the glass off the counter itself when it is not in the hand)
  sip: {
    duration: 2.0, marks: { tilt: 0.7, drink: 1.1, down: 1.6 },
    keys: { L: [[0, '@rest'], [0.28, glassAt()], [0.32, glassAt()], [0.7, glassUp(0)], [1.0, glassUp(1)], [1.25, glassUp(1)], [1.45, glassUp(0)], [1.62, glassAt([0, 0.01, 0])], [1.7, glassAt()], [2.0, '@rest']] },
    props: [[0.3, 'take', 'L', 'glass'], [1.1, 'fill', 'L', 1 / 3], [1.7, 'put', 'L']],
    brush: 'L',
  },
  // the glass back on the counter where it came from
  putDown: {
    duration: 0.7, marks: { down: 0.5 },
    keys: { L: [[0, glassAt([0, 0.05, 0.02])], [0.45, glassAt([0, 0.008, 0])], [0.5, glassAt()], [0.7, '@rest']] },
    props: [[0.5, 'put', 'L']],
    brush: 'L',
  },
  // the right hand brings the wallet from the coat, the left opens it: the
  // licence card shows, held still, turned to the left where a man two
  // stools down could see it; the left hand lays a bill on the counter; the
  // wallet shuts and goes back
  payWallet: {
    duration: 2.6, marks: { open: 0.8, shown: 1.3, shownEnd: 2.2, bill: 2.3 },
    keys: {
      R: [[0, '@rest'], [0.25, 'coatR'], [0.35, 'coatR'], [0.7, walletUp(0)], [0.85, walletUp(0)], [1.25, walletUp(1)], [2.2, walletUp(1)], [2.35, walletUp(0)], [2.6, 'coatR']],
      L: [[0, '@rest'], [0.55, '@rest'], [0.8, 'walletOpenL'], [1.0, 'walletOpenL'], [1.25, '@rest'], [2.1, '@rest'], [2.2, 'billL'], [2.3, 'billDownL'], [2.6, '@rest']],
    },
    props: [[0.35, 'take', 'R', 'wallet'], [0.82, 'open', 'R', 1], [2.3, 'bill', 'L'], [2.4, 'open', 'R', 0], [2.58, 'drop', 'R']],
    brush: 'R',
  },
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
