import * as THREE from 'three';
import { SITE, BEATS, DINER, DOORS } from './site.js';
import { Rails } from './rails.js';
import { freshRoom, placeDot, makeCounterGun, makeSwitch, setRoomLights, restoreRoomLights, reserveLayer } from './room.js';
import { buildTommyGeometry, buildDrumGeometry } from '../../player/Viewmodel.js';
import { WEAPON } from '../../player/Weapon.js';

// The scene's machinery (B7, scene 9): what lives across the beats and the
// retries (the cars on their rails, the gun and the drums on the counter,
// the switch, the drums I carry, the room's lights, dying), what staging a
// beat does, and what runs every step under the script. Everything it adds
// to the block it takes away when the scene ends (teardown).
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
export const RESERVE = { start: 2, max: 4, slide: 2 };

let RIG = null;
// a death sends the scene back to the start of its beat: the room as it is
let RETRY = null;
export const rig = () => RIG;

// ---- the rig: made on the scene's first entry, kept through its retries ---------------
export function rigFor(ctx) {
  const G = ctx.game, S = ctx.stage;
  if (RIG && RIG.stage === S) return RIG;
  if (RIG) teardown(RIG);
  const R = RIG = {
    stage: S, game: G, rails: new Rails(G, S), cars: {}, men: new Map(), beatAt: {},
    lightsOn: true, reserve: RESERVE.start, gunTaken: false, dying: null, hat: null, end: null,
    onDeath0: G.health.onDeath, reload0: null, fire0: null, vmBase0: { pos: G.vm.base.pos.clone(), rot: G.vm.base.rot.clone() },
    ticks: [],
  };
  // the counter's things: the Tommy gun and its two drums
  const build = { gun: () => buildTommyGeometry(), drum: () => buildDrumGeometry() };
  R.gun = makeCounterGun(S, build);
  R.gun.group.visible = false;
  S.scene.add(R.gun.group);
  for (const d of R.gun.drums) { d.visible = false; S.scene.add(d); }
  R.sw = makeSwitch(S);
  S.scene.add(R.sw);
  // the drums I carry: a reload takes one, none left and it does nothing
  const W = G.weapon;
  R.reload0 = W.reload;
  W.reload = function b7reload() {
    if (!RIG || this.reloading || this.ammo === WEAPON.drum) return false;
    if (RIG.reserve <= 0) { RIG.outT = 2.5; return false; }
    const ok = R.reload0.call(this);
    if (ok) RIG.reserve--;
    return ok;
  };
  // (the headless play reads the rig here: the drums I carry, the hat)
  G.b7 = R;
  // (the scene is over when it leaves: the next entry makes a new rig)
  R.onExit = () => {
    if (RETRY) return;
    if (RIG === R) teardown(R);
  };
  G.on('scene:exit', R.onExit);
  return R;
}

export function teardown(R) {
  const G = R.game, S = R.stage;
  if (RIG === R) RIG = null;
  if (G.b7 === R) G.b7 = null;
  G.off('scene:exit', R.onExit);
  G.director.stop();
  for (const h of [...S.hoods.list]) G.removeHood(h);
  G.corpses.length = 0;
  G.pending.length = 0;
  R.rails.dispose();
  S.scene.remove(R.gun.group, R.sw, ...R.gun.drums);
  if (R.hat) { S.scene.remove(R.hat.obj); if (R.hat.cigar) S.scene.remove(R.hat.cigar); }
  restoreRoomLights(S);
  G.weapon.reload = R.reload0;
  if (R.fire0) G.weapon.fire = R.fire0;
  G.health.onDeath = R.onDeath0;
  G.vm.base.pos.copy(R.vmBase0.pos); G.vm.base.rot.copy(R.vmBase0.rot);
  G.vm.lowerTo(0, true);
  G.hands.studyFov = false;
  const d = S.part('diner');
  if (d && d.trainBars) d.trainBars.hide();
  barsBack(S);
  if (G.sfx && G.sfx.live) for (const k of [...G.sfx.loops.keys()]) if (k.startsWith('b7')) G.sfx.stopLoop(k);
}

