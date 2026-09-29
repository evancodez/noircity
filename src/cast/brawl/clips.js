// The brawler's fight, as motion (round 2, docs/story/FIGHT.md): every clip
// Mack fights with, as pose functions on the Hood's joints (baked per
// costume by src/cast/castAnim.js, which merges BR_DEFS into its own) and
// their timing as data (BR_CLIPS, merged into src/cast/clips.js; the rules
// read the marks, never numbers of their own).
//
// Root space, as every cast clip: he faces +z, his left is +x, the eye
// stands 1.45 m before him. A clip that travels carries its root (rm(t) =
// [x, z]); its poses are written in the frame the clip started in, so a foot
// keyed in one place stays in that place on the floor while the root moves
// (rooted): feet stay where they are put.
//
// Both hands fight. Every attack has a hand (BR_ATTACKS) and its tell shows
// that hand first: the shoulder on that side drops and the elbow goes back
// beyond his outline before the fist comes round. A left-hand clip is the
// right one mirrored (mirrorPose), so the two read as the same man.
import { chainKeys, DEATH_BACK } from '../../enemies/HoodAnim.js';
import { NEUTRAL, mergePose, samplePoseKeys, ANKLE_Y } from '../../enemies/HoodRig.js';

const TAU = Math.PI * 2;
const A = ANKLE_Y;
const S = Math.sin;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const P = (over) => mergePose(NEUTRAL, over);
const wob = (t, T, k = 0) => 0.6 * S(TAU * t / T + k) + 0.3 * S(2 * TAU * t / T + 1.7 * k + 0.4) + 0.2 * S(3 * TAU * t / T + 2.3 * k + 1.1);
const keyed = (arr) => { const K = chainKeys(arr); return (t) => samplePoseKeys(K, t); };
function rooted(poseFn, rm) {
  return (t) => {
    const p = poseFn(t);
    const [x, z] = rm(t);
    for (const k of ['hipsPos', 'footL', 'footR', 'handTL', 'handTR']) if (p[k]) p[k] = [p[k][0] - x, p[k][1], p[k][2] - z, ...p[k].slice(3)];
    return p;
  };
}

// ---- mirroring: his left hand's blow is his right hand's, seen in a mirror
// (x -> -x; a turn's yaw and roll change sign; L and R change places; the
// feet's toe-out is already mirrored by the solver)
const SWAP = (k) => (k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k);
const ROT = new Set(['hips', 'spine', 'chest', 'neck', 'head', 'headRoot', 'shoulderL', 'shoulderR', 'handL', 'handR']);
const POS = new Set(['hipsPos', 'footL', 'footR', 'handTL', 'handTR', 'elbowPoleL', 'elbowPoleR', 'kneeL', 'kneeR']);
// (the trunk's turn is mirrored about his guard's own turn, not about
// square: he stands orthodox, turned to his right, and a left-hand blow
// winds from there - mirroring about square would first swing the whole
// trunk across before the blow began)
const TRUNK = new Set(['hips', 'spine', 'chest', 'neck', 'head']);
export function mirrorPose(p, about = null) {
  const o = {};
  for (const [k, v] of Object.entries(p)) {
    if (v == null) { o[SWAP(k)] = v; continue; }
    let w = v.slice();
    if (about && TRUNK.has(k) && about[k]) w = [w[0], 2 * about[k][1] - w[1], 2 * about[k][2] - w[2]];
    else if (ROT.has(k)) w = [w[0], -w[1], -w[2]];
    else if (POS.has(k)) w[0] = -w[0];
    else if (k === 'armL' || k === 'armR') w = [-w[0], w[1], w[2], -(w[3] || 0)];
    else if (k === 'rootYaw') w = [-w[0]];
    // (footRot, elbow, headLevel: the same on either side)
    const nk = k === 'hipsPos' || k === 'rootYaw' || k === 'headLevel' || k === 'headRoot' || ['hips', 'spine', 'chest', 'neck', 'head'].includes(k) ? k : SWAP(k);
    o[nk] = w;
  }
  return o;
}
const mirrorKeys = (keys) => keys.map(([t, p]) => [t, mirrorPose(p)]);

// ---- the guard: upright, chin down, fists at the cheeks, left foot and
// left shoulder forward (fix round B4's, the most dangerous shape in the game)
export const GUARD = {
  hipsPos: [0, 0.93, -0.04], hips: [0, -18, 0], spine: [-1, -5, 0], chest: [-4, -5, 0], neck: [8, 6, 0], head: [10, 12, 0], headLevel: [0.4], headRoot: [2, 0, 0],
  footL: [0.14, A, 0.22], footR: [-0.18, A, -0.22], footRotL: [0, 12, 0], footRotR: [0, 32, 0], kneeL: [0.3, 0, 1], kneeR: [-0.2, 0, 1],
  handTL: [0.155, 1.44, 0.25], handTR: [-0.13, 1.41, 0.19], elbowPoleL: [0.35, -1, 0.7], elbowPoleR: [-0.35, -1, 0.7],
  handL: [-15, -60, 10], handR: [-15, 60, -10], shoulderL: [0, 0, 4], shoulderR: [0, 0, -4],
};
const guardAt = (t) => {
  const w = S(TAU * t / 1.2), b = S(TAU * t / 0.6), v = wob(t, 2.4, 1);
  return { hipsPos: [0.028 * w, 0.93 + 0.008 * b, -0.04], hips: [0, -18 + 3 * w, -2 * w], chest: [-4 + b, -5 - 2 * w, 2 * w],
    handTL: [0.155 + 0.01 * v, 1.44 + 0.012 * b, 0.25], handTR: [-0.13, 1.41 + 0.01 * b, 0.19 + 0.01 * v], head: [10, 12 + 3 * w, 0] };
};
// his hands down, swaying: out on his feet
export const REEL = {
  hipsPos: [0, 0.9, -0.02], hips: [-4, -6, 0], spine: [4, -2, 0], chest: [6, 0, 0], neck: [18, 0, 0], head: [8, 0, 0], headLevel: [0],
  footL: [0.17, A, 0.1], footR: [-0.17, A, -0.1], footRotL: [0, 16, 0], footRotR: [0, 20, 0], kneeL: [0.3, 0, 1], kneeR: [-0.3, 0, 1],
  handTL: [0.3, 0.86, 0.06], handTR: [-0.3, 0.84, 0.02], elbowPoleL: [1, 0, -0.4], elbowPoleR: [-1, 0, -0.4], handL: [0, 0, 20], handR: [0, 0, -20],
  shoulderL: [0, 0, -4], shoulderR: [0, 0, 4],
};

