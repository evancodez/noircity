import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { ROOM, STREET_WIN, WATCH_AT, ESC, ESC_RAIL, STRETCH, FENCES, LANE, GATE, PASSAGE, BOARD, HIS_CAR, MY_CAR, L3Y } from '../stages/backlot/plan.js';
import { Chase, STRETCH_S, FENCE_S, pathAt } from './watcher/chase.js';
import { makeUmbrella } from './watcher/umbrella.js';
import { makeBlind } from './watcher/blind.js';
import { RUNHANDS } from '../player/clips/run.js';

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
const INV = ['matchbook', 'tornHalf', 'note', 'ledger', 'revolver'];
const EYE = 1.63;

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
      if (O) { ctx.flags.office = O; return; }
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
    ctx.onStep((dt) => { C.step(dt); if (ctx.flags.umb) ctx.flags.umb.update(dt); if (ctx.flags.car) ctx.flags.car.step(dt); });

    // ---- seen: the slats, the man under the lamp -------------------------------------------------
    if (ctx.at('seen') && !ctx.flags.office) {
      yield beat('seen');
      const blind = ctx.flags.blind;
      yield* ctx.prompt({ text: 'look out', at: () => blind.gapAt(V(0, 0, 0)) });
      // (the fingers part the slats: the gap opens in 0.35 s; the eye leans
      // to it)
      G.sfx.play('w_slats');
      let t = 0;
      const P0 = G.controller.eyePose();
      const gap = blind.gapAt(V(0, 0, 0));
      const tgt = C.fig.bones.head.getWorldPosition(V(0, 0, 0));
      yield until(() => {
        t += 1 / 60;
        blind.part(Math.min(1, t / 0.35) ** 0.7);
        return t >= 0.35;
      });
      // he looks up at the window; held a second and a half
      yield wait(1.5);
      // he sees me see him: the start, the umbrella goes
      C.w.play('watcher_notice', { fade: 0.1, hold: true });
      yield wait(0.35);
      const hv = V(Math.sin(C.fig.yaw) * -0.4, -0.2, Math.cos(C.fig.yaw) * -0.4);
      ctx.flags.umb.drop(hv, { wind: V(0.9, 0, -0.3) });
      G.sfx.play('w_umbrella', C.fig.pos.clone().setY(1));
      G.music.cue('chase', { fade: 0.4 });
      yield wait(0.55);
      // he turns and runs for the alley's mouth
      C.place(0.6);
      yield wait(0.4);
      yield* ctx.prompt({ text: 'the fire escape' });
      // the blind falls shut behind my hand; across the room to the side
      // window and out through it
      blind.part(0);
      G.controller.frozen = false;
      const e = ESC_RAIL[0];
      G.controller.ease({ x: e.x, y: e.y + EYE, z: e.z, yaw: -Math.PI / 2, pitch: -0.05 }, 1.0);
      yield wait(1.0);
    } else if (ctx.at('seen') && ctx.flags.office) {
      yield beat('seen');
      yield* seenInOffice(ctx);
    }

    // ---- escape: down the iron ------------------------------------------------------------------
    if (ctx.at('escape')) {
      yield beat('escape');
      G.music.cue('chase', { fade: 0.4 });
      H.equip('run');
      const chase = G.stage.part('chase');
      const from = ctx.from === 'escape' ? 1 : 0;
      let ended = false;
      G.controller.setMode('escape', {
        rail: ESC_RAIL, s: from ? railS(from) : 0, endYaw: 0, game: G,
        onEvent: (name, d) => {
          if (name === 'foot') G.sfx.play(d.kind === 'stair' ? 'w_ironStep' : 'w_ironWalk', G.eye.clone().setY(d.y));
          if (name === 'landing') G.sfx.play('w_landing', G.eye.clone().setY(d.y));
          if (name === 'ladder') G.sfx.play('w_ladder', G.eye.clone());
          if (name === 'ladderStop') { G.sfx.play('w_ladderStop', G.eye.clone().setY(0.5)); G.controller.shake(0.35); }
          if (name === 'end') ended = true;
        },
      });
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
      yield until(() => {
        const e = E();
        if (e) {
          // the ladder rides down with me
          const i = e.rail.length - 2;
          const L0 = e.rail[i].s;
          chase.ladder.set(e.s > L0 ? Math.min(1, (e.s - L0) / (e.len - L0)) : 0);
          // the prompt to go on down, once, if I stand still on the landing
          if (e.s < 0.8 && ctx.sceneTime > 2.5 && e.v < 0.1) G.hud.prompt('W  down', null, 'scene'); else G.hud.clearPrompt('scene');
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
      C.onLost = (i) => restageStretch(ctx, i);
      const chase = G.stage.part('chase');
      let taught = false, dog = false, through = false;
      yield until(() => {
        const R = G.controller.run;
        const p = G.controller.pos;
        // the washing: I go through it too
        if (R) chase.sheets.touch(p.x, p.z, G.controller.vel.x, G.controller.vel.z, 1);
        // SPACE, taught once at the first fence
        const f0 = FENCES[0];
        const dF = f0.x - p.x;
        if (!taught && dF > 0 && dF < 8 && Math.abs(p.z - (LANE.z0 + LANE.z1) / 2) < 3.5) G.hud.prompt('SPACE  vault', null, 'scene');
        else if (!taught && (dF <= 0 || (R && (R.act === 'vault' || R.act === 'scramble')))) { taught = true; G.hud.clearPrompt('scene'); }
        // the dog at the gate
        if (!dog && p.z < PASSAGE.z1 + 0.5 && p.z > PASSAGE.z0 - 0.5 && p.x < GATE.x + 2.4 && p.x > GATE.x - 1) {
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
      const stage = G.stage;
      const cars = stage.part('cars');
      // (he is in it: the chase put him there; a jump here finds him in it)
      yield until(() => C.act === 'gone');
      const car = makeDrive(stage, cars, cars.his);
      ctx.flags.car = car;
      yield wait(0.5);
      car.start();
      G.sfx.play('w_engine', car.pos());
      yield wait(0.9);
      car.go();
      // E drive: my hand on my car's door
      // (the kerb side: the door by the pavement I come out onto)
      const door = V(MY_CAR.x + 1.0, 1.1, MY_CAR.z + 0.35);
      let driven = false;
      G.interact.add({ id: 'drive', at: door, range: 3.0, cone: 1.0, prompt: 'drive', onUse: () => { driven = true; } });
      if (G.controller.run) G.controller.setMode('walk');
      G.hands.equip('empty');
      yield until(() => driven);
      G.interact.remove('drive');
      G.sfx.play('w_carDoorOpen', door);
      yield wait(0.5);
      ctx.next();
    }
  },
});

// ---- the escape's rail and the run ------------------------------------------------------------
function railS(i) {
  let s = 0;
  for (let k = 1; k <= i; k++) { const a = ESC_RAIL[k - 1], b = ESC_RAIL[k]; s += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
  return s;
}

function startRun(ctx) {
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
      else if (name === 'stumble') G.sfx.play('w_stumble', at.setY(0.4));
      else if (name === 'hop') G.sfx.play('w_hop', at);
    },
    ease: 0.25,
  });
}

// "Lost him.": back at the start of stretch i (behind the black)
function restageStretch(ctx, i) {
  const G = ctx.game;
  const C = ctx.flags.chase;
  const chase = G.stage.part('chase');
  // (what he knocked down after this stretch began is put back)
  if (i <= 3) chase.crates.reset();
  if (i <= 4) chase.board.reset();
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

// ---- seen in lane B2's office (when it exists) ---------------------------------------------------
function* seenInOffice(ctx) {
  const G = ctx.game;
  const O = ctx.flags.office;
  G.enterStage(O);
  const aw = O.anchor('office.window.street'), sw = O.anchor('office.street.watcher'), ew = O.anchor('office.window.escape');
  const eyeY = (a) => (a.eyeY != null ? a.eyeY : a.pos.y + 1.65);
  G.controller.setPose(aw.pos.x, aw.pos.z, aw.yaw, -0.3, eyeY(aw) - EYE);
  G.controller.frozen = true;
  const blind = makeBlind(O, {});
  const fx = -Math.sin(aw.yaw), fz = -Math.cos(aw.yaw);
  blind.place(V(aw.pos.x + fx * 0.3, eyeY(aw) - 0.05, aw.pos.z + fz * 0.3), aw.yaw);
  const C = ctx.flags.chase;
  const w = O.cast.spawn(O.cast.has('watcher') ? 'watcher' : 'couple_him', { at: 'office.street.watcher', name: 'watcher' });
  if (w.kind === 'watcher') w.setState('watcher_stand', 0);
  const umb = makeUmbrella(O);
  umb.hold(w.fig);
  ctx.onStep((dt) => umb.update(dt));
  yield* ctx.prompt({ text: 'look out' });
  G.sfx.play('w_slats');
  for (let t = 0; t < 0.35; t += 1 / 60) { blind.part(Math.min(1, t / 0.35)); yield null; }
  yield wait(1.5);
  if (w.kind === 'watcher') w.play('watcher_notice', { fade: 0.1, hold: true });
  yield wait(0.35);
  umb.drop(V(0, -0.2, 0));
  G.music.cue('chase', { fade: 0.4 });
  yield wait(0.55);
  // he runs out of the frame (away from the window)
  const fig = w.fig;
  if (w.kind === 'watcher') w.setState('watcher_run', 0.15);
  const away = Math.atan2(fig.pos.x - aw.pos.x, fig.pos.z - aw.pos.z) + 1.2;
  fig.yaw = away;
  let t = 0;
  yield until(() => { t += 1 / 60; fig.pos.x += Math.sin(fig.yaw) * 6.5 / 60; fig.pos.z += Math.cos(fig.yaw) * 6.5 / 60; return t > 2.5; });
  G.controller.frozen = false;
  yield* ctx.prompt({ text: 'the fire escape' });
  G.controller.ease({ x: ew.pos.x, y: eyeY(ew), z: ew.pos.z, yaw: ew.yaw, pitch: -0.05 }, 1.0);
  yield wait(1.0);
  // through the window: a breath of black, and the iron outside it (the
  // backlot: the same building's fire escape)
  for (let k = 0; k < 1; k += 1 / 60 / 0.25) { G.hud.fade(k); yield null; }
  G.hud.fade(1);
  G.enterStage('backlot');
  const C2 = ctx.flags.chase;
  C2.stage = G.stage;
  C2.spawn({ x: WATCH_AT.x, z: WATCH_AT.z }, 0, 'watcher_run');
  C2.place(4.5);
  umbrellaDown(ctx);
  const e = ESC_RAIL[1];
  G.controller.setPose(e.x, e.z, -Math.PI / 2, -0.1, e.y);
  for (let k = 1; k > 0; k -= 1 / 60 / 0.35) { G.hud.fade(k); yield null; }
  G.hud.fade(0);
}
