import * as THREE from 'three';
import { lathe, merge, roundedBox, smoothNormals, tube, V2, V3 } from '../world/geom.js';
import { SEDAN_SHAPES } from '../world/Cars.js';
import { coupeBody, hoodLoft, coupeShell, hoodTop, HOOD, COUPE, contactShadow, glowTexture } from './models.js';
import { CAR_SPECS } from './Car.js';
import { accent } from '../render/accents.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYER } from '../render/layers.js';

// NOIR CITY's fleet (lane O2): the city's eight kinds of car, each told from
// the others by its outline at 40 m, each with its spec (Car.js's bicycle
// model), its seat, its lamps and its note.
//   coupe   fast, light: the one at the kerb (the player's start car keeps the
//           base's full model, models.js buildCoupe; the traffic's coupes are
//           this light build of the same shapes)
//   saloon  heavy, the gangs': the tall greenhouse, the spare on its back
//   taxi    the saloon with a checkered band along its belt and a lit roof lamp
//   police  the saloon with white doors, the red lamp on its roof, the siren
//           on its wing
//   hearse  long, black, slow: the coach behind the driver, landau bars
//   van     the delivery van: a short bonnet, a tall box
//   lorry   slow, a wall: a cab, a stake bed with its load under a tarp
//   tram    on Grand Ave's rails (src/traffic/tram.js: not drivable)
// Local frame as models.js: +x forward, +y up, +z the car's right, the origin
// on the ground under the car's middle. A kind's geometry is built once (a
// near build and a far build, LOD) and shared by every car of that kind: a car
// is six to eight meshes (paint, chrome, dark, glass, lens, the contact
// shadow, the kind's extras), never a build of its own.
//   fleetModel(kind, stage, { paint }) -> { group, meshes, kind, K, lod(far) }
//   KINDS[kind]: { spec, eye, seat, screen, lamps, tail, note, ... }
//   wellOn(model, on): the player's own car: the body with the cockpit's well
//   cut out of it and the glass gone (the drive's screen is its own)
// [the user, 2026-10-23: "a variety of cars ... not overly copy-paste"] Every
// kind in two or three variants a player sees (KINDS[k].variants: the body -
// a fastback, a two-door notchback, sidemount spares, a roadster with its top
// down, a panel van, a pickup, a box lorry, a flatbed; the liveries - the
// taxi's checks or two-tone, the police markings, the vans' painted names, the
// hearse's landau or curtained coach), and on top of the body a car's own
// look: its grey (three), whitewalls or not, on a parked one now and then a
// scrape along a door or a flat tyre it sags on - all picked by a seeded hash
// of where it stands (lookAt(kind, x, z)), so no street reads as one car repeated.
//   lookAt(kind, x, z, salt) -> { variant, paint, white, scrape, sag }
let CQ = 1;
const cq = (n, min = 3) => Math.max(min, Math.round(n * CQ));
const ext = (shape, depth, bt, bs, seg = 3, curve = 14) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bs, bevelSegments: cq(seg, 1), curveSegments: cq(curve, 5) });
  g.translate(0, 0, -depth / 2);
  return smoothNormals(g, 1e-4);
};
const shapeOf = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; };
const pathOf = (pts) => { const s = new THREE.Path(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; };

// a cap along a top line (the roof, a deck): `th` thick, under its skin, across
// `w` (the shell's roof: open where the screens are)
function capAlong(pts, w, th = 0.05, bevel = 0.03) {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => V2(x, y)));
  const P = curve.getPoints(cq(28, 8));
  const s = new THREE.Shape();
  s.moveTo(P[0].x, P[0].y);
  for (const p of P) s.lineTo(p.x, p.y);
  for (let i = P.length - 1; i >= 0; i--) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    s.lineTo(P[i].x + (ty / l) * th, P[i].y - (tx / l) * th);
  }
  s.closePath();
  return ext(s, w, bevel, bevel * 0.8, 2, 4);
}
// a side of the cabin: its outline with the windows cut out, a thin frame at z
function sideFrame(outline, windows, z, th = 0.04) {
  const s = outline instanceof THREE.Shape ? outline : shapeOf(outline);
  for (const w of windows) s.holes.push(pathOf(w));
  const g = ext(s, th, 0.012, 0.012, 1, 10);
  g.translate(0, 0, z);
  return g;
}
// a flat pane on a window's outline (the glass), at z
function paneAt(w, z) { const g = new THREE.ExtrudeGeometry(shapeOf(w), { depth: 0.006, bevelEnabled: false }); g.translate(0, 0, z - 0.003); return g; }
// a pane on the straight screen line a -> b (x, y), `wd` across, at z
function screenPane(a, b, wd, z, inset = 0.02) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const g = new THREE.BoxGeometry(0.008, len - inset * 2, wd);
  g.rotateZ(Math.atan2(-dx, dy));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
  return g;
}
// the wheels: a tyre, the dark disc in it, the hub; (x, z) each side, r the tyre's
function wheels(P, at, { r = 0.375, w = 1, dual = false } = {}) {
  const s = r / 0.375;
  for (const [x, z] of at) for (const sgn of [-1, 1]) {
    const zz = sgn * z;
    const pair = dual ? [zz - sgn * 0.13, zz + sgn * 0.13] : [zz];
    for (const zt of pair) {
      P.dark.push(new THREE.TorusGeometry(0.27 * s, 0.105 * s * w, cq(10, 6), cq(26, 12)).translate(x, r, zt));
      P.dark.push(new THREE.CylinderGeometry(0.26 * s, 0.26 * s, 0.12 * w, cq(18, 8)).rotateX(Math.PI / 2).translate(x, r, zt));
    }
    const out = sgn * (Math.abs(zz) + (dual ? 0.16 : 0.03));
    // (a whitewall: one thin pale ring on the outer wall, the lit upper arc - shown on some cars)
    if (P.white) { const ww = new THREE.RingGeometry(0.25 * s, 0.268 * s, cq(32, 12), 1, -0.25, Math.PI + 0.5); if (sgn < 0) ww.rotateY(Math.PI); P.white.push(ww.translate(x, r, out + sgn * 0.075)); }
    P.hub.push(lathe([[0.25 * s, -0.02], [0.23 * s, 0.01], [0.17 * s, 0.045], [0.08 * s, 0.07], [0.0, 0.075]], cq(16, 8)).rotateX(sgn * Math.PI / 2).translate(x, r, out));
  }
}
// the pontoon fenders (the sedan's), front and rear, shifted / scaled
function fenders(P, { fx = 0, rx = 0, s = 1, fz = 0.78, rz = 0.76, sy = 1 } = {}) {
  for (const sgn of [1, -1]) {
    const ff = ext(SEDAN_SHAPES.fender(true), 0.22, 0.06, 0.05, 2, 12); ff.scale(s, s * sy, 1).translate(fx, 0, sgn * fz);
    const rf = ext(SEDAN_SHAPES.fender(false), 0.2, 0.06, 0.05, 2, 12); rf.scale(s, s * sy, 1).translate(rx, 0, sgn * rz);
    P.paint.push(ff, rf);
  }
}
// a running board between the fenders
function boards(P, x0, x1, z, y = 0.445) { for (const sgn of [-1, 1]) P.dark.push(roundedBox(x1 - x0, 0.05, 0.26, 0.02, 1).translate((x0 + x1) / 2, y, sgn * z)); }
// the bullet headlamps on their stalks and the lenses
function headlamps(P, x, y, z, k = 1) {
  for (const sgn of [-1, 1]) {
    P.chrome.push(lathe([[0.0, -0.25 * k], [0.05 * k, -0.23 * k], [0.1 * k, -0.17 * k], [0.13 * k, -0.09 * k], [0.145 * k, 0.0], [0.15 * k, 0.03 * k], [0.135 * k, 0.045 * k]], cq(16, 8)).rotateZ(-Math.PI / 2).translate(x, y, sgn * z));
    P.chrome.push(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6).translate(x - 0.12, y - 0.1, sgn * z));
    P.lens.push(new THREE.CircleGeometry(0.128 * k, cq(18, 10)).rotateY(Math.PI / 2).translate(x + 0.047 * k, y, sgn * z));
  }
}
function tailLampsAt(P, x, y, z) { for (const sgn of [-1, 1]) P.dark.push(lathe([[0, -0.08], [0.045, -0.06], [0.055, 0.0], [0.04, 0.03]], cq(10, 6)).rotateZ(Math.PI / 2).translate(x, y, sgn * z)); }
// a tube bumper across the car at x (s: +1 front, -1 rear)
function bumper(P, x, s, hw = 0.95, y = 0.46) {
  const g = tube([V3(x - s * 0.1, y, -hw), V3(x, y, -hw * 0.58), V3(x + s * 0.03, y, 0), V3(x, y, hw * 0.58), V3(x - s * 0.1, y, hw)], 0.05, cq(6, 4), cq(24, 10));
  g.translate(0, -y, 0).scale(1, 1.7, 1).translate(0, y, 0);
  P.chrome.push(g);
}
// the upright grille: its dark shield and the chrome bars
function grille(P, x, top, hw = 0.22, bot = 0.52) {
  const gs = new THREE.Shape();
  gs.moveTo(-hw, bot); gs.lineTo(hw, bot); gs.quadraticCurveTo(hw * 1.14, bot + (top - bot) * 0.62, 0.0, top); gs.quadraticCurveTo(-hw * 1.14, bot + (top - bot) * 0.62, -hw, bot);
  const g = new THREE.ExtrudeGeometry(gs, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: cq(10, 5) });
  P.dark.push(smoothNormals(g.rotateY(Math.PI / 2).translate(x, 0, 0), 1e-4));
  for (let z = -hw * 0.72; z <= hw * 0.73; z += hw * 0.18) { const t = top - 0.05 - Math.pow(Math.abs(z) / (hw * 1.05), 2) * (top - bot) * 0.6; P.chrome.push(new THREE.CylinderGeometry(0.009, 0.009, t - bot - 0.03, 5).translate(x + 0.09, (t + bot + 0.03) / 2, z)); }
}
// the man at the wheel, seen through the glass: a hat, a head, the shoulders
// (a few strokes of black; the hijack makes him a whole man at the door)
function bust(P, eye, { cap = false } = {}) {
  const x = eye.x + 0.02, y = eye.y - 0.06, z = eye.z;
  P.bust.push(new THREE.SphereGeometry(0.105, cq(10, 6), cq(8, 5)).scale(1, 1.15, 0.92).translate(x, y, z));
  P.bust.push(new THREE.CapsuleGeometry(0.17, 0.26, 3, cq(10, 6)).rotateX(Math.PI / 2).scale(0.75, 1, 1).translate(x - 0.06, y - 0.33, z));
  P.bust.push(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8).translate(x, y - 0.14, z));
  if (cap) P.bust.push(lathe([[0.0, 0.0], [0.115, 0.0], [0.12, 0.03], [0.105, 0.075], [0.0, 0.09]], cq(12, 6)).translate(x, y + 0.07, z), roundedBox(0.09, 0.015, 0.16, 0.006, 1).translate(x + 0.12, y + 0.075, z));
  else P.bust.push(lathe([[0.0, 0.0], [0.2, 0.0], [0.21, 0.012], [0.12, 0.02], [0.115, 0.11], [0.08, 0.13], [0.0, 0.12]], cq(14, 7)).translate(x, y + 0.07, z));
}

