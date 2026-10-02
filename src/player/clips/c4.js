import { HAND_POSES as HP, mirror, OPEN } from '../handPoses.js';

// [C4] The end of chapter II: the right hand that took the diner door's bar
// (the watcher's live grip on a bar, 'doorLiveR': player/clips/watcher.js
// DOOR.at, which scenes/fight/out.js keeps on the bar as it swings up) lets
// go of it and drops out of the frame.
//
// [C4] after the critic (M3): the loaded punch's wind-up. Version 4's drew
// the fist back and DOWN, out to the bottom corner of the frame - seen if you
// looked there, missed by a player watching his face. Here the fist comes
// back UP and IN, cocked by my jaw like a cross about to go (the forearm
// rising out of the bottom of the frame), in three snaps as it loads,
// trembling at full: it sits in the lower middle of the frame, under his
// face, where the eye already is; its ticks ride on it (Brawl.drawWind). The
// hard punch goes from there (c4hard*): across and into him as fight.js's.
const shift = (P, d) => ({ ...P, p: P.p.map((v, i) => v + d[i]), e: P.e ? P.e.map((v, i) => v + d[i] * 0.6) : P.e });
const lerpP = (a, b, k) => ({ ...b, p: a.p.map((v, i) => v + (b.p[i] - v) * k), f: a.f.map((v, i) => v + (b.f[i] - v) * k), b: a.b.map((v, i) => v + (b.b[i] - v) * k), e: a.e && b.e ? a.e.map((v, i) => v + (b.e[i] - v) * k) : b.e });
const gR = HP.guardR, gL = HP.guardL;
// cocked: the fist up by the jaw, nearer the eye than the guard (bigger in
// the frame), the back of the hand turned out, the elbow out and low
export const COCK_R = { frame: 'cam', p: [0.135, -0.118, -0.3], f: [-0.3, 0.78, -0.55], b: [0.55, 0.42, 0.72], F: gR.F, e: [0.3, -0.36, 0.02] };
const COCK_L = mirror(COCK_R);
const at = (side, k) => (side === 'R' ? lerpP(gR, COCK_R, k) : lerpP(gL, COCK_L, k));
const tremble = (P, side, t0) => {
  const out = [];
  const s = side === 'R' ? 1 : -1;
  for (let i = 0; i < 12; i++) out.push([t0 + (i + 1) * 0.05, shift(P, [s * 0.004 * (i % 2 ? 1 : -1), 0.003 * ((i % 3) - 1), 0.003 * (i % 2 ? -1 : 1)]), 'lin']);
  return out;
};
// (the three levels at 0.08, 0.28, 0.48 s into the clip, as fight.js's)
const windKeys = (side) => {
  const f = side === 'R' ? COCK_R : COCK_L, s = side === 'R' ? 1 : -1;
  const shake = (P, a) => shift(P, [s * a, -a * 0.6, a * 0.5]);
  return [[0, at(side, 0.3)], [0.08, at(side, 0.5), 'snap'], [0.18, shake(at(side, 0.55), 0.003), 'lin'], [0.28, at(side, 0.78), 'snap'],
    [0.33, shake(at(side, 0.8), -0.004), 'lin'], [0.38, shake(at(side, 0.82), 0.004), 'lin'], [0.43, shake(at(side, 0.84), -0.004), 'lin'], [0.48, f, 'snap'], ...tremble(f, side, 0.48)];
};
// the view leans back with the shoulder that cocks, by level
const windView = (s) => [[0, {}], [0.08, { yaw: -0.015 * s, pitch: 0.008, fwd: -0.008 }, 'snap'], [0.28, { yaw: -0.03 * s, roll: -0.007 * s, pitch: 0.016, fwd: -0.016 }, 'snap'],
  [0.48, { yaw: -0.045 * s, roll: -0.012 * s, pitch: 0.026, fwd: -0.026 }, 'snap'], [1.1, { yaw: -0.045 * s, roll: -0.012 * s, pitch: 0.026, fwd: -0.026 }]];
// the aimed end (Brawl.fistPose), as fight.js's hard punch
const aim = (kind) => (H, side) => (H.game.brawl && H.game.brawl.fistPose ? H.game.brawl.fistPose(side, kind, 1) : null) || (side === 'L' ? HP.jabL : HP.jabR);
const hard = (side, lv) => {
  const g = side === 'L' ? gL : gR, s = side === 'L' ? -1 : 1;
  const w = at(side, [0.5, 0.78, 1][lv - 1]), k = [0.6, 1, 1.5][lv - 1];
  return { duration: 0.34, marks: { contact: 0.08 }, blend: 0.05,
    keys: { [side]: [[0, w], [0.08, aim('hard'), 'snap'], [0.14, aim('follow')], [0.34, g]], [side === 'L' ? 'R' : 'L']: [[0, side === 'L' ? gR : gL]] },
    view: [[0, { yaw: -0.02 * s * k }], [0.08, { yaw: 0.035 * s * k, roll: 0.02 * s * k, fwd: [0.04, 0.075, 0.12][lv - 1] }, 'snap'], [0.18, { yaw: 0.02 * s * k, fwd: 0.04 * k }], [0.34, {}]], brush: side };
};

