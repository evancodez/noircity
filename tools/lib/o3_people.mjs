// [O3] NOIR CITY's people and police, played by real input (tools/play.mjs's
// module driver): { "drive": "tools/lib/o3_people.mjs", "mode": ..., ... }.
// The staging (a beat's setup: the street emptied, a walker and a cop put
// where the proof needs them, or the heat a chase starts at) is a page hook
// (people.dbgClear / dbgWalker / dbgCop, police.raise), as the kit's proofs
// stage theirs; every act of the player after it is keys and the mouse.
//   punch     a walker punched before a beat cop: then 'idle' (arrested,
//             warned), 'run' (Shift away round a corner: lost), 'fists'
//             (stands for the fight: play.mjs's fight step plays it)
//   witness   four streets: a punch with nobody to see it (nothing), before a
//             cop (HEAT 1 at once), before a civilian who reaches the call box
//             (HEAT 1 when he does), before one I catch (nothing)
//   lose      HEAT 1 on foot: out of their sight, the search shown, 'Clear.';
//             found again in the search: the heat as it was
//   chase     HEAT n in my car, the police after me; profile idle (boxed and
//             arrested), medium / good (away down the streets: lost)
//   gangs     a three on a corner: the word, a push (the fist fight), a gun
//             drawn near them (they draw); the border fight seen
//   crowd     the jank walk through the busiest crowd; a car into a crowd
//   latency   LMB to the fist's first frame; E on a police car to the seat
const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
const SENS = 0.0021;   // the controller's radians a mouse count

export default async function o3(api) {
  const { opts } = api;
  if (opts.mode === 'punch') return punch(api);
  if (opts.mode === 'witness') return witness(api);
  if (opts.mode === 'lose') return lose(api);
  if (opts.mode === 'chase') return chase(api);
  if (opts.mode === 'gangs') return gangs(api);
  if (opts.mode === 'crowd') return crowd(api);
  if (opts.mode === 'latency') return latency(api);
  if (opts.mode === 'strip') return strip(api);
  if (opts.mode === 'soak') return soak(api);
  return { err: 'no mode ' + opts.mode };
}

// ---- the hands of a player ----------------------------------------------------------------------
// turn the view onto a point (mouse moves, a few steps)
async function turnTo({ js, turn }, x, z, { pitch = null, steps = 6 } = {}) {
  const s = await js(`({ x: G.eye.x, z: G.eye.z, yaw: G.controller.yaw, pitch: G.controller.pitch })`);
  const want = Math.atan2(-(x - s.x), -(z - s.z));
  let dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
  const dx = Math.round(-dy / SENS);
  const dp = pitch == null ? 0 : Math.round(-(pitch - s.pitch) / SENS);
  for (let i = 0; i < steps; i++) { await turn(Math.round(dx / steps), Math.round(dp / steps)); await sleepP(16); }
}
async function tap({ keyDown, keyUp, sleep }, code, ms = 70) { await keyDown(code); await sleep(ms); await keyUp(code); }
async function click({ mouse, cursor, sleep }, button = 'left', ms = 60) {
  const [x, y] = cursor();
  await mouse('mousePressed', x, y, button); await sleep(ms); await mouse('mouseReleased', x, y, button);
}
// walk or run toward a point by W (+Shift), the mouse steering, until near or until(): true
async function goTo(api, x, z, { run = false, near = 1.2, ms = 15000, until = null } = {}) {
  const { js, keyDown, keyUp, turn } = api;
  const T = Date.now() + ms;
  await keyDown('KeyW'); if (run) await keyDown('ShiftLeft');
  let ok = false;
  while (Date.now() < T) {
    const s = await js(`({ x: G.eye.x, z: G.eye.z, yaw: G.controller.yaw, f: !!G.failing ${until ? ', u: !!(' + until + ')' : ''} })`);
    if (!s || s.__exc) { await sleepP(40); continue; }
    if (s.f || s.u) { ok = !!s.u; break; }
    if (Math.hypot(x - s.x, z - s.z) < near) { ok = true; break; }
    const want = Math.atan2(-(x - s.x), -(z - s.z));
    const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    await turn(Math.round(-dy * 0.6 / SENS), 0);
    // (held up by something - a car, a post, a man: a step aside, as a hand would)
    const now = Date.now();
    if (!goTo.lastP || now - goTo.lastT > 500) {
      if (goTo.lastP && Math.hypot(s.x - goTo.lastP[0], s.z - goTo.lastP[1]) < 0.35) { const k = (goTo.side = -(goTo.side || 1)) > 0 ? 'KeyD' : 'KeyA'; await keyDown(k); await sleepP(380); await keyUp(k); }
      goTo.lastP = [s.x, s.z]; goTo.lastT = now;
    }
    await sleepP(60);
  }
  goTo.lastP = null;
  await keyUp('KeyW'); if (run) await keyUp('ShiftLeft');
  return ok;
}
// follow a list of points (a route on the pavements) by the keys
async function goPath(api, pts, o = {}) {
  for (const [x, z] of pts) { const ok = await goTo(api, x, z, { near: 1.8, ...o }); if (!ok) return false; if (o.until && (await api.js(`!!(${o.until})`)) === true) return true; }
  return true;
}
async function waitFor(js, expr, ms = 20000, poll = 100) {
  const T = Date.now() + ms;
  while (Date.now() < T) { const v = await js(expr); if (v === true) return true; await sleepP(poll); }
  return false;
}
const state = (js) => js(`({ heat: G.police.heat, st: G.police.state, warn: G.hud.warnText, obj: G.hud.objectiveText, beat: G.scenes.beat, failing: G.failing ? G.failing.phase : null, lastFail: G.lastFail ? { why: G.lastFail.why, to: G.lastFail.to, warnedFor: G.lastFail.warnedFor, t: +G.lastFail.t.toFixed(1) } : null, t: +G.time.toFixed(1), gun: G.people.hands.hasGun, eye: [+G.eye.x.toFixed(1), +G.eye.z.toFixed(1)] })`);


// a way away from the cop on the pavements: a corner 25 - 90 m off, away from
// him (out of his line if there is one), the first corner not back toward him
const WAY_AWAY = (r0 = 30, r1 = 85) => `(() => { const P = G.people, g = P.graph, E = G.eye, c = window.__o3c;
  let best = null, bs = -1e9;
  for (const n of P.pList) { const d = Math.hypot(n.x - E.x, n.z - E.z); if (d < ${r0} || d > ${r1}) continue;
    const away = (n.x - E.x) * (E.x - c.pos.x) + (n.z - E.z) * (E.z - c.pos.z); if (away < 0) continue;
    const hid = !g.lineOfSight(c.pos.x, c.pos.z, n.x, n.z); const s = (hid ? 60 : 0) + away / d * 20 - Math.abs(d - 55) * 0.2; if (s > bs) { bs = s; best = n; } }
  if (!best) return [[E.x + (E.x - c.pos.x) * 2, E.z + (E.z - c.pos.z) * 2]];
  const r = g.pavementRoute(E, best); const pts = r ? r.pts : [[best.x, best.z]];
  while (pts.length > 1 && ((pts[0][0] - E.x) * (E.x - c.pos.x) + (pts[0][1] - E.z) * (E.z - c.pos.z)) < 0) pts.shift();
  return pts; })()`;
