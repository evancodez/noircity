// The Harbor Building, third floor: the site plan of the office stage as
// numbers (lane B2). Everything of the stage and of scenes 4 and 5 reads
// them from here. World metres, y up; the floor of the third floor is
// y = 0 (the Hoods, the blood, the casings all stand on y = 0 as on the
// block's street), the street below is at y = STREET.y.
//
//   -x  the corridor ............ +x  the street window (the street below)
//   -z  the lift, the stairs .... +z  the fire escape (the light well)
//
// Room 304 is the box x 0 .. 5.6, z 0 .. 7. Its door is in the corridor
// wall (x = 0), near the south corner; the frosted sidelight beside it;
// the street window in the east wall; the fire-escape window in the north
// wall; the desk before the street window, its chair on the window side.
export const FLOOR = 0;
export const CEIL = 3.1;
export const T = 0.16;                     // a wall's thickness

export const ROOM = { x0: 0, x1: 5.6, z0: 0, z1: 7.0 };

// the corridor: west of the room, from the lift (south) to a dead end (north)
export const CORR = { x0: -2.0, x1: -0.14, z0: -6.6, z1: 2.9, ceil: 2.95 };

// 304's door in the corridor wall: hinged at z0 (the south jamb), it opens
// into the room; the frosted pane in its upper half, the transom over it
export const DOOR = { z0: 0.55, z1: 1.5, h: 2.15, glass: [1.05, 1.95], transom: [2.24, 2.62], open0: 0.22 };
// the frosted sidelight north of the door (the man behind it shows on it)
export const SIDE = { z0: 1.82, z1: 3.22, y0: 1.0, y1: 2.28 };
// the other doors of the corridor (their offices are dark): [name, z centre, side]
export const DOORS = [
  ['302', -4.7, 'E', 'R. KOVAC', 'NOTARY PUBLIC'],
  ['303', -2.0, 'E', 'ATLAS', 'INSURANCE CO.'],
  ['306', -3.3, 'W', 'J. DUBOIS', 'IMPORTS'],
];
// the stairs' door (west wall, the south end: the men come up that way)
export const STAIRS = { z0: -6.2, z1: -5.3 };
// the lift at the south end: a cage of iron and a dark shaft
export const LIFT = { x0: -1.62, x1: -0.52 };
// the corridor's one lamp, near 304
export const CORR_LAMP = { x: -1.1, z: 1.45 };

// the street window: east wall; the blind covers it from its head
export const WIN = { z0: 3.25, z1: 5.05, y0: 0.82, y1: 2.5 };
// the fire-escape window: north wall, the lower sash half up
export const ESC = { x0: 2.35, x1: 3.35, y0: 0.72, y1: 2.32, open: 0.62 };
// the landing outside it and the stairs down (west) to the floor below
export const LAND = { x0: 1.15, x1: 4.75, z0: 7.2, z1: 8.45, y: -0.06 };
export const FLIGHT = { x0: -1.95, x1: 1.15, y0: -3.2, y1: -0.06, z0: 7.3, z1: 8.0 };

// the furniture
export const DESK = { x: 3.95, z: 3.72, w: 1.62, d: 0.86, h: 0.78 };          // w along z, d along x
// (the pad in the banker's lamp's pool: close under its shade, the brightest thing on the desk)
export const PAD = { x: 3.92, z: 3.9, w: 0.215, d: 0.28 };                   // on the blotter
export const PENCIL = { x: 3.9, z: 3.66 };
export const LAMP = { x: 4.12, z: 4.28 };                                    // the banker's lamp
export const CHAIR = { x: 5.08, z: 1.75 };
export const CABS = [0.52, 1.02, 1.52];                                       // filing cabinets' x (north wall)
export const CAB = { w: 0.46, d: 0.66, h: 1.34 };
export const COOLER = { x: 5.0, z: 0.42 };
export const STAND = { x: 0.42, z: 3.9 };                                    // the coat stand
export const PICTURE = { x: 2.75, y: 1.5, w: 0.66, h: 0.52, tilt: -0.07 };   // south wall
export const SAFE = { x: 2.75, y: 1.48, w: 0.42, h: 0.42, depth: 0.34 };
// how far the picture is swung aside on its wire (rad): clear of the dial and the handle
export const PICTURE_ASIDE = 1.45;
export const FAN = { x: 2.8, z: 3.5 };
export const TABLE = { x: 0.95, z: 0.33 };                                   // the adding machine's table (south wall)

// the street below and the building across it
export const STREET = { y: -6.6, face: 5.76, kerb: 8.3, farKerb: 19.3, far: 21.8 };
// the lamp post on the far pavement (the watcher stands under it)
export const POST = { x: 19.75, z: 5.35 };   // (off the blind's middle ladder tape as seen from the window)
// the light up the street that comes in through the blind (a high lamp on
// a bracket): the slats' shadows, across the room and me
export const BLIND_LIGHT = { from: [20.5, 4.9, 21.9], through: [5.6, 1.6, 4.15] };

// the combination (what the pad gives up: right, left, right)
export const COMBO = [36, 12, 57];
