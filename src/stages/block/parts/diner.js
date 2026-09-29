import * as THREE from 'three';
import { DINER, stoolZ, dinerInSight } from '../site.js';
import { FOG } from '../../../render/fog.js';
import { buildProp } from '../../../props/index.js';
import { makeKit } from '../../../props/diner/kit.js';
import { buildShell } from '../../../props/diner/room.js';
import { buildCounter, buildBackBar, buildPieCase, buildRegister, BAR } from '../../../props/diner/counter.js';
import { buildBooths, buildBlind, buildWindowLight, buildTrainBars } from '../../../props/diner/booths.js';
import { buildJukebox } from '../../../props/diner/jukebox.js';
import { buildPendants, buildFans, swingStep } from '../../../props/diner/fixtures.js';
import { FIRE } from '../../../fx/fxTextures.js';
import { buildExtras } from '../../../props/diner/extras.js';
import { buildDinerLight } from '../../../props/diner/light.js';

// The diner (docs/story/CONTRACTS.md §15; lane 5's brief): the room on the
// ground floor of the near building, behind its street front
// (parts/dinerFront.js). Everything here is at x < -10.45. A black room
// with pools of light: six pendants over the counter, two over the booths;
// the booths lit by the street through the wet glass; the back bar's lit
// glass behind rows of bottle silhouettes; the kitchen hatch bright; the
// jukebox glowing at the end of the room. The furniture is built by
// src/props/diner/*.js (room, counter, booths, jukebox, fixtures).
// API (stage.part('diner'), lane 5's brief P0.2):
//   d.anchors            every anchor of the site plan, also stage.anchor('diner.*'):
//                        stool.1..9, stool.player (= stool.4), serve.1..9 (also
//                        counter.serve.1..9), booth.1..4.a / .b (seats), hatch (the
//                        cook's place in the kitchen, behind the opening),
//                        jukebox.front, door.in, door.out, ring.centre, urns,
//                        bar.scotch, till (at the far end, by the register),
//                        window.B1..B4 (inside face centres), counter.player (the
//                        counter top before stool 4: the puzzle table),
//                        counter.glass (where the scotch is set), pavement.ko,
//                        piecase, register, bell
//                        Seats: pos is the seat's top; eyeY the seated eye.
//                        yaw: a viewer's (the controller's) facing there.
//   d.stool(i)           { object, seat, spin(impulse), topple(dir), upright() }
//   d.items              Map name -> Object3D on the counter (and the back bar)
//   d.place(kind, anchor | Vector3, { name, variant, yaw }) -> Object3D    d.take(name)
//   d.jukebox { object, slot, play(slot), next(), hit(power) }   d.bell { ring() }
//   d.doorBell { ring() }   d.register { open(), close(), isOpen }
//   d.clock { time: 'hh:mm', seconds }   d.fans [{ rotor, rpm, speed }]
//   d.lamps [] (the pendants: stage.lamps.addCustom lamps, each with swing(impulse))
//   d.cupsRattle(strength, seconds)   d.lampsDip(depth, seconds)
//   d.trainPass(seconds, { at })      d.reset()
//   d.pieCase { group, pie, handle }  d.booths [{ z, table, handle, items }]
// The room has no light of its own: its pendants are lamps of the block's
// pool (they take its pooled spot lights while the eye is in here: nearest
// lamps win). Its dry volume keeps the rain out; its Look is an interior one
// (no screen rain, low fog, haze, the room's sound).
// Drawn only while the diner is in sight (site.js dinerInSight), like the
// front; out of sight its pendants are off (no light, cone or pool share).
// Everything alive runs in the fixed step from the step's time; the only
// randomness (steam, drips, the train's tremble) is a fork of the stage's rng.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const D = DINER, C = D.counter, F = D.floorY;

