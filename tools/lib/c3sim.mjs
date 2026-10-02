// Lane C3: the car's physics without a browser (src/vehicles/Car.js on a
// grey grid of walls and posts in Node), for judging the feel by numbers:
// 0 to 50, braking, the turn at each speed, the handbrake's turn, a slide
// let go, walls struck square and glancing, posts, a parked car.
//   node tools/lib/c3sim.mjs [test]
import * as THREE from 'three';
if (process.env.C3DEBUG) globalThis.__c3debug = true;
const { Car } = await import('../../src/vehicles/Car.js');

// a track: boxes and circles on a grid, the bodies, a flat ground
export function makeWorld({ boxes = [], circles = [], parked = [] } = {}) {
  const T = {
    plane: true, boxes, circles, parked, smash: null,
    ground: () => 0,
    statics(x, z, r, out = []) { out.length = 0; for (const b of boxes) if (Math.abs(b.cx - x) < b.hx + b.hz + r + 3 && Math.abs(b.cz - z) < b.hx + b.hz + r + 3) out.push(b); for (const c of circles) if (Math.abs(c.x - x) < r + c.r + 1 && Math.abs(c.z - z) < r + c.r + 1) out.push(c); return out; },
    bodies() { return vehicles.list.concat(parked); },
  };
  const game = { stage: { track: T }, time: 0 };
  const vehicles = { game, list: [] };
  const spawn = (kind, x, z, yaw, speed = 0) => { const v = new Car(vehicles, kind, { group: new THREE.Group() }, { pos: new THREE.Vector3(x, 0, z), yaw }); v.place(v.pos, yaw, speed); vehicles.list.push(v); return v; };
  return { T, game, vehicles, spawn };
}
export const box = (cx, cz, hx, hz, angle = 0, tag = 'wall') => ({ cx, cz, hx, hz, angle, c: Math.cos(angle), s: Math.sin(angle), tag });

// run a car with an input function (t -> { throttle, brake, steer, handbrake }) for secs
export function run(W, v, secs, input, every = 0.25) {
  const dt = 1 / 60, out = [];
  let t = 0, next = 0;
  for (let i = 0; i < secs * 60; i++) {
    Object.assign(v.input, { throttle: 0, brake: 0, steer: 0, handbrake: 0 }, input(t, v));
    v.step(dt);
    for (const o of W.vehicles.list) if (o !== v) o.step(dt);
    W.game.time += dt; t += dt;
    if (t >= next) { next += every; out.push({ t: +t.toFixed(2), x: +v.pos.x.toFixed(2), z: +v.pos.z.toFixed(2), kmh: +(v.speed * 3.6).toFixed(1), yaw: +(v.yaw * 180 / Math.PI).toFixed(1), r: +v.yawRate.toFixed(2), slip: +((v.slipR || 0) * 180 / Math.PI).toFixed(1), dmg: +v.damage.toFixed(2) }); }
  }
  return out;
}

