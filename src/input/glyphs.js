import { RNG } from '../util/rng.js';
import { hashSeed } from '../ui/inkArt.js';

// [C12] The pad's glyphs, drawn in the kit's ink (docs/story/briefs/C12_PAD.md
// §4): the face buttons as paper discs with an ink rim and the PlayStation
// shape brushed in the middle (cross, circle, square, triangle); the
// shoulders as paper tabs lettered L1 / R1 (a trigger's top curved: L2 / R2);
// a stick as a disc with a ring, its letter and, for a direction, a small
// inked arrow; the options button as a pill with its three lines; the d-pad
// as a cross with one arm inked. One table maps a key token of the kit's
// ('[SPACE]', '[LMB]', 'E') to the glyph that stands for it on the pad,
// by context (a fist fight: each trigger the fist on its side; the car: the
// triggers are the pedals and L1 leans out to aim).
//   padGlyph(id, { h })          -> canvas (CSS size set), drawn once per id and size
//   glyphOf(token, ctx)          -> glyph id | null (null: no pad equivalent)
//   wordsFor(text, ctx)          the few card words that name a mouse button
//   keyNodes(label, ctx, h)      -> [node]: a prompt's key part as glyphs (words kept)
const TYPE = '"American Typewriter", "Courier New", monospace';
const PAPER = '#eeebe3', INK = '#060606';

// the key token -> the pad's glyph, by context ('play' | 'brawl' | 'drive' | 'table')
const BASE = {
  SPACE: 'cross', ENTER: 'cross', E: 'square', C: 'circle', CTRL: 'circle', R: 'triangle',
  SHIFT: 'L1', F: 'R1', Q: 'dleft', M: 'ddown', ESC: 'options', TAB: 'touch',
  LMB: 'R2', RMB: 'L2', MOUSE: 'Rstick', W: 'Lup', S: 'Ldown', A: 'Lleft', D: 'Lright', WASD: 'Lstick',
};
const BY_CTX = {
  // (the fist fight: LMB is the left fist, RMB the right - each trigger the fist on its side)
  brawl: { LMB: 'L2', RMB: 'R2' },
  // (the car: R2 the throttle, L2 the brake, L1 leans out to aim, R2 fires while leaning)
  drive: { W: 'R2', S: 'L2', RMB: 'L1', LMB: 'R2' },
};
export function glyphOf(token, ctx = 'play') {
  const T = String(token).toUpperCase().replace(/\s+/g, '');
  const C = BY_CTX[ctx];
  return (C && C[T]) || BASE[T] || null;
}
// (the card words that name a mouse button: said as the pad's)
export function wordsFor(text, ctx = 'play') {
  const L = ctx === 'brawl' ? 'L2' : 'R2', R = ctx === 'brawl' ? 'R2' : 'L2';
  return String(text).replace(/LEFT CLICK/g, L).replace(/RIGHT CLICK/g, R).replace(/\bclick to\b/gi, 'press to');
}

// a hand's line round a closed path of points (a little wobble)
function wob(rng, pts, k = 0.35) { return pts.map(([x, y]) => [x + rng.gauss() * k, y + rng.gauss() * k]); }
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
function circlePts(cx, cy, r, n = 28) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
function roundRectPts(x, y, w, h, r, top = 0) {
  // (top > 0: the top edge bowed up by `top` - a trigger)
  const p = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + (i / 4) * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  for (let i = 0; i <= 8; i++) { const u = i / 8; p.push([x + r + (w - 2 * r) * u, y - top * Math.sin(Math.PI * u)]); }
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return p;
}

const CACHE = new Map();
// a glyph's canvas; h in CSS pixels (a cap's height, as the kit's keyCap)
export function padGlyph(id, { h = 44, scale = 2 } = {}) {
  const key = id + ':' + h;
  const src = CACHE.get(key) || draw(id, h, scale);
  CACHE.set(key, src);
  // (each use its own canvas: one canvas cannot stand in two places)
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  c.style.width = src.style.width; c.style.height = src.style.height;
  c.dataset.glyph = id;
  return c;
}

