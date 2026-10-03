import * as THREE from 'three';
import { LAYER } from '../render/layers.js';
import { makeConeMesh } from '../render/shaders/cone.js';
import { anchorInk } from './models.js';

// One car on a stage's track (stage.track: src/stages/riverroad/parts/
// track.js): arcade physics, its collisions, its body's motion, its lamps.
// Frame: pos is the ground under the car's middle, yaw its rotation.y
// (forward (cos yaw, 0, -sin yaw), right (sin yaw, 0, cos yaw)).
//
// The driving (the feel is the scene, B5 brief):
//   W throttle: quick off the line (0-60 km/h in ~2.4 s), 100 km/h flat out
//   S brake (hard), then reverse slowly
//   A / D: a yaw rate asked for, light and sure at speed (the lateral grip
//   caps it near 1 g), the wheel's turn eased so the hands can follow it;
//   thrown about on the wet, the tail steps out a little (the grip gives)
//   and comes back; it never spins out on its own
//   walls: a glancing scrape (sparks, lost speed, turned along the wall);
//   a column or a post: glancing, unless head-on and fast (then a hard stop,
//   a thump, a bounce back - and rolling again at once); things that burst
//   cost almost nothing
// Events (v.on): 'scrape' { point, k }, 'crash' { point, k, what }, 'smash'
// { item }, 'kerb' { k }.
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const P = {};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const SPECS = {
  coupe: { vmax: 28.5, accel: 9.8, brake: 17, rev: 5, drag: 0.35, latMax: 10.5, yawLow: 1.35, grip: 9, gripSlide: 3.6, slideAt: 7.5, halfL: 2.45, halfW: 0.94, wheelbase: 3.1, mass: 1 },
  sedan: { vmax: 33, accel: 8.5, brake: 15, rev: 5, drag: 0.35, latMax: 10, yawLow: 1.2, grip: 9, gripSlide: 4, slideAt: 8, halfL: 2.45, halfW: 0.95, wheelbase: 3.1, mass: 1.1 },
  truck: { vmax: 14, accel: 3.5, brake: 8, rev: 2, drag: 0.4, latMax: 4, yawLow: 0.8, grip: 10, gripSlide: 8, slideAt: 20, halfL: 3.6, halfW: 1.2, wheelbase: 4.4, mass: 6 },
};

export class Vehicle {
  constructor(vehicles, kind, model, { pos, yaw, s = null, spec = null }) {
    this.vehicles = vehicles;
    this.game = vehicles.game;
    this.kind = kind;
    this.model = model;
    this.body = model.group;
    this.spec = { ...SPECS[kind === 'coupe' ? 'coupe' : kind === 'truck' ? 'truck' : 'sedan'], ...(spec || {}) };
    this.pos = pos.clone();
    this.yaw = yaw;
    this.vel = new THREE.Vector3();
    this.yawRate = 0;
    this.steer = 0;            // the wheel's eased turn, -1 .. 1 (+ left)
    this.accel = 0;            // m/s2 along, last step
    this.lat = 0;              // m/s2 across, last step
    this.input = { throttle: 0, brake: 0, steer: 0 };
    this.driver = null;        // 'player' | { drive(v, dt) } | null
    this.s = s; this.d = 0;
    this.hint = { s };
    this.roll = 0; this.pitch = 0; this.rollV = 0; this.pitchV = 0; this.heave = 0; this.heaveV = 0;
    this.shake = 0;            // the wheel's and the body's shake (0..1)
    this.hardT = 9;            // s since a hard stop
    this.events = new Map();
    this.solid = true;
    this.frozen = false;
    this.inkSlot = -1;
    this.lamps = null;
    this.hitList = [];
    this._c = [];
    this.place(this.pos, this.yaw);
  }

  on(name, fn) { if (!this.events.has(name)) this.events.set(name, []); this.events.get(name).push(fn); return fn; }
  emit(name, e) { const L = this.events.get(name); if (L) for (const f of L) f(e, this); }

