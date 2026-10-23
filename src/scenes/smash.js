import * as THREE from 'three';
import { defineScene, beat } from '../game/script.js';
import { Cabin } from '../vehicles/cabin.js';
import { Car } from '../vehicles/Car.js';
import { Headlamps } from '../vehicles/Vehicle.js';
import { figureInk } from '../vehicles/models.js';
import { MapOverlay } from '../world/map.js';
import { merge, roundedBox } from '../world/geom.js';
import { compileAll } from '../stages/noircity/compile.js';
import { mergeAll } from '../stages/noircity/parts/street.js';
import { kindGeo, KINDS, awningGeo } from '../destruct/smashKinds.js';
import { step as roam } from './city.js';

// [O6] The destruction set's test bed (lane O6, docs/briefs/O6_SMASH.md §3):
// NOT a scene of the game - ?start=smash plays it, ?scene=smash&beat=<b>
// frames it. The city's own Grand Ave between Centre St and Fifth St, under
// the el, in the rain: every kind of the set placed along its pavements on
// top of what the city has there (lamps, a hydrant, a bench, the tram's
// stops), the shop fronts on its west side glazed and with awnings over
// them, a coupe at the kerb (E in), a sedan and a lorry parked across the
// way, the tram on its rails, and the Tommy gun in my hands (LMB, R). Drive
// and shoot through it; nothing to win. A fall (too near a car as it goes)
// is back at the start with everything standing again.
//   beats: bed        the start (on foot by the coupe)
//          burn       the sedan on fire (its fuse running), me 14 m off
//          tram       the sedan stalled across the rails, the tram coming
//          hundred    a hundred things in the road round the sedan, its fuse
//                     at a second: the budget's moment (fps, memory)
// game.city is the roam's record (scenes/city.js runs it: E in and out, the
// map, the river), with every car of the bed to get into: game.city.cars.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = new THREE.Vector3();
const NORTH = 0;
// what the bed adds to the city's own (kind, x, z, yaw[, on: index of the one it stands on])
const E = -Math.PI / 2, W = Math.PI / 2;
export const BED = {
  car: { x: -112.2, z: 30, yaw: Math.PI / 2 },
  me: { x: -111.9, z: 34.6, yaw: -0.06 },
  sedan: { x: -127.4, z: 6.0, yaw: -Math.PI / 2 },
  lorry: { x: -127.3, z: 54.0, yaw: -Math.PI / 2 },
  // (along the kerbs: a car down either pavement meets every one; the city's
  // own - a lamp, a hydrant, a tram stop's sign, a bench - stand among them)
  items: [
    // the east pavement, south to north
    ['newsstand', -109.9, 24.0, E], ['hydrant', -110.45, 20.6, 0], ['stall', -109.9, 17.6, E],
    ['crate', -110.15, 16.0, 0.1], ['crate', -110.15, 15.35, 0.05], ['crate', -110.15, 16.0, 0.12, 3],
    ['callbox', -110.4, 6.5, E], ['bin', -110.35, 3.4, 0.4], ['bench', -109.95, 1.2, E],
    ['crate', -109.8, -3.1, 0], ['crate', -109.8, -3.75, 0.07], ['crate', -109.15, -3.4, -0.1], ['crate', -109.8, -3.1, 0.04, 9],
    ['bin', -110.35, -11.0, 1.1], ['stop', -110.5, -13.3, E],
    ['fence', -109.9, -18.6, 0], ['fence', -107.6, -18.6, 0],
    // the west pavement, under the glazed shop fronts
    ['stall', -131.2, 26.9, W], ['stall', -131.2, 23.5, W], ['crate', -129.95, 25.2, 0], ['crate', -129.95, 24.55, 0.1], ['crate', -129.95, 25.2, 0.05, 19],
    ['hydrant', -129.55, 30.9, 0], ['newsstand', -131.2, 36.9, W], ['bin', -129.6, 38.6, 0.2], ['callbox', -129.6, 41.9, W], ['bench', -131.0, 46.6, W],
  ],
  // the shop fronts on the west facade (x -134, facing +x): their glass, an awning over some
  shops: [{ z: 23.6, w: 2.7, awning: true }, { z: 27.0, w: 2.7, awning: true }, { z: 33.7, w: 2.7, awning: true }, { z: 40.5, w: 2.7, awning: true }, { z: 43.9, w: 2.7 }, { z: 47.3, w: 2.7, awning: true }, { z: 13.9, w: 2.4 }, { z: 17.0, w: 2.4 }],
  facade: -134,
  // the tram's way: the west rails, south to north and back (x, z0, z1)
  tram: { x: -121.9, z0: 300, z1: -150, speed: 8.5 },
};

