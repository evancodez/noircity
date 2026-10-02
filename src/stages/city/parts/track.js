import * as THREE from 'three';
import { groundAt, RIVER, RIVER_LEN, riverPoint, YARD_X, CANAL, DEPOT_Z, WHARF_X, PELL, PIER, BRIDGE, NS, ROADWORKS, SPECIAL, ALLEY_W } from '../plan.js';

// What the cars drive in (src/vehicles/Car.js reads stage.track with
// plane = true): the walls and fences as boxes, the el's columns and the
// lamp posts as round things (a post gives to a hard blow: it bends and goes
// out), the bodies (every car of game.vehicles, and the parked ones of the
// cars part), the things that burst (the smash part), the ground's height
// (the pavements), and the headlamps' two real lights (made with the stage,
// so the light count never changes when a car comes on).
//   track.statics(x, z, r, out)  the static things near a point
//   track.addBox(cx, cz, hx, hz, angle, tag) / addCircle(x, z, r, tag, extra)
//   track.bodies()  track.ground(x, z)  track.smash  track.spots
//   track.blocked(x0, z0, x1, z1, tags)  does a straight line cross a wall
//   (the scene's sight of his car, the drivers')
// makeTrack builds the same world headless (tools/lib/c3city.mjs).
const CELL = 16;

export default {
  name: 'track', order: 95,
  build(stage) {
    const L = stage.part('lamps');
    const T = makeTrack({
      lots: stage.part('buildings').lots,
      columns: stage.part('el').columns,
      posts: L.posts.map((l) => ({ x: l.post.x, z: l.post.z, lamp: l })),
    });
    for (const c of T.circles) if (c.lamp) c.lamp.collider = c;
    // the headlamps' lights (no shadows): off until a car takes one
    for (let i = 0; i < 2; i++) {
      const s = new THREE.SpotLight(0xffffff, 0, 40, 0.42, 0.55, 1.6);
      s.position.set(0, -50, 0);
      s.castShadow = false;
      stage.scene.add(s, s.target);
      T.spots.push(s);
    }
    T.smash = stage.part('smash');
    T.parked = (stage.part('cars') && stage.part('cars').parked) || [];
    T.vehicles = () => { const G = stage.game; return G && G.vehicles ? G.vehicles.list : []; };
    return T;
  },
};