  get fwd() { return _w.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  get speed() { return this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw); }
  get speedAbs() { return Math.hypot(this.vel.x, this.vel.z); }
  vel3(out) { return out.set(this.vel.x, 0, this.vel.z); }
  get kmh() { return this.speed * 3.6; }

  // a world point in the car's frame
  local(p, out = _p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(dx * c - dz * s, p.y - this.pos.y, dx * s + dz * c);
  }
  // does a thing at p (radius r, between y0 and y1 above the ground) touch the car's box?
  overlaps(p, r, y0 = -1, y1 = 3) {
    const l = this.local(p);
    if (p.y < this.pos.y + y0 || p.y > this.pos.y + y1) return false;
    return Math.abs(l.x) < this.spec.halfL + r && Math.abs(l.z) < this.spec.halfW + r;
  }

  place(pos, yaw, speed = 0) {
    this.pos.copy(pos);
    this.yaw = yaw;
    this.vel.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(speed);
    this.yawRate = 0; this.steer = 0; this.roll = this.pitch = this.heave = 0; this.rollV = this.pitchV = this.heaveV = 0;
    const T = this.track;
    if (T) { T.project(this.pos.x, this.pos.z, null, P); this.s = P.s; this.d = P.d; this.hint.s = P.s; }
    this.pose(0);
  }

  get track() { return this.game && this.game.stage && this.game.stage.track; }

  // ---- one fixed step -----------------------------------------------------------------
  step(dt) {
    if (this.frozen || dt <= 0) { this.pose(0); return; }
    // (a driver that places the car itself: a scripted crossing, a spin)
    if (this.driver && this.driver.kinematic) {
      this.driver.drive(this, dt);
      const T = this.track;
      if (T) { T.project(this.pos.x, this.pos.z, this.hint.s, P); this.s = P.s; this.d = P.d; this.hint.s = P.s; }
      this.hardT += dt;
      this.pose(dt);
      return;
    }
    const S = this.spec, I = this.input;
    if (this.driver && this.driver !== 'player' && this.driver.drive) this.driver.drive(this, dt);
    const c = Math.cos(this.yaw), sn = Math.sin(this.yaw);
    const fx = c, fz = -sn, rx = sn, rz = c;
    let vF = this.vel.x * fx + this.vel.z * fz;
    let vR = this.vel.x * rx + this.vel.z * rz;
    const v0 = vF;
    // the wheel: eased toward the hands' ask (fast in, faster back)
    const want = clamp(I.steer, -1, 1);
    const rate = Math.abs(want) > Math.abs(this.steer) && Math.sign(want) === Math.sign(this.steer || want) ? 6.5 : 9;
    this.steer += clamp(want - this.steer, -rate * dt, rate * dt);
    // along: throttle, brake, reverse, the drag of the road and the air
    let a = 0;
    const th = clamp(I.throttle, 0, 1), br = clamp(I.brake, 0, 1);
    if (th > 0 && vF > -0.5) a += th * S.accel * Math.max(0, 1 - Math.pow(Math.max(0, vF) / S.vmax, 1.7));
    if (br > 0) {
      if (vF > 0.4) a -= br * S.brake;
      else if (th === 0) a -= br * S.accel * 0.45 * (vF > -S.rev ? 1 : 0);
    }
    if (th > 0 && vF < -0.4) a += th * S.brake;       // (W while rolling back: a brake)
    const drag = S.drag + 0.0011 * vF * vF + (th === 0 && br === 0 ? 0.9 : 0);
    if (Math.abs(vF) > 0.05) a -= Math.sign(vF) * drag;
    else if (th === 0 && br === 0) vF = 0;
    vF += a * dt;
    if (v0 > 0 && vF < 0 && br > 0 && th === 0 && v0 > 0.4) vF = 0;   // (a stop, then reverse on a fresh press)
    // the turn: a yaw rate asked for (+ left), capped by the grip at speed
    const spd = Math.abs(vF);
    const maxYaw = Math.min(S.yawLow * Math.min(1, spd / 3.5), S.latMax / Math.max(spd, 1));
    const target = this.steer * maxYaw * Math.sign(vF || 1);
    this.yawRate += (target - this.yawRate) * (1 - Math.exp(-11 * dt));
    this.yaw += this.yawRate * dt;
    // the grip: the sideways speed dies away; thrown about hard (a turn's
    // demand past slideAt), the grip gives and the tail steps out
    const demand = Math.abs(this.yawRate * vF);
    const slide = clamp((demand - S.slideAt) / 4, 0, 1) * (spd > 12 ? 1 : 0);
    const grip = S.grip + (S.gripSlide - S.grip) * slide;
    vR *= Math.exp(-grip * dt);
    // the old velocity in the new heading: the turn leaves some sideways
    const c2 = Math.cos(this.yaw), s2 = Math.sin(this.yaw);
    const nfx = c2, nfz = -s2, nrx = s2, nrz = c2;
    const wx = fx * vF + rx * vR, wz = fz * vF + rz * vR;
    let vF2 = wx * nfx + wz * nfz, vR2 = wx * nrx + wz * nrz;
    // (never spins: the slip angle stays under ~0.3 rad)
    const lim = 0.3 * Math.abs(vF2) + 0.5;
    vR2 = clamp(vR2, -lim, lim);
    this.vel.set(nfx * vF2 + nrx * vR2, 0, nfz * vF2 + nrz * vR2);
    this.accel = (vF2 - v0) / dt;
    this.lat = this.yawRate * vF2;
    this.slide = slide;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.hardT += dt;
    this.touch = false;
    this.collide(dt);
    this.unstick(dt, th);
    this.pose(dt);
  }

