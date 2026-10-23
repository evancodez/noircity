import * as THREE from 'three';

// [O3] The two gangs' men (lane O3, NOIR CITY), told apart by the outline at
// 20 m (O4's gang kinds replace these where they merge):
//   o3_docksman   the Docks' crew: the long dark coat to the calf, belted,
//                 its collar up, a wide-brimmed fedora pulled down, the white
//                 scarf at the throat (one light shape in the black)
//   o3_tough      the Tenements' boys: a flat cap low over the eyes, a short
//                 boxy jacket to the hip open on a light shirt, the trousers
//                 tight, boots - square and quick
// (this file default-exports one kind; the other is its own file: a kind file
// is one kind, the cast reads them by the glob)
const A = Math.abs;
const TAU = Math.PI * 2;

// the fedora: [r, y] up from the brim (model metres over the hat bone)
const BRIM = 0.178, CROWN = [[0.098, 0.004], [0.1, 0.03], [0.099, 0.06], [0.094, 0.085], [0.084, 0.102], [0.06, 0.11], [0.0, 0.106]];
function fedora(F, H) {
  const hb = F.rig.BIND.hat, c = F.cover;
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch ?? 0.14);
  // the crown: an oval with the pinch at the front and the crease along the top
  const crown = H.grid(H.seg(64, 18), H.seg(24, 10), (u, v, p) => {
    const f = v * (CROWN.length - 1), i = Math.min(CROWN.length - 2, Math.floor(f)), t = f - i;
    let r = CROWN[i][0] + (CROWN[i + 1][0] - CROWN[i][0]) * t;
    let y = CROWN[i][1] + (CROWN[i + 1][1] - CROWN[i][1]) * t;
    const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
    // (the pinch: in at the front's sides near the top; the crease: down along the middle)
    const top = Math.min(1, Math.max(0, (y - 0.05) / 0.06));
    r *= 1 - 0.16 * top * Math.max(0, cs) * Math.abs(sn) * 1.8;
    y -= 0.022 * top * Math.exp(-((sn / 0.35) ** 2));
    p.set(r * 0.9 * sn, y, r * 1.08 * cs + 0.004);
    p.applyQuaternion(tilt).add(hb);
  });
  H.orientOut(crown, hb.clone().add(new THREE.Vector3(0, 0.05, 0)));
  // the brim: a ring, snapped down at the front, up a little at the back
  const brim = H.grid(H.seg(64, 18), H.seg(4, 2), (u, v, p) => {
    const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
    const r = 0.095 + (BRIM - 0.095) * v;
    const y = 0.006 - (cs > 0 ? 0.034 * cs * cs : -0.012 * cs * cs) * v * v;
    p.set(r * 0.94 * sn, y, r * 1.06 * cs + 0.004);
    p.applyQuaternion(tilt).add(hb);
  });
  brim.computeVertexNormals();
  const felt = F.shade('cover'), band = F.shade('band');
  const w = () => [[H.B.hat, 1]];
  return [
    { geo: crown, shade: (x, y) => (y - hb.y < 0.026 ? band : felt), weights: w },
    { geo: brim, shade: felt, weights: w },
  ];
}

const DOCKSMAN = {
  body: {
    torso: [
      [0.94, 0.198, 0.142, 0.142, 0.002, 2.3],
      [1.02, 0.19, 0.138, 0.136, 0.006, 2.3],
      [1.12, 0.198, 0.146, 0.138, 0.008, 2.35],
      [1.22, 0.214, 0.154, 0.142, 0.01, 2.45],
      [1.31, 0.234, 0.154, 0.146, 0.008, 2.75],
      [1.38, 0.25, 0.146, 0.148, 0.0, 3.2],
      [1.425, 0.254, 0.132, 0.138, -0.008, 3.6],
      [1.455, 0.24, 0.116, 0.124, -0.014, 3.4],
      [1.476, 0.208, 0.102, 0.11, -0.017, 3.0],
      [1.492, 0.152, 0.092, 0.098, -0.019, 2.6],
      [1.504, 0.09, 0.08, 0.086, -0.02, 2.3],
    ],
    shoulderX: 0.198, shoulderY: 1.41, upper: 0.305, fore: 0.278, hipX: 0.098,
    neckR: 0.054, headW: 1.0, jaw: 0.14,
  },
  cover: { kind: 'none', hatDY: 0.118, hatDZ: 0.006, pitch: 0.14 },
  garments: [
    { kind: 'torso', shade: (th, y) => (A(y - 1.0) < 0.022 ? 0.003 : 0.012) },
    // the long coat: to the calf, belted, barely parted
    { kind: 'skirt', y0: 1.0, hem: 0.32, split: 0.4, flare: [1.28, 1.38], back: 0.55, folds: 0.9, grow: 0.012, shade: 'coat' },
    { kind: 'lapels', near: true, top: 1.47, low: 1.2, shade: 'lapel' },
    // the scarf at the throat: the one light shape
    { kind: 'collar', style: 'scarf', r: 0.036, shade: 'scarf' },
    { kind: 'sleeves', style: 'long', r: 0.088, cuff: 0.078 },
    { kind: 'legs', r: 1.0 },
    { kind: 'shoes' },
    { kind: 'hands', s: 1.0 },
    { kind: 'custom', build: (F, H) => fedora(F, H) },
  ],
  skin: { coat: 0.011, lapel: 0.01, scarf: 0.42, hand: 0.022, skin: 0.03, cover: 0.008, band: 0.003, trousers: 0.006, shoes: 0.004 },
  collider: 0.32,
};

export default { kind: 'o3_docksman', h: 1.86, costume: DOCKSMAN };
export { fedora };
