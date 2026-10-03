import * as THREE from 'three';
import { NODES, STRETCHES, YARD, ROOFS, KITCHEN, LANES, CUT } from '../../stages/backlot/plan.js';
import { WRUN, layOn } from '../../cast/kinds/watcher.js';
import { Course, pathAt, pathHeading, project, corners } from './course.js';

// The chase on foot (lane C6, wave C): the watcher running his own race on
// the course, and the rules that lose him.
//   Him: he runs his way (course.js: his lane of the yard and his way over,
//   chosen each try) at his own pace - 6.3 m/s on the flat, slower into his
//   corners, up the stair, through his doors - with his own costs: his
//   fences (a vault, 0.8 s), his slides, his jump, the look back over his
//   shoulder, the one slip on the wet. Nothing in his pace looks at how far
//   behind I am: no rubber band, no burst when I am close ([C6 3rd]).
//   His doings: he pulls the alley's bins down across it (always: the first
//   SPACE); with me close behind he pulls more down - the crates at the
//   alley's head, a bin kicked rolling down the lane at me, the kitchen's
//   rack, the crates in Tanner's Row, the market's barrow across its aisle -
//   so a good run is a denser one, never a shorter one. He slams his door in
//   the yard; the other lane's is locked.
//   The rules: the gap is the way between us (course.js); out of my sight
//   too long counts too (close behind him round a corner does not; nor his
//   being on the other way over at the fork). "He's getting away." comes
//   first (hud.warn, at least a second before), then "Lost him."
//   (game.fail), back at the start of the stretch with the gap it starts
//   with. The thresholds are RULES.
export const RULES = {
  base: 6.5,                 // his pace on the flat (mine is 6.8)
  // ([C6 3rd] the fear's burst when I was close - +0.8 m/s for 3 s - is gone:
  // a boost, which the brief forbids; close, he pulls things down instead)
  trick: 9.0,                // close enough for him to pull something down behind him
  // ([C6 3rd] 22 / 17 / 36, were 24 / 19 / 36: every thing in the press hall,
  // the cut, the market missed did not even warn - now two or three misses
  // in a stretch warn, four or five lose; one never does. The warning comes
  // sooner, the loss no sooner: clumsy hands live in the warning a while)
  warnOn: 22, warnOff: 17,   // the gap that warns (and lets go)
  lost: 36,                  // the gap that loses him
  // ([C6 2nd] out of sight counts from the warning's gap on: a man 20 m
  // behind on the roofs loses sight of him over the shed's slope every try)
  unseenWarn: 3.5, unseenLost: 7.0, unseenFrom: 22,   // out of sight (only past this gap)
  grace: 2.0,                // a stretch's first seconds (the black lifting): no warning yet ([C6 3rd] was 1.6)
};
const V = (x, z, y = 0) => new THREE.Vector3(x, y, z);
const _t = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// the stretches in order, and the node each begins at (on the course)
// ([C6 3rd] + market: the street is now up Mercer Street, round the corner
// and in under the market's back arch; the market from its north end)
// (and + cut: the el's stretch now from the press hall's south door down its
// delivery yard and up the avenue to the cut's mouth; the cut its own)
export const STRETCH_ORDER = ['alley', 'lane', 'yard', 'kitchen', 'press', 'el', 'cut', 'over', 'street', 'market', 'car'];
const STRETCH_NODE = { alley: 'foot', lane: 'laneIn', yard: 'laneOut', kitchen: null, press: 'kDoor', el: 'pS', cut: 'cutE', over: 'aOut', street: 'rowEnd', market: 'mN', car: 'gate' };

