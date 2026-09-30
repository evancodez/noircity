import { NEUTRAL, mergePose, samplePoseKeys, ANKLE_Y } from '../../enemies/HoodRig.js';
import { chainKeys } from '../../enemies/HoodAnim.js';
import { GUARD, REEL } from '../brawl/clips.js';

// The foreman (lane B6 built the kind; lane R2-E fights him: the second fist
// fight, Pier 9's loading bay, docs/story/briefs/B9_PIER_FIGHT.md). As big
// as Mack and quieter; an outline that is not Mack's: Mack is a barrel in a
// waistcoat, the foreman a wedge - the widest shoulders on the pier over
// narrow hips, long arms, a flat cap low, his jacket off (it hangs on a
// crate by the door): a collarless shirt, the sleeves rolled over forearms
// like hawsers, black braces over it, heavy trousers, boots. A cargo hook in
// his right fist (the scene's prop): the hook is his signature.
const A = Math.abs;
const FOREMAN = {
  body: {
    // (a wedge: 0.62 across the shoulders, world; the waist and the hips a
    // hand narrower than Mack's; a flat chest, not a belly)
    torso: [
      [0.9, 0.188, 0.14, 0.14, 0.004, 2.3],
      [0.98, 0.186, 0.142, 0.138, 0.008, 2.3],
      [1.07, 0.192, 0.148, 0.138, 0.012, 2.4],
      [1.16, 0.21, 0.158, 0.146, 0.014, 2.5],
      [1.25, 0.236, 0.168, 0.156, 0.014, 2.7],
      [1.33, 0.262, 0.172, 0.162, 0.008, 3.1],
      [1.39, 0.282, 0.162, 0.158, -0.002, 3.6],
      [1.435, 0.28, 0.146, 0.146, -0.008, 3.6],
      [1.462, 0.25, 0.128, 0.13, -0.012, 3.1],
      [1.482, 0.186, 0.11, 0.114, -0.014, 2.7],
      [1.5, 0.114, 0.096, 0.1, -0.015, 2.3],
    ],
    // (long arms: the upper arm and the forearm each 2 to 3 cm past Mack's)
    shoulderX: 0.232, shoulderY: 1.41, upper: 0.34, fore: 0.315, hipX: 0.1,
    neckR: 0.08, neckFlare: 0.035, neckY: 1.475, headY: 1.55, headS: 1.04, headW: 1.02, jaw: 0.08, hairLine: 0.1,
  },
  cover: { kind: 'flatcap', hatDY: 0.122, hatDZ: 0.014, pitch: 0.2, s: 1.05, peak: 0.066, peakDrop: 0.36 },
  garments: [
    // the shirt (a mid grey, work-worn), the trousers' waistband under it,
    // the braces two black bands over the shoulders, front and back
    { kind: 'torso', shade: (th, y) => {
      if (y < 1.06) return 0.008;
      const brace = A(A(th) - 0.36) < 0.05 || A(A(th) - 2.75) < 0.05;
      return brace && y < 1.5 ? 0.004 : 0.075;
    } },
    { kind: 'collar', style: 'band', h: 0.024, hFront: 0.02, open: 0.3, gap: 0.004, lean: 0.002, flareOut: 0.002, shade: 0.075 },
    // (rolled above the elbow: the forearms and the fists are his light
    // shapes, what the eye follows)
    { kind: 'sleeves', style: 'rolled', r: 0.088, len: 0.34 + 0.08, shade: 0.075 },
    { kind: 'arms', r: 0.06, d0: 0.19, wrist: 0.5 },
    { kind: 'legs', r: 1.15, boot: true },
    { kind: 'shoes', style: 'boot' },
    { kind: 'hands', s: 1.12, fist: true },
  ],
  skin: { arm: 0.3, hand: 0.3, skin: 0.03, hair: 0.004, cover: 0.012, peak: 0.009, trousers: 0.007, shoes: 0.004 },
  collider: 0.38,
};

// ---- his clips ---------------------------------------------------------------------------
// Root space as every cast clip: he faces +z, his left is +x; a clip that
// travels carries its root (rm(t) = [x, z], model metres). His right hand
// holds the hook: its point out past the knuckles, forward.
const S = Math.sin;
const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const keyed = (arr) => { const K = chainKeys(arr); return (t) => samplePoseKeys(K, t); };
function rooted(poseFn, rm) {
  return (t) => {
    const p = poseFn(t);
    const [x, z] = rm(t);
    for (const k of ['hipsPos', 'footL', 'footR', 'handTL', 'handTR']) if (p[k]) p[k] = [p[k][0] - x, p[k][1], p[k][2] - z, ...p[k].slice(3)];
    return p;
  };
}
const clip = (keys, { base = GUARD, rm = null } = {}) => () => {
  const K = keyed([[0, base], ...keys]);
  return { armSpace: 'root', fps: 60, pose: rm ? rooted(K, rm) : K, rootMotion: rm };
};

