import { RNG } from '../util/rng.js';
import {
  PAVE, WATER_Y, CITY, EDGE, CLS, NS, EW, NS_EXTRA, EW_EXTRA, BROADWAY, RIVER, RIVER_LINE, QUAY_OFF, PIERS, SLIPS, BRIDGE,
  SPECIAL, CLOCK, EL, PLACES, districtAt,
} from './plan.js';

// NOIR CITY: the generator (lane O1). The plan (./plan.js) in, plain numbers
// out: no meshes, no THREE, so a headless tool can build the same city (the
// walls, the kerbs, the lots, the lamps) without a browser. Deterministic:
// every cell draws from an RNG of its own (its grid index hashed), so a
// change in one corner of the plan never moves a building in another.
//
//   const C = generate();            (once: ~20 ms; cached by getCity())
//   C.xs, C.zs                       the grid's lines (sorted)
//   C.cells[]                        { i, j, xa, xb, za, zb, district, special, sides: { w, e, n, s }, polys }
//   C.paves[]                        raised ground: { pts: [[x, z]...] (convex, CCW), kerb: [edge flags], cell }
//   C.lots[]                         buildings: { kind: 'rect' | 'poly', ..., h, floors, kit, faces, place, chunk }
//   C.walls[]                        collision boxes { cx, cz, hx, hz, angle, tag }
//   C.posts[]                        circles { x, z, r, tag }
//   C.lamps[]                        { x, z, yaw (the arm's heading), kind: 'post' | 'wall' | 'park', chunk }
//   C.props[]                        street furniture { kind, x, z, yaw, chunk }
//   C.bays[]                         parking bays { x, z, yaw, street }
//   C.streets[]                      road segments { id, name, cls, hw, p, a: [x, z], b: [x, z], el?, tram?, alley? }
//   C.groundAt(x, z)                 the walking surface: 0 road, PAVE pavement, WATER_Y water, a slipway's slope
//   C.inWater(x, z)                  beyond the quay's edge (not on a pier or the bridge)
//   C.chunkOf(x, z) -> 'ci,cj'       the streaming chunk (CHUNK m) a point is in
export const CHUNK = 96;
const EPS = 1e-6;

// ---- small geometry -------------------------------------------------------------------------------
const hash = (a, b, c = 0) => {
  let h = Math.imul(a + 0x9E37, 0x85EBCA6B) ^ Math.imul(b + 0x7F4A, 0xC2B2AE35) ^ Math.imul(c + 0x165667B1, 0x27D4EB2F);
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12;
  return h >>> 0;
};
// keep the part of a convex polygon where a*x + b*z + c >= 0
export function clipPoly(P, a, b, c) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    const fp = a * p[0] + b * p[1] + c, fq = a * q[0] + b * q[1] + c;
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
export function polyArea(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
// signed distance inside a convex polygon (+ inside): the least over its edges
export function insideDist(P, x, z) {
  let d = Infinity;
  const s = polyArea(P) >= 0 ? 1 : -1;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    const ex = q[0] - p[0], ez = q[1] - p[1], L = Math.hypot(ex, ez) || 1;
    // (inward normal of a CCW polygon in x-z with z south: (-ez, ex) * s ... computed by the sign of the area)
    const nx = -ez / L * s, nz = ex / L * s;
    const v = (x - p[0]) * nx + (z - p[1]) * nz;
    if (v < d) d = v;
  }
  return d;
}
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- the streets as lines ----------------------------------------------------------------------------
function covers(segs, a, b) { return segs.some(([s0, s1]) => s0 <= a + EPS && s1 >= b - EPS); }
const nsAt = (x, za, zb) => NS.find((L) => Math.abs(L.x - x) < EPS && covers(L.segs, za, zb)) || null;
const ewAt = (z, xa, xb) => EW.find((L) => Math.abs(L.z - z) < EPS && covers(L.segs, xa, xb)) || null;
const cls = (L) => ({ ...CLS[L.cls], ...(L.hw ? { hw: L.hw } : {}), ...(L.p ? { p: L.p } : {}) });

// Broadway's signed distance (+ south-east of it) and its extent along itself
const BW = (() => {
  const [ax, az] = BROADWAY.a, [bx, bz] = BROADWAY.b;
  const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
  // the normal toward the south-east side (+x +z)
  let nx = -dz, nz = dx; if (nx + nz < 0) { nx = -nx; nz = -nz; }
  return { ax, az, bx, bz, L, dx, dz, nx, nz, ...CLS[BROADWAY.cls] };
})();
export const broadwayDist = (x, z) => (x - BW.ax) * BW.nx + (z - BW.az) * BW.nz;
const broadwayAlong = (x, z) => (x - BW.ax) * BW.dx + (z - BW.az) * BW.dz;

// the river road: each segment's half-plane toward the city ((0, 0) is in it)
const RV = (() => {
  const segs = [];
  for (let i = 0; i + 1 < RIVER_LINE.length; i++) {
    const [ax, az] = RIVER_LINE[i], [bx, bz] = RIVER_LINE[i + 1];
    const L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    let nx = -dz, nz = dx;
    if ((0 - ax) * nx + (0 - az) * nz < 0) { nx = -nx; nz = -nz; }
    segs.push({ ax, az, bx, bz, L, dx, dz, nx, nz });
  }
  return segs;
})();
// distance from the river road's centre line, + on the city's side
export function riverDist(x, z) {
  let best = Infinity, sd = 0;
  for (const s of RV) {
    const u = Math.max(0, Math.min(s.L, (x - s.ax) * s.dx + (z - s.az) * s.dz));
    const px = s.ax + s.dx * u, pz = s.az + s.dz * u;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; sd = (x - px) * s.nx + (z - pz) * s.nz >= 0 ? d : -d; }
  }
  return sd;
}
// the river road's frame at a point near it: the nearest segment
export function riverNearest(x, z) {
  let best = Infinity, out = null;
  for (const s of RV) {
    const u = Math.max(0, Math.min(s.L, (x - s.ax) * s.dx + (z - s.az) * s.dz));
    const px = s.ax + s.dx * u, pz = s.az + s.dz * u, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; out = { x: px, z: pz, dx: s.dx, dz: s.dz, nx: s.nx, nz: s.nz, d }; }
  }
  return out;
}
export const RIVER_SEGS = RV;

