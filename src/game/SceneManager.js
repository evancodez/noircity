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
//         from, at(beat), pressed(code), say, prompt, onStep(fn), flags }
// ctx.onStep(fn(dt, ctx)) runs fn every step while the scene lasts (what
// lives under the beats: the room, a key that works all scene long).
// ctx.from is the beat the scene was entered at; ctx.at(b) is true when the
// scene started at or before beat b (a script skips what came before a
// jump). No promises, no timers: game time only.
//
//   game.scenes.go(id, { beat?, fade: 'black' | 'cut', card?: true | string })
//       a transition: fade to black (0.6 s), enter the stage, run the
//       beat's setup (or place the player at the scene's spawn), the
//       chapter card, fade in; the script starts at the beat
//   game.scenes.shot(id, beat)   the shot mode (?scene=&beat=): the same,
//       at once, no fade, no card, no save
//   game.scenes.current (def) / .beat / .ctx / .names    game.scenes.press(code)
// Events: scene:enter { id }, scene:beat { id, beat }, scene:exit { id }.
//
// FOUNDATION: plain but working; lane 7 owns it (checkpoints, the fade's
// look, the cards' lettering).
// (a scene file imports its helpers from game/script.js, never from here:
// this module loads the scene files)
import { wait, keyLabel } from './script.js';
export { wait, until, beat, defineScene, keyLabel } from './script.js';
const SCENE_MODS = import.meta.glob('../scenes/*.js', { eager: true });

const FADE = 0.6;

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

  // ---- transitions ---------------------------------------------------------------------
  go(id, opts = {}) {
    const def = this.defs.get(id);
    if (!def) throw new Error(`scenes.go: no scene '${id}' (scenes: ${this.names.join(', ')})`);
    if (opts.beat && !def.beats.includes(opts.beat)) throw new Error(`scenes.go: '${id}' has no beat '${opts.beat}' (beats: ${def.beats.join(', ')})`);
    const fade = opts.fade ?? 'black';
    if (fade === 'cut' || this.game.shotMode) { this.enter(def, opts); this.setFade(0); return; }
    this.trans = { phase: 'out', t: 0, def, opts };
  }

  shot(id, beatName = null) {
    const def = this.defs.get(id);
    if (!def) throw new Error(`scene shot: no scene '${id}' (scenes: ${this.names.join(', ')})`);
    this.go(id, { beat: beatName || def.beats[0] || null, fade: 'cut', card: false });
  }

  setFade(k) { this.fadeK = k; this.game.hud.fade(k); }

  enter(def, { beat: b = null, card = null } = {}) {
    const G = this.game;
    if (this.current) G.emit('scene:exit', { id: this.current.id });
    G.interact.clear('scene');
    if (G.inspect.active) G.inspect.close(false);
    if (G.puzzles.active) G.puzzles.close();
    G.hud.clearPrompt();
    const stage = G.enterStage(def.stage);
    const from = b || def.beats[0] || null;
    this.current = def;
    this.beat = from;
    const ctx = this.makeCtx(def, stage, from);
    this.ctx = ctx;
    // the room as the beat has it: setup puts every figure and the player
    // where the story has them (the stage's cast is the scene's)
    this.hooks = [];
    this.startT = G.time;
    stage.cast.clear();
    if (from && def.setup[from]) def.setup[from](ctx);
    else if (def.spawn && def.spawn.anchor) {
      const a = stage.anchor(def.spawn.anchor);
      if (a) G.controller.setPose(a.pos.x, a.pos.z, a.yaw, 0);
    }
    G.emit('scene:enter', { id: def.id });
    if (card !== false && (card === true || typeof card === 'string') && !G.shotMode) G.hud.card(def.title, typeof card === 'string' ? card : def.name);
    this.it = def.script ? def.script(ctx) : null;
    this.waitOn = null;
    if (!G.shotMode) G.save.write();
    this.stepScript(0);
  }

  makeCtx(def, stage, from) {
    const G = this.game, M = this;
    const order = def.beats;
    const ctx = {
      game: G, stage, player: G.player, hands: G.player.hands, controller: G.controller, cast: stage.cast,
      interact: G.interact, inspect: G.inspect, puzzles: G.puzzles, director: G.director, hud: G.hud, sfx: G.sfx,
      music: G.music, save: G.save, rng: stage.rng.fork(9000 + [...def.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 997),
      scene: def, from, flags: {},
      get time() { return G.time; },
      get beat() { return M.beat; },
      at: (b) => !from || order.indexOf(b) >= order.indexOf(from),
      pressed: (code) => M.pressed(code),
      onStep: (fn) => { M.hooks.push(fn); return fn; },
      get sceneTime() { return G.time - M.startT; },
      *say(text, secs = 2.2) { G.hud.say(text, secs); yield wait(secs); },
      // wait for a key, the prompt low in the frame ('E  light up')
      *prompt({ text, key = 'KeyE', at = null } = {}) {
        M.prompting = { text, key, at };
        for (;;) {
          G.hud.prompt(`${keyLabel(key)}  ${text}`, at ? G.screenOf(at) : null, 'scene');
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
    if (T) {
      T.t += dt;
      if (T.phase === 'out') {
        this.setFade(Math.min(1, T.t / FADE));
        if (T.t >= FADE) { this.enter(T.def, { ...T.opts, card: T.opts.card ?? true }); T.phase = 'in'; T.t = 0; }
      } else {
        this.setFade(Math.max(0, 1 - T.t / FADE));
        if (T.t >= FADE) this.trans = null;
      }
    }
    if (!T || T.phase === 'in') {
      for (const f of [...this.hooks]) f(dt, this.ctx);
      this.stepScript(dt);
    }
    this.injected.clear();
  }

  stepScript(dt) {
    if (!this.it) return;
    const w = this.waitOn;
    if (w && w.kind === 'wait') { w.left -= dt; if (w.left > 1e-6) return; }
    else if (w && w.kind === 'until' && !w.cond()) return;
    this.waitOn = null;
    // (a beat marker costs no step: the script runs on to its next wait)
    for (let guard = 0; guard < 64; guard++) {
      const r = this.it.next();
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
    this.beat = name;
    this.game.emit('scene:beat', { id: def.id, beat: name });
    if (def.save && def.save.includes(name) && !this.game.shotMode) this.game.save.write();
  }
}