const fight = (dur, keys, rm = null, base = GUARD) => {
  const K = keyed([[0, base], ...keys]);
  return () => ({ duration: dur, armSpace: 'root', pose: rm ? rooted(K, rm) : K, rootMotion: rm });
};
// the same blow from the other hand: the upper body mirrored, the feet kept
// in his own stance (left foot forward: a man does not switch his feet to
// throw a left), a key that returns to the guard returns to HIS guard;
// `feet`: keys of the feet's own for a blow that steps
const FEET = new Set(['footL', 'footR', 'footRotL', 'footRotR', 'kneeL', 'kneeR']);
const isBack = (p) => Object.keys(p).length >= 20;
const fightL = (dur, keys, rm = null, feet = {}) => {
  const mk = keys.map(([t, p]) => {
    if (isBack(p)) return [t, p];
    const m = mirrorPose(p, GUARD);
    for (const k of FEET) delete m[k];
    return [t, { ...m, ...(feet[t] || {}) }];
  });
  const K = keyed([[0, GUARD], ...mk]);
  return () => ({ duration: dur, armSpace: 'root', pose: rm ? rooted(K, rm) : K, rootMotion: rm });
};

// ---- stepping: a fighter's shuffle. Each foot is planted while the body
// passes over it (it moves back through the root's frame at exactly the
// walking speed, so it stands still on the floor), then lifts and is set
// down again ahead; the feet half a cycle apart; the guard held above.
// Authored at 1 m/s (the figure's time scale follows his real speed).
export const STEP = { speed: 1.0, T: 0.62, beta: 0.62, lift: 0.07 };
function shuffle(dir) {
  const [dx, dz] = dir;
  const { speed: v, T, beta, lift } = STEP;
  const stroke = v * T * beta;
  const foot = (p) => {
    // p 0..1: planted for beta of it (from +stroke/2 to -stroke/2 along the
    // way he goes), then swung back ahead with a lift
    if (p < beta) { const s = p / beta; return [stroke / 2 - s * stroke, 0]; }
    const s = (p - beta) / (1 - beta), e = s * s * (3 - 2 * s);
    return [-stroke / 2 + e * stroke, lift * S(Math.PI * s)];
  };
  return () => ({ duration: T, loop: true, armSpace: 'root', pose: (t) => {
    const p = (t / T) % 1;
    const [aL, hL] = foot(p), [aR, hR] = foot((p + 0.5) % 1);
    const g = guardAt(t * 2);
    const bob = 0.012 * Math.cos(TAU * p * 2);
    const sway = 0.02 * S(TAU * p);
    return P({ ...GUARD, ...g,
      hipsPos: [g.hipsPos[0] + sway * Math.abs(dz), 0.925 + bob, -0.04],
      footL: [GUARD.footL[0] + aL * dx, A + hL, GUARD.footL[2] + aL * dz], footR: [GUARD.footR[0] + aR * dx, A + hR, GUARD.footR[2] + aR * dz],
      footRotL: [8 * hL / lift, 12, 0], footRotR: [8 * hR / lift, 32, 0] });
  } });
}
// turning on the spot: the feet lifted and set down in turn, going nowhere
function pivot() {
  const T = 0.5;
  return () => ({ duration: T, loop: true, armSpace: 'root', pose: (t) => {
    const p = (t / T) % 1;
    const hL = p < 0.5 ? 0.05 * S(TAU * p) : 0, hR = p >= 0.5 ? 0.05 * S(TAU * (p - 0.5)) : 0;
    const g = guardAt(t);
    return P({ ...GUARD, ...g, footL: [GUARD.footL[0], A + hL, GUARD.footL[2]], footR: [GUARD.footR[0], A + hR, GUARD.footR[2]] });
  } });
}

