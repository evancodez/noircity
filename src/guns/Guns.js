import * as THREE from 'three';
import { ATLAS } from '../fx/fxTextures.js';
import { FIRE } from '../fx/fxTextures.js';
import { Covers, doorsOf } from './Covers.js';
import { GUNMAN } from '../enemies/brains/gunman.js';

// The gun kit (lane C2): one way of fighting with a gun, used by IV The
// Door, VII Pier Nine's loud pass and VIII The Block. game.guns (gunsOf(game)).
//
//   const K = gunsOf(game);
//   K.begin({ maxFiring: 2, flankAfter: 7, why: {...}, area })   an encounter: their
//        fire tokens, the flank, the reasons a fall is given (area: { x0, x1, z0, z1 },
//        the place the fight is in - the men take no cover outside it); K.end()
//   K.trace(origin, dir, opts)      a round as a ray: what is solid stops it,
//        what is thin or glass lets it through (losing aim and force), wood
//        is chewed until its section breaks away (the cover kinds below)
//   K.playerRound(origin, dir, weapon)   the player's revolver / Tommy gun
//   K.hoodRound(ai, aimAt, sigma, dmg)    a gunman's round, from his muzzle
//   K.playerBody()                  the player's body as the rounds see it
//   K.see(from, to)                 a clear line for the eyes (clear glass is seen through)
//   K.arm('revolver' | 'tommy')     the gun in hand and full (a beat's start, every retry)
//   K.teach('crouch' | 'rise' | 'reload', opts)   the kit's three cards (hud.teach,
//        lane C1's: once per save; { again: true } once more after two fails)
//   K.warning()                     the line before a fall, for this moment (or null):
//        a scene sets it each step - ctx.hud.warn(K.warning())
//
// THE COVER KINDS (a stage sets them as data on its meshes:
// mesh.userData.cover = { kind, hp }; the kit keeps their state there):
//   'stone'  walls, floors, the street, a counter's top: stops every round
//   'steel'  a car's body, a filing cabinet, a hydrant: stops it, sparks
//   'wood'   a desk, a crate, a counter's panel, a barrel: takes `hp` rounds
//            (a hole and splinters each), then the section breaks away (a
//            burst of splinters, a gap) and lets them through. A stage that
//            wants a gap splits a piece into sections (each its own mesh with
//            its own hp); one piece of wood spent whole is riddled: it lets
//            rounds through, weaker
//   'thin'   a door, a partition's dado, a table: every round goes through,
//            with a hole on each face, slower and off its line
//   'glass'  (panes of destruct/Glass.js, a car's windows): breaks, goes
//            through, a little off its line
// Nothing else in the kit fudges cover: a man shooting at where I crouch
// hits the desk.
export const COVER = {
  // what a round keeps going through it (its force) and how far it is
  // thrown off its line (rad)
  thin: { k: 0.62, dev: 0.035 },
  glass: { k: 0.85, dev: 0.012 },
  wood: { k: 0.7, dev: 0.025 },          // (through a section already broken: the riddled piece)
  // what a round of each takes off a wood section's hp
  chew: { revolver: 1.5, tommy: 1, pistol: 1, hoodTommy: 1 },
};

// the kit's three teach cards (WAVE_C §2's keys and words; ids shared with
// the rest of the game: 'crouch' is lane C1's IV stand-in too)
export const TEACH = { crouch: '[C] get low', rise: '[RMB] rise and aim', reload: '[R] reload' };

// the player's body as the rounds and the eyes see it (m, from the eye)
export const BODY = { head: 0.12, r: 0.24, crouchR: 0.3, chest: 0.36, belly: 0.72 };

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _o = V(0, 0, 0), _d = V(0, 0, 0), _a = V(0, 0, 0), _b = V(0, 0, 0), _p = V(0, 0, 0);
const HEAD = new Set(['head', 'hat']);
const TORSO = new Set(['chest', 'spine', 'hips', 'neck']);

const REC = typeof location !== 'undefined' && /[?&]c2rec=1/.test(location.search);

export function gunsOf(game) { return game.guns || (game.guns = new Guns(game)); }

