import * as THREE from 'three';
import { PM, lathe, flutedLathe, slab, boxUV, tubeAlong, handleArc, flatPoly, uvRect, planarUV, mergeGeos, smooth, AT, V3, V2, hash } from './lib.js';
import { makeLiquid } from './liquid.js';
import { accentMaterial } from '../render/accents.js';
// [B1] the matchbook's back, torn across the bird (scene 3: the half that tore off)
import { tornBack, birdMaterial, edgeMaterial } from './kinds/body.js';

// The prop kinds (docs/story/CONTRACTS.md §8.1), each a function of
// (variant, lod) returning a spec:
//   parts   [{ geo, mat, id (the prop's own ink id index), name?, cast?, parent? }]
//   grip    [x, y, z] (or a Matrix4): where the palm holds it
//   rest    Matrix4 (how it lies on a surface; identity: it stands)
//   accent  the registry key it carries, if any
//   init(group, ud, byName)   the kind's own behaviour: setFill, setTilt,
//                             setOpen, setTip, tick ...
// Every size is in metres, the origin the middle of the base, +y up, the
// front (a label, a face) toward +z. Smooth: lathes and bevels; lod 1 halves
// the segments (props far off, or many of one kind).
const S = (lod, n) => Math.max(8, Math.round(n / (lod ? 2 : 1)));
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

// a liquid's surface level while its vessel is turned by the world
// quaternion q (the world's up seen from the vessel)
function upIn(q) { return _up.set(0, 1, 0).applyQuaternion(_q.copy(q).invert()).clone(); }

// a lighter's flame: a tongue of two shells (an outer, a hotter core) in
// the registry's flame accent; hidden until lit
function flameGroup(inkId) {
  const g = new THREE.Group();
  g.name = 'flame';
  const prof = [[0.0001, 0], [0.0032, 0.0018], [0.005, 0.0075], [0.0046, 0.015], [0.0027, 0.023], [0.0009, 0.029], [0.0001, 0.032]];
  const geo = lathe(prof, 16);
  const outer = new THREE.Mesh(geo, accentMaterial('flame', { gain: 1 }));
  const core = new THREE.Mesh(geo, accentMaterial('flame', { gain: 2.2 }));
  core.scale.set(0.5, 0.62, 0.5);
  core.position.y = 0.0012;
  for (const m of [outer, core]) { m.castShadow = false; m.userData.noRay = true; m.userData.inkId = inkId; g.add(m); }
  g.visible = false;
  g.userData.gain = 1;
  g.setGain = (k) => { g.userData.gain = k; outer.material.userData.setGain(k); core.material.userData.setGain(2.2 * k); };
  return g;
}

// a handle (a torus arc) on the +x side of a cup / mug
function sideHandle(R, r, cx, cy, lod, open = 1.15) {
  const g = handleArc(R, r, -open, open, S(lod, 28), S(lod, 10));
  g.translate(cx, cy, 0);
  return g;
}

