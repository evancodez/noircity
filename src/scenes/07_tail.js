import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { Chase } from './tail/chase.js';
import { resetCity } from './tail/reset.js';
import { START, EW, NS, riverPoint, riverFrame, riverSAtZ, PIER } from '../stages/city/plan.js';

// Chapter VI, The Tail (lane C3; docs/story/briefs/C3_CITY.md). The city at
// night in the rain; my coupe at Pell Lane's kerb, his sedan pulling away.
//   a  "Don't lose him."  about two minutes through the streets after his
//      red tail lamps: he turns, doubles back, cuts through the market
//      square, goes down the alley, runs Water St ahead of the tram. Out of
//      sight too long or too far behind: "He's getting away.", then "Lost
//      him." (back at the last checkpoint). A wreck of my own: "Wrecked."
//   b  "Stop him before the docks."  the river road: RMB leans out with the
//      revolver, LMB fires. His car goes only by my rounds (or a shunt on a
//      hurt car). He reaches the pier's gate: "He warned them." (back at the
//      river road's start)
//   c  "Pier 9."  the wreck behind me, I drive to the pier myself; by its
//      gate, E: the lamps off, out of the car: chapter VII begins there.
// Beats (each has a setup: ?scene=tail&beat=<beat>, ?start=tail.<beat>):
//   start  at the kerb (the checkpoint of the chase's first half)
//   chase2 on Canal St behind him (the second half's)
//   river  on the river road behind him (phase b's)
//   wreck  his car just stopped against what it hit
//   pier   the wreck behind, the road to the pier (phase c's)
// Music: the slot 'tail' from the kerb to the gate.
const CHECK_DAMAGE = { start: 0, chase2: 0, river: 0, pier: 0 };

function build(ctx, which) {
  const G = ctx.game;
  resetCity(ctx.stage, G);
  const C = new Chase(ctx);
  ctx.flags.chase = C;
  ctx.flags.check = which === 'wreck' ? 'river' : which;
  const lane = 1.65;
  if (which === 'start') {
    C.spawn({ my: { ...START.my, speed: 0 }, his: { ...START.his, speed: 0 }, leg: 0, phase: 'start' });
  } else if (which === 'chase2') {
    // on Canal St, heading east for Baxter; he 30 m ahead
    const z = EW.canal.z + lane;
    C.spawn({ my: { x: NS.baxter.x - 70, z, yaw: 0, speed: 11 }, his: { x: NS.baxter.x - 38, z, yaw: 0, speed: 12 }, leg: 2, prev: 'avenue.canal', phase: 'a' });
    C.driver.state = 'go';
  } else if (which === 'river' || which === 'wreck' || which === 'pier') {
    const s0 = riverSAtZ(EW.market.z + 26);
    const at = (s, d) => { const p = riverPoint(s, d), f = riverFrame(s, {}); return { x: p.x, z: p.z, yaw: f.yaw }; };
    if (which === 'river') {
      C.spawn({ my: { ...at(s0, 1.9), speed: 12 }, his: { ...at(s0 + 34, 1.9), speed: 13 }, leg: 4, phase: 'b' });
      C.driver.toRiver();
      C.phase = 'b';
    } else {
      // his car against the river's rail by the wharf market's end, mine
      // stopped behind it (wreck) or past it on the way (pier)
      const sw = riverSAtZ(-40);
      const hw = at(sw, -3.2);
      C.spawn({ my: which === 'pier' ? { ...at(sw + 16, 1.9), speed: 6 } : { ...at(sw - 16, 1.9), speed: 0 }, his: { ...hw, yaw: hw.yaw + 0.7, speed: 0 }, leg: 4, phase: 'b' });
      C.driver.toRiver();
      C.hisDmg = { tyres: 2, man: 0, tank: 0, body: 2 };
      C.his.grip.rr = C.his.grip.rl = 0.32;
      C.phase = 'crash';
      C.crashT = 1; C.stillT = 1;
      C.wrecked2();
      if (which === 'pier') { C.wreck.t = 3; C.wreck.lamps = 2; C.his.tail.visible = false; for (const sp of C.his.tail.userData.glows || []) sp.visible = false; if (C.his.lamps) C.his.lamps.setOn(false); C.phase = 'c'; }
    }
  }
  C.my.damage = CHECK_DAMAGE[ctx.flags.check] || 0;
  ctx.onStep((dt) => C.step(dt));
  // (?c3auto=good|bad: the proofs' hands as virtual keys, for debugging in
  // shot mode; the proofs themselves press real keys: tools/lib/c3_tail.mjs)
  const qa = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('c3auto') : null;
  if (qa) { C.useBot(qa, { seed: 7 }); C.autoBot = true; }
  // (look development: ?tailAt=x,z,yaw,speed puts my car there)
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q && q.get('tailAt')) {
    const [x, z, yaw, sp = 0] = q.get('tailAt').split(',').map(Number);
    C.my.place(new THREE.Vector3(x, 0, z), yaw, sp);
  }
  return C;
}