  // [2nd pass] never wedged: W held against something (a lamp post and the
  // rail, a column under the el) and not moving, the nose scrabbles round
  // toward the road and the car eases off it; rolling again in a second (a
  // car at rest could not turn at all: nose to a post, it sat there until
  // he was lost)
  unstick(dt, th) {
    const T = this.track;
    // (stuck: W held, touching something lately, and the car's place not
    // moving - its velocity lies, pushed back into a wall every step)
    const lp = this._lp || (this._lp = this.pos.clone());
    const moved = Math.hypot(this.pos.x - lp.x, this.pos.z - lp.z) / Math.max(dt, 1e-4);
    lp.copy(this.pos);
    this.touchT = this.touch ? 0 : (this.touchT ?? 9) + dt;
    const stuck = this.touchT < 0.3 && th > 0 && moved < 2;
    this.pinT = stuck ? (this.pinT || 0) + dt : Math.max(0, (this.pinT || 0) - dt);
    if (!T || this.pinT < 0.25) return;
    const F = T.frame(this.s, this._f || (this._f = {}));
    // (the hands on the wheel have the say when they ask: A / D pivot the
    // car off the thing; left alone, the nose comes round to the road)
    const st = clamp(this.input.steer, -1, 1);
    if (st) this.yaw += st * 1.8 * dt;
    else {
      const want = F.h + Math.PI / 2 + clamp(this.d * 0.07, -0.5, 0.5);
      const dy = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
      this.yaw += clamp(dy, -2.2 * dt, 2.2 * dt);
    }
    if (Math.abs(this.d) > 3) { const sg = -Math.sign(this.d); this.pos.x += F.rx * sg * 0.9 * dt; this.pos.z += F.rz * sg * 0.9 * dt; }
  }

