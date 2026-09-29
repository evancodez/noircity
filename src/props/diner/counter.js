import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { paintY } from './kit.js';
import { PM, lathe, slab, tubeAlong, uvRect, mergeGeos, hash, AT, V3 } from '../lib.js';

// The counter (a dark front with a panel line, a formica top that is dark
// until a lamp's pool falls on it, a rolled steel edge, a brass foot rail on
// brackets at y 0.43), the back bar against x = -17 (lit glass behind
// shelves of bottle silhouettes, one tick of light each; stacked tumblers,
// cups on hooks, two tall coffee urns, the menu board, the clock), the
// kitchen hatch (a lit box seen through the opening, the pan rack as
// shapes, a shelf, a ticket rail, the bell), the pie case at the door end
// and the cash register at the far end.
const D = DINER, F = D.floorY, C = D.counter;
export const BAR = {
  cabX: D.backX + 0.55,       // the lower cabinets' front
  cabTop: F + 0.95,           // their top (the back bar's working surface)
  hatchX: D.backX + 0.55,     // the kitchen's partition, flush with them
  secA: [3.8, C.z1],          // the section by the far end (urns, the scotch)
  secB: [C.z0, 0.6],          // the section by the door end
  shelves: [1.52, 1.86],
  glowTop: 2.05,
};

export function buildCounter(kit) {
  const { M } = kit;
  const x1 = C.frontX, x0 = C.frontX - C.depth, top = C.topY;
  const out = {};
  // ---- the body and its top
  kit.piece();
  const body = [
    kit.box(x0 + 0.02, x1, F + 0.1, top - 0.035, C.z0, C.z1),
    kit.box(x0 + 0.02, x1, F + 0.1, top - 0.035, C.z0, C.z0 + 0.001),
  ];
  kit.addMerged(body, M.counterFront);
  kit.add(kit.box(x0 + 0.08, x1 - 0.07, F, F + 0.1, C.z0 + 0.06, C.z1 - 0.06), M.black, { cast: false });
  // the panel line: a steel strip under the top's lip, and one groove
  kit.piece();
  kit.add(kit.box(x1, x1 + 0.006, top - 0.07, top - 0.052, C.z0, C.z1), M.steel, { cast: false });
  kit.add(kit.box(x1, x1 + 0.002, F + 0.52, F + 0.53, C.z0 + 0.02, C.z1 - 0.02), M.enamelDark, { cast: false });
  kit.piece();
  out.top = kit.add(slab(C.depth + 0.05, 0.035, C.z1 - C.z0 + 0.04, { bevel: 0.004, corner: 0.02 }).translate((x0 + x1 + 0.05) / 2, top - 0.035, (C.z0 + C.z1) / 2), M.counterTop);
  // the rolled steel edge along the front and round both ends
  kit.piece();
  const edge = [];
  const ex = x1 + 0.05, ey = top - 0.016;
  edge.push(new THREE.CylinderGeometry(0.021, 0.021, C.z1 - C.z0 + 0.0, 20, 1, true).rotateX(Math.PI / 2).translate(ex, ey, (C.z0 + C.z1) / 2));
  for (const [zz, s] of [[C.z0 - 0.02, -1], [C.z1 + 0.02, 1]]) {
    edge.push(new THREE.CylinderGeometry(0.021, 0.021, C.depth + 0.03, 20, 1, true).rotateZ(Math.PI / 2).translate((x0 + ex) / 2 - 0.015, ey, zz));
    edge.push(new THREE.SphereGeometry(0.021, 20, 12).translate(ex, ey, zz - s * 0.0));
  }
  kit.addMerged(edge, M.steel, { cast: false });
  // the brass foot rail and its brackets
  kit.piece();
  const rx = x1 + 0.2, ry = 0.43;
  const rail = [new THREE.CylinderGeometry(0.021, 0.021, C.z1 - C.z0 - 0.3, 20).rotateX(Math.PI / 2).translate(rx, ry, (C.z0 + C.z1) / 2)];
  for (const zz of [C.z0 + 0.15, C.z1 - 0.15]) rail.push(new THREE.SphereGeometry(0.024, 16, 10).translate(rx, ry, zz));
  const nB = 8;
  for (let k = 0; k < nB; k++) {
    const zz = C.z0 + 0.35 + (k * (C.z1 - C.z0 - 0.7)) / (nB - 1);
    rail.push(tubeAlong([V3(x1, ry + 0.09, zz), V3(x1 + 0.08, ry + 0.07, zz), V3(rx - 0.01, ry + 0.02, zz)], 0.009, 8, 16));
    rail.push(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 16).rotateZ(Math.PI / 2).translate(x1 + 0.004, ry + 0.09, zz));
  }
  kit.addMerged(rail, M.brass);
  return out;
}

