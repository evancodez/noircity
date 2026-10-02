import * as THREE from 'three';
import { allocInkId } from '../../../render/layers.js';
import { merge } from '../../../world/geom.js';
import { BLOCKS } from '../plan.js';
import { lotsOf } from '../layout.js';

// The city's buildings: every block's lots (layout.js) as masses of dark
// brick and stone, three to six storeys, their cornices and parapets, the
// window rows (dark, a few lit), the ground floors' shop fronts and doors,
// the warehouses along the wharf with their loading doors. A block is a few
// meshes (the masses, the dark openings, the lit ones); the vehicles' walls
// are the lots' footprints (the track part).
//   api.lots: [{ x0, x1, z0, z1, h, block }]  (axis-aligned footprints)
//   api.blocks: [{ b, meshes, mid, lots, seen }]  (sight: block.seen)
const SHOW = 330;

export default {
  name: 'buildings', order: 60,
  build(stage) {
    const { scene, M } = stage;
    const lots = lotsOf(stage.rng.fork(601));
    const rng = stage.rng.fork(603);
    const group = new THREE.Group();
    group.name = 'buildings';
    scene.add(group);
    const lit = M.windowLit, shop = M.windowLitDim;
    const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const byBlock = new Map();
    for (const l of lots) {
      if (!byBlock.has(l.block)) byBlock.set(l.block, { body: [], dark: [], lit: [], shop: [], lots: [] });
      const B = byBlock.get(l.block);
      B.lots.push(l);
      const { x0: xa, x1: xb, z0: za, z1: zb, h, floors, fh, side, warehouse } = l;
      B.body.push(box(xa, xb, 0, h, za, zb));
      // cornice and parapet
      B.body.push(box(xa - 0.1, xb + 0.1, h - 0.35, h + 0.05, za - (side <= 0 ? 0.45 : 0), zb + (side >= 0 ? 0.45 : 0)));
      B.body.push(box(xa, xb, h + 0.05, h + 0.75, za + (side <= 0 ? 0 : 0.2), zb - (side >= 0 ? 0 : 0.2)));
      // the faces' windows: north (side <= 0) and south (side >= 0), and the
      // ends that face a street
      const faces = [];
      if (side <= 0) faces.push({ n: [0, -1], a: xa, b: xb, at: za });
      if (side >= 0) faces.push({ n: [0, 1], a: xa, b: xb, at: zb });
      if (l.west) faces.push({ n: [-1, 0], a: za, b: zb, at: xa });
      if (l.east) faces.push({ n: [1, 0], a: za, b: zb, at: xb });
      for (const f of faces) {
        const L = f.b - f.a;
        const step = warehouse ? rng.range(6, 9) : rng.range(2.6, 3.4);
        const n = Math.max(1, Math.floor((L - 1.5) / step));
        const off = (L - (n - 1) * step) / 2;
        const quad = (u, y0, y1, w2, list, out = 0.06) => {
          const c = f.a + u;
          if (f.n[0] === 0) list.push(box(c - w2, c + w2, y0, y1, f.at + f.n[1] * out - 0.02, f.at + f.n[1] * out + 0.02));
          else list.push(box(f.at + f.n[0] * out - 0.02, f.at + f.n[0] * out + 0.02, y0, y1, c - w2, c + w2));
        };
        for (let k = 0; k < n; k++) {
          const u = off + k * step;
          if (warehouse) quad(u, 0.15, 3.9, 1.8, B.dark);
          else if (rng.chance(0.6)) quad(u, 0.4, 3.0, step * 0.42, rng.chance(0.14) ? B.shop : B.dark);
          else quad(u, 0.15, 2.5, 0.55, B.dark);
          for (let fl = 1; fl < floors; fl++) {
            const y = 1.2 + fl * fh + 0.6;
            if (y + 1.6 > h - 0.6) break;
            quad(u, y, y + (warehouse ? 1.4 : 1.7), warehouse ? 1.1 : 0.55, rng.chance(warehouse ? 0.05 : 0.09) ? B.lit : B.dark);
          }
          if (!warehouse && k > 0 && rng.chance(0.35)) quad(u - step / 2, 0, h - 0.4, 0.18, B.body, 0.12);
        }
      }
    }
    const blocks = [];
    for (const b of BLOCKS) {
      const B = byBlock.get(b);
      const mid = new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
      if (!B) { blocks.push({ b, meshes: [], mid, lots: [] }); continue; }
      const id = allocInkId();
      const meshes = [];
      const mk = (list, mat) => {
        if (!list.length) return;
        const m = new THREE.Mesh(merge(list), mat);
        m.userData.inkId = id;
        m.receiveShadow = true;
        if (mat !== M.brickFar) m.userData.noRay = true;
        group.add(m);
        meshes.push(m);
      };
      mk(B.body, M.brickFar); mk(B.dark, M.black); mk(B.lit, lit); mk(B.shop, shop);
      blocks.push({ b, meshes, mid, lots: B.lots });
    }
    const api = {
      group, lots, blocks,
      update(camera) {
        const p = camera.position;
        for (const B of blocks) {
          const far = Math.hypot(B.mid.x - p.x, B.mid.z - p.z) > SHOW;
          const v = !far && B.seen !== false;
          if (B._v === v) continue;
          B._v = v;
          for (const m of B.meshes) m.visible = v;
        }
      },
    };
    return api;
  },
  update: (b, dt, t, camera) => b.update(camera),
};
