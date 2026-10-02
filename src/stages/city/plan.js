import * as THREE from 'three';

// The city (lane C3, chapter VI The Tail): a district at night in the rain,
// six streets by five, learnt in two minutes. Numbers only: the parts build
// from them, the scene's drivers (his car, the traffic, the bots) read them.
// No default export: not a part.
//
// Metres, y up. North is -z, east +x (the backlot's frame: the viewer's yaw
// 0 looks north). A car's heading is its rotation.y (local +x forward):
// yaw 0 east, PI/2 north, PI west, -PI/2 south.
//
//   the rail yard   x < -258 (the west edge: a fence, the tracks, wagons, the
//                   water tower)
//   the canal       z < -258 (the north edge: a railing, black water, the lift
//                   bridge up at the avenue's end, the gasworks beyond)
//   the depot       z > 134 west of the wharf (the south edge: long sheds)
//   the river       east of the river road's quay (the far bank's lights)
//   Pier 9          at the river road's south end: the yard, the gate, the
//                   shed on the pier, the crane, the freighter
//
// Streets (kerb to kerb `w`, pavements `p`): north-south Yard Rd, Cooper St,
// the El Avenue (wide, the el down its middle), Baxter St, Water St (the
// tram), Pell Lane (the back lane where the chapter starts); east-west Canal
// St, Market St, Clock St, Harbor St (wide, the el along it from the avenue
// to the river), Fifth St, Dock Rd. The river road along the quay, bending,
// the el over its south half. The market is a square (the block between
// Cooper and the avenue, Market and Clock: stalls in rows, a car goes
// through), the wharf market on the river road's wide apron.

export const PAVE = 0.15;            // the pavements' top
export const WATER_Y = -2.1;         // the river and the canal

// ---- the grid -------------------------------------------------------------------------
// north-south streets: x, half kerb width, pavement, z extent
export const NS = {
  yard:   { x: -250, hw: 5.5, p: 3, z0: -250, z1: 125, name: 'YARD RD' },
  cooper: { x: -175, hw: 5.5, p: 3, z0: -250, z1: 125, name: 'COOPER ST' },
  avenue: { x: -100, hw: 9, p: 4, z0: -258, z1: 125, name: 'EL AVE', el: true },
  baxter: { x: -25, hw: 5.5, p: 3, z0: -250, z1: 125, name: 'BAXTER ST', works: [58, 116] },
  water:  { x: 50, hw: 5.5, p: 3, z0: -250, z1: 125, name: 'WATER ST', tram: true },
};
// east-west streets: z, half width, pavement, x extent (to the river road)
export const EW = {
  canal:  { z: -250, hw: 5.5, p: 3, x0: -250, name: 'CANAL ST' },
  market: { z: -175, hw: 6, p: 4, x0: -250, name: 'MARKET ST' },
  clock:  { z: -100, hw: 5.5, p: 3, x0: -250, name: 'CLOCK ST' },
  harbor: { z: -25, hw: 9, p: 4, x0: -250, name: 'HARBOR ST', el: true },
  fifth:  { z: 50, hw: 5.5, p: 3, x0: -250, name: 'FIFTH ST' },
  dock:   { z: 125, hw: 6, p: 3, x0: -250, name: 'DOCK RD' },
};
export const NS_LIST = ['yard', 'cooper', 'avenue', 'baxter', 'water'];
export const EW_LIST = ['canal', 'market', 'clock', 'harbor', 'fifth', 'dock'];

// the warehouses' fronts on the river side (the apron between them and the
// river road: the wharf, loading bays, the wharf market)
export const WHARF_X = 95;