// ---- his blows ------------------------------------------------------------------------------
// the jab: the left shoulder dips, the left fist flicks out straight
const JAB = [
  [0.2, { chest: [8, 4, -10], shoulderL: [0, 0, -8], handTL: [0.14, 1.14, 0.26], elbowPoleL: [1, -1.4, 0], hipsPos: [0, 0.89, -0.07] }],
  [0.3, { chest: [6, -14, -4], hips: [4, -22, 0], handTL: [0.12, 1.3, 0.42], footL: [0.14, A, 0.3] }],
  [0.38, { chest: [4, -24, 0], spine: [8, -8, 0], hipsPos: [0, 0.9, 0.04], handTL: [0.03, 1.46, 0.76], handL: [-80, 0, 30], elbowPoleL: [1, -0.4, 0], shoulderL: [0, 12, 0] }],
  [0.5, { handTL: [0.05, 1.42, 0.7] }],
  [0.7, { ...GUARD }],
];
// the straight right (the cross): the right heel turns, the hip turns in,
// the right fist goes straight down the middle
const CROSS = [
  [0.18, { chest: [6, -16, 6], hips: [2, -24, 0], shoulderR: [0, 0, 8], handTR: [-0.22, 1.3, 0.04], elbowPoleR: [-1, -0.8, -0.4], hipsPos: [0, 0.9, -0.1] }],
  [0.28, { chest: [6, -20, 6], handTR: [-0.26, 1.34, -0.02] }],
  [0.46, { chest: [6, 18, -4], hips: [4, 8, 0], spine: [6, 6, 0], hipsPos: [0, 0.9, 0.06], handTR: [0.02, 1.44, 0.8], handR: [-80, 0, -30], elbowPoleR: [-1, -0.4, 0], footRotR: [-18, 12, 0], shoulderR: [0, -12, 0] }],
  [0.58, { handTR: [0.0, 1.42, 0.72] }],
  [0.85, { ...GUARD }],
];
// the right hook: the right shoulder drops, the elbow goes back and out
// past his outline, then the fist comes round wide at head height
const HOOK = [
  [0.18, { chest: [8, -18, 10], shoulderR: [0, 0, 10], handTR: [-0.34, 1.24, 0.08], elbowPoleR: [-1, -0.1, -1] }],
  [0.3, { chest: [8, -26, 8], hips: [4, -24, 0], spine: [8, -8, 0], handTR: [-0.4, 1.3, 0.02], elbowPoleR: [-1, 0.1, -1], hipsPos: [0, 0.88, -0.08] }],
  [0.44, { chest: [6, -30, 4], handTR: [-0.46, 1.42, 0.02], elbowPoleR: [-1, 0.3, -0.7] }],
  [0.66, { chest: [6, 22, -4], hips: [4, 4, 0], spine: [8, 6, 0], hipsPos: [0, 0.9, 0.04], handTR: [0.04, 1.5, 0.6], elbowPoleR: [-1, 0.6, 0.1], handR: [-60, 0, 60], footRotR: [-20, 10, 0] }],
  [0.84, { chest: [8, 30, -4], handTR: [0.26, 1.42, 0.4], elbowPoleR: [-0.3, 0.3, 1] }],
  [1.0, { ...GUARD }],
];
// to the body: he dips, the right shoulder low, the fist comes up under
const BODY = [
  [0.2, { hipsPos: [0, 0.84, -0.06], hips: [8, -26, 0], spine: [10, -10, 0], chest: [10, -26, 12], shoulderR: [0, 0, 12], handTR: [-0.36, 1.02, 0.02], elbowPoleR: [-1, -0.2, -1] }],
  [0.34, { handTR: [-0.4, 0.98, -0.04], chest: [10, -32, 12] }],
  [0.58, { hipsPos: [0, 0.84, 0.08], hips: [10, 6, 0], spine: [12, 6, 0], chest: [12, 18, -2], handTR: [0.02, 1.16, 0.72], handR: [-40, 0, 70], elbowPoleR: [-1, 0.2, 0.2], footRotR: [-16, 10, 0] }],
  [0.74, { handTR: [0.12, 1.2, 0.56] }],
  [1.0, { ...GUARD }],
];
// the haymaker: both hands up and back over the right shoulder, the whole
// body wound to his right, he steps in; the blow comes down overhand
const HAY = [
  [0.2, { chest: [-6, -34, 8], spine: [-4, -14, 0], hips: [0, -26, 0], handTR: [-0.3, 1.52, -0.2], handTL: [-0.1, 1.5, -0.04], elbowPoleR: [-0.7, 0.4, 0.6], elbowPoleL: [0.4, 0.1, 1], neck: [8, 0, 0], head: [-10, 20, 0] }],
  [0.4, { chest: [-10, -44, 10], spine: [-6, -16, 0], handTR: [-0.34, 1.58, -0.3], handTL: [-0.16, 1.56, -0.14], hipsPos: [0, 0.92, -0.1] }],
  [0.7, { hipsPos: [0, 0.9, 0.12], footL: [0.14, A, 0.5], footRotL: [0, 10, 0], chest: [-12, -32, 10], spine: [-6, -12, 0], handTR: [-0.34, 1.6, -0.32] }],
  [0.95, { hipsPos: [0, 0.84, 0.3], hips: [16, 4, 0], spine: [16, 4, 0], chest: [18, 12, -6], neck: [22, 0, 0], head: [6, 0, 0],
    handTR: [0.04, 1.34, 0.86], elbowPoleR: [-1, 1, 0.3], handR: [-80, 0, 20], handTL: [0.28, 1.0, 0.34], elbowPoleL: [1, -0.5, -0.3], footR: [-0.16, A, -0.02], footRotR: [-25, 20, 0] }],
  [1.15, { hipsPos: [0, 0.82, 0.3], chest: [24, 20, -6], handTR: [0.16, 1.02, 0.7] }],
  [1.4, { ...GUARD, hipsPos: [0, 0.93, 0.26], footL: [0.14, A, 0.5], footR: [-0.18, A, 0.04] }],
];
const HAY_RM = (t) => [0, 0.3 * sstep(0.45, 0.95, t)];
// the rush: two quick steps in and the overhand right (he covers ~0.9 m)
const RUSH = [
  [0.12, { hipsPos: [0, 0.9, 0.0], chest: [8, -10, 0], spine: [8, 0, 0], handTR: [-0.22, 1.36, 0.1], handTL: [0.18, 1.38, 0.2] }],
  [0.3, { hipsPos: [0, 0.9, 0.3], footR: [-0.16, A + 0.1, 0.18], footRotR: [20, 20, 0] }],
  [0.42, { hipsPos: [0, 0.88, 0.45], footR: [-0.16, A, 0.46], footRotR: [0, 26, 0] }],
  [0.58, { hipsPos: [0, 0.9, 0.62], footL: [0.14, A + 0.1, 0.7], chest: [-8, -40, 10], handTR: [-0.34, 1.58, 0.3], handTL: [-0.1, 1.5, 0.5], elbowPoleR: [-0.7, 0.4, 0.6] }],
  [0.72, { hipsPos: [0, 0.9, 0.72], footL: [0.14, A, 0.92], chest: [-10, -44, 10], handTR: [-0.34, 1.6, 0.36] }],
  [0.95, { hipsPos: [0, 0.84, 0.92], hips: [16, 6, 0], spine: [16, 6, 0], chest: [18, 16, -6], neck: [22, 0, 0], head: [6, 0, 0],
    handTR: [0.04, 1.34, 1.56], elbowPoleR: [-1, 1, 0.3], handR: [-80, 0, 20], handTL: [0.28, 1.0, 1.1], elbowPoleL: [1, -0.5, -0.3], footR: [-0.16, A, 0.62], footRotR: [-25, 20, 0] }],
  [1.15, { hipsPos: [0, 0.82, 0.94], chest: [24, 30, -6], handTR: [0.16, 1.02, 1.4] }],
  [1.5, { ...GUARD, hipsPos: [0, 0.93, 0.9], footL: [0.14, A, 0.92], footR: [-0.18, A, 0.62], handTL: [0.155, 1.44, 1.15], handTR: [-0.13, 1.41, 1.09] }],
];
const RUSH_RM = (t) => [0, 0.9 * sstep(0.1, 0.95, t)];
// a feint: the right shoulder drops, the elbow goes back - and he does not
// throw: the hand comes back to the guard (it teaches the tell)
const FEINT = [
  [0.18, { chest: [8, -18, 10], shoulderR: [0, 0, 10], handTR: [-0.34, 1.24, 0.08], elbowPoleR: [-1, -0.1, -1], hipsPos: [0, 0.9, -0.06] }],
  [0.34, { chest: [8, -26, 8], hips: [4, -22, 0], handTR: [-0.38, 1.28, 0.04] }],
  [0.6, { ...GUARD, hipsPos: [0, 0.93, -0.02] }],
];
// the shove: both hands into my chest, a step in
const SHOVE = [
  [0.2, { hipsPos: [0, 0.9, -0.1], chest: [6, 0, 0], handTL: [0.22, 1.26, 0.12], handTR: [-0.22, 1.24, 0.1], elbowPoleL: [1, -1, 0], elbowPoleR: [-1, -1, 0], handL: [-60, 0, 90], handR: [-60, 0, -90] }],
  [0.42, { hipsPos: [0, 0.88, 0.18], hips: [8, 0, 0], spine: [10, 0, 0], chest: [8, 0, 0], footL: [0.14, A, 0.52], handTL: [0.2, 1.3, 0.86], handTR: [-0.2, 1.28, 0.84] }],
  [0.56, { handTL: [0.2, 1.3, 0.82], handTR: [-0.2, 1.28, 0.8] }],
  [0.9, { ...GUARD, hipsPos: [0, 0.93, 0.2], footL: [0.14, A, 0.52], footR: [-0.18, A, 0.0] }],
];
const SHOVE_RM = (t) => [0, 0.22 * sstep(0.1, 0.5, t)];
// the bottle's neck, thrust (it is in the right fist, held low): drawn back
// beside the shoulder, the body wound to his right, then driven at my chest
const THRUST = [
  [0.14, { hips: [4, -24, 0], chest: [6, -26, 4], spine: [6, -8, 0], handTR: [-0.4, 1.3, -0.06], elbowPoleR: [-1, -0.2, -0.5], handR: [-40, 0, 0], hipsPos: [0, 0.9, -0.1] }],
  [0.28, { chest: [4, -26, 6], hips: [4, -26, 0], handTR: [-0.42, 1.28, -0.12], hipsPos: [0, 0.89, -0.12] }],
  [0.5, { hipsPos: [0, 0.86, 0.14], hips: [8, 4, 0], chest: [12, 12, 0], spine: [10, 4, 0], handTR: [-0.02, 1.18, 0.84], elbowPoleR: [-1, -0.3, 0], handR: [-80, 0, 0], footL: [0.14, A, 0.38] }],
  [0.62, { handTR: [0.0, 1.16, 0.8] }],
  [0.9, { ...GUARD, handTR: [-0.22, 1.08, 0.22], handR: [-20, 0, -10] }],
];
// the throw: a plate or a mug from his right hand, side-arm (release 0.5)
const THROW = [
  [0.2, { chest: [0, -40, 6], hips: [0, -30, 0], spine: [0, -12, 0], handTR: [-0.5, 1.3, -0.3], elbowPoleR: [-1, 0, -0.4], handR: [-10, 0, 60], hipsPos: [0, 0.92, -0.1] }],
  [0.34, { chest: [0, -36, 8], handTR: [-0.56, 1.32, -0.36] }],
  [0.56, { chest: [6, 16, -6], hips: [4, 6, 0], spine: [6, 6, 0], handTR: [0.1, 1.36, 0.7], elbowPoleR: [-1, 0, 0], handR: [-40, 0, -40], footRotR: [-16, 10, 0], hipsPos: [0, 0.9, 0.06] }],
  [0.72, { handTR: [0.22, 1.24, 0.56] }],
  [1.0, { ...GUARD }],
];
// a thing off the counter at his right (take 0.35): he turns, reaches, and
// comes back to face me with it low in the right hand
const TAKE = [
  [0.24, { hips: [8, -48, 0], chest: [14, -24, 0], spine: [10, -10, 0], handTR: [-0.62, 1.08, 0.12], elbowPoleR: [-1, -0.6, 0.3], handR: [-60, 0, 0], footR: [-0.34, A, -0.08] }],
  [0.35, { handTR: [-0.72, 1.02, 0.18], chest: [18, -28, 0] }],
  [0.7, { ...GUARD, handTR: [-0.24, 1.1, 0.2], handR: [-20, 0, -10] }],
];
// the bottle, the first time: off the counter at his right (take 0.35),
// broken on its edge (break 0.75), the neck held low and out, the thrust
// (contact 1.6)
const BOTTLE = [
  [0.24, { hips: [8, -48, 0], chest: [14, -24, 0], spine: [10, -10, 0], handTR: [-0.62, 1.08, 0.12], elbowPoleR: [-1, -0.6, 0.3], handR: [-60, 0, 0], footR: [-0.34, A, -0.08] }],
  [0.35, { handTR: [-0.72, 1.02, 0.18], chest: [18, -28, 0] }],
  [0.55, { hips: [4, -40, 0], chest: [-4, -20, 10], handTR: [-0.3, 1.56, 0.02], elbowPoleR: [-1, 0.2, -0.3], handR: [30, 0, 0], head: [-6, -20, 0] }],
  [0.75, { hips: [10, -60, 0], chest: [22, -30, -4], spine: [12, -12, 0], handTR: [-0.68, 1.02, 0.2], elbowPoleR: [-1, 0.2, 0.3], handR: [-50, 0, 0] }],
  [1.0, { hips: [4, -16, 0], chest: [8, -6, 0], spine: [8, -4, 0], footR: [-0.2, A, -0.24], handTR: [-0.44, 0.98, 0.24], elbowPoleR: [-1, -0.6, -0.2], handR: [-20, 0, -30], head: [-2, 10, 0] }],
  [1.3, { chest: [6, -22, 2], handTR: [-0.4, 1.02, -0.06], hipsPos: [0, 0.88, -0.1] }],
  [1.6, { hipsPos: [0, 0.86, 0.14], hips: [8, 14, 0], chest: [12, 24, 0], spine: [10, 8, 0], handTR: [-0.02, 1.18, 0.84], elbowPoleR: [-1, -0.3, 0], handR: [-80, 0, 0], footL: [0.14, A, 0.38] }],
  [1.75, { handTR: [0.0, 1.16, 0.8] }],
  [2.0, { ...GUARD, handTR: [-0.22, 1.08, 0.22] }],
];
const BOTTLE_RM = (t) => [-0.38 * sstep(0, 0.3, t) + 0.38 * sstep(0.8, 1.1, t), 0];
// the stool: he stoops for it (take 0.5), both hands on its legs, up
// over his right shoulder; then it comes round flat from his right
// (contact 0.95) and he lets it drop (drop 1.2)
const STOOL_UP = [
  [0.25, { hipsPos: [0, 0.62, 0.02], hips: [40, -20, 0], spine: [20, 0, 0], chest: [14, 0, 0], neck: [10, 0, 0], footL: [0.18, A, 0.24], footR: [-0.2, A, -0.18], kneeL: [0.4, 0, 1], kneeR: [-0.3, 0, 1],
    handTL: [0.12, 0.5, 0.5], handTR: [-0.2, 0.5, 0.5], elbowPoleL: [1, -0.3, 0.3], elbowPoleR: [-1, -0.3, 0.3] }],
  [0.5, { handTL: [0.1, 0.46, 0.52], handTR: [-0.22, 0.46, 0.52] }],
  [0.8, { ...GUARD, hipsPos: [0, 0.92, -0.06], hips: [0, -30, 0], chest: [-6, -30, 6], handTL: [-0.06, 1.46, 0.02], handTR: [-0.36, 1.56, -0.12], elbowPoleL: [1, -0.4, 0.4], elbowPoleR: [-1, 0.2, -0.3] }],
];
const STOOL_SWING = [
  [0.2, { chest: [-6, -44, 8], spine: [-4, -16, 0], hips: [0, -30, 0], handTL: [-0.16, 1.5, -0.06], handTR: [-0.44, 1.58, -0.2], elbowPoleL: [1, -0.2, 0.6], elbowPoleR: [-1, 0.3, -0.3], hipsPos: [0, 0.92, -0.1] }],
  [0.55, { chest: [-8, -50, 10], handTL: [-0.22, 1.54, -0.1], handTR: [-0.5, 1.62, -0.26] }],
  [0.95, { hipsPos: [0, 0.86, 0.2], hips: [10, 20, 0], spine: [12, 12, 0], chest: [14, 34, -6], footL: [0.14, A, 0.46], handTL: [0.3, 1.3, 0.62], handTR: [0.0, 1.34, 0.72], elbowPoleL: [1, 0, 0.3], elbowPoleR: [-1, 0, 0.3] }],
  [1.2, { chest: [18, 44, -6], handTL: [0.44, 1.1, 0.4], handTR: [0.2, 1.1, 0.5] }],
  [1.6, { ...GUARD, hipsPos: [0, 0.93, 0.18], footL: [0.14, A, 0.46], footR: [-0.18, A, -0.02] }],
];

