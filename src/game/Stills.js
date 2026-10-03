import { RNG } from '../util/rng.js';
import { hashSeed } from '../ui/inkArt.js';
import { captionBox } from '../ui/lettering.js';

// Stills: comic panels over black (WAVE_C §5; the contract is
// docs/story/seams/Z.md §4). Lane C1 builds the player; lane C9 makes the
// pictures.
//   game.stills.play(id, opts?) -> handle (await it, .then it, or poll .done
//       from a script: yield until(() => h.done)); opts { onDone }
//   game.stills.active    a run is up (the game is paused under it)
//   game.stills.has(id)   game.stills.skip()
// Data: src/stills/<id>.js default-exports
//   { panels: [{ img?, draw?, caption?, secs?, from?, to?, aspect?, newPage?, rect?, cap? }] }
//   img      'stills/<file>' under public/ (lane C9's picture); until it
//            exists, draw(g, w, h, rng) paints the placeholder (flat ink
//            shapes, src/stills/_art.js)
//   caption  at most six words, capitals, in a lettered box at a corner of
//            its panel (cap: 'tl' | 'tr' | 'bl' | 'br', default 'tl')
//   secs     how long it stays before the next comes in by itself (2..4, 3)
//   from/to  the slow drift inside the frame: { s, x, y } (scale, offset as
//            a share of the frame), default a breath of a push-in
//   aspect   the picture's width / height (default from its place on the page)
//   newPage  this panel starts a fresh page (the page holds up to three; the
//            earlier panels of a page stay as the next come in)
//   rect     its place on the page { x, y, w, h } in shares of the page,
//            instead of the layout by count
// Input: a click, E, SPACE or Enter moves on (0.4 s after a panel lands, so
// a mashed key never skips one unseen); ESC twice, or held, skips the run.
// The game is paused under it (main.js), the music plays on, the rain ducks;
// a soft paper sound as each panel lands. Shot mode: ?still=<id>&panel=<n>
// renders that page with panels 0..n landed, the drift at its middle.
const MODS = import.meta.glob(['../stills/*.js', '!../stills/_*.js'], { eager: true });
export const STILLS = {};
for (const [path, m] of Object.entries(MODS)) {
  const id = path.split('/').pop().replace(/\.js$/, '');
  if (m.default && m.default.panels) STILLS[id] = { id, ...m.default };
}
const ease = (u) => u * u * (3 - 2 * u);
const MOVE_ON = 0.4, LAND = 0.38, END = 0.5;

// the pages of a run: panels grouped (three at most a page, or newPage)
function paginate(panels) {
  const pages = [];
  let cur = null;
  panels.forEach((p, i) => {
    if (!cur || p.newPage || cur.length >= 3) { cur = []; pages.push(cur); }
    cur.push(i);
  });
  return pages;
}
// a page's layout by its count (shares of the page's area)
function layout(n) {
  if (n === 1) return [{ x: 0.11, y: 0.14, w: 0.78, h: 0.72 }];
  if (n === 2) return [{ x: 0.07, y: 0.17, w: 0.42, h: 0.62 }, { x: 0.51, y: 0.21, w: 0.42, h: 0.62 }];
  return [{ x: 0.07, y: 0.07, w: 0.43, h: 0.44 }, { x: 0.52, y: 0.09, w: 0.41, h: 0.42 }, { x: 0.12, y: 0.55, w: 0.81, h: 0.38 }];
}

export class Stills {
  constructor(game) {
    this.game = game;
    this.run = null;
    const st = document.createElement('style');
    st.textContent = `
      #stills { position: fixed; inset: 0; z-index: 15; background: #050505; display: none; overflow: hidden; cursor: none; }
      #stills .panel { position: absolute; background: #ebe8e0; box-sizing: border-box; padding: 7px; box-shadow: 0 0 0 1px #050505; }
      #stills .panel .frame { position: absolute; inset: 7px; overflow: hidden; background: #050505; }
      #stills .panel .frame > * { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: 50% 50%; object-fit: cover; }
      #stills .panel .rim { position: absolute; left: 0; top: 0; pointer-events: none; }
      #stills .panel .cap { position: absolute; }
      #stills .hint { position: absolute; left: 50%; bottom: 2.6%; transform: translateX(-50%); font-family: "American Typewriter", "Courier New", monospace; font-size: 13px;
        letter-spacing: 0.3em; text-transform: uppercase; color: #c9c6be; white-space: nowrap; }
      #stills .hint.on { color: #f1eee7; }
    `;
    document.head.appendChild(st);
    this.el = document.createElement('div');
    this.el.id = 'stills';
    document.body.appendChild(this.el);
    this.hint = document.createElement('div');
    this.hint.className = 'hint';
    this.esc = { last: -9, downAt: null };
    this.cache = new Map();   // panel key -> canvas | img
    this.onKey = (e) => this.key(e);
    this.onKeyUp = (e) => { if (e.code === 'Escape') this.esc.downAt = null; };
    this.onMouse = (e) => this.mouse(e);
  }

