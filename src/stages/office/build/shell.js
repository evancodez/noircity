import * as THREE from 'three';
import { wallGeos, wallColliders, strip, casing } from './walls.js';
import { FLOOR, CEIL, T, ROOM, CORR, DOOR, SIDE, DOORS, STAIRS, LIFT, WIN, ESC, SAFE } from '../plan.js';
import { mergeGeos } from '../../../props/lib.js';

// The shell: the room's four walls and the corridor's, floors, ceilings,
// the mouldings (baseboards, the corridor's wainscot and dado rail, the
// room's picture rail), the casings round every opening, and the walls'
// colliders (the holes a man walks through left open).
const M = (list) => mergeGeos(list);

export function buildShell(kit, mats, stage) {
  const C = stage.colliders;
  const out = {};
  // ---- the walls -----------------------------------------------------------------------
  // the corridor wall: the room's west wall and the corridor's east one
  const cw = {
    axis: 'z', a: [-0.14, 0], s: [CORR.z0 - T, ROOM.z1 + T], y: [FLOOR, CEIL],
    holes: [
      [DOOR.z0, DOOR.z1, FLOOR, DOOR.transom[1], 'open'],
      [SIDE.z0, SIDE.z1, SIDE.y0, SIDE.y1],
      ...DOORS.filter((d) => d[2] === 'E').map(([, z]) => [z - 0.475, z + 0.475, FLOOR, DOOR.h]),
    ],
  };
  const west = { axis: 'z', a: [CORR.x0 - T, CORR.x0], s: [CORR.z0 - T, CORR.z1 + T], y: [FLOOR, CEIL], holes: [
    ...DOORS.filter((d) => d[2] === 'W').map(([, z]) => [z - 0.475, z + 0.475, FLOOR, DOOR.h]),
    [STAIRS.z0, STAIRS.z1, FLOOR, DOOR.h, 'open'],
  ] };
  const south = { axis: 'x', a: [CORR.z0 - T, CORR.z0], s: [CORR.x0 - T, CORR.x1], y: [FLOOR, CEIL], holes: [[LIFT.x0, LIFT.x1, FLOOR, 2.25]] };
  const north = { axis: 'x', a: [CORR.z1, CORR.z1 + T], s: [CORR.x0 - T, CORR.x1], y: [FLOOR, CEIL], holes: [] };
  const rs = { axis: 'x', a: [ROOM.z0 - T, ROOM.z0], s: [-0.14, ROOM.x1 + T], y: [FLOOR, CEIL], holes: [[SAFE.x - SAFE.w / 2, SAFE.x + SAFE.w / 2, SAFE.y - SAFE.h / 2, SAFE.y + SAFE.h / 2]] };
  const rn = { axis: 'x', a: [ROOM.z1, ROOM.z1 + T], s: [-0.14, ROOM.x1 + T], y: [FLOOR, CEIL], holes: [[ESC.x0, ESC.x1, ESC.y0, ESC.y1]] };
  const re = { axis: 'z', a: [ROOM.x1, ROOM.x1 + T], s: [ROOM.z0, ROOM.z1], y: [FLOOR, CEIL], holes: [[WIN.z0, WIN.z1, WIN.y0, WIN.y1]] };
  kit.piece();
  const roomWalls = kit.add(M([...wallGeos(rs), ...wallGeos(rn), ...wallGeos(re)]), mats.plaster, { name: 'office_walls' });
  const cwMesh = kit.add(M(wallGeos(cw)), mats.plaster, { name: 'office_corridorWall' });
  kit.piece();
  const corrWalls = kit.add(M([...wallGeos(west), ...wallGeos(south), ...wallGeos(north)]), mats.plasterDark, { name: 'corridor_walls' });
  // the transom bar over 304's door
  kit.add(kit.box(-0.14, 0, DOOR.h, DOOR.transom[0], DOOR.z0, DOOR.z1), mats.plaster);
  for (const w of [cw, west, south, north]) wallColliders(C, w, 'wall');
  for (const w of [rs, rn, re]) wallColliders(C, w, 'wall');
  out.walls = { roomWalls, cwMesh, corrWalls };

  // ---- floors and ceilings ------------------------------------------------------------
  kit.piece();
  const floor = kit.add(kit.box(ROOM.x0, ROOM.x1, FLOOR - 0.06, FLOOR, ROOM.z0, ROOM.z1), mats.boards, { name: 'office_floor' });
  // the boards: a seam every 0.11 m along x (a shallow groove the ink reads)
  {
    const seams = [];
    for (let x = ROOM.x0 + 0.11; x < ROOM.x1 - 0.05; x += 0.11) seams.push(new THREE.BoxGeometry(0.006, 0.004, ROOM.z1 - ROOM.z0).translate(x, FLOOR + 0.0005, (ROOM.z0 + ROOM.z1) / 2));
    kit.add(M(seams), mats.trim, { cast: false });
  }
  kit.piece();
  kit.add(kit.box(-0.14, 0, FLOOR - 0.06, FLOOR + 0.012, DOOR.z0, DOOR.z1), mats.trim);   // the threshold
  const corrFloor = kit.add(kit.box(CORR.x0, CORR.x1, FLOOR - 0.06, FLOOR, CORR.z0, CORR.z1), mats.lino, { name: 'corridor_floor' });
  // the lino's tiles: a darker line every 0.46 m both ways
  {
    const L = [];
    for (let z = CORR.z0 + 0.46; z < CORR.z1; z += 0.46) L.push(new THREE.BoxGeometry(CORR.x1 - CORR.x0, 0.002, 0.008).translate((CORR.x0 + CORR.x1) / 2, FLOOR + 0.0006, z));
    for (let x = CORR.x0 + 0.465; x < CORR.x1; x += 0.465) L.push(new THREE.BoxGeometry(0.008, 0.002, CORR.z1 - CORR.z0).translate(x, FLOOR + 0.0006, (CORR.z0 + CORR.z1) / 2));
    kit.add(M(L), mats.trim, { cast: false });
  }
  kit.piece();
  kit.add(kit.box(ROOM.x0 - 0.14, ROOM.x1 + T, CEIL, CEIL + 0.1, ROOM.z0 - T, ROOM.z1 + T), mats.ceil, { name: 'office_ceiling' });
  kit.add(kit.box(CORR.x0 - T, CORR.x1, CORR.ceil, CORR.ceil + 0.1, CORR.z0 - T, CORR.z1 + T), mats.ceil, { name: 'corridor_ceiling' });
  // (the corridor's ceiling is lower: the wall above it, to the room's)
  kit.add(kit.box(CORR.x0 - T, CORR.x1, CORR.ceil + 0.1, CEIL + 0.1, CORR.z0 - T, CORR.z1 + T), mats.ceil);
  out.floor = floor; out.corrFloor = corrFloor;

  // ---- mouldings -----------------------------------------------------------------------------
  kit.piece();
  const trims = [];
  // the room: a tall baseboard and a picture rail
  const doorSkip = [[DOOR.z0 - 0.09, DOOR.z1 + 0.09]];
  trims.push(...strip({ axis: 'z', f: 0, dir: 1, s: [ROOM.z0, ROOM.z1], y: FLOOR, d: 0.018, h: 0.16, skip: doorSkip }));
  trims.push(...strip({ axis: 'z', f: ROOM.x1, dir: -1, s: [ROOM.z0, ROOM.z1], y: FLOOR, d: 0.018, h: 0.16 }));
  trims.push(...strip({ axis: 'x', f: ROOM.z0, dir: 1, s: [ROOM.x0, ROOM.x1], y: FLOOR, d: 0.018, h: 0.16 }));
  trims.push(...strip({ axis: 'x', f: ROOM.z1, dir: -1, s: [ROOM.x0, ROOM.x1], y: FLOOR, d: 0.018, h: 0.16 }));
  for (const [ax, f, dir, s] of [['z', 0, 1, [ROOM.z0, ROOM.z1]], ['z', ROOM.x1, -1, [ROOM.z0, ROOM.z1]], ['x', ROOM.z0, 1, [ROOM.x0, ROOM.x1]], ['x', ROOM.z1, -1, [ROOM.x0, ROOM.x1]]]) {
    trims.push(...strip({ axis: ax, f, dir, s, y: CEIL - 0.42, d: 0.02, h: 0.035 }));
  }
  // the corridor: the wainscot (dark boards to 0.95 m), its dado rail, a baseboard
  const cSkipE = [[DOOR.z0 - 0.09, DOOR.z1 + 0.09], ...DOORS.filter((d) => d[2] === 'E').map(([, z]) => [z - 0.56, z + 0.56])];
  const cSkipW = [...DOORS.filter((d) => d[2] === 'W').map(([, z]) => [z - 0.56, z + 0.56]), [STAIRS.z0 - 0.09, STAIRS.z1 + 0.09]];
  const wain = [];
  wain.push(...strip({ axis: 'z', f: -0.14, dir: -1, s: [CORR.z0, CORR.z1], y: FLOOR, d: 0.012, h: 0.95, skip: [...cSkipE, [SIDE.z0 - 0.02, SIDE.z1 + 0.02]] }));
  wain.push(...strip({ axis: 'z', f: CORR.x0, dir: 1, s: [CORR.z0, CORR.z1], y: FLOOR, d: 0.012, h: 0.95, skip: cSkipW }));
  wain.push(...strip({ axis: 'x', f: CORR.z0, dir: 1, s: [CORR.x0, CORR.x1], y: FLOOR, d: 0.012, h: 0.95, skip: [[LIFT.x0 - 0.1, LIFT.x1 + 0.1]] }));
  wain.push(...strip({ axis: 'x', f: CORR.z1, dir: -1, s: [CORR.x0, CORR.x1], y: FLOOR, d: 0.012, h: 0.95 }));
  kit.add(M(wain), mats.wainscot, { name: 'corridor_wainscot' });
  kit.piece();
  trims.push(...strip({ axis: 'z', f: -0.152, dir: -1, s: [CORR.z0, CORR.z1], y: 0.95, d: 0.03, h: 0.05, skip: cSkipE }));
  trims.push(...strip({ axis: 'z', f: CORR.x0 + 0.012, dir: 1, s: [CORR.z0, CORR.z1], y: 0.95, d: 0.03, h: 0.05, skip: cSkipW }));
  trims.push(...strip({ axis: 'x', f: CORR.z0 + 0.012, dir: 1, s: [CORR.x0, CORR.x1], y: 0.95, d: 0.03, h: 0.05, skip: [[LIFT.x0 - 0.1, LIFT.x1 + 0.1]] }));
  trims.push(...strip({ axis: 'x', f: CORR.z1 - 0.012, dir: -1, s: [CORR.x0, CORR.x1], y: 0.95, d: 0.03, h: 0.05 }));
  // the casings: 304's door and sidelight (both faces), the other doors, the stairs, the lift
  const cas = (o) => trims.push(...casing(o));
  cas({ axis: 'z', f: 0, dir: 1, s: [DOOR.z0, DOOR.z1], y: [FLOOR, DOOR.transom[1]], w: 0.085 });
  cas({ axis: 'z', f: -0.14, dir: -1, s: [DOOR.z0, DOOR.z1], y: [FLOOR, DOOR.transom[1]], w: 0.085 });
  cas({ axis: 'z', f: 0, dir: 1, s: [SIDE.z0, SIDE.z1], y: [SIDE.y0, SIDE.y1], w: 0.07, sill: true });
  cas({ axis: 'z', f: -0.14, dir: -1, s: [SIDE.z0, SIDE.z1], y: [SIDE.y0, SIDE.y1], w: 0.07, sill: true });
  for (const [, z, side] of DOORS) cas({ axis: 'z', f: side === 'E' ? -0.14 : CORR.x0, dir: side === 'E' ? -1 : 1, s: [z - 0.475, z + 0.475], y: [FLOOR, DOOR.h], w: 0.085 });
  cas({ axis: 'z', f: CORR.x0, dir: 1, s: [STAIRS.z0, STAIRS.z1], y: [FLOOR, DOOR.h], w: 0.085 });
  cas({ axis: 'x', f: CORR.z0, dir: 1, s: [LIFT.x0, LIFT.x1], y: [FLOOR, 2.25], w: 0.1, d: 0.04 });
  // the windows' casings and sills (room side)
  cas({ axis: 'z', f: ROOM.x1, dir: -1, s: [WIN.z0, WIN.z1], y: [WIN.y0, WIN.y1], w: 0.09, sill: true, sillD: 0.12 });
  cas({ axis: 'x', f: ROOM.z1, dir: -1, s: [ESC.x0, ESC.x1], y: [ESC.y0, ESC.y1], w: 0.08, sill: true, sillD: 0.1 });
  kit.add(M(trims), mats.trim, { name: 'office_trim' });

  // ---- the look volumes, the dry volumes, the floor --------------------------------------------
  out.roomBox = new THREE.Box3(new THREE.Vector3(ROOM.x0 - 0.02, FLOOR - 0.3, ROOM.z0 - 0.02), new THREE.Vector3(ROOM.x1 + 0.1, CEIL + 0.3, ROOM.z1 + 0.02));
  out.corrBox = new THREE.Box3(new THREE.Vector3(CORR.x0 - 0.02, FLOOR - 0.3, CORR.z0 - 0.02), new THREE.Vector3(0.02, CEIL + 0.3, CORR.z1 + 0.02));
  return out;
}