// a spare wheel carried in a front fender (a sidemount): its tyre, its cover
function sidemount(P, x, y, z, r = 0.3) {
  for (const sgn of [-1, 1]) {
    const t = new THREE.TorusGeometry(r * 0.72, r * 0.28, cq(8, 5), cq(22, 10)).rotateY(sgn * 0.12).translate(x, y, sgn * z);
    P.dark.push(t);
    P.paint.push(new THREE.CylinderGeometry(r * 0.66, r * 0.7, 0.07, cq(18, 8)).rotateX(Math.PI / 2).translate(x, y, sgn * (z + 0.04)));
    P.chrome.push(new THREE.TorusGeometry(r * 0.66, 0.012, 4, cq(18, 8)).translate(x, y, sgn * (z + 0.075)));
  }
}
// a word painted along a side (the vans' and lorries' trade): the names' atlas row,
// x0..x1 along the car, its middle at y, h tall, on both sides at +-z
export const NAMES = ['LAUNDRY', 'BAKERY', 'BREWERY', 'ICE & COAL'];
function nameDecal(P, word, x0, x1, y, h, z) {
  const row = NAMES.indexOf(word), v0 = 1 - (row + 1) / NAMES.length, v1 = 1 - row / NAMES.length;
  for (const sgn of [-1, 1]) {
    const g = new THREE.PlaneGeometry(x1 - x0, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) > 0.5 ? v1 : v0);
    if (sgn < 0) g.rotateY(Math.PI);
    P.name.push(g.translate((x0 + x1) / 2, y, sgn * z));
  }
}

// ---- the saloon's shapes (the base's sedan: Cars.js) and its well ---------------------------
function saloonBody(well, x1 = 0.7) {
  const s = new THREE.Shape();
  s.moveTo(-2.24, 0.52);
  s.lineTo(2.16, 0.52);
  s.splineThru([V2(2.27, 0.58), V2(2.31, 0.74), V2(2.3, 0.95), V2(2.22, 1.06)]);
  s.splineThru([V2(1.7, 1.1), V2(1.1, 1.12), V2(x1, 1.13)]);
  if (well) { s.lineTo(x1 - 0.02, 0.62); s.lineTo(-1.26, 0.62); s.lineTo(-1.3, 1.12); } else s.lineTo(-1.3, 1.12);
  s.splineThru([V2(-1.72, 1.07), V2(-2.08, 0.93), V2(-2.27, 0.72), V2(-2.29, 0.58)]);
  s.closePath();
  return s;
}
const SALOON_TOP = [[0.47, 1.58], [0.36, 1.68], [0.24, 1.69], [-0.35, 1.71], [-0.9, 1.68], [-1.2, 1.56]];
const SALOON_DECK = [[-1.46, 1.36], [-1.58, 1.24], [-1.68, 1.12]];
const SALOON_OUT = [[0.74, 1.04], [0.74, 1.1], [0.47, 1.58], [0.4, 1.68], [0.24, 1.69], [-0.35, 1.71], [-0.9, 1.68], [-1.2, 1.56], [-1.46, 1.36], [-1.68, 1.12], [-1.7, 1.04]];
const SALOON_W1 = [[0.6, 1.18], [0.4, 1.55], [-0.26, 1.6], [-0.26, 1.18]];
const SALOON_W2 = [[-0.36, 1.18], [-0.36, 1.6], [-0.88, 1.57], [-1.22, 1.38], [-1.38, 1.18]];
// the two-door notchback: one long window a side, a steep back light, a trunk on the tail
const NB_TOP = [[0.47, 1.58], [0.36, 1.68], [0.24, 1.69], [-0.6, 1.7], [-0.95, 1.62]];
const NB_DECK = [[-0.95, 1.62], [-1.15, 1.42], [-1.32, 1.14]];
const NB_OUT = [[0.74, 1.04], [0.74, 1.1], [0.47, 1.58], [0.4, 1.68], [0.24, 1.69], [-0.6, 1.7], [-0.95, 1.62], [-1.15, 1.42], [-1.32, 1.12], [-1.34, 1.04]];
const NB_W = [[0.6, 1.18], [0.4, 1.55], [-0.62, 1.6], [-0.86, 1.53], [-1.08, 1.18]];

