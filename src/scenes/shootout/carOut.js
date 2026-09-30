import * as THREE from 'three';
import { bake, chainKeys, getClips } from '../../enemies/HoodAnim.js';
import { ANKLE_Y, mergePose, NEUTRAL, samplePoseKeys } from '../../enemies/HoodRig.js';
import { DOORS } from './site.js';

// [R2-F] A man out of a car (scene 9): he is in the seat when his door
// opens, turned to it, and climbs out - the feet onto the running board and
// the street, the head ducked under the roof, the hand on the door's frame,
// up, and a step clear behind the open door - before his brain has him (the
// first pass put him standing beside the car as the door opened).
// The clip is the Hood rig's (baked like HoodAnim's own and added to its
// table once, under a name of this scene's); the man's root stands where he
// ends, on the street 1.25 m out from the car's middle, facing out; the clip
// carries his hips from the seat (0.82 m in) to there.
// Shot while he is still half in the car he dies in the doorway, folded out
// over his knees (b7_carSlump); shot on his feet with the car at his back he
// goes down forward, never back through it.
// (no default export: not a scene)
export const CLIMB = 1.15;
const SEAT = -0.82;

const CAR_OUT = chainKeys([
  // in the seat, turned to the open door: the feet on the sill and the
  // running board, bent forward under the roof, the left hand on the frame
  [0.0, {
    hipsPos: [0, 0.9, SEAT], hips: [-14, 0, 0], spine: [10, 0, 0], chest: [16, 0, 0], neck: [10, 0, 0], head: [-6, 0, 0], headLevel: [0.3], headRoot: [14, 0, 0],
    footL: [0.13, 0.54, -0.42], footR: [-0.13, 0.54, -0.4], footRotL: [0, 8, 0], footRotR: [0, 8, 0], kneeL: [0.1, 0.4, 1], kneeR: [-0.1, 0.4, 1],
    handTL: [0.3, 1.2, -0.5], elbowPoleL: [1, -0.3, -0.4], handL: [30, 0, 10],
    handTR: [-0.17, 0.98, -0.48], elbowPoleR: [-1, -0.3, -0.4], handR: [-10, 0, -10],
  }],
  // leaning out, the right foot down onto the street
  [0.3, {
    hipsPos: [0, 0.88, -0.7], hips: [-4, 0, 0], spine: [14, 0, 0], chest: [22, 0, 0], neck: [12, 0, 0], head: [-10, 0, 0],
    footR: [-0.13, ANKLE_Y, -0.14], footRotR: [0, 6, 0],
    handTL: [0.32, 1.18, -0.36], handTR: [-0.18, 0.96, -0.3],
  }],
  // up out of the door, the weight on the right foot, the left coming off
  // the board
  [0.6, {
    hipsPos: [0, 0.92, -0.4], hips: [2, 0, 0], spine: [8, 0, 0], chest: [14, 0, 0], neck: [10, 0, 0], head: [-8, 0, 0], headLevel: [0.2],
    footL: [0.13, 0.26, -0.24], footRotL: [-20, 8, 0], kneeL: [0.1, 0.2, 1],
    handTL: [0.3, 1.2, -0.18], handTR: [-0.19, 0.93, -0.06],
  }],
  // clear of it, the left foot down beside the right
  [0.88, {
    hipsPos: [0, 0.95, -0.12], hips: [0, 0, 0], spine: [4, 0, 0], chest: [2, 0, 0], neck: [8, 0, 0], head: [-5, 0, 0], headLevel: [0],
    footL: [0.12, ANKLE_Y, 0.02], footRotL: [0, 8, 0], kneeL: [0.12, 0, 1],
    handTL: [0.24, 1.0, 0.06], elbowPoleL: [1, 0, -1], handL: [0, 0, 4],
    handTR: [-0.19, 0.92, 0.12], elbowPoleR: [-1, 0, -1],
  }],
  // stood, the gun up a little
  [CLIMB, {
    hipsPos: [0, 0.955, -0.02], footL: [0.115, ANKLE_Y, 0.03], footR: [-0.115, ANKLE_Y, -0.02], footRotR: [0, 8, 0],
    handTL: [0.21, 0.94, 0.06], handTR: [-0.19, 0.9, 0.22], handR: [-40, 0, -4],
  }],
]);
const SLUMP = mergePose(NEUTRAL, {
  hipsPos: [0, 0.84, -0.7], hips: [-24, 0, 6], spine: [34, 0, 0], chest: [30, 4, 0], neck: [26, 0, 0], head: [24, 10, 8], headLevel: [0],
  footL: [0.14, 0.54, -0.4], footR: [-0.16, ANKLE_Y, -0.18], footRotL: [0, 14, 0], footRotR: [-10, 20, 0], kneeL: [0.2, 0.3, 1], kneeR: [-0.3, 0.3, 1],
  armL: [0.12, -1, 0.35, 0], armR: [-0.1, -1, 0.3, 0], elbowL: [16], elbowR: [22], handL: [0, 0, 10], handR: [-20, 0, -10],
});