const TESTS = {
  // 0 to 50 and flat out
  accel() {
    const W = makeWorld(); const v = W.spawn('coupe', 0, 0, 0);
    const o = run(W, v, 14, () => ({ throttle: 1 }), 0.5);
    const t50 = o.find((r) => r.kmh >= 50), t30 = o.find((r) => r.kmh >= 30);
    return { t30: t30 && t30.t, t50: t50 && t50.t, top: Math.max(...o.map((r) => r.kmh)), at6: o.find((r) => r.t >= 6).kmh };
  },
  brake() {
    const W = makeWorld(); const v = W.spawn('coupe', 0, 0, 0, 50 / 3.6);
    const o = run(W, v, 4, () => ({ brake: 1 }), 0.1);
    const stop = o.find((r) => r.kmh <= 0.5);
    return { stopT: stop && stop.t, dist: stop && stop.x };
  },
  // steady full lock at a speed: the radius, the lateral g
  turn() {
    const res = {};
    for (const kmh of [20, 30, 40, 50, 60]) {
      const W = makeWorld(); const v = W.spawn('coupe', 0, 0, 0, kmh / 3.6);
      const sp = kmh / 3.6;
      run(W, v, 3, (t, c) => ({ steer: 1, throttle: c.speed < sp ? 0.6 : 0 }), 1);
      const r = Math.abs(v.speed / (v.yawRate || 1e-6));
      res[kmh] = { R: +r.toFixed(1), g: +((v.speed * v.yawRate) / 9.8).toFixed(2), kmhNow: +(v.speed * 3.6).toFixed(0), slipR: +((v.slipR || 0) * 57.3).toFixed(1) };
    }
    return res;
  },
  // a step of steer at 40: how quick the car answers
  response() {
    const W = makeWorld(); const v = W.spawn('coupe', 0, 0, 0, 40 / 3.6);
    const o = run(W, v, 1.2, (t) => ({ steer: t > 0.1 ? 1 : 0, throttle: 0.4 }), 0.05);
    const rMax = Math.max(...o.map((r) => Math.abs(r.r)));
    const t63 = o.find((r) => Math.abs(r.r) >= 0.63 * rMax);
    return { rMax, t63: t63 && +(t63.t - 0.1).toFixed(2) };
  },
  // the handbrake at 40 with the wheel over: how far round, how fast after
  handbrake() {
    const res = {};
    for (const kmh of [30, 40, 50]) {
      const W = makeWorld(); const v = W.spawn('coupe', 0, 0, 0, kmh / 3.6);
      const o = run(W, v, 2.2, (t) => ({ steer: t > 0.05 ? 1 : 0, handbrake: t > 0.1 && t < 0.75 ? 1 : 0, throttle: t > 0.9 ? 0.7 : 0 }), 0.1);
      const at = (tt) => o.find((r) => r.t >= tt);
      res[kmh] = { yaw07: at(0.7).yaw, yaw12: at(1.2).yaw, yaw22: at(2.1).yaw, kmh12: at(1.2).kmh, end: o[o.length - 1] };
    }
    return res;
  },
  // a slide let go: trail-brake into a corner, then hands off: does it come back?
  slide() {
    const W = makeWorld(); const v = W.spawn('coupe', 0, 0, 0, 55 / 3.6);
    const o = run(W, v, 4, (t) => (t < 1.2 ? { steer: 1, brake: t < 0.6 ? 0.8 : 0, throttle: t > 0.6 ? 1 : 0 } : {}), 0.2);
    return { maxSlip: Math.max(...o.map((r) => Math.abs(r.slip))), yaw: o.map((r) => r.yaw), end: o[o.length - 1] };
  },
  // power: full throttle and full lock from 15 km/h
  power() {
    const W = makeWorld(); const v = W.spawn('coupe', 0, 0, 0, 15 / 3.6);
    const o = run(W, v, 3, () => ({ steer: 1, throttle: 1 }), 0.25);
    return { maxSlip: Math.max(...o.map((r) => Math.abs(r.slip))), o: o.map((r) => [r.t, r.kmh, r.yaw, r.slip]) };
  },
  // a wall struck square at 20 and 60, and glancing at 60
  walls() {
    const res = {};
    for (const [kmh, ang] of [[20, 0], [40, 0], [60, 0], [60, 1.0], [60, 1.25], [60, 1.4]]) {
      const W = makeWorld({ boxes: [box(30, 0, 1, 40)] });
      const v = W.spawn('coupe', 10, 0, -ang, kmh / 3.6);
      const o = run(W, v, 3, () => ({ throttle: 0.3 }), 0.1);
      const c = o.find((r, i) => i > 0 && r.kmh < o[i - 1].kmh - 3);
      res[`${kmh}@${ang}`] = { after: c ? o[o.indexOf(c) + 2] : null, dmg: v.damage.toFixed(2), crashes: v.stats.crashes, scrapes: v.stats.scrapes, end: o[o.length - 1] };
    }
    return res;
  },
  // into a car parked, and into a moving one from behind
  cars() {
    const res = {};
    {
      const W = makeWorld(); const v = W.spawn('coupe', 0, 0, 0, 40 / 3.6);
      const o = W.spawn('sedan', 14, 0.6, 0, 0); o.frozen = false;
      run(W, v, 2, () => ({}), 0.5);
      res.rearEnd = { me: (v.speed * 3.6).toFixed(0), him: (o.speed * 3.6).toFixed(0), himPos: o.pos.x.toFixed(1), dmg: v.damage.toFixed(2) };
    }
    return res;
  },
};

const which = process.argv[2] || 'all';
for (const [k, f] of Object.entries(TESTS)) if (which === 'all' || which === k) console.log(k, JSON.stringify(f()));
