// The weapons (docs/story/CONTRACTS.md §7.3): game.player.weapons.
//   weapons.equip('tommy' | 'revolver' | 'fists' | null)   weapons.current
//   weapons.fire()   weapons.reload()
// The Tommy gun is player/Weapon.js, as it always was (fixes 2 and 3 are
// lane 2's). The revolver is wave B: equipping it puts the hands' set up and
// it fires nothing yet. Fists are the brawl's (lane 7's rules, lane 2's
// hands).
// (FOUNDATION: a thin front over Weapon.js and the hands; lane 2 owns it)
const SET = { tommy: 'tommy', revolver: 'revolver', fists: 'fists' };

export class Weapons {
  constructor(game) {
    this.game = game;
    this.current = 'tommy';
  }
  get tommy() { return this.game.weapon; }
  equip(name) {
    this.current = name;
    this.game.player.hands.equip(name ? SET[name] || 'empty' : 'empty');
    return this;
  }
  fire() {
    if (this.current !== 'tommy') return false;
    const W = this.game.weapon;
    if (W.reloading || W.ammo <= 0) return false;
    W.fire(this.game.time);
    return true;
  }
  reload() { return this.current === 'tommy' ? this.game.weapon.reload() : false; }
}
