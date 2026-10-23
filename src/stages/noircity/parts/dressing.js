import * as THREE from 'three';
import { propPieces, treePieces, faceRelief, boardAtlas, stepsPieces, AMBER } from '../../../city/kits/dress.js';
const GATE_LAMP = AMBER.map((c) => c * 0.45);
import { uniquePieces, signAtlas, stairGate, pierShed } from '../../../city/kits/uniques.js';
import { CHUNK } from '../../../world/cityGen.js';
import { WATER_Y, PIERS, RIVER, QUAY_OFF, PAVE } from '../../../world/plan.js';

// NOIR CITY's dressing (lane O1b): every street its own and more in them,
// drawn round the eye. What world/dressing.js placed (C.dress, C.trees, the
// lots' street faces with their characters, C.uniques) streams in with the
// near city: a chunk within NEAR of the eye is built inside a budget of
// milliseconds a frame (nearest first) and dropped past FAR_OUT. A chunk is
// four meshes, one material each:
//   props   the pavement things (crates, barrels, churns, booths, bikes ...):
//           solid to rounds, every record's vertex range in the merge kept
//           (m.userData.ranges: [{ owner: record, start, count }]) - lane O6's
//           set takes a thing out of its merge when it goes over (smash.chunkIn)
//   relief  the street's face: window heads, quoins, pilasters, the tile, the
//           awnings in its canvas, the trees, what is behind the lit glass
//   boards  the trades' lettered boards (one atlas)
//   lit     the few lights of its own (a red lantern in a chop suey's window)
// The uniques (the one thing mid-block on each street) are few: built once,
// always drawn (a spire, a billboard, a water tower are seen from far).
//   api (stage.part('dressing')): { loaded, stats, uniques, vents, warmAround(x, z), mats }
export const NEAR = 130;
const FAR_OUT = 190;
const BUDGET_MS = 2.5;

