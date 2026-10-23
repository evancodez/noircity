// Scenes: the story's beats on a stage (docs/story/CONTRACTS.md §3).
//
//   // src/scenes/01_diner.js (found on its own: import.meta.glob)
//   export default defineScene({
//     id: 'diner', stage: 'block', title: 'I', name: 'The Diner',
//     spawn: { anchor: 'diner.stool.player' },
//     beats: ['settle', 'order', 'drink', 'pay'],
//     *script(ctx) { ... },                         // the scene, a coroutine
//     setup: { settle(ctx) { ... }, order(ctx) { ... } },   // jump to a beat
//   });
//
// A script is a generator stepped once per fixed step (Game.post). It
// yields:
//   yield wait(1.2)              seconds of game time
//   yield until(() => cond)      until a condition holds
//   yield beat('order')          the beat begins (scene:beat, a checkpoint
//                                for a beat in def.save); costs no step
//   yield                        (nothing) the next step
//   yield* ctx.say('Scotch. Neat.')            a subtitle, then its 2.2 s
//   yield* ctx.prompt({ text: 'light up', key: 'KeyE' })   until the key
//   yield* c.walkTo('diner.serve.4')           any generator of the same kind
// ctx = { game, stage, player, hands, controller, cast, interact, inspect,
//         puzzles, director, hud, sfx, music, save, rng, time, scene, beat,
//         from, at(beat), pressed(code), say, prompt, onStep(fn), flags,
//         next(opts) }
// A scene leaving drops the HUD's layers (hud.layer(name)).
// [C1] wave C's kit (docs/story/seams/Z.md): a scene may declare
//   objective: 'text' | objectives: { beat: 'text' }   the objective line
//       (hud.objective), set when the scene is entered and when a beat of
//       objectives begins; the chapter's stand-in (scenes/order.js) when the
//       scene sets none; dropped when another scene is entered (a retry of the
//       same scene keeps it)
//   music / beatMusic   the music rule (Z.md §6, docs/story/MUSIC.md): the
//       slot is cued on entering the scene or continuing into any of its beats,
//       a beat of beatMusic cues its own as it begins; the next scene's
//       declaration stops it unless it declares the same slot
//   onDown: { why, to } | (ctx) => { why, to }   what health reaching zero does
//       here (game.fail); else game.setCheckpoint's, else 'Down.' at the beat
// and the chapter's carry / flags (order.js) go into the save on entering.
// ctx.onStep(fn(dt, ctx)) runs fn every step while the scene lasts (what
// lives under the beats: the room, a key that works all scene long).
// ctx.from is the beat the scene was entered at; ctx.at(b) is true when the
// scene started at or before beat b (a script skips what came before a
// jump). No promises, no timers: game time only.
//
//   game.scenes.go(id, { beat?, fade: 'black' | 'cut', card?: true | string,
//                        fadeIn?: s (0.6), keep?: true })
//       a transition: fade to black (0.6 s), enter the stage, run the
//       beat's setup (or place the player at the scene's spawn), the
//       chapter card, fade in over `fadeIn`; the script starts at the beat.
//       keep: the room goes on as it is (no setup, the cast kept): a cut
//       from one scene straight into the next (the diner into the fight)
//   game.scenes.next(opts?) / ctx.next(opts?)   on to the next scene of the
//       story's order (src/scenes/order.js) that has a file, with go's
//       opts; past the last one, the "to be continued" card (game.endSlice)
//   game.scenes.nextId(id?)      that scene's id (null: the end)
//   game.scenes.stop()           no scene (back to the title)
//   game.scenes.shot(id, beat)   the shot mode (?scene=&beat=): the same,
//       at once, no fade, no card, no save
//   game.scenes.current (def) / .beat / .ctx / .names    game.scenes.press(code)
//   game.scenes.playTime  seconds of play since the title (counters)
// Events: scene:enter { id }, scene:beat { id, beat }, scene:exit { id }.
// Checkpoints: entering a scene writes the save, and so does every beat in
// def.save (never in shot mode). A scene may export auto(ctx): what the
// autoplay driver does at each beat (game/Autoplay.js).
// (a scene file imports its helpers from game/script.js, never from here:
// this module loads the scene files)
import { wait, keyLabel, ORDER } from './script.js';
export { wait, until, beat, defineScene, keyLabel } from './script.js';
// [C1] (a file whose name starts with `_` is a helper or a parked scene, never
// a scene: _diner_room.js)
const SCENE_MODS = import.meta.glob(['../scenes/*.js', '!../scenes/_*.js'], { eager: true });

