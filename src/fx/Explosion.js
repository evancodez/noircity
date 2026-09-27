import * as THREE from 'three';
import { FIRE, ATLAS } from './fxTextures.js';
import { LAYER, allocDebrisId } from '../render/layers.js';
import { groundAt } from '../world/Street.js';
import { roundedBox, merge } from '../world/geom.js';

// A car going up (Phase 3a). Read as ink, not as a CG particle fountain:
//   t 0     a white flash light (the pre-allocated blast PointLight, white
//           for ~60 ms, then orange and gone by ~0.4 s) and 3 big white-hot
//           splatter blots that swell and turn yellow -> orange -> soot
//   t 0-1   a ring of yellow/orange ink splatter thrown out and up (the
//           fireball's lobes), flung burning drops arcing down, a sheet of
//           water blown off the wet street in a ring, and ONE bold shockwave
//           ring racing across the wet street with a bright broken crest
//           (street.addBlast -> ground.js blastRings)
//   t 0.1-6 black smoke rolling up out of the fireball as soft dark washes
//   t 0-4   chunks - the bonnet, a door, a wheel - tumbling with gravity,
//           bouncing on the street with a tick and a ripple, then lying there
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
  // a door: the lower panel and its empty window frame (a door, at a glance)
  const door = merge([
    roundedBox(1.15, 0.56, 0.09, 0.03, 2).translate(0, -0.2, 0),
    roundedBox(0.08, 0.42, 0.07, 0.02, 1).translate(0.52, 0.28, 0),
    roundedBox(0.08, 0.36, 0.07, 0.02, 1).rotateZ(-0.35).translate(-0.47, 0.26, 0),
    roundedBox(1.0, 0.07, 0.07, 0.02, 1).translate(0.04, 0.47, 0),
  ]);
  // a wheel: tyre + hub
  const wheel = merge([
    new THREE.TorusGeometry(0.29, 0.11, 12, 28),
    new THREE.CylinderGeometry(0.25, 0.25, 0.1, 20).rotateX(Math.PI / 2),
  ]);
  // torn fender / panel fragments
  const shard = merge([
    roundedBox(0.55, 0.06, 0.34, 0.02, 1),
    roundedBox(0.3, 0.06, 0.3, 0.02, 1).translate(0.3, 0, 0.12).rotateY(0.6).rotateZ(0.4),
  ]);
  CHUNK_GEO = { bonnet, door, wheel, shard };
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

  // at: world position of the blast centre (the engine bay); up: the car's
  // up (for the throw); side: its right (the door flies that way)
  blast(at, { yaw = 0, scale = 1 } = {}) {
    const r = this.rng, F = this.fx, W = this.world;
    this.count++;
    this.lightT = 0;
    this.light.position.copy(at).add(new THREE.Vector3(0, 1.2, 0));
    // shockwave on the wet street: ONE bold ring (~3x a bullet ring, a
    // bright broken crest racing out to ~6 m in 0.4 s: ground.js blastRings)
    W.street.addBlast(W, at.x, at.z, 3.0);
    const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    // --- the fireball ------------------------------------------------------
    // white-hot core blots, swelling fast, colour running to orange and soot
    for (let i = 0; i < 3; i++) {
      const s = r.range(2.2, 3.2) * scale;
      F.fire.spawn({
        pos: at.clone().add(new THREE.Vector3(r.gauss() * 0.3, 0.6 + i * 0.35, r.gauss() * 0.3)),
        vel: new THREE.Vector3(r.gauss() * 0.4, r.range(1.2, 2.4), r.gauss() * 0.4),
        life: r.range(0.32, 0.5), size: [s, s], grow: r.range(4, 6) * scale, rot: r.next() * 6.28, spin: r.gauss() * 0.8,
        col: FIRE_COL.white, colEnd: FIRE_COL.orange, colPow: 0.8, cell: FIRE.BALL[r.int(0, 3)], drag: 2, fadeOut: 0.3,
      });
    }
    // the lobes: yellow/orange splatter thrown out and up
    const nL = Math.round(16 * scale);
    for (let i = 0; i < nL; i++) {
      const a = r.next() * Math.PI * 2;
      const up = r.range(0.25, 1.0);
      const v = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r.range(2.5, 6.5) * (1.1 - up * 0.5)).add(new THREE.Vector3(0, up * r.range(4, 9), 0));
      const s = r.range(1.1, 2.1) * scale;
      F.fire.spawn({
        pos: at.clone().add(new THREE.Vector3(r.gauss() * 0.4, 0.5 + r.next() * 0.8, r.gauss() * 0.4)),
        vel: v, life: r.range(0.55, 1.05), size: [s, s], grow: r.range(1.2, 2.4), rot: r.next() * 6.28, spin: r.gauss() * 1.2,
        col: r.chance(0.35) ? FIRE_COL.yellow : FIRE_COL.orange, colEnd: FIRE_COL.soot, colPow: 1.6,
        cell: r.chance(0.7) ? FIRE.BALL[r.int(0, 3)] : FIRE.FLAME[r.int(0, 3)], drag: 2.4, gravity: -1.5, fadeOut: 0.35,
      });
    }
    // burning drops flung in arcs (the splatter's satellite drops)
    for (let i = 0; i < 34 * scale; i++) {
      const a = r.next() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r.range(3, 11)).add(new THREE.Vector3(0, r.range(3, 10), 0));
      const s = r.range(0.07, 0.2);
      F.fire.spawn({
        pos: at.clone().add(new THREE.Vector3(0, 0.8, 0)), vel: v, life: r.range(0.8, 1.6), size: [s, s * 1.4], stretch: 0.05,
        col: r.chance(0.6) ? FIRE_COL.yellow : FIRE_COL.orange, colEnd: FIRE_COL.deep, cell: FIRE.EMBER,
        gravity: G, drag: 0.4, ground: groundAt(at.x), fadeOut: 0.3,
      });
    }
    // black smoke rolling up out of it (soft dark washes): a ring of it
    // shoved out round the fireball's rim (black ink edging the burst), and
    // a column rising behind it
    for (let i = 0; i < 10 * scale; i++) {
      const a = (i / 10) * Math.PI * 2 + r.gauss() * 0.3;
      const s = r.range(1.4, 2.2) * scale;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      F.smoke.spawn({
        pos: at.clone().addScaledVector(out, 1.4).add(new THREE.Vector3(0, 1.0 + r.next() * 1.6, 0)),
        vel: out.clone().multiplyScalar(r.range(2.5, 4.5)).add(new THREE.Vector3(0, r.range(2.5, 5), 0)),
        life: r.range(2.2, 3.4), size: [s, s], grow: r.range(1.4, 2.2), rot: r.next() * 6.28, spin: r.gauss() * 0.4,
        col: [0.003, 0.003, 0.003], alpha: 0.95, drag: 1.8, fadeIn: 0.02, fadeOut: 0.5, cell: FIRE.SMOKE[r.int(0, 3)],
      });
    }
    for (let i = 0; i < 12 * scale; i++) {
      const s = r.range(1.6, 2.8) * scale;
      F.smoke.spawn({
        pos: at.clone().add(new THREE.Vector3(r.gauss() * 0.9, 1.0 + r.next() * 1.4, r.gauss() * 0.9)),
        vel: new THREE.Vector3(r.gauss() * 1.2, r.range(1.8, 4.2), r.gauss() * 1.2),
        // (it thins out within ~5 s: the burning wreck's own column, a
        // translucent wash, takes over - Fire.js)
        life: r.range(3.0, 5.0), size: [s, s], grow: r.range(0.9, 1.6), rot: r.next() * 6.28, spin: r.gauss() * 0.25,
        col: [0.004, 0.004, 0.004], alpha: r.range(0.75, 0.95), drag: 0.9, fadeIn: 0.03, fadeOut: 0.65, cell: FIRE.SMOKE[r.int(0, 3)],
      });
    }
    // a sheet of water blown off the street in a ring
    const gy = groundAt(at.x);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + r.gauss() * 0.05;
      const v = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r.range(5, 9)).add(new THREE.Vector3(0, r.range(1.2, 3), 0));
      F.splash.spawn({
        pos: new THREE.Vector3(at.x + Math.cos(a) * 1.6, gy + 0.05, at.z + Math.sin(a) * 1.6), vel: v, life: r.range(0.35, 0.7), size: [0.03, 0.06], stretch: 0.05,
        col: [0.45, 0.45, 0.45], alpha: 0.9, cell: ATLAS.DROP, gravity: G, ground: gy, fadeOut: 0.3,
      });
    }
    // white-hot sparks (additive)
    for (let i = 0; i < 40; i++) {
      const v = new THREE.Vector3(r.gauss(), r.range(0.3, 1.5), r.gauss()).normalize().multiplyScalar(r.range(6, 16));
      F.sparks.spawn({ pos: at.clone().add(new THREE.Vector3(0, 0.9, 0)), vel: v, life: r.range(0.2, 0.6), size: [0.012, 0.02], stretch: 0.04, col: [6, 6, 6], cell: ATLAS.DROP, gravity: G, ground: gy, fadeOut: 0.4 });
    }
    // --- chunks ------------------------------------------------------------
    // Staggered launches (bonnet first, then the door, the wheel, fragments),
    // thrown up to an apex of ~4-5 m, slow enough sideways that 0.3-0.4 s
    // after the blast they are still over the fireball (1-2 m out, 3-4 m up),
    // printed as black shapes against the flame; then they come down 3-6 m
    // from the car, bounce with a tick and a ripple, and lie there.
    const CG = chunkGeos(), CM = chunkMats();
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const sgn = r.chance(0.5) ? 1 : -1;
    const up = (y) => new THREE.Vector3(0, y, 0);
    const parts = [
      // [geo, material, launch delay (s), velocity]
      [CG.bonnet, CM.wreck, 0.0, fwd.clone().multiplyScalar(r.range(1.2, 2.0)).addScaledVector(side, r.gauss() * 0.6).add(up(r.range(8.2, 9.0)))],
      [CG.door, CM.wreck, 0.05, side.clone().multiplyScalar(sgn * r.range(4.4, 5.2)).addScaledVector(fwd, r.gauss() * 0.8).add(up(r.range(6.8, 7.6)))],
      [CG.wheel, CM.rubber, 0.1, side.clone().multiplyScalar(-sgn * r.range(3.2, 3.8)).addScaledVector(fwd, r.range(-1.2, -0.4)).add(up(r.range(6.2, 6.8)))],
      [CG.shard, CM.wreckMetal, 0.02, new THREE.Vector3(r.gauss() * 2.5, r.range(8, 9.5), r.gauss() * 2.5)],
      [CG.shard, CM.wreckMetal, 0.08, new THREE.Vector3(r.gauss() * 3, r.range(6, 7.5), r.gauss() * 3)],
    ];
    for (const [geo, mat, delay, v] of parts) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(at).add(new THREE.Vector3(0, 0.6, 0));
      m.rotation.set(r.next() * 6, r.next() * 6, r.next() * 6);
      // (the wheel starts torn off its axle, turned face-on along the car:
      // edge-on it is a black bar, face-on a tyre)
      if (geo === CG.wheel) m.rotation.set(r.gauss() * 0.4, Math.atan2(fwd.x, fwd.z) + r.gauss() * 0.4, 0);
      m.userData.inkId = allocDebrisId();
      m.userData.inkFigure = true;
      m.layers.set(LAYER.WORLD);
      m.castShadow = false;
      m.renderOrder = 7;
      m.visible = delay <= 0;
      W.scene.add(m);
      const kind = geo === CG.wheel ? 'wheel' : geo === CG.door ? 'door' : 'panel';
      const half = kind === 'wheel' ? 0.4 : kind === 'door' ? 0.4 : 0.1;
      // a slow, big tumble (a panel that spins fast is edge-on half the time);
      // the wheel rolls about its axle
      const spin = kind === 'wheel'
        ? new THREE.Vector3(r.gauss() * 1.5, r.gauss() * 1.5, (r.chance(0.5) ? 1 : -1) * r.range(7, 11))
        : new THREE.Vector3(r.gauss() * 3.2, r.gauss() * 2.4, r.gauss() * 3.2);
      this.chunks.push({
        mesh: m, kind, vel: v.clone().multiplyScalar(r.range(0.93, 1.06)), spin,
        half, rest: false, bounces: 0, delay, smoke: geo !== CG.shard ? r.range(2, 5) : 0,
      });
    }
    while (this.chunks.length > 30) { const c = this.chunks.shift(); W.scene.remove(c.mesh); }
  }

  update(dt) {
    const W = this.world, r = this.rng;
    // the flash: white for ~60 ms, then orange, gone by ~0.45 s
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
      if (c.rest) continue;
      if (c.delay > 0) { c.delay -= dt; if (c.delay > 0) continue; c.mesh.visible = true; }
      c.vel.y -= G * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt; c.mesh.rotation.z += c.spin.z * dt;
      const gy = groundAt(c.mesh.position.x) + c.half;
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
          c.mesh.position.y = groundAt(c.mesh.position.x) + (c.kind === 'wheel' ? 0.105 : c.kind === 'door' ? 0.035 : 0.035);
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

  clear() {
    for (const c of this.chunks) this.world.scene.remove(c.mesh);
    this.chunks.length = 0;
    this.light.intensity = 0;
    this.light.distance = 12;
    this.lightT = 9;
  }
}