// ---- bottle silhouettes (a dozen shapes: squat, tall, square, flask) ------------
function bottleShape(kind) {
  switch (kind) {
    case 'squat': return [[0.0001, 0], [0.05, 0], [0.052, 0.01], [0.052, 0.13], [0.04, 0.16], [0.016, 0.18], [0.014, 0.23], [0.017, 0.24], [0.0001, 0.24]];
    case 'tall': return [[0.0001, 0], [0.036, 0], [0.038, 0.01], [0.038, 0.2], [0.03, 0.245], [0.013, 0.27], [0.012, 0.33], [0.015, 0.34], [0.0001, 0.34]];
    case 'flask': return [[0.0001, 0], [0.04, 0], [0.042, 0.012], [0.042, 0.12], [0.03, 0.15], [0.012, 0.165], [0.011, 0.19], [0.014, 0.2], [0.0001, 0.2]];
    case 'round': return [[0.0001, 0], [0.03, 0], [0.05, 0.03], [0.055, 0.08], [0.045, 0.13], [0.014, 0.16], [0.012, 0.22], [0.015, 0.23], [0.0001, 0.23]];
    default: return [[0.0001, 0], [0.04, 0], [0.042, 0.01], [0.042, 0.18], [0.034, 0.21], [0.013, 0.24], [0.012, 0.3], [0.015, 0.31], [0.0001, 0.31]];
  }
}
function bottleGeo(kind) {
  let g = lathe(bottleShape(kind), 20);
  if (kind === 'square' || kind === 'flask') {
    const p = g.getAttribute('position');
    const sx = kind === 'flask' ? 1.25 : 1, sz = kind === 'flask' ? 0.45 : 1;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4 || y > 0.2) continue;
      const a = Math.atan2(z, x);
      const q = kind === 'square' ? Math.pow(1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))), 0.85) * 0.92 : 1;
      p.setXYZ(i, x * q * sx, y, z * q * sz);
    }
    g.computeVertexNormals();
  }
  return g;
}

