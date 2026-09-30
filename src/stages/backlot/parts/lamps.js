import * as THREE from 'three';
import { Lamps } from '../../../world/Lamps.js';
import { tagInk, markFigure } from '../../../render/layers.js';
import { lathe, merge, tube, V3 } from '../../../world/geom.js';

// The backlot's lamps: the block's lamp system (world/Lamps.js: the cones,
// the registry entries for the rain and the rim, the pool of seven real
// SpotLights dealt to the nearest, three with shadows) without the block's
// own posts. It is a Lamps (the pipeline, the rounds and fx/React.js read
// stage.lamps as one), with the backlot's kinds:
//   post(x, z, yaw)        a gooseneck street lamp (the block's model)
//   wall(x, y, z, nx, nz)  a lamp on a bracket out of a wall, its dish
//                          aimed down and a little out from the wall
//   hang(x, y, z)          a shade on a rod (under a bracket, a wire)
// The pool's lamps are chosen every 0.25 s from those that are `on` and
// real; the rest keep their cones, bulbs and wet sheens.
export default {
  name: 'lamps', order: 50, tick: 40,
  build(stage) {
    const L = Object.create(Lamps.prototype);
    L.world = stage;
    L.lamps = [];
    L.rng = stage.rng.fork(41);
    L._poolTimer = 0;
    L._fwd = new THREE.Vector3();
    L.geo = L.postGeometry();
    L.buildPool();
    const { M, scene } = stage;
    // a wall bracket: an iron arm 0.7 m out of the wall, a small enamel dish
    // (local frame: the wall's normal is +x, up +y)
    const arm = [V3(0, 0, 0), V3(0.22, 0.1, 0), V3(0.5, 0.14, 0), V3(0.68, 0.04, 0), V3(0.72, -0.1, 0)];
    const bracketGeo = merge([
      tube(arm, 0.026, 8, 28),
      new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16).rotateZ(Math.PI / 2).translate(0.02, 0, 0),
      new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8).rotateZ(-0.9).translate(0.18, -0.2, 0),
    ]);
    const dishGeo = lathe([[0.02, 0.05], [0.05, 0.03], [0.13, -0.04], [0.23, -0.12], [0.27, -0.15], [0.25, -0.15]], 28).translate(0.72, -0.1, 0);
    const discGeo = new THREE.CircleGeometry(0.2, 32).rotateX(Math.PI / 2).translate(0.72, -0.24, 0);
    L.post = (x, z, yaw, { real = true, y = 0.15 } = {}) => L.addPost(V3(x, y, z), yaw, { real });
    L.wall = (x, y, z, nx, nz, { real = true, out = 0.35, height = null, strength = 1, half = 0.5 } = {}) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = Math.atan2(-nz, nx);
      const iron = new THREE.Mesh(bracketGeo, M.lampIron);
      iron.castShadow = true;
      const shade = new THREE.Mesh(dishGeo, M.lampShade);
      shade.castShadow = true;
      const bulb = new THREE.Mesh(discGeo, M.bulb);
      g.add(iron, shade, bulb);
      tagInk(g);
      markFigure(shade);
      scene.add(g);
      g.updateMatrixWorld(true);
      const head = V3(0.72, -0.25, 0).applyMatrix4(g.matrixWorld);
      const axis = V3(nx * out, -1, nz * out).normalize();
      const h = height ?? (head.y / Math.max(0.3, -axis.y)) * 0.97;
      const lamp = L.addCustom({ head, axis, height: h, half, real, bulb, fadeEnd: 0.9, edgeSoft: 0.25, strength, tag: 'wall' });
      lamp.group = g;
      lamp.sconce = true;
      g.traverse((o) => { if (o.isMesh) o.userData.lamp = lamp; });
      return lamp;
    };
    L.hang = (x, y, z, { real = true } = {}) => L.addHanging(V3(x, y, z), { real });
    return L;
  },
  update: (L, dt, t, camera) => L.update(dt, t, camera),
};
