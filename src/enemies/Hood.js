import * as THREE from 'three';
import { JOINTS, JOINT_INDEX, BIND, OFFSET, L_UPPER } from './HoodRig.js';
import { HoodAnimator, getClips, DEATHS, HAT_OFF, WALK, RUN } from './HoodAnim.js';
import { allocHoodSlot, releaseHoodSlot, HOOD_ID0, FIG_ANCHOR } from '../render/layers.js';
import { roundedBox } from '../world/geom.js';
import { STREET } from '../world/Street.js';
import { buildTommyGeometry } from '../player/Viewmodel.js';
import { Ragdoll } from '../cast/ragdoll.js';   // [O8] the physics layer (a stage that asks: stage.ragdolls)
import { applyStyle } from '../cast/style.js';   // [O8] a man's own carriage, walk and habits

// The Hood: a procedural man in a fedora and a belted trench coat.
//
// One SkinnedMesh per Hood (one draw per pass), built from smooth parametric
// surfaces in the bind pose: a lofted coat whose skirt is split at the front
// (the flaps follow the thighs, so a stride opens the coat instead of
// stretching a dress), raised collar, lapels, belt, sleeves, trousers, shoes,
// a deformed-sphere head with nose, jaw and ears, a lathed fedora with a
// pinched, creased crown and a snap brim, and a pistol in the right hand.
// Every vertex is skinned (joint blends at the elbows, knees, waist and
// shoulders), so joints bend without seams or intersecting capsules.
// Variants: 3 coat lengths x 2 brims x 2 heights x cigarette.

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const spow = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);

// albedo (linear grey) of each part; the ink pass turns these into black
// masses with lit dry-brush folds near the camera
export const SHADE = {
  coat: 0.014, collar: 0.013, lapel: 0.013, belt: 0.005, hat: 0.007, band: 0.002,
  skin: 0.024, hair: 0.004, trousers: 0.006, slideTop: 0.2, nose: 0.024, shoes: 0.004, glove: 0.01, gun: 0.003, shirt: 0.13, tie: 0.004,
};
// long, medium, short
export const COAT_HEM = [0.4, 0.51, 0.62];
export const BRIM_R = [0.168, 0.19];            // narrow, wide
const HEIGHT = [0.96, 1.04];

// ---------------------------------------------------------------------------
// tessellation: Q scales every part's segment counts. LOD0 (near) keeps the
// silhouettes free of facets at 2 m (a 0.2 m radius at 50+ segments deviates
// < 0.5 mm from the true curve); LOD1 is swapped in beyond ~11 m; LOD2
// beyond ~16 m (a black silhouette ~80 px tall): half LOD1's segments, and
// no nose, belt or lapels (they only ever printed inside the black mass).
// The cigarette is hidden there too.
let Q = 1;
const seg = (n, min = 4) => Math.max(min, Math.round(n * Q));
export const LOD_Q = [0.56, 0.3, 0.16];
export const LOD_FAR = [12, 17];      // switch-out distances (m); back in 1.5 m closer

// ---------------------------------------------------------------------------
// parametric surfaces
// fn(u, v, out) with u around (wraps when wrapU) and v along; returns an
// indexed BufferGeometry with smooth normals pointing away from the part.
export function grid(nu, nv, fn, { wrapU = true, flip = false } = {}) {
  const cols = wrapU ? nu : nu + 1;
  const pos = new Float32Array(cols * (nv + 1) * 3);
  const uvs = new Float32Array(cols * (nv + 1) * 2);
  const p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i < cols; i++) {
      const u = i / nu, v = j / nv;
      fn(u, v, p);
      const k = j * cols + i;
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      uvs[k * 2] = u; uvs[k * 2 + 1] = v;
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = wrapU ? (i + 1) % cols : i + 1;
      const a = j * cols + i, b = j * cols + i1, c = (j + 1) * cols + i, d = (j + 1) * cols + i1;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // rows collapsed to a point (poles): give every vertex the averaged normal
  const nrm = g.getAttribute('normal');
  for (let j = 0; j <= nv; j++) {
    let ext = 0;
    const x0 = pos[j * cols * 3], y0 = pos[j * cols * 3 + 1], z0 = pos[j * cols * 3 + 2];
    for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 3;
      ext = Math.max(ext, Math.abs(pos[k] - x0) + Math.abs(pos[k + 1] - y0) + Math.abs(pos[k + 2] - z0));
    }
    if (ext > 1e-5) continue;
    const n = new THREE.Vector3();
    for (let i = 0; i < cols; i++) n.add(new THREE.Vector3().fromBufferAttribute(nrm, j * cols + i));
    n.normalize();
    for (let i = 0; i < cols; i++) nrm.setXYZ(j * cols + i, n.x, n.y, n.z);
  }
  return g;
}

// Make normals point away from `center` on average (winding-agnostic).
export function orientOut(g, center) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  let s = 0;
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    v.fromBufferAttribute(p, i).sub(center);
    w.fromBufferAttribute(n, i);
    s += v.dot(w);
  }
  if (s < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return g;
}

// Catmull-Rom sampler over a table of rows [key, ...values], key ascending.
export function tableSampler(rows) {
  return (key) => {
    let i = 0;
    while (i < rows.length - 2 && key > rows[i + 1][0]) i++;
    const r1 = rows[i], r2 = rows[i + 1];
    const r0 = rows[Math.max(0, i - 1)], r3 = rows[Math.min(rows.length - 1, i + 2)];
    const t = clamp((key - r1[0]) / (r2[0] - r1[0]), 0, 1);
    const t2 = t * t, t3 = t2 * t;
    const out = [];
    for (let c = 1; c < r1.length; c++) {
      const m1 = r0 === r1 ? 0 : (r2[c] - r0[c]) * (r2[0] - r1[0]) / (r2[0] - r0[0]);
      const m2 = r3 === r2 ? 0 : (r3[c] - r1[c]) * (r2[0] - r1[0]) / (r3[0] - r1[0]);
      out.push((2 * t3 - 3 * t2 + 1) * r1[c] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * r2[c] + (t3 - t2) * m2);
    }
    return out;
  };
}

// Profile sampler for lathe-like parts: rows [s, a, b, ...] with s the
// parameter; returns values at s via Catmull-Rom (s in row units).
export function profileAt(rows, v) {
  const f = v * (rows.length - 1);
  const i = Math.min(rows.length - 2, Math.floor(f));
  const t = f - i;
  const r0 = rows[Math.max(0, i - 1)], r1 = rows[i], r2 = rows[i + 1], r3 = rows[Math.min(rows.length - 1, i + 2)];
  const out = [];
  for (let c = 0; c < r1.length; c++) {
    const m1 = (r2[c] - r0[c]) * 0.5, m2 = (r3[c] - r1[c]) * 0.5;
    const t2 = t * t, t3 = t2 * t;
    out.push((2 * t3 - 3 * t2 + 1) * r1[c] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * r2[c] + (t3 - t2) * m2);
  }
  return out;
}

// ---------------------------------------------------------------------------
// torso (coat above the belt): superellipse rings
// [y, rx, rzFront, rzBack, cz, n]
const TORSO = tableSampler([
  [0.95, 0.196, 0.138, 0.138, 0.000, 2.3],
  [1.03, 0.184, 0.131, 0.131, 0.004, 2.3],
  [1.12, 0.189, 0.140, 0.130, 0.010, 2.35],
  [1.22, 0.202, 0.152, 0.133, 0.014, 2.45],
  [1.31, 0.222, 0.156, 0.138, 0.012, 2.8],
  [1.38, 0.239, 0.147, 0.141, 0.004, 3.3],
  [1.425, 0.249, 0.132, 0.134, -0.006, 3.8],
  [1.455, 0.246, 0.117, 0.122, -0.012, 3.8],
  [1.476, 0.226, 0.102, 0.108, -0.016, 3.3],
  [1.49, 0.178, 0.091, 0.097, -0.018, 2.8],
  [1.499, 0.12, 0.081, 0.087, -0.019, 2.4],
  [1.506, 0.074, 0.068, 0.074, -0.020, 2.2],
]);
const TORSO_Y0 = 0.95, TORSO_Y1 = 1.506;
function torsoPoint(theta, y, out = new THREE.Vector3(), grow = 0) {
  const [rx, rzF, rzB, cz, n] = TORSO(y);
  const s = Math.sin(theta), c = Math.cos(theta);
  const e = 2 / n;
  out.set((rx + grow) * spow(s, e), y, cz + (c > 0 ? rzF + grow : rzB + grow) * spow(c, e));
  return out;
}
function torsoNormal(theta, y, out = new THREE.Vector3()) {
  const a = torsoPoint(theta - 0.01, y), b = torsoPoint(theta + 0.01, y);
  const c = torsoPoint(theta, y - 0.005), d = torsoPoint(theta, y + 0.005);
  const du = b.sub(a), dv = d.sub(c);
  out.crossVectors(du, dv).normalize();
  // outward = away from the axis
  const p = torsoPoint(theta, y);
  if (out.x * p.x + out.z * (p.z - TORSO(y)[3]) < 0) out.negate();
  return out;
}

