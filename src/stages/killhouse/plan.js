// The killhouse (lane C2): the gun kit's own test bed. Not a place of the
// story: two rooms and a corridor behind a street front, a lobby, and a short
// piece of wet street with two parked cars. Every number of it is here.
// World metres, y up. The street is y 0; the pavements and the house's
// floor are y 0.15 (FLOOR).
//
//   -z  the back (the back door out of the corridor's end)
//   +z  the street (the front wall at z 6, the road z 8.4 .. 16)
//   -x  room A (the office: the desk, the cabinets, the crates)
//   +x  room B (the bar: the counter, the back bar, the crates, the barrels)
//
//          z -8  +-----------------+bd+-------------------------+
//                |  room A         |C |   room B (the bar)      |
//                |  cabinets       |o |   back bar ===========  |
//                |                 |r |   counter  ======       |
//                |   crates        |r |                         |
//                |        desk     A1 B1        crates   barrels|
//                |                 |i |                         |
//          z  1  +--A2-------------+d +=frosted=B2=frosted======+
//                |   lobby        reception         bench       |
//          z  6  +=====win=========SD======win==================+
//                    pavement (lamp)        (hydrant)    (crates)
//                    road   car 1                  car 2
//                    far pavement      (lamp)
//          z 18  ======== the warehouse wall, its loading door =====
export const FLOOR = 0.15;          // the house's floor and the pavements
export const CEIL = 3.25;           // the house's ceiling (world y)
export const T = 0.16;              // a wall's thickness

export const HOUSE = { x0: -9, x1: 9, z0: -8, z1: 6 };
// the corridor between the rooms, from the lobby to the back door
export const CORR = { x0: -1.2, x1: 0.4, z0: -8, z1: 1 };
export const ROOM_A = { x0: -9, x1: -1.2, z0: -8, z1: 1 };
export const ROOM_B = { x0: 0.4, x1: 9, z0: -8, z1: 1 };
export const LOBBY = { x0: -9, x1: 9, z0: 1, z1: 6 };

// the doors: hinge at h (x, z), the leaf `w` long, shut along `axis`
// ('z': the leaf runs along z, in a wall at x = const), opening by `open`
// (rad, + turns it toward +x for an axis 'z' door's leaf pointing +z ...)
// `swing` is the sign of the turn that opens it into the room it leads to.
// in: the side it opens toward (a point a step inside), out: a step outside
export const DOORS = {
  // room A's door to the corridor (in the wall x = -1.2)
  A1: { axis: 'z', x: CORR.x0, z0: -4.6, z1: -3.6, swing: -1, inside: { x: -2.0, z: -4.1 }, outside: { x: -0.4, z: -4.1 }, glass: false },
  // room A's door to the lobby (in the wall z = 1)
  A2: { axis: 'x', z: ROOM_A.z1, x0: -7.6, x1: -6.6, swing: 1, inside: { x: -7.1, z: 0.2 }, outside: { x: -7.1, z: 1.9 }, glass: false },
  // room B's door to the corridor (in the wall x = 0.4)
  B1: { axis: 'z', x: CORR.x1, z0: -1.6, z1: -0.6, swing: 1, inside: { x: 1.2, z: -1.1 }, outside: { x: -0.4, z: -1.1 }, glass: false },
  // room B's door in the frosted partition (z = 1), glazed
  B2: { axis: 'x', z: ROOM_B.z1, x0: 4.2, x1: 5.2, swing: 1, inside: { x: 4.7, z: 0.2 }, outside: { x: 4.7, z: 1.9 }, glass: true },
  // the street door (z = 6), glazed in its top half
  SD: { axis: 'x', z: HOUSE.z1, x0: -1.1, x1: 0.1, swing: -1, inside: { x: -0.5, z: 5.1 }, outside: { x: -0.5, z: 7.0 }, glass: true },
  // the back door at the corridor's end (z = -8)
  BD: { axis: 'x', z: HOUSE.z0, x0: -0.9, x1: 0.1, swing: -1, inside: { x: -0.4, z: -7.2 }, outside: { x: -0.4, z: -9.2 }, glass: false },
};
export const DOOR_H = 2.15;

// the frosted partition between room B and the lobby (z = 1): a wood dado
// to 1.0 m, frosted panes over it to 2.45, the door B2 in it
export const PARTITION = { z: ROOM_B.z1, x0: CORR.x1, x1: HOUSE.x1, dado: FLOOR + 1.0, top: FLOOR + 2.45, panes: [[0.6, 2.2], [2.3, 4.1], [5.3, 7.0], [7.1, 8.85]] };

// the front's windows (z = 6): [x0, x1], sill and head (world y)
export const WINDOWS = [[-7.2, -3.4], [2.2, 6.6]];
export const WIN_Y = [FLOOR + 0.95, FLOOR + 2.55];

