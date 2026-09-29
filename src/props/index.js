import * as THREE from 'three';
import { allocInkId } from '../render/layers.js';
import { accentMaterial } from '../render/accents.js';
import { roundedBox } from '../world/geom.js';

// The prop library (docs/story/CONTRACTS.md §8.1): the small objects of the
// story, built by one function so the thing on the counter and the thing in
// the hand are the same object.
//   buildProp(kind, { lod: 0 | 1, variant? }) -> THREE.Group
//   .userData = { kind, variant, size: Vector3, grip: Matrix4, rest: Matrix4,
//                 inkIds: n, accent?: key, setFill(0..1), setTilt(quaternion),
//                 setOpen(0..1), setTip('unlit' | 'lit' | 'ash') }
// Frame: the origin is the middle of the prop's base (it stands on a surface
// at y = 0 in its own frame), +y up; `rest` is how it lies on a surface
// (identity for everything that stands; a cigarette lies on its side), and
// `grip` is where a hand holds it (the hand's palm centre, its fingers
// round the prop's +x side). size is the prop's bounding box, metres.
//
// FOUNDATION STUB (lane 5 owns src/props/**): each kind is a plain smooth
// lathe or rounded box of the right size, one ink id per prop, a stand-in
// grey; the liquid in a tumbler or a bottle is its own mesh (accent amber)
// scaled by setFill; setTilt, setOpen and setTip are no-ops that record
// their value in userData.
export const PROP_KINDS = ['tumbler', 'bottle', 'plate', 'cup', 'saucer', 'mug', 'stool', 'ashtray', 'cigarette', 'cigarettePack',
  'lighter', 'matchbook', 'wallet', 'coffeePot', 'napkinBox', 'ketchup', 'sugar', 'menu', 'newspaper', 'pie', 'fork', 'knife'];
export const BOTTLE_VARIANTS = ['scotch', 'rye', 'gin', 'beer', 'ketchup', 'milk'];

let MAT = null;
function mats() {
  if (!MAT) {
    const std = (color, roughness) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    MAT = {
      china: std(0xd0d0d0, 0.55), glass: std(0x6a6a6a, 0.2), dark: std(0x141414, 0.8), metal: std(0x3a3a3a, 0.45),
      paper: std(0xc8c8c8, 0.9), leather: std(0x1a1a1a, 0.85), food: std(0x5a5a5a, 0.9), seat: std(0x101010, 0.7),
    };
  }
  return MAT;
}
let AMBER = null, CREW = null, EMBER = null;

// a smooth lathe: profile [[r, y]] from the base up
function lathe(profile, segs = 32) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), segs);
}
const box = (w, h, d, r = 0.002) => roundedBox(w, h, d, Math.min(r, w * 0.45, h * 0.45, d * 0.45), 2).translate(0, h / 2, 0);

