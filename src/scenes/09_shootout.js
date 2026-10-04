import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { gunsOf } from '../guns/Guns.js';
import { SITE, DINER } from './shootout/site.js';
import { rigFor, rig, setLights, everyStep, RESERVE, dropMan, knockOut, V } from './shootout/rig.js';
import { freshRoom, placeDot, mackWindow } from './shootout/room.js';
import { nick, placeNick, NICK } from './shootout/nick.js';
import { AT, CARS, CAR_MEN, NORTH, UNDER_EL, SPOTS, OPEN as OPEN_SPOT, beginFight, rebuild, alive, carIn, outOfCar, manForDot, elGunman, driveBy, heavyForDoor, gunman, pressOn, kitchenMan } from './shootout/street.js';
import { saloonIn, saloonMen, glare, cardinalOut, blastNear, SALOON } from './shootout/boss.js';
import { endHat } from './shootout/ending.js';
import { makeHydrant } from './shootout/hydrant.js';
import { DOT_CLIP, dotGunAt, dotDrumsAt, DOT_DRUMS, dotResupplyAt } from '../cast/kinds/cardinal.js';
import { palm, wrap, OPEN } from '../player/handPoses.js';

// VIII The Block (lane C8; docs/story/briefs/C8_BLOCK.md, WAVE_C §6). Back
// to the diner in the nick of time; she lays the Tommy gun on the counter;
// the street as a fight with choices on the gun kit; the Cardinal in three
// stages; his hat in the wet street; THE END. Every beat is a checkpoint:
//   dot       the nick of time (shootout/nick.js): on foot, unarmed; Sal has
//             his gun on Dot, Nicky watches the street by the door. The door
//             (a blow, in a second and a half), a bottle, or Mack's window.
//             Idle: "Last time, sister." - the shot - Too late.
//   gun       she reaches under the counter and lays the Tommy gun before
//             me, and two drums. E. Headlamps swing across the windows
//   cars      two cars; six men out of their doors and across to cover; the
//             Tommy gunner pins the front; the glass goes
//   flank     three out of the dark under the el; one round the corner and
//             in at the door for Dot (her cry: a few seconds to stop him)
//   el        high on the el (the counter does not hide me from him); the
//             drive-by (it steers round what is in the road, or stops and
//             they get out); the heavy for the door
//   saloon    his car at a walk, its lamps in my eyes, two heavies behind it
//   cardinal  him, and his shield man: three honest hits when he is open
//   last      on his knee, then for the door and Dot: ten seconds
//   end       his hat in the wet street, the ember, the train; the still; THE END
const EAST = -Math.PI / 2;
// where Dot lays the gun: her place at the counter, a step clear of Sal
const DOT_LAY = { x: SITE.dot.x, z: 3.2 };
const placeDotAt = (dot, p) => { if (dot) dot.place({ x: p.x, z: p.z }, Math.PI / 2); };
const BEATS = ['dot', 'gun', 'cars', 'flank', 'el', 'saloon', 'cardinal', 'last', 'end'];
const FIGHTS = ['cars', 'flank', 'el', 'saloon', 'cardinal', 'last'];
const SHOOTOUT = { slot: 'shootout', fade: 2.5 };

// the world as each beat's setup makes it (a retry, a CONTINUE, a jump)
function stage(ctx, b) {
  const G = ctx.game, S = ctx.stage, R = rigFor(ctx), K = gunsOf(G), C = ctx.controller;
  const bi = BEATS.indexOf(b);
  // (the last try's leftovers: the nick's hands and ears, the men, the cars)
  if (R.nick && R.nick.cleanup) R.nick.cleanup();
  R.nick = null;
  K.end();
  G.hud.warn(null);
  R.ticks.length = 0;
  for (const h of [...S.hoods.list]) dropMan(G, S, h);
  G.corpses.length = 0; G.pending.length = 0;
  ctx.cast.list.filter((c) => c.kind !== 'waitress').forEach((c) => ctx.cast.remove(c));
  R.rails.clear(); R.cars = {};
  R.cardinal = null; R.boss = null; R.sweep = null;
  if (R.hatReset) R.hatReset();
  if (R.hat) { S.scene.remove(R.hat.obj); if (R.hat.cigar) S.scene.remove(R.hat.cigar); R.hat = null; }
  freshRoom(ctx);
  // [C8] Mack's window: out since II, its sill still there - over it is
  // SPACE (nick.js), never a walk through it (II opens the bay's colliders)
  { const front = S.part('dinerFront'); if (front.closeBay) front.closeBay(mackWindow(G)); }
  R.paneRounds = null;
  // [C8] after the critic: the hydrant on the kerb, whole again at every checkpoint
  if (!R.hydrant) { R.hydrant = makeHydrant(ctx); (R.onTeardown || (R.onTeardown = [])).push(() => { if (R.hydrant) R.hydrant.remove(); R.hydrant = null; }); }
  R.hydrant.reset();
  // a later beat: the front's glass gone, the two cars where they stopped
  if (bi > BEATS.indexOf('cars')) {
    const front = S.part('dinerFront');
    for (const p of Object.values(front.panes)) if (p.state !== 'gone' && !p.parent) S.glass.shatter(p, { dir: V(-1, 0.1, 0), power: 1 });
    CARS.forEach((spec, i) => {
      const car = R.rails.spawn({ rail: spec.rail, lights: false, v0: 0 });
      car.rail.s = car.rail.L; car.rail.done = true; car.rail.stopped = true;
      R.rails.place(car, 0);
      car.c8beat = 'cars';
      R.cars['car' + i] = car;
      for (const k of [...new Set(CAR_MEN.filter((m) => m.car === i).map((m) => m.door))]) { const d = R.rails.openDoor(car, k); d.a = d.to * 0.94; d.hinge.rotation.y = -d.D.side * d.a; d.hole.visible = true; d.hinge.updateMatrixWorld(true); d.mesh.userData.cover = { kind: 'thin' }; R.rails.doorBox(car, d); }
    });
  }
  // the room's light on; the drums as the checkpoint has them
  R.lightsOn = true;
  setLights(ctx, true, { sound: false });
  // ([C8] after the critic: the two she laid for the first fight; one in my
  // coat at every later checkpoint; Dot's one under the counter for this movement)
  R.reserve = bi >= BEATS.indexOf('cars') ? (b === 'cars' ? RESERVE.gun : RESERVE.start) : 0;
  R.dotLeft = RESERVE.dot;
  R.stackReady = false; R.slide = null;
  R.gun.group.visible = false;
  for (const d of R.gun.drums) d.visible = false;
  R.res = null;
  // Dot
  const dot = placeDot(ctx, b === 'dot' ? 'lean' : b === 'gun' ? 'lean' : 'duck');
  if (b === 'dot') dot.place({ x: NICK.dot.x, z: NICK.dot.z }, Math.atan2(NICK.sal.x - NICK.dot.x, NICK.sal.z - NICK.dot.z));
  if (b === 'gun') placeDotAt(dot, DOT_LAY);
  // me
  G.health.reset();
  C.frozen = false;
  G.hands.studyFov = false;
  G.vm.base.pos.copy(R.vmBase0.pos); G.vm.base.rot.copy(R.vmBase0.rot);
  if (R.fire0) { G.weapon.fire = R.fire0; R.fire0 = null; }
  const front = S.part('dinerFront');
  front.door.barred = false; front.door.shut = false;
  if (b === 'dot') {
    G.player.weapons.equip(null);
    C.setPose(NICK.start.x, NICK.start.z, NICK.start.yaw, 0.02);
    C.setMode('sneak', { crouch: false, sfx: G.sfx });
    R.gunTaken = false;
    R.nick = placeNick(ctx);
  } else if (b === 'gun') {
    G.player.weapons.equip(null);
    G.hands.equip('empty', { skin: 'glove' });
    C.setPose(SITE.take.x, DOT_LAY.z - 0.15, Math.PI / 2, -0.12);
    C.setMode('walk');
    R.gunTaken = false;
    // (Sal where he went down, behind the counter)
    const sal = G.spawnHood(NICK.sal.x, NICK.sal.z, { ai: false, variant: { coat: 1, brim: 1, tall: 1 }, yaw: 0.4, state: 'idle' });
    sal.surface = (x, z) => S.surfaceY(x, z);
    sal.c8down = true;
    knockOut(G, sal);
    placeDotAt(dot, DOT_LAY);
  } else {
    const P = AT[b] || AT.cars;
    C.setPose(P.x, P.z, P.yaw, 0);
    C.setMode('gun', { crouch: !!P.crouch });
    G.eye.copy(G.camera.position);
    K.arm('tommy');
    R.gunTaken = true;
    G.vm.lowerTo(0, true);
    if (FIGHTS.includes(b)) beginFight(ctx, b, FIGHT[b] || {});
  }
  ctx.flags.c8 = { beat: b, t0: G.time };
  // (the plays read where a player may hold: lane C2's record's shape)
  ctx.flags.c2 = { beat: b, spots: SPOTS, open: OPEN_SPOT, won: false };
  return R;
}
// each movement's difficulty (the gun kit's three numbers and its flank)
const FIGHT = {
  // (the street's three firing at once in the first fight - five men; a man
  // standing at the window holding the trigger was let through it with two)
  cars: { maxFiring: 3, flankAfter: 13, settleK: 1.2 },
  flank: { maxFiring: 2, flankAfter: 12, settleK: 1.1 },
  el: { maxFiring: 2, flankAfter: 12, settleK: 1.1 },
  saloon: { maxFiring: 2, flankAfter: 0, settleK: 1.1 },
  cardinal: { maxFiring: 2, flankAfter: 0, settleK: 1.1 },
  last: { maxFiring: 2, flankAfter: 0, settleK: 1.1 },
};