export class Chase {
  constructor(ctx, { lane = null, over = null } = {}) {
    this.ctx = ctx;
    this.G = ctx.game;
    this.stage = ctx.stage;
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const pick = (k, a, b) => (q && q.get(k)) || (this.G.shotMode ? a : Math.random() < 0.5 ? a : b);
    // his choices this try (the yard's lane, the way over)
    this.lane = lane || pick('c6Lane', 'W', 'E');
    // (over the roofs: the short way, which he knows; the row under them is
    // the long plain way, mine to take if I like - a man who took the short
    // way could not be passed by one on the long)
    this.over = over || (q && q.get('c6Over')) || 'roofs';
    this.course = new Course({ locked: this.lane === 'W' ? 'E' : 'W' });
    this.P = this.course.his(this.lane, this.over);
    this.w = null; this.fig = null;
    this.s = 0; this.v = 0; this.act = 'stand';
    this.yOff = 0;
    this.active = false;            // the rules on (the run beats)
    this.grace = 0;
    this.events = this.plan();
    this.ei = 0;
    this.look = null; this.lean = 0; this.pull = null; this.skid = null;
    this.unseen = 0; this.seen = true; this.losT = 0;
    this.warned = false; this.warnAt = null;
    this.log = []; this.lostN = 0;
    this.myD = 0; this.hisD = 0; this.gapNow = 0;
    // ([C6 3rd] his real pace along the course - over a fence, round a corner,
    // in a clip that carries him - what my run is held to on his heels)
    this.hisVel = 0; this.prevHisD = null;
    this.tricks = [];               // what he pulled down this try (the play's record)
    this.onStretch = null;          // fn(name): my progress reached a stretch's start
    this.stretch = null;
  }

  // ---- his way and what is on it -----------------------------------------------------------------
  // events by his path distance: his obstacles, his doings, his looks back
  plan() {
    const P = this.P, out = [];
    const things = this.stage.part('things');
    const on = (T) => {
      const F = T.frame();
      const r = project(P, F.cx, F.cz, 0, 1e9);
      return r.d < 1.6 ? r.s : null;
    };
    const add = (s, kind, data = {}) => { if (s != null) out.push({ s, kind, ...data }); };
    // ([C6 3rd] + the alley's sacks, the press's bundles, the cut's barrels and
    // sacks, the market's boxes; the cut's pipe; the market's back gate)
    for (const id of ['alleySacks', 'fence1', 'fence3', 'kSacks', 'pressRow', 'conveyor', 'dyBundles', 'dyReel', 'cutBarrels', 'cutSacks', 'party', 'archCart', 'stallBoxes', 'marketCrates']) { const T = things.get(id); if (T) add(on(T), 'vault', { id }); }
    for (const id of ['fence2', 'web', 'pipe', 'pipe2', 'tank', 'plank']) { const T = things.get(id); if (T) add(on(T), 'slide', { id }); }
    add(on(things.get('door' + this.lane)), 'door', { id: 'door' + this.lane, slam: true });
    if (things.get('archGate')) add(on(things.get('archGate')), 'door', { id: 'archGate', slam: true });
    // ([C6 2nd] the kitchen's iron door into the press hall: flung open, left open)
    add(on(things.get('kdoor')), 'door', { id: 'kdoor', slam: false });
    add(on(things.get('edge')), 'jump', { id: 'edge' });
    add(on(things.get('slope')), 'slope', { id: 'slope' });
    // his doings (the bins always; the rest when I am close)
    add(on(things.get('bins')) + 0.6, 'trick', { id: 'bins', always: true });
    // ([C6 3rd] the alley's crates always too: the alley is lost on misses like the rest)
    add(on(things.get('alleyCrates')) != null ? project(P, 4.4, -41.2, 0, 1e9).s : null, 'trick', { id: 'alleyCrates', always: true });
    add(project(P, 42.0, -50.0, 0, 1e9).s, 'trick', { id: 'laneBin' });
    add(project(P, this.lane === 'W' ? 54.25 : 65.75, -91.6, 0, 1e9).s, 'trick', { id: this.lane === 'W' ? 'rackW' : 'rackE' });
    add(project(P, 84.6, -87.6, 0, 1e9).s + 0.4, 'trick', { id: 'pressBundles' });
    // ([C6 3rd] the hand truck of bundles by the press hall's south door)
    add(project(P, 89.9, -71.4, 0, 1e9).s, 'trick', { id: 'dyTruck' });
    add(project(P, 98.3, -95.6, 0, 1e9).s + 0.5, 'trick', { id: 'avBundles' });
    // ([C6 3rd] the cut's gate swung shut behind him at its mouth; the crates by its knee; the arch's crates)
    // (the gate he pulls to behind him always: the cut is lost on misses like the rest)
    add(project(P, CUT.gate.x - 1.0, -118.9, 0, 1e9).s, 'trick', { id: 'cutGate', always: true });
    add(project(P, 81.0, -118.9, 0, 1e9).s, 'trick', { id: 'cutCrates' });
    add(project(P, 8.5, -128.9, 0, 1e9).s, 'trick', { id: 'archCrates' });
    // (the lid off the bin at the alley's T as he goes round the corner: it clatters off his way)
    add(this.sOf('alleyEnd') + 0.3, 'lid');
    if (this.over === 'row') add(project(P, 51.6, -117.5, 0, 1e9).s, 'trick', { id: 'rowCrates' });
    add(project(P, 9.0, -101.6, 0, 1e9).s, 'trick', { id: 'barrow' });
    // the looks back over his shoulder
    for (const [x, z] of [[2.5, -32], [30, -50], [54.25 + (this.lane === 'E' ? 11.5 : 0), -70], [84.0, -87.6], [89.6, -60.5], [98.3, -88.0], [98.3, -112.0], [77.9, -113.0], [47, -110.9], [21.6, -126.0], [9, -110]]) add(project(P, x, z, 0, 1e9).s, 'look');
    // the slip on the wet at the alley's corner
    add(this.sOf('alleyEnd') - 1.0, 'skid');
    out.sort((a, b) => a.s - b.s);
    return out;
  }
  sOf(name) { const i = this.P.names.indexOf(name); return i >= 0 ? this.P.s[i] : null; }

