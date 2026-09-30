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

// Where the gun sits in a right hand (hand-bone frame: -z along the hand to
// the fingers, +y the back of the hand, +x the little finger's side): the
// grip's axis (raked 16 degrees back from the gun's -y) runs across the palm
// from the index to the little finger, the back of the hand to the gun's
// right, the web high under the hammer. basis: the gun's own x, y, z axes
// in the hand's frame (columns).
const RAKE = 16 * Math.PI / 180;
const cr = Math.cos(RAKE), sr = Math.sin(RAKE);
// (the hand turned 12 degrees about its own y from square to the grip: the
// wrist below and behind it, as a hand holds a pistol, not a broom)
const TW = 12 * Math.PI / 180;
function gripBasis() {
  const gx = new THREE.Vector3(0, 1, 0);
  const gy = new THREE.Vector3(-cr, 0, sr);
  const gz = new THREE.Vector3(sr, 0, cr);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), TW);
  return [gx, gy, gz].map((v) => v.applyQuaternion(q).toArray());
}
export const SOCKETS = {
  revolver: { bone: 'hand', p: [-0.03, -0.0345, -0.085], basis: gripBasis() },
  // the loose rounds: the front pair pinched between the thumb's pad and the
  // index's first joint, their heads toward the palm
  // (their noses along the fingers, the pair across the hand, the rest of
  // them in the curl of the fingers on the palm's side)
  roundsHand: { bone: 'hand', p: [-0.03, -0.024, -0.128], basis: [[1, 0, 0], [0, 0, 1], [0, -1, 0]] },
};

// the fingers on the grip: the three below the trigger guard wrapped round
// the front strap, the index along the guard's side to the trigger, the
// thumb down the frame's left side (under the cylinder latch)
export const GRIP_F = {
  i: [0.42, 0.95, 0.5, 0.05], m: [...wrap(0.0165).m.slice(0, 3), 0], r: [...wrap(0.0165).r.slice(0, 3), 0.02], l: [...wrap(0.0165).l.slice(0, 3), 0.06],
  t: [0.55, 0.15, 0.85, 0.2, 0.15],
};
// the index finger's pull: the pad on the trigger, the finger curled in
export const PULL_F = { ...GRIP_F, i: [0.55, 1.2, 0.62, 0.05] };
// the thumb up on the hammer's spur (the cock), and drawing it back
export const COCK_F = { ...GRIP_F, t: [0.2, 0.55, 0.9, 0.55, 0.45] };
export const COCKED_F = { ...GRIP_F, t: [0.05, 0.62, 0.85, 0.85, 0.7] };
// the left hand: open as it comes, cradling, the palm's strike, the pinch
export const L_OPEN = { i: C(0.18, 0.2, 0.1), m: C(0.2, 0.22, 0.1), r: C(0.24, 0.24, 0.12), l: C(0.28, 0.26, 0.12), t: [0.2, 0.1, 0.2, 0.1, 0.1] };
export const L_CRADLE = { i: C(0.7, 0.8, 0.4), m: C(0.75, 0.85, 0.45), r: C(0.8, 0.9, 0.45), l: C(0.85, 0.9, 0.45), t: [0.35, 0.1, 0.5, 0.3, 0.2] };
export const L_STRIKE = { i: C(0.12, 0.15, 0.08), m: C(0.14, 0.16, 0.08), r: C(0.16, 0.18, 0.09), l: C(0.2, 0.2, 0.1), t: [0.25, 0.1, 0.1, 0.1, 0.05] };
export const L_PINCH = { i: C(0.62, 0.95, 0.45, -0.04), m: C(1.0, 1.25, 0.7), r: C(1.15, 1.35, 0.75), l: C(1.25, 1.35, 0.75), t: [0.75, 0.42, 0.55, 0.25, 0.2] };

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
const GUN_READY = { p: [0.125, -0.13, -0.5], yaw: 0.014, pitch: 0.016, roll: 0.1 };
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
