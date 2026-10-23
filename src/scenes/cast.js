import * as THREE from 'three';
import { defineScene, beat } from '../game/script.js';
import { People } from '../people/People.js';
import { LOOKS } from '../people/costumes.js';
import { PAVE } from '../world/plan.js';
import { merge, roundedBox } from '../world/geom.js';

// [O8] The cast's bed (lane O8, docs/briefs/O8_FIGURES.md §4): NOT a scene of
// the game - ?start=cast plays it, ?scene=cast&beat=<b> frames it. The city's
// own Grand Ave between Fifth St and Centre St, under the el, in the rain:
//   parade   every look of the city in its variants walking up and down the
//            avenue, turning at the ends (a turn that steps), and a row
//            standing on the east pavement in their idles
//   lineup   the looks standing in three rows under the lamp, facing me (the
//            critic's sheet: told apart by the outline)
//   falls    the physics layer: a man knocked down in the open (he gets up),
//            one shot against the facade, one in a doorway, one on a stoop's
//            steps - every nine seconds again
//   cars     a sedan at 20 km/h and one at 50 km/h into a man standing in the
//            road (under it / over the bonnet), every ten seconds again
//   crowd    forty figures walking and twelve bodies down (the budget's moment)
// game.castBed: { men, bodies, stats, rec } for the plays (tools/plays/o8_*).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const NORTH = 0, SOUTH = Math.PI, EAST = -Math.PI / 2, WEST = Math.PI / 2;
export const BED = {
  // the west facade (x -134, facing +x) and the stoop + doorway the bed builds on it
  facade: -134,
  stoop: { z: 38.0, w: 1.9, steps: 4, rise: 0.17, run: 0.32, landing: 1.0 },
  me: { x: -118.5, z: 40, yaw: SOUTH, pitch: -0.05 },
};
const LOOK_IDS = () => Object.keys(LOOKS).concat(['o3_newsboy', 'o3_patrolman', 'o3_docksman', 'o3_tough']);

// ---- the stoop and the doorway (built once a stage: a mesh, its walking surface, its jambs) ----
function buildStoop(stage) {
  if (stage._o8stoop) return stage._o8stoop;
  const S = BED.stoop, x0 = BED.facade, top = PAVE + S.steps * S.rise;
  const parts = [];
  const mat = stage.M.kerb || stage.M.concrete || new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
  // the landing, then the steps down toward the street
  parts.push(roundedBox(S.landing, top, S.w, 0.02).translate(x0 + S.landing / 2, top / 2, S.z));
  for (let i = 0; i < S.steps; i++) {
    const h = PAVE + (S.steps - 1 - i) * S.rise + S.rise * 0.0;
    const xa = x0 + S.landing + i * S.run;
    parts.push(roundedBox(S.run, h, S.w, 0.015).translate(xa + S.run / 2, h / 2, S.z));
  }
  // the doorway's jambs and lintel, the door shut in it
  const jw = 0.28, jd = 0.42, dh = 2.5;
  for (const sz of [-1, 1]) parts.push(roundedBox(jd, dh, jw, 0.02).translate(x0 + jd / 2, top + dh / 2, S.z + sz * (0.62 + jw / 2)));
  parts.push(roundedBox(jd, 0.3, 1.24 + 2 * jw, 0.02).translate(x0 + jd / 2, top + dh + 0.15, S.z));
  const g = merge(parts);
  const m = new THREE.Mesh(g, mat);
  m.name = 'o8stoop';
  m.receiveShadow = true; m.castShadow = true;
  stage.scene.add(m);
  stage.addSolid(m);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, dh - 0.05, 1.22), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.7 }));
  door.position.set(x0 + 0.03, top + dh / 2, S.z);
  stage.scene.add(door);
  stage.addSolid(door);
  // its walking surface: the landing and the steps (a body on them lies on them)
  stage.addSurface((x, z) => {
    if (Math.abs(z - S.z) > S.w / 2 || x < x0 - 0.05 || x > x0 + S.landing + S.steps * S.run) return undefined;
    if (x < x0 + S.landing) return top;
    const i = Math.floor((x - x0 - S.landing) / S.run);
    return PAVE + (S.steps - 1 - i) * S.rise;
  });
  // the jambs are solid; the steps' sides too (a man walks up them, not through them)
  const C = stage.colliders;
  for (const sz of [-1, 1]) C.addBox(x0 + jd / 2, S.z + sz * (0.62 + jw / 2), jd / 2, jw / 2, 0, 'wall');
  C.addBox(x0 - 0.15, S.z, 0.15, 1.2, 0, 'wall');
  stage._o8stoop = { top, m, door };
  return stage._o8stoop;
}