export class Guns {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.cfg = { maxFiring: 2, flankAfter: 7, flankCool: 6 };
    this.tokens = new Map();
    this.rng = null;
    this.lineOnMe = 0;           // how many men have a clear line on me now
    this.post = { x: 0, z: 0, t: 0 };   // where I have been holding (the flank's clock)
    this.flank = null;           // { ai, at, t }
    this.flankCoolT = 0;
    this.lastKill = null;        // what put me down (the fall's reason)
    this.events = [];            // (the plays read the record)
    this.rec = REC;              // (?c2rec=1: the record says more - misses, a gun arm blocked)
    this.stepFn = (t, dt) => this.update(dt, t);
  }

  get R() { return this.rng || (this.rng = this.game.stage.rng.fork(9292)); }

  // ---- an encounter ------------------------------------------------------------------------
  begin(cfg = {}) {
    const G = this.game;
    // (an encounter's numbers are its own: nothing of the last one's - its `area`, its words - carries over)
    this.cfg = Object.assign({ maxFiring: 2, flankAfter: 7, flankCool: 6 }, cfg);
    this.active = true;
    this.tokens.clear();
    this.flank = null; this.flankCoolT = 0; this.lastKill = null; this.chewT = -9; this._w = null; this.doorIn = null;
    this.post = { x: G.eye.x, z: G.eye.z, t: 0 };
    // (the record runs on across encounters, a marker at each: the plays read it)
    if (this.events.length > 600) this.events.splice(0, this.events.length - 400);
    this.events.push({ t: +G.time.toFixed(2), what: 'begin', name: cfg.to || '' });
    this.rng = G.stage.rng.fork(9292);
    if (!G.scripts.includes(this.stepFn)) G.scripts.push(this.stepFn);
    // the health's mending reads whether anyone has a line on me
    G.health.exposed = () => (this.lineOnMe > 0 ? 1 : 0);
    // going down is the chapter's fail (lane C1's game.fail): the fall,
    // black, the reason in a few words (K.why()), back at cfg.to (the beat)
    if (!this._death0) {
      this._death0 = G.health.onDeath;
      G.health.onDeath = () => this.down();
    }
    // the room as the men read it: their nav grid (doorways open) and cover
    this.covers = this.covers && this.covers.game === G ? this.covers : new Covers(G);
    this.covers.rebuild();
    this.onRebuild = () => this.covers.rebuild();
    // the dead: a slide onto what they slump against, then a body solid to
    // walk round (never in the living men's way: their own resolve skips it)
    if (!this._downFn) { this._downFn = (e) => this.onDown(e); G.on('hood:down', this._downFn); }
    this.slides = [];
    this.corpseQ = [];
    this.clearCorpses();
    return this;
  }

  // a checkpoint's gun (a beat's start, every retry): in hand and full - as
  // it was at the checkpoint, never as it was at the fall. [C2] after the
  // critic's second look: a retry gave the revolver back with what was left
  // in it (two rounds as the men came in); a chapter calls this in its
  // beat's setup (docs/story/seams/GUNS.md)
  arm(name) {
    const G = this.game, Ws = G.player.weapons;
    // (in the middle of a reload at the fall: put away and drawn again, the reload abandoned)
    if (Ws.current === name && Ws.active && Ws.active.reloading) Ws.equip(null);
    Ws.equip(name);
    const W = Ws.active;
    if (name === 'tommy') G.weapon.reset();
    else if (W && Array.isArray(W.chambers)) { W.chambers = W.chambers.map(() => 'live'); W.top = 0; W.reloadAfter = 0; W.buffered = -1; }
    return W;
  }

  // ---- the men -----------------------------------------------------------------------------------
  // a gunman: { kind: 'pistol' | 'tommy' | 'rusher', at: {x, z}, way: { door?, path: [{x, z}], run? },
  //             start?: fn(game, hood) -> bool, wait?: s, frame?: s (in the doorway), yaw?, hp?, variant? }
  spawn({ kind = 'pistol', at = null, way = null, start = null, wait = 0, frame, door = null, cover = false, yaw = null, hp = null, variant = null, name = null } = {}) {
    const G = this.game, K = GUNMAN[kind];
    const p = at || (way && way.at);
    const n = (this.spawned = (this.spawned || 0) + 1);
    const v = variant || (kind === 'pistol' ? { coat: n % 3, brim: n % 2, tall: (n >> 1) % 2, cig: n % 4 === 1 }
      : kind === 'tommy' ? { coat: 1, brim: 1, tall: 1, heavy: true } : { coat: 0, brim: 1, tall: 1, heavy: true });
    const h = G.spawnHood(p.x, p.z, { brain: 'gunman', kind, heavy: kind !== 'pistol', hp: hp ?? K.hp, variant: v, yaw, state: 'idle', way, start, wait, frame, door, cover });
    h.surface = (x, z) => G.stage.surfaceY(x, z);
    h.gunKind = kind;
    if (name) h.c2name = name;
    // the heavy reads at a glance: a head taller and broader in the coat
    if (kind === 'rusher') { h.scale *= 1.1; h.object.scale.setScalar(h.scale); h.collider.r = 0.32 * h.scale; }
    const ai = G.ais.get(h);
    h.onMove = (hh) => this.resolveMan(hh);
    if (ai) ai.kit = this;
    return h;
  }
  // a living man is kept out of everything solid, other men and me - but
  // not the dead (a body never blocks a doorway for the living)
  resolveMan(h) {
    const G = this.game, C = G.stage.colliders, cs = this.corpses || [];
    for (const c of cs) { c._r = c.r; c.r = 0; }
    C.resolve(h.pos, 0.32 * h.scale, h.collider);
    for (const c of cs) c.r = c._r;
    const p = G.eye, dx = h.pos.x - p.x, dz = h.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.7 && d > 1e-4) { h.pos.x = p.x + dx / d * 0.7; h.pos.z = p.z + dz / d * 0.7; }
  }
  // a door of the stage by its name (a part's `doors`)
  door(name) {
    const S = this.game.stage;
    if (S._c2doors && S._c2doors[name]) return S._c2doors[name];
    for (const p of S.parts.values()) if (p && p.doors && p.doors[name]) return p.doors[name];
    return null;
  }

  onDown({ hood: h, pick }) {
    if (!this.active || !pick) return;
    if (pick.slide) this.slides.push({ h, from: h.pos.clone(), to: V(pick.slide.x, h.pos.y, pick.slide.z), t: 0, dur: 0.3 });
    this.corpseQ.push({ h, t: 1.35 });
  }
  clearCorpses() {
    const C = this.game.stage.colliders;
    for (const c of this.corpses || []) { const i = C.circles.indexOf(c); if (i >= 0) C.circles.splice(i, 1); }
    this.corpses = [];
  }
  stepBodies(dt) {
    const G = this.game, C = G.stage.colliders;
    for (let i = this.slides.length - 1; i >= 0; i--) {
      const s = this.slides[i];
      s.t += dt;
      const u = Math.min(1, s.t / s.dur), e = 1 - (1 - u) * (1 - u);
      s.h.pos.x = s.from.x + (s.to.x - s.from.x) * e; s.h.pos.z = s.from.z + (s.to.z - s.from.z) * e;
      if (u >= 1) this.slides.splice(i, 1);
    }
    for (let i = this.corpseQ.length - 1; i >= 0; i--) {
      const q = this.corpseQ[i];
      q.t -= dt;
      if (q.t > 0) continue;
      this.corpseQ.splice(i, 1);
      if (!q.h.object.parent) continue;
      // the body where it lies: the hips and the chest's middle, on the floor
      const a = V(0, 0, 0).setFromMatrixPosition(q.h.bones.hips.matrixWorld), b = V(0, 0, 0).setFromMatrixPosition(q.h.bones.chest.matrixWorld);
      const c = C.addCircle((a.x + b.x) / 2, (a.z + b.z) / 2, 0.27, 'corpse');
      c.hood = q.h;
      this.corpses.push(c);
    }
    // (a body taken away - the corpse cap - takes its circle with it)
    for (let i = this.corpses.length - 1; i >= 0; i--) if (!this.corpses[i].hood.object.parent) { const c = this.corpses[i]; const j = C.circles.indexOf(c); if (j >= 0) C.circles.splice(j, 1); this.corpses.splice(i, 1); }
  }
  end() {
    const G = this.game;
    this.active = false;
    this.tokens.clear();
    this.flank = null;
    const i = G.scripts.indexOf(this.stepFn);
    if (i >= 0) G.scripts.splice(i, 1);
    G.health.exposed = null;
    if (this._death0) { G.health.onDeath = this._death0; this._death0 = null; }
    if (this._downFn) { G.off('hood:down', this._downFn); this._downFn = null; }
    this.clearCorpses();
  }
  down() {
    const G = this.game;
    G.counters.deaths++;
    G.emit('player:down', {});
    const why = this.why();
    this.events.push({ t: G.time, what: 'down', why });
    for (const ai of G.ais.values()) if (ai.brain && ai.brain.playerDown) ai.brain.playerDown();
    G.fail({ why, to: this.cfg.to || (G.scenes && G.scenes.beat), fall: true });
  }
  // (the stage changed under the men: the desk went over) their nav grid and cover
  rebuild() { if (this.onRebuild) this.onRebuild(); }
  // [C2] after the critic's second look (the door was won standing on the
  // room's floor: each man in turn stepped into the doorway the player held):
  // a man down in a doorway, by a man he saw whole in the room - the doorway
  // is held. One of the others whose way is that door (not already going
  // round) goes round to another way into my room - a door I could see from
  // where I stand, unlocked - with the flank's warning ('One's going round')
  // and the door's when he opens it behind me. A man fighting from cover is
  // never seen whole: this is the price of standing in the open
  doorHeld(D, deadAi) {
    const G = this.game;
    if (this.flank && !this.flank.done && this.flank.ai.h.alive) return;
    const e = G.eye;
    let D2 = null, best = Infinity;
    for (const d of doorsOf(G.stage)) {
      if (d === D || d.locked || !d.centre || !d.spec) continue;
      const c = _p.set(d.centre.x, d.centre.y + 1.2, d.centre.z);
      if (!this.see(e, c, 0.3)) continue;
      const L = Math.hypot(c.x - e.x, c.z - e.z);
      if (L < best) { best = L; D2 = d; }
    }
    if (!D2) return;
    let pick = null, pd = Infinity;
    for (const [h, ai] of G.ais) {
      if (!h.alive || ai === deadAi || !ai.brain || !ai.brain.usesDoor || !ai.brain.goRound || ai.brain.kind !== 'pistol') continue;
      if (!ai.brain.usesDoor(D) || ai.brain.S.goneRound) continue;
      const d = Math.hypot(h.pos.x - D.centre.x, h.pos.z - D.centre.z);
      if (d < pd) { pd = d; pick = ai; }
    }
    if (!pick) return;
    // (his way round: by the grid with the held doorway shut to it - never
    // through the room I hold - walked as waypoints, then the door)
    const way = this.wayAround(pick.h, D, D2);
    if (!way) return;
    pick.brain.goRound(D2, way);
    this.flank = { ai: pick, at: { x: D2.centre.x, z: D2.centre.z }, t0: G.time, done: false, round: true };
    this.events.push({ t: +G.time.toFixed(2), what: 'round', name: D.name + '>' + D2.name });
  }
  // the outside of door D2 (the side away from me), and the way there from h
  // with door D's opening shut to the grid: waypoints ~2.5 m apart, or null
  wayAround(h, D, D2) {
    const G = this.game, nav = G.nav, e = G.eye;
    const sp = D2.spec, a = sp.inside, b = sp.outside;
    const out = Math.hypot(a.x - e.x, a.z - e.z) > Math.hypot(b.x - e.x, b.z - e.z) ? a : b;
    const s0 = D.spec.axis === 'z' ? [D.spec.z0, D.spec.z1] : [D.spec.x0, D.spec.x1];
    const shut = [];
    for (let u = s0[0] - 0.2; u <= s0[1] + 0.2; u += nav.cell * 0.5) for (let w = -0.45; w <= 0.45; w += nav.cell * 0.5) {
      const x = D.spec.axis === 'z' ? D.spec.x + w : u, z = D.spec.axis === 'z' ? u : D.spec.z + w;
      const k = nav.idx(x, z);
      if (k >= 0 && !nav.blocked[k]) { nav.blocked[k] = 1; shut.push(k); }
    }
    let path = null;
    try { path = nav.findPath(h.pos.x, h.pos.z, out.x, out.z, 20000); } finally { for (const k of shut) nav.blocked[k] = 0; }
    if (!path || !path.length) return null;
    const way = [];
    let px = h.pos.x, pz = h.pos.z, acc = 0;
    for (const q of path) { acc += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; if (acc > 2.5) { way.push({ x: q.x, z: q.z, run: true }); acc = 0; } }
    return way;
  }
  // a man opening the last door on his way in (the warning names it when it is behind me)
  doorOpened(D, ai) {
    this.doorIn = { D, ai, t: this.game.time };
    this.events.push({ t: +this.game.time.toFixed(2), what: 'door', name: D.name || '' });
  }

  // the fire tokens: at most cfg.maxFiring men shoot at once; force always.
  // The limit is room for the player who fights from cover: a man he sees
  // whole (in the open - standing, or down with nothing in front) is every
  // man's to shoot - stand and trade in the open and they all come out at
  // once. ([C2] after the critic's second look: by what he sees, not my stance)
  token(ai, force = false) {
    const T = this.tokens;
    if (T.has(ai)) return true;
    for (const [a] of T) if (!a.h.alive) T.delete(a);
    if (!force && ai && ai.brain && ai.brain.S && ai.brain.S.line && ai.brain.S.whole) force = true;
    if (T.size >= this.cfg.maxFiring && !force) return false;
    T.set(ai, this.game.time);
    return true;
  }
  drop(ai) { this.tokens.delete(ai); }
  firing() { return this.tokens.size; }

  // ---- the player's body ----------------------------------------------------------------------
  // { eye, foot, r, head, chest, belly, crouched }
  playerBody(out = this._body || (this._body = { eye: V(0, 0, 0), foot: V(0, 0, 0), head: V(0, 0, 0), chest: V(0, 0, 0), belly: V(0, 0, 0) })) {
    const G = this.game, C = G.controller, e = G.eye;
    const floor = G.stage.surfaceY(e.x, e.z);
    const ck = C.crouchK || 0;
    out.eye.copy(e);
    out.foot.set(e.x, floor + 0.12, e.z);
    out.r = BODY.r + (BODY.crouchR - BODY.r) * ck;
    out.crouched = ck > 0.6;
    out.head.set(e.x, e.y - 0.02, e.z);
    out.chest.set(e.x, Math.max(floor + 0.35, e.y - BODY.chest * (1 - 0.45 * ck)), e.z);
    out.belly.set(e.x, Math.max(floor + 0.25, e.y - BODY.belly * (1 - 0.55 * ck)), e.z);
    out.top = e.y + BODY.head;
    return out;
  }
  // a ray against the player's body: a capsule from the feet to the top of
  // the head; returns t or Infinity
  rayPlayer(o, d, far) {
    const B = this.playerBody();
    _a.copy(B.foot); _b.set(B.eye.x, B.top - B.r * 0.6, B.eye.z);
    return rayCapsule(o, d, _a, _b, B.r, far);
  }

  // ---- what a surface is to a round ---------------------------------------------------------------
  coverOf(mesh) {
    for (let o = mesh; o; o = o.parent) if (o.userData && o.userData.cover) return { data: o.userData.cover, mesh: o };
    const ud = mesh.userData;
    if (ud.pane) return { data: { kind: 'glass' }, mesh };
    if (ud.car) return { data: { kind: ud.part === 'glass' || ud.part === 'lens' ? 'glass' : 'steel' }, mesh };
    if (ud.surf === 'glass') return { data: { kind: 'glass' }, mesh };
    if (ud.breakable) return { data: { kind: 'stone' }, mesh };
    return { data: { kind: 'stone' }, mesh };
  }

  // a clear line for the eyes from a to b (clear glass is seen through;
  // frosted glass, wood and walls are not)
  see(a, b, pad = 0.3) {
    const G = this.game;
    _d.subVectors(b, a);
    const L = _d.length();
    if (L < 1e-3) return true;
    _d.divideScalar(L);
    const hit = G.rays.raycast(a, _d, Math.max(0.01, L - pad), { anyHit: true, skip: SEE_SKIP });
    return !hit;
  }

  // ---- a round ------------------------------------------------------------------------------------------
  // through what it may pass; returns { hood, player, wall, k (its force left), dir, passed: [] }
  //   opts: { far, by: 'player' | 'hood', chew (wood hp a hit takes), player: true (the
  //   gunmen's: my body is a target), skipHood, weak (their stray rounds' world reactions) }
  trace(origin, dir, { far = 120, by = 'player', chew = 1, player = false, skipHood = null } = {}) {
    const G = this.game, r = this.R;
    const o = origin.clone(), d = dir.clone();
    let left = far, k = 1;
    const out = { hood: null, player: null, wall: null, k: 1, dir: d, passed: [] };
    for (let n = 0; n < 5; n++) {
      const hood = G.rays.raycastHoods(o, d, left, G.stage.hoods.list, { skipHood });
      const wall = G.rays.raycast(o, d, hood ? hood.t : left);
      const tp = player ? this.rayPlayer(o, d, Math.min(left, wall ? wall.t : left, hood ? hood.t : left)) : Infinity;
      if (tp < Infinity) { out.player = { point: o.clone().addScaledVector(d, tp) }; out.k = k; out.dir = d; return out; }
      if (hood && (!wall || hood.t < wall.t)) { out.hood = hood; out.k = k; out.dir = d; return out; }
      if (!wall) { out.k = k; out.dir = d; out.end = o.clone().addScaledVector(d, left); return out; }
      const C = this.coverOf(wall.mesh);
      const pass = this.strike(wall, d, C, { by, chew, k });
      if (!pass) { out.wall = wall; out.k = k; out.dir = d; return out; }
      out.passed.push({ kind: C.data.kind, point: wall.point.clone() });
      k *= pass.k;
      // (off its line: a turn about a random axis across it)
      const ax = _a.set(r.gauss(), r.gauss(), r.gauss()).cross(d).normalize();
      d.applyAxisAngle(ax, Math.abs(r.gauss()) * pass.dev).normalize();
      o.copy(wall.point).addScaledVector(d, 0.04);
      left -= wall.t + 0.04;
      if (k < 0.18 || left <= 0) { out.wall = wall; out.k = k; out.dir = d; return out; }
    }
    out.k = k; out.dir = d;
    return out;
  }

  // a round meets a surface: its effects, and whether (and how) it goes on
  // -> null (stopped) | { k, dev }
  strike(hit, dir, C, { by, chew, k }) {
    const G = this.game, D = C.data, kind = D.kind;
    const weak = by === 'hood';
    if (kind === 'glass') {
      // (the pane's own system: a hole and a star, or it goes)
      G.react.bullet(hit, dir.clone(), { weak: false });
      return COVER.glass;
    }
    if (kind === 'thin') {
      this.woodMarks(hit, dir, 0.7, true);
      this.sound('c2_woodHit', hit.point, 0.6);
      return COVER.thin;
    }
    if (kind === 'wood') {
      if (D.hp == null) D.hp = 8;
      if (D.hp0 == null) D.hp0 = D.hp;
      if (D.broken) return COVER.wood;
      D.hp -= chew * k;
      D.hits = (D.hits || 0) + 1;
      // the more it has taken, the more it shows: pale splintered holes,
      // the last ones with light in them
      this.woodMarks(hit, dir, 1, D.hp < D.hp0 * 0.45);
      this.sound('c2_woodHit', hit.point, 1);
      // (their rounds chewing the last of the wood I am down behind: the warning, before one comes through)
      if (weak && D.hp < D.hp0 * 0.45 && Math.hypot(hit.point.x - G.eye.x, hit.point.z - G.eye.z) < 1.6) this.chewT = G.time;
      if (D.hp > 0) return null;
      // spent: a section breaks away (a gap); a piece marked section: false
      // stays, riddled, and lets the rounds through
      if (D.section !== false) this.breakSection(C.mesh, hit, dir);
      return COVER.wood;
    }
    // stone and steel: the reactive world's own (chips, sparks, a car's
    // damage, a lamp, a bottle)
    G.react.bullet(hit, dir.clone(), { weak });
    return null;
  }

  // a wood section shot to pieces: it breaks away (gone from the frame and
  // the bullets' world), a burst of splinters and dust, a crack of wood
  breakSection(mesh, hit, dir) {
    const G = this.game, D = mesh.userData.cover;
    if (D.broken) return;
    D.broken = true;
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    const c = box.getCenter(V(0, 0, 0)), s = box.getSize(V(0, 0, 0));
    mesh.visible = false;
    G.rays.setEnabled(mesh, false);
    const r = this.R, F = G.fx;
    const n = 18 + Math.round(Math.min(30, (s.x + s.y + s.z) * 14));
    for (let i = 0; i < n; i++) {
      const p = V(c.x + (r.next() - 0.5) * s.x, c.y + (r.next() - 0.5) * s.y, c.z + (r.next() - 0.5) * s.z);
      const v = dir.clone().multiplyScalar(r.range(0.6, 2.6)).add(V(r.gauss() * 1.4, r.range(0.4, 2.6), r.gauss() * 1.4));
      F.debris.spawn({ pos: p, vel: v, life: r.range(0.7, 1.4), size: [r.range(0.03, 0.09), r.range(0.008, 0.02)], rot: r.next() * 6.28, spin: r.gauss() * 14, col: [0.1, 0.1, 0.1], alpha: 1, cell: FIRE.CHUNK, gravity: 9.8, ground: G.stage.surfaceY(p.x, p.z) + 0.01, bounce: 0.25, fadeOut: 0.3 });
    }
    for (let i = 0; i < 4; i++) F.dust.spawn({ pos: c.clone().add(V(r.gauss() * 0.2, r.gauss() * 0.1, r.gauss() * 0.2)), vel: V(r.gauss() * 0.3, r.range(0.1, 0.5), r.gauss() * 0.3), life: r.range(0.6, 1.1), size: [0.35, 0.35], grow: 0.8, rot: r.next() * 6.28, col: [0.08, 0.08, 0.08], alpha: 0.45, drag: 2.5, fadeOut: 0.8 });
    this.sound('c2_woodBreak', c, 1);
    // (the cover that held this section is less: the men read it)
    this.events.push({ t: G.time, what: 'break', name: D.name || mesh.name, at: [+c.x.toFixed(2), +c.z.toFixed(2)] });
    if (G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
  }

  // a round's hole in wood: a dark core, a pale torn rim, splinters off it;
  // `light`: the far side's light shows through it (a pale dot)
  woodMarks(hit, dir, k = 1, light = false) {
    const G = this.game, F = G.fx, r = this.R, p = hit.point, nrm = hit.normal;
    F.decals.surface.add(p.clone().addScaledVector(nrm, 0.009), nrm, r.range(0.05, 0.08) * k, r.next() * 6.28, ATLAS.SPLAT[r.int(0, 3)], [0.15, 0.15, 0.15], 0.85);
    F.decals.surface.add(p.clone().addScaledVector(nrm, 0.011), nrm, r.range(0.022, 0.032), r.next() * 6.28, light ? ATLAS.DROP : ATLAS.CHIP, light ? [0.55, 0.55, 0.55] : [0.003, 0.003, 0.003], 1);
    const refl = dir.clone().addScaledVector(nrm, -2 * dir.dot(nrm)).normalize();
    const n = Math.round(r.range(5, 9) * k);
    for (let i = 0; i < n; i++) {
      const v = nrm.clone().multiplyScalar(r.range(0.8, 2.4)).addScaledVector(refl, r.range(0.3, 1.4)).add(V(r.gauss() * 0.8, r.gauss() * 0.8 + 0.6, r.gauss() * 0.8));
      F.chips.spawn({ pos: p.clone().addScaledVector(nrm, 0.02), vel: v, life: r.range(0.4, 0.8), size: [r.range(0.012, 0.03), r.range(0.004, 0.008)], stretch: 0.01, rot: r.next() * 6.28, spin: r.gauss() * 18, col: [0.16, 0.16, 0.16], alpha: 1, cell: ATLAS.CHIP, gravity: 9.8, ground: G.stage.surfaceY(p.x, p.z) + 0.005, fadeOut: 0.2 });
    }
    F.dust.spawn({ pos: p.clone().addScaledVector(nrm, 0.05), vel: nrm.clone().multiplyScalar(0.4), life: r.range(0.3, 0.5), size: [0.12, 0.12], grow: 0.5, rot: r.next() * 6.28, col: [0.08, 0.08, 0.08], alpha: 0.4, drag: 3, fadeOut: 0.8 });
  }

  sound(name, at, k = 1) { const G = this.game; if (G.sfx) G.sfx.play(name, at, { k }, { ref: 3 }); }

  // ---- the player's rounds -----------------------------------------------------------------------------
  // weapon: { name: 'revolver' | 'tommy', chew, dmg(hit) -> number, onHood?(h, hit, dir, head) }
  // The gun must clear what is before it: the muzzle is under the eye, and a
  // round from a gun still behind the desk's edge hits the desk.
  playerRound(origin, dir, W) {
    const G = this.game;
    // (the muzzle: a hand under the eye and an arm's length out)
    const cam = G.camera;
    const down = V(0, -1, 0).transformDirection(cam.matrixWorld);
    const muzzle = origin.clone().addScaledVector(dir, 0.42).addScaledVector(down, W.steady > 0.5 ? 0.07 : 0.11);
    // eye -> muzzle: is the gun itself inside something? then from there
    _d.subVectors(muzzle, origin);
    const ml = _d.length(); _d.divideScalar(ml);
    const blockedGun = G.rays.raycast(origin, _d, ml, { anyHit: false });
    let res;
    if (blockedGun) {
      // the round goes into what the gun is in (the desk's edge)
      res = this.trace(blockedGun.point.clone().addScaledVector(_d, -0.05), dir, { far: 2, by: 'player', chew: W.chew ?? 1 });
    } else {
      // from the muzzle toward where the eye looks (the eye's aim point)
      const aimHit = G.rays.raycast(origin, dir, 160);
      const aimT = aimHit ? aimHit.t : 60;
      const hoodHit = G.rays.raycastHoods(origin, dir, aimT, G.stage.hoods.list);
      const tAim = hoodHit ? hoodHit.t : aimT;
      const target = origin.clone().addScaledVector(dir, Math.max(1.2, tAim));
      const md = target.clone().sub(muzzle).normalize();
      res = this.trace(muzzle, md, { far: W.range ?? 120, by: 'player', chew: W.chew ?? 1 });
    }
    if (res.hood) {
      const h = res.hood.hood, head = HEAD.has(res.hood.joint);
      G.counters.hits++;
      if (head) G.counters.headshots++;
      G.fx.bloodFx.hit(res.hood.point, res.dir, { strength: head ? 1.3 : TORSO.has(res.hood.joint) ? 1.05 : 0.75, rays: G.rays });
      const dmg = W.dmg(res.hood, head) * (head ? 1 : res.k);
      G.damageHood(h, head ? 999 : dmg, res.dir.clone(), { head, joint: res.hood.joint, time: G.time });
      if (W.onHood) W.onHood(h, res.hood, res.dir, head);
      // ([C2] after the critic: the man hit takes it in his brain's onHit - the
      // flinch; it is not also a round past him, which took 60 % of his settle
      // again and broke off a burst)
    }
    this.events.push({ t: +G.time.toFixed(2), what: 'shot', name: res.hood ? 'hood:' + res.hood.joint : res.wall ? (res.wall.mesh.name || res.wall.surf) : 'air', from: blockedGun ? 'gun-in-cover' : '', at: res.passed.map((p) => p.kind) });
    // the men the round passed near: their aim is spoiled (rattled)
    const end = res.hood ? res.hood.point : res.wall ? res.wall.point : origin.clone().addScaledVector(dir, 60);
    for (const [h, ai] of G.ais) {
      if (!h.alive || !ai.brain || !ai.brain.shotNear || (res.hood && res.hood.hood === h)) continue;
      const c = _p.set(h.pos.x, h.pos.y + 1.3, h.pos.z);
      const dd = segDist(origin, end, c);
      if (dd < 1.4) ai.brain.shotNear(dd < 0.6 ? 0.8 : 0.45);
    }
    return res.hood || res.wall || null;
  }

  // ---- their rounds ----------------------------------------------------------------------------------------
  // from his muzzle at a point (a point on my body, or the edge of my cover
  // to keep my head down), thrown off by sigma (rad): what it hits is what
  // is there. Returns { hit: bool, point }
  hoodRound(ai, aimAt, sigma, dmg, { tommy = false } = {}) {
    const G = this.game, h = ai.h, r = this.R;
    // [C2] after the critic's second look: the round leaves his gun, always
    // (it left from his sight line when his gun hand was behind a jamb - a
    // flash in the air by his head): a gun behind something does not fire,
    // he steps out further first (gunman.js armClear / stepClear)
    const muzzle = h.muzzleWorld(V(0, 0, 0));
    const d = aimAt.clone().sub(muzzle).normalize();
    if (sigma > 0) {
      const ax = _a.set(r.gauss(), r.gauss(), r.gauss()).cross(d).normalize();
      d.applyAxisAngle(ax, Math.abs(r.gauss()) * sigma).normalize();
    }
    G.fx.flash.hood(h, muzzle, d, G.time, tommy);
    if (tommy) G.sfx.play('tommy', muzzle, { pitch: 0.9 }, { ref: 4, delay: Math.min(0.2, muzzle.distanceTo(G.eye) / 343) });
    else G.sfx.pistol(muzzle, muzzle.distanceTo(G.eye));
    G.counters.hoodShots++;
    if (G.pacing) G.pacing.shot(G.time);
    const live = G.live;
    const res = this.trace(muzzle.clone().addScaledVector(d, 0.05), d, { far: 90, by: 'hood', chew: tommy ? COVER.chew.hoodTommy : COVER.chew.pistol, player: live, skipHood: h });
    if (res.player) {
      const amount = Math.max(1, Math.round(dmg * res.k));
      this.hurt(amount, res.dir, ai, res);
      return { hit: true, point: res.player.point };
    }
    if (res.hood && live) {
      // (a stray round into another of them - a man holds his fire when his
      // mate is in his line (gunman.js shoot), so only a wide one, or one that
      // went off its line through glass or wood: it is a round; it does to him
      // what it would do to me, no more) // [C2] after the critic: was x2.2
      const o = res.hood.hood;
      G.fx.bloodFx.hit(res.hood.point, res.dir, { strength: 0.8, rays: G.rays });
      G.damageHood(o, dmg * res.k, res.dir.clone(), { head: false, time: G.time });
    }
    // a miss: the crack past the ear if it came close
    const e = G.eye;
    if (REC) this.events.push({ t: +G.time.toFixed(2), what: 'miss', kind: ai.brain && ai.brain.kind, name: res.wall ? (res.wall.mesh.name || 'wall') : res.hood ? 'hood' : 'air' });
    const end = res.wall ? res.wall.point : res.hood ? res.hood.point : res.end || muzzle.clone().addScaledVector(d, 60);
    const ca = closest(muzzle, end, e);
    const dist = ca.distanceTo(e);
    if (dist < 1.7 && ca.distanceTo(muzzle) > 1.0 && end.distanceTo(muzzle) > e.distanceTo(muzzle) - 0.8) this.crack(ca, dist);
    return { hit: false, point: end };
  }

  // I am hit: the damage, the side it came from at the frame's edge, the
  // grunt; the record (what kind of hit put me down: the fall's reason)
  hurt(amount, dir, ai, res = null) {
    const G = this.game, C = G.controller;
    const cam = G.camera;
    // where it came from, on the screen: the shot's way reversed, in the view's frame
    const from = dir.clone().negate();
    const right = V(1, 0, 0).transformDirection(cam.matrixWorld), up = V(0, 1, 0).transformDirection(cam.matrixWorld), fwd = V(0, 0, -1).transformDirection(cam.matrixWorld);
    const sx = from.dot(right), sy = from.dot(up), sf = from.dot(fwd);
    void sy;
    // [C2] after the critic (a round from straight ahead put the splash in
    // the top-left corner, over the objective line): the splash is a compass
    // of where he is, as I stand - ahead at the top edge's middle, his side
    // at that side's edge, behind me at the bottom edge - and never in the
    // corners (the objective line, the health, the count)
    const bear = Math.atan2(sx, sf);
    const at = splashAt(bear);
    const B = this.playerBody();
    // [C2] after the critic's second look: risen is up over something (RMB in
    // the open lifts the eye 0.08 m over nothing: that is down in the open);
    // and down with nothing in front toward him is down in the open
    const risen = (C.riseK || 0) > 0.5 && !!C.riseOver;
    // (bare: nothing toward him and nothing before me either - down with no
    // cover at all; cover that is there but not on his side is his angle)
    let bare = false;
    if (B.crouched && !risen && ai) {
      const q = V(ai.h.pos.x - B.chest.x, 0, ai.h.pos.z - B.chest.z), L = q.length();
      const f = V(-Math.sin(C.yaw), 0, -Math.cos(C.yaw));
      if (L > 0.5) bare = !G.rays.raycast(B.chest, q.divideScalar(L), Math.min(1.4, L - 0.3), { anyHit: true, skip: SEE_SKIP }) && !G.rays.raycast(B.chest, f, 1.2, { anyHit: true, skip: SEE_SKIP });
    }
    this.lastKill = {
      t: G.time, ai, crouched: B.crouched, risen, bare, through: !!(res && res.passed && res.passed.length), reloading: !!(G.player.weapons.active && G.player.weapons.active.reloading),
      flank: !!(ai && ai.brain && ai.brain.flanking), rush: !!(ai && ai.brain && ai.brain.kind === 'rusher'), tommy: !!(ai && ai.brain && ai.brain.kind === 'tommy'),
      dist: ai ? Math.hypot(ai.h.pos.x - G.eye.x, ai.h.pos.z - G.eye.z) : 0, behind: sf < -0.3, moving: C.vel.length() > 1.2,
    };
    G.health.damage(amount, at);
    G.emit('player:hit', { dmg: amount, dir, from: ai ? ai.h : null });
    G.sfx.play('grunt', null, { f0: 88, k: 0.35, dur: 0.14 }, { send: false });
    G.sfx.play('c2_hitMe', null, { k: Math.min(1, amount / 14) }, { send: false });
    G.counters.hoodHits++;
    G.counters.damageTaken += amount;
    C.shake(0.25, 0);
    // (how I was when it came: down, up over the cover, standing; moving)
    const pose = (C.crouchK || 0) > 0.5 ? (risen ? 'risen' : bare ? 'down-open' : 'down') : 'standing';
    this.events.push({ t: G.time, what: 'hit', dmg: amount, by: ai && ai.brain ? ai.brain.kind : '?', pose, flank: this.lastKill.flank, through: this.lastKill.through });
  }

  // a round past the ear: the crack, on the side it passed
  crack(at, dist) {
    const G = this.game;
    G.sfx.play('c2_crack', at, { k: Math.max(0.25, 1 - dist / 1.7) }, { ref: 0.7, roll: 1.2 });
    this.underFireT = G.time;
  }

  // why I fell, in a few words (the retry says it)
  why() {
    const L = this.lastKill, W = this.cfg.why || {};
    if (!L) return W.default || 'Shot.';
    if (L.rush && L.dist < 3.5) return W.rush || 'He walked right up to you.';
    if (L.reloading && !L.crouched) return W.reload || 'Reloading in the open.';
    if (L.flank || L.behind) return W.flank || 'Flanked.';
    if (L.risen) return W.risen || 'Up over the cover too long.';
    if (L.tommy && L.crouched) return W.tommy || 'The Tommy gun chewed through.';
    if (L.crouched && L.through) return W.cover || 'Your cover was shot away.';
    if (L.crouched && L.bare) return W.bare || 'Down, but in the open.';
    if (L.crouched) return W.angle || 'They had your angle.';
    if (L.moving) return W.moving || 'Shot in the open.';
    return W.open || 'Shot standing in the open.';
  }

  // ---- the teach cards (lane C1's hud.teach; the words are the rulebook's) ---------------------------------
  // K.teach('crouch' | 'rise' | 'reload', { again, ...hud.teach's opts }) -> the card's handle.
  // Once per save; `again: true` shows it once more (after two fails of it).
  // The scene picks the safe second; the card goes when the thing is done.
  teach(id, opts = {}) {
    const G = this.game, H = G.hud, C = G.controller;
    const W = () => G.player.weapons.active;
    const T = TEACH[id];
    if (!T || !H.teach) return null;
    const until = { crouch: () => (C.crouchK || 0) > 0.6, rise: () => (C.riseK || 0) > 0.7, reload: () => !!(W() && W().reloading) }[id];
    const { again = false, ...o } = opts;
    return again ? H.teach.again(id, T, { until, ...o }) : H.teach(id, T, { until, ...o });
  }

  // ---- the warning before a fall (WAVE_C §1 rule 2), for this moment --------------------------------------
  // what the player must do now, or null, most urgent first: the heavy is
  // close; a round just came through what I hide behind; down, a man has my
  // angle (a flanker there); a man going round me (which side); hurt and
  // standing in a man's line; hurt and safe, down: stay down while it mends.
  // A line once shown stays a second (unless a more urgent one comes), so it
  // never flickers with a man's line of sight. The kit's own low line
  // (Game.lowStep) is under it. Words in cfg.warn by key.
  warning() {
    const G = this.game, C = G.controller, H = G.health, W = this.cfg.warn || {};
    if (!this.active || H.dead || G.failing) { this._w = null; return null; }
    // (down: crouched and not up over something - RMB in the open rises over nothing, and is down)
    const down = (C.crouchK || 0) > 0.5 && !((C.riseK || 0) > 0.5 && C.riseOver);
    const e = G.eye;
    let pri = 9, text = null;
    // (who a line is about: a line about a man is not held past his death)
    let who = null;
    const say = (p, t, ai = null) => { if (p < pri) { pri = p; text = t; who = ai; } };
    for (const [h, ai] of G.ais) {
      if (!h.alive || !ai.brain) continue;
      const S = ai.brain.S || {};
      if (ai.brain.kind === 'rusher' && !S.entry && Math.hypot(h.pos.x - e.x, h.pos.z - e.z) < 4.2) say(0, W.rush || 'Stop him!', ai);
      if (ai.brain.hasLine && ai.brain.behindMe) say(1, W.behind || 'Behind you!', ai);
      // [C2] after the critic: the Tommy gun coming up at me, standing - the
      // tell said out loud (his raise may be a shadow on glass, a dark arm in
      // a doorway): get down before the burst
      if (!down && ai.brain.kind === 'tommy' && (S.state === 'aim' || S.state === 'fire') &&(ai.brain.hasLine || (S.lastSeen && G.time - S.lastSeen.t < 3))) say(1, W.tommy || 'Tommy gun! Get down!', ai);
      // [C2] after the critic (the street opened with this while nobody was
      // firing): a man who has had me a moment, or has his gun up at me
      if (down && ai.brain.hasLine && ((S.lineT || 0) > 0.45 || S.state === 'aim' || S.state === 'fire' || S.state === 'out')) say(2, W.angle || 'They have your angle. Move!', ai);
      // [C2] after the critic's second look: the first word before the first
      // round - a man bringing his gun onto me while I stand in his line (the
      // click, the star: the line says it with them)
      if (!down && ai.brain.hasLine && (S.state === 'aim' || S.state === 'out' || S.state === 'fire')) say(4, W.open || 'Get down!', ai);
    }
    const L = this.lastKill;
    if (L && G.time - L.t < 1.2 && L.through && down) say(1, W.cover || 'Your cover won\u2019t hold. Move!');
    // (and before a round comes through: the wood I hide behind being chewed to its last)
    if (down && G.time - (this.chewT || -9) < 1.2) say(1, W.cover || 'Your cover won\u2019t hold. Move!');
    // [C2] after the critic's second look (two_ways: the third man came in at
    // my back and the first word was when he already had me): a door of my
    // room opening behind me - the door's sound and this line, before he is
    // through it (a doorway I could see if I turned: in my room)
    const Dn = this.doorIn;
    if (Dn && G.time - Dn.t < 2.2 && Dn.ai.h.alive && Dn.ai.brain && Dn.ai.brain.S && Dn.ai.brain.S.state !== 'fire') {
      const c = _p.set(Dn.D.centre.x, Dn.D.centre.y + 1.2, Dn.D.centre.z);
      const dx = c.x - e.x, dz = c.z - e.z, L = Math.hypot(dx, dz) || 1;
      const fwd = (-Math.sin(C.yaw) * dx - Math.cos(C.yaw) * dz) / L;
      if (fwd < 0.45 && L < 12 && this.see(e, c, 0.3)) say(1, W.door || 'Behind you! The door!', Dn.ai);
    }
    const F = this.flank;
    if (F && !F.done && F.ai.h.alive && !F.ai.brain.hasLine && (F.ai.brain.S.state === 'move' || (F.round && F.ai.brain.S.state === 'entry'))) {
      // (the side he is going round, as I face)
      const fx = F.at.x - e.x, fz = F.at.z - e.z;
      const right = (-Math.cos(C.yaw)) * fx + (Math.sin(C.yaw)) * fz < 0;
      say(3, right ? (W.flankR || 'One\u2019s going round on your right.') : (W.flankL || 'One\u2019s going round on your left.'), F.ai);
    }
    const low = H.hp < 45 || (G.lowWarn && H.hp < 60);
    // [C2] after the critic: standing in a man's line and hit - from the first
    // hit, not only once low (the line came so late in a stand-up trade that
    // the kit's mercy - no fall before a warning has been up a second - kept a
    // man standing in the open alive at 1 hp to win it)
    const shotUp = this.lastKill && !this.lastKill.crouched && G.time - this.lastKill.t < 3.5;
    // ([C2] after the critic's second look: and it stays up between their
    // rounds while I stand there - it dropped while no man had his line for a
    // moment, came again, and each time the kit's 'a second before the fall'
    // was given again: a man standing and trading lived on at 1 hp)
    if (((low && this.lineOnMe > 0) || shotUp) && !down) say(4, W.open || 'Get down!');
    if (low && down) say(5, W.mend || 'Stay down. Let it mend.');
    // (held a second, unless something more urgent comes, or the man it was about is down)
    const P = this._w;
    if (P && P.text && P.text !== text && G.time - P.t < 1.0 && (text == null || pri >= P.pri) && !(P.who && !P.who.h.alive)) return P.text;
    if (!P || P.text !== text) this._w = { text, pri, t: G.time, who };
    return text;
  }

  // ---- per step (game.scripts: before the controller and the men) -----------------------------------------
  update(dt) {
    const G = this.game;
    if (!this.active || G.state !== 'playing') return;
    this.stepBodies(dt);
    // who has a line on me (the brains say), for the mending and the plays
    let n = 0;
    for (const [h, ai] of G.ais) if (h.alive && ai.brain && ai.brain.hasLine) n++;
    this.lineOnMe = n;
    // (?c2rec=1: every man's brain each step, for the plays - window.__c2rec)
    if (REC) {
      const R = window.__c2rec || (window.__c2rec = []);
      if (R.length > 6000) R.splice(0, 2000);
      R.push([+G.time.toFixed(2), +(G.controller.crouchK || 0).toFixed(1), Math.round(G.health.hp), Object.values(G.stage._c2doors || {}).concat(...[...G.stage.parts.values()].filter((q) => q && q.doors).map((q) => Object.values(q.doors))).map((D) => D.name + (D.open01 * 9 | 0)).join(''), ...[...G.ais].filter(([h]) => h.alive && G.ais.get(h).brain && G.ais.get(h).brain.S).map(([h, ai]) => { const S = ai.brain.S; return `${h.slot}${ai.brain.kind[0]}:${S.state}${S.entry && S.entry.ph ? '/' + S.entry.ph : ''}:s${S.settle.toFixed(2)}:${S.line ? 'L' : '-'}${(S.lineT || 0).toFixed(1)}:hp${Math.round(h.hp)}@${h.pos.x.toFixed(1)},${h.pos.z.toFixed(1)}:m${S.mag}h${S.heldN || 0}n${S.shots}:d${S.door ? S.door.D.name + S.door.phase + S.door.tries : ''}:p${ai.path ? ai.pathI + '/' + ai.path.length + (ai.path.length ? '>' + ai.path[ai.path.length - 1].x.toFixed(1) + ',' + ai.path[ai.path.length - 1].z.toFixed(1) : '') : '-'}:f${S.flank ? 1 : 0}`; })]);
    }
    // the flank's clock: how long I have held one spot down behind something
    const e = G.eye, C = G.controller, P = this.post;
    if (Math.hypot(e.x - P.x, e.z - P.z) > 1.6 || (C.crouchK || 0) < 0.5) { P.x = e.x; P.z = e.z; P.t = 0; }
    else P.t += dt;
    if (this.flankCoolT > 0) this.flankCoolT -= dt;
    // ([C2] after the critic's second look: a man still on his way in through
    // a door is the beat's own way round - no other goes round until he is in,
    // and not at once after: two_ways had three ways at once)
    for (const [h, ai] of G.ais) if (h.alive && ai.brain && ai.brain.S && ai.brain.S.entry && ai.brain.S.state === 'entry') { this.flankCoolT = Math.max(this.flankCoolT, this.cfg.flankCool); break; }
    const F = this.flank;
    if (F && F.round && F.ai.h.alive && !F.ai.brain.S.entry) F.done = true;
    if (F && (!F.ai.h.alive || F.done || G.time - F.t0 > (F.round ? 25 : 14))) { this.flank = null; this.flankCoolT = this.cfg.flankCool; }
    if (!this.flank && this.flankCoolT <= 0 && P.t > this.cfg.flankAfter && this.cfg.flankAfter > 0) this.orderFlank();
  }

  // one of them goes round: the man best placed to (not the one firing), to
  // a place he can see me from, off the line the others shoot along
  orderFlank() {
    const G = this.game;
    const men = [...G.ais.entries()].filter(([h, ai]) => h.alive && ai.brain && ai.brain.canFlank && ai.brain.canFlank());
    if (men.length < 1) return;
    const alive = [...G.ais.keys()].filter((h) => h.alive).length;
    if (alive < 2 && !this.cfg.flankAlone && this.post.t < this.cfg.flankAfter * 1.5) return;
    const e = G.eye, B = this.playerBody();
    // the threat's bearing (the mean of where they are)
    let bx = 0, bz = 0;
    for (const [h] of G.ais) if (h.alive) { bx += h.pos.x - e.x; bz += h.pos.z - e.z; }
    const tb = Math.atan2(bx, bz);
    let best = null;
    for (const [h, ai] of men) {
      if (this.tokens.has(ai)) continue;
      const spot = this.flankSpot(ai, tb, B);
      if (spot && (!best || spot.score < best.spot.score)) best = { ai, spot };
    }
    if (!best) return;
    this.flank = { ai: best.ai, at: best.spot, t0: G.time, done: false };
    best.ai.brain.goFlank(best.spot);
    this.events.push({ t: G.time, what: 'flank', at: [+best.spot.x.toFixed(1), +best.spot.z.toFixed(1)] });
  }
  // a place a man can see my crouched head from, round the side of what I
  // hide behind: on rings round me, free, reached by a path, off the threat's line
  flankSpot(ai, tb, B, minOff = 0.9, notNear = 0) {
    const G = this.game, nav = G.nav, e = G.eye, h = ai.h;
    const head = B.head.clone();
    // (the places that see me, by a first guess at their worth; the ways
    // there are searched for the best few only)
    const cands = [];
    const tommy = ai.brain && ai.brain.kind === 'tommy', R0 = tommy ? 6.5 : 5;
    for (const R of tommy ? [6, 7.5] : [3.2, 4.5, 6, 7.5]) {
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        const x = e.x + Math.sin(a) * R, z = e.z + Math.cos(a) * R;
        if (!nav.free(x, z)) continue;
        const off = Math.abs(Math.atan2(Math.sin(a - tb), Math.cos(a - tb)));
        if (off < minOff) continue;
        const crow = Math.hypot(x - h.pos.x, z - h.pos.z);
        if (crow > 20 || crow < notNear) continue;
        cands.push({ x, z, R, off, pre: crow * 0.6 + Math.abs(R - R0) * 0.8 - Math.min(off, 2.2) * 1.5 });
      }
    }
    cands.sort((p, q) => p.pre - q.pre);
    let best = null, tried = 0;
    for (const c of cands) {
      if (tried >= 6 || (best && c.pre > best.score)) break;
      if (!this.see(V(c.x, G.stage.surfaceY(c.x, c.z) + 1.45, c.z), head, 0.25)) continue;
      tried++;
      const path = nav.findPath(h.pos.x, h.pos.z, c.x, c.z, 16000);
      if (!path) continue;
      let L = 0, px = h.pos.x, pz = h.pos.z;
      for (const p of path) { L += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
      if (L > 26) continue;
      // (a near flank on a short path; not one straight through my line of fire)
      const score = L * 0.6 + Math.abs(c.R - R0) * 0.8 - Math.min(c.off, 2.2) * 1.5;
      if (!best || score < best.score) best = { x: c.x, z: c.z, score, path, R: c.R, off: c.off };
    }
    return best;
  }
}

