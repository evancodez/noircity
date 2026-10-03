import * as THREE from 'three';
import { FOG } from '../../../render/fog.js';
import { LAYER } from '../../../render/layers.js';
import { makeKit } from '../../../props/diner/kit.js';

// The studio's set (lane C9): a room with a floor, a back wall with a tall
// window onto the rain (the block's own skyline far off in the fog, parts/
// skyline.js; the sky), a desk under the window. That is all: each still brings its own
// things and lights (src/debug/shots/C9_stills.js). Tone as the office's
// (an albedo of ~0x40 prints near black in the room's dim air and pale in a
// pool of light).
//   stage.studio = { SET, mats, kit, desk, window, glass, outside, rng }
export const SET = {
  wallZ: -2.0,                // the back wall's face
  win: { x0: -0.78, x1: 0.78, y0: 0.92, y1: 2.55 },
  desk: { x: 0, z: -1.58, w: 1.6, d: 0.8, top: 0.76 },
  room: { x0: -3.2, x1: 3.2, z0: -2.0, z1: 4.0, ceil: 3.2 },
};

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const std = (name, color, roughness, surface, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    m.name = 'studio_' + name;
    m.userData.inkSurface = surface;
    return m;
  };
  const glow = (name, v, extra = {}) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), ...extra });
    m.name = 'studio_' + name;
    m.userData.inkSurface = 'lit';
    return m;
  };
  MATS = {
    std, glow,
    plaster: std('plaster', 0x3c3c3c, 0.95, 'plaster'),
    boards: std('boards', 0x262626, 0.7, 'wood'),
    trim: std('trim', 0x101010, 0.5, 'wood'),
    desk: std('desk', 0x1a1a1a, 0.5, 'wood'),
    deskTop: std('deskTop', 0x262626, 0.85, 'wood'),
    blotter: std('blotter', 0x161616, 0.85, 'cloth'),
    stone: std('stone', 0x2c2c2c, 0.95, 'plaster'),
    black: std('black', 0x040404, 1.0, 'cloth'),
    iron: std('iron', 0x0c0c0c, 0.45, 'metal'),
    bakelite: std('bakelite', 0x0a0a0a, 0.28, 'enamel'),
    brass: std('brass', 0x2a2a2a, 0.3, 'metal'),
    paper: std('paper', 0xb0b0b0, 0.95, 'plaster'),
    shade: std('shade', 0x0c0c0c, 0.35, 'enamel'),
    lampInner: glow('lampInner', 0.7, { side: THREE.DoubleSide }),
    bulb: glow('bulb', 9),
    litWin: glow('litWin', 0.9),
    litDim: glow('litDim', 0.35),
  };
  return MATS;
}

