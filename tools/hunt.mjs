// [R3] The bug hunter's driver: headless Chrome by DevTools with TRUSTED input
// events (as tools/play.mjs), but a script of its own instead of JSON, so a
// test can branch on what the page says and poke at it the way a player does
// (the wrong key at the wrong time, ESC in every mode, a resize, a reload).
//   NOIR_PORT=5332 node tools/hunt.mjs tools/hunts/<x>.mjs [--size 1280x800]
// A hunt is a module whose default export is async (h) => { ... }; h:
//   await h.open('/?mute=1&start=body')   load the page (ready when window.__noirReady)
//   await h.begin()                       BEGIN on the title (clicks again until the game has the mouse)
//   await h.chapter('tail')               CHAPTERS, then that row
//   await h.cont()                        CONTINUE
//   h.js(expr)                            an expression over N = window.__noir, G = N.game
//   h.snap()                              a one-line state: scene, beat, mode, hp, prompt, ...
//   h.key(code, hold) h.down(code) h.up(code) h.tap(code)
//   h.click(button, hold) h.mdown(button) h.mup(button)    (left | right | middle)
//   h.look(dx, dy, steps)                 mouse moves (movementX / Y under the pointer lock)
//   h.pause() / h.resume()                what ESC does: the lock lost, the card up; a click on the card
//   h.resize(w, h)                        the window (Emulation device metrics)
//   h.reload()                            Page.reload, then ready again
//   h.until(expr, ms)                     poll an expression until true (returns true / false)
//   h.wait(ms)  h.shot(name)  h.err()     the #errlog text  h.log(line)  h.check(name, ok, info)
//   h.watch(ms, every)                    poll the state for ms and print each change
// The exit code is 1 when a check failed or the errlog is not clean at the end.
import { spawn } from 'node:child_process';
import { sweepProfiles, endChrome, freePort, CHROME_WAIT_STEPS } from './lib/profile.mjs';
sweepProfiles();
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const opt = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const [W0, H0] = (opt('size') || '1280x800').split('x').map(Number);
const OUT = resolve(opt('out') || 'shots/hunt');
mkdirSync(OUT, { recursive: true });
if (!file) { console.log('usage: node tools/hunt.mjs tools/hunts/<x>.mjs [--size WxH] [--out dir]'); process.exit(2); }

