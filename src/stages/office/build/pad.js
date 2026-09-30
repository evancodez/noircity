import * as THREE from 'three';
import { COMBO } from '../plan.js';

// The desk pad (puzzle D): the top sheet is gone; the next one carries the
// dents of what was written on it. A pencil's side rubbed across it lays
// graphite everywhere but in the dents, and the numbers come up white.
//   pad.rub(u, v, du, dv, k)   a stroke of the lead's side from (u, v) along
//                              (du, dv) (sheet uv, 0..1; v down the sheet),
//                              k its pressure (0..1)
//   pad.shown()                how much of the numbers reads (0..1)
//   pad.coverage()             how much of the sheet is shaded (0..1)
//   pad.reset()                a clean sheet
//   pad.texture, pad.canvas    the sheet as the room draws it
// The graphite is uneven as a hand's: each stroke is a band of grain (the
// lead's side on the paper's tooth), its edges ragged, darker where it
// passes again; the dents stay clean, their rims a little darker (the lead
// catches the edge of a groove).
const S = 512;                   // the canvas (the sheet is 0.215 x 0.28: ~2.4 px per mm)
const ASPECT = 0.28 / 0.215;

// the dents: the numbers in a hand, written hard (a bookkeeper's figures)
function dentCanvas() {
  const c = document.createElement('canvas');
  c.width = S; c.height = Math.round(S * ASPECT);
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 7;
  g.font = 'italic 112px Georgia, "Times New Roman", serif';
  g.fillStyle = '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // three figures down the sheet's middle, a little uneven (a hand)
  const ys = [0.34, 0.5, 0.66];
  COMBO.forEach((n, i) => {
    g.save();
    g.translate(S * (0.47 + (i - 1) * 0.03), c.height * ys[i]);
    g.rotate(-0.06 + i * 0.03);
    g.fillText(String(n), 0, 0);
    g.restore();
  });
  // a line under them, and an 'R L R' a little to the left, faint
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(S * 0.3, c.height * 0.75); g.lineTo(S * 0.66, c.height * 0.745); g.stroke();
  g.font = 'italic 44px Georgia, serif';
  ['R', 'L', 'R'].forEach((t, i) => g.fillText(t, S * 0.22, c.height * ys[i]));
  // (the dents of older writing, too faint to read: the pad was used)
  g.globalAlpha = 0.35; g.lineWidth = 3;
  for (let k = 0; k < 5; k++) { g.beginPath(); const y = c.height * (0.12 + k * 0.035); g.moveTo(S * 0.15, y); for (let x = 0.15; x < 0.85; x += 0.05) g.lineTo(S * x, y + Math.sin(x * 40 + k) * 4); g.stroke(); }
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
  // the sheet as drawn: paper, the graphite over it, the dents over that
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cg = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // the grain: a tile of the paper's tooth (a stroke picks it up)
  const grain = document.createElement('canvas'); grain.width = grain.height = 64;
  {
    const q = grain.getContext('2d'), im = q.createImageData(64, 64);
    let s = 91;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 64 * 64; i++) {
      // (fibres along the sheet: streaks more than dots)
      const v = rnd();
      const a = v > 0.35 ? 255 * (0.55 + 0.45 * rnd()) : 255 * 0.15 * rnd();
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 20; im.data[i * 4 + 3] = a;
    }
    q.putImageData(im, 0, 0);
  }
  const pat = gg.createPattern(grain, 'repeat');
  let dirty = true;
  const paper = () => {
    cg.fillStyle = '#d8d6cf';
    cg.fillRect(0, 0, W, H);
    // the pad's faint rules
    cg.strokeStyle = 'rgba(90,90,90,0.25)'; cg.lineWidth = 1.5;
    for (let y = H * 0.1; y < H * 0.97; y += H * 0.045) { cg.beginPath(); cg.moveTo(W * 0.06, y); cg.lineTo(W * 0.94, y); cg.stroke(); }
    // the torn stub of the sheet above, along the top edge
    cg.fillStyle = '#bdbab2';
    cg.beginPath(); cg.moveTo(0, 0);
    for (let x = 0; x <= W; x += 16) cg.lineTo(x, 8 + ((x * 7) % 11));
    cg.lineTo(W, 0); cg.closePath(); cg.fill();
  };
  const compose = () => {
    paper();
    cg.drawImage(gcv, 0, 0);
    // the dents: clean paper in the graphite, a darker rim where the lead caught
    cg.save();
    cg.globalCompositeOperation = 'destination-out';
    cg.globalAlpha = 1;
    cg.restore();
    // (paper colour where the dents are: drawn through a mask of the dents)
    cg.save();
    cg.globalAlpha = 0.95;
    cg.drawImage(tinted(dents, '#dddbd4'), 0, 0);
    cg.restore();
    tex.needsUpdate = true;
    dirty = false;
  };
  // the dents' mask in the paper's colour (made once)
  let tintCache = null;
  function tinted(src, col) {
    if (tintCache) return tintCache;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = col; g.fillRect(0, 0, W, H);
    tintCache = c;
    return c;
  }
  compose();

  // the numbers' own pixels (where to measure what reads): the dents' bounding rows
  const numMask = [];
  for (let y = Math.floor(H * 0.26); y < H * 0.74; y += 3) for (let x = Math.floor(W * 0.3); x < W * 0.7; x += 3) {
    const i = (y * W + x) * 4;
    // (the ring round a dent: shaded paper there makes the dent read)
    let near = false;
    for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) { const j = ((y + dy) * W + (x + dx)) * 4; if (dentData[j + 3] > 100) near = true; }
    if (dentData[i + 3] < 60 && near) numMask.push(x, y);
  }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const api = {
    canvas: cv, texture: tex, W, H,
    rub(u, v, du, dv, k = 1) {
      const x = u * W, y = v * H, dx = du * W, dy = dv * H;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return 0;
      // the lead's side: a band ~9 mm wide across the stroke, lighter at its edges
      const steps = Math.ceil(len / 3);
      gg.save();
      gg.fillStyle = pat;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const px = x + dx * t, py = y + dy * t;
        gg.save();
        gg.translate(px, py);
        gg.rotate(Math.atan2(dy, dx) + Math.PI / 2 + (rnd() - 0.5) * 0.25);
        gg.globalAlpha = Math.min(1, 0.2 * k * (0.6 + 0.8 * rnd()));
        // (the lead's flank: ~1.5 cm across the stroke, a few mm along it)
        const w = 34 + rnd() * 12, h = 8 + rnd() * 5;
        // (the pattern stays put on the sheet: offset it back)
        gg.translate(-w / 2, -h / 2);
        gg.fillRect(0, 0, w, h);
        gg.restore();
      }
      gg.restore();
      dirty = true;
      return len / W;
    },
    // a stroke's graphite shown: redraw the sheet (once a step at most)
    flush() { if (dirty) compose(); },
    // (how much reads: the least read of the three figures - half of the
    // sheet read could be two figures whole and the third never touched,
    // and the sheet torn off with two of three numbers on it)
    shown() {
      const d = gg.getImageData(0, 0, W, H).data;
      const n = [0, 0, 0], on = [0, 0, 0];
      for (let i = 0; i < numMask.length; i += 2) {
        const y = numMask[i + 1] / H, b = y < 0.42 ? 0 : y < 0.58 ? 1 : 2;
        n[b]++; if (d[(numMask[i + 1] * W + numMask[i]) * 4 + 3] > 120) on[b]++;
      }
      return Math.min(...n.map((k, b) => (k ? on[b] / k : 1)));
    },
    coverage() {
      const d = gg.getImageData(0, 0, W, H).data;
      let on = 0, n = 0;
      for (let i = 3; i < d.length; i += 4 * 23) { n++; if (d[i] > 90) on++; }
      return n ? on / n : 0;
    },
    reset() { gg.clearRect(0, 0, W, H); seed = 7; compose(); },
    // (a jump into the beat after: the sheet as it was left, rubbed)
    rubbedAll() {
      for (let y = 0.2; y < 0.8; y += 0.03) api.rub(0.18, y, 0.64, 0.02, 1);
      for (let y = 0.2; y < 0.8; y += 0.05) api.rub(0.2, y, 0.6, -0.01, 1);
      compose();
    },
  };
  return api;
}
