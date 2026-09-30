import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { makeBrain } from '../enemies/HoodBrains.js';
import { SITE, BEATS, DINER, DOORS } from './shootout/site.js';
import { stageBeat, rig, markBeat, man, setLights, roundAt, everyStep, RESERVE, V } from './shootout/rig.js';
import { endHat } from './shootout/ending.js';
import { mackWindow } from './shootout/room.js';
import { DOT_CLIP, dotGunAt, dotDrumsAt, DOT_DRUMS, dotResupplyAt } from '../cast/kinds/cardinal.js';
import { palm, wrap, OPEN } from '../player/handPoses.js';

// Scene 9, The Block (B7; docs/story/briefs/B7_SHOOTOUT.md). Back on the
// block, in the diner; I get there first. Dot hands me the Tommy gun from
// under the counter; they come as the story, not as waves:
//   arrive     in at the door: "They're coming here." Dot lays the gun and
//              two drums on the counter: E take it. (E the lights, by the door)
//   cars       two sedans up the avenue swing in nose first at the far side,
//              their lamps through the room; six men out behind the doors;
//              the diner's glass goes pane by pane
//   doorways   out of the dark under the el, up between the columns; one
//              round to the diner's door and in
//   el         a gunman on the el's rail, firing down; hit, he goes over it
//   driveby    a car that does not stop, a Tommy gun from its window along
//              the front; crippled, it goes into a post and burns; if not,
//              it turns at the end of the block and comes back once
//   cardinal   a quiet; the saloon rolls up under the lamp; two heavies,
//              then him, walking at the diner
//   end        he falls in the street; his hat in the water, the cigar lit
//              beside it; I walk out to it; the train; the end card
// Each beat begins when the one before it is nearly done (one or two men
// left). Dying: black, and back at the start of the beat, the room as it was.
// Ammunition: the drums on the counter, and Dot's when I come back to it.

const Q = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams(''));
const setup = {};
for (const b of BEATS) setup[b] = (ctx) => { stageBeat(ctx, b); if (setupExtra[b]) setupExtra[b](ctx); };
const setupExtra = {
  // (a jump straight to 'end' finds him down in the street)
  end(ctx) { ctx.flags.endJump = true; },
};

export default defineScene({
  id: 'shootout', stage: 'block',
  beats: BEATS,
  save: ['arrive', 'cars', 'doorways', 'el', 'driveby', 'cardinal'],
  setup,

  *script(ctx) {
    const G = ctx.game, S = ctx.stage, R = rig();
    ctx.onStep((dt) => everyStep(ctx, dt));
    registerProps(ctx);

    if (ctx.at('arrive')) {
      yield beat('arrive');
      markBeat(ctx, 'arrive');
      yield* arrive(ctx);
    }
    if (ctx.at('cars')) {
      yield beat('cars');
      markBeat(ctx, 'cars');
      G.music.cue('shootout', { fade: 2.5 });
      yield* carsBeat(ctx);
    }
    if (ctx.at('doorways')) {
      yield beat('doorways');
      markBeat(ctx, 'doorways');
      yield* doorways(ctx);
    }
    if (ctx.at('el')) {
      yield beat('el');
      markBeat(ctx, 'el');
      yield* elBeat(ctx);
    }
    if (ctx.at('driveby')) {
      yield beat('driveby');
      markBeat(ctx, 'driveby');
      yield* driveby(ctx);
    }
    if (ctx.at('cardinal')) {
      yield beat('cardinal');
      markBeat(ctx, 'cardinal');
      yield* cardinal(ctx);
    }
    yield beat('end');
    yield* ending(ctx);
    void R; void S;
  },
});

// ---- the things of the room every beat has: the switch, the drums at the counter -----
function registerProps(ctx) {
  const G = ctx.game, R = rig();
  ctx.interact.add({
    id: 'b7.lights', at: V(SITE.switch.x, SITE.switch.y, SITE.switch.z), range: 2.0, cone: 0.6,
    prompt: 'the lights', when: () => R.gunTaken && !R.dying,
    onUse: () => setLights(ctx, !R.lightsOn),
  });
  ctx.interact.add({
    id: 'b7.drums', at: () => (R.gun.stack.visible ? R.gun.stack.position.clone().setY(DINER.counter.topY + 0.08) : V(SITE.resupply.x, DINER.counter.topY + 0.1, SITE.resupply.z)),
    range: 2.3, cone: 0.9,
    prompt: 'drums', when: () => R.gunTaken && !R.dying && R.reserve < RESERVE.max && !R.slide && (R.stackReady || !R.gun.stack.visible),
    onUse: () => (R.gun.stack.visible ? takeDrums(ctx) : dotResupply(ctx)),
  });
}

// run a generator of the scene's own (one step a yield) under the rig's
// ticks; a death on the way stops it (onAbort puts things back)
function runGen(gen, onAbort = null) {
  const R = rig();
  R.ticks.push(() => {
    if (R.dying) { if (onAbort) onAbort(); return false; }
    return !gen.next().done;
  });
}

