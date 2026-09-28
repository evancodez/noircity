import * as THREE from 'three';
import { RayWorld } from '../util/RayWorld.js';
import { Fx } from '../fx/Fx.js';
import { Viewmodel, MUZZLE } from '../player/Viewmodel.js';
import { Weapon, WEAPON } from '../player/Weapon.js';
import { Health } from '../player/Health.js';
import { NavGrid } from '../enemies/Nav.js';
import { CoverSet, HoodAI } from '../enemies/HoodAI.js';
import { Spawner, waveSize } from '../enemies/Spawner.js';
import { Autopilot } from './Autopilot.js';
import { LAYER } from '../render/layers.js';
import { DEATHS, HAT_OFF } from '../enemies/HoodAnim.js';
import { React } from './React.js';
import { Storm } from '../world/Storm.js';
import { Sfx } from '../audio/Sfx.js';
import { PlayerBody } from '../player/PlayerBody.js';

// The game: the player (Controller + Tommy gun + Health), the Hoods' AI and
// waves, combat resolution (the player's hitscan -> Weapon.js, the Hoods'
// delayed shots here), effects, and the state machine
//   title -> playing <-> intermission (8 s, "WAVE n" card) -> dead ("THE END")
// One fixed step (1/60 s): pre() before world.update (input, the gun, AI
// decisions), post() after it (enemy bullets, effects, waves, HUD).
export const GAME = { intermission: 8, corpseCap: 16, hoodHp: 100, heavyHp: 170 };

export class Game {
  constructor({ world, camera, controller, pipeline, hud, shotMode, wavesOn, sfx = null }) {
    this.world = world;
    this.camera = camera;
    this.controller = controller;
    this.pipeline = pipeline;
    this.hud = hud;
    this.shotMode = shotMode;
    this.wavesOn = wavesOn;
    this.counters = {
      spawned: 0, alive: 0, shots: 0, hits: 0, headshots: 0, kills: 0,
      hoodShots: 0, hoodHits: 0, damageTaken: 0, deaths: 0, wave: 0, bursts: 0, impacts: 0, decals: 0, casings: 0,
      // pacing (Phase 3a preamble #3): the longest stretch of 'playing' time
      // without a Hood shot, and the delay from the last wave start to its
      // first Hood shot
      maxLull: 0, firstVolley: -1,
      // Phase 3a: the world's reactions
      explosions: 0, blastKills: 0, blastDamage: 0, burnTicks: 0, lampsOut: 0, windows: 0, panes: 0, props: 0,
    };
    this.waveStartT = 0;
    this.lastHoodShotT = null;
    const t0 = performance.now();
    this.rays = new RayWorld(world);
    this.nav = new NavGrid(world.colliders);
    this.covers = new CoverSet(world, this.nav);
    this.fx = new Fx(world);
    this.vm = new Viewmodel(world, camera);
    this.weapon = new Weapon(this, this.vm);
    this.health = new Health(hud.root);
    this.health.onDeath = () => this.onPlayerDeath();
    // Phase 3b: the player's own body for the over-the-shoulder camera (V)
    this.body = new PlayerBody(this);
    this.ots = false;
    this.vmWanted = true;
    // the player's eye (the first-person camera's place): what the Hoods
    // shoot at and the combat measures from; over the shoulder the camera
    // itself stands 0.6 m behind it
    this.eye = camera.position.clone();
    this.spawner = new Spawner(this);
    // Phase 3a: sound, and the world's reactions to bullets
    this.sfx = sfx || new Sfx();
    this.react = new React(this);
    world.fxRef = this.fx;
    this.storm = new Storm(world, pipeline);
    this.storm.onThunder = (s, far, dbl) => this.sfx.thunder(s, far, dbl);
    this.explosionsOnTick = null;
    this.fx.explosions.onTick = (p, k) => this.sfx.debris(p, k);
    this.fx.casings.onTick = (p, n) => this.sfx.casing(p, n);
    const T = world.train;
    T.onRumble = (k, pos) => this.sfx.train(k, pos);
    T.onSqueal = (k, pos) => this.sfx.squeal(k, pos);
    // the world's shot-mode clocks run (a train and lightning in a shot are
    // staged explicitly: shot=train, lightning=)
    this.ambient = !shotMode;
    this.initMs = performance.now() - t0;
    this.ais = new Map();
    this.pending = [];        // the Hoods' bullets in flight
    this.corpses = [];
    this.state = shotMode ? 'playing' : 'title';
    this.stateT = 0;
    this.autopilot = null;
    this.muted = false;
    this.rng = world.rng.fork(8080);
    this.time = 0;
    this.scripts = [];        // staged shots: (t, dt) => void, run each step
    this.lastHoodShot = new Map();   // hood -> time of his last shot (autopilot)
    // the viewmodel is drawn by the pipeline's viewmodel pass; every light
    // must also be visible to its camera (three filters lights by layer)
    pipeline.vm = { scene: this.vm.scene, camera: this.vm.cam, frameInv: this.vm.frameInv, visible: true, fxLive: () => this.fx.flash.vm.list.length > 0 };
    // the player's flash sprites are drawn with the gun (its own scene)
    this.vm.scene.add(this.fx.flash.vm.mesh);
    this.fx.flash.camera = camera;
    // pipeline hooks: Hoods beyond 20 m stay out of the planar reflection
    // (it mirrors emitters only: a far man is a speck of occlusion); the Hoods
    // are the only moving shadow casters (a settled corpse is static)
    const reflList = [];
    pipeline.reflHide = (cam) => {
      reflList.length = 0;
      for (const h of world.hoods.list) if (h.object.visible && h.pos.distanceToSquared(cam.position) > 20 * 20) reflList.push(h.object);
      return reflList;
    };
    // footfalls: a ripple on the wet street (near the eye: a far one is
    // invisible and would take one of the street's few impact slots) and a
    // footstep sound
    world.hoods.onStep = (h, x, z, run) => {
      const d = Math.hypot(x - camera.position.x, z - camera.position.z);
      if (d < 28 && x > -6.0 && x < 17) world.street.addImpact(world, x, z, run ? 0.45 : 0.3);
      if (d < 35) this.sfx.step(new THREE.Vector3(x, 0, z), run, false);
    };
    // (the el's iron only: a car's chrome and lamps are emitters in the
    // mirror - its light build moved a column in the wet street)
    pipeline.reflLod = (on) => { world.overpass.reflLod(on); };
    const casters = [];
    pipeline.shadowCasters = () => {
      casters.length = 0;
      if (this.ots) casters.push(this.body.caster());
      for (const h of world.hoods.list) {
        if (!h.object.visible || !h.mesh.castShadow) continue;
        const moving = h.alive || h._deathT < 3.5 || (h.hat && !h.hat.rest);
        casters.push({ id: h.slot + ':' + (h.geoStamp || 0), x: h.pos.x, y: h.pos.y + 1, z: h.pos.z, moving });
      }
      return casters;
    };
  }