// ---- staging a beat: the room, the people and me where the story has them ---------------
export function stageBeat(ctx, b) {
  const G = ctx.game, S = ctx.stage;
  const retry = !!(RETRY && RETRY.beat === b);
  RETRY = null;
  const R = rigFor(ctx);
  const bi = BEATS.indexOf(b);
  G.director.stop();
  // the men: a retry keeps the dead of the beats before; a fresh entry, nobody
  for (const h of [...S.hoods.list]) if (!retry || h.alive || h.b7beat === b) G.removeHood(h);
  G.corpses = G.corpses.filter((h) => S.hoods.list.includes(h));
  G.pending.length = 0;
  ctx.cast.list.filter((c) => c.kind !== 'waitress').forEach((c) => ctx.cast.remove(c));
  if (!retry) {
    R.rails.clear();
    R.cars = {};
    freshRoom(ctx);
    // a jump into a later beat: what the story has done by then
    if (bi > BEATS.indexOf('cars')) laterRoom(ctx, R, b);
    R.lightsOn = true;
    R.reserve = RESERVE.start;
  } else {
    // this beat's cars come again; the wrecks of the beats before stay
    for (const [k, car] of Object.entries(R.cars)) if (car.b7beat === b) { R.rails.remove(car); delete R.cars[k]; }
    const A = R.beatAt[b];
    if (A) { R.reserve = Math.max(RESERVE.start, A.reserve); R.lightsOn = A.lights; }
  }
  R.hatReset && R.hatReset();
  placeDot(ctx, b === 'arrive' ? 'lean' : 'duck');
  setRoomLights(S, R.lightsOn);
  R.sw.userData.set(R.lightsOn);
  // me
  G.health.reset();
  G.health.onDeath = () => die(ctx);
  R.dying = null;
  G.controller.frozen = false;
  G.hands.studyFov = false;
  G.vm.base.pos.copy(R.vmBase0.pos); G.vm.base.rot.copy(R.vmBase0.rot);
  if (R.fire0) { G.weapon.fire = R.fire0; R.fire0 = null; }
  const armed = b !== 'arrive';
  R.gunTaken = armed;
  R.gun.group.visible = false;
  for (const d of R.gun.drums) d.visible = false;
  if (armed) {
    G.weapon.reset();
    G.player.weapons.equip('tommy');
    G.vm.lowerTo(0, true);
  } else {
    G.player.weapons.equip(null);
    G.hands.equip('empty', { skin: 'glove' });
  }
  const A = retry && R.beatAt[b];
  const P = A ? A.pose : b === 'arrive' ? SITE.spawn : b === 'doorways' || b === 'el' ? SITE.stations.B2 : b === 'cardinal' || b === 'end' ? SITE.stations.B4 : SITE.stations.door;
  G.controller.setPose(P.x, P.z, P.yaw, P.pitch ?? 0);
  // (the door: shut, unless the story comes in through it this second)
  const front = S.part('dinerFront');
  if (b === 'arrive') { front.door.angle = 1; front.door.target = 1; front.door.holdT = 0.5; }
  ctx.flags.b7 = { beat: b, retry };
  return R;
}

// the room as a jump into a later beat finds it: the glass gone, cars A and
// B burnt out where they stopped
function laterRoom(ctx, R, b) {
  const G = ctx.game, S = ctx.stage;
  const front = S.part('dinerFront');
  if (G) for (const [k, p] of Object.entries(front.panes)) if (p.state !== 'gone') S.glass.shatter(p, { dir: V(-1, 0.1, 0), power: 1 });
  SITE.cars.forEach((spec, i) => {
    const car = R.rails.spawn({ rail: spec.rail, lights: false, v0: 0 });
    car.rail.s = car.rail.L; car.rail.done = true; car.rail.stopped = true;
    R.rails.place(car, 0);
    car.b7beat = 'cars';
    R.cars['car' + i] = car;
    S.cars.wreckNow(car, i ? 'B' : 'C', { fire: b === 'doorways', rollSgn: 1 });
    R.rails.settle(car);
  });
}