export default defineScene({
  id: 'shootout', stage: 'block',
  beats: BEATS,
  save: ['dot', 'gun', 'cars', 'flank', 'el', 'saloon', 'cardinal', 'last'],
  // (the hook put the revolver in the river in VII: I come unarmed; her
  // photograph and the shells in my pocket)
  carry: ['matchbook', 'amesCard', 'check', 'photo', 'shells'],
  flags: { note: 'PIER 9' },
  music: null,
  beatMusic: { cars: SHOOTOUT, flank: SHOOTOUT, el: SHOOTOUT, saloon: { stop: 4 }, cardinal: SHOOTOUT, last: SHOOTOUT },
  objectives: {
    dot: 'Get to Dot.',
    gun: 'Take the gun.',
    cars: 'The diner. Hold it.',
    flank: 'Hold the diner.',
    el: 'Hold the diner.',
    saloon: 'His car. Stop it.',
    cardinal: 'The Cardinal.',
    last: 'Finish it.',
    end: null,
  },
  setup: Object.fromEntries(BEATS.map((b) => [b, (ctx) => { stage(ctx, b); if (b === 'end') endSetup(ctx); }])),

  *script(ctx) {
    const G = ctx.game, R = rig(), K = gunsOf(G);
    ctx.onStep((dt) => everyStep(ctx, dt));
    ctx.onStep((dt) => { const RR = rig(); if (RR && RR.hydrant) RR.hydrant.step(dt); });
    registerProps(ctx);
    // the warning before a fall: the scene's own first (Dot, the el, him),
    // else the kit's
    ctx.onStep(() => {
      const RR = rig();
      if (!RR || G.failing) return;
      // (one of theirs in at the door behind me: the bell, and this)
      if (!RR.warn && RR.doorIn && RR.doorIn.h.alive && G.time - RR.doorIn.t < 2.4) RR.warn = 'The door! Behind you!';
      if (RR.warn) ctx.hud.warn(RR.warn);
      else if (K.active && FIGHTS.includes(ctx.beat) && !RR.won) ctx.hud.warn(K.warning());
      RR.warn = null;
    });
    const glareStep = glare(ctx);
    ctx.onStep(() => glareStep());
    // (a car going up near him: the street's own weapon - he is down and open,
    // not dead: the blast does not end the fight for me)
    const kill0 = G.killHood, dmg0 = G.damageHood;
    G.killHood = function c8kill(h, ...a) { if (h && h.c8boss && R && R.boss && !R.boss.down) { blastNear(R.boss, h.pos); return; } return kill0.call(this, h, ...a); };
    // (his hits are his: the wound counts only when he is open - boss.js)
    G.damageHood = function c8damage(h, dmg, dir, o) { if (h && h.c8onHit && h.alive) { h.hp -= dmg; if (h.flinch) h.flinch(dir); h.c8onHit(); return; } return dmg0.call(this, h, dmg, dir, o); };
    // [C8] after the critic (a round into him when he is shut drew the kit's
    // blood: the picture said 'hit' when the rule said 'not now'): shut, a
    // round on his coat is sparks off the iron under it; blood only when he is open
    const BF = G.fx.bloodFx, blood0 = BF.hit;
    BF.hit = function c8blood(point, dir, o) {
      const B = R && R.boss, h = B && B.h;
      if (h && !B.down && B.open <= 0 && Math.hypot(point.x - h.pos.x, point.z - h.pos.z) < 0.85 && point.y < h.pos.y + 2.2) { ironSparks(G, point, dir); return; }
      return blood0.call(this, point, dir, o);
    };
    const onBlast = ({ at }) => { if (R.boss) blastNear(R.boss, at); };
    G.on('car:exploded', onBlast);
    const exit = () => { G.killHood = kill0; G.damageHood = dmg0; BF.hit = blood0; G.off('car:exploded', onBlast); G.off('scene:exit', exit); G.hud.layer('c8glare').innerHTML = ''; };
    G.on('scene:exit', exit);

    // ---- the nick of time ---------------------------------------------------------------
    if (ctx.at('dot')) {
      yield beat('dot');
      // the still, the first time the story gets here (not on a retry, not on a CONTINUE)
      if (!ctx.flags.c8still && !G.fails('dot') && !G.shotMode) {
        ctx.flags.c8still = true;
        const st = G.stills && G.stills.has && G.stills.has('diner') ? G.stills.play('diner') : null;
        if (st) yield until(() => st.done);
      }
      if (G.fails('dot') === 2 && G.hud.teach.again) G.hud.teach.again('takedown', '[E] from behind: put him down', { until: 'KeyE', secs: 4 });
      const how = yield* nick(ctx, R.nick);
      ctx.flags.c8how = how;
      G.counters.c8how = how;
      // Nicky, if he is up: he heard it - he runs for the others
      const N = R.nick;
      if (N && N.nicky && N.nicky.alive && !N.nicky.c8down) flee(ctx, N.nicky);
      yield wait(0.9);
    }
    // ---- she arms me ----------------------------------------------------------------------
    if (ctx.at('gun')) {
      yield beat('gun');
      yield* theGun(ctx);
    }
    // ---- the street ----------------------------------------------------------------------
    if (ctx.at('cars')) {
      yield beat('cars');
      fight(ctx, 'cars');
      yield* carsBeat(ctx);
    }
    if (ctx.at('flank')) {
      yield beat('flank');
      fight(ctx, 'flank');
      yield* flankBeat(ctx);
    }
    if (ctx.at('el')) {
      yield beat('el');
      fight(ctx, 'el');
      yield* elBeat(ctx);
    }
    // ---- him ---------------------------------------------------------------------------------
    if (ctx.at('saloon')) {
      yield beat('saloon');
      fight(ctx, 'saloon');
      yield* saloonBeat(ctx);
    }
    if (ctx.at('cardinal')) {
      yield beat('cardinal');
      fight(ctx, 'cardinal');
      yield* cardinalBeat(ctx);
    }
    if (ctx.at('last')) {
      yield beat('last');
      fight(ctx, 'last');
      yield* lastBeat(ctx);
    }
    yield beat('end');
    yield* ending(ctx);
  },
});

