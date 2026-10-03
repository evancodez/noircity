// The Harbor Building, third floor: the site plan of the office stage as
// numbers (lane B2; [C5] wave C: the floor made bigger and finished - Ames's
// suite, the outer office, 305 next door, the corridor with its lift and its
// stair, a washroom). Everything of the stage and of chapters III and IV
// reads them from here. World metres, y up; the floor of the third floor is
// y = 0 (the Hoods, the blood, the casings all stand on y = 0 as on the
// block's street), the street below is at y = STREET.y.
//
//   -x  the corridor ............ +x  the street window (the street below)
//   -z  the lift, the stairs .... +z  the fire escape (the light well)
//
//  z  9.3  +--------+
//          |  WC    |
//  z  7.0  +--wc----+------------------+----------------------------+
//          |        |  OUTER OFFICE    |   AMES'S ROOM (ROOM)        |  (escape window, north)
//          |        |  files           |   cabinets         fan     |
//          |        S  bench    desk   O   (opening)    desk  Ames  W  (street window, east)
//          |  CORR  A                  O                             |
//          |        |  bench           |   picture/safe     CONN    |
//  z  0.0  |        +------------------+----------------------------+
//          |        305d       ROOM 305 (dust sheets)               |
//  z -4.8  |stair   +---------------------------------------------- +
//          |        |306 (locked)
//  z -7.2  +--lift--+
//
// x: the corridor -5.6 .. -3.96, the outer office -3.8 .. -0.16, Ames's
// room 0 .. 5.6 (the building's face at 5.76).
export const FLOOR = 0;
export const CEIL = 3.1;
export const T = 0.16;                     // a wall's thickness

// Ames's own room (the old room 304: its street window, its fire escape)
export const ROOM = { x0: 0, x1: 5.6, z0: 0, z1: 7.0 };
// the outer office (the frosted door J. AMES - INVESTIGATIONS from the corridor)
export const OUTER = { x0: -3.8, x1: -0.16, z0: 0, z1: 7.0 };
// the wide opening between the outer office and Ames's room (the wall x -0.16 .. 0)
export const OPEN = { z0: 2.5, z1: 4.3, h: 2.35 };
// 305 next door: empty, dust sheets (its own corridor door, the connecting door into Ames's room)
export const R305 = { x0: -3.8, x1: 5.6, z0: -4.8, z1: -0.16 };
// the corridor: west of the suite, from the lift (south) to the washroom (north)
export const CORR = { x0: -5.6, x1: -3.96, z0: -7.2, z1: 7.0, ceil: 2.95 };
// the washroom at the corridor's north end
export const WC = { x0: -5.6, x1: -3.96, z0: 7.16, z1: 9.3 };
// the stair's landing behind its door (west of the corridor): the flight down to a locked gate
export const LANDING = { x0: -9.4, x1: -5.76, z0: -6.6, z1: -3.6 };
// the lift's car behind its cage at the corridor's south end
export const LIFT = { x0: -5.22, x1: -4.34, z0: -8.75, z1: -7.36 };

// the suite's front door in the corridor wall (x = CORR.x1 .. OUTER.x0):
// hinged at z0, it opens into the outer office; its frosted pane, the
// transom over it; the frosted sidelight north of it
export const DOOR = { z0: 2.9, z1: 3.85, h: 2.15, glass: [1.05, 1.95], transom: [2.24, 2.62] };
export const SIDE = { z0: 4.15, z1: 5.35, y0: 1.0, y1: 2.28 };
// the doors the gun kit and the player use: { axis, x | z, z0 z1 | x0 x1, swing, inside, outside, glass, locked }
// (swing: the sign of the turn that opens it; the leaf goes toward `inside`, `outside` the other side)
const WX = (CORR.x1 + OUTER.x0) / 2;       // the corridor's east wall's middle
export const DOORS = {
  // the suite's front door (frosted; the kit door's 'AMES')
  AMES: { axis: 'z', x: WX, z0: DOOR.z0, z1: DOOR.z1, swing: 1, inside: { x: -3.1, z: 3.4 }, outside: { x: -4.75, z: 3.4 }, glass: 'ames' },
  // 305's corridor door
  D305: { axis: 'z', x: WX, z0: -2.35, z1: -1.4, swing: 1, inside: { x: -3.1, z: -1.9 }, outside: { x: -4.75, z: -1.9 }, glass: '305' },
  // the connecting door between 305 and Ames's room (in Ames's south wall, z -0.16 .. 0): opens into 305
  CONN: { axis: 'x', z: -0.08, x0: 4.25, x1: 5.15, swing: 1, inside: { x: 4.7, z: -0.9 }, outside: { x: 4.7, z: 0.8 }, glass: null },
  // the stair door (the corridor's west wall): opens onto the landing
  STAIR: { axis: 'z', x: CORR.x0 - T / 2, z0: -5.45, z1: -4.5, swing: -1, inside: { x: -6.6, z: -5.0 }, outside: { x: -4.75, z: -5.0 }, glass: 'stair' },
  // the washroom (the corridor's north wall)
  // (it opens out into the corridor: a washroom's door, kept out of its own small room)
  WC: { axis: 'x', z: CORR.z1 + T / 2, x0: -5.25, x1: -4.35, swing: 1, inside: { x: -4.8, z: 6.2 }, outside: { x: -4.8, z: 7.85 }, glass: 'wc' },
  // the grille gate across the head of the flight down (locked: the men below have the key)
  GATE: { axis: 'z', x: -7.15, z0: -5.55, z1: -4.45, swing: 1, inside: { x: -6.5, z: -5.0 }, outside: { x: -7.8, z: -5.0 }, glass: null, grille: true },
};
// the corridor's other doors: locked, they rattle ([name, z centre, side, name on the glass, trade])
export const LOCKED = [
  ['301', 4.4, 'W', 'H. GRUBER', 'DENTAL SURGEON'],
  ['302', 1.1, 'W', 'R. KOVAC', 'NOTARY PUBLIC'],
  ['303', -2.0, 'W', 'ATLAS', 'INSURANCE CO.'],
  ['306', -6.1, 'E', 'J. DUBOIS', 'IMPORTS'],
];
// the corridor's two globes: one near the suite's door, one at the lift's end (a pool, a dark between)
export const CORR_LAMP = { x: -4.78, z: 3.0 };
export const CORR_LAMP2 = { x: -4.78, z: -5.3 };

