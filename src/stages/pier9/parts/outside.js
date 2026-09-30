import * as THREE from 'three';
import { PIER } from '../site.js';
import { makeKit } from '../kit.js';
import { mergeGeos, lathe } from '../../../props/lib.js';
import { SEDAN_SHAPES } from '../../../world/Cars.js';
import { markFigure, LAYER } from '../../../render/layers.js';
import { glintMaterial } from './ground.js';

// Outside the shed (lane B6): the yard at the pier's root behind its gate,
// my car left in the dark by the fence, bollards along the edges, a lamp on
// a pole by the gate (its column in the wet concrete), and along the east
// side a freighter's black hull with one riding light high on its mast, its
// light broken in the river below.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);

// the detective's dark coupe (the block's sedan shapes, extruded plainly)
function buildCar(kit, stage) {
  const { M } = kit;
  const g = new THREE.Group();
  const ex = (s, d, bt, bs) => { const e = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 4, curveSegments: 16 }); e.translate(0, 0, -d / 2); return e; };
  kit.piece();
  const paint = [ex(SEDAN_SHAPES.body(), 1.2, 0.1, 0.08), ex(SEDAN_SHAPES.cabin(), 1.0, 0.12, 0.09)];
  for (const s of [1, -1]) { paint.push(ex(SEDAN_SHAPES.fender(true), 0.22, 0.07, 0.06).translate(0, 0, s * 0.78)); paint.push(ex(SEDAN_SHAPES.fender(false), 0.2, 0.07, 0.06).translate(0, 0, s * 0.76)); }
  kit.add(mergeGeos(paint), stage.M.paint, { parent: g });
  kit.piece();
  const dark = [];
  for (const [x, z] of [[1.55, 0.78], [1.55, -0.78], [-1.55, 0.76], [-1.55, -0.76]]) dark.push(new THREE.TorusGeometry(0.27, 0.105, 12, 28).translate(x, 0.375, z), new THREE.CylinderGeometry(0.26, 0.26, 0.12, 20).rotateX(Math.PI / 2).translate(x, 0.375, z));
  for (const s of [1, -1]) dark.push(new THREE.BoxGeometry(1.2, 0.36, 0.01).translate(-0.3, 1.38, s * 0.625));
  dark.push(new THREE.BoxGeometry(0.01, 0.4, 1.0).rotateZ(0.5).translate(0.6, 1.36, 0));
  kit.add(mergeGeos(dark), M.tyre, { parent: g });
  markFigure(g);
  return g;
}