// [second pass] the drums on the counter into my coat, by my left hand
// (object first): the gun dips out of the frame, the eye leans over the
// counter, the left hand comes up to the stack, closes on it and carries it
// down toward me out of the frame; the gun comes back up. (The hand is seen
// through the eye's own lens while the gun is out of sight, as the take's.)
function takeDrums(ctx) {
  const R = rig();
  if (!R.gun.stack.visible || R.slide) return;
  R.slide = { t: 0 };
  R.stackReady = false;
  // (no round leaves a gun that is off the shoulder)
  const G = ctx.game, H = G.hands, fire0 = G.weapon.fire, still0 = H.still;
  G.weapon.fire = () => {};
  const restore = () => { G.weapon.fire = fire0; H.still = still0; H.studyFov = false; R.slide = null; };
  runGen(drumsGen(ctx, restore), restore);
}
const HAND_IN = V(-0.13, -0.62, -0.26), HAND_OUT = V(-0.16, -0.95, -0.34);
// (the sleeve comes up from the bottom edge, not past the lens)
const ELBOW_L = [-0.3, -0.64, -0.12];
// (the gun this far down is out of the frame, and the hands' root still drawn:
// Viewmodel hides the root from 0.98)
const DOWN = 0.97;
function* drumsGen(ctx, restore) {
  const G = ctx.game, R = rig(), C = G.controller, H = G.hands, vm = G.vm, cam = G.camera;
  const st = R.gun.stack;
  const top = () => st.position.clone().setY(st.position.y + 0.13);
  // the gun off the shoulder, fast, while he steps / leans in
  const lower0 = vm.lower;
  const P00 = C.eyePose();
  const at = top();
  const dh0 = Math.hypot(at.x - P00.x, at.z - P00.z);
  const far = dh0 > REACH + LEAN_MAX + 0.05;
  if (far) {
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
  // (the eye held where it leaned while the hand works: a turn or a step
  // away would drag the arm after the drums)
  const Ph = C.eyePose();
  const hold = () => C.ease(Ph, 1e-3);
  // the left hand, seen through the eye's own lens
  const still0 = H.still;
  H.studyFov = true;
  const camInv = new THREE.Matrix4();
  const toCam = (p) => { cam.updateMatrixWorld(true); return p.clone().applyMatrix4(camInv.copy(cam.matrixWorld).invert()); };
  const pose = (wrist, grip, k) => {
    // (the palm on the stack's top, the fingers over its far rim: the way
    // from the eye to the stack, level, and down, in the eye's frame)
    const inv = camInv.copy(cam.matrixWorld).invert();
    const w = st.position.clone().sub(cam.position).setY(0).normalize();
    const away = w.addScaledVector(V(0, -1, 0), 0.35).transformDirection(inv);
    const down = V(0, -1, 0).transformDirection(inv);
    return palm('cam', [wrist.x, wrist.y, wrist.z], [down.x, down.y, down.z], [away.x, away.y, away.z], k < 1 ? mixF(OPEN, grip, k) : grip, ELBOW_L);
  };
  const GRIPF = wrap(0.07, { k: 0.75, thumb: [0.45, 0.3, 0.3, 0.3, 0.25] });
  // the reach (0.26 s): up from below the frame onto the stack
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
  // the grip
  for (let t = 0; t < T2; t += 1 / 60) { H.still = { ...(still0 || {}), L: pose(toCam(top()), GRIPF, 1) }; hold(); yield null; }
  // the carry: the stack comes off the counter toward me and down out of the
  // frame (its path first, the hand on it)
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
  // back up, the gun to the shoulder (0.28 s)
  if (lean > 0.02) C.ease({ ...P0, pitch: Math.max(-0.15, Math.min(0.05, P0.pitch)) }, 0.3);
  for (let t = 0; t < 0.28; t += 1 / 60) { const u = t / 0.28; vm.lowerTo(DOWN * (1 - u * u * (3 - 2 * u)), true); yield null; }
  vm.lowerTo(0, true);
}
// fingers between two grips
function mixF(a, b, k) {
  const o = {};
  for (const n of ['i', 'm', 'r', 'l', 't']) o[n] = (a[n] || b[n]).map((v, i) => v + ((b[n] ? b[n][i] : 0) - v) * k);
  return o;
}

// Dot comes up from behind the counter with two drums (her clip: the drums
// on its path, object first) and sets them on the top before me; my hand
// takes them as they come to rest
function dotResupply(ctx) {
  const G = ctx.game, R = rig();
  const dot = ctx.cast.get('dot');
  const st = R.gun.stack;
  if (!dot || R.slide) return;
  R.slide = { t: 0 };
  st.visible = false; st.rotation.set(0, 0, 0);
  const h = dot.play('b7_dotDrums', { fade: 0.15, onMark: {
    drumsUp: () => { st.visible = true; G.sfx.play('b7_drumTake', st.position.clone()); },
    drumsDown: () => { G.sfx.play('b7_drumDown', st.position.clone()); },
  } });
  R.ticks.push(() => {
    const t = h.t;
    if (t >= DOT_DRUMS.drumsUp - 1e-3) dotToWorld(dot, dotResupplyAt(Math.min(t, DOT_DRUMS.drumsDown)).p, st.position);
    if (t >= DOT_DRUMS.drumsDown + 0.08 || h.done) {
      st.visible = true;
      R.slide = null;
      R.stackReady = true;
      takeDrums(ctx);
      return false;
    }
    return true;
  });
}

// ---- 1. arrive --------------------------------------------------------------------------------
function* arrive(ctx) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const dot = ctx.cast.get('dot');
  yield wait(1.1);
  G.hud.say("They're coming here.", 2.0);
  yield wait(0.7);
  // Dot brings the gun up from under the counter and lays it down before
  // me, then two drums: her clip, the things on its paths (object first)
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
    if (t >= DOT_CLIP.drumsUp - 1e-3 && !R.stackReady && gun.stack.visible) {
      dotToWorld(dot, dotDrumsAt(Math.min(t, DOT_CLIP.drumsDown)).p, gun.stack.position);
    }
    return !h.done && h.t < h.duration;
  });
  // [second pass] a round fired in the room puts her down behind the counter
  // (once her hands are free: the gun and the drums are laid first)
  const shots0 = G.counters.shots;
  R.ticks.push(() => {
    if (ctx.beat !== 'arrive' || dot.state === 'duck') return false;
    if (G.counters.shots > shots0 && (h.done || h.t >= h.duration)) { dot.setState('duck', 0.18); return false; }
    return true;
  });
  // E take it (at the counter), from the moment it lies there
  yield until(() => down);
  let taken = false;
  ctx.interact.add({ id: 'b7.take', at: () => gun.group.position.clone().setY(DINER.counter.topY + 0.08), range: 2.3, cone: 0.85, prompt: 'take it', onUse: () => { taken = true; } });
  yield until(() => taken);
  ctx.interact.remove('b7.take');
  yield* takeGun(ctx);
  // a breath, then the engines
  yield wait(2.5);
}

