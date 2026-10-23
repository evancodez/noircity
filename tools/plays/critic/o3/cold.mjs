// [O3 critic] a cold player's hands in the city, by real input (play.mjs's
// module driver). No staging: whoever the city put there. The bot only reads
// positions to steer as an eye would; every act is keys and the mouse.
//   mode 'punch'  walk to the nearest walker, punch him (LMB x3), then hands
//                 off (opts.after: 'idle' | 'run' | 'fight') and log the city's answer
//   mode 'shoot'  draw (Q) near people, fire twice, hands off, log
//   mode 'carhit' take the nearest car (E), drive into the crowd, log
// The timeline: every 250 ms the heat, the police state, what the screen says.
const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
const SENS = 0.0021;
const SAY = `[...document.querySelectorAll('body *')].filter(e=>e.offsetParent&&e.children.length===0&&e.innerText&&e.innerText.trim()&&getComputedStyle(e).opacity>0.05).map(e=>e.innerText.trim().slice(0,40)).join(' | ')`;
const ST = `({ t: +G.time.toFixed(2), heat: G.police.heat, st: G.police.state, fail: G.failing ? G.failing.phase : null, beat: G.scenes.beat, eye: [+G.eye.x.toFixed(1), +G.eye.z.toFixed(1)], cops: G.people.list.filter(p=>p.role==='cop').map(p=>+Math.hypot(p.pos.x-G.eye.x,p.pos.z-G.eye.z).toFixed(1)).sort((a,b)=>a-b).slice(0,3), cars: (G.police.cars||[]).length, br: (() => { try { const K = JSON.parse(document.getElementById('counters').dataset.json || '{}'); return K.fight ? [K.fight.me, K.fight.him, K.fight.taken, K.fight.hisState, K.fight.myState] : null; } catch (e) { return 'x'; } })(), say: ${SAY} })`;
async function turnTo(api, x, z, pitch = -0.12) {
  const s = await api.js(`({ x: G.eye.x, z: G.eye.z, yaw: G.controller.yaw, pitch: G.controller.pitch })`);
  const want = Math.atan2(-(x - s.x), -(z - s.z));
  const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
  const dx = Math.round(-dy / SENS), dp = Math.round(-(pitch - s.pitch) / SENS);
  for (let i = 0; i < 6; i++) { await api.turn(Math.round(dx / 6), Math.round(dp / 6)); await sleepP(16); }
}
async function chase(api, sel, { near = 1.3, ms = 20000, run = false } = {}) {
  const { js, keyDown, keyUp, turn } = api;
  const T = Date.now() + ms; let ok = false, lastP = null, lastT = 0, side = 1;
  await keyDown('KeyW'); if (run) await keyDown('ShiftLeft');
  while (Date.now() < T) {
    const s = await js(`(() => { const p = ${sel}; if (!p) return null; return { x: G.eye.x, z: G.eye.z, yaw: G.controller.yaw, px: p.pos.x, pz: p.pos.z }; })()`);
    if (!s || s.__exc) { await sleepP(60); continue; }
    if (Math.hypot(s.px - s.x, s.pz - s.z) < near) { ok = true; break; }
    const want = Math.atan2(-(s.px - s.x), -(s.pz - s.z));
    const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    await turn(Math.round(-dy * 0.6 / SENS), 0);
    const now = Date.now();
    if (!lastP || now - lastT > 600) {
      if (lastP && Math.hypot(s.x - lastP[0], s.z - lastP[1]) < 0.3) { const k = (side = -side) > 0 ? 'KeyD' : 'KeyA'; await keyDown(k); await sleepP(350); await keyUp(k); }
      lastP = [s.x, s.z]; lastT = now;
    }
    await sleepP(60);
  }
  await keyUp('KeyW'); if (run) await keyUp('ShiftLeft');
  return ok;
}
async function click(api, button = 'left', ms = 70) { const [x, y] = api.cursor(); await api.mouse('mousePressed', x, y, button); await sleepP(ms); await api.mouse('mouseReleased', x, y, button); }
async function timeline(api, secs, R, label, every = 250, stop = null) {
  const T = Date.now() + secs * 1000; let last = '';
  while (Date.now() < T) {
    const s = await api.js(ST);
    if (s && !s.__exc) { const k = JSON.stringify([s.heat, s.st, s.fail, s.beat, s.say, s.cars, s.br && s.br[2], s.br && s.br[3]]); if (k !== last) { R.log.push(label + ' ' + JSON.stringify(s)); last = k; } if (stop && (await api.js(stop)) === true) return s; }
    await sleepP(every);
  }
}
const NEAREST = (role) => `(() => { let b = null, bd = 1e9; for (const p of G.people.list) { if (p.role !== '${role}' || p.down || p.mode === 'gone') continue; const d = Math.hypot(p.pos.x - G.eye.x, p.pos.z - G.eye.z); if (d < bd) { bd = d; b = p; } } window.__cv = b; return b; })()`;
export default async function cold(api) {
  const { js, opts, shot } = api;
  const R = { log: [] };
  R.pitch0 = await js('G.controller.pitch');
  await api.turn(0, 0); R.pitch1 = await js('G.controller.pitch');
  if (opts.mode === 'watch') { await timeline(api, opts.secs || 40, R, 'watch', 250, '!!G.failing && G.failing.phase === "black"'); R.events = await js(`(G.police.events || []).slice(-16).map(e => JSON.stringify(e).slice(0, 140))`); R.lastFail = await js(`G.lastFail ? { why: G.lastFail.why, to: G.lastFail.to } : null`); return R; }
  if (opts.nearCop) {
    // walk toward the nearest beat cop first, then pick the walker nearest him
    await js(NEAREST('cop'));
    R.copD0 = await js('Math.hypot(window.__cv.pos.x-G.eye.x, window.__cv.pos.z-G.eye.z)'); R.copWalk = await chase(api, 'window.__cv', { near: 14, ms: 60000, run: true }); R.copD1 = await js('Math.hypot(window.__cv.pos.x-G.eye.x, window.__cv.pos.z-G.eye.z)'); R.eyeAfterWalk = await js('[G.eye.x, G.eye.z]');
    await js(`(() => { const c = window.__cv; let b = null, bd = 1e9; for (const p of G.people.list) { if (p.role !== 'walker' || p.down) continue; const d = Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z) + Math.hypot(p.pos.x - G.eye.x, p.pos.z - G.eye.z); if (d < bd) { bd = d; b = p; } } window.__cop = c; window.__cv = b; return 1; })()`);
  } else await js(NEAREST(opts.role || 'walker'));
  const tgt = await js(`window.__cv ? { kind: window.__cv.kind, d: +Math.hypot(window.__cv.pos.x-G.eye.x, window.__cv.pos.z-G.eye.z).toFixed(1) } : null`);
  R.target = tgt;
  if (!tgt) return R;
  if (opts.mode === 'punch' || opts.mode === 'push') {
    R.reached = await chase(api, 'window.__cv', { near: 1.6, run: !!opts.run, ms: 40000 });
    const p = await js('[window.__cv.pos.x, window.__cv.pos.z]'); await turnTo(api, p[0], p[1]);
    if (opts.shots) await shot('o3c_' + opts.mode + '_before');
    const t0 = await js('performance.now()');
    if (opts.mode === 'punch') { R.clicks = 0; for (let i = 0; i < 8; i++) { const q = await js('[window.__cv.pos.x, window.__cv.pos.z, window.__cv.hits, Math.hypot(window.__cv.pos.x-G.eye.x, window.__cv.pos.z-G.eye.z)]'); if (q[2] >= (opts.hits || 2) || await js('G.brawl.active')) break; if (q[3] > 1.9) await chase(api, 'window.__cv', { near: 1.3, ms: 3000 }); await turnTo(api, q[0], q[1]); await click(api); R.clicks++; await sleepP(420); } }
    else { await api.keyDown('KeyE'); await sleepP(80); await api.keyUp('KeyE'); }
    R.victim = await js(`({ mode: window.__cv.mode, down: window.__cv.down, hits: window.__cv.hits })`);
    await timeline(api, 1.5, R, 'hit');
    if (opts.shots) await shot('o3c_' + opts.mode + '_after');
  }
  if (opts.mode === 'shoot') {
    R.reached = await chase(api, 'window.__cv', { near: 8 });
    const t0 = await js('performance.now()');
    await click(api, 'right', 600);
    R.drawMs = await js(`G.player.weapons.current === 'revolver' ? 'out' : 'not out'`);
    R.fleeing = await js(`G.people.list.filter(p => p.role === 'walker' && p.mode === 'flee').length + '/' + G.people.list.filter(p => p.role === 'walker').length`);
    await timeline(api, 1.0, R, 'draw');
    await api.turn(0, -200); await sleepP(100);
    await api.mouse('mousePressed', ...api.cursor(), 'right'); await sleepP(400); await click(api); await sleepP(500); await click(api); await api.mouse('mouseReleased', ...api.cursor(), 'right');
    R.shots = await js('G.people.hands.stats');
    await timeline(api, 1.0, R, 'fired');
    R.fleeing2 = await js(`G.people.list.filter(p => p.role === 'walker' && (p.mode === 'flee' || p.mode === 'cower')).length + '/' + G.people.list.filter(p => p.role === 'walker').length`);
    if (opts.shots) await shot('o3c_shoot_after');
  }
  const after = opts.after || 'idle';
  if (after === 'idle') await timeline(api, opts.secs || 40, R, 'idle', 250, '!!G.failing && G.failing.phase === "black"');
  if (after === 'fight') {
    // wait for the cop to come; when he is near, fight him with LMB/RMB and a block now and then (medium hands)
    const T = Date.now() + (opts.secs || 50) * 1000;
    while (Date.now() < T) {
      const c = await js(NEAREST('cop'));
      const d = await js(`window.__cv ? Math.hypot(window.__cv.pos.x-G.eye.x, window.__cv.pos.z-G.eye.z) : 99`);
      if (d < 3.5) { const p = await js('[window.__cv.pos.x, window.__cv.pos.z]'); await turnTo(api, p[0], p[1]); await click(api, Math.random() < 0.5 ? 'left' : 'right'); await sleepP(300 + Math.random() * 300); }
      else await sleepP(200);
      const s = await js(ST); if (s && !s.__exc) { const k = JSON.stringify([s.heat, s.st, s.fail, s.say]); if (k !== R._l) { R.log.push('fight ' + JSON.stringify(s)); R._l = k; } if (s.fail === 'black') break; }
    }
  }
  R.events = await js(`(G.police.events || []).slice(-14).map(e => JSON.stringify(e).slice(0, 140))`);
  R.lastFail = await js(`G.lastFail ? { why: G.lastFail.why, to: G.lastFail.to } : null`);
  R.stats = await js('G.people.stats');
  return R;
}
