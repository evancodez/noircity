// [C3] A hand-played session, frozen between moves: one headless Chrome on
// the real game page, played by TRUSTED input (as tools/play.mjs), but the
// game's clock only runs when told to. For an agent who must play a chapter
// cold and think between moves (the game would otherwise run on while it
// thinks).
//   NOIR_PORT=5343 node tools/stepplay.mjs --url "/?mute=1&start=tail" --dir <dir> [--size 1280x800] [--status <file.js>]
// It begins the game (BEGIN, the pointer lock), lets it load in real time
// until `--ready` (an expression; default: a scene is playing), then freezes
// the clock (requestAnimationFrame is held: the game's frames run only when
// stepped, with synthetic 60 Hz timestamps) and waits for commands:
//   write <dir>/cmd.json (a JSON array of moves), it is consumed, and the
//   answer lands in <dir>/res.json (a status after each move that asks for
//   one, the shots' paths).
// Moves:
//   { "k": ["KeyW", "KeyD"], "f": 30 }   hold exactly these keys (the rest let
//                                        go), run f frames (60 a second)
//   { "f": 30 }                          run f frames, the keys as they are
//   { "tap": "KeyE" }                    a key down for 2 frames, then up
//   { "look": [dx, dy] }                 a trusted mouse move (pointer lock)
//   { "btn": "right", "down": true }     a mouse button down / up
//   { "shot": "name" }                   <dir>/name.jpg (the frame now)
//   { "eval": "expr" }                   N = window.__noir, G = N.game
//   { "status": true }                   the status expression's value
//   { "real": ms }                       let the clock run in real time
//   { "quit": true }
// One Chrome; it is killed and its profile removed on quit (or SIGTERM).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { sweepProfiles, endChrome, freePort, CHROME_WAIT_STEPS } from './lib/profile.mjs';
sweepProfiles();

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL_ = opt('url', '/?mute=1');
const DIR = resolve(opt('dir', 'shots/step'));
const [W, H] = opt('size', '1280x800').split('x').map(Number);
const READY = opt('ready', "G.state === 'playing' && !!G.scenes.current");
const STATUS = opt('status') ? readFileSync(opt('status'), 'utf8') : `(() => {
  const C = G.scenes.ctx && G.scenes.ctx.flags && G.scenes.ctx.flags.chase;
  const o = { scene: G.scenes.current && G.scenes.current.id, beat: G.scenes.beat, state: G.state, t: +N.time.toFixed(2),
    prompt: G.hud.promptShown, say: G.hud.sayShown };
  if (C && C.my) Object.assign(o, { phase: C.phase, my: [+C.my.pos.x.toFixed(1), +C.my.pos.z.toFixed(1), +C.my.yaw.toFixed(2)], kmh: +(C.my.speed * 3.6).toFixed(0),
    his: [+C.his.pos.x.toFixed(1), +C.his.pos.z.toFixed(1)], gap: +C.gap().toFixed(0), seen: C.seen, unseen: +C.unseen.toFixed(1), dmg: +C.my.damage.toFixed(2),
    leg: C.driver && C.driver.legIndex, warn: C.kit && C.kit.warning, fails: (globalThis.__tailFails || []).map((f) => f.why).join('|') });
  return o; })()`;
mkdirSync(DIR, { recursive: true });

