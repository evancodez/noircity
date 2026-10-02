import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { ROOM, STREET_WIN, WATCH_AT, ESC, ESC_RAIL, STRETCH, FENCES, LANE, GATE, PASSAGE, BOARD, HIS_CAR, MY_CAR, L3Y } from '../stages/backlot/plan.js';
import { Chase, STRETCH_S, FENCE_S, pathAt } from './watcher/chase.js';
import { makeUmbrella } from './watcher/umbrella.js';
import { makeBlind } from './watcher/blind.js';
import { RUNHANDS } from '../player/clips/run.js';
import { SLAT, DOOR } from '../player/clips/watcher.js';
import { officeStreet, officeAfterFight, makeOfficeBlind, officeRun, wayOut, WAY_OUT, curtainAside } from './watcher/office.js';
import { ROOM as OROOM, STREET as STREET_O } from '../stages/office/plan.js';
import { BLIND as OBLIND } from '../stages/office/build/openings.js';

// Scene 6, The Watcher (lane B4): the chase on foot. Beats:
//   seen     at room 304's street window, E: two fingers part the blind.
//            Across the street under the lamp and his umbrella, a man
//            looking up at this window; held a second and a half, he sees
//            me see him: the umbrella tips, drops, rolls; he runs. E the
//            fire escape: the eye goes to the side window and out through it.
//            (Lane B2's office when it exists - office.window.street,
//            office.street.watcher, office.window.escape - else the
//            backlot's own stand-in of the room's corner.)
//   escape   down the fire escape (the escape mode's rail): two flights,
//            the landings ring, the ladder slides down under me; below,
//            he crosses the alley's mouth and runs up the alley
//   run      the chase (the run mode; the rules are watcher/chase.js): the
//            straight, the fences (SPACE vaults: taught once), the washing,
//            the dog and the crates (A / D round them, SPACE over), the dead
//            end with its loose board still swinging
//   car      through the board: he is in his sedan, its lamps come on, it
//            pulls away, red tail lamps down the wet street; mine at the
//            kerb: E drive, and on to the tail
// Losing him is not failing: "Lost him.", black, back at the start of the
// stretch.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// what the detective carries by now (a cold start gets it too)
// ([R3] the torn half by scene 3's name for it, matchbookHalf: played
// through, the coat held it twice under two names)
// [C1] wave C (WAVE_C §4): the matchbook and Ames's crossed card from II, the
// torn check from III, the revolver (the ledger and the body's half are gone
// with The Body)
const INV = ['matchbook', 'amesCard', 'check', 'revolver'];
const EYE = 1.63;
// the lens at the slit (degrees): the eye narrows on him as it leans in
const PEEK = 44;
// (the office: the slit's place along the blind, between its ladder tapes)
const SLIT_Z = 4.46;

// ---- the things every beat's setup does -------------------------------------------------------
function common(ctx) {
  const G = ctx.game;
  for (const k of INV) if (!G.save.inventory.includes(k)) G.save.inventory.push(k);
  const stage = G.stage;
  const chase = stage.part('chase');
  if (chase) chase.reset();
  const cars = stage.part('cars');
  if (cars && cars.his) resetCar(stage, cars.his);
  const C = new Chase(ctx);
  ctx.flags.chase = C;
  // his umbrella (one per stage, kept across retries)
  ctx.flags.umb = stage._b4umb || (stage._b4umb = makeUmbrella(stage));
  G.controller.frozen = false;
  G.player.weapons.equip(null);
  G.hands.equip('empty');
  RUNHANDS.cam = G.camera;
  return C;
}

// the watcher's lamp, the umbrella lying under it (he ran from there)
function umbrellaDown(ctx) {
  ctx.flags.umb.lie(WATCH_AT.x + 1.3, WATCH_AT.z - 0.9, 0.7);
}

