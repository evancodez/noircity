import * as THREE from 'three';

// The Hoods' brains.
//
// CoverSet: cover points generated from the world's colliders - the parked
// cars, the el's columns, the phone booth, the newsstand, crates, barrels,
// the hydrants and trash cans - each remembering the obstacle it hides
// behind (its 2D footprint), so "does this point hide me from the player"
// is an exact segment-vs-footprint test.
//
// HoodAI, a small state machine per Hood:
//   enter/move  walk (far) or run (under fire, near) along an A* path
//               (enemies/Nav.js) to the next cover point
//   cover       stand behind it, facing the player, 0.8-2 s
//   peek        step out to a point with line of sight (or rise over a car)
//   aim / fire  0.35-0.7 s aim, then 2-4 pistol shots, 0.35-0.55 s apart
//   duck        back behind the cover; after 2-3 cycles advance to a nearer
//               cover (until 10-20 m), or relocate if the player closes in
//               or flanks the cover
//   rush        heavies (wave 3+): run at the player with the Tommy gun,
//               stopping for bursts of 5-9 rounds
// Line of sight: RayWorld rays against world.solids (throttled). Steering:
// the path + world.colliders (never through cars, columns or each other).
// Their bullets: resolved after a short delay by the Game, accuracy falling
// with distance and when the player moves; 8-14 damage.

const COVER_TAGS = {
  car: { value: 0.9, pad: 0.6 }, booth: { value: 1, pad: 0.55 }, stand: { value: 0.7, pad: 0.55 },
  crates: { value: 0.75, pad: 0.55 }, barrels: { value: 0.55, pad: 0.55 },
  column: { value: 1, pad: 0.55 }, hydrant: { value: 0.35, pad: 0.5 }, can: { value: 0.35, pad: 0.5 },
};

export class CoverSet {
  constructor(world, nav) {
    this.points = [];
    const C = world.colliders;
    for (const b of C.boxes) {
      const T = COVER_TAGS[b.tag];
      if (!T) continue;
      const obs = { kind: 'box', b };
      const pts = [];
      const d = T.pad;
      const nLong = b.hx > 1.5 ? [-0.62, 0, 0.62] : [0];
      for (const sz of [-1, 1]) for (const f of nLong) pts.push([f * b.hx, sz * (b.hz + d)]);
      for (const sx of [-1, 1]) pts.push([sx * (b.hx + d), 0]);
      for (const [lx, lz] of pts) {
        const x = b.cx + lx * b.c + lz * b.s, z = b.cz - lx * b.s + lz * b.c;
        if (nav.free(x, z)) this.points.push({ x, z, obs, tag: b.tag, value: T.value, taken: null });
      }
    }
    for (const c of C.circles) {
      const T = COVER_TAGS[c.tag];
      if (!T) continue;
      const obs = { kind: 'circle', c };
      const n = c.tag === 'column' ? 6 : 4;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.3;
        const x = c.x + Math.cos(a) * (c.r + T.pad), z = c.z + Math.sin(a) * (c.r + T.pad);
        if (nav.free(x, z)) this.points.push({ x, z, obs, tag: c.tag, value: T.value, taken: null });
      }
    }
  }

  // does the obstacle's footprint cut the segment point -> target (2D)?
  hides(pt, tx, tz) {
    const o = pt.obs;
    const ax = pt.x, az = pt.z, dx = tx - ax, dz = tz - az;
    if (o.kind === 'circle') {
      const c = o.c;
      const L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / L2));
      const px = ax + dx * t - c.x, pz = az + dz * t - c.z;
      return px * px + pz * pz < (c.r * 0.9) ** 2;
    }
    // OBB: slab test in box space
    const b = o.b;
    const lx0 = (ax - b.cx) * b.c - (az - b.cz) * b.s, lz0 = (ax - b.cx) * b.s + (az - b.cz) * b.c;
    const ldx = dx * b.c - dz * b.s, ldz = dx * b.s + dz * b.c;
    let t0 = 0, t1 = 1;
    for (const [p, d, h] of [[lx0, ldx, b.hx * 0.95], [lz0, ldz, b.hz * 0.95]]) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(p) > h) return false; continue; }
      let a = (-h - p) / d, e = (h - p) / d;
      if (a > e) { const t = a; a = e; e = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, e);
      if (t0 > t1) return false;
    }
    return true;
  }
}

