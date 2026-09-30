import * as THREE from 'three';
import { tagInk, allocInkId, allocSkylineId, markFigure } from '../../../render/layers.js';
import { merge, sweep, lathe, roundedBox, V3 } from '../../../world/geom.js';
import { Skyline, makeTowerMaterial } from '../../../world/Skyline.js';
import { ROAD, roadPoint, frameAt } from '../road.js';

// The river side: the cast-iron railing on the quay (the car's right wall,
// the rail a man is bent back over), the far bank's low sheds and its
// lights (they come down the black water in long streaks), a freighter
// moored along the quay near the road's end, and the city across the river
// (the block's own deco towers, set far out on the other bank and on the
// el's side behind the warehouses).
// API: { railD, hull: { s0, s1 }, group }
const ROW_TONE = [0.30, 0.32, 0.33, 0.34], ROW_HAZE = [0.08, 0.12, 0.16, 0.2];
const F = {};

export default {
  name: 'river', order: 70,
  build(stage) {
    const { scene, M, U } = stage;
    const rng = stage.rng.fork(701);
    const group = new THREE.Group();
    group.name = 'river';
    scene.add(group);
    const d = ROAD.rail;

    // ---- the railing: posts every 2 m, a pier every 20, two rails ------------
    const post = merge([
      lathe([[0, 0], [0.07, 0], [0.07, 0.06], [0.04, 0.1], [0.03, 0.5], [0.045, 0.53], [0.03, 0.56], [0.028, 1.02], [0.05, 1.06], [0.04, 1.12], [0, 1.16]], 10),
    ]).translate(0, ROAD.pave, 0);
    const pier = roundedBox(0.34, 1.25, 0.34, 0.04, 2).translate(0, ROAD.pave + 0.62, 0);
    const posts = [], piers = [];
    const q = new THREE.Quaternion(), up = V3(0, 1, 0);
    for (let s = -30; s < ROAD.len + 40; s += 2) {
      const sc = Math.max(0, Math.min(ROAD.len, s));
      frameAt(sc, F);
      const p = roadPoint(sc, d, 0).addScaledVector(V3(F.fx, 0, F.fz), s - sc);
      q.setFromAxisAngle(up, Math.atan2(F.fx, F.fz));
      const m = new THREE.Matrix4().compose(p, q, V3(1, 1, 1));
      if (Math.round(s) % 20 === 0) piers.push(m); else posts.push(m);
    }
    const inst = (geo, mats, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.userData.inkId = allocInkId();
      im.userData.inkPerInstance = false;
      im.userData.noRay = true;
      im.frustumCulled = false;
      group.add(im);
      return im;
    };
    inst(post, posts, M.lampIron);
    inst(pier, piers, M.iron);
    // the rails, in chunks
    const CH = 120, chunks = [];
    for (let s0 = -30; s0 < ROAD.len + 40; s0 += CH) {
      const line = (y) => { const out = []; for (let s = s0; s <= s0 + CH + 0.01; s += 3) { const sc = Math.max(0, Math.min(ROAD.len, s)); frameAt(sc, F); out.push(roadPoint(sc, d, y).addScaledVector(V3(F.fx, 0, F.fz), s - sc)); } return out; };
      const parts = [
        sweep(line(ROAD.pave + 1.05), [[-0.045, 0], [0.045, 0], [0.045, 0.06], [-0.045, 0.06]], { flat: true }),
        sweep(line(ROAD.pave + 0.52), [[-0.025, 0], [0.025, 0], [0.025, 0.035], [-0.025, 0.035]], { flat: true }),
        // the coping stone under the posts
        sweep(line(ROAD.pave), [[-0.25, -0.02], [0.35, -0.02], [0.35, 0.08], [-0.25, 0.08]], { flat: true }),
      ];
      const m = new THREE.Mesh(merge(parts), M.lampIron);
      tagInk(m);
      m.receiveShadow = true;
      group.add(m);
      chunks.push({ mesh: m, mid: roadPoint(Math.max(0, Math.min(ROAD.len, s0 + CH / 2)), d) });
    }

    // ---- the far bank: sheds on piles, a few lamps and lit windows ---------
    const bank = [], lights = [];
    const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(3.2) });
    const dim = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(0.9) });
    const dimParts = [];
    for (let s = -300; s < ROAD.len + 400; s += rng.range(26, 60)) {
      const sc = Math.max(0, Math.min(ROAD.len, s));
      frameAt(sc, F);
      const dd = 230 + rng.range(-20, 30);
      const c = roadPoint(sc, dd, 0).addScaledVector(V3(F.fx, 0, F.fz), s - sc);
      const w = rng.range(18, 46), h = rng.range(6, 14), dp = rng.range(12, 22);
      const g = new THREE.BoxGeometry(w, h, dp).translate(0, h / 2 + ROAD.waterY + 1.2, 0);
      g.rotateY(Math.atan2(F.fx, F.fz) + Math.PI / 2);
      g.translate(c.x, 0, c.z);
      bank.push(g);
      // a lamp on the far quay (a bright point: the water streaks it)
      if (rng.chance(0.55)) {
        const lp = roadPoint(sc, dd - dp / 2 - 3, 0).addScaledVector(V3(F.fx, 0, F.fz), s - sc + rng.range(-8, 8));
        lights.push(new THREE.SphereGeometry(0.45, 8, 6).translate(lp.x, ROAD.waterY + 6.5, lp.z));
      }
      // a lit window or two in the shed's face
      if (rng.chance(0.4)) {
        const wp = roadPoint(sc, dd - dp / 2 - 0.2, 0).addScaledVector(V3(F.fx, 0, F.fz), s - sc + rng.range(-w / 3, w / 3));
        dimParts.push(new THREE.PlaneGeometry(1.4, 1.1).rotateY(Math.atan2(F.fx, F.fz) + Math.PI / 2).translate(wp.x, ROAD.waterY + 1.2 + h * 0.55, wp.z));
      }
    }
    const bankMesh = new THREE.Mesh(merge(bank), M.brickFar);
    bankMesh.userData.inkId = allocSkylineId();
    bankMesh.userData.noRay = true;
    group.add(bankMesh);
    const lm = new THREE.Mesh(merge(lights), lit);
    lm.userData.inkId = bankMesh.userData.inkId; lm.userData.noRay = true;
    group.add(lm);
    if (dimParts.length) { const dm = new THREE.Mesh(merge(dimParts), dim); dm.userData.inkId = bankMesh.userData.inkId; dm.userData.noRay = true; group.add(dm); }

    // ---- a freighter moored along the quay near the road's end -------------
    const hull = { s0: 1105, s1: 1185 };
    {
      const L = hull.s1 - hull.s0, B = 11, Hh = ROAD.waterY + 5.2;
      const s = new THREE.Shape();
      // the hull's plan: a pointed bow, a round stern
      s.moveTo(-L / 2, -B / 2 + 1.2);
      s.quadraticCurveTo(-L / 2 - 0.5, 0, -L / 2, B / 2 - 1.2);
      s.quadraticCurveTo(-L / 2 + 1, B / 2, -L / 2 + 4, B / 2);
      s.lineTo(L / 2 - 12, B / 2);
      s.quadraticCurveTo(L / 2 - 2, B / 2 - 1, L / 2 + 2, 0);
      s.quadraticCurveTo(L / 2 - 2, -B / 2 + 1, L / 2 - 12, -B / 2);
      s.lineTo(-L / 2 + 4, -B / 2);
      s.quadraticCurveTo(-L / 2 + 1, -B / 2, -L / 2, -B / 2 + 1.2);
      const depth = Hh - (ROAD.waterY - 1);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 12 });
      g.rotateX(-Math.PI / 2).translate(0, ROAD.waterY - 1, 0);
      const parts = [g];
      // the superstructure aft, a mast and a derrick
      parts.push(roundedBox(10, 5, 8, 0.2, 2).translate(-L / 2 + 10, Hh + 2.5, 0));
      parts.push(roundedBox(7, 3, 6, 0.2, 2).translate(-L / 2 + 10, Hh + 6.3, 0));
      parts.push(lathe([[0, 0], [0.9, 0], [0.8, 5], [0, 5.2]], 16).translate(-L / 2 + 16, Hh + 5, 0));
      for (const x of [-6, 14]) parts.push(new THREE.CylinderGeometry(0.18, 0.28, 16, 10).translate(x, Hh + 8, 0));
      parts.push(new THREE.CylinderGeometry(0.1, 0.12, 14, 8).rotateZ(0.9).translate(19, Hh + 6, 0));
      const mid = (hull.s0 + hull.s1) / 2;
      frameAt(mid, F);
      const c = roadPoint(mid, ROAD.quay + 1.4 + B / 2, 0);
      const mesh = new THREE.Mesh(merge(parts), M.iron);
      mesh.rotation.y = Math.atan2(F.fx, F.fz) - Math.PI / 2;
      mesh.position.set(c.x, 0, c.z);
      tagInk(mesh);
      mesh.castShadow = false; mesh.receiveShadow = true;
      group.add(mesh);
      // portholes and the wheelhouse windows, a few lit
      const holes = [];
      for (let x = -L / 2 + 20; x < L / 2 - 10; x += 3.2) if (rng.chance(0.18)) holes.push(new THREE.CircleGeometry(0.22, 12).rotateY(Math.PI).translate(x, Hh - 1.6, -B / 2 - 0.35));
      for (const x of [-L / 2 + 7, -L / 2 + 9.5, -L / 2 + 12]) holes.push(new THREE.PlaneGeometry(1.1, 0.9).rotateY(Math.PI).translate(x, Hh + 6.4, -3.05));
      const hm = new THREE.Mesh(merge(holes), dim);
      hm.rotation.copy(mesh.rotation); hm.position.copy(mesh.position);
      hm.userData.inkId = mesh.userData.inkId; hm.userData.noRay = true;
      group.add(hm);
      hull.mesh = mesh;
      // mooring lines to bollards on the quay
      const lines = [];
      for (const ds of [-L / 2 + 6, L / 2 - 8]) {
        const a = roadPoint(mid + ds, ROAD.quay - 0.4, ROAD.pave + 0.35);
        const b = roadPoint(mid + ds * 0.9, ROAD.quay + 1.6, Hh - 0.2);
        const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector3().lerpVectors(a, b, u).setY(a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 0.5)); }
        lines.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.03, 5));
        lines.push(lathe([[0, 0], [0.2, 0], [0.16, 0.12], [0.14, 0.35], [0.18, 0.42], [0, 0.45]], 12).translate(a.x, ROAD.pave, a.z));
      }
      const ml = new THREE.Mesh(merge(lines), M.iron);
      tagInk(ml);
      group.add(ml);
    }

    // ---- the city: across the river, and behind the warehouses --------------
    const sk = Object.create(Skyline.prototype);
    Object.assign(sk, { world: stage, windows: [], _az: [], wrng: stage.rng.fork(702), group });
    const trng = stage.rng.fork(703);
    const rings = [
      { d: [420, 520], h: [40, 95], w: [16, 28], gap: [34, 60], side: 1 },
      { d: [620, 760], h: [70, 160], w: [18, 32], gap: [44, 80], side: 1 },
      { d: [-260, -330], h: [40, 90], w: [16, 26], gap: [40, 70], side: -1 },
      { d: [-480, -620], h: [80, 180], w: [20, 34], gap: [50, 90], side: -1 },
    ];
    rings.forEach((R, ri) => {
      const parts = [];
      for (let s = -500; s < ROAD.len + 700; s += trng.range(R.gap[0], R.gap[1])) {
        const sc = Math.max(0, Math.min(ROAD.len, s));
        frameAt(sc, F);
        const p = roadPoint(sc, trng.range(R.d[0], R.d[1]), 0).addScaledVector(V3(F.fx, 0, F.fz), s - sc);
        const h = trng.range(R.h[0], R.h[1]);
        if (trng.chance(0.3)) sk.slabTower(parts, trng, p.x, p.z, h * 0.9, trng.range(R.w[0], R.w[1]) * 1.2);
        else sk.tower(parts, trng, p.x, p.z, h, trng.range(R.w[0], R.w[1]) * 1.2, Math.min(3, ri % 2 + 1), false, 0);
      }
      const ring = ri % 2;
      const mesh = new THREE.Mesh(merge(parts), makeTowerMaterial(U, ROW_TONE[ring + 1], ROW_HAZE[ring + 1]));
      mesh.userData.inkId = allocSkylineId();
      mesh.userData.noRay = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    });
    sk.buildWindows();
    if (sk.windowMesh) sk.windowMesh.userData.noRay = true;

    return {
      group, railD: d, hull, chunks,
      update(camera) {
        const p = camera.position;
        for (const c of chunks) c.mesh.visible = Math.hypot(c.mid.x - p.x, c.mid.z - p.z) < 300;
      },
    };
  },
  update: (r, dt, t, camera) => r.update(camera),
};