export function buildBackBar(kit) {
  const { M } = kit;
  const B = D.backX, cab = BAR.cabX, ct = BAR.cabTop;
  const out = { urns: [], steam: [] };
  const sections = [BAR.secA, BAR.secB];
  // ---- the lower cabinets: doors of uneven widths, a steel top
  kit.piece();
  const cabG = [], doors = [], topG = [];
  for (const [z0, z1] of sections) {
    cabG.push(kit.box(B + 0.02, cab - 0.02, F + 0.09, ct - 0.03, z0, z1));
    cabG.push(kit.box(B + 0.02, cab - 0.05, F, F + 0.09, z0 + 0.02, z1 - 0.02));
    let z = z0 + 0.03, k = 0;
    while (z < z1 - 0.2) {
      const w = Math.min(z1 - 0.03 - z, 0.55 + hash(k + z0 * 10, 3) * 0.3);
      doors.push(slab(0.018, ct - F - 0.2, w - 0.02, { bevel: 0.004, corner: 0.004 }).rotateZ(0).translate(cab - 0.02 + 0.009, F + 0.11, z + w / 2));
      z += w; k++;
    }
    topG.push(slab(0.58, 0.03, z1 - z0, { bevel: 0.004, corner: 0.01 }).translate(B + 0.29, ct - 0.03, (z0 + z1) / 2));
  }
  kit.addMerged(cabG, M.cabinet, { cast: false });
  kit.addMerged(doors, M.std('cabDoor', 0x131313, 0.5, 'wood'), { cast: false });
  kit.piece();
  kit.addMerged(topG, M.steel, { cast: false });

  // ---- the lit glass behind the shelves: grey, brightest in a band under
  // the canopy that hides its tube; the bottles stand black against it
  kit.piece();
  const glow = [];
  for (const [z0, z1] of sections) {
    const g = new THREE.PlaneGeometry(z1 - z0 - 0.04, BAR.glowTop - ct, 1, 10).rotateY(Math.PI / 2).translate(B + 0.012, (ct + BAR.glowTop) / 2, (z0 + z1) / 2);
    glow.push(paintY(g, (y) => {
      const t = (y - ct) / (BAR.glowTop - ct);
      return 0.2 + 0.09 * t + 0.5 * Math.pow(Math.max(0, (t - 0.86) / 0.14), 2);
    }));
  }
  out.glow = kit.addMerged(glow, M.mirror, { cast: false, receive: false });
  // the canopy over it, the uprights, the shelves
  kit.piece();
  const wood = [];
  for (const [z0, z1] of sections) {
    wood.push(slab(0.34, 0.12, z1 - z0 + 0.04, { bevel: 0.008, corner: 0.01 }).translate(B + 0.17, BAR.glowTop, (z0 + z1) / 2));
    wood.push(kit.box(B, B + 0.3, ct, BAR.glowTop, z0 - 0.02, z0 + 0.03));
    wood.push(kit.box(B, B + 0.3, ct, BAR.glowTop, z1 - 0.03, z1 + 0.02));
    for (const y of BAR.shelves) wood.push(slab(0.24, 0.022, z1 - z0 - 0.06, { bevel: 0.004, corner: 0.006 }).translate(B + 0.13, y - 0.022, (z0 + z1) / 2));
  }
  kit.addMerged(wood, M.shelf, { cast: false });

  // ---- bottles on the shelves: dark shapes, one tick of light each
  kit.piece();
  const kinds = ['squat', 'tall', 'square', 'flask', 'round', 'tall', 'squat', 'square', 'tall', 'round', 'flask', 'tall', 'squat', 'square', 'tall', 'round'];
  const bottles = [], ticks = [];
  let n = 0;
  const shelfRow = (z0, z1, y, count, seed) => {
    const step = (z1 - z0) / count;
    for (let k = 0; k < count; k++) {
      if (hash(k + seed, 31) < 0.12) continue;           // a gap where one was taken
      const kind = kinds[(n++ + seed) % kinds.length];
      const z = z0 + step * (k + 0.5) + (hash(k, seed) - 0.5) * step * 0.35;
      const x = B + 0.11 + (hash(k, seed + 1) - 0.5) * 0.05;
      const g = bottleGeo(kind).rotateY(hash(k, seed + 2) * 3).translate(x, y, z);
      bottles.push(g);
      // the tick: a short sliver of light on the shoulder facing the room
      const shape = bottleShape(kind);
      const hy = shape[3][1] * 0.8, r = shape[3][0];
      ticks.push(new THREE.PlaneGeometry(0.006, hy * 0.45).rotateY(Math.PI / 2).translate(x + r * 0.85 + 0.002, y + hy * 0.6, z - r * 0.35));
    }
  };
  shelfRow(BAR.secA[0] + 0.1, BAR.secA[1] - 0.1, BAR.shelves[0], 11, 1);
  shelfRow(BAR.secA[0] + 0.1, BAR.secA[1] - 0.1, BAR.shelves[1], 10, 7);
  shelfRow(BAR.secB[0] + 0.1, BAR.secB[1] - 0.1, BAR.shelves[0], 9, 13);
  shelfRow(BAR.secB[0] + 0.1, BAR.secB[1] - 0.1, BAR.shelves[1], 8, 19);
  // a few on the cabinet top by the scotch (section A's near end)
  for (const [z, kind] of [[4.45, 'tall'], [4.7, 'squat'], [3.95, 'round']]) {
    bottles.push(bottleGeo(kind).translate(B + 0.2, ct, z));
    const s = bottleShape(kind);
    ticks.push(new THREE.PlaneGeometry(0.006, s[3][1] * 0.35).rotateY(Math.PI / 2).translate(B + 0.2 + s[3][0] * 0.85 + 0.002, ct + s[3][1] * 0.5, z - s[3][0] * 0.35));
  }
  kit.addMerged(bottles, PM().bottleDark, { cast: false });
  kit.addMerged(ticks, M.glow('tick', 1.4), { cast: false, receive: false, noRay: true });

  // ---- stacked tumblers (section B's cabinet top), cups on hooks under
  // section A's lower shelf
  kit.piece();
  const tumb = lathe([[0.0001, 0], [0.036, 0], [0.0375, 0.005], [0.0375, 0.085], [0.034, 0.085], [0.033, 0.014], [0.0001, 0.014]], 24);
  const stacks = [];
  const stack = (x, z, rows) => {
    for (let r = 0; r < rows; r++) {
      const nn = rows - r;
      for (let k = 0; k < nn; k++) {
        const zz = z + (k - (nn - 1) / 2) * 0.078;
        // (inverted, rim down, as a bar stacks them)
        stacks.push(tumb.clone().rotateX(Math.PI).translate(x, ct + 0.085 + r * 0.086, zz));
      }
    }
  };
  stack(B + 0.2, -2.2, 3);
  stack(B + 0.36, -1.1, 2);
  kit.addMerged(stacks, PM().glassThick, { cast: false });
  kit.piece();
  const cups = [], hooks = [];
  const cupProfile = [[0.0001, 0], [0.022, 0], [0.036, 0.018], [0.042, 0.04], [0.0435, 0.068], [0.0405, 0.066], [0.033, 0.018], [0.0001, 0.007]];
  for (let k = 0; k < 7; k++) {
    const z = BAR.secA[0] + 0.55 + k * 0.33 + (hash(k, 41) - 0.5) * 0.06;
    if (z > 5.9 && z < 7.9) continue;          // (the urns stand there)
    const x = B + 0.2, y = BAR.shelves[0] - 0.05;
    const c = lathe(cupProfile, 24);
    const h = new THREE.TorusGeometry(0.017, 0.0042, 8, 20, Math.PI * 1.5).rotateZ(-Math.PI * 0.75).translate(0.05, 0.043, 0);
    const cup = mergeGeos([c, h]);
    // (hung by the handle: the cup turned mouth-sideways under its hook)
    cup.translate(-0.05, -0.06, 0).rotateZ(Math.PI * 0.55 + (hash(k, 43) - 0.5) * 0.2).rotateY(Math.PI / 2 + (hash(k, 44) - 0.5) * 0.5).translate(x, y, z);
    cups.push(cup);
    hooks.push(tubeAlong([V3(x, y + 0.05, z), V3(x, y - 0.005, z), V3(x + 0.012, y - 0.02, z)], 0.003, 6, 12));
  }
  kit.addMerged(cups, PM().china, { cast: false });
  kit.addMerged(hooks, M.iron, { cast: false });

  // ---- two tall coffee urns: steel columns, a sight gauge, a spigot, a
  // domed lid; their tops breathe a little steam (parts/diner.js)
  for (const z of [6.35, 7.45]) {
    kit.piece();
    const x = B + 0.28, y = ct;
    const shell = lathe([[0.0001, 0], [0.15, 0], [0.16, 0.02], [0.16, 0.05], [0.145, 0.07], [0.145, 0.62], [0.155, 0.64], [0.155, 0.68], [0.12, 0.72], [0.06, 0.745], [0.025, 0.75], [0.02, 0.78], [0.03, 0.8], [0.0001, 0.805]], 48).translate(x, y, z);
    const bands = [new THREE.TorusGeometry(0.147, 0.007, 8, 48).rotateX(Math.PI / 2).translate(x, y + 0.22, z), new THREE.TorusGeometry(0.147, 0.007, 8, 48).rotateX(Math.PI / 2).translate(x, y + 0.5, z)];
    kit.add(mergeGeos([shell, ...bands]), M.steel, { cast: false });
    // the gauge: a glass tube in two brass knuckles, the coffee's level dark in it
    const gx = x + 0.165;
    const gauge = [new THREE.CylinderGeometry(0.009, 0.009, 0.36, 12).translate(gx, y + 0.34, z + 0.05), new THREE.SphereGeometry(0.016, 12, 8).translate(gx - 0.005, y + 0.15, z + 0.05), new THREE.SphereGeometry(0.016, 12, 8).translate(gx - 0.005, y + 0.53, z + 0.05)];
    kit.add(mergeGeos(gauge.slice(1)), M.brass, { cast: false });
    kit.add(gauge[0], M.glow('gauge', 0.06), { cast: false });
    kit.add(new THREE.CylinderGeometry(0.0095, 0.0095, 0.2, 12).translate(gx, y + 0.26, z + 0.05), M.black, { cast: false });
    // the spigot: a tap at the front, low, with its handle
    const sp = tubeAlong([V3(x + 0.14, y + 0.12, z), V3(x + 0.21, y + 0.12, z), V3(x + 0.225, y + 0.1, z), V3(x + 0.225, y + 0.07, z)], 0.012, 10, 24);
    const handle = new THREE.CapsuleGeometry(0.008, 0.06, 4, 8).rotateX(0.3).translate(x + 0.2, y + 0.17, z);
    kit.add(mergeGeos([sp, handle]), M.black, { cast: false });
    out.urns.push({ x, z, top: V3(x, y + 0.8, z), spigot: V3(x + 0.225, y + 0.06, z) });
  }

  // ---- the menu board: four short lines (COFFEE 5, PIE 10, HASH 25, EGGS 20)
  kit.piece();
  const mb = new THREE.PlaneGeometry(1.25, 0.62).rotateY(Math.PI / 2).translate(B + 0.035, 2.6, 6.15);
  uvRect(mb, AT.menuBoard);
  kit.add(slab(0.03, 0.7, 1.33, { bevel: 0.006, corner: 0.01 }).translate(B + 0.015, 2.25, 6.15), M.frame, { cast: false });
  kit.add(mb, M.std('board', 0xffffff, 0.9, 'wood', { map: PM().atlas.map }), { cast: false });

  // ---- the kitchen: its partition flush with the cabinets, the hatch in
  // it, a lit box behind
  const H = D.hatch, hx = BAR.hatchX, P0 = BAR.secB[1], P1 = BAR.secA[0];
  kit.piece();
  const part = [], partPanel = [];
  const plasterV = (y) => { const t = Math.min(1, Math.max(0, (y - 1.25) / 2.3)); return 0.2 * Math.pow(1 - t, 1.3) + 0.02; };
  const face = (z0, z1, y0, y1) => {
    const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0, 1, Math.max(1, Math.round((y1 - y0) / 0.25))).rotateY(Math.PI / 2).translate(hx, (y0 + y1) / 2, (z0 + z1) / 2);
    return paintY(g, plasterV);
  };
  part.push(face(P0, H.z0, BAR.cabTop, D.ceilY), face(H.z1, P1, BAR.cabTop, D.ceilY), face(H.z0, H.z1, H.y1, D.ceilY));
  // the partition's returns (its sides toward the back bar sections)
  for (const [zz, s] of [[P0, -1], [P1, 1]]) {
    const g = new THREE.PlaneGeometry(hx - B, D.ceilY - BAR.glowTop).rotateY(s > 0 ? 0 : Math.PI).translate((hx + B) / 2, (BAR.glowTop + D.ceilY) / 2, zz);
    part.push(paintY(g, plasterV));
  }
  kit.addMerged(part, M.plaster, { cast: false });
  // below the hatch: the cabinets run on; a panelled face
  partPanel.push(kit.box(B + 0.02, hx, F + 0.09, H.y0 - 0.03, P0, P1));
  kit.addMerged(partPanel, M.cabinet, { cast: false });
  kit.addMerged([kit.box(B + 0.02, hx - 0.05, F, F + 0.09, P0, P1)], M.black, { cast: false });
  // the hatch's steel frame and its pass shelf
  kit.piece();
  const fr = [
    kit.box(hx - 0.004, hx + 0.02, H.y1, H.y1 + 0.04, H.z0 - 0.04, H.z1 + 0.04),
    kit.box(hx - 0.004, hx + 0.02, H.y0 - 0.02, H.y1 + 0.04, H.z0 - 0.04, H.z0),
    kit.box(hx - 0.004, hx + 0.02, H.y0 - 0.02, H.y1 + 0.04, H.z1, H.z1 + 0.04),
    slab(0.62, 0.028, H.z1 - H.z0 + 0.16, { bevel: 0.004, corner: 0.01 }).translate(hx - 0.02, H.y0 - 0.028, (H.z0 + H.z1) / 2),
  ];
  kit.addMerged(fr, M.steel, { cast: false });
  // the ticket rail across the top of the opening, three tickets on it
  kit.piece();
  const tr = [new THREE.CylinderGeometry(0.008, 0.008, H.z1 - H.z0 - 0.1, 12).rotateX(Math.PI / 2).translate(hx + 0.035, H.y1 - 0.03, (H.z0 + H.z1) / 2)];
  kit.add(mergeGeos(tr), M.steel, { cast: false });
  const tickets = [];
  for (const [z, len, tw] of [[1.45, 0.13, 0.08], [1.62, 0.1, 0.07], [2.75, 0.14, 0.08]]) {
    const g = new THREE.PlaneGeometry(tw, len, 1, 3);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.01 * Math.pow((0.5 - p.getY(i) / len), 2));
    g.computeVertexNormals();
    g.rotateY(Math.PI / 2).translate(hx + 0.045, H.y1 - 0.03 - len / 2, z);
    tickets.push(g);
  }
  kit.add(mergeGeos(tickets), M.std('ticket', 0x4a4a4a, 0.95, 'cloth', { side: THREE.DoubleSide }), { cast: false });
  // the bell on the pass shelf
  kit.piece();
  const bx = hx + 0.13, bz = 3.05, by = H.y0;
  const bell = [
    lathe([[0.0001, 0], [0.04, 0], [0.042, 0.008], [0.036, 0.012], [0.0001, 0.012]], 28).translate(bx, by, bz),
    lathe([[0.0001, 0.012], [0.038, 0.012], [0.036, 0.022], [0.028, 0.04], [0.012, 0.05], [0.0001, 0.052]], 32).translate(bx, by, bz),
    new THREE.CylinderGeometry(0.003, 0.003, 0.018, 8).translate(bx, by + 0.06, bz),
    new THREE.SphereGeometry(0.006, 10, 8).translate(bx, by + 0.07, bz),
  ];
  const bellMesh = kit.add(mergeGeos(bell), M.steel, { cast: false });
  out.bell = { mesh: bellMesh, pos: V3(bx, by + 0.05, bz) };

  // the kitchen box behind (its back wall is lit: the cook stands against it)
  kit.piece();
  const kb = [], kd = [];
  const kTop = D.ceilY - 0.9;
  const back = new THREE.PlaneGeometry(P1 - P0 - 0.2, kTop - F, 1, 12).rotateY(Math.PI / 2).translate(B + 0.006, (F + kTop) / 2, (P0 + P1) / 2);
  kb.push(paintY(back, (y) => {
    const t = (y - H.y0) / (H.y1 - H.y0);
    return 0.62 + 0.18 * Math.exp(-Math.pow(t - 0.7, 2) * 3) - 0.35 * Math.max(0, t - 1.1);
  }));
  for (const [zz, s] of [[P0 + 0.1, 1], [P1 - 0.1, -1]]) {
    const g = new THREE.PlaneGeometry(hx - B, kTop - F, 1, 8).rotateY(s > 0 ? 0 : Math.PI).translate((hx + B) / 2, (F + kTop) / 2, zz);
    kb.push(paintY(g, (y) => 0.3 + 0.1 * Math.min(1, Math.max(0, (y - 1.2) / 1))));
  }
  kit.addMerged(kb, M.kitchen, { cast: false, receive: false });
  kd.push(new THREE.PlaneGeometry(hx - B, P1 - P0).rotateX(Math.PI / 2).translate((hx + B) / 2, kTop, (P0 + P1) / 2));
  kit.addMerged(kd, M.kitchenDark, { cast: false });
  // the pan rack: a bar hung from the kitchen's ceiling, pans and a ladle
  // hanging from it, printed as shapes against the lit wall
  kit.piece();
  const rackY = kTop - 0.12, rx = B + 0.2;
  const rack = [new THREE.CylinderGeometry(0.012, 0.012, H.z1 - H.z0 + 0.2, 10).rotateX(Math.PI / 2).translate(rx, rackY, (H.z0 + H.z1) / 2)];
  for (const zz of [H.z0, H.z1]) rack.push(new THREE.CylinderGeometry(0.006, 0.006, kTop - rackY, 6).translate(rx, (kTop + rackY) / 2, zz));
  const pans = [[1.25, 0.12, 0.3], [1.62, 0.16, 0.34], [2.02, 0.1, 0.26], [2.4, 0.14, 0.4], [2.85, 0.11, 0.28], [3.15, 0.06, 0.3]];
  pans.forEach(([z, r, handle], i) => {
    const hang = 0.04 + hash(i, 51) * 0.05;
    const yTop = rackY - hang;
    if (i === 5) {    // a ladle
      rack.push(new THREE.CylinderGeometry(0.006, 0.006, handle, 8).translate(rx, yTop - handle / 2, z));
      rack.push(new THREE.SphereGeometry(0.045, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(rx, yTop - handle, z));
      return;
    }
    rack.push(new THREE.CylinderGeometry(0.01, 0.012, handle, 8).translate(rx, yTop - handle / 2, z));
    // the pan hangs by its handle, its face turned to the room
    const pan = lathe([[0.0001, 0], [r * 0.8, 0], [r, r * 0.35], [r * 1.03, r * 0.38], [0.0001, 0.01]], 32);
    pan.rotateZ(Math.PI / 2).translate(rx + 0.02, yTop - handle - r, z);
    rack.push(pan);
  });
  // a shelf of pots against the back wall, lower
  rack.push(kit.box(B + 0.01, B + 0.24, 1.75, 1.77, P0 + 0.25, P1 - 0.25));
  for (const [z, r, h] of [[1.3, 0.12, 0.2], [1.85, 0.09, 0.14], [2.9, 0.13, 0.24]]) rack.push(lathe([[0.0001, 0], [r, 0], [r, h], [r * 1.08, h], [r * 0.9, h + 0.02], [0.0001, h + 0.03]], 28).translate(B + 0.13, 1.77, z));
  kit.addMerged(rack, M.black, { cast: false });

  // ---- the clock over the hatch: a round face at 11:40, its second hand moving
  kit.piece();
  const ck = { x: hx + 0.02, y: 2.78, z: (H.z0 + H.z1) / 2, r: 0.2 };
  const rim = lathe([[ck.r - 0.02, 0], [ck.r + 0.012, 0], [ck.r + 0.02, 0.02], [ck.r + 0.01, 0.045], [ck.r - 0.01, 0.045], [ck.r - 0.014, 0.03]], 48).rotateZ(-Math.PI / 2).translate(ck.x, ck.y, ck.z);
  kit.add(rim, M.std('clockRim', 0x1a1a1a, 0.35, 'metal'), { cast: false });
  const faceG = new THREE.CircleGeometry(ck.r - 0.012, 48).rotateY(Math.PI / 2).translate(ck.x + 0.03, ck.y, ck.z);
  // (circle uvs 0..1 across its square: into the atlas' clock rect)
  uvRect(faceG, AT.clock);
  kit.add(faceG, M.std('clockFace', 0xffffff, 0.8, 'enamel', { map: PM().atlas.map }), { cast: false });
  const hand = (len, w, name) => {
    const hg = new THREE.Group();
    hg.position.set(ck.x + 0.036, ck.y, ck.z);
    kit.g.add(hg);
    const m = kit.add(new THREE.BoxGeometry(0.004, len, w).translate(0, len / 2 - len * 0.15, 0), M.black, { cast: false, parent: hg });
    m.name = name;
    return hg;
  };
  const hH = hand(0.1, 0.014, 'hour'), hM = hand(0.15, 0.009, 'minute'), hS = hand(0.16, 0.003, 'second');
  hS.position.x += 0.004; hM.position.x += 0.002;
  kit.add(new THREE.SphereGeometry(0.01, 10, 8).translate(ck.x + 0.04, ck.y, ck.z), M.black, { cast: false });
  out.clock = { hour: hH, minute: hM, second: hS, pos: V3(ck.x, ck.y, ck.z) };

  // ---- the fly-paper ribbon by the hatch: a twisted strip, turning
  kit.piece();
  const fp = new THREE.PlaneGeometry(0.05, 0.62, 1, 16);
  const p = fp.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i), a = (0.31 - y) * 5.5;
    p.setXYZ(i, x * Math.cos(a), y, x * Math.sin(a));
  }
  fp.computeVertexNormals();
  const flyG = new THREE.Group();
  flyG.position.set(hx + 0.35, D.ceilY - 0.32, H.z1 + 0.3);
  kit.g.add(flyG);
  kit.add(fp, M.std('flypaper', 0x3a3a3a, 0.4, 'cloth', { side: THREE.DoubleSide }), { cast: false, parent: flyG });
  const flies = [];
  for (let k = 0; k < 7; k++) {
    const y = 0.25 - hash(k, 61) * 0.55, a = (0.31 - y) * 5.5, x = (hash(k, 62) - 0.5) * 0.04;
    flies.push(new THREE.SphereGeometry(0.004, 6, 4).scale(1, 0.6, 1).translate(x * Math.cos(a), y, x * Math.sin(a) + 0.002));
  }
  kit.add(mergeGeos(flies), M.black, { cast: false, parent: flyG });
  kit.add(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 12).translate(0, 0.33, 0), M.black, { cast: false, parent: flyG });
  out.flyPaper = flyG;
  return out;
}

