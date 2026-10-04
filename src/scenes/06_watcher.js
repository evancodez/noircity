import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { ROOM, STREET_WIN, WATCH_AT, ESC, ESC_RAIL, L3Y, HIS_CAR, MY_CAR, STRETCHES, KITCHEN, GATE, hisNames } from '../stages/backlot/plan.js';
import { Chase, RULES, STRETCH_ORDER, hisStart } from './watcher/chase.js';
import { pathAt, project } from './watcher/course.js';
import { mercerCar } from './watcher/street.js';
import { seamWarm } from './watcher/seam.js';
import { makeUmbrella } from './watcher/umbrella.js';
import { makeBlind } from './watcher/blind.js';
import { RUNHANDS } from '../player/clips/run.js';
import { SLAT, DOOR } from '../player/clips/watcher.js';
import { officeStreet, officeAfterFight, makeOfficeBlind, officeRun, wayOut, WAY_OUT, curtainAside } from './watcher/office.js';
import { ROOM as OROOM } from '../stages/office/plan.js';
import { BLIND as OBLIND } from '../stages/office/build/openings.js';

// Chapter V, The Watcher (lane B4; the chase rebuilt as a game by lane C6).
//   seen     at room 304's street window, E: two fingers part the blind.
//            Across the street under the lamp and his umbrella, a man
//            looking up at this window; he sees me see him, the umbrella
//            goes, he runs. E the fire escape: out under the sash.
//   escape   down the iron (W, the mouse), the ladder sliding down under my
//            weight, the drop to the flags. He runs at his own pace, looking
//            back up at the iron; standing on it, I lose him.
//   alley .. street   the chase on foot (the run mode, player/modes/run.js;
//            the rules, scenes/watcher/chase.js; the things in the way,
//            stages/backlot/parts/things.js): a stretch each, a checkpoint
//            each - the alley (the bins he pulls down: SPACE, taught), the
//            lane (its fences; one broken at its foot: C, taught), the yard
//            (two lanes of washing: read his shadow; his door slammed, the
//            other locked), the kitchen (out under the roller door), over
//            (the fork: the roofs and the jump, or Tanner's Row under them),
//            the street (Mercer Street's car, the market, its gate).
//   car      Pell Lane: he gets into his sedan, the starter grinds; my coupe
//            under its lamp behind it: E at its door, and the cut into its
//            seat (chapter VI, lane C3's city, its first street the copy of
//            this one) inside the movement, no fade.
// Losing him: "He's getting away." first, then "Lost him." (the kit's
// game.fail), back at the start of the stretch.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// what the detective carries by now (a cold start gets it too)
const INV = ['matchbook', 'amesCard', 'check', 'revolver'];
const EYE = 1.63;
const PEEK = 44;
const SLIT_Z = 4.46;
const RUN_BEATS = ['alley', 'lane', 'yard', 'kitchen', 'press', 'el', 'cut', 'over', 'street', 'market', 'car'];
// the teach cards: one line each, the key drawn (seams/Z.md §2); the first
// SPACE and the first C are held (time crawls until the key)
export const TEACH = {
  run: '[W] run', vault: '[SPACE] over', slide: '[C] under', shoulder: '[SPACE] through it',
  jump: '[SPACE] jump', slideDown: '[C] slide down',
};
// which card a stretch shows once more after two fails there
const AGAIN = { alley: 'vault', lane: 'slide', yard: 'shoulder', press: 'slide', el: 'vault', cut: 'slide', over: 'jump', street: 'shoulder', market: 'vault' };
const CHASE = { slot: 'chase', fade: 0.4 };
// ([C6 3rd] for the plays' hands: his way by the course's own names, so the
// tools follow the course as it is built - tools/lib/c6_chase.mjs)
if (typeof window !== 'undefined') window.__c6 = { hisNames };

// ---- the things every beat's setup does -------------------------------------------------------
function common(ctx, name) {
  const G = ctx.game;
  for (const k of INV) if (!G.save.inventory.includes(k)) G.save.inventory.push(k);
  const stage = G.stage;
  const chase = stage.part('chase');
  if (chase) chase.reset();
  const things = stage.part('things');
  if (things) things.reset(RUN_BEATS.includes(name) ? name : 'alley');
  const cars = stage.part('cars');
  if (cars && cars.his) resetCar(stage, cars.his);
  // his choices: the lane of the yard and the way over are his each try,
  // kept for a retry past the point where he made them
  const keep = G._c6 || {};
  const i = RUN_BEATS.indexOf(name);
  const C = new Chase(ctx, { lane: i > RUN_BEATS.indexOf('yard') ? keep.lane : null, over: i > RUN_BEATS.indexOf('over') ? keep.over : null });
  G._c6 = { lane: C.lane, over: C.over };
  ctx.flags.chase = C;
  // the doors at the head of the yard's lanes: his shut (he will open it), the other locked
  if (things) {
    things.get('door' + C.lane).set('shut');
    things.get('door' + (C.lane === 'W' ? 'E' : 'W')).set('locked');
  }
  ctx.flags.street = mercerCar(stage);
  // the kitchen's two hands, at the range and the sink (they flatten to the
  // wall as he goes by: cookStep)
  if (stage.cast && stage.cast.has('c6_cook')) {
    ctx.flags.cooks = [
      { c: stage.cast.spawn('c6_cook', { at: { x: 51.86, z: -90.2 }, yaw: -Math.PI / 2 }), yaw1: Math.PI / 2 },
      { c: stage.cast.spawn('c6_cook', { at: { x: 68.44, z: -93.9 }, yaw: Math.PI / 2 }), yaw1: -Math.PI / 2 },
      // [C6 2nd] the pressmen (paper caps, aprons: the same cut): at the
      // north line's first unit, at its second from the middle aisle
      { c: stage.cast.spawn('c6_cook', { at: { x: 76.0, z: -94.35 }, yaw: 0 }), yaw1: Math.PI },
      { c: stage.cast.spawn('c6_cook', { at: { x: 84.0, z: -90.35 }, yaw: Math.PI }), yaw1: 0 },
    ];
  }
  ctx.flags.umb = stage._b4umb || (stage._b4umb = makeUmbrella(stage));
  G.controller.frozen = false;
  G.player.weapons.equip(null);
  G.hands.equip('empty');
  RUNHANDS.cam = G.camera;
  return C;
}

// the watcher's lamp, the umbrella lying under it (he ran from there)
function umbrellaDown(ctx) { ctx.flags.umb.lie(WATCH_AT.x + 1.3, WATCH_AT.z - 0.9, 0.7); }

// the office (lane B2's) if it is there with the anchors this scene needs
function office(G) {
  try {
    if (!G.stages.names.includes('office')) return null;
    const O = G.stages.get('office');
    if (O.anchor('office.window.street') && O.anchor('office.street.watcher') && O.anchor('office.window.escape')) return O;
  } catch (e) { console.warn('watcher: the office stage would not build: ' + e.message); }
  return null;
}

