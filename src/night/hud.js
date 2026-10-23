import { RNG } from '../util/rng.js';
import { pockets } from '../world/items.js';   // [O7] Tab's lines take O1b's pockets
import { frayEdges, blob } from '../ui/inkArt.js';
import { strikeStroke } from '../ui/lettering.js';

// NOIR CITY's HUD (lane O7, docs/seams/NIGHT.md §1), in the HUD's own ink
// and lettering (src/ui/Hud.js, kit.js), every piece only while a player
// would notice it:
//   the heat     top right, 0 to 5 police shields: a shield brushed in as it
//                rises (a thump), struck through as it falls; the search a
//                half-tone that breathes; nothing at all at heat 0
//   the money    bottom right in the typewriter face, only when it changes
//                (the change comes, the sum counts to it, it goes) and on Tab
//   Tab held     the heat (the empty shields too), the money, the car's
//                state, the hour - for as long as it is held, nothing else
//   the line     the kit's objective (top left) as the player's situation:
//                the heat's line over anything taken up (`Lose them.`,
//                `Stay out of sight.`, `Clear.`), the thing taken up (a fare's
//                `The Hill.`) when there is no heat; hud.objective(text) from
//                any lane is the taken-up line (the night keeps it under the
//                heat's and gives it back when the heat is gone)
//   saved        a small tick and `saved` bottom right for a moment (the
//                quiet autosave)
// Everything lives in the HUD's root: hidden in shot mode unless hud=1,
// under the title, the pause card, the stills and a fail's black.
const TYPE = '"American Typewriter", "Courier New", monospace';
export const HEAT_LINES = { up: 'Lose them.', search: 'Stay out of sight.', clear: 'Clear.' };
const BADGE = 34;   // CSS px

// a police shield in ink: paper, an ink rim, a star in it (seeded: no two alike)
export function drawShield(size, seed, { empty = false, scale = 2 } = {}) {
  const c = document.createElement('canvas');
  const S = size * scale;
  c.width = S; c.height = Math.round(S * 1.15);
  const g = c.getContext('2d');
  const rng = new RNG(seed);
  const w = S, h = c.height;
  const j = () => rng.gauss() * S * 0.012;
  const path = () => {
    g.beginPath();
    g.moveTo(w * 0.5 + j(), h * 0.06 + j());
    g.quadraticCurveTo(w * 0.72, h * 0.16, w * 0.9 + j(), h * 0.1 + j());
    g.quadraticCurveTo(w * 0.96, h * 0.42, w * 0.82 + j(), h * 0.66 + j());
    g.quadraticCurveTo(w * 0.68, h * 0.86, w * 0.5 + j(), h * 0.95 + j());
    g.quadraticCurveTo(w * 0.32, h * 0.86, w * 0.18 + j(), h * 0.66 + j());
    g.quadraticCurveTo(w * 0.04, h * 0.42, w * 0.1 + j(), h * 0.1 + j());
    g.quadraticCurveTo(w * 0.28, h * 0.16, w * 0.5 + j(), h * 0.06 + j());
    g.closePath();
  };
  g.lineJoin = 'round';
  if (empty) {
    path();
    g.strokeStyle = 'rgba(236,233,226,0.5)'; g.lineWidth = S * 0.05; g.stroke();
    return finish(c, size);
  }
  // the ink ground round it (it reads on paper-white rain and on black)
  path(); g.strokeStyle = '#050505'; g.lineWidth = S * 0.16; g.stroke();
  path(); g.fillStyle = '#ebe8e1'; g.fill();
  // the star, ink, a little off true
  const cx = w * 0.5 + j(), cy = h * 0.46 + j(), R = S * 0.23, r = R * 0.45;
  g.fillStyle = '#060606';
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5 + rng.gauss() * 0.03; const rr = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  blob(g, cx, cy, r * 0.5, rng, 0.2);
  // a worn bite out of the paper here and there (the brush's)
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 3; i++) blob(g, w * rng.range(0.2, 0.8), h * rng.range(0.12, 0.85), S * rng.range(0.012, 0.03), rng, 0.4);
  g.globalCompositeOperation = 'source-over';
  frayEdges(c, [236, 233, 226], new RNG(seed + 5), S * 0.6);
  return finish(c, size);
}
function finish(c, size) { c.style.width = size + 'px'; c.style.height = Math.round(size * 1.15) + 'px'; return c; }

