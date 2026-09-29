import * as THREE from 'three';

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
HP.studyR = { frame: 'body', p: [0.13, -0.31, -0.5], f: [-0.12, -0.08, -1], b: [0, 1, 0.08], F: OPEN, e: [0.26, -0.36, -0.24] };
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
// (the seat puts the eye 0.12 ahead of the stool: the counter top lies 0.40
// below it, its rolled front edge 0.43 ahead, the pack 0.63 ahead and 0.16
// right, the lighter 0.59 / 0.29, the ashtray 0.67 / -0.32, the glass 0.60 /
// -0.2). The forearms lie on the counter over its edge, the elbows just in
// front of it, off the bottom of the frame. Each resting hand is laid on the
// top by the rig itself (shots/tools/restfit: the wrist and the pads on the
// counter): the palm down, rolled a little onto its little-finger side,
// fingers together and gently curled, their pads on the top, the thumb
// alongside: a hand at rest, not a rake.
const ER = [0.3, -0.33, -0.27], ELc = [-0.3, -0.33, -0.3];
const TREL = [-0.088, -0.121, 0.734, 0.331, 0.102];   // the thumb lying along the index
export const RESTF = { i: C(0.26, 0.42, 0.22, -0.04), m: C(0.24, 0.4, 0.2), r: C(0.24, 0.42, 0.22, 0.03), l: C(0.28, 0.46, 0.24, 0.07), t: TREL };
const RESTFL = { i: C(0.22, 0.38, 0.2, -0.04), m: C(0.24, 0.4, 0.2), r: C(0.28, 0.44, 0.22, 0.03), l: C(0.32, 0.48, 0.25, 0.07), t: TREL };
// the right hand by the pack and the lighter, the left further out, turned in
HP.restR = { frame: 'body', p: [0.19, -0.378, -0.52], f: [-0.28, 0.134, -0.951], b: [0.2, 0.961, 0.135], F: RESTF, e: ER };
HP.restL = mirror({ frame: 'body', p: [0.16, -0.378, -0.56], f: [-0.45, 0.142, -0.879], b: [0.2, 0.958, 0.155], F: RESTFL, e: [-ELc[0], ELc[1], ELc[2]] });
// the cigarette between the first two fingers, the hand resting on the
// counter on its little-finger side, the cigarette's tip up and out
const CIG = { i: C(0.35, 0.45, 0.2, -0.05), m: C(0.35, 0.5, 0.25, 0.05), r: C(0.9, 1.1, 0.6), l: C(1.0, 1.2, 0.6), t: [0.35, 0.2, 0.2, 0.25, 0.25] };
HP.cigRestR = { frame: 'body', p: [0.19, -0.358, -0.52], f: [-0.45, 0.12, -0.88], b: [0.75, 0.62, 0.2], F: CIG, e: ER };
// the left hand cupped round the flame from the far side: its palm turned
// to me and a little right, a shield beyond the flame (the flame burns in
// front of it and lights it), the fingers curled round the far left of it;
// never between the flame and my eye
HP.cupL = palm('cam', [-0.028, -0.132, -0.215], [0.5, 0.2, 0.84], [0.5, 0.8, -0.3],
  { i: C(0.7, 0.75, 0.35), m: C(0.72, 0.78, 0.38), r: C(0.78, 0.8, 0.4), l: C(0.85, 0.85, 0.42), t: [0.25, 0.1, 0.4, 0.2, 0.15] }, [-0.16, -0.42, -0.1]);
