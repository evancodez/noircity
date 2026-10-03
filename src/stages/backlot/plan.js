// The backlot (lane B4, rebuilt by lane C6 for wave C: chapter V The Watcher):
// the Harbor Building's fire escape and the run behind it, as numbers. The
// parts build from these, the scene, its chase and the proofs' hands read
// them. No default export: not a part.
//
// Metres, y up; the viewer's yaw convention (he looks along (-sin yaw,
// -cos yaw)): yaw 0 looks north (-z), PI/2 west (-x), -PI/2 east (+x).
//
//   Harbor Street  east-west along z = 0 (road |z| < 5, pavements to 7.5):
//                  the watcher's lamp on the south pavement, facing the side
//                  alley's mouth
//   the Harbor Building  x -24 .. 0, z -47.5 .. -7.5; room 304 at its front
//                  east corner, third floor (y 10.8); the fire escape on its
//                  east wall (x 0) over the side alley
// The chase, stretch by stretch (each a beat of the scene, a checkpoint):
//   escape   down the iron (the escape mode's rail), the ladder, the drop
//   alley    the side alley, x 0 .. 5, north to z -47.5: bins he pulls down
//            across it (the first vault, taught)
//   lane     the back lane, z -52.5 .. -47.5, east to x 50: a board fence, a
//            tall one broken at its foot (the first slide, taught), a fence
//   yard     the washing yard, x 50 .. 70, north to z -84: the wash-house
//            down its middle makes two lanes of washing; he takes one, and
//            slams its back door; the other lane's door is locked
//   kitchen  the kitchen behind the yard, x 50 .. 70, z -100 .. -84: one
//            lamp, steam, two cooks; its roller door is down and locked
//            tonight: out by the iron door in its east wall
//   press    [C6 2nd] the Evening Star's press hall next door, x 70 .. 93.75,
//            z -100 .. -74: two lines of presses running, the paper web
//            across the way between two units (C under), the conveyor of
//            bundles to the mailroom (SPACE over), the pressmen; out by the
//            loading dock onto the avenue
//   el       [C6 2nd] the avenue under the el (x 93.75 .. 115.75), north
//            past the newspaper van, then west into the alley behind the
//            press hall (z -106 .. -100) under its steam pipe (C under), to
//            the loading yard's east end
//   over     the loading yard and the fork: up the iron stair onto the roofs
//            (a party wall, the jump across the light well, a tank to slide
//            under, the shed roof to slide down) or round by the passage and
//            Tanner's Row under them (a dog on a chain, a truck to slide under)
//   street   Mercer Street (a car out of the garage at its foot), the shut
//            market, its gate onto Pell Lane
//   car      Pell Lane: his sedan at the kerb, my coupe behind it under its
//            lamp (lane C3's city begins here: city (x, z) = (x - 205.25, z + 121))

export const FLOOR = 3.6;                    // storey height
export const L3Y = 3 * FLOOR;                // room 304's floor, the top landing (10.8)