export default defineScene({
  id: 'tail', stage: 'city',
  beats: ['start', 'chase2', 'river', 'wreck', 'pier'],
  save: ['chase2', 'river', 'pier'],
  setup: {
    start(ctx) { build(ctx, 'start'); },
    chase2(ctx) { build(ctx, 'chase2'); },
    river(ctx) { build(ctx, 'river'); },
    wreck(ctx) { build(ctx, 'wreck'); },
    pier(ctx) { build(ctx, 'pier'); },
  },

  *script(ctx) {
    const G = ctx.game;
    const C = ctx.flags.chase;
    const K = C.kit;
    G.music.cue('tail', { fade: 2.5 });
    // (came in by the cut from the foot chase - no card on black: the
    // chapter's card small over the windscreen as I pull out; never on a
    // retry)
    const smallCard = !G.hud.cardT && !G._tailRetry;
    G._tailRetry = false;
    if (ctx.at('start') && ctx.from === 'start') {
      yield beat('start');
      K.objective("Don't lose him.");
      G.sfx.play('tail_start', null, {});
      yield wait(2.2);
      K.teach('tail_drive', [['W', 'drive'], ['A D', 'steer'], ['S', 'brake']], { secs: 5, until: 'KeyW' });
      yield until(() => C.phase !== 'start');
      if (smallCard) { const D = G.scenes.current; K.smallCard(D.title, D.name); }
      // the handbrake: taught as he takes his first corner
      yield until(() => C.driver.legIndex >= 0 && C.driver.pilot && C.driver.pilot.s > 30);
      K.teach('tail_handbrake', [['SPACE', 'handbrake: the tail round a tight corner']], { secs: 5, until: 'Space' });
    }
    if (ctx.at('chase2')) {
      if (ctx.from !== 'chase2') yield until(() => C.driver.legIndex >= 2 || C.phase !== 'a');
      else K.objective("Don't lose him.");
      ctx.flags.check = 'chase2';
      yield beat('chase2');
      yield until(() => C.phase !== 'a');
    }
    if (ctx.at('river')) {
      if (ctx.from === 'river') { K.objective('Stop him before the docks.'); K.teach('tail_gun', [['RMB', 'lean out and aim'], ['LMB', 'fire']], { secs: 6, until: 'Mouse0' }); }
      ctx.flags.check = 'river';
      yield beat('river');
      yield until(() => C.phase === 'wreck' || C.phase === 'c');
    }
    if (ctx.at('wreck')) {
      yield beat('wreck');
      yield until(() => C.phase === 'c');
    }
    if (ctx.at('pier')) {
      if (ctx.from === 'pier' || ctx.from === 'wreck') K.objective('Pier 9.');
      ctx.flags.check = 'pier';
      yield beat('pier');
      yield until(() => C.phase === 'parked');
      yield wait(0.6);
      G.sfx.play('tail_door', null, { open: true });
      yield wait(0.5);
      G.music.stop(2);
      ctx.next();
    }
  },
});
void PIER;
