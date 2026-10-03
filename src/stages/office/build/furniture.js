import * as THREE from 'three';
import { mergeGeos, slab, lathe, tubeAlong } from '../../../props/lib.js';
import { makePad } from './pad.js';
import { FLOOR, CEIL, ROOM, OUTER, DESK, PAD, PENCIL, LAMP, CHAIR, CABS, CAB, COOLER, STAND, PICTURE, SAFE, FAN, TABLE, WIN, OUT_CABS, OPEN, DOORS } from '../plan.js';
import { hatGeo } from './suite.js';

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
  // DESK.x - d/2 - so the tip is a turn about z). [C5] wave C: wood to a
  // round in sections (the gun kit's cover: three boards of its top, the two
  // pedestals - each its own mesh, chewed to a gap), and six drawers that
  // really open: shut, they run out all the way on E and back in; one is
  // locked (his key opens it), one was pulled and emptied onto the floor.
  kit.piece();
  const D = DESK, fx = D.x - D.d / 2;
  const pivot = new THREE.Group();
  pivot.position.set(fx, FLOOR, D.z);
  kit.g.add(pivot);
  const body = new THREE.Group();
  body.position.set(D.d / 2, 0, 0);          // the desk's centre in the pivot's frame
  pivot.add(body);
  const pw = 0.44;
  const sections = [];
  const sec = (geo, mat, cover, name) => { kit.piece(); const m = kit.add(geo, mat, { parent: body, name }); m.userData.cover = { ...cover }; if (cover.hp != null) m.userData.cover.hp0 = cover.hp; sections.push(m); return m; };
  // the top: three boards across its width, a rounded edge, proud of the pedestals all round
  const nb = 3, bw = (D.w + 0.12) / nb;
  for (let i = 0; i < nb; i++) {
    const zc = -D.w / 2 - 0.06 + bw * (i + 0.5);
    sec(M([slab(D.d + 0.06, 0.05, bw - 0.004, { bevel: 0.012, corner: 0.012 }).translate(0, D.h - 0.05, zc), new THREE.BoxGeometry(D.d + 0.02, 0.03, bw - 0.03).translate(0, D.h - 0.08, zc)]),
      mats.desk, { kind: 'wood', hp: 11, name: 'desk top ' + i }, 'desk');
  }
  // two pedestals of drawers (thick: more to chew), each on its plinth and feet
  for (const s of [-1, 1]) {
    const zc = s * (D.w / 2 - pw / 2);
    const ped = [new THREE.BoxGeometry(D.d - 0.04, D.h - 0.14, pw).translate(0, (D.h - 0.14) / 2 + 0.07, zc)];
    ped.push(new THREE.BoxGeometry(D.d - 0.1, 0.06, pw - 0.06).translate(0, 0.04, zc));
    for (const fx2 of [-1, 1]) for (const fz of [-1, 1]) ped.push(new THREE.BoxGeometry(0.06, 0.03, 0.06).translate(fx2 * (D.d / 2 - 0.06), 0.015, zc + fz * (pw / 2 - 0.05)));
    sec(M(ped), mats.desk, { kind: 'wood', hp: 14, name: 'pedestal' }, 'desk_ped');
  }
  // the modesty panel on the front (thin: a round goes through it)
  sec(new THREE.BoxGeometry(0.025, D.h - 0.27, D.w - 2 * pw).translate(-D.d / 2 + 0.03, (D.h - 0.27) / 2 + 0.18, 0), mats.desk, { kind: 'thin' }, 'desk_panel');
  kit.piece();
  {
    const u = [];
    for (const s of [-1, 1]) {
      const zc = s * (D.w / 2 - pw / 2);
      u.push(new THREE.BoxGeometry(D.d - 0.14, 0.004, pw - 0.1).translate(0, 0.068, zc));
      for (const bx of [-0.18, 0.18]) u.push(new THREE.BoxGeometry(0.05, 0.012, pw - 0.1).translate(bx, 0.062, zc));
    }
    kit.add(M(u), mats.deskTop, { parent: body, cast: false, noRay: true, name: 'desk_under' });
  }
  // the drawers on the chair's side (+x): L (z-) and R (z+), top to bottom 1..3
  const drawers = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const id = (s < 0 ? 'L' : 'R') + (k + 1);
    const zc = s * (D.w / 2 - pw / 2), y = 0.12 + (2 - k) * 0.2;
    kit.piece();
    const g = new THREE.Group();
    g.position.set(D.d / 2, y, zc);
    body.add(g);
    const parts = [new THREE.BoxGeometry(0.02, 0.17, pw - 0.04).translate(0, 0.09, 0)];
    // (a brass bail pull: two posts and the bail)
    parts.push(new THREE.BoxGeometry(0.02, 0.012, 0.1).translate(0.022, 0.1, 0));
    for (const pz of [-0.045, 0.045]) parts.push(new THREE.BoxGeometry(0.018, 0.016, 0.012).translate(0.011, 0.104, pz));
    // (its box behind the front: sides, a back, a bottom)
    const bx = D.d - 0.12;
    parts.push(new THREE.BoxGeometry(bx, 0.11, 0.01).translate(-bx / 2, 0.065, -(pw - 0.1) / 2), new THREE.BoxGeometry(bx, 0.11, 0.01).translate(-bx / 2, 0.065, (pw - 0.1) / 2));
    parts.push(new THREE.BoxGeometry(0.01, 0.11, pw - 0.1).translate(-bx, 0.065, 0), new THREE.BoxGeometry(bx, 0.008, pw - 0.1).translate(-bx / 2, 0.012, 0));
    // (the lock's escutcheon on the top right one)
    if (id === 'R1') parts.push(new THREE.BoxGeometry(0.006, 0.03, 0.022).translate(0.012, 0.13, -0.12));
    kit.add(M(parts), mats.deskTop, { parent: g, noRay: true, name: 'drawer_' + id });
    drawers.push({ id, group: g, out: 0, target: 0, max: 0.36, y, z: zc, locked: id === 'R1', gone: id === 'L3' });
    // (the one they pulled out and emptied: its slot a black mouth in the pedestal)
    if (id === 'L3') { g.visible = false; kit.add(new THREE.BoxGeometry(0.012, 0.15, pw - 0.07).translate(D.d / 2 - 0.004, y + 0.09, zc), mats.black, { parent: body, cast: false, noRay: true, name: 'drawer_slot' }); }
  }
  const fixedKids = new Set(body.children);
  // the blotter, the pad's leather corners
  kit.piece();
  const top = D.h;
  kit.add(slab(0.5, 0.006, 0.78, { bevel: 0.002, corner: 0.01 }).translate(PAD.x - D.x + 0.02, top, PAD.z - D.z + 0.08), mats.leather, { parent: body, noRay: true });
  // the pad: its sheets (a block), its top sheet's canvas
  kit.piece();
  const pad = makePad();
  const padMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.95, map: pad.texture });
  padMat.name = 'office_pad';
  padMat.userData.inkSurface = 'plaster';
  const padBlock = kit.add(slab(PAD.d, 0.014, PAD.w, { bevel: 0.002, corner: 0.004 }).translate(PAD.x - D.x, top + 0.006, PAD.z - D.z), mats.paperDim, { parent: body, noRay: true });
  const sheetGeo = new THREE.PlaneGeometry(PAD.d - 0.004, PAD.w - 0.004).rotateX(-Math.PI / 2);
  {
    const p = sheetGeo.getAttribute('position'), uv = sheetGeo.getAttribute('uv');
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 - p.getZ(i) / (PAD.w - 0.004), 0.5 - p.getX(i) / (PAD.d - 0.004));
  }
  const sheet = kit.add(sheetGeo, padMat, { parent: body, cast: false, noRay: true, name: 'pad_sheet' });
  sheet.position.set(PAD.x - D.x, top + 0.0205, PAD.z - D.z);
  out.pad = { api: pad, mesh: sheet, block: padBlock, mat: padMat, centre: V(PAD.x, top + 0.021, PAD.z), w: PAD.w, d: PAD.d };
  out.pencilAt = V(PENCIL.x, top + 0.012, PENCIL.z);
  // the telephone: its base and cradle; the receiver off the hook, hanging over the desk's edge on its cord
  kit.piece();
  const PH = { x: 4.12, z: 3.12 };
  kit.add(M([lathe([[0.0001, 0], [0.06, 0], [0.058, 0.01], [0.035, 0.03], [0.02, 0.08], [0.018, 0.2], [0.03, 0.21], [0.0001, 0.212]], 20).translate(PH.x - D.x, top, PH.z - D.z),
    new THREE.BoxGeometry(0.012, 0.03, 0.09).translate(PH.x - D.x, top + 0.225, PH.z - D.z)]), mats.iron, { parent: body, noRay: true, name: 'phone' });
  kit.piece();
  const recv = new THREE.Group();
  body.add(recv);
  kit.add(M([new THREE.CylinderGeometry(0.014, 0.014, 0.17, 10).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.028, 0.022, 0.04, 14).translate(0, -0.02, -0.085), new THREE.CylinderGeometry(0.026, 0.02, 0.035, 14).translate(0, -0.018, 0.085)]), mats.iron, { parent: recv, noRay: true, name: 'receiver' });
  // (its cord: a curl from the base's foot down to where the receiver hangs; rebuilt when it is hung up)
  const cordMat = mats.iron;
  const cord = { mesh: null, set(on) {
    if (this.mesh) { this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); }
    const a = V(PH.x - D.x + 0.04, top + 0.02, PH.z - D.z);
    const pts = on ? [a, V(a.x + 0.12, top + 0.01, a.z - 0.02), V(D.d / 2 + 0.02, top - 0.02, a.z - 0.05), V(D.d / 2 + 0.05, top - 0.3, a.z - 0.08)]
      : [a, V(a.x + 0.06, top + 0.012, a.z + 0.03), V(a.x + 0.02, top + 0.012, a.z + 0.08), V(PH.x - D.x - 0.02, top + 0.2, PH.z - D.z + 0.08)];
    this.mesh = kit.add(tubeAlong(pts, 0.004, 5, 24), cordMat, { parent: body, cast: false, noRay: true });
  } };
  const phone = { recv, cord, PH, hung: false,
    // off the hook: hanging by its cord over the chair's edge of the desk, turning a little
    off() { this.hung = false; recv.position.set(D.d / 2 + 0.05, top - 0.36, PH.z - D.z - 0.08); recv.rotation.set(0.15, 0.4, 1.35); cord.set(true); },
    // on the hook: across its cradle
    on() { this.hung = true; recv.position.set(PH.x - D.x, top + 0.252, PH.z - D.z); recv.rotation.set(0, 0, 0); cord.set(false); },
  };
  phone.off();
  out.phone = phone;
  // the ashtray (the burnt corner of the top sheet in it) and a tray of letters knocked askew
  kit.piece();
  const AS = { x: 3.72, z: 4.42 };
  kit.add(M([lathe([[0.0001, 0], [0.06, 0], [0.066, 0.012], [0.058, 0.02], [0.045, 0.012], [0.0001, 0.012]], 20).translate(AS.x - D.x, top, AS.z - D.z)]), mats.iron, { parent: body, noRay: true, name: 'ashtray' });
  kit.add(M([new THREE.BoxGeometry(0.05, 0.002, 0.04).rotateY(0.6).translate(AS.x - D.x - 0.01, top + 0.016, AS.z - D.z + 0.005), new THREE.BoxGeometry(0.03, 0.002, 0.025).rotateY(-0.3).translate(AS.x - D.x + 0.015, top + 0.017, AS.z - D.z - 0.01)]), mats.black, { parent: body, cast: false, noRay: true, name: 'ash' });
  kit.add(new THREE.BoxGeometry(0.045, 0.0015, 0.035).rotateY(0.9).translate(AS.x - D.x + 0.004, top + 0.019, AS.z - D.z + 0.012), mats.paperDim, { parent: body, cast: false, noRay: true, name: 'burnt_corner' });
  out.ashtray = V(AS.x, top + 0.02, AS.z);
  // (the letter tray, knocked off the desk: on the floor at its front, its letters fanned out of it)
  kit.piece();
  kit.add(new THREE.BoxGeometry(0.3, 0.05, 0.24).rotateY(0.3).rotateZ(0.2).translate(D.x - D.d / 2 - 0.45, FLOOR + 0.04, 3.05), mats.deskTop, { noRay: true });
  kit.add(M([0, 1, 2, 3].map((k) => new THREE.BoxGeometry(0.28, 0.003, 0.21).rotateY(0.3 + k * 0.5).translate(D.x - D.d / 2 - 0.62 - k * 0.07, FLOOR + 0.004 + k * 0.002, 2.9 + k * 0.06))), mats.paperDim, { cast: false, noRay: true });
  out.desk = { pivot, body, tipped: 0, x: D.x, z: D.z, top, drawers, sections };
  out.desk.fixed = fixedKids;
  out.desk.collider = C.addBox(D.x, D.z, D.d / 2, D.w / 2, 0, 'booth');
  // the drawer they pulled and emptied: on the floor by the desk, upside down, its papers round it
  kit.piece();
  {
    const g = new THREE.Group();
    g.position.set(D.x + D.d / 2 + 0.55, FLOOR + 0.06, D.z - 0.75);
    g.rotation.set(Math.PI, 0.5, 0);
    kit.g.add(g);
    const bx = D.d - 0.12;
    kit.add(M([new THREE.BoxGeometry(0.02, 0.17, pw - 0.04).translate(0, 0.0, 0), new THREE.BoxGeometry(bx, 0.11, 0.01).translate(-bx / 2, 0, -(pw - 0.1) / 2), new THREE.BoxGeometry(bx, 0.11, 0.01).translate(-bx / 2, 0, (pw - 0.1) / 2), new THREE.BoxGeometry(0.01, 0.11, pw - 0.1).translate(-bx, 0, 0), new THREE.BoxGeometry(bx, 0.008, pw - 0.1).translate(-bx / 2, -0.05, 0)]), mats.deskTop, { parent: g, name: 'drawer_dumped' });
    out.dumped = g;
  }

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
  fixedKids.add(lampG);

  // ---- his chair, upright behind the desk (he died in it: the scene sits him there) -------------
  kit.piece();
  {
    const g = new THREE.Group();
    const ch = [];
    ch.push(slab(0.5, 0.07, 0.48, { bevel: 0.02, corner: 0.08 }).translate(0, 0.46, 0));
    ch.push(slab(0.48, 0.42, 0.06, { bevel: 0.015, corner: 0.06 }).translate(0, 0.74, -0.24).rotateX(-0.12));
    for (const s of [-1, 1]) ch.push(slab(0.05, 0.04, 0.4, { bevel: 0.01, corner: 0.02 }).translate(s * 0.25, 0.68, -0.02), new THREE.BoxGeometry(0.03, 0.2, 0.03).translate(s * 0.25, 0.57, 0.12));
    ch.push(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10).translate(0, 0.27, 0));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; ch.push(new THREE.BoxGeometry(0.34, 0.03, 0.04).translate(0.17, 0.08, 0).rotateY(a)); ch.push(new THREE.SphereGeometry(0.025, 8, 6).translate(Math.cos(a) * 0.33, 0.03, -Math.sin(a) * 0.33)); }
    const m = kit.add(M(ch), mats.desk, { parent: g, name: 'chair' });
    m.userData.cover = { kind: 'thin' };
    // (facing the desk: -x; a little turned toward the window, as a man turns to the telephone)
    g.position.set(CHAIR.x, FLOOR, CHAIR.z);
    g.rotation.y = -Math.PI / 2 + 0.25;
    kit.g.add(g);
    out.chairCol = C.addCircle(CHAIR.x, CHAIR.z, 0.32, 'chair');
    out.chair = g;
  }

  // ---- the filing cabinets: steel; the crew pulled some drawers all the way and left them ---------
  // (each drawer runs out all the way on E, or back in: shut, it is empty of what they wanted)
  out.cabinets = [];
  const cabinet = (x, z, face, i) => {
    kit.piece();
    const g = new THREE.Group();
    g.position.set(x, FLOOR, z);
    g.rotation.y = face;
    kit.g.add(g);
    const body = kit.add(slab(CAB.w, CAB.h, CAB.d, { bevel: 0.01, corner: 0.012 }), mats.steelLight, { parent: g, name: 'cabinet' });
    body.userData.cover = { kind: 'steel' };
    const drawers = [];
    for (let k = 0; k < 4; k++) {
      const y = 0.06 + k * 0.315;
      const out0 = (i * 3 + k) % 3 === 0 ? 0.42 : 0;
      kit.piece();
      const dg = new THREE.Group();
      dg.position.set(0, y, -CAB.d / 2 - out0);
      g.add(dg);
      const parts = [new THREE.BoxGeometry(CAB.w - 0.03, 0.29, 0.02).translate(0, 0.145, -0.01)];
      parts.push(new THREE.BoxGeometry(0.1, 0.02, 0.02).translate(0, 0.2, -0.03));
      parts.push(new THREE.BoxGeometry(0.06, 0.035, 0.004).translate(0, 0.24, -0.021));
      // its box (seen when it is out): sides and a bottom
      parts.push(new THREE.BoxGeometry(0.012, 0.22, 0.5).translate(-(CAB.w - 0.06) / 2, 0.12, 0.25));
      parts.push(new THREE.BoxGeometry(0.012, 0.22, 0.5).translate((CAB.w - 0.06) / 2, 0.12, 0.25));
      parts.push(new THREE.BoxGeometry(CAB.w - 0.06, 0.012, 0.5).translate(0, 0.02, 0.25));
      kit.add(M(parts), mats.steel, { parent: dg, noRay: true, name: 'cab_drawer' });
      drawers.push({ id: 'c' + i + k, group: dg, out: out0 / 0.42, target: out0 / 0.42, found: out0 / 0.42, max: 0.42, base: -CAB.d / 2, y, axis: 'z', sign: -1 });
    }
    C.addBox(x, z, Math.abs(Math.sin(face)) > 0.5 ? CAB.d / 2 : CAB.w / 2, Math.abs(Math.sin(face)) > 0.5 ? CAB.w / 2 : CAB.d / 2, 0, 'stand');
    const rec = { group: g, drawers, x, z, face };
    out.cabinets.push(rec);
    return rec;
  };
  for (let i = 0; i < CABS.length; i++) cabinet(CABS[i], ROOM.z1 - CAB.d / 2 - 0.02, 0, i);
  // (the outer office's: two by the north wall, two by the south wall - their fronts to the room)
  OUT_CABS.forEach(([x, z], j) => cabinet(x, z, z > 3 ? 0 : Math.PI, 3 + j));

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
    // [C5] his hat on the other hook (he never left)
    kit.add(hatGeo().rotateZ(0.5).translate(-0.17, 1.66, 0.02), mats.coat, { parent: g, name: 'his_hat', noRay: true });
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

  // ---- the picture over the safe: on a hinge, its frame a box that stands off the wall -----------
  // ([C5] the one picture they did not get to: the others are down, their
  // backs slit; this one stands a little out from the wall on its hinge side
  // - the shadow down its left edge - and swings open like a cupboard door)
  kit.piece();
  {
    const P = PICTURE;
    const DEP = 0.09;
    // the hinge: on the frame's left edge as I face it (its -x), out from the wall
    const nail = new THREE.Group();
    nail.position.set(P.x - P.w / 2, P.y, ROOM.z0 + 0.012);
    kit.g.add(nail);
    const hang = new THREE.Group();
    nail.add(hang);
    const frame = [];
    const fw = 0.05;
    // (a deep frame: a box round the print, its sides DEP deep)
    frame.push(new THREE.BoxGeometry(P.w, fw, DEP).translate(P.w / 2, P.h / 2 - fw / 2, DEP / 2));
    frame.push(new THREE.BoxGeometry(P.w, fw, DEP).translate(P.w / 2, -P.h / 2 + fw / 2, DEP / 2));
    frame.push(new THREE.BoxGeometry(fw, P.h, DEP).translate(fw / 2, 0, DEP / 2));
    frame.push(new THREE.BoxGeometry(fw, P.h, DEP).translate(P.w - fw / 2, 0, DEP / 2));
    // (its back board, and the two hinges' knuckles on the left)
    frame.push(new THREE.BoxGeometry(P.w - 0.02, P.h - 0.02, 0.006).translate(P.w / 2, 0, 0.066));
    for (const y of [-P.h / 2 + 0.07, P.h / 2 - 0.07]) frame.push(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8).translate(0, y, 0.004));
    kit.add(M(frame), mats.trim, { parent: hang, name: 'picture_frame' });
    const tex = new THREE.CanvasTexture(harbourPrint());
    tex.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: tex });
    pm.name = 'office_print'; pm.userData.inkSurface = 'plaster';
    const print = kit.add(new THREE.PlaneGeometry(P.w - 2 * fw, P.h - 2 * fw).translate(P.w / 2, 0, DEP - 0.008), pm, { parent: hang, cast: false, noRay: true });
    // (shut, it stands proud of the wall by a finger on its hinge side: a shadow down that edge)
    out.picture = { nail, hang, print, angle: 0.035, target: 0.035, vel: 0, shut: 0.035 };
    hang.rotation.y = -0.035;
  }
  // the pictures they did get to: down off their nails, face down, the paper backs slit;
  // pale where they hung (the wall's paper unfaded behind them), the nails still in it
  kit.piece();
  {
    const slit = [];
    const down = [[1.55, 0.55, 0.62, 0.5, 0.4], [4.55, 6.3, 0.52, 0.42, -0.7], [-2.4, 2.1, 0.5, 0.4, 1.1]];
    for (const [x, z, w, h, a] of down) {
      const g = [];
      g.push(new THREE.BoxGeometry(w, 0.03, 0.05).translate(0, 0.015, h / 2 - 0.025), new THREE.BoxGeometry(w, 0.03, 0.05).translate(0, 0.015, -h / 2 + 0.025));
      g.push(new THREE.BoxGeometry(0.05, 0.03, h).translate(w / 2 - 0.025, 0.015, 0), new THREE.BoxGeometry(0.05, 0.03, h).translate(-w / 2 + 0.025, 0.015, 0));
      g.push(new THREE.BoxGeometry(w - 0.06, 0.004, h - 0.06).translate(0, 0.031, 0));
      slit.push(M(g).rotateY(a).translate(x, FLOOR, z));
    }
    kit.add(M(slit), mats.trim, { name: 'pictures_down', noRay: true });
    // (the backs slit: a pale cross of torn paper on each)
    const tears = [];
    for (const [x, z, w, h, a] of down) for (const r of [0.6, -0.6]) tears.push(new THREE.BoxGeometry(w * 0.7, 0.002, 0.02).rotateY(r).rotateY(a).translate(x, FLOOR + 0.035, z));
    kit.add(M(tears), mats.paper, { cast: false, noRay: true });
    // the pale patches and the nails: on the east wall by the window, on the north wall, in the outer office
    const patch = [];
    patch.push(new THREE.PlaneGeometry(0.5, 0.42).rotateY(-Math.PI / 2).translate(ROOM.x1 - 0.004, 1.55, 6.15));
    patch.push(new THREE.PlaneGeometry(0.62, 0.5).translate(1.3, 1.62, ROOM.z0 + 0.004));
    patch.push(new THREE.PlaneGeometry(0.5, 0.4).rotateY(-Math.PI / 2).translate(OUTER.x1 - 0.004, 1.6, 1.4));
    kit.add(M(patch), mats.paperDim, { cast: false, noRay: true, name: 'patches' });
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
  // (round 2: an office turned over - drifts of it under the cabinets they
  // were pulled from, round the desk's pulled drawers, a trail to the door:
  // sheets, sheets folded once, envelopes, a few balled up, file folders
  // open on their spines. Ink shapes: pale where a light falls, grey in
  // the dark. Two merged meshes, the paper and the manila.)
  kit.piece();
  {
    const P = [], Q = [];
    // [x, z, radius, count]
    // ([C5] and the outer office's: the files they went through on their way in)
    const spots = [
      [1.0, 6.3, 0.75, 26], [0.55, 5.4, 0.45, 10], [1.8, 5.9, 0.6, 12],
      [5.05, 2.6, 0.4, 10], [4.95, 4.7, 0.4, 10],
      [3.1, 2.3, 0.7, 10], [2.2, 4.6, 0.6, 9], [1.5, 2.9, 0.5, 7],
      [2.8, 0.7, 0.45, 8], [1.7, 1.5, 0.5, 6], [4.2, 5.8, 0.5, 8],
      [-3.0, 6.0, 0.6, 14], [-2.6, 5.4, 0.4, 6], [-1.2, 1.2, 0.5, 9], [-2.2, 3.0, 0.5, 5],
    ];
    const sheet = (w, h) => new THREE.PlaneGeometry(w, h, 2, 2).rotateX(-Math.PI / 2);
    let n = 0;
    for (const [cx, cz, r, cnt] of spots) {
      for (let k = 0; k < cnt; k++, n++) {
        const a = hash(n, 1) * 6.28, d = Math.sqrt(hash(n, 2)) * r;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const inRoom = x > 0.15 && x < ROOM.x1 - 0.15, inOuter = x > OUTER.x0 + 0.15 && x < OUTER.x1 - 0.15;
        if ((!inRoom && !inOuter) || z < 0.15 || z > ROOM.z1 - 0.15) continue;
        // (not under the desk's feet, his chair, the doors' swings, the opening)
        if (Math.abs(x - DESK.x) < DESK.d / 2 + 0.05 && Math.abs(z - DESK.z) < DESK.w / 2 + 0.08) continue;
        if (Math.hypot(x - CHAIR.x, z - CHAIR.z) < 0.45) continue;
        if (x > DOORS.CONN.x0 - 0.2 && x < DOORS.CONN.x1 + 0.2 && z < 1.2) continue;
        if (x < OUTER.x0 + 1.2 && z > 2.6 && z < 4.2) continue;
        if (Math.abs(x) < 0.5 && z > OPEN.z0 - 0.2 && z < OPEN.z1 + 0.2) continue;
        const kind = hash(n, 7);
        const y0 = FLOOR + 0.002 + (k % 4) * 0.0012;
        let g, to = P;
        if (kind < 0.5) {
          // a sheet, a little cupped
          g = sheet(0.215, 0.28);
          const p = g.getAttribute('position');
          for (let i = 0; i < p.count; i++) p.setY(i, 0.005 * Math.abs(p.getX(i) / 0.1) * hash(n, 5) + 0.001);
        } else if (kind < 0.68) {
          // a sheet folded once: two leaves at an angle, the fold on the floor
          const h = 0.14, lift = 0.25 + hash(n, 9) * 0.5;
          const l1 = sheet(0.215, h).translate(0, 0, h / 2).rotateX(-lift * 0.5);
          const l2 = sheet(0.215, h).translate(0, 0, -h / 2).rotateX(lift * 0.5);
          g = M([l1, l2]).translate(0, 0.002, 0);
        } else if (kind < 0.8) {
          // an envelope
          g = sheet(0.235, 0.105); to = Q;
        } else if (kind < 0.9) {
          // a sheet balled up
          g = new THREE.IcosahedronGeometry(0.035 + hash(n, 4) * 0.015, 0).scale(1, 0.75, 1.1).translate(0, 0.028, 0);
        } else {
          // a file folder open on its spine, a sheet half out of it
          const lift = 0.15 + hash(n, 9) * 0.3;
          const c1 = sheet(0.24, 0.31).translate(0.12, 0, 0).rotateZ(lift);
          const c2 = sheet(0.24, 0.31).translate(-0.12, 0, 0);
          g = M([c1, c2]).translate(0, 0.002, 0); to = Q;
          P.push(sheet(0.215, 0.28).rotateY(0.3).translate(0.08, 0.004, 0.06).rotateY(hash(n, 3) * 6.28).translate(x, y0 + 0.002, z));
        }
        g.rotateY(hash(n, 3) * 6.28).translate(x, y0, z);
        to.push(g);
      }
    }
    kit.add(M(P), mats.paper, { cast: false, name: 'floor_papers', noRay: true });
    kit.add(M(Q), mats.paperDim, { cast: false, name: 'floor_folders', noRay: true });
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
  // ([C5] a clear one: a white wedge pointing down at the figure that is set)
  kit.add(new THREE.ConeGeometry(0.011, 0.022, 3).rotateZ(Math.PI).translate((w - 0.02) / 2 + 0.02, 0.05 + 0.074, FZ + 0.004), mats.lit, { parent: hinge, cast: false, noRay: true, name: 'dial_index' });
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
  // [C5] figures to read in the close view: every ten large, every five small, a tick for each number
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#141414'; g.fillRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  g.fillStyle = '#242424'; g.beginPath(); g.arc(cx, cy, 250, 0, 7); g.fill();
  g.strokeStyle = '#e4e4e4'; g.lineCap = 'butt';
  for (let i = 0; i < 100; i++) {
    // (a figure at the top reads 0; the numbers run clockwise as the dial is seen)
    const a = -Math.PI / 2 + (i / 100) * Math.PI * 2;
    const r0 = i % 10 === 0 ? 206 : i % 5 === 0 ? 218 : 230;
    g.lineWidth = i % 10 === 0 ? 7 : i % 5 === 0 ? 5 : 3;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * 248, cy + Math.sin(a) * 248); g.stroke();
    if (i % 5 === 0) {
      const big = i % 10 === 0;
      g.save(); g.translate(cx + Math.cos(a) * (big ? 166 : 178), cy + Math.sin(a) * (big ? 166 : 178)); g.rotate(a + Math.PI / 2);
      g.fillStyle = big ? '#f0f0f0' : '#bdbdbd'; g.font = `bold ${big ? 50 : 30}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
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
