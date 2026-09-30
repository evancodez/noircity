// The revolver in the hands (lane B3): the socket that seats the .38 in a
// hand, the 'revolver' set (it replaces the first version's hidden one),
// the rounds' pinch for a reload, and the grip poses another lane holds it
// by (revolverGripR / revolverGripL: B5 holds it out of a car window with
// the left hand: hands.hold(buildProp('revolver'), 'L') and a clip keyed on
// 'revolverGripL').
// The set's hands are posed every step by the weapon itself
// (src/player/weapons/revolver.js, set.pose): the gun's place is authored
// (the draw, the aim, the shot's climb, the reload) and the right hand is
// solved onto its grip; the left hand onto the cylinder or the rounds.
import * as THREE from 'three';
import { wrap, mirror } from '../handPoses.js';

const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];

// Where the gun sits in a right hand, built from the grip in the gun's own
// frame (props/kinds/revolver.js: +x right, +y up, the muzzle -z): the
// hand's little-finger axis runs down the grip's rake (16 degrees back of
// vertical), the back of the hand faces right and a little back (it wraps
// the grip's right-back quarter), the palm's centre sits on the stock's
// right side; the web then lies high on the backstrap under the hammer and
// the knuckles round the front strap. The socket is that placement seen
// from the hand: the gun's origin and axes in the hand-bone frame (-z along
// the hand to the fingers, +y the back of the hand, +x the little finger).
const RAKE = 16 * Math.PI / 180, BACK = 6 * Math.PI / 180;
export const GRIP = { palm: [0.0158, -0.014, 0.009] };
function gripSocket() {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const x = V3(0, -Math.cos(RAKE), Math.sin(RAKE));
  const y = V3(Math.cos(BACK), 0, Math.sin(BACK));
  y.addScaledVector(x, -y.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  // (the palm's centre lies 0.018 under the hand bone's axis, 0.047 along it)
  const O = V3(...GRIP.palm).addScaledVector(y, 0.018).addScaledVector(z, 0.047);
  const M = new THREE.Matrix4().makeBasis(x, y, z).setPosition(O).invert();
  const e = M.elements;
  return { bone: 'hand', p: [e[12], e[13], e[14]], basis: [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]] };
}
export const SOCKETS = {
  revolver: gripSocket(),
  // the loose rounds: the front pair's heads under the pads of the index
  // and middle fingers, the rounds hanging from them out of the palm's side
  // (the hand flat over them as it feeds: it never stands between the eye
  // and the cylinder), the rest behind them in the curl of the fingers
  roundsHand: { bone: 'hand', p: [-0.019, -0.019, -0.142], basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
};

// the fingers on the grip: the three below the trigger guard wrapped round
// the front strap (their knuckles at its right front corner, a right angle
// at the knuckle, the tips on the stock's left side), the index into the
// guard with its pad on the trigger, the thumb along the frame's left side
// under the cylinder, pointing ahead (fitted in the page: lane B3's probe,
// the thumb within 6 mm of its line)
export const GRIP_F = {
  i: [1.3, 0.85, 0.3, -0.06], m: [1.42, 1.3, 0.72, 0], r: [1.48, 1.32, 0.78, 0.03], l: [1.52, 1.28, 0.78, 0.08],
  t: [0.726, 0.709, 1.849, 0.968, 0.162],
};
// the index finger's pull: the pad drawn back, the finger curled in
export const PULL_F = { ...GRIP_F, i: [1.42, 1.1, 0.45, -0.06] };
// the thumb up off the frame onto the hammer's spur (the cock), and drawing
// it back
export const COCK_F = { ...GRIP_F, t: [0.5, 0.45, 1.5, 0.6, 0.45] };
export const COCKED_F = { ...GRIP_F, t: [0.62, 0.6, 1.7, 0.85, 0.3] };
// the left hand: open as it comes, cradling, the palm's strike, the pinch
export const L_OPEN = { i: C(0.18, 0.2, 0.1), m: C(0.2, 0.22, 0.1), r: C(0.24, 0.24, 0.12), l: C(0.28, 0.26, 0.12), t: [0.2, 0.1, 0.2, 0.1, 0.1] };
export const L_CRADLE = { i: C(0.7, 0.8, 0.4), m: C(0.75, 0.85, 0.45), r: C(0.8, 0.9, 0.45), l: C(0.85, 0.9, 0.45), t: [0.35, 0.1, 0.5, 0.3, 0.2] };
export const L_STRIKE = { i: C(0.12, 0.15, 0.08), m: C(0.14, 0.16, 0.08), r: C(0.16, 0.18, 0.09), l: C(0.2, 0.2, 0.1), t: [0.25, 0.1, 0.1, 0.1, 0.05] };
export const L_PINCH = { i: C(0.22, 0.32, 0.18, 0.04), m: C(0.24, 0.34, 0.2, -0.02), r: C(0.9, 1.1, 0.6), l: C(1.0, 1.15, 0.6), t: [0.55, 0.3, 0.6, 0.35, 0.3] };

export const SETS = {
  // bare hands, the coat sleeves (the shirt cuff at the wrist); a gun set
  // (the viewmodel's lens, no breath: the weapon sways it); the right hand
  // posed by the weapon, the left out of sight unless the weapon brings it
  revolver: {
    skin: 'bare', sleeve: 'coat', cuff: true, gun: true, R: 'downR', L: 'downL', hideAtRest: true, brush: 'R',
    pose: (H, side, out) => { const w = H.game.weapons && H.game.weapons.get('revolver'); return w && w.handPose ? w.handPose(H, side, out) : false; },
  },
};

// The grip poses (the eye's frame): the gun held out at the eye's height,
// a little right, canted in (the weapon's ready pose, computed as its
// right hand is: the socket inverted onto the gun's place)
const GUN_READY = { p: [0.16, -0.098, -0.37], yaw: 0.3, pitch: 0.05, roll: 0.12 };
function gripPose(side) {
  const S = SOCKETS.revolver;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(GUN_READY.pitch, GUN_READY.yaw, GUN_READY.roll, 'YXZ'));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...GUN_READY.p), q, new THREE.Vector3(1, 1, 1));
  const sm = new THREE.Matrix4().makeBasis(...S.basis.map((v) => new THREE.Vector3(...v)));
  sm.setPosition(...S.p);
  m.multiply(sm.invert());
  const p = new THREE.Vector3().setFromMatrixPosition(m);
  const f = new THREE.Vector3(0, 0, -1).transformDirection(m), b = new THREE.Vector3(0, 1, 0).transformDirection(m);
  const R = { frame: 'cam', p: p.toArray(), f: f.toArray(), b: b.toArray(), F: GRIP_F, e: [0.25, -0.3, -0.2] };
  return side === 'L' ? mirror(R) : R;
}
export const POSES = {
  revolverGripR: gripPose('R'),
  revolverGripL: gripPose('L'),
};
export { GUN_READY };
