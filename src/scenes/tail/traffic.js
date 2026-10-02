import * as THREE from 'three';
import { GRAPH, EW, NS } from '../../stages/city/plan.js';
import { buildPath } from '../../stages/city/route.js';
import { Pilot } from '../../vehicles/pilot.js';
import { Tram } from './tram.js';

// The city's traffic in the tail (lane C3): a few cars with their own
// headlamps going about the streets near me (they keep their lane, stop at
// a junction for a car coming across it, brake for me and sound the horn,
// pull over for my horn, and are solid: Car.js), and the tram along Market
// St that he runs ahead of at Water St. They come on out of my sight (round
// a corner, far down a street) and go when they are out of it, never
// popping in the frame; never more than MAX at once (each is a sedan's
// draws). A retry is not the same film: the routes are drawn from the try's
// own seed.
//   new Traffic(chase); traffic.step(dt); traffic.horn() (my Q);
//   traffic.cars [{ v, pilot, ... }]; traffic.tram
const MAX = 4;
const SPAWN_MIN = 70, SPAWN_MAX = 170, GONE = 210;
const _v = new THREE.Vector3();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Traffic {
  constructor(chase, { seed = 1 } = {}) {
    this.chase = chase;
    this.game = chase.game;
    this.cars = [];
    this.t = 0;
    this.nextT = 1.5;
    this.rng = chase.ctx.rng.fork(7100 + seed);
    this.tram = new Tram(chase);
    this.n = 0;
  }

  dispose() {
    for (const c of this.cars) this.chase.V.remove(c.v);
    this.cars = [];
    this.tram.dispose();
  }

  // a street the traffic may use (not the alleys, the square, Pell Lane)
  ok(e) { return !e.alley && !e.square && e.street !== 'pell' && !(e.street === 'river' && this.chase.phase === 'a' && false); }

  // a random walk through the junctions from node a (first step toward b)
  walk(a, b, n = 6) {
    const ids = [a, b];
    let prev = a, cur = b;
    for (let k = 0; k < n; k++) {
      const N = GRAPH.nodes.get(cur);
      const opts = N.edges.filter((e) => this.ok(e)).map((e) => (e.a === cur ? e.b : e.a)).filter((x) => x !== prev);
      if (!opts.length) break;
      const nx = opts[Math.floor(this.rng.next() * opts.length)];
      ids.push(nx); prev = cur; cur = nx;
    }
    return ids;
  }

  spawnOne() {
    const C = this.chase, my = C.my, T = C.stage.track;
    const e = this.game.camera.position;
    // a junction out of my sight (or far), not where his car is
    const cands = [];
    for (const N of GRAPH.nodes.values()) {
      if (N.id.startsWith('pell') || N.id.startsWith('alley') || N.id === 'pier') continue;
      const d = Math.hypot(N.x - my.pos.x, N.z - my.pos.z);
      if (d < SPAWN_MIN || d > SPAWN_MAX) continue;
      if (C.his && Math.hypot(N.x - C.his.pos.x, N.z - C.his.pos.z) < 25) continue;
      const hidden = T.blocked(e.x, e.z, N.x, N.z, ['wall', 'fence']) || d > 120;
      if (!hidden) continue;
      cands.push(N);
    }
    if (!cands.length) return null;
    const N = cands[Math.floor(this.rng.next() * cands.length)];
    const nb = N.edges.filter((x) => this.ok(x)).map((x) => (x.a === N.id ? x.b : x.a));
    if (!nb.length) return null;
    // (heading my way rather than away: a car the chase will meet)
    nb.sort((a, b) => { const A = GRAPH.nodes.get(a), B = GRAPH.nodes.get(b); return Math.hypot(A.x - my.pos.x, A.z - my.pos.z) - Math.hypot(B.x - my.pos.x, B.z - my.pos.z); });
    const first = this.rng.next() < 0.7 ? nb[0] : nb[Math.floor(this.rng.next() * nb.length)];
    let path;
    try { path = buildPath(this.walk(N.id, first, 5), { vmax: 11, aLat: 4.5, aBrake: 4 }); } catch (err) { return null; }
    const p0 = path.at(2, {});
    // (nothing there already)
    for (const o of C.bodies()) if (Math.hypot(o.pos.x - p0.x, o.pos.z - p0.z) < 8) return null;
    const v = C.V.spawn('sedan', { at: new THREE.Vector3(p0.x, 0, p0.z), yaw: Math.atan2(-p0.fz, p0.fx), speed: 6, lights: true, paint: this.rng.next() < 0.5 ? 'paintGrey' : 'paint' });
    v.car.limit = 1e9;
    const pilot = new Pilot(path, { pace: 0.75 + this.rng.next() * 0.2, vmax: 11, keep: 6, bodies: () => C.bodies() });
    v.driver = pilot;
    const car = { v, pilot, path, id: ++this.n, hornT: 0, aside: 0, t: 0 };
    // the junctions on its way: it stops before one while a car comes across
    car.stops = path.ids.slice(1).map((id) => ({ id, s: path.nodeS[id] })).filter((x) => x.s != null && x.s > 6);
    v.on('bump', (ev) => { if (ev.by === C.my && ev.imp > 2) this.honk(car, 1); });
    this.cars.push(car);
    return car;
  }

  honk(car, k = 0.8) {
    if (car.hornT > 0) return;
    car.hornT = 2.5;
    this.game.sfx.play('tail_horn', car.v.pos, { k, dur: 0.35 + this.rng.next() * 0.4, low: this.rng.next() < 0.5 ? 1 : 0 }, { ref: 7 });
  }

  // my horn: a car ahead of me in my way pulls over toward its kerb and
  // slows; one ahead at a junction holds; a horn back now and then
  horn() {
    const C = this.chase, my = C.my;
    const c = Math.cos(my.yaw), sn = Math.sin(my.yaw);
    for (const car of this.cars) {
      const v = car.v;
      const ox = v.pos.x - my.pos.x, oz = v.pos.z - my.pos.z;
      const ax = ox * c - oz * sn, az = ox * sn + oz * c;
      if (ax < 2 || ax > 35 || Math.abs(az) > 3.5) continue;
      car.aside = 3.5;
      if (this.rng.next() < 0.5) this.honk(car, 0.6);
    }
  }

  step(dt) {
    const C = this.chase, my = C.my;
    this.t += dt;
    this.tram.step(dt);
    if (C.phase === 'start' || C.phase === 'parked' || !my) return;
    // the population: a few near me
    this.nextT -= dt;
    if (this.nextT <= 0) {
      this.nextT = 1.2 + this.rng.next() * 1.5;
      if (this.cars.length < MAX) this.spawnOne();
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i], v = car.v, P = car.pilot;
      car.t += dt;
      car.hornT = Math.max(0, car.hornT - dt);
      // at a junction ahead: a car coming across it (mine, his, the others)
      // and it holds before it
      let hold = null;
      for (const st of car.stops) {
        if (st.s < P.s - 2 || st.s > P.s + 22) continue;
        const N = GRAPH.nodes.get(st.id);
        const mine = Math.hypot(N.x - v.pos.x, N.z - v.pos.z);
        for (const o of [C.my, C.his, ...this.cars.map((x) => x.v)]) {
          if (!o || o === v) continue;
          const dx = N.x - o.pos.x, dz = N.z - o.pos.z, d = Math.hypot(dx, dz);
          if (d > 32 || d < 1) continue;
          // (between two of the traffic, the one nearer the crossing goes
          // first: never two waiting on each other)
          if (o !== C.my && o !== C.his && d > mine) continue;
          const toward = (o.vel.x * dx + o.vel.z * dz) / d;
          // (coming to it across my way, not along it behind me)
          const pf = car.path.at(st.s, {}); const along = Math.abs((o.vel.x * pf.fx + o.vel.z * pf.fz)) / Math.max(1, Math.hypot(o.vel.x, o.vel.z));
          if (toward > 2 && along < 0.7) { hold = st; break; }
        }
        if (hold) break;
      }
      // (and never for long: a car that has waited goes)
      car.holdT = hold ? (car.holdT || 0) + dt : 0;
      if (car.holdT > 5) hold = null;
      P.o.stopAt = hold ? hold.s - 9 : null;
      // aside for my horn: toward the kerb, slow
      if (car.aside > 0) { car.aside -= dt; P.o.pace = 0.35; P.o.wander = 0; P.offset = 1.6; } else { P.offset = 0; P.o.pace = P.o.pace0 || (P.o.pace0 = P.o.pace); }
      // my car in its way close: it brakes (its pilot follows me) and honks
      const ox = my.pos.x - v.pos.x, oz = my.pos.z - v.pos.z;
      const c = Math.cos(v.yaw), sn = Math.sin(v.yaw);
      const ax = ox * c - oz * sn, az = ox * sn + oz * c;
      if (ax > 0 && ax < 9 && Math.abs(az) < 2.2 && (my.speedAbs > 2 || v.speedAbs > 3)) this.honk(car, 0.9);
      // gone: far from me, out of sight, or at its walk's end
      const d = Math.hypot(v.pos.x - my.pos.x, v.pos.z - my.pos.z);
      const e = this.game.camera.position;
      const hidden = C.stage.track.blocked(e.x, e.z, v.pos.x, v.pos.z, ['wall', 'fence']);
      if ((d > GONE) || (P.done && (hidden || d > 90)) || (d > 120 && hidden)) {
        C.V.remove(v);
        this.cars.splice(i, 1);
      }
    }
    // the engines' loops for the nearest two
    const S = this.game.sfx;
    if (S && S.live) {
      const near = [...this.cars].sort((a, b) => a.v.pos.distanceToSquared(my.pos) - b.v.pos.distanceToSquared(my.pos));
      for (let k = 0; k < 2; k++) {
        const car = near[k], key = 'c3_traffic' + k;
        if (car && car.v.pos.distanceTo(my.pos) < 60) S.loop(key, car.v.pos, 0.18 + 0.12 * Math.min(1, car.v.speedAbs / 12), 'brown', 180 + car.v.speedAbs * 8, 0, true);
        else if (S.loops.has(key)) S.stopLoop(key);
      }
    }
    void EW; void NS; void _v; void clamp;
  }
}
