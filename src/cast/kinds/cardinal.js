import * as THREE from 'three';
import { NEUTRAL, mergePose, samplePoseKeys, ANKLE_Y, JOINT_INDEX } from '../../enemies/HoodRig.js';
import { chainKeys, gaitPose, WALK_G } from '../../enemies/HoodAnim.js';
import { grid, orientOut } from '../../enemies/Hood.js';
import { sstep, lerp } from '../tailor.js';
import { accentMaterial } from '../../render/accents.js';

// The boss, "the Cardinal" (B7, scene 9; STORY.md's cast): wide and slow.
// A homburg, an overcoat to the calf with a fur collar standing round his
// jaw, a cane in the left hand, a pistol in his free hand, a cigar. The
// best silhouette in the game, readable at forty metres: the widest
// shoulders of anyone, a belly the coat carries forward, the pale fur ring
// between the black hat and the black coat, the stiff hat's curled brim and
// dented crown, the cane's line to the street.
// Built on the Hood's skeleton by the tailor (cast/tailor.js); the homburg
// is a garment of this file (the tailor has no such cover), weighted to the
// hat bone. Clips of his own: his stance, his aim (one hand: the other on
// the cane), a knee going.
// Exports for the scene: homburgGeometry(k), makeCigar(), and the default kind.
const A = Math.abs;
const TAU = Math.PI * 2;
const B = JOINT_INDEX;

// ---- the homburg: a stiff crown with a gutter crease down its middle, a band,
// a brim rolled up all round (more at the sides); in the hat bone's space,
// metres, before the costume's scale
// (profile: [r, y] from the crown's top out, down the side, round the brim's
// rolled edge and back under it to the head's opening)
const HOMBURG = [
  [0.0, 0.128], [0.04, 0.128], [0.07, 0.125], [0.084, 0.118], [0.09, 0.104], [0.093, 0.075], [0.096, 0.042],
  [0.098, 0.03], [0.099, 0.012], [0.101, 0.006],
  [0.13, 0.004], [0.155, 0.008], [0.168, 0.016], [0.176, 0.027], [0.181, 0.026], [0.182, 0.018], [0.178, 0.009],
  [0.168, 0.003], [0.14, -0.003], [0.1, -0.004], [0.088, -0.002], [0.0, -0.002],
];
function homburgPoint(u, v, p, k = 1, dz = 0) {
  const n = HOMBURG.length - 1, f = v * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const r = lerp(HOMBURG[i][0], HOMBURG[i + 1][0], t), y0 = lerp(HOMBURG[i][1], HOMBURG[i + 1][1], t);
  const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
  // (a slightly oval crown, longer front to back; the brim's roll higher at
  // the sides, flatter front and back; the gutter crease down the crown)
  const brim = sstep(0.1, 0.16, r);
  let y = y0 + brim * 0.016 * sn * sn;
  const crease = Math.exp(-(((r * sn) / 0.026) ** 2)) * sstep(0.1, 0.125, y0) * (r < 0.095 ? 1 : 0);
  y -= 0.024 * crease;
  const ox = r < 0.102 ? 0.92 : lerp(0.92, 1.0, brim);
  p.set(r * sn * ox * k, y * k, (r * cs + dz) * k);
  return p;
}
export function homburgGeometry(k = 1) {
  const geo = grid(72, HOMBURG.length * 3, (u, v, p) => homburgPoint(u, v, p, k));
  orientOut(geo, new THREE.Vector3(0, 0.05 * k, 0));
  geo.computeVertexNormals();
  return geo;
}

// ---- the cigar: a fat dark roll, its ash end and the ember (accent 'ember')
export function makeCigar({ inkId = null } = {}) {
  const g = new THREE.Group();
  const L = 0.13, r = 0.0105;
  const leaf = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 });
  const pts = [[0.0, 0], [r * 0.7, 0.004], [r, 0.02], [r, L - 0.018], [r * 0.9, L - 0.004], [r * 0.82, L]].map(([a, b]) => new THREE.Vector2(a, b));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18).rotateZ(-Math.PI / 2), leaf);
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.84, r * 0.8, 0.012, 16).rotateZ(Math.PI / 2).translate(L + 0.006, 0, 0), new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 1 }));
  const ember = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 14, 10).scale(0.55, 1, 1).translate(L + 0.013, 0, 0), accentMaterial('ember', { gain: 1 }));
  for (const m of [body, ash, ember]) { if (inkId != null) { m.userData.inkId = inkId; m.userData.inkFigure = true; } m.userData.noRay = true; m.castShadow = false; g.add(m); }
  g.userData.ember = ember;
  g.userData.len = L;
  return g;
}

