import { defineScene, wait, until, beat } from '../game/script.js';
import { dinerRoom, seatPlayer, holdCigarette, setGlass, makeJobs, clip, counterAt, jukeboxPos, V, DINER, stoolZ, MACK_AT, EYE_AT, BRAWL_EYE } from './_diner_room.js';

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
//           it, holds the look, says his line, stands; the stool goes over;
//           the eye rises off the stool and turns to him (1.2 s), and the
//           fight begins with no cut to black
export default defineScene({
  id: 'diner', stage: 'block', title: 'I', name: 'The Diner',
  spawn: { anchor: 'diner.stool.player' },
  beats: ['settle', 'order', 'drink', 'pay'],
  save: ['order', 'drink', 'pay'],

  setup: {
    settle(ctx) { dinerRoom(ctx); seatPlayer(ctx, { pitch: -0.2, turn: 0.3 }); },
    order(ctx) {
      dinerRoom(ctx);
      seatPlayer(ctx, { lit: true, pitch: -0.06, turn: 0.1 });
      ctx.flags.lit = true;
      ctx.cast.get('dot').place('diner.serve.4');
      ctx.cast.get('dot').setState('lean');
    },
    drink(ctx) {
      dinerRoom(ctx);
      seatPlayer(ctx, { lit: true, pitch: -0.26, turn: 0.2 });
      ctx.flags.lit = true;
      ctx.cast.get('dot').place('diner.serve.5');
      setGlass(ctx, 1);
    },
    pay(ctx) {
      dinerRoom(ctx);
      seatPlayer(ctx, { lit: true, pitch: -0.1, turn: -0.5 });
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
    const snd = (name, pos = null, p = {}) => G.sfx.play(name, pos, p);
    const eye = () => G.eye;

    // ---- under every beat -----------------------------------------------------------
    let lastTrain = false;
    const room = roomClock(ctx, d, jobs);
    ctx.onStep((dt) => {
      jobs.step(dt);
      room(dt);
      // the cigarette: a thread of smoke off the tip; F a drag, LMB the ash
      if (ctx.flags.lit && ctx.flags.cig) {
        // (lane 3's thread takes a point every step while it burns)
        G.fx.cig.wisp(H.anchor('cigTip'), 'player');
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
        if (ctx.from !== 'order') yield* dot().walkTo('diner.serve.4');
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
      // he holds the look
      yield wait(1.2);
      yield* ctx.say('You’re the one asking about the Cardinal.', 2.6);
      // he stands; the stool goes over (and if he bumps the counter, the
      // needle jumps and the record stops)
      const bump = ctx.rng.chance(0.5);
      const rise = m.play('rise', { onMark: {
        stool: () => {
          d.stool(DINER.brawlerStool).topple(V(1, 0, -0.3));
          snd('stoolFall', V(DINER.stools.x, 0.5, stoolZ(DINER.brawlerStool)));
          if (bump) { d.cupsRattle(0.8, 0.6); G.sfx.play('needleScratch', jukeboxPos()); G.music.stop(0.15); ctx.flags.scratch = true; }
        },
      } });
      yield until(() => rise.done || rise.t >= rise.duration);
      m.stand();
      m.lookAt(null);
      // he steps out into the aisle; the eye rises off the stool and turns
      // to him (1.2 s), into the fight
      jobs.add('mack', m.walkTo(MACK_AT, { speed: 1.1 }));
      H.hold(null, 'R'); H.hold(null, 'L');
      ctx.flags.cig = null;
      yield* riseToFight(ctx);
      yield until(() => !jobs.busy('mack'));
      G.scenes.go('fight', { beat: 'round1', fade: 'cut', card: false, keep: true });
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
function* pourScotch(ctx, d, dot) {
  const { game: G } = ctx;
  const snd = (name, pos = null, p = {}) => G.sfx.play(name, pos, p);
  const dest = ctx.stage.anchor('diner.counter.glass').pos;
  const setAt = V(dest.x - 0.5, dest.y, dest.z);
  let glass = null;
  yield* clip(dot, 'serve', { down: () => { glass = d.place('tumbler', setAt, { name: 'glass' }); glass.userData.setFill(0); snd('glassDown', setAt); } });
  const bottle = d.take('scotch');
  const P = dot.clip('pour');
  const { streamOn, streamOff } = P.marks;
  let fillT = -1;
  const pour = dot.play('pour', { onMark: {
    take: () => { if (bottle) dot.hold(bottle, 'R'); },
    uncork: () => snd('cork', setAt),
    streamOn: () => { fillT = 0; if (bottle && glass) G.fx.pour.start({ from: bottle, to: glass, accent: 'amber' }); snd('pour', setAt, { dur: streamOff - streamOn }); },
    streamOff: () => { G.fx.pour.stop(); snd('cork', setAt, { k: 0.6 }); },
  } });
  while (!pour.done && pour.t < pour.duration) {
    if (glass && fillT >= 0) glass.userData.setFill(Math.min(1, Math.max(0, (pour.t - streamOn) / (streamOff - streamOn))));
    yield null;
  }
  if (glass) glass.userData.setFill(1);
  G.fx.pour.stop();
  // the bottle back on the back bar
  if (bottle) { dot.hold(null, 'R'); d.place('bottle', 'diner.bar.scotch', { name: 'scotch', variant: 'scotch' }); }
  // the slide: on release the glass travels 0.5 m and stops at my hand
  let go = -1;
  const slide = dot.play('slide', { onMark: { release: () => { go = 0; snd('glassSlide', setAt); } } });
  while (!slide.done && slide.t < slide.duration || (go >= 0 && go < 0.55)) {
    if (go >= 0 && glass) {
      go += 1 / 60;
      const u = Math.min(1, go / 0.55), e = 1 - Math.pow(1 - u, 2.2);
      glass.position.set(setAt.x + (dest.x - setAt.x) * e, dest.y, setAt.z + (dest.z - setAt.z) * e);
    }
    yield null;
  }
  if (glass) glass.position.copy(dest);
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
  const home = ctx.stage.anchor('diner.counter.glass').pos;
  // (lane 2's reachGlass / sip take the tumbler off the counter themselves)
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
  const p = H.play('putDown', { onMark: { down: () => {
    if (!glass) return;
    H.hold(null, 'L');
    d.group.add(glass); glass.position.copy(home); glass.rotation.set(0, 0, 0);
    snd('glassDown', home, { k: 0.8 });
  } } });
  yield until(() => p.done);
}

// off the stool and round to face him (1.2 s, eased): the seated eye rises
// to the standing brawl eye in the aisle, turning to look down it at him
function* riseToFight(ctx) {
  const { controller: C, game: G } = ctx;
  const from = C.eyePose();
  const to = { x: EYE_AT.x, y: BRAWL_EYE, z: EYE_AT.z, yaw: 0, pitch: -0.08 };
  C.setMode('cutscene', { track: (t) => {
    const u = Math.min(1, t / 1.2), e = u * u * (3 - 2 * u);
    // (up first, then across: a man getting off a stool)
    const up = Math.min(1, u / 0.55), eu = up * up * (3 - 2 * up);
    const dy = Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw));
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * eu, z: from.z + (to.z - from.z) * e, yaw: from.yaw + dy * e, pitch: from.pitch + (to.pitch - from.pitch) * e };
  } });
  G.sfx.play('stoolSqueak', V(DINER.stools.x, 0.9, stoolZ(DINER.playerStool)), { k: 0.6 });
  yield wait(1.2);
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
    if (cook) cook.play('ring', { onMark: { ring: () => d.bell.ring() } });
    jobs.add('dot', (function* () {
      const dot = cast.get('dot');
      yield wait(0.8);
      // (lane 5's diner.hatch is the cook's place inside the kitchen: Dot
      // stands in the service aisle before the pass, where the bell is)
      const bell = ctx.stage.anchor('diner.bell').pos;
      const passZ = bell.z + Math.sign((DINER.hatch.z0 + DINER.hatch.z1) / 2 - bell.z || 1) * 0.35;
      yield* dot.walkTo({ x: DINER.serveX - 0.5, z: passZ });
      dot.face(-Math.PI / 2);
      const plate = d.place('plate', V(bell.x, bell.y, passZ), { name: 'plate.oldman' });
      yield* clip(dot, 'serve', { down: () => { dot.hold(d.take('plate.oldman') || plate, 'L'); } });
      yield* dot.walkTo('diner.serve.9');
      yield* clip(dot, 'serve', { down: () => { dot.hold(null, 'L'); d.place('plate', counterAt(9, 0.28, 0.2), { name: 'plate.oldman' }); snd('plateDown', counterAt(9)); } });
      yield* dot.walkTo('diner.serve.5');
      dot.setState('lean');
    })());
  }]);
  // 22 s: the docker feeds the jukebox; a new record
  events.push([22, () => {
    jobs.add('docker', (function* () {
      const k = cast.get('docker');
      if (!k) return;
      yield* k.walkTo('diner.jukebox.front');
      k.face(Math.PI);
      yield wait(0.4);
      snd('coin', jukeboxPos());
      yield wait(0.9);
      snd('jukeboxMech', jukeboxPos());
      yield wait(1.4);
      d.jukebox.next();
      snd('needleDrop', jukeboxPos());
      yield wait(2.0);
      yield* k.walkTo('diner.stool.1');
      k.sit('diner.stool.1');
      k.setState('sitDrink');
    })());
  }]);
  // 30 s and 64 s: Dot tops up the old man's coffee
  const topUp = () => jobs.add('dot', (function* () {
    const dot = cast.get('dot');
    yield* dot.walkTo('diner.urns');
    const potItem = d.items.get('coffeePot');
    const potHome = potItem ? potItem.getWorldPosition(V(0, 0, 0)) : V(DINER.backX + 0.3, DINER.counter.topY, 5.55);
    const pot = d.take('coffeePot');
    if (pot) dot.hold(pot, 'R');
    yield* dot.walkTo('diner.serve.9');
    yield* clip(dot, 'pour', { streamOn: () => snd('coffeePour', counterAt(9)) });
    yield* dot.walkTo('diner.urns');
    if (pot) { dot.hold(null, 'R'); d.place('coffeePot', potHome, { name: 'coffeePot' }); }
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
