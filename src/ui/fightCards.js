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

  tick(dt, side = null, dur = 0) {
    // (tick(at, side, dur): the opening's tick - see mark())
    if (typeof dt === 'object' && dt) { this.mark(dt, side, dur); return; }
    if (this.flT > 0) { this.flT -= dt; if (this.flT <= 0) { this.fl.style.display = 'none'; this.shownFlash = ''; } }
    // the burst: two frames of game time
    if (this.bursts && this.bursts.length) {
      for (const b of this.bursts) b.f++;
      this.bursts = this.bursts.filter((b) => b.f < 2);
      this.drawBurst();
    }
    // the ticks run out
    if (this.ticks && this.ticks.length) {
      for (const k of this.ticks) k.t -= dt;
      this.ticks = this.ticks.filter((k) => k.t > 0);
      this.drawTicks();
    }
    // his health: the lost part flashes white, holds a moment, drains
    const B = this.hbS;
    if (B) {
      let ch = false;
      if (B.flash > 0) { B.flash -= dt; ch = true; }
      if (B.hold > 0) B.hold -= dt;
      else if (B.drain > B.f + 1e-4) { B.drain = Math.max(B.f, B.drain - dt * 0.55); ch = true; }
      if (ch || B.dirty) { B.dirty = false; this.drawHealth(); }
    }
  }

  // ---- the impact (FIGHT.md v3 §5.3): a jagged white ink burst at the
  // point of contact, px across (90 for a jab .. 220 for a full hard punch at
  // 1440 x 900, scaled with the frame's height), held two frames of game
  // time (the hit stop holds it with the world), the second broken open
  burst(at, px, seed = 1) {
    if (!at) return;
    this.bursts = [{ x: at.x, y: at.y, r: px * innerHeight / 900 / 2, f: 0, seed }];
    this.drawBurst();
  }
  drawBurst() {
    const c = this.burstC || (this.burstC = (() => { const e = document.createElement('canvas'); e.className = 'burst'; e.style.cssText = 'position:absolute;left:0;top:0'; this.root.appendChild(e); return e; })());
    const W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (const b of this.bursts || []) {
      const r = new RNG(b.seed * 31 + b.f);
      const n = 13 + r.int(0, 4);
      const pts = [];
      const rot = r.next() * 6.28;
      for (let i = 0; i < n * 2; i++) {
        const a = rot + (i / (n * 2)) * Math.PI * 2 + r.gauss() * 0.06;
        const spike = i % 2 === 0;
        const R = b.r * (spike ? r.range(0.72, 1.0) * (r.next() < 0.25 ? 1.18 : 1) : r.range(0.3, 0.45)) * (b.f ? 1.12 : 1);
        pts.push([b.x + Math.cos(a) * R, b.y + Math.sin(a) * R]);
      }
      const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
      g.lineJoin = 'miter';
      if (!b.f) {
        // the first frame: a solid paper-white star with a black ink edge
        path(); g.lineWidth = 4; g.strokeStyle = 'rgba(5,5,5,0.9)'; g.stroke();
        g.fillStyle = '#f4f2ec'; g.fill();
      } else {
        // the second: the star broken open - its spikes only, and flung drops
        g.lineCap = 'round';
        for (let i = 0; i < pts.length; i += 2) {
          const [x, y] = pts[i];
          const dx = x - b.x, dy = y - b.y;
          g.strokeStyle = 'rgba(5,5,5,0.85)'; g.lineWidth = 5.5;
          g.beginPath(); g.moveTo(b.x + dx * 0.55, b.y + dy * 0.55); g.lineTo(x, y); g.stroke();
          g.strokeStyle = '#f4f2ec'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(b.x + dx * 0.55, b.y + dy * 0.55); g.lineTo(x, y); g.stroke();
          if (r.next() < 0.5) { g.fillStyle = '#f4f2ec'; g.beginPath(); g.arc(b.x + dx * 1.25, b.y + dy * 1.25, r.range(1.5, 3.5), 0, 6.28); g.fill(); }
        }
      }
    }
  }

  // ---- the opening's tick (FIGHT.md v3 §3): for its first 0.15 s a small
  // white ink tick flicks at the open side of his jaw (at: CSS px of that
  // side; side 'L' | 'R' of the screen)
  mark(at, side, dur = 0.15) {
    if (!at) return;
    (this.ticks || (this.ticks = [])).push({ x: at.x, y: at.y, side, t: dur, dur, seed: Math.floor(at.x * 7 + at.y * 13) });
    this.drawTicks();
  }
  drawTicks() {
    const c = this.tickC || (this.tickC = (() => { const e = document.createElement('canvas'); e.className = 'ticks'; e.style.cssText = 'position:absolute;left:0;top:0'; this.root.appendChild(e); return e; })());
    const W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    for (const k of this.ticks || []) {
      const u = 1 - k.t / k.dur;
      const s = k.side === 'L' ? -1 : 1;
      const r = new RNG(k.seed);
      // two short strokes flicked outward from the jaw, growing then thinning
      const len = 10 + 14 * Math.min(1, u * 3), w = 3.2 * (1 - u * 0.6);
      for (const [ang, off] of [[-0.35, 0], [0.25, 7]]) {
        const a = ang + r.gauss() * 0.05;
        const x0 = k.x + s * off, y0 = k.y + off * 0.6;
        const dx = s * Math.cos(a), dy = Math.sin(a);
        g.strokeStyle = 'rgba(5,5,5,0.8)'; g.lineWidth = w + 2.5;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * len, y0 + dy * len); g.stroke();
        g.strokeStyle = '#f2f0ea'; g.lineWidth = w;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * len, y0 + dy * len); g.stroke();
      }
    }
  }

  // ---- his health (FIGHT.md v3 §5.7): a thin ink bar at the top of the
  // frame with his name; the lost part flashes white and drains
  health(f, name = 'MACK', reset = false) {
    if (f == null) { if (this.hbEl) this.hbEl.style.display = 'none'; this.hbS = null; return; }
    if (!this.hbEl) {
      const el = document.createElement('div');
      el.className = 'hb';
      el.style.cssText = `position:absolute;left:50%;top:26px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;font-family:${TYPE};font-size:13px;letter-spacing:0.34em;color:#efede7;text-shadow:0 0 4px #000,0 0 2px #000`;
      el.innerHTML = '<span class="n"></span><canvas width="420" height="22"></canvas>';
      this.root.appendChild(el);
      this.hbEl = el; this.hbC = el.querySelector('canvas'); this.hbN = el.querySelector('.n');
      this.hbStrokes = []; const r = new RNG(771);
      for (let i = 0; i < 26; i++) this.hbStrokes.push({ y: r.range(0.3, 0.7), w: r.range(1.0, 2.4), a: r.range(0.65, 1), end: r.range(0.94, 1.0), start: r.range(0, 0.03), wob: r.range(0, 6) });
    }
    this.hbEl.style.display = 'flex';
    this.hbN.textContent = name;
    let B = this.hbS;
    if (!B || reset) B = this.hbS = { f, drain: f, flash: 0, hold: 0, dirty: true };
    if (f < B.f - 1e-4) { B.flash = 0.1; B.hold = 0.3; B.drain = Math.max(B.drain, B.f); B.dirty = true; }
    if (f > B.f + 1e-4) { B.drain = f; B.dirty = true; }
    B.f = f;
    if (B.dirty) { B.dirty = false; this.drawHealth(); }
  }
  drawHealth() {
    const B = this.hbS, g = this.hbC && this.hbC.getContext('2d');
    if (!B || !g) return;
    const W = this.hbC.width, H = this.hbC.height;
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    // the track: a thin broken line
    g.strokeStyle = 'rgba(230,230,230,0.3)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(3, H * 0.5); g.lineTo(W - 3, H * 0.5); g.stroke();
    const stroke = (f0, f1, col) => {
      for (const s of this.hbStrokes) {
        const x0 = 4 + (W - 8) * Math.max(f0, s.start), x1 = 4 + (W - 8) * f1 * s.end;
        if (x1 <= x0) continue;
        g.strokeStyle = col.replace('A', s.a.toFixed(2)); g.lineWidth = s.w;
        g.beginPath(); g.moveTo(x0, H * s.y); g.quadraticCurveTo((x0 + x1) / 2, H * s.y + Math.sin(s.wob) * 1.5, x1, H * s.y + Math.cos(s.wob)); g.stroke();
      }
    };
    stroke(0, B.f, 'rgba(226,224,218,A)');
    // the part just lost: paper white while it flashes, then grey, draining
    if (B.drain > B.f) stroke(B.f, B.drain, B.flash > 0 ? 'rgba(255,255,255,A)' : 'rgba(130,130,128,A)');
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
