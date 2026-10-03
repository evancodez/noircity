import * as THREE from 'three';
import { NODES, WAYS, DOOR_WAYS, hisNames } from '../../stages/backlot/plan.js';

// The course of the foot chase as a graph (lane C6): the ways through the
// backlot (stages/backlot/plan.js NODES, WAYS), and how far any point on them
// is from the gate onto Pell Lane along the shortest way on. The gap between
// us is the difference: a man in the lane whose door is locked counts the
// way back out of it; a man on the roofs counts the roofs' way.
//   const C = new Course({ locked: 'W' | 'E' | null })
//   C.dist(p)            the way on from p (a Vector3, y the feet) to the gate
//   C.near(p)            { edge, f, lateral } the way p is on
//   C.path(names)        a polyline { pts, s, len } through the named nodes
//   C.his(lane, over)    his way (to his car's door)
const GOAL = 'gate';
const Y_W = 2.0;          // a metre up counts as two across (the roofs over the row)

export class Course {
  constructor({ locked = null } = {}) {
    this.nodes = new Map(Object.entries(NODES).map(([k, v]) => [k, new THREE.Vector3(v[0], v[1], v[2])]));
    this.edges = [];
    const shut = locked ? DOOR_WAYS[locked] : null;
    const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
    const seen = new Set();
    for (const W of WAYS) {
      // ([C6 3rd] a way may be { names, w }: its metres weighed by w)
      const way = Array.isArray(W) ? W : W.names, wgt = Array.isArray(W) ? 1 : (W.w ?? 1);
      for (let i = 0; i < way.length - 1; i++) {
        const a = way[i], b = way[i + 1];
        if (shut && ((a === shut[0] && b === shut[1]) || (a === shut[1] && b === shut[0]))) continue;
        const k = key(a, b);
        if (seen.has(k)) continue;
        seen.add(k);
        const A = this.nodes.get(a), B = this.nodes.get(b);
        this.edges.push({ a, b, A, B, L: A.distanceTo(B) * wgt });
      }
    }
    // the way on from every node (Dijkstra from the gate)
    const D = new Map([...this.nodes.keys()].map((k) => [k, Infinity]));
    D.set(GOAL, 0);
    const todo = new Set(this.nodes.keys());
    while (todo.size) {
      let u = null;
      for (const k of todo) if (u == null || D.get(k) < D.get(u)) u = k;
      todo.delete(u);
      if (!Number.isFinite(D.get(u))) break;
      for (const e of this.edges) {
        const v = e.a === u ? e.b : e.b === u ? e.a : null;
        if (v == null || !todo.has(v)) continue;
        const nd = D.get(u) + e.L;
        if (nd < D.get(v)) D.set(v, nd);
      }
    }
    // (past the gate, on Pell Lane: negative - beyond the goal)
    this.D = D;
  }

  // the way p is on: the edge nearest it (a metre up weighs two across)
  near(p) {
    let best = null;
    for (const e of this.edges) {
      const ax = e.A.x, ay = e.A.y, az = e.A.z;
      const tx = e.B.x - ax, ty = e.B.y - ay, tz = e.B.z - az;
      const L2 = tx * tx + ty * ty + tz * tz || 1e-6;
      // (the fraction along it, by the ground plan; the height compared after)
      const Lxz2 = tx * tx + tz * tz || 1e-6;
      const f = Math.max(0, Math.min(1, ((p.x - ax) * tx + (p.z - az) * tz) / Lxz2));
      const qx = ax + tx * f, qy = ay + ty * f, qz = az + tz * f;
      const lat = Math.hypot(p.x - qx, p.z - qz, (p.y - qy) * Y_W);
      if (!best || lat < best.lateral) best = { edge: e, f, lateral: lat };
      void L2;
    }
    return best;
  }

  // the way on to the gate from p
  dist(p) {
    const n = this.near(p);
    if (!n) return 0;
    const e = n.edge, Da = this.D.get(e.a), Db = this.D.get(e.b);
    return Math.min(n.f * e.L + Da, (1 - n.f) * e.L + Db);
  }

  path(names) {
    const pts = names.map((k) => { const v = this.nodes.get(k); if (!v) throw new Error('course: no node ' + k); return v.clone(); });
    const s = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    return { names, pts, s, len: s[s.length - 1] };
  }

  his(lane, over) { return this.path(hisNames(lane, over)); }
}

// a point along a path at distance s (by the ground plan; y interpolated)
export function pathAt(P, s, out = new THREE.Vector3()) {
  const { pts, s: S } = P;
  s = Math.max(0, Math.min(P.len, s));
  let i = 0;
  while (i < pts.length - 2 && S[i + 1] < s) i++;
  const k = (s - S[i]) / Math.max(1e-6, S[i + 1] - S[i]);
  return out.lerpVectors(pts[i], pts[i + 1], k);
}
// the heading (a figure's: it faces (sin h, cos h)) at s, looking ahead
export function pathHeading(P, s, ahead = 1.6) {
  const a = pathAt(P, s - ahead * 0.3), b = pathAt(P, s + ahead);
  return Math.atan2(b.x - a.x, b.z - a.z);
}
// the path distance nearest (x, z), searched near `hint`
export function project(P, x, z, hint = 0, span = 30) {
  const { pts, s: S } = P;
  let best = hint, bd = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    if (S[i + 1] < hint - span || S[i] > hint + span) continue;
    const a = pts[i], b = pts[i + 1];
    const tx = b.x - a.x, tz = b.z - a.z, L2 = tx * tx + tz * tz || 1e-6;
    const k = Math.max(0, Math.min(1, ((x - a.x) * tx + (z - a.z) * tz) / L2));
    const d = Math.hypot(x - (a.x + tx * k), z - (a.z + tz * k));
    if (d < bd) { bd = d; best = S[i] + Math.sqrt(L2) * k; }
  }
  return { s: best, d: bd };
}
// the turn at each inner point of a path (radians, signed)
export function corners(P) {
  const out = [];
  const { pts, s: S } = P;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = Math.atan2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z), b = Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    out.push({ s: S[i], turn: d, i });
  }
  return out;
}
