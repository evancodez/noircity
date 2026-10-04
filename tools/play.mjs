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
//   { "look": [dx, dy], "steps": 8 }     mouse moves (movementX / Y under pointer lock);
//                                        [R2-G] or an expression giving [dx, dy]
//   { "until": "expr", "timeout": ms }   poll an expression over N = window.__noir,
//                                        G = N.game, until it is true (a FAIL on timeout)
//   { "shot": "name" }                   a screenshot to <out>/<name>.png
//   { "expect": "expr" }                 must be true (PASS / FAIL)
//   { "eval": "expr" }                   run it, print the result
//   { "walk": [[x, z], ...], "timeout": ms }   walk the points by real input: the
//                                        ([C7] "into": true: meant to be stopped - a wall, a fence)
//                                        mouse turns him toward the next, W held
//   { "clickOn": "css selector" }        a click at the centre of that element
//                                        ([R2-H] "taken": "expr", "retries": 4, "every": 3500: clicked again until expr is true)
//   { "drive": "tools/lib/<x>.mjs", "check": "expr over D", ... }   [B7] a
//                                        module's default export plays by real
//                                        input with this tool's primitives;
//                                        D = what it returns
//   { "reload": true }                   reload the page (a save survives it)
//   { "pad": { "b": ["x"], "v": { "r2": 0.5 }, "a": [lx, ly, rx, ry], "secs": 0.12, "hold": false, "release": ["x"] } }
//                                        [C12] the fake pad (?padfake=1, src/input/Pad.js): those buttons
//                                        (x o sq tri l1 r1 l2 r2 share opt l3 r3 up down left right ps tp)
//                                        and axes for secs, then let go (hold: kept; release: let go now)
// [C12] "input": "pad" (the play's own key; "padFlow": true lets a turn run on under the next move): every key, mouse button, turn and wheel the steps and the
// drivers ask for is played on the fake pad instead (the rulebook's mapping, by what is on screen: the
// fist fight's triggers, the car's pedals, a puzzle's cursor), and the keyboard and the mouse are never
// used (a FAIL if they are).
//   { "shoot": { "until": "expr", "cover": true, "timeout": ms, "shots": { name: expr }, "expect": "expr over F" } }
//                                        [B2] a gunfight by real input at a human pace (shoot() below)
//   { "fight": { "timeout": ms, "shots": { "name": "expr", ... }, "expect": "expr over F" } }
//                                        play the brawl by real input: read his
//                                        clip and its marks, hop / block / punish
//                                        at a first-timer's pace (a reaction time,
//                                        a wrong read now and then), until it ends;
//                                        a shot the first time each expr is true;
//                                        F = the fight's record in game time
//                                        { time, dur: [r1, r2, r3], perMin, throws,
//                                        downs, landed, taken }, checked by expect
// At the end: the #errlog contents (a non-empty log is a FAIL) and a summary;
// the exit code is 1 when anything failed.
import { spawn } from 'node:child_process';
import { sweepProfiles, endChrome, freePort, CHROME_WAIT_STEPS } from './lib/profile.mjs';
sweepProfiles();
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--')) || 'tools/plays/slice.json';
const opt = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const play = JSON.parse(readFileSync(file, 'utf8'));
const [W, H] = (opt('size') || (play.size || [1280, 800]).join('x')).split('x').map(Number);
const OUT = resolve(opt('out') || play.out || 'shots/play');
mkdirSync(OUT, { recursive: true });
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
  // ([C12] a pad play gives the page no user gesture at all: a pad's press is none)
  const r = await send('Runtime.evaluate', { expression: `(async () => { const N = window.__noir; const G = N && N.game; return (${expr}); })()`, awaitPromise: true, returnByValue: true, userGesture: play.input !== 'pad' });
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
let rawUses = 0;   // [C12] (a pad play: the keyboard and the mouse never used)
const rawKeyDown = (code) => { rawUses++; return send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: KEYNAME(code), windowsVirtualKeyCode: VK(code) }); };
const rawKeyUp = (code) => { rawUses++; return send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: KEYNAME(code), windowsVirtualKeyCode: VK(code) }); };
const rawMouse = (type, x, y, button = 'left', extra = {}) => { rawUses++; return send('Input.dispatchMouseEvent', { type, x, y, button, buttons: type === 'mousePressed' ? (button === 'right' ? 2 : 1) : 0, clickCount: 1, ...extra }); };
let keyDown = rawKeyDown, keyUp = rawKeyUp, mouse = rawMouse;
// a turn of the view: a trusted mouse move (under pointer lock the page
// reads the move between two positions); the cursor is walked back to the
// centre in steps too small to matter when it nears an edge
let mx = null, my = null, lookVia = null;
let turn = rawTurn;   // [C12]
async function rawTurn(dx, dy = 0) {
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
// ---- [C12] the fake pad (?padfake=1): window.__pad = { buttons, axes, rs? } ----------------
const PADB = { x: 0, o: 1, sq: 2, tri: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, opt: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, tp: 17 };
const PS = { buttons: Array(18).fill(0), axes: [0, 0, 0, 0] };
// (no user gesture: a real pad's press is not one either)
const jsNG = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, userGesture: false }); return r.result?.result?.value; };
// (a turn in flight - the right stick held for its seconds - goes on through the pushes
// that change a button; a new turn replaces it, as a hand's next move does)
let rsLive = null;
const pushPad = (rs = null) => {
  if (rs) rsLive = { x: rs.x, y: rs.y, until: Date.now() + rs.secs * 1000 };
  else if (rsLive && Date.now() < rsLive.until) rs = { x: rsLive.x, y: rsLive.y, secs: (rsLive.until - Date.now()) / 1000 };
  return jsNG(`(window.__pad = ${JSON.stringify({ buttons: PS.buttons, axes: PS.axes, ...(rs ? { rs } : {}) })}, 1)`);
};
async function padStep(P) {
  const names = P.b || [];
  for (const n of names) PS.buttons[PADB[n]] = 1;
  for (const [n, v] of Object.entries(P.v || {})) PS.buttons[PADB[n]] = v;
  if (P.a) P.a.forEach((v, i) => { if (v != null) PS.axes[i] = v; });
  for (const n of P.release || []) PS.buttons[PADB[n]] = 0;
  await pushPad();
  if (P.secs != null && !P.hold) {
    await sleep(P.secs * 1000);
    for (const n of names) PS.buttons[PADB[n]] = 0;
    for (const n of Object.keys(P.v || {})) PS.buttons[PADB[n]] = 0;
    if (P.a) P.a.forEach((v, i) => { if (v != null) PS.axes[i] = 0; });
    await pushPad();
  }
}
// the bots' hands on the pad: what they hold (KeyW, Mouse0 ...) as buttons and
// axes, by what the pad means on screen now (src/input/Pad.js context())
const VKH = new Set();
let padCtx = 'play', padCtxAt = 0, padQ = null, padQAt = 0;
const padCtxNow = async () => { if (Date.now() - padCtxAt > 120) { padCtx = (await js('N.pad.context()')) || 'play'; padCtxAt = Date.now(); } return padCtx; };
async function padSync() {
  const ctx = await padCtxNow();
  const h = (c) => VKH.has(c);
  const B = PS.buttons, A = PS.axes;
  B.fill(0); A[0] = 0; A[1] = 0;
  A[0] = (h('KeyD') ? 1 : 0) - (h('KeyA') ? 1 : 0);
  B[PADB.sq] = h('KeyE') ? 1 : 0; B[PADB.tri] = h('KeyR') ? 1 : 0; B[PADB.left] = h('KeyQ') ? 1 : 0; B[PADB.opt] = h('Escape') ? 1 : 0;
  if (ctx === 'drive') {
    // (the car: R2 the throttle, L2 the brake, X the handbrake; L1 leans out, R1 fires)
    B[PADB.r2] = h('KeyW') ? 1 : 0; B[PADB.l2] = h('KeyS') ? 1 : 0; B[PADB.x] = h('Space') ? 1 : 0;
    B[PADB.l1] = h('Mouse2') ? 1 : 0; B[PADB.r1] = h('Mouse0') ? 1 : 0;
  } else {
    A[1] = (h('KeyS') ? 1 : 0) - (h('KeyW') ? 1 : 0);
    B[PADB.x] = h('Space') || (ctx === 'stills' && h('Mouse0')) ? 1 : 0;
    B[PADB.o] = h('KeyC') || h('ControlLeft') ? 1 : 0;
    B[PADB.l1] = h('ShiftLeft') ? 1 : 0; B[PADB.r1] = h('KeyF') ? 1 : 0;
    if (ctx === 'brawl') { B[PADB.l2] = h('Mouse0') ? 1 : 0; B[PADB.r2] = h('Mouse2') ? 1 : 0; }
    else if (ctx !== 'stills') { B[PADB.r2] = h('Mouse0') ? 1 : 0; B[PADB.l2] = h('Mouse2') ? 1 : 0; }
  }
  await pushPad();
}
const padKeyDown = async (code) => { VKH.add(code); await padSync(); };
const padKeyUp = async (code) => { VKH.delete(code); await padSync(); };
async function padMouse(type, x, y, button = 'left', extra = {}) {
  if (type === 'mouseMoved') return;
  if (type === 'mouseWheel') {
    // (a puzzle's wheel: R1 / L1 held as long as the wheel's units take at the pad's rate)
    const units = extra.deltaY || 0, rate = (await js('N.pad.cfg.wheel')) || 900;
    const b = units > 0 ? PADB.r1 : PADB.l1;
    PS.buttons[b] = 1; await pushPad(); await sleep(Math.max(20, Math.abs(units) / rate * 1000)); PS.buttons[b] = 0; await pushPad();
    return;
  }
  const code = button === 'right' ? 'Mouse2' : 'Mouse0';
  if (type === 'mousePressed') VKH.add(code); else VKH.delete(code);
  await padSync();
}
// a turn: the right stick tilted and held as long as the turn takes at that tilt
// (the page's own curve and deadzone, read from it: N.pad.cfg)
const curveOf = (u, C) => C.lin * u + (1 - C.lin) * Math.pow(u, C.pow);
async function padTurn(dx, dy = 0) {
  if (!dx && !dy) return;
  // (the page's curve, sensitivities and context: read again every 300 ms)
  if (!padQ || Date.now() - padQAt > 300) { padQ = await js(`({ ctx: N.pad.context(), s: N.controller.sensitivity, ps: N.pad.sens, P: N.pad.cfg })`); padQAt = Date.now(); }
  const q = padQ;
  const P = q.P, table = q.ctx === 'table', C = table ? P.cursor : P.look;
  const rmax = (axis) => table ? P.cursor.rate * q.ps : (axis === 'x' ? P.look.yaw : P.look.pitch) * q.ps / q.s;
  const inv = (r) => { let a = 0, b = 1; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (curveOf(m, C) < r) a = m; else b = m; } return (a + b) / 2; };
  let T = 0.05;
  for (let k = 0; k < 8; k++) {
    const ux = inv(Math.min(1, Math.abs(dx) / (rmax('x') * T))), uy = inv(Math.min(1, Math.abs(dy) / (rmax('y') * T)));
    const full = Math.abs(dx) > rmax('x') * T * 0.999 || Math.abs(dy) > rmax('y') * T * 0.999;
    const m = Math.hypot(ux, uy);
    if (!full && m <= 1) {
      const raw = P.dz + m * (1 - P.dz), k2 = m > 0 ? raw / m : 0;
      await pushPad({ x: Math.sign(dx) * ux * k2, y: Math.sign(dy) * uy * k2, secs: T });
      // (the stick held its time before the next move; "padFlow": true - a driver that steers
      // closed-loop at a run's pace - goes on after a frame, the next turn replacing what is left)
      await sleep(play.padFlow ? Math.min(T * 1000 + 24, 34) : T * 1000 + 24);
      return;
    }
    T *= Math.max(1.3, m * 1.1);
  }
  await pushPad({ x: Math.sign(dx) * 0.7, y: Math.sign(dy) * 0.7, secs: T });
  await sleep(T * 1000 + 24);
}
const padMode = play.input === 'pad';
if (padMode) { keyDown = padKeyDown; keyUp = padKeyUp; mouse = padMouse; turn = padTurn; }
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r.result?.data) { writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); log(`shot  ${name}.png`); }
};