// the rain on the glass: its runs down the pane, a few beads, over a smoked
// tint (the night outside reads dark through it): drawn once on a canvas (an
// effect over the pane, never inked: LAYER.FX). [C9 after the critic: round
// drops read as snow; the runs are what says rain on glass]
function wetGlass(rng, W = 1024, H = 1024) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(4,4,4,0.78)';
  g.fillRect(0, 0, W, H);
  // the runs: thin wavering trails down the glass, long and short, a bead at their foot
  for (let i = 0; i < 150; i++) {
    let x = rng.range(0, W), y = rng.range(-H * 0.3, H * 0.8);
    const len = rng.range(H * 0.06, H * 0.45), w = rng.range(0.8, 2.2);
    g.strokeStyle = `rgba(235,235,230,${rng.range(0.18, 0.42).toFixed(3)})`;
    g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 18; k++) { y += len / 18; x += rng.range(-1.4, 1.4); g.lineTo(x, y); }
    g.stroke();
    g.fillStyle = 'rgba(240,240,236,0.5)';
    g.beginPath(); g.ellipse(x, y + 2, w * 1.2, w * 2.2, 0, 0, Math.PI * 2); g.fill();
  }
  // a few small beads, faint
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), r = rng.range(0.6, 1.6);
    g.fillStyle = `rgba(225,225,220,${rng.range(0.06, 0.16).toFixed(3)})`;
    g.beginPath(); g.ellipse(x, y, r, r * 1.6, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export default {
  name: 'studio', order: 130, tick: 130,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'studio';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const M = mats();
    const rng = stage.rng.fork(9091);
    const { room: R, win: W, desk: D } = SET;
    const box = (x0, x1, y0, y1, z0, z1) => kit.box(x0, x1, y0, y1, z0, z1);

    // ---- the room: floor, the back wall round its window, the side walls, the ceiling
    kit.piece();
    kit.add(box(R.x0, R.x1, -0.05, 0, R.z0, R.z1), M.boards, { cast: false });
    kit.piece();
    const z = SET.wallZ, t = 0.22;
    kit.addMerged([
      box(R.x0, W.x0, 0, R.ceil, z - t, z),
      box(W.x1, R.x1, 0, R.ceil, z - t, z),
      box(W.x0, W.x1, 0, W.y0, z - t, z),
      box(W.x0, W.x1, W.y1, R.ceil, z - t, z),
    ], M.plaster);
    kit.piece();
    kit.addMerged([box(R.x0 - 0.2, R.x0, 0, R.ceil, R.z0, R.z1), box(R.x1, R.x1 + 0.2, 0, R.ceil, R.z0, R.z1), box(R.x0, R.x1, R.ceil, R.ceil + 0.2, R.z0, R.z1)], M.black, { cast: false });
    // the window: its frame, the sill, the sash bars (a cross), the glass
    kit.piece();
    const f = 0.06;
    kit.addMerged([
      box(W.x0 - f, W.x0, W.y0, W.y1, z - 0.12, z + 0.02), box(W.x1, W.x1 + f, W.y0, W.y1, z - 0.12, z + 0.02),
      box(W.x0 - f, W.x1 + f, W.y1, W.y1 + f, z - 0.12, z + 0.02),
      box(W.x0 - 0.1, W.x1 + 0.1, W.y0 - 0.04, W.y0, z - 0.12, z + 0.1),
      box(-0.02, 0.02, W.y0, W.y1, z - 0.1, z - 0.06),
      box(W.x0, W.x1, (W.y0 + W.y1) / 2 - 0.025, (W.y0 + W.y1) / 2 + 0.025, z - 0.1, z - 0.06),
    ], M.trim);
    const gtex = wetGlass(rng);
    const glassMat = new THREE.MeshBasicMaterial({ map: gtex, transparent: true, depthWrite: false, opacity: 0.85 });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W.x1 - W.x0, W.y1 - W.y0).translate((W.x0 + W.x1) / 2, (W.y0 + W.y1) / 2, z - 0.08), glassMat);
    glass.layers.set(LAYER.FX);
    glass.renderOrder = 12;
    g.add(glass);

    // ---- the desk under the window
    kit.piece();
    const dx0 = D.x - D.w / 2, dx1 = D.x + D.w / 2, dz0 = D.z - D.d / 2, dz1 = D.z + D.d / 2;
    const desk = kit.addMerged([
      box(dx0, dx1, D.top - 0.045, D.top, dz0, dz1),
      box(dx0 + 0.03, dx0 + 0.45, 0, D.top - 0.045, dz0 + 0.03, dz1 - 0.03),
      box(dx1 - 0.45, dx1 - 0.03, 0, D.top - 0.045, dz0 + 0.03, dz1 - 0.03),
      box(dx0 + 0.45, dx1 - 0.45, D.top - 0.16, D.top - 0.045, dz0 + 0.04, dz1 - 0.06),
    ], M.deskTop);
    kit.piece();
    const blotter = kit.add(box(D.x - 0.36, D.x + 0.36, D.top, D.top + 0.004, D.z - 0.24, D.z + 0.26), M.blotter, { cast: false });

    // ---- the Looks: inside a room's air (no screen rain, no street mirror); outside the street's night
    const roomBox = new THREE.Box3(new THREE.Vector3(R.x0, -0.5, z - 0.05), new THREE.Vector3(R.x1, R.ceil, R.z1));
    stage.dry.push(roomBox);
    stage.addLook(roomBox, { fogDensity: FOG.density * 0.3, rainOverlay: 0, haze: 0.5, reflect: 'none', ambient: 0.05, room: 'office' });
    stage.colliders.setBounds(R.x0 + 0.3, R.x1 - 0.3, R.z0 + 0.3, R.z1 - 0.3);
    stage.addAnchor('studio.desk', { pos: new THREE.Vector3(D.x, 0, D.z + 0.95), yaw: 0 });

    return { SET, mats: M, kit, group: g, desk, blotter, glass, rng };
  },
};
