import { RNG } from '../util/rng.js';
import { hashSeed, blob, frayEdges } from './inkArt.js';

// Hand lettering and the kit's small drawn things (lane C1, docs/story/seams/Z.md):
//   letterCanvas(text, opts)   comic lettering: capitals in a condensed
//                              sans, each glyph a hair off its neighbours
//                              (turned, raised, wider or narrower), as a
//                              letterer's pen leaves them; seeded by the text
//   keyCap(label, opts)        a key drawn as a key cap: paper with an ink
//                              rim and a darker skirt, the label in ink
//   mouseGlyph(button, opts)   a little mouse, its left or right button inked
//   captionBox(text, opts)     a comic's caption: the lettering in ink on a
//                              paper box with a hand-drawn rim
// All canvases are drawn once (per text), at device pixels x2 for crispness.
export const LETTER_FONT = '"Avenir Next Condensed", "Avenir Next", "Arial Narrow", "Helvetica Neue", sans-serif';
const TYPE = '"American Typewriter", "Courier New", monospace';

// glyphs laid out one by one; returns { canvas, w, h } in CSS pixels
export function letterCanvas(text, { size = 22, color = '#f2f0ea', weight = 600, spacing = 0.08, seed = null, jitter = 1, scale = 2 } = {}) {
  const T = String(text).toUpperCase();
  const rng = new RNG(seed ?? hashSeed(T));
  const font = `${weight} ${size * scale}px ${LETTER_FONT}`;
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const glyphs = [];
  let x = 0;
  for (const ch of T) {
    const w = m.measureText(ch).width;
    glyphs.push({ ch, x, w, r: rng.gauss() * 0.035 * jitter, dy: rng.gauss() * size * 0.03 * scale * jitter, sx: 1 + rng.gauss() * 0.035 * jitter });
    x += w + size * scale * spacing;
  }
  const pad = size * scale * 0.35;
  const W = Math.ceil(x + pad * 2), H = Math.ceil(size * scale * 1.5);
  const c = document.createElement('canvas');
  c.width = Math.max(2, W); c.height = H;
  const g = c.getContext('2d');
  g.font = font; g.fillStyle = color; g.textBaseline = 'middle';
  for (const q of glyphs) {
    g.save();
    g.translate(pad + q.x + q.w / 2, H / 2 + q.dy);
    g.rotate(q.r);
    g.scale(q.sx, 1);
    g.fillText(q.ch, -q.w / 2, 0);
    g.restore();
  }
  c.style.width = (W / scale) + 'px'; c.style.height = (H / scale) + 'px';
  return { canvas: c, w: W / scale, h: H / scale };
}