// ---- the furniture (every piece of it is cover of a kind) ----------------------------------
// the desk in room A: its front (the side it tips toward) faces +x, the door A1
export const DESK = { x: -5.0, z: -3.9, w: 1.7, d: 0.95, h: 0.78 };           // w along z, d along x
export const CABINETS = [[-7.9, -7.45], [-7.3, -7.45], [-6.7, -7.45]];          // filing cabinets (x, z) on the north wall
export const CABINET = { w: 0.48, d: 0.62, h: 1.36 };
// by the door A1: a tall steel cabinet (the teach's bottles on its top), an armchair
export const CAB_E = { x: -1.82, z: -6.75 };
export const CHAIR_A = { x: -2.55, z: -1.35, w: 0.82, d: 0.8, h: FLOOR + 0.92, yaw: -0.5 };
// the jambs' corners: a man stands beside a doorway, the wall between us,
// and steps into it to shoot (the gun kit's cover points: { x, z, nx, nz })
export const CORNERS = [
  { x: -0.72, z: -5.0, nx: 1, nz: 0 }, { x: -0.72, z: -3.2, nx: 1, nz: 0 },        // A1, the corridor's side
  { x: -0.12, z: -2.0, nx: -1, nz: 0 }, { x: -0.12, z: -0.2, nx: -1, nz: 0 },      // B1, the corridor's side
  { x: 3.75, z: 1.62, nx: 0, nz: 1 }, { x: 5.65, z: 1.62, nx: 0, nz: 1 },          // B2, the lobby's side
  { x: -8.05, z: 1.62, nx: 0, nz: 1 }, { x: -6.15, z: 1.62, nx: 0, nz: 1 },        // A2, the lobby's side
  { x: -1.55, z: 6.72, nx: 0, nz: 1 }, { x: 0.55, z: 6.72, nx: 0, nz: 1 },         // the street door, outside
];
// crates: [x, z, size, height, yaw]
export const CRATES_A = [[-7.8, -1.6, 0.85, 0.85, 0.1], [-7.75, -0.7, 0.8, 0.8, -0.08], [-7.85, -1.2, 0.75, 0.75, 0.3, 0.85]];
// the bar in room B: the counter along x (its front faces +z, the room)
export const COUNTER = { x0: 2.3, x1: 7.6, z: -4.6, d: 0.62, h: FLOOR + 1.08 };
export const BACKBAR = { x0: 2.0, x1: 8.2, z: -7.62, d: 0.5, h: FLOOR + 0.95, shelf: FLOOR + 1.9 };
export const CRATES_B = [[2.6, -0.9, 0.9, 0.9, 0.05], [3.5, -0.85, 0.9, 0.9, -0.1], [3.05, -0.95, 0.8, 0.8, 0.2, 0.9]];
export const BARRELS_B = [[7.7, -0.6], [8.35, -1.05], [7.9, -1.45]];
export const TABLES_B = [[5.6, -2.1]];
// the lobby: the reception counter (an L of panelled wood), a bench
export const RECEPTION = { x0: -4.6, x1: -2.4, z0: 3.0, z1: 3.6, h: FLOOR + 1.05 };
export const BENCH = { x0: 5.4, x1: 7.6, z: 5.4, d: 0.5, h: FLOOR + 0.45 };

// ---- the street ----------------------------------------------------------------------------
export const STREET = { x0: -22, x1: 22, pave0: HOUSE.z1 + T, kerb: 8.4, farKerb: 16, farPave: 18, wall: 18.2 };
export const CARS = [
  { x: -5.6, z: 9.35, yaw: 0.02, paint: 'paint' },
  { x: 5.2, z: 14.9, yaw: Math.PI + 0.04, paint: 'paintGrey' },
  { x: -14.5, z: 15.0, yaw: Math.PI - 0.06, paint: 'paint' },
  { x: 14.2, z: 9.35, yaw: 0.05, paint: 'paint' },
];
export const STREET_CRATES = [[9.2, 7.25, 0.9, 0.9, 0.12], [10.05, 7.4, 0.85, 0.85, -0.1], [9.6, 7.3, 0.8, 0.8, 0.3, 0.9]];
export const HYDRANT = { x: -1.9, z: 7.95 };
export const POSTS = [{ x: -10.5, z: 7.95, yaw: 0 }, { x: 11.5, z: 16.45, yaw: Math.PI }];
// the warehouse across the street: its openings - the loading door, two
// alleys' mouths - each with a dark recess behind it, wider than the
// opening: the men wait there out of sight (the street's ends are fenced)
export const OPENINGS = [{ x0: -2.5, x1: 1.5, h: 3.3, name: 'bay' }, { x0: -13.8, x1: -11.9, h: 3.0, name: 'alleyW' }, { x0: 10.9, x1: 12.8, h: 3.0, name: 'alleyE' }];
export const LOADING = OPENINGS[0];
export const RECESS = { depth: 3.2, side: 2.4 };
export const BOUNDS = { minX: -22, maxX: 22, minZ: -12.6, maxZ: 21.6 };
// [C2] after the critic's second look (behind the back door: an empty plain,
// an invisible wall, a way round the house's ends into the street): the house
// in a terrace - a brick block either side (x to +-22.5, 5.6 m), from the
// street back to the yard's wall (z0) - and a walled yard behind it (parts/yard.js)
export const YARD = { z0: -12.3, wallH: 2.8, blockX0: -22.5, blockX1: 22.5, blockH: 5.6, bins: [[1.15, -8.75], [1.75, -8.8]] };
