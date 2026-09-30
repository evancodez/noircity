// The hands in scene 1 (the diner), object first (Wave A round 2, owner 2).
// Wherever a hand meets a thing, the THING's path is authored - where it
// stands, how it rises, where it tips - and the hand is solved onto its grip
// at every step (Hands.objBetween): an object key is
//   [t, { o: kind, at, F, e, ef, off }, ease]
// (see Hands.objMatrix for `at`). Plain hand keys (a pose name, '@rest', a
// pose def) move a hand that holds nothing. The timing marks keep the names
// the scenes read (hands.clip(name).marks).
// Frames: 'body' is the seated eye's place turned by the body's heading (a
// thing on the counter stays on the counter when the head turns), 'cam' the
// eye itself (a thing at the lips goes where the head goes). +x right, +y
// up, -z ahead; metres. The counter's top lies 0.40 under the eye, its front
// edge 0.43 ahead.
import * as THREE from 'three';
import { GRIP, OPEN, RELAX, wrap, palm, HAND_POSES as HP } from '../handPoses.js';

const C = (mcp, pip = mcp * 1.15, dip = pip * 0.7, s = 0) => [mcp, pip, dip, s];

// ---- the glass (the left hand) ------------------------------------------------------
// The hand comes to it from the left, open; the palm on its far left, the
// fingers round its far wall, the thumb on its near wall; its forearm from
// the left and near (the wrist is the glass's +z in the hand: GF).
const GF = [-0.5, 0, 0.87];
// the fingers open in a C as the hand comes in (a glass-and-a-half wide),
// then closed on the wall
const GLASS_OPEN = { ...wrap(0.058, { k: 0.8 }), t: [0.7, 0.35, 0.5, 0.15, 0.1] };
// (fitted on the rig with the glass in the hand: every finger joint and the
// thumb's tip 1 mm off the tumbler's wall, the fingers round the far wall,
// the thumb along the near one; R2 probe, scratch fit_grip)
const GLASS_GRIP = { i: [0.695, 0.28, 0.359, 0], m: [0.78, 0.365, 0.416, 0], r: [0.722, 0.294, 0.373, 0], l: [0.617, 0.095, 0.204, 0], t: [0.931, 0.032, -0.033, 0.809, -0.703] };
const ELG = [-0.3, -0.34, -0.3];
const ELUP = [-0.19, -0.42, -0.08];
const G = (at, F = GLASS_GRIP, e = ELG, extra = {}) => ({ o: 'glass', at, F, e, ...extra });
const here = (d = null) => ({ here: true, d, up: [0, 1, 0], fwd: GF });
// the glass at the lips (cam frame): its near rim on the lower lip, tipped
// `deg` toward the face about the eye's x axis; the base goes up and away
// as it tips, so what shows is the far rim low in the frame
// (at the lips the forearm stands under the glass: the wrist below it,
// a little to the right, so the hand is under the glass and mostly below
// the frame; the fingers' tips show round the far rim)
const GFL = [0.25, -1, 0];
const LIP = [0.0, -0.1, -0.036], R = 0.0375, H = 0.085;
function atLips(deg, dx = 0) {
  const a = deg * Math.PI / 180;
  const up = [0, Math.cos(a), Math.sin(a)];
  // the rim's nearest point to the face is the rim point along +z (square to up)
  const n = [0, -Math.sin(a), Math.cos(a)];
  const rc = [LIP[0] + dx - n[0] * R, LIP[1] - n[1] * R, LIP[2] - n[2] * R];
  const base = rc.map((v, i) => v - up[i] * H);
  return { frame: 'cam', p: base, up, fwd: GFL };
}
// held up before the chest (body frame), upright
const chest = (p) => ({ frame: 'body', p, up: [0, 1, 0], fwd: GF });

