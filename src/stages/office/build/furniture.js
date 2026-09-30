import * as THREE from 'three';
import { mergeGeos, slab, lathe, tubeAlong } from '../../../props/lib.js';
import { makePad } from './pad.js';
import { FLOOR, CEIL, ROOM, DESK, PAD, PENCIL, LAMP, CHAIR, CABS, CAB, COOLER, STAND, PICTURE, SAFE, FAN, TABLE, WIN } from '../plan.js';

// Room 304's furniture, turned over once already: the desk (its drawers
// out, the swivel chair on its side behind it), the banker's lamp on it,
// the pad and the pencil on the blotter, three filing cabinets with their
// drawers pulled, the water cooler, the coat stand, the radiator under the
// window, the adding machine's table, the framed harbour print hung crooked
// over the wall safe, the ceiling fan, paper over the floor.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = (l) => mergeGeos(l);
const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

export function buildFurniture(kit, mats, stage) {
  const C = stage.colliders;
  const out = {};

  // ---- the desk: a group that can go over on its front edge ------------------------------
  // (its frame: the pivot on the front bottom edge - the door's side, x
  // DESK.x - d/2 - so the tip is a turn about z)
  kit.piece();
  const D = DESK, fx = D.x - D.d / 2;
  const pivot = new THREE.Group();
  pivot.position.set(fx, FLOOR, D.z);
  kit.g.add(pivot);
  const body = new THREE.Group();
  body.position.set(D.d / 2, 0, 0);          // the desk's centre in the pivot's frame
  pivot.add(body);
  const dk = [];
  // the top: a thick slab with a rounded edge
  dk.push(slab(D.d + 0.04, 0.045, D.w + 0.04, { bevel: 0.012, corner: 0.02 }).translate(0, D.h - 0.045, 0));
  // two pedestals of drawers and the modesty panel on the front (-x)
  const pw = 0.44;
  for (const s of [-1, 1]) {
    const zc = s * (D.w / 2 - pw / 2);
    dk.push(new THREE.BoxGeometry(D.d - 0.04, D.h - 0.12, pw).translate(0, (D.h - 0.12) / 2 + 0.07, zc));
    // the plinth
    dk.push(new THREE.BoxGeometry(D.d - 0.08, 0.07, pw - 0.04).translate(0, 0.035, zc));
  }
  dk.push(new THREE.BoxGeometry(0.025, D.h - 0.25, D.w - 2 * pw).translate(-D.d / 2 + 0.03, (D.h - 0.25) / 2 + 0.18, 0));
  kit.add(M(dk), mats.desk, { parent: body, name: 'desk' });
  // the drawers' fronts on the chair's side (+x), most of them pulled out, papers spilling
  // (and the same drawers run home: when the desk goes over they stand
  // straight up and slide back in, so its back is a clean edge to shoot over)
  const drawersOf = (open) => {
    kit.piece();
    const dr = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const zc = s * (D.w / 2 - pw / 2), y = 0.12 + k * 0.2;
      const pulled = open && (k + (s > 0 ? 1 : 0)) % 2 === 0 ? 0.22 + 0.1 * hash(k, s) : 0;
      dr.push(new THREE.BoxGeometry(0.02, 0.17, pw - 0.04).translate(D.d / 2 + pulled, y + 0.09, zc));
      if (pulled > 0) {
        // (the drawer's box, out of the pedestal)
        dr.push(new THREE.BoxGeometry(pulled + 0.1, 0.12, pw - 0.08).translate(D.d / 2 + pulled / 2 - 0.05, y + 0.07, zc));
      }
      dr.push(new THREE.BoxGeometry(0.02, 0.012, 0.08).translate(D.d / 2 + pulled + 0.014, y + 0.1, zc));
    }
    return kit.add(M(dr), mats.deskTop, { parent: body });
  };
  const drawersOpen = drawersOf(true), drawersShut = drawersOf(false);
  drawersShut.visible = false;
  // the blotter, the pad's leather corners
  kit.piece();
  const top = D.h;
  kit.add(slab(0.5, 0.006, 0.78, { bevel: 0.002, corner: 0.01 }).translate(PAD.x - D.x + 0.02, top, PAD.z - D.z + 0.08), mats.leather, { parent: body });
  // the pad: its sheets (a block), its top sheet's canvas
  kit.piece();
  const pad = makePad();
  // (a little grey under the lamp's full pool: the graphite must stay dark where the paper prints white)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.95, map: pad.texture });
  padMat.name = 'office_pad';
  padMat.userData.inkSurface = 'plaster';
  const padBlock = kit.add(slab(PAD.d, 0.014, PAD.w, { bevel: 0.002, corner: 0.004 }).translate(PAD.x - D.x, top + 0.006, PAD.z - D.z), mats.paperDim, { parent: body });
  const sheetGeo = new THREE.PlaneGeometry(PAD.d - 0.004, PAD.w - 0.004).rotateX(-Math.PI / 2);
  // (uv: written for a man in the chair, facing -x: the sheet's right is
  // -z, its foot toward +x; canvas u = 0.5 - z / w, v (down) = 0.5 + x / d)
  {
    const p = sheetGeo.getAttribute('position'), uv = sheetGeo.getAttribute('uv');
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 - p.getZ(i) / (PAD.w - 0.004), 0.5 - p.getX(i) / (PAD.d - 0.004));
  }
  const sheet = kit.add(sheetGeo, padMat, { parent: body, cast: false, name: 'pad_sheet' });
  sheet.position.set(PAD.x - D.x, top + 0.0205, PAD.z - D.z);
  out.pad = { api: pad, mesh: sheet, block: padBlock, centre: V(PAD.x, top + 0.021, PAD.z), w: PAD.w, d: PAD.d };
  // the pencil lies beside it (a prop the hand takes: made by the scene)
  out.pencilAt = V(PENCIL.x, top + 0.012, PENCIL.z);
  // the telephone, an ashtray, a tray of letters knocked askew
  kit.piece();
  const ph = [];
  ph.push(lathe([[0.0001, 0], [0.06, 0], [0.058, 0.01], [0.035, 0.03], [0.02, 0.08], [0.018, 0.2], [0.03, 0.21], [0.0001, 0.212]], 20).translate(4.15 - D.x, top, 3.12 - D.z));
  ph.push(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 12).rotateX(Math.PI / 2).translate(4.15 - D.x, top + 0.23, 3.12 - D.z));
  ph.push(tubeAlong([V(4.15 - D.x, top + 0.24, 3.07 - D.z), V(4.16 - D.x, top + 0.26, 3.12 - D.z), V(4.15 - D.x, top + 0.24, 3.17 - D.z)], 0.012, 8, 12));
  kit.add(M(ph), mats.iron, { parent: body });
  kit.piece();
  kit.add(new THREE.BoxGeometry(0.3, 0.05, 0.24).rotateY(0.3).translate(4.2 - D.x, top + 0.025, 4.55 - D.z), mats.deskTop, { parent: body });
  kit.add(M([0, 1, 2, 3].map((k) => new THREE.BoxGeometry(0.28, 0.003, 0.21).rotateY(0.3 + k * 0.2).translate(4.2 - D.x - k * 0.02, top + 0.05 + k * 0.004, 4.55 - D.z + k * 0.03))), mats.paperDim, { parent: body, cast: false });
  out.desk = { pivot, body, tipped: 0, x: D.x, z: D.z, top, drawers: { open: drawersOpen, shut: drawersShut } };
  out.desk.collider = C.addBox(D.x, D.z, D.d / 2, D.w / 2, 0, 'booth');

  // ---- the banker's lamp: brass stand, the shade (green glass: a grey here), the chain ----
  kit.piece();
  const lampG = new THREE.Group();
  lampG.position.set(LAMP.x - D.x, top, LAMP.z - D.z);
  body.add(lampG);
  const base = lathe([[0.0001, 0], [0.075, 0], [0.078, 0.008], [0.06, 0.02], [0.02, 0.03], [0.012, 0.05], [0.011, 0.3], [0.016, 0.31], [0.0001, 0.315]], 24);
  const arm = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8).rotateX(Math.PI / 2).translate(0, 0.33, 0);
  kit.add(M([base, arm]), mats.brass, { parent: lampG });
  // the shade: a half-cylinder hood, its opening down, along z; tilted toward the pad
  const shadeG = new THREE.Group();
  shadeG.position.set(-0.02, 0.35, 0);
  shadeG.rotation.z = 0.22;
  lampG.add(shadeG);
  const hood = new THREE.CylinderGeometry(0.085, 0.085, 0.3, 24, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  const caps = [new THREE.CircleGeometry(0.085, 20, 0, Math.PI).translate(0, 0, 0.15), new THREE.CircleGeometry(0.085, 20, 0, Math.PI).rotateY(Math.PI).translate(0, 0, -0.15)];
  const shadeMesh = kit.add(M([hood, ...caps]), mats.shade, { parent: shadeG, name: 'lamp_shade' });
  const inner = kit.add(new THREE.CylinderGeometry(0.08, 0.08, 0.29, 24, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), mats.lampInner, { parent: shadeG, cast: false });
  const bulb = kit.add(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 10).rotateX(Math.PI / 2).translate(0, -0.03, 0), mats.bulb, { parent: shadeG, cast: false });
  kit.add(tubeAlong([V(0.03, -0.02, 0.1), V(0.035, -0.08, 0.1), V(0.03, -0.12, 0.1)], 0.0025, 5, 10), mats.brass, { parent: shadeG, cast: false });
  out.lamp = { group: lampG, shadeG, shadeMesh, inner, bulb, localHead: V(-0.03, 0.31, 0) };

  // ---- the swivel chair, on its side behind the desk -----------------------------------------
  kit.piece();
  {
    const g = new THREE.Group();
    const ch = [];
    ch.push(slab(0.46, 0.07, 0.46, { bevel: 0.02, corner: 0.08 }).translate(0, 0.46, 0));
    ch.push(slab(0.44, 0.34, 0.06, { bevel: 0.015, corner: 0.06 }).translate(0, 0.56, -0.22));
    ch.push(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10).translate(0, 0.27, 0));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; ch.push(new THREE.BoxGeometry(0.34, 0.03, 0.04).translate(0.17, 0.08, 0).rotateY(a)); ch.push(new THREE.SphereGeometry(0.025, 8, 6).translate(Math.cos(a) * 0.33, 0.03, -Math.sin(a) * 0.33)); }
    kit.add(M(ch), mats.desk, { parent: g, name: 'chair' });
    g.position.set(CHAIR.x, FLOOR + 0.23, CHAIR.z);
    g.rotation.set(0.1, 0.8, Math.PI / 2 - 0.08);
    kit.g.add(g);
    C.addCircle(CHAIR.x, CHAIR.z, 0.3, 'chair');
    out.chair = g;
  }

  // ---- the filing cabinets, their drawers pulled --------------------------------------------
  out.cabinets = [];
  for (let i = 0; i < CABS.length; i++) {
    kit.piece();
    const x = CABS[i], z = ROOM.z1 - CAB.d / 2 - 0.02;
    const g = new THREE.Group();
    g.position.set(x, FLOOR, z);
    kit.g.add(g);
    kit.add(slab(CAB.w, CAB.h, CAB.d, { bevel: 0.01, corner: 0.012 }), mats.steelLight, { parent: g, name: 'cabinet' });
    const drawers = [];
    for (let k = 0; k < 4; k++) {
      const y = 0.06 + k * 0.315;
      const out0 = (i * 3 + k) % 3 === 0 ? 0.28 + 0.12 * hash(i, k) : (i + k) % 4 === 1 ? 0.12 : 0;
      const dg = new THREE.Group();
      dg.position.set(0, y, -CAB.d / 2 - out0);
      g.add(dg);
      const parts = [new THREE.BoxGeometry(CAB.w - 0.03, 0.29, 0.02).translate(0, 0.145, -0.01)];
      parts.push(new THREE.BoxGeometry(0.1, 0.02, 0.02).translate(0, 0.2, -0.03));
      parts.push(new THREE.BoxGeometry(0.06, 0.035, 0.004).translate(0, 0.24, -0.021));
      if (out0 > 0) {
        parts.push(new THREE.BoxGeometry(0.012, 0.22, out0 + 0.05).translate(-(CAB.w - 0.06) / 2, 0.12, out0 / 2));
        parts.push(new THREE.BoxGeometry(0.012, 0.22, out0 + 0.05).translate((CAB.w - 0.06) / 2, 0.12, out0 / 2));
        parts.push(new THREE.BoxGeometry(CAB.w - 0.06, 0.012, out0 + 0.05).translate(0, 0.02, out0 / 2));
      }
      kit.add(M(parts), mats.steel, { parent: dg });
      if (out0 > 0.1) {
        // files standing in it, some pulled up and askew
        const f = [];
        for (let n = 0; n < 7; n++) f.push(new THREE.BoxGeometry(CAB.w - 0.1, 0.2 + hash(n, i + k) * 0.06, 0.004).rotateX((hash(n, k) - 0.5) * 0.5).translate(0, 0.13 + hash(n, 3) * 0.05, 0.03 + n * (out0 / 8)));
        kit.add(M(f), mats.paperDim, { parent: dg, cast: false });
      }
      drawers.push({ group: dg, out: out0, y });
    }
    C.addBox(x, z, CAB.w / 2, CAB.d / 2, 0, 'crates');
    const h = stage.breakables.add(g, { kind: 'cabinet', hp: 999 });
    out.cabinets.push({ group: g, drawers, handle: h, x, z });
  }

  // ---- the water cooler --------------------------------------------------------------------
  kit.piece();
  {
    const g = new THREE.Group();
    g.position.set(COOLER.x, FLOOR, COOLER.z);
    kit.g.add(g);
    kit.add(M([slab(0.34, 0.95, 0.34, { bevel: 0.015, corner: 0.03 }), new THREE.CylinderGeometry(0.1, 0.12, 0.05, 20).translate(0, 0.97, 0)]), mats.steelLight, { parent: g, name: 'cooler' });
    kit.add(new THREE.BoxGeometry(0.05, 0.03, 0.03).translate(0, 0.72, 0.18), mats.iron, { parent: g, cast: false });
    // the bottle: a big glass jug upside down, most of it water
    const jug = lathe([[0.0001, 0.0], [0.03, 0.0], [0.03, 0.06], [0.1, 0.1], [0.135, 0.16], [0.14, 0.36], [0.13, 0.42], [0.09, 0.46], [0.0001, 0.47]], 28).translate(0, 0.98, 0);
    const jm = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.08, transparent: true, opacity: 0.55, depthWrite: false });
    jm.name = 'office_jug'; jm.userData.inkSurface = 'metal';
    const bottle = kit.add(jug, jm, { parent: g, cast: false, name: 'cooler_jug' });
    C.addBox(COOLER.x, COOLER.z, 0.19, 0.19, 0, 'can');
    const h = stage.breakables.add(g, { kind: 'pipe', hp: 999, fluid: 'water' });
    out.cooler = { group: g, bottle, handle: h };
  }

  // ---- the coat stand (a coat and a hat left on it) ------------------------------------------
  kit.piece();
  {
    const g = new THREE.Group();
    g.position.set(STAND.x, FLOOR, STAND.z);
    kit.g.add(g);
    const st = [lathe([[0.0001, 0], [0.2, 0.0], [0.2, 0.02], [0.04, 0.05], [0.02, 0.08], [0.018, 1.75], [0.03, 1.78], [0.0001, 1.82]], 20)];
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.3; st.push(tubeAlong([V(0, 1.62, 0), V(Math.cos(a) * 0.12, 1.66, Math.sin(a) * 0.12), V(Math.cos(a) * 0.17, 1.74, Math.sin(a) * 0.17)], 0.01, 6, 10)); }
    kit.add(M(st), mats.trim, { parent: g, name: 'stand' });
    // a raincoat hung on it by the collar: a draped lathe, a little flattened
    kit.piece();
    const coat = lathe([[0.03, 1.7], [0.1, 1.64], [0.2, 1.52], [0.23, 1.3], [0.24, 1.0], [0.26, 0.7], [0.28, 0.52], [0.25, 0.5]], 22).scale(1, 1, 0.55).translate(0.1, 0, 0);
    kit.add(coat, mats.coat, { parent: g, name: 'coat' });
    C.addCircle(STAND.x, STAND.z, 0.22, 'stand');
    out.stand = g;
  }

  // ---- the radiator under the street window -------------------------------------------------
  kit.piece();
  {
    const r = [];
    const n = 16, x = ROOM.x1 - 0.14;
    for (let k = 0; k < n; k++) {
      const z = WIN.z0 + 0.14 + k * (WIN.z1 - WIN.z0 - 0.28) / (n - 1);
      r.push(new THREE.CapsuleGeometry(0.035, 0.52, 4, 10).translate(x, 0.44, z));
    }
    r.push(new THREE.BoxGeometry(0.06, 0.05, WIN.z1 - WIN.z0 - 0.2).translate(x, 0.12, (WIN.z0 + WIN.z1) / 2));
    r.push(new THREE.BoxGeometry(0.06, 0.05, WIN.z1 - WIN.z0 - 0.2).translate(x, 0.76, (WIN.z0 + WIN.z1) / 2));
    for (const z of [WIN.z0 + 0.14, WIN.z1 - 0.14]) r.push(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8).translate(x, 0.06, z));
    kit.add(M(r), mats.iron, { name: 'radiator' });
    C.addBox(x, (WIN.z0 + WIN.z1) / 2, 0.08, (WIN.z1 - WIN.z0) / 2 - 0.1, 0, 'wall');
  }

  // ---- the adding machine on its table -------------------------------------------------------
  kit.piece();
  {
    const t = [];
    t.push(slab(0.62, 0.03, 0.42, { bevel: 0.008, corner: 0.01 }).translate(TABLE.x, 0.68, TABLE.z));
    for (const [dx, dz] of [[-0.27, -0.17], [0.27, -0.17], [-0.27, 0.17], [0.27, 0.17]]) t.push(new THREE.BoxGeometry(0.035, 0.68, 0.035).translate(TABLE.x + dx, 0.34, TABLE.z + dz));
    kit.add(M(t), mats.desk);
    kit.piece();
    const m = [slab(0.3, 0.14, 0.34, { bevel: 0.02, corner: 0.03 }).translate(TABLE.x, 0.71, TABLE.z + 0.02)];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) m.push(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 8).translate(TABLE.x - 0.1 + c * 0.04, 0.86, TABLE.z + 0.1 - r * 0.045));
    m.push(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12).rotateZ(Math.PI / 2).translate(TABLE.x, 0.88, TABLE.z - 0.13));
    m.push(new THREE.BoxGeometry(0.03, 0.02, 0.12).translate(TABLE.x + 0.19, 0.84, TABLE.z));
    kit.add(M(m), mats.iron);
    // the tape out of it, down to the floor in a curl
    kit.add(tubeAlong([V(TABLE.x + 0.05, 0.9, TABLE.z - 0.13), V(TABLE.x + 0.05, 0.95, TABLE.z - 0.05), V(TABLE.x + 0.08, 0.78, TABLE.z + 0.28), V(TABLE.x + 0.12, 0.2, TABLE.z + 0.34), V(TABLE.x + 0.3, 0.01, TABLE.z + 0.55)], 0.01, 4, 40), mats.paper, { cast: false });
    C.addBox(TABLE.x, TABLE.z, 0.32, 0.22, 0, 'wall');
  }

  // ---- the picture over the safe, hung crooked on its wire -----------------------------------
  kit.piece();
  {
    const P = PICTURE;
    // the pivot: the nail above it (it swings aside on its wire)
    const nail = new THREE.Group();
    // (it stands off the wall over the safe's dial and handle behind it:
    // they must never show through the print)
    nail.position.set(P.x, P.y + P.h / 2 + 0.16, ROOM.z0 + 0.056);
    kit.g.add(nail);
    const hang = new THREE.Group();
    nail.add(hang);
    hang.rotation.z = P.tilt;
    const frame = [];
    const fw = 0.05;
    frame.push(new THREE.BoxGeometry(P.w, fw, 0.03).translate(0, -0.16 - fw / 2, 0.015));
    frame.push(new THREE.BoxGeometry(P.w, fw, 0.03).translate(0, -0.16 - P.h + fw / 2, 0.015));
    frame.push(new THREE.BoxGeometry(fw, P.h, 0.03).translate(-P.w / 2 + fw / 2, -0.16 - P.h / 2, 0.015));
    frame.push(new THREE.BoxGeometry(fw, P.h, 0.03).translate(P.w / 2 - fw / 2, -0.16 - P.h / 2, 0.015));
    kit.add(M(frame), mats.trim, { parent: hang, name: 'picture_frame' });
    // the print: a harbour at night (ships' masts against a pale sky)
    const tex = new THREE.CanvasTexture(harbourPrint());
    tex.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: tex });
    pm.name = 'office_print'; pm.userData.inkSurface = 'plaster';
    const print = kit.add(new THREE.PlaneGeometry(P.w - 2 * fw, P.h - 2 * fw).translate(0, -0.16 - P.h / 2, 0.012), pm, { parent: hang, cast: false });
    // the wire up to the nail
    kit.add(M([tubeAlong([V(-P.w / 2 + 0.08, -0.17, 0.004), V(0, 0, 0.004)], 0.0015, 4, 4), tubeAlong([V(P.w / 2 - 0.08, -0.17, 0.004), V(0, 0, 0.004)], 0.0015, 4, 4)]), mats.steel, { parent: hang, cast: false });
    kit.add(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6).rotateX(Math.PI / 2).translate(0, 0, 0.0), mats.brass, { parent: nail, cast: false });
    out.picture = { nail, hang, print, angle: P.tilt, target: P.tilt, vel: 0 };
    const h = stage.breakables.add(nail, { kind: 'sign', hp: 999, w: P.w, h: P.h });
    out.picture.handle = h;
  }

  // ---- the wall safe behind it --------------------------------------------------------------
  out.safe = buildSafe(kit, mats, stage);

  // ---- the ceiling fan ----------------------------------------------------------------------
  kit.piece();
  {
    const g = new THREE.Group();
    g.position.set(FAN.x, CEIL, FAN.z);
    kit.g.add(g);
    kit.add(M([lathe([[0.0001, -0.05], [0.03, -0.045], [0.07, -0.02], [0.075, 0], [0.0001, 0]], 24), new THREE.CylinderGeometry(0.012, 0.012, 0.38, 8).translate(0, -0.19, 0)]), mats.iron, { parent: g, cast: false });
    const rotor = new THREE.Group();
    rotor.position.y = -0.38;
    g.add(rotor);
    kit.add(lathe([[0.0001, -0.15], [0.05, -0.145], [0.1, -0.11], [0.11, -0.07], [0.1, -0.035], [0.06, -0.008], [0.0001, 0]], 28), mats.iron, { parent: rotor });
    const blades = [];
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Group();
      b.rotation.y = k * Math.PI / 2;
      rotor.add(b);
      const bm = kit.add(slab(0.56, 0.008, 0.13, { bevel: 0.003, corner: 0.04 }).translate(0.4, -0.09, 0).rotateX(0.2), mats.desk, { parent: b, name: 'fan_blade' });
      blades.push({ group: b, mesh: bm, bent: 0 });
    }
    out.fan = { group: g, rotor, blades, rpm: 38, bent: false };
  }

  // ---- paper over the floor -------------------------------------------------------------------
  kit.piece();
  {
    const P = [];
    const spots = [[1.2, 5.8, 1.1], [2.0, 5.2, 0.9], [4.6, 3.0, 0.8], [3.2, 2.4, 0.9], [1.4, 2.4, 0.7], [4.9, 5.4, 0.6], [2.6, 4.6, 0.8], [0.8, 6.2, 0.5]];
    let n = 0;
    for (const [cx, cz, r] of spots) {
      for (let k = 0; k < 7; k++, n++) {
        const a = hash(n, 1) * 6.28, d = hash(n, 2) * r;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (x < 0.2 || x > ROOM.x1 - 0.2 || z < 0.2 || z > ROOM.z1 - 0.2) continue;
        // (not under the desk's feet, nor in the door's swing)
        if (Math.abs(x - DESK.x) < DESK.d / 2 + 0.05 && Math.abs(z - DESK.z) < DESK.w / 2 + 0.05) continue;
        if (x < 1.1 && z < 1.6) continue;
        const g = new THREE.PlaneGeometry(0.215, 0.28, 2, 2).rotateX(-Math.PI / 2);
        const p = g.getAttribute('position');
        for (let i = 0; i < p.count; i++) p.setY(i, 0.004 * Math.abs(p.getX(i) / 0.1) * hash(n, 5) + 0.002);
        g.rotateY(hash(n, 3) * 6.28).translate(x, FLOOR + 0.002 + (k % 3) * 0.0015, z);
        P.push(g);
      }
    }
    kit.add(M(P), mats.paper, { cast: false, name: 'floor_papers', noRay: true });
  }
  return out;
}