const FADE = 0.6;

// [C3b] the small chapter card (go's card: 'small'): the number and the name
// in small spaced capitals high over the picture, in and out on its own
// (3.4 s), as the tail's own card over the windscreen (scenes/tail/kit.js)
function smallCard(G, num, name) {
  if (typeof document === 'undefined' || !G.hud || !G.hud.layer) return;
  if (!document.getElementById('smallcardcss')) {
    const st = document.createElement('style'); st.id = 'smallcardcss';
    st.textContent = `.smallcard { position: absolute; left: 50%; top: 21%; transform: translateX(-50%); text-align: center; color: #efede7; opacity: 0;
      text-shadow: 0 0 8px #000, 0 0 2px #000; white-space: nowrap; pointer-events: none; animation: smallcard 3.4s linear forwards; }
      .smallcard .n { display: block; font-size: 13px; letter-spacing: 0.5em; margin-bottom: 6px; }
      .smallcard .t { display: block; font-size: 15px; letter-spacing: 0.42em; text-transform: uppercase; }
      @keyframes smallcard { 0% { opacity: 0; } 18% { opacity: 1; } 74% { opacity: 1; } 100% { opacity: 0; } }
      #hud.failing .smallcard { visibility: hidden; }`;
    document.head.appendChild(st);
  }
  const el = G.hud.layer('smallcard');
  el.innerHTML = '';
  const c = document.createElement('div'); c.className = 'smallcard';
  const n = document.createElement('span'); n.className = 'n'; n.textContent = num || '';
  const t = document.createElement('span'); t.className = 't'; t.textContent = name || '';
  c.append(n, t); el.appendChild(c);
  G.smallCardShown = { num, name, t: G.time };
}

export class SceneManager {
  constructor(game) {
    this.game = game;
    this.defs = new Map();
    for (const m of Object.values(SCENE_MODS)) if (m.default && m.default.id) this.defs.set(m.default.id, m.default);
    this.current = null;
    this.beat = null;
    this.ctx = null;
    this.it = null;
    this.waitOn = null;
    this.trans = null;       // { phase: 'out' | 'in', t, id, opts }
    this.fadeK = 0;
    this.injected = new Set();
    this.hooks = [];
    this.startT = 0;
  }

  get names() { return [...this.defs.keys()]; }
  get(id) { return this.defs.get(id) || null; }

  // the story's order (src/scenes/order.js): the next id after `id` that
  // has a scene file, or null (the end; a scene outside the order has none)
  nextId(id = this.current && this.current.id) {
    const i = ORDER.findIndex((o) => o.id === id);
    if (i < 0) return null;
    for (let j = i + 1; j < ORDER.length; j++) if (this.defs.has(ORDER[j].id)) return ORDER[j].id;
    return null;
  }
  // on to it (go's opts: a fade to black and the chapter card by default);
  // past the last scene, the "to be continued" card
  next(opts = {}) {
    const id = this.nextId();
    if (!id) { this.game.endSlice(); return null; }
    this.go(id, opts);
    return id;
  }

  // ---- transitions ---------------------------------------------------------------------
  go(id, opts = {}) {
    const def = this.defs.get(id);
    if (!def) throw new Error(`scenes.go: no scene '${id}' (scenes: ${this.names.join(', ')})`);
    if (opts.beat && !def.beats.includes(opts.beat)) throw new Error(`scenes.go: '${id}' has no beat '${opts.beat}' (beats: ${def.beats.join(', ')})`);
    const fade = opts.fade ?? 'black';
    this.riseT = null;
    if (fade === 'cut' || this.game.shotMode) { this.trans = null; this.enter(def, opts); this.setFade(0); return; }
    // [C1] (from where the fade stands: already black - after the stills, a
    // fail - it stays black, it never flashes the old picture; hold: seconds
    // more of black after the scene is entered, before it comes up)
    this.trans = { phase: 'out', t: 0, def, opts, fadeIn: opts.fadeIn ?? FADE, k0: this.fadeK, hold: opts.hold || 0 };
  }

  // [C1] up out of the black in the same scene (after a stills run that the
  // scene goes on from): a breath of black first - a script that goes on to
  // another scene at once (ctx.next) cancels it and the black carries over
  rise(dur = 0.7) { if (!this.trans && this.current) this.riseT = { t: -0.12, dur }; }