// the el's loop: its centre line as points (a rounded rectangle), closed
export const EL_LINE = (() => {
  const { x0, x1, z0, z1, R } = EL;
  const P = [];
  const arc = (cx, cz, a0) => { for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * (Math.PI / 2); P.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); } };
  // clockwise from the north-west corner: along Market St east, down the Bowery, Houston west, up Grand Ave
  arc(x0 + R, z0 + R, Math.PI);
  arc(x1 - R, z0 + R, -Math.PI / 2);
  arc(x1 - R, z1 - R, 0);
  arc(x0 + R, z1 - R, Math.PI / 2);
  return P;
})();
// distance from the el's line
export function elDist(x, z) {
  let best = Infinity;
  const P = EL_LINE;
  for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length];
    const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
    const d = Math.hypot(x - ax - ex * u, z - az - ez * u);
    if (d < best) best = d;
  }
  return best;
}

// ---- the generator -------------------------------------------------------------------------------------
let CACHE = null;
export function getCity() { return CACHE || (CACHE = generate()); }

export function generate() {
  const xs = [...new Set([...NS.map((l) => l.x), ...NS_EXTRA])].sort((a, b) => a - b);
  const zs = [...new Set([...EW.map((l) => l.z), ...EW_EXTRA])].sort((a, b) => a - b);
  const cells = [], paves = [], lots = [], walls = [], posts = [], lamps = [], props = [], bays = [], streets = [], alleys = [];
  const specialOf = (x, z) => SPECIAL.find((S) => x > S.rect[0] && x < S.rect[1] && z > S.rect[2] && z < S.rect[3]) || null;

  // ---- the streets' segments (between junctions: where another road meets this one) ------------
  const onSeg = (segs, v) => segs.some(([a, b]) => v >= a - EPS && v <= b + EPS);
  const diagAt = (x, z) => Math.abs(broadwayDist(x, z)) < 1e-6 && broadwayAlong(x, z) > -EPS && broadwayAlong(x, z) < BW.L + EPS;
  for (const L of NS) {
    const c = cls(L);
    const cuts = zs.filter((z) => onSeg(L.segs, z) && (L.segs.some(([a, b]) => Math.abs(z - a) < EPS || Math.abs(z - b) < EPS) || EW.some((E) => Math.abs(E.z - z) < EPS && onSeg(E.segs, L.x)) || diagAt(L.x, z)));
    for (let k = 0; k + 1 < cuts.length; k++) {
      const a = cuts[k], b = cuts[k + 1];
      if (!covers(L.segs, a, b)) continue;
      streets.push({ id: L.id, name: L.name, cls: L.cls, hw: c.hw, p: c.p, a: [L.x, a], b: [L.x, b], tram: !!L.tram, straight: !!L.straight,
        el: (L.x === EL.x0 || L.x === EL.x1) && a >= EL.z0 - EPS && b <= EL.z1 + EPS });
    }
  }
  for (const L of EW) {
    const c = cls(L);
    const cuts = xs.filter((x) => onSeg(L.segs, x) && (L.segs.some(([a, b]) => Math.abs(x - a) < EPS || Math.abs(x - b) < EPS) || NS.some((N) => Math.abs(N.x - x) < EPS && onSeg(N.segs, L.z)) || diagAt(x, L.z)));
    for (let k = 0; k + 1 < cuts.length; k++) {
      const a = cuts[k], b = cuts[k + 1];
      if (!covers(L.segs, a, b)) continue;
      streets.push({ id: L.id, name: L.name, cls: L.cls, hw: c.hw, p: c.p, a: [a, L.z], b: [b, L.z],
        el: (L.z === EL.z0 || L.z === EL.z1) && a >= EL.x0 - EPS && b <= EL.x1 + EPS });
    }
  }
  // Broadway: between the grid crossings on its line
  {
    const pts = [];
    for (const x of xs) { const z = BW.az + (x - BW.ax) * (BW.dz / BW.dx); if (zs.some((q) => Math.abs(q - z) < 1e-6) && broadwayAlong(x, z) > -EPS && broadwayAlong(x, z) < BW.L + EPS) pts.push([x, z]); }
    pts.sort((p, q) => p[0] - q[0]);
    for (let k = 0; k + 1 < pts.length; k++) streets.push({ id: 'broadway', name: BROADWAY.name, cls: BROADWAY.cls, hw: BW.hw, p: BW.p, a: pts[k], b: pts[k + 1], diag: true });
  }
  // the river road (its own line), cut where the streets meet it and the
  // bridge leaves it; between those, its bend's points
  {
    const meets = [];
    for (const L of NS) if (L.segs.some(([, b]) => Math.abs(b - RIVER.s) < EPS)) meets.push([L.x, RIVER.s]);
    for (const L of EW) if (L.segs.some(([, b]) => Math.abs(b - RIVER.e) < EPS)) meets.push([RIVER.e, L.z]);
    const along = (p) => {
      // (arc length along the line: north end 0)
      let acc = 0;
      for (const s of RV) {
        const u = (p[0] - s.ax) * s.dx + (p[1] - s.az) * s.dz;
        if (u >= -EPS && u <= s.L + EPS && Math.abs((p[0] - s.ax) * s.nx + (p[1] - s.az) * s.nz) < 0.01) return acc + u;
        acc += s.L;
      }
      return -1;
    };
    const keep = RIVER_LINE.map((p) => ({ p, s: along(p), meet: false }));
    for (const m of meets) { const s = along(m); if (s >= 0) keep.push({ p: m, s, meet: true }); }
    keep.sort((a, b) => a.s - b.s);
    // (the line's points between junctions are the bend's; on the straights only junctions cut it)
    const pts = keep.filter((k, i) => k.meet || i === 0 || i === keep.length - 1 || !(Math.abs(k.p[0] - RIVER.e) < EPS || Math.abs(k.p[1] - RIVER.s) < EPS) || (Math.abs(k.p[0] - RIVER.e) < EPS && Math.abs(k.p[1] - RIVER.bend.cz) < EPS) || (Math.abs(k.p[1] - RIVER.s) < EPS && Math.abs(k.p[0] - RIVER.bend.cx) < EPS));
    for (let i = 0; i + 1 < pts.length; i++) if (pts[i + 1].s - pts[i].s > 0.5) streets.push({ id: 'river', name: RIVER.name, cls: 'street', hw: RIVER.hw, p: RIVER.pIn, a: pts[i].p, b: pts[i + 1].p, river: true });
  }
  // the bridge: Bridge St on over the water
  streets.push({ id: 'bridge', name: BRIDGE.name, cls: 'wide', hw: BRIDGE.hw, p: BRIDGE.foot, a: [RIVER.e, BRIDGE.z], b: [BRIDGE.barrier - 4, BRIDGE.z], bridge: true });

  // ---- the cells: blocks, pavements, lots, walls -----------------------------------------------------
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < zs.length; j++) {
    const xa = xs[i], xb = xs[i + 1], za = zs[j], zb = zs[j + 1];
    const mx = (xa + xb) / 2, mz = (za + zb) / 2;
    if (mx < EDGE.west || mz < EDGE.north) continue;
    // (past the river road's line: the quay, not a block)
    if (riverDist(mx, mz) < RIVER.hw + 2) continue;
    const district = districtAt(mx, mz);
    const special = specialOf(mx, mz);
    const W = nsAt(xa, za, zb), E = nsAt(xb, za, zb), N = ewAt(za, xa, xb), S = ewAt(zb, xa, xb);
    const hw = (L) => (L ? cls(L).hw : 0), pw = (L) => (L ? cls(L).p : 0);
    // the kerb's rect, the building line's rect
    const kr = [xa + hw(W), xb - hw(E), za + hw(N), zb - hw(S)];
    const br = [kr[0] + pw(W), kr[1] - pw(E), kr[2] + pw(N), kr[3] - pw(S)];
    const rect = (r) => [[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]]];
    const cell = { i, j, xa, xb, za, zb, district: district.id, kit: district.kit, special: special ? special.id : null, sides: { w: W, e: E, n: N, s: S }, polys: [] };
    cells.push(cell);
    const rng = new RNG(hash(i, j, 0x0C17));
    // Broadway through this cell (it runs corner to corner)?
    const crossDiag = (() => {
      const c = [[xa, za], [xb, za], [xb, zb], [xa, zb]].map(([x, z]) => broadwayDist(x, z));
      const along = broadwayAlong(mx, mz);
      return Math.min(...c) < -1 && Math.max(...c) > 1 && along > 0 && along < BW.L;
    })();
    const halves = crossDiag ? [-1, 1] : [0];
    for (const side of halves) {
      // the raised ground: the kerb rect, cut by Broadway's side and the river road
      let kp = rect(kr), bp = rect(br);
      if (side) {
        // (side -1: north-west of it; +1: south-east)
        kp = clipPoly(kp, side * BW.nx, side * BW.nz, -side * (BW.ax * BW.nx + BW.az * BW.nz) - BW.hw);
        bp = clipPoly(bp, side * BW.nx, side * BW.nz, -side * (BW.ax * BW.nx + BW.az * BW.nz) - BW.hw - BW.p);
      }
      let riverCut = false;
      for (const s of RV) {
        const c0 = -(s.ax * s.nx + s.az * s.nz);
        const near = [[xa, za], [xb, za], [xb, zb], [xa, zb]].some(([x, z]) => (x - s.ax) * s.nx + (z - s.az) * s.nz < RIVER.hw + RIVER.pIn + 0.5);
        if (!near) continue;
        kp = clipPoly(kp, s.nx, s.nz, c0 - RIVER.hw);
        bp = clipPoly(bp, s.nx, s.nz, c0 - RIVER.hw - RIVER.pIn);
        riverCut = true;
      }
      if (kp.length < 3 || Math.abs(polyArea(kp)) < 4) continue;
      // (cut by the river road's straight stretch, still a rectangle: its
      // lots front the river road as they would a street)
      const ar = !side && riverCut ? axisRect(bp) : null;
      const P = { cell, side, kerb: kp, build: bp.length >= 3 && Math.abs(polyArea(bp)) > 20 ? bp : null, clipped: !!side || (riverCut && !ar) };
      cell.polys.push(P);
      // the pavement: flush where a special says so (the rail yard)
      if (!(special && special.flush)) paves.push({ pts: kp, cell, kerbSides: kerbSidesOf(kp, cell) });
      if (special) continue;      // (its own builder)
      if (side === -1 && CLOCK.cell[0] === xa && CLOCK.cell[2] === za) { P.plaza = true; continue; }   // Clock Square
      if (!P.build) continue;
      const fl = { w: !!W, e: !!E, n: !!N, s: !!S };
      if (ar) { if (ar[1] < br[1] - 0.01) fl.e = true; if (ar[3] < br[3] - 0.01) fl.s = true; }
      if (P.clipped) polyLot(P, rng, lots);
      else rectLots(P, ar || br, cell, fl, rng, lots, alleys);
    }
  }
  // the el's corner lots: nothing stands under its arcs (a parking lot, the columns)
  for (let k = lots.length - 1; k >= 0; k--) {
    const L = lots[k];
    const corners = L.kind === 'poly' ? L.pts : [[L.x0, L.z0], [L.x1, L.z0], [L.x1, L.z1], [L.x0, L.z1], [(L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2]];
    if (L.kind !== 'garden' && corners.some(([x, z]) => elDist(x, z) < EL.hw + 2.5)) { lots.splice(k, 1); L.cut = true; }
  }
  // the walls are the lots' footprints, after the el's corners took theirs
  for (const L of lots) {
    if (L.kind === 'rect') walls.push({ cx: (L.x0 + L.x1) / 2, cz: (L.z0 + L.z1) / 2, hx: (L.x1 - L.x0) / 2, hz: (L.z1 - L.z0) / 2, angle: 0, tag: 'wall', lot: L });
    else if (L.kind === 'garden') {
      // (the garden's wall all round: a man does not get in; its gates are shut)
      const c = [[L.x0, L.z0], [L.x1, L.z0], [L.x1, L.z1], [L.x0, L.z1]];
      for (let e = 0; e < 4; e++) walls.push(edgeBox(c[e], c[(e + 1) % 4], 0.3, 'wall', L));
    } else for (let e = 0; e < L.pts.length; e++) walls.push(edgeBox(L.pts[e], L.pts[(e + 1) % L.pts.length], 0.3, 'wall', L));
  }
  // the named places: the lot nearest each
  for (const pl of PLACES) {
    let best = null, bd = Infinity;
    for (const L of lots) {
      if (L.kind !== 'rect' || L.place) continue;
      const cx = Math.max(L.x0, Math.min(L.x1, pl.at[0])), cz = Math.max(L.z0, Math.min(L.z1, pl.at[1]));
      const d = Math.hypot(cx - pl.at[0], cz - pl.at[1]);
      if (d < bd) { bd = d; best = L; }
    }
    if (best && bd < 25) { best.place = pl; best.kit = pl.kind; }
  }

  // ---- the edges, the quay, the piers, the bridge, the specials' walls ------------------------------------
  edges(walls);
  quay(walls, posts);
  specials(walls, posts);

  // ---- street furniture: lamps, hydrants, call boxes, bins, bays ---------------------------------------------
  furnish(streets, paves, lots, lamps, props, bays, posts);

  // ---- the chunks --------------------------------------------------------------------------------------------
  const chunkOf = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
  for (const L of lots) { const c = L.kind === 'poly' ? centroid(L.pts) : [(L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2]; L.cx = c[0]; L.cz = c[1]; L.chunk = chunkOf(c[0], c[1]); }
  for (const p of paves) { const c = centroid(p.pts); p.chunk = chunkOf(c[0], c[1]); }
  for (const l of lamps) l.chunk = chunkOf(l.x, l.z);
  for (const p of props) p.chunk = chunkOf(p.x, p.z);

  // ---- the ground ------------------------------------------------------------------------------------------------
  const cellAt = (x, z) => {
    let i = -1, j = -1;
    for (let k = 0; k + 1 < xs.length; k++) if (x >= xs[k] && x < xs[k + 1]) { i = k; break; }
    for (let k = 0; k + 1 < zs.length; k++) if (z >= zs[k] && z < zs[k + 1]) { j = k; break; }
    if (i < 0 || j < 0) return null;
    return cellIndex.get(i * 1000 + j) || null;
  };
  const cellIndex = new Map(cells.map((c) => [c.i * 1000 + c.j, c]));
  const inWater = (x, z) => waterAt(x, z);
  function groundAt(x, z) {
    // the bridge's deck and its footways
    if (x > RIVER.e + RIVER.hw - 0.5 && Math.abs(z - BRIDGE.z) < BRIDGE.hw + BRIDGE.foot + 0.5 && x < BRIDGE.x1) {
      const d = Math.abs(z - BRIDGE.z);
      return BRIDGE.deckY + PAVE * ss(BRIDGE.hw - 0.1, BRIDGE.hw + 0.1, d);
    }
    // the slipways: a ramp from the quay road's kerb down into the water
    for (const sl of SLIPS) {
      if (Math.abs(x - sl.x) < sl.w / 2 && z > RIVER.s + RIVER.hw - 0.2) {
        const u = (z - (RIVER.s + RIVER.hw)) / (QUAY_OFF - RIVER.hw + 6);
        return Math.max(WATER_Y - 1.2, -u * (-(WATER_Y) + 1.2));
      }
    }
    const rd = riverDist(x, z);
    if (rd < -RIVER.hw + 0.1) {
      // the quay: pavement to the water's edge (and the piers past it)
      if (rd > -QUAY_OFF || onPier(x, z)) return PAVE * ss(-RIVER.hw + 0.1, -RIVER.hw - 0.1, rd);
      return WATER_Y;
    }
    if (rd < RIVER.hw + 0.2) return PAVE * ss(RIVER.hw - 0.1, RIVER.hw + 0.1, rd);
    const c = cellAt(x, z);
    if (!c) return 0;
    let k = 0;
    if (!(c.special && SPECIAL.find((S) => S.id === c.special).flush)) for (const P of c.polys) {
      const d = insideDist(P.kerb, x, z);
      if (d > -0.1) { k = Math.max(k, ss(-0.1, 0.1, d)); if (k >= 1) break; }
    }
    return PAVE * k;
  }
  return { xs, zs, cells, paves, lots, walls, posts, lamps, props, bays, streets, alleys, groundAt, inWater, cellAt, chunkOf, CHUNK };
}

// which edges of a kerb polygon are kerbs (they face a road): all of them but
// those lying on a line with no road (a merge with the next cell)
function kerbSidesOf(P, cell) {
  const out = [];
  for (let e = 0; e < P.length; e++) {
    const [ax, az] = P[e], [bx, bz] = P[(e + 1) % P.length];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let kerb = true;
    if (Math.abs(ax - bx) < 1e-3) {
      if (Math.abs(ax - cell.xa) < 1e-3 && !cell.sides.w) kerb = false;
      if (Math.abs(ax - cell.xb) < 1e-3 && !cell.sides.e) kerb = false;
    }
    if (Math.abs(az - bz) < 1e-3) {
      if (Math.abs(az - cell.za) < 1e-3 && !cell.sides.n) kerb = false;
      if (Math.abs(az - cell.zb) < 1e-3 && !cell.sides.s) kerb = false;
    }
    // (on the land's edge: no kerb)
    if (mx < EDGE.west + 0.5 || mz < EDGE.north + 0.5) kerb = false;
    out.push(kerb);
  }
  return out;
}

function centroid(P) { let x = 0, z = 0; for (const p of P) { x += p[0]; z += p[1]; } return [x / P.length, z / P.length]; }
// a polygon that is an axis-aligned rectangle -> [x0, x1, z0, z1], else null
function axisRect(P) {
  if (P.length !== 4) return null;
  const xs = [...new Set(P.map((p) => Math.round(p[0] * 1000) / 1000))], zs = [...new Set(P.map((p) => Math.round(p[1] * 1000) / 1000))];
  if (xs.length !== 2 || zs.length !== 2) return null;
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}
// a wall box along an edge (thick t, inside the polygon's line)
function edgeBox(a, b, t, tag, lot = null) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  return { cx: (a[0] + b[0]) / 2, cz: (a[1] + b[1]) / 2, hx: L / 2 + t * 0.5, hz: t, angle: Math.atan2(-dz, dx), tag, lot };
}

