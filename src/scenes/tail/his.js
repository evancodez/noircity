import * as THREE from 'three';
import { buildPath } from '../../stages/city/route.js';
import { PULL, RIVER_B } from './rules.js';
const _l = new THREE.Vector3();
import { Pilot } from '../../vehicles/pilot.js';
import { RIVER_LEN, riverPoint, riverFrame, PIER } from '../../stages/city/plan.js';

// The watcher at his wheel (chapter VI): a driver with a route through the
// city and rules, on the same physics as me (vehicles/Car.js through a
// Pilot): no leash - he does not slow to wait for me, he does not speed up
// when I close. He knows I am behind him and tries to shake me: he turns,
// doubles back, cuts through the market square, runs Water St ahead of the
// tram, goes down the alley; at the decision points the way he takes
// depends on how close I am (close: the tighter, trickier way; far: the
// plainer one), so a retry is not the same film. Then the river road, for
// Pier 9, flat out. My rounds take him apart (chase.js: tyres, the man,
// the tank); here only how he drives with them.
//   new His(chase, car, { from }) -> his.drive(v, dt) (v.driver = his)
//   his.legs: the route's legs; his.leg (index); his.onRiver; his.atPier
// The routes as junctions (plan.GRAPH). Each leg ends at a decision (or the
// river road): `near` is taken when I am within NEAR m, `far` otherwise.
const NEAR = 38;
// (where the el's columns begin over the river road, z)
const EL_Z0 = -14;
export const LEGS = [
  // 0: off the kerb up Pell Lane, east on Harbor St (wide), north up Cooper
  { name: 'pell', ids: ['pell.fifth', 'pell.harbor', 'cooper.harbor', 'cooper.clock'] },
  // 1: the market square, corner to corner through the stalls (near), or
  // round it by Cooper and Market St (far); then up the avenue under the el
  // toward the bridge (it is up), right along the canal
  { name: 'square', near: ['cooper.clock', 'avenue.market', 'avenue.canal', 'baxter.canal'],
    far: ['cooper.clock', 'cooper.market', 'avenue.market', 'avenue.canal', 'baxter.canal'] },
  // 2: south down Baxter past the clock tower; left on Clock St
  { name: 'baxter', ids: ['baxter.canal', 'baxter.market', 'baxter.clock', 'alley.clock'] },
  // 3: the alley through the block (near: I can follow, or go round), east
  // under the el on Harbor St, up Water St; far: on along Clock St to Water
  { name: 'alley', near: ['alley.clock', 'alley.harbor', 'water.harbor', 'water.clock', 'water.market'],
    far: ['alley.clock', 'water.clock', 'water.market'] },
  // 4: on up Water St (the tram coming down it) to the canal, and along it
  // to the river road's north end: the long run south to the pier begins
  { name: 'canal', ids: ['water.market', 'water.canal', 'river.canal'] },
];
// (the checkpoints within the chase: a leg's start, both cars placed there)
export const CHECKS = {
  start: { leg: 0 },
  chase2: { leg: 2 },
};

export class His {
  constructor(chase, car, { leg = 0, choice = null, prev = null } = {}) {
    this.chase = chase;
    this.car = car;
    this.legIndex = leg;
    this.choices = choice ? { ...choice } : {};
    this.state = 'wait';           // wait -> go (the chase) -> river -> hurt ... -> lost (crashing) -> stopped
    this.pace = 1;
    this.control = 1;              // 1 his own; 0 gone (crashing)
    this.duck = 0;                 // s left of ducking under my rounds
    this.t = 0;
    this.makeLeg(leg, false, prev);
  }

