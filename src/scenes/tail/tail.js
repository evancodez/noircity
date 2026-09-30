import * as THREE from 'three';
import { ROAD, roadPoint, carYawAt, frameAt, eyeYawAt } from '../../stages/riverroad/road.js';
import { STREETS } from '../../stages/riverroad/parts/buildings.js';
import { COUPE, WHEEL_TURN } from '../../vehicles/models.js';
import { DRIVE } from '../../player/clips/drive.js';
import { PROP_KINDS, buildProp } from '../../props/index.js';
import { LAYER, allocVmId } from '../../render/layers.js';
import { Watcher, PathDriver } from './driver.js';
import { Screen } from './screen.js';
import { FIRE } from '../../fx/fxTextures.js';

// Scene 7's machinery (lane B5): the two cars, the road's events, the gun
// out of the window, the failures and the markers. The script
// (src/scenes/07_tail.js) builds one Tail per entry, calls tail.step every
// step (ctx.onStep) and waits on its state:
//   start -> chase -> close -> shot (his tyre went) -> crashed (into the
//   post) -> stopped (mine, beside him) -> out (on foot) -> ...
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const _v = new THREE.Vector3(), _d = new THREE.Vector3();
const F = {};

export class Tail {
  constructor(ctx) {
    this.ctx = ctx;
    this.game = ctx.game;
    this.stage = ctx.stage;
    this.V = ctx.game.vehicles;
    this.state = 'start';
    this.watcher = new Watcher(this);
    this.failT = 0;
    this.fade = null;
    this.flags = {};
    this.goodShots = 0;
    this.aimK = 0;
    this.aimHeld = false;
    this.fireBuf = 0;
    this.snapT = 0;
    this.cool = 0;
    this.rounds = 6;
    this.reloadT = 0;
    this.shots = 0;
    this.gun = null;
    this.t = 0;
    // (the last tail, for the headless tools: its record of the run)
    globalThis.__tail = this;
    // (leaving the scene: the engines' loops stop, the hands let go of the car)
    const G = ctx.game;
    // a thing thrown back into my windscreen: the thump, the glass cracks
    // where it struck (screen.js), the view flinches
    const onHit = (e) => { if (!this.my || this.out) return; const now = this.t; if (now - (this._hitT || -9) < 0.12) return; this._hitT = now; G.sfx.play('tail_screenHit', null, { k: e.k }); G.controller.kick(0.8 * e.k + 0.3, 0.5, 0.08); if (this.screen && e.k > 0.45) this.screen.crack(e.lz, e.k); };
    G.on('screenHit', onHit);
    const off = () => { this.dispose(); G.off('scene:exit', off); G.off('screenHit', onHit); };
    G.on('scene:exit', off);
  }

  dispose() {
    const S = this.game.sfx;
    if (S && S.live) for (const k of ['tail_his', 'tail_truck']) if (S.loops.has(k)) S.stopLoop(k);
    DRIVE.car = null;
    if (DRIVE.gun && DRIVE.gun.prop) DRIVE.gun.prop.visible = false;
    if (this.cabinBox) { this.cabinBox.min.set(1e5, 1e5, 1e5); this.cabinBox.max.set(1e5, 1e5, 1e5); }
  }

  // ---- building the moment ---------------------------------------------------------------
  // my: { s, d, speed }, his: { s, d, speed }
  spawn({ my, his, state = 'start' }) {
    const G = this.game, V = this.V, stage = this.stage;
    V.clear();
    // (the old tail's lamp and gun state go with its cars)
    this.lampOut = 0; this.goodShots = 0;
    if (this.gunProp) { this.gunProp.visible = false; }
    if (stage.train && stage.train.active) stage.train.stop();
    this.state = state;
    this.my = V.spawn('coupe', { at: roadPoint(my.s, my.d), yaw: carYawAt(my.s) + (my.yaw || 0), speed: my.speed || 0, lights: true });
    V.setPlayer(this.my);
    this.his = V.spawn('sedan', { at: roadPoint(his.s, his.d), yaw: carYawAt(his.s) + (his.yaw || 0), speed: his.speed || 0, lights: true, tail: 'crew' });
    this.his.driver = this.watcher;
    this.his.car.limit = 1e9;
    const mine = this.my;
    mine.on('scrape', (e) => this.scrape(e));
    mine.on('crash', (e) => this.crash(e));
    mine.on('smash', (e) => this.smashed(e));
    mine.on('kerb', (e) => G.sfx.play('tail_kerb', null, { k: e.k }));
    this.his.on('smash', () => {});
    // the hands on the wheel; the eye in the seat
    DRIVE.car = mine; DRIVE.camera = G.camera; DRIVE.aim = 0; DRIVE.grip = null;
    G.player.hands.equip('drive');
    G.controller.setMode('drive', { vehicle: mine, game: G, eye: COUPE.eye, control: (v, dt) => this.control(v, dt), ease: 0.001 });
    G.setViewmodelVisible(true);
    // the cabin: its own room (the rain on the roof, the engine), no rain
    // inside it, the windscreen's rain and the wipers
    this.cabinBox = this.cabinBox || new THREE.Box3();
    if (!this.look) this.look = stage.addLook(this.cabinBox, { room: 'car', rainOverlay: 0 });
    if (!stage.dry.includes(this.cabinBox)) stage.dry.push(this.cabinBox);
    if (!this.screen) this.screen = new Screen(stage, G);
    this.screen.attach(mine);
    this.screen.clearCracks();
    this.gunProp = null;
    this.placeCabin();
  }