// ---- the lots of a rectangular block -----------------------------------------------------------------------------
// DEPTH, WIDTH, FLOORS by kit
const KIT = {
  downtown: { depth: [18, 26], width: [12, 26], floors: [5, 11], fh: 3.6, back: 0.75 },
  tenement: { depth: [13, 17], width: [8, 13], floors: [4, 6], fh: 3.2, back: 0.8 },
  docks: { depth: [24, 36], width: [24, 42], floors: [2, 3], fh: 4.6, back: 0.9, warehouse: true },
  yards: { depth: [16, 26], width: [16, 34], floors: [1, 3], fh: 4.4, back: 0.7, shed: true },
  hill: { depth: [14, 18], width: [16, 24], floors: [2, 3], fh: 3.6, back: 0.0, estate: true },
};
function rectLots(P, br, cell, fl, rng, lots, alleys) {
  const K = KIT[cell.kit];
  const [X0, X1, Z0, Z1] = br;
  if (X1 - X0 < 6 || Z1 - Z0 < 6) return;
  const W = fl.w, E = fl.e, N = fl.n, Sx = fl.s;
  // the Hill: walled gardens, a house set back in each (the wall is the lot's front)
  if (K.estate) { estateLots(P, br, cell, fl, rng, lots); return; }
  const half = (a, b) => (b - a) / 2;
  const dep = () => rng.range(K.depth[0], K.depth[1]);
  const dN = N ? Math.min(dep(), Sx ? half(Z0, Z1) : Z1 - Z0) : 0;
  const dS = Sx ? Math.min(dep(), N ? half(Z0, Z1) : Z1 - Z0) : 0;
  const dW = W ? Math.min(dep(), E ? half(X0, X1) : X1 - X0) : 0;
  const dE = E ? Math.min(dep(), W ? half(X0, X1) : X1 - X0) : 0;
  // an alley through the block (tenements and downtown, big enough): north to
  // south between the W and E rows, or a dead end in from one street
  let alley = null;
  if ((cell.kit === 'tenement' || cell.kit === 'downtown') && N && Sx && X1 - X0 > 40 && Z1 - Z0 > 40 && rng.chance(0.55)) {
    const ax = X0 + (X1 - X0) * rng.range(0.4, 0.6), w = 5;
    const through = rng.chance(0.6);
    alley = { x0: ax - w / 2, x1: ax + w / 2, z0: Z0 - 0.01, z1: through ? Z1 + 0.01 : Z0 + (Z1 - Z0) * 0.62, through, cell };
    alleys.push(alley);
  }
  const floorsOf = () => rng.int(K.floors[0], K.floors[1]);
  const add = (x0, x1, z0, z1, faces) => {
    if (x1 - x0 < 2 || z1 - z0 < 2) return;
    // (the alley cuts it)
    if (alley && x1 > alley.x0 && x0 < alley.x1 && z1 > alley.z0 && z0 < alley.z1) {
      if (alley.x0 - x0 > 2) add(x0, alley.x0, z0, z1, { ...faces, e: true, alleyE: true });
      if (x1 - alley.x1 > 2) add(alley.x1, x1, z0, z1, { ...faces, w: true, alleyW: true });
      // (behind a dead end's end: what is past it)
      if (!alley.through && z1 > alley.z1 + 2) add(Math.max(x0, alley.x0), Math.min(x1, alley.x1), alley.z1, z1, { ...faces, n: true });
      return;
    }
    let floors = floorsOf();
    // (downtown: now and then a tower, its setbacks the kit's: the skyline)
    const tower = cell.kit === 'downtown' && x1 - x0 > 15 && z1 - z0 > 15 && rng.chance(0.16);
    if (tower) floors = rng.int(15, 24);
    const h = 1.0 + floors * K.fh + rng.range(0, 1.4);
    lots.push({ kind: 'rect', x0, x1, z0, z1, h, floors, fh: K.fh, kit: cell.kit, faces, district: cell.district, tower, seed: rng.next() * 1e6 | 0 });
  };
  // the strips along each street side, cut into lots of a width
  const strip = (from, to, cutLot) => {
    let a = from;
    while (a < to - 0.5) {
      let w = rng.range(K.width[0], K.width[1]);
      if (to - a - w < K.width[0] * 0.6) w = to - a;
      cutLot(a, Math.min(to, a + w));
      a += w;
    }
  };
  if (N) strip(X0, X1, (a, b) => add(a, b, Z0, Z0 + dN, { n: true, w: W && a <= X0 + 1e-6, e: E && b >= X1 - 1e-6 }));
  if (Sx) strip(X0, X1, (a, b) => add(a, b, Z1 - dS, Z1, { s: true, w: W && a <= X0 + 1e-6, e: E && b >= X1 - 1e-6 }));
  const zA = Z0 + dN, zB = Z1 - dS;
  if (W && zB - zA > 2) strip(zA, zB, (a, b) => add(X0, X0 + dW, a, b, { w: true }));
  if (E && zB - zA > 2) strip(zA, zB, (a, b) => add(X1 - dE, X1, a, b, { e: true }));
  // the back: what is left in the middle, lower (a solid: no hollow courtyard to see into)
  const ix0 = X0 + dW, ix1 = X1 - dE;
  if (ix1 - ix0 > 2 && zB - zA > 2) {
    const h = 1.0 + K.floors[0] * K.fh * K.back + rng.range(0, 2);
    const backAdd = (x0, x1, z0, z1) => {
      if (x1 - x0 < 2 || z1 - z0 < 2) return;
      // (an edge of it is open where a side has no road and no lots: dressed as a blank wall)
      lots.push({ kind: 'rect', x0, x1, z0, z1, h, floors: K.floors[0], fh: K.fh, kit: cell.kit, faces: { w: !W && x0 <= X0 + 1e-6, e: !E && x1 >= X1 - 1e-6, n: !N && z0 <= Z0 + 1e-6, s: !Sx && z1 >= Z1 - 1e-6 }, back: true, district: cell.district });
    };
    if (alley && alley.x1 > ix0 && alley.x0 < ix1) {
      backAdd(ix0, Math.max(ix0, alley.x0), zA, zB);
      backAdd(Math.min(ix1, alley.x1), ix1, zA, zB);
      if (!alley.through && zB > alley.z1 + 2) backAdd(Math.max(ix0, alley.x0), Math.min(ix1, alley.x1), Math.max(zA, alley.z1), zB);
    } else backAdd(ix0, ix1, zA, zB);
  }
}

