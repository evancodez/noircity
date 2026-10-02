// Lane C3: the city's plan as a picture (no browser): the blocks, the
// pavements, the streets' graph and lanes, the river road, the el's line,
// his route through it (the path his car follows, with the speed it
// allows). Writes JSON for tools/c3map.py, which draws the PNG.
//   node tools/c3map.mjs > shots/c3/plan.json && python3 tools/c3map.py shots/c3/plan.json shots/c3/map.png
const P = await import('../src/stages/city/plan.js');
const R = await import('../src/stages/city/route.js');
const H = await import('../src/scenes/tail/his.js');
const Lay = await import('../src/stages/city/layout.js');
const { RNG } = await import('../src/util/rng.js');
const out = { blocks: P.BLOCKS, slabs: P.SLABS, edges: P.GRAPH.edges.map((e) => ({ a: e.a, b: e.b, pts: e.pts, lane: e.lane })), nodes: [...P.GRAPH.nodes.values()].map((n) => ({ id: n.id, x: n.x, z: n.z })), river: [], el: P.EL.pts, start: P.START, pier: P.PIER, paths: [] };
for (let s = 0; s <= P.RIVER_LEN; s += 4) { const f = P.riverFrame(s, {}); out.river.push([f.x, f.z]); }
const R0 = new RNG(1937).fork(3303);
out.lots = Lay.lotsOf(R0.fork(601)).map((l) => [l.x0, l.x1, l.z0, l.z1]);
out.columns = Lay.elStations().columns.map((c) => [c.x, c.z]);
out.posts = Lay.postsOf(R0.fork(502)).map((p) => [p.x, p.z]);
out.parked = Lay.parkedOf(R0.fork(911)).map((p) => [p.x, p.z, p.yaw]);
// his routes: every leg near, then every leg far
for (const pick of ['near', 'far']) {
  let ids = [];
  for (const L of H.LEGS) { const l = L.ids || L[pick]; ids = ids.length ? ids.concat(l.slice(1)) : l.slice(); }
  ids.push('river.market', 'river.clock');
  const p = R.buildPath(ids, {});
  out.paths.push({ pick, len: p.len, pts: p.pts.map((q) => [+q.x.toFixed(2), +q.z.toFixed(2), +q.v.toFixed(1)]) });
}
console.log(JSON.stringify(out));
