import * as THREE from 'three';
import { RNG, clamp } from '../util/rng.js';

// Every texture in the game is generated here at startup from a seeded RNG:
// no image assets, and the same pixels on every load.

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Draw `fn` at the 3x3 wrapped copies that touch the tile, so the texture is
// seamless when repeated. Randomness must be decided BEFORE calling this.
function wrapDraw(w, h, x, y, reach, fn) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const px = x + ox * w, py = y + oy * h;
      if (px + reach < 0 || px - reach > w || py + reach < 0 || py - reach > h) continue;
      fn(px, py);
    }
  }
}

// Remap one channel so its histogram is uniform. A threshold map must be
// uniform, otherwise thresholding it would shift the tone of the image.
function equalizeChannel(data, ch) {
  const n = data.length / 4;
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[data[i * 4 + ch]]++;
  const map = new Uint8Array(256);
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    const mid = acc + hist[v] * 0.5;
    acc += hist[v];
    map[v] = Math.round(clamp(mid / n, 0, 1) * 255);
  }
  for (let i = 0; i < n; i++) data[i * 4 + ch] = map[data[i * 4 + ch]];
}

// ---------------------------------------------------------------------------
// Dry-brush threshold field.
// Each stroke is drawn OPAQUE with its own random value, as a bundle of bristle
// lines with gaps. Thresholding the field at level f reveals, whole, every
// stroke whose value is below f: as a tone gets lighter, strokes are added one
// by one, exactly like an inker laying down dry-brush. Gaps between bristles
// show older strokes underneath, which gives the broken dry-brush edge.
// ---------------------------------------------------------------------------
function strokeField(size, rng, o) {
  const c = makeCanvas(size);
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  for (let i = 0; i < o.count; i++) {
    const v = rng.next();
    const x = rng.next() * size, y = rng.next() * size;
    const a = o.angle + rng.gauss() * o.jitter;
    const L = rng.range(o.len[0], o.len[1]);
    const W = rng.range(o.width[0], o.width[1]);
    const bend = rng.gauss() * o.curve * L;
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const nb = 3 + Math.floor(W / 2.0);
    const bristles = [];
    for (let b = 0; b < nb; b++) {
      const t = b / (nb - 1) - 0.5;
      bristles.push({
        off: t * W + rng.gauss() * 0.6,
        skip: rng.next() < 0.22,
        v: clamp(v + rng.gauss() * 0.025, 0, 1),
        lw: rng.range(0.9, 2.6),
        s0: rng.range(0.0, 0.22) + Math.abs(t) * 0.15,
        s1: rng.range(0.72, 1.0) - Math.abs(t) * 0.2,
        taper: rng.range(0.45, 0.85),
      });
    }
    wrapDraw(size, size, x, y, L + W, (px, py) => {
      for (const B of bristles) {
        if (B.skip) continue;
        const g8 = Math.round(B.v * 255);
        g.strokeStyle = `rgb(${g8},${g8},${g8})`;
        g.lineWidth = B.lw;
        const sx = px + dx * L * (B.s0 - 0.5) + nx * B.off;
        const sy = py + dy * L * (B.s0 - 0.5) + ny * B.off;
        const ex = px + dx * L * (B.s1 - 0.5) + nx * B.off * B.taper;
        const ey = py + dy * L * (B.s1 - 0.5) + ny * B.off * B.taper;
        const cx = (sx + ex) * 0.5 + nx * bend, cy = (sy + ey) * 0.5 + ny * bend;
        g.beginPath();
        g.moveTo(sx, sy);
        g.quadraticCurveTo(cx, cy, ex, ey);
        g.stroke();
      }
    });
  }
  return g.getImageData(0, 0, size, size);
}

