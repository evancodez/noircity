import { GRAPH, edgeBetween } from './plan.js';

// Paths through the city for its drivers (his car, the traffic, the bots):
// a list of junctions (plan.GRAPH's node ids) made into one line a car can
// follow - each street's lane (to the right of the way it is driven), the
// corners rounded (a right turn tight, a left wider, straight on none) -
// sampled every metre with the speed each point allows (the corner's
// curvature against a lateral grip, the braking before it).
//   buildPath(ids, { from: {x, z}, vmax, aLat, aBrake }) -> Path
//   path.pts [{ x, z, s, v, k }], path.len, path.nodeS { id: s }
//   path.at(s, out) -> { x, z, fx, fz, v }   path.nearest(x, z, hintI) -> i
//   route(fromId, toId) -> [ids] (the shortest by the streets)

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// an edge's line driven from node a (the lane offset to the right)
function laneLine(a, b, laneK = 1) {
  const e = edgeBetween(a, b);
  if (!e) throw new Error(`city route: no street from ${a} to ${b}`);
  const pts = e.a === a ? e.pts.map((p) => [p[0], p[1]]) : e.pts.map((p) => [p[0], p[1]]).reverse();
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let fx = q[0] - o[0], fz = q[1] - o[1];
    const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    // (right of a heading (fx, fz) is (-fz, fx))
    out.push([p[0] - fz * e.lane * laneK, p[1] + fx * e.lane * laneK]);
  }
  return { pts: out, e };
}

// the two lines' meeting point (the last leg of one, the first of the next)
function meet(a0, a1, b0, b1) {
  const dx1 = a1[0] - a0[0], dz1 = a1[1] - a0[1], dx2 = b1[0] - b0[0], dz2 = b1[1] - b0[1];
  const den = dx1 * dz2 - dz1 * dx2;
  if (Math.abs(den) < 1e-6) return [(a1[0] + b0[0]) / 2, (a1[1] + b0[1]) / 2];
  const t = ((b0[0] - a0[0]) * dz2 - (b0[1] - a0[1]) * dx2) / den;
  return [a0[0] + dx1 * t, a0[1] + dz1 * t];
}

export function buildPath(ids, { from = null, vmax = 16, aLat = 6.0, aBrake = 5.5, rRight = 7, rLeft = 11, end = null, laneK = 1 } = {}) {
  const legs = [];
  for (let i = 0; i + 1 < ids.length; i++) legs.push(laneLine(ids[i], ids[i + 1], laneK));
  // the corners: each leg trimmed back from the junction, a curve between
  const poly = [];
  if (from) poly.push([from.x, from.z]);
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i].pts;
    let start = L.slice();
    if (i > 0) start = start.slice(1);
    if (i + 1 < legs.length) {
      const M = legs[i + 1].pts;
      const a0 = L[L.length - 2], a1 = L[L.length - 1], b0 = M[0], b1 = M[1];
      const din = [a1[0] - a0[0], a1[1] - a0[1]], dout = [b1[0] - b0[0], b1[1] - b0[1]];
      const ln = Math.hypot(...din), lo = Math.hypot(...dout);
      din[0] /= ln; din[1] /= ln; dout[0] /= lo; dout[1] /= lo;
      const cross = din[0] * dout[1] - din[1] * dout[0], dot = din[0] * dout[0] + din[1] * dout[1];
      const c = meet(a0, a1, b0, b1);
      if (dot > 0.985) { for (const p of start.slice(0, -1)) poly.push(p); poly.push(c); legs[i + 1].pts = [c, ...M.slice(1)]; continue; }
      // (a right turn is tight; a left crosses the other lane, wider; the
      // square and the alleys' corners as they come)
      const r = Math.min(cross > 0 ? rRight : rLeft, ln * 0.45, lo * 0.45);
      const p0 = [c[0] - din[0] * r, c[1] - din[1] * r], p2 = [c[0] + dout[0] * r, c[1] + dout[1] * r];
      // the leg up to p0
      for (let k = 0; k < start.length - 1; k++) {
        const p = start[k];
        if ((p[0] - p0[0]) * din[0] + (p[1] - p0[1]) * din[1] >= 0) break;
        poly.push(p);
      }
      poly.push(p0);
      for (let k = 1; k <= 8; k++) { const u = k / 8, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u; poly.push([a * p0[0] + b * c[0] + d * p2[0], a * p0[1] + b * c[1] + d * p2[1]]); }
      legs[i + 1].pts = [p2, ...M.slice(1).filter((p) => (p[0] - p2[0]) * dout[0] + (p[1] - p2[1]) * dout[1] > 0.5)];
      if (!legs[i + 1].pts.length || legs[i + 1].pts.length < 2) legs[i + 1].pts = [p2, M[M.length - 1]];
    } else for (const p of start) poly.push(p);
  }
  if (end) poly.push([end.x, end.z]);
  return samplePath(poly, { vmax, aLat, aBrake, ids });
}