export class NightHud {
  constructor(night) {
    this.night = night;
    const G = night.game, hud = G.hud;
    this.G = G; this.hud = hud;
    const st = document.createElement('style');
    st.textContent = `
      #hud .nheat { position: absolute; right: 34px; top: 26px; display: flex; gap: 6px; opacity: 0; transition: opacity 0.5s; pointer-events: none; }
      #hud .nheat.up { opacity: 1; }
      #hud .nheat .b { position: relative; width: ${BADGE}px; height: ${Math.round(BADGE * 1.15)}px; filter: drop-shadow(0 0 3px rgba(0,0,0,0.85)); }
      #hud .nheat .b canvas { position: absolute; left: 0; top: 0; }
      #hud .nheat .b .lit { clip-path: inset(0 100% 0 0); transition: clip-path 0.32s ease-out, opacity 0.5s; }
      #hud .nheat .b.on .lit { clip-path: inset(0 0 0 0); }
      #hud .nheat .b.gone .lit { opacity: 0; }
      #hud .nheat .b .emp { opacity: 0; transition: opacity 0.3s; }
      #hud .nheat.tab .b .emp { opacity: 1; }
      #hud .nheat .b .x { left: -6px !important; top: 46% !important; clip-path: inset(0 100% 0 0); transition: clip-path 0.22s ease-out, opacity 0.5s; }
      #hud .nheat .b.struck .x { clip-path: inset(0 0 0 0); }
      #hud .nheat .b.gone .x { opacity: 0; }
      #hud .nheat.srch .b.on .lit { animation: nsrch 1.8s ease-in-out infinite; }
      @keyframes nsrch { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.25; } }
      #hud .nmoney { position: absolute; right: 38px; bottom: 30px; text-align: right; font-family: ${TYPE}; color: #ece9e2; opacity: 0; transition: opacity 0.6s, bottom 0.25s;
        text-shadow: 0 0 4px #000, 0 0 2px #000, 0 0 1px #000; pointer-events: none; }
      #hud .nmoney.up { opacity: 1; transition: opacity 0.15s, bottom 0.25s; }
      #hud:not(.nogun) .nmoney { bottom: 112px; }
      #hud .nmoney .v { font-size: 30px; letter-spacing: 0.04em; line-height: 1; }
      #hud .nmoney .v small { font-size: 19px; margin-right: 6px; color: #cfccc5; }
      #hud .nmoney .d { font-size: 14px; letter-spacing: 0.25em; color: #d8d5ce; min-height: 18px; margin-bottom: 4px; }
      #hud .ntab { position: absolute; right: 36px; top: 76px; text-align: right; font-family: ${TYPE}; font-size: 13px; line-height: 24px; letter-spacing: 0.3em;
        text-transform: uppercase; color: #e6e3dc; text-shadow: 0 0 4px #000, 0 0 2px #000; opacity: 0; transition: opacity 0.2s; pointer-events: none; white-space: nowrap; }
      #hud .ntab.up { opacity: 1; }
      #hud .nsaved { position: absolute; right: 40px; bottom: 30px; font-family: ${TYPE}; font-size: 11px; letter-spacing: 0.4em; color: #bdbab3; text-transform: uppercase;
        opacity: 0; transition: opacity 0.5s; text-shadow: 0 0 3px #000; pointer-events: none; display: flex; align-items: center; gap: 8px; }
      #hud .nsaved.up { opacity: 0.85; }
      #hud .nmoney.up ~ .nsaved { opacity: 0 !important; }
      #hud.titled .nheat, #hud.titled .nmoney, #hud.titled .ntab, #hud.titled .nsaved { display: none; }
      #hud.stilled .nheat, #hud.stilled .nmoney, #hud.stilled .ntab, #hud.failing .nheat, #hud.failing .nmoney, #hud.failing .ntab, #hud.failing .nsaved { visibility: hidden; }
      #hud.nnocity .nheat, #hud.nnocity .nmoney, #hud.nnocity .ntab { display: none; }
    `;
    document.head.appendChild(st);
    const mk = (cls) => { const e = document.createElement('div'); e.className = cls; hud.root.appendChild(e); return e; };
    this.heatEl = mk('nheat');
    this.badges = [];
    for (let i = 0; i < 5; i++) {
      const b = document.createElement('div');
      b.className = 'b';
      const emp = drawShield(BADGE, 900 + i, { empty: true }); emp.className = 'emp';
      const lit = drawShield(BADGE, 700 + i * 13); lit.className = 'lit';
      const x = strikeStroke(BADGE + 12, 12, 40 + i); x.className = 'x'; x.style.position = 'absolute';
      b.append(emp, lit, x);
      this.heatEl.appendChild(b);
      this.badges.push({ el: b, state: 'off', t: 0 });
    }
    this.moneyEl = mk('nmoney');
    this.moneyEl.innerHTML = '<div class="d"></div><div class="v"></div>';
    this.savedEl = mk('nsaved');
    this.savedEl.textContent = 'saved';
    this.tabEl = mk('ntab');
    // the line's two layers: the heat's, the thing taken up (any lane's hud.objective)
    this.lines = { heat: null, taken: null };
    this.clearT = 0;
    const raw = hud.objective.bind(hud);
    this.rawObjective = raw;
    hud.objective = (text, opts) => {
      // (outside the city the kit is as it was: the old test beds' lines)
      if (!night.inCity) { raw(text, opts); return; }
      this.lines.taken = text == null || text === '' ? null : String(text);
      this.lines.opts = opts;
      this.applyLine();
    };
    this.heat = 0; this.searching = false;
    this.money = { shown: null, target: null, t: 9, from: 0, up: 0, d: 0 };
    this.savedT = 0;
    this.tabHeld = false;
    G.on('money', (e) => this.onMoney(e));
    G.on('scene:enter', () => { this.lines.taken = null; this.lines.heat = null; this.clearT = 0; });
  }

