import * as THREE from 'three';
import { hoodMaterial, grid } from '../enemies/Hood.js';
import { allocInkId } from '../render/layers.js';
import { accentMaterial } from '../render/accents.js';

// What a figure carries as part of who he is (lane 6): the old man's
// broadsheet, her cigarette holder, his umbrella on the table's edge, the
// brawler's blood in round three. Each: build(char) -> { object, update?(c, dt),
// dispose?(c) }. Figure-borne things share the figure's ink id and material
// (vertex greys), so the ink draws them as part of him.
const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function withColor(geo, fn) {
  const P = geo.getAttribute('position'), n = P.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const s = fn(P.getX(i), P.getY(i), P.getZ(i)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = s; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function figMesh(fig, geo) {
  const m = new THREE.Mesh(geo, hoodMaterial(fig.world));
  m.userData.inkId = fig.inkId; m.userData.inkFigure = true;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---- the broadsheet: open, held up before the face, a little bowed, the
// top corners drooping; a headline and a photograph as darker blocks on the
// outside. The right leaf turns over at the clip's 'page' mark.
const PAPER = { w: 0.66, h: 0.5 };
function leafGeo(side) {
  const W = PAPER.w / 2, H = PAPER.h;
  const g = grid(10, 8, (u, v, p) => {
    const x = side * u * W, y = (v - 0.5) * H;
    // bowed toward the reader (-z), the outer corners drooping
    const bow = -0.05 * Math.sin(Math.PI * u * 0.5) - 0.012 * u * u;
    const droop = -0.025 * u * u * sstep(0.5, 1, v);
    p.set(x, y + droop, bow);
  }, { wrapU: false });
  g.computeVertexNormals();
  return withColor(g, (x, y) => {
    // (the outer face faces the room; the blocks are coarse, not text)
    const ax = Math.abs(x);
    if (y > H * 0.3 && ax > 0.02 && ax < 0.27) return 0.07;               // the headline
    if (side < 0 && y < H * 0.18 && y > -H * 0.2 && ax > 0.08 && ax < 0.24) return 0.1;   // a photograph
    return 0.34;
  });
}
export function newspaper(c) {
  const fig = c.fig;
  const g = new THREE.Group();
  g.name = 'newspaper';
  const L = figMesh(fig, leafGeo(1)), R = new THREE.Group();
  const Rm = figMesh(fig, leafGeo(-1));
  R.add(Rm);
  g.add(L, R);
  g.visible = false;
  fig.bones.root.add(g);
  return {
    object: g, leaf: R,
    update(ch) {
      const st = ch.state, seated = !!ch.seat;
      const on = st === 'sitRead' || st === 'read';
      g.visible = on;
      if (!on) return;
      // (object space: the hands hold its side edges; see castAnim sitRead / read)
      const y = seated ? ch.seatModel + 0.64 : 1.46;
      g.position.set(0, y, 0.39);
      // the page: 4.3 .. 4.9 of the reading loop the right leaf goes over
      const a = ch.fig.anim.upper.get(ch.animName);
      const t = a ? a.time % 7 : 0;
      const k = sstep(4.3, 4.9, t) * (1 - sstep(4.9, 4.92, t));
      R.rotation.y = -Math.PI * k;
    },
  };
}

// ---- her cigarette holder: a long black stem, the cigarette, the ember
let EMBER = null;
export function holder(c) {
  const fig = c.fig;
  const k = fig.costume.garments.find((g) => g.kind === 'hands')?.s ?? 1;
  const g = new THREE.Group();
  const stem = new THREE.CylinderGeometry(0.0035, 0.003, 0.17, 10).translate(0, 0.085, 0);
  const cig = new THREE.CylinderGeometry(0.0045, 0.0045, 0.05, 10).translate(0, 0.195, 0);
  g.add(figMesh(fig, withColor(stem, () => 0.004)));
  g.add(figMesh(fig, withColor(cig, () => 0.3)));
  if (!EMBER) EMBER = accentMaterial('ember');
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), EMBER);
  e.position.y = 0.221;
  g.add(e);
  // between the fingers, pointing out and up from the hand
  g.position.set(0, -0.12 * k, 0.02);
  g.rotation.set(1.25, 0, -0.35);
  fig.bones.handR.add(g);
  return { object: g, tip: e };
}

// ---- her cloth: a crumpled square in the wiping hand (shown while she wipes)
export function cloth(c) {
  const fig = c.fig;
  const geo = grid(12, 10, (u, v, p) => {
    const a = u * TAU, b = v * Math.PI;
    const r = 1 + 0.3 * Math.sin(3 * a + 1) * Math.sin(2 * b) + 0.15 * Math.sin(7 * a + 3 * b);
    p.set(0.05 * r * Math.sin(b) * Math.cos(a), 0.022 * r * Math.cos(b), 0.045 * r * Math.sin(b) * Math.sin(a));
  });
  geo.computeVertexNormals();
  const m = figMesh(fig, withColor(geo, () => 0.12));
  const k = fig.costume.garments.find((g) => g.kind === 'hands')?.s ?? 1;
  m.position.set(0, -0.09 * k, 0.01);
  m.visible = false;
  fig.bones.handR.add(m);
  return { object: m };
}

// ---- his umbrella, hooked by its crook over the booth table's edge
let UMB_MAT = null;
export function umbrella(c) {
  const fig = c.fig, stage = c.stage;
  if (!UMB_MAT) UMB_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
  const g = new THREE.Group();
  g.name = 'umbrella';
  // (in its own frame: the crook's top at y = 0, hanging down -y, the
  // table edge along x)
  const crook = new THREE.TorusGeometry(0.035, 0.007, 8, 24, Math.PI * 1.15).rotateY(Math.PI / 2).rotateX(-0.1).translate(0, -0.035, -0.035);
  const shaft = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8).translate(0, -0.09, 0);
  const canopy = new THREE.LatheGeometry([
    [0.004, 0], [0.026, -0.03], [0.034, -0.12], [0.03, -0.4], [0.02, -0.6], [0.006, -0.7], [0.003, -0.74]].map(([r, y]) => new THREE.Vector2(r, y)), 20).translate(0, -0.14, 0);
  const tip = new THREE.CylinderGeometry(0.003, 0.002, 0.06, 6).translate(0, -0.91, 0);
  const id = allocInkId();
  for (const geo of [crook, shaft, canopy, tip]) {
    const m = new THREE.Mesh(geo, UMB_MAT);
    m.castShadow = true; m.receiveShadow = true; m.userData.inkId = id;
    g.add(m);
  }
  g.visible = false;
  stage.scene.add(g);
  return {
    object: g,
    update(ch) {
      const S = ch.seat;
      const on = !!S && S.type === 'booth' && ch.alive;
      g.visible = on;
      if (!on) return;
      // the table's edge before his seat, at his right hand, a little rake
      const yaw = ch.fig.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
      const rx = -Math.cos(yaw), rz = Math.sin(yaw);
      const top = S.floor + 0.75 + 0.01;
      g.position.set(ch.pos.x + fx * 0.4 + rx * 0.3, top, ch.pos.z + fz * 0.4 + rz * 0.3);
      g.rotation.set(0, yaw, 0.06);
    },
    dispose() { stage.scene.remove(g); },
  };
}