// the office (lane B2) if it is there with the anchors this scene needs
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
  // (standing at the window: the eye held there, the look free; the room is
  // three floors up, over the building's own footprint - no walking in it)
  const at = { pos: V(STREET_WIN.x - 0.02, ROOM.y0, z - 0.34), yaw: Math.PI + 0.12, eyeY: ROOM.y0 + EYE };
  G.controller.setMode('seated', { anchor: at, eyeY: at.eyeY, pitch: -0.36, forward: 0, lean: 0.02, yawRange: [-1.6, 1.6], pitchRange: [-0.95, 0.6], swivel: 9 });
  return blind;
}

// the car on its kerb, its lamps dark
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
  ctx.flags.umb.hold(w.fig);
  return w;
}

export default defineScene({
  id: 'watcher', stage: 'backlot',
  beats: ['seen', 'escape', 'run', 'car'],
  save: ['escape', 'run', 'car'],
  setup: {
    seen(ctx) {
      const C = common(ctx);
      const O = office(ctx.game);
      if (O) { ctx.flags.office = O; atOfficeWindow(ctx, C, O); return; }
      watcherAtLamp(ctx, C);
      streetWindow(ctx);
    },
    escape(ctx) {
      const C = common(ctx);
      const G = ctx.game;
      // out on the top landing, the window behind me; below, he is crossing
      // the street to the alley's mouth
      C.spawn({ x: WATCH_AT.x, z: WATCH_AT.z }, 0, 'watcher_run');
      C.place(4.5);
      umbrellaDown(ctx);
      G.controller.setPose(ESC_RAIL[1].x, ESC_RAIL[1].z, Math.PI - 0.25, -0.5, L3Y);
      G.hands.equip('run');
    },
    run(ctx) {
      const C = common(ctx);
      const G = ctx.game;
      const S0 = STRETCH[0];
      C.spawn({ x: S0.at.x, z: S0.at.z - 15 }, 0, 'watcher_run');
      C.restage(0);
      umbrellaDown(ctx);
      G.stage.part('chase').ladder.set(1);
      G.controller.setPose(S0.at.x, S0.at.z, S0.yaw, 0.0);
      G.hands.equip('run');
      startRun(ctx);
    },
    car(ctx) {
      const C = common(ctx);
      const G = ctx.game;
      C.spawn({ x: HIS_CAR.x - 1.2, z: HIS_CAR.z + 0.4 }, Math.PI, 'watcher_run');
      C.act = 'gone';
      C.fig.object.visible = false;
      umbrellaDown(ctx);
      G.stage.part('chase').board.push(1.2);
      G.controller.setPose(0.4, BOARD.z, Math.PI / 2 + 0.25, -0.05);
      G.hands.equip('empty');
    },
  },

  *script(ctx) {
    const G = ctx.game;
    const C = ctx.flags.chase;
    const H = G.hands;
    ctx.onStep((dt) => { C.step(dt); if (ctx.flags.umb) ctx.flags.umb.update(dt); if (ctx.flags.umbO) ctx.flags.umbO.update(dt); if (ctx.flags.car) ctx.flags.car.step(dt); });

    // ---- seen: the slats, the man under the lamp -------------------------------------------------
    // (in lane B2's office - the room as the gunfight left it - or, with no
    // office, the backlot's stand-in corner of it: the same beat on either
    // blind)
    if (ctx.at('seen')) {
      yield beat('seen');
      yield* seenAtWindow(ctx);
      if (ctx.flags.office) yield* outOfOffice(ctx);
      else {
        // across the room to the side window and out through it
        // (the head turns to the side window first - a third of a second - and
        // the body follows it across the dark room, the eye already on the
        // iron and the rain outside)
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

    // ---- escape: down the iron ------------------------------------------------------------------
    if (ctx.at('escape')) {
      yield beat('escape');
      G.music.cue('chase', { fade: 0.4 });
      H.equip('run');
      const chase = G.stage.part('chase');
      // (from the office: the eye comes in under the sash, mid-duck, on the
      // black of the cut, and the way goes on by itself until I am out on
      // the iron; entered here: on the landing)
      const T = ctx.flags.through;
      const s0 = T ? T.s : ctx.from === 'escape' ? railS(1) : 0;
      let ended = false;
      G.controller.setMode('escape', {
        rail: ESC_RAIL, s: s0, endYaw: 0, game: G, ladder: ESC.ladder,
        ...(T ? { v: T.v, autoTo: railS(1) + 0.12, pitchBase: T.pitch } : {}),
        onEvent: (name, d) => {
          if (name === 'foot') G.sfx.play(d.kind === 'stair' ? 'w_ironStep' : 'w_ironWalk', G.eye.clone().setY(d.y));
          if (name === 'landing') G.sfx.play('w_landing', G.eye.clone().setY(d.y));
          if (name === 'ladder') G.sfx.play('w_ladder', G.eye.clone());
          if (name === 'ladderStop') { G.sfx.play('w_ladderStop', G.eye.clone().setY(0.5)); G.controller.shake(0.35); }
          if (name === 'end') ended = true;
        },
      });
      // (and the black of the cut lifts as I come up under the sash; out on
      // the iron the look is drawn down to him in the street below, crossing
      // for the alley's mouth - where to go - until the mouse or W takes it)
      if (T) {
        let k = 1, draw = 0;
        // (the head is past the wall's face - out from under the sash - here)
        const sOut = railS(1) - 0.45;
        ctx.onStep((dt) => {
          if (k > 0) { k = Math.max(0, k - dt / 0.3); G.hud.fade(k * k * (3 - 2 * k)); }
          const e = G.controller.esc;
          if (!e || draw === -2) return;
          // (a turn of the mouse or a step down the iron lets it go)
          if (e.idle < draw - 1e-6 || G.held('KeyW') || G.held('ArrowUp')) { draw = -2; return; }
          draw += dt;
          e.idle = draw;
          if (draw > 1.8) { draw = -2; return; }
          // (from the cut: the eyes go down to the street at once - under the
          // sash the iron and the street are what the opening shows, not the
          // wall across the light well - and round to him as the head comes
          // out past the wall's face)
          const him = C.fig.bones.chest.getWorldPosition(V(0, 0, 0)), eye = G.eye;
          const yawTo = Math.atan2(-(him.x - eye.x), -(him.z - eye.z));
          const pitchTo = Math.atan2(him.y - eye.y, Math.hypot(him.x - eye.x, him.z - eye.z));
          const out = Math.min(1, Math.max(0, (e.s - sOut) / 0.3));
          const a = 1 - Math.exp(-dt * 4.2);
          e.look.yaw += Math.atan2(Math.sin(yawTo - e.heading - e.look.yaw), Math.cos(yawTo - e.heading - e.look.yaw)) * a * (0.25 + 0.75 * out * out * (3 - 2 * out));
          e.look.pitch += (pitchTo - e.pitchBase - e.look.pitch) * a;
        });
      }
      // his pace follows mine down the iron: he is 15 m up the alley when I land
      const E = () => G.controller.esc;
      const goal = STRETCH_S[0] + 15;
      C.pace = (s) => {
        const e = E();
        if (!e) return 6;
        const q = e.s / e.len;
        const want = C.s0 + (goal - C.s0) * Math.min(1, q * 1.05);
        return Math.max(2.5, Math.min(8.5, (want - s) * 2.2));
      };
      C.s0 = C.s;
      let still = 0;
      yield until(() => {
        const e = E();
        if (e) {
          // the ladder rides down with me
          const i = e.rail.length - 2;
          const L0 = e.rail[i].s;
          chase.ladder.set(e.s > L0 ? Math.min(1, (e.s - L0) / (e.len - L0)) : 0);
          // the prompt to go on down, once, if I stand still on the landing
          still = e.s < railS(3) && e.v < 0.1 ? still + 1 / 60 : 0;
          if (still > 2.5) G.hud.prompt('W  down', null, 'scene'); else G.hud.clearPrompt('scene');
        }
        return ended;
      });
      G.hud.clearPrompt('scene');
      C.pace = null;
      startRun(ctx);
    }

    // ---- run: the chase ---------------------------------------------------------------------------
    if (ctx.at('run')) {
      yield beat('run');
      G.music.cue('chase', { fade: 0.4 });
      C.active = true;
      // (from a standing start - a cold start at the ladder's foot - the
      // same grace as a retry's; running on from the ladder it is never felt)
      C.grace = 2.0;
      C.onLost = (i) => restageStretch(ctx, i);
      const chase = G.stage.part('chase');
      let taught = false, dog = false, through = false, breath = 0.4;
      yield until(() => {
        const R = G.controller.run;
        const p = G.controller.pos;
        // my breath, hard, with the stride
        if (R && R.v > 4) { breath -= 1 / 60; if (breath <= 0) { breath = 0.64 + Math.random() * 0.12; G.sfx.play('w_breath', null, { k: Math.min(1.2, R.v / 7) }); } }
        // the washing: I go through it too
        if (R) chase.sheets.touch(p.x, p.z, G.controller.vel.x, G.controller.vel.z, 1);
        // SPACE, taught once at the first fence
        const f0 = FENCES[0];
        const dF = f0.x - p.x;
        if (!taught && dF > 0 && dF < 8 && Math.abs(p.z - (LANE.z0 + LANE.z1) / 2) < 3.5) G.hud.prompt('SPACE  vault', null, 'scene');
        else if (!taught && (dF <= 0 || (R && (R.act === 'vault' || R.act === 'scramble')))) { taught = true; G.hud.clearPrompt('scene'); }
        // the dog at the gate
        if (!dog && p.z < PASSAGE.z1 + 0.5 && p.z > PASSAGE.z0 - 0.5 && p.x < GATE.x + 4.6 && p.x > GATE.x - 1) {
          dog = true;
          chase.gate.bang(1.2);
          G.sfx.play('w_bark', V(GATE.x, 0.8, GATE.z - 0.6));
          G.sfx.play('w_gate', V(GATE.x, 1.0, GATE.z));
          if (R) R.flinch(-0.16, 0.06);
        }
        // through the loose board: the street
        if (p.x < BOARD.x - 0.2 && Math.abs(p.z - BOARD.z) < 1.2) { through = true; chase.board.push(-2.2); }
        return through;
      });
      G.hud.clearPrompt('scene');
      C.active = false;
    }

    // ---- car: the sedan pulls away, mine at the kerb ------------------------------------------------
    if (ctx.at('car')) {
      yield beat('car');
      // [R3] (continued from the car's save: the chase's music, as a play
      // through has it here until the tail's takes over - it was silence)
      if (ctx.from === 'car') G.music.cue('chase', { fade: 0.4 });
      const stage = G.stage;
      const cars = stage.part('cars');
      // (he is in it: the chase put him there; a jump here finds him in it)
      yield until(() => C.act === 'gone');
      const car = makeDrive(stage, cars, cars.his);
      ctx.flags.car = car;
      // (the eye is drawn to it, softly, from the moment its lamps come on
      // until it is well away: the mouse still turns me, the draw only
      // leans the look toward the red of its tail lamps)
      // (then, more gently, back to my own car at the kerb: where to go)
      // (my car's handle, on the kerb side: the stage's cars put it there)
      const door = cars.mine && cars.mine.handleAt ? cars.mine.handleAt() : V(MY_CAR.x + 0.76, 0.99, MY_CAR.z + 0.2);
      const doorOut = cars.mine && cars.mine.handleOut ? cars.mine.handleOut() : V(1, 0, 0);
      let driven = false;
      const pull = { t: -1, dur: 5.4, rate: 3.2, pitch: -0.04, at: () => car.pos(),
        next: { dur: 1.8, rate: 1.8, pitch: -0.1, at: () => door } };
      const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      // (the player's own look always wins: a turn of the mouse - the look
      // moved since the last step by more than a hair - lets the draw go for
      // good, so the eye is never fought for)
      let lastYaw = null, lastPitch = null;
      ctx.onStep((dt) => {
        if (pull.t < 0 || driven) return;
        const ctl = G.controller, e = G.eye;
        if (lastYaw != null && (Math.abs(wrapA(ctl.yaw - lastYaw)) > 0.004 || Math.abs(ctl.pitch - lastPitch) > 0.004)) { pull.t = -1; return; }
        lastYaw = null;
        if (pull.t >= pull.dur) {
          // (not when I am already at it, or already looking its way)
          const N = pull.next;
          pull.next = null;
          if (!N || Math.hypot(door.x - e.x, door.z - e.z) < 3.5) { pull.t = -1; return; }
          Object.assign(pull, N, { t: 0 });
        }
        if (ctl.mode !== 'run' && ctl.mode !== 'walk') return;
        pull.t += dt;
        const P = pull.at();
        const want = Math.atan2(-(P.x - e.x), -(P.z - e.z));
        const w = Math.min(1, pull.t / 0.3) * Math.min(1, (pull.dur - pull.t) / 1.0);
        const k = (1 - Math.exp(-dt * pull.rate)) * w;
        ctl.yaw += wrapA(want - ctl.yaw) * k;
        ctl.pitch += (pull.pitch - ctl.pitch) * k;
        lastYaw = ctl.yaw; lastPitch = ctl.pitch;
      });
      yield wait(0.5);
      car.start();
      pull.t = 0;
      G.sfx.play('w_engine', car.pos());
      yield wait(0.9);
      car.go();
      // E drive: my hand on my car's door
      // (the kerb side: the door by the pavement I come out onto)
      G.interact.add({ id: 'drive', at: door, range: 3.0, cone: 1.0, prompt: 'drive', onUse: () => { driven = true; } });
      if (G.controller.run) G.controller.setMode('walk');
      G.hands.equip('empty');
      yield until(() => driven);
      G.interact.remove('drive');
      // my hand on the handle (object first: the handle, then the hand on
      // it), the door's click, and away after him
      DOOR.at = door.clone();
      DOOR.out = doorOut.clone();
      SLAT.cam = G.camera;
      G.controller.frozen = true;
      // (a step to the door, facing it, while the hand goes out to it: the
      // eye a forearm and a half off the side, the handle a little right of
      // and below the middle of the frame, the window's line over it)
      const ex = door.x + doorOut.x * 0.7 - doorOut.z * 0.1, ez = door.z + doorOut.z * 0.7 + doorOut.x * 0.1;
      const gy = G.stage.surfaceY(ex, ez);
      const dy = gy + 1.63 - door.y, dd = Math.hypot(door.x - ex, door.z - ez);
      const P1 = { x: ex, y: gy + 1.63, z: ez, yaw: Math.atan2(-(door.x - ex), -(door.z - ez)) + 0.1, pitch: -Math.atan2(dy, dd) + 0.2 };
      G.controller.ease(P1, 0.4);
      H.play('carDoor', { onMark: { grip: () => G.sfx.play('w_carDoorOpen', door) } });
      // (the click, and on it the black: the chapter's fade, the eye going
      // on down toward the car's side as a man ducks in to its seat - the
      // tail opens in that seat)
      yield wait(0.55);
      const P2 = { ...P1, x: P1.x - doorOut.x * 0.25, z: P1.z - doorOut.z * 0.25, y: P1.y - 0.45, pitch: P1.pitch + 0.18 };
      G.controller.ease(P2, 0.75);
      ctx.next();
    }
  },
});

// the eye's lens (degrees), for the peek through the slats
function lens(G, fov) {
  if (Math.abs(G.camera.fov - fov) < 1e-3) return;
  G.camera.fov = fov;
  G.camera.updateProjectionMatrix();
}

// ---- the escape's rail and the run ------------------------------------------------------------
function railS(i) {
  let s = 0;
  for (let k = 1; k <= i; k++) { const a = ESC_RAIL[k - 1], b = ESC_RAIL[k]; s += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
  return s;
}

export function startRun(ctx) {
  const G = ctx.game;
  const stage = G.stage;
  const build = stage.part('build');
  const chase = stage.part('chase');
  G.hands.equip('run');
  G.controller.setMode('run', {
    game: G, speed: 7.5, side: 3.2,
    fences: build.fences,
    obstacles: (x, z, r) => chase.crates.hits(x, z, r),
    onEvent: (name, d) => {
      const at = G.eye.clone();
      if (name === 'vault') G.sfx.play('w_vault', at);
      else if (name === 'scramble') G.sfx.play('w_fenceHit', at);
      else if (name === 'land') G.sfx.play('w_land', at.setY(0.1));
      else if (name === 'stumble') {
        G.sfx.play('w_stumble', at.clone().setY(0.4));
        // (the crate I ran into goes skidding on ahead of me, off my line)
        const p = G.controller.pos, v = G.controller.vel;
        const L = Math.hypot(v.x, v.z) || 1;
        for (const it of chase.crates.hits(p.x, p.z, 0.45)) chase.crates.kick(it, v.x / L * 0.7, v.z / L * 0.7 + (it.g.position.z > p.z ? 0.25 : -0.25));
      }
      else if (name === 'hop') G.sfx.play('w_hop', at);
    },
    ease: 0.25,
  });
}

// "Lost him.": back at the start of stretch i (behind the black)
export function restageStretch(ctx, i) {
  const G = ctx.game;
  const C = ctx.flags.chase;
  const chase = G.stage.part('chase');
  // (what he knocked down after this stretch began is put back)
  if (i <= 3) chase.crates.reset();
  if (i <= 4) chase.board.reset();
  // (a retry past the board: he has just gone through it, it swings)
  if (i >= 4) chase.board.push(2.2);
  chase.sheets.reset();
  chase.gate.reset();
  C.restage(i);
  const S = STRETCH[i];
  G.controller.setPose(S.at.x, S.at.z, S.yaw, 0);
  startRun(ctx);
  if (G.controller.run) G.controller.run.speedCap = null;
}

// ---- his car pulling away on its rail ----------------------------------------------------------
function makeDrive(stage, cars, car) {
  const t0 = { t: 0, on: 0, going: false, s: 0, v: 0 };
  const G = stage.game;
  const place = () => {
    // out from the kerb into the road, then north down the street
    const s = t0.s;
    const k = Math.min(1, s / 10), e = k * k * (3 - 2 * k);
    const x = HIS_CAR.x - 2.6 * e, z = HIS_CAR.z - s;
    const dx = -2.6 * (6 * k * (1 - k)) / 10, dz = -1;
    car.pos.set(x, 0, z);
    car.yaw = Math.atan2(-dz, dx);
    cars.pose(car);
    const c = car.collider; c.cx = x; c.cz = z; c.angle = car.yaw; c.c = Math.cos(car.yaw); c.s = Math.sin(car.yaw);
    // the lamps ride with it
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
      t0.t += dt;
      // pulling away: 3.2 m/s2 to 15 m/s
      t0.v = Math.min(15, t0.v + dt * (t0.v < 6 ? 3.6 : 2.4));
      t0.s += t0.v * dt;
      place();
      if (t0.s > 160) car.group.visible = false;
    },
  };
}

// ---- seen: at the street window ---------------------------------------------------------------
// (office: lane B2's room 304, entered in the setup so the first frame after
// the chapter card is it; the room as the gunfight left it)
function atOfficeWindow(ctx, C, O) {
  const G = ctx.game;
  G.enterStage(O);
  officeStreet(O);
  officeAfterFight(O);
  // (the escape window's curtain aside while the scene is in the office;
  // hung again when it leaves - through the window, or any other way)
  curtainAside(O, 1);
  if (!O._r2cCurtainHook) {
    O._r2cCurtainHook = G.on('scene:exit', () => curtainAside(O, 0));
  }
  const aw = O.anchor('office.window.street'), sw = O.anchor('office.street.watcher');
  // him under the lamp across the street, the umbrella up, looking up at
  // this window
  const yaw = Math.atan2(OROOM.x1 - sw.pos.x, aw.pos.z - sw.pos.z);
  C.spawn({ x: sw.pos.x, z: sw.pos.z }, yaw, 'watcher_stand');
  C.act = 'stand';
  const umb = O._b4umb || (O._b4umb = makeUmbrella(O));
  umb.hold(C.fig);
  ctx.flags.umbO = umb;
  // the slit: a little under my eye, between two of the blind's ladder
  // tapes (they hang at its middle and 0.62 m either side), the fingers a
  // hand's breadth right of it; the eye leans to it on the line to him
  const eyeY = 1.64;
  const zSlit = SLIT_Z;
  // (one at a time: a scene left with the slats parted gives the room's
  // own back when it is entered again)
  if (O._r2cBlind) O._r2cBlind.dispose();
  ctx.flags.blind = O._r2cBlind = makeOfficeBlind(O, { gapY: 1.5, zAt: zSlit + 0.1 });
  // standing a step back from the window, square to the slit, the look free
  const at = { pos: V(OBLIND.x - 0.92, 0, zSlit - 0.02), yaw: aw.yaw, eyeY };
  G.controller.setMode('seated', { anchor: at, eyeY, pitch: -0.12, forward: 0, lean: 0.02, yawRange: [-1.7, 1.7], pitchRange: [-0.95, 0.6], swivel: 9 });
  void STREET_O;
  G.hands.equip('empty');
}

// the slats parted, him seen, his run; the slats let go (either blind)
function* seenAtWindow(ctx) {
  const G = ctx.game, C = ctx.flags.chase, H = G.hands;
  const blind = ctx.flags.blind;
  const umb = ctx.flags.umbO || ctx.flags.umb;
  // (the chapter card first: the room comes up out of the black, the
  // slivers of the lamp through the slats; then the prompt, once the card
  // has gone - not printed over it)
  yield wait(1.0);
  yield until(() => !(G.hud.cardT > 0.15));
  yield* ctx.prompt({ text: 'look out', at: () => blind.gapAt(V(0, 0, 0)) });
  // two fingers part the slats: the hand comes up (0.3 s), the slat goes
  // down under them (0.3 .. 0.6 s) and the eye leans to the slit, on the
  // line from him through it
  SLAT.blind = blind; SLAT.cam = G.camera;
  H.play('partSlats');
  blind.part(1);
  const gap = blind.gapAt(V(0, 0, 0), -0.1);
  blind.part(0);
  const him = C.fig.bones.chest.getWorldPosition(V(0, 0, 0));
  const dir = gap.clone().sub(him).normalize();
  // (the office's slit is further from him: the eye nearer it, the lens
  // narrower, so he is as big in it as the stand-in's man)
  const O = !!ctx.flags.office, peek = O ? 38 : PEEK;
  const eye = gap.clone().addScaledVector(dir, O ? 0.32 : 0.4);
  G.controller.ease({ x: eye.x, y: eye.y, z: eye.z, yaw: Math.atan2(dir.x, dir.z), pitch: Math.asin(-dir.y) }, 0.55);
  // (and the eye narrows on him: the lens closes in as it leans)
  const fov0 = ctx.flags.fov0 = G.camera.fov;
  let t = 0;
  yield until(() => {
    t += 1 / 60;
    if (t > 0.26) blind.part(Math.min(1, (t - 0.26) / 0.3));
    if (Math.abs(t - 0.3) < 0.01) G.sfx.play('w_slats', gap);
    lens(G, fov0 + (peek - fov0) * Math.min(1, t / 0.6) ** 2 * (3 - 2 * Math.min(1, t / 0.6)));
    return t >= 0.6;
  });
  // he looks up at the window; held a second and a half
  yield wait(1.5);
  // he sees me see him: the start, the umbrella goes
  C.w.play('watcher_notice', { fade: 0.1, hold: true });
  yield wait(0.35);
  const hv = V(Math.sin(C.fig.yaw) * -0.4, -0.2, Math.cos(C.fig.yaw) * -0.4);
  // (the wind takes it along the pavement: the backlot's east, the
  // office's north)
  umb.drop(hv, { wind: ctx.flags.office ? V(-0.25, 0, 0.9) : V(0.9, 0, -0.3) });
  G.sfx.play('w_umbrella', C.fig.pos.clone().setY(C.fig.pos.y + 1));
  G.music.cue('chase', { fade: 0.4 });
  yield wait(0.55);
  // he turns and runs for the alley's mouth (under this window: out of
  // the slit in a second); the fingers let the slat go, it springs shut
  if (ctx.flags.office) {
    const R = officeRun(C);
    ctx.onStep((dt) => R.step(dt));
  } else C.place(0.6);
  ctx.flags.ran = true;
  // (in the office he has further to go out of the slit: held till he has)
  yield wait(ctx.flags.office ? 1.35 : 1.0);
  H.play('releaseSlats');
  for (let t = 0; t < 0.3; t += 1 / 60) { blind.part(Math.max(0, 1 - t / 0.2)); lens(G, peek + (ctx.flags.fov0 - peek) * (t / 0.3)); yield null; }
  blind.part(0);
  if (blind.restore) blind.restore();
  lens(G, ctx.flags.fov0);
  G.sfx.play('w_slats', gap);
  yield* ctx.prompt({ text: 'the fire escape' });
}

// out of the office: across the room to the fire-escape window, both palms
// on its sill, down under the raised sash; the rail and the wall fill the
// frame - black - and on that black the backlot's same window, the eye still
// under its sash, coming up onto the iron (the escape beat lifts the black)
function* outOfOffice(ctx) {
  const G = ctx.game, H = G.hands;
  const track = wayOut(G.controller.eyePose());
  H.equip('run');
  RUNHANDS.cam = G.camera; RUNHANDS.set('pump'); RUNHANDS.w = 1; RUNHANDS.k = 0.05; RUNHANDS.lift = 0;
  const W = WAY_OUT;
  // (facing the window, +z: my right is -x)
  RUNHANDS.plantR.set(W.x - 0.24, W.sill + 0.012, W.wall + 0.035);
  RUNHANDS.plantL.set(W.x + 0.24, W.sill + 0.012, W.wall + 0.035);
  let cur = null, black = 0, t = 0, steps = 0, sill = false;
  // (the curtain, pushed aside to the window's far side since the setup:
  // its cloth brushed as I go past it)
  let swish = false;
  G.controller.setMode('cutscene', { ease: 0.05, track: (tt) => { cur = track(tt); return cur.pose; } });
  yield until(() => {
    const dt = 1 / 60;
    t += dt;
    // (my feet on the boards across the room, the palms slapped on the sill)
    if (steps < 3 && t > 0.22 + steps * 0.24) { steps++; G.sfx.step(null, true, true, true); }
    if (!sill && cur && cur.duck > 0.45) { sill = true; G.sfx.play('w_sill', V(W.x, W.sill, W.wall)); }
    if (!swish && cur && W.wall - cur.pose.z < 0.55) { swish = true; G.sfx.play('w_curtain', V(W.x + 0.35, 1.4, W.wall - 0.1)); }
    // (a quick stride across the room, the hands low; then down to the sill)
    RUNHANDS.phase += dt * 9;
    RUNHANDS.k += ((cur && cur.duck > 0.05 ? 0 : 0.35) - RUNHANDS.k) * (1 - Math.exp(-dt * 8));
    if (cur && cur.duck > 0.2) RUNHANDS.set('plant');
    RUNHANDS.step(dt, 6);
    if (cur && (cur.under || cur.end)) { black = Math.min(1, black + dt / 0.1); G.hud.fade(black); }
    return black >= 1;
  });
  G.hud.fade(1);
  curtainAside(ctx.flags.office, 0);
  // the backlot: the same window of the same building, the eye under its
  // sash as it was under the office's; him running for the side alley
  const pitch = G.controller.pitch;
  G.enterStage('backlot');
  const C = ctx.flags.chase;
  C.stage = G.stage;
  C.spawn({ x: WATCH_AT.x, z: WATCH_AT.z }, 0, 'watcher_run');
  C.place(4.5);
  umbrellaDown(ctx);
  const s = railS(1) * 0.5;
  const r0 = ESC_RAIL[0], r1 = ESC_RAIL[1];
  G.controller.setPose(r0.x + (r1.x - r0.x) * 0.5, r0.z + (r1.z - r0.z) * 0.5, -Math.PI / 2, pitch, L3Y);
  ctx.flags.through = { s, v: 1.45, pitch };
}
