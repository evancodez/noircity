import * as THREE from 'three';
import { Pilot } from '../vehicles/pilot.js';
import { CAR_SPECS } from '../vehicles/Car.js';   // [O2]
import { samplePath } from '../stages/city/route.js';
import { accentMaterial } from '../render/accents.js';

// [O3] The patrol car, a STAND-IN until lane O2 merges (its police car's
// model, its lamp and siren, its hunting pilot replace this file: the seam is
// `makeCar(police, opts)` below, the one place a police car is made, and
// `PatrolCar`'s api - pos, v, mode, step(dt), crewOut(), dispose()).
// The base's sedan (vehicles.spawn('sedan'): world/Cars.js, Car.js on the
// city's plane), a red lamp on its roof (the registry's red: the one colour
// it shows), the siren (src/audio/sounds/o3_people.js: heard a street away,
// before the car is seen), driven by the base's Pilot (src/vehicles/pilot.js:
// the same throttle, brake and steer a player gives) along O1's road graph:
// graph.route to the target, each street's lane, the corners rounded
// (stages/city/route.js samplePath: the speed each point allows).
//   modes: 'drive' (to a target: me, or where I was seen), 'stopped' (the men
//   out), 'box' (on my car: up to its door, stopped across its nose), 'search'
//   (prowling the streets near where I was last seen, the siren dropped to a
//   yelp), 'block' (a roadblock: parked across the road), 'leave'
const _v = new THREE.Vector3();
let LAMP_MAT = null, LAMP_GEO = null;

// the one place a police car is made (O2 replaces it with its own)
export function makeCar(police, { x, z, yaw, kind = 'sedan' }) {
  const G = police.G;
  // [O2] the city's police car (vehicles/kinds.js 'police': its variants, its lamps, solid to
  // rounds; a man at the wheel), and the riot squad's a lorry of the fleet - the wheels' models
  const W = G.wheels && G.wheels.stage === G.stage ? G.wheels : null;
  const fk = kind === 'truck' ? 'lorry' : 'police';
  const v = W ? W.carAt(x, z, fk, { yaw, lights: true }) : G.vehicles.spawn(kind, { at: { x, z }, yaw, lights: true });
  // (at the base sedan's pace and pull: O3's chases, its box and its roadblock were tuned on it)
  if (W) { W.ownLamps(v); if (v.model.meshes.bust) v.model.meshes.bust.visible = true; if (kind === 'sedan') Object.assign(v.spec, { vmax: CAR_SPECS.sedan.vmax, accel: CAR_SPECS.sedan.accel }); }
  v.police = true;
  // the red lamp on the roof: a small lit dome, the registry's red
  if (!LAMP_MAT) { LAMP_MAT = accentMaterial('blood', { gain: 3.2 }); LAMP_GEO = new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 1); }
  const lamp = new THREE.Mesh(LAMP_GEO, LAMP_MAT);
  // (on the roof's top: the body's own height there)
  v.body.updateMatrixWorld(true);
  const top = new THREE.Box3().setFromObject(v.body).max.y - v.body.position.y;
  lamp.position.set(-0.45, Math.max(1.3, top) - 0.02, 0);
  lamp.userData.emitter = true;
  v.body.add(lamp);
  v.policeLamp = lamp;
  return v;
}

