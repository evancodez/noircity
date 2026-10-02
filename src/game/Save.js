// Saves (docs/story/CONTRACTS.md §12.4; wave C: docs/story/seams/Z.md §7): a
// checkpoint is written when a scene or a beat marked save: true is entered.
//   save.write()   { v: 2, scene, beat, flags, inventory } -> localStorage['noir.save']
//   save.read()    the save or null     save.exists     save.clear()
//   save.flags     story flags (a plain object; flags.taught = { id: true }:
//                  the teach cards already shown, hud.teach)
//   save.inventory: [kind]
// ?scene= never reads or writes it (enabled: false in shot mode).
// [C1] v2 (wave C's order: The Body cut, the chapters renumbered). A v1 save
// is dropped quietly: the title offers BEGIN and CHAPTERS only.
const KEY = 'noir.save';
export const SAVE_VERSION = 2;

export class Save {
  constructor(game, { enabled = true } = {}) {
    this.game = game;
    this.enabled = enabled;
    this.flags = {};
    this.inventory = [];
  }

  write() {
    if (!this.enabled) return null;
    const S = this.game.scenes;
    const data = { v: SAVE_VERSION, scene: S && S.current ? S.current.id : null, beat: S ? S.beat : null, flags: plain(this.flags), inventory: [...this.inventory] };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { return null; }
    return data;
  }

  read() {
    if (!this.enabled) return null;
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && d.v === SAVE_VERSION) return d;
      // (an older save: its chapters are not this game's any more; gone, quietly)
      if (d) localStorage.removeItem(KEY);
      return null;
    } catch (e) { return null; }
  }

  // [R3] (a story played to THE END is not continued: the title offers
  // BEGIN and the chapters again, not the last ten seconds of the ending)
  get exists() { const d = this.read(); return !!d && !(d.flags && d.flags.ended); }

  clear() {
    this.flags = {};
    this.inventory = [];
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
