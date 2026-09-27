import { RNG } from '../util/rng.js';
import { drawScreenSplatter } from '../fx/fxTextures.js';

// Player health: 100, regenerates (18/s) after 6 s without damage.
// Feedback (DOM, over the canvas, inside the HUD root so it hides with it):
//   - red blood splatter thrown onto the screen edges on every hit, fading
//     over ~1.8 s (the only red on the HUD, like the blood in the world)
//   - a monochrome heartbeat vignette when low (< 35): a dark ink wash
//     (a soft radial wash under dry-brush strokes dragged in from the frame
//     edges, drawn once per size) that closes in with a double thump at
//     ~70 bpm (1.17 Hz); visible the moment he drops under 35 (~0.6 at the
//     corners), pulsing ~0.35 there, and harder the lower he is
export const HEALTH = { max: 100, regenDelay: 6, regenRate: 18, low: 35 };

export class Health {
  constructor(root) {
    this.hp = HEALTH.max;
    this.sinceHit = 99;
    this.dead = false;
    this.rng = new RNG(4242);
    this.onDeath = null;
    this.splatA = 0;
    this.hitA = 0;
    this.beatT = 0;
    const style = document.createElement('style');
    style.textContent = `
      #dmgsplat { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0; }
      #heart { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0; }
      #hitflash { position: absolute; inset: 0; pointer-events: none; opacity: 0;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.75) 100%); }
    `;
    document.head.appendChild(style);
    this.heart = document.createElement('canvas'); this.heart.id = 'heart';
    this.heartG = this.heart.getContext('2d');
    this.flash = document.createElement('div'); this.flash.id = 'hitflash';
    this.canvas = document.createElement('canvas'); this.canvas.id = 'dmgsplat';
    root.appendChild(this.heart);
    root.appendChild(this.flash);
    root.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.splatA = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // (resizing a canvas clears it: carry the blood on the lens across)
  resize() {
    const hc = this.heart;
    const hw = Math.max(2, Math.round(innerWidth / 2)), hh = Math.max(2, Math.round(innerHeight / 2));
    if (hc.width !== hw || hc.height !== hh) { hc.width = hw; hc.height = hh; drawHeartWash(this.heartG, hw, hh, new RNG(3535)); }
    const c = this.canvas;
    const w = Math.max(2, Math.round(innerWidth / 2)), h = Math.max(2, Math.round(innerHeight / 2));
    if (c.width === w && c.height === h) return;
    let keep = null;
    if (c.width > 2 && this.splatA > 0) {
      keep = document.createElement('canvas');
      keep.width = c.width; keep.height = c.height;
      keep.getContext('2d').drawImage(c, 0, 0);
    }
    c.width = w; c.height = h;
    if (keep) this.g.drawImage(keep, 0, 0, w, h);
  }

  reset() {
    this.hp = HEALTH.max; this.sinceHit = 99; this.dead = false; this.splatA = 0; this.hitA = 0;
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.apply();
  }

  damage(amount) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.sinceHit = 0;
    // fresh blood on the lens; older splats fade under it
    if (this.splatA < 0.05) this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    drawScreenSplatter(this.g, this.canvas.width, this.canvas.height, this.rng, Math.min(1.5, amount / 10));
    this.splatA = 1;
    this.hitA = 1;
    if (this.hp <= 0) {
      this.dead = true;
      if (this.onDeath) this.onDeath();
    }
  }

  update(dt) {
    this.sinceHit += dt;
    if (!this.dead && this.sinceHit > HEALTH.regenDelay && this.hp < HEALTH.max) {
      this.hp = Math.min(HEALTH.max, this.hp + HEALTH.regenRate * dt);
    }
    this.splatA = Math.max(0, this.splatA - dt / 1.8);
    this.hitA = Math.max(0, this.hitA - dt / 0.35);
    this.beatT += dt;
    this.apply();
  }

  apply() {
    this.canvas.style.opacity = (Math.pow(this.splatA, 0.7) * 0.92).toFixed(3);
    this.flash.style.opacity = (this.hitA * 0.8).toFixed(3);
    const low = this.dead ? 1 : Math.max(0, 1 - this.hp / HEALTH.low);
    if (low > 0) {
      // double thump: lub-dub at ~70 bpm; the wash is there as soon as he is
      // under 35 (fading in over the first 2 hp) and darker the lower he is
      const ph = (this.beatT * 70 / 60) % 1;
      const beat = Math.min(1, Math.exp(-((ph - 0.05) ** 2) / 0.0012) + 0.7 * Math.exp(-((ph - 0.22) ** 2) / 0.0015));
      const vis = Math.min(1, low * HEALTH.low / 2) * (0.6 + 0.4 * low);
      this.heart.style.opacity = Math.min(1, vis * (0.62 + 0.38 * beat)).toFixed(3);
    } else this.heart.style.opacity = '0';
  }
}

// The low-health vignette: black ink closing in from the frame edges. A soft
// elliptical wash (clear in the middle 45 %, ~0.95 at the corners) under a
// few hundred dry-brush strokes dragged in from the edges, each running dry
// at its own place, so the edge reads as a brushed ink wash, not a CSS glow.
function drawHeartWash(g, W, H, rng) {
  g.clearRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(W / 2, H / 2);
  const grd = g.createRadialGradient(0, 0, 0.45, 0, 0, Math.SQRT2);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.3, 'rgba(0,0,0,0.42)');
  grd.addColorStop(0.62, 'rgba(0,0,0,0.85)');
  grd.addColorStop(1, 'rgba(0,0,0,0.97)');
  g.fillStyle = grd;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  const M = Math.min(W, H);
  for (let i = 0; i < 420; i++) {
    // a point on the frame edge, the stroke dragged toward the centre
    const t = rng.next() * 2 * (W + H);
    let x, y;
    if (t < W) { x = t; y = 0; } else if (t < W + H) { x = W; y = t - W; } else if (t < 2 * W + H) { x = t - W - H; y = H; } else { x = 0; y = t - 2 * W - H; }
    const a = Math.atan2(H / 2 - y, W / 2 - x) + rng.gauss() * 0.25;
    const len = M * rng.range(0.06, 0.2) * (1 + 0.6 * Math.abs(Math.cos(Math.atan2(y - H / 2, x - W / 2) * 2)));
    const dryAt = rng.range(0.35, 0.8);
    g.lineWidth = rng.range(3, 12) * (M / 500);
    g.globalAlpha = rng.range(0.2, 0.45);
    g.beginPath();
    g.moveTo(x, y);
    const segs = 18;
    let drawing = true;
    for (let k = 1; k <= segs; k++) {
      const u = k / segs;
      const px = x + Math.cos(a) * len * u + rng.gauss() * 0.6, py = y + Math.sin(a) * len * u + rng.gauss() * 0.6;
      const skip = u > dryAt && rng.next() < (u - dryAt) * 3;
      if (skip) { drawing = false; g.moveTo(px, py); } else if (!drawing) { drawing = true; g.moveTo(px, py); } else g.lineTo(px, py);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}
