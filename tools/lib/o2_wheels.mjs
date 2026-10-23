// [O2] NOIR CITY's wheels, played by real input (tools/play.mjs's module driver):
//   { "drive": "tools/lib/o2_wheels.mjs", "mode": "...", "hands": "idle" | "bad" | "medium" | "good", ... }
// Every key and turn is a trusted input event (the player's path); the page is
// only read (where things are), never written.
// modes:
//   park      walk to the parked car ahead of the start (&park=...), E, the break-in, drive off
//   pull      stand in the road, the car with a man at the wheel stops; walk to his door, E;
//             his answer (a civilian runs; a fighter comes back: drive off (good) or fight)
//   witness   break into a parked car with a car passing in sight (seen), and with none (unseen)
//   fare      a taxi: drive to the man hailing, stop, take him where the line says, be paid
//   race      the Yards' race: E at the flag, three laps by the keys
//   drive     the drive-through of every district in the traffic (O1's route), the recorder
//   latency   W, A, SPACE in the car, E at a door, Q: trusted key to the first frame of the act
//   bench     the jank bench: my car into every kind of car and the tram
// hands: the human models - idle (nothing), bad (slow, sloppy, wrong now and then),
// medium (the critic's: slower than good, not clumsy), good (uses what was taught).
const HANDS = {
  idle: { react: 0, steerErr: 0, slow: 1 },
  bad: { react: 900, steerErr: 0.35, slow: 0.75, wrong: 0.15 },
  medium: { react: 520, steerErr: 0.15, slow: 0.88, wrong: 0.03 },
  good: { react: 260, steerErr: 0.05, slow: 1.0, wrong: 0 },
};

export default async function wheels(api) {
  const { opts } = api;
  const H = { ...HANDS[opts.hands || 'good'], name: opts.hands || 'good' };
  const P = prims(api, H);
  P.opts = opts;
  const m = opts.mode;
  if (m === 'park') return park(P, api, H);
  if (m === 'pull') return pull(P, api, H);
  if (m === 'witness') return witness(P, api, H);
  if (m === 'fare') return fare(P, api, H);
  if (m === 'race') return race(P, api, H);
  if (m === 'drive') return drive(P, api, H);
  if (m === 'latency') return latency(P, api, H);
  if (m === 'bench') return bench(P, api, H);
  return { err: 'no mode ' + m };
}

