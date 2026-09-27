import * as THREE from 'three';
import { RNG } from '../util/rng.js';

// Canvas-generated textures for the combat effects. All are white shapes on
// transparent (alpha carries the shape); materials colour them. Everything
// is drawn like ink: jagged spikes, flung droplets, no soft CG gradients
// (except the pool field, whose grade drives its spreading edge).

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tex(c, { mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}

// jagged polygon blob: r(a) = base * noise, with occasional long spikes
function blob(g, cx, cy, R, rng, { pts = 60, spikeP = 0.25, spikeLen = 1.8, rough = 0.28, bias = null } = {}) {
  g.beginPath();
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    let r = R * (1 - rough * 0.5 + rough * rng.next());
    let k = 1;
    if (bias) k = 0.55 + 0.9 * Math.max(0, Math.cos(a - bias.a)) ** bias.p;
    if (i % 2 === 0 && rng.next() < spikeP) r = R * (1 + Math.pow(rng.next(), 1.6) * spikeLen) * k;
    else r *= 0.8 + 0.2 * k;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
}
function droplets(g, cx, cy, R, rng, n, reach = 2.2, bias = null) {
  for (let i = 0; i < n; i++) {
    let a = rng.next() * Math.PI * 2;
    if (bias && rng.next() < bias.share) a = bias.a + rng.gauss() * bias.spread;
    const d = R * (1.05 + Math.pow(rng.next(), 1.3) * reach);
    const r = R * rng.range(0.02, 0.1) * (1.4 - d / (R * (1 + reach)));
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    g.beginPath();
    g.ellipse(x, y, Math.max(0.6, r * rng.range(1, 2.4)), Math.max(0.6, r), a, 0, Math.PI * 2);
    g.fill();
    // a thin trail back toward the centre on some drops
    if (rng.next() < 0.35) {
      g.lineWidth = Math.max(0.6, r * 0.6);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - Math.cos(a) * r * rng.range(3, 7), y - Math.sin(a) * r * rng.range(3, 7));
      g.stroke();
    }
  }
}

// Muzzle flash: a white ink splatter starburst. A dense jagged core, a ring
// of long irregular spikes (some split into two), a few flung droplets.
// Seen from behind the gun it is radial; `forward` variants throw most of
// the spray one way (+x) for side views (Hood flashes seen side-on).
function drawFlash(g, S, rng, forward) {
  const cx = forward ? S * 0.3 : S / 2, cy = S / 2;
  const R = S * (forward ? 0.085 : 0.105);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const bias = forward ? { a: 0, p: 2 } : null;
  // spikes: long thin wedges
  const n = forward ? 16 : 22;
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + rng.gauss() * 0.12;
    if (forward && rng.next() < 0.6) a = rng.gauss() * 0.5;
    const len = R * (1.4 + Math.pow(rng.next(), 1.2) * (forward && Math.abs(a) < 0.8 ? 5.2 : 2.6));
    const w = R * rng.range(0.1, 0.28);
    const bend = rng.gauss() * 0.08;
    g.beginPath();
    g.moveTo(cx + Math.cos(a + Math.PI / 2) * w, cy + Math.sin(a + Math.PI / 2) * w);
    const mx = cx + Math.cos(a + bend) * len * 0.55, my = cy + Math.sin(a + bend) * len * 0.55;
    g.quadraticCurveTo(mx + Math.cos(a + Math.PI / 2) * w * 0.4, my + Math.sin(a + Math.PI / 2) * w * 0.4, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    g.quadraticCurveTo(mx - Math.cos(a + Math.PI / 2) * w * 0.4, my - Math.sin(a + Math.PI / 2) * w * 0.4, cx - Math.cos(a + Math.PI / 2) * w, cy - Math.sin(a + Math.PI / 2) * w);
    g.fill();
    // split tips
    if (rng.next() < 0.35) {
      const a2 = a + rng.gauss() * 0.25;
      g.lineWidth = w * 0.5;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.6);
      g.lineTo(cx + Math.cos(a2) * len * 0.95, cy + Math.sin(a2) * len * 0.95);
      g.stroke();
    }
  }
  blob(g, cx, cy, R * 1.25, rng, { pts: 70, spikeP: 0.5, spikeLen: 1.1, rough: 0.35, bias });
  droplets(g, cx, cy, R * 1.4, rng, forward ? 26 : 30, forward ? 3.2 : 1.9, forward ? { a: 0, share: 0.7, spread: 0.5 } : null);
}