// a road route as a line a car can follow: each street's lane to the right
// of the way, the corners met (O1's graph: route() gives the junctions). The
// first leg is the street I am on, from where I am toward the first junction
// I go to (never back to the junction behind me and round again), the last
// the target's street from the last junction to the target's point.
export function lanePath(graph, from, to, { vmax = 19 } = {}) {
  const R = graph.route(from, to);
  if (!R || !R.nodes.length) return null;
  let ids = R.nodes.slice();
  const L0 = graph.nearestLane(from.x, from.z), Le = graph.nearestLane(to.x, to.z);
  const same = (e, a, b) => e && ((a === e.a && b === e.b) || (a === e.b && b === e.a));
  if (L0 && ids.length >= 2 && same(L0.edge, ids[0], ids[1])) ids.shift();
  if (Le && ids.length >= 2 && same(Le.edge, ids[ids.length - 2], ids[ids.length - 1])) ids.pop();
  const N = ids.map((id) => graph.nodeAt(id));
  if (!N.length) return samplePath([[from.x, from.z], [to.x, to.z]], { vmax, aLat: 6.5, aBrake: 6 });
  // (the projection of a point onto an edge's middle line)
  const proj = (e, x, z) => { const u = Math.max(0, Math.min(e.len, (x - e.ax) * e.dx + (z - e.az) * e.dz)); return [e.ax + e.dx * u, e.az + e.dz * u]; };
  const laneOf = (e) => (e && e.lanes && e.lanes[0]) || 2;
  // a leg from p to q, offset to the right of its way by off
  const leg = (p, q, off) => { const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1; const rx = -dz / L * off, rz = dx / L * off; return [[p[0] + rx, p[1] + rz], [q[0] + rx, q[1] + rz], L]; };
  const lines = [];
  if (L0) {
    const p0 = proj(L0.edge, from.x, from.z), n0 = N[0];
    const l = leg(p0, [n0.x, n0.z], laneOf(L0.edge));
    if (l[2] > 3) lines.push(l);
  }
  for (let i = 0; i + 1 < N.length; i++) {
    const e = graph.edgeOf(N[i].id, N[i + 1].id);
    lines.push(leg([N[i].x, N[i].z], [N[i + 1].x, N[i + 1].z], laneOf(e)));
  }
  if (Le) {
    const nl = N[N.length - 1], pe = proj(Le.edge, to.x, to.z);
    const l = leg([nl.x, nl.z], pe, laneOf(Le.edge));
    if (l[2] > 3) lines.push(l);
  }
  const pts = [[from.x, from.z]];
  for (let i = 0; i < lines.length; i++) {
    const [a0, a1] = lines[i];
    if (i === 0) pts.push(a0);
    if (i + 1 < lines.length) pts.push(meet(a0, a1, lines[i + 1][0], lines[i + 1][1]));
    else pts.push(a1);
  }
  if (pts.length < 2) pts.push([to.x, to.z]);
  // (no point doubled; none so near the last that the car turns on the spot)
  const clean = [pts[0]];
  for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - clean[clean.length - 1][0], pts[i][1] - clean[clean.length - 1][1]) > 1.5) clean.push(pts[i]);
  if (clean.length < 2) clean.push([to.x + 0.1, to.z + 0.1]);
  return samplePath(clean, { vmax, aLat: 6.5, aBrake: 6 });
}
function meet(a0, a1, b0, b1) {
  const dx1 = a1[0] - a0[0], dz1 = a1[1] - a0[1], dx2 = b1[0] - b0[0], dz2 = b1[1] - b0[1];
  const den = dx1 * dz2 - dz1 * dx2;
  if (Math.abs(den) < 1e-6) return [(a1[0] + b0[0]) / 2, (a1[1] + b0[1]) / 2];
  const t = ((b0[0] - a0[0]) * dz2 - (b0[1] - a0[1]) * dx2) / den;
  return [a0[0] + dx1 * t, a0[1] + dz1 * t];
}

export class PatrolCar {
  constructor(police, { x, z, yaw, role = 'patrol', crew = 2, kind = 'sedan', crewKind = 'o3_patrolman' }) {
    this.police = police;
    this.G = police.G;
    this.graph = police.P.graph;
    this.role = role;
    this.crewN = crew;
    this.crewKind = crewKind;
    this.v = makeCar(police, { x, z, yaw, kind });
    this.mode = 'drive';
    this.t = 0; this.routeT = 0; this.target = null; this.crew = [];
    this.siren = true; this.sirenT = Math.random() * 0.5;
    this.stuckT = 0; this.lastS = 0;
    this.pilot = null;
  }
  get pos() { return this.v.pos; }

