import * as THREE from 'three';
import { NEUTRAL, mergePose, ANKLE_Y } from '../../enemies/HoodRig.js';
import { profileAt } from '../../enemies/Hood.js';

// [O8] The swell (lane O8, docs/briefs/O8_FIGURES.md §1): the topper and the
// long black coat with a white scarf, a cane in his hand - told at 20 m by
// the tall hat alone. And the cast's own clips for every kind (a kind file's
// clips are everyone's): the idles a man keeps (src/cast/style.js picks one
// by where he stands) and the gestures that show what he means to do before
// he does it (the brief's "the AI that shows").
//   o8_idleShift    the weight on one leg, then the other; a look round
//   o8_idlePockets  hands in the coat's pockets, the shoulders up against the rain
//   o8_idleSmoke    a hand in a pocket, the cigarette to the lips now and then
//   o8_idleArms     the arms folded
//   o8_point        the arm out at what he saw (a witness, before he runs to tell it)
//   o8_halt         the palm out (a cop's "Hands up.")
//   o8_reach        the hand into the coat (a gang man, before the gun comes out)
// (the gestures are played over the legs: fig.anim.setOverlay(name), they hold)
const TAU = Math.PI * 2;
const A = ANKLE_Y;
const S = Math.sin, abs = Math.abs;
const P = (over) => mergePose(NEUTRAL, over);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pw = (t, keys) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const u = (t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]); return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * u * u * (3 - 2 * u); }
  return keys[keys.length - 1][1];
};
// hands in the coat's pockets (the gunman's left hand in the aim, both)
const POCKETS = {
  handTL: [0.2, 0.93, 0.07], elbowPoleL: [0.35, -0.2, -1], handL: [10, 0, 10],
  handTR: [-0.2, 0.93, 0.07], elbowPoleR: [-0.35, -0.2, -1], handR: [10, 0, -10],
};

// ---- the topper: a tall crown a little flared at the top, a brim curled up at the sides
function topper(F, H) {
  const hb = F.rig.BIND.hat, c = F.cover;
  const prof = [
    [0.0, 0.02], [0.06, 0.012], [0.094, 0.0], [0.13, -0.002], [0.156, 0.004], [0.166, 0.013], [0.16, 0.018], [0.13, 0.01],
    [0.1, 0.012], [0.094, 0.02], [0.092, 0.06], [0.094, 0.11], [0.098, 0.16], [0.1, 0.176], [0.09, 0.182], [0.05, 0.184], [0.0, 0.184],
  ];
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch ?? 0.04);
  const s = c.s ?? 1;
  const geo = H.grid(H.seg(80, 14), H.seg(prof.length * 3, prof.length + 4), (u, v, p) => {
    const [r, h0] = profileAt(prof, v);
    const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
    let h = h0;
    // (the brim rolls up at his ears, dips a hair at the front and back)
    if (r > 0.1) h += sstep(0.1, 0.166, r) * (0.026 * sn * sn - 0.004 * cs * cs);
    p.set(r * sn * 0.86 * s, h * s, r * cs * s).applyQuaternion(tilt).add(hb);
  });
  H.orientOut(geo, hb.clone().add(new THREE.Vector3(0, 0.08, 0)));
  const band = F.shade('band'), silk = F.shade('cover');
  return [{ geo, shade: (x, y) => { const h = y - hb.y; return h > 0.016 * s && h < 0.04 * s ? band : silk; }, weights: () => [[H.B.hat, 1]] }];
}

