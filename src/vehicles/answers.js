import * as THREE from 'three';
import { crowdOf } from '../combat/brawl/Crowd.js';

// What a man pulled out of his car answers with (lane O2), on the city's rules:
//   fightDriver(W, m, { at, onWin, onLose, onLeft }) -> fight   (fight.step(dt), fight.done)
//     the man with a jaw: O4's crowd brawl (src/combat/brawl/Crowd.js), one man - his own
//     figure (m.c, the street's Person when the people are in); down is the black and the
//     hospital (`He wanted his car back.`) and he drives off in it; walked off 30 m, he
//     gets back in and goes. A cop: O3's street fists (src/police/fists.js) - down is the
//     arrest, him down his whistle and the heat (O3's).
//   gunman(W, at, { yaw, car }) -> gun   (gun.step(dt), gun.done)
//     a gang's man out of the saloon: the raise (the tell, 0.9 s) and his rounds every
//     second or so while I am near (a base Hood, Game.hoodFire: the car's tin stops them,
//     its glass does not); [O2] after the critic (B2: sat in the car with my hands off,
//     six rounds and he left - the car mine for nothing): while my car stands he walks up
//     to its side window and fires through the glass, close, until I drive off (over 40 m:
//     he gives it up) or he is down. Sat still, I am shot down in about ten seconds: the
//     hospital, `Shot sitting at the wheel. Drive.` (W.downSpec, the city's onDown).
const _v = new THREE.Vector3();
export const GUNMAN = { tell: 0.9, every: [0.85, 1.35], walkAfter: 2.2, walk: 1.7, far: 40, giveUp: 60, aim: 0.75, aimClose: 2.6 };

export function fightDriver(W, m, { at, onWin, onLose, onLeft }) {
  const G = W.game, c = m.c, p = m.p;
  const F = { done: false, result: null, t: 0 };
  // (his figure is the street's, not the crowd's: the crowd lets go of it - never takes it off the stage)
  const letGo = () => { const C = G.crowd; if (!C || !p) return; for (const q of C.men || []) if (q.c === c) { q.removed = true; q.off = null; } };
  const end = (result) => {
    if (F.done) return;
    letGo();
    F.done = true; F.result = result;
    if (result === 'won') onWin && onWin();
    else if (result === 'left') (onLeft || onLose) && (onLeft || onLose)();
    else onLose && onLose();
  };
  // a cop: O3's own street fight (his arrest, his whistle)
  const police = G.police;
  if (m.kind === 'cop' && p && police && police.fists) {
    p.role = 'cop'; p.job = 'fight';
    p.mode = 'walk';
    if (police.fists.start(p, { why: 'his car' })) {
      F.step = () => {
        if (F.done) return;
        F.t += dt0();
        if (police.fists.active) return;
        // (O3 has him now: down where he fell, or back on his beat; my fall was the arrest)
        if (!p.standing) end('won'); else end('left');
      };
      F.cancel = () => { if (police.fists.active) police.fists.stop(); end('left'); };
      return F;
    }
  }
  // the man with a jaw: O4's crowd brawl, one man, the street as the room
  const crowd = crowdOf(G);
  const yaw = Math.atan2(G.eye.x - c.fig.pos.x, G.eye.z - c.fig.pos.z);
  G.setViewmodelVisible(true);
  crowd.start({
    men: [{ kind: m.kind === 'cop' ? 'cop' : 'driver', c, at: { x: c.fig.pos.x, z: c.fig.pos.z }, yaw, id: 'o2_driver' }],
    leave: true, seed: 2200 + (W.hijack.stats.fights % 97),
    // (O4's mercy: my falls to these men tonight - his openings a little longer; never a blow for me)
    mercy: Math.min(3, W.hijack.stats.lost || 0),
    onDown: () => { end('lost'); return { why: m.kind === 'cop' ? 'Arrested.' : 'He wanted his car back.', to: m.kind === 'cop' ? 'station' : 'hospital' }; },
    onEnd: (result) => { if (result === 'won') end('won'); else if (result === 'left' || result === 'drawn') end('left'); },
  });
  G.hud.clearPrompt('cityin'); G.hud.clearPrompt('cityout');
  F.step = () => {
    if (F.done) return;
    if (!crowd.active) end(crowd.result === 'won' ? 'won' : crowd.result === 'down' ? 'lost' : 'left');
  };
  F.cancel = () => { if (crowd.active) crowd.stop('o2'); end('left'); };
  void at;
  return F;
}
const dt0 = () => 1 / 60;