// ---- the bed's things (built once a stage: registered with the set, merged by material) ----------------
function buildBed(stage) {
  if (stage._smashBed) return stage._smashBed;
  const S = stage.smash, M = stage.M;
  const recs = [];
  const placed = [];
  BED.items.forEach(([kind, x, z, yaw, on]) => {
    const rec = { kind, x, z, yaw, bed: true };
    let y = stage.surfaceY(x, z);
    const under = on != null ? recs[on] : null;
    if (under) y = under.y + (KINDS[under.kind].h ?? 0.34);
    rec.y = y;
    recs.push(rec);
    const it = S.register(rec, kind, { y, merged: true, colliders: !under });
    if (under) { const u = S.itemOf(under); it.under = u; (u.above || (u.above = [])).push(it); }
    placed.push({ rec, kind, y });
  });
  // the merge: one mesh a material, each thing's ranges recorded (as the city's chunks)
  const buckets = {};
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
  for (const p of placed) {
    const K = KINDS[p.kind];
    const g = kindGeo(p.kind).clone().applyMatrix4(_m.compose(V(p.rec.x, p.y, p.rec.z), _q.setFromAxisAngle(V(0, 1, 0), p.rec.yaw), V(1, 1, 1)));
    (buckets[K.mat] || (buckets[K.mat] = [])).push({ g, owner: p.rec });
  }
  const meshes = [];
  for (const [mat, list] of Object.entries(buckets)) {
    let o = 0;
    const ranges = [];
    for (const { g, owner } of list) { const n = g.index ? g.index.count : g.getAttribute('position').count; ranges.push({ owner, start: o, count: n }); o += n; }
    const m = new THREE.Mesh(mergeAll(list.map((x) => x.g)), S.mats[mat] || M.kerb);
    m.name = 'smashBed ' + mat;
    m.userData.inkId = S.idOf('bed_' + mat);
    m.userData.ranges = ranges;
    m.userData.prop = 'merged';
    m.receiveShadow = true;
    stage.scene.add(m);
    stage.addSolid(m);
    meshes.push(m);
  }
  S.chunkIn('bed', meshes);
  // the shop fronts: their glass (a pane each), awnings over them
  const canvas = S.mats.cloth;
  for (const s of BED.shops) {
    const x = BED.facade + 0.03, y = 1.8 + 0.02;
    const pane = stage.glass.addPane({ centre: V(x, y, s.z), normal: V(1, 0, 0), w: s.w - 0.25, h: 2.3, tag: 'shop' });
    const gi = S.register({ x: BED.facade + 0.05, z: s.z, yaw: W }, 'glass', { y: 0.15 });
    gi.pane = pane;
    gi.fp = { hx: (s.w - 0.25) / 2, hz: 0.12 };
    if (!s.awning) continue;
    const aw = new THREE.Mesh(awningGeo(s.w + 0.3, 1.6), canvas);
    aw.position.set(BED.facade, 3.5, s.z);
    aw.rotation.y = W;
    aw.userData.inkId = S.idOf('awning');
    aw.receiveShadow = true;
    stage.scene.add(aw);
    aw.updateMatrixWorld(true);
    stage.addSolid(aw);
    const it = S.register(aw, 'awning', { y: 3.5, w: s.w + 0.3, d: 1.6, wall: { nx: 1, nz: 0 }, e: [(s.w + 0.3) / 2, 0.35, 0.8], c: [0, -0.3, 0.8] });
    it.fp = { hx: (s.w + 0.3) / 2, hz: 0.8 };
    it.fc = { x: BED.facade + 0.8, z: s.z };
  }
  stage._smashBed = { recs, meshes };
  return stage._smashBed;
}

