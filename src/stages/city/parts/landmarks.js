import * as THREE from 'three';
import { allocInkId, allocSkylineId, LAYER, tagInk, markFigure } from '../../../render/layers.js';
import { merge, lathe, roundedBox, tube, V3 } from '../../../world/geom.js';
import { makeKit, worldUV } from '../../pier9/kit.js';
import { glowTexture } from '../../../vehicles/models.js';
import { PIER, GASOMETER, WATER_TOWER, CLOCK, CINEMA, ROADWORKS, NS, EW, CANAL, YARD_X, DEPOT_Z, WHARF_X, PAVE, WATER_Y, riverPoint, riverFrame, riverSAtZ, RIVER } from '../plan.js';

// What makes the city a place you can read without a map (lane C3): Pier 9
// at the river road's end (the yard, the shed on the pier with PIER 9 on
// its gable, the gate, the crane, the freighter and its lamps over the
// roofs), the gasworks' gasometer over the canal, the water tower over the
// rail yard, the clock tower at Clock St and Baxter (its four faces lit),
// the Bijou's marquee on Fifth St, the painted signs (DOCKS with a hand
// pointing, PIER 9 on the river road), the roadworks on Baxter (the trench,
// the spoil, the lanterns, a steam roller), the rail yard's wagons beyond
// its fence, the depot's sheds along Dock Rd.
// API: { lights: [{ p, k }] (the river's columns take the freighter's), update(camera) }