// ---------------------------------------------------------------------------
// skin weights: each returns [[bone, w], ...]
const B = JOINT_INDEX;
function torsoWeights(x, y) {
  const b1 = sstep(1.02, 1.14, y), b2 = sstep(1.2, 1.33, y);
  const w = [[B.hips, 1 - b1], [B.spine, b1 * (1 - b2)], [B.chest, b1 * b2]];
  const ax = Math.abs(x);
  const wa = 0.18 * sstep(0.15, 0.23, ax) * sstep(1.32, 1.42, y);
  if (wa > 0) { for (const e of w) e[1] *= 1 - wa; w.push([x > 0 ? B.upperArmL : B.upperArmR, wa]); }
  return w;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// part builders: each returns { geo, shade(x,y,z,u,v) | number, weights(x,y,z,u,v) }
function buildTorso() {
  const nu = seg(96, 24), nv = seg(44, 14);
  const geo = grid(nu, nv, (u, v, p) => {
    // denser rings toward the shoulders
    const y = TORSO_Y0 + (TORSO_Y1 - TORSO_Y0) * (1 - Math.pow(1 - v, 1.35));
    torsoPoint(u * TAU, y, p);
  });
  orientOut(geo, new THREE.Vector3(0, 1.2, 0));
  // the shirt and tie show in the V between the lapels
  const shade = (x, y, z, u) => {
    let th = u * TAU; if (th > Math.PI) th -= TAU;
    const vw = 0.06 + 0.34 * sstep(1.2, 1.5, y);
    if (y > 1.2 && Math.abs(th) < vw) {
      const tieW = lerp(0.1, 0.13, sstep(1.44, 1.49, y));
      return Math.abs(th) < tieW ? SHADE.tie : SHADE.shirt;
    }
    return SHADE.coat;
  };
  return { geo, shade, weights: (x, y) => torsoWeights(x, y) };
}

// skirt: open at the front, the left panel lapping over the right; each
// panel follows its own thigh, the back follows both.
function buildSkirt(hemY) {
  const y0 = 1.06;
  const S = tableSampler([
    [0, 0.188, 0.134, 0.134, 0.004],
    [0.15, 0.199, 0.142, 0.14, 0.0],
    [0.4, 0.22, 0.158, 0.155, -0.005],
    [0.7, 0.24, 0.175, 0.172, -0.01],
    [1.0, 0.26, 0.192, 0.19, -0.015],
  ]);
  const ov = 0.62;                     // panel overlap (rad at the front)
  const th0 = -ov * 0.5;
  const nu = seg(120, 36), nv = seg(36, 10);
  const geo = grid(nu, nv, (u, v, p) => {
    const th = th0 + u * (TAU + ov);
    let [rx, rzF, rzB, cz] = S(v);
    // folds deepen toward the hem; the hem line itself wanders a little
    const fold = (0.022 * Math.sin(6 * th + 1.3) + 0.013 * Math.sin(11 * th + 0.4)) * sstep(0.15, 1, v);
    // outer (left) panel sits proud of the inner (right) one where they lap
    const lap = 0.012 * (1 - sstep(0, 0.09, u)) - 0.007 * sstep(0.91, 1, u);
    rx = rx * (1 + fold) + lap; rzF = rzF * (1 + fold) + lap; rzB = rzB * (1 + fold) + lap;
    const s = Math.sin(th), c = Math.cos(th);
    const y = lerp(y0, hemY + 0.012 * Math.sin(3 * th + 0.7) * v, Math.pow(v, 0.92));
    p.set(rx * spow(s, 2 / 2.3), y, cz + (c > 0 ? rzF : rzB) * spow(c, 2 / 2.3));
  }, { wrapU: false });
  orientOut(geo, new THREE.Vector3(0, 0.8, 0));
  const weights = (x, y, z, u) => {
    const h = clamp((y0 - y) / (y0 - hemY), 0, 1);
    const tw = 0.86 * Math.pow(h, 1.1), cw = 0.14 * Math.pow(h, 1.5);
    const wl = 1 - sstep(0.3, 0.7, u);
    return [[B.hips, 1 - tw - cw], [B.skirtL, tw * wl], [B.skirtR, tw * (1 - wl)], [B.coat, cw]];
  };
  return { geo, shade: SHADE.coat, weights };
}

function buildBelt() {
  const nu = seg(96, 24), nv = seg(12, 6);
  const yc = 1.04, hh = 0.028, t = 0.011;
  const geo = grid(nu, nv, (u, v, p) => {
    const a = v * TAU;
    // rounded-rect cross-section (thickness t, height 2hh)
    const cy = Math.sin(a), cx = Math.cos(a);
    const off = t * 0.5 + t * 0.5 * spow(cx, 0.5);
    const y = yc + hh * spow(cy, 0.35);
    torsoPoint(u * TAU, y, p, off + 0.002);
  });
  orientOut(geo, new THREE.Vector3(0, yc, 0));
  return { geo, shade: SHADE.belt, weights: (x, y) => torsoWeights(x, y) };
}

// raised collar: a flared band around the neck, open at the front, higher
// at the back
function buildCollar() {
  const th0 = 0.5;
  const nu = seg(64, 16), nv = seg(10, 3);
  const geo = grid(nu, nv, (u, v, p) => {
    const th = th0 + u * (TAU - 2 * th0);
    const back = (1 - Math.cos(th)) * 0.5;               // 0 front .. 1 back
    const yb = 1.482 + 0.01 * back;
    const yt = 1.535 + 0.06 * Math.pow(back, 0.8);
    const y = lerp(yb, yt, v);
    // stands up close around the neck, the top edge turned out a little
    const rx = lerp(0.086, 0.094, v) + 0.008 * v * v * v;
    const rz = lerp(0.082, 0.09, v) + 0.007 * v * v * v;
    const cz = lerp(-0.018, -0.026, v);
    p.set(rx * Math.sin(th), y, cz + rz * Math.cos(th));
  }, { wrapU: false });
  orientOut(geo, new THREE.Vector3(0, 1.5, -0.02));
  return { geo, shade: SHADE.collar, weights: () => [[B.chest, 1]] };
}

// peaked lapels lying on the chest, raised at the fold
function buildLapel(sgn) {
  const inner = [[0.34, 1.492], [0.2, 1.4], [0.075, 1.2]];
  const outer = [[0.98, 1.455], [0.55, 1.36], [0.1, 1.2]];
  const nu = seg(14, 5), nv = seg(22, 6);
  const n = new THREE.Vector3();
  const geo = grid(nu, nv, (u, v, p) => {
    const a = profileAt(inner, v), b = profileAt(outer, v);
    const th = sgn * lerp(a[0], b[0], u);
    const y = lerp(a[1], b[1], u);
    torsoPoint(th, y, p);
    torsoNormal(th, y, n);
    // a pillow: thin at the edges, proud along the fold
    const off = 0.003 + 0.006 * Math.pow(Math.sin(Math.PI * u), 0.6) * (0.4 + 0.6 * (1 - v));
    p.addScaledVector(n, off);
  }, { wrapU: false });
  orientOut(geo, new THREE.Vector3(0, 1.3, -0.1));
  return { geo, shade: SHADE.lapel, weights: (x, y) => torsoWeights(x, y) };
}

// sleeve: hangs from the shoulder joint, domed top under the coat's shoulder
function buildSleeve(sgn) {
  const J = BIND[sgn > 0 ? 'upperArmL' : 'upperArmR'];
  // [d below the joint, r]
  const prof = [
    [-0.045, 0.0], [-0.043, 0.03], [-0.036, 0.055], [-0.022, 0.073], [0.0, 0.083], [0.06, 0.083],
    [0.15, 0.079], [0.24, 0.075], [0.3, 0.073], [0.36, 0.071], [0.45, 0.068], [0.52, 0.067],
    [0.545, 0.071], [0.556, 0.069], [0.56, 0.062], [0.55, 0.052],
  ];
  const nu = seg(40, 12), nv = seg(prof.length * 3, prof.length + 4);
  const geo = grid(nu, nv, (u, v, p) => {
    const [d, r] = profileAt(prof, v);
    const th = u * TAU;
    p.set(J.x + r * 0.93 * Math.sin(th), J.y - d, J.z + r * Math.cos(th));
  });
  orientOut(geo, new THREE.Vector3(J.x, J.y - 0.28, J.z));
  const weights = (x, y) => {
    const d = J.y - y;
    const we = sstep(0.25, 0.35, d);
    return [[sgn > 0 ? B.upperArmL : B.upperArmR, 1 - we], [sgn > 0 ? B.forearmL : B.forearmR, we]];
  };
  return { geo, shade: SHADE.coat, weights };
}

function buildTrouser(sgn) {
  const x0 = sgn * 0.095;
  // [y, r]
  const prof = [
    [1.05, 0.0], [1.045, 0.05], [1.03, 0.085], [1.0, 0.097], [0.93, 0.098], [0.8, 0.09], [0.66, 0.078],
    [0.55, 0.07], [0.49, 0.068], [0.4, 0.066], [0.28, 0.062], [0.17, 0.06], [0.11, 0.063], [0.088, 0.066],
    [0.077, 0.064], [0.082, 0.056], [0.11, 0.048],
  ];
  const nu = seg(36, 12), nv = seg(prof.length * 3, prof.length + 4);
  const geo = grid(nu, nv, (u, v, p) => {
    const [y, r] = profileAt(prof, v);
    const th = u * TAU;
    p.set(x0 + r * 0.95 * Math.sin(th), y, r * 1.03 * Math.cos(th));
  });
  orientOut(geo, new THREE.Vector3(x0, 0.6, 0));
  const th = sgn > 0 ? B.thighL : B.thighR, sh = sgn > 0 ? B.shinL : B.shinR;
  const weights = (x, y) => {
    const wh = sstep(0.93, 1.04, y) * 0.85;
    const ws = sstep(0.55, 0.44, y);
    return [[B.hips, wh], [th, (1 - wh) * (1 - ws)], [sh, (1 - wh) * ws]];
  };
  return { geo, shade: SHADE.trousers, weights };
}

// shoe: an elongated ellipsoid with a flat sole, a heel, a lower toe box
function buildShoe(sgn) {
  const x0 = sgn * 0.095, cz = 0.058, HL = 0.142;
  const nu = seg(40, 12), nv = seg(28, 10);
  const geo = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const lz = -Math.cos(b), q = Math.sin(b);
    const cx = q * Math.cos(a), cy = q * Math.sin(a);
    const hw = 0.047 * (1 - 0.14 * Math.max(0, lz) ** 2) * (1 + 0.04 * Math.max(0, -lz));
    const ht = 0.044 + 0.022 * Math.exp(-(((lz + 0.12) / 0.42) ** 2)) - 0.012 * sstep(0.35, 1, lz);
    const y = cy > 0 ? 0.04 + cy * ht : 0.04 - 0.04 * Math.pow(-cy, 0.28);
    p.set(x0 + cx * hw, y, cz + lz * HL);
  });
  orientOut(geo, new THREE.Vector3(x0, 0.04, cz));
  return { geo, shade: SHADE.shoes, weights: () => [[sgn > 0 ? B.footL : B.footR, 1]] };
}

export function buildHead() {
  const C = new THREE.Vector3(0, 1.655, 0.01);
  const R = [0.077, 0.1, 0.094];
  const nu = seg(64, 16), nv = seg(44, 12);
  const geo = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    let r = 1;
    // nose, brow, ears, back of the skull
    r += 0.24 * Math.exp(-((dx / 0.13) ** 2) - (((dy + 0.1) / 0.2) ** 2)) * Math.max(0, dz) ** 6;
    r += 0.07 * Math.exp(-((dx / 0.45) ** 2) - (((dy - 0.28) / 0.1) ** 2)) * Math.max(0, dz) ** 2;
    r += 0.2 * Math.exp(-(((Math.abs(dx) - 0.97) / 0.07) ** 2) - (((dy - 0.02) / 0.22) ** 2) - (((dz + 0.08) / 0.2) ** 2));
    // back of the skull: fuller above, tucking in toward the nape
    r += 0.1 * Math.exp(-(((dy - 0.2) / 0.35) ** 2) - (((dz + 0.9) / 0.35) ** 2));
    r -= 0.06 * Math.exp(-(((dy + 0.55) / 0.25) ** 2) - (((dz + 0.8) / 0.4) ** 2));
    // flatter temples and cheeks (a head, not a ball)
    r -= 0.05 * Math.exp(-(((Math.abs(dx) - 0.9) / 0.25) ** 2) - (((dy - 0.35) / 0.3) ** 2));
    let x = dx * R[0] * r, y = dy * R[1] * r, z = dz * R[2] * r;
    // jaw narrows, chin comes forward
    const jaw = sstep(-0.05, -0.85, dy);
    x *= 1 - 0.2 * jaw;
    z += 0.016 * sstep(-0.35, -0.85, dy) * Math.max(0, dz) - 0.012 * jaw * Math.max(0, -dz);
    p.set(C.x + x, C.y + y, C.z + z);
  });
  orientOut(geo, C);
  // slicked dark hair over the crown and the back of the skull (a hatless
  // head must not read as a grey ball)
  const shade = (x, y, z) => {
    const dy = (y - C.y) / R[1], dz = (z - C.z) / R[2];
    const hair = sstep(0.25, 0.45, dy + 0.55 * Math.max(0, -dz) - 0.35 * Math.max(0, dz));
    return lerp(SHADE.skin, SHADE.hair, hair);
  };
  return { geo, shade, weights: () => [[B.head, 1]] };
}

