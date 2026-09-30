import { RNG } from '../util/rng.js';
import { setBrush, frayEdges, drawInkSplat, makeTornStroke, makeKeyDab, makeTick, hashSeed } from './inkArt.js';

// DOM overlay: the in-game HUD and the ink cards (Phase 3b presentation,
// the story pass). Monochrome and ink-styled (DESIGN.md §8); the only colour
// anywhere is one red splatter accent on the title and on the end card:
//   bottom right the drum count in a typewriter face (American Typewriter /
//                Courier New), RELOADING while the drum is swapped: only
//                while a gun is out
//   bottom left  a thin ink health bar that bleeds red when low: only in a
//                fight
//   centre       a tiny dot crosshair (opens a little with the spread): only
//                while a gun is out
//   the story's lines (CONTRACTS §4.1, §12.1):
//     prompt     `E  light up` low in the frame in the typewriter face, the
//                key letter on a dab of ink, a brush tick at the thing
//     subtitle   one line (42 characters at most), bottom centre, paper
//                white on a torn black brush stroke, 2.2 s of game time
//     chapter    a roman numeral and a name (`I` / `The Diner`) in the
//                title's lettering, 2.4 s, faded on game time
//   cards        a black ink splatter (canvas: a blot of ragged lobes,
//                dry-brush drags running dry, spikes flung out ending in
//                drops, satellite drops, drips) with the lettering in paper
//                white over it:
//     title  "NOIR EXTREME" over the live picture of the diner from across
//            the street in the rain; BEGIN, and CONTINUE when a save exists
//     end    "THE END" and a one-line epitaph (the old battle's death), or
//            "To be continued" (the end of the slice); no counters
//     pause  pointer lock lost: the frame dims under a smaller card,
//            "click to resume", a settings line (mouse, volume, subtitles)
// Hidden entirely in ?shot= mode unless hud=1 (shot=title / shot=end show
// their card). Every timer runs on game time (tick), never on the page's.
const KEYS = 'WASD walk · mouse look · E use · F smoke · M sound · ESC pause';
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
const SERIF = '"Bodoni 72", "Didot", "Playfair Display", Georgia, serif';
const BOOK = '"Baskerville", Georgia, serif';
const TYPE = '"American Typewriter", "Courier New", monospace';
const SAY_FONT = `22px ${BOOK}`;