  get active() { return !!this.run; }
  // the page fully covers the frame (the 3D frame need not be drawn)
  get opaque() { return !!this.run && this.run.cover >= 1; }
  has(id) { return !!STILLS[id]; }
  get ids() { return Object.keys(STILLS); }

  play(id, { onDone = null } = {}) {
    const def = STILLS[id];
    const h = handle(onDone);
    if (!def) { console.warn(`stills.play: no stills '${id}' (stills: ${this.ids.join(', ')})`); h.finish(); return h; }
    if (this.run) this.finish(true);
    // (an ESC of an earlier run does not count toward this one's two)
    this.esc = { last: -9, downAt: null };
    const G = this.game;
    this.run = { id, def, h, pages: paginate(def.panels), page: -1, panel: -1, t: 0, since: 0, landed: [], cover: 0, ending: -1, skipped: false };
    this.el.textContent = '';
    this.el.style.display = 'block';
    this.el.style.opacity = '1';
    this.hint.textContent = 'click: next · esc esc: skip';
    this.hint.classList.remove('on');
    // (the last run's ending faded it out)
    this.hint.style.opacity = '1';
    this.el.appendChild(this.hint);
    G.hud.setStilled(true);
    G.hud.clearPrompt();
    // (the scene goes to black under the page - unseen -, so the run ends on
    // black: a script that goes on to another scene keeps it, one that goes on
    // here comes up out of it - scenes.rise in finish)
    if (G.scenes.current && !G.shotMode) { this.run.black = true; G.scenes.riseT = null; G.scenes.setFade(1); }
    addEventListener('keydown', this.onKey, true);
    addEventListener('keyup', this.onKeyUp, true);
    addEventListener('mousedown', this.onMouse, true);
    this.duck(true);
    this.next();
    return h;
  }

