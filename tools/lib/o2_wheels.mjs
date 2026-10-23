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
    async driveAlong(path, { until = null, speed = 14, timeout = 120000, onStep = null, traffic = false, pass = false } = {}) {
      const T0 = Date.now();
      let idx = 0, stuckT = 0, revUntil = 0, last = Date.now(), slowT = 0, passSide = 0, passUntil = 0, blockT = 0, roundUntil = 0;
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
        let [tx, tz] = path[look];
        // (a racer's pass: a car ahead in my line - out to the side it is not on, by the line's normal, till by it)
        if (now > passUntil) passSide = 0;
        if (pass) {
          const ah = await js(`(() => { const c = G.city.car, ca = Math.cos(c.yaw), sa = Math.sin(c.yaw); let best = null; for (const o of G.wheels.bodies()) { if (o === c || !o.spec || o.parked) continue; const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z; if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue; const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca; if (lx > -3 && lx < 22 && Math.abs(lz) < 2.7 && (!best || lx < best.lx)) best = { lx, lz }; } return best; })()`);
          if (ah) { if (!passSide) passSide = ah.lz < -0.3 ? 1 : -1; passUntil = now + 1500; }
        }
        {
          if (passSide) {
            const q0 = path[Math.max(0, look - 1)], q1 = path[Math.min(path.length - 1, look + 1)];
            const ux = q1[0] - q0[0], uz = q1[1] - q0[1], ul = Math.hypot(ux, uz) || 1;
            tx += passSide * 2.9 * (-uz / ul); tz += passSide * 2.9 * (ux / ul);
          }
        }
        const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw);
        let ang = Math.atan2(fx * (tz - c.z) - fz * (tx - c.x), fx * (tx - c.x) + fz * (tz - c.z));
        // (sloppy hands: the wheel a little off now and then)
        if (H.steerErr && Math.random() < 0.1) ang += (Math.random() - 0.5) * H.steerErr;
        const a0 = path[Math.min(path.length - 1, idx + 2)], a1 = path[Math.min(path.length - 1, idx + 6)], a2 = path[Math.min(path.length - 1, idx + 12)];
        const h1 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), h2 = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
        const tn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
        let target = (tn > 0.9 ? 6.5 : tn > 0.4 ? 10 : speed) * H.slow;
        // (a path with its speeds: what it allows a little ahead, the hands' share of it)
        if (path[idx] && path[idx].length > 2) { let vv = 99; for (let k = idx; k < Math.min(path.length, idx + 4); k++) vv = Math.min(vv, path[k][2]); target = Math.min(speed, vv * 1.15) * H.slow; }
        // (a car in my lane ahead: kept off it, stopped behind it)
        if (traffic) {
          const [am, ap] = await js(`(() => { const c = G.city.car, ca = Math.cos(c.yaw), sa = Math.sin(c.yaw); let bm = 99, bp = 99; for (const o of G.wheels.bodies()) { if (o === c || !o.spec) continue; const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z; if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue; const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca; if (lx > 1 && lx < 28 && Math.abs(lz) < o.spec.halfW + (o.parked ? 0.45 : 1.25)) { const d = lx - o.spec.halfL - 2.45; if (o.parked) bp = Math.min(bp, d); else bm = Math.min(bm, d); } } return [bm, bp]; })()`);
          // (stood behind a parked car: round it - out to the left, slow, the moving ones still minded)
          const rounding = now < roundUntil;
          const ah = rounding ? am : Math.min(am, ap);
          if (rounding) target = Math.min(target, 4);
          if (!rounding && ap < 4 && ap <= am && Math.abs(c.v) < 0.5) { blockT += dt; if (blockT > 2.5) { blockT = 0; roundUntil = now + 4500; passSide = -1; passUntil = now + 4500; } } else blockT = 0;
          if (ah < 30) target = Math.min(target, Math.max(0, (ah - 4) * 0.6));
          if (ah < 3) target = 0;
          if (ah < 4 && Math.abs(c.v) < 0.5) stuckT = 0;
        }
        // (stood a long while: say why, once each 8 s - the proofs' trace)
        slowT = Math.abs(c.v) < 0.5 ? slowT + dt : 0;
        if (slowT > 8) { slowT = 0; log('    stood 8 s: ' + JSON.stringify(await js(`(() => { const c = G.city.car, ca = Math.cos(c.yaw), sa = Math.sin(c.yaw); const near = []; for (const o of G.wheels.bodies()) { if (o === c || !o.spec) continue; const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z; if (Math.hypot(dx, dz) > 25) continue; const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca; const tc = G.wheels.traffic.cars.find((t) => t.v === o); near.push({ k: o.kind, p: !!o.parked, lx: +lx.toFixed(1), lz: +lz.toFixed(1), v: +o.speed.toFixed(1), st: tc ? tc.state : null, why: tc ? tc.why : null, sig: tc ? tc.atSignal : null, stop: tc && tc.pilot ? tc.pilot.o.stopAt : null }); } return { at: [+c.pos.x.toFixed(1), +c.pos.z.toFixed(1), +c.yaw.toFixed(2)], idx: ${idx}, n: ${path.length}, near }; })()`))); }
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
    route: (to, off = null) => js(`(() => { const c = G.city.car; const r = G.wheels.pathFor({ x: c.pos.x, z: c.pos.z }, { x: ${to[0]}, z: ${to[1]} }, ${off != null ? `{ off: ${off} }` : '{}'}); return r ? r.pts : null; })()`),
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
  // (the line read before E: up to a second for it to come)
  let pr = '';
  for (let i = 0; i < 20 && !pr; i++) { pr = (await P.state()).prompt; if (!pr) await sleep(50); }
  await P.tap('KeyE');
  const t0 = Date.now();
  // (bad hands: turn away in the middle once, and try again)
  if (H.name === 'bad') {
    await sleep(900);
    const me = await P.state();
    await P.face(me.x + (me.x - b.x) * 3, me.z + (me.z - b.z) * 3);
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
  if (P.opts.strip && shot) await shot('strip_0');
  await P.tap('KeyE');
  if (P.opts.strip && shot) for (let k = 1; k <= P.opts.strip; k++) { await sleep(150); await shot('strip_' + k); }
  let inT = null;
  for (let i = 0; i < 60; i++) { const s = await P.state(); if (s.inCar) { inT = i * 50; break; } await sleep(50); }
  if (inT == null) return { err: 'not in', prompt: pr, look, me: await P.state() };
  // (no frame taken here: a screenshot stalls the page a second - the hands would be that late)
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
    if (f.fight) { fight = true; R.fightAt = Date.now() - t0; break; }
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
  await P.set('KeyW', true);
  const route = await P.route([s.car.x + Math.cos(s.car.yaw) * 150, s.car.z - Math.sin(s.car.yaw) * 150]);
  const r = await P.driveAlong(route || [], { timeout: 20000, until: async (q) => Math.hypot(q.car.x - s.car.x, q.car.z - s.car.z) > 50 });
  const end = await P.state();
  R.drove = end.car ? +Math.hypot(end.car.x - s.car.x, end.car.z - s.car.z).toFixed(1) : 0;
  R.end = r.end; R.inCar = end.inCar; R.kind = end.car && end.car.kind;
  R.stats = await js('({ ...G.wheels.hijack.stats, men: G.wheels.hijack.men.map((m) => m.state), money: G.save.money, crime: G.crime.log.slice(-2) })');
  R.crime = R.stats.crime;
  R.secs = (Date.now() - T0) / 1000;
  return R;
}
// ---- witness: the break-in seen, and unseen ------------------------------------------------------------------
// (with &come=coupe&held=1 a car stands by in the lane while I break in: its
// man sees; with &notraffic=1 nobody is about: the event is logged unseen)
async function witness(P, api, H) {
  const { js, sleep } = api;
  if (P.opts.waitCar) for (let i = 0; i < 400; i++) { const c = await js('G.wheels.traffic.cars.some((c) => c.stopBy && Math.abs(c.v.speed) < 0.3 && Math.hypot(c.v.pos.x - c.stopBy.pos.x, c.v.pos.z - c.stopBy.pos.z) < 14)'); if (c) break; await sleep(100); }
  const r = await park(P, api, H);
  const log = await js('G.crime.log.slice()');
  return { ...r, log };
}
// ---- fare: the taxi's fares (&ckind=taxi: the start's car is a cab) ----------------------------------------
// opts.fares: how many to take; idle: the first one in, then nothing (he
// says Come on., and gets out); bad: sloppy hands and a knock into the kerb's
// things now and then; medium, good: there and paid
async function fare(P, { js, sleep, log, shot }, H) {
  const T0 = Date.now();
  const st0 = await P.state();
  if (!st0.inCar) { await P.tap('KeyE'); await sleep(1400); }
  const out = [];
  const n = P.opts.fares || 2;
  for (let k = 0; k < n; k++) {
    // the hail: wait for it (it comes on the street ahead)
    let F = null;
    for (let i = 0; i < 300; i++) { F = await js(`(() => { const f = G.wheels.fares; if (f.state !== 'hail' || !f.fare.c) return null; const p = f.fare.c.fig.pos; return { x: p.x, z: p.z, dest: f.fare.dest }; })()`); if (F) break; await sleep(100); if (i % 50 === 49) { const s = await P.state(); const r = await P.route([s.car.x + Math.cos(s.car.yaw) * 90, s.car.z - Math.sin(s.car.yaw) * 90]); await P.driveAlong(r || [], { timeout: 8000, traffic: true, until: async () => !!(await js("G.wheels.fares.state === 'hail'")) }); await P.stop(); } }
    if (!F) { out.push({ err: 'no hail' }); break; }
    log(`fare ${k}: a hail at (${F.x.toFixed(0)}, ${F.z.toFixed(0)}) for ${F.dest.name}`);
    await sleep(H.react);
    // to him: along the road to a stop by him
    // (to him: along the roads - again if a car or a light held me short of him)
    for (let tries = 0; tries < 4; tries++) {
      const s0 = await P.state();
      if (Math.hypot(s0.car.x - F.x, s0.car.z - F.z) < 8) break;
      const r1 = await P.route([F.x, F.z]);
      const rr = await P.driveAlong(r1 || [], { timeout: 70000, speed: 11, traffic: true, until: async (s) => Math.hypot(s.car.x - F.x, s.car.z - F.z) < 7.5 });
      await P.stop();
      const s1 = await P.state();
      log(`  to the fare: ${rr.end}, ${r1 ? r1.length : 0} points, ${Math.hypot(s1.car.x - F.x, s1.car.z - F.z).toFixed(1)} m off him`);
      if ((await js('G.wheels.fares.state')) !== 'hail') break;
    }
    if (shot && k === 0) await shot('hail');
    // (good hands say it: E, when the line says so; the others wait the two seconds)
    if (H.name === 'good') { for (let i = 0; i < 20; i++) { const s = await P.state(); if (s.prompt === 'E  take him') { await P.tap('KeyE'); break; } if ((await js('G.wheels.fares.state')) !== 'hail') break; await sleep(100); } }
    let inside = false;
    for (let i = 0; i < 80; i++) { const s = await js('G.wheels.fares.state'); if (s === 'in') { inside = true; break; } await sleep(100); }
    if (!inside) { out.push({ err: 'not in', state: await js('G.wheels.fares.state'), dbg: await js(`(() => { const f = G.wheels.fares, c = G.city.car, F = f.fare; return { taxi: !!f.taxi, inCar: G.city.inCar, kind: c && c.kind, v: c && +c.speedAbs.toFixed(2), d: F && F.c ? +Math.hypot(c.pos.x - F.c.fig.pos.x, c.pos.z - F.c.fig.pos.z).toFixed(1) : null, stood: F && F.stoodT, t: F && F.t }; })()`) }); continue; }
    const t1 = Date.now();
    if (H.name === 'idle') {
      // nothing: he waits, says Come on., and gets out
      let warned = null;
      for (let i = 0; i < 700; i++) { const w = await js("G.hud.kit.warnText"); if (w && !warned) warned = { warn: w, at: (Date.now() - t1) / 1000 }; const s = await js('G.wheels.fares.state'); if (s !== 'in') break; await sleep(100); }
      out.push({ idle: true, warned, secs: (Date.now() - t1) / 1000, stats: await js('({ ...G.wheels.fares.stats })') });
      break;
    }
    const dest = F.dest;
    const r2 = await P.route([dest.x, dest.z]);
    const speed = H.name === 'good' ? 15 : H.name === 'medium' ? 13 : 12;
    let knocks = 0;
    const res = await P.driveAlong(r2 || [], { timeout: 300000, speed, traffic: true, until: async () => (await js('G.wheels.fares.state')) !== 'in',
      onStep: async (s, idx) => { if (H.name === 'bad' && knocks < 2 && idx > 30 + knocks * 60 && Math.random() < 0.01) { knocks++; log('  bad hands: into the kerb'); await P.set('KeyW', true); await P.set(Math.random() < 0.5 ? 'KeyA' : 'KeyD', true); await sleep(1300); } } });
    await P.stop();
    await sleep(600);
    const fs = await js('({ ...G.wheels.fares.stats, money: G.save.money })');
    out.push({ dest: dest.name, end: res.end, secs: (Date.now() - t1) / 1000, stats: fs });
    log(`  fare ${k}: ${JSON.stringify(out[out.length - 1])}`);
  }
  const S = await js('({ ...G.wheels.fares.stats, money: G.save.money })');
  return { hands: H.name, fares: out, stats: S, secs: (Date.now() - T0) / 1000 };
}
// ---- race: the Yards' corner ------------------------------------------------------------------------
// (&car=-444,252,1.5708: in a coupe on the Straight just short of the line)
// (opts.races: that many in a row - after each, on round the loop out of the
// corner's sight till it is set again, then back to the line; opts.untilWon: stop at a win)
async function race(P, api, H) {
  const { js, log } = api;
  const T0 = Date.now();
  const n = P.opts.races || 1;
  const all = [];
  for (let k = 0; k < n; k++) {
    if (k > 0 && !(await raceAgain(P, api, H))) { all.push({ err: 'not set again' }); break; }
    const r = await raceOnce(P, api, H);
    all.push(r);
    log(`race ${k}: ${JSON.stringify(r.result)} others ${JSON.stringify(r.others)} mine ${r.mine}`);
    if (r.strip || (P.opts.untilWon && r.result && r.result.won)) break;
  }
  const last = all[all.length - 1] || {};
  return { ...last, races: all.map((r) => r.result ? { won: r.result.won, place: r.result.place, time: r.result.time, others: r.others, mine: r.mine } : r), won: all.filter((r) => r.result && r.result.won).length, stats: await js('({ ...G.wheels.race.stats })'), money: await js('G.save.money'), secs: (Date.now() - T0) / 1000 };
}
async function raceAgain(P, { js, sleep, log }, H) {
  // on round the loop to its far side (Foundry St), the racers pulled in; there till the corner is set again
  // (the far side: the next middle of Foundry St on the course, two thirds of a lap from the line; then on to Water St short of the corner)
  const way = await js(`(() => { const R = G.wheels.race, P = R.path, c = G.city.car; const i = P.nearest(c.pos.x, c.pos.z, R.mine.i, 80); const s = P.pts[i].s; let f = R.s0 + R.lap * 0.66; while (f < s + 40) f += R.lap; const e = f + R.lap * 0.34 - 62; const a = [], b = []; for (let q = s; q < f; q += 3) { const p = P.at(q, {}); a.push([p.x, p.z, p.v]); } for (let q = f; q < e; q += 3) { const p = P.at(q, {}); b.push([p.x, p.z, p.v]); } return { a, b }; })()`);
  const r1 = await P.driveAlong(way.a, { speed: 12, timeout: 90000, traffic: true });
  await P.stop();
  let set = false;
  for (let i = 0; i < 300; i++) { if (await js(`G.wheels.race.state === 'idle' && G.wheels.race.cars.length === 3`)) { set = true; break; } await sleep(100); }
  log(`  round to the far side: ${r1.end}; the corner set again: ${set}`);
  if (!set) return false;
  await sleep(H.react);
  const r2 = await P.driveAlong(way.b, { speed: 12, timeout: 60000, traffic: true });
  await P.stop();
  log(`  back to Water St: ${r2.end}`);
  return true;
}
async function raceOnce(P, { js, sleep, log, shot }, H) {
  const T0 = Date.now();
  const site = await js(`(() => { const R = G.wheels.race; return { line: [R.path.pts[0].x, R.path.pts[0].z], s0: R.s0, lap: R.lap, len: R.len, cars: R.cars.length, state: R.state }; })()`);
  log(`race: ${JSON.stringify(site)}`);
  // (the corner set: its cars and its flag there)
  for (let i = 0; i < 100; i++) { if ((await js('G.wheels.race.cars.length')) > 0) break; await sleep(100); }
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
  if (P.opts.strip && shot) { for (let k = 0; k < P.opts.strip; k++) { await sleep(420); await shot('strip_' + k); } }
  for (let i = 0; i < 100; i++) { const r = await js('G.wheels.race.state'); if (r === 'run') break; await sleep(60); }
  if (P.opts.strip) { await P.set('KeyW', true); for (let k = 0; k < 4; k++) { await sleep(300); if (shot) await shot('strip_go' + k); } await P.set('KeyW', false); return { strip: true }; }
  if (shot) await shot('grid');
  const pts = await js(`(() => { const R = G.wheels.race, P = R.path, out = []; for (let s = R.s0; s < R.s0 + R.len + 40; s += 3) { const p = P.at(s, {}); out.push([p.x, p.z, p.v]); } return out; })()`);
  // (bad hands: late off the line; idle: never)
  if (H.name === 'idle') {
    for (let i = 0; i < 600; i++) { const r = await js('G.wheels.race.state'); if (r === 'done' || r === 'idle') break; await sleep(500); }
  } else {
    await sleep(H.react);
    const shots = new Set();
    await P.driveAlong(pts, { speed: 23, timeout: 300000, pass: true,
      until: async () => { const r = await js('G.wheels.race.state'); return r !== 'run'; },
      onStep: async (s, idx) => { if (shot && idx > 20 && !shots.has('a')) { shots.add('a'); await shot('start'); } } });
  }
  await sleep(400);
  for (let i = 0; i < 100; i++) { if ((await js('G.wheels.race.state')) !== 'run') break; await sleep(100); }
  const res = await js('({ result: G.wheels.race.result, stats: { ...G.wheels.race.stats }, money: G.save.money, others: G.wheels.race.cars.map((c) => +c.s.toFixed(0)), paces: G.wheels.race.cars.map((c) => c.pace), mine: +G.wheels.race.mine.s.toFixed(0), crashes: G.city.car && G.city.car.stats.crashes, damage: G.city.car && +G.city.car.damage.toFixed(2) })');
  return { hands: H.name, prompt: pr, ...res, secs: (Date.now() - T0) / 1000 };
}
// ---- drive: the drive-through of every district in the traffic -----------------------------------------
// O1's loop (tools/lib/o1_city.mjs DISTRICTS) by the keys, braking for what is
// ahead in my lane; the page's recorder counts: frames over 50 ms, any two cars
// inside each other (and a car inside a wall), the traffic come or gone in my
// view, the longest wait of a car not at a red, the crashes.
const DISTRICTS = [[-30, -115], [240, -30], [432, -200], [330, -420], [-300, -480], [-450, -100], [-450, 300], [-200, 330], [100, 432], [150, 200], [-112, 60]];
async function drive(P, { js, sleep, log, shot, send }, H) {
  const T0 = Date.now();
  // the memory: the heap after a collection, the renderer's (geometries, textures, programs)
  const mem = async () => { try { await send('HeapProfiler.collectGarbage'); } catch (e) { /* */ } await sleep(300); return js('({ heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, geo: N.renderer.info.memory.geometries, tex: N.renderer.info.memory.textures, prog: N.renderer.info.programs ? N.renderer.info.programs.length : null, cars: G.vehicles.list.length, parked: G.wheels.parked.bodies.length, figures: G.stage.cast.list.length })'); };
  const memAt = [await mem()];
  await js(`(() => {
    if (window.__o2rec) return 1;
    const R = window.__o2rec = { n: 0, over50: 0, max: 0, last: performance.now(), dts: [], overlap: 0, pairs: [], inWall: 0, walls: [], on: true, cars: 0, maxCars: 0, nearMax: 0 };
    const pen = (a, o) => { const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z; const ca = Math.cos(a.yaw), sa = Math.sin(a.yaw), cb = Math.cos(o.yaw), sb = Math.sin(o.yaw); let p = 9; for (const [x, z] of [[ca, -sa], [sa, ca], [cb, -sb], [sb, cb]]) { const ra = a.spec.halfL * Math.abs(ca * x - sa * z) + a.spec.halfW * Math.abs(sa * x + ca * z); const rb = o.spec.halfL * Math.abs(cb * x - sb * z) + o.spec.halfW * Math.abs(sb * x + cb * z); p = Math.min(p, ra + rb - Math.abs(dx * x + dz * z)); } return p; };
    const tick = () => {
      const t = performance.now(), dt = t - R.last; R.last = t;
      if (R.on) {
        R.n++; if (dt > R.max) R.max = dt;
        if (dt > 50) { R.over50++; if (R.dts.length < 20) R.dts.push([+dt.toFixed(0), Math.round(G.camera.position.x), Math.round(G.camera.position.z)]); }
        const W = G.wheels;
        if (W && R.n % 3 === 0) {
          const L = W.bodies().filter((o) => o.spec && !o.stored);
          const mov = L.filter((o) => !o.parked || (o.vel && o.vel.lengthSq() > 0.01));
          for (const a of mov) for (const o of L) { if (o === a || a.kind === 'tram' && o.kind === 'tram') continue; if (Math.abs(o.pos.x - a.pos.x) > 9 || Math.abs(o.pos.z - a.pos.z) > 9) continue; const p = pen(a, o); if (p > 0.3) { R.overlap++; if (R.pairs.length < 12) R.pairs.push([a.kind, o.kind || 'parked', +p.toFixed(2), Math.round(a.pos.x), Math.round(a.pos.z), a.traffic ? 'T' : a.parked ? 'P' : a === G.vehicles.player ? 'me' : '?', o.traffic ? 'T' : o.parked ? 'P' : o === G.vehicles.player ? 'me' : '?', G.stage.track.bodies().includes(o), +(a.speed || 0).toFixed(1)]); } }
          const col = G.stage.colliders;
          for (const a of mov) { if (a.kind === 'tram') continue; for (const w of col.near(a.pos.x, a.pos.z, 1)) { if (w.r != null || w.tag !== 'wall') continue; const dx = a.pos.x - w.cx, dz = a.pos.z - w.cz; const lx = dx * w.c - dz * w.s, lz = dx * w.s + dz * w.c; if (Math.abs(lx) < w.hx - 0.3 && Math.abs(lz) < w.hz - 0.3) { R.inWall++; if (R.walls.length < 8) R.walls.push([a.kind, Math.round(a.pos.x), Math.round(a.pos.z)]); } } }
          R.maxCars = Math.max(R.maxCars, W.traffic.cars.length); R.nearMax = Math.max(R.nearMax, W.traffic.stats.near || 0);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return 1; })()`);
  const st0 = await P.state();
  if (!st0.inCar) { await P.tap('KeyE'); await sleep(1200); }
  const pts = P.opts.points || DISTRICTS;
  const path = await js(`(() => {
    const W = G.wheels, c = G.city.car;
    const P = [[c.pos.x, c.pos.z], ...${JSON.stringify(pts)}];
    const out = [];
    for (let i = 0; i + 1 < P.length; i++) { const r = W.pathFor({ x: P[i][0], z: P[i][1] }, { x: P[i + 1][0], z: P[i + 1][1] }); if (!r) return { err: 'no route ' + i }; for (const q of r.pts) { if (out.length && Math.hypot(q[0] - out[out.length - 1][0], q[1] - out[out.length - 1][1]) < 2.5) continue; out.push(q); } }
    return out; })()`);
  if (!path || path.err) return { err: path && path.err };
  log(`drive: ${path.length} points (${(path.length * 3 / 1000).toFixed(2)} km)`);
  await sleep(300);
  await js('(window.__o2rec.n = 0, window.__o2rec.over50 = 0, window.__o2rec.max = 0, window.__o2rec.dts = [], window.__o2rec.last = performance.now(), 1)');
  const visited = new Set();
  const shots = P.opts.shots || {};
  const done = new Set();
  const r = await P.driveAlong(path, { speed: 14, timeout: P.opts.timeout || 600000, traffic: true,
    onStep: async (s, idx) => {
      if (idx % 25 === 0) { const d = await js('(() => { const c = G.city.car, d = G.stage.part("city").C.cellAt(c.pos.x, c.pos.z); return d ? d.district : null; })()'); if (d) visited.add(d); }
      for (const [k, name] of Object.entries(shots)) if (idx >= +k && !done.has(k)) { done.add(k); await js('(window.__o2rec.on = false, 1)'); await shot(name); await js('(window.__o2rec.last = performance.now(), window.__o2rec.on = true, 1)'); }
      if (idx % 200 === 0 && idx !== P.lastLog) P.lastLog = idx, log(`  at ${idx}/${path.length} (${s.car.x.toFixed(0)}, ${s.car.z.toFixed(0)}) ${(s.car.v * 3.6).toFixed(0)} km/h`);
    } });
  const R = await js(`(() => { const R = window.__o2rec, W = G.wheels; return { knockLog: (G.city.car.stats.log || []).slice(0, 12), frames: R.n, over50: R.over50, maxMs: +R.max.toFixed(0), dts: R.dts, overlap: R.overlap, pairs: R.pairs, inWall: R.inWall, walls: R.walls, maxCars: R.maxCars, nearMax: R.nearMax, traffic: W.traffic.stats, tram: W.tram.stats, crashes: G.city.car.stats.crashes, knocks: (G.city.car.stats.log || []).length, damage: +G.city.car.damage.toFixed(2) }; })()`);
  const last = await js(`(() => { const c = G.city.car, ca = Math.cos(c.yaw), sa = Math.sin(c.yaw); const near = G.wheels.bodies().filter((o) => o !== c && o.spec && Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) < 14).map((o) => { const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z; return [o.kind, o.traffic ? 'T' : o.parked ? 'P' : '?', +(dx * ca - dz * sa).toFixed(1), +(dx * sa + dz * ca).toFixed(1), +(o.speed || 0).toFixed(1)]; }); return { at: [+c.pos.x.toFixed(1), +c.pos.z.toFixed(1), +c.yaw.toFixed(2)], v: +c.speed.toFixed(2), input: c.input, near }; })()`);
  memAt.push(await mem());
  if (P.opts.again) {
    // (round again: the same loop, the memory after it)
    const r2 = await P.driveAlong(path.slice(0), { speed: 14, timeout: P.opts.timeout || 600000, traffic: true });
    memAt.push(await mem());
    R.again = r2.end;
  }
  return { end: r.end, districts: [...visited], secs: (Date.now() - T0) / 1000, last, mem: memAt, ...R };
}
// ---- latency: trusted key to the first frame of the act ---------------------------------------------------
// W (the car moves), A (the wheel turns), SPACE (the handbrake on), Q (the horn
// sounds: the 'city:horn' event), E at a parked car's door (the break-in begun)
async function latency(P, { js, keyDown, keyUp, sleep, log }, H) {
  const arm = async (what) => js(`(() => {
    const L = window.__lat = { what: ${JSON.stringify(what)}, key: 0, frame: 0 };
    const car = G.city.car, p0 = { x: car.pos.x, z: car.pos.z, steer: car.steer };
    let horn = false; const hf = () => { horn = true; }; G.on('city:horn', hf);
    addEventListener('keydown', () => { if (!L.key) L.key = performance.now(); }, { capture: true, once: true });
    const tick = () => {
      const c = G.city.car;
      const done = L.what === 'W' ? Math.hypot(c.pos.x - p0.x, c.pos.z - p0.z) > 1e-4 : L.what === 'A' ? Math.abs(c.steer - p0.steer) > 1e-4 : L.what === 'SPACE' ? c.input.handbrake > 0 : L.what === 'Q' ? horn : L.what === 'E' ? !!G.wheels.hijack.act : false;
      if (L.key && done) { L.frame = performance.now(); G.off('city:horn', hf); return; }
      if (performance.now() - (L.key || performance.now()) < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return 1; })()`);
  const read = async () => { await sleep(500); return js('(() => { const L = window.__lat; return L.frame && L.key ? +(L.frame - L.key).toFixed(1) : null; })()'); };
  const out = {};
  // E at the parked car's door (&park=saloon): walk there first
  const b = await js(`(() => { const b = G.wheels.parked.bodies.find((x) => x.rec.bay === -1); if (!b) return null; const c = Math.cos(b.yaw), s = Math.sin(b.yaw), hw = b.spec.halfW + 0.85; return { x: b.pos.x, z: b.pos.z, door: [b.pos.x + -0.3 * c + -hw * s, b.pos.z - -0.3 * s + -hw * c] }; })()`);
  if (b) { await P.walkTo(b.door[0], b.door[1]); await P.face(b.x, b.z); await sleep(400); await arm('E'); await keyDown('KeyE'); out.E = await read(); await keyUp('KeyE'); await sleep(2600); }
  const s = await P.state();
  if (!s.inCar) return { ...out, err: 'not in the car' };
  await sleep(800);
  await arm('W'); await keyDown('KeyW'); out.W = await read(); await sleep(900); await keyUp('KeyW');
  await arm('A'); await keyDown('KeyA'); out.A = await read(); await keyUp('KeyA');
  await arm('SPACE'); await keyDown('Space'); out.SPACE = await read(); await keyUp('Space');
  await P.stop();
  await arm('Q'); await keyDown('KeyQ'); out.Q = await read(); await keyUp('KeyQ');
  log(`latency: ${JSON.stringify(out)}`);
  return out;
}
// ---- bench: my car into every kind of car, and the tram --------------------------------------------------------
// (&lineup=1: one of each kind up the kerb ahead of the start's car; I take
// each head-on at 30 km/h from 18 m, then S to back off it; after each: no two
// boxes inside each other by more than 0.3 m, the struck car moved or not)
async function bench(P, { js, sleep, log, shot }, H) {
  const st0 = await P.state();
  if (!st0.inCar) { await P.tap('KeyE'); await sleep(1400); }
  const L = await js(`G.wheels.left.filter((x) => x.v && x.v !== G.city.car).map((x) => ({ kind: x.kind, x: x.v.pos.x, z: x.v.pos.z, yaw: x.v.yaw, hl: x.v.spec.halfL }))`);
  const out = [];
  const pen = `(a, o) => { const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z; const ca = Math.cos(a.yaw), sa = Math.sin(a.yaw), cb = Math.cos(o.yaw), sb = Math.sin(o.yaw); let p = 9; for (const [x, z] of [[ca, -sa], [sa, ca], [cb, -sb], [sb, cb]]) { const ra = a.spec.halfL * Math.abs(ca * x - sa * z) + a.spec.halfW * Math.abs(sa * x + ca * z); const rb = o.spec.halfL * Math.abs(cb * x - sb * z) + o.spec.halfW * Math.abs(sb * x + cb * z); p = Math.min(p, ra + rb - Math.abs(dx * x + dz * z)); } return p; }`;
  for (const T of [...L, { kind: 'tram' }]) {
    // a run up at it: from 18 m behind it on its line (the tram: at its side, in its path)
    let tgt = T;
    if (T.kind === 'tram') { tgt = await js('({ kind: "tram", x: G.wheels.tram.v.pos.x, z: G.wheels.tram.v.pos.z, yaw: G.wheels.tram.v.yaw, hl: 6.5 })'); }
    const s = await P.state();
    const back = T.kind === 'tram' ? 16 : tgt.hl + 18;
    const fx = Math.cos(tgt.yaw), fz = -Math.sin(tgt.yaw);
    const from = T.kind === 'tram' ? [tgt.x + 9, tgt.z + 6] : [tgt.x - fx * back, tgt.z - fz * back];
    // (driven round to the run-up point by the road, then the hit)
    const r = await P.route(from, 0);
    await P.driveAlong(r || [], { timeout: 45000, speed: 8, until: async (q) => Math.hypot(q.car.x - from[0], q.car.z - from[1]) < 3 });
    await P.stop();
    const line = [];
    const ax = T.kind === 'tram' ? tgt.x : tgt.x, az = tgt.z;
    for (let k = 0; k <= 12; k++) line.push([from[0] + (ax - from[0]) * k / 12 * 1.4, from[1] + (az - from[1]) * k / 12 * 1.4]);
    const res = await P.driveAlong(line, { timeout: 9000, speed: 8.5, until: async (q) => (await js('G.city.car.touchT')) < 0.1 && Math.abs(q.car.v) < 1.5 });
    await sleep(300);
    const after = await js(`(() => { const pen = ${pen}; const c = G.city.car; let worst = 0, what = null; for (const o of G.wheels.bodies()) { if (o === c || !o.spec) continue; if (Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) > 12) continue; const p = pen(c, o); if (p > worst) { worst = p; what = o.kind; } } return { worst: +worst.toFixed(2), what, crashes: c.stats.crashes, max: +c.stats.maxImpact.toFixed(1), damage: +c.damage.toFixed(2) }; })()`);
    // and S backs off it
    const p0 = await P.state();
    await P.set('KeyS', true); await sleep(1600); await P.set('KeyS', false);
    const p1 = await P.state();
    const backed = +Math.hypot(p1.car.x - p0.car.x, p1.car.z - p0.car.z).toFixed(2);
    out.push({ kind: T.kind, end: res.end, ...after, backed });
    log(`  bench ${T.kind}: ${JSON.stringify(out[out.length - 1])}`);
    if (shot && T.kind === 'lorry') await shot('bench_lorry');
  }
  return { hits: out, worst: Math.max(...out.map((h) => h.worst)), backedAll: out.every((h) => h.backed > 0.8) };
}