// the Hill's estates: a wall along each street (a gate in it), the house set back
function estateLots(P, br, cell, S, rng, lots) {
  const [X0, X1, Z0, Z1] = br;
  // the garden's wall on its street sides
  const W = X1 - X0, D = Z1 - Z0;
  const n = Math.max(1, Math.round(W / 60));
  for (let k = 0; k < n; k++) {
    const x0 = X0 + (W / n) * k, x1 = X0 + (W / n) * (k + 1);
    const hx = Math.min(12, (x1 - x0) * 0.32), hz = Math.min(10, D * 0.22);
    const cx = (x0 + x1) / 2 + rng.range(-3, 3), cz = Z0 + D * rng.range(0.42, 0.58);
    const floors = rng.int(2, 3);
    lots.push({ kind: 'rect', x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, h: 1.2 + floors * 3.8 + 2.5, floors, fh: 3.8, kit: 'hill', house: true, faces: { n: true, s: true, w: true, e: true }, district: cell.district, seed: rng.next() * 1e6 | 0 });
  }
  lots.push({ kind: 'garden', x0: X0, x1: X1, z0: Z0, z1: Z1, sides: { n: !!S.n, s: !!S.s, w: !!S.w, e: !!S.e }, kit: 'hill', wallH: 2.6, district: cell.district, gates: n, seed: rng.next() * 1e6 | 0 });
}

