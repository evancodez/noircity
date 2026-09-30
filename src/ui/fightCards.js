import { makeTornStroke, makeKeyDab, blob, hashSeed } from './inkArt.js';
import { RNG } from '../util/rng.js';

// The fight's cards (round 2, docs/story/FIGHT.md §1, §3), drawn into the
// HUD's own layer (so hud=0 and the title hide them as the HUD's lines):
//   card(text, pic)      one card at a time, low in the frame, in the
//                        typewriter face, with a small inked picture of the
//                        mouse (its left or right button inked in) or of the
//                        keys. pic: 'mouseL' | 'mouseR' | 'mouseLR' | ['SPACE', 'D'] | null
//   flash(text, secs)    a short line over the middle ('HE IS OPEN', 'NOW FIGHT.')
//   arrow(a, b)          an inked arrow on the frame from a to b (CSS px), or null
//   charge(at, k)        the brush stroke beside a winding fist: it grows with
//                        the charge and goes from grey to paper white (no bar,
//                        no numbers); at null hides it
//   clear()
// Game time only (tick(dt)); the canvases are drawn once per text.
const TYPE = '"American Typewriter", "Courier New", monospace';

export class FightCards {
  constructor(hud) {
    this.hud = hud;
    const st = document.createElement('style');
    st.textContent = `
      #fightcards { position: absolute; inset: 0; pointer-events: none; }
      #fightcards .fc { position: absolute; left: 50%; bottom: 11%; transform: translateX(-50%); display: none; align-items: center; gap: 18px;
        font-family: ${TYPE}; font-size: 15px; letter-spacing: 0.3em; color: #efede7; text-transform: uppercase; white-space: pre;
        text-shadow: 0 0 5px #000, 0 0 2px #000, 0 0 1px #000; }
      #fightcards .fc .bg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: -1; opacity: 0.85; }
      #fightcards .fc .pic { position: relative; display: flex; gap: 6px; align-items: center; }
      #fightcards .fc .pic canvas { display: block; }
      #fightcards .fc .key { position: relative; min-width: 66px; height: 66px; line-height: 66px; text-align: center; font-size: 14px; letter-spacing: 0.08em; padding: 0 8px; box-sizing: border-box; }
      #fightcards .fc .key canvas { position: absolute; left: -4px; top: 0; width: calc(100% + 8px); height: 100%; }
      #fightcards .fc .key span { position: relative; color: #0a0a0a; text-shadow: none; font-weight: bold; }
      #fightcards .fc .plus { font-size: 13px; letter-spacing: 0; }
      #fightcards .fl { position: absolute; left: 50%; top: 36%; transform: translate(-50%, -50%); display: none; font-family: ${TYPE}; font-size: 30px;
        letter-spacing: 0.34em; color: #f4f2ec; text-shadow: 0 0 10px #000, 0 0 3px #000; white-space: pre; }
      #fightcards canvas.arrow, #fightcards canvas.charge { position: absolute; left: 0; top: 0; }
    `;
    document.head.appendChild(st);
    const root = document.createElement('div');
    root.id = 'fightcards';
    root.innerHTML = '<canvas class="arrow"></canvas><canvas class="charge"></canvas><div class="fc"><div class="pic"></div><span class="t"></span></div><div class="fl"></div>';
    hud.root.appendChild(root);
    this.root = root;
    this.fc = root.querySelector('.fc'); this.pic = root.querySelector('.fc .pic'); this.text = root.querySelector('.fc .t');
    this.fl = root.querySelector('.fl');
    this.arrowC = root.querySelector('canvas.arrow'); this.chargeC = root.querySelector('canvas.charge');
    this.flT = 0;
    this.cur = null;
    this.shownCard = '';
    this.shownFlash = '';
  }

