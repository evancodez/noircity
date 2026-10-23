import * as THREE from 'three';
import { defineScene, beat } from '../game/script.js';
import { Cabin } from '../vehicles/cabin.js';
import { STARTS, START_DEFAULT, PAVE, RIVER, QUAY_OFF, SLIPS, PIERS, BRIDGE } from '../world/plan.js';
import { riverNearest } from '../world/cityGen.js';
import { MapOverlay } from '../world/map.js';
import { compileAll } from '../stages/noircity/compile.js';
import { installPeople } from '../people/index.js';   // [O3]

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
// the eye in the coupe's seat for the city (the critic's B3: the base's
// cabin eye - fov 58, pitch -0.12, the head at the seat's back - gave the
// roof, the pillars, the wheel and the bonnet 60 % of the frame; the city
// is read through the windscreen, so the head is forward in the seat, the
// lens wider and level: the upper storeys and the skyline through the glass)
export const CITY_SEAT = { eye: new THREE.Vector3(-0.02, 1.5, -0.34), fov: 64, pitch: -0.01 };
// E moving (game.city.wantOut): the brakes on and the throttle off until it
// stands, the steering still mine (the drive mode's control hook: true = I set the pedals)
function brakesFor(G) {
  return (v) => {
    const R = G.city;
    if (!R || !R.wantOut) return false;
    const I = v.input, held = (c) => G.held(c);
    I.throttle = 0; I.brake = 1; I.handbrake = 0;
    I.steer = ((held('KeyA') || held('ArrowLeft')) ? 1 : 0) - ((held('KeyD') || held('ArrowRight')) ? 1 : 0);
    const P = G.controller.pad && G.controller.pad.car;
    if (P && P.steer) I.steer = Math.max(-1, Math.min(1, P.steer));
    return true;
  };
}
// (look development: ?seat=fov,pitch,ex,ey)
function seatOpts() {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const s = q && q.get('seat');
  if (!s) return CITY_SEAT;
  const [fov, pitch, ex, ey] = s.split(',').map(Number);
  return { eye: new THREE.Vector3(ex ?? CITY_SEAT.eye.x, ey ?? CITY_SEAT.eye.y, CITY_SEAT.eye.z), fov: fov || CITY_SEAT.fov, pitch: pitch ?? CITY_SEAT.pitch };
}

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
  // (every program the city draws with, compiled under the fade in: none met first down a street)
  if (!G.shotMode) R.compileMs = compileAll(stage, G);
}

