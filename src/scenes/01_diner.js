import { defineScene, wait, until, beat } from '../game/script.js';
import { serveGlass, fetchBottle, pourScotch as pourScotchHands, slideGlass, POUR } from '../cast/diner/dot.js';
import { deliverPlate, topUpCoffee, feedJukebox, ringBell } from '../cast/diner/patrons.js';
import { dinerRoom, seatPlayer, holdCigarette, setGlass, makeJobs, makeGlance, clip, counterAt, jukeboxPos, V, DINER, stoolZ, GLASS_AT, POUR_AT, SCOTCH_DOWN } from './_diner_room.js';

// Scene 1, the diner (STORY.md, lane 7's brief P0.2). Beats: settle, order,
// drink, pay; the room lives under them. Nothing forces the player's pace:
// every beat waits for its key, and the room goes on while it waits.
//   settle  fade in over 2.5 s under the chapter card; after 4 s E lights
//           up (the lighter's lid, wheel and flame; the tip catches); from
//           then on F takes a drag and LMB taps the ash
//   order   Dot comes down the counter (6 s after the light, or at once on
//           E); E scotch; "Scotch. Neat."; she sets a tumbler down, pours
//           (the stream and the fill follow the clip's streamOn / streamOff),
//           corks the bottle, slides the glass 0.5 m to my left hand
//   drink   E drink, three times: reach, sip, put down; the glass empties
//   room    (seeded clock from the scene's start) 10 s the bell, Dot takes
//           the plate to the old man; 22 s the docker feeds the jukebox (a
//           new record); 38 s the el train through the wall; 55 s lightning,
//           the lamps dip, thunder 1.6 s later; Dot tops up the old man's
//           coffee; Q spins the empty stool on my left
//   pay     E pay: the wallet, the licence; the big man two stools down sees
//           it, holds the look; the view eases round to him (he is framed on
//           its right third) and holds through his line; then scene 2's way
//           in takes over with no cut (he stands, his stool goes over, his hand
//           on my shoulder: scenes/fight/start.js, lane B8)
// Every beat starts square to the counter (seatPlayer); the view turns only
// when something wants it, eased there and given back (the glance): Dot
// coming down the counter (0.25 rad toward her, 1.2 s), Mack's line.
export default defineScene({
  id: 'diner', stage: 'block', title: 'I', name: 'The Diner',
  spawn: { anchor: 'diner.stool.player' },
  beats: ['settle', 'order', 'drink', 'pay'],
  save: ['order', 'drink', 'pay'],

  setup: {
    settle(ctx) { dinerRoom(ctx); seatPlayer(ctx); },
    order(ctx) {
      dinerRoom(ctx);
      seatPlayer(ctx, { lit: true });
      ctx.flags.lit = true;
      ctx.cast.get('dot').place('diner.serve.4');
      ctx.cast.get('dot').setState('lean');
    },
    drink(ctx) {
      dinerRoom(ctx);
      seatPlayer(ctx, { lit: true });
      ctx.flags.lit = true;
      ctx.cast.get('dot').place('diner.serve.5');
      setGlass(ctx, 1);
    },
    pay(ctx) {
      dinerRoom(ctx);
      seatPlayer(ctx, { lit: true });
      ctx.flags.lit = true;
      ctx.cast.get('dot').place('diner.serve.5');
      setGlass(ctx, 0);
      ctx.flags.sips = 3;
    },
  },

  *script(ctx) {
    const { game: G, hands: H, stage, controller: C } = ctx;
    const d = stage.part('diner');
    const cast = ctx.cast;
    const dot = () => cast.get('dot'), mack = () => cast.get('mack');
    const jobs = makeJobs();
    ctx.flags.jobs = jobs;
    // the view's eased turns (to Dot, to him) and back
    const look = ctx.flags.glance = makeGlance(ctx);
    const snd = (name, pos = null, p = {}) => G.sfx.play(name, pos, p);
    const eye = () => G.eye;

    // ---- under every beat -----------------------------------------------------------
    let lastTrain = false;
    const room = roomClock(ctx, d, jobs);
    ctx.onStep((dt) => {
      jobs.step(dt);
      room(dt);
      look.step(dt);
      // the cigarette: a thread of smoke off the tip; F a drag, LMB the ash
      if (ctx.flags.lit && ctx.flags.cig) {
        // (lane 3's thread takes a point every step while it burns)
        G.fx.cig.wisp(H.anchor('cigTip'), 'player', { lips: !!H.held.M });
        if (ctx.pressed('KeyF') && !H.busy) {
          H.play('drag', { onMark: {
            glow: () => snd('drag'),
            exhale: () => { G.fx.cig.exhale(H.anchor('mouth'), G.camera.getWorldDirection(V(0, 0, 0))); snd('exhale'); },
          } });
          ctx.flags.drags = (ctx.flags.drags || 0) + 1;
        }
        if (ctx.pressed('Mouse0') && !H.busy) H.play('ash', { onMark: { tap: () => snd('ashTap', counterAt(4, 0.2, 0.3)) } });
      }
      // Q: a nudge to the empty stool on my left (it spins and slows)
      if (ctx.pressed('KeyQ') && C.mode === 'seated') { d.stool(DINER.playerStool - 1).spin(1.2); snd('stoolSqueak', V(DINER.stools.x, 0.9, stoolZ(DINER.playerStool - 1))); }
      // any train on the el: the room feels it through the wall
      const tr = stage.train, on = !!(tr && tr.active);
      if (on && !lastTrain) d.trainPass(7);
      lastTrain = on;
    });

    // ---- 1. settle ------------------------------------------------------------------
    if (ctx.at('settle')) {
      yield beat('settle');
      yield wait(4);
      yield* ctx.prompt({ text: 'light up', at: () => d.items.get('lighter') || counterAt(4, 0.12, -0.26) });
      // (lane 2's clip takes the pack, the cigarette and the lighter off the
      // counter and puts them back itself, lights the tip on its own prop
      // event: the scene adds the sounds and the story's flags)
      const h = H.play('lightUp', { onMark: {
        tap: () => snd('packTap'),
        lips: () => { ctx.flags.cig = H.cigarette(); },
        spark: () => snd('lighter'),
        lit: () => { const c = H.cigarette(); if (c) { c.userData.setTip('lit'); ctx.flags.cig = c; } ctx.flags.lit = true; G.fx.cig.wisp(H.anchor('cigTip'), 'player'); snd('cigCatch'); },
        shut: () => snd('lighterShut'),
      } });
      yield until(() => h.done);
      ctx.flags.litAt = ctx.sceneTime;
      // (polish: the first drag follows the light on its own - the hand takes
      // the cigarette from the lips and rests with it on the counter. Left
      // in the lips until F, it stood at the bottom of the view for good,
      // its smoke a straight line up the middle of the picture.)
      yield wait(0.5);
      if (!H.busy && H.held.M) {
        H.play('drag', { onMark: {
          glow: () => snd('drag'),
          exhale: () => { G.fx.cig.exhale(H.anchor('mouth'), G.camera.getWorldDirection(V(0, 0, 0))); snd('exhale'); },
        } });
      }
    }

    // ---- 2. order ---------------------------------------------------------------------
    if (ctx.at('order')) {
      yield beat('order');
      if (ctx.from !== 'order') {
        // (6 s after the light, or at once if E goes again)
        let t = 0;
        yield until(() => { t += 1 / 60; return t >= 6 || ctx.pressed('KeyE'); });
      }
      // Dot's part is one job in her queue: down the counter to me, the
      // order, the pour, the slide (the room's errands wait behind it)
      const F = ctx.flags;
      jobs.add('dot', (function* () {
        if (ctx.from !== 'order') {
          // (she comes down the counter: the eye goes to where she is, 0.25
          // rad at most, holds while she comes (1.2 s at least), and eases
          // back square as she arrives across from me)
          const g = look.to({ at: dot().bones.head.getWorldPosition(V(0, 0, 0)), max: 0.25, in: 0.6, hold: Infinity, out: 0.9 });
          yield wait(0.4);
          yield* dot().walkTo('diner.serve.4');
          while (look.job === g && g.t < g.in + 1.2) yield null;
          if (look.job === g) look.release();
        }
        dot().setState('lean');
        F.attending = true;
        yield until(() => F.ordered);
        yield wait(2.2);
        yield* pourScotch(ctx, d, dot());
        F.attending = false;
      })());
      yield until(() => F.attending);
      yield* ctx.prompt({ text: 'scotch', at: () => dot().bones.head.getWorldPosition(V(0, 0, 0)).setY(1.35) });
      F.ordered = true;
      yield* ctx.say('Scotch. Neat.');
      yield until(() => F.served);
    }

    // ---- 3. drink -----------------------------------------------------------------------
    if (ctx.at('drink')) {
      yield beat('drink');
      const glass = () => d.items.get('glass');
      for (let k = (ctx.flags.sips || 0) + 1; k <= 3; k++) {
        yield* ctx.prompt({ text: 'drink', at: () => glass() });
        yield* sip(ctx, d, k);
        ctx.flags.sips = k;
      }
    }

    // ---- 5. pay ---------------------------------------------------------------------------
    if (ctx.at('pay')) {
      yield beat('pay');
      yield* ctx.prompt({ text: 'pay', at: () => counterAt(4, 0.3, -0.05) });
      const m = mack();
      let noticed = false;
      const h = H.play('payWallet', { onMark: {
        open: () => snd('wallet'),
        shown: () => { noticed = true; m.play('notice', { hold: true }); m.lookAt(eye().clone()); },
        bill: () => snd('register', V(DINER.backX + 0.75, 1.2, DINER.counter.z0 + 0.5)),
      } });
      yield until(() => h.done && noticed);
      // he holds the look; the eye goes round to him (framed on the right
      // third of the view, his head a little above its middle) and stays
      // on him through the line and his rise
      const mackAt = () => { const p = m.bones.head.getWorldPosition(V(0, 0, 0)); p.y -= 0.12; return p; };
      look.to({ at: mackAt, frame: 0.3, max: 1.2, pitch: true, in: 1.1, hold: Infinity });
      yield wait(1.2);
      yield* ctx.say('You’re the one asking about the Cardinal.', 2.6);
      // [B8] his hands free for the fight: the cigarette out of the lips as he
      // moves; then scene 2 takes the room as it stands, no cut: he stands,
      // comes down the counter, his hand on my shoulder (scenes/fight/start.js)
      H.hold(null, 'R'); H.hold(null, 'L'); H.hold(null, 'M', { keep: true });
      ctx.flags.cig = null;
      G.scenes.go('fight', { beat: 'start', fade: 'cut', card: false, keep: true });
    }
  },

  // the autoplay driver (game/Autoplay.js): a human moment at each prompt,
  // a drag now and then, the stool spun once
  auto(ctx, A) {
    const F = ctx.flags;
    if (A.prompting()) A.pressAfter('KeyE', 0.9, 1.8);
    else if (F.lit && ctx.beat !== 'pay' && A.every('drag', 9, 14)) A.tap('KeyF');
    else if (ctx.sceneTime > 12 && !F.spun && A.once('spin')) { F.spun = true; A.tap('KeyQ'); }
  },
});