export const SPECS = {
  // ---- glass ----------------------------------------------------------------------
  // 8.5 cm tall, 7.5 across, a 1.4 cm base, a straight wall with ten shallow
  // cut flutes round its lower half; the scotch is a mesh of its own
  // (accent amber) filled to 40 % of the height (a double)
  tumbler(v, lod) {
    const P = PM();
    const H = 0.085, R = 0.0375, base = 0.014, wall = 0.0026;
    const prof = [
      [0.0001, 0], [0.031, 0], [0.034, 0.0006], [0.0362, 0.002], [R, 0.005], [R, 0.02], [R, 0.035], [R, 0.045], [R, 0.06], [R, 0.075], [R, H - 0.0012],
      [R - 0.0008, H], [R - wall + 0.0005, H - 0.0004], [R - wall, H - 0.0016], [R - wall, 0.05], [R - wall, base + 0.004], [R - wall - 0.002, base], [0.0001, base],
    ];
    const outerRows = 10;
    const geo = flutedLathe(prof, { segs: S(lod, 80), count: 10, depth: (y, i) => (i <= outerRows && y > 0.004 && y < 0.047 ? 0.0011 * Math.min(1, (0.047 - y) / 0.006) * Math.min(1, (y - 0.004) / 0.003) : 0) });
    const inner = [[R - wall - 0.002, base], [R - wall, base + 0.004], [R - wall, H]];
    const liq = makeLiquid(inner, { y0: base, yFull: H * 0.4, mat: P.amber, segs: S(lod, 40) });
    // a white tick where the rim catches the light (fix round A5)
    const rimTick = new THREE.TorusGeometry(R - 0.0009, 0.00075, 4, S(lod, 10), 0.75).rotateX(Math.PI / 2).rotateY(0.35).translate(0, H - 0.0004, 0);
    // (round 2: the thick base reads as glass by its two dark ellipses - the
    // foot's edge and the floor of the well a centimetre and a half above
    // it - drawn as ink lines lying on the glass, as an inker draws them)
    const baseRings = mergeGeos([
      new THREE.TorusGeometry(R + 0.0002, 0.0007, 4, S(lod, 40)).rotateX(Math.PI / 2).translate(0, 0.0035, 0),
      new THREE.TorusGeometry(R - wall - 0.0012, 0.0006, 4, S(lod, 40)).rotateX(Math.PI / 2).translate(0, base + 0.0006, 0),
    ]);
    return {
      parts: [{ geo, mat: P.amberGlass, id: 0, name: 'glass' }, { mesh: liq.mesh, id: 1 }, { geo: rimTick, mat: P.tick, id: 0, cast: false },
        { geo: baseRings, mat: P.black, id: 0, cast: false, name: 'baseLines' }],
      grip: [0, 0.042, 0], accent: 'amber',
      init(g, ud) {
        ud.fill = 1;
        ud.setFill = (f) => { ud.fill = Math.max(0, Math.min(1, f)); liq.set(ud.fill); };
        ud.setTilt = (q) => { ud.tilt = q ? q.clone() : null; liq.set(ud.fill, q ? upIn(q) : _up.set(0, 1, 0)); };
        ud.ripple = (k, dt) => liq.ripple(k, dt);
        ud.liquid = liq;
      },
    };
  },

  // bottles: scotch (squat-shouldered, 28 cm, a paper label, a cork, amber to
  // its fill line), rye, gin (square shouldered, clear), beer (brown, long
  // neck), ketchup, milk
  bottle(v, lod) {
    const P = PM();
    const seg = S(lod, 44);
    const shapes = {
      scotch: { r: 0.046, h: 0.28, sh: 0.165, neck: 0.0135, glass: P.amberGlass, liquid: P.amber, label: AT.scotch, labelY: [0.05, 0.13], cork: true, tick: true },
      rye: { r: 0.04, h: 0.3, sh: 0.18, neck: 0.013, glass: P.bottleDark, label: AT.rye, labelY: [0.06, 0.13], cork: true },
      gin: { r: 0.041, h: 0.29, sh: 0.2, neck: 0.014, glass: P.glassThick, label: AT.gin, labelY: [0.07, 0.14], square: true },
      beer: { r: 0.031, h: 0.235, sh: 0.12, neck: 0.012, glass: P.bottleDark, label: AT.rye, labelY: [0.04, 0.09], cap: true, longNeck: true },
      ketchup: { r: 0.03, h: 0.205, sh: 0.1, neck: 0.013, glass: P.dark, label: AT.ketchup, labelY: [0.03, 0.08], cap: true, longNeck: true },
      milk: { r: 0.042, h: 0.225, sh: 0.13, neck: 0.024, glass: P.china, label: AT.milk, labelY: [0.05, 0.1], cap: true },
    };
    const B = shapes[v] || shapes.scotch;
    const { r, h, sh, neck } = B;
    // the outline: a rounded heel, the body, the shoulder (squat for scotch,
    // a long taper for the beer), the neck, the lip
    const lipY = h - (B.cork ? 0.022 : 0.006);
    const prof = [[0.0001, 0], [r * 0.8, 0], [r * 0.95, 0.003], [r, 0.012], [r, sh * 0.5], [r, sh]];
    if (B.longNeck) prof.push([r * 0.9, sh + 0.02], [r * 0.6, sh + 0.045], [neck * 1.15, sh + 0.075], [neck, lipY - 0.02]);
    else prof.push([r * 0.96, sh + 0.012], [r * 0.78, sh + 0.026], [r * 0.45, sh + 0.036], [neck * 1.2, sh + 0.046], [neck, sh + 0.056], [neck, lipY - 0.012]);
    prof.push([neck * 1.22, lipY - 0.008], [neck * 1.22, lipY - 0.002], [neck * 1.05, lipY], [0.0001, lipY]);
    let geo = lathe(prof, seg);
    if (B.square) {
      // (a square-shouldered gin bottle: the body squared off, corners round)
      const p = geo.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
        const rr = Math.hypot(x, z);
        if (rr < 1e-5 || y > sh + 0.03) continue;
        const a = Math.atan2(z, x);
        const sq = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
        const k = Math.pow(sq, 0.8) * 0.9;
        const blend = y > sh ? 1 - (y - sh) / 0.03 : 1;
        const f = 1 + (k - 1) * blend;
        p.setXYZ(i, x * f, y, z * f);
      }
      geo = smooth(geo);
    }
    const parts = [{ geo, mat: B.glass, id: 0, name: 'glass' }];
    if (B.tick) {
      // one long white highlight down the shoulder and the body's edge
      // (fix round A5: glass reads as glass by its highlight), a hair proud
      // of the glass on the side toward the light, clear of the label
      const a = 0.62, off = 0.0009;
      const at = (rr, y) => new THREE.Vector3(Math.sin(a) * (rr + off), y, Math.cos(a) * (rr + off));
      const pts = [at(neck * 1.2, sh + 0.046), at(r * 0.45, sh + 0.036), at(r * 0.78, sh + 0.026), at(r * 0.96, sh + 0.012), at(r, sh - 0.004), at(r, B.labelY[1] + 0.012)];
      parts.push({ geo: tubeAlong(pts, 0.0011, 5, 40), mat: P.tick, id: 0, cast: false });
    }
    // the label: a band just proud of the body, facing +z
    const [ly0, ly1] = B.labelY;
    const arc = B.square ? 1.3 : 2.1;
    const lr = B.square ? r * 0.92 : r + 0.0006;
    const lab = new THREE.CylinderGeometry(lr, lr, ly1 - ly0, S(lod, 24), 1, true, -arc / 2, arc).translate(0, (ly0 + ly1) / 2, 0);
    if (B.square) lab.scale(1, 1, 1.02).translate(0, 0, 0.0);
    uvRect(lab, B.label);
    parts.push({ geo: lab, mat: B.tick ? P.label : P.atlas, id: 1, name: 'label' });
    // (round 2: a back label too, smaller, so the bottle turned in a hand
    // still shows paper on the side toward the eye)
    if (B.tick) {
      const back = new THREE.CylinderGeometry(lr, lr, (ly1 - ly0) * 0.7, S(lod, 18), 1, true, Math.PI - arc * 0.3, arc * 0.6).translate(0, (ly0 + ly1) / 2 - 0.005, 0);
      uvRect(back, B.label);
      parts.push({ geo: back, mat: P.label, id: 1, name: 'labelBack' });
    }
    if (B.cork) {
      const ck = lathe([[0.0001, lipY - 0.004], [neck * 0.95, lipY - 0.004], [neck * 1.02, lipY + 0.004], [neck * 1.2, lipY + 0.006], [neck * 1.25, h - 0.004], [neck * 1.1, h], [0.0001, h]], S(lod, 20));
      parts.push({ geo: ck, mat: P.cork, id: 2, name: 'cork' });
    }
    if (B.cap) {
      const cp = lathe([[0.0001, lipY - 0.004], [neck * 1.3, lipY - 0.004], [neck * 1.32, lipY + 0.006], [neck * 1.15, lipY + 0.008], [0.0001, lipY + 0.008]], S(lod, 20));
      parts.push({ geo: cp, mat: P.metal, id: 2, name: 'cap' });
    }
    let liq = null;
    if (B.liquid) {
      const inner = [[r - 0.004, 0.006], [r - 0.004, sh], [r * 0.7, sh + 0.024], [neck - 0.002, sh + 0.05], [neck - 0.002, lipY - 0.01]];
      liq = makeLiquid(inner, { y0: 0.006, yFull: sh * 0.95, mat: B.liquid, segs: S(lod, 36), meniscus: P.amberLine });
      parts.push({ mesh: liq.mesh, id: 3 });
    }
    return {
      parts, grip: [0, h - 0.08, 0], accent: B.liquid ? 'amber' : null,
      init(g, ud) {
        ud.neck = new THREE.Vector3(0, lipY, 0);   // where the stream leaves it
        // (round 2) the mouth: the centre of the lip's opening, in the
        // bottle's own frame (with the cork drawn, the stream leaves here);
        // mouthR its radius, mouthAxis the way out of it
        ud.mouth = new THREE.Vector3(0, lipY, 0);
        ud.mouthR = neck;
        ud.mouthAxis = new THREE.Vector3(0, 1, 0);
        if (!liq) return;
        if (liq.ring) liq.ring.userData.inkId = ud.inkId + 3;
        ud.fill = 1;
        ud.setFill = (f) => { ud.fill = Math.max(0, Math.min(1, f)); liq.set(ud.fill); };
        ud.setTilt = (q) => { ud.tilt = q ? q.clone() : null; liq.set(ud.fill, q ? upIn(q) : _up.set(0, 1, 0)); };
        ud.ripple = (k, dt) => liq.ripple(k, dt);
        ud.liquid = liq;
      },
    };
  },
  ketchup: (v, lod) => SPECS.bottle('ketchup', lod),

  // ---- china ----------------------------------------------------------------------
  plate(v, lod) {
    const P = PM();
    const prof = [[0.0001, 0.001], [0.07, 0.001], [0.074, 0], [0.078, 0.002], [0.083, 0.006], [0.11, 0.013], [0.119, 0.016], [0.1205, 0.0185], [0.118, 0.0195], [0.108, 0.0165], [0.082, 0.009], [0.075, 0.0065], [0.0001, 0.0065]];
    return { parts: [{ geo: lathe(prof, S(lod, 64)), mat: P.china, id: 0 }], grip: [0.11, 0.012, 0] };
  },
  saucer(v, lod) {
    const P = PM();
    const prof = [[0.0001, 0.001], [0.042, 0.001], [0.045, 0], [0.049, 0.003], [0.064, 0.012], [0.0705, 0.0145], [0.0695, 0.0158], [0.062, 0.0135], [0.046, 0.0065], [0.03, 0.0048], [0.029, 0.0062], [0.0001, 0.0062]];
    return { parts: [{ geo: lathe(prof, S(lod, 56)), mat: P.china, id: 0 }], grip: [0.065, 0.01, 0] };
  },
  cup(v, lod) {
    const P = PM();
    const prof = [[0.0001, 0.0005], [0.022, 0.0005], [0.024, 0], [0.026, 0.004], [0.036, 0.018], [0.042, 0.04], [0.0435, 0.062], [0.0438, 0.069], [0.0425, 0.07], [0.0408, 0.066], [0.0395, 0.042], [0.033, 0.018], [0.022, 0.0075], [0.0001, 0.007]];
    const inner = [[0.022, 0.0075], [0.033, 0.018], [0.0395, 0.042], [0.0408, 0.066]];
    const liq = makeLiquid(inner, { y0: 0.0075, yFull: 0.058, mat: PM().coffee, segs: S(lod, 36), rows: 3 });
    return {
      parts: [
        { geo: lathe(prof, S(lod, 56)), mat: P.china, id: 0 },
        { geo: sideHandle(0.017, 0.0042, 0.049, 0.043, lod, 1.35), mat: P.china, id: 0 },
        { mesh: liq.mesh, id: 1 },
      ],
      grip: [0.062, 0.042, 0],
      init(g, ud) { ud.fill = 1; ud.setFill = (f) => { ud.fill = f; liq.set(f); }; ud.setTilt = (q) => liq.set(ud.fill, q ? upIn(q) : _up.set(0, 1, 0)); ud.ripple = (k, dt) => liq.ripple(k, dt); ud.liquid = liq; },
    };
  },
  // the heavy diner mug: thick walls, a D handle
  mug(v, lod) {
    const P = PM();
    const prof = [[0.0001, 0.001], [0.036, 0.001], [0.039, 0], [0.0415, 0.004], [0.0425, 0.02], [0.043, 0.07], [0.0428, 0.092], [0.0418, 0.0955], [0.0395, 0.0955], [0.0372, 0.092], [0.0365, 0.02], [0.034, 0.012], [0.0001, 0.012]];
    const inner = [[0.034, 0.012], [0.0365, 0.02], [0.0372, 0.09]];
    const liq = makeLiquid(inner, { y0: 0.012, yFull: 0.08, mat: P.coffee, segs: S(lod, 36), rows: 3 });
    const hg = tubeAlong([V3(0.041, 0.078, 0), V3(0.058, 0.08, 0), V3(0.067, 0.066, 0), V3(0.067, 0.036, 0), V3(0.058, 0.021, 0), V3(0.041, 0.02, 0)], 0.0065, S(lod, 12), S(lod, 40));
    return {
      parts: [{ geo: lathe(prof, S(lod, 56)), mat: P.china, id: 0 }, { geo: hg, mat: P.china, id: 0 }, { mesh: liq.mesh, id: 1 }],
      grip: [0.07, 0.05, 0],
      init(g, ud) { ud.fill = 1; ud.setFill = (f) => { ud.fill = f; liq.set(f); }; ud.setTilt = (q) => liq.set(ud.fill, q ? upIn(q) : _up.set(0, 1, 0)); ud.ripple = (k, dt) => liq.ripple(k, dt); ud.liquid = liq; },
    };
  },
  // a glass globe coffee pot: the globe, a dark band at its neck with the
  // handle, a lid with a knob; the coffee near black inside
  coffeePot(v, lod) {
    const P = PM();
    const seg = S(lod, 48);
    const glob = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, a = -Math.PI / 2 + t * Math.PI * 0.86;
      glob.push([0.078 * Math.cos(a) + 0.0001, 0.075 + 0.075 * Math.sin(a)]);
    }
    glob[0] = [0.03, 0.0];
    glob.push([0.047, 0.16]);
    const band = lathe([[0.046, 0.152], [0.052, 0.155], [0.053, 0.19], [0.05, 0.196], [0.042, 0.198], [0.041, 0.21], [0.02, 0.216], [0.012, 0.222], [0.013, 0.232], [0.0001, 0.234]], seg);
    const handle = tubeAlong([V3(0.052, 0.186, 0), V3(0.078, 0.19, 0), V3(0.094, 0.168, 0), V3(0.094, 0.12, 0), V3(0.084, 0.098, 0)], 0.008, S(lod, 12), S(lod, 36));
    const inner = [[0.03, 0.004], [0.06, 0.02], [0.074, 0.05], [0.077, 0.08], [0.07, 0.11], [0.05, 0.14]];
    const liq = makeLiquid(inner, { y0: 0.004, yFull: 0.12, mat: P.coffee, segs: S(lod, 36), rows: 6 });
    liq.set(0.7);
    return {
      parts: [
        { geo: lathe(glob, seg), mat: P.glass, id: 0, name: 'glass' },
        { geo: band, mat: P.black, id: 1 },
        { geo: handle, mat: P.black, id: 1 },
        { mesh: liq.mesh, id: 2 },
      ],
      grip: [0.094, 0.15, 0],
      init(g, ud) { ud.fill = 0.7; ud.setFill = (f) => { ud.fill = f; liq.set(f); }; ud.setTilt = (q) => liq.set(ud.fill, q ? upIn(q) : _up.set(0, 1, 0)); ud.ripple = (k, dt) => liq.ripple(k, dt); ud.liquid = liq; ud.spout = new THREE.Vector3(-0.05, 0.18, 0); },
    };
  },
  // a pie in its tin, a slice gone: a lattice-free top with three vents
  pie(v, lod) {
    const P = PM();
    const gap = Math.PI / 3.2, seg = S(lod, 56);
    const tin = lathe([[0.0001, 0], [0.095, 0], [0.098, 0.003], [0.112, 0.03], [0.118, 0.032], [0.117, 0.034], [0.11, 0.032], [0.095, 0.004], [0.0001, 0.004]], seg);
    const phi0 = gap / 2, len = Math.PI * 2 - gap;
    const top = lathe([[0.121, 0.03], [0.124, 0.036], [0.121, 0.043], [0.112, 0.046], [0.09, 0.047], [0.05, 0.05], [0.0001, 0.051]], seg, phi0, len);
    const fill = lathe([[0.0001, 0.004], [0.095, 0.004], [0.11, 0.03], [0.112, 0.042]], seg, phi0, len);
    // the two cut faces of the missing slice: filling in the middle, a
    // crust edge on top
    const cut = (a) => {
      const pts = [[0, 0.004], [0.095, 0.004], [0.111, 0.03], [0.112, 0.044], [0.09, 0.046], [0.05, 0.049], [0, 0.05]];
      const s = new THREE.Shape(pts.map(([x, y]) => V2(x, y)));
      const g = new THREE.ShapeGeometry(s);
      g.rotateY(-a + Math.PI / 2);
      return g;
    };
    const c1 = cut(phi0), c2 = cut(phi0 + len); c2.scale(1, 1, 1);
    // flip the second face so it faces out of the gap
    c2.index && c2.index.array.reverse();
    const vents = [];
    for (let k = 0; k < 3; k++) {
      const a = phi0 + len * (0.25 + k * 0.25);
      const g = new THREE.CapsuleGeometry(0.0022, 0.018, 3, 8).rotateZ(Math.PI / 2).rotateY(a + Math.PI / 2).translate(Math.sin(a) * 0.05, 0.0495, Math.cos(a) * 0.05);
      vents.push(g);
    }
    return {
      parts: [
        { geo: tin, mat: P.metal, id: 0 },
        { geo: top, mat: P.crust, id: 1 },
        { geo: fill, mat: P.food, id: 1 },
        { geo: mergeGeos([c1, c2]), mat: P.food, id: 1, side: THREE.DoubleSide },
        { geo: mergeGeos(vents), mat: P.black, id: 1, cast: false },
      ],
      grip: [0.11, 0.02, 0],
    };
  },
  // a cut-glass ashtray: a heavy round with flutes on its wall, three rests
  // in the rim, two butts and some ash in the well
  ashtray(v, lod) {
    const P = PM();
    const prof = [[0.0001, 0], [0.05, 0], [0.054, 0.004], [0.056, 0.02], [0.055, 0.028], [0.051, 0.03], [0.046, 0.028], [0.041, 0.013], [0.0001, 0.012]];
    let geo = flutedLathe(prof, { segs: S(lod, 72), count: 12, depth: (y, i) => (i >= 2 && i <= 4 ? 0.0022 : 0) });
    // the rests: three notches pressed into the rim
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      if (y < 0.02) continue;
      const a = Math.atan2(x, z);
      let d = 1;
      for (let k = 0; k < 3; k++) d = Math.min(d, Math.abs(Math.atan2(Math.sin(a - k * 2.094), Math.cos(a - k * 2.094))));
      const n = Math.max(0, 1 - d / 0.16);
      p.setY(i, y - n * n * (3 - 2 * n) * 0.008 * Math.min(1, (y - 0.02) / 0.008));
    }
    geo = smooth(geo);
    const butt = (a, len, lie) => {
      const g = new THREE.CylinderGeometry(0.0042, 0.0042, len, S(lod, 12), 1).rotateZ(Math.PI / 2);
      // (crushed: flattened a little, its end squashed)
      g.scale(1, 0.8, 1);
      g.rotateY(a).translate(Math.cos(a) * 0.018, 0.0165 + lie, -Math.sin(a) * 0.018);
      return g;
    };
    const ash = new THREE.CircleGeometry(0.02, S(lod, 16)).rotateX(-Math.PI / 2).scale(1.3, 1, 0.8).translate(-0.006, 0.0132, 0.006);
    return {
      parts: [
        { geo, mat: P.glassThick, id: 0, name: 'glass' },
        { geo: mergeGeos([butt(0.4, 0.028, 0), butt(2.3, 0.022, 0.002)]), mat: P.paperLight, id: 1 },
        { geo: ash, mat: P.ash, id: 1, cast: false },
      ],
      grip: [0.05, 0.02, 0],
    };
  },
  // the sugar pourer: a ribbed glass jar, sugar inside, a chrome cap with a
  // spout
  sugar(v, lod) {
    const P = PM();
    const prof = [[0.0001, 0], [0.03, 0], [0.033, 0.003], [0.034, 0.02], [0.034, 0.075], [0.031, 0.083], [0.0001, 0.083]];
    const jar = flutedLathe(prof, { segs: S(lod, 60), count: 14, depth: (y, i) => (i >= 2 && i <= 4 ? 0.0012 : 0) });
    const sugarIn = lathe([[0.0001, 0.004], [0.03, 0.004], [0.031, 0.05], [0.0001, 0.052]], S(lod, 32));
    const cap = lathe([[0.0001, 0.082], [0.0345, 0.082], [0.0355, 0.086], [0.033, 0.098], [0.024, 0.108], [0.012, 0.112], [0.0001, 0.112]], S(lod, 48));
    const spout = new THREE.CylinderGeometry(0.004, 0.0055, 0.03, S(lod, 12)).rotateZ(-0.7).translate(0.018, 0.118, 0);
    return {
      parts: [
        { geo: sugarIn, mat: P.paperLight, id: 1 },
        { geo: jar, mat: P.glass, id: 0, name: 'glass' },
        { geo: mergeGeos([cap, spout]), mat: P.chrome, id: 2 },
      ],
      grip: [0, 0.05, 0],
    };
  },
  // the steel napkin dispenser, paper showing through its faces and fanned
  // out of the top
  napkinBox(v, lod) {
    const P = PM();
    const body = slab(0.12, 0.105, 0.075, { bevel: 0.006, corner: 0.012 });
    const faces = [];
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(0.086, 0.062).translate(0, 0.052, s * 0.0378);
      if (s < 0) g.rotateY(Math.PI);
      uvRect(g, AT.napkin);
      faces.push(g);
    }
    const fan = [];
    for (let k = 0; k < 5; k++) {
      const g = new THREE.PlaneGeometry(0.1, 0.03).rotateX(-0.25 + k * 0.12).translate(0, 0.108 + k * 0.001, -0.012 + k * 0.006);
      fan.push(g);
    }
    return {
      parts: [
        { geo: body, mat: P.chrome, id: 0 },
        { geo: mergeGeos(faces, { uv: true }), mat: P.atlas, id: 1 },
        { geo: mergeGeos(fan), mat: P.paperLight, id: 1, side: THREE.DoubleSide, cast: false },
      ],
      grip: [0, 0.05, 0],
    };
  },

  // ---- smoke ----------------------------------------------------------------------
  // 8 cm of paper, its mouth end at the origin, the tip at +y 0.08:
  // setTip('unlit' | 'lit' (the ember) | 'ash' (a grey ash end that grows:
  // setAsh(m), and falls: dropAsh()))
  cigarette(v, lod) {
    const P = PM();
    const L = 0.08, r = 0.0042;
    const paper = new THREE.CylinderGeometry(r, r, 1, S(lod, 16), 1, false).translate(0, 0.5, 0);
    const cap0 = new THREE.CircleGeometry(r, S(lod, 16)).rotateX(Math.PI / 2);
    const tipCap = new THREE.CircleGeometry(r * 0.98, S(lod, 16)).rotateX(-Math.PI / 2);
    const ember = lathe([[0.0001, 0], [r * 1.0, 0], [r * 0.9, 0.0018], [r * 0.5, 0.0028], [0.0001, 0.003]], S(lod, 16));
    const ashG = lathe([[r * 0.98, 0], [r * 1.02, 0.3], [r * 0.99, 0.7], [r * 0.85, 0.95], [0.0001, 1.0]], S(lod, 16));
    return {
      parts: [
        { geo: paper, mat: P.paperLight, id: 0, name: 'paper', keep: true },
        { geo: cap0, mat: P.paper, id: 0, name: 'mouthEnd', keep: true },
        { geo: tipCap, mat: P.food, id: 0, name: 'tipEnd', keep: true },
        // (its own ember material: userData.setGlow(k) flares this tip alone)
        { geo: ember, mat: accentMaterial('ember'), id: 1, name: 'ember', cast: false, keep: true },
        { geo: ashG, mat: P.ash, id: 1, name: 'ash', keep: true },
      ],
      grip: [0, 0.022, 0],
      rest: new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.04, r, 0),
      init(g, ud, by) {
        ud.tip = 'unlit';
        ud.ashLen = 0;
        ud.burnt = 0;      // paper gone (m)
        const place = () => {
          const len = L - ud.burnt;
          by.paper.scale.y = len;
          by.tipEnd.position.y = len;
          const lit = ud.tip !== 'unlit';
          by.ember.visible = lit;
          by.ember.position.y = len;
          const a = lit ? ud.ashLen : 0;
          by.ash.visible = a > 0.0005;
          by.ash.position.y = len + 0.0012;
          by.ash.scale.y = Math.max(1e-4, a);
          by.tipEnd.visible = !lit;
          ud.tipPos = new THREE.Vector3(0, len + a, 0);
        };
        ud.setTip = (s) => { ud.tip = s; if (s === 'ash' && ud.ashLen < 0.006) ud.ashLen = 0.012; if (s === 'lit' && ud.ashLen > 0.004) ud.ashLen = 0.002; place(); };
        // the ember's glow (fix round A11): gain 1 at rest, 3 on a drag
        ud.glow = 1;
        ud.setGlow = (k) => { ud.glow = k; const m = by.ember.material; if (m.userData.setGain) m.userData.setGain(k); };
        ud.setAsh = (m) => { ud.ashLen = Math.max(0, m); place(); };
        // the ash falls: returns where it was (the caller drops a flake)
        ud.dropAsh = () => { const p = new THREE.Vector3(0, L - ud.burnt + ud.ashLen * 0.5, 0); g.localToWorld(p); ud.ashLen = 0; place(); return p; };
        // burning on its own: the paper shortens (~0.2 mm/s), the ash grows
        // and falls at 2 cm; a drag (burn(k)) makes it hurry
        ud.tick = (dt, drag = 0) => {
          if (ud.tip === 'unlit') return;
          const d = dt * (0.0002 + drag * 0.003);
          ud.burnt = Math.min(L - 0.018, ud.burnt + d);
          ud.ashLen += d * 0.9;
          if (ud.tip === 'lit' && ud.ashLen > 0.004) ud.tip = 'ash';
          if (ud.ashLen > 0.02) ud.dropAsh();
          place();
        };
        place();
      },
    };
  },
  // a soft pack, torn open at one corner, two cigarettes standing proud
  cigarettePack(v, lod) {
    const P = PM();
    const w = 0.055, h = 0.085, d = 0.022;
    const body = slab(w, h, d, { bevel: 0.0035, corner: 0.005, seg: 3 });
    // soften: a soft pack bulges a little in the middle
    const p = body.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i), z = p.getZ(i);
      const b = Math.sin(Math.PI * Math.min(1, Math.max(0, y / h))) * (1 - Math.pow(x / (w / 2), 2));
      p.setZ(i, z * (1 + 0.12 * b));
    }
    body.computeVertexNormals();
    const face = (s) => {
      const g = new THREE.PlaneGeometry(w - 0.006, h - 0.018).translate(0, (h - 0.018) / 2 + 0.004, s * (d / 2 + 0.0019));
      if (s < 0) g.rotateY(Math.PI);
      return uvRect(g, AT.pack);
    };
    // the torn top: a dark hole at one corner with a ragged paper lip
    const hole = flatPoly([[-0.026, -0.009], [0.004, -0.009], [0.009, -0.004], [0.006, 0.002], [0.011, 0.007], [-0.026, 0.009]], h + 0.0004);
    const lip = [];
    for (let k = 0; k < 6; k++) {
      const x = 0.004 + hash(k, 3) * 0.008, z = -0.009 + k * 0.0035;
      lip.push(new THREE.PlaneGeometry(0.004, 0.005 + hash(k, 5) * 0.004).rotateY(0.4 + hash(k, 7)).translate(x, h + 0.002, z));
    }
    const cig = (x, z, up) => new THREE.CylinderGeometry(0.0041, 0.0041, h * 0.6 + up, S(lod, 14)).translate(x, h * 0.7 + up / 2 + 0.002, z);
    return {
      parts: [
        { geo: body, mat: P.paperLight, id: 0 },
        { geo: mergeGeos([face(1), face(-1)], { uv: true }), mat: P.atlas, id: 0 },
        { geo: hole, mat: P.black, id: 1, cast: false },
        { geo: mergeGeos(lip), mat: P.paperLight, id: 1, side: THREE.DoubleSide, cast: false },
        { geo: mergeGeos([cig(-0.017, -0.003, 0.02), cig(-0.007, 0.003, 0.012)]), mat: P.paperLight, id: 2 },
      ],
      grip: [0, 0.04, 0],
    };
  },
  // a flat flip-top petrol lighter: the case, the lid on a side hinge
  // (setOpen 0..1), the chimney with its holes, the wheel, the wick
  lighter(v, lod) {
    const P = PM();
    const w = 0.038, d = 0.0128, hb = 0.037, hl = 0.019;
    const caseG = slab(w, hb, d, { bevel: 0.0022, corner: 0.0035, seg: 3 });
    const lidG = slab(w, hl, d, { bevel: 0.0022, corner: 0.0035, seg: 3 });
    // the lid pivots on its hinge at the case's right top edge: its mesh is
    // built with the hinge at the origin
    lidG.translate(-w / 2 + 0.0005, 0, 0);
    const hingeG = new THREE.CylinderGeometry(0.0018, 0.0018, 0.008, S(lod, 12)).rotateX(Math.PI / 2).translate(w / 2 - 0.0005, hb, 0);
    const chim = slab(0.024, 0.016, 0.0108, { bevel: 0.0012, corner: 0.002 }).translate(-0.004, hb - 0.001, 0);
    const holes = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) for (const s of [-1, 1]) {
      const g = new THREE.CircleGeometry(0.00115, 10).translate(-0.0125 + c * 0.0056, hb + 0.0045 + r * 0.0052, s * 0.0055);
      if (s < 0) g.rotateY(Math.PI).translate(0, 0, 0);
      holes.push(g);
    }
    const wheel = flutedLathe([[0.0001, -0.0028], [0.0046, -0.0028], [0.0046, 0.0028], [0.0001, 0.0028]], { segs: S(lod, 48), count: 24, depth: (y, i) => (i === 1 || i === 2 ? 0.0004 : 0) });
    wheel.rotateX(Math.PI / 2).translate(0.0095, hb + 0.0155, 0);
    const wick = new THREE.CylinderGeometry(0.0016, 0.0019, 0.006, 10).translate(-0.004, hb + 0.016, 0);
    return {
      parts: [
        { geo: caseG, mat: P.chrome, id: 0 },
        { geo: hingeG, mat: P.chrome, id: 0 },
        { geo: chim, mat: P.metal, id: 1, name: 'chimney' },
        { geo: mergeGeos(holes), mat: P.black, id: 1, cast: false },
        { geo: wheel, mat: P.dark, id: 1, name: 'wheel', keep: true },
        { geo: wick, mat: P.paperLight, id: 1, cast: false },
        { geo: lidG, mat: P.chrome, id: 2, name: 'lid', pivot: [w / 2 - 0.0005, hb + 0.0001, 0] },
      ],
      grip: [0, 0.026, 0],
      init(g, ud, by) {
        ud.open = 0;
        ud.flame = new THREE.Vector3(-0.004, hb + 0.019, 0);
        ud.setOpen = (k) => { ud.open = Math.max(0, Math.min(1, k)); const e = ud.open * ud.open * (3 - 2 * ud.open); by.lid.rotation.z = -e * 2.35; };
        // the wheel turns (a thumb strike): radians
        ud.strike = (a = 2) => { by.wheel.rotation.z += a; };
      },
      // the flame (fix round A6), added after the lighter is measured (it
      // is not part of its size): a tongue ~3 cm tall standing on the wick,
      // hidden until lit - ud.flame.visible = true; ud.flame.setGain(g) (1 a
      // steady flame, ~2 as it catches); it flickers on the game's clock
      // (accents.js). ud.flame.position is where it stands, as before.
      after(g, ud) {
        const f = flameGroup(ud.inkId + 1);
        f.position.copy(ud.flame);
        ud.flame = f;
        g.add(f);
      },
    };
  },
  // the Cardinal's matchbook: a red cover (accent crew) with the black bird
  // and THE CARDINAL, a comb of matches inside; setOpen lifts the cover
  matchbook(v, lod) {
    const P = PM();
    const w = 0.038, L = 0.05, t = 0.0022;
    // [B1] the back torn across (half of it and half the black bird on it
    // gone): seen only when the book is turned over or opened
    const torn = tornBack();
    const strip = new THREE.PlaneGeometry(w - 0.004, 0.007).rotateX(-Math.PI / 2).translate(0, t + 0.00015, L / 2 - 0.006);
    // the matches: a comb of ten flat sticks with round dark heads
    const sticks = [], heads = [];
    for (let k = 0; k < 10; k++) {
      const x = -w / 2 + 0.003 + k * (w - 0.006) / 9;
      sticks.push(new THREE.BoxGeometry(0.0028, 0.0009, L - 0.012).translate(x, t + 0.0006, 0.002));
      heads.push(new THREE.SphereGeometry(0.0019, 8, 6).scale(1, 0.7, 1.4).translate(x, t + 0.0012, -L / 2 + 0.008));
    }
    // the cover: its hinge at the heads' end (-z); built with the hinge at
    // the origin, lying over the matches
    const cover = slab(w, 0.0012, L - 0.004, { bevel: 0.0005, corner: 0.0015, seg: 2 }).translate(0, 0, (L - 0.004) / 2);
    const decal = new THREE.PlaneGeometry(w - 0.005, L - 0.01).rotateX(-Math.PI / 2).translate(0, 0.00135, (L - 0.004) / 2);
    // (the decal's picture: its top edge toward the hinge)
    uvRect(decal, AT.match);
    decal.rotateY(0);
    const coverG = new THREE.Group();
    return {
      parts: [
        { geo: torn.keep.geo, mat: P.crew, id: 0 },
        { geo: torn.keep.decal, mat: birdMaterial(), id: 0, cast: false },
        { geo: torn.edgeKeep, mat: edgeMaterial(), id: 0, cast: false },
        { geo: strip, mat: P.dark, id: 0, cast: false },
        { geo: mergeGeos(sticks), mat: P.paperLight, id: 1 },
        { geo: mergeGeos(heads), mat: P.black, id: 1 },
        { geo: cover, mat: P.crew, id: 2, name: 'cover', pivot: [0, t + 0.0026, -L / 2 + 0.002] },
        { geo: decal, mat: P.atlasDecal, id: 2, parent: 'cover', cast: false },
      ],
      grip: [0, 0.003, 0.01], accent: 'crew',
      init(g, ud, by) {
        void coverG;
        ud.open = 0;
        ud.torn = true;   // [B1]
        ud.setOpen = (k) => { ud.open = Math.max(0, Math.min(1, k)); const e = ud.open * ud.open * (3 - 2 * ud.open); by.cover.rotation.x = -e * 2.7; };
      },
    };
  },
  // the wallet: two leaves on a spine (setOpen 0..1 opens it like a book);
  // inside the right leaf, the licence behind a celluloid window
  wallet(v, lod) {
    const P = PM();
    const w = 0.105, d = 0.088, t = 0.0065;
    const leafR = slab(w, t, d, { bevel: 0.0025, corner: 0.006, seg: 2 });
    const card = new THREE.PlaneGeometry(0.084, 0.054).rotateX(-Math.PI / 2).translate(0.002, t + 0.0005, 0.004);
    uvRect(card, AT.licence);
    // the window's frame: four thin strips of leather round the card
    const fr = [];
    const fw = 0.004, cw = 0.086, ch = 0.056, cz = 0.004, cx = 0.002;
    fr.push(new THREE.BoxGeometry(cw + 2 * fw, 0.0012, fw).translate(cx, t + 0.0009, cz - ch / 2 - fw / 2));
    fr.push(new THREE.BoxGeometry(cw + 2 * fw, 0.0012, fw).translate(cx, t + 0.0009, cz + ch / 2 + fw / 2));
    fr.push(new THREE.BoxGeometry(fw, 0.0012, ch).translate(cx - cw / 2 - fw / 2, t + 0.0009, cz));
    fr.push(new THREE.BoxGeometry(fw, 0.0012, ch).translate(cx + cw / 2 + fw / 2, t + 0.0009, cz));
    const pane = new THREE.PlaneGeometry(cw, ch).rotateX(-Math.PI / 2).translate(cx, t + 0.0013, cz);
    // the left leaf, hinged at the spine (x = -w/2), lying on the right one
    // when shut; its inside (+y, open) shows a pocket with a bill's edge.
    // (built round its pivot: x from -w to 0, y centred on the pivot)
    const leafL = slab(w, t, d, { bevel: 0.0025, corner: 0.006, seg: 2 }).translate(-w / 2, -t / 2, 0);
    const bill = new THREE.PlaneGeometry(0.09, 0.012).rotateX(-Math.PI / 2).translate(-w / 2 + 0.003, t / 2 + 0.0012, -0.03);
    const pocket = new THREE.BoxGeometry(w - 0.012, 0.0008, 0.05).translate(-w / 2, t / 2 + 0.0004, 0.012);
    const spine = new THREE.CylinderGeometry(t, t, d - 0.012, S(lod, 16), 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(-w / 2, t, 0);
    return {
      parts: [
        { geo: leafR, mat: P.leather, id: 0 },
        { geo: spine, mat: P.leather, id: 0 },
        { geo: card, mat: P.atlas, id: 1, name: 'licence', cast: false, keep: true },
        { geo: mergeGeos(fr), mat: P.leather, id: 0, cast: false },
        { geo: pane, mat: P.glass, id: 1, cast: false },
        { geo: leafL, mat: P.leather, id: 2, name: 'leaf', pivot: [-w / 2, 1.5 * t, 0] },
        { geo: bill, mat: P.paper, id: 2, parent: 'leaf', side: THREE.DoubleSide, cast: false },
        { geo: pocket, mat: P.black, id: 2, parent: 'leaf', cast: false },
      ],
      grip: [0.02, 0.006, 0],
      init(g, ud, by) {
        ud.open = 0;
        // (shut, the left leaf lies face down on the right one: rotation PI
        // about the spine; open, it lies flat beside it)
        ud.setOpen = (k) => { ud.open = Math.max(0, Math.min(1, k)); const e = ud.open * ud.open * (3 - 2 * ud.open); by.leaf.rotation.z = Math.PI * (1 - e); };
        ud.setOpen(0);
        ud.card = by.licence;
      },
    };
  },
  // a menu: a folded card, its dark cover up
  menu(v, lod) {
    const P = PM();
    const body = slab(0.23, 0.005, 0.3, { bevel: 0.0015, corner: 0.004, seg: 2 });
    const cov = new THREE.PlaneGeometry(0.22, 0.29).rotateX(-Math.PI / 2).translate(0, 0.0052, 0);
    uvRect(cov, AT.menu);
    return { parts: [{ geo: body, mat: P.dark, id: 0 }, { geo: cov, mat: P.atlas, id: 0, cast: false }], grip: [0.1, 0.003, 0] };
  },
  // the newspaper, folded in four, a headline as three heavy bars; variant
  // 'open': a sheet held up to read, bowed, both sides printed
  newspaper(v, lod) {
    const P = PM();
    if (v === 'open') {
      const g = new THREE.PlaneGeometry(0.58, 0.4, 24, 4);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, 0.04 * Math.cos((x / 0.29) * Math.PI / 2) - 0.02 * Math.abs(x / 0.29)); }
      g.computeVertexNormals();
      g.translate(0, 0.2, 0);
      uvRect(g, AT.news);
      return { parts: [{ geo: g, mat: P.atlas, id: 0, side: THREE.DoubleSide }], grip: [0.25, 0.2, 0] };
    }
    const w = 0.3, d = 0.2, t = 0.011;
    const body = slab(w, t, d, { bevel: 0.003, corner: 0.004, seg: 2 });
    // (the fold: the body bows a little, highest at the folded edge)
    const p = body.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (p.getY(i) > t * 0.5) p.setY(i, p.getY(i) + 0.003 * (0.5 + z / d)); }
    body.computeVertexNormals();
    const top = new THREE.PlaneGeometry(w - 0.01, d - 0.01, 8, 4).rotateX(-Math.PI / 2);
    const q = top.getAttribute('position');
    for (let i = 0; i < q.count; i++) q.setY(i, t + 0.0006 + 0.003 * (0.5 + q.getZ(i) / d));
    top.computeVertexNormals();
    uvRect(top, AT.news);
    return { parts: [{ geo: body, mat: P.paper, id: 0 }, { geo: top, mat: P.atlas, id: 0, cast: false }], grip: [0.14, 0.006, 0] };
  },

  // ---- cutlery --------------------------------------------------------------------
  fork(v, lod) {
    const P = PM();
    const s = new THREE.Shape();
    // (in the x/y plane: the handle along +y from the end, the head at the top)
    s.moveTo(-0.0055, 0);
    s.quadraticCurveTo(-0.0075, 0.05, -0.004, 0.105);
    s.lineTo(-0.0032, 0.125);
    s.quadraticCurveTo(-0.011, 0.14, -0.011, 0.155);
    s.lineTo(-0.011, 0.19);
    const tines = 4, tw = 0.022 / tines;
    for (let k = 0; k < tines; k++) {
      const x0 = -0.011 + k * tw;
      s.lineTo(x0 + tw * 0.25, 0.192);
      s.lineTo(x0 + tw * 0.62, 0.192);
      if (k < tines - 1) { s.lineTo(x0 + tw * 0.75, 0.158); s.lineTo(x0 + tw * 1.1, 0.158); }
    }
    s.lineTo(0.011, 0.19);
    s.lineTo(0.011, 0.155);
    s.quadraticCurveTo(0.011, 0.14, 0.0032, 0.125);
    s.lineTo(0.004, 0.105);
    s.quadraticCurveTo(0.0075, 0.05, 0.0055, 0);
    s.quadraticCurveTo(0, -0.004, -0.0055, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0005, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(-Math.PI / 2).translate(0, 0.0012, 0.095);
    // (a gentle bend: the head lifts off the table)
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z < -0.02) p.setY(i, p.getY(i) + (-0.02 - z) * 0.08); }
    return { parts: [{ geo: smooth(g), mat: P.chrome, id: 0 }], grip: [0, 0.002, 0.05] };
  },
  knife(v, lod) {
    const P = PM();
    const s = new THREE.Shape();
    s.moveTo(-0.0065, 0);
    s.quadraticCurveTo(-0.008, 0.05, -0.006, 0.095);
    s.lineTo(-0.0045, 0.1);
    s.lineTo(-0.0085, 0.105);
    s.lineTo(-0.0085, 0.19);
    s.quadraticCurveTo(-0.008, 0.212, 0.0, 0.215);
    s.quadraticCurveTo(0.006, 0.2, 0.006, 0.18);
    s.lineTo(0.0055, 0.105);
    s.lineTo(0.0045, 0.1);
    s.lineTo(0.006, 0.095);
    s.quadraticCurveTo(0.008, 0.05, 0.0065, 0);
    s.quadraticCurveTo(0, -0.004, -0.0065, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.0014, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(-Math.PI / 2).translate(0, 0.0012, 0.105);
    return { parts: [{ geo: smooth(g), mat: P.chrome, id: 0 }], grip: [0, 0.002, 0.06] };
  },

  // ---- furniture ------------------------------------------------------------------
  // the counter stool: a chrome pedestal on a flared foot, a round padded
  // seat with a piped edge and a button; the seat swivels (child 'seat')
  stool(v, lod) {
    const P = PM();
    const seg = S(lod, 48);
    const ped = lathe([
      [0.0001, 0], [0.19, 0], [0.198, 0.004], [0.196, 0.012], [0.17, 0.018], [0.11, 0.03], [0.07, 0.048], [0.045, 0.075], [0.034, 0.11],
      [0.03, 0.2], [0.029, 0.6], [0.036, 0.615], [0.036, 0.64], [0.06, 0.655], [0.075, 0.672], [0.0001, 0.674],
    ], seg);
    // the seat: a squab, its piping at top and bottom edges, a button
    const R = 0.195, y0 = 0.672, y1 = 0.765;
    const cush = lathe([[0.0001, y0], [R - 0.02, y0], [R - 0.004, y0 + 0.008], [R, y0 + 0.03], [R, y1 - 0.025], [R - 0.012, y1 - 0.006], [R - 0.05, y1], [0.03, y1 + 0.004], [0.006, y1 - 0.004], [0.0001, y1 - 0.004]], seg);
    const pipeT = new THREE.TorusGeometry(R - 0.004, 0.0065, S(lod, 10), seg).rotateX(Math.PI / 2).translate(0, y1 - 0.014, 0);
    const pipeB = new THREE.TorusGeometry(R - 0.002, 0.006, S(lod, 10), seg).rotateX(Math.PI / 2).translate(0, y0 + 0.012, 0);
    const pan = lathe([[0.0001, y0 - 0.012], [0.16, y0 - 0.012], [0.172, y0 - 0.004], [0.17, y0 + 0.004], [0.0001, y0 + 0.004]], seg);
    const button = new THREE.SphereGeometry(0.009, 12, 8).scale(1, 0.5, 1).translate(0, y1 - 0.004, 0);
    // (one seam across the seat, so a spin reads)
    const seam = new THREE.TorusGeometry(0.11, 0.0025, 6, 40, Math.PI * 0.7).rotateX(Math.PI / 2).rotateY(0.6).translate(0, y1 - 0.0005, 0);
    return {
      parts: [
        { geo: ped, mat: P.chrome, id: 0 },
        { geo: pan, mat: P.metal, id: 0, parent: 'seat' },
        { geo: cush, mat: P.seat, id: 1, parent: 'seat' },
        { geo: mergeGeos([pipeT, pipeB]), mat: P.seat, id: 1, parent: 'seat' },
        { geo: mergeGeos([button, seam]), mat: P.seat, id: 1, parent: 'seat' },
      ],
      groups: { seat: [0, 0, 0] },
      grip: [0.19, 0.72, 0],
    };
  },
};

// the kinds CONTRACTS §8.1 lists (and the stub's order)
export const PROP_KINDS = ['tumbler', 'bottle', 'plate', 'cup', 'saucer', 'mug', 'stool', 'ashtray', 'cigarette', 'cigarettePack',
  'lighter', 'matchbook', 'wallet', 'coffeePot', 'napkinBox', 'ketchup', 'sugar', 'menu', 'newspaper', 'pie', 'fork', 'knife'];
export const BOTTLE_VARIANTS = ['scotch', 'rye', 'gin', 'beer', 'ketchup', 'milk'];
