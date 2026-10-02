import * as THREE from 'three';
import { LAYER, tagInk, allocInkId } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { merge } from '../../../world/geom.js';
import { makeKit } from '../../../props/diner/kit.js';
import { mergeGeos, lathe } from '../../../props/lib.js';
import { officeMats } from '../../office/build/mats.js';
import { wallGeos } from '../../office/build/walls.js';
import { FLOOR, T, HOUSE, STREET, DOORS, DOOR_H, WINDOWS, WIN_Y, LOADING, BOUNDS, HYDRANT, STREET_CRATES } from '../plan.js';

// The killhouse's street (lane C2): one wet plane at y 0 (the wet-street
// shader: puddles, ripples, the lamps streaked down it), the near pavement
// under the house's front and the far one under the warehouse, both 0.15 on
// kerbs; the house's front faced in stone, the warehouse wall across the way
// with its loading door (the dark the men come out of), barricades closing
// the street's ends, a hydrant, crates. It is the stage's `street`
// (addImpact: the footfalls' and the rounds' ripples).
const TOP = FLOOR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PAVES = [
  [STREET.x0, STREET.x1, STREET.pave0 - 0.02, STREET.kerb],
  [STREET.x0, STREET.x1, STREET.farKerb, STREET.wall],
];
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function inside(x, z, [x0, x1, z0, z1], e = 0.12) {
  const kx = ss(x0 - e, x0 + e, x) * (1 - ss(x1 - e, x1 + e, x));
  const kz = ss(z0 - e, z0 + e, z) * (1 - ss(z1 - e, z1 + e, z));
  return kx * kz;
}
export function surfaceY(x, z) {
  let k = 0;
  for (const P of PAVES) { const v = inside(x, z, P); if (v > k) k = v; }
  return TOP * k;
}