// v: 0 the four-door fastback (its spare on the deck), 1 the two-door
// notchback (a trunk), 2 the four-door with sidemounts (a rack on the tail)
function saloonParts(P, kind, v = 0) {
  P.paint.push(ext(saloonBody(false), 1.2, 0.1, 0.08, 3));
  P.well.push(ext(saloonBody(true), 1.2, 0.1, 0.08, 3));
  for (const sgn of [1, -1]) P.well.push(roundedBox(1.98, 0.52, 0.06, 0.02, 1).translate(-0.28, 0.86, sgn * 0.67));
  // the greenhouse as a shell: its roof and its deck caps, its sides' frames
  const cabHalf = 0.62;
  if (v === 1) {
    P.shell.push(capAlong(NB_TOP, cabHalf * 2 - 0.02), capAlong(NB_DECK, cabHalf * 2 - 0.02));
    for (const sgn of [-1, 1]) P.shell.push(sideFrame(NB_OUT, [NB_W], sgn * (cabHalf - 0.02)));
    for (const sgn of [-1, 1]) { P.glass.push(paneAt(NB_W, sgn * (cabHalf + 0.005))); P.glass.push(screenPane([0.75, 1.11], [0.48, 1.58], 0.46, sgn * 0.245)); }
    P.glass.push(screenPane([-1.3, 1.17], [-1.0, 1.58], 0.6, 0));
    // the trunk on the tail (paint), its chrome handle
    const tr = roundedBox(0.98, 0.34, 1.3, 0.12, 2).translate(-1.86, 1.0, 0);
    P.paint.push(tr); P.well.push(tr);
    P.chrome.push(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5).rotateX(Math.PI / 2).translate(-2.36, 1.02, 0));
  } else {
    P.shell.push(capAlong(SALOON_TOP, cabHalf * 2 - 0.02), capAlong(SALOON_DECK, cabHalf * 2 - 0.02));
    for (const sgn of [-1, 1]) P.shell.push(sideFrame(SALOON_OUT, [SALOON_W1, SALOON_W2], sgn * (cabHalf - 0.02)));
    // the glass: the side panes, the split screen, the back light
    for (const sgn of [-1, 1]) { P.glass.push(paneAt(SALOON_W1, sgn * (cabHalf + 0.005)), paneAt(SALOON_W2, sgn * (cabHalf + 0.005))); P.glass.push(screenPane([0.75, 1.11], [0.48, 1.58], 0.46, sgn * 0.245)); }
    P.glass.push(screenPane([-1.46, 1.36], [-1.2, 1.56], 0.62, 0));
  }
  if (v === 2) {
    sidemount(P, 0.88, 0.74, 0.9);
    // (a luggage rack on the tail)
    for (const y of [0.78, 0.96]) P.chrome.push(tube([V3(-2.28, y, -0.55), V3(-2.36, y, 0), V3(-2.28, y, 0.55)], 0.014, 4, 8));
  }
  P.chrome.push(tube([V3(0.745, 1.12, 0), V3(0.47, 1.6, 0)], 0.018, 5, 4));
  fenders(P);
  boards(P, -0.95, 0.35, 0.77);
  wheels(P, [[1.55, 0.78], [-1.55, 0.76]]);
  headlamps(P, 2.26, 0.98, 0.6);
  tailLampsAt(P, -2.3, 0.84, 0.74);
  grille(P, 2.3, 1.08);
  bumper(P, 2.55, 1); bumper(P, -2.55, -1);
  P.chrome.push(tube([V3(0.76, 1.145, 0), V3(1.4, 1.14, 0), V3(2.0, 1.12, 0), V3(2.26, 1.08, 0)], 0.014, 4, cq(14, 6)));
  P.chrome.push(lathe([[0, 0], [0.018, 0.006], [0.014, 0.04], [0.004, 0.075], [0, 0.08]], cq(10, 6)).translate(2.2, 1.09, 0));
  for (const sgn of [-1, 1]) P.chrome.push(tube([V3(2.1, 1.02, sgn * 0.68), V3(0.6, 1.07, sgn * 0.705), V3(-0.5, 1.07, sgn * 0.705), V3(-1.6, 1.02, sgn * 0.69)], 0.012, 4, cq(18, 8)));
  // the spare on the turtle deck (the fastback's)
  if (v === 0) {
    const axis = V3(-0.78, 0.62, 0).normalize();
    P.dark.push(new THREE.TorusGeometry(0.23, 0.09, cq(8, 5), cq(22, 10)).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), axis)).translate(-2.31, 0.8, 0));
    P.paint.push(lathe([[0.27, -0.03], [0.22, 0.02], [0.12, 0.06], [0, 0.07]], cq(16, 8)).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), axis)).translate(-2.34, 0.82, 0));
  }
  P.dark.push(roundedBox(3.3, 0.4, 1.36, 0.08, 1).translate(0, 0.3, 0));
  const checks = (x0, n, rows, y0) => { for (const sgn of [-1, 1]) for (let i = 0; i < n; i++) for (let r = 0; r < rows; r++) { if ((i + r) % 2) continue; P.pale.push(new THREE.BoxGeometry(0.19, 0.095, 0.012).translate(x0 - i * 0.2, y0 - r * 0.1, sgn * 0.712)); } };
  const roofLamp = (w = 0.5, h = 0.14, x = 0.1) => { P.pale.push(roundedBox(0.34, h, w, 0.04, 1).translate(x, 1.71 + h / 2, 0)); P.lamp.push(roundedBox(0.3, h - 0.04, w - 0.04, 0.03, 1).translate(x, 1.72 + h / 2, 0)); };
  if (kind === 'taxi') {
    // its livery: the checkered band along the belt and the roof lamp (0); two-tone,
    // the lower doors pale under a row of checks, the tall roof sign (1); the
    // checks on the doors only (2)
    if (v === 0) { checks(1.85, 18, 2, 0.98); roofLamp(); }
    else if (v === 1) { for (const sgn of [-1, 1]) P.pale.push(roundedBox(3.4, 0.3, 0.012, 0.02, 1).translate(-0.15, 0.7, sgn * 0.712)); checks(0.9, 10, 1, 0.98); roofLamp(0.62, 0.22, -0.05); }
    else { checks(0.55, 8, 2, 0.98); roofLamp(); }
  }
  if (kind === 'police') {
    // the force's markings: the white front doors (0, 2), white doors and a white
    // roof (1); the red lamp on the roof, the siren on the left wing, (2) a spotlight on the pillar
    if (v === 1) { for (const sgn of [-1, 1]) P.pale.push(roundedBox(1.36, 0.46, 0.012, 0.01, 1).translate(-0.05, 0.85, sgn * 0.716)); P.pale.push(capAlong(NB_TOP, 1.22, 0.02, 0.01).translate(0, 0.012, 0)); }
    else for (const sgn of [-1, 1]) P.pale.push(roundedBox(0.96, 0.46, 0.012, 0.01, 1).translate(0.15, 0.85, sgn * 0.716));
    P.red.push(new THREE.SphereGeometry(0.1, cq(12, 6), cq(8, 5)).scale(1, 0.8, 1).translate(0.0, 1.8, 0));
    P.chrome.push(new THREE.CylinderGeometry(0.11, 0.12, 0.06, cq(12, 6)).translate(0, 1.73, 0));
    P.chrome.push(lathe([[0.0, -0.13], [0.06, -0.1], [0.075, 0.0], [0.07, 0.06], [0.0, 0.07]], cq(12, 6)).rotateZ(-Math.PI / 2).translate(1.6, 1.13, -0.62));
    if (v === 2) P.chrome.push(lathe([[0.0, -0.1], [0.06, -0.08], [0.08, 0.0], [0.075, 0.04], [0.0, 0.05]], cq(12, 6)).rotateZ(-Math.PI / 2).translate(0.62, 1.48, -0.7));
  }
}

