import * as THREE from 'three';

// Breakables (docs/story/CONTRACTS.md §8.2): anything a round, a fist, a
// body, a blast or a car can break. One set per stage (stage.breakables,
// game.breakables); a part registers its things while it builds.
//   breakables.add(object, { kind, hp: 1, mass, solid: true, collider?,
//                            onBreak(ctx, how) }) -> handle
//   breakables.hit(handle | object, { point, dir, power, by })   -> 'hit' | 'break' | null
//       by: 'bullet' | 'fist' | 'body' | 'blast' | 'car'
//   breakables.topple(handle | object, impulse: Vector3)   knock it over, whole
//   breakables.remove(handle)     breakables.list
// kinds: bottle, plate, cup, saucer, tumbler, stool, table, crate, barrel,
// sign, pipe, lampGlass, jukebox, pieCase, neon, wire, liquid, ...
// Bullets find a breakable through mesh.userData.breakable (fx/React.js).
// A break emits the game event 'break' { kind, pos, by } and asks for the
// sound 'break_<kind>' (sfx.play ignores a name it does not know yet).
//
// FOUNDATION STUB (lane 3 owns src/destruct/**): a break hides the object
// in a burst of the existing debris (flecks, not pieces); a topple lays the
// object on its side over 0.35 s; a jukebox is never destroyed. Its draws
// come from a fork of its own (never the stage's shared rng).
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
const HP_OF = { bullet: 1, fist: 0.35, body: 1, blast: 3, car: 3 };

export class Breakables {
  constructor(stage) {
    this.stage = stage;
    this.list = [];
    this.moving = [];
    this.rng = null;
  }

  add(object, { kind = 'thing', hp = 1, mass = 1, solid = true, collider = null, onBreak = null } = {}) {
    const h = { object, kind, hp, hp0: hp, mass, solid, collider, onBreak, broken: false, toppled: false };
    object.traverse((o) => { if (o.isMesh) { o.userData.breakable = h; if (!solid) o.userData.noRay = true; } });
    // (added once the stage stands: into the bullets' world now; during the
    // build the stage collects every mesh on its own)
    if (solid && this.stage.rays) object.traverse((o) => { if (o.isMesh) this.stage.addSolid(o); });
    object.userData.breakableHandle = h;
    this.list.push(h);
    return h;
  }

  handle(x) { return x && x.object ? x : x && x.userData ? x.userData.breakableHandle || x.userData.breakable || null : null; }

  remove(x) {
    const h = this.handle(x);
    if (!h) return;
    const i = this.list.indexOf(h);
    if (i >= 0) this.list.splice(i, 1);
  }

  get game() { return this.stage.game; }

  hit(x, { point = null, dir = new THREE.Vector3(0, 0, -1), power = 1, by = 'bullet' } = {}) {
    const h = this.handle(x);
    if (!h || h.broken) return null;
    if (h.kind === 'jukebox') return 'hit';          // (dented, never destroyed)
    h.hp -= power * (HP_OF[by] ?? 1);
    if (h.hp > 1e-6) return 'hit';
    this.breakIt(h, { point, dir, by });
    return 'break';
  }

  breakIt(h, { point = null, dir = new THREE.Vector3(0, 0, -1), by = 'bullet' } = {}) {
    const G = this.game, S = this.stage;
    h.broken = true;
    const pos = point ? point.clone() : h.object.getWorldPosition(new THREE.Vector3());
    h.object.visible = false;
    h.object.traverse((o) => { if (o.isMesh) S.removeSolid(o); });
    if (h.collider) {
      const C = S.colliders;
      for (const arr of [C.circles, C.boxes]) { const i = arr.indexOf(h.collider); if (i >= 0) arr.splice(i, 1); }
    }
    if (G && G.fx) {
      const r = this.rng || (this.rng = S.rng.fork(6161));
      for (let k = 0; k < 14; k++) {
        const s = r.range(0.02, 0.07);
        G.fx.debris.spawn({
          pos: pos.clone().add(new THREE.Vector3(r.gauss() * 0.05, r.gauss() * 0.05, r.gauss() * 0.05)),
          vel: new THREE.Vector3(r.gauss() * 1.2 + dir.x * 0.6, r.range(0.3, 2.0), r.gauss() * 1.2 + dir.z * 0.6),
          life: r.range(0.8, 1.5), size: [s, s * 0.6], rot: r.next() * 6.28, spin: r.gauss() * 10,
          col: [0.3, 0.3, 0.3], cell: 12, gravity: 9.8, ground: S.surfaceY(pos.x, pos.z) + 0.02, fadeOut: 0.15, lit: 1.5, litT: 0.1,
        });
      }
      G.sfx.play('break_' + h.kind, pos);
      G.emit('break', { kind: h.kind, pos, by });
    }
    if (h.onBreak) h.onBreak(G ? G.scenes ? G.scenes.ctx : G : null, { by, pos, dir });
  }

  // knock over whole: the object tips away from the impulse onto its side
  topple(x, impulse = new THREE.Vector3(1, 0, 0)) {
    const h = this.handle(x);
    if (!h || h.broken || h.toppled) return;
    h.toppled = true;
    const o = h.object;
    _v.set(impulse.x, 0, impulse.z);
    if (_v.lengthSq() < 1e-8) _v.set(1, 0, 0);
    _v.normalize();
    // the axis: horizontal, across the push
    _ax.set(_v.z, 0, -_v.x);
    this.moving.push({ h, q0: o.quaternion.clone(), axis: _ax.clone(), t: 0, dur: 0.35, shift: _v.clone().multiplyScalar(0.2 * (h.object.userData.size ? h.object.userData.size.y : 0.5)), p0: o.position.clone() });
    const G = this.game;
    if (G) G.sfx.play('topple_' + h.kind, o.getWorldPosition(new THREE.Vector3()));
  }

  // stand it back up (a retry, a preset)
  upright(x) {
    const h = this.handle(x);
    if (!h) return;
    const m = this.moving.find((e) => e.h === h);
    if (m) { h.object.quaternion.copy(m.q0); h.object.position.copy(m.p0); this.moving.splice(this.moving.indexOf(m), 1); }
    else if (h.rest) { h.object.quaternion.copy(h.rest.q); h.object.position.copy(h.rest.p); }
    h.toppled = false;
  }

  update(dt) {
    for (let i = this.moving.length - 1; i >= 0; i--) {
      const m = this.moving[i];
      m.t = Math.min(m.dur, m.t + dt);
      const u = m.t / m.dur, e = u * u;
      const o = m.h.object;
      o.quaternion.copy(m.q0).premultiply(_q.setFromAxisAngle(m.axis, Math.PI / 2 * e));
      o.position.copy(m.p0).addScaledVector(m.shift, e);
      if (m.t >= m.dur) { m.h.rest = { q: m.q0, p: m.p0 }; this.moving.splice(i, 1); }
    }
  }
}
