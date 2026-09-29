import * as THREE from 'three';
import { FIRE, ATLAS } from './fxTextures.js';
import { LAYER, allocDebrisId } from '../render/layers.js';
import { groundY } from './ground.js';
import { roundedBox, merge } from '../world/geom.js';

// A car going up. Read as ink, not as a CG particle fountain:
//   t 0     a white flash light (the pre-allocated blast PointLight, white
//           for ~60 ms, then gone by ~0.3 s) and white-hot splatter blots
//           that swell and turn yellow -> orange -> soot
//   t 0-1   yellow/orange ink splatter thrown out (the fireball's lobes),
//           flung burning drops arcing down, a sheet of water blown off the
//           wet street in a ring, and ONE bold shockwave ring racing across
//           the wet street (street.addBlast -> ground.js blastRings)
//   t 0.1-6 black smoke rolling out of the fireball as soft dark washes
//   t 0-4   chunks tumbling with gravity, bouncing on the street with a tick
//           and a ripple, then lying there; printed black over the flame
// Lane 3: the KIND of blast (Cars.js, chosen by the killing round) shapes
// the fireball, its smoke and its debris:
//   A bonnet  the fireball goes up and forward out of the bay, the bonnet
//             tears off and spins up 6-8 m
//   B tank    a low fireball rolls out backwards along the ground, the boot
//             lid flies, a rear wheel rolls away burning and falls over
//   C cook-off  a small first burst out of the windows, then (phase 2, 0.5 s
//             later) a larger blast with fire standing up through the roof,
//             a door blown off
//   D roll    under the chassis: a flat skirt of fire spreading along the
//             street, the car thrown up and over; a wheel and a door fly
// Colours are linear HDR; the ink pass prints the fire family through the
// colour keep (bright or not at all, render/shaders/ink.js).
export const FIRE_COL = {
  white: [9, 7.6, 4.8],      // white-hot core: prints pale yellow-white
  yellow: [7, 4.2, 0.55],
  orange: [4.2, 1.35, 0.07],
  deep: [2.2, 0.5, 0.03],
  soot: [0.006, 0.005, 0.004],
};
const G = 9.8;
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

let CHUNK_GEO = null;
function chunkGeos() {
  if (CHUNK_GEO) return CHUNK_GEO;
  // Drawn a little larger than the car's own parts (a comic's debris reads as
  // a shape at 15 m), and never flat: a flat slab turned edge-on to the eye
  // printed as a hairline sliver in the smoke.
  // the bonnet: a crumpled panel, its two halves folded along different axes
  const bonnet = merge([
    roundedBox(0.85, 0.09, 1.2, 0.03, 2).translate(0.4, 0, 0).rotateZ(0.32),
    roundedBox(0.85, 0.09, 1.2, 0.03, 2).translate(-0.4, 0, 0).rotateX(0.3).rotateZ(-0.12),
  ]);
  // the boot lid: a shorter curved lid, bent across the middle
  const bootlid = merge([
    roundedBox(0.5, 0.08, 1.15, 0.03, 2).translate(0.24, 0, 0).rotateZ(0.42),
    roundedBox(0.5, 0.08, 1.15, 0.03, 2).translate(-0.24, 0, 0).rotateZ(-0.2).rotateX(0.18),
  ]);
  // a door: the lower panel and its empty window frame (a door, at a glance)
  const door = merge([
    roundedBox(1.15, 0.56, 0.09, 0.03, 2).translate(0, -0.2, 0),
    roundedBox(0.08, 0.42, 0.07, 0.02, 1).translate(0.52, 0.28, 0),
    roundedBox(0.08, 0.36, 0.07, 0.02, 1).rotateZ(-0.35).translate(-0.47, 0.26, 0),
    roundedBox(1.0, 0.07, 0.07, 0.02, 1).translate(0.04, 0.47, 0),
  ]);
  // a wheel: tyre + hub (its axle is the local z)
  const wheel = merge([
    new THREE.TorusGeometry(0.29, 0.11, 12, 28),
    new THREE.CylinderGeometry(0.25, 0.25, 0.1, 20).rotateX(Math.PI / 2),
  ]);
  // torn fender / panel fragments
  const shard = merge([
    roundedBox(0.55, 0.06, 0.34, 0.02, 1),
    roundedBox(0.3, 0.06, 0.3, 0.02, 1).translate(0.3, 0, 0.12).rotateY(0.6).rotateZ(0.4),
  ]);
  CHUNK_GEO = { bonnet, bootlid, door, wheel, shard };
  return CHUNK_GEO;
}