// the eye at the stand-in's street window, the blind a hand's breadth ahead
function streetWindow(ctx) {
  const G = ctx.game;
  const z = -7.5 - 0.28;
  const blind = ctx.flags.blind || (ctx.flags.blind = makeBlind(G.stage, { w: STREET_WIN.w - 0.04, h: STREET_WIN.h - 0.04 }));
  blind.place(V(STREET_WIN.x, STREET_WIN.sill + STREET_WIN.h / 2, z - 0.04), Math.PI);
  blind.part(0);
  const at = { pos: V(STREET_WIN.x - 0.02, ROOM.y0, z - 0.34), yaw: Math.PI + 0.12, eyeY: ROOM.y0 + EYE };
  G.controller.setMode('seated', { anchor: at, eyeY: at.eyeY, pitch: -0.36, forward: 0, lean: 0.02, yawRange: [-1.6, 1.6], pitchRange: [-0.95, 0.6], swivel: 9 });
  return blind;
}

// his car on its kerb, its lamps dark
function resetCar(stage, car) {
  car.pos.set(HIS_CAR.x, 0, HIS_CAR.z); car.yaw = HIS_CAR.yaw;
  car.group.visible = true;
  lamps(stage, car, 0);
  car.collider.cx = car.pos.x; car.collider.cz = car.pos.z; car.collider.angle = car.yaw; car.collider.c = Math.cos(car.yaw); car.collider.s = Math.sin(car.yaw);
  stage.part('cars').pose(car);
  if (car.tail) car.tail.set(0);
}
function lamps(stage, car, k) {
  if (car.spotI0 == null) return;
  car.spot.intensity = car.spotI0 * k;
  car.cones.forEach((c, i) => { c.material.uniforms.uIntensity.value = car.coneI0[i] * k; });
  car.entry.intensity = car.entryI0 * k;
  car.lens.material = k > 0.5 ? car.lensOn : stage.M.glass;
}

// the watcher standing under his lamp, the umbrella up, looking at the window
function watcherAtLamp(ctx, C) {
  const yaw = Math.atan2(STREET_WIN.x - WATCH_AT.x, -7.5 - WATCH_AT.z);
  const w = C.spawn({ x: WATCH_AT.x, z: WATCH_AT.z }, yaw, 'watcher_stand');
  C.act = 'stand';
  ctx.flags.umb.hold(w.fig);
  return w;
}

// a run stretch's retry: me at its start, him ahead along his way by what it
// starts with, what he knocked down from it on put back
function runSetup(name) {
  return (ctx) => {
    const C = common(ctx, name);
    const G = ctx.game;
    const S = STRETCHES[name];
    let at = S.at, yaw = S.yaw;
    let turnToHim = true;
    if (name === 'kitchen') {
      // (just inside his door, facing into the kitchen; his door open behind me)
      const d = KITCHEN.doors[C.lane];
      at = [d.x, KITCHEN.z1 - 1.25];
      // ([C6 4th] up the corridor beside the table, his way: turned onto him
      // across the room, W straight on ran into the table's end)
      const k = C.course.nodes.get(C.lane === 'W' ? 'wK' : 'eK');
      yaw = Math.atan2(-(k.x - at[0]), -(k.z - at[1]));
      turnToHim = false;
      G.stage.part('things').get('door' + C.lane).set('open');
    }
    // ([C6 4th] the car's retry looks at the cars, not at him)
    if (name === 'car') turnToHim = false;
    C.spawn({ x: at[0], z: at[1] - 10 }, 0, 'watcher_run');
    C.place(hisStart(C, name, at, G.fails ? G.fails(name) : 0));
    umbrellaDown(ctx);
    G.stage.part('chase').ladder.set(1);
    // (the bins he pulled down in the alley lie across it behind me)
    if (RUN_BEATS.indexOf(name) > 0) { const b = G.stage.part('things').get('bins'); if (b && !b.state.go) { b.trigger(); b.update(2); } }
    // ([C6 2nd] past the kitchen, its iron door stands open as he left it)
    if (RUN_BEATS.indexOf(name) > RUN_BEATS.indexOf('kitchen')) { const d = G.stage.part('things').get('kdoor'); if (d) d.set('open'); }
    // ([C6 3rd] the cut's retry: he has just gone through its gate and pulled it to)
    if (name === 'cut') { const g = G.stage.part('things').get('cutGate'); if (g) g.set('shut'); }
    // ([C6 3rd] the eye on him if he is anywhere near the way ahead: at the
    // lane's and the yard's retries he was off the frame's edge or behind
    // the fence, and a man who looked round for him was warned at once)
    if (turnToHim) {
      const wr = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      const b = Math.atan2(-(C.fig.pos.x - at[0]), -(C.fig.pos.z - at[1]));
      const d = wr(b - yaw);
      if (Math.abs(d) < 1.2) yaw += d * 0.85;
    }
    G.controller.setPose(at[0], at[1], yaw, 0.0);
    if (name === 'car') { C.active = false; G.hands.equip('empty'); return; }
    G.hands.equip('run');
    startRun(ctx);
    // ([C6 3rd] the street's retry: the car is set coming by streetStep as I
    // run up Mercer Street - it reaches the corner as I do)
  };
}

