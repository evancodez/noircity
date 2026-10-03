import * as THREE from 'three';
import { FOG } from '../../../render/fog.js';
import { makeKit } from '../../../props/diner/kit.js';
import { officeMats } from '../build/mats.js';
import { buildShell } from '../build/shell.js';
import { buildOpenings } from '../build/openings.js';
import { buildFurniture } from '../build/furniture.js';
import { buildSuite } from '../build/suite.js';
import { buildFireEscape, buildStreet } from '../build/outside.js';
import { makeGobo } from '../build/gobo.js';
import { makeDoor } from '../build/door.js';
import { hoodJoints } from '../build/frosted.js';
import { mergeGeos, lathe } from '../../../props/lib.js';
import { FLOOR, CEIL, ROOM, OUTER, OPEN, R305, CORR, WC, LANDING, LIFT, DOOR, DOORS, DESK, PAD, LAMP, WIN, ESC, SAFE, PICTURE, STREET, POST, CORR_LAMP, CORR_LAMP2, BLIND_LIGHT, PICTURE_ASIDE, SEC, CHAIR } from '../plan.js';
// the banker's lamp's strength (the pad sits close under it, in the heart of its pool: at
// this the graphite on the sheet still prints dark, and the blotter round it white)
const DESK_LAMP_I = 30, DESK_LAMP_A = 1.3;
// the muzzle flashes' light in these rooms (fx/MuzzleFlash.js: the street's 32 and 22)
const FLASH_I = { player: 11, hood: 6.5 };
// the street's light up through the blind onto the ceiling
const UP_I = 16000;
// the blind's light on the hands, against its light on the room (build/gobo.js)
const GOBO_K = 0.3;

