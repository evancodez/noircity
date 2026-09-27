import * as THREE from 'three';
import { MAX_LAMPS } from '../render/shaders/common.js';

// Registry of every light that should light rain, steam and the ink rim.
// Lamps, headlights, later muzzle flashes and fires all register here; the
// registry mirrors them into the shared shader uniforms once per frame.
//   entry: { position: Vector3, direction: Vector3, halfAngle, range, intensity, spot?: SpotLight }
export class LightRegistry {
  constructor(U) {
    this.U = U;
    this.entries = [];
    this._tmp = new THREE.Vector3();
  }

  add(entry) {
    entry.intensity = entry.intensity ?? 1;
    entry.halfAngle = entry.halfAngle ?? 0.55;
    entry.range = entry.range ?? 8;
    entry.enabled = entry.enabled ?? true;
    this.entries.push(entry);
    return entry;
  }

  remove(entry) {
    const i = this.entries.indexOf(entry);
    if (i >= 0) this.entries.splice(i, 1);
  }

  // Nearest-first so the most relevant lights win the fixed uniform slots.
  sync(cameraPos) {
    const list = this.entries.filter((e) => e.enabled && e.intensity > 0);
    for (const e of list) e._d2 = e.position.distanceToSquared(cameraPos);
    list.sort((a, b) => a._d2 - b._d2);
    const n = Math.min(list.length, MAX_LAMPS);
    const U = this.U;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      U.uLampPos.value[i].copy(e.position);
      U.uLampDir.value[i].copy(e.direction);
      const omni = e.halfAngle >= Math.PI * 0.99;
      U.uLampParams.value[i].set(omni ? -1 : Math.cos(e.halfAngle), e.range, e.intensity, omni ? 100 : Math.tan(e.halfAngle));
    }
    U.uLampCount.value = n;
    return list;
  }
}