function draw(id, hCss, scale) {
  // (drawn at the cap's own size, 44, and scaled: a small glyph keeps its proportions)
  const h = 44, k = hCss / h;
  const rng = new RNG(hashSeed('pad:' + id));
  const shoulder = /^[LR][12]$/.test(id);
  const pill = id === 'options' || id === 'touch';
  const w = shoulder ? Math.round(h * 1.22) : pill ? Math.round(h * 1.1) : h;
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + 8) * scale * k); c.height = Math.ceil((h + 8) * scale * k);
  const g = c.getContext('2d');
  g.scale(scale * k, scale * k);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const cx = 4 + w / 2, cy = 4 + h / 2;
  if (shoulder) {
    const trig = id[1] === '2';
    const top = trig ? h * 0.13 : 0;
    // the skirt (ink), the face (paper), the rim
    g.fillStyle = INK; poly(g, wob(rng, roundRectPts(4, 6 + top, w, h - 2 - top, 7, top))); g.fill();
    g.fillStyle = PAPER; poly(g, wob(rng, roundRectPts(6.5, 4.5 + top, w - 5, h - 9 - top, 6, top))); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.2; poly(g, wob(rng, roundRectPts(6.5, 4.5 + top, w - 5, h - 9 - top, 6, top), 0.5)); g.stroke();
    g.fillStyle = '#080808';
    g.font = `700 ${Math.round(h * 0.36)}px ${TYPE}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(id, cx, 4 + top / 2 + (h - 9) / 2 + 1.5);
  } else if (pill) {
    const ph = h * 0.62, py = cy - ph / 2;
    g.fillStyle = INK; poly(g, wob(rng, roundRectPts(4, py + 2, w, ph, ph / 2))); g.fill();
    g.fillStyle = PAPER; poly(g, wob(rng, roundRectPts(6, py, w - 4, ph - 3, (ph - 3) / 2))); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; poly(g, wob(rng, roundRectPts(6, py, w - 4, ph - 3, (ph - 3) / 2), 0.4)); g.stroke();
    g.lineWidth = 2.4;
    if (id === 'options') for (let i = -1; i <= 1; i++) { const y = cy - 1.2 + i * ph * 0.17; g.beginPath(); g.moveTo(cx - w * 0.17, y + rng.gauss() * 0.3); g.lineTo(cx + w * 0.17, y + rng.gauss() * 0.3); g.stroke(); }
    else { g.strokeRect(cx - w * 0.2, cy - ph * 0.22, w * 0.4, ph * 0.36); }
  } else {
    // a disc: the skirt, the face, the rim
    const r = h / 2 - 3;
    g.fillStyle = INK; poly(g, wob(rng, circlePts(cx, cy + 2, r + 1))); g.fill();
    g.fillStyle = PAPER; poly(g, wob(rng, circlePts(cx, cy, r - 1.5))); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.2; poly(g, wob(rng, circlePts(cx, cy, r - 1.5), 0.5)); g.stroke();
    const s = r * 0.5;   // the shape's half size
    g.lineWidth = Math.max(2.4, h * 0.075);
    if (id === 'cross') {
      g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx + s + rng.gauss() * 0.4, cy + s); g.stroke();
      g.beginPath(); g.moveTo(cx + s, cy - s); g.lineTo(cx - s, cy + s + rng.gauss() * 0.4); g.stroke();
    } else if (id === 'circle') {
      poly(g, wob(rng, circlePts(cx, cy, s * 1.02, 22), 0.3)); g.stroke();
    } else if (id === 'square') {
      poly(g, wob(rng, [[cx - s * 0.92, cy - s * 0.92], [cx + s * 0.92, cy - s * 0.92], [cx + s * 0.92, cy + s * 0.92], [cx - s * 0.92, cy + s * 0.92]], 0.3)); g.stroke();
    } else if (id === 'triangle') {
      poly(g, wob(rng, [[cx, cy - s * 1.05], [cx + s * 1.05, cy + s * 0.78], [cx - s * 1.05, cy + s * 0.78]], 0.3)); g.stroke();
    } else if (id[0] === 'd') {
      // the d-pad: a cross, the arm pressed inked solid
      const a = s * 0.42, L = s * 1.15;
      const arm = { dup: [0, -1], ddown: [0, 1], dleft: [-1, 0], dright: [1, 0] }[id] || [0, 0];
      g.lineWidth = 1.8;
      poly(g, [[cx - a, cy - L], [cx + a, cy - L], [cx + a, cy - a], [cx + L, cy - a], [cx + L, cy + a], [cx + a, cy + a], [cx + a, cy + L], [cx - a, cy + L], [cx - a, cy + a], [cx - L, cy + a], [cx - L, cy - a], [cx - a, cy - a]]);
      g.stroke();
      g.fillStyle = INK;
      const ax = cx + arm[0] * (L + a) / 2, ay = cy + arm[1] * (L + a) / 2;
      g.fillRect(ax - (arm[0] ? (L - a) / 2 : a), ay - (arm[1] ? (L - a) / 2 : a), arm[0] ? L - a : 2 * a, arm[1] ? L - a : 2 * a);
    } else if (id[0] === 'L' || id[0] === 'R') {
      // a stick: a ring, its letter; a direction: a small arrow at the rim
      g.lineWidth = 1.6;
      poly(g, wob(rng, circlePts(cx, cy, r * 0.62, 22), 0.25)); g.stroke();
      g.fillStyle = '#080808';
      g.font = `700 ${Math.round(h * 0.3)}px ${TYPE}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(id[0], cx, cy + 1);
      const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[id.slice(1)];
      if (dir) {
        const tx = cx + dir[0] * r * 0.86, ty = cy + dir[1] * r * 0.86, px = -dir[1], py = dir[0], k = r * 0.3;
        g.beginPath(); g.moveTo(tx + dir[0] * k * 0.6, ty + dir[1] * k * 0.6); g.lineTo(tx - dir[0] * k * 0.5 + px * k, ty - dir[1] * k * 0.5 + py * k); g.lineTo(tx - dir[0] * k * 0.5 - px * k, ty - dir[1] * k * 0.5 - py * k); g.closePath(); g.fill();
      }
    }
  }
  c.style.width = ((w + 8) * k).toFixed(1) + 'px'; c.style.height = ((h + 8) * k).toFixed(1) + 'px';
  return c;
}

