import * as THREE from 'three';
import { MERCER, GARAGE } from '../../stages/backlot/plan.js';

// Mercer Street's car (lane C6): a sedan coming down the street out of the
// fog to its garage at the street's foot, across the chase's way where it
// crosses the street. It is timed by my coming, not by his: started so it
// reaches the crossing about when I do at a run - over its bonnet (SPACE),
// or wait a moment for it to pass, or run into its side (a stop). It never
// runs a man down: a man in its lane ahead of it, it brakes and stands,
// honking, until he is out of it. Its slab is things.js's 'car'.
//   const S = mercerCar(stage)
//   S.arm(eta)        set it coming, to reach the crossing in eta seconds
//   S.at(z, v)        put it at z coming at v (a retry of the street)
//   S.step(dt, me)    me: the controller (its position)
//   S.reset()         back in its garage, lamps on, still
const LANE_X = (MERCER.road[0] + MERCER.road[1]) / 2 - 1.75;   // the southbound lane's middle
export const CROSS_Z = -117.4;
const START_Z = -168;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function mercerCar(stage) {
  const cars = stage.part('cars');
  const car = cars.mercer;
  const things = stage.part('things');
  const T = things.get('car');
  const G = stage.game;
  const S = { z: START_Z, v: 0, vWant: 9, state: 'parked', honk: 0, armed: false };
  const yaw = -Math.PI / 2;   // heading south (+z)
  const pose = () => {
    // down the street's southbound lane; at its foot, into the garage
    const x = LANE_X, z = S.z;
    car.pos.set(x, 0, z);
    car.yaw = yaw;
    cars.pose(car);
    const c = car.collider;
    if (c) { c.cx = x; c.cz = z; c.angle = yaw; c.c = Math.cos(yaw); c.s = Math.sin(yaw); }
    // the lamps ride with it
    const g = car.group;
    g.updateMatrixWorld(true);
    const toW = (v) => v.clone().applyMatrix4(g.matrixWorld);
    const fwd = V(1, -0.1, 0).normalize().transformDirection(g.matrixWorld);
    if (car.spot) { car.spot.position.copy(toW(V(2.75, 1.0, 0))); car.spot.target.position.copy(toW(V(14, -0.4, 0))); car.spot.target.updateMatrixWorld(); }
    for (const cone of car.cones || []) {
      const apex = toW(V(2.34, 0.98, cone.userData.side * 0.6));
      cone.position.copy(apex);
      cone.quaternion.setFromUnitVectors(V(0, -1, 0), fwd);
      if (cone.material.uniforms.uApex) cone.material.uniforms.uApex.value.copy(apex);
      if (cone.material.uniforms.uAxis) cone.material.uniforms.uAxis.value.copy(fwd);
    }
    if (car.entry) { car.entry.position.copy(toW(V(2.2, 1.05, 0))); car.entry.direction.copy(fwd); }
    // its slab: the side I come at (the east), its length along the street
    T.a.x = T.b.x = x; T.a.z = z - 2.35; T.b.z = z + 2.35;
    T.depth = 1.92;
    T.vel = { x: 0, z: S.v };
    things.placeCol(T);
  };
  const api = {
    car, S,
    reset() {
      S.z = START_Z; S.v = 0; S.state = 'parked'; S.armed = false; S.honk = 0;
      car.group.visible = false;
      T.active = false; things.solid(T, false);
      pose();
    },
    // set it coming so it is at the crossing in eta seconds
    arm(eta) {
      if (S.armed) return;
      S.armed = true;
      S.state = 'coming';
      S.v = 9.0;
      S.z = Math.max(START_Z - 40, CROSS_Z - S.v * eta);
      car.group.visible = true;
      T.active = true; things.solid(T, true);
      pose();
      G.sfx.play('w_carComing', car.pos.clone().setY(0.8));
    },
    at(z, v) { S.armed = true; S.state = 'coming'; S.z = z; S.v = v; car.group.visible = true; T.active = true; things.solid(T, true); pose(); },
    step(dt, me) {
      if (S.state === 'parked' || S.state === 'in') return;
      // a man ahead of it in its lane: it brakes and stands, honking
      const ahead = me.z - S.z;
      const inLane = Math.abs(me.x - LANE_X) < 1.6;
      let want = 9.0;
      if (inLane && ahead > 2.0 && ahead < 9) want = 0;
      if (S.z > GARAGE.z0 - 9) want = Math.min(want, Math.max(1.2, (GARAGE.z0 + 2.5 - S.z) * 0.8));
      const a = want < S.v ? 11 : 3;
      S.v += Math.sign(want - S.v) * Math.min(Math.abs(want - S.v), a * dt);
      S.honk -= dt;
      if (want === 0 && S.honk <= 0) { S.honk = 1.4; G.sfx.play('tail_horn', car.pos.clone().setY(1), { k: 0.4, dur: 0.45, low: 1 }, { ref: 6 }); }
      S.z += S.v * dt;
      if (S.z >= GARAGE.z0 + 2.6) { S.z = GARAGE.z0 + 2.6; S.v = 0; S.state = 'in'; T.active = false; things.solid(T, false); }
      pose();
    },
  };
  api.reset();
  return api;
}
