import { installStandins, stepStandins } from './standins.js';
import { installThings } from './things.js';
import { NightHud } from './hud.js';
import { Minimap } from './minimap.js';
import { NightMap } from './map.js';
import { NightSave } from './save.js';
import { Radio } from './radio.js';
import { Ambience } from './ambience.js';
import { ElRide } from './el.js';
import { PhoneBox } from './phone.js';
import { Bounty } from './bounty.js';
import { Title } from './title.js';
import { drawMap } from '../world/map.js';
import { PLACES } from '../world/plan.js';

// The night (lane O7, docs/seams/NIGHT.md): what ties NOIR CITY's systems
// into one game - the HUD (heat, money, Tab, the line), the minimap, the map
// and the pause card, the saves, the radio and the city's sound, the title,
// the things to do that are nobody else's (the el, the phone box, the bounty
// board). game.night; main.js makes it and calls night.frame(dt) once a
// rendered frame (before the steps); the steps come through game.scripts.
// While a card of the night is up (the map, the bounty board) the game is
// held: night.holding (main.js stops the steps; the frame still draws).
//   night.take(id, text | null)   the line of a thing taken up (a fare, a bout,
//                                 the phone's car): under the heat's line
//   night.target = { x, z }       the thing taken up on the minimap and the map
//   night.addMarks(fn)            fn() -> [{ x, z, kind: 'cop' | 'place' | 'target' }]
//   night.clock                   the hour: { min, text(), add(min), set(min) }
export const CLOCK = { start: 23 * 60, secsPerMin: 2.5, span: 6 * 60 };
// [O7] true of the city as built (the cold play's finding 2): a verb comes
// onto the line when its lane brings it into the city (the fist fight's jab,
// block and dodge with O3's men)
const KEYS_CITY = 'WASD move · mouse look · E use, get in, take · WHEEL the revolver · LMB fire · RMB steady · R reload · C get low\n'
  + 'SHIFT run · SPACE handbrake · Q horn · F the radio · TAB heat, money · M map · ESC pause';

export class Night {
  constructor({ game, params = null }) {
    this.game = game;
    game.night = this;
    const q = params || new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    this.bed = q.get('nightbed') === '1';
    this.holding = false;
    this._target = null;
    this.extraMarks = [];
    this.taken = new Map();
    this.standins = installStandins(this);
    this.things = installThings(this);   // game.things, game.money (docs/THINGS_TO_DO.md's seams)
    this.clock = makeClock(this);
    this.hud = new NightHud(this);
    this.mini = new Minimap(this);
    this.map = new NightMap(this);
    this.saver = new NightSave(this);
    this.radio = new Radio(this);
    this.amb = new Ambience(this);
    this.el = new ElRide(this);
    this.phone = new PhoneBox(this);
    this.bounty = new Bounty(this);
    this.title = new Title(this);
    this.taughtTab = false;
    this.foundT = 0;
    game.scripts.push((t, dt) => this.step(dt));
    game.on('scene:enter', (e) => this.enter(e && e.id));
    game.on('scene:exit', () => { this.target = null; this.taken.clear(); if (this.map.open) this.map.close(); });
  }

  // the city is the game being played
  get inCity() { const S = this.game.scenes; return !!(S.current && S.current.id === 'city') && this.game.state === 'playing'; }
  C() { const st = this.game.stage; const p = st && st.part && st.part('city'); return p ? p.C : null; }
  graph() { const st = this.game.stage; const p = st && st.part && st.part('city'); return p ? p.graph : null; }
  // the inked map, drawn once at 2048 (the minimap reads it close, the pause card's scaled)
  cityMap() {
    if (this._map) return this._map;
    const C = this.C();
    if (!C) return null;
    this._map = drawMap(C, 2048);
    return this._map;
  }
  barIds() { return PLACES.filter((p) => p.kind === 'bar').map((p) => p.id); }

  enter(id) {
    const G = this.game, city = id === 'city';
    G.hud.root.classList.toggle('nnocity', !city);
    this.map.cityCard(city);
    if (!city) return;
    // city.js's M opens this map (its MapOverlay is O1's stand-in for it)
    if (G.city) G.city.map = this.map;
    this.cityMap();
    this.map.ensureBase();
    this.target = null;
    // the rulebook's line for the open world, on the title and the pause card
    this.keysLine();
  }
  keysLine() {
    const H = this.game.hud;
    H.keysText = KEYS_CITY;
    H.soundKey = 'sound off · on again in the pause card';
    if (H.soundLine && /M sound/.test(H.soundLine.textContent)) H.soundLine.textContent = H.soundKey;
    for (const el of [H.titleKeys, H.pauseCard && H.pauseCard.keys]) if (el && !el.querySelector('canvas')) el.textContent = KEYS_CITY;
  }

