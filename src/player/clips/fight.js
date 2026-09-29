// My fists in the fight (round 2, docs/story/FIGHT.md §1-2): each mouse
// button an arm. A click is a jab with that arm; a hold winds it up (the fist
// draws further back and lower as it charges, the view turns a little with
// the shoulder, up to 6 degrees; past 1.0 s the fist trembles), letting go
// throws the hard punch. SPACE with A / D slips, SPACE alone or with S leans
// back out of reach, SHIFT covers up. Clips as data (Hands plays them; the
// brawl reads their marks). Merged into HAND_CLIPS by handClips.js.
//   keys   per hand [t, pose, ease]; view [t, { yaw, pitch, roll, fwd, side, down }]
import { HAND_POSES as HP, mirror } from '../handPoses.js';

// a pose moved in its own frame (metres)
const shift = (P, d) => ({ ...P, p: P.p.map((v, i) => v + d[i]), e: P.e ? P.e.map((v, i) => v + d[i] * 0.6) : P.e });
const lerpP = (a, b, k) => ({ ...b, p: a.p.map((v, i) => v + (b.p[i] - v) * k), f: a.f.map((v, i) => v + (b.f[i] - v) * k), b: a.b.map((v, i) => v + (b.b[i] - v) * k), e: a.e && b.e ? a.e.map((v, i) => v + (b.e[i] - v) * k) : b.e });

// ---- the right arm ----------------------------------------------------------------------------
const gR = HP.guardR, gL = HP.guardL;
// wound up: at full charge the fist is back by the ribs, low, the knuckles
// still on him (the shoulder turned away)
const windFullR = { ...HP.windR, p: [0.26, -0.205, -0.33], e: [0.31, -0.46, -0.02] };
const cockR = lerpP(gR, windFullR, 0.25);
const windHalfR = lerpP(gR, windFullR, 0.62);
// the hard right: across from low right to high centre-left, turned over
const hardR = HP.hitR, followR = HP.hitFollowR;
// ---- the left arm: the right's mirror, in the left's own place
const windFullL = mirror(windFullR), cockL = mirror(cockR), windHalfL = mirror(windHalfR);
const hardL = mirror(hardR), followL = mirror(followR);

// the tremble of a fist held wound past 1.0 s: small snaps a few mm apart
const tremble = (P, side) => {
  const out = [];
  const s = side === 'R' ? 1 : -1;
  for (let i = 0; i < 12; i++) out.push([1.0 + (i + 1) * 0.05, shift(P, [s * 0.004 * (i % 2 ? 1 : -1), 0.003 * ((i % 3) - 1), 0.003 * (i % 2 ? -1 : 1)]), 'lin']);
  return out;
};
const windKeys = (side) => {
  const [g, c, h, f] = side === 'R' ? [gR, cockR, windHalfR, windFullR] : [gL, cockL, windHalfL, windFullL];
  return [[0, g], [0.2, c, 'out'], [0.55, h], [1.0, f], ...tremble(f, side)];
};
// the view turns with the shoulder that winds: right arm back, the view
// turns right (yaw -), up to 6 degrees (0.105 rad) at full charge
const windView = (s) => [[0, {}], [0.2, { yaw: -0.02 * s, down: 0.004 }, 'out'], [1.0, { yaw: -0.105 * s, roll: -0.02 * s, down: 0.02 }], [1.6, { yaw: -0.105 * s, roll: -0.02 * s, down: 0.02 }]];

