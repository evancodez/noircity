import { RNG } from '../util/rng.js';
import { insideDist } from './cityGen.js';
import { CLS, RIVER } from './plan.js';

// NOIR CITY's graphs (lane O1; docs/seams/WORLD.md has the examples).
// Plain data and queries, no THREE: the traffic, the police, the people and
// a headless tool all read the same.
//
// ROADS: a node at every junction and dead end; an edge per street segment
// between two nodes. Traffic keeps to the right. An edge's lanes are offsets
// to the right of its way (a -> b, mirrored for b -> a); the el's streets
// keep their lanes between the columns; the tram's rails are down Grand
// Ave's middle.
//   node: { id, x, z, edges: [edge], signal, deadEnd, ways }
//   edge: { id, a, b (node ids), ax, az, bx, bz, len, dx, dz, hw, cls, name, street,
//           lanes: [offset], park: offset | null, oneway: false, tram, el, diag, river, bridge }
// PAVEMENTS: a node at every pavement corner (by a junction) and at every
// alley's mouth; edges along each kerb's pavement and across each street at
// its junctions (the crossings), and up the alleys.
//   pnode: { id, x, z, edges }   pedge: { a, b, len, kind: 'walk' | 'cross' | 'alley' }
//
// Queries (graph.*):
//   nearestLane(x, z)               -> { edge, dir (+1 a->b, -1 b->a), s, x, z, off, heading, d }
//   route(from, to)                 -> { nodes: [id], edges: [edge], pts: [[x, z]], len } | null
//                                      (from / to: { x, z }: the nearest lanes' nodes; A*)
//   randomWalk(nodeId, steps, rng?) -> [node ids] (never straight back unless a dead end)
//   baysNear(x, z, r)               -> [bay] nearest first (parking: { x, z, yaw, street })
//   pavementAround(x, z)            -> [[x, z]] the walk round the block (the kerb's line in 1.2 m) or null
//   pavementRoute(from, to)         -> { pts, len } along pavements and crossings | null
//   nearestPavement(x, z)           -> { node, d }
//   lineOfSight(x0, z0, x1, z1)     -> true when no building stands between (2D, the lots' walls)
//   nodeAt(id), edgeOf(aId, bId), streetAt(x, z) -> { edge, d } (the street a point stands in)
const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;

// the lanes by class: offsets to the right of the way (m)
const LANES = {
  lane: { lanes: [1.75], park: null },
  street: { lanes: [2.2], park: 4.25 },
  wide: { lanes: [1.9, 4.6], park: null },
  el: { lanes: [1.9], park: 6.4 },
  avenue: { lanes: [1.9], park: 7.6 },
};

