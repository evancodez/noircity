// My fists in the fight (the arcade pass, docs/story/FIGHT.md v3 §1, §2,
// §5): each mouse button an arm. A press throws that arm's JAB at once
// (contact 0.06 s after the press); held on, the same fist comes back into
// the WIND-UP (it draws further back and lower as it charges), and letting
// go throws the HARD PUNCH (contact 0.08 s after the release). A / D hop
// aside, S hops back (the eye moves: the Controller; these clips give the
// body's lean), SPACE held blocks. Every blow is AIMED: its end pose is
// found when it starts (Brawl.fistPose), the knuckles on his jaw as the eye
// sees him (or on his forearm, or in the air where he is not), so the fist
// arrives ON him and grows smaller as it goes out.
// Clips as data (Hands plays them; the brawl reads their marks). Merged
// into the hands' clips by Hands.js (export CLIPS, at the end).
//   keys   per hand [t, pose, ease]; view [t, { yaw, pitch, roll, fwd, side, down }]
//   blend  the blend from where the hand was (never under 0.05 s: §9)
import { HAND_POSES as HP, mirror } from '../handPoses.js';

// a pose moved in its own frame (metres)
const shift = (P, d) => ({ ...P, p: P.p.map((v, i) => v + d[i]), e: P.e ? P.e.map((v, i) => v + d[i] * 0.6) : P.e });
const lerpP = (a, b, k) => ({ ...b, p: a.p.map((v, i) => v + (b.p[i] - v) * k), f: a.f.map((v, i) => v + (b.f[i] - v) * k), b: a.b.map((v, i) => v + (b.b[i] - v) * k), e: a.e && b.e ? a.e.map((v, i) => v + (b.e[i] - v) * k) : b.e });

// ---- the right arm ----------------------------------------------------------------------------
const gR = HP.guardR, gL = HP.guardL;
// wound up: the fist back by the ribs, low, the knuckles still on him
const windFullR = { ...HP.windR, p: [0.25, -0.215, -0.32], e: [0.31, -0.46, -0.02] };
const cockR = lerpP(gR, windFullR, 0.35);
const windHalfR = lerpP(gR, windFullR, 0.7);
const windFullL = mirror(windFullR), cockL = mirror(cockR), windHalfL = mirror(windHalfR);

// the aimed poses (Brawl.fistPose): computed once when the blow starts
const aim = (kind, k = 1) => (H, side) => (H.game.brawl && H.game.brawl.fistPose ? H.game.brawl.fistPose(side, kind, k) : null) || (side === 'L' ? HP.jabL : HP.jabR);

// the tremble of a fist held wound: small snaps a few mm apart
const tremble = (P, side, t0) => {
  const out = [];
  const s = side === 'R' ? 1 : -1;
  for (let i = 0; i < 12; i++) out.push([t0 + (i + 1) * 0.05, shift(P, [s * 0.004 * (i % 2 ? 1 : -1), 0.003 * ((i % 3) - 1), 0.003 * (i % 2 ? -1 : 1)]), 'lin']);
  return out;
};
// [B8] the wind-up starts as the jab comes home (the hold at 0.12 s) and
// loads in three levels, at 0.2, 0.4 and 0.6 s of hold (0.08, 0.28, 0.48 s
// into this clip): at each the fist snaps back a step further (a third, two
// thirds, all the way to the ribs), trembling more as it goes; then held,
// trembling
const windAt = (side, k) => (side === 'R' ? lerpP(gR, windFullR, k) : lerpP(gL, windFullL, k));
const windKeys = (side) => {
  const f = side === 'R' ? windFullR : windFullL, s = side === 'R' ? 1 : -1;
  const shake = (P, a) => shift(P, [s * a, -a * 0.6, a * 0.5]);
  return [[0, windAt(side, 0.25)], [0.08, windAt(side, 0.45), 'snap'], [0.18, shake(windAt(side, 0.5), 0.003), 'lin'], [0.28, windAt(side, 0.76), 'snap'],
    [0.33, shake(windAt(side, 0.78), -0.004), 'lin'], [0.38, shake(windAt(side, 0.8), 0.004), 'lin'], [0.43, shake(windAt(side, 0.82), -0.004), 'lin'], [0.48, f, 'snap'], ...tremble(f, side, 0.48)];
};
// the view leans back a degree or two and turns a little with the shoulder
// that winds, by level
const windView = (s) => [[0, {}], [0.08, { yaw: -0.015 * s, pitch: 0.008, fwd: -0.008 }, 'snap'], [0.28, { yaw: -0.032 * s, roll: -0.007 * s, pitch: 0.018, fwd: -0.018 }, 'snap'],
  [0.48, { yaw: -0.05 * s, roll: -0.012 * s, pitch: 0.03, fwd: -0.03, down: 0.012 }, 'snap'], [1.1, { yaw: -0.05 * s, roll: -0.012 * s, pitch: 0.03, fwd: -0.03, down: 0.012 }]];

