// Pier 9 (lane B6, scene 8): the site plan as numbers. Every part of the
// stage and the scene's rules read their places from here.
//
// Axes: +x east, -z north (into the shed from the land), y up, metres. The
// shed stands on the pier over the river: the land (the gate, my car) is to
// the south (z > 0); the water is west, north and east of it, with a narrow
// apron along the east wall from the land to the bay's side door.
//
//              z -45  +------------------ back wall -------------------+
//                     |  under the mezzanine  [ OFFICE ]      [bay]    |
//              z -41  |  ====stairs W====  catwalk  ====stairs E====   |  loading doors
//                     |        (H1 H2 at the foot)                 bay |  (x 15, over the water)
//              z -35  |  [W3]  [ S3 ]      aisle B      [ S6 ]         |- bay side door (z -29.5)
//              z -28  |------- cross aisle X2 ------------------------ |   -> the east apron
//                     |  [W2]  [ S2 ]   lamps B2       [ S5 ]   C2     |
//              z -14  |------- cross aisle X1 (switch, chain) -------- |
//                     |  [W1]  [ S1 ]   lamps B1       [ S4 ]   C1     |
//              z  -5  |  door pool     the truck                       |
//              z   0  +--side door---------[ big doors ]---------------+
//                        x -10.5                                    x 15
export const PIER = {
  shed: { x0: -15, x1: 15, z0: -45, z1: 0, wallH: 7.2, ridgeY: 10.4, t: 0.25 },
  floorY: 0,
  waterY: -1.7,
  // the land at the pier's root and the apron along the east wall
  land: { x0: -34, x1: 34, z0: 0, z1: 34 },
  apron: { x0: 15, x1: 19, z0: -31.2, z1: 0 },
  // the doors: the side door I come in by (south wall), the big doors (shut),
  // the bay's side door (east wall) I leave by, the plank loading doors
  sideDoor: { x: -10.5, w: 1.2, h: 2.3 },
  bigDoor: { x0: -0.5, x1: 6.5, h: 5.2 },
  bayDoor: { z: -29.5, w: 1.2, h: 2.3 },
  loading: [{ z: -33.7 }, { z: -36.7 }], loadingW: 2.2, loadingH: 2.7,
  // the aisles (their centre lines) and the cross aisles
  aisle: { A: -11, B: 0, C: 11 },
  cross: { X1: -14, X2: -27.8 },
  // the crate blocks: [x0, x1, z0 (north), z1 (south), tiers]
  blocks: [
    [-8.6, -3.4, -11.5, -5.4, 3], [-8.6, -3.4, -25.6, -16.4, 3], [-8.6, -3.4, -35, -30, 2],
    [3.4, 8.6, -11.5, -5.4, 3], [3.4, 8.6, -25.6, -16.4, 3], [3.4, 8.6, -35, -30, 2],
    [-15, -13.4, -13, -7, 2], [-15, -13.4, -24, -17, 2], [-15, -13.4, -33, -28, 1],
    [13.4, 15, -11, -4.5, 2], [13.4, 15, -23, -15, 2],
  ],
  // bottles left on low crates at the aisles' edges (a hand's reach): [x, z, variant]
  bottles: [[-8.95, -12.9, 'beer'], [-2.85, -12.3, 'rye'], [8.95, -26.4, 'gin'], [-8.95, -29.3, 'beer'], [2.85, -29.6, 'rye'], [-12.8, -31.0, 'beer']],
  // the roof's posts at the blocks' corners
  columns: [[-3.4, -14], [3.4, -14], [-3.4, -27.8], [3.4, -27.8], [-9.4, -37.8]],
  // the mezzanine along the back wall, the office on it, its catwalk
  mezz: { x0: -11.2, x1: 13.6, z0: -45, z1: -41, y: 3.8, t: 0.18 },
  office: { x0: -3.2, x1: 3.2, z0: -45, z1: -42.3, h: 2.9, win: { x0: -2.7, x1: 0.7, y0: 0.95, y1: 2.15 }, door: { x0: 1.35, x1: 2.35 } },
  // the stairs in front of the mezzanine's edge: the west pair rising west
  // from its foot, the east pair falling east to the bay
  stairs: {
    W: { foot: -3.4, top: -9.2, z: -40.2, w: 1.2 },
    E: { top: 7.9, foot: 13.7, z: -40.2, w: 1.2 },
  },
  // the loading bay: its clear floor (the second fist fight's ring)
  bay: { x0: 9, x1: 15, z0: -43, z1: -29.8, centre: { x: 11.8, z: -35.2 }, r: 2.4 },
  // the lamps (heads): [name, x, y, z, half, row]
  lamps: [
    ['door', -11, 3.5, -4.9, 0.56, 'A'],
    ['A', -11, 4.1, -20.4, 0.52, 'A'],
    ['B1', 0, 4.3, -9.2, 0.52, 'B'],
    ['B2', 0, 4.3, -21, 0.52, 'B'],
    ['B3', 0, 4.7, -31.8, 0.5, 'B'],
    ['C1', 11, 4.1, -8.8, 0.52, 'C'],
    ['C2', 11, 4.1, -21.2, 0.52, 'C'],
    ['stairs', -2.4, 3.35, -37.1, 0.6, 'N'],
    ['bay', 11.8, 4.3, -35.2, 0.58, 'N'],
  ],
  trussY: 7.1,
  // the switch on the X1 post facing aisle B; the hoist over aisle C: its
  // cord comes down at X1, its load hangs at the far end of the aisle
  panel: { x: -3.12, y: 1.35, z: -14, face: 1 },
  hoist: { cleat: { x: 10.2, z: -13.2 }, x: 11, z0: -12.6, z1: -27.4, load: { x: 11, z: -27.4, y: 4.3 } },
  // the truck: half loaded, parked by the big doors; at the end it backs
  // against the side door
  truck: { from: { x: -4.6, z: -2.6 }, to: { x: -9.9, z: -2.6 } },
  // outside: my car, the gate, the freighter along the east side
  car: { x: -3.8, z: 24.5, yaw: 0.25 },
  gate: { z: 28 },
  freighter: { x: 30.5, z0: -70, z1: 16 },
  // where I stand when the scene begins, by the car looking at the shed
  start: { x: -5.2, z: 20.5, yaw: 0.12 },
};

// is (x, z) inside the shed's walls?
export const inShed = (x, z) => x > PIER.shed.x0 && x < PIER.shed.x1 && z > PIER.shed.z0 && z < PIER.shed.z1;
// on the mezzanine's floor (its catwalk included)?
export const onMezz = (x, z) => x > PIER.mezz.x0 && x < PIER.mezz.x1 && z > PIER.mezz.z0 && z < PIER.mezz.z1;