// a clipped block (Broadway's triangles, the river road's cut): one building
// on the whole polygon - the flatiron's prow - its faces dressed
function polyLot(P, rng, lots) {
  const K = KIT[P.cell.kit];
  const floors = Math.max(K.floors[0], Math.min(K.floors[1] + 2, rng.int(K.floors[0] + 1, K.floors[1] + 2)));
  const h = 1.0 + floors * K.fh + rng.range(0, 1.4);
  const pts = polyArea(P.build) < 0 ? [...P.build].reverse() : P.build;
  lots.push({ kind: 'poly', pts, h, floors, fh: K.fh, kit: P.cell.kit, district: P.cell.district, flatiron: !!P.side, seed: rng.next() * 1e6 | 0 });
}

// ---- the water --------------------------------------------------------------------------------------------------
function onPier(x, z) {
  const edge = RIVER.s + QUAY_OFF;
  for (const p of PIERS) if (Math.abs(x - p.x) < p.w / 2 && z > edge - 1 && z < edge + p.len) return p;
  return null;
}
function waterAt(x, z) {
  if (onPier(x, z)) return false;
  if (x > RIVER.e && Math.abs(z - BRIDGE.z) < BRIDGE.hw + BRIDGE.foot && x < BRIDGE.x1) return false;
  return riverDist(x, z) < -QUAY_OFF;
}
export { onPier };