// the cane: a black stick, a silver knob, a ferrule; its knob at the origin
// (in the hand), the stick down -y
function makeCane() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, 0.86, 12).translate(0, -0.45, 0), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.4, metalness: 0.2 }));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12).scale(1, 0.85, 1).translate(0, 0.0, 0), new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.3, metalness: 0.9 }));
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.0095, 0.03, 10).translate(0, -0.89, 0), new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.4, metalness: 0.8 }));
  g.add(stick, knob, tip);
  g.userData = { kind: 'cane', grip: new THREE.Matrix4(), size: new THREE.Vector3(0.04, 0.9, 0.04) };
  return g;
}

// his pistol: a heavy automatic, its grip in the palm, the barrel down the
// hand (-y), its muzzle where the Hood's is (Hood.js MUZZLE_LOCAL)
function makePistol() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.45, metalness: 0.5 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.036).translate(0, -0.13, 0.05), m);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.1, 0.034).translate(0, -0.02, 0.012).rotateX(0.25), m);
  g.add(slide, grip);
  g.userData = { kind: 'pistol', grip: new THREE.Matrix4(), size: new THREE.Vector3(0.03, 0.2, 0.05) };
  return g;
}

// ---- the costume ---------------------------------------------------------------------
const CARDINAL = {
  h: 1.9,
  body: {
    // a barrel of a man: the widest shoulders in the game (0.66 across the
    // coat), a belly the coat carries forward, a thick short neck
    torso: [
      [0.92, 0.215, 0.17, 0.158, 0.03, 2.3],
      [1.0, 0.224, 0.2, 0.158, 0.05, 2.25],
      [1.08, 0.232, 0.212, 0.156, 0.058, 2.25],
      [1.16, 0.238, 0.206, 0.156, 0.05, 2.35],
      [1.24, 0.248, 0.19, 0.16, 0.036, 2.5],
      [1.32, 0.262, 0.178, 0.166, 0.02, 2.8],
      [1.38, 0.276, 0.164, 0.164, 0.008, 3.2],
      [1.425, 0.282, 0.15, 0.154, -0.002, 3.6],
      [1.455, 0.27, 0.132, 0.138, -0.01, 3.5],
      [1.478, 0.236, 0.116, 0.122, -0.014, 3.0],
      [1.496, 0.172, 0.104, 0.11, -0.016, 2.6],
      [1.512, 0.105, 0.094, 0.1, -0.017, 2.3],
    ],
    shoulderX: 0.232, shoulderY: 1.41, upper: 0.31, fore: 0.28, hipX: 0.112,
    neckR: 0.066, neckFlare: 0.03, neckY: 1.48, headY: 1.556, headS: 1.04, headW: 1.05, jaw: 0.14, hairLine: 0.2,
  },
  cover: { kind: 'none', hatDY: 0.118, hatDZ: 0.004, pitch: 0.04 },
  garments: [
    { kind: 'torso', shade: 'coat' },
    // the overcoat's skirt to the calf, heavy, barely parted
    { kind: 'skirt', y0: 1.0, hem: 0.3, split: 0.35, flare: [1.3, 1.42], back: 0.6, folds: 0.9, grow: 0.014, shade: 'coat' },
    { kind: 'lapels', near: true, top: 1.46, low: 1.18, shade: 'lapel' },
    // the fur: a thick ring standing round the jaw and lying on the shoulders
    { kind: 'collar', style: 'fur', r: 0.042, shade: 'fur', nu: 72, nv: 14 },
    { kind: 'sleeves', style: 'long', r: 0.098, cuff: 0.088 },
    { kind: 'legs', r: 1.15 },
    { kind: 'shoes' },
    { kind: 'hands', s: 1.08 },
    // the homburg, on the hat bone (a cover the tailor does not have)
    { kind: 'custom', build: (F, H) => {
      const hb = F.rig.BIND.hat, c = F.cover;
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch ?? 0.05);
      const geo = H.grid(H.seg(72, 20), H.seg(HOMBURG.length * 3, 12), (u, v, p) => { homburgPoint(u, v, p, 1.04); p.applyQuaternion(tilt).add(hb); });
      H.orientOut(geo, hb.clone().add(new THREE.Vector3(0, 0.05, 0)));
      const band = F.shade('band'), felt = F.shade('cover');
      return [{ geo, shade: (x, y) => { const h = y - hb.y; return h > 0.012 && h < 0.036 && Math.hypot(x - hb.x, 0) < 0.12 ? band : felt; }, weights: () => [[B.hat, 1]] }];
    } },
  ],
  skin: { coat: 0.011, lapel: 0.01, fur: 0.07, hand: 0.022, skin: 0.03, cover: 0.007, band: 0.002, trousers: 0.006, shoes: 0.004 },
  collider: 0.4,
};