// ---- reactions ---------------------------------------------------------------------------------
const HIT_HEAD_L = [
  [0.06, { neck: [4, -18, -12], head: [-16, -38, -18], chest: [2, -16, 6], handTL: [0.22, 1.1, 0.3], hipsPos: [-0.03, 0.9, -0.08] }],
  [0.18, { neck: [6, -14, -10], head: [-10, -30, -12], chest: [4, -18, 6] }],
  [0.4, { ...GUARD }],
];
const HIT_BODY = [
  [0.08, { hipsPos: [0, 0.84, -0.12], hips: [20, -10, 0], spine: [24, 0, 0], chest: [18, 0, 0], neck: [24, 0, 0], head: [8, 0, 0],
    handTL: [0.08, 1.0, 0.2], handTR: [-0.1, 0.98, 0.2], elbowPoleL: [1, -0.4, 0.3], elbowPoleR: [-1, -0.4, 0.3] }],
  [0.22, { hipsPos: [0, 0.85, -0.12], spine: [20, 0, 0] }],
  [0.5, { ...GUARD }],
];
// knocked back along the line of the blow: two stumbling steps back, the
// arms thrown out, the head back; authored for 1 m (the rules scale it to
// 0.6 .. 1.5 m). The feet are set down where they land and stay there.
const KNOCK = [
  [0.08, { hipsPos: [0, 0.92, -0.12], hips: [-10, -8, 0], spine: [-8, 0, 0], chest: [-14, 6, 0], neck: [-10, 0, 0], head: [-24, 10, 6],
    handTL: [0.42, 1.34, 0.1], handTR: [-0.4, 1.3, 0.0], elbowPoleL: [1, -0.2, 0], elbowPoleR: [-1, -0.2, 0], footR: [-0.18, A + 0.08, -0.3] }],
  [0.22, { hipsPos: [0, 0.9, -0.42], footR: [-0.2, A, -0.62], footRotR: [0, 30, 0] }],
  [0.4, { hipsPos: [0, 0.9, -0.74], hips: [-6, -8, 0], chest: [-8, 4, 0], footL: [0.16, A + 0.09, -0.4] }],
  [0.54, { hipsPos: [0, 0.9, -0.92], footL: [0.16, A, -0.84], footRotL: [0, 12, 0] }],
  [0.8, { ...GUARD, hipsPos: [0, 0.93, -1.0], footL: [0.14, A, -0.8], footR: [-0.18, A, -1.24], handTL: [0.155, 1.44, -0.75], handTR: [-0.13, 1.41, -0.81] }],
];
const KNOCK_RM = (t) => [0, -1.0 * sstep(0.02, 0.62, t)];
// his back into something (a stool, the counter, the jukebox, the pie case,
// a table): the stop, the head snapped back against it, a hand grabbing
// behind, then off it; authored with the back arriving at 0.15 m behind
// the root; the rules put the thing there
const INTO = [
  [0.1, { hipsPos: [0, 0.88, -0.12], hips: [-16, 0, 0], spine: [-10, 0, 0], chest: [-18, 0, 0], neck: [-18, 0, 0], head: [-30, 12, 0],
    handTL: [0.58, 1.2, -0.3], handTR: [-0.56, 1.1, -0.36], elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0, 0], footR: [-0.2, A, -0.3] }],
  [0.3, { hipsPos: [0, 0.84, -0.14], chest: [-12, 0, 0], head: [-20, 14, 6] }],
  [0.7, { hipsPos: [0, 0.88, -0.02], chest: [2, 0, 0], spine: [4, 0, 0], head: [4, 0, 0], handTL: [0.3, 1.2, 0.1], handTR: [-0.3, 1.14, 0.06] }],
  [1.1, { ...GUARD, hipsPos: [0, 0.93, 0.06], footL: [0.14, A, 0.3], footR: [-0.18, A, -0.14] }],
];
const INTO_RM = (t) => [0, 0.14 * sstep(0.35, 1.0, t)];
// down among the stools: he goes down with them, then up off one knee
const INTO_STOOLS = [
  [0.1, { hipsPos: [0, 0.86, -0.14], hips: [-14, 0, 0], chest: [-16, 0, 0], head: [-26, 10, 0], handTL: [0.6, 1.2, -0.3], handTR: [-0.6, 1.14, -0.3], elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0, 0] }],
  [0.5, { hipsPos: [0.05, 0.36, -0.36], hips: [-20, 10, 20], spine: [8, 0, 0], chest: [14, 0, 0], neck: [10, 0, 0], head: [0, 0, 0],
    handTL: [0.5, 0.25, -0.2], handTR: [-0.5, 0.18, -0.5], elbowPoleL: [1, 0.3, 0], elbowPoleR: [-1, 0.3, 0], footL: [0.2, A, 0.3], footR: [-0.2, A + 0.05, 0.1], kneeL: [0.4, 0.5, 1] }],
  [1.1, { hipsPos: [0, 0.5, -0.2], hips: [12, 0, 0], spine: [20, 0, 0], chest: [10, 0, 0], neck: [10, 0, 0], head: [-10, 0, 0],
    footL: [0.16, A, 0.26], footR: [-0.16, 0.1, -0.4], footRotR: [-60, 8, 0], kneeR: [-0.1, -0.5, 1], handTL: [0.2, 0.62, 0.22], handTR: [-0.3, 0.3, 0.0], elbowPoleL: [1, -0.5, 0] }],
  [1.8, { ...GUARD, hipsPos: [0, 0.93, 0.0], footL: [0.14, A, 0.26], footR: [-0.18, A, -0.2] }],
];
// the stun: arms drop, he sways on his heels (the opening)
const STUN = [
  [0.15, { hipsPos: [0, 0.92, -0.1], hips: [-6, -10, 0], chest: [-8, 0, 0], neck: [4, 0, 0], head: [-18, 6, 8],
    handTL: [0.3, 0.9, 0.08], handTR: [-0.3, 0.9, 0.04], elbowPoleL: [1, 0, -0.5], elbowPoleR: [-1, 0, -0.5], handL: [0, 0, 20], handR: [0, 0, -20] }],
  [0.5, { hipsPos: [0.04, 0.93, -0.13], hips: [-8, -6, 4], chest: [-10, 4, -4], head: [-22, -8, -10], handTL: [0.32, 0.88, 0.02] }],
  [0.85, { hipsPos: [-0.04, 0.92, -0.08], hips: [-4, -14, -4], chest: [-6, -4, 6], head: [-14, 10, 12], handTR: [-0.32, 0.9, 0.08] }],
  [1.3, { ...GUARD }],
];
// out on his feet: the hands down, the head lolling, swaying on soft knees
function reel() {
  const T = 2.2;
  return () => ({ duration: T, loop: true, armSpace: 'root', pose: (t) => {
    const w = S(TAU * t / T), v = wob(t, T, 0.7), b = S(TAU * t / (T / 2));
    return P({ ...REEL, hipsPos: [0.05 * w, 0.9 + 0.012 * b, -0.02 + 0.02 * v], hips: [-4 + 2 * v, -6 + 6 * w, 4 * w], chest: [6 + 3 * b, 4 * v, -5 * w], neck: [18 + 4 * v, 0, 0],
      head: [8 + 8 * v, 14 * w, 10 * w], handTL: [0.3 + 0.03 * w, 0.86 + 0.02 * b, 0.06 + 0.04 * v], handTR: [-0.3 + 0.03 * w, 0.84 - 0.02 * b, 0.02 - 0.04 * v] });
  } });
}
// reeling back toward the glass: stumbling steps backward, uneven, the arms
// hanging (authored at 1 m/s backward; the time scale follows)
function reelBack() {
  const T = 0.9;
  const step = shuffle([0, -1])();
  return () => ({ duration: T, loop: true, armSpace: 'root', pose: (t) => {
    const u = (t / T) * STEP.T;
    const p = step.pose(u);
    const w = S(TAU * t / T), v = wob(t, T, 0.3);
    return { ...p, ...{ hipsPos: [0.06 * w, p.hipsPos[1] - 0.02, p.hipsPos[2]], hips: [-6, -4 + 8 * w, 5 * w], spine: [6, 0, 0], chest: [8 + 4 * v, 0, -6 * w], neck: [20, 0, 0], head: [10 + 6 * v, 16 * w, 12 * w], headLevel: [0],
      handTL: [0.32 + 0.04 * w, 0.84, 0.08], handTR: [-0.32 + 0.04 * w, 0.82, 0.02], elbowPoleL: [1, 0, -0.4], elbowPoleR: [-1, 0, -0.4], handL: [0, 0, 20], handR: [0, 0, -20] } };
  } });
}
// a jab while he is out on his feet: the head goes, he sways, he stays up
const SWAY = [
  [0.08, { ...REEL, neck: [10, -20, -14], head: [-14, -36, -20], chest: [0, -12, 8], hipsPos: [-0.05, 0.89, -0.08] }],
  [0.4, { ...REEL, hipsPos: [0.04, 0.9, -0.04], head: [4, 10, 8] }],
  [0.8, { ...REEL }],
];
// he comes round: shakes his head, the hands come up
const COME_ROUND = [
  [0.3, { ...REEL, head: [10, -20, 0], neck: [16, 0, 0] }],
  [0.55, { head: [10, 20, 0] }],
  [0.8, { head: [4, -10, 0], hipsPos: [0, 0.92, -0.04] }],
  [1.3, { ...GUARD }],
];