// the fire escape on the Harbor Building's east wall: three landings (L3
// outside room 304, L2, L1), two flights between them and the drop ladder.
export const ESC = {
  wallX: 0, depth: 1.3,                      // the landings run x 0 .. 1.3
  z0: -16.4, z1: -9.0,                       // their length along the wall
  levels: [L3Y, 2 * FLOOR, FLOOR],           // L3, L2, L1
  stairW: 0.64,
  f1: { x: 0.95, z0: -11.05, z1: -14.65 },   // flight 1: head (on L3) -> foot (on L2), north
  f2: { x: 0.35, z0: -15.95, z1: -12.35 },   // flight 2: head (on L2) -> foot (on L1), south
  window: { z: -10.0, sill: L3Y + 0.55, w: 0.95, h: 1.45 },   // room 304's escape window
  hatch: { z0: -9.9, z1: -9.0 },             // the ladder's hatch in L1 (its south end)
  ladder: { x: 0.95, z: -9.45 },
  // [C6] the ladder rides down to here; the last of the way is a drop
  ladderFoot: 1.05,
};
// the body's way down (the escape mode's rail: y the feet)
// (out through the window first: its lower sash is up behind the upper, the
// opening under it 0.9 m from the sill to the sash's rail - a man ducks
// through it, bent low, both palms on the sill, and comes up on the iron:
// `duck`, fractions of the segment, see player/modes/escape.js)
export const ESC_RAIL = [
  { x: -0.8, y: L3Y, z: -10.0 },
  { x: 0.45, y: L3Y, z: -10.0, kind: 'walk', duck: { k0: 0.36, k1: 0.66, drop: 0.52, pitch: 0.42, speed: 1.45, hands: [[-0.1, L3Y + 0.56, -9.8], [-0.1, L3Y + 0.56, -10.2]] } },
  { x: 0.5, y: L3Y, z: -10.65, kind: 'walk' },
  { x: 0.95, y: L3Y, z: -11.05, kind: 'walk' },
  { x: 0.95, y: 2 * FLOOR, z: -14.65, kind: 'stair', rail: 'R' },
  { x: 0.95, y: 2 * FLOOR, z: -15.55, kind: 'walk' },
  { x: 0.62, y: 2 * FLOOR, z: -16.1, kind: 'walk' },
  { x: 0.35, y: 2 * FLOOR, z: -15.95, kind: 'walk' },
  { x: 0.35, y: FLOOR, z: -12.35, kind: 'stair', rail: 'L' },
  { x: 0.45, y: FLOOR, z: -11.2, kind: 'walk' },
  { x: 0.95, y: FLOOR, z: -9.85, kind: 'walk' },
  { x: 0.95, y: FLOOR, z: -9.45, kind: 'walk' },
  // [C6] the ladder slides down under my weight to its stop a metre off the
  // flags; the rest is a drop (the knees take it)
  { x: 0.95, y: 1.05, z: -9.45, kind: 'ladder' },
  { x: 0.95, y: 0.0, z: -9.45, kind: 'drop' },
];

// room 304 (the stand-in: lane B2's office is the real one): the building's
// front-east corner on the third floor
export const ROOM = { x0: -5.2, x1: 0, z0: -12.0, z1: -7.5, y0: L3Y, y1: L3Y + FLOOR - 0.35 };
// its street window (on the front wall, z -7.5) and the lamp across the street
export const STREET_WIN = { x: -2.4, sill: L3Y + 0.8, w: 1.1, h: 1.6 };
export const WATCH_LAMP = { x: 2.2, z: 6.9 };          // the post's foot, south pavement
export const WATCH_AT = { x: 2.3, z: 5.95 };            // where he stands under it

// ---- the streets -----------------------------------------------------------------------------
export const HARBOR = { z0: -5, z1: 5, pave: 2.5, x0: -34, x1: 96 };
// Pell Lane (lane C3's city copies it: plan.FROM_BACKLOT there): the road x
// -12 .. -2.5, the east pavement to the market's board fence at x 2, the west
// 2.5 m to the facades; it ends at z -84 against the backs of the lane's blocks
export const BACKST = { x0: -12, x1: -2.5, pave: 2.5, z0: -133, z1: -84 };   // [C6] its north end at a T with a cross street (the city's Harbor St: NORTHST)
export const NORTHST = { z0: -155, z1: -137, pave: 4, x0: -60, x1: 90 };
// Mercer Street: north-south, the garage across its south end (the car comes
// out of it), its far end in the fog
export const MERCER = { x0: 16, x1: 26, road: [17.5, 24.5], z0: -133, z1: -86 };

