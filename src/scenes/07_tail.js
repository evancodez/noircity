import { defineScene, wait, until, beat } from '../game/script.js';
import { ROAD } from '../stages/riverroad/road.js';
import { Tail } from './tail/tail.js';
import { Question } from './tail/question.js';

// Scene 7, The Tail (lane B5; docs/story/briefs/B5_TAIL.md). The river road
// in the rain, his red tail lamps ahead; my coupe, the wheel in my hands.
// Beats (each has a setup: ?scene=tail&beat=<beat>, ?start=tail.<beat>):
//   start        at the kerb, his tail lamps small down the road; the engine
//                catches; W drive
//   chase        the tail: he keeps 25 .. 60 m ahead (closer as it goes),
//                swerves through the market and sends its crates into my
//                road; a truck out of a side street; headlamps the other way
//   close        past the mark he can be caught; within 30 m: RMB aim, LMB
//                fire (the revolver out of the window)
//   shot         his rear tyre goes: he fishtails, spins, side-on into a
//                lamp post (it bends; its lamp swings and stays lit)
//   crash        I stop beside him (the car brakes itself if I do not);
//                E get out; he crawls out of his door
//   interrogate  E: his lapels; the one question, asked with a look at the
//                river: "Pier nine." I let go. (ctx.next())
// Failing is soft: he gets 90 m away for 5 s (or I put the car into the
// truck): black, back to the last of three marks on the road.
// Music: the slot 'tail' from the engine catching to the question.
const M = ROAD.marks;

// where each beat finds the two cars (s along the road, d across, speed)
const AT = {
  start: { my: { s: M.start, d: 4.4, speed: 0 }, his: { s: M.start + 70, d: 1.9, speed: 0 } },
  chase: { my: { s: 120, d: 2.2, speed: 22 }, his: { s: 170, d: 1.9, speed: 23 } },
  close: { my: { s: M.close - 10, d: 1.8, speed: 25 }, his: { s: M.close + 16, d: 1.9, speed: 25 } },
};

function build(ctx, which) {
  const T = new Tail(ctx);
  ctx.flags.tail = T;
  const at = AT[which] || AT.start;
  T.spawn({ ...at, state: which === 'start' ? 'start' : which === 'chase' ? 'chase' : 'close' });
  if (which !== 'start') {
    // (what the road has already done by here stays done)
    const at0 = at.my.s;
    Object.assign(T.flags, { train: at0 > M.train, truck: at0 > M.truck - 60, oncoming: at0 > M.oncoming - 60 });
    T.checkpoint = ROAD.checkpoints.filter((c) => c < at0).pop() ?? ROAD.checkpoints[0];
  }
  ctx.onStep((dt) => T.step(dt));
  // (look development: ?tailAt=s,d,speed[,his gap] puts my car there, moving;
  // &tailCruise=1 holds that speed, straight on)
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q && q.get('tailAt')) {
    const [s, d, sp = 0, gap = 30] = q.get('tailAt').split(',').map(Number);
    T.my.place(roadPoint2(s, d), carYaw2(s), sp);
    T.his.place(roadPoint2(s + gap, 1.9), carYaw2(s + gap), sp);
    if (q.get('tailCruise')) T.cruise = sp;
  }
  // (?tailView=s,d,y,yaw,pitch[,fov]: an eye standing on the road there, for the
  // river's and the far bank's look; yaw 0 looks down the road)
  if (q && q.get('tailView')) {
    const [s, d, y, yw, pt, fov] = q.get('tailView').split(',').map(Number);
    const p = roadPoint2(s, d);
    const pose = { x: p.x, y: ctx.stage.surfaceY(p.x, p.z) + y, z: p.z, yaw: eyeYaw2(s) + yw, pitch: pt };
    ctx.onStep(() => { const C = ctx.game.controller; if (C.mode !== 'cutscene') { C.setMode('cutscene', { track: () => pose, ease: 0.001 }); if (fov) { ctx.game.camera.fov = fov; ctx.game.camera.updateProjectionMatrix(); } } });
  }
  return T;
}