export default {
  name: 'diner', order: 140, tick: 140,
  build(stage) {
    const { colliders, lamps } = stage;
    const W = D.innerX, B = D.backX;
    const g = new THREE.Group();
    g.name = 'diner';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const rng = stage.rng.fork(5150);

    // ---- the room, its furniture
    const shell = buildShell(kit);
    buildCounter(kit);
    const bar = buildBackBar(kit);
    const pie = buildPieCase(kit, buildProp);
    const reg = buildRegister(kit);
    const booths = buildBooths(kit, stage, buildProp);
    const blind = buildBlind(kit, 'B2', 0.5);
    const windowLight = buildWindowLight(kit, booths, blind);
    const trainBars = buildTrainBars(kit);
    const jb = buildJukebox(kit);
    const J = D.jukebox;
    jb.group.position.set(J.x, F, D.zMin + jb.size.z / 2 + 0.03);
    g.add(jb.group);
    const pendants = buildPendants(kit, lamps);
    const fans = buildFans(kit);
    const extras = buildExtras(kit);
    // (round 2: the light behind the people and on the floor between them)
    const lightRig = buildDinerLight(kit, { windowLight, jukebox: jb, lamps: pendants, floor: shell.floor });

    // ---- colliders: the counter, the back bar, the booths, the jukebox
    const cx0 = C.frontX - C.depth;
    colliders.addBox((cx0 + C.frontX) / 2, (C.z0 + C.z1) / 2, C.depth / 2 + 0.02, (C.z1 - C.z0) / 2, 0, 'counter');
    colliders.addBox((B + BAR.cabX) / 2, (C.z0 + C.z1) / 2, (BAR.cabX - B) / 2 + 0.01, (C.z1 - C.z0) / 2, 0, 'counter');
    const BT = D.booths, bx = (BT.x0 + BT.x1) / 2;
    for (const b of booths) colliders.addBox(bx, b.z + (b.short ? 0.1 : 0), (BT.x1 - BT.x0) / 2, b.half + 0.06 + (b.short ? 0.2 : 0), 0, 'booth');
    colliders.addBox(J.x, D.zMin + jb.size.z / 2, jb.size.x / 2 + 0.02, jb.size.z / 2 + 0.02, 0, 'jukebox');
    colliders.addBox(-13.75, D.zMax - 0.22, 0.33, 0.23, 0, 'machine');

    // ---- the stools: nine chrome pedestals, each a breakable that swivels
    const stools = [];
    for (let i = 1; i <= D.stools.n; i++) {
      const s = buildProp('stool');
      s.position.set(D.stools.x, F, stoolZ(i));
      g.add(s);
      const seat = s.userData.parts.seat;
      // (each seat left where its last sitter turned it)
      seat.rotation.y = (i * 1.7) % (Math.PI * 2);
      const col = colliders.addCircle(D.stools.x, stoolZ(i), 0.2, 'stool');
      const h = stage.breakables.add(s, { kind: 'stool', hp: 3, collider: col });
      const st = {
        object: s, seat, handle: h, spinV: 0, seat0: seat.rotation.y,
        spin(impulse = 1) { st.spinV += impulse * 4; },
        topple(dir = V(1, 0, 0)) { stage.breakables.topple(h, dir); },
        upright() {
          stage.breakables.upright(h);
          s.rotation.set(0, 0, 0); s.quaternion.identity(); s.position.set(D.stools.x, F, stoolZ(i));
          seat.rotation.y = st.seat0; st.spinV = 0;
        },
      };
      stools.push(st);
    }

    // ---- the anchors of the site plan
    const anchor = (name, pos, yaw, extra = {}) => stage.addAnchor('diner.' + name, { pos, yaw, ...extra });
    for (let i = 1; i <= D.stools.n; i++) {
      const z = stoolZ(i);
      anchor('stool.' + i, V(D.stools.x, D.stools.seatY, z), Math.PI / 2, { eyeY: D.seatedEyeY, seat: true });
      anchor('serve.' + i, V(D.serveX, F, z), -Math.PI / 2);
      stage.addAnchor('counter.serve.' + i, { pos: V(D.serveX, F, z), yaw: -Math.PI / 2 });
    }
    stage.addAnchor('diner.stool.player', { ...stage.anchor('diner.stool.' + D.playerStool), name: 'diner.stool.player' });
    booths.forEach((b, i) => {
      // a: the seat on the booth's south side, looking north (+z); b: the other
      const za = b.short ? b.z - 0.62 : b.z - b.half + 0.3, zb = b.z + b.half - 0.3;
      anchor(`booth.${i + 1}.a`, V(bx, b.short ? F + 0.48 : F + 0.45, za), Math.PI, { seat: true, eyeY: F + 1.3 });
      anchor(`booth.${i + 1}.b`, V(bx, F + 0.45, zb), 0, { seat: true, eyeY: F + 1.3 });
    });
    const z4 = stoolZ(D.playerStool);
    const H = D.hatch;
    anchor('hatch', V(B + 0.27, F, (H.z0 + H.z1) / 2), -Math.PI / 2);
    anchor('jukebox.front', V(J.x, F, D.zMin + 1.15), 0);
    anchor('ring.centre', V(D.ring.x, F, D.ring.z), Math.PI, { r: D.ring.r });
    anchor('urns', V(BAR.cabX + 0.45, F, 6.9), -Math.PI / 2);
    anchor('bar.scotch', V(B + 0.2, BAR.cabTop, z4), -Math.PI / 2);
    anchor('till', V(D.serveX, F, reg.pos.z), -Math.PI / 2);
    anchor('register', reg.pos.clone(), -Math.PI / 2);
    anchor('piecase', pie.centre.clone(), Math.PI / 2);
    anchor('bell', bar.bell.pos.clone(), Math.PI / 2);
    anchor('restroom', extras.restRoom.pos, 0);
    anchor('phone', extras.phone.pos, 0);
    anchor('cigmachine', extras.machine.pos, Math.PI);
    for (const [k, z] of Object.entries(D.bays)) anchor('window.' + k, V(W - 0.02, 2.0, z), -Math.PI / 2);
    anchor('counter.player', V(C.frontX - 0.25, C.topY, z4), Math.PI / 2);
    anchor('counter.glass', V(C.frontX - 0.12, C.topY, z4 + 0.2), Math.PI / 2);

    // ---- what stands on the counter (and the back bar)
    const items = new Map();
    const place = (kind, at, { name = null, variant = null, yaw = 0 } = {}) => {
      const o = buildProp(kind, { variant });
      const p = typeof at === 'string' ? stage.anchor(at).pos : at;
      o.position.copy(p);
      o.rotation.y = yaw;
      g.add(o);
      if (stage.rays) o.traverse((m) => { if (m.isMesh && !m.userData.noRay) stage.addSolid(m); });
      o.userData.base = { p: o.position.clone(), r: o.rotation.clone() };
      const nm = name || kind;
      if (items.has(nm)) take(nm);
      items.set(nm, o);
      return o;
    };
    const take = (name) => {
      const o = items.get(name);
      if (!o) return null;
      items.delete(name);
      if (o.parent) o.parent.remove(o);
      if (stage.solids) o.traverse((m) => { if (m.isMesh) stage.removeSolid(m); });
      return o;
    };
    const fx = C.frontX;
    const DEFAULTS = [
      // the player's place, stool 4: an ashtray, the pack and the lighter by
      // his right hand, a napkin box, a sugar shaker
      ['ashtray', V(fx - 0.2, C.topY, z4 + 0.32), { yaw: 0.4 }],
      ['cigarettePack', V(fx - 0.15, C.topY, z4 - 0.16), { yaw: 0.35 }],
      ['lighter', V(fx - 0.11, C.topY, z4 - 0.29), { yaw: -0.25 }],
      ['napkinBox', V(fx - 0.5, C.topY, z4 + 0.5), { yaw: Math.PI / 2 }],
      ['sugar', V(fx - 0.5, C.topY, z4 + 0.68)],
      // the scotch on the back bar at serve 4 (the only amber in the room)
      ['bottle', stage.anchor('diner.bar.scotch').pos, { name: 'scotch', variant: 'scotch', yaw: -Math.PI / 2 }],
      // Mack's supper at stool 6, his beer
      ['plate', V(fx - 0.24, C.topY, stoolZ(D.brawlerStool)), { name: 'plate.mack' }],
      ['fork', V(fx - 0.2, C.topY + 0.016, stoolZ(D.brawlerStool) + 0.15), { name: 'fork.mack', yaw: 0.2 }],
      ['knife', V(fx - 0.12, C.topY, stoolZ(D.brawlerStool) - 0.16), { name: 'knife.mack', yaw: -0.1 }],
      ['bottle', V(fx - 0.14, C.topY, stoolZ(D.brawlerStool) - 0.32), { name: 'beer.mack', variant: 'beer' }],
      // the docker's mug at stool 1, the old man's cup at stool 9
      ['mug', V(fx - 0.2, C.topY, stoolZ(1)), { name: 'mug.docker', yaw: 2.4 }],
      ['saucer', V(fx - 0.2, C.topY, stoolZ(9)), { name: 'saucer.oldman' }],
      ['cup', V(fx - 0.2, C.topY + 0.006, stoolZ(9)), { name: 'cup.oldman', yaw: -0.8 }],
      // plates, cups and saucers along the rest of the counter
      ['plate', V(fx - 0.3, C.topY, stoolZ(2) + 0.05), { name: 'plate.2' }],
      ['cup', V(fx - 0.26, C.topY + 0.006, stoolZ(2) + 0.05), { name: 'cup.2', yaw: 1.2 }],
      ['saucer', V(fx - 0.42, C.topY, stoolZ(7) - 0.1), { name: 'saucer.7' }],
      ['cup', V(fx - 0.42, C.topY + 0.006, stoolZ(7) - 0.1), { name: 'cup.7', yaw: 2.6 }],
      ['plate', V(fx - 0.48, C.topY, stoolZ(3) - 0.3), { name: 'plate.stack' }],
      ['plate', V(fx - 0.48, C.topY + 0.012, stoolZ(3) - 0.3), { name: 'plate.stack2' }],
      ['menu', V(fx - 0.28, C.topY, stoolZ(5) + 0.1), { name: 'menu.5', yaw: -0.3 }],
      ['newspaper', V(fx - 0.25, C.topY, stoolZ(8) - 0.05), { name: 'paper.8', yaw: 0.25 }],
      // the coffee pot on the back bar by the urns
      ['coffeePot', V(B + 0.3, BAR.cabTop, 5.55), { name: 'coffeePot' }],
    ];
    const setTable = () => {
      for (const k of [...items.keys()]) take(k);
      for (const [k, at, o] of DEFAULTS) place(k, at, o || {});
    };
    setTable();

    // ---- the dry volume, the interior Look, the floor
    const room = new THREE.Box3(V(B, F - 0.2, D.zMin), V(W, D.ceilY, D.zMax));
    stage.dry.push(room);
    stage.addLook(room, { fogDensity: FOG.density * 0.35, rainOverlay: 0, haze: 0.6, reflect: 'floor', room: 'diner' });
    stage.addSurface((x, z) => (x < W + 0.01 && x > B && z > D.zMin && z < D.zMax ? F : undefined));
    // (the neon's sheen lies on the pavement under the sign only)
    if (stage.U && stage.U.uNeonZone) { const N = D.neonSheen; stage.U.uNeonZone.value.set(N.z0, N.z1, N.xFull, N.xGone); }

    // ---- the API
    const game = () => stage.game;
    const J8 = ['jukebox_a', 'jukebox_b', 'jukebox_c'];
    const jHandle = stage.breakables.add(jb.group, { kind: 'jukebox', hp: 3 });
    const pieHandle = stage.breakables.add(pie.group, { kind: 'pieCase', hp: 1 });
    const booth3stool = booths[2] && booths[2].stool;
    void booth3stool;
    const jukebox = {
      object: jb.group, handle: jHandle, slot: null, hits: 0, jb,
      play(slot) { jukebox.slot = slot; const G = game(); if (G) G.music.cue(slot, { diegetic: { pos: V(J.x, F + 1.0, D.zMin + 0.6), room: 'diner' } }); },
      // the arm lifts, the mechanism turns, a new record: 2 s of clunks
      next() {
        jb.change();
        const G = game(); if (G) G.sfx.play('jukebox_change', V(J.x, F + 1, D.zMin + 0.6));
        api.jukeNext = 1.6;
      },
      // the record skips; at the third hit it goes dark for a second and
      // starts another record
      hit(power = 1) {
        jukebox.hits++;
        const G = game(); if (G) G.sfx.play('jukebox_hit', V(J.x, F + 1, D.zMin + 0.6), { power });
        jb.skip();
        if (jukebox.hits % 3 === 0) { jb.darken(1.0); api.jukeRestart = 1.0; }
      },
    };
    const sound = (name, pos) => () => { const G = game(); if (G) G.sfx.play(name, pos); };
    const dips = [];
    const H0 = 23 * 3600 + 40 * 60;   // the clock: 11:40 when the story starts
    const api = {
      group: g, kit, anchors: new Map(), items, stools, booths, lamps: pendants, fans, near: null, stage, rng,
      shell, bar, windowLight, trainBars, blind, jb, lightRig,
      pieCase: { group: pie.group, pie: pie.pie, handle: pieHandle },
      stool: (i) => stools[i - 1],
      place, take,
      jukebox,
      bell: { mesh: bar.bell.mesh, ring() { api.bellT = 0.35; sound('bell', bar.bell.pos)(); } },
      doorBell: { ring: sound('doorbell', V(W - 0.2, 2.4, 0.6)) },
      register: {
        isOpen: false, k: 0, drawer: reg.drawer,
        open() { if (!this.isOpen) sound('register', reg.pos)(); this.isOpen = true; },
        close() { this.isOpen = false; },
      },
      clock: { time: '11:40', seconds: H0, hands: bar.clock },
      cupsRattle(strength = 1, seconds = 1) { api.rattle = { strength, left: seconds, dur: seconds }; },
      lampsDip(depth = 0.5, seconds = 0.6) { dips.push({ depth, t: 0, dur: seconds }); },
      // the el train outside: a light bar per carriage sweeps the room
      trainPass(seconds = 7, { at = 0 } = {}) {
        api.train = { t: at, dur: seconds };
        api.cupsRattle(0.6, Math.max(0.1, seconds - at));
      },
      reset() {
        // (fix round A10: whatever the last try broke stands again - lane 3's
        // breakables put back what they swapped for pieces, and the pieces
        // on the floor and the counter are swept up)
        const BR = stage.breakables;
        for (const h of [...stools.map((st) => st.handle), ...booths.map((b) => b.handle), pieHandle, jHandle]) {
          if (BR.restore) BR.restore(h);
          else if (h.broken) {
            h.broken = false; h.hp = h.hp0; h.object.visible = true;
            h.object.traverse((m) => { if (m.isMesh && !m.userData.noRay) stage.addSolid(m); });
          }
        }
        if (BR.clearPieces) BR.clearPieces(room);
        // the pie back on its stand in the case, the case's glass in its frame
        if (pie.pie.parent !== pie.group) pie.group.add(pie.pie);
        pie.pie.position.set(0, 0.137, 0.02); pie.pie.rotation.set(0, 2.2, 0); pie.pie.scale.setScalar(1); pie.pie.visible = true;
        pie.pie.traverse((m) => { m.visible = true; });
        pie.group.traverse((m) => { if (m.userData.glass) m.visible = true; });
        for (const st of stools) st.upright();
        setTable();
        dips.length = 0;
        api.rattle = null; api.train = null; trainBars.hide();
        api.register.isOpen = false; api.register.k = 0; reg.drawer.position.x = 0;
        for (const l of pendants) {
          l.sw.x = l.sw.z = l.sw.vx = l.sw.vz = 0; l._swung = true; swingStep(l, 0);
          // (a pendant shot out in the last try is lit again)
          if (l.dead) { l.dead = false; l.buzz = null; l.dieNow = false; l.deadK = 0; l.on = !!api.near; if (l.bulb) l.bulb.material = kit.M.bulb; }
        }
      },
      dips,
    };
    for (const [k, a] of stage.anchors) if (k.startsWith('diner.')) api.anchors.set(k.slice(6), a);
    // (the urns' steam and the coat's drips: where they come from)
    api.steamAt = bar.urns.map((u) => u.top);
    api.dripAt = shell.coat.drip;
    api.fly = bar.flyPaper;
    return api;
  },

  update(api, dt, t, camera) {
    const near = dinerInSight(camera.position);
    const L = api.lamps;
    const G = api.stage.game;
    if (near !== api.near) {
      api.near = near;
      // (fix round A9: the room is always drawn - from farther than the
      // front's 30 m its glass showed a bare void. Out of sight it only
      // saves its light: its pendants take no pooled light, and it casts no
      // shadow into a street lamp's map; nor is it a bullet's target)
      api.group.visible = true;
      api.group.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData._cast === undefined) o.userData._cast = o.castShadow;
        o.castShadow = near && o.userData._cast;
      });
      if (G && G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
      if (G) api.group.traverse((o) => { if (o.isMesh) G.rays.setEnabled(o, near); });
      for (const l of L) l.on = near && !l.dead;
    }
    if (!near) { if (api._rigNear !== false) { api._rigNear = false; api.lightRig.update(false, 1); } return; }
    api._rigNear = true;
    // a power dip: the pendants sag to `depth` and recover
    let f = 1;
    for (let i = api.dips.length - 1; i >= 0; i--) {
      const d = api.dips[i];
      d.t += dt;
      const u = d.t / d.dur;
      if (u >= 1) { api.dips.splice(i, 1); continue; }
      f = Math.min(f, 1 - d.depth * Math.sin(Math.PI * u));
    }
    // (round 2: the shafts are long and full seen in the room's smoke; from
    // the street, through the glass, they keep the short soft glow the
    // front was accepted with - never bells in the windows)
    const inside = camera.position.x < D.innerX + 0.05;
    for (const l of L) {
      // (the counter's lamps lean toward the street: from out there the eye
      // looks up their shafts, so they are held lower still)
      l.coneBase = l.dipBase.cone * f * (inside ? 1 : 0.36);
      const cu = l.cone && l.cone.material && l.cone.material.uniforms;
      if (cu && cu.uFadeEnd) cu.uFadeEnd.value = inside ? 0.92 : 0.6;
      if (cu && cu.uEdgeSoft) cu.uEdgeSoft.value = inside ? 0.7 : 0.62;
      if (l.light) l.light.intensity = l.dipBase.light * f;
      swingStep(l, dt);
    }
    api.lightRig.update(true, f);
    // the stools swivel and slow
    for (const st of api.stools) {
      if (Math.abs(st.spinV) < 1e-3) continue;
      st.seat.rotation.y += st.spinV * dt;
      st.spinV *= Math.exp(-1.5 * dt);
    }
    // the fans at 40 rpm
    for (const fan of api.fans) fan.rotor.rotation.y -= (fan.rpm / 60) * Math.PI * 2 * fan.speed * dt;
    // the clock (11:40 at the start of the story, running with the step)
    const c = api.clock;
    c.seconds += dt;
    const s = c.seconds;
    const hh = Math.floor(s / 3600) % 12 || 12, mm = Math.floor(s / 60) % 60;
    c.time = `${hh}:${String(mm).padStart(2, '0')}`;
    c.hands.second.rotation.x = -(Math.floor(s % 60) + Math.min(1, (s % 1) * 6)) / 60 * Math.PI * 2;
    c.hands.minute.rotation.x = -((s / 60) % 60) / 60 * Math.PI * 2;
    c.hands.hour.rotation.x = -((s / 3600) % 12) / 12 * Math.PI * 2;
    // the jukebox: the record turns, a change runs, a dark second restarts it
    api.jb.tick(dt);
    if (api.jukeRestart != null && (api.jukeRestart -= dt) <= 0) { api.jukeRestart = null; api.jukebox.next(); }
    if (api.jukeNext != null && (api.jukeNext -= dt) <= 0) {
      api.jukeNext = null;
      const J8 = ['jukebox_a', 'jukebox_b', 'jukebox_c'];
      const J = api.jukebox;
      if (J.slot) J.play(J8[(J8.indexOf(J.slot) + 1) % J8.length]); else J.slot = J8[0];
    }
    // the register's drawer slides out toward the staff side
    const R = api.register;
    R.k += Math.sign((R.isOpen ? 1 : 0) - R.k) * Math.min(Math.abs((R.isOpen ? 1 : 0) - R.k), dt * 5);
    R.drawer.position.x = -0.26 * R.k * (2 - R.k);
    // the bell's plunger bounce
    if (api.bellT > 0) { api.bellT = Math.max(0, api.bellT - dt); api.bell.mesh.position.y = -0.004 * Math.sin((api.bellT / 0.35) * Math.PI); }
    // the fly-paper ribbon turns slowly in the room's air
    api.fly.rotation.y = 0.6 * Math.sin(t * 0.23) + 0.25 * Math.sin(t * 0.61 + 1.2);
    // the urns breathe a little steam; the coat drips
    const fx = G && G.fx;
    if (fx) {
      api.steamT = (api.steamT || 0) - dt;
      if (api.steamT <= 0) {
        const r = api.rng;
        api.steamT = r.range(0.25, 0.6);
        const at = api.steamAt[r.int(0, api.steamAt.length - 1)];
        fx.puff.spawn({
          pos: at.clone().add(V(r.gauss() * 0.02, 0.01, r.gauss() * 0.02)), vel: V(r.gauss() * 0.02, r.range(0.12, 0.2), r.gauss() * 0.02),
          life: r.range(1.8, 2.6), size: [0.07, 0.07], grow: 0.1, rot: r.next() * 6.28, spin: r.gauss() * 0.2,
          col: [0.5, 0.5, 0.5], alpha: 0.22, drag: 0.5, fadeIn: 0.25, fadeOut: 0.6, cell: FIRE.SMOKE[r.int(0, FIRE.SMOKE.length - 1)],
        });
      }
      api.dripT = (api.dripT || 0) - dt;
      if (api.dripT <= 0) {
        const r = api.rng;
        api.dripT = r.range(0.7, 1.6);
        fx.debris.spawn({
          pos: api.dripAt.clone().add(V(r.gauss() * 0.06, 0, r.gauss() * 0.02)), vel: V(0, -0.2, 0),
          life: 1.2, size: [0.006, 0.012], rot: 0, spin: 0, col: [0.55, 0.55, 0.55], cell: 12, gravity: 9.8, ground: D.floorY + 0.004, fadeOut: 0.1,
        });
      }
    }
    // the train outside: its window lights sweep through the room
    if (api.train) {
      const T = api.train;
      T.t += dt;
      const u = T.t / T.dur;
      if (u >= 1) { api.train = null; api.trainBars.hide(); }
      else {
        // four carriages of 9 m with 2.5 m gaps, running down the avenue
        // (-z); the whole train crosses the room in the pass's time
        const len = 4 * 11.5, span = D.zMax - D.zMin + len;
        const head = D.zMax + 2 - u * (span + 4);
        const bars = [];
        const k = 0.9 * Math.min(1, T.t / 0.8, (T.dur - T.t) / 0.8);
        for (let i = 0; i < 4; i++) {
          const z1 = head + i * 11.5, z0 = z1 + 9;
          // (the lit windows flicker a little as the carriage rocks)
          bars.push({ z0: Math.min(z0, z1), z1: Math.max(z0, z1), k: k * (0.85 + 0.15 * Math.sin(t * 17 + i * 2.1)) });
        }
        api.trainBars.set(bars);
        // the pendants tremble on their cords
        if (!api.trainTremble || (api.trainTremble -= dt) <= 0) {
          api.trainTremble = 0.3;
          for (const l of L) l.swing(V(api.rng.gauss() * 0.02, 0, api.rng.gauss() * 0.02));
        }
      }
    }
    // cups, saucers and glasses tremble; rings spread in the liquids
    const rt = api.rattle;
    if (rt) {
      rt.left -= dt;
      const env = rt.left <= 0 ? 0 : Math.min(1, rt.left / 0.6, (rt.dur - rt.left) / 0.4 + 0.2);
      for (const o of api.items.values()) {
        const b = o.userData.base;
        if (!b) continue;
        const k = rt.strength * env * (o.userData.kind === 'bottle' ? 0.5 : 1);
        const ph = o.id * 1.7;
        o.position.y = b.p.y + Math.max(0, Math.sin(t * 61 + ph)) * 0.0012 * k;
        o.rotation.y = b.r.y + Math.sin(t * 23 + ph) * 0.004 * k;
        if (o.userData.ripple) o.userData.ripple(k, dt);
      }
      if (rt.left <= 0) {
        api.rattle = null;
        for (const o of api.items.values()) { const b = o.userData.base; if (b) { o.position.y = b.p.y; o.rotation.y = b.r.y; } if (o.userData.ripple) o.userData.ripple(0, dt); }
      }
    }
  },
};
