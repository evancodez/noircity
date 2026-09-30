import * as THREE from 'three';
import { PIER } from '../site.js';
import { makeKit, paint } from '../kit.js';
import { mergeGeos, lathe, slab } from '../../../props/lib.js';
import { accent } from '../../../render/accents.js';

// The shed's works (lane B6): the knife-switch panel on the X1 post (a caged
// bulb over it: it shows by its place in the light), the chain hoist over
// aisle C (its cord comes down to a cleat at X1, its load hangs at the far
// end of the aisle), and the crew's truck, half loaded by the big doors,
// that backs against the side door at the end.
//   api.panel { on, throw(on), lever, pos, bulbLamp }   api.hoist { up, drop(), reset(), loadPos, cleat }
//   api.truck { group, t, back(seconds), reset(), lights(on), headLamps, tailLamps }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function buildTruck(kit) {
  const { M } = kit;
  const T = new THREE.Group();
  // local frame: +x toward the nose, y up, the rear axle at the origin's west
  kit.piece();
  const body = [], dark = [], glass = [];
  // chassis rails and the running boards
  body.push(kit.box(-3.05, 2.9, 0.42, 0.62, -0.55, -0.35), kit.box(-3.05, 2.9, 0.42, 0.62, 0.35, 0.55));
  body.push(kit.box(0.35, 1.7, 0.5, 0.56, -1.08, -0.86), kit.box(0.35, 1.7, 0.5, 0.56, 0.86, 1.08));
  // the cab: a box with a rounded roof
  const cab = slab(1.3, 1.45, 1.9, { bevel: 0.1, corner: 0.14, seg: 3, curve: 6 });
  cab.translate(0.95, 0.95, 0);
  body.push(cab);
  // the hood: long, rounded, the grille at its nose
  const hood = slab(1.45, 0.78, 1.1, { bevel: 0.12, corner: 0.2, seg: 3, curve: 6 });
  hood.translate(2.3, 0.95, 0);
  body.push(hood);
  dark.push(kit.box(2.98, 3.06, 0.98, 1.66, -0.44, 0.44));
  // fenders: quarter tubes over the wheels
  for (const [x, w] of [[2.35, 0.34], [-2.0, 0.34]]) {
    for (const s of [-1, 1]) {
      const f = new THREE.CylinderGeometry(0.56, 0.56, w, 24, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2);
      f.rotateY(Math.PI / 2);
      f.translate(x, 0.5, s * (x > 0 ? 0.86 : 1.02));
      body.push(f);
    }
  }
  // the stake bed: its floor, the stakes and the side boards (the tailgate down)
  body.push(kit.box(-3.1, 0.25, 0.66, 0.78, -1.08, 1.08));
  for (let x = -3.0; x <= 0.2; x += 0.8) for (const s of [-1, 1]) body.push(kit.box(x - 0.04, x + 0.04, 0.78, 1.75, s * 1.05 - 0.04, s * 1.05 + 0.04));
  for (const y of [1.05, 1.45]) for (const s of [-1, 1]) body.push(kit.box(-3.05, 0.2, y, y + 0.14, s * 1.05 - 0.03, s * 1.05 + 0.03));
  body.push(kit.box(0.18, 0.28, 0.78, 1.75, -1.08, 1.08));
  const tg = kit.box(-3.55, -3.1, 0.62, 0.68, -1.0, 1.0);
  body.push(tg);
  // the cab's windows, dark
  glass.push(kit.box(0.28, 0.31, 1.62, 2.1, -0.75, 0.75), kit.box(1.58, 1.61, 1.62, 2.08, -0.8, 0.8));
  for (const s of [-1, 1]) glass.push(kit.box(0.5, 1.4, 1.62, 2.05, s * 0.95 - 0.01, s * 0.95 + 0.01));
  const bm = kit.add(mergeGeos(body), M.paint, { parent: T });
  bm.name = 'truckBody';
  kit.add(mergeGeos(dark), M.ironDark, { parent: T });
  kit.add(mergeGeos(glass), M.glassDark, { parent: T, cast: false });
  // wheels
  kit.piece();
  const wh = [];
  const tyre = lathe([[0.2, -0.13], [0.36, -0.14], [0.44, -0.11], [0.47, -0.05], [0.47, 0.05], [0.44, 0.11], [0.36, 0.14], [0.2, 0.13]], 28).rotateX(Math.PI / 2);
  for (const [x, z] of [[2.35, -0.86], [2.35, 0.86], [-2.0, -0.92], [-2.0, 0.92]]) wh.push(tyre.clone().translate(x, 0.47, z));
  kit.add(mergeGeos(wh), M.tyre, { parent: T });
  // its load: crates in the bed, half of it
  kit.piece();
  const load = [];
  for (const [x, z, h] of [[-0.6, -0.5, 0.9], [-0.6, 0.5, 0.9], [-0.6, 0.0, 1.8], [-1.6, -0.5, 0.9]]) {
    const c = slab(0.9, 0.86, 0.9, { bevel: 0.03, corner: 0.03, seg: 1, curve: 2 });
    c.deleteAttribute('uv');
    c.translate(x, 0.78 + h - 0.9, z);
    paint(c, 0.14);
    load.push(c);
  }
  kit.add(mergeGeos(load, { color: true }), M.crate, { parent: T });
  // lamps: two headlamps at the nose, the crew's red tail lamps at the rear
  kit.piece();
  const heads = [], tails = [];
  const headMat = M.glow('truckHead', 0.2);
  for (const s of [-1, 1]) {
    heads.push(lathe([[0.001, 0.0], [0.11, 0.0], [0.12, -0.05], [0.09, -0.12], [0.001, -0.13]], 18).rotateZ(Math.PI / 2).translate(3.05, 1.15, s * 0.62));
    tails.push(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14).rotateZ(Math.PI / 2).translate(-3.12, 0.95, s * 0.95));
  }
  const hm = kit.add(mergeGeos(heads), headMat, { parent: T, cast: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: accent('crew', { gain: 0.25 }) });
  tailMat.userData.accent = 'crew';
  const tm = kit.add(mergeGeos(tails), tailMat, { parent: T, cast: false });
  return { group: T, heads: hm, tails: tm, headMat, tailMat };
}

