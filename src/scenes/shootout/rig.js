import * as THREE from 'three';
import { SITE, BEATS, DINER, DOORS } from './site.js';
import { Rails } from './rails.js';
import { freshRoom, placeDot, makeCounterGun, makeSwitch, setRoomLights, restoreRoomLights, reserveLayer, clearBottles } from './room.js';
import { buildTommyGeometry, buildDrumGeometry } from '../../player/Viewmodel.js';
import { WEAPON } from '../../player/Weapon.js';
import { merge } from '../../world/geom.js';
import { allocInkId, LAYER } from '../../render/layers.js';
import { ShardField } from '../../destruct/Glass.js';
import { wreckMaterials } from '../../destruct/Wreck.js';
import { cabMaterial } from './rails.js';

// The scene's machinery (B7, scene 9): what lives across the beats and the
// retries (the cars on their rails, the gun and the drums on the counter,
// the switch, the drums I carry, the room's lights, dying), what staging a
// beat does, and what runs every step under the script. Everything it adds
// to the block it takes away when the scene ends (teardown).
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
export const RESERVE = { start: 2, max: 4, slide: 2 };
// the men outside shoot worse at what they cannot see: their aim, the room dark
export const LIGHTS_OFF = 0.7;

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
  // [second pass] a signal lamp on the el's west rail over where its gunman
  // stands: his shape black in its cone against the rain (from the diner he
  // was a small thing behind the lattice, ten metres up)
  R.elLamp = elLamp(S);
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
  G.director.level = 0;
  for (const h of [...S.hoods.list]) dropMan(G, S, h);
  G.corpses.length = 0;
  G.pending.length = 0;
  R.rails.dispose();
  S.scene.remove(R.gun.group, R.sw, ...R.gun.drums);
  if (R.elLamp) removeElLamp(S, R.elLamp);
  if (R.hat) { S.scene.remove(R.hat.obj); if (R.hat.cigar) S.scene.remove(R.hat.cigar); }
  restoreRoomLights(S);
  clearBottles(S);
  if (S.glass && S.glass.shards) S.glass.shards.batchRest = false;
  if (R.passes) R.passes.done();
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

// a man out of the scene (the Cardinal is a figure of the cast, drawn as a
// Hood: the cast lets him go, once)
function dropMan(G, S, h) {
  if (h.b7char) { const c = h.b7char; h.b7char = null; if (S.cast.list.includes(c)) { S.cast.remove(c); return; } }
  G.removeHood(h);
}

// the el's signal lamp: an iron post up from the rail, an arm out over the
// deck's edge, a dish shade; its cone down over the gunman's place (a glow
// in the rain only: no light of its own, the seven are spoken for)
function elLamp(S) {
  const E = SITE.el, M = S.M;
  const base = V(E.x - 0.25, 12.0, E.z - 1.05);
  const tip = V(E.x - 0.55, 13.35, E.z - 0.45);
  const g = new THREE.Group();
  const iron = new THREE.Mesh(merge([
    new THREE.CylinderGeometry(0.035, 0.045, 1.4, 8).translate(base.x, base.y + 0.7, base.z),
    new THREE.CylinderGeometry(0.03, 0.03, 0.78, 8).rotateX(Math.PI / 2).rotateY(0.45).translate((base.x + tip.x) / 2, 13.38, (base.z + tip.z) / 2 - 0.05),
  ]), M.lampIron);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.24, 0.16, 20, 1, true).translate(tip.x, tip.y - 0.06, tip.z), M.lampShade);
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24).rotateX(Math.PI / 2).translate(tip.x, tip.y - 0.13, tip.z), M.bulb);
  g.add(iron, shade, bulb);
  const id = allocInkId();
  for (const m of [iron, shade, bulb]) { m.userData.inkId = id; m.userData.noRay = true; }
  S.scene.add(g);
  const head = V(tip.x, tip.y - 0.14, tip.z);
  const axis = V(E.x + 0.1, 11.0, E.z + 0.15).sub(head).normalize();
  const lamp = S.lamps.addCustom({ head, axis, height: 4.2, half: 0.4, real: false, bulb, fadeEnd: 0.8, edgeSoft: 0.35, strength: 2.4, tag: 'b7el' });
  return { g, lamp };
}
function removeElLamp(S, L) {
  S.scene.remove(L.g);
  const l = L.lamp;
  if (l.cone) { S.scene.remove(l.cone); l.cone.geometry.dispose(); l.cone.material.dispose(); }
  if (l.entry) S.lights.remove(l.entry);
  const i = S.lamps.lamps.indexOf(l);
  if (i >= 0) S.lamps.lamps.splice(i, 1);
}

