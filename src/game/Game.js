import * as THREE from 'three';
import { Viewmodel, MUZZLE } from '../player/Viewmodel.js';
import { Weapon, WEAPON } from '../player/Weapon.js';
import { Health } from '../player/Health.js';
import { HoodPacing } from '../enemies/HoodAI.js';
import { makeBrain } from '../enemies/HoodBrains.js';
import { Director } from './Director.js';
import { Brawl } from './Brawl.js';
import { Autopilot } from './Autopilot.js';
import { DEATHS, HAT_OFF } from '../enemies/HoodAnim.js';
import { Storm } from '../world/Storm.js';
import { Sfx } from '../audio/Sfx.js';
import { Hands } from '../player/Hands.js';
import { Weapons } from '../player/Weapons.js';
import { SceneManager } from './SceneManager.js';
import { Interact } from './Interact.js';
import { Inspect } from './Inspect.js';
import { Puzzles } from './Puzzles.js';
import { Exposure } from './Exposure.js';
import { Save } from './Save.js';
import { Music } from '../audio/Music.js';
import { Vehicles } from '../vehicles/index.js';
import { Bodies } from '../guns/Bodies.js';   // [C2]
import { Stills } from './Stills.js';

// The game: the player (Controller + Tommy gun + Health), the Hoods' AI,
// the encounter director (game/Director.js), combat resolution (the
// player's hitscan -> Weapon.js, the Hoods' delayed shots here), effects,
// and the state machine
//   title -> playing -> dead ("THE END")
// One fixed step (1/60 s): pre() before stage.update (input, the gun, AI
// decisions), post() after it (enemy bullets, effects, the director, HUD).
//
// Stages (docs/story/CONTRACTS.md §2): game.stage (old name game.world) is
// the current place, game.stages.get(name) any other. What belongs to a
// place is the stage's - its effects, ray world, nav grid, cover set,
// reactions and cast (game.fx, .rays, .nav, .covers, .react, .hoods read
// the current one); what belongs to the player or the machine is the
// game's - the hands and the gun, health, the HUD, sound, the pipeline -
// and is re-bound to the stage on stage:enter (enterStage).
// The story (docs/story/CONTRACTS.md §2.1): game.scenes (the scene
// manager), .interact, .inspect, .puzzles, .director, .exposure, .music,
// .save, .vehicles (wave B), game.player = { controller, hands, weapons,
// health, eye }, and the current stage's .cast, .glass, .breakables.
// Input edges for the scripts, one fixed step at a time: game.pressed(code)
// (a key or 'Mouse0' / 'Mouse2' went down since the last step),
// game.released(code), game.mouse { dx, dy, wheel } (this step's).
export const GAME = { corpseCap: 16, hoodHp: 100, heavyHp: 170 };
// [C1] the warning before going down: on under `on` with a hit in the last
// second, off as health mends past `off`; no fall before a warning has been
// up `read` seconds (seams/Z.md §3)
export const LOW = { on: 45, off: 60, read: 1.0 };

