import * as THREE from 'three';
import { tagInk, allocIronId, allocInkId, markFigure } from '../../../render/layers.js';
import { merge, sweep, V3, tube, roundedBox, lathe } from '../../../world/geom.js';
import { Overpass, OVERPASS } from '../../../world/Overpass.js';
import { buildTruck, TRUCK as TRUCK_M } from '../../../vehicles/models.js';
import { Steam } from '../../../fx/Steam.js';
import { arch } from '../arch.js';
import { AVENUE, BALLEY, PRESS, HARBOR, FLOOR, CUT } from '../plan.js';

// [C6 2nd] The avenue under the el (chapter V, the stretch `el`): north -
// south east of the press hall, across Harbor Street's east end, up for
// works at both ends (build.js's hoardings). The el down it over its west
// lane (the block's iron, world/Overpass.js: its column lathe and arched
// plates, the city's way of laying them along a line - stages/city/parts/
// el.js - on a straight line here): its columns at the west kerb and in the
// road, the deck at 9.5 m, lamps hung under it; the train is train.js's on
// this line. The press hall's dock opens onto its west pavement (the
// newspaper van backed up to it); the alley behind the press hall leaves it
// west (the news-stand at its corner, the steam pipe across it: things.js).
//   api.line          { at(s, F), len }: s from the south end, F { x, z, fx, fz, nx, nz }
//   api.sAtZ(z)       the line's s at z
//   api.van           the van at the dock
//   api.update(cam)   the el's levels of detail
const O = OVERPASS;
const FAR = 70, SHOW = 300;
const Z_SOUTH = 90, Z_NORTH = -230;
// the column pairs along the line (z): a longer span over Harbor Street, none
// in front of the press hall's dock or across the alley's mouth
const STATIONS = [79.5, 66.0, 54.5, 43.0, 31.5, 20.0, 8.5, -8.5, -20.0, -31.5, -43.0, -54.5, -64.5, -74.2, -85.6, -97.0, -108.6, -120.1, -131.6, -143.1, -154.6, -166.1, -177.6, -189.1, -200.6, -212.1, -223.6];

