import { RNG } from '../util/rng.js';

// DOM overlay: the in-game HUD and the ink cards (Phase 3b presentation).
// Monochrome and ink-styled (DESIGN.md §8); the only colour anywhere is one
// red splatter accent on the title and on the end card:
//   bottom right the drum count in a typewriter face (American Typewriter /
//                Courier New), RELOADING while the drum is swapped
//   bottom left  a thin ink health bar that bleeds red when low
//   centre       a tiny dot crosshair (opens a little with the spread)
//   cards        a black ink splatter (canvas: a blot of ragged lobes,
//                dry-brush drags running dry, spikes flung out ending in
//                drops, satellite drops, drips) with the lettering in paper
//                white over it:
//     title  "NOIR EXTREME" over the live street (the camera drifts, the
//            rain falls), "click to begin", the keys
//     end    "THE END", the kills, a one-line epitaph chosen at
//            random, "click to try again"
//     pause  pointer lock lost: the frame dims under a smaller card,
//            "click to resume"
// Hidden entirely in ?shot= mode unless hud=1 (shot=title / shot=end show
// their card).
const KEYS = 'WASD move · mouse aim · click fire · R reload · M sound';
// one line for the dead (chosen at random on the end card)
export const EPITAPHS = [
  'The rain washed the street clean. It always does.',
  'He came for the truth. The city paid him in lead.',
  'Nobody leaves this block. Some just stop walking.',
  'The night was young. He wasn’t, anymore.',
  'The lamps kept burning. He didn’t.',
  'Another name for the morning edition.',
  'He owed the city a debt. Tonight it collected.',
  'The el rolled on. It never stops for the dead.',
  'He was a good shot. The city was better.',
  'Cold coffee, cold rain, cold slab.',
  'In this town even the rain carries a gun.',
  'They’ll find him when the gutters run clear.',
];