// Dot serves: the tumbler down, the bottle off the back bar, the pour (its
// stream and the glass's fill follow the clip's streamOn / streamOff), the
// cork, the bottle back, the glass slid 0.5 m to my left hand
// (object first: every thing she handles has its path in cast/diner/dot.js,
// her hands solved onto it every step)
function* pourScotch(ctx, d, dot) {
  const { game: G } = ctx;
  const snd = (name, pos = null, p = {}) => G.sfx.play(name, pos, p);
  const dest = GLASS_AT();
  // (set down before her at her side of the counter - its back edge is
  // 0.62 from the front - and slid from there the 0.4 m to my left hand)
  const setAt = POUR_AT();
  dot.setState('idle', 0.25);
  // the tumbler: from the shelf under the counter, down before her
  const glass = d.place('tumbler', setAt, { name: 'glass' });
  glass.userData.setFill(0);
  yield* serveGlass(ctx, dot, glass, setAt, { onDown: () => snd('glassDown', setAt) });
  // the scotch off the back bar; back to her place with it
  const bottle = d.items.get('scotch');
  if (bottle) {
    // (back up against the counter's back edge, square to it, behind the glass)
    yield* fetchBottle(ctx, dot, bottle, { x: setAt.x - 0.27, z: stoolZ(DINER.playerStool) }, { face: Math.PI / 2 });
    // the pour: the stream from its lip, the glass filling, the bottle's level falling
    const f0 = bottle.userData.fill ?? 1;
    let pouring = false, pt = 0;
    const pourGen = pourScotchHands(ctx, dot, bottle, glass, {
      onUncork: () => snd('cork', setAt),
      onStream: () => { pouring = true; G.fx.pour.start({ from: bottle, to: glass, accent: 'amber', fill: false }); snd('pour', setAt, { dur: POUR.pour + 0.3 }); },
      onStreamOff: () => { pouring = false; G.fx.pour.stop(); },
      onCork: () => snd('cork', setAt, { k: 0.6 }),
      onDown: (at) => snd('glassDown', at, { k: 0.6 }),
    }, SCOTCH_DOWN());
    for (let r = pourGen.next(); !r.done; r = pourGen.next()) {
      if (pouring) {
        pt += 1 / 60;
        const u = Math.min(1, pt / (POUR.pour + 0.25));
        glass.userData.setFill(u);
        if (bottle.userData.setFill) bottle.userData.setFill(f0 - 0.12 * u);
      }
      yield r.value;
    }
    G.fx.pour.stop();
  }
  glass.userData.setFill(1);
  // the slide: her hand to the glass, a push; it runs on and stops at my left hand
  yield* slideGlass(ctx, dot, glass, dest, { onRelease: () => snd('glassSlide', setAt) });
  ctx.flags.served = true;
  dot.setState('lean');
  // she moves off down the counter
  yield* dot.walkTo('diner.serve.5');
  dot.setState('lean');
}

