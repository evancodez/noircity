import * as THREE from 'three';
import { anchorInk } from './models.js';

// A car free on the plane (lane C3: the city's streets have real corners).
// Arcade physics on a bicycle model, judged by feel:
//   W throttle (rear drive: quick to answer, not fast: about 75 km/h flat
//   out, 50 feels fast in these streets), S brake then reverse, A / D steer
//   (the wheel's lock narrows with speed so a flick at 60 does not plough),
//   SPACE the handbrake (the rear locks: the tail comes round for the
//   right-angle corner). The tyres have a peak and a slide past it; the
//   load moves forward on the brake (trail-brake into a corner and the tail
//   steps out) and back on the throttle (too much in a slow corner and it
//   steps out); a steadying hand brings the tail back when you ease, so it
//   never spins on its own.
// What it meets (the stage's track: plane = true): walls and fences (boxes),
// columns and posts (circles: a post bends and goes out under a hard blow),
// the other cars and the parked ones (boxes that shunt), the things that
// burst (the smash part). Each contact is an impulse at the contact point:
// a glance scrapes along and turns the car, a square hit stops it. The car
// takes damage by how hard it struck (four steps: a lamp out, the bonnet up
// and steaming, the wheel pulling, then a wreck): v.damage, 'damage' events.
// Frame: pos is the ground under the car's middle; yaw its rotation.y
// (forward (cos, 0, -sin), left (-sin, 0, -cos)); yawRate + to the left.
// Events (v.on): 'scrape' { point, k, what, n }, 'crash' { point, k, what,
// thing }, 'smash' { item }, 'kerb' { k }, 'bump' { by, k }, 'damage'
// { level, k }, 'post' { lamp } (a lamp post bent).
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const G = 9.8;

export const CAR_SPECS = {
  // my coupe: light, a straight eight
  coupe: { vmax: 22.5, accel: 5.2, brake: 8.2, rev: 4.2, a: 1.48, b: 1.62, k: 1.28, h: 0.5, muF: 0.92, muR: 0.97, peakF: 0.13, peakR: 0.11,
    steerMax: 0.58, latCap: 8.6, halfL: 2.45, halfW: 0.94, mass: 1, assist: 3.2, hbGrip: 0.3, hbBrake: 3.5 },
  // the crew's sedan and the traffic's: a little heavier, a little slower
  sedan: { vmax: 20.5, accel: 4.0, brake: 7.8, rev: 4, a: 1.5, b: 1.6, k: 1.32, h: 0.55, muF: 0.92, muR: 0.97, peakF: 0.13, peakR: 0.11,
    steerMax: 0.56, latCap: 8.3, halfL: 2.45, halfW: 0.95, mass: 1.1, assist: 3.4, hbGrip: 0.3, hbBrake: 3.5 },
  truck: { vmax: 13, accel: 2.0, brake: 6.5, rev: 2.5, a: 2.2, b: 2.2, k: 2.0, h: 0.9, muF: 0.85, muR: 0.9, peakF: 0.12, peakR: 0.1,
    steerMax: 0.5, latCap: 5.5, halfL: 3.6, halfW: 1.2, mass: 4, assist: 4, hbGrip: 0.4, hbBrake: 4 },
};
// the damage steps (v.damage crosses each): what the eye sees of them is
// the scene's (a lamp out, the bonnet up and steaming, the wheel pulling)
export const DAMAGE = { steps: [1, 2, 3], wreck: 4 };
// S held at a stop: the breath before it reverses (s), and the reverse's
// pull (x the engine's): quick enough to back off a parked car's bumper in
// a second (2nd owner: 0.3 s and 0.6 took two seconds of S to move a metre)
const REV_BREATH = 0.2, REV_K = 0.95;

let NEXT_ID = 1;