// the wall safe: a steel box set in the south wall, its door on hinges on
// the left, the dial (0 .. 99) and the handle on it; inside, the ledger
function buildSafe(kit, mats, stage) {
  kit.piece();
  const S = SAFE, z = ROOM.z0;
  const g = new THREE.Group();
  kit.g.add(g);
  // the box: its walls back into the wall, a dark inside
  const b = [];
  const w = S.w, h = S.h, dz = S.depth;
  b.push(new THREE.BoxGeometry(w, 0.02, dz).translate(S.x, S.y - h / 2 + 0.01, z - dz / 2));
  b.push(new THREE.BoxGeometry(w, 0.02, dz).translate(S.x, S.y + h / 2 - 0.01, z - dz / 2));
  b.push(new THREE.BoxGeometry(0.02, h, dz).translate(S.x - w / 2 + 0.01, S.y, z - dz / 2));
  b.push(new THREE.BoxGeometry(0.02, h, dz).translate(S.x + w / 2 - 0.01, S.y, z - dz / 2));
  b.push(new THREE.BoxGeometry(w, h, 0.02).translate(S.x, S.y, z - dz + 0.01));
  kit.add(M(b), mats.iron, { name: 'safe_box' });
  // the door: hinged on its left edge (seen from the room: -x)
  kit.piece();
  const hinge = new THREE.Group();
  // (the door flush with the wall's face, as a wall safe's is: only the dial and the handle stand out of it)
  hinge.position.set(S.x - w / 2 + 0.01, S.y, z - 0.048);
  g.add(hinge);
  const dd = [slab(w - 0.02, 0.05, h - 0.02, { bevel: 0.006, corner: 0.01 }).rotateX(Math.PI / 2).translate((w - 0.02) / 2, (h - 0.02) / 2, -0.05 + 0.05)];
  // (the slab lies along -z..0 after the turn: its face at z 0.0; hinge knuckles)
  for (const y of [-0.13, 0.13]) dd.push(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10).translate(-0.004, y, 0.004));
  const door = kit.add(M(dd), mats.steel, { parent: hinge, name: 'safe_door' });
  door.position.set(0, -(h - 0.02) / 2, 0);
  // the dial: a ring of numbers round a fluted knob, turning about the door's normal
  kit.piece();
  const dialG = new THREE.Group();
  // (the door's face is 5 cm out from its hinge line: the dial, the handle, the plate stand on it)
  const FZ = 0.052;
  dialG.position.set((w - 0.02) / 2 + 0.02, 0.05, FZ);
  hinge.add(dialG);
  const dtex = new THREE.CanvasTexture(dialFace());
  dtex.colorSpace = THREE.SRGBColorSpace;
  dtex.anisotropy = 8;
  // (the figures white on the dark face, readable in any light: a lit print)
  const dm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.75, 0.75), map: dtex });
  dm.name = 'office_dial'; dm.userData.inkSurface = 'lit';
  const face = kit.add(new THREE.CylinderGeometry(0.058, 0.062, 0.012, 48).rotateX(Math.PI / 2).translate(0, 0, 0.006), dm, { parent: dialG, name: 'dial_face' });
  // (the face's top cap takes the texture: the cylinder's cap uv is a disc)
  const knob = [];
  const fl = 24;
  for (let k = 0; k < fl; k++) { const a = (k / fl) * Math.PI * 2; knob.push(new THREE.BoxGeometry(0.006, 0.006, 0.026).translate(Math.cos(a) * 0.026, Math.sin(a) * 0.026, 0.025)); }
  knob.push(new THREE.CylinderGeometry(0.026, 0.028, 0.028, 32).rotateX(Math.PI / 2).translate(0, 0, 0.026));
  knob.push(new THREE.CylinderGeometry(0.018, 0.024, 0.006, 24).rotateX(Math.PI / 2).translate(0, 0, 0.043));
  kit.add(M(knob), mats.iron, { parent: dialG, name: 'dial_knob' });
  // the index mark over the dial (on the door, fixed)
  kit.add(new THREE.BoxGeometry(0.006, 0.014, 0.006).translate((w - 0.02) / 2 + 0.02, 0.05 + 0.068, FZ + 0.003), mats.steelLight, { parent: hinge, cast: false });
  // the handle: a spoked T below the dial
  kit.piece();
  const handleG = new THREE.Group();
  handleG.position.set((w - 0.02) / 2 + 0.02, -0.09, FZ);
  hinge.add(handleG);
  kit.add(M([new THREE.CylinderGeometry(0.012, 0.012, 0.04, 10).rotateX(Math.PI / 2).translate(0, 0, 0.02), new THREE.CylinderGeometry(0.009, 0.009, 0.14, 10).rotateZ(Math.PI / 2).translate(0, 0, 0.042), ...[-0.07, 0.07].map((x) => new THREE.SphereGeometry(0.014, 10, 8).translate(x, 0, 0.042))]), mats.brass, { parent: handleG, name: 'safe_handle' });
  // a nameplate
  kit.add(new THREE.BoxGeometry(0.12, 0.022, 0.003).translate((w - 0.02) / 2 + 0.02, 0.16, FZ + 0.0015), mats.brass, { parent: hinge, cast: false });
  return { group: g, hinge, door, dialG, handleG, face, angle: 0, open: 0, dial: 0, handle: 0, centre: new THREE.Vector3(S.x + 0.02, S.y + 0.05, z + 0.004 + 0.03), inside: new THREE.Vector3(S.x, S.y - h / 2 + 0.02, z - dz / 2) };
}