// a prompt's key part ('E', 'hold LMB', 'A D') as nodes: each token with a
// pad glyph drawn, any other word kept as text
export function keyNodes(label, ctx, h = 30) {
  const out = [];
  for (const t of String(label).split(/\s+/).filter(Boolean)) {
    const id = glyphOf(t, ctx);
    if (id) out.push(padGlyph(id, { h }));
    else { const s = document.createElement('span'); s.textContent = t; s.style.margin = '0 4px'; out.push(s); }
  }
  return out;
}

// the rulebook's keys for the pad (WAVE_C §2), one line each for the title
// and the pause card: [glyph(s), words]
export const PAD_KEYS = [
  [['Lstick'], 'move'], [['Rstick'], 'look'], [['square'], 'use'], [['R2'], 'fire, jab'], [['L2'], 'steady, other fist'],
  [['cross'], 'block, vault'], null,
  [['Lleft', 'Lright'], 'dodge'], [['circle'], 'get low'], [['triangle'], 'reload'], [['L1'], 'run'], [['R1'], 'smoke'], [['dleft'], 'toys, horn'], [['options'], 'pause'],
];
// the line as nodes into `el` (two rows, glyphs small)
export function fillPadKeys(el, h = 20) {
  el.textContent = '';
  let row = document.createElement('div');
  const flush = () => { el.appendChild(row); row = document.createElement('div'); };
  PAD_KEYS.forEach((it) => {
    if (!it) { flush(); return; }
    const span = document.createElement('span');
    span.style.cssText = 'display:inline-flex;align-items:center;gap:2px;margin:0 9px;white-space:nowrap;';
    for (const id of it[0]) { const g = padGlyph(id, { h }); g.style.verticalAlign = 'middle'; span.appendChild(g); }
    const t = document.createElement('span'); t.textContent = ' ' + it[1]; span.appendChild(t);
    row.appendChild(span);
  });
  flush();
}