  // the room and the dry box ride with the cabin
  placeCabin() {
    const e = this.my.seat(COUPE.eye, _v);
    this.cabinBox.min.set(e.x - 0.9, e.y - 1.0, e.z - 0.9);
    this.cabinBox.max.set(e.x + 0.9, e.y + 0.45, e.z + 0.9);
  }

  // ---- the scene drives my car itself (the stop beside him) --------------------------------
  control(v, dt) {
    if (this.cruise != null && !this.stop) {
      const I = v.input;
      I.throttle = v.speed < this.cruise ? 1 : 0; I.brake = 0; I.steer = 0;
      return true;
    }
    const S = this.stop;
    if (!S) return false;
    const I = v.input;
    // (the player's own hands still count: a harder brake, the steering)
    const G = this.game, held = (c) => G.held(c);
    const pBrake = held('KeyS') || held('ArrowDown') ? 1 : 0;
    const pSteer = ((held('KeyA') || held('ArrowLeft')) ? 1 : 0) - ((held('KeyD') || held('ArrowRight')) ? 1 : 0);
    // (a stop it can make: never past the point, never backing up to it)
    if (!S.fixed) { S.fixed = true; S.s = Math.max(S.s, v.s + (v.speed * v.speed) / (2 * 9) + 2); }
    if (v.speed < 0.25 && S.s - v.s < 1.5) { I.throttle = 0; I.brake = 0; I.steer = 0; v.vel.set(0, 0, 0); v.parkedT = (v.parkedT || 0) + dt; return true; }
    const F2 = frameAt(v.s, F);
    // the point to stop at: along the road, then across
    const ds = S.s - v.s, sp = v.speed;
    const need = sp > 0.1 ? (sp * sp) / (2 * Math.max(0.5, ds)) : 0;
    const want = ds > 1 ? Math.min(14, 2.2 + ds * 0.45) : 0;
    I.throttle = sp < want - 1 ? clamp((want - sp) / 5, 0.2, 0.8) : 0;
    I.brake = sp > 0.3 && (ds < 0.6 || sp > want + 1 || need > 4) ? clamp(Math.max(need / 10, (sp - want) / 6, ds < 0.6 ? 1 : 0), 0.15, 1) : 0;
    // steer onto the stop's line
    const aim = roadPoint(v.s + 7, S.d);
    const dx = aim.x - v.pos.x, dz = aim.z - v.pos.z;
    const c = Math.cos(v.yaw), sn = Math.sin(v.yaw);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    I.steer = clamp(Math.atan2(-lz, lx) * 2.2, -0.7, 0.7) * (sp > 0.5 ? 1 : 0);
    if (pSteer) I.steer = clamp(I.steer * 0.3 + pSteer, -1, 1);
    if (pBrake) { I.brake = Math.max(I.brake, 1); I.throttle = 0; }
    void F2;
    return true;
  }

  // ---- per step --------------------------------------------------------------------------------
  step(dt) {
    const G = this.game, my = this.my, his = this.his;
    if (!my) return;
    this.t += dt;
    // (a record of the run, for tuning and the play's checks: every 0.5 s)
    this.logT = (this.logT || 0) + dt;
    if (this.logT >= 0.5) { this.logT = 0; (this.log || (this.log = [])).push([+this.t.toFixed(1), +my.s.toFixed(0), +my.speed.toFixed(1), +(his.s - my.s).toFixed(1), this.state]); }
    this.V.update(dt);
    this.placeCabin();
    this.cabin(dt);
    if (this.screen) this.screen.update(dt, my);
    this.sound(dt);
    this.tickFade(dt);
    const gap = his.s - my.s;
    this.gap = gap;
    const M = ROAD.marks;
    if (this.state === 'start' && my.speed > 1.5) this.state = 'chase';
    if ((this.state === 'chase' || this.state === 'start') && (my.s > M.close || his.s > M.close + 26)) this.state = 'close';
    if (this.state === 'chase' || this.state === 'close') {
      this.events(dt);
      // he gets away: 90 m for 5 s (or I wrecked into the truck)
      if (gap > 90) this.failT += dt; else this.failT = Math.max(0, this.failT - dt * 2);
      if (this.failT > 5 && !this.fade) this.fail();
      // the checkpoints I have passed
      for (const c of ROAD.checkpoints) if (my.s > c + 10) this.checkpoint = Math.max(this.checkpoint || 0, c);
    }
    if (this.state === 'close') this.gunStep(dt);
    // (mercy: near the road's end his tyre goes whatever my aim - a
    // first-timer who cannot hit it still gets his crash)
    if (this.state === 'close' && his.s > ROAD.marks.end - 70) this.tyre(1);
    else this.holster(dt);
    if (this.spin) this.spinStep(dt);
    if (this.wreck) this.wreckStep(dt);
  }

