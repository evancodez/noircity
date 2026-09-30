import * as THREE from 'three';
import { FOG } from '../../../render/fog.js';
import { makeKit } from '../../../props/diner/kit.js';
import { officeMats } from '../build/mats.js';
import { buildShell } from '../build/shell.js';
import { buildOpenings, syncFrosted } from '../build/openings.js';
import { buildFurniture } from '../build/furniture.js';
import { buildFireEscape, buildStreet } from '../build/outside.js';
import { makeGobo } from '../build/gobo.js';
import { FLOOR, CEIL, ROOM, CORR, DOOR, DESK, PAD, LAMP, WIN, ESC, SAFE, PICTURE, STREET, POST, CORR_LAMP, BLIND_LIGHT, PICTURE_ASIDE } from '../plan.js';
// the banker's lamp's strength (the pad sits close under it, in the heart of its pool: at
// this the graphite on the sheet still prints dark, and the blotter round it white)
const DESK_LAMP_I = 30, DESK_LAMP_A = 1.3;
// the muzzle flashes' light in this room (fx/MuzzleFlash.js: the street's 32 and 22)
const FLASH_I = { player: 11, hood: 6.5 };
// the street's light up through the blind onto the ceiling
const UP_I = 16000;
// the blind's light on the hands, against its light on the room (build/gobo.js)
const GOBO_K = 0.3;

