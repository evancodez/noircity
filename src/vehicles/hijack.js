import * as THREE from 'three';
import { KINDS } from './kinds.js';
import { pay } from '../traffic/seams.js';
import { fightDriver, gunman } from './answers.js';

// The hijack and the car's door (lane O2): E at any car's door.
//   my own car (one I left)             E  get in
//   a parked car                        E  break in: 2 s of my hands at the
//                                       glass (the lock's sound), the controls
//                                       mine through it - I can walk away;
//                                       a witness in sight sees it (crime)
//   a car with a man at the wheel       E  take it (he brakes when I stand at
//                                       his door): I am in his seat (eased),
//                                       he is shoved out (0.8 s) and answers -
//     a civilian (most)   runs
//     a man with a jaw    comes back for me while I sit there ('He’s coming
//                         back.'): drive off, or he has me out and we fight
//                         (the base's Brawl: down, he has his car back)
//     a gangster          steps back and draws (the raise first): drive
//     a cop               as the man with a jaw, and he calls it in (crime 'cop')
//   a car its driver ran from (a panic) E  get in
// What was in it is mine (a wallet now and then: $). Events: game 'wheels:hijack'
// { car, how: 'parked' | 'pulled', driver, seen }.
//   hijack.footStep(ctx, R) -> true when a car is in reach (the free roam's E is mine then)
//   hijack.step(dt)   hijack.act (the break-in under way)   hijack.cancel()
//   hijack.stats { broke, pulled, fights, won, lost, fled, drew, cancelled }
const REACH = 2.3, BREAK = 2.0, PULL = 0.8;
const _f = new THREE.Vector3(), _l = new THREE.Vector3(), _w = new THREE.Vector3();
// the cast's kinds for the men at the wheel (O3's people when they land)
const CAST = { civilian: ['dockhand', 'tail_trucker', 'watcher'], fighter: ['foreman', 'dockhand'], gangster: ['hood'], cop: ['tail_trucker'] };

export class Hijack {
  constructor(W) {
    this.W = W;
    this.G = W.game;
    this.act = null;
    this.men = [];
    this.stats = { broke: 0, pulled: 0, fights: 0, won: 0, lost: 0, fled: 0, drew: 0, cancelled: 0, walkedAway: 0 };
    this.promptText = null;
  }

  // the car I look at, in reach of its body (not the free roam's own car: it has its E)
  look(exclude) {
    const G = this.G, W = this.W, ctl = G.controller, eye = G.eye;
    const f = G.camera.getWorldDirection(_f);
    let best = null, bd = Infinity;
    const test = (o, what, ref) => {
      if (!o || o === exclude || o.solid === false) return;
      const c = Math.cos(o.yaw), s = Math.sin(o.yaw), dx = ctl.pos.x - o.pos.x, dz = ctl.pos.z - o.pos.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const db = Math.hypot(Math.max(0, Math.abs(lx) - o.spec.halfL), Math.max(0, Math.abs(lz) - o.spec.halfW));
      if (db > REACH) return;
      const toX = o.pos.x - eye.x, toZ = o.pos.z - eye.z, tl = Math.max(0.05, Math.hypot(toX, toZ)), fl = Math.max(1e-3, Math.hypot(f.x, f.z));
      if ((toX * f.x + toZ * f.z) / (tl * fl) < 0.35 && db > 0.5) return;
      if (db < bd) { bd = db; best = { what, o, ref, db, lx, lz }; }
    };
    for (const c of W.traffic.cars) test(c.v, 'driven', c);
    for (const L of W.left) if (L.v) test(L.v, 'mine', L);
    for (const v of W.V.list) if (v.abandoned) test(v, 'empty', v);
    for (const b of W.parked.bodies) test(b, 'parked', b);
    return best;
  }

