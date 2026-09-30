import { HAND_POSES as HP, OPEN, RELAX, PINCH, palm, mirror } from '../handPoses.js';

// The hands in room 304 (lane B2): the door pushed open, the pencil taken
// and its side rubbed across the pad, the sheet torn off into the left hand
// and held at the edge of the frame, the fingers on the safe's dial, the
// handle, the ledger taken out, held up, put inside the coat.
// Where a hand must follow a thing that moves every step (the pencil on
// the paper under the mouse, the dial turning under the fingers) the scene
// writes a LIVE pose: b2liveR / b2liveL are plain pose objects the scene's
// own code rewrites each step (scenes/office/hands.js), shown with
// hands.pose('b2liveR'): object first - the thing's path is authored, the
// hand is solved onto its grip.
const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];

// a pencil held for shading: flat under the fingers, the thumb along it
const SHADE = { i: C(0.35, 0.45, 0.25, -0.03), m: C(0.55, 0.7, 0.4), r: C(0.8, 0.95, 0.5), l: C(0.9, 1.0, 0.5, 0.05), t: [0.55, 0.35, 0.55, 0.25, 0.3] };
// finger and thumb on a dial's knob: a pinch round its rim
const DIAL = { i: C(0.55, 0.7, 0.35, -0.04), m: C(0.6, 0.75, 0.4), r: C(0.9, 1.1, 0.6), l: C(1.0, 1.15, 0.6, 0.05), t: [0.75, 0.35, 0.55, 0.35, 0.3] };
// the sheet held up by its edge between the thumb and the fingers
const SHEET = { i: C(0.25, 0.3, 0.15), m: C(0.3, 0.35, 0.18), r: C(0.4, 0.45, 0.22), l: C(0.5, 0.5, 0.25), t: [0.7, 0.3, 0.5, 0.15, 0.1] };
export const POSES = {
  // (rewritten every step by the scene; these are their first values)
  b2liveR: { frame: 'cam', p: [0.1, -0.25, -0.4], f: [-0.2, -0.3, -0.93], b: [0.4, 0.9, 0], F: SHADE, e: [0.24, -0.45, -0.1] },
  b2liveL: { frame: 'cam', p: [-0.1, -0.25, -0.4], f: [0.2, -0.3, -0.93], b: [-0.4, 0.9, 0], F: OPEN, e: [-0.24, -0.45, -0.1] },
  // the door: the palm flat on the leaf at chest height, the fingers up
  b2pushR: palm('cam', [0.07, -0.1, -0.44], [0.1, 0.05, -1], [-0.05, 1, 0.1], { ...OPEN, t: [0.35, 0.2, 0.1, 0.1, 0.1] }, [0.24, -0.4, -0.12]),
  b2pushFarR: palm('cam', [0.06, -0.09, -0.58], [0.1, 0.05, -1], [-0.05, 1, 0.1], { ...OPEN, t: [0.35, 0.2, 0.1, 0.1, 0.1] }, [0.2, -0.36, -0.28]),
  // the sheet in the left hand, at the frame's lower left, its face to the eye
  b2sheetL: { frame: 'cam', p: [-0.24, -0.27, -0.4], f: [0.35, 0.8, -0.45], b: [-0.75, 0.2, -0.6], F: SHEET, e: [-0.3, -0.55, -0.1] },
  b2sheetUpL: { frame: 'cam', p: [-0.1, -0.16, -0.36], f: [0.3, 0.85, -0.4], b: [-0.6, 0.3, -0.75], F: SHEET, e: [-0.26, -0.5, -0.12] },
  // the right hand into the coat (the inside pocket, off the bottom right) and the handle's grip
  b2coatR: { frame: 'cam', p: [0.12, -0.34, -0.16], f: [-0.55, 0.6, -0.55], b: [0.6, 0.25, -0.75], F: RELAX, e: [0.24, -0.5, 0.05] },
  b2reachR: { frame: 'cam', p: [0.05, -0.18, -0.46], f: [-0.1, -0.2, -0.97], b: [0.5, 0.85, -0.1], F: OPEN, e: [0.2, -0.42, -0.2] },
};
POSES.b2pushL = mirror(POSES.b2pushR);

export const CLIPS = {
  // a hand on the door and a push: it swings in (mark: touch)
  b2_push: {
    duration: 1.0, marks: { touch: 0.3, off: 0.62 },
    keys: { R: [[0, '@rest'], [0.3, 'b2pushR', 'out'], [0.6, 'b2pushFarR', 'io'], [1.0, '@rest', 'in']] },
    view: [[0, {}], [0.3, { fwd: 0.02 }], [0.62, { fwd: 0.05 }], [1.0, {}]],
  },
  // the sheet torn off: the left hand takes its top edge and pulls it free,
  // then brings it to the frame's edge (mark: tear)
  b2_tear: {
    duration: 0.9, marks: { tear: 0.38 },
    keys: { L: [[0, 'b2liveL'], [0.35, 'b2liveL'], [0.62, 'b2sheetUpL', 'out'], [0.9, 'b2sheetL', 'io']] },
    view: [[0, {}], [0.38, { pitch: 0.02 }], [0.9, {}]],
  },
  // the ledger lifted out of the safe (mark: take)
  b2_take: {
    duration: 0.7, marks: { take: 0.35 },
    keys: { R: [[0, '@rest'], [0.35, 'b2reachR', 'out'], [0.7, 'b2reachR']] },
  },
  // into the coat (mark: in)
  b2_coat: {
    duration: 0.8, marks: { in: 0.55 },
    keys: { R: [[0, 'b2reachR'], [0.55, 'b2coatR', 'io'], [0.8, 'b2coatR']] },
    view: [[0, {}], [0.5, { pitch: -0.04 }], [0.8, {}]],
  },
};

// where a held thing sits in the hand (hand-bone frame, a right hand; the
// left takes the mirror): its grip point at p, its own axes (columns) in
// the hand's frame
export const SOCKETS = {
  // the pencil flat under the fingers, its point forward past the index, the lead's side down
  pencil: { bone: 'hand', p: [-0.012, -0.03, -0.075], basis: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] },
  // the sheet between the thumb and the fingers, its face out of the palm
  padSheet: { bone: 'hand', p: [-0.016, -0.016, -0.085], basis: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] },
  ledger: { bone: 'hand', p: [0.0, -0.035, -0.07], basis: [[0, 0, 1], [0, -1, 0], [1, 0, 0]] },
};
void HP; void PINCH; void DIAL;
