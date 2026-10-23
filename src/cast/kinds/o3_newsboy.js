// [O3] The newsboy (lane O3, NOIR CITY's crowd): a boy of fourteen, the
// shortest outline in the street - a flat cap too big for him, a short
// jacket, the strap of the paper bag across his chest (a light diagonal on
// the black) and the bag at his hip, knee breeches over long socks. At 20 m:
// small, a big cap, a bag. He hawks at the corners and runs first.
//   cast kind 'o3_newsboy'
const A = Math.abs;

const NEWSBOY = {
  body: {
    torso: [
      [0.94, 0.172, 0.12, 0.124, 0.0, 2.3],
      [1.02, 0.164, 0.118, 0.12, 0.004, 2.3],
      [1.12, 0.17, 0.124, 0.12, 0.008, 2.35],
      [1.22, 0.184, 0.13, 0.124, 0.01, 2.45],
      [1.31, 0.198, 0.13, 0.126, 0.006, 2.7],
      [1.37, 0.206, 0.122, 0.126, -0.002, 3.1],
      [1.41, 0.204, 0.11, 0.116, -0.01, 3.2],
      [1.44, 0.186, 0.098, 0.104, -0.015, 2.9],
      [1.465, 0.146, 0.086, 0.094, -0.018, 2.6],
      [1.484, 0.094, 0.074, 0.08, -0.02, 2.3],
    ],
    shoulderX: 0.158, shoulderY: 1.385, upper: 0.29, fore: 0.26, hipX: 0.088,
    neckR: 0.044, headS: 1.04, headW: 1.0, jaw: 0.3,
  },
  cover: { kind: 'flatcap', hatDY: 0.13, hatDZ: 0.016, pitch: 0.06, s: 1.14, peak: 0.066, peakDrop: 0.22 },
  garments: [
    // the jacket, the bag's strap from the right shoulder to the left hip
    { kind: 'torso', shade: (th, y) => {
      const strap = A(th - (y - 1.0) * 2.6 + 0.4) < 0.11 && y > 0.98 && y < 1.46;
      return strap ? 0.32 : 0.014;
    } },
    { kind: 'skirt', y0: 1.02, hem: 0.88, flare: [1.04, 1.07], back: 0.8, folds: 0.3, grow: 0.01, split: 0.25, shade: 'coat' },
    { kind: 'collar', style: 'band', h: 0.036, hFront: 0.03, open: 0.5, gap: 0.03, lean: 0.004, flareOut: 0.006, shade: 'collar' },
    { kind: 'sleeves', r: 0.072, cuff: 0.064 },
    { kind: 'legs', r: 0.86 },
    { kind: 'shoes', style: 'boot' },
    { kind: 'hands', s: 0.86 },
  ],
  skin: { coat: 0.013, collar: 0.016, hand: 0.024, skin: 0.03, cover: 0.03, peak: 0.012, trousers: 0.02, shoes: 0.004 },
  collider: 0.26,
};

export default { kind: 'o3_newsboy', h: 1.56, costume: NEWSBOY };