// a rounded rect with a slightly wobbly edge (a hand's line)
function wobblyRect(g, x, y, w, h, r, rng, wob = 1) {
  const pts = [];
  const seg = (ax, ay, bx, by, n) => { for (let i = 0; i < n; i++) { const u = i / n; pts.push([ax + (bx - ax) * u + rng.gauss() * 0.35 * wob, ay + (by - ay) * u + rng.gauss() * 0.35 * wob]); } };
  const arc = (cx, cy, a0) => { for (let i = 0; i < 4; i++) { const a = a0 + (i / 4) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  seg(x + r, y, x + w - r, y, 6); arc(x + w - r, y + r, -Math.PI / 2);
  seg(x + w, y + r, x + w, y + h - r, 3); arc(x + w - r, y + h - r, 0);
  seg(x + w - r, y + h, x + r, y + h, 6); arc(x + r, y + h - r, Math.PI / 2);
  seg(x, y + h - r, x, y + r, 3); arc(x + r, y + r, Math.PI);
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
}

// a key cap: [E], [SPACE], [C], [CTRL] ...; h in CSS pixels
export function keyCap(label, { h = 38, scale = 2 } = {}) {
  const L = String(label).toUpperCase();
  const rng = new RNG(hashSeed('cap:' + L));
  const fs = L.length > 3 ? 12 : L.length > 1 ? 14 : 17;
  const m = document.createElement('canvas').getContext('2d');
  m.font = `700 ${fs * scale}px ${TYPE}`;
  const tw = m.measureText(L).width / scale;
  const w = Math.max(h, Math.round(tw + 26));
  const c = document.createElement('canvas');
  const W = (w + 8) * scale, H = (h + 8) * scale;
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  // the skirt: the cap's lower side, in ink (a key stands up off the board)
  g.fillStyle = '#060606';
  wobblyRect(g, 4, 6, w, h - 2, 7, rng);
  g.fill();
  // the face: paper, a little narrower and up off the skirt
  g.fillStyle = '#eeebe3';
  wobblyRect(g, 6.5, 4.5, w - 5, h - 9, 6, rng);
  g.fill();
  // the rim: one brush line round the face
  g.strokeStyle = '#060606'; g.lineWidth = 2.2; g.lineJoin = 'round';
  wobblyRect(g, 6.5, 4.5, w - 5, h - 9, 6, rng, 1.4);
  g.stroke();
  g.fillStyle = '#080808';
  g.font = `700 ${fs}px ${TYPE}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(L, 4 + w / 2, 4 + (h - 9) / 2 + 1.5);
  c.style.width = (w + 8) + 'px'; c.style.height = (h + 8) + 'px';
  return c;
}

// a mouse with one button inked (button 'L' | 'R'); h in CSS pixels
export function mouseGlyph(button = 'L', { h = 40, scale = 2 } = {}) {
  const w = Math.round(h * 0.68);
  const c = document.createElement('canvas');
  c.width = (w + 8) * scale; c.height = (h + 8) * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  const rng = new RNG(button === 'L' ? 711 : 712);
  const x0 = 4, y0 = 4, rx = w / 2, cx = x0 + rx;
  const body = () => {
    g.beginPath();
    g.moveTo(x0, y0 + rx);
    g.arc(cx, y0 + rx, rx, Math.PI, 0);
    g.lineTo(x0 + w, y0 + h - rx * 0.9);
    g.quadraticCurveTo(x0 + w, y0 + h, cx, y0 + h);
    g.quadraticCurveTo(x0, y0 + h, x0, y0 + h - rx * 0.9);
    g.closePath();
  };
  g.fillStyle = '#eeebe3'; body(); g.fill();
  // the button pressed: inked
  const split = y0 + h * 0.44;
  g.save(); body(); g.clip();
  g.fillStyle = '#070707';
  if (button === 'L') g.fillRect(x0 - 1, y0 - 1, rx + 1, split - y0 + 1);
  else g.fillRect(cx, y0 - 1, rx + 2, split - y0 + 1);
  g.restore();
  g.strokeStyle = '#060606'; g.lineWidth = 2.2; g.lineJoin = 'round'; g.lineCap = 'round';
  body(); g.stroke();
  g.beginPath(); g.moveTo(x0 + 1, split + rng.gauss() * 0.3); g.lineTo(x0 + w - 1, split + rng.gauss() * 0.3); g.stroke();
  g.beginPath(); g.moveTo(cx, y0 + 1); g.lineTo(cx + rng.gauss() * 0.3, split); g.stroke();
  c.style.width = (w + 8) + 'px'; c.style.height = (h + 8) + 'px';
  return c;
}

// a comic caption: ink lettering on a paper box, its rim drawn by hand
export function captionBox(text, { size = 17, scale = 2 } = {}) {
  const L = letterCanvas(text, { size, color: '#0a0a0a', weight: 700, scale, spacing: 0.06 });
  const rng = new RNG(hashSeed('box:' + text));
  const padX = 9, padY = 4;
  const w = Math.round(L.w + padX * 2 - size * 0.5), h = Math.round(L.h + padY * 2 - size * 0.25);
  const c = document.createElement('canvas');
  c.width = (w + 6) * scale; c.height = (h + 6) * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = '#efece4';
  wobblyRect(g, 3, 3, w, h, 1.5, rng, 0.8);
  g.fill();
  g.drawImage(L.canvas, 3 + (w - L.w) / 2, 3 + (h - L.h) / 2, L.w, L.h);
  g.strokeStyle = '#050505'; g.lineWidth = 2; g.lineJoin = 'round';
  wobblyRect(g, 3, 3, w, h, 1.5, rng, 1.2);
  g.stroke();
  c.style.width = (w + 6) + 'px'; c.style.height = (h + 6) + 'px';
  return { canvas: c, w: w + 6, h: h + 6 };
}

// an ink strike through a line of type: one quick stroke, pressed at the
// start, lifting off at the end (w x h CSS pixels, paper white)
export function strikeStroke(w, h = 10, seed = 3, col = [238, 236, 230]) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d');
  const rng = new RNG(seed);
  g.scale(2, 2);
  g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
  const y0 = h * 0.58, y1 = h * 0.42;
  g.beginPath();
  g.moveTo(1, y0 - 1.6);
  g.quadraticCurveTo(w * 0.5, (y0 + y1) / 2 - 2.2 + rng.gauss() * 0.4, w - 1, y1 - 0.4);
  g.lineTo(w - 1, y1 + 0.5);
  g.quadraticCurveTo(w * 0.5, (y0 + y1) / 2 + 1.2, 1, y0 + 1.7);
  g.closePath();
  g.fill();
  blob(g, 2.2, y0, 2.0, rng, 0.2);
  frayEdges(c, col, new RNG(seed + 1), 24, { horiz: 0.9 });
  c.style.width = w + 'px'; c.style.height = h + 'px';
  return c;
}
