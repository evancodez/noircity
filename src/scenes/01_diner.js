import { defineScene, wait, until, beat } from '../game/script.js';
import { dinerRoom, seatPlayer, holdCigarette, standToggle, V } from './_diner_room.js';

// Scene 1, the diner (STORY.md). Beats: settle, order, drink, pay; the
// room lives under them.
// FOUNDATION STUB (lane 7 owns src/scenes/**): each beat places the player
// and the stand-in cast where the story has them and waits for E; the
// hands' clips run their clocks and marks (nothing is drawn in the hands
// yet but the props they hold). X stands up off the stool (walk mode) and
// sits back down; F takes a drag once the cigarette is lit.
export default defineScene({
  id: 'diner', stage: 'block', title: 'I', name: 'The Diner',
  spawn: { anchor: 'diner.stool.player' },
  beats: ['settle', 'order', 'drink', 'pay'],
  save: ['order', 'pay'],

  setup: {
    settle(ctx) { dinerRoom(ctx); seatPlayer(ctx); },
    order(ctx) {
      dinerRoom(ctx);
      seatPlayer(ctx, { lit: true });
      ctx.flags.lit = true;
      ctx.cast.get('dot').place('diner.serve.4');
    },
    drink(ctx) {
      const d = dinerRoom(ctx);
      seatPlayer(ctx, { lit: true });
      ctx.flags.lit = true;
      ctx.cast.get('dot').place('diner.serve.5');
      d.place('tumbler', 'diner.counter.glass', { name: 'glass' });
    },
    pay(ctx) {
      const d = dinerRoom(ctx);
      seatPlayer(ctx, { lit: true });
      ctx.flags.lit = true;
      ctx.cast.get('dot').place('diner.serve.5');
      d.place('tumbler', 'diner.counter.glass', { name: 'glass' }).userData.setFill(0);
    },
  },

  *script(ctx) {
    const { game: G, hands: H, stage } = ctx;
    const d = stage.part('diner');
    const dot = () => ctx.cast.get('dot'), mack = () => ctx.cast.get('mack');
    // under every beat: X on / off the stool, F a drag, the room's clock
    ctx.onStep((dt) => {
      standToggle(ctx);
      if (ctx.flags.lit && ctx.pressed('KeyF') && !H.busy) {
        H.play('drag', { onMark: { exhale: () => G.fx.cig.exhale(H.anchor('mouth'), G.camera.getWorldDirection(H.anchor('eye'))) } });
      }
      // the room (STORY 'room', seeded times): the bell, a new record, the
      // train, lightning
      const t = ctx.sceneTime, t0 = t - dt;
      if (t0 < 10 && t >= 10) d.bell.ring();
      if (t0 < 22 && t >= 22) d.jukebox.next();
      if (t0 < 38 && t >= 38) d.trainPass(7);
      if (t0 < 55 && t >= 55) { G.pipeline.pulseLightning(G.time, 1); d.lampsDip(0.5, 0.6); }
    });

    if (ctx.at('settle')) {
      yield beat('settle');
      yield* ctx.prompt({ text: 'light up' });
      let cig = null;
      const h = H.play('lightUp', { onMark: {
        lips: () => { cig = holdCigarette(ctx, false); },
        flame: () => G.sfx.play('lighter', null),
        lit: () => { if (cig) cig.userData.setTip('lit'); ctx.flags.lit = true; G.fx.cig.wisp(H.anchor('cigTip')); },
      } });
      yield until(() => h.done);
    }

    if (ctx.at('order')) {
      yield beat('order');
      yield* dot().walkTo('diner.serve.4');
      yield* ctx.prompt({ text: 'scotch' });
      yield* ctx.say('Scotch. Neat.');
      const glass = d.place('tumbler', 'diner.counter.glass', { name: 'glass' });
      glass.userData.setFill(0);
      const bottle = d.items.get('scotch');
      const pour = dot().play('pour', { onMark: {
        streamOn: () => G.fx.pour.start({ from: bottle, to: glass, accent: 'amber' }),
        streamOff: () => G.fx.pour.stop(),
      } });
      const { streamOn, streamOff } = dot().clip('pour').marks;
      yield until(() => { glass.userData.setFill(Math.min(1, Math.max(0, (pour.t - streamOn) / (streamOff - streamOn)))); return pour.done; });
      const slide = dot().play('slide');
      yield until(() => slide.done);
      yield* dot().walkTo('diner.serve.5');
    }

    if (ctx.at('drink')) {
      yield beat('drink');
      const glass = d.items.get('glass');
      for (let k = 1; k <= 3; k++) {
        yield* ctx.prompt({ text: 'drink' });
        const h = H.play('sip', { onMark: { drink: () => glass && glass.userData.setFill(1 - k / 3) } });
        yield until(() => h.done);
      }
    }

    if (ctx.at('pay')) {
      yield beat('pay');
      yield* ctx.prompt({ text: 'pay' });
      const h = H.play('payWallet', { onMark: { shown: () => { mack().play('notice'); mack().lookAt(G.eye.clone()); } } });
      yield until(() => h.done);
      yield* ctx.say('You’re the one asking about the Cardinal.', 2.6);
      const rise = mack().play('rise', { onMark: { stool: () => d.stool(6).topple(V(1, 0, 0)) } });
      yield until(() => rise.done);
      mack().stand();
      yield wait(0.3);
      G.scenes.go('fight', { beat: 'round1', fade: 'cut' });
    }
  },
});
