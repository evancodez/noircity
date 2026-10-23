import * as THREE from 'three';

// [O3] The beat cop (lane O3, NOIR CITY: the police on foot). Told from
// everyone in the street by the outline alone at 20 m: the tall stiff cap with
// its flat top wider than the head and the peak low over the eyes, a long
// tunic coat to the knee, straight and belted, square shoulders; up close the
// two rows of light buttons and the badge on the left breast print light on
// the black (the reference's figures: a black mass with a few light shapes).
// O4's cop kind replaces this one where it merges (the gun kit's tells on a
// uniform); this is the man who walks the beat, comes over at HEAT 1 and
// makes the arrest.
//   cast kind 'o3_patrolman' (the crowd builds it: src/people/)
const A = Math.abs;
const TAU = Math.PI * 2;

// the cap's lathe: [r, y] up from the band's foot (model metres over the hat bone)
const CAP = [[0.093, -0.012], [0.096, 0.004], [0.098, 0.03], [0.104, 0.046], [0.121, 0.062], [0.134, 0.074], [0.136, 0.08], [0.128, 0.086], [0.06, 0.089], [0.0, 0.09]];
function capPoint(u, v, p) {
  const f = v * (CAP.length - 1), i = Math.min(CAP.length - 2, Math.floor(f)), t = f - i;
  const r = CAP[i][0] + (CAP[i + 1][0] - CAP[i][0]) * t, y = CAP[i][1] + (CAP[i + 1][1] - CAP[i][1]) * t;
  const th = u * TAU;
  // (the crown a little longer fore and aft than across, its front a hair higher: the stiffened badge plate)
  const fr = Math.cos(th);
  p.set(r * 0.94 * Math.sin(th), y + 0.006 * Math.max(0, fr) * Math.min(1, y / 0.04), r * (fr > 0 ? 1.04 : 1.0) * fr + 0.004);
}

const PATROLMAN = {
  body: {
    torso: [
      [0.94, 0.204, 0.146, 0.146, 0.004, 2.3],
      [1.02, 0.198, 0.146, 0.142, 0.008, 2.3],
      [1.12, 0.206, 0.152, 0.142, 0.01, 2.4],
      [1.22, 0.224, 0.16, 0.146, 0.012, 2.5],
      [1.31, 0.246, 0.16, 0.15, 0.01, 2.8],
      [1.38, 0.262, 0.15, 0.15, 0.002, 3.3],
      [1.425, 0.266, 0.136, 0.14, -0.006, 3.8],
      [1.455, 0.252, 0.12, 0.126, -0.012, 3.6],
      [1.476, 0.22, 0.106, 0.112, -0.016, 3.1],
      [1.492, 0.162, 0.095, 0.1, -0.018, 2.7],
      [1.504, 0.098, 0.084, 0.09, -0.019, 2.3],
    ],
    shoulderX: 0.206, shoulderY: 1.415, upper: 0.305, fore: 0.28, hipX: 0.1,
    neckR: 0.058, headW: 1.02, jaw: 0.14,
  },
  cover: { kind: 'none', hatDY: 0.122, hatDZ: 0.006, pitch: 0.1 },
  garments: [
    // the tunic: black, a belt at the waist, two rows of buttons and the badge
    { kind: 'torso', shade: (th, y) => {
      if (A(y - 1.0) < 0.024) return 0.003;
      const a = A(th);
      if (y > 1.05 && y < 1.4 && A(a - 0.2) < 0.035 && A(((y - 1.05) / 0.085) % 1 - 0.5) < 0.2) return 0.42;
      if (th > 0.35 && th < 0.62 && A(y - 1.3) < 0.03) return 0.55;
      return 0.012;
    } },
    // the coat's skirt to the knee: straight, barely parted
    { kind: 'skirt', y0: 1.0, hem: 0.5, split: 0.3, flare: [1.1, 1.16], back: 0.45, folds: 0.5, grow: 0.01, shade: 'coat' },
    { kind: 'collar', style: 'band', h: 0.05, hFront: 0.044, open: 0.18, gap: 0.01, lean: 0.004, flareOut: 0.004, shade: 'collar' },
    { kind: 'sleeves', r: 0.08, cuff: 0.068 },
    { kind: 'legs', r: 1.0 },
    { kind: 'shoes' },
    { kind: 'hands', s: 1.02 },
    // the cap on the hat bone (a cover the tailor does not have), its peak low
    { kind: 'custom', build: (F, H) => {
      const hb = F.rig.BIND.hat, c = F.cover;
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch ?? 0.1);
      const crown = H.grid(H.seg(64, 18), H.seg(30, 10), (u, v, p) => { capPoint(u, v, p); p.applyQuaternion(tilt).add(hb); });
      H.orientOut(crown, hb.clone().add(new THREE.Vector3(0, 0.04, 0)));
      // the peak: half a flattened ellipsoid tipped down over the brow
      const peak = H.grid(H.seg(32, 12), H.seg(10, 6), (u, v, p) => {
        const a = u * Math.PI - Math.PI / 2, b = v * Math.PI, q = Math.sin(b);
        const x = 0.098 * q * Math.sin(a), zr = Math.cos(a);
        const z = (0.08 + 0.07 * zr) * q * zr;
        const y = 0.003 * Math.cos(b) - 0.42 * Math.max(0, z - 0.07) + 0.002;
        p.set(x, y, z).applyQuaternion(tilt).add(hb);
      }, { wrapU: false });
      peak.computeVertexNormals();
      const felt = F.shade('cover'), band = F.shade('band'), plate = F.shade('plate');
      const w = () => [[H.B.hat, 1]];
      return [
        { geo: crown, shade: (x, y, z) => {
          const h = y - hb.y;
          if (h < 0.034 && z - hb.z > 0.07 && A(x - hb.x) < 0.022 && h > 0.008) return plate;
          return h < 0.036 ? band : felt;
        }, weights: w },
        { geo: peak, shade: band, weights: w },
      ];
    } },
  ],
  skin: { coat: 0.012, collar: 0.01, hand: 0.02, skin: 0.03, cover: 0.014, band: 0.004, plate: 0.5, trousers: 0.007, shoes: 0.004 },
  collider: 0.33,
};

export default { kind: 'o3_patrolman', h: 1.88, costume: PATROLMAN };