// ---- the tram (the tail's, on Grand Ave's rails: a moving wall with a bell) ----------------------------------
const LEN = 12.4, WID = 2.5;
let TRAM = null;
function tramModel(M) {
  if (!TRAM) {
    const body = merge([
      roundedBox(LEN, 2.6, WID, 0.3, 3).translate(0, 1.9, 0),
      roundedBox(LEN - 0.6, 0.35, WID - 0.3, 0.15, 2).translate(0, 3.35, 0),
      new THREE.BoxGeometry(LEN - 1, 0.5, WID - 0.2).translate(0, 0.45, 0),
      new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6).rotateZ(1.05).translate(-1.2, 4.9, 0),
    ]);
    const win = [];
    for (let x = -LEN / 2 + 1.2; x < LEN / 2 - 1; x += 1.1) for (const z of [-WID / 2 - 0.01, WID / 2 + 0.01]) win.push(new THREE.PlaneGeometry(0.75, 0.9).rotateY(z > 0 ? 0 : Math.PI).translate(x, 2.35, z));
    for (const x of [-LEN / 2 - 0.01, LEN / 2 + 0.01]) win.push(new THREE.PlaneGeometry(1.6, 0.9).rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2).translate(x, 2.4, 0));
    TRAM = { body, win: merge(win) };
  }
  const g = new THREE.Group();
  g.name = 'tram';
  const b = new THREE.Mesh(TRAM.body, M.paintGrey || M.paint);
  const w = new THREE.Mesh(TRAM.win, new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(1.6) }));
  w.userData.noRay = true; w.userData.emitter = true;
  g.add(b, w);
  return { group: g, meshes: { body: b, win: w } };
}
function spawnTram(ctx, z0, dir) {
  const G = ctx.game, stage = ctx.stage, Vh = G.vehicles, T = BED.tram;
  const m = tramModel(stage.M);
  stage.scene.add(m.group);
  const yaw = dir < 0 ? Math.PI / 2 : -Math.PI / 2;     // (north: rotation.y PI/2)
  const v = new Car(Vh, 'truck', m, { pos: V(T.x, 0, z0), yaw, spec: { halfL: LEN / 2, halfW: WID / 2, mass: 30, top: 3.5 } });
  v.inkSlot = figureInk(m.group);
  v.lamps = new Headlamps(stage, v, [V(LEN / 2, 1.2, -0.25), V(LEN / 2, 1.2, 0.25)], { reach: 26, intensity: 140, cone: 0.16 });
  v.kind = 'tram';
  const st = { bellT: 0 };
  v.driver = {
    kinematic: true,
    drive(car, dt) {
      const sp = T.speed * dir;
      car.pos.z += sp * dt; car.vel.set(0, 0, sp); car.yawRate = 0;
      // (it sweeps what lies on its rails)
      if (stage.smash) stage.smash.collide(car);
      // the bell, coming to the bed
      st.bellT -= dt;
      const e = G.camera.position;
      if (st.bellT <= 0 && Math.abs(car.pos.z - e.z) < 60) { st.bellT = 2.2; G.sfx.play('c3_bell', car.pos, { k: 0.9 }, { ref: 8 }); }
      // out the far end: in again at the other, the other way
      if ((dir < 0 && car.pos.z < T.z1) || (dir > 0 && car.pos.z > T.z0)) { dir = -dir; car.yaw = dir < 0 ? Math.PI / 2 : -Math.PI / 2; car.pos.z = dir < 0 ? T.z0 : T.z1; }
    },
  };
  Vh.list.push(v);
  return v;
}