export class Car {
  constructor(vehicles, kind, model, { pos, yaw, spec = null }) {
    this.vehicles = vehicles;
    this.game = vehicles.game;
    this.id = NEXT_ID++;
    this.kind = kind;
    this.model = model;
    this.body = model.group;
    this.spec = { ...CAR_SPECS[kind === 'coupe' ? 'coupe' : kind === 'truck' ? 'truck' : 'sedan'], ...(spec || {}) };
    this.spec.wheelbase = this.spec.a + this.spec.b;
    this.pos = pos.clone();
    this.yaw = yaw;
    this.vel = new THREE.Vector3();
    this.yawRate = 0;
    this.steer = 0;            // the wheel's eased turn, -1 .. 1 (+ left)
    this.delta = 0;            // the front wheels' angle (rad, + left)
    this.accel = 0; this.lat = 0; this.slide = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, hold: 0 };
    this.driver = null;
    this.s = 0; this.d = 0;    // (the old track's: unused on the plane)
    this.roll = 0; this.pitch = 0; this.rollV = 0; this.pitchV = 0; this.heave = 0; this.heaveV = 0;
    this.shake = 0;
    this.hardT = 9;
    this.events = new Map();
    this.solid = true;
    this.frozen = false;
    this.inkSlot = -1;
    this.lamps = null;
    this.hitList = [];
    this.damage = 0;           // 0 .. DAMAGE.wreck
    this.pull = 0;             // the wheel's pull (rad of lock) once damaged
    this.grip = { fl: 1, fr: 1, rl: 1, rr: 1 };   // per tyre (a flat one is ~0.35)
    this.power = 1;            // the engine (a hit tank or engine sputters it)
    this.stats = { scrapes: 0, crashes: 0, hits: 0, maxImpact: 0 };
    this._near = [];
    this.place(this.pos, this.yaw);
  }

  on(name, fn) { if (!this.events.has(name)) this.events.set(name, []); this.events.get(name).push(fn); return fn; }
  off(name, fn) { const L = this.events.get(name); if (L) { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); } }
  emit(name, e) { const L = this.events.get(name); if (L) for (const f of L) f(e, this); }

  get fwd() { return _w.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  get speed() { return this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw); }
  get speedAbs() { return Math.hypot(this.vel.x, this.vel.z); }
  vel3(out) { return out.set(this.vel.x, 0, this.vel.z); }
  get kmh() { return this.speed * 3.6; }
  get track() { return this.game && this.game.stage && this.game.stage.track; }

  // a world point in the car's frame (x ahead, z right)
  local(p, out = new THREE.Vector3()) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(dx * c - dz * s, p.y - this.pos.y, dx * s + dz * c);
  }
  // a point in the car's frame (x ahead, z right) in the world
  world(lx, lz, out = new THREE.Vector3()) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(this.pos.x + lx * c + lz * s, 0, this.pos.z - lx * s + lz * c);
  }
  // my box as a static's (another car's collision reads it)
  box() { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return { cx: this.pos.x, cz: this.pos.z, hx: this.spec.halfL, hz: this.spec.halfW, c, s }; }
  overlaps(p, r, y0 = -1, y1 = 3) {
    if (p.y < this.pos.y + y0 || p.y > this.pos.y + y1) return false;
    const l = this.local(p, _v);
    return Math.abs(l.x) < this.spec.halfL + r && Math.abs(l.z) < this.spec.halfW + r;
  }

  place(pos, yaw, speed = 0) {
    this.pos.set(pos.x, 0, pos.z);
    this.yaw = yaw;
    this.vel.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(speed);
    this.yawRate = 0; this.steer = 0; this.delta = 0;
    this.roll = this.pitch = this.heave = 0; this.rollV = this.pitchV = this.heaveV = 0;
    this._lp = null; this.pinT = 0;
    this.pose(0);
  }

  // ---- one fixed step ------------------------------------------------------------------
  step(dt) {
    if (this.frozen || dt <= 0) { this.pose(0); return; }
    if (this.driver && this.driver.kinematic) {
      this.driver.drive(this, dt);
      this.hardT += dt;
      this.pose(dt);
      return;
    }
    if (this.driver && this.driver !== 'player' && this.driver.drive) this.driver.drive(this, dt);
    const n = 4, h = dt / n;
    for (let i = 0; i < n; i++) this.integrate(h);
    this.hardT += dt;
    this.touch = false;
    this.collide(dt);
    this.unstick(dt);
    this.pose(dt);
  }

  // the bicycle model (per unit mass): u along, w to the left, r the yaw rate
  integrate(dt) {
    const S = this.spec, I = this.input, L = S.wheelbase;
    const c = Math.cos(this.yaw), sn = Math.sin(this.yaw);
    let u = this.vel.x * c - this.vel.z * sn;
    let w = -this.vel.x * sn - this.vel.z * c;
    let r = this.yawRate;
    const th = clamp(I.throttle, 0, 1) * this.power, br = clamp(I.brake, 0, 1), hb = I.handbrake ? 1 : 0;
    // the wheel: eased toward the hands' ask (in fast, back faster); the
    // lock narrows with speed (a flick at 60 asks for about the grip)
    const want = clamp(I.steer, -1, 1);
    const rate = Math.abs(want) > Math.abs(this.steer) && Math.sign(want) === Math.sign(this.steer || want) ? 5.5 : 8;
    this.steer += clamp(want - this.steer, -rate * dt, rate * dt);
    const v = Math.abs(u);
    const lock = Math.min(S.steerMax, Math.atan((1.25 * S.latCap * L) / Math.max(v * v, 1)));
    const delta = clamp(this.steer * lock + this.pull, -S.steerMax, S.steerMax);
    this.delta = delta;
    // along: the drive (the rear's), the brakes, the drag
    let ax = 0;
    const fwdGo = u > -0.4;
    // (the drive: what the rear tyres can put down - the rest spins them, it
    // does not throw the tail away; a little past it, so it can step out)
    const ld0 = clamp((S.h * (this.accel || 0)) / (G * L), -0.18, 0.18);
    const tract = S.muR * G * (S.a / L + ld0) * 0.5 * (this.grip.rl + this.grip.rr) * 0.72;
    let drive = 0;
    if (th > 0 && fwdGo) drive = Math.min(th * S.accel * Math.max(0, 1 - Math.pow(Math.max(0, u) / S.vmax, 2)), tract + 0.6 * th);
    // (the tail out past the tyres' peak: the throttle bites less - it steps
    // out, it does not spin round on a held throttle)
    drive *= 1 - clamp((Math.abs(this.slipR || 0) / S.peakR - 1.2) * 0.35, 0, 0.75);
    ax += drive;
    if (th > 0 && u < -0.4) ax += th * S.brake;                 // (W while rolling back: a brake)
    let braking = 0;
    // (stopped on the brake, a breath, then S reverses - a man's foot on the
    // brake: the drivers of the city's cars hold it (input.hold) and never
    // roll back into the car behind; only the player's S, or a driver who
    // means to back off a thing, reverses)
    const hold = !!I.hold;
    this.stopT = br > 0 && th === 0 && Math.abs(u) < 0.4 ? (this.stopT || 0) + dt : u < -0.4 ? 9 : 0;
    if (br > 0) {
      if (u > 0.4) braking = br * S.brake;
      else if (hold) { if (u < -0.4) braking = br * S.brake; }
      else if (th === 0 && u > -S.rev && this.stopT > REV_BREATH) ax -= br * S.accel * REV_K;
    }
    if (braking) ax -= braking * Math.sign(u);
    if (hb && Math.abs(u) > 0.3) ax -= Math.sign(u) * S.hbBrake;
    // (the road and the air; off the throttle the engine holds it back)
    const drag = 0.22 + 0.0012 * u * u + (th === 0 && br === 0 && !hb ? 0.65 : 0);
    if (Math.abs(u) > 0.05) ax -= Math.sign(u) * drag;
    // the load: forward on the brake, back on the throttle
    const ld = clamp((S.h * ax) / (G * L), -0.18, 0.18);
    const loadF = S.b / L - ld, loadR = S.a / L + ld;
    // the tyres' grip (per unit mass): the friction a side can give
    const gF = 0.5 * (this.grip.fl + this.grip.fr), gR = 0.5 * (this.grip.rl + this.grip.rr);
    let capF = S.muF * G * loadF * gF, capR = S.muR * G * loadR * gR;
    if (hb) capR *= S.hbGrip;
    // (the friction circle: what drive and brake take, the side cannot)
    const xF = braking * 0.62, xR = braking * 0.38 + drive + (hb ? S.hbBrake : 0);
    const latF = Math.sqrt(Math.max(0, capF * capF - Math.min(xF, capF * 0.7) ** 2));
    const latR = Math.sqrt(Math.max(0, capR * capR - Math.min(xR, capR * 0.85) ** 2));
    // the slip angles (the wheel's heading against its path)
    const uu = Math.max(Math.abs(u), 1.5);
    const sgn = u >= 0 ? 1 : -1;
    const slipF = Math.atan2(w + S.a * r, uu) - delta * sgn;
    const slipR = Math.atan2(w - S.b * r, uu);
    // the curve: up to the peak, then a slide that keeps most of it
    const curve = (x) => { const a = Math.abs(x); const f = a <= 1 ? (2 * a) / (1 + a * a) : Math.max(0.78, (2 * a) / (1 + a * a)); return Math.sign(x) * f; };
    const FyF = -latF * curve(slipF / S.peakF);
    const FyR = -latR * curve(slipR / S.peakR);
    // (a car standing still has no side force: its wheels roll it nowhere)
    const kin = clamp((2.2 - v) / 1.6, 0, 1);
    let dw = FyF * Math.cos(delta) + FyR - u * r;
    let dr = (S.a * FyF * Math.cos(delta) - S.b * FyR) / (S.k * S.k);
    // the steadying hand: off the handbrake, the yaw is drawn back toward
    // what the wheels ask (the tail comes back when you ease) - weaker while
    // the hands ask for more, so a slide can be held
    if (!hb) {
      const rKin = (u * Math.tan(delta)) / L;
      const rCap = (S.latCap * 1.05) / Math.max(v, 2);
      const target = clamp(rKin, -rCap, rCap);
      const easing = Math.abs(want) < Math.abs(this.steer) + 0.05 || Math.sign(want) !== Math.sign(r) ? 1 : 0.45;
      dr += -(r - target) * S.assist * easing * clamp(v / 6, 0, 1);
      // (the body's slip held within ~40 degrees: past it, it spins)
      const beta = Math.atan2(w, Math.max(Math.abs(u), 0.5));
      if (Math.abs(beta) > 0.55) dw -= Math.sign(beta) * (Math.abs(beta) - 0.55) * 18;
    }
    u += (ax + w * r - FyF * Math.sin(delta)) * dt;
    w += dw * dt;
    r += dr * dt;
    // (at a crawl the car goes where its wheels point)
    if (kin > 0) {
      const rK = (u * Math.tan(delta)) / L;
      r += (rK - r) * kin;
      w *= 1 - kin;
    }
    // (a stop is a stop: the brake does not push it backwards)
    if (br > 0 && th === 0 && Math.abs(u) < 0.4 && (this.stopT <= REV_BREATH || hold)) u = 0;
    if (!th && !br && Math.abs(u) < 0.12) u = 0;
    this.yaw += r * dt;
    this.yawRate = r;
    const c2 = Math.cos(this.yaw), s2 = Math.sin(this.yaw);
    // forward (c, -s), left (-s, -c)
    this.vel.set(u * c2 - w * s2, 0, -u * s2 - w * c2);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.accel = ax; this.lat = u * r;
    this.slide = clamp((Math.abs(slipR) / S.peakR - 1.1) * 0.8, 0, 1) * clamp(v / 5, 0, 1) + (hb && v > 3 ? 0.6 : 0);
    this.slipF = slipF; this.slipR = slipR;
  }

  // ---- what it meets ------------------------------------------------------------------------
  collide(dt) {
    const T = this.track;
    if (!T || !T.plane) return;
    const S = this.spec;
    const R = S.halfL + 1.5;
    // the walls, fences, columns, posts
    const list = T.statics(this.pos.x, this.pos.z, R, this._near);
    for (const k of list) {
      if (k.gone) continue;
      if (k.r != null) this.vsCircle(k);
      else this.vsBox(k, null);
    }
    // the other cars and the parked ones
    for (const o of T.bodies()) {
      if (o === this || !o.solid) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z;
      const RR = S.halfL + (o.spec ? o.spec.halfL : o.hx) + 0.5;
      if (dx * dx + dz * dz > RR * RR) continue;
      this.vsBox(o.box ? o.box() : o, o);
    }
    // what bursts, what is kicked
    if (T.smash) {
      const hit = T.smash.collide(this, this.hitList);
      // ([C3 3rd] what it costs: the speed (a stall about a third), a jolt,
      // a little damage by the speed it was met at)
      for (const it of hit) {
        const sp0 = this.speedAbs;
        this.vel.multiplyScalar(it.drag); this.yawRate *= 0.97;
        this.shake = Math.min(1, this.shake + 0.3 + (1 - it.drag) * 1.5);
        if (it.drag < 0.9) this.pitchV -= (1 - it.drag) * 3;
        if (it.dmg) this.hurt(it.dmg * clamp(sp0 / 12, 0.3, 1.4), new THREE.Vector3(it.pos.x, 0.6, it.pos.z));
        this.emit('smash', { item: it, k: 1 - it.drag });
      }
      T.smash.kickPieces(this);
      // ([C3 3rd] nothing left inside my own car's body once it has moved)
      if (T.smash.guardBody && this.vehicles && this.vehicles.player === this) T.smash.guardBody(this);
    }
    // the kerbs: a bump crossing one at speed
    const g = T.ground(this.pos.x + Math.cos(this.yaw) * S.halfL * 0.6, this.pos.z - Math.sin(this.yaw) * S.halfL * 0.6);
    if (this._g != null && Math.abs(g - this._g) > 0.06 && this.speedAbs > 3) {
      const k = Math.min(1, this.speedAbs / 18);
      this.heaveV += 1.0 * k; this.shake = Math.min(1, this.shake + 0.22);
      this.vel.multiplyScalar(1 - 0.03 * k);
      this.yawRate += (Math.random() - 0.5) * 0.25 * k;
      this.emit('kerb', { k });
    }
    this._g = g;
  }

  // my box against another (a static box { cx, cz, hx, hz, c, s }, or a
  // body's): the axis of least overlap, the deepest corner, the impulse
  vsBox(B, body) {
    const S = this.spec;
    const ca = Math.cos(this.yaw), sa = Math.sin(this.yaw);
    // my axes: ahead (ca, -sa), across (sa, ca); B's: (c, -s), (s, c)
    const bc = B.c ?? Math.cos(B.angle || 0), bs = B.s ?? Math.sin(B.angle || 0);
    const axes = [[ca, -sa], [sa, ca], [bc, -bs], [bs, bc]];
    const dx = B.cx - this.pos.x, dz = B.cz - this.pos.z;
    let best = Infinity, bn = null, bi = -1;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = axes[i];
      const ra = S.halfL * Math.abs(ca * ax - sa * az) + S.halfW * Math.abs(sa * ax + ca * az);
      const rb = B.hx * Math.abs(bc * ax - bs * az) + B.hz * Math.abs(bs * ax + bc * az);
      const d = dx * ax + dz * az;
      const o = ra + rb - Math.abs(d);
      if (o <= 0) return false;
      if (o < best) { best = o; bi = i; bn = d > 0 ? [-ax, -az] : [ax, az]; }   // (n: from B toward me)
    }
    // the contact: B's deepest corner into me (my axis) or mine into B
    let px, pz;
    const corner = (cx, cz, hx, hz, c, s, sx, sz) => [cx + sx * hx * c + sz * hz * s, cz - sx * hx * s + sz * hz * c];
    if (bi < 2) {
      // B's corner deepest into me (furthest along n, toward me; two as deep
      // - a face of it met flat - their middle)
      const cs = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [x, z] = corner(B.cx, B.cz, B.hx, B.hz, bc, bs, sx, sz); cs.push([-(x * bn[0] + z * bn[1]), x, z]); }
      cs.sort((a, b) => a[0] - b[0]);
      const k = clamp(1 - (cs[1][0] - cs[0][0]) / 0.25, 0, 1) * 0.5;
      px = cs[0][1] + (cs[1][1] - cs[0][1]) * k; pz = cs[0][2] + (cs[1][2] - cs[0][2]) * k;
      // (on a face that long - a building - its corner may lie far off: the
      // contact is my face's point nearest it)
      const l = this.local(_v.set(px, 0, pz), _w);
      const qx = clamp(l.x, -S.halfL, S.halfL), qz = clamp(l.z, -S.halfW, S.halfW);
      const p = this.world(qx, qz, _v); px = p.x; pz = p.z;
    } else {
      // my corner deepest into B; (a face met flat - the second corner as
      // deep, near enough - is met at its middle: a square blow does not
      // spin the car on a corner it never struck alone)
      const cs = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [x, z] = corner(this.pos.x, this.pos.z, S.halfL, S.halfW, ca, sa, sx, sz); cs.push([x * bn[0] + z * bn[1], x, z]); }
      cs.sort((a, b) => a[0] - b[0]);
      const k = clamp(1 - (cs[1][0] - cs[0][0]) / 0.25, 0, 1) * 0.5;
      px = cs[0][1] + (cs[1][1] - cs[0][1]) * k; pz = cs[0][2] + (cs[1][2] - cs[0][2]) * k;
    }
    this.contact(bn[0], bn[1], best, px, pz, body, B);
    return true;
  }

  // a round thing (n from it toward me)
  vsCircle(k) {
    const S = this.spec;
    const l = this.local(_v.set(k.x, 0, k.z), _w);
    const qx = clamp(l.x, -S.halfL, S.halfL), qz = clamp(l.z, -S.halfW, S.halfW);
    const ox = l.x - qx, oz = l.z - qz;
    const d2 = ox * ox + oz * oz;
    if (d2 >= k.r * k.r && !(l.x === qx && l.z === qz)) return;
    let nlx, nlz, pen;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); nlx = -ox / d; nlz = -oz / d; pen = k.r - d; }
    else { const px = S.halfL - Math.abs(l.x), pz = S.halfW - Math.abs(l.z); if (px < pz) { nlx = -Math.sign(l.x); nlz = 0; pen = px + k.r; } else { nlx = 0; nlz = -Math.sign(l.z); pen = pz + k.r; } }
    // (to world: local x ahead, z right)
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const nx = nlx * c + nlz * s, nz = -nlx * s + nlz * c;
    const p = this.world(qx, qz, _v);
    // a lamp post (or a hydrant) given to a hard blow: it bends and goes
    if (k.give && this.approach(nx, nz, p.x, p.z) > (k.giveAt ?? 4.5)) {
      const vn = this.approach(nx, nz, p.x, p.z);
      k.gone = true;
      this.vel.multiplyScalar(k.drag ?? 0.78);
      this.yawRate += (Math.random() - 0.5) * 0.6;
      this.shake = 1;
      this.hurt(Math.max(0, vn - 3) * (k.hurt ?? 0.1), new THREE.Vector3(p.x, 0.6, p.z));
      if (k.onGive) k.onGive(this, vn);
      this.emit('post', { thing: k, k: Math.min(1, vn / 14) });
      return;
    }
    this.contact(nx, nz, pen, p.x, p.z, null, k);
  }

  // the speed at which the point (px, pz) of me approaches along -n
  approach(nx, nz, px, pz) {
    const rx = px - this.pos.x, rz = pz - this.pos.z;
    const r = this.yawRate;
    const vx = this.vel.x + r * rz, vz = this.vel.z - r * rx;
    return -(vx * nx + vz * nz);
  }

  // resolve a contact: n (unit, toward me), pen, the point; o: the other
  // body (or null: a wall)
  contact(nx, nz, pen, px, pz, o, thing) {
    const S = this.spec;
    const m1 = S.mass, I1 = m1 * S.k * S.k;
    // (a car held where it is - a wreck, a scripted one - is a wall that moves not)
    const fixed = o && (o.frozen || (o.driver && o.driver.kinematic));
    const m2 = o && !fixed ? (o.spec ? o.spec.mass : o.mass) : Infinity;
    const I2 = o && !fixed ? m2 * (o.spec ? o.spec.k * o.spec.k : 1.7) : Infinity;
    // (out of each other: the lighter moved the more)
    const k1 = o && isFinite(m2) ? m2 / (m1 + m2) : 1, k2 = o && isFinite(m2) ? m1 / (m1 + m2) : 0;
    this.pos.x += nx * pen * k1; this.pos.z += nz * pen * k1;
    if (o) { o.pos.x -= nx * pen * k2; o.pos.z -= nz * pen * k2; }
    this.touch = true;
    // the relative speed at the point
    const r1x = px - this.pos.x, r1z = pz - this.pos.z;
    const v1x = this.vel.x + this.yawRate * r1z, v1z = this.vel.z - this.yawRate * r1x;
    let v2x = 0, v2z = 0, r2x = 0, r2z = 0;
    const or = o ? (o.yawRate || 0) : 0;
    if (o) { r2x = px - o.pos.x; r2z = pz - o.pos.z; v2x = o.vel.x + or * r2z; v2z = o.vel.z - or * r2x; }
    const rvx = v1x - v2x, rvz = v1z - v2z;
    const vn = rvx * nx + rvz * nz;
    // ([C3 4th] a car resting against a car - held into it, closing at
    // nothing - is told so too: 'lean' (the tail's shunt held on his quarter))
    if (vn >= 0) { if (o && o.emit && o.spec) o.emit('lean', { by: this, imp: 0, point: new THREE.Vector3(px, 0.6, pz), n: new THREE.Vector3(-nx, 0, -nz) }); return; }
    // (r x n: the turn an impulse along n gives; in the plane, + left)
    const c1 = r1z * nx - r1x * nz, c2 = r2z * nx - r2x * nz;
    const e = 0.18;
    const den = 1 / m1 + (c1 * c1) / I1 + (o ? 1 / m2 + (c2 * c2) / I2 : 0);
    const j = (-(1 + e) * vn) / den;
    // friction along the face: a scrape slides on, losing speed
    const tx = -nz, tz = nx;
    const vt = rvx * tx + rvz * tz;
    const ct1 = r1z * tx - r1x * tz, ct2 = r2z * tx - r2x * tz;
    const dent = 1 / m1 + (ct1 * ct1) / I1 + (o ? 1 / m2 + (ct2 * ct2) / I2 : 0);
    const mu = o ? 0.35 : 0.28;
    const jt = clamp(-vt / dent, -mu * j, mu * j);
    const Jx = nx * j + tx * jt, Jz = nz * j + tz * jt;
    this.vel.x += Jx / m1; this.vel.z += Jz / m1;
    this.yawRate += (r1z * Jx - r1x * Jz) / I1;
    if (o) {
      o.vel.x -= Jx / m2; o.vel.z -= Jz / m2;
      if (o.yawRate != null) o.yawRate -= (r2z * Jx - r2x * Jz) / I2;
      if (o.woken != null) o.woken = 0;
    }
    // how hard: the speed into the thing
    const imp = -vn;
    const point = new THREE.Vector3(px, 0.6, pz);
    const what = o ? o.kind || 'car' : thing.tag || 'wall';
    const f = this.fwd, headOn = Math.abs(f.x * nx + f.z * nz);
    if (imp > 5 && headOn > 0.7) {
      this.hardT = 0; this.shake = 1; this.pitchV -= 2.2 * Math.sign(-(f.x * nx + f.z * nz) || 1);
      this.stats.crashes++;
      this.emit('crash', { point, k: Math.min(1, imp / 16), what, thing: o || thing, n: new THREE.Vector3(nx, 0, nz) });
    } else if (imp > 0.6) {
      this.shake = Math.min(1, this.shake + 0.25 + imp * 0.06);
      this.stats.scrapes++;
      this.emit('scrape', { point, k: Math.min(1, Math.max(0.15, imp / 9)), what, thing: o || thing, n: new THREE.Vector3(nx, 0, nz) });
    }
    this.stats.maxImpact = Math.max(this.stats.maxImpact, imp);
    if (imp > 3) { const L = this.stats.log || (this.stats.log = []); if (L.length < 40) L.push([+px.toFixed(1), +pz.toFixed(1), +imp.toFixed(1), what]); }
    // the damage: a glance costs nothing, a square blow a step or two
    // (a square blow at 45 km/h is about a step; a glance a fraction of one)
    if (imp > 5) this.hurt((imp - 5) * (headOn > 0.6 ? 0.14 : 0.08), point);
    if (o) {
      o.emit && o.emit('bump', { by: this, k: Math.min(1, imp / 10), imp, point, n: new THREE.Vector3(-nx, 0, -nz) });
      if (o.hurt && imp > 5) o.hurt((imp - 5) * 0.1, point);
    }
  }

  hurt(k, point = null) {
    if (k <= 0) return;
    if (globalThis.__c3debug) console.log('hurt', k.toFixed(2), this.kind);
    const before = Math.floor(this.damage);
    // ([C3 4th] a car with a warning level - mine in the tail, warnAt - is
    // never wrecked by one blow from below it: the blow leaves it at half a
    // step short, and the warning comes first; WAVE_C 1.2)
    const was = this.damage;
    this.damage = Math.min(DAMAGE.wreck + 0.5, this.damage + k);
    if (this.warnAt != null && was < this.warnAt && this.damage >= DAMAGE.wreck) this.damage = DAMAGE.wreck - 0.5;
    this.stats.hits++;
    const after = Math.floor(this.damage);
    if (after > before) this.emit('damage', { level: after, k, point });
  }

  // never wedged: throttle held against a thing and not moving, the wheels
  // scrabble it round off it (A / D pivot; left alone it backs off a little)
  unstick(dt) {
    const th = this.input.throttle, br = this.input.brake;
    const lp = this._lp || (this._lp = this.pos.clone());
    const moved = Math.hypot(this.pos.x - lp.x, this.pos.z - lp.z) / Math.max(dt, 1e-4);
    lp.copy(this.pos);
    this.touchT = this.touch ? 0 : (this.touchT ?? 9) + dt;
    // (stood on the brake against a thing is a stop, not a wedge: only a
    // wish to go - the throttle, or S held past the breath that reverses)
    const stuck = this.touchT < 0.3 && (th > 0 || (br > 0 && !this.input.hold && (this.stopT || 0) > REV_BREATH)) && moved < 0.8;
    this.pinT = stuck ? (this.pinT || 0) + dt : Math.max(0, (this.pinT || 0) - dt * 2);
    if (this.pinT < 0.35) return;
    const st = clamp(this.input.steer, -1, 1);
    this.yaw += (st || (this._pinDir ??= Math.random() < 0.5 ? -1 : 1)) * 1.2 * dt;
    if (!st) this._pinDir = this._pinDir || 1;
  }

  // ---- the body's motion ----------------------------------------------------------------------
  pose(dt) {
    const T = this.track;
    if (dt > 0) {
      const pt = clamp(this.accel * 0.0045, -0.05, 0.05), rt = clamp(this.lat * 0.006, -0.06, 0.06);
      const k = 60, dmp = 9;
      this.pitchV += ((pt - this.pitch) * k - this.pitchV * dmp) * dt; this.pitch += this.pitchV * dt;
      this.rollV += ((rt - this.roll) * k - this.rollV * dmp) * dt; this.roll += this.rollV * dt;
      this.heaveV += ((0 - this.heave) * 90 - this.heaveV * 10) * dt; this.heave += this.heaveV * dt;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    // the ground under it: the four wheels' (a kerb lifts one side)
    let g = 0, gp = 0, gr = 0;
    if (T && T.ground) {
      const S = this.spec, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const at = (lx, lz) => T.ground(this.pos.x + lx * c + lz * s, this.pos.z - lx * s + lz * c);
      const fl = at(S.a, -S.halfW * 0.85), fr = at(S.a, S.halfW * 0.85), rl = at(-S.b, -S.halfW * 0.85), rr = at(-S.b, S.halfW * 0.85);
      g = (fl + fr + rl + rr) / 4;
      gp = Math.atan2(((fl + fr) - (rl + rr)) / 2, S.wheelbase);
      gr = Math.atan2(((fl + rl) - (fr + rr)) / 2, S.halfW * 1.7);
      this.groundY = g;
    }
    const B = this.body;
    const t = this.game ? this.game.time : 0;
    const sp = Math.min(1, this.speedAbs / 20);
    const shiver = (Math.sin(t * 37.0) * 0.6 + Math.sin(t * 23.3 + 1.2) * 0.4) * (0.003 * sp + 0.012 * this.shake);
    B.position.set(this.pos.x, g + this.heave + shiver, this.pos.z);
    _q.setFromAxisAngle(_w.set(0, 1, 0), this.yaw);
    B.quaternion.copy(_q)
      .multiply(_q2.setFromAxisAngle(_w.set(0, 0, 1), this.pitch + gp + (this.sagPitch || 0)))
      .multiply(_q2.setFromAxisAngle(_w.set(1, 0, 0), this.roll + gr + shiver * 0.3 + (this.sagRoll || 0)));
    B.updateMatrixWorld(true);
    anchorInk(this.inkSlot, B);
    if (this.lamps) this.lamps.update(this);
    if (this.onPose) this.onPose(this);
  }

  seat(localEye, out = new THREE.Vector3()) { return out.copy(localEye).applyMatrix4(this.body.matrixWorld); }
}