// the bed's lamps hung from the el over the stations (the city's lamp deal: the nearest
// take the real lights and the cones), so every proof is seen in a pool of light
const LAMPS = [[-127.0, 5.6, 36.6], [-120.0, 5.6, 47.0], [-120.0, 5.6, 28.5], [-112.8, 5.4, 40.0]];
function bedLamps(stage) {
  if (stage._o8lamps) return stage._o8lamps;
  const api = stage.part('lamps');
  const list = [];
  for (const [x, y, z] of LAMPS) {
    const head = V(x, y, z);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), stage.M.bulb);
    bulb.position.copy(head);
    bulb.userData.noRay = true;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 20, 1, true), stage.M.kerb);
    shade.position.set(x, y + 0.1, z);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 5), stage.M.kerb);
    rod.position.set(x, y + 0.8, z);
    stage.scene.add(bulb, shade, rod);
    list.push({ x, z, yaw: 0, kind: 'room', head: head.clone().setY(y - 0.08), on: true, dead: false, _k: 1, cone: null, entry: null, hanging: true, room: true, power: 120, drop: y - 0.1, noCone: false, bulb });
  }
  if (api && api.addExtra) api.addExtra(list);
  stage._o8lamps = list;
  return list;
}

function peopleFor(ctx) {
  const G = ctx.game;
  if (G.people && G.people.stage !== ctx.stage) { G.people.dispose(); G.people = null; }
  if (!G.people) G.people = new People(G, ctx.stage);
  const P = G.people;
  P.afterFail('reset');
  P.hold = true;
  return P;
}

function place(ctx, me = BED.me) {
  const G = ctx.game, stage = ctx.stage;
  stage.part('stream').warmAround(me.x, me.z);
  if (stage.part('dressing')) stage.part('dressing').warmAround(me.x, me.z);
  G.vehicles.clear();
  G.city = G.city && G.city.bed ? G.city : { bed: 'cast', inCar: false };
  G.player.hands.equip('empty');
  G.setViewmodelVisible(false);
  ctx.controller.setPose(me.x, me.z, me.yaw, me.pitch ?? -0.05);
  stage.part('bounds').navAround(me.x, me.z, 14);
  buildStoop(stage);
  bedLamps(stage);
}

// ---- the bed's men: a Person of the city in a role no brain of the street steps ----------------
function man(P, look, x, z, yaw, opts = {}) {
  const p = P.spawn(look, x, z, yaw, 'parade', opts);
  p.mode = 'stand'; p.until = 1e9; p.t = 0; p.stop();
  return p;
}

// a station of the falls: stands a man, does a thing to him at `at`, again every `every`
function station(B, P, def) {
  const S = { ...def, t: 0, n: 0, p: null };
  S.spawn = () => {
    if (S.p) P.release(S.p);
    S.p = man(P, S.look, S.x, S.z, S.yaw);
    S.p.fig._bedName = S.name;
    S.t = 0; S.done = false; S.n++;
    S.rec = { name: S.name, n: S.n, t0: null, settled: null, minY: Infinity, through: 0, maxV: 0 };
    B.rec.push(S.rec);
  };
  S.spawn();
  return S;
}

