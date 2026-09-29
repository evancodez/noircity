// The diner's site on the block (docs/story/CONTRACTS.md §15): one table of
// numbers that the near building (world/Facade.js cuts the void), the street
// front (parts/dinerFront.js) and the room (parts/diner.js) all build to.
// World units, metres; every y is WORLD y (the pavement and the diner's
// floor are at 0.15). The avenue runs along z, -z is down it; the near
// building's face is the plane x = -10.2, facing +x.
export const DINER = {
  // the front wall: its outer face is the building line, 0.25 thick
  faceX: -10.2,
  wallT: 0.25,
  innerX: -10.45,
  // the clear room behind it
  backX: -17.0,
  zMin: -5.8,
  zMax: 11.4,
  floorY: 0.15,
  ceilY: 3.55,
  // the four ground-floor bays (centre z) between the kept pilasters
  bays: { B1: 9.4, B2: 5.0, B3: 0.6, B4: -3.8 },
  pilasters: [11.6, 7.2, 2.8, -1.6, -6.0],
  pilasterW: 0.75,
  // a window opening: 3.55 wide, sill 0.90, head 3.10, a transom band to 3.40
  window: { w: 3.55, sill: 0.9, head: 3.1, transom: 3.4 },
  // the door in bay B3: a leaf 0.95 x 2.15 hinged at z = 0.12 (its south
  // jamb), opening inwards, set 0.4 back into a recess
  door: { w: 0.95, h: 2.15, hingeZ: 0.12, recess: 0.4 },
  // the counter along z, its front face toward the street, the back bar
  // against the back wall
  counter: { z0: -3.6, z1: 8.6, frontX: -14.35, depth: 0.62, topY: 1.2 },
  // nine stools on the street side of the counter
  stools: { x: -13.75, z1: 8.0, step: 1.3, n: 9, seatY: 0.92 },
  playerStool: 4,
  brawlerStool: 6,
  seatedEyeY: 1.6,
  // booths along the window wall
  booths: { x0: -12.35, x1: -10.55, tableY: 0.9, z: [9.4, 5.0, 1.75, -3.8] },
  // the aisle between the stools and the booths: the brawl's ring
  aisle: { x0: -13.3, x1: -12.4, z0: -5.0, z1: 10.6 },
  ring: { x: -12.85, z: 1.0, r: 2.2 },
  brawlEyeY: 1.8,
  jukebox: { x: -12.9, z: -5.8 },
  hatch: { z0: 1.0, z1: 3.4, y0: 1.25, y1: 2.15 },
  // six pendants over the counter's front edge, two over the booths
  pendants: { x: -14.0, z: [8.0, 5.6, 3.2, 0.8, -1.6, -3.4], headY: 2.6, half: 0.6, booth: [[-11.45, 9.4], [-11.45, -3.8]] },
  serveX: -15.3,
};

// z of stool i (1..9) and of the serve anchor opposite it
export const stoolZ = (i) => DINER.stools.z1 - DINER.stools.step * (i - 1);

// the openings in the front wall: [z0, z1, y0, y1] (the door bay has the
// doorway and two fixed side lights)
export function dinerOpenings() {
  const D = DINER, W = D.window, out = [];
  for (const k of ['B1', 'B2', 'B4']) {
    const z = D.bays[k];
    out.push({ name: k, z0: z - W.w / 2, z1: z + W.w / 2, y0: W.sill, y1: W.transom });
  }
  const b = D.bays.B3, half = W.w / 2, d = D.door;
  out.push({ name: 'B3L', z0: b - half, z1: d.hingeZ - 0.06, y0: W.sill, y1: W.transom });
  out.push({ name: 'door', z0: d.hingeZ, z1: d.hingeZ + d.w, y0: D.floorY, y1: D.floorY + d.h, door: true });
  out.push({ name: 'B3R', z0: d.hingeZ + d.w + 0.06, z1: b + half, y0: W.sill, y1: W.transom });
  return out;
}

// Can the eye see the diner? North of z = -7.5 (the diner is behind every
// accepted camera, all of which stand south of z = -8.4 looking down the
// avenue) or inside it. While it cannot, the near building is drawn as its
// old solid block and nothing of the diner is drawn, shadowed or lit
// (world/Facade.js setNear, parts/dinerFront.js, parts/diner.js), so the
// accepted frames print from exactly what they always did.
// (lane 4: a frustum test would do better once the golden frames allow it)
export const DINER_SIGHT = { z: -7.5, force: null };
export function dinerInSight(eye) {
  if (DINER_SIGHT.force != null) return DINER_SIGHT.force;
  return eye.z > DINER_SIGHT.z || eye.x < DINER.faceX;
}