  // ---- him ------------------------------------------------------------------------------
  spawn(at, yaw, state = 'watcher_stand') {
    const cast = this.G.cast;
    const kind = cast.has('watcher') ? 'watcher' : 'couple_him';
    const old = cast.get('watcher');
    if (old) cast.remove(old);
    const c = cast.spawn(kind, { at, yaw, name: 'watcher' });
    this.w = c;
    c.noGlance = true;
    if (kind === 'watcher') c.setState(state, 0);
    this.fig = c.fig;
    // (his height: the walking surface, and an arc of his own on it - a
    // jump, a drop)
    const W = this.stage;
    c.fig.surface = (x, z) => W.surfaceY(x, z) + this.yOff;
    c.fig.afterPose = (h, dt) => this.afterPose(h, dt);
    return c;
  }

  // him at path distance s, running; what is before s is behind him
  place(s, v = 6) {
    this.s = s;
    const p = pathAt(this.P, s);
    const F = this.fig;
    F.pos.x = p.x; F.pos.z = p.z;
    F.yaw = pathHeading(this.P, s);
    F._prevPos.copy(F.pos); F._prevYaw = F.yaw;
    if (F._rmClip) F._rmClip = null;
    F.object.visible = true;
    this.act = 'run';
    this.yOff = 0;
    this.w.setState('watcher_run', 0.15);
    this.v = v;
    this.hisVel = v; this.prevHisD = null;
    this.ei = 0;
    while (this.ei < this.events.length && this.events[this.ei].s < s) this.ei++;
  }

  // ---- distances -------------------------------------------------------------------------
  feet(p) { return _t.set(p.x, this.stage.surfaceY(p.x, p.z), p.z); }
  measure() {
    const C = this.G.controller;
    const me = _t.set(C.pos.x, C.run ? C.run.feet : C.groundY, C.pos.z);
    this.myD = this.course.dist(me);
    const F = this.fig;
    this.hisD = this.act === 'gone' || this.act === 'carIn' ? -5 : this.course.dist(_t.set(F.pos.x, F.pos.y - this.yOff, F.pos.z));
    this.gapNow = this.myD - this.hisD;
    return this.gapNow;
  }
  // the course distance at which a stretch begins
  stretchD(name) {
    if (name === 'kitchen') return Math.min(this.course.D.get('wIn2'), this.course.D.get('eIn2'));
    const n = STRETCH_NODE[name];
    return n ? this.course.D.get(n) : 0;
  }