// A small nose (Phase 2b polish): the head sphere's bump was narrower than
// its tessellation and vanished in profile; a separate little wedge on the
// face carries the facing direction in a silhouette.
export function buildNose() {
  const C = new THREE.Vector3(0, 1.648, 0.101);
  const nu = seg(24, 10), nv = seg(14, 6);
  const geo = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    // a wedge: narrow bridge on top, a rounded tip forward and down
    const w = 0.0105 * (0.75 + 0.35 * sstep(1, -1, dy));
    const d = 0.017 * (0.6 + 0.5 * sstep(1, -0.4, dy));
    p.set(C.x + dx * w, C.y + dy * 0.021, C.z + dz * d + 0.004 * (1 - dy) * Math.max(0, dz));
  });
  orientOut(geo, C);
  return { geo, shade: SHADE.nose, weights: () => [[B.head, 1]] };
}

function buildNeck() {
  const nu = seg(32, 10), nv = seg(10, 3);
  const geo = grid(nu, nv, (u, v, p) => {
    const y = lerp(1.44, 1.63, v), th = u * TAU;
    const r = 0.054 + 0.006 * (1 - v);
    p.set(r * Math.sin(th), y, -0.012 + r * 1.06 * Math.cos(th));
  });
  orientOut(geo, new THREE.Vector3(0, 1.53, -0.012));
  const weights = (x, y) => {
    const a = sstep(1.47, 1.53, y), b = sstep(1.58, 1.625, y);
    return [[B.chest, 1 - a], [B.neck, a * (1 - b)], [B.head, a * b]];
  };
  return { geo, shade: SHADE.skin, weights };
}

// fedora, in hat-bone space (origin on the brim plane): pinched, creased
// crown, band, snap brim (front down, back up), brim >= 6 mm thick.
export function buildHat(brimR, crownShade = SHADE.hat) {
  const H = BIND.hat;
  const prof = [
    [0.0, 0.03], [0.06, 0.012], [0.098, 0.0], [brimR - 0.03, -0.001], [brimR - 0.006, 0.001],
    [brimR, 0.0045], [brimR - 0.004, 0.0085], [brimR - 0.03, 0.0082], [0.104, 0.0095], [0.1015, 0.014], [0.1015, 0.035],
    // crown: tapers in toward a rounded top (not a cylinder with a lid)
    [0.0975, 0.038], [0.0925, 0.066], [0.0855, 0.091], [0.0755, 0.107], [0.058, 0.117], [0.032, 0.1205], [0.0, 0.121],
  ];
  const nu = seg(88, 24), nv = seg(prof.length * 4, prof.length + 6);
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.06);
  const geo = grid(nu, nv, (u, v, p) => {
    const [r, h0] = profileAt(prof, v);
    const th = u * TAU;
    const s = Math.sin(th), c = Math.cos(th);
    let h = h0;
    const crown = r < 0.106;
    // oval crown, slightly oval brim
    const ox = crown ? 0.85 : lerp(0.85, 0.9, sstep(0.106, brimR, r));
    let x = r * s * ox, z = r * c;
    if (!crown) {
      const w = Math.pow(sstep(0.1, brimR, r), 1.4);
      h += w * (-0.024 * Math.max(0, c) ** 1.5 + 0.017 * Math.max(0, -c) ** 1.5 + 0.007 * s * s);
    } else if (h0 > 0.02) {
      // front pinch: the sides of the crown pulled in toward the front
      const hk = sstep(0.045, 0.11, h0);
      x *= 1 - 0.16 * hk * Math.max(0, c) ** 1.5;
      // the back wall leans in a little toward the top (the crown tapers
      // toward the back as well as the top)
      z += 0.006 * hk * Math.max(0, -c) ** 1.5;
      // teardrop crease along the WHOLE front-back centre line: 23 mm deep at
      // the front, still 18 mm where it runs out over the back, so from
      // behind the top of the crown is an M (two rounded lobes and the dip),
      // not the straight edge of a pork-pie
      const top = sstep(0.07, 0.113, h0);
      h -= top * Math.exp(-((x / 0.03) ** 2)) * (0.0205 + 0.0025 * c);
      // the crown is a touch lower at the front
      h -= 0.008 * Math.max(0, c) * sstep(0.04, 0.12, h0);
    }
    p.set(x, h, z).applyQuaternion(tilt).add(H);
  });
  orientOut(geo, H.clone().add(new THREE.Vector3(0, 0.04, 0)));
  const shade = (x, y) => {
    const h = y - H.y;
    const r = Math.hypot(x, 0);
    return h > 0.012 && h < 0.036 && r < 0.2 ? SHADE.band : crownShade;
  };
  return { geo, shade, weights: () => [[B.hat, 1]] };
}

// [O4] the city's other covers (docs/briefs/O4_COMBAT.md §2: gang men of two
// looks, cops in uniform): a policeman's peaked cap (a stiff band, the crown
// flaring to a flat top, a black visor down over the eyes) and the second
// gang's flat cap (a soft dome pulled forward, a short peak). Hat-bone space,
// origin on the brim plane, as the fedora.
export function buildPoliceCap() {
  const H = BIND.hat;
  const prof = [[0.0, 0.004], [0.094, 0.0], [0.099, 0.002], [0.1, 0.044], [0.104, 0.05], [0.128, 0.074], [0.132, 0.08], [0.128, 0.086], [0.06, 0.09], [0.0, 0.09]];
  const nu = seg(80, 22), nv = seg(prof.length * 4, prof.length + 6);
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.05);
  const crown = grid(nu, nv, (u, v, p) => {
    const [r, h] = profileAt(prof, v);
    const th = u * TAU;
    // (the top a little longer front to back, pushed forward: the cap's peak line)
    const fz = h > 0.06 ? 1.08 : 1.0;
    p.set(r * Math.sin(th) * 0.93, h, r * Math.cos(th) * fz + (h > 0.06 ? 0.008 : 0)).applyQuaternion(tilt).add(H);
  });
  orientOut(crown, H.clone().add(new THREE.Vector3(0, 0.04, 0)));
  // the visor: a stiff half-moon off the band's front, down over the eyes
  const visor = grid(seg(28, 8), seg(6, 3), (u, v, p) => {
    const a = (u - 0.5) * 2.4, r = lerp(0.095, 0.158, v);
    const x = Math.sin(a) * r * 0.95, z = Math.cos(a) * r;
    const y = 0.004 - 0.34 * Math.max(0, z - 0.09) - 0.004 * v;
    p.set(x, y, z).applyQuaternion(tilt).add(H);
  }, { wrapU: false });
  orientOut(visor, H.clone().add(new THREE.Vector3(0, 0.2, 0)));
  const geo = mergeGeo([crown, visor]);
  const shade = (x, y) => { const h = y - H.y; return h < 0.046 && h > 0.006 ? SHADE.band : SHADE.hat * 1.4; };
  return { geo, shade, weights: () => [[B.hat, 1]] };
}
export function buildFlatCap() {
  const H = BIND.hat;
  const nu = seg(72, 20), nv = seg(18, 8);
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.12);
  const dome = grid(nu, nv, (u, v, p) => {
    const th = u * TAU, ph = v * Math.PI / 2;
    const c = Math.cos(th);
    // (a soft dome, fuller over the front and pulled down to the peak)
    const r = 0.112 + 0.016 * Math.max(0, c);
    p.set(Math.sin(th) * Math.cos(ph) * r * 0.95, 0.002 + Math.sin(ph) * (0.06 - 0.02 * Math.max(0, c)), c * Math.cos(ph) * r + 0.012).applyQuaternion(tilt).add(H);
  });
  orientOut(dome, H.clone().add(new THREE.Vector3(0, 0.02, 0.01)));
  const peak = grid(seg(24, 8), seg(5, 3), (u, v, p) => {
    const a = (u - 0.5) * 2.0, r = lerp(0.1, 0.15, v);
    p.set(Math.sin(a) * r * 0.95, 0.004 - 0.18 * Math.max(0, Math.cos(a) * r - 0.1), Math.cos(a) * r + 0.012).applyQuaternion(tilt).add(H);
  }, { wrapU: false });
  orientOut(peak, H.clone().add(new THREE.Vector3(0, 0.2, 0)));
  return { geo: mergeGeo([dome, peak]), shade: SHADE.hat * 1.6, weights: () => [[B.hat, 1]] };
}
// the badge on a policeman's breast: a small light shield (it reads at 15 m)
function buildBadge() {
  const c = torsoPoint(0.42, 1.37, new THREE.Vector3(), 0.006);
  const n = torsoNormal(0.42, 1.37, new THREE.Vector3());
  const t = new THREE.Vector3(0, 1, 0).cross(n).normalize(), b = n.clone().cross(t).normalize();
  const geo = grid(seg(16, 8), seg(4, 2), (u, v, p) => {
    const a = u * TAU, r = 0.024 * v * (1 - 0.25 * Math.max(0, -Math.sin(a)));
    p.copy(c).addScaledVector(t, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r * 1.2).addScaledVector(n, 0.002 * (1 - v));
  });
  return { geo, shade: 0.5, weights: () => [[B.chest, 1]] };
}
function mergeGeo(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.getAttribute('position').count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const P = g.getAttribute('position'), N = g.getAttribute('normal'), U = g.getAttribute('uv');
    pos.set(P.array, vo * 3); nrm.set(N.array, vo * 3); if (U) uv.set(U.array, vo * 2);
    const I = g.index.array; for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo;
    vo += P.count; io += I.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function buildHand(sgn, fist) {
  const W = BIND[sgn > 0 ? 'handL' : 'handR'];
  const C = fist ? new THREE.Vector3(W.x, W.y - 0.058, W.z + 0.004) : new THREE.Vector3(W.x - sgn * 0.004, W.y - 0.075, W.z + 0.006);
  const R = fist ? [0.029, 0.045, 0.037] : [0.025, 0.082, 0.045];   // (fist ~15 % thinner: Phase 2b)
  const nu = seg(32, 10), nv = seg(22, 8);
  const geo = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    let r = 1;
    // thumb along the front, near the top
    r += 0.35 * Math.exp(-(((dz - 0.8) / 0.3) ** 2) - (((dy - 0.35) / 0.35) ** 2) - (((dx + sgn * 0.2) / 0.5) ** 2));
    let x = dx * R[0] * r, y = dy * R[1] * r, z = dz * R[2] * r;
    if (!fist) {
      // fingers curl toward the palm (the body side), tips taper
      const tip = sstep(-0.2, -1, dy);
      x -= sgn * 0.018 * tip;
      z *= 1 - 0.25 * tip;
    }
    p.set(C.x + x, C.y + y, C.z + z);
  });
  orientOut(geo, C);
  return { geo, shade: SHADE.glove, weights: () => [[sgn > 0 ? B.handL : B.handR, 1]] };
}