// [second pass] reaching things on the counter: the eye leans in until the
// thing lies a forearm's reach away (REACH, horizontally), at most LEAN_MAX;
// from further off than that he steps in to the counter first, along the
// aisle side of the stools (the take place), so no arm ever stretches
const REACH = 0.62, LEAN_MAX = 0.8;
function* stepIn(C, at) {
  const P = C.eyePose();
  const dh = Math.hypot(at.x - P.x, at.z - P.z);
  if (dh <= REACH + LEAN_MAX + 0.05) return;
  // the place: on the aisle side of the stools (the take place's line),
  // at the gap between two stools nearest the thing
  const S = DINER.stools, g0 = S.z1 - S.step / 2;
  const gz = g0 + S.step * Math.round((at.z - g0) / S.step);
  const T = { x: SITE.take.x, z: Math.max(DINER.counter.z0 + 0.4, Math.min(DINER.counter.z1 - 0.4, gz)) };
  const d = Math.hypot(T.x - P.x, T.z - P.z);
  const yaw = Math.atan2(-(at.x - T.x), -(at.z - T.z));
  const dur = Math.min(0.75, 0.14 + 0.2 * d);
  C.ease({ x: T.x, y: P.y, z: T.z, yaw, pitch: Math.atan2(at.y - P.y, Math.hypot(at.x - T.x, at.z - T.z)) * 0.8 }, dur);
  for (let t = 0; t < dur; t += 1 / 60) yield null;
}

// a point of Dot's own frame (metres: x her left, y up, z ahead) in the world
function dotToWorld(dot, p, out = new THREE.Vector3()) {
  const s = Math.sin(dot.yaw), c = Math.cos(dot.yaw);
  return out.set(dot.pos.x + p[2] * s + p[0] * c, dot.pos.y + p[1], dot.pos.z + p[2] * c - p[0] * s);
}

// the hands take the gun off the counter and it comes up to the shoulder
// (object first): the viewmodel's own gun is put where the one on the
// counter lies (seen through the eye's own lens), the gloved hands come up
// onto its grips; the one on the counter goes and the hands' one is lifted
// off, toward me and down out of the frame; there, out of sight, the lens
// goes back to the gun's own and it comes up to the shoulder as it always did
function* takeGun(ctx) {
  const G = ctx.game, R = rig(), H = G.hands, vm = G.vm, cam = G.camera;
  const mesh = R.gun.mesh;
  // [second pass] (no round leaves the gun until it is at the shoulder)
  const fire0 = G.weapon.fire;
  G.weapon.fire = () => {};
  const _m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const onCounter = () => {
    cam.updateWorldMatrix(true, false); mesh.updateWorldMatrix(true, false);
    _m.copy(cam.matrixWorld).invert().multiply(mesh.matrixWorld).decompose(p, q, sc);
    vm.base.pos.copy(p); vm.base.rot.setFromQuaternion(q, 'YXZ');
  };
  // (a man leans over the counter to take a thing lying at its far side:
  // the eye goes to it, and back as the gun comes up)
  const C = G.controller;
  mesh.updateWorldMatrix(true, false);
  const at = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
  // [second pass] from further off than a lean, a step in to the counter
  // first (at once, as E goes down): the arms never stretch across the room
  yield* stepIn(C, at);
  const P0 = C.eyePose();
  const dx = at.x - P0.x, dz = at.z - P0.z, dh = Math.hypot(dx, dz);
  const lean = Math.max(0, Math.min(LEAN_MAX, dh - REACH));
  const Pl = { x: P0.x + dx / dh * lean, y: P0.y - 0.2 * lean / LEAN_MAX, z: P0.z + dz / dh * lean, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(at.y - (P0.y - 0.2), Math.max(0.3, dh - lean)) + 0.12 };
  if (lean > 0.02) C.ease(Pl, 0.26);
  H.studyFov = true;
  // (the hands come from where they were: below the frame)
  H.snapshot(0.24);
  const fr = { R: H.from.R, L: H.from.L };
  G.player.weapons.equip('tommy');
  G.weapon.reset();
  vm.lowerTo(0, true);
  H.from.R = fr.R; H.from.L = fr.L; H.blendT = 0; H.blendDur = 0.24;
  vm.gun.visible = false;
  onCounter();
  G.sfx.play('b7_take', null);
  // the reach
  for (let t = 0; t < 0.24; t += 1 / 60) { onCounter(); vm.gun.visible = false; yield null; }
  // the grip: the gun is in my hands
  onCounter();
  R.gun.group.visible = false;
  vm.gun.visible = true;
  R.gunTaken = true;
  // the lift: off the counter, toward me, down out of the frame
  const p0 = vm.base.pos.clone(), q0 = new THREE.Quaternion().setFromEuler(vm.base.rot);
  const p1 = new THREE.Vector3(0.24, -0.66, -0.4);
  const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(R.vmBase0.rot.x - 0.75, R.vmBase0.rot.y, R.vmBase0.rot.z - 0.3, 'YXZ'));
  const T = 0.38;
  if (lean > 0.02) C.ease({ ...P0, pitch: Math.max(-0.12, Math.min(0.05, P0.pitch)) }, 0.42);
  for (let t = 0; t < T; t += 1 / 60) {
    const u = Math.min(1, t / T), e = u * u * (3 - 2 * u);
    vm.base.pos.lerpVectors(p0, p1, e).y += 0.1 * Math.sin(Math.PI * Math.min(1, u * 1.6));
    vm.base.rot.setFromQuaternion(new THREE.Quaternion().slerpQuaternions(q0, q1, e), 'YXZ');
    yield null;
  }
  // out of sight: the gun's own lens, and up to the shoulder
  H.studyFov = false;
  vm.base.pos.copy(R.vmBase0.pos); vm.base.rot.copy(R.vmBase0.rot);
  vm.lowerTo(1, true);
  vm.lowerTo(0);
  G.sfx.play('b7_bolt', null);
  G.weapon.fire = fire0;
  G.weapon.trigger = false;
  yield wait(0.35);
}

// [second pass] how well the men shoot (x the lights: 0.7 in the dark). The
// first pass had the scripted player hit by 2-7 % of their rounds and never
// down; these are about a tenth to a sixth up (a quarter up drew the cars
// beat out to a minute and a half: the scripted player backing off hurt)
const AIM = { cars: 1.4, doorways: 1.3, intruder: 1.5, el: 1.1, heavies: 1.2 };

