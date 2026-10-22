import * as THREE from 'three';
import { segBox } from '../../../world/graph.js';

// What the cars drive in (src/vehicles/Car.js reads stage.track with
// plane = true): the lots' walls, the edges, the quay's railing, the
// bridge's parapets and barrier, the rail yard's fence (boxes); the el's
// columns, the lamp posts (solid: O6 makes them give), the
// hydrants, the bollards (circles); the bodies (every car of game.vehicles,
// the parked ones); the ground's height (kerbs, the slipways, the water);
// the two real headlamp lights. The same api as the old city's track.
//   track.statics(x, z, r, out)  track.addBox / addCircle  track.bodies()
//   track.ground(x, z)  track.blocked(x0, z0, x1, z1, tags)  track.spots  track.smash (O6)
const CELL = 16;

export default {
  name: 'track', order: 130,
  build(stage) {
    const C = stage.part('city').C;
    const el = stage.part('el');
    const grid = new Map(), boxes = [], circles = [];
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
    for (const w of C.walls) addBox(w.cx, w.cz, w.hx, w.hz, w.angle, w.tag === 'edge' ? 'wall' : w.tag);
    // (a lamp post is solid, as a hydrant and the el's columns are: it is
    // merged into its chunk's iron, so a post that gave to a car would stay
    // standing in the picture with the car through it - the critic's B1. O6
    // draws a breakable post on its own mesh and gives it back its give:
    // { give: true, giveAt: 4.5, hurt: 0.1, drag: 0.8 } and hides the merged one)
    for (const p of C.posts) addCircle(p.x, p.z, p.r, p.tag === 'bollard' || p.tag === 'lamp' ? 'post' : p.tag, p.tag === 'lamp' ? { lamp: true } : {});
    if (el) for (const c of el.columns) addCircle(c.x, c.z, c.r, 'column');
    // the lamps' records know their post (O6: a bent post puts its lamp out)
    const L = stage.part('lamps');
    if (L) for (const c of circles) if (c.lamp === true) c.lamp = L.near(c.x, c.z, 0.6);
    // the headlamps' lights (no shadows): off until a car takes one
    const spots = [];
    for (let i = 0; i < 2; i++) {
      const s = new THREE.SpotLight(0xffffff, 0, 40, 0.42, 0.55, 1.6);
      s.position.set(0, -50, 0);
      s.castShadow = false;
      stage.scene.add(s, s.target);
      spots.push(s);
    }
    const seen = new Set();
    const api = {
      plane: true, spots, boxes, circles, addBox, addCircle,
      ground: (x, z) => C.groundAt(x, z),
      smash: null, parked: [],
      vehicles: () => { const G = stage.game; return G && G.vehicles ? G.vehicles.list : []; },
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
  },
};
