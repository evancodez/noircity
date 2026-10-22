import * as THREE from 'three';
import { defineScene, beat } from '../game/script.js';
import { Cabin } from '../vehicles/cabin.js';
import { STARTS, START_DEFAULT, PAVE, RIVER, QUAY_OFF, SLIPS, PIERS } from '../world/plan.js';
import { riverNearest } from '../world/cityGen.js';
import { MapOverlay } from '../world/map.js';

// NOIR CITY's free roam (lane O1): the city, a car at the kerb, nothing I
// must do. Every critic and every later lane starts from here.
//   ?start=city                 at the default start (Grand Ave, under the el)
//   ?start=city&at=<id>         at a start of the plan (src/world/plan.js STARTS:
//                               grand clock tenements docks yards hill gasworks
//                               bridge river park)
// The verbs (WAVE_C §2, OPEN_WORLD §1): on foot WASD and the mouse, Shift
// runs; E at a car: in (any door: a cut eased into the seat); in the car W
// / S / A / D, SPACE the handbrake, E (stopped): out by the driver's door
// (or the other, if that one is against a wall); M: the map (and M again,
// or the pad's d-pad down). The river is the end: a car in it is lost ("The
// river took it."), a man in it swims to the nearest steps - the kit's
// black, and up on the quay by a car at the kerb. One card at the first
// need of each verb (the kit's teach); no objective line.
// Beats: roam (the start), ashore (out of the river, at the steps).
// game.city: { car, cabin, map, inCar, stream, ... } for the tools.
const _v = new THREE.Vector3();

function startOf() {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const id = q && q.get('at');
  return STARTS[id] ? id : START_DEFAULT;
}

// a car (the free roam's own: a coupe) at a place, and me beside it on foot
function place(ctx, at) {
  const G = ctx.game, stage = ctx.stage;
  const V = G.vehicles;
  const R = G.city || (G.city = {});
  V.clear();
  stage.part('stream').warmAround(at.car.x, at.car.z);
  const car = V.spawn('coupe', { at: new THREE.Vector3(at.car.x, 0, at.car.z), yaw: at.carYaw, lights: true });
  car.driver = null;
  V.player = null;
  R.car = car;
  R.inCar = false;
  R.cabin = stage._cabin || (stage._cabin = new Cabin(G));
  R.cabin.car = null;
  // (its lamps off while it stands: on as I get in)
  if (car.lamps && car.lamps.setOn) car.lamps.setOn(false);
  G.player.hands.equip('empty');
  G.setViewmodelVisible(false);
  ctx.controller.setPose(at.pos.x, at.pos.z, at.yaw, -0.06);
  stage.part('bounds').navAround(at.pos.x, at.pos.z, 14);
  R.stream = stage.part('stream');
}

export default defineScene({
  id: 'city', stage: 'noircity', title: '', name: 'Noir City',
  beats: ['roam', 'ashore'],
  // (M is the map here: Game.bindInput leaves the sound alone)
  mapKey: true,
  objectives: { roam: null, ashore: null },
  setup: {
    roam(ctx) {
      const a = ctx.stage.anchor(`city.start.${startOf()}`);
      place(ctx, { car: a.car, carYaw: a.carYaw, pos: a.pos, yaw: a.yaw });
    },
    // out of the river: on the quay at the nearest steps, a car at the kerb by them
    ashore(ctx) {
      const G = ctx.game, W = G.cityWet || { x: 300, z: 432 };
      const S = stepsNear(W.x, W.z);
      place(ctx, S);
    },
  },
  *script(ctx) {
    const G = ctx.game, R = G.city, hud = ctx.hud;
    yield beat(ctx.beat || 'roam');
    if (!R.map) R.map = new MapOverlay(ctx.stage.part('city').C);
    R.map.close();
    const T = { foot: 0, drive: 0, near: false };
    ctx.onStep((dt) => step(ctx, R, T, dt));
    for (;;) yield null;
    void hud;
  },
});