// the land's edges: the rail yard's embankment wall (west), the Hill's wall (north)
function edges(walls) {
  walls.push({ cx: EDGE.west - 1, cz: 0, hx: 1, hz: 620, angle: 0, tag: 'edge' });
  walls.push({ cx: 0, cz: EDGE.north - 1, hx: 620, hz: 1, angle: 0, tag: 'edge' });
}

// the quay's railing (a car's wall, a man's), broken at the slipways, the
// piers' mouths and the bridge; the piers' own railings (their ends open)
function quay(walls, posts) {
  const edge = QUAY_OFF - 0.4;
  // along the river road's line, the rail RIVER.quay past the outer kerb
  const gaps = [];
  for (const sl of SLIPS) gaps.push({ x: sl.x, w: sl.w + 0.6, south: true });
  for (const p of PIERS) gaps.push({ x: p.x, w: p.w, south: true });
  for (let i = 0; i + 1 < RIVER_LINE.length; i++) {
    const [ax, az] = RIVER_LINE[i], [bx, bz] = RIVER_LINE[i + 1];
    const s = RIVER_SEGS[i];
    if (!s) continue;
    // (offset outward: away from the city)
    const ox = -s.nx * edge, oz = -s.nz * edge;
    const A = [ax + ox, az + oz], B = [bx + ox, bz + oz];
    // (cut where a gap is: the south quay runs along x)
    const pieces = [[A, B]];
    if (Math.abs(az - bz) < 1e-3) {
      const lo = Math.min(A[0], B[0]), hi = Math.max(A[0], B[0]);
      let cuts = [[lo, hi]];
      for (const g of gaps) {
        const g0 = g.x - g.w / 2, g1 = g.x + g.w / 2;
        cuts = cuts.flatMap(([a, b]) => (g1 <= a || g0 >= b ? [[a, b]] : [[a, g0], [g1, b]].filter(([u, v]) => v - u > 0.3)));
      }
      pieces.length = 0;
      for (const [a, b] of cuts) pieces.push([[a, A[1]], [b, A[1]]]);
    }
    // (the bridge crosses the east quay)
    if (Math.abs(ax - bx) < 1e-3) {
      const lo = Math.min(A[1], B[1]), hi = Math.max(A[1], B[1]);
      const g0 = BRIDGE.z - BRIDGE.hw - BRIDGE.foot, g1 = BRIDGE.z + BRIDGE.hw + BRIDGE.foot;
      if (g1 > lo && g0 < hi) { pieces.length = 0; if (g0 - lo > 0.3) pieces.push([[A[0], lo], [A[0], g0]]); if (hi - g1 > 0.3) pieces.push([[A[0], g1], [A[0], hi]]); }
    }
    for (const [p, q] of pieces) walls.push({ ...edgeBox(p, q, 0.15, 'rail'), rail: true, a: p, b: q });
  }
  // the piers: railings along their long sides (the ends open: bollards)
  const e0 = RIVER.s + QUAY_OFF;
  for (const p of PIERS) {
    for (const sx of [-1, 1]) { const x = p.x + sx * (p.w / 2 - 0.3); walls.push({ ...edgeBox([x, e0], [x, e0 + p.len - 0.5], 0.15, 'rail'), rail: true, a: [x, e0], b: [x, e0 + p.len - 0.5] }); }
    for (let x = p.x - p.w / 2 + 1.5; x < p.x + p.w / 2 - 1; x += 3) posts.push({ x, z: e0 + p.len - 0.6, r: 0.25, tag: 'bollard' });
  }
  // the bridge's parapets, its barrier at the far end (shut) and the lorry across it
  for (const sz of [-1, 1]) {
    const z = BRIDGE.z + sz * (BRIDGE.hw + BRIDGE.foot + 0.25);
    walls.push({ ...edgeBox([RIVER.e + QUAY_OFF - 1, z], [BRIDGE.x1, z], 0.25, 'rail'), rail: true, parapet: true, a: [RIVER.e + QUAY_OFF - 1, z], b: [BRIDGE.x1, z] });
  }
  walls.push({ cx: BRIDGE.barrier, cz: BRIDGE.z, hx: 0.3, hz: BRIDGE.hw + BRIDGE.foot, angle: 0, tag: 'barrier', barrier: true });
}

