import * as THREE from 'three';
import { Cars, sedanTemplates } from '../../../world/Cars.js';
import { accent } from '../../../render/accents.js';
import { allocInkId, markFigure } from '../../../render/layers.js';
import { roundedBox, merge } from '../../../world/geom.js';
import { buildCoupe, COUPE } from '../../../vehicles/models.js';
import { HIS_CAR, MY_CAR, MERCER, GARAGE } from '../plan.js';

// [C6] where the car waits in the garage (it drives out north up Mercer Street)
export const MERCER_CAR = { x: (GARAGE.door[0] + GARAGE.door[1]) / 2 + 1.2, z: GARAGE.z0 + 3.0 };

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
    C.cars.push(C.spawn({ pos: V3(-10.4, 0, -112.0), yaw: -Math.PI / 2 + 0.03, lights: false, paint: 'paintGrey' }));
    // [C6] the car in the garage at Mercer Street's foot (it comes out across
    // the chase's way: scenes/watcher/street.js drives it), its lamps lit;
    // one parked up Mercer Street on its east kerb
    C.mercer = C.spawn({ pos: V3(MERCER_CAR.x, 0, MERCER_CAR.z), yaw: Math.PI / 2, lights: true, paint: 'paintGrey' });
    C.cars.push(C.mercer);
    C.cars.push(C.spawn({ pos: V3(MERCER.road[1] - 1.05, 0, -128.5), yaw: Math.PI / 2 + 0.02, lights: false, paint: 'paint' }));
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
    // [R2-C] my car: lane B5's coupe (the one the tail opens in, at its kerb
    // - vehicles/models.js), parked here dark, not one of the block's
    // sedans: the car I get into is the car I drive. Not in C.cars (it is
    // not a sedan's record); its own collider and ink ids. A chrome handle
    // on the kerb side door (the coupe's two doors carry none) - the thing
    // my hand closes over at the end of the scene (mine.handleAt()).
    {
      const model = buildCoupe(stage.M);
      const g = model.group;
      g.position.set(MY_CAR.x, 0, MY_CAR.z);
      g.rotation.y = MY_CAR.yaw;
      // (parked: its lamps dark glass, the dials unlit)
      model.meshes.lens.material = stage.M.glass;
      model.meshes.lens.userData.emitter = false;
      const id = allocInkId(2);
      g.traverse((o) => { if (o.isMesh) { o.userData.inkId = o.userData.inkSub ? id + 1 : id; o.userData.inkFigure = true; } });
      markFigure(g);
      stage.scene.add(g);
      // [C6] its kerb side door a leaf of its own that opens: the door skin
      // of that side cut out of the body's paint, a leaf in its place hinged
      // at its front edge (its panel, its window frame), the handle on it
      cutDoorSkin(model.meshes.paint.geometry);
      const hinge = new THREE.Group();
      hinge.position.set(0.68, 0, 0.705);
      const leafParts = [roundedBox(1.98, 0.6, 0.05, 0.02, 2).translate(-0.99, 0.83, 0.0)];
      const W = COUPE.window, fx0 = W.x0 - 0.68, fx1 = W.x1 - 0.68;
      // (the window's frame on the leaf: sill, top rail, the posts)
      leafParts.push(roundedBox(fx1 - fx0 + 0.06, 0.05, 0.04, 0.012, 1).translate((fx0 + fx1) / 2, W.y1 + 0.02, -0.03));
      leafParts.push(roundedBox(0.05, W.y1 - W.y0 + 0.05, 0.04, 0.012, 1).translate(fx0 - 0.01, (W.y0 + W.y1) / 2, -0.03));
      leafParts.push(roundedBox(0.05, W.y1 - W.y0 + 0.05, 0.04, 0.012, 1).translate(fx1 + 0.01, (W.y0 + W.y1) / 2, -0.03));
      const leaf = new THREE.Mesh(merge(leafParts), model.meshes.paint.material);
      // (its inside: dark trim, a pocket)
      const inner = new THREE.Mesh(roundedBox(1.9, 0.56, 0.02, 0.01, 1).translate(-0.99, 0.84, -0.035), stage.M.rubber);
      hinge.add(leaf, inner);
      const HX = -1.12 - 0.68, HY = 1.0, HZ = 0.04;
      const bar = new THREE.CylinderGeometry(0.011, 0.011, 0.15, 10).rotateZ(Math.PI / 2);
      const stems = [-0.06, 0.06].map((x) => new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6).rotateX(Math.PI / 2).translate(x, 0, -0.025));
      const handle = new THREE.Group();
      handle.position.set(HX, HY, HZ);
      for (const geo of [bar, ...stems]) handle.add(new THREE.Mesh(geo, stage.M.chrome));
      hinge.add(handle);
      hinge.traverse((o) => { if (o.isMesh) { o.userData.inkId = id; o.userData.inkFigure = true; o.castShadow = true; } });
      g.add(hinge);
      g.updateMatrixWorld(true);
      const col = stage.colliders.addBox(MY_CAR.x, MY_CAR.z, COUPE.halfL, COUPE.halfW - 0.06, MY_CAR.yaw, 'car');
      C.mine = {
        group: g, model, collider: col, hinge, open: 0,
        // (the kerb side's: local +z, which the car's yaw turns east; on the leaf)
        handleAt: (out = new THREE.Vector3()) => { hinge.updateMatrixWorld(true); return handle.getWorldPosition(out); },
        handleOut: (out = new THREE.Vector3()) => out.set(0, 0, 1).transformDirection(hinge.matrixWorld),
        // the door open by a (radians, 0 shut)
        setOpen(a) { this.open = a; hinge.rotation.y = a; hinge.updateMatrixWorld(true); },
      };
    }
    stage.onShadowLod((on) => C.shadowLod(on));
    return C;
  },
  update: (C, dt, t, camera) => C.lodUpdate(camera),
};

// [C6] the coupe's kerb side door skin (models.js: a rounded box 1.98 x 0.6 x
// 0.06 at x -0.31, y 0.83, z 0.675) taken out of its merged paint, so the
// leaf that opens in its place shows the cabin behind it, not a second door
function cutDoorSkin(geo) {
  const P = geo.getAttribute('position');
  const inside = (i) => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); return x > -1.34 && x < 0.72 && y > 0.5 && y < 1.16 && z > 0.62 && z < 0.73; };
  if (geo.index) {
    const I = geo.index.array, keep = [];
    for (let t = 0; t < I.length; t += 3) if (!(inside(I[t]) && inside(I[t + 1]) && inside(I[t + 2]))) keep.push(I[t], I[t + 1], I[t + 2]);
    geo.setIndex(keep);
  } else {
    const keep = [];
    for (let t = 0; t < P.count; t += 3) if (!(inside(t) && inside(t + 1) && inside(t + 2))) keep.push(t, t + 1, t + 2);
    geo.setIndex(keep);
  }
}
