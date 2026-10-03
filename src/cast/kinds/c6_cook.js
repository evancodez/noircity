import { NEUTRAL, mergePose, samplePoseKeys, ANKLE_Y } from '../../enemies/HoodRig.js';
import { chainKeys } from '../../enemies/HoodAnim.js';

// A kitchen hand in the kitchen the chase goes through (lane C6, chapter V):
// the cook's cut (a paper cap, heavy shoulders, the apron bib; costumes.js
// COOK, copied here: a kind file is read before costumes.js) with clips of
// his own:
//   c6cook_work     at the range or the sink: both hands at it, a stir, a
//                   weight shift (loops)
//   c6cook_flatten  a man running through his kitchen: back to the wall,
//                   the arms out flat against it, the chin up and turned
//                   after him (held)
// (model metres, the figure faces +z, his left is +x)
const A = ANKLE_Y;
const S = Math.sin, TAU = Math.PI * 2;
const P = (o) => mergePose(NEUTRAL, o);
const Ab = Math.abs;

function workPose(t) {
  const b = S(TAU * t / 2.2), w = S(TAU * t / 5);
  return P({
    hipsPos: [0.01 * w, 0.94, 0.02], hips: [6, 3 * w, 0], spine: [10, 0, 0], chest: [8, 4 * b, 0], neck: [10, 0, 0], head: [16, 0, 0],
    handTR: [-0.14 + 0.05 * b, 1.0, 0.42], elbowPoleR: [-1, -0.4, -0.3], handR: [60, 0, 0],
    handTL: [0.18, 1.02, 0.38], elbowPoleL: [1, -0.4, -0.3], handL: [60, 0, 0],
    footL: [0.12, A, 0.04], footR: [-0.12, A, -0.02],
  });
}
const FLAT = chainKeys([
  [0, { ...workPose(0) }],
  // the start: up straight, the head round to the noise
  [0.14, { hipsPos: [0, 0.95, 0.0], hips: [0, 0, 0], spine: [-2, 0, 0], chest: [-6, 0, 0], neck: [-8, 20, 0], head: [-10, 28, 0],
    handTR: [-0.3, 1.1, 0.22], handTL: [0.3, 1.1, 0.22], elbowPoleR: [-1, -0.2, -0.4], elbowPoleL: [1, -0.2, -0.4] }],
  // back to the wall: the shoulders against it, the arms out flat on it, the chin up
  [0.36, { hipsPos: [0, 0.93, -0.1], hips: [-4, 0, 0], spine: [-8, 0, 0], chest: [-10, 0, 0], neck: [-10, 30, 0], head: [-12, 38, 0],
    handTR: [-0.58, 1.28, -0.2], elbowPoleR: [-0.4, 1, -0.4], handR: [0, 90, -10],
    handTL: [0.58, 1.3, -0.2], elbowPoleL: [0.4, 1, -0.4], handL: [0, -90, 10],
    footL: [0.14, A, 0.02], footR: [-0.14, A, 0.0] }],
  [0.9, { hipsPos: [0, 0.92, -0.11], neck: [-8, 36, 0], head: [-10, 44, 0] }],
]);
const flattenPose = (t) => samplePoseKeys(FLAT, t);

const COSTUME = {
  body: {
    torso: [
      [0.92, 0.205, 0.15, 0.146, 0.012, 2.3],
      [1.0, 0.208, 0.166, 0.146, 0.026, 2.3],
      [1.1, 0.214, 0.17, 0.144, 0.028, 2.4],
      [1.2, 0.228, 0.162, 0.146, 0.022, 2.5],
      [1.3, 0.25, 0.158, 0.152, 0.014, 2.9],
      [1.38, 0.264, 0.15, 0.15, 0.006, 3.3],
      [1.425, 0.266, 0.136, 0.14, -0.004, 3.6],
      [1.455, 0.253, 0.12, 0.126, -0.01, 3.4],
      [1.478, 0.22, 0.106, 0.112, -0.014, 3.0],
      [1.495, 0.16, 0.094, 0.1, -0.016, 2.6],
      [1.508, 0.095, 0.084, 0.09, -0.017, 2.3],
    ],
    shoulderX: 0.21, shoulderY: 1.41, upper: 0.305, fore: 0.28, hipX: 0.1,
    neckR: 0.068, neckFlare: 0.02, headW: 1.04, jaw: 0.1,
  },
  cover: { kind: 'papercap', hatDY: 0.105, hatDZ: -0.004, pitch: 0.03, h: 0.1 },
  garments: [
    { kind: 'torso', shade: (th, y) => (Ab(th) < 0.5 && y < 1.34 ? 0.035 : 0.025) },
    { kind: 'skirt', y0: 1.02, hem: 0.52, flare: [1.12, 1.2], folds: 0.4, back: 0.5, grow: 0.012,
      shade: (u) => { const th = u * 6.2832; return Math.cos(th) > 0.4 ? 0.035 : 0.01; } },
    { kind: 'collar', style: 'band', h: 0.03, hFront: 0.024, open: 0.35, gap: 0.004, lean: 0.002, flareOut: 0.002, shade: 0.03 },
    { kind: 'sleeves', style: 'rolled', r: 0.085, shade: 0.03 },
    { kind: 'arms', r: 0.055, d0: 0.18 },
    { kind: 'legs', r: 1.1 },
    { kind: 'shoes' },
    { kind: 'hands', s: 1.1 },
  ],
  skin: { arm: 0.03, hand: 0.03, skin: 0.03, cover: 0.62, trousers: 0.008 },
  collider: 0.34,
};

export default {
  kind: 'c6_cook', h: 1.76, name: 'kitchenhand',
  costume: COSTUME,
  clips: {
    c6cook_work: { duration: 2.2, loop: true, def: () => ({ pose: workPose, armSpace: 'root' }) },
    c6cook_flatten: { duration: 0.9, hold: true, def: () => ({ pose: flattenPose, armSpace: 'root' }) },
  },
  idle: 'c6cook_work',
};