  // (city.js's roam setup: the save's place, once)
  takeResume() { return this.saver.take(); }
  snapshot() { return this.saver.snapshot(); }

  // a thing taken up: its line under the heat's (null: done)
  take(id, text) {
    if (text == null) this.taken.delete(id); else this.taken.set(id, text);
    const last = [...this.taken.values()].pop() || null;
    this.hud.lines.taken = last;
    this.hud.applyLine();
  }

  // the thing taken up's mark: one set by hand, else the last thing taken up
  // with a place (game.things.start(id, { at }))
  get target() {
    if (this._target) return this._target;
    let t = null;
    if (this.things) for (const o of this.things.active.values()) { const p = typeof o.at === 'function' ? o.at() : o.at; if (p && Number.isFinite(p.x)) t = p; }
    return t;
  }
  set target(v) { this._target = v; }

  addMarks(fn) { this.extraMarks.push(fn); return fn; }
  marks() {
    const G = this.game, out = [], R = G.city;
    if (R && R.car && !R.inCar && R.car.solid !== false) out.push({ kind: 'car', x: R.car.pos.x, z: R.car.pos.z, yaw: Math.PI / 2 - R.car.yaw });
    const P = G.police;
    const U = P ? (typeof P.marks === 'function' ? P.marks() : P.units) : null;
    if (U) for (const u of U) { const p = u.pos || u; if (p && p.x != null) out.push({ kind: 'cop', x: p.x, z: p.z }); }
    for (const f of this.extraMarks) { try { const m = f(); if (m) out.push(...m); } catch (e) { /* a lane's marks */ } }
    if (this.target) out.push({ kind: 'target', x: this.target.x, z: this.target.z });
    return out;
  }

  // Tab, taught once a save, in a quiet second (money came, or the heat is gone)
  teachTab() {
    const G = this.game;
    if (this.taughtTab || !this.inCity || G.hud.warnText || (G.police && G.police.heat > 0 && !G.police.searching && this.hud.lines.heat !== 'Clear.')) return;
    this.taughtTab = true;
    G.hud.teach('night_tab', '[TAB] heat and money', { until: 'Tab', secs: 3.4 });
  }

  // one fixed step (game.scripts: before the controller and the scene)
  step(dt) {
    const G = this.game;
    if (G.state === 'title' || G.shotMode) return;
    stepStandins(this, dt);
    this.clock.step(dt);
    this.hud.step(dt);
    if (!this.inCity) return;
    this.radio.step(dt);
    this.el.step(dt);
    this.phone.step(dt);
    this.bounty.step(dt);
    this.amb.step(dt);
    // places found (the hotel, the garage...): marked on the map once I have been by their door
    this.foundT -= dt;
    if (this.foundT <= 0) {
      this.foundT = 1;
      const P = G.stage.part('places'), e = G.eye;
      if (P && P.doors) for (const d of P.doors) if (!G.save.found[d.place] && Math.hypot(d.x - e.x, d.z - e.z) < 40) { G.save.found[d.place] = true; G.emit('place:found', { id: d.place }); }
      // the radio's card: once, after a while at the wheel, in a quiet second
      const R = G.city;
      if (R && R.inCar && !this.taughtRadio && !G.hud.warnText && !(G.police && G.police.heat > 0)) {
        this.carT = (this.carT || 0) + 1;
        if (this.carT > 30) { this.taughtRadio = true; G.hud.teach('night_radio', '[F] the radio', { until: 'KeyF', secs: 3.4 }); }
      }
    }
  }

  // per rendered frame, real time (main.js; before the steps)
  frame(dt) {
    this.map.frame(dt);
    this.bounty.frame(dt);
    this.hud.frame(dt);
    this.mini.frame(dt);
    this.radio.frame(dt);
  }
}

// the night's hour: from eleven, a minute every 2.5 s (an hour every two
// and a half minutes), round to eleven again after five: an endless night.
// 'night:hour' { hour } as each hour strikes (the Hill's bell tolls it)
function makeClock(night) {
  return {
    min: 0,
    set(m) { this.min = ((m % CLOCK.span) + CLOCK.span) % CLOCK.span; this.lastH = this.hour; },
    add(m) { this.set(this.min + m); },
    get hour() { return Math.floor((CLOCK.start + this.min) / 60) % 24; },
    step(dt) {
      this.min += dt / CLOCK.secsPerMin;
      if (this.min >= CLOCK.span) this.min -= CLOCK.span;
      const h = this.hour;
      if (this.lastH != null && h !== this.lastH) night.game.emit('night:hour', { hour: h });
      this.lastH = h;
    },
    text() {
      const t = CLOCK.start + Math.floor(this.min), h = Math.floor(t / 60) % 24, m = t % 60;
      const h12 = ((h + 11) % 12) + 1;
      return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
    },
  };
}