export default defineScene({
  id: 'watcher', stage: 'backlot',
  beats: ['seen', 'escape', ...RUN_BEATS],
  save: ['escape', ...RUN_BEATS],
  objectives: {
    seen: 'Check the street.', escape: 'After him. Down the fire escape.',
    alley: 'Don’t lose him.', lane: 'Don’t lose him.', yard: 'Don’t lose him.', kitchen: 'Don’t lose him.',
    press: 'Don’t lose him.', el: 'Don’t lose him.', cut: 'Don’t lose him.', over: 'Don’t lose him.', street: 'Don’t lose him.', market: 'Don’t lose him.', car: 'Get to your car.',
  },
  music: null,
  beatMusic: { escape: CHASE, alley: CHASE, lane: CHASE, yard: CHASE, kitchen: CHASE, press: CHASE, el: CHASE, cut: CHASE, over: CHASE, street: CHASE, market: CHASE, car: CHASE },
  setup: {
    seen(ctx) {
      const C = common(ctx, 'seen');
      const O = office(ctx.game);
      if (O) { ctx.flags.office = O; atOfficeWindow(ctx, C, O); return; }
      watcherAtLamp(ctx, C);
      streetWindow(ctx);
    },
    escape(ctx) {
      const C = common(ctx, 'escape');
      const G = ctx.game;
      // out on the top landing, the window behind me; below, he is crossing
      // the street to the alley's mouth
      C.spawn({ x: WATCH_AT.x, z: WATCH_AT.z }, 0, 'watcher_run');
      C.place(4.5);
      umbrellaDown(ctx);
      G.controller.setPose(ESC_RAIL[1].x, ESC_RAIL[1].z, Math.PI - 0.25, -0.5, L3Y);
      G.hands.equip('run');
    },
    alley: runSetup('alley'), lane: runSetup('lane'), yard: runSetup('yard'), kitchen: runSetup('kitchen'),
    press: runSetup('press'), el: runSetup('el'), cut: runSetup('cut'), over: runSetup('over'), street: runSetup('street'), market: runSetup('market'), car: runSetup('car'),
  },

  *script(ctx) {
    const G = ctx.game;
    const C = ctx.flags.chase;
    const H = G.hands;
    const things = ctx.stage.part('things');
    // (he waits where the stretch has him while I cannot act: the chapter
    // card, the black of a fail lifting)
    // (and I with him while the chapter card is up: a cold start at a stretch)
    // ([C10a] after the critic: the restart after a fail or a CONTINUE was the
    // tightest of I - VII - he ran on through the black's 0.7 s lifting and a
    // hands-off player was warned 2.1 s after the screen cleared. Now he waits
    // through the lifting too, and then until I first move (W A S D, the
    // arrows, Shift, SPACE) or a second has gone: a player who is there loses
    // nothing to his reaction; hands off still loses, a second or two later)
    const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'];
    // (only just after the black or the card: never mid-run)
    let clearAt = -1;
    C.held = () => {
      if (!!G.failing || G.hud.cardT > 0.1 || !!(G.scenes.trans && G.scenes.trans.phase === 'out')) { clearAt = null; return true; }
      if (clearAt === -1) return false;
      if (!C.active) { clearAt = -1; return false; }
      if (clearAt == null) clearAt = G.time;
      if (G.time - clearAt >= 1.0 || MOVE.some((k) => G.controller.keys.has(k))) { clearAt = -1; return false; }
      return true;
    };
    ctx.onStep((dt) => {
      C.step(dt);
      if (ctx.flags.umb) ctx.flags.umb.update(dt);
      if (ctx.flags.umbO) ctx.flags.umbO.update(dt);
      if (ctx.flags.street) ctx.flags.street.step(dt, G.controller.pos);
      if (ctx.flags.car) ctx.flags.car.step(dt);
      carClock(ctx, dt);
      teachStep(ctx, dt);
      dogStep(ctx, dt);
      cookStep(ctx, dt);
      streetStep(ctx);
      trainStep(ctx);
      warmStep(ctx);
      capStep(ctx);
    });
    things.onEvent = (name, T, d) => thingSound(G, name, T, d);

    // ---- seen: the slats, the man under the lamp ---------------------------------------------
    if (ctx.at('seen')) {
      yield beat('seen');
      yield* seenAtWindow(ctx);
      ctx.flags.leftWindow = true;
      if (ctx.flags.office) yield* outOfOffice(ctx);
      else {
        const e = ESC_RAIL[0];
        const P0 = G.controller.eyePose();
        const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
        const dyaw = wrapA(-Math.PI / 2 - P0.yaw);
        const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
        G.controller.setMode('cutscene', { ease: 0.05, track: (t) => {
          const a = sm(t / 0.4), b = sm((t - 0.1) / 0.72);
          return { x: P0.x + (e.x - P0.x) * b, y: P0.y + (e.y + EYE - P0.y) * b, z: P0.z + (e.z - P0.z) * b, yaw: P0.yaw + dyaw * a, pitch: P0.pitch + (-0.22 - P0.pitch) * a };
        } });
        yield wait(0.82);
      }
    }

    // ---- escape: down the iron --------------------------------------------------------------
    if (ctx.at('escape')) {
      yield beat('escape');
      H.equip('run');
      const chase = G.stage.part('chase');
      const T = ctx.flags.through;
      const s0 = T ? T.s : ctx.from === 'escape' ? railS(1) : 0;
      let ended = false, landed = false;
      G.controller.setMode('escape', {
        rail: ESC_RAIL, s: s0, endYaw: 0, game: G, ladder: ESC.ladder,
        ...(T ? { v: T.v, autoTo: railS(1) + 0.12, pitchBase: T.pitch } : {}),
        onEvent: (name, d) => {
          if (name === 'foot') G.sfx.play(d.kind === 'stair' ? 'w_ironStep' : 'w_ironWalk', G.eye.clone().setY(d.y));
          if (name === 'landing') G.sfx.play('w_landing', G.eye.clone().setY(d.y));
          if (name === 'ladder') G.sfx.play('w_ladder', G.eye.clone());
          if (name === 'ladderStop') { G.sfx.play('w_ladderStop', G.eye.clone().setY(0.5)); G.controller.shake(0.35); landed = true; }
          if (name === 'drop') { G.sfx.play('w_land', G.eye.clone().setY(0.1)); G.controller.shake(0.3); }
          if (name === 'end') ended = true;
        },
      });
      if (T) escapeDraw(ctx, T, C);
      // his own pace up the alley: a run, not his sprint, looking back up at
      // the iron - until he hears the ladder come down; then he goes
      C.active = true; C.stretch = 'alley'; C.grace = 0;
      C.paceCap = 3.8;
      C.escape = true;
      let still = 0;
      yield until(() => {
        const e = G.controller.esc;
        if (e) {
          const i = e.rail.length - 3;
          const L0 = e.rail[i].s, L1 = e.rail[i + 1].s;
          chase.ladder.set(e.s > L0 ? Math.min(1, (e.s - L0) / (L1 - L0)) : 0);
          still = e.s < railS(3) && e.v < 0.1 ? still + 1 / 60 : 0;
          if (still > 2.5) G.hud.prompt('W  down', null, 'scene'); else G.hud.clearPrompt('scene');
        }
        if (landed) { C.paceCap = null; }
        return ended;
      });
      C.paceCap = null;
      C.escape = false;
      G.hud.clearPrompt('scene');
      startRun(ctx);
    }

    // ---- the run: a stretch at a time ------------------------------------------------------------
    const first = RUN_BEATS.includes(ctx.from) ? ctx.from : 'alley';
    C.active = first !== 'car';
    if (C.stretch == null || STRETCH_ORDER.indexOf(C.stretch) < STRETCH_ORDER.indexOf(first)) C.stretch = first;
    C.grace = ctx.from === first ? RULES.grace : 0;
    // (failed twice here: the card of the thing that cost me most, once more -
    // the last thing I hit or came at wrong before he got away; else the
    // stretch's own)
    if (G.fails(first) === 2) {
      const rec = (G._c6lost || []).slice(-1)[0];
      const bad = rec && (rec.met || []).slice().reverse().find((m) => m[1] === 'hit' || m[1] === 'early' || m[1] === 'late');
      const T = bad && ctx.stage.part('things').get(bad[0]);
      const card = T ? (T.kind === 'under' ? 'slide' : T.kind === 'jump' ? 'jump' : T.kind === 'slope' ? 'slideDown' : T.kind === 'shoulder' ? 'shoulder' : 'vault') : AGAIN[first];
      if (card) ctx.hud.teach.again(card, TEACH[card]);
    }
    for (let i = RUN_BEATS.indexOf(first); i < RUN_BEATS.length; i++) {
      const name = RUN_BEATS[i];
      if (name !== first) yield until(() => STRETCH_ORDER.indexOf(C.stretch) >= STRETCH_ORDER.indexOf(name));
      yield beat(name);
      if (name === 'car') break;
    }
    // ---- car: he gets into his sedan; mine behind it -----------------------------------------------
    yield* carBeat(ctx);
  },
});

