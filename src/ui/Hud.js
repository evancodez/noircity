import { RNG } from '../util/rng.js';

// DOM overlay: title card (a dry-brush swash of white ink with NOIR EXTREME
// inked over it, "click to begin" below) and an empty HUD container that
// Phase 2 fills (ammo, health, waves). Hidden entirely in ?shot= mode.
export class Hud {
  constructor({ onBegin }) {
    const style = document.createElement('style');
    style.textContent = `
      #hud { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: "American Typewriter", "Courier New", monospace; color: #e8e8e8; }
      #title { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.82) 78%); cursor: pointer; user-select: none; }
      #title .card { position: relative; width: min(92vw, 1180px); aspect-ratio: 1180 / 400; display: flex; align-items: center; justify-content: center; }
      #title canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      #title h1 { position: relative; margin: 0; font-family: "Bodoni 72", "Didot", "Playfair Display", Georgia, serif; font-weight: 700;
        font-size: min(9.2vw, 132px); letter-spacing: 0.03em; color: #080808; transform: scaleX(0.8); line-height: 1; white-space: nowrap; }
      #title p { position: relative; margin: 18px 0 0; font-family: "American Typewriter", "Courier New", monospace; font-size: 15px;
        letter-spacing: 0.42em; color: #cfcfcf; text-transform: uppercase; }
      #title.hidden { display: none; }
    `;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hud';
    document.body.appendChild(this.root);

    this.title = document.createElement('div');
    this.title.id = 'title';
    const card = document.createElement('div');
    card.className = 'card';
    const c = document.createElement('canvas');
    c.width = 1180; c.height = 400;
    drawSwash(c.getContext('2d'), 590, 200, 1040, 190, new RNG(1937));
    card.appendChild(c);
    const h = document.createElement('h1');
    h.textContent = 'NOIR EXTREME';
    card.appendChild(h);
    this.title.appendChild(card);
    this.prompt = document.createElement('p');
    this.prompt.textContent = 'click to begin';
    this.title.appendChild(this.prompt);
    document.body.appendChild(this.title);
    this.title.addEventListener('click', () => onBegin && onBegin());
  }

  showTitle(text = 'click to begin') { this.prompt.textContent = text; this.title.classList.remove('hidden'); }
  hideTitle() { this.title.classList.add('hidden'); }
  setVisible(v) { this.root.style.display = v ? '' : 'none'; if (!v) this.hideTitle(); }
}

// One loaded brush dragged left to right: hundreds of bristle lines, each
// starting and running dry at its own place, so the ends break up into
// scratchy dry-brush tails; a few flicked droplets around it.
function drawSwash(g, cx, cy, W, H, rng) {
  g.save();
  g.strokeStyle = '#f1f1f1';
  g.fillStyle = '#f1f1f1';
  g.lineCap = 'round';
  const bristles = 420;
  for (let i = 0; i < bristles; i++) {
    const t = rng.next();
    const edge = Math.abs(t - 0.5) * 2;                       // 0 centre .. 1 rim of the stroke
    const y0 = cy + (t - 0.5) * H + rng.gauss() * 2;
    const start = cx - W / 2 + (edge * edge * 0.12 + Math.pow(rng.next(), 2) * 0.06) * W;
    const len = W * (0.93 - edge * edge * 0.3 - rng.next() * 0.12);
    const lw = rng.range(2.0, 6.5) * (1 - edge * 0.55);
    const dryAt = rng.range(0.55, 0.95);                      // where this bristle starts skipping
    g.lineWidth = lw;
    g.globalAlpha = rng.range(0.75, 1.0);
    g.beginPath();
    g.moveTo(start, y0);
    const segs = 36;
    let drawing = true;
    for (let k = 1; k <= segs; k++) {
      const u = k / segs;
      const x = start + len * u;
      // the stroke sags a little and bristles wander
      const y = y0 + Math.sin(u * 3.1) * H * 0.05 + rng.gauss() * 0.6;
      const skip = u > dryAt && rng.next() < (u - dryAt) * 3.2;
      if (skip) { drawing = false; g.moveTo(x, y); } else if (!drawing) { drawing = true; g.moveTo(x, y); } else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  // flicked droplets: irregular blobs, mostly off the dry end
  for (let i = 0; i < 26; i++) {
    const x = cx + rng.range(-0.45, 0.55) * W + (rng.next() < 0.6 ? W * 0.25 : 0);
    const y = cy + rng.gauss() * H * 0.62;
    const r = Math.pow(rng.next(), 2) * 9 + 1.5;
    g.beginPath();
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = r * rng.range(0.7, 1.25);
      const px = x + Math.cos(a) * rr * 1.3, py = y + Math.sin(a) * rr;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.fill();
  }
  g.restore();
}