// the hook swing (the long arc): he winds his whole trunk to his right, the
// hook drawn back and out wide behind his shoulder at chest height, the left
// hand forward on guard, and HOLDS it (the tell, 0.52 s: the longest in the
// game after the haymaker); then it comes round flat at arm's length and a
// hook's length, from his right across to his left, and follows through.
// A step to the side is not enough (the arc is two metres wide): back, or
// inside it (FIGHT.md's pier addendum; the rules' path `min`)
const HOOK_SWING = [
  // (the tell: wound up, the hook back beside his head, the elbow high and
  // back, the point up over his shoulder - tight to his outline, not an arm
  // flung out)
  [0.13, { hips: [2, -38, 0], spine: [4, -12, 0], chest: [4, -44, 8], neck: [8, 20, 0], head: [8, 24, 0], hipsPos: [0, 0.9, -0.08],
    handTR: [-0.4, 1.58, -0.16], elbowPoleR: [-1, 0.35, -0.55], handR: [30, 40, 60], shoulderR: [0, 8, 14],
    handTL: [0.16, 1.4, 0.34], elbowPoleL: [0.6, -1, 0.3], footR: [-0.2, ANKLE_Y, -0.28], footRotR: [0, 40, 0] }],
  [0.3, { chest: [4, -48, 9], handTR: [-0.43, 1.6, -0.2] }],
  [0.52, { chest: [4, -48, 9], handTR: [-0.43, 1.6, -0.2] }],
  // (it comes round flat and wide at chest height)
  [0.6, { hips: [6, -12, 0], spine: [6, -6, 0], chest: [6, -18, 4], neck: [8, 8, 0], head: [8, 6, 0], hipsPos: [0, 0.89, 0.02],
    handTR: [-0.64, 1.38, 0.38], elbowPoleR: [-1, 0.4, 0.2], handR: [-20, 20, 80], shoulderR: [0, 0, 6] }],
  [0.66, { hips: [8, 14, 0], spine: [8, 8, 0], chest: [8, 26, -4], hipsPos: [0, 0.88, 0.06], footL: [0.15, ANKLE_Y, 0.34],
    handTR: [0.02, 1.34, 0.88], elbowPoleR: [-0.6, 0.6, 0.6], handR: [-40, 0, 80], handTL: [0.3, 1.22, 0.2] }],
  [0.8, { hips: [8, 30, 0], chest: [8, 46, -6], handTR: [0.56, 1.26, 0.44], elbowPoleR: [0.2, 0.4, 1], handR: [-40, 0, 90] }],
  [0.96, { chest: [6, 40, -4], handTR: [0.48, 1.22, 0.34] }],
  [1.3, { ...GUARD, footL: [0.14, ANKLE_Y, 0.3] }],
];
// the chop: the hook raised high over his right shoulder, held; then it
// comes straight down at me. A step to the side takes me out of it
// (an overhand: the rules' 'over')
const HOOK_CHOP = [
  [0.13, { hips: [0, -26, 0], spine: [-4, -8, 0], chest: [-10, -24, 10], neck: [10, 10, 0], head: [2, 14, 0], hipsPos: [0, 0.92, -0.08],
    handTR: [-0.26, 1.98, -0.14], elbowPoleR: [-1, 0.4, -0.6], handR: [40, 0, -20], shoulderR: [0, 0, 16], handTL: [0.18, 1.42, 0.32] }],
  [0.5, { handTR: [-0.28, 2.0, -0.16] }],
  [0.62, { hips: [14, 6, 0], spine: [14, 4, 0], chest: [18, 10, -4], neck: [18, 0, 0], head: [2, 0, 0], hipsPos: [0, 0.84, 0.16], footL: [0.14, ANKLE_Y, 0.42],
    handTR: [-0.02, 1.22, 0.84], elbowPoleR: [-1, 0.8, 0.3], handR: [-70, 0, 0], handTL: [0.3, 1.1, 0.26] }],
  [0.78, { handTR: [0.04, 0.9, 0.62], chest: [22, 12, -4] }],
  [1.2, { ...GUARD, hipsPos: [0, 0.93, 0.12], footL: [0.14, ANKLE_Y, 0.36] }],
];
const CHOP_RM = (t) => [0, 0.14 * sstep(0.52, 0.66, t)];
// the hook knocked out of his fist: the hand flung open and shaken, pulled
// in to his chest, a step back; then his fists come up
const DISARMED = [
  [0.07, { handTR: [-0.42, 1.2, -0.02], elbowPoleR: [-1, -0.4, -0.4], handR: [30, 0, -40], chest: [-6, -18, 6], neck: [4, -16, 0], head: [-10, -20, 0], hipsPos: [0, 0.92, -0.12] }],
  [0.24, { handTR: [-0.1, 1.18, 0.12], handR: [-20, 0, 20], chest: [4, -10, 4], head: [6, 10, 0] }],
  [0.38, { handTR: [-0.16, 1.16, 0.1] }],
  [0.62, { ...GUARD }],
];
// ---- the last blow: back through the loading door's planks and into the
// river. The rules put him on the finish spot, his back to the door: the
// door's inner face 0.45 m behind his root (model metres), its planks at
// 0.55; the pier's edge 0.45 past the wall, the water 1.7 below the floor.
// His back meets the planks (0.2), they burst (the 'glass' mark: the room
// bursts the door), he goes back through, over the edge, tipping (0.62),
// falls feet over head, into the water on his back (land 1.02: the splash),
// and goes under (the water hides him by 1.7 s). Every key's hips over the
// river are below the floor only past the pier's edge.
export const RIVER = { door: 0.45, edge: 1.45, water: -1.7, travel: 2.2 };
const Z = RIVER.travel;
const KO_RIVER = [
  [0, REEL],
  // the blow: the head snaps back, the arms fly up, a step back
  [0.1, { hipsPos: [0, 0.92, -0.16], hips: [-12, 0, 0], spine: [-10, 0, 0], chest: [-18, 8, 0], neck: [-24, 0, 0], head: [-34, 14, 0], headLevel: [0],
    handTL: [0.44, 1.36, 0.1], handTR: [-0.38, 1.5, 0.0], elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0.2, 0], footR: [-0.17, ANKLE_Y + 0.06, -0.24], footRotR: [-10, 20, 0] }],
  // his back into the planks: they go
  [0.22, { hipsPos: [0, 0.92, -0.36], hips: [-26, 0, 0], spine: [-14, 0, 0], chest: [-22, 8, 0], head: [-30, 12, 0], footR: [-0.17, ANKLE_Y, -0.3], footL: [0.17, ANKLE_Y, -0.06],
    handTL: [0.56, 1.4, -0.2], handTR: [-0.5, 1.5, -0.3] }],
  // through the doorway, tipping back, his heels on the sill's edge
  [0.42, { hipsPos: [0, 0.9, -0.62], hips: [-50, 0, 4], spine: [-12, 0, 0], chest: [-14, 6, 0], neck: [-12, 0, 0], head: [-24, 10, 0],
    footL: [0.17, ANKLE_Y, -0.3], footR: [-0.17, ANKLE_Y + 0.1, -0.44], footRotL: [20, 14, 0], footRotR: [30, 20, 0],
    handTL: [0.7, 1.5, -0.8], handTR: [-0.66, 1.56, -0.9], elbowPoleL: [1, 0.2, 0], elbowPoleR: [-1, 0.2, 0] }],
  // off the edge: over backwards in the air, his feet coming up
  [0.62, { hipsPos: [0, 0.5, -0.9], hips: [-100, 0, 8], spine: [-8, 0, 0], chest: [-10, 0, 0], neck: [-8, 0, 0], head: [-16, 8, 0],
    footL: [0.15, 0.95, -0.1], footR: [-0.15, 0.8, -0.2], kneeL: [0.2, 1, 0.2], kneeR: [-0.2, 1, 0.2], footRotL: [60, 14, 0], footRotR: [60, 20, 0],
    handTL: [0.7, 0.5, -1.4], handTR: [-0.66, 0.4, -1.5] }],
  // falling, head first, on his back
  [0.84, { hipsPos: [0, -0.5, -1.0], hips: [-140, 0, 10], chest: [-6, 0, 0], head: [-10, 8, 0],
    footL: [0.14, 0.25, -0.5], footR: [-0.16, 0.1, -0.56], kneeL: [0.1, 1, -0.5], kneeR: [-0.1, 1, -0.5], footRotL: [90, 14, 0], footRotR: [90, 20, 0],
    handTL: [0.66, -0.9, -1.5], handTR: [-0.6, -1.0, -1.56] }],
  // the water (land: the splash)
  [1.02, { hipsPos: [0, -1.55, -1.04], hips: [-160, 0, 10], footL: [0.14, -0.9, -0.7], footR: [-0.16, -1.0, -0.74], handTL: [0.7, -1.9, -1.4], handTR: [-0.6, -2.0, -1.5] }],
  // under
  [1.7, { hipsPos: [0, -2.6, -1.1], hips: [-170, 0, 12], footL: [0.14, -2.0, -0.8], footR: [-0.16, -2.1, -0.86], handTL: [0.7, -2.4, -1.2], handTR: [-0.6, -2.5, -1.3] }],
  [2.2, { hipsPos: [0, -3.4, -1.1], footL: [0.14, -2.9, -0.8], footR: [-0.16, -3.0, -0.86], handTL: [0.7, -3.0, -1.2], handTR: [-0.6, -3.1, -1.3] }],
];
const KO_RIVER_RM = (t) => [0, -Z * sstep(0.08, 0.95, t)];
// his hand low at his side, the hook turning in it (the scene spins the prop)
const HOOK_DOWN = {
  handTR: [-0.3, 0.98, 0.14], elbowPoleR: [-1, -0.3, -0.4], handR: [-10, 0, -20],
};
// his jacket by its collar in his left hand, hanging at his side
const JACKET_HELD = { handTL: [0.27, 1.12, 0.1], elbowPoleL: [1, -0.4, -0.3], handL: [0, 0, 10] };
// the jacket laid over the barrel at his front left: the left hand lifts it
// out and lays it down (lay: the scene takes the cloth from the hand onto
// the barrel), then comes back to his side; the right keeps the hook low
const JACKET = [
  [0.0, { ...HOOK_DOWN, ...JACKET_HELD }],
  [0.3, { handTL: [0.42, 1.36, 0.34], elbowPoleL: [1, -0.2, -0.2], chest: [4, 14, 0], spine: [4, 6, 0], head: [8, 18, 0] }],
  [0.46, { handTL: [0.55, 1.12, 0.52], elbowPoleL: [1, -0.4, 0.2], chest: [10, 18, 0], spine: [8, 8, 0], hipsPos: [0, 0.93, 0.02] }],
  [0.7, { handTL: [0.3, 1.04, 0.22], chest: [4, 8, 0], spine: [4, 2, 0] }],
  [1.0, { ...HOOK_DOWN, handTL: [0.21, 0.97, 0.05], elbowPoleL: [1, -0.3, -0.3], handL: [0, 0, 6] }],
];

