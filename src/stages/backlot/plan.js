// The backlot (lane B4, scene 6 "The Watcher"): the Harbor Building's fire
// escape and the run of alleys and yards behind it, as numbers. The parts
// build from these, the scene and its chase read them. No default export:
// not a part.
//
// Metres, y up; the viewer's yaw convention (he looks along (-sin yaw,
// -cos yaw)): yaw 0 looks north (-z), PI/2 west (-x), -PI/2 east (+x).
//
//   Harbor Street  runs east-west along z = 0 (road |z| < 5, pavements to
//                  7.5): the watcher's lamp on the south pavement, facing
//                  the side alley's mouth
//   the Harbor Building  x -24 .. 0, z -47.5 .. -7.5, four storeys; room 304
//                  at its front-east corner, third floor (y 10.8); the fire
//                  escape on its east wall (x 0) over the side alley
//   1 the straight  the side alley, x 0 .. 5, north from the street to z -47.5
//   2 the fences    the back lane, z -52.5 .. -47.5, east to the yard; two
//                   board fences across it (x 14, 26)
//   3 the washing   the yard, x 36 .. 48, z -81.8 .. -47.5, sheets on lines
//   4 the dog and the crates  the passage, z -84.2 .. -81.8, west to x 2
//   5 the dead end  the alley x 2 .. 6, north to a wall at z -100; its west
//                   side a board fence with one loose board: through it the
//                   street (x -12 .. -2.5), his sedan and my coupe at the kerb

export const FLOOR = 3.6;                    // storey height
export const L3Y = 3 * FLOOR;                // room 304's floor, the top landing (10.8)

// the fire escape on the Harbor Building's east wall: three landings (L3
// outside room 304, L2, L1), two flights between them and the drop ladder.
// Out of the window onto L3 (facing east), left along it to the head of
// flight 1 (on the landings' outer half, it descends north), round the
// north end of L2 to the head of flight 2 (the inner half, it descends
// south), along L1 to the ladder hatch at its south end: the ladder slides
// down and the eye comes round to face up the alley as it lands.
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
  { x: 0.95, y: 0.0, z: -9.45, kind: 'ladder' },
];

// room 304 (the stand-in: lane B2's office is the real one): the building's
// front-east corner on the third floor
export const ROOM = { x0: -5.2, x1: 0, z0: -12.0, z1: -7.5, y0: L3Y, y1: L3Y + FLOOR - 0.35 };
// its street window (on the front wall, z -7.5) and the lamp across the street
export const STREET_WIN = { x: -2.4, sill: L3Y + 0.8, w: 1.1, h: 1.6 };
export const WATCH_LAMP = { x: 2.2, z: 6.9 };          // the post's foot, south pavement
export const WATCH_AT = { x: 2.3, z: 5.95 };            // where he stands under it

// the streets
export const HARBOR = { z0: -5, z1: 5, pave: 2.5, x0: -34, x1: 40 };
export const BACKST = { x0: -12, x1: -2.5, pave: 2.5, z0: -150, z1: -84 };

// the stretches: where each begins (the eye's place and yaw after a "Lost
// him."), and where it ends (the route's distance, see ROUTE)
export const STRETCH = [
  { name: 'straight', at: { x: 0.95, z: -9.8 }, yaw: 0 },
  { name: 'fences', at: { x: 6.5, z: -50.0 }, yaw: -Math.PI / 2 },
  { name: 'washing', at: { x: 41.0, z: -55.0 }, yaw: 0 },
  { name: 'crates', at: { x: 35.5, z: -83.0 }, yaw: Math.PI / 2 },
  { name: 'deadend', at: { x: 4.0, z: -87.0 }, yaw: 0 },
];

// the chase's route (the middle of the way, for both of us): [x, z]
// (his starts under the lamp across Harbor Street and crosses into the
// side alley's mouth; mine starts at the foot of the ladder)
export const ROUTE = [
  [2.3, 5.9], [2.5, 0.0], [2.6, -8.0], [3.2, -15.0], [2.6, -24.0], [2.5, -46.4],
  [4.4, -49.6], [36.2, -50.0], [40.6, -54.6], [41.2, -76.5], [38.8, -82.6],
  [8.0, -83.0], [4.0, -84.8], [4.0, -95.6], [2.6, -97.0], [-1.2, -97.2], [-4.6, -98.2],
];

// the fences across the back lane (x), the loose board in the dead end's
// fence (z), the crates he pulls down in the passage (x), the dog's gate
export const FENCES = [{ x: 14.0, h: 1.75 }, { x: 26.0, h: 1.8 }];
export const LANE = { z0: -52.5, z1: -47.5 };
export const YARD = { x0: 36.0, x1: 48.0, z0: -81.8, z1: -47.5 };
export const PASSAGE = { z0: -84.2, z1: -81.8, x0: 2.0, x1: 40.0 };
export const DEADEND = { x0: 2.0, x1: 6.0, z0: -100.0, z1: -84.2 };
export const BOARD = { x: 2.0, z: -96.6, w: 0.9 };      // the loose board: its gap z -97.05 .. -96.15
export const GATE = { x: 27.5, z: PASSAGE.z0, w: 1.6 };  // the dog's gate in the passage's north wall
export const CRATES = [{ x: 21.5, side: 1 }, { x: 13.0, side: -1 }];
export const SHEETS = [-58.5, -63.5, -68.5, -73.5];     // the washing lines (z)

// the cars on the street beyond the board: his sedan (it pulls away north)
// and my coupe behind it, at the kerb
export const HIS_CAR = { x: -4.1, z: -101.5, yaw: Math.PI / 2 };   // (a car's heading: +x local forward; PI/2 -> north)
export const MY_CAR = { x: -4.1, z: -91.0, yaw: Math.PI / 2 };

// the eye's height above the surface (Controller.EYE)
export const EYE = 1.65;
