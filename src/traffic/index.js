import * as THREE from 'three';
import { Signals } from './signals.js';
import { Parked } from './parked.js';
import { Traffic } from './Traffic.js';
import { Tram } from './tram.js';
import { crimeOf } from './seams.js';
import { Hijack } from '../vehicles/hijack.js';
import { KINDS, lampsLit } from '../vehicles/kinds.js';
import { Headlamps } from '../vehicles/Vehicle.js';
import { showDamage, damageStep, watchDamage } from '../vehicles/damage.js';

// NOIR CITY's wheels (lane O2): game.wheels, made by the free roam (src/scenes/city.js)
// on the city's stage. Owns the signals, the parked cars, the moving traffic,
// the tram, the cars I left (where I left them), the hijack, the knocks'
// sounds, and the things to do on wheels (the garage, the fares, the race:
// src/vehicles/garage.js, fares.js, race.js add themselves here).
//   wheels.step(dt)                    (the free roam calls it every step)
//   wheels.alarm(point, k)             a shot, a man down: the traffic panics (O3, O4 call it)
//   wheels.carAt(x, z, kind, opts)     a car of a kind put at a point (a system asks for one)
//   wheels.left [{ v, kind, x, z, yaw, paint, full }]   the cars I left (kept)
//   wheels.bodies()                    every solid car (moving, left, parked)
//   events (game.emit): 'wheels:hijack' { car, kind, driver, how }, 'wheels:in' / 'wheels:out' { car }
const _v = new THREE.Vector3();
export class Wheels {
  constructor(game, stage, { traffic = true } = {}) {
    this.game = game;
    this.stage = stage;
    const city = stage.part('city');
    this.C = city.C;
    this.graph = city.graph;
    this.V = game.vehicles;
    this.crime = crimeOf(game);
    this.signals = new Signals(stage, this.graph);
    this.parked = new Parked(this);
    this.traffic = new Traffic(this);
    this.traffic.on = traffic;
    this.tram = new Tram(this);
    this.left = [];
    this.hijack = new Hijack(this);
    this.t = 0;
    this.extras = [];   // the things to do (garage, fares, race): { step(dt), reset() }
    // the cars' world: the parked bodies are solid to the cars (track) and to a man (colliders)
    const T = stage.track;
    if (T) T.parked = this.parked.bodies;
    stage.colliders.bodies = () => this.V.list.concat(this.parked.bodies);
  }

  // the free roam's start (and a retry, the river's steps): before the vehicles
  // are cleared, what the wheels hold is let go - the traffic, the men, the tram
  // out of the list, the cars I left made records (they come back where they were)
  detach() {
    this.hijack.clear();
    this.traffic.clear();
    for (const x of this.extras) if (x.detach) x.detach();
    const i = this.V.list.indexOf(this.tram.v);
    if (i >= 0) this.V.list.splice(i, 1);
    for (const L of this.left) if (L.v) { L.x = L.v.pos.x; L.z = L.v.pos.z; L.yaw = L.v.yaw; L.damage = L.v.damage; this.V.remove(L.v); L.v = null; }
  }
  // and after: the start's car, the tram back on its rails
  attach(car) {
    if (!this.V.list.includes(this.tram.v)) this.V.list.push(this.tram.v);
    if (car) { this.watch(car); watchDamage(this, car); }
    this.leftT = 0;
    for (const x of this.extras) if (x.attach) x.attach();
    // (look development: &lineup=1 - one of each kind up the kerb ahead of the start's car)
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    // (the proofs' beds: &park=saloon[,van] - parked cars up the kerb ahead of the start's
    // car; &come=saloon[:fighter] - a car with a man at the wheel coming up the near lane
    // from 60 m behind; &held=1 - it stops beside the start)
    if (q && q.get('park') && car) {
      let ahead = 4;
      for (const k of q.get('park').split(',')) {
        const K = KINDS[k];
        ahead += K.halfL + 1.2;
        const p = car.world(ahead, 0, new THREE.Vector3());
        this.parked.make({ bay: -1, kind: k, x: p.x, z: p.z, yaw: car.yaw, body: null, gone: false });
        ahead += K.halfL + 1.2;
      }
    }
    if (q && q.get('come') && car) this.comeT = 0.3;
    if (q && q.get('lineup') && car) {
      const kinds = q.get('lineup') === '1' ? ['coupe', 'saloon', 'taxi', 'police', 'hearse', 'van', 'lorry'] : q.get('lineup').split(',');
      let ahead = 7;
      for (const k of kinds) {
        const K = KINDS[k];
        ahead += K.halfL + 0.8;
        const p = car.world(ahead, 0, new THREE.Vector3());
        const v = this.carAt(p.x, p.z, k, { yaw: car.yaw, lights: false });
        v.parked = true;
        this.left.push({ v, kind: k, x: p.x, z: p.z, yaw: car.yaw, paint: v.model.paint });
        ahead += K.halfL + 0.8;
      }
    }
  }
  // my car's knocks heard and seen (once a car)
  watch(v) {
    if (v._knockWatch) return;
    v._knockWatch = true;
    v.on('crash', (e) => this.knock(v, e, true));
    v.on('scrape', (e) => this.knock(v, e, false));
  }
  forgetLeft(v) { const i = this.left.findIndex((L) => L.v === v); if (i >= 0) this.left.splice(i, 1); v.parked = false; v.left = null; }

