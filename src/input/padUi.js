import { input } from './Pad.js';
import { padGlyph, fillPadKeys } from './glyphs.js';
import { RNG } from '../util/rng.js';

// [C12] The pad on the cards (docs/story/briefs/C12_PAD.md §3, §4): the
// title's BEGIN / CONTINUE / CHAPTERS and the table of contents, the pause
// card (RESUME and its settings), THE END's card. The d-pad or the left stick
// moves a highlight - an ink bracket either side of the choice, never a
// browser focus ring -, X chooses, circle or options goes back. A choice is
// the same press a click would make on the same element (its own handler
// runs); the pad then starts or resumes the game itself, without the pointer
// lock a pad cannot ask for. And the lines that name keys are redrawn for the
// last device: the rulebook's keys on the title and the pause card, the
// pause and end cards' words, the sound line, the prompt, the teach card, the
// fight's cards, the stills' hint.
export class PadUi {
  constructor(pad) {
    this.pad = pad;
    pad.menu = this;
    pad.onDevice = () => this.refresh();
    pad.onContext = (ctx) => { if (ctx === 'title') this.titleIx = null; if (ctx === 'pause') this.pauseIx = 0; if (ctx !== 'title' && ctx !== 'pause' && ctx !== 'end') this.mark(null); this.refresh(); };
    const st = document.createElement('style');
    st.textContent = `
      #padsel { position: fixed; z-index: 30; pointer-events: none; display: none; }
      #padsel canvas { position: absolute; top: 0; height: 100%; }
      #title .toc .row.padsel { background: #eeece6; color: #000; }
      #title .toc .row.padsel b { color: #000; }
      body.padheld, body.padheld canvas { cursor: none; }
      .padline { display: inline-flex; align-items: center; gap: 6px; }
      .padline canvas { vertical-align: middle; }
    `;
    document.head.appendChild(st);
    this.sel = document.createElement('div');
    this.sel.id = 'padsel';
    this.selL = document.createElement('canvas'); this.selR = document.createElement('canvas');
    this.sel.appendChild(this.selL); this.sel.appendChild(this.selR);
    document.body.appendChild(this.sel);
    this.selH = 0;
    this.titleIx = null; this.tocIx = 0; this.pauseIx = 0;
  }
  get hud() { return this.pad.hud; }
  get game() { return this.pad.game; }

  // ---- the menus ------------------------------------------------------------------------
  step(ctx, nav) {
    if (ctx === 'title') this.title(nav);
    else if (ctx === 'pause') this.pause(nav);
    else if (ctx === 'end') this.end(nav);
  }
  // (a press as the mouse's on that element: its own handler runs)
  press(el, type = 'mousedown') { el.dispatchEvent(new MouseEvent(type, { button: 0, buttons: type === 'mousedown' ? 1 : 0, bubbles: true, cancelable: true, view: window })); }

  title(nav) {
    const H = this.hud, T = H.title;
    const toc = T.classList.contains('toc-open');
    // ([C12] after the critic: a choice by the pad needs the bracket already
    // up - the first press on a title the pad has not touched, the one that
    // wakes it in Chrome, only shows where the bracket stands)
    const awake = this.sel.style.display === 'block';
    if (!awake && (nav.ok || nav.back)) nav = { go: null, ok: false, back: false, opt: false };
    const opts = [...T.querySelectorAll('.opts .opt')].filter((o) => !o.classList.contains('hidden'));
    if (this.titleIx == null) { const c = opts.findIndex((o) => o.dataset.k === 'continue'); this.titleIx = c >= 0 ? c : 0; }
    for (const r of T.querySelectorAll('.toc .row.padsel')) r.classList.remove('padsel');
    if (toc) {
      const rows = [...T.querySelectorAll('.toc .row')].filter((r) => !r.classList.contains('off'));
      if (nav.go === 'up') this.tocIx = (this.tocIx + rows.length - 1) % rows.length;
      if (nav.go === 'down') this.tocIx = (this.tocIx + 1) % rows.length;
      const row = rows[Math.min(this.tocIx, rows.length - 1)];
      if (row && input.last === 'pad') row.classList.add('padsel');
      this.mark(row);
      if (nav.back) { T.classList.remove('toc-open'); this.titleIx = Math.max(0, opts.findIndex((o) => o.dataset.k === 'chapters')); return; }
      if (nav.ok && row) { this.pad.engaged = true; this.press(row); this.pad.cb.start && this.pad.cb.start(); }
      return;
    }
    if (nav.go === 'left' || nav.go === 'up') this.titleIx = (this.titleIx + opts.length - 1) % opts.length;
    if (nav.go === 'right' || nav.go === 'down') this.titleIx = (this.titleIx + 1) % opts.length;
    const o = opts[Math.min(this.titleIx, opts.length - 1)];
    this.mark(o);
    if (nav.ok && o) {
      if (o.dataset.k === 'chapters') { this.press(o); this.tocIx = 0; return; }
      this.pad.engaged = true;
      this.press(o);
      if (this.pad.cb.start) this.pad.cb.start();
    }
  }

