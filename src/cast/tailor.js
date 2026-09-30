import * as THREE from 'three';
import { grid, orientOut, tableSampler, profileAt, assemble, LOD_Q } from '../enemies/Hood.js';
import { JOINTS, JOINT_INDEX, BIND as HOOD_BIND, L_THIGH, L_SHIN } from '../enemies/HoodRig.js';

// The tailor: the cast's figures cut on the Hood's skeleton (lane 6, P0.1).
//
//   figureGeometry(costume, lod) -> one skinned BufferGeometry (cached)
//   figureRig(costume) -> { BIND, OFFSET, L_UPPER, L_FORE, L_THIGH, L_SHIN }
//
// A costume (src/cast/costumes.js) names
//   body      a table of proportions: the torso's superellipse rings, the
//             shoulder and hip sockets, the arm lengths, the neck, the head,
//             the hands, the legs
//   cover     what is on the head (a flat cap, a cloche, a bowler, pinned-up
//             hair under a cap, ...): it always shadows the face
//   garments  what is worn, outermost last (a shirt, a waistcoat, a dress, an
//             apron, a coat's skirt, a collar, sleeves, trousers, ...)
//   shoes     shoe | boot | flat
//   skin      the part shades (linear grey albedo: the ink makes the dark
//             ones black masses and lets the light ones print)
// The build is the Hood's (enemies/Hood.js): parametric smooth surfaces in
// the bind pose, every vertex skinned to the same joints by smooth weights,
// three LODs from one tessellation factor, one draw per pass. Faces are
// never modelled: the head is a dark mass with at most a nose.

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const spow = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);
const bump = (x, a, b, e) => sstep(a - e, a + e, x) * (1 - sstep(b - e, b + e, x));
const B = JOINT_INDEX;

let Q = 1;
const seg = (n, min = 4) => Math.max(min, Math.round(n * Q));

// ---------------------------------------------------------------------------
// the rig of a body: the Hood's joints, moved where the body says
export function figureRig(costume) {
  if (costume._rig) return costume._rig;
  const b = costume.body;
  const bind = {};
  for (const [k, v] of Object.entries(HOOD_BIND)) bind[k] = v.clone();
  const sx = b.shoulderX ?? 0.19, sy = b.shoulderY ?? 1.425, up = b.upper ?? 0.3, fo = b.fore ?? 0.27;
  const hx = b.hipX ?? 0.095;
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    bind['shoulder' + S].set(s * 0.045, sy - 0.005, -0.018);
    bind['upperArm' + S].set(s * sx, sy, -0.018);
    bind['forearm' + S].set(s * sx, sy - up, -0.018);
    bind['hand' + S].set(s * sx, sy - up - fo, -0.018);
    bind['thigh' + S].set(s * hx, 0.93, 0);
    bind['shin' + S].set(s * hx, 0.93 - L_THIGH, 0);
    bind['foot' + S].set(s * hx, bind['foot' + S].y, 0);
    bind['skirt' + S].set(s * hx, 0.93, 0);
  }
  if (b.neckY) bind.neck.y = b.neckY;
  if (b.headY) bind.head.y = b.headY;
  bind.hat.y = bind.head.y + (costume.cover?.hatDY ?? 0.135);
  bind.hat.z = bind.head.z + (costume.cover?.hatDZ ?? 0);
  const OFFSET = {};
  for (const [name, parent] of JOINTS) OFFSET[name] = parent ? bind[name].clone().sub(bind[parent]) : bind[name].clone();
  costume._rig = { BIND: bind, OFFSET, L_UPPER: up, L_FORE: fo, L_THIGH, L_SHIN };
  return costume._rig;
}

// ---------------------------------------------------------------------------
// the torso: superellipse rings [y, rx, rzFront, rzBack, cz, n]
function torsoOf(F) {
  const S = tableSampler(F.body.torso);
  const y0 = F.body.torso[0][0], y1 = F.body.torso[F.body.torso.length - 1][0];
  const point = (theta, y, out = new THREE.Vector3(), grow = 0) => {
    const [rx, rzF, rzB, cz, n] = S(clamp(y, y0, y1));
    const s = Math.sin(theta), c = Math.cos(theta);
    const e = 2 / n;
    out.set((rx + grow) * spow(s, e), y, cz + (c > 0 ? rzF + grow : rzB + grow) * spow(c, e));
    return out;
  };
  const normal = (theta, y, out = new THREE.Vector3()) => {
    const a = point(theta - 0.01, y), b = point(theta + 0.01, y);
    const c = point(theta, y - 0.005), d = point(theta, y + 0.005);
    out.crossVectors(b.sub(a), d.sub(c)).normalize();
    const p = point(theta, y);
    if (out.x * p.x + out.z * (p.z - S(clamp(y, y0, y1))[3]) < 0) out.negate();
    return out;
  };
  return { S, y0, y1, point, normal };
}

function torsoWeights(F, x, y) {
  const b1 = sstep(1.02, 1.14, y), b2 = sstep(1.2, 1.33, y);
  const w = [[B.hips, 1 - b1], [B.spine, b1 * (1 - b2)], [B.chest, b1 * b2]];
  const R = F.rig.BIND, sx = R.upperArmL.x, sy = R.upperArmL.y;
  const wa = 0.2 * sstep(sx - 0.05, sx + 0.03, Math.abs(x)) * sstep(sy - 0.1, sy, y);
  if (wa > 0) { for (const e of w) e[1] *= 1 - wa; w.push([x > 0 ? B.upperArmL : B.upperArmR, wa]); }
  return w;
}

// (theta: 0 at the front centre, + toward his left)
const thetaOf = (u) => { let th = u * TAU; if (th > Math.PI) th -= TAU; return th; };

function buildTorso(F, g) {
  const T = F.torso;
  const y0 = g.y0 ?? T.y0, y1 = T.y1;
  const nu = seg(96, 24), nv = seg(44, 14);
  const geo = grid(nu, nv, (u, v, p) => {
    const y = y0 + (y1 - y0) * (1 - Math.pow(1 - v, 1.35));
    T.point(u * TAU, y, p, g.grow || 0);
  });
  orientOut(geo, new THREE.Vector3(0, 1.2, 0));
  const shade = typeof g.shade === 'function' ? (x, y, z, u) => g.shade(thetaOf(u), y, x, z) : F.shade(g.shade || 'coat');
  return { geo, shade, weights: (x, y) => torsoWeights(F, x, y) };
}

// a shell over the torso between hem(theta) and top(theta): a waistcoat,
// a bib, a yoke. grow lifts it off the torso so its edge prints.
function buildShell(F, g) {
  const T = F.torso;
  const nu = seg(g.nu ?? 96, 20), nv = seg(g.nv ?? 26, 8);
  const geo = grid(nu, nv, (u, v, p) => {
    const th = g.span ? lerp(-g.span, g.span, u) : u * TAU - Math.PI;
    const y = lerp(g.hem(th), g.top(th), v);
    const lift = (g.grow ?? 0.006) + (g.pad ? g.pad(th, y) : 0);
    T.point(th, y, p, lift);
  }, { wrapU: !g.span });
  orientOut(geo, new THREE.Vector3(0, 1.2, 0));
  const shade = typeof g.shade === 'function' ? (x, y, z, u, v) => g.shade(g.span ? lerp(-g.span, g.span, u) : u * TAU - Math.PI, y, v) : F.shade(g.shade);
  return { geo, shade, weights: (x, y) => torsoWeights(F, x, y) };
}