// run from him until out of his sight (a new way while he still sees me)
async function runAway(api, legs = 8) {
  const { js } = api;
  for (let leg = 0; leg < legs; leg++) {
    const w = await js(WAY_AWAY(leg ? 25 : 30, leg ? 70 : 85));
    await goPath(api, w, { run: true, ms: 30000, until: 'G.police.state === "search" && G.police.unseenT > 4' });
    if ((await js('G.police.state === "search" || G.police.heat === 0 || !!G.failing')) === true) return true;
  }
  return false;
}

// ---- the staging: the street round me emptied, the walker and the cop placed ---------------------
// (on the pavement where I stand, looking along it: the walker a stride ahead
// facing me, the cop `copD` metres on, in the same line of sight)
async function stagePunch({ js, sleep }, { copD = 14, cop = true, civ = null, at = null } = {}) {
  await waitFor(js, '!G.failing && G.state === "playing"', 20000);
  await sleep(300);
  const r = await js(`(() => {
    const P = G.people, C = G.controller;
    P.dbgClear();
    ${at ? `C.setPose(${at[0]}, ${at[1]}, ${at[2]}, -0.1);` : ''}
    const E = G.eye, yaw = C.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const v = P.dbgWalker(E.x + fx * 1.45, E.z + fz * 1.45, Math.atan2(-fx, -fz));
    window.__o3v = v;
    ${cop ? `const c = P.dbgCop(E.x + fx * ${copD} + fz * 1.2, E.z + fz * ${copD} - fx * 1.2, Math.atan2(-fx, -fz)); window.__o3c = c;` : 'window.__o3c = null;'}
    ${civ ? `const w = P.dbgWalker(E.x + fx * ${civ[0]} + fz * ${civ[1]}, E.z + fz * ${civ[0]} - fx * ${civ[1]}, Math.atan2(-fx, -fz)); window.__o3w = w;` : 'window.__o3w = null;'}
    return { me: [+E.x.toFixed(1), +E.z.toFixed(1)], v: v.kind, cop: ${cop ? 'c.kind' : 'null'} }; })()`);
  await sleep(500);
  return r;
}

// ---- punch: a walker punched before a beat cop ----------------------------------------------------
async function punch(api) {
  const { js, log, shot, sleep, opts } = api;
  const R = { tries: [] };
  const n = opts.tries || 1;
  for (let k = 0; k < n; k++) {
    const T = { k };
    const st0 = await stagePunch(api, { copD: opts.copD ?? 14, at: opts.at || null });
    log(`punch ${k}: staged ${JSON.stringify(st0)}`);
    // the two jabs (LMB, a third of a second apart)
    const t0 = Date.now();
    await click(api); await sleep(320); await click(api);
    await sleep(400);
    const c0 = await js(`({ log: G.crime.log.slice(-2).map(r => [r.kind, r.level, r.seen]), heat: G.police.heat, v: window.__o3v.mode, vDown: window.__o3v.down, landed: G.people.hands.stats.landed })`);
    T.punch = c0;
    if (opts.shots && k === 0) await shot('punched');
    if (opts.then === 'idle') {
      // hands off: he comes, 'Hands up.', the cuffs
      const warned = await waitFor(js, `G.hud.warnText === 'Hands up.'`, 40000);
      T.warnAt = (Date.now() - t0) / 1000;
      if (opts.shots && k === 0) await shot('handsup');
      const failed = await waitFor(js, `!!G.failing`, 15000);
      T.failAt = (Date.now() - t0) / 1000;
      T.fail = (await state(js)).lastFail;
      const back = await waitFor(js, `!G.failing && G.scenes.beat === 'station'`, 15000);
      T.backIn = +((Date.now() - t0) / 1000 - T.failAt).toFixed(1);
      await sleep(600);
      if (opts.shots && k === 0) await shot('station');
      T.after = await state(js);
      T.ok = warned && failed && back && T.fail && T.fail.why === 'Arrested.' && T.fail.warnedFor >= 1 && T.after.beat === 'station' && T.after.heat === 0 && T.after.gun === false && T.backIn < 10;
    } else if (opts.then === 'run') {
      // he comes; I turn from him and run (Shift) down the street and round the first corner
      await waitFor(js, `window.__o3c && window.__o3c.pos.distanceTo(G.eye) < ${opts.runAt ?? 12}`, 30000);
      const tRun = await js('G.time');
      await js(`(window.__o3tr = [], clearInterval(window.__o3trI), window.__o3trI = setInterval(() => { const V = G.controller.vel, c = window.__o3c; window.__o3tr.push([+G.time.toFixed(1), +Math.hypot(V.x, V.z).toFixed(1), c ? +c.pos.distanceTo(G.eye).toFixed(1) : null, c ? c.gaitNow : null, G.police.state]); if (window.__o3tr.length > 80) window.__o3tr.shift(); }, 400), 1)`);
      await runAway(api);
      const lost = await waitFor(js, `G.police.heat === 0`, 45000);
      T.after = await state(js);
      T.ok = lost && !(T.after.lastFail && T.after.lastFail.t >= tRun);
      T.trace = await js(`(clearInterval(window.__o3trI), window.__o3tr.slice(0, 30).map(e => e.join(':')).join(' '))`);
    } else if (opts.then === 'fists') {
      // stand: he comes; at arm's length the punch that starts the fight (the fight step plays it)
      await waitFor(js, `window.__o3c && Math.hypot(window.__o3c.pos.x - G.eye.x, window.__o3c.pos.z - G.eye.z) < 2.2`, 40000, 40);
      await api.turn(0, 0);
      const c = await js(`({ x: window.__o3c.pos.x, z: window.__o3c.pos.z })`);
      await turnTo(api, c.x, c.z, { pitch: -0.05 });
      await click(api);
      T.fight = await waitFor(js, `G.brawl.active`, 3000);
      T.dbg = await js(`({ jab: G.people.hands.lastJab, st: G.people.hands.stats, d: +Math.hypot(window.__o3c.pos.x - G.eye.x, window.__o3c.pos.z - G.eye.z).toFixed(2), mode: G.controller.mode, warn: G.hud.warnText, fists: G.police.fists.active })`);
      T.ok = T.fight;
    }
    R.tries.push(T);
    log(`punch ${k}: ${JSON.stringify(T)}`);
    if (k + 1 < n) await sleep(1500);
  }
  R.ok = R.tries.every((t) => t.ok);
  return R;
}