const _v = new THREE.Vector3(), _eye = new THREE.Vector3(), _dir = new THREE.Vector3();

export class HoodAI {
  constructor(game, hood, { heavy = false } = {}) {
    this.game = game;
    this.h = hood;
    this.heavy = heavy;
    this.rng = game.world.rng.fork(2000 + game.counters.spawned * 7 + (heavy ? 1 : 0));
    this.state = 'enter';
    this.timer = 0;
    this.cover = null;
    this.peekPt = null;
    this.path = null;
    this.pathI = 0;
    this.run = false;
    this.cycles = 0;
    this.shots = 0;
    this.shotT = 0;
    this.losT = 0;
    this.los = false;
    this.stun = 0;
    this.underFire = 0;
    this.repathT = 0;
    this.stuckT = 0;
    this.lastPos = hood.pos.clone();
    this.burstT = this.rng.range(1.5, 3);
    this.lastShot = -10;
    hood.onMove = (h) => this.resolve(h);
  }

  get player() { return this.game.camera.position; }
  distToPlayer() { const p = this.player; return Math.hypot(p.x - this.h.pos.x, p.z - this.h.pos.z); }
  eye(out = _eye) { return out.set(this.h.pos.x, this.h.pos.y + 1.58 * this.h.scale, this.h.pos.z); }

  // line of sight to the player's chest (throttled)
  checkLOS(dt, force = false) {
    this.losT -= dt;
    if (this.losT > 0 && !force) return this.los;
    this.losT = this.rng.range(0.2, 0.32);
    const e = this.eye();
    const t = _v.copy(this.player); t.y -= 0.35;
    _dir.subVectors(t, e);
    const d = _dir.length();
    _dir.divideScalar(d);
    const hit = this.game.rays.raycast(e, _dir, d - 0.4, { anyHit: true });
    this.los = !hit;
    return this.los;
  }
  losFrom(x, z) {
    const e = _eye.set(x, this.h.pos.y + 1.55 * this.h.scale, z);
    const t = _v.copy(this.player); t.y -= 0.35;
    _dir.subVectors(t, e);
    const d = _dir.length();
    _dir.divideScalar(d);
    return !this.game.rays.raycast(e, _dir, d - 0.4, { anyHit: true });
  }

