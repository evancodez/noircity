import * as THREE from 'three';

// Geometry-true breaking glass (lane 3, P0.2; CONTRACTS §8.3). A pane is cut,
// on its first hit, into a seeded Voronoi of its outline (fine round the
// first impact, coarser away from it). Its cracks are walks along the cells'
// edges; its pieces are the groups of cells the cracks enclose. So what falls
// out is exactly what the cracks drew.
//   first round   a hole (the pulverised core cell falls in a shower of bits)
//                 with 6-9 long radial cracks that run to the frame or into
//                 another crack, a few short ring cracks between them, a
//                 white frosted halo round the hole
//   more rounds   more stars; a group of cells the cracks close off from the
//                 frame falls out, leaving a hole with jagged edges
//   enough        (or a body, or a blast) the pane goes: fine cracks run
//                 through the rest, big shards at the edges tip out and
//                 fall, slivers, a shower of bits; teeth stay in the putty
// Shards are real meshes (the cells' polygons, a thin slab), lit by the
// environment so they flash white as they turn; they fall, land, break again,
// slide and lie on the ground (the oldest go past a cap).
// This module is the pane's geometry; destruct/Glass.js is the API.

// ---- 2D helpers (u across the pane, v up it) ------------------------------------------
const cross2 = (ax, ay, bx, by) => ax * by - ay * bx;

// clip a convex polygon (pts [[u,v]], labels: the edge i -> i+1's neighbour)
// by the half plane n.p <= d; the new edge along the line is labelled `lab`
function clip(pts, labels, nx, ny, d, lab) {
  const out = [], ol = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d;
    const ia = da <= 0, ib = db <= 0;
    if (ia) { out.push(a); ol.push(labels[i]); }
    if (ia !== ib) {
      const t = da / (da - db);
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(p);
      ol.push(ia ? lab : labels[i]);
    }
  }
  return [out, ol];
}

