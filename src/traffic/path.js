// Paths on NOIR CITY's road graph (lane O2): a list of junctions made into
// the line a car drives - each street's right lane, the corners rounded (a
// right turn tight, a left wider, straight on none), sampled every metre with
// the speed each point allows (its corner against a lateral grip, the brake
// before it, the street's own limit). The same path object the base's Pilot
// (vehicles/pilot.js) follows.
//   lanePath(graph, ids, { from, to, vmax, aLat, aBrake, lane, speeds }) -> path
//   path.pts [{ x, z, s, v }], path.len, path.ids, path.nodeS { id: s },
//   path.nodes [{ id, s, edgeIn }] (the junctions along it, and the street it
//   comes in by), path.at(s, out), path.nearest(x, z, i, span), path.nearestAll(x, z)
//   walk(graph, from, prev, n, rng, ok) -> [ids] a random way on (never back,
//   never into a dead end or onto the bridge unless ok says so)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// a street's limit by its class (m/s): the avenue and the el's streets 13
// (47 km/h), a wide street 12, a street 10.5, a lane 7
export const LIMIT = { avenue: 13, el: 12.5, wide: 12, street: 10.5, lane: 7 };

const other = (e, id) => (e.a === id ? e.b : e.a);
export function edgeOf(graph, a, b) { const n = graph.nodes.get(a); return n ? n.edges.find((e) => other(e, a) === b) || null : null; }

// the way a car may take from a junction (not back the way it came, not into
// a dead end, not the bridge: it is up)
export const okEdge = (e, to) => !e.bridge && !to.deadEnd;
// (toward: { x, z } - the way on bends toward it more often than not: the
// traffic comes past where the eye is)
export function walk(graph, from, prev, n, rng, ok = okEdge, toward = null) {
  const ids = prev != null ? [prev, from] : [from];
  let p = prev, cur = from;
  for (let k = 0; k < n; k++) {
    const N = graph.nodes.get(cur);
    let opts = N.edges.filter((e) => other(e, cur) !== p && ok(e, graph.nodes.get(other(e, cur))));
    if (!opts.length) opts = N.edges.filter((e) => other(e, cur) !== p);
    if (!opts.length) break;
    // (straight on a little more often than a turn: a street is driven down)
    let pick = opts[Math.floor(rng.next() * opts.length) % opts.length];
    if (toward && opts.length > 1 && rng.next() < 0.55) {
      let bd = Infinity;
      for (const e of opts) { const O = graph.nodes.get(other(e, cur)); const d = Math.hypot(O.x - toward.x, O.z - toward.z); if (d < bd) { bd = d; pick = e; } }
    }
    if (p != null && opts.length > 1 && rng.next() < 0.35) {
      const P = graph.nodes.get(p), C = N;
      const ix = C.x - P.x, iz = C.z - P.z, il = Math.hypot(ix, iz) || 1;
      let best = -2;
      for (const e of opts) { const O = graph.nodes.get(other(e, cur)); const ox = O.x - C.x, oz = O.z - C.z, ol = Math.hypot(ox, oz) || 1; const d = (ix * ox + iz * oz) / (il * ol); if (d > best) { best = d; pick = e; } }
    }
    const nx = other(pick, cur);
    ids.push(nx); p = cur; cur = nx;
  }
  return ids;
}

// an edge's lane line driven from node a toward b (the lane's offset to the right)
function laneLine(graph, a, b, lane = 0, offOver = null) {
  const e = edgeOf(graph, a, b);
  if (!e) throw new Error(`traffic path: no street from ${a} to ${b}`);
  const fwd = e.a === a;
  const ax = fwd ? e.ax : e.bx, az = fwd ? e.az : e.bz, bx = fwd ? e.bx : e.ax, bz = fwd ? e.bz : e.az;
  const dx = (bx - ax) / e.len, dz = (bz - az) / e.len;
  const off = offOver != null ? offOver : e.lanes[Math.min(lane, e.lanes.length - 1)];
  // (right of a heading (dx, dz) in x-z, z south: (-dz, dx))
  return { pts: [[ax - dz * off, az + dx * off], [bx - dz * off, bz + dx * off]], e };
}
function meet(a0, a1, b0, b1) {
  const dx1 = a1[0] - a0[0], dz1 = a1[1] - a0[1], dx2 = b1[0] - b0[0], dz2 = b1[1] - b0[1];
  const den = dx1 * dz2 - dz1 * dx2;
  if (Math.abs(den) < 1e-6) return [(a1[0] + b0[0]) / 2, (a1[1] + b0[1]) / 2];
  const t = ((b0[0] - a0[0]) * dz2 - (b0[1] - a0[1]) * dx2) / den;
  return [a0[0] + dx1 * t, a0[1] + dz1 * t];
}