export function makeBrushTexture(seed = 11, size = 1024) {
  const rng = new RNG(seed);
  const s = size / 1024;
  // R: diagonal strokes (figures, cars, general), G: near-vertical (walls, columns),
  // B: near-horizontal (ground, deck undersides).
  const fam = [
    { angle: -1.05, jitter: 0.22, len: [50 * s, 170 * s], width: [7 * s, 22 * s], curve: 0.12, count: 3800 },
    { angle: -1.52, jitter: 0.08, len: [70 * s, 220 * s], width: [5 * s, 16 * s], curve: 0.05, count: 3600 },
    { angle: -0.06, jitter: 0.10, len: [60 * s, 200 * s], width: [5 * s, 16 * s], curve: 0.06, count: 3600 },
  ];
  const out = new ImageData(size, size);
  fam.forEach((f, ch) => {
    const img = strokeField(size, rng.fork(ch + 1), f);
    for (let i = 0; i < size * size; i++) out.data[i * 4 + ch] = img.data[i * 4];
  });
  for (let i = 0; i < size * size; i++) out.data[i * 4 + 3] = 255;
  for (let ch = 0; ch < 3; ch++) equalizeChannel(out.data, ch);
  const c = makeCanvas(size);
  c.getContext('2d').putImageData(out, 0, 0);
  return screenTex(c);
}

function screenTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function worldTex(c, srgb = false) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Tileable value-noise fBm (JS side), used for the noise texture and paper.
// ---------------------------------------------------------------------------
function tileNoise(period, rng) {
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = rng.next();
  return (u, v) => { // u,v in [0,1)
    const fx = u * period, fy = v * period;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
    const sy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
    const x0 = ((ix % period) + period) % period, x1 = (x0 + 1) % period;
    const y0 = ((iy % period) + period) % period, y1 = (y0 + 1) % period;
    const a = lat[y0 * period + x0], b = lat[y0 * period + x1];
    const c = lat[y1 * period + x0], d = lat[y1 * period + x1];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}

function fbmField(size, basePeriod, octaves, rng, gain = 0.5) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(tileNoise(basePeriod << o, rng));
  const out = new Float32Array(size * size);
  let mn = 1e9, mx = -1e9;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0, amp = 1;
      for (let o = 0; o < octaves; o++) { s += layers[o](x / size, y / size) * amp; amp *= gain; }
      out[y * size + x] = s;
      if (s < mn) mn = s; if (s > mx) mx = s;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
  return out;
}

