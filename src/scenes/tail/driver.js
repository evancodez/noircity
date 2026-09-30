import { ROAD, frameAt, roadPoint } from '../../stages/riverroad/road.js';

// The watcher at the wheel (scene 7): his sedan down the river road on the
// same physics as mine (src/vehicles/Vehicle.js), steered along a line of
// his own and held on a rubber band to me: 25 to 60 m ahead, closer as the
// scene goes on; past the close mark he can be caught (the band lets go
// down to ~10 m, and he tires: his top speed drops a little).
// His line: the right lane, a weave through the market (close to the
// stalls: he clips them and their crates go into my road), round the truck
// and the oncoming car.
//   new Watcher(tail) -> a driver: v.driver = w; w.drive(v, dt)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const F = {};

export class Watcher {
  constructor(tail) {
    this.tail = tail;
    this.gapT = 50;
    this.caught = false;
    this.avoid = [];     // { s0, s1, d } stretches he steers round (the truck, the oncoming car)
    // (the newsstand on its corner: he clips it and its papers fill my road)
    this.avoid.push({ s0: ROAD.marks.stand - 28, s1: ROAD.marks.stand + 24, d: -6.9 });
  }

  // the gap he keeps, by where he is on the road
  wantGap(s) {
    const M = ROAD.marks;
    if (s < M.close) return 46 - 20 * clamp((s - 60) / (M.close - 60), 0, 1);
    return this.caught ? 9 : 22;
  }

  // his line across the road at s
  lineAt(s) {
    const M = ROAD.marks;
    let d = 1.9;
    // the market: a weave toward the stalls and back, twice
    if (s > M.market - 20 && s < M.marketEnd + 10) {
      const u = (s - (M.market - 20)) / (M.marketEnd + 30 - M.market);
      d = 1.9 - 6.2 * Math.pow(Math.sin(u * Math.PI * 2.5), 2) * Math.sin(u * Math.PI);
    }
    // a lazy S elsewhere (a man looking in his mirror)
    else d += 0.8 * Math.sin(s / 47);
    for (const a of this.avoid) if (s > a.s0 && s < a.s1) {
      const u = (s - a.s0) / (a.s1 - a.s0);
      d += (a.d - d) * Math.sin(u * Math.PI);
    }
    return clamp(d, -6.4, 5.4);
  }

  drive(v, dt) {
    const T = this.tail, me = T.my;
    const I = v.input;
    const s = v.s, sp = Math.max(0, v.speed);
    // the rubber band: my speed plus what the gap asks
    const gap = s - me.s;
    const want = this.wantGap(s);
    const meSp = Math.max(0, me.speed);
    let target = meSp + (gap - want) * -0.55;
    const top = this.caught ? 26.5 : (s > ROAD.marks.close ? 27.5 : 33);
    // (far ahead he eases off - a man who thinks he has lost me - so a
    // crash costs me the ground, not the tail)
    target = clamp(target, s < 40 ? 14 : gap > 62 ? 5 : 11, top);
    if (T.state === 'start') target = Math.min(target, 16);
    // the steering: aim at a point on his line ahead (pure pursuit)
    const ahead = clamp(7 + sp * 0.55, 8, 22);
    const sa = s + ahead;
    frameAt(Math.min(ROAD.len, sa), F);
    const aim = roadPoint(Math.min(ROAD.len, sa), this.lineAt(sa));
    const dx = aim.x - v.pos.x, dz = aim.z - v.pos.z;
    const c = Math.cos(v.yaw), sn = Math.sin(v.yaw);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;   // (car frame: x ahead, z right)
    const ang = Math.atan2(-lz, lx);                        // + = to the left
    I.steer = clamp(ang * 2.4 - v.yawRate * 0.25, -1, 1);
    const e = target - sp;
    I.throttle = e > 0.3 ? clamp(e / 4, 0.25, 1) : 0;
    I.brake = e < -2.5 ? clamp(-e / 8, 0, 1) : 0;
    this.gap = gap;
  }
}

// a scripted driver of a thing that crosses the road: a list of (s, d, t)
// points eased through (the truck pulling out, the oncoming car)
export class PathDriver {
  constructor(points, { speed = 8, kinematic = true } = {}) {
    this.points = points;        // [{ s, d, t }], t: seconds from the start
    this.kinematic = kinematic;
    this.t = 0;
    this.speed = speed;
    this.done = false;
  }
  drive(v, dt) {
    this.t += dt;
    const P = this.points;
    let i = 0;
    while (i < P.length - 2 && P[i + 1].t <= this.t) i++;
    const a = P[i], b = P[Math.min(P.length - 1, i + 1)];
    const u = b.t === a.t ? 1 : clamp((this.t - a.t) / (b.t - a.t), 0, 1);
    const k = u * u * (3 - 2 * u);
    const s = a.s + (b.s - a.s) * (a.lin ? u : k), d = a.d + (b.d - a.d) * (a.lin ? u : k);
    const p = roadPoint(s, d);
    const px = v.pos.x, pz = v.pos.z;
    v.pos.set(p.x, 0, p.z);
    const vx = (p.x - px) / Math.max(dt, 1e-4), vz = (p.z - pz) / Math.max(dt, 1e-4);
    if (dt > 0) v.vel.set(vx, 0, vz);
    if (Math.hypot(vx, vz) > 0.3) {
      const want = Math.atan2(-vz, vx);
      let dy = Math.atan2(Math.sin(want - v.yaw), Math.cos(want - v.yaw));
      v.yaw += dy * (1 - Math.exp(-dt * 6));
    }
    if (this.t > P[P.length - 1].t) this.done = true;
  }
}
