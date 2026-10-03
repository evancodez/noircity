// Lane C3: the jank drive, headless (WAVE_C §7.5, the brief §4): my car
// into every kind of thing in the city at 20 and at 60 km/h - a building's
// wall, an el column, a lamp post, a parked car, the river's rail, the rail
// yard's fence, the canal's rail and the bridge's barrier, the depot's wall,
// the pier's gate, a car head-on and from behind - W held two seconds into
// it, then S held to reverse out. Each must be: never through (the car's box
// never more than a hand into the thing), never stuck (reversing takes it
// back out), never launched (no runaway speed or spin, nothing NaN).
//   node tools/lib/c3jank.mjs
import * as THREE from 'three';
const { makeCity } = await import('./c3city.mjs');
const P = await import('../../src/stages/city/plan.js');
const { segBox } = await import('../../src/stages/city/parts/track.js');

const W0 = makeCity();
const T0 = W0.T;
// a target of each kind: a point on it and the way to drive at it (yaw)
const targets = [];
{
  // a building wall: Cooper St's west facade, driving west into it
  targets.push({ name: 'wall', x: P.NS.cooper.x - P.NS.cooper.hw - P.NS.cooper.p, z: -60, yaw: Math.PI });
  // an el column on the avenue
  const col = T0.circles.find((c) => c.tag === 'column' && c.z > -200 && c.z < -120);
  targets.push({ name: 'column', x: col.x, z: col.z, yaw: Math.PI / 2 });
  // a lamp post
  const post = T0.circles.find((c) => c.tag === 'post' && c.z > -200 && c.z < -120 && Math.abs(c.x - P.NS.baxter.x) < 8);
  targets.push({ name: 'post', x: post.x, z: post.z, yaw: Math.PI / 2 });
  // a parked car
  const pk = T0.parked.find((b) => b.pos.z > -90 && b.pos.z < -50 && Math.abs(b.pos.x - P.NS.cooper.x) < 6);
  targets.push({ name: 'parked', x: pk.pos.x, z: pk.pos.z, yaw: Math.PI / 2, side: true });
  // the river's rail (east of the river road)
  { const s = P.riverSAtZ(-100), p = P.riverPoint(s, -P.RIVER.rail); targets.push({ name: 'river rail', x: p.x, z: p.z, yaw: 0 }); }
  targets.push({ name: 'yard fence', x: P.YARD_X, z: -40, yaw: Math.PI });
  targets.push({ name: 'canal rail', x: P.NS.baxter.x + 20, z: P.CANAL.z0, yaw: Math.PI / 2 });
  targets.push({ name: 'bridge barrier', x: P.BRIDGE.x, z: P.CANAL.z0 - 0.9, yaw: Math.PI / 2 });
  targets.push({ name: 'depot wall', x: -60, z: P.DEPOT_Z, yaw: -Math.PI / 2 });
  targets.push({ name: 'pier gate', x: P.PIER.gate.x, z: P.PIER.gate.z, yaw: 0 });
  targets.push({ name: 'roadworks', x: P.NS.baxter.x, z: P.ROADWORKS.z0 + 3, yaw: -Math.PI / 2 });
  targets.push({ name: 'car head-on', car: 'head', x: P.NS.water.x, z: -60, yaw: Math.PI / 2 });
  targets.push({ name: 'car from behind', car: 'behind', x: P.NS.water.x, z: -60, yaw: Math.PI / 2 });
}