  // ---- per step ------------------------------------------------------------------------------
  step(dt) {
    if (!this.w || !this.fig) return;
    const F = this.fig;
    const gap = this.measure();
    // (his pace along the course, smoothed; a step onto a spur's edge clipped)
    if (this.prevHisD != null && dt > 0 && this.act !== 'gone' && this.act !== 'carIn') {
      const u = Math.max(0, Math.min(8.5, (this.prevHisD - this.hisD) / dt));
      this.hisVel += (u - this.hisVel) * (1 - Math.exp(-dt / 0.2));
    }
    this.prevHisD = this.hisD;
    // my progress into the next stretch (the scene's beat; not from the iron)
    if (this.active && !this.escape) {
      for (let i = STRETCH_ORDER.length - 1; i >= 0; i--) {
        const n = STRETCH_ORDER[i];
        if (this.myD <= this.stretchD(n) + 0.5) { if (STRETCH_ORDER.indexOf(this.stretch) < i) { this.stretch = n; if (this.onStretch) this.onStretch(n); } break; }
      }
    }
    // (held where the stretch has him while the player cannot yet act: under
    // the chapter card, the fail's black coming up)
    if (this.held && this.held()) { this.waiting = true; this.grace = Math.max(this.grace, RULES.grace); return; }
    this.waiting = false;
    if (this.act === 'run') this.runStep(dt, gap);
    else if (this.act === 'vault' || this.act === 'slide') {
      // (a clip that carries him: when it is done, on along his way from where it left him)
      const h = this.w.clipH;
      // ([C6 3rd] over a low thing - a stack, a row of sacks - a hand on it and
      // on, hardly checked: he knows his way; a tall fence checks anyone)
      this.v = this.act === 'vault' ? (this.lowVault ? 4.8 : 3.4) : 4.6;
      if (!h || h.done || h.t >= h.duration - 1e-3) {
        const was = this.act;
        this.act = 'run';
        this.s = project(this.P, F.pos.x, F.pos.z, this.s, 8).s;
        this.w.setState('watcher_run', 0.12);
        this.v = was === 'slide' ? 4.8 : this.lowVault ? 5.4 : 4.2;
      }
    } else if (this.act === 'arc') this.arcStep(dt);
    else if (this.act === 'carIn') {
      const h = this.w.clipH;
      if (!h || h.t >= h.duration - 1e-3) { this.act = 'gone'; this.inCar = true; F.object.visible = false; if (F.collider) F.collider.r = 0; if (this.onCarIn) this.onCarIn(); }
    }
    if (this.look) { this.look.t += dt; if (this.look.t > 1.0) this.look = null; }
    if (this.pull) { this.pull.t += dt; if (this.pull.t > 0.7) this.pull = null; }
    if (this.skid) {
      const K = this.skid;
      K.t += dt;
      const b = Math.sin(Math.PI * Math.min(1, K.t / 0.55));
      this.lean = K.side * (0.6 + 0.9 * b);
      const out = -K.side * 0.32 * b;
      F.pos.x += Math.cos(F.yaw) * out; F.pos.z -= Math.sin(F.yaw) * out;
      if (K.t > 0.55) this.skid = null;
    }
    // the washing he goes through
    const ch = this.stage.part('chase');
    if (ch && ch.sheets) ch.sheets.touch(F.pos.x, F.pos.z, Math.sin(F.yaw) * this.v, Math.cos(F.yaw) * this.v, 1);
    // the rules
    if (this.active) this.rules(dt, gap);
    // (the record: a line every half second)
    this.logT = (this.logT || 0) + dt;
    if (this.logT >= 0.5) { this.logT = 0; this.log.push([+(this.G.time || 0).toFixed(1), this.stretch, +gap.toFixed(1), +this.v.toFixed(1), this.act, +this.unseen.toFixed(1)]); if (this.log.length > 400) this.log.shift(); }
  }