  // ---- the sound: my engine (the car's room bed), his, the truck's --------------------------
  sound(dt) {
    const S = this.game.sfx, my = this.my;
    if (!S || !S.live) return;
    if (S.bed && S.bedName === 'car' && S.bed.set) S.bed.set({ speed: my.speed, throttle: my.input.throttle, slide: my.slide || 0, shake: my.shake });
    // his engine ahead (a noise loop that rides his car), the truck's
    const his = this.his;
    if (his && !his.parked) S.loop('tail_his', his.pos, 0.25 + 0.2 * Math.min(1, Math.abs(his.speed) / 25), 'brown', 220 + Math.abs(his.speed) * 9, 0, true);
    else if (S.loops.has('tail_his')) S.stopLoop('tail_his');
    if (this.truck) S.loop('tail_truck', this.truck.pos, 0.3, 'brown', 160, 0, true);
    else if (S.loops.has('tail_truck')) S.stopLoop('tail_truck');
  }

  // ---- the cabin: dials, wheel, wipers ------------------------------------------------------
  cabin(dt) {
    const v = this.my, m = v.model;
    if (!m.needles) return;
    // the speedometer: 0 .. 120 km/h over 270 degrees
    const kmh = Math.abs(v.speed) * 3.6;
    this.needle = (this.needle ?? 0) + ((kmh / 120) * 4.7 - (this.needle ?? 0)) * (1 - Math.exp(-dt * 10));
    m.needles[0].rotation.x = -2.35 + this.needle + Math.sin(this.t * 31) * 0.01 * v.shake;
    // the second dial: the engine's revs, near the top as it pulls
    const rev = 0.3 + 0.6 * (v.input.throttle ? 1 : 0.4) * clamp(0.3 + (kmh % 45) / 45, 0, 1);
    this.rev = (this.rev ?? 0.3) + (rev - (this.rev ?? 0.3)) * (1 - Math.exp(-dt * 6));
    m.needles[1].rotation.x = -1.2 + this.rev * 2.4;
    // the wheel follows the hands' ask (the car's eased steer)
    // (less of it at speed: a car at 90 turns on a flick of the wheel)
    const turnK = WHEEL_TURN * (1 - 0.45 * clamp(Math.abs(v.speed) / 26, 0, 1));
    if (m.wheel) m.wheel.rotation.x = -v.steer * turnK + Math.sin(this.t * 29) * 0.012 * v.shake;
    // the wipers: two arcs, a sweep a second and a bit
    const P = 1.15;
    this.wipeT = (this.wipeT || 0) + dt;
    const u = (this.wipeT % P) / P;
    // (a blade at each end of its sweep: the thump in the car's bed)
    const end = u < 0.5 ? 0 : 1;
    if (this._wEnd !== undefined && end !== this._wEnd) { const B = this.game.sfx && this.game.sfx.bed; if (B && B.wipe) B.wipe(end ? 1 : 0.6); }
    this._wEnd = end;
    const sweep = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
    for (const w of m.wipers) w.arm.rotation.x = 1.52 - sweep * 1.65;
    this.wipe = { sweep, u };
    if (this.screen) this.screen.wipe(sweep, m.wipers, this.wipeT);
  }