// The Harbor Building's third floor (lane B2; [C5] wave C: made bigger and
// finished): Ames's room (the old room 304: the desk, the safe, the street
// window and its blind, the fire escape), the outer office in front of it,
// 305 next door, the corridor with its lift and its stair, the washroom.
// Built from ./build/*; this part lights it, gives it its Looks, its dry
// volumes, its anchors, the men's ground, the gun kit's doors and corners,
// and the floor's API:
//   office.doors      { AMES, D305, CONN, STAIR, WC, GATE } (build/door.js: the gun kit's doors)
//   office.door       the suite's front door (AMES) - also the old API's door (setDoor, kickDoor)
//   office.desk       { tip, tipped, drawers[] }  office.tipDesk({ now })   the desk goes over on its front
//   office.lamp       the banker's lamp (stage.lamps' lamp: on / dead / fallen)  office.setLamp(on)
//   office.pad        the pad's sheet (build/pad.js)   office.phone { on(), off(), hung }
//   office.picture    { angle, target } (on its hinge)  office.openPicture()   office.safe
//   office.blind      the slats (build/openings.js)   office.curtain, office.fan
//   office.cabinets   [{ drawers[] }]   office.drawer(d, open)   (every drawer runs all the way)
//   office.lift       { setY, setOpen, dial, ... } (build/suite.js)   office.callLift(onArrive)
//   office.frosted    the frosted panes: [{ frost, mesh }] (the men behind them show on them)
//   office.lights     { blind, desk, corridor, corridor2, outer, wc, landing, car, up, r305, hint }
//   office.reset()    the floor as chapter III finds it (every break mended, the doors shut)
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
    const suite = buildSuite(kit, mats, stage);
    const esc = buildFireEscape(kit, mats, stage);
    const street = buildStreet(kit, mats, stage, lamps);

    // ---- the doors (the gun kit's: build/door.js) ------------------------------------------
    const doors = {};
    for (const [name, spec] of Object.entries(DOORS)) doors[name] = makeDoor(stage, kit, mats, name, spec, { grille: !!spec.grille, h: spec.grille ? 1.9 : DOOR.h });
    // (the splintered lock of the suite's door: the strike torn out of the jamb)
    {
      kit.piece();
      const sp = [];
      const xw = DOORS.AMES.x;
      for (let i = 0; i < 7; i++) sp.push(new THREE.BoxGeometry(0.01, 0.05 + (i % 4) * 0.03, 0.012 + (i % 3) * 0.006).rotateZ((i - 3) * 0.12).translate(xw - 0.05 + (i % 2) * 0.012, 0.96 + i * 0.022, DOOR.z1 + 0.012 + (i % 3) * 0.004));
      kit.add(mergeGeos(sp), mats.deskTop, { cast: false, noRay: true });
    }
    doors.GATE.locked = true;

    // ---- the lights -----------------------------------------------------------------------
    // the street's light through the blind: the hotel's floodlight up the
    // street, a narrow spot aimed through the window (the slats' shadows)
    const from = street.flood.from, at = V(...BLIND_LIGHT.through).sub(from).multiplyScalar(1.3).add(from);
    const axis = at.clone().sub(from).normalize();
    const blindLight = lamps.addCustom({ head: from.clone(), axis, height: from.distanceTo(at) + 6, half: 0.09, real: true, bulb: street.flood.disc, strength: 1, tag: 'blind' });
    Object.assign(blindLight.light, { intensity: 40000, angle: 0.105, penumbra: 0.35, distance: 34 });
    blindLight.cone.visible = false;
    // (first while the eye is in Ames's room or the outer office: the slats are the room's light)
    blindLight.priority = (eye) => (eye.x > OUTER.x0 && eye.z > -0.1 ? 10 : 3);
    blindLight.shadow = { radius: 1.2, mapSize: 2048, bias: -0.00025, normalBias: 0.015, near: 8 };
    // the banker's lamp: a wide low pool on the blotter
    const dl = furn.lamp;
    g.updateMatrixWorld(true);
    const deskHead = dl.shadeG.localToWorld(V(-0.01, -0.03, 0));
    const deskAxis = V(-0.15, -1, 0.05).normalize();
    const deskLamp = lamps.addCustom({ head: deskHead, axis: deskAxis, height: 0.42, half: 0.62, real: true, bulb: dl.bulb, fadeEnd: 0.95, edgeSoft: 0.55, strength: 0.34, tag: 'desk' });
    Object.assign(deskLamp.light, { intensity: DESK_LAMP_I, angle: DESK_LAMP_A, penumbra: 0.45, distance: 5 });
    deskLamp.priority = (eye) => (eye.x > -0.2 && eye.z > -0.2 ? 5 : 1);
    deskLamp.shadow = { radius: 3, mapSize: 1024, near: 0.05 };
    const shadeInv = new THREE.Matrix4().copy(dl.shadeG.matrixWorld).invert();
    dl.localHead = deskHead.clone().applyMatrix4(shadeInv);
    dl.localAxis = deskAxis.clone().transformDirection(shadeInv);
    for (const m of [dl.shadeMesh, dl.inner]) m.userData.lamp = deskLamp;
    // the corridor's two globes: a pool by the suite's door, a pool by the lift, the dark between
    const globe = (L, i, I) => {
      const head = V(L.x, CORR.ceil - 0.36, L.z);
      const lamp = lamps.addCustom({ head, axis: V(0, -1, 0), height: CORR.ceil - 0.36, half: 0.8, real: true, bulb: suite.globes[i], fadeEnd: 0.85, edgeSoft: 0.5, strength: 0.45, tag: 'corridor' });
      Object.assign(lamp.light, { intensity: I, angle: 1.0, penumbra: 0.95, distance: 7 });
      lamp.priority = (eye) => (eye.x < OUTER.x0 + 0.5 ? 6 : 2.5);
      suite.globes[i].userData.lamp = lamp;
      return lamp;
    };
    const corrLamp = globe(CORR_LAMP, 0, 20), corrLamp2 = globe(CORR_LAMP2, 1, 15);
    // the outer office's one bulb: a pendant over the middle of it (dim: the frosted door glows brighter)
    kit.piece();
    const OX = (OUTER.x0 + OUTER.x1) / 2 - 0.2, OZ = 3.6;
    const outerShade = kit.add(mergeGeos([lathe([[0.02, 0.1], [0.05, 0.07], [0.09, 0.02], [0.2, -0.08], [0.24, -0.14], [0.22, -0.14]], 24).translate(OX, CEIL - 0.7, OZ), new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6).translate(OX, CEIL - 0.3, OZ)]), mats.shade, { name: 'outer_shade' });
    const outerBulb = kit.add(new THREE.CircleGeometry(0.17, 20).rotateX(Math.PI / 2).translate(OX, CEIL - 0.84, OZ), mats.bulb, { cast: false, noRay: true });
    const outerLamp = lamps.addCustom({ head: V(OX, CEIL - 0.86, OZ), axis: V(0, -1, 0), height: CEIL - 0.86, half: 0.75, real: true, bulb: outerBulb, fadeEnd: 0.8, edgeSoft: 0.5, strength: 0.32, tag: 'outer' });
    Object.assign(outerLamp.light, { intensity: 16, angle: 0.95, penumbra: 0.8, distance: 6.5 });
    outerLamp.priority = (eye) => (eye.x < 0.4 && eye.x > OUTER.x0 - 1.5 && eye.z > -0.2 ? 4 : 1.5);
    outerShade.userData.lamp = outerLamp;
    // 305: no lamp of its own - the street's glow through its blind, very low
    const r305Lamp = lamps.addCustom({ head: V(ROOM.x1 - 0.3, 2.3, (R305.z0 + R305.z1) / 2 + 0.3), axis: V(-1, -0.45, 0).normalize(), height: 6, half: 0.9, real: true, strength: 0, tag: 'r305' });
    Object.assign(r305Lamp.light, { intensity: 6, angle: 1.1, penumbra: 0.9, distance: 9 });
    r305Lamp.cone.visible = false;
    r305Lamp.priority = (eye) => (eye.z < -0.1 && eye.x > OUTER.x0 ? 4 : 0);
    // the washroom's bulb on its chain (off), the landing's caged bulb (on), the lift car's (on)
    const wcLamp = lamps.addCustom({ head: suite.wcBulb.clone().setY(CEIL - 0.66), axis: V(0, -1, 0), height: CEIL - 0.66, half: 0.9, real: true, strength: 0.4, tag: 'wc' });
    Object.assign(wcLamp.light, { intensity: 14, angle: 1.2, penumbra: 0.8, distance: 5 });
    wcLamp.on = false;
    wcLamp.priority = (eye) => (eye.z > CORR.z1 - 2 && eye.x < OUTER.x0 ? 4 : 0);
    kit.piece();
    const landBulb = kit.add(new THREE.SphereGeometry(0.045, 10, 8).translate(-6.4, CEIL - 0.3, -5.0), mats.bulb, { cast: false, noRay: true });
    const landLamp = lamps.addCustom({ head: V(-6.4, CEIL - 0.36, -5.0), axis: V(-0.35, -1, 0).normalize(), height: CEIL - 0.36 + 1.4, half: 0.9, real: true, bulb: landBulb, strength: 0.3, tag: 'landing' });
    Object.assign(landLamp.light, { intensity: 10, angle: 1.15, penumbra: 0.85, distance: 6 });
    landLamp.priority = (eye) => (eye.x < CORR.x0 + 1.2 && eye.z < -2.5 ? 4 : 0);
    const L = suite.lift;
    const carLamp = lamps.addCustom({ head: V(L.cx, 2.2, L.cz), axis: V(0, -1, 0), height: 2.2, half: 0.85, real: true, bulb: L.carBulb, strength: 0.4, tag: 'car' });
    Object.assign(carLamp.light, { intensity: 14, angle: 1.1, penumbra: 0.8, distance: 5 });
    carLamp.priority = (eye) => (eye.x < OUTER.x0 && eye.z < -2 ? 4 : 0);
    L.lamp = carLamp;
    // the street's light up through the blind onto the ceiling (round 2)
    const upFrom = street.post.head.clone().add(V(-0.35, 0.05, 0));
    const upAt = V(1.6, CEIL, (WIN.z0 + WIN.z1) / 2 - 0.25);
    const upLamp = lamps.addCustom({ head: upFrom, axis: upAt.clone().sub(upFrom).normalize(), height: 4, half: 0.09, real: true, strength: 0, tag: 'streetUp' });
    Object.assign(upLamp.light, { intensity: UP_I, angle: 0.1, penumbra: 0.35, distance: 30 });
    upLamp.cone.visible = false;
    upLamp.priority = (eye) => (eye.x > 0 && eye.z > 0 ? 4 : 0);
    upLamp.shadowOnly = true;
    upLamp.shadow = { radius: 1.4, mapSize: 1024, bias: -0.0003, normalBias: 0.02, near: 11 };
    // the hint's light: a small hard spot from the ceiling that flickers on a thing, now and then
    // (chapter III's stall: the room points, it never says)
    const hintLamp = lamps.addCustom({ head: V(2.8, CEIL - 0.05, 3.5), axis: V(0, -1, 0), height: 3, half: 0.12, real: true, strength: 0, tag: 'hint' });
    Object.assign(hintLamp.light, { intensity: 0, angle: 0.16, penumbra: 0.5, distance: 7 });
    hintLamp.cone.visible = false;
    hintLamp.noShadow = true;
    hintLamp.on = false;
    hintLamp.priority = 8;

    // ---- the Looks, the dry volumes, the walls of the stage ----------------------------------
    stage.dry.push(shell.roomBox, shell.outerBox, shell.r305Box, shell.corrBox, shell.wcBox, shell.landBox, shell.liftBox);
    const inside = { fogDensity: FOG.density * 0.3, rainOverlay: 0, haze: 0.65, reflect: 'none', ambient: 0.2 };
    stage.addLook(shell.roomBox, { ...inside, room: 'office' });
    stage.addLook(shell.outerBox, { ...inside, ambient: 0.17, room: 'office' });
    stage.addLook(shell.r305Box, { ...inside, ambient: 0.13, haze: 0.5, room: 'office' });
    stage.addLook(shell.corrBox, { ...inside, ambient: 0.18, haze: 0.45, room: 'corridor' });
    stage.addLook(shell.wcBox, { ...inside, ambient: 0.14, haze: 0.4, room: 'corridor' });
    stage.addLook(shell.landBox, { ...inside, ambient: 0.13, haze: 0.4, room: 'corridor' });
    stage.addLook(shell.liftBox, { ...inside, ambient: 0.15, haze: 0.4, room: 'corridor' });
    stage.colliders.setBounds(-10.0, 6.2, -9.4, 9.8);

    // ---- the gun kit's corners: beside every doorway, the wall between us -------------------------
    // ({ x, z, nx, nz }: a man stands there and steps into the opening to shoot)
    stage.coverCorners = [
      // the opening between the rooms: the outer office's side, and Ames's
      { x: -0.6, z: OPEN.z0 - 0.42, nx: -1, nz: 0 }, { x: -0.6, z: OPEN.z1 + 0.42, nx: -1, nz: 0 },
      { x: 0.5, z: OPEN.z0 - 0.42, nx: 1, nz: 0 }, { x: 0.5, z: OPEN.z1 + 0.42, nx: 1, nz: 0 },
      // the suite's door: the corridor's side (the jamb, the sidelight), the outer office's
      { x: -4.5, z: DOOR.z0 - 0.4, nx: -1, nz: 0 }, { x: -4.5, z: DOOR.z1 + 0.25, nx: -1, nz: 0 },
      { x: -3.3, z: DOOR.z0 - 0.42, nx: 1, nz: 0 }, { x: -3.3, z: DOOR.z1 + 0.42, nx: 1, nz: 0 },
      // 305's door, the connecting door (both sides)
      { x: -4.5, z: DOORS.D305.z0 - 0.4, nx: -1, nz: 0 }, { x: -4.5, z: DOORS.D305.z1 + 0.4, nx: -1, nz: 0 },
      { x: -3.3, z: DOORS.D305.z1 + 0.42, nx: 1, nz: 0 },
      { x: DOORS.CONN.x0 - 0.42, z: -0.55, nx: 0, nz: -1 }, { x: DOORS.CONN.x1 + 0.38, z: -0.55, nx: 0, nz: -1 },
      { x: DOORS.CONN.x0 - 0.42, z: 0.5, nx: 0, nz: 1 },
      // the stair door (the corridor's side), the washroom's, the lift's
      { x: -5.1, z: DOORS.STAIR.z0 - 0.4, nx: 1, nz: 0 }, { x: -5.1, z: DOORS.STAIR.z1 + 0.4, nx: 1, nz: 0 },
      { x: -6.3, z: DOORS.STAIR.z1 + 0.5, nx: -1, nz: 0 },
      { x: -5.25, z: CORR.z1 - 0.45, nx: 0, nz: 1 }, { x: -4.3, z: CORR.z1 - 0.45, nx: 0, nz: 1 },
      { x: -5.3, z: CORR.z0 + 0.45, nx: 0, nz: -1 }, { x: -4.25, z: CORR.z0 + 0.45, nx: 0, nz: -1 },
    ];

    // ---- the anchors -------------------------------------------------------------------------
    const A = (name, x, z, yaw, extra = {}) => stage.addAnchor('office.' + name, { pos: V(x, FLOOR, z), yaw, ...extra });
    // (out of the lift at the corridor's south end, facing up it)
    A('corridor.start', (LIFT.x0 + LIFT.x1) / 2, CORR.z0 + 0.7, Math.PI);
    A('door', -4.55, (DOOR.z0 + DOOR.z1) / 2, -Math.PI / 2, { r: 1.2 });
    A('desk', 4.8, PAD.z + 0.02, Math.PI / 2);
    A('safe', SAFE.x + 0.02, 0.78, 0);
    A('window.street', 5.42, (WIN.z0 + WIN.z1) / 2 + 0.3, -Math.PI / 2 - 0.02, { eyeY: 1.72 });
    A('window.escape', (ESC.x0 + ESC.x1) / 2, ROOM.z1 - 0.62, Math.PI);
    stage.addAnchor('office.street.watcher', { pos: V(POST.x - 0.25, STREET.y + 0.15, POST.z - 0.7), yaw: Math.PI / 2 });
    A('cover.desk', DESK.x + 0.7, DESK.z + 0.1, Math.PI / 2);
    // (the check's table: the blotter under the lamp, where the pad was - pushed aside - seen from the chair's side)
    stage.addAnchor('office.blotter', { pos: V(PAD.x + 0.01, DESK.h + 0.007, PAD.z), yaw: Math.PI / 2 });

    // ---- the API -------------------------------------------------------------------------------
    const door = doors.AMES;
    const frosted = [];
    const addFrost = (frost, mesh, d = null, lampFor = null) => frosted.push({ frost, mesh, door: d, lampFor });
    addFrost(door.frost, door.pane.mesh, door);
    addFrost(open.side.frost, open.side.pane.mesh);
    addFrost(open.transom.frost, open.transom.mesh);
    for (const n of ['D305', 'STAIR', 'WC']) if (doors[n].frost) addFrost(doors[n].frost, doors[n].pane.mesh, doors[n]);
    for (const o of open.others) { o.frost.userData.setLamp(o.east ? corrLamp.head : corrLamp.head, 0.4); }
    const api = {
      group: g, kit, mats, shell, open, furn, suite, esc, street, rng,
      doors, door, desk: furn.desk, pad: furn.pad, pencilAt: furn.pencilAt, picture: furn.picture, safe: furn.safe, phone: furn.phone,
      blind: open.blind, curtain: open.curtain, fan: furn.fan, cooler: furn.cooler, cabinets: furn.cabinets, chair: furn.chair, chairCol: furn.chairCol,
      window: open.window, escape: open.escape, side: open.side, frosted, others: open.others, lift: suite.lift, sheets: suite.sheets,
      lights: { blind: blindLight, desk: deskLamp, corridor: corrLamp, corridor2: corrLamp2, outer: outerLamp, r305: r305Lamp, wc: wcLamp, landing: landLamp, car: carLamp, post: street.post.lamp, up: upLamp, hint: hintLamp },
      lamp: { lamp: deskLamp, parts: dl, fallen: 0, fall: null },
      neon: street.neon,
      gust: 0,
      lampDim: 0, lampDimTo: 0,
      sections: [...furn.desk.sections, ...suite.sections],
      // ---- the suite's door (the old API: an angle, a swing, a kick) --------------------
      setDoor(angle) { door.set(angle); },
      swingDoor(angle, speed = 1.6) { door.target = angle; door.speed = speed; door.moving = true; door.kicked = false; },
      kickDoor() { door.kick(); },
      doorCollider() { door.apply(); },
      // ---- the banker's lamp's chain ------------------------------------------------------
      setLamp(on) {
        const Lp = api.lamp.lamp;
        if (Lp.dead) return false;
        Lp.on = !!on;
        // (the shade's lit inside only while it burns)
        api.lamp.parts.inner.material = on ? mats.lampInner : mats.shade;
        return true;
      },
      get lampOn() { return !!api.lamp.lamp.on && !api.lamp.lamp.dead; },
      // ---- a drawer: all the way out, or all the way in ---------------------------------------
      drawer(d, out) { if (d.locked && out) return false; d.target = out ? 1 : 0; return true; },
      // ---- the desk goes over ------------------------------------------------------------
      tipDesk({ now = false } = {}) {
        const d = furn.desk;
        if (d.tip) return false;
        d.tip = { t: 0, a: now ? Math.PI / 2 : 0, v: 0 };
        d.tipNow = now;
        drawersHome(api, true);
        if (now) { d.tip.done = true; d.pivot.rotation.z = Math.PI / 2; d.pivot.updateMatrixWorld(true); d.tipped = 1; spill(api, stage); afterTip(api, stage); }
        return true;
      },
      // ---- the picture swings open on its hinge ------------------------------------------
      openPicture() { const p = furn.picture; p.target = PICTURE_ASIDE; p.swinging = true; },
      swingPicture() { api.openPicture(); },
      // ---- the lift: called up (the dial, the motor, the car rising into its cage), the cage folded open
      callLift(onArrive = null, { from = -3.3, secs = 5.5 } = {}) {
        const Lf = suite.lift;
        Lf.run = { t: 0, from, secs, onArrive, opened: false };
        Lf.setOpen(0); Lf.setY(from);
        const G = stage.game;
        if (G && G.sfx) G.sfx.play('c5_liftMotor', V(Lf.cx, 1.5, CORR.z0 - 0.5), { dur: secs }, { ref: 4 });
      },
      reset() { resetRoom(api, stage); },
      // the frosted panes show the men behind them (lane C2's updateFrost, killhouse/parts/house.js)
      updateFrost() {
        const G = stage.game;
        const men = stage.hoods.list.filter((h) => h.alive || (h._deathT ?? 9) < 0.7);
        for (const f of frosted) {
          const fr = f.frost, n = f.mesh;
          if (!n.visible && f.mesh !== open.transom.mesh) continue;
          n.updateWorldMatrix(true, false);
          const c = new THREE.Vector3().setFromMatrixPosition(n.matrixWorld);
          const q = n.getWorldQuaternion(new THREE.Quaternion());
          const u = V(1, 0, 0).applyQuaternion(q), v = V(0, 1, 0).applyQuaternion(q), nn = V(0, 0, 1).applyQuaternion(q);
          fr.userData.setFrame(c, u, v, nn);
          const e = G ? G.eye : c;
          const side = Math.sign((e.x - c.x) * nn.x + (e.z - c.z) * nn.z) || 1;
          // (the light behind it: the corridor's nearest globe from the room's side, the room's from the corridor)
          const inCorr = e.x < OUTER.x0 - 0.05;
          const Ls = inCorr ? [outerLamp] : [corrLamp, corrLamp2, landLamp, wcLamp];
          let lamp = Ls[0], bd = Infinity;
          for (const L2 of Ls) { const d = L2.head.distanceTo(c); if (d < bd && !L2.dead && L2.on !== false) { bd = d; lamp = L2; } }
          fr.userData.setLamp(lamp.head, lamp.dead ? 0.05 : 1);
          const F2 = fr.userData.figures;
          F2.length = 0;
          let near = null, nearA = 0;
          for (const h of men) {
            if (F2.length >= 3) break;
            const d = (h.pos.x - c.x) * nn.x + (h.pos.z - c.z) * nn.z;
            if (Math.sign(d) === side || Math.abs(d) > 2.4) continue;
            const along = (h.pos.x - c.x) * u.x + (h.pos.z - c.z) * u.z;
            if (Math.abs(along) > 2.2) continue;
            if (!h._c2j) h._c2j = hoodJoints(h);
            F2.push({ k: h.alive ? 1 : Math.max(0, 1 - (h._deathT ?? 0) / 0.7), joints: h._c2j });
            if (!near || Math.abs(d) < near) { near = Math.abs(d); nearA = along; }
          }
          if (near != null && fr.userData.U) {
            const U2 = fr.userData.U;
            U2.uSrcD.value = 2.4;
            U2.uSrc.value.copy(c).addScaledVector(u, nearA).addScaledVector(nn, -side * 2.4);
            U2.uSrc.value.y = 1.55;
          }
          fr.userData.update();
        }
      },
    };
    // (the room's fixed sections' hp kept: a reset mends them)
    for (const m of api.sections) { const cv = m.userData.cover; if (cv && cv.hp != null && cv.hp0 == null) cv.hp0 = cv.hp; }
    api.setDoor(0);
    door.closer = true;
    return api;
  },

  update(api, dt, t, camera) {
    const stage = api.kit.stage, G = stage.game;
    if (!api._flashSet && stage.fx && stage.fx.flash) { api._flashSet = true; Object.assign(stage.fx.flash.intensity, FLASH_I); }
    // the doors (the gun kit's), the frosted panes and the men behind them
    for (const d of Object.values(api.doors)) d.update(dt);
    api.updateFrost();
    // the drawers: all the way out or all the way in, a quick slide and a knock at the end
    const D = api.desk;
    for (const d of D.drawers) stepDrawer(d, dt, G, (dd) => dd.group.parent.localToWorld(dd.group.position.clone()), (dd, o) => { dd.group.position.x = DESK.d / 2 + o * dd.max; });
    for (const c of api.cabinets) for (const d of c.drawers) stepDrawer(d, dt, G, (dd) => c.group.localToWorld(dd.group.position.clone()), (dd, o) => { dd.group.position.z = dd.base - o * dd.max; });
    // the desk going over: a fall about its front edge, a bounce, rest
    const dk = api.desk;
    if (dk.tip && !dk.tip.done) {
      const Tp = dk.tip;
      Tp.t += dt;
      const tq = 9.8 * Math.sin(Math.max(0.05, Tp.a) + 0.62) * 0.9;
      Tp.v += (Tp.a < 0.02 ? 4.5 : tq) * dt;
      Tp.a += Tp.v * dt;
      if (Tp.a >= Math.PI / 2) {
        Tp.a = Math.PI / 2;
        if (Tp.v > 1.2) { Tp.v = -Tp.v * 0.22; if (G) { G.sfx.play('office_deskFall', V(dk.x - 0.4, 0.3, dk.z), { k: 1 }); G.controller.shake(0.35, Math.hypot(G.eye.x - dk.x, G.eye.z - dk.z)); } }
        else { Tp.v = 0; Tp.done = true; afterTip(api, stage); }
      }
      dk.pivot.rotation.z = Tp.a;
      dk.tipped = Tp.a / (Math.PI / 2);
      if (!dk.spill && dk.tipped > 0.45) spill(api, stage);
      // (the bullets' copy of it as it goes)
      if (G && G.rays && (dk._rt = (dk._rt || 0) + 1) % 3 === 0) deskRays(api, stage, false);
    }
    lampFollow(api, stage);
    api.lampDim += ((api.lampDimTo || 0) - api.lampDim) * Math.min(1, dt * 7);
    if (!api.lamp.fall && !api.lamp.lamp.dead) api.lamp.lamp.light.intensity = DESK_LAMP_I * (1 - 0.74 * api.lampDim);
    // the picture on its hinge
    const P = api.picture;
    if (P.swinging) {
      const e = P.target - P.angle;
      P.vel += (e * 30 - P.vel * 6.5) * dt;
      P.angle += P.vel * dt;
      P.hang.rotation.y = -P.angle;
      if (Math.abs(e) < 0.002 && Math.abs(P.vel) < 0.01) P.swinging = false;
    }
    // the fan: its slow turn
    const F = api.fan;
    F.rotor.rotation.y -= (F.rpm / 60) * Math.PI * 2 * dt;
    if (dt > 0 && (api._fanK = (api._fanK || 0) + 1) % 3 === 0) {
      for (const sl of stage.lamps.pool) if (sl.lamp === api.lights.up && sl.shadow) sl.spot.shadow.needsUpdate = true;
    }
    api.gust += (Math.sin(t * 0.37) * 0.5 + Math.sin(t * 1.13 + 1) * 0.3 - api.gust) * Math.min(1, dt * 0.8);
    api.curtain.step(t, Math.max(0, api.gust));
    const N = api.neon;
    if (N) {
      const n = Math.sin(t * 0.83 + N.seed) * Math.sin(t * 2.9) + Math.sin(t * 17.0) * 0.08;
      const on = !(n > 0.72 && Math.sin(t * 37) > -0.3);
      if (on !== N.lit) { N.lit = on; N.mesh.material = on ? N.on : N.off; }
      const bl = api.lights.blind;
      bl.base = on ? 1 : 0.82;
      if (bl.light) bl.light.intensity = 40000 * bl.base;
    }
    // the lift: called up, the car rises into its cage, the bell, the cage folds open
    const Lf = api.lift;
    if (Lf.run) {
      const R = Lf.run;
      R.t += dt;
      const u = Math.min(1, R.t / R.secs);
      Lf.dial(1 + 2 * Math.min(1, u * 1.15));
      // (the car's last floor and a half: it comes up into the cage)
      const v = Math.max(0, Math.min(1, (u - 0.55) / 0.45));
      Lf.setY(R.from * (1 - v * v * (3 - 2 * v)));
      Lf.lamp.head.set(Lf.cx, Lf.y + 2.2, Lf.cz); Lf.lamp.light.pos.copy(Lf.lamp.head); Lf.lamp.light.target.copy(Lf.lamp.head).add(V(0, -2, 0)); Lf.lamp.moved = true;
      if (u >= 1 && !R.rang) { R.rang = true; if (G) G.sfx.play('c5_liftBell', V(Lf.cx, 2.3, CORR.z0 + 0.1), {}, { ref: 4 }); }
      if (u >= 1 && R.t > R.secs + 0.6) {
        const k = Math.min(1, (R.t - R.secs - 0.6) / 0.7);
        if (!R.opened) { R.opened = true; if (G) G.sfx.play('c5_cage', V(Lf.cx, 1.2, CORR.z0), {}, { ref: 4 }); }
        Lf.setOpen(k);
        if (k >= 1) { const cb = R.onArrive; Lf.run = null; if (cb) cb(); }
      }
    }
    if (api._gobo === undefined && G) api._gobo = makeGobo(G, stage, api.blind, api.lights.blind) || null;
    if (api._gobo) api._gobo.update((api.lights.blind._k ?? 1) * GOBO_K);
  },
};

