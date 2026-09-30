import * as THREE from 'three';
import { PM, lathe, slab } from '../lib.js';

// Lane B5's props (the tail): a stand-in for the revolver out of the car's
// window until lane B3's buildProp('revolver') is in (the scene takes that
// one when it exists). A snub-nosed .38: the frame, the cylinder, a short
// barrel with its front sight, the hammer, the trigger guard, the grip.
// Frame: the grip's middle at the origin, the barrel along +z (its muzzle:
// userData.muzzle), +y up.
export const SPECS = {
  tailRevolver(v, lod) {
    const P = PM();
    const seg = lod ? 12 : 24;
    const by = 0.062;   // the bore's height over the grip's middle
    const barrel = new THREE.CylinderGeometry(0.0075, 0.0078, 0.07, seg).rotateX(Math.PI / 2).translate(0, by, 0.075);
    const shroud = slab(0.012, 0.012, 0.07).translate(0, by - 0.004, 0.075);
    const sight = new THREE.BoxGeometry(0.003, 0.008, 0.012).translate(0, by + 0.012, 0.105);
    const cyl = lathe([[0.0, -0.02], [0.017, -0.02], [0.019, -0.016], [0.019, 0.016], [0.017, 0.02], [0.0, 0.02]], seg).rotateX(Math.PI / 2).translate(0, by - 0.006, 0.018);
    const frame = slab(0.02, 0.034, 0.06).translate(0, by - 0.047, 0.012);
    const top = new THREE.BoxGeometry(0.014, 0.01, 0.07).translate(0, by + 0.014, 0.012);
    const hammer = new THREE.BoxGeometry(0.008, 0.018, 0.012).rotateX(-0.5).translate(0, by + 0.012, -0.022);
    const guard = new THREE.TorusGeometry(0.015, 0.0028, 6, 16, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI).translate(0, by - 0.034, 0.02);
    const trigger = new THREE.BoxGeometry(0.004, 0.016, 0.004).rotateX(0.3).translate(0, by - 0.035, 0.02);
    // the grip, raked back, its butt rounded
    const grip = slab(0.024, 0.085, 0.032, { bevel: 0.006, corner: 0.01 }).translate(0, -0.07, 0).rotateX(0.32).translate(0, 0.02, -0.012);
    return {
      parts: [
        { geo: barrel, mat: P.metal, id: 0 }, { geo: shroud, mat: P.metal, id: 0 }, { geo: sight, mat: P.metal, id: 0 },
        { geo: cyl, mat: P.chrome, id: 1 }, { geo: frame, mat: P.metal, id: 0 }, { geo: top, mat: P.metal, id: 0 },
        { geo: hammer, mat: P.metal, id: 0 }, { geo: guard, mat: P.metal, id: 0 }, { geo: trigger, mat: P.metal, id: 0 },
        { geo: grip, mat: P.dark, id: 2 },
      ],
      grip: [0, 0.0, 0],
      init(g, ud) { ud.muzzle = new THREE.Vector3(0, by, 0.112); },
    };
  },
};