function stepStations(B, P, dt) {
  for (const S of B.stations) {
    S.t += dt;
    if (!S.done && S.t >= S.at) { S.done = true; S.rec.t0 = B.T; S.act(S.p, S); }
    const F = S.p && S.p.fig;
    if (F && F.rag) {
      // the record: how low any part went (under the surface: through), when it lay still
      const R = F.rag;
      for (let i = 0; i < R.p.length; i++) {
        const g = ctx0.stage.surfaceY(R.p[i].x, R.p[i].z);
        const h = R.p[i].y - g - R.r[i];
        if (h < S.rec.minY) S.rec.minY = h;
      }
      S.rec.maxV = Math.max(S.rec.maxV, R.stats.maxV);
      if (R.asleep && S.rec.settled == null) S.rec.settled = +(B.T - S.rec.t0).toFixed(2);
      // (through a wall or a post: a point more than 4 cm into one, counted every step)
      if (!R.asleep || !S.rec.checkedAsleep) { S.rec.through += throughWalls(R); if (R.asleep) S.rec.checkedAsleep = true; }
      // (where it lies, the last of it)
      S.rec.at = [+R.p[0].x.toFixed(2), +R.p[0].y.toFixed(2), +R.p[0].z.toFixed(2)];
    }
    if (S.getUp && S.p && S.p.down && !S.p.dead && S.t > S.at + S.getUp) { S.p.getUp(); }
    if (S.t >= S.every) S.spawn();
  }
}
let ctx0 = null;
// the points of a body more than 4 cm into a wall's box or a post (the city's colliders)
function throughWalls(R) {
  const C = ctx0.stage.colliders, pv = R.p[0];
  const L = C.near ? C.near(pv.x, pv.z, 2.6) : C.boxes;
  let n = 0;
  for (let i = 0; i < R.p.length; i++) {
    const p = R.p[i], r = R.r[i] * 0.4;
    for (const o of L) {
      if (o.gone) continue;
      if (o.r != null) { if (o.tag === 'hood' || o.tag === 'person' || o.tag === 'corpse' || o.tag === 'cast') continue; if (Math.hypot(p.x - o.x, p.z - o.z) < o.r - 0.04 + r * 0) { n++; break; } continue; }
      if (o.hx < 0.005 && o.hz < 0.005) continue;
      if (o.holes && o.holes.some((h) => p.z > h[0] && p.z < h[1])) continue;
      const dx = p.x - o.cx, dz = p.z - o.cz, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      if (Math.abs(lx) < o.hx - 0.04 && Math.abs(lz) < o.hz - 0.04) { n++; break; }
    }
  }
  return n;
}

// a man shot where he stands, the round from `from`
function shoot(p, from, dead = true) {
  const d = V(p.pos.x - from.x, 0, p.pos.z - from.z).normalize();
  p.knock(d, { dead, why: 'shot' });
}
function punch(p, from) {
  const d = V(p.pos.x - from.x, 0, p.pos.z - from.z).normalize();
  p.knock(d, { why: 'punch' });
}

// ---- the beats ------------------------------------------------------------------------------------
// every look the city wears (the crowd's, the police's, the gangs', the fights' and the rooms' men)
const ALL = () => [...Object.keys(LOOKS), 'o3_newsboy', 'o3_patrolman', 'o3_docksman', 'o3_tough', 'o4_boxer', 'o4_driver', 'o4_drunk', 'o4_gangster', 'o4_cop']
  .filter((k, i, a) => a.indexOf(k) === i && !!LOOKS_OK(k));