// the jab: out along the line to his jaw, snapped (0.06), held a moment on
// him, home by 0.20
const jab = (side) => {
  const g = side === 'L' ? gL : gR, s = side === 'L' ? -1 : 1;
  return { duration: 0.2, marks: { contact: 0.06 }, blend: 0.05,
    keys: { [side]: [[0, g], [0.06, aim('jab'), 'snap'], [0.09, aim('jab')], [0.2, g]], [side === 'L' ? 'R' : 'L']: [[0, side === 'L' ? gR : gL]] },
    view: [[0, {}], [0.06, { fwd: 0.035, yaw: -0.012 * s }, 'snap'], [0.2, {}]] };
};
// a fist that met his guard: it bounces back off the forearm (from where it
// struck) and comes home; the beat is wasted
const bounce = (side) => {
  const g = side === 'L' ? gL : gR, s = side === 'L' ? -1 : 1;
  return { duration: 0.45, marks: {}, blend: 0.05,
    keys: { [side]: [[0, aim('block')], [0.06, aim('bounce'), 'snap'], [0.2, g], [0.45, g]], [side === 'L' ? 'R' : 'L']: [[0, side === 'L' ? gR : gL]] },
    view: [[0, { fwd: 0.01 }], [0.06, { fwd: -0.02, yaw: 0.008 * s }, 'snap'], [0.26, {}]] };
};
// the hard punch, by level (1..3): from where that level drew it back,
// across and into him, turned over (0.08), through him a little, home by
// 0.34; the lunge of the view grows with the level
const hard = (side, lv = 3) => {
  const g = side === 'L' ? gL : gR, s = side === 'L' ? -1 : 1;
  const w = windAt(side, [0.45, 0.76, 1][lv - 1]), k = [0.6, 1, 1.5][lv - 1];
  return { duration: 0.34, marks: { contact: 0.08 }, blend: 0.05,
    keys: { [side]: [[0, w], [0.08, aim('hard'), 'snap'], [0.14, aim('follow')], [0.34, g]], [side === 'L' ? 'R' : 'L']: [[0, side === 'L' ? gR : gL]] },
    view: [[0, { yaw: -0.02 * s * k }], [0.08, { yaw: 0.035 * s * k, roll: 0.02 * s * k, fwd: [0.04, 0.075, 0.12][lv - 1] }, 'snap'], [0.18, { yaw: 0.02 * s * k, fwd: 0.04 * k }], [0.34, {}]], brush: side };
};
// the hop: the body leans with it, the fists sway against it (the eye's own
// move is the Controller's)
const hop = (dir) => ({ duration: 0.15, marks: {}, blend: 0.05,
  keys: { R: [[0, gR], [0.06, shift(gR, [-0.03 * dir, 0.015, 0.01]), 'out'], [0.15, gR]], L: [[0, gL], [0.06, shift(gL, [-0.03 * dir, 0.015, 0.01]), 'out'], [0.15, gL]] },
  view: [[0, {}], [0.05, { roll: -0.035 * dir, down: 0.025 }, 'out'], [0.15, {}]] });

