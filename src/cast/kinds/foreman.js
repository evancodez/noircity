// The foreman (lane B6 builds the kind; the second fist fight is staged on
// it later, in the loading bay): a dock man as big as Mack and quieter.
// A heavy frame under a long work jacket buttoned to the throat, a flat cap
// low, a scarf knotted at the neck, sleeves pushed back off thick wrists,
// boots; a cargo hook in his fist (the scene's prop). Where Mack is a barrel
// in a waistcoat, the foreman is a tall block: square from the shoulders to
// the jacket's hem.
const FOREMAN = {
  body: {
    torso: [
      [0.9, 0.222, 0.16, 0.156, 0.01, 2.4],
      [0.99, 0.222, 0.166, 0.154, 0.016, 2.4],
      [1.08, 0.228, 0.172, 0.154, 0.02, 2.5],
      [1.17, 0.238, 0.178, 0.158, 0.02, 2.6],
      [1.26, 0.252, 0.18, 0.162, 0.016, 2.8],
      [1.34, 0.268, 0.174, 0.164, 0.008, 3.2],
      [1.4, 0.276, 0.16, 0.156, -0.002, 3.6],
      [1.44, 0.268, 0.142, 0.142, -0.008, 3.5],
      [1.466, 0.236, 0.124, 0.126, -0.012, 3.0],
      [1.484, 0.176, 0.108, 0.112, -0.014, 2.6],
      [1.5, 0.11, 0.096, 0.1, -0.015, 2.3],
    ],
    shoulderX: 0.222, shoulderY: 1.41, upper: 0.318, fore: 0.29, hipX: 0.108,
    neckR: 0.078, neckFlare: 0.035, neckY: 1.475, headY: 1.55, headS: 1.04, headW: 1.05, jaw: 0.08, hairLine: 0.1,
  },
  cover: { kind: 'flatcap', hatDY: 0.122, hatDZ: 0.014, pitch: 0.18, s: 1.06, peak: 0.064, peakDrop: 0.34 },
  garments: [
    { kind: 'torso', shade: 'coat' },
    { kind: 'skirt', y0: 1.0, hem: 0.62, flare: [1.12, 1.16], back: 0.6, folds: 0.4, grow: 0.012, split: 0.25, shade: 'coat' },
    { kind: 'collar', style: 'scarf', r: 0.04, shade: 'scarf' },
    { kind: 'sleeves', style: 'rolled', r: 0.094, len: 0.318 + 0.2, shade: 'coat' },
    { kind: 'arms', r: 0.064, d0: 0.2, wrist: 0.52 },
    { kind: 'legs', r: 1.3, boot: true },
    { kind: 'shoes', style: 'boot' },
    { kind: 'hands', s: 1.14, fist: true },
  ],
  skin: { coat: 0.01, scarf: 0.03, arm: 0.3, hand: 0.3, skin: 0.03, cover: 0.012, peak: 0.009, trousers: 0.007, shoes: 0.004 },
  collider: 0.36,
};

export default { kind: 'foreman', h: 1.97, costume: FOREMAN };
