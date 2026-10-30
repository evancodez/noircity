import { LETTER_FONT } from '../ui/lettering.js';
import { drawShield } from './hud.js';
import { RNG } from '../util/rng.js';
import { blob, frayEdges } from '../ui/inkArt.js';
import { PLACES } from '../world/plan.js';
import { input } from '../input/Pad.js';

// The map and the pause card (lane O7, docs/seams/NIGHT.md §2).
// M (the pad's d-pad down) opens O1's inked city map on the pause card: the
// frame dims, the game is held (main.js: night.holding), the map north up
// with the districts lettered, my mark, my car, the heat's shields, the
// hotel and the garage once found, the thing I took up as a ring - nothing
// else; M again or ESC closes it (ESC goes on to the pause card proper).
// The pause card (ESC, the pointer lock lost): PAUSED, the same map at its
// side, the keys, the settings line (mouse, volume, sound, subtitles: the
// old M for sound lives here now), the matchbooks collected (a row of little
// covers taken - [O7] after the critic: no count, no empty boxes), `click to resume`.
// city.js's own M (O1's MapOverlay) is handed this map instead (night.mapFor:
// { isOpen, toggle, close, draw }): its toggle opens and closes this one.
const PAPER = '#d4cfc4';

export class NightMap {
  constructor(night) {
    this.night = night;
    this.open = false;
    const G = night.game, hud = G.hud;
    this.G = G; this.hud = hud;
    const st = document.createElement('style');
    st.textContent = `
      #pausecard.ncity { flex-direction: row; gap: 4.5vw; }
      #pausecard .nmapp { position: relative; display: none; width: min(64vh, 42vw); height: min(64vh, 42vw); box-shadow: 0 0 40px #000; flex: none; }
      #pausecard.ncity .nmapp { display: block; }
      #pausecard .nmapp canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      #pausecard .ncol { display: flex; flex-direction: column; align-items: center; justify-content: center; }
      #pausecard.ncity .ncol { max-width: 44vw; }
      #pausecard.ncity .ncol .keys { font-size: 10px; letter-spacing: 0.16em; }
      #pausecard.ncity .ncol .set { flex-wrap: wrap; justify-content: center; gap: 10px 26px; }
      #pausecard.mview { cursor: none; background: rgba(4,4,4,0.72); }
      #pausecard.mview .nmapp { width: min(86vh, 76vw); height: min(86vh, 76vw); }
      #pausecard.mview .ncol { display: none; }
      #pausecard .nmhint { display: none; position: absolute; left: 50%; bottom: 2.4vh; transform: translateX(-50%); font-size: 12px; letter-spacing: 0.4em; color: #cfccc5; text-transform: uppercase; text-shadow: 0 0 4px #000; }
      #pausecard.mview .nmhint { display: block; }
      #pausecard .nmatch { position: relative; margin: 22px 0 0; display: flex; align-items: flex-end; gap: 10px; font-size: 11px; letter-spacing: 0.3em; color: #bdbbb5; text-transform: uppercase; text-shadow: 0 0 4px #000; }
      #pausecard .nmatch canvas { display: block; }
      #pausecard .nmatch .lab { margin-right: 6px; align-self: center; }
    `;
    document.head.appendChild(st);
    // the pause card made the city's: the map at its side, its own lines in a column
    const P = hud.pauseCard.el;
    this.card = P;
    this.panel = document.createElement('div');
    this.panel.className = 'nmapp';
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = 1024;
    this.marks = document.createElement('canvas');
    this.marks.width = this.marks.height = 1024;
    this.panel.append(this.base, this.marks);
    this.col = document.createElement('div');
    this.col.className = 'ncol';
    for (const ch of [...P.children]) this.col.appendChild(ch);
    this.matchEl = document.createElement('div');
    this.matchEl.className = 'nmatch';
    this.col.appendChild(this.matchEl);
    this.hint = document.createElement('div');
    this.hint.className = 'nmhint';
    this.hint.textContent = 'M  close';
    P.append(this.panel, this.col, this.hint);
    this.lastPaused = false;
  }

  // the city's card (only once the city is the game: the old beds keep theirs)
  cityCard(on) { this.card.classList.toggle('ncity', on); }

  ensureBase() {
    if (this.baseDrawn) return true;
    const M = this.night.cityMap();
    if (!M) return false;
    this.base.getContext('2d').drawImage(M.canvas, 0, 0, 1024, 1024);
    this.baseDrawn = true;
    return true;
  }