// ---- the pie case at the door end: a glass box on the counter, a pie
// under it (the stand's glass is a breakable of lane 3's kind 'pieCase')
export function buildPieCase(kit, buildProp) {
  const { M } = kit;
  const g = new THREE.Group();
  const cx = C.frontX - 0.3, cz = C.z0 + 0.45, y = C.topY;
  g.position.set(cx, y, cz);
  kit.g.add(g);
  kit.piece();
  const w = 0.44, d = 0.6, h = 0.36;
  const fr = [];
  const post = (x, z) => fr.push(new THREE.BoxGeometry(0.016, h, 0.016).translate(x, h / 2 + 0.02, z));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(sx * w / 2, sz * d / 2);
  fr.push(slab(w + 0.04, 0.02, d + 0.04, { bevel: 0.004, corner: 0.01 }));
  fr.push(slab(w + 0.03, 0.018, d + 0.03, { bevel: 0.004, corner: 0.01 }).translate(0, h + 0.02, 0));
  kit.add(mergeGeos(fr), M.steel, { parent: g });
  const panes = [
    new THREE.PlaneGeometry(d, h).rotateY(Math.PI / 2).translate(w / 2, h / 2 + 0.02, 0),
    new THREE.PlaneGeometry(d, h).rotateY(-Math.PI / 2).translate(-w / 2, h / 2 + 0.02, 0),
    new THREE.PlaneGeometry(w, h).translate(0, h / 2 + 0.02, d / 2),
    new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(0, h / 2 + 0.02, -d / 2),
  ];
  // (one mesh per pane, each flagged userData.glass: lane 3's pieCase break
  // turns each into a pane of its own and shatters it)
  const caseGlass = M.std('caseGlass', 0x505050, 0.12, 'metal', { transparent: true, opacity: 0.12, depthWrite: false });
  for (const pg of panes) kit.add(pg, caseGlass, { parent: g, cast: false }).userData.glass = true;
  // a stand, a pie on it, a second pie lower, half gone
  const stand = lathe([[0.0001, 0.02], [0.06, 0.02], [0.02, 0.03], [0.018, 0.12], [0.14, 0.13], [0.145, 0.137], [0.0001, 0.137]], 40);
  kit.add(stand, M.steel, { parent: g });
  const p1 = buildProp('pie'); p1.position.set(0, 0.137, 0.02); p1.rotation.y = 2.2; g.add(p1);
  return { group: g, pie: p1, centre: V3(cx, y + h / 2, cz) };
}

