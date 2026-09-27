import * as THREE from 'three';
import { RNG } from '../util/rng.js';
import { drawSplatter } from '../render/textures.js';

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
export function blob(g, cx, cy, R, rng, { pts = 60, spikeP = 0.25, spikeLen = 1.8, rough = 0.28, bias = null } = {}) {
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
export function droplets(g, cx, cy, R, rng, n, reach = 2.2, bias = null) {
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

// A far Hood's flash (Phase 3a preamble #2): seen at 15-40 m the sprite is
// only ~48 px, where the fine spikes of the radial cells melt into a soft
// white blob. This variant is drawn for that size: a hard core and 7-10
// BOLD tapering spikes of uneven length (one or two much longer), almost no
// droplets, so at 48 px it still prints as a crisp white starburst at the
// pistol, like the reference's far shooter.
function drawFarFlash(g, S, rng) {
  const cx = S / 2, cy = S / 2;
  const R = S * 0.085;
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  const n = rng.int(7, 10);
  const a0 = rng.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + rng.gauss() * 0.16;
    const long = rng.next() < 0.3;
    const len = R * (long ? rng.range(4.4, 5.6) : rng.range(2.2, 3.6));
    const w = R * rng.range(0.34, 0.55);
    const px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(cx + px * w, cy + py * w);
    g.quadraticCurveTo(cx + Math.cos(a) * len * 0.45 + px * w * 0.35, cy + Math.sin(a) * len * 0.45 + py * w * 0.35, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    g.quadraticCurveTo(cx + Math.cos(a) * len * 0.45 - px * w * 0.35, cy + Math.sin(a) * len * 0.45 - py * w * 0.35, cx - px * w, cy - py * w);
    g.fill();
  }
  blob(g, cx, cy, R * 1.35, rng, { pts: 40, spikeP: 0.35, spikeLen: 0.7, rough: 0.25 });
  droplets(g, cx, cy, R * 1.5, rng, 5, 1.6);
}

// Flash atlas, 4 x 4 cells of 256 px: cells 0-5 radial starbursts (the
// player's own flash, seen from behind the gun), 6-9 forward sprays (a
// Hood's flash seen side-on), 10-11 small radial sparks-bursts, 12-15 the
// bold far-Hood starbursts (drawn after the others: cells 0-11 are
// unchanged, same RNG sequence).
export const FLASH = { cols: 4, rows: 4, RADIAL: [0, 1, 2, 3, 4, 5], SIDE: [6, 7, 8, 9], SMALL: [10, 11], FAR: [12, 13, 14, 15] };
export function makeFlashAtlas(seed = 71) {
  const rng = new RNG(seed);
  const S = 256;
  const c = canvas(S * 4, S * 4);
  const g = c.getContext('2d');
  for (let i = 12; i < 16; i++) {
    const sub = canvas(S);
    drawFarFlash(sub.getContext('2d'), S, rng.fork(i));
    g.drawImage(sub, (i % 4) * S, Math.floor(i / 4) * S);
  }
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

// Screen-edge blood (player damage): red ink splatter thrown onto the lens,
// drawn with the jagged splatter generator (render/textures.js drawSplatter:
// a spiked blot with flung satellite drops), no drips. Phase 3a preamble #4:
// every splat is kept clear of the HUD's boxes (`avoid`: rects in canvas
// pixels, padded by the splat's reach), which also sit above it in the DOM.
export function drawScreenSplatter(g, W, H, rng, strength = 1, avoid = []) {
  g.fillStyle = '#c8102e';
  g.strokeStyle = '#c8102e';
  const n = 1 + Math.round(strength * 2.5);
  const hits = (x, y, r) => avoid.some((a) => x + r > a[0] && x - r < a[2] && y + r > a[1] && y - r < a[3]);
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, a = 0, R = 0, ok = false;
    for (let k = 0; k < 14 && !ok; k++) {
      // a point near an edge
      const side = rng.int(0, 3);
      const t = rng.next();
      const inset = Math.pow(rng.next(), 2) * 0.06;
      if (side === 0) { x = t * W; y = inset * H; a = Math.PI / 2; }
      else if (side === 1) { x = W - inset * W; y = t * H; a = Math.PI; }
      else if (side === 2) { x = t * W; y = H - inset * H; a = -Math.PI / 2; }
      else { x = inset * W; y = t * H; a = 0; }
      R = Math.min(W, H) * rng.range(0.025, 0.055) * (0.7 + 0.4 * strength);
      ok = !hits(x, y, R * 2.4);
    }
    if (!ok) continue;
    // the blot: a lighter wide splash, then a denser core over it
    g.globalAlpha = rng.range(0.7, 0.85);
    drawSplatter(g, x, y, R * 1.25, rng, rng.int(18, 30));
    g.globalAlpha = rng.range(0.88, 0.98);
    drawSplatter(g, x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2, R * 0.75, rng, rng.int(14, 24));
    // a spray of drops thrown inward, off the blot
    droplets(g, x, y, R, rng, 16, 2.2, { a, share: 0.8, spread: 0.55 });
  }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Fire / smoke / debris atlas (Phase 3a: explosions, burning wrecks, muzzle
// smoke, glass), 4 x 4 cells of 256 px, alpha = shape:
//   0-3   FIREBALL: a burst of ink splatter - a jagged blot, curling flame
//         tongues thrown outward, flung drops (coloured white-hot / yellow /
//         orange / soot per particle: never a soft CG sprite)
//   4-7   FLAME: 3-5 licking tongues rising from a ragged base (point up)
//   8-11  SMOKE: a soft lumpy body whose alpha is laid down in dry-brush
//         strokes (the wash of an inker's brush, not a gaussian puff)
//   12    SHARD: a glass sliver     13 EMBER: a hot dot
//   14    CHUNK: an angular debris silhouette    15 RING: a splash ring
export const FIRE = { cols: 4, rows: 4, BALL: [0, 1, 2, 3], FLAME: [4, 5, 6, 7], SMOKE: [8, 9, 10, 11], SHARD: 12, EMBER: 13, CHUNK: 14, RING: 15 };

function tongue(g, x0, y0, a, len, w, bend) {
  // a curling, tapering flame tongue from (x0, y0) along angle a
  const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
  const mx = x0 + dx * len * 0.5 + px * bend * len, my = y0 + dy * len * 0.5 + py * bend * len;
  const tx = x0 + dx * len + px * bend * len * 1.6, ty = y0 + dy * len + py * bend * len * 1.6;
  g.beginPath();
  g.moveTo(x0 + px * w, y0 + py * w);
  g.quadraticCurveTo(mx + px * w * 0.55, my + py * w * 0.55, tx, ty);
  g.quadraticCurveTo(mx - px * w * 0.35, my - py * w * 0.35, x0 - px * w, y0 - py * w);
  g.fill();
}

function drawFireball(g, S, rng) {
  const cx = S / 2, cy = S / 2, R = S * 0.15;
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round';
  const n = rng.int(10, 14);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.gauss() * 0.2;
    const len = R * rng.range(0.9, 1.9);
    // lobes: billowing rounded masses, then thinner curling tongues
    if (rng.next() < 0.5) {
      g.beginPath();
      g.arc(cx + Math.cos(a) * R * rng.range(0.7, 1.1), cy + Math.sin(a) * R * rng.range(0.7, 1.1), R * rng.range(0.35, 0.6), 0, Math.PI * 2);
      g.fill();
    }
    tongue(g, cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, a, len, R * rng.range(0.2, 0.42), rng.gauss() * 0.28);
  }
  blob(g, cx, cy, R * 1.15, rng, { pts: 64, spikeP: 0.5, spikeLen: 0.9, rough: 0.42 });
  droplets(g, cx, cy, R * 1.4, rng, 26, 1.5);
}

// one licking flame: a body that swells above its root, sways and curls,
// and tapers to a hooked tip; the edges are ragged like a brush's
function flameTongue(g, x0, y0, h, W, rng) {
  const n = 26;
  const ph = rng.next() * 6.28, sway = rng.gauss() * 0.22 * h, curl = rng.gauss() * 0.12 * h;
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x0 + Math.sin(t * Math.PI * 1.2 + ph) * sway * t + curl * t * t * t;
    const y = y0 - t * h;
    let w = W * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.55) * 0.98 + 0.02)), 0.9) * (1 - t * 0.35);
    w *= 0.85 + 0.3 * rng.next();
    L.push([cx - w, y]); R.push([cx + w * (0.8 + 0.2 * rng.next()), y]);
  }
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i <= n; i++) g.lineTo(L[i][0], L[i][1]);
  for (let i = n; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
  g.fill();
}