// ---------------------------------------------------------------------------
// the skirt of a coat or a dress: from y0 down to the hem. split: a coat
// open at the front (the left panel lapping over the right); back: how much
// of the back follows the legs (1: all of it, a dress; 0.3: a coat whose back
// hangs when he sits).
function skirtFrame(F, g) {
  const T = F.torso;
  const y0 = g.y0;
  const [rx0, rzF0, rzB0, cz0] = T.S(y0);
  const gr = g.grow ?? 0.01;
  const fx = g.flare?.[0] ?? 1.35, fz = g.flare?.[1] ?? 1.38;
  const S = (v) => {
    const k = Math.pow(v, g.flarePow ?? 1.2);
    return [
      (rx0 + gr) * lerp(1, fx, k) + (g.hipOut ?? 0) * Math.sin(Math.PI * Math.min(1, v * 2.2)),
      (rzF0 + gr) * lerp(1, fz, k), (rzB0 + gr) * lerp(1, fz * (g.backFlare ?? 1), k), cz0 - 0.015 * k,
    ];
  };
  const ov = g.split ?? 0;
  const th0 = -ov * 0.5;
  const point = (u, v, p) => {
    const th = th0 + u * (TAU + ov);
    let [rx, rzF, rzB, cz] = S(v);
    const fa = g.folds ?? 1;
    const fold = fa * (0.022 * Math.sin(6 * th + 1.3) + 0.013 * Math.sin(11 * th + 0.4)) * sstep(0.15, 1, v);
    const lap = ov ? 0.012 * (1 - sstep(0, 0.09, u)) - 0.007 * sstep(0.91, 1, u) : 0;
    rx = rx * (1 + fold) + lap; rzF = rzF * (1 + fold) + lap; rzB = rzB * (1 + fold) + lap;
    const s = Math.sin(th), c = Math.cos(th);
    const hem = g.hem + (g.hemWave ?? 0.012) * Math.sin(3 * th + 0.7) * v + (g.hemTilt ?? 0) * c;
    const y = lerp(y0, hem, Math.pow(v, 0.92));
    return p.set(rx * spow(s, 2 / 2.3), y, cz + (c > 0 ? rzF : rzB) * spow(c, 2 / 2.3));
  };
  const weights = (x, y, z, u, v) => {
    const h = clamp(v, 0, 1);
    const th = th0 + u * (TAU + ov);
    const s = Math.sin(th), c = Math.cos(th);
    const wl = ov ? 1 - sstep(0.3, 0.7, u) : sstep(-0.4, 0.4, s);
    const legs = lerp(g.back ?? 1, 1, sstep(-0.6, 0.35, c));
    const tw = 0.86 * Math.pow(h, 1.1) * legs;
    const cw = 0.14 * Math.pow(h, 1.5) + 0.25 * h * (1 - legs);
    return [[B.hips, Math.max(0, 1 - tw - cw)], [B.skirtL, tw * wl], [B.skirtR, tw * (1 - wl)], [B.coat, cw]];
  };
  return { point, weights, ov };
}

function buildSkirt(F, g) {
  const K = skirtFrame(F, g);
  const nu = seg(120, 36), nv = seg(36, 10);
  const geo = grid(nu, nv, (u, v, p) => K.point(u, v, p), { wrapU: false });
  orientOut(geo, new THREE.Vector3(0, (g.y0 + g.hem) / 2, 0));
  // (uv.x is u: the weights read it)
  return { geo, shade: typeof g.shade === 'function' ? (x, y, z, u, v) => g.shade(u, v, x, y, z) : F.shade(g.shade || 'coat'), weights: K.weights };
}

// ---------------------------------------------------------------------------
// collars
function buildCollar(F, g) {
  const T = F.torso, R = F.rig.BIND;
  const nu = seg(g.nu ?? 64, 16), nv = seg(g.nv ?? 12, 4);
  const kind = g.style;
  const nr = F.body.neckR ?? 0.054;
  const yb = T.y1 - 0.02;
  const geo = grid(nu, nv, (u, v, p) => {
    if (kind === 'fur') {
      // a thick soft roll standing round the jaw, open a little at the front
      const th = 0.25 + u * (TAU - 0.5);
      const a = v * TAU;
      const back = (1 - Math.cos(th)) * 0.5;
      const rr = (g.r ?? 0.05) * (1 + 0.14 * Math.sin(7 * th + 2 * a) + 0.08 * Math.sin(13 * th));
      const R0 = nr + 0.03 + rr * 0.8;
      const yc = yb + 0.04 + 0.03 * back + rr * 0.5;
      const rad = R0 + rr * Math.cos(a);
      return p.set(rad * Math.sin(th) * 1.08, yc + rr * 1.2 * Math.sin(a), -0.02 + rad * Math.cos(th));
    }
    if (kind === 'scarf') {
      // a wool band wrapped round the neck, knotted at the front
      const th = u * TAU, a = v * TAU;
      const rr = g.r ?? 0.03;
      const R0 = nr + 0.02 + rr;
      const yc = yb + 0.035 + 0.012 * Math.sin(2 * th);
      const rad = R0 + rr * Math.cos(a) * 1.1;
      return p.set(rad * Math.sin(th), yc + rr * 0.9 * Math.sin(a), -0.02 + rad * 1.05 * Math.cos(th));
    }
    // stand collars: 'stand' (the Hood's raised coat collar), 'band' (a
    // collarless shirt's), 'peacoat' (turned up to the ears), 'dress' (a
    // small flat collar lying on the shoulders)
    const open = g.open ?? 0.5;
    const th = open + u * (TAU - 2 * open);
    const back = (1 - Math.cos(th)) * 0.5;
    if (kind === 'dress') {
      const r0 = nr + 0.004, r1 = nr + 0.055;
      const rr = lerp(r0, r1, v);
      const y = lerp(yb + 0.03, yb - 0.02 - 0.03 * (1 - back), v) ;
      return p.set(rr * Math.sin(th) * 1.15, y, -0.018 + rr * 1.05 * Math.cos(th));
    }
    const H = g.h ?? 0.06, lo = g.lo ?? 0;
    const yb2 = yb + lo;
    const yt = yb2 + (g.hFront ?? 0.045) + (H - (g.hFront ?? 0.045)) * Math.pow(back, 0.8);
    const y = lerp(yb2, yt, v);
    const out = g.flareOut ?? 0.008;
    const rx = lerp(nr + (g.gap ?? 0.032), nr + (g.gap ?? 0.032) + (g.lean ?? 0.008), v) + out * v * v * v;
    const rz = rx * 0.96;
    return p.set(rx * Math.sin(th) * (g.wide ?? 1), y, -0.018 - 0.008 * v + rz * Math.cos(th));
  }, { wrapU: kind === 'fur' || kind === 'scarf' ? kind === 'scarf' : false });
  if (kind === 'fur' || kind === 'scarf') {
    // (a torus: its normals point away from its own tube, not from the neck)
    geo.computeVertexNormals();
  } else orientOut(geo, new THREE.Vector3(0, yb + 0.03, -0.02));
  void R;
  return { geo, shade: F.shade(g.shade || 'collar'), weights: (x, y) => (y > T.y1 + 0.03 && kind !== 'dress' ? [[B.chest, 0.8], [B.neck, 0.2]] : [[B.chest, 1]]) };
}

// lapels lying on the chest (the Hood's, on this body)
function buildLapel(F, sgn, g) {
  const T = F.torso;
  const top = g.top ?? T.y1 - 0.014, low = g.low ?? 1.2;
  const inner = [[0.34, top], [0.2, lerp(low, top, 0.55)], [0.075, low]];
  const outer = [[0.98, top - 0.037], [0.55, lerp(low, top, 0.52)], [0.1, low]];
  const nu = seg(14, 5), nv = seg(22, 6);
  const n = new THREE.Vector3();
  const geo = grid(nu, nv, (u, v, p) => {
    const a = profileAt(inner, v), b = profileAt(outer, v);
    const th = sgn * lerp(a[0], b[0], u);
    const y = lerp(a[1], b[1], u);
    T.point(th, y, p, g.grow ?? 0);
    T.normal(th, y, n);
    const off = 0.003 + 0.006 * Math.pow(Math.sin(Math.PI * u), 0.6) * (0.4 + 0.6 * (1 - v));
    p.addScaledVector(n, off);
  }, { wrapU: false });
  orientOut(geo, new THREE.Vector3(0, 1.3, -0.1));
  return { geo, shade: F.shade(g.shade || 'lapel'), weights: (x, y) => torsoWeights(F, x, y) };
}

// ---------------------------------------------------------------------------
// sleeves and bare arms. A sleeve hangs from the shoulder joint; len (m
// below the joint) and a profile [d, r] of its own, or the defaults by kind:
// 'full' (to the wrist), 'long' (over the back of the hand), 'rolled' (above
// the elbow, a thick roll), 'short' (a puffed cap sleeve).
function sleeveWeights(F, sgn, J, bendAt) {
  const up = sgn > 0 ? B.upperArmL : B.upperArmR, fo = sgn > 0 ? B.forearmL : B.forearmR;
  return (x, y) => {
    const d = J.y - y;
    const we = sstep(bendAt - 0.05, bendAt + 0.05, d);
    return [[up, 1 - we], [fo, we]];
  };
}