export const FIGHT_CLIPS = {
  // the guard (held); blended into over 0.08 s from a block
  guard: { duration: 1.0, marks: {}, hold: true, blocking: false, blend: 0.08, keys: { R: [[0, 'guardR']], L: [[0, 'guardL']] } },
  jabL: jab('L'), jabR: jab('R'),
  bounceL: bounce('L'), bounceR: bounce('R'),
  windL: { duration: 1.1, marks: { full: 0.48 }, hold: true, blocking: false, blend: 0.06,
    keys: { L: windKeys('L'), R: [[0, gR]] }, view: windView(-1), brush: 'L' },
  windR: { duration: 1.1, marks: { full: 0.48 }, hold: true, blocking: false, blend: 0.06,
    keys: { R: windKeys('R'), L: [[0, gL]] }, view: windView(1), brush: 'R' },
  hardL: hard('L', 2), hardR: hard('R', 2),
  hardL1: hard('L', 1), hardL2: hard('L', 2), hardL3: hard('L', 3), hardR1: hard('R', 1), hardR2: hard('R', 2), hardR3: hard('R', 3),
  // the block: both forearms up before the face, up in 0.05, held
  block: { duration: 0.05, marks: { up: 0.05 }, hold: true, blocking: false, blend: 0.05, keys: { R: [[0, gR], [0.05, 'blockR', 'out']], L: [[0, gL], [0.05, 'blockL', 'out']] } },
  blockHit: { duration: 0.18, marks: {}, blend: 0.05,
    keys: { R: [[0, 'blockR'], [0.04, shift(HP.blockR, [0, -0.015, 0.07]), 'snap'], [0.18, 'blockR']], L: [[0, 'blockL'], [0.04, shift(HP.blockL, [0, -0.015, 0.07]), 'snap'], [0.18, 'blockL']] },
    view: [[0, {}], [0.04, { pitch: 0.035, fwd: -0.03 }, 'snap'], [0.18, {}]] },
  hopL: hop(-1), hopR: hop(1),
  hopB: { duration: 0.15, marks: {}, blend: 0.05,
    keys: { R: [[0, gR], [0.06, shift(gR, [0, 0.02, 0.03]), 'out'], [0.15, gR]], L: [[0, gL], [0.06, shift(gL, [0, 0.02, 0.03]), 'out'], [0.15, gL]] },
    view: [[0, {}], [0.05, { pitch: 0.03, down: 0.015 }, 'out'], [0.15, {}]] },
  // a blow taken: the view snaps away from the side it came from and is back
  // in about a quarter of a second
  hurtFromL: { duration: 0.34, marks: {}, blend: 0.05,
    keys: { R: [[0, gR], [0.05, 'hurtR', 'snap'], [0.16, 'hurtR'], [0.34, gR]], L: [[0, gL], [0.05, 'hurtL', 'snap'], [0.16, 'hurtL'], [0.34, gL]] },
    view: [[0, {}], [0.04, { yaw: -0.14, roll: -0.08 }, 'snap'], [0.14, { yaw: -0.09, roll: -0.05 }], [0.34, {}]], flash: 2 },
  hurtFromR: { duration: 0.34, marks: {}, blend: 0.05,
    keys: { R: [[0, gR], [0.05, 'hurtR', 'snap'], [0.16, 'hurtR'], [0.34, gR]], L: [[0, gL], [0.05, 'hurtL', 'snap'], [0.16, 'hurtL'], [0.34, gL]] },
    view: [[0, {}], [0.04, { yaw: 0.14, roll: 0.08 }, 'snap'], [0.14, { yaw: 0.09, roll: 0.05 }], [0.34, {}]], flash: 2 },
  hurtFront: { duration: 0.34, marks: {}, blend: 0.05,
    keys: { R: [[0, gR], [0.05, 'hurtR', 'snap'], [0.16, 'hurtR'], [0.34, gR]], L: [[0, gL], [0.05, 'hurtL', 'snap'], [0.16, 'hurtL'], [0.34, gL]] },
    view: [[0, {}], [0.04, { pitch: 0.1, fwd: -0.05 }, 'snap'], [0.14, { pitch: 0.06 }], [0.34, {}]], flash: 2 },
  // staggered: the block broken, back on my heels
  shoved: { duration: 0.5, marks: {}, blend: 0.05,
    keys: { R: [[0, gR], [0.08, shift(gR, [0.02, -0.05, 0.08]), 'snap'], [0.5, gR]], L: [[0, gL], [0.08, shift(gL, [-0.02, -0.05, 0.08]), 'snap'], [0.5, gL]] },
    view: [[0, {}], [0.08, { pitch: 0.08, fwd: -0.05, roll: 0.03 }, 'snap'], [0.5, {}]] },
  // E: what I look at, into the right hand (0.15)
  grab: { duration: 0.18, marks: { taken: 0.12 }, blend: 0.05,
    keys: { R: [[0, gR], [0.12, 'grabR', 'out'], [0.18, 'grabR']], L: [[0, gL]] } },
  // with something in the right hand: a click strikes with it
  swingBottle: { duration: 0.32, marks: { contact: 0.1 }, blend: 0.05,
    keys: { R: [[0, 'bottleUpR'], [0.1, 'bottleDownR', 'snap'], [0.32, gR]], L: [[0, gL]] },
    view: [[0, {}], [0.1, { pitch: -0.05, fwd: 0.04 }, 'snap'], [0.32, {}]] },
  swingPlate: { duration: 0.3, marks: { contact: 0.1 }, blend: 0.05,
    keys: { R: [[0, 'plateInR'], [0.1, 'plateOutR', 'snap'], [0.3, gR]], L: [[0, gL]] },
    view: [[0, {}], [0.1, { yaw: 0.04, fwd: 0.04 }, 'snap'], [0.3, {}]] },
  swingStool: { duration: 0.46, marks: { contact: 0.18 }, blend: 0.05,
    keys: { R: [[0, gR], [0.08, 'stoolUpR'], [0.18, 'stoolHitR', 'snap'], [0.46, gR]], L: [[0, gL], [0.08, 'stoolUpL'], [0.18, 'stoolHitL', 'snap'], [0.46, gL]] },
    view: [[0, {}], [0.08, { yaw: -0.06 }], [0.18, { yaw: 0.1, fwd: 0.05 }, 'snap'], [0.46, {}]] },
  // wound up with it: over the shoulder (a bottle, a plate, a mug) or low on
  // the right (a stool, a chair: its seat never before the eye), held
  windItem: { duration: 1.1, marks: { full: 0.48 }, hold: true, blocking: false, blend: 0.06,
    keys: { R: [[0, gR], [0.18, 'bottleUpR', 'out'], [0.48, shift(HP.bottleUpR, [0.03, 0.02, 0.05])]], L: [[0, gL]] },
    view: [[0, {}], [0.48, { yaw: -0.05, pitch: 0.02 }]], brush: 'R' },
  windBig: { duration: 1.1, marks: { full: 0.48 }, hold: true, blocking: false, blend: 0.06,
    keys: { R: [[0, gR], [0.2, { frame: 'cam', p: [0.3, -0.36, -0.2], f: [0.55, -0.25, 0.8], b: [0.8, 0.1, -0.55], F: HP.guardR.F, e: [0.36, -0.5, 0.05] }, 'out'],
      [0.48, { frame: 'cam', p: [0.34, -0.38, -0.14], f: [0.55, -0.25, 0.8], b: [0.8, 0.1, -0.55], F: HP.guardR.F, e: [0.4, -0.5, 0.1] }]], L: [[0, gL]] },
    view: [[0, {}], [0.48, { yaw: -0.05, pitch: 0.02 }]], brush: 'R' },
  // the wound stool comes round from low right, across, into him
  swingBig: { duration: 0.44, marks: { contact: 0.12 }, blend: 0.05,
    keys: { R: [[0, { frame: 'cam', p: [0.34, -0.38, -0.14], f: [0.55, -0.25, 0.8], b: [0.8, 0.1, -0.55], F: HP.guardR.F, e: [0.4, -0.5, 0.1] }], [0.12, 'stoolHitR', 'snap'], [0.44, gR]], L: [[0, gL]] },
    view: [[0, { yaw: -0.05 }], [0.12, { yaw: 0.1, fwd: 0.05 }, 'snap'], [0.44, {}]], brush: 'R' },
  throwItem: { duration: 0.34, marks: { release: 0.08 }, blend: 0.05,
    keys: { R: [[0, 'bottleUpR'], [0.08, 'plateOutR', 'snap'], [0.34, gR]], L: [[0, gL]] },
    view: [[0, { yaw: -0.05 }], [0.08, { yaw: 0.05, fwd: 0.04 }, 'snap'], [0.34, {}]], brush: 'R' },
  smashItem: { duration: 0.34, marks: { contact: 0.08 }, blend: 0.05,
    keys: { R: [[0, 'bottleUpR'], [0.08, 'bottleDownR', 'snap'], [0.34, gR]], L: [[0, gL]] },
    view: [[0, {}], [0.08, { pitch: -0.06, fwd: 0.05 }, 'snap'], [0.34, {}]], brush: 'R' },
  // down: the frame goes, the fists drop out of it
  downMe: { duration: 0.8, marks: {},
    keys: { R: [[0, gR], [0.3, 'hurtR'], [0.8, shift(HP.hurtR, [0.05, -0.25, 0.1])]], L: [[0, gL], [0.3, 'hurtL'], [0.8, shift(HP.hurtL, [-0.05, -0.25, 0.1])]] },
    view: [[0, {}], [0.8, { pitch: -0.3, down: 0.5, roll: 0.3 }]] },
};
// ---- [B8] things in either hand (briefs/B8_FIGHT.md §5): a thing in the
// left hand is used by the left button - its clips are the right hand's in a
// mirror; a stool or a chair is in both hands (its weight on the right, the
// left hand on it) and either button swings it
const flipPose = (P) => {
  if (P === gR) return gL;
  if (P === gL) return gR;
  if (typeof P === 'string') {
    const m = /^(.*)([RL])$/.exec(P);
    if (m && HP[m[1] + (m[2] === 'R' ? 'L' : 'R')]) return m[1] + (m[2] === 'R' ? 'L' : 'R');
    return HP[P] ? mirror(HP[P]) : P;
  }
  return P && typeof P === 'object' && P.p ? mirror(P) : P;
};
const flipKeys = (K) => (K || []).map((k) => [k[0], flipPose(k[1]), ...k.slice(2)]);
const flipView = (V) => V && V.map((k) => [k[0], Object.fromEntries(Object.entries(k[1]).map(([n, v]) => [n, n === 'yaw' || n === 'roll' || n === 'side' ? -v : v])), ...k.slice(2)]);
const flipClip = (c) => ({ ...c, keys: { L: flipKeys(c.keys.R), R: flipKeys(c.keys.L) }, view: flipView(c.view), brush: c.brush === 'R' ? 'L' : c.brush === 'L' ? 'R' : c.brush });
for (const n of ['grab', 'swingBottle', 'swingPlate', 'windItem', 'throwItem', 'smashItem']) FIGHT_CLIPS[n + 'L'] = flipClip(FIGHT_CLIPS[n]);
// the stool in both hands at rest: low on the right, its seat never before
// the eye, the left hand on it
// (held up before me, low, both hands on it: a stool by its seat's rim, a
// chair by the top of its back - its face toward him, seen, not in the way)
const BIG_R = { frame: 'cam', p: [0.2, -0.2, -0.46], f: [-0.3, 0.2, -0.93], b: [0.7, 0.7, 0], F: HP.guardR.F, e: [0.34, -0.46, -0.1] };
const BIG_L = { frame: 'cam', p: [-0.15, -0.21, -0.47], f: [0.3, 0.2, -0.93], b: [-0.7, 0.7, 0], F: HP.guardL.F, e: [-0.3, -0.47, -0.1] };
export const BIG = { R: BIG_R, L: BIG_L };
// (the stool's clips start from it and end on it: nothing jumps)
{
  const low = (P) => ({ ...P });
  const W = FIGHT_CLIPS.windBig.keys.R, S = FIGHT_CLIPS.swingBig.keys.R;
  FIGHT_CLIPS.windBig.keys = { R: [[0, BIG_R], ...W.slice(1)], L: [[0, BIG_L], [0.2, shift(BIG_L, [0.12, -0.08, 0.12]), 'out']] };
  FIGHT_CLIPS.swingBig.keys = { R: S, L: [[0, shift(BIG_L, [0.12, -0.08, 0.12])], [0.12, 'stoolHitL', 'snap'], [0.44, gL]] };
  const T = FIGHT_CLIPS.swingStool.keys;
  FIGHT_CLIPS.swingStool.keys = { R: [[0, BIG_R], ...T.R.slice(1)], L: [[0, BIG_L], ...T.L.slice(1)] };
  void low;
}
FIGHT_CLIPS.guardBig = { duration: 1.0, marks: {}, hold: true, blocking: false, blend: 0.1, keys: { R: [[0, BIG_R]], L: [[0, BIG_L]] } };
FIGHT_CLIPS.blockBig = { duration: 0.08, marks: { up: 0.08 }, hold: true, blocking: false, blend: 0.06, keys: { R: [[0, BIG_R], [0.08, 'stoolUpR', 'out']], L: [[0, BIG_L], [0.08, 'stoolUpL', 'out']] } };
for (const [n, dir] of [['hopLBig', -1], ['hopRBig', 1]]) FIGHT_CLIPS[n] = { ...FIGHT_CLIPS[n.slice(0, 4)], keys: { R: [[0, BIG_R]], L: [[0, BIG_L]] }, view: [[0, {}], [0.05, { roll: -0.035 * dir, down: 0.025 }, 'out'], [0.15, {}]] };
FIGHT_CLIPS.hopBBig = { ...FIGHT_CLIPS.hopB, keys: { R: [[0, BIG_R]], L: [[0, BIG_L]] } };

