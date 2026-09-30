import * as THREE from 'three';
import { allocInkId } from '../../../render/layers.js';
import { merge, V3 } from '../../../world/geom.js';
import { ROAD, roadPoint } from '../road.js';

// The market's light (lane B5): strings of bare bulbs looped between the
// el's near columns over the stalls, and a lantern hung over every few
// stalls with its cone in the rain (a lamp of the stage's: it takes a pool
// light when it is among the nearest). The stalls and what is on them come
// out of the dark under the el; the strings carry the eye down the stretch.
const SPAN = 11.5;

export default {
  name: 'market', order: 88,
  build(stage) {
    const { scene } = stage;
    const L = stage.lamps;
    const M0 = ROAD.marks.market, M1 = ROAD.marks.marketEnd;
    const wires = [], bulbs = [];
    const dA = ROAD.elA + 0.5;
    // (the columns stand at 4 + k * SPAN along the road)
    for (let k = Math.ceil((M0 - 4) / SPAN); 4 + (k + 1) * SPAN <= M1 + 4; k++) {
      const s0 = 4 + k * SPAN, s1 = s0 + SPAN;
      // two strings: along the columns' line, and one across to the far line
      for (const [a, b, y0, sag] of [[[s0, dA], [s1, dA], 4.6, 0.9], [[s0 + 0.2, dA], [s0 + 0.2, ROAD.elB - 0.5], 4.9, 0.6]]) {
        const pa = roadPoint(a[0], a[1], y0), pb = roadPoint(b[0], b[1], y0);
        const pts = [];
        for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push(new THREE.Vector3().lerpVectors(pa, pb, u).setY(y0 - sag * 4 * u * (1 - u))); }
        wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 4));
        const n = Math.round(pa.distanceTo(pb) / 0.95);
        for (let i = 1; i < n; i++) {
          const u = i / n;
          const p = new THREE.Vector3().lerpVectors(pa, pb, u).setY(y0 - sag * 4 * u * (1 - u) - 0.09);
          bulbs.push(p);
        }
      }
    }
    const wm = new THREE.Mesh(merge(wires), stage.M.iron);
    wm.userData.inkId = allocInkId();
    wm.userData.noRay = true;
    scene.add(wm);
    // the bulbs: small bright spheres (the bloom makes them glow), one draw
    const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(5) }), bulbs.length);
    const m = new THREE.Matrix4();
    bulbs.forEach((p, i) => bm.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    bm.instanceMatrix.needsUpdate = true;
    bm.userData.inkId = allocInkId();
    bm.userData.inkPerInstance = false;
    bm.userData.noRay = true;
    bm.frustumCulled = false;
    scene.add(bm);
    // the lanterns: a shade on a wire over the stalls, every third span
    const lanterns = [];
    const shadeGeo = new THREE.LatheGeometry([[0.02, 0.1], [0.05, 0.06], [0.1, 0.0], [0.2, -0.1], [0.24, -0.16], [0.22, -0.16]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
    const shadeMat = stage.M.lampShade, bulbMat = stage.M.bulb;
    for (let s = M0 + 14; s < M1 - 6; s += SPAN * 2.5) {
      const head = roadPoint(s, -10.4, 3.5);
      const g = new THREE.Group();
      g.position.copy(head).setY(head.y + 0.16);
      const shade = new THREE.Mesh(shadeGeo, shadeMat);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20).rotateX(Math.PI / 2).translate(0, -0.15, 0), bulbMat);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4).translate(0, 0.7, 0), stage.M.iron);
      g.add(shade, bulb, wire);
      const id = allocInkId();
      g.traverse((o) => { if (o.isMesh) { o.userData.inkId = id; o.userData.noRay = true; } });
      shade.userData.inkFigure = true;
      scene.add(g);
      const lamp = L.addCustom({ head: head.clone(), axis: V3(0, -1, 0), height: 3.4, half: 0.62, real: true, bulb, fadeEnd: 0.85, edgeSoft: 0.25, strength: 0.85, tag: 'market' });
      lamp.s = s; lamp.d = -10.4;
      lanterns.push(lamp);
    }
    return { lanterns, bulbs: bm, wires: wm };
  },
};