export default {
  name: 'outside', order: 90,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'pier9_outside';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const { M } = kit;
    const C = stage.colliders;
    const L = PIER.land;

    // ---- my car, by the fence
    const car = buildCar(kit, stage);
    car.position.set(PIER.car.x, 0, PIER.car.z);
    car.rotation.y = PIER.car.yaw + Math.PI / 2;
    g.add(car);
    C.addBox(PIER.car.x, PIER.car.z, 2.4, 0.95, PIER.car.yaw + Math.PI / 2, 'car');

    // ---- the fence and the gate across the yard
    kit.piece();
    const fence = [];
    const gz = PIER.gate.z;
    for (let x = L.x0 + 1; x < L.x1; x += 2.5) {
      if (Math.abs(x) < 4.5) continue;
      fence.push(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6).translate(x, 1.2, gz));
    }
    for (const y of [0.15, 2.3]) for (const [x0, x1] of [[L.x0 + 1, -4.5], [4.5, L.x1]]) fence.push(new THREE.CylinderGeometry(0.02, 0.02, x1 - x0, 5).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, y, gz));
    // the gate posts and the open gate leaf, swung back along the fence
    for (const x of [-4.4, 4.4]) fence.push(new THREE.BoxGeometry(0.4, 2.8, 0.4).translate(x, 1.4, gz));
    for (let k = 0; k <= 8; k++) fence.push(new THREE.CylinderGeometry(0.018, 0.018, 2.0, 5).translate(4.6 + k * 0.45, 1.1, gz - 0.3));
    for (const y of [0.2, 2.05]) fence.push(new THREE.CylinderGeometry(0.025, 0.025, 3.7, 5).rotateZ(Math.PI / 2).translate(6.4, y, gz - 0.3));
    kit.addMerged(fence, M.iron, { cast: true });
    // the wire mesh: a faint dark screen (not a solid: eyes and light pass)
    kit.piece();
    const meshMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    for (const [x0, x1] of [[L.x0 + 1, -4.5], [4.5, L.x1]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 2.15).translate((x0 + x1) / 2, 1.22, gz), meshMat);
      w.userData.noRay = true; w.layers.set(LAYER.FX);
      g.add(w);
    }
    for (const [x0, x1] of [[L.x0 + 1, -4.5], [4.5, L.x1]]) C.addBox((x0 + x1) / 2, gz, (x1 - x0) / 2, 0.1, 0, 'fence');

    // ---- bollards on the edges
    kit.piece();
    const bol = [];
    const bollard = (x, z) => { bol.push(lathe([[0.001, 0], [0.16, 0], [0.16, 0.5], [0.2, 0.56], [0.2, 0.62], [0.12, 0.66], [0.001, 0.68]], 18).translate(x, 0, z)); C.addCircle(x, z, 0.22, 'bollard'); };
    for (let z = -3; z > PIER.apron.z0 + 1; z -= 7) bollard(PIER.apron.x1 - 0.35, z);
    for (const x of [-20, -26, 22, 28]) bollard(x, 0.4);
    kit.addMerged(bol, M.iron, { cast: true });
    // a few crates and a pallet stack in the yard
    kit.piece();
    const yd = [];
    for (const [x, z, h] of [[11, 8, 1.1], [12.3, 8.2, 1.1], [11.6, 8.1, 2.2], [-17, 6, 1.0], [-18.2, 6.4, 1.0]]) { yd.push(new THREE.BoxGeometry(1.15, 1.05, 1.15).translate(x, h - 0.52, z)); C.addBox(x, z, 0.6, 0.6, 0, 'crates'); }
    kit.addMerged(yd, M.crateDark, { cast: true });

    // ---- the gate lamp on its pole
    kit.piece();
    const lp = V(7.4, 5.2, gz - 1.2);
    const pole = mergeGeos([
      lathe([[0.001, 0], [0.18, 0], [0.14, 0.3], [0.08, 0.5], [0.07, 5.2], [0.001, 5.25]], 16).translate(lp.x - 1.1, 0, lp.z),
      new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6).rotateZ(Math.PI / 2).translate(lp.x - 0.55, 5.2, lp.z),
      lathe([[0.03, 0.12], [0.1, 0.05], [0.28, -0.1], [0.3, -0.13]], 24).translate(lp.x, lp.y - 0.05, lp.z),
    ]);
    kit.add(pole, M.iron, { cast: true });
    C.addCircle(lp.x - 1.1, lp.z, 0.2, 'lamp');
    const gb = kit.add(new THREE.CircleGeometry(0.22, 20).rotateX(Math.PI / 2).translate(lp.x, lp.y - 0.19, lp.z), M.bulb, { cast: false, noRay: true });
    const gateLamp = stage.lamps.addCustom({ head: V(lp.x, lp.y - 0.2, lp.z), axis: V(0, -1, 0), height: 5.0, half: 0.46, real: true, bulb: gb, fadeEnd: 0.9, edgeSoft: 0.3, strength: 1, tag: 'gate' });
    if (gateLamp.light) { gateLamp.light.intensity = 90; gateLamp.light.distance = 22; }

    // ---- the freighter along the east side
    kit.piece();
    const F = PIER.freighter;
    const len = F.z1 - F.z0, zc = (F.z0 + F.z1) / 2;
    // the hull: a section extruded along its length, the bow and the stern
    // drawn in by a taper
    const sec = new THREE.Shape([V2(-4.5, -2), V2(4.5, -2), V2(4.7, 5.6), V2(4.9, 6.4), V2(-4.9, 6.4), V2(-4.7, 5.6)]);
    const hull = new THREE.ExtrudeGeometry(sec, { depth: len, bevelEnabled: false, steps: 24 });
    const P = hull.getAttribute('position');
    for (let i = 0; i < P.count; i++) {
      const u = P.getZ(i) / len;
      const bow = Math.min(1, u / 0.12), stern = Math.min(1, (1 - u) / 0.05);
      const k = Math.min(Math.sqrt(bow), 0.35 + 0.65 * stern);
      P.setX(i, P.getX(i) * k);
      P.setY(i, P.getY(i) + 1.2 * (1 - Math.min(1, u / 0.2)) ** 2 + 0.6 * (1 - Math.min(1, (1 - u) / 0.1)) ** 2);
    }
    hull.computeVertexNormals();
    hull.translate(F.x, PIER.waterY, F.z0);
    const sup = [
      new THREE.BoxGeometry(7.4, 4.2, 9).translate(F.x, PIER.waterY + 6.4 + 2.1, F.z1 - 12),
      new THREE.BoxGeometry(5.5, 2.4, 6).translate(F.x, PIER.waterY + 6.4 + 5.4, F.z1 - 12),
      new THREE.CylinderGeometry(1.1, 1.3, 5.5, 18).translate(F.x, PIER.waterY + 6.4 + 7, F.z1 - 20),
      new THREE.CylinderGeometry(0.18, 0.24, 16, 10).translate(F.x, PIER.waterY + 6.4 + 8, F.z0 + 16),
      new THREE.CylinderGeometry(0.12, 0.16, 11, 10).translate(F.x, PIER.waterY + 6.4 + 11, F.z1 - 14),
    ];
    kit.add(mergeGeos([hull, ...sup]), M.hull, { cast: false });
    // a few dull portholes aft, one lit
    kit.piece();
    const ports = [];
    for (let i = 0; i < 7; i++) ports.push(new THREE.CircleGeometry(0.2, 14).rotateY(-Math.PI / 2).translate(F.x - 3.72, PIER.waterY + 6.4 + 2.2, F.z1 - 16 + i * 1.4));
    kit.add(mergeGeos(ports), M.glow('portholes', 0.05), { cast: false, noRay: true });
    // the riding light on the foremast: a white point, its glint in the river
    const ride = V(F.x, PIER.waterY + 6.4 + 15.6, F.z0 + 16);
    kit.piece();
    kit.add(new THREE.SphereGeometry(0.2, 14, 10).translate(ride.x, ride.y, ride.z), M.glow('ridingLight', 14), { cast: false, noRay: true });
    // ([R2-E] and her stern light on the aft mast: the first frame, from by
    // my car, sees it over her superstructure)
    kit.add(new THREE.SphereGeometry(0.16, 14, 10).translate(F.x, PIER.waterY + 6.4 + 16.6, F.z1 - 14), M.glow('ridingLight', 14), { cast: false, noRay: true });
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 26).rotateX(-Math.PI / 2).translate(ride.x - 4.2, PIER.waterY + 0.02, ride.z + 13), glintMaterial(stage.U, { gain: 0.5 }));
    gl.layers.set(LAYER.FX); gl.userData.noRay = true;
    g.add(gl);
    // the gate lamp's own glint where the land meets the river is its wet
    // street column (the ground's reflection); the shed's door lamp too

    // ---- the anchors
    const A = (name, x, y, z, yaw) => stage.addAnchor('pier9.' + name, { pos: V(x, y, z), yaw });
    A('start', PIER.start.x, 0, PIER.start.z, PIER.start.yaw);
    A('door.out', PIER.sideDoor.x + 0.2, 0, 1.6, 0);
    A('door.in', PIER.sideDoor.x, 0, -1.2, 0);
    return { group: g, car, gateLamp, ride };
  },
};