// ---- [B8] the way in (briefs/B8_FIGHT.md §1): off the stool, the stool
// beside me taken by its seat and sent skidding, the fists up --------------------------
// A hand on a thing that moves in the world (object first): the scene sets
// REACH.L / REACH.R to a function giving that hand's pose in the eye's frame
// where the thing is NOW (read every step, as the key 'b8reachL' is
// resolved); unset, the guard.
export const REACH = { L: null, R: null };
const live = (side) => {
  const g = side === 'L' ? gL : gR;
  const cur = () => (REACH[side] && REACH[side]()) || g;
  return { frame: 'cam', get p() { return cur().p; }, get f() { return cur().f; }, get b() { return cur().b; }, get F() { return cur().F; }, get e() { return cur().e; } };
};
export const POSES = { b8reachL: live('L'), b8reachR: live('R') };
// (below the frame: where the hands are while he comes up off the stool)
const lowR = shift(gR, [0.06, -0.36, 0.14]), lowL = shift(gL, [-0.06, -0.36, 0.14]);
FIGHT_CLIPS.b8_rise = {
  duration: 0.9, marks: { grab: 0.26, release: 0.44 }, blend: 0.05,
  keys: {
    L: [[0, lowL], [0.26, 'b8reachL', 'out'], [0.44, 'b8reachL', 'lin'], [0.74, gL, 'io'], [0.9, gL]],
    R: [[0, lowR], [0.36, shift(gR, [0.04, -0.2, 0.08]), 'io'], [0.72, gR, 'out'], [1.0, gR]],
  },
  // (the eyes go to the stool as the hand takes it, and back to him)
  view: [[0, {}], [0.24, { yaw: 0.34, pitch: -0.34, side: -0.08, down: 0.12 }, 'out'], [0.44, { yaw: 0.26, pitch: -0.24, side: -0.06, down: 0.08 }], [0.8, {}]],
  brush: 'L',
};

// (the hands' data files export CLIPS: Hands.js merges them)
export { FIGHT_CLIPS as CLIPS };
