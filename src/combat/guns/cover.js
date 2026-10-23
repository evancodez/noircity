import * as THREE from 'three';
import { COVER_TAGS } from '../../guns/Covers.js';

// [O4] Cover from the world (docs/briefs/O4_COMBAT.md §2): not a place's
// list but whatever is solid - a car, a pillar, a crate, a wall's end, a
// doorway's jamb - read from the stage's colliders as they stand, tagged or
// not (the city's generator, lane O1, gives untagged boxes). Two uses:
//   worldCoverPoints(game, nav, area)   the places a gunman can hold behind
//        anything solid in `area` ({ x0, x1, z0, z1 }; null: 30 m round me):
//        a man's width off each face, every 0.75 m, on free ground; a long
//        wall gives its ends and a point every 1.5 m (the gun kit's Covers
//        takes them when an encounter begins with { world: true })
//   coverFor(game, at, from, opts)      the nearest place near `at` that hides
//        a man from `from` (a point, an eye): { x, z, kind: 'low' | 'tall', d }
//        or null - for any system that sends a man to cover (the police, the
//        gangs: lane O3), and for me (where to get down)
// What is solid is what the colliders are; whether it hides a man is asked
// of the rays at the moment (low: it hides him down, he rises over it; tall:
// it hides him standing, he steps out of it): the gun kit's own rule.
const OFF = 0.55, STEP = 0.75;
// (not cover: a door's leaf, the dead, a man, a seat, a stool, a lamp's thin post)
const SKIP = new Set(['door', 'corpse', 'hood', 'stool', 'chair', 'cafeTable', 'lamp', 'bounds', 'water']);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = V(0, 0, 0), _b = V(0, 0, 0);

function inArea(A, x, z, pad = 0) { return !A || (x >= A.x0 - pad && x <= A.x1 + pad && z >= A.z0 - pad && z <= A.z1 + pad); }
function aroundMe(G, r = 30) { const e = G.eye; return { x0: e.x - r, x1: e.x + r, z0: e.z - r, z1: e.z + r }; }

export function worldCoverPoints(G, nav, area = null, { tagged = false } = {}) {
  const S = G.stage, C = S.colliders, A = area || aroundMe(G);
  const P = [];
  for (const b of C.boxes) {
    if (SKIP.has(b.tag) || (!tagged && COVER_TAGS.has(b.tag))) continue;
    if (!inArea(A, b.cx, b.cz, Math.max(b.hx, b.hz))) continue;
    // (too thin to hide behind: a rail, a sign's post)
    if (Math.min(b.hx, b.hz) < 0.08 && Math.max(b.hx, b.hz) < 0.3) continue;
    for (const [ax, sgn] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
      const half = ax === 0 ? b.hz : b.hx, out = ax === 0 ? b.hx : b.hz;
      const long = 2 * half > 6;
      const step = long ? STEP * 2 : STEP;
      const n = Math.max(1, Math.round((2 * half) / step));
      for (let i = 0; i < n; i++) {
        const s = n === 1 ? 0 : -half + (2 * half) * (i + 0.5) / n;
        const lx = ax === 0 ? sgn * (out + OFF) : s, lz = ax === 0 ? s : sgn * (out + OFF);
        const x = b.cx + lx * b.c + lz * b.s, z = b.cz - lx * b.s + lz * b.c;
        if (!inArea(A, x, z) || !nav.free(x, z)) continue;
        const nlx = ax === 0 ? sgn : 0, nlz = ax === 0 ? 0 : sgn;
        P.push({ x, z, nx: nlx * b.c + nlz * b.s, nz: -nlx * b.s + nlz * b.c, obs: b, tag: b.tag || 'world', taken: null, world: true });
      }
      // a long face's ends: a man stands at the corner, the wall between us (a jamb, a wall's end)
      if (long) for (const e of [-1, 1]) {
        const s = e * (half - 0.25);
        const lx = ax === 0 ? sgn * (out + OFF) : s, lz = ax === 0 ? s : sgn * (out + OFF);
        const x = b.cx + lx * b.c + lz * b.s, z = b.cz - lx * b.s + lz * b.c;
        if (!inArea(A, x, z) || !nav.free(x, z)) continue;
        const nlx = ax === 0 ? sgn : 0, nlz = ax === 0 ? 0 : sgn;
        P.push({ x, z, nx: nlx * b.c + nlz * b.s, nz: -nlx * b.s + nlz * b.c, obs: b, tag: 'corner', corner: true, taken: null, world: true });
      }
    }
  }
  for (const c of C.circles) {
    if (SKIP.has(c.tag) || (!tagged && COVER_TAGS.has(c.tag)) || c.r < 0.22) continue;
    if (!inArea(A, c.x, c.z, c.r)) continue;
    const n = c.r > 0.35 ? 8 : 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.2;
      const nx = Math.cos(a), nz = Math.sin(a);
      const x = c.x + nx * (c.r + OFF), z = c.z + nz * (c.r + OFF);
      if (!inArea(A, x, z) || !nav.free(x, z)) continue;
      P.push({ x, z, nx, nz, obs: c, tag: c.tag || 'world', taken: null, world: true });
    }
  }
  return P;
}

// the nearest place near `at` that hides a man from `from` (an eye): the gun
// kit's covers when an encounter is on, else the world's, read now
export function coverFor(G, at, from, { r = 8, crouched = true } = {}) {
  const K = G.guns, S = G.stage;
  let pts = K && K.active && K.covers ? K.covers.points : null;
  if (!pts) {
    const nav = S.nav;
    if (!nav || !nav.free) return null;
    pts = worldCoverPoints(G, nav, { x0: at.x - r, x1: at.x + r, z0: at.z - r, z1: at.z + r }, { tagged: true });
  }
  let best = null;
  for (const p of pts) {
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    if (d > r || (best && d >= best.d)) continue;
    // (the obstacle between: the point on its far side from the threat)
    const tx = from.x - p.x, tz = from.z - p.z, tl = Math.hypot(tx, tz) || 1;
    if ((p.nx * tx + p.nz * tz) / tl > -0.2) continue;
    const y = S.surfaceY(p.x, p.z);
    const eyeLow = _a.set(p.x, y + 0.98, p.z), eyeUp = _b.set(p.x, y + 1.62, p.z);
    const see = (q) => { const d2 = V(from.x - q.x, (from.y ?? 1.6) - q.y, from.z - q.z); const L = d2.length(); d2.divideScalar(L); return !G.rays.raycast(q, d2, L - 0.3, { anyHit: true }); };
    if (crouched && see(eyeLow)) continue;
    const kind = see(eyeUp) ? 'low' : 'tall';
    best = { x: p.x, z: p.z, kind, d, tag: p.tag };
  }
  return best;
}