  // the pause card: RESUME, then each setting (left / right change it)
  pause(nav) {
    const H = this.hud;
    const items = [H.pauseCard.go, ...H.settingsEl.querySelectorAll(':scope > span')];
    if (nav.go === 'up') this.pauseIx = (this.pauseIx + items.length - 1) % items.length;
    if (nav.go === 'down') this.pauseIx = (this.pauseIx + 1) % items.length;
    const ix = Math.min(this.pauseIx, items.length - 1);
    const it = items[ix];
    if (ix > 0 && (nav.go === 'left' || nav.go === 'right' || nav.ok)) {
      const i = it.querySelector(`i[data-d="${nav.go === 'left' ? -1 : 1}"]`) || it.querySelector('i[data-d="0"]');
      if (i) { this.press(i, 'click'); }
    }
    // (redrawn by the click: the highlight finds its item again)
    const now = [H.pauseCard.go, ...H.settingsEl.querySelectorAll(':scope > span')][ix];
    this.mark(now);
    if ((ix === 0 && nav.ok) || nav.back) { this.mark(null); this.pad.engaged = true; if (this.pad.cb.resume) this.pad.cb.resume(); }
  }

  end(nav) {
    const E = this.hud.endCard;
    this.mark(E.go);
    if (nav.ok) { this.pad.engaged = true; this.mark(null); this.press(E.el, 'click'); }
  }

  // the ink bracket either side of `el` (the pad's highlight)
  mark(el) {
    const S = this.sel;
    if (!el || input.last !== 'pad' || this.pad.ctx === 'off') { S.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { S.style.display = 'none'; return; }
    const h = Math.round(r.height + 10);
    if (h !== this.selH) { this.selH = h; drawBracket(this.selL, h, 1); drawBracket(this.selR, h, -1); }
    const w = parseFloat(this.selL.style.width);
    S.style.display = 'block';
    S.style.left = (r.left - w - 6).toFixed(0) + 'px'; S.style.top = (r.top - 5).toFixed(0) + 'px';
    S.style.width = (r.width + 2 * w + 12).toFixed(0) + 'px'; S.style.height = h + 'px';
    this.selL.style.left = '0px'; this.selR.style.right = '0px';
    this.selShown = el;
  }

  // ---- the words that name keys, for the last device ---------------------------------
  refresh() {
    const H = this.hud, G = this.game;
    if (!H || !G) return;
    const P = input.last === 'pad';
    if (!P) this.mark(null);
    // the rulebook's keys on the title and the pause card
    for (const el of [H.titleKeys, H.pauseCard.keys]) {
      if (!el) continue;
      if (P) { if (el.dataset.dev !== 'pad') { fillPadKeys(el); el.dataset.dev = 'pad'; } }
      else if (el.dataset.dev === 'pad') { el.textContent = H.keysText; el.dataset.dev = 'keys'; }
    }
    // the cards' words
    const line = (el, glyph, words, keysText) => {
      if (!el) return;
      if (P) { el.textContent = ''; const s = document.createElement('span'); s.className = 'padline'; s.appendChild(padGlyph(glyph, { h: 22 })); const t = document.createElement('span'); t.textContent = words; s.appendChild(t); el.appendChild(s); el.dataset.dev = 'pad'; }
      else if (el.dataset.dev === 'pad') { el.textContent = keysText; el.dataset.dev = 'keys'; }
    };
    if (H.paused && /click to resume|resume/.test(H.pauseCard.go.textContent)) line(H.pauseCard.go, 'cross', 'resume', 'click to resume');
    if (H.endShown) line(H.endCard.go, 'cross', H.endKind === 'cont' ? 'the title' : 'try again', H.endKind === 'cont' ? 'click for the title' : 'click to try again');
    if (H.soundLine && G.sfx) H.soundHint(!G.sfx.live, G.sfx.muted);
    // the prompt (redrawn on its next call), the teach card, the fight's card, the stills' hint
    if (H.kit && H.kit.redrawTeach) H.kit.redrawTeach();
    if (G.brawl && G.brawl._cards && G.brawl._cards.redraw) G.brawl._cards.redraw();
    if (G.stills && G.stills.refreshHint) G.stills.refreshHint();
  }
}

// a bracket in ink: a brush stroke down with its two serifs; dir 1 opens right ([), -1 left (])
function drawBracket(c, h, dir) {
  const w = Math.max(10, Math.round(h * 0.24)), sc = 2;
  c.width = w * sc; c.height = h * sc;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.scale(sc, sc);
  const rng = new RNG(dir > 0 ? 3101 : 3102);
  const x0 = dir > 0 ? 3 : w - 3, x1 = dir > 0 ? w - 1 : 1;
  for (const [col, lw] of [['rgba(0,0,0,0.85)', 5.2], ['#eeece6', 2.6]]) {
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x1, 3 + rng.gauss() * 0.4);
    g.quadraticCurveTo(x0, 2.5, x0 + rng.gauss() * 0.4, 7);
    g.lineTo(x0 + rng.gauss() * 0.5, h - 7);
    g.quadraticCurveTo(x0, h - 2.5, x1, h - 3 + rng.gauss() * 0.4);
    g.stroke();
  }
}