const PORT = await freePort();
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--use-mock-keychain', '--password-store=basic', '--mute-audio', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W0},${H0}`,
  '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=/tmp/noir-hunt-${PORT}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0, sid;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId: sid })); });
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
const log = (s) => console.log(`${stamp()}  ${s}`);
let fails = 0, passes = 0;
const check = (name, ok, info = '') => { if (ok) passes++; else fails++; log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + (typeof info === 'string' ? info : JSON.stringify(info)) + ')' : ''}`); };

const KEYNAME = (code) => code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code === 'ShiftLeft' ? 'Shift' : code;
const VK = (code) => code === 'Space' ? 32 : code === 'ShiftLeft' ? 16 : code === 'Escape' ? 27 : code === 'Tab' ? 9 : code === 'Enter' ? 13 : code.startsWith('Key') || code.startsWith('Digit') ? KEYNAME(code).toUpperCase().charCodeAt(0) : 0;
const MODS = { ShiftLeft: 8 };
const BTN = { left: 1, right: 2, middle: 4 };

const h = {
  W: W0, H: H0, sleep, log, check, send,
  async js(expr) {
    const r = await send('Runtime.evaluate', { expression: `(async () => { const N = window.__noir; const G = N && N.game; return (${expr}); })()`, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.result?.exceptionDetails) return { __exc: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
    return r.result?.result?.value;
  },
  async down(code) { await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: KEYNAME(code), windowsVirtualKeyCode: VK(code), modifiers: MODS[code] || 0 }); },
  async up(code) { await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: KEYNAME(code), windowsVirtualKeyCode: VK(code) }); },
  async key(code, hold = 60) { await h.down(code); await sleep(hold); await h.up(code); },
  async tap(code) { return h.key(code, 40); },
  mx: null, my: null,
  async mdown(b = 'left') { const x = h.mx ?? h.W / 2, y = h.my ?? h.H / 2; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: b, buttons: BTN[b], clickCount: 1 }); },
  async mup(b = 'left') { const x = h.mx ?? h.W / 2, y = h.my ?? h.H / 2; await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: b, buttons: 0, clickCount: 1 }); },
  async click(b = 'left', hold = 40) { await h.mdown(b); await sleep(hold); await h.mup(b); },
  // a turn of the view: a trusted move under the pointer lock, or a page event
  lookVia: null,
  async turn(dx, dy = 0) {
    if (h.mx == null) { h.mx = h.W / 2; h.my = h.H / 2; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.mx, y: h.my, button: 'none' }); }
    const edge = h.mx + dx < 2 || h.mx + dx > h.W - 2 || h.my + dy < 2 || h.my + dy > h.H - 2;
    if (h.lookVia === 'event' || edge) { await h.js(`(document.dispatchEvent(new MouseEvent('mousemove', { movementX: ${dx}, movementY: ${dy} })), 1)`); return; }
    const y0 = h.lookVia ? 0 : await h.js('N.controller.yaw');
    h.mx = Math.max(2, Math.min(h.W - 2, h.mx + dx)); h.my = Math.max(2, Math.min(h.H - 2, h.my + dy));
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.mx, y: h.my, button: 'none' });
    if (!h.lookVia) {
      const y1 = await h.js('N.controller.yaw');
      h.lookVia = Math.abs(y1 - y0) > 1e-5 ? 'trusted' : 'event';
      if (h.lookVia === 'event') await h.js(`(document.dispatchEvent(new MouseEvent('mousemove', { movementX: ${dx}, movementY: ${dy} })), 1)`);
    }
  },
  async look(dx, dy = 0, steps = 6) { for (let i = 0; i < steps; i++) { await h.turn(Math.round(dx / steps), Math.round(dy / steps)); await sleep(16); } },
  async wait(ms) { await sleep(ms); },
  async until(expr, ms = 10000, poll = 100) { const T = Date.now() + ms; while (Date.now() < T) { if ((await h.js(expr)) === true) return true; await sleep(poll); } return false; },
  async shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); if (r.result?.data) { writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); log(`shot  ${name}.png`); } },
  async err() { return (await h.js(`document.getElementById('errlog') ? document.getElementById('errlog').textContent.trim() : '(no errlog)'`)) || ''; },
  snapExpr: `(() => { const C = N.controller, S = G.scenes, e = G.eye, K = S.ctx && S.ctx.flags;
    return [S.current ? S.current.id : '-', S.beat || '-', S.trans ? 'T:' + S.trans.phase : '', 'st=' + G.state, 'm=' + C.mode, C.frozen ? 'FROZEN' : '', document.pointerLockElement ? '' : 'UNLOCKED', G.hud.paused ? 'PAUSED' : '',
      'hp=' + Math.round(G.health.hp), 'hands=' + G.hands.set, 'w=' + (G.player.weapons.current || '-'), G.brawl.active ? 'BRAWL' : '', G.inspect.active ? 'INSPECT' : '', G.puzzles.active ? 'PUZ:' + G.puzzles.active.id : '',
      'at=' + C.pos.x.toFixed(1) + ',' + C.pos.z.toFixed(1), 'y=' + C.yaw.toFixed(2), 'fade=' + S.fadeK.toFixed(2),
      G.hud.promptShown ? 'P[' + G.hud.promptShown + ']' : '', G.hud.sayShown ? 'S[' + G.hud.sayShown + ']' : '', G.hud.endShown ? 'ENDCARD' : ''].filter(Boolean).join(' '); })()`,
  async snap() { return h.js(h.snapExpr); },
  async say() { log(await h.snap()); },
  async open(url) {
    await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}${url}` });
    await sleep(400);
    for (let k = 0; k < 300; k++) { if (await h.js('!!window.__noirReady') === true) break; await sleep(200); }
    await send('Page.bringToFront', {});
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    h.mx = null; h.lookVia = null;
    log(`page ready: ${url}`);
  },
  async clickOn(sel) {
    const r = await h.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
    if (!r) return false;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', buttons: 1, clickCount: 1 }); await sleep(40);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', buttons: 0, clickCount: 1 });
    return true;
  },
  // the title's choice, clicked until the game has taken the mouse
  async startVia(sel, rowSel = null) {
    await h.until(`G.state === 'title'`, 30000);
    await sleep(1200);
    for (let k = 0; k < 6; k++) {
      if (rowSel) { await h.clickOn('#title .opt[data-k=chapters]'); await sleep(300); await h.clickOn(rowSel); } else await h.clickOn(sel);
      for (let w = 0; w < 16; w++) { await sleep(250); if ((await h.js(`G.state !== 'title' && !!document.pointerLockElement`)) === true) { h.mx = null; return true; } }
      log('the start click was not taken, clicking again');
    }
    return false;
  },
  begin() { return h.startVia('#title .opt[data-k=begin]'); },
  cont() { return h.startVia('#title .opt[data-k=continue]'); },
  chapter(idv) { return h.startVia(null, `#title .toc .row[data-id=${idv}]`); },
  // ESC: the pointer lock goes, the pause card comes; the click on the card takes it back
  async pause() { await h.js('(document.exitPointerLock(), 1)'); await sleep(250); },
  async resume() {
    for (let k = 0; k < 6; k++) {
      await h.clickOn('#pausecard');
      for (let w = 0; w < 12; w++) { await sleep(250); if ((await h.js(`!!document.pointerLockElement`)) === true) { h.mx = null; return true; } }
    }
    return false;
  },
  async resize(w, hh) { h.W = w; h.H = hh; await send('Emulation.setDeviceMetricsOverride', { width: w, height: hh, deviceScaleFactor: 1, mobile: false }); await sleep(200); },
  async reload() {
    await send('Page.reload', {}); await sleep(500);
    for (let k = 0; k < 300; k++) { if (await h.js('!!window.__noirReady') === true) break; await sleep(200); }
    await send('Page.bringToFront', {}); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    h.mx = null; h.lookVia = null; log('reloaded');
  },
  // poll the state for `ms`, print each change
  async watch(ms = 5000, every = 250) {
    let last = null; const T = Date.now() + ms;
    while (Date.now() < T) { const s = await h.snap(); if (s !== last) { log('  ' + s); last = s; } await sleep(every); }
  },
  // the keys of a player who does not know the game, at random, for `ms`
  async mash(ms = 4000, { keys = ['KeyE', 'KeyR', 'Space', 'KeyF', 'KeyC', 'KeyQ', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Tab'], buttons = ['left', 'right', 'middle'], look = true, every = 70 } = {}) {
    const T = Date.now() + ms; let n = 0;
    while (Date.now() < T) {
      const r = Math.random();
      if (r < 0.5) await h.key(keys[Math.floor(Math.random() * keys.length)], 20 + Math.random() * 120);
      else if (r < 0.75) await h.click(buttons[Math.floor(Math.random() * buttons.length)], 30 + Math.random() * 250);
      else if (look) await h.look((Math.random() - 0.5) * 160, (Math.random() - 0.5) * 60, 3);
      n++; await sleep(every * Math.random());
    }
    return n;
  },
  async releaseAll() { for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyE', 'KeyC']) await h.up(c); for (const b of ['left', 'right', 'middle']) await h.mup(b); },
};

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
  await send('Emulation.setDeviceMetricsOverride', { width: W0, height: H0, deviceScaleFactor: 1, mobile: false });
  const mod = await import(resolve(file));
  await mod.default(h);
  const err = await h.err();
  check('no errors in #errlog at the end', !err, err ? String(err).slice(0, 1500) : '');
} catch (e) {
  fails++;
  console.log('ERROR', e && e.stack || e);
} finally {
  console.log(`${passes} passed, ${fails} failed`);
  try { ws && ws.close(); } catch { /* */ }
  endChrome(chrome, `/tmp/noir-hunt-${PORT}`);
  process.exit(fails ? 1 : 0);
}
