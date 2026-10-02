import { makeTornStroke, hashSeed } from './inkArt.js';
import { letterCanvas, keyCap, mouseGlyph, strikeStroke } from './lettering.js';

// The kit's lines on the HUD (lane C1; the contract is docs/story/seams/Z.md):
//   objective(text | null, { strike = true, now = false })
//       top left, small, the typewriter's capitals on a thin torn stroke; a
//       new line is brushed in left to right (0.45 s, kit_write) and sits at
//       full strength for 2.5 s, then settles to low contrast. A changed line
//       strikes the old one through first (0.3 s, held 0.45 s) unless
//       strike: false; null takes it away; now: at once, no animation.
//   teach(id, text, opts) -> handle     the teach card (see Hud.teach)
//   warn(text | null, { now })          centre low, pulses once as it comes;
//                                       null lets it go (0.4 s)
//   failLine(text | null), failK(k)     the fail's few words on the black
// Every timer runs on game time (tick(dt), from hud.tick), except a held
// teach card's (real time: the game crawls under it).
const TYPE = '"American Typewriter", "Courier New", monospace';
const BOOK = '"Baskerville", Georgia, serif';
const ease = (u) => u * u * (3 - 2 * u);

// a teach card's keys: '[SPACE] vault' -> [{ key: 'SPACE' }, { text: 'vault' }]
export function parseTeach(text) {
  const out = [];
  const re = /\[([^\]]+)\]/g;
  let i = 0, m;
  while ((m = re.exec(text))) {
    const pre = text.slice(i, m.index).trim();
    if (pre) out.push({ text: pre });
    out.push({ key: m[1].trim() });
    i = m.index + m[0].length;
  }
  const post = text.slice(i).trim();
  if (post) out.push({ text: post });
  return out;
}
// a key cap's label -> the input code it stands for
export function codeOf(label) {
  const L = String(label).toUpperCase().replace(/\s+/g, '');
  const M = { SPACE: 'Space', LMB: 'Mouse0', RMB: 'Mouse2', CTRL: 'ControlLeft', SHIFT: 'ShiftLeft', ESC: 'Escape', ENTER: 'Enter', TAB: 'Tab' };
  if (M[L]) return M[L];
  if (/^[A-Z]$/.test(L)) return 'Key' + L;
  if (/^[0-9]$/.test(L)) return 'Digit' + L;
  return null;
}