  // drive to a point (rebuilt as it moves) - [O2] its pilot sees the parked cars too (wheels.bodiesFor)
  driveTo(p, { vmax = 19, pace = 1 } = {}) {
    this.target = { x: p.x, z: p.z };
    const path = lanePath(this.graph, this.v.pos, this.target, { vmax });
    if (!path) return false;
    const V = this.G.vehicles;
    if (!this.pilot) {
      this.pilot = new Pilot(path, { pace, vmax, keep: 5, bodies: () => (this.G.wheels ? this.G.wheels.bodiesFor(this.v) : V.list.filter((o) => o !== this.v)), overtake: true });
      this.v.driver = this.pilot;
    } else { this.pilot.setPath(path, this.v); this.pilot.o.vmax = vmax; this.pilot.o.pace = pace; }
    this.routeT = 0;
    return true;
  }
  // straight at a point near by (pulling up across my nose: no route round the block)
  driveDirect(p, { vmax = 7 } = {}) {
    const v = this.v, fx = Math.cos(v.yaw), fz = -Math.sin(v.yaw);
    // (a bend: on along its nose a few metres, then to the point)
    const path = samplePath([[v.pos.x, v.pos.z], [v.pos.x + fx * 3, v.pos.z + fz * 3], [p.x, p.z]], { vmax, aLat: 5, aBrake: 5 });
    const V = this.G.vehicles;
    if (!this.pilot) { this.pilot = new Pilot(path, { pace: 1, vmax, keep: 2, bodies: () => (this.G.wheels ? this.G.wheels.bodiesFor(this.v) : V.list.filter((o) => o !== this.v)) }); }
    else { this.pilot.setPath(path, this.v); this.pilot.o.vmax = vmax; }
    this.v.driver = this.pilot;
    this.routeT = 0;
  }
  park() {
    this.v.driver = null;
    const I = this.v.input; I.throttle = 0; I.brake = 1; I.handbrake = 1; I.steer = 0; I.hold = 1;
  }

  // the men out at its doors (spawned at the doors, the doors' sound)
  crewOut(job = 'respond') {
    if (this.crew.length || !this.crewN) return this.crew;
    const P = this.police.P, v = this.v;
    for (let i = 0; i < this.crewN; i++) {
      const side = i % 2 ? 1 : -1;
      const p = v.world(0.2 - Math.floor(i / 2) * 1.4, side * (v.spec.halfW + 0.6), _v);
      const q = p.clone(); this.G.stage.colliders.resolve(q, 0.35);
      const man = P.spawn(this.crewKind || P.copLook(i), q.x, q.z, v.yaw - Math.PI / 2 * side, 'cop');
      man.job = job; man.car = this;
      this.police.cops.push(man);
      this.crew.push(man);
    }
    this.G.sfx.play('tail_door', v.pos.clone().setY(1), { open: true }, { ref: 4 });
    this.police.event('crew', { role: this.role, n: this.crewN });
    return this.crew;
  }

  step(dt) {
    this.t += dt;
    const v = this.v;
    // the siren: a wail while it hunts, a yelp now and then while it searches, quiet parked
    this.sirenT -= dt;
    if (this.sirenT <= 0) {
      const S = this.G.sfx;
      if (this.siren && this.mode !== 'block' && this.mode !== 'stopped') { S.play('o3_siren', v.pos.clone().setY(1.6), { dur: 2.2 }, { ref: 10 }); this.sirenT = 2.15; }
      else if (this.mode === 'search') { S.play('o3_yelp', v.pos.clone().setY(1.6), {}, { ref: 8 }); this.sirenT = 5 + Math.random() * 3; }
      else this.sirenT = 1;
    }
    // the lamp turns (a beacon: bright, dim)
    const pulse = Math.max(0, Math.sin(this.t * 7));
    // [O3] after the critic (m3): a roadblock's beacons are the big ones (twice the
    // patrol dome, flashing) - two red lamps read from 80 m under the street's lamp
    const big = this.mode === 'block' ? 1.9 : 1;
    if (v.policeLamp) v.policeLamp.scale.setScalar(big * (this.mode === 'block' || this.siren || this.mode === 'search' ? 0.85 + 0.3 * pulse : 0.6));
    // stuck: wanting to go and not going (the pilot backs off by itself; this is the give-up)
    const sp = Math.abs(v.speed);
    if (this.pilot && v.driver === this.pilot && this.pilot.want > 3 && sp < 0.6) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    v.step(dt);
  }

  dispose() {
    const V = this.G.vehicles;
    if (V.list.includes(this.v)) V.remove(this.v);
    this.pilot = null;
  }
}
