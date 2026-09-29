import { Stage } from '../world/World.js';

// Every stage of the story: src/stages/<name>/index.js default-exports
// { name, parts: [part defs], look?, salt? } and is found here on its own
// (import.meta.glob, eager): a new stage is a new directory, never an edit.
// game.stages.get(name) builds a stage on first use; .names lists them.
// RNG: the block draws from the root seed (its parts' forks are the ones
// every golden frame was printed with); another stage declares a `salt`
// and draws from root.fork(salt), so building it never disturbs the block.
const mods = import.meta.glob('./*/index.js', { eager: true });
export const STAGE_DEFS = new Map(Object.values(mods).map((m) => [m.default.name, m.default]));

export class Stages {
  // ctx: { renderer, U, tex, rng }: the engine every stage shares
  constructor(ctx) {
    this.ctx = ctx;
    this.built = new Map();
  }

  get names() { return [...STAGE_DEFS.keys()]; }

  // (opts.scene: the scene to build it into, main.js's for the first stage)
  get(name, opts = {}) {
    if (this.built.has(name)) return this.built.get(name);
    const def = STAGE_DEFS.get(name);
    if (!def) throw new Error(`no stage '${name}' (stages: ${this.names.join(', ')})`);
    const { renderer, U, tex, rng } = this.ctx;
    const stage = new Stage({
      name, renderer, U, tex, rng: def.salt == null ? rng : rng.fork(def.salt), scene: opts.scene || null,
      parts: def.parts, look: def.look || null,
    });
    this.built.set(name, stage);
    return stage;
  }
}