// ---- his clips (the pose keys: the Hood's rig, model metres) --------------------------
const P = (o) => mergePose(NEUTRAL, o);
// the stance: square and heavy, the cane planted out at his left, the gun
// hand down; a slow breath
const STANCE = {
  hipsPos: [0, 0.945, 0], hips: [-2, 0, 0], spine: [2, 0, 0], chest: [-3, 0, 0], neck: [6, 0, 0], head: [-3, 0, 0],
  footL: [0.14, ANKLE_Y, 0.04], footR: [-0.14, ANKLE_Y, 0.0], footRotL: [0, 12, 0], footRotR: [0, 12, 0],
  handTL: [0.3, 0.86, 0.12], elbowPoleL: [1, 0.2, -0.6], handL: [0, 0, 8],
  armR: [-0.13, -1, 0.14, 0], elbowR: [20], handR: [-30, 0, -4],
};
// the aim: one hand; the pistol straight out, the chest turned into it; the
// cane planted
const AIM = {
  ...STANCE,
  hipsPos: [0.004, 0.94, 0], hips: [0, 12, 0], spine: [2, 8, 0], chest: [-4, 12, 0], neck: [4, -8, 0], headLevel: [0.9], headRoot: [4, 2, 0],
  footL: [0.15, ANKLE_Y, 0.06], footR: [-0.15, ANKLE_Y, -0.06], footRotL: [0, 14, 0], footRotR: [0, 20, 0],
  shoulderR: [0, -6, -4], armR: [0.03, 0.02, 1, 0], elbowR: [2], handR: [6, 0, 0],
};
// a knee goes: he drops onto his right knee, the cane holding him, the head
// down; holds; heaves himself up on the cane
const KNEE = chainKeys([
  [0, STANCE],
  [0.18, { hipsPos: [0, 0.82, 0.02], hips: [8, 0, 0], spine: [8, 0, 0], chest: [6, 0, 0], neck: [14, 0, 0], head: [8, 0, 0],
    footR: [-0.14, 0.14, -0.2], footRotR: [-30, 10, 0], kneeR: [-0.1, -0.3, 1], handTL: [0.3, 0.7, 0.28] }],
  [0.42, { hipsPos: [0.02, 0.56, 0.06], hips: [14, 0, -4], spine: [10, 0, 2], chest: [10, 0, 0], neck: [18, 0, 0], head: [10, 0, 0],
    footL: [0.15, ANKLE_Y, 0.32], footRotL: [0, 10, 0], kneeL: [0.1, 0.2, 1],
    footR: [-0.14, 0.1, -0.42], footRotR: [-70, 10, 0], kneeR: [-0.1, -1, 0.4],
    handTL: [0.3, 0.52, 0.38], armR: [-0.2, -1, 0.3, 0], elbowR: [30] }],
  [0.5, { hipsPos: [0.02, 0.58, 0.06] }],
  [1.05, { hipsPos: [0.02, 0.575, 0.06], chest: [12, 0, 0], neck: [20, 0, 0] }],
  [1.45, { hipsPos: [0.01, 0.78, 0.04], hips: [8, 0, -2], footR: [-0.14, 0.1, -0.2], footRotR: [-30, 10, 0], kneeR: [-0.1, -0.2, 1], handTL: [0.3, 0.66, 0.3], chest: [4, 0, 0] }],
  [1.8, STANCE],
]);