  runStep(dt, gap) {
    const F = this.fig, P = this.P;
    // his pace: his own, by where he is
    let want = RULES.base;
    const here = pathAt(P, this.s);
    // (the stair: two treads at a time, his own way up - the roofs are the
    // short way and stay so: a runner by Tanner's Row comes out behind him)
    const y0 = this.stage.surfaceY(here.x, here.z), ahead = pathAt(P, this.s + 1.0);
    const rise = this.stage.surfaceY(ahead.x, ahead.z) - y0;
    if (rise > 0.3) want = 5.0;
    // (into a corner: slower the sharper it is)
    for (const c of this.cornersOf()) {
      const d = c.s - this.s;
      if (d < -0.6 || d > 3.2) continue;
      const k = Math.min(1, Math.abs(c.turn) / 1.6);
      want = Math.min(want, RULES.base - 2.3 * k);
    }
    // ([C6 3rd] no burst when I am close: his pace is his own whatever I do -
    // what he does about me on his heels is a thing pulled down in my way)
    // (down the iron: he does not yet know I am coming down after him - a
    // run, not his sprint, a look back up at the fire escape - until the
    // ladder comes down: the scene's paceCap)
    if (this.paceCap != null) { want = Math.min(want, this.paceCap); if (!this.look && Math.random() < dt * 0.5) this.look = { t: 0 }; }
    // (a look back costs him a stride)
    if (this.look && this.look.t < 0.5) want -= 0.9;
    if (this.pull && this.pull.t < 0.45) want -= 1.6;
    // (a stretch's first moments after the black: he is where it has him, on his way)
    this.v += (want - this.v) * (1 - Math.exp(-dt * 3));
    this.s += this.v * dt;
    const p = pathAt(P, this.s);
    F.pos.x = p.x; F.pos.z = p.z;
    const h = pathHeading(P, this.s, 1.2 + this.v * 0.25);
    const dh = wrap(h - F.yaw);
    F.yaw += Math.sign(dh) * Math.min(Math.abs(dh), dt * 7);
    this.lean += ((Math.max(-1, Math.min(1, dh * 2)) * Math.min(1, this.v / 6)) - this.lean) * (1 - Math.exp(-dt * 6));
    F.anim.setTimeScale(Math.max(0.3, this.v / (WRUN.speed * F.scale)));
    // what comes on his way
    while (this.ei < this.events.length && this.s >= this.events[this.ei].s - this.lead(this.events[this.ei])) {
      const e = this.events[this.ei++];
      this.doEvent(e, gap);
      if (this.act !== 'run') break;
    }
    if (this.s >= P.len - 0.3) this.startCarIn();
  }
  // how far before a thing he starts on it
  lead(e) { return e.kind === 'vault' ? 0.95 * this.fig.scale : e.kind === 'slide' ? 1.3 : e.kind === 'jump' ? 0.6 : e.kind === 'door' ? 0.9 : 0; }
  cornersOf() { return this._corners || (this._corners = corners(this.P).filter((c) => Math.abs(c.turn) > 0.5)); }