// ---- lighting up -----------------------------------------------------------------------
// The right hand takes the pack (it stands by the right hand) and lifts it
// before the chest, its top tipped to the left; the left hand's first two
// fingers draw a cigarette from it and put it between the lips; the pack
// goes back down; the right hand takes the lighter, holds it up before me:
// the thumb flips the lid, rolls the wheel, the flame stands; up to the tip
// in the lips (the head bows to it a little); the tip catches; down; the
// thumb shuts the lid; the lighter back where it lay.
const mat = (p, up, fwd) => {
  const y = new THREE.Vector3(...up).normalize(), z0 = new THREE.Vector3(...fwd);
  const x = new THREE.Vector3().crossVectors(y, z0).normalize(), z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(...p);
};
// the pack lifted (body frame): before the right of the chest, its label to
// me, its top tipped to the left and toward me
const PACK_UP = mat([0.06, -0.27, -0.42], [-0.34, 0.9, 0.26], [0.3, 0, 1]);
// a cigarette in it, filter up (its +y, filter to tip, down the pack), drawn
// `dy` up out of it
// (turned about itself so the left hand comes to it from above, its back to
// me, the pack's label clear below it)
const CTH = Math.PI;
const cigInPack = (dy) => ({ frame: 'body', m: PACK_UP.clone().multiply(new THREE.Matrix4().makeRotationZ(Math.PI).setPosition(0.012, 0.098 + dy, 0)).multiply(new THREE.Matrix4().makeRotationY(CTH)) });
// between the lips (the eye's frame): its filter at the mouth, tip forward and down
const MOUTH = [0, -0.088, -0.07], MOUTH_DIR = [0.02, -0.1, -1];
// (turned so the fingers that hold it are under it and to the left: the
// hand passes below the frame as it puts it in the lips)
const CFW = [-1, 0, 0];
const cigLipsAt = (d = [0, 0, 0]) => ({ frame: 'cam', p: MOUTH.map((v, i) => v + d[i]), up: MOUTH_DIR, fwd: CFW });
// the lighter held up before me (body frame), its face to me, upright
const LIGHTER_UP = { frame: 'body', p: [0.08, -0.215, -0.36], up: [0, 1, 0], fwd: [-0.15, 0, 1] };
// at the tip (the eye's frame, the head bowed `bow` rad more than the seat's
// -0.14): upright in the room, the tip in the flame's upper third (the wick
// 1.9 cm under the flame's foot, the tip 2 cm up the flame)
function lighterAtTip(bow = 0) {
  const p = -0.14 - bow;
  const up = [0, Math.cos(p), -Math.sin(p)];
  const d = MOUTH_DIR.map((v) => v / Math.hypot(...MOUTH_DIR));
  // (the flame a hair beyond the tip, so seen from the eyes looking down
  // at it the tip is in the flame, not over its foot)
  const tip = MOUTH.map((v, i) => v + d[i] * 0.093);
  const base = tip.map((v, i) => v - up[i] * (0.056 + 0.017) + (i === 0 ? 0.004 : 0));
  return { frame: 'cam', p: base, up, fwd: [-0.1, 0, 1] };
}
// fingers: the pack held between the thumb (on its top edge) and the
// fingers round its far side; the lighter the same, the thumb on the lid
// or the wheel; the first two fingers' pinch on a cigarette
// (the lighter's fitted on the rig, the lighter in the hand: the fingers 1 mm
// off its case below the lid, the thumb's tip resting on the lid's face, under
// the lid's free edge to flip it, on top of the wheel to roll it - R2 probe,
// scratch fit_box)
const LF = { i: [1.645, 1.056, 0.476, 0], m: [1.788, 1.062, 0.341, 0], r: [1.768, 1.037, 0.352, 0], l: [1.9, 1.146, 0.429, 0] };
const LIGHTER_GRIP = { ...LF, t: [0.507, 0.851, 1.608, 0.86, 1.515] };
const LID = { ...LF, t: [-0.526, -0.345, -0.303, 1.421, 0.361] };
const FLICK = { ...LF, t: [-1.195, 0.27, 0.005, 1.796, 0.489] };
// (the thumb after the roll: off the wheel, down the side)
const FLICKED = { ...LF, t: [-0.9, 0.3, 0.1, 1.2, 0.2] };
const PACK_GRIP = GRIP.pack;
const HOPEN = { ...wrap(0.05, { k: 0.6 }), t: [0.45, 0.25, 0.4, 0.1, 0.05] };
const CIGF = HP.cigRestR ? HP.cigRestR.F : RELAX;
const PINCH_OPEN = { ...CIGF, i: C(0.3, 0.3, 0.15, -0.14), m: C(0.3, 0.35, 0.15, 0.12) };
const ER_ = [0.3, -0.34, -0.27], ERUP = [0.2, -0.44, -0.02];
const PK = (at, F = PACK_GRIP, extra = {}) => ({ o: 'cigarettePack', at, F, e: ER_, ...extra });
const LT = (at, F = LIGHTER_GRIP, extra = {}) => ({ o: 'lighter', at, F, e: ER_, ...extra });
const CG = (at, F = CIGF, extra = {}) => ({ o: 'cigarette', at, F, e: [-0.26, -0.38, -0.2], ...extra });
const hereD = (d) => ({ here: true, d });
const LIGHT = {
  duration: 5.0, marks: { tap: 0.62, lips: 1.9, spark: 3.08, flame: 3.12, lit: 3.78, shut: 4.28 },
  keys: {
    R: [
      [0, '@rest'],
      [0.36, PK('here', HOPEN, { off: [0.03, 0.05, 0.03] })],
      [0.5, PK('here', HOPEN, { off: [0, 0.004, 0] }), 'out'],
      [0.62, PK('here')],
      [0.98, PK({ frame: 'body', m: PACK_UP })],
      [1.55, PK({ frame: 'body', m: PACK_UP })],
      [1.85, PK(hereD([0, 0.012, 0]))],
      [1.95, PK('here')],
      [2.05, PK('here', HOPEN, { off: [0.03, 0.04, 0.0] })],
      [2.25, LT('here', HOPEN, { off: [0.03, 0.05, 0.02] })],
      [2.38, LT('here', HOPEN, { off: [0, 0.003, 0] }), 'out'],
      [2.48, LT('here')],
      [2.8, LT(LIGHTER_UP)],
      [2.88, LT(LIGHTER_UP, LID)],
      [2.96, LT(LIGHTER_UP, LIGHTER_GRIP)],
      [3.02, LT(LIGHTER_UP, LIGHTER_GRIP)],
      [3.1, LT(LIGHTER_UP, FLICK), 'snap'],
      [3.45, LT(lighterAtTip(), FLICK, { e: ERUP, ef: 'cam' })],
      [3.95, LT(lighterAtTip(), FLICK, { e: ERUP, ef: 'cam' })],
      [4.2, LT(LIGHTER_UP, LIGHTER_GRIP)],
      [4.26, LT(LIGHTER_UP, LID)],
      [4.34, LT(LIGHTER_UP, LIGHTER_GRIP)],
      [4.62, LT(hereD([0, 0.01, 0]))],
      [4.7, LT('here')],
      [5.0, '@rest'],
    ],
    L: [
      [0, '@rest'],
      [0.95, '@rest'],
      [1.18, CG(cigInPack(0), PINCH_OPEN, { off: [0, 0.015, 0.02] })],
      [1.28, CG(cigInPack(0), CIGF)],
      [1.52, CG(cigInPack(0.07), CIGF)],
      // ([B3] the hand kept under the frame on its way to the lips: the
      // cigarette goes down under the chin first and rises into the mouth
      // from below - it had swept across the eye at 17 cm)
      [1.66, CG(cigLipsAt([0.012, -0.1, -0.1]), CIGF, { e: [-0.2, -0.5, -0.06], ef: 'cam' })],
      [1.78, CG(cigLipsAt([0.004, -0.03, -0.05]), CIGF, { e: [-0.18, -0.46, -0.04], ef: 'cam' })],
      [1.9, CG(cigLipsAt(), CIGF, { e: [-0.18, -0.46, -0.04], ef: 'cam' })],
      // (and let go, the hand drops straight down out of the frame before it
      // goes back to the counter)
      [2.04, { frame: 'cam', p: [-0.05, -0.3, -0.16], f: [0.25, 0.55, -0.8], b: [-0.55, 0.3, 0.78], F: CIGF, e: [-0.2, -0.62, 0.02] }, 'in'],
      [2.35, '@rest'],
    ],
  },
  props: [[0, 'take', 'L', 'cigarette'], [0, 'show', 'L', 0], [0.62, 'take', 'R', 'cigarettePack'], [1.24, 'show', 'L', 1], [1.9, 'toMouth', 'L'], [1.95, 'put', 'R'],
    [2.48, 'take', 'R', 'lighter'], [2.9, 'open', 'R', 1], [3.08, 'strike', 'R', 2.4], [3.12, 'flame', 'R', 1], [3.78, 'tip', 'M', 'lit'], [4.15, 'flame', 'R', 0], [4.28, 'open', 'R', 0], [4.7, 'put', 'R']],
  // (the head bows a little to the flame, and comes back up)
  // (the eyes go down to the flame at the lips and come back: the head and
  // what it holds stay put - view key 'eyes')
  // (polish: the eyes no longer drop 0.34 rad to the flame - it brought the
  // whole cigarette up into the view as a fat white post from the bottom
  // edge; the eyes stay level and the tip, its flame and the lighter's top
  // rise just into the bottom of the frame, low and centre)
  view: [[0, {}], [5.0, {}]],
  brush: 'R',
};

