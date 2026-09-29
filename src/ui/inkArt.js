import { RNG } from '../util/rng.js';

// The HUD's ink, laid down on canvases once (Phase 3b cards, story pass):
//   drawInkSplat / blob      the cards' splats (the title, the end)
//   frayEdges                a sheet's edge re-thresholded against the ink
//                            pass's own dry-brush field, so every lobe ends
//                            in bristle marks, not a vector curve
//   makeTornStroke(w, h, seed)   the subtitle's ground: one loaded brush
//                            dragged left to right, torn at both ends
//   makeKeyDab(seed)         the dab of ink a prompt's key letter sits on
//   makeTick(seed)           the brush tick a prompt puts on its thing
// Every one is seeded: the same text always gets the same stroke.

// The dry-brush field as bytes (read once; null without a brush)
let BRUSH = null;
export function setBrush(img) { BRUSH = img ? readBrush(img) : null; }
function readBrush(img) {
  try {
    const n = img.width;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return { n, d: g.getImageData(0, 0, n, n).data };
  } catch (e) { return null; }
}

// Fray a splat's edge like the fireball's and the smoke's (Phase 3b review:
// the canvas lobes printed as smooth vector curves). The sheet's alpha is
// softened a few pixels and re-thresholded against the brush field (two
// octaves, jittered per sheet, the diagonal family inside the blot, the
// horizontal one along the drags): where the field is strong the ink
// reaches past the old edge in dry-brush streaks, where it is weak the
// paper bites into it, so every lobe ends in bristle marks, not a curve.
// (horiz: the horizontal family leads - a stroke dragged sideways)
export function frayEdges(cv, rgb, rng, R, { horiz = 0.4 } = {}) {
  if (!BRUSH) return;
  const w = cv.width, h = cv.height;
  const g = cv.getContext('2d');
  const src = g.getImageData(0, 0, w, h);
  // the softened alpha: the band where the brush decides
  const b = document.createElement('canvas');
  b.width = w; b.height = h;
  const bg = b.getContext('2d');
  const blur = Math.max(1.5, R * 0.022);
  bg.filter = `blur(${blur.toFixed(1)}px)`;
  bg.drawImage(cv, 0, 0);
  const soft = bg.getImageData(0, 0, w, h).data;
  const { n, d } = BRUSH;
  const s0 = rng.range(0.55, 0.75), s1 = s0 * rng.range(1.9, 2.3);
  const ox0 = Math.floor(rng.next() * n), oy0 = Math.floor(rng.next() * n);
  const ox1 = Math.floor(rng.next() * n), oy1 = Math.floor(rng.next() * n);
  const out = src.data;
  const dg = 1 - horiz;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const a = soft[k + 3] / 255;
      if (a <= 0.004 || (a >= 0.996 && out[k + 3] === 255)) { if (a <= 0.004) out[k + 3] = 0; continue; }
      const i0 = ((((y * s0 + oy0) | 0) % n) * n + (((x * s0 + ox0) | 0) % n)) * 4;
      const i1 = ((((y * s1 + oy1) | 0) % n) * n + (((x * s1 + ox1) | 0) % n)) * 4;
      // diagonal strokes, with the horizontal family mixed in (the drags)
      const f = (d[i0] * dg + d[i0 + 2] * horiz) * 0.6 / 255 + (d[i1] * 0.5 + d[i1 + 2] * 0.5) * 0.4 / 255;
      // (half the sheet's own alpha: a thin spike or drag keeps its body
      // and frays along its sides instead of melting into the blur)
      const v = 0.5 * (a + out[k + 3] / 255) + (f - 0.5) * 0.85;
      const t = Math.min(1, Math.max(0, (v - 0.44) / 0.12));
      out[k] = rgb[0]; out[k + 1] = rgb[1]; out[k + 2] = rgb[2];
      out[k + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  g.putImageData(src, 0, 0);
}

// An ink splatter, as a loaded brush and a flicked pen leave it: a blot of
// overlapping ragged lobes along a flattened ellipse (the lettering sits on
// it), dry-brush drags pulled out left and right whose bristles run dry,
// spikes flung out of the blot each ending in a drop, satellite drops
// thinning with distance, and a few drips running down from the bottom.
export function drawInkSplat(g, cx, cy, R, rng, col, { wide = 4, spikes = 30, drops = 80, drags = 1, drips = 4, spikeLen = 1 } = {}) {
  g.save();
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const half = R * wide * 0.5;           // half-length of the blot
  const nL = Math.max(3, Math.round(wide * 3));
  for (let i = 0; i < nL; i++) {
    const t = i / (nL - 1) - 0.5;         // -0.5 .. 0.5 along
    const x = cx + t * half * 1.7 + rng.gauss() * R * 0.06;
    const y = cy + rng.gauss() * R * 0.1;
    // (the ends taper: a stroke of the loaded brush, not a sausage)
    const r = R * (0.3 + 0.6 * Math.pow(Math.cos(t * Math.PI), 0.8)) * rng.range(0.8, 1.12);
    blob(g, x, y, r, rng, 0.18);
  }
  blob(g, cx, cy, R * 0.95, rng, 0.1);
  // splash lobes where the ink hit hardest: fat bulges pushed out of the
  // rim, and a fringe of small blots breaking the rim's line
  const rimAt = (a) => 1 / Math.sqrt((Math.cos(a) / (half * 0.85)) ** 2 + (Math.sin(a) / (R * 0.78)) ** 2);
  for (let i = 0; i < 9; i++) {
    const a = rng.next() * Math.PI * 2, rr = rimAt(a);
    blob(g, cx + Math.cos(a) * rr * 0.95, cy + Math.sin(a) * rr * 0.95, R * rng.range(0.16, 0.34), rng, 0.3);
  }
  for (let i = 0; i < 70; i++) {
    const a = rng.next() * Math.PI * 2, rr = rimAt(a) * rng.range(0.96, 1.08);
    blob(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, R * rng.range(0.03, 0.1), rng, 0.35);
  }
  // dry-brush drags off both ends
  for (let side = -1; side <= 1; side += 2) {
    const n = Math.round(110 * drags);
    for (let i = 0; i < n; i++) {
      const dy = rng.gauss() * R * 0.3;
      const y0 = cy + dy;
      const x0 = cx + side * half * rng.range(0.6, 0.8);
      const len = R * rng.range(0.4, 1.4) * Math.max(0.15, 1 - Math.abs(dy) / (R * 0.8));
      const dryAt = rng.range(0.35, 0.85);
      g.lineWidth = rng.range(1.4, 4.5);
      g.globalAlpha = rng.range(0.75, 1);
      g.beginPath();
      g.moveTo(x0, y0);
      let drawing = true;
      for (let k = 1; k <= 20; k++) {
        const u = k / 20;
        const x = x0 + side * len * u, y = y0 + Math.sin(u * 2.4) * R * 0.03 + rng.gauss() * 0.5;
        const skip = u > dryAt && rng.next() < (u - dryAt) * 2.6;
        if (skip) { drawing = false; g.moveTo(x, y); } else if (!drawing) { drawing = true; g.moveTo(x, y); } else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  // spikes flung out of the blot, each tapering to a drop
  for (let i = 0; i < spikes; i++) {
    const a = rng.next() * Math.PI * 2;
    const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
    // start on the blot's rim (an ellipse half x R*0.9)
    const rim = 1 / Math.sqrt((ux / (half * 0.85)) ** 2 + (uy / (R * 0.8)) ** 2);
    const len = R * rng.range(0.25, 0.95) * spikeLen * (rng.next() < 0.25 ? 1.6 : 1);
    const w0 = R * rng.range(0.03, 0.075);
    const bx = cx + ux * rim * 0.92, by = cy + uy * rim * 0.92;
    const tx = bx + ux * len, ty = by + uy * len;
    g.beginPath();
    g.moveTo(bx + px * w0, by + py * w0);
    g.quadraticCurveTo(bx + ux * len * 0.6 + px * w0 * 0.25, by + uy * len * 0.6 + py * w0 * 0.25, tx, ty);
    g.quadraticCurveTo(bx + ux * len * 0.6 - px * w0 * 0.25, by + uy * len * 0.6 - py * w0 * 0.25, bx - px * w0, by - py * w0);
    g.fill();
    if (rng.next() < 0.7) blob(g, tx + ux * w0 * 1.5, ty + uy * w0 * 1.5, w0 * rng.range(0.9, 1.7), rng, 0.25);
  }
  // satellite drops
  for (let i = 0; i < drops; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.range(1.05, 1.9);
    const x = cx + Math.cos(a) * half * 0.9 * d, y = cy + Math.sin(a) * R * 0.9 * d;
    const r = (R * 0.06 * Math.pow(rng.next(), 1.6)) / d + 1.3;
    blob(g, x, y, r, rng, 0.3);
  }
  // drips off the bottom
  for (let i = 0; i < drips; i++) {
    const x = cx + rng.range(-0.55, 0.55) * half;
    const y0 = cy + R * rng.range(0.4, 0.6);
    const len = R * rng.range(0.25, 0.75);
    const w = R * rng.range(0.022, 0.04);
    g.beginPath();
    g.moveTo(x - w, y0);
    g.quadraticCurveTo(x - w * 0.5, y0 + len * 0.7, x - w * 0.35, y0 + len);
    g.arc(x, y0 + len, w * 0.9, Math.PI, 0, true);
    g.quadraticCurveTo(x + w * 0.5, y0 + len * 0.7, x + w, y0);
    g.fill();
  }
  g.restore();
}
export function blob(g, x, y, r, rng, jag = 0.2) {
  const n = 18 + Math.round(r / 6);
  const ph = rng.next() * 6.28;
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * (1 + jag * (0.6 * Math.sin(a * 3 + ph) * rng.next() + 0.5 * (rng.next() - 0.5)));
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
}

// a seed from a string (the same line always gets the same stroke)
export function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}

// One loaded brush dragged left to right under a line of type: the body is
// a band whose top and bottom edges wander (the bristles' load), fattest a
// third of the way in where the brush was pressed; the start is a blunt
// pressed-down end, the far end runs dry into separate bristle drags and
// tears off; a few flecks thrown past it. Frayed against the brush field,
// horizontal family first. w, h: the canvas (the stroke fills ~86 % of h).
export function makeTornStroke(w, h, seed, col = [5, 5, 5]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const rng = new RNG(seed);
  const css = `rgb(${col[0]},${col[1]},${col[2]})`;
  g.fillStyle = css; g.strokeStyle = css;
  const cy = h * 0.5, H = h * 0.36;          // half-height of the body
  const x0 = h * 0.35, x1 = w - h * 0.9;       // the body's run (the drags go on past x1)
  const N = 48;
  const top = [], bot = [];
  let wt = 0, wb = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // pressure: up fast, fat at a third, easing off toward the end
    const p = Math.min(1, u / 0.06) * (0.82 + 0.18 * Math.sin(Math.min(1, u / 0.33) * Math.PI * 0.5)) * (1 - 0.18 * Math.max(0, u - 0.6) / 0.4);
    wt += rng.gauss() * 0.05; wt *= 0.85; wb += rng.gauss() * 0.05; wb *= 0.85;
    const x = x0 + (x1 - x0) * u;
    top.push([x, cy - H * p * (1 + wt) + Math.sin(u * 5.1 + seed) * h * 0.02]);
    bot.push([x, cy + H * p * (1 + wb) + Math.sin(u * 4.3 + seed * 0.7) * h * 0.02]);
  }
  g.beginPath();
  // the blunt start: a pressed, slightly squared blot
  g.moveTo(top[0][0], top[0][1]);
  for (const [x, y] of top) g.lineTo(x, y);
  for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
  g.quadraticCurveTo(x0 - h * 0.28, cy + rng.gauss() * h * 0.04, top[0][0], top[0][1]);
  g.fill();
  blob(g, x0 + h * 0.05, cy + rng.gauss() * h * 0.03, H * 0.95, rng, 0.25);
  // the bristles running dry past the end: separate drags, thinning, torn
  g.lineCap = 'round';
  const nB = Math.round(h * 0.9);
  for (let i = 0; i < nB; i++) {
    const v = (i / (nB - 1)) * 2 - 1;                  // -1 .. 1 across the brush
    const y0 = cy + v * H * 0.92 + rng.gauss() * h * 0.015;
    const xs = x1 - (x1 - x0) * rng.range(0.02, 0.25);
    const len = h * rng.range(0.4, 1.5) * (1 - 0.45 * Math.abs(v));
    const dryAt = rng.range(0.2, 0.7);
    g.lineWidth = rng.range(0.8, 2.6);
    g.globalAlpha = rng.range(0.7, 1);
    g.beginPath(); g.moveTo(xs, y0);
    let drawing = true;
    for (let k = 1; k <= 16; k++) {
      const u = k / 16;
      const x = xs + (x1 - xs + len) * u, y = y0 + Math.sin(u * 2.2) * h * 0.03 * v + rng.gauss() * 0.4;
      const skip = u > dryAt && rng.next() < (u - dryAt) * 2.4;
      if (skip) { drawing = false; g.moveTo(x, y); } else if (!drawing) { drawing = true; g.moveTo(x, y); } else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  // flecks thrown off the end and a couple bitten out of the body
  for (let i = 0; i < 7; i++) blob(g, x1 + h * rng.range(0.2, 0.85), cy + rng.gauss() * H * 0.8, h * rng.range(0.012, 0.035), rng, 0.3);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) blob(g, x0 + (x1 - x0) * rng.range(0.1, 0.95), cy + (rng.next() < 0.5 ? -1 : 1) * H * rng.range(0.75, 1.0), h * rng.range(0.02, 0.05), rng, 0.4);
  g.globalCompositeOperation = 'source-over';
  frayEdges(c, col, new RNG(seed + 17), h * 1.4, { horiz: 0.8 });
  return c;
}

// the dab of ink under a prompt's key letter: a squat pressed blot
export function makeKeyDab(seed = 5, size = 44, col = [5, 5, 5]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rng = new RNG(seed);
  g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
  blob(g, size / 2, size / 2, size * 0.34, rng, 0.22);
  for (let i = 0; i < 3; i++) blob(g, size / 2 + rng.gauss() * size * 0.08, size / 2 + rng.gauss() * size * 0.06, size * rng.range(0.18, 0.26), rng, 0.3);
  frayEdges(c, col, new RNG(seed + 3), size * 0.8);
  return c;
}

// the tick a prompt puts on its thing: a short brush stroke pulled down
// and to the right, pressed at the start, lifting off in a thin tail;
// paper white with an ink edge so it reads on the counter and in the dark
export function makeTick(seed = 9, size = 26) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rng = new RNG(seed);
  const stroke = (col, grow) => {
    g.fillStyle = col;
    g.beginPath();
    const ax = size * 0.3, ay = size * 0.3, bx = size * 0.72, by = size * 0.7;
    const w0 = size * 0.12 + grow, w1 = size * 0.025 + grow * 0.6;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), px = -dy / L, py = dx / L;
    g.moveTo(ax + px * w0, ay + py * w0);
    g.quadraticCurveTo((ax + bx) / 2 + px * w0 * 0.6 + rng.gauss() * 0.3, (ay + by) / 2 + py * w0 * 0.6, bx + px * w1, by + py * w1);
    g.lineTo(bx + dx / L * w1, by + dy / L * w1);
    g.lineTo(bx - px * w1, by - py * w1);
    g.quadraticCurveTo((ax + bx) / 2 - px * w0 * 0.6, (ay + by) / 2 - py * w0 * 0.6, ax - px * w0, ay - py * w0);
    g.closePath();
    g.fill();
    blob(g, ax, ay, w0 * 1.05, rng, 0.2);
  };
  stroke('rgba(5,5,5,0.9)', size * 0.06);
  stroke('#f2f0ea', 0);
  return c;
}