// reeling past a stool he catches at it: a hand down onto its seat, the
// trunk leaning over to it (an upper-body overlay on the reeling legs)
const CATCH = [
  [0.0, REEL],
  [0.22, { ...REEL, chest: [14, 0, 14], spine: [10, 0, 8], neck: [22, 0, 0], head: [12, 10, 6], handTL: [0.46, 0.8, 0.06], elbowPoleL: [1, 0.2, -0.3], handL: [60, 0, 20] }],
  [0.55, { chest: [12, 0, 12], handTL: [0.46, 0.79, 0.02] }],
  [0.9, { ...REEL }],
];
// ---- the last blow: out through the window, from wherever he stands with
// his back to the glass (the rules put him on the finish spot: the wall's
// inner face 0.40 m behind his root, the wall 0.25 thick, the sill 0.75 over
// the floor, the pavement outside level with the floor). The backs of his
// thighs meet the sill; his shoulders go into the glass (glass 0.34); he
// folds backwards over the sill, his legs follow over it (never through
// it: the feet pass the wall 0.35 m and more over the sill), and he lands
// on his back on the pavement, his hips 0.9 m out, his head beyond (land
// 1.0). The root follows the hips out (the collider, the search).
export const KO_OUT = { wall: 0.40, thick: 0.25, sill: 0.75, hips: 1.55 };
const LIE = DEATH_BACK[DEATH_BACK.length - 1].pose;
// lying on his back, his root under his hips: head away (-z), feet toward
// the wall (+z), the right hand up beside the head, the left flung out
export const DOWN = {
  hipsPos: [0.01, 0.15, 0], hips: [-90, -3, 2], spine: [5, 0, 0], chest: [7, -3, -3], neck: [-6, 0, 0], head: [-10, 25, 6], headLevel: [0],
  shoulderL: [-8, 0, 6], shoulderR: [-8, 0, -8],
  footL: [LIE.footL[0], LIE.footL[1], 0.78], footR: [LIE.footR[0], LIE.footR[1], 0.86], footRotL: LIE.footRotL, footRotR: LIE.footRotR, kneeL: LIE.kneeL, kneeR: LIE.kneeR,
  handTL: [0.72, 0.09, -0.3], handTR: [-0.28, 0.12, -0.78], elbowPoleL: [0.4, 1, 0.3], elbowPoleR: [-1, 0.6, 0.2], handL: [0, 0, -12], handR: [-10, 0, 20],
};
const Z = KO_OUT.hips;
const KO = [
  [0, REEL],
  // the blow lands: the head snaps back, the arms fly up, a step back
  [0.1, { hipsPos: [0, 0.92, -0.14], hips: [-12, 0, 0], spine: [-10, 0, 0], chest: [-18, 8, 0], neck: [-24, 0, 0], head: [-34, 14, 0], headLevel: [0],
    handTL: [0.42, 1.36, 0.1], handTR: [-0.36, 1.5, 0.0], elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0.2, 0], footR: [-0.17, A + 0.06, -0.22], footRotR: [-10, 20, 0] }],
  // the backs of his thighs meet the sill
  [0.22, { hipsPos: [0, 0.9, -0.28], hips: [-24, 0, 0], spine: [-14, 0, 0], chest: [-20, 8, 0], head: [-30, 12, 0], footR: [-0.17, A, -0.26], footL: [0.17, A, -0.02],
    handTL: [0.48, 1.3, -0.1], handTR: [-0.44, 1.46, -0.2] }],
  // his shoulders into the glass: over backwards onto the sill
  [0.36, { hipsPos: [0, 0.97, -0.4], hips: [-58, 0, 4], spine: [-10, 0, 0], chest: [-12, 6, 0], neck: [-10, 0, 0], head: [-24, 10, 0],
    footL: [0.17, 0.2, 0.02], footR: [-0.17, 0.12, -0.12], kneeL: [0.2, 1, 0.3], kneeR: [-0.2, 1, 0.3], footRotL: [30, 14, 0], footRotR: [30, 20, 0],
    handTL: [0.62, 1.4, -0.7], handTR: [-0.6, 1.5, -0.8] }],
  // folded back over the sill, the head going down outside
  [0.54, { hipsPos: [0, 0.96, -0.54], hips: [-100, 0, 6], spine: [-6, 0, 0], chest: [-10, 0, 0], neck: [-8, 0, 0], head: [-16, 8, 0],
    footL: [0.15, 0.6, 0.0], footR: [-0.15, 0.5, -0.05], kneeL: [0.2, 1, 0.2], kneeR: [-0.2, 1, 0.2], footRotL: [60, 14, 0], footRotR: [60, 20, 0],
    handTL: [0.66, 0.9, -1.1], handTR: [-0.64, 0.8, -1.2] }],
  // his legs follow, over it
  [0.74, { hipsPos: [0, 0.8, -0.86], hips: [-150, 0, 8], chest: [-6, 0, 0], head: [-10, 8, 0],
    footL: [0.14, 1.26, -0.44], footR: [-0.16, 1.14, -0.5], kneeL: [0.1, 1, -0.5], kneeR: [-0.1, 1, -0.5], footRotL: [90, 14, 0], footRotR: [90, 20, 0],
    handTL: [0.62, 0.3, -1.4], handTR: [-0.58, 0.22, -1.46] }],
  // on his back on the pavement
  [0.96, { hipsPos: [0.02, 0.22, -Z + 0.18], hips: [-104, -3, 4], spine: [4, 0, 0], chest: [6, 0, 0], neck: [-4, 0, 0], head: [-12, 16, 4],
    footL: [0.2, 0.6, -0.92], footR: [-0.18, 0.5, -0.88], kneeL: [0.6, 0.6, 0.3], kneeR: [-0.4, 1, 0.1], footRotL: [60, 30, 0], footRotR: [60, 22, 0],
    handTL: [0.66, 0.16, -Z - 0.2], handTR: [-0.3, 0.2, -Z - 0.72] }],
  [1.14, { hipsPos: [0.02, 0.17, -Z + 0.02], hips: [-94, -3, 2], footL: [DOWN.footL[0], 0.1, DOWN.footL[2] - Z], footR: [DOWN.footR[0], 0.12, DOWN.footR[2] - Z] }],
  [1.8, { ...DOWN, hipsPos: [0.01, 0.15, -Z], footL: [DOWN.footL[0], DOWN.footL[1], DOWN.footL[2] - Z], footR: [DOWN.footR[0], DOWN.footR[1], DOWN.footR[2] - Z],
    handTL: [DOWN.handTL[0], DOWN.handTL[1], DOWN.handTL[2] - Z], handTR: [DOWN.handTR[0], DOWN.handTR[1], DOWN.handTR[2] - Z] }],
  [2.2, {}],
];
const KO_RM = (t) => [0, -Z * sstep(0.5, 1.2, t)];