// ---- the witnesses ------------------------------------------------------------------------------------
async function witness(api) {
  const { js, log, sleep, shot, opts } = api;
  const R = {};
  // (a) nobody to see it: a lane at night, the man I punch the only one there
  await stagePunch(api, { cop: false, at: opts.alley || null });
  await click(api); await sleep(320); await click(api);
  await sleep(opts.quiet ?? 25000);
  R.empty = await js(`({ heat: G.police.heat, seen: G.crime.log.slice(-1)[0].seen, reporters: G.crime.log.slice(-1)[0].reporters })`);
  R.emptyOk = R.empty.heat === 0 && !R.empty.seen;
  log(`witness empty: ${JSON.stringify(R.empty)}`);
  // (b) before a cop: HEAT 1 at once
  await stagePunch(api, { cop: true, copD: 16 });
  const tb = Date.now();
  await click(api); await sleep(320); await click(api);
  const b = await waitFor(js, `G.police.heat >= 1`, 3000, 50);
  R.cop = { heat: await js('G.police.heat'), ms: Date.now() - tb, seen: await js('G.crime.log.slice(-1)[0].seen') };
  R.copOk = b && R.cop.seen === 'cop';
  log(`witness cop: ${JSON.stringify(R.cop)}`);
  // (c) a civilian sees it: he looks at me, runs to the box, HEAT 1 when he gets there
  await stagePunch(api, { cop: false, civ: [9, 2.5] });
  await click(api); await sleep(320); await click(api);
  await sleep(300);
  R.civ = { start: await js(`({ mode: window.__o3w.mode, phase: window.__o3w.phase, heat: G.police.heat })`) };
  if (opts.shots) { await sleep(500); await shot('witness_looks'); }
  const reached = await waitFor(js, `G.police.heat >= 1`, 70000);
  R.civ.end = await js(`({ heat: G.police.heat, reports: G.people.stats.reports, how: (G.police.events.filter(e => e.what === 'report').slice(-1)[0] || {}).how })`);
  R.civOk = R.civ.start.mode === 'report' && reached && R.civ.end.how === 'box';
  log(`witness civ: ${JSON.stringify(R.civ)}`);
  // (d) one I stop: I go after him and stand at his side - he gives it up
  await stagePunch(api, { cop: false, civ: [9, 2.5] });
  await click(api); await sleep(320); await click(api);
  await waitFor(js, `window.__o3w.mode === 'report' && window.__o3w.phase === 'go'`, 5000);
  let caught = false;
  for (let i = 0; i < 40 && !caught; i++) {
    const w = await js(`({ x: window.__o3w.pos.x, z: window.__o3w.pos.z, m: window.__o3w.mode })`);
    if (w.m !== 'report') { caught = true; break; }
    await goTo(api, w.x, w.z, { run: true, near: 1.4, ms: 700 });
  }
  if (opts.shots) await shot('witness_caught');
  await sleep(opts.quiet ?? 25000);
  R.stop = await js(`({ heat: G.police.heat, mode: window.__o3w.mode, stopped: G.people.stats.stopped })`);
  R.stopOk = caught && R.stop.heat === 0 && R.stop.stopped >= 1;
  log(`witness stopped: ${JSON.stringify(R.stop)}`);
  R.ok = R.emptyOk && R.copOk && R.civOk && R.stopOk;
  return R;
}

// ---- losing them on foot -----------------------------------------------------------------------------
async function lose(api) {
  const { js, log, sleep, shot, opts } = api;
  const R = {};
  // HEAT 1 seen (a punch before a cop 25 m off), then run round the corner
  await stagePunch(api, { copD: 24 });
  await click(api); await sleep(320); await click(api);
  await waitFor(js, `G.police.heat >= 1`, 3000);
  await runAway(api);
  // the search shown: the badges breathe, the line says it
  const searched = await waitFor(js, `G.police.state === 'search'`, 20000);
  R.search = await js(`({ st: G.police.state, badges: document.querySelector('#o3heat') ? document.querySelector('#o3heat').dataset.state : null, obj: G.hud.objectiveText })`);
  if (opts.shots) await shot('search');
  // found again: out where he can see me again, at the far end of his sight (24 - 33 m), then away again
  const spot = await js(`(() => { const P = G.people, g = P.graph, E = G.eye, c = window.__o3c;
    let best = null, bd = 1e9;
    for (const n of P.pList) { const dc = Math.hypot(n.x - c.pos.x, n.z - c.pos.z); if (dc < 24 || dc > 33 || !g.lineOfSight(c.pos.x, c.pos.z, n.x, n.z)) continue;
      const d = Math.hypot(n.x - E.x, n.z - E.z); if (d < bd) { bd = d; best = n; } }
    if (!best) return null; const r = g.pavementRoute(E, best); return r ? r.pts : [[best.x, best.z]]; })()`);
  if (spot) await goPath(api, spot, { run: false, ms: 30000, until: `G.police.state === 'hunt'` });
  await waitFor(js, `G.police.state === 'hunt'`, 6000);
  R.found = await js(`({ st: G.police.state, heat: G.police.heat })`);
  // and lost for good: away again and wait
  await runAway(api);
  const cleared = await waitFor(js, `G.police.heat === 0`, 60000);
  R.clear = await js(`({ heat: G.police.heat, obj: G.hud.objectiveText, ev: G.police.events.filter(e => e.t > 10).map(e => e.what + '@' + e.t + (e.why ? ':' + e.why : '')), fail: G.lastFail })`);
  R.ok = searched && R.search.badges === 'search' && R.found.st === 'hunt' && R.found.heat >= 1 && cleared && R.clear.obj === 'Clear.';
  log(`lose: ${JSON.stringify(R)}`);
  return R;
}