function run(t, kmh) {
  const W = makeCity();
  const dir = [Math.cos(t.yaw), -Math.sin(t.yaw)];
  const back = 5.5;   // (placed at speed, 8 m off it: the streets are narrow)
  let sx = t.x - dir[0] * (back + 2.5), sz = t.z - dir[1] * (back + 2.5);
  if (t.side) { sx += Math.sin(t.yaw) * 1.2; sz += Math.cos(t.yaw) * 1.2; }
  const my = W.spawn('coupe', sx, sz, t.yaw, kmh / 3.6);
  W.vehicles.player = my;
  let other = null;
  if (t.car === 'head') other = W.spawn('sedan', t.x + dir[0] * 6, t.z + dir[1] * 6, t.yaw + Math.PI, 6);
  if (t.car === 'behind') other = W.spawn('sedan', t.x, t.z, t.yaw, 2);
  const dt = 1 / 60;
  let maxPen = 0, maxSp = 0, bad = null;
  const pen = () => {
    // the deepest my box goes into a wall's box (the statics'), m
    let worst = 0;
    const c = Math.cos(my.yaw), s = Math.sin(my.yaw);
    for (const k of W.T.statics(my.pos.x, my.pos.z, 4, [])) {
      if (k.r != null) { if (k.gone) continue; const l = my.local(new THREE.Vector3(k.x, 0, k.z)); const qx = Math.max(-2.45, Math.min(2.45, l.x)), qz = Math.max(-0.94, Math.min(0.94, l.z)); const d = Math.hypot(l.x - qx, l.z - qz); if (l.x === qx && l.z === qz) worst = Math.max(worst, k.r + Math.min(2.45 - Math.abs(l.x), 0.94 - Math.abs(l.z))); else worst = Math.max(worst, k.r - d); continue; }
      // corners of my box inside its box
      for (const [ax, az] of [[2.45, 0.94], [2.45, -0.94], [-2.45, 0.94], [-2.45, -0.94]]) {
        const x = my.pos.x + ax * c + az * s, z = my.pos.z - ax * s + az * c;
        const lx = (x - k.cx) * k.c - (z - k.cz) * k.s, lz = (x - k.cx) * k.s + (z - k.cz) * k.c;
        if (Math.abs(lx) < k.hx && Math.abs(lz) < k.hz) worst = Math.max(worst, Math.min(k.hx - Math.abs(lx), k.hz - Math.abs(lz)));
      }
    }
    return worst;
  };
  const step = (I) => {
    Object.assign(my.input, { throttle: 0, brake: 0, steer: 0, handbrake: 0 }, I);
    my.step(dt); if (other) { other.input.throttle = 0.4; other.step(dt); }
    W.game.time += dt;
    if (!Number.isFinite(my.pos.x) || !Number.isFinite(my.yaw)) bad = 'NaN';
    maxSp = Math.max(maxSp, my.speedAbs);
    if (Math.abs(my.yawRate) > 8) bad = bad || 'spin ' + my.yawRate.toFixed(1);
    maxPen = Math.max(maxPen, pen());
  };
  for (let i = 0; i < 120; i++) step({ throttle: 1 });
  // (out: from where it stood still on the brake - a glance may carry it on
  // past the thing first; then two seconds of S)
  let hit = null;
  for (let i = 0; i < 300 && !hit; i++) { step({ brake: 1 }); if (my.speed <= 0.05) hit = my.pos.clone(); }
  for (let i = 0; i < 120; i++) step({ brake: 1 });
  const out = hit ? Math.hypot(my.pos.x - hit.x, my.pos.z - hit.z) : 0;
  return { pen: +maxPen.toFixed(2), out: +out.toFixed(1), maxKmh: +(maxSp * 3.6).toFixed(0), dmg: +my.damage.toFixed(2), bad };
}

let fails = 0;
for (const t of targets) for (const kmh of [20, 60]) {
  const r = run(t, kmh);
  // (never through: a hand's depth; never stuck: back out at least 1.5 m;
  // never launched: no faster than flat out, nothing NaN, no wild spin)
  const ok = r.pen < 0.25 && r.out > 1.5 && r.maxKmh < 80 && !r.bad;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t.name.padEnd(16)} ${String(kmh).padStart(2)} km/h  pen ${r.pen} m  out ${r.out} m  max ${r.maxKmh} km/h  dmg ${r.dmg}${r.bad ? '  ' + r.bad : ''}`);
}
console.log(fails ? `${fails} failed` : 'all passed');
void segBox;
