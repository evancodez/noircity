import * as THREE from 'three';

// What a man pulled out of his car answers with (lane O2): the two seams
// lanes O4 replaces with its own (the crowd brawl's brawl.start([kind]), the
// gun kit's gunman). Until O4 merges, the base's: src/game/Brawl.js (one
// opponent, the street as the room) and a Hood of the base's (the raise,
// the half-second, then his rounds: Game.hoodFire).
//   fightDriver(W, c, { at, onWin, onLose }) -> fight   (fight.step(dt), fight.done)
//   gunman(W, at, { yaw, target }) -> gun              (gun.step(dt), gun.done)
// [O4] replace these two functions; keep their signatures (or change the two
// calls in vehicles/hijack.js).
export function fightDriver(W, c, { at, onWin, onLose }) {
  const G = W.game, C = G.controller, B = G.brawl;
  const me = { x: C.pos.x, z: C.pos.z };
  const yaw = Math.atan2(-(c.pos.x - me.x), -(c.pos.z - me.z));
  C.setMode('brawl', { opponent: c, eyeY: 1.72, pos: me, yaw, ease: 0.25 });
  const mid = { x: (me.x + c.pos.x) / 2, z: (me.z + c.pos.z) / 2 };
  // (the street is the room: a square round us, the walls and the cars in it as they stand)
  const room = { bounds: { x0: mid.x - 8, x1: mid.x + 8, z0: mid.z - 8, z1: mid.z + 8 } };
  const F = { done: false, result: null, t: 0, koT: 0 };
  const end = (result) => {
    if (F.done) return;
    F.done = true; F.result = result;
    if (B.active) B.stop();
    G.player.hands.equip('empty');
    G.setViewmodelVisible(false);
    C.setMode('walk', { pose: { x: C.pos.x, z: C.pos.z, yaw: C.yaw, pitch: -0.04 }, ease: 0.3 });
    if (result === 'won') onWin && onWin(); else onLose && onLose();
  };
  B.start({
    opponent: c, manner: 'measured', rng: G.rng, lesson: false, room,
    who: { name: 'DRIVER', hp: 44 },
    // (down: his car back, and me on the pavement - the fight is the loss)
    onRetry: () => end('lost'),
  });
  F.step = (dt) => {
    if (F.done) return;
    F.t += dt;
    if (B.finished) { F.koT += dt; if (F.koT > 2.6) end('won'); }
    else if (!B.active) end('lost');
  };
  F.cancel = () => end('lost');
  void at;
  return F;
}

// a man who steps back from his door and draws: the raise (the tell, 0.9 s),
// then a round at me every second or so while I am near, six at most, then he
// runs. A Hood of the base's (its rounds through Game.hoodFire: they hit me
// when nothing solid is between - the car's tin is).
export function gunman(W, at, { yaw = 0, aim = 0.7 } = {}) {
  const G = W.game, S = W.stage;
  const h = S.hoods.spawn([at.x, at.z], { heavy: false }, { yaw, state: 'idle' });
  h.hp = 60;
  const ai = { h, heavy: false, aim };
  const P = { done: false, t: 0, shots: 0, h, next: 0.9 };
  P.step = (dt) => {
    if (P.done) return;
    if (!h.alive) { P.done = true; return; }
    P.t += dt;
    const e = G.eye, d = Math.hypot(e.x - h.pos.x, e.z - h.pos.z);
    // (turned on me, the gun up: the tell)
    h.yaw = Math.atan2(e.x - h.pos.x, e.z - h.pos.z);
    if (h.setState && h.state !== 'aim' && P.shots < 6 && d < 34) h.setState('aim');
    if (P.t > P.next && P.shots < 6 && d < 34) {
      P.next = P.t + 0.85 + Math.random() * 0.5;
      P.shots++;
      G.hoodFire(ai, G.time);
      if (W.alarm) W.alarm(h.pos, 0.8);
    }
    if ((P.shots >= 6 || d > 40) && P.t > 3) {
      P.done = true;
      if (h.setState) h.setState('run');
      P.leaveT = 0;
    }
  };
  P.cancel = () => { P.done = true; };
  return P;
}
export const _unused = THREE;
