import * as THREE from 'three';
import { Figure } from './Figure.js';
import { Character, resolveAt } from './Character.js';
import { buildProp } from '../props/index.js';

// The cast of a stage (docs/story/CONTRACTS.md §6): every figure on it.
//   stage.cast / game.cast
//   cast.spawn(kind, { at: anchor | {x, z}, yaw?, variant?, seat?: anchor, group?,
//                      name?, brain? }) -> Character
//   cast.get(name)   cast.list   cast.remove(c)   cast.clear()   cast.figures()
//   cast.attention(pos, seconds?)   every calm figure glances at pos (the
//                                   door's bell, a noise); breaks and glass
//                                   going draw the room's eyes on their own
// kinds (wave A): hood, heavy (the Hoods: they live in stage.hoods, with
// the Game's AI unless brain: 'none'), brawler, waitress, cook, oldman,
// couple_her, couple_him, docker: costumes on the Hood's skeleton
// (src/cast/costumes.js, tailor.js, Figure.js).
// A name is the kind's own (the brawler is 'mack', the waitress 'dot', the
// rest their kind) unless given; a second of a kind gets '<name>2', ...
// At most 12 Hoods and 8 others alive on a stage (the frame rate).
export const KINDS = {
  hood: { hood: true },
  heavy: { hood: true, heavy: true },
  brawler: { h: 1.96, name: 'mack' },
  waitress: { h: 1.68, name: 'dot' },
  cook: { h: 1.8 },
  oldman: { h: 1.66 },
  couple_her: { h: 1.64 },
  couple_him: { h: 1.74 },
  docker: { h: 1.82 },
};
const MAX_HOODS = 12, MAX_OTHERS = 8;
const _v = new THREE.Vector3();

export class Cast {
  constructor(stage) {
    this.stage = stage;
    this.list = [];
    this._hooked = null;
  }

  get game() { return this.stage.game; }

  spawn(kind, { at, yaw = null, variant = null, seat = null, group = null, name = null, brain = null } = {}) {
    const K = KINDS[kind];
    if (!K) throw new Error(`cast.spawn: no kind '${kind}' (kinds: ${Object.keys(KINDS).join(', ')})`);
    const alive = (hood) => this.list.filter((c) => c.alive && !!KINDS[c.kind].hood === hood).length;
    if (K.hood ? alive(true) >= MAX_HOODS : alive(false) >= MAX_OTHERS) throw new Error(`cast.spawn: too many ${K.hood ? 'Hoods' : 'figures'} on '${this.stage.name}'`);
    const w = resolveAt(this.stage, at || seat || { x: 0, z: 0 });
    const fyaw = yaw ?? w.yaw ?? 0;
    // (the cook stands where the anchor says: lane 5's diner.hatch is inside
    // its kitchen box, between the hatch partition and the lit back wall;
    // pushing him behind x = backX put him behind that wall)
    let fig, own = true;
    const G = this.game;
    if (K.hood) {
      own = false;
      const ai = (brain ?? 'cover') !== 'none';
      fig = G ? G.spawnHood(w.x, w.z, { heavy: !!K.heavy, variant: variant ? { ...variant, heavy: !!K.heavy } : null, yaw: fyaw, ai })
        : this.stage.hoods.spawn([w.x, w.z], { ...(variant || {}), heavy: !!K.heavy }, { yaw: fyaw, state: 'idle' });
    } else {
      fig = new Figure(this.stage, { kind, pos: new THREE.Vector3(w.x, 0, w.z), yaw: fyaw });
    }
    let nm = name || K.name || kind;
    if (!name) for (let i = 2; this.get(nm); i++) nm = (K.name || kind) + i;
    const c = new Character(this, fig, { kind, name: nm, own, brain: brain ?? (K.hood ? 'cover' : 'none'), group });
    this.list.push(c);
    if (kind === 'brawler') {
      // the red matchbook in his waistcoat pocket, half out of it (hidden
      // until lane 7 asks for it)
      const mb = buildProp('matchbook');
      mb.visible = false;
      const [th, y] = fig.costume.pocket;
      const T = fig.costume.body.torso;
      const row = T.reduce((a, r) => (Math.abs(r[0] - y) < Math.abs(a[0] - y) ? r : a), T[0]);
      const e = 2 / row[5];
      const px = (row[1] + 0.012) * Math.sign(Math.sin(th)) * Math.pow(Math.abs(Math.sin(th)), e);
      const pz = row[4] + (row[2] + 0.012) * Math.pow(Math.abs(Math.cos(th)), e);
      const B = fig.rig.BIND;
      mb.position.set(px, y - 0.01, pz).sub(B.spine);
      mb.rotation.set(Math.PI / 2 - 0.25, th * 0.8, 0.1);
      mb.scale.setScalar(1 / fig.scale);
      fig.bones.spine.add(mb);
      c.items.set('matchbook', mb);
    }
    if (seat) c.sit(seat);
    if (own) fig.update(0, 0);
    return c;
  }

  get(name) { return this.list.find((c) => c.name === name) || null; }

  remove(c) {
    if (!c) return;
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

  // every calm figure looks at pos (a staggered turn of heads)
  attention(pos, seconds = 1.8) {
    if (!pos) return;
    for (const c of this.list) {
      if (!c.own || !c.alive) continue;
      if (_v.set(pos.x - c.pos.x, 0, pos.z - c.pos.z).length() > 25) continue;
      c.glance(pos, seconds * (0.8 + 0.4 * c.rng.next()));
    }
  }

  update(dt, t, camera) {
    const G = this.game;
    if (G && this._hooked !== G) {
      this._hooked = G;
      G.on('break', (e) => e && e.pos && this.attention(e.pos, 1.4));
      G.on('glass:shatter', (e) => {
        const p = e && e.pane && (e.pane.centre || e.pane.center);
        if (p && p.isVector3) this.attention(p, 2.2);
      });
    }
    for (const c of this.list) c.update(dt, t, camera);
  }
}