// ---- staging a beat: the room, the people and me where the story has them ---------------
export function stageBeat(ctx, b) {
  const G = ctx.game, S = ctx.stage;
  const retry = !!(RETRY && RETRY.beat === b);
  RETRY = null;
  const R = rigFor(ctx);
  const bi = BEATS.indexOf(b);
  G.director.stop();
  // (how many may fire at once: two in the cars beat, three after it)
  G.director.level = bi > BEATS.indexOf('cars') ? 5 : 4;
  // the men: a retry keeps the dead of the beats before; a fresh entry, nobody
  for (const h of [...S.hoods.list]) if (!retry || h.alive || h.b7beat === b) dropMan(G, S, h);
  G.corpses = G.corpses.filter((h) => S.hoods.list.includes(h));
  G.pending.length = 0;
  ctx.cast.list.filter((c) => c.kind !== 'waitress').forEach((c) => ctx.cast.remove(c));
  if (!retry) {
    R.rails.clear();
    R.cars = {};
    freshRoom(ctx);
    // a jump into a later beat: what the story has done by then
    if (bi > BEATS.indexOf('cars')) laterRoom(ctx, R, b);
    // (b7lights=0, look development: the room already dark)
    R.lightsOn = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('b7lights') === '0');
    // (the drums lie on the counter by the gun until I take them)
    R.reserve = b === 'arrive' ? 0 : RESERVE.start;
  } else {
    // this beat's cars come again; the wrecks of the beats before stay
    for (const [k, car] of Object.entries(R.cars)) if (car.b7beat === b) { R.rails.remove(car); delete R.cars[k]; }
    const A = R.beatAt[b];
    if (A) { R.reserve = Math.max(RESERVE.start, A.reserve); R.lightsOn = A.lights; }
  }
  R.hatReset && R.hatReset();
  // [second pass] (a scene's entry drops the HUD's layers: the drums I carry
  // get theirs again, or they vanish after the first death)
  R.res = null;
  R.calm = false;
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
  R.stackReady = false; R.slide = null;
  if (armed) {
    G.weapon.reset();
    G.player.weapons.equip('tommy');
    G.vm.lowerTo(0, true);
  } else {
    G.player.weapons.equip(null);
    G.hands.equip('empty', { skin: 'glove' });
  }
  const A = retry && R.beatAt[b];
  // [second pass] a retry puts me where the beat began only if that was in
  // the room: never back out in the road before the men who shot me
  const inRoom = (p) => p && p.x < DINER.innerX - 0.25;
  const station = b === 'arrive' ? SITE.spawn : b === 'doorways' || b === 'el' ? SITE.stations.B2 : b === 'cardinal' || b === 'end' ? SITE.stations.B4 : SITE.stations.door;
  const P = A && inRoom(A.pose) ? A.pose : station;
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
  // (and at the end, his saloon where it stopped, its doors open)
  if (b === 'end') {
    const car = R.rails.spawn({ rail: SITE.saloon.rail, lights: true, v0: 0, armored: true });
    car.rail.s = car.rail.L; car.rail.done = true; car.rail.stopped = true;
    R.rails.place(car, 0);
    car.meshes.lens.material = S.M.headlamp;
    car.b7beat = 'cardinal';
    R.cars.saloon = car;
    for (const k of ['rf', 'lf', 'rr']) { const d = R.rails.openDoor(car, k); d.a = d.to * 0.94; d.hinge.rotation.y = -d.D.side * d.a; d.hole.visible = true; }
    R.rails.settle(car);
  }
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
  // (a beat's frame in shot mode is looked at, not played: nobody dies in it)
  if (G.shotMode) { G.health.reset(); return; }
  R.dying = { t: 0, beat: G.scenes.beat };
  // [R2-F] (how often I have gone down in this beat: its men shoot a little
  // worse at each retry - see mercy)
  R.downs = R.downs || {};
  R.downs[R.dying.beat] = (R.downs[R.dying.beat] || 0) + 1;
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
  const aim0 = (spec.aim ?? 1) * mercy(ctx);
  const aim = aim0 * (R.lightsOn ? 1 : LIGHTS_OFF);
  const h = G.director.spawn({ who: spec.heavy ? 'heavy' : 'hood', at: spec.at, yaw: spec.yaw ?? null, group: spec.group, entry: spec.entry || 'idle', run: spec.run, post: spec.post, leash: spec.leash, wake: spec.wake, aim, hp: spec.hp, brain: spec.brain || 'cover', variant: spec.variant || null, ...(spec.opts || {}) });
  h.b7beat = ctx.beat;
  h.b7aim = aim0;
  return h;
}