// Room 304 and its corridor (lane B2): the whole third floor of the stage.
// Built from ./build/*; this part lights it, gives it its Looks, its dry
// volumes, its anchors, the Hoods' ground, and the room's API:
//   office.door      { hinge, pane, angle, open(angle, speed), kick(), close() }
//   office.desk      { tip(dir), tipped }            the desk goes over on its front
//   office.lamp      the banker's lamp (a lamp of stage.lamps: on, dead, fallen)
//   office.pad       the pad's sheet (build/pad.js)  office.pencilAt
//   office.picture   { swingAside(), swung }         office.safe { dial, setDial(n), open(k) }
//   office.blind     the slats (build/openings.js)   office.curtain, office.fan, office.cooler
//   office.frosted   the frosted panes: [{ frost, local }] (their men: frost.userData.figures)
//   office.lights    { blind, desk, corridor, post } the lamps
//   office.reset()   the room as scene 4 finds it (every break mended)
// Anchors (other lanes rely on the first three): office.window.street,
// office.street.watcher, office.window.escape, office.corridor.start,
// office.door, office.desk, office.safe, and the gunfight's own.
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  name: 'office', order: 130, tick: 130,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'office';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const mats = officeMats();
    const lamps = stage.lamps;
    const rng = stage.rng.fork(3041);

    const shell = buildShell(kit, mats, stage);
    const open = buildOpenings(kit, mats, stage);
    const furn = buildFurniture(kit, mats, stage);
    const esc = buildFireEscape(kit, mats, stage);
    const street = buildStreet(kit, mats, stage, lamps);

    // ---- the lights -----------------------------------------------------------------------
    // the street's light through the blind: the hotel's floodlight up the
    // street, a narrow spot aimed through the window (the slats' shadows)
    const from = street.flood.from, at = V(...BLIND_LIGHT.through).sub(from).multiplyScalar(1.3).add(from);
    const axis = at.clone().sub(from).normalize();
    const blindLight = lamps.addCustom({ head: from.clone(), axis, height: from.distanceTo(at) + 6, half: 0.09, real: true, bulb: street.flood.disc, strength: 1, tag: 'blind' });
    Object.assign(blindLight.light, { intensity: 40000, angle: 0.105, penumbra: 0.35, distance: 34 });
    blindLight.cone.visible = false;
    blindLight.priority = 10;
    blindLight.shadow = { radius: 1.2, mapSize: 2048, bias: -0.00025, normalBias: 0.015, near: 8 };
    // the banker's lamp: a wide low pool on the blotter
    const dl = furn.lamp;
    g.updateMatrixWorld(true);
    const deskHead = dl.shadeG.localToWorld(V(-0.01, -0.03, 0));
    // (round 2: aimed nearly straight down and wide, as the shade throws it:
    // one pool over the blotter, the pad, the papers and the desk's edges,
    // falling off over its sides - the room's warm pool, as the diner's counter)
    const deskAxis = V(-0.15, -1, 0.05).normalize();
    const deskLamp = lamps.addCustom({ head: deskHead, axis: deskAxis, height: 0.42, half: 0.62, real: true, bulb: dl.bulb, fadeEnd: 0.95, edgeSoft: 0.55, strength: 0.34, tag: 'desk' });
    Object.assign(deskLamp.light, { intensity: DESK_LAMP_I, angle: DESK_LAMP_A, penumbra: 0.45, distance: 5 });
    deskLamp.priority = 5;
    deskLamp.shadow = { radius: 3, mapSize: 1024, near: 0.05 };
    // (its head and aim in the shade's own frame: they ride the shade when the desk goes over)
    const shadeInv = new THREE.Matrix4().copy(dl.shadeG.matrixWorld).invert();
    dl.localHead = deskHead.clone().applyMatrix4(shadeInv);
    dl.localAxis = deskAxis.clone().transformDirection(shadeInv);
    for (const m of [dl.shadeMesh, dl.inner]) m.userData.lamp = deskLamp;
    // the corridor's lamp: a milk-glass globe near 304
    kit.piece();
    const globe = kit.add(new THREE.SphereGeometry(0.13, 24, 16).scale(1, 0.85, 1).translate(CORR_LAMP.x, CORR.ceil - 0.28, CORR_LAMP.z), mats.bulb, { cast: false, name: 'corridor_globe' });
    kit.add(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8).translate(CORR_LAMP.x, CORR.ceil - 0.09, CORR_LAMP.z), mats.brass, { cast: false });
    const corrHead = V(CORR_LAMP.x, CORR.ceil - 0.36, CORR_LAMP.z);
    const corrLamp = lamps.addCustom({ head: corrHead, axis: V(0, -1, 0), height: CORR.ceil - 0.36, half: 0.8, real: true, bulb: globe, fadeEnd: 0.85, edgeSoft: 0.5, strength: 0.45, tag: 'corridor' });
    Object.assign(corrLamp.light, { intensity: 38, angle: 1.2, penumbra: 0.85, distance: 8 });
    // (in the corridor its shadow before the street's light up through the blind)
    corrLamp.priority = (eye) => (eye.x < -0.1 ? 6 : 2);
    // the street's light up through the blind onto the ceiling (round 2): the
    // lamp post across the way, three floors down - its light comes in
    // rising through the slats and lays their lines over the black ceiling
    // and the top of the door's wall, and the fan turns through it: its
    // blades' slow shadow goes round up there. A shadowed light or none
    // (unshadowed it would be a blot on the ceiling), and only while the
    // eye is in the room.
    const upFrom = street.post.head.clone().add(V(-0.35, 0.05, 0));
    const upAt = V(1.6, CEIL, (WIN.z0 + WIN.z1) / 2 - 0.25);
    const upLamp = lamps.addCustom({ head: upFrom, axis: upAt.clone().sub(upFrom).normalize(), height: 4, half: 0.09, real: true, strength: 0, tag: 'streetUp' });
    Object.assign(upLamp.light, { intensity: UP_I, angle: 0.1, penumbra: 0.35, distance: 30 });
    upLamp.cone.visible = false;
    upLamp.priority = (eye) => (eye.x > 0 ? 4 : 0);
    upLamp.shadowOnly = true;
    upLamp.shadow = { radius: 1.4, mapSize: 1024, bias: -0.0003, normalBias: 0.02, near: 11 };
    // the dead end of the corridor by the lift: a dim bulb over the gate (no pool: a mark in the dark)
    kit.add(new THREE.SphereGeometry(0.035, 12, 8).translate((-1.62 - 0.52) / 2, 2.55, CORR.z0 + 0.06), mats.litDim, { cast: false });

    // ---- the Looks, the dry volumes, the walls of the stage ----------------------------------
    stage.dry.push(shell.roomBox, shell.corrBox);
    const inside = { fogDensity: FOG.density * 0.3, rainOverlay: 0, haze: 0.65, reflect: 'none', ambient: 0.2 };
    stage.addLook(shell.roomBox, { ...inside, room: 'office' });
    stage.addLook(shell.corrBox, { ...inside, ambient: 0.18, haze: 0.45, room: 'corridor' });
    stage.colliders.setBounds(-2.5, 6.2, -7.3, 9.0);

    // ---- the anchors -------------------------------------------------------------------------
    const A = (name, x, z, yaw, extra = {}) => stage.addAnchor('office.' + name, { pos: V(x, FLOOR, z), yaw, ...extra });
    A('corridor.start', -1.02, -5.55, Math.PI);
    A('door', -0.62, (DOOR.z0 + DOOR.z1) / 2, -Math.PI / 2, { r: 1.2 });
    A('desk', 4.8, PAD.z + 0.02, Math.PI / 2);
    A('safe', SAFE.x + 0.02, 0.78, 0);
    // (round 2: leaning over the radiator, the eye a hand from the slats - two
    // fingers part the pair at the eye and the line down to the lamp post
    // across the way passes through the gap they make)
    A('window.street', 5.42, (WIN.z0 + WIN.z1) / 2 + 0.3, -Math.PI / 2 - 0.02, { eyeY: 1.72 });
    A('window.escape', (ESC.x0 + ESC.x1) / 2, ROOM.z1 - 0.62, Math.PI);
    stage.addAnchor('office.street.watcher', { pos: V(POST.x - 0.25, STREET.y + 0.15, POST.z - 0.7), yaw: Math.PI / 2 });
    // the gunfight's places: behind the desk (tipped or not), the men's marks
    A('cover.desk', DESK.x + 0.7, DESK.z + 0.1, Math.PI / 2);
    A('fight.doorway', 0.35, (DOOR.z0 + DOOR.z1) / 2, 0);
    A('fight.hall.door', -0.9, (DOOR.z0 + DOOR.z1) / 2 - 0.1, 0);
    A('fight.hall.side', -0.62, 2.55, 0);
    A('fight.hall.far', -1.1, -4.2, 0);
    A('fight.window', (ESC.x0 + ESC.x1) / 2 - 0.1, ROOM.z1 + 0.62, 0);

    // ---- the API -------------------------------------------------------------------------------
    const game = () => stage.game;
    const frosted = [
      { frost: open.door.frost, local: open.door.local, door: true },
      { frost: open.side.frost, local: open.side.local },
      { frost: open.transom.frost, local: open.transom.local },
      ...open.others.map((o) => ({ frost: o.frost, local: o.local })),
    ];
    const door = open.door;
    // (the door's collider: a thin box along the leaf, moved as it swings;
    // off while the leaf is open past the point where it stands in the way)
    door.col = stage.colliders.addBox(-0.07, (DOOR.z0 + DOOR.z1) / 2, 0.03, (DOOR.z1 - DOOR.z0) / 2, 0, 'door');
    const api = {
      group: g, kit, mats, shell, open, furn, esc, street, rng,
      door, desk: furn.desk, pad: furn.pad, pencilAt: furn.pencilAt, picture: furn.picture, safe: furn.safe,
      blind: open.blind, curtain: open.curtain, fan: furn.fan, cooler: furn.cooler, cabinets: furn.cabinets,
      window: open.window, escape: open.escape, side: open.side, frosted,
      lights: { blind: blindLight, desk: deskLamp, corridor: corrLamp, post: street.post.lamp, up: upLamp },
      lamp: { lamp: deskLamp, parts: dl, fallen: 0, fall: null },
      neon: street.neon,
      gust: 0,
      // (the pad's close-up: the lamp eased down, 0..1; lampDimTo its target)
      lampDim: 0, lampDimTo: 0,
      // ---- the door --------------------------------------------------------------------
      // swing it to `angle` (rad, 0 shut, ~1.7 open against the wall) with a
      // speed (rad/s); kick(): flung open, it bangs off its stop and comes to rest
      setDoor(angle) { door.angle = door.target = angle; door.vel = 0; door.hinge.rotation.y = angle; door.moving = false; api.doorCollider(); },
      swingDoor(angle, speed = 1.6) { door.target = angle; door.speed = speed; door.moving = true; door.kicked = false; },
      kickDoor() { door.target = 1.72; door.vel = 11; door.moving = true; door.kicked = true; },
      doorCollider() {
        // (the leaf stands in the doorway until it is ~40 degrees open)
        const a = door.angle;
        const on = a < 0.7;
        const hx = 0.03, len = DOOR.z1 - DOOR.z0;
        const c = Math.cos(a), s = Math.sin(a);
        door.col.cx = -0.07 + s * len / 2; door.col.cz = DOOR.z0 + c * len / 2;
        door.col.angle = a; door.col.c = Math.cos(a); door.col.s = Math.sin(a);
        door.col.hx = on ? hx : 0.001; door.col.hz = on ? len / 2 : 0.001;
      },
      // ---- the desk goes over ------------------------------------------------------------
      // (now: already over, the lamp already on the floor, no sound - a retry's room)
      tipDesk({ now = false } = {}) {
        const d = furn.desk;
        if (d.tip) return false;
        d.tip = { t: 0, a: now ? Math.PI / 2 : 0, v: 0 };
        d.tipNow = now;
        // (over at once: its collider and the bullets' copy where it lies, before anyone stands by it)
        if (now) { d.tip.done = true; d.pivot.rotation.z = Math.PI / 2; d.pivot.updateMatrixWorld(true); d.tipped = 1; drawersHome(api, stage, true); spill(api, stage); afterTip(api, stage); }
        return true;
      },
      // ---- the picture swings aside on its wire -------------------------------------------
      swingPicture() { const p = furn.picture; p.target = PICTURE_ASIDE; p.swinging = true; },
      reset() { resetRoom(api, stage); },
    };
    api.setDoor(DOOR.open0);
    return api;
  },

  update(api, dt, t, camera) {
    const stage = api.kit.stage, G = stage.game;
    // (round 2: a muzzle's flash in a small dark room - the street's flash
    // light, at a metre from a wall, lit a hard white disc on it; here it
    // lifts the walls to a grey for its two frames and the men stand black in it)
    if (!api._flashSet && stage.fx && stage.fx.flash) { api._flashSet = true; Object.assign(stage.fx.flash.intensity, FLASH_I); }
    // the frosted panes: their frames (the door swings) and the men behind them
    const L = api.lights.corridor;
    for (const f of api.frosted) {
      f.frost.userData.setLamp(L.head, L.dead && !L.on ? 0.05 : 1);
      syncFrosted(f.local, f.frost);
    }
    // the door: a sprung swing to its target; a kick bangs off the stop
    const D = api.door;
    if (D.moving) {
      if (D.kicked) {
        D.angle += D.vel * dt;
        if (D.angle >= 1.72) { D.angle = 1.72; D.vel = -Math.abs(D.vel) * 0.28; if (G && Math.abs(D.vel) > 0.4) G.sfx.play('office_doorBang', V(0.5, 1.2, 0.6), { k: Math.min(1, Math.abs(D.vel) / 3) }); }
        D.vel += (D.angle < 1.5 ? 6 : 0) * dt;
        D.vel *= Math.exp(-2.5 * dt);
        if (Math.abs(D.vel) < 0.05 && D.angle > 1.45) { D.moving = false; D.kicked = false; }
      } else {
        const e = D.target - D.angle;
        const step = Math.sign(e) * Math.min(Math.abs(e), (D.speed || 1.6) * dt * (0.35 + Math.min(1, Math.abs(e) * 3)));
        D.angle += step;
        if (Math.abs(e) < 1e-3) D.moving = false;
      }
      D.hinge.rotation.y = D.angle;
      api.doorCollider();
    }
    // the desk going over: a fall about its front edge, a bounce, rest
    const dk = api.desk;
    if (dk.tip && !dk.tip.done) {
      const T = dk.tip;
      T.t += dt;
      // (gravity on a slab turning about its edge; it lands on its front, 90 degrees)
      const I = 1.0, g = 9.8;
      const tq = g * Math.sin(Math.max(0.05, T.a) + 0.62) * 0.9 / I;
      T.v += (T.a < 0.02 ? 4.5 : tq) * dt;
      T.a += T.v * dt;
      if (T.a >= Math.PI / 2) {
        T.a = Math.PI / 2;
        if (T.v > 1.2) { T.v = -T.v * 0.22; if (G) { G.sfx.play('office_deskFall', V(dk.x - 0.4, 0.3, dk.z), { k: 1 }); G.controller.shake(0.35, Math.hypot(G.eye.x - dk.x, G.eye.z - dk.z)); } }
        else { T.v = 0; T.done = true; afterTip(api, stage); }
      }
      dk.pivot.rotation.z = T.a;
      dk.tipped = T.a / (Math.PI / 2);
      // (past halfway the pulled drawers point up and run home, one bang)
      if (!dk.slid && dk.tipped > 0.55) { drawersHome(api, stage, true); if (G && !dk.tipNow) G.sfx.play('office_drawer', V(dk.x - 0.2, 0.9, dk.z), { k: 1 }); }
      // (what was on its top slides off beyond it, out of my sight behind it)
      if (!dk.spill && dk.tipped > 0.45) spill(api, stage);
    }
    // (the drawers' shut copy out of the bullets' way until it is wanted)
    if (!dk._raysInit && G && G.rays) { dk._raysInit = true; drawersHome(api, stage, !!dk.slid); }
    // the desk lamp rides the desk, or lies where it fell
    lampFollow(api, stage);
    // (round 2: over the pad the eye is a hand's length from the bulb - the
    // lamp's full pool would print the sheet and its graphite one white, so
    // the light eases down while the pad is up, as an eye adapts, and back)
    api.lampDim += ((api.lampDimTo || 0) - api.lampDim) * Math.min(1, dt * 7);
    if (!api.lamp.fall && !api.lamp.lamp.dead) api.lamp.lamp.light.intensity = DESK_LAMP_I * (1 - 0.74 * api.lampDim);
    // the picture on its wire
    const P = api.picture;
    if (P.swinging) {
      const e = P.target - P.angle;
      P.vel += (e * 30 - P.vel * 6.5) * dt;
      P.angle += P.vel * dt;
      P.hang.rotation.z = P.angle;
      if (Math.abs(e) < 0.002 && Math.abs(P.vel) < 0.01) P.swinging = false;
    }
    // the fan: its slow turn (a bent blade ticks round)
    const F = api.fan;
    F.rotor.rotation.y -= (F.rpm / 60) * Math.PI * 2 * dt;
    // (its shadow in the street's light on the ceiling: that light's map
    // follows the blades every third step: 20 a second)
    if (dt > 0 && (api._fanK = (api._fanK || 0) + 1) % 3 === 0) {
      for (const sl of stage.lamps.pool) if (sl.lamp === api.lights.up && sl.shadow) sl.spot.shadow.needsUpdate = true;
    }
    // the curtain in the air from under the sash
    api.gust += (Math.sin(t * 0.37) * 0.5 + Math.sin(t * 1.13 + 1) * 0.3 - api.gust) * Math.min(1, dt * 0.8);
    api.curtain.step(t, Math.max(0, api.gust));
    // the HOTEL's tubes: they buzz and drop out now and then
    const N = api.neon;
    if (N) {
      const n = Math.sin(t * 0.83 + N.seed) * Math.sin(t * 2.9) + Math.sin(t * 17.0) * 0.08;
      const on = !(n > 0.72 && Math.sin(t * 37) > -0.3);
      if (on !== N.lit) { N.lit = on; N.mesh.material = on ? N.on : N.off; }
      // (the floodlight under the sign dips with it: the slats flicker on the walls)
      const bl = api.lights.blind;
      bl.base = on ? 1 : 0.82;
      if (bl.light) bl.light.intensity = 40000 * bl.base;
    }
    // (round 2) the slats across my hands and the gun, where the light through the blind reaches me
    if (G && api._gobo === undefined) api._gobo = makeGobo(G, stage, api.blind, api.lights.blind) || null;
    if (api._gobo) api._gobo.update((api.lights.blind._k ?? 1) * GOBO_K);
  },
};