  card(text, pic = null) {
    const key = text + '|' + JSON.stringify(pic);
    if (this.cur === key) return;
    this.cur = key;
    if (!text) { this.fc.style.display = 'none'; this.shownCard = ''; return; }
    this.text.textContent = text;
    this.pic.innerHTML = '';
    for (const el of picture(pic)) this.pic.appendChild(el);
    const old = this.fc.querySelector('.bg'); if (old) old.remove();
    // (polish: the backing covers the whole card - the text is spaced 0.3 em
    // a letter, so it ran past the stroke - black, torn, 85 % opaque)
    const meas = (this._mg || (this._mg = document.createElement('canvas').getContext('2d')));
    meas.font = '15px ' + TYPE;
    const tw = meas.measureText(text).width + text.length * 4.5;
    const pw = pic ? (typeof pic === 'string' ? 36 : (Array.isArray(pic) ? pic.length : 1) * 64) + 18 : 0;
    const w = Math.round(tw + pw + 190);
    const bg = makeTornStroke(w, 96, hashSeed(text));
    bg.className = 'bg';
    this.fc.insertBefore(bg, this.fc.firstChild);
    this.fc.style.display = 'flex';
    this.shownCard = text;
  }

  flash(text, secs = 1) {
    this.fl.textContent = text;
    this.fl.style.display = 'block';
    this.flT = secs;
    this.shownFlash = text;
  }

  tick(dt) {
    if (this.flT > 0) { this.flT -= dt; if (this.flT <= 0) { this.fl.style.display = 'none'; this.shownFlash = ''; } }
  }