function buildSleeve(F, sgn, g) {
  const R = F.rig, J = R.BIND[sgn > 0 ? 'upperArmL' : 'upperArmR'];
  const r = g.r ?? 0.083, L = R.L_UPPER + R.L_FORE;
  let prof;
  // (round 2: the sleeve head is set in square, a tailored shoulder with a
  // seam - a flat top that turns down at an edge - not the dome of a
  // balloon's arm)
  const cap = [[-0.036, 0], [-0.036, r * 0.5], [-0.034, r * 0.8], [-0.026, r * 0.96], [-0.012, r * 1.01], [0, r]];
  if (g.style === 'rolled' && (g.len ?? 0) > R.L_UPPER) {
    // (rolled below the elbow: the sleeve follows the arm past the elbow and
    // ends in a flat roll on the forearm, so the light shape of the arm is
    // the wrist and the fist, not a whole bare forearm)
    const e = g.len, U = R.L_UPPER;
    prof = [...cap, [0.06, r * 0.99], [U * 0.6, r * 0.94], [U - 0.02, r * 0.88], [U + 0.04, r * 0.9],
      [e - 0.05, r * 0.82], [e - 0.034, r * 0.93], [e - 0.012, r * 0.97], [e + 0.004, r * 0.93], [e + 0.012, r * 0.8], [e + 0.01, r * 0.68]];
  } else if (g.style === 'rolled') {
    const e = g.len ?? R.L_UPPER * 0.72;
    prof = [...cap, [0.06, r * 0.99], [e * 0.6, r * 0.93],
      [e - 0.05, r * 0.9], [e - 0.035, r * 1.08], [e - 0.012, r * 1.14], [e + 0.004, r * 1.08], [e + 0.012, r * 0.92], [e + 0.01, r * 0.78]];
  } else if (g.style === 'short') {
    const e = g.len ?? 0.13;
    prof = [...cap, [e * 0.5, r * 1.02], [e - 0.01, r * 0.96], [e, r * 0.9], [e + 0.004, r * 0.8], [e, r * 0.7]];
  } else {
    const e = g.style === 'long' ? L + 0.06 : L - 0.025;
    const rc = g.cuff ?? 0.071;
    prof = [...cap, [0.06, r],
      [0.15, r * 0.95], [0.24, r * 0.9], [R.L_UPPER, r * 0.88], [R.L_UPPER + 0.06, r * 0.86], [e - 0.1, r * 0.82], [e - 0.028, rc * 0.95],
      [e - 0.015, rc], [e - 0.004, rc * 0.97], [e, rc * 0.87], [e - 0.01, rc * 0.73]];
  }
  const nu = seg(40, 12), nv = seg(prof.length * 3, prof.length + 4);
  const geo = grid(nu, nv, (u, v, p) => {
    const [d, rr] = profileAt(prof, v);
    const th = u * TAU;
    p.set(J.x + rr * 0.93 * Math.sin(th), J.y - d, J.z + rr * Math.cos(th));
  });
  orientOut(geo, new THREE.Vector3(J.x, J.y - 0.2, J.z));
  return { geo, shade: F.shade(g.shade || 'coat'), weights: sleeveWeights(F, sgn, J, R.L_UPPER) };
}

// a bare arm from d0 below the shoulder joint to the wrist: the upper arm
// round, the elbow's knob, the forearm's swell and its taper to the wrist
function buildBareArm(F, sgn, g) {
  const R = F.rig, J = R.BIND[sgn > 0 ? 'upperArmL' : 'upperArmR'];
  const r = g.r ?? 0.05, U = R.L_UPPER, L = U + R.L_FORE, d0 = g.d0 ?? 0.1;
  // (wrist: the arm's radius at the wrist, a fraction of r; a heavy forearm
  // swells below the elbow and narrows hard to it)
  const wr = g.wrist ?? 0.64;
  const prof = [[d0 - 0.02, r * 0.4], [d0, r * 1.02], [U * 0.6, r * 1.05], [U - 0.04, r * 0.92], [U, r * 0.86], [U + 0.05, r * 0.98],
    [U + 0.1, r * 1.0], [U + 0.17, r * (0.86 + (0.64 - wr) * 0.3)], [L - 0.03, r * (wr + 0.02)], [L - 0.005, r * wr], [L + 0.01, r * wr * 0.78]];
  const nu = seg(32, 10), nv = seg(prof.length * 3, prof.length + 4);
  const geo = grid(nu, nv, (u, v, p) => {
    const [d, rr] = profileAt(prof, v);
    const th = u * TAU;
    // (the forearm is flatter across its width, and the elbow sticks out
    // behind)
    const fore = sstep(U, U + 0.05, d);
    const elbow = 0.012 * Math.exp(-(((d - U) / 0.03) ** 2)) * Math.max(0, -Math.cos(th));
    p.set(J.x + rr * lerp(0.94, 1.08, fore) * Math.sin(th), J.y - d, J.z + (rr * lerp(1, 0.86, fore) + elbow) * Math.cos(th));
  });
  orientOut(geo, new THREE.Vector3(J.x, J.y - L * 0.6, J.z));
  return { geo, shade: F.shade(g.shade || 'arm'), weights: sleeveWeights(F, sgn, J, U) };
}

// ---------------------------------------------------------------------------
// legs: trousers (r scales the Hood's profile), stockings (a slim bare leg)
function buildLeg(F, sgn, g) {
  const x0 = sgn * (F.rig.BIND.thighL.x);
  const k = g.r ?? 1;
  let prof;
  if (g.style === 'stocking') {
    prof = [[0.99, 0], [0.985, 0.05], [0.97, 0.078], [0.93, 0.084], [0.8, 0.074], [0.66, 0.062], [0.55, 0.052], [0.49, 0.048], [0.43, 0.05],
      [0.34, 0.052], [0.24, 0.042], [0.14, 0.032], [0.1, 0.03], [0.085, 0.031], [0.08, 0.028], [0.085, 0.02]];
  } else {
    prof = [[1.05, 0.0], [1.045, 0.05], [1.03, 0.085], [1.0, 0.097], [0.93, 0.098], [0.8, 0.09], [0.66, 0.078],
      [0.55, 0.07], [0.49, 0.068], [0.4, 0.066], [0.28, 0.062], [0.17, 0.06], [0.11, 0.063], [0.088, 0.066],
      [0.077, 0.064], [0.082, 0.056], [0.11, 0.048]];
    if (g.boot) prof = prof.map(([y, r]) => [y, y < 0.3 ? r * (0.9 + 0.1 * (y / 0.3)) : r]);
  }
  const nu = seg(36, 12), nv = seg(prof.length * 3, prof.length + 4);
  const geo = grid(nu, nv, (u, v, p) => {
    const [y, r] = profileAt(prof, v);
    const th = u * TAU;
    const kk = g.style === 'stocking' ? 1 : lerp(1, k, sstep(0.1, 0.35, y));
    // (round 2: pressed trousers keep a crease down the front and the back,
    // a sharp ridge the ink's line finds from the knee to the shoe)
    const cr = g.style === 'stocking' ? 0 : 0.07 * sstep(0.12, 0.3, y) * (1 - sstep(0.85, 0.98, y));
    const ridge = 1 + cr * (Math.exp(-((Math.sin(th) / 0.1) ** 2)) * Math.max(0, Math.cos(th)) + 0.6 * Math.exp(-((Math.sin(th) / 0.1) ** 2)) * Math.max(0, -Math.cos(th)));
    p.set(x0 + r * kk * 0.95 * Math.sin(th), y, r * kk * 1.03 * Math.cos(th) * ridge);
  });
  orientOut(geo, new THREE.Vector3(x0, 0.6, 0));
  const th = sgn > 0 ? B.thighL : B.thighR, sh = sgn > 0 ? B.shinL : B.shinR;
  const weights = (x, y) => {
    const wh = sstep(0.93, 1.04, y) * 0.85;
    const ws = sstep(0.55, 0.44, y);
    return [[B.hips, wh], [th, (1 - wh) * (1 - ws)], [sh, (1 - wh) * ws]];
  };
  return { geo, shade: F.shade(g.shade || (g.style === 'stocking' ? 'stocking' : 'trousers')), weights };
}

// shoes: 'shoe' (the Hood's), 'boot' (a high heavy toe, the upper round the
// ankle), 'flat' (a small low slipper)
function buildShoe(F, sgn, g) {
  const x0 = sgn * F.rig.BIND.thighL.x;
  const kind = g.style || 'shoe';
  const K = { shoe: [0.058, 0.142, 0.047, 1], boot: [0.066, 0.158, 0.056, 1.25], flat: [0.052, 0.118, 0.038, 0.7] }[kind];
  const [cz, HL, W, Hk] = K;
  const nu = seg(40, 12), nv = seg(28, 10);
  const geo = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const lz = -Math.cos(b), q = Math.sin(b);
    const cx = q * Math.cos(a), cy = q * Math.sin(a);
    const hw = W * (1 - 0.14 * Math.max(0, lz) ** 2) * (1 + 0.04 * Math.max(0, -lz));
    let ht = (0.044 + 0.022 * Math.exp(-(((lz + 0.12) / 0.42) ** 2)) - 0.012 * sstep(0.35, 1, lz)) * Hk;
    if (kind === 'boot') ht += 0.03 * Math.exp(-(((lz + 0.35) / 0.3) ** 2));
    // (the sole arches between the heel and the ball of the foot)
    // (and under the heel it stands on the heel block, below)
    const hh0 = kind === 'flat' ? 0.012 : kind === 'boot' ? 0.03 : 0.026;
    const arch = Math.max(kind === 'flat' ? 0 : 0.014 * Math.exp(-(((lz + 0.35) / 0.28) ** 2)), hh0 * 0.92 * sstep(-0.42, -0.58, lz));
    const y = cy > 0 ? 0.04 + cy * ht : 0.04 - (0.04 - arch) * Math.pow(-cy, 0.28);
    // (a squared toe: the sides straighten toward the front)
    p.set(x0 + cx * hw * (1 + 0.08 * sstep(0.2, 0.8, lz)), y, cz + lz * HL);
  });
  orientOut(geo, new THREE.Vector3(x0, 0.04, cz));
  const w = () => [[sgn > 0 ? B.footL : B.footR, 1]];
  const sh = F.shade(g.shade || 'shoes');
  // the heel: a block under the back of the shoe, square at its corners
  const hz = cz - HL * 0.74, hh = kind === 'flat' ? 0.012 : kind === 'boot' ? 0.03 : 0.026;
  const heel = grid(seg(24, 8), seg(12, 6), (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    p.set(x0 + spow(dx, 0.3) * W * 0.78, hh * 0.5 + spow(dy, 0.3) * hh * 0.5, hz + spow(dz, 0.3) * HL * 0.2);
  });
  orientOut(heel, new THREE.Vector3(x0, hh * 0.5, hz));
  return [{ geo, shade: sh, weights: w }, { geo: heel, shade: sh, weights: w }];
}