// ---- the hands' primitives -----------------------------------------------------------------------
function prims({ js, turn, keyDown, keyUp, sleep, log }, H) {
  const held = new Set();
  const P = {
    held,
    async set(code, on) { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } },
    async release() { for (const c of [...held]) await P.set(c, false); },
    async tap(code, hold = 70) { await keyDown(code); await sleep(hold); await keyUp(code); },
    state: () => js(`(() => { const C = N.controller, R = G.city || {}, car = R.car; return { x: C.pos.x, z: C.pos.z, yaw: C.yaw, sens: C.sensitivity, mode: C.mode, inCar: !!R.inCar, car: car ? { x: car.pos.x, z: car.pos.z, yaw: car.yaw, v: car.speed, kind: car.kind } : null, prompt: G.hud.promptShown, warn: G.hud.kit && G.hud.kit.warnText, failing: !!G.failing, t: G.time }; })()`),
    // turn the view to face a point (trusted mouse moves)
    async face(x, z, tol = 0.05) {
      for (let i = 0; i < 60; i++) {
        const s = await P.state();
        const want = Math.atan2(-(x - s.x), -(z - s.z));
        const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
        if (Math.abs(err) < tol) return true;
        await turn(Math.round(Math.max(-60, Math.min(60, -err * 0.7 / s.sens))), 0);
        await sleep(30);
      }
      return false;
    },
    // walk to a point by W and the mouse (true when reached)
    async walkTo(x, z, timeout = 20000, near = 0.4) {
      const T = Date.now() + timeout;
      for (;;) {
        const s = await P.state();
        const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
        if (d < near) break;
        if (Date.now() > T) { await P.set('KeyW', false); log(`walk stuck at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) going to (${x}, ${z})`); return false; }
        const want = Math.atan2(-dx, -dz);
        const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
        if (Math.abs(err) > 0.03) await turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0);
        await P.set('KeyW', Math.abs(err) < 0.6);
        await sleep(33);
      }
      await P.set('KeyW', false);
      return true;
    },
    // a car's way by the keys: pure pursuit on a path of points; until(s) ends it
    async driveAlong(path, { until = null, speed = 14, timeout = 120000, onStep = null } = {}) {
      const T0 = Date.now();
      let idx = 0, stuckT = 0, revUntil = 0, last = Date.now();
      for (;;) {
        const now = Date.now(), dt = (now - last) / 1000; last = now;
        const s = await P.state();
        if (!s.inCar || s.failing) { await P.release(); return { end: s.failing ? 'failed' : 'out', idx }; }
        if (until && (await until(s))) { await P.release(); return { end: 'until', idx }; }
        if (now - T0 > timeout) { await P.release(); return { end: 'timeout', idx }; }
        const c = s.car;
        let best = idx, bd = Infinity;
        for (let k = idx; k < Math.min(path.length, idx + 40); k++) { const d = Math.hypot(path[k][0] - c.x, path[k][1] - c.z); if (d < bd) { bd = d; best = k; } }
        idx = best;
        if (idx >= path.length - 2) { await P.release(); return { end: 'done', idx }; }
        const look = Math.min(path.length - 1, idx + Math.round((6 + Math.abs(c.v) * 0.6) / 3));
        const [tx, tz] = path[look];
        const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw);
        let ang = Math.atan2(fx * (tz - c.z) - fz * (tx - c.x), fx * (tx - c.x) + fz * (tz - c.z));
        // (sloppy hands: the wheel a little off now and then)
        if (H.steerErr && Math.random() < 0.1) ang += (Math.random() - 0.5) * H.steerErr;
        const a0 = path[Math.min(path.length - 1, idx + 2)], a1 = path[Math.min(path.length - 1, idx + 6)], a2 = path[Math.min(path.length - 1, idx + 12)];
        const h1 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), h2 = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
        const tn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
        const target = (tn > 0.9 ? 6.5 : tn > 0.4 ? 10 : speed) * H.slow;
        if (Math.abs(c.v) < 0.8 && P.held.has('KeyW')) stuckT += dt; else stuckT = 0;
        if (stuckT > 2.0) { revUntil = now + 1300; stuckT = 0; }
        if (now < revUntil) { await P.set('KeyW', false); await P.set('KeyS', true); await P.set('KeyA', ang > 0); await P.set('KeyD', ang < 0); await sleep(30); continue; }
        const on = Math.abs(ang) > 0.05;
        await P.set('KeyD', on && ang > 0);
        await P.set('KeyA', on && ang < 0);
        const wide = Math.abs(ang) > 1.2;
        await P.set('KeyW', wide ? c.v < 3 : c.v < target - 0.5);
        await P.set('KeyS', c.v > target + 2.5 || (wide && c.v > 4));
        if (onStep) await onStep(s, idx);
        await sleep(25);
      }
    },
    // a stop where I am (S held until stopped)
    async stop() { await P.release(); for (let i = 0; i < 80; i++) { const s = await P.state(); if (!s.inCar || Math.abs(s.car.v) < 0.3) break; await P.set('KeyS', true); await sleep(40); } await P.set('KeyS', false); },
    // a route on the road graph from the car to a point (the right lane), as points
    route: (to, off = 2.0) => js(`(() => {
      const g = G.stage.part('city').graph, c = G.city.car;
      const r = g.route({ x: c.pos.x, z: c.pos.z }, { x: ${to[0]}, z: ${to[1]} });
      if (!r) return null;
      const out = r.pts, D = [];
      for (let i = 0; i + 1 < out.length; i++) { const [ax, az] = out[i], [bx, bz] = out[i + 1]; const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < n; k++) D.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
      D.push(out[out.length - 1]);
      const R = [];
      for (let i = 0; i < D.length; i++) { const a = D[Math.max(0, i - 2)], b = D[Math.min(D.length - 1, i + 2)]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; const S = g.streetAt(D[i][0], D[i][1]); const off = S && S.edge.el && S.d < 1 ? (S.edge.hw + 4.56) / 2 : ${off}; R.push([D[i][0] - dz / L * off, D[i][1] + dx / L * off]); }
      return R; })()`),
  };
  return P;
}

