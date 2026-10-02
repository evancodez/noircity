import * as THREE from 'three';
import { FOG } from '../../../render/fog.js';
import { LAYER } from '../../../render/layers.js';
import { makeKit } from '../../../props/diner/kit.js';
import { mergeGeos, slab, lathe } from '../../../props/lib.js';
import { buildProp } from '../../../props/index.js';
import { officeMats } from '../../office/build/mats.js';
import { wallGeos, wallColliders, casing, strip } from '../../office/build/walls.js';
import { makeFrosted } from '../../office/build/frosted.js';
import { hoodJoints } from '../../office/build/frosted.js';
import { makeDoor } from '../door.js';
import {
  FLOOR, CEIL, T, HOUSE, CORR, ROOM_A, ROOM_B, LOBBY, DOORS, DOOR_H, PARTITION, WINDOWS, WIN_Y,
  DESK, CABINETS, CABINET, CRATES_A, COUNTER, BACKBAR, CRATES_B, BARRELS_B, TABLES_B, RECEPTION, BENCH, STREET_CRATES,
  CAB_E, CHAIR_A, CORNERS,
} from '../plan.js';

// The killhouse's house (lane C2): the shell, the doors, the furniture (every
// piece of it cover of a kind, marked for the gun kit: userData.cover =
// { kind: 'wood' | 'thin' | 'steel' | 'stone', hp }; a wood piece in
// sections, each its own mesh with its own hp, so a spent section breaks
// away and leaves a gap), the lamps' pools, the Looks, the anchors.
//   house.doors[name]     (door.js)          house.desk { tip(dir), tipped, reset() }
//   house.reset()         every break mended, every door shut, the desk up
//   house.bottles         the back bar's bottles (the teach's targets)
//   house.frosted         the partition's and the glazed doors' panes (the men show on them)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  name: 'house', order: 130, tick: 130,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'killhouse';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const mats = officeMats();
    const C = stage.colliders;
    const M = (l) => mergeGeos(l);
    const api = { group: g, kit, mats, doors: {}, frosted: [], covers: [], bottles: [], sections: [] };
    // a cover piece: its own mesh (its own ink id), marked for the kit
    const piece = (geo, mat, cover, opts = {}) => {
      kit.piece();
      const m = kit.add(geo, mat, opts);
      if (cover) { m.userData.cover = { ...cover }; api.sections.push(m); }
      return m;
    };

    // ---- floors and ceiling --------------------------------------------------------------
    kit.piece();
    const floors = [];
    for (const R of [ROOM_A, ROOM_B]) floors.push(kit.box(R.x0, R.x1, FLOOR - 0.08, FLOOR, R.z0, R.z1));
    kit.add(M(floors), mats.boards, { name: 'kh_boards' });
    {
      const seams = [];
      for (const R of [ROOM_A, ROOM_B]) for (let x = R.x0 + 0.12; x < R.x1 - 0.05; x += 0.12) seams.push(new THREE.BoxGeometry(0.006, 0.004, R.z1 - R.z0).translate(x, FLOOR + 0.0005, (R.z0 + R.z1) / 2));
      kit.add(M(seams), mats.trim, { cast: false, noRay: true });
    }
    kit.piece();
    kit.add(M([kit.box(CORR.x0, CORR.x1, FLOOR - 0.08, FLOOR, CORR.z0, CORR.z1), kit.box(LOBBY.x0, LOBBY.x1, FLOOR - 0.08, FLOOR, LOBBY.z0, LOBBY.z1)]), mats.lino, { name: 'kh_lino' });
    {
      const L = [];
      for (let z = LOBBY.z0 + 0.46; z < LOBBY.z1; z += 0.46) L.push(new THREE.BoxGeometry(LOBBY.x1 - LOBBY.x0, 0.002, 0.008).translate(0, FLOOR + 0.0006, z));
      for (let x = LOBBY.x0 + 0.46; x < LOBBY.x1; x += 0.46) L.push(new THREE.BoxGeometry(0.008, 0.002, LOBBY.z1 - LOBBY.z0).translate(x, FLOOR + 0.0006, (LOBBY.z0 + LOBBY.z1) / 2));
      kit.add(M(L), mats.trim, { cast: false, noRay: true });
    }
    kit.piece();
    kit.add(kit.box(HOUSE.x0 - T, HOUSE.x1 + T, CEIL, CEIL + 0.12, HOUSE.z0 - T, HOUSE.z1 + T), mats.ceil, { name: 'kh_ceiling' });

    // ---- walls ------------------------------------------------------------------------------
    const D = DOORS, top = FLOOR + DOOR_H;
    const dh = (d) => (d.axis === 'z' ? [d.z0, d.z1, FLOOR, top, 'open'] : [d.x0, d.x1, FLOOR, top, 'open']);
    const Y = [FLOOR, CEIL];
    const walls = {
      front: { axis: 'x', a: [HOUSE.z1, HOUSE.z1 + T], s: [HOUSE.x0 - T, HOUSE.x1 + T], y: Y, holes: [dh(D.SD), ...WINDOWS.map(([a, b]) => [a, b, WIN_Y[0], WIN_Y[1]])] },
      back: { axis: 'x', a: [HOUSE.z0 - T, HOUSE.z0], s: [HOUSE.x0 - T, HOUSE.x1 + T], y: Y, holes: [dh(D.BD)] },
      west: { axis: 'z', a: [HOUSE.x0 - T, HOUSE.x0], s: [HOUSE.z0, HOUSE.z1], y: Y, holes: [] },
      east: { axis: 'z', a: [HOUSE.x1, HOUSE.x1 + T], s: [HOUSE.z0, HOUSE.z1], y: Y, holes: [] },
      aCorr: { axis: 'z', a: [CORR.x0 - T, CORR.x0], s: [HOUSE.z0, ROOM_A.z1 + T], y: Y, holes: [dh(D.A1)] },
      corrB: { axis: 'z', a: [CORR.x1, CORR.x1 + T], s: [HOUSE.z0, ROOM_B.z1], y: Y, holes: [dh(D.B1)] },
      aLobby: { axis: 'x', a: [ROOM_A.z1, ROOM_A.z1 + T], s: [HOUSE.x0, CORR.x0 - T], y: Y, holes: [dh(D.A2)] },
    };
    kit.piece();
    kit.add(M([...wallGeos(walls.front), ...wallGeos(walls.back), ...wallGeos(walls.west), ...wallGeos(walls.east)]), mats.plaster, { name: 'kh_outerWalls' });
    kit.piece();
    kit.add(M([...wallGeos(walls.aCorr), ...wallGeos(walls.corrB), ...wallGeos(walls.aLobby)]), mats.plaster, { name: 'kh_innerWalls' });
    // the corridor's mouth into the lobby: a header over it
    kit.add(kit.box(CORR.x0 - T, CORR.x1 + T, FLOOR + 2.45, CEIL, ROOM_A.z1, ROOM_A.z1 + T), mats.plaster);
    for (const w of Object.values(walls)) wallColliders(C, w, 'wall');
    // (the walls are stone to a round: they stop it)
    g.traverse((o) => { if (o.isMesh && /Walls|ceiling/.test(o.name)) o.userData.cover = { kind: 'stone' }; });

    // ---- the frosted partition between the bar and the lobby -----------------------------------
    {
      const P = PARTITION, a = [P.z, P.z + T];
      const doorHole = [D.B2.x0, D.B2.x1, FLOOR, top, 'open'];
      // the dado (thin wood: a round goes through it) and the band over the glass
      const dado = piece(M(wallGeos({ axis: 'x', a, s: [P.x0, P.x1], y: [FLOOR, P.dado], holes: [doorHole] })), mats.wainscot, { kind: 'thin' }, { name: 'kh_dado' });
      void dado;
      kit.piece();
      kit.add(M(wallGeos({ axis: 'x', a, s: [P.x0, P.x1], y: [P.top, CEIL], holes: [] })), mats.plaster, { name: 'kh_partitionHead' });
      // the door's head (the panel over B2 up to the glass line)
      kit.add(kit.box(D.B2.x0, D.B2.x1, top, P.top, P.z + 0.02, P.z + T - 0.02), mats.wainscot);
      // the mullions between the panes
      kit.piece();
      const mul = [];
      const edges = [P.x0, ...P.panes.flat(), D.B2.x0, D.B2.x1, P.x1].sort((p, q) => p - q);
      for (let i = 0; i < P.panes.length; i++) {
        const [x0, x1] = P.panes[i];
        mul.push(kit.box(x0 - 0.06, x0, P.dado, P.top, P.z, P.z + T), kit.box(x1, x1 + 0.06, P.dado, P.top, P.z, P.z + T));
        mul.push(kit.box(x0, x1, P.dado, P.dado + 0.05, P.z - 0.02, P.z + T + 0.02));
      }
      void edges;
      // (between the panes and the door's jambs: plain wood to the glass line)
      mul.push(kit.box(P.x0, P.panes[0][0] - 0.06, P.dado, P.top, P.z, P.z + T));
      mul.push(kit.box(P.panes[1][1] + 0.06, D.B2.x0, P.dado, P.top, P.z, P.z + T));
      mul.push(kit.box(D.B2.x1, P.panes[2][0] - 0.06, P.dado, P.top, P.z, P.z + T));
      mul.push(kit.box(P.panes[3][1] + 0.06, P.x1, P.dado, P.top, P.z, P.z + T));
      const mm = kit.add(M(mul), mats.trim, { name: 'kh_mullions' });
      mm.userData.cover = { kind: 'thin' };
      // the panes: frosted glass (a round goes through it and it breaks; a
      // man behind it shows on it)
      P.panes.forEach(([x0, x1], i) => {
        kit.piece();
        const w = x1 - x0, h = P.top - P.dado - 0.05;
        const frost = makeFrosted({ w, h, text: i === 1 ? ['THE BLUE BELL', 'PRIVATE'] : null, seed: 40 + i });
        frost.userData.glow(0.16, 0.95);
        // (the lettering reads the right way round from the lobby: the pane faces the bar)
        const pane = stage.glass.addPane({ centre: V((x0 + x1) / 2, P.dado + 0.05 + h / 2, P.z + T / 2), normal: V(0, 0, -1), w, h, material: frost, tag: 'partition' + i, thick: 0.005 });
        pane.mesh.layers.set(LAYER.WORLD);
        pane.mesh.userData.noRay = true;
        pane.mesh.userData.inkId = kit.id;
        pane.mesh.userData.inkSurface = 'lit';
        api.frosted.push({ pane, frost, mesh: pane.mesh });
      });
      // the partition's collider (the door's gap open)
      wallColliders(C, { axis: 'x', a, s: [P.x0, P.x1], holes: [doorHole] }, 'wall');
    }

    // ---- the doors ----------------------------------------------------------------------------
    for (const [name, spec] of Object.entries(DOORS)) {
      const d = makeDoor(stage, kit, mats, name, spec);
      api.doors[name] = d;
      if (d.frost) api.frosted.push({ pane: d.pane, frost: d.frost, mesh: d.pane.mesh, door: d });
    }
    // (the back door is locked until a man comes through it)
    api.doors.BD.locked = true;

    // ---- the casings and the baseboards --------------------------------------------------------
    {
      kit.piece();
      const tr = [];
      const cas = (o) => tr.push(...casing(o));
      const both = (spec, f1, f2) => {
        const along = spec.axis === 'z';
        const s = along ? [spec.z0, spec.z1] : [spec.x0, spec.x1];
        cas({ axis: spec.axis, f: f1, dir: -1, s, y: [FLOOR, top], w: 0.085 });
        cas({ axis: spec.axis, f: f2, dir: 1, s, y: [FLOOR, top], w: 0.085 });
      };
      both(D.A1, CORR.x0 - T, CORR.x0); both(D.B1, CORR.x1, CORR.x1 + T);
      both(D.A2, ROOM_A.z1, ROOM_A.z1 + T); both(D.B2, ROOM_B.z1, ROOM_B.z1 + T);
      both(D.SD, HOUSE.z1, HOUSE.z1 + T); both(D.BD, HOUSE.z0 - T, HOUSE.z0);
      for (const [a, b] of WINDOWS) {
        cas({ axis: 'x', f: HOUSE.z1, dir: -1, s: [a, b], y: WIN_Y, w: 0.09, sill: true, sillD: 0.12 });
        cas({ axis: 'x', f: HOUSE.z1 + T, dir: 1, s: [a, b], y: WIN_Y, w: 0.09, sill: true, sillD: 0.08 });
      }
      // baseboards round the rooms (the doorways skipped)
      const sk = (spec, pad = 0.09) => (spec.axis === 'z' ? [spec.z0 - pad, spec.z1 + pad] : [spec.x0 - pad, spec.x1 + pad]);
      tr.push(...strip({ axis: 'z', f: HOUSE.x0, dir: 1, s: [HOUSE.z0, HOUSE.z1], y: FLOOR, d: 0.018, h: 0.16 }));
      tr.push(...strip({ axis: 'z', f: HOUSE.x1, dir: -1, s: [HOUSE.z0, HOUSE.z1], y: FLOOR, d: 0.018, h: 0.16 }));
      tr.push(...strip({ axis: 'z', f: CORR.x0 - T, dir: -1, s: [HOUSE.z0, ROOM_A.z1], y: FLOOR, d: 0.018, h: 0.16, skip: [sk(D.A1)] }));
      tr.push(...strip({ axis: 'z', f: CORR.x1 + T, dir: 1, s: [HOUSE.z0, ROOM_B.z1], y: FLOOR, d: 0.018, h: 0.16, skip: [sk(D.B1)] }));
      tr.push(...strip({ axis: 'x', f: HOUSE.z0, dir: 1, s: [HOUSE.x0, HOUSE.x1], y: FLOOR, d: 0.018, h: 0.16, skip: [sk(D.BD)] }));
      tr.push(...strip({ axis: 'x', f: HOUSE.z1, dir: -1, s: [HOUSE.x0, HOUSE.x1], y: FLOOR, d: 0.018, h: 0.16, skip: [sk(D.SD)] }));
      // a picture rail round the rooms
      for (const [ax, f, dir, s] of [['z', HOUSE.x0, 1, [HOUSE.z0, HOUSE.z1]], ['z', HOUSE.x1, -1, [HOUSE.z0, HOUSE.z1]], ['x', HOUSE.z0, 1, [HOUSE.x0, HOUSE.x1]]]) tr.push(...strip({ axis: ax, f, dir, s, y: CEIL - 0.45, d: 0.02, h: 0.035 }));
      const tm = kit.add(M(tr), mats.trim, { name: 'kh_trim' });
      tm.userData.cover = { kind: 'thin' };
    }

    // ---- the windows: clear glass in the front ---------------------------------------------------
    for (const [a, b] of WINDOWS) {
      const w = b - a, h = WIN_Y[1] - WIN_Y[0];
      // two sashes each: four panes (a muntin cross)
      for (const [u0, u1] of [[a, a + w / 2], [a + w / 2, b]]) for (const [v0, v1] of [[WIN_Y[0], WIN_Y[0] + h / 2], [WIN_Y[0] + h / 2, WIN_Y[1]]]) {
        stage.glass.addPane({ centre: V((u0 + u1) / 2, (v0 + v1) / 2, HOUSE.z1 + T / 2), normal: V(0, 0, 1), w: u1 - u0 - 0.04, h: v1 - v0 - 0.04, tag: 'frontWindow' });
      }
      kit.piece();
      kit.add(M([kit.box(a + w / 2 - 0.025, a + w / 2 + 0.025, WIN_Y[0], WIN_Y[1], HOUSE.z1 + 0.04, HOUSE.z1 + T - 0.04), kit.box(a, b, WIN_Y[0] + h / 2 - 0.025, WIN_Y[0] + h / 2 + 0.025, HOUSE.z1 + 0.04, HOUSE.z1 + T - 0.04)]), mats.trim, { name: 'kh_muntins' });
    }

    // ---- room A: the desk, the cabinets, the crates ---------------------------------------------
    api.desk = buildDesk(stage, kit, mats, piece, C);
    for (const [x, z] of CABINETS) {
      const m = piece(cabinetGeo(x, z), mats.steelLight, { kind: 'steel' }, { name: 'kh_cabinet' });
      void m;
      C.addBox(x, z, CABINET.w / 2, CABINET.d / 2, 0, 'stand');
    }
    for (const c of CRATES_A) crate(c, 'A');
    // by the door: the tall cabinet (three bottles on its top: the teach's), the armchair
    piece(cabinetGeo(CAB_E.x, CAB_E.z), mats.steelLight, { kind: 'steel' }, { name: 'kh_cabinetE' });
    C.addBox(CAB_E.x, CAB_E.z, CABINET.w / 2, CABINET.d / 2, 0, 'stand');
    api.teachBottles = [];
    ['rye', 'gin', 'scotch'].forEach((v, i) => {
      const b = buildProp('bottle', { variant: v });
      b.position.set(CAB_E.x - 0.1 + (i - 1) * 0.02, FLOOR + CABINET.h + 0.005, CAB_E.z - 0.18 + i * 0.18);
      g.add(b);
      api.teachBottles.push({ obj: b, h: stage.breakables.add(b, { kind: 'bottle' }) });
    });
    {
      const A = CHAIR_A;
      const parts = [
        slab(A.w, 0.16, A.d, { bevel: 0.03, corner: 0.06 }).translate(0, 0.32, 0),
        slab(A.w, 0.5, 0.18, { bevel: 0.03, corner: 0.05 }).translate(0, 0.42, -A.d / 2 + 0.09),
        slab(0.16, 0.3, A.d, { bevel: 0.03, corner: 0.05 }).translate(A.w / 2 - 0.08, 0.38, 0),
        slab(0.16, 0.3, A.d, { bevel: 0.03, corner: 0.05 }).translate(-A.w / 2 + 0.08, 0.38, 0),
        new THREE.BoxGeometry(A.w - 0.06, 0.24, A.d - 0.06).translate(0, 0.12, 0),
      ];
      const geo = M(parts).rotateY(A.yaw).translate(A.x, FLOOR, A.z);
      piece(geo, mats.leather, { kind: 'wood', hp: 5, name: 'armchair' }, { name: 'kh_armchair' });
      C.addBox(A.x, A.z, A.w / 2, A.d / 2, A.yaw, 'booth');
    }
    stage.coverCorners = CORNERS;
    // a hat stand by the door A1, a wastebasket (things in the room)
    kit.piece();
    kit.add(M([lathe([[0.0001, 0], [0.18, 0], [0.18, 0.02], [0.02, 0.05], [0.016, 1.8], [0.03, 1.82], [0.0001, 1.84]], 16).translate(-1.75, FLOOR, -5.4)]), mats.trim, { name: 'kh_hatstand' });
    C.addCircle(-1.75, -5.4, 0.2, 'stand');

    // ---- room B: the bar ----------------------------------------------------------------------------
    {
      const K = COUNTER, n = 4, sw = (K.x1 - K.x0) / n;
      // the front: four panels of wood (each a section: shot to pieces, a gap)
      for (let i = 0; i < n; i++) {
        const x0 = K.x0 + i * sw;
        piece(new THREE.BoxGeometry(sw - 0.01, K.h - FLOOR - 0.06, 0.05).translate(x0 + sw / 2, FLOOR + (K.h - FLOOR - 0.06) / 2, K.z + K.d / 2 - 0.025), mats.desk, { kind: 'wood', hp: 15, name: 'counter ' + i }, { name: 'kh_counterPanel' });
      }
      // the ends, the plinth, the top (stone)
      kit.piece();
      kit.add(M([kit.box(K.x0 - 0.05, K.x0, FLOOR, K.h - 0.06, K.z - K.d / 2, K.z + K.d / 2), kit.box(K.x1, K.x1 + 0.05, FLOOR, K.h - 0.06, K.z - K.d / 2, K.z + K.d / 2)]), mats.desk);
      const topM = piece(slab(K.x1 - K.x0 + 0.16, 0.06, K.d + 0.12, { bevel: 0.012, corner: 0.02 }).translate((K.x0 + K.x1) / 2, K.h - 0.06, K.z), mats.steelLight, { kind: 'stone' }, { name: 'kh_counterTop' });
      void topM;
      // a foot rail on the room side (brass)
      kit.piece();
      kit.add(new THREE.CylinderGeometry(0.025, 0.025, K.x1 - K.x0, 12).rotateZ(Math.PI / 2).translate((K.x0 + K.x1) / 2, FLOOR + 0.2, K.z + K.d / 2 + 0.16), mats.brass, { noRay: true });
      C.addBox((K.x0 + K.x1) / 2, K.z, (K.x1 - K.x0) / 2 + 0.05, K.d / 2, 0, 'booth');
      // the back bar: a low cupboard, a shelf of bottles, a mirror (a lit panel)
      const B = BACKBAR;
      piece(kit.box(B.x0, B.x1, FLOOR, B.h, B.z - B.d / 2, B.z + B.d / 2), mats.desk, { kind: 'wood', hp: 14 }, { name: 'kh_backbar' });
      kit.piece();
      kit.add(M([kit.box(B.x0, B.x1, B.shelf, B.shelf + 0.03, B.z - 0.18, B.z + 0.06), kit.box(B.x0, B.x1, B.h, B.h + 0.03, B.z - B.d / 2, B.z + B.d / 2 + 0.03)]), mats.deskTop, { name: 'kh_shelf' });
      kit.piece();
      const mirror = kit.add(kit.box(B.x0 + 0.3, B.x1 - 0.3, B.h + 0.2, B.shelf - 0.08, -7.99, -7.97), mats.litDim, { cast: false, noRay: true, name: 'kh_mirror' });
      void mirror;
      C.addBox((B.x0 + B.x1) / 2, B.z, (B.x1 - B.x0) / 2, B.d / 2, 0, 'wall');
      // the bottles: on the back bar's top and its shelf (the teach's targets)
      const kinds = ['scotch', 'rye', 'gin', 'scotch', 'rye', 'gin', 'scotch', 'rye'];
      kinds.forEach((v, i) => {
        const b = buildProp('bottle', { variant: v });
        const onShelf = i % 2 === 1;
        b.position.set(B.x0 + 0.5 + i * 0.68, onShelf ? B.shelf + 0.03 : B.h + 0.03, B.z + (onShelf ? -0.06 : 0.02));
        g.add(b);
        const h = stage.breakables.add(b, { kind: 'bottle' });
        api.bottles.push({ obj: b, h });
      });
      for (const c of CRATES_B) crate(c, 'B');
      for (const c of STREET_CRATES) crate(c, 'S');
      for (const [x, z] of BARRELS_B) barrel(x, z);
      for (const [x, z] of TABLES_B) table(x, z);
    }

    // ---- the lobby: the reception counter, the bench ------------------------------------------------
    {
      const R = RECEPTION, n = 2, sw = (R.x1 - R.x0) / n;
      for (let i = 0; i < n; i++) piece(new THREE.BoxGeometry(sw - 0.01, R.h - FLOOR - 0.05, 0.05).translate(R.x0 + i * sw + sw / 2, FLOOR + (R.h - FLOOR - 0.05) / 2, R.z1 - 0.025), mats.desk, { kind: 'wood', hp: 14, name: 'reception ' + i }, { name: 'kh_reception' });
      kit.piece();
      kit.add(M([kit.box(R.x0 - 0.05, R.x0, FLOOR, R.h - 0.05, R.z0, R.z1), kit.box(R.x1, R.x1 + 0.05, FLOOR, R.h - 0.05, R.z0, R.z1), kit.box(R.x0, R.x1, FLOOR, R.h - 0.05, R.z0, R.z0 + 0.04)]), mats.desk);
      piece(slab(R.x1 - R.x0 + 0.14, 0.05, R.z1 - R.z0 + 0.1, { bevel: 0.01, corner: 0.015 }).translate((R.x0 + R.x1) / 2, R.h - 0.05, (R.z0 + R.z1) / 2), mats.deskTop, { kind: 'wood', hp: 6 });
      C.addBox((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2, (R.x1 - R.x0) / 2 + 0.05, (R.z1 - R.z0) / 2, 0, 'booth');
      const Bn = BENCH;
      kit.piece();
      const bench = kit.add(M([kit.box(Bn.x0, Bn.x1, Bn.h - 0.05, Bn.h, Bn.z - Bn.d / 2, Bn.z + Bn.d / 2), kit.box(Bn.x0, Bn.x1, Bn.h, Bn.h + 0.5, Bn.z + Bn.d / 2 - 0.05, Bn.z + Bn.d / 2), ...[Bn.x0 + 0.1, Bn.x1 - 0.1].map((x) => kit.box(x - 0.04, x + 0.04, FLOOR, Bn.h - 0.05, Bn.z - Bn.d / 2 + 0.05, Bn.z + Bn.d / 2 - 0.05))]), mats.desk, { name: 'kh_bench' });
      bench.userData.cover = { kind: 'thin' };
      C.addBox((Bn.x0 + Bn.x1) / 2, Bn.z, (Bn.x1 - Bn.x0) / 2, Bn.d / 2, 0, 'bench');
    }

    // ---- the lamps: pools in the dark -------------------------------------------------------------------
    const L = stage.lamps;
    const pendant = (x, z, { drop = 0.62, half = 0.62, strength = 0.42, intensity = 34, angle = 0.72, dist = 5.2, tag = 'pendant' } = {}) => {
      kit.piece();
      const y = CEIL - drop;
      const shade = kit.add(lathe([[0.02, 0.1], [0.05, 0.07], [0.09, 0.02], [0.2, -0.08], [0.26, -0.15], [0.27, -0.17], [0.25, -0.17]], 28).translate(x, y, z), mats.shade, { cast: true, name: 'kh_shade' });
      kit.add(new THREE.CylinderGeometry(0.008, 0.008, drop, 6).translate(x, y + drop / 2 + 0.1, z), mats.iron, { cast: false, noRay: true });
      const bulb = kit.add(new THREE.CircleGeometry(0.2, 24).rotateX(Math.PI / 2).translate(x, y - 0.16, z), mats.bulb, { cast: false, noRay: true });
      const lamp = L.addCustom({ head: V(x, y - 0.18, z), axis: V(0, -1, 0), height: y - 0.18 - FLOOR, half, real: true, bulb, fadeEnd: 0.8, edgeSoft: 0.45, strength, tag });
      Object.assign(lamp.light, { intensity, angle, penumbra: 0.55, distance: dist });
      shade.userData.lamp = lamp;
      return lamp;
    };
    api.lights = {
      A: pendant(-4.5, -3.6, { strength: 0.5, intensity: 40 }),
      A2: pendant(-6.6, -0.8, { strength: 0.3, intensity: 20, angle: 0.6 }),
      // (a pool inside room A's door from the corridor: a man coming through it steps into the light)
      A3: pendant(-2.35, -4.1, { strength: 0.42, intensity: 26, angle: 0.62, half: 0.55 }),
      B1: pendant(3.6, -4.9, { strength: 0.45 }),
      B2: pendant(6.3, -4.9, { strength: 0.45 }),
      B3: pendant(4.4, -1.4, { strength: 0.32, intensity: 22, angle: 0.62 }),
      corr: pendant(-0.4, -3.2, { drop: 0.35, half: 0.7, strength: 0.6, intensity: 36, angle: 0.8, dist: 4.8 }),
      corrBack: pendant(-0.4, -6.6, { drop: 0.35, half: 0.66, strength: 0.45, intensity: 26, angle: 0.75, dist: 4.5 }),
      lobby: pendant(-0.4, 3.5, { strength: 0.42, intensity: 30 }),
      lobby2: pendant(-5.6, 4.2, { strength: 0.3, intensity: 18, angle: 0.62 }),
      lobby3: pendant(5.8, 3.8, { strength: 0.3, intensity: 18, angle: 0.62 }),
      // (a pool on the reception counter: a man behind it is a shape against its light)
      desk2: pendant(-3.5, 3.3, { strength: 0.4, intensity: 24, angle: 0.6, half: 0.55 }),
    };
    // (an interior's lamps take the pool's lights before a street lamp while the eye is inside)
    const inside = (p) => p.x > HOUSE.x0 - 0.2 && p.x < HOUSE.x1 + 0.2 && p.z > HOUSE.z0 - 0.2 && p.z < HOUSE.z1 + 0.2;
    for (const lamp of Object.values(api.lights)) lamp.priority = (eye) => (inside(eye) ? 2 : 0);

    // ---- the Looks, the dry volume, the floor -------------------------------------------------------------
    const box = new THREE.Box3(V(HOUSE.x0 - 0.05, FLOOR - 0.5, HOUSE.z0 - 0.05), V(HOUSE.x1 + 0.05, CEIL + 0.2, HOUSE.z1 + 0.02));
    stage.dry.push(box);
    const inLook = { fogDensity: FOG.density * 0.3, rainOverlay: 0, haze: 0.6, reflect: 'none', ambient: 0.12 };
    stage.addLook(new THREE.Box3(V(ROOM_A.x0, FLOOR - 0.5, ROOM_A.z0), V(ROOM_A.x1, CEIL + 0.2, ROOM_A.z1)), { ...inLook, room: 'office' });
    stage.addLook(new THREE.Box3(V(ROOM_B.x0, FLOOR - 0.5, ROOM_B.z0), V(ROOM_B.x1, CEIL + 0.2, ROOM_B.z1)), { ...inLook, room: 'office' });
    stage.addLook(box, { ...inLook, ambient: 0.11, haze: 0.5, room: 'corridor' });
    stage.addSurface((x, z) => (x > HOUSE.x0 - 0.2 && x < HOUSE.x1 + 0.2 && z > HOUSE.z0 - 0.2 && z < HOUSE.z1 + 0.1 ? FLOOR : undefined));
    api.box = box;

    // ---- the frosted panes show the men behind them --------------------------------------------------------
    api.updateFrost = () => {
      const men = stage.hoods.list.filter((h) => h.alive || (h._deathT ?? 9) < 0.7);
      for (const f of api.frosted) {
        const fr = f.frost, n = f.mesh;
        n.updateWorldMatrix(true, false);
        const c = new THREE.Vector3().setFromMatrixPosition(n.matrixWorld);
        const q = n.getWorldQuaternion(new THREE.Quaternion());
        const u = V(1, 0, 0).applyQuaternion(q), v = V(0, 1, 0).applyQuaternion(q), nn = V(0, 0, 1).applyQuaternion(q);
        fr.userData.setFrame(c, u, v, nn);
        // (the light behind it: the lamp on the far side from the eye)
        const G = stage.game, e = G ? G.eye : c;
        const side = Math.sign((e.x - c.x) * nn.x + (e.z - c.z) * nn.z) || 1;
        // (the light behind it: the nearest lamp on the far side from the eye)
        const Ls = side > 0 ? [api.lights.lobby, api.lights.lobby2, api.lights.lobby3] : [api.lights.B1, api.lights.B2, api.lights.B3];
        let lamp = Ls[0], bd = Infinity;
        for (const L of Ls) { const d = L.head.distanceTo(c); if (d < bd && !L.dead) { bd = d; lamp = L; } }
        fr.userData.setLamp(f.door ? (side > 0 ? api.lights.lobby.head : api.lights.corr.head) : lamp.head, 1);
        const L2 = fr.userData.figures;
        L2.length = 0;
        for (const h of men) {
          if (L2.length >= 3) break;
          const d = (h.pos.x - c.x) * nn.x + (h.pos.z - c.z) * nn.z;
          // (behind the glass from the eye: on the far side, within 2.4 m, not off its ends)
          if (Math.sign(d) === side || Math.abs(d) > 2.4) continue;
          const along = (h.pos.x - c.x) * u.x + (h.pos.z - c.z) * u.z;
          if (Math.abs(along) > 2.2) continue;
          if (!h._c2j) h._c2j = hoodJoints(h);
          L2.push({ k: h.alive ? 1 : Math.max(0, 1 - (h._deathT ?? 0) / 0.7), joints: h._c2j });
        }
        fr.userData.update();
      }
    };

    // ---- reset: every break mended (a retry) ------------------------------------------------------------------
    api.reset = () => {
      const B = stage.breakables, Gl = stage.glass, G = stage.game;
      for (const h of B.list) if (B.restore) B.restore(h);
      if (B.clearPieces) B.clearPieces();
      for (const p of Gl.panes) Gl.restore(p);
      for (const d of Object.values(api.doors)) { d.set(0); d.locked = d.name === 'BD'; }
      api.desk.reset();
      for (const m of api.sections) {
        const c = m.userData.cover;
        c.hp = c.hp0 ?? c.hp; c.broken = false; c.hits = 0;
        if (!m.visible) { m.visible = true; if (!stage.solids.includes(m)) stage.addSolid(m); }
        if (G && G.rays) G.rays.setEnabled(m, true);
      }
      for (const L2 of Object.values(api.lights)) if (L2.dead) { L2.dead = false; L2.buzz = null; L2.dieNow = false; L2.deadK = 0; L2.on = true; if (L2.bulb) L2.bulb.material = mats.bulb; }
      if (G && G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
    };
    for (const m of api.sections) { const c = m.userData.cover; if (c.hp != null) c.hp0 = c.hp; }
    return api;

    // ---- small builders --------------------------------------------------------------------------
    function crate([x, z, s, h, yaw, y0 = 0], tag) {
      const geo = new THREE.BoxGeometry(s, h, s);
      // (the slats: a frame of battens on every face)
      const bat = [];
      const b = 0.06;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) bat.push(new THREE.BoxGeometry(b, h + 0.01, b).translate(sx * (s / 2 - b / 2 + 0.006), 0, sz * (s / 2 - b / 2 + 0.006)));
      for (const sy of [-1, 1]) for (const ax of [0, 1]) for (const sd of [-1, 1]) {
        const gg = ax ? new THREE.BoxGeometry(s + 0.012, b, b) : new THREE.BoxGeometry(b, b, s + 0.012);
        gg.translate(ax ? 0 : sd * (s / 2 - b / 2 + 0.006), sy * (h / 2 - b / 2), ax ? sd * (s / 2 - b / 2 + 0.006) : 0);
        bat.push(gg);
      }
      const all = M([geo, ...bat]);
      all.rotateY(yaw).translate(x, FLOOR + y0 + h / 2, z);
      piece(all, mats.desk, { kind: 'wood', hp: 6, name: 'crate' }, { name: 'kh_crate' + tag });
      if (!y0) C.addBox(x, z, s / 2, s / 2, yaw, 'crates');
    }
    function barrel(x, z) {
      const prof = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([0.27 + 0.04 * Math.sin(Math.PI * t), t * 0.9]); }
      const geo = lathe([[0.0001, 0], ...prof, [0.0001, 0.9]], 24);
      const hoops = [0.12, 0.45, 0.78].map((y) => new THREE.TorusGeometry(0.29 + 0.03 * Math.sin(Math.PI * y / 0.9), 0.012, 6, 28).rotateX(Math.PI / 2).translate(0, y, 0));
      const m = piece(geo.translate(x, FLOOR, z), mats.desk, { kind: 'wood', hp: 8, name: 'barrel' }, { name: 'kh_barrel' });
      void m;
      kit.add(M(hoops.map((h) => h.translate(x, FLOOR, z))), mats.iron, { cast: false, noRay: true });
      C.addCircle(x, z, 0.3, 'barrels');
    }
    function table(x, z) {
      kit.piece();
      const t = kit.add(M([new THREE.CylinderGeometry(0.42, 0.42, 0.04, 28).translate(x, FLOOR + 0.74, z), new THREE.CylinderGeometry(0.035, 0.05, 0.72, 10).translate(x, FLOOR + 0.37, z), new THREE.CylinderGeometry(0.24, 0.26, 0.03, 20).translate(x, FLOOR + 0.015, z)]), mats.desk, { name: 'kh_table' });
      t.userData.cover = { kind: 'thin' };
      C.addCircle(x, z, 0.42, 'table');
    }
    function cabinetGeo(x, z) {
      const W = CABINET;
      const parts = [new THREE.BoxGeometry(W.w, W.h, W.d).translate(0, W.h / 2, 0)];
      for (let k = 0; k < 4; k++) parts.push(new THREE.BoxGeometry(0.12, 0.018, 0.02).translate(0, 0.25 + k * 0.32, W.d / 2 + 0.01));
      return M(parts).translate(x, FLOOR, z);
    }
  },

  update(api, dt) {
    for (const d of Object.values(api.doors)) d.update(dt);
    api.desk.update(dt);
    api.updateFrost();
  },
};