// ---------------------------------------------------------------------------
// the head: the Hood's deformed sphere (brow, ears, skull, jaw), sized by the
// body; a dark mass with at most a nose in profile
function buildHead(F) {
  const b = F.body, J = F.rig.BIND.head;
  const hs = b.headS ?? 1;
  const C = new THREE.Vector3(0, J.y + 0.08 * hs, J.z + 0.018 * hs);
  const R = [0.077 * hs * (b.headW ?? 1), 0.1 * hs, 0.094 * hs];
  const nu = seg(64, 16), nv = seg(44, 12);
  const jawW = b.jaw ?? 0.2;
  const geo = grid(nu, nv, (u, v, p) => {
    const bb = v * Math.PI, a = u * TAU;
    const dy = Math.cos(bb), q = Math.sin(bb);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    let r = 1;
    r += 0.24 * Math.exp(-((dx / 0.13) ** 2) - (((dy + 0.1) / 0.2) ** 2)) * Math.max(0, dz) ** 6;
    r += 0.07 * Math.exp(-((dx / 0.45) ** 2) - (((dy - 0.28) / 0.1) ** 2)) * Math.max(0, dz) ** 2;
    r += 0.2 * Math.exp(-(((Math.abs(dx) - 0.97) / 0.07) ** 2) - (((dy - 0.02) / 0.22) ** 2) - (((dz + 0.08) / 0.2) ** 2));
    r += 0.1 * Math.exp(-(((dy - 0.2) / 0.35) ** 2) - (((dz + 0.9) / 0.35) ** 2));
    r -= 0.06 * Math.exp(-(((dy + 0.55) / 0.25) ** 2) - (((dz + 0.8) / 0.4) ** 2));
    r -= 0.05 * Math.exp(-(((Math.abs(dx) - 0.9) / 0.25) ** 2) - (((dy - 0.35) / 0.3) ** 2));
    let x = dx * R[0] * r, y = dy * R[1] * r, z = dz * R[2] * r;
    const jaw = sstep(-0.05, -0.85, dy);
    x *= 1 - jawW * jaw;
    z += 0.016 * sstep(-0.35, -0.85, dy) * Math.max(0, dz) - 0.012 * jaw * Math.max(0, -dz);
    p.set(C.x + x, C.y + y, C.z + z);
  });
  orientOut(geo, C);
  const hair = F.shade('hair'), skin = F.shade('skin');
  const hl = b.hairLine ?? 0.25;
  const shade = (x, y, z) => {
    const dy = (y - C.y) / R[1], dz = (z - C.z) / R[2];
    const h = sstep(hl, hl + 0.2, dy + 0.55 * Math.max(0, -dz) - 0.35 * Math.max(0, dz));
    return lerp(skin, hair, h);
  };
  F.headC = C; F.headR = R;
  return { geo, shade, weights: () => [[B.head, 1]] };
}

function buildNose(F) {
  const C0 = F.headC, R = F.headR;
  const C = new THREE.Vector3(0, C0.y - 0.007 * (R[1] / 0.1), C0.z + 0.091 * (R[2] / 0.094));
  const k = F.body.nose ?? 1;
  const nu = seg(24, 10), nv = seg(14, 6);
  const geo = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    const w = 0.0105 * k * (0.75 + 0.35 * sstep(1, -1, dy));
    const d = 0.017 * k * (0.6 + 0.5 * sstep(1, -0.4, dy));
    p.set(C.x + dx * w, C.y + dy * 0.021 * k, C.z + dz * d + 0.004 * (1 - dy) * Math.max(0, dz));
  });
  orientOut(geo, C);
  return { geo, shade: F.shade('skin'), weights: () => [[B.head, 1]] };
}

function buildNeck(F) {
  const R = F.rig.BIND;
  const r0 = F.body.neckR ?? 0.054;
  const y0 = F.torso.y1 - 0.06, y1 = R.head.y + 0.055;
  const nu = seg(32, 10), nv = seg(10, 3);
  const geo = grid(nu, nv, (u, v, p) => {
    const y = lerp(y0, y1, v), th = u * TAU;
    const r = r0 + 0.006 * (1 - v) + (F.body.neckFlare ?? 0) * (1 - v) ** 2;
    p.set(r * Math.sin(th), y, -0.012 + r * 1.06 * Math.cos(th));
  });
  orientOut(geo, new THREE.Vector3(0, (y0 + y1) / 2, -0.012));
  const n = R.neck.y, h = R.head.y;
  const weights = (x, y) => {
    const a = sstep(n - 0.015, n + 0.045, y), b = sstep(h + 0.005, h + 0.05, y);
    return [[B.chest, 1 - a], [B.neck, a * (1 - b)], [B.head, a * b]];
  };
  return { geo, shade: F.shade(F.body.neckShade || 'skin'), weights };
}

// A fist that is a fist, never a ball (the brawler's): built in the bind
// pose, the arm hanging, the back of the hand outward (+sgn x), the palm in,
// the knuckles a row along z at the bottom. Its parts: the back of the hand
// and the curled fingers as one squared block (a superellipsoid) with a
// ridge of four knuckles along its outer bottom edge and the fingers'
// joints as a second, lower ridge on the palm side; the thumb a bent tube
// folded across the front of the curled fingers.
function buildFist(F, sgn, g) {
  const W = F.rig.BIND[sgn > 0 ? 'handL' : 'handR'];
  const k = g.s ?? 1;
  const hx = 0.029 * k, hy = 0.05 * k, hz = 0.043 * k;
  const C = new THREE.Vector3(W.x - sgn * 0.004 * k, W.y - 0.056 * k, W.z + 0.004);
  const nu = seg(40, 12), nv = seg(28, 8);
  const hb = sgn > 0 ? B.handL : B.handR;
  const e = 0.34;
  const block = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    let x = spow(dx, e) * hx, y = spow(dy, e) * hy, z = spow(dz, e) * hz;
    // narrower at the wrist, broad across the knuckles
    const toWrist = sstep(-0.2, 1, dy);
    z *= 1 - 0.2 * toWrist; x *= 1 - 0.12 * toWrist;
    // the knuckle ridge (MCP): four bumps along the outer bottom edge
    const out = sgn * dx;
    const edge = sstep(-0.1, 0.55, out) * sstep(0.25, 0.85, -dy);
    const kn = Math.pow(Math.max(0, Math.cos(TAU * (z / (0.022 * k)) - Math.PI / 2)), 1.5);
    // the second row (PIP) along the inner bottom edge, softer
    const inner = sstep(-0.1, 0.6, -out) * sstep(0.2, 0.9, -dy);
    const kn2 = Math.pow(Math.max(0, Math.cos(TAU * (z / (0.022 * k)) - Math.PI / 2)), 2);
    const bump = 0.0075 * k * edge * kn + 0.004 * k * inner * kn2;
    x += sgn * bump * 0.6 * Math.max(0, out); y -= bump;
    // the crease where the curled fingers meet the palm (a groove across the inner face)
    const crease = Math.exp(-(((dy + 0.05) / 0.12) ** 2)) * sstep(0.3, 0.8, -out);
    x += sgn * 0.003 * k * crease;
    // the fingers told apart: shallow grooves between them over the bottom
    // and the inner face (the curled fingers' side)
    const fingers = sstep(0.1, 0.7, -dy) + sstep(0.2, 0.8, -out) * (1 - sstep(0.2, 0.9, dy));
    const gr = Math.pow(Math.max(0, Math.cos(TAU * (z / (0.022 * k)))), 6) * Math.min(1, fingers) * (1 - edge);
    x += sgn * 0.0025 * k * gr * Math.max(0, out); x -= sgn * 0.0045 * k * gr * Math.max(0, -out); y += 0.004 * k * gr * Math.max(0, -dy);
    p.set(C.x + x, C.y + y, C.z + z);
  });
  orientOut(block, C);
  // the thumb: from the heel of the hand at the front (+z) edge, folded down
  // across the inner face over the curled fingers
  const xin = C.x - sgn * hx * 0.92;
  const T0 = new THREE.Vector3(xin + sgn * 0.004 * k, C.y + 0.035 * k, C.z + hz * 0.85);
  const T1 = new THREE.Vector3(xin - sgn * 0.006 * k, C.y - 0.008 * k, C.z + hz * 0.95);
  const T2 = new THREE.Vector3(xin - sgn * 0.004 * k, C.y - 0.03 * k, C.z + hz * 0.15);
  const tr = 0.0125 * k;
  const curve = new THREE.QuadraticBezierCurve3(T0, T1, T2);
  const nT = seg(18, 6), nR = seg(14, 6);
  const fr = curve.computeFrenetFrames(nT, false);
  const thumb = grid(nR, nT, (u, v, p) => {
    const i = Math.round(v * nT);
    const c = curve.getPoint(v), a = u * TAU;
    // (round ends: the tube pinches shut at both)
    const rr = tr * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, Math.max(0, v * 1.15 - 0.02)) ** 0.5)) * (1 - 0.15 * v);
    p.copy(c).addScaledVector(fr.normals[i], Math.cos(a) * rr).addScaledVector(fr.binormals[i], Math.sin(a) * rr);
  });
  orientOut(thumb, curve.getPoint(0.5));
  const shade = F.shade(g.shade || 'hand');
  return [{ geo: block, shade, weights: () => [[hb, 1]] }, { geo: thumb, shade, weights: () => [[hb, 1]] }];
}