const LOOKS_OK = (k) => { try { return !!castKinds()[k]; } catch (e) { return false; } };
let _kinds = null;
const castKinds = () => _kinds || (_kinds = Object.fromEntries(Object.keys(LOOKS).concat(['o3_newsboy', 'o3_patrolman', 'o3_docksman', 'o3_tough', 'o4_boxer', 'o4_driver', 'o4_drunk', 'o4_gangster', 'o4_cop']).map((k) => [k, true])));
// (the role a look stands in: its own style's - a cop's carriage, a gang man's swagger)
const roleOf = (k) => (/cop|patrolman/.test(k) ? 'cop' : /docks|caps|tough|gangster/.test(k) ? 'gang' : 'walker');
// the x of the el's columns down the avenue (a man is never put through one)
const clearX = (x) => Math.abs(x + 123.9) > 1.0 && Math.abs(x + 116.1) > 1.0;
const SETUP = {
  // three rows under the lamps facing me, every look in the variants where it stands
  lineup(ctx, B, P) {
    const looks = ALL();
    const xs = [];
    for (let x = -128.6; x <= -111.4; x += 1.25) if (clearX(x)) xs.push(x);
    let k = 0;
    B.men = [];
    for (const z of [37.6, 36.2, 34.8]) {
      for (const x of xs) {
        const look = looks[k % looks.length]; k++;
        const p = P.spawn(look, x + (z === 36.2 ? 0.6 : 0), z, 0, roleOf(look));
        p.role = 'parade'; p.mode = 'stand'; p.until = 1e9; p.t = 0; p.stop();
        B.men.push(p);
      }
    }
  },
  // the looks walking up and down the avenue's three lanes, turning at the ends; a row standing on
  // the east pavement in their idles
  parade(ctx, B, P) {
    const looks = ALL();
    B.men = [];
    const lanes = [-127.6, -120.0, -112.7];
    const gaits = ['walk', 'stroll', 'walk', 'hurry', 'walk', 'stroll'];
    let k = 0;
    for (let i = 0; i < 18; i++) {
      const lane = lanes[i % 3], z0 = 20 + ((i * 7.3) % 34), north = i % 2 === 0;
      const look = looks[(k++ * 5) % looks.length];
      const p = P.spawn(look, lane + ((i % 5) - 2) * 0.35, z0, north ? 0 : Math.PI, roleOf(look));
      p.role = 'parade';
      const gait = gaits[i % gaits.length];
      const back = (q) => { const zz = q.pos.z > 37 ? 19 : 55; q.mode = 'walk'; q.goTo([[q.pos.x, zz]], { gait, then: back }); };
      p.mode = 'walk'; p.goTo([[p.pos.x, north ? 55 : 19]], { gait, then: back });
      B.men.push(p);
    }
    for (let i = 0; i < 9; i++) {
      const look = looks[(k++ * 5 + 2) % looks.length];
      const p = P.spawn(look, -108.6 + (i % 2) * 0.5, 24 + i * 3.1, -Math.PI / 2, roleOf(look));
      p.role = 'parade'; p.mode = 'stand'; p.until = 1e9; p.t = 0; p.stop();
      B.men.push(p);
    }
  },
  // what a man means to do, shown before he does it (the AI read proofs): a witness sees a man
  // knocked down and points at me before he runs to tell it (1 s); a cop sent to me walks over,
  // his palm out at 'Hands up.' (4 s); a gang's three turn on me, each hand into the coat a breath
  // before the gun comes out (8 s). The bed stands each down after (no arrest, no gunfight here).
  intent(ctx, B, P) {
    const G = ctx.game;
    const R = B.intent = { t: {} };
    B.men = [];
    const victim = man(P, 'o3_fedora_h', -119.2, 39.4, Math.PI / 2);
    const wit = man(P, 'o3_woman_c', -121.8, 37.4, -Math.PI / 2 + 0.6);
    const cop = P.dbgCop(-113.2, 33.5, -0.6, 'beat'); cop.role = 'cop';
    // (the two of the street are walkers: the street's own brain takes the witness to his box)
    victim.role = 'walker'; wit.role = 'walker';
    R.victim = victim; R.wit = wit; R.cop = cop;
    B.men.push(victim, wit, cop);
    B.at = (t, fn) => (B.timers || (B.timers = [])).push({ t, fn });
    B.at(1.0, () => {
      R.t.punch = B.T;
      victim.knock(V(-1, 0, -0.3).normalize(), { why: 'punch' });
      const rec = P.crime.emit('punch', victim.pos, 'player', { victim });
      if (wit.mode !== 'report' && rec) P.startReport(wit, rec);
    });
    B.at(4.0, () => { R.t.raise = B.T; P.hold = true; P.police.raise(1, G.eye, 'staged'); });
    // (stood down a breath after 'Hands up.': no arrest in the bed; then the gang)
    R.afterHalt = () => {
      P.police.reset(); R.t.reset = B.T;
      B.at(B.T + 0.5, () => { R.three = P.gangs.three('docks', -124.6, 33.6); });
      B.at(B.T + 2.0, () => { const T = R.three; if (T) { R.t.hostile = B.T; P.gangs.hostile(T, 'gun'); } });
      B.at(B.T + 3.6, () => { try { P.police.guns.end(true); } catch (e) { /* */ } R.t.end = B.T; });
    };
  },
  // the budget's moment: forty walking the avenue and twelve bodies down in it (fps, memory)
  crowd(ctx, B, P) {
    const looks = ALL();
    B.men = [];
    const lanes = [-128.4, -126.8, -121.2, -119.0, -113.6, -111.8, -108.6, -131.6];
    for (let i = 0; i < 40; i++) {
      const lane = lanes[i % lanes.length], z0 = 14 + ((i * 5.9) % 46), north = (i >> 1) % 2 === 0;
      const look = looks[(i * 7 + 3) % looks.length];
      const p = P.spawn(look, lane, z0, north ? 0 : Math.PI, roleOf(look));
      p.role = 'parade';
      const gait = ['walk', 'stroll', 'hurry'][i % 3];
      const back = (q) => { const zz = q.pos.z > 37 ? 12 : 62; q.mode = 'walk'; q.goTo([[q.pos.x, zz]], { gait, then: back }); };
      p.mode = 'walk'; p.goTo([[p.pos.x, north ? 62 : 12]], { gait, then: back });
      B.men.push(p);
    }
    // the bodies: twelve knocked down at once in the first second, in the road between the lanes
    B.bodies = [];
    for (let i = 0; i < 12; i++) {
      const look = looks[(i * 11 + 5) % looks.length];
      const x = -125.0 + (i % 4) * 2.6, z = 18 + Math.floor(i / 4) * 9 + (i % 2) * 1.5;
      if (!clearX(x)) continue;
      const p = man(P, look, x, z, i * 1.3);
      B.bodies.push(p);
      P.later(0.3 + i * 0.05, () => p.knock(V(Math.sin(i * 1.3), 0, Math.cos(i * 1.3)), { dead: i % 3 === 0, why: i % 3 === 0 ? 'shot' : 'punch' }));
    }
  },
  falls(ctx, B, P) {
    const S = BED.stoop;
    const street = { x: -121, z: 37 };
    B.stations = [
      // in the open on the road between the el's columns: a punch from the east; up after 4 s
      station(B, P, { name: 'knock', look: 'o3_fedora_c', x: -125.0, z: 41.5, yaw: EAST, at: 1.0, every: 9, getUp: 4.2, act: (p) => punch(p, { x: -123.6, z: 41.3 }) }),
      // against the facade: shot from the street, his back to the wall
      station(B, P, { name: 'wall', look: 'o3_fedora_a', x: BED.facade + 0.6, z: 33.6, yaw: EAST, at: 1.3, every: 9, act: (p) => shoot(p, street) }),
      // in the doorway on the landing: shot from the street, the door behind him
      station(B, P, { name: 'doorway', look: 'o3_tec_a', x: BED.facade + 0.55, z: S.z, yaw: EAST, at: 1.6, every: 9, act: (p) => shoot(p, street) }),
      // on the stoop's steps: shot from the side, down the steps
      station(B, P, { name: 'stair', look: 'o3_woman_b', x: BED.facade + S.landing + 0.45, z: S.z - 0.3, yaw: NORTH + 0.6, at: 1.9, every: 9, act: (p) => shoot(p, { x: BED.facade + 1.6, z: S.z + 6 }) }),
    ];
  },
  // a sedan at 20 km/h (east lane, near me) and one at 50 km/h (west lane) into a man in the road
  cars(ctx, B, P) { carsAt(B, P, [[20, -112.6, 'o3_fedora_d'], [50, -127.4, 'o3_fedora_b']]); },
  car20(ctx, B, P) { carsAt(B, P, [[20, -112.6, 'o3_fedora_d']]); },
  car50(ctx, B, P) { carsAt(B, P, [[50, -127.4, 'o3_fedora_b']]); },
};
const MAN_Z = 40;
function carsAt(B, P, list) {
  B.cars = [];
  for (const [kmh, x, look] of list) {
    const st = station(B, P, { name: 'car' + kmh, look, x, z: MAN_Z, yaw: EAST, at: 1e9, every: 1e9, act: () => {} });
    st.kmh = kmh;
    B.stations.push(st);
    B.cars.push({ x, kmh, st, v: null, t: 0 });
  }
}

