import { HoodAI } from './HoodAI.js';

// The Hoods' brains (wave B seams, docs/story/seams/Y.md). A Hood spawned
// with `brain: '<name>'` (Game.spawnHood, cast.spawn('hood'), d.spawn) thinks
// with that brain:
//   'cover'   today's (enemies/HoodAI.js): cover, peek, aim, fire, duck, rush
//   'none'    no brain at all (the Game keeps no AI for him)
//   a file    src/enemies/brains/<any>.js default-exporting
//               { name, create(game, hood, opts) -> { update(dt, t), onHit?(dir, stunned),
//                                                     release?(), press?() -> bool } }
// A file's brain runs inside a BrainHost: the man's body (a HoodAI whose
// cover state machine is never stepped), given to create as `opts.body`:
// its moves (go / follow / stop / faceTo), its eyes (checkLOS / losFrom /
// distToPlayer / player), its gun (fire), the fire tokens (token / dropToken)
// and the direction (wake / entry / post / leash / aim) before the brain.
// A name defined twice throws at load.

// a file's brain, hosted: the direction first, then the brain's own step
class BrainHost extends HoodAI {
  constructor(game, hood, spec, opts) {
    super(game, hood, { heavy: opts.heavy, vanguard: false, direct: opts.direct });
    this.brainName = spec.name;
    this.state = 'brain';
    this.brain = spec.create(game, hood, { ...opts, body: this });
    if (!this.brain || typeof this.brain.update !== 'function') throw new Error(`brain '${spec.name}': create must return { update(dt, t) }`);
  }
  think(dt, t) {
    if (!this.h.alive) { this.release(); return; }
    this.brain.update(dt, t);
    if (this.brain.state) this.state = this.brain.state;
  }
  onHit(dir, stunned) { super.onHit(dir, stunned); if (this.brain.onHit) this.brain.onHit(dir, stunned); }
  release() { super.release(); if (this.brain && this.brain.release) this.brain.release(); }
  press() { return !!(this.brain.press && this.brain.press()); }
  // one shot at the player through the Game (flash, sound, the accuracy
  // roll with his `aim`, the round landing a moment later)
  fire(t = this.game.time) { if (!this.h.alive) return false; this.game.hoodFire(this, t); this.lastShot = t; return true; }
  // a fire token (at most two or three men shoot at once); force: always
  token(force = false) { return this.game.pacing.take(this, force); }
  dropToken() { this.game.pacing.drop(this); }
}

export const BRAINS = {
  cover: { name: 'cover', builtin: true },
  none: { name: 'none', builtin: true },
};
const FILES = import.meta.glob('./brains/*.js', { eager: true });
for (const path of Object.keys(FILES).sort()) {
  const B = FILES[path].default;
  if (!B || !B.name || typeof B.create !== 'function') throw new Error(`hood brains: ${path} must default-export { name, create(game, hood, opts) }`);
  if (BRAINS[B.name]) throw new Error(`hood brains: '${B.name}' defined twice (${path})`);
  BRAINS[B.name] = B;
}

// the direction's options (HoodAI.js): any of them makes a directed man
const DIRECTION = ['entry', 'run', 'post', 'leash', 'wake', 'aim'];

// the brain for a Hood the Game spawns (null for 'none')
//   opts: { heavy, vanguard, entry, run, post, leash, wake, aim, ...the brain's own }
export function makeBrain(game, hood, name = 'cover', opts = {}) {
  const spec = BRAINS[name || 'cover'];
  if (!spec) throw new Error(`hood brain: no brain '${name}' (brains: ${Object.keys(BRAINS).join(', ')})`);
  if (spec.name === 'none') return null;
  const { heavy = false, vanguard = false } = opts;
  let direct = null;
  for (const k of DIRECTION) if (opts[k] != null && opts[k] !== false) { direct = {}; break; }
  if (direct) for (const k of DIRECTION) if (opts[k] != null) direct[k] = opts[k];
  // (today's men, the wave game's and the battle's: exactly as they were)
  if (spec.name === 'cover') return direct ? new HoodAI(game, hood, { heavy, vanguard, direct }) : new HoodAI(game, hood, { heavy, vanguard });
  return new BrainHost(game, hood, spec, { ...opts, heavy, direct });
}