  // ---- what the others read ---------------------------------------------------------------------
  bodies() { return this.V.list.concat(this.parked.bodies); }
  bodiesNear(x, z, r) {
    const out = [];
    for (const o of this.V.list) if (Math.abs(o.pos.x - x) < r && Math.abs(o.pos.z - z) < r) out.push(o);
    for (const b of this.parked.bodies) if (Math.abs(b.pos.x - x) < r && Math.abs(b.pos.z - z) < r) out.push(b);
    return out;
  }
  // a pilot's world: the moving cars (and mine, the tram) and the parked near it
  bodiesFor(v) {
    const L = this._bf || (this._bf = []);
    L.length = 0;
    for (const o of this.V.list) L.push(o);
    for (const b of this.parked.bodies) if (Math.abs(b.pos.x - v.pos.x) < 45 && Math.abs(b.pos.z - v.pos.z) < 45) L.push(b);
    return L;
  }
  // the man on foot (me) - where he stands, or null in a car
  manPoint() {
    const R = this.game.city;
    if (R && R.inCar) return null;
    const p = this.game.controller.pos;
    return _v.set(p.x, 0, p.z);
  }
  // a man in a car's way ahead: { ahead (m along its path), side (+ right) } or null
  manAhead(v, P, path) {
    const p = this.manPoint();
    if (!p) return null;
    const l = v.local(p, this._ml || (this._ml = new THREE.Vector3()));
    if (l.x < 1 || l.x > 30) return null;
    // (his lateral place against the path there)
    const q = path.at(Math.min(path.len, P.s + l.x), this._mq || (this._mq = {}));
    const side = (p.x - q.x) * -q.fz + (p.z - q.z) * q.fx;
    if (Math.abs(side) > v.spec.halfW + 1.0) return null;
    return { ahead: l.x, side };
  }

  // ---- each step ----------------------------------------------------------------------------------
  step(dt) {
    const G = this.game, cam = G.camera, eye = cam.position;
    this.t += dt;
    this.signals.step(dt, eye);
    this.parked.step(dt, cam);
    this.traffic.step(dt, eye);
    this.tram.step(dt, eye);
    this.hijack.step(dt);
    // the cars I left: kept where they stand (a far one a record, made again near)
    this.leftT = (this.leftT || 0) - dt;
    if (this.leftT <= 0) { this.leftT = 0.5; this.keepLeft(eye); }
    for (const L of this.left) {
      const v = L.v;
      if (!v || v === this.V.player) continue;
      // (a left car still rolling, or knocked: it rolls out its roll, its brakes on)
      if (v.vel.lengthSq() > 4e-4 || Math.abs(v.yawRate) > 0.01 || v.touchT < 0.3) { v.input.throttle = 0; v.input.brake = 1; v.input.handbrake = 1; v.step(dt); }
    }
    damageStep(this, dt);
    if (this.comeT != null) { this.comeT -= dt; if (this.comeT <= 0) { this.comeT = null; this.come(); } }
    for (const x of this.extras) x.step(dt);
  }
  keepLeft(eye) {
    for (const L of this.left) {
      if (L.v && L.v === this.V.player) continue;
      if (L.v) {
        L.x = L.v.pos.x; L.z = L.v.pos.z; L.yaw = L.v.yaw; L.damage = L.v.damage;
        if (Math.hypot(L.x - eye.x, L.z - eye.z) > 320) { this.V.remove(L.v); L.v = null; }
      } else if (Math.hypot(L.x - eye.x, L.z - eye.z) < 240) {
        L.v = this.V.spawn(L.kind, { at: new THREE.Vector3(L.x, 0, L.z), yaw: L.yaw, lights: !!L.full, fleet: !L.full, fleetPaint: L.paint });
        L.v.damage = L.damage || 0; L.v.parked = true; L.v.left = L;
        if (L.v.lamps && L.v.lamps.setOn) L.v.lamps.setOn(false);
        showDamage(this, L.v, true);
      }
    }
  }
  // a car I got out of: it stays where it stands (the free roam's getOut)
  leave(v) {
    if (!v) return;
    let L = this.left.find((x) => x.v === v);
    if (!L) { L = { v, kind: v.kind, paint: v.model && v.model.paint, full: !(v.model && v.model.fleet) }; this.left.push(L); }
    L.x = v.pos.x; L.z = v.pos.z; L.yaw = v.yaw;
    v.parked = true; v.left = L;
    // (at most six kept: the oldest out of sight goes)
    if (this.left.length > 6) {
      const old = this.left.find((x) => x.v !== this.V.player && x.v !== (this.game.city && this.game.city.car));
      if (old) { if (old.v) this.V.remove(old.v); this.left.splice(this.left.indexOf(old), 1); }
    }
  }
  // a car of mine taken again (I am in it)
  took(v) { v.parked = false; }