// ---- the things of the room every beat has: the switch, Dot's drums -------------------
function registerProps(ctx) {
  const G = ctx.game, R = rig();
  ctx.interact.add({
    id: 'b7.lights', at: V(SITE.switch.x, SITE.switch.y, SITE.switch.z), range: 2.0, cone: 0.6,
    prompt: 'the lights', when: () => R.gunTaken && !G.failing,
    onUse: () => setLights(ctx, !R.lightsOn),
  });
  ctx.interact.add({
    id: 'b7.drums', at: () => (R.gun.stack.visible ? R.gun.stack.position.clone().setY(DINER.counter.topY + 0.08) : V(SITE.resupply.x, DINER.counter.topY + 0.1, SITE.resupply.z)),
    range: 2.3, cone: 0.9,
    // (from the customer's side of the counter: she is behind it)
    // ([C8] after the critic: only when my coat is empty, and only while she has one left for this movement)
    prompt: 'a drum', when: () => R.gunTaken && !G.failing && G.eye.x > DINER.counter.frontX - 0.1 && !R.slide && (R.gun.stack.visible ? R.stackReady : (R.reserve <= 0 && (R.dotLeft || 0) > 0)),
    onUse: () => (R.gun.stack.visible ? takeDrums(ctx) : dotResupply(ctx)),
  });
}

// run a generator of the scene's own (one step a yield) under the rig's ticks
function runGen(G, gen, onAbort = null) {
  const R = rig();
  R.ticks.push(() => {
    if (G.failing) { if (onAbort) onAbort(); return false; }
    return !gen.next().done;
  });
}
// the fight for this beat: the kit's encounter (its setup begins it on a
// retry; flowing into the beat, here), and the director's run so the HUD
// shows the health while I am shot at
function fight(ctx, b) {
  const G = ctx.game, K = gunsOf(G), R = rig();
  if (!K.active || (K.cfg && K.cfg.to) !== b) {
    beginFight(ctx, b, FIGHT[b] || {});
    // ([C8] after the critic: a new movement as its checkpoint has it - at
    // least one drum in my coat (she fills one in the quiet), her one under
    // the counter for it)
    if (R && b !== 'cars') {
      if (R.reserve < RESERVE.start) { R.reserve = RESERVE.start; ctx.hud.say('Dot: Here. Filled you one.', 1.8); G.sfx.play('b7_drumTake', null); }
      R.dotLeft = RESERVE.dot;
    }
  }
  // ([C8] after the critic: his car's two men too - one stood off 40 m down the avenue and held the stage)
  if (['cars', 'flank', 'el', 'saloon'].includes(b)) pressOn(ctx);
  if (!G.director.active) { G.director.stop(); G.director.begin(); G.director.run(function* () { while (G.scenes.ctx === ctx && !(rig() && rig().calm)) yield null; }); }
}

// a man who runs for it: by the grid, down the avenue into the dark, gone
// once out of sight a moment
function flee(ctx, h) {
  const G = ctx.game, R = rig();
  h.setAim(false); h.lookAt(null);
  if (ctx.hud.say) ctx.hud.say('Sal? ...', 1.2);
  const goal = { x: -7.6, z: -46 };
  let t = 0;
  R.ticks.push((dt) => {
    if (!G.stage.hoods.list.includes(h) || !h.alive) return false;
    t += dt;
    const yaw = Math.atan2(goal.x - h.pos.x, goal.z - h.pos.z);
    h.yaw += Math.atan2(Math.sin(yaw - h.yaw), Math.cos(yaw - h.yaw)) * Math.min(1, dt * 6);
    if (h.state !== 'run') h.setState('run', 0.2);
    h.speed = 3.4;
    h.pos.x += Math.sin(h.yaw) * 3.4 * dt; h.pos.z += Math.cos(h.yaw) * 3.4 * dt;
    if (Math.hypot(h.pos.x - goal.x, h.pos.z - goal.z) < 1 || t > 14) { G.removeHood(h); return false; }
    return true;
  });
}