const PORT = await freePort();
const PROFILE = `/tmp/noir-step-${PORT}`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--use-mock-keychain', '--password-store=basic', '--mute-audio', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });
const quit = (code = 0) => { try { ws && ws.close(); } catch { /* */ } endChrome(chrome, PROFILE); process.exit(code); };
process.on('SIGTERM', () => quit(0));
process.on('SIGINT', () => quit(0));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0, sid;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId: sid })); });
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { const N = window.__noir; const G = N && N.game; return (${expr}); })()`, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) return { __exc: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
  return r.result?.result?.value;
};
const KEYNAME = (code) => code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code;
const VK = (code) => code === 'Space' ? 32 : code.startsWith('Key') || code.startsWith('Digit') ? KEYNAME(code).toUpperCase().charCodeAt(0) : 0;
const keyDown = (code) => send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: KEYNAME(code), windowsVirtualKeyCode: VK(code) });
const keyUp = (code) => send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: KEYNAME(code), windowsVirtualKeyCode: VK(code) });
const mouse = (type, x, y, button = 'left') => send('Input.dispatchMouseEvent', { type, x, y, button, buttons: type === 'mousePressed' ? (button === 'right' ? 2 : 1) : 0, clickCount: 1 });
let mx = W / 2, my = H / 2;
async function look(dx, dy) {
  // (walked back to the middle when the cursor nears an edge)
  if (mx + dx < 2 || mx + dx > W - 2 || my + dy < 2 || my + dy > H - 2) { await js(`(document.dispatchEvent(new MouseEvent('mousemove', { movementX: ${dx}, movementY: ${dy} })), 1)`); return; }
  mx += dx; my += dy;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my, button: 'none' });
}
// the clock: requestAnimationFrame held while frozen; a step runs the held
// callbacks with synthetic timestamps
const CLOCK = `(() => {
  if (window.__clock) return;
  const raf = window.requestAnimationFrame.bind(window);
  let q = [], frozen = false, t = 0;
  window.requestAnimationFrame = (cb) => { if (!frozen) return raf(cb); q.push(cb); return q.length; };
  window.__clock = {
    freeze() { frozen = true; t = performance.now(); },
    thaw() { frozen = false; const c = q; q = []; for (const f of c) raf(f); },
    step(n) { for (let i = 0; i < n; i++) { t += 1000 / 60; const c = q; q = []; for (const f of c) f(t); } return q.length; },
    get frozen() { return frozen; },
  };
})()`;
const held = new Set();
async function hold(keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await keyUp(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await keyDown(k); held.add(k); }
}
const frames = async (n) => { let left = n; while (left > 0) { const k = Math.min(30, left); await js(`window.__clock.step(${k})`); left -= k; } };

try {
  let ver;
  for (let k = 0; k < CHROME_WAIT_STEPS; k++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(100); } }
  if (!ver) throw new Error('headless Chrome did not open DevTools');
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  ({ result: { sessionId: sid } } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}${URL_}` });
  for (let k = 0; k < 300; k++) { if (await js('!!window.__noirReady') === true) break; await sleep(200); }
  // BEGIN (or the first option), until the pointer lock is taken
  for (let k = 0; k < 8; k++) {
    await sleep(1500);
    const r = await js(`(() => { const e = document.querySelector('#title .opt[data-k=begin]') || document.querySelector('#title .opt'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
    if (r) { await mouse('mousePressed', r[0], r[1]); await sleep(40); await mouse('mouseReleased', r[0], r[1]); }
    await sleep(1500);
    if (await js('document.pointerLockElement === N.renderer.domElement') === true) break;
  }
  for (let k = 0; k < 300; k++) { if (await js(READY) === true) break; await sleep(200); }
  await js('window.__clock.freeze()');
  writeFileSync(`${DIR}/res.json`, JSON.stringify({ ready: true, status: await js(STATUS) }, null, 1));
  console.log('ready', DIR);
  let n = 0;
  for (;;) {
    if (!existsSync(`${DIR}/cmd.json`)) { await sleep(100); continue; }
    let moves;
    try { moves = JSON.parse(readFileSync(`${DIR}/cmd.json`, 'utf8')); } catch (e) { await sleep(100); continue; }
    unlinkSync(`${DIR}/cmd.json`);
    if (!Array.isArray(moves)) moves = [moves];
    const out = [];
    for (const m of moves) {
      if (m.quit) { await hold([]); writeFileSync(`${DIR}/res.json.tmp`, JSON.stringify({ quit: true })); renameSync(`${DIR}/res.json.tmp`, `${DIR}/res.json`); quit(0); }
      if (m.k) await hold(m.k);
      if (m.look) await look(m.look[0], m.look[1]);
      if (m.btn) { if (m.down) await mouse('mousePressed', mx, my, m.btn); else await mouse('mouseReleased', mx, my, m.btn); }
      if (m.tap) { await keyDown(m.tap); await frames(2); await keyUp(m.tap); }
      if (m.f) await frames(m.f);
      if (m.real) { await js('window.__clock.thaw()'); await sleep(m.real); await js('window.__clock.freeze()'); }
      if (m.eval) out.push({ eval: m.eval, v: await js(m.eval) });
      if (m.shot) {
        // (one real frame so the canvas is presented, then the capture)
        const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
        const p = `${DIR}/${m.shot}.jpg`;
        if (r.result?.data) { writeFileSync(p, Buffer.from(r.result.data, 'base64')); out.push({ shot: p }); }
      }
      if (m.status || m.f || m.real) out.push({ status: await js(STATUS) });
    }
    const err = await js(`document.getElementById('errlog') ? document.getElementById('errlog').textContent.trim().slice(0, 400) : ''`);
    writeFileSync(`${DIR}/res.json.tmp`, JSON.stringify({ n: ++n, out, err }, null, 1));
    renameSync(`${DIR}/res.json.tmp`, `${DIR}/res.json`);
  }
} catch (e) {
  console.log('ERROR', e && e.stack || e);
  quit(1);
}
