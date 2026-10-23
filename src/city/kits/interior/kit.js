import * as THREE from 'three';
import { mergeGeos, lathe } from '../../../props/lib.js';
import { buildProp } from '../../../props/index.js';
import { FOG } from '../../../render/fog.js';
import { interiorMats } from './mats.js';
import { makeDoor } from './door.js';
import { finishLabels } from './pieces.js';

// The interior kit (lane O5, OPEN_WORLD §3 Places): the pieces a room is
// assembled from, in its place's frame (frame.js: the street door's middle
// at the origin, +z out to the street, +x to my right as I walk in).
// A room is built when its place is loaded and dropped (its geometry freed)
// when it is left far behind; its props are kept (built once a place).
//   const K = new RoomKit(places, site)
//   K.room(x0, x1, z0, z1, { y, h, floor, wall, ceil, sides: { n, s, w, e }, look })
//       a box of a room: its floor (a walking surface), its ceiling, its four
//       walls (side n is -z, s is +z - the street -, w is -x, e is +x; false: no
//       wall there, a neighbour's; { holes: [{ a, b, top, bottom }] }: openings
//       along the wall), its look (the ink's interior: little fog, no rain on
//       the lens, the street's mirror off) and its dry volume
//   K.wall('x' | 'z', c, a0, a1, y0, y1, { t, key, holes, lvl, solid })
//   K.floor(x0, x1, z0, z1, y, key)   K.ceil(...)   K.box(key, x0, x1, y0, y1, z0, z1, part)
//   K.solid(x0, x1, z0, z1, { lvl, tag })   K.post(x, z, r)   a collider (local)
//   K.stairs(x0, x1, z0, z1, y0, y1, dir 'n'|'s'|'w'|'e' (the way up), { key, rail })
//   K.rail(x0, z0, x1, z1, y, { solid })
//   K.lamp(x, y, z, { kind: 'pendant' | 'bare' | 'globe' | 'cage', power, drop, on })
//   K.door({ x, z, axis, w, h, y, swing, locked, glass, double, lvl })   (door.js)
//   K.seat({ x, z, yaw, eyeY, at, prompt, standAt, onSit, onStand })
//   K.use({ at: [x, y, z], prompt, onUse, range, cone, when })
//   K.prop(kind, x, y, z, yaw, { variant, scale })    K.fig(kind, x, z, yaw, opts)
//   K.finish() -> the meshes merged by material and part; K.dispose()
// Parts (ink ids): 0 the shell (walls, floors, ceilings), 1 the furniture,
// 2 the fixtures (lamps, rails, the ring's posts), 3 the small things.
export const FLOOR = 0.3;
export const WALL_T = 0.24;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class RoomKit {
  constructor(places, site) {
    this.P = places; this.site = site; this.stage = places.stage; this.game = places.game;
    this.F = site.frame; this.mats = interiorMats(this.stage); this.FLOOR = FLOOR;
    this.id = site.ids;
    this.group = new THREE.Group(); this.group.name = 'place ' + site.id;
    // (what is seen from the street while the place is loaded - a fire escape's ladder: part 9, always drawn)
    this.outer = new THREE.Group(); this.outer.name = 'place out ' + site.id;
    this.B = new Map();
    this.cols = []; this.floors = []; this.ramps = []; this.vols = []; this.lamps = []; this.doors = [];
    this.uses = []; this.seats = []; this.figs = []; this.props = []; this.meshes = []; this.extra = [];
    this.levels = [FLOOR];
    // (the floor being built: its walls, colliders, doors, seats and uses are
    // that floor's - a man on another floor of the same plan walks through them)
    this.curLvl = null;
  }
  // build the floor n next (null: every floor; a single-floor room needs none)
  at(n) { this.curLvl = n; if (n != null && !this.levels.includes(n)) void 0; return this; }
  sfx(name, pos, ref = 2, p = {}) { const S = this.game && this.game.sfx; if (S) S.play(name, pos, p, { ref }); }

  // ---- geometry (local) -----------------------------------------------------------------------
  add(key, g, part = 1) {
    const k = key + '|' + part;
    if (!this.B.has(k)) this.B.set(k, []);
    this.B.get(k).push(g);
    return g;
  }
  box(key, x0, x1, y0, y1, z0, z1, part = 1) {
    return this.add(key, new THREE.BoxGeometry(Math.max(0.005, x1 - x0), Math.max(0.005, y1 - y0), Math.max(0.005, z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), part);
  }
  cyl(key, x, y0, y1, z, r0, r1 = r0, seg = 12, part = 1) {
    return this.add(key, new THREE.CylinderGeometry(r1, r0, y1 - y0, seg).translate(x, (y0 + y1) / 2, z), part);
  }

  // ---- colliders (local rects -> world boxes) --------------------------------------------------
  solid(x0, x1, z0, z1, { lvl = this.curLvl, tag = 'room' } = {}) {
    const B = this.F.box(x0, x1, z0, z1);
    const c = this.stage.colliders.addBox((B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2, Math.max(0.02, (B.x1 - B.x0) / 2), Math.max(0.02, (B.z1 - B.z0) / 2), 0, tag);
    c.lvl = lvl;
    this.cols.push(c);
    return c;
  }
  post(x, z, r, { lvl = this.curLvl, tag = 'room' } = {}) {
    const p = this.F.w(x, z);
    const c = this.stage.colliders.addCircle(p.x, p.z, r, tag);
    c.lvl = lvl;
    this.cols.push(c);
    return c;
  }

  // ---- floors, ceilings, walls --------------------------------------------------------------------
  // the walking surface (a rect at y; lvl: the floor's index) and its slab
  floor(x0, x1, z0, z1, y = FLOOR, key = 'boards', { slab = 0.25, lvl = this.curLvl ?? 0 } = {}) {
    if (key) this.box(key, x0, x1, y - slab, y, z0, z1, 0);
    this.surface(x0, x1, z0, z1, y, lvl);
  }
  surface(x0, x1, z0, z1, y, lvl = this.curLvl ?? 0) { this.floors.push({ x0, x1, z0, z1, y, lvl }); }
  ceil(x0, x1, z0, z1, y, key = 'plaster') { this.box(key, x0, x1, y, y + 0.22, z0, z1, 0); }
  // a wall along 'x' (at z = c, from x a0 to a1) or along 'z' (at x = c), y0..y1;
  // holes: [{ a, b, top, bottom }] along it (bottom near y0: a doorway - walked
  // through; higher: a window - solid to walk)
  wall(axis, c, a0, a1, y0, y1, { t = WALL_T, key = 'plaster', holes = [], lvl = this.curLvl, solid = true, part = 0 } = {}) {
    const H = [...holes].sort((p, q) => p.a - q.a);
    const B = (a, b, ya, yb) => {
      if (b - a < 0.004 || yb - ya < 0.004) return;
      if (axis === 'x') this.box(key, a, b, ya, yb, c - t / 2, c + t / 2, part);
      else this.box(key, c - t / 2, c + t / 2, ya, yb, a, b, part);
    };
    const S = (a, b) => {
      if (!solid || b - a < 0.02) return;
      if (axis === 'x') this.solid(a, b, c - t / 2, c + t / 2, { lvl });
      else this.solid(c - t / 2, c + t / 2, a, b, { lvl });
    };
    let at = a0, sa = a0;
    for (const h of H) {
      const bot = h.bottom ?? y0, top = h.top ?? (y0 + 2.1);
      B(at, h.a, y0, y1);
      B(h.a, h.b, top, y1);
      if (bot > y0 + 0.01) B(h.a, h.b, y0, bot);
      // (a doorway is a gap in the collider; a window is not)
      // (own: the hole has a collider of its own - a street window's, which goes when its glass does)
      if ((bot < y0 + 0.5 && !h.win) || h.own) { S(sa, h.a); sa = h.b; }
      at = h.b;
    }
    B(at, a1, y0, y1);
    S(sa, a1);
  }
  // a room: floor, ceiling, walls outside the rect, its volume (inside, look, dry)
  room(x0, x1, z0, z1, { y = FLOOR, h = 3.2, floor = 'boards', wall = 'plaster', ceil = 'plaster', sides = {}, t = WALL_T, look = {}, lvl = this.curLvl ?? 0, name = null } = {}) {
    if (floor) this.floor(x0 - t, x1 + t, z0 - t, z1 + t, y, floor, { lvl }); else this.surface(x0, x1, z0, z1, y, lvl);
    if (ceil) this.ceil(x0 - t, x1 + t, z0 - t, z1 + t, y + h, ceil);
    const side = (k) => (sides[k] === undefined ? true : sides[k]);
    const opt = (k) => ({ t, key: wall, holes: (side(k) && side(k).holes) || [], lvl: this.curLvl });
    if (side('n')) this.wall('x', z0 - t / 2, x0 - t, x1 + t, y, y + h, opt('n'));
    if (side('s')) this.wall('x', z1 + t / 2, x0 - t, x1 + t, y, y + h, opt('s'));
    if (side('w')) this.wall('z', x0 - t / 2, z0, z1, y, y + h, opt('w'));
    if (side('e')) this.wall('z', x1 + t / 2, z0, z1, y, y + h, opt('e'));
    this.volume(x0, x1, z0, z1, y, y + h, look, name);
  }
  volume(x0, x1, z0, z1, y0, y1, look = {}, name = null) {
    const B = this.F.box(x0, x1, z0, z1);
    const box = new THREE.Box3(V(B.x0, y0 - 0.3, B.z0), V(B.x1, y1, B.z1));
    this.vols.push({ box, local: { x0, x1, z0, z1, y0, y1 }, name, look: { fogDensity: FOG.density * 0.3, rainOverlay: 0, haze: 0.35, reflect: 'none', ambient: 0.55, room: this.site.room || 'office', ...look } });
  }

  // ---- stairs and rails -----------------------------------------------------------------------------
  // a flight from y0 to y1 inside the rect, going up toward dir ('n': -z, 's': +z, 'w': -x, 'e': +x)
  stairs(x0, x1, z0, z1, y0, y1, dir, { key = 'wood', lvl = this.curLvl ?? 0, part = 1, under = true } = {}) {
    const run = dir === 'n' || dir === 's' ? z1 - z0 : x1 - x0;
    const n = Math.max(2, Math.round((y1 - y0) / 0.19));
    const rise = (y1 - y0) / n, tread = run / n;
    for (let i = 0; i < n; i++) {
      const top = y0 + rise * (i + 1), bot = Math.max(y0 - 0.02, top - rise - (under ? 0.22 : rise));
      const a = i * tread, b = (i + 1) * tread + 0.02;
      if (dir === 'n') this.box(key, x0, x1, bot, top, z1 - b, z1 - a, part);
      else if (dir === 's') this.box(key, x0, x1, bot, top, z0 + a, z0 + b, part);
      else if (dir === 'w') this.box(key, x1 - b, x1 - a, bot, top, z0, z1, part);
      else this.box(key, x0 + a, x0 + b, bot, top, z0, z1, part);
    }
    this.ramps.push({ x0, x1, z0, z1, y0, y1, dir, lvl });
  }
  rail(x0, z0, x1, z1, y, { h = 0.95, solid = true, lvl = this.curLvl, key = 'iron', step = 1.1 } = {}) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step));
    for (let i = 0; i <= n; i++) { const t = i / n; this.cyl(key, x0 + (x1 - x0) * t, y, y + h, z0 + (z1 - z0) * t, 0.022, 0.022, 6, 2); }
    const g = new THREE.CylinderGeometry(0.03, 0.03, L, 6).rotateZ(Math.PI / 2).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, y + h, (z0 + z1) / 2);
    this.add(key, g, 2);
    if (solid) {
      if (Math.abs(x1 - x0) > Math.abs(z1 - z0)) this.solid(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1) - 0.06, Math.max(z0, z1) + 0.06, { lvl });
      else this.solid(Math.min(x0, x1) - 0.06, Math.max(x0, x1) + 0.06, Math.min(z0, z1), Math.max(z0, z1), { lvl });
    }
  }

  // ---- light ------------------------------------------------------------------------------------------
  // a lamp: its fitting drawn here, its bulb a mesh of its own (dark when it
  // is off), its light an entry in the city's lamps' deal (the nearest get
  // the cones and the real lights: inside a room its own are the nearest)
  lamp(x, y, z, { kind = 'pendant', power = 1, drop = null, on = true, ceilY = null, cone = true } = {}) {
    const mats = this.mats;
    const top = ceilY ?? y + 0.9;
    if (kind === 'pendant' || kind === 'bare' || kind === 'cage') this.cyl('iron', x, y + 0.12, top, z, 0.006, 0.006, 4, 2);
    if (kind === 'pendant') {
      const sh = lathe([[0.03, 0.16], [0.05, 0.15], [0.1, 0.1], [0.22, 0.0], [0.24, -0.02]], 20);
      this.add('lampIron', sh.translate(x, y, z), 2);
    } else if (kind === 'cage') {
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; this.add('iron', new THREE.CylinderGeometry(0.004, 0.004, 0.2, 3).translate(x + Math.cos(a) * 0.07, y - 0.02, z + Math.sin(a) * 0.07), 2); }
    } else if (kind === 'globe') {
      this.cyl('iron', x, y + 0.14, top, z, 0.012, 0.012, 6, 2);
    }
    const bulbR = kind === 'globe' ? 0.16 : 0.05;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(bulbR, 12, 8), on ? mats.bulb : this.stage.M.bulbDead);
    const p = this.F.v(x, y - (kind === 'globe' ? 0.05 : 0.04), z);
    bulb.position.copy(p);
    bulb.userData.inkId = this.id + 2; bulb.userData.noRay = true;
    this.group.add(bulb);
    this.extra.push(bulb);
    const L = { x: p.x, z: p.z, yaw: 0, kind: 'room', head: p.clone().setY(p.y - 0.06), on, dead: false, _k: on ? 1 : 0, cone: null, entry: null, hanging: true, room: true, power: 70 * power, drop: drop ?? (y - this.floorAt(y)), noCone: !cone, bulb };
    L.set = (v) => { L.on = v; bulb.material = v ? mats.bulb : this.stage.M.bulbDead; if (this.P.lampsApi) this.P.lampsApi.setOn(L, v); };
    this.lamps.push(L);
    return L;
  }
  floorAt(y) { let best = FLOOR; for (const f of this.levels) if (f <= y && f > best) best = f; return best; }

  // ---- doors, seats, uses ---------------------------------------------------------------------------
  door(spec) { return makeDoor(this, { lvl: this.curLvl, ...spec }); }
  seat(s) { const S = { prompt: 'sit', range: 1.9, cone: 0.5, eyeY: FLOOR + 1.25, lvl: this.curLvl, ...s }; this.seats.push(S); return S; }
  use(u) { const U = { range: 1.9, cone: 0.45, lvl: this.curLvl, ...u }; this.uses.push(U); return U; }

  // ---- props and people ------------------------------------------------------------------------------
  prop(kind, x, y, z, yaw = 0, { variant = null, scale = 1, name = null } = {}) {
    const cache = this.site.propCache || (this.site.propCache = []);
    const k = this.props.length;
    let o = cache[k] && cache[k].kind === kind && cache[k].variant === variant ? cache[k].o : null;
    if (!o) {
      o = buildProp(kind, variant ? { variant } : {});
      o.traverse((m) => { if (m.isMesh) m.userData.inkId = this.id + 3; });
      cache[k] = { kind, variant, o };
    }
    o.position.copy(this.F.v(x, y, z));
    o.rotation.set(0, this.F.yaw(yaw), 0);
    o.scale.setScalar(scale);
    o.visible = true;
    this.group.add(o);
    const P = { kind, o, name, home: o.position.clone() };
    this.props.push(P);
    return P;
  }
  // a figure of the cast (spawned when the place is loaded, removed when it goes)
  fig(kind, x, z, yaw = 0, { state = 'idle', name = null, seat = null, ...rest } = {}) {
    this.figs.push({ kind, x, z, yaw, state, name, seat, ...rest });
  }

  // ---- the meshes ---------------------------------------------------------------------------------
  finish() {
    for (const [k, list] of this.B) {
      const [key, part] = k.split('|');
      const mat = this.mats[key];
      if (!mat || !list.length) continue;
      const m = new THREE.Mesh(mergeGeos(list), mat);
      for (const g of list) g.dispose();
      m.matrixAutoUpdate = false; m.matrix.copy(this.F.M);
      m.userData.inkId = this.id + Number(part);
      const glow = key === 'bulb' || key === 'screen' || key === 'lit' || key === 'litDim';
      m.castShadow = Number(part) > 0 && !glow; m.receiveShadow = !glow;
      if (glow) m.userData.noRay = true;
      m.name = `${this.site.id} ${key}`;
      if (Number(part) === 9) { m.userData.inkId = this.id + 1; this.outer.add(m); } else this.group.add(m);
      this.meshes.push(m);
    }
    this.B.clear();
    finishLabels(this);
    this.group.updateMatrixWorld(true);
    this.outer.updateMatrixWorld(true);
    return this.meshes;
  }
  dispose() {
    for (const m of this.meshes) { m.geometry.dispose(); if (m.parent) m.parent.remove(m); }
    for (const b of this.extra) { b.geometry.dispose(); if (b.parent) b.parent.remove(b); }
    for (const d of this.doors) for (const l of d.leaves) l.hinge.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    for (const p of this.props) if (p.o.parent) p.o.parent.remove(p.o);
    for (const c of this.cols) this.stage.colliders.remove(c);
    if (this.labelTex) { this.labelTex.dispose(); this.labelMat.dispose(); }
    this.meshes.length = 0; this.extra.length = 0; this.cols.length = 0;
    if (this.group.parent) this.group.parent.remove(this.group);
    if (this.outer.parent) this.outer.parent.remove(this.outer);
  }
}
