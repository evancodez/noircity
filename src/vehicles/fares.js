import * as THREE from 'three';
import { STARTS } from '../world/plan.js';
import { pay } from '../traffic/seams.js';

// The fares (lane O2): in a taxi, a man or a woman on the pavement ahead
// hails (the arm up, seen at 40 m); stop by them (within 7 m) and they get in
// (E, or just two seconds stood there); the objective line says where
// (O1's starts as the places: `The Hill.`); the meter runs by the distance;
// stop there and they pay ($). A passenger thrown about - a hard knock -
// says `Easy.`; a second (or a wreck) and he gets out, the fare lost (`He
// got out.`). Left sitting (sitting there 20 s) he says `Come on.`
// and after 20 s more he gets out. One fare at a time; the next hails a
// little after.
//   fares.state 'none' | 'hail' | 'in' ; fares.fare { dest, meter, knocks }
//   fares.stats { hailed, rode, paid, lost, idle, knocks, money }
// Events: 'wheels:fare' { what: 'hail' | 'in' | 'paid' | 'lost', n }
const DESTS = Object.entries(STARTS).filter(([id]) => id !== 'bridge').map(([id, s]) => ({ id, name: s.name.replace(/^the /, 'The '), x: s.car.x, z: s.car.z }));
const _v = new THREE.Vector3();

export class Fares {
  constructor(W) {
    this.W = W;
    this.G = W.game;
    this.state = 'none';
    this.fare = null;
    this.nextT = 2;
    this.n = 0;
    this.stats = { hailed: 0, rode: 0, paid: 0, lost: 0, idle: 0, knocks: 0, money: 0 };
    W.extras.push(this);
  }
  get taxi() { const R = this.G.city; return R && R.inCar && R.car && R.car.kind === 'taxi' ? R.car : null; }

  step(dt) {
    const G = this.G, taxi = this.taxi, hud = G.hud;
    this.walkers(dt);
    if (this.state === 'none') {
      if (!taxi) return;
      this.nextT -= dt;
      if (this.nextT <= 0) this.hail(taxi);
      return;
    }
    if (this.state === 'hail') {
      const F = this.fare, c = F.c;
      F.t += dt;
      // (a man on the pavement left behind, or the cab given up: he goes)
      const v = taxi;
      if (!v) { if (F.t > 4) this.dismiss('gone'); return; }
      const d = Math.hypot(v.pos.x - c.fig.pos.x, v.pos.z - c.fig.pos.z);
      if (d > 140 && F.t > 6) { this.dismiss('missed'); return; }
      c.fig.yaw = Math.atan2(v.pos.x - c.fig.pos.x, v.pos.z - c.fig.pos.z);
      const near = d < 9 && v.speedAbs < 1.0;
      F.stoodT = near ? F.stoodT + dt : 0;
      if (near && !F.prompted) { F.prompted = true; hud.prompt('E  take him', null, 'o2fare'); }
      if (!near && F.prompted) { F.prompted = false; hud.clearPrompt('o2fare'); }
      if (near && (G.pressed('KeyE') || F.stoodT > 2.0)) this.board(v);
      return;
    }
    if (this.state === 'boarding') {
      const F = this.fare, c = F.c, v = taxi;
      F.t += dt;
      if (!v) { this.lose('He got out.'); return; }
      // (to the back door, in)
      const door = v.world(-0.9, v.spec.halfW + 0.5, _v);
      const dx = door.x - c.fig.pos.x, dz = door.z - c.fig.pos.z, d = Math.hypot(dx, dz);
      c.fig.yaw = Math.atan2(dx, dz);
      if (d < 0.35 || F.t > 3.5) { this.seat(v); return; }
      return;
    }
    if (this.state === 'in') {
      const F = this.fare, v = taxi;
      F.t += dt;
      if (!v) { this.lose('He got out.'); return; }
      // the meter: by the distance
      F.dist += v.speedAbs * dt;
      const d = Math.hypot(v.pos.x - F.dest.x, v.pos.z - F.dest.z);
      // (on his way? the distance to go falling)
      // (sitting there with him in the back: the clock runs; on the move, it eases
      // off; stood at a light or behind a car in my lane is not sitting there)
      if (d < F.best) F.best = d;
      let held = false;
      if (v.speedAbs < 1.5) {
        const fx = Math.cos(v.yaw), fz = -Math.sin(v.yaw), way = { dx: fx, dz: fz };
        held = this.W.signals.nodes.some((n) => { const dx = n.x - v.pos.x, dz = n.z - v.pos.z, ax = dx * fx + dz * fz, lz = Math.abs(dx * fz - dz * fx); return ax > 0 && ax < 30 && lz < 12 && this.W.signals.state(n, way) !== 'go'; });
        if (!held) for (const o of this.W.bodies()) { if (o === v || !o.spec || o.parked || Math.abs(o.pos.x - v.pos.x) > 16 || Math.abs(o.pos.z - v.pos.z) > 16) continue; const l = v.local(o.pos, _v); if (l.x > 2 && l.x < 15 && Math.abs(l.z) < 2.6) { held = true; break; } }
      }
      F.idleT = v.speedAbs < 1.5 && !held ? F.idleT + dt : Math.max(0, F.idleT - dt * 2);
      if (F.idleT > 20 && !F.nagged) { F.nagged = true; hud.warn('Come on.'); F.warnT = 3; }
      if (F.idleT > 40) { this.stats.idle++; this.lose('He got out.'); return; }
      if (F.warnT > 0) { F.warnT -= dt; if (F.warnT <= 0) hud.warn(null); }
      if (F.idleT < 1 && F.nagged) F.nagged = false;
      if (d < 28 && v.speedAbs < 1.2) this.arrive(v);
    }
  }

