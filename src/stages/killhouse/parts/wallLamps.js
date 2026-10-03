import * as THREE from 'three';
import { makeKit } from '../../../props/diner/kit.js';
import { mergeGeos, lathe } from '../../../props/lib.js';
import { officeMats } from '../../office/build/mats.js';
import { STREET, OPENINGS } from '../plan.js';

// The lamps over the warehouse's openings across the street (lane C2): a
// wall lamp over the loading door and over each alley's mouth, its pool on
// the far pavement and the wall lit round the dark - a man coming out of it
// is a shape against the light. (After the lamps part: stage.lamps.)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  name: 'wallLamps', order: 135,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'killhouseWallLamps';
    stage.scene.add(g);
    const kit = makeKit(stage, g), mats = officeMats(), L = stage.lamps, W = STREET.wall;
    const lamps = [];
    for (const o of OPENINGS) {
      const x = (o.x0 + o.x1) / 2, y = o.h + 0.75, z = W - 0.62;
      kit.piece();
      kit.add(mergeGeos([kit.box(x - 0.025, x + 0.025, y + 0.18, y + 0.24, z, W), kit.box(x - 0.08, x + 0.08, y + 0.1, y + 0.4, W - 0.04, W)]), mats.iron, { name: 'kh_wallLampArm' });
      kit.piece();
      kit.add(lathe([[0.02, 0.12], [0.05, 0.08], [0.1, 0.02], [0.2, -0.06], [0.24, -0.11], [0.25, -0.13], [0.23, -0.13]], 24).translate(x, y, z), mats.shade, { name: 'kh_wallLampShade' });
      const bulb = kit.add(new THREE.CircleGeometry(0.17, 20).rotateX(Math.PI / 2).translate(x, y - 0.12, z), mats.bulb, { cast: false, noRay: true });
      const head = V(x, y - 0.14, z), at = V(x, 0, z - 1.6);
      const axis = at.clone().sub(head).normalize();
      const lamp = L.addCustom({ head, axis, height: head.distanceTo(at) + 0.6, half: 0.62, real: true, bulb, fadeEnd: 0.85, edgeSoft: 0.4, strength: 0.55, tag: 'wall' });
      Object.assign(lamp.light, { intensity: 46, angle: 0.85, penumbra: 0.5, distance: 9 });
      lamps.push(lamp);
    }
    return { group: g, lamps };
  },
};