// ---- she arms me ----------------------------------------------------------------------------
function* theGun(ctx) {
  const G = ctx.game, R = rig(), C = ctx.controller;
  const dot = ctx.cast.get('dot');
  // (out of the sneak: on my feet in the room)
  if (C.mode !== 'walk') C.setMode('walk');
  G.player.weapons.equip(null);
  G.hands.equip('empty', { skin: 'glove' });
  // [C8] after the critic (the window's way: I am behind the counter with
  // her, and she laid it 3.5 m up the aisle): her place is a step up the
  // aisle from me, clear of Sal where he went down - the gun before me
  const behind = G.eye.x < DINER.counter.frontX - DINER.counter.depth;
  const LAY = behind ? { x: DOT_LAY.x, z: Math.max(1.35, Math.min(DOT_LAY.z, G.eye.z + 2.0)) } : DOT_LAY;
  // she comes to her place opposite me, says it, and lays it down
  if (dot && Math.hypot(dot.pos.x - LAY.x, dot.pos.z - LAY.z) > 0.2) {
    dot.setState('idle', 0.3);
    yield* dot.walkTo({ x: LAY.x, z: LAY.z }, { speed: 1.3 });
  }
  placeDotAt(dot, LAY);
  ctx.hud.say('Dot: Ames said you’d come.', 2.6);
  yield wait(0.6);
  const gun = R.gun;
  let down = false;
  const h = dot.play('b7_dotGun', { fade: 0.25, onMark: {
    gun: () => { gun.group.visible = true; },
    gunDown: () => { down = true; G.sfx.play('b7_gunDown', gun.group.position); },
    drumsUp: () => { gun.stack.visible = true; },
    drumsDown: () => { G.sfx.play('b7_drumDown', gun.stack.position); R.stackReady = true; },
  } });
  R.ticks.push(() => {
    const t = h.t;
    if (t >= DOT_CLIP.gun - 1e-3 && !R.gunTaken) {
      const { p, tilt } = dotGunAt(Math.min(t, DOT_CLIP.gunDown));
      dotToWorld(dot, p, gun.group.position);
      gun.group.rotation.set(tilt, dot.yaw + Math.PI / 2, 0, 'YXZ');
    }
    if (t >= DOT_CLIP.drumsUp - 1e-3 && !R.stackReady && gun.stack.visible) dotToWorld(dot, dotDrumsAt(Math.min(t, DOT_CLIP.drumsDown)).p, gun.stack.position);
    return !h.done && h.t < h.duration;
  });
  yield until(() => down);
  let taken = false;
  ctx.interact.add({ id: 'b7.take', at: () => gun.group.position.clone().setY(DINER.counter.topY + 0.08), range: 2.3, cone: 0.85, prompt: 'take it', onUse: () => { taken = true; } });
  yield until(() => taken);
  ctx.interact.remove('b7.take');
  yield* takeGun(ctx);
  // the drums she laid with it go into my coat with the gun
  yield until(() => R.stackReady);
  gun.stack.visible = false;
  R.reserve = RESERVE.gun;
  G.sfx.play('b7_drumTake', null);
  C.setMode('gun', { crouch: false });
  G.eye.copy(G.camera.position);
  if (G.hud.teach) G.hud.teach('fire', '[LMB] fire');
  ctx.hud.objective('The diner. Hold it.');
  // headlamps swing across the windows (the cars: the bars of their light
  // across the room's back wall, the engines)
  G.sfx.play('engine', V(4, 0.6, -40), { k: 0.8 }, { ref: 12 });
  let t = 0;
  R.ticks.push((dt) => { t += dt; const u = t / 1.6; if (u > 1) { R.sweep = null; return false; } const z = 12 - 22 * u; R.sweep = { z0: z - 1.8, z1: z + 1.8, k: 0.9 * Math.sin(Math.PI * u) }; return true; });
  if (dot) dot.setState('duck', 0.25);
  yield wait(1.8);
}

// [second pass, B7] reaching things on the counter: a step in to it first
const REACH = 0.62, LEAN_MAX = 0.8;
function* stepIn(C, at) {
  const P = C.eyePose();
  const dh = Math.hypot(at.x - P.x, at.z - P.z);
  if (dh <= REACH + LEAN_MAX + 0.05) return;
  const S = DINER.stools, g0 = S.z1 - S.step / 2;
  const gz = g0 + S.step * Math.round((at.z - g0) / S.step);
  // [C8] (behind the counter - the window's way in, the takedown left me in
  // its aisle - the step is along the aisle to beside it, on my side: never
  // through the counter)
  const behind = P.x < DINER.counter.frontX - DINER.counter.depth;
  // ([C8] after the critic: nearer the back bar, beside the gun's south end - never on Sal where he lies, nor on Dot)
  const T = behind ? { x: -15.85, z: at.z - 0.35 } : { x: SITE.take.x, z: Math.max(DINER.counter.z0 + 0.4, Math.min(DINER.counter.z1 - 0.4, gz)) };
  const d = Math.hypot(T.x - P.x, T.z - P.z);
  const yaw = Math.atan2(-(at.x - T.x), -(at.z - T.z));
  const dur = Math.min(0.75, 0.14 + 0.2 * d);
  C.ease({ x: T.x, y: P.y, z: T.z, yaw, pitch: Math.atan2(at.y - P.y, Math.hypot(at.x - T.x, at.z - T.z)) * 0.8 }, dur);
  for (let t = 0; t < dur; t += 1 / 60) yield null;
}
function dotToWorld(dot, p, out = new THREE.Vector3()) {
  const s = Math.sin(dot.yaw), c = Math.cos(dot.yaw);
  return out.set(dot.pos.x + p[2] * s + p[0] * c, dot.pos.y + p[1], dot.pos.z + p[2] * c - p[0] * s);
}
// the hands take the gun off the counter and it comes up to the shoulder (B7, R2-F)
function* takeGun(ctx) {
  const G = ctx.game, R = rig(), H = G.hands, vm = G.vm, cam = G.camera;
  const mesh = R.gun.mesh;
  const fire0 = G.weapon.fire;
  G.weapon.fire = () => {};
  const _m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const onCounter = () => {
    cam.updateWorldMatrix(true, false); mesh.updateWorldMatrix(true, false);
    _m.copy(cam.matrixWorld).invert().multiply(mesh.matrixWorld).decompose(p, q, sc);
    vm.base.pos.copy(p); vm.base.rot.setFromQuaternion(q, 'YXZ');
  };
  const C = G.controller;
  mesh.updateWorldMatrix(true, false);
  const at = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
  yield* stepIn(C, at);
  const P0 = C.eyePose();
  const dx = at.x - P0.x, dz = at.z - P0.z, dh = Math.hypot(dx, dz);
  const lean = Math.max(0, Math.min(LEAN_MAX, dh - REACH));
  const Pl = { x: P0.x + dx / dh * lean, y: P0.y - 0.2 * lean / LEAN_MAX, z: P0.z + dz / dh * lean, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(at.y - (P0.y - 0.2), Math.max(0.3, dh - lean)) + 0.12 };
  if (lean > 0.02) C.ease(Pl, 0.26);
  H.studyFov = true;
  H.snapshot(0.24);
  const fr = { R: H.from.R, L: H.from.L };
  G.player.weapons.equip('tommy');
  G.weapon.reset();
  vm.lowerTo(0, true);
  H.from.R = fr.R; H.from.L = fr.L; H.blendT = 0; H.blendDur = 0.24;
  vm.gun.visible = false;
  onCounter();
  G.sfx.play('b7_take', null);
  for (let t = 0; t < 0.24; t += 1 / 60) { onCounter(); vm.gun.visible = false; yield null; }
  onCounter();
  R.gun.group.visible = false;
  vm.gun.visible = true;
  R.gunTaken = true;
  const p0 = vm.base.pos.clone(), q0 = new THREE.Quaternion().setFromEuler(vm.base.rot);
  const p1 = new THREE.Vector3(0.22, -0.95, Math.min(-0.5, p0.z + 0.12));
  const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(R.vmBase0.rot.x + 0.45, R.vmBase0.rot.y, R.vmBase0.rot.z - 0.25, 'YXZ'));
  const T = 0.34;
  if (lean > 0.02) C.ease({ ...P0, pitch: Math.max(-0.12, Math.min(0.05, P0.pitch)) }, 0.42);
  for (let t = 0; t < T; t += 1 / 60) {
    const u = Math.min(1, t / T);
    const ep = u * u * (3 - 2 * u), er = Math.min(1, u * 1.15) ** 1.3;
    vm.base.pos.lerpVectors(p0, p1, ep).y += 0.07 * Math.sin(Math.PI * Math.min(1, u * 2.2));
    vm.base.rot.setFromQuaternion(new THREE.Quaternion().slerpQuaternions(q0, q1, er * er * (3 - 2 * er)), 'YXZ');
    yield null;
  }
  H.studyFov = false;
  vm.base.pos.copy(R.vmBase0.pos); vm.base.rot.copy(R.vmBase0.rot);
  vm.lowerTo(1, true);
  vm.lowerTo(0);
  G.sfx.play('b7_bolt', null);
  G.weapon.fire = fire0;
  G.weapon.trigger = false;
  yield wait(0.35);
}

