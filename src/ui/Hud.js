import { RNG } from '../util/rng.js';

// DOM overlay: title card (a dry-brush swash of white ink with NOIR EXTREME
// inked over it, "click to begin" below), the in-game HUD and the cards.
// Monochrome and ink-styled (DESIGN.md §8):
//   top left     WAVE / KILLS in a condensed serif (Baskerville / Georgia)
//   bottom right the drum count in a typewriter face (American Typewriter /
//                Courier New), RELOADING while the drum is swapped
//   bottom left  a thin ink health bar that bleeds red when low
//   centre       a tiny dot crosshair (opens a little with the spread)
//   cards        "WAVE 2" between waves; "THE END" on death (kills, waves,
//                click to try again)
// Hidden entirely in ?shot= mode unless hud=1.
export class Hud {
  constructor({ onBegin, onRestart }) {
    const style = document.createElement('style');
    style.textContent = `
      #hud { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: "American Typewriter", "Courier New", monospace; color: #e8e8e8; }
      #title { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.82) 78%); cursor: pointer; user-select: none; }
      #title .card, .ncard .card { position: relative; width: min(92vw, 1180px); aspect-ratio: 1180 / 400; display: flex; align-items: center; justify-content: center; }
      #title canvas, .ncard canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      #title h1, .ncard h1 { position: relative; margin: 0; font-family: "Bodoni 72", "Didot", "Playfair Display", Georgia, serif; font-weight: 700;
        font-size: min(9.2vw, 132px); letter-spacing: 0.03em; color: #080808; transform: scaleX(0.8); line-height: 1; white-space: nowrap; }
      #title p, .ncard p { position: relative; margin: 18px 0 0; font-family: "American Typewriter", "Courier New", monospace; font-size: 15px;
        letter-spacing: 0.42em; color: #cfcfcf; text-transform: uppercase; }
      #title.hidden, .ncard.hidden { display: none; }
      .ncard { position: fixed; inset: 0; z-index: 18; display: flex; flex-direction: column; align-items: center; justify-content: center;
        pointer-events: none; transition: opacity 0.6s; user-select: none; }
      .ncard .card { width: min(70vw, 820px); }
      .ncard h1 { font-size: min(7vw, 96px); }
      #endcard { background: radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.88) 80%); pointer-events: auto; cursor: pointer; }
      #endcard .stats { position: relative; margin-top: 10px; font-family: "Baskerville", Georgia, serif; font-size: 22px; letter-spacing: 0.2em;
        color: #e0e0e0; text-transform: uppercase; }
      #hud .tl { position: absolute; left: 34px; top: 26px; font-family: "Baskerville", "Baskerville Old Face", Georgia, serif;
        text-transform: uppercase; letter-spacing: 0.16em; color: #ececec; text-shadow: 0 0 3px #000, 0 0 1px #000; transform-origin: left top; transform: scaleX(0.86); }
      #hud .tl .wave { font-size: 30px; font-weight: 700; line-height: 1; }
      #hud .tl .kills { font-size: 16px; margin-top: 6px; color: #cfcfcf; }
      #hud .br { position: absolute; right: 38px; bottom: 30px; text-align: right; text-shadow: 0 0 3px #000, 0 0 1px #000; }
      #hud .br .ammo { font-size: 46px; line-height: 1; letter-spacing: 0.02em; }
      #hud .br .ammo small { font-size: 18px; color: #bdbdbd; letter-spacing: 0.1em; }
      #hud .br .note { font-size: 13px; letter-spacing: 0.35em; color: #d8d8d8; margin-top: 6px; min-height: 16px; }
      #hud .bl { position: absolute; left: 34px; bottom: 34px; width: 230px; }
      #hud .bl canvas { width: 230px; height: 26px; display: block; }
      #hud .bl .lab { font-family: "American Typewriter", "Courier New", monospace; font-size: 11px; letter-spacing: 0.4em; color: #bdbdbd; margin-bottom: 4px; text-shadow: 0 0 3px #000; }
      #hud .xh { position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px 0 0 -2px; border-radius: 50%; background: #f2f2f2;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.85); }
      #hud .xr { position: absolute; left: 50%; top: 50%; border-radius: 50%; border: 1px solid rgba(240,240,240,0.35); pointer-events: none; }
      #hud.titled .tl, #hud.titled .br, #hud.titled .bl, #hud.titled .xh, #hud.titled .xr { display: none; }
      #hud .msg { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); font-size: 13px; letter-spacing: 0.4em; color: #ddd; text-shadow: 0 0 3px #000; opacity: 0; transition: opacity 0.4s; }
    `;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hud';
    document.body.appendChild(this.root);
    this.root.innerHTML = `
      <div class="tl"><div class="wave">Wave 1</div><div class="kills">Kills 0</div></div>
      <div class="br"><div class="ammo">50<small> / 50</small></div><div class="note"></div></div>
      <div class="bl"><div class="lab">health</div><canvas width="460" height="52"></canvas></div>
      <div class="xr"></div><div class="xh"></div>
      <div class="msg"></div>`;
    this.el = {
      wave: this.root.querySelector('.wave'), kills: this.root.querySelector('.kills'),
      ammo: this.root.querySelector('.ammo'), note: this.root.querySelector('.note'),
      bar: this.root.querySelector('.bl canvas'), xr: this.root.querySelector('.xr'), msg: this.root.querySelector('.msg'),
    };
    this.barG = this.el.bar.getContext('2d');
    this.barRng = new RNG(77);
    this.barStrokes = makeBarStrokes(this.barRng);
    this._last = {};

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
    this.root.classList.add('titled');
    this.title.addEventListener('click', () => onBegin && onBegin());

    this.waveCard = makeCard('wavecard', 'WAVE 2', '', 1101);
    this.endCard = makeCard('endcard', 'THE END', 'click to try again', 1937);
    this.endStats = document.createElement('div');
    this.endStats.className = 'stats';
    this.endCard.card.parentNode.insertBefore(this.endStats, this.endCard.p);
    this.endCard.el.addEventListener('click', () => onRestart && onRestart());
    this.msgT = 0;
  }