// [R2-F] fail softly: at each retry of a beat I went down in, its men shoot
// a fifth worse (at most down to 0.55 of their aim). The first try is the
// beat as written; a player who keeps dying in one place is let through it
// in a try or two instead of a loop (a first-timer's play went down three
// times running in the doorways beat)
export function mercy(ctx) {
  const R = RIG, n = (R && R.downs && R.downs[ctx.beat]) || 0;
  return Math.max(0.55, Math.pow(0.8, n));
}

// the lights: the men outside shoot worse at what they cannot see
export function setLights(ctx, on) {
  const R = RIG, G = ctx.game;
  R.lightsOn = on;
  setRoomLights(ctx.stage, on);
  R.sw.userData.set(on);
  G.sfx.play('b7_switch', V(SITE.switch.x, SITE.switch.y, SITE.switch.z));
  for (const [h, ai] of G.ais) if (h.alive) ai.aim = (h.b7aim ?? 1) * (on ? 1 : LIGHTS_OFF) * (h.b7aimK ?? 1);
}

// a round from a man's gun at a point (the windows, a lamp, the front): his
// flash and his shot's sound, the round's real ray
export function roundAt(G, h, target, { heavy = false, shatter = false } = {}) {
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
  // (a pane's second round: the whole of it goes)
  if (hit && shatter && hit.mesh.userData.pane && hit.mesh.userData.pane.state !== 'gone') G.stage.glass.shatter(hit.mesh.userData.pane, { dir: dir.clone(), power: 1.1, at: hit.point });
  else if (hit) G.react.bullet(hit, dir.clone());
}

