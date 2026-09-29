// Lane 1's presets (the render guard: reflections, the Look, accents, glass).
import * as THREE from 'three';

const Q = () => new URLSearchParams(location.search);

// reflstudy (fix 8): one frame with four kinds of source and their sheens on
// the street: the left pavement's lamp post at z = -44 (~12.5 m), the lit
// windows of the near building (12-18 m), a burning wreck (~15 m: the grey
// sedan, moved up the avenue for the study) and the headlit sedan under the
// el (~30 m). The eye at 1.65 m looking along the road. Each sheen must
// touch its source's foot and run toward the eye, fading
// (__noir.pipeline.probeStreak(foot) measures one).
function stageReflStudy(stage, camera, controller, game) {
  const cars = stage.cars;
  const car = cars.cars[parseInt(Q().get('wreckcar') ?? '4', 10) || 0];
  cars.startSmoke(car, parseFloat(Q().get('fuse') ?? '1.0'), { force: true });
}

export const presets = {
  reflstudy: { x: 1.2, z: -47.5, y: 0.0, yaw: 0.05, pitch: 0.0, fov: 62, t: 8, stage: stageReflStudy },
};