// ---- the escape's draw of the look: from the cut, down to him in the street ---------------------
function escapeDraw(ctx, T, C) {
  const G = ctx.game;
  let k = 1, draw = 0;
  const sOut = railS(1) - 0.45;
  ctx.onStep((dt) => {
    if (k > 0) { k = Math.max(0, k - dt / 0.3); G.hud.fade(k * k * (3 - 2 * k)); }
    const e = G.controller.esc;
    if (!e || draw === -2) return;
    if (e.idle < draw - 1e-6 || G.held('KeyW') || G.held('ArrowUp')) { draw = -2; return; }
    draw += dt;
    e.idle = draw;
    if (draw > 1.8) { draw = -2; return; }
    const him = C.fig.bones.chest.getWorldPosition(V(0, 0, 0)), eye = G.eye;
    const yawTo = Math.atan2(-(him.x - eye.x), -(him.z - eye.z));
    const pitchTo = Math.atan2(him.y - eye.y, Math.hypot(him.x - eye.x, him.z - eye.z));
    const out = Math.min(1, Math.max(0, (e.s - sOut) / 0.3));
    const a = 1 - Math.exp(-dt * 4.2);
    e.look.yaw += Math.atan2(Math.sin(yawTo - e.heading - e.look.yaw), Math.cos(yawTo - e.heading - e.look.yaw)) * a * (0.25 + 0.75 * out * out * (3 - 2 * out));
    e.look.pitch += (pitchTo - e.pitchBase - e.look.pitch) * a;
  });
}

// ---- the run mode, with the things and the sounds ------------------------------------------------
export function startRun(ctx, { v = null } = {}) {
  const G = ctx.game;
  const stage = G.stage;
  G.hands.equip('run');
  G.controller.setMode('run', {
    // ([C6 3rd] 6.75 m/s, was 6.8: a little quicker than his 6.5, not so much
    // that a miss is made up before the stretch is out)
    game: G, speed: 6.75, side: 2.6, things: stage.part('things'), v: v ?? undefined,
    onEvent: (name, d) => runEvent(ctx, name, d),
    ease: 0.25,
  });
}

function runEvent(ctx, name, d) {
  const G = ctx.game, at = G.eye.clone();
  const C = ctx.flags.chase;
  const R = G.controller.run;
  const S = (n, y = null, p = {}) => G.sfx.play(n, y == null ? at : at.clone().setY(y), p);
  switch (name) {
    case 'vault': S('w_vault'); break;
    case 'scramble': S('w_fenceHit'); S('w_vault'); break;
    case 'climb': S('w_fenceHit'); break;
    case 'trip': S('w_stumble', 0.4); S('w_fenceHit', 0.6); break;
    case 'hit': S('w_hitWall', 1.2); G.sfx.play('grunt', null, { f0: 95, k: 0.35, dur: 0.22 }, { send: false }); break;
    // ([C6 3rd] a locked door says so, sound or no sound)
    case 'rattle': S('w_rattle', 1.2); if (d && d.T && (!ctx.flags.saidLocked || G.time - ctx.flags.saidLocked > 2.5)) { ctx.flags.saidLocked = G.time; G.hud.say('Locked.', 1.4); } break;
    case 'slide': S('w_slide', 0.2); break;
    case 'duck': case 'crawl': S('w_duck', 0.5); break;
    case 'bash': S('w_doorBang', 1.2); break;
    case 'bruise': S('w_doorBang', 1.2); G.sfx.play('grunt', null, { f0: 90, k: 0.3, dur: 0.2 }, { send: false }); break;
    case 'push': S('w_doorBang', 1.2, { k: 0.6 }); break;
    case 'jump': S('w_hop'); break;
    case 'catch': S('w_catch', 1.0); G.sfx.play('grunt', null, { f0: 85, k: 0.4, dur: 0.3 }, { send: false }); break;
    case 'haul': S('w_haul', 1.0); break;
    case 'slideDown': S('w_slideRoof', 0.5); break;
    case 'slither': S('w_slither', 0.5); break;
    case 'hop': S('w_hop'); break;
    case 'land': S(d && d.hard ? 'w_landHard' : 'w_land', 0.1); break;
    case 'step': {
      // my feet: the wet flags, the iron of the stair, the tar of the roofs, the tiles
      const p = at.clone().setY(R ? R.feet + 0.05 : 0.05);
      const kind = d.level === 'roof' ? (G.stage.surfaceY(d.x, d.z) > 0.1 && Math.abs(G.stage.surfaceY(d.x, d.z) - 7.2) > 0.05 && d.x > 56 && d.z > -106.2 ? 'w_ironStep' : 'w_roofStep') : 'step';
      if (kind === 'step') G.sfx.step(p, true, false, false); else G.sfx.play(kind, p);
      // my breath, hard, with the stride
      C._br = (C._br || 0) + 1;
      if (C._br % 3 === 0 && d.v > 4) G.sfx.play('w_breath', null, { k: Math.min(1.2, d.v / 7) });
      break;
    }
    case 'meet': {
      // (the record of every thing met and how: the proofs read it)
      (C.met || (C.met = [])).push([d.T.id, d.how, +(G.time || 0).toFixed(2)]);
      break;
    }
    default: break;
  }
  // the sheets swing as I go through them
  if (R && name === 'step') G.stage.part('chase').sheets.touch(G.controller.pos.x, G.controller.pos.z, G.controller.vel.x, G.controller.vel.z, 1);
}

// the things' own noises (his doings, a door, the bins rolling)
function thingSound(G, name, T, d) {
  // ([C6 3rd] the lid off the bin at the alley's T: knocked off, it clangs; it rings on the flags)
  if (name === 'lid' && d) { G.sfx.play('w_bins', V(d.x, 0.8, d.z), { k: 0.45 }); return; }
  if (name === 'lidHit' && d) { G.sfx.play('w_fenceHand', V(d.x, 0.05, d.z), { k: 0.5 }); return; }
  if (!T) return;
  const F = T.frame ? T.frame() : null;
  const p = F ? V(F.cx, 0.6, F.cz) : null;
  if (name === 'slam') G.sfx.play('w_slam', p ? p.setY(1.2) : null);
  else if (name === 'rattle') G.sfx.play('w_rattle', p ? p.setY(1.2) : null);
  void d;
}

// ---- what holds my run back: the chapter card (a cold start: he waits too),
// and him - a man in my way: on his heels I run at his pace, never through him
function capStep(ctx) {
  const G = ctx.game, R = G.controller.run, C = ctx.flags.chase;
  if (!R) return;
  let cap = null;
  if (G.hud.cardT > 0.1) cap = 0;
  else if (C && C.active && !C.escape && !C.otherWay() && (C.act === 'run' || C.act === 'vault' || C.act === 'slide' || C.act === 'arc')) {
    // ([C6 3rd] three metres back, not one and a half: on his heels he is a
    // whole man in the frame - his arm out to what he pulls down, the thing
    // itself - not a coat filling the lens)
    // (held to his real pace along the way, not the pace he means: over a
    // stack the clip carries him slower than that, and a runner held to the
    // meant pace crept up through him and, past -2 m, ran on ahead of him to
    // his car. Closer than three metres, a little under his pace - his back
    // in my way - so the gap comes back to three; never past him)
    const g = C.gapNow;
    const his = C.hisVel;
    if (g < 4.2 && g > -2) cap = Math.max(1.2, g >= 3.0 ? his + (g - 3.0) * 3.2 : his + (g - 3.0) * 1.5);
  }
  R.speedCap = cap;
}

