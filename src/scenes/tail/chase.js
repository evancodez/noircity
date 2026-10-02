import * as THREE from 'three';
import { COUPE } from '../../vehicles/models.js';
import { Cabin } from '../../vehicles/cabin.js';
import { DAMAGE } from '../../vehicles/Car.js';
import { PIER, START, EW, riverPoint, riverFrame, riverSAtZ, RIVER } from '../../stages/city/plan.js';
import { His, LEGS } from './his.js';
import { WindowGun } from './gun.js';
import { Traffic } from './traffic.js';
import { makeKit } from './kit.js';
import { RULES } from './rules.js';
import { makeBot } from './bot.js';
import { FIRE } from '../../fx/fxTextures.js';
import { FIRE_COL } from '../../fx/Explosion.js';

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
    globalThis.__tail = this;
    const G = this.game;
    const onHit = (e) => { if (!this.my || this.out) return; if (this.t - (this._hitT || -9) < 0.12) return; this._hitT = this.t; G.sfx.play('tail_screenHit', null, { k: e.k }); G.controller.kick(0.8 * e.k + 0.3, 0.5, 0.08); if (this.cabin && e.k > 0.45) this.cabin.screen.crack(e.lz, e.k); };
    G.on('screenHit', onHit);
    const off = () => { this.dispose(); G.off('scene:exit', off); G.off('screenHit', onHit); };
    G.on('scene:exit', off);
  }

  dispose() {
    const S = this.game.sfx;
    if (S && S.live) for (const k of ['tail_his', 'c3_traffic0', 'c3_traffic1', 'c3_tram']) if (S.loops && S.loops.has(k)) S.stopLoop(k);
    if (this.gun) this.gun.dispose();
    if (this.traffic) this.traffic.dispose();
    if (this.cabin) this.cabin.dispose();
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
    this.his = V.spawn('sedan', { at: new THREE.Vector3(his.x, 0, his.z), yaw: his.yaw, speed: his.speed || 0, lights: true, tail: 'crew' });
    this.his.car.limit = 1e9;
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
    this.his.on('post', (e) => this.bentPost(e));
    // the cabin: the eye in the seat, the hands on the wheel, the dials
    this.cabin = stage._cabin || (stage._cabin = new Cabin(G));
    this.cabin.attach(mine);
    this.gun = new WindowGun(this);
    this.traffic = new Traffic(this);
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
    if (!my) return;
    this.t += dt;
    if (this.bot) { this.botKeys = this.bot.tick(dt); this.botAim = this.bot.aim ? this.bot.aim() : null; if (this.autoBot) this.autoKeys(); }
    this.kit.step(dt);
    this.V.update(dt);
    this.cabin.step(dt);
    if (this.traffic) this.traffic.step(dt);
    this.sound(dt);
    const gap = this.gap();
    this.gapNow = gap;
    // (a record of the run for the bots' proofs and tuning)
    this.logT = (this.logT || 0) + dt;
    if (this.logT >= 0.5) { this.logT = 0; this.log.push([+this.t.toFixed(1), this.phase, +gap.toFixed(0), +my.speed.toFixed(1), +his.speed.toFixed(1), +this.unseen.toFixed(1), +my.damage.toFixed(2)]); if (this.log.length > 600) this.log.shift(); }
    if (this.phase === 'start' && (my.speed > 1.2 || this.t > 2.4)) this.go();
    if (this.phase === 'a' || this.phase === 'b') this.rules(dt, gap);
    // (his hands gone: the crash runs on its own physics)
    if (this.phase === 'b' && this.driver.state === 'lost') this.phase = 'crash';
    if (this.phase === 'b' || this.phase === 'crash') this.gun.step(dt);
    else this.gun.holster(dt);
    if (this.phase === 'crash') this.crashing(dt);
    if (this.wreck) this.wreckStep(dt);
    this.hisFx(dt);
    if (this.phase === 'c' || this.phase === 'wreck') this.toPier(dt);
    this.damageStep(dt);
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
    this.unseen = 0; this.farT = 0;
    this.kit.warn(null);
    this.kit.objective('Stop him before the docks.');
    this.kit.teach('tail_gun', [['RMB', 'lean out and aim'], ['LMB', 'fire']], { secs: 6, until: 'Mouse0' });
    this.ctx.game.emit('tail:river', {});
  }

  rules(dt, gap) {
    const R = RULES, K = this.kit;
    const seen = this.sees();
    this.seen = seen;
    this.unseen = seen ? Math.max(0, this.unseen - dt * 2) : this.unseen + dt;
    this.farT = gap > R.farWarn + 15 ? this.farT + dt : Math.max(0, this.farT - dt * 2);
    const hisZ = this.his.pos.z;
    const gateNear = this.phase === 'b' && this.driver.state !== 'lost' && hisZ > R.gateWarnZ;
    let warn = null;
    // (a: out of sight or far behind; b: the river road runs straight to the
    // pier and he is seen all the way - the race is to stop him before its
    // gate)
    if (this.phase === 'a' && (this.unseen > R.unseenWarn || gap > R.farWarn)) warn = "He's getting away.";
    if (gateNear) warn = "He's nearly at the pier.";
    K.warn(warn);
    if (this.failing) return;
    const to = this.checkpoint();
    if (this.phase === 'a' && (this.unseen > R.unseenLost || gap > R.farLost || this.farT > R.farT)) return this.fail('Lost him.', to);
    if (this.phase === 'b' && this.driver.state !== 'lost' && (hisZ > R.gateZ || this.driver.atPier)) return this.fail('He warned them.', 'river');
  }
  checkpoint() { return this.phase === 'b' ? 'river' : this.ctx.flags.check || 'start'; }
  fail(why, to) {
    if (this.failing) return;
    this.failing = true;
    this.log.push([+this.t.toFixed(1), 'FAIL', why, to]);
    (globalThis.__tailFails || (globalThis.__tailFails = [])).push({ why, to, t: +this.t.toFixed(1), phase: this.phase });
    // (the gun stays out through the black: holstered with the cars gone)
    this.kit.fail({ why, to });
  }

  // ---- the sound: his engine ahead, the traffic's -----------------------------------------------
  sound(dt) {
    const S = this.game.sfx, his = this.his;
    if (!S || !S.live) return;
    if (his && !his.frozen) S.loop('tail_his', his.pos, 0.25 + 0.2 * Math.min(1, Math.abs(his.speed) / 18), 'brown', 220 + Math.abs(his.speed) * 9, 0, true);
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
    if (!this._scrapeT || this.t - this._scrapeT > 0.18) { this._scrapeT = this.t; G.sfx.play('tail_scrape', e.point, { k: e.k }, { ref: 4 }); }
    G.controller.shake(0.22 * e.k, 0);
  }
  crash(e) {
    const G = this.game;
    G.sfx.play('tail_crash', e.point, { k: e.k }, { ref: 4 });
    G.controller.shake(0.8 * e.k + 0.2, 0);
    G.controller.kick(3 * e.k, 3 * e.k, 0.16);
  }
  bentPost(e) {
    const k = e.thing, l = k && k.lamp;
    const G = this.game;
    G.sfx.play('tail_crash', l ? l.head.clone().setY(1) : this.my.pos, { k: 0.8 }, { ref: 4 });
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
    const side = lp.z > 0 ? 1 : -1;
    // every round that lands costs him some of his hold on the car (his
    // control, 1 .. 0); where it lands says how much and what it looks like
    const cost = (k, dir = side) => { D.control -= k; if (D.control <= 0.15) D.lose(dir); };
    // (a tyre: the wheel itself, or the round through the fender's skirt over
    // it - from behind, the low quarter of the car's back)
    const tyreAt = [[1.55, 0.78, 'fr'], [1.55, -0.78, 'fl'], [-1.55, 0.76, 'rr'], [-1.55, -0.76, 'rl']];
    let tyre = null;
    for (const [x, z, k] of tyreAt) if (Math.abs(lp.x - x) < 0.65 && Math.abs(lp.z - z) < 0.45 && lp.y < 0.9) tyre = k;
    if (!tyre && lp.x < -1.2 && lp.y < 0.78 && Math.abs(lp.z) > 0.3) tyre = lp.z > 0 ? 'rr' : 'rl';
    if (tyre) {
      const pullDir = tyre[1] === 'r' ? -1 : 1;
      if (his.grip[tyre] > 0.5) {
        // a tyre: it goes with a bang, the car sags on it, pulls and slows;
        // two gone and he cannot hold it
        his.grip[tyre] = 0.32;
        H.tyres++;
        G.sfx.play('tail_burst', his.pos, {}, { ref: 5 });
        D.pace *= 0.85;
        his.pull = (his.pull || 0) + pullDir * 0.04;
        his.flat = his.flat || {}; his.flat[tyre] = 1;
        G.emit('tail:tyre', { tyre });
        if (H.tyres >= 2) D.lose(pullDir);
        else cost(0.4, pullDir);
      } else {
        // the rim on the road: sparks, the pull harder
        H.rims++;
        his.pull = (his.pull || 0) + pullDir * 0.02;
        cost(0.25, pullDir);
      }
      return;
    }
    if (lp.x < -0.9 && lp.y > 1.05 && Math.abs(lp.z) < 0.62) {
      // through the rear window: the first round he ducks (and weaves), the
      // second finds him
      H.man++;
      D.duck = 1.8;
      G.sfx.play('grunt', his.pos.clone().setY(1.3), { f0: 96, k: 0.5, dur: 0.18 }, { ref: 5 });
      cost(H.man >= 2 ? 0.6 : 0.25);
      return;
    }
    if (lp.x < -1.45 && lp.y < 1.05) {
      // the tank: a leak, then smoke, then fire (the engine dies under him)
      H.tank++;
      this.leak = true;
      if (H.tank >= 2) this.hisSmoke = true;
      if (H.tank >= 3 && !this.hisFire) { this.hisFire = true; D.pace *= 0.75; this.fireT = 0; }
      cost(0.22);
      return;
    }
    H.body++;
    if (H.body % 2 === 0) D.duck = 0.9;
    cost(0.12);
  }
  // my car into his (the gun empty, or not): on a hurt car, a shunt on the
  // quarter puts him off the road; whole, he only wobbles
  rammed(e) {
    if (this.phase !== 'b' || !e.by || e.by !== this.my) return;
    const D = this.driver, his = this.his;
    if (D.state === 'lost') return;
    const l = his.local(e.point, _w);
    const quarter = Math.abs(l.x) > 0.6;
    const hurt = (this.hisDmg && (this.hisDmg.tyres || this.hisDmg.man || this.hisDmg.tank)) || D.control < 1;
    if (e.imp > 2.5 && quarter && hurt) D.lose(l.z > 0 ? -1 : 1);
    else if (e.imp > 2) D.duck = Math.max(D.duck, 0.7);
  }

  // his hands gone: the car does what a car does (Car.js), until it stops
  crashing(dt) {
    const his = this.his, D = this.driver, G = this.game;
    if (!this.crashT) {
      this.crashT = 0.0001;
      // (the grip of a car out of a man's hands, on the wet)
      for (const k of ['fl', 'fr', 'rl', 'rr']) his.grip[k] = Math.min(his.grip[k], 0.55);
      G.sfx.play('tail_screech', his.pos, { dur: 1.8 }, { ref: 6 });
      G.slowmo(0.5, 0.8);
      if (G.controller.drive) G.controller.drive.focus = his;
      this.kit.warn(null);
    }
    this.crashT += dt;
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
  wrecked2() {
    if (this.phase === 'wreck') return;
    const his = this.his, G = this.game;
    this.phase = 'wreck';
    this.driver.state = 'stopped';
    his.frozen = true;
    his.vel.set(0, 0, 0); his.yawRate = 0;
    this.wreck = { t: 0, lamps: 0 };
    G.sfx.play('tail_hornStuck', his.pos, { dur: 4.2 }, { ref: 6 });
    G.emit('tail:crash', {});
  }
  wreckStep(dt) {
    const W = this.wreck, his = this.his, G = this.game, r = this.ctx.rng;
    W.t += dt;
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
    // the short look: then the road is mine again, to the pier
    if (W.t > 2.6 && this.phase === 'wreck') {
      this.phase = 'c';
      if (G.controller.drive) G.controller.drive.focus = null;
      this.kit.objective('Pier 9.');
      G.emit('tail:pier', {});
    }
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
        his.tail.material.color.copy(base).multiplyScalar(1 + this._brk * 1.6);
      }
      for (const sp of his.tail.userData.glows || []) { const d = Math.hypot(his.pos.x - this.my.pos.x, his.pos.z - this.my.pos.z); sp.scale.setScalar(Math.min(0.62, 0.16 + d * 0.011) * (1 + this._brk * 0.5)); }
    }
    // the man ducks
    if (his.driverFig) { const want = D.duck > 0 || D.state === 'lost' || D.state === 'stopped' ? -0.3 : 0; his.driverFig.position.y += (want - his.driverFig.position.y) * (1 - Math.exp(-dt * 10)); }
    // the sag on a flat
    if (his.flat) { his.sagRoll = ((his.flat.fr || 0) + (his.flat.rr || 0) - (his.flat.fl || 0) - (his.flat.rl || 0)) * 0.035; his.sagPitch = ((his.flat.rl || 0) + (his.flat.rr || 0) - (his.flat.fl || 0) - (his.flat.fr || 0)) * 0.02; }
    // a rim on the road: sparks
    if (his.flat && his.speedAbs > 3 && !his.frozen) {
      for (const [k, x, z] of [['fl', 1.55, -0.78], ['fr', 1.55, 0.78], ['rl', -1.55, -0.76], ['rr', -1.55, 0.76]]) {
        if (!his.flat[k]) continue;
        if (r.next() > 0.6) continue;
        const p = his.seat(_v.set(x, 0.05, z), new THREE.Vector3());
        G.fx.sparks.spawn({ pos: p, vel: new THREE.Vector3(r.gauss(), r.range(0.5, 2), r.gauss()).addScaledVector(his.vel, -0.25), life: r.range(0.15, 0.4), size: [0.01, 0.016], stretch: 0.05, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
      }
    }
    // the tank: smoke, then fire; the fire takes him
    if (this.hisSmoke || this.hisFire) {
      this.hisSmokeAcc = (this.hisSmokeAcc || 0) + dt * (this.hisFire ? 16 : 7);
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
      if (this.fireT > 2.5 && D.state !== 'lost' && D.state !== 'stopped') D.lose(this.ctx.rng.next() < 0.5 ? -1 : 1);
      if (!this._fireLight) { this._fireLight = true; if (G.sfx.hiss) G.sfx.hiss(his.pos); }
    }
  }

  // (debugging in shot mode: the bot's keys as the game's virtual keys,
  // its aim straight onto the look - ?c3auto=good)
  autoKeys() {
    const G = this.game, V = G.vin, k = this.botKeys || {}, a = this.botAim;
    for (const [c, on] of [['KeyW', k.W], ['KeyS', k.S], ['KeyA', k.A], ['KeyD', k.D], ['Space', k.Space], ['Mouse2', a && a.rmb]]) { if (on) V.held.add(c); else V.held.delete(c); }
    if (a && a.rmb && G.controller.drive) { const L = G.controller.drive.look; L.yaw -= a.dyaw * 0.5; L.pitch += a.dpitch * 0.5; }
    if (a && a.fire) V.down.add('Mouse0');
  }

  // ---- the drive to the pier, the stop by its gate ---------------------------------------------
  toPier(dt) {
    if (this.phase !== 'c') return;
    const G = this.game, v = this.my;
    const d = Math.hypot(v.pos.x - PIER.park.x, v.pos.z - PIER.park.z);
    const here = d < 11 && v.speedAbs < 0.6;
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
  // it goes out after a buzz
  if (L.shootOut && G) L.shootOut(l, away);
}
void START; void EW; void riverPoint; void riverFrame; void riverSAtZ; void RIVER; void LEGS; void clamp;
