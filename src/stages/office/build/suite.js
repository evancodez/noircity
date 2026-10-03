import * as THREE from 'three';
import { mergeGeos, slab, lathe, tubeAlong } from '../../../props/lib.js';
import { FLOOR, CEIL, T, OUTER, R305, R306, CORR, WC, LANDING, LIFT, BENCH, SEC, DOORS, CORR_LAMP, CORR_LAMP2 } from '../plan.js';

// [C5] The rest of the third floor (wave C): the outer office's furniture
// (the clients' bench, the secretary's desk with her typewriter and her
// chair), 305 next door under its dust sheets, the corridor's things (a
// radiator, the cleaner's cart, a fire bucket), the washroom (a basin under
// its mirror, a stall), the stair's landing (the flight down to a grille gate,
// locked) and the lift (its car on its cables, the scissor cage, the brass
// floor dial over it). Everything a round meets is cover of a kind
// (userData.cover); everything a man stands behind has its collider tag (the
// gun kit reads 'booth', 'bench', 'stand', 'crates', 'can' as cover).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = (l) => mergeGeos(l);

export function buildSuite(kit, mats, stage) {
  const C = stage.colliders;
  const out = { sections: [] };
  const piece = (geo, mat, cover, opts = {}) => {
    kit.piece();
    const m = kit.add(geo, mat, opts);
    if (cover) { m.userData.cover = { ...cover }; if (cover.hp != null) m.userData.cover.hp0 = cover.hp; out.sections.push(m); }
    return m;
  };

  // ---- the outer office ------------------------------------------------------------------
  // the clients' bench along the west wall (thin: a round goes through it)
  {
    const B = BENCH, L = B.z1 - B.z0;
    const g = [kit.box(B.x - B.d / 2, B.x + B.d / 2, B.h - 0.05, B.h, B.z0, B.z1), kit.box(OUTER.x0 + 0.01, OUTER.x0 + 0.06, B.h, B.h + 0.5, B.z0, B.z1)];
    for (const z of [B.z0 + 0.1, B.z1 - 0.1]) g.push(kit.box(B.x - B.d / 2 + 0.04, B.x + B.d / 2 - 0.04, FLOOR, B.h - 0.05, z - 0.04, z + 0.04));
    piece(M(g), mats.desk, { kind: 'thin' }, { name: 'bench' });
    C.addBox(B.x, (B.z0 + B.z1) / 2, B.d / 2, L / 2, 0, 'bench');
    // (a hat left on it: a client's, long gone)
    kit.piece();
    kit.add(hatGeo().translate(B.x + 0.02, B.h, B.z0 + 0.4), mats.coat, { name: 'bench_hat', noRay: true });
  }
  // the secretary's desk: its front toward the door (-x), her chair behind it; a typewriter, a lamp (off)
  {
    const S = SEC, x0 = S.x - S.d / 2, x1 = S.x + S.d / 2, z0 = S.z - S.w / 2, z1 = S.z + S.w / 2;
    piece(slab(S.d + 0.05, 0.045, S.w + 0.06, { bevel: 0.01, corner: 0.012 }).translate(S.x, S.h - 0.045, S.z), mats.desk, { kind: 'wood', hp: 9, name: 'secretary top' }, { name: 'sec_top' });
    piece(M([kit.box(x0 + 0.02, x1 - 0.02, 0.06, S.h - 0.05, z0, z0 + 0.42), kit.box(x0 + 0.02, x1 - 0.02, 0.06, S.h - 0.05, z1 - 0.42, z1)]), mats.desk, { kind: 'wood', hp: 12, name: 'secretary pedestal' }, { name: 'sec_ped' });
    piece(kit.box(x0, x0 + 0.025, 0.16, S.h - 0.05, z0 + 0.42, z1 - 0.42), mats.desk, { kind: 'thin' }, { name: 'sec_panel' });
    C.addBox(S.x, S.z, S.d / 2, S.w / 2, 0, 'booth');
    // the typewriter under its cover, an in-tray, the dead lamp
    kit.piece();
    const tw = [slab(0.36, 0.1, 0.32, { bevel: 0.03, corner: 0.05 }).translate(S.x + 0.04, S.h + 0.05, S.z - 0.15)];
    tw.push(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 12).rotateX(Math.PI / 2).translate(S.x - 0.08, S.h + 0.12, S.z - 0.15));
    kit.add(M(tw), mats.iron, { name: 'typewriter', noRay: true });
    kit.add(M([new THREE.BoxGeometry(0.28, 0.06, 0.22).translate(S.x + 0.05, S.h + 0.03, S.z + 0.42)]), mats.deskTop, { noRay: true });
    kit.add(lathe([[0.0001, 0], [0.07, 0], [0.065, 0.015], [0.012, 0.03], [0.01, 0.32], [0.09, 0.36], [0.11, 0.44], [0.0001, 0.46]], 18).translate(S.x + 0.2, S.h, S.z + 0.15), mats.shade, { noRay: true, name: 'sec_lamp' });
    out.typewriter = V(S.x + 0.04, S.h + 0.12, S.z - 0.15);
    out.secLamp = V(S.x + 0.2, S.h + 0.4, S.z + 0.15);
    // her chair, pushed back
    kit.piece();
    const ch = [slab(0.42, 0.06, 0.42, { bevel: 0.02, corner: 0.06 }).translate(0, 0.45, 0), slab(0.4, 0.3, 0.05, { bevel: 0.015, corner: 0.05 }).translate(0, 0.72, 0.2), new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8).translate(0, 0.25, 0)];
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.3; ch.push(new THREE.BoxGeometry(0.3, 0.025, 0.035).translate(0.15, 0.06, 0).rotateY(a)); }
    const c = kit.add(M(ch), mats.desk, { name: 'sec_chair' });
    c.rotation.y = -Math.PI / 2 + 0.4; c.position.set(x1 + 0.45, FLOOR, S.z + 0.1);
    C.addCircle(x1 + 0.45, S.z + 0.1, 0.27, 'chair');
  }

  // ---- 305: empty, the dust sheets over what was left ----------------------------------------
  // (lumps under pale cloth: a desk, a stack of chairs, a cabinet, a crate of files; each
  // a cover a man kneels behind: the sheet over wood is wood)
  {
    const lumps = [
      // [x, z, w (x), d (z), h, kind]
      [1.2, -2.6, 1.5, 0.8, 0.78, 'desk'], [3.6, -3.7, 0.5, 0.65, 1.3, 'cab'], [-1.6, -1.9, 0.9, 0.9, 0.9, 'chairs'], [-2.9, -3.9, 0.8, 0.8, 0.7, 'crate'], [4.3, -1.6, 1.0, 0.7, 0.75, 'desk2'],
    ];
    out.sheets = [];
    for (const [x, z, w, d, h, kind] of lumps) {
      // the thing under it (dark wood), the sheet over it draped to the floor: a box with soft folds
      const g = new THREE.BoxGeometry(w + 0.08, h, d + 0.08, 6, 3, 6);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
        const low = Math.max(0, -py / h + 0.5);          // 0 at the top, 1 at the hem
        const flare = 1 + 0.12 * low * low;
        p.setXYZ(i, px * flare + Math.sin(pz * 13 + px * 3) * 0.012 * low, py + (py > h / 2 - 1e-3 ? Math.sin(px * 9) * Math.sin(pz * 7) * 0.012 : 0), pz * flare + Math.sin(px * 11) * 0.012 * low);
      }
      g.computeVertexNormals();
      g.translate(x, FLOOR + h / 2, z);
      const m = piece(g, mats.sheet, { kind: kind === 'cab' ? 'steel' : 'wood', hp: kind === 'chairs' ? 6 : 10, section: false, name: 'sheet ' + kind }, { name: 'dust_' + kind });
      C.addBox(x, z, w / 2 + 0.04, d / 2 + 0.04, 0, kind === 'cab' ? 'stand' : 'crates');
      out.sheets.push({ mesh: m, at: V(x, FLOOR + h + 0.05, z), kind });
    }
    // a stepladder against the wall, a roll of lino, paint tins: a room between tenants
    kit.piece();
    const lad = [];
    for (const s of [-1, 1]) lad.push(new THREE.BoxGeometry(0.04, 1.8, 0.06).rotateX(0.18).translate(-3.55, 0.88, -0.5 + s * 0.22 * 0), new THREE.BoxGeometry(0.04, 1.8, 0.06).rotateX(-0.18).translate(-3.55 + s * 0.0, 0.88, -0.85));
    for (let k = 0; k < 5; k++) lad.push(new THREE.BoxGeometry(0.4, 0.025, 0.08).translate(-3.55, 0.3 + k * 0.33, -0.55 - 0.06 * (4 - k) * 0.25));
    kit.add(M(lad), mats.desk, { name: 'ladder', noRay: true });
    kit.add(M([new THREE.CylinderGeometry(0.1, 0.1, 1.8, 14).rotateZ(Math.PI / 2).translate(0.2, 0.1, -4.55), new THREE.CylinderGeometry(0.09, 0.09, 0.12, 14).translate(5.1, 0.06, -4.4), new THREE.CylinderGeometry(0.09, 0.09, 0.12, 14).translate(5.25, 0.06, -4.2)]), mats.iron, { name: 'tins', noRay: true });
    C.addBox(0.2, -4.55, 0.9, 0.1, 0, 'wall');
    C.addCircle(5.17, -4.3, 0.2, 'wall');
    // the boxed chimney breast round the back of Ames's safe
    piece(kit.box(2.35, 3.15, FLOOR, CEIL, R305.z1 - 0.42, R305.z1), mats.plaster, { kind: 'stone' }, { name: 'breast' });
    C.addBox(2.75, R305.z1 - 0.21, 0.4, 0.21, 0, 'column');
  }

  // ---- 306: an importer's office in the dark - his crates stacked, a desk, a cabinet ----------------
  {
    const crate = (x, z, sz, h, yaw, y0 = 0) => {
      const g = new THREE.BoxGeometry(sz, h, sz);
      const bat = [];
      for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) bat.push(new THREE.BoxGeometry(0.05, h + 0.01, 0.05).translate(sx * (sz / 2 - 0.02), 0, sz2 * (sz / 2 - 0.02)));
      const m = M([g, ...bat]).rotateY(yaw).translate(x, FLOOR + y0 + h / 2, z);
      piece(m, mats.desk, { kind: 'wood', hp: 6, name: 'crate' }, { name: 'crate306' });
      if (!y0) C.addBox(x, z, sz / 2, sz / 2, yaw, 'crates');
    };
    // (out of the door's sweep: it opens in, toward the crates)
    crate(-2.2, -6.65, 0.8, 0.8, 0.1); crate(-1.4, -6.65, 0.75, 0.75, -0.08); crate(-1.8, -6.65, 0.7, 0.6, 0.25, 0.8);
    piece(new THREE.BoxGeometry(0.7, 0.76, 0.8).translate(-1.55, FLOOR + 0.38, -5.45), mats.desk, { kind: 'wood', hp: 10, section: false, name: 'desk306' }, { name: 'desk306' });
    C.addBox(-1.55, -5.45, 0.35, 0.4, 0, 'booth');
    out.r306 = R306;
  }

  // ---- the corridor's things -------------------------------------------------------------------
  {
    // a radiator on the west wall between 301 and 302 (steel: it stops a round)
    // ([C5] after the critic: it stood across the corridor from the cart, between 302 and 303, and the two closed the
    // corridor in the men's grid - every man from the lift's end who came for me in the suite went round by 305 and
    // the connecting door, at my back. Up by the suite's door, the corridor is a way through again)
    const r = [];
    const x = CORR.x0 + 0.12, z0 = 1.85, z1 = 2.65;
    for (let k = 0; k < 10; k++) r.push(new THREE.CapsuleGeometry(0.035, 0.52, 4, 10).translate(x, 0.44, z0 + 0.04 + k * (z1 - z0 - 0.08) / 9));
    r.push(new THREE.BoxGeometry(0.06, 0.05, z1 - z0).translate(x, 0.12, (z0 + z1) / 2), new THREE.BoxGeometry(0.06, 0.05, z1 - z0).translate(x, 0.76, (z0 + z1) / 2));
    piece(M(r), mats.iron, { kind: 'steel' }, { name: 'corr_radiator' });
    C.addBox(x + 0.02, (z0 + z1) / 2, 0.1, (z1 - z0) / 2, 0, 'stand');
    out.radiator = V(x, 0.7, (z0 + z1) / 2);
    // the cleaner's cart: a steel frame, a pail, a mop, a sack (steel: it stops a round)
    // (north of 305's door, its long side along the wall: down behind it, the lift's end of the corridor is in front of me)
    const cx = CORR.x1 - 0.32, cz = -0.85;
    const cart = [new THREE.BoxGeometry(0.5, 0.03, 0.8).translate(cx, 0.75, cz), new THREE.BoxGeometry(0.5, 0.03, 0.8).translate(cx, 0.2, cz)];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cart.push(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 6).translate(cx + sx * 0.23, 0.45, cz + sz * 0.38), new THREE.SphereGeometry(0.04, 8, 6).translate(cx + sx * 0.23, 0.04, cz + sz * 0.38));
    cart.push(lathe([[0.0001, 0], [0.13, 0], [0.16, 0.28], [0.17, 0.3], [0.0001, 0.3]], 18).translate(cx, 0.22, cz + 0.18));
    piece(M(cart), mats.steelLight, { kind: 'steel' }, { name: 'cart' });
    kit.piece();
    kit.add(M([tubeAlong([V(cx - 0.1, 0.25, cz - 0.2), V(cx - 0.05, 1.5, cz - 0.25)], 0.015, 6, 2), lathe([[0.0001, 0], [0.14, 0], [0.12, 0.2], [0.03, 0.26], [0.0001, 0.26]], 12).translate(cx - 0.1, 0.0, cz - 0.2)]), mats.cloth, { name: 'mop', noRay: true });
    C.addBox(cx, cz, 0.27, 0.42, 0, 'crates');
    out.cart = V(cx, 0.8, cz);
    // a fire bucket on its hook by the stair door, red paint gone grey, sand in it
    const fb = [lathe([[0.0001, 0], [0.1, 0], [0.13, 0.26], [0.135, 0.27], [0.0001, 0.27]], 16).translate(CORR.x0 + 0.17, 1.05, -3.8), tubeAlong([V(CORR.x0 + 0.04, 1.33, -3.92), V(CORR.x0 + 0.17, 1.4, -3.8), V(CORR.x0 + 0.04, 1.33, -3.68)], 0.006, 5, 10)];
    kit.piece();
    kit.add(M(fb), mats.iron, { name: 'fire_bucket', noRay: true });
    out.bucket = V(CORR.x0 + 0.17, 1.2, -3.8);
    // the corridor's two globes (their lights are parts/room.js's)
    kit.piece();
    out.globes = [CORR_LAMP, CORR_LAMP2].map((L) => {
      const gm = kit.add(new THREE.SphereGeometry(0.13, 24, 16).scale(1, 0.85, 1).translate(L.x, CORR.ceil - 0.28, L.z), mats.bulb, { cast: false, noRay: true, name: 'corridor_globe' });
      kit.add(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8).translate(L.x, CORR.ceil - 0.09, L.z), mats.brass, { cast: false, noRay: true });
      return gm;
    });
  }

  // ---- the washroom ---------------------------------------------------------------------------
  {
    kit.piece();
    const b = [];
    // the basin on its pedestal under the mirror (east wall), a tap
    const bx = WC.x1 - 0.3, bz = WC.z0 + 1.1;
    b.push(lathe([[0.0001, 0], [0.12, 0], [0.1, 0.05], [0.07, 0.6], [0.24, 0.72], [0.26, 0.82], [0.2, 0.84], [0.0001, 0.76]], 22).scale(1, 1, 0.8).translate(bx, FLOOR, bz));
    b.push(tubeAlong([V(WC.x1 - 0.02, 0.95, bz), V(bx + 0.08, 0.96, bz), V(bx + 0.06, 0.9, bz)], 0.012, 6, 8));
    piece(M(b), mats.steelLight, { kind: 'steel' }, { name: 'basin' });
    C.addCircle(bx, bz, 0.26, 'wall');
    kit.piece();
    kit.add(new THREE.PlaneGeometry(0.5, 0.6).rotateY(-Math.PI / 2).translate(WC.x1 - 0.01, 1.5, bz), mats.glassDark, { cast: false, noRay: true, name: 'mirror' });
    out.tap = V(bx + 0.06, 0.95, bz);
    // the stall: two thin partitions and a half door, ajar; the cistern high on the wall
    const sx0 = WC.x0, sx1 = WC.x0 + 0.95, sz0 = WC.z1 - 1.3;
    piece(M([kit.box(sx1 - 0.03, sx1, FLOOR + 0.15, 2.0, sz0, WC.z1), kit.box(sx0, sx1 - 0.6, FLOOR + 0.15, 2.0, sz0 - 0.03, sz0)]), mats.door, { kind: 'thin' }, { name: 'stall' });
    C.addBox(sx1 - 0.015, (sz0 + WC.z1) / 2, 0.03, (WC.z1 - sz0) / 2, 0, 'wall');
    C.addBox((sx0 + sx1 - 0.6) / 2, sz0 - 0.015, (sx1 - 0.6 - sx0) / 2, 0.03, 0, 'wall');
    kit.piece();
    kit.add(M([lathe([[0.0001, 0], [0.16, 0], [0.18, 0.4], [0.19, 0.42], [0.0001, 0.42]], 18).scale(1, 1, 1.3).translate(sx0 + 0.45, FLOOR, WC.z1 - 0.4), new THREE.BoxGeometry(0.4, 0.22, 0.14).translate(sx0 + 0.45, 2.1, WC.z1 - 0.08)]), mats.steelLight, { noRay: true, name: 'wc_pan' });
    C.addCircle(sx0 + 0.45, WC.z1 - 0.4, 0.22, 'wall');
    // the pull chain of its bulb
    kit.add(M([new THREE.SphereGeometry(0.05, 12, 10).translate((WC.x0 + WC.x1) / 2, CEIL - 0.6, (WC.z0 + WC.z1) / 2), tubeAlong([V((WC.x0 + WC.x1) / 2 + 0.06, CEIL - 0.62, (WC.z0 + WC.z1) / 2), V((WC.x0 + WC.x1) / 2 + 0.06, 1.75, (WC.z0 + WC.z1) / 2)], 0.003, 4, 2)]), mats.iron, { noRay: true, cast: false, name: 'wc_bulb' });
    out.wcBulb = V((WC.x0 + WC.x1) / 2, CEIL - 0.6, (WC.z0 + WC.z1) / 2);
    out.wcChain = V((WC.x0 + WC.x1) / 2 + 0.06, 1.8, (WC.z0 + WC.z1) / 2);
  }

  // ---- the stair's landing: the flight down, a grille gate across its head (locked) -------------
  {
    const GT = DOORS.GATE, gx = GT.x;
    kit.piece();
    // the flight: 8 treads down to the west, from the landing (y 0) to y -1.36
    const st = [];
    const n = 8, run = (gx - LANDING.x0) / n, rise = 0.17;
    for (let i = 0; i < n; i++) {
      const x1 = gx - i * run, x0 = x1 - run, y = FLOOR - (i + 1) * rise;
      st.push(kit.box(x0, x1, y - 0.05, y, GT.z0, GT.z1));
      st.push(kit.box(x1 - 0.02, x1, y, y + rise, GT.z0, GT.z1));
    }
    kit.add(M(st), mats.stone, { name: 'flight' });
    // its walls (the well), the handrail
    const wl = [];
    wl.push(kit.box(LANDING.x0, gx, FLOOR - 2.2, CEIL, GT.z0 - T, GT.z0), kit.box(LANDING.x0, gx, FLOOR - 2.2, CEIL, GT.z1, GT.z1 + T));
    // (between the gate's posts and the landing's walls: full height)
    wl.push(kit.box(gx - T, gx, FLOOR, CEIL, LANDING.z0, GT.z0 - T), kit.box(gx - T, gx, FLOOR, CEIL, GT.z1 + T, LANDING.z1));
    // (the floor below the flight's foot: black, the dark of the floor beneath)
    wl.push(kit.box(LANDING.x0 - 0.5, LANDING.x0 + 0.6, FLOOR - 2.3, FLOOR - 1.4, GT.z0 - 0.2, GT.z1 + 0.2));
    const wm = kit.add(M(wl), mats.plasterDark, { name: 'stair_well' });
    wm.userData.cover = { kind: 'stone' };
    kit.add(kit.box(LANDING.x0 - 0.2, LANDING.x0, FLOOR - 2.3, CEIL, GT.z0 - 0.2, GT.z1 + 0.2), mats.black, { cast: false, name: 'stair_dark' });
    kit.add(tubeAlong([V(gx, 0.95, GT.z1 - 0.06), V(LANDING.x0, 0.95 - n * rise, GT.z1 - 0.06)], 0.02, 6, 2), mats.iron, { noRay: true });
    for (const [a, b] of [[GT.z0 - T, GT.z0], [GT.z1, GT.z1 + T]]) C.addBox((LANDING.x0 + gx) / 2, (a + b) / 2, (gx - LANDING.x0) / 2, (b - a) / 2 + 0.02, 0, 'wall');
    C.addBox(gx - T / 2, (LANDING.z0 + GT.z0 - T) / 2, T / 2, (GT.z0 - T - LANDING.z0) / 2, 0, 'wall');
    C.addBox(gx - T / 2, (GT.z1 + T + LANDING.z1) / 2, T / 2, (LANDING.z1 - GT.z1 - T) / 2, 0, 'wall');
    // a window on the landing's south wall: the light well's grey through wired glass
    kit.add(new THREE.PlaneGeometry(0.9, 1.1).translate(-6.6, 1.6, LANDING.z0 + 0.01), mats.litDim, { cast: false, noRay: true, name: 'landing_window' });
    // the floor of the flight: the men walk up and down it
    stage.addSurface((x, z) => (x < gx && x > LANDING.x0 - 0.2 && z > GT.z0 - 0.05 && z < GT.z1 + 0.05 ? FLOOR - Math.min(n, Math.ceil((gx - x) / run)) * rise : undefined));
    out.flightFoot = { x: LANDING.x0 + run * 0.5, z: (GT.z0 + GT.z1) / 2, y: FLOOR - n * rise };
  }

  // ---- the lift: the car on its cables, the cage, the floor dial --------------------------------
  {
    const cx = (LIFT.x0 + LIFT.x1) / 2, cz = (LIFT.z0 + LIFT.z1) / 2;
    // the shaft: black, a few cables
    kit.piece();
    kit.add(M([kit.box(LIFT.x0 - 0.15, LIFT.x1 + 0.15, -4, -3.9, LIFT.z0 - 0.15, CORR.z0 - T), kit.box(LIFT.x0 - 0.15, LIFT.x0 - 0.05, -4, CEIL + 1, LIFT.z0 - 0.15, CORR.z0 - T), kit.box(LIFT.x1 + 0.05, LIFT.x1 + 0.15, -4, CEIL + 1, LIFT.z0 - 0.15, CORR.z0 - T), kit.box(LIFT.x0 - 0.15, LIFT.x1 + 0.15, -4, CEIL + 1, LIFT.z0 - 0.15, LIFT.z0 - 0.05)]), mats.black, { cast: false, name: 'shaft' });
    // the car: a box of dark panelling with a bulb in its ceiling; its floor the men stand on
    kit.piece();
    const car = new THREE.Group();
    kit.g.add(car);
    const w = LIFT.x1 - LIFT.x0 - 0.02, d = LIFT.z1 - LIFT.z0 - 0.02;
    const cw = [new THREE.BoxGeometry(w, 0.05, d).translate(0, -0.025, 0), new THREE.BoxGeometry(w, 0.05, d).translate(0, 2.35, 0)];
    cw.push(new THREE.BoxGeometry(0.03, 2.35, d).translate(-w / 2 + 0.015, 1.17, 0), new THREE.BoxGeometry(0.03, 2.35, d).translate(w / 2 - 0.015, 1.17, 0), new THREE.BoxGeometry(w, 2.35, 0.03).translate(0, 1.17, -d / 2 + 0.015));
    // (a brass rail round it at the hip)
    cw.push(new THREE.BoxGeometry(w - 0.1, 0.03, 0.03).translate(0, 0.95, -d / 2 + 0.05));
    const carMesh = kit.add(M(cw), mats.wainscot, { parent: car, name: 'lift_car' });
    carMesh.userData.cover = { kind: 'steel' };
    const carBulb = kit.add(new THREE.SphereGeometry(0.05, 12, 8).translate(0, 2.28, 0), mats.bulb, { parent: car, cast: false, noRay: true });
    car.position.set(cx, FLOOR, cz);
    // the cage: a scissor gate in the corridor's south wall - its lattice folds to its east post
    kit.piece();
    const cage = new THREE.Group();
    cage.position.set(LIFT.x1, FLOOR, CORR.z0 - 0.04);
    kit.g.add(cage);
    const bars = [];
    const n = 9, gw = LIFT.x1 - LIFT.x0, hh = 2.2;
    for (let i = 0; i < n; i++) bars.push(new THREE.BoxGeometry(0.018, hh, 0.012).translate(-(i + 0.5) * gw / n, hh / 2, 0));
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
      const x0 = -(i + 0.5) * gw / n, x1 = -(i + 1.5) * gw / n;
      const y0 = 0.25 + k * 0.5, len = Math.hypot(x1 - x0, 0.5);
      for (const s of [1, -1]) bars.push(new THREE.BoxGeometry(len, 0.012, 0.008).rotateZ(s * Math.atan2(0.5, x0 - x1)).translate((x0 + x1) / 2, y0 + 0.25, -0.005));
    }
    const cageMesh = kit.add(M(bars), mats.iron, { parent: cage, name: 'lift_cage' });
    cageMesh.userData.cover = { kind: 'thin' };
    kit.add(new THREE.BoxGeometry(gw + 0.1, 0.05, 0.05).translate(cx, FLOOR + 2.22, CORR.z0 - 0.04), mats.iron, { noRay: true });
    // the floor dial: a brass half disc over the cage, G 1 2 3 4 5, a needle
    kit.piece();
    const dialTex = new THREE.CanvasTexture(dialCanvas());
    dialTex.colorSpace = THREE.SRGBColorSpace;
    const dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.7, 0.7), map: dialTex });
    dm.name = 'office_liftDial'; dm.userData.inkSurface = 'lit';
    kit.add(new THREE.CircleGeometry(0.2, 32, 0, Math.PI).translate(cx, 2.38, CORR.z0 + 0.012), dm, { cast: false, noRay: true, name: 'lift_dial' });
    const needle = new THREE.Group();
    needle.position.set(cx, 2.38, CORR.z0 + 0.02);
    kit.g.add(needle);
    kit.add(new THREE.BoxGeometry(0.012, 0.17, 0.008).translate(0, 0.085, 0), mats.iron, { parent: needle, cast: false, noRay: true });
    // the call button beside it
    kit.add(M([new THREE.BoxGeometry(0.08, 0.14, 0.02).translate(LIFT.x1 + 0.22, 1.25, CORR.z0 + 0.01), new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12).rotateX(Math.PI / 2).translate(LIFT.x1 + 0.22, 1.25, CORR.z0 + 0.025)]), mats.brass, { noRay: true, name: 'lift_button' });
    out.liftButton = V(LIFT.x1 + 0.22, 1.25, CORR.z0 + 0.03);
    // the cage's collider (it folds open: the box shrinks to its post)
    const col = C.addBox(cx, CORR.z0 - 0.04, gw / 2 + 0.05, 0.06, 0, 'wall');
    // the car's floor as a surface: the men in it ride it up
    const lift = { car, carBulb, cage, needle, col, y: 0, open: 0, floor: 3, cx, cz, gw };
    stage.addSurface((x, z) => (x > LIFT.x0 && x < LIFT.x1 && z > LIFT.z0 && z < CORR.z0 - T + 0.02 ? lift.y : undefined));
    // dial: the needle for a floor (G = 0 .. 5, across the half disc from the left)
    lift.dial = (f) => { needle.rotation.z = Math.PI / 2 - (f / 5) * Math.PI; };
    lift.setOpen = (k) => {
      lift.open = k;
      cage.scale.x = 1 - 0.86 * k;
      const half = (gw / 2 + 0.05) * (1 - 0.86 * k);
      col.cx = LIFT.x1 + 0.05 - half; col.hx = half;
      const G = stage.game;
      if (G && G.rays) G.rays.refresh(cageMesh);
    };
    lift.setY = (y) => { lift.y = y; car.position.y = FLOOR + y; car.updateMatrixWorld(true); const G = stage.game; if (G && G.rays) G.rays.refresh(carMesh); };
    lift.dial(3);
    out.lift = lift;
  }
  return out;
}

// a fedora (brim and crown) as one geometry, its crown up, at the origin
export function hatGeo() {
  const crown = lathe([[0.0001, 0.11], [0.06, 0.112], [0.085, 0.1], [0.095, 0.05], [0.1, 0.0], [0.0001, 0.0]], 18).scale(1, 1, 1.18);
  const brim = lathe([[0.1, 0.0], [0.16, -0.004], [0.175, 0.008], [0.168, 0.012], [0.1, 0.006]], 22).scale(1, 1, 1.12);
  const band = new THREE.CylinderGeometry(0.101, 0.103, 0.025, 18, 1, true).scale(1, 1, 1.18).translate(0, 0.016, 0);
  return mergeGeos([crown, brim, band]);
}

// the lift's floor dial: brass, G 1 2 3 4 5 round the half disc
function dialCanvas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#6a6458'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(128, 128, 118, Math.PI, 0); g.fill();
  g.fillStyle = '#d8d2c0'; g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['G', '1', '2', '3', '4', '5'].forEach((t, i) => { const a = Math.PI + (i / 5) * Math.PI; g.fillText(t, 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92 + 6); });
  return c;
}
