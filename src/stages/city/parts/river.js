import * as THREE from 'three';
import { allocInkId, allocSkylineId, LAYER, tagInk } from '../../../render/layers.js';
import { merge, lathe, roundedBox, V3 } from '../../../world/geom.js';
import { Skyline, makeTowerMaterial } from '../../../world/Skyline.js';
import { makeWaterMaterial } from '../../riverroad/water.js';
import { RIVER, RIVER_LEN, riverFrame, riverPoint, WATER_Y, CANAL, PAVE, BRIDGE, NS, PIER } from '../plan.js';

// The water: the river east of the quay and the canal along the north, one
// black plane that carries the lights in it as broken columns (the river
// road's water: riverroad/water.js), the quay's cast-iron railing (the
// car's wall on that side), the canal's, the lift bridge up at the avenue's
// end (its barrier, its raised leaf against the sky), the far bank's lights
// and its towers in clusters, the city round the district's other edges.
// API: { water, far, update(camera, pixelHeight) }
const ROW_TONE = [0.30, 0.32, 0.33, 0.34], ROW_HAZE = [0.08, 0.12, 0.16, 0.2];

export default {
  name: 'river', order: 70,
  *buildSteps(stage) {
    const { scene, M, U } = stage;
    const rng = stage.rng.fork(701);
    const group = new THREE.Group();
    group.name = 'river';
    scene.add(group);
    // the water: one plane under the land (the land's shape stops at the
    // quay and the canal's edge)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), makeWaterMaterial(U, WATER_Y));
    water.position.set(300, WATER_Y, -100);
    water.layers.set(LAYER.GROUND);
    water.userData.inkId = allocSkylineId();
    water.userData.noRay = true;
    water.name = 'water';
    scene.add(water);
    // ---- the railings: posts every 2 m, a pier every 20, two rails ------------
    const post = lathe([[0, 0], [0.07, 0], [0.07, 0.06], [0.04, 0.1], [0.03, 0.5], [0.045, 0.53], [0.03, 0.56], [0.028, 1.02], [0.05, 1.06], [0.04, 1.12], [0, 1.16]], 10).translate(0, PAVE, 0);
    const pier = roundedBox(0.34, 1.25, 0.34, 0.04, 2).translate(0, PAVE + 0.62, 0);
    const posts = [], piers = [], rails = [];
    const addRail = (pts) => {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const m = new THREE.Matrix4().makeTranslation(p.x, 0, p.z);
        if (i % 10 === 0) piers.push(m); else posts.push(m);
        if (i > 0) {
          const a = pts[i - 1], L = a.distanceTo(p);
          for (const y of [PAVE + 0.55, PAVE + 1.08]) rails.push(new THREE.CylinderGeometry(0.028, 0.028, L, 6).rotateZ(Math.PI / 2).rotateY(Math.atan2(-(p.z - a.z), p.x - a.x)).translate((a.x + p.x) / 2, y, (a.z + p.z) / 2));
        }
      }
    };
    { const pts = []; for (let s = 0; s <= RIVER_LEN; s += 2) pts.push(riverPoint(s, -RIVER.rail)); addRail(pts); }
    // the canal's south rail (broken at the bridge's barrier)
    for (const [x0, x1] of [[-262, BRIDGE.x - NS.avenue.hw - 0.5], [BRIDGE.x + NS.avenue.hw + 0.5, 112]]) {
      const pts = []; for (let x = x0; x <= x1; x += 2) pts.push(V3(x, 0, CANAL.z0 + 0.2)); addRail(pts);
    }
    // the pier yard's south rail
    { const pts = []; for (let x = PIER.yard.x0; x <= PIER.yard.x1; x += 2) pts.push(V3(x, 0, PIER.yard.z1 + 0.3)); addRail(pts); }
    const inst = (geo, list) => {
      const im = new THREE.InstancedMesh(geo, M.lampIron, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.userData.inkId = allocInkId(); im.userData.inkPerInstance = false; im.userData.noRay = true;
      im.frustumCulled = false;
      group.add(im);
      return im;
    };
    inst(post, posts); inst(pier, piers);
    const railM = new THREE.Mesh(merge(rails), M.lampIron);
    tagInk(railM); railM.userData.noRay = true;
    group.add(railM);
    yield;
    // ---- the lift bridge at the avenue's end: up -------------------------------------
    {
      const parts = [];
      const W2 = NS.avenue.hw * 2 + 2;
      // the barrier: a striped iron gate across the road, its two posts
      parts.push(new THREE.BoxGeometry(W2, 0.12, 0.12).translate(BRIDGE.x, 1.05, CANAL.z0 - 0.9));
      parts.push(new THREE.BoxGeometry(W2, 0.1, 0.1).translate(BRIDGE.x, 0.55, CANAL.z0 - 0.9));
      for (const x of [-W2 / 2, W2 / 2]) parts.push(new THREE.BoxGeometry(0.35, 1.6, 0.35).translate(BRIDGE.x + x, 0.8, CANAL.z0 - 0.9));
      // the leaf raised against the sky (its hinge at the canal's far side),
      // the counterweight tower beside it
      const leaf = new THREE.BoxGeometry(W2 - 2, 0.9, 30).translate(0, 0, 15);
      leaf.rotateX(-1.25);
      leaf.translate(BRIDGE.x, 0.4, CANAL.z1 + 2);
      parts.push(leaf);
      parts.push(new THREE.BoxGeometry(4, 18, 4).translate(BRIDGE.x - W2 / 2 - 3, 9, CANAL.z1 + 1));
      parts.push(new THREE.BoxGeometry(4, 18, 4).translate(BRIDGE.x + W2 / 2 + 3, 9, CANAL.z1 + 1));
      const m = new THREE.Mesh(merge(parts), M.iron);
      tagInk(m);
      group.add(m);
      const boards = [];
      for (let k = 0; k < 6; k++) boards.push(new THREE.BoxGeometry(W2 / 6 * 0.5, 0.13, 0.13).translate(BRIDGE.x - W2 / 2 + (k + 0.5) * W2 / 6, 1.05, CANAL.z0 - 0.83));
      const bm = new THREE.Mesh(merge(boards), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.6 }));
      bm.userData.inkId = m.userData.inkId; bm.userData.noRay = true;
      group.add(bm);
    }
    yield;
    // ---- the far bank: its low sheds and its lights ------------------------------------
    const far = [];
    const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(2.2) });
    const bank = [], lights = [];
    const FARX = 430;
    for (let z = -520; z < 520; z += rng.range(18, 40)) {
      const h = rng.range(4, 11), w = rng.range(14, 36);
      bank.push(new THREE.BoxGeometry(rng.range(10, 24), h, w).translate(FARX + rng.range(0, 30), WATER_Y + h / 2 + 1.2, z));
      if (rng.chance(0.55)) {
        const ly = WATER_Y + 1.4 + rng.range(4, 7);
        const lz = z + rng.range(-8, 8);
        lights.push(new THREE.SphereGeometry(0.55, 8, 6).translate(FARX - 2, ly, lz));
        far.push({ p: V3(FARX - 2, ly, lz), k: rng.range(0.7, 1.6), w: 0.8 });
      }
    }
    const bankMesh = new THREE.Mesh(merge(bank), M.brickFar);
    bankMesh.userData.inkId = allocSkylineId(); bankMesh.userData.noRay = true;
    group.add(bankMesh);
    const lm = new THREE.Mesh(merge(lights), lit);
    lm.userData.inkId = bankMesh.userData.inkId; lm.userData.noRay = true;
    group.add(lm);
    // ---- the city beyond: across the river, past the rail yard, past the
    // canal, past the depot (the block's towers, flat fogged silhouettes)
    const sk = Object.create(Skyline.prototype);
    Object.assign(sk, { world: stage, windows: [], _az: [], wrng: stage.rng.fork(702), group });
    const trng = stage.rng.fork(703);
    const rings = [
      { at: (u) => [FARX + trng.range(40, 200), u], span: [-700, 700], h: [34, 100], w: [14, 28], gap: [22, 56] },
      { at: (u) => [FARX + trng.range(260, 420), u], span: [-900, 900], h: [60, 180], w: [18, 32], gap: [26, 64] },
      { at: (u) => [u, -520 - trng.range(0, 160)], span: [-700, 500], h: [40, 140], w: [16, 30], gap: [30, 70] },
      { at: (u) => [-560 - trng.range(0, 200), u], span: [-700, 500], h: [40, 140], w: [16, 30], gap: [30, 70] },
      { at: (u) => [u, 420 + trng.range(0, 200)], span: [-700, 380], h: [30, 110], w: [16, 30], gap: [34, 80] },
    ];
    yield;
    for (let ri = 0; ri < rings.length; ri++) {
      const R = rings[ri];
      const parts = [];
      for (let u = R.span[0]; u < R.span[1]; u += trng.range(R.gap[0], R.gap[1])) {
        const [x, z] = R.at(u);
        const h = trng.range(R.h[0], R.h[1]);
        if (trng.chance(0.3)) sk.slabTower(parts, trng, x, z, h * 0.9, trng.range(R.w[0], R.w[1]) * 1.2);
        else sk.tower(parts, trng, x, z, h, trng.range(R.w[0], R.w[1]) * 1.2, Math.min(3, ri % 2 + 1), false, 0);
      }
      const ring = ri === 1 ? 1 : 0;
      const mesh = new THREE.Mesh(merge(parts), makeTowerMaterial(U, ROW_TONE[ring + 1], ROW_HAZE[ring + 1]));
      mesh.userData.inkId = allocSkylineId();
      mesh.userData.noRay = true;
      mesh.frustumCulled = false;
      group.add(mesh);
      yield;
    }
    sk.buildWindows();
    if (sk.windowMesh) sk.windowMesh.userData.noRay = true;
    // ---- the lights the water carries: the quay's lamps near the eye, the far bank's
    const cand = [];
    const res = { x: 1, y: 1 };
    void riverFrame;
    return {
      group, water, far,
      update(camera, pixelHeight) {
        const p = camera.position;
        if (!water.material.setLights) return;
        cand.length = 0;
        const L = stage.lamps;
        if (L && L.posts) for (const l of L.posts) {
          if (l.dead || !l.on || l.bent) continue;
          if (Math.abs(l.head.x - p.x) + Math.abs(l.head.z - p.z) > 260) continue;
          // (only the quay's and the canal's lamps stand over water)
          if (!l.overWater) continue;
          cand.push({ p: l.head, k: 3.2, w: 0.55 });
        }
        for (const f of far) cand.push(f);
        const LM = stage.part('landmarks');
        if (LM) for (const f of LM.lights) cand.push(f);
        res.y = pixelHeight || 900; res.x = res.y * camera.aspect;
        water.material.setLights(cand, camera, res);
      },
    };
  },
  // (built whole, or a step at a time when the stage is warmed: Stages.warm)
  build(stage) { const it = this.buildSteps(stage); let r; while (!(r = it.next()).done); return r.value; },
  update: (r, dt, t, camera, ph) => r.update(camera, ph),
};