export class Hud {
  // brush: the ink pass's dry-brush field (render/textures.js, a 1024^2
  // canvas, R/G/B = diagonal / vertical / horizontal stroke families): the
  // card splats' edges are frayed with it
  constructor({ onBegin, onRestart, onResume, brush = null }) {
    BRUSH = brush ? readBrush(brush) : null;
    const style = document.createElement('style');
    style.textContent = `
      #hud { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: "American Typewriter", "Courier New", monospace; color: #e8e8e8; }
      .ncard { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; user-select: none;
        transition: opacity 0.6s; font-family: "American Typewriter", "Courier New", monospace; }
      .ncard.hidden { display: none; }
      .ncard .card { position: relative; display: flex; align-items: center; justify-content: center; }
      .ncard .splat { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; height: auto; }
      .ncard h1 { position: relative; margin: 0; font-family: "Bodoni 72", "Didot", "Playfair Display", Georgia, serif; font-weight: 700;
        color: #f2f0ea; transform: scaleX(0.78); line-height: 1; white-space: nowrap; letter-spacing: 0.02em; }
      .ncard .sub { position: relative; margin: 16px 0 0; font-family: "Baskerville", Georgia, serif; font-size: 19px; letter-spacing: 0.24em; text-shadow: 0 0 6px #000, 0 0 2px #000;
        color: #dcdad4; text-transform: uppercase; min-height: 1em; }
      .ncard .epi { position: relative; margin: 14px 0 0; font-family: "Baskerville", Georgia, serif; font-style: italic; font-size: 19px;
        color: #cfcdc6; letter-spacing: 0.03em; max-width: 80vw; text-align: center; text-shadow: 0 0 6px #000, 0 0 2px #000; }
      .ncard .go { position: relative; margin: 26px 0 0; font-size: 14px; letter-spacing: 0.45em; color: #e6e4de; text-transform: uppercase; text-shadow: 0 0 5px #000; }
      .ncard .keys { position: relative; margin: 12px 0 0; font-size: 11px; letter-spacing: 0.2em; color: #a4a29c; text-transform: uppercase; text-shadow: 0 0 4px #000; }
      #title { z-index: 20; cursor: pointer; padding-top: 24vh; box-sizing: border-box;
        background: radial-gradient(ellipse at 50% 62%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.72) 100%); }
      #title h1 { font-size: min(10.5vw, 150px); }
      #title .go { margin-top: 40px; animation: noirBlink 2.6s ease-in-out infinite; }
      @keyframes noirBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      #endcard { z-index: 19; cursor: pointer; background: radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.88) 100%); }
      #endcard h1 { font-size: min(10vw, 140px); }
      #endcard .go { margin-top: 34px; }
      #pausecard { z-index: 21; cursor: pointer; background: rgba(4,4,4,0.6); }
      #pausecard h1 { font-size: min(6vw, 84px); }
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
      #hud.titled .br, #hud.titled .bl, #hud.titled .xh, #hud.titled .xr { display: none; }
      #hud .msg { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); font-size: 13px; letter-spacing: 0.4em; color: #ddd; text-shadow: 0 0 3px #000;
        opacity: 0; transition: opacity 0.4s; text-transform: uppercase; }
    `;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hud';
    document.body.appendChild(this.root);
    this.root.innerHTML = `
      <div class="br"><div class="ammo">50<small> / 50</small></div><div class="note"></div></div>
      <div class="bl"><div class="lab">health</div><canvas width="460" height="52"></canvas></div>
      <div class="xr"></div><div class="xh"></div>
      <div class="msg"></div>`;
    this.el = {
      ammo: this.root.querySelector('.ammo'), note: this.root.querySelector('.note'),
      bar: this.root.querySelector('.bl canvas'), xr: this.root.querySelector('.xr'), xh: this.root.querySelector('.xh'), msg: this.root.querySelector('.msg'),
    };
    this.barG = this.el.bar.getContext('2d');
    this.barRng = new RNG(77);
    this.barStrokes = makeBarStrokes(this.barRng);
    this._last = {};

    // the title: the big splat with its red accent, the lettering, the
    // prompt and the keys
    this.titleCard = makeCard('title', 'NOIR EXTREME', { w: 1400, h: 620, R: 190, wide: 5.6, vw: 94, seed: 1937, red: true, go: 'click to begin', keys: KEYS });
    this.title = this.titleCard.el;
    this.soundLine = document.createElement('p');
    this.soundLine.className = 'keys';
    this.soundLine.textContent = 'any key: sound';
    this.soundLine.style.display = 'none';
    this.title.appendChild(this.soundLine);
    this.prompt = this.titleCard.go;
    this.title.classList.remove('hidden');
    this.root.classList.add('titled');
    this.title.addEventListener('click', () => onBegin && onBegin());

    this.endCard = makeCard('endcard', 'THE END', { w: 1300, h: 620, R: 180, wide: 5.0, vw: 88, seed: 1942, red: true, sub: ' ', epi: ' ', go: 'click to try again' });
    this.endStats = this.endCard.sub;
    this.endCard.el.addEventListener('click', () => onRestart && onRestart());
    this.pauseCard = makeCard('pausecard', 'PAUSED', { w: 900, h: 400, R: 96, wide: 5.2, vw: 56, seed: 777, go: 'click to resume', keys: KEYS });
    this.pauseCard.el.addEventListener('click', () => { const f = onResume || onBegin; if (f) f(); });
    this.msgT = 0;
    this.paused = false;
    this.epiRng = null;       // (shot mode: a seeded epitaph)
  }

  // the title's hint while the browser still holds the sound back
  soundHint(on) { this.soundLine.style.display = on ? '' : 'none'; }

  // (the HUD's readouts stay hidden behind the title card)
  showTitle(text = 'click to begin') { this.prompt.textContent = text; this.title.classList.remove('hidden'); this.root.classList.add('titled'); }
  hideTitle() { this.title.classList.add('hidden'); this.retitle(); }
  setVisible(v) { this.visible = v; this.root.style.display = v ? '' : 'none'; if (!v) this.hideTitle(); }
  get titleShown() { return !this.title.classList.contains('hidden'); }
  get endShown() { return !this.endCard.el.classList.contains('hidden'); }
  retitle() { this.root.classList.toggle('titled', this.titleShown || this.paused || this.endShown); }

