import * as THREE from 'three';
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
  // (fix round A1: every 1.95 m from stool 1, so one hangs straight over
  // the player's place, stool 4 at z 4.1, and its pool falls on the counter
  // top in front of him; x a hand's breadth in from the rolled front edge,
  // just behind where his things stand, so their small shadows fall toward
  // him where he can see them, not hidden behind them)
  pendants: { x: -14.7, z: [8.0, 6.05, 4.1, 2.15, 0.2, -1.75], headY: 2.6, half: 0.6, booth: [[-11.45, 9.4], [-11.45, -3.8]] },
  serveX: -15.3,
  // the DINER sign's sheen on the wet pavement (fix round A7): under the
  // letters only (z 1.18 .. 4.42 and a hair), full near the front, gone
  // before the kerb (x -6.0)
  neonSheen: { z0: 1.05, z1: 4.55, xFull: -8.8, xGone: -6.6 },
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

// Is the diner's room worth lighting? The building, its front and its room
// are always there (drawn, solid, shot at); what stays an optimisation is
// the room's light: its pendants take no pooled spot light and the room
// casts no shadow unless the eye is inside, or the front is in view within
// 30 m (walls stop light: a lamp behind a wall lights nothing the player
// sees). parts/dinerFront.js decides it once per step from the camera
// (inView below) and parts/diner.js reads it through dinerInSight.
export const DINER_SIGHT = { force: null, state: null, near: 30 };
export function dinerInSight(eye) {
  if (DINER_SIGHT.force != null) return DINER_SIGHT.force;
  if (DINER_SIGHT.state != null) return DINER_SIGHT.state;
  return eye.x < DINER.faceX && eye.z > DINER.zMin && eye.z < DINER.zMax;
}

// the front's box (the four bays and the fascia) against the camera's
// frustum, within `near` metres (with 2 m of hysteresis: the pool is not
// re-dealt every step on the boundary)
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();
const _box = new THREE.Box3(new THREE.Vector3(DINER.backX, 0, DINER.pilasters[4]), new THREE.Vector3(DINER.faceX + 1.2, 4.6, DINER.pilasters[0]));
export function dinerSightFrom(camera, was = false) {
  const e = camera.position;
  if (e.x < DINER.faceX + 0.3 && e.x > DINER.backX && e.z > DINER.zMin - 0.5 && e.z < DINER.zMax + 0.5) return true;
  const cx = Math.max(_box.min.x, Math.min(_box.max.x, e.x)), cz = Math.max(_box.min.z, Math.min(_box.max.z, e.z));
  const d = Math.hypot(cx - e.x, cz - e.z);
  if (d > DINER_SIGHT.near + (was ? 2 : 0)) return false;
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_pm);
  return _fr.intersectsBox(_box);
}