  doEvent(e, gap) {
    const F = this.fig, G = this.G;
    const things = this.stage.part('things');
    if (e.kind === 'vault') {
      this.act = 'vault';
      // square to it, short of it: the clip's root motion carries him over
      F.yaw = pathHeading(this.P, e.s, 0.8);
      const p = pathAt(this.P, e.s - 0.95 * F.scale);
      F.pos.x = p.x; F.pos.z = p.z;
      F._prevPos.copy(F.pos); F._prevYaw = F.yaw;
      // (a fence: the hand on its top rail, over; a waist-high wall or stack:
      // the hand on its top, swung over it)
      const T = things.get(e.id);
      const low = T && T.top < 1.2;
      this.lowVault = !!low;
      this.w.play(low ? 'watcher_lowvault' : 'watcher_vault', { fade: 0.08 });
      // (a man who knows his fences: quicker over them than the clip's own pace)
      F.anim.setTimeScale(low ? 1.45 : 1.25);
      G.sfx.play('w_fenceHand', F.pos.clone().setY(F.pos.y + 1.6));
    } else if (e.kind === 'slide') {
      this.act = 'slide';
      F.yaw = pathHeading(this.P, e.s, 0.8);
      const p = pathAt(this.P, e.s - 1.3);
      F.pos.x = p.x; F.pos.z = p.z;
      F._prevPos.copy(F.pos); F._prevYaw = F.yaw;
      this.w.play('watcher_slide', { fade: 0.06 });
      F.anim.setTimeScale(1.15);
      G.sfx.play('w_slideHim', F.pos.clone().setY(F.pos.y + 0.3));
    } else if (e.kind === 'door') {
      // through his door (it bangs open), and shut behind him a moment after
      const T = things.get(e.id);
      if (T) { T.set('open'); T.state.v = 10; }
      // ([C6 3rd] through a door he knows at 4.4 m/s, was 3.4)
      this.v = Math.min(this.v, 4.4);
      G.sfx.play(e.id === 'kdoor' ? 'w_ironDoor' : 'w_doorBang', F.pos.clone().setY(1.2));
      if (e.slam) { this.slamAt = this.s + 1.6; this.slamId = e.id; }
    } else if (e.kind === 'jump') {
      // the leap over the light well, down onto R2
      const L = things.get('edge').land;
      this.arc = { kind: 'jump', t: 0, s0: this.s, s1: project(this.P, L.x - 1.0, F.pos.z, this.s, 10).s, y0: ROOFS.R1.y, dur: 0.62 };
      this.act = 'arc';
      G.sfx.play('w_leapHim', F.pos.clone().setY(F.pos.y + 1));
    } else if (e.kind === 'slope') {
      // down the shed's roof on his seat, off its eave to the pavement
      this.arc = { kind: 'slope', t: 0 };
      this.act = 'arc';
      this.w.play('watcher_slide', { fade: 0.08, hold: true });
      G.sfx.play('w_slideHim', F.pos.clone());
    } else if (e.kind === 'trick') {
      (this.evLog || (this.evLog = [])).push([e.id, +gap.toFixed(1), this.active]);
      // (only with me close behind him: not when I am ahead of him by the other way)
      if (!e.always && !(this.active && gap < RULES.trick && gap > -1.5)) return;
      this.trick(e.id);
    } else if (e.kind === 'lid') {
      // ([C6 3rd] the alley's T: which way he went - the lid clatters off his way)
      const lid = things.lid;
      // (into the lane and along it his way: off the bin's rim, down onto the flags of the T, rolling east)
      if (lid) lid.trigger(0.9, -1.0);
    } else if (e.kind === 'look') {
      // (no one on the roofs behind him when I took the row: he runs on)
      if (!this.otherWay()) this.look = { t: 0 };
    } else if (e.kind === 'skid') {
      const c = this.cornersOf().find((k) => k.s > e.s && k.s - e.s < 3);
      this.skid = { t: 0, side: c ? Math.sign(c.turn) : 1 };
      const p = F.pos.clone();
      G.sfx.play('w_skid', p.clone().setY(0.2));
      const fx = G.fx;
      if (fx && fx.splash) for (let i = 0; i < 14; i++) {
        const a = F.yaw + (Math.random() - 0.5) * 1.6;
        fx.splash.spawn({ pos: p.clone().setY(0.04), vel: new THREE.Vector3(Math.sin(a) * 2.2, 1.2 + Math.random() * 1.4, Math.cos(a) * 2.2), life: 0.5, size: [0.02, 0.035], stretch: 0.04, col: [0.55, 0.55, 0.55], alpha: 0.9, gravity: 9.8, ground: 0.0, fadeOut: 0.2 });
      }
    }
  }

  // his doing: something pulled down behind him (an arm flung out to it)
  trick(id) {
    const things = this.stage.part('things');
    const T = things.get(id);
    if (!T || T.state.go) return;
    const F = this.fig;
    // (the arm toward it: its side of him)
    const p = T.frame ? T.frame() : null;
    let side = 'R';
    if (p) { const rx = Math.cos(F.yaw), rz = -Math.sin(F.yaw); side = (p.cx - F.pos.x) * rx + (p.cz - F.pos.z) * rz > 0 ? 'L' : 'R'; }
    this.pull = { t: 0, side };
    const G = this.G;
    if (id === 'laneBin') things.trigger(id, { toward: G.controller.pos.z });
    else things.trigger(id);
    this.tricks.push(id);
    G.sfx.play(id === 'bins' || id === 'laneBin' ? 'w_bins' : id === 'barrow' ? 'w_barrow' : id.startsWith('rack') ? 'w_pans' : id.endsWith('Bundles') ? 'w_bundles' : id === 'cutGate' ? 'w_ironDoor' : 'w_crates', F.pos.clone().setY(0.6));
  }