export function buildGraph(C) {
  const nodes = new Map(), edges = [];
  const node = (x, z) => {
    const k = key(x, z);
    if (!nodes.has(k)) nodes.set(k, { id: k, x, z, edges: [], signal: false, deadEnd: false });
    return nodes.get(k);
  };
  for (const st of C.streets) {
    const A = node(st.a[0], st.a[1]), B = node(st.b[0], st.b[1]);
    const len = Math.hypot(B.x - A.x, B.z - A.z);
    if (len < 0.5) continue;
    const L = LANES[st.cls] || LANES.street;
    const e = {
      id: edges.length, a: A.id, b: B.id, ax: A.x, az: A.z, bx: B.x, bz: B.z, len, dx: (B.x - A.x) / len, dz: (B.z - A.z) / len,
      hw: st.hw, cls: st.cls, name: st.name, street: st.id, lanes: st.river ? [2.2] : L.lanes, park: st.river ? null : L.park, oneway: false,
      tram: !!st.tram, el: !!st.el, diag: !!st.diag, river: !!st.river, bridge: !!st.bridge,
    };
    edges.push(e); A.edges.push(e); B.edges.push(e);
  }
  for (const n of nodes.values()) {
    n.ways = n.edges.length;
    n.deadEnd = n.ways === 1;
    // (signals where three or more streets meet and one is more than a lane)
    n.signal = n.ways >= 3 && n.edges.some((e) => e.cls !== 'lane') && !n.edges.every((e) => e.river);
  }
  const other = (e, id) => (e.a === id ? e.b : e.a);
  const nodeAt = (id) => nodes.get(id) || null;
  const edgeOf = (a, b) => (nodes.get(a) ? nodes.get(a).edges.find((e) => other(e, a) === b) || null : null);

  // ---- the roads' queries -----------------------------------------------------------------------------
  // edges bucketed by 64 m for the nearest-lane search
  const EB = 64, eb = new Map();
  for (const e of edges) {
    const x0 = Math.min(e.ax, e.bx) - e.hw, x1 = Math.max(e.ax, e.bx) + e.hw, z0 = Math.min(e.az, e.bz) - e.hw, z1 = Math.max(e.az, e.bz) + e.hw;
    for (let i = Math.floor(x0 / EB); i <= Math.floor(x1 / EB); i++) for (let j = Math.floor(z0 / EB); j <= Math.floor(z1 / EB); j++) { const k = i * 4096 + j; if (!eb.has(k)) eb.set(k, []); eb.get(k).push(e); }
  }
  const edgesNear = (x, z, r = 0) => {
    const out = new Set();
    for (let i = Math.floor((x - r) / EB); i <= Math.floor((x + r) / EB); i++) for (let j = Math.floor((z - r) / EB); j <= Math.floor((z + r) / EB); j++) for (const e of eb.get(i * 4096 + j) || []) out.add(e);
    return out;
  };
  function streetAt(x, z) {
    let best = null, bd = Infinity;
    for (let r = 0; r <= 128 && !best; r += 64) for (const e of edgesNear(x, z, r)) {
      const u = Math.max(0, Math.min(e.len, (x - e.ax) * e.dx + (z - e.az) * e.dz));
      const d = Math.hypot(x - (e.ax + e.dx * u), z - (e.az + e.dz * u));
      if (d < bd) { bd = d; best = { edge: e, s: u, d }; }
    }
    return best;
  }
  function nearestLane(x, z, heading = null) {
    const S = streetAt(x, z);
    if (!S) return null;
    const e = S.edge;
    // the side of the street the point is on decides the way (right-hand)
    const nx = -e.dz, nz = e.dx;
    const side = (x - e.ax) * nx + (z - e.az) * nz;
    let dir = side >= 0 ? 1 : -1;
    if (heading != null) { const hx = Math.cos(heading), hz = -Math.sin(heading); dir = hx * e.dx + hz * e.dz >= 0 ? 1 : -1; }
    const off = e.lanes[Math.min(e.lanes.length - 1, Math.max(0, Math.round(Math.abs(side) / 3) - 1))] || e.lanes[0];
    const lx = e.ax + e.dx * S.s + nx * off * dir, lz = e.az + e.dz * S.s + nz * off * dir;
    return { edge: e, dir, s: S.s, x: lx, z: lz, off, heading: Math.atan2(-(e.dz * dir), e.dx * dir), d: S.d };
  }
  // A* over the nodes (the edges both ways)
  function route(from, to) {
    const A = nearestLane(from.x, from.z), B = nearestLane(to.x, to.z);
    if (!A || !B) return null;
    const starts = [A.edge.a, A.edge.b], goals = new Set([B.edge.a, B.edge.b]);
    const g = new Map(), prev = new Map(), open = [];
    const h = (id) => { const n = nodes.get(id); return Math.hypot(n.x - to.x, n.z - to.z); };
    for (const s of starts) { const n = nodes.get(s); const c = Math.hypot(n.x - from.x, n.z - from.z); g.set(s, c); open.push([c + h(s), s]); }
    let found = null;
    const closed = new Set();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, id] = open.splice(bi, 1)[0];
      if (closed.has(id)) continue;
      closed.add(id);
      if (goals.has(id)) { found = id; break; }
      for (const e of nodes.get(id).edges) {
        if (e.bridge && to.x < 440 && from.x < 440) continue;
        const o = other(e, id), c = g.get(id) + e.len;
        if (c < (g.get(o) ?? Infinity)) { g.set(o, c); prev.set(o, id); open.push([c + h(o), o]); }
      }
    }
    if (!found) return null;
    const ids = [found];
    while (prev.has(ids[0])) ids.unshift(prev.get(ids[0]));
    const es = [];
    for (let i = 0; i + 1 < ids.length; i++) es.push(edgeOf(ids[i], ids[i + 1]));
    const pts = [[from.x, from.z], ...ids.map((id) => [nodes.get(id).x, nodes.get(id).z]), [to.x, to.z]];
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return { nodes: ids, edges: es, pts, len };
  }
  function randomWalk(startId, steps, rng = new RNG(7)) {
    const out = [startId];
    let prev = null, cur = startId;
    for (let k = 0; k < steps; k++) {
      const n = nodes.get(cur);
      let opts = n.edges.map((e) => other(e, cur)).filter((o) => o !== prev);
      if (!opts.length) opts = [prev];
      const nx = opts[Math.floor(rng.next() * opts.length) % opts.length];
      prev = cur; cur = nx; out.push(cur);
    }
    return out;
  }
  // the parking bays near a point (bucketed)
  const BB = 32, bb = new Map();
  for (const b of C.bays) { const k = Math.floor(b.x / BB) * 4096 + Math.floor(b.z / BB); if (!bb.has(k)) bb.set(k, []); bb.get(k).push(b); }
  function baysNear(x, z, r = 30) {
    const out = [];
    for (let i = Math.floor((x - r) / BB); i <= Math.floor((x + r) / BB); i++) for (let j = Math.floor((z - r) / BB); j <= Math.floor((z + r) / BB); j++) for (const b of bb.get(i * 4096 + j) || []) { const d = Math.hypot(b.x - x, b.z - z); if (d <= r) out.push({ ...b, d }); }
    return out.sort((p, q) => p.d - q.d);
  }

  // ---- the pavements ----------------------------------------------------------------------------------
  // each kerb polygon's walk: its kerb line 1.2 m in (where it faces a road)
  const pnodes = new Map(), pedges = [];
  const pnode = (x, z) => {
    // (corners within 2.5 m are one)
    const k = `${Math.round(x / 2.5)},${Math.round(z / 2.5)}`;
    if (!pnodes.has(k)) pnodes.set(k, { id: k, x, z, edges: [] });
    return pnodes.get(k);
  };
  const pedge = (A, B, kind) => { if (A === B) return; const len = Math.hypot(B.x - A.x, B.z - A.z); const e = { a: A.id, b: B.id, len, kind }; pedges.push(e); A.edges.push(e); B.edges.push(e); };
  const loops = [];
  // [O1c] only a kerb's side is walked, and only a kerb's side is moved in: a side
  // with no road (the line where two cells are one block) keeps its line, so the
  // walk along a kerb runs on to the next cell's corner on that line and no leg
  // runs along a block's inside (O1's legs did, through the lots: tools/pavecheck.mjs)
  // The walk's line is in the pavement's clear middle: past the kerb's lamp posts
  // (0.7 m in) and street trees (1.25 m), short of the things by the wall (within a
  // metre of it) - 1.2 m in on a lane's 2 m, 2 m on a street's 3.5, 2.7 on an avenue's 5.
  const walkIn = (P, i) => {
    const a = P.pts[i], b = P.pts[(i + 1) % P.pts.length];
    const S = streetAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    const p = !S || S.d > S.edge.hw + 1.5 ? 2 : S.edge.river ? RIVER.pIn : (CLS[S.edge.cls] || CLS.street).p;
    return p >= 3.5 ? Math.min(2.7, Math.max(1.2, p * 0.55)) : 1.2;
  };
  for (const P of C.paves) {
    const inset = insetPoly(P.pts, P.kerbSides.map((k, i) => (k ? walkIn(P, i) : 0)));
    if (!inset) continue;
    loops.push({ pts: inset, pave: P });
    const ns = inset.map(([x, z]) => pnode(x, z));
    for (let i = 0; i < ns.length; i++) if (P.kerbSides[i]) pedge(ns[i], ns[(i + 1) % ns.length], 'walk');
  }
  // the crossings: at each junction, every pair of pavement corners round it
  // that face each other across one street (within the street's width + 4 m)
  for (const n of nodes.values()) {
    if (n.ways < 2) continue;
    const near = [...pnodes.values()].filter((p) => Math.abs(p.x - n.x) < 22 && Math.abs(p.z - n.z) < 22);
    for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
      const A = near[i], B = near[j], d = Math.hypot(A.x - B.x, A.z - B.z);
      if (d < 4 || d > 26) continue;
      // (across a street that meets here: the line A-B crosses that edge's middle line near the junction)
      if (n.edges.some((e) => crossesNear(A, B, e, n))) pedge(A, B, 'cross');
    }
  }
  // the alleys: a node at each mouth, the alley between
  for (const a of C.alleys) {
    const x = (a.x0 + a.x1) / 2;
    const A = pnode(x, a.z0 - 1), B = pnode(x, a.z1 - (a.through ? -1 : 1.5));
    pedge(A, B, 'alley');
  }
  mendWalk(C, pnodes, pedges, pedge, streetAt);
  const pList = [...pnodes.values()];
  function nearestPavement(x, z) {
    let best = null, bd = Infinity;
    for (const p of pList) { const d = Math.abs(p.x - x) + Math.abs(p.z - z); if (d < bd) { bd = d; best = p; } }
    return best ? { node: best, d: Math.hypot(best.x - x, best.z - z) } : null;
  }
  function pavementAround(x, z) {
    for (const L of loops) if (insideDist(L.pave.pts, x, z) > -3) return L.pts.map((p) => [p[0], p[1]]);
    return null;
  }
  function pavementRoute(from, to) {
    const A = nearestPavement(from.x, from.z), B = nearestPavement(to.x, to.z);
    if (!A || !B) return null;
    const other2 = (e, id) => (e.a === id ? e.b : e.a);
    const g = new Map([[A.node.id, 0]]), prev = new Map(), open = [[0, A.node.id]], closed = new Set();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, id] = open.splice(bi, 1)[0];
      if (closed.has(id)) continue;
      closed.add(id);
      if (id === B.node.id) break;
      for (const e of pnodes.get(id).edges) {
        const o = other2(e, id), c = g.get(id) + e.len;
        if (c < (g.get(o) ?? Infinity)) { g.set(o, c); prev.set(o, id); const on = pnodes.get(o); open.push([c + Math.hypot(on.x - to.x, on.z - to.z), o]); }
      }
    }
    if (!closed.has(B.node.id)) return null;
    const ids = [B.node.id];
    while (prev.has(ids[0])) ids.unshift(prev.get(ids[0]));
    const pts = ids.map((id) => [pnodes.get(id).x, pnodes.get(id).z]);
    return { pts, len: g.get(B.node.id) };
  }

  // ---- line of sight (2D: a building's walls between) ---------------------------------------------------
  const WB = 32, wb = new Map();
  for (const w of C.walls) {
    if (w.tag !== 'wall' && w.tag !== 'edge') continue;
    const c = Math.cos(w.angle), s = Math.sin(w.angle);
    const ex = w.hx * Math.abs(c) + w.hz * Math.abs(s), ez = w.hx * Math.abs(s) + w.hz * Math.abs(c);
    w.c = c; w.s = s;
    for (let i = Math.floor((w.cx - ex) / WB); i <= Math.floor((w.cx + ex) / WB); i++) for (let j = Math.floor((w.cz - ez) / WB); j <= Math.floor((w.cz + ez) / WB); j++) { const k = i * 4096 + j; if (!wb.has(k)) wb.set(k, []); wb.get(k).push(w); }
  }
  function lineOfSight(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    const n = Math.ceil(L / (WB * 0.5)) + 1;
    const tested = new Set();
    for (let k = 0; k <= n; k++) {
      const px = x0 + dx * (k / n), pz = z0 + dz * (k / n);
      for (const w of wb.get(Math.floor(px / WB) * 4096 + Math.floor(pz / WB)) || []) {
        if (tested.has(w)) continue;
        tested.add(w);
        if (segBox(x0, z0, x1, z1, w)) return false;
      }
    }
    return true;
  }

  return {
    nodes, edges, pnodes, pedges, nodeAt, edgeOf, streetAt, nearestLane, route, randomWalk, baysNear,
    nearestPavement, pavementAround, pavementRoute, lineOfSight,
  };
}

