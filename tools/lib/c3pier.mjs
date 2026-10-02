// Lane C3: phase c without a browser - his wreck wherever it may lie on the
// river road (along it, across it, by the el's columns, against the rail),
// my car stopped near it at a slant, and the good hands drive on round it
// to the pier's gate. Each must get there (the road past a wreck is never
// shut, the hands never wedge on it).
//   node tools/lib/c3pier.mjs [verbose-case-index]
import * as THREE from 'three';
const { makeCity } = await import('./c3city.mjs');
const P = await import('../../src/stages/city/plan.js');
const BOT = await import(process.env.BOT || '../../src/scenes/tail/bot.js');

const cases = [];
for (let z = -150; z <= 130; z += 20) {
  for (const d of [-4.2, -1.5, 1.5, 4.2]) for (const turn of [0.7, 1.57, -1.0]) for (const me of ['behind', 'slant', 'touch']) cases.push({ z, d, turn, me });
}

function run(c, verbose = false) {
  const W = makeCity();
  const s = P.riverSAtZ(c.z), f = P.riverFrame(s, {});
  const hp = P.riverPoint(s, c.d);
  const his = W.spawn('sedan', hp.x, hp.z, f.yaw + c.turn, 0);
  his.frozen = true;
  // mine: stopped 9 to 14 m behind it, straight or at a slant toward it
  // ('touch': my nose against his side or his back, as a ram leaves it)
  const back = c.me === 'slant' ? 9 : c.me === 'touch' ? 0 : 14;
  let mp = P.riverPoint(s - back, c.me === 'slant' ? -c.d * 0.3 : 1.9);
  let yaw = c.me === 'behind' ? f.yaw : Math.atan2(-(hp.z - mp.z), hp.x - mp.x);
  if (c.me === 'touch') {
    // from the road's middle toward him, stopped where my nose meets his box
    const o = P.riverPoint(s - 12, 0.65);
    yaw = Math.atan2(-(hp.z - o.z), hp.x - o.x);
    const fx = Math.cos(yaw), fz = -Math.sin(yaw);
    let k = 0;
    const hb = his.box();
    const inside = (x, z) => { const lx = (x - hb.cx) * hb.c - (z - hb.cz) * hb.s, lz = (x - hb.cx) * hb.s + (z - hb.cz) * hb.c; return Math.abs(lx) < hb.hx + 0.05 && Math.abs(lz) < hb.hz + 0.05; };
    while (k < 12 && !inside(o.x + fx * (k + 2.5), o.z + fz * (k + 2.5))) k += 0.1;
    mp = { x: o.x + fx * k, z: o.z + fz * k };
  }
  const my = W.spawn('coupe', mp.x, mp.z, yaw, 0);
  W.vehicles.player = my; W.game.vehicles = W.vehicles;
  // (a start inside a column or a wall is the harness's, not the game's)
  for (const k of W.T.statics(my.pos.x, my.pos.z, 3, [])) { if (k.r != null && !k.gone && Math.hypot(k.x - my.pos.x, k.z - my.pos.z) < k.r + 1.2) return { skip: true }; }
  const ch = { phase: 'c', t: 0, my, his, driver: { state: 'stopped' }, bodies: () => W.T.bodies(), gap: () => Math.hypot(his.pos.x - my.pos.x, his.pos.z - my.pos.z) };
  const B = BOT.makeBot(ch, 'good', { seed: 7, track: W.T });
  const dt = 1 / 60;
  for (let i = 0; i < 90 * 60; i++) {
    ch.t += dt; W.game.time += dt;
    const k = B.tick(dt);
    my.input.throttle = k.W ? 1 : 0; my.input.brake = k.S ? 1 : 0; my.input.steer = (k.A ? 1 : 0) - (k.D ? 1 : 0); my.input.handbrake = k.Space ? 1 : 0;
    my.step(dt);
    if (verbose && i % 30 === 0) console.log(ch.t.toFixed(1), my.pos.x.toFixed(1), my.pos.z.toFixed(1), (my.yaw * 57.3).toFixed(0), (my.speed * 3.6).toFixed(0), JSON.stringify(k), B.pierSide);
    const dp = Math.hypot(my.pos.x - P.PIER.park.x, my.pos.z - P.PIER.park.z);
    if (dp < 11 && my.speedAbs < 0.6) return { ok: true, t: +ch.t.toFixed(1), side: B.pierSide };
  }
  return { ok: false, at: [+my.pos.x.toFixed(1), +my.pos.z.toFixed(1)], side: B.pierSide };
}

const only = process.argv[2];
if (only != null) { console.log(cases[+only], run(cases[+only], true)); process.exit(0); }
let fails = 0, n = 0, worst = 0;
cases.forEach((c, i) => {
  const r = run(c);
  if (r.skip) return;
  n++;
  if (!r.ok) { fails++; console.log('STUCK', i, JSON.stringify(c), JSON.stringify(r)); } else worst = Math.max(worst, r.t);
});
console.log(`${n - fails} / ${n} reached the pier (slowest ${worst} s)`);
