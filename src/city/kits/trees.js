import * as THREE from 'three';
import { tube, V3 } from '../../world/geom.js';
import { PAVE } from '../../world/plan.js';

// NOIR CITY's trees (lane O1b; the brief: "the trees get a shape"; the cold
// play's finding 7: the Hill's trees were balloon discs on sticks). Four
// kinds, each its own silhouette, every one turned by the hash of where it
// stands (forks, lumps, lean):
//   plane   a straight trunk, three limbs, a broad crown of flattened lumps
//   bare    a winter tree: the trunk forks, the limbs fork again, twigs - ink
//           lines against the sky
//   poplar  a Lombardy poplar: a tall narrow flame
//   elm     the vase: the trunk splits low, the crown wide at the top
//   treePieces({ x, z, kind, v (0..1), s (scale) }, y0) -> [[geo, level]] (LEAF / BARK)
export const LEAF = 0.006, BARK = 0.01;
export function treePieces(t, y0 = PAVE) {
  const P = [], v = t.v || 0, s = t.s || 1;
  // (the crown's lumps: low-poly, flattened, each turned - never a ball on a stick)
  const lump = (x, y, z, r, sy = 0.8) => P.push([new THREE.IcosahedronGeometry(r, 1).scale(1, sy, 1).rotateY(v * 7 + x).translate(x, y, z), LEAF]);
  const limb = (pts, r) => P.push([tube(pts.map(([x, y, z]) => V3(x, y, z)), r, 5, Math.max(6, pts.length * 3)), BARK]);
  const a0 = v * Math.PI * 2, lean = (v - 0.5) * 0.4;
  const dir = (a, r) => [Math.cos(a0 + a) * r, Math.sin(a0 + a) * r];
  if (t.kind === 'plane') {
    limb([[0, 0, 0], [0.05 + lean, 2.2, 0], [0.1 + lean, 3.6, 0.05]], 0.17 * s);
    for (let k = 0; k < 3; k++) { const [x, z] = dir(k * 2.1, 1.3 * s); limb([[0.1 + lean, 3.4, 0.05], [x * 0.6, 4.6 * s, z * 0.6], [x, 5.4 * s, z]], 0.08 * s); }
    for (let k = 0; k < 9; k++) { const r = (0.3 + ((k * 0.618 + v) % 1) * 1.7) * s; const [x, z] = dir(k * 2.4 + 0.4, r); lump(x, (4.8 + ((k * 0.41 + v) % 1) * 2.0) * s, z, (0.9 + ((k * 0.33) % 1) * 0.6) * s, 0.8); }
  } else if (t.kind === 'bare') {
    limb([[0, 0, 0], [0.08 + lean, 1.8, 0], [0.12 + lean, 2.8, 0.04]], 0.15 * s);
    for (let k = 0; k < 5; k++) {
      // (each limb bends as it goes out and up, then forks into twigs that bend again)
      const a = k * 1.26 + 0.3 + v;
      const [x, z] = dir(a, 0.9 * s), [xm, zm] = dir(a + 0.25, 1.7 * s), [x2, z2] = dir(a + 0.4, 2.3 * s);
      limb([[0.12 + lean, 2.7, 0.04], [x, 3.6 * s, z], [xm, 4.5 * s, zm], [x2, 5.1 * s + (k % 2) * 0.5, z2]], 0.06 * s);
      for (let q = 0; q < 3; q++) { const [x3, z3] = dir(a + (q - 1) * 0.45, (2.5 + q * 0.3) * s), [x4, z4] = dir(a + (q - 1) * 0.6, (3.0 + q * 0.25) * s); limb([[xm, 4.5 * s, zm], [x3, (5.4 + q * 0.3) * s, z3], [x4, (6.0 + q * 0.4) * s, z4]], 0.018 * s); }
    }
  } else if (t.kind === 'poplar') {
    limb([[0, 0, 0], [0, 2.4, 0]], 0.14 * s);
    for (let k = 0; k < 6; k++) { const [x, z] = dir(k * 2.4, 0.25 * s); lump(x, (2.6 + k * 1.1) * s, z, (0.95 - k * 0.09) * s, 1.4); }
  } else {
    limb([[0, 0, 0], [0.03 + lean, 1.6, 0]], 0.2 * s);
    for (let k = 0; k < 3; k++) { const [x, z] = dir(k * 2.1, 1.6 * s); limb([[0.03 + lean, 1.5, 0], [x * 0.5, 3.6 * s, z * 0.5], [x, 5.6 * s, z]], 0.1 * s); }
    // (the vase's crown: lumps round its rim and its top, wider than tall, open in the middle)
    // (lumps of different sizes at different heights and reaches: a ragged crown, never an umbrella)
    for (let k = 0; k < 11; k++) { const r = (0.5 + ((k * 0.618 + v) % 1) * 2.0) * s; const [x, z] = dir(k * 2.4, r); lump(x, (4.9 + ((k * 0.377 + v * 2) % 1) * 2.2) * s, z, (0.75 + ((k * 0.29) % 1) * 0.55) * s, 0.75 + (k % 3) * 0.1); }
  }
  for (const p of P) p[0].translate(t.x, y0, t.z);
  return P;
}
