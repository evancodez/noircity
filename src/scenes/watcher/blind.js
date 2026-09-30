import * as THREE from 'three';
import { allocInkId } from '../../render/layers.js';

// Room 304's venetian blind at the street window (lane B4): thin slats on
// their ladder tapes, tilted half shut, a head rail and a bottom rail. Two
// fingers part it: the slat under them is pressed down and the one over it
// lifts, bending about the fingers (object first: the hands' clip reads
// where the slat's edge is and puts the fingertips on it).
//   const b = makeBlind(stage, { w, h })
//   b.place(centre, yaw)        its middle at the window, facing the room (yaw: the viewer's)
//   b.part(k)                   0 shut .. 1 parted (a 7 cm gap)
//   b.fingerAt(out)             the pressed slat's top edge under the fingers (world)
//   b.gapAt(out)                the middle of the gap (world): what the eye looks through
// (tilted with the street side down: from the room the eye looks down
// through them, as a man at a third-floor window looks at the street)
const PITCH = 0.042, DEPTH = 0.048, TILT = -1.12;
let MAT = null;

export function makeBlind(stage, { w = 1.04, h = 1.62, fx = 0.06 } = {}) {
  if (!MAT) MAT = new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const id = allocInkId();
  const n = Math.floor((h - 0.1) / PITCH);
  const slats = [];
  // (the slat at the eye's height: the one the fingers press; it and the one
  // over it are finely cut so they can bend)
  const pressI = Math.round(n * 0.38);
  const slatGeo = (seg) => {
    const geo = new THREE.BoxGeometry(w, 0.0035, DEPTH, seg, 1, 2);
    // a shallow crown across its depth
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, p.getY(i) + 0.004 * (1 - (2 * z / DEPTH) ** 2)); }
    geo.computeVertexNormals();
    return geo;
  };
  for (let i = 0; i < n; i++) {
    const bend = i === pressI || i === pressI + 1;
    const geo = slatGeo(bend ? 40 : 1);
    const m = new THREE.Mesh(geo, MAT);
    m.position.set(0, h / 2 - 0.06 - i * PITCH, 0);
    m.rotation.x = TILT;
    m.userData.inkId = id; m.userData.noRay = true;
    m.castShadow = true; m.receiveShadow = true;
    if (bend) m.userData.base = geo.getAttribute('position').array.slice();
    g.add(m);
    slats.push(m);
  }
  // the head rail, the bottom rail, the ladder tapes and the cord
  const rails = [new THREE.BoxGeometry(w + 0.04, 0.045, 0.06).translate(0, h / 2, 0), new THREE.BoxGeometry(w, 0.025, 0.05).translate(0, -h / 2 + 0.02, 0)];
  for (const x of [-w * 0.36, w * 0.36]) for (const z of [-DEPTH / 2, DEPTH / 2]) rails.push(new THREE.BoxGeometry(0.006, h, 0.002).translate(x, 0, z));
  for (const r of rails) { const m = new THREE.Mesh(r, MAT); m.userData.inkId = id; m.userData.noRay = true; g.add(m); }
  g.visible = true;
  stage.scene.add(g);
  const B = {
    group: g, slats, pressI, k: 0, fx,
    place(c, yaw) { g.position.copy(c); g.rotation.set(0, yaw, 0); g.updateMatrixWorld(true); },
    part(k) {
      this.k = k;
      for (const [j, sgn] of [[pressI, -1], [pressI + 1, -1], [pressI - 1, 1]]) {
        const m = slats[j];
        if (!m || !m.userData.base) continue;
        const base = m.userData.base, p = m.geometry.getAttribute('position');
        // pressed down (and flattened toward level) under the fingers, the
        // one over lifted: a bell of about the fingers' span
        const amp = (j === pressI ? 0.05 : j === pressI + 1 ? 0.022 : 0) * k;
        for (let i = 0; i < p.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
          const bell = Math.exp(-((x - fx) ** 2) / 0.018);
          // (the slat turns toward flat where it is pressed: its near edge
          // goes down more than its far edge)
          const d = amp * bell * (1 + 0.5 * (z / DEPTH));
          p.setXYZ(i, x, y + sgn * d, z);
        }
        p.needsUpdate = true;
        m.geometry.computeVertexNormals();
      }
      // (the slat over the gap lifts as a whole, a little)
      const up = slats[pressI - 1];
      if (up) up.rotation.x = TILT - 0.22 * k;
    },
    fingerAt(out = new THREE.Vector3()) {
      const m = slats[pressI];
      m.updateMatrixWorld(true);
      return out.set(fx, 0.004 - 0.05 * this.k, -DEPTH * 0.3).applyMatrix4(m.matrixWorld);
    },
    gapAt(out = new THREE.Vector3()) {
      const m = slats[pressI];
      m.updateMatrixWorld(true);
      return out.set(fx, PITCH * 0.5, 0).applyMatrix4(m.matrixWorld);
    },
    dispose() { stage.scene.remove(g); },
  };
  return B;
}