// a hit's splash on the frame, from the bearing of the man who fired (rad,
// 0 ahead, + to my right, +-PI behind): { at: [x, y] as fractions of the
// frame, behind } for Health.damage - ahead: the top edge's middle; to a
// side: that edge, higher the more ahead he is; behind: the bottom edge's
// middle. Never a corner (the objective line, the health, the count are there).
export function splashAt(bear) {
  const b = Math.abs(bear), s = Math.sign(bear) || 1;
  if (b <= 0.4) return { at: [0.5 + (bear / 0.4) * 0.06, 0], behind: false };
  if (b < 2.5) return { at: [s > 0 ? 1 : 0, 0.3 + ((b - 0.4) / 2.1) * 0.45], behind: false };
  return { at: [0.5 + s * ((Math.PI - b) / (Math.PI - 2.5)) * 0.12, 1], behind: true };
}

// (the eyes see through clear glass: a pane that is not frosted, a car's windows)
function SEE_SKIP(e) {
  const ud = e.mesh.userData;
  if (ud.pane) { const m = ud.pane.mesh; return !(m && m.material && m.material.name === 'OfficeFrosted'); }
  if (ud.car && (ud.part === 'glass' || ud.part === 'lens')) return true;
  return false;
}

// the point of segment a-b nearest to p
function closest(a, b, p) {
  const ab = _b.subVectors(b, a), L2 = ab.lengthSq();
  const t = L2 > 1e-9 ? Math.max(0, Math.min(1, _p.subVectors(p, a).dot(ab) / L2)) : 0;
  return a.clone().addScaledVector(ab, t);
}
function segDist(a, b, p) { return closest(a, b, p).distanceTo(p); }

// a ray against a capsule (segment a-b, radius r); t or Infinity
function rayCapsule(o, d, a, b, r, far) {
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const oax = o.x - a.x, oay = o.y - a.y, oaz = o.z - a.z;
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * d.x + bay * d.y + baz * d.z;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d.x * oax + d.y * oay + d.z * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const A = baba - bard * bard, B = baba * rdoa - baoa * bard, Cc = baba * oaoa - baoa * baoa - r * r * baba;
  const h = B * B - A * Cc;
  if (h >= 0 && A > 1e-10) {
    const t = (-B - Math.sqrt(h)) / A;
    const y = baoa + t * bard;
    if (y > 0 && y < baba && t > 0 && t < far) return t;
  }
  const sph = (c) => {
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
    const bb = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
    const disc = bb * bb - cc;
    if (disc < 0) return Infinity;
    const t = -bb - Math.sqrt(disc);
    return t > 0 && t < far ? t : Infinity;
  };
  return Math.min(sph(a), sph(b));
}
export { rayCapsule, closest };
