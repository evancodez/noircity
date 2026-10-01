import * as THREE from 'three';
import { LAYER } from '../../render/layers.js';

// [R2-G] What can be seen through the alley's mouth (scene 3's frame rate,
// as site.js's dinerInSight does for the diner's room). The alley is a slot
// between two buildings: the near building's end (z > zS) and the far
// block's (z < zN), both walls from the building line (x = mouthX) back
// sixteen metres. So:
//   from inside the alley, a thing on the street side of the building line
//   is seen only if a line from the eye to it crosses the building line
//   inside the mouth (zN .. zS); and a thing inside those buildings (the
//   shop rooms behind the glass, the diner's front) is never seen;
//   from the street, a thing inside the alley is seen only through the
//   mouth, by the same test the other way round.
// Every step (every fourth) the street's parts and the alley's own are
// tested box by box (the extremes of a box's crossing are at its corners:
// exact for the two walls) and what cannot be seen is not drawn - and so
// casts no shadow into a lamp's map and sends nothing to the mirror. The
// shop rooms, the diner's front, the parked cars and the street's props
// behind the corner go when I am in the alley; the alley's fire escape,
// its bins, its step and door go while I am out on the pavement short of
// the mouth. Moving things (the cast, the train, the crew's car), anything
// larger than a house, and what is not on the world's layer are left alone.
// Everything is given back when the scene ends (restore()).
// (no default export: not a scene)
const TOP = ['shops', 'dinerFront', 'props', 'dressing', 'bounds', 'facade', 'alley', 'cars', 'lamps'];
const MAX_DIAG = 30;          // (bigger than this: the facade's mass, the block's edges... kept)
const M = 0.35;               // (the mouth a little wider than it is: a margin, no pop at its edge)
const DEEP = 16.5;            // (the buildings either side, back from the building line)
const _b = new THREE.Box3();

export function alleySight(stage, A) {
  const sc = stage.scene;
  const X = A.mouthX, zS = A.zS, zN = A.zN;
  let list = null;
  const S = { hidden: new Set(), n: 0, tick: 0 };
  // the candidates: the named parts' children, and the block's parked cars
  // (unnamed groups of a dozen meshes at road level), each with its box
  const build = () => {
    list = [];
    const add = (o) => {
      if (!o.visible) return;
      let skip = false, meshes = 0;
      o.traverse((q) => { if (q.isSkinnedMesh || q.userData.lamp || (q.isMesh && !q.layers.test(WORLD))) skip = true; if (q.isMesh) meshes++; });
      if (skip || !meshes) return;
      _b.setFromObject(o);
      if (_b.isEmpty()) return;
      const d = _b.getSize(new THREE.Vector3()).length();
      if (d > MAX_DIAG) { for (const c of o.children) if (c.children.length || c.isMesh) addSmall(c); return; }
      list.push({ o, box: _b.clone() });
    };
    const addSmall = (c) => { _b.setFromObject(c); if (!_b.isEmpty() && _b.getSize(new THREE.Vector3()).length() <= MAX_DIAG) add(c); };
    for (const c of sc.children) {
      if (TOP.includes(c.name)) { for (const k of c.children) add(k); }
      else if (!c.name && c.type === 'Group' && c.children.length >= 6 && c.children.length <= 16) add(c);   // a parked car
    }
  };
  const WORLD = new THREE.Layers(); WORLD.set(LAYER.WORLD);
  // the z at which the line from the eye to a corner crosses the building line
  const crossZ = (E, x, z) => E.z + (z - E.z) * (X - E.x) / (x - E.x);
  const throughMouth = (E, b) => {
    let lo = Infinity, hi = -Infinity;
    for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) { const c = crossZ(E, x, z); lo = Math.min(lo, c); hi = Math.max(hi, c); }
    return hi >= zN - M && lo <= zS + M;
  };
  const inAlley = (E) => E.x < X - 0.05 && E.z < zS + 0.05 && E.z > zN - 0.05;
  const seen = (E, b) => {
    if (inAlley(E)) {
      // (the street side: through the mouth only)
      if (b.min.x >= X) return throughMouth(E, b);
      // (inside the buildings either side: never)
      // (strictly behind the alley's two faces: its own brick lies on them)
      if (b.max.x <= X + 0.02 && b.min.x >= X - DEEP && (b.min.z >= zS - 0.02 || b.max.z <= zN - 0.05)) return false;
      return true;
    }
    if (E.x > X + 0.05) {
      // (in the alley, seen from the street: through the mouth only)
      if (b.max.x <= X - 0.05 && b.min.z >= zN - 0.5 && b.max.z <= zS + 0.5) return throughMouth(E, b);
      return true;
    }
    return true;
  };
  S.step = (E, on = true) => {
    if ((S.tick++ & 3) !== 0) return;
    if (!list) build();
    let changed = false;
    for (const it of list) {
      const hide = on && !seen(E, it.box);
      if (hide && !S.hidden.has(it)) { if (it.o.visible) { it.o.visible = false; S.hidden.add(it); changed = true; } }
      else if (!hide && S.hidden.has(it)) { it.o.visible = true; S.hidden.delete(it); changed = true; }
    }
    S.n = S.hidden.size;
    if (changed && stage.game && stage.game.pipeline && stage.game.pipeline.dirtyShadows) stage.game.pipeline.dirtyShadows();
  };
  // (look development: what is tested, what is hidden)
  S.debug = () => (list || []).map((it) => ({ n: it.o.name || it.o.parent.name + '/' + it.o.type, hid: S.hidden.has(it), x: [+it.box.min.x.toFixed(1), +it.box.max.x.toFixed(1)], z: [+it.box.min.z.toFixed(1), +it.box.max.z.toFixed(1)] }));
  S.restore = () => {
    for (const it of S.hidden) it.o.visible = true;
    const had = S.hidden.size;
    S.hidden.clear(); S.n = 0;
    if (had && stage.game && stage.game.pipeline && stage.game.pipeline.dirtyShadows) stage.game.pipeline.dirtyShadows();
  };
  return S;
}
