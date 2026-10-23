// [O6 critic] a cold player's pokes at the destruction set, by real input at a
// human pace (play.mjs's module driver: { "drive": "tools/plays/critic/o6/poke.mjs", "mode": ... }).
//   foot   walk into standing things, shoot what stands (a slow aim, short bursts), look
//   ram    in the coupe: into the sedan, the lorry, the shop glass, a wall
//   fire   shoot the sedan from close until it burns, then stand there (idle) / walk off (good)
//   lat    LMB press -> the first frame a thing answers (page clock)
const EV = (n) => `G.stage.smash.events.slice(${n}).map((e) => e.kind + ':' + e.what + ':' + e.by)`;
async function aim({ js, turn, sleep }, p, slow = 6) {
  for (let k = 0; k < 4; k++) {
    const s = await js(`(() => { const C = N.controller, e = G.camera.position; const dx = ${p[0]} - e.x, dy = ${p[1]} - e.y, dz = ${p[2]} - e.z; let dyaw = Math.atan2(-dx, -dz) - C.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); return { dyaw, dpitch: Math.atan2(dy, Math.hypot(dx, dz)) - C.pitch, sens: C.sensitivity }; })()`);
    if (Math.abs(s.dyaw) < 0.01 && Math.abs(s.dpitch) < 0.01) return true;
    const px = -s.dyaw / s.sens, py = -s.dpitch / s.sens;
    for (let i = 0; i < slow; i++) { await turn(px / slow, py / slow); await sleep(30); }
    await sleep(120);
  }
  return false;
}
async function walkTo({ js, keyDown, keyUp, sleep, turn }, x, z, timeout = 12000) {
  const T0 = Date.now();
  await keyDown('KeyW');
  let s;
  for (;;) {
    s = await js(`(() => { const C = N.controller; const dx = ${x} - C.pos.x, dz = ${z} - C.pos.z; let d = Math.atan2(-dx, -dz) - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return { d: Math.hypot(dx, dz), dyaw: d, sens: C.sensitivity }; })()`);
    if (s.d < 0.6 || Date.now() - T0 > timeout) break;
    if (Math.abs(s.dyaw) > 0.05) await turn(-s.dyaw / s.sens * 0.7, 0);
    await sleep(40);
  }
  await keyUp('KeyW');
  await sleep(200);
  return s.d < 0.6;
}
// W held straight at a point for ms; the eye's closest approach to it
async function pushInto(api, x, z, ms = 2500) {
  const { js, keyDown, keyUp, sleep, turn } = api;
  const s = await js(`(() => { const C = N.controller; let d = Math.atan2(-(${x} - C.pos.x), -(${z} - C.pos.z)) - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return { dyaw: d, sens: C.sensitivity }; })()`);
  await turn(-s.dyaw / s.sens, 0); await sleep(150);
  await js(`(() => { const W = window.__c6 = { min: 99 }; const tick = () => { const p = N.controller.pos; W.min = Math.min(W.min, Math.hypot(p.x - ${x}, p.z - ${z})); if (!W.stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
  await keyDown('KeyW'); await sleep(ms); await keyUp('KeyW');
  return js('(() => { window.__c6.stop = true; const p = N.controller.pos; return { min: +window.__c6.min.toFixed(2), end: [+p.x.toFixed(2), +p.z.toFixed(2)] }; })()');
}
async function burst(api, ms = 300) {
  const { mouse, sleep, cursor } = api;
  const [x, y] = cursor();
  await mouse('mousePressed', x, y, 'left'); await sleep(ms); await mouse('mouseReleased', x, y, 'left');
  await sleep(350);
}
async function reloadIf(api) {
  if (await api.js('G.weapon && G.weapon.ammo < 10')) { await api.keyDown('KeyR'); await api.sleep(80); await api.keyUp('KeyR'); await api.sleep(2800); }
}
const ITEM = (kind, x, z) => `(() => { const it = G.stage.smash.items.find((i) => i.kind === '${kind}' && Math.abs(i.x - (${x})) < 0.3 && Math.abs(i.z - (${z})) < 0.3); return it ? { state: it.state, dark: !!it.dark, out: !!it.lie, lie: it.lie ? [+it.lie.cx.toFixed(2), +it.lie.cz.toFixed(2)] : null, y: it.body ? +it.body.p?.y?.toFixed?.(2) : null } : null; })()`;

async function foot(api) {
  const { js, log, sleep, shot } = api;
  const R = {};
  // 1. walk into the standing newsstand (from the north, along the pavement)
  await walkTo(api, -110.4, 27.5);
  R.intoNewsstand = await pushInto(api, -109.9, 24.0);
  log('into newsstand ' + JSON.stringify(R.intoNewsstand) + ' ' + JSON.stringify(await js(ITEM('newsstand', -109.9, 24))));
  // 2. step into the road, shoot the hydrant from 4 m
  await walkTo(api, -114.5, 21.5);
  let n = await js('G.stage.smash.events.length');
  await aim(api, [-110.45, 0.5, 20.6]);
  await burst(api);
  await sleep(500);
  await shot('f1_hydrant');
  R.hydrant = await js(EV(n));
  log('hydrant ' + JSON.stringify(R.hydrant));
  // 3. the stall and its crates
  n = await js('G.stage.smash.events.length');
  await aim(api, [-109.9, 1.1, 17.6]);
  for (let k = 0; k < 3; k++) await burst(api);
  await sleep(600);
  await shot('f2_stall');
  R.stall = await js(EV(n));
  log('stall ' + JSON.stringify(R.stall) + ' ' + JSON.stringify(await js(ITEM('stall', -109.9, 17.6))));
  await reloadIf(api);
  // 4. a lamp's head (-110.3, 14)
  n = await js('G.stage.smash.events.length');
  const head = await js('(() => { const l = G.stage.lamps.all.find((l) => Math.abs(l.x + 110.3) < 0.1 && Math.abs(l.z - 14) < 0.1); return l ? [l.head.x, l.head.y - 0.1, l.head.z] : null; })()');
  if (head) { await aim(api, head); await burst(api, 200); await sleep(1500); await shot('f3_lamp'); }
  R.lamp = await js(EV(n));
  log('lamp ' + JSON.stringify(R.lamp) + ' ' + JSON.stringify(await js(ITEM('lamp', -110.3, 14))));
  await reloadIf(api);
  // 5. the toppled stall: walk into it
  const st = await js(ITEM('stall', -109.9, 17.6));
  if (st && st.lie) {
    await walkTo(api, st.lie[0] - 3.2, st.lie[1]);
    R.intoStall = await pushInto(api, st.lie[0], st.lie[1]);
    log('into the stall lying ' + JSON.stringify(R.intoStall) + ' lie ' + JSON.stringify(st.lie));
  } else log('stall not lying: ' + JSON.stringify(st));
  // 6. the shop glass across the road (-133.9, 1.5, 33.7) from 5 m, then walk through where it was
  await walkTo(api, -128.5, 33.7, 15000);
  n = await js('G.stage.smash.events.length');
  await aim(api, [-133.9, 1.5, 33.7]);
  await burst(api, 250);
  await sleep(500);
  await shot('f4_glass');
  R.glass = await js(`G.stage.smash.items.filter((i) => i.kind === 'glass' && i.pane && i.pane.state !== 'whole').map((i) => i.z + ':' + i.pane.state)`);
  R.intoGlass = await pushInto(api, -134.5, 33.7, 2500);
  log('glass ' + JSON.stringify(R.glass) + ' then into the window ' + JSON.stringify(R.intoGlass));
  // 7. punch / E at a crate across? E on a standing bin (-129.6, 38.6): does E answer anything
  await walkTo(api, -128.2, 38.6);
  n = await js('G.stage.smash.events.length');
  await aim(api, [-129.6, 0.5, 38.6]);
  await api.keyDown('KeyE'); await sleep(80); await api.keyUp('KeyE'); await sleep(500);
  R.eBin = { ev: await js(EV(n)), prompt: await js(`[...document.querySelectorAll('body *')].filter(e=>e.offsetParent&&e.children.length===0&&e.innerText&&e.innerText.trim()).map(e=>e.innerText.trim().slice(0,40)).join(' | ')`) };
  // walk into the standing bin
  R.intoBin = await pushInto(api, -129.6, 38.6, 2000);
  R.intoBinAfter = await js(ITEM('bin', -129.6, 38.6));
  log('E at bin ' + JSON.stringify(R.eBin) + ' into bin ' + JSON.stringify(R.intoBin) + ' ' + JSON.stringify(R.intoBinAfter));
  return R;
}

// ---- ram: in the coupe into the sedan, the lorry, the glass ----
async function steerTo({ js, keyDown, keyUp, sleep }, x, z, { until = 6000, brakeAt = null } = {}) {
  const T0 = Date.now();
  await keyDown('KeyW');
  let held = null, s;
  while (Date.now() - T0 < until) {
    s = await js(`(() => { const c = G.city.car; const dx = ${x} - c.pos.x, dz = ${z} - c.pos.z; const f = c.fwd; const cr = f.x * dz - f.z * dx; return { d: Math.hypot(dx, dz), cr, v: c.speed }; })()`);
    if (s.d < 1) break;
    const want = Math.abs(s.cr) / Math.max(s.d, 1) > 0.06 ? (s.cr > 0 ? 'KeyD' : 'KeyA') : null;
    if (want !== held) { if (held) await keyUp(held); if (want) await keyDown(want); held = want; }
    await sleep(40);
  }
  if (held) await keyUp(held);
  await keyUp('KeyW');
  return s;
}
const CAR = (i) => `(() => { const c = G.city.cars[${i}] || G.city.car; const D = c.smashD; return { v: +(c.speed * 3.6).toFixed(0), dmg: +(c.damage || 0).toFixed(2), state: D ? D.state : null, wreck: !!c.wrecked, pos: [+c.pos.x.toFixed(1), +c.pos.z.toFixed(1)] }; })()`;
async function ram(api) {
  const { js, log, sleep, shot, keyDown, keyUp } = api;
  const R = { hits: [] };
  await keyDown('KeyE'); await sleep(80); await keyUp('KeyE');
  await sleep(1200);
  // a tracer: the car's speed each frame (the drops are the hits), its deepest point past the shop fronts' line, the closest to the sedan's middle
  await js(`(() => { const F = window.__fl = []; const t2 = () => { const w = G.hud.kit.warnText || null; if (w && F[F.length - 1] !== w) F.push(+G.time.toFixed(1) + ' ' + w); if (G.failing && !F.includes('FAIL')) { F.push('FAIL'); F.push(+G.time.toFixed(1) + ' ' + JSON.stringify(G.lastFail)); } requestAnimationFrame(t2); }; requestAnimationFrame(t2); return 1; })()`);
  await js(`(() => { const W = window.__tr = { hits: [], past: 0, pastAt: null, sedanMin: 99, lorryMin: 99, prev: null }; const tick = () => { const c = G.city.car; if (c) { const v = c.speed * 3.6; if (W.prev != null && W.prev - v > 4) W.hits.push([+G.time.toFixed(2), +W.prev.toFixed(0), +v.toFixed(0), +c.pos.x.toFixed(1), +c.pos.z.toFixed(1)]); W.prev = v; if (c.pos.z > 12 && c.pos.z < 49) { const d = -134 - (c.pos.x - 0.95); if (d > W.past) { W.past = d; W.pastAt = [+c.pos.x.toFixed(2), +c.pos.z.toFixed(2)]; } } const s = G.city.cars[2], l = G.city.cars[1]; W.sedanMin = Math.min(W.sedanMin, Math.hypot(s.pos.x - c.pos.x, s.pos.z - c.pos.z)); W.lorryMin = Math.min(W.lorryMin, Math.hypot(l.pos.x - c.pos.x, l.pos.z - c.pos.z)); } if (!W.stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
  R.cars = await js('G.city.cars.map((c, i) => i + ":" + (c.kind || c.type || c.model) + "@" + c.pos.x.toFixed(0) + "," + c.pos.z.toFixed(0))');
  log('cars ' + JSON.stringify(R.cars));
  // north, then swing to the sedan across the road at (-127.4, 6) from the north-east
  for (let k = 0; k < 3; k++) {
    const s0 = await js(CAR(-1));
    await steerTo(api, -127.4, 6.0, { until: 7000 });
    await sleep(700);
    const me = await js(CAR(-1)), sd = await js(CAR(2));
    R.hits.push({ k, me, sedan: sd });
    log('fail? ' + JSON.stringify(await js('({ lf: G.lastFail || null, failing: !!G.failing, warn: G.hud.kit.warnText || null, inCar: G.city.inCar, tram: G.city.tram ? [+G.city.tram.pos.x.toFixed(1), +G.city.tram.pos.z.toFixed(1)] : null })')));
    log(`ram sedan ${k}: me ${JSON.stringify(me)} sedan ${JSON.stringify(sd)}`);
    if (k === 0) await shot('r1_sedan');
    // back off 2 s
    await keyDown('KeyS'); await sleep(1800); await keyUp('KeyS');
    await sleep(400);
  }
  // into the shop glass / facade at speed (-134, 43.9)
  await keyDown('KeyS'); await sleep(1500); await keyUp('KeyS');
  const g0 = await steerTo(api, -134.6, 43.9, { until: 9000 });
  await sleep(800);
  R.glassRam = { me: await js(CAR(-1)), panes: await js(`G.stage.smash.items.filter((i) => i.kind === 'glass' && i.pane && i.pane.state !== 'whole').map((i) => i.z + ':' + i.pane.state)`), eye: await js('[+G.camera.position.x.toFixed(2), +G.camera.position.z.toFixed(2)]') };
  await shot('r2_window');
  log('glass ram ' + JSON.stringify(R.glassRam));
  // the lorry at (-127.3, 54): back out and drive into it
  await keyDown('KeyS'); await sleep(1600); await keyUp('KeyS');
  await steerTo(api, -127.3, 54, { until: 8000 });
  await sleep(700);
  R.lorry = { me: await js(CAR(-1)), lorry: await js(CAR(1)) };
  log('lorry ram ' + JSON.stringify(R.lorry));
  await shot('r3_lorry');
  R.trace = await js('(() => { const W = window.__tr; W.stop = true; return { hits: W.hits.slice(0, 30), past: +W.past.toFixed(2), pastAt: W.pastAt, sedanMin: +W.sedanMin.toFixed(2), lorryMin: +W.lorryMin.toFixed(2) }; })()');
  log('trace ' + JSON.stringify(R.trace));
  R.fl = await js('window.__fl');
  log('warns and fails ' + JSON.stringify(R.fl));
  return R;
}

// ---- fire: shoot the sedan from close until it burns; then idle near it ----
async function fire(api) {
  const { js, log, sleep, shot } = api;
  const R = { t: [] };
  await walkTo(api, -122.5, 10.5, 15000);
  const T0 = Date.now();
  const st = () => js(`(() => { const c = G.city.cars[2], D = c.smashD; return { s: +((Date.now() - ${T0}) / 1000).toFixed(1), dmg: +c.damage.toFixed(2), state: D ? D.state : null, wreck: !!c.wrecked, hp: G.health.hp, warn: G.hud.kit.warnText || null, failing: !!G.failing, why: G.lastFail && G.lastFail.why, eye: [+G.camera.position.x.toFixed(1), +G.camera.position.z.toFixed(1)] }; })()`);
  for (let k = 0; k < 25; k++) {
    const s = await st();
    if (s.state === 'burning' || s.wreck) break;
    const p = await js('(() => { const c = G.city.cars[2]; const f = c.fwd; return [c.pos.x + f.x * 1.6, 0.85, c.pos.z + f.z * 1.6]; })()');
    await aim(api, p, 3);
    await burst(api, 250);
    await reloadIf(api);
    if (k % 3 === 0) { R.t.push(await st()); }
  }
  R.t.push(await st());
  await shot('x1_burning');
  // idle: hands off, 4.5 m from it
  for (let k = 0; k < 40; k++) {
    const s = await st();
    R.t.push(s);
    if (k === 6) await shot('x2_burning_on');
    if (s.wreck || s.failing) { await sleep(150); await shot('x3_blast'); R.t.push(await st()); break; }
    await sleep(400);
  }
  await sleep(2500);
  R.t.push(await st());
  await shot('x4_after');
  return R;
}

// ---- lat: LMB press -> the first frame a thing answers; W into a bin in the car -> its first frame
async function lat(api) {
  const { js, log, sleep, mouse, cursor } = api;
  const out = [];
  await walkTo(api, -114.5, 3.4);
  for (const p of [[-110.35, 0.6, 3.4], [-109.95, 0.6, 1.2], [-110.4, 1.5, 6.5]]) {
    await aim(api, p);
    await sleep(300);
    await js(`(() => { const W = window.__lat = { n: G.stage.smash.events.length, down: null, first: null, frames: 0 }; addEventListener('mousedown', () => { if (W.down == null) W.down = performance.now(); }, { capture: true, once: true }); const tick = (t) => { if (W.down != null) { W.frames++; if (W.first == null && G.stage.smash.events.length > W.n) W.first = performance.now(); } if (W.first == null && W.frames < 120) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
    const [x, y] = cursor();
    await mouse('mousePressed', x, y, 'left'); await sleep(90); await mouse('mouseReleased', x, y, 'left');
    await sleep(800);
    const r = await js('(() => { const W = window.__lat; return { ms: W.first != null ? +(W.first - W.down).toFixed(1) : null, frames: W.frames, ev: G.stage.smash.events.slice(W.n).map((e) => e.kind + ":" + e.what) }; })()');
    out.push(r);
    log('lat ' + JSON.stringify(r));
  }
  return out;
}

// ---- seen: a hydrant shot and a lamp shot, frames in time (what the eye gets)
async function seen(api) {
  const { js, log, sleep, shot } = api;
  const R = {};
  await walkTo(api, -114.0, 20.6);
  await aim(api, [-110.45, 0.5, 20.6]);
  let n = await js('G.stage.smash.events.length');
  await burst(api, 200);
  await shot('s1_hydrant_0'); await sleep(500); await shot('s2_hydrant_1'); await sleep(1500); await shot('s3_hydrant_2');
  R.hydrant = { ev: await js(EV(n)), it: await js(ITEM('hydrant', -110.45, 20.6)), jets: await js('G.stage.smash.water ? G.stage.smash.water.length : null') };
  log('hydrant ' + JSON.stringify(R.hydrant));
  await walkTo(api, -114.5, 18.5);
  const head = await js('(() => { const l = G.stage.lamps.all.find((l) => Math.abs(l.x + 110.3) < 0.1 && Math.abs(l.z - 14) < 0.1); return l ? [l.head.x, l.head.y - 0.1, l.head.z] : null; })()');
  await aim(api, head);
  n = await js('G.stage.smash.events.length');
  await burst(api, 150);
  const L = () => js('(() => { const it = G.stage.smash.items.find((i) => i.kind === "lamp" && Math.abs(i.x + 110.3) < 0.1 && Math.abs(i.z - 14) < 0.1); const l = G.stage.lamps.all.find((l) => Math.abs(l.x + 110.3) < 0.1 && Math.abs(l.z - 14) < 0.1); return { dark: !!it.dark, state: it.state, lvl: l && l.level != null ? +l.level.toFixed(2) : (l && l.on), keys: l ? Object.keys(l).join(",") : null }; })()');
  R.lamp = [await L()];
  await shot('s4_lamp_0'); await sleep(300); R.lamp.push(await L()); await shot('s5_lamp_03'); await sleep(900); R.lamp.push(await L()); await shot('s6_lamp_12'); await sleep(2000); R.lamp.push(await L()); await shot('s7_lamp_32');
  R.lampEv = await js(EV(n));
  log('lamp ' + JSON.stringify(R));
  return R;
}

// ---- tram: sit in the coupe on the rails, hands off, as the tram comes
async function tramSit(api) {
  const { js, log, sleep, shot, keyDown, keyUp } = api;
  await js(`(() => { const F = window.__fl = []; const t2 = () => { const w = G.hud.kit.warnText || null; if (w && F[F.length - 1] !== w) F.push(+G.time.toFixed(1) + ' ' + w); if (G.failing && !F.includes('FAIL')) { F.push('FAIL'); F.push(+G.time.toFixed(1) + ' ' + JSON.stringify(G.lastFail)); } requestAnimationFrame(t2); }; requestAnimationFrame(t2); return 1; })()`);
  if (api.opts.onFoot) { await walkTo(api, -117, 22); await walkTo(api, -121.9, 20); }
  else {
    await keyDown('KeyE'); await sleep(80); await keyUp('KeyE');
    await sleep(1200);
    await steerTo(api, -112.4, 12, { until: 4000 });
    await steerTo(api, -121.9, 2, { until: 4000 });
    await keyDown('Space'); await sleep(1500); await keyUp('Space');
  }
  const R = { t: [] };
  let shotN = 0;
  for (let k = 0; k < 90; k++) {
    const s = await js((api.opts.onFoot ? '({ foot: 1, ' : '({ ') + 't: +G.time.toFixed(1), tram: +G.city.tram.pos.z.toFixed(1), me: ' + (api.opts.onFoot ? '1' : '0') + ' ? [+G.camera.position.x.toFixed(1), +G.camera.position.z.toFixed(1)] : [+G.city.car.pos.x.toFixed(1), +G.city.car.pos.z.toFixed(1)], v: +(G.city.car.speed*3.6).toFixed(0), dmg: +G.city.car.damage.toFixed(2), st: G.city.car.smashD ? G.city.car.smashD.state : null, inCar: G.city.inCar, hp: G.health.hp, eye: [+G.camera.position.x.toFixed(1), +G.camera.position.z.toFixed(1)], failing: !!G.failing })');
    if (k % 5 === 0 || s.failing || Math.abs(s.tram - s.me[1]) < 16) R.t.push(s);
    if (Math.abs(s.tram - s.me[1]) < 9 && shotN < 2) { await shot('t' + shotN); shotN++; }
    if (s.failing) { await sleep(1500); await shot('t_fail'); break; }
    if (s.tram < s.me[1] - 25) break;
    await sleep(500);
  }
  R.fl = await js('window.__fl');
  R.end = await js('({ lf: G.lastFail || null, me: G.city.car && [+G.city.car.pos.x.toFixed(1), +G.city.car.pos.z.toFixed(1)], eye: [+G.camera.position.x.toFixed(1), +G.camera.position.z.toFixed(1)], inCar: G.city.inCar, txt: [...document.querySelectorAll("body *")].filter(e=>e.offsetParent&&e.children.length===0&&e.innerText&&e.innerText.trim()).map(e=>e.innerText.trim().slice(0,50)).join(" | ") })');
  log('tram ' + JSON.stringify(R));
  return R;
}

// ---- selfburn: my own coupe into walls until it burns, hands on; what the screen says, then (idle) stay in it
async function selfburn(api) {
  const { js, log, sleep, shot, keyDown, keyUp } = api;
  await keyDown('KeyE'); await sleep(80); await keyUp('KeyE');
  await sleep(1200);
  await js(`(() => { const F = window.__fl = []; const t2 = () => { const w = G.hud.kit.warnText || null; if (w && F[F.length - 1] !== w) F.push(+G.time.toFixed(1) + ' ' + w); if (G.failing && !F.includes('FAIL')) { F.push('FAIL'); F.push(+G.time.toFixed(1) + ' ' + JSON.stringify(G.lastFail)); } requestAnimationFrame(t2); }; requestAnimationFrame(t2); return 1; })()`);
  const st = () => js('({ t: +G.time.toFixed(1), v: +(G.city.car.speed*3.6).toFixed(0), dmg: +G.city.car.damage.toFixed(2), st: G.city.car.smashD ? G.city.car.smashD.state : null, fuse: G.city.car.smashD && G.city.car.smashD.fuse != null ? +G.city.car.smashD.fuse.toFixed(1) : null, wreck: !!G.city.car.wrecked, inCar: G.city.inCar, hp: G.health.hp, failing: !!G.failing, pos: [+G.city.car.pos.x.toFixed(1), +G.city.car.pos.z.toFixed(1)] })');
  const R = { t: [] };
  // north a little, then into the east facade, back, again
  await steerTo(api, -112.3, 12, { until: 2500 });
  for (let k = 0; k < 10; k++) {
    let s = await st();
    if (s.st === 'burning' || s.wreck || s.failing || !s.inCar) break;
    await keyDown('KeyS'); await sleep(1300); await keyUp('KeyS');
    await keyDown('KeyW'); await keyDown('KeyD'); await sleep(450); await keyUp('KeyD'); await sleep(1500); await keyUp('KeyW');
    await keyDown('KeyA'); await sleep(10); await keyUp('KeyA');
    await sleep(300);
    s = await st(); R.t.push(s);
    log('ram ' + k + ' ' + JSON.stringify(s));
  }
  await shot('b1');
  // idle (opts.leave: E out after that many ms and walk away, W)
  for (let k = 0; k < 40; k++) {
    const s = await st(); R.t.push(s);
    if (k === 2) await shot('b2');
    if (api.opts.leave != null && k * 300 >= api.opts.leave && s.inCar) { await keyDown('KeyE'); await sleep(80); await keyUp('KeyE'); await sleep(300); await keyDown('KeyW'); await sleep(3000); await keyUp('KeyW'); }
    if (s.failing || s.wreck) { await sleep(400); await shot('b3'); R.t.push(await st()); break; }
    await sleep(300);
  }
  await sleep(1500);
  R.t.push(await st());
  R.fl = await js('window.__fl');
  R.end = await js('({ lf: G.lastFail || null, txt: [...document.querySelectorAll("body *")].filter(e=>e.offsetParent&&e.children.length===0&&e.innerText&&e.innerText.trim()).map(e=>e.innerText.trim().slice(0,50)).join(" | ") })');
  log('fl ' + JSON.stringify(R.fl) + ' end ' + JSON.stringify(R.end));
  return { n: R.t.length };
}

// ---- firebeat (?start=smash.fire): E into the burning coupe; leave after opts.leave ms (null: idle), walk (run: Shift) for 3.5 s
async function firebeat(api) {
  const { js, log, sleep, shot, keyDown, keyUp } = api;
  await js(`(() => { const F = window.__fl = []; let lw = null; const t2 = () => { const w = G.hud.kit.warnText || null; if (w !== lw) { lw = w; F.push(+G.time.toFixed(1) + ' warn ' + w); } const o = G.hud.kit.objText || (G.hud.objective && G.hud.objective.text) || null; if (G.failing && !F.includes('FAIL')) { F.push('FAIL'); F.push(+G.time.toFixed(1) + ' ' + JSON.stringify(G.lastFail)); } requestAnimationFrame(t2); }; requestAnimationFrame(t2); return 1; })()`);
  const st = () => js('({ t: +G.time.toFixed(1), dmg: +G.city.car.damage.toFixed(2), st: G.city.car.smashD ? G.city.car.smashD.state : null, fuse: G.city.car.smashD && G.city.car.smashD.fuse != null ? +G.city.car.smashD.fuse.toFixed(1) : null, wreck: !!G.city.car.wrecked, inCar: G.city.inCar, hp: G.health.hp, failing: !!G.failing, d: +Math.hypot(G.camera.position.x - G.city.car.pos.x, G.camera.position.z - G.city.car.pos.z).toFixed(1) })');
  const R = { t: [], tries: [] };
  for (let tryN = 0; tryN < (api.opts.tries || 1); tryN++) {
    await js('new Promise((r) => { const w = () => (!G.failing && G.scenes.fadeK < 0.05 && G.city.car && !G.city.car.wrecked) ? r(1) : setTimeout(w, 100); w(); })');
    await sleep(api.opts.wait0 ?? 600);
    if (tryN === 0) R.first = await st();
    const t0 = Date.now();
    if (api.opts.press === 'F') { await keyDown('KeyF'); await sleep(70); await keyUp('KeyF'); await sleep(300); }
    await keyDown('KeyE'); await sleep(70); await keyUp('KeyE');
    let left = false, out = null;
    for (let k = 0; k < 80; k++) {
      const s = await st();
      if (k % 2 === 0) R.t.push(s);
      if (!left && api.opts.leave != null && Date.now() - t0 >= api.opts.leave + (tryN * (api.opts.faster || 0))) {
        left = true;
        await keyDown('KeyE'); await sleep(70); await keyUp('KeyE'); await sleep(api.opts.react ?? 250);
        if (api.opts.run) await keyDown('ShiftLeft');
        await keyDown('KeyW'); await sleep(3500); await keyUp('KeyW');
        if (api.opts.run) await keyUp('ShiftLeft');
      }
      if (s.failing) { out = 'FAIL'; await sleep(300); await shot('fb_fail_' + tryN); break; }
      if (s.wreck) { await sleep(1500); out = { wreck: true, after: await st() }; break; }
      await sleep(150);
    }
    R.tries.push(out);
    log('try ' + tryN + ' ' + JSON.stringify(out));
    if (out !== 'FAIL') break;
  }
  R.fl = await js('window.__fl');
  log('firebeat ' + JSON.stringify({ first: R.first, tries: R.tries, fl: R.fl }));
  return { tries: R.tries };
}

// ---- lamp2: a frame of the lamp at (-110.3, 14) and its pool before, then shot out, from 9 m across the road
async function lamp2(api) {
  const { js, log, sleep, shot } = api;
  await walkTo(api, -118.5, 17.5);
  const head = await js('(() => { const l = G.stage.lamps.all.find((l) => Math.abs(l.x + 110.3) < 0.1 && Math.abs(l.z - 14) < 0.1); return [l.head.x, l.head.y - 0.1, l.head.z]; })()');
  await aim(api, [-110.3, 2.6, 14]);
  await sleep(500);
  await shot('l0_before');
  await aim(api, head);
  await burst(api, 150);
  await sleep(300);
  await aim(api, [-110.3, 2.6, 14]);
  await sleep(3500);
  await shot('l1_after');
  const r = await js('(() => { const it = G.stage.smash.items.find((i) => i.kind === "lamp" && Math.abs(i.x + 110.3) < 0.1 && Math.abs(i.z - 14) < 0.1); const l = it.lamp; const S = G.stage.lamps; const spot = S.pool ? S.pool.find((s) => s.lamp === l) : null; return { dark: !!it.dark, dead: l && l.dead, on: l && l.on, spot: spot ? +spot.spot.intensity.toFixed(1) : "none", cone: l && l.cone && l.cone.mesh ? l.cone.mesh.visible : null, ev: G.stage.smash.events.map((e) => e.kind + ":" + e.what) }; })()');
  log('lamp2 ' + JSON.stringify(r));
  return r;
}

export default async function poke(api) {
  const m = api.opts.mode;
  if (m === 'lamp2') return lamp2(api);
  if (m === 'firebeat') return firebeat(api);
  if (m === 'selfburn') return selfburn(api);
  if (m === 'tram') return tramSit(api);
  if (m === 'seen') return seen(api);
  if (m === 'ram') return ram(api);
  if (m === 'fire') return fire(api);
  if (m === 'lat') return lat(api);
  return foot(api);
}