const MAN = {
  torso: [
    [0.95, 0.196, 0.138, 0.138, 0.0, 2.3], [1.03, 0.186, 0.132, 0.13, 0.004, 2.3], [1.12, 0.19, 0.138, 0.128, 0.008, 2.35],
    [1.22, 0.202, 0.146, 0.13, 0.01, 2.45], [1.31, 0.218, 0.146, 0.136, 0.008, 2.7], [1.37, 0.228, 0.138, 0.136, 0.0, 3.0],
    [1.41, 0.226, 0.124, 0.126, -0.008, 3.1], [1.44, 0.206, 0.108, 0.112, -0.013, 2.9], [1.465, 0.166, 0.094, 0.1, -0.017, 2.6],
    [1.484, 0.104, 0.082, 0.088, -0.019, 2.3], [1.496, 0.062, 0.066, 0.072, -0.02, 2.2],
  ],
  shoulderX: 0.178, shoulderY: 1.4, upper: 0.3, fore: 0.272, hipX: 0.094,
  neckR: 0.05, neckY: 1.475, headS: 0.98, jaw: 0.14,
};
const SWELL = {
  body: MAN,
  cover: { kind: 'none', hatDY: 0.13, hatDZ: 0.0, pitch: 0.03, s: 1 },
  garments: [
    // the shirt's white at the throat, the scarf over it
    { kind: 'torso', shade: (th, y) => (y > 1.29 && Math.abs(th) < 0.09 ? 0.55 : 0.008) },
    { kind: 'skirt', y0: 1.04, hem: 0.36, split: 0.5, flare: [1.18, 1.26], back: 0.4, folds: 0.8, grow: 0.012, shade: 'coat' },
    { kind: 'lapels', near: true, top: 1.47, low: 1.2, shade: 'lapel' },
    { kind: 'collar', style: 'scarf', r: 0.03, shade: 'scarf' },
    { kind: 'sleeves', style: 'long', r: 0.082, cuff: 0.072 },
    { kind: 'legs', r: 0.92 },
    { kind: 'shoes' },
    { kind: 'hands', s: 0.95 },
    { kind: 'custom', build: (F, H) => topper(F, H) },
  ],
  skin: { coat: 0.008, lapel: 0.012, collar: 0.01, scarf: 0.62, hand: 0.024, skin: 0.03, cover: 0.005, band: 0.05, trousers: 0.006, shoes: 0.003 },
  collider: 0.3,
};