  arcStep(dt) {
    const A = this.arc, F = this.fig, G = this.G;
    A.t += dt;
    if (A.kind === 'jump') {
      const u = Math.min(1, A.t / A.dur);
      this.s = A.s0 + (A.s1 - A.s0) * u;
      const p = pathAt(this.P, this.s);
      F.pos.x = p.x; F.pos.z = p.z;
      // (the ground under him is R1, the well, R2: his height his own)
      const ground = this.stage.surfaceY(p.x, p.z);
      const yR2 = ROOFS.R2.yE;
      const y = A.y0 + (yR2 - A.y0) * u + 4 * 0.7 * u * (1 - u);
      this.yOff = y - ground;
      this.v = (A.s1 - A.s0) / A.dur;
      this.lean = -0.5;
      if (u >= 1) { this.act = 'run'; this.yOff = 0; this.v = 4.8; G.sfx.play('w_landHim', F.pos.clone()); }
    } else if (A.kind === 'slope') {
      // down the slope at 5.5 m/s (the surface carries his height), then the drop
      this.v = 5.5;
      this.s += this.v * dt;
      const p = pathAt(this.P, this.s);
      F.pos.x = p.x; F.pos.z = p.z;
      const ground = this.stage.surfaceY(p.x, p.z);
      if (A.drop == null && ground < ROOFS.shed.yEave - 0.5) A.drop = { t: 0, y0: ROOFS.shed.yEave };
      if (A.drop) {
        A.drop.t += dt;
        const k = Math.min(1, A.drop.t / 0.42);
        const y = A.drop.y0 + (ground - A.drop.y0) * k * k;
        this.yOff = y - ground;
        if (k >= 1) { this.act = 'run'; this.yOff = 0; this.v = 3.6; this.w.setState('watcher_run', 0.15); G.sfx.play('w_landHim', F.pos.clone()); }
      }
    }
  }

  startCarIn() {
    if (this.act === 'carIn' || this.act === 'gone') return;
    const F = this.fig;
    this.act = 'carIn';
    F.yaw = Math.PI;
    this.w.play('watcher_carIn', { fade: 0.12, hold: true });
    this.G.sfx.play('w_handle', F.pos.clone().setY(1));
  }