// ---- the cash register at the far end: an ornate box, keys on its slope,
// a flag window on top, a crank, a drawer that opens toward the staff side
export function buildRegister(kit) {
  const { M } = kit;
  const g = new THREE.Group();
  const x = C.frontX - 0.34, z = C.z1 - 0.38, y = C.topY;
  g.position.set(x, y, z);
  kit.g.add(g);
  kit.piece();
  const body = [];
  body.push(slab(0.36, 0.14, 0.4, { bevel: 0.012, corner: 0.02 }));                          // the drawer's housing
  const slope = slab(0.3, 0.16, 0.36, { bevel: 0.012, corner: 0.02 });
  slope.translate(0, 0.14, 0);
  body.push(slope);
  body.push(slab(0.14, 0.13, 0.3, { bevel: 0.01, corner: 0.02 }).translate(0.06, 0.3, 0));     // the top box
  body.push(lathe([[0.0001, 0], [0.06, 0], [0.065, 0.02], [0.03, 0.05], [0.0001, 0.055]], 24).rotateZ(Math.PI / 2).translate(0.13, 0.36, 0)); // (the crest)
  kit.add(mergeGeos(body), M.std('register', 0x0a0a0a, 0.28, 'metal'), { parent: g });
  // the keys: rows of round caps on the slope, facing the staff (-x)
  kit.piece();
  const keys = [];
  for (let c = 0; c < 6; c++) for (let r = 0; r < 4; r++) {
    const kx = -0.16 - r * 0.0 + 0.0, kz = -0.14 + c * 0.056;
    const ky = 0.17 + r * 0.035;
    keys.push(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 14).rotateZ(Math.PI / 2 - 0.5).translate(kx + r * 0.022, ky, kz));
  }
  kit.add(mergeGeos(keys), PM().chinaRim, { parent: g, cast: false });
  kit.add(mergeGeos(keys.map((k) => k.clone().translate(-0.004, 0.003, 0).scale(1, 1, 1))), M.std('keyTop', 0x3a3a3a, 0.5, 'enamel'), { parent: g, cast: false });
  // the flag window (a small lit card of numbers) and the crank
  kit.add(new THREE.PlaneGeometry(0.2, 0.06).rotateY(-Math.PI / 2).translate(-0.011, 0.395, 0), M.glow('regWin', 0.12), { parent: g, cast: false });
  kit.add(tubeAlong([V3(0, 0.12, 0.2), V3(0.02, 0.12, 0.25), V3(0.02, 0.06, 0.27), V3(0.02, 0.04, 0.3)], 0.008, 8, 16), M.black, { parent: g, cast: false });
  // the drawer: slides out toward -x when open()
  kit.piece();
  const drawer = new THREE.Group();
  g.add(drawer);
  kit.add(slab(0.33, 0.08, 0.36, { bevel: 0.006, corner: 0.01 }).translate(0, 0.02, 0), M.std('drawer', 0x1c1c1c, 0.4, 'metal'), { parent: drawer });
  kit.add(new THREE.BoxGeometry(0.01, 0.018, 0.1).translate(-0.17, 0.06, 0), M.steel, { parent: drawer, cast: false });
  // the coins' tray inside (seen when it is out)
  const bins = [];
  for (let k = 0; k < 4; k++) bins.push(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 16).translate(-0.08, 0.1, -0.12 + k * 0.08));
  kit.add(mergeGeos(bins), PM().chrome, { parent: drawer, cast: false });
  return { group: g, drawer, pos: V3(x, y, z) };
}