// ---- per step ------------------------------------------------------------------------------
function step(ctx, R, T, dt) {
  const G = ctx.game, C = ctx.stage.part('city').C, hud = ctx.hud, ctl = ctx.controller;
  if (G.failing || G.state !== 'playing') return;
  const car = R.car;
  // the map: M (the pad's d-pad down taps M)
  if (ctx.pressed('KeyM')) { const open = R.map.toggle(); ctl.frozen = open; if (car && R.inCar) { car.input.throttle = 0; car.input.brake = open ? 1 : 0; } }
  if (R.map.isOpen) { R.map.draw([{ x: G.eye.x, z: G.eye.z, yaw: ctl.yaw, kind: 'me' }, ...(car && !R.inCar ? [{ x: car.pos.x, z: car.pos.z, kind: 'car' }] : [])]); return; }
  if (R.inCar) {
    T.drive += dt;
    R.cabin.step(dt);
    // the river: the car in the water is lost
    if (C.inWater(car.pos.x, car.pos.z)) { wet(ctx, R, car.pos, 'The river took it.'); return; }
    const slow = Math.abs(car.speed) < 1.5;
    if (slow !== T.slowShown) { T.slowShown = slow; if (slow && T.drive > 0.6) hud.prompt('E  get out', null, 'cityout'); else hud.clearPrompt('cityout'); }
    if (T.drive > 2.5 && !T.taughtDrive) { T.taughtDrive = true; hud.teach('city_drive', '[W] drive  [SPACE] handbrake'); }
    if (T.drive > 25 && !T.taughtMap) { T.taughtMap = true; hud.teach('city_map', '[M] the map'); }
    if (slow && T.drive > 0.6 && ctx.pressed('KeyE')) getOut(ctx, R, T);
    return;
  }
  T.foot += dt;
  // on foot: the river (walked off a pier's end, down a slipway, the steps)
  if (C.inWater(ctl.pos.x, ctl.pos.z) && ctl.groundY < -0.6) { wet(ctx, R, ctl.pos, 'Into the river.'); return; }
  // E at the car: any door, looking at it, close by
  let near = false;
  if (car && car.solid !== false) {
    const l = car.local(ctl.pos, _v);
    const db = Math.hypot(Math.max(0, Math.abs(l.x) - car.spec.halfL), Math.max(0, Math.abs(l.z) - car.spec.halfW));
    if (db < 1.6) {
      const f = G.camera.getWorldDirection(new THREE.Vector3());
      const toX = car.pos.x - G.eye.x, toZ = car.pos.z - G.eye.z, tl = Math.max(0.05, Math.hypot(toX, toZ));
      const fl = Math.max(1e-3, Math.hypot(f.x, f.z));
      near = (toX * f.x + toZ * f.z) / (tl * fl) > 0.35 || db < 0.5;
    }
  }
  if (near !== T.near) { T.near = near; if (near) { hud.prompt('E  get in', null, 'cityin'); if (!T.taughtIn) { T.taughtIn = true; hud.teach('city_in', '[E] get in'); } } else hud.clearPrompt('cityin'); }
  if (near && ctx.pressed('KeyE')) getIn(ctx, R, T);
}

function getIn(ctx, R, T) {
  const G = ctx.game, car = R.car;
  ctx.hud.clearPrompt('cityin');
  T.near = false; T.drive = 0; T.slowShown = null;
  G.vehicles.setPlayer(car);
  if (car.lamps && car.lamps.setOn) car.lamps.setOn(true);
  // (eased into the seat: the camera never jumps)
  R.cabin.attach(car, { ease: 0.35 });
  R.inCar = true;
  G.sfx.play('tail_door', null, { open: false });
  ctx.stage.part('bounds').navAround(car.pos.x, car.pos.z, 14);
  G.emit('city:in', { car });
}

function getOut(ctx, R, T) {
  const G = ctx.game, car = R.car, C = ctx.stage.part('city').C;
  ctx.hud.clearPrompt('cityout');
  T.slowShown = null;
  car.input.throttle = 0; car.input.brake = 1; car.input.steer = 0; car.input.handbrake = 1;
  car.vel.set(0, 0, 0); car.yawRate = 0;
  // the driver's door (left), or the other if that is against a wall
  const col = ctx.stage.colliders;
  const tryDoor = (side) => {
    const p = car.world(-0.3, side * (car.spec.halfW + 0.75), new THREE.Vector3());
    const q = p.clone();
    col.resolve(q, 0.3);
    return { p: q, ok: q.distanceTo(p) < 0.15 && !C.inWater(q.x, q.z) };
  };
  let d = tryDoor(-1);
  if (!d.ok) { const e = tryDoor(1); if (e.ok) d = e; }
  R.inCar = false;
  car.driver = null;
  G.vehicles.player = null;
  G.player.hands.equip('empty');
  G.setViewmodelVisible(false);
  // (looking along the car, away from its door: eased out of the seat)
  const yaw = car.yaw - Math.PI / 2;
  ctx.controller.setMode('walk', { pose: { x: d.p.x, z: d.p.z, yaw, pitch: -0.05 }, ease: 0.4 });
  if (R.cabin.car) { R.cabin.dispose(); }
  G.sfx.play('tail_door', null, { open: true });
  ctx.stage.part('bounds').navAround(d.p.x, d.p.z, 14);
  T.foot = 0;
  G.emit('city:out', { car });
}

// the river: the kit's black, the words, up on the quay at the steps
function wet(ctx, R, at, why) {
  const G = ctx.game;
  G.cityWet = { x: at.x, z: at.z };
  ctx.hud.clearPrompt('cityin'); ctx.hud.clearPrompt('cityout');
  if (R.map) R.map.close();
  G.fail({ why, to: 'ashore', fall: false, hold: 1.1 });
}

// the steps up out of the water nearest a point: a place on the quay's
// pavement there, a car at the river road's kerb by it
export function stepsNear(x, z) {
  // (along the quay: the nearest point of the river road's line, then a
  // little back toward the city, on the quay's pavement)
  const N = riverNearest(x, z);
  // (the quay's walk: between the outer kerb and the railing)
  const qx = N.x - N.nx * (RIVER.hw + 6), qz = N.z - N.nz * (RIVER.hw + 6);
  // the car at the city side's kerb, the way the traffic goes there
  const cx = N.x + N.nx * (RIVER.hw - 1.3), cz = N.z + N.nz * (RIVER.hw - 1.3);
  // (a car on the city side: right-hand traffic; heading along the road)
  // (the car's right is (-dz, dx) for a heading along d: the city side is its right)
  const sgn = (N.dx * N.nz - N.dz * N.nx) >= 0 ? 1 : -1;
  const carYaw = Math.atan2(-(N.dz * sgn), N.dx * sgn);
  const yaw = Math.atan2(-(cx - qx), -(cz - qz));
  void PAVE; void QUAY_OFF; void SLIPS; void PIERS;
  return { car: { x: cx, z: cz }, carYaw, pos: { x: qx, z: qz }, yaw };
}
