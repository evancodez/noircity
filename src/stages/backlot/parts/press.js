import * as THREE from 'three';
import { holeyPanel } from '../kit.js';
import { arch } from '../arch.js';
import { lathe, tube, V3, roundedBox, merge } from '../../../world/geom.js';
import { allocInkId, markFigure, tagInk } from '../../../render/layers.js';
import { PRESS, KDOOR, KITCHEN, AVENUE, BALLEY, YARD } from '../plan.js';

// [C6 2nd] The Evening Star's press hall (chapter V, the stretch `press`):
// the night edition running. A tall brick hall behind the kitchen, its
// trusses in the dark overhead; two lines of presses down its length, each a
// reel stand at the west wall, two printing units and a folder, the paper web
// running through them; one lamp over each unit, the rest ink. The kitchen's
// iron door comes in at the north-west corner (the north aisle: spare reels
// along the wall, the paper store in the far corner); the way on is under
// the web where it crosses the gap between the north line's two units (the
// paper itself is the pale edge), across the middle aisle and over the
// conveyor that carries the bundles from the folders (its rails pale), to
// the loading dock in the east wall and out onto the avenue under the el.
// The things in the way are things.js's (the web, the conveyor, the bundles);
// this is the hall, the machines, their motion and their light.
//   api.lamps                 the lamps over the units, the conveyor, the dock
//   api.update(dt)            the gears turn, the web runs, the bundles ride
//   api.webSpeed              the paper's speed (m/s)
const PAPER_SPEED = 5.5;