// The chunks are printed OVER the fireball and its smoke: a comic draws the
// debris as black shapes against the flame. Their materials are drawn in the
// transparent queue after the fire (renderOrder 7 > fire 6, smoke 3), depth
// tested against the opaque world only (the particles write no depth), so a
// chunk inside the fireball is never swallowed by the flame sprites in front
// of its centre, while the car and the street still hide it.
let CHUNK_MAT = null;
function chunkMats() {
  if (CHUNK_MAT) return CHUNK_MAT;
  // (unlit charred black: the blast's white flash lit their faces pale grey
  // and they printed as grey cards inside the fireball)
  const over = (hex) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 1, depthWrite: true });
  CHUNK_MAT = { wreck: over(0x030303), wreckMetal: over(0x060606), rubber: over(0x040404) };
  return CHUNK_MAT;
}

export class Explosions {
  constructor(world, fx) {
    this.world = world;
    this.fx = fx;
    this.rng = world.rng.fork(6061);
    this.light = world.fxLights.blast;
    this.lightT = 9;
    this.chunks = [];
    this.count = 0;
    this.onTick = null;        // (pos, strength) debris ticks (audio)
  }

  // at: world position of the blast centre; yaw: the car's (its +x is
  // (cos yaw, 0, -sin yaw)); kind: A | B | C | D (null: the old blast);
  // phase 2: the cook-off's second, larger blast; local(x, y, z): the car's
  // frame -> world (the chunks leave from the part they are)
  blast(at, { yaw = 0, scale = 1, kind = null, phase = 1, local = null } = {}) {
    const r = this.rng, F = this.fx, W = this.world;
    this.count++;
    this.lightT = 0;
    this.light.position.copy(at).add(new THREE.Vector3(0, 1.2, 0));
    // shockwave on the wet street: ONE bold ring (~3x a bullet ring, a
    // bright broken crest racing out to ~6 m in 0.4 s: ground.js blastRings)
    W.street.addBlast(W, at.x, at.z, 3.0 * Math.min(1.2, scale));
    const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const up = (y) => new THREE.Vector3(0, y, 0);
    const K = kind || 'old';
    const gy = groundY(this.world, at.x, at.z, at.y);
    // --- the fireball: its shape is the kind's -----------------------------
    // (the white-hot core blots swell fast, their colour running to orange)
    const core = (pos, vel, s, life, grow, aspect = 1) => F.fire.spawn({
      pos, vel, life, size: [s * aspect, s], grow, rot: r.next() * 6.28, spin: r.gauss() * 0.8,
      col: FIRE_COL.white, colEnd: FIRE_COL.orange, colPow: 0.8, cell: FIRE.BALL[r.int(0, 3)], drag: 2, fadeOut: 0.3,
    });
    const lobe = (pos, vel, s, life, grow, g = -1.5) => F.fire.spawn({
      pos, vel, life, size: [s, s], grow, rot: r.next() * 6.28, spin: r.gauss() * 1.2,
      col: r.chance(0.35) ? FIRE_COL.yellow : FIRE_COL.orange, colEnd: FIRE_COL.soot, colPow: 1.6,
      cell: r.chance(0.7) ? FIRE.BALL[r.int(0, 3)] : FIRE.FLAME[r.int(0, 3)], drag: 2.4, gravity: g, fadeOut: 0.35,
    });
    const jit = (s) => new THREE.Vector3(r.gauss() * s, r.gauss() * s * 0.5, r.gauss() * s);
    if (K === 'A') {
      // out of the bay: a column leaning forward, the lobes up and ahead
      for (let i = 0; i < 3; i++) {
        const s = r.range(2.0, 2.8) * scale;
        core(at.clone().addScaledVector(fwd, 0.3 + i * 0.35).add(up(0.5 + i * 0.55)).add(jit(0.25)), fwd.clone().multiplyScalar(r.range(0.8, 1.6)).add(up(r.range(2.2, 3.4))), s, r.range(0.34, 0.52), r.range(3.6, 5.2) * scale, 0.85);
      }
      for (let i = 0; i < 16 * scale; i++) {
        const a = r.next() * Math.PI * 2, u = r.range(0.45, 1.0);
        const h = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r.range(1.6, 4.2) * (1.1 - u * 0.6)).addScaledVector(fwd, r.range(1.2, 3.4));
        lobe(at.clone().add(jit(0.35)).add(up(0.6 + r.next() * 0.9)), h.add(up(u * r.range(5, 10))), r.range(1.1, 2.1) * scale, r.range(0.55, 1.05), r.range(1.2, 2.4));
      }
    } else if (K === 'B') {
      // the tank: a LOW fireball rolling out backwards along the ground, flat
      // and wide, its lobes skidding over the water
      for (let i = 0; i < 4; i++) {
        const s = r.range(2.0, 2.9) * scale;
        core(at.clone().addScaledVector(fwd, -0.4 - i * 0.5).add(up(0.25 + r.next() * 0.35)).add(jit(0.3)), fwd.clone().multiplyScalar(-r.range(2.4, 4.2)).addScaledVector(side, r.gauss() * 0.8).add(up(r.range(0.3, 0.9))), s, r.range(0.38, 0.56), r.range(3.4, 5) * scale, 1.45);
      }
      for (let i = 0; i < 18 * scale; i++) {
        const a = r.gauss() * 0.9;
        const back = fwd.clone().multiplyScalar(-Math.cos(a)).addScaledVector(side, Math.sin(a));
        lobe(at.clone().add(jit(0.35)).add(up(0.2 + r.next() * 0.5)), back.multiplyScalar(r.range(3, 7.5)).add(up(r.range(0.2, 2.2))), r.range(1.0, 1.9) * scale, r.range(0.6, 1.15), r.range(1.4, 2.6), -0.4);
      }
    } else if (K === 'C' && phase === 1) {
      // the cook-off's first burst: fire punched out of the windows sideways
      for (let i = 0; i < 2; i++) core(at.clone().add(up(0.2)).add(jit(0.2)), up(r.range(0.8, 1.6)), r.range(1.4, 1.9) * scale, r.range(0.25, 0.4), r.range(2.5, 3.5));
      for (let i = 0; i < 14; i++) {
        const sg = i % 2 ? 1 : -1;
        lobe(at.clone().addScaledVector(side, sg * 0.6).addScaledVector(fwd, r.range(-0.9, 0.6)).add(up(r.range(0.0, 0.3))),
          side.clone().multiplyScalar(sg * r.range(2.5, 5.5)).add(up(r.range(0.5, 2.5))), r.range(0.8, 1.4), r.range(0.4, 0.8), r.range(1, 2));
      }
    } else if (K === 'C') {
      // the second, larger blast: a round burst and fire standing up through
      // the roof (a tall column of lobes)
      for (let i = 0; i < 4; i++) {
        const s = r.range(2.4, 3.3) * scale;
        core(at.clone().add(up(0.4 + i * 0.5)).add(jit(0.3)), up(r.range(1.8, 3.4)).add(jit(0.5)), s, r.range(0.36, 0.55), r.range(4, 6) * scale, 0.9);
      }
      for (let i = 0; i < 18 * scale; i++) {
        const a = r.next() * Math.PI * 2, u = r.chance(0.45) ? r.range(0.8, 1.0) : r.range(0.2, 0.7);
        const h = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r.range(2.2, 6) * (1.1 - u * 0.8));
        lobe(at.clone().add(jit(0.4)).add(up(0.6 + r.next() * 1.1)), h.add(up(u * r.range(6, 11))), r.range(1.1, 2.1) * scale, r.range(0.55, 1.1), r.range(1.2, 2.4));
      }
    } else if (K === 'D') {
      // under the chassis: a flat skirt of fire spreading along the street
      // all round the car, then a column where it stood
      for (let i = 0; i < 3; i++) core(at.clone().add(up(0.15 + i * 0.3)).add(jit(0.3)), up(r.range(1.2, 2.6)), r.range(2.0, 2.8) * scale, r.range(0.32, 0.5), r.range(3.4, 4.8) * scale, 1.3);
      for (let i = 0; i < 20 * scale; i++) {
        const a = (i / 20) * Math.PI * 2 + r.gauss() * 0.2;
        const h = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        lobe(at.clone().addScaledVector(h, 0.8).add(up(0.15)), h.multiplyScalar(r.range(4.5, 8)).add(up(r.range(0.2, 1.4))), r.range(0.9, 1.6) * scale, r.range(0.5, 0.9), r.range(1.4, 2.4), -0.2);
      }
      for (let i = 0; i < 6; i++) lobe(at.clone().add(up(0.8 + i * 0.4)).add(jit(0.4)), up(r.range(4, 8)).add(jit(1)), r.range(1.3, 2.0), r.range(0.6, 1.0), r.range(1.2, 2));
    } else {
      // (the Phase 3a blast)
      for (let i = 0; i < 3; i++) {
        const s = r.range(2.2, 3.2) * scale;
        core(at.clone().add(new THREE.Vector3(r.gauss() * 0.3, 0.6 + i * 0.35, r.gauss() * 0.3)), new THREE.Vector3(r.gauss() * 0.4, r.range(1.2, 2.4), r.gauss() * 0.4), s, r.range(0.32, 0.5), r.range(4, 6) * scale);
      }
      const nL = Math.round(16 * scale);
      for (let i = 0; i < nL; i++) {
        const a = r.next() * Math.PI * 2;
        const u = r.range(0.25, 1.0);
        const v = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r.range(2.5, 6.5) * (1.1 - u * 0.5)).add(new THREE.Vector3(0, u * r.range(4, 9), 0));
        lobe(at.clone().add(new THREE.Vector3(r.gauss() * 0.4, 0.5 + r.next() * 0.8, r.gauss() * 0.4)), v, r.range(1.1, 2.1) * scale, r.range(0.55, 1.05), r.range(1.2, 2.4));
      }
    }
    // burning drops flung in arcs (the splatter's satellite drops)
    const nDrops = K === 'C' && phase === 1 ? 14 : 34 * scale;
    for (let i = 0; i < nDrops; i++) {
      const a = r.next() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r.range(3, 11)).add(new THREE.Vector3(0, r.range(3, K === 'B' || K === 'D' ? 6 : 10), 0));
      if (K === 'B') v.addScaledVector(fwd, -3);
      const s = r.range(0.07, 0.2);
      F.fire.spawn({
        pos: at.clone().add(new THREE.Vector3(0, K === 'D' ? 0.3 : 0.8, 0)), vel: v, life: r.range(0.8, 1.6), size: [s, s * 1.4], stretch: 0.05,
        col: r.chance(0.6) ? FIRE_COL.yellow : FIRE_COL.orange, colEnd: FIRE_COL.deep, cell: FIRE.EMBER,
        gravity: G, drag: 0.4, ground: gy, fadeOut: 0.3,
      });
    }
    // black smoke rolling out of it (soft dark washes): a ring shoved out
    // round the fireball's rim (black ink edging the burst), and a column
    // (fewer, larger, ragged lobes at alpha ~0.6: at 0.95 the first frames
    // printed a ring of solid black discs round the fireball, a sticker)
    const small = K === 'C' && phase === 1;
    const nRing = Math.round((small ? 3 : 6) * scale);
    for (let i = 0; i < nRing; i++) {
      const a = (i / nRing) * Math.PI * 2 + r.gauss() * 0.35;
      const s = r.range(2.0, 3.0) * scale;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      if (K === 'B') out.addScaledVector(fwd, -0.8).normalize();
      const lift = K === 'B' || K === 'D' ? 0.4 : 1.1;
      F.smoke.spawn({
        pos: at.clone().addScaledVector(out, 1.5).add(new THREE.Vector3(0, lift + r.next() * 1.6 * (K === 'B' ? 0.4 : 1), 0)),
        vel: out.clone().multiplyScalar(r.range(2.5, 4.5) * (K === 'B' || K === 'D' ? 1.4 : 1)).add(new THREE.Vector3(0, r.range(2.5, 5) * (K === 'B' ? 0.5 : 1), 0)),
        life: r.range(2.4, 3.6), size: [s, s * r.range(0.8, 1.2)], grow: r.range(1.4, 2.2), rot: r.next() * 6.28, spin: r.gauss() * 0.4,
        col: [0.003, 0.003, 0.003], alpha: r.range(0.55, 0.65), drag: 1.8, fadeIn: 0.02, fadeOut: 0.5, cell: FIRE.SMOKE[r.int(0, 3)],
      });
    }
    const nCol = Math.round((small ? 3 : 7) * scale);
    for (let i = 0; i < nCol; i++) {
      const s = r.range(2.3, 3.7) * scale;
      const lean = K === 'A' ? fwd.clone().multiplyScalar(1.2) : K === 'B' ? fwd.clone().multiplyScalar(-1.4) : new THREE.Vector3();
      F.smoke.spawn({
        pos: at.clone().add(new THREE.Vector3(r.gauss() * 0.9, 1.0 + r.next() * 1.4, r.gauss() * 0.9)),
        vel: new THREE.Vector3(r.gauss() * 1.2, r.range(1.8, 4.2), r.gauss() * 1.2).add(lean),
        // (it thins out within ~5 s: the burning wreck's own column, a
        // translucent wash, takes over - Fire.js)
        life: r.range(3.0, 5.0), size: [s, s * r.range(0.8, 1.2)], grow: r.range(0.9, 1.6), rot: r.next() * 6.28, spin: r.gauss() * 0.25,
        col: [0.004, 0.004, 0.004], alpha: r.range(0.55, 0.65), drag: 0.9, fadeIn: 0.03, fadeOut: 0.65, cell: FIRE.SMOKE[r.int(0, 3)],
      });
    }
    // a sheet of water blown off the street in a ring
    if (!small) {
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2 + r.gauss() * 0.05;
        const v = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r.range(5, 9)).add(new THREE.Vector3(0, r.range(1.2, 3), 0));
        F.splash.spawn({
          pos: new THREE.Vector3(at.x + Math.cos(a) * 1.6, gy + 0.05, at.z + Math.sin(a) * 1.6), vel: v, life: r.range(0.35, 0.7), size: [0.03, 0.06], stretch: 0.05,
          col: [0.45, 0.45, 0.45], alpha: 0.9, cell: ATLAS.DROP, gravity: G, ground: gy, fadeOut: 0.3,
        });
      }
    }
    // white-hot sparks (additive)
    for (let i = 0; i < (small ? 16 : 40); i++) {
      const v = new THREE.Vector3(r.gauss(), r.range(0.3, 1.5), r.gauss()).normalize().multiplyScalar(r.range(6, 16));
      F.sparks.spawn({ pos: at.clone().add(new THREE.Vector3(0, 0.9, 0)), vel: v, life: r.range(0.2, 0.6), size: [0.012, 0.02], stretch: 0.04, col: [6, 6, 6], cell: ATLAS.DROP, gravity: G, ground: gy, fadeOut: 0.4 });
    }
    // --- chunks ------------------------------------------------------------
    // Staggered launches, thrown up to an apex of ~4-8 m, slow enough
    // sideways that 0.3-0.4 s after the blast they are still over the
    // fireball, printed as black shapes against the flame; then they come
    // down 3-6 m from the car, bounce with a tick and a ripple, and lie there.
    const CG = chunkGeos(), CM = chunkMats();
    const sgn = r.chance(0.5) ? 1 : -1;
    const L = (x, y, z) => (local ? local(x, y, z) : at.clone().add(new THREE.Vector3(0, 0.6, 0)));
    let parts;
    if (K === 'A') {
      parts = [
        // the bonnet tears off and spins up 6-8 m (v^2 / 2g)
        [CG.bonnet, CM.wreck, 0.0, fwd.clone().multiplyScalar(r.range(1.2, 2.2)).addScaledVector(side, r.gauss() * 0.5).add(up(r.range(11.2, 12.4))), L(1.5, 1.2, 0), 'bonnet'],
        [CG.shard, CM.wreckMetal, 0.03, fwd.clone().multiplyScalar(r.range(2, 4)).add(new THREE.Vector3(r.gauss() * 2, r.range(7, 9), r.gauss() * 2)), L(1.9, 1.0, 0.5), 'panel'],
        [CG.shard, CM.wreckMetal, 0.06, fwd.clone().multiplyScalar(r.range(1, 3)).add(new THREE.Vector3(r.gauss() * 2.5, r.range(5.5, 7), r.gauss() * 2.5)), L(1.9, 1.0, -0.5), 'panel'],
      ];
    } else if (K === 'B') {
      parts = [
        [CG.bootlid, CM.wreck, 0.0, fwd.clone().multiplyScalar(-r.range(2.0, 3.0)).addScaledVector(side, r.gauss() * 0.6).add(up(r.range(8.6, 9.6))), L(-2.0, 1.1, 0), 'panel'],
        [CG.wheel, CM.rubber, 0.08, null, L(-1.55, 0.375, sgn * 0.76), 'roller'],
        [CG.shard, CM.wreckMetal, 0.04, fwd.clone().multiplyScalar(-r.range(2, 4)).add(new THREE.Vector3(r.gauss() * 2.5, r.range(5, 7), r.gauss() * 2.5)), L(-2.2, 0.8, 0.4), 'panel'],
      ];
    } else if (K === 'C' && phase === 1) {
      parts = [];
    } else if (K === 'C') {
      parts = [
        [CG.door, CM.wreck, 0.02, side.clone().multiplyScalar(-r.range(4.4, 5.4)).addScaledVector(fwd, r.gauss() * 0.8).add(up(r.range(6.2, 7.2))), L(0.15, 0.95, -0.75), 'door'],
        [CG.shard, CM.wreckMetal, 0.0, new THREE.Vector3(r.gauss() * 2, r.range(9, 10.5), r.gauss() * 2), L(-0.4, 1.7, 0), 'panel'],
        [CG.shard, CM.wreckMetal, 0.05, new THREE.Vector3(r.gauss() * 3, r.range(6, 7.5), r.gauss() * 3), L(-0.6, 1.6, 0.3), 'panel'],
      ];
    } else if (K === 'D') {
      parts = [
        [CG.wheel, CM.rubber, 0.05, side.clone().multiplyScalar(-sgn * r.range(3.4, 4.2)).addScaledVector(fwd, r.range(-1, 1)).add(up(r.range(7, 8))), L(1.55, 0.375, -sgn * 0.78), 'wheel'],
        [CG.door, CM.wreck, 0.08, side.clone().multiplyScalar(-sgn * r.range(3.5, 4.5)).add(up(r.range(5.5, 6.5))), L(-0.6, 0.9, -sgn * 0.72), 'door'],
        [CG.shard, CM.wreckMetal, 0.02, new THREE.Vector3(r.gauss() * 3, r.range(7, 8.5), r.gauss() * 3), L(0, 0.4, 0), 'panel'],
      ];
    } else {
      parts = [
        [CG.bonnet, CM.wreck, 0.0, fwd.clone().multiplyScalar(r.range(1.2, 2.0)).addScaledVector(side, r.gauss() * 0.6).add(up(r.range(8.2, 9.0))), null, 'panel'],
        [CG.door, CM.wreck, 0.05, side.clone().multiplyScalar(sgn * r.range(4.4, 5.2)).addScaledVector(fwd, r.gauss() * 0.8).add(up(r.range(6.8, 7.6))), null, 'door'],
        [CG.wheel, CM.rubber, 0.1, side.clone().multiplyScalar(-sgn * r.range(3.2, 3.8)).addScaledVector(fwd, r.range(-1.2, -0.4)).add(up(r.range(6.2, 6.8))), null, 'wheel'],
        [CG.shard, CM.wreckMetal, 0.02, new THREE.Vector3(r.gauss() * 2.5, r.range(8, 9.5), r.gauss() * 2.5), null, 'panel'],
        [CG.shard, CM.wreckMetal, 0.08, new THREE.Vector3(r.gauss() * 3, r.range(6, 7.5), r.gauss() * 3), null, 'panel'],
      ];
    }
    for (const [geo, mat, delay, v, from, kind0] of parts) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(from || at.clone().add(new THREE.Vector3(0, 0.6, 0)));
      m.rotation.set(r.next() * 6, r.next() * 6, r.next() * 6);
      // (the wheel starts torn off its axle, turned face-on along the car:
      // edge-on it is a black bar, face-on a tyre)
      if (geo === CG.wheel) m.rotation.set(r.gauss() * 0.4, Math.atan2(fwd.x, fwd.z) + r.gauss() * 0.4, 0);
      if (kind0 === 'bonnet') m.rotation.set(r.gauss() * 0.2, yaw, r.gauss() * 0.2);
      m.userData.inkId = allocDebrisId();
      m.userData.inkFigure = true;
      m.layers.set(LAYER.WORLD);
      m.castShadow = false;
      m.renderOrder = 7;
      m.visible = delay <= 0;
      W.scene.add(m);
      const kind = kind0 === 'bonnet' ? 'panel' : kind0;
      const half = kind === 'wheel' || kind === 'roller' ? 0.4 : kind === 'door' ? 0.4 : 0.1;
      // a slow, big tumble (a panel that spins fast is edge-on half the
      // time); the wheel rolls about its axle; the bonnet spins flat, like a
      // thrown plate, so it stays a broad shape against the sky
      const spin = kind === 'wheel'
        ? new THREE.Vector3(r.gauss() * 1.5, r.gauss() * 1.5, (r.chance(0.5) ? 1 : -1) * r.range(7, 11))
        : kind0 === 'bonnet' ? new THREE.Vector3(r.gauss() * 1.2, (r.chance(0.5) ? 1 : -1) * r.range(5, 7), r.gauss() * 1.2)
          : new THREE.Vector3(r.gauss() * 3.2, r.gauss() * 2.4, r.gauss() * 3.2);
      const c = {
        mesh: m, kind, vel: v ? v.clone().multiplyScalar(r.range(0.93, 1.06)) : new THREE.Vector3(), spin,
        half, rest: false, bounces: 0, delay, smoke: geo !== CG.shard ? r.range(2, 5) : 0, burn: 0,
      };
      if (kind === 'roller') {
        // a rear wheel knocked off its hub, rolling away burning: upright,
        // along the car's side and back, slowing, then it wobbles and falls
        const dir = fwd.clone().multiplyScalar(-r.range(0.7, 0.95)).addScaledVector(side, sgn * r.range(0.4, 0.7)).normalize();
        c.roll = { dir, speed: r.range(3.6, 4.4), lean: 0, leanV: 0, ang: 0, side: r.chance(0.5) ? 1 : -1, hop: 0.9 };
        c.burn = r.range(7, 9);
        c.smoke = 0;
        m.position.y = groundY(this.world, m.position.x, m.position.z) + 0.38;
      }
      this.chunks.push(c);
    }
    while (this.chunks.length > 30) { const c = this.chunks.shift(); W.scene.remove(c.mesh); }
  }

  update(dt) {
    const W = this.world, r = this.rng;
    // the flash: white for ~60 ms, then gone by ~0.3 s
    if (this.lightT < 9) {
      this.lightT += dt;
      const t = this.lightT;
      const L = this.light;
      // (white: whatever it lights prints as ink, stark white faces and
      // black shadows for a moment; the warm glow is the fire lights' job -
      // an orange blast light printed the whole block orange)
      // (it is the muzzle-flash light, borrowed: its range is restored after)
      if (t < 0.3) {
        const k = t < 0.05 ? 1 : Math.pow(1 - (t - 0.05) / 0.25, 2);
        L.intensity = 380 * k;
        L.color.setRGB(1, 1, 1);
        L.distance = 40;
      } else { L.intensity = 0; L.distance = 12; this.lightT = 9; }
      this.entry = this.entry || W.lights.add({ position: L.position, direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 14, intensity: 0 });
      this.entry.intensity = L.intensity > 0 ? Math.min(3, L.intensity / 200) : 0;
    }
    // chunks: tumble, fall, bounce with a tick and a ripple, then lie still
    for (const c of this.chunks) {
      if (c.burn > 0) this.burnChunk(c, dt);
      if (c.rest) continue;
      if (c.delay > 0) { c.delay -= dt; if (c.delay > 0) continue; c.mesh.visible = true; }
      if (c.roll) { this.rollWheel(c, dt); continue; }
      c.vel.y -= G * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt; c.mesh.rotation.z += c.spin.z * dt;
      const gy = groundY(this.world, c.mesh.position.x, c.mesh.position.z) + c.half;
      if (c.mesh.position.y < gy) {
        c.mesh.position.y = gy;
        if (c.vel.y < -1.2 && c.bounces < 4) {
          c.vel.y *= -0.34;
          c.vel.x *= 0.55; c.vel.z *= 0.55;
          c.spin.multiplyScalar(0.5);
          c.bounces++;
          W.street.addImpact(W, c.mesh.position.x, c.mesh.position.z, 0.9);
          const p = c.mesh.position;
          for (let i = 0; i < 8; i++) this.fx.sparks.spawn({ pos: p.clone(), vel: new THREE.Vector3(r.gauss() * 2, r.range(1, 3), r.gauss() * 2), life: r.range(0.08, 0.2), size: [0.01, 0.014], stretch: 0.03, col: [5, 5, 5], cell: ATLAS.DROP, gravity: G, ground: gy - c.half, fadeOut: 0.3 });
          if (this.onTick) this.onTick(p, Math.min(1, -c.vel.y / 3 + 0.3));
        } else {
          // settle flat: a wheel on its side, a panel face down
          c.rest = true;
          // (the wheel's axle is its local z: it lies on its side with the
          // axle vertical; a door or panel lies flat)
          if (c.kind === 'wheel') c.mesh.rotation.set(Math.PI / 2, 0, c.mesh.rotation.z);
          else if (c.kind === 'door') c.mesh.rotation.set(Math.PI / 2, c.mesh.rotation.y, 0);
          else c.mesh.rotation.set(0, c.mesh.rotation.y, 0);
          c.mesh.position.y = groundY(this.world, c.mesh.position.x, c.mesh.position.z) + (c.kind === 'wheel' ? 0.105 : c.kind === 'door' ? 0.035 : 0.035);
        }
      }
      // a thread of smoke off a burning chunk
      if (c.smoke > 0) {
        c.smoke -= dt;
        if (r.chance(dt * 9)) {
          const s = r.range(0.25, 0.5);
          this.fx.smoke.spawn({ pos: c.mesh.position.clone(), vel: new THREE.Vector3(r.gauss() * 0.2, r.range(0.6, 1.2), r.gauss() * 0.2), life: r.range(1.2, 2.2), size: [s, s], grow: 0.5, rot: r.next() * 6.28, col: [0.006, 0.006, 0.006], alpha: 0.6, drag: 0.6, fadeIn: 0.1, fadeOut: 0.6, cell: FIRE.SMOKE[r.int(0, 3)] });
        }
      }
    }
  }

  // The wheel that rolls away: upright on the street, its axle across its
  // path, turning at v / r; it slows, starts to wobble (an inverted pendulum
  // about its contact), curls toward the lean and falls onto its side.
  rollWheel(c, dt) {
    const R = c.roll, m = c.mesh, r = this.rng;
    const rad = 0.4;
    if (R.hop > 0) {
      // (knocked off the hub it lands first, with a bounce)
      R.hop -= dt;
    }
    R.speed = Math.max(0, R.speed - dt * (0.75 + Math.abs(R.lean) * 1.5));
    if (R.speed < 2.2 || Math.abs(R.lean) > 0.05) {
      // the lean grows once the gyroscope's hold is gone
      const hold = Math.max(0, R.speed - 0.4) * 2.2;
      R.leanV += (Math.sin(R.lean) * (G / rad) * 0.55 + R.side * 0.8 - R.lean * hold * 3) * dt;
      R.lean += R.leanV * dt;
    }
    // it curls toward the side it leans to
    const turn = R.lean * 0.9 * dt * Math.min(1, R.speed);
    R.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    m.position.addScaledVector(R.dir, R.speed * dt);
    R.ang += (R.speed / rad) * dt;
    const fallen = Math.abs(R.lean) >= Math.PI / 2 - 0.08;
    if (fallen) {
      R.lean = Math.sign(R.lean) * (Math.PI / 2);
      c.rest = true;
      this.world.street.addImpact(this.world, m.position.x, m.position.z, 0.8);
      if (this.onTick) this.onTick(m.position, 0.6);
    }
    // orientation: local z (the axle) across the path, tipped by the lean
    _z.set(-R.dir.z, 0, R.dir.x);                       // the axle
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _z);
    const qa = new THREE.Quaternion().setFromAxisAngle(_z, -R.ang);
    const ql = new THREE.Quaternion().setFromAxisAngle(R.dir, R.lean);
    m.quaternion.copy(ql).multiply(qa).multiply(_q);
    const gy = groundY(this.world, m.position.x, m.position.z);
    m.position.y = gy + rad * Math.cos(R.lean) + 0.1 * Math.abs(Math.sin(R.lean)) + (R.hop > 0 ? Math.sin(R.hop / 0.9 * Math.PI) * 0.35 : 0);
    // the street answers: a ripple where the rim runs
    if (r.chance(dt * 8 * Math.min(1, R.speed))) this.world.street.addImpact(this.world, m.position.x, m.position.z, 0.35);
  }

  // small flames on a burning chunk (the rolling wheel's tyre)
  burnChunk(c, dt) {
    const r = this.rng;
    c.burn -= dt;
    if (!c.mesh.visible || !r.chance(dt * 18)) return;
    const k = Math.min(1, c.burn / 3);
    const s = r.range(0.2, 0.42) * (0.5 + 0.5 * k);
    this.fx.fire.spawn({
      pos: c.mesh.position.clone().add(new THREE.Vector3(r.gauss() * 0.12, 0.15 + r.next() * 0.2, r.gauss() * 0.12)),
      vel: new THREE.Vector3(r.gauss() * 0.2, r.range(0.6, 1.3), r.gauss() * 0.2), life: r.range(0.25, 0.45), size: [s * 0.8, s], grow: 0.3, rot: r.gauss() * 0.2,
      col: r.chance(0.4) ? FIRE_COL.yellow : FIRE_COL.orange, colEnd: FIRE_COL.deep, colPow: 1.3, cell: FIRE.FLAME[r.int(0, 3)], fadeIn: 0.05, fadeOut: 0.35, drag: 0.6,
    });
    if (r.chance(0.3)) {
      const s2 = r.range(0.3, 0.55);
      this.fx.smoke.spawn({ pos: c.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)), vel: new THREE.Vector3(r.gauss() * 0.2, r.range(0.7, 1.2), r.gauss() * 0.2), life: r.range(1.4, 2.4), size: [s2, s2], grow: 0.5, rot: r.next() * 6.28, col: [0.005, 0.005, 0.005], alpha: 0.5, drag: 0.6, fadeIn: 0.1, fadeOut: 0.6, cell: FIRE.SMOKE[r.int(0, 3)] });
    }
  }

  clear() {
    for (const c of this.chunks) this.world.scene.remove(c.mesh);
    this.chunks.length = 0;
    this.light.intensity = 0;
    this.light.distance = 12;
    this.lightT = 9;
  }
}
