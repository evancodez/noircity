// Scene 3's hand sockets (lane B1, second pass): where a thing held in a
// pinch sits on the hand bone. Merged into the hands' sockets by Hands.js.
// The pinch (hands.js PINCH, fitted on the rig in node forward kinematics:
// scratch pinchfit.mjs) holds the index's pad and the thumb's pad 32 mm
// apart in front of the palm; the thing held sits between them.
export const SOCKETS = {
  // the wet crumple of paper out of his fist (about 3.5 cm): its middle
  // between the two pads
  paperWad: { bone: 'hand', p: [-0.0349, -0.0535, -0.0998], r: [0, 0, 0] },
};
