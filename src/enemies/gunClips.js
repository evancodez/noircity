import { NEUTRAL, ANKLE_Y, samplePoseKeys, mergePose } from './HoodRig.js';
import { bake, chainKeys, getClips, HAT_OFF } from './HoodAnim.js';

// The gun kit's clips for the Hood (lane C2), baked once into the Hood's
// clip bank (getClips()) when the gunman's brain loads:
//   kneel           down behind low cover: one knee on the floor, the gun
//                   held up at the chest, the head low (a loop)
//   deathSlump      shot where he stands with no room to fall: the knees go,
//                   onto his knees, and over onto his side, curled (in place)
//   deathSlumpWall  a wall at his back: thrown back against it, he slides
//                   down it and sits, the head dropped, the gun hand in his lap
//   deathSlumpOver  shot over the low cover he rose from: he folds forward
//                   over it, the arms hanging down its far side
// A slump comes to rest on what is there (the floor, the wall, the cover's
// top): src/guns/deaths.js picks one by what is beside him (and turns him
// so it fits), never a fall through a desk or a wall.
// (death clips carry `death: true`: Hood.die takes them)
const k = (t, o) => [t, o];

// ---- kneel ----------------------------------------------------------------------------------------
const KNEEL = {
  hipsPos: [0.0, 0.5, -0.1], hips: [14, 6, 0],
  spine: [10, -2, 0], chest: [6, -4, 0], neck: [6, 0, 0], head: [-6, 0, 0], headRoot: [6, 0, 0], headLevel: [0.5],
  // the left foot planted ahead, its knee up; the right knee on the floor, the shin back along it
  footL: [0.14, ANKLE_Y, 0.3], footRotL: [0, 10, 0], kneeL: [0.2, 0.6, 1],
  footR: [-0.13, 0.085, -0.42], footRotR: [-72, 6, 0], kneeR: [-0.1, -0.7, 1],
  // the gun held up before the chest, both hands on it
  handTR: [-0.07, 0.86, 0.3], elbowPoleR: [-1, -0.7, -0.2], handR: [-62, 0, -6],
  handTL: [0.05, 0.84, 0.31], elbowPoleL: [1, -0.7, -0.2], handL: [10, 0, 24],
};
function kneelPose(t) {
  const b = Math.sin((Math.PI * 2 * t) / 3.2), w = Math.sin((Math.PI * 2 * t) / 6.4 + 1);
  const P = mergePose(NEUTRAL, KNEEL);
  P.chest = [P.chest[0] - 1.2 * b, P.chest[1], P.chest[2]];
  P.head = [P.head[0] + 1.5 * w, P.head[1] + 5 * w, P.head[2]];
  P.hipsPos = [P.hipsPos[0], P.hipsPos[1] + 0.006 * b, P.hipsPos[2]];
  return P;
}

// ---- deathSlump: the knees go, onto his knees, over onto his side ---------------------------------
const SLUMP = chainKeys([
  k(0.0, {}),
  // the hit: a jolt back, the arms come in
  k(0.12, { hipsPos: [0, 0.93, -0.03], spine: [-6, 4, 0], chest: [-10, 8, 2], head: [-18, 6, 4], armL: [0.3, -0.7, 0.5, 0], elbowL: [70], armR: [-0.3, -0.75, 0.45, 0], elbowR: [60] }),
  // the knees go
  k(0.34, { hipsPos: [0.0, 0.66, -0.02], hips: [10, 0, 0], spine: [14, 0, 0], chest: [10, 0, 0], head: [16, 4, 0],
    footL: [0.12, ANKLE_Y, 0.04], kneeL: [0.1, 0, 1], footR: [-0.12, ANKLE_Y, -0.02], kneeR: [-0.1, 0, 1], footRotL: [-10, 8, 0], footRotR: [-10, 8, 0] }),
  // on his knees, the heels up behind
  k(0.55, { hipsPos: [0.0, 0.46, -0.12], hips: [6, 0, 0], spine: [16, 0, 4], chest: [14, 0, 4], neck: [10, 0, 0], head: [22, 8, 6],
    footL: [0.13, 0.11, -0.46], footRotL: [-80, 6, 0], kneeL: [0.1, -0.6, 1], footR: [-0.13, 0.11, -0.48], footRotR: [-80, 6, 0], kneeR: [-0.1, -0.6, 1],
    armL: [0.2, -1, 0.15, 0], elbowL: [20], armR: [-0.2, -1, 0.2, 0], elbowR: [20] }),
  // over to his left
  k(0.8, { hipsPos: [0.16, 0.3, -0.12], hips: [10, 0, -38], spine: [16, 0, -8], chest: [16, 0, -10], head: [20, 10, -10],
    armL: [0.7, -0.6, 0.3, 0], elbowL: [30], armR: [-0.1, -0.7, 0.7, 0], elbowR: [40] }),
  // on his side, curled, the knees drawn up
  k(1.08, { hipsPos: [0.3, 0.16, -0.08], hips: [20, 0, -84], spine: [18, 0, 0], chest: [16, 0, -2], neck: [10, 0, 0], head: [8, 12, -6],
    footL: [0.34, 0.12, -0.42], footRotL: [-60, 30, -80], kneeL: [0.2, 0, 1], footR: [0.12, 0.12, -0.5], footRotR: [-60, 30, -80], kneeR: [0.2, 0.1, 1],
    armL: [0.95, -0.05, 0.3, 0], elbowL: [25], armR: [0.3, -0.45, 0.85, 0], elbowR: [60] }),
  k(1.25, { hipsPos: [0.31, 0.15, -0.08] }),
]);