// a polyline sampled every metre, its curvature and the speed it allows
export function samplePath(poly, { vmax = 16, aLat = 6, aBrake = 5.5, ids = [] } = {}) {
  const pts = [];
  let s = 0;
  pts.push({ x: poly[0][0], z: poly[0][1], s: 0 });
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    let d = 1 - (s - Math.floor(s));
    for (; d <= L; d += 1) { pts.push({ x: a[0] + (b[0] - a[0]) * d / L, z: a[1] + (b[1] - a[1]) * d / L, s: s + d }); }
    s += L;
  }
  const last = poly[poly.length - 1];
  if (Math.hypot(last[0] - pts[pts.length - 1].x, last[1] - pts[pts.length - 1].z) > 0.2) pts.push({ x: last[0], z: last[1], s });
  const n = pts.length;
  // curvature over a span of +-3 m (the turn's angle over its length)
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 3)], b = pts[i], c = pts[Math.min(n - 1, i + 3)];
    const h1 = Math.atan2(b.z - a.z, b.x - a.x), h2 = Math.atan2(c.z - b.z, c.x - b.x);
    const dh = Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1));
    const L = Math.max(1, c.s - a.s);
    b.k = Math.abs(dh) / L * 2;
    b.v = Math.min(vmax, Math.sqrt(aLat / Math.max(b.k, 1e-4)));
  }
  // (braking ahead of a corner)
  for (let i = n - 2; i >= 0; i--) pts[i].v = Math.min(pts[i].v, Math.sqrt(pts[i + 1].v ** 2 + 2 * aBrake * Math.max(0.01, pts[i + 1].s - pts[i].s)));
  // the junctions' places along it
  const nodeS = {};
  for (const id of ids) {
    const N = GRAPH.nodes.get(id);
    if (!N) continue;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = (pts[i].x - N.x) ** 2 + (pts[i].z - N.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    nodeS[id] = pts[bi].s;
  }
  const path = {
    pts, len: pts[n - 1].s, nodeS, ids,
    at(s, out = {}) {
      s = clamp(s, 0, path.len);
      let i = Math.min(n - 2, Math.max(0, Math.floor(s)));
      while (i < n - 2 && pts[i + 1].s < s) i++;
      while (i > 0 && pts[i].s > s) i--;
      const a = pts[i], b = pts[i + 1];
      const u = clamp((s - a.s) / Math.max(1e-6, b.s - a.s), 0, 1);
      out.x = a.x + (b.x - a.x) * u; out.z = a.z + (b.z - a.z) * u;
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      out.fx = (b.x - a.x) / l; out.fz = (b.z - a.z) / l;
      out.v = a.v + (b.v - a.v) * u; out.i = i;
      return out;
    },
    nearest(x, z, hint = 0, span = 40) {
      let bi = hint, bd = Infinity;
      const i0 = Math.max(0, hint - 6), i1 = Math.min(n - 1, hint + span);
      for (let i = i0; i <= i1; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
      return bi;
    },
    nearestAll(x, z) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < n; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
      return bi;
    },
  };
  return path;
}

// the shortest way by the streets (Dijkstra over the junctions)
export function route(fromId, toId, { avoid = null } = {}) {
  const dist = new Map([[fromId, 0]]), prev = new Map(), done = new Set();
  const open = [fromId];
  while (open.length) {
    open.sort((a, b) => dist.get(a) - dist.get(b));
    const u = open.shift();
    if (u === toId) break;
    if (done.has(u)) continue;
    done.add(u);
    for (const e of GRAPH.nodes.get(u).edges) {
      if (avoid && avoid(e)) continue;
      const v = e.a === u ? e.b : e.a;
      const d = dist.get(u) + e.len + (e.alley || e.square ? 40 : 0);
      if (d < (dist.get(v) ?? Infinity)) { dist.set(v, d); prev.set(v, u); open.push(v); }
    }
  }
  if (!dist.has(toId)) return null;
  const out = [toId];
  while (out[0] !== fromId) out.unshift(prev.get(out[0]));
  return out;
}

// the junction nearest a point
export function nearestNode(x, z) {
  let best = null, bd = Infinity;
  for (const N of GRAPH.nodes.values()) { const d = (N.x - x) ** 2 + (N.z - z) ** 2; if (d < bd) { bd = d; best = N; } }
  return best;
}
