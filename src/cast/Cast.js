import * as THREE from 'three';
import { Hood } from '../enemies/Hood.js';
import { Character, resolveAt } from './Character.js';
import { buildProp } from '../props/index.js';

// The cast of a stage (docs/story/CONTRACTS.md §6): every figure on it.
//   stage.cast / game.cast
//   cast.spawn(kind, { at: anchor | {x, z}, yaw?, variant?, seat?: anchor, group?,
//                      name?, brain? }) -> Character
//   cast.get(name)   cast.list   cast.remove(c)   cast.clear()
// kinds (wave A): hood, heavy (the Hoods: they live in stage.hoods, with
// the Game's AI unless brain: 'none'), brawler, waitress, cook, oldman,
// couple_her, couple_him, docker.
// A name is the kind's own (the brawler is 'mack', the waitress 'dot', the
// rest their kind) unless given; a second of a kind gets '<name>2', ...
// At most 12 Hoods and 8 others alive on a stage (the frame rate).
//
// FOUNDATION STUB (lane 6 owns src/cast/**): every kind is the Hood's own
// figure without a gun, scaled to the kind's height (CONTRACTS: the
// costumes are lane 6's figureGeometry). The brawler carries his red
// matchbook, hidden (c.items.get('matchbook')).
export const KINDS = {
  hood: { hood: true },
  heavy: { hood: true, heavy: true },
  brawler: { h: 1.96, name: 'mack', variant: { coat: 2, brim: 0 } },
  waitress: { h: 1.68, name: 'dot', variant: { coat: 0, brim: 0 } },
  cook: { h: 1.8, variant: { coat: 2, brim: 0 } },
  oldman: { h: 1.66, variant: { coat: 0, brim: 1 } },
  couple_her: { h: 1.64, variant: { coat: 1, brim: 0 } },
  couple_him: { h: 1.74, variant: { coat: 2, brim: 1 } },
  docker: { h: 1.82, variant: { coat: 2, brim: 0 } },
};
// the Hood's figure is 1.82 m to the top of the hat (enemies/HoodRig.js)
const HOOD_H = 1.82;
const MAX_HOODS = 12, MAX_OTHERS = 8;

export class Cast {
  constructor(stage) {
    this.stage = stage;
    this.list = [];
  }

  get game() { return this.stage.game; }

  spawn(kind, { at, yaw = null, variant = null, seat = null, group = null, name = null, brain = null } = {}) {
    const K = KINDS[kind];
    if (!K) throw new Error(`cast.spawn: no kind '${kind}' (kinds: ${Object.keys(KINDS).join(', ')})`);
    const alive = (hood) => this.list.filter((c) => c.alive && !!KINDS[c.kind].hood === hood).length;
    if (K.hood ? alive(true) >= MAX_HOODS : alive(false) >= MAX_OTHERS) throw new Error(`cast.spawn: too many ${K.hood ? 'Hoods' : 'figures'} on '${this.stage.name}'`);
    const w = resolveAt(this.stage, at || seat || { x: 0, z: 0 });
    const fyaw = yaw ?? w.yaw ?? 0;
    let fig, own = true;
    const G = this.game;
    if (K.hood) {
      own = false;
      const ai = (brain ?? 'cover') !== 'none';
      fig = G ? G.spawnHood(w.x, w.z, { heavy: !!K.heavy, variant: variant ? { ...variant, heavy: !!K.heavy } : null, yaw: fyaw, ai })
        : this.stage.hoods.spawn([w.x, w.z], { ...(variant || {}), heavy: !!K.heavy }, { yaw: fyaw, state: 'idle' });
    } else {
      fig = new Hood(this.stage, { pos: new THREE.Vector3(w.x, 0, w.z), yaw: fyaw, variant: { tall: 1, ...K.variant, ...(variant || {}), cig: false, heavy: false, unarmed: true } });
      fig.scale = (K.h || HOOD_H) / HOOD_H;
      fig.object.scale.setScalar(fig.scale);
      if (fig.collider) fig.collider.r = 0.32 * fig.scale;
    }
    let nm = name || K.name || kind;
    if (!name) for (let i = 2; this.get(nm); i++) nm = (K.name || kind) + i;
    const c = new Character(this, fig, { kind, name: nm, own, brain: brain ?? (K.hood ? 'cover' : 'none'), group });
    this.list.push(c);
    if (kind === 'brawler') {
      const mb = buildProp('matchbook');
      mb.visible = false;
      mb.position.set(0.09, -0.12, 0.12);
      fig.bones.chest.add(mb);
      c.items.set('matchbook', mb);
    }
    if (seat) c.sit(seat);
    if (own) fig.update(0, 0);
    return c;
  }

  get(name) { return this.list.find((c) => c.name === name) || null; }

  remove(c) {
    const i = this.list.indexOf(c);
    if (i < 0) return;
    this.list.splice(i, 1);
    const G = this.game;
    if (!c.own) { if (G) G.removeHood(c.fig); else this.stage.hoods.remove(c.fig); }
    else c.fig.dispose();
  }

  clear() { for (const c of [...this.list]) this.remove(c); }

  // the figures this stage draws on its own (the Game's shadow casters)
  figures() { return this.list.filter((c) => c.own).map((c) => c.fig); }

  update(dt, t, camera) {
    for (const c of this.list) c.update(dt, t, camera);
  }
}