// what a beat began with (a retry puts me back there)
export function markBeat(ctx, b) {
  const R = RIG, G = ctx.game, C = G.controller;
  if (!R) return;
  if (R.beatAt[b] && ctx.flags.b7 && ctx.flags.b7.retry) return;
  R.beatAt[b] = { pose: { x: C.pos.x, z: C.pos.z, yaw: C.yaw, pitch: Math.max(-0.3, Math.min(0.3, C.pitch)) }, reserve: R.reserve, lights: R.lightsOn };
}

// ---- dying: the frame goes, black, and back at the start of the beat ----------------------
function die(ctx) {
  const G = ctx.game, R = RIG;
  if (!R || R.dying) return;
  R.dying = { t: 0, beat: G.scenes.beat };
  G.controller.frozen = true;
  G.weapon.trigger = false;
  G.vm.lowerTo(1);
  G.counters.deaths++;
  G.emit('player:down', {});
}
function dyingStep(ctx, dt) {
  const R = RIG, G = ctx.game;
  const D = R.dying;
  D.t += dt;
  // (he goes down: the eye sinks and tips)
  const k = Math.min(1, D.t / 0.8), e = k * k * (3 - 2 * k);
  G.controller.pitch = Math.max(-1.0, G.controller.pitch - dt * 0.9 * (1 - e));
  if (D.t >= 0.9 && !D.gone) {
    D.gone = true;
    RETRY = { beat: D.beat };
    G.scenes.go('shootout', { beat: D.beat, fade: 'black', card: false, fadeIn: 1.1 });
  }
}

// ---- the men -------------------------------------------------------------------------------
// every man of the scene is spawned through here: his beat and group, the
// room's lights on his aim
export function man(ctx, spec) {
  const G = ctx.game, R = RIG;
  const aim = (spec.aim ?? 1) * (R.lightsOn ? 1 : 0.6);
  const h = G.director.spawn({ who: spec.heavy ? 'heavy' : 'hood', at: spec.at, yaw: spec.yaw ?? null, group: spec.group, entry: spec.entry || 'idle', run: spec.run, post: spec.post, leash: spec.leash, wake: spec.wake, aim, hp: spec.hp, brain: spec.brain || 'cover', variant: spec.variant || null, ...(spec.opts || {}) });
  h.b7beat = ctx.beat;
  h.b7aim = spec.aim ?? 1;
  return h;
}

// the lights: the men outside shoot worse at what they cannot see
export function setLights(ctx, on) {
  const R = RIG, G = ctx.game;
  R.lightsOn = on;
  setRoomLights(ctx.stage, on);
  R.sw.userData.set(on);
  G.sfx.play('b7_switch', V(SITE.switch.x, SITE.switch.y, SITE.switch.z));
  for (const [h, ai] of G.ais) if (h.alive) ai.aim = (h.b7aim ?? 1) * (on ? 1 : 0.6) * (h.b7aimK ?? 1);
}

// a round from a man's gun at a point (the windows, a lamp, the front): his
// flash and his shot's sound, the round's real ray
export function roundAt(G, h, target, { heavy = false } = {}) {
  if (!h.alive) return;
  const muzzle = h.fire();
  if (!muzzle) return;
  const dir = _v.subVectors(target, muzzle).normalize();
  G.fx.flash.hood(h, muzzle, dir.clone(), G.time, heavy);
  if (heavy) G.sfx.play('tommy', muzzle, { pitch: 0.92 }, { ref: 4, delay: Math.min(0.25, muzzle.distanceTo(G.eye) / 343) });
  else G.sfx.pistol(muzzle, muzzle.distanceTo(G.eye));
  G.counters.hoodShots++;
  G.pacing.shot(G.time);
  const hit = G.rays.raycast(muzzle, dir, muzzle.distanceTo(target) + 6);
  if (hit) G.react.bullet(hit, dir.clone());
}