// ---- the coupe (light): the base's shapes ------------------------------------------------------
// v: 0 the fastback, 1 the roadster (its top down: the windscreen alone, the
// seat and the folded hood seen over the doors), 2 the fastback with sidemounts
function coupeParts(P, v = 0) {
  P.paint.push(ext(coupeBody(), 1.2, 0.1, 0.08, 3));
  P.well.push(ext(coupeBody(), 1.2, 0.1, 0.08, 3));
  P.paint.push(hoodLoft());
  P.well.push(hoodLoft());
  P.dark.push(roundedBox(1.7, 0.36, 0.86, 0.05, 1).translate(1.45, 0.62, 0));
  for (const sgn of [1, -1]) { const d = roundedBox(1.98, 0.6, 0.06, 0.025, 1).translate(-0.31, 0.83, sgn * 0.675); P.paint.push(d); P.well.push(d.clone()); }
  if (v === 1) {
    // the windscreen's frame, its glass; the bench's back, the folded hood, the floor, the wheel
    for (const sgn of [-1, 1]) P.shell.push(tube([V3(0.66, 1.12, sgn * 0.6), V3(0.56, 1.38, sgn * 0.6), V3(0.46, 1.62, sgn * 0.58)], 0.025, 6, 6));
    P.shell.push(roundedBox(0.06, 0.05, 1.22, 0.02, 1).translate(0.46, 1.63, 0));
    for (const sgn of [-1, 1]) P.glass.push(screenPane([0.66, 1.14], [0.46, 1.61], 0.56, sgn * 0.3));
    P.dark.push(roundedBox(0.16, 0.52, 1.18, 0.06, 2).translate(-1.02, 1.0, 0));
    P.dark.push(roundedBox(0.55, 0.22, 1.26, 0.1, 2).translate(-1.5, 1.2, 0));
    P.dark.push(roundedBox(1.9, 0.03, 1.22, 0.01, 1).translate(-0.3, 0.66, 0));
    P.dark.push(new THREE.TorusGeometry(0.2, 0.016, 6, cq(24, 10)).rotateY(Math.PI / 2).rotateZ(0.6).translate(0.06, 1.19, -0.34));
  } else {
    for (const g of coupeShell()) P.shell.push(g);
    // (the coupe's own windows: in its shell's frame)
    const W = [[0.58, 1.18], [0.38, 1.72], [0.12, 1.81], [-0.94, 1.77], [-0.94, 1.18]];
    for (const sgn of [-1, 1]) { P.glass.push(paneAt(W, sgn * 0.6)); P.glass.push(screenPane([0.66, 1.14], [0.43, 1.77], 0.56, sgn * 0.3)); }
    P.glass.push(screenPane([-1.32, 1.66], [-1.62, 1.4], 0.6, 0));
  }
  if (v === 2) sidemount(P, 0.88, 0.74, 0.9);
  fenders(P);
  boards(P, -0.95, 0.35, 0.77);
  wheels(P, [[1.55, 0.78], [-1.55, 0.76]]);
  headlamps(P, 2.26, 0.98, 0.6);
  tailLampsAt(P, -2.3, 0.84, 0.74);
  grille(P, 2.3, 1.0);
  bumper(P, 2.55, 1); bumper(P, -2.55, -1);
  P.chrome.push(tube([0.7, 1.1, 1.5, 1.9, 2.2].map((x) => V3(x, hoodTop(x) + 0.004, 0)), 0.011, 4, 12));
  for (const sgn of [-1, 1]) P.chrome.push(tube([V3(0.62, 1.1, sgn * 0.705), V3(-0.5, 1.09, sgn * 0.71), V3(-1.6, 1.03, sgn * 0.7)], 0.012, 4, 14));
  P.dark.push(roundedBox(3.3, 0.4, 1.36, 0.08, 1).translate(0, 0.3, 0));
  void HOOD;
}

// ---- the hearse: the saloon's nose, a long coach ------------------------------------------------
// v: 0 the landau coach (its bars), 1 the coach with long curtained windows and its lamps
function hearseParts(P, v = 0) {
  const F = 0.62;   // (the nose pushed forward: the coach is long)
  const body = (well) => {
    const s = new THREE.Shape();
    s.moveTo(-3.1, 0.52);
    s.lineTo(2.16 + F, 0.52);
    s.splineThru([V2(2.27 + F, 0.58), V2(2.31 + F, 0.74), V2(2.3 + F, 0.95), V2(2.22 + F, 1.06)]);
    s.splineThru([V2(1.7 + F, 1.1), V2(1.1 + F, 1.12), V2(0.7 + F, 1.13)]);
    if (well) { s.lineTo(0.68 + F, 0.62); s.lineTo(-0.62, 0.62); s.lineTo(-0.66, 1.12); }
    s.lineTo(-2.9, 1.12);
    s.splineThru([V2(-3.06, 1.0), V2(-3.12, 0.78), V2(-3.12, 0.58)]);
    s.closePath();
    return s;
  };
  P.paint.push(ext(body(false), 1.24, 0.1, 0.08, 3));
  P.well.push(ext(body(true), 1.24, 0.1, 0.08, 3));
  for (const sgn of [1, -1]) P.well.push(roundedBox(1.9, 0.52, 0.06, 0.02, 1).translate(0.38, 0.86, sgn * 0.69));
  // the driver's cab (a shell) and the coach behind it (solid, black, tall)
  const top = [[0.47 + F, 1.6], [0.36 + F, 1.72], [0.1 + F, 1.76], [-0.5, 1.78]];
  const out = [[0.74 + F, 1.04], [0.74 + F, 1.1], [0.47 + F, 1.6], [0.36 + F, 1.72], [0.1 + F, 1.76], [-0.5, 1.78], [-0.52, 1.04]];
  const win = [[0.6 + F, 1.18], [0.4 + F, 1.56], [0.05 + F, 1.62], [-0.38, 1.64], [-0.38, 1.18]];
  P.shell.push(capAlong(top, 1.24));
  for (const sgn of [-1, 1]) P.shell.push(sideFrame(out, [win], sgn * 0.62));
  // the partition behind the seat, the coach
  P.shell.push(roundedBox(0.05, 0.66, 1.24, 0.01, 1).translate(-0.5, 1.45, 0));
  const coach = new THREE.Shape();
  coach.moveTo(-0.48, 1.04); coach.lineTo(-0.48, 1.8); coach.lineTo(-2.7, 1.84); coach.quadraticCurveTo(-3.08, 1.82, -3.1, 1.5); coach.lineTo(-3.1, 1.04); coach.closePath();
  P.paint.push(ext(coach, 1.2, 0.09, 0.07, 2));
  P.well.push(ext(coach, 1.2, 0.09, 0.07, 2));
  // the coach's small curtained windows (dark), the landau bars (chrome S) - or
  // its long windows, the white curtains drawn in pleats, a coach lamp at each
  for (const sgn of [-1, 1]) {
    P.glass.push(paneAt(win, sgn * 0.632));
    const z = sgn * 0.705;
    if (v === 1) {
      P.glass.push(new THREE.BoxGeometry(2.0, 0.46, 0.008).translate(-1.6, 1.45, sgn * 0.696));
      for (let x = -2.52; x <= -0.68; x += 0.13) P.pale.push(new THREE.BoxGeometry(0.05, 0.42, 0.006).translate(x, 1.45, sgn * 0.703));
      P.chrome.push(lathe([[0.0, -0.12], [0.05, -0.1], [0.06, 0.04], [0.04, 0.08], [0.0, 0.1]], cq(10, 6)).translate(-0.56, 1.62, sgn * 0.72));
    } else {
      P.dark.push(roundedBox(0.9, 0.34, 0.012, 0.04, 1).translate(-1.4, 1.45, sgn * 0.7));
      P.chrome.push(tube([V3(-2.2, 1.62, z), V3(-2.45, 1.48, z), V3(-2.65, 1.3, z), V3(-2.62, 1.16, z)], 0.018, 4, 12));
      P.chrome.push(tube([V3(-2.0, 1.12, z), V3(-2.9, 1.12, z)], 0.012, 4, 4));
    }
    P.chrome.push(tube([V3(2.1 + F, 1.02, sgn * 0.68), V3(-2.9, 1.06, sgn * 0.7)], 0.012, 4, cq(18, 8)));
    P.glass.push(screenPane([0.75 + F, 1.11], [0.48 + F, 1.6], 0.46, sgn * 0.245));
  }
  // the rear door's small oval window
  P.glass.push(new THREE.CircleGeometry(0.2, cq(16, 8)).scale(1, 0.6, 1).rotateY(-Math.PI / 2).translate(-3.2, 1.5, 0));
  fenders(P, { fx: F, rx: -1.05 });
  boards(P, -1.6, 0.35 + F * 0.6, 0.77);
  wheels(P, [[1.55 + F, 0.78], [-2.6, 0.76]]);
  headlamps(P, 2.26 + F, 0.98, 0.6);
  tailLampsAt(P, -3.12, 0.84, 0.74);
  grille(P, 2.3 + F, 1.08);
  bumper(P, 2.55 + F, 1); bumper(P, -3.3, -1);
  P.dark.push(roundedBox(4.6, 0.4, 1.36, 0.08, 1).translate(-0.3, 0.3, 0));
}