  // ---- the road's events --------------------------------------------------------------------------
  events(dt) {
    const G = this.game, my = this.my, his = this.his, stage = this.stage;
    const M = ROAD.marks, fl = this.flags;
    // the train over the el, once, coming down the line toward me
    if (!fl.train && my.s > M.train) { fl.train = true; if (stage.train) stage.train.run(Math.min(ROAD.len, my.s + 320), -1); }
    // the market: he swerves at the stalls and knocks their crates into my road
    const S = stage.smash;
    if (S && his.s > M.market - 10 && his.s < M.marketEnd + 10) {
      for (const st of S.stalls) {
        if (st.spilt || !st.alive || Math.abs(st.s - his.s) > 2.5 || his.d > -3.4) continue;
        st.spilt = true;
        frameAt(st.s, F);
        const push = new THREE.Vector3(F.rx * 5 + F.fx * his.speed * 0.25, 0, F.rz * 5 + F.fz * his.speed * 0.25);
        S.spill(st, push);
        G.sfx.play('smash_crate', st.pos, { k: 0.6 }, { ref: 4 });
      }
    }
    // the truck out of its side street, as he passes it
    const TS = STREETS.find((x) => Math.abs(x.s - M.truck) < 1).s;
    if (!fl.truck && his.s > TS - 40 && my.s > TS - 110) {
      fl.truck = true;
      this.watcher.avoid.push({ s0: TS - 30, s1: TS + 14, d: 4.4 });
      const tr = this.V.spawn('truck', { at: roadPoint(TS, -30), yaw: carYawAt(TS) - Math.PI / 2, lights: true });
      tr.driver = new PathDriver([
        { s: TS, d: -30, t: 0 }, { s: TS, d: -17, t: 1.3 }, { s: TS + 2.5, d: -6.5, t: 2.6 }, { s: TS + 5.5, d: -2.2, t: 3.7 }, { s: TS + 6, d: -1.8, t: 9 },
        { s: TS - 20, d: -2.4, t: 16 }, { s: TS - 90, d: -2.4, t: 26 },
      ]);
      tr.spec.mass = 6;
      this.truck = tr;
      G.sfx.play('tail_horn', roadPoint(TS, -20), { k: 0.8, low: 1 }, { ref: 6 });
    }
    if (this.truck && this.truck.driver.done) { this.V.remove(this.truck); this.truck = null; }
    // headlamps coming the other way
    if (!fl.oncoming && my.s > M.oncoming - 150) {
      fl.oncoming = true;
      const s0 = Math.min(ROAD.len - 5, my.s + 210);
      this.watcher.avoid.push({ s0: s0 - 150, s1: s0 - 60, d: 4.6 });
      const oc = this.V.spawn('sedan', { at: roadPoint(s0, -2.3), yaw: carYawAt(s0) + Math.PI, lights: true, paint: 'paintGrey' });
      oc.driver = new PathDriver([{ s: s0, d: -2.3, t: 0, lin: true }, { s: s0 - 190, d: -2.6, t: 11, lin: true }, { s: s0 - 400, d: -2.6, t: 23, lin: true }]);
      this.oncoming = oc;
      oc.hornAt = 0;
    }
    if (this.oncoming) {
      const oc = this.oncoming;
      if (!oc.honked && Math.abs(oc.s - my.s) < 45) { oc.honked = true; G.sfx.play('tail_horn', oc.pos, { k: 1 }, { ref: 8 }); }
      if (oc.driver.done || oc.s < my.s - 120) { this.V.remove(oc); this.oncoming = null; }
    }
  }