// ---- the start --------------------------------------------------------------------------------------------
function place(ctx, at = {}) {
  const G = ctx.game, stage = ctx.stage, Vh = G.vehicles;
  const R = G.city || (G.city = {});
  Vh.clear();
  stage.part('stream').warmAround(BED.car.x, BED.car.z);
  buildBed(stage);
  stage.smash.mendAll();
  const cAt = at.car || BED.car;   // [O6b] (the ten's: my coupe in the lane under the el)
  const coupe = Vh.spawn('coupe', { at: V(cAt.x, 0, cAt.z), yaw: cAt.yaw, lights: true });
  coupe.driver = null;
  if (coupe.lamps && coupe.lamps.setOn) coupe.lamps.setOn(false);
  const sedan = Vh.spawn('sedan', { at: V(at.sedan ? at.sedan.x : BED.sedan.x, 0, at.sedan ? at.sedan.z : BED.sedan.z), yaw: at.sedan ? at.sedan.yaw : BED.sedan.yaw, lights: false });
  sedan.driver = null;
  // (the block's sedan leaves a box of its own in the walking colliders' grid: the car's own box is the one a man meets)
  if (sedan.car && sedan.car.collider && stage.colliders.remove) stage.colliders.remove(sedan.car.collider);
  const lAt = at.lorry || BED.lorry;
  const lorry = Vh.spawn('truck', { at: V(lAt.x, 0, lAt.z), yaw: lAt.yaw, lights: true });
  lorry.driver = null;
  if (lorry.lamps && lorry.lamps.setOn) lorry.lamps.setOn(false);
  // (the lorry's seat: high in its cab, over its screen; no wheel of the coupe's)
  lorry.seatOpts = { eye: V(1.55, 2.45, -0.45), fov: 64, pitch: -0.05 };
  Vh.player = null;
  R.car = coupe; R.cars = [coupe, lorry, sedan]; R.inCar = false;
  R.cabin = stage._cabin || (stage._cabin = new Cabin(G));
  R.cabin.car = null;
  R.tram = at.noTram ? null : spawnTram(ctx, at.tramZ ?? BED.tram.z0, at.tramDir ?? -1);
  R.stream = stage.part('stream');
  const me = at.me || BED.me;
  ctx.controller.setPose(me.x, me.z, me.yaw, me.pitch ?? -0.04);
  G.player.weapons.equip('tommy');
  G.setViewmodelVisible(typeof location === 'undefined' || new URLSearchParams(location.search).get('vm') !== '0');   // (vm=0: the strips without the gun)
  if (G.weapon && G.weapon.ammo != null) G.weapon.ammo = 50;
  stage.part('bounds').navAround(me.x, me.z, 14);
  // (down by the set - the blast, the wreck's fire, the tram: a fall, back at
  // the start; the words name what did it - the critic's blocker 2)
  G.health.reset && G.health.reset();
  G.health.onDeath = () => G.fail({ why: (stage.smash && stage.smash.cars.why()) || 'Too close when she went.', to: 'bed' });
  if (!G.shotMode) R.compileMs = compileAll(stage, G);
  lookDev(ctx);
  return { coupe, sedan, lorry };
}

