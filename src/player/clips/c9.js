import { wrap, OPEN } from '../handPoses.js';

// [C9] The hands of the stills (src/debug/shots/C9_stills.js): a held pose
// each, object first (the thing placed in the eye's frame, the hand solved
// onto it). Never played in a scene.
//   c9tip      the telephone's handset in the right hand, just lifted off
//              its cradle (A TIP. AMES.)
const Cf = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
const BAR = { ...wrap(0.021), t: [1.05, 0.55, 0.75, 0.35, 0.3] };
const at = (p, up, fwd) => ({ frame: 'cam', p, up, fwd });
const HS = (a, F = BAR, e = [0.28, -0.5, 0.02]) => ({ o: 'handset', at: a, F, e, ef: 'cam' });

// the handset up before me, the back of the hand to me, the ear cup above
const TIP = at([0.14, -0.06, -0.45], [0.1, 0.05, 1], [-0.35, -0.93, 0.1]);

export const SOCKETS = {
  // the bar across the palm, the fingers round it, the cups' mouths the
  // fingers' way, the ear end toward the thumb
  handset: { bone: 'hand', p: [-0.004, -0.031, -0.082], basis: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] },
};

export const CLIPS = {
  c9tip: {
    duration: 0.3, hold: true, blocking: false, blend: 0.01, marks: {},
    keys: { R: [[0, HS(TIP)], [0.3, HS(TIP)]] },
    props: [[0, 'take', 'R', 'handset']],
  },
};
void Cf; void OPEN;
