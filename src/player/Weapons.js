// The weapons (docs/story/CONTRACTS.md §7.3): game.player.weapons.
//   weapons.equip('tommy' | 'revolver' | 'fists' | <a weapon's name> | null)
//   weapons.current (its name)   weapons.active (its impl, or null)
//   weapons.fire()   weapons.reload()   weapons.register(impl)   weapons.get(name)
// The Tommy gun is player/Weapon.js, as it always was (fixes 2 and 3 are
// lane 2's): wrapped here, not moved. Fists are the brawl's (lane 7's rules,
// lane 2's hands): a hands' set, not a weapon.
//
// A weapon (wave B seams, docs/story/seams/X.md) is a file
// src/player/weapons/<name>.js default-exporting
//   (game) => ({ name, set, equip(), unequip(), trigger(down, pressed),
//                fire() -> bool, reload() -> bool, update(dt, t), ammo, mag })
// (set: the hands' set it puts up). equip(name) swaps them (the old one's
// unequip, the hands' set, the new one's equip); every step the Game hands
// the one in hand the left button (held, pressed this step; nothing while
// the game is not live or an inspection / a puzzle has the mouse), R
// pressed this step to its reload, and calls its update.
import { WEAPON } from './Weapon.js';
const SET = { tommy: 'tommy', revolver: 'revolver', fists: 'fists' };
const FILES = import.meta.glob('./weapons/*.js', { eager: true });

// the Tommy gun as a weapon: player/Weapon.js untouched (its trigger is the
// input events' and the autopilot's, game.weapon.trigger, as it always was;
// it fires only while it is the set in hand)
const tommy = (game) => ({
  name: 'tommy', set: 'tommy',
  equip() {}, unequip() {},
  trigger() {},
  fire() {
    const W = game.weapon;
    if (W.reloading || W.ammo <= 0) return false;
    W.fire(game.time);
    return true;
  },
  reload() { return game.weapon.reload(); },
  update(dt, t) {
    if (game.live && game.hands.set === 'tommy') game.weapon.update(dt, t);
    else game.weapon.trigger = false;
  },
  get ammo() { return game.weapon.ammo; },
  mag: WEAPON.drum,
});

export class Weapons {
  constructor(game) {
    this.game = game;
    this.current = 'tommy';
    this.impls = {};
    this.register(tommy(game));
    for (const [file, m] of Object.entries(FILES)) {
      if (typeof m.default !== 'function') continue;
      this.register(m.default(game), file);
    }
  }
  register(impl, from = '') {
    if (!impl || !impl.name) throw new Error(`weapons.register: a weapon needs a name ${from}`);
    if (this.impls[impl.name]) throw new Error(`weapons: '${impl.name}' defined twice ${from}`);
    this.impls[impl.name] = impl;
    return impl;
  }
  get(name) { return this.impls[name] || null; }
  get names() { return Object.keys(this.impls); }
  get tommy() { return this.game.weapon; }
  get active() { return this.impls[this.current] || null; }
  equip(name) {
    const prev = this.active, next = name ? this.impls[name] || null : null;
    if (prev && prev !== next) prev.unequip();
    this.current = name;
    this.game.player.hands.equip(name ? (next ? next.set : SET[name]) || 'empty' : 'empty');
    if (next && next !== prev) next.equip();
    return this;
  }
  fire() { const w = this.active; return w ? w.fire() : false; }
  reload() { const w = this.active; return w ? w.reload() : false; }

  // one step (Game.pre): the weapon in hand gets the mouse and R, then its
  // update; the Tommy gun steps every time, as it always did
  step(dt, t) {
    const G = this.game, w = this.active, T = this.impls.tommy;
    if (w && w !== T) {
      const can = G.live && !G.inspect.active && !G.puzzles.active;
      w.trigger(can && G.held('Mouse0'), can && G.pressed('Mouse0'));
      if (can && G.pressed('KeyR')) w.reload();
      w.update(dt, t);
    }
    T.update(dt, t);
  }
}