// An open hand with fingers (the waitress's: she pours, serves, carries):
// in the bind pose, the arm hanging, the palm in (-sgn x), the back out,
// the fingers down. A flat palm, four tapered fingers bent `curl` of the
// way into the palm at their joints, a thumb from the heel of the palm
// forward and in.
function buildOpenHand(F, sgn, g) {
  const W = F.rig.BIND[sgn > 0 ? 'handL' : 'handR'];
  const k = g.s ?? 1, curl = g.curl ?? 0.4;
  const hb = sgn > 0 ? B.handL : B.handR;
  const shade = F.shade(g.shade || 'hand');
  const parts = [];
  const nu = seg(28, 10), nv = seg(18, 6);
  // the palm: a flattened superellipsoid
  const C = new THREE.Vector3(W.x - sgn * 0.002 * k, W.y - 0.048 * k, W.z + 0.004);
  const px = 0.0125 * k, py = 0.046 * k, pz = 0.04 * k;
  const palm = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    const w = 1 - 0.18 * sstep(0, 1, dy);
    p.set(C.x + spow(dx, 0.7) * px, C.y + spow(dy, 0.5) * py, C.z + spow(dz, 0.5) * pz * w);
  });
  orientOut(palm, C);
  parts.push({ geo: palm, shade, weights: () => [[hb, 1]] });
  // a finger: a tube along a polyline of three phalanges from its knuckle,
  // bending toward the palm (-sgn x)
  const tube = (pts, r0, r1) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const nT = seg(14, 6), nR = seg(10, 5);
    const fr = curve.computeFrenetFrames(nT, false);
    const geo = grid(nR, nT, (u, v, p) => {
      const i = Math.round(v * nT), c = curve.getPoint(v), a = u * TAU;
      const cap = Math.sqrt(Math.max(0, 1 - Math.max(0, (v - 0.9) / 0.1) ** 2)) * (v < 0.04 ? 0.6 + 10 * v : 1);
      const rr = (r0 + (r1 - r0) * v) * cap;
      p.copy(c).addScaledVector(fr.normals[i], Math.cos(a) * rr).addScaledVector(fr.binormals[i], Math.sin(a) * rr);
    });
    orientOut(geo, curve.getPoint(0.5));
    return geo;
  };
  const Fz = [0.027, 0.009, -0.009, -0.026], Fl = [0.07, 0.078, 0.073, 0.058];
  for (let i = 0; i < 4; i++) {
    const len = Fl[i] * k, z = C.z + Fz[i] * k;
    const pts = [new THREE.Vector3(C.x, C.y - py * 0.92, z)];
    let dir = new THREE.Vector3(0, -1, 0), at = pts[0].clone();
    const ang = [0.45, 0.8, 0.6].map((x) => x * curl * 1.35);
    const segs = [0.45, 0.3, 0.25];
    for (let j = 0; j < 3; j++) {
      // (a bend about z: the finger turns from down toward the palm side)
      dir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -sgn * ang[j]);
      at = at.clone().addScaledVector(dir, len * segs[j]);
      pts.push(at);
    }
    parts.push({ geo: tube(pts, 0.0082 * k, 0.0064 * k), shade, weights: () => [[hb, 1]] });
  }
  // the thumb: from the heel of the palm's front edge, forward and in
  const T = [new THREE.Vector3(C.x - sgn * 0.004 * k, C.y + 0.02 * k, C.z + pz * 0.8),
    new THREE.Vector3(C.x - sgn * 0.014 * k, C.y - 0.02 * k, C.z + pz * 1.25),
    new THREE.Vector3(C.x - sgn * (0.022 + 0.02 * curl) * k, C.y - 0.05 * k, C.z + pz * 1.0)];
  parts.push({ geo: tube(T, 0.0105 * k, 0.0075 * k), shade, weights: () => [[hb, 1]] });
  return parts;
}

// A hand drawn as an inker draws a far hand (round 2): never a mitten. In
// the bind pose (arm hanging, palm in toward -sgn x, back out, fingers
// down): a squared palm, the four fingers as ONE tapered block that curls
// toward the palm, cut by three knuckle lines along its back and its front
// and a row of knuckles where it leaves the palm, and a thumb from the heel
// of the palm, forward and in.
function buildBlockHand(F, sgn, g) {
  const W = F.rig.BIND[sgn > 0 ? 'handL' : 'handR'];
  const k = g.s ?? 1, curl = g.curl ?? 0.45;
  const hb = sgn > 0 ? B.handL : B.handR;
  const shade = F.shade(g.shade || 'hand');
  const w = () => [[hb, 1]];
  const parts = [];
  // the palm: a squared block, broad across the knuckles, narrower at the wrist
  const C = new THREE.Vector3(W.x - sgn * 0.002 * k, W.y - 0.044 * k, W.z + 0.003);
  const px = 0.0135 * k, py = 0.045 * k, pz = 0.041 * k;
  const palm = grid(seg(30, 10), seg(20, 8), (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    const wz = 1 - 0.2 * sstep(0, 1, dy);
    // (the knuckle row at the palm's lower back edge: four bumps)
    const zz = spow(dz, 0.4) * pz * wz;
    const kn = Math.pow(Math.max(0, Math.cos(TAU * (zz / (0.0205 * k)) - Math.PI / 2)), 2) * sstep(-0.2, -0.8, dy) * Math.max(0, sgn * dx);
    p.set(C.x + spow(dx, 0.55) * px + sgn * 0.003 * k * kn, C.y + spow(dy, 0.4) * py, C.z + zz);
  });
  orientOut(palm, C);
  parts.push({ geo: palm, shade, weights: w });
  // the fingers: one block swept down an arc that bends toward the palm
  const len = 0.078 * k, th = curl * 1.9;
  const P0 = new THREE.Vector3(C.x - sgn * 0.001 * k, C.y - py * 0.86, C.z);
  const fing = grid(seg(28, 10), seg(20, 8), (u, v, p) => {
    const a = th * v, ph = u * TAU;
    const R = th > 1e-3 ? len / th : 1e9;
    const cx = th > 1e-3 ? -sgn * R * (1 - Math.cos(a)) : 0, cy = th > 1e-3 ? -R * Math.sin(a) : -len * v;
    // (thinner and narrower toward the tips; the tip rounds shut)
    const tip = Math.sqrt(Math.max(0, 1 - Math.max(0, (v - 0.82) / 0.18) ** 2));
    const tx = 0.0112 * k * (1 - 0.22 * v) * tip, wz = 0.038 * k * (1 - 0.18 * v) * (0.72 + 0.28 * tip);
    const sx = spow(Math.cos(ph), 0.5), sz = spow(Math.sin(ph), 0.35);
    const z = sz * wz, fz = sz;
    // the three knuckle lines between the four fingers, deeper toward the
    // tips, where the fingers part
    let gr = 0;
    for (const zb of [-0.5, 0, 0.5]) gr += Math.exp(-(((fz - zb) / 0.07) ** 2));
    const x = sx * tx * (1 - (0.12 + 0.3 * v) * gr);
    // (the middle finger longest, and each tip its own round: the gaps
    // between the fingers stop short)
    const loc = ((fz + 1) * 2) % 1;
    const lz = (1 - 0.1 * fz * fz) * (0.93 + 0.07 * Math.sin(Math.PI * loc) * sstep(0.6, 1, v) + 0.07 * (1 - sstep(0.6, 1, v)));
    const bx = sgn * Math.cos(a), by = -Math.sin(a);
    p.set(P0.x + cx * lz + bx * x, P0.y + cy * lz + by * x, P0.z + z);
  }, { wrapU: true });
  orientOut(fing, P0.clone().add(new THREE.Vector3(-sgn * 0.01 * k, -len * 0.5, 0)));
  parts.push({ geo: fing, shade, weights: w });
  // the thumb
  const T = [new THREE.Vector3(C.x - sgn * 0.006 * k, C.y + 0.022 * k, C.z + pz * 0.75),
    new THREE.Vector3(C.x - sgn * 0.014 * k, C.y - 0.014 * k, C.z + pz * 1.2),
    new THREE.Vector3(C.x - sgn * (0.02 + 0.02 * curl) * k, C.y - 0.045 * k, C.z + pz * 1.05)];
  const curve = new THREE.CatmullRomCurve3(T);
  const nT = seg(14, 6), nR = seg(10, 5);
  const fr = curve.computeFrenetFrames(nT, false);
  const thumb = grid(nR, nT, (u, v, p) => {
    const i = Math.round(v * nT), c = curve.getPoint(v), a = u * TAU;
    const capE = Math.sqrt(Math.max(0, 1 - Math.max(0, (v - 0.85) / 0.15) ** 2));
    const rr = 0.0105 * k * (1 - 0.25 * v) * capE;
    p.copy(c).addScaledVector(fr.normals[i], Math.cos(a) * rr).addScaledVector(fr.binormals[i], Math.sin(a) * rr);
  });
  orientOut(thumb, curve.getPoint(0.5));
  parts.push({ geo: thumb, shade, weights: w });
  return parts;
}

