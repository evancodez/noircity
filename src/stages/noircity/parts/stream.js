import * as THREE from 'three';
import { markFigure } from '../../../render/layers.js';
import { nearLot } from '../../../city/kits/facade.js';
import { paveGeo, kerbGeos, LAMP, placeLamp, placeProp } from '../../../city/kits/street.js';
import { CHUNK } from '../../../world/cityGen.js';
import { mergeAll } from './street.js';

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
    const slot = (k) => { if (!index.has(k)) index.set(k, { lots: [], paves: [], lamps: [], props: [] }); return index.get(k); };
    for (const L of C.lots) slot(L.chunk).lots.push(L);
    for (const p of C.paves) slot(p.chunk).paves.push(p);
    for (const l of C.lamps) slot(l.chunk).lamps.push(l);
    for (const p of C.props) slot(p.chunk).props.push(p);
    const MATS = {
      dark: M.black, glass: M.glassDark, trim: M.stoneTrim, iron: M.lampIron, awning: M.wood, tree: M.tower,
      pave: street.paveMat, kerb: M.kerb, shade: M.lampShade, prop: M.paintedMetal,
    };
    const SOLID = new Set(['pave', 'kerb', 'iron', 'prop']);
    const loaded = new Map(), building = new Map();
    const stats = { built: 0, dropped: 0, buildMs: 0, live: 0, lastMs: 0 };

    // a chunk's build, a lot a step
    function* buildChunk(key) {
      const D = index.get(key) || { lots: [], paves: [], lamps: [], props: [] };
      const out = {};
      const push = (k, g) => (out[k] || (out[k] = [])).push(g);
      for (const p of D.paves) {
        push('pave', paveGeo(p.pts));
        for (const g of kerbGeos(p.pts, p.kerbSides)) push('kerb', g);
      }
      yield;
      for (const L of D.lots) { nearLot(L, out); yield; }
      for (const l of D.lamps) { push('iron', placeLamp(LAMP.iron, l)); push('shade', placeLamp(LAMP.shade, l)); }
      for (const p of D.props) push('prop', placeProp(p.kind, p));
      yield;
      const meshes = [];
      let k = 0;
      for (const [b, list] of Object.entries(out)) {
        if (!list.length || !MATS[b]) continue;
        const m = new THREE.Mesh(mergeAll(list), MATS[b]);
        for (const g of list) g.dispose();
        m.userData.inkId = city.idFor(key, k++);
        m.receiveShadow = true;
        if (b === 'pave') m.layers.set(1);   // (LAYER.GROUND: the wet street's pass)
        if (b === 'shade') markFigure(m);
        if (!SOLID.has(b)) m.userData.noRay = true;
        m.name = `chunk ${key} ${b}`;
        meshes.push(m);
        yield;
      }
      return meshes;
    }
    function attach(key, meshes) {
      for (const m of meshes) { group.add(m); if (!m.userData.noRay && stage.rays) stage.addSolid(m); }
      loaded.set(key, { key, meshes });
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
    const api = {
      group, loaded, index, stats,
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
