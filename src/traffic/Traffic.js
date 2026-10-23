import * as THREE from 'three';
import { Pilot } from '../vehicles/pilot.js';
import { Headlamps } from '../vehicles/Vehicle.js';
import { lampsLit, fleetLod, KINDS, policeGlow, lookAt } from '../vehicles/kinds.js';
import { lanePath, walk } from './path.js';
import { RNG } from '../util/rng.js';

// The city's moving traffic (lane O2): cars on O1's road graph, the same
// physics as mine (Car.js) driven by the base's Pilot (the same inputs a
// player gives). They keep their lane, stop at the signals (and run a late
// amber), give way at a junction to a car already in it, brake for the car
// ahead and go round a slow one when the road beside is free (the Pilot),
// stop for a man standing in the road (a horn, then a slow way round),
// sound the horn when I cut them or knock them, pull over for my horn, and
// panic at a shot or a man down (traffic.alarm). They come on out of my
// sight and go when out of it: never a pop in the frame. Never more than
// MAX alive; the lit headlamps' cones and pools (each a few draws) go to the
// four nearest ahead of the eye, the rest show their lit lenses.
//   traffic.cars [{ v, pilot, path, kind, driver: { kind: 'civilian' | 'fighter' | 'gangster' | 'cop', men }, state }]
//   traffic.step(dt, eye)  traffic.alarm(point, k)  traffic.horn(fromCar)
//   traffic.release(car) -> v   (the hijack: the car out of the traffic, its driver out)
//   traffic.stats { spawned, dropped, inView, maxNear, stuck }
const MAX = 14;
const SPAWN_MIN = 105, SPAWN_MAX = 200, DROP = 235, DROP_ALWAYS = 300;
const POOL = 4;
const _v = new THREE.Vector3();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// the kinds of the traffic by district (the hearse on the Hill, lorries in the Yards)
const MIX = {
  downtown: [['coupe', 2], ['saloon', 3], ['taxi', 4], ['van', 1.5], ['police', 0.5], ['lorry', 0.4]],
  tenements: [['saloon', 3.5], ['taxi', 1.5], ['van', 2], ['coupe', 1.5], ['police', 0.4]],
  docks: [['saloon', 3], ['lorry', 2.5], ['van', 2.5], ['coupe', 1]],
  yards: [['lorry', 3.5], ['van', 2.5], ['saloon', 1.5], ['coupe', 1.5]],
  hill: [['coupe', 3], ['saloon', 3], ['hearse', 1], ['taxi', 1]],
};

export class Traffic {
  constructor(W) {
    this.W = W;
    this.game = W.game;
    this.stage = W.stage;
    this.graph = W.graph;
    this.cars = [];
    this.rng = new RNG(8803);
    this.t = 0; this.spawnT = 0.2; this.lodT = 0;
    this.stats = { spawned: 0, dropped: 0, inView: 0, maxNear: 0, maxWait: 0, popIn: 0 };
    this.max = MAX;
    this.on = true;
    // the headlamps' cones and pools: four, dealt to the nearest
    this.lampPool = [];
    for (let i = 0; i < POOL; i++) { const h = new Headlamps(this.stage, { kind: 'pool' + i }, KINDS.saloon.lamps, { reach: 22, intensity: 110, cone: 0.17 }); h.setOn(false); h.owner = null; this.lampPool.push(h); }
    this.edges = this.graph.edges.filter((e) => !e.bridge);
  }

