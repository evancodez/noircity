import { NEUTRAL, mergePose, ANKLE_Y } from '../../enemies/HoodRig.js';

// The warehouse crew's dock hands (lane B6, scene 8): flat caps pulled low,
// short work jackets to the hip, heavy trousers and boots, a cargo hook on
// the belt, a bull's-eye lantern carried out before them (the lantern is
// the scene's: it rides the right hand). Built on the docker's frame, a
// little leaner, the jacket cut short so the legs read under it: at 20 m a
// dock hand is a cap, square shoulders, a short boxy jacket and a light.
// Their clips (upper-body overlays over the Hood's idle and walk, and
// one-shots):
//   dh_carry   the lantern out before him at the chest, the free arm easy
//   dh_peer    curious: leaning in, the lantern pushed toward what he saw
//   dh_fold    the blow from behind: the knees go, he folds forward and
//              down onto his side (held)
//   dh_down    lying where he folded, out (loop)
//   dh_fix     at the switch panel: both hands up at it
const A = ANKLE_Y;
const TAU = Math.PI * 2;
const S = Math.sin;
const P = (o) => mergePose(NEUTRAL, o);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

const DOCKHAND = {
  body: {
    torso: [
      [0.94, 0.2, 0.146, 0.144, 0.004, 2.3],
      [1.02, 0.198, 0.148, 0.14, 0.008, 2.3],
      [1.12, 0.206, 0.154, 0.14, 0.01, 2.4],
      [1.22, 0.222, 0.16, 0.144, 0.012, 2.5],
      [1.31, 0.242, 0.158, 0.148, 0.01, 2.8],
      [1.38, 0.256, 0.148, 0.148, 0.002, 3.3],
      [1.425, 0.26, 0.134, 0.138, -0.006, 3.7],
      [1.455, 0.248, 0.118, 0.124, -0.012, 3.6],
      [1.476, 0.218, 0.104, 0.11, -0.016, 3.1],
      [1.492, 0.16, 0.093, 0.098, -0.018, 2.7],
      [1.504, 0.096, 0.082, 0.088, -0.019, 2.3],
    ],
    shoulderX: 0.2, shoulderY: 1.41, upper: 0.3, fore: 0.275, hipX: 0.098,
    neckR: 0.056, headW: 1.02, jaw: 0.1,
  },
  cover: { kind: 'flatcap', hatDY: 0.124, hatDZ: 0.012, pitch: 0.16, s: 1.03, peak: 0.062, peakDrop: 0.34 },
  garments: [
    { kind: 'torso', shade: 'coat' },
    // the short jacket: to the hip, square, open a little at the front
    { kind: 'skirt', y0: 1.02, hem: 0.86, flare: [1.04, 1.07], back: 0.8, folds: 0.3, grow: 0.01, split: 0.2, shade: 'coat' },
    { kind: 'collar', style: 'band', h: 0.05, hFront: 0.04, open: 0.5, gap: 0.03, lean: 0.004, flareOut: 0.006, shade: 'collar' },
    { kind: 'sleeves', r: 0.084, cuff: 0.07 },
    { kind: 'legs', r: 1.05, boot: true },
    { kind: 'shoes', style: 'boot' },
    { kind: 'hands', s: 1.05 },
  ],
  skin: { coat: 0.011, collar: 0.02, hand: 0.02, skin: 0.03, cover: 0.013, peak: 0.01, trousers: 0.008, shoes: 0.004 },
  collider: 0.32,
};

// the lantern hand: out before him at the chest, the bail in the fist
const CARRY = {
  handTR: [-0.17, 1.2, 0.34], elbowPoleR: [-1, -0.9, -0.2], handR: [-10, 0, -10],
  armL: [0.14, -1, 0.1, 0], elbowL: [18], handL: [0, 0, 6],
};

