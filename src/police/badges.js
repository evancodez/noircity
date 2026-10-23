import { makeTornStroke } from '../ui/inkArt.js';

// [O3] The heat on the frame, a STAND-IN until lane O7's HUD draws it from
// the seam (police.heat, police.on('heat', fn)): five police shields top
// right on a torn black stroke, the heat's number of them lit paper white,
// the rest dark; they breathe while the police search (out of their sight:
// the heat is going), and go at 0. Read without a word: how many, and
// whether they are looking.
//   new Badges(game); badges.set(heat, state); badges.step(dt); badges.dispose()
const W = 230, H = 58;

function shield(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x + s * 0.55, y - s * 0.62, x + s * 0.86, y - s * 0.78);
  g.quadraticCurveTo(x + s * 0.92, y + s * 0.15, x, y + s);
  g.quadraticCurveTo(x - s * 0.92, y + s * 0.15, x - s * 0.86, y - s * 0.78);
  g.quadraticCurveTo(x - s * 0.55, y - s * 0.62, x, y - s);
  g.closePath();
}
function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
}

export class Badges {
  constructor(G) {
    this.G = G;
    this.heat = 0; this.state = 'clear'; this.t = 0; this.shown = 0;
    this.el = null;
  }
  ensure() {
    if (this.el && this.el.isConnected) return;
    const L = this.G.hud.layer('o3heat');
    const el = document.createElement('div');
    el.id = 'o3heat';
    el.style.cssText = `position:absolute; top:22px; right:26px; width:${W}px; height:${H}px; opacity:0; transition:none; pointer-events:none;`;
    const bg = makeTornStroke(W, H, 7311);
    bg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; opacity:0.92;';
    const cv = document.createElement('canvas');
    cv.width = W * 2; cv.height = H * 2;
    cv.style.cssText = 'position:absolute; inset:0; width:100%; height:100%;';
    el.appendChild(bg); el.appendChild(cv);
    L.appendChild(el);
    this.el = el; this.cv = cv; this.drawn = -1;
  }
  set(heat, state) {
    if (heat === this.heat && state === this.state) return;
    if (heat > this.heat) this.flash = 0.6;
    this.heat = heat; this.state = state;
    this.draw();
  }
  draw() {
    if (this.G.shotMode && !new URLSearchParams(location.search).get('hud')) return;
    this.ensure();
    const g = this.cv.getContext('2d'), s = 2;
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    for (let i = 0; i < 5; i++) {
      const x = (38 + i * 38.5) * s, y = 29 * s, r = 14 * s;
      const lit = i < this.heat;
      shield(g, x, y, r);
      g.fillStyle = lit ? '#f1efe9' : 'rgba(241,239,233,0.06)';
      g.fill();
      g.lineWidth = 2.2 * s;
      g.strokeStyle = lit ? '#f1efe9' : 'rgba(241,239,233,0.32)';
      g.stroke();
      star(g, x, y - 1 * s, 6.2 * s);
      g.fillStyle = lit ? '#070707' : 'rgba(241,239,233,0.22)';
      g.fill();
    }
    this.drawn = this.heat;
  }
  step(dt) {
    if (!this.el && !this.heat) return;
    this.t += dt;
    this.ensure();
    // shown while there is heat (and a moment after it goes), breathing in the search
    const want = this.heat > 0 ? 1 : 0;
    this.shown += (want - this.shown) * (1 - Math.exp(-dt * (want ? 8 : 2.5)));
    let a = this.shown;
    if (this.state === 'search' && this.heat) a *= 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(this.t * 4.2));
    if (this.flash > 0) { this.flash -= dt; a = Math.min(1, a + this.flash); }
    this.el.style.opacity = a.toFixed(3);
    this.el.dataset.heat = String(this.heat);
    this.el.dataset.state = this.state;
  }
  dispose() { if (this.el) this.el.remove(); this.el = null; }
}