// ---- every step under the script -------------------------------------------------------------
export function everyStep(ctx, dt) {
  const R = RIG, G = ctx.game, S = ctx.stage;
  if (!R) return;
  if (G.shotMode) devStep(ctx);
  // [R2-F] (the scene's first entry, under the card: the passes seen over
  // its first frames, then the programs compiled for each)
  if (!R.warmed) {
    R.warmN = (R.warmN || 0) + 1;
    const on = !G.shotMode || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('b7warm') === '1');
    if (on && R.warmN === 1) watchPasses(G, S, R);
    // (after a few frames drawn: every pass seen; at most 3 s in)
    if ((R.warmN >= 4 && (!R.passes || R.passes.calls() >= 40)) || R.warmN > 180) { R.warmed = true; if (on) warm(ctx); }
  }
  R.rails.update(dt, G.time);
  for (const f of [...R.ticks]) if (f(dt) === false) R.ticks.splice(R.ticks.indexOf(f), 1);
  if (R.dying) dyingStep(ctx, dt);
  // a man at the door opens it (and the bell tells me)
  const front = S.part('dinerFront'), D = DINER;
  for (const h of S.hoods.list) {
    if (!h.alive) continue;
    if (Math.abs(h.pos.z - (D.door.hingeZ + D.door.w / 2)) < 1.2 && h.pos.x < -8.6 && h.pos.x > -12.5) front.door.open();
  }
  // [R2-F] a man who falls back with a car, a door or a wall at his back
  // goes down forward instead (never back through the car he stood by)
  for (const h of S.hoods.list) {
    if (h.alive || h.b7fall || h.b7char || !(h._deathT >= 0) || h._deathT > 0.12) continue;
    h.b7fall = true;
    if (h.state === 'deathBack' && (h.pos.y || 0) < 1 && !roomBehind(S, h)) { h.anim.play('deathKnees', { fade: 0.1 }); h.state = h._deathKind = 'deathKnees'; }
  }
  headlampsInRoom(ctx);
  // [R2-F] the glass at rest drawn as one batch (destruct/Glass.js)
  const F = S.glass && S.glass.shards;
  if (F && !F.batchRest && R.batchGlass !== false) F.batchRest = R.batchGlass = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('b7batch') === '0');
  // [second pass] the fight is on from the cars until he is down (not in
  // the quiet before him): the director runs, so the health bar shows (the
  // HUD hides it outside a fight: I was shot at with no bar) and the Hoods'
  // lull breaker works. The director stops at every retry: it is started again
  if (R.gunTaken && !R.calm && !R.dying && ctx.beat !== 'arrive' && !G.director.active) G.director.run(function* (d) { yield d.until(() => !RIG || RIG.calm || RIG !== R); });
  // (the room dark: the diner's own update puts its pendants back on when the
  // room comes into sight; they stay off while the switch is down)
  if (!R.lightsOn) for (const l of S.part('diner').lamps) { l.on = false; if (l.bulb) l.bulb.visible = false; }
  // the drums I carry, beside the ammo
  const L = R.res || (R.res = reserveLayer(G.hud));
  R.outT = Math.max(0, (R.outT || 0) - dt);
  const out = G.weapon.ammo === 0 && !G.weapon.reloading && R.reserve === 0;
  // (the trigger on an empty gun: the hammer's click, and the hint)
  R.clickT = Math.max(0, (R.clickT || 0) - dt);
  if (out && G.weapon.trigger && G.hands.set === 'tommy' && R.clickT <= 0) { R.clickT = 0.35; R.outT = 2.5; G.sfx.play('b7_dry', null); }
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

// [R2-F] the street behind a man (as he faces) clear of cars, doors, walls
// and posts for a body's length
function roomBehind(S, h) {
  const back = V(-Math.sin(h.yaw), 0, -Math.cos(h.yaw));
  for (const L of [0.6, 1.2, 1.8]) {
    const p = h.pos.clone().addScaledVector(back, L);
    for (const b of S.colliders.boxes) {
      const dx = p.x - b.cx, dz = p.z - b.cz, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      if (Math.hypot(Math.max(0, Math.abs(lx) - b.hx), Math.max(0, Math.abs(lz) - b.hz)) < 0.25) return false;
    }
    for (const c of S.colliders.circles) if (c.tag !== 'hood' && c !== h.collider && Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.25) return false;
  }
  return true;
}