// ---- 2. cars ------------------------------------------------------------------------------------
function* carsBeat(ctx) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const cars = [];
  // (Dot hears them first: down behind the counter)
  const dot = ctx.cast.get('dot');
  if (dot) R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; if (dot.state !== 'duck') dot.setState('duck'); return false; })(2.2));
  SITE.cars.forEach((spec, i) => {
    R.ticks.push(((t0) => (dt) => {
      if ((t0 -= dt) > 0) return true;
      const car = R.rails.spawn({ rail: spec.rail, lights: true, v0: 14, cruise: 14, decel: 8.5, lat: 6 });
      car.b7beat = 'cars';
      R.cars['car' + i] = car;
      cars[i] = car;
      car.meshes.lens.material = S.M.headlamp;
      car.rail.onStop = (c) => { G.sfx.play('b7_brake', c.pos.clone().setY(0.4)); arrived(ctx, c, i); };
      car.rail.onBrake = null;
      return false;
    })(spec.delay));
  });
  // (the brakes screech as they swing in)
  let screeched = [false, false];
  const tick = () => {
    cars.forEach((c, i) => {
      if (!c || screeched[i] || !c.rail) return;
      if (c.rail.L - c.rail.s < 16 && c.rail.v > 6) { screeched[i] = true; G.sfx.play('b7_skid', c.pos.clone().setY(0.4), { dur: 1.3 }); }
    });
    return !(screeched[0] && screeched[1]);
  };
  R.ticks.push(tick);
  yield until(() => cars[0] && cars[1] && cars[0].rail.done && cars[1].rail.done);
  const t0 = G.time;
  G.director.level = 4;
  yield wait(2.5);
  // [second pass] (the beat has a floor: men shot as they step out do not
  // end it in ten seconds; the rain and the burning cars hold the gap)
  yield until(() => (G.director.alive('cars') <= 2 && G.time - t0 > CARS_MIN) || G.time - t0 > 50);
}
const CARS_MIN = 15;

// a car at its stop: doors open, men out behind them, the first rounds into the glass
function arrived(ctx, car, i) {
  const G = ctx.game, R = rig();
  R.rails.settle(car);
  const specs = SITE.carMen.filter((m) => m.car === i);
  G.director.run(function* (d) {
    for (const m of specs) {
      yield d.wait(m.delay);
      if (car.state === 'burning') continue;
      const door = R.rails.openDoor(car, m.door);
      G.sfx.play('b7_carDoor', car.pos.clone().setY(1));
      yield d.wait(0.18);
      R.rails.doorBox(car, door);
      const D = DOORS[m.door];
      const L = (x, z) => V(x, 0, z).applyMatrix4(car.group.matrixWorld);
      const out = L(D.hinge[0] - 0.45, D.side * 1.25);
      const post = m.post === 'door' ? L(D.hinge[0] - 0.62, D.side * 1.28) : m.post === 'nose' ? L(2.9, -0.7 * D.side) : m.post === 'tail' ? L(-2.95, -0.55 * D.side) : m.post;
      const h = man(ctx, { group: 'cars', at: { x: out.x, z: out.z }, entry: [{ x: post.x, z: post.z }], run: m.run ?? false, post: { x: post.x, z: post.z }, leash: m.leash, heavy: m.heavy, aim: AIM.cars });
      h.yaw = Math.atan2(G.eye.x - h.pos.x, G.eye.z - h.pos.z);
      h.setState('stepOut', 0.1);
      // the first rounds: into the diner's glass, pane by pane
      suppress(ctx, h, 2 + (m.heavy ? 5 : 2), 0.9 + m.delay);
      // (and the first man of the lead car puts out a lamp over the booths)
      if (i === 0 && m === specs[0]) shootPendant(ctx, h, 3.6);
    }
    R.rails.settle(car);
  });
}

// a man's first rounds go into the windows (whatever glass is still whole)
function suppress(ctx, h, n, delay) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const front = S.part('dinerFront');
  let t = delay, left = n;
  R.ticks.push((dt) => {
    if (!h.alive || left <= 0) return false;
    if ((t -= dt) > 0) return true;
    const panes = Object.values(front.panes).filter((p) => p.state !== 'gone');
    if (!panes.length) return false;
    const r = ctx.rng;
    const p = panes[Math.floor(r.next() * panes.length)];
    const c = p.centre || p.center || (p.mesh ? p.mesh.getWorldPosition(new THREE.Vector3()) : null);
    if (!c) return false;
    const target = c.clone().add(V(0, r.range(-0.5, 0.6), r.range(-(p.w || 1) * 0.35, (p.w || 1) * 0.35)));
    // (the first round stars the pane; the next brings it down)
    const R2 = rig(), k = (R2.paneRounds || (R2.paneRounds = new Map())).get(p) || 0;
    R2.paneRounds.set(p, k + 1);
    roundAt(G, h, target, { heavy: !!h.heavy, shatter: k >= 1 });
    left--;
    t = h.heavy ? r.range(0.08, 0.12) : r.range(0.35, 0.6);
    return true;
  });
}

// a round at the pendant over the booths nearest the windows: it goes out
// in sparks and swings on its cord
function shootPendant(ctx, h, delay) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const d = S.part('diner');
  let t = delay;
  R.ticks.push((dt) => {
    if ((t -= dt) > 0) return true;
    if (!h.alive) return false;
    const lamps = d.lamps.filter((l) => !l.dead && l.head.x > -12.2).sort((a, b) => Math.hypot(a.head.x - h.pos.x, a.head.z - h.pos.z) - Math.hypot(b.head.x - h.pos.x, b.head.z - h.pos.z));
    const l = lamps[0];
    if (!l) return false;
    roundAt(G, h, l.head.clone());
    if (!l.dead) {
      const dir = l.head.clone().sub(h.pos).setY(0).normalize();
      S.lamps.shootOut(l, dir);
      if (l.swing) l.swing(dir.multiplyScalar(1.4));
    }
    return false;
  });
}

// ---- 3. doorways -------------------------------------------------------------------------------
function* doorways(ctx) {
  const G = ctx.game;
  // (louder: three men may fire at once from here on)
  G.director.level = 5;
  for (const m of SITE.doorways) {
    man(ctx, { group: 'doorways', at: m.at, entry: m.entry, run: true, post: m.post, leash: m.leash, heavy: m.heavy, aim: AIM.doorways });
    yield wait(1.1);
  }
  yield wait(2.5);
  // the close one: out of the side alley, down the pavement, in at the door
  const I = SITE.intruder;
  const h = man(ctx, { group: 'doorways', at: I.at, entry: I.entry, run: true, post: I.post, leash: 0, aim: AIM.intruder });
  h.b7intruder = true;
  // [second pass] heard before he is seen: his shoes on the stoop, three
  // heavy steps up to the door before its bell
  const door = V(-9.3, 0, 0.6);
  let stepT = 0, steps = 0;
  rig().ticks.push((dt) => {
    if (!h.alive || steps >= 3 || h.pos.x < -10.3) return false;
    const d = Math.hypot(h.pos.x - door.x, h.pos.z - door.z);
    if (d > 4.2) return true;
    if ((stepT -= dt) > 0) return true;
    stepT = 0.34;
    steps++;
    G.sfx.play('b7_step', h.pos.clone().setY(0.2), { k: 0.8 + 0.1 * steps });
    return true;
  });
  const t0 = G.time;
  yield until(() => G.director.alive('doorways') <= 1 || G.time - t0 > 45);
}

