import * as THREE from 'three';
import { Cars, sedanTemplates } from '../../../world/Cars.js';
import { accent } from '../../../render/accents.js';
import { HIS_CAR, MY_CAR } from '../plan.js';

// The cars on the back street beyond the loose board: his sedan at the kerb
// (its headlamps dark until he is in it: the chase's car beat turns them on
// and drives it away on its own rail), my car behind it, and one parked on
// the far side. They are the block's sedans (world/Cars.js, the same model,
// the same reactions to a round) placed by this stage; `cars` is also what
// fx/React.js and the sound ask every stage for.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  name: 'cars', order: 70, tick: 30,
  build(stage) {
    const C = Object.create(Cars.prototype);
    Object.assign(C, {
      world: stage, cars: [], game: null, fires: [], chains: [],
      rng: stage.rng.fork(4447), limRng: stage.rng.fork(4450), kindRng: stage.rng.fork(4451), fxRng: stage.rng.fork(4452),
    }, sedanTemplates());
    C.his = C.spawn({ pos: V3(HIS_CAR.x, 0, HIS_CAR.z), yaw: HIS_CAR.yaw, lights: true, paint: 'paint' });
    C.cars.push(C.his);
    C.mine = C.spawn({ pos: V3(MY_CAR.x, 0, MY_CAR.z), yaw: MY_CAR.yaw, lights: false, paint: 'paint' });
    C.cars.push(C.mine);
    C.cars.push(C.spawn({ pos: V3(-10.4, 0, -112.0), yaw: -Math.PI / 2 + 0.03, lights: false, paint: 'paintGrey' }));
    // (his lamps are dark until he starts it)
    const h = C.his;
    h.spotI0 = h.spot.intensity;
    h.spot.intensity = 0;
    h.coneI0 = h.cones.map((c) => c.material.uniforms.uIntensity.value);
    for (const c of h.cones) c.material.uniforms.uIntensity.value = 0;
    h.entryI0 = h.entry.intensity;
    h.entry.intensity = 0;
    h.lensOn = h.lens.material;
    h.lens.material = stage.M.glass;
    // his tail lamps (the crew's red): two small lenses on the rear fenders,
    // a dull red until the engine catches, then lit (they glow and streak
    // down the wet street as he goes)
    const tailMat = new THREE.MeshBasicMaterial({ color: accent('crew', { gain: 0.35 }) });
    tailMat.name = 'accent_crew'; tailMat.userData.accent = 'crew';
    const tailGeo = new THREE.SphereGeometry(0.055, 16, 10).scale(0.55, 1, 1);
    for (const z of [0.63, -0.63]) {
      const m = new THREE.Mesh(tailGeo, tailMat);
      m.position.set(-2.36, 0.86, z);
      m.userData.inkId = h.ids.bodyId; m.userData.noRay = true;
      h.group.add(m);
    }
    h.tail = { mat: tailMat, set(k) { tailMat.color.copy(accent('crew', { gain: 0.35 + 5.5 * k })); } };
    stage.onShadowLod((on) => C.shadowLod(on));
    return C;
  },
  update: (C, dt, t, camera) => C.lodUpdate(camera),
};
