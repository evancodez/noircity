import * as THREE from 'three';
import { START, PIER, PELL, riverPoint, riverFrame, riverSAtZ, EW, NS, FROM_BACKLOT } from '../plan.js';

// Where a man may walk in the city (out of the car: by the wreck on the
// river road, at the pier's gate): the walking colliders' outer net (the
// Hoods' nav grid is built over it, so it is kept to the pier's yard here;
// the scene widens the net round the eye when I get out), the lots and the
// rail as walls for a man on foot (the track part's boxes are the cars').
// The story's places (anchors):
//   city.car.start   my coupe at Pell Lane's kerb (the backlot's MY_CAR)
//   city.sedan.start his sedan ahead of it (the backlot's HIS_CAR)
//   city.river       the river road's north end (the streets open onto it)
//   city.pier.park   where I stop by the pier's gate; city.pier.gate
//   city.diner       where the avenue under the el would go on toward the
//                    block (lane C8's drive back from the pier ends here)
export default {
  name: 'bounds', order: 200,
  build(stage) {
    const C = stage.colliders;
    const Y = PIER.yard;
    C.setBounds(Y.x0 - 4, Y.x1 + 4, Y.z0 - 4, Y.z1 + 4);
    const a = (name, x, z, yaw, extra = {}) => stage.addAnchor(name, { pos: new THREE.Vector3(x, 0, z), yaw, ...extra });
    // (a car's heading is its rotation.y; an eye's yaw looks along (-sin, -cos))
    a('city.car.start', START.my.x, START.my.z, START.my.yaw - Math.PI / 2, { carYaw: START.my.yaw, fromBacklot: FROM_BACKLOT });
    a('city.sedan.start', START.his.x, START.his.z, START.his.yaw - Math.PI / 2, { carYaw: START.his.yaw });
    const s0 = riverSAtZ(EW.market.z), f0 = riverFrame(s0, {});
    a('city.river', f0.x, f0.z, f0.yaw - Math.PI / 2, { carYaw: f0.yaw, s: s0 });
    a('city.pier.park', PIER.park.x, PIER.park.z, PIER.park.yaw - Math.PI / 2, { carYaw: PIER.park.yaw });
    a('city.pier.gate', PIER.gate.x, PIER.gate.z, -Math.PI / 2, { w: PIER.gate.w });
    // (the avenue goes on south past Dock Rd under the el's line: a street
    // end that reads as "the avenue goes on")
    a('city.diner', NS.avenue.x - 1.95, EW.dock.z - 6, Math.PI, { carYaw: -Math.PI / 2 });
    void riverPoint; void PELL;
    return {
      // the net round a point (the scene, as I get out of the car)
      walkAround(x, z, r = 70) { C.setBounds(x - r, x + r, z - r, z + r); },
    };
  },
};