  // the line shown: the heat's over the taken-up thing's
  applyLine() {
    const want = this.lines.heat || this.lines.taken;
    const K = this.hud.kit;
    if (want !== K.objectiveText) this.rawObjective(want, this.lines.heat ? {} : (this.lines.opts || {}));
  }

  // (the save's autosave) a tick, a word, gone
  saved() { this.savedT = 1.8; this.savedEl.classList.add('up'); }

  onMoney(e) {
    // (the save's setter tells every change with was and d; O4's wallet and
    // O1b's items say it again with a why: the one telling is enough)
    if (!e || e.was === undefined) return;
    const M = this.money;
    if (M.shown == null) M.shown = e.was;
    M.from = M.shown; M.target = e.money; M.t = 0;
    M.d = (M.up > 0 ? M.d : 0) + e.d;
    M.up = 3.6;
    const sign = M.d >= 0 ? '+' : '−';
    this.moneyEl.querySelector('.d').textContent = M.d ? `${sign} $${Math.abs(M.d)}` : '';
    this.moneyEl.classList.add('up');
    if (e.d > 0 && this.G.sfx) this.G.sfx.play('n_cash', null, {}, { send: false });
    // (Tab is taught the first time money comes, in a quiet second)
    this.night.teachTab();
  }

  // one fixed step (the heat, the line) - game time
  step(dt) {
    const G = this.G, P = G.police;
    const h = P ? P.heat | 0 : 0, s = !!(P && P.searching && h > 0);
    if (h !== this.heat || s !== this.searching) this.setHeat(h, s);
    if (this.clearT > 0) { this.clearT -= dt; if (this.clearT <= 0 && this.lines.heat === HEAT_LINES.clear) { this.lines.heat = null; this.applyLine(); } }
  }