  // colliders: never through cars, columns, each other or the player
  resolve(h) {
    const G = this.game;
    G.world.colliders.resolve(h.pos, 0.32 * h.scale, h.collider);
    const p = this.player;
    const dx = h.pos.x - p.x, dz = h.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.75 && d > 1e-4) { h.pos.x = p.x + dx / d * 0.75; h.pos.z = p.z + dz / d * 0.75; }
  }

  faceTo(x, z, dt, rate = 5) {
    const h = this.h;
    const want = Math.atan2(x - h.pos.x, z - h.pos.z);
    let d = want - h.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = rate * dt;
    h.yaw += Math.max(-step, Math.min(step, d));
    return Math.abs(d);
  }

  go(x, z, run) {
    const h = this.h;
    const path = this.game.nav.findPath(h.pos.x, h.pos.z, x, z);
    if (!path) return false;
    this.path = path;
    this.pathI = 0;
    this.run = run;
    this.stuckT = 0;
    this.lastPos.copy(h.pos);
    h.setAim(false);
    this.h.lookAt(null);
    return true;
  }

  // follows the path; returns true on arrival
  follow(dt) {
    const h = this.h;
    if (!this.path) return true;
    let wp = this.path[this.pathI];
    let d = Math.hypot(wp.x - h.pos.x, wp.z - h.pos.z);
    while (d < (this.pathI === this.path.length - 1 ? 0.3 : 0.6)) {
      this.pathI++;
      if (this.pathI >= this.path.length) { this.path = null; this.stop(); return true; }
      wp = this.path[this.pathI];
      d = Math.hypot(wp.x - h.pos.x, wp.z - h.pos.z);
    }
    const err = this.faceTo(wp.x, wp.z, dt, this.run ? 6 : 4);
    const speed = this.run ? 2.9 : 1.5;
    // slow down to turn sharp corners
    h.speed = speed * (err > 1.2 ? 0.3 : 1);
    const want = this.run ? 'run' : 'walk';
    if (h.state !== want) h.setState(want, 0.25);
    // stuck: barely moved in 1.5 s
    this.stuckT += dt;
    if (this.stuckT > 1.5) {
      if (h.pos.distanceTo(this.lastPos) < 0.3) {
        const end = this.path[this.path.length - 1];
        this.go(end.x + this.rng.gauss() * 0.8, end.z + this.rng.gauss() * 0.8, this.run);
      }
      this.stuckT = 0;
      this.lastPos.copy(h.pos);
    }
    return false;
  }

  stop() {
    const h = this.h;
    h.speed = 0;
    if (h.state === 'walk' || h.state === 'run') h.setState('idle', 0.25);
  }

  release() { if (this.cover) { this.cover.taken = null; this.cover = null; } }

  // choose a cover point; mode 'advance' | 'relocate'
  pickCover(mode) {
    const G = this.game, h = this.h, p = this.player, r = this.rng;
    const dNow = this.distToPlayer();
    const desired = mode === 'advance' ? Math.max(this.heavy ? 8 : 13, dNow - r.range(10, 17)) : r.range(12, 17);
    let best = null, bestS = Infinity;
    for (const c of G.covers.points) {
      if (c.taken && c.taken !== this) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < 7.5 || d > 70) continue;
      if (mode === 'advance' && d > dNow - 2.5 && dNow > 14) continue;
      if (!G.covers.hides(c, p.x, p.z)) continue;
      const travel = Math.hypot(c.x - h.pos.x, c.z - h.pos.z);
      if (travel > 30) continue;
      let crowd = 0;
      for (const ai of G.ais.values()) if (ai !== this && ai.cover && Math.hypot(ai.cover.x - c.x, ai.cover.z - c.z) < 3) crowd += 4;
      const s = Math.abs(d - desired) * 1.2 + travel * 0.05 - c.value * 2.5 + crowd + r.next() * 2.5;
      if (s < bestS) { bestS = s; best = c; }
    }
    return best;
  }

  moveToCover(mode, run = null) {
    const c = this.pickCover(mode);
    const dNow = this.distToPlayer();
    const wantRun = run ?? (this.underFire > 0 || dNow < 34 || mode === 'relocate');
    if (c && this.go(c.x, c.z, wantRun)) {
      this.release();
      c.taken = this;
      this.cover = c;
      this.state = 'move';
      return true;
    }
    // no cover: close in over open ground to ~14 m
    const p = this.player, h = this.h;
    const dx = h.pos.x - p.x, dz = h.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
    const k = Math.min(1, 14 / d);
    if (this.go(p.x + dx * k + this.rng.gauss() * 2, p.z + dz * k + this.rng.gauss() * 2, wantRun)) {
      this.release();
      this.state = 'move';
      return true;
    }
    return false;
  }

  // a point beside the cover with a clear shot (or the cover itself when he
  // can fire over it, like a man behind a car's hood)
  findPeek() {
    const c = this.cover, p = this.player, nav = this.game.nav;
    if (!c) return this.losFrom(this.h.pos.x, this.h.pos.z) ? { x: this.h.pos.x, z: this.h.pos.z } : null;
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1;
    const px = -dz / d, pz = dx / d;
    const ks = [0, 0.9, -0.9, 1.5, -1.5, 2.2, -2.2];
    if (this.rng.chance(0.5)) for (let i = 1; i < ks.length; i += 2) { const t = ks[i]; ks[i] = ks[i + 1]; ks[i + 1] = t; }
    for (const k of ks) {
      const x = c.x + px * k, z = c.z + pz * k;
      if (k !== 0 && (!nav.free(x, z) || !nav.lineFree(c.x, c.z, x, z))) continue;
      if (this.losFrom(x, z)) return { x, z };
    }
    return null;
  }

  onHit(dir, stunned) {
    this.stun = stunned ? 1.25 : 0.35;
    this.underFire = 3;
    this.shots = 0;
  }

  update(dt, t) {
    const h = this.h, G = this.game, r = this.rng;
    if (!h.alive) { this.release(); return; }
    this.underFire = Math.max(0, this.underFire - dt);
    // being shot at: the player's aim passes near him
    if (G.weapon.sinceShot < 0.25) {
      const cam = G.camera;
      const f = _dir.set(0, 0, -1).transformDirection(cam.matrixWorld);
      const to = _v.set(h.pos.x - cam.position.x, h.pos.y + 1.1 - cam.position.y, h.pos.z - cam.position.z);
      const d = to.length();
      if (to.dot(f) / d > Math.cos(Math.atan2(2.0, d))) this.underFire = 2.5;
    }
    if (h.state === 'stagger') { this.stun = Math.max(this.stun, 0.2); return; }
    if (this.stun > 0) {
      this.stun -= dt;
      h.speed = Math.min(h.speed, 0.6);
      return;
    }
    const dist = this.distToPlayer();
    const p = this.player;
    this.timer -= dt;
    switch (this.state) {
      case 'enter': {
        if (this.heavy) { this.state = 'rush'; this.repathT = 0; break; }
        if (!this.moveToCover('advance', dist < 34)) { this.state = 'cover'; this.timer = 1; }
        break;
      }
      case 'move': {
        const arrived = this.follow(dt);
        if (arrived) {
          this.state = 'cover';
          // far off, a breath; in the fight, a longer wait before popping out
          this.timer = (dist > 30 ? r.range(0.25, 0.7) : r.range(0.6, 1.5)) * (this.underFire > 0 ? 1.3 : 1);
          this.cycles = 0;
        } else if (this.run === false && this.underFire > 0) {
          this.run = true;   // caught in the open: break into a run
        }
        // popped out while crossing: a snap shot at close range
        if (!arrived && dist < 14 && this.checkLOS(dt) && t - this.lastShot > 2.5 && r.chance(dt * 0.6)) {
          this.path = null; this.stop();
          this.state = 'aim'; this.timer = r.range(0.3, 0.5); this.shots = r.int(1, 2);
          h.setState('aim', 0.2); h.lookAt(_v.copy(p).setY(p.y - 0.3));
        }
        break;
      }
      case 'cover': {
        this.stop();
        h.lookAt(_v.copy(p).setY(p.y - 0.2));
        this.faceTo(p.x, p.z, dt, 3);
        if (this.timer > 0) break;
        const flanked = this.cover && !G.covers.hides(this.cover, p.x, p.z);
        if (dist < 7) { this.moveToCover('relocate', true); break; }
        // beyond pistol range: keep coming; at 20-30 m trade a volley first
        if (dist > 34 || (dist > 22 && this.cycles >= 1) || (this.cycles >= r.int(2, 3) && dist > 13)) {
          if (this.moveToCover('advance')) break;
        }
        if (flanked && r.chance(0.6)) { this.moveToCover('relocate'); break; }
        this.peekPt = this.findPeek();
        if (!this.peekPt) {
          this.cycles++;
          if (this.cycles > 1) this.moveToCover(dist > 16 ? 'advance' : 'relocate');
          else this.timer = r.range(0.6, 1.2);
          break;
        }
        const moveNeeded = Math.hypot(this.peekPt.x - h.pos.x, this.peekPt.z - h.pos.z) > 0.25;
        if (moveNeeded) { this.path = [new THREE.Vector3(this.peekPt.x, 0, this.peekPt.z)]; this.pathI = 0; this.run = false; this.state = 'peek'; }
        else { this.state = 'aim'; this.timer = r.range(0.3, 0.55); h.setState('aim', 0.2); }
        break;
      }
      case 'peek': {
        // a quick side step out of cover
        const wp = this.path && this.path[0];
        if (!wp) { this.state = 'aim'; this.timer = r.range(0.35, 0.7); h.setState('aim', 0.2); break; }
        const d = Math.hypot(wp.x - h.pos.x, wp.z - h.pos.z);
        if (d < 0.2) {
          this.path = null; this.stop();
          this.state = 'aim'; this.timer = r.range(0.35, 0.7); h.setState('aim', 0.2);
          break;
        }
        this.faceTo(wp.x, wp.z, dt, 8);
        h.speed = 1.6;
        if (h.state !== 'walk') h.setState('walk', 0.15);
        break;
      }
      case 'aim': {
        h.speed = 0;
        if (h.state !== 'aim') h.setState('aim', 0.2);
        h.lookAt(_v.copy(p).setY(p.y - 0.3));
        this.faceTo(p.x, p.z, dt, 6);
        if (this.timer > 0) break;
        if (!this.checkLOS(dt, true)) { this.state = 'duck'; break; }
        this.state = 'fire';
        if (!this.shots) this.shots = this.heavy ? r.int(5, 9) : r.int(2, 4) + (r.chance(0.35) ? 1 : 0);
        this.shotT = 0;
        break;
      }
      case 'fire': {
        h.speed = 0;
        h.lookAt(_v.copy(p).setY(p.y - 0.3));
        this.faceTo(p.x, p.z, dt, 6);
        this.shotT -= dt;
        if (this.shotT > 0) break;
        if (this.shots <= 0 || !this.checkLOS(dt)) {
          this.shots = 0;
          this.state = this.heavy ? 'rush' : 'duck';
          if (this.heavy) { this.burstT = r.range(2, 3.5); this.repathT = 0; }
          break;
        }
        G.hoodFire(this, t);
        this.lastShot = t;
        this.shots--;
        this.shotT = this.heavy ? r.range(0.085, 0.11) : r.range(0.35, 0.55);
        break;
      }
      case 'duck': {
        h.setAim(false);
        if (this.cover) {
          if (Math.hypot(this.cover.x - h.pos.x, this.cover.z - h.pos.z) > 0.3) {
            this.path = [new THREE.Vector3(this.cover.x, 0, this.cover.z)];
            this.pathI = 0; this.run = this.underFire > 0;
            this.state = 'return';
            break;
          }
        }
        this.stop();
        this.state = 'cover';
        this.cycles++;
        this.timer = r.range(0.8, 2.0);
        break;
      }
      case 'return': {
        if (this.follow(dt)) { this.state = 'cover'; this.cycles++; this.timer = r.range(0.8, 2.0); }
        break;
      }
      case 'rush': {
        // heavies: straight at the player, stopping for bursts
        this.repathT -= dt;
        this.burstT -= dt;
        const los = this.checkLOS(dt);
        if (dist < 10 || (this.burstT <= 0 && los && dist < 26)) {
          this.path = null; this.stop();
          this.state = 'aim'; this.timer = r.range(0.3, 0.45); this.shots = r.int(5, 9);
          h.setState('aim', 0.2);
          break;
        }
        if (this.repathT <= 0 || !this.path) {
          this.repathT = 1.5;
          const dx = h.pos.x - p.x, dz = h.pos.z - p.z, d = Math.hypot(dx, dz) || 1;
          const k = Math.min(1, 8.5 / d);
          this.go(p.x + dx * k, p.z + dz * k, true);
        }
        if (this.follow(dt)) { this.state = 'aim'; this.timer = 0.3; h.setState('aim', 0.2); }
        break;
      }
      default: break;
    }
  }
}