  // pointer lock lost in play: the frame dims under the pause card
  showPause(text = 'click to resume') {
    this.paused = true;
    this.pauseCard.go.textContent = text;
    this.pauseCard.el.classList.remove('hidden');
    this.retitle();
  }
  hidePause() { this.paused = false; this.pauseCard.el.classList.add('hidden'); this.retitle(); }

  showEnd(kills) {
    this.endStats.textContent = `${kills} ${kills === 1 ? 'kill' : 'kills'}`;
    const r = this.epiRng ? this.epiRng.next() : Math.random();
    this.endCard.epi.textContent = EPITAPHS[Math.floor(r * EPITAPHS.length) % EPITAPHS.length];
    this.endCard.el.classList.remove('hidden');
    this.endCard.el.style.opacity = '1';
    this.retitle();
  }
  hideEnd() { this.endCard.el.classList.add('hidden'); this.retitle(); }
  message(text, secs = 1.4) { this.el.msg.textContent = text; this.el.msg.style.opacity = '1'; this.msgT = secs; }

  // s: { ammo, drum, reloading, hp, spread, dt }
  update(s) {
    const L = this._last, E = this.el;
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

// An ink card: the splat (a canvas behind everything, centred on the
// lettering, its width a share `vw` of the window up to its pixel size),
// the title and the optional lines under it.
function makeCard(id, title, { w, h, R, wide, vw, seed, red = false, sub = null, epi = null, go = null, keys = null }) {
  const el = document.createElement('div');
  el.id = id;
  el.className = 'ncard hidden';
  const card = document.createElement('div');
  card.className = 'card';
  const c = document.createElement('canvas');
  c.className = 'splat';
  c.width = w; c.height = h;
  c.style.width = `min(${vw}vw, ${w}px)`;
  const g = c.getContext('2d');
  // each splat is laid down on its own sheet, its edge frayed by the brush
  // field, then pressed onto the card
  const sheet = (draw, col, seed2) => {
    const t = document.createElement('canvas');
    t.width = w; t.height = h;
    draw(t.getContext('2d'));
    frayEdges(t, col, new RNG(seed2), R);
    g.drawImage(t, 0, 0);
  };
  sheet((gg) => drawInkSplat(gg, w / 2, h * 0.5, R, new RNG(seed), '#060606', { wide }), [6, 6, 6], seed + 31);
  // the one colour: a red splatter caught on the ink's right flank
  if (red) sheet((gg) => drawInkSplat(gg, w / 2 + R * wide * 0.33, h * 0.5 + R * 0.5, R * 0.22, new RNG(seed + 7), '#c8102e', { wide: 1.25, spikes: 16, drops: 22, drags: 0, drips: 2, spikeLen: 1.6 }), [200, 16, 46], seed + 37);
  card.appendChild(c);
  const h1 = document.createElement('h1');
  h1.textContent = title;
  card.appendChild(h1);
  el.appendChild(card);
  const line = (cls, text) => { if (text == null) return null; const p = document.createElement('p'); p.className = cls; p.textContent = text; el.appendChild(p); return p; };
  const subEl = line('sub', sub), epiEl = line('epi', epi), goEl = line('go', go), keysEl = line('keys', keys);
  document.body.appendChild(el);
  return { el, card, h1, sub: subEl, epi: epiEl, go: goEl, keys: keysEl, canvas: c };
}

// The dry-brush field as bytes (read once; null without a brush)
let BRUSH = null;
function readBrush(img) {
  try {
    const n = img.width;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return { n, d: g.getImageData(0, 0, n, n).data };
  } catch (e) { return null; }
}

// Fray a splat's edge like the fireball's and the smoke's (Phase 3b review:
// the canvas lobes printed as smooth vector curves). The sheet's alpha is
// softened a few pixels and re-thresholded against the brush field (two
// octaves, jittered per sheet, the diagonal family inside the blot, the
// horizontal one along the drags): where the field is strong the ink
// reaches past the old edge in dry-brush streaks, where it is weak the
// paper bites into it, so every lobe ends in bristle marks, not a curve.
function frayEdges(cv, rgb, rng, R) {
  if (!BRUSH) return;
  const w = cv.width, h = cv.height;
  const g = cv.getContext('2d');
  const src = g.getImageData(0, 0, w, h);
  // the softened alpha: the band where the brush decides
  const b = document.createElement('canvas');
  b.width = w; b.height = h;
  const bg = b.getContext('2d');
  const blur = Math.max(1.5, R * 0.022);
  bg.filter = `blur(${blur.toFixed(1)}px)`;
  bg.drawImage(cv, 0, 0);
  const soft = bg.getImageData(0, 0, w, h).data;
  const { n, d } = BRUSH;
  const s0 = rng.range(0.55, 0.75), s1 = s0 * rng.range(1.9, 2.3);
  const ox0 = Math.floor(rng.next() * n), oy0 = Math.floor(rng.next() * n);
  const ox1 = Math.floor(rng.next() * n), oy1 = Math.floor(rng.next() * n);
  const out = src.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const a = soft[k + 3] / 255;
      if (a <= 0.004 || (a >= 0.996 && out[k + 3] === 255)) { if (a <= 0.004) out[k + 3] = 0; continue; }
      const i0 = ((((y * s0 + oy0) | 0) % n) * n + (((x * s0 + ox0) | 0) % n)) * 4;
      const i1 = ((((y * s1 + oy1) | 0) % n) * n + (((x * s1 + ox1) | 0) % n)) * 4;
      // diagonal strokes, with the horizontal family mixed in (the drags)
      const f = (d[i0] * 0.6 + d[i0 + 2] * 0.4) * 0.6 / 255 + (d[i1] * 0.5 + d[i1 + 2] * 0.5) * 0.4 / 255;
      // (half the sheet's own alpha: a thin spike or drag keeps its body
      // and frays along its sides instead of melting into the blur)
      const v = 0.5 * (a + out[k + 3] / 255) + (f - 0.5) * 0.85;
      const t = Math.min(1, Math.max(0, (v - 0.44) / 0.12));
      out[k] = rgb[0]; out[k + 1] = rgb[1]; out[k + 2] = rgb[2];
      out[k + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  g.putImageData(src, 0, 0);
}

// An ink splatter, as a loaded brush and a flicked pen leave it: a blot of
// overlapping ragged lobes along a flattened ellipse (the lettering sits on
// it), dry-brush drags pulled out left and right whose bristles run dry,
// spikes flung out of the blot each ending in a drop, satellite drops
// thinning with distance, and a few drips running down from the bottom.
function drawInkSplat(g, cx, cy, R, rng, col, { wide = 4, spikes = 30, drops = 80, drags = 1, drips = 4, spikeLen = 1 } = {}) {
  g.save();
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const half = R * wide * 0.5;           // half-length of the blot
  const nL = Math.max(3, Math.round(wide * 3));
  for (let i = 0; i < nL; i++) {
    const t = i / (nL - 1) - 0.5;         // -0.5 .. 0.5 along
    const x = cx + t * half * 1.7 + rng.gauss() * R * 0.06;
    const y = cy + rng.gauss() * R * 0.1;
    // (the ends taper: a stroke of the loaded brush, not a sausage)
    const r = R * (0.3 + 0.6 * Math.pow(Math.cos(t * Math.PI), 0.8)) * rng.range(0.8, 1.12);
    blob(g, x, y, r, rng, 0.18);
  }
  blob(g, cx, cy, R * 0.95, rng, 0.1);
  // splash lobes where the ink hit hardest: fat bulges pushed out of the
  // rim, and a fringe of small blots breaking the rim's line
  const rimAt = (a) => 1 / Math.sqrt((Math.cos(a) / (half * 0.85)) ** 2 + (Math.sin(a) / (R * 0.78)) ** 2);
  for (let i = 0; i < 9; i++) {
    const a = rng.next() * Math.PI * 2, rr = rimAt(a);
    blob(g, cx + Math.cos(a) * rr * 0.95, cy + Math.sin(a) * rr * 0.95, R * rng.range(0.16, 0.34), rng, 0.3);
  }
  for (let i = 0; i < 70; i++) {
    const a = rng.next() * Math.PI * 2, rr = rimAt(a) * rng.range(0.96, 1.08);
    blob(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, R * rng.range(0.03, 0.1), rng, 0.35);
  }
  // dry-brush drags off both ends
  for (let side = -1; side <= 1; side += 2) {
    const n = Math.round(110 * drags);
    for (let i = 0; i < n; i++) {
      const dy = rng.gauss() * R * 0.3;
      const y0 = cy + dy;
      const x0 = cx + side * half * rng.range(0.6, 0.8);
      const len = R * rng.range(0.4, 1.4) * Math.max(0.15, 1 - Math.abs(dy) / (R * 0.8));
      const dryAt = rng.range(0.35, 0.85);
      g.lineWidth = rng.range(1.4, 4.5);
      g.globalAlpha = rng.range(0.75, 1);
      g.beginPath();
      g.moveTo(x0, y0);
      let drawing = true;
      for (let k = 1; k <= 20; k++) {
        const u = k / 20;
        const x = x0 + side * len * u, y = y0 + Math.sin(u * 2.4) * R * 0.03 + rng.gauss() * 0.5;
        const skip = u > dryAt && rng.next() < (u - dryAt) * 2.6;
        if (skip) { drawing = false; g.moveTo(x, y); } else if (!drawing) { drawing = true; g.moveTo(x, y); } else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  // spikes flung out of the blot, each tapering to a drop
  for (let i = 0; i < spikes; i++) {
    const a = rng.next() * Math.PI * 2;
    const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
    // start on the blot's rim (an ellipse half x R*0.9)
    const rim = 1 / Math.sqrt((ux / (half * 0.85)) ** 2 + (uy / (R * 0.8)) ** 2);
    const len = R * rng.range(0.25, 0.95) * spikeLen * (rng.next() < 0.25 ? 1.6 : 1);
    const w0 = R * rng.range(0.03, 0.075);
    const bx = cx + ux * rim * 0.92, by = cy + uy * rim * 0.92;
    const tx = bx + ux * len, ty = by + uy * len;
    g.beginPath();
    g.moveTo(bx + px * w0, by + py * w0);
    g.quadraticCurveTo(bx + ux * len * 0.6 + px * w0 * 0.25, by + uy * len * 0.6 + py * w0 * 0.25, tx, ty);
    g.quadraticCurveTo(bx + ux * len * 0.6 - px * w0 * 0.25, by + uy * len * 0.6 - py * w0 * 0.25, bx - px * w0, by - py * w0);
    g.fill();
    if (rng.next() < 0.7) blob(g, tx + ux * w0 * 1.5, ty + uy * w0 * 1.5, w0 * rng.range(0.9, 1.7), rng, 0.25);
  }
  // satellite drops
  for (let i = 0; i < drops; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.range(1.05, 1.9);
    const x = cx + Math.cos(a) * half * 0.9 * d, y = cy + Math.sin(a) * R * 0.9 * d;
    const r = (R * 0.06 * Math.pow(rng.next(), 1.6)) / d + 1.3;
    blob(g, x, y, r, rng, 0.3);
  }
  // drips off the bottom
  for (let i = 0; i < drips; i++) {
    const x = cx + rng.range(-0.55, 0.55) * half;
    const y0 = cy + R * rng.range(0.4, 0.6);
    const len = R * rng.range(0.25, 0.75);
    const w = R * rng.range(0.022, 0.04);
    g.beginPath();
    g.moveTo(x - w, y0);
    g.quadraticCurveTo(x - w * 0.5, y0 + len * 0.7, x - w * 0.35, y0 + len);
    g.arc(x, y0 + len, w * 0.9, Math.PI, 0, true);
    g.quadraticCurveTo(x + w * 0.5, y0 + len * 0.7, x + w, y0);
    g.fill();
  }
  g.restore();
}
function blob(g, x, y, r, rng, jag = 0.2) {
  const n = 18 + Math.round(r / 6);
  const ph = rng.next() * 6.28;
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * (1 + jag * (0.6 * Math.sin(a * 3 + ph) * rng.next() + 0.5 * (rng.next() - 0.5)));
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
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
