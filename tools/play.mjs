// Scripted play of the real game page (lane 7's brief P0.5): headless
// Chrome driven through the DevTools protocol with TRUSTED input events
// (the same path as a player's keyboard and mouse, as tools/playtest.mjs).
//   node tools/play.mjs tools/plays/slice.json [--out dir] [--size 1280x800]
// A play is JSON:
//   { "url": "/?speed=1", "size": [1280, 800], "out": "shots/play", "steps": [ ... ] }
// Steps (one key each; "name" labels a step in the log):
//   { "wait": ms }                       real milliseconds
//   { "key": "KeyE", "hold": ms }        a key down, held, up (hold default 60)
//   { "down": "Space" } / { "up": "Space" }
//   { "mouse": "click" | "down" | "up", "button": "left" | "right", "x", "y", "hold": ms }
//   { "look": [dx, dy], "steps": 8 }     mouse moves (movementX / Y under pointer lock)
//   { "until": "expr", "timeout": ms }   poll an expression over N = window.__noir,
//                                        G = N.game, until it is true (a FAIL on timeout)
//   { "shot": "name" }                   a screenshot to <out>/<name>.png
//   { "expect": "expr" }                 must be true (PASS / FAIL)
//   { "eval": "expr" }                   run it, print the result
//   { "walk": [[x, z], ...], "timeout": ms }   walk the points by real input: the
//                                        mouse turns him toward the next, W held
//   { "clickOn": "css selector" }        a click at the centre of that element
//   { "reload": true }                   reload the page (a save survives it)
//   { "fight": { "timeout": ms, "shots": { "name": "expr", ... }, "expect": "expr over F" } }
//                                        play the brawl by real input: read his
//                                        clip and its marks, block / slip / punish
//                                        at a first-timer's pace (a reaction time,
//                                        a wrong read now and then), until it ends;
//                                        a shot the first time each expr is true;
//                                        F = the fight's record in game time
//                                        { time, dur: [r1, r2, r3], perMin, throws,
//                                        downs, landed, taken }, checked by expect
// At the end: the #errlog contents (a non-empty log is a FAIL) and a summary;
// the exit code is 1 when anything failed.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--')) || 'tools/plays/slice.json';
const opt = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const play = JSON.parse(readFileSync(file, 'utf8'));
const [W, H] = (opt('size') || (play.size || [1280, 800]).join('x')).split('x').map(Number);
const OUT = resolve(opt('out') || play.out || 'shots/play');
mkdirSync(OUT, { recursive: true });
const PORT = 9400 + Math.floor(Math.random() * 400);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--mute-audio', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=/tmp/noir-play-${PORT}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0, sid;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId: sid })); });
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { const N = window.__noir; const G = N && N.game; return (${expr}); })()`, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) return { __exc: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
  return r.result?.result?.value;
};
let fails = 0, passes = 0;
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
const log = (s) => console.log(`${stamp()}  ${s}`);
const check = (name, ok, info = '') => { if (ok) passes++; else fails++; log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };

// keys: the code, the key's name, its virtual key code
const KEYNAME = (code) => code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code;
const VK = (code) => code === 'Space' ? 32 : code.startsWith('Key') || code.startsWith('Digit') ? KEYNAME(code).toUpperCase().charCodeAt(0) : 0;
const keyDown = (code) => send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: KEYNAME(code), windowsVirtualKeyCode: VK(code) });
const keyUp = (code) => send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: KEYNAME(code), windowsVirtualKeyCode: VK(code) });
const mouse = (type, x, y, button = 'left', extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button, buttons: type === 'mousePressed' ? (button === 'right' ? 2 : 1) : 0, clickCount: 1, ...extra });
// a turn of the view: a trusted mouse move (under pointer lock the page
// reads the move between two positions); the cursor is walked back to the
// centre in steps too small to matter when it nears an edge
let mx = null, my = null, lookVia = null;
async function turn(dx, dy = 0) {
  if (mx == null) { mx = W / 2; my = H / 2; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my, button: 'none' }); }
  // (the cursor has no room left on that side: a trusted move could not
  // turn further, so this one goes to the same handler as a page event)
  const edge = mx + dx < 2 || mx + dx > W - 2 || my + dy < 2 || my + dy > H - 2;
  if (lookVia === 'event' || edge) { await js(`(document.dispatchEvent(new MouseEvent('mousemove', { movementX: ${dx}, movementY: ${dy} })), 1)`); return; }
  const y0 = lookVia ? 0 : await js('N.controller.yaw');
  mx = Math.max(2, Math.min(W - 2, mx + dx)); my = Math.max(2, Math.min(H - 2, my + dy));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my, button: 'none' });
  if (!lookVia) {
    const y1 = await js('N.controller.yaw');
    lookVia = Math.abs(y1 - y0) > 1e-5 ? 'trusted' : 'event';
    log(`look via ${lookVia} mouse moves`);
    if (lookVia === 'event') await js(`(document.dispatchEvent(new MouseEvent('mousemove', { movementX: ${dx}, movementY: ${dy} })), 1)`);
  }
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r.result?.data) { writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); log(`shot  ${name}.png`); }
};

// the brawl by real input, at a first-timer's pace (round 2, FIGHT.md): each
// mouse button an arm (a click a jab, a hold of 0.6 .. 0.95 s a hard punch),
// SPACE + A / D slips away from the hand that swings (a straight one either
// way), SPACE alone leans back, SHIFT covers, W / S keep him at arm's
// length. His move is seen 0.16 .. 0.32 s after it starts, one read in six
// is wrong or missed, an opening is noticed 0.2 .. 0.45 s late. The lesson is
// played as its cards ask. Returns the fight's record in game time (the
// manners' spans, his attacks a minute, what he was knocked into).
async function fight({ timeout = 240000, shots = {} } = {}) {
  const done = new Set();
  const plans = new Map();
  const held = new Map();   // code -> release time (ms)
  let nextJab = 0, grabT = 0, seen = null, seenAt = 0, lastArm = 'right', lessonAt = 0, lessonStep = 0;
  const T0 = Date.now();
  const cx = W / 2, cy = H / 2;
  const rr = (a, b) => a + (b - a) * Math.random();
  const down = async (code, ms) => { if (!held.has(code)) await keyDown(code); held.set(code, Date.now() + ms); };
  const release = async (code) => { if (held.has(code)) { held.delete(code); await keyUp(code); } };
  const btnDown = async (b, ms) => { const code = 'M' + b; if (held.has(code)) return; await mouse('mousePressed', cx, cy, b); held.set(code, Date.now() + ms); };
  await js(`(() => { const R = window.__fightRec = { t0: N.time, rounds: { 1: N.time }, his: {}, throws: [] };
    G.on('brawl:round', (e) => { if (e.n > 1 && R.rounds[e.n] == null) R.rounds[e.n] = N.time; });
    G.on('brawl:lesson', () => { R.lesson = N.time - R.t0; R.rounds[1] = N.time; });
    G.on('brawl:tell', () => { const n = G.brawl.round; R.his[n] = (R.his[n] || 0) + 1; });
    G.on('brawl:throw', (e) => R.throws.push(e.into)); return 1; })()`);
  const record = async () => js(`(() => { const R = window.__fightRec, B = G.brawl, t1 = N.time;
    const dur = [1, 2, 3].map((n) => +(((R.rounds[n + 1] ?? t1) - (R.rounds[n] ?? t1))).toFixed(1));
    return { time: +(t1 - R.t0).toFixed(1), lesson: +(R.lesson || 0).toFixed(1), dur, perMin: dur.map((d, i) => +((R.his[i + 1] || 0) / Math.max(1, d) * 60).toFixed(1)), throws: R.throws, downs: B.stats.downs, landed: B.stats.landed, taken: B.stats.taken, slipped: B.stats.slipped, window: B.stats.window }; })()`);
  const INFO = { br_jab: ['L', 's'], br_jabR: ['R', 's'], br_cross: ['R', 's'], br_hook: ['R', 'w'], br_hookL: ['L', 'w'], br_body: ['R', 'w'], br_bodyL: ['L', 'w'],
    br_haymaker: ['R', 'o'], br_haymakerL: ['L', 'o'], br_rush: ['R', 'o'], br_shove: ['B', 'p'], br_bottle: ['R', 's'], br_bottle_thrust: ['R', 's'], br_stoolSwing: ['R', 'w'], br_throw: ['R', 's'] };
  for (;;) {
    const s = await js(`(() => { const B = G.brawl; if (!B.active) return { off: true, finished: !!B.finished, won: !!B.stats.won };
      const h = B.him, m = B.me, c = B.c; const cl = h.clip ? c.clip(h.clip) : null; const e = G.eye;
      return { round: B.round, state: h.state, clip: h.clip, t: h.t, contact: cl && (cl.marks.contact ?? cl.marks.release), open: h.open, low: h.low, hp: h.hp, atSpot: !!h.atSpot,
        me: m.act, holding: !!m.holding, reach: !!B.reachable(), his: B.stats.his || 0, d: Math.hypot(c.pos.x - e.x, c.pos.z - e.z), lesson: B.lesson ? B.lesson.step : 0 }; })()`);
    for (const [name, expr] of Object.entries(shots)) if (!done.has(name) && await js(expr) === true) { done.add(name); await shot(name); }
    const now = Date.now();
    for (const [code, at] of [...held]) if (now >= at) { held.delete(code); if (code[0] === 'M') await mouse('mouseReleased', cx, cy, code.slice(1)); else await keyUp(code); }
    if (s.off) { for (const code of [...held.keys()]) { if (code[0] === 'M') await mouse('mouseReleased', cx, cy, code.slice(1)); else await keyUp(code); } return { ...s, ...(await record()) }; }
    if (now - T0 > timeout) { check('the fight ended in time', false, JSON.stringify(s)); return { ...s, ...(await record()) }; }
    if (s.me === 'down') { await sleep(50); continue; }
    // (arm's length: W / S)
    const want = s.state === 'reel' ? (s.atSpot ? 1.35 : 2.0) : 1.45;
    if (!held.has('Space')) {
      if (s.d > want + 0.2) { await release('KeyS'); await down('KeyW', 180); } else if (s.d < want - 0.4) { await release('KeyW'); await down('KeyS', 180); }
    }
    // the lesson: as its card asks, a human moment after it shows
    if (s.lesson && s.lesson <= 3) {
      if (s.lesson !== lessonStep) { lessonStep = s.lesson; lessonAt = now + rr(600, 1100); }
      if (now > lessonAt && s.me === 'idle' && s.d < 1.65) {
        if (s.lesson === 1) await btnDown('left', 60);
        else if (s.lesson === 2) await btnDown('right', 60);
        else await btnDown('right', rr(780, 950));
        lessonAt = now + 1500;
      }
      await sleep(16); continue;
    }
    if (s.lesson === 7) { await down('KeyA', 600); await sleep(16); continue; }
    if (s.state === 'attack' && s.contact != null) {
      const key = s.clip + '@' + s.his;
      if (!plans.has(key)) {
        const [hand, kind] = INFO[s.clip] || ['R', 's'];
        const away = hand === 'R' ? 'slipR' : 'slipL';
        const r = Math.random();
        let act;
        if (s.lesson === 6) act = 'cover'; else if (s.lesson) act = away;
        else if (kind === 'w') act = r < 0.7 ? away : r < 0.85 ? 'cover' : (away === 'slipR' ? 'slipL' : 'slipR');
        else if (kind === 'o') act = r < 0.55 ? away : 'lean';
        else if (kind === 'p') act = r < 0.6 ? 'lean' : 'slipR';
        else act = r < 0.45 ? (r < 0.22 ? 'slipL' : 'slipR') : r < 0.7 ? 'cover' : 'lean';
        plans.set(key, { act: !s.lesson && Math.random() < 1 / 6 ? null : act, seen: rr(0.16, 0.32) });
      }
      const tc = s.contact - s.t;
      const P = plans.get(key);
      if (P && P.act && s.t >= P.seen && tc < (P.act === 'cover' ? 0.32 : P.act === 'lean' ? 0.3 : 0.22) && tc > -0.04) {
        const act = P.act;
        P.act = null;
        for (const k of ['KeyW', 'KeyS']) await release(k);
        if (act === 'cover') await down('ShiftLeft', (tc + 0.3) * 1000);
        else if (act === 'lean') await down('Space', 320);
        else { await down('Space', 200); const k = act === 'slipL' ? 'KeyA' : 'KeyD'; await keyDown(k); await keyUp(k); }
      }
      if (tc > 0) { await sleep(16); continue; }
    }
    if (s.me !== 'idle' || held.has('Mleft') || held.has('Mright') || s.d > 1.72) { await sleep(16); continue; }
    const look = s.state + ':' + (s.open > 0.12) + ':' + s.low;
    if (look !== seen) { seen = look; seenAt = now + rr(200, 450); }
    if (now < seenAt) { await sleep(16); continue; }
    const arm = () => (lastArm = lastArm === 'left' ? 'right' : 'left');
    const hard = async () => { await btnDown(arm(), rr(620, 950)); nextJab = Date.now() + 900; };
    if (s.state === 'reel') { if (s.atSpot) await hard(); }
    else if (s.holding && s.state !== 'attack') await btnDown('right', 60);
    else if (s.open > 0.12 || s.state === 'stun' || (s.state === 'move' && s.low)) await hard();
    else if (s.state === 'react' && now > nextJab - 600) { await btnDown(arm(), 60); nextJab = now + 350; }
    else if (s.round >= 2 && s.reach && !s.holding && s.state === 'move' && now > grabT) { grabT = now + 8000; await keyDown('KeyE'); await keyUp('KeyE'); }
    else if (s.state === 'move' && now > nextJab) { if (Math.random() < 0.3) await hard(); else await btnDown(arm(), 60); nextJab = now + 1000 + Math.random() * 1300; }
    await sleep(16);
  }
}

// walk by real input: turn with mouse moves (under pointer lock) toward
// each point, W held until there
async function walk(points, timeout) {
  const T = Date.now() + timeout;
  let wDown = false;
  const setW = async (on) => { if (on !== wDown) { wDown = on; await (on ? keyDown('KeyW') : keyUp('KeyW')); } };
  for (const [x, z] of points) {
    for (;;) {
      const s = await js(`({ x: N.controller.pos.x, z: N.controller.pos.z, yaw: N.controller.yaw, sens: N.controller.sensitivity, mode: N.controller.mode })`);
      if (Date.now() > T) { await setW(false); log(`walk stuck at ${JSON.stringify(s)} going to ${[x, z]}`); return false; }
      const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
      if (d < 0.4) break;
      const want = Math.atan2(-dx, -dz);
      const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
      if (Math.abs(err) > 0.03) await turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0);
      await setW(Math.abs(err) < 0.6);
      await sleep(33);
    }
  }
  await setW(false);
  return true;
}

try {
  let ver;
  for (let k = 0; k < 50; k++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(100); } }
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  ({ result: { sessionId: sid } } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}${play.url || '/'}` });
  for (let k = 0; k < 200; k++) { if (await js('!!window.__noirReady') === true) break; await sleep(200); }
  log(`page ready: ${play.url || '/'} at ${W}x${H}`);
  for (const S of play.steps) {
    if (S.name) log(`--- ${S.name}`);
    if (S.wait != null) await sleep(S.wait);
    else if (S.key) { await keyDown(S.key); await sleep(S.hold ?? 60); await keyUp(S.key); }
    else if (S.down) await keyDown(S.down);
    else if (S.up) await keyUp(S.up);
    else if (S.mouse) {
      const x = S.x ?? W / 2, y = S.y ?? H / 2, b = S.button || 'left';
      if (S.mouse !== 'up') await mouse('mousePressed', x, y, b);
      if (S.mouse === 'click') await sleep(S.hold ?? 40);
      if (S.mouse !== 'down') await mouse('mouseReleased', x, y, b);
    } else if (S.look) {
      const n = S.steps || 8;
      for (let i = 0; i < n; i++) { await turn(Math.round(S.look[0] / n), Math.round(S.look[1] / n)); await sleep(16); }
    } else if (S.until) {
      const T = Date.now() + (S.timeout ?? 20000);
      let ok = false, v;
      while (Date.now() < T) { v = await js(S.until); if (v === true) { ok = true; break; } await sleep(S.poll ?? 100); }
      if (!ok) check(`until ${S.until}`, false, `timeout ${S.timeout ?? 20000} ms ${v && v.__exc ? v.__exc : ''}`);
      else if (S.log) log(`ok    ${S.until}`);
      if (!ok && S.stop !== false) break;
    } else if (S.shot) await shot(S.shot);
    else if (S.expect) { const v = await js(S.expect); check(S.label || S.expect, v === true, v === true ? '' : JSON.stringify(v)); }
    else if (S.eval) log(`eval  ${S.eval} -> ${JSON.stringify(await js(S.eval))}`);
    else if (S.fight) {
      const r = await fight(S.fight);
      log(`fight ${JSON.stringify(r)}`);
      if (S.fight.expect) { const ok = new Function('F', `return (${S.fight.expect});`)(r) === true; check(S.fight.label || S.fight.expect, ok, ok ? '' : JSON.stringify(r)); }
    }
    // (a walk's points may be an expression: where the fight left him)
    else if (S.walk) { const pts = typeof S.walk === 'string' ? await js(S.walk) : S.walk; const ok = await walk(pts, S.timeout ?? 30000); check(`walk ${JSON.stringify(pts)}`, ok); if (!ok && S.stop !== false) break; }
    else if (S.clickOn) {
      const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(S.clickOn)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      if (!r) check(`clickOn ${S.clickOn}`, false, 'no element');
      else { await mouse('mousePressed', r[0], r[1]); await sleep(40); await mouse('mouseReleased', r[0], r[1]); }
    } else if (S.reload) {
      await send('Page.reload', {});
      await sleep(500);
      for (let k = 0; k < 200; k++) { if (await js('!!window.__noirReady') === true) break; await sleep(200); }
      // (the page's focus back, so a click may take the pointer lock)
      await send('Page.bringToFront', {});
      await send('Emulation.setFocusEmulationEnabled', { enabled: true });
      mx = null;
      log('reloaded');
    }
  }
  const err = await js(`document.getElementById('errlog') ? document.getElementById('errlog').textContent.trim() : '(no errlog)'`);
  check('no errors in #errlog', !err, err ? String(err).slice(0, 800) : '');
  const K = await js(`JSON.parse(document.getElementById('counters').dataset.json || '{}')`);
  log(`counters ${JSON.stringify({ scene: K.scene, beat: K.beat, state: K.state, fight: K.fight, play: K.play })}`);
} catch (e) {
  fails++;
  console.log('ERROR', e && e.stack || e);
} finally {
  console.log(`${passes} passed, ${fails} failed`);
  try { ws && ws.close(); } catch { /* */ }
  chrome.kill('SIGKILL');
  process.exit(fails ? 1 : 0);
}