// ---- the drums: E at the counter. Dot comes up with one and sets it before
// me; my left hand takes it (B7's, by hand)
function takeDrums(ctx) {
  const R = rig();
  if (!R.gun.stack.visible || R.slide) return;
  R.slide = { t: 0 };
  R.stackReady = false;
  const G = ctx.game, H = G.hands, fire0 = G.weapon.fire, still0 = H.still;
  G.weapon.fire = () => {};
  const restore = () => { G.weapon.fire = fire0; H.still = still0; H.studyFov = false; R.slide = null; };
  runGen(G, drumsGen(ctx, restore), restore);
}
const HAND_IN = V(-0.13, -0.62, -0.26), HAND_OUT = V(-0.16, -0.95, -0.34);
const ELBOW_L = [-0.3, -0.64, -0.12];
const DOWN = 0.97;
function* drumsGen(ctx, restore) {
  const G = ctx.game, R = rig(), C = G.controller, H = G.hands, vm = G.vm, cam = G.camera;
  const st = R.gun.stack;
  const top = () => st.position.clone().setY(st.position.y + 0.13);
  const lower0 = vm.lower;
  const P00 = C.eyePose();
  const at = top();
  const dh0 = Math.hypot(at.x - P00.x, at.z - P00.z);
  if (dh0 > REACH + LEAN_MAX + 0.05) {
    const gen = stepIn(C, at);
    let t = 0;
    for (let r = gen.next(); !r.done; r = gen.next()) { t += 1 / 60; vm.lowerTo(Math.min(DOWN, lower0 + (DOWN - lower0) * Math.min(1, t / 0.2)), true); yield null; }
  }
  const P0 = C.eyePose();
  const dx = at.x - P0.x, dz = at.z - P0.z, dh = Math.hypot(dx, dz);
  const lean = Math.max(0, Math.min(LEAN_MAX, dh - REACH));
  if (lean > 0.02) C.ease({ x: P0.x + dx / dh * lean, y: P0.y - 0.2 * lean / LEAN_MAX, z: P0.z + dz / dh * lean, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(at.y - (P0.y - 0.2), Math.max(0.3, dh - lean)) + 0.1 }, 0.26);
  for (let t = 0; t < 0.2; t += 1 / 60) { vm.lowerTo(Math.max(vm.lower, Math.min(DOWN, t / 0.2)), true); yield null; }
  vm.lowerTo(DOWN, true);
  const Ph = C.eyePose();
  const hold = () => C.ease(Ph, 1e-3);
  const still0 = H.still;
  H.studyFov = true;
  const camInv = new THREE.Matrix4();
  const toCam = (p) => { cam.updateMatrixWorld(true); return p.clone().applyMatrix4(camInv.copy(cam.matrixWorld).invert()); };
  const pose = (wrist, grip, k) => {
    const inv = camInv.copy(cam.matrixWorld).invert();
    const w = st.position.clone().sub(cam.position).setY(0).normalize();
    const away = w.addScaledVector(V(0, -1, 0), 0.35).transformDirection(inv);
    const down = V(0, -1, 0).transformDirection(inv);
    return palm('cam', [wrist.x, wrist.y, wrist.z], [down.x, down.y, down.z], [away.x, away.y, away.z], k < 1 ? mixF(OPEN, grip, k) : grip, ELBOW_L);
  };
  const GRIPF = wrap(0.07, { k: 0.75, thumb: [0.45, 0.3, 0.3, 0.3, 0.25] });
  const T1 = 0.26, T2 = 0.08, T3 = 0.3;
  for (let t = 0; t <= T1 + 1e-6; t += 1 / 60) {
    const u = t / T1, e = 1 - (1 - u) * (1 - u);
    const g = toCam(top());
    const p = HAND_IN.clone().lerp(g, e);
    p.y += 0.06 * Math.sin(Math.PI * u);
    H.still = { ...(still0 || {}), L: pose(p, GRIPF, Math.max(0, (u - 0.6) / 0.4)) };
    hold();
    yield null;
  }
  G.sfx.play('b7_drumTake', st.position.clone());
  for (let t = 0; t < T2; t += 1 / 60) { H.still = { ...(still0 || {}), L: pose(toCam(top()), GRIPF, 1) }; hold(); yield null; }
  const g0 = toCam(top()), o0 = toCam(st.position);
  const off = o0.clone().sub(g0);
  cam.updateMatrixWorld(true);
  const q0 = st.quaternion.clone();
  for (let t = 0; t <= T3 + 1e-6; t += 1 / 60) {
    const u = Math.min(1, t / T3), e = u * u * (3 - 2 * u);
    const g = g0.clone().lerp(HAND_OUT, e);
    g.y += 0.07 * Math.sin(Math.PI * Math.min(1, u * 1.4));
    st.position.copy(g.clone().add(off).applyMatrix4(cam.matrixWorld));
    st.quaternion.copy(q0).premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1).transformDirection(cam.matrixWorld), -0.5 * e));
    H.still = { ...(still0 || {}), L: pose(g, GRIPF, 1) };
    hold();
    yield null;
  }
  st.visible = false;
  st.quaternion.copy(q0);
  R.reserve = Math.min(RESERVE.max, R.reserve + RESERVE.slide);
  restore();
  if (lean > 0.02) C.ease({ ...P0, pitch: Math.max(-0.15, Math.min(0.05, P0.pitch)) }, 0.3);
  for (let t = 0; t < 0.32; t += 1 / 60) { const u = Math.min(1, t / 0.28); vm.lowerTo(DOWN * (1 - u * u * (3 - 2 * u)), true); yield null; }
  vm.lowerTo(0, true);
  // [C8] after the critic (a drum take froze me where I stood until I was
  // shot): an ease holds the eye in any mode but 'walk' - let it go, on my
  // feet where the reach left me, the gun's mode again
  releaseEye(G);
}
function releaseEye(G) {
  const C = G.controller, E = C._ease;
  const p = E ? E.to : C.eyePose();
  C._ease = null;
  C.setMode('gun', { crouch: false, ease: 0.05 });
  C.placeEye({ x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch });
  G.eye.copy(G.camera.position);
}
function mixF(a, b, k) {
  const o = {};
  for (const n of ['i', 'm', 'r', 'l', 't']) o[n] = (a[n] || b[n]).map((v, i) => v + ((b[n] ? b[n][i] : 0) - v) * k);
  return o;
}
function dotResupply(ctx) {
  const G = ctx.game, R = rig();
  const dot = ctx.cast.get('dot');
  const st = R.gun.stack;
  if (!dot || R.slide) return;
  R.slide = { t: 0 };
  st.visible = false; st.rotation.set(0, 0, 0);
  // (she is behind the counter where I stand: her place for it is opposite me)
  dot.place({ x: SITE.dot.x, z: Math.max(DINER.counter.z0 + 0.5, Math.min(DINER.counter.z1 - 0.5, G.eye.z)) }, Math.PI / 2);
  const h = dot.play('b7_dotDrums', { fade: 0.15, onMark: {
    drumsUp: () => { st.visible = true; G.sfx.play('b7_drumTake', st.position.clone()); },
    drumsDown: () => { G.sfx.play('b7_drumDown', st.position.clone()); },
  } });
  // ([C8] her one for this movement: said, so I know there is no other)
  R.dotLeft = Math.max(0, (R.dotLeft || 0) - 1);
  ctx.hud.say('Dot: That’s my last one.', 1.6);
  R.ticks.push(() => {
    const t = h.t;
    if (t >= DOT_DRUMS.drumsUp - 1e-3) dotToWorld(dot, dotResupplyAt(Math.min(t, DOT_DRUMS.drumsDown)).p, st.position);
    if (t >= DOT_DRUMS.drumsDown + 0.08 || h.done) {
      st.visible = true; R.slide = null; R.stackReady = true;
      takeDrums(ctx);
      return false;
    }
    return true;
  });
}

