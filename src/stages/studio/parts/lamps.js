import * as THREE from 'three';
import { Lamps } from '../../../world/Lamps.js';

// The studio's lights: the block's lamp system (world/Lamps.js: the pooled
// real spot lights, three with shadows, the visible cones) without the
// block's posts; every light here is a still's (lamps.addCustom). A lamp may
// carry `shadow: { radius, mapSize, bias, normalBias, near }` for the
// shadowed light it is dealt (a still wants a harder edge than a street
// lamp's soft pool).
function make(stage) {
  const L = Object.create(Lamps.prototype);
  L.world = stage;
  L.lamps = [];
  L.rng = stage.rng.fork(41);
  L._poolTimer = 0;
  L._fwd = new THREE.Vector3();
  L.buildPool();
  L.inst = [];
  L.assign = assign;
  return L;
}

function assign(slot, lamp) {
  Lamps.prototype.assign.call(this, slot, lamp);
  const s = slot.spot;
  if (!slot.shadow) return;
  const S = lamp.shadow || {};
  s.shadow.radius = S.radius ?? 2;
  s.shadow.bias = S.bias ?? -0.0003;
  s.shadow.normalBias = S.normalBias ?? 0.015;
  s.shadow.camera.near = S.near ?? 0.05;
  const size = S.mapSize ?? 2048;
  if (s.shadow.mapSize.x !== size) {
    s.shadow.mapSize.set(size, size);
    if (s.shadow.map) { s.shadow.map.dispose(); s.shadow.map = null; }
  }
  s.shadow.camera.updateProjectionMatrix();
  s.shadow.needsUpdate = true;
}

export default {
  name: 'lamps', order: 50, tick: 40,
  build: (stage) => make(stage),
  update: (lamps, dt, t, camera) => lamps.update(dt, t, camera),
};
