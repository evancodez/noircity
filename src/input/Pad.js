// [C12] The pad (docs/story/briefs/C12_PAD.md): one input layer that turns a
// PS5 controller (a standard-mapping gamepad: buttons 0 cross, 1 circle,
// 2 square, 3 triangle, 4 L1, 5 R1, 6 L2, 7 R2, 8 share, 9 options, 10 L3,
// 11 R3, 12-15 d-pad, 16 PS, 17 touchpad; axes 0/1 the left stick, 2/3 the
// right) into what the game already reads, so every mode works unchanged:
//   - key down / up events for the rulebook's keys (WAVE_C §2), dispatched
//     on the document as a keyboard's would be (the controller's keys, the
//     game's edges, the stills, main.js all hear them);
//   - mouse buttons as mousedown / mouseup on the canvas (LMB / RMB);
//   - the look as mouse moves into the controller's and the game's own
//     handlers (a curve: gentle in the middle, fast at the edge);
//   - an analogue channel for the modes that want it: pad.move (the walk's
//     speed), pad.car (the car's throttle, brake and steer, 0..1).
// The mapping mirrors the rulebook and changes with what is on screen
// (context()): the title, the pause card and THE END's card are menus
// (padUi.js); the stills take X / options; a fist fight puts each trigger on
// the fist of its side; the car makes the triggers the pedals and L1 the
// lean out of the window; a puzzle's table makes the sticks the cursor and
// L1 / R1 the wheel. A button held across a change of context is ignored
// until it is let go (an X that chose BEGIN never reaches the stills) - never
// through a fail's black and back, and never the car's pedals (enter()).
// The pad is active once any of its controls moves; input.last is the last
// device used ('pad' | 'keys'), and the kit draws its cards for it.
// Keyboard and mouse keep working at the same time.
// Pointer lock: a pad has no click to give the browser. The pad holds the
// game (pad.holds) without the lock once it has started it, resumed it or
// played in it: main.js treats that as locked (no pause card), and a click
// still takes the mouse for a player who goes back to it.
// Proof without a pad: ?padfake=1 reads window.__pad = { buttons: [18 values],
// axes: [4], rs?: { x, y, secs } (the right stick held for exactly secs) }
// instead of navigator.getGamepads() (tools/play.mjs's pad step).
import { Vector3 } from 'three';
const _sa = new Vector3(), _sb = new Vector3(), _sd = new Vector3();
export const PAD = {
  dz: 0.12, tdz: 0.05,            // the deadzones: the sticks (radial), the triggers
  look: { yaw: 3.2, pitch: 2.0, lin: 0.28, pow: 2.4 },   // rad/s at full tilt; u -> lin*u + (1-lin)*u^pow
  cursor: { rate: 900, lin: 0.3, pow: 2.2 },             // a puzzle's cursor: mouse counts/s at full tilt
  wheel: 900,                      // L1 / R1 on a puzzle: the wheel's units/s
  notch: 100,                      // [O7] the d-pad's left / right on foot: one notch of the wheel
  // [O7] the aim help (O4's merge: the pad's medium hands lost the street): L2
  // raised with a man near the sight (within cone rad, or width m of his chest
  // at his distance) and a clear line - the sight eased toward his chest: snap
  // of the way on the raise, then rate of what is left a second (at most max
  // rad/s); a stick pushed past stick is the hand's own and is never pulled
  aim: { cone: 0.1, width: 0.9, snap: 0.6, rate: 4.5, max: 1.4, stick: 0.55, range: 40 },
  move: 0.5, moveOff: 0.35,        // the left stick as W A S D: on past 0.5, off under 0.35
  trig: 0.3, trigOff: 0.18,        // a trigger as a button
  holdLow: 0.3,                    // circle held past this: a hold (let go, he stands)
  active: 0.3,                     // a control past this makes the pad the last device
  minPress: 0.05,                  // every emitted press lasts at least this (a step sees it)
  friction: 0.5,                   // a gun out, the look over a man I can see runs at this share (never a pull)
  flick: { from: 0.3, to: 0.65, secs: 0.16, square: 1.6 },   // a fist fight's hop on the stick: 0.3 -> 0.65 this fast, this square to its axis
  tommyEvery: 3,                   // the Tommy gun's rumble: the burst's first round, then every third
  repeat: [0.4, 0.15],             // a menu's held direction: the first repeat, then each
};
export const BTN = { cross: 0, circle: 1, square: 2, triangle: 3, L1: 4, R1: 5, L2: 6, R2: 7, share: 8, options: 9, L3: 10, R3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, touch: 17 };
export const input = { last: 'keys' };
// [O7] a gun of mine (O4's save.inventory): the d-pad's left / right turn through them
const hasGun = (G) => !!(G && G.save && (G.save.inventory || []).some((k) => k === 'revolver' || k === 'shotgun' || k === 'tommy'));