  // the path of a leg (and on through the next, so a corner at a leg's end
  // is a corner, not a stop)
  idsOf(i) {
    const L = LEGS[i];
    if (!L) return null;
    if (L.ids) return L.ids;
    const c = this.choices[L.name] || 'near';
    return L[c];
  }
  makeLeg(i, decide = true, prev = null) {
    const L = LEGS[i];
    // ([4th owner] near, he tries to shake me either way - the tighter one
    // more often - by the try's own draw: the critic, 2nd look, saw a good
    // player get the same film to the metre every run, the choice read only
    // my gap; far, the plainer way, as before)
    if (decide && !L.ids) this.choices[L.name] = this.chase.gap() < NEAR ? (this.chase.routeRng && this.chase.routeRng.next() < 0.4 ? 'far' : 'near') : 'far';
    // (from the junction before the leg's start: its corner is in the path)
    let ids = (prev ? [prev] : []).concat(this.idsOf(i));
    // (on through the next leg as it stands now: the far choice by default)
    const nx = LEGS[i + 1];
    if (nx) { const n2 = nx.ids || nx[this.choices[nx.name] || 'near']; ids = ids.concat(n2.slice(1)); }
    else ids = ids.concat(['river.market']);
    this.ids = ids;
    // (every junction he has committed to, in order: the bots follow his way)
    const legIds = this.idsOf(i);
    if (!this.allIds) this.allIds = [];
    if (!this.allIds.length && prev) this.allIds.push(prev);
    for (const id of legIds) if (this.allIds[this.allIds.length - 1] !== id) this.allIds.push(id);
    this.legEndId = this.idsOf(i)[this.idsOf(i).length - 1];
    const path = buildPath(ids, { vmax: 16.5, aLat: 6.2, aBrake: 5.2 });
    if (!this.pilot) this.pilot = new Pilot(path, { keep: 5, overtake: true, bodies: () => this.chase.bodies() });
    else this.pilot.setPath(path, this.car);
    this.path = path;
    this.legIndex = i;
  }
  // the river road: south to the pier's gate
  makeRiver() {
    const pts = [];
    const p = this.car.pos;
    // from where he is (the turn onto the road) down its west lane to the yard
    const f0 = riverFrame(0, {});
    void f0;
    let s0 = 0, bd = Infinity;
    for (let s = 0; s < RIVER_LEN; s += 2) { const q = riverPoint(s, 0); const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; s0 = s; } }
    pts.push([p.x, p.z]);
    for (let s = s0 + 8; s < RIVER_LEN - 2; s += 3) { const q = riverPoint(s, 1.45); pts.push([q.x, q.z]); }
    pts.push([PIER.park.x - 6, PIER.park.z - 4], [PIER.gate.x - 4, PIER.gate.z]);
    return pts;
  }

  drive(v, dt) {
    this.t += dt;
    const I = v.input;
    // (at the kerb, or stopped: his foot holds the brake - he does not roll
    // back onto my bonnet)
    if (this.state === 'wait' || this.state === 'stopped') { I.throttle = 0; I.brake = 1; I.steer = 0; I.handbrake = 0; I.hold = 1; return; }
    if (this.state === 'lost') { this.crashing(v, dt); return; }
    const P = this.pilot;
    P.o.pace = this.pace * (this.duck > 0 ? 0.72 : 1) * (this.control < 1 ? 0.85 + 0.15 * this.control : 1);
    // ([C3b, after the critic] getting away he drives for it: his pace whole
    // again, the weave gone - the limp is in his top speed's climb, not in a
    // road he cannot hold)
    const ga = this.state === 'river' ? (this.getaway || 0) : 0;
    if (ga > 0) P.o.pace += (this.pace - P.o.pace) * ga;
    this.pullStep(v, dt);
    // [2nd owner] (the river road: the revolver out of my window in his
    // mirror, he weaves across his lane - a moving mark, aimed at, not a
    // target that drives straight at the end of my sights)
    const G0 = this.chase.gun;
    const seesGun = this.state === 'river' && G0 && G0.aimK > 0.5 && this.chase.gap() < 45;
    this.weave = Math.max(0, Math.min(1, (this.weave || 0) + (seesGun ? dt * 1.5 : -dt * 0.5)));
    P.o.wander = (this.duck > 0 ? 1.4 : Math.max(this.control < 0.6 ? 0.7 : 0, 1.15 * this.weave)) * (1 - 0.8 * ga);
    P.o.wanderRate = this.duck > 0 ? 0.9 : this.weave > 0 ? 2.3 : 0.9;
    this.duck = Math.max(0, this.duck - dt);
    // [3rd owner] a round that lands: he jerks the wheel off the line it came
    // from and runs on a lane over for a moment (the next is harder to land)
    if (this.swerveT > 0) { this.swerveT -= dt; P.offset = this.swerveDir * 2.0 * Math.min(1, this.swerveT / 0.5); } else if (P.offset) P.offset = 0;
    // [4th owner] (under the el on the river road its columns stand 3.9 m
    // either side of the middle, inside the lanes: his weave and swerve there
    // are kept between them - the bench found him pinned on a column, out of
    // the chase for half a minute; he crashes into one only with his hands
    // gone)
    if (this.state === 'river' && v.pos.z > EL_Z0) { P.o.wander = Math.min(P.o.wander, 0.6); P.offset = Math.max(-0.9, Math.min(0.9, P.offset || 0)); }
    P.drive(v, dt);
    if (this.jerkT > 0) { this.jerkT -= dt; I.steer = Math.max(-1, Math.min(1, I.steer + this.swerveDir * 0.45 * (this.jerkT / 0.28))); }
    // (near a leg's end, before its corner: the next leg decided by where I
    // am now, its path from the junction before)
    const endS = this.path.nodeS[this.legEndId];
    if (this.state === 'go' && endS != null && P.s > endS - (this.legIndex + 1 < LEGS.length ? 26 : 4)) {
      if (this.legIndex + 1 < LEGS.length) { const k = this.ids.indexOf(this.legEndId); this.makeLeg(this.legIndex + 1, true, k > 0 ? this.ids[k - 1] : null); }
      else this.toRiver();
    }
    if (this.state === 'go' && P.done) this.toRiver();
    if (this.state === 'river' && P.done) this.atPier = true;
  }
  // [C3b] he pulls away when I close (rules.js PULL): within PULL.near m
  // behind him (in the streets, or on the river road while his car is
  // whole) he floors it - the engine let out, the straights faster than my
  // coupe can go - for PULL.t s, then back to his pace. On the river road his
  // pace is his hold on the car's (hurt, slower than me), and the window's
  // getaway (chase.js: from RIVER_B.warn s he speeds up and away).
  pullStep(v, dt) {
    const ch = this.chase, my = ch.my, P = this.pilot;
    this.coolT = Math.max(0, (this.coolT || 0) - dt);
    const whole = !(ch.hurt && ch.hurt());
    // (he sees me in his mirror a moment before his foot goes down: a
    // fast close gets the graze)
    let close = false;
    if (my) { const l = v.local(my.pos, _l); close = l.x < 1 && Math.hypot(l.x, l.z) < PULL.near; }
    const can = this.state === 'go' || (this.state === 'river' && whole);
    this.seenT = close && can ? (this.seenT || 0) + dt : 0;
    if (this.burstT > 0) {
      this.burstT -= dt;
      if (!whole && this.state === 'river') this.burstT = 0;
      // ([C3b, after the critic] still on him as it runs out: his foot stays down)
      else if (close && this.burstT < 0.5) this.burstT = 0.5;
    } else if (can && (this.coolT <= 0 || close) && this.seenT > PULL.react) this.burst(true);
    const on = this.burstT > 0;
    this.burstK = (this.burstK || 0) + ((on ? 1 : 0) - (this.burstK || 0)) * (1 - Math.exp(-dt * 6));
    // [C3b, after the critic] the window's getaway: hurt or whole, he finds
    // more than my coupe has (RIVER_B.away) - the limp and the smoke still on him
    const away = this.state === 'river' ? (this.getaway || 0) : 0;
    const S = v.spec, S0 = this.spec0 || (this.spec0 = { vmax: S.vmax, accel: S.accel, mass: S.mass });
    const vTop = Math.max(PULL.vmax, RIVER_B.away + 1);
    S.vmax = on ? PULL.vmax : S0.vmax + (vTop - S0.vmax) * away;
    S.accel = on ? PULL.accel : S0.accel + (PULL.accel - S0.accel) * away;
    // (a whole car is heavy to my nose: a graze jolts him, it never turns him
    // off his line; hurt, he is his own weight - the shunt can move him)
    S.mass = whole ? PULL.mass : S0.mass;
    // (the path's speeds: its straights let out, its corners as they were)
    this.boostPath(this.path, on || away > 0);
    if (this.state === 'river') {
      let vm = RIVER_B.cruise * (0.55 + 0.45 * this.control) * (this.fire ? 0.85 : 1);
      if (away > 0) vm += (RIVER_B.away - vm) * away;
      if (on) vm = Math.max(vm, PULL.vmax);
      P.o.vmax = vm;
    } else P.o.vmax = 30;
  }
  burst(force = false) {
    if (this.state !== 'go' && this.state !== 'river') return;
    if (this.state === 'river' && this.chase.hurt && this.chase.hurt()) return;
    if ((!force && this.coolT > 0) || this.burstT > 0.5) return;
    this.burstT = PULL.t; this.coolT = PULL.t + PULL.cool;
    this.bursts = (this.bursts || 0) + 1;
    const G = this.chase.game;
    // (the tyres chirp on the wet as he lets the clutch in)
    if (G) { G.sfx.play('tail_screech', this.car.pos, { dur: 0.35, k: 0.5 }, { ref: 5 }); G.emit('tail:burst', {}); }
  }
  boostPath(path, on) {
    if (!path || !path.pts || !!path._boosted === on) return;
    const pts = path.pts;
    if (!path._vB) {
      path._v0 = pts.map((p) => p.v);
      const vB = pts.map((p) => Math.min(PULL.pathV, Math.sqrt(PULL.aLat / Math.max(p.k ?? 1e-4, 1e-4))));
      for (let i = pts.length - 2; i >= 0; i--) vB[i] = Math.min(vB[i], Math.sqrt(vB[i + 1] ** 2 + 2 * PULL.aBrake * Math.max(0.01, pts[i + 1].s - pts[i].s)));
      path._vB = vB;
    }
    const src = on ? path._vB : path._v0;
    for (let i = 0; i < pts.length; i++) pts[i].v = src[i];
    path._boosted = on;
  }
  toRiver() {
    if (this.state === 'river') return;
    const pts = this.makeRiver();
    const path = buildPathFromPoly(pts);
    this.pilot.setPath(path, this.car);
    this.pilot.o.vmax = RIVER_B.cruise;
    this.path = path;
    this.state = 'river';
    this.chase.onRiver && this.chase.onRiver();
  }

  // (a hit: dir + right of his car, k how hard)
  swerve(dir, k = 1) {
    if (this.state !== 'river') return;
    this.swerveDir = Math.sign(dir || 1) * Math.min(1, Math.abs(dir) * k);
    this.swerveT = 0.9; this.jerkT = 0.28;
  }
  // his hands gone (my rounds, my shunt): he holds the wheel hard over the
  // way he was pulled, the throttle on, and the car does what a car does
  lose(dir = 0) {
    if (this.state === 'lost') return;
    this.state = 'lost';
    this.lostDir = dir || (Math.random() < 0.5 ? -1 : 1);
    this.lostT = 0;
  }
  crashing(v, dt) {
    const I = v.input;
    this.lostT += dt;
    // ([C3b] a stab of throttle as the tail goes, then his feet off: the car
    // slides on round and across the road on what it carries, into whatever
    // is there, before he finds the brake - his foot kept down drove his
    // nose, once round, into my door)
    I.steer = this.lostDir * Math.min(1, this.lostT * 2.2);
    I.throttle = this.lostT < 0.25 ? 0.8 : 0;
    // ([C3b, after the critic] and late on, both feet down: he comes to rest
    // on his own brakes, never frozen mid-slide)
    I.brake = this.lostT > 4.5 ? 1 : this.lostT > 2.4 ? 0.35 : 0;
    // (the handbrake's model is the one that lets a car go round on its
    // momentum - Car.js holds a driven car's slip under 40 degrees)
    I.handbrake = this.lostT < 1.8 || this.lostT > 4.5 ? 1 : 0;
    I.hold = 1;
  }
}

// a path from raw points (the river run)
import { samplePath } from '../../stages/city/route.js';
// ([C3b] its straights at PULL.pathV: his pace is the pilot's vmax, set each step)
function buildPathFromPoly(pts) { return samplePath(pts, { vmax: PULL.pathV, aLat: 6.2, aBrake: 5.2 }); }