// ---- [O1c] the walk mended ---------------------------------------------------------------------------------
// (docs/briefs/O1C_STREETS.md §1; tools/pavecheck.mjs walks every leg) A man walks a
// leg's line (plus his keep-right step); nothing solid may stand on it:
// - a corner standing in a solid (a dead end's pavement against the building past
//   it, a garden's wall on the cell's line) is stepped out along its own walk;
// - a walk leg with a thing on its line (a newsstand, a bench, a crate, a lamp post,
//   a tree) goes round it by two corners on the side with pavement and room.
export const WALK_R = 0.35;   // a walker's radius (Person.r 0.3 and a hand's breadth)
const HARD = new Set(['wall', 'edge', 'fence', 'barrier', 'rail', 'stair']);
export function walkSolids(C) {
  const B = 16, cells = new Map();
  const put = (o, x0, z0, x1, z1) => { for (let i = Math.floor(x0 / B); i <= Math.floor(x1 / B); i++) for (let j = Math.floor(z0 / B); j <= Math.floor(z1 / B); j++) { const k = i * 8192 + j; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(o); } };
  for (const w of C.walls) {
    const c = Math.cos(w.angle), s = Math.sin(w.angle);
    const ex = w.hx * Math.abs(c) + w.hz * Math.abs(s), ez = w.hx * Math.abs(s) + w.hz * Math.abs(c);
    put({ box: w, c, s, hard: HARD.has(w.tag) && !w.dress }, w.cx - ex, w.cz - ez, w.cx + ex, w.cz + ez);
  }
  for (const p of C.posts) put({ post: p, hard: false }, p.x - p.r, p.z - p.r, p.x + p.r, p.z + p.r);
  const near = (x0, z0, x1, z1, pad = 1) => {
    const out = new Set();
    for (let i = Math.floor((Math.min(x0, x1) - pad) / B); i <= Math.floor((Math.max(x0, x1) + pad) / B); i++) for (let j = Math.floor((Math.min(z0, z1) - pad) / B); j <= Math.floor((Math.max(z0, z1) + pad) / B); j++) for (const o of cells.get(i * 8192 + j) || []) out.add(o);
    return out;
  };
  // does the segment (a man of radius r walking it) meet the solid?
  const meets = (o, x0, z0, x1, z1, r) => {
    if (o.post) return segPointDist(x0, z0, x1, z1, o.post.x, o.post.z) < o.post.r + r;
    const b = o.box;
    return segBox(x0, z0, x1, z1, { cx: b.cx, cz: b.cz, hx: b.hx + r, hz: b.hz + r, c: o.c, s: o.s });
  };
  const hits = (x0, z0, x1, z1, r = WALK_R) => [...near(x0, z0, x1, z1)].filter((o) => meets(o, x0, z0, x1, z1, r));
  return { near, meets, hits };
}
export function segPointDist(x0, z0, x1, z1, px, pz) {
  const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
  const t = L2 > 1e-9 ? Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / L2)) : 0;
  return Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t));
}
function mendWalk(C, pnodes, pedges, pedge, streetAt) {
  const S = walkSolids(C), R = WALK_R;
  const other = (e, n) => pnodes.get(e.a === n.id ? e.b : e.a);
  const onPave = (x, z) => { for (const P of C.paves) { const b = P.bb || (P.bb = bbox(P.pts)); if (x < b[0] - 1 || x > b[1] + 1 || z < b[2] - 1 || z > b[3] + 1) continue; if (insideDist(P.pts, x, z) > 0.05) return true; } return false; };
  const clearAt = (x, z) => !S.hits(x, z, x, z).length;
  // (a step round a thing keeps to the pavement, or a lane's cobbles - a lane's pavement is 2 m)
  // or the road's gutter (a man steps off the kerb round a thing that fills the pavement)
  const lane = (x, z) => { const s = streetAt(x, z); return !!s && !s.edge.bridge && s.d < s.edge.hw - 0.1 && (s.edge.cls === 'lane' || s.d > s.edge.hw - 1.4); };
  const walkable = (x, z) => onPave(x, z) || lane(x, z);
  // 1. the corners out of the solids, along their walk
  for (const n of pnodes.values()) {
    if (!n.edges.length || clearAt(n.x, n.z)) continue;
    let done = false;
    for (let d = 0.2; d <= 3 && !done; d += 0.1) for (const e of n.edges) {
      if (e.kind !== 'walk') continue;
      const o = other(e, n), L = Math.hypot(o.x - n.x, o.z - n.z) || 1;
      if (d > L / 3) continue;
      const x = n.x + (o.x - n.x) / L * d, z = n.z + (o.z - n.z) / L * d;
      if (clearAt(x, z)) { n.x = x; n.z = z; done = true; break; }
    }
  }
  for (const e of pedges) { const A = pnodes.get(e.a), B = pnodes.get(e.b); e.len = Math.hypot(B.x - A.x, B.z - A.z); }
  // 2. the walk round the things on its line
  let k = 0;
  for (const e of pedges.slice()) {
    if (e.kind !== 'walk') continue;
    const A = pnodes.get(e.a), B = pnodes.get(e.b);
    const hit = S.hits(A.x, A.z, B.x, B.z);
    if (!hit.length || e.len < 1) continue;
    const ux = (B.x - A.x) / e.len, uz = (B.z - A.z) / e.len, vx = -uz, vz = ux;
    const at = (u, w) => [A.x + ux * u + vx * w, A.z + uz * u + vz * w];
    // (a thing's extent along the leg and across it)
    const extOf = (o) => {
      const pts = o.post ? [[o.post.x - o.post.r, o.post.z - o.post.r], [o.post.x + o.post.r, o.post.z - o.post.r], [o.post.x + o.post.r, o.post.z + o.post.r], [o.post.x - o.post.r, o.post.z + o.post.r]]
        : [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const w = o.box; const lx = a * w.hx, lz = b * w.hz; return [w.cx + lx * o.c + lz * o.s, w.cz - lx * o.s + lz * o.c]; });
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const [x, z] of pts) { const u = (x - A.x) * ux + (z - A.z) * uz, v = (x - A.x) * vx + (z - A.z) * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      return { u0, u1, v0, v1, objs: new Set([o]) };
    };
    const grow = (g, x) => { g.u0 = Math.min(g.u0, x.u0); g.u1 = Math.max(g.u1, x.u1); g.v0 = Math.min(g.v0, x.v0); g.v1 = Math.max(g.v1, x.v1); for (const o of x.objs) g.objs.add(o); };
    const groups = [];
    for (const x of hit.map(extOf).sort((p, q) => p.u0 - q.u0)) { const g = groups[groups.length - 1]; if (g && x.u0 < g.u1 + 4) grow(g, x); else groups.push(x); }
    // (the way: off the line a metre before the thing, along it clear of it, back on a
    // metre after; each side tried, the nearer first; a thing met on the way round
    // joins the group and the way goes round it too)
    const way = [[A.x, A.z]];
    let ok = true;
    for (const g0 of groups) {
      const order = Math.abs(g0.v1) < Math.abs(g0.v0) ? [1, -1] : [-1, 1];
      let got = null;
      for (const side of order) {
        const g = { ...g0, objs: new Set(g0.objs) };
        let extra = 0;
        for (let it = 0; it < 14 && !got; it++) {
          const v = side > 0 ? g.v1 + R + 0.15 + extra : g.v0 - R - 0.15 - extra;
          const ua = Math.max(0.2, g.u0 - 0.7), ub = Math.min(e.len - 0.2, g.u1 + 0.7);
          const p1 = at(ua, v), p2 = at(ub, v), last = way[way.length - 1];
          const lastU = (last[0] - A.x) * ux + (last[1] - A.z) * uz;
          if (ua < lastU - 0.1 || Math.abs(v) > 3.5) break;
          if (!walkable(p1[0], p1[1]) || !walkable(p2[0], p2[1])) { extra += 0.25; continue; }   // (over the kerb: a little further)
          const pts = [];
          if (ua - 1.1 > lastU + 0.3) pts.push(at(ua - 1.1, 0));
          pts.push(p1, p2);
          if (ub + 1.1 < e.len - 0.3) pts.push(at(ub + 1.1, 0));
          let q = last, met = null;
          for (const p of pts) { const h = S.hits(q[0], q[1], p[0], p[1]); if (h.length) { met = h; break; } q = p; }
          if (!met) { got = pts; break; }
          const fresh = met.filter((o) => !g.objs.has(o));
          if (fresh.some((o) => o.hard)) break;   // (not round a building: the other side)
          if (fresh.length) for (const o of fresh) grow(g, extOf(o)); else extra += 0.2;
        }
        if (got) break;
      }
      if (!got) { ok = false; break; }
      way.push(...got);
    }
    const last = way[way.length - 1];
    if (!ok || S.hits(last[0], last[1], B.x, B.z).length) continue;
    // (the leg replaced by the way round)
    pedges.splice(pedges.indexOf(e), 1);
    A.edges.splice(A.edges.indexOf(e), 1); B.edges.splice(B.edges.indexOf(e), 1);
    let prev = A;
    for (let i = 1; i < way.length; i++) { const id = `r${k++}`, n = { id, x: way[i][0], z: way[i][1], edges: [], round: true }; pnodes.set(id, n); pedge(prev, n, 'walk'); prev = n; }
    pedge(prev, B, 'walk');
  }
}
function bbox(P) { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const [x, z] of P) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return [a, b, c, d]; }