// hands: a fist, fingers, or the drawn block hand (round 2; the Hood's
// mitten only when a costume asks for shape: 'glove')
function buildHand(F, sgn, g) {
  const W = F.rig.BIND[sgn > 0 ? 'handL' : 'handR'];
  const k = g.s ?? 1, fist = !!g.fist;
  if (fist && g.shape !== 'ball') return buildFist(F, sgn, g);
  if (!fist && g.fingers) return buildOpenHand(F, sgn, g);
  if (!fist && g.shape !== 'glove') return buildBlockHand(F, sgn, g);
  const C = fist ? new THREE.Vector3(W.x, W.y - 0.058 * k, W.z + 0.004) : new THREE.Vector3(W.x - sgn * 0.004, W.y - 0.075 * k, W.z + 0.006);
  const R = (fist ? [0.029, 0.045, 0.037] : [0.029, 0.08, 0.047]).map((r) => r * k);
  const nu = seg(32, 10), nv = seg(22, 8);
  const geo = grid(nu, nv, (u, v, p) => {
    const b = v * Math.PI, a = u * TAU;
    const dy = Math.cos(b), q = Math.sin(b);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    let r = 1;
    r += 0.35 * Math.exp(-(((dz - 0.8) / 0.3) ** 2) - (((dy - 0.35) / 0.35) ** 2) - (((dx + sgn * 0.2) / 0.5) ** 2));
    if (fist) r += 0.08 * Math.exp(-(((dy + 0.3) / 0.4) ** 2)) * Math.max(0, dz);   // the knuckles
    let x = dx * R[0] * r, y = dy * R[1] * r, z = dz * R[2] * r;
    if (!fist) {
      const tip = sstep(-0.2, -1, dy);
      x -= sgn * 0.01 * k * tip;
      z *= 1 - 0.18 * tip;
    }
    p.set(C.x + x, C.y + y, C.z + z);
  });
  orientOut(geo, C);
  return { geo, shade: F.shade(g.shade || 'hand'), weights: () => [[sgn > 0 ? B.handL : B.handR, 1]] };
}

// ---------------------------------------------------------------------------
// head covers, in hat-bone space (the joint on the head: rig.BIND.hat),
// then tipped by the cover's pitch. All are weighted to the hat bone (a cap
// knocked off flies as the Hood's fedora does) unless they are hair.
function coverGeo(F, fn, nu, nv, opts = {}) {
  const H = F.rig.BIND.hat, c = F.cover;
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch ?? 0.06);
  const geo = grid(seg(nu, 16), seg(nv, 6), (u, v, p) => { fn(u, v, p); p.applyQuaternion(tilt).add(H); }, opts);
  return geo;
}

// the flat cap: a soft flat crown that overhangs a short stiff peak
function buildFlatCap(F) {
  const c = F.cover, s = c.s ?? 1;
  const rows = [
    // [v-row] rx, rzF, rzB, cz, y: no band to speak of: the soft crown
    // bulges out at once and droops over the sides, wider than the head
    // (round 2: the crown's top is a flat plane that meets its side at
    // an edge - a cap with a cut, not a mushroom)
    [0.083, 0.097, 0.099, 0.0, -0.008],
    [0.095, 0.114, 0.105, 0.01, 0.004],
    [0.105, 0.132, 0.108, 0.02, 0.016],
    [0.109, 0.142, 0.107, 0.025, 0.027],
    [0.108, 0.141, 0.105, 0.026, 0.036],
    [0.1, 0.13, 0.097, 0.026, 0.042],
    [0.07, 0.09, 0.066, 0.024, 0.0455],
    [0.0, 0.0, 0.0, 0.02, 0.047],
  ];
  const crown = coverGeo(F, (u, v, p) => {
    const [rx, rzF, rzB, cz, y] = profileAt(rows, v);
    const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
    // the crown's front comes down onto the peak (the snap), the back rides
    // a little higher; a soft pleat where it gathers
    const front = Math.max(0, cs) ** 1.5;
    const yy = y - 0.026 * front * sstep(0.0, 0.035, y) + 0.004 * Math.max(0, -cs) * sstep(0.0, 0.03, y) + 0.002 * Math.sin(8 * th) * sstep(0.02, 0.04, y);
    p.set(rx * s * spow(sn, 0.9), yy * s, (cz + (cs > 0 ? rzF : rzB) * spow(cs, 0.9)) * s);
  }, 72, 22);
  orientOut(crown, F.rig.BIND.hat.clone().add(new THREE.Vector3(0, 0.03, 0.01)));
  // the peak: half a flattened ellipsoid tipped down over the brow
  const pk = c.peak ?? 0.07;
  const peak = coverGeo(F, (u, v, p) => {
    const a = u * Math.PI - Math.PI / 2, b = v * Math.PI;
    const q = Math.sin(b);
    const x = 0.1 * s * q * Math.sin(a);
    const zr = Math.cos(a);
    const z = (0.075 + pk * zr) * s * q * zr - 0.0 * s;
    let y = 0.0035 * Math.cos(b) - (c.peakDrop ?? 0.35) * Math.max(0, z - 0.06 * s) + 0.004;
    y -= 0.012 * (x / (0.1 * s)) ** 2 * sstep(0.06, 0.12, z);    // a slight curve across
    p.set(x, y, z);
  }, 36, 12, { wrapU: false });
  peak.computeVertexNormals();
  const w = () => [[B.hat, 1]];
  return [{ geo: crown, shade: F.shade('cover'), weights: w }, { geo: peak, shade: F.shade('peak'), weights: w }];
}

// the knit watch cap: a dome over the skull with a rolled cuff
function buildWatchCap(F) {
  const c = F.cover, s = c.s ?? 1;
  // a fisherman's cap: the rolled cuff a thick band over the ears' tops,
  // the knit above it short and square-shouldered
  // (round 2: the knit is square-topped, its crown folded flat with an edge)
  const prof = [[0.0, -0.012], [0.09, -0.014], [0.105, -0.006], [0.109, 0.012], [0.107, 0.03], [0.1, 0.04], [0.094, 0.043],
    [0.094, 0.055], [0.093, 0.08], [0.09, 0.096], [0.078, 0.106], [0.04, 0.11], [0.0, 0.111]];
  const geo = coverGeo(F, (u, v, p) => {
    const [r, y] = profileAt(prof, v);
    const th = u * TAU;
    const rib = 1 + 0.012 * Math.sin(40 * th) * sstep(0.035, 0.05, y) * (1 - sstep(0.09, 0.11, y));
    p.set(r * s * 0.87 * Math.sin(th) * rib, y * s, (r * s * Math.cos(th) - 0.004) * rib);
  }, 64, 28);
  orientOut(geo, F.rig.BIND.hat.clone().add(new THREE.Vector3(0, 0.05, 0)));
  const sh = F.shade('cover'), cuff = F.shade('cuff');
  return [{ geo, shade: (x, y) => (y - F.rig.BIND.hat.y < 0.041 * s ? cuff : sh), weights: () => [[B.hat, 1]] }];
}