  // Build every Hood variant's geometry (2 LODs, ~20 ms each) and compile
  // the combat programs up front, so a wave's first spawns and the first
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
    const systems = [F.blood, F.chips, F.sparks, F.splash, F.dust, F.flash.vm, F.flash.refl, F.flash.world3, F.flash.smoke, F.fire, F.smoke, F.debris];
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
    // (and the player's body and gun, hidden until V)
    const bodyVis = this.body.visible;
    this.body.setVisible(true);
    this.world.scene.updateMatrixWorld(true);
    renderer.compile(this.world.scene, this.camera);
    this.body.setVisible(bodyVis);
    for (const w of warm) this.world.scene.remove(w);
    renderer.compile(this.vm.scene, this.vm.cam);
    for (const h of tmp) H.remove(h);
    F.clear();
    this.prewarmMs = performance.now() - t0;
  }

  // (over the shoulder the viewmodel is always off: vmWanted is what first
  // person gets back)
  setViewmodelVisible(v) {
    this.vmWanted = v;
    // (and never on the title card: the street alone behind the lettering)
    const on = v && !this.ots && this.state !== 'title';
    this.vm.visible = on; this.pipeline.vm.visible = on;
  }

  // The title card's camera (Phase 3b): the street composition, drifting -
  // a slow dolly down the avenue and back, the gaze wandering a little
  // across the lamp and the el - so the live street breathes behind the
  // lettering. A pure function of time (shot=title renders it at t=).
  titleDrift(t) {
    const u = t / 26;
    const s = Math.sin(u * Math.PI * 2), c = Math.cos(u * Math.PI * 1.3);
    this.controller.setPose(-3.8 + 0.5 * c, -8.4 - 1.6 * (0.5 - 0.5 * Math.cos(u * Math.PI * 2)), -0.105 + 0.05 * s, 0.085 + 0.018 * c, 0.07);
  }

  // shot=end / an ended battle: THE END over whatever is on the street
  endGame() {
    this.autopilot = null;
    this.controller.auto = null;
    this.state = 'dead';
    this.stateT = 0;
    this.weapon.trigger = false;
    this.controller.frozen = true;
    // (a dead man's gun is not at the shoulder: it drops out of the frame)
    this.vm.lowerTo(1);
    this.hud.showEnd(this.counters.kills, Math.max(0, this.counters.wave - 1));
  }

  // the over-the-shoulder camera (Phase 3b, V): the body shows, the gun in
  // the hands leaves the frame; first person again: the body is hidden
  setOts(on) {
    this.ots = !!on;
    this.body.setVisible(this.ots);
    this.setViewmodelVisible(this.vmWanted);
    if (this.ots) {
      // (the body's springs start at rest, the barrel on the current aim)
      this.body.settle();
      this.camera.updateMatrixWorld();
      this.body.placeCamera(this.camera);
      this.body.aim();
    }
    return this.ots;
  }

  // the frame the player aims in: the eye (first person: the camera itself;
  // over the shoulder: the eye the boom camera hangs off). Bullets, staged
  // shots and the Hoods' sense of being shot at use it, never the boom.
  get aimRef() { return this.ots ? this.body.eyeObj : this.camera; }

  // ---- lifecycle ---------------------------------------------------------------
  start() {
    if (this.state !== 'title') return;
    this.state = 'playing';
    // off the title's drifting camera, into the player's own boots
    this.controller.setPose(-7.3, 6.2, -0.2, 0.02);
    this.setViewmodelVisible(this.vmWanted);
    this.nextWave();
  }

  nextWave() {
    const n = this.counters.wave + 1;
    this.counters.wave = n;
    if (this.wavesOn) this.spawner.startWave(n);
    this.stateT = 0;
    this.waveStartT = this.time;
    this.waveFirstShot = false;
    this.lastHoodShotT = this.time;
  }

  startBattle({ wave = 1, autopilot = true } = {}) {
    this.state = 'playing';
    this.counters.wave = wave - 1;
    this.wavesOn = true;
    this.nextWave();
    if (autopilot) this.autopilot = new Autopilot(this);
  }

  enableAutopilot() { this.autopilot = new Autopilot(this); }

  onPlayerDeath() {
    this.counters.deaths++;
    // (the battle preset's warm-up: the autopilot holds its fire while the
    // wave walks in, so it is not killed there either)
    if (this.autopilot || this.inWarmup) {
      // the battle preset keeps fighting: back on his feet at once
      this.health.reset();
      this.health.hp = 60;
      return;
    }
    this.state = 'dead';
    this.stateT = 0;
    this.weapon.trigger = false;
    this.controller.frozen = true;
    this.vm.lowerTo(1);
    this.hud.showEnd(this.counters.kills, Math.max(0, this.counters.wave - 1));
    if (document.pointerLockElement) document.exitPointerLock();
  }

  restart() {
    for (const h of [...this.world.hoods.list]) this.removeHood(h);
    this.corpses.length = 0;
    this.pending.length = 0;
    this.fx.clear();
    this.health.reset();
    this.weapon.reset();
    for (const k of Object.keys(this.counters)) this.counters[k] = 0;
    this.controller.frozen = false;
    this.controller.setPose(-7.3, 6.2, -0.2, 0.02);
    this.vm.lowerTo(0, true);
    this.hud.hideEnd();
    this.state = 'playing';
    this.nextWave();
  }

  // ---- Hoods -------------------------------------------------------------------
  spawnHood(x, z, { heavy = false, vanguard = false, variant = null, yaw = null, state = null, ai = true } = {}) {
    const W = this.world;
    const seed = 101 + this.counters.spawned * 13;
    const v = variant || { ...hoodSeedVariant(seed), heavy };
    const p = this.camera.position;
    const h = W.hoods.spawn([x, z], v, { yaw: yaw ?? Math.atan2(p.x - x, p.z - z), state: state || 'idle' });
    h.hp = heavy ? GAME.heavyHp : GAME.hoodHp;
    h.heavy = heavy;
    this.counters.spawned++;
    if (ai) this.ais.set(h, new HoodAI(this, h, { heavy, vanguard }));
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

  // Fire tokens: at most this many Hoods peek / aim / fire at once
  // (HoodAI); `force` (the vanguard, a heavy at point blank) always gets one
  takeFireToken(ai, force = false) {
    const T = this.fireTokens || (this.fireTokens = new Map());
    if (T.has(ai)) return true;
    // (a token held for more than ~7 s is taken back: nobody may block the
    // exchange by getting stuck mid-peek)
    for (const [a, t0] of T) if (this.time - t0 > 7) T.delete(a);
    // TODO(3b balance pass): the 3a pacing fixes (first volley ~3 s, lull
    // < 6 s) raised the autopilot's incoming damage (battle t=90: 426 at the
    // 3a review, 307-735 across 3a-fix runs - the fight is chaotic, one car
    // tactic more or less swings it). Compare damageTaken per minute against
    // the Phase 2 battle counters over several seeds; if it stays high, cap
    // the concurrent shooters at range (> ~20 m) at 2 from wave 5 as well.
    const max = this.counters.wave >= 5 ? 3 : 2;
    if (T.size >= max && !force) return false;
    T.set(ai, this.time);
    return true;
  }
  dropFireToken(ai) { if (this.fireTokens) this.fireTokens.delete(ai); }

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
    const stag = !head && dmg >= WEAPON.dmgTorso && this.rng.chance(0.3) && (h.state === 'idle' || h.state === 'aim');
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
    if (!this.waveFirstShot) {
      this.waveFirstShot = true;
      this.counters.firstVolley = +(time - this.waveStartT).toFixed(2);
      (this.volleys || (this.volleys = [])).push(this.counters.firstVolley);
    }
    this.lastHoodShotT = time;
    const dist = muzzle.distanceTo(eye);
    const moving = this.controller.vel.length() > 1.2;
    // (Phase 3a: the waves now open fire from ~25 m within seconds, so a
    // pistol at range is a warning shot more than a threat)
    let p = Math.max(0.05, Math.min(0.5, 0.52 - dist * 0.017));
    if (moving) p *= 0.65;
    if (ai.heavy) p *= 0.55;
    if (this.state !== 'playing') p = 0;
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
        // (over the shoulder: the body flinches away from the shot)
        if (this.ots) this.body.flinch(dir, Math.min(1.3, s.dmg / 10));
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

  // ---- the reactive world (world/Cars.js, game/React.js) ------------------------
  onCarSmoking(car) {
    this.react.hazards.push({ car, pos: car.pos.clone(), r: 7.5, kind: 'smoke' });
    this.sfx.hiss(car.pos);
  }

  onCarExploded(car, at) {
    this.counters.explosions++;
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
    if (dp < 8 && this.state === 'playing') {
      const dmg = Math.round(8 + 62 * Math.pow(1 - dp / 8, 1.3));
      this.health.damage(dmg);
      if (this.ots) this.body.flinch(new THREE.Vector3(p.x - at.x, 0, p.z - at.z).normalize(), 1.5);
      this.counters.blastDamage += dmg;
    }
  }

  // ---- per step ------------------------------------------------------------------
  pre(dt, t) {
    this.time = t;
    for (const f of this.scripts) f(t, dt);
    const C = this.controller;
    if (this.autopilot && this.state !== 'dead') this.autopilot.update(dt);
    if (this.state === 'title') this.titleDrift(t);
    else if (!this.shotMode || this.autopilot) C.update(dt);
    else C.apply(dt);
    this.eye.copy(this.camera.position);
    // over the shoulder: the camera backs off the eye, the barrel finds the
    // point under the crosshair, the body takes the player's pose
    if (this.ots) {
      this.body.placeCamera(this.camera);
      this.body.aim();
      this.body.update(dt, t);
    }
    this.camera.updateMatrixWorld();
    this.vm.update(dt, C);
    this.vm.sync(this.camera);
    if (this.state === 'playing') this.weapon.update(dt, t);
    else this.weapon.trigger = false;
    for (const ai of this.ais.values()) ai.update(dt, t);
  }

  post(dt, t) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].t <= t) { const s = this.pending[i]; this.pending.splice(i, 1); this.resolveShot(s); }
    }
    this.react.update(dt, t);
    this.fx.update(dt, t);
    // the train and the storm: in play (and the battle preset); a crossing
    // never starts in the intermission or in a wave's first seconds, and a
    // train still out there when the wave's last man falls hurries away
    // before the card comes up
    const W = this.world;
    if (this.ambient || W.train.active) {
      const waveAge = t - this.waveStartT;
      // (no new crossing once the wave is down to its last two men: a 27 s
      // crossing would still be on the el when the card comes up)
      const ending = this.state === 'playing' && this.wavesOn && this.spawner.done && this.counters.alive <= 2;
      const lastDown = ending && this.counters.alive === 0;
      W.train.update(dt, t, {
        canStart: this.ambient && this.state === 'playing' && waveAge > 4 && !ending,
        camera: this.camera, hurry: lastDown || this.state === 'intermission',
      });
    }
    // (never in a wave's first 5 s: the wave card and the first volley own
    // that moment; the intermission and the title may flash)
    if (this.ambient) this.storm.update(dt, t, { quiet: this.state === 'playing' && this.wavesOn && t - this.waveStartT < 5 });
    else this.storm.update(dt, t, { quiet: true });
    this.pipeline.rainBoost = this.storm.rainBoost;
    // the lit rain streaks: brighter everywhere while the sky flashes
    const rm = W.rain.rainMat.uniforms;
    rm.uBase.value = 0.03 * (1 + 5 * this.storm.rainBoost);
    this.health.update(dt);
    this.stateT += dt;
    const alive = this.world.hoods.list.reduce((n, h) => n + (h.alive ? 1 : 0), 0);
    this.counters.alive = alive;
    if (this.state === 'playing' && this.wavesOn) {
      // the lull breaker: ~5 s without a Hood shot while they are out there,
      // the nearest one takes the initiative (HoodAI.press)
      if (this.lastHoodShotT !== null && t - this.lastHoodShotT > 4.5 && t - (this.pressT ?? -9) > 2.5 && this.counters.alive > 0) {
        this.pressT = t;
        let best = null, bd = Infinity;
        for (const ai of this.ais.values()) {
          if (ai.heavy || !ai.h.alive || ai.vanguard || ai.state === 'aim' || ai.state === 'fire' || ai.state === 'peek') continue;
          const d = ai.distToPlayer();
          if (d < bd) { bd = d; best = ai; }
        }
        if (best && best.press()) this.counters.presses = (this.counters.presses || 0) + 1;
      }
      if (this.lastHoodShotT !== null && t - this.lastHoodShotT > this.counters.maxLull) {
        this.counters.maxLull = +(t - this.lastHoodShotT).toFixed(2);
        this.maxLullAt = { t: +t.toFixed(1), wave: this.counters.wave, alive: this.counters.alive, since: +(t - this.waveStartT).toFixed(1),
          ai: [...this.ais.values()].map((a) => a.state + ':' + Math.round(a.distToPlayer())) };
      }
      this.spawner.update(dt);
      if (this.spawner.done && alive === 0 && this.stateT > 2) {
        this.state = 'intermission';
        this.stateT = 0;
        this.hud.showWave(this.counters.wave + 1, waveSize(this.counters.wave + 1));
      }
    } else if (this.state === 'intermission') {
      if (this.stateT >= GAME.intermission) {
        this.hud.hideWave();
        this.state = 'playing';
        this.nextWave();
      }
    }
    this.counters.bursts = this.fx.bloodFx.bursts;
    this.counters.impacts = this.fx.impacts.count;
    this.counters.decals = this.fx.decals.total;
    this.counters.casings = this.fx.casings.list.length;
  }

  // staged shots: the Tommy gun fires one round at a point (no spread)
  scriptedShot(point, time) {
    const W = this.weapon;
    const pitch = this.controller.pitch, yaw = this.controller.yaw;
    const cam = this.aimRef;
    const d = new THREE.Vector3().subVectors(point, cam.position).normalize();
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
    if (this.ots) { vmNow.otsPos = this.body.muzzleWorld(); vmNow.otsDir = this.body.gunForward(); }
    this.fx.flash.holdRecent(this.time, window ?? 0.5, vmNow);
  }

  // HUD refresh (per rendered frame)
  hudUpdate(dt) {
    if (!this.hud.visible) return;
    // over the shoulder the crosshair is drawn where the aim point projects
    // (right of centre: the boom looks up the street, left of the aim)
    let aimX = 0.5, aimY = 0.5;
    if (this.ots) {
      const p = (this._xp || (this._xp = new THREE.Vector3())).copy(this.body.crossPoint).project(this.camera);
      if (p.z < 1) { aimX = 0.5 + 0.5 * p.x; aimY = 0.5 - 0.5 * p.y; }
    }
    this.hud.update({
      aimX, aimY,
      wave: Math.max(1, this.counters.wave), kills: this.counters.kills, ammo: this.weapon.ammo, drum: WEAPON.drum,
      reloading: this.weapon.reloading, hp: this.health.hp, spread: this.weapon.spread, dt,
    });
  }

  // input (pointer-locked play)
  bindInput(dom) {
    const locked = () => document.pointerLockElement === dom;
    dom.addEventListener('mousedown', (e) => { if (e.button === 0 && locked() && this.state === 'playing') this.weapon.trigger = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.weapon.trigger = false; });
    addEventListener('keydown', (e) => {
      if (!locked()) return;
      if (e.code === 'KeyR') this.weapon.reload();
      if (e.code === 'KeyV' && !e.repeat) this.hud.message(this.setOts(!this.ots) ? 'over the shoulder' : 'first person', 1.0);
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