  // the player's car's own lamps (a fleet car from the traffic shared the pool's)
  ownLamps(v) {
    if (v.lamps && this.traffic.lampPool.includes(v.lamps)) this.traffic.unlamp(v);
    if (!v.lamps) {
      const K = KINDS[v.kind] || KINDS.coupe;
      v.lamps = new Headlamps(this.stage, v, K.lamps, { reach: 30, intensity: 170, cone: 0.16 });
    }
    if (v.model && v.model.fleet) lampsLit(v.model, this.stage, true);
  }

  // a car of a kind at a point (O3's patrol, the phone box's delivery, the race's men):
  //   { driver: Pilot | null, paint, lights } -> Car
  carAt(x, z, kind, { yaw = null, driver = null, paint = null, lights = true } = {}) {
    let y = yaw;
    if (y == null) { const L = this.graph.nearestLane(x, z); if (L) { x = L.x; z = L.z; y = L.heading; } else y = 0; }
    const v = this.V.spawn(kind, { at: new THREE.Vector3(x, 0, z), yaw: y, lights, fleet: true, fleetPaint: paint });
    if (driver) v.driver = driver;
    if (v.model.fleet) lampsLit(v.model, this.stage, lights);
    if (this.game.rays && v.model.meshes.body) this.game.rays.add(v.model.meshes.body);
    return v;
  }

  // (the proofs' bed: a car with a man at the wheel up the near lane toward the start)
  come() {
    const q = new URLSearchParams(location.search), [kind, who] = q.get('come').split(':');
    const R = this.game.city, car = R && R.car;
    if (!car) return;
    const back = car.world(-60, -5.7, new THREE.Vector3());
    const L = this.graph.nearestLane(back.x, back.z, car.yaw);
    if (!L) return;
    const to = L.dir > 0 ? L.edge.b : L.edge.a, from = L.dir > 0 ? L.edge.a : L.edge.b;
    // (straight on through the junctions ahead: the start's car stands on this street)
    const ids = [from, to];
    for (let k = 0; k < 3; k++) {
      const a = this.graph.nodes.get(ids[ids.length - 2]), b = this.graph.nodes.get(ids[ids.length - 1]);
      const ix = b.x - a.x, iz = b.z - a.z, il = Math.hypot(ix, iz) || 1;
      let best = null, bd = -2;
      for (const e of b.edges) { const o = this.graph.nodes.get(e.a === b.id ? e.b : e.a); if (o.id === a.id) continue; const ox = o.x - b.x, oz = o.z - b.z, d = (ix * ox + iz * oz) / (il * (Math.hypot(ox, oz) || 1)); if (d > bd) { bd = d; best = o.id; } }
      if (!best) break;
      ids.push(best);
    }
    const c = this.traffic.add(kind, 'downtown', ids, { x: L.x, z: L.z });
    if (c && who) c.driver.kind = who;
    if (c && q.get('held')) c.stopBy = car;
    this.come = () => {};
    return c;
  }

  // a shot, a man down near the traffic: they panic
  alarm(point, k = 1) { this.traffic.alarm(point, k); }

  // ---- the knocks: what a car meets, heard and seen (mine, and theirs near me) ------------------
  knock(v, e, hard) {
    const G = this.game, eye = G.camera.position;
    if (!e.point || Math.hypot(e.point.x - eye.x, e.point.z - eye.z) > 70) return;
    v._knockT = v._knockT || 0;
    if (G.time - v._knockT < 0.15) return;
    v._knockT = G.time;
    G.sfx.play(hard ? 'tail_crash' : 'tail_scrape', e.point, { k: Math.max(0.3, e.k || 0.5) }, { ref: 5 });
    if (/^(parked|car|sedan|coupe|truck|saloon|taxi|police|hearse|van|lorry|tram)$/.test(e.what) && (hard || (e.k || 0) > 0.35)) G.sfx.play('c3_dent', e.point, { k: e.k || 0.6 }, { ref: 5 });
    // sparks off the tin
    const n = Math.round(4 + 12 * (e.k || 0.4) * (hard ? 1.4 : 1));
    for (let i = 0; i < n; i++) {
      const vel = (e.n ? e.n.clone() : new THREE.Vector3(0, 1, 0)).multiplyScalar(1 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3)).addScaledVector(v.vel, 0.4 + Math.random() * 0.4);
      G.fx.sparks.spawn({ pos: e.point.clone().setY(0.3 + Math.random() * 0.6), vel, life: 0.2 + Math.random() * 0.35, size: [0.012, 0.02], stretch: 0.05, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
    }
    if (v === this.V.player) {
      G.controller.shake((hard ? 0.8 : 0.22) * (e.k || 0.5) + (hard ? 0.2 : 0), 0);
      if (hard) G.controller.kick(3 * (e.k || 0.5), 3 * (e.k || 0.5), 0.16);
    }
  }

  dispose() {
    this.traffic.dispose();
    this.tram.dispose();
    this.signals.dispose();
    this.parked.dispose();
    for (const L of this.left) if (L.v) this.V.remove(L.v);
    this.left = [];
  }
}
