// Scripted play-through of the real game page (no ?shot=) in headless Chrome,
// driven through the DevTools protocol with TRUSTED input events (the same
// path as a user's mouse and keyboard): the title card, click to begin
// (pointer lock), WASD, mouse look, LMB fire, R reload, V camera, M mute,
// pointer-lock loss -> pause -> click to resume, death -> THE END -> click to
// try again. Prints one line per check and the #errlog contents.
//   node tools/playtest.mjs [width] [height]
import { spawn } from 'node:child_process';

const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 800);
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
  const r = await send('Runtime.evaluate', { expression: `(async () => { const N = window.__noir; return (${expr}); })()`, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
const click = async (x, y) => { await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); };
const key = async (code, keyName, ms = 0) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName, windowsVirtualKeyCode: keyName.toUpperCase().charCodeAt(0) });
  if (ms) await sleep(ms);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: keyName.toUpperCase().charCodeAt(0) });
};
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
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}/` });
  for (let k = 0; k < 150; k++) { if (await js('!!window.__noirReady')) break; await sleep(200); }
  await sleep(1500);

  // ---- title --------------------------------------------------------------------
  const t0 = await js(`({ state: N.game.state, title: !document.getElementById('title').classList.contains('hidden'), h1: document.querySelector('#title h1').textContent,
    prompt: document.querySelector('#title .go').textContent, vm: N.game.vm.visible, cam: N.camera.position.toArray().map((v) => +v.toFixed(3)) })`);
  check('title card over the live street', t0.state === 'title' && t0.title && t0.h1 === 'NOIR EXTREME' && t0.prompt === 'click to begin' && t0.vm === false, JSON.stringify(t0));
  await sleep(1500);
  const cam2 = await js('N.camera.position.toArray().map((v) => +v.toFixed(3))');
  check('title camera drifts', JSON.stringify(cam2) !== JSON.stringify(t0.cam), `${t0.cam} -> ${cam2}`);
  await key('KeyA', 'a');
  const snd = await js(`({ live: N.sfx.live, ctx: N.sfx.ctx && N.sfx.ctx.state, loops: [...N.sfx.loops.keys()].join(',') })`);
  check('a key on the title opens the sound (rain bed)', snd.live && /rainBed/.test(snd.loops), JSON.stringify(snd));

  // ---- click to begin -----------------------------------------------------------------
  await click(W / 2, H / 2);
  await sleep(600);
  const s1 = await js(`({ locked: document.pointerLockElement === N.renderer.domElement, state: N.game.state,
    title: !document.getElementById('title').classList.contains('hidden'), vm: N.game.vm.visible, hud: !document.getElementById('hud').classList.contains('titled') })`);
  check('click to begin: pointer lock, playing, gun in hand, HUD up', s1.locked && s1.state === 'playing' && !s1.title && s1.vm && s1.hud, JSON.stringify(s1));
  if (!s1.locked) throw new Error('no pointer lock in this headless build: the rest needs it');

  // ---- WASD, mouse look ------------------------------------------------------------------
  const p0 = await js('N.controller.pos.toArray()');
  await key('KeyW', 'w', 700);
  const p1 = await js('N.controller.pos.toArray()');
  const moved = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
  check('W walks forward', moved > 1.2, `moved ${moved.toFixed(2)} m`);
  await key('KeyD', 'd', 400);
  const p2 = await js('N.controller.pos.toArray()');
  check('D strafes', Math.hypot(p2[0] - p1[0], p2[2] - p1[2]) > 0.5);
  const y0 = await js('N.controller.yaw');
  for (let i = 1; i <= 5; i++) await mouse('mouseMoved', W / 2 + 40 * i, H / 2, { button: 'none' });
  await sleep(100);
  // (trusted mouse moves under pointer lock carry movementX; should a build
  // not report it, the same handler is driven with a synthetic event)
  let y1 = await js('N.controller.yaw');
  let lookVia = 'trusted mouse';
  if (Math.abs(y1 - y0) < 1e-4) {
    await js(`(document.dispatchEvent(new MouseEvent('mousemove', { movementX: 200, movementY: -40 })), 1)`);
    y1 = await js('N.controller.yaw');
    lookVia = 'mousemove event';
  }
  check('mouse look turns the view', Math.abs(y1 - y0) > 0.05, `${lookVia}: yaw ${y0.toFixed(3)} -> ${y1.toFixed(3)}`);

  // ---- fire, reload -------------------------------------------------------------------------
  const shots0 = await js('N.game.counters.shots');
  await mouse('mousePressed', W / 2, H / 2);
  await sleep(600);
  await mouse('mouseReleased', W / 2, H / 2);
  const f = await js('({ shots: N.game.counters.shots, ammo: N.game.weapon.ammo, casings: N.game.fx.casings.list.length })');
  check('LMB fires the Tommy gun', f.shots - shots0 >= 4 && f.ammo < 50, JSON.stringify(f));
  await key('KeyR', 'r');
  await sleep(200);
  const r1 = await js(`({ reloading: N.game.weapon.reloading, note: document.querySelector('#hud .note').textContent })`);
  await sleep(2400);
  const r2 = await js('({ reloading: N.game.weapon.reloading, ammo: N.game.weapon.ammo })');
  check('R reloads (2.3 s, drum full)', r1.reloading && r1.note === 'reloading' && !r2.reloading && r2.ammo === 50, JSON.stringify([r1, r2]));

  // ---- M: mute ---------------------------------------------------------------------------------------
  await key('KeyM', 'm');
  await sleep(150);
  const m1 = await js(`({ muted: N.sfx.muted, stored: localStorage.getItem('noir.muted') })`);
  await key('KeyM', 'm');
  await sleep(150);
  const m2 = await js(`({ muted: N.sfx.muted, stored: localStorage.getItem('noir.muted') })`);
  check('M mutes and unmutes (persisted)', m1.muted && m1.stored === '1' && !m2.muted && m2.stored === '0', JSON.stringify([m1, m2]));

  // ---- pointer lock lost: pause, resume ---------------------------------------------------------------------
  await js('(document.exitPointerLock(), 1)');
  await sleep(400);
  const pz = await js(`({ paused: !document.getElementById('pausecard').classList.contains('hidden'), text: document.querySelector('#pausecard .go').textContent, t: N.time, mix: N.sfx.ducked })`);
  await sleep(800);
  const pz2 = await js('N.time');
  check('pointer lock lost: the pause card, the fight frozen, the mix down', pz.paused && pz.text === 'click to resume' && pz2 === pz.t && pz.mix, JSON.stringify({ ...pz, t2: pz2 }));
  await click(W / 2, H / 2);
  await sleep(500);
  const rs = await js(`({ locked: document.pointerLockElement === N.renderer.domElement, paused: !document.getElementById('pausecard').classList.contains('hidden'), t: N.time, mix: N.sfx.ducked })`);
  await sleep(300);
  const rs2 = await js('N.time');
  check('click to resume: lock back, the fight runs, the mix up', rs.locked && !rs.paused && rs2 > rs.t && !rs.mix, JSON.stringify({ ...rs, t2: rs2 }));

  // ---- death: THE END, try again ---------------------------------------------------------------------------------
  await js('(N.game.health.damage(500), 1)');
  await sleep(400);
  const e1 = await js(`({ state: N.game.state, end: !document.getElementById('endcard').classList.contains('hidden'), stats: document.querySelector('#endcard .sub').textContent,
    epi: document.querySelector('#endcard .epi').textContent, locked: !!document.pointerLockElement, pause: !document.getElementById('pausecard').classList.contains('hidden') })`);
  check('death: THE END (kills, an epitaph), no pause card', e1.state === 'dead' && e1.end && /kill/.test(e1.stats) && e1.epi.length > 10 && !e1.locked && !e1.pause, JSON.stringify(e1));
  await sleep(400);
  const e1b = await js('({ lower: +N.game.vm.lower.toFixed(2), shown: N.game.vm.root.visible })');
  check('death: the Tommy gun drops out of the frame', e1b.lower > 0.95 && !e1b.shown, JSON.stringify(e1b));
  await click(W / 2, H / 2);
  await sleep(600);
  const e2 = await js(`({ state: N.game.state, end: !document.getElementById('endcard').classList.contains('hidden'), hp: N.game.health.hp, locked: document.pointerLockElement === N.renderer.domElement })`);
  check('click to try again: a fresh start', e2.state === 'playing' && !e2.end && e2.hp === 100 && e2.locked, JSON.stringify(e2));
  const e3 = await js('({ lower: N.game.vm.lower, shown: N.game.vm.root.visible })');
  check('try again: the Tommy gun back at the shoulder', e3.lower === 0 && e3.shown, JSON.stringify(e3));

  const err = await js(`document.getElementById('errlog').textContent`);
  check('no console errors / warnings', !err, err ? err.slice(0, 300) : 'errlog empty');
} catch (e) {
  console.log('ABORT', e.message || e);
  results.push(false);
} finally {
  console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  process.exit(0);
}