// a convex polygon moved in by d (a number, or one per side: [O1c]) (null if it vanishes)
function insetPoly(P, dd) {
  let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }
  const s = a >= 0 ? 1 : -1;
  const lines = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    const ex = q[0] - p[0], ez = q[1] - p[1], L = Math.hypot(ex, ez) || 1;
    const nx = (-ez / L) * s, nz = (ex / L) * s, d = Array.isArray(dd) ? dd[i] : dd;
    lines.push({ px: p[0] + nx * d, pz: p[1] + nz * d, ex, ez });
  }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const A = lines[(i + lines.length - 1) % lines.length], B = lines[i];
    const den = A.ex * B.ez - A.ez * B.ex;
    if (Math.abs(den) < 1e-9) { out.push([B.px, B.pz]); continue; }
    const t = ((B.px - A.px) * B.ez - (B.pz - A.pz) * B.ex) / den;
    out.push([A.px + A.ex * t, A.pz + A.ez * t]);
  }
  // (a vanished polygon: the area's sign flipped)
  let a2 = 0; for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
  return a2 * a > 0 && Math.abs(a2) > 1 ? out : null;
}

// does the segment A-B cross edge e's centre line within 30 m of junction n?
function crossesNear(A, B, e, n) {
  const ox = e.a === n.id ? e.ax : e.bx, oz = e.a === n.id ? e.az : e.bz;
  const dx = e.a === n.id ? e.dx : -e.dx, dz = e.a === n.id ? e.dz : -e.dz;
  // the street's line from the junction outward: p(t) = o + d t, t in [hw, 30]
  const rx = B.x - A.x, rz = B.z - A.z;
  const den = rx * dz - rz * dx;
  if (Math.abs(den) < 1e-6) return false;
  const t = ((A.x - ox) * rz - (A.z - oz) * rx) / -den;
  const u = ((A.x - ox) * dz - (A.z - oz) * dx) / -den;
  return t > 2 && t < 30 && u > 0 && u < 1;
}

// a segment against an oriented box (slab test in the box's frame)
export function segBox(x0, z0, x1, z1, b) {
  const c = b.c ?? Math.cos(b.angle), s = b.s ?? Math.sin(b.angle);
  const lx0 = (x0 - b.cx) * c - (z0 - b.cz) * s, lz0 = (x0 - b.cx) * s + (z0 - b.cz) * c;
  const lx1 = (x1 - b.cx) * c - (z1 - b.cz) * s, lz1 = (x1 - b.cx) * s + (z1 - b.cz) * c;
  let t0 = 0, t1 = 1;
  const dx = lx1 - lx0, dz = lz1 - lz0;
  for (const [p, d, h] of [[lx0, dx, b.hx], [lz0, dz, b.hz]]) {
    if (Math.abs(d) < 1e-9) { if (p < -h || p > h) return false; continue; }
    let a = (-h - p) / d, cc = (h - p) / d;
    if (a > cc) { const t = a; a = cc; cc = t; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, cc);
    if (t0 > t1) return false;
  }
  return true;
}