// ---- the delivery van: a short bonnet, a cab, a tall box -------------------------------------
// v: 0 the box van (LAUNDRY on its band), 1 the panel van (round-shouldered, BAKERY
// painted on its side), 2 the pickup (an open bed, a load in it)
function vanParts(P, v = 0) {
  const R = 0.42;     // (bigger wheels)
  // the bonnet and the cowl (the saloon's nose, a little higher and shorter)
  const nose = (well) => {
    const s = new THREE.Shape();
    s.moveTo(-0.2, 0.6); s.lineTo(2.3, 0.6);
    s.splineThru([V2(2.42, 0.68), V2(2.46, 0.86), V2(2.44, 1.1), V2(2.34, 1.22)]);
    s.splineThru([V2(1.8, 1.27), V2(1.3, 1.29), V2(0.95, 1.3)]);
    if (well) { s.lineTo(0.93, 0.78); s.lineTo(-0.18, 0.78); } else s.lineTo(-0.2, 1.3);
    s.closePath();
    return s;
  };
  P.paint.push(ext(nose(false), 1.2, 0.1, 0.08, 3));
  P.well.push(ext(nose(true), 1.2, 0.1, 0.08, 3));
  for (const sgn of [1, -1]) P.well.push(roundedBox(1.12, 0.55, 0.06, 0.02, 1).translate(0.38, 1.03, sgn * 0.72));
  // the cab (a shell: a round roof, the doors' windows), the partition
  const cabTop = [[0.72, 1.98], [0.62, 2.12], [0.4, 2.18], [-0.2, 2.2]];
  const out = [[0.96, 1.2], [0.96, 1.3], [0.72, 1.98], [0.6, 2.13], [0.4, 2.18], [-0.22, 2.2], [-0.22, 1.2]];
  const win = [[0.82, 1.38], [0.64, 1.95], [0.4, 2.04], [0.02, 2.05], [0.02, 1.38]];
  P.shell.push(capAlong(cabTop, 1.42));
  for (const sgn of [-1, 1]) P.shell.push(sideFrame(out, [win], sgn * 0.72));
  P.shell.push(roundedBox(0.05, 1.0, 1.42, 0.01, 1).translate(-0.2, 1.72, 0));
  if (v === 0) {
    // the box: tall, square-shouldered, the doors at its back; a dark band round
    // it and the goods' name painted on it
    P.paint.push(roundedBox(2.5, 1.95, 2.0, 0.16, 2).translate(-1.43, 1.4, 0));
    P.well.push(roundedBox(2.5, 1.95, 2.0, 0.16, 2).translate(-1.43, 1.4, 0));
    for (const sgn of [-1, 1]) P.dark.push(roundedBox(2.2, 0.28, 0.012, 0.01, 1).translate(-1.43, 1.78, sgn * 1.005));
    P.dark.push(roundedBox(0.012, 1.6, 0.02, 0.004, 1).translate(-2.685, 1.35, 0));
    nameDecal(P, 'LAUNDRY', -2.4, -0.46, 1.78, 0.24, 1.013);
  } else if (v === 1) {
    // the panel van: one round-shouldered body behind the cab, its name painted on
    P.paint.push(roundedBox(2.62, 1.72, 1.86, 0.42, 3).translate(-1.38, 1.36, 0));
    P.well.push(roundedBox(2.62, 1.72, 1.86, 0.42, 3).translate(-1.38, 1.36, 0));
    P.dark.push(roundedBox(0.012, 1.3, 0.02, 0.004, 1).translate(-2.695, 1.3, 0));
    nameDecal(P, 'BAKERY', -2.3, -0.5, 1.5, 0.3, 0.935);
  } else {
    // the pickup: the bed's floor, its sides and tailgate, crates and a sack in it
    const bed = [roundedBox(2.5, 0.1, 1.8, 0.03, 1).translate(-1.45, 1.0, 0), roundedBox(0.06, 0.46, 1.8, 0.02, 1).translate(-2.68, 1.24, 0)];
    for (const sgn of [-1, 1]) bed.push(roundedBox(2.5, 0.46, 0.06, 0.02, 1).translate(-1.45, 1.24, sgn * 0.88));
    for (const g of bed) { P.paint.push(g); P.well.push(g.clone()); }
    P.pale.push(roundedBox(0.62, 0.55, 0.62, 0.03, 1).translate(-1.0, 1.33, 0.38), roundedBox(0.55, 0.45, 0.55, 0.03, 1).translate(-1.75, 1.28, -0.4));
    P.dark.push(new THREE.SphereGeometry(0.3, cq(10, 6), cq(8, 5)).scale(1.3, 0.7, 1).translate(-2.25, 1.22, 0.35));
  }
  for (const sgn of [-1, 1]) {
    P.glass.push(paneAt(win, sgn * 0.74));
    P.glass.push(screenPane([0.97, 1.32], [0.73, 1.97], 0.6, sgn * 0.33));
  }
  fenders(P, { fx: 0.35, rx: -0.95, s: 1.1, fz: 0.86, rz: 0.92 });
  boards(P, -0.3, 0.7, 0.85, 0.5);
  wheels(P, [[1.75, 0.86], [-1.8, 0.9]], { r: R });
  headlamps(P, 2.4, 1.12, 0.62);
  tailLampsAt(P, -2.72, 0.7, 0.84);
  grille(P, 2.45, 1.24, 0.24, 0.6);
  bumper(P, 2.72, 1, 1.0, 0.52); bumper(P, -2.8, -1, 1.0, 0.5);
  P.dark.push(roundedBox(4.4, 0.42, 1.5, 0.08, 1).translate(-0.1, 0.36, 0));
}

