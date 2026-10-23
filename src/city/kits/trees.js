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
    for (let k = 0; k < 6; k++) { const [x, z] = dir(k * 1.05 + 0.4, (k % 2 ? 1.6 : 0.9) * s); lump(x, (5.4 + (k % 3) * 0.5) * s, z, (1.3 + (k % 2) * 0.35) * s, 0.7); }
  } else if (t.kind === 'bare') {
    limb([[0, 0, 0], [0.08 + lean, 1.8, 0], [0.12 + lean, 2.8, 0.04]], 0.15 * s);
    for (let k = 0; k < 4; k++) {
      const [x, z] = dir(k * 1.57 + 0.3, 1.0 * s), [x2, z2] = dir(k * 1.57 + 0.6, 2.2 * s);
      limb([[0.12 + lean, 2.7, 0.04], [x, 3.8 * s, z], [x2, 5.2 * s, z2]], 0.07 * s);
      for (let q = 0; q < 2; q++) { const [x3, z3] = dir(k * 1.57 + (q ? 0.9 : 0.1), 2.8 * s); limb([[x * 0.9 + x2 * 0.1, 4.1 * s, z * 0.9 + z2 * 0.1], [x3, 5.8 * s + q * 0.6, z3]], 0.025 * s); }
    }
  } else if (t.kind === 'poplar') {
    limb([[0, 0, 0], [0, 2.4, 0]], 0.14 * s);
    for (let k = 0; k < 6; k++) { const [x, z] = dir(k * 2.4, 0.25 * s); lump(x, (2.6 + k * 1.1) * s, z, (0.95 - k * 0.09) * s, 1.4); }
  } else {
    limb([[0, 0, 0], [0.03 + lean, 1.6, 0]], 0.2 * s);
    for (let k = 0; k < 3; k++) { const [x, z] = dir(k * 2.1, 1.6 * s); limb([[0.03 + lean, 1.5, 0], [x * 0.5, 3.6 * s, z * 0.5], [x, 5.6 * s, z]], 0.1 * s); }
    // (the vase's crown: lumps round its rim and its top, wider than tall, open in the middle)
    for (let k = 0; k < 8; k++) { const [x, z] = dir(k * 0.785, (k % 2 ? 2.4 : 1.7) * s); lump(x, (5.7 + (k % 3) * 0.45) * s, z, (0.95 + (k % 3) * 0.22) * s, 0.55); }
  }
  for (const p of P) p[0].translate(t.x, y0, t.z);
  return P;
}