// Flash atlas, 4 x 3 cells of 256 px: cells 0-5 radial starbursts (the
// player's own flash, seen from behind the gun), 6-9 forward sprays (a
// Hood's flash seen side-on), 10-11 small radial sparks-bursts.
export const FLASH = { cols: 4, rows: 3, RADIAL: [0, 1, 2, 3, 4, 5], SIDE: [6, 7, 8, 9], SMALL: [10, 11] };
export function makeFlashAtlas(seed = 71) {
  const rng = new RNG(seed);
  const S = 256;
  const c = canvas(S * 4, S * 3);
  const g = c.getContext('2d');
  for (let i = 0; i < 12; i++) {
    const x = (i % 4) * S, y = Math.floor(i / 4) * S;
    const sub = canvas(S);
    const sg = sub.getContext('2d');
    if (i < 6) drawFlash(sg, S, rng, false);
    else if (i < 10) drawFlash(sg, S, rng, true);
    else {
      sg.fillStyle = '#fff';
      blob(sg, S / 2, S / 2, S * 0.09, rng, { pts: 40, spikeP: 0.7, spikeLen: 3.2, rough: 0.4 });
      droplets(sg, S / 2, S / 2, S * 0.1, rng, 18, 2.6);
    }
    g.drawImage(sub, x, y);
  }
  return tex(c);
}

