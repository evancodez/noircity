import * as THREE from 'three';
import { makeKit } from '../../../props/diner/kit.js';
import { mergeGeos, lathe } from '../../../props/lib.js';
import { officeMats } from '../../office/build/mats.js';
import { FLOOR, T, HOUSE, DOORS, YARD } from '../plan.js';

// The killhouse's neighbours and its back yard (lane C2, after the critic's
// second look: the back door the men leave open led onto an empty wet plain
// to the skyline, an invisible wall at z -9.65, and round the house's ends
// into the street). The Blue Bell stands in a terrace now: a brick block on
// either side of it, from the street's pavement back to the yard's wall, and
// behind it a walled yard - the back door's step, a lamp over it, the bins,
// the wall the men came over. Every edge is a wall you can see.
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  name: 'yard', order: 137,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'killhouseYard';
    stage.scene.add(g);
    const kit = makeKit(stage, g), mats = officeMats(), C = stage.colliders;
    const Y = YARD;
    const front = HOUSE.z1 + T + 0.14;            // (the blocks' fronts, a hand proud of the Blue Bell's stone face)
    // ---- the neighbours: a block of brick either side, the street to the yard's back ------------------
    for (const [x0, x1] of [[Y.blockX0, HOUSE.x0 - T - 0.01], [HOUSE.x1 + T + 0.01, Y.blockX1]]) {
      kit.piece();
      const parts = [kit.box(x0, x1, 0, Y.blockH, Y.z0, front)];
      // (its coping, and a string course under the top floor's windows)
      parts.push(kit.box(x0, x1, Y.blockH, Y.blockH + 0.16, Y.z0 - 0.06, front + 0.1));
      parts.push(kit.box(x0, x1, 2.9, 3.0, front, front + 0.05));
      const m = kit.add(mergeGeos(parts), mats.brick, { name: 'kh_block' });
      m.userData.cover = { kind: 'stone' };
      // (its windows on the street: dark, deep in the brick, two rows; a shop's shutter at the foot)
      kit.piece();
      const win = [];
      const near = x0 < 0 ? x1 : x0, dir = x0 < 0 ? -1 : 1;
      for (let i = 0; i < 4; i++) {
        const cx = near + dir * (2.2 + i * 2.9);
        if ((dir < 0 && cx - 0.6 < x0 + 0.5) || (dir > 0 && cx + 0.6 > x1 - 0.5)) continue;
        for (const [y0, y1] of [[3.3, 4.7]]) win.push(kit.box(cx - 0.55, cx + 0.55, y0, y1, front, front + 0.025));
        if (i % 2 === 0) win.push(kit.box(cx - 1.0, cx + 1.0, 0.15, 2.5, front, front + 0.03));
        else win.push(kit.box(cx - 0.55, cx + 0.55, 1.1, 2.5, front, front + 0.025));
      }
      if (win.length) kit.add(mergeGeos(win), mats.glassDark, { name: 'kh_blockWindows', noRay: true });
      C.addBox((x0 + x1) / 2, (Y.z0 + front) / 2, (x1 - x0) / 2, (front - Y.z0) / 2, 0, 'wall');
    }
    // ---- the yard's wall behind the house, from block to block ----------------------------------------
    {
      const x0 = HOUSE.x0 - T - 0.01, x1 = HOUSE.x1 + T + 0.01;
      kit.piece();
      const w = kit.add(mergeGeos([
        kit.box(x0, x1, 0, Y.wallH, Y.z0, Y.z0 + 0.3),
        kit.box(x0, x1, Y.wallH, Y.wallH + 0.08, Y.z0 - 0.05, Y.z0 + 0.35),
        // (piers along it)
        ...[-6, -3, 3, 6].map((x) => kit.box(x - 0.2, x + 0.2, 0, Y.wallH + 0.12, Y.z0 + 0.3, Y.z0 + 0.45)),
      ]), mats.brick, { name: 'kh_yardWall' });
      w.userData.cover = { kind: 'stone' };
      C.addBox((x0 + x1) / 2, Y.z0 + 0.15, (x1 - x0) / 2, 0.15, 0, 'wall');
      for (const x of [-6, -3, 3, 6]) C.addBox(x, Y.z0 + 0.375, 0.2, 0.075, 0, 'wall');
    }
    // ---- the back door's step, the bins, a lamp over the door ---------------------------------------------
    {
      const D = DOORS.BD;
      kit.piece();
      const st = kit.add(kit.box(D.x0 - 0.25, D.x1 + 0.25, 0, FLOOR, HOUSE.z0 - T - 0.5, HOUSE.z0 - T), mats.stone, { name: 'kh_backStep' });
      st.userData.cover = { kind: 'stone' };
      // (a step: walked up, not a wall)
      stage.addSurface((x, z) => (x > D.x0 - 0.25 && x < D.x1 + 0.25 && z > HOUSE.z0 - T - 0.5 && z < HOUSE.z0 - T ? FLOOR : undefined));
      // the bins: two by the wall to the door's east
      const bin = lathe([[0.0001, 0], [0.24, 0], [0.26, 0.04], [0.27, 0.72], [0.29, 0.74], [0.29, 0.78], [0.0001, 0.8]], 18);
      kit.piece();
      const bins = kit.add(mergeGeos(Y.bins.map(([x, z]) => bin.clone().translate(x, 0, z))), mats.steelLight, { name: 'kh_bins' });
      bins.userData.cover = { kind: 'steel' };
      for (const [x, z] of Y.bins) C.addCircle(x, z, 0.29, 'can');
      // the lamp over the door: an arm off the wall, a shade, its pool on the step
      const x = (D.x0 + D.x1) / 2, y = FLOOR + 2.75, z = HOUSE.z0 - T - 0.45;
      kit.piece();
      kit.add(mergeGeos([kit.box(x - 0.025, x + 0.025, y + 0.18, y + 0.24, z, HOUSE.z0 - T), kit.box(x - 0.08, x + 0.08, y + 0.1, y + 0.4, HOUSE.z0 - T - 0.04, HOUSE.z0 - T)]), mats.iron, { name: 'kh_backLampArm' });
      kit.piece();
      kit.add(lathe([[0.02, 0.12], [0.05, 0.08], [0.1, 0.02], [0.2, -0.06], [0.24, -0.11], [0.25, -0.13], [0.23, -0.13]], 24).translate(x, y, z), mats.shade, { name: 'kh_backLampShade' });
      const bulb = kit.add(new THREE.CircleGeometry(0.17, 20).rotateX(Math.PI / 2).translate(x, y - 0.12, z), mats.bulb, { cast: false, noRay: true });
      const head = V(x, y - 0.14, z), at = V(x, 0, z - 1.4);
      const lamp = stage.lamps.addCustom({ head, axis: at.clone().sub(head).normalize(), height: head.distanceTo(at) + 0.6, half: 0.62, real: true, bulb, fadeEnd: 0.85, edgeSoft: 0.4, strength: 0.5, tag: 'wall' });
      Object.assign(lamp.light, { intensity: 38, angle: 0.85, penumbra: 0.5, distance: 7 });
      return { group: g, lamp };
    }
  },
};