// ---- paying ------------------------------------------------------------------------------
// The right hand brings the wallet from the inside pocket, shut, and holds
// it up before me, its back in the palm; the left hand takes the free edge
// of its cover and swings it open like a book: the licence shows, to me,
// then turned a little to my right, where a man two stools down can see it;
// the left fingers draw a bill from the cover's pocket and lay it flat on
// the counter; the wallet shuts with a turn of the wrist and goes back.
const WW = 0.105, WT = 0.0065;
const wal = (p, up, fwd) => mat(p, up, fwd);
// held up (the eye's frame): its face tipped up to me, its top edge (-z) up
const W_UP = wal([0.035, -0.15, -0.37], [0, 0.3, 1], [0, -1, 0.3]);
// the same, turned 0.4 rad to my right (about the eye's up), for him
const W_SHOW = new THREE.Matrix4().makeRotationY(-0.3).multiply(W_UP.clone().setPosition(0, 0, 0)).setPosition(0.05, -0.15, -0.37);
const W_COAT = wal([0.17, -0.37, -0.13], [0.7, 0.2, 0.7], [0, -1, 0.3]);
// the cover's free edge and its outside, in the wallet's frame, opened k
function coverEdge(k) {
  const e = k * k * (3 - 2 * k), th = Math.PI * (1 - e);
  const P = new THREE.Vector3(-WW / 2, 1.5 * WT, 0);
  const edge = P.clone().add(new THREE.Vector3((-WW + 0.012) * Math.cos(th), (-WW + 0.012) * Math.sin(th), 0));
  const out = new THREE.Vector3(Math.sin(th), -Math.cos(th), 0);
  const toward = new THREE.Vector3(-Math.cos(th), -Math.sin(th), 0);
  return { edge, out, toward };
}
// the left hand on the cover's edge (a pose of the eye's frame): the fingers'
// pads on its outside, their tips round the edge, the thumb inside
const EDGE_F = { i: C(0.35, 0.9, 0.6), m: C(0.4, 0.95, 0.6), r: C(0.5, 1.0, 0.6), l: C(0.6, 1.0, 0.6), t: [0.9, 0.4, 0.5, 0.3, 0.2] };
function coverHand(W, k, back = 0) {
  const { edge, out, toward } = coverEdge(k);
  const R = new THREE.Matrix3().setFromMatrix4(W);
  const at = edge.clone().addScaledVector(toward, -0.028).addScaledVector(out, 0.004 + back).applyMatrix4(W);
  const n = out.clone().negate().applyMatrix3(R).normalize();
  const dir = toward.clone().applyMatrix3(R).normalize();
  return palm('cam', at.toArray(), n.toArray(), dir.toArray(), EDGE_F, [-0.2, -0.45, -0.08]);
}
// the bill in the cover's pocket (the wallet's frame, the cover open):
// lengthwise out of it toward the wallet's top edge, drawn `dz`
const billIn = (W, dz) => ({ frame: 'cam', m: W.clone().multiply(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)).setPosition(-0.1, 1.5 * WT + WT / 2 + 0.0016, 0.02 - dz)) });
// flat on the counter before me, to the left of my hands (body frame)
const BILL_DOWN = { frame: 'body', p: [-0.03, -0.3985, -0.56], up: [0, 1, 0], fwd: [0.25, 0, 1] };
const WALLET_F = GRIP.wallet;
const PINCH_BILL = { i: C(0.55, 0.7, 0.35), m: C(0.9, 1.1, 0.6), r: C(1.2, 1.3, 0.7), l: C(1.3, 1.3, 0.7), t: [0.75, 0.45, 0.45, 0.2, 0.15] };
const WL = (m, F = WALLET_F) => ({ o: 'wallet', at: { frame: 'cam', m }, F, e: [0.22, -0.46, -0.06], ef: 'cam' });
const BL = (at, F = PINCH_BILL, e = [-0.22, -0.45, -0.1], ef = 'cam') => ({ o: 'bill', at, F, e, ef });
const PAY = {
  duration: 3.6, marks: { open: 1.1, shown: 1.6, shownEnd: 2.35, bill: 2.72 },
  keys: {
    R: [
      [0, '@rest'],
      [0.3, 'coatR'],
      [0.42, WL(W_COAT)],
      [0.85, WL(W_UP)],
      [1.45, WL(W_UP)],
      [1.65, WL(W_SHOW)],
      [2.4, WL(W_SHOW)],
      [2.65, WL(W_UP)],
      [2.95, WL(W_COAT)],
      [3.05, 'coatR'],
      [3.6, '@rest'],
    ],
    L: [
      [0, '@rest'],
      [0.75, '@rest'],
      [0.98, coverHand(W_UP, 0, 0.02)],
      [1.05, coverHand(W_UP, 0)],
      [1.2, coverHand(W_UP, 0.35)],
      [1.4, coverHand(W_UP, 1)],
      [1.5, coverHand(W_UP, 1, 0.03)],
      [1.72, BL(billIn(W_SHOW, 0), { ...PINCH_BILL, t: [0.5, 0.3, 0.3, 0.1, 0.05] })],
      [1.85, BL(billIn(W_SHOW, 0))],
      [2.1, BL(billIn(W_SHOW, 0.075))],
      [2.55, BL({ ...BILL_DOWN, p: [BILL_DOWN.p[0], BILL_DOWN.p[1] + 0.03, BILL_DOWN.p[2]] }, PINCH_BILL, [-0.3, -0.36, -0.28], 'body')],
      [2.72, BL(BILL_DOWN, PINCH_BILL, [-0.3, -0.36, -0.28], 'body')],
      [2.85, BL(BILL_DOWN, OPEN, [-0.3, -0.36, -0.28], 'body')],
      [3.3, '@rest'],
    ],
  },
  opens: { R: [[0.95, 0], [1.05, 0], [1.4, 1], [2.42, 1], [2.62, 0]] },
  props: [[0.42, 'take', 'R', 'wallet'], [0, 'take', 'L', 'bill'], [0, 'show', 'L', 0], [1.85, 'show', 'L', 1], [2.72, 'put', 'L'], [3.05, 'drop', 'R']],
  brush: 'R',
};

