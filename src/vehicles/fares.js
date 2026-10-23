import * as THREE from 'three';
import { STARTS } from '../world/plan.js';
import { pay } from '../traffic/seams.js';
import { lantern } from './marks.js';

// The fares (lane O2): in a taxi, a man or a woman on the pavement ahead
// hails (the arm up, seen at 40 m); stop by them (within 9 m) and they get in
// (E, or just two seconds stood there); the line says where (O1's starts as
// the places: `The Hill.`) and [O2] after the critic (B1: the place named, the
// pay at one unmarked point, a lost driver never losing) the drop-off is
// marked - a lantern lit at its kerb (the city's lamp deal: a pool of light on
// the pavement), the ring on the minimap and the map (O7's game.things, at:
// the kerb) - the fare says `Here.` as the cab comes within 60 m and pays when
// it stops within 30 m of the lantern (the meter by the distance driven).
// The other way: driven away from it for 15 s, `Wrong way.`; his patience is
// the road's length at a cab's pace and half a minute more (`Come on.` at
// three quarters of it, out at the end: `He got out.`), and sat still - not at
// a red, not behind a car - 20 s is `Come on.` and 40 s out (it never runs
// back down: a lost fare ends). A passenger thrown about - a hard knock -
// says `Easy.`; a second (or a wreck) and he gets out (`He got out.`). A car
// that hits him on the pavement knocks him down (O3's people: he is the
// street's man while he waits) and the fare is gone. One at a time; the next
// hails a little after.
//   fares.state 'none' | 'hail' | 'boarding' | 'in' ; fares.fare { dest, dist, knocks, mark }
//   fares.stats { hailed, rode, paid, lost, idle, knocks, money, wrong, late, hurt }
// Events: 'wheels:fare' { what: 'hail' | 'in' | 'paid' | 'lost', n }
export const FARE = { here: 60, pay: 30, wrongAfter: 15, pace: 6.5, spare: 30, nag: 20, quit: 40 };
const DESTS = Object.entries(STARTS).filter(([id]) => id !== 'bridge').map(([id, s]) => ({ id, name: s.name.replace(/^the /, 'The '), x: s.car.x, z: s.car.z, yaw: s.car.yaw ?? 0 }));
const _v = new THREE.Vector3();

export class Fares {
  constructor(W) {
    this.W = W;
    this.G = W.game;
    this.state = 'none';
    this.fare = null;
    this.nextT = 2;
    this.n = 0;
    this.stats = { hailed: 0, rode: 0, paid: 0, lost: 0, idle: 0, knocks: 0, money: 0, wrong: 0, late: 0, hurt: 0 };
    W.extras.push(this);
  }
  get taxi() { const R = this.G.city; return R && R.inCar && R.car && R.car.kind === 'taxi' ? R.car : null; }