// one sip: reach, lift, tilt (the level drops over the drink mark), down
function* sip(ctx, d, k) {
  const { hands: H, game: G } = ctx;
  const snd = (name, pos = null, p = {}) => G.sfx.play(name, pos, p);
  const glass = d.items.get('glass');
  // (the hands' clips take the tumbler off the counter and put it back where
  // it stood themselves: object first, the hand on its grip)
  const r = H.play('reachGlass');
  yield until(() => r.done);
  const f0 = 1 - (k - 1) / 3, f1 = 1 - k / 3;
  const S = H.clip('sip'), a = S.marks.tilt, b = S.marks.drink;
  const s = H.play('sip', { onMark: { drink: () => snd('sip') } });
  while (!s.done) {
    if (glass) glass.userData.setFill(f0 + (f1 - f0) * Math.min(1, Math.max(0, (s.t - a) / Math.max(0.05, b - a))));
    yield null;
  }
  if (glass) glass.userData.setFill(f1);
  const p = H.play('putDown', { onMark: { down: () => { if (glass) snd('glassDown', glass.getWorldPosition(V(0, 0, 0)), { k: 0.8 }); } } });
  yield until(() => p.done);
}

// The room's own clock (STORY 'room', lane 7's brief P0.2 item 4), seeded
// from the scene's start: it runs under every beat.
function roomClock(ctx, d, jobs) {
  const { game: G, stage } = ctx;
  const cast = ctx.cast;
  const snd = (name, pos = null, p = {}) => G.sfx.play(name, pos, p);
  const at = (t, t0, dt) => t0 < t && t0 + dt >= t;
  const events = [];
  let T = 0;
  // 10 s: the cook rings the bell; Dot takes the plate to the old man
  events.push([10, () => {
    const cook = cast.get('cook');
    // (his palm comes down on the bell's plunger: cast/diner/patrons.js)
    if (cook) jobs.add('cook', (function* () { yield* ringBell(ctx, cook, d, { onRing: () => d.bell.ring() }); cook.setState('hatch', 0.3); })());
    jobs.add('dot', (function* () {
      const dot = cast.get('dot');
      yield wait(0.8);
      // (lane 5's diner.hatch is the cook's place inside the kitchen: Dot
      // stands in the service aisle before the pass, where the bell is)
      const bell = ctx.stage.anchor('diner.bell').pos;
      const passZ = bell.z + Math.sign((DINER.hatch.z0 + DINER.hatch.z1) / 2 - bell.z || 1) * 0.35;
      yield* dot.walkTo({ x: bell.x + 0.42, z: passZ });
      dot.face(-Math.PI / 2);
      dot.setState('idle', 0.2);
      // (the plate on the pass, taken by its rim, carried level, set down
      // before him: cast/diner/patrons.js)
      const to = counterAt(9, 0.38, 0.22);
      yield* deliverPlate(ctx, dot, d, { name: 'plate.oldman', from: V(bell.x, bell.y, passZ), to, walkTo: 'diner.serve.9' });
      snd('plateDown', to);
      yield* dot.walkTo('diner.serve.5');
      dot.setState('lean');
    })());
  }]);
  // 22 s: the docker feeds the jukebox; a new record
  events.push([22, () => {
    jobs.add('docker', (function* () {
      const k = cast.get('docker');
      if (!k) return;
      // (his mug down on the counter before he goes: it was in his hand)
      const mug = k.hold(null, 'R');
      if (mug) d.place('mug', counterAt(1, 0.2), { name: 'mug.docker', yaw: 2.4 });
      yield* k.walkTo('diner.jukebox.front');
      k.face(Math.PI);
      k.setState('idle', 0.2);
      yield wait(0.2);
      // a coin in the slot, a button pressed: his fingers on the machine
      yield* feedJukebox(ctx, k, d, { onCoin: (p) => snd('coin', p) });
      yield wait(0.3);
      // (the change: the arm, the mechanism, the record dropping: the
      // jukebox's own jukebox_change)
      d.jukebox.next();
      yield wait(2.6);
      yield* k.walkTo('diner.stool.1');
      k.sit('diner.stool.1');
      const m2 = d.take('mug.docker');
      if (m2) k.hold(m2, 'R');
      k.setState('sitDrink');
    })());
  }]);
  // 30 s and 64 s: Dot tops up the old man's coffee
  const topUp = () => jobs.add('dot', (function* () {
    const dot = cast.get('dot');
    // (the pot by its handle to his cup, a second's pour, back on the warmer:
    // cast/diner/patrons.js)
    yield* topUpCoffee(ctx, dot, d, {
      cup: 'cup.oldman',
      onPour: (pot, cup) => { G.fx.pour.start({ from: pot, to: cup, accent: 'coffee', fill: false, rate: 0.9 }); snd('coffeePour', counterAt(9)); },
      onStop: () => G.fx.pour.stop(),
    });
    yield* dot.walkTo('diner.serve.5');
    dot.setState('lean');
  })());
  events.push([30, topUp], [64, topUp]);
  // 38 s: the el train passes over, heard and felt through the wall
  events.push([38, () => {
    const tr = stage.train;
    if (tr && !tr.active) G.director.cue('train', { z: -5, ahead: 60, dir: 1 });
    d.trainPass(7);
    snd('trainWall', null, { dur: 7 });
  }]);
  // 55 s: lightning whitens the windows, the lamps dip; thunder 1.6 s on
  events.push([55, () => { G.pipeline.pulseLightning(G.time, 1); d.lampsDip(0.5, 0.6); }]);
  events.push([56.6, () => G.sfx.thunder(0.9, 0.35, false)]);
  // the old man turns his page; the couple lean together; Mack eats, drinks
  const page = [17, 41, 69];
  for (const p of page) events.push([p, () => { const o = cast.get('oldman'); if (o && o.state === 'sitRead') snd('newspaper', o.pos.clone().setY(1.3)); }]);
  events.push([26, () => { const a = cast.get('couple_her'), b = cast.get('couple_him'); if (a) a.setState('sitSmoke'); if (b) b.setState('sit'); }]);
  events.push([48, () => { const a = cast.get('couple_her'), b = cast.get('couple_him'); if (a) a.setState('sitTalk'); if (b) b.setState('sitTalk'); }]);
  events.push([34, () => { const m = cast.get('mack'); if (m && m.seat && m.state === 'sitEat') m.setState('sitDrink'); }]);
  events.push([52, () => { const m = cast.get('mack'); if (m && m.seat && m.state === 'sitDrink') m.setState('sitEat'); }]);
  // cutlery on china, now and then (seeded)
  let clink = 3 + ctx.rng.range(0, 4);
  return (dt) => {
    const t0 = T;
    T += dt;
    for (const [t, fn] of events) if (at(t, t0, dt)) fn();
    if ((clink -= dt) <= 0) { clink = ctx.rng.range(3, 9); snd('cutlery', counterAt(ctx.rng.int(1, 9), 0.25)); }
  };
}