// the cloche: a bell pulled down to the eyebrows, a short brim turned down
function buildCloche(F) {
  const c = F.cover, s = c.s ?? 1;
  const prof = [[0.0, -0.028], [0.095, -0.03], [0.118, -0.036], [0.121, -0.031], [0.108, -0.016], [0.097, 0.0], [0.097, 0.03],
    [0.094, 0.06], [0.083, 0.09], [0.062, 0.113], [0.034, 0.124], [0.0, 0.127]];
  const geo = coverGeo(F, (u, v, p) => {
    const [r, y] = profileAt(prof, v);
    const th = u * TAU, cs = Math.cos(th);
    // lower at the front (over the brow), higher behind
    const yy = y - 0.018 * Math.max(0, cs) * sstep(0.02, -0.03, y) + 0.01 * Math.max(0, -cs) * sstep(0.02, -0.03, y);
    p.set(r * s * 0.88 * Math.sin(th), yy * s, r * s * cs + 0.004);
  }, 72, 30);
  orientOut(geo, F.rig.BIND.hat.clone().add(new THREE.Vector3(0, 0.04, 0)));
  const sh = F.shade('cover'), band = F.shade('band');
  return [{ geo, shade: (x, y) => { const h = y - F.rig.BIND.hat.y; return h > -0.004 * s && h < 0.02 * s ? band : sh; }, weights: () => [[B.hat, 1]] }];
}

// the bowler: a round hard dome, a narrow brim curled up at the sides
function buildBowler(F) {
  const c = F.cover, s = c.s ?? 1, br = c.brim ?? 0.14;
  const prof = [[0.0, 0.03], [0.09, 0.0], [br - 0.02, 0.0], [br - 0.004, 0.004], [br, 0.012], [br - 0.006, 0.016], [br - 0.03, 0.009],
    [0.099, 0.012], [0.098, 0.03], [0.097, 0.06], [0.09, 0.09], [0.073, 0.113], [0.045, 0.126], [0.0, 0.131]];
  const geo = coverGeo(F, (u, v, p) => {
    const [r, y] = profileAt(prof, v);
    const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
    const brim = sstep(0.1, br, r);
    const yy = y + brim * (0.02 * sn * sn - 0.006 * Math.max(0, cs));
    p.set(r * s * (r < 0.1 ? 0.86 : lerp(0.86, 0.9, brim)) * sn, yy * s, r * s * cs);
  }, 72, 36);
  orientOut(geo, F.rig.BIND.hat.clone().add(new THREE.Vector3(0, 0.05, 0)));
  const sh = F.shade('cover'), band = F.shade('band');
  return [{ geo, shade: (x, y) => { const h = y - F.rig.BIND.hat.y; return h > 0.012 * s && h < 0.03 * s ? band : sh; }, weights: () => [[B.hat, 1]] }];
}

// the cook's folded paper cap: a boat along the head, a crisp ridge
function buildPaperCap(F) {
  const c = F.cover, s = c.s ?? 1;
  const L = 0.13 * s, W = 0.085 * s, Hh = (c.h ?? 0.11) * s;
  const geo = coverGeo(F, (u, v, p) => {
    // u around the band, v up to the ridge; the sides pinch to the ridge
    const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
    const y = v * Hh * (0.8 + 0.2 * (1 - Math.abs(cs)) ** 0.5) - 0.01 * s;
    const pinch = 1 - Math.pow(v, 1.4) * 0.97;
    const ends = 1 - 0.18 * Math.pow(v, 2);
    p.set(W * sn * pinch, y, L * cs * ends);
  }, 64, 18);
  orientOut(geo, F.rig.BIND.hat.clone().add(new THREE.Vector3(0, 0.04, 0)));
  return [{ geo, shade: F.shade('cover'), weights: () => [[B.hat, 1]] }];
}

// hair pinned up: a mass over the skull, fuller behind, a knot on the
// crown; one curl falls forward over the brow; a small cap on top
function buildPinnedHair(F) {
  const C = F.headC, R = F.headR, c = F.cover;
  const parts = [];
  const hair = grid(seg(64, 16), seg(34, 10), (u, v, p) => {
    const bb = v * Math.PI * 0.62, a = u * TAU;
    const dy = Math.cos(bb), q = Math.sin(bb);
    const dx = q * Math.sin(a), dz = q * Math.cos(a);
    let r = 1.1 + 0.06 * Math.max(0, -dz) + 0.05 * Math.max(0, dy - 0.3);
    // the roll at the front hairline, the fullness over the ears
    r += 0.07 * Math.exp(-(((dy - 0.45) / 0.18) ** 2)) * Math.max(0, dz);
    r += 0.03 * Math.sin(9 * a + 4 * bb) * sstep(0.2, 0.6, q);
    p.set(C.x + dx * R[0] * r * 1.06, C.y + dy * R[1] * r + 0.004, C.z + dz * R[2] * r - 0.006);
  });
  orientOut(hair, C);
  parts.push({ geo: hair, shade: F.shade('hair'), weights: () => [[B.head, 1]] });
  // the knot, high at the back
  const kc = new THREE.Vector3(C.x, C.y + R[1] * 0.78, C.z - R[2] * 0.78);
  const knot = grid(seg(28, 10), seg(16, 6), (u, v, p) => {
    const bb = v * Math.PI, a = u * TAU;
    const rr = 0.046 * (1 + 0.1 * Math.sin(5 * a + 3 * bb));
    p.set(kc.x + rr * Math.sin(bb) * Math.sin(a), kc.y + rr * 0.8 * Math.cos(bb), kc.z + rr * 0.9 * Math.sin(bb) * Math.cos(a));
  });
  orientOut(knot, kc);
  parts.push({ geo: knot, shade: F.shade('hair'), weights: () => [[B.head, 1]] });
  // the curl: a tapering tube falling from the hairline over one eye
  const curl = new THREE.CatmullRomCurve3([
    new THREE.Vector3(C.x + 0.03, C.y + R[1] * 0.72, C.z + R[2] * 0.8),
    new THREE.Vector3(C.x + 0.036, C.y + R[1] * 0.45, C.z + R[2] * 1.12),
    new THREE.Vector3(C.x + 0.03, C.y + R[1] * 0.12, C.z + R[2] * 1.2),
    new THREE.Vector3(C.x + 0.018, C.y - R[1] * 0.08, C.z + R[2] * 1.12),
    new THREE.Vector3(C.x + 0.026, C.y - R[1] * 0.16, C.z + R[2] * 1.02),
  ]);
  const cg = grid(seg(14, 6), seg(30, 10), (u, v, p) => {
    const P = curl.getPoint(v), T = curl.getTangent(v);
    const N = new THREE.Vector3(1, 0, 0).addScaledVector(T, -T.x).normalize(), Bn = new THREE.Vector3().crossVectors(T, N);
    const r = 0.013 * (1 - 0.75 * v) * (1 + 0.2 * Math.sin(v * 9));
    const a = u * TAU;
    p.copy(P).addScaledVector(N, r * Math.cos(a) * 1.4).addScaledVector(Bn, r * Math.sin(a));
  });
  cg.computeVertexNormals();
  parts.push({ geo: cg, shade: F.shade('hair'), weights: () => [[B.head, 1]] });
  // the cap: a small starched band perched forward on the crown
  if (c.cap !== false) {
    const cc = new THREE.Vector3(C.x, C.y + R[1] * 1.02, C.z + R[2] * 0.12);
    const cap = grid(seg(40, 12), seg(10, 4), (u, v, p) => {
      const a = u * Math.PI * 1.1 - Math.PI * 0.55;
      const rx = 0.068, rz = 0.05;
      const h = lerp(0, 0.038, v) * (0.7 + 0.3 * Math.cos(a));
      const tip = 1 + 0.08 * v;
      p.set(cc.x + rx * tip * Math.sin(a), cc.y + h - 0.012 * Math.sin(a) ** 2, cc.z + rz * tip * Math.cos(a) + 0.012 * v);
    }, { wrapU: false });
    cap.computeVertexNormals();
    parts.push({ geo: cap, shade: F.shade('cover'), weights: () => [[B.head, 1]] });
  }
  return parts;
}