// ---- the teach cards, at the moment of need -------------------------------------------------------
function teachStep(ctx, dt) {
  const G = ctx.game, R = G.controller.run, hud = ctx.hud;
  const F = ctx.flags;
  if (!R || G.failing) return;
  // W: if I stand at the ladder's foot not running
  if (!F.wTaught) {
    F.wT = (F.wT || 0) + dt;
    if (R.v > 1) F.wTaught = true;
    else if (F.wT > 1.4) { F.wTaught = true; hud.teach('run', TEACH.run, { until: 'KeyW' }); }
  }
  // ([C6 3rd] each verb's card at the first thing that asks for it - the bins
  // in a run from the window, fence1 in a cold start at the lane - and at the
  // latest when I am stopped against it: a SPACE pressed early at the broken
  // fence hopped me into it and its window passed inside the hop, so the
  // [C] card never came and I stood there untaught. Now: in a hop the card
  // comes for what the hop is carrying me into (and a key pressed under it
  // is kept for the hop's end: run.js), and stopped against a thing whose
  // verb is not yet taught, its card comes then, held for the first SPACE
  // and the first C)
  const taught = hud.kit && hud.kit.taught ? hud.kit.taught() : {};
  const show = (id) => { if (!taught[id]) hud.teach(id, TEACH[id], { hold: !!CARD_HELD[id], until: CARD_KEY[id] }); };
  if (R.blocked) { const id = CARD_OF[R.blocked.T.kind]; if (id) show(id); return; }
  if (R.move && R.move.kind !== 'hop') return;
  const things = G.stage.part('things');
  const q = things.ahead(G.controller.pos, G.controller.vel, R.level, 0.36);
  if (!q) return;
  const id = CARD_OF[q.T.kind], t = q.t;
  if (!id || taught[id]) return;
  // (the first SPACE and the first C: held, in the window - time crawls till
  // the key; in a hop, a little sooner, the hop carrying me in)
  if (CARD_HELD[id]) { if (R.move ? t < 0.55 : t < 0.3 && q.d > 0.25) show(id); return; }
  // (a door: when it is in front of me, not off to one side in the dark)
  if (id === 'shoulder') { if (t < 1.0 && facingThing(G, q) > 0.88) show(id); return; }
  if (id === 'jump') { if (t < 0.9) show(id); return; }
  if (id === 'slideDown') { if (t < 1.2) show(id); }
}
const CARD_OF = { over: 'vault', under: 'slide', shoulder: 'shoulder', jump: 'jump', slope: 'slideDown' };
const CARD_HELD = { vault: true, slide: true };
const CARD_KEY = { vault: 'Space', slide: ['KeyC', 'ControlLeft'], shoulder: ['Space', 'KeyE'], jump: 'Space', slideDown: ['KeyC', 'ControlLeft'] };
// how squarely the eye looks at the nearest point of a thing ahead (cos)
function facingThing(G, q) {
  const F = q.F, T = q.T, p = G.controller.pos;
  const along = Math.max(0, Math.min(F.L, q.u * F.L));
  const tx = T.a.x + F.t.x * along - p.x, tz = T.a.z + F.t.z * along - p.z;
  const L = Math.hypot(tx, tz) || 1;
  return (-Math.sin(G.controller.yaw) * tx - Math.cos(G.controller.yaw) * tz) / L;
}

// ---- the dog on its chain in Tanner's Row: up and at me as I come by; in its
// reach, its teeth in my coat (a jolt, the run checked), never more
function dogStep(ctx, dt) {
  const G = ctx.game, R = G.controller.run, F = ctx.flags;
  const chase = G.stage.part('chase');
  const dog = chase && chase.dog;
  if (!dog || !R) return;
  F.dogT = Math.max(0, (F.dogT || 0) - dt);
  F.biteT = Math.max(0, (F.biteT || 0) - dt);
  const p = G.controller.pos, rch = dog.reach();
  const d = Math.hypot(p.x - rch.x, p.z - rch.z);
  if (d < 7.5 && F.dogT <= 0 && R.feet < 1) {
    F.dogT = 2.8;
    dog.lunge({ x: p.x + G.controller.vel.x * 0.3, z: p.z + G.controller.vel.z * 0.3 });
    G.sfx.play('w_dog', V(dog.x, 0.8, dog.z));
  }
  // ([C6 2nd] it goes for me, not for where I was: its aim follows me while
  // it comes out - a man going by along the row's middle is in its reach; one
  // hugging the far wall is not)
  if (dog.t >= 0 && dog.t < 1.1 && R.feet < 1) dog.lunge0 = { x: p.x + G.controller.vel.x * 0.12, z: p.z + G.controller.vel.z * 0.12 };
  // (its jaws: the end of its chain and a head's reach; a bite is its teeth
  // in my coat - held a third of a second, the run gone out of me)
  F.snagT = Math.max(0, (F.snagT || 0) - dt);
  // ([C6 3rd] a quarter second, the run checked to a stagger: with the rules
  // tighter a bite was the stretch for clumsy hands on the row)
  if (F.snagT > 0) R.v = Math.min(R.v, 1.0);
  if (dog.t >= 0 && dog.t < 1.6 && F.biteT <= 0 && Math.hypot(p.x - dog.x, p.z - dog.z) < 1.15 && !R.move) {
    F.biteT = 2.0;
    F.snagT = 0.25;
    R.flinch(0.2, -0.08);
    R.v = Math.min(R.v, 1.0);
    G.controller.shake(0.55);
    G.sfx.play('grunt', null, { f0: 95, k: 0.3, dur: 0.2 }, { send: false });
    G.sfx.play('w_duck', G.eye.clone().setY(0.9));
    G.sfx.play('w_dog', V(dog.x, 0.8, dog.z), { k: 0.6 });
    (ctx.flags.chase.met || (ctx.flags.chase.met = [])).push(['dog', 'bit', +(G.time || 0).toFixed(2)]);
  }
}

// ---- the kitchen's hands: a man running through, and they are back against
// the range, the sink, the arms out flat, the head round after him
function cookStep(ctx, dt) {
  const G = ctx.game, C = ctx.flags.chase;
  for (const k of ctx.flags.cooks || []) {
    const F = k.c.fig;
    if (!k.flat) {
      const him = C.fig ? Math.hypot(C.fig.pos.x - F.pos.x, C.fig.pos.z - F.pos.z) : 99;
      const me = Math.hypot(G.controller.pos.x - F.pos.x, G.controller.pos.z - F.pos.z);
      if (him < 5.5 || me < 3.4) {
        k.flat = { t: 0, yaw0: F.yaw };
        k.c.play('c6cook_flatten', { fade: 0.08, hold: true });
        G.sfx.play('w_sill', F.pos.clone().setY(1.3));
      }
    } else if (k.flat.t < 0.3) {
      k.flat.t += dt;
      const u = Math.min(1, k.flat.t / 0.25), e = u * u * (3 - 2 * u);
      F.yaw = k.flat.yaw0 + Math.atan2(Math.sin(k.yaw1 - k.flat.yaw0), Math.cos(k.yaw1 - k.flat.yaw0)) * e;
    }
  }
}

// ---- Mercer Street's car: set coming so it is at the crossing as I am -------------------------------
function streetStep(ctx) {
  const G = ctx.game, C = ctx.flags.chase, S = ctx.flags.street;
  if (!S || S.S.armed || !C.active) return;
  if (C.stretch !== 'over' && C.stretch !== 'street') return;
  // ([C6 3rd] my way crosses its lane at the corner)
  const crossD = C.course.D.get('corner') + 1.6;
  const toCross = C.myD - crossD;
  const R = G.controller.run;
  const v = Math.max(5.5, R ? R.v : 6);
  // (it takes about 5 s to come down from the fog: started when I am that far off)
  if (toCross > 0 && toCross / v < 5.4) S.arm(toCross / v + 0.15);
}