function drawFlame(g, S, rng) {
  const cx = S / 2, base = S * 0.9;
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round';
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const x0 = cx + rng.range(-0.15, 0.15) * S;
    const h = S * rng.range(0.4, 0.78) * (i === 0 ? 1.08 : 1);
    flameTongue(g, x0, base, h, S * rng.range(0.06, 0.12), rng);
  }
  blob(g, cx, base - S * 0.05, S * 0.13, rng, { pts: 40, spikeP: 0.4, spikeLen: 0.7, rough: 0.4, bias: { a: -Math.PI / 2, p: 2 } });
  // flicks: small torn-off licks above
  for (let i = 0; i < rng.int(2, 4); i++) {
    flameTongue(g, cx + rng.range(-0.16, 0.16) * S, base - S * rng.range(0.5, 0.72), S * rng.range(0.07, 0.15), S * rng.range(0.012, 0.028), rng);
  }
}

function drawSmoke(g, S, rng) {
  const cx = S / 2, cy = S / 2;
  // body: a billowing cluster of lobes, edges softened a little (a wash,
  // not a hard cut-out)
  g.save();
  g.filter = `blur(${Math.round(S * 0.025)}px)`;
  g.fillStyle = 'rgba(255,255,255,0.9)';
  const nl = rng.int(6, 9);
  for (let k = 0; k < nl; k++) {
    const a = rng.next() * Math.PI * 2, d = S * rng.range(0.0, 0.17);
    const r = S * rng.range(0.1, 0.19);
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  // a softer skirt round it
  const grd = g.createRadialGradient(cx, cy, S * 0.15, cx, cy, S * 0.42);
  grd.addColorStop(0, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  // dry-brush: bristle strokes dragged through it, most of them lifting the
  // wash out (gaps), a few laying more on, so the mass reads as brushed
  g.lineCap = 'round';
  const ang = rng.range(-0.9, -0.5);
  for (let i = 0; i < 90; i++) {
    const r = Math.sqrt(rng.next()) * S * 0.36;
    const t = rng.next() * Math.PI * 2;
    const x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r * 0.9;
    const a = ang + rng.gauss() * 0.35;
    const L = S * rng.range(0.06, 0.18);
    const nb = rng.int(3, 7);
    const lift = rng.next() < 0.7;
    g.globalCompositeOperation = lift ? 'destination-out' : 'source-over';
    g.strokeStyle = '#fff';
    for (let b = 0; b < nb; b++) {
      if (rng.next() < 0.3) continue;
      const off = (b / (nb - 1) - 0.5) * S * 0.035;
      const ox = -Math.sin(a) * off, oy = Math.cos(a) * off;
      g.globalAlpha = rng.range(0.15, 0.45) * (lift ? 1 : 0.5);
      g.lineWidth = rng.range(1.0, 2.6);
      const s0 = rng.range(0, 0.25), s1 = rng.range(0.7, 1);
      g.beginPath();
      g.moveTo(x + ox + Math.cos(a) * L * (s0 - 0.5), y + oy + Math.sin(a) * L * (s0 - 0.5));
      g.quadraticCurveTo(x + ox + rng.gauss() * 2, y + oy + rng.gauss() * 2, x + ox + Math.cos(a) * L * (s1 - 0.5), y + oy + Math.sin(a) * L * (s1 - 0.5));
      g.stroke();
    }
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

export function makeFireAtlas(seed = 97) {
  const rng = new RNG(seed);
  const S = 256;
  const c = canvas(S * 4, S * 4);
  const g = c.getContext('2d');
  const at = (i, fn) => {
    const sub = canvas(S);
    fn(sub.getContext('2d'), rng.fork(i + 1));
    g.drawImage(sub, (i % 4) * S, Math.floor(i / 4) * S);
  };
  for (const i of FIRE.BALL) at(i, (sg, r) => drawFireball(sg, S, r));
  for (const i of FIRE.FLAME) at(i, (sg, r) => drawFlame(sg, S, r));
  for (const i of FIRE.SMOKE) at(i, (sg, r) => drawSmoke(sg, S, r));
  at(FIRE.SHARD, (sg, r) => {
    sg.fillStyle = '#fff';
    sg.beginPath();
    const n = r.int(3, 4);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r.gauss() * 0.3;
      const rr = S * (k === 0 ? 0.42 : r.range(0.08, 0.2));
      const x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr * 0.6;
      if (k === 0) sg.moveTo(x, y); else sg.lineTo(x, y);
    }
    sg.closePath();
    sg.fill();
  });
  at(FIRE.EMBER, (sg) => {
    const grd = sg.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = grd;
    sg.fillRect(0, 0, S, S);
  });
  at(FIRE.CHUNK, (sg, r) => {
    sg.fillStyle = '#fff';
    sg.beginPath();
    const n = r.int(6, 9);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r.gauss() * 0.15;
      const rr = S * r.range(0.22, 0.4);
      const x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr;
      if (k === 0) sg.moveTo(x, y); else sg.lineTo(x, y);
    }
    sg.closePath();
    sg.fill();
  });
  at(FIRE.RING, (sg, r) => {
    sg.fillStyle = '#fff';
    for (let k = 0; k < 90; k++) {
      const a = r.next() * Math.PI * 2;
      const rr = S * r.range(0.36, 0.46);
      const x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr;
      sg.beginPath();
      sg.ellipse(x, y, S * r.range(0.008, 0.03), S * r.range(0.004, 0.012), a + Math.PI / 2, 0, Math.PI * 2);
      sg.fill();
    }
  });
  return tex(c);
}

// Glass decals, 4 x 1 cells of 256 px (alpha = shape): 0-1 spider cracks
// (radial fractures + broken rings round the hit), 2-3 holes (a jagged
// punched-out blot with its own short radial cracks).
// 4-7: a shot-out PANE: a big jagged hole filling most of the cell, glass
// teeth pointing in from the frame (used stretched to the pane's size)
export const GLASS = { cols: 4, rows: 2, CRACK: [0, 1], HOLE: [2, 3], PANE: [4, 5, 6, 7] };
function drawPaneHole(g, S, rng) {
  g.fillStyle = '#fff';
  const cx = S / 2, cy = S / 2;
  g.beginPath();
  const n = rng.int(16, 24);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // a square-ish outline (the frame) broken by teeth: alternate deep
    // notches (a shard's point sticking in) and the frame edge
    const sq = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    const tooth = i % 2 === 0 ? rng.range(0.28, 0.4) : rng.range(0.42, 0.48);
    const r = S * Math.min(0.49, tooth * Math.min(sq, 1.25));
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
}
export function makeGlassAtlas(seed = 131) {
  const rng = new RNG(seed);
  const S = 256;
  const c = canvas(S * 4, S * 2);
  const g = c.getContext('2d');
  for (let i = 4; i < 8; i++) {
    const sub = canvas(S);
    drawPaneHole(sub.getContext('2d'), S, rng.fork(i + 40));
    g.drawImage(sub, (i % 4) * S, S);
  }
  for (let i = 0; i < 4; i++) {
    const sub = canvas(S);
    const sg = sub.getContext('2d');
    const r = rng.fork(i + 3);
    const cx = S / 2, cy = S / 2;
    sg.strokeStyle = '#fff'; sg.fillStyle = '#fff'; sg.lineCap = 'round'; sg.lineJoin = 'round';
    const hole = i >= 2;
    const nr = r.int(9, 14);
    const rays = [];
    for (let k = 0; k < nr; k++) {
      // radial fracture: a jagged polyline outward
      const a0 = (k / nr) * Math.PI * 2 + r.gauss() * 0.18;
      const L = S * r.range(hole ? 0.22 : 0.3, 0.48);
      sg.lineWidth = r.range(1.2, 2.6);
      sg.beginPath();
      let x = cx, y = cy, a = a0;
      sg.moveTo(x, y);
      const steps = r.int(4, 7);
      const pts = [];
      for (let s = 1; s <= steps; s++) {
        a += r.gauss() * 0.18;
        x = cx + Math.cos(a) * L * (s / steps); y = cy + Math.sin(a) * L * (s / steps);
        sg.lineTo(x, y);
        pts.push([x, y]);
      }
      sg.stroke();
      rays.push(pts);
    }
    // concentric broken rings joining neighbouring rays
    const rings = hole ? 1 : 2;
    for (let q = 0; q < rings; q++) {
      const s = 1 + q + (hole ? 1 : 0);
      sg.lineWidth = r.range(0.9, 1.8);
      for (let k = 0; k < nr; k++) {
        if (r.next() < 0.3) continue;
        const A = rays[k], B = rays[(k + 1) % nr];
        const pa = A[Math.min(A.length - 1, s)], pb = B[Math.min(B.length - 1, s)];
        sg.beginPath();
        sg.moveTo(pa[0], pa[1]);
        sg.quadraticCurveTo((pa[0] + pb[0]) / 2 + r.gauss() * 4, (pa[1] + pb[1]) / 2 + r.gauss() * 4, pb[0], pb[1]);
        sg.stroke();
      }
    }
    if (hole) blob(sg, cx, cy, S * 0.09, r, { pts: 30, spikeP: 0.6, spikeLen: 1.2, rough: 0.5 });
    else { sg.beginPath(); sg.arc(cx, cy, S * 0.018, 0, Math.PI * 2); sg.fill(); }
    g.drawImage(sub, i * S, 0);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