  // ---- what my car meets ----------------------------------------------------------------------
  note(kind, k) { (this.evlog || (this.evlog = [])).push([+this.t.toFixed(1), kind, +(k || 0).toFixed(2), +this.my.s.toFixed(0)]); }
  scrape(e) {
    const G = this.game, r = this.ctx.rng;
    this.note('scrape:' + e.what, e.k);
    const n = Math.round(8 + 22 * e.k);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const v = (e.n ? e.n.clone() : up.clone()).multiplyScalar(r.range(1, 4)).add(new THREE.Vector3(r.gauss() * 1.5, r.range(0.5, 3), r.gauss() * 1.5)).addScaledVector(this.my.vel, r.range(0.3, 0.9));
      G.fx.sparks.spawn({ pos: e.point.clone().setY(r.range(0.3, 0.9)), vel: v, life: r.range(0.2, 0.55), size: [0.012, 0.02], stretch: 0.05, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
    }
    const now = this.t;
    if (!this._scrapeT || now - this._scrapeT > 0.18) { this._scrapeT = now; G.sfx.play('tail_scrape', e.point, { k: e.k }, { ref: 4 }); }
    G.controller.shake(0.25 * e.k, 0);
  }
  crash(e) {
    const G = this.game;
    this.note('crash:' + e.what, e.k);
    G.sfx.play('tail_crash', e.point, { k: e.k }, { ref: 4 });
    G.controller.shake(0.8 * e.k + 0.2, 0);
    G.controller.kick(3 * e.k, 3 * e.k, 0.16);
    if (e.what === 'truck' && e.k > 0.6 && (this.state === 'chase' || this.state === 'close')) this.wrecked = true;
    if (this.wrecked && !this.fade) this.fail();
  }
  smashed(e) {
    const G = this.game;
    this.note('smash:' + e.item.kind, this.my.speed);
    G.controller.kick(0.5, 0.3, 0.08);
    void e;
  }

  // ---- failing: black, back to the last marker ---------------------------------------------------
  fail() {
    const G = this.game;
    this.note('fail', this.gap);
    this.fade = { t: 0, phase: 'out' };
    G.emit('tail:fail', { s: this.my.s, gap: this.gap });
  }
  tickFade(dt) {
    const Fd = this.fade;
    if (!Fd) return;
    const G = this.game;
    Fd.t += dt;
    if (Fd.phase === 'out') {
      G.scenes.setFade(Math.min(1, Fd.t / 0.45));
      if (Fd.t >= 0.5) {
        const c = this.checkpoint || ROAD.checkpoints[0];
        this.flags = {};
        this.wrecked = false;
        this.failT = 0;
        this.spawn({ my: { s: c, d: 2.2, speed: 16 }, his: { s: c + 42, d: 1.9, speed: 18 }, state: this.state === 'close' ? 'close' : 'chase' });
        // (the events already passed stay passed)
        this.flags.train = c > ROAD.marks.train;
        this.flags.truck = c > ROAD.marks.truck;
        this.flags.oncoming = c > ROAD.marks.oncoming;
        Fd.phase = 'in'; Fd.t = 0;
      }
    } else {
      const u = Math.min(1, Fd.t / 0.6);
      G.scenes.setFade(1 - u * u * (3 - 2 * u));
      if (u >= 1) { this.fade = null; G.scenes.setFade(0); }
    }
  }

  // ---- the gun out of the window -------------------------------------------------------------------
  gunStep(dt) {
    const G = this.game, C = G.controller;
    const held = G.held('Mouse2');
    if (G.pressed('Mouse0')) { this.fireBuf = 0.15; if (!held && this.aimK < 0.5) this.snapT = 0.9; }
    this.fireBuf = Math.max(0, this.fireBuf - dt);
    this.snapT = Math.max(0, this.snapT - dt);
    const want = held || this.snapT > 0 ? 1 : 0;
    const rate = want ? 1 / 0.22 : 1 / 0.3;
    this.aimK = clamp(this.aimK + Math.sign(want - this.aimK) * rate * dt, 0, 1);
    DRIVE.aim = this.aimK;
    if (C.drive) { C.drive.lean = this.aimK; C.drive.aim = this.aimK > 0.5; }
    // the revolver in the left hand while it is up
    this.showGun(this.aimK > 0.25);
    this.cool = Math.max(0, this.cool - dt);
    if (DRIVE.gun) DRIVE.gun.kick = Math.max(0, (DRIVE.gun.kick || 0) - dt / 0.16);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.rounds = 6; } }
    if (this.fireBuf > 0 && this.aimK > 0.9 && this.cool <= 0 && this.reloadT <= 0) { this.fireBuf = 0; this.fire(); }
    // the prompt: once he is within 30 m (the first time only)
    if (!this.taught && this.gap < 30 && this.state === 'close') { this.taught = true; this.promptT = 0; }
    if (this.taught && !this.shots && this.state === 'close') G.hud.prompt('RMB  aim     LMB  fire', null, 'tail');
    else if (this.taught) G.hud.clearPrompt('tail');
  }
  holster(dt) {
    if (this.aimK > 0) {
      this.aimK = Math.max(0, this.aimK - dt / 0.3);
      DRIVE.aim = this.aimK;
      const C = this.game.controller;
      if (C.drive) { C.drive.lean = this.aimK; C.drive.aim = false; }
      this.showGun(this.aimK > 0.25);
    }
  }
  // the revolver: made once, drawn in the hands' scene (its path and the
  // hand on it are the hands' drive set's: player/clips/drive.js)
  showGun(on) {
    const G = this.game, vm = G.vm;
    if (!this.gunProp) {
      // (a gun of an earlier tail - a retry, a jump - goes)
      if (DRIVE.gun && DRIVE.gun.prop && DRIVE.gun.prop.parent) DRIVE.gun.prop.parent.remove(DRIVE.gun.prop);
      const kind = PROP_KINDS.includes('revolver') ? 'revolver' : 'tailRevolver';
      const p = buildProp(kind);
      const id = allocVmId();
      p.traverse((o) => { if (!o.isMesh) return; o.layers.set(LAYER.VIEWMODEL); o.userData.inkId = id; o.userData.inkFigure = true; o.castShadow = false; o.frustumCulled = false; });
      p.matrixAutoUpdate = false;
      p.visible = false;
      vm.root.add(p);
      this.gunProp = p;
      DRIVE.gun = { prop: p, kick: 0 };
    }
    if (!on) this.gunProp.visible = false;
  }
  fire() {
    const G = this.game, cam = G.camera, his = this.his;
    if (this.rounds <= 0) { this.reloadT = 1.3; return; }
    this.rounds--;
    this.shots++;
    this.cool = 0.3;
    cam.updateMatrixWorld();
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
    const origin = cam.position.clone();
    // the muzzle: the prop's, in the world
    const muzzle = new THREE.Vector3();
    if (this.gunProp) { this.gunProp.updateMatrixWorld(true); muzzle.copy(this.gunProp.userData.muzzle || new THREE.Vector3(0, 0.06, 0.11)).applyMatrix4(this.gunProp.matrixWorld); }
    else muzzle.copy(origin).addScaledVector(dir, 0.6);
    G.fx.flash.player(muzzle.clone(), muzzle.clone(), dir.clone(), G.time);
    G.sfx.pistol(muzzle.clone(), 0);
    G.controller.kick(1.8, 1.2, 0.11);
    if (DRIVE.gun) DRIVE.gun.kick = 1;
    G.counters.shots++;
    // his car in the bullets' world (moving: its entries refreshed each step)
    this.solidify(his);
    const hit = G.rays.raycast(origin, dir, 160);
    let good = false;
    if (hit) {
      good = !!(his.car && hit.mesh.userData.car === his.car);
      G.react.bullet(hit, dir.clone());
      if (good) this.goodShot(hit);
    }
    G.emit('shot', { weapon: 'revolver', hit, car: good });
    if (this.rounds <= 0) this.reloadT = 1.3;
  }
  // a round into his car: his tail lamp on that side goes, sparks off the
  // trunk; a round near a rear wheel (a generous one) or the fifth good one
  // takes the tyre
  goodShot(hit) {
    const his = this.his;
    this.goodShots++;
    const l = his.local(hit.point, new THREE.Vector3());
    const side = l.z > 0 ? 1 : -1;
    if (l.x < -1.7 && !this.lampOut && his.tail) {
      this.lampOut = side;
      this.killTailLamp(side);
    }
    const nearTyre = l.x < -0.7 && l.x > -2.4 && l.y < 1.05 && Math.abs(Math.abs(l.z) - 0.76) < 0.55;
    if ((nearTyre && this.goodShots >= 2) || this.goodShots >= 5 || (nearTyre && Math.hypot(l.x + 1.55, l.y - 0.38) < 0.45)) this.tyre(nearTyre ? side : (this.lampOut ? -this.lampOut : 1));
  }
  killTailLamp(side) {
    const his = this.his;
    // (the tail lamps are one mesh: the lit one is re-made alone)
    const g = his.tail.geometry;
    const pos = g.getAttribute('position');
    const keep = [];
    for (let i = 0; i < pos.count; i += 3) {
      const zc = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      if (Math.sign(zc) !== side) keep.push(i);
    }
    const arr = new Float32Array(keep.length * 9);
    keep.forEach((i, k) => { for (let j = 0; j < 9; j++) arr[k * 9 + j] = pos.array[i * 3 + j]; });
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    ng.computeVertexNormals();
    his.tail.geometry = ng;
    for (const sp of his.tail.userData.glows || []) if (sp.userData.side === side) sp.visible = false;
    const p = his.seat(new THREE.Vector3(-2.3, 0.84, 0.74 * side), new THREE.Vector3());
    this.game.fx.debris.spawn({ pos: p, vel: new THREE.Vector3(0, 1, 0).addScaledVector(his.vel, 0.9), life: 0.8, size: [0.04, 0.03], rot: 0, spin: 9, col: [0.35, 0.02, 0.03], cell: 12, gravity: 9.8, ground: 0.02, fadeOut: 0.2 });
    this.game.sfx.glass(p, 0.4);
  }
  solidify(v) {
    if (!v.car || v._solid) return;
    const G = this.game;
    v._solid = true;
    for (const m of Object.values(v.car.meshes)) if (m && m.isMesh && m.visible && !m.userData.noRay && m.layers.test(G.camera.layers)) G.rays.add(m);
    v.onPose = (car) => { for (const m of Object.values(car.car.meshes)) if (m && m.isMesh) G.rays.refresh(m); };
  }

  // ---- his tyre, the spin, the post ------------------------------------------------------------------
  tyre(side) {
    if (this.state !== 'close') return;
    const G = this.game, his = this.his, stage = this.stage;
    this.state = 'shot';
    const wi = side > 0 ? 3 : 2;       // (Cars: 0 FL(+z) 1 FR(-z) 2 RL 3 RR by z sign)
    his.car.tyres[side > 0 ? 2 : 3] = 1;
    G.sfx.play('tyre', his.pos, {}, { ref: 5 });
    G.sfx.play('tail_burst', his.pos, {}, { ref: 5 });
    G.emit('tail:tyre', { side });
    // the post he goes into: the next river post far enough ahead to spin
    const L = stage.lamps;
    const post = L.posts.find((p) => p.s > his.s + Math.max(26, his.speed * 1.35)) || L.posts[L.posts.length - 1];
    this.spin = new Spin(this, his, post, side);
    his.driver = this.spin;
    // the chase is done: my car eases down to stop beside where he will
    // end (the player may brake harder), the eyes go with him, and the
    // moment runs slow for a breath
    // (behind him, near the kerb: I get out on the road side and walk up to
    // his door with nothing between us)
    this.stop = { s: post.s - 9.5, d: Math.min(4.6, post.d - 3.9), fixed: false };
    const C = G.controller;
    if (C.drive) C.drive.focus = his;
    G.slowmo(0.5, 0.8);
    void wi;
  }
  spinStep(dt) { this.spin.fx(dt); }
  wreckStep(dt) { this.wreck.step(dt); }
}

