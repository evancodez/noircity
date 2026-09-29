import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { LAYER } from '../../render/layers.js';
import { roundRectShape, smooth, lathe, uvRect, mergeGeos, tubeAlong, AT, PM, V3, V2 } from '../lib.js';

// The jukebox at the end wall: an arched 1930s cabinet 1.5 m tall, its side
// pilasters and arched top lit (paper white and grey, no colour), a window
// showing the record turning and the arm; below, the speaker's grille.
// Built facing +z at the origin (parts/diner.js stands it against the wall).
//   jb.state: { slot, spin, arm (0 down .. 1 up), phase, dark }
//   jb.tick(dt)  the record turns (78 rpm), the change runs, the lamps
//   jb.change()  2 s: the arm lifts, the magazine turns, a new record drops
//   jb.skip()    the needle jumps: the arm kicks up and drops back
//   jb.darken(s) its lights go out for s seconds
const W = 0.92, H = 1.5, Dp = 0.58, Hs = 1.02;   // width, height, depth, where the arch springs

// the cabinet's outline: straight sides to Hs, a round arch over the top
function outline(w, hs, h, inset = 0) {
  const s = new THREE.Shape();
  const hw = w / 2 - inset;
  const r = hw, cy = h - inset - r * 0.92;
  s.moveTo(-hw, inset);
  s.lineTo(hw, inset);
  s.lineTo(hw, Math.min(hs, cy));
  // the arch: a slightly flattened half circle
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    s.lineTo(Math.cos(a) * hw, cy + Math.sin(a) * r * 0.92);
  }
  s.lineTo(-hw, inset);
  return s;
}

