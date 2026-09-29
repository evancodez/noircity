import { groundAt } from '../world/Street.js';

// The ground an effect lands on. Outdoors it is the street's kerb profile
// (Street.groundAt, what every accepted frame was printed with); inside a
// stage's dry volume (a room) it is the stage's walking surface
// (stage.surfaceY: the diner's floor, a wave B room's floor).
const _p = { x: 0, y: 0, z: 0 };
export function groundY(stage, x, z, y = 1) {
  const dry = stage && stage.dry;
  if (dry && dry.length && stage.surfaceY) {
    _p.x = x; _p.y = y; _p.z = z;
    for (const b of dry) {
      if (_p.x >= b.min.x && _p.x <= b.max.x && _p.z >= b.min.z && _p.z <= b.max.z && _p.y >= b.min.y && _p.y <= b.max.y) return stage.surfaceY(x, z);
    }
  }
  return groundAt(x);
}