// the brawl by real input, at a first-timer's pace (the arcade pass,
// FIGHT.md v3): each mouse button an arm (a press a jab, a hold of 0.3 ..
// 0.6 s a hard punch), A / D hop aside - away from the hand that swings -,
// S hops back, SPACE held blocks, W walks in. His tell is seen 0.2 .. 0.3 s
// after it starts, one read in five is wrong or missed; an opening (his
// guard down on a side) is struck with the fist on its side 0.25 .. 0.45 s
// after it shows. The lesson is played as its cards ask. Returns the
// fight's record in game time (the manners' spans, his attacks a minute,
// what he was knocked into).
async function fight({ timeout = 240000, shots = {} } = {}) {
  const done = new Set();
  const plans = new Map();
  const held = new Map();   // code -> release time (ms)
  let seen = null, seenAt = 0, lastSide = 'R', lessonAt = 0, lessonStep = 0, grabT = 0, pokeT = 0;
  const T0 = Date.now();
  const cx = W / 2, cy = H / 2;
  const rr = (a, b) => a + (b - a) * Math.random();
  const down = async (code, ms) => { if (!held.has(code)) await keyDown(code); held.set(code, Date.now() + ms); };
  const tapKey = async (code) => { await keyDown(code); await sleep(30); await keyUp(code); };
  const btnDown = async (b, ms) => { const code = 'M' + b; if (held.has(code)) return; await mouse('mousePressed', cx, cy, b); held.set(code, Date.now() + ms); };
  const arm = (side) => (side === 'L' ? 'left' : 'right');
  await js(`(() => { const R = window.__fightRec = { t0: N.time, rounds: { 1: N.time }, his: {}, throws: [] };
    G.on('brawl:round', (e) => { if (e.n > 1 && R.rounds[e.n] == null) R.rounds[e.n] = N.time; });
    G.on('brawl:lesson', () => { R.lesson = N.time - R.t0; R.rounds[1] = N.time; });
    G.on('brawl:tell', () => { const n = G.brawl.round; R.his[n] = (R.his[n] || 0) + 1; });
    G.on('brawl:throw', (e) => R.throws.push(e.into)); return 1; })()`);
  const record = async () => js(`(() => { const R = window.__fightRec, B = G.brawl, t1 = N.time;
    const dur = [1, 2, 3].map((n) => +(((R.rounds[n + 1] ?? t1) - (R.rounds[n] ?? t1))).toFixed(1));
    return { time: +(t1 - R.t0).toFixed(1), lesson: +(R.lesson || 0).toFixed(1), dur, perMin: dur.map((d, i) => +((R.his[i + 1] || 0) / Math.max(1, d) * 60).toFixed(1)), throws: R.throws, downs: B.stats.downs, landed: B.stats.landed, taken: B.stats.taken, dodged: B.stats.dodged, blocked: B.stats.myBlocked, window: B.stats.window }; })()`);
  // his blow: its hand and kind (a swing is left AWAY from its hand)
  const INFO = { br_jab: ['L', 's'], br_jabR: ['R', 's'], br_cross: ['R', 's'], br_hook: ['R', 'w'], br_hookL: ['L', 'w'], br_body: ['R', 'w'], br_bodyL: ['L', 'w'],
    br_haymaker: ['R', 'o'], br_haymakerL: ['L', 'o'], br_rush: ['R', 'r'], br_shove: ['B', 'p'], br_bottle: ['R', 's'], br_bottle_thrust: ['R', 's'], br_stoolSwing: ['R', 'w'], br_throw: ['R', 't'], br_feint: ['R', 'w'], br_feintL: ['L', 'w'],
    br_answerL: ['L', 's'], br_answerR: ['R', 's'],  // [B8] his answer to a punch into his guard
    fm_hookSwing: ['R', 'l'], fm_hookChop: ['R', 'o'] };  // [R2-E] the foreman's hook: its long arc is left by a step back (or in)
  for (;;) {
    const s = await js(`(() => { const B = G.brawl; if (!B.active) return { off: true, finished: !!B.finished, won: !!B.stats.won };
      const h = B.him, m = B.me, c = B.c; const cl = h.clip ? c.clip(h.clip) : null; const e = G.eye;
      return { round: B.round, state: h.state, clip: h.clip, t: h.t, tell: cl && (cl.marks.tell ?? 0), strike: cl && cl.marks.strike, contact: cl && (cl.marks.contact ?? cl.marks.release), open: B.openSides(), missT: h.missT, atSpot: !!h.atSpot,
        me: m.act, holding: !!m.holding, reach: !!B.reachable(), his: B.stats.his || 0, d: Math.hypot(c.pos.x - e.x, c.pos.z - e.z), lesson: B.lesson ? B.lesson.step : 0, kind: B.lesson ? B.lesson.kind : null, chev: null, cue: B.cue && !B.cue.done ? B.cue.side : null, cueId: B.cue ? B.cue.rec.t0 : null, bounced: !!(B.lesson && B.lesson.bounced) }; })()`);  // [B8] the lesson's step by what it teaches; the throw's chevron
    for (const [name, expr] of Object.entries(shots)) if (!done.has(name) && await js(expr) === true) { done.add(name); await shot(name); }
    const now = Date.now();
    for (const [code, at] of [...held]) if (now >= at) { held.delete(code); if (code[0] === 'M') await mouse('mouseReleased', cx, cy, code.slice(1)); else await keyUp(code); }
    if (s.off) { for (const code of [...held.keys()]) { if (code[0] === 'M') await mouse('mouseReleased', cx, cy, code.slice(1)); else await keyUp(code); } return { ...s, ...(await record()) }; }
    if (now - T0 > timeout) { check('the fight ended in time', false, JSON.stringify(s)); return { ...s, ...(await record()) }; }
    if (s.me === 'down') { await sleep(50); continue; }
    // [C4] the dodge cue: the key toward the light, a first-timer's reaction
    // after it shows (0.15 .. 0.28 s; one in ten the wrong way)
    if (s.cue) {
      const key = 'cue@' + s.cueId;
      if (!plans.has(key)) plans.set(key, { act: s.lesson ? (s.cue === 'R' ? 'KeyD' : 'KeyA') : Math.random() < 0.1 ? (s.cue === 'R' ? 'KeyA' : 'KeyD') : (s.cue === 'R' ? 'KeyD' : 'KeyA'), at: now + rr(150, 280) });
      const P = plans.get(key);
      if (P.act && now >= P.at) { const a = P.act; P.act = null; if (held.has('KeyW')) { held.delete('KeyW'); await keyUp('KeyW'); } await tapKey(a); }
      await sleep(8); continue;
    }
    // (arm's length: W in; a hop back when he is on top of me; out of his
    // way while he reels to the window)
    const want = s.state === 'reel' ? (s.atSpot ? 1.35 : 2.6) : s.kind === 'throw' ? 3.0 : 1.4;
    if (!held.has('Space') && s.d > want + 0.2) await down('KeyW', 150);
    // the lesson: as its card asks, a human moment after it shows
    if (['jabL', 'jabR', 'guard', 'hold'].includes(s.kind) && s.state !== 'attack') {  // [B8]
      if (s.lesson !== lessonStep) { lessonStep = s.lesson; lessonAt = now + rr(1300, 2000); }
      if (now > lessonAt && s.me === 'idle' && s.d < 1.75) {
        if (s.kind === 'hold') { if (s.open) { await btnDown(Math.random() < 0.5 ? 'left' : 'right', rr(720, 920)); lessonAt = now + 1500; } }
        else if (s.open) { await btnDown(arm(s.open[0]), 60); lessonAt = now + rr(700, 1100); }
        else if (s.kind === 'guard' && !s.bounced) { await btnDown(Math.random() < 0.5 ? 'left' : 'right', 60); lessonAt = now + 1000; }
      }
      await sleep(16); continue;
    }
    if (s.kind === 'grab') { if (s.reach) await tapKey('KeyE'); await sleep(200); continue; }
    // his blow: seen 0.2 .. 0.3 s after its tell starts, answered by the rule
    if (s.state === 'attack' && s.contact != null) {
      const key = s.clip + '@' + s.his;
      if (!plans.has(key)) {
        const [hand, kind] = INFO[s.clip] || ['R', 's'];
        const away = hand === 'R' ? 'KeyD' : hand === 'L' ? 'KeyA' : (Math.random() < 0.5 ? 'KeyA' : 'KeyD');
        const r = Math.random();
        let act;
        // [B8] (a thrown thing: the hop the chevron points to)
        const cuedK = /[worptl]/.test(kind) || /bottle/.test(s.clip);   // [C4] most wait for the dodge cue (the lesson's always)
        if (s.kind === 'block') act = 'block'; else if (cuedK && (s.lesson || Math.random() < 0.6)) act = null; else if (kind === 't') act = s.chev === 'L' ? 'KeyA' : s.chev === 'R' ? 'KeyD' : r < 0.5 ? 'KeyA' : 'KeyD'; else if (s.lesson) act = away;
        else if (kind === 'w' || kind === 'o') act = away;
        else if (kind === 'r') act = r < 0.5 ? 'KeyA' : 'KeyD';
        else if (kind === 'l') act = r < 0.8 ? 'KeyS' : 'in';  // [R2-E]
        else if (kind === 'p') act = r < 0.5 ? 'KeyS' : away;
        else act = r < 0.35 ? 'KeyA' : r < 0.7 ? 'KeyD' : r < 0.85 ? 'block' : 'KeyS';
        plans.set(key, { act: !s.lesson && Math.random() < 0.2 ? null : act, seen: s.tell + rr(0.2, 0.3) });
      }
      const P = plans.get(key);
      if (P && P.act && s.t >= P.seen) {
        const act = P.act; P.act = null;
        if (held.has('KeyW')) { held.delete('KeyW'); await keyUp('KeyW'); }
        if (act === 'block') await down('Space', Math.max(120, (s.contact - s.t + 0.15) * 1000));
        else if (act === 'in') await down('KeyW', 420);  // [R2-E] in, inside the hook's arc
        else await tapKey(act);
      }
      if (s.t < s.contact + 0.05) { await sleep(16); continue; }
    }
    if (s.me !== 'idle' || held.has('Mleft') || held.has('Mright') || held.has('Space') || s.d > 1.75) { await sleep(16); continue; }
    if (s.state === 'reel') { if (s.atSpot) await btnDown(Math.random() < 0.5 ? 'left' : 'right', rr(700, 900)); await sleep(16); continue; }
    // an opening, seen a beat late
    const look = s.open + ':' + s.state + ':' + (s.missT > 0);
    if (look !== seen) { seen = look; seenAt = now + (s.missT > 0 ? rr(200, 300) : rr(280, 450)); }
    if (now < seenAt) { await sleep(16); continue; }
    if (s.holding && s.state !== 'attack') { await btnDown('right', Math.random() < 0.3 ? 600 : 60); seenAt = now + 700; }
    else if (s.open) {
      const side = s.open.length === 2 ? (lastSide = lastSide === 'L' ? 'R' : 'L') : s.open;
      const big = s.state === 'stun' || s.missT > 0.35;
      await btnDown(arm(side), big && Math.random() < 0.55 ? (s.state === 'stun' ? rr(640, 880) : rr(440, 620)) : 60);  // [B8] held to the second or third tick ([C4] version 5: the load begins 0.3 s into the hold)
      seenAt = now + rr(180, 300);
    } else if (s.round >= 2 && s.reach && !s.holding && s.state === 'move' && now > grabT) { grabT = now + 9000; await tapKey('KeyE'); }
    else if (s.state === 'move' && now > pokeT) { pokeT = now + rr(1600, 3200); await btnDown(Math.random() < 0.5 ? 'left' : 'right', 60); }
    await sleep(16);
  }
}