// ---- the lorry: a cab, a stake bed, the load under its tarp ---------------------------------
// v: 0 the stake bed, its load under a tarp; 1 the box lorry (BREWERY on its
// side); 2 the flatbed with crates and barrels roped on
function lorryParts(P, v = 0) {
  const R = 0.5;
  const nose = (well) => {
    const s = new THREE.Shape();
    s.moveTo(1.0, 0.78); s.lineTo(3.5, 0.78);
    s.splineThru([V2(3.62, 0.88), V2(3.66, 1.08), V2(3.64, 1.38), V2(3.54, 1.52)]);
    s.splineThru([V2(3.0, 1.57), V2(2.4, 1.59), V2(2.05, 1.6)]);
    if (well) { s.lineTo(2.03, 1.02); s.lineTo(1.02, 1.02); } else s.lineTo(1.0, 1.6);
    s.closePath();
    return s;
  };
  P.paint.push(ext(nose(false), 1.3, 0.1, 0.08, 3));
  P.well.push(ext(nose(true), 1.3, 0.1, 0.08, 3));
  for (const sgn of [1, -1]) P.well.push(roundedBox(1.0, 0.6, 0.06, 0.02, 1).translate(1.52, 1.3, sgn * 0.82));
  const top = [[1.82, 2.38], [1.72, 2.52], [1.5, 2.58], [0.98, 2.6]];
  const out = [[2.06, 1.5], [2.06, 1.6], [1.82, 2.38], [1.7, 2.53], [1.5, 2.58], [0.96, 2.6], [0.96, 1.5]];
  const win = [[1.92, 1.68], [1.74, 2.34], [1.5, 2.44], [1.2, 2.45], [1.2, 1.68]];
  P.shell.push(capAlong(top, 1.64));
  for (const sgn of [-1, 1]) P.shell.push(sideFrame(out, [win], sgn * 0.82));
  P.shell.push(roundedBox(0.06, 1.12, 1.64, 0.01, 1).translate(0.98, 2.04, 0));
  // the chassis, the bed, its stakes and boards, the load under the tarp
  P.dark.push(roundedBox(7.2, 0.3, 1.1, 0.04, 1).translate(-0.1, 0.78, 0));
  const bed = roundedBox(4.5, 0.14, 2.36, 0.03, 1).translate(-1.45, 1.25, 0);
  P.paint.push(bed); P.well.push(bed);
  if (v === 0) {
    for (const sgn of [-1, 1]) {
      for (let x = -3.6; x <= 0.71; x += 0.72) P.dark.push(roundedBox(0.08, 0.84, 0.08, 0.02, 1).translate(x, 1.72, sgn * 1.14));
      for (const y of [1.48, 1.86]) P.dark.push(roundedBox(4.4, 0.12, 0.04, 0.02, 1).translate(-1.45, y, sgn * 1.17));
    }
    for (let z = -0.72; z <= 0.73; z += 1.44) P.dark.push(roundedBox(0.04, 0.84, 0.08, 0.02, 1).translate(-3.68, 1.72, z));
    // (the tarp: a long hump over the load, its ropes)
    const tarp = new THREE.Shape();
    tarp.moveTo(-1.08, 0); tarp.quadraticCurveTo(-1.12, 0.88, -0.6, 1.12); tarp.quadraticCurveTo(0, 1.3, 0.6, 1.12); tarp.quadraticCurveTo(1.12, 0.88, 1.08, 0); tarp.closePath();
    const tg = ext(tarp, 4.0, 0.12, 0.1, 2, 10); tg.rotateY(Math.PI / 2).translate(-1.5, 1.32, 0);
    P.paint.push(tg); P.well.push(tg);
    for (let x = -3.1; x <= 0.2; x += 1.1) P.chrome.push(tube([V3(x, 1.33, -1.18), V3(x, 2.4, -0.6), V3(x, 2.62, 0), V3(x, 2.4, 0.6), V3(x, 1.33, 1.18)], 0.012, 4, 10));
  } else if (v === 1) {
    // the box on the bed, its doors' seam, a dark band and the brewer's name
    const bx = roundedBox(4.5, 2.1, 2.36, 0.12, 2).translate(-1.45, 2.38, 0);
    P.paint.push(bx); P.well.push(bx.clone());
    for (const sgn of [-1, 1]) P.dark.push(roundedBox(4.2, 0.34, 0.012, 0.01, 1).translate(-1.45, 2.9, sgn * 1.19));
    P.dark.push(roundedBox(0.012, 1.9, 0.02, 0.004, 1).translate(-3.705, 2.38, 0));
    nameDecal(P, 'BREWERY', -3.4, -0.6, 2.9, 0.3, 1.197);
  } else {
    // the flatbed: low sides, crates and barrels roped on
    for (const sgn of [-1, 1]) P.dark.push(roundedBox(4.4, 0.26, 0.05, 0.02, 1).translate(-1.45, 1.45, sgn * 1.17));
    for (const [x, z, s] of [[-0.3, 0.45, 0.8], [-0.3, -0.45, 0.8], [-1.2, 0.4, 0.7], [-2.9, -0.4, 0.75]]) P.pale.push(roundedBox(s, s, s, 0.03, 1).translate(x, 1.32 + s / 2, z));
    for (const [x, z] of [[-1.95, -0.5], [-2.0, 0.45], [-2.65, 0.45], [-1.3, -0.45]]) P.dark.push(new THREE.CylinderGeometry(0.3, 0.3, 0.86, cq(14, 8)).translate(x, 1.75, z));
    for (const x of [-0.7, -2.3]) P.chrome.push(tube([V3(x, 1.33, -1.18), V3(x, 2.25, -0.4), V3(x, 2.25, 0.4), V3(x, 1.33, 1.18)], 0.012, 4, 8));
  }
  for (const sgn of [-1, 1]) {
    P.glass.push(paneAt(win, sgn * 0.84));
    P.glass.push(screenPane([2.07, 1.62], [1.83, 2.36], 0.7, sgn * 0.38));
  }
  fenders(P, { fx: 1.45, rx: -1.95, s: 1.3, fz: 0.95, rz: 1.05, sy: 1.02 });
  wheels(P, [[2.9, 0.95]], { r: R });
  wheels(P, [[-1.9, 0.94], [-2.9, 0.94]], { r: R, dual: true });
  headlamps(P, 3.48, 1.38, 0.7, 1.1);
  tailLampsAt(P, -3.74, 1.05, 1.0);
  grille(P, 3.62, 1.56, 0.3, 0.8);
  bumper(P, 3.85, 1, 1.15, 0.7);
  P.dark.push(roundedBox(0.12, 0.16, 2.3, 0.04, 1).translate(-3.76, 0.95, 0));
}

