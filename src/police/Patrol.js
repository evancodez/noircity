import * as THREE from 'three';
import { Pilot } from '../vehicles/pilot.js';
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
  const v = G.vehicles.spawn(kind, { at: { x, z }, yaw, lights: true });
  v.police = true;
  // the red lamp on the roof: a small lit dome, the registry's red
  if (!LAMP_MAT) { LAMP_MAT = accentMaterial('blood', { gain: 3.2 }); LAMP_GEO = new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); }
  const lamp = new THREE.Mesh(LAMP_GEO, LAMP_MAT);
  lamp.position.set(-0.1, kind === 'truck' ? 2.75 : 1.62, 0);
  lamp.userData.emitter = true;
  v.body.add(lamp);
  v.policeLamp = lamp;
  return v;
}

// a road route as a line a car can follow: each street's lane to the right
// of the way, the corners met (O1's graph: route() gives the junctions)
export function lanePath(graph, from, to, { vmax = 19, laneK = 1 } = {}) {
  const R = graph.route(from, to);
  if (!R || R.nodes.length < 1) return null;
  const pts = [];
  const N = R.nodes.map((id) => graph.nodeAt(id));
  const lines = [];
  for (let i = 0; i + 1 < N.length; i++) {
    const A = N[i], B = N[i + 1], e = R.edges[i];
    if (!e) continue;
    const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1;
    const ux = dx / L, uz = dz / L, off = (e.lanes && e.lanes[0]) || 2 * laneK;
    // (right of a heading (ux, uz) is (-uz, ux))
    lines.push([[A.x - uz * off, A.z + ux * off], [B.x - uz * off, B.z + ux * off]]);
  }
  // from me onto the first lane: the nearest lane's point
  const L0 = graph.nearestLane(from.x, from.z);
  pts.push([from.x, from.z]);
  if (L0 && lines.length) pts.push([L0.x, L0.z]);
  for (let i = 0; i < lines.length; i++) {
    const [a0, a1] = lines[i];
    if (i === 0) pts.push(a0);
    if (i + 1 < lines.length) {
      const [b0, b1] = lines[i + 1];
      pts.push(meet(a0, a1, b0, b1));
    } else pts.push(a1);
  }
  const Le = graph.nearestLane(to.x, to.z);
  if (Le) pts.push([Le.x, Le.z]);
  // (no point doubled back on itself: a car turning round in the road)
  const clean = [pts[0]];
  for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - clean[clean.length - 1][0], pts[i][1] - clean[clean.length - 1][1]) > 1.5) clean.push(pts[i]);
  if (clean.length < 2) clean.push([to.x, to.z]);
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

  // drive to a point (rebuilt as it moves)
  driveTo(p, { vmax = 19, pace = 1 } = {}) {
    this.target = { x: p.x, z: p.z };
    const path = lanePath(this.graph, this.v.pos, this.target, { vmax });
    if (!path) return false;
    const V = this.G.vehicles;
    if (!this.pilot) {
      this.pilot = new Pilot(path, { pace, vmax, keep: 5, bodies: () => V.list.filter((o) => o !== this.v), overtake: true });
      this.v.driver = this.pilot;
    } else { this.pilot.setPath(path, this.v); this.pilot.o.vmax = vmax; this.pilot.o.pace = pace; }
    this.routeT = 0;
    return true;
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
    if (v.policeLamp) v.policeLamp.scale.setScalar(this.mode === 'block' || this.siren || this.mode === 'search' ? 0.85 + 0.3 * Math.max(0, Math.sin(this.t * 7)) : 0.6);
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