// a drawer's slide (out: 0..1 of its run): quick, eased, a knock at each end
function stepDrawer(d, dt, G, where, set) {
  if (d.gone || Math.abs(d.target - d.out) < 1e-4) return;
  const was = d.out;
  d.out += Math.sign(d.target - d.out) * Math.min(Math.abs(d.target - d.out), dt / 0.28);
  set(d, d.out * d.out * (3 - 2 * d.out));
  if (G && (d.out === 0 || d.out === 1) && was !== d.out) G.sfx.play('office_drawer', where(d), { k: d.out ? 0.6 : 1 });
}

// the desk has gone over: its collider turns to the tipped footprint (a low
// wall on its front, the drawers' side up), cover for a man crouched behind it
function afterTip(api, stage) {
  const d = api.desk, c = d.collider;
  c.cx = d.x - DESK.d / 2 - DESK.h / 2 + 0.02; c.hx = DESK.h / 2; c.hz = DESK.w / 2 + 0.05;
  deskRays(api, stage, true);
  const G = stage.game;
  // (the gun kit reads the room again: the men's grid and their cover)
  if (G && G.guns && G.guns.active && G.guns.rebuild) G.guns.rebuild();
}
// the bullets' copy of the desk where the desk is (tipped, or stood up again)
function deskRays(api, stage, shadows = true) {
  const G = stage.game, d = api.desk;
  if (G && G.rays) d.body.traverse((m) => { if (m.isMesh && stage.solids.includes(m)) G.rays.refresh(m); });
  if (shadows && G && G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
}
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
// every drawer of the desk run home (the desk going over), or as it was found
function drawersHome(api, shut) {
  for (const d of api.desk.drawers) { if (d.gone) continue; if (shut) { d.out = d.target = 0; d.group.position.x = DESK.d / 2; } }
  api.desk.slid = shut;
}

// the banker's lamp: its light follows its head wherever the desk takes it;
// once the desk goes over the lamp is thrown off it and lies on the floor,
// burning, its light along the boards and up the walls
const _h = new THREE.Vector3(), _a = new THREE.Vector3();
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
    parts.group.quaternion.slerpQuaternions(F.q0, F.q1, Math.min(1, u * 1.15));
    if (u >= 1) {
      F.done = true;
      const G = stage.game;
      if (G && !F.quiet) G.sfx.play('office_lampLand', p, {});
      if (G && G.rays) { parts.group.updateWorldMatrix(true, true); parts.group.traverse((m) => { if (m.isMesh && stage.solids.includes(m)) G.rays.refresh(m); }); }
    }
  }
  parts.shadeG.updateWorldMatrix(true, false);
  parts.shadeG.localToWorld(_h.copy(parts.localHead));
  const dir = _a.copy(parts.localAxis).transformDirection(parts.shadeG.matrixWorld);
  if (_h.distanceToSquared(lamp.head) > 1e-8 || dir.distanceToSquared(lamp.axis) > 1e-8) {
    lamp.head.copy(_h); lamp.axis.copy(dir).normalize();
    lamp.light.pos.copy(_h);
    lamp.light.target.copy(_h).addScaledVector(lamp.axis, 2);
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

// every break mended, the floor as chapter III finds it
function resetRoom(api, stage) {
  const B = stage.breakables, Gl = stage.glass, G = stage.game;
  for (const h of B.list) if (B.restore) B.restore(h);
  if (B.clearPieces) B.clearPieces();
  for (const p of Gl.panes) Gl.restore(p);
  // the doors shut (the suite's on its closer; the gate locked)
  for (const d of Object.values(api.doors)) { d.set(0); d.locked = d.name === 'GATE'; d.closer = false; d.jolt = 0; }
  api.door.closer = true;
  // the wood made whole
  for (const m of api.sections) {
    const c = m.userData.cover;
    if (!c) continue;
    c.hp = c.hp0 ?? c.hp; c.broken = false; c.hits = 0;
    if (!m.visible) { m.visible = true; if (!stage.solids.includes(m)) stage.addSolid(m); }
    if (G && G.rays) G.rays.setEnabled(m, true);
  }
  // the desk upright, its lamp on it (off: its chain), its drawers as they were found
  const d = api.desk;
  d.tip = null; d.tipped = 0; d.pivot.rotation.z = 0; d.tipNow = false;
  d.collider.cx = d.x; d.collider.hx = DESK.d / 2; d.collider.hz = DESK.w / 2;
  unspill(api);
  for (const dr of d.drawers) { dr.out = dr.target = 0; dr.group.position.x = DESK.d / 2; dr.locked = dr.id === 'R1'; dr.group.visible = !dr.gone; }
  for (const c of api.cabinets) for (const dr of c.drawers) { dr.out = dr.target = dr.found ?? dr.out; dr.group.position.z = dr.base - dr.out * dr.max; }
  api.phone.off();
  api.pad.block.visible = true; api.pad.mesh.visible = true;
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
  for (const L of Object.values(api.lights)) if (L && L.dead) { L.dead = false; L.buzz = null; L.dieNow = false; L.deadK = 0; L.on = true; if (L.bulb) L.bulb.material = api.mats.bulb; }
  api.setLamp(false);
  api.lights.wc.on = false;
  api.lights.hint.on = false;
  // the picture shut on its hinge (standing a finger off the wall), the safe shut
  const P = api.picture;
  P.angle = P.target = P.shut; P.vel = 0; P.swinging = false; P.hang.rotation.y = -P.angle;
  const S = api.safe;
  S.open = 0; S.hinge.rotation.y = 0; S.dial = 0; S.dialG.rotation.z = -Math.PI * 1.5; S.handle = 0; S.handleG.rotation.z = 0;
  // the lift at this floor, its cage shut
  const Lf = api.lift;
  Lf.run = null; Lf.setY(0); Lf.setOpen(0); Lf.dial(3);
  Lf.lamp.head.set(Lf.cx, 2.2, Lf.cz); Lf.lamp.light.pos.copy(Lf.lamp.head); Lf.lamp.light.target.copy(Lf.lamp.head).add(V(0, -2, 0)); Lf.lamp.moved = true;
  api.blind.reset();
  api.curtain.reset();
  const F = api.fan;
  F.rpm = 38; F.bent = false; for (const b of F.blades) { b.bent = 0; b.mesh.rotation.set(0, 0, 0); }
  if (G && G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
  if (G && G.sfx && G.sfx.roomOpen) G.sfx.roomOpen(0);
  void CEIL; void SAFE; void PICTURE; void SEC; void CHAIR; void WC; void LANDING; void ROOM; void R305;
}
