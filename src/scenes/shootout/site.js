// Scene 9, The Block (B7): the scene's plan as numbers, in one place.
// World metres (docs/story/ARCHITECTURE.md §4-5): the avenue runs along z,
// -z is "down the avenue" (the reference's view), the diner's front is the
// plane x = -10.2 facing +x (the street), its room at x < -10.45. The el's
// west columns stand at x ~ 11-13 in front of it, its deck top at y 10.7.
// Everything that comes, comes from down the avenue (-z): the road works
// close the block behind the diner (z 30).
// (no default export: not a scene)
import { DINER, stoolZ } from '../../stages/block/site.js';

export { DINER, stoolZ };

export const SITE = {
  // I come in from the street: the scene opens just inside the door, the
  // door swinging shut behind me
  spawn: { x: -12.05, z: 0.6, yaw: Math.PI / 2 },
  // Dot behind the counter opposite the door, where she lays the gun
  dot: { x: -15.25, z: 0.62 },
  // the gun on the counter (its middle), lying along the counter, muzzle
  // toward -z; the two drums beside it
  gun: { x: -14.64, z: 0.5 },
  drums: [{ x: -14.66, z: 1.18 }, { x: -14.58, z: 1.42 }],
  // where I stand to take it (clear of stools 6 and 7)
  take: { x: -13.3, z: 0.62 },
  // where Dot slides the drums to, later (the counter's front at the door)
  resupply: { x: -14.55, z: 0.9 },
  // the switch by the door: on the front wall's inner face, north of the door
  switch: { x: DINER.innerX - 0.012, y: 1.42, z: 1.62 },
  // where a jump into a beat puts me (a retry puts me where the beat began)
  stations: {
    door: { x: -11.35, z: 0.62, yaw: -Math.PI / 2 },
    B4: { x: -11.05, z: -3.4, yaw: -Math.PI / 2 + 0.35 },
    B2: { x: -11.25, z: 5.0, yaw: -Math.PI / 2 - 0.3 },
    counter: { x: -13.3, z: 0.62, yaw: -Math.PI / 2 },
  },
  // ---- the cars beat: two sedans up the avenue, swinging in nose-first at
  // the far side of the road, their headlamps into the room
  cars: [
    // car A: the lead car, stops level with B2 / B1, nose toward the diner
    { rail: [[3.0, -86], [3.6, -46], [4.6, -18], [6.4, -4], [8.6, 3.2], [9.3, 5.4]], stop: 9.3, head: [-0.62, 0.78], delay: 0 },
    // car B: a length behind it, stops level with B4
    { rail: [[4.2, -96], [4.6, -56], [5.6, -26], [7.4, -12], [9.2, -5.4], [9.6, -3.8]], stop: 9.6, head: [-0.52, 0.85], delay: 0.7 },
  ],
  // the men: the car (0 | 1), the door they get out of (local: 'rf' right
  // front, 'rr' right rear, 'lr' left rear), where they fight from
  carMen: [
    { car: 0, door: 'rf', post: 'door', leash: 0.9, delay: 0.35 },
    { car: 0, door: 'rr', post: 'nose', leash: 1.2, delay: 0.75 },
    { car: 0, door: 'lr', post: { x: 12.4, z: 2.8 }, leash: 1.6, delay: 1.1, run: true },
    { car: 1, door: 'rf', post: 'door', leash: 0.9, delay: 0.3 },
    { car: 1, door: 'rr', post: 'tail', leash: 1.2, delay: 0.8, heavy: true },
    { car: 1, door: 'lr', post: { x: 11.5, z: -9.0 }, leash: 1.8, delay: 1.2, run: true },
  ],
  // ---- the doorways: out of the dark under the el's far side, up between
  // the columns and the parked car; one round to the diner's door
  doorways: [
    { at: { x: 18.0, z: 14.5 }, entry: [{ x: 15.2, z: 12.0 }], post: { x: 12.4, z: 14.4 }, leash: 2.2 },
    { at: { x: 18.2, z: -2.0 }, entry: [{ x: 15.4, z: -1.0 }], post: { x: 12.9, z: 0.4 }, leash: 1.8 },
    { at: { x: 18.0, z: -14.0 }, entry: [{ x: 15.8, z: -9.5 }], post: { x: 11.8, z: -7.6 }, leash: 2.0, heavy: true },
  ],
  // the close one: out of the side alley, down the pavement, in at the door
  intruder: { at: { x: -9.0, z: -24.0 }, entry: [{ x: -8.7, z: -10.5 }, { x: -9.1, z: -0.4 }, { x: -9.4, z: 0.6 }, { x: -10.9, z: 0.6 }], post: { x: -11.6, z: 0.4 } },
  // ---- the el: a gunman at the deck's west rail, above car A
  el: { x: 12.55, z: 7.2, y: 10.72 },
  // ---- the drive-by: down the near side of the road past the diner, round
  // at the end of the block, back up the far side, away
  driveby: {
    pass1: [[-1.0, -96], [-1.4, -40], [-2.3, -12], [-2.6, 4], [-2.0, 18], [0.6, 24.4], [4.6, 25.2], [7.0, 21.0], [6.4, 8], [5.4, -12], [4.4, -40], [3.8, -110]],
    // the stretch he fires along the diner's front (by rail distance on pass
    // 1, and on the way back)
    fire: [[-14, 12.5]],
    // what a crippled car goes into: the lamp post south of the diner, the
    // kerb before it
    posts: [{ x: -6.7, z: 16.0 }, { x: -6.7, z: -17.5 }],
  },
  // ---- the Cardinal: the saloon rolls up and stops under the lamp north of
  // the diner (the post at z -17.5: its pool on the road)
  saloon: { rail: [[-0.6, -100], [-1.0, -50], [-1.7, -26], [-1.9, -17.2]], head: [0, 1] },
  heavies: [
    { door: 'rf', entry: [{ x: -4.2, z: -12.0 }], post: { x: -5.0, z: -7.4 }, leash: 2.6 },
    { door: 'lf', entry: [{ x: 1.0, z: -12.5 }], post: { x: -1.6, z: -4.6 }, leash: 2.6 },
  ],
  // his walk: from the saloon's rear door to the diner's door
  cardinal: { door: 'rr', path: [{ x: -3.6, z: -14.2 }, { x: -5.6, z: -9.6 }, { x: -7.2, z: -5.2 }, { x: -8.6, z: -1.2 }, { x: -9.3, z: 0.6 }, { x: -11.2, z: 0.6 }] },
  // the lamp at the end (its head, lamps part)
  endLamp: { x: -5.2, y: 5.8, z: -17.5 },
};

// the beats, in order
export const BEATS = ['arrive', 'cars', 'doorways', 'el', 'driveby', 'cardinal', 'end'];

// a car's local frame (world/Cars.js): +x forward, +y up, +z its right side
// (for a car heading +z, its right side is -x: toward the diner). Its doors:
export const DOORS = {
  rf: { hinge: [0.66, 0.78], back: -0.31, side: 1 },
  rr: { hinge: [-0.31, 0.78], back: -0.98, side: 1 },
  lf: { hinge: [0.66, -0.78], back: -0.31, side: -1 },
  lr: { hinge: [-0.31, -0.78], back: -0.98, side: -1 },
};
