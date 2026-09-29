import * as THREE from 'three';
import { allocInkId } from '../render/layers.js';
import { SPECS, PROP_KINDS, BOTTLE_VARIANTS } from './kinds.js';

// The prop library (docs/story/CONTRACTS.md §8.1): the small objects of the
// story, built by one function so the thing on the counter and the thing in
// the hand are the same object.
//   buildProp(kind, { lod: 0 | 1, variant? }) -> THREE.Group
//   .userData = { kind, variant, prop: true, size: Vector3, grip: Matrix4,
//                 rest: Matrix4, inkIds: n, inkId (the first), accent?: key,
//                 fill, setFill(0..1), setTilt(quaternion | null),
//                 open, setOpen(0..1), tip, setTip('unlit' | 'lit' | 'ash'),
//                 ... the kind's own (below) }
// Frame: the origin is the middle of the prop's base (it stands on a
// surface at y = 0 in its own frame), +y up, its face (a label, a pack's
// front) toward +z; `rest` is how it lies on a surface (identity for
// everything that stands; a cigarette lies on its side), and `grip` is where
// a hand holds it (the palm's centre). size is the bounding box, metres.
// Each prop takes consecutive ink ids of its own where a contour should
// separate its parts (the glass from the scotch, the lid from the case).
//
// Kinds (src/props/kinds.js):
//   tumbler     8.5 x 7.5 cm, ten cut flutes, a thick base; the scotch is a
//               mesh of its own (accent amber): setFill (full = 40 % of the
//               height, a double), setTilt(q) keeps its surface level in
//               the world (q: the glass's world quaternion), ripple(k, dt)
//   bottle      variants scotch (28 cm, squat shoulders, label, cork, amber
//               inside: setFill / setTilt), rye, gin, beer, ketchup, milk;
//               userData.neck: the mouth, where a pour's stream leaves
//   cigarette   8 cm; setTip('unlit' | 'lit' | 'ash'), setAsh(m), dropAsh()
//               -> world point, tick(dt, drag 0..1) burns it; tipPos
//   cigarettePack  soft, torn open, two cigarettes standing proud
//   lighter     flat flip-top: setOpen(0..1) (the lid on its side hinge),
//               strike(rad) turns the wheel; userData.flame: where the
//               flame stands (lane 3 / lane 1 draw it)
//   matchbook   red (accent crew), the black bird, THE CARDINAL; setOpen
//   wallet      opens like a book (setOpen); the licence card behind its
//               window (userData.card): a dark oval photograph, three short
//               lines, PRIVATE INVESTIGATOR
//   plate cup saucer mug (cup / mug hold coffee: setFill, ripple)
//   coffeePot   a glass globe pot, a dark band and handle, coffee near black
//               (setFill); userData.spout
//   pie ashtray stool napkinBox sugar menu newspaper ('open': a sheet held
//   up to read) fork knife ketchup
export { PROP_KINDS, BOTTLE_VARIANTS };

export function buildProp(kind, { lod = 0, variant = null } = {}) {
  const spec = SPECS[kind];
  if (!spec) throw new Error(`buildProp: no kind '${kind}' (kinds: ${PROP_KINDS.join(', ')})`);
  const v = variant || (kind === 'bottle' ? 'scotch' : null);
  const S = spec(v, lod);
  const g = new THREE.Group();
  g.name = 'prop_' + kind + (v ? '_' + v : '');
  const nIds = 1 + S.parts.reduce((m, p) => Math.max(m, p.id || 0), 0);
  const id0 = allocInkId(nIds);
  const by = {};
  // pivot groups first (a lid, a cover, a seat), then the meshes
  for (const [name, at] of Object.entries(S.groups || {})) {
    const pg = new THREE.Group();
    pg.name = name;
    pg.position.set(...at);
    g.add(pg);
    by[name] = pg;
  }
  for (const p of S.parts) {
    const m = p.mesh || new THREE.Mesh(p.geo, p.side ? cloneSide(p.mat, p.side) : p.mat);
    m.castShadow = lod === 0 && p.cast !== false;
    m.receiveShadow = true;
    m.userData.inkId = id0 + (p.id || 0);
    if (p.mat && p.mat.transparent) m.renderOrder = 1;
    let parent = g;
    if (p.pivot) {
      const pg = new THREE.Group();
      pg.name = p.name;
      pg.position.set(...p.pivot);
      g.add(pg);
      pg.add(m);
      by[p.name] = pg;
      continue;
    }
    if (p.parent) parent = by[p.parent];
    if (p.name && !by[p.name]) { m.name = p.name; by[p.name] = m; }
    parent.add(m);
  }
  const box = new THREE.Box3().setFromObject(g);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  const ud = g.userData;
  Object.assign(ud, {
    kind, variant: v, prop: true, lod,
    size,
    grip: S.grip && S.grip.isMatrix4 ? S.grip : new THREE.Matrix4().makeTranslation(...(S.grip || [0, 0, 0])),
    rest: S.rest || new THREE.Matrix4(),
    inkIds: nIds, inkId: id0,
    accent: S.accent || null,
    fill: 0, tilt: null, open: 0, tip: null,
    // (defaults: a prop without the behaviour records the value)
    setFill(f) { ud.fill = f; },
    setTilt(q) { ud.tilt = q ? q.clone() : null; },
    setOpen(k) { ud.open = k; },
    setTip(s) { ud.tip = s; },
    parts: by,
  });
  if (S.init) S.init(g, ud, by);
  return g;
}

// (a part that must be seen from both sides: a plane of paper, a cut face)
const sideCache = new Map();
function cloneSide(mat, side) {
  const k = mat.uuid + side;
  if (!sideCache.has(k)) { const m = mat.clone(); m.side = side; m.name = mat.name + '_2s'; sideCache.set(k, m); }
  return sideCache.get(k);
}