export const BR_DEFS = {
  br_guard: () => ({ duration: 2.4, loop: true, armSpace: 'root', pose: (t) => P({ ...GUARD, ...guardAt(t) }) }),
  br_stepF: shuffle([0, 1]), br_stepB: shuffle([0, -1]), br_stepL: shuffle([1, 0]), br_stepR: shuffle([-1, 0]),
  br_pivot: pivot(),
  br_jab: fight(0.7, JAB),
  br_jabR: fightL(0.7, JAB),     // (his right jab: a jab with the right)
  br_cross: fight(0.85, CROSS),
  br_hook: fight(1.0, HOOK), br_hookL: fightL(1.0, HOOK),
  br_body: fight(1.0, BODY), br_bodyL: fightL(1.0, BODY),
  br_haymaker: fight(1.4, HAY, HAY_RM), br_haymakerL: fightL(1.4, HAY, HAY_RM, { 0.7: { footL: [0.14, A, 0.5] }, 0.95: { footR: [-0.16, A, -0.02] }, 1.4: { footL: [0.14, A, 0.5], footR: [-0.18, A, 0.04] } }),
  br_rush: fight(1.5, RUSH, RUSH_RM),
  br_feint: fight(0.6, FEINT), br_feintL: fightL(0.6, FEINT),
  br_shove: fight(0.9, SHOVE, SHOVE_RM),
  br_bottle_thrust: fight(0.9, THRUST),
  br_throw: fight(1.0, THROW),
  br_take: fight(0.7, TAKE),
  br_bottle: fight(2.0, BOTTLE, BOTTLE_RM),
  br_stoolUp: fight(0.8, STOOL_UP),
  br_stoolSwing: fight(1.6, STOOL_SWING),
  br_hitHeadL: fight(0.4, HIT_HEAD_L), br_hitHeadR: fightL(0.4, HIT_HEAD_L),
  br_hitBody: fight(0.5, HIT_BODY),
  br_knock: fight(0.8, KNOCK, KNOCK_RM),
  br_into: fight(1.1, INTO, INTO_RM),
  br_into_stools: fight(1.8, INTO_STOOLS),
  br_stun: fight(1.3, STUN),
  br_reel: reel(),
  br_reelBack: reelBack(),
  br_sway: fight(0.8, SWAY, null, REEL),
  br_catchL: () => ({ duration: 0.9, armSpace: 'root', pose: keyed(CATCH) }),
  br_catchR: () => ({ duration: 0.9, armSpace: 'root', pose: keyed(mirrorKeys(CATCH)) }),
  br_comeRound: fight(1.3, COME_ROUND, null, REEL),
  br_ko_window: () => ({ duration: 2.2, armSpace: 'root', pose: rooted(keyed(KO), KO_RM), rootMotion: KO_RM }),
  br_down: () => ({ duration: 3.2, loop: true, armSpace: 'root', pose: (t) => {
    const b = S(TAU * t / 3.2);
    return P({ ...DOWN, chest: [DOWN.chest[0] + 1.5 * b, DOWN.chest[1], DOWN.chest[2]] });
  } }),
};