// The spin: a fishtail as the tyre goes, then the car comes round and slides
// side-on up the kerb into the lamp post. Kinematic (the car is placed on
// an eased path), so it always ends against the post whatever the speed.
class Spin {
  constructor(tail, v, post, side) {
    this.tail = tail;
    this.v = v;
    this.post = post;
    this.kinematic = true;
    this.t = 0;
    this.s0 = v.s; this.d0 = v.d; this.yaw0 = v.yaw; this.sp0 = Math.max(12, v.speed);
    // the end: side-on against the post, its river side toward it
    this.sEnd = post.s + 0.2;
    this.dEnd = post.d - (v.spec.halfW + 0.24);
    // turned round a little more than half a turn: his tail swings out
    // toward the river first (the burst side), then the whole car comes round
    this.turn = (side > 0 ? -1 : 1) * (Math.PI * 1.08);
    this.yawEnd = carYawAt(this.sEnd) + (Math.abs(this.turn) > Math.PI ? this.turn : this.turn);
    const dist = this.sEnd - this.s0;
    this.T = clamp(dist / (this.sp0 * 0.62), 1.3, 2.6);
    this.side = side;
    this.hit = false;
  }
  drive(v, dt) {
    this.t += dt;
    const u = clamp(this.t / this.T, 0, 1);
    // along: decelerating (it slides in, not stops short)
    const ea = 1 - Math.pow(1 - u, 1.6);
    const s = this.s0 + (this.sEnd - this.s0) * ea;
    // across: the fishtail weave, then the slide to the kerb (late)
    const weave = Math.sin(u * Math.PI * 3) * 0.6 * (1 - u) * (u < 0.5 ? 1 : 0);
    const eb = u < 0.35 ? 0 : Math.pow((u - 0.35) / 0.65, 1.3);
    const d = this.d0 + (this.dEnd - this.d0) * eb * eb * (3 - 2 * eb) + weave;
    const p = roadPoint(s, d);
    const px = v.pos.x, pz = v.pos.z;
    v.pos.set(p.x, 0, p.z);
    if (dt > 0) v.vel.set((p.x - px) / dt, 0, (p.z - pz) / dt);
    // the turn: a fishtail (+-0.3 rad), then the spin round
    const fish = Math.sin(u * Math.PI * 4.5) * 0.32 * clamp(u / 0.15, 0, 1) * (1 - clamp((u - 0.25) / 0.2, 0, 1));
    const rs = clamp((u - 0.3) / 0.62, 0, 1);
    const spin = this.turn * (rs * rs * (3 - 2 * rs));
    v.yaw = carYawAt(s) + fish + spin;
    v.yawRate = 0; v.lat = (1 - u) * 9 * Math.sign(this.turn); v.accel = -6;
    if (u >= 1 && !this.hit) this.impact();
  }
  // the smoke off his tyres as he slides, the horn after
  fx(dt) {
    const G = this.tail.game, v = this.v, r = this.tail.ctx.rng;
    if (this.hit) return;
    this.acc = (this.acc || 0) + dt * 30;
    while (this.acc >= 1) {
      this.acc -= 1;
      const p = v.seat(new THREE.Vector3(r.range(-2, -1.1), 0.1, r.range(-0.8, 0.8)), new THREE.Vector3());
      G.fx.smoke.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.6, r.range(0.4, 1.0), r.gauss() * 0.6).addScaledVector(v.vel, 0.15), life: r.range(0.9, 1.6), size: [0.5, 0.5], grow: 0.7, rot: r.next() * 6.28, spin: r.gauss() * 0.4,
        col: [0.035, 0.035, 0.035], colEnd: [0.045, 0.045, 0.045], alpha: 0.5, drag: 1.2, fadeIn: 0.05, fadeOut: 0.5, cell: FIRE.SMOKE[r.int(0, 3)] });
    }
    if (!this.screech) { this.screech = true; G.sfx.play('tail_screech', v.pos, { dur: this.T }, { ref: 6 }); }
  }
  impact() {
    this.hit = true;
    const T = this.tail, G = T.game, v = this.v;
    v.driver = null;
    v.vel.set(0, 0, 0);
    v.frozen = true;
    v.parked = true;
    T.state = 'crashed';
    T.wreck = new Wreck(T, v, this.post);
    G.emit('tail:crash', {});
  }
}