function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; }
  return a / 2;
}
function polyCentroid(p) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i], r = p[(i + 1) % p.length];
    const c = q[0] * r[1] - r[0] * q[1];
    a += c; cx += (q[0] + r[0]) * c; cy += (q[1] + r[1]) * c;
  }
  if (Math.abs(a) < 1e-12) return [p[0][0], p[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}
function inConvex(p, u, v) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const c = cross2(b[0] - a[0], b[1] - a[1], u - a[0], v - a[1]);
    if (c !== 0) { if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false; }
  }
  return true;
}
// distance from (u, v) to the outline's edges
function distOutline(o, u, v) {
  let best = Infinity;
  for (let i = 0; i < o.length; i++) {
    const a = o[i], b = o[(i + 1) % o.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((u - a[0]) * ex + (v - a[1]) * ey) / (ex * ex + ey * ey)));
    const dx = a[0] + ex * t - u, dy = a[1] + ey * t - v;
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

// ---- the cut: a Voronoi of the outline ---------------------------------------------
// sites: a jittered grid of pitch s over the outline's box, and round the
// first impact a polar cluster (a core site on the impact, rings of sites
// whose bisectors are the star's radial and ring cracks)
export function cutPane(outline, first, s, rng, scale = 1) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [u, v] of outline) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const sites = [];
  // (rings growing outward: their bisectors are straight radial runs and
  // the arcs between them, so the first star's cracks run true, not zig-zag)
  const R = [0.028, 0.06, 0.105, 0.17, 0.26, 0.38, 0.54, 0.75].map((r) => r * scale);
  const clusterR = R[R.length - 1] * 1.05;
  if (first) {
    sites.push([first[0], first[1]]);
    // (the same spokes on every ring: the bisectors line up into straight
    // radial runs; each ring turns a little so they are not ruled lines)
    const m = 12;
    const a0 = rng.next() * 6.283;
    const jit = Array.from({ length: m }, () => rng.range(-0.12, 0.12));
    R.forEach((r, k) => {
      for (let i = 0; i < m; i++) {
        const a = a0 + (i + jit[i] + rng.range(-0.05, 0.05) + k * 0.015) * 6.283 / m;
        const rr = r * rng.range(0.93, 1.07);
        sites.push([first[0] + Math.cos(a) * rr, first[1] + Math.sin(a) * rr]);
      }
    });
  }
  for (let v = v0 + s * 0.5; v < v1; v += s) {
    for (let u = u0 + s * 0.5; u < u1; u += s) {
      const p = [u + rng.range(-0.42, 0.42) * s, v + rng.range(-0.42, 0.42) * s];
      if (first && Math.hypot(p[0] - first[0], p[1] - first[1]) < clusterR + s * 0.35) continue;
      sites.push(p);
    }
  }
  // (only the sites inside the outline cut it)
  const S = sites.filter((p) => inConvex(outline, p[0], p[1]));
  // a grid over the sites for the neighbour search
  const G = new Map();
  const gk = (i, j) => i * 73856093 ^ j * 19349663;
  const gs = Math.max(s, 0.02);
  S.forEach((p, i) => { const k = gk(Math.floor(p[0] / gs), Math.floor(p[1] / gs)); if (!G.has(k)) G.set(k, []); G.get(k).push(i); });
  const cells = [];
  for (let i = 0; i < S.length; i++) {
    const [x, y] = S[i];
    let pts = outline.map((p) => [p[0], p[1]]), labels = outline.map(() => -1);
    // neighbours in widening rings of grid cells, nearest first
    const gi = Math.floor(x / gs), gj = Math.floor(y / gs);
    const cand = [];
    for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) {
      const l = G.get(gk(gi + di, gj + dj));
      if (l) for (const j of l) if (j !== i) cand.push([j, (S[j][0] - x) ** 2 + (S[j][1] - y) ** 2]);
    }
    cand.sort((a, b) => a[1] - b[1]);
    for (const [j, d2] of cand) {
      // (a site further than twice the cell's reach cannot cut it)
      let reach = 0;
      for (const p of pts) reach = Math.max(reach, (p[0] - x) ** 2 + (p[1] - y) ** 2);
      if (d2 > 4 * reach) break;
      const nx = S[j][0] - x, ny = S[j][1] - y;
      const mx = (S[j][0] + x) / 2, my = (S[j][1] + y) / 2;
      [pts, labels] = clip(pts, labels, nx, ny, nx * mx + ny * my, j);
      if (pts.length < 3) break;
    }
    if (pts.length < 3) continue;
    cells.push({ site: i, poly: pts, labels, area: Math.abs(polyArea(pts)), c: polyCentroid(pts), gone: false, edges: [] });
  }
  return buildGraph(cells, outline);
}

// the cells' shared edges and vertices (a crack walks this graph)
function buildGraph(cells, outline) {
  const verts = [], vmap = new Map(), vEdges = [];
  const vid = (p) => {
    const k = Math.round(p[0] * 2e4) + ',' + Math.round(p[1] * 2e4);
    let id = vmap.get(k);
    if (id === undefined) { id = verts.length; vmap.set(k, id); verts.push([p[0], p[1]]); vEdges.push([]); }
    return id;
  };
  const edges = [], emap = new Map();
  cells.forEach((c, ci) => {
    c.vids = c.poly.map(vid);
    for (let i = 0; i < c.vids.length; i++) {
      const a = c.vids[i], b = c.vids[(i + 1) % c.vids.length];
      if (a === b) { c.edges.push(-1); continue; }
      const k = a < b ? a + '_' + b : b + '_' + a;
      let e = emap.get(k);
      if (e === undefined) {
        e = edges.length;
        emap.set(k, e);
        edges.push({ a, b, c0: ci, c1: -1, frame: c.labels[i] === -1, crack: false });
        vEdges[a].push(e); vEdges[b].push(e);
      } else edges[e].c1 = ci;
      c.edges.push(e);
    }
  });
  // (an edge with one cell is on the frame)
  for (const e of edges) if (e.c1 < 0) e.frame = true;
  const vFrame = verts.map((_, v) => vEdges[v].some((e) => edges[e].frame));
  return { cells, edges, verts, vEdges, vFrame, outline };
}