export class Hud {
  // brush: the ink pass's dry-brush field (render/textures.js, a 1024^2
  // canvas, R/G/B = diagonal / vertical / horizontal stroke families): the
  // card splats' and strokes' edges are frayed with it
  constructor({ onBegin, onContinue = null, onChapter = null, onRestart, onResume, onSetting = null, brush = null }) {
    setBrush(brush);
    this.onSetting = onSetting;
    const style = document.createElement('style');
    style.textContent = `
      #hud { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: ${TYPE}; color: #e8e8e8; }
      .ncard { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; user-select: none;
        transition: opacity 0.6s; font-family: ${TYPE}; }
      .ncard.hidden { display: none; }
      .ncard .card { position: relative; display: flex; align-items: center; justify-content: center; }
      .ncard .splat { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; height: auto; }
      .ncard h1 { position: relative; margin: 0; font-family: ${SERIF}; font-weight: 700;
        color: #f2f0ea; transform: scaleX(0.78); line-height: 1; white-space: nowrap; letter-spacing: 0.02em; }
      .ncard .sub { position: relative; margin: 16px 0 0; font-family: ${BOOK}; font-size: 19px; letter-spacing: 0.24em; text-shadow: 0 0 6px #000, 0 0 2px #000;
        color: #dcdad4; text-transform: uppercase; min-height: 1em; }
      .ncard .sub:empty { display: none; }
      .ncard .epi { position: relative; margin: 14px 0 0; font-family: ${BOOK}; font-style: italic; font-size: 19px;
        color: #cfcdc6; letter-spacing: 0.03em; max-width: 80vw; text-align: center; text-shadow: 0 0 6px #000, 0 0 2px #000; }
      .ncard .epi:empty { display: none; }
      .ncard .go { position: relative; margin: 26px 0 0; font-size: 14px; letter-spacing: 0.45em; color: #e6e4de; text-transform: uppercase; text-shadow: 0 0 5px #000; }
      .ncard .go:empty { display: none; }
      .ncard .keys { position: relative; margin: 12px 0 0; font-size: 11px; letter-spacing: 0.2em; color: #b8b6b0; text-transform: uppercase; text-shadow: 0 0 4px #000; }
      #title { z-index: 20; cursor: pointer; justify-content: flex-start; padding: 5vh 0 5vh; box-sizing: border-box;
        background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.38) 13%, rgba(0,0,0,0) 30%),
          radial-gradient(ellipse at 46% 36%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.6) 100%); }
      #title .card { position: absolute; left: 30%; top: 22%; transform: translate(-50%, -50%); margin: 0; }
      #title h1 { font-size: min(6.4vw, 92px); }
      #title .opts { margin-top: auto; display: flex; gap: 0; align-items: center; font-size: 17px; letter-spacing: 0.5em; color: #eeece6; text-transform: uppercase; }
      #title .opt { position: relative; padding: 16px 30px 16px 38px; cursor: pointer; text-shadow: 0 0 6px #000, 0 0 2px #000; }
      #title .opt canvas { position: absolute; left: 50%; top: 50%; transform: translate(-46%, -50%); pointer-events: none; }
      #title .opt span { position: relative; }
      #title .opt.hidden { display: none; }
      #title .opt:hover canvas { opacity: 1; }
      #title .sep { width: 6px; height: 6px; border-radius: 50%; background: #d8d6d0; box-shadow: 0 0 4px #000; }
      #title .sep.hidden { display: none; }
      #title .go { margin-top: 10px; animation: noirBlink 2.6s ease-in-out infinite; }
      #title .toc { display: none; position: absolute; right: 5%; top: 46%; transform: translateY(-50%); z-index: 2; padding: min(2.2vh, 18px) 6px; text-transform: uppercase;
        color: #eeece6; background: #050505; border: 1px solid #55534e; box-shadow: 0 0 0 5px #050505, 0 0 34px 14px rgba(0, 0, 0, 0.8); }
      #title.toc-open .toc { display: block; }
      #title .toc .row { display: flex; align-items: baseline; gap: 1.3em; padding: min(1.15vh, 9px) 30px min(1.15vh, 9px) 18px; font-size: min(1.75vw, 2.6vh, 16px); letter-spacing: 0.34em; cursor: pointer; white-space: nowrap; }
      #title .toc .row b { display: inline-block; width: 3.6em; text-align: right; font-weight: normal; color: #a9a7a1; letter-spacing: 0.2em; }
      #title .toc .row:hover { background: #eeece6; color: #000; }
      #title .toc .row:hover b { color: #000; }
      #title .toc .row.off, #title .toc .row.off b { color: #4f4e4a; cursor: default; }
      #title .toc .row.off:hover { background: none; color: #4f4e4a; }
      #title .toc .row.off:hover b { color: #4f4e4a; }
      #title .keys { margin-top: 14px; }
      @keyframes noirBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      #endcard { z-index: 19; cursor: pointer; background: radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.88) 100%); }
      #endcard h1 { font-size: min(10vw, 140px); }
      #endcard.cont h1 { font-style: italic; font-weight: 400; font-size: min(8.4vw, 118px); letter-spacing: 0.01em; transform: scaleX(0.86); }
      #endcard .go { margin-top: 34px; }
      #pausecard { z-index: 21; cursor: pointer; background: rgba(4,4,4,0.6); }
      #pausecard h1 { font-size: min(6vw, 84px); }
      #pausecard .set { position: relative; margin: 30px 0 0; font-size: 12px; letter-spacing: 0.28em; color: #bdbbb5; text-transform: uppercase; text-shadow: 0 0 4px #000; display: flex; gap: 34px; }
      #pausecard .set b { font-weight: normal; color: #f0eee8; display: inline-block; min-width: 1.6em; text-align: center; }
      #pausecard .set i { font-style: normal; cursor: pointer; padding: 2px 8px; color: #f0eee8; }
      #pausecard .set i:hover { color: #fff; text-shadow: 0 0 6px #fff; }
      #hud .br { position: absolute; right: 38px; bottom: 30px; text-align: right; text-shadow: 0 0 3px #000, 0 0 1px #000; }
      #hud .br .ammo { font-size: 46px; line-height: 1; letter-spacing: 0.02em; }
      #hud .br .ammo small { font-size: 18px; color: #bdbdbd; letter-spacing: 0.1em; }
      #hud .br .note { font-size: 13px; letter-spacing: 0.35em; color: #d8d8d8; margin-top: 6px; min-height: 16px; }
      #hud .bl { position: absolute; left: 34px; bottom: 34px; width: 230px; }
      #hud .bl canvas { width: 230px; height: 26px; display: block; }
      #hud .bl .lab { font-family: ${TYPE}; font-size: 11px; letter-spacing: 0.4em; color: #bdbdbd; margin-bottom: 4px; text-shadow: 0 0 3px #000; }
      #hud .xh { position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px 0 0 -2px; border-radius: 50%; background: #f2f2f2;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.85); }
      #hud .xr { position: absolute; left: 50%; top: 50%; border-radius: 50%; border: 1px solid rgba(240,240,240,0.35); pointer-events: none; }
      #hud.titled .layer { display: none !important; }
      #hud.titled .br, #hud.titled .bl, #hud.titled .xh, #hud.titled .xr, #hud.titled .prompt, #hud.titled .tick, #hud.titled .say, #hud.titled .chapter { display: none !important; }
      #hud .msg { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); font-size: 13px; letter-spacing: 0.4em; color: #ddd; text-shadow: 0 0 3px #000;
        opacity: 0; transition: opacity 0.4s; text-transform: uppercase; }
      #hud .prompt { position: absolute; left: 50%; bottom: 16%; transform: translateX(-50%); font-size: 15px; letter-spacing: 0.32em; color: #efede7;
        text-shadow: 0 0 5px #000, 0 0 2px #000, 0 0 1px #000; text-transform: uppercase; white-space: pre; display: none; align-items: center; }
      #hud .prompt .k { position: relative; display: inline-block; min-width: 44px; height: 44px; line-height: 44px; text-align: center; margin-right: 14px;
        letter-spacing: 0.08em; font-size: 16px; color: #f4f2ec; text-shadow: none; padding: 0 9px; box-sizing: border-box; }
      #hud .prompt .k canvas { position: absolute; left: -4px; top: 0; width: calc(100% + 8px); height: 100%; }
      #hud .prompt .k span { position: relative; }
      #hud .tick { position: absolute; width: 26px; height: 26px; margin: -24px 0 0 -2px; display: none; }
      #hud .say { position: absolute; left: 50%; bottom: 7.5%; transform: translateX(-50%); display: none; }
      #hud .say canvas { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
      #hud .say span { position: relative; display: block; padding: 0 30px; font: ${SAY_FONT}; line-height: 58px; color: #f2f0ea; white-space: nowrap; letter-spacing: 0.02em; }
      #hud .chapter { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); text-align: center; color: #f2f0ea; display: none; opacity: 0; }
      #hud .chapter .num { font-family: ${SERIF}; font-weight: 700; font-size: 118px; line-height: 1; transform: scaleX(0.78); text-shadow: 0 0 18px rgba(0,0,0,0.9); }
      #hud .chapter .rule { display: block; margin: 12px auto 12px; }
      #hud .chapter .name { font-family: ${BOOK}; font-size: 23px; letter-spacing: 0.42em; text-transform: uppercase; padding-left: 0.42em; text-shadow: 0 0 10px #000, 0 0 3px #000; }
      #hud .cursor { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; display: none;
        background: linear-gradient(#111, #111) center / 14px 2px no-repeat, linear-gradient(#111, #111) center / 2px 14px no-repeat; filter: drop-shadow(0 0 1px #eee); }
      #fade { position: fixed; inset: 0; background: #000; opacity: 0; pointer-events: none; z-index: 9; }
      #hud.fight .bl { display: block; }
      #hud.nogun .br, #hud.nogun .xr, #hud.nogun .xh { display: none; }
      #hud.nofight .bl { display: none; }
    `;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hud';
    document.body.appendChild(this.root);
    this.root.innerHTML = `
      <div class="br"><div class="ammo">50<small> / 50</small></div><div class="note"></div></div>
      <div class="bl"><div class="lab">health</div><canvas width="460" height="52"></canvas></div>
      <div class="xr"></div><div class="xh"></div>
      <div class="msg"></div>
      <div class="tick"></div><div class="prompt"><span class="k"><span></span></span><span class="t"></span></div><div class="say"><span></span></div>
      <div class="chapter"><div class="num"></div><div class="name"></div></div><div class="cursor"></div>`;
    // the fade to black between scenes: over the frame, under the cards
    this.fadeEl = document.createElement('div');
    this.fadeEl.id = 'fade';
    document.body.appendChild(this.fadeEl);
    this.el = {
      ammo: this.root.querySelector('.ammo'), note: this.root.querySelector('.note'),
      bar: this.root.querySelector('.bl canvas'), xr: this.root.querySelector('.xr'), xh: this.root.querySelector('.xh'), msg: this.root.querySelector('.msg'),
      prompt: this.root.querySelector('.prompt'), key: this.root.querySelector('.prompt .k span'), ptext: this.root.querySelector('.prompt .t'),
      tick: this.root.querySelector('.tick'), say: this.root.querySelector('.say'), sayText: this.root.querySelector('.say span'),
      chapter: this.root.querySelector('.chapter'), cursor: this.root.querySelector('.cursor'),
    };
    // the prompt's key dab and tick, and the chapter card's rule: drawn once
    this.el.key.parentNode.insertBefore(makeKeyDab(5, 64), this.el.key);
    this.el.tick.appendChild(makeTick(9));
    const rule = makeTornStroke(220, 16, 311, [238, 236, 230]);
    rule.className = 'rule';
    this.el.chapter.insertBefore(rule, this.el.chapter.querySelector('.name'));
    this.promptOwner = null;
    this.promptText = null;
    this.sayT = 0;
    this.sayCanvas = null;
    this.subtitles = true;
    this.cardT = 0;
    this.cardDur = 0;
    this.barG = this.el.bar.getContext('2d');
    this.barRng = new RNG(77);
    this.barStrokes = makeBarStrokes(this.barRng);
    this._last = {};

    // the title: the splat with its red accent and the lettering, top left
    // over the dark upper storeys (its centre at 30 % of the width, 22 % of
    // the height, the blot 46 % of the width), so the diner's neon, its door
    // and the old blade sign stand clear below and right of it; the red
    // splatter on the blot's upper right shoulder, above the signs' line;
    // low in the frame over the wet street BEGIN and CONTINUE, the keys
    // (fewer, shorter drops and spikes than the other cards: nothing flung
    // down onto the signs)
    this.titleCard = makeCard('title', 'NOIR EXTREME', { w: 1400, h: 620, R: 190, wide: 5.6, vw: 65, seed: 1937, red: true,
      splat: { drops: 24, spikes: 14, spikeLen: 0.6, drips: 1 }, redAt: [2.05, -0.55] });
    this.title = this.titleCard.el;
    const opts = document.createElement('div');
    opts.className = 'opts';
    const opt = (key, text, seed) => {
      const o = document.createElement('div');
      o.className = 'opt';
      o.dataset.k = key;
      o.appendChild(makeTornStroke(Math.round(text.length * 17 * 1.5 + 150), 62, seed));
      const s = document.createElement('span'); s.textContent = text; o.appendChild(s);
      opts.appendChild(o);
      return o;
    };
    this.beginOpt = opt('begin', 'begin', 4101);
    this.sepEl = document.createElement('div'); this.sepEl.className = 'sep hidden'; opts.appendChild(this.sepEl);
    this.contOpt = opt('continue', 'continue', 4102);
    this.contOpt.classList.add('hidden');
    // CHAPTERS: the table of contents (setChapters): start at any chapter
    const sep2 = document.createElement('div'); sep2.className = 'sep'; opts.appendChild(sep2);
    this.chapOpt = opt('chapters', 'chapters', 4103);
    this.toc = document.createElement('div');
    this.toc.className = 'toc';
    this.title.appendChild(this.toc);
    this.title.appendChild(opts);
    this.titlePrompt = document.createElement('p'); this.titlePrompt.className = 'go'; this.title.appendChild(this.titlePrompt);
    const keys = document.createElement('p'); keys.className = 'keys'; keys.textContent = KEYS; this.title.appendChild(keys);
    this.soundLine = document.createElement('p');
    this.soundLine.className = 'keys';
    this.soundLine.textContent = 'any key: sound';
    this.soundLine.style.display = 'none';
    this.title.appendChild(this.soundLine);
    this.title.classList.remove('hidden');
    this.root.classList.add('titled');
    this.canContinue = false;
    // BEGIN (or a click anywhere while there is nothing to continue);
    // CONTINUE when a save exists
    // (on the button's press, not the click: a click is only delivered to
    // the press's and the release's common ancestor, so a hand that moves a
    // hair between the two would miss the choice; and the press is a gesture
    // the pointer lock accepts)
    this.title.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const o = e.target.closest && e.target.closest('.opt');
      // (the table of contents: a row starts that chapter; CHAPTERS opens
      // and shuts it; while it is open a click elsewhere only shuts it)
      const row = e.target.closest && e.target.closest('.toc .row');
      if (row) { if (!row.classList.contains('off') && onChapter) { this.title.classList.remove('toc-open'); onChapter(row.dataset.id); } return; }
      if (o && o.dataset.k === 'chapters') { this.title.classList.toggle('toc-open'); return; }
      if (this.title.classList.contains('toc-open') && !o) { this.title.classList.remove('toc-open'); return; }
      const k = o ? o.dataset.k : this.canContinue ? null : 'begin';
      if (k === 'continue' && onContinue) onContinue();
      else if (k === 'begin' && onBegin) onBegin();
    });

    this.endCard = makeCard('endcard', 'THE END', { w: 1300, h: 620, R: 180, wide: 5.0, vw: 88, seed: 1942, red: true, sub: '', epi: ' ', go: 'click to try again' });
    this.endKind = 'end';
    this.endCard.el.addEventListener('click', () => onRestart && onRestart(this.endKind));
    this.pauseCard = makeCard('pausecard', 'PAUSED', { w: 900, h: 400, R: 96, wide: 5.2, vw: 56, seed: 777, go: 'click to resume', keys: KEYS });
    this.pauseCard.el.addEventListener('click', () => { const f = onResume || onBegin; if (f) f(); });
    this.settingsEl = document.createElement('div');
    this.settingsEl.className = 'set';
    this.pauseCard.el.appendChild(this.settingsEl);
    this.settingsEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest && e.target.closest('i');
      if (b && this.onSetting) { this.onSetting(b.dataset.k, +b.dataset.d); this.drawSettings(); }
    });
    this.settings = null;     // () -> { mouse, volume, subtitles }
    this.msgT = 0;
    this.paused = false;
    this.epiRng = null;       // (shot mode: a seeded epitaph)
  }

  // the table of contents behind CHAPTERS: [{ id, numeral, title, ready }]
  // (a chapter without a scene file yet is listed, dimmed)
  setChapters(list) {
    this.toc.textContent = '';
    for (const c of list) {
      const r = document.createElement('div');
      r.className = 'row' + (c.ready ? '' : ' off');
      r.dataset.id = c.id;
      const n = document.createElement('b'); n.textContent = c.numeral; r.appendChild(n);
      const t = document.createElement('span'); t.textContent = c.title; r.appendChild(t);
      this.toc.appendChild(r);
    }
  }

  // the title's hint while the browser still holds the sound back
  // (muted - mute=1, a test run, or the player's own M - it says so, and
  // how to have it back)
  soundHint(on, muted = false) {
    this.soundLine.textContent = muted ? 'sound off · M sound' : 'any key: sound';
    this.soundLine.style.display = on || muted ? '' : 'none';
  }

  // (the HUD's readouts stay hidden behind the title card)
  // text: a line under the choices (a pointer-lock refusal), none by default
  showTitle(text = '', { canContinue = this.canContinue } = {}) {
    this.titlePrompt.textContent = text;
    this.canContinue = !!canContinue;
    this.contOpt.classList.toggle('hidden', !this.canContinue);
    this.sepEl.classList.toggle('hidden', !this.canContinue);
    this.title.classList.remove('hidden');
    this.root.classList.add('titled');
  }
  hideTitle() { this.title.classList.add('hidden'); this.retitle(); }
  setVisible(v) { this.visible = v; this.root.style.display = v ? '' : 'none'; if (!v) this.hideTitle(); }
  get titleShown() { return !this.title.classList.contains('hidden'); }
  get endShown() { return !this.endCard.el.classList.contains('hidden'); }
  retitle() { this.root.classList.toggle('titled', this.titleShown || this.paused || this.endShown); }

  // pointer lock lost in play: the frame dims under the pause card, the
  // settings line under it
  showPause(text = 'click to resume') {
    this.paused = true;
    this.pauseCard.go.textContent = text;
    this.drawSettings();
    this.pauseCard.el.classList.remove('hidden');
    this.retitle();
  }
  hidePause() { this.paused = false; this.pauseCard.el.classList.add('hidden'); this.retitle(); }
  drawSettings() {
    const s = this.settings ? this.settings() : null;
    if (!s) { this.settingsEl.innerHTML = ''; return; }
    this.settingsEl.innerHTML = `<span>mouse <i data-k="mouse" data-d="-1">−</i><b>${s.mouse}</b><i data-k="mouse" data-d="1">+</i></span>`
      + `<span>volume <i data-k="volume" data-d="-1">−</i><b>${s.volume}</b><i data-k="volume" data-d="1">+</i></span>`
      + `<span>subtitles <i data-k="subtitles" data-d="0">${s.subtitles ? 'on' : 'off'}</i></span>`;
  }

  // the end cards: kind 'end' (THE END and an epitaph: the old battle's
  // death) or 'cont' (the end of the slice: To be continued). No counters.
  showEnd(opts = {}) {
    const o = typeof opts === 'object' && opts ? opts : {};
    const kind = o.kind || 'end';
    this.endKind = kind;
    const E = this.endCard;
    E.el.classList.toggle('cont', kind === 'cont');
    E.h1.textContent = o.title || (kind === 'cont' ? 'To be continued' : 'THE END');
    E.sub.textContent = o.sub || '';
    let epi = o.epi;
    if (epi === undefined && kind === 'end') {
      const r = this.epiRng ? this.epiRng.next() : Math.random();
      epi = EPITAPHS[Math.floor(r * EPITAPHS.length) % EPITAPHS.length];
    }
    E.epi.textContent = epi || '';
    E.go.textContent = o.go || (kind === 'cont' ? 'click for the title' : 'click to try again');
    E.el.classList.remove('hidden');
    E.el.style.opacity = '1';
    this.retitle();
  }
  hideEnd() { this.endCard.el.classList.add('hidden'); this.retitle(); }

  // ---- the story's lines (CONTRACTS §4.1, §12.1) -------------------------------------
  // the one prompt, low in the frame ('E  light up'), a tick at the thing
  // (at: screen pixels { x, y } or null); owner: who may clear it
  prompt(text, at = null, owner = null) {
    const E = this.el;
    if (this.promptOwner && owner && this.promptOwner !== owner && E.prompt.style.display !== 'none' && owner !== 'scene') return;
    this.promptOwner = owner;
    if (this.promptText !== text) {
      this.promptText = text;
      // 'E  light up': the key on its dab, the words after it
      // (the key is what comes before the double space: 'A D  slip')
      const m = /^(.+?)\s{2,}(.*)$/.exec(text) || /^(\S+)\s+(.*)$/.exec(text);
      E.key.textContent = m ? m[1] : '';
      E.key.parentNode.style.display = m ? '' : 'none';
      E.ptext.textContent = m ? m[2] : text;
    }
    E.prompt.style.display = 'flex';
    if (at) { E.tick.style.display = 'block'; E.tick.style.left = at.x.toFixed(1) + 'px'; E.tick.style.top = at.y.toFixed(1) + 'px'; } else E.tick.style.display = 'none';
  }
  clearPrompt(owner = null) {
    if (owner && this.promptOwner && owner !== this.promptOwner) return;
    this.promptOwner = null;
    this.el.prompt.style.display = 'none';
    this.el.tick.style.display = 'none';
  }
  get promptShown() { return this.el.prompt.style.display !== 'none' ? (this.promptText || '') : ''; }
  // a one-line subtitle (42 characters at most), `secs` of game time, on
  // its own torn stroke (seeded by the line: the same line, the same stroke)
  say(text, secs = 2.2) {
    if (text.length > 42) console.warn(`hud.say: '${text}' is longer than 42 characters`);
    this.lastSay = text;
    if (!this.subtitles) return;
    const E = this.el;
    E.sayText.textContent = text;
    if (this.sayCanvas) this.sayCanvas.remove();
    const g = (this._mctx || (this._mctx = document.createElement('canvas').getContext('2d')));
    g.font = SAY_FONT;
    const w = Math.ceil(g.measureText(text).width + text.length * 0.44) + 60;
    this.sayCanvas = makeTornStroke(w + 70, 66, hashSeed(text));
    E.say.insertBefore(this.sayCanvas, E.sayText);
    E.say.style.display = 'block';
    this.sayT = secs;
  }
  get sayShown() { return this.el.say.style.display !== 'none' ? this.el.sayText.textContent : ''; }
  // the chapter card: a roman numeral and a name, in the title's lettering;
  // in over 0.5 s, out over the last 0.7 s (game time)
  card(num, name, secs = 2.4) {
    const C = this.el.chapter;
    C.querySelector('.num').textContent = num || '';
    C.querySelector('.num').style.display = num ? '' : 'none';
    C.querySelector('.name').textContent = name || '';
    C.style.display = 'block';
    C.style.opacity = '0';
    this.cardT = secs;
    this.cardDur = secs;
    this.tickCard(0);
  }
  tickCard(dt) {
    if (this.cardT <= 0) return;
    this.cardT -= dt;
    const C = this.el.chapter;
    if (this.cardT <= 0) { C.style.display = 'none'; return; }
    const age = this.cardDur - this.cardT;
    const a = Math.min(1, age / 0.5, this.cardT / 0.7);
    C.style.opacity = (a * a * (3 - 2 * a)).toFixed(3);
  }
  // the fade to black (0 clear .. 1 black)
  fade(k) { this.fadeEl.style.opacity = String(Math.max(0, Math.min(1, k))); }
  // a puzzle's virtual cursor (screen pixels, or null to hide it)
  cursor(at) {
    const c = this.el.cursor;
    if (!at) { c.style.display = 'none'; return; }
    c.style.display = 'block'; c.style.left = at.x + 'px'; c.style.top = at.y + 'px';
  }
  // the lines' timers run on game time (one fixed step)
  tick(dt) {
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) this.el.say.style.display = 'none'; }
    this.tickCard(dt);
  }
  // shot mode: every CSS animation and transition stops where it starts, so
  // a card in a screenshot never depends on when the page loaded
  freeze() {
    const st = document.createElement('style');
    st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
    document.head.appendChild(st);
  }

  // a lane's own layer (wave B seams): a div under the HUD root, the whole
  // frame, pointer-events none, made on first ask; hidden behind the
  // cards; every layer is dropped when a scene exits (SceneManager)
  layer(name) {
    const L = this.layers || (this.layers = new Map());
    let el = L.get(name);
    if (!el) {
      el = document.createElement('div');
      el.className = 'layer';
      el.dataset.layer = name;
      el.style.cssText = 'position: absolute; inset: 0; pointer-events: none;';
      this.root.appendChild(el);
      L.set(name, el);
    }
    return el;
  }
  dropLayer(name) {
    const el = this.layers && this.layers.get(name);
    if (!el) return;
    el.remove();
    this.layers.delete(name);
  }
  dropLayers() { if (this.layers) for (const n of [...this.layers.keys()]) this.dropLayer(n); }

  message(text, secs = 1.4) { this.el.msg.textContent = text; this.el.msg.style.opacity = '1'; this.msgT = secs; }

  // s: { ammo, drum, reloading, hp, spread, dt, gun, fight }
  // (the ammo only while a gun is out; the health only in a fight)
  update(s) {
    const L = this._last, E = this.el;
    const gun = s.gun ?? true, fight = s.fight ?? true;
    if (L.gun !== gun) { this.root.classList.toggle('nogun', !gun); L.gun = gun; }
    if (L.fight !== fight) { this.root.classList.toggle('nofight', !fight); L.fight = fight; }
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
// splat: the blot's own drawInkSplat options (drops, spikes, ...); redAt: the
// red splatter's centre off the blot's, in R (x along the blot, y down)
function makeCard(id, title, { w, h, R, wide, vw, seed, red = false, sub = null, epi = null, go = null, keys = null, splat = {}, redAt = null }) {
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
  sheet((gg) => drawInkSplat(gg, w / 2, h * 0.5, R, new RNG(seed), '#060606', { wide, ...splat }), [6, 6, 6], seed + 31);
  // the one colour: a red splatter caught on the ink's right flank
  const [rx, ry] = redAt || [wide * 0.33, 0.5];
  if (red) sheet((gg) => drawInkSplat(gg, w / 2 + R * rx, h * 0.5 + R * ry, R * 0.22, new RNG(seed + 7), '#c8102e', { wide: 1.25, spikes: 16, drops: 22, drags: 0, drips: 2, spikeLen: 1.6 }), [200, 16, 46], seed + 37);
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
