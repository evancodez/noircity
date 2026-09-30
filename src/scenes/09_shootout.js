import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { makeBrain } from '../enemies/HoodBrains.js';
import { SITE, BEATS, DINER, DOORS } from './shootout/site.js';
import { stageBeat, rig, markBeat, man, setLights, roundAt, everyStep, RESERVE, V } from './shootout/rig.js';
import { endHat } from './shootout/ending.js';
import { DOT_CLIP, dotGunAt, dotDrumsAt } from '../cast/kinds/cardinal.js';

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
    onUse: () => (R.gun.stack.visible ? scoop(ctx) : dotSlides(ctx)),
  });
}

// the drums on the counter into my coat: the gun dips as the other arm
// rakes them off the counter's edge; they go down out of the frame
function scoop(ctx) {
  const G = ctx.game, R = rig();
  const st = R.gun.stack;
  if (!st.visible) return;
  R.slide = { t: 0 };
  R.reserve = Math.min(RESERVE.max, R.reserve + RESERVE.slide);
  R.stackReady = false;
  G.sfx.play('b7_drumTake', null);
  G.vm.lowerTo(0.28);
  const p0 = st.position.clone(), eye = G.eye.clone();
  const toward = V(eye.x - p0.x, 0, eye.z - p0.z).normalize();
  const edge = p0.clone().addScaledVector(toward, Math.max(0.05, (DINER.counter.frontX - p0.x) / Math.max(0.2, toward.x)));
  let t = 0, vy = 0;
  R.ticks.push((dt) => {
    t += dt;
    if (t < 0.14) st.position.lerpVectors(p0, edge, t / 0.14);
    else { vy -= 9.8 * dt; st.position.addScaledVector(toward, 1.4 * dt); st.position.y += vy * dt; st.rotation.z += dt * 3; }
    if (t > 0.2 && G.vm.lowerTarget > 0) G.vm.lowerTo(0);
    if (st.position.y < DINER.counter.topY - 0.55 || t > 0.6) { st.visible = false; st.rotation.set(0, 0, 0); R.slide = null; return false; }
    return true;
  });
}

// Dot comes up behind the counter and slides two drums over to me; they
// are raked off the counter's edge as they reach me
function dotSlides(ctx) {
  const G = ctx.game, R = rig();
  const dot = ctx.cast.get('dot');
  R.slide = { t: 0 };
  if (dot) dot.setState('lean');
  const st = R.gun.stack;
  const e = G.eye;
  const zTo = Math.max(DINER.counter.z0 + 0.4, Math.min(DINER.counter.z1 - 0.4, e.z));
  const from = V(DINER.counter.frontX - DINER.counter.depth + 0.08, DINER.counter.topY, zTo), to = V(DINER.counter.frontX - 0.2, DINER.counter.topY, zTo);
  st.position.copy(from); st.rotation.set(0, 0, 0); st.visible = true;
  G.sfx.play('b7_drumSlide', from);
  R.ticks.push((dt) => {
    R.slide.t += dt;
    const u = Math.min(1, R.slide.t / 0.45), k = 1 - (1 - u) * (1 - u);
    st.position.lerpVectors(from, to, k);
    if (u >= 1) {
      R.slide = null;
      if (dot && ctx.beat !== 'arrive') dot.setState('duck');
      R.stackReady = true;
      scoop(ctx);
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
  const _m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const onCounter = () => {
    cam.updateWorldMatrix(true, false); mesh.updateWorldMatrix(true, false);
    _m.copy(cam.matrixWorld).invert().multiply(mesh.matrixWorld).decompose(p, q, sc);
    vm.base.pos.copy(p); vm.base.rot.setFromQuaternion(q, 'YXZ');
  };
  // (a man leans over the counter to take a thing lying at its far side:
  // the eye goes to it, and back as the gun comes up)
  const C = G.controller, P0 = C.eyePose();
  mesh.updateWorldMatrix(true, false);
  const at = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
  const dx = at.x - P0.x, dz = at.z - P0.z, dh = Math.hypot(dx, dz);
  const lean = Math.max(0, Math.min(0.42, dh - 0.85));
  const Pl = { x: P0.x + dx / dh * lean, y: P0.y - 0.12 * lean / 0.42, z: P0.z + dz / dh * lean, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(at.y - (P0.y - 0.1), Math.max(0.3, dh - lean)) + 0.12 };
  if (lean > 0.02) C.ease(Pl, 0.24);
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
  yield wait(0.35);
}

// ---- 2. cars ------------------------------------------------------------------------------------
function* carsBeat(ctx) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const cars = [];
  // (Dot hears them first: down behind the counter)
  const dot = ctx.cast.get('dot');
  if (dot) R.ticks.push(((t0) => (dt) => { if ((t0 -= dt) > 0) return true; dot.setState('duck'); return false; })(2.2));
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
  yield wait(2.5);
  yield until(() => G.director.alive('cars') <= 2 || G.time - t0 > 75);
}

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
      const h = man(ctx, { group: 'cars', at: { x: out.x, z: out.z }, entry: [{ x: post.x, z: post.z }], run: m.run ?? false, post: { x: post.x, z: post.z }, leash: m.leash, heavy: m.heavy, aim: 0.9 });
      h.yaw = Math.atan2(G.eye.x - h.pos.x, G.eye.z - h.pos.z);
      h.setState('stepOut', 0.1);
      // the first rounds: into the diner's glass, pane by pane
      suppress(ctx, h, 2 + (m.heavy ? 5 : 2), 0.9 + m.delay);
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
    roundAt(G, h, target, { heavy: !!h.heavy });
    left--;
    t = h.heavy ? r.range(0.08, 0.12) : r.range(0.35, 0.6);
    return true;
  });
}