// the intent beat's record: when each man showed what he meant, and when he did it
function watchIntent(B, P) {
  const R = B.intent, T = R.t;
  const first = (k, cond) => { if (T[k] == null && cond) T[k] = +B.T.toFixed(3); };
  first('point', R.wit.gestureName === 'o8_point');
  first('witGo', R.wit.mode === 'report' && R.wit.phase === 'go');
  first('halt', R.cop.gestureName === 'o8_halt');
  first('handsUp', P.police.warned === 'Hands up.');
  if (T.handsUp != null && T.reset == null && B.T > T.handsUp + 0.7) R.afterHalt();
  if (R.three) {
    for (const [i, p] of R.three.men.entries()) {
      first('reach' + i, p.gestureName === 'o8_reach');
      first('draw' + i, !!p.armed);
    }
  }
}

function stepCars(ctx, B, dt) {
  const G = ctx.game;
  for (const C of B.cars || []) {
    C.t += dt;
    const sp = C.kmh / 3.6;
    if (!C.v) {
      // (the car starts far enough down the avenue to reach him at t = 2.0 s)
      const z0 = MAN_Z - sp * 2.0 - 2.45;
      C.v = G.vehicles.spawn('sedan', { at: V(C.x, 0, z0), yaw: Math.PI / 2, lights: true });
      // (a car driven by the bed: straight up the lane, at its speed until 6 m past him, then braking)
      C.v.driver = { kinematic: true, drive: (v, h) => {
        const past = v.pos.z - MAN_Z;
        const want = past > 6 ? Math.max(0, Math.hypot(v.vel.x, v.vel.z) - 9 * h) : sp;
        v.vel.set(0, 0, want);
        v.pos.z += want * h;
      } };
      C.v.vel.set(0, 0, sp);
      C.st.rec.t0 = B.T;
    }
    if (C.t >= 10) { G.vehicles.remove(C.v); C.v = null; C.t = 0; C.st.spawn(); }
  }
}