let READY = false;
function clips() {
  if (READY) return;
  READY = true;
  const C = getClips();
  C.b7_carOut = bake('b7_carOut', CLIMB, (t) => samplePoseKeys(CAR_OUT, t), { armSpace: 'root' });
  C.b7_carSlump = bake('b7_carSlump', 0.5, (t) => {
    const P = mergePose(SLUMP, {});
    const s = Math.min(1, t / 0.5);
    P.head = [SLUMP.head[0] + 6 * s, SLUMP.head[1], SLUMP.head[2]];
    P.chest = [SLUMP.chest[0] + 4 * s, SLUMP.chest[1], SLUMP.chest[2]];
    return P;
  }, { armSpace: 'root' });
}
// where a man stands once out of a door, and the way he faces (out)
export function doorOut(car, key) {
  const D = DOORS[key];
  car.group.updateMatrixWorld(true);
  const p = new THREE.Vector3(D.hinge[0] - 0.45, 0, D.side * 1.25).applyMatrix4(car.group.matrixWorld);
  const d = new THREE.Vector3(0, 0, D.side).transformDirection(car.group.matrixWorld);
  return { x: p.x, z: p.z, yaw: Math.atan2(d.x, d.z) };
}

// the man (spawned at doorOut, his brain in the Game's table) climbs out;
// his brain is given back when he stands. ticks: the rig's step list.
export function climbOut(G, h, ticks, { yaw, onStood = null } = {}) {
  clips();
  const ai = G.ais.get(h);
  G.ais.delete(h);
  h.yaw = yaw;
  h.speed = 0;
  h.hatFlies = false;
  h.b7climb = true;
  h.setState('b7_carOut', 0);
  let t = 0, dead = false;
  ticks.push((dt) => {
    t += dt;
    if (!h.alive) {
      if (dead) return false;
      dead = true;
      h.b7climb = false;
      // (half in the car: folded out of the door where he sat; on his
      // feet: forward, away from the car)
      // (killHood turned him a little to the shot: seated, that would swing
      // the seat round his feet)
      if (t < 0.72) { h.yaw = yaw; h.anim.play('b7_carSlump', { fade: 0.3 }); h.state = 'b7_carSlump'; h._deathKind = 'deathKnees'; }
      else { h.hatFlies = true; if (h._deathKind !== 'deathKnees') { h.anim.play('deathKnees', { fade: 0.1 }); h.state = h._deathKind = 'deathKnees'; } }
      if (ai && ai.release) ai.release();
      return false;
    }
    if (t < CLIMB) return true;
    h.b7climb = false;
    h.hatFlies = true;
    h.setState('idle', 0.25);
    if (ai && G.stage.hoods.list.includes(h)) G.ais.set(h, ai);
    if (onStood) onStood(h);
    return false;
  });
}
