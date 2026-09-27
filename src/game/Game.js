import * as THREE from 'three';
import { RayWorld } from '../util/RayWorld.js';
import { Fx } from '../fx/Fx.js';
import { Viewmodel, MUZZLE } from '../player/Viewmodel.js';
import { Weapon, WEAPON } from '../player/Weapon.js';
import { Health } from '../player/Health.js';
import { NavGrid } from '../enemies/Nav.js';
import { CoverSet, HoodAI } from '../enemies/HoodAI.js';
import { Spawner } from '../enemies/Spawner.js';
import { Autopilot } from './Autopilot.js';
import { LAYER } from '../render/layers.js';
import { DEATHS, HAT_OFF } from '../enemies/HoodAnim.js';

// The game: the player (Controller + Tommy gun + Health), the Hoods' AI and
// waves, combat resolution (the player's hitscan -> Weapon.js, the Hoods'
// delayed shots here), effects, and the state machine
//   title -> playing <-> intermission (8 s, "WAVE n" card) -> dead ("THE END")
// One fixed step (1/60 s): pre() before world.update (input, the gun, AI
// decisions), post() after it (enemy bullets, effects, waves, HUD).
export const GAME = { intermission: 8, corpseCap: 16, hoodHp: 100, heavyHp: 170 };

export class Game {
  constructor({ world, camera, controller, pipeline, hud, shotMode, wavesOn }) {
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
    };
    const t0 = performance.now();
    this.rays = new RayWorld(world);
    this.nav = new NavGrid(world.colliders);
    this.covers = new CoverSet(world, this.nav);
    this.fx = new Fx(world);
    this.vm = new Viewmodel(world, camera);
    this.weapon = new Weapon(this, this.vm);
    this.health = new Health(hud.root);
    this.health.onDeath = () => this.onPlayerDeath();
    this.spawner = new Spawner(this);
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
    const casters = [];
    pipeline.shadowCasters = () => {
      casters.length = 0;
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
    for (const sys of [F.blood, F.chips, F.sparks, F.splash, F.dust, F.flash.vm, F.flash.refl, F.flash.world3, F.flash.smoke]) sys.spawn({ pos: p, life: 0.01 });
    for (const sys of [F.blood, F.chips, F.sparks, F.splash, F.dust, F.flash.vm, F.flash.refl, F.flash.world3, F.flash.smoke]) sys.write();
    F.decals.ink(p, new THREE.Vector3(0, 1, 0));
    F.casings.eject(p, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
    F.casings.update(0);
    this.world.scene.updateMatrixWorld(true);
    renderer.compile(this.world.scene, this.camera);
    renderer.compile(this.vm.scene, this.vm.cam);
    for (const h of tmp) H.remove(h);
    F.clear();
    this.prewarmMs = performance.now() - t0;
  }

  setViewmodelVisible(v) { this.vm.visible = v; this.pipeline.vm.visible = v; }

  // ---- lifecycle ---------------------------------------------------------------
  start() {
    if (this.state !== 'title') return;
    this.state = 'playing';
    this.nextWave();
  }

  nextWave() {
    const n = this.counters.wave + 1;
    this.counters.wave = n;
    if (this.wavesOn) this.spawner.startWave(n);
    this.stateT = 0;
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
    if (this.autopilot) {
      // the battle preset keeps fighting: back on his feet at once
      this.health.reset();
      this.health.hp = 60;
      return;
    }
    this.state = 'dead';
    this.stateT = 0;
    this.weapon.trigger = false;
    this.controller.frozen = true;
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
    this.hud.hideEnd();
    this.state = 'playing';
    this.nextWave();
  }

  // ---- Hoods -------------------------------------------------------------------
  spawnHood(x, z, { heavy = false, variant = null, yaw = null, state = null, ai = true } = {}) {
    const W = this.world;
    const seed = 101 + this.counters.spawned * 13;
    const v = variant || { ...hoodSeedVariant(seed), heavy };
    const p = this.camera.position;
    const h = W.hoods.spawn([x, z], v, { yaw: yaw ?? Math.atan2(p.x - x, p.z - z), state: state || 'idle' });
    h.hp = heavy ? GAME.heavyHp : GAME.hoodHp;
    h.heavy = heavy;
    this.counters.spawned++;
    if (ai) this.ais.set(h, new HoodAI(this, h, { heavy }));
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
    const ai = this.ais.get(h);
    if (h.hp <= 0) {
      this.killHood(h, dir, head);
      return;
    }
    h.flinch(dir);
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
    const eye = this.camera.position;
    const dir = new THREE.Vector3().subVectors(eye, muzzle).normalize();
    this.fx.flash.hood(h, muzzle, dir, time, ai.heavy);
    this.counters.hoodShots++;
    this.lastHoodShot.set(h, time);
    const dist = muzzle.distanceTo(eye);
    const moving = this.controller.vel.length() > 1.2;
    let p = Math.max(0.1, Math.min(0.55, 0.56 - dist * 0.013));
    if (moving) p *= 0.65;
    if (ai.heavy) p *= 0.55;
    if (this.state !== 'playing') p = 0;
    const hit = r.chance(p);
    this.pending.push({ t: time + 0.07 + dist / 400, from: muzzle.clone(), hit, dmg: r.int(8, 14), ai });
  }

  resolveShot(s) {
    const eye = this.camera.position;
    if (s.hit) {
      // still in the line of fire?
      const dir = new THREE.Vector3().subVectors(eye, s.from);
      const d = dir.length(); dir.divideScalar(d);
      if (!this.rays.raycast(s.from, dir, d - 0.4, { anyHit: true })) {
        this.health.damage(s.dmg);
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
    if (hit) this.fx.impacts.at(hit, dir);
  }

  // ---- per step ------------------------------------------------------------------
  pre(dt, t) {
    this.time = t;
    for (const f of this.scripts) f(t, dt);
    const C = this.controller;
    if (this.autopilot && this.state !== 'dead') this.autopilot.update(dt);
    if (!this.shotMode || this.autopilot) C.update(dt);
    else C.apply(dt);
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
    this.fx.update(dt, t);
    this.health.update(dt);
    this.stateT += dt;
    const alive = this.world.hoods.list.reduce((n, h) => n + (h.alive ? 1 : 0), 0);
    this.counters.alive = alive;
    if (this.state === 'playing' && this.wavesOn) {
      this.spawner.update(dt);
      if (this.spawner.done && alive === 0 && this.stateT > 2) {
        this.state = 'intermission';
        this.stateT = 0;
        this.hud.showWave(this.counters.wave + 1);
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
    const cam = this.camera;
    const d = new THREE.Vector3().subVectors(point, cam.position).normalize();
    W.fire(time, d);
    // keep the staged composition (no recoil climb)
    this.controller.pitch = pitch; this.controller.yaw = yaw;
  }
  // staged shots: a Hood fires (flash + light, no bullet)
  stagedHoodFire(h, time) {
    const muzzle = h.fire();
    if (!muzzle) return;
    const dir = new THREE.Vector3().subVectors(this.camera.position, muzzle).normalize();
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
      if (e.code === 'KeyM') { this.muted = !this.muted; this.hud.message(this.muted ? 'sound off' : 'sound on'); }
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