// pulling a cigarette from the top of the pack (it stands at (0.16, -0.4, -0.63))
HP.pullR = { frame: 'body', p: [0.22, -0.27, -0.56], f: [-0.55, -0.15, -0.82], b: [0.55, 0.8, -0.2], F: CIG, e: ER };
// the drag: the hand at the lips, the cigarette in them
HP.cigLipsR = { frame: 'cam', p: [0.05, -0.16, -0.11], f: [-0.62, 0.62, -0.48], b: [0.55, 0.15, -0.82], F: CIG, e: [0.2, -0.45, 0.05] };
// pinching the cigarette out of the lips
HP.cigTakeR = { frame: 'cam', p: [0.045, -0.155, -0.1], f: [-0.62, 0.6, -0.5], b: [0.55, 0.15, -0.82], F: { ...CIG, i: C(0.45, 0.55, 0.3, -0.05), m: C(0.5, 0.6, 0.3, 0.05) }, e: [0.2, -0.45, 0.05] };
// over the ashtray (left of the glass): a tap of the index on the cigarette
HP.ashR = { frame: 'body', p: [-0.1, -0.33, -0.6], f: [-0.85, -0.1, -0.5], b: [0.2, 0.97, 0.1], F: CIG, e: [0.22, -0.34, -0.33] };
HP.ashTapR = { ...HP.ashR, p: [-0.1, -0.338, -0.6], F: { ...CIG, i: C(0.2, 0.3, 0.15, -0.05) } };
// the right hand in the coat (the inside pocket: off the bottom right)
HP.coatR = { frame: 'cam', p: [0.16, -0.36, -0.12], f: [-0.5, 0.6, -0.6], b: [0.6, 0.2, -0.8], F: RELAX, e: [0.24, -0.5, 0.05] };
// the left hand opens the wallet (its fingers on the far leaf) and takes a bill
HP.walletOpenL = { frame: 'cam', p: [-0.05, -0.2, -0.26], f: [0.6, 0.55, -0.55], b: [-0.3, 0.6, 0.72], F: { ...OPEN, t: [0.6, 0.3, 0.2, 0.2, 0.2] }, e: [-0.2, -0.45, -0.05] };
HP.billL = { frame: 'cam', p: [-0.07, -0.22, -0.28], f: [0.55, 0.45, -0.7], b: [-0.3, 0.8, 0.5], F: { i: C(0.5, 0.6, 0.3), m: C(0.55, 0.6, 0.3), r: C(0.9, 1.1, 0.6), l: C(1.0, 1.2, 0.6), t: [0.8, 0.4, 0.4, 0.3, 0.2] }, e: [-0.2, -0.45, -0.05] };
HP.billDownL = { frame: 'body', p: [-0.08, -0.372, -0.58], f: [0.5, -0.05, -0.86], b: [0.0, 1, 0.1], F: RESTFL, e: ELc };
// the grips on the counter's things
export const GRIP = {
  pack: { i: C(0.55, 0.9, 0.5), m: C(0.6, 0.95, 0.5), r: C(0.65, 1.0, 0.55), l: C(0.7, 1.0, 0.55), t: [0.9, 0.3, 0.5, 0.3, 0.2] },
  lighter: { i: C(0.9, 1.2, 0.6), m: C(1.0, 1.3, 0.7), r: C(1.1, 1.35, 0.7), l: C(1.2, 1.35, 0.7), t: [0.55, 0.35, 0.6, 0.2, 0.1] },
  flick: { i: C(0.9, 1.2, 0.6), m: C(1.0, 1.3, 0.7), r: C(1.1, 1.35, 0.7), l: C(1.2, 1.35, 0.7), t: [0.55, 0.35, 0.6, 0.55, 0.45] },
  glass: { ...wrap(0.0375), t: [1.15, 0.7, 0.9, 0.45, 0.35] },
  wallet: { i: C(0.25, 0.3, 0.15), m: C(0.3, 0.35, 0.2), r: C(0.4, 0.45, 0.25), l: C(0.5, 0.5, 0.3), t: [0.3, -0.2, 0.3, 0.1, 0.1] },
};
const M4 = (pos, axisUp, fwd) => {
  const y = new THREE.Vector3(...axisUp).normalize(), z0 = new THREE.Vector3(...fwd);
  const x = new THREE.Vector3().crossVectors(y, z0).normalize(), z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(...pos);
};
// pose functions (evaluated once per playing, from the world):
export const DF = {
  // reach and close on a thing where it stands on the counter
  at: (kind, F, e, off = null) => (H, side) => H.holdPoseAt(side, H.propOf(side, kind), F, e, off),
  // reach a thing where it stands, upright, the hand coming from `fwd` (body)
  up: (kind, fwd, F, e, off = null) => (H, side) => H.holdPoseUpright(side, H.propOf(side, kind), fwd, F, e, off),
  // the prop in this hand, held at a place of the eye's frame (up / facing)
  cam: (kind, pos, up, fwd, F, e) => (H, side) => { const p = H.propOf(side, kind); return p ? H.poseForProp(side, p, M4(pos, up, fwd), 'cam', F, e) : null; },
  body: (kind, pos, up, fwd, F, e) => (H, side) => { const p = H.propOf(side, kind); return p ? H.poseForProp(side, p, M4(pos, up, fwd), 'body', F, e) : null; },
};