// ---------------------------------------------------------------------------
// extras
// the apron: a bib on the chest and a panel down the front of the skirt,
// white, tied behind (the straps and the ties are painted on the dress; the
// bow is its own small shape)
function buildApron(F, g) {
  const T = F.torso, sk = F.skirt;
  const parts = [];
  const waist = g.waist ?? 1.02, bibTop = g.bibTop ?? 1.34, hem = g.hem ?? 0.6;
  const shade = F.shade('apron');
  // bib
  const bib = grid(seg(24, 8), seg(20, 6), (u, v, p) => {
    const y = lerp(waist - 0.09, bibTop, v);
    const half = lerp(0.62, 0.42, sstep(0, 1, v));
    const th = (u * 2 - 1) * half;
    T.point(th, y, p, 0.007 + 0.002 * Math.sin(Math.PI * u));
  }, { wrapU: false });
  orientOut(bib, new THREE.Vector3(0, 1.2, -0.05));
  parts.push({ geo: bib, shade, weights: (x, y) => torsoWeights(F, x, y) });
  // skirt panel: over the dress's skirt surface
  if (sk) {
    const nrm = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const vHem = clamp((sk.y0 - hem) / (sk.y0 - sk.hem), 0.05, 1);
    const panel = grid(seg(40, 12), seg(24, 8), (u, v, p) => {
      const span = g.span ?? 0.3;
      const uu = lerp(0.5 - span * lerp(0.85, 1, v), 0.5 + span * lerp(0.85, 1, v), u);
      const vv = v * vHem;
      // (u of the skirt: 0 and 1 are the front centre of a closed skirt,
      // so the panel is centred on u = 0.5 of a shifted frame)
      const U = (uu + 0.5) % 1;
      sk.frame.point(U, vv, p);
      sk.frame.point(U + 0.004, vv, a); sk.frame.point(U, Math.min(1, vv + 0.01), b);
      nrm.crossVectors(a.sub(p), b.sub(p)).normalize();
      if (nrm.z < 0) nrm.negate();
      p.addScaledVector(nrm, 0.008 + 0.003 * v);
    }, { wrapU: false });
    orientOut(panel, new THREE.Vector3(0, 0.8, -0.1));
    const ws = sk.frame.weights;
    parts.push({ geo: panel, shade, weights: (x, y, z, u, v) => {
      const span = g.span ?? 0.3;
      const uu = lerp(0.5 - span, 0.5 + span, u);
      return ws(x, y, z, (uu + 0.5) % 1, v * vHem);
    } });
  }
  // the bow at the small of the back: two loops and two tails
  const bc = T.point(Math.PI, waist, new THREE.Vector3(), 0.012);
  for (const s of [1, -1]) {
    const loop = grid(seg(12, 6), seg(18, 6), (u, v, p) => {
      const a = v * TAU, q = u * TAU;
      const R0 = 0.032, r = 0.007;
      const cx = bc.x + s * (0.03 + R0 * Math.cos(a) * 0.9), cy = bc.y + 0.012 + R0 * 0.55 * Math.sin(a);
      p.set(cx + r * Math.cos(q) * Math.cos(a) * s, cy + r * Math.cos(q) * Math.sin(a), bc.z - 0.01 - r * Math.sin(q) - 0.01 * (1 - Math.cos(a)));
    });
    loop.computeVertexNormals();
    parts.push({ geo: loop, shade, weights: () => [[B.hips, 1]] });
    const tail = grid(seg(4, 3), seg(12, 4), (u, v, p) => {
      p.set(bc.x + s * (0.012 + 0.04 * v) + (u - 0.5) * 0.024, bc.y - 0.005 - 0.2 * v, bc.z - 0.018 - 0.02 * v);
    }, { wrapU: false });
    tail.computeVertexNormals();
    parts.push({ geo: tail, shade, weights: (x, y) => [[B.hips, 1 - sstep(0.92, 0.8, y) * 0.5], [B.coat, sstep(0.92, 0.8, y) * 0.5]] });
  }
  return parts;
}

// a ribbon lying on the torso: a strap, a tie. path: [[x, y]] on the front
// (side 1) or the back (side -1) of the torso; w its width
function torsoTheta(T, x, y, side) {
  const [rx, , , , n] = T.S(Math.min(T.y1, Math.max(T.y0, y)));
  const s = Math.sign(x) * Math.min(1, Math.pow(Math.abs(x) / rx, n / 2));
  const a = Math.asin(s);
  return side > 0 ? a : Math.sign(x || 1) * Math.PI - a;
}
function buildRibbon(F, g) {
  const T = F.torso, path = g.path, w = g.w ?? 0.024, side = g.side ?? 1;
  const nv = seg(g.n ?? 16, 6);
  const geo = grid(2, nv, (u, v, p) => {
    const f = v * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), t = f - i;
    const x = path[i][0] + (path[i + 1][0] - path[i][0]) * t, y = path[i][1] + (path[i + 1][1] - path[i][1]) * t;
    const th = torsoTheta(T, x + (u - 0.5) * w, y, side);
    T.point(th, y, p, g.grow ?? 0.01);
  }, { wrapU: false });
  geo.computeVertexNormals();
  return { geo, shade: F.shade(g.shade || 'apron'), weights: (x, y) => torsoWeights(F, x, y) };
}

// the old man's broadsheet is not skinned: see Figure.js (a mesh in his hands)

// ---------------------------------------------------------------------------
const GEO_CACHE = new Map();

// shade lookup: the costume's skin table, then defaults
const DEFAULT_SKIN = {
  coat: 0.014, collar: 0.013, lapel: 0.013, belt: 0.005, cover: 0.007, band: 0.002, peak: 0.006, cuff: 0.01,
  skin: 0.024, hair: 0.004, trousers: 0.006, shoes: 0.004, hand: 0.024, arm: 0.024, shirt: 0.13, tie: 0.004,
  stocking: 0.008, apron: 0.5, vest: 0.008,
};

export function figureGeometry(costume, lod = 0) {
  const key = costume.name + '_' + lod;
  if (GEO_CACHE.has(key)) return GEO_CACHE.get(key);
  Q = LOD_Q[lod];
  const near = lod < 2;
  const skin = { ...DEFAULT_SKIN, ...(costume.skin || {}) };
  const F = {
    costume, body: costume.body, cover: costume.cover || {}, lod, near,
    rig: figureRig(costume),
    shade: (k) => (typeof k === 'number' ? k : skin[k] ?? 0.014),
  };
  F.torso = torsoOf(F);
  const parts = [];
  for (const g of costume.garments) {
    if (g.near && !near) continue;
    switch (g.kind) {
      case 'torso': parts.push(buildTorso(F, g)); break;
      case 'shell': parts.push(buildShell(F, g)); break;
      case 'skirt': {
        const p = buildSkirt(F, g);
        F.skirt = { y0: g.y0, hem: g.hem, frame: skirtFrame(F, g) };
        parts.push(p);
        break;
      }
      case 'collar': parts.push(buildCollar(F, g)); break;
      case 'lapels': parts.push(buildLapel(F, 1, g), buildLapel(F, -1, g)); break;
      case 'sleeves': parts.push(buildSleeve(F, 1, g), buildSleeve(F, -1, g)); break;
      case 'arms': parts.push(buildBareArm(F, 1, g), buildBareArm(F, -1, g)); break;
      case 'legs': parts.push(buildLeg(F, 1, g), buildLeg(F, -1, g)); break;
      case 'shoes': parts.push(...buildShoe(F, 1, g), ...buildShoe(F, -1, g)); break;
      case 'hands': parts.push(...[buildHand(F, 1, { ...g, fist: g.fistL ?? g.fist }), buildHand(F, -1, { ...g, fist: g.fistR ?? g.fist })].flat()); break;
      case 'apron': parts.push(...buildApron(F, g)); break;
      case 'ribbon': parts.push(buildRibbon(F, g)); break;
      case 'custom': parts.push(...g.build(F, { grid, orientOut, torsoWeights, B, seg, sstep, lerp })); break;
      default: throw new Error(`tailor: no garment '${g.kind}'`);
    }
  }
  parts.push(buildHead(F));
  if (near && costume.body.nose !== 0) parts.push(buildNose(F));
  parts.push(buildNeck(F));
  const cv = F.cover.kind;
  if (cv === 'flatcap') parts.push(...buildFlatCap(F));
  else if (cv === 'watchcap') parts.push(...buildWatchCap(F));
  else if (cv === 'cloche') parts.push(...buildCloche(F));
  else if (cv === 'bowler') parts.push(...buildBowler(F));
  else if (cv === 'papercap') parts.push(...buildPaperCap(F));
  else if (cv === 'pinned') parts.push(...buildPinnedHair(F));
  const geo = assemble(parts);
  Q = 1;
  geo.computeBoundingBox();
  geo.userData.top = geo.boundingBox.max.y;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.4);
  GEO_CACHE.set(key, geo);
  return geo;
}

export { sstep, lerp, clamp, bump, torsoOf };
