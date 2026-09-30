import * as THREE from 'three';
import { LAYER, tagInk, allocInkId } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { smoothNormals } from '../../../world/geom.js';
import { ROAD, frameAt, project, groundAt } from '../road.js';

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
function kerb(d, sign) {
  const h = ROAD.pave - 0.003;
  const prof = [[-0.3 * sign, -0.05], [0, -0.05], [0, h - 0.04], [-0.04 * sign, h], [-0.3 * sign, h]];
  const pos = [], idx = [];
  const m = prof.length;
  let n = 0;
  for (let s = -40; s <= ROAD.len + 40; s += 4) {
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
  name: 'street', order: 20,
  build(stage) {
    const { scene, U, M } = stage;
    const road = new THREE.Mesh(ribbon(ROAD.kerbL - 0.4, ROAD.kerbR + 0.4, 0), makeGroundMaterial(U, { paving: 0 }));
    road.layers.set(LAYER.GROUND);
    road.receiveShadow = true;
    road.userData.inkId = allocInkId();
    road.name = 'riverroad';
    road.frustumCulled = false;
    scene.add(road);
    const paveMat = makeGroundMaterial(U, { paving: 1 });
    const paveL = new THREE.Mesh(ribbon(-60, ROAD.kerbL, ROAD.pave), paveMat);
    const paveR = new THREE.Mesh(ribbon(ROAD.kerbR, ROAD.quay, ROAD.pave), paveMat);
    for (const p of [paveL, paveR]) {
      p.layers.set(LAYER.GROUND); p.receiveShadow = true; p.userData.inkId = allocInkId(); p.frustumCulled = false;
      scene.add(p);
    }
    const kerbs = new THREE.Mesh(new THREE.BufferGeometry(), M.kerb);
    {
      const a = kerb(ROAD.kerbL, -1), b = kerb(ROAD.kerbR, 1);
      kerbs.geometry.dispose();
      kerbs.geometry = smoothNormals(mergeTwo(a, b), 1e-3);
    }
    kerbs.receiveShadow = true;
    kerbs.frustumCulled = false;
    tagInk(kerbs);
    scene.add(kerbs);
    // the quay: its wall down to the water, a coping stone on its edge
    const quay = new THREE.Mesh(wallRibbon(ROAD.quay, ROAD.waterY - 0.5, ROAD.pave, 1), M.stone || M.kerb);
    quay.frustumCulled = false; quay.receiveShadow = true;
    tagInk(quay);
    scene.add(quay);
    // the river: one wide plane, black water under the wet shader
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2), makeGroundMaterial(U, { paving: 0 }));
    const mid = frameAt(ROAD.len / 2, {});
    water.position.set(mid.x + 900, ROAD.waterY, mid.z);
    water.layers.set(LAYER.GROUND);
    water.userData.inkId = allocInkId();
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
      road, paveL, paveR, kerbs, quay, water,
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
