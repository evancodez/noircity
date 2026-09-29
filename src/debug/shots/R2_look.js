import * as THREE from 'three';
import { DINER_SIGHT } from '../../stages/block/site.js';

// Round 2, owner 3 (the look): the presets that prove it.
//   castlight&kind=<k>[&at=<n>]  one figure of the cast standing in the diner's
//                         aisle in the room's own light (the pendants, the
//                         window patches, the end wall behind), seen from 3 m;
//                         at: which stool it stands by (1..9, default 6)
//   castrow               all seven standing along the aisle, seen across it
//                         from inside the door: each figure against the lit
//                         counter and back bar, the same hand as the Hoods
//   dinerair              the diner from the booth end at the ceiling's
//                         height: the pendants' shafts in the smoke, the black
//                         ceiling, the pools, the sheen on the floor
const Q = () => new URLSearchParams(location.search);
const KINDS7 = ['brawler', 'waitress', 'cook', 'oldman', 'couple_her', 'couple_him', 'docker'];

function insideDiner() {
  // (the room's light is dealt as the eye is inside; the shot's eye is)
  DINER_SIGHT.force = null;
}

function stageCastLight(stage, camera, controller) {
  insideDiner();
  const q = Q();
  const kind = q.get('kind') || 'brawler';
  const i = Math.max(1, Math.min(9, parseInt(q.get('at') || '6', 10)));
  const s = stage.anchor('diner.stool.' + i);
  const x = -12.85, z = s.pos.z;
  const ex = x + 1.2, ez = z - 2.9;
  // (turned three-quarters from the eye, as the caststudy has them)
  const c = stage.cast.spawn(kind, { at: { x, z }, yaw: Math.atan2(ex - x, ez - z) + 0.6 });
  c.setState('idle', 0);
  // (from down the aisle, a little below his eye: a pendant and the
  // counter's lit edge behind him)
  controller.setPose(ex, ez, Math.atan2(-(x - ex), -(z - ez)), 0.04, 0.05);
  camera.fov = 50; camera.updateProjectionMatrix();
}

function stageCastRow(stage, camera, controller) {
  insideDiner();
  // (along the aisle, seen across it from the door: the lit counter and
  // back bar behind them)
  const ex = -10.75, ez = 1.0;
  KINDS7.forEach((k, j) => {
    const x = -12.85 + (j % 2 ? -0.2 : 0.2), z = ez + (j - 3) * 1.05;
    const c = stage.cast.spawn(k, { at: { x, z }, yaw: Math.atan2(ex - x, ez - z) + 0.7 });
    c.setState('idle', 0);
  });
  controller.setPose(ex, ez, Math.PI / 2, -0.03, 0.15);
  camera.fov = 78; camera.updateProjectionMatrix();
}

export const presets = {
  castlight: { x: -11.6, z: -1.3, y: 0.15, yaw: 0.4, pitch: 0.0, fov: 50, t: 4.3, stage: stageCastLight },
  castrow: { x: -10.75, z: 1.0, y: 0.15, yaw: Math.PI / 2, pitch: 0.0, fov: 78, t: 4.3, stage: stageCastRow },
  dinerair: { x: -11.0, z: 10.8, y: 0.9, yaw: 0.35, pitch: -0.12, fov: 70, t: 4.3, stage: () => insideDiner() },
};
void THREE;
