import { NEUTRAL, mergePose, samplePoseKeys, ANKLE_Y } from '../../enemies/HoodRig.js';
import { chainKeys } from '../../enemies/HoodAnim.js';

// Scene 7's people (lane B5). The kind is the truck's driver (a flat cap,
// a short work jacket: he pulls out of a side street into the tail); its
// clips are the question's, for whoever the watcher is (lane B4's kind
// when it is in, else the stand-in): clip names are every kind's.
//   tail_crawl     out of a wrecked car's door on hands and knees, up onto
//                  his feet, unsteady (root motion: ~0.7 m out)
//   tail_pinned    held by the lapels, his back against his car: leaning
//                  back from me, his hands on my wrists, breathing hard
//   tail_overRail  bent back over the rail, his hands clutching my arms,
//                  his head back over the water, up on his toes
//   tail_slide     let go: down the railing to sit on the wet pavement
// Poses face +z (toward me), in the figure's root space (model metres).
const A = ANKLE_Y;
const S = Math.sin, TAU = Math.PI * 2;
const keyed = (arr) => { const K = chainKeys(arr); return (t) => samplePoseKeys(K, t); };
const P = (o) => mergePose(NEUTRAL, o);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rooted(fn, rm) {
  return (t) => {
    const p = fn(t);
    const [x, z] = rm(t);
    for (const k of ['hipsPos', 'footL', 'footR', 'handTL', 'handTR']) if (p[k]) p[k] = [p[k][0] - x, p[k][1], p[k][2] - z, ...p[k].slice(3)];
    return p;
  };
}

const TRUCKER = {
  body: {
    torso: [
      [0.94, 0.215, 0.156, 0.15, 0.01, 2.3],
      [1.02, 0.216, 0.16, 0.148, 0.016, 2.3],
      [1.12, 0.222, 0.166, 0.146, 0.02, 2.4],
      [1.22, 0.234, 0.168, 0.148, 0.018, 2.5],
      [1.31, 0.25, 0.164, 0.152, 0.012, 2.8],
      [1.38, 0.26, 0.154, 0.152, 0.004, 3.3],
      [1.425, 0.262, 0.138, 0.142, -0.006, 3.7],
      [1.455, 0.25, 0.122, 0.128, -0.012, 3.6],
      [1.476, 0.222, 0.107, 0.113, -0.016, 3.1],
      [1.492, 0.166, 0.095, 0.1, -0.018, 2.7],
      [1.504, 0.1, 0.084, 0.09, -0.019, 2.3],
    ],
    shoulderX: 0.2, shoulderY: 1.41, upper: 0.3, fore: 0.28, hipX: 0.1,
    neckR: 0.064, headW: 1.02, jaw: 0.14,
  },
  cover: { kind: 'flatcap', hatDY: 0.124, hatDZ: 0.01, pitch: 0.12, s: 1.03, peak: 0.06, peakDrop: 0.3 },
  garments: [
    { kind: 'torso', shade: 'coat' },
    { kind: 'skirt', y0: 1.0, hem: 0.86, flare: [1.06, 1.1], back: 0.6, folds: 0.4, grow: 0.01, shade: 'coat' },
    { kind: 'collar', style: 'stand', h: 0.05, hFront: 0.035, open: 0.55, gap: 0.03 },
    { kind: 'sleeves', r: 0.084, cuff: 0.072 },
    { kind: 'legs', r: 1.04, boot: true },
    { kind: 'shoes', style: 'boot' },
    { kind: 'hands', s: 1.04 },
  ],
  skin: { coat: 0.012, collar: 0.016, hand: 0.02, skin: 0.03, cover: 0.02, cuff: 0.04, trousers: 0.009 },
  collider: 0.33,
};