// (look development, the strips: ?pose=x,z,yaw,pitch puts the eye there;
// ?stage=<kind>@<t>[,<speed>[,<dirx>,<dirz>]] knocks the bed's first thing of
// that kind over as a car at that speed would, t s after the start)
function lookDev(ctx) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (!q) return;
  const G = ctx.game, S = ctx.stage.smash;
  const pose = q.get('pose');
  if (pose) { const [x, z, yaw, pitch] = pose.split(',').map(Number); ctx.controller.setPose(x, z, yaw, pitch || 0); }
  const st = q.get('stage');
  if (!st || !S) return;
  const [kind, rest] = st.split('@');
  const [at, sp, dx, dz] = (rest || '0.5').split(',').map(Number);
  // (the nearest of that kind to the eye)
  const e = ctx.controller.pos;
  let it = null;
  for (const i of S.near(e.x, e.z, 30)) if (i.kind === kind && (!it || Math.hypot(i.x - e.x, i.z - e.z) < Math.hypot(it.x - e.x, it.z - e.z))) it = i;
  if (!it) return;
  const t0 = G.time;
  const f = () => {
    if (G.time - t0 < at) return;
    G.scripts.splice(G.scripts.indexOf(f), 1);
    S.hit(it, null, V(dx || 1, 0, dz || 0).normalize().multiplyScalar(sp || 8), 'car');
  };
  G.scripts.push(f);
}

// (the budget's moment: ?all=<t> in the hundred beat - every one of the hundred
// pushed over at once, as a blast in their middle would, and the shop glass with them)
function allOver(ctx) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const at = q && q.get('all');
  const G = ctx.game, S = ctx.stage.smash, H = ctx.stage._hundred;
  if (at == null || !S || !H) return;
  const t0 = G.time;
  let r = 0x51A5;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const f = () => {
    if (G.time - t0 < +at) return;
    G.scripts.splice(G.scripts.indexOf(f), 1);
    // (as a blast's wave would reach them: over a third of a second)
    for (const rec of H.recs) { const it = S.itemOf(rec); if (it && it.state === 'stand') { const a = rnd() * 6.283, imp = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(5 + 5 * rnd()); S.later(rnd() * 0.35, () => S.hit(it, null, imp, 'blast')); } }
    for (const it of S.items) if (it.kind === 'glass' && it.state === 'stand') S.later(rnd() * 0.35, () => S.hit(it, null, V(-1, 0, 0).multiplyScalar(6), 'blast'));
  };
  G.scripts.push(f);
}

// a hundred things in the road round the sedan (the budget's moment)
function hundred(ctx) {
  const stage = ctx.stage, S = stage.smash;
  if (!stage._hundred) {
    const kinds = ['crate', 'crate', 'bin', 'crate', 'fence', 'crate', 'bin', 'callbox', 'crate', 'newsstand'];
    const recs = [];
    let k = 0;
    for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) {
      const x = -128.2 + col * 1.75 + (row % 2) * 0.5, z = 12 + row * 2.2;
      if (Math.abs(x - BED.sedan.x) < 1.6 && Math.abs(z - 16) < 3.2) continue;
      const kind = kinds[(row * 3 + col) % kinds.length];
      recs.push({ kind, x, z, yaw: (k++ * 0.37) % 3.14 });
    }
    // (their merge, as the bed's)
    const buckets = {};
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
    for (const r of recs) {
      const y = stage.surfaceY(r.x, r.z);
      S.register(r, r.kind, { y, merged: true, colliders: true });
      const g = kindGeo(r.kind).clone().applyMatrix4(_m.compose(V(r.x, y, r.z), _q.setFromAxisAngle(V(0, 1, 0), r.yaw), V(1, 1, 1)));
      (buckets[KINDS[r.kind].mat] || (buckets[KINDS[r.kind].mat] = [])).push({ g, owner: r });
    }
    const meshes = [];
    for (const [mat, list] of Object.entries(buckets)) {
      let o = 0; const ranges = [];
      for (const { g, owner } of list) { const n = g.getAttribute('position').count; ranges.push({ owner, start: o, count: n }); o += n; }
      const m = new THREE.Mesh(mergeAll(list.map((x) => x.g)), S.mats[mat]);
      m.userData.inkId = S.idOf('h_' + mat); m.userData.ranges = ranges; m.userData.prop = 'merged'; m.receiveShadow = true;
      stage.scene.add(m); stage.addSolid(m); meshes.push(m);
    }
    S.chunkIn('hundred', meshes);
    stage._hundred = { recs, meshes };
  }
  for (const m of stage._hundred.meshes) m.visible = true;
  return stage._hundred;
}