export default {
  kind: 'o8_swell', h: 1.84, costume: SWELL,
  clips: {
    // the weight on the left leg, the right knee loose; at 3 s over to the right; a look round
    o8_idleShift: { duration: 6, loop: true, def: () => ({ duration: 6, armSpace: 'chest', pose: (t) => {
      const w = pw(t, [[0, 1], [2.4, 1], [3.2, -1], [5.4, -1], [6, 1]]);
      const look = pw(t, [[0, 0], [1.2, 0], [1.7, 1], [2.4, 1], [2.8, 0], [4.2, 0], [4.7, -0.7], [5.3, -0.7], [5.8, 0], [6, 0]]);
      const br = S(TAU * t / 3);
      return P({
        hipsPos: [0.04 * w, 0.948 - 0.006 * abs(w), 0], hips: [0, 4 * w, -3.5 * w],
        spine: [3, -2 * w, 2.5 * w], chest: [-2 - br, 0, 1.5 * w], neck: [8, 10 * look, 0], head: [-4, 22 * look, -1.5 * w],
        footL: [0.12 + (w < 0 ? 0.02 : 0), A, w < 0 ? 0.08 : 0.02], footR: [-0.13 - (w > 0 ? 0.03 : 0), A, w > 0 ? 0.09 : -0.01],
        footRotL: [0, 9 + (w < 0 ? 8 : 0), 0], footRotR: [0, 12 + (w > 0 ? 10 : 0), 0],
        kneeL: [0.15, 0, 1], kneeR: [-0.15, 0, 1],
        armL: [0.13, -1, 0.04, 0], armR: [-0.13, -1, 0.06, 0], elbowL: [16], elbowR: [20],
      });
    } }) },
    // hands in the pockets, shoulders up against the rain, a stamp of the feet
    o8_idlePockets: { duration: 6, loop: true, def: () => ({ duration: 6, armSpace: 'root', pose: (t) => {
      const sw = S(TAU * t / 6), br = S(TAU * t / 3);
      const look = pw(t, [[0, 0], [3.0, 0], [3.5, 0.8], [4.4, 0.8], [4.9, 0], [6, 0]]);
      return P({
        ...POCKETS,
        hipsPos: [0.012 * sw, 0.95, 0], hips: [0, 2 * sw, 1.5 * sw],
        spine: [5, 0, -1 * sw], chest: [2 - br, 0, 0], neck: [14, 8 * look, 0], head: [-6, 18 * look, 0],
        shoulderL: [0, 0, -5], shoulderR: [0, 0, 5],
        footL: [0.12, A, 0.02], footR: [-0.12, A, -0.01],
      });
    } }) },
    // a hand in a pocket, the other with the cigarette: to the lips at 2 s, a breath out
    o8_idleSmoke: { duration: 7, loop: true, def: () => ({ duration: 7, armSpace: 'root', pose: (t) => {
      const up = pw(t, [[0, 0], [1.6, 0], [2.2, 1], [3.0, 1], [3.7, 0], [7, 0]]);
      const br = S(TAU * t / 3.5), sw = S(TAU * t / 7);
      return P({
        handTL: POCKETS.handTL, elbowPoleL: POCKETS.elbowPoleL, handL: POCKETS.handL,
        handTR: [-0.16 + 0.12 * up, 1.04 + 0.52 * up, 0.13 + 0.03 * up], elbowPoleR: [-1, -0.8, -0.2], handR: [-30 - 40 * up, 0, -20],
        hipsPos: [0.015 * sw, 0.95, 0], hips: [0, 3 * sw, 2 * sw],
        spine: [3, 0, 0], chest: [-2 - br, -4 * up, 0], neck: [6 - 4 * up, 0, 0], head: [-4 - 8 * pw(t, [[0, 0], [3.0, 0], [3.4, 1], [4.4, 1], [4.8, 0], [7, 0]]), 6, 0],
        footL: [0.13, A, 0.03], footR: [-0.12, A, -0.02], footRotR: [0, 16, 0],
      });
    } }) },
    // the arms folded across the chest
    o8_idleArms: { duration: 6, loop: true, def: () => ({ duration: 6, armSpace: 'root', pose: (t) => {
      const sw = S(TAU * t / 6), br = S(TAU * t / 3);
      const look = pw(t, [[0, 0], [2, 0], [2.5, -0.8], [3.4, -0.8], [3.9, 0], [6, 0]]);
      return P({
        handTL: [-0.1, 1.2, 0.17], elbowPoleL: [1, -0.6, 0.5], handL: [0, -60, 90],
        handTR: [0.11, 1.17, 0.15], elbowPoleR: [-1, -0.6, 0.5], handR: [0, 60, -90],
        hipsPos: [0.02 * sw, 0.95, 0], hips: [0, 3 * sw, 2 * sw],
        spine: [1, 0, -1 * sw], chest: [-4 - br, 0, 0], neck: [6, 9 * look, 0], head: [-4, 20 * look, 0],
        footL: [0.13, A, 0.02], footR: [-0.13, A, -0.01], footRotL: [0, 12, 0], footRotR: [0, 14, 0],
      });
    } }) },
    // the right arm out at what he saw, the head on it (held)
    o8_point: { duration: 0.45, hold: true, def: () => ({ duration: 0.45, armSpace: 'root', pose: (t) => {
      const k = sstep(0, 0.4, t);
      return P({
        handTR: [-0.19 + 0.06 * k, 0.86 + 0.58 * k, 0.03 + 0.62 * k], elbowPoleR: [-1, -0.3 + 0.3 * k, -0.4 + 0.4 * k], handR: [-40 + 30 * k, 0, -10],
        chest: [-2, -10 * k, 0], spine: [3, -5 * k, 0], neck: [8, 4 * k, 0], head: [-5 - 4 * k, 8 * k, 0],
      });
    } }) },
    // the palm out at chest height ("Hands up.": held)
    o8_halt: { duration: 0.35, hold: true, def: () => ({ duration: 0.35, armSpace: 'root', pose: (t) => {
      const k = sstep(0, 0.3, t);
      return P({
        handTR: [-0.19 + 0.08 * k, 0.86 + 0.5 * k, 0.03 + 0.38 * k], elbowPoleR: [-1, -1, -0.2], handR: [-40 - 50 * k, 0, -10],
        chest: [-2 - 3 * k, -6 * k, 0], head: [-5 - 4 * k, 0, 0],
      });
    } }) },
    // the right hand into the coat (the gun under the arm: held until it comes out)
    o8_reach: { duration: 0.32, hold: true, def: () => ({ duration: 0.32, armSpace: 'root', pose: (t) => {
      const k = sstep(0, 0.28, t);
      return P({
        handTR: [-0.19 + 0.25 * k, 0.86 + 0.38 * k, 0.03 + 0.12 * k], elbowPoleR: [-1, -0.6, 0.1], handR: [-40 + 20 * k, 0, -10 - 30 * k],
        chest: [-2, -8 * k, 0], spine: [3 + 3 * k, -4 * k, 0], head: [-2, 0, 0],
      });
    } }) },
  },
};