// walk by real input: turn with mouse moves (under pointer lock) toward
// each point, W held until there
async function walk(points, timeout) {
  const T = Date.now() + timeout;
  let wDown = false;
  const setW = async (on) => { if (on !== wDown) { wDown = on; await (on ? keyDown('KeyW') : keyUp('KeyW')); } };
  let prev = null;   // [B4]
  for (const [x, z] of points) {
    let from = prev;   // [B4]
    for (;;) {
      const s = await js(`({ x: N.controller.pos.x, z: N.controller.pos.z, yaw: N.controller.yaw, sens: N.controller.sensitivity, mode: N.controller.mode })`);
      if (Date.now() > T) { await setW(false); log(`walk stuck at ${JSON.stringify(s)} going to ${[x, z]}`); return false; }
      if (!from) from = [s.x, s.z];   // [B4]
      const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
      if (d < 0.4) break;
      // [B4] in scene 6's run (7.5 m/s) a slow poll on a loaded machine can
      // step past a point: one already behind me along its leg, and near, is
      // reached (turning back for it is a man standing at a corner)
      if (s.mode === 'run' && dx * (x - from[0]) + dz * (z - from[1]) < 0 && d < 2.5) break;
      const want = Math.atan2(-dx, -dz);
      const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
      if (Math.abs(err) > 0.03) await turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0);
      await setW(Math.abs(err) < 0.6);
      await sleep(33);
    }
    prev = [x, z];   // [B4]
  }
  await setW(false);
  return true;
}