export default {
  kind: 'foreman', h: 1.97, costume: FOREMAN,
  clips: {
    fm_hookSwing: { duration: 1.3, marks: { tell: 0.0, strike: 0.52, contact: 0.66 }, def: clip(HOOK_SWING) },
    fm_hookChop: { duration: 1.2, marks: { tell: 0.0, strike: 0.5, contact: 0.62 }, def: clip(HOOK_CHOP, { rm: CHOP_RM }) },
    fm_disarmed: { duration: 0.62, marks: {}, def: clip(DISARMED) },
    fm_ko_river: { duration: 2.2, marks: { door: 0.22, glass: 0.24, over: 0.62, land: 1.02 }, hold: true, selfTravel: true, def: clip(KO_RIVER, { base: REEL, rm: KO_RIVER_RM }) },
    // (an upper-body overlay over his walk: the hook low in his right hand)
    fm_hookLow: { duration: 1.2, loop: true, def: () => ({ armSpace: 'root', pose: (t) => mergePose(NEUTRAL, { ...HOOK_DOWN, handTR: [-0.3, 0.98 + 0.01 * S(TAU * t / 1.2), 0.14] }) }) },
    // (the same, the jacket by its collar in the left)
    fm_hookJacket: { duration: 1.2, loop: true, def: () => ({ armSpace: 'root', pose: (t) => mergePose(NEUTRAL, { ...HOOK_DOWN, ...JACKET_HELD, handTR: [-0.3, 0.98 + 0.01 * S(TAU * t / 1.2), 0.14], handTL: [0.27, 1.12 - 0.01 * S(TAU * t / 1.2), 0.1] }) }) },
    fm_jacket: { duration: 1.0, marks: { lay: 0.46 }, def: () => ({ armSpace: 'root', fps: 60, pose: keyed([[0, NEUTRAL], ...JACKET]) }) },
  },
};

export { FOREMAN };
