// [O4] A man stepping in on me from out of my sight, said by the frame: the
// ink closes in from that edge (a dry brush laid on, torn inner edge), as a
// comic panel darkens on the side the danger is. Drawn into the HUD's layer
// (hud=0 and the title hide it). edge.set(side: 'L' | 'R' | 'B' | null, k)
// each step; it eases in and out by itself.
import { RNG } from '../../util/rng.js';

export class EdgeInk {
  constructor(hud) {
    this.hud = hud;
    this.k = { L: 0, R: 0, B: 0 };
    this.want = { L: 0, R: 0, B: 0 };
    this.c = null;
    this.drawn = '';
  }
  set(side, k = 1) {
    for (const s of ['L', 'R', 'B']) this.want[s] = s === side ? k : 0;
  }
  clear() { this.set(null); this.k.L = this.k.R = this.k.B = 0; this.draw(); }
  step(dt) {
    let ch = false;
    for (const s of ['L', 'R', 'B']) {
      const w = this.want[s], k0 = this.k[s];
      const k1 = k0 + (w - k0) * (1 - Math.exp(-dt * (w > k0 ? 9 : 5)));
      this.k[s] = Math.abs(k1 - w) < 0.005 ? w : k1;
      if (Math.abs(this.k[s] - k0) > 1e-4) ch = true;
    }
    if (ch) this.draw();
  }
  draw() {
    const root = this.hud && this.hud.root;
    if (!root) return;
    if (!this.c) { const e = document.createElement('canvas'); e.className = 'o4edge'; e.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none'; root.insertBefore(e, root.firstChild); this.c = e; }
    const c = this.c, W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const K = H / 900;
    for (const s of ['L', 'R', 'B']) {
      const k = this.k[s];
      if (k < 0.01) continue;
      const r = new RNG(s === 'L' ? 811 : s === 'R' ? 812 : 813);
      g.fillStyle = '#050505';
      g.globalAlpha = 0.82 * k;
      g.beginPath();
      if (s === 'B') {
        const D = H * 0.16 * k;
        g.moveTo(-2, H + 2);
        for (let i = 0; i <= 30; i++) { const x = W * i / 30, mid = 1 - Math.pow((x / W - 0.5) * 1.8, 2) * 0.5; g.lineTo(x, H - D * mid * ((i % 2 ? 0.8 : 1) + r.gauss() * 0.08)); }
        g.lineTo(W + 2, H + 2);
      } else {
        const edge = s === 'L' ? 0 : W, inward = s === 'L' ? 1 : -1, D = W * 0.13 * k;
        g.moveTo(edge, -2);
        for (let i = 0; i <= 26; i++) { const y = H * i / 26, mid = 1 - Math.pow((y / H - 0.5) * 1.7, 2) * 0.45; g.lineTo(edge + inward * D * mid * ((i % 2 ? 0.82 : 1) + r.gauss() * 0.07), y); }
        g.lineTo(edge, H + 2);
      }
      g.closePath(); g.fill();
      // bristles dragged in from it
      g.strokeStyle = 'rgba(5,5,5,0.8)'; g.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        g.lineWidth = (2 + 4 * r.next()) * K;
        const len = (20 + 70 * r.next()) * K * k;
        g.beginPath();
        if (s === 'B') { const x = W * r.next(); g.moveTo(x, H - H * 0.1 * k); g.lineTo(x + r.gauss() * 4 * K, H - H * 0.1 * k - len); }
        else { const y = H * r.next(), x0 = s === 'L' ? W * 0.1 * k : W - W * 0.1 * k, inward = s === 'L' ? 1 : -1; g.moveTo(x0, y); g.lineTo(x0 + inward * len, y + r.gauss() * 4 * K); }
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
}
