import { defineScene, wait, until, beat } from '../game/script.js';
import { DINER } from '../stages/block/site.js';
import { dinerRoom, V } from './_diner_room.js';

// Scene 2, the fist fight (STORY.md). Beats: round1, round2, round3, ko,
// outside, matchbook.
// FOUNDATION STUB (lane 7 owns src/scenes/**; the rules are lane 7's
// game/Brawl.js): each beat places the player (brawl mode, the fists set)
// and Mack where the story has them; Mack throws his stand-in jab and hook
// on a clock; E moves on to the next round. At ko Mack goes out through the
// end bay's glass; the player walks out through the door to him (walk
// mode), E searches him, the matchbook comes up in the hands, E pockets it,
// two shots far down the pavement, 'To be continued'.
const RING = { x: DINER.ring.x, z: DINER.ring.z, r: DINER.ring.r };
const MACK_AT = { x: DINER.ring.x, z: DINER.ring.z - 0.72 };
const EYE_AT = { x: DINER.ring.x, z: DINER.ring.z + 0.73 };

// the ring: Mack squared up, the player 1.45 m from him
function squareUp(ctx, round) {
  const { cast, controller: C, hands } = ctx;
  dinerRoom(ctx, 'fight');
  const d = ctx.stage.part('diner');
  d.stool(DINER.brawlerStool).topple(V(1, 0, 0));
  const mack = cast.spawn('brawler', { at: MACK_AT, yaw: 0 });
  mack.setState('br_guard');
  mack.lookAt(V(EYE_AT.x, 1.8, EYE_AT.z));
  if (round >= 2) {
    // the room has cleared: the couple gone into the rain, the old man
    // under his table, Dot down behind the counter
    for (const n of ['couple_her', 'couple_him']) cast.remove(cast.get(n));
    const old = cast.get('oldman'); old.stand(); old.setState('cower');
    const dot = cast.get('dot'); dot.place('diner.serve.3'); dot.setState('duck');
    d.place('bottle', V(DINER.counter.frontX - 0.1, DINER.counter.topY, DINER.ring.z + 0.8), { name: 'bottle.reach', variant: 'beer' });
  }
  C.setPose(EYE_AT.x, EYE_AT.z, 0, 0);
  C.setMode('brawl', { opponent: mack, ring: RING, dist: 1.45 });
  hands.hold(null, 'R');
  hands.equip('fists');
  hands.play('guard');
  return mack;
}

// after the last blow: the end bay's glass gone, Mack on his back on the
// pavement outside, out cold
function mackOutside(ctx) {
  const { cast, stage } = ctx;
  dinerRoom(ctx, 'fight');
  const d = stage.part('diner');
  d.stool(DINER.brawlerStool).topple(V(1, 0, 0));
  for (const n of ['couple_her', 'couple_him']) cast.remove(cast.get(n));
  const old = cast.get('oldman'); old.stand(); old.setState('cower');
  cast.get('dot').place('diner.serve.3');
  const pane = stage.part('dinerFront').panes.B4;
  if (!pane.broken && stage.game) stage.glass.shatter(pane, { dir: V(1, 0, 0), power: 2 });
  const mack = cast.spawn('brawler', { at: 'diner.pavement.ko', yaw: Math.PI / 2 });
  mack.ko('deathBack');
  // (he has been lying there: the fall is over)
  for (let i = 0; i < 90; i++) mack.fig.update(1 / 60, 0);
  return mack;
}