// ---- 4. el ----------------------------------------------------------------------------------------
function* elBeat(ctx) {
  const G = ctx.game, R = rig();
  const E = SITE.el;
  const h = man(ctx, { group: 'el', at: { x: E.x, z: E.z }, heavy: true, brain: 'b7_el', aim: AIM.el, hp: 1e6, opts: { deckY: E.y, onFall: (hd) => overTheRail(ctx, hd) } });
  h.surface = () => E.y;
  h.pos.y = E.y;
  const t0 = G.time;
  yield until(() => G.director.alive('el') === 0 || G.time - t0 > 35);
  yield wait(1.5);
}

// hit, he goes over the rail and down onto a car's roof (or the street)
function overTheRail(ctx, h) {
  const G = ctx.game, R = rig();
  const cars = Object.values(R.cars).filter((c) => c.state !== 'dead');
  let best = null, bd = 6;
  for (const c of cars) { const d = Math.hypot(c.pos.x - h.pos.x, c.pos.z - h.pos.z); if (d < bd) { bd = d; best = c; } }
  // (onto the nearest part of its cabin's roof)
  let land = V(h.pos.x - 1.6, 0, h.pos.z);
  if (best) {
    const lp = G.stage.cars.local(best, V(h.pos.x, 1, h.pos.z), new THREE.Vector3());
    lp.set(Math.max(-1.5, Math.min(0.5, lp.x)), 1.6, Math.max(-0.45, Math.min(0.45, lp.z)));
    land = lp.applyMatrix4(best.group.matrixWorld).setY(0);
  }
  const top = best ? (best.state === 'burning' ? 1.25 : 1.68) : 0;
  const p0 = h.pos.clone(), y0 = h.pos.y;
  // over the rail first (0.4 s: he tips over it, outward), then the drop
  const out = V(land.x - p0.x, 0, land.z - p0.z).normalize();
  const p1 = p0.clone().addScaledVector(out, 0.75);
  const y1 = y0 - 0.5, T1 = 0.4;
  const T2 = Math.sqrt(2 * Math.max(0.1, y1 - top) / 9.8);
  let t = 0, landed = false;
  h.script = (hd, tt, dt) => {
    if (landed) return;
    t += dt;
    let x, z, y;
    if (t < T1) {
      const u = t / T1, e = u * u * (3 - 2 * u);
      x = p0.x + (p1.x - p0.x) * e; z = p0.z + (p1.z - p0.z) * e;
      y = y0 + 0.25 * Math.sin(Math.PI * u * 0.8) - 0.5 * u * u;
    } else {
      const u = Math.min(1, (t - T1) / T2);
      x = p1.x + (land.x - p1.x) * u; z = p1.z + (land.z - p1.z) * u;
      y = Math.max(top, y1 - 4.9 * (t - T1) * (t - T1));
    }
    hd.pos.x = x; hd.pos.z = z;
    hd.surface = () => y;
    if (t > T1 && y <= top + 1e-3) {
      landed = true;
      hd.surface = () => top;
      G.sfx.play('b7_bodyRoof', hd.pos.clone().setY(top), { k: best ? 1 : 0.6 });
      if (best && best.rail) R.rails.bump(best, -0.9);
      if (best && best.state !== 'burning') { const i = best.panes.findIndex((p) => !p.broken); if (i >= 0) G.stage.cars.shatter(best, i, 1.4); }
    }
  };
}

// ---- 5. driveby ----------------------------------------------------------------------------------
function* driveby(ctx) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const D = SITE.driveby;
  const car = R.rails.spawn({ rail: D.pass1, lights: true, v0: 15, cruise: 15.5, stop: false, lat: 7.5, decel: 7, accel: 5 });
  car.b7beat = 'driveby';
  R.cars.driveby = car;
  car.meshes.lens.material = S.M.headlamp;
  // the driver and the man with the Tommy gun at the back window, my side
  const seat = (lx, lz) => V(lx, 0, lz).applyMatrix4(car.group.matrixWorld);
  const driver = man(ctx, { group: 'driveby', at: seat(0.1, -0.35), brain: 'none', hp: 60 });
  const gunner = man(ctx, { group: 'driveby', at: seat(-0.85, 0.35), heavy: true, brain: 'none', hp: 70 });
  for (const h of [driver, gunner]) { h.setState('sitCar', 0); if (h.collider) h.collider.r = 0.01; }
  car.b7riders = [driver, gunner];
  const ai = { h: gunner, heavy: true, aim: 0 };
  let fireT = 0, burst = 0, rounds = 0, crashed = false;
  const r = ctx.rng;
  car.rail.riders.push((c, dt, t) => {
    const M = c.group.matrixWorld;
    for (const [h, lx, lz] of [[driver, 0.12, -0.36], [gunner, -0.82, 0.3]]) {
      if (!h.alive && h._deathT > 0.4) continue;
      const p = _p.set(lx, 0, lz).applyMatrix4(M);
      h.pos.x = p.x; h.pos.z = p.z;
      const y = p.y + 0.3;
      h.surface = () => y;
      h.yaw = c.yaw + (h === gunner ? 0.0 : -Math.PI / 2);
      if (h === gunner && h.alive) h.lookAt(G.eye.clone().setY(G.eye.y - 0.3));
    }
    if (c.state === 'burning' || crashed) return;
    // crippled: the driver hit, or the engine: off the rail into a post
    if (!driver.alive || c.pts >= 6) {
      const ahead = V(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
      // (the one it swerves least for: a post on its own side before a
      // column across the road)
      let best = null, bs = Infinity;
      for (const q of [...D.posts, ...COLUMNS]) {
        const dx = q.x - c.pos.x, dz = q.z - c.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 5 || dd > 30 || (dx * ahead.x + dz * ahead.z) / dd < 0.35) continue;
        const score = dd + 2 * Math.abs(dx * ahead.z - dz * ahead.x);
        if (score < bs) { bs = score; best = q; }
      }
      crashed = true;
      c.rail.onCrash = (cc, at) => wrecked(ctx, cc, at);
      if (best) R.rails.crash(c, { at: best });
      else { c.rail.plan.v.fill(0); c.rail.onStop = () => wrecked(ctx, c, c.pos); }
      return;
    }
    // the Tommy gun from the window along the diner's front
    const near = c.pos.x < 7 && c.pos.z > -16 && c.pos.z < 14 && gunner.alive;
    if (!near) { if (burst) { burst = 0; gunner.setAim(false); } return; }
    if (!burst) { burst = 1; gunner.setAim(true); fireT = 0.25; }
    fireT -= dt;
    if (fireT > 0) return;
    fireT = r.range(0.085, 0.11);
    rounds++;
    if (rounds % 2) {
      // (the first rounds are the tell: they chew the front, not me)
      ai.aim = rounds < 7 ? 0 : 0.55;
      G.hoodFire(ai, t);
    } else {
      const z = c.pos.z + r.range(-2.5, 2.5);
      roundAt(G, gunner, V(DINER.faceX + 0.05, r.range(0.5, 3.1), z), { heavy: true });
    }
  });
  // when it has gone (down the avenue) or burned
  const t0 = G.time;
  yield until(() => car.rail.done || car.state === 'burning' || G.time - t0 > 45);
  if (car.rail.done && car.state !== 'burning' && !crashed) {
    // (off the end of its rail: gone down the avenue)
    for (const h of [driver, gunner]) G.removeHood(h);
    R.rails.remove(car);
    delete R.cars.driveby;
  } else yield wait(3.5);
}
const _p = new THREE.Vector3();
const COLUMNS = [{ x: 11.8, z: 1.6 }, { x: 10.6, z: -9.9 }, { x: 13.0, z: 13.1 }, { x: 9.6, z: -21.4 }];