// ---- [C6 2nd] the el's train: sent down the line toward me as I come out of
// the press hall's dock, so it thunders over the avenue while I am under it
// (once a try; its lamp is a white eye down the line before it)
function trainStep(ctx) {
  const G = ctx.game, C = ctx.flags.chase;
  if (!C || !C.active || C.trainSent) return;
  const i = STRETCH_ORDER.indexOf(C.stretch);
  if (i < STRETCH_ORDER.indexOf('el') || i > STRETCH_ORDER.indexOf('cut')) return;
  const p = G.controller.pos;
  // ([C6 3rd] sent as I come out of the delivery yard's gate onto the avenue:
  // it is over me as I run up under the el)
  if (!(p.x > 92.4 || C.stretch === 'cut')) return;
  const train = G.stage.part('train'), av = G.stage.part('avenue');
  if (!train || !train.run || !av) return;
  C.trainSent = true;
  // (it comes south down the line: over the alley's mouth about when I am there)
  train.run(av.sAtZ(-168), -1);
}

// ---- the city warmed ahead (lane C3's seam) -------------------------------------------------------
// From the chapter's first frames (under its card, at the window: frames that
// stand still - a long step there is not felt, as it would be in the market at
// a run), once a frame until it stands; then the seam's own (seam.js: what the
// cut into the seat would otherwise compile at once). The city stays built
// across a retry. (C3 asked for it from about two seconds before the door; it
// is the same work, done where a hitch cannot be seen.)
function warmStep(ctx) {
  const G = ctx.game, F = ctx.flags;
  if (F.warmed === 'done' || G.shotMode || !G.stages.warm) return;
  if (!F.warmed) { if (G.stages.warm('city')) F.warmed = 'city'; return; }
  if (F.warmed === 'city') {
    const city = G.stages.built && G.stages.built.get('city');
    const it = F.seamIt || (F.seamIt = seamWarm(G, city));
    if (it.next().done) F.warmed = 'done';
  }
}

// ---- [C6 3rd] his car's clock: it starts when HE is in, wherever I am -----------------------------
// (it started when I reached the gate: his car waited at the kerb for me
// however late I was, and once he was in nothing could lose me - a man
// stopped at the market's crates stood there forever.) The door shut (in my
// face if I am at his heels), the starter grinds, catches on the second try;
// the warning as it catches; he pulls away; and if I am not in my car by
// then he is gone: "Lost him." back to the stretch I am in.
function carClock(ctx, dt) {
  const G = ctx.game, C = ctx.flags.chase, F = ctx.flags;
  if (!C || !C.inCar || F.driven || G.failing) return;
  if (C.held && C.held()) return;
  const stage = G.stage, cars = stage.part('cars');
  if (!cars || !cars.his) return;
  if (!F.clock) {
    F.car = makeDrive(stage, cars, cars.his);
    F.clock = { t: 0, phase: 0 };
    const e = G.eye, d = Math.hypot(e.x - (HIS_CAR.x - 0.95), e.z - (HIS_CAR.z + 0.6));
    G.sfx.play('w_door', V(HIS_CAR.x - 0.95, 1, HIS_CAR.z + 0.6));
    if (d < 3.6 && G.controller.run) { G.controller.run.flinch(-0.12, -0.08); G.controller.shake(0.5); }
  }
  const K = F.clock, car = F.car;
  K.t += dt;
  // (quicker than it was: a man four misses behind in the market reached
  // his coupe before the old clock ran out every time - now the starter
  // grinds, catches at 2.2 s, the warning at 2.4; he pulls away at 3.6,
  // gone at 5.0: on his heels I am at my door a second after he is in, two
  // or three misses back I am warned and make it, four or five and he is gone)
  if (K.phase === 0 && K.t > 0.25) { K.phase = 1; G.sfx.play('w_starter', car.pos(), { dur: 0.75 }); }
  if (K.phase === 1 && K.t > 1.15) { K.phase = 2; G.sfx.play('w_starter', car.pos(), { dur: 0.9 }); }
  if (K.phase === 2 && K.t > 2.2) { K.phase = 3; car.start(); G.sfx.play('w_engine', car.pos()); }
  if (K.phase === 3 && K.t > 2.4) { K.phase = 4; F.carWarn = true; G.hud.warn('He’s getting away.'); }
  if (K.phase === 4 && K.t > 3.6) { K.phase = 5; car.go(); }
  if (K.phase === 5 && K.t > 5.0) {
    K.phase = 6;
    const rec = { stretch: C.stretch, gap: +C.gapNow.toFixed(1), unseen: 0, me: [+G.controller.pos.x.toFixed(1), +G.controller.pos.z.toFixed(1), null], act: 'car', why: 'drove off', met: (C.met || []).slice(-6) };
    (G._c6lost || (G._c6lost = [])).push(rec);
    G.fail({ why: 'Lost him.', to: C.stretch && C.stretch !== 'car' ? C.stretch : 'car' });
  }
}

