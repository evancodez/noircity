// Saves (docs/story/CONTRACTS.md §12.4; wave C: docs/story/seams/Z.md §7;
// [O7] NOIR CITY's open world: docs/seams/NIGHT.md §3).
//   save.write(opts)  the open world's save, v3 -> localStorage['noir.save']:
//       { v: 3, scene: 'city', beat, at (ms), flags, inventory, money, heat,
//         matchbooks, garage, found, bounty, city: { pos: { x, z, yaw },
//         car: { kind, x, z, yaw, damage } | null, inCar, hour } }
//     written by the night (src/night/save.js): the hotel's bed (O5 calls
//     save.write()), and the quiet autosave as I get into a car at heat 0.
//     The scene manager's own writes (a scene or a beat entered: opts.scene)
//     are not saves any more: an open world is saved where the player
//     rests, not where a script begins; and an old chapter (?start=diner,
//     a test bed) is never written, so CONTINUE never leads into one.
//   save.read()    the save or null     save.exists     save.clear()
//   save.flags     plain flags (flags.taught = { id: true }: the teach cards
//                  already shown, hud.teach)
//   save.inventory: [kind]
//   save.money     $ (one number; lanes add and spend it: game 'money' event)
//   save.heat      (O3's police.heat mirrors into it)
//   save.matchbooks [id] (O5: one per bar), save.garage [car record] (O2),
//   save.found     { placeId: true } (the hotel, the garage... marked once seen)
// ?scene= never reads or writes it (enabled: false in shot mode).
// A save of another version (v2: the old story's chapters) is dropped
// quietly: the title offers BEGIN alone.
const KEY = 'noir.save';
export const SAVE_VERSION = 3;

export class Save {
  constructor(game, { enabled = true } = {}) {
    this.game = game;
    this.enabled = enabled;
    this.flags = {};
    this.inventory = [];
    this.fresh();
  }

  // [O7] the open world's own state: a new night's
  fresh() {
    this._money = 0;
    this.heat = 0;
    this.matchbooks = [];
    this.garage = [];
    this.found = {};
    this.bounty = null;
  }

  // [O7] $: setting it tells the HUD (game 'money' { money, was, d })
  get money() { return this._money; }
  set money(v) {
    const was = this._money;
    const m = Math.max(0, Math.round(Number(v) || 0));
    this._money = m;
    if (m !== was && this.game && this.game.emit) this.game.emit('money', { money: m, was, d: m - was });
  }

  // opts.scene: the scene manager's write (a scene / beat entered): not a save
  // in the open world. opts.city: the place record (src/night/save.js builds
  // it; without it, the night is asked for one)
  write(opts = {}) {
    if (!this.enabled) return null;
    if (opts.scene) return null;
    const G = this.game, S = G.scenes;
    const scene = S && S.current ? S.current.id : null;
    if (scene !== 'city') return null;
    const city = opts.city || (G.night && G.night.snapshot ? G.night.snapshot() : null);
    if (!city) return null;
    const data = {
      v: SAVE_VERSION, scene, beat: 'roam', at: Date.now(), flags: plain(this.flags), inventory: [...this.inventory],
      money: this.money, heat: this.heat | 0, matchbooks: [...this.matchbooks], garage: this.garage.map((c) => ({ ...c })),
      found: { ...this.found }, bounty: this.bounty ? JSON.parse(JSON.stringify(this.bounty)) : null, city,
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { return null; }
    this.lastWrite = data;
    if (G.emit) G.emit('save:write', { reason: opts.reason || 'save', data });
    return data;
  }

  read() {
    if (!this.enabled) return null;
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && d.v === SAVE_VERSION && d.scene === 'city' && d.city) return d;
      // (an older save: the old story's chapters are not this game's; gone, quietly)
      if (d) localStorage.removeItem(KEY);
      return null;
    } catch (e) { return null; }
  }

  // [O7] a save's own state taken up (CONTINUE): the money, the heat, the
  // collections; flags and inventory are the Game's (start)
  load(d) {
    this.fresh();
    if (!d) return;
    this._money = Math.max(0, d.money | 0);
    this.heat = d.heat | 0;
    this.matchbooks = Array.isArray(d.matchbooks) ? [...d.matchbooks] : [];
    this.garage = Array.isArray(d.garage) ? d.garage.map((c) => ({ ...c })) : [];
    this.found = d.found && typeof d.found === 'object' ? { ...d.found } : {};
    this.bounty = d.bounty || null;
  }

  get exists() { return !!this.read(); }

  clear() {
    this.flags = {};
    this.inventory = [];
    this.fresh();
    if (!this.enabled) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
  }
}

// (the flags as JSON keeps them: one level of plain objects, e.g. taught)
function plain(f) {
  const o = {};
  for (const [k, v] of Object.entries(f || {})) {
    if (v == null || typeof v !== 'object') o[k] = v;
    else if (!Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) o[k] = { ...v };
    else if (Array.isArray(v)) o[k] = [...v];
  }
  return o;
}
