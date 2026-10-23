import * as THREE from 'three';
import { hoodMaterial, RAG_HOOKS } from '../enemies/Hood.js';
import { accentMaterial } from '../render/accents.js';

// [O8] What a man of the city carries as part of who he is (src/cast/style.js
// gives it him by where he stands): a cigarette between the fingers - its
// ember the registry's one warm accent, a pin of orange in the black - and
// the swell's cane. Drawn as the figure is (his ink id, his greys), so the ink
// prints them as part of him; built once a figure, shown or hidden.
//   carry(fig, 'cigarette' | 'cane' | null)
let EMBER = null;
function greys(geo, v) {
  const n = geo.getAttribute('position').count, c = new Float32Array(n * 3).fill(v);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
function part(fig, geo, v) {
  const m = new THREE.Mesh(greys(geo, v), hoodMaterial(fig.world));
  m.userData.inkId = fig.inkId; m.userData.inkFigure = true; m.userData.inkSurface = 'castFig'; m.userData.noRay = true;
  m.castShadow = false;
  return m;
}
function build(fig, kind) {
  const g = new THREE.Group();
  g.name = 'o8_' + kind;
  const inv = 1 / (fig.scale || 1);
  if (kind === 'cigarette') {
    g.add(part(fig, new THREE.CylinderGeometry(0.0045, 0.0045, 0.06, 8).translate(0, 0.03, 0), 0.5));
    if (!EMBER) EMBER = accentMaterial('ember');
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), EMBER);
    e.position.y = 0.062; e.userData.noRay = true;
    g.add(e);
    // (between the first two fingers, pointing out of the hand)
    g.position.set(0, -0.085, 0.03);
    g.rotation.set(1.35, 0, 0.3);
  } else if (kind === 'cane') {
    // the crook in the fist, the shaft to the street
    g.add(part(fig, new THREE.TorusGeometry(0.03, 0.008, 6, 16, Math.PI).rotateY(Math.PI / 2).translate(0, 0.0, 0.03), 0.01));
    g.add(part(fig, new THREE.CylinderGeometry(0.009, 0.007, 0.82, 8).translate(0, -0.41, 0), 0.012));
    g.add(part(fig, new THREE.CylinderGeometry(0.0095, 0.0095, 0.03, 8).translate(0, -0.83, 0), 0.5));
    g.position.set(0, -0.07, 0.005);
  }
  g.scale.setScalar(inv * (fig.scale || 1));
  fig.bones.handR.add(g);
  return g;
}
export function carry(fig, kind) {
  const C = fig._o8carry || (fig._o8carry = {});
  for (const [k, g] of Object.entries(C)) g.visible = k === kind;
  if (kind && !C[kind]) C[kind] = build(fig, kind);
  if (kind) C[kind].visible = true;
  fig.carrying = kind || null;
}

// [O8] after the critic (a body on the black wet street went into the ink: a dark coat lying on
// a dark street has no edge for the rim): a man down shows what a fall shows - the coat thrown
// open over the white shirt front, the shirt's cuffs out of the sleeves. Light shapes of the cast
// (castFig), so the ink prints them flat and pale whatever the lamp: a body reads at 6 and 12 m,
// under a lamp or away from one. Shown while he lies (the physics layer), gone when he is up.
function shirtFront(fig) {
  // the shirt where the coat fell open: a band bowed round the chest's front, narrow at the belt,
  // wide under the lapels, to a V at the throat, the tie down it (chest bone space: +z front, +y
  // up); bowed, so it shows at a low angle too - a body across the street is seen nearly edge on
  const g = new THREE.CylinderGeometry(1, 1, 0.4, 14, 8, true, -0.8, 1.6);
  const P = g.getAttribute('position'), n = P.count, col = new Float32Array(n * 3);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const a = Math.atan2(x, z);
    const k = (0.45 + 0.55 * ss(-0.2, 0.08, y)) * (1 - 0.75 * ss(0.08, 0.2, y));
    const aa = a * k;
    P.setXYZ(i, Math.sin(aa) * 0.225, y, Math.cos(aa) * 0.17 + 0.065);
    const tie = Math.abs(aa) < 0.09 && y < 0.15;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = tie ? 0.012 : 0.74;
  }
  g.translate(0, -0.04, 0);
  g.computeVertexNormals();
  const m = part(fig, g, 0.74);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return m;
}
function lining(fig) {
  // the coat's tails thrown up over his back as he went down on his front: the lining's grey
  // (hips bone space: -z his back), from the waist over the seat to the thighs, flaring
  const g = new THREE.CylinderGeometry(1, 1, 0.6, 18, 8, true, Math.PI - 0.95, 1.9);
  const P = g.getAttribute('position');
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    let y = P.getY(i);
    // (not a card: the tails' hems fall in two curves to the vent between them, the waist a
    // shallow curve, the sides drawn in where the coat's edge folds over)
    const a = Math.atan2(x, -z), u = Math.min(1, Math.abs(a) / 0.95);
    const lo = (0.3 - y) / 0.6;
    y += lo * lo * (0.13 * u * u - 0.06 + 0.2 * Math.max(0, 1 - Math.abs(a) / 0.14)) - (1 - lo) * (1 - lo) * 0.05 * u * u;
    const fl = 1 + 0.3 * Math.max(0, -y) / 0.3;
    P.setXYZ(i, x * 0.23 * fl * (1 - 0.12 * u * u * u), y, z * 0.2 * fl - 0.07);
  }
  g.translate(0, -0.23, 0);
  g.computeVertexNormals();
  return part(fig, g, 0.5);
}
function cuff(fig) {
  return part(fig, new THREE.CylinderGeometry(0.058, 0.064, 0.06, 14, 1, true).translate(0, -0.035, 0), 0.74);
}
function lying(h, on) {
  if (!h.bones || !h.bones.chest) return;
  let M = h._o8lying;
  if (!M && on) {
    M = h._o8lying = [];
    const f = shirtFront(h); h.bones.chest.add(f); M.push(f);
    if (h.bones.hips) { const l = lining(h); h.bones.hips.add(l); M.push(l); }
    for (const b of ['handL', 'handR']) if (h.bones[b]) { const c = cuff(h); h.bones[b].add(c); M.push(c); }
    for (const m of M) { m.userData.inkId = h.inkId; m.frustumCulled = false; }
  }
  if (M) for (const m of M) { m.visible = !!on; m.userData.inkId = h.inkId; }
}
RAG_HOOKS.push(lying);
