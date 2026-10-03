import * as THREE from 'three';
import { COUPE } from '../../vehicles/models.js';
import { Cabin } from '../../vehicles/cabin.js';
import { DAMAGE } from '../../vehicles/Car.js';
import { PIER, START, EW, riverPoint, riverFrame, riverSAtZ, RIVER } from '../../stages/city/plan.js';
import { His, LEGS } from './his.js';
import { WindowGun } from './gun.js';
import { Traffic } from './traffic.js';
import { Walkers } from './walkers.js';
import { Cat } from './cat.js';
import { makeKit } from './kit.js';
import { RULES, TEACH, HIT, RAM, RIVER_B } from './rules.js';
import { makeBot } from './bot.js';
import { FIRE } from '../../fx/fxTextures.js';
import { FIRE_COL } from '../../fx/Explosion.js';
import { RNG } from '../../util/rng.js';

// Chapter VI's machinery (lane C3): my coupe and his sedan in the city, the
// rules of the tail, the gun out of the window, his car coming apart under
// my rounds, the wreck, the drive to Pier 9. The script (07_tail.js) builds
// one Chase per entry (a beat's setup), steps it (ctx.onStep) and waits on
// its phase:
//   start (at the kerb) -> a ("Don't lose him.") -> b ("Stop him before the
//   docks.") -> crash (his hands gone) -> wreck (stopped) -> c ("Pier 9.")
//   -> parked (by the gate) -> out
// Losing: a: out of sight too long, or too far behind ("He's getting away."
// first, then "Lost him."); a wreck of my own ("Wrecked."); b: he reaches the
// pier's gate ("He warned them.") or gets clean away. Back at the beat the
// fail names (the checkpoints: start, chase2, river, pier).
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
// (the cat's wall: Pell Lane's brick wall north of the board fence, its cap)
const PELL_CAT = { x: -203.06, z: 8, y: 3.62 };

export { RULES };

export class Chase {
  constructor(ctx) {
    this.ctx = ctx;
    this.game = ctx.game;
    this.stage = ctx.stage;
    this.V = ctx.game.vehicles;
    this.kit = makeKit(ctx.game);
    this.phase = 'start';
    this.t = 0;
    this.unseen = 0; this.farT = 0;
    this.log = [];
    // [4th owner] this try's own draw (his choice of way when I am near, the
    // traffic's walks): a retry, or another night, is not the same film.
    // ?tailSeed=n makes it repeatable (n, then n + 1 each try); shot mode
    // keeps it fixed
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tailSeed') : null;
    const G0 = ctx.game;
    G0._tailTries = (G0._tailTries || 0) + 1;
    this.trySeed = G0.shotMode ? 1 : q != null ? (+q || 0) + G0._tailTries - 1 : ((Math.random() * 0x7fffffff) | 0);
    this.routeRng = new RNG(this.trySeed * 2654435761 + 17);
    globalThis.__tail = this;
    const G = this.game;
    const onHit = (e) => { if (!this.my || this.out) return; if (this.t - (this._hitT || -9) < 0.12) return; this._hitT = this.t; G.sfx.play('tail_screenHit', null, { k: e.k }); G.controller.kick(0.8 * e.k + 0.3, 0.5, 0.08); if (this.cabin && e.k > 0.45) this.cabin.screen.crack(e.lz, e.k); };
    G.on('screenHit', onHit);
    const off = () => { this.dispose(); G.off('scene:exit', off); G.off('screenHit', onHit); };
    G.on('scene:exit', off);
  }

  dispose() {
    this.gone = true;
    const S = this.game.sfx;
    if (S && S.live) for (const k of ['tail_his', 'c3_traffic0', 'c3_traffic1', 'c3_tram']) if (S.loops && S.loops.has(k)) S.stopLoop(k);
    if (this.gun) this.gun.dispose();
    if (this.traffic) this.traffic.dispose();
    if (this.walkers) this.walkers.dispose();
    for (const c of this.cats || []) c.dispose();
    if (this.cabin) this.cabin.dispose();
    if (this.hat) { this.hat.removeFromParent(); this.hat = null; }
    // [C3b] the walking net and the man
    this.walkNet(false);
    if (this.man) { try { this.stage.cast.remove(this.man); } catch (e) { /* the cast cleared already */ } this.man = null; }
    this.game.hud.clearPrompt('tailin'); this.game.hud.clearPrompt('tailwreck');
    this.kit.warn(null);
  }

  // ---- building the moment --------------------------------------------------------------
  // cfg: { my: { x, z, yaw, speed }, his: { x, z, yaw, speed }, leg, phase, choice, damage }
  spawn(cfg) {
    const G = this.game, V = this.V, stage = this.stage;
    V.clear();
    this.phase = cfg.phase || 'start';
    const my = cfg.my, his = cfg.his;
    this.my = V.spawn('coupe', { at: new THREE.Vector3(my.x, 0, my.z), yaw: my.yaw, speed: my.speed || 0, lights: true });
    V.setPlayer(this.my);
    this.my.damage = cfg.damage || 0;
    this.my.warnAt = RULES.wreckWarn;
    this.his = V.spawn('sedan', { at: new THREE.Vector3(his.x, 0, his.z), yaw: his.yaw, speed: his.speed || 0, lights: true, tail: 'crew' });
    this.his.car.limit = 1e9;
    V.prefer = this.his;
    this.driver = new His(this, this.his, { leg: cfg.leg ?? 0, choice: cfg.choice, prev: cfg.prev || null });
    this.his.driver = this.driver;
    this.driverFigure(this.his);
    // my car's knocks
    const mine = this.my;
    mine.on('scrape', (e) => this.scrape(e));
    mine.on('crash', (e) => this.crash(e));
    mine.on('kerb', (e) => G.sfx.play('tail_kerb', null, { k: e.k }));
    mine.on('damage', (e) => this.damaged(e));
    mine.on('post', (e) => this.bentPost(e));
    this.his.on('bump', (e) => this.rammed(e));
    // [4th owner] (the same contact resolved from his side - his car's step
    // found mine - arrives on mine: it is the same shunt, the push on him the
    // other way. A shunt counted only when my car's step happened to find it)
    mine.on('bump', (e) => { if (e.by && e.by === this.his) this.rammed({ by: mine, imp: e.imp, point: e.point, n: e.n ? e.n.clone().negate() : null, k: e.k }); });
    this.his.on('lean', (e) => this.rammed(e));
    mine.on('lean', (e) => { if (e.by && e.by === this.his) this.rammed({ by: mine, imp: 0, point: e.point, n: e.n ? e.n.clone().negate() : null }); });
    this.his.on('post', (e) => this.bentPost(e));
    // the cabin: the eye in the seat, the hands on the wheel, the dials
    this.cabin = stage._cabin || (stage._cabin = new Cabin(G));
    this.cabin.attach(mine);
    this.gun = new WindowGun(this);
    this.traffic = new Traffic(this);
    this.walkers = new Walkers(this);
    // [2nd owner] a cat on a doorstep in Pell Lane that bolts as he pulls
    // away, and one on the crates by the pier's gate that goes as I drive in
    this.cats = [];
    // (Pell Lane's sits on the brick wall's top past the board fence, black
    // against the lit wall beyond, and drops off the back of it as his car
    // goes by; the pier's jumps down off the crates and runs along the shed
    // to the water's edge)
    if (this.phase === 'start') this.cats.push(new Cat(this, { x: PELL_CAT.x, z: PELL_CAT.z, y: PELL_CAT.y, yaw: -Math.PI / 2, near: 9.5, path: [[PELL_CAT.x + 1.6, PELL_CAT.z - 0.4]] }));
    this.cats.push(new Cat(this, { x: PIER.gate.x - 2.4, z: PIER.gate.z - 15, y: 2.0, yaw: -Math.PI / 2, near: 12, path: [[139.6, 170], [140.2, 182], [139.4, 193]] }));
    // the damage I bring from the checkpoint shows
    this.showDamage(true);
    this.place = { my, his };
  }