function wrecked(ctx, car, at) {
  const G = ctx.game, S = ctx.stage;
  G.sfx.play('b7_crash', car.pos.clone().setY(0.8));
  G.controller.shake(0.5, car.pos.distanceTo(G.eye));
  // a lamp post it went into goes dark
  for (const l of S.lamps.lamps) if (l.kind === 'post' && Math.hypot(l.head.x - 1.5 - at.x, l.head.z - at.z) < 3 && !l.dead) S.lamps.shootOut(l, V(0, 0, 1));
  car.rail.engine = false;
  S.cars.startSmoke(car, 2.2);
  // (whoever was in it does not get out)
  for (const h of car.b7riders || []) if (h.alive) G.killHood(h, V(0, 0.3, 1).normalize(), false, 'deathBack');
  const R = rig();
  R.rails.settle(car);
}

// ---- 6. the Cardinal ---------------------------------------------------------------------------------
function* cardinal(ctx) {
  const G = ctx.game, S = ctx.stage, R = rig();
  // (the last of the others first: whoever is left after a while pulls back
  // down the avenue, so the quiet is a quiet)
  const t0 = G.time;
  yield until(() => G.director.alive() === 0 || G.time - t0 > 15);
  scatter(ctx);
  yield until(() => G.director.alive() === 0);
  // a quiet, long enough to hear the rain (no fight in it)
  R.calm = true;
  G.music.stop(4);
  yield wait(7);
  const car = R.rails.spawn({ rail: SITE.saloon.rail, lights: true, v0: 7, cruise: 7, decel: 2.2, lat: 4, armored: true });
  car.b7beat = 'cardinal';
  R.cars.saloon = car;
  car.meshes.lens.material = S.M.headlamp;
  yield until(() => car.rail.done);
  G.sfx.play('b7_handbrake', car.pos.clone().setY(0.6));
  R.rails.settle(car);
  yield wait(1.0);
  const L = (x, z) => V(x, 0, z).applyMatrix4(car.group.matrixWorld);
  for (const hv of SITE.heavies) {
    const door = R.rails.openDoor(car, hv.door, { speed: 3 });
    G.sfx.play('b7_carDoor', car.pos.clone().setY(1));
    yield wait(0.25);
    R.rails.doorBox(car, door);
    const D = DOORS[hv.door];
    const out = L(D.hinge[0] - 0.45, D.side * 1.25);
    const h = man(ctx, { group: 'cardinal', at: { x: out.x, z: out.z }, entry: hv.entry, post: hv.post, leash: hv.leash, heavy: true, aim: AIM.heavies });
    h.setState('stepOut', 0.1);
    R.calm = false;
    yield wait(0.7);
  }
  yield wait(1.3);
  // then him
  const door = R.rails.openDoor(car, SITE.cardinal.door, { speed: 2.2 });
  G.sfx.play('b7_carDoor', car.pos.clone().setY(1));
  yield wait(0.6);
  R.rails.doorBox(car, door);
  R.rails.settle(car);
  const D = DOORS[SITE.cardinal.door];
  const out = L(D.hinge[0] - 0.4, D.side * 1.3);
  const him = spawnCardinal(ctx, out);
  R.cardinal = him;
  yield until(() => him.b7down);
}