// RGBA noise: R fbm (period 8), G fbm (period 4, big blobs), B fbm (period 16),
// A fine fbm (period 32). All tile, so shaders can scale them freely.
export function makeNoiseTexture(seed = 5, size = 256) {
  const rng = new RNG(seed);
  const ch = [fbmField(size, 8, 5, rng), fbmField(size, 4, 5, rng), fbmField(size, 16, 4, rng), fbmField(size, 32, 3, rng)];
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(ch[c][i] * 255);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

// Paper: soft fibre + fine tooth. R = tooth/grain, G = fibres.
export function makePaperTexture(seed = 7, size = 512) {
  const rng = new RNG(seed);
  const tooth = fbmField(size, 64, 3, rng, 0.6);
  const c = makeCanvas(size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round((0.35 + 0.65 * tooth[i]) * 255);
    img.data[i * 4] = v; img.data[i * 4 + 1] = 128; img.data[i * 4 + 2] = 0; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // fibres into G (drawn in green only)
  g.lineCap = 'round';
  for (let i = 0; i < 2200; i++) {
    const x = rng.next() * size, y = rng.next() * size, a = rng.next() * Math.PI * 2;
    const L = rng.range(6, 38), bend = rng.gauss() * 6;
    const light = rng.next() < 0.5;
    const alpha = rng.range(0.06, 0.25), lw = rng.range(0.5, 1.3);
    wrapDraw(size, size, x, y, L, (px, py) => {
      g.strokeStyle = light ? `rgba(0,255,0,${alpha})` : `rgba(0,0,0,${alpha})`;
      g.globalCompositeOperation = 'source-over';
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(px, py);
      g.quadraticCurveTo(px + Math.cos(a) * L * 0.5 - Math.sin(a) * bend, py + Math.sin(a) * L * 0.5 + Math.cos(a) * bend,
        px + Math.cos(a) * L, py + Math.sin(a) * L);
      g.stroke();
    });
  }
  // restore R from the tooth field (fibre strokes also wrote R=0 for dark ones)
  const d = g.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    d.data[i * 4] = Math.round((0.35 + 0.65 * tooth[i]) * 255);
    d.data[i * 4 + 2] = 0; d.data[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return screenTex(c);
}

// Screen-space rain: long thin streaks leaning like the reference ('/', top to
// the right, ~12 deg), brightest at the leading (lower) end. R = intensity.
// Tiles in both directions; the ink pass scrolls it along the streak slope.
export const RAIN_SLANT = 0.22; // tan of the lean, in texture space
export function makeRainTexture(seed = 13, w = 512, h = 512) {
  const rng = new RNG(seed);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (let i = 0; i < 230; i++) {
    const x = rng.next() * w, y = rng.next() * h;
    const L = rng.range(40, 150) * (rng.next() < 0.12 ? 1.6 : 1.0);
    const a = Math.pow(rng.next(), 1.4) * 0.8 + 0.2;
    const lw = rng.range(0.6, 1.15);
    const dx = -L * RAIN_SLANT; // canvas y points down: going down, drift left
    wrapDraw(w, h, x, y, L, (px, py) => {
      const grd = g.createLinearGradient(px, py, px + dx, py + L);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.75, `rgba(255,255,255,${a})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grd;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + dx, py + L);
      g.stroke();
    });
  }
  const t = screenTex(c);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Soft, lumpy puff for steam / smoke particles (alpha in R).
export function makePuffTexture(seed = 17, size = 128) {
  const rng = new RNG(seed);
  const n = fbmField(size, 4, 4, rng);
  const c = makeCanvas(size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const fall = Math.max(0, 1 - r * r);                 // broad, soft body
      const edge = Math.max(0, 1 - r);
      const v = clamp(Math.pow(fall, 1.4) * Math.pow(edge, 0.5) * (0.45 + 0.9 * n[y * size + x]), 0, 1);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// Ink splatter: jagged central blot with spikes and satellite droplets.
// Returned as a canvas (white on transparent) for sprites / the title card.
export function drawSplatter(g, cx, cy, radius, rng, spikes = 28) {
  g.beginPath();
  const pts = spikes * 3;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    let r = radius * (0.55 + rng.next() * 0.25);
    if (i % 3 === 0 && rng.next() < 0.7) r = radius * (0.9 + Math.pow(rng.next(), 2) * 1.4);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  for (let i = 0; i < spikes * 1.5; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = radius * (1.0 + Math.pow(rng.next(), 1.5) * 1.6);
    const r = radius * rng.range(0.015, 0.08);
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * rng.range(1, 2.5), r, a, 0, Math.PI * 2);
    g.fill();
  }
}

export function makeSplatterTexture(seed = 23, size = 256) {
  const rng = new RNG(seed);
  const c = makeCanvas(size);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  drawSplatter(g, size / 2, size / 2, size * 0.22, rng);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// Wet stone for the left façade. The tile covers 12 m x 12 m (Facade.js maps
// it at 1/12): big 1 m ashlar courses whose joints are only a whisper in the
// albedo, so the wall reads as the reference's flat near-black mass carrying
// soft vertical rain-run streaks, never as a tiled block grid.
// Returns { map (sRGB albedo), bump (height: grain + streaks only, no bevels) }.
export function makeStoneTextures(seed = 29, size = 1024) {
  const rng = new RNG(seed);
  const tone = fbmField(256, 4, 4, rng);
  const map = makeCanvas(size), bump = makeCanvas(size);
  const gm = map.getContext('2d'), gb = bump.getContext('2d');
  const base = 0.34;
  // the joints are the background: ~3% darker than the average block
  const j8 = Math.round(base * 0.97 * 255);
  gm.fillStyle = `rgb(${j8},${j8},${j8})`; gm.fillRect(0, 0, size, size);
  gb.fillStyle = '#808080'; gb.fillRect(0, 0, size, size);
  const courses = 12;
  const courseH = size / courses; // 1 m courses
  for (let r = 0; r < courses; r++) {
    let x = -rng.range(0, 120);
    const y0 = r * courseH;
    while (x < size) {
      const w = rng.range(2.0, 3.4) * size / 12;
      // per-block value barely varies: the joints must not become a grid
      const v = base * rng.range(0.96, 1.04);
      const g8 = Math.round(v * 255);
      const draw = (ox) => {
        gm.fillStyle = `rgb(${g8},${g8},${g8})`;
        gm.fillRect(x + ox + 1.5, y0 + 1.5, w - 3, courseH - 3);
      };
      draw(0);
      if (x + w > size) draw(-size);
      x += w;
    }
  }
  // stone grain + broad tonal mottling
  const img = gm.getImageData(0, 0, size, size);
  const bim = gb.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = tone[((y >> 2) & 255) * 256 + ((x >> 2) & 255)];
      const fine = rng.next();
      // broad, gentle mottling: a flat wash that the ink pass leaves alone
      const v = img.data[i] * (0.9 + 0.2 * n) * (0.97 + 0.06 * fine);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = clamp(v, 0, 255);
      bim.data[i] = bim.data[i + 1] = bim.data[i + 2] = clamp(128 + (fine - 0.5) * 22 + (n - 0.5) * 40, 0, 255);
    }
  }
  gm.putImageData(img, 0, 0);
  gb.putImageData(bim, 0, 0);
  // Weathering: a FEW rain-run streaks, clustered where a low-frequency mask
  // is high (under a sill, down one pier), so ~70% of the wall stays a flat
  // wash like the reference. Each streak is a small bundle of bristles,
  // 0.3-2 m long, leaning up to +/-8 deg, at ~6% contrast: enough for the
  // ink pass to find a mark, never a uniform wood-grain.
  gm.lineCap = 'round';
  const px_m = size / 12;
  let placed = 0;
  for (let tries = 0; placed < 44 && tries < 4000; tries++) {
    const x = rng.next() * size, y = rng.next() * size;
    const mask = tone[((y >> 2) & 255) * 256 + ((x >> 2) & 255)];
    if (mask < 0.62 || rng.next() > (mask - 0.62) * 3.0) continue;
    placed++;
    const L = rng.range(0.3, 2.0) * px_m, W = rng.range(4, 18);
    const tilt = Math.tan(rng.range(-8, 8) * Math.PI / 180) * L;
    const light = rng.next() < 0.4;
    const a = rng.range(0.045, 0.075);
    const col = light ? '255,255,255' : '0,0,0';
    const nb = 2 + Math.floor(W / 5);
    const bristles = [];
    for (let b = 0; b < nb; b++) {
      bristles.push({ off: (b / Math.max(1, nb - 1) - 0.5) * W, lw: rng.range(1.0, 3.0), s0: rng.range(0, 0.25), s1: rng.range(0.55, 1.0), skip: rng.next() < 0.3 });
    }
    wrapDraw(size, size, x, y, L + W + Math.abs(tilt), (px, py) => {
      for (const B of bristles) {
        if (B.skip) continue;
        const grd = gm.createLinearGradient(px, py + L * B.s0, px, py + L * B.s1);
        grd.addColorStop(0, `rgba(${col},0)`);
        grd.addColorStop(0.2, `rgba(${col},${a})`);
        grd.addColorStop(1, `rgba(${col},0)`);
        gm.strokeStyle = grd;
        gm.lineWidth = B.lw;
        gm.beginPath();
        gm.moveTo(px + B.off + tilt * B.s0, py + L * B.s0);
        gm.lineTo(px + B.off * 0.85 + tilt * B.s1, py + L * B.s1);
        gm.stroke();
      }
    });
  }
  return { map: worldTex(map, true), bump: worldTex(bump, false) };
}

export function makeTextures(seed = 1) {
  const t0 = performance.now();
  const tex = {
    brush: makeBrushTexture(seed * 11),
    paper: makePaperTexture(seed * 7),
    rain: makeRainTexture(seed * 13),
    noise: makeNoiseTexture(seed * 5),
    puff: makePuffTexture(seed * 17),
    splatter: makeSplatterTexture(seed * 23),
    stone: makeStoneTextures(seed * 29),
  };
  tex.buildMs = performance.now() - t0;
  return tex;
}