  // an inked arrow on the frame: a tapering stroke from a to b with a
  // brushed head (CSS px)
  arrow(a, b) {
    const c = this.arrowC;
    const W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    if (!a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (L < 10) return;
    const ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const rng = new RNG(311);
    // (polish: a dry brush, not a clean vector line - the shaft is a bundle
    // of bristles laid along the bowed path, each pressed at the start and
    // running dry at its own point toward the end, the gaps between them
    // torn; the head two pressed, ragged strokes)
    const at = (u, off) => {
      const bow = Math.sin(u * Math.PI) * L * 0.08;
      const kk = 1 - 14 / L;
      return [a.x + dx * u * kk + px * (bow + off), a.y + dy * u * kk + py * (bow + off)];
    };
    const width = (u) => 5 + 4 * Math.sin(Math.min(1, u / 0.3) * Math.PI / 2) * (1 - 0.5 * u);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const draw = (col, grow, seed) => {
      const r = new RNG(seed);
      g.strokeStyle = col; g.fillStyle = col;
      const NB = 11;
      for (let i = 0; i < NB; i++) {
        const v = (i / (NB - 1)) * 2 - 1;
        const dryAt = Math.abs(v) < 0.5 ? 1.01 : r.range(0.82, 1.01);
        const lw = r.range(1.2, 3.2) + grow * 0.8;
        g.lineWidth = lw;
        g.globalAlpha = r.range(0.75, 1);
        g.beginPath();
        const n = 24;
        let moved = false;
        for (let k = 0; k <= n; k++) {
          const u = k / n;
          if (u > dryAt) break;
          // (a gap now and then where the bristle skips)
          if (u > 0.3 && r.next() < 0.08 * (u / dryAt)) { moved = false; continue; }
          const [x, y] = at(u, v * (width(u) + grow) + r.gauss() * 0.4);
          if (!moved) { g.moveTo(x, y); moved = true; } else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      // the head: two pressed, ragged strokes meeting at the point
      const tip = [b.x + ux * grow, b.y + uy * grow];
      for (const sgn of [1, -1]) {
        const hw = 26 + grow, back = 40 + grow;
        const e = [b.x - ux * back + px * hw * sgn, b.y - uy * back + py * hw * sgn];
        for (let j = 0; j < 5; j++) {
          g.lineWidth = r.range(4.5, 8) + grow;
          g.globalAlpha = r.range(0.7, 1);
          const o = (j - 2) * 2.2;
          g.beginPath();
          g.moveTo(e[0] + px * o + r.gauss(), e[1] + py * o + r.gauss());
          g.quadraticCurveTo((e[0] + tip[0]) / 2 + ux * 4 + px * o * 0.5, (e[1] + tip[1]) / 2 + uy * 4 + py * o * 0.5, tip[0] + r.gauss() * 0.6, tip[1] + r.gauss() * 0.6);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      blob(g, a.x, a.y, 6 + grow, r, 0.3);
    };
    draw('rgba(5,5,5,0.85)', 2.5, 311);
    draw('#f2f0ea', 0, 312);
    void rng;
  }

  // the charge: a short brush stroke beside the fist, growing, grey to white
  charge(at, k) {
    const c = this.chargeC;
    const W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    if (!at || k <= 0) return;
    const rng = new RNG(97);
    const len = 30 + 110 * k, w = 4 + 7 * k;
    const v = Math.round(110 + 140 * k);
    const x0 = at.x, y0 = at.y;
    // (up and away from the fist, slightly curved, the end running dry)
    const dx = at.side > 0 ? 0.28 : -0.28, dy = -1;
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const draw = (col, grow) => {
      g.fillStyle = col;
      g.beginPath();
      const n = 14, pts = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, ww = (w + grow) * (u < 0.15 ? 0.7 + 2 * u : 1 - 0.75 * Math.max(0, u - 0.5) / 0.5);
        const bow = Math.sin(u * Math.PI) * len * 0.06 * (at.side > 0 ? 1 : -1);
        pts.push([x0 + ux * len * u + px * bow, y0 + uy * len * u + py * bow, ww]);
      }
      g.moveTo(pts[0][0] + px * pts[0][2], pts[0][1] + py * pts[0][2]);
      for (const [x, y, ww] of pts) g.lineTo(x + px * ww, y + py * ww);
      for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0] - px * pts[i][2], pts[i][1] - py * pts[i][2]);
      g.closePath(); g.fill();
      blob(g, x0, y0, (w + grow) * 0.9, rng, 0.25);
    };
    draw('rgba(5,5,5,0.85)', 2.5);
    draw(`rgb(${v},${v},${Math.round(v * 0.98)})`, 0);
  }

  clear() { this.card(''); this.fl.style.display = 'none'; this.flT = 0; this.shownFlash = ''; this.arrow(null); this.charge(null, 0); }
}

// the small inked pictures: the mouse, one button inked in; keys as dabs
function picture(pic) {
  if (!pic) return [];
  if (typeof pic === 'string' && pic.startsWith('mouse')) return [mouse(pic.slice(5))];
  const out = [];
  const list = Array.isArray(pic) ? pic : [pic];
  list.forEach((k, i) => {
    if (i && list.length < 4) { const p = document.createElement('span'); p.className = 'plus'; p.textContent = '+'; out.push(p); }
    const d = document.createElement('div'); d.className = 'key';
    const dab = makeKeyDab(hashSeed(k), 64, [236, 234, 228]); d.appendChild(dab);
    const s = document.createElement('span'); s.textContent = k; d.appendChild(s);
    out.push(d);
  });
  return out;
}

function mouse(which) {
  // (polish: 48 px tall, drawn at twice that for a crisp line)
  const c = document.createElement('canvas');
  c.width = 70; c.height = 96;
  c.style.width = '35px'; c.style.height = '48px';
  const g = c.getContext('2d');
  g.scale(70 / 44, 96 / 60);
  const rng = new RNG(which === 'L' ? 51 : 52);
  // the body: a pebble drawn in a pressed line
  const path = () => {
    g.beginPath();
    g.moveTo(22, 4);
    g.bezierCurveTo(38, 4, 41, 18, 40, 34);
    g.bezierCurveTo(39, 50, 31, 57, 22, 57);
    g.bezierCurveTo(13, 57, 5, 50, 4, 34);
    g.bezierCurveTo(3, 18, 6, 4, 22, 4);
    g.closePath();
  };
  // the button inked in
  g.save(); path(); g.clip();
  g.fillStyle = '#f2f0ea';
  if (which === 'L' || which === 'LR') g.fillRect(0, 0, 22, 24);
  if (which === 'R' || which === 'LR') g.fillRect(22, 0, 22, 24);
  g.restore();
  g.lineWidth = 3.4; g.strokeStyle = '#f2f0ea'; path(); g.stroke();
  g.lineWidth = 2.2; g.beginPath(); g.moveTo(22, 5); g.lineTo(22 + rng.gauss() * 0.5, 24); g.moveTo(5, 24.5); g.quadraticCurveTo(22, 26, 39, 24.5); g.stroke();
  return c;
}
