import * as THREE from 'three';
import { allocInkId } from '../../render/layers.js';

// Room 304's venetian blind at the street window (lane B4): thin slats on
// their ladder tapes, tilted near shut with the street side down (the lamp
// comes through as slivers), a head rail and a bottom rail. Two fingers
// part it: the slat under them is pressed down and turned toward the line
// of sight, the one over it lifts: a slit about the fingers, bending out
// along the slats (object first: the hands' clip reads where the pressed
// slat's near edge is - fingerAt - and puts the fingertips on it).
//   const b = makeBlind(stage, { w, h })
//   b.place(centre, yaw)        its middle at the window, facing the room (yaw: the viewer's)
//   b.part(k)                   0 shut .. 1 parted
//   b.fingerAt(out)             the pressed slat's near edge under the fingers (world)
//   b.gapAt(out, dx)            the middle of the slit (world), dx along it: what the eye looks through
// (the slats' tilt: about their long axis, the street side down)
const PITCH = 0.042, DEPTH = 0.048, TILT = -1.12, OPEN = -0.62;
let MAT = null;
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function makeBlind(stage, { w = 1.04, h = 1.62, fx = 0.07 } = {}) {
  if (!MAT) MAT = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const id = allocInkId();
  const n = Math.floor((h - 0.1) / PITCH);
  const slats = [];
  // (the slat the fingers press: a little under the eye; it and its two
  // neighbours are finely cut so they can bend)
  const pressI = Math.round(n * 0.6);
  const slatGeo = (seg) => {
    const geo = new THREE.BoxGeometry(w, 0.0035, DEPTH, seg, 1, 2);
    const p = geo.getAttribute('position');
    // a shallow crown across its depth
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, p.getY(i) + 0.004 * (1 - (2 * z / DEPTH) ** 2)); }
    geo.computeVertexNormals();
    return geo;
  };
  for (let i = 0; i < n; i++) {
    const bend = i >= pressI - 1 && i <= pressI + 1;
    const geo = slatGeo(bend ? 48 : 1);
    const m = new THREE.Mesh(geo, MAT);
    m.position.set(0, h / 2 - 0.06 - i * PITCH, 0);
    m.rotation.x = TILT;
    m.userData.inkId = id; m.userData.noRay = true;
    m.castShadow = true; m.receiveShadow = true;
    if (bend) m.userData.base = geo.getAttribute('position').array.slice();
    g.add(m);
    slats.push(m);
  }
  const rails = [new THREE.BoxGeometry(w + 0.04, 0.045, 0.06).translate(0, h / 2, 0), new THREE.BoxGeometry(w, 0.025, 0.05).translate(0, -h / 2 + 0.02, 0)];
  for (const x of [-w * 0.36, w * 0.36]) for (const z of [-DEPTH / 2, DEPTH / 2]) rails.push(new THREE.BoxGeometry(0.006, h, 0.002).translate(x, 0, z));
  for (const r of rails) { const m = new THREE.Mesh(r, MAT); m.userData.inkId = id; m.userData.noRay = true; g.add(m); }
  stage.scene.add(g);
  // one slat bent: within the fingers' bell it turns from TILT toward
  // `tilt` about its own middle and moves `dy` (the blind's vertical)
  const bendSlat = (m, tilt, dy) => {
    const base = m.userData.base, p = m.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      const bell = Math.exp(-((x - fx) ** 2) / 0.03);
      const d = (tilt - TILT) * bell, c = Math.cos(d), s = Math.sin(d);
      // (turned in its own frame, then moved: dy up the blind is
      // (dy cos T, -dy sin T) in the slat's)
      const yy = y * c - z * s, zz = y * s + z * c;
      const D = dy * bell;
      p.setXYZ(i, x, yy + D * Math.cos(TILT), zz - D * Math.sin(TILT));
    }
    p.needsUpdate = true;
    m.geometry.computeVertexNormals();
  };
  const B = {
    group: g, slats, pressI, k: 0, fx,
    place(c, yaw) { g.position.copy(c); g.rotation.set(0, yaw, 0); g.updateMatrixWorld(true); },
    part(k) {
      this.k = k;
      const a = sm(k);
      // the pressed slat down and turned to the eye's line; the one over it
      // up and turned the same way; the one under it pushed down a little
      bendSlat(slats[pressI], TILT + (OPEN - TILT) * a, -0.024 * a);
      if (slats[pressI - 1]) bendSlat(slats[pressI - 1], TILT + (OPEN - 0.1 - TILT) * a, 0.026 * a);
      if (slats[pressI + 1]) bendSlat(slats[pressI + 1], TILT + (OPEN + 0.25 - TILT) * a * 0.6, -0.01 * a);
    },
    // the pressed slat's near edge (the room side) under the fingers
    fingerAt(out = new THREE.Vector3()) {
      const m = slats[pressI];
      m.updateMatrixWorld(true);
      const tilt = TILT + (OPEN - TILT) * sm(this.k);
      const d = tilt - TILT;
      // (the base point, turned and moved as bendSlat does at the bell's top)
      const y = 0.005, z = DEPTH * 0.42;
      const yy = y * Math.cos(d) - z * Math.sin(d), zz = y * Math.sin(d) + z * Math.cos(d);
      const D = -0.024 * sm(this.k);
      return out.set(fx, yy + D * Math.cos(TILT), zz - D * Math.sin(TILT)).applyMatrix4(m.matrixWorld);
    },
    // (dx: along the slats from the fingers; the eye looks through the slit
    // a little to the left of them, so the hand is not in the way)
    gapAt(out = new THREE.Vector3(), dx = 0) {
      const m = slats[pressI];
      m.updateMatrixWorld(true);
      return out.set(fx + dx, 0, 0).applyMatrix4(m.matrixWorld).add(_up.set(0, PITCH * 0.5 + 0.01 * sm(this.k), 0));
    },
    dispose() { stage.scene.remove(g); },
  };
  return B;
}
const _up = new THREE.Vector3();
