import * as THREE from 'three';
import { tagInk, allocIronId } from '../../../render/layers.js';
import { merge, sweep, V3 } from '../../../world/geom.js';
import { Overpass, OVERPASS } from '../../../world/Overpass.js';
import { ROAD, roadPoint, frameAt } from '../road.js';

// The el down the left of the river road: the block's iron (its column
// lathe and its arched spandrel plates, world/Overpass.js), a station every
// span along the road's own line. Built for speed: the arch plates are made
// once and placed (a span varies by centimetres along the gentle bends);
// each station is one mesh in two builds, the light one past FAR m, and
// nothing past SHOW m is drawn at all (the fog has it by then).
// API: { stations, columns: [{ s, d, x, z }], centre: d, update(camera) }
const O = OVERPASS;
const FAR = 70, SHOW = 280;
const P = Overpass.prototype;

export default {
  name: 'el', order: 30, tick: 20,
  build(stage) {
    const { scene, M } = stage;
    const group = new THREE.Group();
    group.name = 'el';
    scene.add(group);
    const dA = ROAD.elA, dB = ROAD.elB, centre = (dA + dB) / 2;
    const col = P.columnGeo.call(null, 28), colLo = P.columnGeo.call(null, 12);
    const Hs = O.deckY - O.springY;
    const archOf = (n, bs) => P.archPlate.call(null, O.span, Hs, Hs - 0.62, 0.3, 0.22, n, bs);
    const arch = archOf(36, 2), archLo = archOf(14, 1);
    const across = Math.abs(dA - dB);
    const portalH = O.deckY + O.girderH - 0.4 - (O.springY + 0.4);
    const portal = P.archPlate.call(null, across, portalH, Hs - 0.85, 0.3, 0.26, 36, 2);
    const portalLo = P.archPlate.call(null, across, portalH, Hs - 0.85, 0.3, 0.26, 14, 1);
    const place = (geo, origin, u, len = null, L0 = O.span) => {
      const g = geo.clone();
      if (len) g.scale(len / L0, 1, 1);
      return P.placeLocal.call(null, g, origin, u);
    };
    const stations = [], columns = [];
    const count = Math.floor(ROAD.len / O.span);
    const pts = [];
    for (let k = 0; k <= count + 1; k++) {
      const s = k * O.span + 4;
      pts.push({ s, A: roadPoint(s, dA), B: roadPoint(s, dB) });
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const c = pts[k], nx = pts[k + 1];
      const build = (lo) => {
        const parts = [];
        const cg = lo ? colLo : col;
        parts.push(cg.clone().translate(c.A.x, 0, c.A.z), cg.clone().translate(c.B.x, 0, c.B.z));
        const ac = new THREE.Vector3().subVectors(c.A, c.B);
        parts.push(place(lo ? portalLo : portal, V3(c.B.x, O.springY + 0.4, c.B.z), ac.clone().normalize()));
        for (const [a, b] of [[c.A, nx.A], [c.B, nx.B]]) {
          const d = new THREE.Vector3().subVectors(b, a);
          parts.push(place(lo ? archLo : arch, V3(a.x, O.springY, a.z), d.clone().normalize(), d.length()));
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
      const mid = c.A.clone().add(c.B).multiplyScalar(0.5);
      stations.push({ s: c.s, mesh, meshLo, mid, lod: 0 });
      columns.push({ s: c.s, d: dA, x: c.A.x, z: c.A.z, r: 0.66 }, { s: c.s, d: dB, x: c.B.x, z: c.B.z, r: 0.66 });
    }

    // the deck: two plate girders and the slab between, in chunks of ~90 m
    // (each culled on its own), the lattice railing's rails on top
    const H = O.girderH, fw = 0.26, ft = 0.08, wt = 0.05, hw = across / 2, R = O.railH;
    const ibeam = [[-fw, 0], [fw, 0], [fw, ft], [wt, ft], [wt, H - ft], [fw, H - ft], [fw, H], [-fw, H], [-fw, H - ft], [-wt, H - ft], [-wt, ft], [-fw, ft]];
    const rail = (p, y, w, h) => sweep(p, [[-w, y], [w, y], [w, y + h], [-w, y + h]], { flat: true });
    const chunks = [];
    const CH = 90;
    for (let s0 = 0; s0 < ROAD.len + 10; s0 += CH) {
      const line = (d) => { const out = []; for (let s = s0; s <= Math.min(ROAD.len + 12, s0 + CH) + 0.01; s += 2) out.push(roadPoint(s, d, O.deckY)); return out; };
      const Lp = line(dA), Rp = line(dB), Mp = line(centre);
      const parts = [sweep(Lp, ibeam, { flat: true }), sweep(Rp, ibeam, { flat: true }),
        sweep(Mp, [[-hw, H - 0.34], [hw, H - 0.34], [hw, H - 0.1], [-hw, H - 0.1]], { flat: true })];
      for (const side of [Lp, Rp]) { parts.push(rail(side, H + R - 0.08, 0.05, 0.08), rail(side, H, 0.035, 0.05)); }
      const m = new THREE.Mesh(merge(parts), M.iron);
      m.castShadow = true; m.receiveShadow = true;
      tagInk(m, allocIronId());
      group.add(m);
      chunks.push({ mesh: m, mid: roadPoint(s0 + CH / 2, centre) });
    }
    // instanced: the railing's posts and X diagonals, cross beams under the deck
    const posts = [], braces = [], beams = [];
    const q = new THREE.Quaternion(), up = V3(0, 1, 0), F = {};
    const bay = O.railBay, diagL = Math.hypot(bay, R - 0.08), tilt = Math.atan2(bay, R - 0.08);
    const tq = new THREE.Quaternion(), bq = new THREE.Quaternion();
    for (let s = 0; s < ROAD.len + 10; s += bay) {
      frameAt(s, F);
      q.setFromAxisAngle(up, Math.atan2(F.fx, F.fz));
      for (const d of [dA, dB]) {
        posts.push(new THREE.Matrix4().compose(roadPoint(s, d, O.deckY + H + R / 2), q, V3(1, 1, 1)));
        for (const t of [-1, 1]) {
          tq.setFromAxisAngle(V3(1, 0, 0), t * tilt);
          bq.copy(q).multiply(tq);
          braces.push(new THREE.Matrix4().compose(roadPoint(s + bay / 2, d, O.deckY + H + (R - 0.08) / 2), bq, V3(1, 1, 1)));
        }
      }
    }
    for (let s = 0; s < ROAD.len + 10; s += 2.6) {
      frameAt(s, F);
      q.setFromAxisAngle(up, Math.atan2(F.fx, F.fz));
      beams.push(new THREE.Matrix4().compose(roadPoint(s, centre, O.deckY + 0.2), q, V3(1, 1, 1)));
    }
    const inst = [];
    const mk = (geo, mats, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.userData.inkId = allocIronId();
      im.userData.inkPerInstance = false;
      im.userData.noRay = true;
      im.frustumCulled = false;
      group.add(im);
      inst.push(im);
      return im;
    };
    mk(new THREE.BoxGeometry(0.06, diagL, 0.06), braces, M.iron);
    mk(new THREE.BoxGeometry(0.08, R, 0.08), posts, M.iron);
    mk(new THREE.BoxGeometry(across, 0.36, 0.18), beams, M.ironDark);

    const api = {
      group, stations, columns, chunks, centre, deckY: O.deckY + H,
      // the light builds for the mirror and the shadow maps
      lod(on) { for (const st of stations) if (st.lod === 0) { st.mesh.visible = !on; st.meshLo.visible = on; } },
      update(camera) {
        const p = camera.position;
        for (const st of stations) {
          const d = Math.hypot(st.mid.x - p.x, st.mid.z - p.z);
          const lod = d > SHOW ? 2 : d > (st.lod ? FAR - 4 : FAR) ? 1 : 0;
          if (lod === st.lod && st._set) continue;
          st.lod = lod; st._set = true;
          st.mesh.visible = lod === 0; st.meshLo.visible = lod === 1;
        }
        for (const c of chunks) c.mesh.visible = Math.hypot(c.mid.x - p.x, c.mid.z - p.z) < SHOW + CH;
      },
    };
    stage.onReflLod((on) => api.lod(on));
    stage.onShadowLod((on) => api.lod(on));
    return api;
  },
  update: (el, dt, t, camera) => el.update(camera),
};