export default defineScene({
  id: 'city', stage: 'noircity', title: '', name: 'Noir City',
  beats: ['roam', 'ashore', 'station', 'hospital'],   // [O3] the arrest's and the fall's ends
  // (M is the map here: Game.bindInput leaves the sound alone)
  mapKey: true,
  objectives: { roam: null, ashore: null, station: null, hospital: null },
  setup: {
    roam(ctx) {
      const a = ctx.stage.anchor(`city.start.${startOf()}`);
      // (look development and the frames: ?car=x,z,yaw puts the car there and me in its seat)
      const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
      const cq = q && q.get('car');
      if (cq) {
        const [x, z, yaw] = cq.split(',').map(Number);
        place(ctx, { car: { x, z }, carYaw: yaw, pos: { x: x + Math.sin(yaw) * 2.3, z: z + Math.cos(yaw) * 2.3 }, yaw: 0 });
        const G = ctx.game, R = G.city;
        G.vehicles.setPlayer(R.car);
        if (R.car.lamps && R.car.lamps.setOn) R.car.lamps.setOn(true);
        R.cabin.attach(R.car, { ...seatOpts(), control: brakesFor(G) });
        R.inCar = true;
        return;
      }
      place(ctx, { car: a.car, carYaw: a.carYaw, pos: a.pos, yaw: a.yaw });
    },
    // out of the river: on the quay at the nearest steps, a car at the kerb by them
    ashore(ctx) {
      const G = ctx.game, W = G.cityWet || { x: 300, z: 432 };
      const S = stepsNear(W.x, W.z);
      place(ctx, S);
      // [O3] (out of the river unseen: the police have lost me)
      if (G.people) G.people.afterFail('river');
    },
    // [O3] arrested: I wake on the pavement outside the police headquarters
    // (O5's room when it merges), the gun gone, the heat gone, the car gone
    // (a car at the kerb down the street, until O2 parks the city's), a fine
    station(ctx) {
      const G = ctx.game, S = wakeAt(ctx, 'police');
      place(ctx, S);
      if (G.people) G.people.afterFail('arrest');
    },
    // [O3] down (shot, beaten): up on the pavement by the hospital (O4's
    // rule: the gun kept, the money less a little); the stand-in's place
    hospital(ctx) {
      const G = ctx.game, S = wakeAt(ctx, 'hospital');
      place(ctx, S);
      if (G.people) G.people.afterFail('hospital');
    },
  },
  *script(ctx) {
    const G = ctx.game, R = G.city, hud = ctx.hud;
    yield beat(ctx.beat || 'roam');
    if (!R.map) R.map = new MapOverlay(ctx.stage.part('city').C);
    R.map.close();
    installPeople(ctx);   // [O3] the crowd, the police, the gangs
    const T = { foot: 0, drive: 0, dist: 0, near: false };
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
  // the warning before the river (WAVE_C §1 rule 2): on a slipway's ramp, or
  // near a pier's open end - in the car at least 1.6 s ahead at its speed
  // (the critic's m1: a pier's end warned 14 m ahead, 0.7 s at 70 km/h); and
  // before the bridge's barrier (it is up: a crash, not a loss, but told)
  {
    const p = R.inCar && car ? car.pos : ctl.pos;
    const edge = RIVER.s + QUAY_OFF;
    const vs = R.inCar && car ? Math.max(0, car.vel.z) : 0, ve = R.inCar && car ? Math.max(0, car.vel.x) : 0;
    const lead = R.inCar ? Math.max(14, vs * 1.6) : 5;
    const slip = SLIPS.some((s) => Math.abs(p.x - s.x) < s.w / 2 + 0.5 && (p.z > RIVER.s + RIVER.hw + 1 || (vs > 4 && p.z > edge - lead)));
    const pier = PIERS.some((q) => Math.abs(p.x - q.x) < q.w / 2 && p.z > edge + q.len - lead);
    const bridge = R.inCar && Math.abs(p.z - BRIDGE.z) < BRIDGE.hw + 2 && p.x > RIVER.e && p.x > BRIDGE.barrier - Math.max(12, ve * 2.4) && p.x < BRIDGE.barrier;
    const w = slip || pier ? 'The river.' : bridge ? 'The bridge is up.' : null;
    // (a warning is danger: a teach card up goes - never two cards, never a card in danger)
    if (w !== (T.warned || null)) { T.warned = w; if (w) hud.teach.dismiss(); hud.warn(w); }
  }
  // the map: M (the pad's d-pad down taps M)
  if (ctx.pressed('KeyM')) { const open = R.map.toggle(); ctl.frozen = open; if (car && R.inCar) { car.input.throttle = 0; car.input.brake = open ? 1 : 0; } }
  if (R.map.isOpen) { R.map.draw([{ x: G.eye.x, z: G.eye.z, yaw: ctl.yaw, kind: 'me' }, ...(car && !R.inCar ? [{ x: car.pos.x, z: car.pos.z, yaw: car.yaw - Math.PI / 2, kind: 'car' }] : [])]); return; }
  if (R.inCar) {
    T.drive += dt;
    T.dist += Math.abs(car.speed) * dt;
    R.cabin.step(dt);
    // the river: the car in the water is lost
    if (C.inWater(car.pos.x, car.pos.z)) { wet(ctx, R, car.pos, 'The river took it.'); return; }
    const slow = Math.abs(car.speed) < 1.5;
    // the pedals, taught in the seat before the first W (the critic's m2:
    // it came 2.5 s after W, and S was never taught); up until the car has
    // gone a few lengths, or its time
    if (T.drive > 0.4 && !T.driveCard) T.driveCard = hud.teach('city_drive', '[W] drive  [S] brake  [SPACE] handbrake', { until: () => T.dist > 30, secs: 5 });
    if (T.drive > 25 && !T.taughtMap && !T.warned) { T.taughtMap = true; hud.teach('city_map', '[M] the map'); }
    // E, moving: the brakes go on and I get out as it stops (W again
    // changes my mind) - E acts on the press (the critic's m3)
    if (ctx.pressed('KeyE') && T.drive > 0.6) R.wantOut = true;
    if (R.wantOut && (ctx.pressed('KeyW') || ctx.pressed('ArrowUp'))) R.wantOut = false;
    if (R.wantOut && slow) { R.wantOut = false; getOut(ctx, R, T); return; }
    // 'E get out' once the car has been driven and stands (or after a while
    // in the seat), never under a card
    const out = slow && !R.wantOut && (T.dist > 4 || T.drive > 8) && (!T.driveCard || T.driveCard.done);
    if (out !== !!T.outShown) { T.outShown = out; if (out) hud.prompt('E  get out', null, 'cityout'); else hud.clearPrompt('cityout'); }
    return;
  }
  T.foot += dt;
  // the car I left rolls out what was left of its roll, its brakes on, and
  // stands (nothing else steps a parked car yet: O2's traffic will)
  if (car && !R.inCar && (car.vel.lengthSq() > 4e-4 || Math.abs(car.yawRate) > 0.01)) car.step(dt);
  // on foot: the river (walked off a pier's end, down a slipway, the steps)
  if (C.inWater(ctl.pos.x, ctl.pos.z) && ctl.groundY < -0.6) { wet(ctx, R, ctl.pos, 'Into the river.'); return; }
  // E at the car: any door, looking at it, close by
  let near = false;
  if (car && car.solid !== false) {
    const l = car.local(ctl.pos, _v);
    const db = Math.hypot(Math.max(0, Math.abs(l.x) - car.spec.halfL), Math.max(0, Math.abs(l.z) - car.spec.halfW));
    // (within a stride of its body: 2.5 m, the starts' place behind its tail included)
    if (db < 2.5) {
      const f = G.camera.getWorldDirection(new THREE.Vector3());
      const toX = car.pos.x - G.eye.x, toZ = car.pos.z - G.eye.z, tl = Math.max(0.05, Math.hypot(toX, toZ));
      const fl = Math.max(1e-3, Math.hypot(f.x, f.z));
      near = (toX * f.x + toZ * f.z) / (tl * fl) > 0.35 || db < 0.5;
    }
  }
  // E at the car: the teach card the first time (the key drawn; it goes when
  // I look away), the plain prompt after it - never both (the critic's M1)
  if (near && !T.near && !T.inCard) T.inCard = hud.teach('city_in', '[E] get in', { until: () => !T.near || R.inCar });
  T.near = near;
  const inP = near && (!T.inCard || T.inCard.done);
  if (inP !== !!T.inShown) { T.inShown = inP; if (inP) hud.prompt('E  get in', null, 'cityin'); else hud.clearPrompt('cityin'); }
  if (near && ctx.pressed('KeyE')) { getIn(ctx, R, T); return; }
  // a street door: in front of it, close, looking at it - E tries it. Shut,
  // it rattles (a place's door is O5's to open: city:door, e.handled)
  let door = null;
  if (!near) {
    const D = R.stream.doorNear(ctl.pos.x, ctl.pos.z, 1.9);
    if (D && (ctl.pos.x - D.x) * D.nx + (ctl.pos.z - D.z) * D.nz > 0.05) {
      const f = G.camera.getWorldDirection(_v);
      const toX = D.x - G.eye.x, toZ = D.z - G.eye.z, tl = Math.max(0.05, Math.hypot(toX, toZ)), fl = Math.max(1e-3, Math.hypot(f.x, f.z));
      if ((toX * f.x + toZ * f.z) / (tl * fl) > 0.72) door = D;
    }
  }
  const dk = door ? `${door.x.toFixed(1)},${door.z.toFixed(1)}` : null;
  if (dk !== T.door) { T.door = dk; if (door) hud.prompt('E  try the door', null, 'citydoor'); else hud.clearPrompt('citydoor'); }
  if (door && ctx.pressed('KeyE')) {
    const e = { door, handled: false };
    G.emit('city:door', e);
    if (!e.handled) { G.sfx.play('f_c4rattle', new THREE.Vector3(door.x, 1.2, door.z)); hud.message('locked', 1.2); G.emit('city:locked', { door }); }
  }
}

function getIn(ctx, R, T) {
  const G = ctx.game, car = R.car;
  ctx.hud.clearPrompt('cityin');
  T.near = false; T.inShown = false; T.drive = 0; T.dist = 0; T.outShown = false; R.wantOut = false;
  G.vehicles.setPlayer(car);
  if (car.lamps && car.lamps.setOn) car.lamps.setOn(true);
  // (eased into the seat: the camera never jumps)
  R.cabin.attach(car, { ease: 0.35, ...seatOpts(), control: brakesFor(G) });
  R.inCar = true;
  G.sfx.play('tail_door', null, { open: false });
  ctx.stage.part('bounds').navAround(car.pos.x, car.pos.z, 14);
  G.emit('city:in', { car });
}

function getOut(ctx, R, T) {
  const G = ctx.game, car = R.car, C = ctx.stage.part('city').C;
  ctx.hud.clearPrompt('cityout');
  T.outShown = false; R.wantOut = false;
  // (the brakes on, the handbrake up: what is left of its roll it rolls -
  // under 1.5 m/s, a few centimetres - never a dead stop)
  car.input.throttle = 0; car.input.brake = 1; car.input.steer = 0; car.input.handbrake = 1;
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
  // (its lamps off as I leave it at the kerb: on foot their wash greyed the road)
  if (car.lamps && car.lamps.setOn) car.lamps.setOn(false);
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
  // (the warning stays up into the fail: it was the reason)
  G.fail({ why, to: 'ashore', fall: false, hold: 1.1 });
}

// [O3] where I wake after the black: the pavement outside a place's door
// (the police headquarters; the hospital - no lot of the plan is one yet: the
// stand-in is the pavement at Baxter St and Fifth St, downtown), a car at the
// kerb down the street
const HOSPITAL = { x: -36.5, z: 66 };
function wakeAt(ctx, what) {
  const stage = ctx.stage, C = stage.part('city').C, g = stage.part('city').graph;
  let x, z, yaw;
  const D = what === 'police' ? (stage.part('places').doors || []).find((d) => d.place === 'police' || (d.place && d.place.id === 'police')) : null;
  if (D) {
    // (out on the street side of the door, whichever way its normal is cut: the side nearer the road)
    const sd = (k) => { const S = g.streetAt(D.x + D.nx * k * 3, D.z + D.nz * k * 3); return S ? S.d : 99; };
    const k = sd(1) <= sd(-1) ? 1 : -1;
    x = D.x + D.nx * k * 2.2; z = D.z + D.nz * k * 2.2;
    yaw = Math.atan2(-D.nx * k, -D.nz * k);
  } else {
    const n = g.nearestPavement(HOSPITAL.x, HOSPITAL.z).node;
    x = n.x; z = n.z;
    const L = g.nearestLane(x, z);
    yaw = L ? Math.atan2(-(L.x - x), -(L.z - z)) : 0;
  }
  const v = new THREE.Vector3(x, 0, z);
  stage.colliders.resolve(v, 0.4);
  // (the car: a bay 25 - 70 m off, the way the traffic goes there)
  const bays = g.baysNear(x, z, 70).filter((b) => b.d > 25);
  const b = bays[0] || g.baysNear(x, z, 120)[0];
  const car = b ? { x: b.x, z: b.z } : { x: x + 6, z };
  const carYaw = b ? b.yaw : 0;
  void C;
  return { car, carYaw, pos: { x: v.x, z: v.z }, yaw };
}

// the steps up out of the water nearest a point: a place on the quay's
// pavement there, a car at the river road's kerb by it
export function stepsNear(x, z) {
  // (along the quay: the nearest point of the river road's line, then a
  // little back toward the city, on the quay's pavement)
  const N = riverNearest(x, z);
  // (the quay's walk, by the outer kerb: up the steps there)
  const qx = N.x - N.nx * (RIVER.hw + 2.2), qz = N.z - N.nz * (RIVER.hw + 2.2);
  // the car at the quay side's kerb by me, the way the traffic goes there
  const cx = N.x - N.nx * (RIVER.hw - 1.3), cz = N.z - N.nz * (RIVER.hw - 1.3);
  // (the car's right is (-dz, dx) for a heading along d: the quay side, -n, is its right)
  const sgn = (N.dx * N.nz - N.dz * N.nx) >= 0 ? -1 : 1;
  const carYaw = Math.atan2(-(N.dz * sgn), N.dx * sgn);
  const yaw = Math.atan2(-(cx - qx), -(cz - qz));
  void PAVE; void QUAY_OFF; void SLIPS; void PIERS;
  return { car: { x: cx, z: cz }, carYaw, pos: { x: qx, z: qz }, yaw };
}