// ---- the street's movements ----------------------------------------------------------------------
// the objective follows the fight: how many are left
function* fightTo(ctx, done, { lines = true } = {}) {
  const G = ctx.game;
  let n0 = alive(ctx);
  yield until(() => {
    const n = alive(ctx);
    if (lines && n < n0 && n > 0) ctx.hud.objective(n === 1 ? 'One left.' : n === 2 ? 'Two left.' : 'Hold the diner.');
    n0 = n;
    return done();
  });
  void G;
}

function* carsBeat(ctx) {
  const G = ctx.game, R = rig(), K = gunsOf(G);
  if (G.fails('cars') === 2) K.teach('crouch', { again: true }); else K.teach('crouch');
  // (down once here: Dot says what the street gives - the car they hide behind)
  if (G.fails('cars') >= 1) R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; ctx.hud.say('Dot: Their tank! The back of the car!', 2.6); return false; })(14));
  const dot = ctx.cast.get('dot');
  if (dot) dot.setState('duck', 0.2);
  let stopped = 0, rose = false;
  CARS.forEach((spec, i) => {
    let t0 = spec.delay;
    R.ticks.push((dt) => {
      if ((t0 -= dt) > 0) return true;
      carIn(ctx, spec, { key: 'car' + i, onStop: (car) => { stopped++; rebuild(G); outOfCar(ctx, car, CAR_MEN.filter((m) => m.car === i)); } });
      return false;
    });
  });
  yield until(() => stopped >= 1);
  yield wait(2.5);
  let more = false;
  yield* fightTo(ctx, () => {
    if (!rose && (G.controller.crouchK || 0) > 0.6) { rose = true; K.teach('rise'); }
    if (!more && stopped >= 2) more = true;
    return more && alive(ctx) === 0;
  });
  yield* clear(ctx);
}

function* flankBeat(ctx) {
  const G = ctx.game, R = rig(), K = gunsOf(G);
  if (G.fails('flank') === 2) K.teach('crouch', { again: true });
  for (const m of UNDER_EL) gunman(ctx, { kind: m.kind, at: m.at, steps: m.steps, wait: m.wait });
  // ([C8] after the critic: the kitchen is the flank's other side now - the man
  // down the north pavement comes only on the first try; after a fall the
  // street is the three under the el, the man for Dot and the kitchen)
  let north = false;
  R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; north = true; if (!G.fails('flank')) for (const m of NORTH) gunman(ctx, m); return false; })(20));
  // round the corner for Dot, some seconds in
  let forDot = null;
  R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; forDot = manForDot(ctx, { onDot: () => G.fail({ why: 'They got Dot.', to: 'flank' }) }); return false; })(11));
  // [C8] after the critic: the flank through the kitchen - from behind the
  // room, while the street has me at the front (the crash, 'Kitchen!')
  let kitchen = null;
  // (from the second fall in the flank he comes later, when the street has thinned)
  R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; kitchen = R.kitchen = kitchenMan(ctx); return false; })(G.fails('flank') >= 2 ? 26 : 16));
  yield until(() => !!forDot && north && !!kitchen);
  yield* fightTo(ctx, () => alive(ctx) === 0);
  yield* clear(ctx);
}

function* elBeat(ctx) {
  const G = ctx.game, R = rig(), K = gunsOf(G);
  const el = elGunman(ctx);
  R.el = el;
  // his warning: the gun over the rail
  // ([C8] after the critic: from the moment he has me, not only once his gun
  // is up - down behind the counter's front he still has me, and the kit's
  // 'Stay down. Let it mend.' must not say otherwise: this line is first)
  R.ticks.push(() => { if (!el.h.alive) return false; if (el.mode !== 'in' && el.line) R.warn = 'Up on the el! Get under something!'; return true; });
  ctx.hud.say('Dot: On the el!', 1.6);
  let db = null;
  let heavy = null;
  R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; db = driveBy(ctx, {}); return false; })(9));
  R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; heavy = heavyForDoor(ctx); return false; })(17));
  yield until(() => !!db);
  let elSaid = false, again = 0;
  yield* fightTo(ctx, () => {
    if (!elSaid && el.h.alive && alive(ctx) === 1 && heavy) { elSaid = true; ctx.hud.objective('One on the el. Find him.'); }
    // [C8] after the critic (a drive-by gone down the avenue took its men with
    // it after one pass, unsaid): far down the avenue in the dark it turns and
    // comes round again ('coming round again!'), its Tommy gun along the front
    // a second time; only after that second run is it gone for good, said
    // ('They're gone.'). Surviving its two runs, or stopping it (its driver,
    // its engine, something in its way: it stops and they get out), is the
    // contest for it.
    if (db && db.car.rail && db.car.rail.done && !db.out && !db.crashed && db.car.state !== 'burning') {
      for (const h of [db.driver, db.gunner]) if (h.alive) { h.c8gone = true; G.removeHood(h); }
      R.rails.remove(db.car); delete R.cars.driveby;
      db = null;
      if (again === 0) {
        again = 1;
        R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; ctx.hud.say('Dot: They’re coming round again!', 2.0); db = driveBy(ctx, {}); again = 2; return false; })(5));
      } else { again = 3; ctx.hud.say('Dot: They’re gone.', 1.8); }
    }
    return alive(ctx) === 0 && !!heavy && again !== 1;
  });
  // (a drive-by that stopped and let its men out stands in the road: it is
  // taken away once out of sight - his saloon comes up that lane)
  if (db && db.car.state !== 'burning' && db.out) R.ticks.push(() => { const c = db.car; if (!R.rails.list.includes(c)) return false; if (inView(G, c.pos)) return true; R.rails.remove(c); delete R.cars.driveby; rebuild(G); return false; });
  yield* clear(ctx);
}
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();
function inView(G, p) {
  const cam = G.camera;
  _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_pm);
  return _fr.intersectsSphere(new THREE.Sphere(new THREE.Vector3(p.x, 0.8, p.z), 3));
}
// the room won: no warning, a breath
function* clear(ctx) {
  const R = rig(), G = ctx.game;
  R.won = true;
  (G._c2won || (G._c2won = [])).push(ctx.beat);
  if (ctx.flags.c2) ctx.flags.c2.won = true;
  ctx.hud.warn(null);
  ctx.hud.objective('Clear.');
  yield wait(2.2);
  R.won = false;
}