// ---- deathSlumpWall: back against the wall, down it, sitting --------------------------------------
// (the wall 0.3 .. 0.6 m behind him: he is thrown back onto it, then slides)
const WALL = chainKeys([
  k(0.0, {}),
  k(0.1, { hipsPos: [0, 0.94, -0.08], spine: [-10, 0, 0], chest: [-16, -6, 0], head: [-22, 8, 0], armR: [-0.6, -0.3, 0.4, 0], elbowR: [30], armL: [0.5, -0.5, 0.2, 0], elbowL: [30] }),
  // the back against it (the shoulders at the wall; the feet still under him)
  k(0.26, { hipsPos: [0, 0.9, -0.22], hips: [-6, 0, 0], spine: [-6, 0, 0], chest: [-8, 0, 0], head: [-12, 10, 4],
    footL: [0.12, ANKLE_Y, 0.08], footR: [-0.12, ANKLE_Y, 0.04] }),
  // down it: the knees forward, the back sliding
  k(0.6, { hipsPos: [0, 0.52, -0.26], hips: [-18, 0, 2], spine: [0, 0, 0], chest: [-2, 0, 0], head: [6, 14, 6],
    footL: [0.13, ANKLE_Y, 0.36], kneeL: [0.1, 0.3, 1], footR: [-0.13, ANKLE_Y, 0.3], kneeR: [-0.1, 0.3, 1],
    armL: [0.3, -1, 0.1, 0], elbowL: [16], armR: [-0.3, -1, 0.15, 0], elbowR: [16] }),
  // sitting: the legs out before him, the head dropped onto his chest, the gun hand in the lap
  k(0.92, { hipsPos: [0, 0.16, -0.24], hips: [-58, 0, 4], spine: [10, 0, 2], chest: [12, 0, -4], neck: [14, 0, 0], head: [30, 18, 12], headLevel: [0],
    footL: [0.17, 0.085, 0.62], footRotL: [40, 18, 0], kneeL: [0.3, 1, 0.3], footR: [-0.14, 0.09, 0.52], footRotR: [30, 14, 0], kneeR: [-0.2, 1, 0.4],
    armL: [0.55, -0.85, -0.1, 0], elbowL: [10], armR: [-0.15, -0.6, 0.75, 0], elbowR: [70], handR: [-20, 0, 10] }),
  k(1.2, { hipsPos: [0, 0.15, -0.24], head: [34, 22, 14] }),
]);

// ---- deathSlumpOver: folded over the cover before him ---------------------------------------------
// (its top 0.6 .. 1.1 m up, 0.3 .. 0.6 m in front of him)
const OVER = chainKeys([
  k(0.0, {}),
  k(0.1, { hipsPos: [0, 0.95, -0.03], spine: [-6, 0, 0], chest: [-12, 6, 0], head: [-16, 0, 0], armR: [-0.5, -0.2, 0.6, 0], elbowR: [20] }),
  // forward onto it: the hips against its edge, the chest going over
  k(0.36, { hipsPos: [0, 0.9, 0.06], hips: [24, 0, 0], spine: [20, 0, 0], chest: [16, 0, 0], neck: [6, 0, 0], head: [10, 0, 0],
    footL: [0.12, ANKLE_Y, -0.08], footR: [-0.12, ANKLE_Y, -0.12],
    armL: [0.3, -0.4, 0.9, 0], elbowL: [20], armR: [-0.3, -0.4, 0.9, 0], elbowR: [20] }),
  // over it: the chest on its top, the arms hanging down its far side, the knees giving
  k(0.7, { hipsPos: [0, 0.82, 0.08], hips: [52, 0, 2], spine: [26, 0, 0], chest: [16, 0, 4], neck: [10, 0, 0], head: [16, 30, 10], headLevel: [0],
    footL: [0.13, ANKLE_Y, -0.2], kneeL: [0.1, -0.2, 1], footR: [-0.12, ANKLE_Y, -0.24], kneeR: [-0.1, -0.2, 1], footRotL: [-14, 8, 0], footRotR: [-14, 8, 0],
    armL: [0.25, -0.6, 0.75, 0], elbowL: [12], armR: [-0.2, -0.7, 0.7, 0], elbowR: [16] }),
  k(1.0, { hipsPos: [0, 0.78, 0.09], hips: [60, 0, 3], spine: [28, 0, 2], chest: [18, 0, 4], head: [20, 34, 12],
    armL: [0.15, -0.95, 0.3, 0], elbowL: [8], armR: [-0.1, -0.95, 0.35, 0], elbowR: [10],
    footL: [0.13, 0.1, -0.24], footRotL: [-35, 8, 0], kneeL: [0.1, -0.5, 1], footR: [-0.12, 0.1, -0.28], footRotR: [-35, 8, 0], kneeR: [-0.1, -0.5, 1] }),
  k(1.2, { hipsPos: [0, 0.77, 0.09] }),
]);

// the clips, into the Hood's bank (once)
let done = false;
export function addGunClips() {
  if (done) return getClips();
  done = true;
  const C = getClips();
  C.kneel = bake('kneel', 6.4, kneelPose, { loop: true, armSpace: 'root' });
  const D = (name, keys, dur) => { const c = bake(name, dur, (t) => samplePoseKeys(keys, t), { armSpace: 'root' }); c.death = true; C[name] = c; return c; };
  D('deathSlump', SLUMP, 1.25);
  D('deathSlumpWall', WALL, 1.2);
  D('deathSlumpOver', OVER, 1.2);
  // (when the hat leaves the head: late, as he goes down; over the cover it falls on the far side)
  HAT_OFF.deathSlump = 0.75; HAT_OFF.deathSlumpWall = 0.7; HAT_OFF.deathSlumpOver = 0.55;
  return C;
}
export const SLUMPS = ['deathSlump', 'deathSlumpWall', 'deathSlumpOver'];
