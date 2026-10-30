import { NEUTRAL, mergePose, ANKLE_Y } from '../../enemies/HoodRig.js';

// The city's people on wheels' business (lane O2): a man in a bowler and a
// short overcoat who hails a cab from the kerb, and holds the race's flag at
// the Yards' corner (o2_fare); a woman in a cloche and a fur collar who hails
// too (o2_fare_her). O3's pedestrians will be the city's crowd; these are
// the few the taxi's fares and the race need. Read at 40 m by the arm up.
// Clips (model metres; the figure faces +z, his left is +x):
//   o2_hail      at the kerb, the right arm up high, the hand waving
//   o2_wait      standing, the weight on one foot, a glance about
//   o2_flagUp    the right arm straight up, a flag in the hand (the race's: get set)
//   o2_flagDown  the arm swept down and out: go (held)
const A = ANKLE_Y;
const TAU = Math.PI * 2;
const S = Math.sin;
const P = (o) => mergePose(NEUTRAL, o);
const sm = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const AB = Math.abs;

const HIM = {
  body: {
    torso: [
      [0.95, 0.19, 0.134, 0.134, 0.0, 2.3], [1.03, 0.178, 0.126, 0.126, 0.004, 2.3], [1.12, 0.18, 0.132, 0.124, 0.008, 2.35],
      [1.22, 0.19, 0.14, 0.126, 0.01, 2.45], [1.31, 0.202, 0.14, 0.13, 0.008, 2.7], [1.37, 0.208, 0.132, 0.13, 0.0, 3.0],
      [1.41, 0.205, 0.118, 0.12, -0.008, 3.1], [1.44, 0.186, 0.104, 0.108, -0.013, 2.9], [1.465, 0.15, 0.092, 0.098, -0.017, 2.6],
      [1.484, 0.1, 0.08, 0.086, -0.019, 2.3], [1.496, 0.06, 0.064, 0.07, -0.02, 2.2],
    ],
    shoulderX: 0.16, shoulderY: 1.385, upper: 0.3, fore: 0.27, hipX: 0.09,
    neckR: 0.047, neckY: 1.475, headS: 0.97, jaw: 0.22,
  },
  cover: { kind: 'bowler', hatDY: 0.13, hatDZ: 0.0, pitch: 0.05, s: 0.98, brim: 0.14 },
  garments: [
    { kind: 'torso', shade: (th, y) => (y > 1.25 && AB(th) < 0.12 ? 0.3 : 0.013) },
    { kind: 'skirt', y0: 1.06, hem: 0.52, split: 0.5, flare: [1.2, 1.26], back: 0.4, folds: 0.8, shade: 'coat' },
    { kind: 'lapels', near: true, top: 1.482, low: 1.24 },
    { kind: 'collar', style: 'stand', h: 0.045, hFront: 0.03, open: 0.55, gap: 0.028 },
    { kind: 'sleeves', r: 0.07, cuff: 0.062 },
    { kind: 'legs', r: 0.9 },
    { kind: 'shoes' },
    { kind: 'hands', s: 0.95 },
  ],
  skin: { coat: 0.013, hand: 0.02, skin: 0.03, cover: 0.006 },
  collider: 0.28,
};
const HER = {
  body: {
    torso: [
      [0.93, 0.18, 0.124, 0.134, -0.006, 2.3], [1.0, 0.166, 0.112, 0.118, 0.0, 2.3], [1.07, 0.148, 0.102, 0.104, 0.004, 2.3],
      [1.14, 0.152, 0.108, 0.104, 0.008, 2.35], [1.22, 0.168, 0.132, 0.108, 0.01, 2.45], [1.3, 0.182, 0.134, 0.112, 0.01, 2.7],
      [1.37, 0.198, 0.118, 0.116, 0.002, 3.1], [1.415, 0.204, 0.106, 0.11, -0.006, 3.4], [1.445, 0.194, 0.094, 0.1, -0.012, 3.2],
      [1.466, 0.162, 0.083, 0.09, -0.015, 2.8], [1.482, 0.104, 0.07, 0.076, -0.017, 2.4], [1.492, 0.06, 0.058, 0.064, -0.018, 2.2],
    ],
    shoulderX: 0.158, shoulderY: 1.405, upper: 0.285, fore: 0.25, hipX: 0.084,
    neckR: 0.044, headS: 0.92, jaw: 0.26, nose: 0.8,
  },
  cover: { kind: 'cloche', hatDY: 0.1, hatDZ: 0.008, pitch: 0.2, s: 0.95 },
  garments: [
    { kind: 'torso', shade: 'coat' },
    { kind: 'skirt', y0: 1.02, hem: 0.36, split: 0.45, flare: [1.3, 1.4], back: 0.4, folds: 0.8, shade: 'coat' },
    { kind: 'collar', style: 'fur', r: 0.048, shade: 'fur' },
    { kind: 'sleeves', r: 0.068, cuff: 0.06 },
    { kind: 'legs', style: 'stocking' },
    { kind: 'shoes', style: 'flat' },
    { kind: 'hands', s: 0.82 },
  ],
  skin: { coat: 0.013, fur: 0.045, hand: 0.022, skin: 0.03, cover: 0.01, band: 0.03, stocking: 0.012 },
  collider: 0.26,
};