// room to fall back: the street behind a man (as killHood will turn him to
// the shot) clear of cars, walls and posts for a body's length
function fallRoom(S, h, dir) {
  const from = Math.atan2(-dir.x, -dir.z);
  let d = from - h.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  const yaw = h.yaw + Math.max(-0.25, Math.min(0.25, d * 0.3));
  const back = V(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (const L of [0.6, 1.2, 1.8, 2.2]) {
    const p = h.pos.clone().addScaledVector(back, L);
    for (const b of S.colliders.boxes) {
      const dx = p.x - b.cx, dz = p.z - b.cz, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      if (Math.hypot(Math.max(0, Math.abs(lx) - b.hx), Math.max(0, Math.abs(lz) - b.hz)) < 0.3) return false;
    }
    for (const c of S.colliders.circles) if (c.tag !== 'hood' && c !== h.collider && Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.3) return false;
  }
  return true;
}

// him: the cast kind 'cardinal' (else a heavy Hood, unarmed, as a stand-in),
// made to be shot like a Hood, with his own brain
function spawnCardinal(ctx, at) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const toDoor = SITE.cardinal.path[0];
  const yaw = Math.atan2(toDoor.x - at.x, toDoor.z - at.z);
  let fig;
  const W = { total: 15, slow: 5, knee: 10 };
  const onWound = (h, { wounds, dir }) => {
    const B = G.ais.get(h) && G.ais.get(h).brain;
    if (!B) return;
    if (B.stage === 0 && wounds >= W.slow) B.stage = 1;
    if (B.stage === 1 && wounds >= W.knee) {
      B.stage = 2;
      // a knee goes: down on it a moment, then up and on, slower
      h.speed = 0;
      if (h.anim.bank && h.anim.bank.has('cardinal_knee')) { B.hold = 1.8; h.state = 'cardinal_knee'; h._b7clip = null; h.anim.play('cardinal_knee', { fade: 0.12 }); }
      else { B.hold = 1.2; h.stagger(); }
      G.sfx.play('grunt', h.pos.clone().setY(1.2), { f0: 70, k: 0.5, dur: 0.3 });
    }
    if (wounds >= W.total && !h.b7down) {
      h.b7down = true;
      // [second pass] he falls back, away from my rounds, when there is
      // street behind him; with his car or a wall at his back he goes down
      // on his knees and forward instead (never back into the saloon)
      const d0 = dir || V(1, 0, 0), back = fallRoom(S, h, d0);
      G.killHood(h, d0, false, back ? 'deathBack' : 'deathKnees');
      endHat(ctx, h, { forward: !back });
    }
  };
  if (ctx.cast.has('cardinal')) {
    const c = ctx.cast.spawn('cardinal', { at: { x: at.x, z: at.z }, yaw });
    fig = c.fig;
    // (shot like a Hood: in the stage's Hoods, drawn and stepped by them)
    c.own = false;
    S.hoods.list.push(fig);
    fig.hp = 1e6;
    fig.heavy = false;
    G.ais.set(fig, makeBrain(G, fig, 'b7_cardinal', { path: SITE.cardinal.path, onWound, aim: 0.7 }));
    fig.b7char = c;
  } else {
    fig = man(ctx, { group: 'cardinal', at: { x: at.x, z: at.z }, yaw, heavy: true, variant: { unarmed: true, coat: 0, brim: 1, tall: 1 }, brain: 'b7_cardinal', hp: 1e6, aim: 0.7, opts: { path: SITE.cardinal.path, onWound } });
  }
  fig.b7beat = 'cardinal';
  G.director.groups.get('cardinal') ? G.director.groups.get('cardinal').push(fig) : G.director.groups.set('cardinal', [fig]);
  return fig;
}

// ---- 7. the end ----------------------------------------------------------------------------------------
function* ending(ctx) {
  const G = ctx.game, R = rig();
  const frameNow = Q().get('b7frame') === '1';
  if (ctx.flags.endJump) {
    // (a jump: he falls where the story has him fall, as the beat begins)
    const P = SITE.cardinal.path;
    const him = spawnCardinal(ctx, { x: P[1].x + 0.4, z: P[1].z + 1.2 });
    him.yaw = Math.atan2(P[2].x - P[1].x, P[2].z - P[1].z);
    him.b7down = true;
    G.killHood(him, V(-Math.sin(him.yaw), 0, -Math.cos(him.yaw)), false, 'deathBack');
    endHat(ctx, him);
  }
  // the last of them: with him down the rest break and run (no man I
  // cannot find holds the ending)
  scatter(ctx);
  yield until(() => G.director.alive() === 0);
  yield wait(1.2);
  // the gun lowers by itself; it will not fire again (the fight is over)
  R.calm = true;
  G.weapon.trigger = false;
  R.fire0 = G.weapon.fire;
  G.weapon.fire = () => {};
  G.vm.lowerTo(0.62);
  const hat = R.hat;
  // behind me, once I am out on the street: Dot's shape in the broken window
  // (she comes up from behind the counter while I am not looking)
  const dotAt = () => {
    const dot = ctx.cast.get('dot');
    if (!dot || R.dotOut) return true;
    const e = G.eye, bay = DINER.bays[mackWindow(G)];
    const w = V(-11.15, 1.4, bay + 0.35);
    const look = V(-Math.sin(G.controller.yaw), 0, -Math.cos(G.controller.yaw));
    const to = V(w.x - e.x, 0, w.z - e.z);
    if (!frameNow && (e.x < -9.6 || look.dot(to.normalize()) > 0.2)) return true;
    R.dotOut = true;
    dot.place({ x: w.x, z: w.z }, Math.PI / 2);
    dot.setState('watch');
    return false;
  };
  // [second pass] (she walks there, out from behind the counter, while I go
  // out to him: the look-development jump still places her at once)
  if (frameNow) R.ticks.push(dotAt); else runGen(dotToWindow(ctx));
  // I walk out to it
  let idle = 0;
  if (frameNow) { yield wait(2.5); yield* theFrame(ctx); return; }
  yield until(() => {
    idle += 1 / 60;
    const e = G.eye;
    const d = hat ? Math.hypot(e.x - hat.rest.x, e.z - hat.rest.z) : 0;
    if (idle > 9 && hat) G.hud.prompt('WASD  out to him', G.screenOf(hat.rest.clone().setY(0.2)), 'scene'); else G.hud.clearPrompt('scene');
    return !hat || d < 2.4;
  });
  G.hud.clearPrompt('scene');
  // the frame: down at the hat and the ember, the lamp's cone beyond it
  yield* theFrame(ctx);
}

// [second pass] Dot, out from behind the counter to the broken window while
// I go out to him: round the end of the counter, across the aisle, to the
// glass; she turns to the street there and watches (no placing her unseen)
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
  // (up from the crouch first)
  dot.setState('idle', 0.35);
  for (let t = 0; t < 0.5; t += 1 / 60) yield null;
  for (const p of pts) yield* dot.walkTo(p, { speed: 1.35 });
  const y0 = dot.yaw, dy = Math.atan2(Math.sin(Math.PI / 2 - y0), Math.cos(Math.PI / 2 - y0));
  for (let t = 0; t < 0.45; t += 1 / 60) { const u = t / 0.45; dot.yaw = y0 + dy * u * u * (3 - 2 * u); yield null; }
  dot.yaw = Math.PI / 2;
  dot.setState('watch', 0.4);
}