// Blood / ink atlas, 4 x 2 cells of 128 px (alpha = shape):
//   0-3 splatter decals (blob + spikes + flung drops), 4 a teardrop (air
//   particles, stretched along their velocity), 5 a round drop cluster,
//   6 the POOL FIELD (graded: 1 at the centre, 0 at a noisy rim; the decal
//   shader thresholds it against the pool's growth so it spreads with a
//   ragged edge), 7 an ink chip / bullet-hole blot.
export const ATLAS = { cols: 4, rows: 2, SPLAT: [0, 1, 2, 3], DROP: 4, DROPS: 5, POOL: 6, CHIP: 7 };
export function makeBloodAtlas(seed = 83) {
  const rng = new RNG(seed);
  const C = 128;
  const c = canvas(C * 4, C * 2);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const cell = (i) => [(i % 4) * C, Math.floor(i / 4) * C];
  for (let i = 0; i < 4; i++) {
    const [x, y] = cell(i);
    g.save();
    g.beginPath(); g.rect(x, y, C, C); g.clip();
    const R = C * rng.range(0.16, 0.22);
    const dir = rng.next() * Math.PI * 2;
    blob(g, x + C / 2, y + C / 2, R, rng, { pts: 64, spikeP: 0.35, spikeLen: 1.2, rough: 0.4, bias: { a: dir, p: 3 } });
    // a couple of satellite blots
    for (let k = 0; k < 3; k++) {
      const a = dir + rng.gauss() * 0.6, d = R * rng.range(1.2, 1.9);
      blob(g, x + C / 2 + Math.cos(a) * d, y + C / 2 + Math.sin(a) * d, R * rng.range(0.15, 0.35), rng, { pts: 20, spikeP: 0.2, spikeLen: 0.6 });
    }
    droplets(g, x + C / 2, y + C / 2, R, rng, 30, 1.25, { a: dir, share: 0.75, spread: 0.45 });
    g.restore();
  }
  { // teardrop
    const [x, y] = cell(ATLAS.DROP);
    g.beginPath();
    g.moveTo(x + C / 2, y + C * 0.06);
    g.bezierCurveTo(x + C * 0.62, y + C * 0.45, x + C * 0.76, y + C * 0.7, x + C / 2, y + C * 0.9);
    g.bezierCurveTo(x + C * 0.24, y + C * 0.7, x + C * 0.38, y + C * 0.45, x + C / 2, y + C * 0.06);
    g.fill();
  }
  { // drop cluster
    const [x, y] = cell(ATLAS.DROPS);
    g.save(); g.beginPath(); g.rect(x, y, C, C); g.clip();
    blob(g, x + C / 2, y + C / 2, C * 0.12, rng, { pts: 30, spikeP: 0.2, spikeLen: 0.5 });
    droplets(g, x + C / 2, y + C / 2, C * 0.14, rng, 14, 1.6);
    g.restore();
  }
  { // pool field: graded, noisy rim, a few lobes
    const [x0, y0] = cell(ATLAS.POOL);
    const img = g.getImageData(x0, y0, C, C);
    const lobes = [];
    for (let k = 0; k < 6; k++) lobes.push([rng.range(-0.18, 0.18), rng.range(-0.14, 0.14), rng.range(0.16, 0.3)]);
    const nz = [];
    for (let k = 0; k < 40; k++) nz.push([rng.next() * Math.PI * 2, rng.range(1, 9) | 0, rng.range(0.01, 0.05)]);
    for (let j = 0; j < C; j++) {
      for (let i = 0; i < C; i++) {
        const u = (i + 0.5) / C - 0.5, v = (j + 0.5) / C - 0.5;
        let f = 0;
        for (const [lx, ly, lr] of lobes) {
          const d = Math.hypot(u - lx, (v - ly) * 1.15) / lr;
          f = Math.max(f, 1 - d);
        }
        const a = Math.atan2(v, u);
        let n = 0;
        for (const [ph, fr, amp] of nz) n += Math.sin(a * fr + ph) * amp;
        f += n * 0.8 + (rng.next() - 0.5) * 0.02;
        f = Math.max(0, Math.min(1, f * 1.25));
        const k = (j * C + i) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
        img.data[k + 3] = Math.round(f * 255);
      }
    }
    g.putImageData(img, x0, y0);
  }
  { // ink chip / bullet hole
    const [x, y] = cell(ATLAS.CHIP);
    g.save(); g.beginPath(); g.rect(x, y, C, C); g.clip();
    blob(g, x + C / 2, y + C / 2, C * 0.11, rng, { pts: 24, spikeP: 0.6, spikeLen: 1.6, rough: 0.5 });
    droplets(g, x + C / 2, y + C / 2, C * 0.12, rng, 10, 1.8);
    g.restore();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Screen-edge blood (player damage): red splatter drawn on a canvas that
// the HUD fades; returns a draw function for one hit.
export function drawScreenSplatter(g, W, H, rng, strength = 1) {
  g.fillStyle = '#c8102e';
  g.strokeStyle = '#c8102e';
  g.lineCap = 'round';
  const n = 1 + Math.round(strength * 2.5);
  for (let i = 0; i < n; i++) {
    // pick a point near an edge
    const side = rng.int(0, 3);
    const t = rng.next();
    const inset = Math.pow(rng.next(), 2) * 0.06;
    let x, y, a;
    if (side === 0) { x = t * W; y = inset * H; a = Math.PI / 2; }
    else if (side === 1) { x = W - inset * W; y = t * H; a = Math.PI; }
    else if (side === 2) { x = t * W; y = H - inset * H; a = -Math.PI / 2; }
    else { x = inset * W; y = t * H; a = 0; }
    const R = Math.min(W, H) * rng.range(0.025, 0.06) * (0.7 + 0.4 * strength);
    g.globalAlpha = rng.range(0.75, 0.95);
    blob(g, x, y, R, rng, { pts: 48, spikeP: 0.4, spikeLen: 1.3, rough: 0.4, bias: { a, p: 2 } });
    droplets(g, x, y, R, rng, 18, 1.6, { a, share: 0.7, spread: 0.6 });
    // a drip running down from the upper splats
    if (rng.next() < 0.5) {
      g.lineWidth = R * 0.12;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rng.gauss() * 3, y + R * rng.range(1.5, 4));
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}
