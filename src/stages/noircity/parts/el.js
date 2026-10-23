import * as THREE from 'three';
import { tagInk, allocIronId } from '../../../render/layers.js';
import { merge, sweep, V3, roundedBox } from '../../../world/geom.js';
import { Overpass, OVERPASS } from '../../../world/Overpass.js';
import { EL, PAVE } from '../../../world/plan.js';
import { EL_LINE } from '../../../world/cityGen.js';

// The el's loop (lane O1): the block's iron (world/Overpass.js: its column
// lathe, its arched plates) round Grand Ave, Market St, the Bowery and
// Houston St, its corners arcs over the corner lots the generator kept clear.
// Its columns stand in the roadway, two lines 7.8 m apart, never in a cross
// street's carriageway (a span is longer there). Each station (a column
// pair, the portal between them, the arched plates on to the next) is one
// mesh in two builds; the deck is chunks; the railing and cross beams are
// instanced. Its three stations: a platform each side, a kiosk, the stair
// down to the pavement.
// API: { line: { at(s, out), len, closed }, stations, columns: [{ x, z, r }], deckY, stops: [...] }
const O = OVERPASS;
const FAR = 70, SHOW = 320;
const P = Overpass.prototype;

// the line sampled every metre by arc length (closed)
export function elLine() {
  const pts = [...EL_LINE, EL_LINE[0]];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  const at = (s, out = {}) => {
    s = ((s % len) + len) % len;
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const u = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    out.x = ax + (bx - ax) * u; out.z = az + (bz - az) * u;
    let fx = bx - ax, fz = bz - az; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    out.fx = fx; out.fz = fz; out.nx = -fz; out.nz = fx;
    return out;
  };
  return { at, len, closed: true };
}