// kind -> (variant) -> { parts: [[geo, mat]], size: [x, y, z], grip: [x, y, z], liquid?: { r, h, y0, full } , accent? }
const SPECS = {
  tumbler: () => ({ parts: [[lathe([[0, 0], [0.036, 0], [0.0375, 0.004], [0.0375, 0.085], [0.034, 0.085], [0.033, 0.014], [0, 0.014]]), 'glass']],
    size: [0.075, 0.085, 0.075], grip: [0, 0.04, 0], liquid: { r: 0.032, y0: 0.014, h: 0.085 * 0.4 }, accent: 'amber' }),
  bottle: (v) => {
    const B = { scotch: [0.045, 0.28, 0.16], rye: [0.04, 0.3, 0.19], gin: [0.042, 0.3, 0.18], beer: [0.031, 0.23, 0.14], ketchup: [0.03, 0.2, 0.13], milk: [0.04, 0.22, 0.15] }[v] || [0.045, 0.28, 0.16];
    const [r, h, sh] = B;
    return {
      parts: [[lathe([[0, 0], [r, 0], [r, sh], [r * 0.9, sh + 0.02], [0.013, sh + 0.05], [0.012, h - 0.012], [0.014, h - 0.006], [0.012, h], [0, h]]), v === 'milk' ? 'china' : 'glass']],
      size: [2 * r, h, 2 * r], grip: [0, h - 0.07, 0],
      liquid: v === 'scotch' || v === 'rye' ? { r: r * 0.92, y0: 0.006, h: sh * 0.95 } : null, accent: v === 'scotch' || v === 'rye' ? 'amber' : null,
    };
  },
  plate: () => ({ parts: [[lathe([[0, 0], [0.08, 0], [0.12, 0.012], [0.12, 0.016], [0.08, 0.006], [0, 0.006]]), 'china']], size: [0.24, 0.016, 0.24], grip: [0.11, 0.01, 0] }),
  cup: () => ({ parts: [[lathe([[0, 0], [0.03, 0], [0.042, 0.03], [0.043, 0.07], [0.039, 0.07], [0.037, 0.008], [0, 0.008]]), 'china']], size: [0.085, 0.07, 0.085], grip: [0.05, 0.04, 0] }),
  saucer: () => ({ parts: [[lathe([[0, 0], [0.05, 0], [0.07, 0.012], [0.07, 0.015], [0.05, 0.006], [0, 0.006]]), 'china']], size: [0.14, 0.015, 0.14], grip: [0.065, 0.008, 0] }),
  mug: () => ({ parts: [[lathe([[0, 0], [0.042, 0], [0.043, 0.095], [0.038, 0.095], [0.037, 0.01], [0, 0.01]]), 'china']], size: [0.085, 0.095, 0.085], grip: [0.05, 0.05, 0] }),
  stool: () => ({
    parts: [
      [lathe([[0, 0], [0.2, 0], [0.2, 0.02], [0.07, 0.06], [0.035, 0.1], [0.03, 0.66], [0.06, 0.68], [0, 0.68]], 32), 'metal'],
      [lathe([[0, 0.68], [0.19, 0.68], [0.2, 0.7], [0.2, 0.745], [0.185, 0.77], [0, 0.775]], 40), 'seat'],
    ],
    size: [0.4, 0.775, 0.4], grip: [0.19, 0.72, 0],
  }),
  ashtray: () => ({ parts: [[lathe([[0, 0], [0.05, 0], [0.055, 0.028], [0.045, 0.03], [0.04, 0.012], [0, 0.012]], 24), 'glass']], size: [0.11, 0.03, 0.11], grip: [0.05, 0.02, 0] }),
  cigarette: () => ({ parts: [[new THREE.CylinderGeometry(0.004, 0.004, 0.08, 12).translate(0, 0.04, 0), 'paper']], size: [0.008, 0.08, 0.008], grip: [0, 0.02, 0],
    rest: new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0.04, 0.004, 0) }),
  cigarettePack: () => ({ parts: [[box(0.055, 0.085, 0.022), 'paper']], size: [0.055, 0.085, 0.022], grip: [0, 0.04, 0] }),
  lighter: () => ({ parts: [[box(0.038, 0.055, 0.012, 0.003), 'metal']], size: [0.038, 0.055, 0.012], grip: [0, 0.025, 0] }),
  matchbook: () => ({ parts: [[box(0.038, 0.006, 0.05, 0.001), 'crew']], size: [0.038, 0.006, 0.05], grip: [0, 0.003, 0], accent: 'crew' }),
  wallet: () => ({ parts: [[box(0.11, 0.015, 0.09, 0.004), 'leather']], size: [0.11, 0.015, 0.09], grip: [0, 0.008, 0] }),
  coffeePot: () => ({ parts: [[lathe([[0, 0], [0.05, 0], [0.075, 0.05], [0.075, 0.1], [0.05, 0.15], [0.045, 0.2], [0.05, 0.21], [0, 0.21]]), 'glass']], size: [0.15, 0.21, 0.15], grip: [0.09, 0.14, 0] }),
  napkinBox: () => ({ parts: [[box(0.12, 0.1, 0.07, 0.006), 'metal']], size: [0.12, 0.1, 0.07], grip: [0, 0.05, 0] }),
  ketchup: () => SPECS.bottle('ketchup'),
  sugar: () => ({ parts: [[lathe([[0, 0], [0.035, 0], [0.035, 0.08], [0.028, 0.1], [0.012, 0.12], [0, 0.12]]), 'glass']], size: [0.07, 0.12, 0.07], grip: [0, 0.05, 0] }),
  menu: () => ({ parts: [[box(0.23, 0.004, 0.3, 0.001), 'paper']], size: [0.23, 0.004, 0.3], grip: [0.1, 0.002, 0] }),
  newspaper: () => ({ parts: [[box(0.3, 0.01, 0.2, 0.002), 'paper']], size: [0.3, 0.01, 0.2], grip: [0.14, 0.005, 0] }),
  pie: () => ({ parts: [[lathe([[0, 0], [0.11, 0], [0.115, 0.03], [0.1, 0.04], [0, 0.042]], 32), 'food']], size: [0.23, 0.042, 0.23], grip: [0.1, 0.02, 0] }),
  fork: () => ({ parts: [[box(0.02, 0.004, 0.19, 0.001), 'metal']], size: [0.02, 0.004, 0.19], grip: [0, 0.002, 0.05] }),
  knife: () => ({ parts: [[box(0.018, 0.004, 0.21, 0.001), 'metal']], size: [0.018, 0.004, 0.21], grip: [0, 0.002, 0.06] }),
};