// ---- the cigarette: a drag, the ash ----------------------------------------------------
// A drag: the right hand comes up to the cigarette (in the lips after the
// light, else in its fingers), its first two fingers on it at the lips, the
// ember flares, the hand takes it away and down to the counter; the smoke
// breathed out (mark exhale) drifts up into the lamp's cone. The hand at the
// lips is turned so that it lies under the cigarette, mostly below the frame.
const CRW = [1, 0, 0];
const cigLipsR = (d = [0, 0, 0]) => ({ frame: 'cam', p: MOUTH.map((v, i) => v + d[i]), up: MOUTH_DIR, fwd: CRW });
const CR = (at, F = CIGF, extra = {}) => ({ o: 'cigarette', at, F, e: [0.2, -0.46, -0.04], ef: 'cam', ...extra });
const DRAG = {
  duration: 2.3, marks: { glow: 0.62, exhale: 1.55 },
  keys: { R: [
    [0, '@rest'],
    [0.3, CR(cigLipsR([0.01, -0.035, -0.06]))],
    [0.42, CR(cigLipsR())],
    [1.0, CR(cigLipsR())],
    [1.22, CR(cigLipsR([0.01, -0.035, -0.07]))],
    [1.75, 'cigRestR'],
  ] },
  props: [[0.42, 'fromMouth', 'R'], [0.5, 'glow', 'R', 3], [1.0, 'glow', 'R', 1]],
  brush: 'R',
};
// The ash: the cigarette goes over the ashtray (it stands at my left: the
// hand goes over the left hand in an arc), the index taps it, the ash falls
// in the tray; back to rest.
const ashAt = (drop = 0) => (H) => {
  const a = H.item('ashtray');
  if (!a) return null;
  a.updateMatrixWorld(true);
  const F = H.frames();
  H.vm.root.updateMatrixWorld(true);
  const Bw = new THREE.Matrix4().multiplyMatrices(H.vm.root.matrixWorld, F.body);
  const R = new THREE.Matrix4().extractRotation(Bw);
  const tip = a.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.045 + drop, 0));
  // (pointing left and a little away and down, from the right hand to the tray)
  const dir = new THREE.Vector3(-1, -0.28, -0.35).normalize().applyMatrix4(R);
  const up = new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(dir, up).normalize(), z = new THREE.Vector3().crossVectors(x, dir);
  const m = new THREE.Matrix4().makeBasis(x, dir, z);
  m.setPosition(tip.addScaledVector(dir, -0.075));
  return m;
};
const TAPF = { ...CIGF, i: C(0.15, 0.25, 0.1, -0.05) };
const ASH = {
  duration: 1.25, marks: { tap: 0.62 },
  keys: { R: [
    [0, 'cigRestR'],
    [0.28, { frame: 'body', p: [0.02, -0.26, -0.56], f: [-0.8, -0.1, -0.55], b: [0.15, 0.97, 0.1], F: CIGF, e: [0.24, -0.34, -0.3] }],
    [0.5, { o: 'cigarette', at: ashAt(0), F: CIGF, e: [0.1, -0.34, -0.36] }],
    [0.62, { o: 'cigarette', at: ashAt(-0.005), F: TAPF, e: [0.1, -0.34, -0.36] }, 'snap'],
    [0.72, { o: 'cigarette', at: ashAt(0), F: CIGF, e: [0.1, -0.34, -0.36] }],
    [0.95, { frame: 'body', p: [0.02, -0.26, -0.56], f: [-0.8, -0.1, -0.55], b: [0.15, 0.97, 0.1], F: CIGF, e: [0.24, -0.34, -0.3] }],
    [1.25, 'cigRestR'],
  ] },
  props: [[0.62, 'dropAsh', 'R']],
  brush: 'R',
};