  // ---- input -----------------------------------------------------------------------
  key(e) {
    const R = this.run;
    if (!R) return;
    if (e.code === 'Escape') {
      if (!e.repeat) this.escPress('key'); else if (this.esc.downAt != null && performance.now() - this.esc.downAt > 600) this.skip();
      if (this.esc.downAt == null) this.esc.downAt = performance.now();
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { this.advance(); e.preventDefault(); }
  }
  mouse(e) {
    if (!this.run) return;
    if (e.button !== 0) return;
    // (the mouse let go of - an ESC under the pointer lock -: the click takes it again)
    const C = this.game.controller;
    if (!this.game.shotMode && document.pointerLockElement !== C.dom && C.lock) { try { C.lock(); } catch (err) { /* refused */ } }
    this.advance();
  }
  // one ESC (a key event, or the pointer lock let go: the browser takes the
  // first ESC under the lock for itself); two within 1.2 s skip the run.
  // [C1] (after the critic: only a key event and the lock's loss within
  // 160 ms are one press seen twice - two key events are two presses, however
  // quick the double tap)
  escPress(src = 'key') {
    const now = performance.now();
    if (now - this.esc.last < 160 && src !== this.esc.src) return;   // (one press seen twice)
    if (now - this.esc.last < 1200) { this.skip(); return; }
    this.esc.last = now;
    this.esc.src = src;
    this.hint.textContent = 'esc again skips · click goes on';
    this.hint.classList.add('on');
  }
  lockLost() { if (this.run) this.escPress('lock'); }

  advance() {
    const R = this.run;
    if (!R || R.ending >= 0) return;
    if (R.since < MOVE_ON) return;
    this.next();
  }
  skip() {
    const R = this.run;
    if (!R || R.ending >= 0) return;
    R.skipped = true;
    R.ending = 0;
    R.endDur = 0.25;
    this.game.sfx.play('kit_page', null, {}, { send: false });
  }

  // the next panel: on this page, or a fresh page, or the end
  next() {
    const R = this.run;
    const pg = R.pages[R.page];
    const k = pg ? pg.indexOf(R.panel) : -1;
    if (pg && k >= 0 && k < pg.length - 1) { this.land(pg[k + 1], pg, k + 1); return; }
    if (R.page + 1 < R.pages.length) {
      R.page++;
      // (a fresh page: the old panels go)
      for (const p of [...this.el.querySelectorAll('.panel')]) p.remove();
      R.landed = [];
      const np = R.pages[R.page];
      if (R.page > 0) this.game.sfx.play('kit_page', null, {}, { send: false });
      this.land(np[0], np, 0);
      return;
    }
    R.ending = 0;
    R.endDur = END;
  }

  // a panel lands on the page
  land(i, page, slot) {
    const R = this.run, P = R.def.panels[i];
    R.panel = i;
    R.since = 0;
    const el = this.buildPanel(R.def, i, page, slot);
    this.el.insertBefore(el, this.hint);
    R.landed.push({ i, el, t: 0, P });
    this.game.sfx.play('kit_paper', null, {}, { send: false });
  }

  // the panel's DOM: the gutter, the picture in its frame, the rim, the caption
  buildPanel(def, i, page, slot, { W = innerWidth, H = innerHeight } = {}) {
    const P = def.panels[i];
    const n = page.length;
    const r = P.rect || layout(n)[slot];
    const rng = new RNG(hashSeed(def.id + ':' + i));
    const x = r.x * W, y = r.y * H, w = r.w * W, h = r.h * H;
    const el = document.createElement('div');
    el.className = 'panel';
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    // (a hair off square, as a hand pastes it: less for a big panel)
    el.dataset.tilt = (Math.max(-0.55, Math.min(0.55, rng.gauss() * 0.35)) * (r.w > 0.6 ? 0.6 : 1)).toFixed(3);
    const fr = document.createElement('div');
    fr.className = 'frame';
    el.appendChild(fr);
    const pic = this.picture(def, i, Math.max(2, w - 14), Math.max(2, h - 14));
    fr.appendChild(pic);
    el._pic = pic;
    // the frame line: one hand-drawn ink line round the picture, off square
    const rim = document.createElement('canvas');
    rim.className = 'rim';
    rim.width = Math.round(w * 2); rim.height = Math.round(h * 2);
    rim.style.width = w + 'px'; rim.style.height = h + 'px';
    drawRim(rim.getContext('2d'), w, h, rng);
    el.appendChild(rim);
    if (P.caption) {
      const words = String(P.caption).trim().split(/\s+/).filter((s) => /[A-Za-z0-9]/.test(s));
      if (words.length > 6) console.warn(`stills '${def.id}' panel ${i}: a caption of ${words.length} words (six at most)`);
      const cb = captionBox(P.caption, { size: Math.round(Math.max(14, Math.min(19, H / 50))) });
      cb.canvas.className = 'cap';
      const at = P.cap || 'tl', m = 2;
      cb.canvas.style[at[0] === 't' ? 'top' : 'bottom'] = (at[0] === 't' ? -m : -m) + 'px';
      cb.canvas.style[at[1] === 'l' ? 'left' : 'right'] = (-m + 10) + 'px';
      el.appendChild(cb.canvas);
    }
    return el;
  }

  // the picture: lane C9's file if it is there, else the placeholder drawn
  picture(def, i, w, h) {
    const P = def.panels[i];
    const key = def.id + ':' + i;
    const c = document.createElement('canvas');
    const aspect = P.aspect || w / h;
    const cw = 1200, ch = Math.round(cw / aspect);
    let src = this.cache.get(key);
    if (!src) {
      src = document.createElement('canvas');
      src.width = cw; src.height = ch;
      const g = src.getContext('2d');
      g.fillStyle = '#050505'; g.fillRect(0, 0, cw, ch);
      if (P.draw) P.draw(g, cw, ch, new RNG(hashSeed('art:' + key)));
      this.cache.set(key, src);
      if (P.img) {
        const im = new Image();
        // (the picture keeps its own proportions: it covers the frame, centred)
        im.onload = () => {
          const g2 = src.getContext('2d');
          const k = Math.max(cw / im.width, ch / im.height), dw = im.width * k, dh = im.height * k;
          g2.fillStyle = '#050505'; g2.fillRect(0, 0, cw, ch);
          g2.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
          // [C9] (the panel's own canvas drawn again at once: a picture that
          // loaded before the panel's first frame - a quick server, a cached
          // file - left the placeholder up for the whole panel; and a mark the
          // plays read: the picture is the file's)
          src._loaded = true;
          for (const L of this.run ? this.run.landed : []) if (L.i === i && this.run.id === def.id && L.el._pic && L.el._pic._redraw) L.el._pic._redraw();
          if (this.shotRun) for (const el of this.el.querySelectorAll('.panel')) if (el._pic && el._pic._redraw) el._pic._redraw();
        };
        im.onerror = () => { /* the placeholder stays */ };
        im.src = P.img;
      }
    }
    // (the panel's own canvas, the picture covering the frame)
    c.width = Math.round(w); c.height = Math.round(h);
    const draw = () => {
      const g = c.getContext('2d');
      const k = Math.max(c.width / src.width, c.height / src.height);
      const dw = src.width * k, dh = src.height * k;
      g.fillStyle = '#050505'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(src, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    };
    draw();
    c._redraw = draw;
    return c;
  }

  // ---- per rendered frame (real time: the game is paused under it) ------------------
  update(dt) {
    const R = this.run;
    if (!R) return;
    R.t += dt;
    R.since += dt;
    R.cover = Math.min(1, R.cover + dt / 0.25);
    // [C9] (after the critic: 'esc again skips' stayed up after the 1.2 s in
    // which a second ESC skips - a player who read it and pressed got nothing:
    // the hint goes back when the window shuts)
    if (this.hint.classList.contains('on') && performance.now() - this.esc.last >= 1200) {
      this.hint.textContent = 'click: next · esc esc: skip';
      this.hint.classList.remove('on');
    }
    for (const L of R.landed) {
      L.t += dt;
      this.pose(L, R.def);
      if (!L.redraw) L.redraw = () => L.el._pic._redraw && L.el._pic._redraw();
    }
    // (moves on by itself after the panel's secs)
    const P = R.def.panels[R.panel];
    if (R.ending < 0 && P && R.since >= Math.max(2, Math.min(4, P.secs ?? 3))) this.next();
    if (R.ending >= 0) {
      R.ending += dt;
      const u = Math.min(1, R.ending / R.endDur);
      // (the page goes to black, not to the game: the scene comes up out of the black itself)
      for (const L of R.landed) L.el.style.opacity = (1 - u).toFixed(3);
      this.hint.style.opacity = (1 - u).toFixed(3);
      if (u >= 1) this.finish(false);
    }
  }
  // a landed panel: in (a drop and a fade), then its slow drift
  pose(L, def) {
    const P = L.P;
    const a = ease(Math.min(1, L.t / LAND));
    const tilt = parseFloat(L.el.dataset.tilt) || 0;
    L.el.style.opacity = a.toFixed(3);
    L.el.style.transform = `translateY(${((1 - a) * -10).toFixed(1)}px) rotate(${tilt}deg)`;
    const span = Math.max(2, Math.min(4, P.secs ?? 3)) + 5;
    const u = ease(Math.min(1, L.t / span));
    const f = driftKey(P.from, { s: 1.04, x: -0.012, y: 0.004 }), t = driftKey(P.to, { s: 1.09, x: 0.012, y: -0.008 });
    const s = f.s + (t.s - f.s) * u, x = f.x + (t.x - f.x) * u, y = f.y + (t.y - f.y) * u;
    const pic = L.el._pic;
    if (pic) pic.style.transform = `translate(${(x * 100).toFixed(3)}%, ${(y * 100).toFixed(3)}%) scale(${s.toFixed(4)})`;
  }

  finish(quiet) {
    const R = this.run;
    if (!R) return;
    const G = this.game;
    this.run = null;
    removeEventListener('keydown', this.onKey, true);
    removeEventListener('keyup', this.onKeyUp, true);
    removeEventListener('mousedown', this.onMouse, true);
    this.el.style.display = 'none';
    this.el.textContent = '';
    G.hud.setStilled(false);
    this.duck(false);
    // (the keys that moved the panels on are spent: none reaches the scene)
    G.keysDown.clear(); G.keysUp.clear();
    G.vin.down.clear(); G.vin.up.clear();
    G._mouseAcc.dx = 0; G._mouseAcc.dy = 0; G._mouseAcc.wheel = 0;
    this.last = { id: R.id, skipped: R.skipped, panels: R.landed.length, secs: +R.t.toFixed(2) };
    G.emit('stills:end', { id: R.id, skipped: R.skipped });
    R.h.finish({ id: R.id, skipped: R.skipped });
    // (the scene it was played in goes on: up out of the black, unless its
    // script goes on to another scene first - go() cancels the rise)
    if (R.black && !quiet && G.scenes.current && !G.scenes.trans) G.scenes.rise();
  }

  // the rain and the room's bed duck under the page; the music plays on
  duck(on) {
    const S = this.game.sfx;
    if (!S || !S.live || !S.amb) return;
    const t = S.ctx.currentTime;
    S.amb.gain.setTargetAtTime((S.ambLevel ?? 0.4) * (on ? 0.35 : 1), t, 0.25);
    if (S.wallG) S.wallG.gain.setTargetAtTime(on ? 0.5 : 1, t, 0.25);
  }

  // shot mode: the page of panel n, panels 0..n of it landed, the drift at its middle
  shot(id, n = 0) {
    const def = STILLS[id];
    if (!def) { console.error(`still=${id}: no stills '${id}' (stills: ${this.ids.join(', ')})`); return; }
    const pages = paginate(def.panels);
    const pi = pages.findIndex((p) => p.includes(n));
    if (pi < 0) { console.error(`still=${id}&panel=${n}: it has ${def.panels.length} panels`); return; }
    this.el.textContent = '';
    this.el.style.display = 'block';
    this.shotRun = { cover: 1 };
    const page = pages[pi];
    for (let k = 0; k <= page.indexOf(n); k++) {
      const i = page[k];
      const el = this.buildPanel(def, i, page, k);
      this.el.appendChild(el);
      const P = def.panels[i];
      const span = Math.max(2, Math.min(4, P.secs ?? 3)) + 5;
      this.pose({ el, P, t: LAND + (span - LAND) * 0.5 }, def);
      el.style.opacity = '1';
    }
    this.game.hud.setStilled(true);
  }
  get shotOpaque() { return !!this.shotRun; }
}

// a drift key: { s, x, y } (scale, offset as a share of the frame), or a rect
// of the picture the frame shows, { x, y, w, h } (shares of the picture)
function driftKey(k, d) {
  if (!k) return d;
  if (k.w != null) {
    const w = Math.max(0.05, Math.min(1, k.w)), h = Math.max(0.05, Math.min(1, k.h ?? k.w));
    const s = 1 / Math.min(w, h);
    return { s, x: (0.5 - ((k.x ?? 0) + w / 2)) * s, y: (0.5 - ((k.y ?? 0) + h / 2)) * s };
  }
  return { s: k.s ?? 1, x: k.x ?? 0, y: k.y ?? 0 };
}

// a comic's frame line: one ink line round the picture, a hair off square,
// heavier on two sides, drawn with a wobble (w, h CSS pixels; the canvas x2)
function drawRim(g, w, h, rng) {
  g.scale(2, 2);
  g.strokeStyle = '#050505';
  g.lineCap = 'round'; g.lineJoin = 'round';
  const inset = 6.5;
  const pts = [[inset, inset], [w - inset, inset], [w - inset, h - inset], [inset, h - inset]].map(([x, y]) => [x + rng.gauss() * 0.9, y + rng.gauss() * 0.9]);
  for (let s = 0; s < 4; s++) {
    const [ax, ay] = pts[s], [bx, by] = pts[(s + 1) % 4];
    g.lineWidth = 2.2 + (s === 1 || s === 2 ? 0.9 : 0) + rng.next() * 0.5;
    g.beginPath();
    g.moveTo(ax, ay);
    const n = 8;
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      g.lineTo(ax + (bx - ax) * u + rng.gauss() * 0.35, ay + (by - ay) * u + rng.gauss() * 0.35);
    }
    g.stroke();
  }
}

function handle(onDone) {
  let resolve;
  const p = new Promise((r) => { resolve = r; });
  const h = {
    done: false, skipped: false,
    finish(r = {}) { if (h.done) return; h.done = true; h.skipped = !!r.skipped; resolve(h); if (onDone) onDone(h); },
    then(a, b) { return p.then(a, b); },
  };
  return h;
}
