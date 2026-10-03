import * as THREE from 'three';
import { COMBO } from '../plan.js';

// The desk pad (puzzle D): the top sheet is gone (burnt: a corner of it in
// the ashtray); the next one carries the dents of what was written on it. A
// pencil's side rubbed across it lays graphite everywhere but in the dents,
// and the numbers come up white. [C5] wave C: the figures are big and whole -
// three numbers, each with the way to turn drawn beside it as a curved arrow
// (clockwise for right, the other way for left), written hard enough to read
// at a glance once about two thirds of the sheet is shaded; the rest of the
// sheet shades too (a thorough hand may do it all). Under the lamp, before a
// stroke, the dents show faintly in its raking light (setLit).
//   pad.rub(u, v, du, dv, k)   a stroke of the lead's side from (u, v) along
//                              (du, dv) (sheet uv, 0..1; v down the sheet),
//                              k its pressure (0..1)
//   pad.rows()                 how much of each figure's ring is shaded [0..1 x 3]
//   pad.shown()                the least of them (the sheet reads when all three do)
//   pad.coverage()             how much of the sheet is shaded (0..1)
//   pad.setLit(on)             the lamp's raking light on it (the faint dents)
//   pad.reset()                a clean sheet
//   pad.texture, pad.canvas    the sheet as the room draws it
const S = 512;                   // the canvas (the sheet is 0.215 x 0.28: ~2.4 px per mm)
const ASPECT = 0.28 / 0.215;
// the three rows down the sheet (share of its height)
const ROWS = [0.3, 0.52, 0.74];
const DIRS = ['R', 'L', 'R'];

// a curved arrow: three quarters of a circle and its head; cw: clockwise as the sheet is read
function arrow(g, cx, cy, r, cw) {
  const a0 = cw ? -Math.PI * 0.95 : -Math.PI * 0.05, a1 = cw ? Math.PI * 0.45 : -Math.PI * 1.45;
  g.beginPath();
  g.arc(cx, cy, r, a0, a1, !cw);
  g.stroke();
  // the head at the arc's end, along its way round
  const ex = cx + Math.cos(a1) * r, ey = cy + Math.sin(a1) * r;
  const tx = (cw ? -Math.sin(a1) : Math.sin(a1)), ty = (cw ? Math.cos(a1) : -Math.cos(a1));
  const nx = Math.cos(a1), ny = Math.sin(a1), L = r * 0.6;
  g.beginPath();
  g.moveTo(ex + tx * L * 0.55, ey + ty * L * 0.55);
  g.lineTo(ex - tx * L * 0.35 + nx * L * 0.55, ey - ty * L * 0.35 + ny * L * 0.55);
  g.lineTo(ex - tx * L * 0.35 - nx * L * 0.55, ey - ty * L * 0.35 - ny * L * 0.55);
  g.closePath();
  g.fill();
}

// the dents: the numbers in a hand, written hard (big, whole), the turn's arrow by each
function dentCanvas() {
  const c = document.createElement('canvas');
  c.width = S; c.height = Math.round(S * ASPECT);
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  COMBO.forEach((n, i) => {
    const y = c.height * ROWS[i];
    g.save();
    g.translate(S * 0.62, y);
    g.rotate(-0.04 + i * 0.025);
    g.font = 'bold 150px Georgia, "Times New Roman", serif';
    g.lineWidth = 9;
    g.strokeText(String(n), 0, 6);
    g.fillText(String(n), 0, 6);
    g.restore();
    g.lineWidth = 13;
    arrow(g, S * 0.22, y, 44, DIRS[i] === 'R');
  });
  // (the dents of older writing, too faint to read: the pad was used)
  g.globalAlpha = 0.35; g.lineWidth = 3;
  for (let k = 0; k < 4; k++) { g.beginPath(); const y = c.height * (0.08 + k * 0.03); g.moveTo(S * 0.15, y); for (let x = 0.15; x < 0.85; x += 0.05) g.lineTo(S * x, y + Math.sin(x * 40 + k) * 4); g.stroke(); }
  g.globalAlpha = 1;
  return c;
}

