import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { Chase } from './tail/chase.js';
import { resetCity } from './tail/reset.js';
import { TEACH } from './tail/rules.js';
import { WARM_AFTER } from '../stages/index.js';
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
    // on Canal St, heading east for Baxter; he 30 m ahead ([3rd owner] at 25
    // km/h, not 40: the critic's player came out of the black straight into
    // the Baxter turn too fast and met the van parked past its corner four
    // retries running; now there are 70 m to brake for it, and he is near
    // enough the corner to show it with his brake lamps)
    const z = EW.canal.z + lane;
    C.spawn({ my: { x: NS.baxter.x - 70, z, yaw: 0, speed: 7 }, his: { x: NS.baxter.x - 40, z, yaw: 0, speed: 9 }, leg: 2, prev: 'avenue.canal', phase: 'a' });
    C.driver.state = 'go';
  } else if (which === 'river' || which === 'wreck' || which === 'pier') {
    // (phase b's checkpoint where phase b begins: the river road's north
    // end by the canal's mouth, he 26 m ahead - the whole run to the gate)
    const s0 = riverSAtZ(EW.canal.z + 14);
    const at = (s, d) => { const p = riverPoint(s, d), f = riverFrame(s, {}); return { x: p.x, z: p.z, yaw: f.yaw }; };
    if (which === 'river') {
      C.spawn({ my: { ...at(s0, 1.9), speed: 12 }, his: { ...at(s0 + 26, 1.9), speed: 12 }, leg: 4, phase: 'b' });
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
  // (look development: ?tailGun=1 holds the revolver out of the window, the
  // head leaning out after it - phase b's frame)
  if (q && q.get('tailGun')) { C.gun.snapT = 1e9; C.gun.aimK = 1; }
  return C;
}

// [3rd owner] what the cut into the driver's seat would otherwise build all
// at once, built ahead as the city is warmed (lane C6 calls
// game.stages.warm('city') once a frame through the foot chase's last
// stretch): my coupe's model and the chapter's objective lines
const LINES = ["Don't lose him.", 'Stop him before the docks.', 'Pier 9.'];
WARM_AFTER.set('city', function* (stage, G) {
  if (G.vehicles && G.vehicles.prebuild) yield* G.vehicles.prebuild(stage, 'coupe');
  const K = G.hud && G.hud.kit;
  if (K && K.prepareObjective) for (const t of LINES) { K.prepareObjective(t); yield 'line'; }
});

export default defineScene({
  id: 'tail', stage: 'city',
  beats: ['start', 'chase2', 'river', 'wreck', 'pier'],
  save: ['chase2', 'river', 'pier'],
  // [3rd owner] the beats' objective lines, declared (seams/Z.md §1): the
  // manager writes the beat's line as it is entered (a retry, a CONTINUE, a
  // chapter picked) and as the script's beat() begins it. The wreck has none
  // of its own: "Stop him before the docks." stays up through his crash until
  // chase.js strikes it for "Pier 9." as the look at the wreck ends.
  objectives: { start: "Don't lose him.", chase2: "Don't lose him.", river: 'Stop him before the docks.', pier: 'Pier 9.' },
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
    // (the music: order.js declares the slot 'tail' for the chapter)
    // (came in by the cut from the foot chase - no card on black: the
    // chapter's card small over the windscreen as I pull out; never on a
    // retry)
    // ([4th owner] the critic, 2nd look: never shown in by the cut - the Hud
    // leaves cardT a step below 0 after V's own card, so !cardT was false;
    // a card is up only while cardT > 0)
    const smallCard = !(G.hud.cardT > 0) && !G._tailRetry;
    G._tailRetry = false;
    // [3rd owner] the keys taught once, each at its moment (C.teachStep): the
    // driving keys at the kerb, held until W (or 6 s); the handbrake as his
    // brake lamps flare for his first corner; the gun as he turns onto the
    // river road. Failed twice at a beat: its card once more (hud.teach.again)
    C.teachAgain = G.fails(ctx.from) === 2;
    if (ctx.at('start') && ctx.from === 'start') {
      yield beat('start');
      G.sfx.play('tail_start', null, {});
      yield wait(1.0);
      // ([4th owner] until W has been held a moment: a press only came when W
      // went down after the card - held from BEGIN, the card stayed its 6 s
      // over the road; the moment is time to read the rest of it)
      let w0 = null;
      K.teach('tail_drive', TEACH.drive, { secs: 6, until: () => { if (!G.held('KeyW')) { w0 = null; return false; } if (w0 == null) w0 = G.time; return G.time - w0 > 1.5; } });
      yield until(() => C.phase !== 'start');
      if (smallCard) { const D = G.scenes.current; K.smallCard(D.title, D.name); }
    }
    if (ctx.at('chase2')) {
      if (ctx.from !== 'chase2') yield until(() => C.driver.legIndex >= 2 || C.phase !== 'a');
      ctx.flags.check = 'chase2';
      yield beat('chase2');
      yield until(() => C.phase !== 'a');
    }
    if (ctx.at('river')) {
      ctx.flags.check = 'river';
      yield beat('river');
      yield until(() => C.phase === 'wreck' || C.phase === 'c');
    }
    if (ctx.at('wreck')) {
      yield beat('wreck');
      yield until(() => C.phase === 'c');
    }
    if (ctx.at('pier')) {
      ctx.flags.check = 'pier';
      yield beat('pier');
      yield until(() => C.phase === 'parked');
      // (the head turns to the shed's doors - chase.js - a beat on them,
      // the door, the cut)
      yield wait(0.9);
      G.sfx.play('tail_door', null, { open: true });
      yield wait(0.7);
      G.music.stop(2);
      ctx.next();
    }
  },
});
void PIER;