  // the man at his wheel: through his rear window, a bowler and shoulders
  // against his own headlamps
  driverFigure(car) {
    const g = new THREE.Group(), M = this.stage.M;
    for (const geo of [
      new THREE.SphereGeometry(0.095, 14, 10).scale(1, 1.15, 1).translate(0, 1.36, 0),
      new THREE.CylinderGeometry(0.075, 0.1, 0.12, 14).translate(0, 1.5, 0),
      new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.55, 0),
      new THREE.CylinderGeometry(0.16, 0.16, 0.012, 18).translate(0, 1.465, 0),
      new THREE.SphereGeometry(0.2, 14, 10).scale(1.5, 0.55, 1).translate(0, 1.13, 0),
    ]) g.add(new THREE.Mesh(geo, M.black));
    g.position.set(-0.35, 0, -0.33);
    const id = car.car.meshes.paint.userData.inkId;
    g.traverse((o) => { if (o.isMesh) { o.userData.inkId = id; o.userData.inkFigure = true; o.userData.noRay = true; } });
    car.body.add(g);
    car.driverFig = g;
  }

  bodies() { return this.stage.track.bodies(); }
  gap() { return this.his && this.my ? Math.hypot(this.his.pos.x - this.my.pos.x, this.his.pos.z - this.my.pos.z) : 0; }
  // can I see his car (a straight line from my eye to it, past the walls)
  sees() {
    const e = this.game.camera.position, h = this.his.pos;
    const T = this.stage.track;
    return !T.blocked(e.x, e.z, h.x, h.z, ['wall', 'fence', 'works', 'gate']);
  }

  // ---- per step --------------------------------------------------------------------------------
  // (the proofs: a player's hands, decided each step from what he sees;
  // tools/lib/c3_tail.mjs presses them by real input)
  useBot(profile, opts = {}) { this.bot = makeBot(this, profile, opts); return true; }

  step(dt) {
    const G = this.game, my = this.my, his = this.his;
    if (!my || this.gone) return;
    this.t += dt;
    if (this.bot) { this.botKeys = this.bot.tick(dt); this.botAim = this.bot.aim ? this.bot.aim() : null; if (this.autoBot) this.autoKeys(); }
    this.kit.step(dt);
    // (the fail's black cut to the checkpoint inside that step: the rest of
    // it belongs to the new chase)
    if (this.gone) return;
    this.V.update(dt);
    this.cabin.step(dt);
    if (this.traffic) this.traffic.step(dt);
    if (this.walkers) this.walkers.step(dt);
    for (const c of this.cats || []) c.step(dt);
    this.sound(dt);
    const gap = this.gap();
    this.gapNow = gap;
    // (a record of the run for the bots' proofs and tuning)
    this.logT = (this.logT || 0) + dt;
    if (this.logT >= 0.5) { this.logT = 0; this.log.push([+this.t.toFixed(1), this.phase, +gap.toFixed(0), +my.speed.toFixed(1), +his.speed.toFixed(1), +this.unseen.toFixed(1), +my.damage.toFixed(2)]); if (this.log.length > 600) this.log.shift(); }
    if (this.phase === 'start' && (my.speed > 1.2 || this.t > 2.4)) this.go();
    if (this.phase === 'a' || this.phase === 'b') { this.rules(dt, gap); this.teachStep(); }
    // (his hands gone: the crash runs on its own physics)
    if (this.phase === 'b' && this.driver.state === 'lost') this.phase = 'crash';
    if (this.phase === 'b' || this.phase === 'crash') this.gun.step(dt);
    else this.gun.holster(dt);
    if (this.phase === 'crash') this.crashing(dt);
    if (this.wreck) this.wreckStep(dt);
    this.hisFx(dt);
    if (this.phase === 'c' || this.phase === 'wreck' || this.phase === 'out') { this.toPier(dt); this.atWreck(dt); }
    this.damageStep(dt);
    this.toys(dt);
    // [C3b] chapter VII's stage built a slice a frame from the river road on:
    // the cut at the pier is not felt
    if (this.phase !== 'a' && this.phase !== 'start' && G.stages && G.stages.warm && !G.shotMode) { try { G.stages.warm('pier9', 4); } catch (e) { this._warmErr = String(e); } }
  }

  // he pulls away from the kerb (as I get in; or when I move)
  go() {
    if (this.phase !== 'start') return;
    this.phase = 'a';
    this.driver.state = 'go';
    this.game.sfx.play('tail_horn', this.his.pos, { k: 0.3, dur: 0.25, low: 1 }, { ref: 6 });
  }
  // he turned onto the river road: phase b
  onRiver() {
    if (this.phase !== 'a') return;
    this.phase = 'b';
    this.unseen = 0;
    this.bT = 0;
    this.kit.warn(null);
    // (the line is the beat's: 07_tail.js objectives.river; the gun's card
    // comes in teachStep)
    this.ctx.game.emit('tail:river', {});
  }

  // [3rd owner] the cards, each at its moment (the drive card is the
  // script's, at the kerb): the handbrake as his brake lamps flare for his
  // first corner (he is braking at speed - it was taught at the kerb before,
  // as he pulled away, and replaced the drive card before it could be read);
  // the gun as phase b begins. Failed twice at this beat: the beat's card
  // once more (07_tail.js sets teachAgain).
  teachStep() {
    const K = this.kit, his = this.his;
    const show = (id, text, opts) => (this.teachAgain ? K.teachAgain(id, text, opts) : K.teach(id, text, opts));
    if (this.phase === 'a' && !this._hbTaught && this.t > 2 && his.speedAbs > 5 && his.input.brake > 0.15) {
      this._hbTaught = true;
      show('tail_handbrake', TEACH.handbrake, { secs: 5, until: 'Space' });
    }
    if (this.phase === 'b' && !this._gunTaught) {
      this._gunTaught = true;
      show('tail_gun', TEACH.gun, { secs: 7, until: 'Mouse0' });
    }
    // ([C3b] the shunt's card: the first time he is hurt - hurtCheck)
  }

  rules(dt, gap) {
    const R = RULES, K = this.kit;
    const seen = this.sees();
    this.seen = seen;
    this.unseen = seen ? Math.max(0, this.unseen - dt * 2) : this.unseen + dt;
    // (out of sight round a corner: his horn at whoever is in his way - a
    // trace to follow by ear, from where he is; once a spell, 6 s apart)
    this.hornT = (this.hornT ?? 0) - dt;
    if (this.phase === 'a' && !seen && this.unseen > 1.2 && !this.honked && this.hornT <= 0 && gap < 110) {
      this.honked = true; this.hornT = 6;
      this.game.sfx.play('tail_horn', this.his.pos, { k: 0.7, dur: 0.45 }, { ref: 9 });
    }
    if (seen) this.honked = false;
    this.farT = gap > R.farWarn + 15 ? this.farT + dt : Math.max(0, this.farT - dt * 2);
    const hisZ = this.his.pos.z;
    const gateNear = this.phase === 'b' && this.driver.state !== 'lost' && hisZ > R.gateWarnZ;
    let warn = null;
    // (a: out of sight or far behind; b: the river road runs straight to the
    // pier and he is seen all the way - the race is to stop him before its
    // gate)
    if (this.phase === 'a' && (this.unseen > R.unseenWarn || gap > R.farWarn)) warn = "He's getting away.";
    // [3rd owner] (b: too far behind is too far behind there too - a player
    // who comes onto the river road 110 m back is told so at once, not 23 s
    // later at the pier's gate)
    if (this.phase === 'b' && this.driver.state !== 'lost' && gap > R.farWarn) warn = "He's getting away.";
    // [C3b] phase b's window (rules.js RIVER_B): from RIVER_B.warn s he
    // speeds up and away; the line says so
    const B = RIVER_B;
    if (this.phase === 'b' && this.driver.state !== 'lost') {
      this.bT = (this.bT || 0) + dt;
      this.driver.getaway = clamp((this.bT - B.warn) / (B.t - B.warn), 0, 1);
      // (a far warning already up stays: it is the same news, and the fail
      // needs its warning read a while)
      if (this.bT > B.warn && !warn) warn = "He's pulling away.";
    }
    if (gateNear) warn = "He's nearly at the pier.";
    // [4th owner] (my car one knock from a wreck: said, for a few seconds
    // after each knock past RULES.wreckWarn - the crack and the steam were
    // all a player had, and the third square blow at 50 km/h was "Wrecked."
    // with no line; Car.js warnAt: no single blow wrecks it from below that)
    const dmg = this.my.damage;
    if (dmg > (this._dmg0 ?? dmg) + 0.01 && dmg >= R.wreckWarn) this.dmgWarnT = 4.5;
    this._dmg0 = dmg;
    this.dmgWarnT = Math.max(0, (this.dmgWarnT || 0) - dt);
    // (first, for two seconds after the knock; then under the chase's own)
    if (this.dmgWarnT > 0 && (!warn || this.dmgWarnT > 2.5)) warn = "She won't take much more.";
    K.warn(warn);
    if (this.failing) return;
    const to = this.checkpoint();
    if (this.phase === 'a' && (this.unseen > R.unseenLost || gap > R.farLost || this.farT > R.farT)) return this.fail('Lost him.', to);
    if (this.phase === 'b' && this.driver.state !== 'lost' && (gap > R.farLost || this.farT > R.farT)) return this.fail('Lost him.', 'river');
    if (this.phase === 'b' && this.driver.state !== 'lost' && (hisZ > R.gateZ || this.driver.atPier)) return this.fail('He warned them.', 'river');
    // ([C3b] the window gone: he is a pair of red lamps in the rain)
    // (never "Lost him." with him in front of my bonnet - wedged on something
    // he is mine to shunt - unless I leave him there a long while)
    if (this.phase === 'b' && this.driver.state !== 'lost' && this.bT > B.t && (gap > B.lostGap || (this.bT > B.t + B.extra && gap > 25) || this.bT > B.t + B.extra + 8)) return this.fail('Lost him.', 'river');
  }
  checkpoint() { return this.phase === 'b' ? 'river' : this.ctx.flags.check || 'start'; }
  fail(why, to) {
    if (this.failing) return;
    this.failing = true;
    this.log.push([+this.t.toFixed(1), 'FAIL', why, to]);
    (globalThis.__tailFails || (globalThis.__tailFails = [])).push({ why, to, t: +this.t.toFixed(1), phase: this.phase,
      my: [+this.my.pos.x.toFixed(0), +this.my.pos.z.toFixed(0)], his: [+this.his.pos.x.toFixed(0), +this.his.pos.z.toFixed(0)], gap: +this.gap().toFixed(0), unseen: +this.unseen.toFixed(1), leg: this.driver.legIndex,
      traffic: this.traffic ? this.traffic.cars.map((c) => [+c.v.pos.x.toFixed(0), +c.v.pos.z.toFixed(0), +c.v.speedAbs.toFixed(1)]) : [] });
    // (the gun stays out through the black: holstered with the cars gone)
    this.kit.fail({ why, to });
  }

  // ---- the sound: his engine ahead, the traffic's -----------------------------------------------
  sound(dt) {
    const S = this.game.sfx, his = this.his;
    if (!S || !S.live) return;
    // ([C3b] the note rises as he floors it)
    const bk = (this.driver && this.driver.burstK) || 0;
    if (his && !his.frozen) S.loop('tail_his', his.pos, 0.25 + 0.2 * Math.min(1, Math.abs(his.speed) / 18) + 0.15 * bk, 'brown', 220 + Math.abs(his.speed) * 9 + 110 * bk, 0, true);
    else if (S.loops.has('tail_his')) S.stopLoop('tail_his');
  }

  // ---- what my car meets -----------------------------------------------------------------------
  scrape(e) {
    const G = this.game, r = this.ctx.rng;
    const n = Math.round(6 + 18 * e.k);
    for (let i = 0; i < n; i++) {
      const v = (e.n ? e.n.clone() : _v.set(0, 1, 0).clone()).multiplyScalar(r.range(1, 4)).add(new THREE.Vector3(r.gauss() * 1.5, r.range(0.5, 3), r.gauss() * 1.5)).addScaledVector(this.my.vel, r.range(0.3, 0.9));
      G.fx.sparks.spawn({ pos: e.point.clone().setY(r.range(0.3, 0.9)), vel: v, life: r.range(0.2, 0.55), size: [0.012, 0.02], stretch: 0.05, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
    }
    if (!this._scrapeT || this.t - this._scrapeT > 0.18) {
      this._scrapeT = this.t; G.sfx.play('tail_scrape', e.point, { k: e.k }, { ref: 4 });
      // (a car's tin: it dents)
      if (/^(parked|car|sedan|coupe|truck)$/.test(e.what) && e.k > 0.35) G.sfx.play('c3_dent', e.point, { k: 0.5 * e.k }, { ref: 4 });
    }
    G.controller.shake(0.22 * e.k, 0);
  }
  crash(e) {
    const G = this.game;
    G.sfx.play('tail_crash', e.point, { k: e.k }, { ref: 4 });
    if (/^(parked|car|sedan|coupe|truck)$/.test(e.what)) G.sfx.play('c3_dent', e.point, { k: e.k }, { ref: 4 });
    G.controller.shake(0.8 * e.k + 0.2, 0);
    G.controller.kick(3 * e.k, 3 * e.k, 0.16);
  }
  bentPost(e) {
    const k = e.thing, l = k && k.lamp;
    const G = this.game;
    // (the blow at its foot, then the iron folding over and the glass)
    const at = k && k.x != null ? new THREE.Vector3(k.x, 0.8, k.z) : this.my.pos;
    G.sfx.play('tail_crash', at, { k: 0.55 }, { ref: 4 });
    G.sfx.play('c3_post', at, { k: Math.max(0.5, e.k ?? 0.8) }, { ref: 5 });
    if (l && !l.bent) this.stage.city && this.stage.city.bendPost ? this.stage.city.bendPost(l, e) : bendPost(this.stage, l, e.by || this.my, G);
  }

  // my car's damage in steps (Car.js counts it): a lamp out, the bonnet up
  // and steaming, the wheel pulling, a wreck
  damaged(e) {
    const G = this.game;
    G.sfx.play('tail_crash', e.point || this.my.pos, { k: 0.9 }, { ref: 4 });
    if (e.level >= DAMAGE.wreck && (this.phase === 'a' || this.phase === 'b' || this.phase === 'start')) { this.wrecked = true; this.fail('Wrecked.', this.checkpoint()); return; }
    this.showDamage();
  }
  showDamage(cold = false) {
    const v = this.my, d = Math.floor(v.damage);
    const m = v.model;
    // 1: a headlamp out
    if (d >= 1 && v.lamps && !this._lampOut) {
      this._lampOut = true;
      const c = v.lamps.cones[0]; if (c) c.visible = false;
      v.lamps.intensity *= 0.55;
      if (!cold) this.game.sfx.glass(v.seat(COUPE.lamps[0], _v), 0.5);
    }
    // 2: the bonnet up a little at its front, steaming
    if (d >= 2) { this.steam = true; if (m.meshes && m.meshes.hood) m.meshes.hood.rotation.z = 0.035; }
    // 3: the wheel pulls (a bent track rod)
    if (d >= 3) v.pull = 0.035;
  }
  damageStep(dt) {
    if (!this.steam || !this.my) return;
    const G = this.game, r = this.ctx.rng, v = this.my;
    this.steamAcc = (this.steamAcc || 0) + dt * (2 + Math.min(4, v.speedAbs * 0.2));
    while (this.steamAcc >= 1) {
      this.steamAcc -= 1;
      const p = v.seat(_v.set(r.range(1.7, 2.2), 1.05, r.range(-0.4, 0.4)), new THREE.Vector3());
      const gc = r.range(0.035, 0.05);
      G.fx.smoke.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.2, r.range(0.5, 1.0), r.gauss() * 0.2).addScaledVector(v.vel, 0.6), life: r.range(0.8, 1.4), size: [0.18, 0.18], grow: 0.5, rot: r.next() * 6.28, spin: r.gauss() * 0.3,
        col: [gc, gc, gc], colEnd: [gc * 0.8, gc * 0.8, gc * 0.8], alpha: 0.35, drag: 1.2, fadeIn: 0.1, fadeOut: 0.6, cell: FIRE.SMOKE[r.int(0, 3)] });
    }
  }

  // ---- his car under my rounds (the gun calls hisHit) ---------------------------------------------
  // where the round went in his car's frame: a tyre (it pulls, it slows; two
  // and he spins), the rear window and the man (he ducks and weaves; hit, he
  // loses it), the tank (it leaks, smokes, burns: the engine dies), the body
  hisHit(lp, hit) {
    const D = this.driver, his = this.his;
    if (D.state === 'lost' || D.state === 'stopped') return;
    const G = this.game;
    const H = this.hisDmg || (this.hisDmg = { tyres: 0, man: 0, tank: 0, body: 0, rims: 0 });
    // every round that lands costs him some of his hold on the car (his
    // control, 1 .. 0); where it lands says how much and what it looks like
    // ([4th owner] the costs are rules.js HIT: one round more for every way
    // off the road, and a mix of hits wears him down slowly - the critic's
    // sloppy aim won first try in 8 to 12 s on three hits anywhere)
    // ([C3b] down to HIT.floor and never under: rounds alone never end it)
    const cost = (k) => { D.control = Math.max(HIT.floor, D.control - k); this.hurtCheck(); };
    // [3rd owner] every hit shows where it lands, at 20 to 40 m (the critic:
    // a tyre hit at 22 m showed nothing): a white ink burst at the point the
    // size of a fist's on the screen, sparks big enough to see; and he
    // swerves off the line it came from (the next round is harder)
    const zone = this.hitZone(lp);
    this.hitShow(hit, zone, lp);
    D.swerve(zone === 'tyre' ? (lp.z > 0 ? -1 : 1) : (lp.z > 0 ? -0.6 : 0.6), zone === 'body' ? 0.5 : 1);
    // (a tyre: the wheel itself, or the round through the fender's skirt over
    // it - from behind, the low quarter of the car's back)
    const tyre = zone === 'tyre' ? (lp.x > 0 ? (lp.z > 0 ? 'fr' : 'fl') : (lp.z > 0 ? 'rr' : 'rl')) : null;
    if (tyre) {
      const pullDir = tyre[1] === 'r' ? -1 : 1;
      if (his.grip[tyre] > 0.5) {
        // [C3b] a tyre goes on one round: the bang, the hiss, the quarter
        // down, the rim on the road; he is slower than me from now on and
        // weaves (his.js: his speed by his hold on the car)
        his.grip[tyre] = 0.46;
        H.tyres++;
        G.sfx.play('tail_burst', his.pos, {}, { ref: 5 });
        G.sfx.play('hiss', his.pos, { dur: 1.2 }, { ref: 4 });
        his.pull = (his.pull || 0) + pullDir * 0.03;
        his.flat = his.flat || {}; his.flat[tyre] = 1;
        G.emit('tail:tyre', { tyre });
        cost(HIT.tyre);
      } else {
        // the rim on the road: sparks, the pull harder
        H.rims++;
        his.pull = (his.pull || 0) + pullDir * 0.01;
        cost(HIT.rim);
      }
      return;
    }
    if (zone === 'window') {
      // through the rear window: the first round he ducks (and weaves);
      // ([3rd owner] while he is down below the seat back a round through
      // the glass goes over him - wait for him to come up: the critic's
      // clumsy aim at the middle of his car finished him in two rounds)
      // the second hurts him, the third finds him
      if (D.duck > 0.25 && H.man >= 1) { H.body++; cost(HIT.body * 0.5); return; }
      H.man++;
      D.duck = 1.8;
      G.sfx.play('grunt', his.pos.clone().setY(1.3), { f0: 96, k: 0.5, dur: 0.18 }, { ref: 5 });
      // ([C3b] hit, he ducks lower and drives worse - never off the road)
      cost(HIT.man[Math.min(H.man, HIT.man.length) - 1]);
      return;
    }
    if (zone === 'tank') {
      // the tank: a leak, then smoke, thick smoke, then fire (the engine
      // dies under him)
      H.tank++;
      this.leak = true;
      if (H.tank >= HIT.tankSmoke) this.hisSmoke = Math.max(this.hisSmoke || 0, H.tank >= HIT.tankFire - 1 ? 2 : 1);
      if (H.tank >= HIT.tankFire && !this.hisFire) { this.hisFire = true; D.fire = true; this.fireT = 0; }
      cost(HIT.tank);
      return;
    }
    H.body++;
    if (H.body % 2 === 0) D.duck = 0.9;
    cost(HIT.body);
  }
  // where a round landed on his car (its frame: x ahead, y up, z right), as
  // hisHit reads it
  hitZone(lp) {
    for (const [x, z] of [[1.55, 0.78], [1.55, -0.78], [-1.55, 0.76], [-1.55, -0.76]]) if (Math.abs(lp.x - x) < 0.6 && Math.abs(lp.z - z) < 0.4 && lp.y < 0.85) return 'tyre';
    // ([4th owner] the quarter over a rear wheel from behind: outside the
    // middle metre, below 0.7 m - it was 0.84 m and 0.72)
    if (lp.x < -1.2 && lp.y < 0.7 && Math.abs(lp.z) > 0.5) return 'tyre';
    if (lp.x < -0.9 && lp.y > 1.05 && Math.abs(lp.z) < 0.62) return 'window';
    // ([4th owner] the tank under the boot: the low middle of the back, not
    // all of it below the window - the boot lid and the wings are body)
    if (lp.x < -1.45 && lp.y < 0.82 && Math.abs(lp.z) < 0.55) return 'tank';
    return 'body';
  }
  // [3rd owner] what a hit looks like from my seat, readable at range in the
  // ink: the white burst (the fist's, sized on the screen), a spray of
  // sparks; a tyre: a puff of white off the wet and black rubber flying, the
  // quarter dropping (hisFx's sag); the tank: a dark spurt
  hitShow(hit, zone, lp) {
    const G = this.game, r = this.ctx.rng, his = this.his;
    const p = hit.point.clone();
    const n = hit.normal ? hit.normal.clone() : new THREE.Vector3(0, 1, 0);
    const d = Math.max(4, G.camera.position.distanceTo(p));
    if (G.fx.hit) G.fx.hit.punch(p.clone().addScaledVector(n, 0.05), n.clone().negate(), 0.4, { px: clamp(1300 / d, 34, 70), camera: G.camera });
    const sz = clamp(d * 0.0016, 0.018, 0.05);
    for (let i = 0; i < 16; i++) {
      const v = n.clone().multiplyScalar(r.range(1.5, 4)).add(new THREE.Vector3(r.gauss() * 1.6, r.range(0.6, 2.6), r.gauss() * 1.6)).addScaledVector(his.vel, 0.7);
      G.fx.sparks.spawn({ pos: p.clone(), vel: v, life: r.range(0.18, 0.45), size: [sz * 0.6, sz], stretch: 0.06, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
    }
    if (zone === 'tyre') {
      const w = his.seat(_v.set(lp.x < 0 ? -1.55 : 1.55, 0.3, lp.z > 0 ? 0.9 : -0.9), new THREE.Vector3());
      for (let i = 0; i < 7; i++) {
        const g = r.range(0.85, 1.2);
        G.fx.dust.spawn({ pos: w.clone().add(new THREE.Vector3(r.gauss() * 0.2, r.range(0, 0.3), r.gauss() * 0.2)), vel: new THREE.Vector3(r.gauss() * 0.9, r.range(0.4, 1.4), r.gauss() * 0.9).addScaledVector(his.vel, 0.55),
          life: r.range(0.7, 1.2), size: [0.7, 0.55], grow: 0.9, rot: r.next() * 6.28, col: [g, g, g], alpha: 0.42, drag: 2.0, fadeOut: 0.6 });
      }
      if (G.fx.debris) for (let i = 0; i < 12; i++) {
        G.fx.debris.spawn({ pos: w.clone(), vel: new THREE.Vector3(r.gauss() * 3, r.range(1.5, 4.5), r.gauss() * 3).addScaledVector(his.vel, 0.6), life: r.range(0.6, 1.1),
          size: [r.range(0.08, 0.16), r.range(0.03, 0.06)], rot: r.next() * 6.28, spin: r.gauss() * 10, col: [0.02, 0.02, 0.02], cell: FIRE.CHUNK, gravity: 9.8, ground: 0.03, fadeOut: 0.25 });
      }
    } else if (zone === 'tank') {
      for (let i = 0; i < 10; i++) {
        G.fx.splash.spawn({ pos: p.clone(), vel: n.clone().multiplyScalar(r.range(0.6, 1.6)).add(new THREE.Vector3(r.gauss() * 0.4, r.range(-0.2, 0.6), r.gauss() * 0.4)).addScaledVector(his.vel, 0.85),
          life: r.range(0.35, 0.7), size: [0.02, 0.04], stretch: 0.05, col: [0.05, 0.05, 0.05], alpha: 0.95, cell: 1, gravity: 9.8, ground: 0.02, fadeOut: 0.2 });
      }
    }
  }
  // my car into his (the gun empty, or not): on a hurt car, a shunt on the
  // quarter puts him off the road; whole, he only wobbles
  // [4th owner] (the critic's blocker: any one round made him "hurt" and his
  // rear bumper counted as "the quarter", so a round anywhere and a bump from
  // behind ended phase b - and a player closing in to shoot bumps him without
  // meaning to.) Now the shunt is a deliberate act with its own rule
  // (rules.js RAM): my car pushes his back end across - the contact behind
  // his middle, on his flank, the push mostly sideways in his frame - while
  // he is really hurt (a tyre gone, the man hit twice, his tank smoking, his
  // hold at half or less). A shunt across a car that is not yet hurt jolts it
  // and costs him a little of his hold; a bump from behind costs nothing.
  // [C3b] (the user, 2026-10-03: the shunt on his back corner "seems
  // impossible" - the push had to be mostly sideways in his frame, which a
  // car closing from behind at an angle almost never makes.) Now the rule is
  // the PIT as a driver does it (rules.js RAM): the contact behind his rear
  // axle's line, on a side, my heading 12 to 65 degrees off his and turned
  // into him, closing at a walking pace or more (or held into him). Hurt
  // (this.hurt()): he spins and goes. Whole: a fishtail he catches, and he
  // pulls away (his.js). A straight bump from behind: a shove, nothing more.
  rammed(e) {
    if (!e.by || e.by !== this.my) return;
    if (this.phase === 'a') return this.grazed(e);
    if (this.phase !== 'b') return;
    const D = this.driver, his = this.his, my = this.my;
    if (D.state === 'lost') return;
    const l = his.local(e.point, _w);
    const dy = Math.atan2(Math.sin(my.yaw - his.yaw), Math.cos(my.yaw - his.yaw));
    const ang = Math.abs(dy);
    // (my nose turned into him: on his left (z < 0) my heading is to the right of his)
    const into = Math.sign(dy) === Math.sign(l.z || 1);
    const pit = l.x < RAM.behind && Math.abs(l.z) > RAM.side && ang > RAM.yaw0 && ang < RAM.yaw1 && into;
    const hurt = this.hurt();
    // (held into his corner: the contact unbroken RAM.lean s)
    if (pit) {
      this.leanT = this.t - (this._leanAt ?? -9) < 0.15 ? (this.leanT || 0) + (this.t - this._leanAt) : 0;
      this._leanAt = this.t;
    }
    const go = pit && (e.imp > RAM.imp || this.leanT > RAM.lean);
    this.lastRam = { t: +this.t.toFixed(2), imp: +(e.imp || 0).toFixed(1), lx: +l.x.toFixed(2), lz: +l.z.toFixed(2), ang: +ang.toFixed(2), into, pit, hurt, go };
    (this.rams || (this.rams = [])).push(this.lastRam);
    if (this.rams.length > 40) this.rams.shift();
    // (his back end pushed away from me: the car turns toward my side)
    const spin = l.z < 0 ? 1 : -1;
    if (go && hurt) {
      this._ramWin = true;
      his.yawRate += spin * RAM.spin;
      // (and the shove across: his back end goes out from my wing, the car
      // off my bonnet and away across the road)
      if (e.n) { const k = RAM.shove / Math.max(0.01, Math.hypot(e.n.x, e.n.z)); his.vel.x += e.n.x * k; his.vel.z += e.n.z * k; }
      D.lose(spin);
      this.game.sfx.play('tail_crash', e.point, { k: 0.6 }, { ref: 4 });
      return;
    }
    if (go && !(this._staggerT > this.t - 1.2)) {
      // whole: the tail steps out a little, he catches it, and he goes
      this._staggerT = this.t;
      this.staggers = (this.staggers || 0) + 1;
      his.yawRate += spin * RAM.stagger;
      D.burst(true);
      this.game.sfx.play('c3_dent', e.point, { k: 0.5 }, { ref: 4 });
    }
    if ((e.imp || 0) > 2) D.duck = Math.max(D.duck, 0.5);
  }
  // [C3b] hurt: a tyre gone, the tank smoking, or the man hit (the gun earns
  // the shunt); the teach card for the shunt the first time
  hurt() {
    const H = this.hisDmg || {};
    return (H.tyres || 0) >= 1 || (H.man || 0) >= 1 || (H.tank || 0) >= HIT.tankSmoke;
  }
  hurtCheck() {
    if (this._hurtSeen || !this.hurt() || this.phase !== 'b') return;
    this._hurtSeen = true;
    const K = this.kit;
    (this.teachAgain ? K.teachAgain : K.teach)('tail_ram', TEACH.ram, { secs: 6, until: () => this.driver.state === 'lost' });
  }
  // [C3b] phase a: my bumper on his - a jolt and a sound, nothing more: he
  // keeps his line (the knock on his yaw taken back) and pulls away
  grazed(e) {
    const his = this.his, D = this.driver;
    if (this.t - (this._grazeT ?? -9) < 0.4) return;
    this._grazeT = this.t;
    this.grazes = (this.grazes || 0) + 1;
    his.yawRate *= 0.25;
    his.shake = Math.min(1, (his.shake || 0) + 0.5);
    this.game.sfx.play('c3_dent', e.point || his.pos, { k: 0.35 }, { ref: 4 });
    this.game.controller.shake(0.25, 0);
    D.burst(true);
  }

  // his hands gone: the car does what a car does (Car.js), until it stops
  crashing(dt) {
    const his = this.his, D = this.driver, G = this.game;
    if (!this.crashT) {
      this.crashT = 0.0001;
      // (the grip of a car out of a man's hands, on the wet)
      // ([C3b] the back end lets go first: the spin, then the slide)
      this._grip0 = { ...his.grip };
      his.freeSlide = true;
      // (all four light on the wet - he keeps what he carries, sliding on
      // ahead and round, not scrubbed to a stop beside my wing)
      for (const k of ['fl', 'fr']) his.grip[k] = Math.min(his.grip[k], 0.3);
      for (const k of ['rl', 'rr']) his.grip[k] = Math.min(his.grip[k], 0.18);
      G.sfx.play('tail_screech', his.pos, { dur: 1.8 }, { ref: 6 });
      // ([C3b] a short slowdown as he goes past the windscreen - never the
      // camera: the wheel and the eyes stay mine)
      G.slowmo(0.55, 0.7);
      this.kit.warn(null);
      // (what he hits on the way: the iron, the stalls, the rail - his car's
      // own knocks, heard and seen)
      if (!this._hisKnocks) {
        this._hisKnocks = true;
        const knock = (e, hard) => { if (this.phase !== 'crash') return; (this.knocks || (this.knocks = [])).push([+(this.crashT || 0).toFixed(2), e.what, +(e.k || 0).toFixed(2)]); if (this.t - (this._knockT ?? -9) < 0.15) return; this._knockT = this.t; G.sfx.play(hard ? 'tail_crash' : 'tail_scrape', e.point, { k: Math.max(0.4, e.k || 0.5) }, { ref: 5 }); if (/^(parked|car|sedan|coupe|truck)$/.test(e.what) || hard) G.sfx.play('c3_dent', e.point, { k: e.k || 0.6 }, { ref: 5 }); this.sparksAt(e.point, e.n, (e.k || 0.5) * (hard ? 1.4 : 0.8)); };
        this.his.on('crash', (e) => knock(e, true));
        this.his.on('scrape', (e) => knock(e, false));
      }
    }
    if (this.crashT > 1.7 && this._grip0) { const his0 = this._grip0; for (const k of ['fl', 'fr', 'rl', 'rr']) his.grip[k] = Math.min(his0[k], 0.55); this._grip0 = null; }
    this.crashT += dt;
    // (a record of the spin for the proofs: his place, heading, speed; mine)
    const CL = this.crashLog || (this.crashLog = []);
    if (CL.length < 120) CL.push([+this.crashT.toFixed(2), +his.pos.x.toFixed(1), +his.pos.z.toFixed(1), +his.yaw.toFixed(2), +his.speedAbs.toFixed(1), +this.my.pos.x.toFixed(1), +this.my.pos.z.toFixed(1), +this.my.speedAbs.toFixed(1)]);
    this.leanForCrash(dt);
    // the tyre smoke while he slides
    const r = this.ctx.rng;
    if (his.speedAbs > 2) for (let k = 0; k < 2; k++) {
      const p = his.seat(_v.set(r.range(-2, -1.1), 0.1, r.range(-0.8, 0.8)), new THREE.Vector3());
      G.fx.smoke.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.6, r.range(0.4, 1.0), r.gauss() * 0.6).addScaledVector(his.vel, 0.15), life: r.range(0.9, 1.6), size: [0.5, 0.5], grow: 0.7, rot: r.next() * 6.28, spin: r.gauss() * 0.4,
        col: [0.035, 0.035, 0.035], colEnd: [0.045, 0.045, 0.045], alpha: 0.5, drag: 1.2, fadeIn: 0.05, fadeOut: 0.5, cell: FIRE.SMOKE[r.int(0, 3)] });
    }
    // stopped (or long enough): the wreck
    this.stillT = his.speedAbs < 0.8 ? (this.stillT || 0) + dt : 0;
    if (this.stillT > 0.5 || this.crashT > 7) this.wrecked2();
  }
  // (his car behind the screen's left pillar as I watch him go: the head
  // leans out of the window to see past it, and back once he is clear of it)
  leanForCrash(dt) {
    const my = this.my, his = this.his;
    const e = this.game.camera.position;
    const w0 = Math.atan2(-(his.pos.x - e.x), -(his.pos.z - e.z)) - (my.yaw - Math.PI / 2);
    const w = Math.atan2(Math.sin(w0), Math.cos(w0));
    const want = this.phase === 'crash' || this.phase === 'wreck' ? (w > 0.16 && w < 0.5 ? 0.75 : 0) : 0;
    this.crashLean = (this.crashLean || 0) + (want - (this.crashLean || 0)) * (1 - Math.exp(-dt * 4));
  }
  wrecked2() {
    if (this.phase === 'wreck') return;
    const his = this.his, G = this.game;
    this.phase = 'wreck';
    this.driver.state = 'stopped';
    his.frozen = true;
    his.vel.set(0, 0, 0); his.yawRate = 0;
    this.wreck = { t: 0, lamps: 0 };
    this.hatOff();
    G.sfx.play('tail_hornStuck', his.pos, { dur: 4.2 }, { ref: 6 });
    G.emit('tail:crash', {});
  }
  // the look at the wreck: the man fallen forward onto his wheel, his hat
  // gone out through the side window onto the wet by his door
  hatOff() {
    const his = this.his, f = his.driverFig;
    if (!f || f.userData.hatOff) return;
    f.userData.hatOff = true;
    f.rotation.z = -0.36;
    const hat = new THREE.Group(), inner = new THREE.Group();
    // (the figure's crown, dome and brim: children 1..3)
    for (const m of f.children.slice(1, 4)) inner.add(m);
    inner.position.y = -1.459;
    hat.add(inner);
    // (out of the side away from the rail or the wall he went into)
    const T = this.stage.track;
    const side = (z) => his.seat(_v.set(-0.1, 0, z), new THREE.Vector3());
    let p = side(-1.75);
    if (T && T.blocked && T.blocked(his.pos.x, his.pos.z, p.x, p.z, ['wall', 'fence', 'rail', 'barrier', 'gate', 'works'])) p = side(1.75);
    hat.position.set(p.x, (T && T.ground ? T.ground(p.x, p.z) : 0) + 0.02, p.z);
    hat.rotation.set(0.22, his.yaw + 2.1, -0.12);
    hat.name = 'his hat';
    this.stage.scene.add(hat);
    this.hat = hat;
  }
  wreckStep(dt) {
    const W = this.wreck, his = this.his, G = this.game, r = this.ctx.rng;
    W.t += dt;
    this.leanForCrash(dt);
    // the red lamps going out, one and then the other
    if (his.tail && W.t > 1.6 && W.lamps === 0) { W.lamps = 1; for (const sp of his.tail.userData.glows || []) if (sp.userData.side > 0) sp.visible = false; }
    if (his.tail && W.t > 3.4 && W.lamps === 1) { W.lamps = 2; his.tail.visible = false; for (const sp of his.tail.userData.glows || []) sp.visible = false; if (his.lamps) his.lamps.setOn(false); }
    // steam from under his hood
    if (W.t < 30) {
      W.acc = (W.acc || 0) + dt * (W.t < 5 ? 5 : 1.5);
      while (W.acc >= 1) {
        W.acc -= 1;
        const p = his.seat(_v.set(r.range(1.3, 2.1), 1.05, r.range(-0.5, 0.5)), new THREE.Vector3());
        const gc = r.range(0.03, 0.05);
        G.fx.smoke.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.15, r.range(0.5, 1.0), r.gauss() * 0.15), life: r.range(1.4, 2.2), size: [0.22, 0.22], grow: 0.55, rot: r.next() * 6.28, spin: r.gauss() * 0.3,
          col: [gc, gc, gc], colEnd: [gc * 0.8, gc * 0.8, gc * 0.8], alpha: 0.4, drag: 0.6, fadeIn: 0.1, fadeOut: 0.7, cell: FIRE.SMOKE[r.int(0, 3)] });
      }
    }
    // [C3b] his door, and he is out on the road by it, crouched over; the
    // line says what to do: get out and see to him
    if (W.t > 1.3 && !this.man) this.manOut();
    if (W.t > 0.6 && this.phase === 'wreck' && !this._seeTo) { this._seeTo = true; this.kit.objective('See to the driver.'); }
  }

  // [C3b] the man out of his wreck: crouched over on the road by his door,
  // a hand on the wet, the bowler gone (it lies by the car: hatOff)
  manOut() {
    const his = this.his, T = this.stage.track, G = this.game;
    if (this.man) return;
    // (the side of his car with the road, not the rail or the wall: where his hat went)
    // ([C3b] by his door, or the other, or at his car's tail or nose: the
    // first with room - my car may be against his)
    // (the nearest of them to my car: I walk up to him, not round his car)
    const cands = [[0.9, -2.25], [0.9, 2.25], [-3.7, -0.6], [3.7, 0.6]].map((q) => ({ q, d: his.seat(_v.set(q[0], 0, q[1]), new THREE.Vector3()).distanceTo(this.my.pos) })).sort((a, b) => a.d - b.d).map((o) => o.q);
    const cs = this.free(his, cands, 0.6) || [0.9, -2.25];
    const p = his.seat(_v.set(cs[0], 0, cs[1]), new THREE.Vector3());
    const side = Math.sign(cs[1]) || 1;
    void T;
    // (he faces down the river road to the pier, so his right arm, held out
    // ahead of him and up, points there: tail_point's arm in his frame)
    const pd = { x: PIER.gate.x - p.x, z: PIER.gate.z - p.z };
    const arm = { x: -0.25, z: 1 };
    const yaw = Math.atan2(pd.x, pd.z) - Math.atan2(arm.x, arm.z);
    const cast = this.stage.cast;
    const kind = cast.has('watcher') ? 'watcher' : 'couple_him';
    const c = cast.spawn(kind, { at: { x: p.x, z: p.z }, yaw, name: 'tailman' });
    c.noGlance = true;
    c.setState('tail_crouched', 0);
    // (the bowler's bone shrunk to nothing, as the block's ending does: it
    // lies on the road by his car - hatOff)
    if (c.fig && c.fig.bones && c.fig.bones.hat) c.fig.bones.hat.scale.setScalar(1e-4);
    this.man = c;
    this.manAt = { x: p.x, z: p.z, side };
    if (his.driverFig) his.driverFig.visible = false;
    G.sfx.play('tail_door', his.pos, { open: true }, { ref: 5 });
    G.emit('tail:manOut', {});
  }

  // ---- [C3b] out of the car by his wreck: walk up, the line, back in -----------------------------
  // (the walking net round the wreck: the stage's bounds round the eye, the
  // two cars and the man solid; taken away when I get back in or leave)
  walkNet(on) {
    const S = this.stage, C = S.colliders;
    if (on && !this._net) {
      this._net = { bounds: { ...C.bounds }, boxes: [], circles: [] };
      const B = S.part && S.part('bounds');
      if (B && B.walkAround) B.walkAround(this.my.pos.x, this.my.pos.z, 60);
      for (const v of [this.my, this.his]) { const b = v.box(); const o = { cx: b.cx, cz: b.cz, hx: b.hx + 0.05, hz: b.hz + 0.05, c: b.c, s: b.s, angle: 0, tag: 'tailcar' }; C.boxes.push(o); this._net.boxes.push(o); }
      if (this.manAt) this._net.circles.push(C.addCircle(this.manAt.x, this.manAt.z, 0.42, 'tailman'));
    } else if (!on && this._net) {
      const N = this._net;
      C.boxes = C.boxes.filter((b) => !N.boxes.includes(b));
      C.circles = C.circles.filter((c) => !N.circles.includes(c));
      C.bounds = N.bounds;
      this._net = null;
    }
  }
  // the driver's door: where I stand out of it, and where E gets me back in
  // (where it is: the door side with room - not into the rail, a wall, or
  // his car against mine; chosen once, as I get out)
  doorAt(out = new THREE.Vector3()) {
    const my = this.my;
    if (this._doorSide == null) this._doorSide = this.free(my, [[-0.15, -1.75], [-0.15, 1.75]], 0.45) || [-0.15, -1.75];
    return my.seat(_v.set(this._doorSide[0], 0, this._doorSide[1]), out);
  }
  // the first of `cands` (in car's frame) clear of the walls, the rail and both cars
  free(car, cands, r) {
    const T = this.stage.track;
    const p = new THREE.Vector3();
    for (const c of cands) {
      car.seat(_v.set(c[0], 0, c[1]), p);
      if (T && T.blocked && T.blocked(car.pos.x, car.pos.z, p.x, p.z, ['wall', 'fence', 'rail', 'barrier', 'gate', 'works', 'column', 'post'])) continue;
      let hit = false;
      for (const v of [this.my, this.his]) { const l = v.local(p, _w); if (Math.abs(l.x) < v.spec.halfL + r && Math.abs(l.z) < v.spec.halfW + r) hit = true; }
      if (T && T.statics) for (const k of T.statics(p.x, p.z, 1.5, [])) {
        if (k.gone) continue;
        if (k.r != null) { if (Math.hypot(k.x - p.x, k.z - p.z) < k.r + r) hit = true; continue; }
        const kx = (p.x - k.cx) * k.c - (p.z - k.cz) * k.s, kz = (p.x - k.cx) * k.s + (p.z - k.cz) * k.c;
        if (Math.abs(kx) < k.hx + r && Math.abs(kz) < k.hz + r) hit = true;
      }
      if (!hit) return c;
    }
    return null;
  }
  getOut() {
    const G = this.game, my = this.my, his = this.his;
    this.phase = 'out';
    G.hud.clearPrompt('tailwreck');
    this.byWreck = false;
    my.input.throttle = 0; my.input.brake = 1; my.input.steer = 0;
    my.vel.set(0, 0, 0); my.yawRate = 0;
    G.sfx.play('tail_door', null, { open: true });
    this._doorSide = null;
    this.walkNet(true);
    const d = this.doorAt();
    const tgt = this.manAt || his.pos;
    const yaw = Math.atan2(-(tgt.x - d.x), -(tgt.z - d.z));
    G.player.hands.equip('empty');
    G.controller.setMode('walk', { pose: { x: d.x, z: d.z, yaw, pitch: -0.08 }, ease: 0.55 });
    this.outT = 0;
    G.emit('tail:out', {});
  }
  getIn() {
    const G = this.game;
    G.hud.clearPrompt('tailin');
    this._eUsed = this.t;
    this.walkNet(false);
    G.sfx.play('tail_door', null, { open: false });
    // (the same cut into the seat as the chase's)
    this.cabin.attach(this.my);
    if (!this.lineSaid) this.sayLine();
    this.phase = 'c';
    this.kit.objective('Pier 9.');
    G.emit('tail:pier', {});
  }
  // his one line, subtitled; his arm out down the river road
  sayLine() {
    if (this.lineSaid) return;
    this.lineSaid = true;
    this.game.hud.say('Pier nine. Tonight.', 3.0);
    this.game.sfx.play('grunt', this.man ? this.man.pos || this.his.pos : this.his.pos, { f0: 88, k: 0.35, dur: 0.3 }, { ref: 4 });
    if (this.man) { this.man.setState('tail_point', 0.35); this.pointT = 3.2; }
    this.game.emit('tail:line', {});
  }
  atWreck(dt) {
    const G = this.game, my = this.my, his = this.his;
    if (!his || this.parked) return;
    if (this.pointT > 0) { this.pointT -= dt; if (this.pointT <= 0 && this.man) this.man.setState('tail_crouched', 0.5); }
    if (this.phase === 'wreck') {
      // stopped by his wreck: E, out of the car
      const d = Math.hypot(my.pos.x - his.pos.x, my.pos.z - his.pos.z);
      const near = !!this.man && d < 32 && my.speedAbs < 1.5 && !this.failing;
      if (near !== !!this.byWreck) { this.byWreck = near; if (near) G.hud.prompt('E  get out', null, 'tailwreck'); else G.hud.clearPrompt('tailwreck'); }
      if (near && G.pressed('KeyE')) this.getOut();
      return;
    }
    if (this.phase !== 'out') return;
    this.outT += dt;
    // the line: walked up to him and looking at him, or passing near him
    const e = G.camera.position, m = this.manAt;
    if (m && !this.lineSaid) {
      const dm = Math.hypot(e.x - m.x, e.z - m.z);
      const f = G.camera.getWorldDirection(_w);
      const look = ((m.x - e.x) * f.x + (m.z - e.z) * f.z) / Math.max(0.01, dm * Math.hypot(f.x, f.z));
      if ((dm < 2.2 && look > 0.8) || dm < 1.4 || (this.outT > 1.5 && dm < 6 && this._dm0 != null && dm > this._dm0 + 0.02 && this._dm0 < 6)) this.sayLine();
      this._dm0 = dm;
    }
    // back in: E at my door
    const dd = this.doorAt(), dIn = Math.hypot(e.x - dd.x, e.z - dd.z);
    const atDoor = dIn < 1.9 && this.outT > 0.8;
    if (atDoor !== !!this._atDoor) { this._atDoor = atDoor; if (atDoor) G.hud.prompt('E  get in', null, 'tailin'); else G.hud.clearPrompt('tailin'); }
    if (atDoor && G.pressed('KeyE')) this.getIn();
  }
  sparksAt(point, n, k = 1) {
    const G = this.game, r = this.ctx.rng;
    if (!point) return;
    const N = Math.round(8 + 18 * Math.min(1.5, k));
    for (let i = 0; i < N; i++) {
      const v = (n ? n.clone() : new THREE.Vector3(0, 1, 0)).multiplyScalar(r.range(1, 4)).add(new THREE.Vector3(r.gauss() * 1.8, r.range(0.6, 3.2), r.gauss() * 1.8)).addScaledVector(this.his.vel, r.range(0.3, 0.8));
      G.fx.sparks.spawn({ pos: point.clone().setY(r.range(0.3, 0.9)), vel: v, life: r.range(0.2, 0.55), size: [0.014, 0.022], stretch: 0.05, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
    }
  }

  // ---- the room toys: Q the horn (the traffic answers), E the dash's lamp
  // switch, the handbrake's ratchet and the tyres on the wet
  toys(dt) {
    const G = this.game, my = this.my;
    if (this.failing || this.parked || G.controller.mode !== 'drive') return;
    if (G.pressed('KeyQ')) {
      G.sfx.play('tail_horn', my.seat(_v.set(2, 1, 0), new THREE.Vector3()), { k: 1, dur: 0.55 }, { ref: 3 });
      if (this.traffic) this.traffic.horn();
      G.emit('tail:horn', {});
    }
    // (E at the pier's gate is the getting out: toPier has it)
    if (G.pressed('KeyE') && !(this.phase === 'c' && Math.hypot(my.pos.x - PIER.park.x, my.pos.z - PIER.park.z) < 14) && !this.byWreck && this._eUsed !== this.t) {
      const on = !(my.lamps && my.lamps.on);
      if (my.lamps) my.lamps.setOn(on);
      this.cabin.lampSwitch(on);
      G.sfx.play('c3_switch', null, {});
    }
    const hb = !!my.input.handbrake;
    if (hb && !this._hb && my.speedAbs > 4) G.sfx.play('c3_handbrake', my.pos, { k: Math.min(1, my.speedAbs / 14) }, { ref: 3 });
    this._hb = hb;
  }

  // ---- his car as my rounds leave it: the state is on the car -----------------------------------
  hisFx(dt) {
    const his = this.his, D = this.driver, G = this.game, r = this.ctx.rng;
    if (!his) return;
    // his brake lamps: the crew's red flares as he brakes (seen far down a
    // wet street: where he will turn)
    if (his.tail && !this.wreck) {
      const k = his.input.brake > 0.1 ? 1 : 0;
      this._brk = (this._brk ?? 0) + (k - (this._brk ?? 0)) * (1 - Math.exp(-dt * 14));
      if (his.tail.material && his.tail.material.color) {
        const base = his.tail.userData.base || (his.tail.userData.base = his.tail.material.color.clone());
        // ([C3b] and brighter as he floors it: pulling away from me)
        his.tail.material.color.copy(base).multiplyScalar(1 + this._brk * 1.6 + (D.burstK || 0) * 0.9);
      }
      for (const sp of his.tail.userData.glows || []) { const d = Math.hypot(his.pos.x - this.my.pos.x, his.pos.z - this.my.pos.z); sp.scale.setScalar(Math.min(0.62, 0.16 + d * 0.011) * (1 + this._brk * 0.5)); }
    }
    // the man ducks
    if (his.driverFig) { const want = D.duck > 0 || D.state === 'lost' || D.state === 'stopped' ? -0.3 : 0; his.driverFig.position.y += (want - his.driverFig.position.y) * (1 - Math.exp(-dt * 10)); }
    // the sag on a flat
    // ([3rd owner] the quarter drops so it reads at 30 m: about 9 cm at the
    // flat's corner, settling in with a bounce as the tyre goes)
    if (his.flat) {
      const want = ((his.flat.fr || 0) + (his.flat.rr || 0) - (his.flat.fl || 0) - (his.flat.rl || 0)) * 0.085;
      const wp = ((his.flat.rl || 0) + (his.flat.rr || 0) - (his.flat.fl || 0) - (his.flat.fr || 0)) * 0.045;
      this._sagV = (this._sagV || 0) + ((want - (his.sagRoll || 0)) * 120 - (this._sagV || 0) * 9) * dt;
      his.sagRoll = (his.sagRoll || 0) + this._sagV * dt;
      his.sagPitch = (his.sagPitch || 0) + (wp - (his.sagPitch || 0)) * (1 - Math.exp(-dt * 10));
    }
    // [2nd owner] the spray off his tyres on the wet: a wake of mist that
    // hangs a moment where he went - round a corner the last of it, lit by
    // the lamps, shows which way he turned (a trace to read)
    // (not close by: within a dozen metres each puff is a ball as big as a
    // head on the screen)
    const gapNow = this.gapNow ?? this.gap();
    if (!his.frozen && his.speedAbs > 5 && G.fx.dust && gapNow > 13 && gapNow < 60 && this.phase !== 'crash') {
      this.sprayAcc = (this.sprayAcc || 0) + dt * Math.min(30, his.speedAbs * 2);
      while (this.sprayAcc >= 1) {
        this.sprayAcc -= 1;
        const sd = r.next() < 0.5 ? -0.8 : 0.8;
        const p = his.seat(_v.set(-1.6 - r.next() * 0.5, 0.18, sd + r.gauss() * 0.12), new THREE.Vector3());
        const g = r.range(1.0, 1.35);
        G.fx.dust.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.4, r.range(0.2, 0.6), r.gauss() * 0.4).addScaledVector(his.vel, 0.3), life: r.range(0.9, 1.5), size: [0.5, 0.3], grow: 0.35, rot: r.next() * 6.28,
          col: [g, g, g], alpha: 0.085, drag: 1.8, fadeOut: 0.75 });
      }
    }
    // a rim on the road: sparks
    if (his.flat && his.speedAbs > 3 && !his.frozen) {
      for (const [k, x, z] of [['fl', 1.55, -0.78], ['fr', 1.55, 0.78], ['rl', -1.55, -0.76], ['rr', -1.55, 0.76]]) {
        if (!(his.flat[k] >= 0.9)) continue;
        if (r.next() > 0.6) continue;
        const p = his.seat(_v.set(x, 0.05, z), new THREE.Vector3());
        G.fx.sparks.spawn({ pos: p, vel: new THREE.Vector3(r.gauss(), r.range(0.5, 2), r.gauss()).addScaledVector(his.vel, -0.25), life: r.range(0.15, 0.4), size: [0.01, 0.016], stretch: 0.05, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
      }
    }
    // [4th owner] a soft tyre (one round in it): a thin white spray of air and
    // wet off it behind the wheel, all the while - the round mattered, and
    // one more there blows it (the quarter's half dip is a few pixels at 25 m)
    if (his.flat && his.speedAbs > 2 && !his.frozen && G.fx.dust) {
      for (const [k, x, z] of [['fl', 1.55, -0.86], ['fr', 1.55, 0.86], ['rl', -1.55, -0.86], ['rr', -1.55, 0.86]]) {
        const f = his.flat[k];
        if (!f || f >= 0.9) continue;
        this['_soft' + k] = (this['_soft' + k] || 0) + dt * 14;
        while (this['_soft' + k] >= 1) {
          this['_soft' + k] -= 1;
          const p = his.seat(_v.set(x - 0.25, 0.22, z), new THREE.Vector3());
          const g = r.range(1.1, 1.4);
          G.fx.dust.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.35, r.range(0.3, 0.9), r.gauss() * 0.35).addScaledVector(his.vel, 0.45), life: r.range(0.5, 0.9), size: [0.32, 0.22], grow: 0.6, rot: r.next() * 6.28,
            col: [g, g, g], alpha: 0.3, drag: 2.2, fadeOut: 0.6 });
        }
      }
    }
    // the tank: smoke, then fire; the fire takes him
    if (this.hisSmoke || this.hisFire) {
      this.hisSmokeAcc = (this.hisSmokeAcc || 0) + dt * (this.hisFire ? 16 : this.hisSmoke >= 2 ? 11 : 6);
      while (this.hisSmokeAcc >= 1) {
        this.hisSmokeAcc -= 1;
        const p = his.seat(_v.set(r.range(-2.4, -1.9), r.range(0.4, 0.8), r.range(-0.5, 0.5)), new THREE.Vector3());
        const gc = r.range(0.012, 0.025);
        G.fx.smoke.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.3, r.range(0.6, 1.4), r.gauss() * 0.3).addScaledVector(his.vel, 0.3), life: r.range(1.0, 1.8), size: [0.35, 0.35], grow: 0.8, rot: r.next() * 6.28, spin: r.gauss() * 0.4,
          col: [gc, gc, gc], colEnd: [gc, gc, gc], alpha: 0.6, drag: 1.0, fadeIn: 0.05, fadeOut: 0.6, cell: FIRE.SMOKE[r.int(0, 3)] });
      }
    }
    if (this.hisFire) {
      this.fireT = (this.fireT || 0) + dt;
      this.flameAcc = (this.flameAcc || 0) + dt * 22;
      while (this.flameAcc >= 1) {
        this.flameAcc -= 1;
        const s = r.range(0.25, 0.5);
        const p = his.seat(_v.set(r.range(-2.4, -1.7), r.range(0.3, 0.7), r.range(-0.6, 0.6)), new THREE.Vector3());
        G.fx.fire.spawn({ pos: p, vel: new THREE.Vector3(r.gauss() * 0.2, r.range(0.8, 1.6), r.gauss() * 0.2).addScaledVector(his.vel, 0.7), life: r.range(0.2, 0.4), size: [s * 0.7, s], grow: 0.3, rot: r.gauss() * 0.2,
          col: r.chance(0.5) ? FIRE_COL.yellow : FIRE_COL.orange, colEnd: FIRE_COL.deep, colPow: 1.3, cell: FIRE.FLAME[r.int(0, 3)], fadeIn: 0.04, fadeOut: 0.3 });
      }
      if (!this._fireLight) { this._fireLight = true; if (G.sfx.hiss) G.sfx.hiss(his.pos); }
    }
  }

  // (debugging in shot mode: the bot's keys as the game's virtual keys,
  // its aim straight onto the look - ?c3auto=good)
  autoKeys() {
    const G = this.game, V = G.vin, k = this.botKeys || {}, a = this.botAim;
    for (const [c, on] of [['KeyW', k.W], ['KeyS', k.S], ['KeyA', k.A], ['KeyD', k.D], ['Space', k.Space], ['Mouse2', a && a.rmb]]) { if (on) V.held.add(c); else V.held.delete(c); }
    // ([4th owner] a hand's aim closes at its own rate: a.gain)
    const f = a && a.gain ? 1 - Math.exp(-a.gain / 60) : 0.5;
    if (a && a.rmb && G.controller.drive) { const L = G.controller.drive.look; L.yaw -= a.dyaw * f; L.pitch += a.dpitch * f; }
    if (a && a.fire) V.down.add('Mouse0');
  }


  // ---- the drive to the pier, the stop by its gate ---------------------------------------------
  toPier(dt) {
    if (this.phase !== 'c') return;
    const G = this.game, v = this.my;
    const d = Math.hypot(v.pos.x - PIER.park.x, v.pos.z - PIER.park.z);
    // ([3rd owner] anywhere in the painted bay or near it, stopped or
    // nearly: the critic found the stop hard to find)
    const here = d < 14 && v.speedAbs < 0.9;
    if (here && !this.parked) G.hud.prompt('E  get out', null, 'tail');
    else if (!this.parked) G.hud.clearPrompt('tail');
    if (here && !this.parked && G.pressed('KeyE')) {
      this.parked = true;
      G.hud.clearPrompt('tail');
      // the lamps off (the switch on the dash), the engine, the door
      G.sfx.play('tail_click', null, {});
      if (v.lamps) v.lamps.setOn(false);
      this.lampsOff = true;
      this.phase = 'parked';
      // (the head turns out of the side window to the shed's doors as the
      // door opens: chapter VII begins at them)
      if (G.controller.drive) Object.assign(G.controller.drive, { focus: new THREE.Vector3(PIER.gate.x, 3.2, PIER.gate.z), focusMax: 1.2, focusPitch: 0.14, focusFov: -2, focusRate: 1.7 });
      G.emit('tail:parked', {});
    }
  }
}

