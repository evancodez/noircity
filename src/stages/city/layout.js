import * as THREE from 'three';
import { NS, EW, NS_LIST, EW_LIST, BLOCKS, PELL, ALLEY_W, WHARF_X, START, ROADWORKS, RIVER, RIVER_LEN, riverFrame, riverPoint, riverSAtZ, riverProject, EL, SPECIAL } from './plan.js';

// The city's layout drawn from its seeds, as plain numbers (no meshes): the
// buildings' lots, the parked cars' places, the lamp posts' - the parts
// build from these, and so can a headless run of the chase (tools/lib/
// c3city.mjs: the same walls, posts and parked cars without a browser).
// Each takes the stage's rng fork the part uses.

// a block's building ground, cut by its lane, alley or dead end
export function pieces(b) {
  const P = [];
  const { x0, x1, z0, z1 } = b;
  if (b.kind === 'square') return P;
  if (b.pell) {
    P.push({ x0, x1: PELL.x - PELL.hw - PELL.pw, z0, z1 });
    // (east of the lane: the board fence's yard where the cars stand, the
    // buildings north of it)
    P.push({ x0: PELL.x + PELL.hw + PELL.pe, x1, z0, z1: 12, yardS: true });
    P.push({ x0: PELL.x + PELL.hw + PELL.pe + 14, x1, z0: 12, z1 });
    return P;
  }
  if (b.alleyNS != null) { const a = b.alleyNS; P.push({ x0, x1: a - ALLEY_W / 2, z0, z1 }, { x0: a + ALLEY_W / 2, x1, z0, z1 }); return P; }
  if (b.alleyEW != null) { const a = b.alleyEW; P.push({ x0, x1, z0, z1: a - ALLEY_W / 2 }, { x0, x1, z0: a + ALLEY_W / 2, z1 }); return P; }
  if (b.deadEnd) {
    const D = b.deadEnd;
    P.push({ x0, x1: D.x0, z0, z1 });
    P.push({ x0: D.x0, x1, z0, z1: D.z - ALLEY_W / 2 }, { x0: D.x0, x1, z0: D.z + ALLEY_W / 2, z1 });
    return P;
  }
  if (b.yard) { P.push({ x0: (x0 + x1) / 2 + 4, x1, z0, z1 }); return P; }
  P.push({ x0, x1, z0, z1 });
  return P;
}

// where an alley, the dead end or the square meets a street: nothing is
// parked or planted there (x, z, r)
export const MOUTHS = [
  { x: SPECIAL['3,2'].alleyNS, z: EW.clock.z, r: 9 }, { x: SPECIAL['3,2'].alleyNS, z: EW.harbor.z, r: 11 },
  { x: NS.cooper.x, z: SPECIAL['1,3'].alleyEW, r: 9 }, { x: NS.avenue.x, z: SPECIAL['1,3'].alleyEW, r: 12 },
  { x: NS.cooper.x, z: SPECIAL['0,1'].deadEnd.z, r: 9 },
];
export const inMouth = (x, z, pad = 0) => MOUTHS.some((m) => Math.hypot(x - m.x, z - m.z) < m.r + pad);
// the market square's corners (his way through it goes corner to corner)
const SQ = BLOCKS.find((b) => b.kind === 'square');
export const inSquareCorner = (x, z) => SQ && [[SQ.x0, SQ.z0], [SQ.x1, SQ.z0], [SQ.x0, SQ.z1], [SQ.x1, SQ.z1]].some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 11);

// the lots: along each piece's north and south faces (each to the middle;
// the ends' side walls are the east and west faces)
export function lotsOf(rng) {
  const lots = [];
  for (const b of BLOCKS) {
    const warehouse = b.x1 >= WHARF_X - 0.01;
    for (const pc of pieces(b)) {
      if (pc.yardS) continue;
      const D = pc.z1 - pc.z0;
      const rows = D > 24 ? [[pc.z0, pc.z0 + D / 2, -1], [pc.z0 + D / 2, pc.z1, 1]] : [[pc.z0, pc.z1, 0]];
      for (const [za, zb, side] of rows) {
        let x = pc.x0;
        while (x < pc.x1 - 0.5) {
          let w = warehouse ? rng.range(22, 40) : rng.range(9, 22);
          if (pc.x1 - x - w < 7) w = pc.x1 - x;
          const xa = x, xb = Math.min(pc.x1, x + w);
          const floors = warehouse ? rng.int(2, 3) : rng.int(3, 6);
          const fh = warehouse ? 4.6 : 3.5;
          const h = 1.2 + floors * fh + rng.range(0, 1.2);
          lots.push({ x0: xa, x1: xb, z0: za, z1: zb, h, floors, fh, side, warehouse, block: b, piece: pc,
            west: Math.abs(xa - pc.x0) < 0.01, east: Math.abs(xb - pc.x1) < 0.01 });
          x = xb;
        }
      }
    }
  }
  return lots;
}

