import * as THREE from 'three';
import { markFigure } from '../../../render/layers.js';
import { nearLot, lotWindows } from '../../../city/kits/facade.js';
import { paveGeo, kerbGeos, LAMP, placeLamp, placeProp, nameAtlas, nameBlades } from '../../../city/kits/street.js';
import { CHUNK } from '../../../world/cityGen.js';
import { mergeAll } from './street.js';
import { mergeUV } from './places.js';

// The near city (lane O1): chunks of CHUNK m streamed round the eye. A chunk
// holds what only matters near: the raised pavements and their kerb stones,
// the relief on the far masses' faces (the dark windows, the shop fronts,
// the cornices, the fire escapes, the awnings, the gardens' gates and
// trees), the lamp posts' iron and shades, the furniture. It is built a lot
// at a time inside a budget of milliseconds a frame (nearest first), and
// dropped (its geometries freed, its solids out of the bullets' world) once
// it is well behind: the whole city is never in memory at once.
//   api: { loaded: Map(key -> chunk), queue, warmAround(x, z), stats, update(camera) }
//   stats: { built, dropped, buildMs (the longest single step), live }
export const NEAR = 210;          // a chunk within this (its nearest point) is built
const FAR_OUT = 290;              // ... and dropped past this
const BUDGET_MS = 4;              // a frame's building

