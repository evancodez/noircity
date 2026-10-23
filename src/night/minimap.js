import { RNG } from '../util/rng.js';
import { frayEdges } from '../ui/inkArt.js';

// The minimap (lane O7, the user's words after his first drive: "a mini map
// in the bottom left corner"; docs/seams/NIGHT.md §2): a torn patch of the
// inked city map (O1's drawMap), bottom left, heading up - the streets within
// about 150 m, my mark in the middle, my car when I am out of it, the cops'
// marks when they are close (police.units, or any lane's night.addMarks),
// the thing I have taken up as a ring (night.target; at the patch's edge as
// a tick when it is further). Hidden on the title, the pause card and the
// map, under the stills and a fail's black, outside the city; in shot mode
// with the rest of the HUD (hud=1 shows it).
export const MINI = { css: 212, view: 150, hz: 30, alpha: 0.9 };

export class Minimap {
  constructor(night) {
    this.night = night;
    const hud = night.game.hud;
    const st = document.createElement('style');
    st.textContent = `
      #hud .nmini { position: absolute; left: 22px; bottom: 20px; width: ${MINI.css}px; height: ${MINI.css}px; pointer-events: none; display: none; opacity: ${MINI.alpha};
        filter: drop-shadow(0 0 6px rgba(0,0,0,0.9)); }
      #hud .nmini.up { display: block; }
      #hud .nmini canvas { width: 100%; height: 100%; display: block; }
      #hud.titled .nmini, #hud.nmapopen .nmini { display: none !important; }
      #hud.stilled .nmini, #hud.failing .nmini { visibility: hidden; }
      #hud.nminion .bl { bottom: ${MINI.css + 40}px; }
    `;
    document.head.appendChild(st);
    this.el = document.createElement('div');
    this.el.className = 'nmini';
    this.canvas = document.createElement('canvas');
    this.N = MINI.css * 2;
    this.canvas.width = this.canvas.height = this.N;
    this.el.appendChild(this.canvas);
    hud.root.appendChild(this.el);
    this.g = this.canvas.getContext('2d');
    this.t = 0;
    this.shown = false;
    this.makePatch();
  }

  // the torn patch: a mask of ragged edges and its ink rim (drawn once)
  makePatch() {
    const N = this.N, rng = new RNG(7311);
    const pts = [];
    const n = 72, R = N * 0.455;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // a squarish round patch (a scrap torn off the map), its edge bitten
      const sq = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const r = R * Math.min(1.12, 0.62 + 0.38 * sq) * (1 + rng.gauss() * 0.018) - (rng.next() < 0.12 ? rng.range(2, 7) : 0);
      pts.push([N / 2 + Math.cos(a) * r, N / 2 + Math.sin(a) * r]);
    }
    const mask = document.createElement('canvas');
    mask.width = mask.height = N;
    const mg = mask.getContext('2d');
    mg.fillStyle = '#000';
    mg.beginPath(); pts.forEach(([x, y], i) => (i ? mg.lineTo(x, y) : mg.moveTo(x, y))); mg.closePath(); mg.fill();
    frayEdges(mask, [0, 0, 0], new RNG(17), N * 0.12, { horiz: 0.3 });
    const rim = document.createElement('canvas');
    rim.width = rim.height = N;
    const rg = rim.getContext('2d');
    rg.strokeStyle = '#060606'; rg.lineJoin = 'round';
    for (let k = 0; k < 3; k++) {
      rg.lineWidth = 5 - k * 1.5;
      rg.beginPath(); pts.forEach(([x, y], i) => { const j = rng.gauss() * 0.8; return i ? rg.lineTo(x + j, y + j) : rg.moveTo(x + j, y + j); }); rg.closePath(); rg.stroke();
    }
    frayEdges(rim, [6, 6, 6], new RNG(23), N * 0.08, { horiz: 0.5 });
    this.mask = mask; this.rim = rim;
    this.R = R * 0.92;
  }

  setShown(on) {
    if (on === this.shown) return;
    this.shown = on;
    this.el.classList.toggle('up', on);
    this.night.game.hud.root.classList.toggle('nminion', on);
  }

  // per rendered frame
  frame(dt) {
    const N = this.night, G = N.game;
    const on = N.inCity && G.state === 'playing' && !N.map.open && !N.el.riding;
    this.setShown(on);
    if (!on) return;
    this.t += dt;
    if (this.t < 1 / MINI.hz && this.drawn) return;
    this.t = 0;
    this.draw();
  }

  draw() {
    const N = this.night, G = N.game, M = N.cityMap();
    if (!M) return;
    this.drawn = true;
    const g = this.g, S = this.N, c = S / 2;
    const ctl = G.controller, R = G.city;
    const eye = G.eye;
    const yaw = R && R.inCar && R.car ? R.car.yaw - Math.PI / 2 : ctl.yaw;
    // world metres -> patch pixels
    const s = this.R / MINI.view;
    const [u0, v0] = M.toMap(eye.x, eye.z);
    const ks = s / M.k;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const toPatch = (x, z) => { const dx = (x - eye.x) * s, dz = (z - eye.z) * s; return [c + dx * cy - dz * sy, c + dx * sy + dz * cy]; };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(c, c); g.rotate(yaw); g.scale(ks, ks); g.translate(-u0, -v0);
    g.drawImage(M.canvas, 0, 0);
    g.restore();
    // the marks
    const marks = N.marks();
    for (const m of marks) {
      const [px, py] = toPatch(m.x, m.z);
      const d = Math.hypot(px - c, py - c);
      if (m.kind === 'target') {
        if (d > this.R - 10) {
          // at the edge: a tick pointing the way
          const a = Math.atan2(py - c, px - c), r = this.R - 12;
          g.save(); g.translate(c + Math.cos(a) * r, c + Math.sin(a) * r); g.rotate(a + Math.PI / 2);
          g.fillStyle = '#f0ede6'; g.strokeStyle = '#050505'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 7); g.lineTo(-8, 7); g.closePath(); g.stroke(); g.fill();
          g.restore();
        } else ring(g, px, py, 11, '#f0ede6');
        continue;
      }
      if (d > this.R - 6) continue;
      if (m.kind === 'car') {
        g.save(); g.translate(px, py); g.rotate((m.yaw ?? 0) + yaw);
        g.fillStyle = '#d4cfc4'; g.strokeStyle = '#050505'; g.lineWidth = 3; g.beginPath(); g.rect(-6, -11, 12, 22); g.fill(); g.stroke();
        g.restore();
      } else if (m.kind === 'cop') {
        g.fillStyle = '#050505'; g.beginPath(); g.arc(px, py, 7.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ebe8e1'; g.beginPath(); g.arc(px, py, 3.2, 0, Math.PI * 2); g.fill();
      } else if (m.kind === 'place') {
        g.fillStyle = '#050505'; g.fillRect(px - 5, py - 5, 10, 10);
      }
    }
    // the patch: torn out of the sheet, its rim inked
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(this.mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.rim, 0, 0);
    // me: an ink arrowhead pointing up (heading up), paper round it
    g.save(); g.translate(c, c);
    g.fillStyle = '#050505'; g.strokeStyle = '#f2efe8'; g.lineWidth = 7; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, -30); g.lineTo(20, 22); g.lineTo(0, 11); g.lineTo(-20, 22); g.closePath(); g.stroke(); g.fill();
    g.restore();
  }
}

function ring(g, x, y, r, col) {
  g.lineWidth = 6; g.strokeStyle = '#050505'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.strokeStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
}