// (paying: the cigarette goes into the lips first - the right hand is
// needed for the wallet - then the wallet as above, 0.4 s later)
function shifted(c, dt) {
  const k = (arr) => arr.map((e) => [e[0] + dt, ...e.slice(1)]);
  return {
    ...c, duration: c.duration + dt,
    marks: Object.fromEntries(Object.entries(c.marks).map(([m, t]) => [m, t + dt])),
    keys: Object.fromEntries(Object.entries(c.keys).map(([h, K]) => [h, k(K)])),
    props: c.props ? k(c.props) : undefined,
    opens: c.opens ? Object.fromEntries(Object.entries(c.opens).map(([h, K]) => [h, k(K)])) : undefined,
  };
}
const PAY_FIRST = 0.4;
const PAY_ALL = (() => {
  const c = shifted(PAY, PAY_FIRST);
  c.keys.R = [[0, '@rest'], [0.26, CR(cigLipsR([0.01, -0.035, -0.06]))], [PAY_FIRST, CR(cigLipsR())], ...c.keys.R.slice(1)];
  c.props = [[PAY_FIRST, 'toMouth', 'R'], ...c.props];
  return c;
})();

export const DINER_CLIPS = {
  drag: DRAG,
  ash: ASH,
  payWallet: PAY_ALL,
  lightUp: LIGHT,
  // the left hand takes the tumbler off the counter: in from the left, open
  // beside it, onto it, the fingers close, it lifts a hair
  reachGlass: {
    duration: 0.95, marks: { taken: 0.66 },
    keys: { L: [
      [0, '@rest'],
      [0.34, G(here(), GLASS_OPEN, ELG, { off: [-0.075, 0.035, 0.03] })],
      [0.56, G(here(), GLASS_OPEN, ELG, { off: [-0.004, 0.002, 0.0] }), 'out'],
      [0.66, G(here(), GLASS_GRIP)],
      [0.95, G(here([0, 0.014, 0]))],
    ] },
    props: [[0.66, 'take', 'L', 'glass']],
    brush: 'L',
  },
  // up to the mouth upright (it leaves the frame at the bottom as it nears
  // the chin); it tips only at the lips, the scotch level in the world
  // (setTilt, every step); a third of it goes; down again, upright, to a
  // hair over where it stood
  sip: {
    duration: 2.3, marks: { tilt: 1.05, drink: 1.45, down: 1.75 },
    keys: { L: [
      [0, G(here([0, 0.014, 0]))],
      [0.4, G(chest([-0.16, -0.27, -0.42]), GLASS_GRIP, [-0.26, -0.4, -0.12])],
      [0.78, G(atLips(0), GLASS_GRIP, ELUP, { ef: 'cam' })],
      [1.05, G(atLips(22), GLASS_GRIP, ELUP, { ef: 'cam' })],
      [1.35, G(atLips(58), GLASS_GRIP, ELUP, { ef: 'cam' })],
      [1.6, G(atLips(60), GLASS_GRIP, ELUP, { ef: 'cam' })],
      [1.85, G(atLips(0), GLASS_GRIP, ELUP, { ef: 'cam' })],
      [2.3, G(chest([-0.2, -0.3, -0.48]), GLASS_GRIP, [-0.28, -0.38, -0.2])],
    ] },
    props: [[0, 'take', 'L', 'glass']],
    // (the head tips back a little with the drink)
    // (the eyes go up over the rim as it tips: the glass sinks in the frame)
    view: [[0, {}], [1.0, {}], [1.35, { pitch: 0.08, eyes: 0.17 }], [1.6, { pitch: 0.08, eyes: 0.17 }], [1.95, {}]],
    brush: 'L',
  },
  // back down flat where it stood, the hand opens and goes back to rest
  putDown: {
    duration: 1.2, marks: { down: 0.5 },
    keys: { L: [
      [0, G(chest([-0.2, -0.3, -0.48]), GLASS_GRIP, [-0.28, -0.38, -0.2])],
      [0.38, G(here([0, 0.012, 0]))],
      [0.5, G(here())],
      [0.64, G(here(), GLASS_OPEN)],
      [0.86, G(here(), GLASS_OPEN, ELG, { off: [-0.07, 0.03, 0.03] }), 'in'],
      [1.2, '@rest'],
    ] },
    props: [[0, 'take', 'L', 'glass'], [0.5, 'put', 'L']],
    brush: 'L',
  },
};
void OPEN; void RELAX; void HP; void C;
// (the hands' data files export CLIPS: Hands.js merges them)
export { DINER_CLIPS as CLIPS };