// ---- every step under the script -------------------------------------------------------------
export function everyStep(ctx, dt) {
  const R = RIG, G = ctx.game, S = ctx.stage;
  if (!R) return;
  R.rails.update(dt, G.time);
  for (const f of [...R.ticks]) if (f(dt) === false) R.ticks.splice(R.ticks.indexOf(f), 1);
  if (R.dying) dyingStep(ctx, dt);
  // a man at the door opens it (and the bell tells me)
  const front = S.part('dinerFront'), D = DINER;
  for (const h of S.hoods.list) {
    if (!h.alive) continue;
    if (Math.abs(h.pos.z - (D.door.hingeZ + D.door.w / 2)) < 1.2 && h.pos.x < -8.6 && h.pos.x > -12.5) front.door.open();
  }
  headlampsInRoom(ctx);
  // the drums I carry, beside the ammo
  const L = R.res || (R.res = reserveLayer(G.hud));
  R.outT = Math.max(0, (R.outT || 0) - dt);
  const out = G.weapon.ammo === 0 && !G.weapon.reloading && R.reserve === 0;
  L.set(R.reserve, G.hands.set === 'tommy', out || R.outT > 0 ? 'drums: the counter' : '');
  // the old man's cup still steams on the counter
  R.steamT = (R.steamT || 0) - dt;
  if (R.steamT <= 0 && G.fx && G.fx.puff) {
    R.steamT = 0.5;
    const cup = S.part('diner').items.get('cup.oldman');
    if (cup && cup.parent) {
      const p = cup.getWorldPosition(_w).add(V(0, 0.06, 0));
      G.fx.puff.spawn({ pos: p, vel: V(0.01, 0.13, 0), life: 2.2, size: [0.05, 0.05], grow: 0.08, rot: 0, spin: 0.2, col: [0.5, 0.5, 0.5], alpha: 0.2, drag: 0.5, fadeIn: 0.3, fadeOut: 0.8, cell: 0 });
    }
  }
}

// the headlamps of a car facing the diner light the room through its
// windows: the train's light bars (props/diner/booths.js), driven by where
// each lit beam meets the front wall
function headlampsInRoom(ctx) {
  const R = RIG, S = ctx.stage;
  const d = S.part('diner');
  if (!d || !d.trainBars || d.train) return;
  const bars = [];
  for (const car of R.rails.list) {
    const Rr = car.rail;
    if (!Rr || !Rr.lit || car.state === 'burning' || car.lensBroken.every((b) => b)) continue;
    const g = car.group;
    const o = _v.set(2.3, 1.0, 0).applyMatrix4(g.matrixWorld);
    const f = _w.set(1, 0, 0).transformDirection(g.matrixWorld);
    if (f.x > -0.2) continue;
    // where the beam's axis meets the plane of the front
    const t = (DINER.faceX - o.x) / f.x;
    if (t < 0 || t > 40) continue;
    const z = o.z + f.z * t;
    const facing = Math.min(1, -f.x);
    const k = Math.min(1, 7 / Math.max(3, t)) * facing * (car.lensBroken.filter((b) => !b).length / 2);
    const w = 1.6 + t * 0.12;
    bars.push({ z0: z - w, z1: z + w, k: Math.min(1, 1.6 * k) });
  }
  if (!bars.length) { if (R.barsOn) { d.trainBars.hide(); R.barsOn = false; } return; }
  if (!R.barsOn) {
    R.barsOn = true;
    // (brighter than the train's windows: a car's lamps, near)
    for (const m of new Set(d.trainBars.quads.map((q) => q.m.material))) if (!m.userData.b7) { m.userData.b7 = m.color.clone(); m.color.multiplyScalar(3.2); }
  }
  d.trainBars.set(bars);
}
export function barsBack(stage) {
  const d = stage.part('diner');
  if (!d || !d.trainBars) return;
  for (const m of new Set(d.trainBars.quads.map((q) => q.m.material))) if (m.userData.b7) { m.color.copy(m.userData.b7); delete m.userData.b7; }
}

export { V };
