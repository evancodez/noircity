// The hands' poses as data (lane 2 brief P0.1): a pose is one hand's joint
// angles plus its wrist's place and turn in a frame:
//   frame  'cam' (the eye's frame), 'body' (the eye's place, turned only by
//          the body's heading: a hand on the counter stays on the counter
//          when the head turns) or 'gun' (the Tommy gun's own frame)
//   p      the wrist centre [x, y, z] (metres; +x right, +y up, -z ahead)
//   f      where the fingers point (wrist -> knuckles), b where the back of
//          the hand faces (both directions in the frame, true coordinates
//          for either hand)
//   F      { i, m, r, l: [mcp, pip, dip, spread], t: [cmc flex, cmc yaw,
//          cmc roll, mcp, ip] } radians; + curls toward the palm
//   e      the elbow [x, y, z] in the same frame (optional: the set's)
// Poses are named per hand; a left pose written as a mirror of a right one
// is `mirror(name)`. Clips (handClips.js) key these by time.

// finger shorthands: a curl c for all three joints of a finger
const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];
export const OPEN = { i: C(0.08, 0.1, 0.06), m: C(0.1, 0.12, 0.07), r: C(0.12, 0.15, 0.08), l: C(0.14, 0.18, 0.1), t: [0.05, 0.0, 0.0, 0.05, 0.08] };
export const RELAX = { i: C(0.25, 0.35, 0.2), m: C(0.32, 0.45, 0.25), r: C(0.4, 0.52, 0.3), l: C(0.48, 0.6, 0.34), t: [0.15, 0.1, 0.1, 0.15, 0.2] };
export const FIST = { i: C(1.45, 1.75, 0.9, -0.02), m: C(1.5, 1.8, 0.9), r: C(1.52, 1.82, 0.9, 0.02), l: C(1.55, 1.8, 0.9, 0.06), t: [0.55, 0.45, 0.35, 0.55, 0.5] };

// Fingers wrapped round a cylinder of radius Rc (a grip, a glass, a bottle's
// neck): each phalanx a chord of the circle its centre line follows (radius
// Rc + the finger's own), so the joints bend by the half-angles of the
// chords either side; the palm tangent to the cylinder at the knuckles.
// `k` scales the wrap (1 = snug), `only` limits it to some fingers.
const LENS = { i: [0.072, 0.0086], m: [0.08, 0.0088], r: [0.074, 0.0083], l: [0.058, 0.0075] };
export function wrap(Rc, { k = 1, gap = 0.001, spread = {}, thumb = null } = {}) {
  const out = {};
  for (const [n, [len, rf]] of Object.entries(LENS)) {
    const rho = Rc + rf + gap;
    const th = [0.45, 0.3, 0.25].map((u) => 2 * Math.asin(Math.min(1, (len * u) / (2 * rho))));
    out[n] = [k * th[0] / 2, k * (th[0] + th[1]) / 2, k * (th[1] + th[2]) / 2, spread[n] || 0];
  }
  out.t = thumb || [0.5, 0.2, 0.2, 0.3, 0.3];
  return out;
}

// A pose from where the palm is: its surface point `at`, the way the palm
// faces `n` (into what it holds), the way the fingers point `dir` (made
// square to n). The wrist follows: the palm's surface lies 0.018 under the
// hand bone's axis and 0.047 along it.
export function palm(frame, at, n, dir, F, e = null) {
  const nl = Math.hypot(...n), N = n.map((v) => v / nl);
  const d0 = dir.reduce((a, v, i) => a + v * N[i], 0);
  let f = dir.map((v, i) => v - d0 * N[i]);
  const fl = Math.hypot(...f); f = f.map((v) => v / fl);
  const b = N.map((v) => -v);
  const p = at.map((v, i) => v + 0.018 * b[i] - 0.047 * f[i]);
  return { frame, p, f, b, F, e };
}

// mirror a right pose into a left one (x negated in the frame)
export function mirror(P) {
  const m = (v) => (v ? [-v[0], v[1], v[2]] : v);
  return { ...P, p: m(P.p), f: m(P.f), b: m(P.b), e: m(P.e) };
}

const HP = {};
// ---- handstudy: both hands open, palms down, over the counter ---------------------
HP.studyR = { frame: 'body', p: [0.13, -0.31, -0.36], f: [-0.12, -0.08, -1], b: [0, 1, 0.08], F: OPEN, e: [0.24, -0.4, -0.08] };
HP.studyL = mirror(HP.studyR);