  // on foot, each step (the free roam calls it when its own car is not in reach)
  footStep(ctx, R) {
    const G = this.G, hud = ctx.hud, W = this.W;
    for (const c of W.traffic.cars) c.held = false;
    if (this.act) { this.prompt(hud, this.act.kind === 'break' ? '' : null); return true; }
    if (this.fight) return true;
    const L = this.look(R.car);
    // (a man whose door I stand at stops: he brakes for me)
    if (L && L.what === 'driven') L.ref.held = true;
    let text = null;
    if (L) {
      if (L.what === 'mine' || L.what === 'empty') text = 'E  get in';
      else if (L.what === 'parked') text = 'E  break in';
      else if (L.what === 'driven' && L.o.speedAbs < 1.6) text = 'E  take it';
    }
    // the card the first time a car not mine is in reach (the key drawn)
    if (L && (L.what === 'parked' || L.what === 'driven') && !this.taught) {
      this.taught = true;
      this.card = hud.teach('o2_take', '[E] take a car', { until: () => !this.near || !!this.act || (R && R.inCar) });
    }
    this.near = !!L;
    const cardUp = this.card && !this.card.done && this.card.shown;
    this.prompt(hud, cardUp ? null : text);
    if (L && text && ctx.pressed('KeyE')) this.begin(L, ctx, R);
    return !!L;
  }
  prompt(hud, text) {
    if (text === this.promptText) return;
    this.promptText = text;
    if (text) hud.prompt(text, null, 'o2car'); else hud.clearPrompt('o2car');
  }

  begin(L, ctx, R) {
    const W = this.W, G = this.G;
    this.prompt(ctx.hud, null);
    if (L.what === 'mine' || L.what === 'empty') { if (L.what === 'empty') L.o.abandoned = false; W.enter(L.o); return; }
    if (L.what === 'parked') {
      const ctl = G.controller;
      this.act = { kind: 'break', body: L.o, t: 0, at: ctl.pos.clone(), marks: [0.05, 0.7, 1.3], seen: this.witness(L.o.pos) };
      G.sfx.play('f_c4rattle', L.o.pos.clone().setY(1.1), { k: 0.6 });
      ctx.hud.prompt('…  the lock', null, 'o2break');
      return;
    }
    if (L.what === 'driven') this.pull(L.ref);
  }

  // who sees a car broken into: the men at the wheel of the traffic near, in sight
  // (O3's people and cops read the event and judge it again for themselves)
  witness(p) {
    for (const c of this.W.traffic.cars) {
      const d = Math.hypot(c.v.pos.x - p.x, c.v.pos.z - p.z);
      if (d < 35 && this.W.graph.lineOfSight(c.v.pos.x, c.v.pos.z, p.x, p.z)) return 'driver';
    }
    return null;
  }

  // ---- the pull: him out, me in ------------------------------------------------------------------
  pull(tc) {
    const W = this.W, G = this.G, K = KINDS[tc.kind];
    const v = W.traffic.release(tc);
    this.stats.pulled++;
    const D = tc.driver;
    if (v.model.meshes.bust) v.model.meshes.bust.visible = false;
    // his place at the wheel, and outside his door (the car's left)
    const seat = v.world(K.eye.x, K.eye.z, new THREE.Vector3());
    const out = v.world(K.eye.x - 0.2, -(K.halfW + 1.6), new THREE.Vector3());
    const men = [];
    const spawn = (kind, from, to) => {
      try {
        const yaw = Math.atan2(to.x - from.x, to.z - from.z);
        const c = this.W.stage.cast.spawn(kind, { at: { x: from.x, z: from.z }, yaw, name: 'o2_' + kind + '_' + (++this.n || (this.n = 1)) });
        return { c, from: from.clone(), to: to.clone(), t: 0, state: 'out', kind: D.kind, v };
      } catch (e) { return null; }
    };
    const kinds = CAST[D.kind] || CAST.civilian;
    const kindName = kinds[Math.floor(Math.random() * kinds.length)];
    if (D.kind !== 'gangster') { const m = spawn(kindName, seat, out); if (m) men.push(m); }
    else {
      // (the gang's men: no figure to pull - a Hood each, stepping back from their doors)
      men.push({ c: null, from: seat.clone(), to: out.clone(), t: 0, state: 'gun', kind: 'gangster', v });
      if (D.men > 1) men.push({ c: null, from: v.world(K.eye.x, 0.3, new THREE.Vector3()), to: v.world(K.eye.x - 0.3, K.halfW + 1.3, new THREE.Vector3()), t: 0.3, state: 'gun', kind: 'gangster', v });
    }
    for (const m of men) this.men.push(m);
    G.sfx.play('tail_door', null, { open: true });
    G.sfx.play('tail_thud', seat.clone().setY(1), { k: 0.6 }, { ref: 3 });
    W.enter(v);
    this.W.crime.emit(D.kind === 'cop' ? 'cop' : 'hijack', v.pos, { seen: true, by: 'driver' });
    if (D.wallet) setTimeout(() => pay(G, D.wallet, 'in the glovebox'), 900);
    G.emit('wheels:hijack', { car: v, how: 'pulled', driver: D.kind, seen: true });
    this.lastPull = { kind: D.kind, car: v, t: G.time };
  }