export default defineScene({
  id: 'cast', stage: 'noircity', title: '', name: 'The cast (the bed)',
  // (station, hospital: where a fall in the bed wakes - its start again, never an unknown beat)
  beats: ['parade', 'lineup', 'falls', 'cars', 'car20', 'car50', 'crowd', 'intent', 'station', 'hospital'],
  objectives: { parade: null, lineup: null, falls: null, cars: null, car20: null, car50: null, crowd: null, intent: null, station: null, hospital: null },
  setup: {
    parade(ctx) { place(ctx, { x: -106.8, z: 30.5, yaw: 1.05, pitch: -0.06 }); },
    lineup(ctx) { place(ctx, { x: -120.0, z: 43.4, yaw: 0, pitch: -0.1 }); },
    falls(ctx) { place(ctx, { x: -120.6, z: 41.0, yaw: WEST - 0.12, pitch: -0.14 }); },
    cars(ctx) { place(ctx, { x: -107.6, z: 46.5, yaw: 1.12, pitch: -0.08 }); },
    car20(ctx) { place(ctx, { x: -107.8, z: 45.0, yaw: 0.85, pitch: -0.12 }); },
    car50(ctx) { place(ctx, { x: -119.0, z: 49.5, yaw: 0.55, pitch: -0.1 }); },
    crowd(ctx) { place(ctx, { x: -120.0, z: 66.0, yaw: 0, pitch: -0.04 }); },
    intent(ctx) { place(ctx, { x: -116.9, z: 42.4, yaw: 0.62, pitch: -0.1 }); },
    station(ctx) { place(ctx); },
    hospital(ctx) { place(ctx); },
  },
  *script(ctx) {
    const G = ctx.game;
    yield beat(ctx.beat || 'parade');
    ctx0 = ctx;
    const P = peopleFor(ctx);
    const B = G.castBed = { beat: ctx.beat || 'parade', T: 0, rec: [], stations: [], cars: [] };
    if (SETUP[B.beat]) SETUP[B.beat](ctx, B, P);
    ctx.onStep((dt) => {
      if (G.state !== 'playing' && !G.shotMode) return;
      B.T += dt;
      if (B.timers) for (let i = B.timers.length - 1; i >= 0; i--) if (B.T >= B.timers[i].t) { const f = B.timers[i].fn; B.timers.splice(i, 1); f(); }
      if (B.intent) watchIntent(B, P);
      stepStations(B, P, dt);
      stepCars(ctx, B, dt);
      for (const v of G.vehicles.list) v.step(dt);
      P.step(dt);
    });
    for (;;) yield null;
  },
});
void LOOK_IDS; void EAST;
