import { buildPath } from '../../stages/city/route.js';
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
    if (decide && !L.ids) this.choices[L.name] = this.chase.gap() < NEAR ? 'near' : 'far';
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
    // [2nd owner] (the river road: the revolver out of my window in his
    // mirror, he weaves across his lane - a moving mark, aimed at, not a
    // target that drives straight at the end of my sights)
    const G0 = this.chase.gun;
    const seesGun = this.state === 'river' && G0 && G0.aimK > 0.5 && this.chase.gap() < 45;
    this.weave = Math.max(0, Math.min(1, (this.weave || 0) + (seesGun ? dt * 1.5 : -dt * 0.5)));
    P.o.wander = this.duck > 0 ? 1.4 : Math.max(this.control < 0.6 ? 0.7 : 0, 1.15 * this.weave);
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
  toRiver() {
    if (this.state === 'river') return;
    const pts = this.makeRiver();
    const path = buildPathFromPoly(pts);
    this.pilot.setPath(path, this.car);
    this.pilot.o.vmax = 17;
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
    I.steer = this.lostDir * Math.min(1, this.lostT * 2.2);
    I.throttle = this.lostT < 0.9 ? 0.7 : 0;
    I.brake = this.lostT > 1.3 ? 0.5 : 0;
    I.handbrake = this.lostT < 0.6 ? 1 : 0;
    I.hold = 1;
  }
}

// a path from raw points (the river run)
import { samplePath } from '../../stages/city/route.js';
function buildPathFromPoly(pts) { return samplePath(pts, { vmax: 17, aLat: 6.2, aBrake: 5.2 }); }