// a 1911-style automatic in the right fist. Bind space: the barrel runs down
// the hanging arm (-Y), the slide on the thumb side (+Z), grip toward -Z, so
// raising the arm to aim points the muzzle forward with the slide on top.
let GUN_GEO = null;
function buildGun() {
  if (!GUN_GEO) {
    const parts = [];
    // (sized a little over life: at game distances the gun must read as an
    // L past the fist, not vanish into it). Phase 2b polish: the slide runs
    // 0.29 m so ~0.12 m of it projects past the (thinner) fist in profile,
    // and a grip stub with a base plate shows under the heel of the hand.
    const slide = roundedBox(0.028, 0.29, 0.038, 0.008, 3);
    slide.translate(0, -0.15, 0.058);
    parts.push(slide);
    const frame = roundedBox(0.024, 0.13, 0.024, 0.007, 3);
    frame.translate(0, -0.175, 0.034);
    parts.push(frame);
    const grip = roundedBox(0.032, 0.056, 0.15, 0.009, 3);
    grip.rotateX(-0.3).translate(0, -0.03, -0.028);
    parts.push(grip);
    const base = roundedBox(0.036, 0.064, 0.016, 0.006, 2);
    base.rotateX(-0.3).translate(0, -0.008, -0.1);
    parts.push(base);
    const guard = new THREE.TorusGeometry(0.024, 0.005, 8, 20, Math.PI);
    guard.rotateY(Math.PI / 2).rotateX(Math.PI / 2).translate(0, -0.1, 0.022);
    parts.push(guard);
    const hammer = roundedBox(0.014, 0.022, 0.024, 0.005, 2);
    hammer.translate(0, -0.001, 0.068);
    parts.push(hammer);
    const clean = parts.map((g) => {
      let q = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
      return q;
    });
    const merged = new THREE.BufferGeometry();
    let n = 0;
    for (const g of clean) n += g.getAttribute('position').count;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    let o = 0;
    for (const g of clean) {
      pos.set(g.getAttribute('position').array, o * 3);
      nrm.set(g.getAttribute('normal').array, o * 3);
      o += g.getAttribute('position').count;
    }
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    merged.setIndex([...Array(n).keys()]);
    GUN_GEO = merged;
  }
  const W = BIND.handR;
  const geo = GUN_GEO.clone().translate(W.x, W.y, W.z);
  // the top of the slide is bright steel: a thin light line that separates
  // the gun from the black fist in profile (the rest of the gun stays ink)
  const shade = (x, y, z) => (z - W.z > 0.07 && W.y - y > 0.03 ? SHADE.slideTop : SHADE.gun);
  return { geo, shade, weights: () => [[B.handR, 1]] };
}
// muzzle position in handR bone space
export const MUZZLE_LOCAL = new THREE.Vector3(0, -0.3, 0.058);

// ---------------------------------------------------------------------------
// assemble parts into one skinned geometry
export function assemble(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.geo.getAttribute('position').count; ni += p.geo.index.count; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const part of parts) {
    const g = part.geo;
    const P = g.getAttribute('position'), N = g.getAttribute('normal'), UV = g.getAttribute('uv');
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const u = UV ? UV.getX(i) : 0, v = UV ? UV.getY(i) : 0;
      const k = vo + i;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      nrm[k * 3] = N.getX(i); nrm[k * 3 + 1] = N.getY(i); nrm[k * 3 + 2] = N.getZ(i);
      const s = typeof part.shade === 'function' ? part.shade(x, y, z, u, v) : part.shade;
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = s;
      const w = part.weights(x, y, z, u, v).filter((e) => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = w.reduce((a, e) => a + e[1], 0) || 1;
      for (let j = 0; j < 4; j++) {
        si[k * 4 + j] = w[j] ? w[j][0] : 0;
        sw[k * 4 + j] = w[j] ? w[j][1] / sum : 0;
      }
    }
    const I = g.index.array;
    for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo;
    vo += P.count; io += I.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.4);
  return geo;
}

const GEO_CACHE = new Map();
function hoodGeometry(v, lod = 0) {
  // (an unarmed figure - the cast's civilians, src/cast/ - drops the pistol;
  // an armed Hood's key is what it always was)
  const key = `${v.coat}_${v.brim}_${lod}_${v.heavy ? 1 : 0}${v.unarmed ? '_u' : ''}${v.cap ? '_' + v.cap : ''}`;   // ([O4] the city's caps)
  if (!GEO_CACHE.has(key)) {
    Q = LOD_Q[lod];
    const near = lod < 2;
    // [O4] a policeman: the peaked cap, the tunic to the hip, the badge; the
    // second gang: the flat cap and a short coat
    const cop = v.cap === 'police', flat = v.cap === 'flat';
    const hat = cop ? buildPoliceCap() : flat ? buildFlatCap() : buildHat(BRIM_R[v.brim], SHADE.hat);
    const hem = cop ? 0.8 : flat ? COAT_HEM[2] + 0.1 : COAT_HEM[v.coat];
    const parts = [
      buildTorso(), buildSkirt(hem), ...(near || cop ? [buildBelt()] : []), buildCollar(), ...(near && !cop ? [buildLapel(1), buildLapel(-1)] : []),
      buildSleeve(1), buildSleeve(-1), buildTrouser(1), buildTrouser(-1), buildShoe(1), buildShoe(-1),
      buildHead(), ...(near ? [buildNose()] : []), buildNeck(), hat,
      buildHand(1, false), buildHand(-1, true),
      ...(cop && lod < 2 ? [buildBadge()] : []),
    ];
    if (!v.heavy && !v.unarmed) parts.push(buildGun());
    GEO_CACHE.set(key, assemble(parts));
    Q = 1;
  }
  return GEO_CACHE.get(key);
}

let MAT = null;
export function hoodMaterial(world) {
  if (!MAT) {
    MAT = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide,
      envMap: world.M.envSoft, envMapIntensity: 0.35,
    });
    MAT.name = 'HoodCloth';
  }
  return MAT;
}
let CIG_MATS = null;
let TOMMY = null;

// low-poly invisible hit volumes (raycast targets), one per limb, tagged
// with the joint name: [joint, kind, radius, length, offset along -Y]
const HIT_PARTS = [
  ['head', 'sphere', 0.11, 0, [0, 0.08, 0.01]],
  ['hat', 'sphere', 0.13, 0, [0, 0.05, 0]],
  ['neck', 'capsule', 0.07, 0.06, [0, 0.04, 0]],
  ['chest', 'capsule', 0.2, 0.12, [0, 0.1, 0]],
  ['spine', 'capsule', 0.19, 0.08, [0, 0.05, 0]],
  ['hips', 'capsule', 0.2, 0.06, [0, -0.02, 0]],
  ['upperArmL', 'capsule', 0.08, 0.2, [0, -0.15, 0]],
  ['upperArmR', 'capsule', 0.08, 0.2, [0, -0.15, 0]],
  ['forearmL', 'capsule', 0.07, 0.18, [0, -0.14, 0]],
  ['forearmR', 'capsule', 0.07, 0.18, [0, -0.14, 0]],
  ['thighL', 'capsule', 0.1, 0.3, [0, -0.22, 0]],
  ['thighR', 'capsule', 0.1, 0.3, [0, -0.22, 0]],
  ['shinL', 'capsule', 0.075, 0.3, [0, -0.2, 0]],
  ['shinR', 'capsule', 0.075, 0.3, [0, -0.2, 0]],
];
const HIT_GEO = {};
function hitGeo(kind, r, len) {
  const k = `${kind}_${r}_${len}`;
  if (!HIT_GEO[k]) HIT_GEO[k] = kind === 'sphere' ? new THREE.SphereGeometry(r, 8, 6) : new THREE.CapsuleGeometry(r, len, 3, 8);
  return HIT_GEO[k];
}

// street surface under a point: the pavements are raised (as Controller)
function groundY(x) {
  const l = 1 - sstep(STREET.kerbX - 0.12, STREET.kerbX + 0.12, x);
  const r = sstep(STREET.rightKerbX - 0.12, STREET.rightKerbX + 0.12, x);
  return STREET.pavementTop * Math.max(l, r);
}

// The coat skirt's halves (skirtL/R) copy the thighs while he is on his
// feet. Once the body lies on the street (the hips' up axis tipped past
// ~60 deg) each half swings down into the ground plane along the thigh's
// heading and is flattened across its depth, so the coat lies draped on the
// legs and the street instead of standing off the hips as a rigid tube.
const _sk = {
  q: new THREE.Quaternion(), qi: new THREE.Quaternion(), qf: new THREE.Quaternion(), qt: new THREE.Quaternion(),
  up: new THREE.Vector3(), d: new THREE.Vector3(), u: new THREE.Vector3(), DOWN: new THREE.Vector3(0, -1, 0), Y: new THREE.Vector3(0, 1, 0),
};
export function driveSkirt(b, groundW = 1) {
  const S = _sk;
  // world up in the hips' frame
  b.hips.getWorldQuaternion(S.q);
  S.up.set(0, 1, 0).applyQuaternion(S.qi.copy(S.q).invert());
  const w = groundW * sstep(0.5, 0.12, S.up.y);
  for (const s of ['L', 'R']) {
    const sk = b['skirt' + s], th = b['thigh' + s];
    if (w < 1e-3) { sk.quaternion.copy(th.quaternion); sk.scale.set(1, 1, 1); continue; }
    // the thigh's heading projected into the ground plane, drooping a
    // little so the hem settles onto the street
    S.d.copy(S.DOWN).applyQuaternion(th.quaternion);
    S.d.addScaledVector(S.up, -S.d.dot(S.up));
    if (S.d.lengthSq() < 1e-4) S.d.copy(S.DOWN).addScaledVector(S.up, S.up.y);
    S.d.normalize().addScaledVector(S.up, -0.07).normalize();
    S.qf.setFromUnitVectors(S.DOWN, S.d);
    // twist (<= 45 deg) so the local X or Z axis nearest to 'up' is exactly
    // up; that axis is the one flattened
    S.u.copy(S.up).applyQuaternion(S.qi.copy(S.qf).invert());
    const phi = Math.atan2(S.u.x, S.u.z);
    const k = Math.round(phi / (Math.PI / 2));
    S.qf.multiply(S.qt.setFromAxisAngle(S.Y, phi - k * Math.PI / 2));
    sk.quaternion.copy(th.quaternion).slerp(S.qf, w);
    const flat = 1 - 0.5 * w, wide = 1 + 0.14 * w;
    if (k % 2 === 0) sk.scale.set(wide, 1, flat); else sk.scale.set(flat, 1, wide);
  }
}