export default {
  name: 'press', order: 65, tick: 65,
  build(stage) {
    const A = arch(stage, 6565);
    const { MAT, K, face, fbox, facade, mass } = A;
    const { M } = stage;
    const P = PRESS, T = P.T;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const api = { MAT, lamps: {}, webSpeed: PAPER_SPEED };
    const zi0 = P.z0 + T, zi1 = P.z1 - T, xi0 = P.x0 + T, xi1 = P.x1 - T;
    const D = P.dock;

    // ---- the shell -------------------------------------------------------------------------
    // north wall (on the alley behind), south wall (against the next block)
    K.box('pressShell', MAT.brickDark, P.x0, P.x1, 0, P.h, P.z0, zi0);
    K.box('pressShell', MAT.brickDark, xi0, P.x1, 0, P.h, zi1, P.z1);
    // the west wall: the kitchen's east wall is it to the kitchen's height
    // (its door is the kitchen's); over the kitchen's roof and south of it, the hall's own
    K.box('pressShell', MAT.brickDark, P.x0, xi0, KITCHEN.h, P.h, P.z0, KITCHEN.z1);
    holeyPanel(K, 'pressShell', MAT.brickDark, 'x', P.x0, xi0, P.z0, KITCHEN.z1, 0, KITCHEN.h, [[KDOOR.z - KDOOR.w / 2, KDOOR.z + KDOOR.w / 2, 0, KDOOR.h]]);
    K.box('pressShell', MAT.brickDark, P.x0, xi0, 0, P.h, KITCHEN.z1, P.z1);
    // the east wall on the avenue, the dock's doorway in it
    holeyPanel(K, 'pressShell', MAT.brickDark, 'x', xi1, P.x1, P.z0, P.z1, 0, P.h, [[D.z - D.w / 2, D.z + D.w / 2, 0, D.h]]);
    K.box('pressShell', MAT.tar, P.x0, P.x1, P.h - 0.3, P.h, P.z0, P.z1);
    const col = (x0, x1, z0, z1, tag = 'wall') => K.collide(x0, x1, z0, z1, tag);
    col(P.x0, P.x1, P.z0, zi0); col(P.x0, P.x1, zi1, P.z1);
    col(P.x0, xi0, KITCHEN.z1, P.z1);
    col(P.x0, xi0, P.z0, KDOOR.z - KDOOR.w / 2); col(P.x0, xi0, KDOOR.z + KDOOR.w / 2, KITCHEN.z1);
    // (the door's frame on this side)
    {
      const Fw = face('x', xi0, 1);
      fbox('pressShell', MAT.trim, Fw, KDOOR.z - KDOOR.w / 2 - 0.12, KDOOR.z - KDOOR.w / 2, 0, KDOOR.h + 0.12, 0, 0.1);
      fbox('pressShell', MAT.trim, Fw, KDOOR.z + KDOOR.w / 2, KDOOR.z + KDOOR.w / 2 + 0.12, 0, KDOOR.h + 0.12, 0, 0.1);
      fbox('pressShell', MAT.trim, Fw, KDOOR.z - KDOOR.w / 2 - 0.12, KDOOR.z + KDOOR.w / 2 + 0.12, KDOOR.h, KDOOR.h + 0.14, 0, 0.12);
    }
    col(xi1, P.x1, P.z0, D.z - D.w / 2); col(xi1, P.x1, D.z + D.w / 2, P.z1);
    stage.dry.push(new THREE.Box3(V3(P.x0, 0, P.z0), V3(P.x1, P.h, P.z1)));
    // its outer faces: high windows lit from the presses (on the alley, on the
    // yard over the east lane, on the avenue), the dock's canopy, the paper's
    // name on a board over it
    facade('pressShell', face('z', P.z0, -1), P.x0, P.x1, P.h, { bay: 3.0, from: 1, litP: 0.4, pipes: [76.2, 90.6] });
    facade('pressShell', face('x', P.x0, -1), KITCHEN.z1, P.z1, P.h, { bay: 3.3, from: 1, litP: 0.5, cornice: false });
    facade('pressShell', face('x', P.x1, 1), P.z0, P.z1, P.h, { bay: 3.2, from: 1, litP: 0.35, skip: [[D.z - 3.2, D.z + 3.2]] });
    {
      const Fe = face('x', P.x1, 1);
      fbox('pressShell', MAT.trim, Fe, D.z - D.w / 2 - 0.2, D.z - D.w / 2, 0, D.h + 0.2, 0, 0.16);
      fbox('pressShell', MAT.trim, Fe, D.z + D.w / 2, D.z + D.w / 2 + 0.2, 0, D.h + 0.2, 0, 0.16);
      fbox('pressShell', MAT.trim, Fe, D.z - D.w / 2 - 0.2, D.z + D.w / 2 + 0.2, D.h, D.h + 0.22, 0, 0.18);
      // the shutter rolled up in its box over the doorway
      fbox('pressShell', MAT.metal, Fe, D.z - D.w / 2, D.z + D.w / 2, D.h - 0.42, D.h, -0.36, -0.02);
      // the canopy over the dock: a steel awning on two rods
      fbox('pressCanopy', MAT.iron, Fe, D.z - D.w / 2 - 0.6, D.z + D.w / 2 + 0.6, D.h + 0.5, D.h + 0.6, 0, 1.6);
      for (const s of [-1, 1]) K.add('pressCanopy', MAT.iron, tube([V3(P.x1 + 1.55, D.h + 0.52, D.z + s * (D.w / 2 + 0.4)), V3(P.x1, D.h + 1.6, D.z + s * (D.w / 2 + 0.4))], 0.025, 6, 2));
      // the board: the paper's name in the dark (a pale board, the letters ink)
      fbox('pressShell', MAT.plaster, Fe, D.z - 5.2, D.z + 5.2, 5.0, 6.1, 0, 0.06);
      const letters = [];
      for (let i = 0; i < 15; i++) {
        if (i === 3 || i === 11) continue;
        const u = D.z - 4.6 + i * 0.66, w = 0.36 + ((i * 37) % 5) * 0.03;
        letters.push(new THREE.BoxGeometry(0.03, 0.62, w).translate(P.x1 + 0.08, 5.55, u));
      }
      K.add('pressShell', MAT.black, merge(letters), { cast: false, noRay: true });
    }

    // ---- inside: the floor, the trusses ------------------------------------------------------
    {
      const floor = std({ color: 0x3e3e3e, roughness: 0.55, envMap: M.envSoft, envMapIntensity: 0.4 });
      const g = new THREE.PlaneGeometry(xi1 - xi0, zi1 - zi0).rotateX(-Math.PI / 2).translate((xi0 + xi1) / 2, 0.005, (zi0 + zi1) / 2);
      K.add('pressFloor', floor, g, { cast: false });
      // the walls inside: a dado of dark paint to the shoulder, a pale line on it
      for (const [x0, x1, z0, z1] of [[xi0, xi1, zi0, zi0 + 0.02], [xi0, xi1, zi1 - 0.02, zi1], [xi0, xi0 + 0.02, zi0, zi1], [xi1 - 0.02, xi1, zi0, D.z - D.w / 2], [xi1 - 0.02, xi1, D.z + D.w / 2, zi1]]) {
        K.box('pressDado', MAT.woodDark, x0, x1, 0.02, 1.6, z0, z1);
      }
      // the iron trusses across the hall, the purlins along it
      const tr = [];
      for (let x = 72.6; x < P.x1 - 1; x += 3.9) {
        const yb = 7.2, yt = 9.0;
        tr.push(tube([V3(x, yb, zi0), V3(x, yb, zi1)], 0.05, 6, 2));
        const n = 8;
        for (let i = 0; i < n; i++) {
          const z0 = zi0 + (zi1 - zi0) * i / n, z1 = zi0 + (zi1 - zi0) * (i + 1) / n;
          const yA = yt - Math.abs((z0 - (zi0 + zi1) / 2) / ((zi1 - zi0) / 2)) * 1.2, yB = yt - Math.abs((z1 - (zi0 + zi1) / 2) / ((zi1 - zi0) / 2)) * 1.2;
          tr.push(tube([V3(x, yA, z0), V3(x, yB, z1)], 0.045, 6, 2));
          tr.push(tube([V3(x, yb, z0), V3(x, i % 2 ? yA : yB, i % 2 ? z0 : z1)], 0.025, 5, 2));
          tr.push(tube([V3(x, yb, z1), V3(x, yB, z1)], 0.02, 5, 2));
        }
      }
      for (const z of [-96.0, -87.0, -78.0]) tr.push(tube([V3(xi0, 8.2, z), V3(xi1, 8.2, z)], 0.035, 5, 2));
      K.add('pressTruss', MAT.iron, merge(tr), { figure: true, cast: false });
    }

    // the tall windows high in its walls, pale with the street's light outside
    // (the avenue's lamps and the el's, the alley's): the hall's rhythm in the
    // dark over the machines, the trusses across them
    {
      const pale = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.5, 0.5) });
      const dim = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.32, 0.32) });
      const fr = [];
      const win = (mat, F, u, y0, w, h) => {
        A.fplane('pressWin', mat, F, u, y0 + h / 2, w, h, 0.01, { cast: false, noRay: true });
        fr.push([F, u, y0, w, h]);
      };
      for (let z = P.z0 + 2.6; z < P.z1 - 1.5; z += 3.2) if (Math.abs(z - (-87.6)) > 1.2) win(pale, face('x', xi1, -1), z, 5.0, 1.3, 2.6);
      for (let x = P.x0 + 3.0; x < P.x1 - 1.5; x += 3.6) win(dim, face('z', zi0, 1), x, 5.2, 1.3, 2.4);
      for (let x = P.x0 + 3.0; x < P.x1 - 1.5; x += 3.6) win(dim, face('z', zi1, -1), x, 5.2, 1.3, 2.4);
      // (their glazing bars)
      for (const [F, u, y0, w, h] of fr) {
        fbox('pressWin', MAT.iron, F, u - w / 2 - 0.06, u + w / 2 + 0.06, y0 - 0.06, y0, 0, 0.06);
        fbox('pressWin', MAT.iron, F, u - w / 2 - 0.06, u + w / 2 + 0.06, y0 + h, y0 + h + 0.06, 0, 0.06);
        fbox('pressWin', MAT.iron, F, u - 0.02, u + 0.02, y0, y0 + h, 0, 0.04);
        for (let y = y0 + h / 4; y < y0 + h - 0.1; y += h / 4) fbox('pressWin', MAT.iron, F, u - w / 2, u + w / 2, y - 0.02, y + 0.02, 0, 0.04);
      }
    }

    // ---- the presses ---------------------------------------------------------------------------
    const paperTex = makePrintTexture();
    // (paper reads pale even out of the lamps' pools: a little light of its own)
    const paper = std({ color: 0xe6e6e6, map: paperTex, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x2c2c2c, envMap: M.envSoft, envMapIntensity: 0.05 });
    const paperPlain = std({ color: 0xdcdcdc, roughness: 0.85, emissive: 0x262626, envMap: M.envSoft, envMapIntensity: 0.05 });
    api.paperTex = paperTex;
    // (the bright steel of the journals, the bolts, the gears' teeth: they catch the lamps)
    const steel = std({ color: 0xa8a8a8, metalness: 0.7, roughness: 0.32, envMap: M.envSoft, envMapIntensity: 0.9 });
    const gears = [];         // { x, y, z, r, w, dir }
    const cyl = (x, y, z0, z1, r) => new THREE.CylinderGeometry(r, r, z1 - z0, 20).rotateX(Math.PI / 2).translate(x, y, (z0 + z1) / 2);
    const unit = (g, ua, ub, z0, z1, aisle) => {
      const parts = [], bright = [];
      const fz = [z0 + 0.08, z1 - 0.08];
      // the two side frames: heavy iron, open (two tall windows in each, the
      // cylinders and the paper seen through them), bolted to the plinth
      const L0 = ub - ua;
      for (const z of fz) {
        const out = z < (z0 + z1) / 2 ? -1 : 1;
        parts.push(new THREE.BoxGeometry(L0, 0.42, 0.16).translate((ua + ub) / 2, 0.25 + 0.21, z));
        parts.push(new THREE.BoxGeometry(L0, 0.34, 0.16).translate((ua + ub) / 2, 3.0, z));
        for (const [x, w] of [[ua + 0.16, 0.32], [ua + L0 * 0.5, 0.26], [ub - 0.16, 0.32]]) parts.push(new THREE.BoxGeometry(w, 2.6, 0.16).translate(x, 1.7, z));
        // (the windows' arched heads)
        for (const [xa, xb] of [[ua + 0.32, ua + L0 * 0.5 - 0.13], [ua + L0 * 0.5 + 0.13, ub - 0.32]]) {
          const n = 10, r = (xb - xa) / 2;
          for (let i = 0; i < n; i++) {
            const t0 = Math.PI * i / n, t1 = Math.PI * (i + 1) / n, xm = (xa + xb) / 2;
            const xa0 = xm - Math.cos(t0) * r, xa1 = xm - Math.cos(t1) * r;
            const ya = 2.83 - r * 0.35 + Math.sin(t0) * r * 0.35, yb = 2.83 - r * 0.35 + Math.sin(t1) * r * 0.35;
            parts.push(new THREE.BoxGeometry(Math.abs(xa1 - xa0) + 0.02, 2.83 - Math.min(ya, yb) + 0.02, 0.16).translate((xa0 + xa1) / 2, (2.83 + Math.min(ya, yb)) / 2, z));
          }
        }
        // the frame's bolts along its rails: bright dots
        for (let x = ua + 0.4; x < ub - 0.3; x += 0.5) bright.push(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8).rotateX(Math.PI / 2).translate(x, 0.38, z + out * 0.1), new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8).rotateX(Math.PI / 2).translate(x, 3.06, z + out * 0.1));
      }
      // the plinth
      parts.push(new THREE.BoxGeometry(ub - ua + 0.2, 0.25, z1 - z0 + 0.2).translate((ua + ub) / 2, 0.125, (z0 + z1) / 2));
      // the cylinders between the frames (the plate, the blanket, the
      // impression; the ink rollers in a cluster over them), their bright journals
      const L = ub - ua;
      const cs = [[0.22, 1.05, 0.34], [0.46, 1.05, 0.3], [0.22, 2.0, 0.34], [0.46, 2.0, 0.3], [0.68, 1.55, 0.22]];
      for (const [k, y, r] of cs) {
        const x = ua + L * k;
        parts.push(cyl(x, y, fz[0] + 0.07, fz[1] - 0.07, r));
        bright.push(cyl(x, y, fz[0] - 0.12, fz[0] - 0.06, r * 0.45), cyl(x, y, fz[1] + 0.06, fz[1] + 0.12, r * 0.45));
      }
      for (let i = 0; i < 4; i++) parts.push(cyl(ua + L * (0.3 + i * 0.09), 2.62 + (i % 2) * 0.12, fz[0] + 0.07, fz[1] - 0.07, 0.09));
      // the ink fountain along the top, the catwalk over it with its rail on the aisle side
      parts.push(new THREE.BoxGeometry(L * 0.5, 0.3, z1 - z0 - 0.3).translate(ua + L * 0.4, 2.95, (z0 + z1) / 2));
      parts.push(new THREE.BoxGeometry(L, 0.05, 0.7).translate((ua + ub) / 2, 3.32, aisle > 0 ? z1 - 0.35 : z0 + 0.35));
      const zr = aisle > 0 ? z1 + 0.02 : z0 - 0.02;
      parts.push(tube([V3(ua, 4.3, zr), V3(ub, 4.3, zr)], 0.022, 6, 2));
      for (let x = ua + 0.1; x <= ub; x += 1.0) parts.push(tube([V3(x, 3.32, zr), V3(x, 4.3, zr)], 0.016, 5, 2));
      K.add(g, M.iron, merge(parts), { figure: true });
      K.add(g + 'Bright', steel, merge(bright), { figure: true });
      // the gears on the aisle side (they turn: api.update)
      const zg = aisle > 0 ? fz[1] + 0.13 : fz[0] - 0.13;
      gears.push({ x: ua + L * 0.34, y: 1.5, z: zg, r: 0.62, dir: 1 }, { x: ua + L * 0.34 + 0.95, y: 2.18, z: zg, r: 0.36, dir: -0.62 / 0.36 });
      col(ua - 0.05, ub + 0.05, z0 - 0.08, z1 + 0.08, 'press');
    };
    const lines = [['N', P.lineN, 1, -1], ['S', P.lineS, -1, 1]];
    const webs = [];          // ribbons of the web: [points], width
    for (const [name, Lz, aisleSide] of lines) {
      const z0 = Lz.z0, z1 = Lz.z1, zm = (z0 + z1) / 2, g = 'press' + name;
      // the reel stand at the west wall and its reel (the paper, pale)
      {
        const parts = [];
        for (const z of [z0 + 0.12, z1 - 0.12]) {
          parts.push(tube([V3(xi0 + 0.15, 0, z), V3(71.9, 0.72, z), V3(73.4, 0, z)], 0.06, 6, 3));
          parts.push(cyl(71.9, 0.72, z - 0.06, z + 0.06, 0.14));
        }
        parts.push(cyl(71.9, 0.72, z0 + 0.06, z1 - 0.06, 0.05));
        K.add(g, M.iron, merge(parts), { figure: true });
        K.add(g + 'Reel', paperPlain, cyl(71.9, 0.72, z0 + 0.3, z1 - 0.3, 0.6), { figure: true });
        K.add(g + 'Reel', MAT.woodDark, cyl(71.9, 0.72, z0 + 0.28, z1 - 0.28, 0.12));
        col(xi0, P.units[0][0], z0 - 0.05, z1 + 0.05, 'reelstand');
      }
      // the two units
      unit(g + 'U1', P.units[0][0], P.units[0][1], z0, z1, aisleSide);
      unit(g + 'U2', P.units[1][0], P.units[1][1], z0, z1, aisleSide);
      // the gap between them: on the north line it is the web's (things.js
      // puts the slab under it); on the south line a guard rail across it
      if (name === 'S') {
        const gp = [];
        for (const y of [0.5, 1.05]) gp.push(new THREE.BoxGeometry(P.units[1][0] - P.units[0][1], 0.05, 0.05).translate((P.units[0][1] + P.units[1][0]) / 2, y, z1 + 0.05));
        for (const x of [P.units[0][1] + 0.05, P.units[1][0] - 0.05]) gp.push(new THREE.BoxGeometry(0.05, 1.1, 0.05).translate(x, 0.55, z1 + 0.05));
        K.add(g + 'Rail', MAT.metal, merge(gp), { figure: true });
        col(P.units[0][1], P.units[1][0], z0, z1, 'press');
      }
      // the folder: taller, a box of a machine with its former (a triangle
      // of steel the web folds over) on top and its delivery onto the conveyor
      {
        const [fa, fb] = P.folder;
        const x1 = P.conveyor.x - P.conveyor.w / 2;
        const parts = [roundedBox(fb - fa, 3.3, z1 - z0, 0.06, 2).translate((fa + fb) / 2, 1.65, zm)];
        const tri = new THREE.BufferGeometry();
        tri.setAttribute('position', new THREE.Float32BufferAttribute([fa + 0.2, 3.3, z0 + 0.3, fa + 0.2, 3.3, z1 - 0.3, fb - 0.2, 4.4, zm, fa + 0.2, 3.3, z1 - 0.3, fa + 0.2, 3.3, z0 + 0.3, fb - 0.2, 4.4, zm], 3));
        tri.computeVertexNormals();
        parts.push(tri);
        // (the delivery: a chute to the conveyor)
        parts.push(new THREE.BoxGeometry(x1 - fb, 0.7, 1.4).translate((fb + x1) / 2, 0.95, zm));
        parts.push(new THREE.BoxGeometry(x1 - fb, 1.6, 0.1).translate((fb + x1) / 2, 0.8, zm - 0.75), new THREE.BoxGeometry(x1 - fb, 1.6, 0.1).translate((fb + x1) / 2, 0.8, zm + 0.75));
        K.add(g + 'F', M.iron, merge(parts), { figure: true });
        col(fa, x1, z0 - 0.05, z1 + 0.05, 'folder');
      }
      // the web: off the reel, up into unit 1; out of unit 1 and across the
      // gap low (the north line: a man goes under it), into unit 2; out of
      // unit 2 up over its catwalk and down onto the folder's former
      const [u1, u2] = P.units;
      const lo = name === 'N' ? P.web.y + 0.02 : 1.0;
      webs.push({ pts: [V3(71.9, 1.32, zm), V3(u1[0] + 0.1, 2.55, zm)], w: 1.5 });
      // (through each unit, round its cylinders: seen through the frames' windows)
      for (const [ua, ub] of [u1, u2]) {
        const Lu = ub - ua;
        webs.push({ pts: [V3(ua + 0.1, 2.55, zm), V3(ua + Lu * 0.22 + 0.36, 2.0, zm), V3(ua + Lu * 0.34, 1.52, zm), V3(ua + Lu * 0.46 - 0.32, 1.05, zm), V3(ub - 0.2, ub === u1[1] ? lo : 3.0, zm)], w: 1.45 });
      }
      webs.push({ pts: [V3(u1[1] - 0.15, lo, zm), V3(u2[0] + 0.15, lo, zm)], w: P.web.w });
      if (name === 'N') webs.push({ pts: [V3(u2[1] - 0.2, 3.05, zm), V3(u2[1] + 0.25, 4.6, zm), V3(P.folder[1] - 0.25, 4.38, zm)], w: 1.5 });
      else webs.push({ pts: [V3(u1[1] - 0.2, 3.05, zm), V3(u1[1] + 0.3, 5.6, zm), V3(u2[0] + 0.3, 5.6, zm), V3(u2[0] + 0.6, 3.1, zm), V3(u2[1] - 0.2, 3.05, zm), V3(u2[1] + 0.25, 4.6, zm), V3(P.folder[1] - 0.25, 4.38, zm)], w: 1.5 });
    }
    // the web's ribbons (UV u along the run, in metres / 0.6: the print scrolls)
    {
      const geos = [];
      for (const W of webs) {
        let s = 0;
        for (let i = 0; i < W.pts.length - 1; i++) {
          const a = W.pts[i], b = W.pts[i + 1];
          const L = a.distanceTo(b);
          const g = new THREE.PlaneGeometry(L, W.w).rotateX(-Math.PI / 2);
          const uv = g.getAttribute('uv');
          for (let k = 0; k < uv.count; k++) uv.setXY(k, (s + uv.getX(k) * L) / 0.6, uv.getY(k));
          const d = b.clone().sub(a);
          g.rotateZ(Math.atan2(d.y, Math.hypot(d.x, d.z)));
          g.rotateY(-Math.atan2(d.z, d.x));
          g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
          geos.push(g);
          s += L;
        }
      }
      const m = new THREE.Mesh(merge(geos), paper);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.inkId = allocInkId();
      m.userData.noRay = true;
      stage.scene.add(m);
      api.web = m;
    }
    // the gears: one instanced wheel (a rim, spokes, a hub, teeth), turning
    {
      const r = 1;
      const parts = [new THREE.TorusGeometry(r * 0.86, r * 0.07, 6, 36)];
      for (let i = 0; i < 6; i++) parts.push(new THREE.BoxGeometry(r * 1.6, r * 0.09, 0.05).rotateZ(i * Math.PI / 6));
      parts.push(new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.12, 16).rotateX(Math.PI / 2));
      for (let i = 0; i < 28; i++) { const a = i * Math.PI * 2 / 28; parts.push(new THREE.BoxGeometry(r * 0.12, r * 0.12, 0.07).rotateZ(a).translate(Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96, 0)); }
      const geo = merge(parts);
      const im = new THREE.InstancedMesh(geo, steel, gears.length);
      im.userData.inkId = allocInkId();
      im.userData.inkPerInstance = false;
      im.userData.noRay = true;
      im.castShadow = true;
      im.frustumCulled = false;
      stage.scene.add(im);
      markFigure(im);
      api.gears = { im, list: gears, a: 0 };
    }

    // ---- the conveyor across the middle aisle (its slab is things.js's) -------------------
    {
      const C = P.conveyor, x0 = C.x - C.w / 2, x1 = C.x + C.w / 2;
      // (from the north line's folder, za, south across the aisle to the south line's, zb)
      const za = P.lineN.z1, zb = P.lineS.z0, len = zb - za, zc = (za + zb) / 2;
      const parts = [];
      for (const x of [x0 + 0.04, x1 - 0.04]) parts.push(new THREE.BoxGeometry(0.08, 0.16, len).translate(x, C.y - 0.06, zc));
      for (let z = za + 0.3; z < zb - 0.1; z += 1.1) for (const x of [x0 + 0.06, x1 - 0.06]) parts.push(new THREE.BoxGeometry(0.06, C.y - 0.1, 0.06).translate(x, (C.y - 0.1) / 2, z));
      K.add('conveyor', M.iron, merge(parts), { figure: true });
      // (the rollers: across the belt)
      const rg = [];
      for (let z = za + 0.12; z < zb; z += 0.18) rg.push(new THREE.CylinderGeometry(0.035, 0.035, C.w - 0.12, 8).rotateZ(Math.PI / 2).translate(C.x, C.y - 0.02, z));
      K.add('conveyor', MAT.metal, merge(rg), { figure: true });
      // the bundles riding it (tied stacks of the edition): they move
      const bun = new THREE.Group();
      const bg = merge([roundedBox(0.6, 0.3, 0.42, 0.04, 2).translate(0, 0.15, 0), new THREE.BoxGeometry(0.62, 0.02, 0.03).translate(0, 0.31, 0), new THREE.BoxGeometry(0.03, 0.02, 0.44).translate(0, 0.31, 0)]);
      const list = [];
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(bg, paperPlain); m.castShadow = true; m.userData.noRay = true; bun.add(m); list.push(m); }
      bun.userData.inkId = allocInkId();
      tagInk(bun);
      stage.scene.add(bun);
      api.bundles = { list, za, zb, s: 0, len };
    }

    // ---- the north aisle: spare reels along the wall, the paper store ---------------------
    {
      const reels = [];
      for (let x = 74.6; x < 87.5; x += 1.35) {
        reels.push(new THREE.CylinderGeometry(0.58, 0.58, 1.2, 22).translate(x, 0.6, zi0 + 0.7));
        if ((x * 7) % 3 < 1.5) reels.push(new THREE.CylinderGeometry(0.58, 0.58, 1.2, 22).translate(x + 0.4, 1.8, zi0 + 0.7));
      }
      K.add('pressReels', paperPlain, merge(reels), { figure: true });
      const cores = [];
      for (let x = 74.6; x < 87.5; x += 1.35) {
        cores.push(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 14).translate(x, 1.21, zi0 + 0.7));
        if ((x * 7) % 3 < 1.5) cores.push(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 14).translate(x + 0.4, 2.41, zi0 + 0.7));
      }
      K.add('pressReels', MAT.black, merge(cores), { cast: false, noRay: true });
      col(73.8, 88.2, zi0, zi0 + 1.35, 'reels');
      // the paper store in the north-east corner: its brick walls, a door in
      // its west face (shut), reels on end seen over its half wall of mesh
      const sx0 = P.folder[0] + 0.6, sz1 = P.lineN.z0 - 0.02;
      mass('pressStore', MAT.brickDark, sx0, xi1, zi0, sz1, 2.6, 0, false);
      fbox('pressStore', MAT.woodDark, face('x', sx0, -1), (zi0 + sz1) / 2 - 0.55, (zi0 + sz1) / 2 + 0.55, 0.05, 2.15, 0, 0.05);
      const mesh = [];
      for (let x = sx0 + 0.15; x < xi1; x += 0.15) mesh.push(new THREE.BoxGeometry(0.012, 1.4, 0.012).translate(x, 3.3, sz1 - 0.05));
      for (let y = 2.65; y < 4.0; y += 0.15) mesh.push(new THREE.BoxGeometry(xi1 - sx0, 0.012, 0.012).translate((sx0 + xi1) / 2, y, sz1 - 0.05));
      K.add('pressStoreMesh', MAT.iron, merge(mesh), { cast: false, noRay: true });
      const ends = [];
      for (let x = sx0 + 0.7; x < xi1 - 0.4; x += 1.1) for (let z = zi0 + 0.7; z < sz1 - 0.4; z += 1.15) ends.push(new THREE.CylinderGeometry(0.5, 0.5, 2.9, 18).translate(x, 2.6 + 0.25, z));
      K.add('pressStore', paperPlain, merge(ends), { figure: true });
      col(sx0, xi1, zi0, sz1, 'store');
      // (the gap between the folder and the store is the conveyor's head's)
      col(P.folder[1], sx0 + 0.1, sz1 - 0.6, P.lineN.z0 + 0.1, 'store');
    }
    // the middle aisle: a foreman's desk under its lamp by the folders, a clock
    {
      K.add('pressDesk', MAT.woodDark, roundedBox(1.4, 0.06, 0.8, 0.02, 1).translate(xi1 - 1.0, 1.0, -88.6));
      for (const [dx, dz] of [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]]) K.box('pressDesk', MAT.woodDark, xi1 - 1.0 + dx - 0.03, xi1 - 1.0 + dx + 0.03, 0, 0.98, -88.6 + dz - 0.03, -88.6 + dz + 0.03);
      K.add('pressDesk', paperPlain, new THREE.BoxGeometry(0.42, 0.012, 0.3).rotateY(0.2).translate(xi1 - 1.2, 1.04, -88.5), { noRay: true });
      col(xi1 - 1.75, xi1, -89.05, -88.15, 'desk');
      // the clock on the east wall: a pale face, ink hands
      K.add('pressClock', MAT.plaster, new THREE.CylinderGeometry(0.4, 0.4, 0.06, 28).rotateZ(Math.PI / 2).translate(xi1 - 0.03, 4.6, -87.6), { cast: false });
      K.add('pressClock', MAT.black, merge([new THREE.BoxGeometry(0.02, 0.3, 0.035).translate(xi1 - 0.07, 4.72, -87.6), new THREE.BoxGeometry(0.02, 0.035, 0.24).rotateX(0.5).translate(xi1 - 0.07, 4.6, -87.5)]), { cast: false, noRay: true });
    }
    // the mailroom along the south wall: the tying tables, bundles stacked
    {
      const parts = [], bun = [];
      for (const x0 of [74.0, 79.5, 85.0]) {
        parts.push(roundedBox(4.0, 0.06, 1.2, 0.02, 1).translate(x0 + 2.0, 0.92, zi1 - 0.75));
        for (const dx of [0.1, 3.9]) for (const dz of [-0.5, 0.5]) parts.push(new THREE.BoxGeometry(0.06, 0.9, 0.06).translate(x0 + dx, 0.45, zi1 - 0.75 + dz));
        for (let i = 0; i < 5; i++) bun.push(roundedBox(0.6, 0.3, 0.42, 0.04, 2).translate(x0 + 0.6 + i * 0.7, 1.1 + (i % 2) * 0.3, zi1 - 0.75));
        col(x0, x0 + 4.0, zi1 - 1.4, zi1, 'table');
      }
      for (let i = 0; i < 9; i++) bun.push(roundedBox(0.6, 0.3, 0.42, 0.04, 2).translate(91.0 + (i % 3) * 0.66, 0.15 + Math.floor(i / 3) * 0.31, zi1 - 0.4));
      col(90.6, 93.0, zi1 - 0.65, zi1, 'bundles');
      K.add('pressMail', MAT.woodDark, merge(parts), { figure: true });
      K.add('pressMail', paperPlain, merge(bun), { figure: true });
    }

    // ---- the light: a lamp over each unit, the conveyor, the dock ------------------------------
    const L = stage.part('lamps');
    {
      const yA = 7.15;
      const hang = (x, z, real) => { const l = L.hang(x, yA, z, { real }); if (l.light) { l.light.intensity = 120; l.light.angle = 0.7; l.light.penumbra = 0.85; } return l; };
      const zN = (P.lineN.z0 + P.lineN.z1) / 2, zS = (P.lineS.z0 + P.lineS.z1) / 2;
      api.lamps.n1 = hang(76.1, zN, false);
      api.lamps.aisle = hang(74.2, -96.8, true);
      api.lamps.web = hang(P.web.x, zN + 0.2, true);
      api.lamps.n2 = hang(83.3, zN, true);
      api.lamps.s1 = hang(76.1, zS, false);
      api.lamps.s2 = hang(83.3, zS, false);
      api.lamps.conv = hang(P.conveyor.x, -87.6, true);
      // (the north aisle's door end: a bulb over the kitchen's door)
      api.lamps.door = L.wall(xi0, 3.0, KDOOR.z + 1.2, 1, 0, { out: 0.3, strength: 0.8 });
      // the dock: a lamp over its doorway inside, and the canopy's outside
      api.lamps.dockIn = L.wall(xi1, 3.6, D.z + D.w / 2 + 0.5, -1, 0, { out: 0.35, strength: 0.85, real: false });
      api.lamps.dock = L.wall(P.x1, D.h + 0.28, D.z, 1, 0, { out: 0.55, strength: 1.0 });
    }
    // the hall's Look: dark round its lamps, the paper's dust in the air;
    // its room (the presses' thunder: audio/sounds/watcher.js 'press')
    stage.addLook(new THREE.Box3(V3(xi0, -1, zi0), V3(xi1, P.h, zi1)), { ambient: 0.2, exposure: 1.08, rainOverlay: 0.0, haze: 0.45, room: 'press' });

    // ---- the motion ------------------------------------------------------------------------------
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
    api.update = (dt) => {
      api.running = api.running ?? true;
      if (!api.running) return;
      // the print runs along the web
      paperTex.offset.x -= PAPER_SPEED * dt / 0.6;
      // the gears (their teeth's speed is the paper's)
      const Gr = api.gears;
      Gr.a += dt * PAPER_SPEED / 0.62 * 0.35;
      Gr.list.forEach((g, i) => {
        _q.setFromAxisAngle(_z, Gr.a * g.dir);
        _m.compose(_p.set(g.x, g.y, g.z), _q, _s.setScalar(g.r));
        Gr.im.setMatrixAt(i, _m);
      });
      Gr.im.instanceMatrix.needsUpdate = true;
      // the bundles ride the conveyor south (off the folder's delivery, away under the south line)
      const B = api.bundles;
      B.s = (B.s + dt * 1.1) % 1.2;
      B.list.forEach((m, i) => {
        const z = B.za + 0.2 + ((B.s + i * 1.2) % (B.len + 0.6));
        m.visible = z < B.zb - 0.25;
        m.position.set(P.conveyor.x, P.conveyor.y + 0.02, z);
        m.rotation.y = (i * 0.37) % 0.3 - 0.15;
      });
    };
    api.update(0);
    void YARD; void AVENUE; void BALLEY; void lathe;
    K.flush();
    return api;
  },
  update(api, dt) { api.update(dt); },
};

// the edition's print on the web: rows of columns, headlines, pictures (dark
// on the paper's pale), tiling along u
function makePrintTexture() {
  const w = 256, h = 128;
  let c = null;
  try { c = typeof document !== 'undefined' ? document.createElement('canvas') : null; } catch (e) { c = null; }
  if (!c) { const t = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1); t.needsUpdate = true; return t; }
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
  let r = 7;
  const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  // a page every 256 px: a headline band, columns of text, a picture block
  g.fillStyle = '#2a2a2a';
  g.fillRect(8, 8, 110, 14);
  g.fillRect(138, 8, 108, 14);
  for (const x0 of [8, 46, 84, 138, 176, 214]) {
    for (let y = 30; y < h - 8; y += 5) if (rnd() > 0.08) g.fillRect(x0, y, 30 - rnd() * 6, 2);
  }
  g.fillStyle = '#4a4a4a';
  g.fillRect(84, 34, 32, 40);
  g.fillRect(176, 60, 30, 34);
  g.fillStyle = '#9a9a9a';
  g.fillRect(126, 0, 4, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