export const FIGHT_CLIPS = {
  // (guard, jabL, jabR, block, blockHit, slipL / slipR, hurt, grab and the
  // swings are handClips.js's; these are round 2's)
  windL: { duration: 1.6, marks: { cocked: 0.2, full: 1.0 }, hold: true, blocking: false, blend: 0.08,
    keys: { L: windKeys('L'), R: [[0, gR]] }, view: windView(-1), brush: 'L' },
  windR: { duration: 1.6, marks: { cocked: 0.2, full: 1.0 }, hold: true, blocking: false, blend: 0.08,
    keys: { R: windKeys('R'), L: [[0, gL]] }, view: windView(1), brush: 'R' },
  // the hard punch: the fist snaps out from wherever the wind-up had it
  hardL: { duration: 0.5, marks: { contact: 0.12 }, blend: 0.04,
    keys: { L: [[0, windFullL], [0.12, hardL, 'snap'], [0.26, followL], [0.5, gL]], R: [[0, gR]] },
    view: [[0, { yaw: 0.06, roll: 0.015 }], [0.12, { yaw: -0.17, roll: -0.03, fwd: 0.05 }, 'snap'], [0.28, { yaw: -0.11, fwd: 0.03 }], [0.5, {}]], brush: 'L' },
  hardR: { duration: 0.5, marks: { contact: 0.12 }, blend: 0.04,
    keys: { R: [[0, windFullR], [0.12, hardR, 'snap'], [0.26, followR], [0.5, gR]], L: [[0, gL]] },
    view: [[0, { yaw: -0.06, roll: -0.015 }], [0.12, { yaw: 0.17, roll: 0.03, fwd: 0.05 }, 'snap'], [0.28, { yaw: 0.11, fwd: 0.03 }], [0.5, {}]], brush: 'R' },
  // cover up: both forearms before the face (held)
  cover: { duration: 0.1, marks: { up: 0.1 }, hold: true, blocking: false, keys: { R: [[0, gR], [0.1, 'blockR', 'out']], L: [[0, gL], [0.1, 'blockL', 'out']] } },
  // the slips: the head goes off the line, down and aside, and comes back
  // (safe .. safeEnd: his blow passes); 0.3 m, not a lunge
  slipL: { duration: 0.42, marks: { safe: 0.05, safeEnd: 0.3 },
    keys: { R: [[0, gR], [0.12, shift(gR, [0.04, 0.02, 0])], [0.42, gR]], L: [[0, gL], [0.12, shift(gL, [0.04, 0.02, 0])], [0.42, gL]] },
    view: [[0, {}], [0.12, { side: -0.3, down: 0.1, roll: 0.12 }, 'out'], [0.27, { side: -0.3, down: 0.1, roll: 0.12 }], [0.42, {}]] },
  slipR: { duration: 0.42, marks: { safe: 0.05, safeEnd: 0.3 },
    keys: { R: [[0, gR], [0.12, shift(gR, [-0.04, 0.02, 0])], [0.42, gR]], L: [[0, gL], [0.12, shift(gL, [-0.04, 0.02, 0])], [0.42, gL]] },
    view: [[0, {}], [0.12, { side: 0.3, down: 0.1, roll: -0.12 }, 'out'], [0.27, { side: 0.3, down: 0.1, roll: -0.12 }], [0.42, {}]] },
  // lean back out of reach: the head goes back over the heels
  leanBack: { duration: 0.5, marks: { safe: 0.06, safeEnd: 0.36 },
    keys: { R: [[0, gR], [0.14, shift(gR, [0.01, 0.04, 0.07])], [0.34, shift(gR, [0.01, 0.04, 0.07])], [0.5, gR]], L: [[0, gL], [0.14, shift(gL, [-0.01, 0.05, 0.07])], [0.34, shift(gL, [-0.01, 0.05, 0.07])], [0.5, gL]] },
    view: [[0, {}], [0.14, { fwd: -0.3, pitch: 0.06, down: 0.03 }, 'out'], [0.34, { fwd: -0.3, pitch: 0.06, down: 0.03 }], [0.5, {}]] },
  // a blow taken: the view snaps away from the side it came from
  hurtFromL: { duration: 0.5, marks: { down: 0.05, up: 0.3 },
    keys: { R: [[0, gR], [0.05, 'hurtR', 'snap'], [0.3, 'hurtR'], [0.5, gR]], L: [[0, gL], [0.05, 'hurtL', 'snap'], [0.3, 'hurtL'], [0.5, gL]] },
    view: [[0, {}], [0.04, { yaw: -0.16, roll: -0.09 }, 'snap'], [0.2, { yaw: -0.12, roll: -0.06 }], [0.5, {}]], flash: 2 },
  hurtFromR: { duration: 0.5, marks: { down: 0.05, up: 0.3 },
    keys: { R: [[0, gR], [0.05, 'hurtR', 'snap'], [0.3, 'hurtR'], [0.5, gR]], L: [[0, gL], [0.05, 'hurtL', 'snap'], [0.3, 'hurtL'], [0.5, gL]] },
    view: [[0, {}], [0.04, { yaw: 0.16, roll: 0.09 }, 'snap'], [0.2, { yaw: 0.12, roll: 0.06 }], [0.5, {}]], flash: 2 },
  hurtFront: { duration: 0.5, marks: { down: 0.05, up: 0.3 },
    keys: { R: [[0, gR], [0.05, 'hurtR', 'snap'], [0.3, 'hurtR'], [0.5, gR]], L: [[0, gL], [0.05, 'hurtL', 'snap'], [0.3, 'hurtL'], [0.5, gL]] },
    view: [[0, {}], [0.04, { pitch: 0.12, fwd: -0.06 }, 'snap'], [0.2, { pitch: 0.08 }], [0.5, {}]], flash: 2 },
  // shoved: back on my heels
  shoved: { duration: 0.6, marks: {},
    keys: { R: [[0, gR], [0.08, shift(gR, [0.02, 0.05, 0.08]), 'snap'], [0.6, gR]], L: [[0, gL], [0.08, shift(gL, [-0.02, 0.05, 0.08]), 'snap'], [0.6, gL]] },
    view: [[0, {}], [0.08, { pitch: 0.08, fwd: -0.05 }, 'snap'], [0.6, {}]] },
  // with something in the right hand: wound up over the shoulder (held),
  // then smashed down or thrown
  windItem: { duration: 1.6, marks: { cocked: 0.2, full: 1.0 }, hold: true, blocking: false,
    keys: { R: [[0, gR], [0.25, 'bottleUpR', 'out'], [1.0, shift(HP.bottleUpR, [0.03, 0.02, 0.05])]], L: [[0, gL]] },
    view: [[0, {}], [1.0, { yaw: -0.08, pitch: 0.02 }]], brush: 'R' },
  // (polish, the bug hunt: a stool or a chair wound up over the shoulder
  // put its seat right before the eye - the frame one black disc for the
  // whole wind-up. It is drawn back low on the right instead, the legs
  // trailing back and away out of the frame, the left fist up)
  windBig: { duration: 1.6, marks: { cocked: 0.2, full: 1.0 }, hold: true, blocking: false,
    keys: { R: [[0, gR], [0.3, { frame: 'cam', p: [0.3, -0.36, -0.2], f: [0.55, -0.25, 0.8], b: [0.8, 0.1, -0.55], F: HP.guardR.F, e: [0.36, -0.5, 0.05] }, 'out'],
      [1.0, { frame: 'cam', p: [0.34, -0.38, -0.14], f: [0.55, -0.25, 0.8], b: [0.8, 0.1, -0.55], F: HP.guardR.F, e: [0.4, -0.5, 0.1] }]], L: [[0, gL]] },
    view: [[0, {}], [1.0, { yaw: -0.08, pitch: 0.02 }]], brush: 'R' },
  // the wound stool comes round from low right, across, into him
  swingBig: { duration: 0.6, marks: { contact: 0.2 },
    keys: { R: [[0, { frame: 'cam', p: [0.34, -0.38, -0.14], f: [0.55, -0.25, 0.8], b: [0.8, 0.1, -0.55], F: HP.guardR.F, e: [0.4, -0.5, 0.1] }], [0.2, 'stoolHitR', 'in'], [0.6, gR]], L: [[0, gL]] },
    view: [[0, { yaw: -0.08 }], [0.2, { yaw: 0.14, fwd: 0.04 }, 'in'], [0.6, {}]], brush: 'R' },
  throwItem: { duration: 0.45, marks: { release: 0.1 },
    keys: { R: [[0, 'bottleUpR'], [0.1, 'plateOutR', 'snap'], [0.45, gR]], L: [[0, gL]] },
    view: [[0, { yaw: -0.08 }], [0.1, { yaw: 0.08, fwd: 0.04 }, 'snap'], [0.45, {}]], brush: 'R' },
  smashItem: { duration: 0.45, marks: { contact: 0.14 },
    keys: { R: [[0, 'bottleUpR'], [0.14, 'bottleDownR', 'in'], [0.45, gR]], L: [[0, gL]] },
    view: [[0, {}], [0.14, { pitch: -0.06, fwd: 0.05 }], [0.45, {}]], brush: 'R' },
  // down: the frame goes, the fists drop out of it
  downMe: { duration: 0.8, marks: {},
    keys: { R: [[0, gR], [0.3, 'hurtR'], [0.8, shift(HP.hurtR, [0.05, -0.25, 0.1])]], L: [[0, gL], [0.3, 'hurtL'], [0.8, shift(HP.hurtL, [-0.05, -0.25, 0.1])]] },
    view: [[0, {}], [0.8, { pitch: -0.3, down: 0.5, roll: 0.3 }]] },
};