// ---- Dot's clip with the gun (scene 9's arrival): object first --------------------------
// She bends behind the counter, comes up with the Tommy gun lying flat in
// her two hands, lays it on the counter top before me, then brings up two
// drums stacked in her right hand and sets them beside it. The gun's path
// and the drums' are authored here, in her own frame (metres: x her left,
// y up from her feet, z ahead; she stands 0.28 behind the counter's back
// edge, its top at 1.05); her hands are put on them. The scene places the
// real things on the same paths (dotGunAt, dotDrumsAt).
export const DOT_CLIP = { gun: 0.55, gunDown: 1.58, drumsUp: 2.05, drumsDown: 2.5, duration: 3.0 };
const GUN_KEYS = [[0.55, [0.24, 0.6, 0.3]], [0.8, [0.27, 0.84, 0.32]], [1.05, [0.31, 1.2, 0.4]], [1.3, [0.35, 1.22, 0.6]], [1.46, [0.37, 1.09, 0.72]], [1.58, [0.37, 1.05, 0.74]]];
const DRUM_KEYS = [[2.05, [-0.12, 0.62, 0.3]], [2.25, [-0.26, 1.16, 0.4]], [2.4, [-0.44, 1.2, 0.54]], [2.5, [-0.5, 1.05, 0.58]]];
function pathAt(keys, t) {
  if (t <= keys[0][0]) return keys[0][1].slice();
  if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1][1].slice();
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
  const k0 = keys[Math.max(0, i - 1)][1], k1 = keys[i][1], k2 = keys[i + 1][1], k3 = keys[Math.min(keys.length - 1, i + 2)][1];
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  const u2 = u * u, u3 = u2 * u;
  return [0, 1, 2].map((j) => 0.5 * ((2 * k1[j]) + (-k0[j] + k2[j]) * u + (2 * k0[j] - 5 * k1[j] + 4 * k2[j] - k3[j]) * u2 + (-k0[j] + 3 * k1[j] - 3 * k2[j] + k3[j]) * u3));
}
// (the gun tips its muzzle a little as it comes over the counter)
export const dotGunAt = (t) => ({ p: pathAt(GUN_KEYS, t), tilt: 0.12 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.8) / 0.7))) });
export const dotDrumsAt = (t) => ({ p: pathAt(DRUM_KEYS, t) });
const LEAN = { hipsPos: [0.03, 0.935, -0.06], hips: [-4, 8, -7], spine: [4, -4, 3], chest: [-2, -4, 3], neck: [6, 0, 0], head: [-4, 0, -3], headLevel: [0.5], headRoot: [2, 0, 0],
  footL: [0.07, ANKLE_Y, 0.07], footR: [-0.02, ANKLE_Y + 0.01, 0.13], footRotL: [0, 14, 0], footRotR: [8, -10, 0], kneeR: [0.2, 0, 1], kneeL: [0.1, 0, 1],
  handTL: [0.12, 1.1, 0.3], handTR: [-0.1, 1.1, 0.3], elbowPoleL: [1, -0.4, 0.3], elbowPoleR: [-1, -0.4, 0.3], handL: [-60, 0, 20], handR: [-60, 0, -20] };
function dotGunPose(s) {
  // the wrist above and a little behind what the hand holds
  const w = (p, dx = 0) => [(p[0] + dx) / s, (p[1] + 0.075) / s, (p[2] - 0.045) / s];
  const keys = [[0, LEAN],
    [0.35, { hipsPos: [0, 0.7, -0.02], hips: [24, 0, 0], spine: [20, 0, 0], chest: [14, 0, 0], neck: [12, 0, 0], head: [6, 0, 0], headLevel: [0.2],
      footL: [0.12, ANKLE_Y, 0.14], footR: [-0.12, ANKLE_Y, -0.1], footRotR: [-20, 8, 0], footRotL: [0, 10, 0], kneeL: [0.3, 0.2, 1], kneeR: [-0.2, 0, 1],
      handTR: [-0.08, 0.72, 0.28], handTL: [0.26, 0.72, 0.28], elbowPoleL: [1, -0.3, -0.2], elbowPoleR: [-1, -0.3, -0.2], handL: [-80, 0, 0], handR: [-80, 0, 0] }]];
  for (const t of [0.55, 0.7, 0.85, 1.0, 1.15, 1.3, 1.42, 1.52, 1.58]) {
    const g = dotGunAt(t).p;
    const up = Math.min(1, Math.max(0, (t - 0.55) / 0.6));
    const o = { handTR: w(g, -0.3), handTL: w(g, 0.12), handR: [-75, 0, -6], handL: [-75, 0, 6] };
    o.hipsPos = [0, 0.7 + 0.22 * up, -0.02 + 0.05 * up];
    const over = Math.min(1, Math.max(0, (t - 1.15) / 0.35));
    o.hips = [24 - 14 * up + 8 * over, 0, 0]; o.spine = [20 - 8 * up + 8 * over, 0, 0]; o.chest = [14 - 4 * up + 4 * over, 0, 0]; o.neck = [12 - 2 * up, 0, 0];
    keys.push([t, o]);
  }
  const dr = (t) => w(dotDrumsAt(t).p, 0.02);
  keys.push([1.72, { handTR: w([0.02, 1.12, 0.62]), handTL: w([0.44, 1.12, 0.6]), hipsPos: [0, 0.91, 0.02], hips: [10, 0, 0], spine: [12, 0, 0] }]);
  keys.push([1.9, { handTR: [-0.1 / s, 0.8 / s, 0.28 / s], handTL: w([0.2, 1.05, 0.34]), handL: [-40, 0, 20], hipsPos: [0, 0.82, 0.0], hips: [18, 0, 0], spine: [16, 0, 0], chest: [10, -6, 0] }]);
  for (const t of [2.05, 2.18, 2.3, 2.4, 2.5]) keys.push([t, { handTR: [dr(t)[0], dr(t)[1] + 0.06 / s, dr(t)[2]], handR: [-85, 0, -10], hipsPos: [0, 0.82 + 0.1 * Math.min(1, (t - 2.05) / 0.3), 0.01], hips: [16 - 6 * Math.min(1, (t - 2.05) / 0.3), 0, 0], chest: [10, -10, 0] }]);
  keys.push([2.65, { handTR: w([-0.36, 1.18, 0.5]), handR: [-60, 0, -20] }]);
  keys.push([3.0, { ...LEAN }]);
  const K = chainKeys(keys);
  return (t) => samplePoseKeys(K, t);
}