export default {
  name: 'el', order: 35, tick: 20,
  *buildSteps(stage) {
    const { scene, M } = stage;
    const C = stage.part('city').C;
    const group = new THREE.Group();
    group.name = 'el';
    scene.add(group);
    const line = elLine();
    const hw = O.halfW;
    // where a column may not stand: in a cross street's carriageway (a
    // street not running with the el there) or Broadway's
    const blocked = (s) => {
      const f = line.at(s, {});
      for (const sg of [-1, 1]) {
        const x = f.x + f.nx * hw * sg, z = f.z + f.nz * hw * sg;
        for (const st of C.streets) {
          const [ax, az] = st.a, [bx, bz] = st.b, L = Math.hypot(bx - ax, bz - az);
          const dx = (bx - ax) / L, dz = (bz - az) / L;
          if (Math.abs(dx * f.fx + dz * f.fz) > 0.97 && !st.diag) continue;
          const u = Math.max(0, Math.min(L, (x - ax) * dx + (z - az) * dz));
          if (Math.hypot(x - ax - dx * u, z - az - dz * u) < st.hw + 1.2) return true;
        }
      }
      return false;
    };
    const st = [];
    for (let s = 0; s < line.len - 4; s += O.span) {
      let q = s;
      for (let k = 0; k < 50 && blocked(q); k++) q += 1;
      if (st.length && q - st[st.length - 1] < 5) continue;
      if (line.len - q < 5) break;
      st.push(q);
      s = q;
    }
    yield;
    const col = P.columnGeo.call(null, 24), colLo = P.columnGeo.call(null, 10);
    const Hs = O.deckY - O.springY;
    const across = hw * 2;
    const portalH = O.deckY + O.girderH - 0.4 - (O.springY + 0.4);
    const portal = P.archPlate.call(null, across, portalH, Hs - 0.85, 0.3, 0.26, 30, 2);
    const portalLo = P.archPlate.call(null, across, portalH, Hs - 0.85, 0.3, 0.26, 12, 1);
    const archCache = new Map();
    const archOf = (L, lo) => {
      const key = Math.round(L * 2) + (lo ? 'l' : 'h');
      if (!archCache.has(key)) archCache.set(key, P.archPlate.call(null, L, Hs, Math.min(Hs - 0.62, L * 0.42), 0.3, 0.22, lo ? 12 : 30, lo ? 1 : 2));
      return archCache.get(key);
    };
    // [O1b] the performance audit's lever 2: the bays were a mesh each (~100,
    // drawn in three passes); now merged by ~80 m of the line, as the deck is
    // (a group's full build while its nearest bay is within FAR, its light one
    // to SHOW): the same iron, a tenth of the draws
    const stations = [], columns = [];
    const GROUP = 80, groups = new Map();
    for (let k = 0; k < st.length; k++) {
      const f = line.at(st[k], {});
      const A = V3(f.x + f.nx * hw, 0, f.z + f.nz * hw), B = V3(f.x - f.nx * hw, 0, f.z - f.nz * hw);
      const nx = line.at(st[(k + 1) % st.length], {});
      const build = (lo) => {
        const parts = [];
        const cg = lo ? colLo : col;
        for (const c of [A, B]) parts.push(cg.clone().translate(c.x, 0, c.z));
        parts.push(P.placeLocal.call(null, (lo ? portalLo : portal).clone(), V3(B.x, O.springY + 0.4, B.z), V3(A.x - B.x, 0, A.z - B.z).normalize()));
        const A2 = V3(nx.x + nx.nx * hw, 0, nx.z + nx.nz * hw), B2 = V3(nx.x - nx.nx * hw, 0, nx.z - nx.nz * hw);
        for (const [a, b] of [[A, A2], [B, B2]]) {
          const d = V3(b.x - a.x, 0, b.z - a.z);
          const L = d.length();
          if (L < 1 || L > 40) continue;
          parts.push(P.placeLocal.call(null, archOf(L, lo).clone(), V3(a.x, O.springY, a.z), d.normalize()));
        }
        return parts;
      };
      const gi = Math.floor(st[k] / GROUP);
      if (!groups.has(gi)) groups.set(gi, { hi: [], lo: [], mids: [], s: st[k] });
      const Gp = groups.get(gi);
      Gp.hi.push(...build(false)); Gp.lo.push(...build(true)); Gp.mids.push(V3(f.x, 0, f.z));
      columns.push({ x: A.x, z: A.z, r: 0.66, s: st[k] }, { x: B.x, z: B.z, r: 0.66, s: st[k] });
      if (k % 5 === 4) yield;
    }
    for (const Gp of groups.values()) {
      const mesh = new THREE.Mesh(merge(Gp.hi), M.iron), meshLo = new THREE.Mesh(merge(Gp.lo), M.iron);
      mesh.castShadow = true; mesh.receiveShadow = true; meshLo.receiveShadow = true;
      const id = allocIronId();
      tagInk(mesh, id); tagInk(meshLo, id);
      meshLo.visible = false;
      meshLo.userData.noRay = true;
      group.add(mesh, meshLo);
      const mid = Gp.mids.reduce((a, b) => a.add(b), V3(0, 0, 0)).multiplyScalar(1 / Gp.mids.length);
      stations.push({ s: Gp.s, mesh, meshLo, mid, mids: Gp.mids, lod: 0 });
      yield;
    }
    // the deck: two plate girders and the slab, in chunks of ~80 m, the railing's rails on top
    const H = O.girderH, fw = 0.26, ft = 0.08, wt = 0.05, R = O.railH;
    const ibeam = [[-fw, 0], [fw, 0], [fw, ft], [wt, ft], [wt, H - ft], [fw, H - ft], [fw, H], [-fw, H], [-fw, H - ft], [-wt, H - ft], [-wt, ft], [-fw, ft]];
    const rail = (p, y, w, h) => sweep(p, [[-w, y], [w, y], [w, y + h], [-w, y + h]], { flat: true });
    yield;
    const chunks = [];
    const CH = 80;
    for (let s0 = 0; s0 < line.len; s0 += CH) {
      const off = (d) => { const out = []; for (let s = s0; s <= Math.min(line.len, s0 + CH) + 0.01; s += 2) { const f = line.at(Math.min(s, line.len - 0.01), {}); out.push(V3(f.x + f.nx * d, O.deckY, f.z + f.nz * d)); } return out; };
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
      yield;
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
      im.computeBoundingSphere();
      group.add(im);
      return im;
    };
    mkI(new THREE.BoxGeometry(0.06, diagL, 0.06), braces, M.iron);
    mkI(new THREE.BoxGeometry(0.08, R, 0.08), posts, M.iron);
    mkI(new THREE.BoxGeometry(across, 0.36, 0.18), beams, M.ironDark);
    yield;
    // the stations: a platform out each side of the deck, a kiosk on it, a
    // stair down to the pavement (seen from the street; a door O5 may open)
    const stops = [];
    for (const S of EL.stations) {
      const x = S.side === 'e' ? EL.x1 : EL.x0, z = S.at;
      const parts = [];
      const deck = O.deckY + H;
      for (const sx of [-1, 1]) {
        const px = x + sx * (hw + 2.2);
        parts.push(new THREE.BoxGeometry(3.6, 0.4, 36).translate(px, deck - 0.2, z));
        parts.push(roundedBox(3.4, 3.0, 9, 0.08, 2).translate(px + sx * 0.2, deck + 1.5, z));
        parts.push(new THREE.BoxGeometry(4.2, 0.25, 38).translate(px, deck + 3.2, z));
        for (const dz of [-15, -5, 5, 15]) parts.push(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6).translate(px + sx * 1.6, deck + 1.6, z + dz));
      }
      // the stair down on the east (or west) pavement: stringers and a landing
      const sx = S.side === 'e' ? 1 : -1;
      const kerb = x + sx * 8, foot = kerb + sx * 2.2;
      const sL = Math.hypot(deck, 14);
      parts.push(new THREE.BoxGeometry(1.8, 0.35, sL).rotateX(Math.atan2(deck, 14)).translate(foot, deck / 2, z + 18 + 7));
      parts.push(new THREE.BoxGeometry(4, 0.3, 3).translate(foot - sx * 0.8, deck - 0.15, z + 18));
      const m = new THREE.Mesh(merge(parts), M.iron);
      tagInk(m, allocIronId());
      m.castShadow = true;
      group.add(m);
      stops.push({ ...S, x, z, mesh: m, stair: { x: foot, z: z + 25, w: 1.8 } });
    }
    void PAVE;
    const api = {
      group, line, stations, columns, chunks, stops, deckY: O.deckY + H,
      lod(on) { for (const s of stations) if (s.lod === 0) { s.mesh.visible = !on; s.meshLo.visible = on; } },
      update(camera) {
        const p = camera.position;
        for (const s of stations) {
          // ([O1b] a group of bays: its nearest bay's distance)
          let d = Infinity;
          for (const m of s.mids || [s.mid]) { const e = Math.hypot(m.x - p.x, m.z - p.z); if (e < d) d = e; }
          const lod = d > SHOW ? 2 : d > (s.lod ? FAR - 4 : FAR) ? 1 : 0;
          if (lod === s.lod && s._set) continue;
          s.lod = lod; s._set = true;
          s.mesh.visible = lod === 0; s.meshLo.visible = lod === 1;
        }
        for (const c of chunks) c.mesh.visible = Math.hypot(c.mid.x - p.x, c.mid.z - p.z) < SHOW + 200;
      },
    };
    stage.onReflLod((on) => api.lod(on));
    stage.onShadowLod((on) => api.lod(on));
    return api;
  },
  build(stage) { const it = this.buildSteps(stage); let r; while (!(r = it.next()).done); return r.value; },
  update: (el, dt, t, camera) => el.update(camera),
};