// ---- the car chase --------------------------------------------------------------------------------------
async function chase(api) {
  const { js, keyDown, keyUp, log, sleep, shot, opts } = api;
  const R = { tries: [] };
  const n = opts.tries || 1;
  for (let k = 0; k < n; k++) {
    const T = { k };
    // the beat's setup: in my car at the kerb, HEAT n (O2's hijack stands in: raise)
    await waitFor(js, '!G.failing && G.state === "playing"', 20000);
    await sleep(400);
    await js(`(() => { const P = G.people; P.dbgClear(); if (!${!!opts.onFoot}) P.dbgAtCar(); return 1; })()`);
    await sleep(300);
    const inCar = await js('G.city.inCar');
    if (!inCar && !opts.onFoot) { await tap(api, 'KeyE'); await sleep(1200); }
    await js(`(G.police.raise(${opts.heat ?? 2}, G.city.inCar ? G.city.car.pos : G.eye, 'staged'), 1)`);
    const t0 = Date.now();
    if (opts.profile === 'idle' && opts.onFoot) {
      const fell = await waitFor(js, `!!G.failing`, 120000);
      T.fail = (await state(js)).lastFail;
      if (opts.shots && k === 0) await shot('down');
      const back = await waitFor(js, `!G.failing && G.scenes.beat === 'hospital'`, 15000);
      await sleep(800);
      if (opts.shots && k === 0) await shot('hospital');
      T.ev = await js(`G.police.events.filter(e => ['car', 'stop', 'guns', 'draw', 'wake'].includes(e.what)).map(e => e.what + '@' + e.t + (e.role ? ':' + e.role : '') + (e.kind ? ':' + e.kind : ''))`);
      T.health = await js(`({ hits: G.counters.hoodHits, shots: G.counters.hoodShots })`);
      T.ok = fell && back && T.fail && T.fail.to === 'hospital' && T.fail.warnedFor >= 1;
    } else if (opts.profile === 'idle') {
      // hands off: they come, they box me, 'Hands up.', the cuffs
      const warned = await waitFor(js, `G.hud.warnText === 'Hands up.'`, 90000);
      T.warnAt = (Date.now() - t0) / 1000;
      if (opts.shots && k === 0) await shot('boxed');
      const failed = await waitFor(js, `!!G.failing`, 15000);
      T.fail = (await state(js)).lastFail;
      const back = await waitFor(js, `!G.failing && G.scenes.beat === 'station'`, 15000);
      T.ev = await js(`G.police.events.filter(e => ['car', 'stop', 'crew', 'handsup', 'arrest', 'guns', 'draw'].includes(e.what)).map(e => e.what + '@' + e.t + (e.role ? ':' + e.role : '') + (e.kind ? ':' + e.kind : ''))`);
      T.ok = warned && failed && back && T.fail && T.fail.why === 'Arrested.' && T.fail.warnedFor >= 1;
    } else {
      // away: a route through the streets, the far end from the nearest police car, driven by the keys
      const P = opts.profile === 'good' ? { vmax: 22, look: 1, react: 60, hide: true } : { vmax: 16, look: 1.2, react: 160, hide: false };
      const res = await driveAway(api, { ...P, secs: opts.secs ?? 120, until: 'G.police.heat === 0', shots: opts.shots && k === 0 });
      T.drive = res;
      T.after = await state(js);
      T.ev = await js(`G.police.events.filter(e => ['car', 'stop', 'roadblock', 'search', 'found', 'clear', 'arrest', 'handsup'].includes(e.what)).map(e => e.what + '@' + e.t + (e.street ? ':' + e.street : ''))`);
      T.ok = T.after.heat === 0 && !T.after.failing && !(T.after.lastFail && T.after.lastFail.t > 0 && res.failed);
    }
    R.tries.push(T);
    log(`chase ${k} (${opts.profile}): ${JSON.stringify(T)}`);
    if (k + 1 < n) await sleep(1500);
  }
  R.wins = R.tries.filter((t) => t.ok).length;
  return R;
}
// drive away from the police by the keys: the route to a far point, pure pursuit on W / A / D / SPACE
async function driveAway(api, { vmax = 20, look = 1, react = 80, secs = 120, until = 'false', shots = false, hide = false } = {}) {
  const { js, keyDown, keyUp, log, shot } = api;
  const held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } };
  let flip = false;
  const plan = async (back = false) => js(`(() => { const g = G.people.graph, c = G.city.car, pol = G.police.cars.filter(p => p.mode !== 'leave');
    // away from the nearest of them (or on along my way): a point 450 m off on the roads (the other way: back)
    let ax = Math.cos(c.yaw) * ${back ? -1 : 1}, az = -Math.sin(c.yaw) * ${back ? -1 : 1};
    // (they have lost sight of me: away from where they last saw me)
    const LS = G.police.state === 'search' && G.police.lastSeen;
    if (LS && !${back}) { const dx = c.pos.x - LS.x, dz = c.pos.z - LS.z, L0 = Math.hypot(dx, dz) || 1; ax = dx / L0 * 0.8 + ax * 0.2; az = dz / L0 * 0.8 + az * 0.2; }
    else if (pol.length && !${back}) { let b = null, bd = 1e9; for (const p of pol) { const d = p.pos.distanceTo(c.pos); if (d < bd) { bd = d; b = p; } } const dx = c.pos.x - b.pos.x, dz = c.pos.z - b.pos.z, L = Math.hypot(dx, dz) || 1; ax = dx / L * 0.7 + ax * 0.3; az = dz / L * 0.7 + az * 0.3; }
    const L = Math.hypot(ax, az) || 1; let tx = c.pos.x + ax / L * 450, tz = c.pos.z + az / L * 450;
    tx = Math.max(-560, Math.min(420, tx)); tz = Math.max(-520, Math.min(400, tz));
    const r = g.route({ x: c.pos.x, z: c.pos.z }, { x: tx, z: tz }); if (!r) return null;
    const out = []; for (const p of r.pts) { if (out.length && Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) < 1) continue; out.push(p); }
    const D = []; for (let i = 0; i + 1 < out.length; i++) { const [ax2, az2] = out[i], [bx, bz] = out[i + 1]; const L2 = Math.hypot(bx - ax2, bz - az2); const n = Math.max(1, Math.ceil(L2 / 3)); for (let k = 0; k < n; k++) D.push([ax2 + (bx - ax2) * k / n, az2 + (bz - az2) * k / n]); }
    D.push(out[out.length - 1]);
    const Rr = []; for (let i = 0; i < D.length; i++) { const a = D[Math.max(0, i - 2)], b = D[Math.min(D.length - 1, i + 2)]; const dx = b[0] - a[0], dz = b[1] - a[1], L3 = Math.hypot(dx, dz) || 1; const S = g.streetAt(D[i][0], D[i][1]); const off = S && S.edge.el && S.d < 1 ? (S.edge.hw + 4.56) / 2 : 2.0; Rr.push([D[i][0] - dz / L3 * off, D[i][1] + dx / L3 * off]); }
    return Rr; })()`);
  let path = null, idx = 0, replanT = Date.now();
  path = await plan(false);
  const T0 = Date.now(), rec = { replans: 0, crashes: 0, maxKmh: 0, failed: false, km: 0 };
  let last = null, stuckT = 0, revUntil = 0, shotDone = false;
  while (Date.now() - T0 < secs * 1000) {
    const s = await js(`(() => { const c = G.city.car; return { x: c.pos.x, z: c.pos.z, yaw: c.yaw, v: c.speed, crashes: c.stats.crashes, inCar: G.city.inCar, failing: !!G.failing, u: !!(${until}), heat: G.police.heat, block: !!G.police.block }; })()`);
    if (!s || s.__exc) { await sleepP(40); continue; }
    if (s.failing || !s.inCar) { rec.failed = s.failing; break; }
    if (s.u) { rec.done = true; break; }
    if (hide) {
      const h = await js(`(() => { const L = G.police.lastSeen, c = G.city.car; return { st: G.police.state, far: L ? Math.hypot(c.pos.x - L.x, c.pos.z - L.z) : 0, near: G.police.cars.some(p => p.mode !== 'leave' && p.pos.distanceTo(c.pos) < 70) }; })()`);
      if (h.st === 'search' && h.far > 220 && !h.near) {
        for (const c of [...held]) await set(c, false);
        await set('KeyS', true); await sleepP(1200); await set('KeyS', false);
        rec.hid = (rec.hid || 0) + 1;
        const T1 = Date.now();
        while (Date.now() - T1 < 20000) { const q = await js(`({ st: G.police.state, u: !!(${until}), f: !!G.failing })`); if (q.u || q.f || q.st === 'hunt') break; await sleepP(250); }
        continue;
      }
    }
    if (shots && s.block && !shotDone) { shotDone = true; await shot('roadblock'); }
    if (last) rec.km += Math.hypot(s.x - last.x, s.z - last.z) / 1000;
    if (!rec.tr) rec.tr = [];
    if (!rec.trT || Date.now() - rec.trT > 2000) { rec.trT = Date.now(); rec.tr.push([Math.round(s.x), Math.round(s.z), Math.round(s.v * 3.6), s.crashes, idx, path ? path.length : 0].join(',')); }
    last = s;
    rec.crashes = s.crashes; rec.maxKmh = Math.max(rec.maxKmh, Math.abs(s.v) * 3.6);
    if (!path || idx >= path.length - 4 || Date.now() - replanT > 25000) { path = await plan(flip); idx = 0; replanT = Date.now(); rec.replans++; if (!path) { await sleepP(200); continue; } }
    let best = idx, bd = Infinity;
    for (let k = idx; k < Math.min(path.length, idx + 40); k++) { const d = Math.hypot(path[k][0] - s.x, path[k][1] - s.z); if (d < bd) { bd = d; best = k; } }
    idx = best;
    if (bd > 25) { path = await plan(flip); idx = 0; replanT = Date.now(); rec.replans++; continue; }
    const lk = Math.min(path.length - 1, idx + Math.round((6 + Math.abs(s.v) * 0.6 * look) / 3));
    const [tx, tz] = path[lk];
    const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw);
    const ang = Math.atan2(fx * (tz - s.z) - fz * (tx - s.x), fx * (tx - s.x) + fz * (tz - s.z));
    const a0 = path[Math.min(path.length - 1, idx + 2)], a1 = path[Math.min(path.length - 1, idx + 6)], a2 = path[Math.min(path.length - 1, idx + 12)];
    const h1 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), h2 = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
    const turnA = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    const want = Math.min(vmax, turnA > 0.9 ? 7 : turnA > 0.4 ? 11 : vmax);
    // stuck: back off it; stuck twice in a short while - another way (the route the other way round)
    stuckT = Math.abs(s.v) < 0.8 ? stuckT + react / 1000 : 0;
    if (stuckT > 1.4) {
      revUntil = Date.now() + 1300; stuckT = 0;
      rec.stucks = (rec.stucks || 0) + 1;
      if (Date.now() - (rec.lastStuck || 0) < 9000) { flip = !flip; path = await plan(flip); idx = 0; replanT = Date.now(); rec.replans++; }
      rec.lastStuck = Date.now();
    }
    if (Date.now() < revUntil) { await set('KeyW', false); await set('KeyS', true); await set('KeyA', ang < 0); await set('KeyD', ang > 0); await sleepP(react); continue; }
    await set('KeyS', s.v > want + 2.5);
    await set('KeyW', s.v < want);
    await set('KeyD', ang > 0.06); await set('KeyA', ang < -0.06);
    await set('Space', false);
    await sleepP(react);
  }
  for (const c of [...held]) await set(c, false);
  rec.secs = +((Date.now() - T0) / 1000).toFixed(1);
  rec.km = +rec.km.toFixed(2);
  log(`driveAway ${JSON.stringify({ ...rec, tr: undefined })}`);
  log(`driveAway trace ${(rec.tr || []).join(' ')}`);
  delete rec.tr;
  return rec;
}