// [B2] a gunfight by real input, at a human's pace (scene 5's play, and any
// scene with the revolver): the man in sight nearest the middle of the view
// is picked; after a reaction time the view is turned onto his chest by
// trusted mouse moves (a hand's aim: a little off, settling), LMB fires,
// a breath, again or the next man. R reloads an empty gun. With cover: true
// C ducks while reloading or with nobody in sight, and rises (C) to shoot.
// Ends when `until` (an expression over N, G) is true, or on the timeout;
// returns what was fired and taken.
async function shoot({ until = 'false', timeout = 150000, cover = false, react = [260, 460], err = 0.025, shots = {} } = {}) {
  const T0 = Date.now();
  const rr = (a, b) => a + (b - a) * Math.random();
  const done = new Set();
  let fired = 0, target = null, aimedAt = 0, last = 0;
  const tap = async (code) => { await keyDown(code); await sleep(40); await keyUp(code); };
  for (;;) {
    const s = await js(`(() => { const C = N.controller, e = G.eye, W = G.player.weapons.active;
      const out = { done: !!(${until}), yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, crouch: C.crouchK || 0, hp: G.health.hp, dead: G.health.dead,
        ammo: W ? W.ammo : 0, reloading: !!(W && W.reloading), men: [] };
      const d = new N.THREE.Vector3();
      for (const h of G.stage.hoods.list) {
        if (!h.alive) continue;
        const c = h.bones.chest.getWorldPosition(new N.THREE.Vector3());
        d.subVectors(c, e); const L = d.length(); d.divideScalar(L);
        // (in sight: nothing solid between; a pane of glass is seen through)
        let o = e.clone(), left = L, seen = true;
        for (let k = 0; k < 4 && seen; k++) { const hit = G.rays.raycast(o, d, left - 0.25); if (!hit) break; if (hit.mesh.userData.pane) { o = hit.point.clone().addScaledVector(d, 0.02); left -= hit.t + 0.02; } else seen = false; }
        out.men.push({ id: h.slot, x: c.x, y: c.y, z: c.z, L, seen });
      }
      return out; })()`);
    // [R2-A] (a read that threw - the room being set again after a fall - is tried again)
    if (!s || s.__exc) { await sleep(200); if (Date.now() - T0 > timeout) { check('the gunfight ended in time', false, s && s.__exc); return { fired, done: false }; } continue; }
    for (const [name, expr] of Object.entries(shots)) if (!done.has(name) && await js(expr) === true) { done.add(name); await shot(name); }
    if (s.done) return { fired, time: (Date.now() - T0) / 1000, hp: s.hp, done: true };
    if (Date.now() - T0 > timeout) { check('the gunfight ended in time', false, JSON.stringify({ men: s.men.length })); return { fired, done: false }; }
    if (s.dead) { await sleep(300); continue; }
    const eye = await js('({ x: G.eye.x, y: G.eye.y, z: G.eye.z })');
    const seen = s.men.filter((m) => m.seen);
    // reload an empty gun (down behind the cover while it goes)
    if (!s.reloading && s.ammo <= 0) { if (cover && s.crouch < 0.5) await tap('KeyC'); await tap('KeyR'); await sleep(rr(300, 500)); continue; }
    if (s.reloading) { await sleep(120); continue; }
    if (!seen.length) {
      // nobody in sight: down behind it; nobody in sight from down there
      // for a while: up to look
      if (cover && s.crouch < 0.5 && Date.now() - last > 1200) { await tap('KeyC'); last = Date.now(); }
      else if (cover && s.crouch > 0.5 && Date.now() - last > 1800) { await tap('KeyC'); last = Date.now(); }
      await sleep(150); target = null; continue;
    }
    // the man nearest the middle of the view
    const ang = (m) => { const yw = Math.atan2(-(m.x - eye.x), -(m.z - eye.z)), pt = Math.atan2(m.y - eye.y, Math.hypot(m.x - eye.x, m.z - eye.z));
      return { dy: Math.atan2(Math.sin(yw - s.yaw), Math.cos(yw - s.yaw)), dp: pt - s.pitch }; };
    seen.sort((a, b) => { const A = ang(a), B = ang(b); return Math.hypot(A.dy, A.dp) - Math.hypot(B.dy, B.dp); });
    const m = seen[0];
    if (!target || target.id !== m.id) { target = m; await sleep(rr(react[0], react[1])); aimedAt = 0; continue; }
    // the turn onto him in a few moves: most of the way, then the settle, a little off
    const A = ang(m);
    const ey = (Math.random() - 0.5) * 2 * err, ep = (Math.random() - 0.5) * 2 * err;
    const px = Math.round(-(A.dy + ey) / s.sens), py = Math.round(-(A.dp + ep) / s.sens);
    const n = Math.min(6, Math.max(2, Math.ceil(Math.hypot(px, py) / 60)));
    for (let i = 0; i < n; i++) { await turn(Math.round(px / n), Math.round(py / n)); await sleep(16); }
    await sleep(rr(60, 140));
    if (!aimedAt) aimedAt = Date.now();
    await mouse('mousePressed', mx ?? W / 2, my ?? H / 2, 'left'); await sleep(40); await mouse('mouseReleased', mx ?? W / 2, my ?? H / 2, 'left');
    fired++;
    await sleep(rr(330, 520));
    // (standing to shoot: two at a man, then down behind the desk for a breath)
    if (cover && s.crouch < 0.5 && fired % 2 === 0 && Math.random() < 0.6) { await tap('KeyC'); last = Date.now(); await sleep(rr(500, 900)); }
  }
}
// [B5] the tail (scene 7) by real input, a first-timer's hands: W held
// (off when he is too close), A / D pressed toward a line down the road
// (round the truck and the car coming the other way); in the close RMB held
// and the mouse brought onto his rear tyre, LMB when it is on; E to get
// out, W and the mouse to walk to him, E to take him, the mouse onto the
// river. Ends when `until` holds. { drive: { until, timeout, line, shots } }
async function drive({ until = 'false', timeout = 240000, line = 2.4, shots = {} } = {}) {
  const done = new Set(), held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } };
  const cx = W / 2, cy = H / 2;
  let rmb = false, lastFire = 0, lastE = 0;
  const T0 = Date.now();
  for (;;) {
    if (await js(until) === true) break;
    if (Date.now() - T0 > timeout) { check('the tail ended in time', false); break; }
    // (a screenshot blocks the loop for a second on a loaded machine: the
    // wheel is let go first, or a held A / D put the car into the rail)
    for (const [name, expr] of Object.entries(shots)) if (!done.has(name) && await js(expr) === true) { done.add(name); await set('KeyA', false); await set('KeyD', false); await shot(name); }
    const s = await js(`(() => { const T = G.scenes.ctx && G.scenes.ctx.flags.tail; if (!T || !T.my) return { none: true };
      const v = T.my, R = N.stage.track, C = N.controller, cam = N.camera;
      const out = { state: T.state, mode: C.mode, sens: C.sensitivity, speed: v.speed, gap: T.gap, prompt: G.hud.promptShown, fade: !!T.fade };
      // the line: the right lane, round the truck and the oncoming car
      let d = ${line};
      const avoid = [T.truck, T.oncoming].filter(Boolean);
      for (const o of avoid) if (o.s - v.s < 60 && o.s - v.s > -8) d = Math.max(d, o.d + 4.2);
      const la = 9 + Math.max(0, v.speed) * 0.55;
      const F = R.frame(Math.min(1760, v.s + la), {});
      const tx = F.x + F.rx * d, tz = F.z + F.rz * d;
      const c = Math.cos(v.yaw), sn = Math.sin(v.yaw), dx = tx - v.pos.x, dz = tz - v.pos.z;
      out.err = Math.atan2(-(dx * sn + dz * c), dx * c - dz * sn) - v.yawRate * 0.12;
      // his rear tyre in the eye's frame (the aim)
      const h = T.his;
      if (h && T.state === 'close') {
        const p = h.seat(new N.THREE.Vector3(-1.5, 0.45, 0.7), new N.THREE.Vector3()).applyMatrix4(cam.matrixWorldInverse);
        out.ay = Math.atan2(p.x, -p.z); out.ap = Math.atan2(p.y, Math.hypot(p.x, p.z)); out.aimK = T.aimK;
      }
      const Q = T.question;
      if (Q && Q.man) { const m = Q.man.pos, e = cam.position; out.man = [m.x, m.z]; out.dMan = Math.hypot(m.x - e.x, m.z - e.z);
        const q = new N.THREE.Vector3(m.x, 1.3, m.z).applyMatrix4(cam.matrixWorldInverse); out.my = Math.atan2(q.x, -q.z);
        if (Q.water) { const w = Q.water.clone().applyMatrix4(cam.matrixWorldInverse); out.wy = Math.atan2(w.x, -w.z); out.wp = Math.atan2(w.y, Math.hypot(w.x, w.z)); } }
      return out; })()`);
    if (!s || s.none || s.fade) { await set('KeyA', false); await set('KeyD', false); await sleep(40); continue; }
    if (s.mode === 'drive') {
      const drivingOn = s.state === 'start' || s.state === 'chase' || s.state === 'close';
      await set('KeyW', drivingOn && !(s.gap < 9 && s.speed > 8));
      await set('KeyS', drivingOn && s.gap < 7 && s.speed > 6);
      const e = s.err;
      await set('KeyA', drivingOn && e > 0.035);
      await set('KeyD', drivingOn && e < -0.035);
      // the gun: RMB held once he is near; the mouse onto the tyre; LMB
      if (s.state === 'close' && s.gap < 27 && s.ay != null) {
        if (!rmb) { rmb = true; await mouse('mousePressed', cx, cy, 'right'); }
        if (s.aimK > 0.95) {
          const ex = s.ay, ey = s.ap;
          if (Math.abs(ex) > 0.006 || Math.abs(ey) > 0.006) await turn(Math.round(Math.max(-60, Math.min(60, ex * 0.7 / s.sens))), Math.round(Math.max(-40, Math.min(40, -ey * 0.7 / s.sens))));
          if (Math.abs(ex) < 0.02 && Math.abs(ey) < 0.03 && Date.now() - lastFire > 420) { lastFire = Date.now(); await mouse('mousePressed', cx, cy, 'left'); await sleep(40); await mouse('mouseReleased', cx, cy, 'left'); }
        }
      } else if (rmb) { rmb = false; await mouse('mouseReleased', cx, cy, 'right'); }
      if (/get out/.test(s.prompt) && Date.now() - lastE > 1500) { lastE = Date.now(); await set('KeyW', false); await set('KeyA', false); await set('KeyD', false); await sleep(rr0(300, 600)); await keyDown('KeyE'); await sleep(60); await keyUp('KeyE'); }
    } else if (s.mode === 'walk' && s.man) {
      // to him, then E
      if (Math.abs(s.my) > 0.05) await turn(Math.round(Math.max(-40, Math.min(40, s.my * 0.6 / s.sens))), 0);
      await set('KeyW', s.dMan > 1.5 && Math.abs(s.my) < 0.6);
      if (/take him/.test(s.prompt) && Date.now() - lastE > 1500) { lastE = Date.now(); await set('KeyW', false); await keyDown('KeyE'); await sleep(60); await keyUp('KeyE'); }
    } else if (s.mode === 'hold' && s.wy != null) {
      // the question: the eyes to the river, a moment after he is pinned
      await set('KeyW', false);
      if (Date.now() - lastE > 1600 && (Math.abs(s.wy) > 0.04 || Math.abs(s.wp) > 0.05)) await turn(Math.round(Math.max(-25, Math.min(25, s.wy * 0.35 / s.sens))), Math.round(Math.max(-20, Math.min(20, -s.wp * 0.35 / s.sens))));
    }
    await sleep(33);
  }
  for (const c of [...held]) await set(c, false);
  if (rmb) await mouse('mouseReleased', cx, cy, 'right');
}
const rr0 = (a, b) => a + (b - a) * Math.random();

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
      // [B2] a press without coordinates is where the cursor is: under the
      // pointer lock a press in the frame's middle moved the cursor there,
      // and the view jumped by the distance (and every look after it too)
      const x = S.x ?? mx ?? W / 2, y = S.y ?? my ?? H / 2, b = S.button || 'left';
      if (S.x != null && mx != null) { mx = x; my = y; }
      if (S.mouse !== 'up') await mouse('mousePressed', x, y, b);
      if (S.mouse === 'click') await sleep(S.hold ?? 40);
      if (S.mouse !== 'down') await mouse('mouseReleased', x, y, b);
    } else if (S.look) {
      const n = S.steps || 8;
      // [R2-G] (a look may be an expression, as a walk's points may: the
      // mouse move onto a thing from wherever the last walk left the eye)
      const L = typeof S.look === 'string' ? await js(S.look) : S.look;
      if (typeof S.look === 'string') log(`look  ${S.look} -> ${JSON.stringify(L)}`);
      for (let i = 0; i < n; i++) { await turn(Math.round(L[0] / n), Math.round(L[1] / n)); await sleep(16); }
    } else if (S.until) {
      const T = Date.now() + (S.timeout ?? 20000);
      let ok = false, v;
      while (Date.now() < T) { v = await js(S.until); if (v === true) { ok = true; break; } await sleep(S.poll ?? 100); }
      if (!ok) check(`until ${S.until}`, false, `timeout ${S.timeout ?? 20000} ms ${v && v.__exc ? v.__exc : ''}`);
      else if (S.log) log(`ok    ${S.until}`);
      if (!ok && S.stop !== false) break;
    } else if (S.pad) await padStep(S.pad);   // [C12]
    else if (S.shot) await shot(S.shot);
    else if (S.expect) { const v = await js(S.expect); check(S.label || S.expect, v === true, v === true ? '' : JSON.stringify(v)); }
    else if (S.eval) log(`eval  ${S.eval} -> ${JSON.stringify(await js(S.eval))}`);
    else if (S.fight) {
      const r = await fight(S.fight);
      log(`fight ${JSON.stringify(r)}`);
      if (S.fight.expect) { const ok = new Function('F', `return (${S.fight.expect});`)(r) === true; check(S.fight.label || S.fight.expect, ok, ok ? '' : JSON.stringify(r)); }
    }
    // [B2] a gunfight by real input (shoot above)
    else if (S.shoot) {
      const r = await shoot(S.shoot);
      log(`shoot ${JSON.stringify(r)}`);
      if (S.shoot.expect) { const ok = new Function('F', `return (${S.shoot.expect});`)(r) === true; check(S.shoot.label || S.shoot.expect, ok, ok ? '' : JSON.stringify(r)); }
    }
    else if (S.drive && typeof S.drive === 'object') { await drive(S.drive); log('drive done'); }   // [B5] ([R2-F] an object: a path string is B7's driver below)
    // [B7] a driver of the play's own: a module whose default export plays a
    // stretch by real input with the tools above (the gunfight of scene 9)
    else if (S.drive) {
      const mod = await import(resolve(S.drive));
      // [C1] (cursor(): where the cursor stands after the trusted turns - a press
      // anywhere else moves it there first and the view jumps by the distance)
      const r = await mod.default({ js, turn, keyDown, keyUp, mouse, shot, log, check, sleep, send, W, H, opts: S, cursor: () => [mx ?? W / 2, my ?? H / 2] });
      log(`drive ${S.drive} -> ${JSON.stringify(r)}`);
      if (S.check) { const ok = new Function('D', `return (${S.check});`)(r) === true; check(S.label || S.check, ok, ok ? '' : JSON.stringify(r)); }
    }
    // (a walk's points may be an expression: where the fight left him)
    // ([C7] "into": true - a walk into a wall, a fence, a car: it is meant to
    // be stopped short; the expect after it says where)
    else if (S.walk && S.into) { const pts = typeof S.walk === 'string' ? await js(S.walk) : S.walk; const ok = await walk(pts, S.timeout ?? 30000); log(`walk into ${JSON.stringify(pts)}: ${ok ? 'reached (nothing stopped it)' : 'stopped'}`); }
    else if (S.walk) { const pts = typeof S.walk === 'string' ? await js(S.walk) : S.walk; const ok = await walk(pts, S.timeout ?? 30000); check(`walk ${JSON.stringify(pts)}`, ok); if (!ok && S.stop !== false) break; }
    else if (S.clickOn && padMode) check(`clickOn ${S.clickOn} in a pad play`, false, 'the mouse is not used in a pad play');   // [C12]
    else if (S.clickOn) {
      const r = await js(`(() => { const e = document.querySelector(${JSON.stringify(S.clickOn)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      if (!r) check(`clickOn ${S.clickOn}`, false, 'no element');
      else {
        await mouse('mousePressed', r[0], r[1]); await sleep(40); await mouse('mouseReleased', r[0], r[1]);
        // [R2-H] { "clickOn": sel, "taken": "expr", "retries": 4, "every": 3500 }: on a loaded machine the browser now
        // and then refuses the pointer lock a click asks for, and the game does not begin (the title stays up): the
        // click is made again, up to `retries` times, until `taken` is true
        if (S.taken) for (let k = 0; k < (S.retries ?? 4); k++) {
          let ok = false;
          for (let w = 0; w < (S.every ?? 3500) / 250 && !ok; w++) { await sleep(250); ok = (await js(S.taken)) === true; }
          if (ok) break;
          log(`clickOn ${S.clickOn}: not taken, clicking again (${k + 1})`);
          await mouse('mousePressed', r[0], r[1]); await sleep(40); await mouse('mouseReleased', r[0], r[1]);
        }
      }
    }
    // [R3] { "heap": "label" }: a garbage collection, then the page's JS heap
    // in use (DevTools, exact), logged and kept in window.__heap[label] (MB)
    else if (S.heap) {
      await send('HeapProfiler.collectGarbage', {});
      const h = (await send('Runtime.getHeapUsage', {})).result || {};
      const mb = +((h.usedSize || 0) / 1048576).toFixed(1);
      await js(`((window.__heap = window.__heap || {})[${JSON.stringify(S.heap)}] = ${mb}, 1)`);
      log(`heap  ${S.heap}: ${mb} MB used of ${((h.totalSize || 0) / 1048576).toFixed(1)} MB`);
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
  if (padMode) check('[C12] the keyboard and the mouse never used (the pad alone)', rawUses === 0, `${rawUses} key or mouse events`);
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
  endChrome(chrome, `/tmp/noir-play-${PORT}`);
  process.exit(fails ? 1 : 0);
}
