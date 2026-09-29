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
//   { "fight": { "timeout": ms, "shots": { "name": "expr", ... } } }
//                                        play the brawl by real input: read his
//                                        clip and its marks, block / slip / punish
//                                        (what a player does), until it ends;
//                                        a shot the first time each expr is true
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
  '--headless=new', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`,
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
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r.result?.data) { writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); log(`shot  ${name}.png`); }
};

// the brawl by real input: poll his clip, answer by its marks
async function fight({ timeout = 240000, shots = {} } = {}) {
  const done = new Set();
  const plans = new Map();
  let blockUp = 0, rmbUp = 0, nextJab = 0, grabT = 0;
  const T0 = Date.now();
  const cx = W / 2, cy = H / 2;
  for (;;) {
    const s = await js(`(() => { const B = G.brawl; if (!B.active) return { off: true, finished: !!B.finished, won: !!B.stats.won };
      const h = B.him, m = B.me, c = B.c; const clip = h.clip ? c.clip(h.clip) : null;
      return { round: B.round, state: h.state, clip: h.clip, t: h.t, contact: clip && clip.marks.contact, open: h.open, low: h.guardLow, hp: h.hp, next: h.next,
        me: m.state, holding: !!m.holding, reach: !!B.reachable(), his: B.stats.his || 0, speed: 1 }; })()`);
    for (const [name, expr] of Object.entries(shots)) if (!done.has(name) && await js(expr) === true) { done.add(name); await shot(name); }
    const now = Date.now();
    if (blockUp && now >= blockUp) { await keyUp('Space'); blockUp = 0; }
    if (rmbUp && now >= rmbUp) { await mouse('mouseReleased', cx, cy, 'right'); rmbUp = 0; }
    if (s.off) { if (blockUp) await keyUp('Space'); return s; }
    if (now - T0 > timeout) { check('the fight ended in time', false, JSON.stringify(s)); return s; }
    if (s.me === 'down') { await sleep(50); continue; }
    if (s.state === 'attack') {
      const key = s.clip + '@' + s.his;
      if (!plans.has(key)) {
        const r = Math.random();
        plans.set(key, s.clip === 'br_hook' ? 'slipR' : s.clip === 'br_haymaker' ? (r < 0.5 ? 'slipL' : 'slipR') : 'block');
      }
      const tc = s.contact - s.t;
      const act = plans.get(key);
      if (act && tc < (act === 'block' ? 0.3 : 0.2) && tc > -0.05) {
        plans.set(key, null);
        if (act === 'block') { await keyDown('Space'); blockUp = Date.now() + (tc + 0.3) * 1000; }
        else { const k = act === 'slipL' ? 'KeyA' : 'KeyD'; await keyDown(k); await keyUp(k); }
      }
      if (tc > 0) { await sleep(16); continue; }
    }
    if (s.me === 'idle' && !blockUp && !rmbUp) {
      const heavy = async (ms) => { await mouse('mousePressed', cx, cy, 'right'); rmbUp = Date.now() + ms; nextJab = Date.now() + 700; };
      if (s.state === 'reel' || s.hp <= 0) await heavy(380);
      else if (s.holding && s.state !== 'attack') { await mouse('mousePressed', cx, cy); await mouse('mouseReleased', cx, cy); }
      else if (s.open > 0.15 || s.state === 'stun' || (s.state === 'guard' && s.low)) await heavy(350);
      else if (s.state === 'react' && now > nextJab - 600) { await mouse('mousePressed', cx, cy); await mouse('mouseReleased', cx, cy); nextJab = now + 300; }
      else if (s.round >= 2 && s.reach && !s.holding && s.state === 'guard' && s.next > 0.9 && now > grabT) { grabT = now + 6000; await keyDown('KeyE'); await keyUp('KeyE'); }
      else if (s.state === 'guard' && s.next > 0.7 && now > nextJab) { await mouse('mousePressed', cx, cy); await mouse('mouseReleased', cx, cy); nextJab = now + 1200 + Math.random() * 1400; }
    }
    await sleep(16);
  }
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
      for (let i = 0; i < n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: W / 2, y: H / 2, button: 'none', movementX: S.look[0] / n, movementY: S.look[1] / n }); await sleep(16); }
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
    else if (S.fight) { const r = await fight(S.fight); log(`fight ${JSON.stringify(r)}`); }
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