  // ---- M ------------------------------------------------------------------------------
  // (city.js: R.map.toggle() on M; true when it opened)
  toggle() { if (this.open) this.close(); else this.openView(); return this.open; }
  openView() {
    if (this.open || !this.ensureBase()) return;
    const G = this.G;
    this.open = true;
    this.night.holding = true;
    this.lookWas = G.controller.lookLocked;
    G.controller.lookLocked = true;
    this.cityCard(true);
    this.card.classList.add('mview');
    this.card.classList.remove('hidden');
    this.hud.root.classList.add('nmapopen', 'titled');
    if (G.sfx) G.sfx.play('n_paper', null, {}, { send: false });
    this.drawMarks();
  }
  close() {
    if (!this.open) return;
    const G = this.G;
    this.open = false;
    this.night.holding = false;
    G.controller.lookLocked = !!this.lookWas;
    // (city.js froze me and braked the car when it opened: the controls back)
    G.controller.frozen = false;
    // (keys pressed while it was up are not acts in the street)
    G.keysDown.clear();
    const car = G.city && G.city.car;
    if (car && G.city.inCar) { car.input.brake = 0; }
    this.card.classList.remove('mview');
    if (!this.hud.paused) this.card.classList.add('hidden');
    this.hud.root.classList.remove('nmapopen');
    this.hud.retitle();
    if (G.sfx) G.sfx.play('n_paper', null, { k: 0.6 }, { send: false });
  }
  get isOpen() { return this.open; }
  // (city.js draws its marks each step while open: ours are drawn here)
  draw() { }

  // per rendered frame: M again closes (read from the game's own input edges:
  // the sim is held, no step will), the breathing mark, the pause card's map
  frame() {
    const G = this.G, H = this.hud;
    if (this.open) {
      // ([O7] after the critic, m1: the pad's circle - 'back' on a PS5 pad, the crouch's C in play - closes it too)
      if (G.keysDown.has('KeyM') || (G.keysDown.has('KeyC') && input.last === 'pad')) { G.keysDown.delete('KeyM'); G.keysDown.delete('KeyC'); this.close(); return; }
      // (ESC: the browser let the mouse go - the pause card proper, the map on it)
      if (H.paused) { this.open = false; this.night.holding = false; G.controller.lookLocked = !!this.lookWas; G.controller.frozen = false; this.card.classList.remove('mview'); H.root.classList.remove('nmapopen'); H.retitle(); }
      else { this.drawMarks(); return; }
    }
    const paused = H.paused && this.night.inCity;
    if (paused !== this.lastPaused) {
      this.lastPaused = paused;
      this.cityCard(paused || this.night.inCity);
      if (paused) { this.ensureBase(); this.drawMatchbooks(); }
    }
    if (paused) this.drawMarks();
  }