// [C4] after the critic (M2): the guest check read. Dot slides it across;
// my left hand (the right has the cigarette) takes it off the counter by its
// foot, lifts it before me - DINER at its head, her pencil, the right way up
// - holds it a moment, and lays it back where it lay; then I pay. Object
// first (Hands.js): the paper is placed, the hand solved onto it.
const Cf = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
const PINCH = { i: Cf(0.55, 0.7, 0.35), m: Cf(0.9, 1.1, 0.6), r: Cf(1.2, 1.3, 0.7), l: Cf(1.3, 1.3, 0.7), t: [0.75, 0.45, 0.45, 0.2, 0.15] };
const PINCH_OPEN = { ...OPEN, t: [0.4, 0.2, 0.2, 0.05, 0.05] };
const CK = (at, F = PINCH, e = [-0.24, -0.44, -0.14], extra = {}) => ({ o: 'guestCheck', at, F, e, ...extra });
const lies = (d = null) => ({ here: true, d });
// held up to be read (the eye's frame): a little left of the middle, a
// hand's length off, its face to me, its head up and tipped back a little
const READ = (dx = 0, dy = 0) => ({ frame: 'cam', p: [-0.05 + dx, -0.05 + dy, -0.27], up: [0.12, 0.2, 1], fwd: [0.02, -1, 0.18] });
const READ_CHECK = {
  duration: 3.7, marks: { taken: 0.58, up: 1.05, down: 3.0, put: 3.08 },
  keys: { L: [
    [0, '@rest'],
    [0.4, CK(lies(), PINCH_OPEN, undefined, { off: [-0.04, 0.035, 0.03] })],
    [0.52, CK(lies(), PINCH_OPEN, undefined, { off: [-0.006, 0.004, 0.004] }), 'out'],
    [0.58, CK(lies())],
    [0.75, CK(lies([0, 0.05, 0]))],
    [1.08, CK(READ(), PINCH, [-0.2, -0.42, -0.05], { ef: 'cam' }), 'out'],
    [2.55, CK(READ(0.004, 0.006), PINCH, [-0.2, -0.42, -0.05], { ef: 'cam' })],
    [2.85, CK(lies([0, 0.05, 0]))],
    [3.0, CK(lies())],
    [3.12, CK(lies(), PINCH_OPEN)],
    [3.3, CK(lies(), PINCH_OPEN, undefined, { off: [-0.04, 0.035, 0.03] }), 'in'],
    [3.7, '@rest'],
  ] },
  props: [[0.58, 'take', 'L', 'check'], [3.08, 'put', 'L']],
  // (the eyes go down to it on the counter, then follow it up)
  view: [[0, {}], [0.45, { pitch: -0.1 }], [1.0, {}]],
  brush: 'L',
};
// [C4] after the critic (m2): Ames's card, out of the matchbook, in my
// fingers - not hung in the air. The right hand brings it up with its back
// to me, turns it over (about its long edge, as the inspect view did) and
// holds it close under the street lamp: J. AMES, PRIVATE INVESTIGATIONS,
// HARBOR BLDG. RM 304, the red cross; E: into the coat (c4cardAway).
const CD = (at, F = PINCH, e = [0.2, -0.42, -0.06]) => ({ o: 'amesCard', at, F, e, ef: 'cam' });
const cardAt = (p, up, fwd) => ({ frame: 'cam', p, up, fwd });
export const CARD_FACE = cardAt([-0.03, -0.022, -0.165], [0, 0.25, 1], [0, -1, 0.25]);
const READ_CARD = {
  duration: 1.25, marks: { turned: 0.85 }, hold: true, blocking: false,
  keys: { R: [
    [0, 'downR'],
    [0.4, CD(cardAt([0.05, -0.12, -0.22], [0, 0, -1], [0, 1, 0]))],
    [0.7, CD(cardAt([0.0, -0.06, -0.2], [0, 1, 0], [0, 0, 1]))],
    [1.0, CD(CARD_FACE), 'out'],
    [1.25, CD(cardAt([-0.029, -0.021, -0.165], [0, 0.25, 1], [0, -1, 0.25]))],
  ] },
  props: [[0, 'take', 'R', 'amesCard']],
  brush: 'R',
};
const CARD_AWAY = {
  duration: 0.8, marks: { pocketed: 0.55 },
  keys: { R: [
    [0, CD(CARD_FACE)],
    [0.35, CD(cardAt([0.16, -0.3, -0.2], [0.3, 0.2, 1], [0, -1, 0.2]))],
    [0.55, 'pocketAwayR'],
    [0.8, 'downR'],
  ] },
  props: [[0.55, 'drop', 'R']],
  brush: 'R',
};
// a flat paper pinched at its foot between the thumb and the side of the
// index (as the bill), running out along the fingers, its face the palm's
// way: held up, the fingers are behind it and the thumb on its face
export const SOCKETS = {
  guestCheck: { bone: 'hand', p: [-0.018, -0.016, -0.082], r: [0, 0, Math.PI] },
  // (the card by its right edge between the thumb and the first fingers, its
  // length running on past the fingertips, its face the palm's way: the
  // fingers wrap only its edge)
  amesCard: { bone: 'hand', p: [-0.018, -0.016, -0.138], basis: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] },
};

export const CLIPS = {
  c4readCheck: READ_CHECK,
  c4readCard: READ_CARD, c4cardAway: CARD_AWAY,
  c4letGo: { duration: 0.42, blend: 0.05, marks: {}, keys: { R: [[0, 'doorLiveR'], [0.42, 'downR', 'in']] } },
  c4windL: { duration: 1.1, marks: { full: 0.48 }, hold: true, blocking: false, blend: 0.06, keys: { L: windKeys('L'), R: [[0, gR]] }, view: windView(-1), brush: 'L' },
  c4windR: { duration: 1.1, marks: { full: 0.48 }, hold: true, blocking: false, blend: 0.06, keys: { R: windKeys('R'), L: [[0, gL]] }, view: windView(1), brush: 'R' },
  c4hardL1: hard('L', 1), c4hardL2: hard('L', 2), c4hardL3: hard('L', 3),
  c4hardR1: hard('R', 1), c4hardR2: hard('R', 2), c4hardR3: hard('R', 3),
};