// After: the post bent over the car, its lamp swinging and still lit, steam
// from the hood, the horn stuck and then dying, one tail lamp still red.
class Wreck {
  constructor(tail, v, post) {
    this.tail = tail; this.v = v; this.post = post;
    this.t = 0;
    const G = tail.game, L = tail.stage.lamps;
    G.sfx.play('tail_crash', post.head.clone().setY(0.8), { k: 1 }, { ref: 5 });
    G.sfx.glass(post.head, 0.6);
    G.controller.shake(0.5, post.head.distanceTo(G.camera.position));
    // the post bends away from the car: a lean of ~22 degrees over its base
    const g = post.group;
    const away = new THREE.Vector3().subVectors(g.position, v.pos).setY(0).normalize();
    this.axis = new THREE.Vector3(away.z, 0, -away.x);
    this.lean = 0; this.leanV = 2.6;
    this.swing = { a: 0, v: 3.4 };
    this.q0 = g.quaternion.clone();
    this.L = L;
    // the horn stuck: it sounds, then dies over ~4 s
    G.sfx.play('tail_hornStuck', v.pos, { dur: 4.2 }, { ref: 6 });
    // the car against the post: a collider for the man on foot
    tail.stage.colliders.addBox(v.pos.x, v.pos.z, v.spec.halfL, v.spec.halfW, v.yaw, 'car');
    // the other tail lamp, the one still red, stays; the hood's steam
    this.steamAcc = 0;
  }
  step(dt) {
    const T = this.tail, G = T.game, v = this.v, r = T.ctx.rng;
    this.t += dt;
    // the post: its lean settles; the lamp's head swings on after it
    this.leanV += ((0.38 - this.lean) * 40 - this.leanV * 6) * dt;
    this.lean += this.leanV * dt;
    this.swing.v += (-this.swing.a * 14 - this.swing.v * 0.6) * dt;
    this.swing.a += this.swing.v * dt;
    const g = this.post.group;
    const q = new THREE.Quaternion().setFromAxisAngle(this.axis, this.lean + this.swing.a * 0.04);
    g.quaternion.copy(q).multiply(this.q0);
    g.updateMatrixWorld(true);
    const l = this.post;
    this.L.syncInstance(l, true);
    // (the head, its cone and its light follow the bent post)
    const head = this.L.geo.head.clone().applyMatrix4(g.matrixWorld);
    const target = head.clone().add(new THREE.Vector3(0, -1, 0).applyAxisAngle(this.axis, this.lean * 0.6 + this.swing.a * 0.25).multiplyScalar(5));
    l.head.copy(head);
    l.axis.copy(target).sub(head).normalize();
    l.cone.position.copy(head);
    l.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), l.axis);
    l.cone.material.uniforms.uApex.value.copy(head);
    l.cone.material.uniforms.uAxis.value.copy(l.axis);
    l.entry.position.copy(head); l.entry.direction.copy(l.axis);
    if (l.light) { l.light.pos.copy(head); l.light.target.copy(head).addScaledVector(l.axis, 6); for (const sl of this.L.pool) if (sl.lamp === l) { sl.spot.position.copy(head); sl.spot.target.position.copy(l.light.target); sl.spot.target.updateMatrixWorld(); } }
    // steam from under the hood
    if (this.t < 40) {
      this.steamAcc += dt * (this.t < 5 ? 5 : 1.6) * (this.t < 18 ? 1 : 0);
      while (this.steamAcc >= 1) {
        this.steamAcc -= 1;
        const p = v.seat(new THREE.Vector3(r.range(1.3, 2.1), 1.05, r.range(-0.5, 0.5)), new THREE.Vector3());
        const gcol = r.range(0.03, 0.05);
        G.fx.smoke.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.15, r.range(0.5, 1.0), r.gauss() * 0.15), life: r.range(1.4, 2.2), size: [0.22, 0.22], grow: 0.55, rot: r.next() * 6.28, spin: r.gauss() * 0.3,
          col: [gcol, gcol, gcol], colEnd: [gcol * 0.8, gcol * 0.8, gcol * 0.8], alpha: 0.4, drag: 0.6, fadeIn: 0.1, fadeOut: 0.7, cell: FIRE.SMOKE[r.int(0, 3)] });
      }
    }
  }
}
export { eyeYawAt };