export function buildProp(kind, { lod = 0, variant = null } = {}) {
  const spec = SPECS[kind];
  if (!spec) throw new Error(`buildProp: no kind '${kind}' (kinds: ${PROP_KINDS.join(', ')})`);
  const v = variant || (kind === 'bottle' ? 'scotch' : null);
  const S = spec(v);
  const M = mats();
  const g = new THREE.Group();
  g.name = 'prop_' + kind;
  const id = allocInkId();
  for (const [geo, mk] of S.parts) {
    let mat = M[mk];
    if (mk === 'crew') mat = CREW || (CREW = accentMaterial('crew'));
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = lod === 0 && kind === 'stool';
    m.receiveShadow = true;
    m.userData.inkId = id;
    g.add(m);
  }
  let liquid = null;
  if (S.liquid) {
    const L = S.liquid;
    if (!AMBER) AMBER = accentMaterial('amber');
    // (a unit-tall cylinder standing on the glass's inner floor, scaled to
    // the fill level)
    liquid = new THREE.Mesh(new THREE.CylinderGeometry(L.r, L.r, 1, 24).translate(0, 0.5, 0), AMBER);
    liquid.position.y = L.y0;
    liquid.userData.inkId = id;
    liquid.name = 'liquid';
    g.add(liquid);
  }
  const ud = g.userData;
  Object.assign(ud, {
    kind, variant: v, prop: true,
    size: new THREE.Vector3(...S.size),
    grip: new THREE.Matrix4().makeTranslation(...S.grip),
    rest: S.rest || new THREE.Matrix4(),
    inkIds: 1, inkId: id,
    accent: S.accent || null,
    fill: liquid ? 1 : 0, tilt: null, open: 0, tip: kind === 'cigarette' ? 'unlit' : null,
    setFill(f) {
      ud.fill = Math.max(0, Math.min(1, f));
      if (liquid) { liquid.scale.y = Math.max(1e-3, ud.fill * S.liquid.h); liquid.visible = ud.fill > 0.001; }
    },
    setTilt(q) { ud.tilt = q ? q.clone() : null; },
    setOpen(k) { ud.open = Math.max(0, Math.min(1, k)); },
    // a cigarette's tip (lane 5: unlit, lit with an ember, a grey ash end)
    setTip(state) {
      ud.tip = state;
      if (kind !== 'cigarette') return;
      let e = g.getObjectByName('ember');
      if (state === 'lit' && !e) {
        if (!EMBER) EMBER = accentMaterial('ember');
        e = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), EMBER);
        e.name = 'ember';
        e.position.y = 0.08;
        g.add(e);
      }
      if (e) e.visible = state === 'lit';
    },
  });
  if (liquid) ud.setFill(1);
  return g;
}