// ---- cracks ------------------------------------------------------------------------------
function cellAt(P, u, v) {
  for (let i = 0; i < P.cells.length; i++) if (inConvex(P.cells[i].poly, u, v)) return i;
  // (on an edge: the nearest centroid)
  let best = -1, bd = Infinity;
  P.cells.forEach((c, i) => { const d = (c.c[0] - u) ** 2 + (c.c[1] - v) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}

// walk the edges from vertex v along direction (dx, dy): a crack
function walk(P, v, dx, dy, rng, { maxLen = 99, stopAtCrack = 0.85, bend = 0.12, steer = null } = {}) {
  let len = 0, prev = -1, steps = 0;
  const path = [];
  while (steps++ < 400) {
    const [x, y] = P.verts[v];
    if (steer) { const d = steer(x, y); dx = d[0]; dy = d[1]; }
    let best = -1, bs = -Infinity, bw = -1;
    for (const e of P.vEdges[v]) {
      if (e === prev) continue;
      const E = P.edges[e];
      if (E.frame) continue;
      const w = E.a === v ? E.b : E.a;
      const ex = P.verts[w][0] - x, ey = P.verts[w][1] - y;
      const el = Math.hypot(ex, ey) || 1;
      const sc = (ex * dx + ey * dy) / el + rng.gauss() * bend;
      if (sc > bs) { bs = sc; best = e; bw = w; }
    }
    if (best < 0 || bs < -0.1) break;
    const E = P.edges[best];
    const was = E.crack;
    E.crack = true;
    path.push(best);
    const ex = P.verts[bw][0] - x, ey = P.verts[bw][1] - y;
    len += Math.hypot(ex, ey);
    // (the crack drifts a little toward where it has been going)
    const el = Math.hypot(ex, ey) || 1;
    if (!steer) { dx = dx * 0.88 + ex / el * 0.12; dy = dy * 0.88 + ey / el * 0.12; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl; }
    prev = best;
    v = bw;
    if (P.vFrame[v]) break;                                   // ran to the frame
    if (was) break;
    // ran into another crack
    if (P.vEdges[v].some((e) => e !== best && P.edges[e].crack) && rng.next() < stopAtCrack) break;
    if (len > maxLen) break;
  }
  return path;
}

// a star at (u, v): the core cell, radial cracks, ring cracks
// (core: the pulverised cell round the hole cracks free - the first star's,
// a small cell of its own; a later star's cell is a coarse one, so its cracks
// start from the hole as short marks across it, drawn, not cut)
export function addStar(P, u, v, rng, { scale = 1, rays = null, core: withCore = true } = {}) {
  const core = cellAt(P, u, v);
  if (core < 0) return null;
  const C = P.cells[core];
  if (withCore) for (const e of C.edges) if (e >= 0) P.edges[e].crack = true;
  P.decor = P.decor || [];
  const K = rays ?? rng.int(6, 9);
  const a0 = rng.next() * 6.283;
  const radials = [];
  for (let k = 0; k < K; k++) {
    const a = a0 + (k + rng.range(-0.28, 0.28)) * 6.283 / K;
    const dx = Math.cos(a), dy = Math.sin(a);
    // start at the core's vertex that best faces the ray
    let sv = C.vids[0], ss = -Infinity;
    for (const vv of C.vids) {
      const [x, y] = P.verts[vv];
      const l = Math.hypot(x - u, y - v) || 1;
      const sc = ((x - u) * dx + (y - v) * dy) / l;
      if (sc > ss) { ss = sc; sv = vv; }
    }
    if (!withCore) P.decor.push([u, v, P.verts[sv][0], P.verts[sv][1]]);
    radials.push({ a, start: sv, path: walk(P, sv, dx, dy, rng, { stopAtCrack: 0.9 }) });
  }
  // ring cracks: short arcs between neighbouring radials, round the hole
  const nRing = rng.int(2, 4);
  for (let i = 0; i < nRing; i++) {
    const k = rng.int(0, K - 1);
    const R = radials[k];
    const r = rng.range(0.07, 0.22) * scale;
    // the vertex along the radial nearest that radius
    let bv = -1, bd = Infinity;
    for (const e of R.path) for (const vv of [P.edges[e].a, P.edges[e].b]) {
      const d = Math.abs(Math.hypot(P.verts[vv][0] - u, P.verts[vv][1] - v) - r);
      if (d < bd) { bd = d; bv = vv; }
    }
    if (bv < 0) continue;
    const sg = rng.next() < 0.5 ? 1 : -1;
    walk(P, bv, 0, 0, rng, {
      maxLen: r * 1.4, stopAtCrack: 1, bend: 0.05,
      steer: (x, y) => { const rx = x - u, ry = y - v, rl = Math.hypot(rx, ry) || 1; const pull = (r - rl) / r; return [(-ry * sg) / rl + rx / rl * pull, (rx * sg) / rl + ry / rl * pull]; },
    });
  }
  return { core: withCore ? core : -1, cell: core, u, v };
}

// the fine cracks of a pane that goes: many edges crack, more of them near
// the stars (a shower of bits there, big shards at the frame)
export function crackAll(P, stars, rng, { near = 0.85, far = 0.6, edge = 0.42, reach = 0.6 } = {}) {
  for (const E of P.edges) {
    if (E.crack || E.frame) continue;
    const a = P.verts[E.a], b = P.verts[E.b];
    const mu = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2;
    let d = Infinity;
    for (const s of stars) d = Math.min(d, Math.hypot(mu - s.u, mv - s.v));
    const k = Math.max(0, 1 - d / reach);
    // (within ~25 cm of the frame the glass holds in bigger pieces)
    const f = Math.min(1, distOutline(P.outline, mu, mv) / 0.25);
    const p = (far + (near - far) * k) * f + edge * (1 - f) * (1 - k);
    if (rng.next() < p) E.crack = true;
  }
}

// the groups of cells the cracks enclose (union-find across whole edges)
export function pieces(P) {
  const par = P.cells.map((_, i) => i);
  const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (const E of P.edges) {
    if (E.crack || E.c1 < 0) continue;
    const a = E.c0, b = E.c1;
    if (P.cells[a].gone || P.cells[b].gone) continue;
    const ra = find(a), rb = find(b);
    if (ra !== rb) par[ra] = rb;
  }
  const groups = new Map();
  P.cells.forEach((c, i) => { if (c.gone) return; const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  const out = [];
  for (const cells of groups.values()) {
    let frame = false, area = 0, depth = 0;
    for (const ci of cells) {
      const c = P.cells[ci];
      area += c.area;
      for (const e of c.edges) if (e >= 0 && P.edges[e].frame) frame = true;
      for (const p of c.poly) depth = Math.max(depth, distOutline(P.outline, p[0], p[1]));
    }
    out.push({ cells, frame, area, depth });
  }
  return out;
}

// ---- meshes ---------------------------------------------------------------------------------
// the pane's remaining glass: every cell still in the frame, triangulated
export function paneGeometry(P, frame) {
  const pos = [];
  const p3 = (u, v) => frame.c.clone().addScaledVector(frame.U, u).addScaledVector(frame.V, v);
  for (const c of P.cells) {
    if (c.gone) continue;
    const a = p3(c.poly[0][0], c.poly[0][1]);
    for (let i = 1; i < c.poly.length - 1; i++) {
      const b = p3(c.poly[i][0], c.poly[i][1]), d = p3(c.poly[i + 1][0], c.poly[i + 1][1]);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos.length ? pos : [0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// the cracks as thin pale ribbons in the pane's plane (a crack between two
// cells still in the frame, or between one and the frame's gap)
export function crackGeometry(P, frame, width) {
  const pos = [];
  const off = frame.N.clone().multiplyScalar(0.0015);
  const p3 = (u, v) => frame.c.clone().addScaledVector(frame.U, u).addScaledVector(frame.V, v).add(off);
  for (const E of P.edges) {
    if (!E.crack || E.frame) continue;
    const g0 = P.cells[E.c0].gone, g1 = E.c1 < 0 || P.cells[E.c1].gone;
    if (g0 && g1) continue;
    const a = P.verts[E.a], b = P.verts[E.b];
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
    // (a hole's rim is drawn a little heavier: the chipped edge)
    const w = width * (g0 || g1 ? 1.6 : 1) / 2;
    const nx = -ey / l * w, ny = ex / l * w;
    const q = [p3(a[0] + nx, a[1] + ny), p3(b[0] + nx, b[1] + ny), p3(b[0] - nx, b[1] - ny), p3(a[0] - nx, a[1] - ny)];
    pos.push(q[0].x, q[0].y, q[0].z, q[1].x, q[1].y, q[1].z, q[2].x, q[2].y, q[2].z, q[0].x, q[0].y, q[0].z, q[2].x, q[2].y, q[2].z, q[3].x, q[3].y, q[3].z);
  }
  // the marks from a later hole to its cell's corners (drawn while the cell
  // is in the frame)
  for (const [a0, a1, b0, b1] of P.decor || []) {
    const ci = cellAt(P, (a0 + b0) / 2, (a1 + b1) / 2);
    if (ci < 0 || P.cells[ci].gone) continue;
    const ex = b0 - a0, ey = b1 - a1, l = Math.hypot(ex, ey) || 1;
    const nx = -ey / l * width / 2, ny = ex / l * width / 2;
    const q = [p3(a0 + nx, a1 + ny), p3(b0 + nx, b1 + ny), p3(b0 - nx, b1 - ny), p3(a0 - nx, a1 - ny)];
    pos.push(q[0].x, q[0].y, q[0].z, q[1].x, q[1].y, q[1].z, q[2].x, q[2].y, q[2].z, q[0].x, q[0].y, q[0].z, q[2].x, q[2].y, q[2].z, q[3].x, q[3].y, q[3].z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos.length ? pos : [0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  g.computeBoundingSphere();
  return g;
}

// a shard: the group's cells as a thin slab in its own frame (origin at its
// centroid, x along the pane's U, y along V, z the normal)
export function shardGeometry(P, cells, thick) {
  let cu = 0, cv = 0, A = 0;
  for (const ci of cells) { const c = P.cells[ci]; cu += c.c[0] * c.area; cv += c.c[1] * c.area; A += c.area; }
  cu /= A || 1; cv /= A || 1;
  const pos = [];
  const h = thick / 2;
  const tri = (a, b, c, z) => { pos.push(a[0] - cu, a[1] - cv, z, b[0] - cu, b[1] - cv, z, c[0] - cu, c[1] - cv, z); };
  const set = new Set(cells);
  for (const ci of cells) {
    const p = P.cells[ci].poly;
    for (let i = 1; i < p.length - 1; i++) { tri(p[0], p[i], p[i + 1], h); tri(p[0], p[i + 1], p[i], -h); }
    // the rim: the edges the group does not share with itself
    const C = P.cells[ci];
    for (let i = 0; i < C.edges.length; i++) {
      if (C.edges[i] < 0) continue;
      const E = P.edges[C.edges[i]];
      const other = E.c0 === ci ? E.c1 : E.c0;
      if (other >= 0 && set.has(other)) continue;
      const a = p[i], b = p[(i + 1) % p.length];
      pos.push(a[0] - cu, a[1] - cv, h, b[0] - cu, b[1] - cv, h, b[0] - cu, b[1] - cv, -h);
      pos.push(a[0] - cu, a[1] - cv, h, b[0] - cu, b[1] - cv, -h, a[0] - cu, a[1] - cv, -h);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return { geo: g, cu, cv, area: A };
}

export { cellAt, distOutline, inConvex, polyArea };