// ---- the places of the chase ---------------------------------------------------------------
export const ALLEY = { x0: 0, x1: 5, z0: -47.5, z1: -7.5 };
export const LANE = { z0: -52.5, z1: -47.5, x0: 0, x1: 50 };
export const YARD = { x0: 50, x1: 70, z0: -84, z1: -47.5 };
// the wash-house down the yard's middle (the two lanes either side of it)
export const WASH = { x0: 58.5, x1: 61.5, z0: -84, z1: -58, h: 3.3 };
export const LANES = { W: { x0: 50, x1: 58.5, x: 54.25 }, E: { x0: 61.5, x1: 70, x: 65.75 } };
// the washing lines across each lane (z)
export const LINES = [-62.0, -67.0, -72.0, -77.0];
export const KITCHEN = {
  x0: 50, x1: 70, z0: -100, z1: -84, h: 7.2,
  // the back doors in its south wall (one at the head of each lane), and the
  // roller door in its north wall (half down: a man slides under it)
  doors: { W: { x: 54.25, w: 1.1, h: 2.15 }, E: { x: 65.75, w: 1.1, h: 2.15 } },
  roll: { x: 60.0, w: 3.0, gap: 0.82, h: 3.0 },
  table: { x0: 55.0, x1: 65.0, z0: -93.2, z1: -91.6 },
};
export const LOADING = { x0: 50, x1: 70, z0: -106, z1: -100 };
// [C6 2nd] the kitchen's east door (the iron door into the press hall's
// back), in its east wall near the north-east corner
export const KDOOR = { x: 70.0, z: -97.6, w: 1.1, h: 2.2 };
// the press hall (the Evening Star's): its shell, the two lines of presses
// (each two units and a folder, x along the hall), the web across the gap
// between the north line's units (the way under), the conveyor of bundles
// across the middle aisle (the way over), the loading dock door in its east
// wall onto the avenue
export const PRESS = {
  x0: 70, x1: 93.75, z0: -100, z1: -74, h: 9.6, T: 0.3,
  lineN: { z0: -93.6, z1: -91.0 }, lineS: { z0: -84.2, z1: -81.6 },
  units: [[73.6, 78.4], [80.9, 86.0]],        // the units' x along each line (the gap between: 78.4 .. 80.9)
  folder: [86.0, 88.4],                        // the folder at each line's east end
  web: { x: 79.65, y: 0.98, w: 1.6 },           // the web across the north line's gap: under it is 0.98 to its lower edge
  conveyor: { x: 89.6, y: 0.82, w: 0.9 },      // across the middle aisle, north - south, from the north line's folder to the mailroom
  dock: { z: -78.2, w: 3.2, h: 3.2 },          // the loading dock's doorway in the east wall
};
// the avenue under the el (north - south, east of the press hall, across
// Harbor Street's east end): its facades, pavements, road; the el's centre
// line over its west lane; it is up for works at both ends (hoardings across
// it, the el goes on over them into the fog)
export const AVENUE = { x0: 93.75, x1: 115.75, road: [96.75, 112.75], z0: -128, z1: 36, elX: 100.5 };
// the alley behind the press hall: from the avenue west to the passage and
// the loading yard's east end; the steam pipe across it (the way under)
export const BALLEY = { x0: 73, x1: 93.75, z0: -106, z1: -100, pipe: { x: 82.4, y: 0.98 } };
// the passage north from the loading yard to Tanner's Row (the way round)
export const PASSAGE = { x0: 70, x1: 73, z0: -116, z1: -100 };
// the roof row along the loading yard's north side: R1 (two storeys), the
// light well (the jump), R2 (lower, its roof falling to the west), the shed's
// steep lean-to roof down to Mercer Street's pavement
export const ROOFS = {
  z0: -116, z1: -106, parapet: 0.45, pw: 0.25,
  R1: { x0: 44, x1: 70, y: 7.2 },
  gap: { x0: 41.4, x1: 44 },
  R2: { x0: 30, x1: 41.4, yE: 5.6, yW: 5.0 },
  shed: { x0: 26.4, x1: 30, yTop: 5.0, yEave: 2.15 },
  // the iron stair up R1's south face: its foot at the east end, its head at
  // the landing by the gap in the parapet (x 56.4 .. 58)
  stair: { x0: 58.0, x1: 69.6, z: -105.35, w: 0.95, top: 56.4 },
  party: { x: 51.0, h: 0.95 },                 // the party wall across R1
  chimneys: [[63.5, -109.0], [47.6, -113.6], [55.6, -114.2]],
  tank: { x: 35.6, w: 2.5, under: 0.86 },      // the water tank on legs on R2 (in the funnel)
  boxes: [[35.6, -108.0, 3.2, 2.8, 1.6], [35.6, -114.1, 3.2, 2.6, 1.4]],   // the motor house and the big skylight that funnel R2 [x, z, w, d, h]
  skylight: { x: 61.0, z: -111.0, w: 2.2, d: 3.4, h: 0.8 },
};
// the alley under the roofs (north of them)
export const TANNER = { z0: -121, z1: -116, x0: 26, x1: 73 };
export const TRUCK = { x: 44.4, z: -119.2, under: 0.78 };
export const DOG = { x: 59.0, z: -120.6, chain: 2.5 };
export const GARAGE = { x0: 16, x1: 26, z0: -86, z1: -80, door: [17.6, 24.4] };
// the market, shut for the night: between Pell Lane's board fence and
// Mercer Street; its gateway on Mercer Street, its gate onto Pell Lane
export const MARKET = { x0: 2, x1: 16, z0: -122, z1: -84, gateway: { z0: -120.4, z1: -114.4 }, rows: [[4.6, 6.6], [11.4, 13.4]], cross: [-101.2, -97.6] };
// the gate in Pell Lane's board fence (the fence runs x 2, z -84 .. -109)
export const GATE = { x: 2.0, z0: -97.6, z1: -96.0 };
export const FENCE = { x: 2.0, z0: -109.0, z1: -84.0, h: 2.3 };