// [O8] the bones the style layer turns (src/cast/style.js)
const STYLE_BONES = new Set(['spine', 'chest', 'neck', 'head', 'upperArmL', 'upperArmR', 'coat']);
// [O8] scratch for the ragdoll's start and end
const _rg = { v: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };
// scratch for Hood.postPose (per Hood per step)
const _pp = {
  e: new THREE.Euler(), m: new THREE.Matrix4(), tl: new THREE.Vector3(), q: new THREE.Quaternion(), Y: new THREE.Vector3(0, 1, 0),
  sh: new THREE.Vector3(), pq: new THREE.Quaternion(), up: new THREE.Vector3(), d: new THREE.Vector3(), ax: new THREE.Vector3(),
};

// deterministic variant from an integer seed or a partial spec
export function hoodVariant(v = {}) {
  if (typeof v === 'number') {
    const h = (n) => Math.abs(Math.sin(v * 12.9898 + n * 78.233) * 43758.5453) % 1;
    v = { coat: Math.floor(h(1) * 3), brim: Math.floor(h(2) * 2), tall: Math.floor(h(3) * 2), cig: h(4) < 0.4 };
  }
  return { coat: v.coat ?? 1, brim: v.brim ?? 1, tall: v.tall ?? 1, cig: !!v.cig, heavy: !!v.heavy, unarmed: !!v.unarmed, ...(v.cap ? { cap: v.cap } : {}) };   // ([O4] cap: 'police' | 'flat')
}

// the flying hat's tumble per death (axis in the Hood's frame, rad/s, sense)
// (axis: used when the eye is unknown; flip: weight of the back-flip in the
// eye-facing axis; right: seconds to right the hat after it leaves the head)
const HAT_TUMBLE = {
  deathBack: { axis: new THREE.Vector3(1, 0, -0.75), rate: 7, dir: -1, flip: 0.5, right: 0.09 },
  deathSpin: { axis: new THREE.Vector3(0.35, 0, -0.9), rate: 8, dir: 1, flip: 0.3, right: 0.15 },
  deathKnees: { axis: new THREE.Vector3(1, 0, 0.25), rate: 4, dir: 1, flip: 0.6, right: 0.2 },
};