  // a fare on the pavement ahead of the cab, on its side of the street
  hail(v) {
    const W = this.W, G = this.G, g = W.graph;
    this.nextT = 3;
    // (on the pavement on my right, 45 to 120 m on along my way: this street or the next)
    const C = G.stage.part('city').C, fx = Math.cos(v.yaw), fz = -Math.sin(v.yaw);
    let kx = null, kz = null, nx = 0, nz = 0;
    for (const ahead of [65, 80, 50, 95, 115]) {
      const L = g.nearestLane(v.pos.x + fx * ahead, v.pos.z + fz * ahead, v.yaw);
      if (!L || L.d > L.edge.hw) continue;
      const e = L.edge, dir = L.dir;
      if (L.s < e.hw + 6 || L.s > e.len - e.hw - 6) continue;
      nx = -e.dz * dir; nz = e.dx * dir;   // (the right of the way)
      const x = e.ax + e.dx * L.s + nx * (e.hw + 1.4), z = e.az + e.dz * L.s + nz * (e.hw + 1.4);
      if (C.groundAt(x, z) < 0.05 || C.inWater(x, z)) continue;   // (on a pavement)
      if (W.bodiesNear(x, z, 3).length) continue;
      kx = x; kz = z; break;
    }
    if (kx == null) return;
    // (where he goes: a place 300 m to 900 m off)
    const far = DESTS.filter((D) => { const dd = Math.hypot(D.x - kx, D.z - kz); return dd > 300 && dd < 900; });
    if (!far.length) return;
    const dest = far[Math.floor(Math.random() * far.length)];
    const her = Math.random() < 0.4;
    let c;
    try { c = W.stage.cast.spawn(her ? 'o2_fare_her' : 'o2_fare', { at: { x: kx, z: kz }, yaw: Math.atan2(-nx, -nz), name: 'o2fare' + (++this.n) }); } catch (err) { return; }
    c.play(her ? 'o2h_hail' : 'o2_hail');
    this.fare = { c, her, dest, t: 0, stoodT: 0, dist: 0, best: Infinity, idleT: 0, knocks: 0, at: { x: kx, z: kz } };
    this.state = 'hail';
    this.stats.hailed++;
    G.emit('wheels:fare', { what: 'hail', n: this.n });
  }
  board(v) {
    const F = this.fare, c = F.c;
    this.G.hud.clearPrompt('o2fare'); F.prompted = false;
    this.state = 'boarding'; F.t = 0;
    c.clipH = null; c.setState('walk', 0.2); c.fig.speed = 1.4;
    void v;
  }
  seat(v) {
    const F = this.fare, G = this.G;
    try { this.W.stage.cast.remove(F.c); } catch (e) { /* gone */ }
    F.c = null;
    G.sfx.play('tail_door', v.pos.clone().setY(1), { open: false });
    this.state = 'in'; F.t = 0; F.dist = 0; F.best = Math.hypot(v.pos.x - F.dest.x, v.pos.z - F.dest.z);
    G.hud.objective(F.dest.name + '.');
    G.sfx.play('o2_meter', null, {});
    this.stats.rode++;
    // (a knock hard enough to throw him about: Easy., then he is out)
    F.onCrash = (e) => { if (this.state !== 'in' || !e || (e.k || 0) < 0.3) return; F.knocks++; this.stats.knocks++; if (F.knocks === 1) { G.hud.warn('Easy.'); F.warnT = 2.5; } else this.lose('He got out.'); };
    v.on('crash', F.onCrash);
    F.car = v;
    G.emit('wheels:fare', { what: 'in', n: this.n });
  }
  arrive(v) {
    const F = this.fare, G = this.G;
    const n = Math.max(6, Math.round(4 + F.dist / 70));
    pay(G, n, 'the fare');
    this.stats.paid++; this.stats.money += n;
    G.hud.objective(null);
    this.out(v);
    G.emit('wheels:fare', { what: 'paid', n });
    this.state = 'none'; this.fare = null; this.nextT = 4;
  }
  lose(why) {
    const F = this.fare, G = this.G;
    if (!F) return;
    this.stats.lost++;
    G.hud.objective(null);
    G.hud.warn(null);
    G.hud.message(why, 2.2);
    if (F.c) { try { this.W.stage.cast.remove(F.c); } catch (e) { /* gone */ } F.c = null; }
    else if (F.car) this.out(F.car);
    G.emit('wheels:fare', { what: 'lost', why });
    this.state = 'none'; this.fare = null; this.nextT = 8;
  }
  // out of the back door onto the pavement, and away
  out(v) {
    const F = this.fare;
    if (F && F.car && F.onCrash) F.car.off('crash', F.onCrash);
    const p = v.world(-0.9, v.spec.halfW + 0.8, new THREE.Vector3());
    let c;
    try { c = this.W.stage.cast.spawn(F && F.her ? 'o2_fare_her' : 'o2_fare', { at: { x: p.x, z: p.z }, yaw: v.yaw, name: 'o2fareout' + this.n }); } catch (e) { return; }
    this.G.sfx.play('tail_door', p.clone().setY(1), { open: true });
    c.clipH = null; c.setState('walk', 0.2); c.fig.speed = 1.3;
    // (away across the pavement from the kerb: the car's right)
    c.fig.yaw = Math.atan2(Math.sin(v.yaw), Math.cos(v.yaw));
    (this.leaving || (this.leaving = [])).push({ c, t: 0 });
  }
  // the ones who got out walk off and are gone in a while
  walkers(dt) {
    if (!this.leaving) return;
    for (const L of [...this.leaving]) {
      L.t += dt;
      const S = this.W.stage.colliders; if (S) S.resolve(L.c.fig.pos, 0.3);
      if (L.t > 7) { try { this.W.stage.cast.remove(L.c); } catch (e) { /* gone */ } this.leaving.splice(this.leaving.indexOf(L), 1); }
    }
  }
  dismiss(why) {
    const F = this.fare;
    if (F && F.c) { try { this.W.stage.cast.remove(F.c); } catch (e) { /* gone */ } }
    if (F && F.prompted) this.G.hud.clearPrompt('o2fare');
    this.state = 'none'; this.fare = null; this.nextT = 5;
    void why;
  }
  detach() { if (this.fare) this.dismiss('reset'); this.G.hud.objective(null); }
}