// Pell Lane: the backlot's last street (lane C6's chase ends at its kerb),
// copied here as the chapter's start. Backlot (x, z) -> city (x + dx, z + dz):
// BACKST's road x -12 .. -2.5 is Pell's, its east pavement to the board fence
// at x 2.0, the west 2.5 m to the facades; his sedan and my coupe at the east
// kerb, heading north.
export const PELL = { x: -212.5, hw: 4.75, pw: 2.5, pe: 4.5, z0: -25, z1: 50 };
export const FROM_BACKLOT = { dx: -205.25, dz: 121 };
export const START = {
  my: { x: -4.1 + FROM_BACKLOT.dx, z: -91.0 + FROM_BACKLOT.dz, yaw: Math.PI / 2 },
  his: { x: -4.1 + FROM_BACKLOT.dx, z: -101.5 + FROM_BACKLOT.dz, yaw: Math.PI / 2 },
};

// ---- the river road -------------------------------------------------------------------------
// its centre line, north to south (the quay bends with the river); the
// carriageway +-6, the quay's pavement 3.5 m to the railing, the water past it
export const RIVER = {
  hw: 6, pe: 3.5, pw: 3, rail: 9.6, quay: 10.1,
  pts: [[110, -262], [111, -230], [114, -200], [121, -152], [124, -100], [119, -60], [113, -25], [113, 15], [119, 60], [126, 105], [128, 140], [127, 168]],
  end: 168,      // the road ends in the pier's yard
};
// sampled every metre: x, z, the heading h (unit forward fx, fz), right rx, rz
const RS = (() => {
  const curve = new THREE.CatmullRomCurve3(RIVER.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const len = curve.getLength();
  const n = Math.ceil(len);
  const X = new Float32Array(n + 1), Z = new Float32Array(n + 1);
  const pts = curve.getSpacedPoints(n);
  for (let i = 0; i <= n; i++) { X[i] = pts[i].x; Z[i] = pts[i].z; }
  return { X, Z, n, len: n };
})();
export const RIVER_LEN = RS.len;
// the frame at s (metres from the north end): centre, forward, right
export function riverFrame(s, out = {}) {
  s = Math.max(0, Math.min(RS.n, s));
  const i = Math.min(RS.n - 1, Math.floor(s)), u = s - i;
  out.x = RS.X[i] + (RS.X[i + 1] - RS.X[i]) * u;
  out.z = RS.Z[i] + (RS.Z[i + 1] - RS.Z[i]) * u;
  let fx = RS.X[i + 1] - RS.X[i], fz = RS.Z[i + 1] - RS.Z[i];
  const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
  out.fx = fx; out.fz = fz;
  // (right of a car heading south (+z) is west (-x))
  out.rx = -fz; out.rz = fx;
  out.yaw = Math.atan2(-fz, fx);
  return out;
}
const _rf = {};
// a point d metres to the right of the river road's centre at s
export function riverPoint(s, d = 0, y = 0, out = new THREE.Vector3()) {
  const F = riverFrame(s, _rf);
  return out.set(F.x + F.rx * d, y, F.z + F.rz * d);
}
// (x, z) -> { s, d } on the river road (d + to the west: the right of a car
// going south)
export function riverProject(x, z, out = {}) {
  // the line runs north-south: a coarse search on z, then a refine
  let bi = 0, bd = Infinity;
  for (let i = 0; i <= RS.n; i += 4) { const d = (RS.X[i] - x) ** 2 + (RS.Z[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
  for (let i = Math.max(0, bi - 4); i <= Math.min(RS.n, bi + 4); i++) { const d = (RS.X[i] - x) ** 2 + (RS.Z[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
  const F = riverFrame(bi, _rf);
  const dx = x - F.x, dz = z - F.z;
  out.s = Math.max(0, Math.min(RS.n, bi + dx * F.fx + dz * F.fz));
  out.d = dx * F.rx + dz * F.rz;
  return out;
}
// the s at which the river road passes z (it runs north-south)
export function riverSAtZ(z) {
  for (let i = 0; i < RS.n; i++) if (RS.Z[i + 1] >= z) return i + (z - RS.Z[i]) / Math.max(1e-6, RS.Z[i + 1] - RS.Z[i]);
  return RS.n;
}
export const RIVER_SAMPLES = RS;

// ---- the blocks ----------------------------------------------------------------------------------
// the corridors (facade to facade) between which the blocks stand
const xBands = () => {
  const L = NS_LIST.map((k) => NS[k]);
  const out = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i].x + L[i].hw + L[i].p;
    const b = i + 1 < L.length ? L[i + 1].x - L[i + 1].hw - L[i + 1].p : WHARF_X;
    out.push([a, b]);
  }
  return out;
};
const zBands = () => {
  const L = EW_LIST.map((k) => EW[k]);
  const out = [];
  for (let i = 0; i + 1 < L.length; i++) out.push([L[i].z + L[i].hw + L[i].p, L[i + 1].z - L[i + 1].hw - L[i + 1].p]);
  return out;
};
export const XB = xBands();   // [[x0, x1]] west to east
export const ZB = zBands();   // [[z0, z1]] north to south

// a block: its building line (x0, x1, z0, z1), its kerb line (the pavement
// round it), its kind, and the cuts through it (alleys, lots)
//   kind: 'block' | 'square' (the market) | 'lot'
// the special ones by their grid cell (i west to east, j north to south)
export const SPECIAL = {
  '1,1': { kind: 'square', name: 'market' },              // Cooper..avenue, Market..Clock
  '2,2': { lot: [-87, -66, -92, -63], name: 'elLot' },      // the el's corner into Harbor St: an open lot under it
  '0,3': { pell: true },                                  // split by Pell Lane
  '3,2': { alleyNS: 12.5 },                               // the alley from Clock to Harbor
  '1,3': { alleyEW: 15 },                                 // the alley from Cooper to the avenue
  '0,1': { deadEnd: { z: -136.5, x1: -183, x0: -214 } },  // a dead end off Cooper, a wall at its end
  '2,3': { cinema: true },                                // the Bijou on Fifth St
  '3,1': { clock: true },                                 // the clock tower, Clock x Baxter
  '3,4': { yard: true },                                  // a coal yard behind a plank fence (the roadworks' block)
};
export const ALLEY_W = 5.5;

export const BLOCKS = (() => {
  const out = [];
  XB.forEach(([x0, x1], i) => ZB.forEach(([z0, z1], j) => {
    const sp = SPECIAL[`${i},${j}`] || {};
    // the pavement round it: the kerb line (out to the streets' kerbs)
    const pw = i === 0 ? NS.yard.p : NS[NS_LIST[i]].p;
    const pe = i + 1 < NS_LIST.length ? NS[NS_LIST[i + 1]].p : 3;
    const pn = EW[EW_LIST[j]].p, ps = EW[EW_LIST[j + 1]].p;
    const b = { i, j, x0, x1, z0, z1, kx0: x0 - pw, kx1: x1 + pe, kz0: z0 - pn, kz1: z1 + ps, kind: sp.kind || 'block', ...sp };
    // (the river side: the warehouses' fronts are the wharf's, the apron
    // past them to the river road is the wharf's own ground)
    if (i === XB.length - 1) b.kx1 = x1;
    out.push(b);
  }));
  return out;
})();
export const blockAt = (i, j) => BLOCKS.find((b) => b.i === i && b.j === j);

// ---- the el -------------------------------------------------------------------------------------
// its centre line: from beyond the canal down the avenue, round into Harbor
// St, along it to the river, round and down the river road to the docks.
// The corners are arcs of radius R (over the el lot and the wharf)
export const EL = (() => {
  const R = 26;
  const pts = [];
  const ax = NS.avenue.x, hz = EW.harbor.z;
  for (let z = -330; z <= hz - R; z += 4) pts.push([ax, z]);
  for (let k = 1; k < 12; k++) { const a = Math.PI - (k / 12) * (Math.PI / 2); pts.push([ax + R + Math.cos(a) * R, hz - R + Math.sin(a) * R]); }
  const sR = riverSAtZ(hz + 22);
  const rx = riverFrame(sR, {}).x;
  for (let x = ax + R; x <= rx - R; x += 4) pts.push([x, hz]);
  // round into the river road (it bends: the arc meets the road's line)
  const c = [rx - R, hz + R];
  for (let k = 1; k < 12; k++) { const a = Math.PI / 2 - (k / 12) * (Math.PI / 2); pts.push([c[0] + Math.cos(a) * R, c[1] - Math.sin(a) * R]); }
  const s0 = riverSAtZ(hz + R + 2), s1 = riverSAtZ(160);
  for (let s = s0; s <= s1; s += 4) { const f = riverFrame(s, {}); pts.push([f.x, f.z]); }
  return { pts, R, deckY: 9.5 };
})();

// ---- the special places --------------------------------------------------------------------------
export const PIER = {
  // the yard at the river road's end, the gate in its east side, the shed on
  // the pier beyond it, the freighter along the pier's south face
  yard: { x0: 98, x1: 142, z0: 158, z1: 196 },
  gate: { x: 142, z: 178, w: 7 },
  park: { x: 133, z: 176, yaw: 0 },          // where I stop (lamps off, E: get out)
  shed: { x0: 142, x1: 205, z0: 166, z1: 190, h: 11 },
  freighter: { x0: 150, x1: 250, z: 201, beam: 13 },
  crane: { x: 178, z: 194 },
  // [3rd owner] what stands in the yard's west half (the critic: 44 x 38 m of
  // bare paving): a lorry parked along the west wall, crates stacked by the
  // way in, timber by the water; and the loading bay painted where I stop
  lorry: { x: 106.5, z: 181, yaw: Math.PI / 2 },
  stacks: [[101.4, 165.5, 1.1, 1.3, 1.05], [101.4, 169.6, 1.1, 1.3, 2.1], [103.9, 165.5, 1.1, 1.3, 1.05], [113.5, 192.6, 2.4, 0.8, 0.9]],
  bay: { x: 133, z: 176, hx: 3.4, hz: 1.7 },
};
export const BRIDGE = { x: NS.avenue.x, z0: -258, z1: -292 };   // the lift bridge, up
export const CANAL = { z0: -258, z1: -296 };
export const YARD_X = -258;                                    // the rail yard's fence
export const DEPOT_Z = 134;                                    // the depot sheds' fronts
export const GASOMETER = { x: -30, z: -350, r: 26, h: 34 };
export const WATER_TOWER = { x: -300, z: -70 };
export const CLOCK = { x: -12, z: -113, h: 34 };               // the tower at Clock x Baxter (its corner)
export const CINEMA = { x: -60, z: 42, w: 22 };                // the Bijou's marquee over Fifth St's north pavement
export const ROADWORKS = { x: NS.baxter.x, z0: 62, z1: 112 };

// ---- the ground: road 0, pavements PAVE (the kerb eased over 0.2 m) ---------------------------------
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const inRect = (x, z, x0, x1, z0, z1, e = 0.1) => ss(x0 - e, x0 + e, x) * (1 - ss(x1 - e, x1 + e, x)) * ss(z0 - e, z0 + e, z) * (1 - ss(z1 - e, z1 + e, z));
// the raised slabs: each block's kerb rectangle (the square is flush), Pell's
// pavements, the wharf's quay pavement (by the river road's d)
export const SLABS = (() => {
  const S = [];
  for (const b of BLOCKS) {
    if (b.kind === 'square') continue;
    if (b.pell) {
      // west of Pell: its west pavement; east: its east pavement (to the fence)
      S.push([b.kx0, PELL.x - PELL.hw, b.kz0, b.kz1]);
      S.push([PELL.x + PELL.hw, b.kx1, b.kz0, b.kz1]);
      continue;
    }
    S.push([b.kx0, b.kx1, b.kz0, b.kz1]);
  }
  // the yard road's west pavement against the fence, the canal's north
  // pavement, the depot's south pavement
  S.push([YARD_X, NS.yard.x - NS.yard.hw, -262, 140]);
  S.push([-262, 104, CANAL.z0, EW.canal.z - EW.canal.hw]);
  S.push([-262, WHARF_X, EW.dock.z + EW.dock.hw, DEPOT_Z + 2]);
  return S;
})();
const _rp = {};
export function groundAt(x, z) {
  let k = 0;
  for (const S of SLABS) {
    if (x < S[0] - 0.2 || x > S[1] + 0.2 || z < S[2] - 0.2 || z > S[3] + 0.2) continue;
    const v = inRect(x, z, S[0], S[1], S[2], S[3]);
    if (v > k) k = v;
    if (k >= 1) break;
  }
  // the river road's quay pavement (east of its east kerb), and its west
  // pavement in front of the wharf
  if (x > WHARF_X - 2 && z > -270 && z < RIVER.end + 30) {
    riverProject(x, z, _rp);
    if (_rp.s > 0.5 && _rp.s < RS.n - 0.5) {
      const e = -_rp.d;          // (east of the centre)
      if (e > RIVER.hw - 0.1) k = Math.max(k, ss(RIVER.hw - 0.1, RIVER.hw + 0.1, e));
      if (_rp.d > RIVER.hw - 0.1 && _rp.d < RIVER.hw + RIVER.pw + 0.1) k = Math.max(k, ss(RIVER.hw - 0.1, RIVER.hw + 0.1, _rp.d) * (1 - ss(RIVER.hw + RIVER.pw - 0.1, RIVER.hw + RIVER.pw + 0.1, _rp.d)));
      // (past the quay: the water; the streets cross the west pavement flush)
      if (e > RIVER.quay) return WATER_Y;
    }
  }
  return PAVE * k;
}

// ---- the road graph (the drivers': his car, the traffic, the bots) ------------------------------------
// nodes at the junctions; edges along the streets between them. A lane is
// the edge's line offset to the right of the way it is driven (`lane` m).
//   node: { id, x, z }   edge: { a, b, pts: [[x, z]...], lane, w, street }
export const GRAPH = (() => {
  const nodes = new Map(), edges = [];
  const node = (id, x, z) => { if (!nodes.has(id)) nodes.set(id, { id, x, z, edges: [] }); return nodes.get(id); };
  const edge = (a, b, pts, lane, street, extra = {}) => {
    const e = { a, b, pts, lane, street, ...extra };
    e.len = 0; for (let i = 1; i < pts.length; i++) e.len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    edges.push(e); nodes.get(a).edges.push(e); nodes.get(b).edges.push(e);
    return e;
  };
  const laneOf = (hw, el) => (el ? 1.45 : hw >= 6 ? 1.9 : 1.65);
  // the river road's junctions: each east-west street meets it
  const rNode = {};
  for (const k of EW_LIST) {
    const z = EW[k].z;
    const s = riverSAtZ(z);
    const f = riverFrame(s, {});
    rNode[k] = node(`river.${k}`, f.x, f.z);
    rNode[k].s = s;
  }
  // the grid's junctions
  for (const n of NS_LIST) for (const e of EW_LIST) node(`${n}.${e}`, NS[n].x, EW[e].z);
  // north-south edges
  for (const n of NS_LIST) {
    const S = NS[n];
    for (let i = 0; i + 1 < EW_LIST.length; i++) {
      const a = `${n}.${EW_LIST[i]}`, b = `${n}.${EW_LIST[i + 1]}`;
      const za = EW[EW_LIST[i]].z, zb = EW[EW_LIST[i + 1]].z;
      // (the roadworks close Baxter between Fifth and Dock)
      if (S.works && za >= 50 && zb <= 125) continue;
      edge(a, b, [[S.x, za], [S.x, zb]], laneOf(S.hw, S.el), n);
    }
  }
  // east-west edges (and on to the river road)
  for (const e of EW_LIST) {
    const S = EW[e];
    for (let i = 0; i + 1 < NS_LIST.length; i++) edge(`${NS_LIST[i]}.${e}`, `${NS_LIST[i + 1]}.${e}`, [[NS[NS_LIST[i]].x, S.z], [NS[NS_LIST[i + 1]].x, S.z]], laneOf(S.hw, S.el), e);
    const r = rNode[e];
    edge(`water.${e}`, r.id, [[NS.water.x, S.z], [r.x, S.z]], laneOf(S.hw, S.el), e);
  }
  // the river road between its junctions (its own bending line)
  for (let i = 0; i + 1 < EW_LIST.length; i++) {
    const A = rNode[EW_LIST[i]], B = rNode[EW_LIST[i + 1]];
    const pts = [];
    for (let s = A.s; s < B.s; s += 4) { const f = riverFrame(s, {}); pts.push([f.x, f.z]); }
    pts.push([B.x, B.z]);
    edge(A.id, B.id, pts, 1.45, 'river');
  }
  // on to the pier's yard
  {
    const A = rNode.dock, pts = [];
    for (let s = A.s; s < RS.n; s += 4) { const f = riverFrame(s, {}); pts.push([f.x, f.z]); }
    const f = riverFrame(RS.n, {});
    node('pier', f.x, f.z);
    pts.push([f.x, f.z]);
    edge(A.id, 'pier', pts, 1.45, 'river');
  }
  // Pell Lane
  node('pell.harbor', PELL.x, EW.harbor.z); node('pell.fifth', PELL.x, EW.fifth.z);
  edge('pell.harbor', 'pell.fifth', [[PELL.x, EW.harbor.z], [PELL.x, EW.fifth.z]], 1.6, 'pell');
  // (Harbor St and Fifth St are split where Pell meets them)
  splitEdge(edges, nodes, 'yard.harbor', 'cooper.harbor', 'pell.harbor');
  splitEdge(edges, nodes, 'yard.fifth', 'cooper.fifth', 'pell.fifth');
  // the alleys: one lane, both ways
  {
    const x = SPECIAL['3,2'].alleyNS;
    node('alley.clock', x, EW.clock.z); node('alley.harbor', x, EW.harbor.z);
    splitEdge(edges, nodes, 'baxter.clock', 'water.clock', 'alley.clock');
    splitEdge(edges, nodes, 'baxter.harbor', 'water.harbor', 'alley.harbor');
    edge('alley.clock', 'alley.harbor', [[x, EW.clock.z], [x, EW.harbor.z]], 0, 'alleyNS', { alley: true });
    const z = SPECIAL['1,3'].alleyEW;
    node('alley.cooper', NS.cooper.x, z); node('alley.avenue', NS.avenue.x, z);
    splitEdge(edges, nodes, 'cooper.harbor', 'cooper.fifth', 'alley.cooper');
    splitEdge(edges, nodes, 'avenue.harbor', 'avenue.fifth', 'alley.avenue');
    edge('alley.cooper', 'alley.avenue', [[NS.cooper.x, z], [NS.avenue.x, z]], 0, 'alleyEW', { alley: true });
  }
  // the market square: across it, corner to corner (and along its sides)
  {
    const A = 'cooper.clock', B = 'avenue.market', C = 'cooper.market', D = 'avenue.clock';
    const n = (k) => nodes.get(k);
    edge(A, B, [[n(A).x, n(A).z], [n(B).x, n(B).z]], 0, 'square', { square: true });
    edge(C, D, [[n(C).x, n(C).z], [n(D).x, n(D).z]], 0, 'square', { square: true });
  }
  return { nodes, edges };
})();

// an edge a-b split at a new node m (already made) on its line
function splitEdge(edges, nodes, a, b, m) {
  const i = edges.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  if (i < 0) return;
  const e = edges[i];
  edges.splice(i, 1);
  for (const k of [e.a, e.b]) { const N = nodes.get(k); N.edges = N.edges.filter((x) => x !== e); }
  const M = nodes.get(m);
  const mk = (p, q) => {
    const P = nodes.get(p), Q = nodes.get(q);
    const f = { a: p, b: q, pts: [[P.x, P.z], [Q.x, Q.z]], lane: e.lane, street: e.street, len: Math.hypot(Q.x - P.x, Q.z - P.z) };
    edges.push(f); P.edges.push(f); Q.edges.push(f);
  };
  mk(e.a, m); mk(m, e.b);
  void M;
}

export function edgeBetween(a, b) {
  const N = GRAPH.nodes.get(a);
  return N ? N.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)) || null : null;
}