  // ---- the rules ------------------------------------------------------------------------------
  rules(dt, gap) {
    const G = this.G, hud = G.hud;
    if (this.slamAt != null && this.s >= this.slamAt) {
      const T = this.stage.part('things').get(this.slamId);
      if (T) T.set('slammed');
      G.sfx.play('w_slam', this.fig.pos.clone().setY(1.2));
      this.slamAt = null;
    }
    if (this.act === 'gone' || this.act === 'carIn' || G.failing) return;
    if (this.grace > 0) { this.grace -= dt; this.unseen = 0; return; }
    // seen: a clear line to his head or his chest (every 0.2 s)
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.2;
      const eye = G.eye;
      this.seen = false;
      for (const bone of ['head', 'chest']) {
        const tgt = this.fig.bones[bone].getWorldPosition(_t);
        const dir = tgt.sub(eye);
        const d = dir.length();
        dir.divideScalar(d);
        if (!G.rays.raycast(eye, dir, d - 0.5, { anyHit: true })) { this.seen = true; break; }
      }
    }
    // (close behind him round a corner is not losing him; nor his being on
    // the other way over at the fork - the gap still counts there)
    const forked = this.otherWay();
    this.unseen = this.seen || gap < RULES.unseenFrom || forked || this.escape ? 0 : this.unseen + dt;
    const warnNow = this.warned ? gap > RULES.warnOff || this.unseen > RULES.unseenWarn * 0.6 : gap > RULES.warnOn || this.unseen > RULES.unseenWarn;
    if (warnNow && !this.warned) { this.warned = true; this.warnAt = G.time; }
    if (!warnNow && this.warned) { this.warned = false; this.warnAt = null; }
    hud.warn(this.warned ? 'He’s getting away.' : null);
    const lost = gap > RULES.lost || (this.unseen > RULES.unseenLost && !this.escape);
    // ([C6 3rd] the warning up a second and a half first, was one: time to turn back)
    if (lost && this.warned && G.time - this.warnAt >= 1.5) this.lose(gap);
  }
  // he and I on different ways at the fork (roofs / row)
  otherWay() {
    const C = this.G.controller;
    // ([C6 3rd] the market's fork: he takes the middle aisle; me in the west
    // aisle along the fence is the other way - not held to his pace through
    // the stalls between us, not unseen behind them)
    if (this.stretch === 'market') return C.pos.x < 4.6 && C.pos.z > -116.5 && C.pos.z < -98.5;
    if (this.stretch !== 'over') return false;
    // ([C6 2nd] the alley behind the press hall comes in from the east before
    // the fork: the row's way begins in the passage north of it)
    const mine = (C.run ? C.run.feet : C.groundY) > 1.2 || (C.pos.z > ROOFS.z0 - 0.2 && C.pos.z < -104.0 && C.pos.x > 56 && C.pos.x < 70.5) ? 'roofs' : C.pos.z < ROOFS.z0 + 0.3 || (C.pos.x > 70 && C.pos.x < 73.4 && C.pos.z < -104.6) ? 'row' : null;
    return mine != null && mine !== this.over;
  }

  lose(gap) {
    if (this.lostAt) return;
    this.lostAt = this.G.time;
    this.lostN++;
    const G = this.G, C = G.controller;
    const R = C.run;
    const rec = { stretch: this.stretch, gap: +gap.toFixed(1), unseen: +this.unseen.toFixed(1), me: [+C.pos.x.toFixed(1), +C.pos.z.toFixed(1), R ? +R.feet.toFixed(1) : null], him: [+this.fig.pos.x.toFixed(1), +this.fig.pos.z.toFixed(1)], act: this.act, mode: C.mode, move: R && R.move ? R.move.kind : null, blocked: R && R.blocked ? R.blocked.T.id : null, v: R ? +R.v.toFixed(1) : null, lane: this.lane, over: this.over, myD: +this.myD.toFixed(1), hisD: +this.hisD.toFixed(1), met: (this.met || []).slice(-6), tail: this.log.slice(-8) };
    (this.lostLog || (this.lostLog = [])).push(rec);
    (G._c6lost || (G._c6lost = [])).push(rec);
    G.fail({ why: 'Lost him.', to: this.escape ? 'escape' : this.stretch || 'alley' });
  }

  // ---- his figure, laid on the clip each step ----------------------------------------------------
  afterPose(h, dt) {
    const v = this.act === 'run' || this.act === 'vault' || this.act === 'arc' || this.act === 'flee' ? this.v : 0;
    if (this.act !== 'run') this.lean *= Math.exp(-dt * 8);
    const pull = this.pull ? { t: this.pull.t, side: this.pull.side } : null;
    // (in the yard his shadow is thrown on the washing by the lamps over the
    // doors: cast however far he is from the eye)
    if (h.pos.x > YARD.x0 - 1 && h.pos.z > KITCHEN.z1 - 1 && h.pos.z < YARD.z1) h.mesh.castShadow = true;
    layOn(h, { v, t: this.G.time || 0, lean: this.lean, look: this.look ? this.look.t : null, pull });
  }
}

// where a stretch's retry puts him: `ahead` metres along his way past the
// point of his way nearest my start
// ([C6 3rd] the kit's mercy (seams/Z.md: game.fails(beat)): failed twice in
// a stretch, its retry has him 2 m nearer, three times 4 m - never nearer than
// 6 m, and he still runs his own race: an idle player loses as before)
export function hisStart(C, name, myAt, fails = 0) {
  const S = STRETCHES[name];
  const at = myAt || S.at;
  const s0 = project(C.P, at[0], at[1], 0, 1e9).s;
  const mercy = Math.min(4, 2 * Math.max(0, fails - 1));
  return s0 + Math.max(6, S.ahead - mercy);
}
export { V, LANES, NODES, sm };