export default {
  name: 'avenue', order: 66, tick: 66,
  build(stage) {
    const { scene, M } = stage;
    const A = arch(stage, 6666);
    const { MAT, K, face, fbox } = A;
    const api = {};
    // ---- the line -------------------------------------------------------------------------------
    const line = {
      len: Z_SOUTH - Z_NORTH,
      at(s, F = {}) { F.x = AVENUE.elX; F.z = Z_SOUTH - s; F.fx = 0; F.fz = -1; F.nx = 1; F.nz = 0; return F; },
    };
    api.line = line;
    api.sAtZ = (z) => Z_SOUTH - z;

    // ---- the el: the stations (a column pair, the portal between them, the
    // arched plates on to the next), the deck, the railing ----------------------------------------
    const group = new THREE.Group();
    group.name = 'avenueEl';
    scene.add(group);
    const P = Overpass.prototype;
    const hw = O.halfW;
    const col = P.columnGeo.call(null, 28), colLo = P.columnGeo.call(null, 12);
    const Hs = O.deckY - O.springY;
    const across = hw * 2;
    const portalH = O.deckY + O.girderH - 0.4 - (O.springY + 0.4);
    const portal = P.archPlate.call(null, across, portalH, Hs - 0.85, 0.3, 0.26, 36, 2);
    const portalLo = P.archPlate.call(null, across, portalH, Hs - 0.85, 0.3, 0.26, 14, 1);
    const archCache = new Map();
    const archOf = (L, lo) => {
      const key = Math.round(L * 2) + (lo ? 'l' : 'h');
      if (!archCache.has(key)) archCache.set(key, P.archPlate.call(null, L, Hs, Math.min(Hs - 0.62, L * 0.42), 0.3, 0.22, lo ? 14 : 36, lo ? 1 : 2));
      return archCache.get(key);
    };
    const stations = [], columns = [];
    const sOf = STATIONS.map((z) => Z_SOUTH - z);
    for (let k = 0; k < sOf.length; k++) {
      const f = line.at(sOf[k], {});
      const Aa = V3(f.x + f.nx * hw, 0, f.z + f.nz * hw), Bb = V3(f.x - f.nx * hw, 0, f.z - f.nz * hw);
      const nx = k + 1 < sOf.length ? line.at(sOf[k + 1], {}) : null;
      const build = (lo) => {
        const parts = [];
        const cg = lo ? colLo : col;
        for (const c of [Aa, Bb]) parts.push(cg.clone().translate(c.x, 0, c.z));
        parts.push(P.placeLocal.call(null, (lo ? portalLo : portal).clone(), V3(Bb.x, O.springY + 0.4, Bb.z), V3(Aa.x - Bb.x, 0, Aa.z - Bb.z).normalize()));
        if (nx) {
          const A2 = V3(nx.x + nx.nx * hw, 0, nx.z + nx.nz * hw), B2 = V3(nx.x - nx.nx * hw, 0, nx.z - nx.nz * hw);
          for (const [a, b] of [[Aa, A2], [Bb, B2]]) {
            const d = V3(b.x - a.x, 0, b.z - a.z);
            const L = d.length();
            if (L < 1) continue;
            parts.push(P.placeLocal.call(null, archOf(L, lo).clone(), V3(a.x, O.springY, a.z), d.normalize()));
          }
        }
        const m = new THREE.Mesh(merge(parts), M.iron);
        m.castShadow = !lo; m.receiveShadow = true;
        group.add(m);
        return m;
      };
      const mesh = build(false), meshLo = build(true);
      const id = allocIronId();
      tagInk(mesh, id); tagInk(meshLo, id);
      meshLo.visible = false;
      meshLo.userData.noRay = true;
      stations.push({ s: sOf[k], mesh, meshLo, mid: V3(f.x, 0, f.z), lod: 0 });
      columns.push({ x: Aa.x, z: Aa.z, r: 0.66 }, { x: Bb.x, z: Bb.z, r: 0.66 });
      // (a column is solid: the plinth's radius)
      stage.colliders.addCircle(Aa.x, Aa.z, 0.62, 'elcol');
      stage.colliders.addCircle(Bb.x, Bb.z, 0.62, 'elcol');
    }
    {
      const H = O.girderH, fw = 0.26, ft = 0.08, wt = 0.05, R = O.railH;
      const ibeam = [[-fw, 0], [fw, 0], [fw, ft], [wt, ft], [wt, H - ft], [fw, H - ft], [fw, H], [-fw, H], [-fw, H - ft], [-wt, H - ft], [-wt, ft], [-fw, ft]];
      const rail = (p, y, w, h) => sweep(p, [[-w, y], [w, y], [w, y + h], [-w, y + h]], { flat: true });
      const chunks = [];
      const CH = 80;
      for (let s0 = 0; s0 < line.len; s0 += CH) {
        const off = (d) => { const out = []; for (let s = s0; s <= Math.min(line.len, s0 + CH) + 0.01; s += 4) { const f = line.at(s, {}); out.push(V3(f.x + f.nx * d, O.deckY, f.z + f.nz * d)); } return out; };
        const Lp = off(hw), Rp = off(-hw), Mp = off(0);
        if (Lp.length < 2) continue;
        const parts = [sweep(Lp, ibeam, { flat: true }), sweep(Rp, ibeam, { flat: true }),
          sweep(Mp, [[-hw, H - 0.34], [hw, H - 0.34], [hw, H - 0.1], [-hw, H - 0.1]], { flat: true })];
        for (const side of [Lp, Rp]) parts.push(rail(side, H + R - 0.08, 0.05, 0.08), rail(side, H, 0.035, 0.05));
        const m = new THREE.Mesh(merge(parts), M.iron);
        m.castShadow = true; m.receiveShadow = true;
        tagInk(m, allocIronId());
        group.add(m);
        const f = line.at(Math.min(line.len, s0 + CH / 2), {});
        chunks.push({ mesh: m, mid: V3(f.x, 0, f.z) });
      }
      // the railing's posts and diagonals, the cross beams and the ties (the
      // ties: the deck's underside is slatted - light comes down between them)
      const posts = [], braces = [], beams = [], ties = [];
      const q = new THREE.Quaternion(), up = V3(0, 1, 0), tq = new THREE.Quaternion(), bq = new THREE.Quaternion();
      const bay = O.railBay, diagL = Math.hypot(bay, R - 0.08), tilt = Math.atan2(bay, R - 0.08);
      for (let s = 0; s < line.len; s += bay) {
        const f = line.at(s, {});
        q.setFromAxisAngle(up, Math.atan2(f.fx, f.fz));
        for (const d of [hw, -hw]) {
          posts.push(new THREE.Matrix4().compose(V3(f.x + f.nx * d, O.deckY + H + R / 2, f.z + f.nz * d), q, V3(1, 1, 1)));
          const g = line.at(s + bay / 2, {});
          for (const t of [-1, 1]) {
            tq.setFromAxisAngle(V3(1, 0, 0), t * tilt);
            bq.copy(q).multiply(tq);
            braces.push(new THREE.Matrix4().compose(V3(g.x + g.nx * d, O.deckY + H + (R - 0.08) / 2, g.z + g.nz * d), bq, V3(1, 1, 1)));
          }
        }
      }
      for (let s = 0; s < line.len; s += 2.6) {
        const f = line.at(s, {});
        q.setFromAxisAngle(up, Math.atan2(f.fx, f.fz));
        beams.push(new THREE.Matrix4().compose(V3(f.x, O.deckY + 0.2, f.z), q, V3(1, 1, 1)));
      }
      for (let s = 0; s < line.len; s += 0.6) {
        const f = line.at(s, {});
        q.setFromAxisAngle(up, Math.atan2(f.fx, f.fz));
        ties.push(new THREE.Matrix4().compose(V3(f.x, O.deckY + H - 0.05, f.z), q, V3(1, 1, 1)));
      }
      const mkI = (geo, mats, mat) => {
        const im = new THREE.InstancedMesh(geo, mat, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, m));
        im.instanceMatrix.needsUpdate = true;
        im.userData.inkId = allocIronId();
        im.userData.inkPerInstance = false;
        im.userData.noRay = true;
        im.frustumCulled = false;
        group.add(im);
        return im;
      };
      mkI(new THREE.BoxGeometry(0.06, diagL, 0.06), braces, M.iron);
      mkI(new THREE.BoxGeometry(0.08, R, 0.08), posts, M.iron);
      mkI(new THREE.BoxGeometry(across, 0.36, 0.18), beams, M.ironDark);
      mkI(new THREE.BoxGeometry(across - 0.4, 0.12, 0.22), ties, M.ironDark);
      api.chunks = chunks;
    }
    api.el = { group, stations, columns, deckY: O.deckY + O.girderH };
    const lod = (on) => { for (const s of stations) if (s.lod === 0) { s.mesh.visible = !on; s.meshLo.visible = on; } };
    stage.onReflLod(lod);
    stage.onShadowLod(lod);

    // ---- the lamps: hung under the el's cross beams over the west lane, the
    // goosenecks along the east kerb ----------------------------------------------------------------
    const L = stage.part('lamps');
    api.lamps = {
      el1: L.hang(AVENUE.elX - 1.6, O.deckY - 0.2, -80.0, { real: true }),
      el2: L.hang(AVENUE.elX - 1.6, O.deckY - 0.2, -92.0, { real: true }),
      el3: L.hang(AVENUE.elX - 1.6, O.deckY - 0.2, -103.4, { real: true }),
      el4: L.hang(AVENUE.elX - 1.6, O.deckY - 0.2, -60.0, { real: true }),
      el5: L.hang(AVENUE.elX - 1.6, O.deckY - 0.2, -116.0, { real: true }),
      e1: L.post(AVENUE.road[1] + 0.7, -86.0, -Math.PI / 2, { y: 0.15, real: false }),
      e2: L.post(AVENUE.road[1] + 0.7, -110.0, -Math.PI / 2, { y: 0.15, real: false }),
      e3: L.post(AVENUE.road[1] + 0.7, -40.0, -Math.PI / 2, { y: 0.15, real: false }),
      e4: L.post(AVENUE.road[1] + 0.7, 3.0, -Math.PI / 2, { y: 0.15, real: false }),
      h1: L.post(AVENUE.road[0] - 0.7, HARBOR.z0 - 1.0, Math.PI / 2, { y: 0.15, real: false }),
    };
    for (const k of ['el1', 'el2', 'el3', 'el4', 'el5']) { const l = api.lamps[k]; if (l.light) { l.light.intensity = 110; l.light.angle = 0.7; } }

    // ---- the press hall's dock: the newspaper van backed up to it ---------------------------------
    {
      const T = buildTruck(M);
      const g = T.group;
      g.position.set(AVENUE.road[0] + TRUCK_M.halfW + 0.35, 0, PRESS.dock.z + 4.0 + TRUCK_M.halfL);
      g.rotation.y = -Math.PI / 2;           // nose south, its tail to the dock
      const id = allocInkId(2);
      g.traverse((o) => { if (o.isMesh) { o.userData.inkId = id; o.userData.inkFigure = true; o.castShadow = true; } });
      markFigure(g);
      T.meshes.lens.material = M.glass;
      scene.add(g);
      stage.colliders.addBox(g.position.x, g.position.z, TRUCK_M.halfW, TRUCK_M.halfL, 0, 'van');
      api.van = T;
      // bundles on the pavement by its tail, waiting for it
      const b = [];
      for (let i = 0; i < 8; i++) b.push(roundedBox(0.6, 0.3, 0.42, 0.04, 2).translate(AVENUE.x0 + 0.6 + (i % 2) * 0.66, 0.15 + 0.15 + Math.floor(i / 2) * 0.31, PRESS.dock.z + 2.4));
      K.add('dockBundles', new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.85 }), merge(b), { figure: true });
      stage.colliders.addBox(AVENUE.x0 + 0.93, PRESS.dock.z + 2.4, 0.7, 0.25, 0, 'bundles');
    }

    // ---- the news-stand at the alley's corner ------------------------------------------------------
    {
      const x0 = AVENUE.x0 + 0.15, x1 = AVENUE.x0 + 1.75, z0 = BALLEY.z1 + 5.6, z1 = BALLEY.z1 + 7.6;
      const parts = [];
      parts.push(new THREE.BoxGeometry(x1 - x0, 1.0, z1 - z0).translate((x0 + x1) / 2, 0.15 + 0.5, (z0 + z1) / 2));
      for (const [x, z] of [[x0 + 0.05, z0 + 0.05], [x0 + 0.05, z1 - 0.05], [x1 - 0.05, z0 + 0.05], [x1 - 0.05, z1 - 0.05]]) parts.push(new THREE.BoxGeometry(0.06, 1.3, 0.06).translate(x, 0.15 + 1.65, z));
      parts.push(new THREE.BoxGeometry(x1 - x0 + 0.6, 0.06, z1 - z0 + 0.3).rotateZ(-0.18).translate((x0 + x1) / 2 + 0.2, 0.15 + 2.42, (z0 + z1) / 2));
      K.add('kiosk', MAT.woodDark, merge(parts), { figure: true });
      // the papers on its counter, a board of the headline
      K.add('kiosk', new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.85 }), merge([
        new THREE.BoxGeometry(0.5, 0.06, 1.6).translate(x1 - 0.32, 0.15 + 1.03, (z0 + z1) / 2),
        new THREE.BoxGeometry(0.04, 0.8, 0.6).translate(x1 + 0.03, 0.15 + 0.55, z1 - 0.4),
      ]), { figure: true });
      stage.colliders.addBox((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, 'kiosk');
      api.kioskLamp = L.wall(AVENUE.x0, 3.2, (z0 + z1) / 2, 1, 0, { out: 0.5, strength: 0.85, real: false });
    }

    // ---- the alley behind the press hall: the press's back door, bins, a fire
    // escape over it on the next block, the steam off the pipe's joint -----------------------------
    {
      const Fs = face('z', BALLEY.z1, -1);       // the press hall's north wall, facing the alley
      A.door('balley', Fs, 88.4, 1.2, 2.4);
      api.backLamp = L.wall(88.4, 3.1, BALLEY.z1, 0, -1, { out: 0.35, strength: 0.9 });
      api.alleyLamp = L.wall(76.5, 3.6, BALLEY.z0, 0, 1, { out: 0.35, strength: 0.85 });
      const Fn = face('z', BALLEY.z0, 1);        // the next block's south face
      A.landing('balley', Fn, 84.6, 91.0, 2 * FLOOR, 1.1);
      A.landing('balley', Fn, 84.6, 91.0, 3 * FLOOR, 1.1);
      A.flight('balley', Fn, 85.2, 3 * FLOOR, 88.8, 2 * FLOOR, 0.7, 0.6);
      for (const [x, z] of [[92.6, BALLEY.z0 + 0.4], [91.9, BALLEY.z0 + 0.4], [77.6, BALLEY.z1 - 0.4], [86.8, BALLEY.z0 + 0.42]]) {
        K.add('balleyBins', MAT.metal, lathe([[0, 0], [0.26, 0], [0.28, 0.05], [0.27, 0.72], [0.3, 0.76], [0.3, 0.8], [0, 0.8]], 20).translate(x, 0, z), { figure: true });
        stage.colliders.addCircle(x, z, 0.32, 'can');
      }
      A.wire(V3(78.0, 7.6, BALLEY.z0), V3(79.2, 7.2, BALLEY.z1), 0.4);
      // the alley's Look: darker than the avenue, the steam lit
      stage.addLook(new THREE.Box3(V3(BALLEY.x0, -1, BALLEY.z0), V3(BALLEY.x1, 30, BALLEY.z1)), { ambient: 0.1, exposure: 1.0, haze: 0.5 });
    }
    // ([C6 3rd] the main has burst in the alley tonight: a barrier across it
    // west of the pipe - trestles, boards, a lantern on it, the steam
    // pouring off the pipe's joint behind - the way from the avenue is not
    // through here but round by the cut further up)
    {
      const xb = BALLEY.shut, g = 'balleyBarrier';
      const z0 = BALLEY.z0 + 0.05, z1 = BALLEY.z1 - 0.05;
      for (const y of [0.55, 1.05]) K.box(g, MAT.wood, xb - 0.04, xb + 0.04, y - 0.08, y + 0.08, z0, z1);
      for (let z = z0 + 0.4; z < z1; z += 1.6) for (const s of [-1, 1]) K.add(g, MAT.woodDark, new THREE.BoxGeometry(0.06, 1.25, 0.06).rotateX(s * 0.3).translate(xb + 0.15 * s, 0.6, z));
      // (the boards striped: dark and pale bands, the pale the paint)
      for (let z = z0 + 0.3; z < z1; z += 0.9) for (const y of [0.55, 1.05]) K.box(g, MAT.plaster, xb - 0.045, xb + 0.045, y - 0.075, y + 0.075, z, z + 0.42);
      // a board hung on it, a lantern on its post
      K.box(g, MAT.plaster, xb - 0.06, xb - 0.03, 1.2, 1.7, (z0 + z1) / 2 - 0.5, (z0 + z1) / 2 + 0.5);
      K.add(g, MAT.iron, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8).translate(xb, 0.8, z1 - 0.3), { figure: true });
      K.add(g, MAT.iron, new THREE.CylinderGeometry(0.09, 0.11, 0.24, 10).translate(xb, 1.72, z1 - 0.3), { figure: true });
      K.collide(xb - 0.2, xb + 0.2, BALLEY.z0, BALLEY.z1, 'barrier');
      api.barrierLamp = L.hang(xb, 1.95, z1 - 0.3, { real: false });
    }
    // the steam off the alley pipe's burst joint (things.js's pipe), pouring;
    // off the cut's pipe's leaking joint; and up out of a manhole under the el
    api.steam = new Steam(stage, [V3(BALLEY.pipe.x, BALLEY.pipe.y + 0.3, BALLEY.z0 + 1.65), V3(BALLEY.pipe.x, BALLEY.pipe.y + 0.25, BALLEY.z0 + 3.2), V3(AVENUE.elX + 2.4, 0.05, -90.5), V3(CUT.ns.x0 + 0.6, CUT.pipe.y + 0.35, CUT.pipe.z)], 22);
    // ([C6 3rd] the cut: a lamp over its mouth on the avenue, one at its
    // knee, one half way down its N-S leg; its Look: darker than the avenue)
    api.cutLamps = {
      mouth: L.wall(CUT.ew.x1 - 1.6, 3.8, CUT.ew.z0, 0, 1, { out: 0.35, strength: 0.9 }),
      knee: L.wall(CUT.ns.x0, 3.6, CUT.ew.z0 + 2.3, 1, 0, { out: 0.35, strength: 0.85 }),
      leg: L.wall(CUT.ns.x1, 3.4, -110.0, -1, 0, { out: 0.35, strength: 0.8 }),
    };
    stage.addLook(new THREE.Box3(V3(CUT.ns.x0, -1, CUT.ew.z0), V3(CUT.ew.x1, 30, CUT.ew.z1)), { ambient: 0.1, exposure: 1.0, haze: 0.4 });
    stage.addLook(new THREE.Box3(V3(CUT.ns.x0, -1, CUT.ew.z1), V3(CUT.ns.x1, 30, CUT.ns.z1)), { ambient: 0.1, exposure: 1.0, haze: 0.45 });
    // a manhole's lid in the road under the el (the steam's)
    K.add('avenueRoad', MAT.iron, new THREE.CylinderGeometry(0.42, 0.42, 0.02, 20).translate(AVENUE.elX + 2.4, 0.01, -90.5), { cast: false });

    api.update = (camera) => {
      const p = camera.position;
      // (the el is seen only from the avenue, the alley behind the press
      // hall and down it, the press hall (its dock door) and down Harbor
      // Street: from the yard, the kitchen, the roofs, the row and the
      // market, blocks of twelve metres stand in between - not drawn there)
      // (the alley runs straight from the loading yard to the avenue: from
      // anywhere along that line, the stair included, the el is at its end)
      // ([C6 3rd] and from the cut's E-W leg: the avenue at its mouth)
      const show = (p.x > 50 && p.z < -98.5 && p.z > -107.5) || (p.x > 70 && p.z < -55 && p.z > -110) || p.x > 93 || p.z > -12 || (p.x > CUT.ns.x0 && p.z < CUT.ew.z1 + 1.5 && p.z > CUT.ew.z0 - 0.5);
      if (group.visible !== show) group.visible = show;
      if (!show) return;
      for (const s of stations) {
        const d = Math.hypot(s.mid.x - p.x, s.mid.z - p.z);
        const l = d > SHOW ? 2 : d > (s.lod ? FAR - 4 : FAR) ? 1 : 0;
        if (l === s.lod && s._set) continue;
        s.lod = l; s._set = true;
        s.mesh.visible = l === 0; s.meshLo.visible = l === 1;
      }
      for (const c of api.chunks) c.mesh.visible = Math.hypot(c.mid.x - p.x, c.mid.z - p.z) < SHOW + 60;
    };
    void fbox; void tube;
    K.flush();
    return api;
  },
  update(api, dt, t, camera) { api.update(camera); },
};