  setHeat(h, s) {
    const was = this.heat;
    this.heat = h; this.searching = s;
    const B = this.badges;
    for (let i = 0; i < 5; i++) {
      const b = B[i], lit = i < h;
      if (lit && b.state !== 'on') { b.state = 'on'; b.el.classList.remove('struck', 'gone'); void b.el.offsetWidth; b.el.classList.add('on'); }
      else if (!lit && b.state === 'on') { b.state = 'struck'; b.t = 0; b.el.classList.add('struck'); }
    }
    this.heatEl.classList.toggle('srch', s);
    if (h > was) { if (this.G.sfx) this.G.sfx.play('n_badge', null, { k: h / 5 }, { send: false }); }
    if (h < was && this.G.sfx) this.G.sfx.play('kit_strike', null, {}, { send: false });
    // the line: the player's situation
    if (h > 0) this.lines.heat = s ? HEAT_LINES.search : HEAT_LINES.up;
    else if (was > 0) { this.lines.heat = HEAT_LINES.clear; this.clearT = 2.6; this.night.teachTab(); }
    this.applyLine();
  }

  // per rendered frame (real time): the animations, Tab
  frame(dt) {
    const G = this.G;
    const tab = this.night.inCity && G.state === 'playing' && G.held('Tab');
    if (tab !== this.tabHeld) { this.tabHeld = tab; this.heatEl.classList.toggle('tab', tab); this.tabEl.classList.toggle('up', tab); if (tab) this.night.taughtTab = true; }
    if (tab) this.tabEl.innerHTML = this.tabLines().join('<br>');
    // the struck badges: the stroke, a breath, then gone
    let struck = false;
    for (const b of this.badges) {
      if (b.state !== 'struck') continue;
      b.t += dt;
      struck = true;
      if (b.t > 0.75 && !b.el.classList.contains('gone')) b.el.classList.add('gone');
      if (b.t > 1.3) { b.state = 'off'; b.el.classList.remove('on', 'struck', 'gone'); }
    }
    this.heatEl.classList.toggle('up', this.heat > 0 || struck || tab);
    // the money: it comes, the sum counts to it, it goes
    const M = this.money;
    if (tab && !(M.up > 0) && M.shown !== G.save.money) { M.shown = M.from = M.target = G.save.money; M.t = 9; this.drawMoney(M.shown); this.moneyEl.querySelector('.d').textContent = ''; }
    if (M.target != null && M.t < 0.6) {
      M.t += dt;
      const u = Math.min(1, M.t / 0.6), e = u * u * (3 - 2 * u);
      M.shown = Math.round(M.from + (M.target - M.from) * e);
      this.drawMoney(M.shown);
    }
    if (M.up > 0) { M.up -= dt; if (M.up <= 0) { M.d = 0; this.moneyEl.querySelector('.d').textContent = ''; } }
    const mUp = M.up > 0 || tab;
    if (mUp !== this.moneyEl.classList.contains('up')) this.moneyEl.classList.toggle('up', mUp);
    if (this.savedT > 0) { this.savedT -= dt; if (this.savedT <= 0) this.savedEl.classList.remove('up'); }
  }

  drawMoney(v) { this.moneyEl.querySelector('.v').innerHTML = `<small>$</small>${v.toLocaleString('en-US')}`; }

  // Tab's lines: the car's state, the hour (the heat and the money have their own places)
  tabLines() {
    const G = this.G, N = this.night, R = G.city, out = [];
    const car = R && R.car;
    if (car) out.push(`${carName(car)} · ${carState(car)}${R.inCar ? '' : ' · ' + Math.round(Math.hypot(car.pos.x - G.eye.x, car.pos.z - G.eye.z)) + ' m'}`);
    out.push(N.clock.text());
    if (this.heat === 0) out.push('no heat');
    else if (this.searching) out.push('they are looking');
    // what I carry beside the money (O1b's pockets: the rounds, the bottles, the matchbooks)
    for (const [k, v] of pockets(G)) if (k !== '$') out.push(`${k} ${v}`);
    return out;
  }
}

export function carName(car) { return ({ coupe: 'the coupe', sedan: 'the saloon', truck: 'the lorry', taxi: 'the taxi', van: 'the van', police: 'the police car', hearse: 'the hearse' })[car.kind] || 'the car'; }
export function carState(car) {
  const d = car.damage || 0;
  return car.wrecked || d >= 4 ? 'wrecked' : d >= 3 ? 'smoking' : d >= 2 ? 'dented' : d >= 0.6 ? 'scratched' : 'sound';
}