// ---- 3. doorways -------------------------------------------------------------------------------
function* doorways(ctx) {
  const G = ctx.game;
  for (const m of SITE.doorways) {
    man(ctx, { group: 'doorways', at: m.at, entry: m.entry, run: true, post: m.post, leash: m.leash, heavy: m.heavy, aim: 0.85 });
    yield wait(1.1);
  }
  yield wait(4.5);
  // the close one: out of the side alley, down the pavement, in at the door
  const I = SITE.intruder;
  const h = man(ctx, { group: 'doorways', at: I.at, entry: I.entry, run: true, post: I.post, leash: 0, aim: 1.1 });
  h.b7intruder = true;
  const t0 = G.time;
  yield until(() => G.director.alive('doorways') <= 1 || G.time - t0 > 70);
}

// ---- 4. el ----------------------------------------------------------------------------------------
function* elBeat(ctx) {
  const G = ctx.game, R = rig();
  const E = SITE.el;
  const h = man(ctx, { group: 'el', at: { x: E.x, z: E.z }, heavy: true, brain: 'b7_el', aim: 0.9, hp: 100, opts: { deckY: E.y, onFall: (hd) => overTheRail(ctx, hd) } });
  h.surface = () => E.y;
  h.pos.y = E.y;
  const t0 = G.time;
  yield until(() => G.director.alive('el') === 0 || G.time - t0 > 50);
  yield wait(1.5);
}

// hit, he goes over the rail and down onto a car's roof (or the street)
function overTheRail(ctx, h) {
  const G = ctx.game, R = rig();
  const cars = Object.values(R.cars).filter((c) => c.state !== 'dead');
  let best = null, bd = 6;
  for (const c of cars) { const d = Math.hypot(c.pos.x - h.pos.x, c.pos.z - h.pos.z); if (d < bd) { bd = d; best = c; } }
  const land = best ? best.pos.clone() : V(h.pos.x - 1.6, 0, h.pos.z);
  const top = best ? (best.state === 'burning' ? 1.25 : 1.68) : 0;
  const p0 = h.pos.clone(), y0 = h.pos.y;
  const T = Math.sqrt(2 * (y0 - top) / 9.8);
  let t = 0, landed = false;
  h.script = (hd, tt, dt) => {
    if (landed) return;
    t += dt;
    const u = Math.min(1, t / T);
    hd.pos.x = p0.x + (land.x - p0.x) * u;
    hd.pos.z = p0.z + (land.z - p0.z) * u;
    const y = Math.max(top, y0 + 1.2 * t - 4.9 * t * t);
    hd.surface = () => y;
    if (t > 0.2 && y <= top + 1e-3) {
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
      let best = null, bd = 30;
      for (const q of [...D.posts, ...COLUMNS]) {
        const dx = q.x - c.pos.x, dz = q.z - c.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 5 || dd > bd || (dx * ahead.x + dz * ahead.z) / dd < 0.35) continue;
        bd = dd; best = q;
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
  const R = rig();
  R.rails.settle(car);
}

// ---- 6. the Cardinal ---------------------------------------------------------------------------------
function* cardinal(ctx) {
  const G = ctx.game, S = ctx.stage, R = rig();
  // a quiet, long enough to hear the rain
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
    const h = man(ctx, { group: 'cardinal', at: { x: out.x, z: out.z }, entry: hv.entry, post: hv.post, leash: hv.leash, heavy: true, aim: 0.75 });
    h.setState('stepOut', 0.1);
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
      B.hold = 1.5;
      h.speed = 0;
      if (h.anim.clips.cardinal_knee || (h.anim.bank && h.anim.bank.has('cardinal_knee'))) { h.state = 'cardinal_knee'; h.anim.play('cardinal_knee', { fade: 0.12 }); }
      else h.stagger();
      G.sfx.play('grunt', h.pos.clone().setY(1.2), { f0: 70, k: 0.5, dur: 0.3 });
    }
    if (wounds >= W.total && !h.b7down) {
      h.b7down = true;
      G.killHood(h, dir || V(1, 0, 0), false, 'deathBack');
      endHat(ctx, h);
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
  fig.setState('walk', 0.3);
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
  // the last of them
  yield until(() => G.director.alive() === 0);
  yield wait(1.2);
  // the gun lowers by itself; it will not fire again
  G.weapon.trigger = false;
  R.fire0 = G.weapon.fire;
  G.weapon.fire = () => {};
  G.vm.lowerTo(0.62);
  const hat = R.hat;
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

function* theFrame(ctx) {
  const G = ctx.game, R = rig(), C = G.controller;
  const hat = R.hat;
  const from = C.eyePose();
  // down on one knee by his head, looking past it along the way he came: the
  // hat and the ember low in the frame, the wet street, the lamp beyond
  const at = hat ? hat.rest.clone() : V(-5.6, 0, -11);
  const fwd = hat ? hat.fwd : V(-0.4, 0, 0.92), side = hat ? hat.side : V(0.92, 0, 0.4);
  const eye = at.clone().addScaledVector(fwd, 1.2).addScaledVector(side, 0.28);
  eye.y = G.stage.surfaceY(eye.x, eye.z) + 1.08;
  const lookAt = at.clone().addScaledVector(fwd, -2.3).addScaledVector(side, -0.12);
  lookAt.y = 0.28;
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