// the desk has gone over: its collider turns to the tipped footprint (a low
// wall on its front, the drawers' side up), cover for a man crouched behind it
function afterTip(api, stage) {
  const d = api.desk, c = d.collider;
  // (lying on its front: 0.78 deep along x now, its old front edge the pivot)
  c.cx = d.x - DESK.d / 2 - DESK.h / 2 + 0.02; c.hx = DESK.h / 2; c.hz = DESK.w / 2 + 0.05;
  deskRays(api, stage);
}
// the bullets' copy of the desk where the desk is (tipped, or stood up again)
function deskRays(api, stage) {
  const G = stage.game, d = api.desk;
  if (G && G.rays) d.body.traverse((m) => { if (m.isMesh && stage.solids.includes(m)) G.rays.refresh(m); });
  if (G && G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
}
// the things on the desk's top (not the desk, not the lamp) come off it as it
// goes over and lie on the floor beyond it, flat, turned every way; put back
// on it by the reset. (Object first: a telephone stuck to a desk standing on
// its front is a thing in the air.)
const _bb = new THREE.Box3(), _bc = new THREE.Vector3();
function spill(api, stage) {
  const d = api.desk, G = stage.game;
  if (d.spill) return;
  d.spill = [];
  const loose = d.body.children.filter((c) => !d.fixed.has(c));
  loose.forEach((c, i) => {
    d.spill.push({ obj: c, pos: c.position.clone(), quat: c.quaternion.clone() });
    c.updateWorldMatrix(true, true);
    _bb.setFromObject(c).getCenter(_bc);
    const zc = Math.max(DESK.z - DESK.w / 2, Math.min(DESK.z + DESK.w / 2, _bc.z));
    const h = (k) => { const x = Math.sin((i + 1) * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
    stage.scene.add(c);
    // (on its side, the telephone; the flat things flat)
    const tall = _bb.max.y - _bb.min.y > 0.1;
    c.quaternion.setFromEuler(new THREE.Euler(0, h(1) * 6.28, tall ? Math.PI / 2 : 0, 'YXZ'));
    c.position.set(0, 0, 0);
    c.updateWorldMatrix(true, true);
    _bb.setFromObject(c).getCenter(_bc);
    const rx = DESK.x - DESK.d / 2 - 0.95 - h(2) * 0.55, rz = zc + (h(3) - 0.5) * 0.5;
    c.position.set(rx - _bc.x, FLOOR + 0.003 * (1 + (i % 4)) - _bb.min.y, rz - _bc.z);
    c.updateWorldMatrix(true, true);
    if (G && G.rays) c.traverse((m) => { if (m.isMesh && stage.solids.includes(m)) G.rays.refresh(m); });
  });
}
function unspill(api) {
  const d = api.desk;
  if (!d.spill) return;
  for (const s of d.spill) { d.body.add(s.obj); s.obj.position.copy(s.pos); s.obj.quaternion.copy(s.quat); }
  d.spill = null;
}
// the drawers pulled out (the room as found) or run home (the desk over)
function drawersHome(api, stage, shut) {
  const G = stage.game, D = api.desk.drawers;
  D.open.visible = !shut; D.shut.visible = shut;
  if (G && G.rays) { G.rays.setEnabled(D.open, !shut); G.rays.setEnabled(D.shut, shut); }
  api.desk.slid = shut;
}

// the banker's lamp: its light follows its head wherever the desk takes it;
// once the desk goes over the lamp is thrown off it and lies on the floor,
// burning, its light along the boards and up the walls
const _h = new THREE.Vector3(), _a = new THREE.Vector3();
// the lamp's resting turn on the floor: on its side, then turned so its
// light runs low across the boards to the door's wall and up it (the men
// between it and the wall throw their shadows up there)
const LAMP_REST_AIM = new THREE.Vector3(-0.78, 0.14, -0.6).normalize();
function restQuat(parts) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.4, Math.PI / 2 - 0.2));
  const inGroup = parts.localAxis.clone().applyQuaternion(parts.shadeG.quaternion);
  const now = inGroup.applyQuaternion(q).normalize();
  return new THREE.Quaternion().setFromUnitVectors(now, LAMP_REST_AIM).multiply(q);
}
function lampFollow(api, stage) {
  const Lp = api.lamp, lamp = Lp.lamp, parts = Lp.parts;
  const d = api.desk;
  if (d.tip && !Lp.fall && d.tipped > 0.35) {
    // (off the desk's top as it tips: its own fall, toward the door, tumbling)
    parts.group.updateWorldMatrix(true, false);
    const p = parts.group.getWorldPosition(new THREE.Vector3()), q = parts.group.getWorldQuaternion(new THREE.Quaternion());
    stage.scene.attach(parts.group);
    parts.group.position.copy(p); parts.group.quaternion.copy(q);
    Lp.fall = { t: d.tipNow ? 0.55 : 0, p0: p, v: V(-1.5, 0.6, -0.2), rest: V(d.x - 1.35, FLOOR + 0.07, d.z + 0.35), q0: q.clone(), q1: restQuat(parts), quiet: !!d.tipNow };
    const G = stage.game;
    if (G && !d.tipNow) G.sfx.play('office_lampFall', p, {});
  }
  if (Lp.fall && !Lp.fall.done) {
    const F = Lp.fall;
    F.t += 1 / 60;
    const u = Math.min(1, F.t / 0.55);
    const e = u * u;
    const p = F.p0.clone().lerp(F.rest, 1 - Math.pow(1 - u, 2));
    p.y = F.p0.y + (F.rest.y - F.p0.y) * e + Math.sin(Math.PI * u) * 0.25;
    parts.group.position.copy(p);
    // (it lands on its side, the shade's mouth toward the door, a little up)
    parts.group.quaternion.slerpQuaternions(F.q0, F.q1, Math.min(1, u * 1.15));
    if (u >= 1) {
      F.done = true;
      const G = stage.game;
      if (G && !F.quiet) G.sfx.play('office_lampLand', p, {});
      // (the bullets' copy of it where it lies: it can be shot out on the floor)
      if (G && G.rays) { parts.group.updateWorldMatrix(true, true); parts.group.traverse((m) => { if (m.isMesh && stage.solids.includes(m)) G.rays.refresh(m); }); }
    }
  }
  // the head and the aim from the shade's own frame, every step
  parts.shadeG.updateWorldMatrix(true, false);
  parts.shadeG.localToWorld(_h.copy(parts.localHead));
  const dir = _a.copy(parts.localAxis).transformDirection(parts.shadeG.matrixWorld);
  if (_h.distanceToSquared(lamp.head) > 1e-8 || dir.distanceToSquared(lamp.axis) > 1e-8) {
    lamp.head.copy(_h); lamp.axis.copy(dir).normalize();
    lamp.light.pos.copy(_h);
    lamp.light.target.copy(_h).addScaledVector(lamp.axis, 2);
    // (on the floor it throws its light low and long: a wider, weaker spread)
    if (Lp.fall && Lp.fall.done) { lamp.light.angle = 1.05; lamp.light.distance = 9; lamp.light.intensity = 160; }
    lamp.cone.position.copy(_h);
    lamp.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lamp.axis);
    const u = lamp.cone.material.uniforms;
    if (u.uApex) u.uApex.value.copy(_h);
    if (u.uAxis) u.uAxis.value.copy(lamp.axis);
    lamp.entry.position.copy(_h); lamp.entry.direction.copy(lamp.axis);
    lamp.moved = true;
  }
}

