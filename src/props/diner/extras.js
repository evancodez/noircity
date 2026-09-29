import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { LAYER } from '../../render/layers.js';
import { slab, lathe, mergeGeos, uvRect, tubeAlong, roundRectShape, hash, AT, PM, V3 } from '../lib.js';

// The room's corners (lane 5's brief P2): the rest room door on the end wall
// with a lit gap under it, a pay phone on the wall by the jukebox, a
// cigarette machine at the far end.
const D = DINER, F = D.floorY;

export function buildExtras(kit) {
  const { M } = kit;
  const out = {};
  // ---- the rest room door: a dark leaf in a frame, a small sign, the
  // light of the room behind it leaking under the door onto the floor
  kit.piece();
  const dx = -15.75, dz = D.zMin, w = 0.82, h = 2.05;
  const frame = [
    kit.box(dx - w / 2 - 0.07, dx - w / 2, F, F + h + 0.07, dz, dz + 0.05),
    kit.box(dx + w / 2, dx + w / 2 + 0.07, F, F + h + 0.07, dz, dz + 0.05),
    kit.box(dx - w / 2 - 0.07, dx + w / 2 + 0.07, F + h, F + h + 0.07, dz, dz + 0.05),
  ];
  kit.addMerged(frame, M.rail, { cast: false });
  const leaf = slab(w - 0.01, 0.04, h - 0.012, { bevel: 0.006, corner: 0.01 }).rotateX(Math.PI / 2).translate(dx, F + h / 2 + 0.006, dz + 0.004);
  // (two sunk panels on the leaf)
  const pan = [];
  for (const [y0, y1] of [[0.18, 0.9], [1.05, 1.85]]) pan.push(kit.box(dx - w / 2 + 0.1, dx + w / 2 - 0.1, F + y0, F + y1, dz + 0.043, dz + 0.047));
  kit.add(leaf, M.std('rrDoor', 0x0c0c0c, 0.5, 'wood'), { cast: false });
  kit.addMerged(pan, M.std('rrPanel', 0x151515, 0.45, 'wood'), { cast: false });
  kit.add(new THREE.SphereGeometry(0.028, 14, 10).translate(dx + w / 2 - 0.09, F + 1.0, dz + 0.07), PM().chrome, { cast: false });
  const sign = new THREE.PlaneGeometry(0.34, 0.085).translate(dx, F + 1.75, dz + 0.049);
  uvRect(sign, AT.sign);
  kit.add(sign, M.std('rrSign', 0xffffff, 0.8, 'enamel', { map: PM().atlas.map }), { cast: false });
  // the gap under the door: a bright slit and its spill on the floor
  kit.add(new THREE.PlaneGeometry(w - 0.04, 0.012).translate(dx, F + 0.007, dz + 0.001), M.glow('rrGap', 2.2), { cast: false, receive: false });
  const sc = document.createElement('canvas'); sc.width = 64; sc.height = 32;
  const sg = sc.getContext('2d');
  const gr = sg.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000');
  sg.fillStyle = gr; sg.fillRect(0, 0, 64, 32);
  const im = sg.getImageData(0, 0, 64, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) { const f = Math.min(1, Math.min(x, 63 - x) / 14); const i = (y * 64 + x) * 4; for (let c = 0; c < 3; c++) im.data[i + c] *= f; }
  sg.putImageData(im, 0, 0);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.25, 0.55).rotateX(-Math.PI / 2).translate(dx, F + 0.005, dz + 0.28),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.045, 0.045, 0.045), map: st, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spill.layers.set(LAYER.FX); spill.userData.noRay = true;
  kit.g.add(spill);
  out.restRoom = { pos: V3(dx, F, dz + 0.5) };

  // ---- the pay phone on the wall by the jukebox: a black box, the
  // handset on its hook, the dial, a coin return, a shelf and a directory
  // hanging on a chain
  kit.piece();
  const px = -14.35, py = F + 1.42, pz = dz + 0.02;
  const body = slab(0.2, 0.34, 0.14, { bevel: 0.02, corner: 0.03 }).translate(px, py, pz + 0.07);
  const top = slab(0.17, 0.08, 0.1, { bevel: 0.02, corner: 0.03 }).translate(px, py + 0.33, pz + 0.05);
  kit.add(mergeGeos([body, top]), M.std('phone', 0x080808, 0.3, 'metal'), { cast: false });
  const dial = lathe([[0.0001, 0], [0.045, 0], [0.047, 0.006], [0.043, 0.01], [0.012, 0.012], [0.0001, 0.012]], 32).rotateX(Math.PI / 2).translate(px, py + 0.2, pz + 0.14);
  const holes = [];
  for (let k = 0; k < 10; k++) { const a = -0.6 + (k / 10) * 5.2; holes.push(new THREE.CircleGeometry(0.0065, 10).translate(px + Math.cos(a) * 0.031, py + 0.2 + Math.sin(a) * 0.031, pz + 0.1525)); }
  kit.add(dial, PM().chrome, { cast: false });
  kit.add(mergeGeos(holes), M.std('dialHole', 0x2a2a2a, 0.5, 'enamel'), { cast: false });
  // the handset hanging on the hook at the box's left side
  const hs = [tubeAlong([V3(px - 0.13, py + 0.3, pz + 0.07), V3(px - 0.135, py + 0.22, pz + 0.075), V3(px - 0.13, py + 0.12, pz + 0.07)], 0.018, 10, 30),
    new THREE.SphereGeometry(0.032, 16, 10).scale(1, 0.8, 1).translate(px - 0.13, py + 0.32, pz + 0.075),
    new THREE.SphereGeometry(0.03, 16, 10).scale(1, 0.8, 1).translate(px - 0.13, py + 0.1, pz + 0.075)];
  kit.add(mergeGeos(hs), M.black, { cast: false });
  const cordPts = [];
  for (let k = 0; k <= 30; k++) { const t = k / 30; cordPts.push(V3(px - 0.13 + 0.07 * t + Math.sin(t * 40) * 0.006, py + 0.08 - 0.12 * Math.sin(t * Math.PI), pz + 0.07 + Math.cos(t * 40) * 0.006)); }
  kit.add(tubeAlong(cordPts, 0.004, 5, 120), M.black, { cast: false });
  kit.add(kit.box(px - 0.2, px + 0.2, py - 0.25, py - 0.23, pz, pz + 0.24), M.rail, { cast: false });
  const book = slab(0.16, 0.035, 0.22, { bevel: 0.004, corner: 0.006 }).rotateX(-1.35).translate(px + 0.1, py - 0.52, pz + 0.05);
  kit.add(book, M.std('dir', 0x1a1a1a, 0.9, 'cloth'), { cast: false });
  out.phone = { pos: V3(px, py, pz + 0.3) };

  // ---- the cigarette machine at the far end by the aisle: a tall cabinet,
  // a row of little windows with packs lit behind them, a row of pull knobs
  kit.piece();
  const mx = -13.75, mz = D.zMax, mw = 0.62, md = 0.42, mh = 1.52;
  const cab = slab(mw, mh, md, { bevel: 0.02, corner: 0.03 }).translate(mx, F, mz - md / 2 - 0.01);
  kit.add(cab, M.std('cigMachine', 0x0d0d0d, 0.35, 'enamel'), { cast: false });
  const front = mz - md - 0.012;
  const wins = [], knobs = [], packs = [];
  for (let k = 0; k < 5; k++) {
    const x = mx - mw / 2 + 0.08 + k * (mw - 0.16) / 4;
    wins.push(new THREE.ShapeGeometry(roundRectShape(0.085, 0.14, 0.012), 4).rotateY(Math.PI).translate(x, F + 1.02, front));
    // (a pack standing in each window, printed dark on the lit well)
    packs.push(new THREE.PlaneGeometry(0.045, 0.07).rotateY(Math.PI).translate(x + (hash(k, 81) - 0.5) * 0.01, F + 1.0, front - 0.004));
    knobs.push(lathe([[0.0001, 0], [0.018, 0], [0.02, 0.012], [0.012, 0.03], [0.016, 0.045], [0.0001, 0.05]], 16).rotateX(-Math.PI / 2).translate(x, F + 0.8, front));
  }
  kit.add(mergeGeos(wins), M.glow('cigWin', 0.11), { cast: false });
  kit.add(mergeGeos(packs), M.std('cigPack', 0x020202, 0.9, 'cloth'), { cast: false });
  kit.add(mergeGeos(knobs), PM().chrome, { cast: false });
  // the mirror panel above and the tray below
  kit.add(new THREE.ShapeGeometry(roundRectShape(mw - 0.12, 0.26, 0.03), 4).rotateY(Math.PI).translate(mx, F + 1.3, front), M.std('cigMirror', 0x1e1e1e, 0.12, 'metal'), { cast: false });
  kit.add(kit.box(mx - 0.18, mx + 0.18, F + 0.5, F + 0.56, front - 0.07, front), PM().chrome, { cast: false });
  out.machine = { pos: V3(mx, F, front - 0.5) };
  return out;
}