// the dial's face: 100 ticks, a figure every ten, on dark steel
function dialFace() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 256, 256);
  const cx = 128, cy = 128;
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(cx, cy, 124, 0, 7); g.fill();
  g.strokeStyle = '#d8d8d8'; g.lineCap = 'butt';
  for (let i = 0; i < 100; i++) {
    // (a figure at the top reads 0; the numbers run clockwise as the dial is seen)
    const a = -Math.PI / 2 + (i / 100) * Math.PI * 2;
    const r0 = i % 10 === 0 ? 96 : i % 5 === 0 ? 104 : 110;
    g.lineWidth = i % 10 === 0 ? 3.5 : 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * 122, cy + Math.sin(a) * 122); g.stroke();
    if (i % 10 === 0) {
      g.save(); g.translate(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80); g.rotate(a + Math.PI / 2);
      g.fillStyle = '#e0e0e0'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i), 0, 0); g.restore();
    }
  }
  return c;
}

// the harbour print: masts and a moon over black water
function harbourPrint() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 200;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, '#8a8a86'); sky.addColorStop(1, '#c8c6be');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 200);
  g.fillStyle = '#e8e6de'; g.beginPath(); g.arc(186, 42, 16, 0, 7); g.fill();
  g.fillStyle = '#141414'; g.fillRect(0, 128, 256, 72);
  g.fillStyle = '#1c1c1c';
  g.beginPath(); g.moveTo(20, 128); g.lineTo(40, 112); g.lineTo(150, 112); g.lineTo(170, 128); g.fill();
  g.strokeStyle = '#161616'; g.lineWidth = 3;
  for (const [x, h] of [[60, 70], [100, 86], [130, 60]]) { g.beginPath(); g.moveTo(x, 112); g.lineTo(x, 112 - h); g.stroke(); g.beginPath(); g.moveTo(x - 18, 112 - h * 0.6); g.lineTo(x + 18, 112 - h * 0.6); g.stroke(); }
  g.lineWidth = 1;
  for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(40 + k * 22, 112); g.lineTo(100, 26); g.stroke(); }
  g.fillStyle = '#9a9890';
  for (let k = 0; k < 14; k++) g.fillRect(170 + (k % 3) * 6 - 4, 136 + k * 4, 18 - (k % 4) * 3, 1.5);
  return c;
}
