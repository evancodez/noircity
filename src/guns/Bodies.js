import * as THREE from 'three';

// Bodies are solid (lane C2): the one physical layer for people, offered to
// the cast as it is used by the gunmen. game.bodies.
//   const b = bodies.add(owner, { r: 0.3 })   a circle in the stage's colliders that
//                                            follows owner.pos (a Character, a Hood, any
//                                            { pos }); the player and every man who
//                                            resolves against the colliders is kept off it
//   bodies.remove(b)                          (and every body when the stage changes)
//   bodies.free(x, z, r = 0.3, skip = null)   is there room for a body here? (no wall,
//                                            furniture, car, man or player within r)
//   bodies.path(from, to)                     a way round what stands (the stage's nav grid:
//                                            [Vector3] or null)
//   bodies.steer(b | pos, to, { r, speed, look: 1.2 }) -> { x, z, wait }  a velocity toward
//                                            `to` along its path, slowed and turned off its
//                                            line by bodies in the way (the player, the other
//                                            men, the cast); `wait` when the way is taken (a
//                                            doorway with a man in it) - wait, or go round
//   bodies.update()                           (the Game calls it: circles follow their owners)
// A man is a circle; he never enters furniture, walls, door jambs, cars, the
// player or another man: he steers round, and waits where the way is taken.
// [C2b] The dead block nobody: a body lies where it fell (the gun kit's
// K.corpses, tag 'corpse') but it is not a collider - the player steps over
// it (Guns.overBody) and the living walk through it.
const _v = new THREE.Vector3();

export class Bodies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.stage = null;
  }

  get colliders() { return this.game.stage.colliders; }

  add(owner, { r = 0.3, tag = 'cast' } = {}) {
    this.sync();
    const p = owner.pos || owner;
    const c = this.colliders.addCircle(p.x, p.z, r, tag);
    const b = { owner, circle: c, r };
    c.body = b;
    this.list.push(b);
    return b;
  }
  remove(b) {
    if (!b) return;
    const C = this.colliders, i = C.circles.indexOf(b.circle);
    if (i >= 0) C.circles.splice(i, 1);
    const j = this.list.indexOf(b);
    if (j >= 0) this.list.splice(j, 1);
  }
  // a new place: the old place's bodies stay with it
  sync() {
    const S = this.game.stage;
    if (this.stage !== S) { this.stage = S; this.list = []; }
  }

  update() {
    this.sync();
    for (const b of this.list) {
      const p = b.owner.pos || b.owner;
      if (b.owner.alive === false && !b.keepDead) continue;
      b.circle.x = p.x; b.circle.z = p.z;
    }
  }

  // room for a body of radius r at (x, z)?
  free(x, z, r = 0.3, skip = null) {
    const G = this.game, C = this.colliders;
    const nav = G.nav;
    if (nav && !nav.free(x, z)) return false;
    for (const c of C.circles) {
      if (c === skip || (skip && skip.circle === c) || c.r <= 0) continue;
      if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
    }
    for (const b of C.boxes) {
      if (b.hx < 0.01 && b.hz < 0.01) continue;
      const dx = x - b.cx, dz = z - b.cz;
      const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      const qx = Math.max(0, Math.abs(lx) - b.hx), qz = Math.max(0, Math.abs(lz) - b.hz);
      if (qx * qx + qz * qz < r * r) return false;
    }
    if (Math.hypot(x - G.eye.x, z - G.eye.z) < r + 0.36) return false;
    return true;
  }

  path(from, to) {
    const nav = this.game.nav;
    if (!nav) return null;
    return nav.findPath(from.x, from.z, to.x, to.z);
  }

  // a velocity toward `to` round what is in the way (see above)
  steer(b, to, { r = 0.3, speed = 1.4, look = 1.2 } = {}) {
    const G = this.game;
    const p = b.owner ? (b.owner.pos || b.owner) : b;
    const self = b.circle || null;
    let dx = to.x - p.x, dz = to.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) return { x: 0, z: 0, wait: false };
    dx /= d; dz /= d;
    // the others in the way: the player, the men, the cast
    const others = [];
    for (const c of this.colliders.circles) if (c !== self && (c.tag === 'hood' || c.tag === 'cast')) others.push({ x: c.x, z: c.z, r: c.r });
    others.push({ x: G.eye.x, z: G.eye.z, r: 0.36 });
    let ax = 0, az = 0, blocked = false;
    for (const o of others) {
      const ox = o.x - p.x, oz = o.z - p.z;
      const along = ox * dx + oz * dz;
      if (along < -0.2 || along > look) continue;
      const side = ox * -dz + oz * dx;
      const room = o.r + r + 0.05;
      if (Math.abs(side) > room) continue;
      // in the way: lean off to the side it is not on, harder the nearer
      const k = (1 - along / look) * (room - Math.abs(side)) / room;
      const s = side >= 0 ? -1 : 1;
      ax += -dz * s * k * 1.6; az += dx * s * k * 1.6;
      if (along < r + o.r + 0.15 && Math.abs(side) < room * 0.6) blocked = true;
    }
    let vx = dx + ax, vz = dz + az;
    const L = Math.hypot(vx, vz) || 1;
    vx /= L; vz /= L;
    // (a step into a wall is no step: the way round is the nav grid's)
    _v.set(p.x + vx * 0.35, 0, p.z + vz * 0.35);
    if (G.nav && !G.nav.free(_v.x, _v.z)) { vx = dx; vz = dz; }
    const k = blocked ? 0 : Math.min(1, d / 0.5);
    return { x: vx * speed * k, z: vz * speed * k, wait: blocked };
  }
}