// ---- the gangs ---------------------------------------------------------------------------------------
async function gangs(api) {
  const { js, log, sleep, shot, opts } = api;
  const R = {};
  // a three on a corner: me walking up to them
  const T = await js(`(() => { const P = G.people, Gs = P.gangs; P.dbgClear(); P.hold = true;
    const post = Gs.posts.find(p => p.gang === '${opts.gang || 'tenements'}');
    const T = Gs.three(post.gang, post.x, post.z, { post }); window.__o3t = T;
    const n = P.nearestP(post.x + 14, post.z); G.controller.setPose(n.x, n.z, Math.atan2(-(post.x - n.x), -(post.z - n.z)), -0.05);
    return { x: post.x, z: post.z, gang: post.gang, kinds: T.men.map(m => m.kind) }; })()`);
  R.three = T;
  await sleep(800);
  await goTo(api, T.x, T.z, { near: 2.6, ms: 12000 });
  const word = await waitFor(js, `G.people.gangs.stats.words >= 1`, 6000);
  R.word = { ok: word, say: await js('G.hud.lastSay') };
  if (opts.shots) await shot('gang_word');
  // a push: a jab at the nearest of them - the fist fight
  const m = await js(`(() => { const E = G.eye; const L = window.__o3t.men.filter(p => p.standing).sort((a, b) => a.pos.distanceTo(E) - b.pos.distanceTo(E)); return { x: L[0].pos.x, z: L[0].pos.z }; })()`);
  await turnTo(api, m.x, m.z, { pitch: -0.05 });
  await goTo(api, m.x, m.z, { near: 1.5, ms: 3000 });
  await turnTo(api, m.x, m.z, { pitch: -0.05 });
  await click(api);
  R.fight = await waitFor(js, `G.brawl.active`, 2500);
  // out of the fight (the black of its own, or I walk away): the Docks' three, and my gun out at 15 m
  if (opts.draw) {
    await waitFor(js, '!G.brawl.active && !G.failing', 120000);
    await sleep(1500);
    const D = await js(`(() => { const P = G.people, Gs = P.gangs; P.dbgClear(); P.hold = true;
      const post = Gs.posts.find(p => p.gang === 'docks');
      const T = Gs.three('docks', post.x, post.z, { post }); window.__o3d = T;
      const n = P.nearestP(post.x + 16, post.z); G.controller.setPose(n.x, n.z, Math.atan2(-(post.x - n.x), -(post.z - n.z)), -0.05);
      return { x: post.x, z: post.z, kinds: T.men.map(m => m.kind) }; })()`);
    R.docks = D;
    await sleep(1200);
    await click(api, 'right', 150);
    R.drew = await waitFor(js, `window.__o3d.hostile && window.__o3d.men.filter(m => m.armed).length >= 2`, 4000);
    await sleep(1200);
    if (opts.shots) await shot('gang_draw');
    R.drawEv = await js(`G.police.events.filter(e => e.what === 'draw' || e.what === 'gang').map(e => e.what + ':' + (e.side || e.gang) + ':' + (e.kind || e.why))`);
    // and away (the men stood down by the clear)
    await js(`(G.people.dbgClear(), 1)`);
  }
  if (opts.war) {
    await sleep(1000);
    const W = await js(`(() => { const P = G.people, E = G.eye, C = G.controller; P.dbgClear(); P.hold = true;
      const yaw = C.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const n = P.nearestP(E.x + fx * 30, E.z + fz * 30);
      const W = P.gangs.war({ x: n.x, z: n.z }); window.__o3w2 = W; return W ? { x: +W.x.toFixed(0), z: +W.z.toFixed(0) } : null; })()`);
    R.war = { at: W };
    if (W) await turnTo(api, W.x, W.z, { pitch: -0.05 });
    const fists = await waitFor(js, `window.__o3w2 && window.__o3w2.phase === 'fists'`, 20000);
    await sleep(2500);
    if (opts.shots) await shot('gang_war_fists');
    const guns = await waitFor(js, `window.__o3w2 && window.__o3w2.phase === 'guns'`, 15000);
    await sleep(4000);
    if (opts.shots) await shot('gang_war_guns');
    await sleep(8000);
    R.war.end = await js(`({ phase: window.__o3w2.phase, shots: window.__o3w2.shots, down: [...window.__o3w2.A.men, ...window.__o3w2.B.men].filter(p => !p.standing).length, heat: G.police.heat, police: G.police.events.filter(e => e.what === 'gangwar').length, car: G.police.cars.some(pc => pc.scene) })`);
    R.war.ok = fists && guns && R.war.end.shots > 0 && R.war.end.heat === 0 && R.war.end.police >= 1;
  }
  log(`gangs: ${JSON.stringify(R)}`);
  R.ok = R.word.ok && R.fight && (!opts.draw || R.drew) && (!opts.war || R.war.ok);
  return R;
}

