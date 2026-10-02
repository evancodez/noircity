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
      #hud.failing #fightcards { visibility: hidden; }
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
    const wm = this.wm;
    if ((this.ticks && this.ticks.length) || (wm && wm.lv) || (this.tells && this.tells.length)) {
      for (const k of this.ticks || []) k.t -= dt;
      this.ticks = (this.ticks || []).filter((k) => k.t > 0);
      for (const k of this.tells || []) k.t -= dt;
      this.tells = (this.tells || []).filter((k) => k.t > 0);
      if (wm && wm.lv) {
        for (let i = 0; i < 3; i++) wm.age[i] += dt;
        if (wm.flash > 0) wm.flash -= dt;
        if (wm.fade > 0) { wm.fade -= dt; if (wm.fade <= 0) { wm.lv = 0; wm.age = [0, 0, 0]; wm.flash = 0; } }
      }
      this.drawTicks();
    }
    // [B8] the chevron (a thrown thing): pops in, then holds
    if (this.chev && this.chev.side) { this.chev.t += dt; this.drawChevron(); }
    // [C4] the dodge cue going: its ink lifts in a tenth of a second
    if (this.cueOut) { this.cueOut.t += dt; this.drawCue(); }
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
  // [C4] after the critic (B3): the tell of a small blow of his (his jab,
  // his cross, his answer, a feint) - three short white strokes flicked out
  // round the fist that cocks, for a fifth of a second: a comic's 'here it
  // comes' (no slowdown, no side: the big ones have the cue). at: the fist
  // on the frame (CSS px); side: the side of the frame it comes from
  tellMark(at, side, dur = 0.22) {
    if (!at) return;
    (this.tells || (this.tells = [])).push({ x: at.x, y: at.y, s: side === 'L' ? -1 : 1, t: dur, dur });
    this.drawTicks();
  }
  // [B8] the wind-up's ticks (§2): as the held punch passes each level a
  // white ink tick flicks out at the fist and stays while it is held (one,
  // two, three: the load read at a glance, never a bar), the ticks riding
  // with the fist; at full the fist flashes - a ring of pressed white strokes
  // round it for a few frames. windMarks(at, side, lv) every step of the
  // wind-up (at: the fist on the frame, CSS px); windMarks(null) lets them
  // go (they fade in a tenth of a second).
  windMarks(at, side, lv) {
    const K = innerHeight / 900;
    const W = this.wm || (this.wm = { lv: 0, age: [0, 0, 0], flash: 0, fade: 0 });
    if (!at) { if (W.lv && W.fade <= 0) W.fade = 0.12; return; }
    if (lv > W.lv) { for (let i = W.lv; i < lv; i++) W.age[i] = 0; if (lv >= 3) W.flash = 0.09; }
    if (lv < W.lv) W.age = [0, 0, 0];
    Object.assign(W, { x: at.x, y: at.y, s: side === 'L' ? -1 : 1, lv, k: K, fade: 0 });
    this.drawTicks();
  }
  drawTicks() {
    const c = this.tickC || (this.tickC = (() => { const e = document.createElement('canvas'); e.className = 'ticks'; e.style.cssText = 'position:absolute;left:0;top:0'; this.root.appendChild(e); return e; })());
    const W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    const stroke = (x0, y0, x1, y1, w) => {
      g.strokeStyle = 'rgba(5,5,5,0.85)'; g.lineWidth = w + 3;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = '#f4f2ec'; g.lineWidth = w;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    };
    const Wm = this.wm;
    if (Wm && Wm.lv && Wm.x != null) {
      const K = Wm.k, fa = Wm.fade > 0 ? Wm.fade / 0.12 : 1;
      g.globalAlpha = fa;
      // (each tick: flicked out from the fist's edge, a stroke that grows in
      // 0.06 s and then holds, pressed at its root)
      for (let i = 0; i < Wm.lv; i++) {
        const ang = -Math.PI / 2 + [0.1, 0.62, 1.14][i] * Wm.s;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const grow = Math.min(1, Wm.age[i] / 0.06);
        const r0 = 92 * K, len = (22 + 34 * grow) * K, w = (6 + 1.5 * i) * K * (grow < 1 ? 1.25 : 1);
        stroke(Wm.x + dx * r0, Wm.y + dy * r0, Wm.x + dx * (r0 + len), Wm.y + dy * (r0 + len), w);
      }
      if (Wm.flash > 0) {
        // (the flash at full: fourteen strokes round the fist, pressed, gone)
        const r = new RNG(7);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + r.gauss() * 0.07, r0 = (84 + r.range(0, 14)) * K, r1 = r0 + (40 + r.range(0, 36)) * K;
          stroke(Wm.x + Math.cos(a) * r0, Wm.y + Math.sin(a) * r0, Wm.x + Math.cos(a) * r1, Wm.y + Math.sin(a) * r1, 7 * K);
        }
      }
      g.globalAlpha = 1;
    }
    // ([C4] the small blow's tell: three strokes out from the fist, the
    // middle one longest, toward the side it comes from and up)
    for (const k of this.tells || []) {
      const age = k.dur - k.t, grow = Math.min(1, age / 0.05), fade = Math.min(1, k.t / 0.06);
      const K = innerHeight / 900;
      g.globalAlpha = fade;
      for (const [a, l] of [[-1.05, 0.75], [-0.55, 1.0], [-0.05, 0.75]]) {
        const ang = -Math.PI / 2 + (a + 0.55) * k.s * -1;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const r0 = 44 * K, len = (18 + 30 * l * grow) * K;
        stroke(k.x + dx * r0, k.y + dy * r0, k.x + dx * (r0 + len), k.y + dy * (r0 + len), 7 * K);
      }
      g.globalAlpha = 1;
    }
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

  // [B8] a thing is coming (§4): a small inked chevron low at the side of the
  // frame to step to ('L' | 'R'), pointing that way; null hides it. It stays
  // in the game after the lesson, for thrown things only.
  chevron(side) {
    if (!side) { if (this.chev && this.chev.side) { this.chev.side = null; this.drawChevron(); } return; }
    if (this.chev && this.chev.side === side) return;
    this.chev = { side, t: 0 };
    this.shownChevron = side;
    this.drawChevron();
  }
  drawChevron() {
    const c = this.chevC || (this.chevC = (() => { const e = document.createElement('canvas'); e.className = 'chevron'; e.style.cssText = 'position:absolute;left:0;top:0'; this.root.appendChild(e); return e; })());
    const W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const C = this.chev;
    if (!C || !C.side) return;
    const K = H / 900, s = C.side === 'L' ? -1 : 1;
    // (pops in over 0.08 s, from a little further in)
    const u = Math.min(1, C.t / 0.08), e = 1 - (1 - u) * (1 - u);
    const cx = W / 2 + s * (W * 0.3 + 14 * e * K), cy = H * 0.74;
    const r = new RNG(C.side === 'L' ? 91 : 92);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // two nested chevrons, pressed strokes with a dry end
    for (const [off, a] of [[0, 1], [-26, 0.75]]) {
      const x = cx + s * off * K;
      const pts = [[x - s * 20 * K, cy - 26 * K], [x + s * 8 * K, cy], [x - s * 20 * K, cy + 26 * K]];
      for (const [col, w] of [['rgba(5,5,5,0.85)', 13], ['#f2f0ea', 8]]) {
        g.strokeStyle = col; g.globalAlpha = a * e; g.lineWidth = (w + r.gauss() * 0.4) * K;
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  // ---- [C4] the dodge cue (FIGHT.md version 5 §5; game/BrawlCue.js) ----------------------
  // Ink, not UI: the frame itself says "go that way". The side the blow
  // comes from goes black - a loaded brush laid on from that edge, its inner
  // edge torn, bristles dragged inward; the safe side opens up white - a
  // flare of paper at that edge and speed strokes drawn toward it; what is
  // coming (his fist, the thrown thing) is rimmed in white, as a comic
  // panel's emphasis. cue({ side: 'L' | 'R' (the safe side), k (0..1 in),
  // t, held, at (the threat on the frame, CSS px), px (its size) }) each
  // step; cue(null, answer) lets it go (0.14 s; a slip flashes the light).
  // ?cue=wash draws the second design (the dark half a soft wash, one big
  // stroke to the light), ?cue=lines the third (speed lines from the dark
  // edge, converging on the fist): the strips compared them (report).
  cue(s, answer = null) {
    if (!s) {
      if (this.cueS) this.cueOut = { t: 0, answer, s: this.cueS };
      this.cueS = null;
      this.drawCue();
      return;
    }
    this.cueS = s; this.cueOut = null; this.shownCue = s.side;
    this.drawCue();
  }
  drawCue() {
    const c = this.cueC || (this.cueC = (() => { const e = document.createElement('canvas'); e.className = 'cue'; e.style.cssText = 'position:absolute;left:0;top:0'; this.root.insertBefore(e, this.root.firstChild); return e; })());
    const W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    let S = this.cueS, fade = 1, flash = 0;
    if (!S && this.cueOut) {
      const u = this.cueOut.t / 0.14;
      if (u >= 1) { this.cueOut = null; this.shownCue = null; return; }
      S = this.cueOut.s; fade = 1 - u;
      if (this.cueOut.answer === 'right') flash = 1 - u;
    }
    if (!S) return;
    const style = this.cueStyle || (this.cueStyle = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('cue')) || 'ink');
    const K = H / 900, s = S.side === 'R' ? 1 : -1;
    const e = 1 - Math.pow(1 - Math.min(1, S.k), 2);
    // (held for the lesson: the ink breathes a little)
    const breath = S.held ? 1 + 0.04 * Math.sin(S.t * 9) : 1;
    const edgeD = s > 0 ? 0 : W;          // the dark edge (the side it comes from)
    const edgeL = s > 0 ? W : 0;          // the light edge
    const inward = s > 0 ? 1 : -1;        // from the dark edge into the frame
    const r = new RNG(S.side === 'R' ? 4411 : 4412);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (style === 'wash') {
      // the dark half a wash of ink from its edge to the middle
      const gr = g.createLinearGradient(edgeD, 0, W / 2, 0);
      gr.addColorStop(0, `rgba(4,4,4,${(0.9 * e * fade).toFixed(3)})`); gr.addColorStop(0.55, `rgba(4,4,4,${(0.55 * e * fade).toFixed(3)})`); gr.addColorStop(1, 'rgba(4,4,4,0)');
      g.fillStyle = gr; g.fillRect(Math.min(edgeD, W / 2), 0, W / 2, H);
      // one big curved stroke toward the light
      const y = H * 0.52, x0 = W / 2 + s * W * 0.04, x1 = W / 2 + s * W * (0.1 + 0.3 * e);
      for (const [col, w] of [['rgba(5,5,5,0.85)', 30], ['rgba(244,242,236,0.95)', 20]]) {
        g.strokeStyle = col; g.globalAlpha = fade; g.lineWidth = w * K;
        g.beginPath(); g.moveTo(x0, y + 26 * K); g.quadraticCurveTo((x0 + x1) / 2, y - 30 * K, x1, y - 6 * K); g.stroke();
      }
      g.globalAlpha = 1;
    } else if (style === 'lines') {
      // speed lines from the dark edge, converging on what comes
      const at = S.at || { x: W / 2 - s * W * 0.15, y: H * 0.45 };
      for (let i = 0; i < 16; i++) {
        const y0 = H * (i + 0.5) / 16 + r.gauss() * 8;
        const len = (0.35 + 0.4 * r.next()) * e;
        const x1 = edgeD + (at.x - edgeD) * len, y1 = y0 + (at.y - y0) * len;
        for (const [col, w] of [['rgba(5,5,5,0.9)', 7], ['rgba(244,242,236,0.9)', 3]]) {
          g.strokeStyle = col; g.globalAlpha = fade; g.lineWidth = w * K;
          g.beginPath(); g.moveTo(edgeD, y0); g.lineTo(x1, y1); g.stroke();
        }
      }
      g.globalAlpha = 1;
      const gl = g.createLinearGradient(edgeL, 0, edgeL - s * W * 0.14, 0);
      gl.addColorStop(0, `rgba(244,242,236,${(0.45 * e * fade + 0.4 * flash).toFixed(3)})`); gl.addColorStop(1, 'rgba(244,242,236,0)');
      g.fillStyle = gl; g.fillRect(s > 0 ? W - W * 0.14 : 0, 0, W * 0.14, H);
    } else {
      // ---- 'ink' (kept): the dark side, a loaded brush laid on from its edge
      const D = W * 0.27 * e * breath;
      const n = 28, pts = [];
      for (let i = 0; i <= n; i++) {
        const y = H * i / n;
        // (the torn inner edge: deeper at the middle where the blow comes,
        // teeth and runs of the dry brush)
        const mid = 1 - Math.pow((y / H - 0.48) * 1.7, 2) * 0.35;
        const tooth = (i % 2 ? 0.86 : 1.0) + r.gauss() * 0.06;
        pts.push([edgeD + inward * D * mid * tooth, y]);
      }
      g.globalAlpha = 0.93 * fade;
      g.fillStyle = '#050505';
      g.beginPath(); g.moveTo(edgeD, -2);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.lineTo(edgeD, H + 2); g.closePath(); g.fill();
      // bristles dragged on inward from the edge, running dry
      for (let i = 0; i < 22; i++) {
        const y = H * (0.04 + 0.92 * r.next());
        const base = pts[Math.round(y / H * n)][0];
        const len = (24 + 110 * r.next()) * K * e;
        g.lineWidth = (2 + 5 * r.next()) * K;
        g.strokeStyle = 'rgba(5,5,5,0.85)';
        g.beginPath(); g.moveTo(base - inward * 4, y); g.lineTo(base + inward * len, y + r.gauss() * 5 * K); g.stroke();
      }
      g.globalAlpha = 1;
      // the light side: paper torn open at its edge (a flare of white, its
      // torn inner edge inked), white bristles drawn in from it
      const PD = W * 0.12 * (0.55 + 0.45 * e) * breath;
      // (torn, not cut: teeth of every size at uneven steps)
      const lp = [];
      for (let y = 0, i = 0; y <= H + 1; i++) {
        const mid = 1 - Math.pow((y / H - 0.5) * 1.6, 2) * 0.45;
        const tooth = i % 2 ? 0.62 + 0.3 * r.next() : 0.92 + 0.22 * r.next();
        lp.push([edgeL - inward * PD * mid * tooth, Math.min(H, y)]);
        y += H * (0.012 + 0.03 * r.next());
      }
      const lpAt = (y) => { let best = lp[0]; for (const p of lp) if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; return best[0]; };
      const lightA = Math.min(1, 0.86 * e * fade + 0.6 * flash);
      g.globalAlpha = lightA;
      g.fillStyle = '#f4f2ec';
      g.beginPath(); g.moveTo(edgeL, -2);
      for (const [x, y] of lp) g.lineTo(x, y);
      g.lineTo(edgeL, H + 2); g.closePath(); g.fill();
      for (let i = 0; i < 14; i++) {
        const y = H * (0.06 + 0.88 * r.next());
        const base = lpAt(y);
        const len = (18 + 70 * r.next()) * K * e;
        g.lineWidth = (2 + 4 * r.next()) * K;
        g.strokeStyle = '#f4f2ec';
        g.beginPath(); g.moveTo(base + inward * 3, y); g.lineTo(base - inward * len, y + r.gauss() * 4 * K); g.stroke();
      }
      g.globalAlpha = 1;
      // and three brush strokes drawn toward it, sliding out with the window
      const go = Math.min(1, (S.t || 0) / 0.34);
      for (const [yk, l0, w0] of [[0.4, 0.17, 15], [0.5, 0.23, 20], [0.6, 0.15, 13]]) {
        const y = H * yk + Math.sin(yk * 40) * 6 * K;
        const x0 = W / 2 + s * W * (0.1 + 0.06 * go), x1 = x0 + s * W * l0 * e;
        for (const [col, extra] of [['rgba(5,5,5,0.88)', 5], ['#f4f2ec', 0]]) {
          g.fillStyle = col; g.globalAlpha = fade;
          // (pressed at its root, running to a dry point at the light)
          const ww = (w0 * K + extra) / 2, tip = (1.5 * K + extra) / 2;
          const xm = x0 + (x1 - x0) * 0.25;
          g.beginPath();
          g.moveTo(x0, y);
          g.quadraticCurveTo(x0 + s * 4 * K, y - ww, xm, y - ww);
          g.lineTo(x1, y - tip); g.lineTo(x1 + s * 3 * K, y); g.lineTo(x1, y + tip);
          g.lineTo(xm, y + ww * 0.8);
          g.quadraticCurveTo(x0 + s * 4 * K, y + ww * 0.8, x0, y);
          g.closePath(); g.fill();
        }
      }
      g.globalAlpha = 1;
    }
    // what is coming, marked in white: three strokes trailing it from the
    // dark side, as a comic draws a fist on its way (a thrown thing has its
    // own speed lines: drawFlying)
    if (S.at && !this.cueOut && S.kind !== 'thing') {
      const R0 = Math.max(18, S.px * 0.45);
      for (const [col, extra] of [['rgba(5,5,5,0.88)', 5], ['#f4f2ec', 0]]) {
        g.fillStyle = col; g.globalAlpha = e * fade;
        for (const [a, l, w] of [[-0.42, 0.8, 9], [0, 1.15, 12], [0.42, 0.75, 8]]) {
          const dx = -inward * Math.cos(a), dy = Math.sin(a);
          const x0 = S.at.x + dx * R0, y0 = S.at.y + dy * R0;
          const L = (40 + 70 * l) * K * e;
          const x1 = x0 + dx * L, y1 = y0 + dy * L;
          const px = -dy, py = dx, ww = (w * K + extra) / 2, tail = (1.2 * K + extra) / 2;
          g.beginPath();
          g.moveTo(x0 + px * ww, y0 + py * ww); g.lineTo(x1 + px * tail, y1 + py * tail);
          g.lineTo(x1 - px * tail, y1 - py * tail); g.lineTo(x0 - px * ww, y0 - py * ww);
          g.closePath(); g.fill();
        }
      }
      g.globalAlpha = 1;
    }
  }

  // [B8] (second pass) a thing he has thrown, on the frame: three speed
  // lines trailing back toward his hand, inked like the chevron (a dark
  // plate against the dark room at five metres was lost). [R2-H] Speed
  // lines only: the ring and the paper-white rim round the thing were loud
  // (the art director, frame 07); the plate itself goes up light in the air
  // (Brawl.lightThing) and the lines show which way it came.
  // list: [{ x, y (the thing), fx, fy (where it came from), r (its size on
  // the frame, px), t (s in the air) }] | null
  flying(list) {
    const c = this.flyC || (this.flyC = (() => { const e = document.createElement('canvas'); e.className = 'flying'; e.style.cssText = 'position:absolute;left:0;top:0'; this.root.insertBefore(e, this.root.firstChild); return e; })());
    const W = innerWidth, H = innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    this.shownFlying = list ? list.length : 0;
    if (!list) return;
    const K = H / 900;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const F of list) {
      const r = F.r;
      let dx = F.fx - F.x, dy = F.fy - F.y;
      const L = Math.hypot(dx, dy);
      // (the way it is going, when it is told: back up its own velocity)
      if (F.tx || F.ty) { const l = Math.hypot(F.tx, F.ty) || 1; dx = F.tx / l; dy = F.ty / l; }
      else if (L < 1e-3) { dx = 0; dy = -1; } else { dx /= L; dy /= L; }
      const px = -dy, py = dx;
      // (the lines grow out in the first twentieth of a second)
      const grow = Math.min(1, F.t / 0.05);
      const lines = [[-0.55, 1.4, 3.0], [0, 2.4, 4.0], [0.55, 1.2, 3.0]];
      for (const [col, extra] of [['rgba(5,5,5,0.85)', 3], ['#f2f0ea', 0]]) {
        g.strokeStyle = col; g.fillStyle = col;
        for (const [off, len, w] of lines) {
          const x0 = F.x + dx * r * 0.95 + px * off * r, y0 = F.y + dy * r * 0.95 + py * off * r;
          const l = Math.min(L + r, (len * r + 18 * K) * grow);
          const x1 = x0 + dx * l, y1 = y0 + dy * l;
          // (a tapering stroke: pressed at the thing, dry at its tail)
          const ww = (w * K + extra) / 2, tail = (0.6 * K + extra) / 2;
          g.beginPath();
          g.moveTo(x0 + px * ww, y0 + py * ww); g.lineTo(x1 + px * tail, y1 + py * tail);
          g.lineTo(x1 - px * tail, y1 - py * tail); g.lineTo(x0 - px * ww, y0 - py * ww);
          g.closePath(); g.fill();
        }
      }
    }
  }

  clear() { this.cueS = null; this.cueOut = null; if (this.cueC) this.drawCue(); this.flying(null); this.card(''); this.fl.style.display = 'none'; this.flT = 0; this.shownFlash = ''; this.arrow(null); this.charge(null, 0); this.chevron(null); if (this.wm) this.wm.lv = 0; this.tells = []; this.ticks = []; if (this.tickC) this.drawTicks(); }
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