// ---- the fists (scene 2): the punch-out view, the eye's frame ----------------------
// Fists up in the bottom corners, knuckles to him, thumbs outside (across
// the first two fingers), the left a little ahead; his head, shoulders and
// hands stay clear between and above them. Sleeves pushed up.
// A fist that is a fist: the four fingers curled tight into the palm (MCP
// 85, PIP 105, DIP 75 degrees, the spread closed so they lie side by side),
// the thumb folded across the front of the index and middle fingers' middle
// phalanges, its tip at the middle finger (fitted on the rig: its MCP, IP
// and tip laid on the fingers, not through them)
const FK = [1.484, 1.833, 1.309];
export const FISTF = { i: [...FK, -0.05], m: [...FK, 0], r: [...FK, 0.04], l: [...FK, 0.1], t: [0.384, 0.185, 0.828, 0.664, 0.84] };
// Guard, from my eye: the back of each hand faces me and a little out, the
// hand upright (knuckles on top: a row of four bumps, the first phalanges a
// flat top going away from me), the thumb on the inner side; forearms up
// from the bottom corners, sleeves rolled. Each fist ~170 px wide at
// 1280 x 800, its top ~70 % down the frame, wholly inside it; the left a
// little ahead and higher.
const EFR = [0.29, -0.5, -0.1];
HP.guardR = { frame: 'cam', p: [0.222, -0.205, -0.4], f: [-0.14, 0.8, -0.58], b: [0.36, 0.5, 0.78], F: FISTF, e: EFR };
HP.guardL = { frame: 'cam', p: [-0.205, -0.196, -0.43], f: [0.14, 0.8, -0.58], b: [-0.36, 0.5, 0.78], F: FISTF, e: [-0.29, -0.52, -0.17] };
// the jab: straight at his face down the centre line, turning palm-down at contact
HP.jabR = { frame: 'cam', p: [0.03, -0.075, -0.64], f: [-0.08, 0.1, -0.99], b: [0.0, 1, 0.1], F: FISTF, e: [0.14, -0.3, -0.3] };
HP.jabL = { frame: 'cam', p: [-0.03, -0.07, -0.66], f: [0.08, 0.1, -0.99], b: [0.0, 1, 0.1], F: FISTF, e: [-0.14, -0.3, -0.3] };
// the heavy: the right fist drawn back and down out of the corner, the left
// open forward for balance; then across the frame from low right to high left
HP.windR = { frame: 'cam', p: [0.3, -0.34, -0.2], f: [-0.2, 0.7, -0.68], b: [0.8, 0.3, 0.5], F: FISTF, e: [0.3, -0.5, 0.05] };
HP.balanceL = { frame: 'cam', p: [-0.13, -0.16, -0.46], f: [0.25, 0.45, -0.86], b: [-0.75, 0.55, 0.2], F: OPEN, e: [-0.22, -0.42, -0.2] };
HP.hitR = { frame: 'cam', p: [-0.1, 0.03, -0.6], f: [-0.45, 0.15, -0.88], b: [0.15, 0.95, -0.2], F: FISTF, e: [0.1, -0.2, -0.3] };
HP.hitFollowR = { frame: 'cam', p: [-0.25, -0.02, -0.45], f: [-0.8, 0.0, -0.6], b: [0.0, 0.9, -0.4], F: FISTF, e: [0.02, -0.3, -0.2] };
// the block: both forearms up, vertical, side by side in the lower middle,
// fists at brow height
HP.blockR = { frame: 'cam', p: [0.06, -0.005, -0.26], f: [-0.08, 0.9, -0.43], b: [0.3, 0.4, 0.87], F: FISTF, e: [0.08, -0.34, -0.2] };
HP.blockL = { frame: 'cam', p: [-0.06, -0.005, -0.27], f: [0.08, 0.9, -0.43], b: [-0.3, 0.4, 0.87], F: FISTF, e: [-0.08, -0.34, -0.21] };
// hurt: the fists drop
HP.hurtR = { ...HP.guardR, p: [0.26, -0.36, -0.28] };
HP.hurtL = { ...HP.guardL, p: [-0.24, -0.35, -0.34] };
// grab (what is in reach, low to the right) and the swings
HP.grabR = { frame: 'cam', p: [0.2, -0.3, -0.42], f: [-0.2, -0.3, -0.93], b: [0.7, 0.7, 0.0], F: OPEN, e: [0.25, -0.5, -0.1] };
HP.bottleUpR = { frame: 'cam', p: [0.2, 0.05, -0.12], f: [-0.2, 0.9, 0.35], b: [0.9, -0.2, 0.3], F: FISTF, e: [0.3, -0.25, 0.1] };
HP.bottleDownR = { frame: 'cam', p: [0.02, -0.2, -0.55], f: [-0.1, -0.35, -0.93], b: [0.8, 0.5, -0.2], F: FISTF, e: [0.18, -0.35, -0.25] };
HP.plateInR = { frame: 'cam', p: [0.06, -0.26, -0.22], f: [-0.9, 0.0, -0.4], b: [0.0, 1, 0.0], F: { ...OPEN, i: C(0.5, 0.6, 0.3), m: C(0.5, 0.6, 0.3), r: C(0.55, 0.6, 0.3), l: C(0.6, 0.6, 0.3) }, e: [0.25, -0.45, -0.05] };
HP.plateOutR = { frame: 'cam', p: [0.02, -0.14, -0.62], f: [-0.2, 0.0, -0.98], b: [0.0, 1, 0.0], F: OPEN, e: [0.14, -0.3, -0.3] };
HP.stoolUpR = { frame: 'cam', p: [0.26, 0.02, -0.18], f: [-0.3, 0.9, 0.2], b: [0.9, 0.2, 0.3], F: FISTF, e: [0.32, -0.3, 0.05] };
HP.stoolUpL = { frame: 'cam', p: [0.14, -0.05, -0.2], f: [-0.2, 0.9, 0.2], b: [-0.2, -0.2, 0.95], F: FISTF, e: [-0.05, -0.4, -0.05] };
HP.stoolHitR = { frame: 'cam', p: [-0.2, -0.12, -0.5], f: [-0.8, 0.3, -0.5], b: [0.3, 0.9, 0.0], F: FISTF, e: [0.05, -0.35, -0.2] };
HP.stoolHitL = { frame: 'cam', p: [-0.3, -0.2, -0.38], f: [-0.7, 0.3, -0.6], b: [0.2, -0.3, 0.9], F: FISTF, e: [-0.25, -0.45, -0.1] };
// out on the pavement: the hand into his waistcoat pocket, the matchbook up
HP.downR = { frame: 'cam', p: [0.25, -0.5, -0.25], f: [-0.2, 0.5, -0.8], b: [0.8, 0.3, 0.4], F: RELAX, e: [0.28, -0.7, 0.05] };
HP.downL = mirror(HP.downR);
HP.reachR = { frame: 'cam', p: [0.06, -0.3, -0.5], f: [-0.15, -0.55, -0.82], b: [0.4, 0.8, -0.4], F: OPEN, e: [0.2, -0.45, -0.15] };
HP.pocketR = { frame: 'cam', p: [0.05, -0.36, -0.56], f: [-0.1, -0.7, -0.7], b: [0.5, 0.7, -0.5], F: { ...OPEN, i: C(0.5, 0.6, 0.3), m: C(0.5, 0.6, 0.3), r: C(0.8, 0.9, 0.5), l: C(0.9, 1.0, 0.5), t: [0.6, 0.3, 0.2, 0.3, 0.2] }, e: [0.2, -0.45, -0.15] };
// finger and thumb: the matchbook held up in front
export const PINCH = { i: C(0.7, 0.8, 0.35), m: C(0.9, 1.1, 0.6), r: C(1.2, 1.3, 0.7), l: C(1.3, 1.3, 0.7), t: [0.7, 0.45, 0.4, 0.2, 0.15] };
HP.showR = { frame: 'cam', p: [0.07, -0.16, -0.3], f: [-0.3, 0.75, -0.6], b: [0.5, 0.4, 0.77], F: PINCH, e: [0.18, -0.45, -0.1] };
HP.showTurnR = { frame: 'cam', p: [0.06, -0.155, -0.3], f: [-0.5, 0.7, -0.5], b: [-0.3, 0.45, 0.84], F: PINCH, e: [0.18, -0.45, -0.1] };
HP.pocketAwayR = { frame: 'cam', p: [0.24, -0.46, -0.1], f: [-0.2, 0.6, -0.75], b: [0.8, 0.3, 0.5], F: PINCH, e: [0.28, -0.6, 0.1] };

export const HAND_POSES = HP;
