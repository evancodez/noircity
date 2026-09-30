// The cast's costumes (lane 6, P0.1): what each figure of the story wears,
// cut by src/cast/tailor.js on the Hood's skeleton. Measures are model
// metres in the bind pose (feet at 0, facing +z, his left +x); the figure is
// scaled so the top of its head cover stands at `h` (world metres).
// Everyone must be told from everyone else by the outline alone at 20 m:
//   the brawler   the widest shape: flat cap, bare forearms, a waistcoat, no coat
//   the waitress  narrow waist, a skirt to below the knee, the white apron,
//                 a knot of hair and a small cap
//   the cook      a paper boat of a hat, heavy shoulders, an apron bib
//   the old man   bent, a flat cap, a scarf, a coat too big for him, a paper up
//   she           a cloche low on the brow, a fur collar round the jaw
//   he            a bowler, narrow sloping shoulders, a short overcoat
//   the docker    a knit cap, a pea coat with the collar up to the ears
import { sstep, lerp } from './tailor.js';

const A = Math.abs;

// ---- the brawler, "Mack": 1.96 m, the widest shape in the game -------------
// shoulders 0.60 across, a deep chest, a belly that carries the waistcoat
// forward, a thick short neck straight into the head, long heavy arms, big
// hands; a flat cap pulled low, a collarless shirt with the sleeves rolled
// above the elbow (the bare forearms print light), a dark waistcoat open at
// the bottom, braces, heavy trousers, boots. No coat.
const BRAWLER = {
  name: 'brawler', h: 1.96,
  body: {
    // a barrel chest wider and deeper than the belly (0.60 across the
    // shoulders, 0.52 at the ribs, 0.48 at the waist, world), the belly no
    // more than 4 cm forward of the chest
    torso: [
      [0.9, 0.206, 0.15, 0.15, 0.015, 2.3],
      [0.98, 0.207, 0.165, 0.15, 0.028, 2.3],
      [1.06, 0.213, 0.176, 0.148, 0.034, 2.35],
      [1.15, 0.22, 0.18, 0.15, 0.034, 2.45],
      [1.24, 0.231, 0.19, 0.158, 0.026, 2.6],
      [1.32, 0.248, 0.19, 0.166, 0.018, 2.9],
      [1.38, 0.262, 0.174, 0.164, 0.008, 3.3],
      [1.425, 0.268, 0.152, 0.152, -0.002, 3.6],
      [1.455, 0.258, 0.132, 0.136, -0.008, 3.5],
      [1.478, 0.226, 0.114, 0.12, -0.012, 3.0],
      [1.496, 0.168, 0.102, 0.108, -0.014, 2.6],
      [1.512, 0.105, 0.094, 0.1, -0.015, 2.3],
    ],
    shoulderX: 0.216, shoulderY: 1.41, upper: 0.318, fore: 0.292, hipX: 0.106,
    neckR: 0.082, neckFlare: 0.04, neckY: 1.475, headY: 1.548, headS: 1.06, headW: 1.06, jaw: 0.06, hairLine: 0.1,
  },
  cover: { kind: 'flatcap', hatDY: 0.122, hatDZ: 0.012, pitch: 0.12, s: 1.06, peak: 0.058, peakDrop: 0.28 },
  garments: [
    // the shirt, the trousers' high waistband below it, the braces
    { kind: 'torso', shade: (th, y, x) => {
      if (y < 1.07) return 0.009;
      const brace = A(A(th) - 0.33) < 0.045 && y < 1.5;
      return brace ? 0.006 : (A(th) < 0.42 && y > 1.15 ? 0.34 : 0.03);
    } },
    // the waistcoat: a V to the fourth button, points over the belly, the
    // bottom button undone, cut away round the arms
    { kind: 'shell', grow: 0.009, shade: 'vest',
      pad: (th, y) => 0.004 * Math.exp(-(((y - 1.08) / 0.1) ** 2)) * Math.max(0, Math.cos(th)),
      top: (th) => {
        const a = A(th);
        const v = 1.285 + 0.2 * Math.pow(Math.min(1, a / 0.32), 0.95);
        return Math.min(v, 1.5) - 0.2 * sstep(1.1, 1.35, a) * (1 - sstep(1.95, 2.25, a));
      },
      hem: (th) => {
        const a = A(th);
        const base = 0.968 + 0.05 * sstep(0.3, 1.5, a) + 0.02 * sstep(1.5, 3, a);
        return base + (1.1 - base) * (1 - sstep(0.02, 0.3, a));
      } },
    { kind: 'collar', style: 'band', h: 0.028, hFront: 0.022, open: 0.42, gap: 0.004, lean: 0.002, flareOut: 0.002, shade: 0.34 },
    // (rolled to the middle of the forearm: his light shapes are the wrists
    // and the fists, what the eye follows in the fight)
    { kind: 'sleeves', style: 'rolled', r: 0.09, len: 0.318 + 0.13, shade: 'shirt' },
    // heavy forearms, the wrist 0.075 across (world)
    { kind: 'arms', r: 0.062, d0: 0.19, wrist: 0.5 },
    { kind: 'legs', r: 1.3, boot: true },
    { kind: 'shoes', style: 'boot' },
    { kind: 'hands', s: 1.12, fist: true },
  ],
  skin: { shirt: 0.02, vest: 0.004, arm: 0.34, hand: 0.34, skin: 0.03, hair: 0.004, cover: 0.011, peak: 0.009, trousers: 0.006, shoes: 0.004 },
  // his waistcoat pocket (theta, y): where the red matchbook rides
  pocket: [0.62, 1.1],
  collider: 0.4,
};

