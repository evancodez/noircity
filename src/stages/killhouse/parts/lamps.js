import * as THREE from 'three';
import { RoomLamps } from '../../office/parts/lamps.js';
import { POSTS, FLOOR } from '../plan.js';

// The killhouse's lamps: the office's lamp system (the block's pool of seven
// real SpotLights, three with shadows; a lamp may carry a `priority`, here
// the house's pendants while the eye is inside) with the block's gooseneck
// posts on the street. The pendants are the house part's (addCustom).
export default {
  name: 'lamps', order: 50, tick: 40,
  build(stage) {
    const L = new RoomLamps(stage);
    L.geo = L.postGeometry();
    L.street = POSTS.map((p) => L.addPost(new THREE.Vector3(p.x, FLOOR, p.z), p.yaw, { real: true }));
    return L;
  },
  update: (L, dt, t, camera) => L.update(dt, t, camera),
};
