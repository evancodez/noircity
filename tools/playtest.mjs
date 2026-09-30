// Scripted play-through of the real game page (no ?shot=) in headless Chrome,
// driven through the DevTools protocol with TRUSTED input events (the same
// path as a user's mouse and keyboard): the title card, BEGIN (pointer lock)
// into scene 1 (the diner: seated at the counter; E lights up, orders,
// drinks three times), at the pay beat off the stool (the controller's walk
// mode, set from the page: there is no stand-up key in the story) out
// through the diner's door onto the street and back in, mouse look, the
// Tommy gun put in the hands (LMB fire, R reload), M mute, pointer-lock
// loss -> pause -> click to resume, death -> THE END -> click to try again
// (back at the pay beat on the stool), E pay -> his line with the view eased
// round to him -> the fight begins; a lost round re-staged under a held
// black without a sound; every sound asked for by name built. Scene 1
// starts square to the counter. Prints one line per check and the #errlog
// contents. (tools/play.mjs plays the whole slice by real input.)
//   node tools/playtest.mjs [width] [height]
import { spawn } from 'node:child_process';

import { sweepProfiles, endChrome, freePort, CHROME_WAIT_STEPS } from './lib/profile.mjs';
sweepProfiles();
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 800);
const PORT = await freePort();
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--use-mock-keychain', '--password-store=basic', '--mute-audio', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`,
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
  for (let k = 0; k < CHROME_WAIT_STEPS; k++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(100); } }
  if (!ver) throw new Error(`headless Chrome did not open DevTools on port ${PORT} within ${CHROME_WAIT_STEPS / 10} s`);
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  ({ result: { sessionId: sid } } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  // (mute=1: a test run never makes a sound, whatever the browser does)
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}/?mute=1` });
  for (let k = 0; k < 150; k++) { if (await js('!!window.__noirReady')) break; await sleep(200); }
  await sleep(1500);

  // ---- title --------------------------------------------------------------------
  const t0 = await js(`({ state: N.game.state, title: !document.getElementById('title').classList.contains('hidden'), h1: document.querySelector('#title h1').textContent,
    begin: (document.querySelector('#title .opt[data-k=begin]') || {}).textContent || '', vm: N.game.vm.visible, cam: N.camera.position.toArray().map((v) => +v.toFixed(3)) })`);
  check('title card over the live diner: BEGIN', t0.state === 'title' && t0.title && t0.h1 === 'NOIR EXTREME' && /begin/i.test(t0.begin) && t0.vm === false, JSON.stringify(t0));
  const mu = await js(`({ muted: N.sfx.muted, line: [...document.querySelectorAll('#title .keys')].map((e) => e.style.display === 'none' ? '' : e.textContent).join(' / ') })`);
  check('mute=1: the game starts muted and the title says so (M sound)', mu.muted && /sound off/.test(mu.line) && /M sound/.test(mu.line), JSON.stringify(mu));
  await sleep(1500);
  const cam2 = await js('N.camera.position.toArray().map((v) => +v.toFixed(3))');
  check('title camera drifts', JSON.stringify(cam2) !== JSON.stringify(t0.cam), `${t0.cam} -> ${cam2}`);
  await key('KeyA', 'a');
  const snd = await js(`({ live: N.sfx.live, ctx: N.sfx.ctx && N.sfx.ctx.state, loops: [...N.sfx.loops.keys()].join(',') })`);
  check('a key on the title opens the sound (rain bed)', snd.live && /rainBed/.test(snd.loops), JSON.stringify(snd));

  // ---- click to begin: the diner -----------------------------------------------------
  await click(W / 2, H / 2);
  await sleep(600);
  const s1 = await js(`({ locked: document.pointerLockElement === N.renderer.domElement, state: N.game.state,
    title: !document.getElementById('title').classList.contains('hidden') })`);
  check('BEGIN: pointer lock, playing', s1.locked && s1.state === 'playing' && !s1.title, JSON.stringify(s1));
  if (!s1.locked) throw new Error('no pointer lock in this headless build: the rest needs it');
  await sleep(1200);
  const sc = () => js(`({ scene: N.game.scenes.current && N.game.scenes.current.id, beat: N.game.scenes.beat, mode: N.controller.mode, hands: N.game.hands.set,
    gun: N.game.vm.gun.visible, clip: N.game.hands.current, prompt: document.querySelector('#hud .prompt').style.display !== 'none' ? document.querySelector('#hud .prompt').textContent : '',
    eye: N.camera.position.toArray().map((v) => +v.toFixed(2)), room: N.game._room })`);
  const d0 = await sc();
  check('the title leads into scene 1: seated at the counter, the smoke set, no gun', d0.scene === 'diner' && d0.beat === 'settle' && d0.mode === 'seated' && d0.hands === 'smoke' && !d0.gun && d0.room === 'diner', JSON.stringify(d0));
  // (the view's turn off the stool's square, radians: + toward Dot's end, - toward his)
  const off = `(() => { const a = N.game.stage.anchor('diner.stool.player').yaw, y = N.controller.yaw; return +Math.atan2(Math.sin(y - a), Math.cos(y - a)).toFixed(3); })()`;
  const sq = await js(`({ off: ${off}, pitch: +N.controller.pitch.toFixed(3), roll: +N.camera.rotation.z.toFixed(4) })`);
  check('scene 1 starts square to the counter: straight at the back bar, pitch -0.14, no roll', Math.abs(sq.off) < 0.01 && Math.abs(sq.pitch + 0.14) < 0.01 && Math.abs(sq.roll) < 1e-3, JSON.stringify(sq));
  const until = async (expr, ms) => { for (let t = 0; t < ms; t += 150) { if (await js(expr)) return true; await sleep(150); } return false; };
  await until(`document.querySelector('#hud .prompt').style.display !== 'none'`, 9000);
  await key('KeyE', 'e');
  await sleep(300);
  const d1 = await sc();
  check('E lights up (the hands play lightUp)', d1.clip === 'lightUp', JSON.stringify(d1));
  const promptIs = (re) => `${re}.test(document.querySelector('#hud .prompt').textContent) && document.querySelector('#hud .prompt').style.display !== 'none'`;
  const toOrder = await until(`N.game.scenes.beat === 'order'`, 6000);
  // (E calls Dot at once; she may finish an errand first)
  await sleep(400); await key('KeyE', 'e');
  const toScotch = await until(promptIs('/scotch/'), 30000);
  await key('KeyE', 'e');
  const toDrink = await until(`N.game.scenes.beat === 'drink'`, 20000);
  for (let k = 0; k < 3; k++) { await until(promptIs('/drink/'), 8000); await key('KeyE', 'e'); await until(`!${promptIs('/drink/')}`, 2000); await until(`!N.game.hands.busy && !N.game.hands.current`, 6000); await sleep(300); }
  const toPay = await until(`N.game.scenes.beat === 'pay'`, 6000);
  const fill = await js(`N.game.stage.part('diner').items.get('glass').userData.fill`);
  check('E moves the beats on: settle, order (Dot pours), drink (three sips empty the glass), pay', toOrder && toScotch && toDrink && toPay && fill < 0.01, JSON.stringify({ toOrder, toScotch, toDrink, toPay, fill }));

  // ---- off the stool (set from the page: no stand-up key); out through the door and back in ----
  await js(`(N.controller.setMode('walk', { pose: { x: -12.85, y: 0.15 + 1.65, z: 3.6, yaw: Math.PI, pitch: 0 } }), 1)`);
  await sleep(200);
  const w0 = await sc();
  check('off the stool (walk mode)', w0.mode === 'walk', JSON.stringify(w0));
  // (walked by the controller's own input, as the battle's autopilot does:
  // turn toward a point, W until there; the colliders and the room's walls
  // decide where he can go)
  const walkTo = async (x, z, ms = 6000) => js(`(async () => { const C = N.controller;
    for (let t = 0; t < ${ms}; t += 50) { const dx = ${x} - C.pos.x, dz = ${z} - C.pos.z; if (Math.hypot(dx, dz) < 0.3) break;
      C.yaw = Math.atan2(-dx, -dz); C.auto = { f: 1, s: 0 }; await new Promise((r) => setTimeout(r, 50)); }
    C.auto = null; return [+C.pos.x.toFixed(2), +C.pos.z.toFixed(2)]; })()`);
  await walkTo(-12.85, 3.0); await walkTo(-12.85, 0.6); await walkTo(-11.2, 0.6);
  const out = await walkTo(-8.6, 0.6);
  const w1 = await sc();
  check('out through the diner door onto the pavement', out[0] > -9.4 && w1.room === 'street', JSON.stringify({ out, room: w1.room }));
  await walkTo(-8.8, 4.0);
  const blocked = await walkTo(-12.5, 4.0, 2500);
  check('the front wall stops him (no way in but the door)', blocked[0] > -10.2, JSON.stringify(blocked));
  await walkTo(-8.8, 0.6); await walkTo(-11.6, 0.6);
  const back = await walkTo(-12.85, 2.0);
  const w2 = await sc();
  check('back in through the door', back[0] < -12 && w2.room === 'diner', JSON.stringify({ back, room: w2.room }));

  // ---- mouse look ------------------------------------------------------------------------------
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

  // ---- the Tommy gun in the hands: fire, reload --------------------------------------------------
  await js('(N.game.player.weapons.equip("tommy"), 1)');
  const shots0 = await js('N.game.counters.shots');
  await mouse('mousePressed', W / 2, H / 2);
  await sleep(600);
  await mouse('mouseReleased', W / 2, H / 2);
  const f = await js('({ shots: N.game.counters.shots, ammo: N.game.weapon.ammo, casings: N.game.fx.casings.list.length, gun: N.game.vm.gun.visible })');
  check('the Tommy gun in hand: LMB fires', f.gun && f.shots - shots0 >= 4 && f.ammo < 50, JSON.stringify(f));
  await key('KeyR', 'r');
  await sleep(200);
  const r1 = await js(`({ reloading: N.game.weapon.reloading, note: document.querySelector('#hud .note').textContent })`);
  await sleep(2900);
  const r2 = await js('({ reloading: N.game.weapon.reloading, ammo: N.game.weapon.ammo })');
  check('R reloads (2.6 s, drum full)', r1.reloading && r1.note === 'reloading' && !r2.reloading && r2.ammo === 50, JSON.stringify([r1, r2]));

  // ---- M: mute ---------------------------------------------------------------------------------------
  await key('KeyM', 'm');
  await sleep(150);
  const m1 = await js(`({ muted: N.sfx.muted, stored: localStorage.getItem('noir.muted') })`);
  await key('KeyM', 'm');
  await sleep(150);
  const m2 = await js(`({ muted: N.sfx.muted, stored: localStorage.getItem('noir.muted') })`);
  // (a test run starts muted - navigator.webdriver - and its forced mute is
  // never written to the player's saved choice: M turns the sound on, then
  // off again, and nothing is stored)
  check('M toggles the sound (a test run starts muted, and keeps the saved choice as it was)', !m1.muted && m2.muted && m1.stored === m2.stored, JSON.stringify([m1, m2]));

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
  check('death: THE END (an epitaph, no counters), no pause card', e1.state === 'dead' && e1.end && !/kill/i.test(e1.stats) && e1.epi.length > 10 && !e1.locked && !e1.pause, JSON.stringify(e1));
  await sleep(400);
  const e1b = await js('({ lower: +N.game.vm.lower.toFixed(2), shown: N.game.vm.root.visible })');
  check('death: the Tommy gun drops out of the frame', e1b.lower > 0.95 && !e1b.shown, JSON.stringify(e1b));
  await click(W / 2, H / 2);
  await sleep(600);
  const e2 = await js(`({ state: N.game.state, end: !document.getElementById('endcard').classList.contains('hidden'), hp: N.game.health.hp, locked: document.pointerLockElement === N.renderer.domElement })`);
  check('click to try again: a fresh start', e2.state === 'playing' && !e2.end && e2.hp === 100 && e2.locked, JSON.stringify(e2));
  await sleep(1400);
  const e3 = await js('({ lower: N.game.vm.lower, scene: N.game.scenes.current && N.game.scenes.current.id, beat: N.game.scenes.beat, mode: N.controller.mode, hands: N.game.hands.set })');
  check('try again: back into the scene at its beat, on the stool, the smoke set', e3.lower === 0 && e3.scene === 'diner' && e3.beat === 'pay' && e3.mode === 'seated' && e3.hands === 'smoke', JSON.stringify(e3));

  // ---- E pay: the wallet, his line, he stands: the fight --------------------------------------------------
  await until(promptIs('/pay/'), 8000);
  const p0 = await js(off);
  await key('KeyE', 'e');
  await until(`N.hud.sayShown.includes('Cardinal')`, 12000);
  await sleep(600);
  const p1 = await js(off);
  check('try again at pay: square to the counter; his line: the view eased round to frame him', Math.abs(p0) < 0.01 && p1 < -0.9 && p1 > -1.25, JSON.stringify({ before: p0, atHisLine: p1 }));
  const fight = await until(`N.game.scenes.current && N.game.scenes.current.id === 'fight' && N.game.brawl.active`, 40000);
  const f2 = await js(`({ scene: N.game.scenes.current && N.game.scenes.current.id, beat: N.game.scenes.beat, mode: N.controller.mode, hands: N.game.hands.set, brawl: N.game.brawl.active, him: N.game.brawl.state && N.game.brawl.state.hisState, mack: N.game.cast.get('mack') && N.game.cast.get('mack').kind })`);
  check('E pay: he stands, the fight begins with the lesson (brawl mode, fists, the brawler)', fight && f2.beat === 'lesson' && f2.mode === 'brawl' && f2.hands === 'fists' && f2.mack === 'brawler', JSON.stringify(f2));

  // ---- the lesson by real input (FIGHT.md §1-3): each button an arm; a hold
  // winds up the hard punch; the slip goes away from the hand that swings ----
  const L = (e) => js(`(() => { const B = N.game.brawl; return ${e}; })()`);
  await until(`N.game.brawl.lesson && document.querySelector('#fightcards .fc .t').textContent.includes('LEFT CLICK')`, 8000);
  const card1 = await js(`document.querySelector('#fightcards .fc .t').textContent`);
  const btn = (b) => ({ button: b, buttons: b === 'right' ? 2 : 1 });
  const press = async (b, ms = 60) => { await mouse('mousePressed', W / 2, H / 2, btn(b)); await sleep(ms); await mouse('mouseReleased', W / 2, H / 2, { ...btn(b), buttons: 0 }); };
  // (the arcade pass, FIGHT.md v3 §6: a press is the jab at once; his guard
  // is down on the side the card names; step 3 his guard is up - a punch
  // bounces off it - then a hand comes down; step 4 both hands down, a hold
  // of 0.7 s and let go; step 5 his slow right hook, a hop away: D)
  await sleep(1500);
  await press('left');
  const j1 = await until(`N.game.brawl.did.jabL === true`, 3000);
  await sleep(1500);
  await press('right');
  const j2 = await until(`N.game.brawl.did.jabR === true`, 3000);
  await sleep(1200);
  const s3 = await until(`N.game.brawl.lesson && N.game.brawl.lesson.step === 3`, 3000);
  await press('left');
  const bounced = await until(`N.game.brawl.lesson && (N.game.brawl.lesson.bounced || N.game.brawl.lesson.step > 3)`, 2000);
  const low = await until(`N.game.brawl.lesson && (N.game.brawl.lesson.step > 3 || !!N.game.brawl.lesson.lowered)`, 5000);
  const side = await L(`B.lesson && B.lesson.lowered`);
  await sleep(500);
  if (side) await press(side === 'L' ? 'left' : 'right');
  const s4 = await until(`N.game.brawl.lesson && N.game.brawl.lesson.step === 4`, 3000);
  await sleep(900);
  await press('right', 700);
  const j3 = await until(`N.game.brawl.did.hard === true`, 3000);
  const jinfo = await L(`({ jabs: B.stats.jabs, hards: B.stats.hards, landed: B.stats.landed, blocked: B.stats.myBlocked, act: B.me.act, d: +Math.hypot(B.c.pos.x - N.game.eye.x, B.c.pos.z - N.game.eye.z).toFixed(2), tgt: B.onTarget(), step: B.lesson && B.lesson.step, locked: document.pointerLockElement === N.renderer.domElement })`);
  check('the lesson by real input: LEFT CLICK into his open left, RIGHT CLICK, a punch bounced off his guard then one into the hand he dropped, hold and let go a hard punch', /LEFT CLICK/.test(card1) && j1 && j2 && s3 && bounced && low && s4 && j3, JSON.stringify({ card1, j1, j2, s3, bounced, low, side, s4, j3, ...jinfo }));
  // step 5: his slow right hook - D, a hop away from the hand that swings
  // (as a player would: when the hook is on its way; missed, he throws it
  // again, so up to three tries)
  let slipped = false;
  for (let k = 0; k < 3 && !slipped; k++) {
    await until(`N.game.brawl.lesson && N.game.brawl.lesson.step === 5 && N.game.brawl.him.clip === 'br_hook' && N.game.brawl.him.state === 'attack' && N.game.brawl.him.t > 0.2 && N.game.brawl.him.t < 0.36`, 12000);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyD', key: 'd', windowsVirtualKeyCode: 68 });
    await sleep(60);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyD', key: 'd', windowsVirtualKeyCode: 68 });
    slipped = await until(`N.game.brawl.lesson && (N.game.brawl.lesson.missed || N.game.brawl.lesson.step > 5)`, 2500);
  }
  const open = await L(`({ open: B.openSides(), flash: document.querySelector('#fightcards .fl').textContent, dodged: B.stats.dodged, into: B.stats.wrongSlips, taken: B.stats.taken, his: B.stats.his, clips: B.stats.clips, step: B.lesson && B.lesson.step, st: B.him.state, clip: B.him.clip, me: B.me.act, hp: N.game.health.hp })`);
  check('his right hook, left by a hop away from the hand (D): it misses and he is open', slipped && open.dodged >= 1, JSON.stringify(open));

  // ---- a lost round: the room set again under the black, quietly -------------------------------------
  // (down: the black comes in over 0.35 s, the room is re-staged behind it
  // with the sound hushed - nothing breaks, no one-shot plays - the black
  // holds to 1.5 s, then lifts over 0.6 s: up at the round's start with 60)
  await sleep(1500);
  const q = await js(`(async () => { const G = N.game, B = G.brawl, S = N.sfx;
    const breaks = []; const on = (e) => breaks.push(e.kind); G.on('break', on);
    const tick = () => new Promise((r) => setTimeout(r, 50));
    B.playerDown();
    const t0 = N.time; let played0 = null, fadeMin = 1;
    while (N.time - t0 < 1.45) { await tick(); if (N.time - t0 > 0.5) { if (played0 == null) played0 = S.stats.played; fadeMin = Math.min(fadeMin, +G.hud.fadeEl.style.opacity); } }
    const played = S.stats.played - played0;
    while (N.time - t0 < 2.5) await tick();
    G.off('break', on);
    return { breaks: breaks.length, played, fadeMin, fadeEnd: +G.hud.fadeEl.style.opacity, me: B.me.act, hp: G.health.hp, active: B.active, round: B.round, lesson: !!B.lesson, mack: !!G.cast.get('mack') }; })()`);
  check('down: re-staged under a held black, nothing broken, nothing heard; back up with 60, the lesson not taught again', q.breaks === 0 && q.played === 0 && q.fadeMin > 0.99 && q.fadeEnd < 0.01 && q.me === 'idle' && q.active && q.mack && Math.round(q.hp) === 60 && !q.lesson, JSON.stringify(q));

  // ---- the sounds the lanes ask for by name all exist (the audio test table) --------------------------
  const names = ['ring', 'burst_water', 'burst_leak', 'sign_drop', 'awning_tear', 'neon_pop', 'break_saucer', 'break_mug', 'break_pieCase', 'break_crate', 'break_barrel',
    'break_sign', 'break_pipe', 'break_awning', 'break_papers', 'break_thing', 'topple_barrel', 'topple_crate', 'jukebox_change', 'bell', 'doorbell', 'register', 'jukebox_hit', 'hiss',
    'break_bottle', 'break_tumbler', 'break_cup', 'break_plate', 'break_stool', 'break_table', 'topple_stool', 'topple_table'];
  const missing = await js(`(async () => { const M = await import('/src/audio/Sfx.js'); return ${JSON.stringify(names)}.filter((n) => !M.SOUND_NAMES.includes(n)); })()`);
  const aliased = await js(`[...(N.sfx.aliased || [])]`);
  check('every sound asked for by name is built (none silent, none left to a fallback in this play)', Array.isArray(missing) && missing.length === 0 && aliased.length === 0, JSON.stringify({ missing, aliased }));

  const err = await js(`document.getElementById('errlog').textContent`);
  check('no console errors / warnings', !err, err ? err.slice(0, 300) : 'errlog empty');
} catch (e) {
  console.log('ABORT', e.message || e);
  results.push(false);
} finally {
  console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
  try { ws && ws.close(); } catch {}
  endChrome(chrome, `/tmp/noir-play-${PORT}`);
  process.exit(0);
}