// ---- park: the break-in ------------------------------------------------------------------------------
async function park(P, { js, sleep, log, shot }, H) {
  const T0 = Date.now();
  const b = await js(`(() => { const b = G.wheels.parked.bodies.find((x) => x.rec.bay === -1); if (!b) return null; const c = Math.cos(b.yaw), s = Math.sin(b.yaw); const hw = b.spec.halfW + 0.85; return { x: b.pos.x, z: b.pos.z, kind: b.kind, door: [b.pos.x + -0.3 * c + -hw * s, b.pos.z - -0.3 * s + -hw * c] }; })()`);
  if (!b) return { err: 'no parked car (&park=)' };
  log(`park: the ${b.kind} at (${b.x.toFixed(1)}, ${b.z.toFixed(1)}), its door (${b.door[0].toFixed(1)}, ${b.door[1].toFixed(1)})`);
  if (H.name === 'idle') { await sleep(12000); const s = await P.state(); return { hands: 'idle', inCar: s.inCar, took: false }; }
  await sleep(H.react);
  if (!(await P.walkTo(b.door[0], b.door[1], 25000))) return { err: 'walk' };
  await P.face(b.x, b.z);
  await sleep(H.react * 0.5);
  const pr = (await P.state()).prompt;
  await P.tap('KeyE');
  const t0 = Date.now();
  // (bad hands: turn away in the middle once, and try again)
  if (H.wrong && Math.random() < 0.5 + H.wrong) {
    await sleep(900);
    await P.face(b.x + 8, b.z + 8);
    const c = await js('({ act: !!G.wheels.hijack.act, cancelled: G.wheels.hijack.stats.cancelled })');
    log(`  bad hands looked away: ${JSON.stringify(c)}`);
    await sleep(500);
    await P.face(b.x, b.z);
    await P.tap('KeyE');
  }
  let inT = null;
  for (let i = 0; i < 100; i++) { const s = await P.state(); if (s.inCar) { inT = Date.now() - t0; break; } await sleep(50); }
  if (inT == null) return { err: 'not in', prompt: pr };
  if (shot) await shot('in');
  await sleep(700);
  // drive off up the street
  const s = await P.state();
  const route = await P.route([s.car.x + Math.cos(s.car.yaw) * 120, s.car.z - Math.sin(s.car.yaw) * 120]);
  const r = await P.driveAlong(route || [], { timeout: 25000, until: async (q) => Math.hypot(q.car.x - s.car.x, q.car.z - s.car.z) > 60 });
  const end = await P.state();
  const st = await js('({ ...G.wheels.hijack.stats, crime: G.crime.log.slice(-3) })');
  return { hands: H.name, prompt: pr, inMs: inT, kind: end.car && end.car.kind, drove: +Math.hypot(end.car.x - s.car.x, end.car.z - s.car.z).toFixed(1), end: r.end, stats: st, secs: (Date.now() - T0) / 1000 };
}
// ---- pull: the man at the wheel ---------------------------------------------------------------------
// (&come=<kind>:<who>&held=1: a car comes up the near lane and stops beside the start's car)
async function pull(P, { js, sleep, log, shot }, H) {
  const T0 = Date.now();
  let c = null;
  for (let i = 0; i < 300; i++) {
    c = await js(`(() => { const c = G.wheels.traffic.cars.find((x) => x.stopBy); if (!c) return null; const v = c.v, co = Math.cos(v.yaw), si = Math.sin(v.yaw), hw = v.spec.halfW + 0.85; return { kind: c.kind, who: c.driver.kind, x: v.pos.x, z: v.pos.z, v: v.speed, by: Math.hypot(v.pos.x - c.stopBy.pos.x, v.pos.z - c.stopBy.pos.z), door: [v.pos.x + -0.2 * co + -hw * si, v.pos.z - -0.2 * si + -hw * co] }; })()`);
    if (c && Math.abs(c.v) < 0.2 && c.by < 14) break;
    await sleep(100);
  }
  if (!c) return { err: 'no car came' };
  log(`pull: a ${c.kind} (${c.who}) stopped at (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
  if (H.name === 'idle') {
    await sleep(10000);
    const s = await P.state();
    return { hands: 'idle', inCar: s.inCar, took: false };
  }
  await sleep(H.react);
  if (!(await P.walkTo(c.door[0], c.door[1], 25000))) return { err: 'walk' };
  await P.face(c.x, c.z);
  await sleep(H.react * 0.4);
  const pr = (await P.state()).prompt;
  const look = await js(`(() => { const L = G.wheels.hijack.look(G.city.car); return L ? { what: L.what, db: +L.db.toFixed(2), v: +L.o.speedAbs.toFixed(2) } : null; })()`);
  await P.tap('KeyE');
  let inT = null;
  for (let i = 0; i < 60; i++) { const s = await P.state(); if (s.inCar) { inT = i * 50; break; } await sleep(50); }
  if (inT == null) return { err: 'not in', prompt: pr, look, me: await P.state() };
  if (shot) await shot('pulled');
  const t0 = Date.now();
  const R = { hands: H.name, who: c.who, prompt: pr, inMs: inT };
  // the answer: drive off (good, medium: at once; bad: late) - or sit (opts.sit: the fight)
  const sit = !!(P.opts && P.opts.sit);
  const delay = sit ? 99999 : H.name === 'bad' ? 1900 : H.name === 'medium' ? 900 : 350;
  let warned = null, fight = false;
  for (;;) {
    const s = await P.state();
    const f = await js('({ fight: !!G.brawl.active, warn: G.hud.kit && G.hud.kit.warnText, mode: N.controller.mode })');
    if (f.warn && !warned) warned = { warn: f.warn, at: Date.now() - t0 };
    if (f.fight) { fight = true; break; }
    if (Date.now() - t0 > delay) break;
    if (Date.now() - t0 > 15000) break;
    await sleep(60);
  }
  R.warned = warned;
  if (fight) {
    // the fight by the base's brawl: the tool's fist fight (fightBy) or idle
    R.fight = true;
    return R;
  }
  const s = await P.state();
  if (!s.inCar) { R.end = 'out'; return R; }
  const route = await P.route([s.car.x + Math.cos(s.car.yaw) * 150, s.car.z - Math.sin(s.car.yaw) * 150]);
  const r = await P.driveAlong(route || [], { timeout: 20000, until: async (q) => Math.hypot(q.car.x - s.car.x, q.car.z - s.car.z) > 50 });
  const end = await P.state();
  R.drove = end.car ? +Math.hypot(end.car.x - s.car.x, end.car.z - s.car.z).toFixed(1) : 0;
  R.end = r.end; R.inCar = end.inCar; R.kind = end.car && end.car.kind;
  R.stats = await js('({ ...G.wheels.hijack.stats, men: G.wheels.hijack.men.map((m) => m.state), money: G.save.money, crime: G.crime.log.slice(-2) })');
  R.secs = (Date.now() - T0) / 1000;
  return R;
}
async function witness() { return { err: 'todo' }; }
async function fare() { return { err: 'todo' }; }
// ---- race: the Yards' corner ------------------------------------------------------------------------
// (&car=-444,252,1.5708: in a coupe on the Straight just short of the line)
async function race(P, { js, sleep, log, shot }, H) {
  const T0 = Date.now();
  const site = await js(`(() => { const R = G.wheels.race; return { line: [R.path.pts[0].x, R.path.pts[0].z], s0: R.s0, lap: R.lap, len: R.len, cars: R.cars.length, state: R.state }; })()`);
  log(`race: ${JSON.stringify(site)}`);
  // to the line: creep up to it and stop
  for (let i = 0; i < 200; i++) {
    const s = await P.state();
    const r = await js('({ shown: !!G.wheels.race.shown, state: G.wheels.race.state, cars: G.wheels.race.cars.length })');
    if (r.shown) break;
    await P.set('KeyW', r.cars > 0 && Math.abs(s.car.v) < 3);
    await sleep(60);
    if (i > 10 && Math.abs(s.car.v) < 0.1 && !P.held.has('KeyW')) break;
  }
  await P.stop();
  await sleep(300);
  const pr = (await P.state()).prompt;
  await P.tap('KeyE');
  for (let i = 0; i < 100; i++) { const r = await js('G.wheels.race.state'); if (r === 'run') break; await sleep(60); }
  if (shot) await shot('grid');
  const pts = await js(`(() => { const R = G.wheels.race, P = R.path, out = []; for (let s = R.s0; s < R.s0 + R.len + 40; s += 3) { const p = P.at(s, {}); out.push([p.x, p.z]); } return out; })()`);
  // (bad hands: late off the line; idle: never)
  if (H.name === 'idle') {
    for (let i = 0; i < 600; i++) { const r = await js('G.wheels.race.state'); if (r === 'done' || r === 'idle') break; await sleep(500); }
  } else {
    await sleep(H.react);
    const shots = new Set();
    await P.driveAlong(pts, { speed: H.name === 'good' ? 21 : H.name === 'medium' ? 19 : 16, timeout: 300000,
      until: async () => { const r = await js('G.wheels.race.state'); return r !== 'run'; },
      onStep: async (s, idx) => { if (shot && idx > 20 && !shots.has('a')) { shots.add('a'); await shot('start'); } } });
  }
  await sleep(400);
  const res = await js('({ result: G.wheels.race.result, stats: G.wheels.race.stats, money: G.save.money, others: G.wheels.race.cars.map((c) => +c.s.toFixed(0)), mine: +G.wheels.race.mine.s.toFixed(0), knocks: G.city.car && G.city.car.stats.log, crashes: G.city.car && G.city.car.stats.crashes, damage: G.city.car && +G.city.car.damage.toFixed(2) })');
  return { hands: H.name, prompt: pr, ...res, secs: (Date.now() - T0) / 1000 };
}
async function drive() { return { err: 'todo' }; }
async function latency() { return { err: 'todo' }; }
async function bench() { return { err: 'todo' }; }
