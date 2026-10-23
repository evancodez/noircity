import * as THREE from 'three';
import { defineScene, beat } from '../game/script.js';
import { Cabin } from '../vehicles/cabin.js';
import { STARTS, START_DEFAULT, PAVE, RIVER, QUAY_OFF, SLIPS, PIERS, BRIDGE } from '../world/plan.js';
import { riverNearest } from '../world/cityGen.js';
import { MapOverlay } from '../world/map.js';
import { compileAll } from '../stages/noircity/compile.js';
// [O2] the wheels: the traffic, the parked cars, the tram, the hijack (src/traffic/, src/vehicles/)
import { Wheels } from '../traffic/index.js';
import { KINDS } from '../vehicles/kinds.js';
import { cockpitInto, cockpitOut, screenBasis } from '../vehicles/cockpit.js';
import { watchDamage } from '../vehicles/damage.js';
import { Chase } from '../vehicles/chase.js';   // [O2] V: the view behind the car
import { installPeople } from '../people/index.js';   // [O3]
import { swimStep } from '../world/swim.js';
import { placesOf } from '../places/Places.js';   // [O5] the places: their doors, their rooms
import { arms, owns } from '../combat/money.js';   // [O5] the wheel through what I own; [O7] the revolver under my arm
import { fistStep } from '../night/fist.js';   // [O7] after the critic: the bare hand in the street
import { wake as fallWake } from '../combat/fall.js';   // [O7] the hospital's words

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
export function brakesFor(G) {   // [O6] exported: the bed (scenes/smash.js) runs the same roam
  return (v) => {
    const R = G.city;
    if (!R || !R.wantOut) { v.input.hold = 0; return false; }
    const I = v.input, held = (c) => G.held(c);
    // ([O6] hold: the brake brakes a car rolling back too - E while it rolled
    // back was S held, and S past a breath reverses: it backed away faster)
    I.throttle = 0; I.brake = 1; I.handbrake = 0; I.hold = 1;
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

// [O2] the wheels of this stage: made once (the parked cars chosen, the signals,
// the tram); in shot mode only with &traffic=1 (the golden frames are the
// city's own, without them), &traffic=0 never
function wheelsFor(G, stage) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const want = q && q.get('traffic');
  if (want === '0' || (G.shotMode && want !== '1')) return null;
  if (G.wheels && G.wheels.stage !== stage) { G.wheels.dispose(); G.wheels = null; }
  if (!G.wheels) G.wheels = new Wheels(G, stage);
  return G.wheels;
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
  // [O2] the wheels (made once a stage): what they hold is let go before the
  // vehicles are cleared, and taken up again after (the traffic anew round the eye)
  const W = wheelsFor(G, stage);
  if (W) W.detach();
  V.clear();
  stage.part('stream').warmAround(at.car.x, at.car.z);
  if (stage.part('dressing')) stage.part('dressing').warmAround(at.car.x, at.car.z);   // [O1b]
  // [O2] (look development: &ckind=<kind> - the start's car of the fleet's kind instead of the coupe; [O7] a save's kind)
  const ck = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('ckind') : null;
  const kind = ck && KINDS[ck] ? ck : (at.kind || 'coupe');
  const car = V.spawn(kind, { at: new THREE.Vector3(at.car.x, 0, at.car.z), yaw: at.carYaw, lights: true, fleet: !!(ck && KINDS[ck]) });
  car.driver = null;
  V.player = null;
  R.car = car;
  R.inCar = false;
  R.swim = null;   // [O1b]
  R.cabin = stage._cabin || (stage._cabin = new Cabin(G));
  R.cabin.car = null;
  // (its lamps off while it stands: on as I get in)
  if (car.lamps && car.lamps.setOn) car.lamps.setOn(false);
  G.player.hands.equip('empty');
  G.setViewmodelVisible(false);
  ctx.controller.setPose(at.pos.x, at.pos.z, at.yaw, at.pitch ?? -0.06);   // [O3] (a wake's own pitch)
  stage.part('bounds').navAround(at.pos.x, at.pos.z, 14);
  R.stream = stage.part('stream');
  // [O5] the places (src/places/): loaded as I come near their doors
  R.places = placesOf(G, stage);
  if (W) W.attach(R.car);
  // (every program the city draws with, compiled under the fade in: none met first down a street)
  // [O2] (the wheels' programs too: every kind's car, the parked instances, the cockpit, the fares'
  // people - shown for the compile below, then put away)
  const seatWarm = !G.shotMode && !stage._seatWarm && G.pipeline && G.pipeline.renderer;
  if (!G.shotMode && W && (seatWarm || !stage._compiled)) W.warm();
  // [O1b] (the performance audit's lever 3: the first E into the car made a
  // program and uploaded the seat's geometries in its frame - 108 and 127 ms.
  // The seat taken once now, under the fade in: the hands on the wheel, the
  // screen's drops, compiled and drawn into a scrap target, then let go)
  // [O7] (its own flag: the title's backdrop compiles the city's stage at load - night/title.js -
  // and the seat was skipped with it, so the first E made TailScreen in its frame again: 100+ ms)
  if (seatWarm) {
    stage._seatWarm = true;
    const r = G.pipeline.renderer;
    // [O7] after the critic (M2: the first E 171 ms): the headlamps' cones and their pool on the road are
    // drawn only while lit - invisible at the warm, their programs were made in the first E's frame: lit here
    const lampsOn = car.lamps && car.lamps.setOn ? car.lamps : null;
    if (lampsOn) lampsOn.setOn(true);
    try {
      R.cabin.attach(car, { ...seatOpts(), ease: 0.001 });
      G.vm.sync && G.vm.sync(G.camera);
      r.compile(G.vm.scene, G.vm.cam);
      const rt = new THREE.WebGLRenderTarget(64, 64), prev = r.getRenderTarget();
      r.setRenderTarget(rt); r.render(G.vm.scene, G.vm.cam); r.setRenderTarget(prev); rt.dispose();
      stage._compiled = false;   // [O7] (the seat's own programs - TailScreen's FX layer - with the city's lights: the cached ones cost nothing)
      R.compileMs = compileAll(stage, G);
    } catch (e) { /* its first entry will */ }
    R.cabin.dispose();
    if (lampsOn) lampsOn.setOn(false);
    G.player.hands.equip('empty');
    G.setViewmodelVisible(false);
    ctx.controller.setPose(at.pos.x, at.pos.z, at.yaw, at.pitch ?? -0.06);   // [O3]
  }
  if (!G.shotMode && !stage._compiled) R.compileMs = compileAll(stage, G);
  if (W) W.unwarm();
}

export default defineScene({
  id: 'city', stage: 'noircity', title: '', name: 'Noir City',
  // [O5] hotel: up in my room at the Carlton (the save the bed writes; CONTINUE);
  // station: on the cell's bench at headquarters (the arrest's wake: O3);
  // wake: up after a fall in a place (G.city.wake: outside its door, or by the gym's ring), the car where I left it
  // [O7, O3] hospital: after a fall in the street (shot, beaten, the bounty's man: a fight lost to
  // anyone but the police): up on the pavement by my car where I left it - O4's rules (fall.js: the
  // stitches' cost) - until O5b's hospital door is built
  beats: ['roam', 'ashore', 'hotel', 'station', 'wake', 'hospital'],
  // (M is the map here: Game.bindInput leaves the sound alone)
  mapKey: true,
  objectives: { roam: null, ashore: null, hotel: null, station: null, wake: null, hospital: null },
  // [O2] a fall in the street to the wheels' men (the gang's gunmen at the glass): the hospital and its words
  onDown: (ctx) => (ctx.game.wheels && ctx.game.wheels.downSpec ? ctx.game.wheels.downSpec() : null),
  // [O6] the low line when the destruction set hurt him (the fire, the tram): its fix, not the gun kit's
  lowWarn: (ctx) => (ctx.stage.smash && ctx.stage.smash.cars.lowWarn()) || null,
  setup: {
    roam(ctx) {
      const a = ctx.stage.anchor(`city.start.${startOf()}`);
      // (look development and the frames: ?car=x,z,yaw puts the car there and me in its seat)
      const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
      const cq = q && q.get('car');
      // [O7] CONTINUE (src/night/save.js): the car and me where the save has us (in its seat, or beside it)
      const rs = ctx.game.night && ctx.game.night.takeResume ? ctx.game.night.takeResume() : null;
      if (rs) {
        place(ctx, rs);
        if (rs.damage) ctx.game.city.car.damage = rs.damage;
        if (!rs.inCar) return;
      }
      if (cq || (rs && rs.inCar)) {
        const [x, z, yaw] = rs ? [rs.car.x, rs.car.z, rs.carYaw] : cq.split(',').map(Number);
        if (!rs) place(ctx, { car: { x, z }, carYaw: yaw, pos: { x: x + Math.sin(yaw) * 2.3, z: z + Math.cos(yaw) * 2.3 }, yaw: 0 });
        const G = ctx.game, R = G.city;
        G.vehicles.setPlayer(R.car);
        if (R.car.lamps && R.car.lamps.setOn) R.car.lamps.setOn(true);
        // [O2] (a fleet car: its seat, its cockpit, its screen; the view behind it)
        takeSeat(ctx, R, R.car);
        R.inCar = true;
        return;
      }
      place(ctx, { car: a.car, carYaw: a.carYaw, pos: a.pos, yaw: a.yaw });
      // [O5] (look development and the frames: ?place=<id> puts me inside it, &seat=<name> in its seat)
      const pq = q && q.get('place');
      // (&out=1: loaded, but I stay where the pose puts me - outside its door)
      if (pq && !q.get('out')) ctx.game.city.places.enter(pq, { seat: q.get('sit') || null });
      // (&opendoor=<s>: its street door opened that many seconds in - the strips)
      if (pq && q.get('opendoor')) { const P = ctx.game.city.places, at = +q.get('opendoor'); let t = 0; P.later((dt) => { t += dt; const s = P.byId.get(pq); if (t < at || !s || !s.live) return false; s.live.street[0].open(ctx.game.eye); return true; }); }
    },
    // [O5] the hotel's bed wrote the save: CONTINUE wakes me in my room, the car at the kerb outside
    hotel(ctx) {
      const P = placesOf(ctx.game, ctx.stage), s = P.byId.get('hotel');
      const kerb = s ? s.frame.w(0, 7.5) : { x: -112, z: 83 };
      place(ctx, { car: kerb, carYaw: Math.PI / 2, pos: { x: kerb.x + 2, z: kerb.z }, yaw: 0 });
      P.wake('hotel');
    },
    // [O5] after an arrest (O3's): the cell's bench at headquarters; the car is gone (it is at the Grand Ave start)
    // [O3] at the O5 merge the cell's wake rendered black (the seated view in the cell: nothing
    // but `E get up`, in play and in shot mode - docs/reports/O3.md §0): until it shows the
    // cell, the arrest wakes on the pavement outside the headquarters' door, facing it. Back
    // to the cell: `placesOf(G, stage).wake('police')` here, then `afterFail('arrest', { room: true })`
    // (the room's wake takes the fine and the guns itself)
    station(ctx) {
      const G = ctx.game;
      if (STATION_CELL) {
        const a = ctx.stage.anchor('city.start.grand');
        place(ctx, { car: a.car, carYaw: a.carYaw, pos: a.pos, yaw: a.yaw });
        placesOf(G, ctx.stage).wake('police');
        if (G.people) G.people.afterFail('arrest', { room: true });
        return;
      }
      place(ctx, wakeAt(ctx, 'police'));
      if (G.people) G.people.afterFail('arrest');
    },
    // [O5] a fall in a place (a hideout's men, the bout, a room's fight): the place as it was (built
    // again under the black: every man back), me outside its street door facing it - or by the
    // gym's ring - and my car where I left it
    wake(ctx) {
      const G = ctx.game, R = G.city || (G.city = {}), P = placesOf(G, ctx.stage);
      // (the plays: ?start=city.wake&wake=<place>:<where> - the gym's ring, a hideout's door)
      const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
      if (!R.wake && q && q.get('wake')) { const [id, where] = q.get('wake').split(':'); R.wake = { id, where: where || 'door' }; }
      const W = R.wake || {}, s = P.byId.get(W.id);
      const car = R.car ? { x: R.car.pos.x, z: R.car.pos.z, yaw: R.car.yaw } : null;
      if (!s) { const a = ctx.stage.anchor('city.start.grand'); place(ctx, { car: a.car, carYaw: a.carYaw, pos: a.pos, yaw: a.yaw }); return; }
      const out = s.frame.w(0, 2.6);
      const kerb = car || { ...s.frame.w(2.5, 6.5), yaw: s.frame.yaw(Math.PI / 2) };
      place(ctx, { car: { x: kerb.x, z: kerb.z }, carYaw: kerb.yaw, pos: out, yaw: s.frame.yaw(0) });
      P.wakeAfter(W);
      R.wake = null;
    },
    // [O7, O3] up after a fall in the street: by my car where I left it (or at Grand Ave's kerb), the stitches paid
    hospital(ctx) {
      const G = ctx.game, R = G.city || (G.city = {});
      const car = R.car && R.car.solid !== false && !R.car.wrecked ? { x: R.car.pos.x, z: R.car.pos.z, yaw: R.car.yaw, kind: R.car.kind } : null;
      if (car) place(ctx, { car: { x: car.x, z: car.z }, carYaw: car.yaw, kind: car.kind, pos: { x: car.x + Math.sin(car.yaw) * 2.4, z: car.z + Math.cos(car.yaw) * 2.4 }, yaw: car.yaw - Math.PI / 2 });
      else { const a = ctx.stage.anchor('city.start.grand'); place(ctx, { car: a.car, carYaw: a.carYaw, pos: a.pos, yaw: a.yaw }); }
      // [O3] the police reset and the stitches paid once (People.afterFail: O4's fall.js); the words
      if (G.people) G.people.afterFail('hospital');
      else { const r = fallWake(G, 'hospital'); G.hud.message(r.line, 3.0); }
    },
    // out of the river: on the quay at the nearest steps, a car at the kerb by them
    ashore(ctx) {
      const G = ctx.game, W = G.cityWet || { x: 300, z: 432 };
      const S = stepsNear(W.x, W.z);
      place(ctx, S);
      // [O3] (out of the river unseen: the police have lost me)
      if (G.people) G.people.afterFail('river');
    },
  },
  *script(ctx) {
    const G = ctx.game, R = G.city, hud = ctx.hud;
    yield beat(ctx.beat || 'roam');
    if (!R.map) R.map = new MapOverlay(ctx.stage.part('city').C);
    R.map.close();
    installPeople(ctx);   // [O3] the crowd, the police, the gangs
    const T = { foot: 0, drive: 0, dist: 0, near: false };
    // [O2] the hijack gets me in (and out) of any car the way the free roam does
    if (G.wheels) { G.wheels.enter = (car) => getIn(ctx, R, T, car); G.wheels.exit = (car) => { if (R.inCar && R.car === car) getOut(ctx, R, T); }; }
    ctx.onStep((dt) => step(ctx, R, T, dt));
    for (;;) yield null;
    void hud;
  },
});

// ---- per step ------------------------------------------------------------------------------
export function step(ctx, R, T, dt) {   // [O6] exported
  const G = ctx.game, C = ctx.stage.part('city').C, hud = ctx.hud, ctl = ctx.controller;
  if (G.failing || G.state !== 'playing') return;
  // [O5] the places: loaded and dropped, their doors and their life
  if (R.places) R.places.step(dt);
  // [O2] the city's wheels go on (the traffic, the tram, the parked, the hijack)
  if (G.wheels && G.wheels.stage === ctx.stage) G.wheels.step(dt);
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
    // ([O1b] on foot the river is a swim, not a loss: the warning is the car's)
    const slip = R.inCar && SLIPS.some((s) => Math.abs(p.x - s.x) < s.w / 2 + 0.5 && (p.z > RIVER.s + RIVER.hw + 1 || (vs > 4 && p.z > edge - lead)));
    const pier = R.inCar && PIERS.some((q) => Math.abs(p.x - q.x) < q.w / 2 && p.z > edge + q.len - lead);
    const bridge = R.inCar && Math.abs(p.z - BRIDGE.z) < BRIDGE.hw + 2 && p.x > RIVER.e && p.x > BRIDGE.barrier - Math.max(12, ve * 2.4) && p.x < BRIDGE.barrier;
    const w = slip || pier ? 'The river.' : bridge ? 'The bridge is up.' : null;
    // (a warning is danger: a teach card up goes - never two cards, never a card in danger)
    if (w !== (T.warned || null)) { T.warned = w; if (w) hud.teach.dismiss(); hud.warn(w); }
  }
  // the map: M (the pad's d-pad down taps M)
  if (ctx.pressed('KeyM')) { const open = R.map.toggle(); ctl.frozen = open; if (car && R.inCar) { car.input.throttle = 0; car.input.brake = open ? 1 : 0; } }
  if (R.map.isOpen) { R.map.draw([{ x: G.eye.x, z: G.eye.z, yaw: ctl.yaw, kind: 'me' }, ...(car && !R.inCar ? [{ x: car.pos.x, z: car.pos.z, yaw: car.yaw - Math.PI / 2, kind: 'car' }] : [])]); return; }
  // [O5] on foot, the mouse wheel turns through what I own (O4's arms: fists, a gun bought at the
  // gun shop) - a gun out is the gun mode, fists the walk (lane O7 owns the wheel's card and the pad's)
  if (!R.inCar && G.mouse.wheel && !G.crowd.active && !(R.places && R.places.seat)) {
    const g = arms(G).next(Math.sign(G.mouse.wheel));
    if (g) { G.setViewmodelVisible(g !== 'fists'); if (g === 'fists') G.player.hands.equip('empty'); ctl.setMode(g === 'fists' ? 'walk' : 'gun', { crouch: false }); G.emit('city:arms', { gun: g }); }   // [O7] (city:arms)
    if (g && g !== 'fists') T.drawn = true;   // [O7] (the wheel's card is not needed any more)
  }
  if (R.inCar) {
    T.drive += dt;
    T.dist += Math.abs(car.speed) * dt;
    R.cabin.step(dt);
    // [O2] V (the pad's R3): the view - the seat, or behind the car (remembered in the save)
    if (ctx.pressed('KeyV') && R.chase) { R.chase.toggle(); if (!T.viewTold && R.chase.want) T.viewTold = true; }
    // [O2] Q: the horn (the car ahead pulls over; the others answer)
    if (ctx.pressed('KeyQ')) { G.sfx.play('tail_horn', car.seat(_v.set(2, 1, 0), new THREE.Vector3()), { k: 1, dur: 0.5, low: car.model && car.model.K && car.model.K.note < 0.9 ? 1 : 0 }, { ref: 3 }); if (G.wheels) G.wheels.traffic.horn(car); G.emit('city:horn', { car }); }
    // the river: the car in the water is lost
    if (C.inWater(car.pos.x, car.pos.z)) { wet(ctx, R, car.pos, 'The river took it.'); return; }
    // ([O6] shoved by the tram the car is not slow, but a man may still get out of it)
    const slow = Math.abs(car.speed) < 1.5 || (car.smashD && car.smashD.tramT != null && G.time - car.smashD.tramT < 0.4);
    // the pedals, taught in the seat before the first W (the critic's m2:
    // it came 2.5 s after W, and S was never taught); up until the car has
    // gone a few lengths, or its time
    if (T.drive > 0.4 && !T.driveCard) T.driveCard = hud.teach('city_drive', '[W] drive  [S] brake  [SPACE] handbrake', { until: () => T.dist > 30, secs: 5 });
    if (T.drive > 25 && !T.taughtMap && !T.warned) { T.taughtMap = true; hud.teach('city_map', '[M] the map'); }
    // [O2] the view behind the car, once, in a quiet second of a drive (never over another card)
    if (T.drive > 50 && T.dist > 300 && !T.taughtView && !T.warned && !hud.kit.teachCur && !(R.chase && R.chase.want)) { T.taughtView = true; hud.teach('city_view', '[V] the view', { until: () => R.chase && R.chase.want, secs: 4 }); }
    // [O2] a thing to do wants E here (the garage's door, the race's line, a fare): not out
    const claimed = G.wheels && G.wheels.claimsE(ctx, R);
    if (claimed && T.outShown) { T.outShown = false; hud.clearPrompt('cityout'); }
    // E, moving: the brakes go on and I get out as it stops (W again
    // changes my mind) - E acts on the press (the critic's m3)
    if (!claimed && ctx.pressed('KeyE') && T.drive > 0.6) R.wantOut = true;
    if (R.wantOut && (ctx.pressed('KeyW') || ctx.pressed('ArrowUp'))) R.wantOut = false;
    if (R.wantOut && slow) { R.wantOut = false; getOut(ctx, R, T); return; }
    // 'E get out' once the car has been driven and stands (or after a while
    // in the seat), never under a card
    const out = slow && !R.wantOut && !claimed && (T.dist > 4 || T.drive > 8) && (!T.driveCard || T.driveCard.done);
    if (out !== !!T.outShown) { T.outShown = out; if (out) hud.prompt('E  get out', null, 'cityout'); else hud.clearPrompt('cityout'); }
    return;
  }
  T.foot += dt;
  // [O2] a fist fight on the pavement (a driver who came back for his car): no car's E under it
  if (G.brawl && G.brawl.active) { if (T.inShown) { T.inShown = false; hud.clearPrompt('cityin'); } if (T.door) { T.door = null; hud.clearPrompt('citydoor'); } return; }
  // the car I left rolls out what was left of its roll, its brakes on, and
  // stands (nothing else steps a parked car yet: O2's traffic will)
  if (car && !R.inCar && !G.wheels && (car.vel.lengthSq() > 4e-4 || Math.abs(car.yawRate) > 0.01)) car.step(dt);
  // on foot: the river (walked off a pier's end, down a slipway, the steps):
  // [O1b] a swim to the steps (world/swim.js), never the fade
  if (swimStep(ctx, R)) { if (gunOut(G)) holster(ctx); return; }
  // [O3] a fist fight on (lane O4's crowd brawl): no prompt of the street's under it
  // (no card in danger, and E is the fight's: a bottle) - the critic's m2
  if (G.crowd && G.crowd.active) {
    if (T.inShown || T.door) { hud.clearPrompt('cityin'); hud.clearPrompt('citydoor'); }
    T.inShown = false; T.near = false; T.door = null;
    return;
  }
  // [O7] the revolver under my arm (OPEN_WORLD §1; a new night gives it: night/save.js): the wheel
  // above draws it (the pad's d-pad left / right); its card once, on foot, in a quiet second
  if (!T.drawn && T.foot > 4 && owns(G, 'revolver') && !T.warned && !T.near && !hud.kit.teachCur && !(G.police && G.police.heat > 0)) { T.drawn = true; hud.teach('city_gun', '[WHEEL] the revolver', { until: () => gunOut(G) || R.inCar, secs: 4 }); }
  // E at a car: any door, looking at it, close by - [O7] after the critic (B4: the car I came in was
  // furniture once the phone box brought another): any intact car of the night's (G.vehicles: mine, the
  // phone's, a save's), the nearest I look at; the one I get into is my car (R.car)
  let near = false, nearCar = null, nearD = Infinity;
  const f = G.camera.getWorldDirection(new THREE.Vector3()), fl = Math.max(1e-3, Math.hypot(f.x, f.z));
  for (const cv of G.vehicles.list) {
    if (!cv || cv.solid === false || cv.wrecked || cv.driver || cv === G.vehicles.player || cv.racer || cv.stored) continue;   // [O6] (a burnt wreck is no car to get into); [O2] (a racer waiting at the kerb has his man in it; a car going into the garage is the garage's)
    const l = cv.local(ctl.pos, _v);
    const db = Math.hypot(Math.max(0, Math.abs(l.x) - cv.spec.halfL), Math.max(0, Math.abs(l.z) - cv.spec.halfW));
    // (within a stride of its body: 2.5 m, the starts' place behind its tail included)
    if (db >= 2.5 || db >= nearD) continue;
    const toX = cv.pos.x - G.eye.x, toZ = cv.pos.z - G.eye.z, tl = Math.max(0.05, Math.hypot(toX, toZ));
    if ((toX * f.x + toZ * f.z) / (tl * fl) > 0.35 || db < 0.5) { nearCar = cv; nearD = db; }
  }
  near = !!nearCar;
  // E at the car: the teach card the first time (the key drawn; it goes when
  // I look away), the plain prompt after it - never both (the critic's M1)
  if (near && !T.near && !T.inCard) T.inCard = hud.teach('city_in', '[E] get in', { until: () => !T.near || R.inCar });
  T.near = near;
  const inP = near && (!T.inCard || T.inCard.done);
  // ([O7] after the critic, m3: turned back to the car after getting out, no prompt - another's prompt
  // was up when it came, and it was never asked again: asked each step until it shows)
  if (inP !== !!T.inShown || (inP && hud.promptOwner !== 'cityin')) { T.inShown = inP; if (inP) hud.prompt('E  get in', null, 'cityin'); else hud.clearPrompt('cityin'); }
  if (near && ctx.pressed('KeyE')) { getIn(ctx, R, T, nearCar); return; }   // ([O2] getIn makes it my car: city:mycar)
  // [O2] any other car: mine (left), parked (broken into), driven (taken) - vehicles/hijack.js
  if (!near && G.wheels && G.wheels.hijack.footStep(ctx, R)) { if (T.door) { T.door = null; hud.clearPrompt('citydoor'); } return; }
  // [O7] after the critic (B3: LMB on foot with empty hands did nothing): the bare hand's LMB / RMB throws
  // O4's jab on the press - the hands, the whiff; on a man in reach, the fight (fist.js)
  if (fistStep(ctx, R)) return;
  // a street door: in front of it, close, looking at it - E tries it. Shut,
  // it rattles (a place's door is O5's to open: city:door, e.handled)
  let door = null;
  if (!near) {
    const D = R.stream.doorNear(ctl.pos.x, ctl.pos.z, 1.9);
    // [O5] (a place's door is the place's: it opens, src/places/)
    if (D && !(R.places && R.places.owns(D)) && (ctl.pos.x - D.x) * D.nx + (ctl.pos.z - D.z) * D.nz > 0.05) {
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

// [O7] a gun in hand: put away (into the car, into the river)
export function gunOut(G) { const c = G.player.weapons.current; return !!c && c !== 'fists'; }
export function holster(ctx) {
  const G = ctx.game;
  arms(G).to('fists');
  G.player.hands.equip('empty');
  G.setViewmodelVisible(false);
  if (ctx.controller.mode === 'gun') ctx.controller.setMode('walk', { crouch: false });
  G.emit('city:arms', { gun: 'fists' });
}

export function getIn(ctx, R, T, car = R.car) {   // [O6] exported
  const G = ctx.game, W = G.wheels;
  if (gunOut(G)) holster(ctx);   // [O7]
  // [O2] a car taken (parked, pulled from its driver, one I left): it is my car now;
  // the one before it stays where I left it
  if (car !== R.car) { if (W && R.car && !W.left.some((L) => L.v === R.car)) W.leave(R.car); R.car = car; G.emit('city:mycar', { car }); }
  ctx.hud.clearPrompt('o2car');
  ctx.hud.clearPrompt('cityin');
  T.near = false; T.inShown = false; T.drive = 0; T.dist = 0; T.outShown = false; R.wantOut = false;
  G.vehicles.setPlayer(car);
  car.input.hold = 0;   // [O6] (my S reverses again)
  if (W) { W.ownLamps(car); W.took(car); watchDamage(W, car); W.watch(car); }
  if (car.lamps && car.lamps.setOn) car.lamps.setOn(true);
  // (eased into the seat: the camera never jumps)
  // [O2] a car of the fleet: its own seat, the cockpit put in it, the screen's rain in its screen;
  // [O6] (car.seatOpts: another kind's seat); the view behind it as the save has it
  takeSeat(ctx, R, car, { ease: 0.35 });
  R.inCar = true;
  G.sfx.play('tail_door', null, { open: false });
  ctx.stage.part('bounds').navAround(car.pos.x, car.pos.z, 14);
  G.emit('city:in', { car });
}

// [O2] the seat of the car I am in (a fleet car's own eye, its cockpit, its screen) and the
// view behind it (V, the pad's R3: vehicles/chase.js), eased in as the save remembers it
function takeSeat(ctx, R, car, extra = {}) {
  const G = ctx.game;
  const fleet = car.model && car.model.fleet;
  const seat = fleet ? { ...seatOpts(), eye: KINDS[car.kind].eye.clone() } : seatOpts();
  if (fleet) cockpitInto(ctx.stage, car);
  const C = R.chase || (R.chase = new Chase(G));
  C.begin(car);
  // (the man is in the seat whatever the view: G.eye there for what sees, shoots at and hears him)
  const eyeL = seat.eye.clone();
  G.eyeFix = (e) => { const Rc = G.city; if (Rc && Rc.inCar && Rc.chase && Rc.chase.k > 0 && Rc.car === car) car.seat(eyeL, e); };
  C.onSwap = (third, v) => showSeat(ctx, R, v, !third);
  R.cabin.attach(car, { ...seat, ...(car.seatOpts || {}), ...extra, control: brakesFor(G),
    view: (ctl, D, v, dt) => C.apply(ctl, D, v, dt),
    lookAround: (e, ctl) => { if (!(C.want && C.k > 0.5)) return false; C.mouse(e.movementX, e.movementY, ctl.sensitivity); return true; } });
  R.cabin.eye = fleet ? seat.eye : null;
  if (fleet) R.cabin.screen.mesh.matrix.copy(screenBasis(car.kind));
}
// the seat shown (the cockpit, the hands on the wheel, the rain on the screen), or the car whole from behind
function showSeat(ctx, R, car, seat) {
  const G = ctx.game, m = car && car.model;
  if (!m) return;
  if (m.fleet) { if (seat) cockpitInto(ctx.stage, car); else cockpitOut(ctx.stage, car); }
  G.setViewmodelVisible(seat);
  if (R.cabin.screen && R.cabin.screen.mesh) R.cabin.screen.mesh.visible = seat;
  if (m.meshes && m.meshes.bust) m.meshes.bust.visible = !seat;
}

export function getOut(ctx, R, T) {   // [O6] exported
  const G = ctx.game, car = R.car, C = ctx.stage.part('city').C;
  ctx.hud.clearPrompt('cityout');
  T.outShown = false; R.wantOut = false;
  // (the brakes on, the handbrake up: what is left of its roll it rolls -
  // under 1.5 m/s, a few centimetres - never a dead stop)
  car.input.throttle = 0; car.input.brake = 1; car.input.steer = 0; car.input.handbrake = 1;
  // ([O6] a foot held on the brake: a car left rolling back never reversed on
  // by itself - the critic's 7: S's brake past a breath is reverse, and the
  // empty coupe drove itself 37 m down Grand Ave)
  car.input.hold = 1;
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
  const chased = R.chase && R.chase.k > 0, from = chased ? ctx.controller.eyePose() : null;
  ctx.controller.setMode('walk', { pose: { x: d.p.x, z: d.p.z, yaw, pitch: -0.05 }, ease: 0.4 });
  // [O2] (from behind the car the eye is metres off the door - the controller's blend cuts a
  // move that long: it is made again here, from the view behind, so it is never a cut)
  if (chased) { ctx.controller._modeBlend = { from, t: 0, dur: 0.6, checked: true }; ctx.controller.apply(0); if (R.cabin.screen && R.cabin.screen.mesh) R.cabin.screen.mesh.visible = true; if (car.model && car.model.meshes && car.model.meshes.bust) car.model.meshes.bust.visible = false; R.chase.end(); }
  if (R.cabin.car) { R.cabin.dispose(); }
  // [O2] the car stays where I left it (the wheels keep it); a fleet car shut again
  cockpitOut(ctx.stage, car);
  if (G.wheels) G.wheels.leave(car);
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
// [O3] the arrest's wake in O5's cell (false: the pavement at the headquarters' door - see the station beat)
const STATION_CELL = false;
function wakeAt(ctx, what) {
  const stage = ctx.stage, C = stage.part('city').C, g = stage.part('city').graph;
  let x, z, yaw, pitch = -0.06;
  const D = what === 'police' ? (stage.part('places').doors || []).find((d) => d.place === 'police' || (d.place && d.place.id === 'police')) : null;
  if (D) {
    // (out on the street side of the door, whichever way its normal is cut: the side nearer the road)
    const sd = (k) => { const S = g.streetAt(D.x + D.nx * k * 3, D.z + D.nz * k * 3); return S ? S.d : 99; };
    const k = sd(1) <= sd(-1) ? 1 : -1;
    // [O3] after the critic (m1): out on the pavement 5.5 m from the door and a
    // stride to one side, facing it - the door, its two lamps and the POLICE
    // board over it in the frame: the frame itself says where I am
    const tx = D.nz * k, tz = -D.nx * k;
    x = D.x + D.nx * k * 5.5 + tx * 2.2; z = D.z + D.nz * k * 5.5 + tz * 2.2;
    yaw = Math.atan2(x - D.x, z - D.z);
    pitch = 0.1;
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
  return { car, carYaw, pos: { x: v.x, z: v.z }, yaw, pitch };
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