export default {
  kind: 'cardinal', h: 1.9, name: 'cardinal',
  costume: CARDINAL,
  clips: {
    cardinal_stance: { duration: 5, loop: true, def: () => ({ armSpace: 'root', pose: (t) => {
      const b = Math.sin(TAU * t / 5);
      const p = P(STANCE);
      p.hipsPos = [0, 0.945 + 0.003 * b, 0];
      p.chest = [-3 - 0.8 * b, 0, 0];
      return p;
    } }) },
    cardinal_aim: { duration: 2, loop: true, def: () => ({ armSpace: 'root', pose: (t) => {
      const w = Math.sin(TAU * t / 2);
      const p = P(AIM);
      p.armR = [0.03 + 0.004 * Math.sin(TAU * t / 2 + 2), 0.02 + 0.006 * w, 1, 0];
      return p;
    } }) },
    cardinal_knee: { duration: 1.8, def: () => ({ armSpace: 'root', pose: (t) => samplePoseKeys(KNEE, t) }) },
    // (Dot's, scene 9: the gun up from under the counter, the drums after it)
    b7_dotGun: { duration: DOT_CLIP.duration, marks: { gun: DOT_CLIP.gun, gunDown: DOT_CLIP.gunDown, drumsUp: DOT_CLIP.drumsUp, drumsDown: DOT_CLIP.drumsDown }, then: 'lean',
      def: (ctx) => ({ armSpace: 'root', fps: 60, pose: dotGunPose(ctx.s) }) },
    // his walk: the Hood's, heavier (a wider stance), the cane swung out and
    // planted with the right foot
    cardinal_walk: { duration: 1.1, loop: true, def: () => ({ pose: (t) => {
      const u = t / 1.1;
      const p = gaitPose(u, { ...WALK_G, stepW: 0.14, lift: 0.06, strikePitch: 12 });
      const ph = Math.sin(TAU * u);
      p.armL = [0.24 + 0.04 * ph, -1, 0.18 + 0.22 * ph, 0];
      p.elbowL = [18 + 8 * Math.max(0, ph)];
      p.handL = [0, 0, 8];
      p.chest = [(p.chest ? p.chest[0] : 0) - 2, (p.chest ? p.chest[1] : 0) * 0.6, 0];
      return p;
    } }) },
  },
  idle: 'cardinal_stance',
  onSpawn(c, fig) {
    // the cane in his left hand, the pistol in his right, the cigar in his teeth
    const cane = makeCane(), pistol = makePistol();
    c.hold(cane, 'L', { grip: 'hang' });
    c.hold(pistol, 'R', { grip: 'hang' });
    const cig = makeCigar({ inkId: fig.inkId });
    cig.scale.setScalar(1 / fig.scale);
    cig.position.set(0.02, -0.035, 0.105).divideScalar(1);
    cig.rotation.set(0.25, -0.35, 0);
    cig.rotation.order = 'YXZ';
    cig.rotation.y = -Math.PI / 2 - 0.3;
    fig.bones.head.add(cig);
    fig.b7cigar = cig;
    for (const o of [cane, pistol]) o.traverse((m) => { if (m.isMesh) { m.userData.inkId = fig.inkId; m.userData.inkFigure = true; m.castShadow = true; } });
    c.items.set('cane', cane); c.items.set('pistol', pistol); c.items.set('cigar', cig);
  },
};
export { A };