export class Game {
  // stages: the registry (src/stages/index.js); stage: the one to start in
  constructor({ stages, stage = 'block', camera, controller, pipeline, hud, shotMode, sfx = null }) {
    this.stages = stages;
    this.world = stages.get(stage);
    const world = this.world;
    this.camera = camera;
    this.controller = controller;
    this.pipeline = pipeline;
    this.hud = hud;
    this.shotMode = shotMode;
    this.counters = {
      spawned: 0, alive: 0, shots: 0, hits: 0, headshots: 0, kills: 0,
      hoodShots: 0, hoodHits: 0, damageTaken: 0, deaths: 0, bursts: 0, impacts: 0, decals: 0, casings: 0,
      // pacing (Phase 3a preamble #3): the longest stretch of a fight
      // without a Hood shot, and the delay from its start to the first one
      maxLull: 0, firstVolley: -1,
      // Phase 3a: the world's reactions
      explosions: 0, blastKills: 0, blastDamage: 0, burnTicks: 0, lampsOut: 0, windows: 0, panes: 0, props: 0,
    };
    const t0 = performance.now();
    this.vm = new Viewmodel(world, camera);
    this.weapon = new Weapon(this, this.vm);
    this.health = new Health(hud.root);
    this.health.onDeath = () => this.onPlayerDeath();
    this.vmWanted = true;
    // the player's eye (the first-person camera's place): what the Hoods
    // shoot at and the combat measures from
    this.eye = camera.position.clone();
    // fights: the director's scripts, the Hoods' pacing
    this.pacing = new HoodPacing(this);
    this.director = new Director(this);
    this.sfx = sfx || new Sfx();
    this.storm = new Storm(world, pipeline);
    this.storm.onThunder = (s, far, dbl) => this.sfx.thunder(s, far, dbl);
    // the player's hands and weapons, and the story's systems
    this.hands = new Hands(this, this.vm);
    this.weapons = new Weapons(this);
    this.player = { controller, hands: this.hands, weapons: this.weapons, health: this.health, eye: this.eye };
    this.exposure = new Exposure(this);
    this.music = new Music(this);
    this.save = new Save(this, { enabled: !shotMode });
    this.vehicles = new Vehicles(this);
    this.interact = new Interact(this);
    this.inspect = new Inspect(this);
    this.puzzles = new Puzzles(this);
    this.scenes = new SceneManager(this);
    this.brawl = new Brawl(this);
    // [C1] wave C's kit (docs/story/seams/Z.md): the stills player, the fail,
    // the checkpoints and the fail counts; the HUD's lines read the game
    this.stills = new Stills(this);
    this.failing = null;       // a fail under way (fail())
    this.failCounts = new Map();
    this.checkpoint = null;    // { beat, why } for health reaching zero
    this.crawl = 1;            // a held teach card's slow time (main.js)
    this.lowWarn = null;       // the warning a falling health put up (lowStep)
    this.health.spare = () => this.spareLast();
    hud.game = this;
    // hit feel (the brawl): steps the simulation skips (a hit stop), and a
    // slow-motion scale on the real-time loop (main.js)
    this.hitStop = 0;
    this.timeScale = 1;
    this.slowT = 0;
    // [C4] the world's own clock against mine: the fist fight's dodge cue
    // drops the world (him, what he threw, the room, the rain) to about a
    // third while my hands, my look and my input run at full speed (main.js
    // simStep: pre(dt) is mine, the stage and post's world parts take
    // dt * worldK). 1 everywhere else: nothing else changes.
    this.worldK = 1;
    // input edges (see pressed / released / held / mouse); vin: the
    // autoplay's hands on the same keys (game/Autoplay.js)
    this.keysDown = new Set();
    this.keysUp = new Set();
    this.vin = { held: new Set(), down: new Set(), up: new Set() };
    this.mouse = { dx: 0, dy: 0, wheel: 0 };
    this._mouseAcc = { dx: 0, dy: 0, wheel: 0 };
    // the world's shot-mode clocks run (a train and lightning in a shot are
    // staged explicitly: shot=train, lightning=)
    this.ambient = !shotMode;
    this.ais = new Map();
    this.pending = [];        // the Hoods' bullets in flight
    this.corpses = [];
    this.state = shotMode ? 'playing' : 'title';
    this.autopilot = null;
    this.muted = false;
    this.rng = world.rng.fork(8080);
    this.time = 0;
    this.scripts = [];        // staged shots: (t, dt) => void, run each step
    this.bodies = new Bodies(this);   // [C2] solid bodies for any figure (docs/story/seams/GUNS.md §6)
    this.lastHoodShot = new Map();   // hood -> time of his last shot (autopilot)
    // the viewmodel is drawn by the pipeline's viewmodel pass; every light
    // must also be visible to its camera (three filters lights by layer)
    pipeline.vm = { scene: this.vm.scene, camera: this.vm.cam, frameInv: this.vm.frameInv, visible: true, fxLive: () => this.fx.flash.vm.list.length > 0 };
    this.enterStage(world);
    this.initMs = performance.now() - t0;
    // pipeline hooks: Hoods beyond 20 m stay out of the planar reflection
    // (it mirrors emitters only: a far man is a speck of occlusion); the Hoods
    // are the only moving shadow casters (a settled corpse is static)
    const reflList = [];
    pipeline.reflHide = (cam) => {
      reflList.length = 0;
      for (const h of this.stage.hoods.list) if (h.object.visible && h.pos.distanceToSquared(cam.position) > 20 * 20) reflList.push(h.object);
      return reflList;
    };
    // (the el's iron only: a car's chrome and lamps are emitters in the
    // mirror - its light build moved a column in the wet street)
    pipeline.reflLod = (on) => { this.stage.reflLod(on); };
    // (the shadow maps take the light builds too: Phase 3c performance)
    pipeline.shadowLod = (on) => { this.stage.shadowLod(on); };
    pipeline.volPost = () => this.fx.puff.list.length > 0;
    const casters = [];
    pipeline.shadowCasters = () => {
      casters.length = 0;
      for (const h of this.shadowFigures()) {
        if (!h.object.visible || !h.mesh.castShadow) continue;
        const moving = h.alive || h._deathT < 3.5 || (h.hat && !h.hat.rest);
        // (Phase 3c performance pass: a man standing his ground - aiming,
        // firing from cover, idling - only sways; his shadow is refreshed
        // like a far man's, every fourth frame: invisible under the soft
        // PCF pool. Walking, running, staggering, flinching, falling: at
        // the full rate)
        const slow = h.alive && !(h.state === 'walk' || h.state === 'run' || h.state === 'stagger' || h.anim.lowerOnce) && !(h.hat && !h.hat.rest);
        casters.push({ id: h.slot + ':' + (h.geoStamp || 0), x: h.pos.x, y: h.pos.y + 1, z: h.pos.z, moving, slow });
      }
      return casters;
    };
  }

  // Enter a stage (a name or a Stage): the place's systems come with it, the
  // player's and the machine's are re-bound to it. (The scene manager's
  // transitions place the player; this only swaps the place.)
  enterStage(which) {
    const stage = typeof which === 'string' ? this.stages.get(which) : which;
    const prev = this.entered;
    if (prev === stage) return stage;
    if (prev) this.vm.scene.remove(prev.fx.flash.vm.mesh);
    // [R3] the old place's own sounds go with it: a train rumbling over the
    // block as the chapter changed droned on through room 304 and the
    // gunfight (its train no longer stepped, nothing let its loop go), and a
    // shot hydrant would hiss on in the next place
    if (prev && this.sfx) { this.sfx.train(0); if (this.sfx.loops && this.sfx.loops.has('hydrant')) this.sfx.stopLoop('hydrant'); }
    this.world = stage;
    this.entered = stage;
    stage.bind(this);
    this.controller.world = stage;
    this.vm.world = stage;
    // the player's flash sprites are drawn with the gun (its own scene)
    this.vm.scene.add(stage.fx.flash.vm.mesh);
    stage.fx.flash.camera = this.camera;
    stage.fx.explosions.onTick = (p, k) => this.sfx.debris(p, k);
    stage.fx.casings.onTick = (p, n) => this.sfx.casing(p, n);
    if (stage.train) {
      stage.train.onRumble = (k, pos) => this.sfx.train(k, pos);
      stage.train.onSqueal = (k, pos) => this.sfx.squeal(k, pos);
    }
    // footfalls: a ripple on the wet street (near the eye: a far one is
    // invisible and would take one of the street's few impact slots) and a
    // footstep sound
    const camera = this.camera;
    stage.hoods.onStep = (h, x, z, run) => {
      const d = Math.hypot(x - camera.position.x, z - camera.position.z);
      if (d < 28 && x > -6.0 && x < 17) stage.street.addImpact(stage, x, z, run ? 0.45 : 0.3);
      if (d < 35) this.sfx.step(new THREE.Vector3(x, 0, z), run, false);
    };
    // the render's per-stage inputs: the rain's dry volumes and the lamps
    // whose heads leave a sheen (lane 1's adapters read __noir until this)
    this.pipeline.setDry?.(stage.dry);
    this.pipeline.setLamps?.(stage.lamps ?? null);
    this.emit('stage:enter', { name: stage.name });
    return stage;
  }