// [R2-F] the programs the scene will need, compiled on its first steps (under
// the chapter card) as they will be drawn: into the pipeline's targets. A
// first draw of a material the renderer has no program for stalls the frame
// (a tenth of a second and more): in play that was the first bullet hole,
// the first gunsmoke, the first shard, the first wreck - each at the moment
// it counted. (The Game's own prewarm compiles for the canvas, not for the
// pipeline's linear targets, so its programs are not the ones drawn.)
// Everything in the scene is compiled, hidden or not (the particle and decal
// systems wait there empty); what this scene makes later gets a hidden
// stand-in for the compile: the glass's pieces, their batch, the lit cabs,
// the wrecks' char.
// (each pass of the pipeline draws the world with its own camera layers,
// and so with its own set of lights: a program is made per set. The passes
// are read off the renderer over a few frames: camera, layers, override)
function watchPasses(G, S, R) {
  const r = G.pipeline && G.pipeline.renderer;
  if (!r || R.passes) return;
  const seen = new Map();
  const render0 = r.render;
  let calls = 0;
  r.render = function (scene, camera) {
    calls++;
    if (scene === S.scene && camera) {
      const k = camera.uuid + ':' + camera.layers.mask + ':' + (scene.overrideMaterial ? scene.overrideMaterial.uuid : '');
      if (!seen.has(k)) seen.set(k, { camera, mask: camera.layers.mask, override: scene.overrideMaterial, rt: r.getRenderTarget() });
    }
    return render0.call(this, scene, camera);
  };
  R.passes = { seen, calls: () => calls, done: () => { r.render = render0; } };
}
let CHUNK = null;
function warm(ctx) {
  const G = ctx.game, S = ctx.stage, P = G.pipeline, r = P && P.renderer;
  if (!r || !P.rtScene) return;
  const t0 = performance.now();
  const passes = RIG.passes ? [...RIG.passes.seen.values()] : [];
  if (RIG.passes) RIG.passes.done();
  const hold = new THREE.Group();
  // (the geometry's attributes are part of a program too: a plane with its
  // uvs for what has them, bare positions and normals for the pieces, bare
  // positions for the cracks, colours for the wreck's shell)
  const geo = new THREE.PlaneGeometry(0.02, 0.02);
  const ngeo = new THREE.BufferGeometry(); ngeo.setAttribute('position', geo.attributes.position.clone()); ngeo.setAttribute('normal', geo.attributes.normal.clone()); ngeo.setIndex(geo.index.clone());
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', geo.attributes.position.clone()); pgeo.setIndex(geo.index.clone());
  const cgeo = ngeo.clone(); cgeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(cgeo.attributes.position.count * 3).fill(0.5), 3));
  const lgeo = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0.02, 0, 0)]);
  // (each on the layers the real thing is drawn on: the glass's pieces on the
  // effects layer, a shared pane's crack and halo on the world's)
  const FXL = [LAYER.FX], BOTH = [LAYER.FX, LAYER.WORLD], WL = [LAYER.WORLD];
  const put = (o, layers, rs = false) => { for (const L of layers) { const c = o.clone(); c.layers.set(L); c.receiveShadow = rs; c.castShadow = rs; hold.add(c); } };
  const mesh = (m, layers = WL, g = geo, rs = false) => put(new THREE.Mesh(g, m), layers, rs);
  const temp = [];
  if (S.glass) {
    const GM = S.glass.materials();
    mesh(GM.crack, BOTH, pgeo); mesh(GM.halo, BOTH);
    mesh(GM.backing); mesh(GM.shard, WL, ngeo);
    const F = S.glass.shards || (S.glass.shards = new ShardField(S, GM.shard));
    const live = F.matFor();
    temp.push(() => (F.pool || (F.pool = [])).push(live));
    mesh(live, FXL, ngeo); mesh(F.restMat(), FXL, ngeo);
    // (the batch at rest: positions only)
    mesh(F.restMat(), FXL, pgeo);
    put(new THREE.LineSegments(lgeo, F.lineMat()), FXL); put(new THREE.LineSegments(lgeo, F.restLineMat()), FXL);
    const gm = F._glintMat || (F._glintMat = new THREE.SpriteMaterial({ color: new THREE.Color(3.2, 3.2, 3.2), depthWrite: false, fog: false }));
    put(new THREE.Sprite(gm), FXL);
    F.batchRest = true;
    F.rebuildBatch();
  }
  mesh(cabMaterial());
  const W = wreckMaterials(S.M);
  mesh(W.shell, WL, cgeo, true); mesh(W.lines, WL, ngeo, true); mesh(W.rims, WL, ngeo, true);
  // (a blast's flying chunks: fx/Explosion.js's unlit black, drawn late)
  // (kept, never disposed: a program whose last material goes is deleted)
  const chunk = CHUNK || (CHUNK = new THREE.MeshBasicMaterial({ color: 0x030303, transparent: true, opacity: 1, depthWrite: true }));
  mesh(chunk, WL, ngeo);
  // a man and a heavy (the figures' id-pass programs: an override material,
  // which a compile of the scene does not reach)
  const H = S.hoods, men = H ? [H.spawn([G.eye.x, G.eye.z - 40], { coat: 0, brim: 0, tall: 1, heavy: false }, {}), H.spawn([G.eye.x, G.eye.z - 41], { coat: 1, brim: 1, tall: 1, heavy: true }, {})] : [];
  hold.visible = false;
  S.scene.add(hold);
  // (what is drawn already has its programs: only what is hidden - the
  // stand-ins, the empty effect systems, the props waiting - is compiled,
  // each for the passes whose layers draw it, through a proxy of its kind
  // with its geometry and material: a program does not depend on where a
  // thing is, only on what it is)
  const targets = [];
  const walk = (o, vis) => {
    vis = vis && o.visible;
    if (!vis && (o.isMesh || o.isLine || o.isPoints || o.isSprite) && !o.isSkinnedMesh && o.material && !Array.isArray(o.material)) targets.push(o);
    for (const c of o.children) walk(c, vis);
  };
  walk(S.scene, true);
  const proxy = (o, mat) => {
    const p = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, mat, 1) : o.isSprite ? new THREE.Sprite(mat) : o.isPoints ? new THREE.Points(o.geometry, mat)
      : o.isLineSegments ? new THREE.LineSegments(o.geometry, mat) : o.isLine ? new THREE.Line(o.geometry, mat) : new THREE.Mesh(o.geometry, mat);
    if (o.isInstancedMesh && o.instanceColor) p.instanceColor = o.instanceColor;
    p.receiveShadow = o.receiveShadow; p.castShadow = o.castShadow;
    return p;
  };
  const rt0 = r.getRenderTarget();
  const list = passes.length ? passes : [{ camera: G.camera, mask: G.camera.layers.mask, override: null, rt: P.rtScene }];
  let n = 0;
  try {
    for (const p of list) {
      const m0 = p.camera.layers.mask;
      p.camera.layers.mask = p.mask;
      r.setRenderTarget(p.rt || P.rtScene);
      const tmp = new THREE.Group();
      for (const o of targets) if (o.layers.test(p.camera.layers)) tmp.add(proxy(o, p.override || o.material));
      n += tmp.children.length;
      if (tmp.children.length) r.compile(tmp, p.camera, S.scene);
      // (and the men, whose skinned programs a proxy would not make)
      for (const h of men) {
        if (!h.mesh.layers.test(p.camera.layers)) continue;
        const m = h.mesh.material;
        if (p.override) h.mesh.material = p.override;
        r.compile(h.object, p.camera, S.scene);
        h.mesh.material = m;
      }
      p.camera.layers.mask = m0;
    }
  } finally { r.setRenderTarget(rt0); }
  RIG.warmTargets = n;
  S.scene.remove(hold);
  for (const h of men) H.remove(h);
  for (const g of [geo, ngeo, pgeo, cgeo, lgeo]) g.dispose();
  for (const f of temp) f();
  RIG.warmMs = performance.now() - t0;
  RIG.warmPasses = list.length;
}