// a lamp post the car went through: it leans over, its lamp swinging, out
export function bendPost(stage, l, car, G) {
  l.bent = true;
  const g = l.group;
  if (!g) return;
  const away = new THREE.Vector3(car.vel.x, 0, car.vel.z);
  if (away.lengthSq() < 0.01) away.set(1, 0, 0);
  away.normalize();
  const axis = new THREE.Vector3(away.z, 0, -away.x);
  if (!l.q0) l.q0 = g.quaternion.clone();
  const q0 = l.q0;
  const L = stage.lamps;
  let lean = 0, leanV = 3.2;
  const st = { t: 0 };
  const step = (dt) => {
    st.t += dt;
    leanV += ((0.95 - lean) * 30 - leanV * 5) * dt;
    lean += leanV * dt;
    g.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(axis, Math.min(1.2, lean))).multiply(q0);
    g.updateMatrixWorld(true);
    L.syncInstance(l, true);
    const head = L.geo.head.clone().applyMatrix4(g.matrixWorld);
    l.head.copy(head);
    l.cone.position.copy(head);
    l.cone.material.uniforms.uApex.value.copy(head);
    l.entry.position.copy(head);
    return st.t < 2.5;
  };
  (stage._posts || (stage._posts = [])).push(step);
  if (!stage._postsHooked) {
    stage._postsHooked = true;
    stage.updaters.push({ tick: 41, fn: (api, dt) => { stage._posts = stage._posts.filter((f) => f(dt)); }, api: null });
    stage.updaters.sort((a, b) => a.tick - b.tick);
  }
  // it goes out after a buzz ([3rd owner] a short one: a shot lamp may buzz
  // back on for up to 1.3 s, and the critic saw a bent post's glowing head
  // still lit 1.5 s after the blow, riding in front of the bonnet)
  if (L.shootOut && G) { L.shootOut(l, away); l.buzz = { t: 0, at: 0.04, len: 0.18 }; }
}
void START; void EW; void riverPoint; void riverFrame; void riverSAtZ; void RIVER; void LEGS; void clamp;