// position + normal + colour (+ uv when every piece has one), unindexed
function mergeCol(list) {
  let n = 0;
  const L = list.map(([g0, c]) => { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.getAttribute('normal')) g.computeVertexNormals(); n += g.getAttribute('position').count; return [g, c]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const ranges = [];
  let o = 0;
  for (const [g, c, owner] of L.map((p, i) => [...p, list[i][2]])) {
    const k = g.getAttribute('position').count;
    pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3);
    const [r, gg, b] = Array.isArray(c) ? c : [c, c, c];
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = r; col[(o + i) * 3 + 1] = gg; col[(o + i) * 3 + 2] = b; }
    if (owner) { const last = ranges[ranges.length - 1]; if (last && last.owner === owner && last.start + last.count === o) last.count += k; else ranges.push({ owner, start: o, count: k }); }
    o += k;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.userData.ranges = ranges;
  return out;
}
// (the pieces readied a few at a time, yielding every ~1.5 ms: a chunk's build never one long step)
function* mergeColSteps(list) {
  let t = performance.now();
  for (const p of list) {
    if (p[0].index) p[0] = p[0].toNonIndexed();
    if (!p[0].getAttribute('normal')) p[0].computeVertexNormals();
    if (performance.now() - t > 1.5) { yield; t = performance.now(); }
  }
  return mergeCol(list);
}
function mergeUVs(list) {
  let n = 0;
  const L = list.map((g0) => { const g = g0.index ? g0.toNonIndexed() : g0; n += g.getAttribute('position').count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of L) { pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3); uv.set(g.getAttribute('uv').array, o * 2); o += g.getAttribute('position').count; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

export default {
  name: 'dressing', order: 62, tick: 31,
  build(stage) {
    const { scene, M } = stage;
    const city = stage.part('city'), C = city.C;
    const group = new THREE.Group();
    group.name = 'dressing';
    scene.add(group);
    const relief = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, envMap: M.envSoft, envMapIntensity: 0.25 });
    const A = boardAtlas(), SA = signAtlas();
    const boards = new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.65, emissive: 0xffffff, emissiveMap: A.tex, emissiveIntensity: 0.1 });
    const signs = new THREE.MeshStandardMaterial({ map: SA.tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: SA.tex, emissiveIntensity: 0.18 });
    const lit = new THREE.MeshBasicMaterial({ vertexColors: true });
    // ([O1b] after the critic, m1: the street's things dark on dark away from the
    // lamps - a floor of light on the pavement things, so a crate or a bin reads
    // as a shape in the black between the pools; the relief keeps none)
    const props = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, envMap: M.envSoft, envMapIntensity: 0.25, emissive: 0x262626 });
    const mats = { props, relief, boards, lit };
    // what each chunk holds
    const index = new Map();
    const slot = (k) => { if (!index.has(k)) index.set(k, { props: [], trees: [], lots: [], gardens: [] }); return index.get(k); };
    for (const r of C.dress || []) slot(r.chunk).props.push(r);
    for (const t of C.trees || []) slot(t.chunk).trees.push(t);
    for (const L of C.lots) if (L.fc && L.fc.length) slot(L.chunk).lots.push(L);
    for (const L of C.lots) if (L.kind === 'garden') slot(L.chunk).gardens.push(L);
    const loaded = new Map(), building = new Map();
    const stats = { built: 0, dropped: 0, buildMs: 0, live: 0, tris: 0 };

    function* buildChunk(key) {
      const D = index.get(key) || { props: [], trees: [], lots: [] };
      const out = { props: [], relief: [], board: [], lit: [] };
      for (const r of D.props) for (const [g, c] of propPieces(r)) out.props.push([g, c, r]);
      yield;
      for (const t of D.trees) for (const p of treePieces(t)) out.relief.push(p);
      yield;
      const R = { relief: out.relief, board: out.board, lit: out.lit };
      for (const L of D.lots) { faceRelief(L, R); yield; }
      // the Hill's gates: a lantern lit on each pier (the cold play's finding 7: the Hill's streets a blank wall)
      for (const L of D.gardens || []) {
        const n = L.gates || 1, W = L.x1 - L.x0, gz = L.sides.s ? L.z1 : L.z0, s = L.sides.s ? 1 : -1;
        for (let k = 0; k < n; k++) {
          const gx = L.x0 + (W / n) * (k + 0.5);
          for (const ox of [-2.3, 2.3]) {
            const y = 0.15 + L.wallH + 1.4;
            out.relief.push([new THREE.BoxGeometry(0.36, 0.06, 0.36).translate(gx + ox, y + 0.02, gz), 0.008]);
            out.relief.push([new THREE.ConeGeometry(0.26, 0.2, 4).rotateY(Math.PI / 4).translate(gx + ox, y + 0.62, gz), 0.008]);
            out.lit.push([new THREE.BoxGeometry(0.26, 0.44, 0.26).translate(gx + ox, y + 0.3, gz + s * 0.0), GATE_LAMP]);   // [O1b] (M2: the Hill's colour - its lanterns burn amber)
          }
        }
      }
      yield;
      const meshes = [];
      let k = 8;
      const mk = (geo, mat, bucket, solid) => {
        const m = new THREE.Mesh(geo, mat);
        m.userData.inkId = city.idFor(key, k++);
        m.receiveShadow = true;
        if (!solid) m.userData.noRay = true;
        m.userData.bucket = bucket;
        m.name = `dress ${key} ${bucket}`;
        meshes.push(m);
        return m;
      };
      if (out.props.length) {
        const g = yield* mergeColSteps(out.props);
        const m = mk(g, props, 'props', true);
        // (each record's vertices in the merge: lane O6's set takes one out of it as it goes)
        m.userData.ranges = g.userData.ranges; m.userData.prop = 'merged';
      }
      if (out.relief.length) mk(yield* mergeColSteps(out.relief), relief, 'relief', false);
      if (out.board.length) mk(mergeUVs(out.board), boards, 'boards', false);
      if (out.lit.length) mk(yield* mergeColSteps(out.lit), lit, 'lit', false);
      return meshes;
    }
    function attach(key, meshes) {
      // ([O6] what is out of its merge already is taken out of the new build: smash.chunkIn)
      if (stage.smash && stage.smash.chunkIn) stage.smash.chunkIn(key, meshes);
      for (const m of meshes) { group.add(m); if (!m.userData.noRay && stage.rays) stage.addSolid(m); stats.tris += m.geometry.getAttribute('position').count / 3; }
      loaded.set(key, { key, meshes });
      stats.built++;
    }
    function drop(key) {
      const ch = loaded.get(key);
      if (!ch) return;
      if (stage.smash && stage.smash.chunkOut) stage.smash.chunkOut(key, ch.meshes);
      for (const m of ch.meshes) { group.remove(m); if (!m.userData.noRay && stage.rays) stage.removeSolid(m); stats.tris -= m.geometry.getAttribute('position').count / 3; m.geometry.dispose(); }
      loaded.delete(key);
      stats.dropped++;
    }
    const want = (x, z, r) => {
      const out = [];
      for (let i = Math.floor((x - r) / CHUNK); i <= Math.floor((x + r) / CHUNK); i++) for (let j = Math.floor((z - r) / CHUNK); j <= Math.floor((z + r) / CHUNK); j++) {
        const cx = Math.max(i * CHUNK, Math.min((i + 1) * CHUNK, x)), cz = Math.max(j * CHUNK, Math.min((j + 1) * CHUNK, z));
        const d = Math.hypot(cx - x, cz - z);
        if (d <= r && index.has(`${i},${j}`)) out.push({ key: `${i},${j}`, d });
      }
      return out.sort((a, b) => a.d - b.d);
    };
    // ---- the uniques: built once, always drawn ---------------------------------------------------
    const U = { relief: [], lit: [], sign: [] }, vents = [];
    for (const u of C.uniques || []) {
      const P = uniquePieces(u);
      U.relief.push(...P.relief); U.lit.push(...P.lit); U.sign.push(...P.sign);
      for (const v of P.vents) vents.push({ x: v.x, y: v.y, z: v.z, unique: u.kind });
    }
    // the quay's steps down to the water (the swim's way out)
    for (const s of C.steps || []) U.relief.push(...stepsPieces(s, WATER_Y));
    // the el's stairs: a gate at each foot, chained, CLOSED (the cold play's
    // finding 11): solid, and E at it rattles it as at a street door
    const el = stage.part('el'), stream = stage.part('stream');
    for (const st of (el && el.stops) || []) {
      const x = st.stair.x, z = st.z + 32.4;
      const P = stairGate(x, z, 1.8);
      U.relief.push(...P.relief); U.sign.push(...P.sign);
      C.walls.push({ cx: x, cz: z, hx: 1.0, hz: 0.12, angle: 0, tag: 'gate' });
      if (stream && stream.addDoor) stream.addDoor({ x, z: z + 0.1, nx: 0, nz: 1, lot: null, place: null, gate: 'el' });
    }
    // the piers' sheds: a roof's ridge, doors, a window lit, the office's board (finding 9)
    for (const p of PIERS) {
      const e0 = RIVER.s + QUAY_OFF;
      const P = pierShed(p.x - p.w / 2 + 2, p.x + p.w / 2 - 2, e0 + p.len * 0.35, e0 + p.len * 0.8, (p.office ? 7 : 5) - PAVE, !!p.office);
      U.relief.push(...P.relief); U.lit.push(...P.lit); U.sign.push(...P.sign);
    }
    const uid = city.idFor('5,5', 40);
    const umk = (geo, mat, k, solid) => { const m = new THREE.Mesh(geo, mat); m.userData.inkId = uid + k; m.receiveShadow = true; if (!solid) m.userData.noRay = true; m.name = 'uniques ' + k; group.add(m); return m; };
    const uniques = [];
    if (U.relief.length) uniques.push(umk(mergeCol(U.relief), relief, 0, true));
    if (U.lit.length) uniques.push(umk(mergeCol(U.lit), lit, 1, false));
    if (U.sign.length) uniques.push(umk(mergeUVs(U.sign), signs, 2, false));
    for (const m of uniques) if (!m.userData.noRay && stage.rays) stage.addSolid(m);
    // (the wet street's mirror keeps light: the relief and the props are left out of it, as the near city's are)
    const REFL_OUT = new Set(['props', 'relief', 'boards']);
    stage.onReflLod((on) => { for (const ch of loaded.values()) for (const m of ch.meshes) if (REFL_OUT.has(m.userData.bucket)) m.visible = !on; });

    const api = {
      group, loaded, index, stats, mats, uniques, vents,
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
        if (stage.game && stage.game.shotMode) { this.warmAround(p.x, p.z); stats.live = loaded.size; return; }
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
        const W = want(p.x, p.z, NEAR).filter((w) => !loaded.has(w.key));
        const t0 = performance.now();
        for (const w of W) {
          let it = building.get(w.key);
          if (!it) { it = buildChunk(w.key); building.set(w.key, it); }
          const urgent = w.d < 30;
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
        stats.live = loaded.size;
      },
    };
    return api;
  },
  update: (s, dt, t, camera) => s.update(camera),
};
