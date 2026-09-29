import * as THREE from 'three';
import { DINER, stoolZ, dinerInSight } from '../site.js';
import { allocInkId } from '../../../render/layers.js';
import { FOG } from '../../../render/fog.js';
import { lathe } from '../../../world/geom.js';
import { buildProp } from '../../../props/index.js';

// The diner (docs/story/CONTRACTS.md §15; lane 5's brief): the room on the
// ground floor of the near building, behind its street front
// (parts/dinerFront.js). Everything here is at x < -10.45.
// API (stage.part('diner'), lane 5's brief P0.2):
//   d.anchors            every anchor of the site plan, also stage.anchor('diner.*'):
//                        stool.1..9, stool.player (= stool.4), serve.1..9 (also
//                        counter.serve.1..9), booth.1..4.a / .b (seats), hatch,
//                        jukebox.front, door.in, door.out, ring.centre, urns,
//                        bar.scotch, till, window.B1..B4 (inside face centres),
//                        counter.player (the counter top before stool 4: the
//                        puzzle table), counter.glass (where the scotch is set),
//                        pavement.ko (where the brawler lands outside)
//                        Seats: pos is the seat's top; eyeY the seated eye.
//                        yaw: a viewer's (the controller's) facing there.
//   d.stool(i)           { object, spin(impulse), topple(dir), upright() }
//   d.items              Map name -> Object3D on the counter
//   d.place(kind, anchor | Vector3, { name, variant }) -> Object3D    d.take(name)
//   d.jukebox { object, slot, play(slot), next(), hit(power) }   d.bell { ring() }
//   d.doorBell { ring() }   d.register { open(), close(), isOpen }   d.clock { time }
//   d.fans []   d.lamps [] (the pendants: stage.lamps.addCustom lamps)
//   d.cupsRattle(strength, seconds)   d.lampsDip(depth, seconds)
//   d.trainPass(seconds)              d.reset()
// The room has no light of its own: its eight pendants are lamps of the
// block's lamp pool (they take its pooled spot lights while the eye is in
// here: nearest lamps win). Its dry volume keeps the rain out; its Look is
// an interior one (no screen rain, low fog, haze, the room's sound).
// Drawn only while the diner is in sight (site.js dinerInSight), like the
// front; out of sight its pendants are off (no light, cone or pool share).
//
// FOUNDATION STUB (lane 5 owns parts/diner*.js): plain boxes and the prop
// library's stand-ins; the API's calls are working no-ops where the brief's
// effect is lane 5's (the rattle, the train's light bars, the fans).
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  name: 'diner', order: 140, tick: 140,
  build(stage) {
    const { colliders, lamps } = stage;
    const D = DINER, C = D.counter, F = D.floorY;
    const W = D.innerX, B = D.backX;
    const g = new THREE.Group();
    g.name = 'diner';
    g.visible = false;
    stage.scene.add(g);
    const std = (color, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    const M = {
      floor: std(0x1c1c1c, 0.45), wall: std(0x4a4a4a, 0.9), dado: std(0x161616, 0.8), ceil: std(0x121212, 1),
      counter: std(0x202020, 0.6), top: std(0x9a9a9a, 0.35), bar: std(0x141414, 0.8), booth: std(0x101010, 0.75),
      table: std(0x3a3a3a, 0.5), juke: std(0x2a2a2a, 0.6),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.9) }),
    };
    // (each thing of the room has an ink id of its own, so the contours
    // separate the counter from the floor, a booth from the wall)
    let inkId = 0;
    const newId = () => { inkId = allocInkId(); };
    const add = (geo, mat, { cast = true, parent = g } = {}) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast; m.receiveShadow = true;
      m.userData.inkId = inkId;
      parent.add(m);
      return m;
    };
    const box = (x0, x1, y0, y1, z0, z1, mat, opts) => add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat, opts);
    const e = 0.004;

    // ---- the shell: floor, ceiling, walls (a dado of dark panelling), 4 mm
    // inside the building's own stone
    newId();
    const lx = W - B, lz = D.zMax - D.zMin, cx = (W + B) / 2, cz = (D.zMin + D.zMax) / 2;
    add(new THREE.PlaneGeometry(lx, lz).rotateX(-Math.PI / 2).translate(cx, F + e, cz), M.floor, { cast: false });
    add(new THREE.PlaneGeometry(lx, lz).rotateX(Math.PI / 2).translate(cx, D.ceilY - e, cz), M.ceil, { cast: false });
    add(new THREE.PlaneGeometry(lz, D.ceilY - F).rotateY(Math.PI / 2).translate(B + e, (F + D.ceilY) / 2, cz), M.wall, { cast: false });
    add(new THREE.PlaneGeometry(lx, D.ceilY - F).translate(cx, (F + D.ceilY) / 2, D.zMin + e), M.wall, { cast: false });
    add(new THREE.PlaneGeometry(lx, D.ceilY - F).rotateY(Math.PI).translate(cx, (F + D.ceilY) / 2, D.zMax - e), M.wall, { cast: false });
    newId();
    box(B + e, B + 0.03, F, F + 1.1, D.zMin, D.zMax, M.dado, { cast: false });
    // the kitchen hatch: a lit opening in the back wall (the kitchen beyond
    // is lane 5's)
    const H = D.hatch;
    add(new THREE.PlaneGeometry(H.z1 - H.z0, H.y1 - H.y0).rotateY(Math.PI / 2).translate(B + 0.035, (H.y0 + H.y1) / 2, (H.z0 + H.z1) / 2), M.glow, { cast: false });

    // ---- the counter, its top, the back bar
    const cx0 = C.frontX - C.depth;
    newId();
    box(cx0 + 0.04, C.frontX - 0.04, F, C.topY - 0.05, C.z0, C.z1, M.counter);
    box(cx0, C.frontX + 0.03, C.topY - 0.05, C.topY, C.z0 - 0.03, C.z1 + 0.03, M.top);
    newId();
    box(B + 0.03, B + 0.55, F, F + 0.95, C.z0, C.z1, M.bar);
    box(B + 0.03, B + 0.3, F + 1.45, F + 1.49, C.z0, C.z1, M.bar);
    colliders.addBox((cx0 + C.frontX) / 2, (C.z0 + C.z1) / 2, C.depth / 2 + 0.02, (C.z1 - C.z0) / 2, 0, 'counter');
    colliders.addBox(B + 0.29, (C.z0 + C.z1) / 2, 0.27, (C.z1 - C.z0) / 2, 0, 'counter');

    // ---- the booths along the window wall: a table between two high
    // benches (booth 3 is a short one by the door's side light)
    const BT = D.booths, bx = (BT.x0 + BT.x1) / 2;
    const booths = [];
    BT.z.forEach((z, i) => {
      newId();
      const half = i === 2 ? 0.55 : 1.0;
      const tbl = box(BT.x0 + 0.15, BT.x1 - 0.05, BT.tableY - 0.04, BT.tableY, z - 0.32, z + 0.32, M.table);
      box(bx - 0.05, bx + 0.05, F, BT.tableY - 0.04, z - 0.05, z + 0.05, M.table, { parent: tbl });
      for (const s of [-1, 1]) {
        const zb = z + s * half;
        box(BT.x0, BT.x1, F, F + 0.45, zb - s * 0.45, zb, M.booth);
        box(BT.x0, BT.x1, F, F + 1.2, zb - 0.06 * s, zb + 0.06 * s, M.booth);
      }
      colliders.addBox(bx, z, (BT.x1 - BT.x0) / 2, half + 0.06, 0, 'booth');
      stage.breakables.add(tbl, { kind: 'table', hp: 3 });
      booths.push({ z, half, table: tbl });
    });

    // ---- the jukebox against the end wall
    const J = D.jukebox;
    const juke = new THREE.Group();
    newId();
    box(J.x - 0.45, J.x + 0.45, F, F + 1.3, D.zMin + 0.02, D.zMin + 0.62, M.juke, { parent: juke });
    add(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 32, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(J.x, F + 1.3, D.zMin + 0.32), M.juke, { parent: juke });
    add(new THREE.PlaneGeometry(0.6, 0.35).translate(J.x, F + 1.0, D.zMin + 0.625), M.glow, { parent: juke, cast: false });
    g.add(juke);
    colliders.addBox(J.x, D.zMin + 0.32, 0.47, 0.32, 0, 'jukebox');

    // ---- the stools: nine chrome pedestals, each a breakable that swivels
    const stools = [];
    for (let i = 1; i <= D.stools.n; i++) {
      const s = buildProp('stool');
      s.position.set(D.stools.x, F, stoolZ(i));
      g.add(s);
      const col = colliders.addCircle(D.stools.x, stoolZ(i), 0.2, 'stool');
      const h = stage.breakables.add(s, { kind: 'stool', hp: 3, collider: col });
      const st = {
        object: s, handle: h, spinV: 0,
        spin(impulse = 1) { st.spinV += impulse * 4; },
        topple(dir = V(1, 0, 0)) { stage.breakables.topple(h, dir); },
        upright() { stage.breakables.upright(h); s.rotation.set(0, 0, 0); s.position.set(D.stools.x, F, stoolZ(i)); },
      };
      stools.push(st);
    }

    // ---- the pendant lamps: enamel shades on cords, each a lamp of the pool
    const P = D.pendants;
    const shadeGeo = lathe([[0.012, 0.0], [0.03, -0.02], [0.08, -0.08], [0.15, -0.16], [0.17, -0.19], [0.165, -0.19]], 32);
    const discGeo = new THREE.CircleGeometry(0.14, 32).rotateX(Math.PI / 2);
    const cordGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 6);
    const pendants = [];
    const heads = [...P.z.map((z) => [P.x, z, P.half]), ...P.booth.map(([x, z]) => [x, z, P.half * 0.9])];
    newId();
    for (const [x, z, half] of heads) {
      const top = P.headY + 0.19;
      const lg = new THREE.Group();
      g.add(lg);
      add(shadeGeo, stage.M.lampShade, { parent: lg }).position.set(x, top, z);
      const cord = add(cordGeo, stage.M.lampIron, { parent: lg, cast: false });
      cord.scale.y = D.ceilY - top; cord.position.set(x, (D.ceilY + top) / 2, z);
      const bulb = add(discGeo, stage.M.bulb, { parent: lg, cast: false });
      bulb.position.set(x, P.headY + 0.005, z);
      const lamp = lamps.addCustom({ head: V(x, P.headY, z), axis: V(0, -1, 0), height: P.headY - F, half, real: true, bulb, fadeEnd: 0.9, edgeSoft: 0.35, strength: 0.75, tag: 'pendant' });
      // (out of sight it is off: no pool share, no cone, no rain light)
      lamp.on = false;
      lamp.dipBase = { cone: lamp.coneBase, light: lamp.light.intensity };
      pendants.push(lamp);
    }

    const items = new Map();
    const anchor = (name, pos, yaw, extra = {}) => stage.addAnchor('diner.' + name, { pos, yaw, ...extra });

    // ---- the anchors of the site plan
    for (let i = 1; i <= D.stools.n; i++) {
      const z = stoolZ(i);
      anchor('stool.' + i, V(D.stools.x, D.stools.seatY, z), Math.PI / 2, { eyeY: D.seatedEyeY, seat: true });
      anchor('serve.' + i, V(D.serveX, F, z), -Math.PI / 2);
      stage.addAnchor('counter.serve.' + i, { pos: V(D.serveX, F, z), yaw: -Math.PI / 2 });
    }
    stage.addAnchor('diner.stool.player', { ...stage.anchor('diner.stool.' + D.playerStool), name: 'diner.stool.player' });
    booths.forEach((b, i) => {
      anchor(`booth.${i + 1}.a`, V(bx, F + 0.45, b.z - b.half + 0.3), Math.PI, { seat: true, eyeY: F + 1.3 });
      anchor(`booth.${i + 1}.b`, V(bx, F + 0.45, b.z + b.half - 0.3), 0, { seat: true, eyeY: F + 1.3 });
    });
    const z4 = stoolZ(D.playerStool);
    anchor('hatch', V(B + 0.3, F, (H.z0 + H.z1) / 2), -Math.PI / 2);
    anchor('jukebox.front', V(J.x, F, D.zMin + 1.1), 0);
    anchor('ring.centre', V(D.ring.x, F, D.ring.z), Math.PI, { r: D.ring.r });
    anchor('urns', V(B + 0.75, F, 6.9), -Math.PI / 2);
    anchor('bar.scotch', V(B + 0.25, F + 0.95, z4), -Math.PI / 2);
    anchor('till', V(B + 0.75, F, C.z0 + 0.5), -Math.PI / 2);
    for (const [k, z] of Object.entries(D.bays)) anchor('window.' + k, V(W - 0.02, 2.0, z), -Math.PI / 2);
    anchor('counter.player', V(C.frontX - 0.25, C.topY, z4), Math.PI / 2);
    anchor('counter.glass', V(C.frontX - 0.12, C.topY, z4 + 0.2), Math.PI / 2);

    // ---- what stands on the counter (and the back bar)
    const place = (kind, at, { name = null, variant = null, yaw = 0 } = {}) => {
      const o = buildProp(kind, { variant });
      const p = typeof at === 'string' ? stage.anchor(at).pos : at;
      o.position.copy(p);
      o.rotation.y = yaw;
      g.add(o);
      const nm = name || kind;
      items.set(nm, o);
      return o;
    };
    const DEFAULTS = [
      ['ashtray', V(C.frontX - 0.2, C.topY, z4 + 0.3)],
      ['cigarettePack', V(C.frontX - 0.14, C.topY, z4 - 0.14), { yaw: 0.3 }],
      ['lighter', V(C.frontX - 0.12, C.topY, z4 - 0.26), { yaw: -0.2 }],
      ['napkinBox', V(C.frontX - 0.45, C.topY, z4 + 0.45)],
      ['sugar', V(C.frontX - 0.45, C.topY, z4 + 0.62)],
      ['bottle', stage.anchor('diner.bar.scotch').pos, { name: 'scotch', variant: 'scotch' }],
      ['plate', V(C.frontX - 0.25, C.topY, stoolZ(D.brawlerStool)), { name: 'plate.mack' }],
      ['bottle', V(C.frontX - 0.12, C.topY, stoolZ(D.brawlerStool) - 0.3), { name: 'beer.mack', variant: 'beer' }],
      ['mug', V(C.frontX - 0.2, C.topY, stoolZ(1)), { name: 'mug.docker' }],
      ['saucer', V(C.frontX - 0.2, C.topY, stoolZ(9)), { name: 'saucer.oldman' }],
      ['cup', V(C.frontX - 0.2, C.topY + 0.012, stoolZ(9)), { name: 'cup.oldman' }],
      ['coffeePot', V(B + 0.25, F + 0.95, 6.9), { name: 'coffeePot' }],
    ];
    const setTable = () => {
      for (const o of items.values()) g.remove(o);
      items.clear();
      for (const [k, at, o] of DEFAULTS) place(k, at, o || {});
    };
    setTable();

    // ---- the dry volume, the interior Look, the floor
    const room = new THREE.Box3(V(B, F - 0.2, D.zMin), V(W, D.ceilY, D.zMax));
    stage.dry.push(room);
    stage.addLook(room, { fogDensity: FOG.density * 0.35, rainOverlay: 0, haze: 0.6, reflect: 'floor', room: 'diner' });
    stage.addSurface((x, z) => (x < W + 0.01 && x > B && z > D.zMin && z < D.zMax ? F : undefined));

    // ---- the API
    const game = () => stage.game;
    const J8 = ['jukebox_a', 'jukebox_b', 'jukebox_c'];
    const jHandle = stage.breakables.add(juke, { kind: 'jukebox', hp: 3 });
    const jukebox = {
      object: juke, handle: jHandle, slot: null, hits: 0,
      play(slot) { jukebox.slot = slot; const G = game(); if (G) G.music.cue(slot, { diegetic: { pos: V(J.x, F + 1.0, D.zMin + 0.6), room: 'diner' } }); },
      next() { jukebox.play(J8[(J8.indexOf(jukebox.slot) + 1) % J8.length]); },
      hit(power = 1) { jukebox.hits++; const G = game(); if (G) G.sfx.play('jukebox_hit', V(J.x, F + 1, D.zMin + 0.6), { power }); if (jukebox.hits % 3 === 0) jukebox.next(); },
    };
    const sound = (name, pos) => () => { const G = game(); if (G) G.sfx.play(name, pos); };
    const dips = [];
    const api = {
      group: g, anchors: new Map(), items, stools, booths, lamps: pendants, fans: [], near: null, stage,
      stool: (i) => stools[i - 1],
      place, take(name) { const o = items.get(name); if (!o) return null; items.delete(name); if (o.parent) o.parent.remove(o); return o; },
      jukebox,
      bell: { ring: sound('bell', V(B + 0.2, 1.8, 2.2)) },
      doorBell: { ring: sound('doorbell', V(W - 0.2, 2.4, 0.6)) },
      register: { isOpen: false, open() { this.isOpen = true; }, close() { this.isOpen = false; } },
      clock: { time: '11:40' },
      cupsRattle(strength = 1, seconds = 1) { api.rattle = { strength, left: seconds }; },
      lampsDip(depth = 0.5, seconds = 0.6) { dips.push({ depth, t: 0, dur: seconds }); },
      trainPass(seconds = 7) { api.cupsRattle(0.5, seconds); },
      reset() {
        for (const st of stools) st.upright();
        setTable();
        dips.length = 0;
      },
      dips,
    };
    for (const [k, a] of stage.anchors) if (k.startsWith('diner.')) api.anchors.set(k.slice(6), a);
    return api;
  },

  update(api, dt, t, camera) {
    const near = dinerInSight(camera.position);
    const L = api.lamps;
    if (near !== api.near) {
      api.near = near;
      api.group.visible = near;
      // (out of sight nothing of it is a bullet's target either)
      const G = api.stage.game;
      if (G) api.group.traverse((o) => { if (o.isMesh) G.rays.setEnabled(o, near); });
      for (const l of L) l.on = near && !l.dead;
    }
    // a power dip: the pendants sag to `depth` and recover
    let f = 1;
    for (let i = api.dips.length - 1; i >= 0; i--) {
      const d = api.dips[i];
      d.t += dt;
      const u = d.t / d.dur;
      if (u >= 1) { api.dips.splice(i, 1); continue; }
      f = Math.min(f, 1 - d.depth * Math.sin(Math.PI * u));
    }
    for (const l of L) { l.coneBase = l.dipBase.cone * f; if (l.light) l.light.intensity = l.dipBase.light * f; }
    // the stools swivel and slow
    for (const st of api.stools) {
      if (Math.abs(st.spinV) < 1e-3) continue;
      st.object.rotation.y += st.spinV * dt;
      st.spinV *= Math.exp(-1.5 * dt);
    }
    if (api.rattle && (api.rattle.left -= dt) <= 0) api.rattle = null;
  },
};