// ---- the car beat ------------------------------------------------------------------------------
function* carBeat(ctx) {
  const G = ctx.game, C = ctx.flags.chase, H = G.hands;
  const stage = G.stage;
  const cars = stage.part('cars');
  C.active = false;
  // (his car's warning, if it is up, stays: carClock's)
  if (!ctx.flags.carWarn) G.hud.warn(null);
  // (from the car's save: the chase's music)
  if (ctx.from === 'car') G.music.cue('chase', { fade: 0.4 });
  // my car's door (the kerb side), and E there
  const door = cars.mine && cars.mine.handleAt ? cars.mine.handleAt() : V(MY_CAR.x + 0.76, 0.99, MY_CAR.z + 0.2);
  const doorOut = cars.mine && cars.mine.handleOut ? cars.mine.handleOut() : V(1, 0, 0);
  G.interact.add({ id: 'drive', at: door, range: 2.6, cone: 1.1, prompt: 'drive', onUse: () => { ctx.flags.driven = true; } });
  // (his car pulls away on its own clock - carClock; the run mode goes on;
  // at my car's door, a walk)
  yield until(() => ctx.flags.driven);
  G.hud.warn(null);
  G.interact.remove('drive');
  // my hand on the handle (object first), the door swung open, the eye in
  // under the roof's rail: the cut into the seat inside that movement, on the
  // black of the door frame crossing the lens (no fade, no card)
  const mine = cars.mine;
  SLAT.cam = G.camera;
  if (G.controller.run) G.controller.setMode('walk');
  H.equip('empty');
  G.controller.frozen = true;
  const g = mine.group;
  g.updateMatrixWorld(true);
  const L = (x, y, z) => V(x, y, z).applyMatrix4(g.matrixWorld);
  const lookAt = (from, to) => ({ yaw: Math.atan2(-(to.x - from.x), -(to.z - from.z)), pitch: Math.atan2(to.y - from.y, Math.hypot(to.x - from.x, to.z - from.z)) });
  const stand = (lx, lz, at) => { const p = L(lx, 0, lz); p.y = stage.surfaceY(p.x, p.z) + 1.63; return { x: p.x, y: p.y, z: p.z, ...lookAt(p, at) }; };
  // (the handle, live: the hand rides it as the door swings)
  const live = () => { DOOR.at = mine.handleAt(DOOR.at || V(0, 0, 0)); DOOR.out = mine.handleOut(DOOR.out || V(0, 0, 0)); };
  live();
  ctx.onStep(live);
  // 1. a step to it, the hand to the handle
  G.controller.ease(stand(-1.05, 1.45, door), 0.3);
  H.play('carDoor', { onMark: { grip: () => G.sfx.play('w_carDoorOpen', door) } });
  yield wait(0.4);
  // 2. the door swung open toward me (a step back out of its way), the hand off it
  G.controller.ease(stand(-1.75, 1.85, L(-0.35, 1.25, 0.7)), 0.42);
  for (let k = 0; k <= 1.0001; k += 1 / 60 / 0.42) {
    const u = Math.min(1, k), e = 1 - (1 - u) * (1 - u);
    mine.setOpen(1.08 * e);
    if (u > 0.35 && !ctx.flags.released) { ctx.flags.released = true; H.play('releaseDoor'); }
    yield null;
  }
  // 3. in: the eye into the opening and down under the roof's rail; as the
  // door frame passes over the lens, its black, and the seat
  const inside = L(-0.55, 1.32, 0.42);
  const P3 = { x: inside.x, y: inside.y, z: inside.z, ...lookAt(inside, L(-0.4, 1.2, -1.2)), pitch: -0.06 };
  G.controller.ease(P3, 0.42);
  const toLocal = new THREE.Matrix4().copy(g.matrixWorld).invert();
  yield until(() => {
    const c = G.camera.position.clone().applyMatrix4(toLocal);
    return c.z < 0.78;
  });
  G.hud.fade(1);
  yield wait(0.034);
  ctx.next({ fade: 'cut', card: false });
  // (the black held over the city's first frames - whatever the cut still
  // costs is inside it - then the seat)
  G.hud.fade(1);
  let n = 0;
  const lift = () => { if (++n < 3) requestAnimationFrame(lift); else G.hud.fade(0); };
  if (typeof requestAnimationFrame !== 'undefined' && !G.shotMode) requestAnimationFrame(lift); else G.hud.fade(0);
}

// ---- his car pulling away on its rail ----------------------------------------------------------
function makeDrive(stage, cars, car) {
  const t0 = { on: 0, going: false, s: 0, v: 0 };
  const place = () => {
    const s = t0.s;
    const k = Math.min(1, s / 10), e = k * k * (3 - 2 * k);
    const x = HIS_CAR.x - 2.6 * e, z = HIS_CAR.z - s;
    const dx = -2.6 * (6 * k * (1 - k)) / 10, dz = -1;
    car.pos.set(x, 0, z);
    car.yaw = Math.atan2(-dz, dx);
    cars.pose(car);
    const c = car.collider; c.cx = x; c.cz = z; c.angle = car.yaw; c.c = Math.cos(car.yaw); c.s = Math.sin(car.yaw);
    const g = car.group;
    g.updateMatrixWorld(true);
    const toW = (v) => v.clone().applyMatrix4(g.matrixWorld);
    const fwd = V(1, -0.1, 0).normalize().transformDirection(g.matrixWorld);
    car.spot.position.copy(toW(V(2.75, 1.0, 0)));
    car.spot.target.position.copy(toW(V(14, -0.4, 0)));
    car.spot.target.updateMatrixWorld();
    for (const cone of car.cones) {
      const z0 = cone.userData.side * 0.6;
      const apex = toW(V(2.34, 0.98, z0));
      cone.position.copy(apex);
      cone.quaternion.setFromUnitVectors(V(0, -1, 0), fwd);
      if (cone.material.uniforms.uApex) cone.material.uniforms.uApex.value.copy(apex);
      if (cone.material.uniforms.uAxis) cone.material.uniforms.uAxis.value.copy(fwd);
    }
    if (car.entry) { car.entry.position.copy(toW(V(2.2, 1.05, 0))); car.entry.direction.copy(fwd); }
  };
  return {
    start() { t0.on = 1; lamps(stage, car, 1); if (car.tail) car.tail.set(1); },
    go() { t0.going = true; },
    pos() { return car.pos.clone().setY(0.6); },
    step(dt) {
      if (!t0.going) return;
      t0.v = Math.min(15, t0.v + dt * (t0.v < 6 ? 3.6 : 2.4));
      t0.s += t0.v * dt;
      place();
      if (t0.s > 160) car.group.visible = false;
    },
  };
}

// the eye's lens (degrees), for the peek through the slats
function lens(G, fov) {
  if (Math.abs(G.camera.fov - fov) < 1e-3) return;
  G.camera.fov = fov;
  G.camera.updateProjectionMatrix();
}