  // ---- each step: the break-in, the men out of their cars ----------------------------------------
  step(dt) {
    const G = this.G, W = this.W, A = this.act;
    if (A && A.kind === 'break') {
      A.t += dt;
      const ctl = G.controller, b = A.body;
      for (let i = 0; i < A.marks.length; i++) if (A.t >= A.marks[i] && !A['m' + i]) { A['m' + i] = true; G.sfx.play(i === 0 ? 'o2_lock' : 'c3_switch', b.pos.clone().setY(1.1), { k: 0.7 }); }
      // (the controls mine through it: walk off, or turn away, and it is left)
      const moved = Math.hypot(ctl.pos.x - A.at.x, ctl.pos.z - A.at.z);
      const f = G.camera.getWorldDirection(_f), toX = b.pos.x - G.eye.x, toZ = b.pos.z - G.eye.z;
      const facing = (toX * f.x + toZ * f.z) / Math.max(0.05, Math.hypot(toX, toZ)) / Math.max(1e-3, Math.hypot(f.x, f.z));
      if (moved > 0.9 || facing < 0.1 || G.city && G.city.inCar) { this.cancel(); this.stats.walkedAway++; return; }
      if (A.t >= BREAK) {
        this.act = null;
        G.hud.clearPrompt('o2break');
        G.sfx.play('tail_door', null, { open: true });
        const v = W.parked.promote(b);
        this.stats.broke++;
        W.crime.emit('hijack', v.pos, { seen: !!A.seen, by: A.seen });
        G.emit('wheels:hijack', { car: v, how: 'parked', driver: null, seen: !!A.seen });
        W.enter(v);
      }
    }
    if (this.fight) { this.fight.step(dt); if (this.fight.done) this.fight = null; }
    for (const m of [...this.men]) this.man(m, dt);
  }