export default {
  name: 'street', order: 20,
  build(stage) {
    const { scene, U, M, colliders } = stage;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 1, 1).rotateX(-Math.PI / 2), makeGroundMaterial(U, { paving: 0 }));
    road.position.set(0, 0, 4);
    road.receiveShadow = true;
    road.layers.set(LAYER.GROUND);
    road.userData.inkId = allocInkId();
    road.userData.cover = { kind: 'stone' };
    road.name = 'khGround';
    scene.add(road);
    const paveMat = makeGroundMaterial(U, { paving: 1 });
    const kerbs = [];
    for (const [x0, x1, z0, z1] of PAVES) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), paveMat);
      p.position.set((x0 + x1) / 2, TOP, (z0 + z1) / 2);
      p.receiveShadow = true;
      p.layers.set(LAYER.GROUND);
      p.userData.inkId = allocInkId();
      p.userData.surf = 'pave';
      scene.add(p);
      const near = z1 <= STREET.kerb + 0.01;
      kerbs.push(new THREE.BoxGeometry(x1 - x0, TOP, 0.22).translate((x0 + x1) / 2, TOP / 2 - 0.002, near ? z1 - 0.11 : z0 + 0.11));
    }
    const kerb = new THREE.Mesh(merge(kerbs), M.kerb);
    kerb.receiveShadow = true;
    tagInk(kerb);
    scene.add(kerb);
    colliders.setBounds(BOUNDS.minX, BOUNDS.maxX, BOUNDS.minZ, BOUNDS.maxZ);
    stage.addSurface((x, z) => surfaceY(x, z));

    // ---- the house's front, faced in stone; a cornice; a sign ----------------------------------
    const g = new THREE.Group();
    g.name = 'killhouseStreet';
    scene.add(g);
    const kit = makeKit(stage, g);
    const mats = officeMats();
    const top = FLOOR + DOOR_H;
    kit.piece();
    const face = wallGeos({ axis: 'x', a: [HOUSE.z1 + T, HOUSE.z1 + T + 0.06], s: [HOUSE.x0 - T - 0.06, HOUSE.x1 + T + 0.06], y: [0, 4.4], holes: [[DOORS.SD.x0 - 0.1, DOORS.SD.x1 + 0.1, 0, top + 0.1], ...WINDOWS.map(([a, b]) => [a - 0.1, b + 0.1, WIN_Y[0] - 0.08, WIN_Y[1] + 0.1])] });
    const fm = kit.add(mergeGeos(face), mats.stone, { name: 'kh_front' });
    fm.userData.cover = { kind: 'stone' };
    // (the walls above the ceiling and the house's ends, to the roof's line)
    kit.add(mergeGeos([
      kit.box(HOUSE.x0 - T - 0.06, HOUSE.x1 + T + 0.06, 3.4, 4.4, HOUSE.z0 - T, HOUSE.z1 + T),
      kit.box(HOUSE.x0 - T - 0.06, HOUSE.x1 + T + 0.06, 4.4, 4.62, HOUSE.z1 - 0.2, HOUSE.z1 + T + 0.28),
    ]), mats.stone, { name: 'kh_cornice' });
    // the sign board over the door: THE BLUE BELL (a dark board, pale letters)
    kit.piece();
    const signC = document.createElement('canvas'); signC.width = 1024; signC.height = 128;
    const sg = signC.getContext('2d');
    sg.fillStyle = '#111'; sg.fillRect(0, 0, 1024, 128);
    sg.font = 'bold 84px Georgia, serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
    sg.fillStyle = '#cfcfcf'; sg.fillText('THE  BLUE  BELL', 512, 68);
    const signTex = new THREE.CanvasTexture(signC);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 });
    signMat.userData.inkSurface = 'wood';
    kit.add(new THREE.BoxGeometry(5.2, 0.62, 0.08).translate(-0.5, 3.0, HOUSE.z1 + T + 0.1), signMat, { name: 'kh_sign' });
    // the warehouse across the way: a long brick wall, its loading door
    kit.piece();
    const W = STREET.wall;
    const ww = wallGeos({ axis: 'x', a: [W, W + 0.4], s: [STREET.x0 - 2, STREET.x1 + 2], y: [0, 7.5], holes: [[LOADING.x0, LOADING.x1, 0, 3.3]] });
    const wm = kit.add(mergeGeos(ww), mats.brick, { name: 'kh_warehouse' });
    wm.userData.cover = { kind: 'stone' };
    // the bay behind the loading door: black, its floor and walls
    kit.piece();
    kit.add(mergeGeos([
      kit.box(LOADING.x0 - 0.3, LOADING.x1 + 0.3, 0, 3.6, W + 3.2, W + 3.4),
      kit.box(LOADING.x0 - 0.3, LOADING.x0, 0, 3.6, W + 0.4, W + 3.2),
      kit.box(LOADING.x1, LOADING.x1 + 0.3, 0, 3.6, W + 0.4, W + 3.2),
      kit.box(LOADING.x0 - 0.3, LOADING.x1 + 0.3, 3.3, 3.6, W + 0.4, W + 3.2),
    ]), mats.black, { name: 'kh_bay' });
    colliders.addRegion(LOADING.x0, LOADING.x1, W - 0.2, W + 3.0);
    colliders.addBox((LOADING.x0 + LOADING.x1) / 2, W + 3.3, (LOADING.x1 - LOADING.x0) / 2 + 0.3, 0.1, 0, 'wall');
    // its rolled-up shutter over the opening
    kit.piece();
    kit.add(mergeGeos([kit.box(LOADING.x0 - 0.1, LOADING.x1 + 0.1, 3.3, 3.75, W - 0.05, W + 0.15), new THREE.CylinderGeometry(0.2, 0.2, LOADING.x1 - LOADING.x0 + 0.3, 16).rotateZ(Math.PI / 2).translate((LOADING.x0 + LOADING.x1) / 2, 3.55, W - 0.1)]), mats.iron, { name: 'kh_shutter' });
    // the wall's colliders (the loading door open)
    colliders.addBox((STREET.x0 + LOADING.x0) / 2, W + 0.2, (LOADING.x0 - STREET.x0) / 2 + 2, 0.2, 0, 'wall');
    colliders.addBox((LOADING.x1 + STREET.x1) / 2, W + 0.2, (STREET.x1 - LOADING.x1) / 2 + 2, 0.2, 0, 'wall');
    // the house's front's collider is the house part's (its walls)
    // ---- the street's ends: barricades (sawhorses and a board) ---------------------------------
    for (const x of [STREET.x0 + 0.6, STREET.x1 - 0.6]) {
      kit.piece();
      const bars = [];
      for (const z of [8.9, 11.6, 14.3]) {
        bars.push(kit.box(x - 0.04, x + 0.04, 0.95, 1.15, z - 1.2, z + 1.2));
        for (const s of [-1, 1]) for (const zz of [z - 1.0, z + 1.0]) bars.push(new THREE.BoxGeometry(0.05, 1.1, 0.05).rotateZ(s * 0.25).translate(x + s * 0.14, 0.52, zz));
      }
      const b = kit.add(mergeGeos(bars), mats.wainscot, { name: 'kh_barricade' });
      b.userData.cover = { kind: 'thin' };
      colliders.addBox(x, 11.6, 0.2, 3.9, 0, 'wall');
    }
    // ---- a hydrant, the crates on the near pavement -------------------------------------------
    kit.piece();
    const hy = kit.add(lathe([[0.0001, 0], [0.16, 0], [0.16, 0.06], [0.12, 0.08], [0.12, 0.55], [0.14, 0.58], [0.1, 0.68], [0.04, 0.74], [0.0001, 0.75]], 18).translate(HYDRANT.x, FLOOR, HYDRANT.z), mats.iron, { name: 'kh_hydrant' });
    hy.userData.cover = { kind: 'steel' };
    colliders.addCircle(HYDRANT.x, HYDRANT.z, 0.17, 'hydrant');
    const api = {
      road, surfaceY, kit,
      addImpact(world, x, z, strength = 1) {
        const arr = world.U.uImpacts.value;
        let oldest = 0;
        for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
        arr[oldest].set(x, z, world.U.uTime.value, strength);
      },
      addBlast(world, x, z, strength = 3) {
        const arr = world.U.uBlasts.value;
        let oldest = 0;
        for (let i = 1; i < arr.length; i++) if (arr[i].z < arr[oldest].z) oldest = i;
        arr[oldest].set(x, z, world.U.uTime.value, strength);
      },
      crates: STREET_CRATES,
    };
    void V;
    return api;
  },
};