// every break mended, the room as it was found
function resetRoom(api, stage) {
  const B = stage.breakables, Gl = stage.glass;
  for (const h of B.list) if (B.restore) B.restore(h);
  if (B.clearPieces) B.clearPieces();
  for (const p of Gl.panes) Gl.restore(p);
  api.setDoor(DOOR.open0);
  // the desk upright, its lamp on it, lit
  const d = api.desk;
  d.tip = null; d.tipped = 0; d.pivot.rotation.z = 0; d.tipNow = false;
  d.collider.cx = d.x; d.collider.hx = DESK.d / 2; d.collider.hz = DESK.w / 2;
  unspill(api);
  drawersHome(api, stage, false);
  const Lp = api.lamp, lamp = Lp.lamp;
  if (Lp.fall || Lp.parts.group.parent !== d.body) {
    d.body.add(Lp.parts.group);
    Lp.parts.group.position.set(LAMP.x - DESK.x, DESK.h, LAMP.z - DESK.z);
    Lp.parts.group.rotation.set(0, 0, 0);
  }
  deskRays(api, stage);
  Lp.fall = null;
  api.lampDim = api.lampDimTo = 0;
  Object.assign(lamp.light, { intensity: DESK_LAMP_I, angle: DESK_LAMP_A, distance: 5 });
  if (lamp.dead) { lamp.dead = false; lamp.buzz = null; lamp.dieNow = false; lamp.deadK = 0; lamp.on = true; if (lamp.bulb) lamp.bulb.material = api.mats.bulb; }
  lamp.on = true;
  // the picture back crooked on its nail, the safe shut
  const P = api.picture;
  P.angle = P.target = PICTURE.tilt; P.vel = 0; P.swinging = false; P.hang.rotation.z = P.angle;
  const S = api.safe;
  S.open = 0; S.hinge.rotation.y = 0; S.dial = 0; S.dialG.rotation.z = -Math.PI * 1.5; S.handle = 0; S.handleG.rotation.z = 0;
  api.blind.reset();
  api.curtain.reset();
  const F = api.fan;
  F.rpm = 38; F.bent = false; for (const b of F.blades) { b.bent = 0; b.mesh.rotation.set(0, 0, 0); }
  if (stage.game && stage.game.pipeline && stage.game.pipeline.dirtyShadows) stage.game.pipeline.dirtyShadows();
  if (stage.game && stage.game.sfx && stage.game.sfx.roomOpen) stage.game.sfx.roomOpen(0);
  void CEIL; void SAFE;
}
