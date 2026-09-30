import * as THREE from 'three';
import { LAYER, tagInk, allocInkId, allocSkylineId } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { smoothNormals } from '../../../world/geom.js';
import { ROAD, frameAt, project, groundAt } from '../road.js';
import { makeWaterMaterial } from '../water.js';

// The wet road, its pavements and kerbs, the quay wall and the river below
// it. Ribbons along the road's line (the ground shaders read the world
// position: the wet street is the block's own material), the water a wide
// plane 2.1 m down past the quay (the same wet shader: black water that
// carries the far lights down in long streaks).
const F = {};
// a flat ribbon from d0 to d1 at height y, every `step` m from s0 to s1
// (past the road's ends it runs on straight)
export function ribbon(d0, d1, y, s0 = -40, s1 = ROAD.len + 40, step = 4) {
  const pos = [], nrm = [], idx = [];
  let n = 0;
  for (let s = s0; s <= s1 + 1e-6; s += step) {
    const sc = Math.max(0, Math.min(ROAD.len, s));
    frameAt(sc, F);
    const ex = s - sc;
    for (const d of [d0, d1]) {
      pos.push(F.x + F.fx * ex + F.rx * d, y, F.z + F.fz * ex + F.rz * d);
      nrm.push(0, 1, 0);
    }
    if (n > 0) { const a = (n - 1) * 2, b = n * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  // (winding: the face must look up)
  g.computeVertexNormals();
  const nz = g.getAttribute('normal');
  if (nz.getY(0) < 0) { const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// a vertical wall ribbon at d from y0 to y1, facing -d (toward the road) or +d
function wallRibbon(d, y0, y1, face = -1, s0 = -40, s1 = ROAD.len + 40, step = 4) {
  const pos = [], idx = [];
  let n = 0;
  for (let s = s0; s <= s1 + 1e-6; s += step) {
    const sc = Math.max(0, Math.min(ROAD.len, s));
    frameAt(sc, F);
    const ex = s - sc;
    const x = F.x + F.fx * ex + F.rx * d, z = F.z + F.fz * ex + F.rz * d;
    pos.push(x, y0, z, x, y1, z);
    if (n > 0) { const a = (n - 1) * 2, b = n * 2; if (face < 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// a kerb stone profile swept along d
function kerb(d, sign, s0 = -40, s1 = ROAD.len + 40) {
  const h = ROAD.pave - 0.003;
  const prof = [[-0.3 * sign, -0.05], [0, -0.05], [0, h - 0.04], [-0.04 * sign, h], [-0.3 * sign, h]];
  const pos = [], idx = [];
  const m = prof.length;
  let n = 0;
  for (let s = s0; s <= s1 + 1e-6; s += 4) {
    const sc = Math.max(0, Math.min(ROAD.len, s));
    frameAt(sc, F);
    const ex = s - sc;
    for (const [px, py] of prof) {
      const dd = d - px;   // (the profile's x runs toward the road for sign 1)
      pos.push(F.x + F.fx * ex + F.rx * dd, py, F.z + F.fz * ex + F.rz * dd);
    }
    if (n > 0) for (let j = 0; j < m - 1; j++) { const a = (n - 1) * m + j, b = n * m + j; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export default {
  name: 'street', order: 20, tick: 21,
  update: (g, dt, t, camera) => g.update(camera),
  build(stage) {
    const { scene, U, M } = stage;
    // (in chunks of CH m: each is culled, and those near the road's end are
    // in the bullets' world - a mesh far from the block's middle is not)
    const CH = 120, chunks = [];
    const roadMat = makeGroundMaterial(U, { paving: 0 }), paveMat = makeGroundMaterial(U, { paving: 1 });
    const roadId = allocInkId(), paveLId = allocInkId(), paveRId = allocInkId(), kerbId = allocInkId(), quayId = allocInkId();
    for (let s0 = -40; s0 < ROAD.len + 40; s0 += CH) {
      const s1 = Math.min(ROAD.len + 40, s0 + CH);
      const mk = (geo, mat, id, ground = true) => {
        const m = new THREE.Mesh(geo, mat);
        if (ground) m.layers.set(LAYER.GROUND);
        m.receiveShadow = true;
        m.userData.inkId = id;
        scene.add(m);
        return m;
      };
      const road = mk(ribbon(ROAD.kerbL - 0.4, ROAD.kerbR + 0.4, 0, s0, s1), roadMat, roadId);
      road.name = 'riverroad';
      const paveL = mk(ribbon(-60, ROAD.kerbL, ROAD.pave, s0, s1), paveMat, paveLId);
      const paveR = mk(ribbon(ROAD.kerbR, ROAD.quay, ROAD.pave, s0, s1), paveMat, paveRId);
      const kerbs = mk(smoothNormals(mergeTwo(kerb(ROAD.kerbL, -1, s0, s1), kerb(ROAD.kerbR, 1, s0, s1)), 1e-3), M.kerb, kerbId, false);
      // the quay: its wall down to the water
      const quay = mk(wallRibbon(ROAD.quay, ROAD.waterY - 0.5, ROAD.pave, 1, s0, s1), M.stone || M.kerb, quayId, false);
      chunks.push({ meshes: [road, paveL, paveR, kerbs, quay], s0, s1 });
    }
    const road = chunks[0].meshes[0], paveL = chunks[0].meshes[1], paveR = chunks[0].meshes[2], kerbs = chunks[0].meshes[3], quay = chunks[0].meshes[4];
    // the river: one wide plane, black water that carries the lights
    // ([R2] its own shader, ../water.js: the street's wet stone printed it as
    // black ground and took no light off the far bank)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2), makeWaterMaterial(U, ROAD.waterY));
    const mid = frameAt(ROAD.len / 2, {});
    water.position.set(mid.x + 900, ROAD.waterY, mid.z);
    water.layers.set(LAYER.GROUND);
    // (a skyline id: the ink leaves it its own tones - no dry-brush field,
    // none of the street's paper slashes, which on open water printed as
    // long grey scratches over the black)
    water.userData.inkId = allocSkylineId();
    water.userData.noRay = true;
    water.name = 'river';
    scene.add(water);
    // the walking surface: the pavements are raised (the kerb eased)
    const hint = { s: null };
    const P = {};
    stage.addSurface((x, z) => {
      project(x, z, hint.s, P);
      hint.s = P.s;
      if (P.d > ROAD.quay + 0.05) return ROAD.waterY;
      return groundAt(P.d);
    });
    const api = {
      road, paveL, paveR, kerbs, quay, water, chunks,
      update(camera) {
        const p = camera.position;
        for (const c of chunks) {
          const m = frameAt(Math.max(0, Math.min(ROAD.len, (c.s0 + c.s1) / 2)), F);
          const v = Math.hypot(m.x - p.x, m.z - p.z) < 330;
          for (const x of c.meshes) x.visible = v;
        }
      },
      // footfalls and bullet rings on the wet road (the block's street API)
      addImpact(world, x, z, strength = 1) {
        const arr = world.U.uImpacts.value;
        let oldest = 0;
        for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
        arr[oldest].set(x, z, world.U.uTime.value, strength);
      },
      addBlast(world, x, z, strength = 3) {
        const arr = world.U.uBlasts.value;
        let oldest = 0;
        for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
        arr[oldest].set(x, z, world.U.uTime.value, strength);
      },
    };
    return api;
  },
};

function mergeTwo(a, b) {
  const pa = a.getAttribute('position').array, pb = b.getAttribute('position').array;
  const pos = new Float32Array(pa.length + pb.length);
  pos.set(pa); pos.set(pb, pa.length);
  const ia = a.index.array, ib = b.index.array, off = pa.length / 3;
  const idx = new Uint32Array(ia.length + ib.length);
  idx.set(ia); for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + off;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}