// the parked cars: at the kerbs of the two-lane streets, the avenue's outer
// lanes, Market St, Pell Lane's west kerb; never in a junction, never by
// the start's two cars
export function parkedOf(rng) {
  const spots = [];
  const clearOf = (x, z) => Math.hypot(x - START.my.x, z - START.my.z) > 14 && Math.hypot(x - START.his.x, z - START.his.z) > 14;
  for (const k of NS_LIST) {
    const S = NS[k];
    const off = S.hw - 1.15;
    for (const side of [-1, 1]) {
      if (k === 'water' && side > 0) continue;   // (the tram's side)
      for (let z = S.z0 + 14; z < S.z1 - 8; z += rng.range(5.6, 7.5)) {
        if (EW_LIST.some((e) => Math.abs(z - EW[e].z) < EW[e].hw + EW[e].p + 5)) continue;
        if (S.works && z > ROADWORKS.z0 - 6 && z < ROADWORKS.z1 + 6) continue;
        if (rng.chance(0.42)) continue;
        spots.push({ x: S.x + side * off + rng.gauss() * 0.06, z, yaw: (side > 0 ? -Math.PI / 2 : Math.PI / 2) + rng.gauss() * 0.03 });
      }
    }
  }
  for (const k of EW_LIST) {
    const S = EW[k];
    if (k === 'canal' || k === 'dock') continue;
    const off = S.hw - 1.15;
    for (const side of [-1, 1]) {
      for (let x = S.x0 + 14; x < 80; x += rng.range(5.6, 7.5)) {
        if (NS_LIST.some((n) => Math.abs(x - NS[n].x) < NS[n].hw + NS[n].p + 5) || Math.abs(x - PELL.x) < PELL.hw + 6) continue;
        if (rng.chance(k === 'market' ? 0.6 : 0.45)) continue;
        spots.push({ x, z: S.z + side * off + rng.gauss() * 0.06, yaw: (side > 0 ? 0 : Math.PI) + rng.gauss() * 0.03 });
      }
    }
  }
  for (let z = PELL.z0 + 10; z < PELL.z1 - 6; z += rng.range(6, 9)) if (rng.chance(0.5)) spots.push({ x: PELL.x - PELL.hw + 1.15, z, yaw: -Math.PI / 2 });
  return spots.filter((p) => clearOf(p.x, p.z) && !inMouth(p.x, p.z));
}

