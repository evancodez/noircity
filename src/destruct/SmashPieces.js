import * as THREE from 'three';

// [O6] The pieces of what breaks (lane O6, docs/seams/SMASH.md): planks,
// fruit, papers, canvas, glass grains, a bin's lid - each kind one
// InstancedMesh (one draw whatever the count), pooled from the start: a
// piece flies, tumbles, bounces, settles flat on what is under it (the
// stage's walking surface) and lies there. A full pool takes back the
// resting piece the eye cannot see (behind it, or furthest off): what lies
// in view stays. Nothing is made or freed after the build (memory flat).
//   pieces.spawn(name, pos, q, scale, vel, spin, { r, paper, roll, bounce }) -> piece | null
//   pieces.kick(car)   pieces.guard(car)   pieces.update(dt)   pieces.clear()
// (the old city's smash, lane C3: its pools, its kick and its guard of my cabin)
const G = 9.8;
const STEP_BUDGET = 160;    // pieces made in one step at most
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _f = new THREE.Vector3();

export class SmashPieces {
  constructor(stage, mats, caps = {}, idOf = null) {
    this.stage = stage;
    this.group = new THREE.Group();
    this.group.name = 'smashPieces';
    stage.scene.add(this.group);
    this.pools = {};
    this.live = [];          // flying, sliding
    this.n = 0;              // lying
    this.made = 0;           // made this step
    const pool = (name, geo, mat, cap) => {
      const im = new THREE.InstancedMesh(geo, mat, cap);
      im.name = 'smash_' + name;
      im.userData.inkId = idOf ? idOf('piece_' + name) : 1;
      im.userData.inkPerInstance = false;
      im.userData.noRay = true;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < cap; i++) im.setMatrixAt(i, ZERO);
      im.count = 0;
      im.visible = false;
      this.group.add(im);
      this.pools[name] = { name, im, cap, used: 0, free: [], owner: new Array(cap).fill(null) };
    };
    pool('plank', new THREE.BoxGeometry(1, 1, 1), mats.wood, caps.plank ?? 420);
    pool('fruit', new THREE.SphereGeometry(1, 8, 6), mats.fruit, caps.fruit ?? 320);
    pool('sheet', new THREE.PlaneGeometry(1, 1), mats.paper, caps.sheet ?? 200);
    pool('cloth', new THREE.PlaneGeometry(1, 1, 3, 2), mats.canvas || mats.cloth, caps.cloth ?? 24);   // (a stall's canvas: pale)
    pool('shard', new THREE.CircleGeometry(1, 3), mats.shard, caps.shard ?? 360);
    pool('lid', new THREE.CylinderGeometry(1, 1, 1, 14), mats.iron, caps.lid ?? 24);
    pool('iron', new THREE.BoxGeometry(1, 1, 1), mats.iron, caps.iron ?? 60);
  }

  // a slot in a pool: a free one, or the resting piece the eye least sees
  alloc(P, owner) {
    let i = P.free.length ? P.free.pop() : P.used < P.cap ? P.used++ : -1;
    if (i < 0) {
      // (a full pool: the resting piece the eye least sees among the next
      // 40 round the pool from where the last search stopped - never a
      // whole pool's search a piece: a blast spawns hundreds in one step)
      const G0 = this.stage.game, cam = G0 ? G0.camera : null;
      let best = -1, bd = -Infinity;
      if (cam) cam.getWorldDirection(_f);
      const n = Math.min(P.cap, 40);
      for (let j = 0; j < n; j++) {
        const k = P.cursor = ((P.cursor || 0) + 1) % P.cap;
        const o = P.owner[k];
        if (!o || !o.rest) continue;
        let d = o.t;
        if (cam) {
          _v.subVectors(o.pos, cam.position);
          const dist = _v.length();
          // (behind the eye first, then the furthest)
          d = dist + (_v.dot(_f) < 0.2 * dist ? 1e4 : 0);
        }
        if (d > bd) { bd = d; best = k; }
      }
      if (best < 0) return -1;
      P.owner[best].dead = true;
      this.n--;
      i = best;
    }
    if (P.im.count < P.used) P.im.count = P.used;
    P.im.visible = true;
    P.owner[i] = owner;
    return i;
  }

  spawn(name, pos, q, scale, vel, spin, { r = 0.05, paper = false, roll = false, bounce = 0.3, life = 0 } = {}) {
    const P = this.pools[name];
    if (!P) return null;
    // (a step's budget: past it a blast's last pieces are not made - a few strokes, never a stall)
    if (++this.made > STEP_BUDGET) return null;
    const p = { P, i: -1, pos: pos.clone(), q: q.clone(), scale: scale.clone(), vel: vel.clone(), ang: spin.clone(), r, paper, roll, bounce, rest: false, t: 0, restT: 0, dead: false, life };
    const i = this.alloc(P, p);
    if (i < 0) return null;
    p.i = i;
    this.set(p);
    this.live.push(p);
    return p;
  }

  set(p) { _m.compose(p.pos, p.q, p.scale); p.P.im.setMatrixAt(p.i, _m); p.P.im.instanceMatrix.needsUpdate = true; }
  release(p) {
    const P = p.P;
    P.im.setMatrixAt(p.i, ZERO); P.owner[p.i] = null; P.free.push(p.i); P.im.instanceMatrix.needsUpdate = true;
    p.dead = true;
  }

  // the half height of a piece as it lies now (its box's extent along the vertical)
  halfY(p) {
    const q = p.q, s = p.scale;
    const ax = Math.abs(2 * (q.x * q.y + q.w * q.z)), ay = Math.abs(1 - 2 * (q.x * q.x + q.z * q.z)), az = Math.abs(2 * (q.y * q.z - q.w * q.x));
    if (p.P.name === 'fruit') return s.x;
    if (p.P.name === 'sheet' || p.P.name === 'cloth' || p.P.name === 'shard') return 0.004;
    return (ax * s.x + ay * s.y + az * s.z) * 0.5;
  }

  // flat on its broadest face (a plank on its side, never on its edge)
  settleFlat(p, dt) {
    if (p.P.name === 'fruit') return;
    const s = p.scale;
    let ax;
    if (p.P.name === 'sheet' || p.P.name === 'cloth' || p.P.name === 'shard') ax = 2;   // (a plane's normal: local z)
    else ax = s.x <= s.y && s.x <= s.z ? 0 : s.y <= s.z ? 1 : 2;
    _v.set(ax === 0 ? 1 : 0, ax === 1 ? 1 : 0, ax === 2 ? 1 : 0).applyQuaternion(p.q);
    _s.set(0, _v.y >= 0 ? 1 : -1, 0);
    _q.setFromUnitVectors(_v, _s);
    p.q.premultiply(new THREE.Quaternion().slerp(_q, 1 - Math.exp(-12 * dt)));
  }

  // a car meets pieces: ahead of its bumper they are kicked on, faster than
  // it and low; beside or under it, out of its side (never up into it)
  kick(v) {
    const sp = v.speedAbs;
    if (sp < 1.5 || !this.live.length && !this.n) return 0;
    let n = 0;
    const c = Math.cos(v.yaw), sn = Math.sin(v.yaw), S = v.spec;
    const R = this.stage.game ? this.stage.game.rng : null;
    const rnd = (a, b) => a + (b - a) * (R ? R.next() : 0.5);
    for (const P of Object.values(this.pools)) {
      for (let k = 0; k < P.used; k++) {
        const p = P.owner[k];
        if (!p || p.dead) continue;
        if (p.pos.y > (v.groundY || 0) + 1.9 || Math.abs(p.pos.x - v.pos.x) > S.halfL + 1 || Math.abs(p.pos.z - v.pos.z) > S.halfL + 1) continue;
        if (!v.overlaps(p.pos, p.r + 0.05, -1, 1.6)) continue;
        const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z;
        const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
        const side = lz >= 0 ? 1 : -1;
        if (lx > S.halfL - 0.7 && p.pos.y - (v.groundY || 0) < 0.9) {
          const kk = rnd(1.1, 1.35), out = (rnd(-1, 1)) * 1.2 + side * rnd(0.5, 2.0);
          p.vel.set(v.vel.x * kk + sn * out, rnd(0.8, 2.2) * Math.min(1, sp / 12) + (p.paper ? 1.2 : 0), v.vel.z * kk + c * out);
        } else {
          const out = rnd(2.5, 4.5) * side, nz = side * (S.halfW + p.r + 0.06);
          p.pos.x = v.pos.x + lx * c + nz * sn; p.pos.z = v.pos.z - lx * sn + nz * c;
          p.vel.set(v.vel.x * rnd(0.5, 0.8) + sn * out, rnd(0.6, 1.6) + (p.paper ? 1 : 0), v.vel.z * rnd(0.5, 0.8) + c * out);
        }
        p.ang.set(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6));
        if (p.rest) { p.rest = false; this.n--; this.live.push(p); }
        p.restT = 0;
        n++;
      }
    }
    return n;
  }

  // nothing lies inside my own car's body (the bonnet, the cabin, the boot):
  // a piece found in it is put on the surface over it and thrown off, or out
  // of its side when it is low by a door (C3's guard: a fruit fell through
  // the bonnet and sat between my hands)
  guard(me) {
    if (!me || !me.spec || !this.live.length) return;
    const c = Math.cos(me.yaw), sn = Math.sin(me.yaw), S = me.spec, gy = me.groundY ?? 0;
    for (const p of this.live) {
      if (p.dead || Math.abs(p.pos.x - me.pos.x) > 3.2 || Math.abs(p.pos.z - me.pos.z) > 3.2) continue;
      const dx = p.pos.x - me.pos.x, dz = p.pos.z - me.pos.z;
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c, ly = p.pos.y - gy;
      const r = Math.min(p.r, 0.12);
      if (Math.abs(lx) > S.halfL + r * 0.5 || Math.abs(lz) > S.halfW + r * 0.5) continue;
      const top = lx > 0.85 ? 1.06 : lx < -1.05 ? 1.1 : 1.6;
      if (ly > top + r || ly < 0.28) continue;
      const side = lz >= 0 ? 1 : -1;
      if (ly < 0.75 && S.halfW + r - Math.abs(lz) < 0.35) {
        const nz = side * (S.halfW + r + 0.04);
        p.pos.x = me.pos.x + lx * c + nz * sn; p.pos.z = me.pos.z - lx * sn + nz * c;
        p.vel.set(me.vel.x + sn * 2.2 * side, Math.max(0.5, p.vel.y), me.vel.z + c * 2.2 * side);
      } else {
        p.pos.y = gy + top + r + 0.02;
        p.vel.set(me.vel.x - c * 3 + sn * side * 0.8, 3, me.vel.z + sn * 3 + c * side * 0.8);
      }
      this.set(p);
    }
  }

  update(dt) {
    this.made = 0;
    const S = this.stage;
    for (let j = this.live.length - 1; j >= 0; j--) {
      const p = this.live[j];
      if (p.dead) { this.live.splice(j, 1); continue; }
      p.t += dt;
      if (p.life && p.t > p.life) { this.release(p); this.live.splice(j, 1); continue; }
      if (p.paper) {
        p.vel.y -= G * 0.28 * dt;
        p.vel.multiplyScalar(Math.exp(-1.6 * dt));
        p.vel.x += Math.sin(p.t * 5.3 + j) * 1.2 * dt; p.vel.z += Math.cos(p.t * 4.1 + j * 0.7) * 1.2 * dt;
      } else {
        p.vel.y -= G * dt;
      }
      p.pos.addScaledVector(p.vel, dt);
      const w = p.ang.length();
      if (w > 1e-4) { _q.setFromAxisAngle(_v.copy(p.ang).divideScalar(w), w * dt); p.q.premultiply(_q); }
      const gy = S.surfaceY(p.pos.x, p.pos.z) + this.halfY(p);
      if (p.pos.y < gy) {
        p.pos.y = gy;
        if (p.vel.y < -1.2 && !p.paper) {
          p.vel.y *= -p.bounce; p.ang.multiplyScalar(0.55); p.vel.x *= 0.7; p.vel.z *= 0.7;
        } else {
          p.vel.y = 0;
          const fr = p.roll ? 1.1 : p.paper ? 9 : 5;
          p.vel.x *= Math.exp(-fr * dt); p.vel.z *= Math.exp(-fr * dt);
          p.ang.multiplyScalar(Math.exp(-(p.roll ? 1.2 : 6) * dt));
          if (!p.roll || Math.hypot(p.vel.x, p.vel.z) < 0.5) this.settleFlat(p, dt);
        }
        if (Math.hypot(p.vel.x, p.vel.z) < 0.08 && p.ang.length() < 0.25) {
          p.restT += dt;
          if (p.restT > 0.3) { p.rest = true; p.vel.set(0, 0, 0); p.ang.set(0, 0, 0); this.live.splice(j, 1); this.n++; }
        }
      }
      this.set(p);
    }
  }

  // every piece gone (a mend of everything: the bed's reset, the memory test)
  clear() {
    for (const P of Object.values(this.pools)) {
      for (let i = 0; i < P.cap; i++) { P.im.setMatrixAt(i, ZERO); if (P.owner[i]) P.owner[i].dead = true; }
      P.free = []; P.used = 0; P.owner.fill(null); P.im.count = 0; P.im.visible = false; P.im.instanceMatrix.needsUpdate = true;
    }
    this.live.length = 0;
    this.n = 0;
  }

  get count() { return this.live.length + this.n; }
}