export default {
  name: 'works', order: 70, tick: 70,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'pier9_works';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const { M } = kit;
    const C = stage.colliders;

    // ---- the knife-switch panel on the post (built facing local +x, turned
    // to face where the site says)
    const P = PIER.panel;
    const pf = new THREE.Group();
    pf.position.set(P.x, 0, P.z);
    pf.rotation.y = P.yaw ?? 0;
    g.add(pf);
    pf.updateMatrixWorld(true);
    const W = (x, y, z) => pf.localToWorld(V(x, y, z));
    kit.piece();
    const pg = [];
    pg.push(kit.box(0, 0.09, P.y - 0.42, P.y + 0.42, -0.3, 0.3));
    pg.push(kit.box(0.09, 0.12, P.y - 0.3, P.y + 0.3, -0.2, 0.2));
    // the conduit up the post to the trusses
    pg.push(new THREE.CylinderGeometry(0.025, 0.025, PIER.trussY - P.y - 0.4, 8).translate(0.05, (PIER.trussY + P.y + 0.4) / 2, 0.22));
    const panelMesh = kit.add(mergeGeos(pg), M.paint, { parent: pf });
    panelMesh.name = 'switchPanel';
    // the lever: a copper blade (grey here) on a hinge, a black handle
    kit.piece();
    const lever = new THREE.Group();
    lever.position.set(0.16, P.y - 0.02, 0);
    pf.add(lever);
    kit.add(mergeGeos([kit.box(-0.012, 0.012, 0, 0.3, -0.05, -0.03), kit.box(-0.012, 0.012, 0, 0.3, 0.03, 0.05), kit.box(-0.012, 0.012, 0.27, 0.3, -0.05, 0.05)]), M.iron, { parent: lever });
    kit.add(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 12).rotateX(Math.PI / 2).translate(0.03, 0.3, 0), M.black, { parent: lever });
    lever.rotation.z = 0.35;
    // (a small caged bulb on a bracket just over the panel, aimed at its face:
    // the panel and the hand on it are lit, a man standing back from it is not)
    kit.piece();
    kit.add(mergeGeos([new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6).rotateZ(Math.PI / 2).translate(0.34 - 0.15, P.y + 1.05, 0),
      new THREE.CylinderGeometry(0.09, 0.07, 0.1, 14).translate(0.34, P.y + 1.03, 0)]), M.iron, { parent: pf, cast: false });
    const pBulb = kit.add(new THREE.SphereGeometry(0.05, 12, 8).translate(0.34, P.y + 0.95, 0), M.bulb, { parent: pf, cast: false, noRay: true });
    const cb = W(0.34, P.y + 0.95, 0);
    const ax = W(-0.55, -1, 0).sub(W(0, 0, 0));
    const bulbLamp = stage.lamps.addCustom({ head: cb.clone(), axis: ax, height: 2.2, half: 0.42, real: true, bulb: pBulb, fadeEnd: 0.7, edgeSoft: 0.55, strength: 0.5, tag: 'panel' });
    if (bulbLamp.light) { bulbLamp.light.intensity = 26; bulbLamp.light.distance = 4.5; bulbLamp.light.angle = 0.6; }
    const stand = W(0.78, 0, 0);
    const panel = {
      on: true, lever, pos: W(0.2, P.y, 0), bulbLamp, mesh: panelMesh, k: 1, drive: null,
      // where a man stands to work it, and his heading there (he faces it)
      stand, face: Math.atan2(P.x - stand.x, P.z - stand.z),
      throw(on) { panel.on = on; },
    };

    // ---- the hoist over aisle C
    const H = PIER.hoist;
    kit.piece();
    const hi = [];
    const beamY = 6.5;
    hi.push(kit.box(H.x - 0.1, H.x + 0.1, beamY - 0.26, beamY, H.z1 - 0.5, H.z0 + 0.3));
    hi.push(kit.box(H.x - 0.06, H.x + 0.06, beamY, PIER.trussY, H.z0, H.z0 + 0.12), kit.box(H.x - 0.06, H.x + 0.06, beamY, PIER.trussY, H.z1, H.z1 + 0.12));
    // the post the cord comes down to, and its cleat
    const cl = H.cleat;
    hi.push(kit.box(cl.x - 0.1, cl.x + 0.1, 0, beamY, cl.z - 0.1, cl.z + 0.1));
    hi.push(kit.box(cl.x - 0.1, H.x, beamY - 0.2, beamY - 0.05, cl.z - 0.06, cl.z + 0.06));
    hi.push(kit.box(cl.x + 0.1, cl.x + 0.16, 1.2, 1.26, cl.z - 0.1, cl.z + 0.1));
    C.addBox(cl.x, cl.z, 0.14, 0.14, 0, 'column');
    // the trolley and the chain block at the far end
    const L = H.load;
    hi.push(kit.box(L.x - 0.2, L.x + 0.2, beamY - 0.5, beamY - 0.26, L.z - 0.25, L.z + 0.25));
    hi.push(lathe([[0.001, 0.0], [0.16, 0.05], [0.2, 0.22], [0.16, 0.4], [0.001, 0.45]], 20).translate(L.x, beamY - 1.0, L.z));
    kit.addMerged(hi, M.iron, { cast: true });
    // the cord along the beam and down the post (it whips when let go)
    kit.piece();
    const cordPts = [V(cl.x + 0.14, 1.23, cl.z), V(cl.x + 0.12, beamY - 0.3, cl.z), V(H.x, beamY - 0.3, cl.z), V(H.x, beamY - 0.35, L.z + 0.3), V(L.x, beamY - 0.6, L.z)];
    const cord = kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts, false, 'catmullrom', 0.05), 80, 0.012, 5), M.rope, { cast: false, noRay: true });
    // the load: a big crate slung in chains under the block
    kit.piece();
    const loadG = new THREE.Group();
    loadG.position.set(L.x, L.y, L.z);
    g.add(loadG);
    const lc = slab(1.6, 1.15, 1.2, { bevel: 0.04, corner: 0.05, seg: 1, curve: 2 });
    lc.deleteAttribute('uv');
    lc.translate(0, -1.15 - 0.55, 0);
    paint(lc, 0.16);
    kit.add(lc, M.crate, { parent: loadG });
    const chains = [];
    for (const [sx, sz] of [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]]) {
      const a = V(0, 0, 0), b = V(sx, -0.55, sz), d = b.clone().sub(a);
      const cg = new THREE.CylinderGeometry(0.015, 0.015, d.length(), 6).translate(0, d.length() / 2, 0);
      cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()));
      chains.push(cg);
    }
    chains.push(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6).translate(0, 0.45, 0));
    kit.add(mergeGeos(chains), M.iron, { parent: loadG, cast: false });
    const hoist = {
      up: true, t: 0, load: loadG, cord, cleat: V(cl.x + 0.2, 1.25, cl.z), loadPos: V(L.x, 0.4, L.z), collider: null, colliders: C,
      drop() { if (!hoist.up) return; hoist.up = false; hoist.t = 0; hoist.falling = true; },
      reset() {
        hoist.up = true; hoist.falling = false; hoist.landed = false; hoist.t = 0;
        loadG.position.set(L.x, L.y, L.z); loadG.rotation.set(0, 0, 0); cord.visible = true;
        if (hoist.collider) { const i = C.boxes.indexOf(hoist.collider); if (i >= 0) C.boxes.splice(i, 1); hoist.collider = null; }
      },
      onLand: null,
    };

    // ---- the truck
    const tr = buildTruck(kit);
    g.add(tr.group);
    const TK = PIER.truck;
    const truckCol = C.addBox(TK.from.x, TK.from.z, 3.2, 1.1, 0, 'car');
    const truck = {
      ...tr, t: 0, dur: 0, moving: false, lit: false, collider: truckCol,
      place(k) {
        const x = TK.from.x + (TK.to.x - TK.from.x) * k;
        tr.group.position.set(x, 0, TK.from.z);
        truckCol.cx = x; truckCol.cz = TK.from.z;
      },
      back(seconds = 7) { truck.moving = true; truck.t = 0; truck.dur = seconds; truck.lights(true); },
      lights(on) {
        truck.lit = on;
        tr.headMat.color.setScalar(on ? 7 : 0.2);
        tr.tailMat.color.copy(accent('crew', { gain: on ? 5 : 0.25 }));
      },
      reset() { truck.moving = false; truck.t = 0; truck.place(0); truck.lights(false); },
    };
    truck.place(0);

    return { group: g, panel, hoist, truck };
  },
  update(api, dt) {
    // the lever swings to where the switch is thrown
    const P = api.panel;
    // (a hand on it: the scene drives it - P.drive, 1 up .. 0 thrown)
    if (P.drive != null) P.k = P.drive;
    else P.k += Math.sign((P.on ? 1 : 0) - P.k) * Math.min(Math.abs((P.on ? 1 : 0) - P.k), dt * 7);
    P.lever.rotation.z = 0.35 - (1 - P.k) * 2.4;
    // the load falls: 0.75 s, a bounce, it settles askew
    const H = api.hoist;
    if (H.falling) {
      H.t += dt;
      const L = PIER.hoist.load;
      const drop = Math.min(1, (H.t / 0.62) ** 2);
      H.load.position.y = L.y + (1.15 + 0.55 - L.y) * drop;
      H.cord.visible = false;
      if (drop >= 1 && !H.landed) {
        H.landed = true;
        H.load.rotation.set(0.12, 0.35, -0.08);
        H.load.position.y = 1.15 + 0.55 - 0.08;
        // (the broken load now stands in the aisle)
        H.collider = H.colliders.addBox(L.x, L.z, 0.85, 0.65, 0.35, 'crates');
        if (H.onLand) H.onLand(H.loadPos.clone());
      }
      if (H.t > 0.9) H.falling = false;
    }
    // the truck backs along the wall (eased: it starts and stops)
    const T = api.truck;
    if (T.moving) {
      T.t += dt;
      const u = Math.min(1, T.t / T.dur);
      T.place(u * u * (3 - 2 * u));
      if (u >= 1) T.moving = false;
    }
  },
};