// the lamp posts: { x, z, yaw, overWater? } (the lamps part adds the el's
// hanging lamps and the wall brackets)
export function postsOf(rng) {
  const P = [];
  const inCross = (z, pad = 3) => EW_LIST.some((k) => Math.abs(z - EW[k].z) < EW[k].hw + EW[k].p + pad);
  const inCrossX = (x, pad = 3) => NS_LIST.some((k) => Math.abs(x - NS[k].x) < NS[k].hw + NS[k].p + pad) || Math.abs(x - PELL.x) < PELL.hw + 4;
  for (const k of NS_LIST) {
    const S = NS[k];
    let side = 1;
    for (let z = S.z0 + 18; z < S.z1 - 4; z += rng.range(34, 44)) {
      if (inCross(z)) continue;
      if (S.works && z > ROADWORKS.z0 - 4 && z < ROADWORKS.z1 + 4) continue;
      P.push({ x: S.x + side * (S.hw + 0.7), z, yaw: side > 0 ? Math.PI : 0 });
      side = -side;
    }
  }
  for (const k of EW_LIST) {
    const S = EW[k];
    let side = 1;
    const xEnd = riverFrame(riverSAtZ(S.z), {}).x - RIVER.hw - RIVER.pw - 4;
    for (let x = S.x0 + 20; x < xEnd; x += rng.range(34, 44)) {
      if (inCrossX(x)) continue;
      // (on the south pavement the arm reaches north: yaw PI / 2)
      P.push({ x, z: S.z + side * (S.hw + 0.7), yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
      side = -side;
    }
  }
  // a lamp at the north-east corner of every junction, its arm over the
  // crossing's middle (south-west: (cos, -sin) = (-1, 1))
  for (const a of NS_LIST) for (const b of EW_LIST) {
    if (a === 'avenue' && b === 'canal') continue;
    const x = NS[a].x + NS[a].hw + 0.7, z = EW[b].z - EW[b].hw - 0.7;
    if (inSquareCorner(x, z)) continue;
    P.push({ x, z, yaw: -Math.PI * 0.75 });
  }
  // the quay's posts on the river road's east pavement (the el's lamps hang
  // over its south half instead)
  const elS0 = riverSAtZ(EW.harbor.z + 26);
  for (let s = 6; s < RIVER_LEN - 4; s += 32) {
    if (s > elS0) continue;
    const f = riverFrame(s, {});
    const p = riverPoint(s, -(RIVER.hw + 0.8));
    P.push({ x: p.x, z: p.z, yaw: Math.atan2(-f.rz, f.rx), overWater: true });
  }
  return P.filter((p) => !inMouth(p.x, p.z, 1));
}

// the el's line sampled every metre by arc length, and its stations (a
// column pair each, ~11.5 m apart, never in a cross street's carriageway)
export const EL_HW = 3.9, EL_SPAN = 11.5;
export function elLine() {
  const curve = new THREE.CatmullRomCurve3(EL.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
  const len = curve.getLength();
  const n = Math.ceil(len);
  const S = curve.getSpacedPoints(n);
  const at = (s, out = {}) => {
    s = Math.max(0, Math.min(n, s));
    const i = Math.min(n - 1, Math.floor(s)), u = s - i;
    out.x = S[i].x + (S[i + 1].x - S[i].x) * u; out.z = S[i].z + (S[i + 1].z - S[i].z) * u;
    let fx = S[i + 1].x - S[i].x, fz = S[i + 1].z - S[i].z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    out.fx = fx; out.fz = fz; out.nx = -fz; out.nz = fx;
    return out;
  };
  return { at, len: n };
}
export function elStations(line = elLine()) {
  const hw = EL_HW;
  // (in a carriageway: an east-west street's, a north-south one's, the
  // river road's)
  const inEW = (x, z, pad) => EW_LIST.some((k) => Math.abs(z - EW[k].z) < EW[k].hw + pad && x > EW[k].x0 - 5 && x < 104);
  const inNS = (x, z, pad) => NS_LIST.some((k) => Math.abs(x - NS[k].x) < NS[k].hw + pad && z > NS[k].z0 - 8 && z < NS[k].z1 + 8);
  const rp = {};
  const inRiver = (x, z, pad) => { if (x < 90) return false; riverProject(x, z, rp); return rp.s > 1 && Math.abs(rp.d) < RIVER.hw + pad; };
  const blocked = (s) => {
    const f = line.at(s, {});
    for (const sg of [-1, 1]) {
      const x = f.x + f.nx * hw * sg, z = f.z + f.nz * hw * sg;
      if (inMouth(x, z, -3)) return true;
      // (on the river road a column stands only on its lines, 3.9 m either
      // side of the road's middle: where the el comes round onto it, none)
      if (inRiver(x, z, 1.0) && Math.abs(Math.abs(rp.d) - 3.9) > 0.7) return true;
      if (Math.abs(f.fz) > 0.9) { if (inEW(x, z, 4.5)) return true; }
      else if (Math.abs(f.fx) > 0.9) { if (inNS(x, z, 4.5)) return true; }
      // (round a corner the girders span the crossing: no column stands in
      // any carriageway there)
      else if (inEW(x, z, 1.5) || inNS(x, z, 1.5) || inRiver(x, z, 1.0)) return true;
    }
    return false;
  };
  const st = [];
  for (let s = 0; s <= line.len; s += EL_SPAN) {
    let q = s;
    for (let k = 0; k < 40 && blocked(q); k++) q += 1;
    if (st.length && q - st[st.length - 1] < 5) continue;
    st.push(q);
    s = q;
  }
  const columns = [];
  for (const s of st) { const f = line.at(s, {}); columns.push({ x: f.x + f.nx * hw, z: f.z + f.nz * hw, r: 0.66, s }, { x: f.x - f.nx * hw, z: f.z - f.nz * hw, r: 0.66, s }); }
  return { stations: st, columns, line };
}