  // ---- collisions -------------------------------------------------------------------------
  collide(dt) {
    const T = this.track;
    if (!T) return;
    const S = this.spec;
    T.project(this.pos.x, this.pos.z, this.hint.s, P);
    this.s = P.s; this.d = P.d; this.hint.s = P.s;
    const F = T.frame(this.s, this._f || (this._f = {}));
    // the walls: the corners' reach across the road
    const c = Math.cos(this.yaw), sn = Math.sin(this.yaw);
    let dMax = -Infinity, dMin = Infinity, pMax = null, pMin = null;
    for (const lx of [-S.halfL, S.halfL]) for (const lz of [-S.halfW, S.halfW]) {
      const x = this.pos.x + c * lx + sn * lz, z = this.pos.z - sn * lx + c * lz;
      const dd = (x - F.x) * F.rx + (z - F.z) * F.rz;
      if (dd > dMax) { dMax = dd; pMax = [x, z]; }
      if (dd < dMin) { dMin = dd; pMin = [x, z]; }
    }
    if (dMax > T.right) this.wall(dMax - T.right, -F.rx, -F.rz, pMax, 'rail', dt);
    if (dMin < T.left) this.wall(T.left - dMin, F.rx, F.rz, pMin, 'wall', dt);
    // the hard round things
    const list = T.circles(this.s - 8, this.s + 8, this._c);
    for (const k of list) {
      const l = this.local(_v.set(k.x, 0, k.z), _w);
      const qx = clamp(l.x, -S.halfL, S.halfL), qz = clamp(l.z, -S.halfW, S.halfW);
      const ox = l.x - qx, oz = l.z - qz;
      const d2 = ox * ox + oz * oz;
      if (d2 >= k.r * k.r && !(l.x === qx && l.z === qz)) continue;
      // the normal from the car to the thing (world), and how deep
      let nlx, nlz, pen;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); nlx = ox / d; nlz = oz / d; pen = k.r - d; }
      else { const px = S.halfL - Math.abs(l.x), pz = S.halfW - Math.abs(l.z); if (px < pz) { nlx = Math.sign(l.x); nlz = 0; pen = px + k.r; } else { nlx = 0; nlz = Math.sign(l.z); pen = pz + k.r; } }
      const nx = nlx * c + nlz * sn, nz = -nlx * sn + nlz * c;
      this.hitRound(k, nx, nz, pen, [this.pos.x + (qx * c + qz * sn), this.pos.z + (-qx * sn + qz * c)]);
    }
    // the other cars
    for (const o of this.vehicles.list) if (o !== this && o.solid && !o.parked) this.carHit(o);
    // what bursts, what is kicked
    if (T.smash) {
      const hit = T.smash.collide(this, this.hitList);
      for (const it of hit) { this.vel.multiplyScalar(it.drag); this.shake = Math.min(1, this.shake + 0.35); this.emit('smash', { item: it }); }
      T.smash.kickPieces(this);
    }
    // the kerbs: a bump crossing one at speed
    const g = T.ground(this.d);
    if (this._g != null && Math.abs(g - this._g) > 0.05 && this.speedAbs > 4) { this.heaveV += 1.1 * Math.min(1, this.speedAbs / 20); this.shake = Math.min(1, this.shake + 0.25); this.emit('kerb', { k: Math.min(1, this.speedAbs / 20) }); }
    this._g = g;
  }

  // against a wall along the road (n: into the road)
  wall(pen, nx, nz, at, what, dt = 1 / 60) {
    this.pos.x += nx * pen; this.pos.z += nz * pen;
    this.touch = true;
    const vn = this.vel.x * nx + this.vel.z * nz;
    if (vn >= 0) return;
    // lose the speed into the wall, a little along it; turned along it
    this.vel.x -= nx * vn * 1.25; this.vel.z -= nz * vn * 1.25;
    const k = Math.min(1, -vn / 9);
    // [2nd pass] the strike costs speed by how hard it was, once; held
    // against the wall the scrape is a drag (it holds ~60 km/h with W down),
    // never a grind to a stop (it was 2 % a step: a scrape stopped the car
    // dead in a second)
    this.vel.multiplyScalar((1 - 0.2 * k) * Math.exp(-0.35 * dt));
    // (the nose swings away from the wall, and keeps swinging while it is
    // held against it: the car runs along the wall, not into it)
    const f = this.fwd;
    const along = -(f.x * nx + f.z * nz);
    // (turned along the wall: f x n says which way is away from it)
    const away = Math.sign(f.z * nx - f.x * nz) || 1;
    // (only while it rolls: at a standstill the sign of a creeping speed
    // flips step to step and turned the nose INTO the wall - pinned there
    // with W held for 11 s; a car at rest is unstuck by unstick())
    if (Math.abs(this.speed) > 1.5) this.yaw += away * clamp(along, 0, 1) * (0.35 * k + 2.5 * dt) * Math.sign(this.speed);
    this.yawRate *= 0.6;
    this.shake = Math.min(1, this.shake + 0.5 * k + 0.1);
    this.emit('scrape', { point: new THREE.Vector3(at[0], 0.5, at[1]), k: Math.max(0.15, k), what, n: new THREE.Vector3(nx, 0, nz) });
  }

  // against a column, a post (n: from the car toward it)
  hitRound(k, nx, nz, pen, at) {
    this.pos.x -= nx * pen; this.pos.z -= nz * pen;
    this.touch = true;
    const vn = this.vel.x * nx + this.vel.z * nz;
    if (vn <= 0) return;
    const f = this.fwd;
    const headOn = Math.abs(f.x * nx + f.z * nz);
    const point = new THREE.Vector3(at[0], 0.6, at[1]);
    if (vn > 6.5 && headOn > 0.82) {
      // a hard stop: the thump, a bounce back, the wheel's kick
      this.vel.set(-nx * Math.min(2.2, vn * 0.12), 0, -nz * Math.min(2.2, vn * 0.12));
      this.yawRate *= 0.2;
      // [2nd pass] the bounce leaves the nose off the thing (toward the
      // road when it was dead on), so W again glances by instead of
      // butting it: rolling again at once
      { const sd = f.x * nz - f.z * nx; this.yaw += -(Math.abs(sd) > 0.05 ? Math.sign(sd) : -Math.sign(this.d || 1)) * 0.3; }
      this.hardT = 0;
      this.shake = 1;
      this.pitchV -= 2.4 * Math.sign(f.x * nx + f.z * nz);
      this.emit('crash', { point, k: Math.min(1, vn / 20), what: k.kind, thing: k });
      return;
    }
    // glancing: deflected, a bit of speed lost, turned away
    this.vel.x -= nx * vn * 1.3; this.vel.z -= nz * vn * 1.3;
    // [2nd pass] the strike costs speed once, by how hard it was (it was 7 %
    // a step: nose to a column with W held, the car sat there)
    this.vel.multiplyScalar(1 - 0.25 * Math.min(1, vn / 12));
    const r = this.fwd; const side = r.x * nz - r.z * nx;
    this.yawRate += -(Math.sign(side) || 1) * Math.min(0.6, 0.12 + vn * 0.05);
    // (and it slides off round the thing: pushed along its side, the way
    // the nose already points, so W held never leaves the car stuck on it)
    const tx = -nz, tz = nx, sg = Math.sign(r.x * tx + r.z * tz) || 1;
    const dt = 1 / 60;
    this.pos.x += tx * sg * 1.6 * dt; this.pos.z += tz * sg * 1.6 * dt;
    this.shake = Math.min(1, this.shake + 0.6);
    this.emit('scrape', { point, k: Math.min(1, vn / 12), what: k.kind, thing: k, n: new THREE.Vector3(-nx, 0, -nz) });
  }

  // two cars: each a box; pushed apart along the line between them, the
  // lighter one given the heavier one's say
  carHit(o) {
    const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z;
    const R = this.spec.halfL + o.spec.halfL + 0.5;
    if (dx * dx + dz * dz > R * R) return;
    // sample points along the other car's length against my box
    let best = null;
    for (const u of [-0.9, -0.45, 0, 0.45, 0.9]) {
      const px = o.pos.x + Math.cos(o.yaw) * o.spec.halfL * u, pz = o.pos.z - Math.sin(o.yaw) * o.spec.halfL * u;
      const l = this.local(_v.set(px, 0, pz), _w);
      const ex = this.spec.halfL + o.spec.halfW - Math.abs(l.x), ez = this.spec.halfW + o.spec.halfW - Math.abs(l.z);
      if (ex <= 0 || ez <= 0) continue;
      const pen = Math.min(ex, ez);
      if (!best || pen > best.pen) best = { pen, lx: ex < ez ? Math.sign(l.x) : 0, lz: ex < ez ? 0 : Math.sign(l.z), px, pz };
    }
    if (!best) return;
    const c = Math.cos(this.yaw), sn = Math.sin(this.yaw);
    const nx = best.lx * c + best.lz * sn, nz = -best.lx * sn + best.lz * c;   // me -> him
    // (a car on a scripted path - the truck, the car coming the other way - is
    // not pushed: it is a wall that moves)
    const fixed = !!(o.driver && o.driver.kinematic);
    const m1 = this.spec.mass, m2 = fixed ? 1e6 : o.spec.mass, k1 = m2 / (m1 + m2), k2 = m1 / (m1 + m2);
    this.pos.x -= nx * best.pen * k1; this.pos.z -= nz * best.pen * k1;
    o.pos.x += nx * best.pen * k2; o.pos.z += nz * best.pen * k2;
    const rv = (this.vel.x - o.vel.x) * nx + (this.vel.z - o.vel.z) * nz;
    if (rv <= 0) return;
    const j = rv * 1.2;
    this.vel.x -= nx * j * k1; this.vel.z -= nz * j * k1;
    o.vel.x += nx * j * k2; o.vel.z += nz * j * k2;
    const f = this.fwd, headOn = Math.abs(f.x * nx + f.z * nz);
    const point = new THREE.Vector3(best.px, 0.8, best.pz);
    if (rv > 6 && headOn > 0.7 && (m2 >= m1 * 2)) {
      // (stopped against it, carried back a little by it: rolling again soon)
      this.vel.set(o.vel.x * 0.5 - nx * 1.5, 0, o.vel.z * 0.5 - nz * 1.5);
      this.yawRate *= 0.2;
      this.hardT = 0; this.shake = 1; this.pitchV -= 2.2;
      this.emit('crash', { point, k: Math.min(1, rv / 18), what: o.kind, thing: o });
    } else {
      this.shake = Math.min(1, this.shake + 0.5);
      this.emit('scrape', { point, k: Math.min(1, rv / 10), what: o.kind, thing: o, n: new THREE.Vector3(-nx, 0, -nz) });
    }
    o.emit('bump', { by: this, k: Math.min(1, rv / 10) });
  }

  // ---- the body's motion -------------------------------------------------------------------
  pose(dt) {
    const T = this.track;
    // the springs: the nose dips on the brake, the body leans out of a turn,
    // it rides up the kerbs
    if (dt > 0) {
      const pt = clamp(this.accel * 0.0045, -0.05, 0.05), rt = clamp(this.lat * 0.0065, -0.06, 0.06);
      const k = 60, dmp = 9;
      this.pitchV += ((pt - this.pitch) * k - this.pitchV * dmp) * dt; this.pitch += this.pitchV * dt;
      this.rollV += ((rt - this.roll) * k - this.rollV * dmp) * dt; this.roll += this.rollV * dt;
      this.heaveV += ((0 - this.heave) * 90 - this.heaveV * 10) * dt; this.heave += this.heaveV * dt;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    const g = T ? T.ground(this.d) : 0;
    const B = this.body;
    // the road's grain at speed: a small shiver
    const t = this.game ? this.game.time : 0;
    const sp = Math.min(1, this.speedAbs / 26);
    const shiver = (Math.sin(t * 37.0) * 0.6 + Math.sin(t * 23.3 + 1.2) * 0.4) * (0.0035 * sp + 0.012 * this.shake);
    B.position.set(this.pos.x, g + this.heave + shiver, this.pos.z);
    _e.set(0, 0, 0, 'YXZ');
    _q.setFromAxisAngle(_w.set(0, 1, 0), this.yaw);
    B.quaternion.copy(_q)
      .multiply(_q.clone().setFromAxisAngle(_w.set(0, 0, 1), this.pitch))
      .multiply(_q.clone().setFromAxisAngle(_w.set(1, 0, 0), this.roll + shiver * 0.3));
    B.updateMatrixWorld(true);
    anchorInk(this.inkSlot, B);
    if (this.lamps) this.lamps.update(this);
    if (this.onPose) this.onPose(this);
  }

  // the eye in its seat (world), given a point in the car's frame
  seat(localEye, out = new THREE.Vector3()) { return out.copy(localEye).applyMatrix4(this.body.matrixWorld); }
}