export function lanePath(graph, ids, { from = null, to = null, vmax = 13, aLat = 3.6, aBrake = 3.5, lane = 0, rRight = 6.5, rLeft = 10, pace = 1, off = null } = {}) {
  const legs = [];
  for (let i = 0; i + 1 < ids.length; i++) legs.push(laneLine(graph, ids[i], ids[i + 1], lane, off));
  const poly = [];   // [x, z, limit]
  if (from) poly.push([from.x, from.z, LIMIT[legs[0].e.cls] || 10]);
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i].pts, lim = (LIMIT[legs[i].e.cls] || 10) * pace;
    if (i + 1 < legs.length) {
      const M = legs[i + 1].pts;
      const din = [L[1][0] - L[0][0], L[1][1] - L[0][1]], dout = [M[1][0] - M[0][0], M[1][1] - M[0][1]];
      const ln = Math.hypot(...din), lo = Math.hypot(...dout);
      din[0] /= ln; din[1] /= ln; dout[0] /= lo; dout[1] /= lo;
      const cross = din[0] * dout[1] - din[1] * dout[0], dot = din[0] * dout[0] + din[1] * dout[1];
      const c = meet(L[0], L[1], M[0], M[1]);
      if (i === 0) poly.push([L[0][0], L[0][1], lim]);
      if (dot > 0.985) { poly.push([c[0], c[1], lim]); legs[i + 1].pts = [c, M[1]]; continue; }
      // (z south: a right turn is a positive cross in x-z)
      const r = Math.min(cross > 0 ? rRight : rLeft, ln * 0.45, lo * 0.45);
      const p0 = [c[0] - din[0] * r, c[1] - din[1] * r], p2 = [c[0] + dout[0] * r, c[1] + dout[1] * r];
      poly.push([p0[0], p0[1], lim]);
      for (let k = 1; k <= 8; k++) { const u = k / 8, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u; poly.push([a * p0[0] + b * c[0] + d * p2[0], a * p0[1] + b * c[1] + d * p2[1], lim]); }
      legs[i + 1].pts = [p2, M[1]];
    } else {
      if (i === 0) poly.push([L[0][0], L[0][1], lim]);
      poly.push([L[1][0], L[1][1], lim]);
    }
  }
  if (to) poly.push([to.x, to.z, poly[poly.length - 1][2]]);
  return samplePath(poly, { vmax, aLat, aBrake, ids, graph, legs });
}

export function samplePath(poly, { vmax = 13, aLat = 3.6, aBrake = 3.5, ids = [], graph = null } = {}) {
  const pts = [];
  let s = 0;
  pts.push({ x: poly[0][0], z: poly[0][1], s: 0, lim: poly[0][2] ?? vmax });
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    let d = 1 - (s - Math.floor(s));
    for (; d <= L; d += 1) pts.push({ x: a[0] + (b[0] - a[0]) * d / L, z: a[1] + (b[1] - a[1]) * d / L, s: s + d, lim: b[2] ?? vmax });
    s += L;
  }
  const last = poly[poly.length - 1];
  if (Math.hypot(last[0] - pts[pts.length - 1].x, last[1] - pts[pts.length - 1].z) > 0.2) pts.push({ x: last[0], z: last[1], s, lim: last[2] ?? vmax });
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 3)], b = pts[i], c = pts[Math.min(n - 1, i + 3)];
    const h1 = Math.atan2(b.z - a.z, b.x - a.x), h2 = Math.atan2(c.z - b.z, c.x - b.x);
    const dh = Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1));
    const L = Math.max(1, c.s - a.s);
    b.k = (Math.abs(dh) / L) * 2;
    b.v = Math.min(vmax, b.lim, Math.sqrt(aLat / Math.max(b.k, 1e-4)));
  }
  for (let i = n - 2; i >= 0; i--) pts[i].v = Math.min(pts[i].v, Math.sqrt(pts[i + 1].v ** 2 + 2 * aBrake * Math.max(0.01, pts[i + 1].s - pts[i].s)));
  // the junctions along it: where each is, and the street it is come to by
  const nodeS = {}, nodes = [];
  if (graph) {
    let i0 = 0;
    for (let k = 0; k < ids.length; k++) {
      const N = graph.nodes.get(ids[k]);
      if (!N) continue;
      let bi = i0, bd = Infinity;
      for (let i = i0; i < n; i++) { const d = (pts[i].x - N.x) ** 2 + (pts[i].z - N.z) ** 2; if (d < bd) { bd = d; bi = i; } if (d > bd + 400 && bd < 200) break; }
      nodeS[ids[k]] = pts[bi].s;
      nodes.push({ id: ids[k], s: pts[bi].s, node: N, edgeIn: k > 0 ? edgeOf(graph, ids[k - 1], ids[k]) : null, edgeOut: k + 1 < ids.length ? edgeOf(graph, ids[k], ids[k + 1]) : null });
      i0 = bi;
    }
  }
  const path = {
    pts, len: pts[n - 1].s, nodeS, nodes, ids,
    at(s, out = {}) {
      s = clamp(s, 0, path.len);
      let i = Math.min(n - 2, Math.max(0, Math.floor(s)));
      while (i < n - 2 && pts[i + 1].s < s) i++;
      while (i > 0 && pts[i].s > s) i--;
      const a = pts[i], b = pts[Math.min(n - 1, i + 1)];
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
