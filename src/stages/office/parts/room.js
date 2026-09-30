import * as THREE from 'three';
import { FOG } from '../../../render/fog.js';
import { makeKit } from '../../../props/diner/kit.js';
import { officeMats } from '../build/mats.js';
import { buildShell } from '../build/shell.js';
import { buildOpenings, syncFrosted } from '../build/openings.js';
import { buildFurniture } from '../build/furniture.js';
import { buildFireEscape, buildStreet } from '../build/outside.js';
import { FLOOR, CEIL, ROOM, CORR, DOOR, DESK, PAD, LAMP, WIN, ESC, SAFE, PICTURE, STREET, POST, CORR_LAMP, BLIND_LIGHT } from '../plan.js';

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
    Object.assign(blindLight.light, { intensity: 12000, angle: 0.105, penumbra: 0.35, distance: 34 });
    blindLight.cone.visible = false;
    blindLight.priority = 10;
    blindLight.shadow = { radius: 1.2, mapSize: 2048, bias: -0.00025, normalBias: 0.015, near: 8 };
    // the banker's lamp: a wide low pool on the blotter
    const dl = furn.lamp;
    g.updateMatrixWorld(true);
    const deskHead = dl.shadeG.localToWorld(V(-0.01, -0.03, 0));
    const deskAxis = V(PAD.x, DESK.h, PAD.z + 0.05).sub(deskHead).normalize();
    const deskLamp = lamps.addCustom({ head: deskHead, axis: deskAxis, height: 0.8, half: 0.95, real: true, bulb: dl.bulb, fadeEnd: 0.8, edgeSoft: 0.6, strength: 0.25, tag: 'desk' });
    Object.assign(deskLamp.light, { intensity: 7.5, angle: 1.15, penumbra: 0.75, distance: 4.5 });
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
    corrLamp.priority = 2;
    // the dead end of the corridor by the lift: a dim bulb over the gate (no pool: a mark in the dark)
    kit.add(new THREE.SphereGeometry(0.035, 12, 8).translate((-1.62 - 0.52) / 2, 2.55, CORR.z0 + 0.06), mats.litDim, { cast: false });

    // ---- the Looks, the dry volumes, the walls of the stage ----------------------------------
    stage.dry.push(shell.roomBox, shell.corrBox);
    const inside = { fogDensity: FOG.density * 0.3, rainOverlay: 0, haze: 0.5, reflect: 'none', ambient: 0.6 };
    stage.addLook(shell.roomBox, { ...inside, room: 'office' });
    stage.addLook(shell.corrBox, { ...inside, ambient: 0.4, haze: 0.35, room: 'corridor' });
    stage.colliders.setBounds(-2.5, 6.2, -7.3, 9.0);

    // ---- the anchors -------------------------------------------------------------------------
    const A = (name, x, z, yaw, extra = {}) => stage.addAnchor('office.' + name, { pos: V(x, FLOOR, z), yaw, ...extra });
    A('corridor.start', -1.02, -5.55, Math.PI);
    A('door', -0.62, (DOOR.z0 + DOOR.z1) / 2, -Math.PI / 2, { r: 1.2 });
    A('desk', 4.8, PAD.z + 0.02, Math.PI / 2);
    A('safe', SAFE.x + 0.02, 0.78, 0);
    A('window.street', 5.02, (WIN.z0 + WIN.z1) / 2, -Math.PI / 2);
    A('window.escape', (ESC.x0 + ESC.x1) / 2, ROOM.z1 - 0.62, Math.PI);
    stage.addAnchor('office.street.watcher', { pos: V(POST.x - 1.2, STREET.y + 0.15, POST.z - 0.25), yaw: Math.PI / 2 });
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
      lights: { blind: blindLight, desk: deskLamp, corridor: corrLamp, post: street.post.lamp },
      lamp: { lamp: deskLamp, parts: dl, fallen: 0, fall: null },
      neon: street.neon,
      gust: 0,
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
      tipDesk() {
        const d = furn.desk;
        if (d.tip) return false;
        d.tip = { t: 0, a: 0, v: 0 };
        return true;
      },
      // ---- the picture swings aside on its wire -------------------------------------------
      swingPicture() { const p = furn.picture; p.target = 1.05; p.swinging = true; },
      reset() { resetRoom(api, stage); },
    };
    api.setDoor(DOOR.open0);
    return api;
  },

  update(api, dt, t, camera) {
    const stage = api.kit.stage, G = stage.game;
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
    }
    // the desk lamp rides the desk, or lies where it fell
    lampFollow(api, stage);
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
      if (bl.light) bl.light.intensity = 12000 * bl.base;
    }
  },
};

// the desk has gone over: its collider turns to the tipped footprint (a low
// wall on its front, the drawers' side up), cover for a man crouched behind it
function afterTip(api, stage) {
  const d = api.desk, c = d.collider;
  // (lying on its front: 0.78 deep along x now, its old front edge the pivot)
  c.cx = d.x - DESK.d / 2 - DESK.h / 2 + 0.02; c.hx = DESK.h / 2; c.hz = DESK.w / 2;
  const G = stage.game;
  if (G && G.rays) d.body.traverse((m) => { if (m.isMesh && stage.solids.includes(m)) G.rays.refresh(m); });
  if (G && G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
}

// the banker's lamp: its light follows its head wherever the desk takes it;
// once the desk goes over the lamp is thrown off it and lies on the floor,
// burning, its light along the boards and up the walls
const _h = new THREE.Vector3(), _a = new THREE.Vector3();
function lampFollow(api, stage) {
  const Lp = api.lamp, lamp = Lp.lamp, parts = Lp.parts;
  const d = api.desk;
  if (d.tip && !Lp.fall && d.tipped > 0.35) {
    // (off the desk's top as it tips: its own fall, toward the door, tumbling)
    parts.group.updateWorldMatrix(true, false);
    const p = parts.group.getWorldPosition(new THREE.Vector3()), q = parts.group.getWorldQuaternion(new THREE.Quaternion());
    stage.scene.attach(parts.group);
    parts.group.position.copy(p); parts.group.quaternion.copy(q);
    Lp.fall = { t: 0, p0: p, v: V(-1.5, 0.6, -0.2), rest: V(d.x - 1.35, FLOOR + 0.07, d.z + 0.35) };
    const G = stage.game;
    if (G) G.sfx.play('office_lampFall', p, {});
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
    parts.group.rotation.set(0, 0.4 * u, (Math.PI / 2 - 0.2) * u);
    if (u >= 1) { F.done = true; const G = stage.game; if (G) G.sfx.play('office_lampLand', p, {}); }
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
    if (Lp.fall && Lp.fall.done) { lamp.light.angle = 1.3; lamp.light.distance = 7; lamp.light.intensity = 9; }
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
  d.tip = null; d.tipped = 0; d.pivot.rotation.z = 0;
  d.collider.cx = d.x; d.collider.hx = DESK.d / 2; d.collider.hz = DESK.w / 2;
  const Lp = api.lamp, lamp = Lp.lamp;
  if (Lp.fall || Lp.parts.group.parent !== d.body) {
    d.body.add(Lp.parts.group);
    Lp.parts.group.position.set(LAMP.x - DESK.x, DESK.h, LAMP.z - DESK.z);
    Lp.parts.group.rotation.set(0, 0, 0);
  }
  Lp.fall = null;
  Object.assign(lamp.light, { intensity: 7.5, angle: 1.15, distance: 4.5 });
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