export class KitUi {
  constructor(hud) {
    this.hud = hud;
    const style = document.createElement('style');
    style.textContent = `
      #hud .kobj { position: absolute; left: 36px; top: 30px; display: none; pointer-events: none; }
      #hud .kobj .g { position: absolute; left: -30px; top: 50%; transform: translateY(-50%); opacity: 0.7; }
      #hud .kobj .t { position: relative; display: block; font-family: ${TYPE}; font-size: 13px; line-height: 30px; letter-spacing: 0.3em;
        text-transform: uppercase; color: #ebe8e1; white-space: nowrap; text-shadow: 0 0 4px #000, 0 0 2px #000, 0 0 1px #000; }
      #hud .kobj .s { position: absolute; left: -6px; top: 50%; transform: translateY(-50%); clip-path: inset(0 100% 0 0); }
      #hud .kteach { position: absolute; left: 50%; bottom: 25%; transform: translateX(-50%); display: none; align-items: center; pointer-events: none; }
      #hud .kteach .g { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); opacity: 0.9; }
      #hud .kteach .row { position: relative; display: flex; align-items: center; gap: 12px; padding: 0 26px; }
      #hud .kteach .w { font-family: ${TYPE}; font-size: 15px; letter-spacing: 0.3em; text-transform: uppercase; color: #f1efe9; white-space: nowrap;
        text-shadow: 0 0 5px #000, 0 0 2px #000; }
      #hud .kteach canvas.cap { display: block; filter: drop-shadow(0 0 3px rgba(0,0,0,0.9)); }
      #hud .kwarn { position: absolute; left: 50%; top: 64%; transform: translate(-50%, -50%); display: none; pointer-events: none; }
      #hud .kwarn .g { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
      #hud .kwarn span { position: relative; display: block; padding: 0 34px; font-family: ${BOOK}; font-style: italic; font-size: 23px; line-height: 56px;
        color: #f4f2ec; white-space: nowrap; letter-spacing: 0.03em; text-shadow: 0 0 6px #000; }
      #hud .kfail { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none; pointer-events: none; z-index: 3; }
      #hud.titled .kobj, #hud.titled .kteach, #hud.titled .kwarn, #hud.titled .kfail { display: none !important; }
      #hud.stilled .kobj, #hud.stilled .kteach, #hud.stilled .kwarn, #hud.stilled .prompt, #hud.stilled .tick, #hud.stilled .say { visibility: hidden; }
      #hud.carded .kobj, #hud.carded .kteach, #hud.carded .kwarn { visibility: hidden; }
      #hud.failing .kobj, #hud.failing .kteach, #hud.failing .kwarn, #hud.failing .prompt, #hud.failing .tick, #hud.failing .say,
      #hud.failing .br, #hud.failing .bl, #hud.failing .xh, #hud.failing .xr, #hud.failing .layer { visibility: hidden; }
    `;
    document.head.appendChild(style);
    const root = hud.root;
    const mk = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; root.appendChild(e); return e; };
    this.objEl = mk('kobj', '<span class="t"></span>');
    this.teachEl = mk('kteach', '<div class="row"></div>');
    this.warnEl = mk('kwarn', '<span></span>');
    this.failEl = mk('kfail');
    // the objective: its target text and what is drawn now
    this.objectiveText = null;
    this.obj = null;            // { text, phase: in | sit | strike | out, t }
    this.objNext = undefined;   // the line waiting for the old one to go
    // the teach cards
    this.taughtLocal = {};      // (no save: shot mode, a test)
    this.teachTexts = {};
    this.teachQ = [];
    this.teachCur = null;
    this.shown = {};            // how often each card has been shown (the plays read it)
    // the warning
    this.warnText = null;
    this.warnT = 0; this.warnOut = 0;
  }
  get game() { return this.hud.game || null; }
  snd(name) { const G = this.game; if (G && G.sfx) G.sfx.play(name, null, {}, { send: false }); }

  // ---- the objective line ------------------------------------------------------------
  objective(text, { strike = true, now = false } = {}) {
    const want = text == null || text === '' ? null : String(text);
    if (now) {
      this.objectiveText = want; this.objNext = undefined;
      this.obj = want ? { text: want, phase: 'sit', t: 99 } : null;
      this.drawObjective(want);
      this.applyObjective();
      return;
    }
    if (want === this.objectiveText) return;
    this.objectiveText = want;
    const cur = this.obj;
    if (!cur) { if (want) this.writeIn(want); return; }
    // the old line goes first: struck through when it was done, else faded
    this.objNext = want;
    if (cur.phase === 'strike' || cur.phase === 'out') return;
    if (want && strike) { cur.phase = 'strike'; cur.t = 0; this.snd('kit_strike'); }
    else { cur.phase = 'out'; cur.t = 0; }
  }
  writeIn(text) {
    this.obj = { text, phase: 'in', t: 0 };
    this.objNext = undefined;
    this.drawObjective(text);
    this.snd('kit_write');
    this.applyObjective();
  }
  drawObjective(text) {
    const E = this.objEl;
    for (const c of [...E.querySelectorAll('canvas')]) c.remove();
    if (!text) { E.style.display = 'none'; return; }
    E.querySelector('.t').textContent = text;
    const g = this._mctx || (this._mctx = document.createElement('canvas').getContext('2d'));
    g.font = `13px ${TYPE}`;
    const w = Math.ceil(g.measureText(text.toUpperCase()).width + text.length * 13 * 0.3) + 10;
    const ground = makeTornStroke(w + 90, 34, hashSeed('obj:' + text));
    ground.className = 'g';
    E.insertBefore(ground, E.firstChild);
    const s = strikeStroke(w + 12, 12, hashSeed('strike:' + text));
    s.className = 's';
    E.appendChild(s);
    this.objStrike = s;
    E.style.display = 'block';
  }
  applyObjective() {
    const O = this.obj, E = this.objEl;
    if (!O) { E.style.display = 'none'; return; }
    let reveal = 1, op = 1, strike = 0;
    if (O.phase === 'in') { reveal = ease(Math.min(1, O.t / 0.45)); }
    else if (O.phase === 'sit') { op = 1 - 0.42 * ease(Math.min(1, Math.max(0, (O.t - 2.5) / 1.0))); }
    else if (O.phase === 'strike') { strike = ease(Math.min(1, O.t / 0.3)); op = 1; }
    else if (O.phase === 'out') { op = 1 - Math.min(1, O.t / 0.3); strike = O.struck ? 1 : 0; }
    E.style.clipPath = reveal < 1 ? `inset(-20px ${(100 * (1 - reveal)).toFixed(1)}% -20px -40px)` : '';
    E.style.opacity = op.toFixed(3);
    if (this.objStrike) this.objStrike.style.clipPath = `inset(0 ${(100 * (1 - strike)).toFixed(1)}% 0 0)`;
  }
  tickObjective(dt) {
    const O = this.obj;
    if (!O) return;
    O.t += dt;
    if (O.phase === 'in' && O.t >= 0.45) { O.phase = 'sit'; O.t = 0; }
    else if (O.phase === 'strike' && O.t >= 0.75) { O.phase = 'out'; O.t = 0; O.struck = true; }
    else if (O.phase === 'out' && O.t >= 0.3) {
      this.obj = null;
      const nx = this.objNext;
      this.objNext = undefined;
      if (nx) this.writeIn(nx); else this.drawObjective(null);
    }
    this.applyObjective();
  }

  // ---- the teach card ------------------------------------------------------------------
  // id: what is taught ('vault'); text: '[SPACE] vault'; opts: { until, secs,
  // hold, holdMax, onDone }; -> handle { id, shown, done, then, dismiss }
  teach(id, text, opts = {}, again = false) {
    const G = this.game;
    if (text) this.teachTexts[id] = { text, opts };
    const T = this.teachTexts[id];
    const h = makeHandle(id, opts.onDone);
    if (!T) { console.warn(`hud.teach: no text for '${id}'`); h.finish(); return h; }
    const taught = this.taught();
    if (taught[id] && !again) { h.finish(); return h; }
    // (the same card already up or waiting: the one handle)
    if (this.teachCur && this.teachCur.id === id) return this.teachCur.h;
    const q = this.teachQ.find((x) => x.id === id);
    if (q) return q.h;
    const item = { id, text: T.text, opts: { ...T.opts, ...opts }, h };
    if (this.teachCur) this.teachQ.push(item); else this.showTeach(item);
    return h;
  }
  teachAgain(id, text = null, opts = {}) { return this.teach(id, text, opts, true); }
  // the cards already shown in this save (save.flags.taught; a card is taught
  // once it has been shown, not while it waits its turn)
  taught() {
    const G = this.game;
    const flags = G && G.save && G.save.enabled ? G.save.flags : this.taughtLocal;
    return flags.taught || (flags.taught = {});
  }
  showTeach(item) {
    const G = this.game;
    const E = this.teachEl, row = E.querySelector('.row');
    row.textContent = '';
    for (const c of [...E.querySelectorAll('canvas.g')]) c.remove();
    const parts = parseTeach(item.text);
    const codes = [];
    let width = 0;
    for (const p of parts) {
      if (p.key) {
        const K = p.key.toUpperCase().replace(/\s+/g, '');
        const c = K === 'LMB' ? mouseGlyph('L') : K === 'RMB' ? mouseGlyph('R') : keyCap(K);
        c.classList.add('cap');
        row.appendChild(c);
        width += parseFloat(c.style.width) + 12;
        const code = codeOf(K);
        if (code) codes.push(code);
      } else {
        const s = document.createElement('span'); s.className = 'w'; s.textContent = p.text; row.appendChild(s);
        width += p.text.length * 15 * 0.92 + 12;
      }
    }
    const ground = makeTornStroke(Math.round(width + 120), 74, hashSeed('teach:' + item.text));
    ground.className = 'g';
    E.insertBefore(ground, row);
    const o = item.opts;
    let until = o.until;
    if (until === undefined) until = codes.length ? codes : null;
    if (typeof until === 'string') until = [until];
    this.teachCur = { ...item, until, t: 0, real: 0, out: -1, held: !!o.hold };
    this.shown[item.id] = (this.shown[item.id] || 0) + 1;
    this.taught()[item.id] = true;
    E.style.display = 'flex';
    E.style.opacity = '0';
    item.h.shown = true;
    this.snd('kit_teach');
    if (o.hold && G) G.crawl = 0.12;
  }
  // a key or the predicate the card waits for
  teachMet(cur) {
    const G = this.game, u = cur.until;
    if (!u || !G) return false;
    if (typeof u === 'function') return !!u();
    return u.some((c) => G.pressed(c) || (G.scenes && G.scenes.injected && G.scenes.injected.has(c)));
  }
  dismissTeach() {
    const cur = this.teachCur;
    if (cur) { this.endTeach(cur, true); }
    for (const q of this.teachQ) q.h.finish();
    this.teachQ.length = 0;
  }
  endTeach(cur, now = false) {
    const G = this.game;
    if (cur.held && G) { G.crawl = 1; cur.held = false; }
    if (now) { this.teachEl.style.display = 'none'; this.teachCur = null; cur.h.finish(); return; }
    if (cur.out < 0) cur.out = 0;
  }
  tickTeach(dt) {
    const cur = this.teachCur;
    if (!cur) return;
    const G = this.game;
    // (a card waits, unseen, while a chapter card, the stills or a fail's
    // black is over the HUD: its time starts when it can be read)
    const R = this.hud.root.classList;
    if (R.contains('carded') || R.contains('stilled') || R.contains('failing')) { this.teachEl.style.opacity = '0'; return; }
    // (a held card: real time - the game crawls under it)
    const step = cur.held && G ? dt / Math.max(0.05, G.crawl || 1) : dt;
    cur.t += step;
    if (cur.held) cur.real += step;
    const o = cur.opts;
    if (cur.out < 0) {
      if (this.teachMet(cur) && cur.t > 0.05) this.endTeach(cur);
      else if (cur.held && cur.real > (o.holdMax ?? 6)) { if (G) G.crawl = 1; cur.held = false; }
      else if (!cur.held && cur.t > (o.secs ?? 3.2) + (o.hold ? 0 : 0)) this.endTeach(cur);
    }
    const E = this.teachEl;
    let a = Math.min(1, cur.t / 0.18), sc = 0.94 + 0.06 * ease(a);
    if (cur.out >= 0) { cur.out += step; a = Math.max(0, 1 - cur.out / 0.3); }
    if (cur.held) sc *= 1 + 0.035 * Math.sin(cur.real * Math.PI * 4);
    E.style.opacity = a.toFixed(3);
    E.style.transform = `translateX(-50%) scale(${sc.toFixed(3)})`;
    if (cur.out >= 0.3) {
      E.style.display = 'none';
      this.teachCur = null;
      cur.h.finish();
      const nx = this.teachQ.shift();
      if (nx) this.showTeach(nx);
    }
  }

  // ---- the warning ------------------------------------------------------------------------
  warn(text, { now = false } = {}) {
    const want = text == null || text === '' ? null : String(text);
    const E = this.warnEl;
    if (want === this.warnText) return;
    this.warnText = want;
    if (!want) {
      if (now) { E.style.display = 'none'; this.warnOut = 0; }
      else this.warnOut = 0.4;
      return;
    }
    for (const c of [...E.querySelectorAll('canvas')]) c.remove();
    E.querySelector('span').textContent = want;
    const g = this._wctx || (this._wctx = document.createElement('canvas').getContext('2d'));
    g.font = `italic 23px ${BOOK}`;
    const w = Math.ceil(g.measureText(want).width) + 80;
    const ground = makeTornStroke(w + 70, 70, hashSeed('warn:' + want));
    ground.className = 'g';
    E.insertBefore(ground, E.firstChild);
    E.style.display = 'block';
    this.warnT = 0; this.warnOut = 0;
    this.snd('kit_warn');
    this.applyWarn();
  }
  applyWarn() {
    const E = this.warnEl;
    if (E.style.display === 'none') return;
    let a = Math.min(1, this.warnT / 0.12);
    // (one pulse as it comes: in large, settling to its size)
    const p = Math.min(1, this.warnT / 0.38);
    const sc = 1 + 0.16 * (1 - ease(p));
    if (!this.warnText) a = Math.max(0, this.warnOut / 0.4);
    E.style.opacity = a.toFixed(3);
    E.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(3)})`;
  }
  tickWarn(dt) {
    const E = this.warnEl;
    if (E.style.display === 'none') return;
    this.warnT += dt;
    if (!this.warnText) { this.warnOut -= dt; if (this.warnOut <= 0) { E.style.display = 'none'; return; } }
    this.applyWarn();
  }

  // ---- the fail's line on the black -----------------------------------------------------
  failLine(text) {
    const E = this.failEl;
    E.textContent = '';
    if (!text) { E.style.display = 'none'; return; }
    const L = letterCanvas(text, { size: 24, color: '#ece9e2', weight: 600, spacing: 0.12 });
    E.appendChild(L.canvas);
    E.style.display = 'block';
    E.style.opacity = '0';
  }
  failK(k) { this.failEl.style.opacity = Math.max(0, Math.min(1, k)).toFixed(3); }

  tick(dt) { this.tickObjective(dt); this.tickTeach(dt); this.tickWarn(dt); }
}

// a teach card's handle: poll .done from a script (yield until(() => h.done)),
// or await it / .then it, or pass opts.onDone
function makeHandle(id, onDone) {
  let resolve;
  const p = new Promise((r) => { resolve = r; });
  const h = {
    id, shown: false, done: false,
    finish() { if (h.done) return; h.done = true; resolve(h); if (onDone) onDone(h); },
    then(a, b) { return p.then(a, b); },
  };
  return h;
}
