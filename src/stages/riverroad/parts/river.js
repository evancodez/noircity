import * as THREE from 'three';
import { tagInk, allocInkId, allocSkylineId, markFigure } from '../../../render/layers.js';
import { merge, sweep, lathe, roundedBox, V3 } from '../../../world/geom.js';
import { Skyline, makeTowerMaterial } from '../../../world/Skyline.js';
import { ROAD, roadPoint, frameAt } from '../road.js';

// The river side: the cast-iron railing on the quay (the car's right wall,
// the rail a man is bent back over), the far bank's low sheds and its
// lights (they come down the black water in long streaks), a freighter
// moored along the quay before the close, and the city across the river
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

    // ---- the far bank (R2): a low broken line of sheds, warehouses and a
    // few tall blocks on the far quay, 150 .. 200 m off, lost in the fog but
    // for their lights - the quay's lamps at odd spacings, lit windows in
    // twos and threes on the taller blocks, a light high on a stack. The
    // river carries each of them (the water's columns: `far`).
    // (it was a row of like sheds 230 m off with a lamp on each: in the fog
    // a flat grey band under a row of cut-out towers, its lamps sub-pixel)
    const bank = [], lights = [], wins = [], far = [];
    const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(3.4) });
    const dim = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(1.25) });
    const FARQ = 158;
    const faceYaw = () => Math.atan2(F.fx, F.fz) + Math.PI / 2;
    for (let s = -300; s < ROAD.len + 400; s += rng.range(12, 46)) {
      const sc = Math.max(0, Math.min(ROAD.len, s));
      frameAt(sc, F);
      const along = s - sc;
      // mostly low sheds; now and then a warehouse block, rarely a tall one
      const kind = rng.next();
      const h = kind < 0.62 ? rng.range(4, 10) : kind < 0.92 ? rng.range(12, 22) : rng.range(28, 46);
      const w = kind < 0.62 ? rng.range(14, 40) : rng.range(12, 26), dp = rng.range(10, 24);
      const dd = FARQ + dp / 2 + rng.range(1, kind < 0.62 ? 6 : 26);
      const c = roadPoint(sc, dd, 0).addScaledVector(V3(F.fx, 0, F.fz), along);
      const y0 = ROAD.waterY + 1.4;
      const g = new THREE.BoxGeometry(w, h, dp).translate(0, h / 2 + y0, 0);
      g.rotateY(faceYaw());
      g.translate(c.x, 0, c.z);
      bank.push(g);
      // a stack on a works now and then, a lamp at its top
      if (kind > 0.8 && rng.chance(0.35)) {
        const sh = h + rng.range(14, 26);
        const sp = roadPoint(sc, dd + rng.range(-3, 3), 0).addScaledVector(V3(F.fx, 0, F.fz), along + rng.range(-w / 3, w / 3));
        bank.push(new THREE.CylinderGeometry(0.9, 1.4, sh, 8).translate(sp.x, y0 + sh / 2, sp.z));
        lights.push(new THREE.SphereGeometry(0.5, 8, 6).translate(sp.x, y0 + sh + 0.6, sp.z));
        far.push({ p: V3(sp.x, y0 + sh + 0.6, sp.z), k: 0.9, w: 0.8 });
      }
      // lit windows on the face toward me: in twos and threes on a floor or
      // up a corner, on a block more than a shed
      const nWin = kind < 0.62 ? (rng.chance(0.25) ? 1 : 0) : rng.int(1, kind > 0.92 ? 6 : 4);
      for (let i = 0; i < nWin; i++) {
        const floors = Math.max(1, Math.floor((h - 2) / 3.4));
        const f = rng.int(0, floors - 1), x0 = rng.range(-w / 2 + 2, w / 2 - 2);
        const run = rng.int(1, 3), up = rng.chance(0.35);
        for (let j = 0; j < run; j++) {
          const wp = roadPoint(sc, dd - dp / 2 - 0.25, 0).addScaledVector(V3(F.fx, 0, F.fz), along + x0 + (up ? 0 : j * 2.6));
          const wy = y0 + 2.2 + (f + (up ? j : 0)) * 3.4;
          if (wy > y0 + h - 1) break;
          wins.push(new THREE.PlaneGeometry(1.3, 1.7).rotateY(faceYaw()).translate(wp.x, wy, wp.z));
          if (j === 0 && rng.chance(0.5)) far.push({ p: V3(wp.x, wy, wp.z), k: 0.3, w: 1.1 });
        }
      }
    }
    // the far quay's lamps: at odd spacings along its edge, some in pairs
    for (let s = -200; s < ROAD.len + 300; s += rng.range(22, 90)) {
      const sc = Math.max(0, Math.min(ROAD.len, s));
      frameAt(sc, F);
      for (let j = 0, n = rng.chance(0.25) ? 2 : 1; j < n; j++) {
        const lp = roadPoint(sc, FARQ - rng.range(0.5, 2), 0).addScaledVector(V3(F.fx, 0, F.fz), s - sc + j * 9);
        const ly = ROAD.waterY + 1.4 + rng.range(5, 7);
        lights.push(new THREE.SphereGeometry(0.55, 8, 6).translate(lp.x, ly, lp.z));
        far.push({ p: V3(lp.x, ly, lp.z), k: rng.range(0.7, 1.6), w: 0.8 });
      }
    }
    const bankMesh = new THREE.Mesh(merge(bank), M.brickFar);
    bankMesh.userData.inkId = allocSkylineId();
    bankMesh.userData.noRay = true;
    group.add(bankMesh);
    const lm = new THREE.Mesh(merge(lights), lit);
    lm.userData.inkId = bankMesh.userData.inkId; lm.userData.noRay = true;
    group.add(lm);
    if (wins.length) { const dm = new THREE.Mesh(merge(wins), dim); dm.userData.inkId = bankMesh.userData.inkId; dm.userData.noRay = true; group.add(dm); }

    // ---- a freighter moored along the quay (before the close) -------------
    const hull = { s0: ROAD.marks.hull, s1: ROAD.marks.hull + 80 };
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
    // [R2] across the river the towers stand in clusters with open sky
    // between, at depths that overlap (a tower's density along the road
    // swells and dies away): seen from the rail they were a row of like
    // cut-outs at one spacing on one line
    const rings = [
      { d: [360, 560], h: [34, 100], w: [14, 28], gap: [18, 52], side: 1, cl: 0.0 },
      { d: [600, 820], h: [60, 180], w: [18, 32], gap: [22, 60], side: 1, cl: 2.1 },
      { d: [-260, -330], h: [40, 90], w: [16, 26], gap: [40, 70], side: -1 },
      { d: [-480, -620], h: [80, 180], w: [20, 34], gap: [50, 90], side: -1 },
    ];
    const cluster = (s, ph) => { const u = 0.5 + 0.5 * Math.sin(s / 190 + ph) * Math.cos(s / 470 + ph * 0.7); return 0.12 + 0.88 * u * u; };
    rings.forEach((R, ri) => {
      const parts = [];
      for (let s = -500; s < ROAD.len + 700; s += trng.range(R.gap[0], R.gap[1])) {
        if (R.side > 0 && trng.next() > cluster(s, R.cl)) continue;
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

    // ---- the lights the river carries (R2): the quay's own lamps near the eye
    // (the bent one too, wherever it swings) and the far bank's
    const cand = [];
    const res = { x: 1, y: 1 };
    return {
      group, railD: d, hull, chunks, far,
      update(camera, pixelHeight) {
        const p = camera.position;
        for (const c of chunks) c.mesh.visible = Math.hypot(c.mid.x - p.x, c.mid.z - p.z) < 300;
        const water = stage.street && stage.street.water;
        if (!water || !water.material.setLights || !water.visible) return;
        cand.length = 0;
        const L = stage.lamps;
        if (L && L.posts) for (const l of L.posts) {
          if (l.dead || Math.abs(l.head.x - p.x) + Math.abs(l.head.z - p.z) > 320) continue;
          cand.push({ p: l.head, k: 3.2, w: 0.55 });
        }
        for (const f of far) cand.push(f);
        res.y = pixelHeight || 900; res.x = res.y * camera.aspect;
        water.material.setLights(cand, camera, res);
      },
    };
  },
  update: (r, dt, t, camera, ph) => r.update(camera, ph),
};