// ---- him -------------------------------------------------------------------------------------
// [C8] after the critic (it stopped by itself at the end of its rail: the
// stage was two heavies and a spray): it comes on to the diner's door unless
// it is stopped - two tyres (the lamps first, or the glare hides them); a car
// at the door loses the stage, said before it ('nearly at the door'). Won
// when it is stopped and his two men are down. (Held up by a wreck in its
// lane for three seconds it stands where it is: a real cause, the player's.)
function* saloonBeat(ctx) {
  const G = ctx.game, R = rig();
  const retry = G.fails('saloon') > 0;
  yield wait(retry ? 0.5 : 3.5);
  ctx.hud.say(retry ? 'Dot: The tyres! Stop it!' : 'Dot: That’s his car.', 2.0);
  const car = saloonIn(ctx, { retry });
  let atDoor = false, stopped = false;
  car.rail.onStop = () => {
    if (car.c8flat) { stopped = true; R.saloonS = car.rail.s; G.sfx.play('b7_handbrake', car.pos.clone().setY(0.6)); rebuild(G); ctx.hud.say('Dot: It’s stopped!', 1.6); }
    else atDoor = true;
  };
  saloonMen(ctx, car);
  R.ticks.push(() => {
    if (stopped || G.failing || !R.rails.list.includes(car)) return false;
    // (held up by a wreck or a car in its lane, not by one of its own men crossing it, nor by me)
    if ((car.rail.held || 0) > 3 && !/^(hood|me)/.test(car.rail.what || '')) { stopped = true; R.saloonS = car.rail.s; car.rail.plan.v.fill(0); car.rail.done = true; car.rail.stopped = true; rebuild(G); return false; }
    // (the warning stays up through the fail: it was said first)
    if (atDoor || car.rail.L - car.rail.s < 15) R.warn = 'His car’s nearly at the door! The tyres!';
    return true;
  });
  yield until(() => atDoor || (stopped && alive(ctx) === 0));
  if (atDoor && !stopped) { G.fail({ why: 'His car made the door.', to: 'saloon' }); yield until(() => false); }
  yield* clear(ctx);
}
// the saloon where it stopped (a checkpoint after the saloon, a jump)
function parkedSaloon(ctx) {
  const G = ctx.game, R = rig();
  const car = saloonIn(ctx, {});
  car.rail.s = R.saloonS != null ? R.saloonS : Math.max(0, car.rail.L - SALOON.parkBack);
  car.rail.done = true; car.rail.stopped = true; car.rail.plan.v.fill(0); R.rails.place(car, 0);
  rebuild(G);
  return car;
}

function* cardinalBeat(ctx) {
  const G = ctx.game, R = rig();
  let car = R.cars.saloon;
  // (a retry, a jump: the saloon stands where it stopped)
  if (!car) car = parkedSaloon(ctx);
  const door = R.rails.openDoor(car, 'rr', { speed: 2.2 });
  door.mesh.userData.cover = { kind: 'thin' };
  G.sfx.play('b7_carDoor', car.pos.clone().setY(1));
  yield wait(0.3);
  R.boss = cardinalOut(ctx, car, { stage: 2 });
  R.ticks.push(((d0) => (dt) => { if ((d0 -= dt) > 0) return true; R.rails.doorBox(car, door); rebuild(G); return false; })(0.8));
  // his tell, said: the ember, the gun coming up
  R.ticks.push(() => { const B = R.boss; if (!B || B.down) return false; if (B.mode === 'draw') R.warn = 'His gun! Get down!'; return true; });
  yield until(() => R.boss.stage === 3 || R.boss.down);
  (G._c2won || (G._c2won = [])).push('cardinal');
}

function* lastBeat(ctx) {
  const G = ctx.game, R = rig();
  let B = R.boss;
  let lost = false;
  if (!B || B.down || B.stage !== 3) {
    // (a retry: up off his knee by his car, hurt, the hat gone)
    let car = R.cars.saloon;
    if (!car) car = parkedSaloon(ctx);
    B = R.boss = cardinalOut(ctx, car, { at: { x: -7.4, z: -3.8 }, stage: 3, hatGone: true });
    B.wounds = 3;
  } else {
    B.lastT = 0;
  }
  const B2 = B;
  // (the door: fail when he is in, or the ten seconds are out)
  ctx.hud.say('Dot: He’s coming in!', 1.8);
  R.ticks.push(() => { if (B2.down) return false; R.warn = 'He’s going for Dot! Finish it!'; if ((B2.lastT || 0) > 10 || (B2.h && B2.h.pos.x < DINER.innerX - 0.4)) lost = true; return true; });
  yield until(() => B2.down || lost);
  if (!B2.down) { G.fail({ why: 'He got to Dot.', to: 'last' }); yield until(() => false); }
  (G._c2won || (G._c2won = [])).push('last');
  ctx.hud.warn(null);
  yield wait(1.4);
}