// ---- blood (round three): at his mouth, on his shirt front
let BLOOD = null;
export function blood(c) {
  const fig = c.fig, R = fig.rig.BIND;
  if (!BLOOD) BLOOD = accentMaterial('blood');
  const g = new THREE.Group();
  const blob = (rx, ry, rz, seed) => {
    const geo = grid(16, 10, (u, v, p) => {
      const a = u * TAU, b = v * Math.PI;
      const r = 1 + 0.25 * Math.sin(3 * a + seed) + 0.15 * Math.sin(5 * a + 2 * seed);
      p.set(rx * r * Math.sin(b) * Math.cos(a), ry * r * Math.sin(b) * Math.sin(a), rz * Math.cos(b));
    });
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, BLOOD);
    m.userData.inkId = fig.inkId; m.userData.inkFigure = true;
    return m;
  };
  // the mouth: a smear at the corner of the mouth and a run down the chin
  const hs = fig.costume.body.headS ?? 1;
  const C = new THREE.Vector3(0, R.head.y + 0.08 * hs, R.head.z + 0.018 * hs);
  const mouth = blob(0.016, 0.009, 0.004, 1.3);
  mouth.position.set(0.012, C.y - 0.052 * hs, C.z + 0.088 * hs).sub(R.head);
  mouth.rotation.x = 0.35;
  const drip = blob(0.006, 0.02, 0.004, 2.1);
  drip.position.set(0.018, C.y - 0.075 * hs, C.z + 0.08 * hs).sub(R.head);
  drip.rotation.x = 0.5;
  fig.bones.head.add(mouth, drip);
  // the shirt front, in the waistcoat's V
  const sp = blob(0.024, 0.036, 0.004, 0.4);
  const T = fig.costume.body.torso;
  const row = T.find((r) => r[0] >= 1.34) || T[T.length - 1];
  sp.position.set(-0.012, 1.345, row[4] + row[2] + 0.016).sub(R.chest);
  sp.rotation.x = -0.2;
  const sp2 = blob(0.01, 0.014, 0.004, 3.3);
  sp2.position.set(0.02, 1.3, row[4] + row[2] + 0.02).sub(R.chest);
  fig.bones.chest.add(sp, sp2);
  const parts = [mouth, drip, sp, sp2];
  for (const m of parts) m.visible = false;
  return { object: g, parts, set(level) { parts.forEach((m, i) => { m.visible = level > (i < 2 ? 0 : 0.5); }); } };
}