// look development (shot mode only): b7kill=<group>@<t> kills that group's
// men at scene time t (the falls); b7wound=<n>@<t> gives the Cardinal n
// wounds (his knee, his fall); b7cripple=<t> cripples the drive-by's car
function devStep(ctx) {
  const R = RIG, G = ctx.game;
  if (!R.dev) {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
    const at = (k) => { const v = q.get(k); if (!v) return null; const [a, b] = v.split('@'); return { a, t: parseFloat(b ?? a) }; };
    const w = (q.get('b7wound') || '').split(',').filter(Boolean).map((x) => { const [a, b] = x.split('@'); return { a: +a, t: +b }; });
    R.dev = { kill: at('b7kill'), wound: w, cripple: at('b7cripple') };
  }
  const t = ctx.sceneTime, D = R.dev;
  if (D.kill && t >= D.kill.t) {
    for (const h of G.director.groups.get(D.kill.a) || []) if (h.alive) G.damageHood(h, 999, new THREE.Vector3(1, 0, 0.2).normalize(), { head: false });
    D.kill = null;
  }
  // (b7wound=<n>@<t>[,<n>@<t>]: the Cardinal's wounds, as torso hits)
  if (D.wound.length && t >= D.wound[0].t && R.cardinal) {
    const h = R.cardinal, W = D.wound.shift();
    for (let i = 0; i < W.a && h.alive && !h.b7down; i++) G.damageHood(h, 52, new THREE.Vector3(1, 0, -0.3).normalize(), {});
  }
  if (D.cripple && t >= D.cripple.t && R.cars.driveby) { R.cars.driveby.pts = 7; D.cripple = null; }
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