// ---- the table ------------------------------------------------------------------------------------
const sedanSpec = (o) => ({ ...CAR_SPECS.sedan, ...o });
export const KINDS = {
  coupe: { box: { belt: 1.1, roof: 1.86, cab: [-1.7, 0.6] }, variants: ['fastback', 'roadster', 'sidemount'], vbox: { 1: { roof: 1.66, cab: [-1.2, 0.5] } }, scrape: { x: [-1.1, 0.5], y: 0.84, z: 0.708 }, build: coupeParts, spec: { ...CAR_SPECS.coupe }, halfL: 2.45, halfW: 0.94, eye: V3(-0.02, 1.5, -0.34), screen: { base: 0.66, baseY: 1.13, top: 0.43, topY: 1.77 }, cockpit: [0, 0], lamps: COUPE.lamps, tail: COUPE.tail, note: 1.0, paint: 'paint' },
  saloon: { box: { belt: 1.12, roof: 1.7, cab: [-1.6, 0.7] }, variants: ['fastback', 'notchback', 'sidemount'], scrape: { x: [-1.2, 0.5], y: 0.82, z: 0.712 }, build: (P, v) => saloonParts(P, 'saloon', v), spec: sedanSpec({ mass: 1.25, accel: 4.2, vmax: 21 }), halfL: 2.45, halfW: 0.95, eye: V3(0.1, 1.43, -0.32), screen: { base: 0.75, baseY: 1.11, top: 0.48, topY: 1.58 }, cockpit: [0.12, -0.07], lamps: [V3(2.3, 0.98, -0.6), V3(2.3, 0.98, 0.6)], tail: [V3(-2.3, 0.84, -0.74), V3(-2.3, 0.84, 0.74)], note: 0.85, paint: 'paint' },
  taxi: { box: { belt: 1.12, roof: 1.7, cab: [-1.6, 0.7] }, variants: ['checks', 'two-tone', 'door checks'], scrape: { x: [-1.2, 0.5], y: 0.82, z: 0.712 }, build: (P, v) => saloonParts(P, 'taxi', v), spec: sedanSpec({ accel: 4.4, vmax: 20 }), halfL: 2.45, halfW: 0.95, eye: V3(0.1, 1.43, -0.32), screen: { base: 0.75, baseY: 1.11, top: 0.48, topY: 1.58 }, cockpit: [0.12, -0.07], lamps: [V3(2.3, 0.98, -0.6), V3(2.3, 0.98, 0.6)], tail: [V3(-2.3, 0.84, -0.74), V3(-2.3, 0.84, 0.74)], note: 0.95, paint: 'paint' },
  police: { box: { belt: 1.12, roof: 1.7, cab: [-1.6, 0.7] }, variants: ['white doors', 'black and white', 'spotlight'], scrape: { x: [-1.2, 0.5], y: 0.82, z: 0.712 }, build: (P, v) => saloonParts(P, 'police', v), spec: sedanSpec({ accel: 5.0, vmax: 24, mass: 1.2 }), halfL: 2.45, halfW: 0.95, eye: V3(0.1, 1.43, -0.32), screen: { base: 0.75, baseY: 1.11, top: 0.48, topY: 1.58 }, cockpit: [0.12, -0.07], lamps: [V3(2.3, 0.98, -0.6), V3(2.3, 0.98, 0.6)], tail: [V3(-2.3, 0.84, -0.74), V3(-2.3, 0.84, 0.74)], note: 1.1, paint: 'paint', cap: true },
  hearse: { box: { belt: 1.12, roof: 1.82, cab: [-3.05, 1.3] }, variants: ['landau', 'curtained'], scrape: { x: [0.0, 1.2], y: 0.82, z: 0.712 }, build: hearseParts, spec: sedanSpec({ vmax: 17, accel: 3.2, a: 2.0, b: 2.0, k: 1.7, mass: 1.6, steerMax: 0.5, latCap: 7.2, halfL: 3.2, halfW: 0.96 }), halfL: 3.2, halfW: 0.96, eye: V3(0.72, 1.44, -0.32), screen: { base: 1.37, baseY: 1.11, top: 1.1, topY: 1.6 }, cockpit: [0.74, -0.06], lamps: [V3(2.92, 0.98, -0.6), V3(2.92, 0.98, 0.6)], tail: [V3(-3.12, 0.84, -0.74), V3(-3.12, 0.84, 0.74)], note: 0.7, paint: 'paint' },
  van: { box: { belt: 1.3, roof: 2.36, cab: [-2.68, 0.95], nose: 1.28 }, variants: ['box', 'panel', 'pickup'], vbox: { 1: { roof: 2.2 }, 2: { cab: [-0.25, 0.95], roof: 2.22, load: [-2.7, -0.25, 1.48] } }, scrape: { x: [-0.2, 0.9], y: 1.05, z: 0.76 }, build: vanParts, spec: sedanSpec({ vmax: 15, accel: 2.9, a: 1.75, b: 1.8, k: 1.5, h: 0.85, mass: 1.9, steerMax: 0.52, latCap: 6.4, halfL: 2.8, halfW: 1.05 }), halfL: 2.8, halfW: 1.05, eye: V3(0.38, 1.82, -0.36), screen: { base: 0.97, baseY: 1.32, top: 0.73, topY: 1.97 }, cockpit: [0.4, 0.32], lamps: [V3(2.44, 1.12, -0.62), V3(2.44, 1.12, 0.62)], tail: [V3(-2.72, 0.7, -0.84), V3(-2.72, 0.7, 0.84)], note: 0.75, paint: 'paintGrey', cap: true },
  lorry: { box: { belt: 1.58, roof: 2.6, cab: [0.95, 2.05], nose: 1.58, load: [-3.7, 0.8, 2.7] }, variants: ['tarp', 'box', 'flatbed'], vbox: { 1: { load: [-3.7, 0.8, 3.45] }, 2: { load: [-3.7, 0.8, 2.2] } }, scrape: { x: [1.1, 1.9], y: 1.3, z: 0.76 }, build: lorryParts, spec: { ...CAR_SPECS.truck, vmax: 12.5, accel: 1.9, a: 2.9, b: 2.4, k: 2.2, halfL: 3.85, halfW: 1.2, mass: 4, steerMax: 0.5, latCap: 5.4 }, halfL: 3.85, halfW: 1.2, eye: V3(1.5, 2.12, -0.42), screen: { base: 2.07, baseY: 1.62, top: 1.83, topY: 2.36 }, cockpit: [1.52, 0.62], lamps: [V3(3.52, 1.38, -0.7), V3(3.52, 1.38, 0.7)], tail: [V3(-3.76, 1.05, -1.0), V3(-3.76, 1.05, 1.0)], note: 0.55, paint: 'paintGrey', cap: true },
};
export const FLEET = Object.keys(KINDS);
for (const K of Object.values(KINDS)) K.nv = K.variants.length;
// a car's look by where it stands: a seeded hash of the place (a bay, a lane's
// point) and a salt - the same street has the same cars every night, and no two
// neighbours read alike
const hash01 = (x, z, salt) => { const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453; return h - Math.floor(h); };
export function lookAt(kind, x, z, salt = 0, { parked = false } = {}) {
  const K = KINDS[kind];
  const variant = Math.floor(hash01(x, z, salt + 1) * K.nv) % K.nv;
  // (the police, the taxis and the hearse keep their colour: black; the rest in three greys)
  const fixed = kind === 'police' || kind === 'taxi' || kind === 'hearse';
  const pr = hash01(x, z, salt + 2);
  const paint = fixed ? K.paint : pr < 0.5 ? 'paint' : pr < 0.8 ? 'paintGrey' : 'paintPale';
  const white = kind !== 'lorry' && kind !== 'van' && hash01(x, z, salt + 3) < 0.45;
  const scrape = parked && hash01(x, z, salt + 4) < 0.22 ? (hash01(x, z, salt + 5) < 0.5 ? -1 : 1) : 0;
  const sag = parked && hash01(x, z, salt + 6) < 0.08 ? (hash01(x, z, salt + 7) < 0.5 ? -1 : 1) : 0;
  return { variant, paint, white, scrape, sag, u: hash01(x, z, salt + 8) };
}
// the three greys a car may be painted (the garage's): black, the dark grey, the light
export const PAINTS = ['paint', 'paintGrey', 'paintPale'];

// ---- the builds: once a kind (near and far), shared ----------------------------------------------
const BUILT = new Map();
// the far build (past 95 m: a car a few dozen pixels long in the rain): its
// masses as boxes and its wheels, a few hundred triangles
function buildBox(kind, v = 0) {
  const K = KINDS[kind], B = { ...K.box, ...((K.vbox && K.vbox[v]) || {}) }, L = K.halfL, W = K.halfW;
  const bx = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const body = [bx(-L, L, 0.42, B.nose || B.belt, -W * 0.82, W * 0.82), bx(B.cab[0], B.cab[1], B.belt - 0.05, B.roof, -W * 0.68, W * 0.68)];
  if (B.load) body.push(bx(B.load[0], B.load[1], 1.2, B.load[2], -W, W));
  const r = kind === 'lorry' ? 0.5 : kind === 'van' ? 0.42 : 0.375;
  const dark = [];
  for (const x of [L * 0.62, -L * 0.62]) for (const z of [-W * 0.85, W * 0.85]) dark.push(new THREE.CylinderGeometry(r, r, 0.22, 8).rotateX(Math.PI / 2).translate(x, r, z));
  const glass = [bx(B.cab[0] + 0.15, B.cab[1] - 0.1, B.belt + 0.08, B.roof - 0.12, -W * 0.7, W * 0.7)];
  const chrome = [bx(L - 0.05, L + 0.1, 0.4, 0.55, -W, W), bx(-L - 0.1, -L + 0.05, 0.4, 0.55, -W, W)];
  const out = { body: merge(body), bodyWell: merge(body), dark: merge(dark), glass: merge(glass), chrome: merge(chrome) };
  // (and all of it as one mesh: the parked far off are one draw a variant)
  out.all = merge([out.body, out.dark, out.glass, out.chrome]);
  for (const g of Object.values(out)) { g.computeBoundingBox(); g.computeBoundingSphere(); }
  return out;
}
const mergeUV = (list) => mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k); return n; }), false);
function buildParts(kind, q, v = 0) {
  CQ = q;
  try {
    const P = { paint: [], well: [], shell: [], chrome: [], dark: [], hub: [], glass: [], lens: [], pale: [], red: [], lamp: [], bust: [], white: [], name: [] };
    const K = KINDS[kind];
    K.build(P, v);
    bust(P, K.eye.clone().add(V3(-0.28, 0, 0)), { cap: !!K.cap });
    const out = {};
    for (const [k, list] of Object.entries(P)) if (list.length) out[k] = k === 'name' ? mergeUV(list) : merge(list);
    // (the shell is the paint's: one mesh outside, the well's body inside)
    out.body = merge([out.paint, out.shell].filter(Boolean));
    out.bodyWell = merge([out.well, out.shell].filter(Boolean));
    for (const g of Object.values(out)) { g.computeBoundingBox(); g.computeBoundingSphere(); }
    return out;
  } finally { CQ = 1; }
}
// far: false / 0 the near build, true / 1 the light one, 2 the boxes; v the variant
export function kindGeo(kind, far = false, v = 0) {
  const lv = far === true ? 1 : far || 0;
  const key = kind + ':' + lv + ':' + v;
  if (!BUILT.has(key)) BUILT.set(key, lv === 2 ? buildBox(kind, v) : buildParts(kind, lv ? 0.45 : 1, v));
  return BUILT.get(key);
}
// the scrape along a door (a parked car's, now and then): a few pale strokes
let SCRAPE = null;
export function scrapeGeo() {
  if (SCRAPE) return SCRAPE;
  const L = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 7; i++) { const len = 0.2 + rnd() * 0.5; L.push(new THREE.BoxGeometry(len, 0.008 + rnd() * 0.008, 0.004).rotateZ((rnd() - 0.5) * 0.3).translate((rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.16, 0)); }
  SCRAPE = merge(L);
  return SCRAPE;
}