// ---- the desk: it goes over on its front (the side toward the door A1) --------------------------
// (its frame: a pivot on the bottom edge it tips over, the body's centre
// half its depth from it; tip(dir): dir +1 over toward +x, -1 toward -x)
function buildDesk(stage, kit, mats, piece, C) {
  const Dk = DESK;
  const pivot = new THREE.Group();
  pivot.position.set(Dk.x, FLOOR, Dk.z);
  kit.g.add(pivot);
  const body = new THREE.Group();
  pivot.add(body);
  const pw = 0.44;
  // the top: three boards across its width (sections: over on its front, the
  // top is the face the rounds hit; a board shot to pieces is a gap)
  const n = 3, bw = (Dk.w + 0.12) / n;
  for (let i = 0; i < n; i++) {
    const zc = -Dk.w / 2 - 0.06 + bw * (i + 0.5);
    piece(slab(Dk.d + 0.06, 0.05, bw - 0.004, { bevel: 0.01, corner: 0.012 }).translate(0, Dk.h - 0.05, zc), mats.deskTop, { kind: 'wood', hp: 11, name: 'desk top ' + i }, { parent: body, name: 'kh_deskTop' });
  }
  // the pedestals of drawers (thick: wood, more to chew)
  for (const s of [-1, 1]) {
    const zc = s * (Dk.w / 2 - pw / 2);
    const ped = [new THREE.BoxGeometry(Dk.d - 0.04, Dk.h - 0.12, pw).translate(0, (Dk.h - 0.12) / 2 + 0.07, zc)];
    for (let k = 0; k < 3; k++) {
      const y = 0.14 + k * 0.2;
      for (const fx of [-1, 1]) ped.push(new THREE.BoxGeometry(0.02, 0.17, pw - 0.04).translate(fx * (Dk.d / 2 - 0.01), y + 0.08, zc));
    }
    piece(mergeGeos(ped), mats.desk, { kind: 'wood', hp: 12, name: 'pedestal' }, { parent: body, name: 'kh_deskPed' });
  }
  // the modesty panel between the pedestals (thin)
  piece(new THREE.BoxGeometry(0.025, Dk.h - 0.3, Dk.w - 2 * pw).translate(0, (Dk.h - 0.3) / 2 + 0.2, 0), mats.desk, { kind: 'thin' }, { parent: body, name: 'kh_deskPanel' });
  // on the top: a blotter, a telephone, a lamp's base (they slide off when it goes)
  kit.piece();
  const loose = kit.add(mergeGeos([
    slab(0.48, 0.006, 0.72, { bevel: 0.002, corner: 0.01 }).translate(0, Dk.h, -0.1),
    lathe([[0.0001, 0], [0.06, 0], [0.058, 0.01], [0.035, 0.03], [0.02, 0.08], [0.018, 0.2], [0.03, 0.21], [0.0001, 0.212]], 18).translate(0.15, Dk.h, 0.55),
  ]), mats.iron, { parent: body, name: 'kh_deskThings' });
  const col = C.addBox(Dk.x, Dk.z, Dk.d / 2, Dk.w / 2, 0, 'booth');
  const D = {
    pivot, body, col, loose, tipped: 0, tip: null, dir: 1,
    // over it goes, away from `dir` (+1 toward +x)
    tipOver(dir = 1, now = false) {
      if (this.tip) return false;
      this.dir = dir >= 0 ? 1 : -1;
      // (the pivot to the edge it goes over; the body re-centred on it)
      pivot.position.set(Dk.x + this.dir * Dk.d / 2, FLOOR, Dk.z);
      body.position.set(-this.dir * Dk.d / 2, 0, 0);
      this.tip = { a: now ? Math.PI / 2 : 0, v: 0, done: false };
      if (now) { this.tip.done = true; this.apply(Math.PI / 2); this.landed(); }
      return true;
    },
    // (over: where its back is - the edge it went over on, the side I crouch at)
    back() { return { x: Dk.x + this.dir * Dk.d / 2, z: Dk.z }; },
    apply(a) {
      pivot.rotation.z = -this.dir * a;
      this.tipped = a / (Math.PI / 2);
      pivot.updateMatrixWorld(true);
      const G = stage.game;
      if (G && G.rays) body.traverse((m) => { if (m.isMesh && stage.solids.includes(m)) G.rays.refresh(m); });
    },
    landed() {
      // the collider: the desk lying on its front, its top a wall toward `dir`
      col.cx = Dk.x + this.dir * (Dk.d / 2 + Dk.h / 2); col.hx = Dk.h / 2 + 0.03; col.hz = Dk.w / 2 + 0.06;
      loose.visible = false;
      const G = stage.game;
      if (G && G.rays) G.rays.setEnabled(loose, false);
      if (G && G.guns && G.guns.rebuild) G.guns.rebuild();
      if (G && G.pipeline && G.pipeline.dirtyShadows) G.pipeline.dirtyShadows();
    },
    update(dt) {
      const T = this.tip;
      if (!T || T.done) return;
      const tq = 9.8 * Math.sin(Math.max(0.05, T.a) + 0.6) * 0.9;
      T.v += (T.a < 0.02 ? 4.5 : tq) * dt;
      T.a += T.v * dt;
      if (T.a >= Math.PI / 2) {
        T.a = Math.PI / 2;
        const G = stage.game;
        if (T.v > 1.2) { T.v = -T.v * 0.22; if (G) { G.sfx.play('c2_deskFall', V(Dk.x + this.dir * 0.6, 0.4, Dk.z), {}, { ref: 3 }); G.controller.shake(0.35, Math.hypot(G.eye.x - Dk.x, G.eye.z - Dk.z)); } }
        else { T.v = 0; T.done = true; this.apply(T.a); this.landed(); return; }
      }
      this.apply(T.a);
    },
    reset() {
      this.tip = null; this.tipped = 0;
      pivot.position.set(Dk.x, FLOOR, Dk.z); body.position.set(0, 0, 0); pivot.rotation.z = 0;
      pivot.updateMatrixWorld(true);
      col.cx = Dk.x; col.hx = Dk.d / 2; col.hz = Dk.w / 2;
      loose.visible = true;
      const G = stage.game;
      if (G && G.rays) { body.traverse((m) => { if (m.isMesh && stage.solids.includes(m)) G.rays.refresh(m); }); G.rays.setEnabled(loose, true); }
    },
  };
  return D;
}
