import * as THREE from 'three';
import { tagInk, allocInkId } from '../../../render/layers.js';
import { merge, V3 } from '../../../world/geom.js';
import { ROAD, roadPoint, frameAt } from '../road.js';

// The warehouses along the far side of the el: long brick masses at the
// road's left wall (ROAD.wall), broken by side streets (the truck comes out
// of one), with loading doors, a cornice, pilasters, a few lit windows and
// signs. Chunked by ~100 m; a chunk past SHOW m is not drawn.
// API: { streets: [{ s, w }], chunks, update(camera) }
export const STREETS = [{ s: 300, w: 14 }, { s: ROAD.marks.truck, w: 15 }, { s: 1012, w: 13 }];
const SHOW = 300;
const F = {};

export default {
  name: 'buildings', order: 60,
  build(stage) {
    const { scene, M } = stage;
    const rng = stage.rng.fork(601);
    const group = new THREE.Group();
    group.name = 'buildings';
    scene.add(group);
    const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(0.55) });
    const black = M.black;
    // (s0, s1) spans of building between the side streets
    const spans = [];
    let s = -60;
    for (const st of [...STREETS, { s: ROAD.len + 120, w: 0 }]) {
      spans.push([s, st.s - st.w / 2]);
      s = st.s + st.w / 2;
    }
    const byChunk = new Map();
    const bucket = (sMid) => {
      const k = Math.floor(sMid / 100);
      if (!byChunk.has(k)) byChunk.set(k, { body: [], dark: [], lit: [], mid: roadPoint(Math.max(0, Math.min(ROAD.len, k * 100 + 50)), ROAD.wall - 8) });
      return byChunk.get(k);
    };
    // a box in the road's frame: along s (ls long), across d (from d0 to d1), y0..y1
    const box = (sc, ls, d0, d1, y0, y1) => {
      const s0 = Math.max(0, Math.min(ROAD.len, sc));
      frameAt(s0, F);
      const g = new THREE.BoxGeometry(ls, y1 - y0, Math.abs(d1 - d0));
      const c = roadPoint(s0, (d0 + d1) / 2, (y0 + y1) / 2).addScaledVector(V3(F.fx, 0, F.fz), sc - s0);
      g.rotateY(Math.atan2(F.fx, F.fz) + Math.PI / 2);
      g.translate(c.x, c.y, c.z);
      return g;
    };
    const face = ROAD.wall;
    for (const [a, b] of spans) {
      let x = a;
      while (x < b - 8) {
        const len = Math.min(b - x, rng.range(34, 72));
        if (len < 10) break;
        const mid = x + len / 2;
        const B = bucket(mid);
        const h = rng.range(8, 15), dep = rng.range(18, 30);
        B.body.push(box(mid, len, face - dep, face, 0, h));
        // cornice and a parapet
        B.body.push(box(mid, len + 0.4, face - 0.1, face + 0.45, h - 0.2, h + 0.35));
        // pilasters every ~6 m
        for (let p = x + 3; p < x + len - 1; p += 6) B.body.push(box(p, 0.7, face - 0.1, face + 0.3, 0, h - 0.2));
        // a plinth
        B.body.push(box(mid, len, face - 0.1, face + 0.2, 0, 0.9));
        // loading doors (black openings, a lintel over each) and a few windows
        for (let p = x + 5; p < x + len - 4; p += rng.range(9, 15)) {
          const w = rng.range(3, 4.4), dh = rng.range(3.2, 4.2);
          B.dark.push(box(p, w, face + 0.05, face + 0.12, 0.15, dh));
          B.body.push(box(p, w + 0.6, face - 0.1, face + 0.35, dh, dh + 0.35));
          const floors = Math.floor((h - 5) / 3.4);
          for (let f = 0; f < floors; f++) {
            const wy = 5.2 + f * 3.4;
            if (wy > h - 1.5) break;
            (rng.chance(0.1) ? B.lit : B.dark).push(box(p, 1.3, face + 0.05, face + 0.1, wy, wy + 1.7));
          }
        }
        x += len + rng.range(0, 1.2);
      }
    }
    // the side streets: their floor is the pavement's; a far wall closes each
    // (a black mass 40 m down it) so the gap reads as a street, not a void
    for (const st of STREETS) {
      const B = bucket(st.s);
      B.body.push(box(st.s, st.w + 4, face - 70, face - 60, 0, 14));
    }
    const chunks = [];
    for (const B of byChunk.values()) {
      const mk = (list, mat, id) => {
        if (!list.length) return null;
        const m = new THREE.Mesh(merge(list), mat);
        m.userData.inkId = id;
        m.receiveShadow = true;
        group.add(m);
        return m;
      };
      const id = allocInkId();
      const body = mk(B.body, M.brickFar, id);
      const dark = mk(B.dark, black, id);
      const lm = mk(B.lit, lit, id);
      if (lm) lm.userData.noRay = true;
      chunks.push({ meshes: [body, dark, lm].filter(Boolean), mid: B.mid });
    }
    return {
      group, streets: STREETS, chunks,
      update(camera) {
        const p = camera.position;
        for (const c of chunks) { const v = Math.hypot(c.mid.x - p.x, c.mid.z - p.z) < SHOW; for (const m of c.meshes) m.visible = v; }
      },
    };
  },
  update: (b, dt, t, camera) => b.update(camera),
};