  // the man (O3's Person when the people are in: a car hits him, the crowd sees him)
  man(her, x, z, yaw, name) {
    const G = this.G, P = G.people, kind = her ? 'o2_fare_her' : 'o2_fare';
    if (P && P.spawn) {
      const p = P.spawn(kind, x, z, yaw, 'o2');
      p.mode = 'fight'; p.path = null; p.then = null; p.fig.speed = 0; p.gaitNow = null;
      return { c: p.c, p };
    }
    return { c: this.W.stage.cast.spawn(kind, { at: { x, z }, yaw, name }), p: null };
  }
  letGo(F) {
    if (!F || !F.c) return;
    if (F.p) { try { this.G.people.release(F.p); } catch (e) { /* gone */ } }
    else { try { this.W.stage.cast.remove(F.c); } catch (e) { /* gone */ } }
    F.c = null; F.p = null;
  }

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
      // (knocked down on the pavement by a car: O3 has him now - the fare is gone)
      if (F.p && !F.p.standing) { this.hurt(F); return; }
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
      if (F.p && !F.p.standing) { this.hurt(F); return; }
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
      // (nearly there: he says so - the lantern is his kerb)
      if (d < FARE.here && !F.here) { F.here = true; hud.say ? hud.say('Here.', 1.8, { always: true }) : hud.message('Here.', 1.8); }
      // (the wrong way: further from it than the best for 15 s of driving)
      if (d < F.best - 1) { F.best = d; F.awayT = 0; }
      else if (v.speedAbs > 2 && d > F.best + 25) F.awayT += dt;
      if (F.awayT > FARE.wrongAfter && G.time - (F.wrongAt ?? -99) > 20 && !G.hud.kit.warnText) { F.wrongAt = G.time; F.awayT = 0; F.best = d; this.stats.wrong++; hud.warn('Wrong way.'); F.warnT = 2.5; }
      // (sitting there with him in the back: the clock runs - not at a red, not behind a car in my lane)
      let held = false;
      if (v.speedAbs < 1.5) {
        // (the light of the street I am on - not the way the cab points, angled in a turn)
        const fx = Math.cos(v.yaw), fz = -Math.sin(v.yaw), St = this.W.graph.streetAt(v.pos.x, v.pos.z), way = St ? St.edge : { dx: fx, dz: fz };
        held = this.W.signals.nodes.some((n) => { const dx = n.x - v.pos.x, dz = n.z - v.pos.z, ax = dx * fx + dz * fz, lz = Math.abs(dx * fz - dz * fx); return ax > 0 && ax < 30 && lz < 12 && this.W.signals.state(n, way) !== 'go'; });
        if (!held) for (const o of this.W.bodies()) { if (o === v || !o.spec || o.parked || Math.abs(o.pos.x - v.pos.x) > 16 || Math.abs(o.pos.z - v.pos.z) > 16) continue; const l = v.local(o.pos, _v); if (l.x > 2 && l.x < 15 && Math.abs(l.z) < 2.6) { held = true; break; } }
      }
      // ([O2] after the critic: it never runs back down - sat still is sat still)
      if (v.speedAbs < 1.5 && !held && d > FARE.pay) F.idleT += dt;
      if (F.idleT > FARE.nag && !F.nagged) { F.nagged = true; hud.warn('Come on.'); F.warnT = 3; }
      if (F.idleT > FARE.quit) { this.stats.idle++; this.lose('He got out.'); return; }
      // his patience: the road's length at a cab's pace, and half a minute
      if (F.t > F.patience * 0.75 && !F.late) { F.late = true; hud.warn('Come on.'); F.warnT = 3; }
      if (F.t > F.patience) { this.stats.late++; this.lose('He got out.'); return; }
      if (F.warnT > 0) { F.warnT -= dt; if (F.warnT <= 0) hud.warn(null); }
      if (d < FARE.pay && v.speedAbs < 1.2) this.arrive(v);
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
    let M;
    try { M = this.man(her, kx, kz, Math.atan2(-nx, -nz), 'o2fare' + (++this.n)); } catch (err) { return; }
    M.c.play(her ? 'o2h_hail' : 'o2_hail');
    this.fare = { c: M.c, p: M.p, her, dest, t: 0, stoodT: 0, dist: 0, best: Infinity, idleT: 0, awayT: 0, knocks: 0, at: { x: kx, z: kz } };
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
    this.letGo(F);
    G.sfx.play('tail_door', v.pos.clone().setY(1), { open: false });
    this.state = 'in'; F.t = 0; F.dist = 0; F.best = Math.hypot(v.pos.x - F.dest.x, v.pos.z - F.dest.z);
    // (his patience: the way by the roads at a cab's pace, and half a minute)
    const way = this.W.pathFor ? this.W.pathFor({ x: v.pos.x, z: v.pos.z }, { x: F.dest.x, z: F.dest.z }, { yaw: v.yaw }) : null;
    F.road = way ? way.len : F.best * 1.4;
    F.patience = FARE.spare + F.road / FARE.pace;
    // the drop-off: the lantern at its kerb, the ring on the minimap and the map
    try { F.mark = lantern(this.W.stage, F.dest.x + Math.sin(F.dest.yaw) * 2.2, F.dest.z + Math.cos(F.dest.yaw) * 2.2, { yaw: F.dest.yaw }); } catch (e) { F.mark = null; }
    const line = F.dest.name + '.';
    if (G.things) G.things.start('fare', { line, at: { x: F.dest.x, z: F.dest.z } });
    else G.hud.objective(line);
    G.sfx.play('o2_meter', null, {});
    this.stats.rode++;
    // (a knock hard enough to throw him about: Easy., then he is out)
    F.onCrash = (e) => { if (this.state !== 'in' || !e || (e.k || 0) < 0.3) return; F.knocks++; this.stats.knocks++; if (F.knocks === 1) { G.hud.warn('Easy.'); F.warnT = 2.5; } else this.lose('He got out.'); };
    v.on('crash', F.onCrash);
    F.car = v;
    G.emit('wheels:fare', { what: 'in', n: this.n, dest: F.dest.id, patience: +F.patience.toFixed(1) });
  }
  // the line and the mark gone (O7's things), the lantern out
  unmark(F, result, money = 0) {
    const G = this.G;
    if (F && F.mark) { F.mark.dispose(); F.mark = null; }
    if (G.things && G.things.active && G.things.active.has('fare')) G.things.end('fare', { result, money });
    else { G.hud.objective(null); if (money > 0) pay(G, money, 'the fare'); }
  }
  arrive(v) {
    const F = this.fare, G = this.G;
    const n = Math.max(6, Math.round(4 + F.dist / 70));
    this.unmark(F, 'paid', n);
    this.stats.paid++; this.stats.money += n;
    G.hud.warn(null);
    this.out(v);
    G.emit('wheels:fare', { what: 'paid', n });
    this.state = 'none'; this.fare = null; this.nextT = 4;
  }
  lose(why) {
    const F = this.fare, G = this.G;
    if (!F) return;
    this.stats.lost++;
    this.unmark(F, 'lost');
    G.hud.warn(null);
    G.hud.message(why, 2.2);
    if (F.c) this.letGo(F);
    else if (F.car) this.out(F.car);
    G.emit('wheels:fare', { what: 'lost', why });
    this.state = 'none'; this.fare = null; this.nextT = 8;
  }
  // knocked down on the pavement while he waited: he is the street's (O3: hurt, the crime, the crowd)
  hurt(F) {
    const G = this.G;
    this.stats.hurt++;
    if (F.prompted) G.hud.clearPrompt('o2fare');
    if (F.p) { F.p.role = 'walker'; F.c = null; F.p = null; }
    G.emit('wheels:fare', { what: 'lost', why: 'hurt' });
    this.state = 'none'; this.fare = null; this.nextT = 10;
  }
  // out of the back door onto the pavement, and away
  out(v) {
    const F = this.fare;
    if (F && F.car && F.onCrash) F.car.off('crash', F.onCrash);
    const p = v.world(-0.9, v.spec.halfW + 0.8, new THREE.Vector3());
    let M;
    try { M = this.man(F && F.her, p.x, p.z, v.yaw, 'o2fareout' + this.n); } catch (e) { return; }
    this.G.sfx.play('tail_door', p.clone().setY(1), { open: true });
    if (M.p) {
      // (the street's again: he walks off the kerb and on, as O3's walkers do)
      M.p.role = 'walker'; M.p.mode = 'flee'; M.p.flee(v.pos, 3, { cry: false });
      return;
    }
    const c = M.c;
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
    if (F) this.letGo(F);
    if (F && F.prompted) this.G.hud.clearPrompt('o2fare');
    this.state = 'none'; this.fare = null; this.nextT = 5;
    void why;
  }
  detach() {
    const F = this.fare;
    if (F && F.mark) { F.mark.dispose(); F.mark = null; }
    if (this.state === 'in' && this.G.things && this.G.things.active && this.G.things.active.has('fare')) this.G.things.end('fare', { result: 'lost' });
    if (F) this.dismiss('reset');
    this.G.hud.objective(null);
  }
}