export function makePad() {
  const W = S, H = Math.round(S * ASPECT);
  const dents = dentCanvas();
  const dctx = dents.getContext('2d');
  const dentData = dctx.getImageData(0, 0, W, H).data;
  // the graphite laid so far (alpha)
  const gcv = document.createElement('canvas'); gcv.width = W; gcv.height = H;
  const gg = gcv.getContext('2d');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cg = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const grain = document.createElement('canvas'); grain.width = grain.height = 64;
  {
    const q = grain.getContext('2d'), im = q.createImageData(64, 64);
    let s = 91;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 64 * 64; i++) {
      const v = rnd();
      const a = v > 0.35 ? 255 * (0.55 + 0.45 * rnd()) : 255 * 0.15 * rnd();
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 8; im.data[i * 4 + 3] = a;
    }
    q.putImageData(im, 0, 0);
  }
  const pat = gg.createPattern(grain, 'repeat');
  let dirty = true, lit = false;
  const paper = () => {
    cg.fillStyle = '#d8d6cf';
    cg.fillRect(0, 0, W, H);
    cg.strokeStyle = 'rgba(90,90,90,0.25)'; cg.lineWidth = 1.5;
    for (let y = H * 0.1; y < H * 0.97; y += H * 0.045) { cg.beginPath(); cg.moveTo(W * 0.06, y); cg.lineTo(W * 0.94, y); cg.stroke(); }
    cg.fillStyle = '#bdbab2';
    cg.beginPath(); cg.moveTo(0, 0);
    for (let x = 0; x <= W; x += 16) cg.lineTo(x, 8 + ((x * 7) % 11));
    cg.lineTo(W, 0); cg.closePath(); cg.fill();
  };
  let tints = {};
  const tinted = (col) => {
    if (tints[col]) return tints[col];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(dents, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = col; g.fillRect(0, 0, W, H);
    return (tints[col] = c);
  };
  const compose = () => {
    paper();
    // (the lamp's raking light: the dents' shadowed edges and lit edges, faint)
    if (lit) {
      cg.save(); cg.globalAlpha = 0.16; cg.drawImage(tinted('#000'), 2, 2); cg.restore();
      cg.save(); cg.globalAlpha = 0.3; cg.drawImage(tinted('#f4f2ea'), -1, -1); cg.restore();
    }
    cg.drawImage(gcv, 0, 0);
    // the dents: clean paper in the graphite
    cg.save(); cg.globalAlpha = 0.97; cg.drawImage(tinted('#e2e0d8'), 0, 0); cg.restore();
    tex.needsUpdate = true;
    dirty = false;
  };
  compose();

  // the numbers' rings (where to measure what reads): unshaded paper beside a dent, per row
  const numMask = [];
  for (let y = Math.floor(H * 0.17); y < H * 0.87; y += 3) for (let x = Math.floor(W * 0.06); x < W * 0.94; x += 3) {
    const i = (y * W + x) * 4;
    let near = false;
    for (const [dx, dy] of [[7, 0], [-7, 0], [0, 7], [0, -7]]) { const j = ((y + dy) * W + (x + dx)) * 4; if (dentData[j + 3] > 100) near = true; }
    if (dentData[i + 3] < 60 && near) numMask.push(x, y);
  }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rowOf = (y) => (y < (ROWS[0] + ROWS[1]) / 2 ? 0 : y < (ROWS[1] + ROWS[2]) / 2 ? 1 : 2);
  const api = {
    canvas: cv, texture: tex, W, H, rowsAt: ROWS,
    rub(u, v, du, dv, k = 1) {
      const x = u * W, y = v * H, dx = du * W, dy = dv * H;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return 0;
      const steps = Math.ceil(len / 3);
      gg.save();
      gg.fillStyle = pat;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const px = x + dx * t, py = y + dy * t;
        gg.save();
        gg.translate(px, py);
        gg.rotate(Math.atan2(dy, dx) + Math.PI / 2 + (rnd() - 0.5) * 0.25);
        gg.globalAlpha = Math.min(1, 0.3 * k * (0.6 + 0.8 * rnd()));
        // (the lead's flank: ~1.7 cm across the stroke, a few mm along it)
        const w = 40 + rnd() * 12, h = 9 + rnd() * 5;
        gg.translate(-w / 2, -h / 2);
        gg.fillRect(0, 0, w, h);
        gg.restore();
      }
      gg.restore();
      dirty = true;
      return len / W;
    },
    flush() { if (dirty) compose(); },
    setLit(on) { if (lit !== !!on) { lit = !!on; dirty = true; } },
    // (each figure's ring: how much of the paper round its dents is shaded)
    rows() {
      const d = gg.getImageData(0, 0, W, H).data;
      const n = [0, 0, 0], on = [0, 0, 0];
      for (let i = 0; i < numMask.length; i += 2) {
        const b = rowOf(numMask[i + 1] / H);
        n[b]++; if (d[(numMask[i + 1] * W + numMask[i]) * 4 + 3] > 110) on[b]++;
      }
      return n.map((k, b) => (k ? on[b] / k : 1));
    },
    shown() { return Math.min(...api.rows()); },
    coverage() {
      const d = gg.getImageData(0, 0, W, H).data;
      let on = 0, n = 0;
      for (let i = 3; i < d.length; i += 4 * 23) { n++; if (d[i] > 90) on++; }
      return n ? on / n : 0;
    },
    reset() { gg.clearRect(0, 0, W, H); seed = 7; compose(); },
    rubbedAll() {
      for (let y = 0.12; y < 0.92; y += 0.025) api.rub(0.04, y, 0.92, 0.02, 1);
      for (let y = 0.12; y < 0.92; y += 0.04) api.rub(0.06, y, 0.88, -0.01, 1);
      compose();
    },
  };
  return api;
}