// at the kerb, the arm up and waving: the hand over the hat, the palm out
const hail = (k = 1) => (t) => {
  const w = S(TAU * t / 0.9), b = S(TAU * t / 1.8);
  return P({ hipsPos: [0.02, 0.95, 0.0], hips: [0, 0, 3], spine: [-2, 0, -3], chest: [-3 + b, 0, -4], neck: [-4, 0, 0], head: [-8, 0, 0],
    handTR: [-0.2 + 0.07 * w * k, 2.0 + 0.02 * b, 0.14], elbowPoleR: [-1, -0.2, 0.2], handR: [-10, 0, -20 + 25 * w],
    armL: [0.12, -1, 0.06, 0], elbowL: [16], handL: [0, 0, 6],
    footL: [0.12, A, 0.04], footR: [-0.13, A, -0.02], footRotL: [0, 8, 0], footRotR: [0, -12, 0] });
};
const wait = (t) => {
  const b = S(TAU * t / 3.2), g = S(TAU * t / 7.1);
  return P({ hipsPos: [0.03, 0.95, 0.0], hips: [0, 4 * g, 3], spine: [1 + b * 0.6, 0, -2], chest: [0, 3 * g, 0], neck: [2, 12 * g, 0], head: [-2, 10 * g, 0],
    armL: [0.12, -1, 0.05, 0], elbowL: [14], armR: [-0.12, -1, 0.06, 0], elbowR: [16],
    footL: [0.13, A, 0.05], footR: [-0.12, A, -0.04], footRotL: [0, 10, 0], footRotR: [0, -8, 0] });
};
const flagUp = (t) => {
  const b = S(TAU * t / 1.6);
  return P({ hipsPos: [0, 0.96, 0], spine: [-3, 0, -2], chest: [-4 + b, 0, -3], neck: [-6, 0, 0], head: [-6, 0, 0],
    handTR: [-0.16, 2.12 + 0.01 * b, 0.08], elbowPoleR: [-1, 0, 0.2], handR: [0, 0, -10],
    handTL: [0.14, 1.0, 0.18], elbowPoleL: [1, -0.6, 0], handL: [0, 0, 20],
    footL: [0.15, A, 0.06], footR: [-0.15, A, -0.04] });
};
const flagDown = (t) => {
  const u = sm(t / 0.32);
  return P({ hipsPos: [0, 0.96 - 0.05 * u, 0.02 * u], spine: [-3 + 14 * u, 0, -2], chest: [-4 + 10 * u, 0, -3], neck: [-6 + 4 * u, 0, 0], head: [-6, 0, 0],
    handTR: [-0.16 - 0.3 * u, 2.12 - 1.1 * u, 0.08 + 0.55 * u], elbowPoleR: [-1, -0.4 * u, 0.2], handR: [0, 0, -10],
    handTL: [0.14, 1.0, 0.18], elbowPoleL: [1, -0.6, 0], handL: [0, 0, 20],
    footL: [0.15, A, 0.06 + 0.1 * u], footR: [-0.15, A, -0.04] });
};

export default {
  kind: 'o2_fare', h: 1.74, name: 'fare',
  costume: HIM,
  clips: {
    o2_hail: { duration: 1.8, loop: true, def: () => ({ duration: 1.8, loop: true, armSpace: 'root', pose: hail(1) }) },
    o2_wait: { duration: 7.1, loop: true, def: () => ({ duration: 7.1, loop: true, armSpace: 'root', pose: wait }) },
    o2_flagUp: { duration: 1.6, loop: true, def: () => ({ duration: 1.6, loop: true, armSpace: 'root', pose: flagUp }) },
    o2_flagDown: { duration: 0.6, hold: true, marks: { down: 0.25 }, def: () => ({ duration: 0.6, armSpace: 'root', pose: flagDown }) },
  },
  idle: 'o2_wait',
};
// (her, a kind of her own: the same clips under other names - a clip is one kind's)
export const HER_KIND = {
  kind: 'o2_fare_her', h: 1.64, name: 'fare_her', costume: HER,
  clips: {
    o2h_hail: { duration: 1.8, loop: true, def: () => ({ duration: 1.8, loop: true, armSpace: 'root', pose: hail(0.8) }) },
    o2h_wait: { duration: 7.1, loop: true, def: () => ({ duration: 7.1, loop: true, armSpace: 'root', pose: wait }) },
  },
  idle: 'o2h_wait',
};
