// Saves (docs/story/CONTRACTS.md §12.4): a checkpoint is written when a
// scene or a beat marked save: true is entered.
//   save.write()   { v: 1, scene, beat, flags, inventory } -> localStorage['noir.save']
//   save.read()    the save or null     save.exists     save.clear()
//   save.flags     story flags (a plain object)          save.inventory: [kind]
// ?scene= never reads or writes it (enabled: false in shot mode).
// (FOUNDATION: working; lane 7 owns it: continue on the title card)
const KEY = 'noir.save';

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
    const data = { v: 1, scene: S && S.current ? S.current.id : null, beat: S ? S.beat : null, flags: { ...this.flags }, inventory: [...this.inventory] };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { return null; }
    return data;
  }

  read() {
    if (!this.enabled) return null;
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return d && d.v === 1 ? d : null;
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
