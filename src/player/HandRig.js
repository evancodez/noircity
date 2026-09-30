import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// One articulated arm (lane 2 brief P0.1): the detective's hand and sleeve,
// the one rig every hands set uses (the Tommy gun's grips, the diner, the
// fists). Built once per side; the left arm is the right arm mirrored by its
// root (scale.x = -1: three flips the winding for a negative determinant),
// so every pose is authored for a right hand in the arm's own mirrored
// space (Hands.js converts camera-space targets into it).
//
// Hand frame (the `hand` bone, the wrist centre): -z along the hand to the
// fingers, +y the back of the hand, +x the little-finger side. Rest pose:
// the hand flat, fingers straight and a little fanned.
//
// Skeleton: hand (wrist, 2 axes + the forearm's roll: its full rotation),
// four fingers of three joints (MCP with its spread, PIP, DIP), the thumb of
// three (CMC in 3 axes, MCP, IP). The elbow is not a bone: it is a point in
// camera space, and the forearm (sleeve, cuff, bare forearm) is laid from it
// to the wrist every step.
//
// Surfaces (wave B, lane B3: "less balloon"): built as an inker constructs a
// hand, not as tubes and balls. The back of the hand a flat wedge with its
// knuckle line; the knuckles a row of rolls; each finger three tapered boxes
// (a superellipse section: flat top, flat sides, the pad rounder beneath)
// stepping down at each joint over a roll that closes the joint's back when
// it bends; the thumb squared, its ball a soft mass; the wrist a flattened
// box into the cuff. Planes catch the light as planes (the ink's skin print
// splits lit and shadow by the form), and the ink's lines fall where an
// inker's do: between the fingers, the knuckles of a fist, the web as the
// palm's own edge, the cuff. One SkinnedMesh per skin, rigid weights (the
// web blended into the thumb's metacarpal): one draw per hand. (The first
// version's knuckle spheres, torus ticks and nails are gone; the marks'
// vertex-colour channel stays, empty.)