export default defineScene({
  id: 'fight', stage: 'block', title: 'II', name: 'The Fight',
  beats: ['round1', 'round2', 'round3', 'ko', 'outside', 'matchbook'],
  save: ['round1'],

  setup: {
    round1(ctx) { squareUp(ctx, 1); },
    round2(ctx) { squareUp(ctx, 2); },
    round3(ctx) { squareUp(ctx, 3); },
    ko(ctx) {
      mackOutside(ctx);
      ctx.hands.equip('empty');
      // in the aisle by the end bay, looking out through the broken glass
      ctx.controller.setMode('walk', { pose: { x: -12.2, y: DINER.floorY + 1.65, z: -2.6, yaw: -1.9, pitch: -0.12 } });
    },
    outside(ctx) {
      mackOutside(ctx);
      ctx.hands.equip('empty');
      // on the pavement by the door, looking down at him
      ctx.controller.setMode('walk', { pose: { x: -8.3, y: 0.15 + 1.65, z: -1.0, yaw: 0.35, pitch: -0.45 } });
    },
    matchbook(ctx) {
      const mack = mackOutside(ctx);
      ctx.hands.equip('empty');
      // knelt by him, the matchbook up in the hand
      ctx.controller.setMode('walk', { pose: { x: -8.5, y: 0.15 + 1.0, z: -2.6, yaw: 0.2, pitch: -0.3 } });
      ctx.inspect.open({ prop: mack.items.get('matchbook'), caption: 'THE CARDINAL', options: { spin: [0.9, 0.25] } });
      mack.items.get('matchbook').visible = true;
    },
  },

  *script(ctx) {
    const { game: G, hands: H, stage, cast } = ctx;
    const mack = () => cast.get('mack');
    const pane = stage.part('dinerFront').panes.B4;

    for (const [i, round] of ['round1', 'round2', 'round3'].entries()) {
      if (!ctx.at(round)) continue;
      yield beat(round);
      G.emit('brawl:round', { n: i + 1 });
      if (ctx.from !== round) squareUp(ctx, i + 1);
      // his stand-in attacks on a clock, until E (the stub's next round)
      let next = 1.5, k = 0;
      const hook = ctx.onStep((dt) => {
        if ((next -= dt) > 0 || !mack() || !mack().alive) return;
        const clip = ['br_jab', 'br_hook', 'br_jab', 'br_haymaker'][k++ % (i === 2 ? 4 : 2)];
        mack().play(clip, { onMark: { contact: () => { H.play('blockHit'); G.controller.shake(0.2, 0); } } });
        next = mack().clip(clip).duration + 1.2;
      });
      yield* ctx.prompt({ text: i < 2 ? 'next round' : 'the last blow' });
      next = 1e9;
      void hook;
    }

    if (ctx.at('ko')) {
      if (ctx.from !== 'ko') {
        const ko = mack().play('br_ko_window', { onMark: { glass: () => stage.glass.shatter(pane, { dir: V(1, 0, 0), power: 2 }) } });
        yield until(() => ko.t >= ko.duration);
        yield beat('ko');
        mackOutside(ctx);
        H.equip('empty');
        G.controller.setMode('walk', { pose: G.controller.eyePose() });
        G.emit('brawl:end', { won: true });
      } else yield beat('ko');
      // out through the door to him (walk mode)
      const ko = stage.anchor('diner.pavement.ko');
      G.hud.say('Out through the door.', 3);
      yield until(() => G.eye.x > DINER.faceX && Math.hypot(G.eye.x - ko.pos.x, G.eye.z - ko.pos.z) < 2.6);
    }

    if (ctx.at('outside')) {
      yield beat('outside');
      if (ctx.from !== 'matchbook') {
        yield* ctx.prompt({ text: 'search', at: mack().pos.clone().setY(0.4) });
        const s = H.play('searchBody');
        yield until(() => s.done);
      }
    }

    if (ctx.at('matchbook')) {
      yield beat('matchbook');
      const mb = mack().items.get('matchbook');
      mb.visible = true;
      let pocketed = false;
      if (!G.inspect.active) G.inspect.open({ prop: mb, caption: 'THE CARDINAL', options: { spin: [0.9, 0.25] }, onDone: () => { pocketed = true; } });
      else G.inspect.active.onDone = () => { pocketed = true; };
      yield until(() => pocketed);
      mb.visible = false;
      G.save.inventory.push('matchbook');
      // two shots far down the pavement to the north
      const far = V(-9, 1.5, -27);
      G.sfx.pistol(far, G.eye.distanceTo(far));
      yield wait(0.7);
      G.sfx.pistol(far, G.eye.distanceTo(far));
      yield wait(2);
      G.hud.card('', 'To be continued', 6);
    }
  },
});