// on hands and knees out of the door, up, unsteady
const crawlK = keyed([
  [0, { hipsPos: [0, 0.5, -0.1], hips: [72, 0, 0], spine: [18, 0, 0], chest: [12, 0, 0], neck: [-18, 0, 0], head: [-12, 0, 0],
    handTL: [0.18, 0.12, 0.45], handTR: [-0.18, 0.1, 0.4], elbowPoleL: [1, -0.2, -0.3], elbowPoleR: [-1, -0.2, -0.3],
    footL: [0.14, 0.1, -0.48], footR: [-0.14, 0.1, -0.52], footRotL: [-160, 0, 0], footRotR: [-160, 0, 0], kneeL: [0.1, -0.3, 1], kneeR: [-0.1, -0.3, 1] }],
  [0.6, { hipsPos: [0.03, 0.52, 0.08], handTL: [0.2, 0.11, 0.66], handTR: [-0.16, 0.13, 0.52], footL: [0.12, 0.1, -0.38], footR: [-0.16, 0.1, -0.3] }],
  [1.2, { hipsPos: [-0.02, 0.56, 0.22], hips: [60, 0, 0], handTL: [0.16, 0.14, 0.72], handTR: [-0.2, 0.12, 0.74], footL: [0.14, 0.12, -0.18], footR: [-0.12, 0.1, -0.24] }],
  // a knee up, a push, up onto his feet hunched
  [1.8, { hipsPos: [0, 0.78, 0.3], hips: [34, 0, 0], spine: [18, 0, 0], chest: [10, 0, 0], neck: [0, 0, 0], head: [4, 0, 0],
    handTL: [0.22, 0.62, 0.52], handTR: [-0.2, 0.7, 0.48], footL: [0.15, A, 0.36], footR: [-0.14, 0.08, 0.02], footRotR: [-60, 0, 0], kneeR: [-0.1, 0.2, 1] }],
  [2.3, { hipsPos: [0.02, 0.9, 0.34], hips: [14, 0, 6], spine: [10, 0, 4], chest: [6, 8, 0], neck: [10, 0, 0], head: [-4, -10, 0],
    handTL: [0.3, 0.86, 0.36], handTR: [-0.26, 0.9, 0.3], footL: [0.16, A, 0.38], footR: [-0.16, A, 0.26], footRotR: [0, 8, 0], kneeR: [-0.12, 0, 1] }],
  [2.8, { hipsPos: [0, 0.92, 0.36], hips: [8, 0, 0], spine: [6, 0, 0], chest: [4, 0, 0], head: [-2, 0, 0], handTL: [0.3, 0.88, 0.34], handTR: [-0.28, 0.9, 0.3] }],
]);
const crawlRM = (t) => [0, 0.36 * sstep(1.4, 2.8, t)];