// ---- the waitress, "Dot": 1.68 m ---------------------------------------------
// a narrow waist, a short-sleeved uniform dress to below the knee, a small
// collar, the white apron tied at the back, a small cap on pinned-up hair
// with one curl that falls forward over the face, flat shoes
// the apron's waistband runs all round (painted on the dress: a band); the
// straps are ribbons: from the bib's corners over the shoulders and crossed
// down the back into the ties
const dotBand = (th, y) => A(y - 1.045) < 0.016;
const STRAPS = [];
for (const k of [1, -1]) {
  STRAPS.push({ kind: 'ribbon', side: 1, path: [[k * 0.092, 1.27], [k * 0.094, 1.38], [k * 0.09, 1.46], [k * 0.08, 1.487]], w: 0.022 });
  STRAPS.push({ kind: 'ribbon', side: -1, path: [[k * 0.08, 1.49], [k * 0.092, 1.44], [k * 0.02, 1.25], [-k * 0.085, 1.07]], w: 0.022, n: 20 });
}
const WAITRESS = {
  name: 'waitress', h: 1.68,
  body: {
    torso: [
      [0.93, 0.168, 0.112, 0.124, -0.006, 2.3],
      [1.0, 0.15, 0.098, 0.106, 0.0, 2.3],
      [1.07, 0.128, 0.086, 0.09, 0.004, 2.2],
      [1.14, 0.136, 0.094, 0.09, 0.008, 2.3],
      [1.22, 0.156, 0.124, 0.094, 0.01, 2.4],
      [1.3, 0.168, 0.128, 0.098, 0.012, 2.6],
      [1.37, 0.184, 0.108, 0.103, 0.004, 3.0],
      [1.415, 0.19, 0.097, 0.099, -0.004, 3.3],
      [1.445, 0.18, 0.087, 0.091, -0.01, 3.1],
      [1.466, 0.15, 0.077, 0.083, -0.014, 2.7],
      [1.482, 0.098, 0.065, 0.071, -0.016, 2.4],
      [1.492, 0.058, 0.054, 0.061, -0.017, 2.2],
    ],
    // (a shorter neck than the Hood's: the head sits down on the collar)
    shoulderX: 0.152, shoulderY: 1.405, upper: 0.285, fore: 0.252, hipX: 0.084,
    neckR: 0.047, neckY: 1.468, headY: 1.545, headS: 0.93, jaw: 0.26, nose: 0.85,
  },
  cover: { kind: 'pinned' },
  garments: [
    { kind: 'torso', shade: (th, y) => (dotBand(th, y) ? 0.6 : 0.022) },
    { kind: 'skirt', y0: 0.97, hem: 0.4, flare: [1.42, 1.55], flarePow: 1.1, hipOut: 0.012, folds: 0.55, back: 1, grow: 0.006, shade: 'dress', hemWave: 0.006 },
    { kind: 'collar', style: 'dress', shade: 0.03 },
    { kind: 'sleeves', style: 'short', r: 0.058, len: 0.12, shade: 'dress' },
    { kind: 'arms', r: 0.038, d0: 0.08 },
    { kind: 'apron', waist: 1.045, bibTop: 1.3, hem: 0.58, span: 0.16 },
    ...STRAPS,
    { kind: 'legs', style: 'stocking' },
    { kind: 'shoes', style: 'flat' },
    // hands with fingers (she pours, serves, carries): four and a thumb,
    // half curled to hold what she holds
    { kind: 'hands', s: 0.84, fingers: true, curl: 0.55 },
  ],
  skin: { dress: 0.022, arm: 0.04, hand: 0.04, skin: 0.03, hair: 0.004, cover: 0.62, apron: 0.72, stocking: 0.012, shoes: 0.004 },
  collider: 0.26,
};