// a gang's man who steps back from his door and draws
export function gunman(W, at, { yaw = 0, car = null } = {}) {
  const G = W.game, S = W.stage;
  const h = S.hoods.spawn([at.x, at.z], { heavy: false }, { yaw, state: 'idle' });
  h.hp = 60;
  const ai = { h, heavy: false, aim: GUNMAN.aim };
  const P = { done: false, t: 0, shots: 0, h, next: GUNMAN.tell, standT: 0, farT: 0, close: false };
  W.gunT = G.time;
  P.step = (dt) => {
    if (P.done) return;
    if (!h.alive) { P.done = true; return; }
    P.t += dt;
    const R = G.city, mine = R && R.inCar && car && R.car === car;
    const e = G.eye, d = Math.hypot(e.x - h.pos.x, e.z - h.pos.z);
    // my car stood: he walks up to its side, to the glass (the nearer side to him)
    P.standT = mine && car.speedAbs < 2.5 ? P.standT + dt : 0;
    let walking = false;
    if (mine && P.standT > GUNMAN.walkAfter) {
      const l = car.local(h.pos, _v), sd = l.z >= 0 ? 1 : -1;
      const K = car.spec, win = car.world(0.1, sd * (K.halfW + 0.85), new THREE.Vector3());
      const dx = win.x - h.pos.x, dz = win.z - h.pos.z, dw = Math.hypot(dx, dz);
      if (dw > 0.45) {
        walking = true;
        const k = Math.min(dw, GUNMAN.walk * dt) / dw;
        h.pos.x += dx * k; h.pos.z += dz * k;
        if (S.colliders) S.colliders.resolve(h.pos, 0.3, h.collider);
        if (h.setState && h.state !== 'walk') h.setState('walk');
      }
      P.close = dw < 1.2;
    } else P.close = false;
    // (turned on me, the gun up: the tell)
    h.yaw = Math.atan2(e.x - h.pos.x, e.z - h.pos.z);
    if (!walking && h.setState && h.state !== 'aim' && d < 34) h.setState('aim');
    ai.aim = P.close ? GUNMAN.aimClose : GUNMAN.aim;
    if (P.t > P.next && d < 34) {
      P.next = P.t + GUNMAN.every[0] + Math.random() * (GUNMAN.every[1] - GUNMAN.every[0]);
      P.shots++;
      // (at the glass the round goes through it into the seat: O6's bullets meet a car as its
      // hull's box, so the close shot is his own - the flash, the crack, and a hit most times)
      if (P.close && mine) closeShot(G, h, ai);
      else G.hoodFire(ai, G.time);
      W.gunT = G.time;
      if (W.alarm) W.alarm(h.pos, 0.8);
    }
    // driven off: he gives it up when I am well away (or at last)
    P.farT = d > GUNMAN.far ? P.farT + dt : 0;
    if ((P.farT > 2.5 && P.t > 3) || P.t > GUNMAN.giveUp) {
      P.done = true;
      if (h.setState) h.setState('run');
    }
  };
  P.cancel = () => { P.done = true; };
  return P;
}
// a round through the side glass at a man in the seat, from a stride off
function closeShot(G, h, ai) {
  const muzzle = h.fire();
  if (!muzzle) return;
  const eye = G.eye, dir = new THREE.Vector3().subVectors(eye, muzzle).normalize();
  G.fx.flash.hood(h, muzzle, dir, G.time, false);
  G.sfx.pistol(muzzle, muzzle.distanceTo(eye));
  G.counters.hoodShots++;
  if (G.sfx.glass) G.sfx.glass(muzzle.clone().lerp(eye, 0.5), 0.4);
  if (!G.live || Math.random() > 0.8) return;
  const dmg = 9 + Math.floor(Math.random() * 6);
  G.health.damage(dmg);
  G.emit('player:hit', { dmg, dir });
  G.sfx.play('grunt', null, { f0: 88, k: 0.35, dur: 0.14 }, { send: false });
  G.counters.hoodHits++;
  G.counters.damageTaken += dmg;
  void ai;
}