// ---- the timing, as data --------------------------------------------------------------------
//   hand     'L' | 'R' | 'both' (the hand the blow comes from: slip away from it)
//   kind     'straight' (slip either way or lean back), 'swing' (a hook: slip
//            away from its hand), 'over' (an overhand: lean back or slip away
//            from its hand), 'shove', 'throw'
//   tell     when his tell shows; contact when it lands
export const BR_CLIPS = {
  br_guard: { duration: 2.4, marks: {}, loop: true },
  br_stepF: { duration: STEP.T, marks: {}, loop: true }, br_stepB: { duration: STEP.T, marks: {}, loop: true },
  br_stepL: { duration: STEP.T, marks: {}, loop: true }, br_stepR: { duration: STEP.T, marks: {}, loop: true },
  br_pivot: { duration: 0.5, marks: {}, loop: true },
  br_jab: { duration: 0.7, marks: { tell: 0.0, contact: 0.38 } },
  br_jabR: { duration: 0.7, marks: { tell: 0.0, contact: 0.38 } },
  br_cross: { duration: 0.85, marks: { tell: 0.0, contact: 0.46 } },
  br_hook: { duration: 1.0, marks: { tell: 0.0, contact: 0.66 } },
  br_hookL: { duration: 1.0, marks: { tell: 0.0, contact: 0.66 } },
  br_body: { duration: 1.0, marks: { tell: 0.0, contact: 0.58 } },
  br_bodyL: { duration: 1.0, marks: { tell: 0.0, contact: 0.58 } },
  br_haymaker: { duration: 1.4, marks: { tell: 0.0, contact: 0.95 } },
  br_haymakerL: { duration: 1.4, marks: { tell: 0.0, contact: 0.95 } },
  br_rush: { duration: 1.5, marks: { tell: 0.0, contact: 0.95 } },
  br_feint: { duration: 0.6, marks: { tell: 0.0 } }, br_feintL: { duration: 0.6, marks: { tell: 0.0 } },
  br_shove: { duration: 0.9, marks: { tell: 0.0, contact: 0.44 } },
  br_bottle_thrust: { duration: 0.9, marks: { tell: 0.0, contact: 0.5 } },
  br_throw: { duration: 1.0, marks: { tell: 0.0, release: 0.56 } },
  br_take: { duration: 0.7, marks: { take: 0.35 } },
  br_bottle: { duration: 2.0, marks: { tell: 0.0, take: 0.35, break: 0.75, contact: 1.6 } },
  br_stoolUp: { duration: 0.8, marks: { take: 0.5 } },
  br_stoolSwing: { duration: 1.6, marks: { tell: 0.0, contact: 0.95, drop: 1.25 } },
  br_hitHeadL: { duration: 0.4, marks: {} }, br_hitHeadR: { duration: 0.4, marks: {} },
  br_hitBody: { duration: 0.5, marks: {} },
  br_knock: { duration: 0.8, marks: { stop: 0.62 } },
  br_into: { duration: 1.1, marks: { impact: 0.1 } },
  br_into_stools: { duration: 1.8, marks: { impact: 0.1, down: 0.5 } },
  br_stun: { duration: 1.3, marks: { open: 0.1, openEnd: 1.2 } },
  br_reel: { duration: 2.2, marks: {}, loop: true },
  br_reelBack: { duration: 0.9, marks: {}, loop: true },
  br_sway: { duration: 0.8, marks: {} },
  br_catchL: { duration: 0.9, marks: {} }, br_catchR: { duration: 0.9, marks: {} },
  br_comeRound: { duration: 1.3, marks: {} },
  br_ko_window: { duration: 2.2, marks: { sill: 0.22, glass: 0.34, over: 0.74, land: 0.96 }, hold: true, selfTravel: true },
  br_down: { duration: 3.2, marks: {}, loop: true },
};