// [O6b] ten cars on Grand Ave (the havoc's bed, brief O6b: "ram every car on
// Grand Ave until each is a wreck"): parked along both kerbs, each in the gap
// between two of the el's columns (a car can be reached from the lane under
// the el: a door from the side, a tail from behind), the bed's sedan and
// lorry among them; my coupe in the lane under the el at Fifth St, heading
// north; the tram kept off (its own beat). Every one but the bed's locked
// sedan to get into (E) when mine is spent. kind, x, z, yaw, paint
const MID = [37.85, 26.35, 14.85, 3.35, -8.15];   // (between the columns, z)
export const TEN = {
  car: { x: -119.6, z: 58, yaw: Math.PI / 2 }, me: { x: -117.6, z: 60.5, yaw: 0.6, pitch: -0.04 },
  sedan: { x: -127.6, z: MID[3] + 0.17, yaw: -Math.PI / 2 }, lorry: { x: -127.3, z: MID[0] - 1.0, yaw: -Math.PI / 2 },
  cars: [
    ['sedan', -112.4, MID[0] + 0.17, Math.PI / 2, 'paint'], ['sedan', -112.4, MID[1] + 0.17, Math.PI / 2, 'paintGrey'], ['truck', -112.9, MID[2] + 1.35, Math.PI / 2],
    ['sedan', -112.4, MID[3] + 0.17, Math.PI / 2, 'paintGrey'], ['coupe', -112.4, MID[4] - 0.1, Math.PI / 2],
    ['sedan', -127.6, MID[4] + 0.17, -Math.PI / 2, 'paintGrey'], ['sedan', -127.6, MID[2] + 0.17, -Math.PI / 2, 'paint'], ['sedan', -127.6, MID[1] + 0.17, -Math.PI / 2, 'paintGrey'],
  ],
};
function ten(ctx) {
  const G = ctx.game, R = G.city, Vh = G.vehicles;
  for (const [kind, x, z, yaw, paint] of TEN.cars) {
    const v = Vh.spawn(kind, { at: V(x, 0, z), yaw, lights: false, paint: paint || 'paint' });
    v.driver = null; v.input.hold = 1; v.input.brake = 1; v.input.handbrake = 1;   // (parked: its brakes on - a car shoved slides a little, it does not roll away)
    if (v.lamps && v.lamps.setOn) v.lamps.setOn(false);
    if (v.car && v.car.collider && ctx.stage.colliders.remove) ctx.stage.colliders.remove(v.car.collider);
    if (kind === 'truck') v.seatOpts = { eye: V(1.55, 2.45, -0.45), fov: 64, pitch: -0.05 };
    R.cars.push(v);
  }
  for (const v of [R.cars[1], R.cars[2]]) { v.input.hold = 1; v.input.brake = 1; v.input.handbrake = 1; }
  // (look development and the frames: &ten=states puts the ten in the ten
  // states of a car's damage, &ten=wrecks sends every one up, a few at a time)
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const mode = q && q.get('ten');
  if (!mode) return;
  const S = ctx.stage.smash, D = S.cars, cars = R.cars.filter((c) => c !== R.car);
  const t0 = G.time;
  const f = () => {
    if (G.time - t0 < 0.3) return;
    G.scripts.splice(G.scripts.indexOf(f), 1);
    // (&ten=parts: a sedan's door and its bonnet lying in the lane under the el, on the
    // way north from my coupe - the parts' proof: a man stopped by one, a car slowed by it)
    // (&ten=drive: a sedan up the lane under the el with its bonnet sprung, its door
    // hanging, its front bumper loose and a front wheel wobbling, driven by a hand of
    // its own - the strips of the parts in motion: ?pose= on the lane's side)
    if (mode === 'drive') {
      const v = G.vehicles.spawn('sedan', { at: V(-120.8, 0, 62), yaw: Math.PI / 2, lights: true, paint: 'paint' });
      R.cars.push(v);
      S.later(0.1, () => {
        const d = v.smashD;
        if (!d) return;
        D.popHood(d, 1); D.hangDoor(d, -1); D.looseBumper(d, 0, -1); D.wobble(d, 0);
        v.driver = { drive(car) { car.input.throttle = car.speedAbs < 11 ? 0.75 : 0; car.input.brake = 0; car.input.handbrake = 0; car.input.steer = (car.pos.x + 120.8) * 0.25 - Math.sin(car.yaw - Math.PI / 2) * 1.2; } };
      });
      return;
    }
    if (mode === 'parts') {
      const pc = cars.find((c) => c.kind === 'sedan'), col = pc && pc.smashD ? D.paintOf(pc) : null, q = new THREE.Quaternion();
      S.spawnPart('cardoor', V(-119.6, 0.4, 44), q.clone(), V(0, 0, 0), null, { scale: V(0.91, 0.6 / 0.62, 1), color: col });
      S.spawnPart('carbonnet', V(-120.4, 0.4, 36), q.clone(), V(0, 0, 0), null, { scale: V(1.56, 1, 1.16), color: col });
      return;
    }
    cars.forEach((v, i) => {
      const d = v.smashD;
      if (!d) return;
      const P = (x, z) => { const p = v.world(x, z); p.y = 0.6; return p; };
      const N0 = (x, z) => { const p = v.world(x, z).sub(v.pos); p.y = 0; return p.normalize(); };
      if (mode === 'wrecks') { S.later(i * 0.45, () => { v.damage = 4.3; }); return; }
      // the ten states, one a car: dents, the bonnet sprung, a door hanging, a door
      // off, a bumper dragging, a bumper off, a wheel wobbling, a wheel off, burning, the wreck
      switch (i) {
        case 0: D.knock(d, { point: P(1.2, -0.95), k: 0.7, n: N0(0, 1) }, 0.6); D.knock(d, { point: P(-1.6, -0.95), k: 0.6, n: N0(0, 1) }, 0.6); break;
        case 1: D.popHood(d, 1); break;
        case 2: D.hangDoor(d, -1); d.doors[0].ang = 0.9; break;
        case 3: D.hangDoor(d, 1); D.doorOff(d, 1); break;
        case 4: D.looseBumper(d, 0, -1); break;
        case 5: D.looseBumper(d, 1, 1); D.bumperOff(d, 1); break;
        case 6: D.wobble(d, 0); break;
        case 7: D.wobble(d, 3); D.wheelOff(d, 3); break;
        case 8: v.damage = 3.4; break;
        default: v.damage = 4.3;
      }
    });
  };
  G.scripts.push(f);
}