  // ---- coming on, going -----------------------------------------------------------------------
  pickKind(x, z) {
    const cell = this.W.C.cellAt(x, z), d = (cell && cell.district) || 'downtown';
    const mix = MIX[d] || MIX.downtown;
    let tot = 0; for (const [, w] of mix) tot += w;
    let u = this.rng.next() * tot;
    for (const [k, w] of mix) { if (u < w) return [k, d]; u -= w; }
    return [mix[0][0], d];
  }
  // in my view: ahead within the lens (and a margin), near, nothing between
  inView(x, z) {
    const cam = this.game.camera, e = cam.position, f = cam.getWorldDirection(_v);
    const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
    if (d > 165) return false;
    const fl = Math.hypot(f.x, f.z) || 1;
    const half = Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (cam.aspect || 1.6)) + 0.15;
    if ((dx * f.x + dz * f.z) / (fl * Math.max(d, 0.1)) < Math.cos(half) && d > 6) return false;
    return this.graph.lineOfSight(e.x, e.z, x, z);
  }
  hidden(eye, x, z, d) {
    if (d > 165) return true;
    return !this.graph.lineOfSight(eye.x, eye.z, x, z);
  }
  spawnOne(eye) {
    const G = this.graph, rng = this.rng;
    for (let tries = 0; tries < 8; tries++) {
      const e = this.edges[Math.floor(rng.next() * this.edges.length)];
      if (e.len < 30) continue;
      const s = e.hw + 8 + rng.next() * Math.max(1, e.len - 2 * (e.hw + 8));
      // (three in four come toward where I am: the street I am in gets its traffic)
      const tx = eye.x - (e.ax + e.dx * s), tz = eye.z - (e.az + e.dz * s);
      const toward = tx * e.dx + tz * e.dz >= 0 ? 1 : -1;
      const dir = rng.next() < 0.75 ? toward : -toward;
      const off = e.lanes[0];
      const x = e.ax + e.dx * s - e.dz * off * dir, z = e.az + e.dz * s + e.dx * off * dir;
      const d = Math.hypot(x - eye.x, z - eye.z);
      if (d < SPAWN_MIN || d > SPAWN_MAX) continue;
      if (!this.hidden(eye, x, z, d)) continue;
      if (this.avoid && this.avoid({ x, z })) continue;   // (the race's loop while it runs)
      // (nothing there)
      if (this.W.bodiesNear(x, z, 9).length) continue;
      const from = dir > 0 ? e.a : e.b, to = dir > 0 ? e.b : e.a;
      const ids = walk(G, to, from, 7, rng, undefined, { x: eye.x, z: eye.z });
      const [kind, district] = this.pickKind(x, z);
      return this.add(kind, district, ids, { x, z }, d);
    }
    return null;
  }
  add(kind, district, ids, at, d = 999) {
    const rng = this.rng;
    let path;
    try { path = lanePath(this.graph, ids, { pace: 0.85 + rng.next() * 0.15 }); } catch (err) { return null; }
    const i = path.nearestAll(at.x, at.z), p = path.at(path.pts[i].s, {});
    // (its look: by where it came on and the count - kinds.js lookAt)
    const look = lookAt(kind, Math.round(at.x), Math.round(at.z), this.stats.spawned);
    const v = this.W.V.spawn(kind, { at: new THREE.Vector3(p.x, 0, p.z), yaw: Math.atan2(-p.fz, p.fx), speed: Math.min(6, p.v), lights: false, fleet: true, look });
    v.traffic = true;
    lampsLit(v.model, this.stage, true);
    if (v.model.meshes.bust) v.model.meshes.bust.visible = true;
    const pilot = new Pilot(path, { pace: 1, vmax: KINDS[kind].spec.vmax * 0.8, keep: 6, overtake: true, bodies: () => this.W.bodiesFor(v) });
    pilot.i = i; pilot.s = path.pts[i].s;
    v.driver = pilot;
    // who drives it: most are men going home; some have a jaw; the gangs'
    // saloons carry two who shoot; the police car's a cop
    const r = rng.next();
    const gang = kind === 'saloon' && (district === 'docks' || district === 'tenements') && r < 0.45;
    const driver = { kind: kind === 'police' ? 'cop' : gang ? 'gangster' : r < 0.72 ? 'civilian' : 'fighter', men: gang ? 2 : 1, wallet: rng.next() < 0.35 ? 5 + Math.floor(rng.next() * 30) : 0 };
    const car = { v, pilot, path, ids, kind, district, driver, state: 'drive', t: 0, hornT: 0, waitT: 0, stuckT: 0, offT: 0, d0: d, seenAt: null, id: ++this.stats.spawned };
    v.on('bump', (ev) => { if (ev.by && ev.by === this.W.V.player && ev.imp > 1.5) this.honk(car, 1); });
    v.on('crash', (ev) => this.W.knock && this.W.knock(v, ev, true));
    v.on('scrape', (ev) => this.W.knock && this.W.knock(v, ev, false));
    if (this.game.rays && v.model.meshes.body) this.game.rays.add(v.model.meshes.body);
    if (kind === 'police') policeGlow(v.model);
    this.cars.push(car);
    if (this.inView(v.pos.x, v.pos.z)) this.stats.popIn++;
    return car;
  }
  drop(car) {
    if (this.inView(car.v.pos.x, car.v.pos.z)) this.stats.popOut = (this.stats.popOut || 0) + 1;
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.unlamp(car.v);
    if (this.game.rays && car.v.model.meshes.body) this.game.rays.remove(car.v.model.meshes.body);
    this.W.V.remove(car.v);
    this.stats.dropped++;
  }
  // the hijack takes a car out of the traffic: what it was stays (the car), its driver goes to the hijack
  release(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.unlamp(car.v);
    car.v.traffic = false;
    car.v.driver = null;
    car.v.input.throttle = 0; car.v.input.brake = 1; car.v.input.hold = 1;
    return car.v;
  }
  // a car given back to the traffic (the fight lost: he drives off in it)
  adopt(v, driver) {
    const L = this.graph.nearestLane(v.pos.x, v.pos.z, v.yaw);
    if (!L) return null;
    const to = L.dir > 0 ? L.edge.b : L.edge.a, from = L.dir > 0 ? L.edge.a : L.edge.b;
    const ids = walk(this.graph, to, from, 7, this.rng);
    let path;
    try { path = lanePath(this.graph, ids, {}); } catch (e) { return null; }
    const pilot = new Pilot(path, { pace: 1, vmax: KINDS[v.kind].spec.vmax * 0.8, keep: 6, overtake: true, bodies: () => this.W.bodiesFor(v) });
    pilot.locate(v);
    v.driver = pilot; v.traffic = true; v.parked = false; v.input.hold = 0;
    if (v.model.meshes.bust) v.model.meshes.bust.visible = true;
    const car = { v, pilot, path, ids, kind: v.kind, district: 'downtown', driver, state: 'drive', t: 0, hornT: 0, waitT: 0, stuckT: 0, id: ++this.stats.spawned };
    this.cars.push(car);
    return car;
  }
  unlamp(v) { for (const h of this.lampPool) if (h.owner === v) { h.owner = null; h.setOn(false); if (v.lamps === h) v.lamps = null; } }

  // ---- each step ---------------------------------------------------------------------------------
  step(dt, eye) {
    this.t += dt;
    if (!this.on) return;
    // coming on and going
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.35;
      if (this.cars.length < this.max) this.spawnOne(eye);
      for (const car of [...this.cars]) {
        const d = Math.hypot(car.v.pos.x - eye.x, car.v.pos.z - eye.z);
        if (d > DROP_ALWAYS || (d > DROP && this.hidden(eye, car.v.pos.x, car.v.pos.z, d))) this.drop(car);
      }
    }
    // the lamps' cones to the four nearest ahead, the far build for the far ones
    this.lodT -= dt;
    if (this.lodT <= 0) { this.lodT = 0.25; this.deal(eye); }
    let near = 0;
    for (const car of [...this.cars]) {
      const v = car.v;
      car.t += dt;
      this.rules(car, dt);
      v.step(dt);
      if (this.game.rays && v.model.meshes.body) this.game.rays.refresh(v.model.meshes.body);
      const d = Math.hypot(v.pos.x - eye.x, v.pos.z - eye.z);
      if (d < 120) near++;
      // (a stall: one that has not moved for long, out of my sight, goes)
      if (Math.abs(v.speed) < 0.3) car.stuckT += dt; else car.stuckT = 0;
      if (car.stuckT > 25 && d > 60 && this.hidden(eye, v.pos.x, v.pos.z, d)) this.drop(car);
      // (the route on: a new way from its end before it gets there)
      if (car.pilot && car.pilot.s > car.path.len - 70) this.extend(car);
    }
    this.stats.maxNear = Math.max(this.stats.maxNear, near);
    // the engines of the two nearest, by their speed (my own is the cabin's bed)
    this.engT = (this.engT || 0) - dt;
    const S = this.game.sfx;
    if (S && S.live && this.engT <= 0) {
      this.engT = 0.1;
      const by = this.cars.map((c) => [Math.hypot(c.v.pos.x - eye.x, c.v.pos.z - eye.z), c]).filter((x) => x[0] < 45).sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 2; k++) {
        const c = by[k] && by[k][1];
        if (c) { const sp = Math.abs(c.v.speed), n = KINDS[c.kind].note; S.loop('o2_eng' + k, c.v.pos, 0.12 + 0.18 * Math.min(1, sp / 12) * (1.4 - n * 0.5), 'brown', (160 + sp * 11) * n, 0, true); }
        else if (S.loops && S.loops.has('o2_eng' + k)) S.stopLoop('o2_eng' + k);
      }
    }
    this.stats.near = near;
  }
  deal(eye) {
    const f = this.game.camera.getWorldDirection(_v);
    const cand = [];
    for (const car of this.cars) {
      const v = car.v, dx = v.pos.x - eye.x, dz = v.pos.z - eye.z, d = Math.hypot(dx, dz);
      fleetLod(v.model, d > 95 ? 2 : d > 48 ? 1 : 0);
      if (d < 110 && (dx * f.x + dz * f.z) / Math.max(d, 1) > 0.2) cand.push([d, v]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const want = new Set(cand.slice(0, POOL).map((c) => c[1]));
    for (const h of this.lampPool) if (h.owner && !want.has(h.owner)) { if (h.owner.lamps === h) h.owner.lamps = null; h.owner = null; h.setOn(false); }
    for (const v of want) {
      if (v.lamps) continue;
      const h = this.lampPool.find((x) => !x.owner);
      if (!h) break;
      h.owner = v; h.points = KINDS[v.kind] ? KINDS[v.kind].lamps : h.points; h.setOn(true); v.lamps = h;
    }
  }
  extend(car) {
    const ids = car.ids;
    if (ids.length < 3) return;
    const a = ids[ids.length - 2], b = ids[ids.length - 1];
    const E = this.game.camera.position;
    const more = walk(this.graph, b, a, 6, this.rng, undefined, { x: E.x, z: E.z });
    const ids2 = [ids[ids.length - 3], ...more];
    let path;
    try { path = lanePath(this.graph, ids2, { pace: car.pace || 1 }); } catch (err) { car.pilot.done = true; return; }
    car.ids = ids2; car.path = path;
    car.pilot.setPath(path, car.v);
  }

  // ---- the rules of the road: where it must stop --------------------------------------------------
  rules(car, dt) {
    const v = car.v, P = car.pilot, path = car.path, W = this.W;
    car.hornT = Math.max(0, car.hornT - dt);
    if (car.state === 'panic') {
      car.panicT -= dt;
      P.o.vmax = car.panicT > 0 ? 0 : 4;
      if (car.panicT < -3) { car.state = 'drive'; P.o.vmax = KINDS[car.kind].spec.vmax * 0.8; if (v.model.meshes.bust) v.model.meshes.bust.position.y = 0; }
      P.offset = car.swerveT > 0 ? car.swerve : 0;
      car.swerveT = (car.swerveT || 0) - dt;
      return;
    }
    const s = P.s, sp = Math.max(0, v.speed);
    let stop = Infinity;
    car.atSignal = false;
    // (a man at my door: I brake for him - the hijack's 'he brakes when I stand at his door';
    // the hijack says so each step it sees me there)
    if (car.held) { stop = s - 1; car.held = false; car.why = 'held'; }
    // (the proofs' bed: a car that stops beside a car - &come=..&held=1)
    if (car.stopBy) { const i = path.nearestAll(car.stopBy.pos.x, car.stopBy.pos.z); stop = Math.min(stop, path.pts[i].s + 1.5); }
    // the next junction ahead and the line before it
    const nodes = path.nodes;
    for (let k = 1; k < nodes.length; k++) {
      const N = nodes[k];
      if (N.s < s - 2) continue;
      const box = Math.max(...N.node.edges.map((e) => e.hw)) + 1.5;
      // (the line before the junction, for the car's nose; past it by a few
      // metres it is in the junction already and goes on through)
      const line = N.s - box - v.spec.halfL - 0.4;
      if (s > line + 3) break;
      if (N.node.signal && W.signals) {
        const st = W.signals.state(N.node, N.edgeIn);
        if (st === 'stop') stop = Math.min(stop, line);
        else if (st === 'amber') { const need = (sp * sp) / (2 * 3.2) + 1; if (line - s > need) stop = Math.min(stop, line); }
        car.atSignal = st !== 'go';
        // (and a car of mine across it on its red: they brake for me)
        const pv = W.V.player;
        if (st === 'go' && pv && line - s < 14 && Math.hypot(pv.pos.x - N.node.x, pv.pos.z - N.node.z) < box + 2 && pv.speedAbs > 1.5 && Math.abs(Math.cos(pv.yaw - v.yaw)) < 0.6) stop = Math.min(stop, line);
      } else if (N.node.ways >= 3) {
        // give way to a car already in the junction (and never wait for ever)
        if (line - s < 12) {
          let busy = false;
          for (const o of this.cars) { if (o === car) continue; const ov = o.v; if (Math.hypot(ov.pos.x - N.node.x, ov.pos.z - N.node.z) < box && Math.hypot(ov.vel.x, ov.vel.z) > 1) { busy = true; break; } }
          const pv = W.V.player;
          if (pv && Math.hypot(pv.pos.x - N.node.x, pv.pos.z - N.node.z) < box && pv.speedAbs > 1) busy = true;
          car.giveT = busy ? (car.giveT || 0) + dt : 0;
          if (busy && car.giveT < 4) stop = Math.min(stop, line);
        }
      }
      break;
    }
    // a man standing in my lane ahead: stop short, the horn, then a slow way round
    const man = W.manAhead(v, P, path);
    if (man) {
      stop = Math.min(stop, s + man.ahead - 5);
      if (sp < 0.5) {
        car.manT = (car.manT || 0) + dt;
        if (car.manT > 1.1 && !car.manHonk) { car.manHonk = true; this.honk(car, 0.8); }
        if (car.manT > 3.2) { car.roundMan = man.side > 0 ? -2.7 : 2.4; car.roundT = 6; }
      }
    } else { car.manT = 0; car.manHonk = false; }
    if (car.roundT > 0) {
      car.roundT -= dt;
      P.offset = car.roundMan;
      stop = Infinity;
      P.o.vmax = 2.6;
      if (car.roundT <= 0 || !man) { if (!man && car.roundT < 4.5) { car.roundT = 0; } }
      if (car.roundT <= 0) { P.offset = 0; P.o.vmax = KINDS[car.kind].spec.vmax * 0.8; }
    } else if (car.pullT > 0) {
      car.pullT -= dt;
      P.offset = 1.2;
      P.o.vmax = 4;
      if (car.pullT <= 0) { P.offset = 0; P.o.vmax = KINDS[car.kind].spec.vmax * 0.8; }
    }
    // a car of mine cutting in ahead close: the horn
    if (P.ahead && P.ahead === W.V.player && v.speed > 4) {
      const gap = Math.hypot(P.ahead.pos.x - v.pos.x, P.ahead.pos.z - v.pos.z) - 5;
      if (gap < 5 && !car.cutHonk) { car.cutHonk = true; this.honk(car, 1); }
    } else if (!P.ahead || P.ahead !== W.V.player) car.cutHonk = false;
    P.o.stopAt = stop < Infinity ? stop : null;
    // (how long a car has waited where it stands: the bench's 'stuck at a junction')
    // (a car queued behind one that waits at a red waits at the red too)
    const ahead = P.ahead && P.ahead.traffic ? this.cars.find((c) => c.v === P.ahead) : null;
    car.red = car.atSignal || !!(ahead && ahead.red && Math.abs(ahead.v.speed) < 0.5);
    if (sp < 0.3) { car.waitT += dt; if (!car.red) { car.freeWait = (car.freeWait || 0) + dt; this.stats.maxWait = Math.max(this.stats.maxWait, car.freeWait); } } else { car.waitT = 0; car.freeWait = 0; }
    // the police car's lamp: its slow turn (a cruise: dim; a hunt: O3's)
    if (v.model.glow) v.model.glow.visible = false;
  }

  // ---- what the city asks of them ------------------------------------------------------------------
  honk(car, k = 0.8) {
    if (car.hornT > 0) return;
    car.hornT = 2.6;
    const lowK = KINDS[car.kind] ? KINDS[car.kind].note : 1;
    this.game.sfx.play('tail_horn', car.v.pos, { k, dur: 0.3 + this.rng.next() * 0.35, low: lowK < 0.9 ? 1 : 0 }, { ref: 7 });
  }
  // my horn (Q): the car ahead of me in my way pulls over a moment; the others answer
  horn(from) {
    for (const car of this.cars) {
      const v = car.v, l = from.local(v.pos, _v);
      if (l.x > 3 && l.x < 30 && Math.abs(l.z) < 2.6 && Math.cos(v.yaw - from.yaw) > 0.5) { car.pullT = 3; if (this.rng.next() < 0.5) this.honk(car, 0.6); }
      else if (l.x > 0 && l.x < 25 && Math.abs(l.z) < 6 && this.rng.next() < 0.3) this.honk(car, 0.5);
    }
  }
  // a shot fired near them, a man down: they swerve, stop crooked, the man at
  // the wheel ducks (or gets out and runs: the hijack's flee)
  alarm(point, k = 1) {
    const R = 38 * k;
    for (const car of [...this.cars]) {
      const v = car.v, d = Math.hypot(v.pos.x - point.x, v.pos.z - point.z);
      if (d > R) continue;
      if (car.state !== 'panic') { car.swerve = (this.rng.next() < 0.5 ? -1 : 1) * (1.2 + this.rng.next()); car.swerveT = 0.7; this.honk(car, 1); }
      car.state = 'panic';
      car.panicT = 4 + this.rng.next() * 4;
      if (v.model.meshes.bust) v.model.meshes.bust.position.y = -0.32;
      // (one in three that is close gets out and runs: the car stays where it stopped)
      if (d < 22 && car.driver.kind === 'civilian' && this.rng.next() < 0.35 && this.W.flee) {
        const vv = this.release(car);
        this.W.flee(vv, car.driver, point);
      }
    }
  }

  clear() { for (const car of [...this.cars]) this.drop(car); }
  dispose() {
    this.clear();
    for (const h of this.lampPool) h.dispose();
    this.lampPool = [];
  }
  void() { return clamp; }
}