  drawMarks() {
    const N = this.night, G = this.G, M = N.cityMap();
    if (!M) return;
    const g = this.marks.getContext('2d');
    const sc = 1024 / M.canvas.width;
    const at = (x, z) => { const [u, v] = M.toMap(x, z); return [u * sc, v * sc]; };
    g.clearRect(0, 0, 1024, 1024);
    // the places found (the hotel, the garage...): a square and the name
    for (const P of PLACES) {
      if (!G.save.found[P.id] || !['hotel', 'garage', 'station', 'gym', 'gunshop', 'diner', 'bar1', 'bar2'].includes(P.id)) continue;
      const [u, v] = at(P.at[0], P.at[1]);
      g.fillStyle = '#050505'; g.strokeStyle = PAPER; g.lineWidth = 3;
      g.beginPath(); g.rect(u - 7, v - 7, 14, 14); g.stroke(); g.fill();
      label(g, placeWord(P), u + 12, v);
    }
    // [O5b] the hospital (a place of src/places/sites.js, not of O1's plan): found as the others are
    { const hs = G.city && G.city.places && G.city.places.byId.get('hospital');
      if (hs && G.save.found.hospital) { const [u, v] = at(hs.door.x, hs.door.z); g.fillStyle = '#050505'; g.strokeStyle = PAPER; g.lineWidth = 3; g.beginPath(); g.rect(u - 7, v - 7, 14, 14); g.stroke(); g.fill(); label(g, 'HOSPITAL', u + 12, v); } }
    // the thing taken up
    const T = N.target;
    if (T) { const [u, v] = at(T.x, T.z); g.lineWidth = 8; g.strokeStyle = '#050505'; g.beginPath(); g.arc(u, v, 16, 0, Math.PI * 2); g.stroke(); g.lineWidth = 4; g.strokeStyle = '#f2efe8'; g.stroke(); }
    // my car (when I am out of it)
    const R = G.city;
    const me = at(G.eye.x, G.eye.z);
    if (R && R.car && !R.inCar && R.car.solid !== false) {
      const [u, v] = at(R.car.pos.x, R.car.pos.z);
      g.save(); g.translate(u, v); g.rotate(Math.PI / 2 - R.car.yaw);
      g.fillStyle = PAPER; g.strokeStyle = '#000'; g.lineWidth = 2.5; g.beginPath(); g.rect(-5, -9, 10, 18); g.fill(); g.stroke();
      g.restore();
      if (Math.hypot(u - me[0], v - me[1]) > 70) label(g, 'CAR', u + 12, v);
    }
    // the cops near me
    for (const m of N.marks()) if (m.kind === 'cop') { const [u, v] = at(m.x, m.z); g.fillStyle = PAPER; g.beginPath(); g.arc(u, v, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#050505'; g.beginPath(); g.arc(u, v, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = PAPER; g.beginPath(); g.arc(u, v, 3, 0, Math.PI * 2); g.fill(); }
    // me: the breathing ring round a big ink arrowhead (O1's mark, kept)
    const yaw = R && R.inCar && R.car ? R.car.yaw - Math.PI / 2 : G.controller.yaw;
    const t = performance.now() / 1000;
    const pr = 34 + 8 * (0.5 + 0.5 * Math.sin(t * 4));
    g.save(); g.translate(me[0], me[1]);
    g.lineWidth = 7; g.strokeStyle = 'rgba(212,207,196,0.9)'; g.beginPath(); g.arc(0, 0, pr, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3.5; g.strokeStyle = '#000'; g.beginPath(); g.arc(0, 0, pr, 0, Math.PI * 2); g.stroke();
    g.rotate(-yaw);
    g.fillStyle = '#000'; g.strokeStyle = '#f4f1ea'; g.lineWidth = 5; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, -30); g.lineTo(18, 20); g.lineTo(0, 10); g.lineTo(-18, 20); g.closePath(); g.stroke(); g.fill();
    g.restore();
    // the heat: its shields in the map's top left corner, when there is any
    const h = G.police ? G.police.heat | 0 : 0;
    if (h > 0) {
      if (!this.shield) this.shield = drawShield(40, 4242);
      g.fillStyle = 'rgba(5,5,5,0.85)'; g.fillRect(40, 40, 24 + h * 46, 70);
      for (let i = 0; i < h; i++) g.drawImage(this.shield, 52 + i * 46, 46, 40, 46);
    }
  }

  // the matchbooks: one little cover per bar (O5's save.matchbooks), the
  // ones not found yet a dotted outline; the name lettered on the found
  drawMatchbooks() {
    const G = this.G, N = this.night;
    // [O7] the six matchbooks are O1b's (world/dressing.js: one on every bar's
    // step, taken with E into save.flags.matchbooks { place: name }); O5's
    // save.matchbooks (ids) join them when its bars give their own
    const C = G.stage && G.stage.part && G.stage.part('city') ? G.stage.part('city').C : null;
    const spots = ((C && C.itemSpots) || []).filter((s) => s.kind === 'matchbook');
    const names = new Map();
    for (const s of spots) if (!names.has(s.place)) names.set(s.place, s.name);
    if (!names.size) for (const id of N.barIds()) names.set(id, null);
    const F = (G.save.flags && G.save.flags.matchbooks) || {};
    const have = new Set([...Object.keys(F), ...(G.save.matchbooks || [])]);
    for (const h of have) if (!names.has(h)) names.set(h, F[h] || null);
    this.matchEl.textContent = '';
    // [O7] after the critic (m2: 'MATCHBOOKS 0 / 6' and six dotted boxes read as a to-do list): only the
    // covers taken, no count, no empty boxes - nothing at all until the first one is in the coat
    const got = [...names.keys()].filter((id) => have.has(id));
    if (!got.length) return;
    const lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = 'matchbooks';
    this.matchEl.appendChild(lab);
    for (const id of got) this.matchEl.appendChild(matchbook(id, true, F[id] || names.get(id)));
  }
}

function label(g, t, x, y) {
  g.font = `700 17px ${LETTER_FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.lineWidth = 4; g.strokeStyle = PAPER; g.strokeText(t, x, y); g.fillStyle = '#000'; g.fillText(t, x, y);
}
function placeWord(P) { return ({ hotel: 'HOTEL', garage: 'GARAGE', station: 'POLICE', gym: 'GYM', gunshop: 'GUNS', diner: 'DINER', bar1: 'BAR', bar2: 'BAR' })[P.id] || P.name; }

// a matchbook cover: paper, its striker an ink band, the bar's name; or a dotted outline
function matchbook(id, got, name = null) {
  const c = document.createElement('canvas');
  const w = 30, h = 44;
  c.width = w * 2; c.height = h * 2;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.scale(2, 2);
  if (!got) {
    g.setLineDash([3, 3]); g.strokeStyle = 'rgba(220,217,210,0.45)'; g.lineWidth = 1.2; g.strokeRect(2, 2, w - 4, h - 4);
    return c;
  }
  const rng = new RNG([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0);
  g.fillStyle = '#e9e5dc'; g.fillRect(2, 2, w - 4, h - 4);
  g.fillStyle = '#060606'; g.fillRect(2, h - 11, w - 4, 7);
  // (the crew's red is the old game's: these covers are ink; a bar's mark, a star or a glass)
  g.fillStyle = '#060606';
  blob(g, w / 2, h * 0.36, 6 + rng.next() * 2, rng, 0.25);
  g.font = `700 7px ${LETTER_FONT}`; g.textAlign = 'center'; g.fillStyle = '#e9e5dc';
  const word = name ? String(name).replace(/^THE\s+/i, '').split(/\s+/)[0].toUpperCase().slice(0, 7) : id.startsWith('bar') ? 'BAR' : id.toUpperCase().slice(0, 6);
  g.font = `700 ${word.length > 5 ? 6 : 7}px ${LETTER_FONT}`;
  g.fillText(word, w / 2, h * 0.38);
  frayEdges(c, [233, 229, 220], new RNG(5), 20);
  return c;
}
