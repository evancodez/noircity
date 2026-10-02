// A driver that follows a path (lane C3: his car, the city's traffic, the
// bots' hands): the same inputs a player gives (throttle, brake, steer,
// handbrake) into the same car physics (Car.js) - no leash, no hand on the
// car itself. Pure pursuit onto a point ahead on the path, the speed the
// path allows there (its corners, the brake before them) scaled by how the
// man drives, and the car ahead kept clear of (it brakes behind it, and
// eases round a slow one when the road beside it is free).
//   const p = new Pilot(path, opts); v.driver = p;  (p.drive(v, dt) each step)
//   opts: { pace: 1 (x the path's speeds), vmax, look: 1 (x lookahead),
//           keep: 7 (m behind the car ahead), wander: 0 (m of weave),
//           bodies: () => [cars to keep clear of], stopAt: s | null }
//   p.s (along the path), p.done (at its end), p.ahead (the car followed)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Pilot {
  constructor(path, opts = {}) {
    this.path = path;
    this.o = { pace: 1, vmax: 30, look: 1, keep: 7, wander: 0, stopAt: null, bodies: null, ...opts };
    this.i = -1;
    this.s = 0;
    this.done = false;
    this.t = 0;
    this.ahead = null;
    this._a = {}; this._b = {};
  }

  setPath(path, v = null) { this.path = path; this.i = -1; this.done = false; if (v) this.locate(v); }
  locate(v) { this.i = this.path.nearestAll(v.pos.x, v.pos.z); this.s = this.path.pts[this.i].s; }

  drive(v, dt) {
    const P = this.path, O = this.o, I = v.input;
    this.t += dt;
    if (this.i < 0) this.locate(v);
    this.i = P.nearest(v.pos.x, v.pos.z, this.i, 30);
    // (between two samples: the projection onto the leg)
    const p = P.pts[this.i], q = P.pts[Math.min(P.pts.length - 1, this.i + 1)];
    const lx = q.x - p.x, lz = q.z - p.z, ll = Math.hypot(lx, lz) || 1;
    this.s = clamp(p.s + ((v.pos.x - p.x) * lx + (v.pos.z - p.z) * lz) / ll, 0, P.len);
    this.err = ((v.pos.x - p.x) * -lz + (v.pos.z - p.z) * lx) / ll;   // (+ right of the path)
    const sp = Math.max(0, v.speed);
    if (this.s >= P.len - 1.5) this.done = true;
    // the point to steer for
    const Ld = clamp((4.5 + sp * 0.42) * O.look, 4.5, 16);
    const T = P.at(Math.min(P.len, this.s + Ld), this._a);
    let tx = T.x, tz = T.z;
    // (a lane change: off the path to its right by `offset` m - pulling over,
    // or out into the other lane to pass)
    this.offNow = (this.offNow || 0) + ((this.offset || 0) + (this.passing || 0) - (this.offNow || 0)) * (1 - Math.exp(-dt * 2.2));
    if (this.offNow) { tx += -T.fz * this.offNow; tz += T.fx * this.offNow; }
    if (O.wander) { this.wph = (this.wph || 0) + dt * (O.wanderRate ?? 0.9); const w = Math.sin(this.wph) * O.wander; tx += -T.fz * w; tz += T.fx * w; }
    const c = Math.cos(v.yaw), sn = Math.sin(v.yaw);
    const dx = tx - v.pos.x, dz = tz - v.pos.z;
    const fx = dx * c - dz * sn, fz = dx * sn + dz * c;     // (car frame: ahead, right)
    const L = v.spec.wheelbase || 3.1;
    const k = (-2 * fz) / Math.max(1, fx * fx + fz * fz);   // (+ left)
    const lock = Math.min(v.spec.steerMax, Math.atan((1.25 * v.spec.latCap * L) / Math.max(sp * sp, 1)));
    let steer = Math.atan(k * L) / Math.max(0.05, lock);
    // (a little damping on the yaw: no wobble out of a corner)
    steer -= v.yawRate * 0.06;
    I.steer = clamp(steer, -1, 1);
    // the speed the path allows a little ahead (its brake points are in it)
    let want = Math.min(O.vmax, P.at(Math.min(P.len, this.s + 1.5 + sp * 0.25), this._b).v * O.pace);
    // the car ahead in my lane: kept clear of
    this.ahead = null;
    if (O.bodies) {
      let best = Infinity;
      let nudge = 0;
      for (const o of O.bodies()) {
        // ([C3 3rd] skip: a car it is going round - not followed)
        if (o === v || !o.solid || o === this.skip) continue;
        // (a parked car into the lane: steered round, not followed)
        if (o.parked) {
          const ox = o.pos.x - v.pos.x, oz = o.pos.z - v.pos.z;
          if (Math.abs(ox) > 30 || Math.abs(oz) > 30) continue;
          const ax = ox * c - oz * sn, az = ox * sn + oz * c;
          if (ax < 2 || ax > 22) continue;
          const pa = P.at(Math.min(P.len, this.s + ax), this._b);
          const pz = (pa.x - v.pos.x) * sn + (pa.z - v.pos.z) * c;
          const d = az - pz, need = 2.15;
          if (Math.abs(d) < need) nudge += -Math.sign(d || 1) * (need - Math.abs(d)) * (1 - ax / 24);
          continue;
        }
        const ox = o.pos.x - v.pos.x, oz = o.pos.z - v.pos.z;
        if (ox * ox + oz * oz > 45 * 45) continue;
        const ax = ox * c - oz * sn, az = ox * sn + oz * c;
        if (ax < 1 || ax > 40) continue;
        // (in the corridor the path takes: its lateral offset at that range)
        const pa = P.at(Math.min(P.len, this.s + ax), this._b);
        const pz = (pa.x - v.pos.x) * sn + (pa.z - v.pos.z) * c;
        if (Math.abs(az - pz) > 2.0) continue;
        if (ax < best) { best = ax; this.ahead = o; }
      }
      if (nudge) { const nl = Math.atan(((-2 * (fz + nudge)) / Math.max(1, fx * fx + fz * fz)) * L) / Math.max(0.05, lock); I.steer = clamp(nl - v.yawRate * 0.06, -1, 1); }
      // (stuck behind a slower car with the other lane clear ahead: out and
      // past it - a man who wants to be gone does)
      if (O.overtake) {
        const slow = this.ahead && Math.max(0, this.ahead.vel.x * c - this.ahead.vel.z * sn) < sp - 1.5 && best < 18;
        this.passT = slow ? (this.passT || 0) + dt : Math.max(0, (this.passT || 0) - dt * 0.5);
        if (this.passT > 0.6 && !this.passing) {
          let clear = true;
          for (const o of O.bodies()) {
            if (o === v || o === this.ahead || !o.solid) continue;
            const ox = o.pos.x - v.pos.x, oz = o.pos.z - v.pos.z;
            const ax = ox * c - oz * sn, az = ox * sn + oz * c;
            if (ax > -4 && ax < 45 && az < -0.5 && az > -5.5) { clear = false; break; }
          }
          if (clear) { this.passing = -3.2; this.passUntil = this.t + 3.5; }
        }
        if (this.passing && this.t > this.passUntil && (!this.ahead || best > 10)) this.passing = 0;
        if (this.passing) { this.ahead = null; }
      }
      if (this.ahead) {
        const o = this.ahead;
        const ov = Math.max(0, (o.vel.x * c - o.vel.z * sn));
        const gap = best - 2 * 2.45 - O.keep;
        const vf = Math.sqrt(Math.max(0, 2 * 5 * Math.max(0, gap))) + ov;
        want = Math.min(want, vf);
      }
    }
    if (O.stopAt != null) want = Math.min(want, Math.sqrt(Math.max(0, 2 * 4.5 * (O.stopAt - this.s - 0.5))));
    if (this.done) want = 0;
    this.want = want;
    // (stuck - against a thing, wanting to go and not going - back off it
    // with the wheel the other way, then on)
    if (this.backT > 0) {
      this.backT -= dt;
      I.throttle = 0; I.brake = 1; I.steer = -this.backSteer; I.handbrake = 0; I.hold = 0;
      return;
    }
    this.stuckT = want > 2 && sp < 0.8 ? (this.stuckT || 0) + dt : 0;
    if (this.stuckT > 1.2) { this.stuckT = 0; this.backT = 1.1; this.backSteer = clamp(steer, -1, 1) || 1; }
    const e = want - sp;
    I.throttle = e > 0.2 ? clamp(e / 3, 0.25, 1) : 0;
    I.brake = e < -0.8 ? clamp(-e / 4, 0.1, 1) : 0;
    if (want < 0.2 && sp < 0.6) { I.throttle = 0; I.brake = 1; }
    I.handbrake = 0;
    // (a foot on the brake at a stop holds the car there: it never rolls
    // back into the car behind - Car.js reverses only an unheld brake)
    I.hold = 1;
  }
}