// the street window: east wall; the blind covers it from its head
export const WIN = { z0: 3.25, z1: 5.05, y0: 0.82, y1: 2.5 };
// 305's street window (its blind down)
export const WIN305 = { z0: -3.4, z1: -1.6, y0: 0.82, y1: 2.5 };
// the fire-escape window: north wall, the lower sash half up
export const ESC = { x0: 2.35, x1: 3.35, y0: 0.72, y1: 2.32, open: 0.62 };
// the landing outside it and the stairs down (west) to the floor below
export const LAND = { x0: 1.15, x1: 4.75, z0: 7.2, z1: 8.45, y: -0.06 };
export const FLIGHT = { x0: -1.95, x1: 1.15, y0: -3.2, y1: -0.06, z0: 7.3, z1: 8.0 };

// the furniture of Ames's room
export const DESK = { x: 3.95, z: 3.72, w: 1.62, d: 0.86, h: 0.78 };          // w along z, d along x
// (the pad in the banker's lamp's pool: close under its shade, the brightest thing on the desk)
export const PAD = { x: 3.92, z: 3.9, w: 0.215, d: 0.28 };                   // on the blotter
export const PENCIL = { x: 3.9, z: 3.66 };
export const LAMP = { x: 4.12, z: 4.28 };                                    // the banker's lamp
// Ames's chair, behind the desk (he died in it)
export const CHAIR = { x: 4.72, z: 3.62 };
export const CABS = [0.52, 1.02, 1.52];                                       // filing cabinets' x (north wall)
export const CAB = { w: 0.46, d: 0.66, h: 1.34 };
export const COOLER = { x: -2.75, z: 0.42 };                                 // (in the outer office now, by the clients' bench)
export const STAND = { x: 0.42, z: 5.75 };                                   // the coat stand (his hat on it)
export const PICTURE = { x: 2.75, y: 1.5, w: 0.66, h: 0.52, tilt: 0 };       // south wall: hinged, over the safe
export const SAFE = { x: 2.75, y: 1.48, w: 0.42, h: 0.42, depth: 0.34 };
// how far the picture is swung open on its hinge (rad): clear of the dial and the handle
export const PICTURE_ASIDE = 1.75;
export const FAN = { x: 2.8, z: 3.5 };
export const TABLE = { x: 0.95, z: 0.33 };                                   // the adding machine's table (south wall)

// the outer office's furniture
export const BENCH = { x: -3.55, z0: 0.55, z1: 2.35, d: 0.46, h: 0.46 };    // the clients' bench (west wall, south of the door)
export const SEC = { x: -1.6, z: 5.25, w: 1.4, d: 0.78, h: 0.76 };          // the secretary's desk (its front toward the door, -x)
export const OUT_CABS = [[-3.35, 6.65], [-2.85, 6.65], [-1.45, 0.36], [-0.95, 0.36]];   // filing cabinets (x, z)

// the street below and the building across it
export const STREET = { y: -6.6, face: 5.76, kerb: 8.3, farKerb: 19.3, far: 21.8 };
// the lamp post on the far pavement (the watcher stands under it)
export const POST = { x: 19.75, z: 5.35 };   // (off the blind's middle ladder tape as seen from the window)
// the light up the street that comes in through the blind (a high lamp on
// a bracket): the slats' shadows, across the room and me
export const BLIND_LIGHT = { from: [20.5, 4.9, 21.9], through: [5.6, 1.6, 4.15] };

// the combination (what the pad gives up: right, left, right)
export const COMBO = [36, 12, 57];