// ---- the Tommy gun (fix 3): in the gun's own frame --------------------------------
// right hand on the pistol grip: palm on the grip's right side, the web high
// in the tang, fingers round the front, index on the trigger, thumb over the
// left side; the back of the hand faces right (fitted in handstudy: the
// fingers hug the grip's oval, the thumb's tip lies on the frame's left side)
HP.tommyR = {
  frame: 'gun', p: [0.03, -0.062, 0.18], f: [-0.08, 0.0, -1], b: [1, 0.0, -0.08],
  F: { i: [0.1, 0.42, 0.22, 0.06], m: [0.205, 1.456, 0.771, 0], r: [0.269, 1.34, 0.794, 0], l: [0.189, 0.797, 0.824, 0], t: [0.3, -0.1, 1.036, 0.246, -0.083] },
  e: [0.24, -0.36, 0.14],
};
// left hand on the vertical foregrip: palm on its left side facing right,
// fingers round the front and back along the right side (knuckles a
// vertical row on the front-left), thumb round the back; the back of the
// hand faces left and a little up; the hand tilted up the grip (the wrist
// straight, below and behind)
HP.tommyL = {
  frame: 'gun', p: [-0.056, -0.073, -0.24], f: [0.306, 0.42, -0.846], b: [-0.94, 0.0, -0.34],
  F: { ...wrap(0.018), t: [0.605, -0.161, 1.061, -0.304, 0.948] },
  e: [-0.27, -0.42, 0.05],
};

// ---- the reload (fix 2), the left hand ---------------------------------------------
// frame 'drum': the drum's own (its axis along x, radius 0.0935, the near
// face at x = -0.025: the gun turns its left side to the eye as it comes
// up); the hand rides the drum while it holds it. Elbows in the eye's frame.
const EL = [-0.27, -0.42, 0.05];
// the thumb on the latch: the palm under the drum's front rim, fingers down
// round it, the thumb up to the latch where the drum meets the receiver
HP.tommyLatchL = palm('drum', [-0.012, -0.03, -0.097], [0, 0.25, 1], [-0.1, -1, 0.1],
  { ...wrap(0.085, { k: 0.8 }), t: [0.2, 0.5, 0.2, 0.1, 0.1] }, EL);
// the hand lets the spent drum go and drops out of the bottom of the frame
// (to the coat): below the frame, in the eye's frame
HP.tommyDropL = { frame: 'cam', p: [-0.06, -0.52, -0.3], f: [0.2, 0.55, -0.8], b: [-0.6, -0.1, -0.3], F: RELAX, e: [-0.3, -0.75, 0.15] };
// the fresh drum held by its rim: the palm under the drum, facing up into it,
// the fingers forward and curled up along the rim
HP.tommyRimL = palm('drum', [-0.008, -0.1, 0.012], [0, 1, 0], [-0.15, 0, -1],
  { ...wrap(0.1, { k: 0.85 }), t: [0.55, 0.3, 0.6, 0.2, 0.25] }, EL);
// the push: the palm flat on the drum's near face (the gun's left side is
// the one turned to the eye), seating it
HP.tommyPushL0 = palm('drum', [-0.036, -0.012, 0.01], [1, 0, 0], [0, 0.55, -0.85], OPEN, EL);
HP.tommyPushL = palm('drum', [-0.031, -0.012, 0.01], [1, 0, 0], [0, 0.55, -0.85], { ...OPEN, i: C(0.2, 0.2, 0.1), m: C(0.2, 0.2, 0.1), r: C(0.25, 0.2, 0.1), l: C(0.3, 0.2, 0.1) }, EL);
// the bolt: finger and thumb pinch the cocking knob on top of the receiver
// from its left side, haul it back 55 mm, let it go home
const KNOB = [0, 0.08, -0.11];
HP.tommyBoltL = palm('gun', [-0.02, 0.066, -0.108], [1, 0.15, 0], [0.0, 1, -0.2],
  { i: C(0.9, 1.1, 0.6), m: C(1.0, 1.2, 0.7), r: C(1.1, 1.3, 0.7), l: C(1.2, 1.3, 0.7), t: [0.8, 0.3, 0.5, 0.4, 0.3] }, EL);
HP.tommyBoltBackL = { ...HP.tommyBoltL, p: [HP.tommyBoltL.p[0], HP.tommyBoltL.p[1], HP.tommyBoltL.p[2] + 0.055] };
void KNOB;

// ---- the diner (scene 1): seated at the counter, the body frame --------------------
// (the counter top lies 0.40 below the eye, its front edge ~0.30 ahead: the
// seated eye leans on the counter, Controller 'seated')
HP.restL = { frame: 'body', p: [-0.08, -0.37, -0.47], f: [0.78, -0.08, -0.62], b: [0.05, 1, 0.05], F: RELAX, e: [-0.33, -0.385, -0.3] };
HP.restR = { frame: 'body', p: [0.2, -0.365, -0.39], f: [-0.35, -0.1, -0.93], b: [0.12, 1, 0.08], F: RELAX, e: [0.3, -0.385, -0.2] };

export const HAND_POSES = HP;
