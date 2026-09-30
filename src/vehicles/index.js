import * as THREE from 'three';
import { Vehicle, Headlamps } from './Vehicle.js';
import { buildCoupe, buildTruck, tailLamps, figureInk, COUPE, TRUCK } from './models.js';
import { releaseHoodSlot, LAYER } from '../render/layers.js';

// Vehicles (docs/story/CONTRACTS.md §11; wave B, lane B5): game.vehicles.
//   vehicles.spawn(kind: 'coupe' | 'sedan' | 'truck', { at: { x, z } | Vector3,
//                  yaw (a car's rotation.y: forward (cos, -sin)), speed,
//                  lights, tail: 'crew' }) -> Vehicle
//   v.pos, v.yaw, v.vel, v.speed, v.steer, v.body (Object3D), v.s / v.d (on
//   the stage's track), v.input { throttle, brake, steer }, v.driver
//   ('player' | { drive(v, dt) } | null), v.on('scrape' | 'crash' | 'smash' |
//   'kerb' | 'bump', fn), v.lamps (Headlamps), v.car (a sedan's record in
//   stage.cars: its glass, lenses, tyres - world/Cars.js)
//   vehicles.list, vehicles.player (the one driven by the player), remove(v),
//   clear(), update(dt) (steps every car but the player's: the drive mode
//   steps that one, before the eye is placed)
// A stage that has cars has a track (stage.track: the river road's).
// Models: src/vehicles/models.js; physics: src/vehicles/Vehicle.js.
export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.player = null;
  }

  spawn(kind, { at, yaw = 0, speed = 0, lights = true, tail = null, paint = 'paint' } = {}) {
    const G = this.game, stage = G.stage;
    const pos = at && at.isVector3 ? at.clone() : new THREE.Vector3(at?.x ?? 0, 0, at?.z ?? 0);
    const T = stage.track;
    let model, lampPts, tailPts;
    if (kind === 'coupe') {
      model = buildCoupe(stage.M);
      stage.scene.add(model.group);
      lampPts = COUPE.lamps; tailPts = COUPE.tail;
    } else if (kind === 'sedan') {
      // the block's sedan, through the stage's Cars: a round into it cracks
      // its glass, breaks a lens, flattens a tyre (world/Cars.js)
      const C = stage.cars;
      const car = C.spawn({ pos: pos.clone(), yaw, lights: false, paint });
      car.limit = 1e9;
      const i = stage.colliders.boxes.indexOf(car.collider);
      if (i >= 0) stage.colliders.boxes.splice(i, 1);
      C.cars.push(car);
      car.meshes.lens.material = stage.M.headlamp;
      car.meshes.lens.userData.emitter = true;
      // (the contact shadow rides with it; the car is not a shadow caster)
      for (const m of Object.values(car.meshes)) if (m && m.isMesh) m.castShadow = false;
      // [2nd pass] its contact shadow after the headlamps' pools (as my
      // coupe's, models.js): my pool lit the road under his wreck
      car.group.traverse((m) => { if (m.isMesh && m.renderOrder === 1 && m.layers.isEnabled(LAYER.FX)) m.renderOrder = 3; });
      model = { group: car.group, meshes: car.meshes, car };
      lampPts = [new THREE.Vector3(2.3, 0.98, 0.6), new THREE.Vector3(2.3, 0.98, -0.6)];
      tailPts = [new THREE.Vector3(-2.3, 0.84, 0.74), new THREE.Vector3(-2.3, 0.84, -0.74)];
    } else if (kind === 'truck') {
      model = buildTruck(stage.M);
      stage.scene.add(model.group);
      lampPts = TRUCK.lamps;
    } else throw new Error(`vehicles.spawn: no kind '${kind}' (coupe, sedan, truck)`);
    const v = new Vehicle(this, kind, model, { pos, yaw, s: T ? T.project(pos.x, pos.z, null, {}).s : null });
    v.car = model.car || null;
    if (tail === 'crew' && tailPts) v.tail = tailLamps(model.group, tailPts);
    v.inkSlot = figureInk(model.group);
    if (lights && lampPts && T) v.lamps = new Headlamps(stage, v, lampPts, kind === 'coupe' ? { reach: 30, intensity: 170, cone: 0.16 } : { reach: 24, intensity: 120, cone: 0.2 });
    v.place(pos, yaw, speed);
    this.list.push(v);
    return v;
  }

  // the track's two real headlamp lights: the player's car always has one;
  // the other goes to the lit car nearest ahead of the eye
  dealLights() {
    const T = this.game.stage.track;
    if (!T) return;
    const P = this.player;
    const eye = this.game.camera.position;
    let best = null, bd = Infinity;
    for (const v of this.list) {
      if (!v.lamps || v === P || !v.lamps.on) continue;
      const d = Math.hypot(v.pos.x - eye.x, v.pos.z - eye.z);
      if (d < bd) { bd = d; best = v; }
    }
    for (const v of this.list) {
      if (!v.lamps) continue;
      const want = v === P ? T.spots[0] : v === best ? T.spots[1] : null;
      if (v.lamps.spot !== want) { v.lamps.release(); if (want) v.lamps.take(want); }
    }
  }

  setPlayer(v) { this.player = v; if (v) v.driver = 'player'; this.dealLights(); }

  remove(v) {
    const i = this.list.indexOf(v);
    if (i < 0) return;
    this.list.splice(i, 1);
    if (v.lamps) v.lamps.dispose();
    for (const sl of v.body.userData.inkSlots || [v.inkSlot]) releaseHoodSlot(sl);
    const stage = this.game.stage;
    if (v.car) {
      const C = stage.cars, j = C.cars.indexOf(v.car);
      if (j >= 0) C.cars.splice(j, 1);
      for (const m of Object.values(v.car.meshes)) if (m && m.isMesh) this.game.rays.remove(m);
    }
    if (v.body.parent) v.body.parent.remove(v.body);
    if (this.player === v) this.player = null;
  }

  clear() { for (const v of [...this.list]) this.remove(v); }

  update(dt) {
    this.dealT = (this.dealT || 0) - dt;
    if (this.dealT <= 0) { this.dealT = 0.25; this.dealLights(); }
    for (const v of this.list) if (v !== this.player || v.driver !== 'player') v.step(dt);
  }
}