// the cars' world from the city's layout: lots, columns, posts -> the api
export function makeTrack({ lots, columns, posts }) {
  const grid = new Map();
  const boxes = [], circles = [];
  const key = (i, j) => i * 100003 + j;
  const insert = (o, x0, x1, z0, z1) => {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = key(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(o);
    }
  };
  const addBox = (cx, cz, hx, hz, angle = 0, tag = 'wall', extra = {}) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const b = { cx, cz, hx, hz, angle, c, s, tag, ...extra };
    const ex = hx * Math.abs(c) + hz * Math.abs(s), ez = hx * Math.abs(s) + hz * Math.abs(c);
    b.ex = ex; b.ez = ez;
    insert(b, cx - ex, cx + ex, cz - ez, cz + ez);
    boxes.push(b);
    return b;
  };
  const addCircle = (x, z, r, tag = 'post', extra = {}) => {
    const c = { x, z, r, tag, ...extra };
    insert(c, x - r, x + r, z - r, z + r);
    circles.push(c);
    return c;
  };
  const rect = (x0, x1, z0, z1, tag = 'wall') => addBox((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, tag);
  // the buildings: every lot's footprint
  for (const l of lots) rect(l.x0, l.x1, l.z0, l.z1, 'wall');
  // the edges: the rail yard's fence, the canal's railing (the bridge's
  // barrier across the avenue), the depot's sheds, the river's railing
  rect(YARD_X - 1.0, YARD_X, -265, 145, 'fence');
  rect(-265, BRIDGE.x - NS.avenue.hw, CANAL.z0 - 0.4, CANAL.z0 + 0.15, 'rail');
  rect(BRIDGE.x + NS.avenue.hw, 112, CANAL.z0 - 0.4, CANAL.z0 + 0.15, 'rail');
  rect(BRIDGE.x - NS.avenue.hw, BRIDGE.x + NS.avenue.hw, CANAL.z0 - 1.6, CANAL.z0 - 0.2, 'barrier');
  rect(-265, WHARF_X, DEPOT_Z, DEPOT_Z + 30, 'wall');
  for (let s = 0; s < RIVER_LEN; s += 5) {
    const a = riverPoint(s, -RIVER.rail), b = riverPoint(Math.min(RIVER_LEN, s + 5), -RIVER.rail);
    addBox((a.x + b.x) / 2, (a.z + b.z) / 2, Math.hypot(b.x - a.x, b.z - a.z) / 2 + 0.05, 0.12, Math.atan2(-(b.z - a.z), b.x - a.x), 'rail');
  }
  // the river road's north end (the canal's mouth): closed
  rect(96, 128, CANAL.z0 - 0.4, CANAL.z0 + 0.15, 'rail');
  // Pell Lane's east side: the board fence of the yard by the cars, its
  // wall north of the lane's end
  rect(PELL.x + PELL.hw + PELL.pe, PELL.x + PELL.hw + PELL.pe + 0.3, -12, 12, 'wall');
  rect(PELL.x + PELL.hw + PELL.pe, PELL.x + PELL.hw + PELL.pe + 0.15, 12, 42, 'fence');
  rect(PELL.x + PELL.hw + PELL.pe, PELL.x + PELL.hw + PELL.pe + 14, 41.7, 42, 'fence');
  // the dead end's wall
  { const D = SPECIAL['0,1'].deadEnd; rect(D.x0 - 1, D.x0, D.z - ALLEY_W / 2, D.z + ALLEY_W / 2, 'wall'); }
  // the roadworks: the trench and the spoil between Fifth and Dock (the
  // sawhorses before them give: the smash part's)
  rect(ROADWORKS.x - NS.baxter.hw, ROADWORKS.x + NS.baxter.hw, ROADWORKS.z0 + 3, ROADWORKS.z1 - 3, 'works');
  // the pier's yard: the gate (shut), the shed, the water round the yard
  const Y = PIER.yard;
  rect(PIER.gate.x, PIER.gate.x + 0.4, PIER.gate.z - PIER.gate.w / 2, PIER.gate.z + PIER.gate.w / 2, 'gate');
  rect(PIER.gate.x, PIER.shed.x1, Y.z0 - 2, PIER.gate.z - PIER.gate.w / 2, 'wall');
  rect(PIER.gate.x, PIER.shed.x1, PIER.gate.z + PIER.gate.w / 2, Y.z1, 'wall');
  rect(Y.x0, Y.x1, Y.z1, Y.z1 + 1, 'rail');
  rect(Y.x0 - 1, Y.x0, DEPOT_Z, Y.z1, 'wall');
  // the el's columns
  for (const c of columns) addCircle(c.x, c.z, c.r, 'column');
  // the lamp posts: they give to a hard blow
  for (const p of posts) addCircle(p.x, p.z, 0.2, 'post', { give: true, giveAt: 4.5, hurt: 0.1, drag: 0.8, lamp: p.lamp || null });
  const seen = new Set();
  const api = {
    plane: true, spots: [], boxes, circles, addBox, addCircle,
    ground: groundAt,
    smash: null, parked: [], vehicles: () => [],
    // (the old track's: a car's s / d mean nothing on the plane)
    project(x, z, hint, out = {}) { out.s = 0; out.d = 0; return out; },
    statics(x, z, r, out = []) {
      out.length = 0;
      seen.clear();
      for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const L2 = grid.get(key(i, j));
        if (!L2) continue;
        for (const o of L2) if (!seen.has(o)) { seen.add(o); out.push(o); }
      }
      return out;
    },
    bodies() { const V = api.vehicles(); return api.parked.length ? V.concat(api.parked) : V; },
    blocked(x0, z0, x1, z1, tags = null) {
      const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
      const n = Math.ceil(len / (CELL * 0.5)) + 1;
      const tested = new Set();
      for (let k = 0; k <= n; k++) {
        const u = k / n, px = x0 + dx * u, pz = z0 + dz * u;
        const L2 = grid.get(key(Math.floor(px / CELL), Math.floor(pz / CELL)));
        if (!L2) continue;
        for (const b of L2) {
          if (b.r != null || tested.has(b)) continue;
          tested.add(b);
          if (tags && !tags.includes(b.tag)) continue;
          if (segBox(x0, z0, x1, z1, b)) return b;
        }
      }
      return null;
    },
  };
  return api;
}

// a segment against an oriented box (slab test in the box's frame)
export function segBox(x0, z0, x1, z1, b) {
  const lx0 = (x0 - b.cx) * b.c - (z0 - b.cz) * b.s, lz0 = (x0 - b.cx) * b.s + (z0 - b.cz) * b.c;
  const lx1 = (x1 - b.cx) * b.c - (z1 - b.cz) * b.s, lz1 = (x1 - b.cx) * b.s + (z1 - b.cz) * b.c;
  let t0 = 0, t1 = 1;
  const dx = lx1 - lx0, dz = lz1 - lz0;
  for (const [p, d, h] of [[lx0, dx, b.hx], [lz0, dz, b.hz]]) {
    if (Math.abs(d) < 1e-9) { if (p < -h || p > h) return false; continue; }
    let a = (-h - p) / d, c = (h - p) / d;
    if (a > c) { const t = a; a = c; c = t; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return false;
  }
  return true;
}
