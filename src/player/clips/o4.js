// [O4] The shotgun in the hands (src/player/weapons/shotgun.js poses them
// every step, as the revolver's weapon does): the socket that seats it in the
// right hand by its wrist (raked back as the revolver's stocks are, a little
// more: the semi-pistol grip), the two shells pinched in the left fingers
// for the reload, and the 'shotgun' set (gloved, the coat sleeves, a gun set).
import * as THREE from 'three';
import { GRIP, SOCKETS as REV } from './revolver.js';

const RAKE = 24 * Math.PI / 180, BACK = 6 * Math.PI / 180;
function gripSocket() {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const x = V3(0, -Math.cos(RAKE), Math.sin(RAKE));
  const y = V3(Math.cos(BACK), 0, Math.sin(BACK));
  y.addScaledVector(x, -y.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  const O = V3(...GRIP.palm).addScaledVector(y, 0.02).addScaledVector(z, 0.047);
  const M = new THREE.Matrix4().makeBasis(x, y, z).setPosition(O).invert();
  const e = M.elements;
  return { bone: 'hand', p: [e[12], e[13], e[14]], basis: [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]] };
}

export const SOCKETS = {
  shotgun: gripSocket(),
  // (the pair of shells at the fingertips: the revolver's pinch)
  shellsHand: REV.roundsHand,
};

export const SETS = {
  shotgun: {
    skin: 'glove', leather: true, sleeve: 'coat', gun: true, R: 'downR', L: 'downL', hideAtRest: true, brush: 'R',
    pose: (H, side, out) => { const w = H.game.weapons && H.game.weapons.get('shotgun'); return w && w.handPose ? w.handPose(H, side, out) : false; },
  },
};