// the materials the fleet adds to the stage's (same programs as the stage's own)
const MATS = new WeakMap();
export function fleetMats(M) {
  if (MATS.has(M)) return MATS.get(M);
  const pale = M.paintGrey.clone(); pale.color = new THREE.Color(0x2a2a2a); pale.name = 'paintPale';
  const red = new THREE.MeshBasicMaterial({ color: accent('crew', { gain: 7 }) }); red.name = 'accent_crew_lamp'; red.userData.accent = 'crew';
  const redDim = new THREE.MeshBasicMaterial({ color: accent('crew', { gain: 0.6 }) }); redDim.name = 'accent_crew_dim'; redDim.userData.accent = 'crew';
  const roof = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(3.2) });
  // the painted names: an atlas of the trades' words (a sign-writer's serif capitals)
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64 * NAMES.length;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  NAMES.forEach((w, i) => { x.font = 'bold 52px Georgia, "Times New Roman", serif'; const m = x.measureText(w).width; x.save(); x.translate(512, i * 64 + 34); x.scale(Math.min(1, 960 / m) * 1, 1); x.fillText(w.split('').join(String.fromCharCode(8202)), 0, 0); x.restore(); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const name = new THREE.MeshStandardMaterial({ color: 0xbdbbb2, map: tex, alphaTest: 0.5, roughness: 0.85, metalness: 0, envMap: M.envSoft, envMapIntensity: 0.3 });
  name.name = 'o2_names';
  const R = { paintPale: pale, red, redDim, roof, name };
  MATS.set(M, R);
  return R;
}
export function paintMat(M, name) { return name === 'paintPale' ? fleetMats(M).paintPale : M[name] || M.paint; }

// A car of a kind: a group of meshes on the kind's shared geometry.
export function fleetModel(kind, stage, { paint = null, variant = 0, white = false } = {}) {
  const K = KINDS[kind];
  if (!K) throw new Error(`fleet: no kind '${kind}' (${FLEET.join(', ')})`);
  const v = Math.max(0, Math.min(K.nv - 1, variant | 0));
  const M = stage.M, X = fleetMats(M), G = kindGeo(kind, 0, v);
  const g = new THREE.Group();
  g.name = 'fleet_' + kind;
  const meshes = {};
  const mk = (key, geo, mat, part) => {
    if (!geo) return null;
    const m = new THREE.Mesh(geo, mat);
    m.name = key; m.castShadow = false; m.receiveShadow = true;
    m.userData.part = part; m.userData.geoKey = key;
    g.add(m); meshes[key] = m;
    return m;
  };
  const pname = paint || K.paint;
  mk('body', G.body, paintMat(M, pname), 'body');
  mk('chrome', G.chrome, M.chrome, 'body');
  mk('dark', G.dark, M.rubber, 'rubber');
  mk('hub', G.hub, M.hubcap, 'rubber');
  mk('glass', G.glass, M.carGlass, 'glass');
  if (meshes.glass) meshes.glass.userData.surf = 'glass';
  mk('lens', G.lens, M.glass, 'lens');
  if (meshes.lens) { meshes.lens.userData.emitter = true; meshes.lens.userData.noRay = true; }
  mk('pale', G.pale, M.whitewall, 'body');
  mk('bust', G.bust, M.rubber, 'driver');
  if (meshes.bust) { meshes.bust.visible = false; meshes.bust.userData.noRay = true; }
  if (G.red) { const r = mk('red', G.red, M.glass, 'lamp'); r.userData.emitter = true; r.userData.noRay = true; }
  if (G.lamp) { const r = mk('lamp', G.lamp, X.roof, 'lamp'); r.userData.emitter = true; r.userData.noRay = true; }
  if (G.white && white) mk('white', G.white, M.whitewall, 'rubber');
  if (G.name) { const n = mk('name', G.name, X.name, 'body'); n.userData.noRay = true; }
  meshes.contact = contactShadow(g, K.halfL * 2 + 1.2, K.halfW * 2 + 1.0);
  const model = { group: g, meshes, kind, K, paint: pname, variant: v, white: !!(G.white && white), far: 0, well: false, fleet: true };
  return model;
}
// near / far build (the traffic's LOD, every quarter second)
// (far: 0 near, 1 light, 2 boxes; a part the boxes have not - the hubs, the
// lenses, the extras - hidden that far off)
export function fleetLod(model, far) {
  const lv = far === true ? 1 : far || 0;
  if (model.far === lv || model.well) return;
  model.far = lv;
  const G = kindGeo(model.kind, lv, model.variant), N = kindGeo(model.kind, 0, model.variant);
  for (const m of Object.values(model.meshes)) {
    if (!m || !m.isMesh || !m.userData.geoKey) continue;
    const k = m.userData.geoKey;
    if (G[k]) { m.userData.rayGeo = N[k]; m.geometry = G[k]; if (m.userData.lodHid) { m.visible = true; m.userData.lodHid = false; } }
    else if (lv === 2 && m.visible) { m.visible = false; m.userData.lodHid = true; }
    else if (lv < 2 && m.userData.lodHid) { m.visible = true; m.userData.lodHid = false; m.geometry = N[k]; }
  }
}
// the player's own car: the body with its well (the dash is the cockpit's),
// the glass gone (the screen's rain is an effect of its own), the man gone
export function wellOn(model, on) {
  if (!model.fleet) return;
  fleetLod(model, false);
  model.well = on;
  model.far = 0;
  const G = kindGeo(model.kind, 0, model.variant);
  model.meshes.body.geometry = on ? G.bodyWell : G.body;
  if (model.meshes.glass) model.meshes.glass.visible = !on;
  // (my own lenses: from the seat their backs peeked over the bonnet's nose, a white blot)
  if (model.meshes.lens) model.meshes.lens.visible = !on;
  if (model.meshes.lamp) model.meshes.lamp.visible = !on;
}
export function repaint(model, stage, name) {
  if (!model.meshes.body) return;
  model.meshes.body.material = paintMat(stage.M, name);
  model.paint = name;
}
// the lamps lit (the lenses white, the police lamp red and bright, the taxi's roof lamp)
export function lampsLit(model, stage, on) {
  const M = stage.M, X = fleetMats(M);
  if (model.meshes.lens) model.meshes.lens.material = on ? M.headlamp : M.glass;
  // (the police lamp unlit is dark glass: the crew's red only while it burns)
  if (model.meshes.red) model.meshes.red.material = on ? X.red : M.glass;
}
// a soft red halo over the police lamp (the siren's turn): a sprite of the crew's red
export function policeGlow(model) {
  if (model.glow || !model.meshes.red) return model.glow;
  const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: accent('crew', { gain: 1.2 }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  mat.name = 'accent_crew_glow'; mat.userData.accent = 'crew';
  const sp = new THREE.Sprite(mat);
  sp.position.set(0, 1.82, 0); sp.scale.setScalar(0.9);
  sp.layers.set(LAYER.FX_REFL); sp.renderOrder = 6; sp.userData.noRay = true;
  sp.visible = false;
  model.group.add(sp);
  model.glow = sp;
  return sp;
}