// the specials' fences and solids (the rail yard's fence and gate, the
// gasworks' holders and stacks, the park's railing, the market's sheds)
function specials(walls, posts) {
  for (const S of SPECIAL) {
    const [x0, x1, z0, z1] = S.rect;
    if (S.kind === 'railyard') {
      // its fence on the east side (the gate at Clock St), the north end
      const g0 = S.gate.z - S.gate.w / 2, g1 = S.gate.z + S.gate.w / 2;
      walls.push({ ...edgeBox([x1 - 0.3, z0], [x1 - 0.3, g0], 0.12, 'fence'), fence: true, a: [x1 - 0.3, z0], b: [x1 - 0.3, g0] });
      walls.push({ ...edgeBox([x1 - 0.3, g1], [x1 - 0.3, z1], 0.12, 'fence'), fence: true, a: [x1 - 0.3, g1], b: [x1 - 0.3, z1] });
      walls.push({ ...edgeBox([x0, z0 + 0.3], [x1, z0 + 0.3], 0.12, 'fence'), fence: true, a: [x0, z0 + 0.3], b: [x1, z0 + 0.3] });
    }
  }
}

// ---- the furniture -------------------------------------------------------------------------------------------------
// lamps along every kerb (by the street's class, alternating sides on the
// streets, both on the avenues), one at a corner of every junction; a
// hydrant, a call box, bins; parking bays along the kerbs of the streets
function furnish(streets, paves, lots, lamps, props, bays, posts) {
  const rng = new RNG(0x51AE);
  // (buckets of 32 m: a lot, a pavement listed in every bucket its bounds touch)
  const B = 32, bk = (x, z) => Math.floor(x / B) * 4096 + Math.floor(z / B);
  const index = (list, bounds) => {
    const m = new Map();
    for (const o of list) {
      const [x0, x1, z0, z1] = bounds(o);
      for (let i = Math.floor(x0 / B); i <= Math.floor(x1 / B); i++) for (let j = Math.floor(z0 / B); j <= Math.floor(z1 / B); j++) { const k = i * 4096 + j; if (!m.has(k)) m.set(k, []); m.get(k).push(o); }
    }
    return (x, z) => m.get(bk(x, z)) || [];
  };
  const bnd = (P) => [Math.min(...P.map((p) => p[0])), Math.max(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[1]))];
  const lotAt = index(lots, (L) => (L.kind === 'poly' ? bnd(L.pts) : [L.x0, L.x1, L.z0, L.z1]));
  const paveAt = index(paves, (p) => bnd(p.pts));
  const inLot = (x, z, pad = 0.6) => lotAt(x, z).some((L) => L.kind === 'poly' ? insideDist(L.pts, x, z) > -pad : x > L.x0 - pad && x < L.x1 + pad && z > L.z0 - pad && z < L.z1 + pad);
  // is (x, z) on a raised pavement (inside some kerb polygon, clear of its edge by m)?
  const onPave = (x, z, m) => paveAt(x, z).some((p) => insideDist(p.pts, x, z) > m);
  const near = (list, x, z, r) => { for (let i = list.length - 1; i >= 0 && i > list.length - 40; i--) { const o = list[i]; if (Math.hypot(o.x - x, o.z - z) < r) return true; } return false; };
  for (const st of streets) {
    if (st.river || st.bridge) continue;
    const [ax, az] = st.a, [bx, bz] = st.b;
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 20) continue;
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    const nx = -dz, nz = dx;
    const step = st.cls === 'lane' ? 34 : st.cls === 'avenue' ? 30 : 36;
    const both = st.cls === 'avenue' || st.cls === 'wide';
    const off = st.hw + 0.7;
    let k = 0;
    for (let u = 14; u < L - 12; u += step, k++) {
      for (const sd of both ? [-1, 1] : [k % 2 ? 1 : -1]) {
        const x = ax + dx * u + nx * off * sd, z = az + dz * u + nz * off * sd;
        if (!onPave(x, z, 0.3) || inLot(x, z, 0.5) || near(lamps, x, z, 12)) continue;
        // (the arm reaches over the road: its heading toward the street's middle)
        lamps.push({ x, z, yaw: Math.atan2(-(-nz * sd), -nx * sd), kind: 'post', street: st.id });
        posts.push({ x, z, r: 0.22, tag: 'lamp', give: true });
      }
    }
    // the parking bays: the kerb lane of streets and the wide ones, not lanes, never near a junction
    if (st.cls !== 'lane' && !st.diag) {
      const laneOff = st.hw - 1.25;
      for (let u = 16; u < L - 16; u += 6.5) {
        for (const sd of [-1, 1]) {
          const x = ax + dx * u + nx * laneOff * sd, z = az + dz * u + nz * laneOff * sd;
          // (heading the way the traffic on that side goes: right-hand
          // traffic - the side along +n is the right of a car going a -> b)
          const fx = sd > 0 ? dx : -dx, fz = sd > 0 ? dz : -dz;
          bays.push({ x, z, yaw: Math.atan2(-fz, fx), street: st.id, side: sd });
        }
      }
    }
    // a hydrant and a call box now and then, bins by the shops
    for (let u = 22; u < L - 18; u += rng.range(40, 70)) {
      const sd = rng.chance(0.5) ? 1 : -1;
      const x = ax + dx * u + nx * (st.hw + 0.55) * sd, z = az + dz * u + nz * (st.hw + 0.55) * sd;
      if (!onPave(x, z, 0.25) || inLot(x, z, 0.4) || near(lamps, x, z, 3) || near(props, x, z, 4)) continue;
      const kind = rng.pick(['hydrant', 'hydrant', 'bin', 'bin', 'callbox']);
      props.push({ kind, x, z, yaw: Math.atan2(-nz * sd, nx * sd), street: st.id });
      posts.push({ x, z, r: kind === 'callbox' ? 0.5 : 0.3, tag: kind });
    }
  }
  // the quay's lamps on the river side of the river road (their arms over the
  // road), the bridge's on its parapets
  let acc = 0;
  for (let i = 0; i + 1 < RIVER_LINE.length; i++) {
    const s = RIVER_SEGS[i];
    for (let u = 0; u < s.L; u += 4) {
      acc += 4;
      if (acc < 32) continue;
      acc = 0;
      const cx = s.ax + s.dx * u, cz = s.az + s.dz * u;
      const x = cx - s.nx * (RIVER.hw + 0.8), z = cz - s.nz * (RIVER.hw + 0.8);
      if (Math.abs(z - BRIDGE.z) < BRIDGE.hw + 6 && x > RIVER.e - 1) continue;
      lamps.push({ x, z, yaw: Math.atan2(-s.nz, s.nx), kind: 'post', street: 'river', quay: true });
      posts.push({ x, z, r: 0.22, tag: 'lamp', give: true });
    }
  }
  for (let x = RIVER.e + QUAY_OFF + 8; x < BRIDGE.barrier - 4; x += 30) for (const sz of [-1, 1]) {
    const z = BRIDGE.z + sz * (BRIDGE.hw + 0.9);
    lamps.push({ x, z, yaw: Math.atan2(sz, 0), kind: 'post', street: 'bridge', bridge: true });
    posts.push({ x, z, r: 0.22, tag: 'lamp' });
  }
}

export { PAVE, WATER_Y, CITY };
