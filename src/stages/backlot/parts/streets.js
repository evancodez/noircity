import * as THREE from 'three';
import { arch } from '../arch.js';
import { lathe, tube, V3, roundedBox, merge } from '../../../world/geom.js';
import { buildTruck, TRUCK as TRUCK_M } from '../../../vehicles/models.js';
import { allocInkId, markFigure } from '../../../render/layers.js';
import { MERCER, GARAGE, MARKET, GATE, FENCE, TANNER, TRUCK, DOG, PASSAGE, ROOFS, BACKST, ARCH } from '../plan.js';

// The streets of the chase's last stretches (lane C6): Mercer Street (its
// lamps, the garage across its foot with its doors folded back), Tanner's
// Row under the roofs (the delivery truck along its south side, the dog's
// kennel, the row's clutter), the market between Mercer Street and Pell Lane
// (its walls, its gateway, two rows of stalls shut for the night, the bulbs
// on their wires) and Pell Lane's board fence with the market's gate in it.
// What the chase meets in the way (the truck's plank, the barrow, the
// crates, the car) is things.js's.
export default {
  name: 'streets', order: 64,
  build(stage) {
    const A = arch(stage, 6464);
    const { MAT, K, face, fbox, facade, door, wire } = A;
    const api = { MAT };
    const L = stage.part('lamps');

    // ================= Mercer Street ===============================================
    {
      // the garage's doors: two leaves each side, folded back against its face
      const zf = GARAGE.z0 - 0.08;
      for (const [x, s] of [[GARAGE.door[0], -1], [GARAGE.door[1], 1]]) {
        for (let i = 0; i < 2; i++) {
          const g = new THREE.BoxGeometry(0.06, 3.6, 1.65).translate(0, 1.85, 0.85);
          g.rotateY(s * (Math.PI / 2 - 0.12 - i * 0.1));
          g.translate(x + s * (0.2 + i * 0.12), 0, zf);
          K.add('garageDoors', MAT.woodDark, g);
        }
        K.collide(x + (s < 0 ? -1.85 : 0.05), x + (s < 0 ? -0.05 : 1.85), zf - 0.4, zf, 'gdoor');
      }
      // inside the garage: dark (the car waits in it); a bench, a tyre on the wall
      K.box('garageIn', MAT.woodDark, GARAGE.x0 + 0.35, GARAGE.x0 + 1.0, 0, 0.9, GARAGE.z0 + 1.5, GARAGE.z1 - 0.6);
      // the street's lamps (goosenecks on the kerbs)
      api.lamps = {
        m1: L.post(MERCER.road[1] + 0.7, -96.0, -Math.PI / 2, { y: 0.15 }),
        m2: L.post(MERCER.road[0] - 0.7, -112.0, Math.PI / 2, { y: 0.15 }),
        m3: L.post(MERCER.road[1] + 0.7, -134.0, -Math.PI / 2, { y: 0.15, real: true }),
        garage: L.wall((GARAGE.door[0] + GARAGE.door[1]) / 2, 4.4, GARAGE.z0, 0, -1, { out: 0.5, strength: 0.9 }),
      };
      // a hydrant, a pillar box on the far pavement
      K.add('mercer', MAT.metal, lathe([[0, 0], [0.16, 0], [0.16, 0.08], [0.12, 0.1], [0.12, 0.62], [0.14, 0.66], [0.1, 0.78], [0, 0.82]], 16).translate(25.3, 0.15, -101.8), { figure: true });
      stage.colliders.addCircle(25.3, -101.8, 0.2, 'hydrant');
      K.add('mercer', MAT.iron, lathe([[0, 0], [0.24, 0], [0.24, 1.3], [0.2, 1.42], [0, 1.48]], 18).translate(16.6, 0.15, -127.6), { figure: true });
      stage.colliders.addCircle(16.6, -127.6, 0.26, 'pillar');
    }

    // ================= Tanner's Row: the truck, the dog's kennel ====================
    {
      // the delivery truck along the row's south side, its tail toward the
      // west: they were unloading it into the bay across the row (the plank
      // from its side to the bay is things.js's)
      const T = buildTruck(stage.M);
      const g = T.group;
      g.position.set(TRUCK.x, 0, TANNER.z1 - TRUCK_M.halfW - 0.15);
      g.rotation.y = Math.PI;
      const id = allocInkId(2);
      g.traverse((o) => { if (o.isMesh) { o.userData.inkId = id; o.userData.inkFigure = true; o.castShadow = true; } });
      markFigure(g);
      T.meshes.lens.material = stage.M.glass;
      stage.scene.add(g);
      stage.colliders.addBox(TRUCK.x, g.position.z, TRUCK_M.halfL, TRUCK_M.halfW, 0, 'truck');
      api.truck = T;
      // the bay across the row: a loading door open on a dark store, a dock
      const bx = TRUCK.x - 0.6;
      K.box('bay', MAT.black, bx - 1.4, bx + 1.4, 0.0, 2.8, TANNER.z0 - 0.4, TANNER.z0 - 0.02);
      K.box('bay', MAT.trim, bx - 1.6, bx + 1.6, 2.8, 3.05, TANNER.z0 - 0.02, TANNER.z0 + 0.12);
      K.box('bay', MAT.trim, bx - 1.6, bx + 1.6, 0.0, 0.95, TANNER.z0 - 0.02, TANNER.z0 + 0.55);
      K.collide(bx - 1.6, bx + 1.6, TANNER.z0, TANNER.z0 + 0.55, 'dock');
      // crates stacked by the bay
      for (const [x, z, y] of [[bx + 2.4, TANNER.z0 + 0.45, 0], [bx + 2.4, TANNER.z0 + 0.45, 0.64], [bx + 3.1, TANNER.z0 + 0.4, 0]]) {
        K.add('bay', MAT.wood, new THREE.BoxGeometry(0.62, 0.62, 0.62).translate(x, y + 0.31, z), { figure: true });
      }
      K.collide(bx + 2.05, bx + 3.45, TANNER.z0, TANNER.z0 + 0.8, 'crates');
      // the dog's kennel against the north wall, its chain to a ring
      K.add('kennel', MAT.woodDark, roundedBox(1.1, 0.8, 0.9, 0.04, 2).translate(DOG.x, 0.4, DOG.z - 0.05));
      const roof = new THREE.BufferGeometry();
      const kx = DOG.x, kz = DOG.z - 0.05;
      roof.setAttribute('position', new THREE.Float32BufferAttribute([kx - 0.62, 0.8, kz - 0.5, kx + 0.62, 0.8, kz - 0.5, kx, 1.15, kz - 0.5, kx - 0.62, 0.8, kz + 0.5, kx + 0.62, 0.8, kz + 0.5, kx, 1.15, kz + 0.5,
        kx - 0.62, 0.8, kz - 0.5, kx, 1.15, kz - 0.5, kx, 1.15, kz + 0.5, kx - 0.62, 0.8, kz - 0.5, kx, 1.15, kz + 0.5, kx - 0.62, 0.8, kz + 0.5,
        kx + 0.62, 0.8, kz - 0.5, kx + 0.62, 0.8, kz + 0.5, kx, 1.15, kz + 0.5, kx + 0.62, 0.8, kz - 0.5, kx, 1.15, kz + 0.5, kx, 1.15, kz - 0.5], 3));
      roof.computeVertexNormals();
      K.add('kennel', MAT.woodDark, roof);
      K.collide(kx - 0.6, kx + 0.6, kz - 0.5, kz + 0.5, 'kennel');
      // bins and a barrow along the row's walls (never across the way)
      for (const [x, z] of [[67.6, -120.4], [52.2, -116.5], [36.4, -120.5], [30.8, -116.5]]) {
        K.add('rowClutter', MAT.metal, lathe([[0, 0], [0.26, 0], [0.28, 0.05], [0.27, 0.72], [0.3, 0.76], [0.3, 0.8], [0, 0.8]], 20).translate(x, 0, z), { figure: true });
        stage.colliders.addCircle(x, z, 0.32, 'can');
      }
      wire(V3(48.0, 6.6, TANNER.z0), V3(49.4, 6.2, TANNER.z1), 0.4);
      wire(V3(33.0, 5.8, TANNER.z0), V3(34.0, 5.4, TANNER.z1), 0.35);
    }

    // ================= the market ====================================================
    {
      const M0 = MARKET;
      // its east wall on Mercer Street, the gateway in it (an arch on piers)
      const gw = M0.gateway;
      const wallE = (z0, z1) => { K.box('marketWall', MAT.brickDark, M0.x1 - 0.4, M0.x1, 0, 3.4, z0, z1); K.box('marketWall', MAT.trim, M0.x1 - 0.45, M0.x1 + 0.05, 3.4, 3.55, z0, z1); K.collide(M0.x1 - 0.4, M0.x1, z0, z1, 'wall'); };
      wallE(M0.z0, gw.z0); wallE(gw.z1, MERCER.z1);
      for (const z of [gw.z0, gw.z1]) { K.box('marketWall', MAT.brick, M0.x1 - 0.6, M0.x1 + 0.2, 0, 4.4, z - 0.35, z + 0.35); K.collide(M0.x1 - 0.6, M0.x1 + 0.2, z - 0.35, z + 0.35, 'pier'); }
      K.box('marketWall', MAT.brick, M0.x1 - 0.6, M0.x1 + 0.2, 4.4, 5.1, gw.z0 - 0.35, gw.z1 + 0.35);
      // the lettering board over the gateway (blank in the ink: a pale board)
      fbox('marketWall', MAT.plaster, face('x', M0.x1 + 0.2, 1), gw.z0 + 0.4, gw.z1 - 0.4, 4.5, 5.0, 0, 0.04);
      // ([C6 3rd] tonight its iron gates are shut across it and chained: a
      // padlock on the chain where the leaves meet, pale in the street's lamp;
      // the market's way in is round by the corner and its back arch)
      {
        const steel = new THREE.MeshStandardMaterial({ color: 0xc4c4c4, metalness: 0.75, roughness: 0.3, envMap: stage.M.envSoft, envMapIntensity: 1.0 });
        const leaves = new THREE.Group();
        const bars = [], chain = [];
        const xg = M0.x1 - 0.05, zm = (gw.z0 + gw.z1) / 2, H = 3.1;
        for (let z = gw.z0 + 0.42; z < gw.z1 - 0.38; z += 0.14) bars.push(new THREE.BoxGeometry(0.03, H, 0.03).translate(xg, H / 2, z), new THREE.ConeGeometry(0.035, 0.14, 4).translate(xg, H + 0.06, z));
        for (const y of [0.2, 1.2, H - 0.12]) bars.push(new THREE.BoxGeometry(0.05, 0.06, gw.z1 - gw.z0 - 0.75).translate(xg, y, zm));
        bars.push(new THREE.BoxGeometry(0.07, H + 0.05, 0.07).translate(xg, (H + 0.05) / 2, zm - 0.04), new THREE.BoxGeometry(0.07, H + 0.05, 0.07).translate(xg, (H + 0.05) / 2, zm + 0.04));
        const lm = new THREE.Mesh(merge(bars), MAT.iron); lm.castShadow = true; leaves.add(lm);
        // the chain round both meeting stiles, the padlock
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; chain.push(new THREE.TorusGeometry(0.03, 0.007, 4, 8).rotateY(i % 2 ? Math.PI / 2 : 0).translate(xg + Math.cos(a) * 0.09, 1.25 + Math.sin(a) * 0.05 - 0.04 * (i > 4 && i < 10 ? 1 : 0), zm + Math.sin(a) * 0.13)); }
        chain.push(new THREE.BoxGeometry(0.06, 0.14, 0.11).translate(xg + 0.12, 1.08, zm), new THREE.TorusGeometry(0.038, 0.009, 5, 12, Math.PI).rotateY(Math.PI / 2).translate(xg + 0.12, 1.15, zm));
        const cm = new THREE.Mesh(merge(chain), steel); cm.castShadow = true; cm.userData.noRay = true; leaves.add(cm);
        leaves.userData.inkId = allocInkId();
        leaves.traverse((o) => { if (o.isMesh) o.userData.inkId = leaves.userData.inkId; });
        markFigure(leaves);
        stage.scene.add(leaves);
        stage._gatewayLeaves = leaves;
        K.collide(M0.x1 - 0.12, M0.x1 + 0.02, gw.z0, gw.z1, 'gate');
      }
      // the north end: the next block's wall; the south: the low building's
      // stalls: two rows of booths, shutters down, awnings rolled, the cross way to the gate
      const booth = (x0, x1, z0, z1, side) => {
        const g = 'stalls';
        K.box(g, MAT.woodDark, x0, x1, 0, 0.9, z0, z1);                 // the counter's body
        K.box(g, MAT.wood, x0 - 0.05, x1 + 0.05, 0.9, 0.95, z0, z1);     // the counter
        K.box(g, MAT.woodDark, x0, x1, 0.95, 2.4, z0, z1);               // the shutters down
        K.box(g, MAT.woodDark, x0 - 0.1, x1 + 0.1, 2.4, 2.55, z0 - 0.05, z1 + 0.05);   // the roof
        // the rolled awning on the aisle side
        const xa = side > 0 ? x1 + 0.12 : x0 - 0.12;
        K.add(g, MAT.canvas, new THREE.CylinderGeometry(0.11, 0.11, z1 - z0 - 0.1, 10).rotateX(Math.PI / 2).translate(xa, 2.35, (z0 + z1) / 2));
        for (let z = z0 + 0.6; z < z1; z += 1.25) K.box(g, MAT.wood, Math.min(xa, x0 + 0.5) - 0.02, Math.max(xa, x1 - 0.5), 0.95, 2.4, z - 0.03, z + 0.03);
        K.collide(x0, x1, z0, z1, 'stall');
      };
      const [cz0, cz1] = M0.cross;
      for (const [rx0, rx1] of M0.rows) {
        const side = rx0 < 8 ? 1 : -1;
        for (let z = -113.4; z < -88.5; z += 2.5) {
          const z0 = z, z1 = Math.min(z + 2.3, -88.6);
          if (z1 > cz0 && z0 < cz1 && rx0 < 8) continue;     // the cross way (west row only)
          booth(rx0, rx1, z0, z1, side);
        }
      }
      // the bulbs on their wires over the middle aisle
      api.bulbs = [];
      for (const z of [-111.0, -102.5, -93.0]) {
        wire(V3(M0.rows[0][1] + 0.1, 3.4, z), V3(M0.rows[1][0] - 0.1, 3.4, z + 0.4), 0.35);
        api.bulbs.push(L.hang(9.0, 4.6, z + 0.2, { real: z > -105 }));
      }
      // the market's floor: flags (street.js raises it to the pavements' 0.15)
      // Pell Lane's board fence and the gate in it
      const fx = FENCE.x;
      const g = 'pellFence';
      for (let z = FENCE.z1 - 0.02; z > FENCE.z0 + 0.1; z -= 0.16) {
        if (z - 0.14 < GATE.z1 && z > GATE.z0) continue;
        K.box(g, MAT.wood, fx - 0.03, fx + 0.03, 0.15, FENCE.h - A.rng.range(0, 0.08), z - 0.14, z);
      }
      for (const y of [0.55, FENCE.h - 0.35]) {
        K.box(g, MAT.woodDark, fx + 0.03, fx + 0.1, y - 0.06, y + 0.06, FENCE.z0, GATE.z0);
        K.box(g, MAT.woodDark, fx + 0.03, fx + 0.1, y - 0.06, y + 0.06, GATE.z1, FENCE.z1);
      }
      // the gate's posts, its leaf swung in against the fence (he left it open)
      for (const z of [GATE.z0 - 0.05, GATE.z1 + 0.05]) K.box(g, MAT.woodDark, fx - 0.07, fx + 0.07, 0, FENCE.h + 0.25, z - 0.06, z + 0.06);
      api.gateLeaf = (() => {
        const leaf = new THREE.Group();
        const parts = [];
        for (let i = 0; i < 9; i++) parts.push(new THREE.BoxGeometry(0.04, FENCE.h - 0.2, 0.15).translate(0.02, (FENCE.h - 0.2) / 2 + 0.1, 0.09 + i * 0.165));
        parts.push(new THREE.BoxGeometry(0.05, 0.1, 1.5).translate(0.06, 0.6, 0.78));
        parts.push(new THREE.BoxGeometry(0.05, 0.1, 1.5).translate(0.06, FENCE.h - 0.4, 0.78));
        const m = new THREE.Mesh(merge(parts), MAT.wood);
        m.castShadow = true;
        m.userData.inkId = allocInkId();
        leaf.add(m);
        leaf.position.set(fx + 0.06, 0, GATE.z0);
        leaf.rotation.y = -1.6;        // open, into the market
        stage.scene.add(leaf);
        return leaf;
      })();
      K.collide(fx - 0.08, fx + 0.08, FENCE.z0, GATE.z0, 'fence');
      K.collide(fx - 0.08, fx + 0.08, GATE.z1, FENCE.z1, 'fence');
      api.gateLamp = L.wall(fx, 3.0, GATE.z1 + 0.6, -1, 0, { out: 0.25, strength: 0.85 });
      // ([C6 3rd] the west aisle along the fence: one bracket lamp on the wall
      // over its porter's table - dark between, the thing in the way lit)
      api.westLamp = L.wall(fx + 0.4, 3.0, -111.4, 1, 0, { out: 0.35, strength: 0.75 });
      // (the market's back way: a lamp over the arch on the cross street, a
      // bulb inside it; Mercer Street's far lamp lit for the run up it)
      api.archLamp = L.wall(ARCH.x0 + 1.5, ARCH.h + 0.9, -133, 0, -1, { out: 0.4, strength: 0.9 });
      api.archBulb = L.hang((ARCH.x0 + ARCH.x1) / 2, ARCH.h - 0.15, -126.4, { real: true });
      // the south end's low building faces into the market: a shut door
      door('midN', face('z', M0.z1, -1), 9.0, 1.6, 2.4);
    }
    void tube; void PASSAGE; void ROOFS; void BACKST; void facade;
    K.flush();
    return api;
  },
};