// ---------------------------------------------------------------------------
// [O8] who is told when a figure goes onto the physics layer and off it (src/cast/o8extras.js:
// the shirt front and the cuffs a man shows lying, so a body on the black street reads)
export const RAG_HOOKS = [];
export class Hood {
  // build (the cast's costumes, src/cast/Figure.js; a Hood passes none):
  // { lods: [geo x3], offsets: { joint: Vector3 }, scale, animator(obj),
  //   surface(x, z) -> y, hatR, hatFlies }
  constructor(world, { pos = new THREE.Vector3(), yaw = 0, variant = {}, build = null } = {}) {
    this.world = world;
    this.variant = hoodVariant(variant);
    this.slot = allocHoodSlot();
    this.inkId = HOOD_ID0 + Math.max(0, this.slot);
    this.scale = build && build.scale ? build.scale : HEIGHT[this.variant.tall];
    this.build = build;

    const obj = new THREE.Group();
    obj.name = 'hood' + this.slot;
    this.object = obj;
    // skeleton (identity rotations in the bind pose)
    const bones = {};
    for (const [name, parent] of JOINTS) {
      const b = new THREE.Bone();
      b.name = name;
      b.position.copy(build && build.offsets && build.offsets[name] ? build.offsets[name] : OFFSET[name]);
      bones[name] = b;
      if (parent) bones[parent].add(b);
    }
    this.bones = bones;
    obj.add(bones.root);
    const skeleton = new THREE.Skeleton(JOINTS.map((j) => bones[j[0]]));
    // three re-computes and re-uploads the bone texture once per render()
    // call that draws the man (id pass, reflection, scene: 3x a frame); the
    // pose only changes in update(), so the upload happens once per new pose
    this._poseVer = 1;
    let skelVer = 0;
    const skelUpdate = skeleton.update.bind(skeleton);
    skeleton.update = () => { if (skelVer === this._poseVer) return; skelVer = this._poseVer; skelUpdate(); };
    this.lods = build ? build.lods : [hoodGeometry(this.variant, 0), hoodGeometry(this.variant, 1), hoodGeometry(this.variant, 2)];
    this.lod = 0;
    const mesh = new THREE.SkinnedMesh(this.lods[0], hoodMaterial(world));
    mesh.name = 'hoodBody';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), 2.4);
    obj.add(mesh);
    obj.updateMatrixWorld(true);
    mesh.bind(skeleton);
    this.mesh = mesh;
    this.skeleton = skeleton;

    if (this.variant.cig) this.addCigarette();
    if (this.variant.heavy && !this.variant.unarmed) this.addTommy();

    // ink: one figure id for the whole man; the ink pass anchors his brush
    for (const o of [mesh, ...(this.cig || []), ...(this.tommy ? [this.tommy] : [])]) { o.userData.inkId = this.inkId; o.userData.inkFigure = true; }

    // hit volumes on the bones
    this.hitMeshes = [];
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const [joint, kind, r, len, off] of HIT_PARTS) {
      const m = new THREE.Mesh(hitGeo(kind, r, len), hitMat);
      m.visible = false;
      m.name = 'hit_' + joint;
      m.position.set(...off);
      m.userData.joint = joint;
      m.userData.hood = this;
      bones[joint].add(m);
      this.hitMeshes.push(m);
    }

    this.anim = build && build.animator ? build.animator(obj) : new HoodAnimator(obj);
    this.pos = pos.clone();
    this.yaw = yaw;
    this.speed = 0;
    this.state = 'idle';
    this.alive = true;
    this.lookTarget = null;
    this._lookW = 0;
    this._aimW = 0;
    this._vel = new THREE.Vector3();
    this._prevPos = pos.clone();
    this._prevYaw = yaw;
    this._hem = { x: 0, z: 0, vx: 0, vz: 0 };
    this.hat = null;          // free-flying hat state once it leaves the head
    this._deathT = -1;
    this._rm = 0;
    this.script = null;       // optional (hood, t, dt) => void, for staged shots
    // (a costume's: the floor it stands on, the cover's radius when it
    // lands, whether the cover flies off in a fall)
    this.surface = build && build.surface ? build.surface : null;
    if (build && build.hatR) this.hatR = build.hatR;
    if (build && build.hatFlies === false) this.hatFlies = false;

    obj.position.copy(this.pos);
    obj.rotation.y = yaw;
    obj.scale.setScalar(this.scale);
    world.scene.add(obj);
    // collision + raycast hooks
    this.collider = world.colliders.addCircle(pos.x, pos.z, 0.32 * this.scale, 'hood');
    this.collider.hood = this;
    world.solids.push(...this.hitMeshes);
    this.afterPose = null;    // (hood, dt) => void: after the look-at / coat pass
    this.update(0, 0);
  }

  addCigarette() {
    if (!CIG_MATS) {
      CIG_MATS = {
        paper: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 }),
        ember: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.32, 0.05).multiplyScalar(3) }),
      };
    }
    const H = BIND.head;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.058, 10), CIG_MATS.paper);
    const dir = new THREE.Vector3(0.18, -0.35, 1).normalize();
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mouth = new THREE.Vector3(0.012, 1.603, 0.098).sub(H);
    stick.position.copy(mouth).addScaledVector(dir, 0.026);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 10, 8), CIG_MATS.ember);
    ember.position.copy(mouth).addScaledVector(dir, 0.056);
    stick.castShadow = false;
    this.bones.head.add(stick, ember);
    this.cig = [stick, ember];
  }

  // Heavies carry the player's Thompson (player/Viewmodel.js geometry) in
  // the right fist: barrel down the hand bone's -Y, the drum below, its
  // pistol grip in the fist.
  addTommy() {
    if (!TOMMY) {
      TOMMY = {
        geo: buildTommyGeometry(),
        // (beyond the near LOD: the same gun at a third of the segments -
        // 21k triangles for a 0.6 m gun 12+ m away, times three passes)
        geoLo: buildTommyGeometry(0.35),
        mat: new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.45, metalness: 0.5, envMap: this.world.M.envSoft, envMapIntensity: 0.6 }),
      };
    }
    const m = new THREE.Mesh(TOMMY.geo, TOMMY.mat);
    m.userData.geoHi = TOMMY.geo; m.userData.geoLo = TOMMY.geoLo;
    m.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    m.position.set(0, -0.143, 0.064);
    m.castShadow = true;
    this.bones.handR.add(m);
    this.tommy = m;
  }

  // ---- control (Phase 2b's AI drives these) ---------------------------------
  setState(name, fade = 0.25) {
    if (!this.alive) return;
    this.state = name;
    if (name === 'stepOut') this._rm = 0;
    const ts = name === 'walk' ? this.gaitScale(WALK.speed) : name === 'run' ? this.gaitScale(RUN.speed) : name === 'idle' && this.style && this.style.rate ? this.style.rate : 1;
    // [O8] the idle a man keeps (his style's: the weight on one leg, hands in the pockets ...)
    const nm = name === 'idle' && this.idleName ? this.idleName : name;
    this.anim.play(nm, { fade, timeScale: ts });
  }
  // [O8] a figure's own build, carriage, walk and habits (src/cast/style.js: styleFor);
  // null: as the costume is
  setStyle(S) {
    this.style = S || null;
    const sc = this.scale;
    if (S) this.object.scale.set(sc * S.wx, sc, sc * S.wz); else this.object.scale.setScalar(sc);
    const hat = this.bones.hat;
    if (hat && hat.parent === this.bones.head) { if (S && S.hat) hat.quaternion.setFromEuler(_pp.e.set(S.hat[0], 0, S.hat[1])); else hat.quaternion.identity(); }
    const bank = this.anim && this.anim.bank;
    this.idleName = S && S.idle && S.idle !== 'idle' && bank && bank.has(S.idle) ? S.idle : null;
    if (this.anim && this.anim.seedPhase) this.anim.seedPhase(S && S.phase != null ? S.phase : null);
  }
  // [O8] the bones a layer turns on top of the mixer's pose, marked moved each step: the
  // mixer writes a bone only when its value moved, and a layer laid on an unwritten bone
  // would be laid on last step's layer (the CastAnimator's own fix, for every bone named)
  dirtyBones(names) {
    const M = this.anim && this.anim.mixer, binds = M && M._bindings;
    if (!binds) return;
    const other = M._accuIndex;
    for (const pm of binds) {
      const b = pm.binding, node = b && (b.targetObject || b.node);
      if (!node || !names.has(node.name)) continue;
      const n = pm.valueSize; pm.buffer[other * n + n] = NaN;
    }
  }
  gaitScale(clipSpeed) {
    return this.speed > 0.05 ? this.speed / (clipSpeed * this.scale) : 1;
  }
  setAim(on, fade = 0.2) {
    if (!this.alive) return;
    this.aiming = on;
    this.anim.setOverlay(on && this.state !== 'aim' ? 'aim' : null, fade);
  }
  fire() {
    if (!this.alive) return;
    this.anim.additive('fire');
    return this.muzzleWorld();
  }
  // dir: world-space direction the shot travels (from the shooter)
  flinch(dir = null) {
    if (!this.alive) return;
    let side = 'L';
    if (dir) {
      // the shot's travel direction in the Hood's frame: travelling toward
      // -X means it came from his left (+X): the left side takes the hit
      const lx = Math.cos(this.yaw) * dir.x - Math.sin(this.yaw) * dir.z;
      side = lx <= 0 ? 'L' : 'R';
    }
    this.anim.additive(side === 'L' ? 'flinchL' : 'flinchR');
    // standing still: the hit also knocks him a step away from it
    if ((this.state === 'idle' || this.state === 'aim') && !this.anim.lowerOnce) {
      if (this.anim.playLower(side === 'L' ? 'flinchStepL' : 'flinchStepR')) this._rmStep = [0, 0];
    }
  }
  stagger() {
    if (!this.alive) return;
    this.state = 'stagger';
    this.anim.play('stagger', { fade: 0.08 });
    this._rm = 0;
  }
  die(kind = 'deathBack') {
    if (!this.alive) return;
    // [C2] (or a death of the gun kit's: enemies/gunClips.js, the slumps)
    if (!DEATHS.includes(kind) && !(this.anim.clips[kind] && this.anim.clips[kind].death)) kind = 'deathBack';
    this.alive = false;
    this.state = kind;
    this.speed = 0;
    if (this._legOff) { this.yaw += this._legOff; this._legOff = 0; }   // [C2b] (he falls the way his legs were: no turn as he goes down)
    this.anim.play(kind, { fade: 0.08 });
    this._deathT = 0;
    this._deathKind = kind;
    // [O8] in the city the fall is the light ragdoll's, reaching for this clip; the round's way pushes it
    if (this.world.ragdolls && !this.rag) {
      const d = this._hitDir;
      this.startRagdoll({ clip: kind, push: d ? { v: _rg.v.set(d.x, 0, d.z).normalize().multiplyScalar(this._hitPower ?? 1.3), lo: 0.05, hi: 1 } : null });
    }
  }
  lookAt(v) { this.lookTarget = v ? v.clone() : null; }

  // ---- [O8] the physics layer: a light ragdoll for a fall (src/cast/ragdoll.js) -----------------
  //   startRagdoll({ clip, push: { v, lo, hi, up }, follow })   the fall from where he stands
  //   endRagdoll({ instant })   up again (the get-up clip blends out of how he lies)
  // While it runs the mixer is not stepped: the points pose the bones.
  startRagdoll({ clip = 'koFall', push = null, follow = 1 } = {}) {
    if (!this.world.ragdolls) return null;
    if (this.rag) { if (push && push.v) { this.rag.wake(); for (let i = 0; i < this.rag.o.length; i++) this.rag.o[i].addScaledVector(push.v, -(this.rag._h || 1 / 60) * (push.lo ?? 1)); } return this.rag; }
    this.lookTarget = null; this._lookW = 0; this.aiming = false; this._aimW = 0;
    if (this._legOff) { this.yaw += this._legOff; this._legOff = 0; }
    this.object.rotation.y = this.yaw;
    this.object.updateMatrixWorld(true);
    this._ragBlend = null;
    this.rag = new Ragdoll(this, { clip, push, follow });
    for (const f of RAG_HOOKS) f(this, true);
    return this.rag;
  }
  // the lying clips (a ragdoll goes on while the figure plays one of these)
  ragLying(name = this.anim.base) {
    const c = this.anim.clips[name];
    return name === 'ko' || name === 'koFall' || DEATHS.includes(name) || !!(c && c.death) || /^br_ko/.test(name || '');
  }
  endRagdoll({ instant = false } = {}) {
    const R = this.rag;
    if (!R) { if (instant) this._ragBlend = null; return; }
    this.rag = null;
    for (const f of RAG_HOOKS) f(this, false);
    if (instant) { this._ragBlend = null; return; }
    // where he lies -> where the get-up clip starts: his feet at the root, his head
    // along -z of it, the pelvis 0.8 m back (KO_LIE: castAnim.js); on his front the
    // same line (the blend rolls him onto his back as he comes up)
    const L = R.lie();
    const yaw = L.dir + Math.PI;
    const s = this.scale, c = Math.cos(yaw), sn = Math.sin(yaw);
    const lx = 0.01 * s, lz = -0.8 * s;
    this.pos.x = L.x - (lx * c + lz * sn); this.pos.z = L.z - (-lx * sn + lz * c);
    this.yaw = yaw; this._prevYaw = yaw; this._prevPos.copy(this.pos);
    if (this._rmClip) { this._rmClip.x0 = this.pos.x; this._rmClip.z0 = this.pos.z; this._rmClip.yaw0 = yaw; }
    if (this.world.colliders) this.world.colliders.resolve(this.pos, 0.3, this.collider);
    // the pose as it lay, in his new frame: blended into the clip's over a few tenths
    const obj = this.object;
    const snap = {};
    for (const [name, b] of Object.entries(this.bones)) {
      if (name === 'hat' && b.parent === obj) continue;
      snap[name] = b.quaternion.clone();
    }
    // (the hips: the world pose as it lay, re-expressed under the moved root)
    const hipsQ = this.bones.hips.getWorldQuaternion(new THREE.Quaternion());
    const hp = R.point('pv', new THREE.Vector3());
    obj.position.copy(this.pos); obj.rotation.y = yaw; obj.updateMatrixWorld(true);
    snap.hips = obj.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hipsQ);
    hp.applyMatrix4(_rg.m.copy(obj.matrixWorld).invert());
    this._ragBlend = { t: 0, dur: R.facing() === 'down' ? 0.55 : 0.32, q: snap, hips: hp };
  }
  // per step while it runs: the points, the root under the pelvis, the bones, the coat
  ragStep(dt) {
    const R = this.rag, obj = this.object;
    if (R.asleep && R._posed) {
      if (this.hat) this.updateHat(dt);
      return;
    }
    R.step(dt);
    const pv = R.p[0];
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x = pv.x; this.pos.z = pv.z;
    this.pos.y = this.surface ? this.surface(this.pos.x, this.pos.z) : groundY(this.pos.x);
    // (a hat in the air is in his frame: it keeps its own way as the frame follows the body)
    if (this.hat && !this.hat.rest) {
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw), dx = (this.pos.x - ox) / this.scale, dz = (this.pos.z - oz) / this.scale;
      this.hat.bone.position.x -= dx * c - dz * s; this.hat.bone.position.z -= dx * s + dz * c;
    }
    obj.position.copy(this.pos);
    obj.rotation.y = this.yaw;
    if (this.collider) { this.collider.x = this.pos.x; this.collider.z = this.pos.z; }
    obj.updateMatrixWorld(true);
    R.pose();
    obj.updateMatrixWorld(true);
    this.postPose(dt);
    if (this._deathT >= 0) {
      this._deathT += dt;
      if (!this.hat && this.hatFlies !== false && this._deathT >= (HAT_OFF[this._deathKind] ?? 0.1)) this.launchHat();
    }
    if (this.hat) this.updateHat(dt);
    obj.updateMatrixWorld(true);
    if (this.slot >= 0) FIG_ANCHOR[this.slot].set(this.pos.x, this.pos.y, this.pos.z, this.yaw);
    this._poseVer++;
    if (R.asleep) R._posed = true;
  }
  // after the mixer, while the get-up blends out of the ragdoll's pose
  ragBlendStep(dt) {
    const B = this._ragBlend;
    B.t += dt;
    const k = Math.min(1, B.t / B.dur), e = k * k * (3 - 2 * k);
    for (const [name, q] of Object.entries(B.q)) {
      const b = this.bones[name];
      if (b) b.quaternion.slerpQuaternions(q, b.quaternion.clone(), e);
    }
    this.bones.hips.position.lerpVectors(B.hips, this.bones.hips.position.clone(), e);
    if (k >= 1) this._ragBlend = null;
  }
  // (the mixer writes a bone only when its value moved: while a blend lays a pose over
  // it, every bone is marked moved so the blend is always over the clip, never over itself)
  ragDirty() {
    const M = this.anim.mixer, binds = M && M._bindings;
    if (!binds) return;
    const other = M._accuIndex;
    for (const pm of binds) { const n = pm.valueSize; pm.buffer[other * n + n] = NaN; }
  }

  // debug: lowest skinned vertex above the ground under the Hood (metres;
  // negative = clipping into the street)
  minSkinY(stride = 2) {
    const v = new THREE.Vector3(), m = this.mesh;
    const n = m.geometry.getAttribute('position').count;
    let lo = Infinity;
    for (let i = 0; i < n; i += stride) {
      m.getVertexPosition(i, v);
      v.applyMatrix4(m.matrixWorld);
      if (v.y < lo) lo = v.y;
    }
    return lo - this.pos.y;
  }

  muzzleWorld(out = new THREE.Vector3()) {
    if (this.tommy) return out.set(0, 0.03, -0.53).applyMatrix4(this.tommy.matrixWorld);
    return out.copy(MUZZLE_LOCAL).applyMatrix4(this.bones.handR.matrixWorld);
  }

  // ---- per step ---------------------------------------------------------------
  update(dt, t, camera = null) {
    if (this.script) this.script(this, t, dt);
    // level of detail + shadow casting by distance to the eye (with
    // hysteresis so a man on the boundary does not flicker between meshes)
    if (camera) {
      this._eye = camera.position;
      const d = camera.position.distanceTo(this.pos);
      let lod = this.lod;
      while (lod < 2 && d > LOD_FAR[lod]) lod++;
      while (lod > 0 && d < LOD_FAR[lod - 1] - 1.5) lod--;
      if (lod !== this.lod) {
        this.lod = lod;
        this.geoStamp = (this.geoStamp || 0) + 1;   // (the pipeline's shadow cache)
        this.mesh.geometry = this.lods[lod];
        if (this.cig) for (const c of this.cig) c.visible = lod < 2;
        if (this.tommy) this.tommy.geometry = lod >= 1 && !this.world.lodOff ? TOMMY.geoLo : TOMMY.geo;
      }
      // (beyond ~16 m his lamp shadow is a few pixels; every caster in a
      // lamp's cone re-renders its shadow map, render/Pipeline.js)
      this.mesh.castShadow = d < 16;
    }
    // [O8] the ragdoll poses him while it runs (a get-up clip ends it: blended out of how he lies)
    if (this.rag) {
      if (!this.ragLying() && (this.alive || this.character)) this.endRagdoll();
      else { this.ragStep(dt); return; }
    }
    // [C2b] after the critic: a short step taken facing his target (HoodAI.step
    // sets stepYaw, the way he goes, each step): the legs turn toward it, up to
    // ~70 degrees off his facing, and walk backwards when it is behind him; the
    // spine turns the chest back (postPose), so the body and the gun stay on
    // the target. (h.turnSafe only: the kit's men; the others as they were)
    const moving = this.alive && (this.state === 'walk' || this.state === 'run') && this.speed > 0;
    if (this.turnSafe) {
      let want = 0, back = false;
      if (moving && this.stepYaw != null) {
        let rel = Math.atan2(Math.sin(this.stepYaw - this.yaw), Math.cos(this.stepYaw - this.yaw));
        if (Math.abs(rel) > 1.75) { back = true; rel = Math.atan2(Math.sin(rel - Math.PI), Math.cos(rel - Math.PI)); }
        want = Math.max(-1.2, Math.min(1.2, rel));
      }
      this._legBack = back;
      this._legOff = (this._legOff || 0) + (want - (this._legOff || 0)) * (1 - Math.exp(-12 * dt));
      this._moveYaw = moving && this.stepYaw != null ? this.stepYaw : null;
      this.stepYaw = null;
    }
    // locomotion: the root advances along its facing at `speed`
    if (moving) {
      const my = this._moveYaw ?? this.yaw;
      this.pos.x += Math.sin(my) * this.speed * dt;
      this.pos.z += Math.cos(my) * this.speed * dt;
      this.anim.setTimeScale(this.gaitScale(this.state === 'walk' ? WALK.speed : RUN.speed) * (this._legBack ? -1 : 1));
      // footfalls (Phase 3a: puddle ripples, footsteps): one per half gait
      // cycle, i.e. every stride = speed * T / 2 metres
      const run = this.state === 'run';
      const stride = (run ? RUN.speed * RUN.T : WALK.speed * WALK.T) * this.scale * 0.5;
      this._stepAcc = (this._stepAcc || 0) + this.speed * dt;
      if (this._stepAcc >= stride) {
        this._stepAcc -= stride;
        this._foot = -(this._foot || 1);
        const sx = Math.cos(this.yaw) * 0.11 * this._foot, sz = -Math.sin(this.yaw) * 0.11 * this._foot;
        if (this.world.hoods.onStep) this.world.hoods.onStep(this, this.pos.x + sx, this.pos.z + sz, run);
      }
    }
    // stagger: apply the clip's extracted root motion (backwards)
    if (this.state === 'stagger') {
      const clip = this.anim.clips.stagger;
      const tt = Math.min(clip.duration, this.anim.baseTime + dt);
      const rm = clip.rootMotion(tt);
      const d = (rm - this._rm) * this.scale;
      this._rm = rm;
      this.pos.x += Math.sin(this.yaw) * d;
      this.pos.z += Math.cos(this.yaw) * d;
      if (this.anim.baseTime >= clip.duration) this.setState('idle', 0.3);
    }
    // stepping out of a doorway (wave B): its root motion forward, then idle
    if (this.state === 'stepOut') {
      const clip = this.anim.clips.stepOut;
      const tt = Math.min(clip.duration, this.anim.baseTime + dt);
      const rm = clip.rootMotion(tt);
      const d = (rm - this._rm) * this.scale;
      this._rm = rm;
      this.pos.x += Math.sin(this.yaw) * d;
      this.pos.z += Math.cos(this.yaw) * d;
      if (this.anim.baseTime >= clip.duration) this.setState('idle', 0.3);
    }
    // flinch step: its extracted root motion (x, z in his frame)
    const LO = this.anim.lowerOnce;
    if (LO && this.alive && this._rmStep) {
      const clip = this.anim.clips[LO.name];
      const [rx, rz] = clip.rootMotion(Math.min(clip.duration, LO.t + dt));
      const lx = (rx - this._rmStep[0]) * this.scale, lz = (rz - this._rmStep[1]) * this.scale;
      this._rmStep = [rx, rz];
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      this.pos.x += lx * c + lz * s;
      this.pos.z += -lx * s + lz * c;
    }
    // steering / collision hook (enemies/HoodAI.js): after locomotion
    if (this.onMove && this.alive) this.onMove(this);
    this.pos.y = this.surface ? this.surface(this.pos.x, this.pos.z) : groundY(this.pos.x);
    const obj = this.object;
    obj.position.copy(this.pos);
    obj.rotation.y = this.yaw + (this._legOff || 0);
    if (this.collider) { this.collider.x = this.pos.x; this.collider.z = this.pos.z; }

    if (this._ragBlend) this.ragDirty();   // [O8]
    else if (this.style) this.dirtyBones(STYLE_BONES);   // [O8]
    this.anim.update(dt);
    if (this._ragBlend) this.ragBlendStep(dt);   // [O8]
    obj.updateMatrixWorld(true);
    this.postPose(dt);
    if (this.afterPose) { this.afterPose(this, dt); obj.updateMatrixWorld(true); }
    if (this._deathT >= 0) {
      this._deathT += dt;
      if (!this.hat && this.hatFlies !== false && this._deathT >= (HAT_OFF[this._deathKind] ?? 0.1)) this.launchHat();
    }
    if (this.hat) this.updateHat(dt);
    obj.updateMatrixWorld(true);

    // brush anchor for the ink pass
    if (this.slot >= 0) FIG_ANCHOR[this.slot].set(this.pos.x, this.pos.y, this.pos.z, this.yaw);
    this._poseVer++;
  }

  // look-at / aim correction and the coat-hem spring, on top of the mixer
  postPose(dt) {
    const b = this.bones;
    // coat hem: a damped spring driven by the root's acceleration in local
    // space (the hem lags a start, swings out on turns), clamped small
    if (dt > 0) {
      const vx = (this.pos.x - this._prevPos.x) / dt, vz = (this.pos.z - this._prevPos.z) / dt;
      const ax = (vx - this._vel.x) / dt, az = (vz - this._vel.z) / dt;
      this._vel.set(vx, 0, vz);
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const aFwd = ax * s + az * c, aSide = ax * c - az * s;
      let dyaw = this.yaw - this._prevYaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      const yawRate = dyaw / dt;
      this._yawRate = yawRate;   // [O8] (the lean into a turn)
      const H = this._hem, k = 60, damp = 7;
      // +x tips the hem back (it lags a forward start); +z swings it toward
      // his left, so it goes opposite to the sideways (centripetal) pull and
      // lags a turn on the spot
      const fx = Math.max(-8, Math.min(8, aFwd)) * 0.012;
      const fz = -Math.max(-8, Math.min(8, aSide)) * 0.012 - Math.max(-3, Math.min(3, yawRate)) * 0.02;
      H.vx += (-k * H.x - damp * H.vx) * dt + fx * k * dt;
      H.vz += (-k * H.z - damp * H.vz) * dt + fz * k * dt;
      H.x = Math.max(-0.2, Math.min(0.2, H.x + H.vx * dt));
      H.z = Math.max(-0.2, Math.min(0.2, H.z + H.vz * dt));
      this._prevPos.copy(this.pos);
      this._prevYaw = this.yaw;
    }
    b.coat.quaternion.setFromEuler(_pp.e.set(this._hem.x, 0, this._hem.z));
    driveSkirt(b);

    // [C2b] the legs turned to a step's way: the spine and chest turn the body back to his facing
    if (this._legOff) {
      const q = _pp.q;
      b.spine.quaternion.multiply(q.setFromAxisAngle(_pp.Y, -this._legOff * 0.55));
      b.chest.quaternion.multiply(q.setFromAxisAngle(_pp.Y, -this._legOff * 0.45));
    }
    // look-at: chest and head yaw toward the target within limits; when
    // aiming the whole upper body turns so the gun arm stays on target
    const aiming = this.alive && (this.aiming || this.state === 'aim');
    const wantLook = this.alive && this.lookTarget ? 1 : 0;
    this._lookW += (wantLook - this._lookW) * Math.min(1, dt * 6);
    this._aimW += ((aiming ? 1 : 0) - this._aimW) * Math.min(1, dt * 6);
    if (this._lookW > 0.001 && this.lookTarget) {
      // (scratch objects, not fresh ones: a dozen Hoods run this 60x a second)
      const inv = _pp.m.copy(this.object.matrixWorld).invert();
      const tl = _pp.tl.copy(this.lookTarget).applyMatrix4(inv);
      const yawT = Math.atan2(tl.x, tl.z) + (this._legOff || 0);   // ([C2b] in his facing's frame, not the legs')
      const lim = (x, l) => Math.max(-l, Math.min(l, x));
      // [C2b] a target behind him is not twisted to: the look fades out past
      // ~105 degrees (it went from 0.8 rad one way to 0.8 the other in one
      // frame as the target crossed his back - the body flicked round)
      // (h.turnSafe only: the gun kit's men; the others as they were, their frames golden)
      const fw = this.turnSafe ? Math.max(0, Math.min(1, (2.6 - Math.abs(yawT)) / 0.75)) : 1;
      const chestYaw = lim(yawT * lerp(0.35, 1, this._aimW), lerp(0.6, 0.8, this._aimW)) * this._lookW * fw;
      const headYaw = lim(yawT - chestYaw, 1.0) * this._lookW * (1 - 0.9 * this._aimW) * fw;
      const q = _pp.q;
      b.spine.quaternion.multiply(q.setFromAxisAngle(_pp.Y, chestYaw * 0.5));
      b.chest.quaternion.multiply(q.setFromAxisAngle(_pp.Y, chestYaw * 0.5));
      b.head.quaternion.premultiply(q.setFromAxisAngle(_pp.Y, headYaw));
      // aim elevation: raise / lower the gun arm in the shoulder's frame
      if (this._aimW > 0.01) {
        this.object.updateMatrixWorld(true);
        const sh = _pp.sh.setFromMatrixPosition(b.upperArmR.matrixWorld).applyMatrix4(inv);
        const dy = tl.y - sh.y, dh = Math.hypot(tl.x - sh.x, tl.z - sh.z);
        const elev = lim(Math.atan2(dy, dh) - 0.02, 0.7) * this._lookW * this._aimW;
        // axis: perpendicular to the arm and to 'up', in the shoulder's frame
        const pInv = _pp.pq.setFromRotationMatrix(b.shoulderR.matrixWorld).invert();
        const up = _pp.up.set(0, 1, 0).applyQuaternion(pInv);
        const d = _pp.d.set(0, -1, 0).applyQuaternion(b.upperArmR.quaternion);
        const axis = _pp.ax.crossVectors(d, up);
        if (axis.lengthSq() > 1e-6) b.upperArmR.quaternion.premultiply(q.setFromAxisAngle(axis.normalize(), elev));
      }
    }
    if (this.style) applyStyle(this, dt);   // [O8]
    this.object.updateMatrixWorld(true);
  }

  // the hat leaves the head and flies as a free body in the Hood's space
  launchHat() {
    const b = this.bones, obj = this.object;
    const hat = b.hat;
    const m = new THREE.Matrix4().copy(obj.matrixWorld).invert().multiply(hat.matrixWorld);
    obj.add(hat);
    m.decompose(hat.position, hat.quaternion, new THREE.Vector3());
    hat.scale.set(1, 1, 1);
    const k = this._deathKind;
    const vel = k === 'deathBack' ? new THREE.Vector3(0.25, 2.3, -1.7)
      : k === 'deathSpin' ? new THREE.Vector3(1.6, 1.8, 0.6)
        : new THREE.Vector3(0.1, 0.4, 0.7);
    // A designed tumble instead of a free spin. First (~0.12 s) the hat is
    // righted out of the head's throw-back, so the crown shows at once
    // instead of the brim held square to the eye as a black disc; then it
    // cartwheels whole turns about a horizontal axis and arrives on the
    // street crown up (a fedora lying crown-down reads as a tyre).
    // The cartwheel axis leans toward the eye (a cinematic cheat: seen
    // along its tumble axis a hat always shows its crown in profile) with a
    // back-flip about the Hood's own left-right axis mixed in. From the side
    // that is a plain back-flip; from the front or behind, a cartwheel.
    const T = HAT_TUMBLE[k] || HAT_TUMBLE.deathBack;
    const a = T.axis.clone().setY(0).normalize();
    if (this._eye) {
      const v = this._eye.clone().sub(this.pos).applyQuaternion(obj.quaternion.clone().invert()).setY(0);
      if (v.lengthSq() > 1e-4) {
        v.normalize();
        const xs = new THREE.Vector3(1, 0, 0).addScaledVector(v, -v.x);
        a.copy(v).addScaledVector(xs, T.flip).normalize();
      }
    }
    const g = 9.8, y0 = Math.max(0, hat.position.y - 0.03);
    const tFly = Math.max(0.15, (vel.y + Math.sqrt(vel.y * vel.y + 2 * g * y0)) / g);
    const up0 = new THREE.Vector3(0, 1, 0).applyQuaternion(hat.quaternion);
    this.hat = {
      bone: hat, vel, rest: false, landed: false, tau: 0, tFly, axis: a,
      q0: hat.quaternion.clone(),
      qRight: new THREE.Quaternion().setFromUnitVectors(up0, new THREE.Vector3(0, 1, 0)),
      turns: T.dir * Math.round(T.rate * tFly / TAU),
      tRight: T.right,
      spin: new THREE.Vector3(),
    };
  }

  updateHat(dt) {
    const H = this.hat;
    if (H.rest || dt <= 0) return;
    const hat = H.bone;
    H.vel.y -= 9.8 * dt;
    hat.position.addScaledVector(H.vel, dt);
    if (!H.landed) {
      // in flight: righted, then whole cartwheel turns timed to the landing
      H.tau += dt;
      const r = sstep(0, H.tRight, H.tau);
      const u = Math.min(1, H.tau / H.tFly);
      // fast off the head, slowing in the air (drag): the inverted phase is
      // passed high up, and the hat comes down nearly crown up
      const ang = H.turns * TAU * (1 - Math.pow(1 - u, 2.2));
      hat.quaternion.copy(H.q0).premultiply(new THREE.Quaternion().slerp(H.qRight, r))
        .premultiply(new THREE.Quaternion().setFromAxisAngle(H.axis, ang));
    } else {
      const w = H.spin.length();
      if (w > 1e-4) hat.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(H.spin.clone().divideScalar(w), w * dt));
    }
    // lowest point: the brim circle (r ~0.18) or the crown top when upturned
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hat.quaternion);
    const R = this.hatR ?? BRIM_R[this.variant.brim];
    // (the snap brim hangs ~2.5 cm below the brim plane at the front)
    const low = Math.min(hat.position.y - R * Math.sqrt(Math.max(0, 1 - up.y * up.y)) - 0.03 * Math.max(0, up.y), hat.position.y + up.y * 0.125);
    if (low < 0) {
      hat.position.y -= low;
      if (H.vel.y < 0) H.vel.y *= -0.22;
      H.vel.x *= 0.55; H.vel.z *= 0.55;
      // the tumble was timed to arrive crown up; after the first contact
      // the hat only rocks onto its brim
      H.spin.multiplyScalar(0.5);
      H.landed = true;
      // settle crown up, resting on the brim
      const target = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(up, target);
      hat.quaternion.premultiply(new THREE.Quaternion().slerp(q, Math.min(1, dt * 12)));
      if (Math.abs(H.vel.y) < 0.15 && H.vel.lengthSq() < 0.02 && up.angleTo(target) < 0.05) H.rest = true;
    }
  }

  dispose() {
    const w = this.world;
    w.scene.remove(this.object);
    const i = w.colliders.circles.indexOf(this.collider);
    if (i >= 0) w.colliders.circles.splice(i, 1);
    for (const m of this.hitMeshes) { const j = w.solids.indexOf(m); if (j >= 0) w.solids.splice(j, 1); }
    releaseHoodSlot(this.slot);
    if (this.slot >= 0) FIG_ANCHOR[this.slot].set(0, 0, 0, 0);
    // [C10a] (each man's skeleton has its own bone texture on the GPU: a retry that makes the beat's men again
    // left the last try's behind - a texture a man, ten retries at one checkpoint and forty more. His
    // geometries are the shared cached ones and stay)
    // And what he carries that was made for him (a torch, a hook, a lantern, his cigarette, a cane: each built
    // anew per man) goes off the GPU with him; the body's LODs and the hit shapes are shared caches and stay.
    const hits = new Set(this.hitMeshes);
    this.object.traverse((o) => {
      if (o.isSkinnedMesh) { if (o.skeleton) o.skeleton.dispose(); return; }
      if ((o.isMesh || o.isLine || o.isPoints) && o.geometry && !hits.has(o) && !this.lods.includes(o.geometry)) o.geometry.dispose();
    });
  }
}