  // no scene at all (the title): the script, its hooks and its prompts end
  stop() {
    const G = this.game;
    if (this.current) G.emit('scene:exit', { id: this.current.id });
    G.interact.clear('scene');
    if (G.inspect.active) G.inspect.close(false);
    if (G.puzzles.active) G.puzzles.close();
    G.hud.clearPrompt();
    G.hud.dropLayers();
    // [C1] (the kit's lines go with the scene)
    const K = G.hud.kit;
    if (K) { K.objective(null, { now: true }); K.clearWarn({ now: true }); K.dismissTeach(); }
    this.current = null; this.beat = null; this.ctx = null; this.it = null; this.waitOn = null; this.hooks = []; this.trans = null; this.riseT = null;
    this.setFade(0);
  }

  shot(id, beatName = null) {
    const def = this.defs.get(id);
    if (!def) throw new Error(`scene shot: no scene '${id}' (scenes: ${this.names.join(', ')})`);
    this.go(id, { beat: beatName || def.beats[0] || null, fade: 'cut', card: false });
  }

  setFade(k) { this.fadeK = k; this.game.hud.fade(k); }

  enter(def, { beat: b = null, card = null, keep = false } = {}) {
    const G = this.game;
    if (this.current) G.emit('scene:exit', { id: this.current.id });
    G.interact.clear('scene');
    if (G.inspect.active) G.inspect.close(false);
    if (G.puzzles.active) G.puzzles.close();
    G.hud.clearPrompt();
    G.hud.dropLayers();
    // [R3] what the scene before left running does not follow the player in (the watcher froze him at his car's
    // door and its car-door grip was a hold-clip: in the tail the car would not drive, the right arm stood up
    // across the windscreen). The controls come back and a clip that holds a pose is let go; a scene may set
    // either again in its setup, which runs after this. A cut straight on (keep) leaves the hands as they are.
    G.controller.frozen = false;
    this.prompting = null;
    if (!keep) {
      G.controller.lookLocked = false;
      // (a hold-clip keeps its last pose until another clip is played, done or not: it has to go from the list)
      const H = G.hands;
      if (H.clips.some((c) => c.hold)) { H.clips = H.clips.filter((c) => !c.hold); H.keyMemo = null; H.snapshot(0.18); }
    }
    // [C1] the kit: a retry of the same scene keeps its objective line, its
    // fail counts and its checkpoint; another scene starts them afresh. A
    // warning, a teach card and a fail's line never follow the player in.
    const same = !!(this.current && this.current.id === def.id);
    const K = G.hud.kit;
    if (K) { K.clearWarn({ now: true }); K.dismissTeach(); if (!same) K.objective(null, { now: true }); }
    if (!same && G.kitReset) G.kitReset(def.id);
    const stage = G.enterStage(def.stage);
    const from = b || def.beats[0] || null;
    this.current = def;
    this.beat = from;
    // [C1] what the detective carries by this chapter (order.js / def.carry)
    carry(G.save, def);
    const ctx = this.makeCtx(def, stage, from, keep);
    this.ctx = ctx;
    // the room as the beat has it: setup puts every figure and the player
    // where the story has them (the stage's cast is the scene's)
    this.hooks = [];
    this.startT = G.time;
    this.gen = (this.gen || 0) + 1;
    if (!keep) stage.cast.clear();
    const objCalls = K ? K.objectiveCalls : 0;
    if (keep) { /* the room as it stands */ }
    else if (from && def.setup[from]) def.setup[from](ctx);
    else if (def.spawn && def.spawn.anchor) {
      const a = stage.anchor(def.spawn.anchor);
      if (a) G.controller.setPose(a.pos.x, a.pos.z, a.yaw, 0);
    }
    // [C1] the objective line as the beat has it (the setup may have set one
    // itself), and the music the scene and the beat declare
    // (a retry comes back to the beat's own line, not one a script set later
    // in it; a setup that set its own line keeps it)
    if (K && K.objectiveCalls === objCalls) {
      const want = this.objectiveFor(def, from);
      if (want !== undefined) { K.objective(want, { strike: false }); this.objMark = K.objectiveCalls; }
    }
    this.applyMusic(def, from, true, !same);
    G.emit('scene:enter', { id: def.id });
    // [C3b] card: 'small' - the chapter's card lettered small over the
    // picture, no black (a cut from one chapter straight into the next: the
    // tail's arrival at Pier 9)
    if (card === 'small' && !G.shotMode) smallCard(G, def.title, def.name);
    else if (card !== false && (card === true || typeof card === 'string') && !G.shotMode) G.hud.card(def.title, typeof card === 'string' ? card : def.name);
    this.it = def.script ? def.script(ctx) : null;
    this.waitOn = null;
    if (!G.shotMode) G.save.write({ scene: true });   // [O7] (not a save in the open world: Save.js)
    this.stepScript(0);
  }