// ---- the escape's rail --------------------------------------------------------------------------
function railS(i) {
  let s = 0;
  for (let k = 1; k <= i; k++) { const a = ESC_RAIL[k - 1], b = ESC_RAIL[k]; s += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
  return s;
}

// ---- seen: at the street window ---------------------------------------------------------------
// (office: lane B2's room 304, entered in the setup so the first frame after
// the chapter card is it; the room as the gunfight left it)
function atOfficeWindow(ctx, C, O) {
  const G = ctx.game;
  G.enterStage(O);
  officeStreet(O);
  officeAfterFight(O);
  curtainAside(O, 1);
  if (!O._r2cCurtainHook) O._r2cCurtainHook = G.on('scene:exit', () => curtainAside(O, 0));
  const aw = O.anchor('office.window.street'), sw = O.anchor('office.street.watcher');
  const yaw = Math.atan2(OROOM.x1 - sw.pos.x, aw.pos.z - sw.pos.z);
  C.stage = O;
  C.spawn({ x: sw.pos.x, z: sw.pos.z }, yaw, 'watcher_stand');
  C.act = 'stand';
  const umb = O._b4umb || (O._b4umb = makeUmbrella(O));
  umb.hold(C.fig);
  ctx.flags.umbO = umb;
  const eyeY = 1.64;
  if (O._r2cBlind) O._r2cBlind.dispose();
  ctx.flags.blind = O._r2cBlind = makeOfficeBlind(O, { gapY: 1.5, zAt: SLIT_Z + 0.1 });
  const at = { pos: V(OBLIND.x - 0.92, 0, SLIT_Z - 0.02), yaw: aw.yaw, eyeY };
  G.controller.setMode('seated', { anchor: at, eyeY, pitch: -0.12, forward: 0, lean: 0.02, yawRange: [-1.7, 1.7], pitchRange: [-0.95, 0.6], swivel: 9 });
  G.hands.equip('empty');
}

// the slats parted, him seen, his run; the slats let go (either blind)
// ([C6 3rd] the chapter begins ON the peek - chapter IV ends looking out of
// this window at the man under the lamp (lane C5), and V's first frame after
// its card is that frame: two fingers holding the slats apart, the slit, him
// under his lamp and his umbrella looking up. It opened on a near-black
// blind with no man in it until E parted the slats. `PEEK_AT` below is the
// frame, for IV's end to meet.)
function* seenAtWindow(ctx) {
  const G = ctx.game, C = ctx.flags.chase, H = G.hands;
  const blind = ctx.flags.blind;
  const umb = ctx.flags.umbO || ctx.flags.umb;
  // (under the chapter card, at once: the hand on the slats, the slit open,
  // the eye at it, the lens drawn in)
  SLAT.blind = blind; SLAT.cam = G.camera;
  H.play('partSlats');
  blind.part(1);
  const gap = blind.gapAt(V(0, 0, 0), -0.1);
  C.fig.object.updateMatrixWorld(true);
  const him = C.fig.bones.chest.getWorldPosition(V(0, 0, 0));
  const dir = gap.clone().sub(him).normalize();
  const O = !!ctx.flags.office, peek = O ? 38 : PEEK;
  const eye = gap.clone().addScaledVector(dir, O ? 0.32 : 0.4);
  const pose = { x: eye.x, y: eye.y, z: eye.z, yaw: Math.atan2(dir.x, dir.z), pitch: Math.asin(-dir.y) };
  G.controller.ease(pose, 0.001);
  ctx.flags.fov0 = G.camera.fov;
  lens(G, peek);
  PEEK_AT.pose = pose; PEEK_AT.fov = peek; PEEK_AT.office = O;
  yield null;
  G.sfx.play('w_slats', gap);
  yield wait(1.0);
  yield until(() => !(G.hud.cardT > 0.15));
  // (a moment on him under the lamp, looking up at this window; then he
  // knows he has been seen)
  yield wait(1.4);
  C.w.play('watcher_notice', { fade: 0.1, hold: true });
  yield wait(0.35);
  const hv = V(Math.sin(C.fig.yaw) * -0.4, -0.2, Math.cos(C.fig.yaw) * -0.4);
  umb.drop(hv, { wind: ctx.flags.office ? V(-0.25, 0, 0.9) : V(0.9, 0, -0.3) });
  G.sfx.play('w_umbrella', C.fig.pos.clone().setY(C.fig.pos.y + 1));
  G.music.cue('chase', { fade: 0.4 });
  // ([C6 3rd] he runs, and the clock is his: the line says so at once, and
  // the window does not wait - "He's getting away." if I stand at it, and
  // then he is gone; however long I take, he is that far on when I am out
  // on the iron (outOfOffice))
  ctx.flags.ranAt = G.time;
  G.hud.objective('After him. Down the fire escape.');
  ctx.onStep(() => windowClock(ctx));
  yield wait(0.55);
  if (ctx.flags.office) {
    const R = officeRun(C);
    ctx.onStep((dt) => R.step(dt));
  } else C.place(0.6);
  ctx.flags.ran = true;
  yield wait(ctx.flags.office ? 1.35 : 1.0);
  H.play('releaseSlats');
  for (let k = 0; k < 0.3; k += 1 / 60) { blind.part(Math.max(0, 1 - k / 0.2)); lens(G, peek + (ctx.flags.fov0 - peek) * (k / 0.3)); yield null; }
  blind.part(0);
  if (blind.restore) blind.restore();
  lens(G, ctx.flags.fov0);
  G.sfx.play('w_slats', gap);
  yield* ctx.prompt({ text: 'the fire escape' });
}

// [C6 3rd] the window after he runs: standing at it, the warning, then lost
// (back on the iron, him where the escape's retry has him)
export const PEEK_AT = { pose: null, fov: null, office: false };
const WINDOW = { warn: 6.5, lost: 9.5, pace: 3.8, nominal: 3.4 };
function windowClock(ctx) {
  const G = ctx.game, F = ctx.flags;
  if (F.leftWindow || G.failing || F.ranAt == null) return;
  const t = G.time - F.ranAt;
  if (t > WINDOW.warn && !F.windowWarned) { F.windowWarned = true; G.hud.warn('He’s getting away.'); }
  if (t > WINDOW.lost && !F.windowLost) {
    F.windowLost = true;
    (G._c6lost || (G._c6lost = [])).push({ stretch: 'seen', gap: null, unseen: null, me: null, act: 'window', why: 'stood at the window' });
    G.fail({ why: 'Lost him.', to: 'escape' });
  }
}

// out of the office: across the room to the fire-escape window, both palms
// on its sill, down under the raised sash; on the black of the rail and the
// wall, the backlot's same window, the eye coming up onto the iron
function* outOfOffice(ctx) {
  const G = ctx.game, H = G.hands;
  const track = wayOut(G.controller.eyePose());
  H.equip('run');
  RUNHANDS.cam = G.camera; RUNHANDS.set('pump'); RUNHANDS.w = 1; RUNHANDS.k = 0.05; RUNHANDS.lift = 0;
  const W = WAY_OUT;
  RUNHANDS.plantR.set(W.x - 0.24, W.sill + 0.012, W.wall + 0.035);
  RUNHANDS.plantL.set(W.x + 0.24, W.sill + 0.012, W.wall + 0.035);
  let cur = null, black = 0, t = 0, steps = 0, sill = false, swish = false;
  G.controller.setMode('cutscene', { ease: 0.05, track: (tt) => { cur = track(tt); return cur.pose; } });
  yield until(() => {
    const dt = 1 / 60;
    t += dt;
    if (steps < 3 && t > 0.22 + steps * 0.24) { steps++; G.sfx.step(null, true, true, true); }
    if (!sill && cur && cur.duck > 0.45) { sill = true; G.sfx.play('w_sill', V(W.x, W.sill, W.wall)); }
    if (!swish && cur && W.wall - cur.pose.z < 0.55) { swish = true; G.sfx.play('w_curtain', V(W.x + 0.35, 1.4, W.wall - 0.1)); }
    RUNHANDS.phase += dt * 9;
    RUNHANDS.k += ((cur && cur.duck > 0.05 ? 0 : 0.35) - RUNHANDS.k) * (1 - Math.exp(-dt * 8));
    if (cur && cur.duck > 0.2) RUNHANDS.set('plant');
    RUNHANDS.step(dt, 6);
    if (cur && (cur.under || cur.end)) { black = Math.min(1, black + dt / 0.1); G.hud.fade(black); }
    return black >= 1;
  });
  G.hud.fade(1);
  curtainAside(ctx.flags.office, 0);
  const pitch = G.controller.pitch;
  G.enterStage('backlot');
  const C = ctx.flags.chase;
  C.stage = G.stage;
  C.spawn({ x: WATCH_AT.x, z: WATCH_AT.z }, 0, 'watcher_run');
  // ([C6 3rd] where his clock has him: 4.5 m along for a man who went for
  // the fire escape at once; for every second more at the window, his
  // trot's worth further - he was put back by his lamp however long I took)
  const late = ctx.flags.ranAt != null ? Math.max(0, (G.time - ctx.flags.ranAt) - WINDOW.nominal) : 0;
  C.place(4.5 + late * WINDOW.pace);
  ctx.flags.lateAtWindow = +late.toFixed(2);
  umbrellaDown(ctx);
  const s = railS(1) * 0.5;
  const r0 = ESC_RAIL[0], r1 = ESC_RAIL[1];
  G.controller.setPose(r0.x + (r1.x - r0.x) * 0.5, r0.z + (r1.z - r0.z) * 0.5, -Math.PI / 2, pitch, L3Y);
  ctx.flags.through = { s, v: 1.45, pitch };
}

export { pathAt, project, GATE };