// what each attack is, for the rules (FIGHT.md §2): its hand, its kind, its
// weight (his damage), what covering takes of it (chip; null: it goes
// through the cover), its knock on me (m)
export const BR_ATTACKS = {
  br_jab: { hand: 'L', kind: 'straight', dmg: 5, chip: 0, push: 0 },
  br_jabR: { hand: 'R', kind: 'straight', dmg: 5, chip: 0, push: 0 },
  br_cross: { hand: 'R', kind: 'straight', dmg: 8, chip: 1, push: 0.1 },
  br_hook: { hand: 'R', kind: 'swing', dmg: 10, chip: 3, push: 0.1 },
  br_hookL: { hand: 'L', kind: 'swing', dmg: 10, chip: 3, push: 0.1 },
  br_body: { hand: 'R', kind: 'swing', dmg: 8, chip: 2, push: 0.05 },
  br_bodyL: { hand: 'L', kind: 'swing', dmg: 8, chip: 2, push: 0.05 },
  br_haymaker: { hand: 'R', kind: 'over', dmg: 16, chip: null, push: 0.4 },
  br_haymakerL: { hand: 'L', kind: 'over', dmg: 16, chip: null, push: 0.4 },
  br_rush: { hand: 'R', kind: 'over', dmg: 16, chip: null, push: 0.5 },
  br_shove: { hand: 'both', kind: 'shove', dmg: 3, chip: 2, push: 1.2 },
  br_bottle: { hand: 'R', kind: 'straight', dmg: 13, chip: 3, push: 0.1 },
  br_bottle_thrust: { hand: 'R', kind: 'straight', dmg: 13, chip: 3, push: 0.1 },
  br_throw: { hand: 'R', kind: 'throw', dmg: 7, chip: 1, push: 0 },
  br_stoolSwing: { hand: 'R', kind: 'swing', dmg: 18, chip: null, push: 0.6 },
};