  // the Hoods and the cast's other figures (the shadow maps follow them)
  shadowFigures() {
    const H = this.stage.hoods.list, F = this.stage.cast.figures();
    return F.length ? H.concat(F) : H;
  }

  // the current stage (CONTRACTS §2.1; `world` is its old name)
  get stage() { return this.world; }
  get cast() { return this.world.cast; }
  get glass() { return this.world.glass; }
  get breakables() { return this.world.breakables; }

  // ---- input edges (one fixed step) ----------------------------------------------
  pressed(code) { return this.keysDown.has(code) || this.vin.down.has(code); }
  released(code) { return this.keysUp.has(code) || this.vin.up.has(code); }
  held(code) { return this.controller.keys.has(code) || this.vin.held.has(code); }

  // a world point on the screen, in CSS pixels ({ x, y }), or null behind
  screenOf(p) {
    if (!p) return null;
    const v = this._scr || (this._scr = new THREE.Vector3());
    v.copy(p).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight };
  }
  // the place's own systems: the current stage's
  get fx() { return this.world.fx; }
  get rays() { return this.world.rays; }
  get nav() { return this.world.nav; }
  get covers() { return this.world.covers; }
  get react() { return this.world.react; }
  get hoods() { return this.world.hoods; }

  // events across the lanes (CONTRACTS §2.1): on(name, fn) / off / emit
  on(name, fn) {
    const E = this._events || (this._events = new Map());
    if (!E.has(name)) E.set(name, []);
    E.get(name).push(fn);
    return fn;
  }
  off(name, fn) {
    const L = this._events && this._events.get(name);
    if (L && L.includes(fn)) L.splice(L.indexOf(fn), 1);
  }
  emit(name, data) {
    const L = this._events && this._events.get(name);
    if (L) for (const fn of [...L]) fn(data);
  }

  // Build every Hood variant's geometry (2 LODs, ~20 ms each) and compile
  // the combat programs up front, so a fight's first spawns and the first
  // blood / flash / decal never hitch the frame.
  prewarm(renderer) {
    const t0 = performance.now();
    const H = this.world.hoods, tmp = [];
    let i = 0;
    for (const coat of [0, 1, 2]) for (const brim of [0, 1]) for (const heavy of [false, true]) {
      tmp.push(H.spawn([-8.5, 26 + (i++) * 0.02], { coat, brim, tall: 1, heavy }, {}));
    }
    // effects with one live instance each, so their programs compile too
    const p = new THREE.Vector3(-8.5, 1, 26);
    const F = this.fx;
    const systems = [F.blood, F.chips, F.sparks, F.railSparks, F.splash, F.dust, F.flash.vm, F.flash.refl, F.flash.world3, F.flash.smoke, F.fire, F.smoke, F.debris];
    for (const sys of systems) sys.spawn({ pos: p, life: 0.01 });
    for (const sys of systems) sys.write();
    F.decals.ink(p, new THREE.Vector3(0, 1, 0));
    F.decals.crack(p, new THREE.Vector3(0, 1, 0));
    F.casings.eject(p, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
    F.casings.update(0);
    // (Phase 3a: the wreck's char materials and a dead lamp's disc, so the
    // first explosion / shot-out lamp never hitches on a shader compile)
    const M = this.world.M, warm = [];
    for (const m of [M.wreck, M.wreckMetal, M.bulbDead]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), m);
      w.position.copy(p);
      this.world.scene.add(w);
      warm.push(w);
    }
    this.world.scene.updateMatrixWorld(true);
    renderer.compile(this.world.scene, this.camera);
    for (const w of warm) this.world.scene.remove(w);
    renderer.compile(this.vm.scene, this.vm.cam);
    for (const h of tmp) H.remove(h);
    F.clear();
    this.prewarmMs = performance.now() - t0;
  }

  // (vmWanted: what the title card gives back when play begins)
  setViewmodelVisible(v) {
    this.vmWanted = v;
    // (never on the title card: the street alone behind the lettering)
    const on = v && this.state !== 'title';
    this.vm.visible = on; this.pipeline.vm.visible = on;
  }

  // The title card's camera (lane 7): the diner from across the street in
  // the rain, the eye 1.6 m up on the far pavement, drifting slowly from
  // (2.5, 9.5) toward (1.5, 7.5) and back (an eased swing of 70 s), the
  // gaze held on the diner's door (a little above it: the lit bays and the
  // fascia in the middle band, the dark stone above for the lettering, the
  // wet street below for the choices). A pure function of time (shot=title
  // renders it at t=).
  titleDrift(t) {
    const u = 0.5 - 0.5 * Math.cos((t / 70) * Math.PI * 2);
    const x = 2.5 - 1.0 * u, z = 9.5 - 2.0 * u;
    const tx = -10.2, ty = 1.95, tz = 0.6;
    const yaw = Math.atan2(-(tx - x), -(tz - z));
    const pitch = Math.atan2(ty - 1.6, Math.hypot(tx - x, tz - z));
    this.controller.setPose(x, z, yaw, pitch, 1.6 - 1.63);
  }

  // shot=end / an ended battle: THE END over whatever is on the street
  endGame() {
    this.autopilot = null;
    this.controller.auto = null;
    this.state = 'dead';
    this.weapon.trigger = false;
    this.controller.frozen = true;
    // (a dead man's gun is not at the shoulder: it drops out of the frame)
    this.vm.lowerTo(1);
    this.hud.showEnd({ kind: 'end' });
  }

  // the end of the slice: To be continued (scenes.next() past the last
  // scene of the story's order that has a file)
  endSlice() {
    this.state = 'end';
    this.controller.frozen = true;
    this.hud.clearPrompt();
    this.hud.showEnd({ kind: 'cont' });
    this.save.write();
    if (!this.shotMode && document.pointerLockElement) document.exitPointerLock();
  }

  // in play and in the fight: the gun works, the Hoods' rounds can hit
  // (legacyWaves' lull safes them)
  get live() { return this.state === 'playing' && !this.director.lull && !this.failing; }

  // ---- lifecycle ---------------------------------------------------------------
  // the title leads into the story's first scene: the diner (a fade from
  // black and the chapter card)
  // from: a save ({ scene, beat, flags, inventory }) to continue from, or
  // main.js's ?start=<id>[.<beat>] ({ scene, beat }: no flags, no inventory)
  // [C1] BEGIN (from null) plays the opening stills first, over black, then
  // the diner comes up out of the black under its card; not a CONTINUE, not a
  // chapter picked, not ?start= (opts.stills false skips them too)
  start(from = null, { stills = true } = {}) {
    if (this.state !== 'title') return;
    this.state = 'playing';
    this.controller.frozen = false;
    this.hud.hideTitle();
    this.setViewmodelVisible(this.vmWanted);
    // [R3] a night begun from the title starts clean: the marks an earlier
    // one left on the place the title stands in (after THE END, scene 9's
    // blood and bullet holes all over the block) go
    this.fx.clear();
    // [C1] (what played over the last night's end goes with it)
    if (this.music.current) this.music.stop(1.2);
    this.failCounts.clear();
    if (!from && stills && this.stills.has('opening')) {
      this.save.flags = {};
      this.save.inventory = [];
      this.scenes.setFade(1);
      this.stills.play('opening', { onDone: () => {
        if (this.state !== 'playing' || this.scenes.current) return;
        this.scenes.go('diner', { fade: 'black', card: true, fadeIn: 2.5 });
      } });
      return;
    }
    if (from && from.scene && this.scenes.get(from.scene)) {
      this.save.flags = { ...(from.flags || {}) };
      this.save.inventory = [...(from.inventory || [])];
      const def = this.scenes.get(from.scene);
      const beat = def.beats.includes(from.beat) ? from.beat : def.beats[0];
      this.scenes.go(from.scene, { beat, fade: 'black', card: true, fadeIn: 1.6 });
    } else {
      this.save.flags = {};
      this.save.inventory = [];
      // (scene 1 fades in from black over 2.5 s under its chapter card)
      this.scenes.go('diner', { fade: 'black', card: true, fadeIn: 2.5 });
    }
  }

  // back to the title card (after the slice's end card): the diner across
  // the street, CONTINUE offered
  toTitle() {
    // [C1] (the end's music, or any, does not play on over the title)
    if (this.music.current) this.music.stop(2);
    if (this.stills.active) this.stills.finish(true);
    this.failing = null; this.crawl = 1; this.hud.setFailing(false); this.hud.kit.failLine(null);
    this.scenes.stop();
    this.brawl.stop();
    this.brawl.finished = false;
    this.director.stop();
    this.hud.hideEnd();
    this.hud.clearPrompt();
    this.health.reset();
    this.controller.frozen = false;
    this.state = 'title';
    this.setViewmodelVisible(this.vmWanted);
    this.titleT0 = this.time;
    this.hud.showTitle('', { canContinue: this.save.exists });
  }

  enableAutopilot() { this.autopilot = new Autopilot(this); }

  // the real-time loop runs at k x for `seconds` of game time (the last blow)
  slowmo(k, seconds) { this.timeScale = k; this.slowT = seconds; }

  onPlayerDeath() {
    this.counters.deaths++;
    this.emit('player:down', {});
    // (in a fist fight going down is not the end: the brawl puts him back
    // on his feet at the start of the round)
    if (this.brawl.active) { this.health.dead = false; this.brawl.playerDown(); return; }
    // (the battle preset's warm-up: the autopilot holds its fire while the
    // Hoods walk in, so it is not killed there either)
    if (this.autopilot || this.inWarmup) {
      // the battle preset keeps fighting: back on his feet at once
      this.health.reset();
      this.health.hp = 60;
      return;
    }
    // [C1] in the story, going down is the chapter's fail: a short fall,
    // black, the scene's own words, back at its checkpoint (seams/Z.md §3)
    const S = this.scenes;
    if (S.current && this.state === 'playing' && !this.shotMode) {
      const def = S.current;
      let spec = typeof def.onDown === 'function' ? def.onDown(S.ctx) : def.onDown;
      if (!spec && this.checkpoint) spec = { why: this.checkpoint.why, to: this.checkpoint.beat };
      this.fail({ why: 'Down.', to: S.beat, fall: true, ...(spec || {}) });
      return;
    }
    this.state = 'dead';
    this.weapon.trigger = false;
    this.controller.frozen = true;
    this.vm.lowerTo(1);
    this.hud.showEnd({ kind: 'end' });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  restart() {
    for (const h of [...this.world.hoods.list]) this.removeHood(h);
    this.corpses.length = 0;
    this.pending.length = 0;
    this.director.stop();
    this.fx.clear();
    this.health.reset();
    this.weapon.reset();
    for (const k of Object.keys(this.counters)) this.counters[k] = 0;
    this.controller.frozen = false;
    this.vm.lowerTo(0, true);
    this.hud.hideEnd();
    this.state = 'playing';
    // (back into the scene at its beat; with none, where play has always begun)
    const S = this.scenes;
    if (S.current) S.go(S.current.id, { beat: S.beat, fade: 'black', card: false });
    else this.controller.setPose(-7.3, 6.2, -0.2, 0.02);
  }

  // ---- [C1] the fail: the one way a chapter loses (docs/story/seams/Z.md §3) -------
  // game.fail({ why, to, fall, keepWorld, hold })
  //   why        a few words on the black ('Lost him.', 'They saw you.')
  //   to         the beat to go back to (default: the current one); the world
  //              as that beat's setup makes it
  //   fall       the short fall of a man shot (0.9 s: the eye sinks and tips),
  //              else a hard stop (the frame holds and goes to black)
  //   keepWorld  the scene keeps its own Hoods, shots in flight and marks (its
  //              setup sets them); by default they go with the black
  //   hold       seconds of the words on the black (default 1.3)
  // Under ten seconds from the fail to control (a fall about 3.3 s, a stop
  // 2.4 s). Counted per beat: game.fails(beat). Health reaching zero calls it
  // with the scene's onDown, else game.setCheckpoint's, else 'Down.'.
  fail({ why = '', to = null, fall = false, keepWorld = false, hold = 1.3 } = {}) {
    const S = this.scenes;
    if (this.failing || this.shotMode || !S.current) return false;
    const def = S.current;
    const beat = to && def.beats.includes(to) ? to : S.beat;
    if (to && !def.beats.includes(to)) console.warn(`game.fail: '${def.id}' has no beat '${to}' (back to '${S.beat}')`);
    const key = def.id + ':' + S.beat;
    this.failCounts.set(key, (this.failCounts.get(key) || 0) + 1);
    this.counters.fails = (this.counters.fails || 0) + 1;
    // (was the player warned, and how long before: the proofs read it)
    const K0 = this.hud.kit;
    const warnedFor = K0.warnText ? +(this.time - (K0.warnAt ?? this.time)).toFixed(2) : null;
    this.lastFail = { why, to: beat, from: S.beat, scene: def.id, fall, warnedFor, t: this.time };
    this.failing = { why, to: beat, fall, keepWorld, hold, t: 0, phase: fall ? 'fall' : 'stop', from: S.beat, id: def.id };
    S.trans = null;
    this.controller.frozen = true;
    this.weapon.trigger = false;
    this.vm.lowerTo(1);
    this.hud.clearPrompt();
    this.hud.kit.clearWarn();
    this.hud.kit.dismissTeach();
    this.crawl = 1;
    if (fall) {
      // (lifted from scenes 5 and 9: the eye sinks to the floor and tips)
      const C = this.controller, P = C.eyePose();
      this.failing.pose = P;
      C.setMode('cutscene', { track: (t) => {
        const u = Math.min(1, t / 0.9), e = u * u;
        return { x: P.x, y: P.y + (0.35 - P.y) * e, z: P.z, yaw: P.yaw + 0.3 * e, pitch: P.pitch + (0.5 - P.pitch) * e };
      } });
      this.sfx.play('grunt', null, { f0: 80, k: 0.5, dur: 0.3 }, { send: false });
      this.sfx.play('f_bodyFloor', this.eye);
    } else {
      // (the hard stop: the world holds where it is)
      this.crawl = 0;
    }
    this.sfx.play('kit_fail', null, {}, { send: false });
    this.emit('fail', { why, to: beat, from: S.beat, scene: def.id });
    return true;
  }
  // how often the player has failed a beat of this scene (default: the current)
  fails(beatName = null, sceneId = null) {
    const S = this.scenes;
    const id = sceneId || (S.current && S.current.id);
    return this.failCounts.get(id + ':' + (beatName || S.beat)) || 0;
  }
  // where health reaching zero sends the player in this scene, and the words
  setCheckpoint(beatName, why = 'Down.') { this.checkpoint = { beat: beatName, why }; }
  // (a scene other than the last: its counts and checkpoint start afresh)
  kitReset() { this.failCounts.clear(); this.checkpoint = null; }

  // [C1] the warning before going down (WAVE_C §1 rule 2, seams/Z.md §3): in
  // the story, outside a fist fight, health falling under LOW.on with a hit in
  // the last second puts up the scene's `lowWarn` (a string or (ctx) => string)
  // or 'You’re hit. Get to cover.'; it goes as health mends past LOW.off, or
  // with the fail. It is the kit's own line under the scene's: a scene's
  // warning shows over it while the scene has one (hud.kit.low). Per step.
  inStory() { const S = this.scenes; return !!S.current && this.state === 'playing' && !this.shotMode && !this.failing && !this.brawl.active && !this.autopilot && !this.inWarmup; }
  lowStep() {
    const K = this.hud.kit, H = this.health;
    if (!this.inStory()) { if (this.lowWarn) { K.low(null); this.lowWarn = null; } return; }
    const hurt = this.lowWarn ? H.hp < LOW.off : H.hp < LOW.on && H.sinceHit < 1.0;
    if (hurt && !this.lowWarn) {
      const def = this.scenes.current;
      const w = typeof def.lowWarn === 'function' ? def.lowWarn(this.scenes.ctx) : def.lowWarn;
      this.lowWarn = w || 'You’re hit. Get to cover.';
      K.low(this.lowWarn);
    } else if (!hurt && this.lowWarn) { K.low(null); this.lowWarn = null; }
  }
  // the hit that would take the last of health is spared (it leaves one)
  // while no warning has been up a second yet: nobody goes down unwarned
  spareLast() {
    if (!this.inStory()) return false;
    const K = this.hud.kit;
    return !(K.warnText && this.time - (K.warnAt ?? this.time) >= LOW.read);
  }

  // the fail's timeline, per rendered frame in real time (the game may be
  // held still under it): the fall, the black, the words, up again
  failUpdate(dt) {
    const F = this.failing;
    if (!F) return;
    const S = this.scenes, K = this.hud.kit;
    F.t += dt;
    if (F.phase === 'fall' || F.phase === 'stop') {
      const t0 = F.phase === 'fall' ? 0.9 : 0.12, dur = F.phase === 'fall' ? 0.3 : 0.28;
      const u = Math.max(0, Math.min(1, (F.t - t0) / dur));
      S.setFade(Math.max(S.fadeK, u));
      if (u >= 1) {
        // black: the world as the beat's setup has it, under the black
        F.phase = 'black'; F.t = 0;
        this.crawl = 0;
        this.hud.setFailing(true);
        // [C3] (the warning of the try that failed goes with the black, at
        // once: its 0.4 s fade ran on game time, held under the black, and
        // lettered it again over the checkpoint as the scene came up)
        K.clearWarn({ now: true });
        K.failLine(F.why);
        const def = S.current;
        if (!F.keepWorld) {
          for (const h of [...this.world.hoods.list]) this.removeHood(h);
          this.corpses.length = 0;
          this.pending.length = 0;
          this.director.stop();
          this.fx.clear();
        }
        if (this.brawl.active) this.brawl.stop();
        this.health.reset();
        this.vm.lowerTo(0, true);
        // (up off the floor: where he stood, for a setup that does not place him)
        const C = this.controller;
        if (F.pose && C.mode === 'cutscene') C.setPose(F.pose.x, F.pose.z, F.pose.yaw, 0, F.pose.y - 1.63);
        this.controller.frozen = false;
        if (this.sfx.hush) this.sfx.hush(0.4);
        if (def) S.enter(def, { beat: F.to, card: false });
        // (the scene's setup may have frozen him again for its own reasons)
        S.setFade(1);
      }
    } else if (F.phase === 'black') {
      K.failK(Math.min(1, F.t / 0.25) * Math.min(1, Math.max(0, (F.hold + 0.25 - F.t) / 0.3)));
      if (F.t >= F.hold + 0.25) { F.phase = 'up'; F.t = 0; this.crawl = 1; K.failLine(null); this.hud.setFailing(false); }
    } else if (F.phase === 'up') {
      const u = Math.min(1, F.t / 0.7);
      S.setFade(1 - u * u * (3 - 2 * u));
      if (u >= 1) { this.failing = null; S.setFade(0); this.emit('fail:back', { scene: F.id, beat: F.to }); }
    }
  }

  // ---- Hoods -------------------------------------------------------------------
  // (a scene's gunman: brain 'cover' | 'none' | a brain file's, hp, and the
  // direction entry / run / post / leash / wake / aim: enemies/HoodBrains.js)
  spawnHood(x, z, { heavy = false, vanguard = false, variant = null, yaw = null, state = null, ai = true, brain = 'cover', hp = null, ...direct } = {}) {
    const W = this.world;
    const seed = 101 + this.counters.spawned * 13;
    const v = variant || { ...hoodSeedVariant(seed), heavy };
    const p = this.camera.position;
    const h = W.hoods.spawn([x, z], v, { yaw: yaw ?? Math.atan2(p.x - x, p.z - z), state: state || 'idle' });
    h.hp = hp ?? (heavy ? GAME.heavyHp : GAME.hoodHp);
    h.heavy = heavy;
    this.counters.spawned++;
    const B = ai ? makeBrain(this, h, brain, { heavy, vanguard, ...direct }) : null;
    if (B) this.ais.set(h, B);
    return h;
  }

  removeHood(h) {
    const ai = this.ais.get(h);
    if (ai) ai.release();
    this.ais.delete(h);
    h.onMove = null;
    this.world.hoods.remove(h);
    this.fx.flash.last.hoods.delete(h);
  }

  // the player's bullet hit a Hood
  damageHood(h, dmg, dir, { head = false, time = this.time } = {}) {
    if (!h.alive) return;
    h.hp -= dmg;
    // (hoodsHold: the seeded perf scenario - a hit bleeds and flinches, but
    // nobody falls, so the Hood count stays fixed through the measurement)
    if (this.hoodsHold) h.hp = Math.max(1, h.hp);
    const ai = this.ais.get(h);
    if (h.hp <= 0) {
      this.killHood(h, dir, head);
      return;
    }
    h.flinch(dir);
    this.sfx.grunt(h.pos.clone().setY(h.pos.y + 1.5));
    // a heavy torso hit can knock a standing man back a step
    // [C2] (not a gun kit's pistol man or Tommy gunner: his brain takes the hit - the flinch, his aim
    // spoiled - a stagger in three hits would win the exchange for a man standing in the open; the
    // heavy staggers as ever (the brief's); the rng is drawn as before)
    const stag = !head && dmg >= WEAPON.dmgTorso && this.rng.chance(0.3) && (h.state === 'idle' || h.state === 'aim') && !(ai && ai.brain && ai.brain.kind && ai.brain.kind !== 'rusher');
    if (stag) h.stagger();
    if (ai) ai.onHit(dir, stag);
  }

  killHood(h, dir, head, forceKind = null) {
    const r = this.rng;
    let kind;
    if (forceKind) kind = forceKind;
    else if (head) kind = r.chance(0.6) ? 'deathBack' : 'deathSpin';
    else {
      const x = r.next();
      kind = x < 0.45 ? 'deathBack' : x < 0.75 ? 'deathKnees' : 'deathSpin';
    }
    // fall away from the shot: turn him so the shot comes from his front
    // (deathBack / deathKnees) or side (deathSpin), within limits
    const from = Math.atan2(-dir.x, -dir.z);
    let d = from - h.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    h.yaw += Math.max(-0.25, Math.min(0.25, d * 0.3));
    // [C2] a brain may pick the fall by what is beside him (the gun kit's:
    // a slump down a wall, over his cover, in a doorway - src/guns/deaths.js)
    const ai0 = this.ais.get(h);
    const pick = ai0 && ai0.brain && ai0.brain.deathKind ? ai0.brain.deathKind(dir, head, kind) : null;
    if (pick) { kind = pick.kind; if (pick.yaw != null) h.yaw = pick.yaw; }
    h.die(kind);
    // (a head shot drops him without a sound)
    if (!head) this.sfx.death(h.pos.clone().setY(h.pos.y + 1.5));
    // head shot: the hat flies at once
    if (head && h._deathT >= 0) h._deathT = Math.max(h._deathT, HAT_OFF[kind] ?? 0);
    this.counters.kills++;
    const ai = this.ais.get(h);
    if (ai) ai.release();
    this.ais.delete(h);
    h.onMove = null;
    // the corpse no longer blocks anyone
    const cs = this.world.colliders.circles, i = cs.indexOf(h.collider);
    if (i >= 0) cs.splice(i, 1);
    this.fx.bloodFx.pool(h, kind === 'deathKnees' ? 1.25 : 0.95);
    this.corpses.push(h);
    if (pick) this.emit('hood:down', { hood: h, kind, dir, head, pick });   // [C2]
    while (this.corpses.length > GAME.corpseCap) this.removeHood(this.corpses.shift());
  }

  // a Hood pulls the trigger: flash + light now, the bullet lands a moment later
  hoodFire(ai, time) {
    const h = ai.h, G = this, r = this.rng;
    const muzzle = h.fire();
    if (!muzzle) return;
    const eye = this.eye;
    const dir = new THREE.Vector3().subVectors(eye, muzzle).normalize();
    this.fx.flash.hood(h, muzzle, dir, time, ai.heavy);
    if (ai.heavy) this.sfx.play('tommy', muzzle, { pitch: 0.92 }, { ref: 4, delay: Math.min(0.25, muzzle.distanceTo(eye) / 343) });
    else this.sfx.pistol(muzzle, muzzle.distanceTo(eye));
    this.counters.hoodShots++;
    this.lastHoodShot.set(h, time);
    this.pacing.shot(time);
    const dist = muzzle.distanceTo(eye);
    const moving = this.controller.vel.length() > 1.2;
    // (Phase 3a: the Hoods open fire from ~25 m within seconds, so a pistol
    // at range is a warning shot more than a threat)
    let p = Math.max(0.05, Math.min(0.5, 0.52 - dist * 0.017));
    if (moving) p *= 0.65;
    if (ai.heavy) p *= 0.55;
    if (ai.aim != null) p = Math.min(1, p * ai.aim);
    if (!this.live) p = 0;
    const hit = r.chance(p);
    this.pending.push({ t: time + 0.07 + dist / 400, from: muzzle.clone(), hit, dmg: r.int(8, 14), ai });
  }

  resolveShot(s) {
    const eye = this.eye;
    if (s.hit) {
      // still in the line of fire?
      const dir = new THREE.Vector3().subVectors(eye, s.from);
      const d = dir.length(); dir.divideScalar(d);
      if (!this.rays.raycast(s.from, dir, d - 0.4, { anyHit: true })) {
        this.health.damage(s.dmg);
        this.emit('player:hit', { dmg: s.dmg, dir });
        this.sfx.play('grunt', null, { f0: 88, k: 0.35, dur: 0.14 }, { send: false });
        this.counters.hoodHits++;
        this.counters.damageTaken += s.dmg;
        return;
      }
    }
    // a miss cracks past him into the street or the wall beside him
    const r = this.rng;
    const aim = eye.clone().add(new THREE.Vector3(r.gauss() * 1.1, r.range(-1.4, 0.5), r.gauss() * 1.1));
    const dir = aim.sub(s.from).normalize();
    const hit = this.rays.raycast(s.from, dir, 90);
    if (hit) this.react.bullet(hit, dir, { weak: true });
  }

  // ---- the reactive world (world/Cars.js, fx/React.js) --------------------------
  onCarSmoking(car) {
    this.react.hazards.push({ car, pos: car.pos.clone(), r: 7.5, kind: 'smoke' });
    this.sfx.hiss(car.pos);
  }

  onCarExploded(car, at) {
    this.counters.explosions++;
    this.emit('car:exploded', { car, at });
    this.sfx.explosion(at);
    this.controller.shake(0.9, at.distanceTo(this.camera.position));
    // Hoods within ~5 m die, flung away from it; within ~9 m they flinch
    for (const h of [...this.world.hoods.list]) {
      if (!h.alive) continue;
      const d = Math.hypot(h.pos.x - at.x, h.pos.z - at.z);
      const away = new THREE.Vector3(h.pos.x - at.x, 0.2, h.pos.z - at.z).normalize();
      if (d < 5.2 && !this.hoodsHold) {
        this.fx.bloodFx.hit(new THREE.Vector3().setFromMatrixPosition(h.bones.chest.matrixWorld), away, { strength: 1.2, rays: this.rays });
        this.killHood(h, away, false, this.rng.chance(0.5) ? 'deathBack' : 'deathSpin');
        this.counters.blastKills++;
      } else if (d < 9) {
        h.flinch(away);
        const ai = this.ais.get(h);
        if (ai) ai.onHit(away, true);
      }
    }
    // the player within ~8 m
    const p = this.eye;
    const dp = Math.hypot(p.x - at.x, p.z - at.z);
    if (dp < 8 && this.live) {
      const dmg = Math.round(8 + 62 * Math.pow(1 - dp / 8, 1.3));
      this.health.damage(dmg);
      this.counters.blastDamage += dmg;
    }
  }

  // ---- per step ------------------------------------------------------------------
  pre(dt, t) {
    this.time = t;
    this.bodies.update();   // [C2] (the circles follow their owners; none: nothing)
    for (const f of this.scripts) f(t, dt);
    const C = this.controller;
    if (this.autopilot && this.state !== 'dead') this.autopilot.update(dt);
    // (?autoplay=1: the story played by its own driver, through game.vin)
    if (this.autoplay) this.autoplay.update(dt);
    // (the fist fight's input acts on the step it arrives: before the
    // controller moves the eye and before the hands pose - FIGHT.md v3 §9)
    if (this.brawl.active) this.brawl.inputStep(dt);
    if (this.state === 'title') this.titleDrift(t - (this.titleT0 || 0));
    else if (!this.shotMode || this.autopilot) C.update(dt);
    else C.apply(dt);
    this.eye.copy(this.camera.position);
    this.camera.updateMatrixWorld();
    this.vm.update(dt, C);
    this.vm.sync(this.camera);
    this.hands.update(dt);
    // the weapon in hand (player/Weapons.js): the mouse button, then its
    // step (the Tommy gun fires only while it is the set in hand)
    this.weapons.step(dt, t);
    for (const ai of this.ais.values()) ai.update(dt, t);
  }

  // ([C4] wdt: the world's step - dt but under the fight's dodge cue, worldK)
  post(dt, t, wdt = dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].t <= t) { const s = this.pending[i]; this.pending.splice(i, 1); this.resolveShot(s); }
    }
    this.react.update(dt, t);
    this.fx.update(wdt, t);
    // the train and the storm: in play (and the battle preset); a crossing
    // never starts in a fight's first seconds, and a train still out there
    // when a fight's last man falls hurries away
    const W = this.world, D = this.director;
    if (this.ambient || W.train.active) {
      const age = t - D.startT;
      // (no new crossing once a fight is down to its last two men: a 27 s
      // crossing would still be on the el long after it)
      const ending = this.live && D.active && D.done && this.counters.alive <= 2;
      const lastDown = ending && this.counters.alive === 0;
      W.train.update(dt, t, {
        canStart: this.ambient && this.live && age > 4 && !ending,
        camera: this.camera, hurry: lastDown || D.lull,
      });
    }
    // (never in a fight's first 5 s: the first volley owns that moment)
    if (this.ambient) this.storm.update(dt, t, { quiet: this.live && D.active && t - D.startT < 5 });
    else this.storm.update(dt, t, { quiet: true });
    this.pipeline.rainBoost = this.storm.rainBoost;
    // the lit rain streaks: brighter everywhere while the sky flashes
    const rm = W.rain.rainMat.uniforms;
    rm.uBase.value = 0.03 * (1 + 5 * this.storm.rainBoost);
    this.health.update(dt);
    this.lowStep();
    const alive = this.world.hoods.list.reduce((n, h) => n + (h.alive ? 1 : 0), 0);
    this.counters.alive = alive;
    this.director.update(dt, t);
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.timeScale = 1; }
    this.brawl.update(dt, wdt);
    // the story: the scene's script, the prompts, the hands' inspection,
    // the puzzle; the sound of the room the eye is in
    this.scenes.update(wdt, t);
    this.interact.update(dt);
    this.inspect.update(dt);
    this.puzzles.update(dt);
    this.hud.tick(dt);
    const room = this.stage.lookAt(this.eye).room;
    if (room !== this._room) { this._room = room; this.sfx.room(room); }
    // (this step's input edges are spent)
    this.keysDown.clear(); this.keysUp.clear();
    this.vin.down.clear(); this.vin.up.clear();
    const MA = this._mouseAcc, MO = this.mouse;
    MO.dx = MA.dx; MO.dy = MA.dy; MO.wheel = MA.wheel;
    MA.dx = 0; MA.dy = 0; MA.wheel = 0;
    this.counters.bursts = this.fx.bloodFx.bursts;
    this.counters.impacts = this.fx.impacts.count;
    this.counters.decals = this.fx.decals.total;
    this.counters.casings = this.fx.casings.list.length;
  }

  // staged shots: the Tommy gun fires one round at a point (no spread)
  scriptedShot(point, time) {
    const W = this.weapon;
    const pitch = this.controller.pitch, yaw = this.controller.yaw;
    const d = new THREE.Vector3().subVectors(point, this.camera.position).normalize();
    W.fire(time, d);
    // keep the staged composition (no recoil climb)
    this.controller.pitch = pitch; this.controller.yaw = yaw;
  }
  // staged shots: a Hood fires (flash + light, no bullet)
  stagedHoodFire(h, time) {
    const muzzle = h.fire();
    if (!muzzle) return;
    const dir = new THREE.Vector3().subVectors(this.eye, muzzle).normalize();
    this.fx.flash.hood(h, muzzle, dir, time, !!h.heavy);
    this.counters.hoodShots++;
  }

  // shot mode: freeze the latest flashes into the frame
  holdFlashes(window = 0.5) {
    this.camera.updateMatrixWorld();
    this.vm.sync(this.camera);
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(this.camera.matrixWorld);
    const vmNow = { vmPos: this.vm.vmWorld(MUZZLE), worldPos: this.vm.reproject(MUZZLE, 0.9, this.camera), fwd, gunFwd: this.vm.forward() };
    this.fx.flash.holdRecent(this.time, window ?? 0.5, vmNow);
  }

  // HUD refresh (per rendered frame)
  hudUpdate(dt) {
    if (!this.hud.visible) return;
    this.hud.update({
      ammo: this.weapon.ammo, drum: WEAPON.drum,
      reloading: this.weapon.reloading, hp: this.health.hp, spread: this.weapon.spread, dt,
      gun: this.hands.set === 'tommy', fight: this.director.active || this.brawl.active || this.controller.mode === 'brawl',
    });
  }

  // input (pointer-locked play)
  bindInput(dom) {
    const locked = () => document.pointerLockElement === dom;
    const C = this.controller;
    dom.addEventListener('mousedown', (e) => {
      if (!locked()) return;
      this.keysDown.add('Mouse' + e.button); C.keys.add('Mouse' + e.button);
      if (e.button === 0 && this.state === 'playing' && this.hands.set === 'tommy' && !this.inspect.active && !this.puzzles.active) this.weapon.trigger = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.weapon.trigger = false; this.keysUp.add('Mouse' + e.button); C.keys.delete('Mouse' + e.button); });
    // (round 2: the right button is my right arm; no menu comes up over the fight)
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => { if (locked()) { this._mouseAcc.dx += e.movementX || 0; this._mouseAcc.dy += e.movementY || 0; } });
    addEventListener('wheel', (e) => { if (locked()) this._mouseAcc.wheel += e.deltaY; }, { passive: true });
    addEventListener('keyup', (e) => { this.keysUp.add(e.code); });
    addEventListener('keydown', (e) => {
      if (!locked()) return;
      // [R3] Tab has no use in the game, and the page has nothing to focus: the browser sends the focus out of the
      // page to its own bar, the pointer lock goes with it and the game stands behind the pause card
      if (e.code === 'Tab') e.preventDefault();
      if (!e.repeat) this.keysDown.add(e.code);
      if (e.code === 'KeyR' && this.hands.set === 'tommy') this.weapon.reload();
      if (e.code === 'KeyM') { this.muted = this.sfx.toggleMute(); this.hud.message(this.muted ? 'sound off' : 'sound on'); }
      if (e.code === 'BracketLeft' || e.code === 'Minus') this.hud.message('volume ' + Math.round(this.sfx.setVolume(this.sfx.volume - 0.1) * 10));
      if (e.code === 'BracketRight' || e.code === 'Equal') this.hud.message('volume ' + Math.round(this.sfx.setVolume(this.sfx.volume + 0.1) * 10));
    });
    document.addEventListener('pointerlockchange', () => { if (!locked()) this.weapon.trigger = false; });
  }
}

// deterministic variant from a seed (coat, brim, height, cigarette)
function hoodSeedVariant(v) {
  const h = (n) => Math.abs(Math.sin(v * 12.9898 + n * 78.233) * 43758.5453) % 1;
  return { coat: Math.floor(h(1) * 3), brim: Math.floor(h(2) * 2), tall: Math.floor(h(3) * 2), cig: h(4) < 0.35 };
}
export { DEATHS };