// ---- the crowd: the jank walk, a car into it --------------------------------------------------------------
async function crowd(api) {
  const { js, log, sleep, shot, opts } = api;
  const R = {};
  // the recorder: anyone inside anyone (a man through a man, a man in a wall, the eye in a man)
  await js(`(() => { if (window.__o3rec) return 1; const R = window.__o3rec = { frames: 0, through: 0, inWall: 0, eyeIn: 0, worst: [], bodyBlock: 0 };
    const col = G.stage.colliders;
    const tick = () => { const P = G.people; if (P && R.on) { R.frames++;
      const L = P.list.filter(p => p.standing && p.object.visible);
      for (let i = 0; i < L.length; i++) { const a = L[i];
        for (let j = i + 1; j < L.length; j++) { const b = L[j]; const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z); if (d < (a.r + b.r) * 0.55) { R.through++; if (R.worst.length < 8) R.worst.push(['pp', a.kind, b.kind, +d.toFixed(2)]); } }
        const e = Math.hypot(a.pos.x - G.eye.x, a.pos.z - G.eye.z); if (e < a.r * 0.6 && !G.city.inCar) R.eyeIn++;
        for (const o of col.near(a.pos.x, a.pos.z, 1)) { if (o.r != null || (o.tag !== 'wall')) continue; const dx = a.pos.x - o.cx, dz = a.pos.z - o.cz; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx - 0.15 && Math.abs(lz) < o.hz - 0.15) { R.inWall++; if (R.worst.length < 8) R.worst.push(['wall', a.kind, a.mode, +a.pos.x.toFixed(1), +a.pos.z.toFixed(1), +o.cx.toFixed(1), +o.cz.toFixed(1), +o.hx.toFixed(1), +o.hz.toFixed(1), a.object.visible]); } } } }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick); return 1; })()`);
  // the busiest street: the crowd at its cap round Grand Ave; walk up and down through it
  await js(`(G.people.hold = false, 1)`);
  await waitFor(js, `G.people.list.filter(p => p.role === 'walker').length >= ${opts.min ?? 14}`, 40000);
  await js(`(window.__o3rec.on = true, 1)`);
  const walks = opts.walks || [[-108.5, 60], [-108.5, 0], [-108.5, 60]];
  for (const [x, z] of walks) await goTo(api, x, z, { near: 2, ms: 25000, run: !!opts.run });
  R.walk = await js(`({ ...window.__o3rec, worst: window.__o3rec.worst, bumps: G.people.stats, n: G.people.list.length })`);
  if (opts.shots) await shot('crowd_walk');
  // a car into a crowd: four walkers in the road ahead of my car, and W
  if (opts.car) {
    await js(`(() => { const P = G.people, c = G.city.car; P.hold = true; const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw), rx = Math.sin(c.yaw), rz = Math.cos(c.yaw);
      window.__o3k = []; for (let i = 0; i < 4; i++) { const p = P.dbgWalker(c.pos.x + fx * (26 + i * 2.5) + rx * (i % 2 ? 0.8 : -0.8), c.pos.z + fz * (26 + i * 2.5) + rz * (i % 2 ? 0.8 : -0.8), 0); window.__o3k.push(p); } return 1; })()`);
    await js('(G.people.dbgAtCar(), 1)');
    await sleep(300);
    const inCar = await js('G.city.inCar');
    if (!inCar) { await tap(api, 'KeyE'); await sleep(1100); }
    // (the four in the road ahead of it, now that I am in its seat)
    await js(`(() => { const c = G.city.car, fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw), rx = Math.sin(c.yaw), rz = Math.cos(c.yaw);
      window.__o3k.forEach((p, i) => { p.fig.pos.x = c.pos.x + fx * (26 + i * 2.5) + rx * (i % 2 ? 0.8 : -0.8); p.fig.pos.z = c.pos.z + fz * (26 + i * 2.5) + rz * (i % 2 ? 0.8 : -0.8); p.fig.yaw = c.yaw; }); return 1; })()`);
    await api.keyDown('KeyW'); await sleep(opts.carMs ?? 3500); await api.keyUp('KeyW');
    await api.keyDown('KeyS'); await sleep(1500); await api.keyUp('KeyS');
    if (opts.shots) await shot('crowd_car');
    R.car = await js(`({ modes: window.__o3k.map(p => p.mode), down: window.__o3k.filter(p => p.down).length, dashed: G.people.stats.dashes, hit: G.people.stats.hitByCar, through: window.__o3k.filter(p => p.standing && (() => { const c = G.city.car; const dx = p.pos.x - c.pos.x, dz = p.pos.z - c.pos.z, co = Math.cos(c.yaw), s = Math.sin(c.yaw); return Math.abs(dx * co - dz * s) < c.spec.halfL && Math.abs(dx * s + dz * co) < c.spec.halfW; })()).length, heat: G.police.heat })`);
  }
  if (opts.gun) {
    // the gun out among them: six people round me, RMB - they run, with a cry; then a shot (LMB, at the sky): they scatter
    await waitFor(js, '!G.failing', 15000);
    if (await js('G.city.inCar')) { await tap(api, 'KeyE'); await waitFor(js, '!G.city.inCar', 5000); await sleep(800); }
    await js(`(() => { const P = G.people, C = G.controller; P.dbgClear(); C.setPose(-108.6, 20, 0, 0.25); window.__o3g = [];
      for (const [x, z] of [[-108.4, 12], [-107.2, 9], [-109.5, 15], [-108.0, 4], [-110.0, 24], [-107.4, 27]]) { const p = P.dbgWalker(x, z, Math.PI); p.mode = 'walk'; p.goTo([[x, z + 30]], { gait: 'stroll' }); window.__o3g.push(p); } return 1; })()`);
    await sleep(800);
    await click(api, 'right', 120);
    await sleep(1500);
    R.gun = await js(`({ flee: window.__o3g.filter(p => p.mode === 'flee').length, menace: G.crime.log.filter(r => r.kind === 'menace').length, heat: G.police.heat, out: G.people.hands.gunOut })`);
    if (opts.shots) await shot('crowd_gun');
    await sleep(300);
    await click(api, 'left', 60);
    await sleep(1500);
    R.shot = await js(`({ flee: window.__o3g.filter(p => p.mode === 'flee' || p.mode === 'report').length, reporters: (G.crime.log.filter(r => r.kind === 'shot').slice(-1)[0] || {}).reporters, shots: G.crime.log.filter(r => r.kind === 'shot').length })`);
  }
  if (opts.fast) {
    // a car too fast to clear: two men stepping into the road 45 m ahead, the car flat out
    await waitFor(js, '!G.failing', 15000);
    await js(`(() => { const P = G.people; P.dbgClear(); P.dbgAtCar(); return 1; })()`);
    await sleep(300);
    if (!(await js('G.city.inCar'))) { await tap(api, 'KeyE'); await sleep(1100); }
    await api.keyDown('KeyW'); await sleep(2600);
    await js(`(() => { const P = G.people, c = G.city.car, fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw), rx = Math.sin(c.yaw), rz = Math.cos(c.yaw); window.__o3f = [];
      for (const k of [-0.5, 0.5]) { const p = P.dbgWalker(c.pos.x + fx * 6 + rx * k, c.pos.z + fz * 6 + rz * k, 0); window.__o3f.push(p); } return +c.speed.toFixed(1); })()`);
    await sleep(1500); await api.keyUp('KeyW');
    await api.keyDown('KeyS'); await sleep(1800); await api.keyUp('KeyS');
    if (opts.shots) await shot('crowd_hit');
    R.fast = await js(`({ down: window.__o3f.filter(p => p.down).length, dead: window.__o3f.filter(p => p.dead).length, hit: G.people.stats.hitByCar, crimes: G.crime.log.slice(-3).map(r => r.kind) })`);
  }
  R.ok = R.walk.through === 0 && R.walk.inWall === 0 && R.walk.eyeIn === 0 && (!opts.car || R.car.through === 0) && (!opts.gun || (R.gun.flee >= 4 && R.gun.menace >= 1 && R.shot.flee >= 5)) && (!opts.fast || R.fast.down >= 1);
  log(`crowd: ${JSON.stringify(R)}`);
  return R;
}