export default {
  kind: 'tail_trucker', h: 1.8, name: 'trucker',
  costume: TRUCKER,
  clips: {
    tail_crawl: { duration: 2.8, marks: { up: 2.2 }, hold: true, def: () => ({ duration: 2.8, armSpace: 'root', pose: rooted(crawlK, crawlRM), rootMotion: crawlRM }) },
    tail_pinned: {
      duration: 1.9, loop: true,
      def: () => ({ duration: 1.9, loop: true, armSpace: 'root', pose: (t) => {
        const b = S(TAU * t / 1.9), b2 = S(TAU * t / 0.95 + 0.7);
        return P({ hipsPos: [0, 0.93, -0.06], hips: [-6, 0, 0], spine: [-8 + b * 1.5, 0, 0], chest: [-12 + b * 2, 0, 0], neck: [-6, 0, 0], head: [-14 + b2 * 2, 18, 4],
          handTL: [0.1, 1.24 + b * 0.01, 0.34], handTR: [-0.1, 1.22 + b * 0.01, 0.35], elbowPoleL: [1, -0.6, -0.2], elbowPoleR: [-1, -0.6, -0.2], handL: [0, 0, 50], handR: [0, 0, -50],
          footL: [0.13, A, 0.12], footR: [-0.14, A, 0.06], footRotL: [0, 10, 0], footRotR: [0, -6, 0] });
      } }),
    },
    tail_overRail: {
      duration: 1.6, loop: true,
      def: () => ({ duration: 1.6, loop: true, armSpace: 'root', pose: (t) => {
        const b = S(TAU * t / 1.6);
        // (back over it far enough that the water is under his shoulders,
        // not so far that his face goes out of my sight: it stays up, on me)
        return P({ hipsPos: [0, 0.96, -0.02], hips: [-10, 0, 0], spine: [-19 + b * 2, 0, 0], chest: [-17 + b * 2, 0, 0], neck: [-2, 0, 0], head: [12, 8, 0], headLevel: [0],
          handTL: [0.12, 1.14 + b * 0.015, 0.36], handTR: [-0.11, 1.12 + b * 0.015, 0.38], elbowPoleL: [1, -0.3, -0.3], elbowPoleR: [-1, -0.3, -0.3], handL: [0, 0, 60], handR: [0, 0, -60],
          footL: [0.13, A + 0.04, 0.26], footR: [-0.13, A + 0.06, 0.22], footRotL: [-24, 8, 0], footRotR: [-26, -6, 0] });
      } }),
    },
    tail_slide: {
      duration: 1.6, hold: true,
      def: () => ({ duration: 1.6, armSpace: 'root', pose: keyed([
        [0, { hipsPos: [0, 0.96, -0.02], hips: [-10, 0, 0], spine: [-19, 0, 0], chest: [-17, 0, 0], neck: [-2, 0, 0], head: [12, 8, 0], handTL: [0.12, 1.14, 0.36], handTR: [-0.11, 1.12, 0.38] }],
        // [2nd pass] down the rail, not up off it: his back stays on it and
        // his hands go back to it as his knees give (he stood straight up
        // with his fists at his sides first, then dropped)
        [0.5, { hipsPos: [0, 0.74, -0.06], hips: [-2, 0, 0], spine: [-10, 0, 0], chest: [-10, 0, 0], neck: [6, 0, 0], head: [10, 6, 0], handTL: [0.3, 0.88, -0.1], handTR: [-0.3, 0.9, -0.08],
          footL: [0.15, A, 0.34], footR: [-0.15, A, 0.3] }],
        // [2nd pass] the hands down by his hips on the stones, the elbows
        // back (they stuck out sideways: from above he was a cross)
        [1.2, { hipsPos: [0, 0.28, 0.02], hips: [70, 0, 0], spine: [8, 0, 0], chest: [4, 0, 0], neck: [26, 0, 0], head: [24, 10, 0],
          handTL: [0.25, 0.1, 0.06], handTR: [-0.26, 0.12, 0.1], elbowPoleL: [0.4, 0, -1], elbowPoleR: [-0.4, 0, -1],
          footL: [0.2, A, 0.62], footR: [-0.16, A + 0.02, 0.5], footRotL: [0, 20, 0], footRotR: [0, -14, 0], kneeL: [0.2, 0.6, 1], kneeR: [-0.2, 0.7, 1] }],
        [1.6, { hipsPos: [0, 0.27, 0.02], head: [30, 12, 0] }],
      ]) }),
    },
    // the truck's driver in his cab
    tail_trucker_sit: {
      duration: 3, loop: true,
      def: () => ({ duration: 3, loop: true, armSpace: 'root', pose: (t) => P({ hipsPos: [0, 0.52, -0.1], hips: [80, 0, 0], spine: [-6, 0, 0], chest: [-8, 0, 0], neck: [6 + S(TAU * t / 3) * 3, 0, 0],
        handTL: [0.2, 0.92, 0.38], handTR: [-0.2, 0.92, 0.38], footL: [0.14, A, 0.44], footR: [-0.14, A, 0.44], kneeL: [0.1, 1, 0.2], kneeR: [-0.1, 1, 0.2] }) }),
    },
  },
  idle: 'tail_trucker_sit',
};