// Ground contact for the death clips: CPU-skin a reference Hood (long coat,
// far LOD) at every key of each death and lift the hips wherever any part
// would pass below the street; once the body has landed, set it down so its
// lowest point just touches the ground (no floating, no clipping).
const GROUND_MARGIN = 0.004;
export const DEATH_REPORT = {};
function groundDeathClips(world) {
  if (groundDeathClips.done) return;
  groundDeathClips.done = true;
  const clips = getClips();
  const obj = new THREE.Group();
  const bones = {};
  for (const [name, parent] of JOINTS) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.copy(OFFSET[name]);
    bones[name] = b;
    if (parent) bones[parent].add(b);
  }
  obj.add(bones.root);
  const mesh = new THREE.SkinnedMesh(hoodGeometry({ coat: 0, brim: 1 }, 1), hoodMaterial(world));
  obj.add(mesh);
  obj.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(JOINTS.map((j) => bones[j[0]])));
  const mixer = new THREE.AnimationMixer(obj);
  const v = new THREE.Vector3();
  const count = mesh.geometry.getAttribute('position').count;
  const minY = () => {
    let m = Infinity;
    for (let i = 0; i < count; i += 2) { mesh.getVertexPosition(i, v); if (v.y < m) m = v.y; }
    return m;
  };
  const LAND = { deathBack: [0.72, 0.95], deathKnees: [0.85, 1.0], deathSpin: [0.75, 0.95] };
  for (const kind of DEATHS) {
    const c = clips[kind];
    const aL = mixer.clipAction(c.lower), aU = mixer.clipAction(c.upper);
    for (const a of [aL, aU]) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); }
    const track = c.lower.tracks.find((t) => t.name === 'hips.position');
    const times = track.times, vals = track.values;
    const lift = new Float32Array(times.length);
    const [land0, land1] = LAND[kind];
    let worst = 0;
    for (let i = 0; i < times.length; i++) {
      if (times[i] < 0.1) continue;
      mixer.setTime(Math.min(times[i], c.duration - 1e-4));
      obj.updateMatrixWorld(true);
      driveSkirt(bones);
      obj.updateMatrixWorld(true);
      const m = minY();
      worst = Math.min(worst, m);
      const settle = sstep(land0, land1, times[i]);
      // before landing only lift; once down, touch the ground exactly
      lift[i] = lerp(Math.max(0, GROUND_MARGIN - m), GROUND_MARGIN - m, settle);
    }
    // smooth the correction a little (no pops between keys)
    for (let i = 0; i < times.length; i++) {
      const a = lift[Math.max(0, i - 1)], b = lift[i], d = lift[Math.min(times.length - 1, i + 1)];
      vals[i * 3 + 1] += Math.max(b, (a + 2 * b + d) / 4);
    }
    DEATH_REPORT[kind] = { worstBefore: +worst.toFixed(3), finalLift: +lift[times.length - 1].toFixed(3) };
    aL.stop(); aU.stop();
  }
  mixer.uncacheRoot(obj);
}

// The Hoods in the world: spawn, per-step update.
export class Hoods {
  constructor(world) {
    this.world = world;
    this.list = [];
    getClips();
    groundDeathClips(world);
  }
  spawn(pos, variant = {}, opts = {}) {
    const p = pos.isVector3 ? pos : new THREE.Vector3(pos.x ?? pos[0], 0, pos.z ?? pos[2] ?? pos[1]);
    const h = new Hood(this.world, { pos: p, yaw: opts.yaw ?? 0, variant });
    if (opts.state) h.setState(opts.state, 0);
    this.list.push(h);
    return h;
  }
  remove(h) {
    const i = this.list.indexOf(h);
    if (i >= 0) this.list.splice(i, 1);
    h.dispose();
  }
  update(dt, t, camera = null) {
    for (const h of this.list) h.update(dt, t, camera);
  }
}

export { L_UPPER };
