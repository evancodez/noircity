import * as THREE from 'three';
import { SITE, DINER } from './site.js';
import { Rails } from './rails.js';
import { makeCounterGun, makeSwitch, setRoomLights, restoreRoomLights, reserveLayer, clearBottles } from './room.js';
import { buildTommyGeometry, buildDrumGeometry } from '../../player/Viewmodel.js';
import { WEAPON } from '../../player/Weapon.js';
import { ShardField } from '../../destruct/Glass.js';
import { wreckMaterials } from '../../destruct/Wreck.js';
import { cabMaterial } from './rails.js';
import { LAYER, allocInkId } from '../../render/layers.js';
import { merge } from '../../world/geom.js';

// The scene's machinery (VIII The Block; B7, rebuilt on the gun kit by lane
// C8): what lives across the beats and the retries - the cars on their
// rails, the gun and the drums on the counter, the switch, the drums I
// carry, the room's lights - and what runs every step under the script.
// Everything it adds to the block it takes away when the scene ends
// (teardown). The fight itself is the gun kit's (src/guns/Guns.js): its men,
// its warnings, its fall (game.fail) back at the beat.
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
// [C8] the drums: two come with the gun; Dot slides one up the counter
// when I call for it there (E) - few, so going back to the counter is a
// decision (the brief's "ammunition is a decision")
export const RESERVE = { start: 2, max: 3, slide: 1 };

let RIG = null;
export const rig = () => RIG;

// ---- the rig: made on the scene's first entry, kept through its retries ---------------
export function rigFor(ctx) {
  const G = ctx.game, S = ctx.stage;
  if (RIG && RIG.stage === S) return RIG;
  if (RIG) teardown(RIG);
  const R = RIG = {
    stage: S, game: G, rails: new Rails(G, S), cars: {}, beatAt: {},
    lightsOn: true, reserve: RESERVE.start, gunTaken: false, hat: null,
    reload0: null, fire0: null, vmBase0: { pos: G.vm.base.pos.clone(), rot: G.vm.base.rot.clone() },
    ticks: [], firedAt: -9,
  };
  // the counter's things: the Tommy gun and its two drums
  const build = { gun: () => buildTommyGeometry(), drum: () => buildDrumGeometry() };
  R.gun = makeCounterGun(S, build);
  R.gun.group.visible = false;
  S.scene.add(R.gun.group);
  for (const d of R.gun.drums) { d.visible = false; S.scene.add(d); }
  R.sw = makeSwitch(S);
  S.scene.add(R.sw);
  // [second pass, B7] a signal lamp on the el's west rail over where its
  // gunman stands: his shape black in its cone against the rain
  R.elLamp = elLamp(S);
  // the drums I carry: a reload takes one, none left and it does nothing
  const W = G.weapon;
  R.reload0 = W.reload;
  W.reload = function c8reload() {
    if (!RIG || this.reloading || this.ammo === WEAPON.drum) return false;
    if (RIG.reserve <= 0) { RIG.outT = 2.5; return false; }
    const ok = R.reload0.call(this);
    if (ok) RIG.reserve--;
    return ok;
  };
  // (the room dark: they find me by my gun's flash - the moment I fire)
  R.onShot = () => { R.firedAt = G.time; };
  G.on('shot', R.onShot);
  // (the headless plays read the rig here)
  G.b7 = R;
  R.onExit = () => { if (RIG === R) teardown(R); };
  G.on('scene:exit', R.onExit);
  return R;
}