// ---- the cook: 1.80 m, seen from the waist up in the hatch, back-lit ------------
const COOK = {
  name: 'cook', h: 1.8,
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
    // a white jacket gone grey in the kitchen's steam, the apron bib over it
    { kind: 'torso', shade: (th, y) => (A(th) < 0.5 && y < 1.34 ? 0.035 : 0.025) },
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
  collider: 0.36,
};

// ---- the old man: 1.66 m ------------------------------------------------------
// bent, a flat cap, a scarf, an overcoat too big for him (the shoulders drop
// past his own, the sleeves come down over his hands), a newspaper held up
const OLDMAN = {
  name: 'oldman', h: 1.66,
  body: {
    torso: [
      [0.95, 0.2, 0.142, 0.142, 0.0, 2.3],
      [1.03, 0.192, 0.136, 0.136, 0.004, 2.3],
      [1.12, 0.196, 0.142, 0.136, 0.008, 2.35],
      [1.22, 0.207, 0.148, 0.14, 0.01, 2.45],
      [1.31, 0.226, 0.148, 0.144, 0.006, 2.8],
      [1.37, 0.24, 0.14, 0.146, -0.002, 3.2],
      [1.405, 0.246, 0.126, 0.136, -0.01, 3.5],
      [1.435, 0.236, 0.112, 0.124, -0.016, 3.3],
      [1.458, 0.205, 0.1, 0.11, -0.02, 2.9],
      [1.474, 0.15, 0.09, 0.1, -0.022, 2.5],
      [1.486, 0.08, 0.075, 0.082, -0.023, 2.2],
    ],
    shoulderX: 0.18, shoulderY: 1.39, upper: 0.29, fore: 0.26, hipX: 0.09,
    neckR: 0.046, headS: 0.97, hairLine: 0.35,
  },
  cover: { kind: 'flatcap', hatDY: 0.126, hatDZ: 0.008, pitch: 0.1, s: 1.0, peak: 0.06, peakDrop: 0.3 },
  garments: [
    { kind: 'torso', shade: 'coat' },
    { kind: 'skirt', y0: 1.06, hem: 0.34, split: 0.55, flare: [1.3, 1.36], back: 0.35, folds: 1.3, shade: 'coat' },
    { kind: 'lapels', near: true, shade: 'lapel' },
    { kind: 'collar', style: 'scarf', r: 0.034, shade: 'scarf' },
    { kind: 'sleeves', style: 'long', r: 0.086, cuff: 0.078 },
    { kind: 'legs', r: 0.95 },
    { kind: 'shoes' },
    { kind: 'hands', s: 0.9 },
  ],
  skin: { coat: 0.016, scarf: 0.05, hand: 0.02, skin: 0.03, cover: 0.012, peak: 0.009 },
  collider: 0.3,
};