export const HAND = {
  // palm 0.085 wide, 0.095 long, 0.028 thick (the brief's adult male)
  palm: { w: 0.085, l: 0.095, t: 0.028 },
  // name, MCP x, MCP z, length, r base, r tip, rest spread (+ toward the thumb)
  fingers: [
    ['i', -0.0292, -0.0905, 0.072, 0.0095, 0.0077, 0.07],
    ['m', -0.0093, -0.0950, 0.080, 0.0097, 0.0079, 0.01],
    ['r', 0.0104, -0.0915, 0.074, 0.0092, 0.0075, -0.06],
    ['l', 0.0282, -0.0835, 0.058, 0.0083, 0.0067, -0.15],
  ],
  phal: [0.45, 0.3, 0.25],
  flat: 0.9,               // fingers a little flatter back-to-palm than across
  // the thumb: CMC deep in the heel of the palm on its radial side; the
  // metacarpal (inside the ball of the thumb), then the visible 0.060
  thumb: { cmc: [-0.026, -0.009, -0.014], dir: [-0.5, -0.2, -0.84], nail: [-0.62, 0.78, 0.0], meta: 0.042, seg: [0.033, 0.027], r: [0.0128, 0.011, 0.0101, 0.0088] },
  wrist: { rx: 0.029, ry: 0.02 },   // the wrist 0.058 x 0.040
  // the bare hand's fingers are a man's, not a glove's: slimmer than the
  // leather (radius 8.5 mm at the base tapering to 6.5 at the tip), so the
  // knuckles stand proud of them and the joints read; the glove keeps the
  // leather's girth (the Tommy gun's grips are fitted to it)
  bare: {
    fingers: { i: [0.0085, 0.0065], m: [0.0087, 0.0066], r: [0.0082, 0.0063], l: [0.0074, 0.0057] },
    thumb: [0.0118, 0.0101, 0.0092, 0.008],
    knuckle: 1.2,
  },
};
export const FINGERS = ['i', 'm', 'r', 'l'];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- geometry pieces (each built in its bone's frame) ------------------------------
// (wave B, lane B3: the hand as an inker constructs it - "less balloon".
// Every piece is a superellipse section lofted along its bone: a flat top
// and flat sides with soft corners, a rounder pad beneath, so the planes
// catch the light as planes - one side lit, one side ink, a hard edge
// between - and the ink's creases fall on the corners, the joints, the
// gaps between the fingers. No knuckle spheres, no torus ticks, no nails:
// the lines are the geometry's own.)
// a superellipse point: angle a (0 = +x, pi/2 = the top +y); half sizes hw,
// the top's hh and the bottom's hb; exponents nt (top), nb (bottom)
function sePt(a, hw, hh, hb, nt, nb) {
  const c = Math.cos(a), s = Math.sin(a);
  const ex = 2 / (s >= 0 ? nt : nb);
  return [hw * Math.sign(c) * Math.pow(Math.abs(c), ex), (s >= 0 ? hh : hb) * Math.sign(s) * Math.pow(Math.abs(s), ex)];
}
// a loft along -z: rings of a section fn(u) -> { hw, hh, hb, cy, nt, nb, z }
// at u = 0 .. 1 (rows), closed by domes (their length in metres) at either end
function loft(sec, { rows = 6, cols = 28, dome0 = 0, dome1 = 0, domeRows = 4 } = {}) {
  const rings = [];
  const ring = (S, scale, dz) => {
    const pts = [];
    for (let j = 0; j < cols; j++) {
      const a = (j / cols) * Math.PI * 2;
      const [x, y] = sePt(a, S.hw * scale, S.hh * scale, S.hb * scale, S.nt ?? 4, S.nb ?? 2.6);
      pts.push(x + (S.cx || 0), y + (S.cy || 0), S.z + dz);
    }
    rings.push(pts);
  };
  const S0 = sec(0), S1 = sec(1);
  // the start dome: from a point up to the first ring (an ellipse's quarter)
  if (dome0 > 0) for (let k = 0; k < domeRows; k++) { const t = 1 - k / domeRows; ring(S0, Math.sqrt(Math.max(0, 1 - t * t)), dome0 * t); }
  for (let i = 0; i <= rows; i++) ring(sec(i / rows), 1, 0);
  if (dome1 > 0) for (let k = 1; k <= domeRows; k++) { const t = k / domeRows; ring(S1, Math.sqrt(Math.max(0, 1 - t * t)), -dome1 * t); }
  const pos = [], idx = [];
  for (const r of rings) pos.push(...r);
  const n = rings.length;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < cols; j++) {
    const a = i * cols + j, b = i * cols + (j + 1) % cols, c = (i + 1) * cols + j, d = (i + 1) * cols + (j + 1) % cols;
    idx.push(a, c, b, b, c, d);
  }
  // flat caps where there is no dome (a fan to the ring's centre)
  const cap = (ri, flip) => {
    const base = pos.length / 3, S = ri === 0 ? S0 : S1;
    const r = rings[ri];
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < cols; j++) { cx += r[j * 3]; cy += r[j * 3 + 1]; cz += r[j * 3 + 2]; }
    pos.push(cx / cols, cy / cols, cz / cols);
    for (let j = 0; j < cols; j++) { const a = ri * cols + j, b = ri * cols + (j + 1) % cols; if (flip) idx.push(base, b, a); else idx.push(base, a, b); }
    void S;
  };
  if (!(dome0 > 0)) cap(0, false);
  if (!(dome1 > 0)) cap(n - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
// a joint's roll: a squat superellipsoid lying along x (the joint's hinge),
// round about it (radius r, so a bending neighbour never opens a gap on the
// back), its ends flat with soft edges; centred at c
function roll(w, r, c, n = 5, rb = r) {
  const g = new THREE.SphereGeometry(1, 16, 12);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ex = Math.sign(x) * Math.pow(Math.abs(x), 2 / n);
    p.setXYZ(i, (w / 2) * ex, (y >= 0 ? r : rb) * y, r * z);
  }
  g.translate(c.x, c.y, c.z);
  return g;
}
function ellipsoid(rx, ry, rz, c, w = 18, h = 12) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(c.x, c.y, c.z);
  return g;
}
const lerp = (a, b, t) => a + (b - a) * t;
// the knuckle line: where the back of the hand ends, by x (the four MCPs,
// straight on past the index and the little finger)
function knuckleZ(x) {
  const K = HAND.fingers.map((f) => [f[1], f[2]]);
  if (x <= K[0][0]) return K[0][1] + (x - K[0][0]) * ((K[1][1] - K[0][1]) / (K[1][0] - K[0][0])) * 0.5;
  for (let i = 0; i < K.length - 1; i++) if (x <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], (x - K[i][0]) / (K[i + 1][0] - K[i][0]));
  const L = K.length - 1;
  return K[L][1] + (x - K[L][0]) * ((K[L][1] - K[L - 1][1]) / (K[L][0] - K[L - 1][0]));
}
// the back of the hand: a flat, slightly wedge-shaped slab from the heel to
// the knuckle line (thicker at the heel on the palm's side, the back arched
// a little across), its front edge slanted along the knuckles
function palmSlab(g0) {
  const rows = 14, cols = 44;
  // (the heel starts inside the wrist, narrower, and widens out of it: no
  // end face shows where the hand meets the wrist)
  const zBack = 0.014;
  const pos = [], idx = [];
  const h0 = 0.13;
  const sec = (u) => (u < h0 ? {
    hw: lerp(0.0262, 0.0322, sstep(0, 1, u / h0)) * g0,
    hh: lerp(0.0092, 0.0112, sstep(0, 1, u / h0)) * g0,
    hb: lerp(0.0142, 0.0165, sstep(0, 1, u / h0)) * g0,
  } : {
    hw: lerp(0.0322, 0.0425, Math.min(1, (u - h0) / 0.62)) * g0,
    hh: lerp(0.0112, 0.0082, (u - h0) / (1 - h0)) * g0,
    hb: lerp(0.0165, 0.0106, Math.min(1, (u - h0) * 1.2)) * g0,
  });
  for (let i = 0; i <= rows; i++) {
    const u = i / rows, S = sec(u);
    for (let j = 0; j < cols; j++) {
      const a = (j / cols) * Math.PI * 2;
      let [x, y] = sePt(a, S.hw, S.hh, S.hb, 4.2, 2.8);
      // (the back's gentle arch across the hand)
      if (y > 0) y += 0.0016 * g0 * (1 - Math.min(1, (x / S.hw) ** 2));
      const z = lerp(zBack, knuckleZ(x) + 0.001, u);
      pos.push(x, y - 0.0012, z);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * cols + j, b = i * cols + (j + 1) % cols, c = (i + 1) * cols + j, d = (i + 1) * cols + (j + 1) % cols;
    idx.push(a, c, b, b, c, d);
  }
  // the two ends: fans (the heel inside the wrist, the front under the knuckles)
  for (const [ri, flip] of [[0, false], [rows, true]]) {
    const base = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < cols; j++) { cx += pos[(ri * cols + j) * 3]; cy += pos[(ri * cols + j) * 3 + 1]; cz += pos[(ri * cols + j) * 3 + 2]; }
    pos.push(cx / cols, cy / cols, cz / cols);
    for (let j = 0; j < cols; j++) { const a = ri * cols + j, b = ri * cols + (j + 1) % cols; if (flip) idx.push(base, b, a); else idx.push(base, a, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// attributes every part carries: skin index / weight (one bone, rigid) and a
// vertex colour (1 = the skin, `ink` = a mark)
function tag(g, bone, col = 1, weightFn = null) {
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  if (g.getAttribute('normal')) g.deleteAttribute('normal');
  let geo = mergeVertices(g, 1e-6);
  geo.computeVertexNormals();
  const n = geo.getAttribute('position').count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), c = new Float32Array(n * 3);
  const P = geo.getAttribute('position'), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    if (weightFn) {
      v.fromBufferAttribute(P, i);
      const [b0, b1, w1] = weightFn(v);
      si[i * 4] = b0; si[i * 4 + 1] = b1; sw[i * 4] = 1 - w1; sw[i * 4 + 1] = w1;
    } else { si[i * 4] = bone; sw[i * 4] = 1; }
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = col;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setAttribute('mark', new THREE.Float32BufferAttribute(c, 3));
  return geo;
}

// ---- the forearm pieces: lathes along +y of unit length (scaled to the
// wrist-elbow distance), laid from the wrist (y = 0) to the elbow (y = 1)
// the coat sleeve: 0.045 at the cuff widening to 0.055, a turned hem
function sleeveGeometry(len0 = 0.34) {
  const s = (d) => d / len0;   // metres along the arm -> unit length at a typical reach
  const prof = [[0.0, s(-0.004)], [0.036, s(-0.004)], [0.0435, s(0.0)], [0.0462, s(0.006)], [0.0458, s(0.016)], [0.045, s(0.022)],
    [0.0465, s(0.06)], [0.049, s(0.14)], [0.052, s(0.24)], [0.055, 0.85], [0.056, 1.05], [0.0, 1.06]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 28);
}
// pushed up (the fists): the sleeve bunched in thick rolls below the elbow
function pushedSleeveGeometry() {
  const prof = [[0.0, 0.172], [0.036, 0.172], [0.052, 0.182], [0.061, 0.2], [0.057, 0.225], [0.063, 0.255], [0.058, 0.285], [0.062, 0.32],
    [0.06, 0.38], [0.058, 1.05], [0.0, 1.06]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 28);
}
// the shirt cuff: 8 mm of paper white between the sleeve and the wrist (in
// metres, from the sleeve's hem: y < 0 shows)
function cuffGeometry() {
  const prof = [[0.0, -0.0095], [0.033, -0.0095], [0.0368, -0.0075], [0.0374, -0.004], [0.0372, 0.02], [0.0, 0.021]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 24);
}
// the upper arm, elbow (y = 0) to shoulder (y = 1): the coat, round at the elbow
function upperArmGeometry() {
  const prof = [[0.0, -0.05], [0.03, -0.045], [0.048, -0.03], [0.057, -0.01], [0.06, 0.05], [0.064, 0.6], [0.066, 1.0], [0.0, 1.01]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 24);
}
// the rolled shirt cuff under a pushed-up sleeve
function rolledCuffGeometry() {
  const prof = [[0.0, 0.146], [0.036, 0.146], [0.046, 0.151], [0.05, 0.163], [0.048, 0.178], [0.043, 0.188], [0.0, 0.189]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 24);
}
// the bare forearm (sleeves pushed up): wrist to the rolls
// (round 2: flat across the wrist as a wrist is - wider than it is thick,
// its flat laid in the hand's own plane by apply() - so it runs into the
// wrist and the heel of the hand without the hard angle the ink drew where a
// round arm met a flat hand; rounding out toward the elbow)
function forearmGeometry() {
  const prof = [[0.0, -0.024], [0.02, -0.022], [0.027, -0.006], [0.0285, 0.03], [0.033, 0.1], [0.038, 0.16], [0.039, 0.2], [0.0, 0.21]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 32);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = sstep(0.0, 0.12, y);
    p.setX(i, p.getX(i) * (1.05 + (1 - 1.05) * k));
    p.setZ(i, p.getZ(i) * (0.72 + (1 - 0.72) * k));
  }
  g.computeVertexNormals();
  return g;
}
// the glove's gauntlet: a short flared leather cuff over the wrist (metres,
// from the sleeve's hem)
function gauntletGeometry() {
  const prof = [[0.0, -0.034], [0.028, -0.034], [0.032, -0.026], [0.0355, -0.006], [0.0385, 0.012], [0.0, 0.013]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), 24);
}

// ---- the rig ---------------------------------------------------------------------
export class HandRig {
  // mats: { bare, glove, sleeve, cuff } (materials take vertex colours via
  // the 'mark' attribute, see Hands.js); ids: { skin, sleeve, cuff }
  constructor(side, mats, ids, layer) {
    this.side = side;
    this.root = new THREE.Group();
    this.root.name = 'arm' + side;
    if (side === 'L') this.root.scale.x = -1;
    this.bones = [];
    const bone = (name, parent, pos) => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.copy(pos);
      if (parent) parent.add(b);
      this.bones.push(b);
      return b;
    };
    this.hand = bone('hand', null, V(0, 0, 0));
    this.fingers = {};
    const F = HAND.fingers, PH = HAND.phal;
    for (const [name, x, z, len, , , spread] of F) {
      const b0 = bone(name + '0', this.hand, V(x, 0.0005, z));
      const b1 = bone(name + '1', b0, V(0, 0, -len * PH[0]));
      const b2 = bone(name + '2', b1, V(0, 0, -len * PH[1]));
      this.fingers[name] = { b: [b0, b1, b2], len, spread };
      b0.rotation.y = spread;
    }
    const T = HAND.thumb;
    const t0 = bone('t0', this.hand, V(...T.cmc));
    const t1 = bone('t1', t0, V(0, 0, -T.meta));
    const t2 = bone('t2', t1, V(0, 0, -T.seg[0]));
    // the thumb's rest frame: -z out along `dir`, +y toward its nail
    const zAx = V(...T.dir).normalize().negate();
    const yAx = V(...T.nail).addScaledVector(zAx, -V(...T.nail).dot(zAx)).normalize();
    const xAx = new THREE.Vector3().crossVectors(yAx, zAx);
    this.thumbRest = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx));
    t0.quaternion.copy(this.thumbRest);
    this.thumb = { b: [t0, t1, t2] };
    this.hand.updateMatrixWorld(true);

    // two skins on one skeleton, each its own geometry: the bare hand
    // (slim fingers, proud knuckles; dark ticks and nails) and the glove
    // (the leather's girth; pale ticks, no nails)
    const geoG = this.buildHandGeometry(null);
    geoG.setAttribute('color', new THREE.Float32BufferAttribute(HandRig.markColours(this.markKind, 2.6, 1), 3));
    const geo = this.buildHandGeometry(HAND.bare);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(HandRig.markColours(this.markKind, 0.06, 0.3), 3));
    const skeleton = new THREE.Skeleton(this.bones);
    const mk = (mat) => {
      const m = new THREE.SkinnedMesh(geo, mat);
      m.frustumCulled = false;
      m.castShadow = false; m.receiveShadow = false;
      m.add(this.hand);
      m.bind(skeleton);
      m.userData.inkId = ids.skin; m.userData.inkFigure = true;
      m.layers.set(layer);
      return m;
    };
    // (both skins share one skeleton: the hand bone is parented to the bare
    // one, the glove renders from the same bone matrices)
    this.bare = mk(mats.bare);
    this.glove = new THREE.SkinnedMesh(geoG, mats.glove);
    this.glove.frustumCulled = false; this.glove.castShadow = false;
    this.glove.bind(skeleton, this.bare.bindMatrix);
    this.glove.userData.inkId = ids.skin; this.glove.userData.inkFigure = true;
    this.glove.layers.set(layer);
    this.root.add(this.bare, this.glove);
    this.skin = 'bare';
    this.glove.visible = false;

    const plain = (g, mat, id) => {
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
      m.userData.inkId = id; m.userData.inkFigure = true;
      m.layers.set(layer);
      this.root.add(m);
      return m;
    };
    this.sleeve = plain(sleeveGeometry(), mats.sleeve, ids.sleeve);
    this.pushed = plain(pushedSleeveGeometry(), mats.sleeve, ids.sleeve);
    this.cuff = plain(cuffGeometry(), mats.cuff, ids.cuff);
    this.rolled = plain(rolledCuffGeometry(), mats.cuff, ids.cuff);
    this.forearm = plain(forearmGeometry(), mats.bare, ids.skin);
    this.gauntlet = plain(gauntletGeometry(), mats.glove, ids.skin);
    this.upper = plain(upperArmGeometry(), mats.sleeve, ids.sleeve);
    for (const m of [this.forearm, this.gauntlet]) m.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(m.geometry.getAttribute('position').count * 3).fill(1), 3));
    this.sleeveMode = 'coat';
    this.setSleeve('coat', true);
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._up = V(0, 1, 0); this._d = V(0, 0, 0); this._u = V(0, 0, 0); this._sh = V(0, 0, 0);
    this.elbow = V(0.2, -0.4, 0.05);
  }

  // the hand's geometry in rest pose (hand-bone space), built as an inker
  // constructs a hand (wave B, lane B3): the back a flat wedge with its
  // knuckle line, the knuckles a row of rolls, each finger three tapered
  // boxes (flat top and sides, the pad rounder beneath) stepping down at
  // each joint over a roll that closes the joint's back when it bends, the
  // fingertip domed; the thumb squared, its ball a soft mass; the wrist a
  // flattened box running into the cuff.
  // (dims: HAND.bare for the bare hand's slimmer fingers, null for the
  // glove's leather girth; the marks' channel is kept, empty)
  buildHandGeometry(dims = null) {
    const parts = [];
    const B = (b) => this.bones.indexOf(b);
    const rest = (b) => {
      // the bone's rest matrix relative to the hand
      const m = new THREE.Matrix4();
      const chain = [];
      for (let o = b; o && o !== this.hand; o = o.parent) chain.unshift(o);
      for (const o of chain) { o.updateMatrix(); m.multiply(o.matrix); }
      return m;
    };
    const add = (g, b, col = 1, wfn = null) => { g.applyMatrix4(rest(b)); parts.push(tag(g, B(b), col, wfn)); };
    const H = this.hand;
    const glove = !dims;
    const g0 = glove ? 1.06 : 1;       // (the leather's girth)
    // the back of the hand and the palm: its radial edge between the index's
    // knuckle and the heel is the web, weighted into the thumb's metacarpal,
    // so when the thumb opens the skin between them stretches as one fold
    {
      const bh = B(H), bt = B(this.thumb.b[0]);
      add(palmSlab(g0), H, 1, (v) => {
        const w = 0.72 * sstep(-0.02, -0.04, v.x) * sstep(-0.01, -0.036, v.z) * (1 - sstep(-0.078, -0.096, v.z));
        return [bh, bt, w];
      });
    }
    // the wrist: a flattened box from inside the heel back into the cuff
    // (its top eases down under the back of the hand where they meet, so the
    // two planes run on without a step)
    // (its back end is the bare forearm's own section - an ellipse 58 x 39
    // mm - so it sinks into the forearm or the cuff without a corner)
    add(loft((u) => { const k = sstep(0.3, 1, u), q = sstep(0.72, 1, u); return { hw: lerp(0.0282, 0.0292, k) * g0, hh: lerp(0.0188, 0.0112, k) * g0, hb: lerp(0.0188, 0.0172, k) * g0, cy: lerp(0, -0.0016, k), nt: lerp(2.05, 4.2, q), nb: lerp(2.05, 3.0, q), z: lerp(0.046, -0.012, u) }; }, { rows: 8, cols: 32 }), H);
    const PH = HAND.phal;
    for (const [name, , , len, gr0, gr1] of HAND.fingers) {
      const [r0, r1] = dims ? dims.fingers[name] : [gr0, gr1];
      const [b0, b1, b2] = this.fingers[name].b;
      const L0 = len * PH[0], L1 = len * PH[1], L2 = len * PH[2];
      // the section along the finger: half-width, the top's half-height (a
      // flat back) and the pad's (fuller), tapering base -> tip
      const at = (u) => { const r = lerp(r0, r1, u); return { hw: r * 1.02, hh: r * 0.78, hb: r * 0.98 }; };
      const u1 = PH[0], u2 = PH[0] + PH[1];
      // each phalanx a tapered box from its joint to the next; the next one
      // starts a hair narrower: a step at the joint, not a bulge
      const seg = (L, ua, ub, k, dome = 0) => loft((u) => { const S = at(lerp(ua, ub, u)); return { hw: S.hw * k, hh: S.hh * k, hb: S.hb * k, nt: 4.2, nb: 2.5, z: -L * u }; }, { rows: 4, cols: 28, dome1: dome });
      add(seg(L0, 0, u1, 1), b0);
      add(seg(L1, u1, u2, 0.96), b1);
      const S2 = at(1);
      add(seg(L2 - S2.hh * 0.7, u2, 1, 0.92, S2.hh * 1.25), b2);
      // the joints' rolls (the PIP and DIP): round about the hinge, as high
      // as the phalanx before them - the back of a bent finger closes over
      // them, a straight one shows a small step
      const Sa = at(u1), Sb = at(u2);
      add(roll(Sa.hw * 1.96, Sa.hh * 1.02, V(0, 0, -L0), 5, Sa.hb * 0.9), b0);
      add(roll(Sb.hw * 1.96 * 0.96, Sb.hh * 1.02 * 0.96, V(0, 0, -L1), 5, Sb.hb * 0.9 * 0.96), b1);
      // the knuckle (the metacarpal's head): a roll across the joint a
      // little proud of the back, the palm's (it stays when the fist closes:
      // the knuckle line)
      const S0 = at(0);
      const k = roll(S0.hw * 2.04, S0.hh * 1.4, V(0, 0.0006, 0.0005), 5, S0.hb * 0.95);
      k.applyMatrix4(rest(b0));
      parts.push(tag(k, B(H)));
    }
    // the thumb: the metacarpal inside the ball of the thumb, then two
    // squared segments, the tip domed, a roll at each joint
    const T = { ...HAND.thumb, r: dims ? dims.thumb : HAND.thumb.r }, [t0, t1, t2] = this.thumb.b;
    const tsec = (r0, r1, L, dome = 0) => loft((u) => { const r = lerp(r0, r1, u); return { hw: r * 1.04, hh: r * 0.8, hb: r * 0.98, nt: 3.8, nb: 2.5, z: -L * u }; }, { rows: 4, cols: 28, dome1: dome });
    add(tsec(T.r[0], T.r[1], T.meta), t0);
    // the ball of the thumb (the thenar): a soft mass on the metacarpal's
    // palm side, flatter than it was (no balloon)
    add(ellipsoid(0.0158 * g0, 0.0102 * g0, 0.0265, V(0.0045, -0.0048, -T.meta * 0.46), 20, 12), t0);
    add(tsec(T.r[1], T.r[2], T.seg[0]), t1);
    add(tsec(T.r[2] * 0.96, T.r[3], T.seg[1] - T.r[3] * 0.6, T.r[3] * 1.1), t2);
    add(roll(T.r[1] * 2.0, T.r[1] * 0.84, V(0, 0, 0), 5, T.r[1] * 0.95), t1);
    add(roll(T.r[2] * 1.98, T.r[2] * 0.82, V(0, 0, -T.seg[0]), 5, T.r[2] * 0.95), t1);
    const geo = mergeGeometries(parts, false);
    // (the marks' channel: no ticks, no nails now - every vertex the skin's)
    const mk = geo.getAttribute('mark');
    this.markKind = new Float32Array(mk.count);
    geo.deleteAttribute('mark');
    this.geo = geo;
    return geo;
  }

  // the vertex colours of a skin: base 1, knuckle ticks and nails their own
  static markColours(kind, tickCol, nailCol) {
    const c = new Float32Array(kind.length * 3);
    for (let i = 0; i < kind.length; i++) { const v = kind[i] === 1 ? tickCol : kind[i] === 2 ? nailCol : 1; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
    return c;
  }

  setSkin(skin) {
    this.skin = skin;
    this.bare.visible = skin === 'bare';
    this.glove.visible = skin === 'glove';
    this.setSleeve(this.sleeveMode, true);
  }

  // 'coat' (the coat sleeve; indoors with the shirt cuff), 'pushed' (the
  // fists: bare forearm, rolled cuff, bunched sleeve), 'none'
  setSleeve(mode, force = false) {
    if (mode === this.sleeveMode && !force) return;
    this.sleeveMode = mode;
    const bare = this.skin === 'bare';
    this.sleeve.visible = mode === 'coat';
    this.cuff.visible = mode === 'coat' && bare && this.cuffOn !== false;
    this.pushed.visible = mode === 'pushed';
    this.rolled.visible = mode === 'pushed';
    this.forearm.visible = mode === 'pushed';
    this.gauntlet.visible = mode === 'coat' && !bare;
    this.upper.visible = mode !== 'none';
  }

  set visible(v) { this.root.visible = v; }
  get visible() { return this.root.visible; }

  // Pose the arm (arm-root space, already mirrored for the left):
  //   pos, quat   the hand bone (wrist centre, hand frame)
  //   F           { i: [mcp, pip, dip, spread], m, r, l, t: [cx, cy, cz, mcp, ip] } (radians;
  //               + curls toward the palm)
  //   elbow       Vector3, arm-root space
  apply(pos, quat, F, elbow, shoulder = null) {
    const H = this.hand;
    H.position.copy(pos);
    H.quaternion.copy(quat);
    for (const n of FINGERS) {
      const f = F[n] || ZERO4, fb = this.fingers[n].b;
      fb[0].rotation.set(-f[0], this.fingers[n].spread + (f[3] || 0), 0, 'YXZ');
      fb[1].rotation.set(-f[1], 0, 0);
      fb[2].rotation.set(-f[2], 0, 0);
    }
    const t = F.t || ZERO5, tb = this.thumb.b;
    this._e.set(-t[0], t[1], t[2], 'YXZ');
    tb[0].quaternion.copy(this.thumbRest).multiply(this._q.setFromEuler(this._e));
    tb[1].rotation.set(-t[3], 0, 0);
    tb[2].rotation.set(-t[4], 0, 0);
    this.elbow.copy(elbow);
    // the forearm pieces run from the wrist to the elbow: the sleeve's hem
    // 35 mm up the arm from the wrist's centre (the cuffs hang from it)
    const d = this._d.subVectors(elbow, pos);
    const len = d.length();
    d.multiplyScalar(1 / Math.max(1e-5, len));
    this._q.setFromUnitVectors(this._up, d);
    const hem = 0.035;
    this.sleeve.position.copy(pos).addScaledVector(d, hem);
    this.sleeve.quaternion.copy(this._q);
    this.sleeve.scale.set(1, Math.max(0.05, len - hem), 1);
    for (const m of [this.cuff, this.gauntlet]) {
      m.position.copy(pos).addScaledVector(d, hem);
      m.quaternion.copy(this._q);
    }
    // (the pushed pieces are in metres, not unit length: the rolls stay the
    // same size whatever the reach; the bunched sleeve runs on past the elbow)
    for (const m of [this.pushed, this.rolled, this.forearm]) {
      m.position.copy(pos).addScaledVector(d, 0.004);
      m.quaternion.copy(this._q);
    }
    // (the bare forearm's flat turns with the hand: its local x along the
    // hand's width, so the wrist's ellipse meets the hand's)
    {
      const X = this._u.set(1, 0, 0).applyQuaternion(quat);
      X.addScaledVector(d, -X.dot(d));
      if (X.lengthSq() > 1e-8) {
        X.normalize();
        const Z = this._sh.crossVectors(X, d);
        this.forearm.quaternion.setFromRotationMatrix(_mb.makeBasis(X, d, Z));
      }
    }
    // the upper arm: elbow to shoulder (behind the eye, off the frame)
    const sh = shoulder || this._sh.set(0.2, -0.3, 0.12);
    const u = this._u.subVectors(sh, elbow);
    const ul = u.length();
    this.upper.position.copy(elbow);
    this.upper.quaternion.setFromUnitVectors(this._up, u.multiplyScalar(1 / Math.max(1e-5, ul)));
    this.upper.scale.set(1, ul, 1);
  }
}
const ZERO4 = [0, 0, 0, 0], ZERO5 = [0, 0, 0, 0, 0];
const _mb = new THREE.Matrix4();
