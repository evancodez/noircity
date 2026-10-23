// [O3] The Tenements' boys (lane O3, NOIR CITY: one of the two gangs; see
// o3_gangs.js for the Docks' crew): a flat cap low over the eyes, a short
// boxy jacket to the hip open on a light shirt (a light V down the front),
// tight trousers, boots; square and quick. At 20 m: the cap, the short
// jacket, the light shirt - the Docks' men are long coats and hats.
const A = Math.abs;

const TOUGH = {
  body: {
    torso: [
      [0.94, 0.196, 0.142, 0.14, 0.004, 2.3],
      [1.02, 0.19, 0.142, 0.136, 0.008, 2.3],
      [1.12, 0.198, 0.148, 0.136, 0.01, 2.4],
      [1.22, 0.214, 0.156, 0.14, 0.012, 2.5],
      [1.31, 0.236, 0.156, 0.144, 0.01, 2.8],
      [1.38, 0.252, 0.146, 0.146, 0.002, 3.3],
      [1.425, 0.256, 0.132, 0.136, -0.006, 3.7],
      [1.455, 0.244, 0.116, 0.122, -0.012, 3.6],
      [1.476, 0.214, 0.102, 0.108, -0.016, 3.1],
      [1.492, 0.156, 0.092, 0.096, -0.018, 2.7],
      [1.504, 0.094, 0.082, 0.086, -0.019, 2.3],
    ],
    shoulderX: 0.2, shoulderY: 1.41, upper: 0.3, fore: 0.275, hipX: 0.098,
    neckR: 0.056, headW: 1.02, jaw: 0.1,
  },
  cover: { kind: 'flatcap', hatDY: 0.124, hatDZ: 0.016, pitch: 0.2, s: 1.04, peak: 0.064, peakDrop: 0.36 },
  garments: [
    // the shirt open in a V down the front, the jacket black either side
    { kind: 'torso', shade: (th, y) => (A(th) < 0.03 + (y - 1.2) * 0.4 && y > 1.2 ? 0.13 : 0.013) },
    { kind: 'skirt', y0: 1.02, hem: 0.86, flare: [1.05, 1.08], back: 0.8, folds: 0.3, grow: 0.01, split: 0.32, shade: 'coat' },
    { kind: 'collar', style: 'band', h: 0.05, hFront: 0.04, open: 0.6, gap: 0.05, lean: 0.004, flareOut: 0.006, shade: 'collar' },
    { kind: 'sleeves', r: 0.082, cuff: 0.07 },
    { kind: 'legs', r: 0.92, boot: true },
    { kind: 'shoes', style: 'boot' },
    { kind: 'hands', s: 1.04 },
  ],
  skin: { coat: 0.012, collar: 0.014, hand: 0.022, skin: 0.03, cover: 0.016, peak: 0.01, trousers: 0.008, shoes: 0.004 },
  collider: 0.32,
};

export default { kind: 'o3_tough', h: 1.8, costume: TOUGH };