// ---- the latency: LMB to the fist's first frame; E on a police car to the seat --------------------------
async function latency(api) {
  const { js, mouse, keyDown, keyUp, log, sleep, cursor, opts } = api;
  const R = {};
  // the frame recorder: per frame, the right / left hand's place and the camera's
  await js(`(() => { const R = window.__o3lat = { on: false, frames: [] };
    const tick = (ts) => { if (R.on) { const H = G.player.hands; R.frames.push([performance.now(), H.set, H.clipName || (H.cur && H.cur.name) || '', +G.camera.position.y.toFixed(3), G.city.inCar ? 1 : 0, G.vehicles.player ? 1 : 0, H.anchor ? +H.anchor('palmL').x.toFixed(4) + +H.anchor('palmR').x.toFixed(4) : 0]); if (R.frames.length > 600) R.frames.shift(); }
      requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
  const fist = [];
  for (let i = 0; i < (opts.n ?? 5); i++) {
    await stagePunch(api, { cop: false });
    await js(`(window.__o3lat.frames = [], window.__o3lat.on = true, 1)`);
    await sleep(150);
    const [x, y] = cursor();
    const t = await js('performance.now()');
    await mouse('mousePressed', x, y, 'left'); await sleep(50); await mouse('mouseReleased', x, y, 'left');
    await sleep(400);
    const F = await js(`(window.__o3lat.on = false, window.__o3lat.frames)`);
    // the first frame after the press whose hands differ from the frame before it
    let first = null;
    for (let k = 1; k < F.length; k++) if (F[k][0] > t && (F[k][1] !== F[k - 1][1] || F[k][6] !== F[k - 1][6])) { first = F[k][0] - t; break; }
    fist.push(first == null ? null : +first.toFixed(1));
    if (i === 0) R.fistFrames0 = F.filter((f) => f[0] > t - 40 && f[0] < t + 250).map((f) => +(f[0] - t).toFixed(0) + ':' + f[1] + ':' + f[6]);
  }
  R.fist = fist;
  // E on a police car standing empty: stage one stopped at the kerb by me, its men out
  await js(`(G.people.dbgClear(), 1)`);
  const ok = await js(`(() => { const P = G.people, E = G.eye, C = G.controller, pol = P.police;
    const yaw = C.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const pc = pol.spawnCarAt(E.x + fx * 3.0, E.z + fz * 3.0, Math.atan2(-fx, -fz));
    pc.park(); pc.mode = 'stopped'; pc.siren = false; return !!pc; })()`);
  await sleep(700);
  const ins = [];
  for (let i = 0; i < (opts.nE ?? 3); i++) {
    // (at its door, looking at it: the staging of each try)
    await js(`(() => { const R = G.city, c = R.car; if (!c || R.inCar) return 0; const p = c.world(-0.3, -(c.spec.halfW + 1.0), G.eye.clone()); G.stage.colliders.resolve(p, 0.4); G.controller.setPose(p.x, p.z, Math.atan2(-(c.pos.x - p.x), -(c.pos.z - p.z)), -0.1); return 1; })()`).catch(() => 0);
    await sleep(500);
    await js(`(window.__o3lat.frames = [], window.__o3lat.on = true, 1)`);
    await sleep(150);
    const t = await js('performance.now()');
    await keyDown('KeyE'); await sleep(60); await keyUp('KeyE');
    await sleep(500);
    const F = await js(`(window.__o3lat.on = false, window.__o3lat.frames)`);
    let first = null;
    for (let k = 1; k < F.length; k++) if (F[k][0] > t && (F[k][5] !== F[k - 1][5] || Math.abs(F[k][3] - F[k - 1][3]) > 0.002)) { first = F[k][0] - t; break; }
    ins.push(first == null ? null : +first.toFixed(1));
    if (i === 0) R.carFrames0 = F.filter((f) => f[0] > t - 40 && f[0] < t + 250).map((f) => +(f[0] - t).toFixed(0) + ':' + f[4] + f[5] + ':' + f[3]);
    R.stolen = await js(`({ inCar: G.city.inCar, police: !!(G.city.car && G.city.car.police), heat: G.police.heat, last: G.crime.log.slice(-1)[0] && G.crime.log.slice(-1)[0].kind })`);
    // out again for the next
    await sleep(900);
    await keyDown('KeyE'); await sleep(60); await keyUp('KeyE');
    await sleep(1500);
  }
  R.carE = ins;
  const med = (L) => { const a = L.filter((v) => v != null).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null; };
  R.fistMedian = med(fist); R.carEMedian = med(ins);
  R.ok = ok && fist.every((v) => v != null) && ins.every((v) => v != null) && R.fistMedian < 50 && R.carEMedian < 50;
  log(`latency: ${JSON.stringify(R)}`);
  return R;
}

// ---- the strips: frames of an arrest, a witness's run, the roadblock (shots s_00.. for tools/plays/o3/tile.py) ----
async function strip(api) {
  const { js, shot, sleep, log, opts, turn } = api;
  const R = { frames: 0 };
  const snap = async () => { await shot('s_' + String(R.frames).padStart(2, '0')); R.frames++; };
  if (opts.what === 'arrest') {
    // the cop comes face on: me looking at him over the man I put down
    await stagePunch(api, { copD: 16 });
    await click(api); await sleep(320); await click(api);
    await sleep(500); await snap();
    for (let i = 0; i < 9 && R.frames < 9; i++) {
      await sleep(opts.every ?? 1300);
      const c = await js(`window.__o3c && window.__o3c.standing ? { x: window.__o3c.pos.x, z: window.__o3c.pos.z } : null`);
      if (c) await turnTo(api, c.x, c.z, { pitch: -0.08, steps: 3 });
      await snap();
      if ((await js('!!G.failing')) === true) break;
    }
    await waitFor(js, `!G.failing && G.scenes.beat === 'station'`, 15000);
    await sleep(900); await snap();
  } else if (opts.what === 'witness') {
    await stagePunch(api, { cop: false, civ: [8, 4.5] });
    await click(api); await sleep(320); await click(api);
    for (let i = 0; i < 12; i++) {
      await sleep(opts.every ?? 1200);
      const w = await js(`({ x: window.__o3w.pos.x, z: window.__o3w.pos.z, m: window.__o3w.mode, ph: window.__o3w.phase })`);
      await turnTo(api, w.x, w.z, { pitch: -0.06, steps: 3 });
      // (I follow him at a walk, a few steps behind: the box comes into the frame)
      const d = await js(`Math.hypot(window.__o3w.pos.x - G.eye.x, window.__o3w.pos.z - G.eye.z)`);
      if (d > 9) await goTo(api, w.x, w.z, { near: 7, ms: 900 });
      await snap();
      if (w.ph === 'call' && i > 3) { await sleep(1500); await snap(); break; }
    }
    R.heat = await js('G.police.heat');
  } else if (opts.what === 'roadblock') {
    await js(`(() => { const P = G.people; P.dbgClear(); P.dbgAtCar(); return 1; })()`);
    await sleep(300);
    if (!(await js('G.city.inCar'))) { await tap(api, 'KeyE'); await sleep(1200); }
    await js(`(G.police.raise(3, G.city.car.pos, 'staged'), 1)`);
    // drive on along the road until the block is put across it ahead, then on toward it, braking to a stop short of it
    const { keyDown, keyUp } = api;
    await keyDown('KeyW');
    await waitFor(js, '!!G.police.block', 20000);
    await keyUp('KeyW');
    for (let i = 0; i < 12; i++) {
      const b = await js(`(() => { const B = G.police.block, c = G.city.car; if (!B) return null; const d = Math.hypot(B.x - c.pos.x, B.z - c.pos.z); const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw); const ang = Math.atan2(fx * (B.z - c.pos.z) - fz * (B.x - c.pos.x), fx * (B.x - c.pos.x) + fz * (B.z - c.pos.z)); return { d, ang, v: c.speed }; })()`);
      if (!b) break;
      if (b.d > 22) { await keyDown('KeyW'); if (b.ang > 0.05) await keyDown('KeyD'); else if (b.ang < -0.05) await keyDown('KeyA'); }
      await sleep(b.d > 40 ? 900 : 600);
      await keyUp('KeyW'); await keyUp('KeyD'); await keyUp('KeyA');
      if (b.d < 30) { await keyDown('KeyS'); await sleep(500); await keyUp('KeyS'); }
      await snap();
      if (b.d < 16 && Math.abs(b.v) < 1) break;
    }
  }
  log(`strip ${opts.what}: ${JSON.stringify(R)}`);
  R.ok = R.frames >= 5;
  return R;
}

// ---- the soak: ten minutes at HEAT 3 (in the car, chased, the heat put back each time it falls), the memory read every two minutes ----
async function soak(api) {
  const { js, log, sleep, send, opts } = api;
  const R = { reads: [] };
  const T0 = Date.now(), secs = opts.secs ?? 600;
  const read = async (label) => {
    await send('HeapProfiler.collectGarbage', {});
    const h = (await send('Runtime.getHeapUsage', {})).result || {};
    const m = await js(`({ geo: G.pipeline.renderer.info.memory.geometries, tex: G.pipeline.renderer.info.memory.textures, progs: G.pipeline.renderer.info.programs.length, people: G.people.list.length, pooled: [...G.people.pool.values()].reduce((a, L) => a + L.length, 0), made: G.people.stats.made, hoods: G.stage.hoods.list.length, cars: G.vehicles.list.length, heat: G.police.heat, arrests: G.counters.arrests || 0 })`);
    const r = { label, t: Math.round((Date.now() - T0) / 1000), heapMB: +((h.usedSize || 0) / 1048576).toFixed(1), ...m };
    R.reads.push(r); log(`soak read ${JSON.stringify(r)}`);
  };
  await read('start');
  let nextRead = 120;
  while ((Date.now() - T0) / 1000 < secs) {
    await waitFor(js, '!G.failing && G.state === "playing"', 30000);
    if (!(await js('G.city.inCar'))) { await js('(G.people.dbgAtCar(), 1)'); await sleep(300); await tap(api, 'KeyE'); await sleep(1200); }
    await js(`(G.police.heat < 3 && G.police.raise(3, G.city.inCar ? G.city.car.pos : G.eye, 'soak'), 1)`);
    await driveAway(api, { vmax: 18, look: 1.1, react: 110, secs: 45, until: 'false' });
    if ((Date.now() - T0) / 1000 >= nextRead) { await read('t' + nextRead); nextRead += 120; }
  }
  await read('end');
  const a = R.reads[1] || R.reads[0], z = R.reads[R.reads.length - 1];
  R.growMB = +(z.heapMB - a.heapMB).toFixed(1); R.growGeo = z.geo - a.geo; R.growTex = z.tex - a.tex;
  R.ok = R.growMB < 15 && R.growGeo < 150 && R.growTex < 10;
  return R;
}