  man(m, dt) {
    const G = this.G, W = this.W, c = m.c, v = m.v;
    m.t += dt;
    const R = G.city;
    const mine = R && R.inCar && R.car === v;
    if (m.state === 'out') {
      // shoved out of his door: stumbling back from it
      const u = Math.min(1, m.t / PULL), e = 1 - (1 - u) * (1 - u);
      c.fig.pos.x = m.from.x + (m.to.x - m.from.x) * e; c.fig.pos.z = m.from.z + (m.to.z - m.from.z) * e;
      if (u >= 1) {
        if (m.kind === 'civilian') { m.state = 'flee'; m.t = 0; this.stats.fled++; this.run(c, v.pos); }
        else { m.state = 'recover'; m.t = 0; c.setState('idle', 0.2); c.lookAt(G.eye); if (mine) G.hud.warn('He’s coming back.'); }
      }
      return;
    }
    if (m.state === 'flee') {
      this.steerRun(c, m.away || (m.away = new THREE.Vector3().subVectors(c.fig.pos, v.pos).setY(0).normalize()), dt);
      if (m.t > 9 || (m.t > 3 && !this.inView(c.fig.pos))) this.drop(m);
      return;
    }
    if (m.state === 'recover') {
      // (a man with a jaw: he gets his breath and comes back for his car)
      if (m.t > 1.2) { m.state = 'back'; m.t = 0; c.setState('run', 0.2); c.fig.speed = 2.6; }
      return;
    }
    if (m.state === 'back') {
      const K = KINDS[v.kind];
      // (he comes to stand a stride out from his door: from there he has me out)
      const door = v.world(K.eye.x - 0.3, -(K.halfW + 0.95), _w);
      const dx = door.x - c.fig.pos.x, dz = door.z - c.fig.pos.z, d = Math.hypot(dx, dz);
      c.fig.yaw = Math.atan2(dx, dz);
      // driven off from him: he is left in the road (he stops, he shouts)
      if (!mine || v.speedAbs > 1.2 || d > 14) {
        G.hud.warn(null);
        c.fig.speed = 0; c.setState('idle', 0.3);
        m.state = 'left'; m.t = 0;
        return;
      }
      if (d < 0.45 && v.speedAbs <= 1.2) {
        // he has me out of my seat: the fight (the base's brawl, one man)
        G.hud.warn(null);
        c.fig.speed = 0;
        this.stats.fights++;
        m.state = 'fight';
        W.exit(v, { side: -1 });
        this.fight = fightDriver(W, c, {
          at: v.pos,
          onWin: () => { this.stats.won++; m.state = 'down'; m.t = 0; G.hud.message('The car’s yours.', 1.8); },
          onLose: () => { this.stats.lost++; this.giveBack(m); },
        });
      }
      return;
    }
    if (m.state === 'left' || m.state === 'down') { if (m.t > 12 && !this.inView(c.fig.pos)) this.drop(m); return; }
    if (m.state === 'gun') {
      // a gangster: out of his door, a step back, the gun up (the tell), his rounds
      if (!m.gun && m.t > 0.35) {
        const yaw = Math.atan2(G.eye.x - m.to.x, G.eye.z - m.to.z);
        m.gun = gunman(W, m.to, { yaw });
        this.stats.drew++;
      }
      if (m.gun) { m.gun.step(dt); if (m.gun.done) { m.state = 'gone'; m.t = 0; } }
      return;
    }
    if (m.state === 'gone') {
      const h = m.gun && m.gun.h;
      if (h && h.alive) { h.speed = 1.3; if (h.state !== 'walk') h.setState('walk'); }
      if (m.t > 8 && (!h || !this.inView(h.pos))) { if (h) W.stage.hoods.remove(h); this.men.splice(this.men.indexOf(m), 1); }
    }
  }
  // the fight lost: he has his car back, gets in and drives off
  giveBack(m) {
    const W = this.W, v = m.v;
    if (m.c) { try { W.stage.cast.remove(m.c); } catch (e) { /* gone */ } }
    this.men.splice(this.men.indexOf(m), 1);
    const R = this.G.city;
    if (R && R.car === v) R.car = null;
    W.forgetLeft(v);
    W.traffic.adopt(v, { kind: m.kind, men: 1, wallet: 0 });
  }
  run(c, from) {
    c.setState('run', 0.15);
    c.fig.speed = 3.4;
    void from;
  }
  steerRun(c, away, dt) {
    const F = c.fig;
    F.yaw = Math.atan2(away.x, away.z);
    // (round what is solid)
    const S = this.W.stage.colliders;
    if (S) { const p = F.pos.clone(); S.resolve(F.pos, 0.3); if (p.distanceTo(F.pos) > 0.02) { away.set(F.pos.x - p.x, 0, F.pos.z - p.z).normalize().lerp(away, 0.4).normalize(); } }
    void dt;
  }
  inView(p) {
    const cam = this.G.camera, f = cam.getWorldDirection(_f);
    const dx = p.x - cam.position.x, dz = p.z - cam.position.z, d = Math.hypot(dx, dz);
    if (d > 90) return false;
    return (dx * f.x + dz * f.z) / Math.max(d, 0.01) > 0.45 && this.W.graph.lineOfSight(cam.position.x, cam.position.z, p.x, p.z);
  }
  drop(m) {
    if (m.c) { try { this.W.stage.cast.remove(m.c); } catch (e) { /* gone */ } }
    const i = this.men.indexOf(m);
    if (i >= 0) this.men.splice(i, 1);
  }

  cancel() {
    if (this.act) { this.stats.cancelled++; this.G.hud.clearPrompt('o2break'); }
    this.act = null;
  }
  clear() {
    this.cancel();
    if (this.fight && this.fight.cancel) this.fight.cancel();
    this.fight = null;
    for (const m of [...this.men]) { if (m.gun && m.gun.h) this.W.stage.hoods.remove(m.gun.h); this.drop(m); }
    this.men = [];
  }
}
export const _unusedL = _l;