const KEYNAME = { Space: ' ', KeyE: 'e', KeyC: 'c', KeyR: 'r', KeyF: 'f', KeyQ: 'q', KeyM: 'm', KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ShiftLeft: 'Shift', ControlLeft: 'Control', Escape: 'Escape', Tab: 'Tab' };
const curve = (u, C) => C.lin * u + (1 - C.lin) * Math.pow(u, C.pow);

class Pad {
  constructor() {
    this.off = true;
    this.fake = false;
    this.seen = false;          // a pad has been used on this page
    this.gp = null;             // the gamepad (its rumble)
    this.b = new Float32Array(18);
    this.pb = new Float32Array(18);   // last frame's
    this.ax = [0, 0, 0, 0];
    this.ctx = 'off';
    this.engaged = false;       // the pad started / resumed / played the game: it holds it
    this.held = new Map();      // emitted code -> time down (s)
    this.release = new Map();   // code -> { from, until }: a tap to come (tap())
    this.stale = new Set();     // pad buttons held across a change of context
    this.mir = { W: false, S: false, A: false, D: false };
    this.trigOn = [false, false];
    this.sens = 1;              // the stick's sensitivity (the pause card's 'stick', 5 = 1)
    this.rumbleOn = true;
    this.rumbles = []; this.rumbleN = 0; this.lastRumble = -1;
    this.move = null;           // the walk's analogue channel { f, s }
    this.car = null;            // the car's { throttle, brake, steer }
    this.axes = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
    this.trigger = { l: 0, r: 0 };
    this.t = 0;
    this.low = null;            // circle: { at, was }
    this.nav = { dir: null, at: 0, next: 0 };
    this.fl = { x: { s: 0, low: 0, on: 0 }, y: { s: 0, low: 0, on: 0 } };   // the fist fight's flicks
    this.idleFail = false; this.idleHeld = [];
    this.tommy = { at: -9, n: 0 };
    this.shake0 = 0;
    this.listeners = [];
  }

  // main.js: { game, controller, hud, dom, sfx, fake, start(), resume() }
  attach(o) {
    Object.assign(this, { game: o.game, controller: o.controller, hud: o.hud, dom: o.dom, sfx: o.sfx, cb: { start: o.start, resume: o.resume } });
    this.fake = !!o.fake;
    this.off = false;
    o.controller.pad = this;
    // the last device: a real key, a click or a real mouse move
    const keys = (e) => { if (e.isTrusted) this.setLast('keys'); };
    addEventListener('keydown', keys, true);
    addEventListener('mousedown', keys, true);
    addEventListener('mousemove', (e) => { if (e.isTrusted && Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 4) this.setLast('keys'); }, true);
    addEventListener('gamepadconnected', () => { this.connected = true; });
    // (the pad lost while it holds the game without the lock: the pause card, not a man left standing)
    addEventListener('gamepaddisconnected', () => { this.connected = false; if (this.holds && document.pointerLockElement !== this.dom) this.pauseGame(); });
    // (the pad holding the game without the lock: a real ESC has no lock to let go - it pauses)
    addEventListener('keydown', (e) => { if (e.isTrusted && e.code === 'Escape' && this.holds && document.pointerLockElement !== this.dom) this.pauseGame(); });
    // rumble (small, honest: never continuous)
    const G = o.game;
    // (the Tommy gun's eleven rounds a second: a kick on the burst's first and
    // then every third - a 70 ms kick on each kept the motors on 3/4 of the time)
    G.on('shot', (e) => {
      if (e && e.weapon === 'tommy') {
        const T = this.tommy;
        T.n = this.t - T.at < 0.2 ? T.n + 1 : 0; T.at = this.t;
        if (T.n % PAD.tommyEvery) return;
      }
      this.rumble(0.25, 0.55, 70);
    });
    G.on('player:hit', (e) => this.rumble(0.75, 0.5, 170 + Math.min(80, (e && e.dmg) || 0)));
    G.on('brawl:hit', (e) => {
      if (!e) return;
      if (e.by === 'me' && (e.zone === 'head' || e.zone === 'broke')) this.rumble(0.5 + 0.15 * (e.power || 0), 0.35, 90 + 30 * (e.power || 0));
      else if (e.by === 'me' && e.zone === 'guard') this.rumble(0.25, 0.25, 60);
      else if (e.by === 'him' && e.power > 0) this.rumble(0.85, 0.55, 190);
      else if (e.by === 'him' && (e.zone === 'covered' || e.zone === 'shield')) this.rumble(0.3, 0.2, 70);
    });
    G.on('brawl:cue', () => this.rumble(0, 0.32, 120));
    return this;
  }