// the shot's moment: his tyre just gone, 20 m ahead
function buildShot(ctx) {
  const T = build(ctx, 'close');
  T.goodShots = 4;
  T.taught = true; T.shots = 4;
  T.tyre(1);
  return T;
}
// the wreck: him against his post, me stopped behind him
function buildCrash(ctx, { out = false } = {}) {
  const T = build(ctx, 'close');
  const L = ctx.stage.lamps;
  const post = L.posts.find((p) => p.s > M.close + 70);
  T.state = 'close';
  T.tyre(1);
  const S = T.spin;
  S.sEnd = post.s + 0.2; S.dEnd = post.d - (T.his.spec.halfW + 0.24);
  T.spin.post = post;
  // run the spin out at once
  for (let i = 0; i < 400 && !S.hit; i++) S.drive(T.his, 1 / 60);
  T.his.pose(0);
  // my car beside him, stopped
  const sd = Math.min(4.6, post.d - 3.9);
  T.my.place(roadPoint2(post.s - 9.5, sd), carYaw2(post.s - 9.5), 0);
  T.stop = { s: post.s - 9.5, d: sd, fixed: true };
  T.my.parkedT = 1;
  return T;
}
import { roadPoint as roadPoint2, carYawAt as carYaw2, eyeYawAt as eyeYaw2 } from '../stages/riverroad/road.js';

export default defineScene({
  id: 'tail', stage: 'riverroad',
  beats: ['start', 'chase', 'close', 'shot', 'crash', 'interrogate'],
  save: ['chase', 'close'],
  setup: {
    start(ctx) { build(ctx, 'start'); },
    chase(ctx) { build(ctx, 'chase'); },
    close(ctx) { build(ctx, 'close'); },
    shot(ctx) { buildShot(ctx); },
    crash(ctx) { buildCrash(ctx); },
    interrogate(ctx) { buildCrash(ctx, { out: true }); },
  },

  *script(ctx) {
    const G = ctx.game;
    const T = ctx.flags.tail;
    G.music.cue('tail', { fade: 2.5 });
    if (ctx.at('start')) {
      yield beat('start');
      // the engine catches; his tail lamps down the road
      G.sfx.play('tail_start', null, {});
      T.his.input.throttle = 0;
      yield wait(1.1);
      // [2nd pass] the prompt until the car moves: W pressed early (in the
      // engine's catch) drove off with 'W drive' left on the dials, waiting
      // for a second press
      while (T.state === 'start' && !ctx.pressed('KeyW')) { G.hud.prompt('W  drive', null, 'scene'); yield null; }
      G.hud.clearPrompt('scene');
    }
    if (ctx.at('chase')) {
      yield beat('chase');
      yield until(() => T.state === 'close');
    }
    if (ctx.at('close')) {
      yield beat('close');
      yield until(() => T.state === 'shot' || T.state === 'crashed');
    }
    if (ctx.at('shot')) {
      yield beat('shot');
      yield until(() => T.state === 'crashed');
      // my car to a stop behind him (it brakes itself if I do not)
      // (my car eases to a stop beside his: Tail.tyre set the stop)
    }
    if (ctx.at('crash')) {
      yield beat('crash');
      yield until(() => T.my.speedAbs < 0.3 && T.stop && (T.my.parkedT || 0) > 0.2);
      const Q = new Question(T);
      T.question = Q;
      Q.spawnWatcher();
      yield* ctx.prompt({ text: 'get out', key: 'KeyE' });
      yield* Q.getOut();
      // to him: E when I am close
      const man = Q.man;
      for (;;) {
        const e = G.camera.position, near = Math.hypot(man.pos.x - e.x, man.pos.z - e.z) < 2.2;
        if (near) G.hud.prompt('E  take him', G.screenOf(man.pos.clone().setY(man.pos.y + 1.35)), 'scene');
        else G.hud.clearPrompt('scene');
        if (near && ctx.pressed('KeyE')) break;
        yield null;
      }
      G.hud.clearPrompt('scene');
      yield* Q.grab();
    }
    if (ctx.at('interrogate')) {
      yield beat('interrogate');
      let Q = T.question;
      if (!Q) {
        // (entered here: out of the car, beside him, and hands on him)
        Q = T.question = new Question(T);
        Q.spawnWatcher();
        yield* Q.getOut();
        yield* Q.grab();
      }
      yield until(() => Q.step(1 / 60));
      yield wait(0.5);
      yield* ctx.say('Pier nine.', 2.4);
      yield* Q.release();
      yield wait(1.4);
      G.music.stop(2);
      T.dispose();
      ctx.next();
    }
  },
});