export default defineScene({
  id: 'smash', stage: 'noircity', title: '', name: 'Smash (the bed)',
  beats: ['bed', 'burn', 'tram', 'hundred', 'fire', 'ten'],
  mapKey: true,
  objectives: { bed: null, burn: null, tram: null, hundred: null, fire: null, ten: null },
  // (hurt by the fire or the tram: its fix - not the gun kit's 'Get to cover.')
  lowWarn: (ctx) => (ctx.stage.smash && ctx.stage.smash.cars.lowWarn()) || null,
  setup: {
    bed(ctx) { place(ctx); },
    // the sedan already burning, its fuse running; me across the road
    burn(ctx) {
      const { sedan } = place(ctx, { me: { x: -113.0, z: 3.0, yaw: 1.776, pitch: -0.03 } });
      sedan.damage = 3.4;
    },
    // the sedan stalled across the west rails, the tram coming from the north
    tram(ctx) {
      place(ctx, { sedan: { x: -121.6, z: 4, yaw: 0.25 }, tramZ: -40, tramDir: 1, me: { x: -110.5, z: 9.0, yaw: Math.PI / 2 - 0.35, pitch: -0.03 } });
    },
    // the coupe itself on fire at the kerb (the lane's one loss: in it when it goes)
    fire(ctx) {
      const { coupe } = place(ctx);
      coupe.damage = 3.36;
    },
    // [O6b] ten cars along Grand Ave to ram, me by my coupe
    ten(ctx) {
      place(ctx, { car: TEN.car, me: TEN.me, sedan: TEN.sedan, lorry: TEN.lorry, noTram: true });
      ten(ctx);
    },
    // a hundred things round the sedan, its fuse at a second
    hundred(ctx) {
      hundred(ctx);
      const { sedan } = place(ctx, { sedan: { x: -122.5, z: 22, yaw: 0.3 }, me: { x: -112.0, z: 46.0, yaw: 0.22, pitch: -0.06 } });
      sedan.damage = 4.2;
      allOver(ctx);
    },
  },
  *script(ctx) {
    const G = ctx.game, R = G.city;
    yield beat(ctx.beat || 'bed');
    if (!R.map) R.map = new MapOverlay(ctx.stage.part('city').C);
    R.map.close();
    const T = { foot: 0, drive: 0, dist: 0, near: false };
    // (the gun back in my hands out of a car; no hands at a wheel the lorry has not got)
    if (!G._smashHooks) {
      const H = G._smashHooks = {
        out: () => { if (G.scenes.current && G.scenes.current.id === 'smash') { G.player.weapons.equip('tommy'); G.setViewmodelVisible(true); } },
        in: (e) => { if (e.car && e.car.seatOpts && G.scenes.current && G.scenes.current.id === 'smash') G.setViewmodelVisible(false); },
        exit: (e) => { if (e && e.id === 'smash') G.health.onDeath = null; },
      };
      G.on('city:out', H.out); G.on('city:in', H.in); G.on('scene:exit', H.exit);
    }
    let dealT = 0;
    ctx.onStep((dt) => {
      if (G.failing || G.state !== 'playing') return;
      // on foot: the car I would get into is the nearest of the bed's (a wreck is none)
      if (!R.inCar) {
        let best = null, bd = 6;
        for (const c of R.cars) {
          if (c.wrecked || !G.vehicles.list.includes(c) || c.kind === 'sedan') continue;   // [O6b] (every sedan of the bed is locked: no seat in it yet)
          const d = Math.hypot(c.pos.x - ctx.controller.pos.x, c.pos.z - ctx.controller.pos.z) - c.spec.halfL * 0.6;
          if (d < bd) { bd = d; best = c; }
        }
        if (best && best !== R.car && !R.car.vel.lengthSq()) R.car = best;
      }
      // the sedan across the way: its door tried, locked (a rattle, as the city's
      // street doors - the critic's minor: no prompt, no answer)
      let atSedan = false, sd = null;
      if (!R.inCar) for (const c of R.cars) {
        if (c.kind !== 'sedan' || c.wrecked || !G.vehicles.list.includes(c) || (c.smashD && c.smashD.state === 'burning')) continue;
        const l = c.local(ctx.controller.pos, _v);
        if (Math.hypot(Math.max(0, Math.abs(l.x) - c.spec.halfL), Math.max(0, Math.abs(l.z) - c.spec.halfW)) < 1.4) { atSedan = true; sd = c; break; }
      }
      if (atSedan !== !!T.atSedan) { T.atSedan = atSedan; if (atSedan) ctx.hud.prompt('E  try the door', null, 'bedsedan'); else ctx.hud.clearPrompt('bedsedan'); }
      if (atSedan && ctx.pressed('KeyE')) { G.sfx.play('f_c4rattle', V(sd.pos.x, 1.1, sd.pos.z)); ctx.hud.message('locked', 1.2); }
      // every car but the one the roam steps (the tram, the parked ones)
      for (const v of G.vehicles.list) if (v !== R.car) v.step(dt);
      dealT -= dt;
      if (dealT <= 0) { dealT = 0.25; G.vehicles.dealLights(); }
      roam(ctx, R, T, dt);
    });
    for (;;) yield null;
  },
});
void NORTH;