  // (the HUD's readouts stay hidden behind the title card)
  showTitle(text = 'click to begin') { this.prompt.textContent = text; this.title.classList.remove('hidden'); this.root.classList.add('titled'); }
  hideTitle() { this.title.classList.add('hidden'); this.root.classList.remove('titled'); }
  setVisible(v) { this.visible = v; this.root.style.display = v ? '' : 'none'; if (!v) this.hideTitle(); }

  showWave(n) {
    this.waveCard.h1.textContent = 'WAVE ' + n;
    this.waveCard.el.classList.remove('hidden');
    this.waveCard.el.style.opacity = '1';
  }
  hideWave() { this.waveCard.el.style.opacity = '0'; setTimeout(() => { if (this.waveCard.el.style.opacity === '0') this.waveCard.el.classList.add('hidden'); }, 700); }
  showEnd(kills, waves) {
    this.endStats.textContent = `${kills} ${kills === 1 ? 'kill' : 'kills'}  ·  ${waves} ${waves === 1 ? 'wave' : 'waves'}`;
    this.endCard.el.classList.remove('hidden');
    this.endCard.el.style.opacity = '1';
  }
  hideEnd() { this.endCard.el.classList.add('hidden'); }
  message(text, secs = 1.4) { this.el.msg.textContent = text; this.el.msg.style.opacity = '1'; this.msgT = secs; }

  // s: { wave, kills, ammo, drum, reloading, hp, spread, dt }
  update(s) {
    const L = this._last, E = this.el;
    if (L.wave !== s.wave) { E.wave.textContent = 'Wave ' + s.wave; L.wave = s.wave; }
    if (L.kills !== s.kills) { E.kills.textContent = 'Kills ' + s.kills; L.kills = s.kills; }
    const ammoKey = s.ammo + '/' + s.reloading;
    if (L.ammo !== ammoKey) {
      E.ammo.innerHTML = `${s.reloading ? '--' : String(s.ammo).padStart(2, '0')}<small> / ${s.drum}</small>`;
      E.note.textContent = s.reloading ? 'reloading' : s.ammo === 0 ? 'press r' : s.ammo <= 10 ? 'low' : '';
      L.ammo = ammoKey;
    }
    const hp = Math.round(s.hp);
    if (L.hp !== hp) { drawBar(this.barG, hp / 100, this.barStrokes); L.hp = hp; }
    const r = Math.round(6 + s.spread * 500);
    if (L.xr !== r) {
      Object.assign(E.xr.style, { width: 2 * r + 'px', height: 2 * r + 'px', marginLeft: -r - 1 + 'px', marginTop: -r - 1 + 'px', opacity: s.spread > 0.008 ? '1' : '0' });
      L.xr = r;
    }
    if (this.msgT > 0) { this.msgT -= s.dt; if (this.msgT <= 0) E.msg.style.opacity = '0'; }
  }
}

function makeCard(id, title, sub, seed) {
  const el = document.createElement('div');
  el.id = id;
  el.className = 'ncard hidden';
  const card = document.createElement('div');
  card.className = 'card';
  const c = document.createElement('canvas');
  c.width = 1180; c.height = 400;
  drawSwash(c.getContext('2d'), 590, 200, 1040, 190, new RNG(seed));
  card.appendChild(c);
  const h1 = document.createElement('h1');
  h1.textContent = title;
  card.appendChild(h1);
  el.appendChild(card);
  const p = document.createElement('p');
  p.textContent = sub;
  el.appendChild(p);
  document.body.appendChild(el);
  return { el, card, h1, p };
}

// the health bar: a dry-brush ink stroke whose length is the health; below
// 35 % it bleeds red (the only colour on the HUD besides the blood)
function makeBarStrokes(rng) {
  const out = [];
  for (let i = 0; i < 70; i++) out.push({ y: rng.range(0.28, 0.72), w: rng.range(1.2, 3.2), a: rng.range(0.6, 1), end: rng.range(0.9, 1.0), start: rng.range(0, 0.04), wob: rng.range(0, 6) });
  return out;
}
function drawBar(g, f, strokes) {
  const W = g.canvas.width, H = g.canvas.height;
  g.clearRect(0, 0, W, H);
  // the empty track: a thin broken line
  g.strokeStyle = 'rgba(230,230,230,0.35)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(4, H * 0.5); g.lineTo(W - 4, H * 0.5); g.stroke();
  const low = f < 0.35;
  const col = low ? '200,16,46' : '236,236,236';
  g.lineCap = 'round';
  for (const s of strokes) {
    g.strokeStyle = `rgba(${col},${s.a})`;
    g.lineWidth = s.w;
    g.beginPath();
    const x0 = 6 + s.start * W, x1 = Math.max(x0, 6 + (W - 12) * f * s.end);
    g.moveTo(x0, H * s.y);
    g.quadraticCurveTo((x0 + x1) / 2, H * s.y + Math.sin(s.wob) * 2, x1, H * s.y + Math.cos(s.wob) * 1.5);
    g.stroke();
  }
  if (low && f > 0) {
    // drips off the stroke
    g.fillStyle = 'rgba(200,16,46,0.9)';
    for (let i = 0; i < 5; i++) {
      const x = 10 + ((i * 37) % Math.max(12, (W - 20) * f));
      g.fillRect(x, H * 0.62, 2, 4 + (i * 7) % 11);
    }
  }
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