// the cars on Pell Lane beyond the gate: his sedan (it pulls away north) and
// my coupe behind it, at the kerb (lane C3's city: START)
export const HIS_CAR = { x: -4.1, z: -101.5, yaw: Math.PI / 2 };   // (a car's heading: +x local forward; PI/2 -> north)
export const MY_CAR = { x: -4.1, z: -91.0, yaw: Math.PI / 2 };

// the eye's height above the surface (Controller.EYE)
export const EYE = 1.65;

// ---- the course: the ways through, as a graph ---------------------------------------------------
// Nodes [x, y, z] (y the feet), edges the ways between them (a list of the
// node names a way passes). The chase measures how far each of us is from
// the gate along it (the shortest way on: a man in the wrong lane counts the
// way back), so the gap between us is the way between us.
export const NODES = {
  lamp: [2.3, 0.15, 5.9], kerb: [2.5, 0, 0.0], mouth: [2.5, 0, -8.0], foot: [1.6, 0, -10.2],
  alleyEnd: [2.5, 0, -46.6], laneIn: [4.8, 0, -50.0], laneOut: [48.0, 0, -50.0],
  wIn: [54.25, 0, -55.5], wDoor: [54.25, 0, -82.7], eIn: [65.75, 0, -56.5], eDoor: [65.75, 0, -82.7],
  wIn2: [54.25, 0, -85.6], eIn2: [65.75, 0, -85.6], wK: [54.2, 0, -94.4], eK: [65.8, 0, -94.4], kMid: [61.0, 0, -96.6], rollOut: [60.0, 0, -101.6],
  // [C6 2nd] the kitchen's east door, the press hall, the avenue, the alley behind
  kDoor: [69.0, 0, -97.6], pIn: [71.6, 0, -97.6], pA: [79.65, 0, -96.4], pB: [79.65, 0, -87.6], pC: [91.6, 0, -87.6], pD: [91.6, 0, -78.2],
  dock: [95.4, 0.15, -78.2], avS: [98.3, 0, -83.0], avN: [98.3, 0, -100.4], aIn: [92.4, 0, -103.0], aMid: [83.0, 0, -103.0], aOut: [73.8, 0, -103.0],
  // (dead ends off the way: up and down the avenue, the loading yard's west end - the way on from them is back)
  avSouth: [98.3, 0, -60.0], avNorth: [98.3, 0, -124.0], loadW: [53.0, 0, -102.8],
  // (the stair's foot is met from the alley: lined up on it first)
  stairIn: [71.8, 0, -105.0],
  stairFoot: [70.4, 0, -105.2], stairTop: [57.4, ROOFS.R1.y, -105.25], roofIn: [57.0, ROOFS.R1.y, -108.0],
  party: [51.0, ROOFS.R1.y, -110.9], edge: [44.3, ROOFS.R1.y, -110.9], r2In: [40.2, 5.55, -110.9],
  tank: [35.6, 5.27, -111.0], shedTop: [30.1, 5.0, -111.0], eave: [26.6, 2.15, -111.0], dropped: [25.2, 0.15, -111.6],
  passIn: [71.5, 0, -103.0], passOut: [71.5, 0, -118.5], dog: [59.0, 0, -117.5], bay: [49.4, 0, -119.45], truck: [43.8, 0, -119.5], rowEnd: [27.6, 0, -118.6], rowOut: [25.2, 0.15, -118.6],
  cross: [17.0, 0.15, -117.2], gateway: [14.4, 0, -117.4], aisleN: [9.0, 0, -115.2], aisleS: [9.0, 0, -99.4], crossW: [4.4, 0, -96.8],
  gate: [2.0, 0, -96.8], pave: [-1.4, 0.15, -97.4],
};
// the ways (both directions): [from, to] or a chain of names
export const WAYS = [
  ['lamp', 'kerb', 'mouth', 'foot', 'alleyEnd', 'laneIn', 'laneOut'],
  ['laneOut', 'wIn', 'wDoor'], ['laneOut', 'eIn', 'eDoor'], ['wIn', 'eIn'],
  ['wDoor', 'wIn2'], ['eDoor', 'eIn2'],
  ['wIn2', 'wK', 'kMid'], ['eIn2', 'eK', 'kDoor'], ['eK', 'kMid'], ['wIn2', 'eIn2'],
  // [C6 2nd] the roller door is down: out of the kitchen by its east door,
  // through the press hall, up the avenue, back along the alley behind it
  ['kMid', 'kDoor', 'pIn', 'pA', 'pB', 'pC', 'pD', 'dock', 'avS', 'avN', 'aIn', 'aMid', 'aOut'],
  ['avS', 'avSouth'], ['avN', 'avNorth'], ['stairFoot', 'loadW'],
  ['aOut', 'stairIn', 'stairFoot', 'stairTop', 'roofIn', 'party', 'edge', 'r2In', 'tank', 'shedTop', 'eave', 'dropped', 'cross'],
  ['aOut', 'passIn', 'passOut', 'dog', 'bay', 'truck', 'rowEnd', 'rowOut', 'cross'],
  ['cross', 'gateway', 'aisleN', 'aisleS', 'crossW', 'gate', 'pave'],
];
// the two doors out of the yard (one of them is locked: his choice of lane)
export const DOOR_WAYS = { W: ['wDoor', 'wIn2'], E: ['eDoor', 'eIn2'] };
// where each way of the fork begins (the stretch's choice) and where they meet
export const FORK = { roofs: ['aOut', 'stairIn'], row: ['aOut', 'passIn'], join: 'cross' };
// his way, by his choices (lane: 'W' | 'E', over: 'roofs' | 'row')
export const PRESS_WAY = ['kDoor', 'pIn', 'pA', 'pB', 'pC', 'pD', 'dock', 'avS', 'avN', 'aIn', 'aMid', 'aOut'];
export function hisNames(lane, over) {
  const L = lane === 'E' ? ['eIn', 'eDoor', 'eIn2', 'eK'] : ['wIn', 'wDoor', 'wIn2', 'wK', 'kMid'];
  const O = over === 'row' ? ['passIn', 'passOut', 'dog', 'bay', 'truck', 'rowEnd', 'rowOut'] : ['stairIn', 'stairFoot', 'stairTop', 'roofIn', 'party', 'edge', 'r2In', 'tank', 'shedTop', 'eave', 'dropped'];
  return ['lamp', 'kerb', 'mouth', 'foot', 'alleyEnd', 'laneIn', 'laneOut', ...L, ...PRESS_WAY, ...O, 'cross', 'gateway', 'aisleN', 'aisleS', 'crossW', 'gate', 'pave', 'carDoor'];
}
// his car's door (the street side: he goes round its tail) and the last of his way
NODES.carRear = [-3.0, 0, -98.4];
NODES.carDoor = [-5.25, 0, -100.6];

// the stretches: the beat, where I begin a retry (eye's place and yaw), and
// how far ahead of me along the course he is then
export const STRETCHES = {
  alley: { at: [0.95, -9.8], yaw: 0, ahead: 13 },
  lane: { at: [3.2, -49.6], yaw: -Math.PI / 2, ahead: 13 },
  yard: { at: [44.0, -50.0], yaw: -Math.PI / 2, ahead: 14 },
  kitchen: { at: null, yaw: 0, ahead: 12 },          // just inside his door (the scene places it)
  // [C6 2nd] just inside the press hall (the kitchen's door open behind me);
  // out of its dock door on the avenue; the alley's west end (the fork ahead)
  press: { at: [71.7, -97.6], yaw: -Math.PI / 2, ahead: 12 },
  el: { at: [95.2, -78.2], yaw: -0.35, ahead: 12 },
  over: { at: [75.0, -103.0], yaw: Math.PI / 2, ahead: 12 },
  street: { at: [28.6, -118.6], yaw: Math.PI / 2, ahead: 12 },
  car: { at: [4.2, -96.8], yaw: Math.PI / 2, ahead: 9 },
};