export function buildJukebox(kit) {
  const { M } = kit;
  const g = new THREE.Group();
  g.name = 'jukebox';
  const lit = M.glow('jukeLit', 1.6);
  const litGrey = M.glow('jukeGrey', 0.09);
  const dark = M.glow('jukeDark', 0.0);
  // ---- the cabinet: the arched body, bevelled
  kit.piece();
  const body = new THREE.ExtrudeGeometry(outline(W, Hs, H), { depth: Dp - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.028, bevelSegments: 4, curveSegments: 40 });
  body.translate(0, 0, -Dp / 2 + 0.03);
  const cab = kit.add(smooth(body), M.std('jukeWood', 0x141414, 0.45, 'wood'), { parent: g });
  // a plinth
  kit.add(kit.box(-W / 2 - 0.02, W / 2 + 0.02, 0, 0.07, -Dp / 2, Dp / 2 + 0.02), M.black, { parent: g });
  // ---- the lit pilasters up the front's sides and round the arch (paper
  // white), a grey inner band beside them
  kit.piece();
  const fz = Dp / 2 + 0.005;
  const arch = [];
  const hw = W / 2 - 0.07, cy = H - 0.07 - hw * 0.92;
  const archPts = (rx, yb, zz) => {
    const pts = [V3(rx, yb, zz), V3(rx, cy, zz)];
    for (let i = 1; i <= 24; i++) { const a = (i / 24) * Math.PI; pts.push(V3(Math.cos(a) * rx, cy + Math.sin(a) * rx * 0.92, zz)); }
    pts.push(V3(-rx, yb, zz));
    return pts;
  };
  arch.push(tubeAlong(archPts(hw, 0.18, fz), 0.03, 12, 160));
  const glowMesh = kit.add(arch[0], lit, { parent: g, cast: false });
  const greyArch = tubeAlong(archPts(hw - 0.075, 0.62, fz - 0.01), 0.018, 10, 140);
  const greyMesh = kit.add(greyArch, litGrey, { parent: g, cast: false });
  // the fluted caps at the pilasters' feet
  const feet = [];
  for (const sx of [-1, 1]) feet.push(lathe([[0.0001, 0], [0.05, 0], [0.052, 0.02], [0.04, 0.05], [0.036, 0.1], [0.0001, 0.1]], 20).translate(sx * hw, 0.08, fz - 0.01));
  kit.add(mergeGeos(feet), M.steel, { parent: g });
  // ---- the window: a lit well on the cabinet's face, the record standing
  // in it face-on (black, a pale label), the arm across it, glass over them
  kit.piece();
  const WY = 1.06;
  const well = new THREE.ShapeGeometry(roundRectShape(0.5, 0.3, 0.06), 8).translate(0, WY, fz + 0.002);
  const wellMesh = kit.add(well, M.glow('jukeWell', 0.16), { parent: g, cast: false });
  const winG = new THREE.ShapeGeometry(roundRectShape(0.5, 0.3, 0.06), 8).translate(0, WY, fz + 0.034);
  kit.add(winG, M.std('jukeWin', 0x303030, 0.1, 'metal', { transparent: true, opacity: 0.16, depthWrite: false }), { parent: g, cast: false, noRay: true });
  const bz = new THREE.ShapeGeometry(Object.assign(roundRectShape(0.58, 0.38, 0.09), { holes: [roundRectShape(0.5, 0.3, 0.06)] }), 8).translate(0, WY, fz + 0.036);
  kit.add(bz, M.steel, { parent: g, cast: false });
  // the arched top's lit panel (grey), inside the inner arch
  const top = new THREE.Shape();
  const ir = hw - 0.09;
  top.moveTo(ir, 1.26);
  for (let i = 0; i <= 30; i++) { const a = (i / 30) * Math.PI; top.lineTo(Math.cos(a) * ir, cy + Math.sin(a) * ir * 0.92); }
  top.lineTo(-ir, 1.26);
  const topMesh = kit.add(new THREE.ShapeGeometry(top, 12).translate(0, 0, fz + 0.002), M.glow('jukeTop', 0.075), { parent: g, cast: false });
  // the side panels beside the grille, lit grey from inside
  const sides = [];
  for (const sx of [-1, 1]) sides.push(new THREE.ShapeGeometry(roundRectShape(0.06, 0.7, 0.025), 4).translate(sx * (hw - 0.075), 0.58, fz + 0.002));
  const sideMesh = kit.add(mergeGeos(sides), M.glow('jukeSide', 0.11), { parent: g, cast: false });
  // the record
  const rec = new THREE.Group();
  rec.position.set(-0.04, WY, fz + 0.012);
  g.add(rec);
  const disc = new THREE.CircleGeometry(0.118, 48);
  uvRect(disc, AT.juke);
  const discMesh = kit.add(disc, M.std('record', 0xffffff, 0.3, 'enamel', { map: PM().atlas.map }), { parent: rec, cast: false });
  const deck = new THREE.Group();   // (the magazine turns out of sight)
  g.add(deck);
  // the tone arm: its pivot at the window's right, the head on the record
  const armG = new THREE.Group();
  armG.position.set(0.19, WY + 0.11, fz + 0.022);
  g.add(armG);
  kit.add(mergeGeos([new THREE.CylinderGeometry(0.02, 0.022, 0.01, 16).rotateX(Math.PI / 2), tubeAlong([V3(0, 0, 0.004), V3(-0.06, -0.03, 0.004), V3(-0.13, -0.1, 0.004)], 0.006, 8, 16), new THREE.BoxGeometry(0.03, 0.02, 0.012).rotateZ(0.8).translate(-0.135, -0.105, 0.004)]), M.steel, { parent: armG, cast: false });
  // the program card strip under the window (a pale grey band), the
  // selector keys
  kit.piece();
  kit.add(new THREE.PlaneGeometry(0.46, 0.07).translate(0, 0.82, fz + 0.004), M.glow('jukeCards', 0.07), { parent: g, cast: false });
  const keys = [];
  for (let k = 0; k < 8; k++) keys.push(new THREE.CapsuleGeometry(0.008, 0.02, 3, 8).rotateX(Math.PI / 2).translate(-0.2 + k * 0.057, 0.755, fz + 0.012));
  kit.add(mergeGeos(keys), M.steel, { parent: g, cast: false });
  // ---- the grille: the speaker cloth dark, curved bars across it (no
  // grid: three sweeping ribs, the middle one lit grey)
  kit.piece();
  kit.add(new THREE.ShapeGeometry(roundRectShape(0.58, 0.42, 0.1), 8).translate(0, 0.43, fz + 0.001), M.black, { parent: g, cast: false });
  const ribs = [];
  for (const [yy, bend] of [[0.33, 0.05], [0.43, 0.07], [0.53, 0.05]]) ribs.push(tubeAlong([V3(-0.27, yy - bend, fz + 0.01), V3(0, yy + bend * 0.4, fz + 0.02), V3(0.27, yy - bend, fz + 0.01)], 0.01, 8, 30));
  kit.add(mergeGeos([ribs[0], ribs[2]]), M.steel, { parent: g, cast: false });
  const midRib = kit.add(ribs[1], litGrey, { parent: g, cast: false });
  // its glow on the floor before it: a soft additive ellipse (scene pass
  // only; the lit panels are the light, the room adds no lamp)
  const fc = document.createElement('canvas'); fc.width = fc.height = 64;
  const fg = fc.getContext('2d'); const gr = fg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#555'); gr.addColorStop(1, '#000'); fg.fillStyle = gr; fg.fillRect(0, 0, 64, 64);
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const floorGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.05, 0.05), map: ft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1).rotateX(-Math.PI / 2).translate(0, 0.012, Dp / 2 + 0.45), floorGlowMat);
  floorGlow.layers.set(LAYER.FX); floorGlow.userData.noRay = true;
  g.add(floorGlow);
  // (the lit parts that go dark together)
  const lights = [{ m: glowMesh, on: lit }, { m: greyMesh, on: litGrey }, { m: midRib, on: litGrey }, { m: wellMesh, on: wellMesh.material }, { m: topMesh, on: topMesh.material }, { m: sideMesh, on: sideMesh.material }];
  const state = { spin: 0, arm: 0, phase: -1, dark: 0, skip: 0, slot: null };
  const jb = {
    group: g, cabinet: cab, record: rec, disc: discMesh, arm: armG, deck, lights, state,
    size: V3(W, H, Dp),
    change() { state.phase = 0; },
    skip() { state.skip = 0.25; },
    darken(s = 1) { state.dark = Math.max(state.dark, s); },
    tick(dt) {
      // the record turns at 78 rpm while it plays (not while changing)
      const playing = state.phase < 0 && state.dark <= 0;
      if (playing) state.spin += dt * 8.17;
      rec.rotation.z = -state.spin;
      let arm = 0;
      if (state.phase >= 0) {
        // the change, 2 s: arm up (0 .. 0.35), the record lifts away and the
        // magazine turns (0.35 .. 1.5), a new record drops, arm down (1.6 .. 2)
        state.phase += dt;
        const p = state.phase;
        arm = p < 0.35 ? p / 0.35 : p < 1.6 ? 1 : Math.max(0, 1 - (p - 1.6) / 0.4);
        // (the record drops away into the mechanism and a new one rises)
        rec.scale.setScalar(p > 0.35 && p < 1.5 ? 1 - Math.sin(((p - 0.35) / 1.15) * Math.PI) * 0.92 : 1);
        deck.rotation.z = p > 0.35 && p < 1.5 ? ((p - 0.35) / 1.15) * Math.PI * 2 * 0.25 : 0;
        if (p >= 2) state.phase = -1;
      }
      if (state.skip > 0) { state.skip = Math.max(0, state.skip - dt); arm = Math.max(arm, Math.sin((state.skip / 0.25) * Math.PI) * 0.5); }
      armG.rotation.z = arm * 0.55;
      if (state.dark > 0) state.dark = Math.max(0, state.dark - dt);
      const off = state.dark > 0;
      for (const l of lights) l.m.material = off ? dark : l.on;
      floorGlow.visible = !off;
    },
  };
  return jb;
}
void V2;