export function teardown(R) {
  const G = R.game, S = R.stage;
  if (RIG === R) RIG = null;
  if (G.b7 === R) G.b7 = null;
  G.off('scene:exit', R.onExit);
  G.off('shot', R.onShot);
  if (R.onTeardown) for (const f of R.onTeardown) { try { f(); } catch (e) { console.error(e); } }
  for (const h of [...S.hoods.list]) dropMan(G, S, h);
  G.corpses.length = 0;
  G.pending.length = 0;
  if (R.nick && R.nick.cleanup) R.nick.cleanup();
  if (R.crate) { R.crate.remove(); R.crate = null; }
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
export function dropMan(G, S, h) {
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

// a man knocked out (not shot): he folds where he is, no blood
export function knockOut(G, h, kind = 'deathKnees') {
  if (!h.alive) return;
  h.hp = 0;
  h.die(kind);
  const cs = G.stage.colliders.circles, i = cs.indexOf(h.collider);
  if (i >= 0) cs.splice(i, 1);
  G.ais.delete(h);
  h.onMove = null;
  G.corpses.push(h);
  G.counters.kills++;
}

// the lights: the room dark, the men outside cannot find me in it until I
// fire (the gun kit's eyes read it: see darkRoom in 09_shootout.js)
export function setLights(ctx, on, { sound = true } = {}) {
  const R = RIG, G = ctx.game;
  R.lightsOn = on;
  setRoomLights(ctx.stage, on);
  R.sw.userData.set(on);
  if (sound) G.sfx.play('b7_switch', V(SITE.switch.x, SITE.switch.y, SITE.switch.z));
}

// a round from a man's gun at a point (the windows, a lamp, the front): his
// flash and his shot's sound, the round's real ray (no damage to me: the
// kit's hoodRound is for rounds at me)
export function roundAt(G, h, target, { heavy = false, shatter = false } = {}) {
  if (!h.alive) return;
  const muzzle = h.fire();
  if (!muzzle) return;
  const dir = _v.subVectors(target, muzzle).normalize();
  G.fx.flash.hood(h, muzzle, dir.clone(), G.time, heavy);
  if (heavy) G.sfx.play('tommy', muzzle, { pitch: 0.92 }, { ref: 4, delay: Math.min(0.25, muzzle.distanceTo(G.eye) / 343) });
  else G.sfx.pistol(muzzle, muzzle.distanceTo(G.eye));
  G.counters.hoodShots++;
  if (G.pacing) G.pacing.shot(G.time);
  const hit = G.rays.raycast(muzzle, dir, muzzle.distanceTo(target) + 6);
  if (hit && shatter && hit.mesh.userData.pane && hit.mesh.userData.pane.state !== 'gone') G.stage.glass.shatter(hit.mesh.userData.pane, { dir: dir.clone(), power: 1.1, at: hit.point });
  else if (hit) G.react.bullet(hit, dir.clone());
}

// ---- every step under the script -------------------------------------------------------------
export function everyStep(ctx, dt) {
  const R = RIG, G = ctx.game, S = ctx.stage;
  if (!R) return;
  // [R2-F] (the scene's first entry, under the card: the passes seen over
  // its first frames, then the programs compiled for each)
  if (!R.warmed) {
    R.warmN = (R.warmN || 0) + 1;
    const on = !G.shotMode || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('b7warm') === '1');
    if (on && R.warmN === 1) watchPasses(G, S, R);
    if ((R.warmN >= 4 && (!R.passes || R.passes.calls() >= 40)) || R.warmN > 180) { R.warmed = true; if (on) warm(ctx); }
  }
  R.rails.update(dt, G.time);
  for (const f of [...R.ticks]) if (f(dt) === false) { const i = R.ticks.indexOf(f); if (i >= 0) R.ticks.splice(i, 1); }
  // a man at the door opens it (and the bell tells me): from the street it is pulled
  const front = S.part('dinerFront'), D = DINER;
  for (const h of S.hoods.list) {
    if (!h.alive) continue;
    if (Math.abs(h.pos.z - (D.door.hingeZ + D.door.w / 2)) < 1.2 && h.pos.x < -8.6 && h.pos.x > -12.5 && !front.door.barred) {
      // [C8] (a man of theirs at the door, coming in: the bell, and the line
      // that says it - the door is behind a man at the windows)
      if (front.door.angle < 0.05 && h.pos.x > DINER.faceX - 0.2 && R.gunTaken) { R.doorIn = { h, t: G.time }; if (ctx.hud.say && !h.c8dot) ctx.hud.say('Dot: The door!', 1.4); }
      front.door.open();
    }
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
  L.set(R.reserve, G.hands.set === 'tommy', out || R.outT > 0 ? 'drums: Dot, at the counter' : '');
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
// first draw of a material the renderer has no program for stalls the frame.
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
  const geo = new THREE.PlaneGeometry(0.02, 0.02);
  const ngeo = new THREE.BufferGeometry(); ngeo.setAttribute('position', geo.attributes.position.clone()); ngeo.setAttribute('normal', geo.attributes.normal.clone()); ngeo.setIndex(geo.index.clone());
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', geo.attributes.position.clone()); pgeo.setIndex(geo.index.clone());
  const cgeo = ngeo.clone(); cgeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(cgeo.attributes.position.count * 3).fill(0.5), 3));
  const lgeo = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0.02, 0, 0)]);
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
  const chunk = CHUNK || (CHUNK = new THREE.MeshBasicMaterial({ color: 0x030303, transparent: true, opacity: 1, depthWrite: true }));
  mesh(chunk, WL, ngeo);
  const H = S.hoods, men = H ? [H.spawn([G.eye.x, G.eye.z - 40], { coat: 0, brim: 0, tall: 1, heavy: false }, {}), H.spawn([G.eye.x, G.eye.z - 41], { coat: 1, brim: 1, tall: 1, heavy: true }, {})] : [];
  hold.visible = false;
  S.scene.add(hold);
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
    const t = (DINER.faceX - o.x) / f.x;
    if (t < 0 || t > 40) continue;
    const z = o.z + f.z * t;
    const facing = Math.min(1, -f.x);
    const k = Math.min(1, 7 / Math.max(3, t)) * facing * (car.lensBroken.filter((b) => !b).length / 2);
    const w = 1.6 + t * 0.12;
    bars.push({ z0: z - w, z1: z + w, k: Math.min(1, 1.6 * k) });
  }
  if (R.sweep) bars.push(R.sweep);
  if (!bars.length) { if (R.barsOn) { d.trainBars.hide(); R.barsOn = false; } return; }
  if (!R.barsOn) {
    R.barsOn = true;
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