// ---- the end: his hat in the wet street; the still; THE END ------------------------------------
function endSetup(ctx) {
  const G = ctx.game, R = rig(), K = gunsOf(G);
  K.end();
  // (a jump: him down where the story has him fall, the saloon by the kerb)
  parkedSaloon(ctx);
  R.ctxEnd = ctx;
}
function* ending(ctx) {
  const G = ctx.game, R = rig(), C = ctx.controller;
  gunsOf(G).end();
  R.won = true;
  ctx.hud.warn(null);
  // (a jump: he falls as the beat begins)
  if (!R.hat) {
    const c = ctx.cast.spawn('cardinal', { at: { x: -7.9, z: -2.4 }, yaw: -2.5 });
    const h = c.fig; c.own = false; G.stage.hoods.list.push(h); h.b7char = c; h.hp = 1e6;
    G.killHood(h, V(0.6, 0, 0.8).normalize(), false, 'deathBack');
    endHat(ctx, h, { now: false });
  }
  // the others break and go
  for (const h of [...G.stage.hoods.list]) if (h.alive && !h.b7char) flee(ctx, h);
  yield wait(1.2);
  G.weapon.trigger = false;
  R.fire0 = G.weapon.fire;
  G.weapon.fire = () => {};
  G.vm.lowerTo(0.62);
  // Dot out from behind the counter to the broken window
  runGen(G, dotToWindow(ctx));
  const hat = R.hat;
  let idle = 0;
  yield until(() => {
    idle += 1 / 60;
    const e = G.eye;
    const d = hat ? Math.hypot(e.x - hat.rest.x, e.z - hat.rest.z) : 0;
    if (idle > 9 && hat) G.hud.prompt('WASD  out to him', G.screenOf(hat.rest.clone().setY(0.2)), 'scene'); else G.hud.clearPrompt('scene');
    return !hat || d < 2.4 || idle > 40;
  });
  G.hud.clearPrompt('scene');
  yield* theFrame(ctx);
  // the still for the end, then THE END
  if (G.stills && G.stills.has && G.stills.has('end')) { const st = G.stills.play('end'); yield until(() => st.done); }
  G.state = 'end';
  C.frozen = true;
  G.hud.clearPrompt();
  G.hud.showEnd({ kind: 'end', epi: '', go: 'click for the title' });
  G.hud.endKind = 'cont';
  if (G.save) { G.save.flags.ended = true; G.save.write(); }
  if (!G.shotMode && typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
}
function* dotToWindow(ctx) {
  const G = ctx.game, R = rig();
  const dot = ctx.cast.get('dot');
  if (!dot || R.dotOut) return;
  R.dotOut = true;
  const bay = DINER.bays[mackWindow(G)];
  const w = { x: -11.15, z: bay + 0.35 };
  const south = bay < 0;
  const endZ = south ? DINER.counter.z0 - 0.8 : DINER.counter.z1 + 0.6;
  const pts = [{ x: SITE.dot.x, z: endZ }, { x: -12.9, z: endZ }];
  if (!south) pts.push({ x: -12.9, z: w.z });
  pts.push(w);
  dot.setState('idle', 0.35);
  for (let t = 0; t < 0.5; t += 1 / 60) yield null;
  for (const p of pts) yield* dot.walkTo(p, { speed: 1.7 });
  const y0 = dot.yaw, dy = Math.atan2(Math.sin(Math.PI / 2 - y0), Math.cos(Math.PI / 2 - y0));
  for (let t = 0; t < 0.45; t += 1 / 60) { const u = t / 0.45; dot.yaw = y0 + dy * u * u * (3 - 2 * u); yield null; }
  dot.yaw = Math.PI / 2;
  dot.setState('watch', 0.4);
}
function standClear(S, p, m = 0.45) {
  if (p.x < -9.9) return false;
  for (const b of S.colliders.boxes) {
    const dx = p.x - b.cx, dz = p.z - b.cz, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
    if (Math.hypot(Math.max(0, Math.abs(lx) - b.hx), Math.max(0, Math.abs(lz) - b.hz)) < m) return false;
  }
  for (const c of S.colliders.circles) if (c.tag !== 'hood' && Math.hypot(p.x - c.x, p.z - c.z) < c.r + m) return false;
  return true;
}
function* theFrame(ctx) {
  const G = ctx.game, R = rig(), C = G.controller;
  const hat = R.hat;
  const from = C.eyePose();
  const at = hat ? hat.rest.clone() : V(-7.9, 0, -2.4);
  // [C8] after the critic (the frame looked down the avenue away from the
  // diner: no Dot, no window, no train): low behind the hat, looking up the
  // pavement past it - the hat and the ember in the foreground, the diner's
  // front beyond with Mack's broken window and Dot in it, the el down the
  // avenue on the left and the train going away along it
  const win = V(-11.15, 1.4, DINER.bays[mackWindow(G)] + 0.35);
  // (the eye on the far side of the hat from her window, out toward the road:
  // looking past the hat along the avenue at her - down it, the reference's
  // view, when the window is south of him)
  const sz = Math.sign(at.z - win.z) || 1;
  let eye = null;
  for (const [ox, oz] of [[1.3, 2.0], [1.6, 1.6], [1.0, 2.4], [1.9, 2.2], [0.7, 1.9]]) {
    const e = at.clone().add(V(ox, 0, sz * oz));
    if (standClear(G.stage, e, 0.35)) { eye = e; break; }
  }
  if (!eye) eye = at.clone().add(V(1.3, 0, sz * 2.0));
  eye.y = G.stage.surfaceY(eye.x, eye.z) + 0.95;
  // (the hat low left of the middle, her window beyond it, the el on the far side, the avenue's vanishing point)
  const lookAt = V(at.x - 1.2, 0.8, at.z - sz * 6);
  const yaw = Math.atan2(-(lookAt.x - eye.x), -(lookAt.z - eye.z));
  const pitch = Math.atan2(lookAt.y - eye.y, Math.hypot(lookAt.x - eye.x, lookAt.z - eye.z));
  const to = { x: eye.x, y: eye.y, z: eye.z, yaw, pitch };
  const dur = 2.6;
  C.setMode('cutscene', { ease: 0.01, track: (t) => {
    const u = Math.min(1, t / dur), k = u * u * (3 - 2 * u);
    const L = (a, b) => a + (b - a) * k;
    const dy = Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw));
    const w = Math.min(1, Math.max(0, (t - dur - 0.4) / 5)), lift = 0.06 * w * w * (3 - 2 * w);
    return { x: L(from.x, to.x), y: L(from.y, to.y), z: L(from.z, to.z), yaw: from.yaw + dy * k, pitch: L(from.pitch, to.pitch) - 0.015 * Math.sin(Math.min(1, t / 9) * Math.PI) + lift };
  } });
  G.vm.lowerTo(1);
  // (Dot at her window by the time the eye settles)
  const dot = ctx.cast.get('dot');
  if (dot && !R.dotOut) runGen(G, dotToWindow(ctx));
  // (the train up the avenue, going away north: its tail lamps in the frame as the eye settles)
  // (dir 1 runs it down the avenue, -z: away from an eye looking down it; it
  // comes from behind me and passes overhead as the eye settles, then goes)
  G.director.cue('train', { z: eye.z, ahead: -38, dir: sz > 0 ? 1 : -1 });
  yield wait(dur);
  G.music.cue('end', { fade: 3 });
  yield wait(6);
}

// sparks off the iron under his coat (a shut hit): white, brief, no blood
function ironSparks(G, p, dir) {
  const F = G.fx, r = G.rng;
  const n = V(-dir.x, 0, -dir.z).normalize();
  for (let i = 0; i < 9; i++) {
    const v = n.clone().multiplyScalar(r.range(2, 6)).add(V(r.gauss() * 2, r.range(0.5, 3), r.gauss() * 2));
    F.sparks.spawn({ pos: p.clone().addScaledVector(n, 0.03), vel: v, life: r.range(0.06, 0.18), size: [0.008, 0.012], stretch: 0.035, col: [5, 5, 5], alpha: 1, cell: 4, gravity: 9.8, ground: 0.15, fadeOut: 0.3 });
  }
  G.sfx.play('c2_woodHit', p, { k: 0.4 }, { ref: 2 });
}

export { EAST, saloonMen, SALOON };
