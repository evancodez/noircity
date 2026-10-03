import * as THREE from 'three';
import { MERCER, GARAGE, NORTHST } from '../../stages/backlot/plan.js';

// Mercer Street's car (lane C6): a sedan coming home to the garage at the
// street's foot - along the cross street at the north end, round the corner
// into Mercer Street (its lamps sweeping the corner), down the street across
// the chase's way where it crosses, and into its garage. It is timed by my
// coming, not by his: set off so it reaches the crossing about when I do at a
// run - over its bonnet (SPACE), or wait a moment for it to pass, or run into
// its side (a stop). It never runs a man down: a man in its lane ahead of it,
// it brakes and stands, honking, until he is out of it. Its slab is
// things.js's 'car'.
//   const S = mercerCar(stage)
//   S.arm(eta)        set it coming, to reach the crossing in eta seconds
//   S.at(z, v)        put it on Mercer Street at z coming at v (a retry)
//   S.step(dt, me)    me: the controller's position
//   S.reset()         round the corner, out of sight, still
const LANE_X = (MERCER.road[0] + MERCER.road[1]) / 2 - 1.75;   // the southbound lane's middle
// ([C6 3rd] where my way crosses its lane: at the corner, as I come up
// Mercer Street and round onto the cross street - it comes round the corner
// at me, its lamps swinging across)
export const CROSS_Z = -136.4;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const VMAX = 9.0;

// its way: west along the cross street's far lane, the corner, south down Mercer Street to the garage
const ROUTE = (() => {
  const zc = (NORTHST.z0 + NORTHST.z1) / 2 - 1.8, R = 5.0;
  const pts = [[64, zc], [LANE_X + R, zc]];
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([LANE_X + R - R * Math.sin(a), zc + R - R * Math.cos(a)]); }
  pts.push([LANE_X, GARAGE.z0 + 2.6]);
  const P = pts.map(([x, z]) => new THREE.Vector2(x, z));
  const s = [0];
  for (let i = 1; i < P.length; i++) s.push(s[i - 1] + P[i].distanceTo(P[i - 1]));
  return { P, s, len: s[s.length - 1] };
})();
function at(s) {
  const { P, s: S } = ROUTE;
  s = Math.max(0, Math.min(ROUTE.len, s));
  let i = 0;
  while (i < P.length - 2 && S[i + 1] < s) i++;
  const k = (s - S[i]) / Math.max(1e-6, S[i + 1] - S[i]);
  const x = P[i].x + (P[i + 1].x - P[i].x) * k, z = P[i].y + (P[i + 1].y - P[i].y) * k;
  // (its heading: a car's yaw, +x local forward: atan2(-dz, dx))
  const yaw = Math.atan2(-(P[i + 1].y - P[i].y), P[i + 1].x - P[i].x);
  return { x, z, yaw };
}
const S_CROSS = (() => { let best = 0; for (let s = 0; s <= ROUTE.len; s += 0.2) if (Math.abs(at(s).z - CROSS_Z) < Math.abs(at(best).z - CROSS_Z) && at(s).x < LANE_X + 0.5) best = s; return best; })();

export function mercerCar(stage) {
  const cars = stage.part('cars');
  const car = cars.mercer;
  const things = stage.part('things');
  const T = things.get('car');
  const G = stage.game;
  const S = { s: 0, v: 0, state: 'parked', honk: 0, armed: false, yaw: Math.PI };
  const pose = () => {
    const p = at(S.s);
    // (round the corner the body turns with it, eased)
    S.yaw += Math.atan2(Math.sin(p.yaw - S.yaw), Math.cos(p.yaw - S.yaw)) * 0.35;
    const x = p.x, z = p.z, yaw = S.yaw;
    car.pos.set(x, 0, z);
    car.yaw = yaw;
    cars.pose(car);
    const c = car.collider;
    if (c) { c.cx = x; c.cz = z; c.angle = yaw; c.c = Math.cos(yaw); c.s = Math.sin(yaw); }
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
    // its slab: its length along its heading, across its width
    const fx = Math.cos(yaw), fz = -Math.sin(yaw);
    T.a.x = x - fx * 2.35; T.a.z = z - fz * 2.35; T.b.x = x + fx * 2.35; T.b.z = z + fz * 2.35;
    T.depth = 1.92;
    T.vel = { x: fx * S.v, z: fz * S.v };
    things.placeCol(T);
  };
  const api = {
    car, S,
    reset() {
      S.s = 0; S.v = 0; S.state = 'parked'; S.armed = false; S.honk = 0; S.yaw = Math.PI;
      car.group.visible = false;
      T.active = false; things.solid(T, false);
      pose();
    },
    // set it coming so it is at the crossing in eta seconds
    arm(eta) {
      if (S.armed) return;
      S.armed = true;
      S.state = 'coming';
      S.v = VMAX;
      S.s = Math.max(0, S_CROSS - VMAX * eta);
      S.yaw = at(S.s).yaw;
      car.group.visible = true;
      T.active = true; things.solid(T, true);
      pose();
      G.sfx.play('w_carComing', car.pos.clone().setY(0.8));
    },
    // on Mercer Street at z, coming at v (a retry of the street)
    at(z, v) {
      let s = S_CROSS;
      for (let k = 0; k < ROUTE.len; k += 0.25) if (Math.abs(at(k).z - z) < 0.3 && at(k).x < LANE_X + 0.5) { s = k; break; }
      S.armed = true; S.state = 'coming'; S.s = s; S.v = v; S.yaw = at(s).yaw; car.group.visible = true; T.active = true; things.solid(T, true); pose();
    },
    step(dt, me) {
      if (S.state === 'parked' || S.state === 'in') return;
      // a man ahead of it in its way: it brakes and stands, honking
      const p = at(S.s), fx = Math.cos(S.yaw), fz = -Math.sin(S.yaw);
      const ahead = (me.x - p.x) * fx + (me.z - p.z) * fz, side = Math.abs((me.x - p.x) * -fz + (me.z - p.z) * fx);
      let want = VMAX;
      // (round the corner: slower)
      const turn = Math.abs(Math.atan2(Math.sin(at(S.s + 4).yaw - p.yaw), Math.cos(at(S.s + 4).yaw - p.yaw)));
      if (turn > 0.2) want = Math.min(want, 5.5);
      if (side < 1.7 && ahead > 1.8 && ahead < 9) want = 0;
      if (ROUTE.len - S.s < 9) want = Math.min(want, Math.max(1.2, (ROUTE.len - S.s) * 0.8));
      const a = want < S.v ? 11 : 3;
      S.v += Math.sign(want - S.v) * Math.min(Math.abs(want - S.v), a * dt);
      S.honk -= dt;
      if (want === 0 && S.honk <= 0) { S.honk = 1.4; G.sfx.play('tail_horn', car.pos.clone().setY(1), { k: 0.4, dur: 0.45, low: 1 }, { ref: 6 }); }
      S.s += S.v * dt;
      if (S.s >= ROUTE.len - 0.05) { S.s = ROUTE.len; S.v = 0; S.state = 'in'; T.active = false; things.solid(T, false); }
      pose();
    },
  };
  api.reset();
  return api;
}
