import * as THREE from 'three';
import { wallGeos, wallColliders, strip, casing } from './walls.js';
import { FLOOR, CEIL, T, ROOM, OUTER, OPEN, R305, CORR, WC, LANDING, LIFT, DOOR, SIDE, DOORS, LOCKED, WIN, WIN305, ESC, SAFE } from '../plan.js';
import { mergeGeos } from '../../../props/lib.js';

// The shell ([C5] wave C: the third floor made bigger and finished): the
// walls of Ames's room, the outer office, 305 next door, the corridor, the
// washroom, the stair's landing and the lift's shaft; floors, ceilings, the
// mouldings, the casings round every opening, and the walls' colliders (the
// holes a man walks through left open). Every wall is stone to a round (the
// gun kit's default: unmarked stops it).
const M = (list) => mergeGeos(list);
const DH = DOOR.h;

export function buildShell(kit, mats, stage) {
  const C = stage.colliders;
  const out = {};
  const D = DOORS;
  const dz = (d) => [d.z0, d.z1, FLOOR, DH, 'open'];
  const dx = (d) => [d.x0, d.x1, FLOOR, DH, 'open'];
  const lockedHoles = (side) => LOCKED.filter((l) => l[2] === side).map(([, z]) => [z - 0.475, z + 0.475, FLOOR, DH]);
  // ---- the walls -----------------------------------------------------------------------
  // the corridor's east wall: the suite's front (the door, its sidelight), 305's door, 306 (locked)
  const ew = { axis: 'z', a: [CORR.x1, OUTER.x0], s: [CORR.z0 - T, CORR.z1 + T], y: [FLOOR, CEIL], holes: [
    [DOOR.z0, DOOR.z1, FLOOR, DOOR.transom[1], 'open'], [SIDE.z0, SIDE.z1, SIDE.y0, SIDE.y1], dz(D.D305), ...lockedHoles('E'),
  ] };
  // the corridor's west wall: 301 - 303 (locked), the stair door
  const ww = { axis: 'z', a: [CORR.x0 - T, CORR.x0], s: [CORR.z0 - T, CORR.z1 + T], y: [FLOOR, CEIL], holes: [...lockedHoles('W'), dz(D.STAIR)] };
  // the corridor's south end: the lift's cage
  const cs = { axis: 'x', a: [CORR.z0 - T, CORR.z0], s: [CORR.x0 - T, CORR.x1 + T], y: [FLOOR, CEIL], holes: [[LIFT.x0, LIFT.x1, FLOOR, 2.25, 'open']] };
  // the north wall from the corridor's end to the street front: the washroom's door, the fire-escape window
  const nw = { axis: 'x', a: [ROOM.z1, ROOM.z1 + T], s: [CORR.x0 - T, ROOM.x1 + T], y: [FLOOR, CEIL], holes: [dx(D.WC), [ESC.x0, ESC.x1, ESC.y0, ESC.y1]] };
  // the partition between the outer office and Ames's room: the wide opening
  const pw = { axis: 'z', a: [OUTER.x1, ROOM.x0], s: [ROOM.z0, ROOM.z1], y: [FLOOR, CEIL], holes: [[OPEN.z0, OPEN.z1, FLOOR, OPEN.h, 'open']] };
  // the suite's south wall (305 beyond it): the safe in it, the connecting door
  const sw = { axis: 'x', a: [R305.z1, ROOM.z0], s: [OUTER.x0, ROOM.x1 + T], y: [FLOOR, CEIL], holes: [
    [SAFE.x - SAFE.w / 2, SAFE.x + SAFE.w / 2, SAFE.y - SAFE.h / 2, SAFE.y + SAFE.h / 2], dx(D.CONN),
  ] };
  // the street front: Ames's window, 305's
  const fw = { axis: 'z', a: [ROOM.x1, ROOM.x1 + T], s: [R305.z0 - T, ROOM.z1], y: [FLOOR, CEIL], holes: [[WIN.z0, WIN.z1, WIN.y0, WIN.y1], [WIN305.z0, WIN305.z1, WIN305.y0, WIN305.y1]] };
  // 305's south wall
  const s5 = { axis: 'x', a: [R305.z0 - T, R305.z0], s: [OUTER.x0, ROOM.x1 + T], y: [FLOOR, CEIL], holes: [] };
  // the washroom's walls (west, north, east)
  const wcW = { axis: 'z', a: [WC.x0 - T, WC.x0], s: [WC.z0, WC.z1 + T], y: [FLOOR, CEIL], holes: [] };
  const wcN = { axis: 'x', a: [WC.z1, WC.z1 + T], s: [WC.x0 - T, WC.x1 + T], y: [FLOOR, CEIL], holes: [] };
  const wcE = { axis: 'z', a: [WC.x1, WC.x1 + T], s: [WC.z0, WC.z1 + T], y: [FLOOR, CEIL], holes: [] };
  // the stair's landing: north, west (the flight's mouth), south
  const lN = { axis: 'x', a: [LANDING.z1, LANDING.z1 + T], s: [LANDING.x0 - T, CORR.x0 - T], y: [FLOOR - 2, CEIL], holes: [] };
  const lS = { axis: 'x', a: [LANDING.z0 - T, LANDING.z0], s: [LANDING.x0 - T, CORR.x0 - T], y: [FLOOR - 2, CEIL], holes: [] };
  const lW = { axis: 'z', a: [LANDING.x0 - T, LANDING.x0], s: [LANDING.z0 - T, LANDING.z1 + T], y: [FLOOR - 2, CEIL], holes: [] };
  kit.piece();
  const roomWalls = kit.add(M([...wallGeos(pw), ...wallGeos(sw), ...wallGeos(fw), ...wallGeos(nw)]), mats.plaster, { name: 'office_walls' });
  kit.piece();
  const cwMesh = kit.add(M([...wallGeos(ew)]), mats.plaster, { name: 'office_corridorWall' });
  kit.piece();
  const corrWalls = kit.add(M([...wallGeos(ww), ...wallGeos(cs), ...wallGeos(s5), ...wallGeos(wcW), ...wallGeos(wcN), ...wallGeos(wcE), ...wallGeos(lN), ...wallGeos(lS), ...wallGeos(lW)]), mats.plasterDark, { name: 'corridor_walls' });
  // the transom bar over the suite's door, the header over the opening
  kit.add(kit.box(CORR.x1, OUTER.x0, DH, DOOR.transom[0], DOOR.z0, DOOR.z1), mats.plaster);
  for (const w of [ew, ww, cs, nw, pw, sw, fw, s5, wcW, wcN, wcE, lN, lS, lW]) wallColliders(C, w, 'wall');
  out.walls = { roomWalls, cwMesh, corrWalls };
  // (the walls are stone to a round: they stop it)
  for (const m of [roomWalls, cwMesh, corrWalls]) m.userData.cover = { kind: 'stone' };

  // ---- floors and ceilings ------------------------------------------------------------
  kit.piece();
  const boards = [ROOM, OUTER, R305].map((R) => kit.box(R.x0 - 0.01, R.x1 + 0.01, FLOOR - 0.06, FLOOR, R.z0 - 0.01, R.z1 + 0.01));
  // (under the openings: the doorways' thresholds are boards too)
  boards.push(kit.box(OUTER.x1 - 0.01, ROOM.x0 + 0.01, FLOOR - 0.06, FLOOR, OPEN.z0, OPEN.z1));
  boards.push(kit.box(D.CONN.x0, D.CONN.x1, FLOOR - 0.06, FLOOR, R305.z1 - 0.01, ROOM.z0 + 0.01));
  const floor = kit.add(M(boards), mats.boards, { name: 'office_floor' });
  {
    const seams = [];
    for (const R of [ROOM, OUTER, R305]) for (let x = R.x0 + 0.11; x < R.x1 - 0.05; x += 0.11) seams.push(new THREE.BoxGeometry(0.006, 0.004, R.z1 - R.z0).translate(x, FLOOR + 0.0005, (R.z0 + R.z1) / 2));
    kit.add(M(seams), mats.trim, { cast: false, noRay: true });
  }
  kit.piece();
  // the corridor's lino (and the thresholds into its doors), the washroom's tiles, the landing's stone
  const lino = [kit.box(CORR.x0, CORR.x1, FLOOR - 0.06, FLOOR, CORR.z0, CORR.z1)];
  lino.push(kit.box(CORR.x1 - 0.01, OUTER.x0 + 0.01, FLOOR - 0.06, FLOOR + 0.012, DOOR.z0, DOOR.z1));
  lino.push(kit.box(CORR.x1 - 0.01, OUTER.x0 + 0.01, FLOOR - 0.06, FLOOR + 0.012, D.D305.z0, D.D305.z1));
  lino.push(kit.box(CORR.x0 - T - 0.01, CORR.x0 + 0.01, FLOOR - 0.06, FLOOR + 0.012, D.STAIR.z0, D.STAIR.z1));
  lino.push(kit.box(D.WC.x0, D.WC.x1, FLOOR - 0.06, FLOOR + 0.012, CORR.z1 - 0.01, WC.z0 + 0.01));
  lino.push(kit.box(LIFT.x0, LIFT.x1, FLOOR - 0.06, FLOOR, CORR.z0 - T - 0.01, CORR.z0 + 0.01));
  const corrFloor = kit.add(M(lino), mats.lino, { name: 'corridor_floor' });
  {
    const L = [];
    for (let z = CORR.z0 + 0.46; z < CORR.z1; z += 0.46) L.push(new THREE.BoxGeometry(CORR.x1 - CORR.x0, 0.002, 0.008).translate((CORR.x0 + CORR.x1) / 2, FLOOR + 0.0006, z));
    for (let x = CORR.x0 + 0.41; x < CORR.x1; x += 0.41) L.push(new THREE.BoxGeometry(0.008, 0.002, CORR.z1 - CORR.z0).translate(x, FLOOR + 0.0006, (CORR.z0 + CORR.z1) / 2));
    // the washroom's small tiles
    for (let z = WC.z0 + 0.2; z < WC.z1; z += 0.2) L.push(new THREE.BoxGeometry(WC.x1 - WC.x0, 0.002, 0.006).translate((WC.x0 + WC.x1) / 2, FLOOR + 0.0006, z));
    for (let x = WC.x0 + 0.2; x < WC.x1; x += 0.2) L.push(new THREE.BoxGeometry(0.006, 0.002, WC.z1 - WC.z0).translate(x, FLOOR + 0.0006, (WC.z0 + WC.z1) / 2));
    kit.add(M(L), mats.trim, { cast: false, noRay: true });
  }
  kit.piece();
  kit.add(kit.box(WC.x0, WC.x1, FLOOR - 0.06, FLOOR, WC.z0 - 0.01, WC.z1), mats.lino, { name: 'wc_floor' });
  kit.add(kit.box(D.GATE.x, CORR.x0 - T + 0.01, FLOOR - 0.06, FLOOR, LANDING.z0, LANDING.z1), mats.stone, { name: 'landing_floor' });
  out.floor = floor; out.corrFloor = corrFloor;
  kit.piece();
  // the ceilings: the rooms at CEIL, the corridor lower, the wall between
  kit.add(M([
    kit.box(OUTER.x0 - T, ROOM.x1 + T, CEIL, CEIL + 0.1, R305.z0 - T, ROOM.z1 + T),
    kit.box(WC.x0 - T, WC.x1 + T, CEIL - 0.25, CEIL + 0.1, WC.z0 - T, WC.z1 + T),
    kit.box(LANDING.x0 - T, CORR.x0, CEIL, CEIL + 0.1, LANDING.z0 - T, LANDING.z1 + T),
  ]), mats.ceil, { name: 'office_ceiling' });
  kit.add(kit.box(CORR.x0 - T, CORR.x1, CORR.ceil, CORR.ceil + 0.1, CORR.z0 - T, CORR.z1 + T), mats.ceil, { name: 'corridor_ceiling' });
  kit.add(kit.box(CORR.x0 - T, CORR.x1, CORR.ceil + 0.1, CEIL + 0.1, CORR.z0 - T, CORR.z1 + T), mats.ceil);

  // ---- mouldings -----------------------------------------------------------------------------
  kit.piece();
  const trims = [];
  const sk = (a, b, pad = 0.09) => [a - pad, b + pad];
  const base = (o) => trims.push(...strip({ y: FLOOR, d: 0.018, h: 0.16, ...o }));
  // Ames's room
  base({ axis: 'z', f: ROOM.x0, dir: 1, s: [ROOM.z0, ROOM.z1], skip: [sk(OPEN.z0, OPEN.z1)] });
  base({ axis: 'z', f: ROOM.x1, dir: -1, s: [ROOM.z0, ROOM.z1] });
  base({ axis: 'x', f: ROOM.z0, dir: 1, s: [ROOM.x0, ROOM.x1], skip: [sk(D.CONN.x0, D.CONN.x1)] });
  base({ axis: 'x', f: ROOM.z1, dir: -1, s: [ROOM.x0, ROOM.x1] });
  // the outer office
  base({ axis: 'z', f: OUTER.x0, dir: 1, s: [OUTER.z0, OUTER.z1], skip: [sk(DOOR.z0, DOOR.z1)] });
  base({ axis: 'z', f: OUTER.x1, dir: -1, s: [OUTER.z0, OUTER.z1], skip: [sk(OPEN.z0, OPEN.z1)] });
  base({ axis: 'x', f: OUTER.z0, dir: 1, s: [OUTER.x0, OUTER.x1] });
  base({ axis: 'x', f: OUTER.z1, dir: -1, s: [OUTER.x0, OUTER.x1] });
  // 305
  base({ axis: 'z', f: R305.x0, dir: 1, s: [R305.z0, R305.z1], skip: [sk(D.D305.z0, D.D305.z1)] });
  base({ axis: 'z', f: R305.x1, dir: -1, s: [R305.z0, R305.z1] });
  base({ axis: 'x', f: R305.z0, dir: 1, s: [R305.x0, R305.x1] });
  base({ axis: 'x', f: R305.z1, dir: -1, s: [R305.x0, R305.x1], skip: [sk(D.CONN.x0, D.CONN.x1)] });
  // the picture rails
  for (const [ax, f, dir, s] of [['z', ROOM.x0, 1, [ROOM.z0, ROOM.z1]], ['z', ROOM.x1, -1, [ROOM.z0, ROOM.z1]], ['x', ROOM.z0, 1, [ROOM.x0, ROOM.x1]], ['x', ROOM.z1, -1, [ROOM.x0, ROOM.x1]],
    ['z', OUTER.x0, 1, [OUTER.z0, OUTER.z1]], ['z', OUTER.x1, -1, [OUTER.z0, OUTER.z1]], ['x', OUTER.z0, 1, [OUTER.x0, OUTER.x1]], ['x', OUTER.z1, -1, [OUTER.x0, OUTER.x1]]]) {
    trims.push(...strip({ axis: ax, f, dir, s, y: CEIL - 0.42, d: 0.02, h: 0.035 }));
  }
  // the corridor: the wainscot (dark boards to 0.95 m), its dado rail, a baseboard
  const lockedSkip = (side) => LOCKED.filter((l) => l[2] === side).map(([, z]) => sk(z - 0.475, z + 0.475));
  const cSkipE = [sk(DOOR.z0, DOOR.z1), sk(SIDE.z0 - 0.02, SIDE.z1 + 0.02, 0), sk(D.D305.z0, D.D305.z1), ...lockedSkip('E')];
  const cSkipW = [...lockedSkip('W'), sk(D.STAIR.z0, D.STAIR.z1)];
  const wain = [];
  wain.push(...strip({ axis: 'z', f: CORR.x1, dir: -1, s: [CORR.z0, CORR.z1], y: FLOOR, d: 0.012, h: 0.95, skip: cSkipE }));
  wain.push(...strip({ axis: 'z', f: CORR.x0, dir: 1, s: [CORR.z0, CORR.z1], y: FLOOR, d: 0.012, h: 0.95, skip: cSkipW }));
  wain.push(...strip({ axis: 'x', f: CORR.z0, dir: 1, s: [CORR.x0, CORR.x1], y: FLOOR, d: 0.012, h: 0.95, skip: [sk(LIFT.x0, LIFT.x1, 0.1)] }));
  wain.push(...strip({ axis: 'x', f: CORR.z1, dir: -1, s: [CORR.x0, CORR.x1], y: FLOOR, d: 0.012, h: 0.95, skip: [sk(D.WC.x0, D.WC.x1)] }));
  // the washroom: white tiles to 1.4 m (a pale wainscot)
  wain.push(...strip({ axis: 'z', f: WC.x0, dir: 1, s: [WC.z0, WC.z1], y: FLOOR, d: 0.01, h: 1.4 }));
  wain.push(...strip({ axis: 'z', f: WC.x1, dir: -1, s: [WC.z0, WC.z1], y: FLOOR, d: 0.01, h: 1.4 }));
  wain.push(...strip({ axis: 'x', f: WC.z1, dir: -1, s: [WC.x0, WC.x1], y: FLOOR, d: 0.01, h: 1.4 }));
  kit.add(M(wain), mats.wainscot, { name: 'corridor_wainscot', noRay: true });
  kit.piece();
  trims.push(...strip({ axis: 'z', f: CORR.x1 - 0.012, dir: -1, s: [CORR.z0, CORR.z1], y: 0.95, d: 0.03, h: 0.05, skip: cSkipE }));
  trims.push(...strip({ axis: 'z', f: CORR.x0 + 0.012, dir: 1, s: [CORR.z0, CORR.z1], y: 0.95, d: 0.03, h: 0.05, skip: cSkipW }));
  trims.push(...strip({ axis: 'x', f: CORR.z0 + 0.012, dir: 1, s: [CORR.x0, CORR.x1], y: 0.95, d: 0.03, h: 0.05, skip: [sk(LIFT.x0, LIFT.x1, 0.1)] }));
  trims.push(...strip({ axis: 'x', f: CORR.z1 - 0.012, dir: -1, s: [CORR.x0, CORR.x1], y: 0.95, d: 0.03, h: 0.05, skip: [sk(D.WC.x0, D.WC.x1)] }));
  // the casings: every door (both faces), the sidelight, the opening, the lift
  const cas = (o) => trims.push(...casing(o));
  const both = (axis, f0, f1, s, y) => { cas({ axis, f: f0, dir: -1, s, y, w: 0.085 }); cas({ axis, f: f1, dir: 1, s, y, w: 0.085 }); };
  both('z', CORR.x1, OUTER.x0, [DOOR.z0, DOOR.z1], [FLOOR, DOOR.transom[1]]);
  cas({ axis: 'z', f: CORR.x1, dir: -1, s: [SIDE.z0, SIDE.z1], y: [SIDE.y0, SIDE.y1], w: 0.07, sill: true });
  cas({ axis: 'z', f: OUTER.x0, dir: 1, s: [SIDE.z0, SIDE.z1], y: [SIDE.y0, SIDE.y1], w: 0.07, sill: true });
  both('z', CORR.x1, OUTER.x0, [D.D305.z0, D.D305.z1], [FLOOR, DH]);
  both('z', CORR.x0 - T, CORR.x0, [D.STAIR.z0, D.STAIR.z1], [FLOOR, DH]);
  both('x', CORR.z1, CORR.z1 + T, [D.WC.x0, D.WC.x1], [FLOOR, DH]);
  both('x', R305.z1, ROOM.z0, [D.CONN.x0, D.CONN.x1], [FLOOR, DH]);
  both('z', OUTER.x1, ROOM.x0, [OPEN.z0, OPEN.z1], [FLOOR, OPEN.h]);
  for (const [, z, side] of LOCKED) cas({ axis: 'z', f: side === 'E' ? CORR.x1 : CORR.x0, dir: side === 'E' ? -1 : 1, s: [z - 0.475, z + 0.475], y: [FLOOR, DH], w: 0.085 });
  cas({ axis: 'x', f: CORR.z0, dir: 1, s: [LIFT.x0, LIFT.x1], y: [FLOOR, 2.25], w: 0.1, d: 0.04 });
  // the windows' casings and sills (room side)
  cas({ axis: 'z', f: ROOM.x1, dir: -1, s: [WIN.z0, WIN.z1], y: [WIN.y0, WIN.y1], w: 0.09, sill: true, sillD: 0.12 });
  cas({ axis: 'z', f: ROOM.x1, dir: -1, s: [WIN305.z0, WIN305.z1], y: [WIN305.y0, WIN305.y1], w: 0.09, sill: true, sillD: 0.12 });
  cas({ axis: 'x', f: ROOM.z1, dir: -1, s: [ESC.x0, ESC.x1], y: [ESC.y0, ESC.y1], w: 0.08, sill: true, sillD: 0.1 });
  const trimMesh = kit.add(M(trims), mats.trim, { name: 'office_trim' });
  trimMesh.userData.cover = { kind: 'thin' };

  // ---- the look volumes, the dry volumes ------------------------------------------------------
  const B3 = (x0, x1, z0, z1, y0 = FLOOR - 0.3, y1 = CEIL + 0.3) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  out.roomBox = B3(ROOM.x0 - 0.02, ROOM.x1 + 0.1, ROOM.z0 - 0.02, ROOM.z1 + 0.02);
  out.outerBox = B3(OUTER.x0 - 0.02, OUTER.x1 + 0.02, OUTER.z0 - 0.02, OUTER.z1 + 0.02);
  out.r305Box = B3(R305.x0 - 0.02, R305.x1 + 0.1, R305.z0 - 0.02, R305.z1 + 0.02);
  out.corrBox = B3(CORR.x0 - 0.02, CORR.x1 + 0.02, CORR.z0 - 0.02, CORR.z1 + 0.02);
  out.wcBox = B3(WC.x0 - 0.02, WC.x1 + 0.02, WC.z0 - 0.02, WC.z1 + 0.02);
  out.landBox = B3(LANDING.x0 - 0.02, CORR.x0 - T + 0.02, LANDING.z0 - 0.02, LANDING.z1 + 0.02, -3, CEIL + 0.3);
  out.liftBox = B3(LIFT.x0 - 0.02, LIFT.x1 + 0.02, LIFT.z0 - 0.02, CORR.z0 - T + 0.02, -4, CEIL + 0.3);
  return out;
}