// ---- the couple in booth 2 ------------------------------------------------------
// she: 1.64 m, a cloche low over the brow, a coat with a fur collar that
// stands round the jaw, a cigarette holder
const HER = {
  name: 'couple_her', h: 1.64,
  body: {
    torso: [
      [0.93, 0.18, 0.124, 0.134, -0.006, 2.3],
      [1.0, 0.166, 0.112, 0.118, 0.0, 2.3],
      [1.07, 0.148, 0.102, 0.104, 0.004, 2.3],
      [1.14, 0.152, 0.108, 0.104, 0.008, 2.35],
      [1.22, 0.168, 0.132, 0.108, 0.01, 2.45],
      [1.3, 0.182, 0.134, 0.112, 0.01, 2.7],
      [1.37, 0.198, 0.118, 0.116, 0.002, 3.1],
      [1.415, 0.204, 0.106, 0.11, -0.006, 3.4],
      [1.445, 0.194, 0.094, 0.1, -0.012, 3.2],
      [1.466, 0.162, 0.083, 0.09, -0.015, 2.8],
      [1.482, 0.104, 0.07, 0.076, -0.017, 2.4],
      [1.492, 0.06, 0.058, 0.064, -0.018, 2.2],
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

// he: 1.74 m, a bowler, narrow sloping shoulders, a short overcoat; his
// umbrella hooked on the table's edge
const HIM = {
  name: 'couple_him', h: 1.74,
  body: {
    torso: [
      [0.95, 0.19, 0.134, 0.134, 0.0, 2.3],
      [1.03, 0.178, 0.126, 0.126, 0.004, 2.3],
      [1.12, 0.18, 0.132, 0.124, 0.008, 2.35],
      [1.22, 0.19, 0.14, 0.126, 0.01, 2.45],
      [1.31, 0.202, 0.14, 0.13, 0.008, 2.7],
      [1.37, 0.208, 0.132, 0.13, 0.0, 3.0],
      [1.41, 0.205, 0.118, 0.12, -0.008, 3.1],
      [1.44, 0.186, 0.104, 0.108, -0.013, 2.9],
      [1.465, 0.15, 0.092, 0.098, -0.017, 2.6],
      [1.484, 0.1, 0.08, 0.086, -0.019, 2.3],
      [1.496, 0.06, 0.064, 0.07, -0.02, 2.2],
    ],
    shoulderX: 0.16, shoulderY: 1.385, upper: 0.3, fore: 0.27, hipX: 0.09,
    neckR: 0.047, neckY: 1.475, headS: 0.97, jaw: 0.22,
  },
  cover: { kind: 'bowler', hatDY: 0.13, hatDZ: 0.0, pitch: 0.05, s: 0.98, brim: 0.14 },
  garments: [
    { kind: 'torso', shade: (th, y) => (y > 1.25 && A(th) < 0.12 ? 0.3 : 0.013) },
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

// ---- the docker: 1.82 m, a knit watch cap, a pea coat with the collar turned
// up to the ears, a mug held in both hands
const DOCKER = {
  name: 'docker', h: 1.82,
  body: {
    torso: [
      [0.94, 0.212, 0.152, 0.15, 0.004, 2.3],
      [1.02, 0.212, 0.154, 0.146, 0.008, 2.3],
      [1.12, 0.218, 0.16, 0.144, 0.012, 2.4],
      [1.22, 0.232, 0.166, 0.148, 0.014, 2.5],
      [1.31, 0.25, 0.164, 0.152, 0.012, 2.8],
      [1.38, 0.262, 0.154, 0.152, 0.004, 3.3],
      [1.425, 0.265, 0.138, 0.142, -0.006, 3.7],
      [1.455, 0.254, 0.122, 0.128, -0.012, 3.6],
      [1.476, 0.226, 0.107, 0.113, -0.016, 3.1],
      [1.492, 0.168, 0.095, 0.1, -0.018, 2.7],
      [1.504, 0.1, 0.084, 0.09, -0.019, 2.3],
    ],
    shoulderX: 0.205, shoulderY: 1.415, upper: 0.305, fore: 0.28, hipX: 0.1,
    neckR: 0.062, headW: 1.04, jaw: 0.12,
  },
  cover: { kind: 'watchcap', hatDY: 0.1, hatDZ: -0.008, pitch: -0.1, s: 1.02 },
  garments: [
    { kind: 'torso', shade: 'coat' },
    { kind: 'skirt', y0: 1.02, hem: 0.74, flare: [1.1, 1.14], back: 0.6, folds: 0.5, grow: 0.012, shade: 'coat' },
    { kind: 'collar', style: 'peacoat', h: 0.16, hFront: 0.13, lo: -0.02, open: 0.55, gap: 0.062, lean: 0.004, flareOut: 0.008, wide: 1.06, nv: 14 },
    { kind: 'sleeves', r: 0.088, cuff: 0.074 },
    { kind: 'legs', r: 1.08, boot: true },
    { kind: 'shoes', style: 'boot' },
    { kind: 'hands', s: 1.05 },
  ],
  skin: { coat: 0.012, collar: 0.016, hand: 0.02, skin: 0.03, cover: 0.03, cuff: 0.045, trousers: 0.009 },
  collider: 0.34,
};

export const COSTUMES = {
  brawler: BRAWLER, waitress: WAITRESS, cook: COOK, oldman: OLDMAN, couple_her: HER, couple_him: HIM, docker: DOCKER,
};

// ---- kinds of their own files (wave B seams, docs/story/seams/Y.md) -------------------
// src/cast/kinds/*.js, each default-exporting
//   { kind, h, name?, costume, clips?: { name: clip }, idle?: clipName, onSpawn?(c, fig, cast) }
// merged here (COSTUMES), in castAnim.js (the clip bank, the idle table,
// CAST_CLIPS) and in Cast.js (KINDS). A kind or a clip named twice throws.
// (a kind file may import tailor.js and the enemies' rig and clips, never
// Cast / Character / Figure / castAnim / costumes: it is read before them)
const KIND_FILES = import.meta.glob('./kinds/*.js', { eager: true });
export const KIND_DEFS = Object.keys(KIND_FILES).sort().map((path) => {
  const d = KIND_FILES[path].default;
  if (!d || !d.kind || !d.costume) throw new Error(`cast kinds: ${path} must default-export { kind, h, costume, ... }`);
  if (COSTUMES[d.kind]) throw new Error(`cast kinds: '${d.kind}' defined twice (${path})`);
  if (d.costume.h == null) d.costume.h = d.h;
  if (!d.costume.name) d.costume.name = d.kind;
  COSTUMES[d.kind] = d.costume;
  return d;
});