// a sign's lettering: white on black enamel (or painted on brick), weathered
function signMap(lines, { w = 512, h = 256, bg = '#080808', fg = 'rgba(232,230,224,1)', font = 'bold', arrow = 0, border = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = fg; g.lineWidth = h * 0.04; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((t, i) => {
    const size = Math.round((h * 0.62) / n);
    g.font = `${font} ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    g.save(); g.scale(0.82, 1); g.fillText(t, (w / 2 - (arrow ? h * 0.3 * arrow : 0)) / 0.82, h * (i + 0.55) / n); g.restore();
  });
  if (arrow) {
    // a pointing arrow at the end
    const ax = arrow > 0 ? w - h * 0.42 : h * 0.42, ay = h / 2, s = h * 0.22;
    g.beginPath(); g.moveTo(ax + s * arrow, ay); g.lineTo(ax - s * 0.2 * arrow, ay - s * 0.9); g.lineTo(ax - s * 0.2 * arrow, ay - s * 0.35); g.lineTo(ax - s * 1.2 * arrow, ay - s * 0.35);
    g.lineTo(ax - s * 1.2 * arrow, ay + s * 0.35); g.lineTo(ax - s * 0.2 * arrow, ay + s * 0.35); g.lineTo(ax - s * 0.2 * arrow, ay + s * 0.9); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + Math.random() * 0.5})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 2.2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export default {
  name: 'landmarks', order: 75,
  *buildSteps(stage) {
    const { scene, M, U } = stage;
    const group = new THREE.Group();
    group.name = 'landmarks';
    scene.add(group);
    const kit = makeKit(stage, group);
    const K = kit.M;
    const lights = [];
    const lit = (v) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(v) });
    const add = (geo, mat, { noRay = false, figure = false, id = null } = {}) => {
      const m = new THREE.Mesh(geo, mat);
      m.userData.inkId = id ?? kit.id;
      if (noRay) m.userData.noRay = true;
      if (figure) m.userData.inkFigure = true;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };
    const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    // a sign: a plane facing (nx, nz) at (x, y, z)
    const sign = (x, y, z, nx, nz, w, h, map, { glow = 0.0, id = null } = {}) => {
      const mat = new THREE.MeshBasicMaterial({ map, color: new THREE.Color().setScalar(glow || 0.42) });
      const g = new THREE.PlaneGeometry(w, h).rotateY(Math.atan2(nx, nz)).translate(x + nx * 0.06, y, z + nz * 0.06);
      return add(g, mat, { noRay: true, id });
    };

    // ---- Pier 9 ------------------------------------------------------------------------
    {
      kit.piece();
      const S = PIER.shed, Y = PIER.yard;
      const H = 7.2, ridge = 10.6;
      // the shed on the pier: board walls, a pitched roof running east, the
      // big doors shut in the west gable, the gate in the yard's fence
      const walls = [];
      walls.push(worldUV(box(S.x0, S.x1, 0, H, S.z0, S.z0 + 0.3), 1.6), worldUV(box(S.x0, S.x1, 0, H, S.z1 - 0.3, S.z1), 1.6));
      walls.push(worldUV(box(S.x1 - 0.3, S.x1, 0, H, S.z0, S.z1), 1.6));
      // the west gable: the wall with the doors' opening, and its triangle
      const gx = S.x0;
      walls.push(worldUV(box(gx, gx + 0.3, 0, H, S.z0, PIER.gate.z - 4.5), 1.6), worldUV(box(gx, gx + 0.3, 0, H, PIER.gate.z + 4.5, S.z1), 1.6));
      walls.push(worldUV(box(gx, gx + 0.3, 5.6, H, PIER.gate.z - 4.5, PIER.gate.z + 4.5), 1.6));
      const tri = new THREE.Shape();
      tri.moveTo(S.z0, H); tri.lineTo(S.z1, H); tri.lineTo((S.z0 + S.z1) / 2, ridge); tri.closePath();
      const gable = new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false });
      gable.rotateY(-Math.PI / 2); gable.translate(gx + 0.3, 0, 0);
      walls.push(worldUV(gable, 1.6));
      kit.addMerged(walls, K.wallOut, { cast: true });
      // the roof
      const rw = (S.z1 - S.z0) / 2 + 0.6, rh = ridge - H;
      const rl = Math.hypot(rw, rh), ra = Math.atan2(rh, rw);
      const roof = [];
      for (const sg of [-1, 1]) roof.push(new THREE.BoxGeometry(S.x1 - S.x0 + 1, 0.12, rl).rotateX(sg * ra).translate((S.x0 + S.x1) / 2, H + rh / 2, (S.z0 + S.z1) / 2 + sg * rw / 2));
      kit.addMerged(roof, K.roof, { cast: true });
      // the big doors (shut), their iron straps
      kit.piece();
      const doors = [];
      for (const z of [PIER.gate.z - 2.25, PIER.gate.z + 2.25]) doors.push(worldUV(box(gx - 0.12, gx + 0.05, 0, 5.6, z - 2.2, z + 2.2), 1.6));
      kit.addMerged(doors, K.plankDoor, { cast: true });
      kit.addMerged([box(gx - 0.16, gx - 0.1, 1.2, 1.35, PIER.gate.z - 4.4, PIER.gate.z + 4.4), box(gx - 0.16, gx - 0.1, 4.2, 4.35, PIER.gate.z - 4.4, PIER.gate.z + 4.4)], K.iron);
      // PIER 9 on the gable, tall, white on the boards
      kit.piece();
      const lm = signMap(['PIER 9'], { w: 1024, h: 256, bg: 'rgba(0,0,0,0)', border: false });
      const lmat = new THREE.MeshBasicMaterial({ map: lm, transparent: true, color: new THREE.Color().setScalar(0.62), depthWrite: false });
      add(new THREE.PlaneGeometry(13, 3.2).rotateY(-Math.PI / 2).translate(gx - 0.03, 8.6, (S.z0 + S.z1) / 2), lmat, { noRay: true });
      // the yard's fence (iron railings, its gate shut and chained): the
      // shed's gable is the gate's frame
      kit.piece();
      const rail = [];
      for (let z = Y.z0; z < PIER.gate.z - 4.6; z += 0.25) rail.push(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 5).translate(gx - 0.5, 1.1, z));
      for (const y of [0.2, 2.0]) rail.push(new THREE.BoxGeometry(0.05, 0.05, PIER.gate.z - 4.6 - Y.z0).translate(gx - 0.5, y, (Y.z0 + PIER.gate.z - 4.6) / 2));
      kit.addMerged(rail, K.iron);
      // the crane on the pier: a lattice tower and its jib over the water,
      // work lamps on it
      kit.piece();
      const cr = [];
      const cx = PIER.crane.x, cz = PIER.crane.z, ch = 22;
      for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) cr.push(new THREE.CylinderGeometry(0.12, 0.16, ch, 6).translate(cx + dx, ch / 2, cz + dz));
      for (let y = 2; y < ch; y += 2.6) for (const [a, b] of [[[-1.6, -1.6], [1.6, 1.6]], [[1.6, -1.6], [-1.6, 1.6]]]) cr.push(tube([V3(cx + a[0], y, cz + a[1]), V3(cx + b[0], y + 2.6, cz + b[1])], 0.05, 4, 1));
      cr.push(roundedBox(5, 3, 4, 0.2, 2).translate(cx, ch + 1.5, cz));
      cr.push(tube([V3(cx, ch + 2, cz), V3(cx + 26, ch + 9, cz + 8)], 0.35, 6, 1));
      cr.push(tube([V3(cx, ch + 3, cz), V3(cx - 8, ch + 5, cz - 2)], 0.3, 6, 1));
      cr.push(new THREE.CylinderGeometry(0.03, 0.03, ch + 6, 4).translate(cx + 24, (ch + 8) / 2, cz + 7.4));
      add(merge(cr), M.iron, { figure: true });
      // the freighter along the pier's south face: a black hull, its
      // superstructure, two masts, lit portholes and deck lamps
      kit.piece();
      const F = PIER.freighter, L = F.x1 - F.x0, B = F.beam, Hh = WATER_Y + 6.5;
      const s = new THREE.Shape();
      s.moveTo(-L / 2, -B / 2 + 1.2); s.quadraticCurveTo(-L / 2 - 0.5, 0, -L / 2, B / 2 - 1.2); s.quadraticCurveTo(-L / 2 + 1, B / 2, -L / 2 + 4, B / 2);
      s.lineTo(L / 2 - 12, B / 2); s.quadraticCurveTo(L / 2 - 2, B / 2 - 1, L / 2 + 2, 0); s.quadraticCurveTo(L / 2 - 2, -B / 2 + 1, L / 2 - 12, -B / 2); s.lineTo(-L / 2 + 4, -B / 2); s.quadraticCurveTo(-L / 2 + 1, -B / 2, -L / 2, -B / 2 + 1.2);
      const depth = Hh - (WATER_Y - 1);
      const hull = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 12 });
      hull.rotateX(-Math.PI / 2).translate(0, WATER_Y - 1, 0);
      const fp = [hull, roundedBox(12, 5, 9, 0.2, 2).translate(-L / 2 + 13, Hh + 2.5, 0), roundedBox(8, 3, 7, 0.2, 2).translate(-L / 2 + 13, Hh + 6.5, 0),
        lathe([[0, 0], [1.0, 0], [0.9, 6], [0, 6.2]], 16).translate(-L / 2 + 20, Hh + 5, 0)];
      for (const x of [-10, 22]) fp.push(new THREE.CylinderGeometry(0.2, 0.3, 18, 8).translate(x, Hh + 9, 0));
      yield;
      const fm = add(merge(fp), M.iron);
      fm.position.set((F.x0 + F.x1) / 2, 0, F.z);
      const holes = [], fl = [];
      const rr = stage.rng.fork(771);
      for (let x = -L / 2 + 22; x < L / 2 - 10; x += 3.2) if (rr.chance(0.3)) holes.push(new THREE.CircleGeometry(0.24, 12).rotateY(Math.PI).translate(x, Hh - 1.8, -B / 2 - 0.36));
      for (const x of [-L / 2 + 9, -L / 2 + 11.5, -L / 2 + 14]) holes.push(new THREE.PlaneGeometry(1.1, 0.9).rotateY(Math.PI).translate(x, Hh + 6.5, -3.55));
      // its lamps: a cluster aft, one at each mast, along the rail
      for (const [x, y] of [[-L / 2 + 13, Hh + 9.5], [-10, Hh + 17.5], [22, Hh + 17.5], [-L / 2 + 30, Hh + 1.2], [5, Hh + 1.2], [30, Hh + 1.2]]) {
        fl.push(new THREE.SphereGeometry(0.28, 8, 6).translate(x, y, -B / 2 + 0.6));
        lights.push({ p: V3((F.x0 + F.x1) / 2 + x, y, F.z - B / 2 + 0.6), k: 1.4, w: 0.7 });
      }
      const hm = add(merge(holes), lit(1.2), { noRay: true }); hm.position.copy(fm.position);
      const lfm = add(merge(fl), lit(6), { noRay: true }); lfm.position.copy(fm.position);
      // (their halos in the rain: seen over the shed's roof from up the road)
      const haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(1.1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      for (const l of lights) { const sp = new THREE.Sprite(haloMat); sp.position.copy(l.p); sp.scale.setScalar(3.2); sp.layers.set(LAYER.FX_REFL); sp.renderOrder = 6; sp.userData.noRay = true; group.add(sp); }
      // the crane's work lamps
      for (const p of [V3(cx, ch + 3.2, cz - 2.1), V3(cx + 26, ch + 8.6, cz + 8)]) { const sp = new THREE.Sprite(haloMat); sp.position.copy(p); sp.scale.setScalar(2.4); sp.layers.set(LAYER.FX_REFL); sp.userData.noRay = true; group.add(sp); lights.push({ p, k: 1.2, w: 0.6 }); }
      // the pier's deck under the shed and its apron, on piles in the water
      kit.piece();
      const deck = [box(S.x0 - 0.2, S.x1 + 3, WATER_Y - 0.6, PAVE, S.z0 - 3, PIER.yard.z1 + 4)];
      for (let x = S.x0 + 2; x < S.x1 + 3; x += 4) for (const z of [S.z0 - 2.5, PIER.yard.z1 + 3.5]) deck.push(new THREE.CylinderGeometry(0.22, 0.22, 3, 8).translate(x, WATER_Y, z));
      kit.addMerged(deck, K.timber);
      // the yard's ground: the cobbles (the street's own wet stone covers it)
      // a bollard row along the water, a cable drum, crates by the gate
      kit.piece();
      const yd = [];
      for (let x = Y.x0 + 4; x < Y.x1 - 2; x += 4) yd.push(lathe([[0, 0], [0.2, 0], [0.16, 0.12], [0.14, 0.4], [0.19, 0.48], [0, 0.52]], 12).translate(x, PAVE, Y.z1 - 0.6));
      // [2nd owner] the cable drum: two planked flanges, the cable wound
      // between them in turns, an iron hub, the cable's end run out over
      // the stones (it read as one flat grey disc by the rail, in the
      // chapter's last frame); the crates battened and cornered
      const dx = gx - 6, dy = 0.9, dz = PIER.gate.z + 7.5;
      const ir = [];
      for (const sz of [-1, 1]) {
        yd.push(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 22).rotateX(Math.PI / 2).translate(dx, dy, dz + sz * 0.58));
        for (const yy of [-0.42, 0, 0.42]) yd.push(new THREE.BoxGeometry(Math.sqrt(Math.max(0.05, 0.81 - yy * yy)) * 2 - 0.08, 0.035, 0.03).translate(dx, dy + yy, dz + sz * 0.635));
        ir.push(new THREE.TorusGeometry(0.2, 0.05, 6, 14).translate(dx, dy, dz + sz * 0.64));
        ir.push(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10).rotateX(Math.PI / 2).translate(dx, dy, dz + sz * 0.64));
      }
      ir.push(new THREE.CylinderGeometry(0.64, 0.64, 1.08, 22).rotateX(Math.PI / 2).translate(dx, dy, dz));
      for (let k = 0; k < 6; k++) ir.push(new THREE.TorusGeometry(0.645, 0.032, 5, 26).translate(dx, dy, dz - 0.45 + k * 0.18));
      ir.push(tube([V3(dx + 0.15, dy + 0.62, dz + 0.3), V3(dx + 0.7, dy + 0.45, dz + 0.4), V3(dx + 1.2, 0.06, dz + 0.5), V3(dx + 2.4, 0.04, dz + 0.1), V3(dx + 3.3, 0.04, dz - 0.6)], 0.032, 6, 24));
      for (let k = 0; k < 4; k++) {
        const cx0 = gx - 3 - (k % 2) * 1.2, cy0 = 0.5 + Math.floor(k / 2) * 1.0, cz0 = PIER.gate.z - 6 - (k % 2) * 0.3;
        yd.push(roundedBox(1.1, 1.0, 1.1, 0.04, 1).translate(cx0, cy0, cz0));
        for (const yy of [-0.38, 0.38]) yd.push(new THREE.BoxGeometry(1.15, 0.12, 1.15).translate(cx0, cy0 + yy, cz0));
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) yd.push(new THREE.BoxGeometry(0.11, 0.98, 0.11).translate(cx0 + sx * 0.53, cy0, cz0 + sz * 0.53));
      }
      kit.addMerged(yd, K.timber);
      kit.addMerged(ir, K.iron);
    }

    yield;
    // ---- the gasworks over the canal: the gasometer, its frame ------------------------------
    {
      const G = GASOMETER, parts = [];
      parts.push(new THREE.CylinderGeometry(G.r, G.r, G.h * 0.8, 40, 1, false).translate(G.x, G.h * 0.4, G.z));
      parts.push(new THREE.SphereGeometry(G.r, 40, 8, 0, Math.PI * 2, 0, 0.3).translate(G.x, G.h * 0.8 - G.r * Math.cos(0.3) + 0.2, G.z));
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; parts.push(new THREE.CylinderGeometry(0.35, 0.45, G.h + 4, 6).translate(G.x + Math.cos(a) * (G.r + 1.5), (G.h + 4) / 2, G.z + Math.sin(a) * (G.r + 1.5))); }
      for (const y of [G.h * 0.35, G.h * 0.7, G.h + 3.5]) parts.push(new THREE.TorusGeometry(G.r + 1.5, 0.25, 4, 48).rotateX(Math.PI / 2).translate(G.x, y, G.z));
      const m = add(merge(parts), M.tower || M.iron, { noRay: true, id: allocSkylineId() });
      void m;
    }
    yield;
    // ---- the water tower over the rail yard -------------------------------------------------
    {
      const W = WATER_TOWER, parts = [];
      const th = 18;
      for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) parts.push(new THREE.CylinderGeometry(0.18, 0.25, th, 6).translate(W.x + dx, th / 2, W.z + dz));
      for (let y = 3; y < th; y += 4) parts.push(new THREE.TorusGeometry(3.4, 0.08, 4, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4).translate(W.x, y, W.z));
      parts.push(lathe([[0, 0], [3.6, 0], [3.6, 5.5], [3.0, 6.4], [0.4, 7.4], [0, 7.5]], 24).translate(W.x, th, W.z));
      add(merge(parts), M.iron, { noRay: true, id: allocSkylineId() });
    }
    yield;
    // ---- the clock tower at Clock St and Baxter: four lit faces ---------------------------------
    {
      kit.piece();
      const C = CLOCK, w = 6.4, parts = [];
      parts.push(box(C.x - w / 2, C.x + w / 2, 0, C.h, C.z - w / 2, C.z + w / 2));
      parts.push(box(C.x - w / 2 - 0.4, C.x + w / 2 + 0.4, C.h, C.h + 0.6, C.z - w / 2 - 0.4, C.z + w / 2 + 0.4));
      parts.push(new THREE.ConeGeometry(w * 0.62, 7, 4).rotateY(Math.PI / 4).translate(C.x, C.h + 4.1, C.z));
      add(merge(parts), M.brickFar);
      const face = new THREE.CanvasTexture(clockFace());
      face.colorSpace = THREE.SRGBColorSpace;
      const fmat = new THREE.MeshBasicMaterial({ map: face, color: new THREE.Color().setScalar(1.25) });
      const fy = C.h - 4.2;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(new THREE.CircleGeometry(2.3, 40).rotateY(Math.atan2(nx, nz)).translate(C.x + nx * (w / 2 + 0.03), fy, C.z + nz * (w / 2 + 0.03)), fmat, { noRay: true });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      sp.position.set(C.x, fy, C.z); sp.scale.setScalar(12); sp.layers.set(LAYER.FX_REFL); sp.userData.noRay = true; group.add(sp);
    }
    yield;
    // ---- the Bijou's marquee over Fifth St ------------------------------------------------
    {
      kit.piece();
      const C = CINEMA, parts = [], bulbs = [];
      const z0 = C.z, y0 = 3.6;
      parts.push(box(C.x - C.w / 2, C.x + C.w / 2, y0, y0 + 1.6, z0, z0 + 3.2));
      // the upright sign
      parts.push(box(C.x - 0.6, C.x + 0.6, y0 + 1.6, y0 + 11, z0 + 0.1, z0 + 0.6));
      add(merge(parts), M.black);
      for (let x = C.x - C.w / 2 + 0.3; x < C.x + C.w / 2; x += 0.5) for (const z of [z0 + 3.22]) { bulbs.push(new THREE.SphereGeometry(0.07, 6, 4).translate(x, y0 + 0.1, z), new THREE.SphereGeometry(0.07, 6, 4).translate(x, y0 + 1.5, z)); }
      for (let y = y0 + 2; y < y0 + 11; y += 0.5) for (const x of [C.x - 0.62, C.x + 0.62]) bulbs.push(new THREE.SphereGeometry(0.07, 6, 4).translate(x, y, z0 + 0.35));
      add(merge(bulbs), lit(5), { noRay: true });
      const bijou = signMap(['B I J O U'], { w: 256, h: 1024, bg: '#060606', border: false });
      // (the upright's letters, one above another: the map drawn tall)
      const vt = signMapVertical('BIJOU');
      sign(C.x, y0 + 6.3, z0 + 0.62, 0, 1, 1.0, 8.6, vt, { glow: 1.4 });
      const board = signMap(['TONIGHT', 'THE MALTESE FALCON'], { w: 1024, h: 160, bg: '#0b0b0b', border: false });
      sign(C.x, y0 + 0.8, z0 + 3.22, 0, 1, C.w - 1, 1.2, board, { glow: 1.6 });
      void bijou;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color().setScalar(0.45), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      sp.position.set(C.x, y0 + 1, z0 + 3.6); sp.scale.set(26, 8, 1); sp.layers.set(LAYER.FX_REFL); sp.userData.noRay = true; group.add(sp);
    }
    yield;
    // ---- the signs: DOCKS and a hand, at the corners where the way to the
    // river turns; PIER 9 on the river road -----------------------------------------------
    {
      kit.piece();
      const docksR = signMap(['DOCKS'], { arrow: 1 }), docksL = signMap(['DOCKS'], { arrow: -1 });
      const pier = signMap(['PIER 9'], { arrow: 1 });
      // (on a building's corner, high on the brick: x, z, the face's normal,
      // which way the arrow points)
      const at = [
        // Pell Lane's end: east along Harbor St
        [NS.cooper.x - NS.cooper.hw - NS.cooper.p - 0.02, EW.harbor.z - EW.harbor.hw - EW.harbor.p - 3, -1, 0, docksL],
        // the avenue at Market St, at Clock St, at Harbor St: east
        [NS.avenue.x + NS.avenue.hw + NS.avenue.p + 0.02, EW.market.z + EW.market.hw + EW.market.p + 3, 1, 0, docksR],
        [NS.avenue.x + NS.avenue.hw + NS.avenue.p + 0.02, EW.clock.z + EW.clock.hw + EW.clock.p + 3, 1, 0, docksR],
        // Baxter at Canal St: south then east
        [NS.baxter.x - NS.baxter.hw - NS.baxter.p - 0.02, EW.canal.z + EW.canal.hw + EW.canal.p + 3, -1, 0, docksL],
        // Water St at Market and at Clock: east
        [NS.water.x + NS.water.hw + NS.water.p + 0.02, EW.market.z - EW.market.hw - EW.market.p - 3, 1, 0, docksR],
        [NS.water.x + NS.water.hw + NS.water.p + 0.02, EW.clock.z - EW.clock.hw - EW.clock.p - 3, 1, 0, docksR],
      ];
      for (const [x, z, nx, nz, map] of at) sign(x, 4.2, z, nx, nz, 2.4, 1.2, map, { glow: 0.55 });
      // PIER 9 on enamel at the river road's junctions, on the quay's posts
      for (const zz of [EW.canal.z + 16, EW.market.z + 16, EW.harbor.z + 30, EW.dock.z - 10]) {
        const s0 = riverSAtZ(zz), f = riverFrame(s0, {});
        const p = riverPoint(s0, -(RIVER.hw + 1.2));
        const pole = new THREE.CylinderGeometry(0.05, 0.06, 2.6, 6).translate(p.x, PAVE + 1.3, p.z);
        add(pole, M.lampIron);
        // (facing up the road, toward the driver coming south)
        sign(p.x, PAVE + 2.6, p.z, -f.fx, -f.fz, 1.6, 0.8, pier, { glow: 0.6 });
      }
    }
    yield;
    // ---- the roadworks on Baxter (between Fifth St and Dock Rd) -------------------------
    {
      kit.piece();
      const R = ROADWORKS, x = NS.baxter.x, hw = NS.baxter.hw, parts = [], dark = [];
      // the trench (black) between the spoil heaps, planks across it
      dark.push(box(x - hw + 0.4, x + hw - 0.4, -0.02, 0.02, R.z0 + 4, R.z1 - 4));
      for (const sx of [-1, 1]) {
        const heap = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.8, 1.4, (R.z1 - R.z0) / 2 - 5).translate(x + sx * (hw - 1.4), 0, (R.z0 + R.z1) / 2);
        parts.push(heap);
      }
      for (let z = R.z0 + 8; z < R.z1 - 6; z += 9) parts.push(box(x - hw + 1, x + hw - 1, 0.02, 0.1, z, z + 0.3));
      add(merge(parts), K.timber);
      add(merge(dark), M.black, { noRay: true });
      // a steam roller standing in it
      const sr = [roundedBox(3.4, 1.8, 1.9, 0.2, 2).translate(0, 1.6, 0), new THREE.CylinderGeometry(0.9, 0.9, 1.9, 24).rotateX(Math.PI / 2).translate(2.0, 0.9, 0),
        new THREE.CylinderGeometry(1.1, 1.1, 0.4, 24).rotateX(Math.PI / 2).translate(-1.2, 1.1, 1.1), new THREE.CylinderGeometry(1.1, 1.1, 0.4, 24).rotateX(Math.PI / 2).translate(-1.2, 1.1, -1.1),
        new THREE.CylinderGeometry(0.18, 0.18, 2.0, 10).translate(1.2, 3.4, 0), roundedBox(2.4, 0.1, 2.2, 0.03, 1).translate(-0.8, 3.3, 0)];
      const srm = add(merge(sr), M.iron, { figure: true });
      srm.position.set(x + 1.2, 0, (R.z0 + R.z1) / 2);
      srm.rotation.y = Math.PI / 2;
      // the night watchman's lanterns on the sawhorses (white: the crew's red
      // is theirs alone)
      const lan = [], lanLit = [];
      for (const z of [R.z0, R.z1]) for (const dx of [-3.3, 3.3]) {
        lan.push(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8).translate(x + dx, 1.15, z));
        lanLit.push(new THREE.SphereGeometry(0.07, 8, 6).translate(x + dx, 1.17, z));
        lights.push({ p: V3(x + dx, 1.2, z), k: 0.6, w: 0.3 });
      }
      add(merge(lan), M.lampIron);
      add(merge(lanLit), lit(5), { noRay: true });
    }
    yield;
    // ---- beyond the edges: the rail yard's wagons, the depot's sheds, the
    // gasworks' sheds over the canal (flat dark masses) --------------------------------
    {
      kit.piece();
      const P = [];
      const rr = stage.rng.fork(781);
      // the yard fence (an iron railing on a low wall) along Yard Rd's west side
      P.push(box(YARD_X - 1.0, YARD_X - 0.6, 0, 0.7, -262, 142));
      const fence = [];
      for (let z = -262; z < 142; z += 0.3) fence.push(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 4).translate(YARD_X - 0.8, 1.5, z));
      fence.push(box(YARD_X - 0.84, YARD_X - 0.76, 2.2, 2.26, -262, 142));
      add(merge(fence), M.lampIron, { noRay: true });
      // wagons on the yard's tracks, in rows
      for (const x of [-272, -284, -296, -312]) for (let z = -250; z < 130; z += rr.range(11, 16)) if (rr.chance(0.7)) P.push(roundedBox(2.8, 3.1, rr.range(9, 12), 0.12, 1).translate(x, 2.0, z));
      // the depot's sheds along Dock Rd's south side
      for (let x = -255; x < WHARF_X - 10; x += rr.range(30, 44)) P.push(box(x, x + rr.range(26, 40), 0, rr.range(7, 10), DEPOT_Z, DEPOT_Z + 28));
      // the gasworks' sheds and chimneys over the canal
      for (let x = -240; x < 100; x += rr.range(30, 50)) P.push(box(x, x + rr.range(18, 30), 0, rr.range(6, 12), CANAL.z1 - 30, CANAL.z1 - 6));
      for (const x of [-150, -60, 40]) P.push(new THREE.CylinderGeometry(1.2, 1.6, 30, 10).translate(x, 15, CANAL.z1 - 20));
      add(merge(P), M.brickFar, { noRay: true });
    }

    const api = {
      group, lights,
      update() {},
    };
    return api;
  },
  // (built whole, or a step at a time when the stage is warmed: Stages.warm)
  build(stage) { const it = this.buildSteps(stage); let r; while (!(r = it.next()).done); return r.value; },
};

// the clock's face: the hours, the hands at ten to midnight
function clockFace() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d6d0'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#111'; g.lineWidth = 10; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, 7); g.stroke();
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.lineWidth = k % 3 ? 5 : 10; g.beginPath(); g.moveTo(S / 2 + Math.sin(a) * S * 0.36, S / 2 - Math.cos(a) * S * 0.36); g.lineTo(S / 2 + Math.sin(a) * S * 0.44, S / 2 - Math.cos(a) * S * 0.44); g.stroke(); }
  const hand = (a, len, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + Math.sin(a) * len, S / 2 - Math.cos(a) * len); g.stroke(); };
  hand((11.83 / 12) * Math.PI * 2, S * 0.24, 12);
  hand((50 / 60) * Math.PI * 2, S * 0.36, 7);
  return c;
}
// letters one above another (an upright cinema sign)
function signMapVertical(text) {
  const w = 128, h = 1024, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#efeee8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${Math.round(h / text.length * 0.7)}px "Arial Narrow", Arial, sans-serif`;
  [...text].forEach((ch, i) => g.fillText(ch, w / 2, h * (i + 0.5) / text.length));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
void allocInkId; void tagInk; void markFigure;
