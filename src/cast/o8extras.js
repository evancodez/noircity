import * as THREE from 'three';
import { hoodMaterial } from '../enemies/Hood.js';
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
