import * as THREE from 'three';
import { LAYER, tagInk, allocInkId } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { merge } from '../../../world/geom.js';
import { makeKit } from '../../../props/diner/kit.js';
import { mergeGeos, lathe } from '../../../props/lib.js';
import { officeMats } from '../../office/build/mats.js';
import { wallGeos } from '../../office/build/walls.js';
import { FLOOR, T, HOUSE, STREET, DOORS, DOOR_H, WINDOWS, WIN_Y, OPENINGS, RECESS, BOUNDS, HYDRANT, STREET_CRATES } from '../plan.js';

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
    // the warehouse across the way: a long brick wall, its openings (the
    // loading door, two alleys' mouths) - each with a dark recess behind it,
    // wider than the opening, where a man waits out of sight before he comes
    kit.piece();
    const W = STREET.wall, OP = OPENINGS;
    const ww = wallGeos({ axis: 'x', a: [W, W + 0.4], s: [STREET.x0 - 2, STREET.x1 + 2], y: [0, 7.5], holes: OP.map((o) => [o.x0, o.x1, 0, o.h]) });
    const wm = kit.add(mergeGeos(ww), mats.brick, { name: 'kh_warehouse' });
    wm.userData.cover = { kind: 'stone' };
    kit.piece();
    const rec = [];
    for (const o of OP) {
      const r0 = o.x0 - RECESS.side, r1 = o.x1 + RECESS.side, zb = W + RECESS.depth;
      rec.push(kit.box(r0 - 0.3, r1 + 0.3, 0, o.h + 0.3, zb, zb + 0.2));
      rec.push(kit.box(r0 - 0.3, r0, 0, o.h + 0.3, W + 0.4, zb));
      rec.push(kit.box(r1, r1 + 0.3, 0, o.h + 0.3, W + 0.4, zb));
      rec.push(kit.box(r0 - 0.3, r1 + 0.3, o.h, o.h + 0.3, W + 0.4, zb));
      colliders.addRegion(r0, r1, W - 0.2, zb);
      colliders.addBox((r0 + r1) / 2, zb + 0.1, (r1 - r0) / 2 + 0.3, 0.1, 0, 'wall');
      colliders.addBox(r0 - 0.15, (W + 0.4 + zb) / 2, 0.15, (zb - W - 0.4) / 2, 0, 'wall');
      colliders.addBox(r1 + 0.15, (W + 0.4 + zb) / 2, 0.15, (zb - W - 0.4) / 2, 0, 'wall');
    }
    kit.add(mergeGeos(rec), mats.black, { name: 'kh_recesses' });
    // the loading door's rolled-up shutter
    {
      const o = OP[0];
      kit.piece();
      kit.add(mergeGeos([kit.box(o.x0 - 0.1, o.x1 + 0.1, o.h, o.h + 0.45, W - 0.05, W + 0.15), new THREE.CylinderGeometry(0.2, 0.2, o.x1 - o.x0 + 0.3, 16).rotateZ(Math.PI / 2).translate((o.x0 + o.x1) / 2, o.h + 0.25, W - 0.1)]), mats.iron, { name: 'kh_shutter' });
    }
    // the wall's colliders (the openings open)
    {
      let cur = STREET.x0 - 2;
      for (const o of [...OP].sort((p, q) => p.x0 - q.x0)) { colliders.addBox((cur + o.x0) / 2, W + 0.2, (o.x0 - cur) / 2, 0.2, 0, 'wall'); cur = o.x1; }
      colliders.addBox((cur + STREET.x1 + 2) / 2, W + 0.2, (STREET.x1 + 2 - cur) / 2, 0.2, 0, 'wall');
    }
    // ---- the street's ends: board fences across it, wall to wall (a reason you can see) ----------
    for (const x of [STREET.x0 + 0.5, STREET.x1 - 0.5]) {
      kit.piece();
      const bd = [];
      const z0 = HOUSE.z1 + T, z1 = W;
      for (let z = z0; z < z1 - 0.01; z += 0.24) bd.push(kit.box(x - 0.03, x + 0.03, 0, 2.3 + 0.12 * Math.sin(z * 7.1), z, Math.min(z1, z + 0.22)));
      for (const y of [0.4, 1.8]) bd.push(kit.box(x - 0.08, x - 0.03, y, y + 0.12, z0, z1));
      const f = kit.add(mergeGeos(bd), mats.wainscot, { name: 'kh_fence' });
      f.userData.cover = { kind: 'thin' };
      colliders.addBox(x, (z0 + z1) / 2, 0.08, (z1 - z0) / 2, 0, 'wall');
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