  makeCtx(def, stage, from, keep = false) {
    const G = this.game, M = this;
    const order = def.beats;
    const ctx = {
      game: G, stage, player: G.player, hands: G.player.hands, controller: G.controller, cast: stage.cast,
      interact: G.interact, inspect: G.inspect, puzzles: G.puzzles, director: G.director, hud: G.hud, sfx: G.sfx,
      music: G.music, save: G.save, rng: stage.rng.fork(9000 + [...def.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 997),
      scene: def, from, flags: {}, kept: !!keep,
      get time() { return G.time; },
      get beat() { return M.beat; },
      at: (b) => !from || order.indexOf(b) >= order.indexOf(from),
      pressed: (code) => M.pressed(code),
      onStep: (fn) => { M.hooks.push(fn); return fn; },
      next: (opts) => M.next(opts),
      get sceneTime() { return G.time - M.startT; },
      *say(text, secs = 2.2) { G.hud.say(text, secs); yield wait(secs); },
      // wait for a key, the prompt low in the frame ('E  light up')
      // at: a Vector3, an Object3D or () => Vector3 (the tick's place)
      *prompt({ text, key = 'KeyE', at = null } = {}) {
        M.prompting = { text, key, at };
        const where = () => { const a = typeof at === 'function' ? at() : at; return a && a.isObject3D ? a.getWorldPosition(M._at || (M._at = a.position.clone())) : a; };
        for (;;) {
          G.hud.prompt(`${keyLabel(key)}  ${text}`, at ? G.screenOf(where()) : null, 'scene');
          if (M.pressed(key)) break;
          yield null;
        }
        M.prompting = null;
        G.hud.clearPrompt('scene');
      },
    };
    return ctx;
  }

  // a key pressed this step (the Game's input edges, or one pressed for a
  // headless driver with scenes.press)
  pressed(code) { return this.game.pressed(code) || this.injected.has(code); }
  press(code) { this.injected.add(code); }

  // ---- per step (Game.post) --------------------------------------------------------------
  update(dt) {
    const T = this.trans;
    if (this.current && this.game.state === 'playing') this.playTime = (this.playTime || 0) + dt;
    if (T) {
      T.t += dt;
      if (T.phase === 'out') {
        // [C1] (k0: the black it started from; 0 as it always was)
        const k0 = T.k0 || 0, out = k0 >= 1 ? 0 : FADE * (1 - k0);
        this.setFade(out > 0 ? k0 + (1 - k0) * Math.min(1, T.t / out) : 1);
        if (T.t >= out) { this.enter(T.def, { ...T.opts, card: T.opts.card ?? true }); T.phase = 'in'; T.t = -(T.hold || 0); }
      } else {
        // (the fade in eases out: the room comes up out of the black)
        const u = Math.max(0, Math.min(1, T.t / T.fadeIn));
        this.setFade(1 - u * u * (3 - 2 * u));
        if (T.t >= T.fadeIn) this.trans = null;
      }
    }
    if (!T || T.phase === 'in') {
      // (a hook or the script may cut to another scene: what is left of
      // this step belongs to the new one)
      const gen = this.gen;
      for (const f of [...this.hooks]) { f(dt, this.ctx); if (this.gen !== gen) break; }
      if (this.gen === gen) this.stepScript(dt);
    }
    // [C1] (rise: after the script's step, so a go() this step cancels it first)
    const R = this.riseT;
    if (R && !this.trans && !this.game.failing) {
      R.t += dt;
      const u = Math.max(0, Math.min(1, R.t / R.dur));
      if (R.t > 0) this.setFade(1 - u * u * (3 - 2 * u));
      if (u >= 1) this.riseT = null;
    } else if (R) this.riseT = null;
    this.injected.clear();
  }

  stepScript(dt) {
    if (!this.it) return;
    const w = this.waitOn;
    if (w && w.kind === 'wait') { w.left -= dt; if (w.left > 1e-6) return; }
    else if (w && w.kind === 'until' && !w.cond()) return;
    this.waitOn = null;
    const it = this.it;
    // (a beat marker costs no step: the script runs on to its next wait)
    for (let guard = 0; guard < 64; guard++) {
      const r = it.next();
      // (the script cut to another scene: the new one has taken over)
      if (this.it !== it) return;
      if (r.done) { this.it = null; return; }
      const v = r.value;
      if (v && v.kind === 'beat') { this.setBeat(v.name); continue; }
      this.waitOn = v || null;
      if (v && v.kind === 'wait' && v.left <= 0) continue;
      return;
    }
  }

  setBeat(name) {
    const def = this.current;
    if (def && !def.beats.includes(name)) throw new Error(`scene '${def.id}': no beat '${name}'`);
    const was = this.beat;
    this.beat = name;
    // [C1] a beat that has its own objective line or music begins; a
    // chapter's stand-in line (order.js) that this beat has none of is taken
    // down - better no line than a goal that is no longer the goal - unless
    // the scene has set a line of its own since (hud.objective in its script)
    if (def && name !== was) {
      const K = this.game.hud.kit;
      if (K) {
        const ob = def.objectives;
        if (ob && Object.prototype.hasOwnProperty.call(ob, name)) { K.objective(ob[name]); this.objMark = K.objectiveCalls; }
        else if (def.objStandIn && K.objectiveCalls === this.objMark && K.objectiveText) { K.objective(null); this.objMark = K.objectiveCalls; }
      }
      this.applyMusic(def, name, false);
    }
    this.game.emit('scene:beat', { id: def.id, beat: name });
    if (def.save && def.save.includes(name) && !this.game.shotMode) this.game.save.write({ scene: true });   // [O7]
  }

  // [C1] the objective line a beat declares: its line in `objectives` (null:
  // none), else the scene's one `objective`; a chapter's stand-ins give only
  // what they name for the beat (undefined: nothing declared)
  objectiveFor(def, beatName) {
    const ob = def.objectives;
    if (ob && beatName && Object.prototype.hasOwnProperty.call(ob, beatName)) return ob[beatName];
    if (def.objective) return def.objective;
    return def.objStandIn ? null : undefined;
  }

  // [C1] the music rule (seams/Z.md §6, docs/story/MUSIC.md "The rule"):
  // entering a scene - a chapter's start, a CONTINUE, a retry, a jump - cues
  // what it declares for that beat (its beatMusic's, else its music); a beat
  // of beatMusic cues its own as it begins. A spec: 'slot' | { slot, fade } |
  // null | { stop: fade } | 'room' (the scene plays its own: left alone) |
  // undefined (not declared: entered from another scene, the music stops; a
  // retry changes nothing). Leaving a scene stops its slot only
  // through the next scene's declaration (a slot of its own crossfades, the
  // same slot plays on, null stops it); the title stops it (Game.toTitle).
  musicFor(def, beatName) {
    const bm = def.beatMusic;
    if (bm && beatName && Object.prototype.hasOwnProperty.call(bm, beatName)) return bm[beatName];
    return def.music;
  }
  applyMusic(def, beatName, entering, newScene = false) {
    const G = this.game, M = G.music;
    if (!M || G.shotMode) return;
    const bm = def.beatMusic;
    // (a beat with nothing of its own changes nothing as it begins)
    if (!entering && !(bm && Object.prototype.hasOwnProperty.call(bm, beatName))) return;
    let m = this.musicFor(def, beatName);
    // (a scene that declares nothing: coming in from another scene, the music
    // stops - leaving a scene stops its slot unless the next declares it; a
    // retry of the same scene changes nothing)
    if (m === undefined) { if (!entering || !newScene) return; m = null; }
    if (m === 'room') return;
    if (m === null) { if (M.current) M.stop(2); return; }
    if (typeof m === 'string') { M.cue(m, { fade: 2.5 }); return; }
    if (m.slot) M.cue(m.slot, { fade: m.fade ?? 2.5 });
    else if (m.stop != null) { if (M.current) M.stop(m.stop); }
  }
}

// [C1] what the detective carries by a chapter's start (WAVE_C §4): the
// chapter's carry and flags (scenes/order.js, or the scene's own) added to
// the save where they are missing; nothing is ever taken away here
function carry(save, def) {
  if (!save) return;
  const inv = save.inventory || (save.inventory = []);
  for (const k of def.carry || []) if (!inv.includes(k)) inv.push(k);
  const F = save.flags || (save.flags = {});
  for (const [k, v] of Object.entries(def.flags || {})) if (F[k] === undefined) F[k] = v;
}