// the men still up break off: they run from me, by the Hoods' grid (round
// the cars and the columns, never through them), back into the dark under
// the el's far side where they came from, and on down the avenue; a man is
// gone only once I cannot see him (out of the frame or behind something),
// never in view [second pass]
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();
function inSight(G, h) {
  const cam = G.camera;
  _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_pm);
  const c = new THREE.Vector3(h.pos.x, (h.pos.y || 0) + 1.2, h.pos.z);
  if (!_fr.containsPoint(c)) return false;
  const d = c.clone().sub(G.eye), L = d.length();
  if (L > 55) return false;
  d.divideScalar(L);
  return !G.rays.raycast(G.eye, d, Math.max(0.1, L - 0.5), { anyHit: true, skip: (en) => !!(en.mesh.userData.pane) });
}
function scatter(ctx) {
  const G = ctx.game, S = ctx.stage, R = rig();
  for (const h of [...S.hoods.list]) {
    if (!h.alive || h.b7char || h.b7flee || h.b7down) continue;
    h.b7flee = true;
    const ai = G.ais.get(h);
    if (ai && ai.release) ai.release();
    G.ais.delete(h);
    if (h.setAim) h.setAim(false);
    if (h.lookAt) h.lookAt(null);
    // (a man on the el's deck has nowhere to run: he is gone when unseen)
    const onDeck = (h.pos.y || 0) > 3;
    const down = h.pos.z < G.eye.z ? -1 : 1;
    const goals = [{ x: 18.5, z: Math.max(-40, Math.min(18, h.pos.z + down * 6)) }, { x: 18.5, z: -60 }];
    let path = null, pi = 0, gi = 0, t = 0, stuck = 0, last = h.pos.clone(), unseen = 0;
    const plan = () => { const g = goals[Math.min(gi, goals.length - 1)]; path = G.nav.findPath(h.pos.x, h.pos.z, g.x, g.z); pi = 0; };
    if (!onDeck) plan();
    h.script = (hd, tt, dt) => {
      if (!hd.alive) { hd.script = null; return; }
      t += dt;
      if (onDeck || !path) { hd.speed = 0; return; }
      let wp = path[pi];
      while (wp && Math.hypot(wp.x - hd.pos.x, wp.z - hd.pos.z) < 0.6) wp = path[++pi];
      if (!wp) {
        // (the last goal reached: he stands in the dark there until unseen)
        if (++gi >= goals.length) { path = null; hd.speed = 0; hd.setState('idle', 0.3); return; }
        plan(); return;
      }
      const yaw = Math.atan2(wp.x - hd.pos.x, wp.z - hd.pos.z);
      const dy = Math.atan2(Math.sin(yaw - hd.yaw), Math.cos(yaw - hd.yaw));
      hd.yaw += dy * Math.min(1, dt * 7);
      if (hd.state !== 'run') hd.setState('run', 0.2);
      hd.speed = Math.abs(dy) > 1.2 ? 1.2 : 3.1;
      // (stuck on something: the way again)
      if ((stuck += dt) > 1.2) { if (hd.pos.distanceTo(last) < 0.4) plan(); stuck = 0; last.copy(hd.pos); }
    };
    R.ticks.push((dt) => {
      if (!S.hoods.list.includes(h)) return false;
      if (!h.alive) { h.script = null; return false; }
      unseen = inSight(G, h) ? 0 : unseen + dt;
      // gone once out of sight a moment (well off, or after a little run),
      // and at the very last whatever: nobody holds the end
      if ((unseen > 0.25 && (t > 1.5 || Math.hypot(h.pos.x - G.eye.x, h.pos.z - G.eye.z) > 24)) || t > 20) { G.removeHood(h); return false; }
      return true;
    });
  }
}

// a place a man can kneel: clear of the cars, the walls and the posts
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
  // down on one knee by his head, looking past it along the way he came: the
  // hat and the ember low in the frame, the wet street, the lamp beyond
  const at = hat ? hat.rest.clone() : V(-5.6, 0, -11);
  const fwd0 = hat ? (hat.view || hat.fwd) : V(-0.4, 0, 0.92);
  // (the way it looks turned, if it must be, until the eye stands clear of
  // cars, walls and posts)
  let fwd = fwd0, eye = null;
  for (const a of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) {
    const f = fwd0.clone().applyAxisAngle(V(0, 1, 0), a), sd = V(f.z, 0, -f.x);
    const e = at.clone().addScaledVector(f, 1.2).addScaledVector(sd, 0.28);
    if (standClear(G.stage, e)) { fwd = f; eye = e; break; }
  }
  const side = V(fwd.z, 0, -fwd.x);
  if (!eye) eye = at.clone().addScaledVector(fwd, 1.2).addScaledVector(side, 0.28);
  eye.y = G.stage.surfaceY(eye.x, eye.z) + 1.08;
  const lookAt = at.clone().addScaledVector(fwd, -1.25).addScaledVector(side, -0.1);
  lookAt.y = 0.1;
  const yaw = Math.atan2(-(lookAt.x - eye.x), -(lookAt.z - eye.z));
  const pitch = Math.atan2(lookAt.y - eye.y, Math.hypot(lookAt.x - eye.x, lookAt.z - eye.z));
  const to = { x: eye.x, y: eye.y, z: eye.z, yaw, pitch };
  const dur = 2.6;
  C.setMode('cutscene', { ease: 0.01, track: (t) => {
    const u = Math.min(1, t / dur), k = u * u * (3 - 2 * u);
    const L = (a, b) => a + (b - a) * k;
    const dy = Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw));
    return { x: L(from.x, to.x), y: L(from.y, to.y), z: L(from.z, to.z), yaw: from.yaw + dy * k, pitch: L(from.pitch, to.pitch) - 0.02 * Math.sin(Math.min(1, t / 9) * Math.PI) };
  } });
  G.vm.lowerTo(1);
  // the el train goes over
  G.director.cue('train', { z: at.z + 10, ahead: 40, dir: -1 });
  yield wait(dur);
  G.music.cue('end', { fade: 3 });
  yield wait(6);
  G.state = 'end';
  C.frozen = true;
  G.hud.clearPrompt();
  G.hud.showEnd({ kind: 'end', epi: '', go: 'click for the title' });
  // (the card's click goes back to the title, as the slice's did)
  G.hud.endKind = 'cont';
  if (G.save) { G.save.flags.ended = true; G.save.write(); }
  if (!G.shotMode && typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
}