  get cfg() { return PAD; }
  setLast(dev) {
    if (input.last === dev) return;
    input.last = dev;
    if (this.onDevice) this.onDevice(dev);
  }

  // the pad holds the game without the pointer lock (main.js: as if locked)
  get holds() {
    const G = this.game, H = this.hud;
    return !this.off && this.engaged && !!G && G.state === 'playing' && !H.paused && !H.titleShown && !H.endShown;
  }

  // what the pad means now
  context() {
    const G = this.game, H = this.hud, C = this.controller;
    if (this.off || !G) return 'off';
    if (G.state === 'title') return H.titleShown ? 'title' : 'idle';
    if (H.endShown) return 'end';
    if (H.paused) return 'pause';
    if (G.stills.active) return 'stills';
    if (G.state !== 'playing' || G.failing) return 'idle';
    if (C.mode === 'table' || (G.inspect && G.inspect.active)) return 'table';
    if (G.brawl.active || C.mode === 'brawl' || (G.crowd && G.crowd.active && C.mode === 'crowd' && !G.crowd.free())) return 'brawl';   // [O4] the crowd brawl (free of them: the walk's)
    if (C.mode === 'drive') return 'drive';
    return 'play';
  }

  // the pad's state this frame: { buttons, axes } (values 0..1, -1..1)
  read() {
    if (this.fake) {
      const F = typeof window !== 'undefined' ? window.__pad : null;
      if (!F) return null;
      return { buttons: F.buttons || [], axes: F.axes || [], F };
    }
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of list) if (p && p.connected && (!gp || p.mapping === 'standard')) gp = p;
    if (!gp) return null;
    this.gp = gp;
    return { buttons: gp.buttons.map((b) => (typeof b === 'number' ? b : b.value || (b.pressed ? 1 : 0))), axes: gp.axes };
  }

  // the stick's (x, y) through the radial deadzone, rescaled to 0..1
  stick(x, y) {
    const m = Math.hypot(x, y);
    if (m < PAD.dz) return [0, 0];
    const k = Math.min(1, (m - PAD.dz) / (1 - PAD.dz)) / m;
    return [x * k, y * k];
  }

  // one rendered frame (main.js, before the simulation's steps)
  update(dt) {
    if (this.off) return;
    this.t += dt;
    // (the context follows the screen with or without a pad: the first press
    // on a page - the browser shows a pad only after one - is not 'held
    // across a change' of a context that changed before it)
    const ctx0 = this.context();
    if (ctx0 !== this.ctx && !this.b.some((v) => v > 0.3)) { this.releaseAll(); this.enter(ctx0, null); this.low = null; this.nav.dir = null; if (this.onContext) this.onContext(ctx0); }
    if (this.ctx === 'idle' && this.game.failing) this.idleFail = true;
    const raw = this.read();
    if (!raw) { if (this.held.size) this.releaseAll(); this.move = null; this.car = null; this.b.fill(0); this.pb.fill(0); return; }
    const B = this.b;
    for (let i = 0; i < 18; i++) B[i] = +(raw.buttons[i] || 0);
    for (let i = 0; i < 4; i++) this.ax[i] = +(raw.axes[i] || 0);
    // (the fake's right stick held for exactly its seconds: the look integrates that long)
    let lookDt = dt;
    const F = raw.F;
    if (F && F.rs) {
      this.ax[2] = F.rs.x || 0; this.ax[3] = F.rs.y || 0;
      lookDt = Math.min(dt, Math.max(0, F.rs.secs));
      F.rs.secs -= dt;
      if (F.rs.secs <= 0) delete F.rs;
    }
    let active = false;
    for (let i = 0; i < 18; i++) if (B[i] > PAD.active) active = true;
    for (let i = 0; i < 4; i++) if (Math.abs(this.ax[i]) > PAD.active) active = true;
    if (active) { this.seen = true; this.setLast('pad'); }
    const [mx, my] = this.stick(this.ax[0], this.ax[1]);
    const [rx, ry] = this.stick(this.ax[2], this.ax[3]);
    this.axes.move.x = mx; this.axes.move.y = my; this.axes.look.x = rx; this.axes.look.y = ry;
    const tg = (v) => (v < PAD.tdz ? 0 : (v - PAD.tdz) / (1 - PAD.tdz));
    this.trigger.l = tg(B[BTN.L2]); this.trigger.r = tg(B[BTN.R2]);
    const ctx = this.context();
    if (ctx !== this.ctx) {
      this.releaseAll();
      this.enter(ctx, B);
      this.low = null; this.trigOn[0] = this.trigOn[1] = false;
      this.nav.dir = null;
      if (this.onContext) this.onContext(ctx);
    }
    for (const i of [...this.stale]) if (B[i] < 0.2) this.stale.delete(i);
    const on = (i) => !this.stale.has(i) && B[i] > 0.5;
    const edge = (i) => on(i) && !(this.pb[i] > 0.5);
    // (a pad in use in play holds the game: the lock is the mouse's)
    if (active && (ctx === 'play' || ctx === 'brawl' || ctx === 'drive' || ctx === 'table' || ctx === 'stills')) this.engaged = true;
    const want = new Set();
    this.move = null; this.car = null;
    const usePad = input.last === 'pad';
    if (ctx === 'title' || ctx === 'pause' || ctx === 'end') {
      if (this.menu) this.menu.step(ctx, this.menuNav(on, edge, mx, my, dt));
    } else if (ctx === 'stills') {
      if (on(BTN.cross)) want.add('Space');
      if (on(BTN.square)) want.add('KeyE');
      // (options as ESC: twice skips; held, its repeats skip as a held ESC does)
      if (edge(BTN.options)) { this.key('Escape', true); this.optAt = this.t; this.optRep = this.t + 0.5; }
      else if (on(BTN.options) && this.t > this.optRep) { this.key('Escape', true, true); this.optRep = this.t + 0.1; }
      else if (!on(BTN.options) && this.pb[BTN.options] > 0.5) this.key('Escape', false);
    } else if (ctx === 'play' || ctx === 'brawl' || ctx === 'table' || ctx === 'drive') {
      this.playMap(ctx, on, edge, want, mx, my, usePad);
      this.look(ctx, rx, ry, mx, my, lookDt, on, dt);
      if (edge(BTN.options)) this.pauseGame();
    }
    this.sync(want);
    this.pb.set(B);
    // the car's knocks: a buzz with the body's jolt
    if (ctx === 'drive' && this.controller.drive && this.controller.drive.v) {
      const s = this.controller.drive.v.shake || 0;
      if (s - this.shake0 > 0.12) this.rumble(Math.min(0.8, s * 0.7), Math.min(0.9, 0.3 + s * 0.6), 110);
      this.shake0 = s;
    }
    if (typeof document !== 'undefined') document.body.classList.toggle('padheld', this.holds && document.pointerLockElement !== this.dom);
  }

  // a change of what is on screen. A button held across it is ignored until it
  // is let go (the X that chose BEGIN never reaches the stills, the square that
  // got into the car does not get out again) - but never through a fail's
  // black and back: the hand that held the throttle into "Lost him." holds it
  // into the retry, and the retry hears it ([C12] after the critic: the car sat
  // at 0 km/h after the retry under a trigger pressed to the floor)
  enter(ctx, B) {
    const from = this.ctx, held = (i) => !!B && B[i] > 0.3;
    if (ctx === 'idle') {
      this.idleFail = !!(this.game && this.game.failing);
      this.idleHeld = [];
      for (let i = 0; i < 18; i++) if (held(i)) this.idleHeld.push(i);
    } else if (from === 'idle') {
      if (!this.idleFail) for (const i of this.idleHeld || []) if (held(i)) this.stale.add(i);
    } else for (let i = 0; i < 18; i++) if (held(i)) this.stale.add(i);
    this.ctx = ctx;
  }

  // the rulebook on the pad (WAVE_C §2), by context
  playMap(ctx, on, edge, want, mx, my, usePad) {
    const M = this.mir, C = this.controller;
    const hy = (cur, v) => (cur ? v > PAD.moveOff : v > PAD.move);
    M.W = hy(M.W, -my); M.S = hy(M.S, my); M.A = hy(M.A, -mx); M.D = hy(M.D, mx);
    const trig = (k, v) => (this.trigOn[k] = this.trigOn[k] ? v > PAD.trigOff : v > PAD.trig);
    const L2 = !this.stale.has(BTN.L2) && trig(0, this.trigger.l), R2 = !this.stale.has(BTN.R2) && trig(1, this.trigger.r);
    if (ctx === 'drive') {
      // the car: R2 the throttle, L2 the brake (and reverse), the stick the
      // wheel; L1 held leans out of the window to aim (RMB), R1 fires (LMB),
      // and the foot stays on R2 (the keyboard's W + RMB + LMB: drive and
      // shoot at once - the brief's R2-fires-while-leaning let him get away
      // every time the good hands leaned out on the river road)
      // (the pedals are pedals: never stale - a foot held down drives at once)
      if (M.A) want.add('KeyA');
      if (M.D) want.add('KeyD');
      const throttle = this.trigger.r, brake = this.trigger.l;
      if (on(BTN.L1)) want.add('Mouse2');
      if (on(BTN.R1)) want.add('Mouse0');
      if (throttle > 0.25) want.add('KeyW');
      if (brake > 0.25) want.add('KeyS');
      if (on(BTN.cross)) want.add('Space');
      if (usePad) this.car = { throttle, brake, steer: -Math.sign(mx) * Math.pow(Math.abs(mx), 1.3) };
    } else {
      if (ctx === 'brawl') {
        // a fist fight: A / D / S are hops (Brawl.js: any press is one), so
        // the stick gives them only on a flick - past 0.65 within 0.16 s of
        // leaving 0.3, and square to its axis (|x| > 1.6 |y|) - then held while
        // the stick stays over (circling, backing away); a walk in a little off
        // straight, or a slow drift, never hops ([C12] after the critic)
        const fx = this.flick(this.fl.x, mx, my), fy = this.flick(this.fl.y, my, mx);
        if (M.W) want.add('KeyW');
        if (fy > 0) want.add('KeyS');
        if (fx < 0) want.add('KeyA');
        if (fx > 0) want.add('KeyD');
      } else if (ctx !== 'table') {
        if (M.W) want.add('KeyW');
        if (M.S) want.add('KeyS');
        if (M.A) want.add('KeyA');
        if (M.D) want.add('KeyD');
      }
      if (ctx !== 'table') {
        if (on(BTN.cross)) want.add('Space');
        if (on(BTN.L1) || on(BTN.L3)) want.add('ShiftLeft');
        if (on(BTN.R1)) want.add('KeyF');
        // circle: a tap toggles the crouch (C, at once); held past 0.3 s it
        // is a hold - let go, he stands again (where C is a toggle)
        const c = on(BTN.circle);
        if (c && !this.low) this.low = { at: this.t, was: this.isLow() };
        if (c) want.add('KeyC');
        if (!c && this.low) {
          if (this.t - this.low.at >= PAD.holdLow && !this.low.was && this.isLow()) this.tap('KeyC');
          this.low = null;
        }
        if (usePad && (mx || my)) this.move = { f: -my, s: mx };
      }
      // the triggers: R2 the right hand's act (LMB), L2 the other (RMB);
      // in a fist fight each trigger is the fist of its side (LMB the left)
      if (ctx === 'brawl') { if (L2) want.add('Mouse0'); if (R2) want.add('Mouse2'); }
      else { if (R2) want.add('Mouse0'); if (L2) want.add('Mouse2'); }
    }
    if (on(BTN.square)) want.add('KeyE');
    if (on(BTN.triangle)) want.add('KeyR');
    // [O7] (in the car the d-pad's right is the radio's dial, F; the touchpad held is Tab: the heat, the money)
    // [O7] on foot with a gun of mine the d-pad's left and right are the mouse's
    // wheel (one notch a press: the revolver drawn, put away; in a fist fight
    // the crowd's draw - O4's arms); else, and d-pad up, Q (the horn)
    const foot = ctx === 'play' || ctx === 'brawl';
    const armed = foot && hasGun(this.game);
    if (armed && (edge(BTN.left) || edge(BTN.right)) && (document.pointerLockElement === this.dom || this.holds)) this.game._mouseAcc.wheel += edge(BTN.right) ? PAD.notch : -PAD.notch;
    if (on(BTN.up) || (on(BTN.left) && !armed) || (on(BTN.right) && ctx !== 'drive' && !armed)) want.add('KeyQ');
    if (ctx === 'drive' && on(BTN.right)) want.add('KeyF');
    if (on(BTN.touch)) want.add('Tab');
    if (edge(BTN.down)) this.tap('KeyM');
    if (edge(BTN.share) || edge(BTN.touch)) this.tap('Tab');   // [O1b] the rulebook's Tab (what I carry, for a moment)
    void C;
  }
  isLow() { const C = this.controller; return !!(C.crouchOn || (C.sneak && C.sneak.crouch)); }
  // one axis of the stick as a flick: the side it was flicked to (-1 / 1) while
  // it stays over, else 0 (st: { s: the side last frame, low: when it left the middle, on })
  flick(st, v, o) {
    const a = Math.abs(v), s = a < PAD.flick.from ? 0 : Math.sign(v);
    if (!s || s !== st.s) { st.low = this.t; if (s !== st.on) st.on = 0; }
    st.s = s;
    if (st.on && a < PAD.moveOff) st.on = 0;
    if (!st.on && s && a > PAD.flick.to && a > PAD.flick.square * Math.abs(o) && this.t - st.low <= PAD.flick.secs) st.on = s;
    return st.on;
  }

  // the right stick: the look (a puzzle's table: the cursor, both sticks; L1 / R1 the wheel)
  look(ctx, rx, ry, mx, my, dt, on, rdt) {
    const C = this.controller, G = this.game;
    const locked = document.pointerLockElement === this.dom || this.holds;
    let cx = 0, cy = 0;
    if (ctx === 'table') {
      const k = PAD.cursor.rate * this.sens;
      const u = (v) => Math.sign(v) * curve(Math.abs(v), PAD.cursor);
      cx = (u(rx) + u(mx)) * k * dt; cy = (u(ry) + u(my)) * k * dt;
      const w = (on(BTN.R1) ? 1 : 0) - (on(BTN.L1) ? 1 : 0);
      if (w && locked) G._mouseAcc.wheel += w * PAD.wheel * rdt;
    } else {
      const s = C.sensitivity || 0.0021;
      const fr = ctx === 'play' && (rx || ry) ? this.friction() : 1;
      cx = Math.sign(rx) * curve(Math.abs(rx), PAD.look) * PAD.look.yaw * this.sens * fr * dt / s;
      cy = Math.sign(ry) * curve(Math.abs(ry), PAD.look) * PAD.look.pitch * this.sens * fr * dt / s;
      // [O7] the aim help: the pad's hand only
      if (ctx === 'play' && input.last === 'pad') { const a = this.aimHelp(rx, ry, dt); if (a) { cx += a[0]; cy += a[1]; } }
    }
    if (!cx && !cy) return;
    C._onMouse({ movementX: cx, movementY: cy, pad: true });
    if (locked) { G._mouseAcc.dx += cx; G._mouseAcc.dy += cy; }
  }
  // a gun out and the sight over a man I can see (his chest within about two
  // of his widths of the middle of the view, and a clear line from my eye to
  // it - the gun kit's own sight: clear glass is seen through, frosted glass,
  // wood and walls are not): the stick turns slower there - a stick's hand
  // settles on him as a mouse's does; it never moves the aim, and it never
  // finds a man behind a wall or a door's glass ([C12] after the critic)
  friction() {
    const G = this.game, W = G.player && G.player.weapons && G.player.weapons.active;
    if (!W && G.hands.set !== 'tommy') return 1;
    this.fr = 1;
    const m = G.camera.matrixWorld.elements, ex = m[12], ey = m[13], ez = m[14], fx = -m[8], fy = -m[9], fz = -m[10];
    let best = 1;
    for (const h of G.stage.hoods.list) {
      if (!h.alive || !h.bones || !h.bones.chest) continue;
      const c = h.bones.chest.matrixWorld.elements;
      const dx = c[12] - ex, dy = c[13] - ey, dz = c[14] - ez, L = Math.hypot(dx, dy, dz);
      if (L < 0.5 || L > 45) continue;
      const cos = (dx * fx + dy * fy + dz * fz) / L;
      const ang = Math.acos(Math.max(-1, Math.min(1, cos))), near = 2.2 * Math.atan2(0.3, L);
      if (ang >= near) continue;
      const u = ang / near, f = PAD.friction + (1 - PAD.friction) * u * u;
      if (f >= best || !this.sees(ex, ey, ez, c[12], c[13], c[14])) continue;
      best = f;
    }
    this.fr = best;
    return best;
  }
  // [O7] the aim help (PAD.aim): -> [movementX, movementY] toward the man
  // nearest the sight, or null; this.aimed = his name (the plays read it)
  aimHelp(rx, ry, dt) {
    const G = this.game, C = this.controller, A = PAD.aim;
    const W = G.player && G.player.weapons && G.player.weapons.active;
    const aiming = !!W && this.trigOn[0] && !this.stale.has(BTN.L2);
    const raised = aiming && !this.aimWas;
    this.aimWas = aiming;
    this.aimed = null;
    const list = G.stage && G.stage.hoods ? G.stage.hoods.list : null;
    if (!aiming || !list || Math.hypot(rx, ry) > A.stick) return null;
    const m = G.camera.matrixWorld.elements, ex = m[12], ey = m[13], ez = m[14], fx = -m[8], fy = -m[9], fz = -m[10];
    let best = null, bestAng = Infinity;
    for (const h of list) {
      if (!h.alive || !h.bones || !h.bones.chest) continue;
      const c = h.bones.chest.matrixWorld.elements;
      const dx = c[12] - ex, dy = c[13] - ey, dz = c[14] - ez, L = Math.hypot(dx, dy, dz);
      if (L < 0.8 || L > A.range) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy + dz * fz) / L)));
      if (ang > Math.max(A.cone, Math.atan2(A.width, L)) || ang >= bestAng) continue;
      if (!this.sees(ex, ey, ez, c[12], c[13], c[14])) continue;
      best = { h, dx, dy, dz }; bestAng = ang;
    }
    if (!best) return null;
    this.aimed = best.h.name || best.h.id || 'him';
    const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const dyaw = wrapA(Math.atan2(-best.dx, -best.dz) - Math.atan2(-fx, -fz));
    const dp = Math.atan2(best.dy, Math.hypot(best.dx, best.dz)) - Math.asin(Math.max(-1, Math.min(1, fy)));
    let ay, ap;
    if (raised) { ay = dyaw * A.snap; ap = dp * A.snap; }
    else {
      const k = Math.min(1, A.rate * dt), cap = A.max * dt;
      ay = Math.max(-cap, Math.min(cap, dyaw * k)); ap = Math.max(-cap, Math.min(cap, dp * k));
    }
    const s = C.sensitivity || 0.0021;
    return [-ay / s, -ap / s];
  }
  // a clear line for the eyes from (ax, ay, az) to (bx, by, bz)
  sees(ax, ay, az, bx, by, bz) {
    const G = this.game;
    _sa.set(ax, ay, az); _sb.set(bx, by, bz);
    if (G.guns && G.guns.see) return G.guns.see(_sa, _sb, 0.3);
    _sd.subVectors(_sb, _sa); const L = _sd.length();
    return L < 0.31 || !G.rays.raycast(_sa, _sd.divideScalar(L), L - 0.3, { anyHit: true });
  }
  // (the tools' inverse: mouse counts a second at tilt u on an axis, now)
  countsPerSec(u, axis = 'x') {
    const ctx = this.context();
    if (ctx === 'table') return PAD.cursor.rate * this.sens * curve(Math.min(1, Math.abs(u)), PAD.cursor);
    return curve(Math.min(1, Math.abs(u)), PAD.look) * (axis === 'x' ? PAD.look.yaw : PAD.look.pitch) * this.sens / (this.controller.sensitivity || 0.0021);
  }

  // the menus' directions: the d-pad or the left stick, a held one repeating
  menuNav(on, edge, mx, my) {
    const N = this.nav;
    let dir = on(BTN.up) ? 'up' : on(BTN.down) ? 'down' : on(BTN.left) ? 'left' : on(BTN.right) ? 'right' : null;
    if (!dir && Math.max(Math.abs(mx), Math.abs(my)) > 0.6) dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
    let go = null;
    if (dir && dir !== N.dir) { go = dir; N.next = this.t + PAD.repeat[0]; }
    else if (dir && this.t >= N.next) { go = dir; N.next = this.t + PAD.repeat[1]; }
    N.dir = dir;
    return { go, ok: edge(BTN.cross), back: edge(BTN.circle) || edge(BTN.options), opt: edge(BTN.options) };
  }

  // ---- the events a keyboard and a mouse would send ---------------------------------
  key(code, down, repeat = false) {
    const o = { code, key: KEYNAME[code] || code, bubbles: true, cancelable: true, repeat };
    document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', o));
  }
  button(code, down) {
    const b = code === 'Mouse0' ? 0 : code === 'Mouse2' ? 2 : 1;
    const o = { button: b, buttons: down ? (b === 2 ? 2 : 1) : 0, bubbles: true, cancelable: true, view: window };
    (this.dom || document).dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', o));
  }
  emit(code, down) { if (code.startsWith('Mouse')) this.button(code, down); else this.key(code, down); }
  // a short press of `code` a moment from now (after the same code's release,
  // if it is down: a step must see it up, then down)
  tap(code) { const from = this.t + (this.held.has(code) ? PAD.minPress + 0.02 : 0); this.release.set(code, { from, until: from + PAD.minPress + 0.02 }); }
  // the wanted codes against the ones down: down / up for the difference
  // (every press held at least minPress: a step must see it)
  sync(want) {
    for (const [code, T] of [...this.release]) { if (this.t >= T.until) this.release.delete(code); else if (this.t >= T.from) want.add(code); }
    for (const code of want) if (!this.held.has(code)) { this.emit(code, true); this.held.set(code, this.t); }
    for (const [code, at] of [...this.held]) {
      if (want.has(code) || this.t - at < PAD.minPress) continue;
      this.emit(code, false); this.held.delete(code);
    }
  }
  releaseAll() {
    for (const code of [...this.held.keys()]) this.emit(code, false);
    this.held.clear(); this.release.clear();
    this.mir.W = this.mir.S = this.mir.A = this.mir.D = false;
  }

  // options in play: the pause card (the lock let go by the page, or none to let go)
  pauseGame() {
    const G = this.game, H = this.hud;
    if (G.state !== 'playing' || H.paused || G.stills.active) return;
    this.engaged = true;
    if (document.pointerLockElement === this.dom) { document.exitPointerLock(); return; }
    H.showPause();
    if (this.sfx) this.sfx.pauseMix(true);
  }

  // rumble: a short effect where the pad has one (off in the settings)
  rumble(strong, weak, ms) {
    if (this.off || !this.rumbleOn || input.last !== 'pad' || !this.seen) return;
    if (this.t - this.lastRumble < 0.05) return;
    this.lastRumble = this.t;
    this.rumbleN++;
    if (this.rumbles.length > 40) this.rumbles.shift();
    this.rumbles.push([+this.t.toFixed(2), +strong.toFixed(2), +weak.toFixed(2), ms]);
    const A = this.gp && this.gp.vibrationActuator;
    if (A && A.playEffect) { try { const p = A.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: Math.min(1, weak), strongMagnitude: Math.min(1, strong) }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* no rumble */ } }
  }
}

export const pad = new Pad();
// the context a glyph is drawn for (glyphs.js): the fist fight's and the car's own triggers
export function glyphCtx() { const c = pad.ctx; return c === 'brawl' || c === 'drive' || c === 'table' ? c : 'play'; }
// the pad's glyphs are drawn (the last device is the pad, in play: never in shot mode)
export function padGlyphs() { return input.last === 'pad' && !pad.off; }
