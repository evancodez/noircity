import * as THREE from 'three';
import { tagInk, allocIronId } from '../../../render/layers.js';
import { merge, sweep, V3 } from '../../../world/geom.js';
import { Overpass, OVERPASS } from '../../../world/Overpass.js';
import { CANAL, WATER_Y } from '../plan.js';
import { elStations } from '../layout.js';

// The el: the block's iron (its column lathe and its arched plates,
// world/Overpass.js) along the city's line (plan.EL): down the avenue,
// round into Harbor St, along it, round and down the river road to the
// docks. Its columns stand in the roadway, two lines 7.8 m apart, never in
// a cross street's carriageway (a span there is longer); over the canal
// they stand on stone piers in the water. Each station (a column pair, the
// portal between them and the two arched plates on to the next) is one
// mesh in two builds; the deck's girders and slab are chunks; the railing
// and the cross beams are instanced.
// API: { line: { at(s), len }, stations, columns: [{ x, z, r }], update(camera) }
const O = OVERPASS;
const FAR = 70, SHOW = 300;
const P = Overpass.prototype;

export default {
  name: 'el', order: 30, tick: 20,
  build(stage) {
    const { scene, M } = stage;
    const group = new THREE.Group();
    group.name = 'el';
    scene.add(group);
    const { stations: st, line } = elStations();
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
    const pier = new THREE.BoxGeometry(1.7, 1, 1.7);
    const stations = [], columns = [];
    const inCanal = (z) => z < CANAL.z0 + 0.5 && z > CANAL.z1 - 0.5;
    for (let k = 0; k < st.length; k++) {
      const f = line.at(st[k], {});
      const A = V3(f.x + f.nx * hw, 0, f.z + f.nz * hw), B = V3(f.x - f.nx * hw, 0, f.z - f.nz * hw);
      const nx = k + 1 < st.length ? line.at(st[k + 1], {}) : null;
      const build = (lo) => {
        const parts = [];
        const cg = lo ? colLo : col;
        for (const c of [A, B]) {
          parts.push(cg.clone().translate(c.x, 0, c.z));
          if (inCanal(c.z)) parts.push(pier.clone().scale(1, -WATER_Y + 1.4, 1).translate(c.x, (WATER_Y - 1) / 2 + 0.2, c.z));
        }
        parts.push(P.placeLocal.call(null, (lo ? portalLo : portal).clone(), V3(B.x, O.springY + 0.4, B.z), V3(A.x - B.x, 0, A.z - B.z).normalize()));
        if (nx) {
          const A2 = V3(nx.x + nx.nx * hw, 0, nx.z + nx.nz * hw), B2 = V3(nx.x - nx.nx * hw, 0, nx.z - nx.nz * hw);
          for (const [a, b] of [[A, A2], [B, B2]]) {
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
      stations.push({ s: st[k], mesh, meshLo, mid: V3(f.x, 0, f.z), lod: 0 });
      columns.push({ x: A.x, z: A.z, r: 0.66, s: st[k] }, { x: B.x, z: B.z, r: 0.66, s: st[k] });
    }
    // the deck: two plate girders and the slab, in chunks of ~80 m, the
    // railing's two rails on top
    const H = O.girderH, fw = 0.26, ft = 0.08, wt = 0.05, R = O.railH;
    const ibeam = [[-fw, 0], [fw, 0], [fw, ft], [wt, ft], [wt, H - ft], [fw, H - ft], [fw, H], [-fw, H], [-fw, H - ft], [-wt, H - ft], [-wt, ft], [-fw, ft]];
    const rail = (p, y, w, h) => sweep(p, [[-w, y], [w, y], [w, y + h], [-w, y + h]], { flat: true });
    const chunks = [];
    const CH = 80;
    for (let s0 = 0; s0 < line.len; s0 += CH) {
      const off = (d) => { const out = []; for (let s = s0; s <= Math.min(line.len, s0 + CH) + 0.01; s += 2) { const f = line.at(s, {}); out.push(V3(f.x + f.nx * d, O.deckY, f.z + f.nz * d)); } return out; };
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
    // instanced: the railing's posts and X diagonals, the cross beams
    const posts = [], braces = [], beams = [];
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

    const api = {
      group, line, stations, columns, chunks, deckY: O.deckY + H,
      lod(on) { for (const s of stations) if (s.lod === 0) { s.mesh.visible = !on && s.seen !== false; s.meshLo.visible = on && s.seen !== false; } },
      update(camera) {
        const p = camera.position;
        for (const s of stations) {
          const d = Math.hypot(s.mid.x - p.x, s.mid.z - p.z);
          const lod = d > SHOW || s.seen === false ? 2 : d > (s.lod ? FAR - 4 : FAR) ? 1 : 0;
          if (lod === s.lod && s._set) continue;
          s.lod = lod; s._set = true;
          s.mesh.visible = lod === 0; s.meshLo.visible = lod === 1;
        }
        for (const c of chunks) c.mesh.visible = Math.hypot(c.mid.x - p.x, c.mid.z - p.z) < SHOW + 60;
      },
    };
    stage.onReflLod((on) => api.lod(on));
    stage.onShadowLod((on) => api.lod(on));
    return api;
  },
  update: (el, dt, t, camera) => el.update(camera),
};