export default {
  name: 'stream', order: 60, tick: 30,
  build(stage) {
    const { scene, M } = stage;
    const city = stage.part('city'), C = city.C;
    const street = stage.part('street');
    const group = new THREE.Group();
    group.name = 'nearCity';
    scene.add(group);
    // what each chunk holds
    const index = new Map();
    const slot = (k) => { if (!index.has(k)) index.set(k, { lots: [], paves: [], lamps: [], props: [], lines: [] }); return index.get(k); };
    for (const L of C.lots) slot(L.chunk).lots.push(L);
    for (const p of C.paves) slot(p.chunk).paves.push(p);
    for (const l of C.lamps) slot(l.chunk).lamps.push(l);
    for (const p of C.props) slot(p.chunk).props.push(p);
    for (const l of C.lines) slot(l.chunk).lines.push(l);
    // (the kit's buckets folded into six meshes a chunk: every mesh is a draw
    // in the id pass and the scene pass, and twenty-odd chunks stand round the eye)
    const FOLD = { dark: 'dark', glass: 'dark', trim: 'trim', iron: 'iron', shade: 'iron', kerb: 'kerb', prop: 'kerb', tree: 'tree', awning: 'tree', pave: 'pave', signs: 'signs', cloth: 'cloth' };
    // (the street names' enamel: one atlas for the city; the washing: pale, both sides)
    const names = nameAtlas([...new Set(C.streets.map((s) => s.name))]);
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.9, side: THREE.DoubleSide });
    const MATS = { dark: M.black, trim: M.stoneTrim, iron: M.lampIron, tree: M.tower, pave: street.paveMat, kerb: M.kerb, signs: names.mat, cloth: clothMat };
    const SOLID = new Set(['pave', 'kerb', 'iron']);
    const loaded = new Map(), building = new Map();
    const stats = { built: 0, dropped: 0, buildMs: 0, live: 0, lastMs: 0 };

    // a chunk's build, a lot a step
    function* buildChunk(key) {
      const D = index.get(key) || { lots: [], paves: [], lamps: [], props: [] };
      const out0 = {};
      const push = (k, g) => (out0[k] || (out0[k] = [])).push(g);
      for (const p of D.paves) {
        push('pave', paveGeo(p.pts));
        for (const g of kerbGeos(p.pts, p.kerbSides)) push('kerb', g);
      }
      yield;
      for (const L of D.lots) { nearLot(L, out0); yield; }
      for (const l of D.lamps) { push('iron', placeLamp(LAMP.iron, l)); push('shade', placeLamp(LAMP.shade, l)); }
      for (const p of D.props) {
        if (p.kind === 'namesign') { const B = nameBlades(p, names); for (const g of B.faces) push('signs', g); for (const g of B.iron) push('iron', g); continue; }
        push(p.road ? 'iron' : p.kind === 'bench' || p.kind === 'stall' ? 'tree' : 'prop', placeProp(p.kind, p));
      }
      // the laundry lines: the line sagging between the walls, the washing pegged on it
      for (const l of D.lines || []) {
        const n = 8, P = [];
        for (let k = 0; k <= n; k++) { const t = k / n; P.push([l.a[0] + (l.b[0] - l.a[0]) * t, l.a[1] + (l.b[1] - l.a[1]) * t - l.sag * 4 * t * (1 - t), l.a[2] + (l.b[2] - l.a[2]) * t]); }
        for (let k = 0; k < n; k++) {
          const [x0, y0, z0] = P[k], [x1, y1, z1] = P[k + 1], L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
          const g = new THREE.CylinderGeometry(0.012, 0.012, L, 3);
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize()));
          g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
          push('iron', g);
        }
        const yaw = Math.atan2(l.b[0] - l.a[0], l.b[2] - l.a[2]) + Math.PI / 2;
        for (const c of l.cloths) {
          const x = l.a[0] + (l.b[0] - l.a[0]) * c.t, z = l.a[2] + (l.b[2] - l.a[2]) * c.t, y = l.a[1] + (l.b[1] - l.a[1]) * c.t - l.sag * 4 * c.t * (1 - c.t);
          push('cloth', new THREE.PlaneGeometry(c.w, c.h).translate(0, -c.h / 2, 0).rotateY(yaw).translate(x, y, z));
        }
      }
      yield;
      const out = {};
      for (const [b, list] of Object.entries(out0)) { const f = FOLD[b]; if (!f) continue; (out[f] || (out[f] = [])).push(...list); }
      const meshes = [];
      let k = 0;
      for (const [b, list] of Object.entries(out)) {
        if (!list.length || !MATS[b]) continue;
        const m = new THREE.Mesh(b === 'signs' ? mergeUV(list) : mergeAll(list), MATS[b]);
        for (const g of list) g.dispose();
        m.userData.inkId = city.idFor(key, k++);
        m.receiveShadow = true;
        if (b === 'pave') m.layers.set(1);   // (LAYER.GROUND: the wet street's pass)
        void markFigure;
        if (!SOLID.has(b)) m.userData.noRay = true;
        m.name = `chunk ${key} ${b}`;
        m.userData.bucket = b;
        meshes.push(m);
        yield;
      }
      return meshes;
    }
    function attach(key, meshes) {
      for (const m of meshes) { group.add(m); if (!m.userData.noRay && stage.rays) stage.addSolid(m); }
      // the chunk's doors (every street door of its lots: shut now, they
      // rattle; O5 opens the places' - city:door)
      const doors = [];
      for (const L of (index.get(key) || { lots: [] }).lots) for (const w of lotWindows(L)) if (w.kind === 'door') doors.push({ x: w.x, z: w.z, nx: w.nx, nz: w.nz, lot: L, place: L.place ? L.place.id : null });
      loaded.set(key, { key, meshes, doors });
      stats.built++;
    }
    function drop(key) {
      const ch = loaded.get(key);
      if (!ch) return;
      for (const m of ch.meshes) {
        group.remove(m);
        if (!m.userData.noRay && stage.rays) stage.removeSolid(m);
        m.geometry.dispose();
      }
      loaded.delete(key);
      stats.dropped++;
    }
    // the chunks a point wants, nearest first: [{ key, d }]
    const want = (x, z, r) => {
      const out = [];
      const i0 = Math.floor((x - r) / CHUNK), i1 = Math.floor((x + r) / CHUNK), j0 = Math.floor((z - r) / CHUNK), j1 = Math.floor((z + r) / CHUNK);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const cx = Math.max(i * CHUNK, Math.min((i + 1) * CHUNK, x)), cz = Math.max(j * CHUNK, Math.min((j + 1) * CHUNK, z));
        const d = Math.hypot(cx - x, cz - z);
        if (d <= r && index.has(`${i},${j}`)) out.push({ key: `${i},${j}`, d });
      }
      return out.sort((a, b) => a.d - b.d);
    };
    // (the wet street's mirror keeps only light and its occluders: the near
    // relief - dark panes, trim, iron, trees, kerbs - is left out of it, a
    // pass's worth of draws saved; the far masses stand in for it there)
    const REFL_OUT = new Set(['dark', 'trim', 'iron', 'tree', 'kerb']);
    stage.onReflLod((on) => { for (const ch of loaded.values()) for (const m of ch.meshes) if (REFL_OUT.has(m.userData.bucket)) m.visible = !on; });
    const api = {
      group, loaded, index, stats,
      // the door nearest a point in the loaded chunks (within r): { x, z, nx, nz, lot, place, d }
      doorNear(x, z, r = 2) {
        let best = null, bd = r;
        const i0 = Math.floor((x - r) / CHUNK), i1 = Math.floor((x + r) / CHUNK), j0 = Math.floor((z - r) / CHUNK), j1 = Math.floor((z + r) / CHUNK);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const ch = loaded.get(`${i},${j}`);
          if (!ch) continue;
          for (const d of ch.doors) { const e = Math.hypot(d.x - x, d.z - z); if (e < bd) { bd = e; best = d; } }
        }
        return best ? { ...best, d: bd } : null;
      },
      // every chunk round a point built now (a start, a jump: before the first frame)
      warmAround(x, z, r = NEAR) {
        for (const { key } of want(x, z, r)) {
          if (loaded.has(key)) continue;
          const it = building.get(key) || buildChunk(key);
          building.delete(key);
          let res; while (!(res = it.next()).done);
          attach(key, res.value);
        }
      },
      update(camera) {
        const p = camera.position;
        // (shot mode: every chunk round the eye at once - a frame never depends on how fast a machine built)
        if (stage.game && stage.game.shotMode) { this.warmAround(p.x, p.z); stats.live = loaded.size; return; }
        // drop what is well behind
        for (const key of [...loaded.keys()]) {
          const [i, j] = key.split(',').map(Number);
          const cx = Math.max(i * CHUNK, Math.min((i + 1) * CHUNK, p.x)), cz = Math.max(j * CHUNK, Math.min((j + 1) * CHUNK, p.z));
          if (Math.hypot(cx - p.x, cz - p.z) > FAR_OUT) drop(key);
        }
        for (const key of [...building.keys()]) {
          const [i, j] = key.split(',').map(Number);
          const cx = Math.max(i * CHUNK, Math.min((i + 1) * CHUNK, p.x)), cz = Math.max(j * CHUNK, Math.min((j + 1) * CHUNK, p.z));
          if (Math.hypot(cx - p.x, cz - p.z) > FAR_OUT) building.delete(key);
        }
        // build the nearest wanted, inside the budget (the eye's own chunk at once)
        const W = want(p.x, p.z, NEAR).filter((w) => !loaded.has(w.key));
        const t0 = performance.now();
        for (const w of W) {
          let it = building.get(w.key);
          if (!it) { it = buildChunk(w.key); building.set(w.key, it); }
          const urgent = w.d < 40;
          for (;;) {
            const a = performance.now();
            const r = it.next();
            const ms = performance.now() - a;
            if (ms > stats.buildMs) stats.buildMs = ms;
            if (r.done) { building.delete(w.key); attach(w.key, r.value); break; }
            if (!urgent && performance.now() - t0 > BUDGET_MS) break;
          }
          if (performance.now() - t0 > BUDGET_MS) break;
        }
        stats.lastMs = performance.now() - t0;
        stats.live = loaded.size;
      },
    };
    return api;
  },
  update: (s, dt, t, camera) => s.update(camera),
};