export default {
  kind: 'dockhand', h: 1.8, costume: DOCKHAND,
  clips: {
    dh_carry: { duration: 1.2, loop: true, def: () => ({ armSpace: 'root', pose: (t) => {
      const c = Math.cos(TAU * t / 1.2);
      return P({ ...CARRY, handTR: [-0.17, 1.2 + 0.008 * c, 0.34], armL: [0.14, -1, 0.1 + 0.06 * c, 0] });
    } }) },
    // (read at 15 m: a lean from the hips, the head thrust, the lantern held
    // up at eye height and out; a slow weave as he peers)
    dh_peer: { duration: 2.0, loop: true, def: () => ({ armSpace: 'root', pose: (t) => {
      const b = S(TAU * t / 2.0), w = S(TAU * t / 4.0);
      return P({ ...CARRY, spine: [13, 3 * w, 0], chest: [9 + 1.5 * b, 4 * w, 0], neck: [14, 0, 0], head: [-10, 0, 0],
        handTR: [-0.1, 1.44 + 0.02 * b, 0.56], elbowPoleR: [-1, -0.5, -0.4], handR: [-24, 0, -10], armL: [0.22, -1, 0.26, 0], elbowL: [38] });
    } }) },
    dh_fix: { duration: 2.4, loop: true, def: () => ({ armSpace: 'root', pose: (t) => {
      const b = S(TAU * t / 1.2);
      return P({ spine: [4, 0, 0], chest: [2, 0, 0], neck: [4, 0, 0], head: [-10, 0, 0],
        handTR: [-0.1, 1.46 + 0.03 * b, 0.42], elbowPoleR: [-1, -0.8, -0.2], handR: [-60, 0, 0],
        handTL: [0.12, 1.4, 0.4], elbowPoleL: [1, -0.8, -0.2], handL: [-60, 0, 0] });
    } }) },
    // the blow from behind: the head snaps forward and the knees go at once
    // - he drops onto them as a dead weight falls (0.3 s, a jolt as they
    // take it), then tips over onto his side, falling (0.42 to 0.9) and
    // settling. (It was a slow sink: 0.7 s to his knees, 1.4 s down.)
    dh_fold: { duration: 1.1, hold: true, marks: { knees: 0.3, down: 0.9 }, def: () => ({ armSpace: 'root', rootMotion: null, pose: (t) => {
      // (a fall: eased in, as gravity takes it; the knees' jolt a little
      // past the kneel and back)
      const fall = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u; };
      const k1 = fall(0.02, 0.3, t) + 0.07 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.3) / 0.16)));
      const k2 = Math.min(1, fall(0.42, 0.86, t) * 0.97 + 0.03 * sstep(0.86, 1.05, t));
      const hipY = lerp(lerp(0.955, 0.5, k1), 0.17, k2);
      return P({
        hipsPos: [lerp(0, 0.1, k2), hipY, lerp(0, 0.05, k1) + lerp(0, 0.25, k2)],
        hips: [lerp(0, 25, k1), 0, lerp(0, 75, k2)], spine: [lerp(3, 25, k1), 0, 0], chest: [lerp(-2, 20, k1), 0, 0],
        neck: [lerp(8, 30, sstep(0, 0.25, t)), 0, 0], head: [lerp(-5, 10, k1), lerp(0, 30, k2), 0],
        armL: [lerp(0.12, 0.3, k1), -1, lerp(0.07, 0.5, k1), 0], elbowL: [lerp(14, 40, k1)],
        armR: [lerp(-0.12, -0.3, k1), -1, lerp(0.1, 0.6, k1), 0], elbowR: [lerp(24, 50, k1)],
        footL: mix([0.115, A, 0.02], [0.12, 0.12, -0.45], k1).map((v, i) => (i === 1 ? lerp(v, 0.1, k2) : v)),
        footR: mix([-0.115, A, 0.0], [-0.12, 0.12, -0.45], k1).map((v, i) => (i === 1 ? lerp(v, 0.3, k2) : v)),
        footRotL: [lerp(0, -70, k1), 8, 0], footRotR: [lerp(0, -70, k1), 8, 0],
        kneeL: [0.1, -0.2, 1], kneeR: [-0.1, -0.2, 1],
      });
    } }) },
    dh_down: { duration: 3.4, loop: true, def: () => ({ armSpace: 'root', pose: (t) => {
      const b = S(TAU * t / 3.4);
      return P({
        hipsPos: [0.1, 0.17, 0.3], hips: [25, 0, 75], spine: [25, 0, 0], chest: [20 + 1.5 * b, 0, 0], neck: [30, 0, 0], head: [10, 30, 0],
        armL: [0.3, -1, 0.5, 0], elbowL: [40], armR: [-0.3, -1, 0.6, 0], elbowR: [50],
        footL: [0.12, 0.1, -0.45], footR: [-0.12, 0.3, -0.45], footRotL: [-70, 8, 0], footRotR: [-70, 8, 0],
        kneeL: [0.1, -0.2, 1], kneeR: [-0.1, -0.2, 1],
      });
    } }) },
  },
};

export { CARRY };
