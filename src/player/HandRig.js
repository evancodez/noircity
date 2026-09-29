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
// Surfaces (smooth at 0.3 m): the palm a cupped, rounded slab (a signed-power
// sphere, welded normals); fingers tapered capsules (lathes) with knuckle
// spheres a little proud of them; a web between thumb and index skinned to
// both; the wrist an ellipsoid. One SkinnedMesh per skin, rigid weights
// (the web blended): one draw per hand.
//
// Ink marks are geometry, not texture: a knuckle tick is a hair-thin arc
// lying on the joint (a torus segment ~1.2 mm thick: two or three pixels at
// arm's length, and the ink draws its contour), a nail one short arc at the
// cuticle. Their vertex colour darkens them on the bare skin and lifts them
// on the glove, so the same marks print dark on skin and pale on leather.

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
// a tapered capsule along -z from 0 to -len (hemispheres at both ends)
function taperCapsule(len, r0, r1, radial = 16, flat = 1) {
  const pts = [];
  const cap = 6;
  for (let k = 0; k <= cap; k++) { const a = -Math.PI / 2 + (k / cap) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
  const mid = 5;
  for (let k = 1; k < mid; k++) { const u = k / mid; pts.push(new THREE.Vector2(r0 + (r1 - r0) * u, len * u)); }
  for (let k = 0; k <= cap; k++) { const a = (k / cap) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-5, Math.cos(a) * r1), len + Math.sin(a) * r1)); }
  const g = new THREE.LatheGeometry(pts, radial);
  g.rotateX(-Math.PI / 2);             // lathe +y -> -z
  g.scale(1, flat, 1);
  return g;
}
function ellipsoid(rx, ry, rz, c, w = 18, h = 12) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(c.x, c.y, c.z);
  return g;
}
// a short arc lying across the back of a finger at z (radius R, from
// angle a0 to a1 around the finger axis; pi/2 = the back of the hand)
function tick(R, tube, z, a0 = Math.PI / 2 - 0.5, a1 = Math.PI / 2 + 0.5, flat = 1) {
  const g = new THREE.TorusGeometry(R, tube, 5, 10, a1 - a0);
  g.rotateZ(a0);
  g.scale(1, flat, 1);
  g.translate(0, 0, z);
  return g;
}
// the palm: a signed-power sphere (a slab with round edges), cupped on the
// palm side, arched on the back, narrower at the wrist than at the knuckles
function palmGeometry() {
  const P = HAND.palm;
  const hx = P.w / 2, hy = P.t / 2, hz = 0.052, cz = -0.046;
  const g = new THREE.SphereGeometry(1, 44, 28);
  const p = g.getAttribute('position');
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = sp(z, 0.55);                     // -1 at the knuckles .. +1 at the wrist
    let X = sp(x, 0.5) * hx * (1 - 0.17 * sstep(-0.2, 1, u));
    let Y = sp(y, 0.8) * hy;
    const Z = cz + u * hz;
    const across = 1 - Math.min(1, (X / hx) ** 2), along = 1 - Math.min(1, u * u);
    if (Y < 0) Y += 0.0045 * across * along;   // the cupped palm
    else Y += 0.0022 * across;                 // the arched back
    // the heel of the hand is thicker on the palm side
    if (Y < 0) Y -= 0.003 * sstep(0.2, 0.9, u) * across;
    p.setXYZ(i, X, Y - 0.002, Z);
  }
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

  // the hand's geometry in rest pose (hand-bone space); marks carry a colour
  // of their own: 0 on the bare skin (ink), 2.2 on the glove (lifted)
  // (dims: HAND.bare for the bare hand's slimmer fingers, null for the glove)
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
    const MARK = -1;   // (a mark: its colour is chosen per skin below)
    const H = this.hand;
    // (the palm's radial edge between the index's knuckle and the heel is
    // the web: it follows the thumb's metacarpal part of the way, so when
    // the thumb opens the skin between them stretches as one smooth fold)
    {
      const bh = B(H), bt = B(this.thumb.b[0]);
      add(palmGeometry(), H, 1, (v) => {
        const w = (dims ? 0.72 : 0) * sstep(-0.02, -0.04, v.x) * sstep(-0.01, -0.036, v.z) * (1 - sstep(-0.084, -0.102, v.z));
        return [bh, bt, w];
      });
    }
    // the wrist
    add(ellipsoid(HAND.wrist.rx, HAND.wrist.ry, 0.034, V(0, -0.0015, 0.012), 22, 14), H);
    const PH = HAND.phal, fl = HAND.flat;
    const kn = dims ? dims.knuckle : 1;
    for (const [name, , , len, g0, g1] of HAND.fingers) {
      const [r0, r1] = dims ? dims.fingers[name] : [g0, g1];
      const [b0, b1, b2] = this.fingers[name].b;
      const L0 = len * PH[0], L1 = len * PH[1], L2 = len * PH[2];
      const ra = r0, rb = r0 + (r1 - r0) * PH[0], rc = r0 + (r1 - r0) * (PH[0] + PH[1]);
      add(taperCapsule(L0, ra, rb, 16, fl), b0);
      add(taperCapsule(L1, rb * 0.98, rc, 16, fl), b1);
      // the fingertip: a little fuller on the pad side
      const tip = taperCapsule(L2, rc * 0.97, r1, 16, fl);
      tip.translate(0, -0.0006, 0);
      add(tip, b2);
      // knuckles, a little proud: the MCP head belongs to the palm (it
      // stays and shows when the fist closes), the PIP / DIP heads to the
      // proximal side of their joint
      const mcp = ellipsoid(ra * 1.12 * kn, ra * 1.02 * kn, ra * 1.12 * kn, V(0, ra * 0.32 * kn, 0.001), 16, 10);
      mcp.applyMatrix4(rest(b0));
      parts.push(tag(mcp, B(H)));
      add(ellipsoid(rb * 1.08 * kn, rb * 1.0 * kn, rb * 1.06 * kn, V(0, rb * 0.12 * kn, -L0), 14, 10), b0);
      add(ellipsoid(rc * 1.05 * kn, rc * 0.98 * kn, rc * 1.05 * kn, V(0, rc * 0.1 * kn, -L1), 14, 10), b1);
      // ticks: two creases over the PIP, one over the DIP, a short one on the
      // MCP knuckle, the nail's cuticle line
      const tb = 0.00062;
      add(tick(rb * 1.09 * kn + 0.0003, tb, -L0 + 0.0022, undefined, undefined, fl), b0, MARK);
      add(tick(rb * 1.09 * kn + 0.0003, tb * 0.9, -L0 - 0.0006, Math.PI / 2 - 0.4, Math.PI / 2 + 0.4, fl), b0, MARK);
      add(tick(rc * 1.06 * kn + 0.0002, tb * 0.85, -L1 + 0.0012, Math.PI / 2 - 0.42, Math.PI / 2 + 0.42, fl), b1, MARK);
      const k = tick(ra * 1.13 * kn + 0.0005, tb, 0.0, Math.PI / 2 - 0.38, Math.PI / 2 + 0.38, 1);
      k.translate(0, ra * 0.32 * kn, 0.001);
      k.applyMatrix4(rest(b0));
      parts.push(tag(k, B(H), MARK));
      // the nail: one short arc at the cuticle
      const rn = rc + (r1 - rc) * 0.45;
      add(tick(rn * 1.02 + 0.0002, tb * 0.9, -L2 * 0.42, Math.PI / 2 - 0.55, Math.PI / 2 + 0.55, fl), b2, -2);
    }
    // the thumb: the metacarpal inside the ball of the thumb, then two
    // visible segments
    const T = { ...HAND.thumb, r: dims ? dims.thumb : HAND.thumb.r }, [t0, t1, t2] = this.thumb.b;
    add(taperCapsule(T.meta, T.r[0], T.r[1], 18, 0.92), t0);
    // the ball of the thumb (thenar): a soft mass on the metacarpal's palm side
    add(ellipsoid(0.0165, 0.012, 0.028, V(0.004, -0.0045, -T.meta * 0.45), 18, 12), t0);
    add(taperCapsule(T.seg[0], T.r[1], T.r[2], 16, 0.9), t1);
    add(taperCapsule(T.seg[1], T.r[2] * 0.98, T.r[3], 16, 0.88), t2);
    add(ellipsoid(T.r[1] * 1.08, T.r[1] * 1.0, T.r[1] * 1.05, V(0, T.r[1] * 0.12, 0), 14, 10), t1);
    add(ellipsoid(T.r[2] * 1.05, T.r[2] * 0.98, T.r[2] * 1.03, V(0, T.r[2] * 0.1, -T.seg[0]), 14, 10), t1);
    add(tick(T.r[2] * 1.08 + 0.0003, 0.0006, -T.seg[0] + 0.002, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45, 0.9), t1, MARK);
    add(tick(T.r[3] * 1.05 + 0.0002, 0.00055, -T.seg[1] * 0.45, Math.PI / 2 - 0.6, Math.PI / 2 + 0.6, 0.88), t2, -2);
    // (round 2: the web between thumb and index was a flap from the thumb's
    // MCP to the index's, skinned to both: as the thumb opened it stretched
    // into a thin rod standing across the gap, and the ink drew its outline
    // - the 'stick between thumb and index'. The web is now the palm's own
    // radial edge, which folds toward the thumb (see the palm's weights):
    // one surface, no seam for the ink to find.)
    // (the glove keeps its flap: the leather is stiff, and the Tommy gun's
    // accepted frames are drawn with it)
    if (!dims) {
      const tm = new THREE.Vector3(0, 0, -T.meta).applyMatrix4(rest(t0));
      const im = new THREE.Vector3().setFromMatrixPosition(rest(this.fingers.i.b[0]));
      const c = tm.clone().lerp(im, 0.45);
      c.y -= 0.004;
      const d = new THREE.Vector3().subVectors(im, tm);
      const g = ellipsoid(d.length() * 0.52, 0.0055, 0.0125, V(0, 0, 0), 20, 10);
      g.rotateY(-Math.atan2(d.z, d.x));
      g.translate(c.x, c.y, c.z);
      const bt = B(t0), bh = B(H);
      const tmc = tm.clone(), dir = d.clone().normalize(), len = d.length();
      parts.push(tag(g, bh, 1, (v) => {
        const u = Math.min(1, Math.max(0, new THREE.Vector3().subVectors(v, tmc).dot(dir) / len));
        return [bh, bt, 1 - sstep(0.15, 0.85, u)];
      }));
    }
    const geo = mergeGeometries(parts, false);
    // marks: -1 knuckle ticks, -2 nails -> two channels (the skin picks)
    const mk = geo.getAttribute('mark');
    const kind = new Float32Array(mk.count);
    for (let i = 0; i < mk.count; i++) kind[i] = mk.getX(i) === -1 ? 1 : mk.getX(i) === -2 ? 2 : 0;
    this.markKind = kind;
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