// the headlamps' pools (a ShaderMaterial on a flat plane in the car's own
// frame: x ahead, z across): additive, never inked or mirrored
// [C6] exported: the foot chase compiles its program against the city's lights before the cut into the seat
export function poolMaterial(points, reach, gain) {
  return new THREE.ShaderMaterial({
    name: 'HeadlampPool',
    uniforms: { uL: { value: points.map((p) => new THREE.Vector2(p.x, p.z)) }, uReach: { value: reach }, uGain: { value: gain },
      // [R2] the cars in the beams (up to two, in this car's frame): each
      // throws its shadow down the pool - his car black in my light, the
      // road behind it dark - where the wash slid on under him as if he
      // were not there
      uOcc: { value: [new THREE.Vector4(), new THREE.Vector4()] }, uOccR: { value: [new THREE.Vector2(1, 0), new THREE.Vector2(1, 0)] }, uOccN: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: /* glsl */`
      uniform vec2 uL[ 2 ];
      uniform float uReach, uGain;
      uniform vec4 uOcc[ 2 ];   // centre x, z, half length, half width
      uniform vec2 uOccR[ 2 ];  // its turn: cos, sin
      uniform int uOccN;
      varying vec2 vP;
      // does the beam from the lamp at a to the road at b pass a car?
      float blocked( vec2 a, vec2 b ) {
        float k = 1.0;
        for ( int j = 0; j < 2; j ++ ) {
          if ( j >= uOccN ) break;
          vec4 o = uOcc[ j ]; vec2 r = uOccR[ j ];
          vec2 pa = a - o.xy, pb = b - o.xy;
          pa = vec2( pa.x * r.x - pa.y * r.y, pa.x * r.y + pa.y * r.x );
          pb = vec2( pb.x * r.x - pb.y * r.y, pb.x * r.y + pb.y * r.x );
          vec2 d = pb - pa;
          vec2 inv = 1.0 / ( d + vec2( d.x >= 0.0 ? 1e-5 : -1e-5, d.y >= 0.0 ? 1e-5 : -1e-5 ) );
          vec2 t0 = ( - o.zw - pa ) * inv, t1 = ( o.zw - pa ) * inv;
          vec2 tn2 = min( t0, t1 ), tf2 = max( t0, t1 );
          float tn = max( tn2.x, tn2.y ), tf = min( tf2.x, tf2.y );
          if ( tf >= max( tn, 0.0 ) && tn <= 1.0 ) k = 0.06;
        }
        return k;
      }
      void main() {
        float a = 0.0;
        for ( int i = 0; i < 2; i++ ) {
          vec2 d = vP - uL[ i ];
          float x = d.x;
          if ( x < 0.5 ) continue;
          // (the beam spreads as it goes; its pool starts ~3 m out, peaks at
          // ~9, fades to nothing at the reach)
          float w = 0.5 + x * 0.2;
          float across = exp( - ( d.y * d.y ) / ( w * w ) );
          float along = smoothstep( 2.0, 7.5, x ) * ( 1.0 - smoothstep( uReach * 0.35, uReach, x ) ) * ( 9.0 / max( x, 6.0 ) );
          float c = across * along;
          if ( c > 0.002 && uOccN > 0 ) c *= blocked( uL[ i ], vP );
          a += c;
        }
        gl_FragColor = vec4( vec3( a * uGain * 0.06 ), 1.0 );
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// A car's headlamps: two cones in the rain and a lit lens, a real light when
// it has one of the track's two (the player's always; the other goes to the
// car the eye is most likely to see lit).
export class Headlamps {
  constructor(stage, car, points, { reach = 26, intensity = 150, cone = 0.2, pool = 0.5 } = {}) {
    this.stage = stage;
    this.points = points;
    this.reach = reach;
    this.intensity = intensity;
    this.spot = null;
    this.on = true;
    this.cones = points.map((p, i) => {
      const cm = makeConeMesh(stage.U, { apex: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), tan: 0.2, height: reach * 0.7, r0: 0.11, intensity: cone, seed: i * 3.1 + car.kind.length });
      cm.layers.set(LAYER.VOLUME);
      cm.frustumCulled = false;
      stage.scene.add(cm);
      return cm;
    });
    this.entry = stage.lights.add({ position: new THREE.Vector3(), direction: new THREE.Vector3(1, 0, 0), halfAngle: 0.3, range: 18, intensity: 0.8 });
    this._a = new THREE.Vector3(); this._d = new THREE.Vector3();
    // the pools the lamps throw on the wet road ahead: a wash of light laid
    // on the ground (the road's own shader keeps a lamp's pool dark, and a
    // headlamp strikes the road too flat to light it): two long ovals that
    // meet, brightest a car's length out, gone by `reach`
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(reach, 9).rotateX(-Math.PI / 2).translate(reach / 2 + 2.4, 0, 0), poolMaterial(points, reach, pool));
    this.pool.layers.set(LAYER.FX);
    this.pool.frustumCulled = false;
    this.pool.renderOrder = 2;
    this.pool.userData.noRay = true;
    stage.scene.add(this.pool);
  }
  take(spot) { this.spot = spot; }
  release() { if (this.spot) this.spot.intensity = 0; this.spot = null; }
  setOn(on) { this.on = on; for (const c of this.cones) c.visible = on; this.pool.visible = on; this.entry.intensity = on ? 0.8 : 0; if (this.spot && !on) this.spot.intensity = 0; }
  update(car) {
    const m = car.body.matrixWorld;
    // (the pool lies flat on the road, turned with the car)
    const T = car.track;
    // [C3] (on the city's plane the car knows the ground under it)
    this.pool.position.set(car.pos.x, (T ? (T.plane ? (car.groundY ?? 0) : T.ground(car.d)) : 0) + 0.025, car.pos.z);
    this.pool.rotation.set(0, car.yaw, 0);
    // [R2] the cars ahead in the beams: into this car's frame (x ahead, z
    // across), nearest first
    const U = this.pool.material.uniforms, list = car.vehicles ? car.vehicles.list : [];
    const c0 = Math.cos(car.yaw), s0 = Math.sin(car.yaw);
    let n = 0;
    const cand = [];
    for (const v of list) {
      if (v === car || !v.spec) continue;
      const dx = v.pos.x - car.pos.x, dz = v.pos.z - car.pos.z;
      const lx = dx * c0 - dz * s0, lz = dx * s0 + dz * c0;
      if (lx < 1 || lx > this.reach + 4 || Math.abs(lz) > 8) continue;
      cand.push([lx, lz, v]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [lx, lz, v] of cand) {
      if (n >= 2) break;
      const rel = v.yaw - car.yaw;
      U.uOcc.value[n].set(lx, lz, v.spec.halfL * 0.95, v.spec.halfW * 0.95);
      U.uOccR.value[n].set(Math.cos(rel), Math.sin(rel));
      n++;
    }
    U.uOccN.value = n;
    // (aimed a little down the road: the pools slide over the wet ahead)
    const dir = this._d.set(1, -0.055, 0).transformDirection(m);
    for (let i = 0; i < this.cones.length; i++) {
      const c = this.cones[i];
      const a = this._a.copy(this.points[i]).add(_w.set(0.06, 0, 0)).applyMatrix4(m);
      c.position.copy(a);
      c.quaternion.setFromUnitVectors(_v.set(0, -1, 0), dir);
      c.material.uniforms.uApex.value.copy(a);
      c.material.uniforms.uAxis.value.copy(dir);
    }
    const mid = this._a.set(this.points[0].x + 0.2, this.points[0].y, 0).applyMatrix4(m);
    this.entry.position.copy(mid);
    this.entry.direction.copy(dir);
    if (this.spot) {
      const s = this.spot;
      s.position.copy(mid);
      s.target.position.copy(mid).addScaledVector(dir, 20);
      s.target.updateMatrixWorld();
      s.intensity = this.on ? this.intensity : 0;
      s.distance = this.reach + 14;
    }
  }
  dispose() {
    for (const c of this.cones) this.stage.scene.remove(c);
    this.stage.scene.remove(this.pool);
    this.stage.lights.remove(this.entry);
    this.release();
  }
}
