import * as THREE from 'three';

// The encounter director (docs/story/CONTRACTS.md §5): a fight is a script,
// not a wave. A script is a generator coroutine stepped once per fixed step
// (after the world's update, where the old spawner ran), like a scene:
//
//   game.director.run(function* (d) {
//     d.spawn({ who: 'hood', at: { x: -6, z: -40 }, group: 'a', brain: 'cover' });
//     yield d.wait(2.5);
//     d.spawn({ who: 'heavy', at: 'block.alley.mouth', group: 'a' });
//     yield d.until('alive:a<=1');
//     d.cue('lightning');
//   });
//
// No wave counter, no wave card, no intermission. legacyWave(n) spawns
// exactly what the old wave n spawned (same spots, same order, same RNG
// fork 1777) for the debug presets that were framed on the wave game
// (battle, perf, end); legacyWaves(from) chains them with the old pacing.
// The Hoods' own pacing helpers (fire tokens, the lull breaker) stay with
// their AI (enemies/HoodAI.js HoodPacing); the director only starts them.

// (the old intermission, seconds: kept only by legacyWaves)
const LEGACY_LULL = 8;

export class Director {
  constructor(game) {
    this.game = game;
    this.scripts = [];         // running coroutines: { it, wait }
    this.groups = new Map();   // group name -> [Character]
    this.active = false;       // an encounter is on: the Hoods' pacing runs
    this.lull = false;         // (legacyWaves) the gap between two old waves
    this.clock = 0;            // seconds since the encounter (or its lull) began
    this.startT = 0;           // game time the encounter began
    this.level = 0;            // (legacyWave) the old wave number: the fire tokens' cap
    this.legacy = null;        // the old spawner, built on the first legacyWave
  }

  // no spawns still to come (the old spawner's `done`)
  get done() { return !this.legacy || this.legacy.toSpawn === 0; }

  // ---- scripts ---------------------------------------------------------------------
  // script: a generator function (called with the director) or a generator.
  // Its first stretch runs at once, up to its first yield.
  run(script) {
    const it = typeof script === 'function' ? script(this) : script;
    if (!this.active) this.begin();
    const S = { it, wait: null };
    if (this.resume(S)) this.scripts.push(S);
    return S;
  }

  wait(s) { return { kind: 'wait', left: s }; }
  until(cond) { return { kind: 'until', cond }; }

  // everything stops: scripts, spawns, the pacing
  stop() {
    this.scripts.length = 0;
    if (this.legacy) this.legacy.toSpawn = 0;
    this.active = false;
    this.lull = false;
  }

  // an encounter begins: its clock, and the Hoods' pacing
  begin() {
    const G = this.game;
    this.active = true;
    this.lull = false;
    this.clock = 0;
    this.startT = G.time;
    G.pacing.begin(G.time);
  }

  // resume a script; false once it has finished
  resume(S) {
    const r = S.it.next();
    if (r.done) return false;
    S.wait = r.value || null;
    return true;
  }

  test(cond) {
    if (typeof cond === 'function') return !!cond();
    if (typeof cond !== 'string') return !!cond;
    const [kind, arg] = cond.split(':');
    if (kind === 'dead') return this.alive(arg) === 0 && (this.groups.get(arg) || []).length > 0;
    if (kind === 'alive') {
      const m = /^([^<>=]+)(<=|>=|<|>|=)(\d+)$/.exec(arg);
      if (!m) throw new Error(`director.until: bad condition '${cond}'`);
      const n = this.alive(m[1]), k = +m[3];
      return m[2] === '<=' ? n <= k : m[2] === '>=' ? n >= k : m[2] === '<' ? n < k : m[2] === '>' ? n > k : n === k;
    }
    if (kind === 'zone') {
      const a = this.game.stage.anchor(arg);
      if (!a) return false;
      const e = this.game.eye;
      return Math.hypot(e.x - a.pos.x, e.z - a.pos.z) < (a.r ?? 1.5);
    }
    throw new Error(`director.until: unknown condition '${cond}'`);
  }

  // ---- the cast of a fight -----------------------------------------------------------
  // who: 'hood' | 'heavy' (the Hoods, with a brain) or a cast kind (§6)
  // A Hood takes the direction too (enemies/HoodAI.js, docs/story/seams/Y.md):
  //   entry: [{x, z} | anchor, ...] (run: true), post: {x, z} | anchor,
  //   leash: metres, wake: fn | 'sight' | 'shot', aim: 1, hp, brain: '<name>'
  // (entry as a word - 'idle' | 'walk' | 'run' - is the old start state)
  spawn({ who = 'hood', at, yaw = null, group = null, entry = 'idle', to = null, brain = 'cover', variant = null, ...direct } = {}) {
    const G = this.game;
    const p = this.place(at);
    let c;
    if (who === 'hood' || who === 'heavy') {
      const state = entry === 'walk' || entry === 'run' ? entry : 'idle';
      if (Array.isArray(entry)) direct.entry = entry;
      c = G.spawnHood(p.x, p.z, { ...direct, heavy: who === 'heavy', variant, yaw, state, ai: brain !== 'none', brain });
    } else if (G.cast && G.cast.spawn) {
      c = G.cast.spawn(who, { at: p, yaw: yaw ?? 0, variant, group });
    } else throw new Error(`director.spawn: no cast yet for '${who}'`);
    if (to && c.walkTo) this.run(c.walkTo(this.place(to), { run: entry === 'run' }));
    if (group) {
      if (!this.groups.has(group)) this.groups.set(group, []);
      this.groups.get(group).push(c);
    }
    return c;
  }

  // (wave B: a car that brings its riders)
  car() { throw new Error('director.car: vehicles are wave B'); }

  // living members of a group (every figure the director spawned without one)
  alive(group = null) {
    let n = 0;
    if (group) { for (const c of this.groups.get(group) || []) if (c.alive) n++; return n; }
    for (const h of this.game.stage.hoods.list) if (h.alive) n++;
    return n;
  }

  // world events a script calls for: the lights, the train, lightning, music
  cue(name, data = {}) {
    const G = this.game;
    if (name === 'lightning') G.storm.strike(data.strength ?? 1, data.double ?? null);
    else if (name === 'train' && G.stage.train) G.stage.train.stage(data.z ?? -40, data.ahead ?? 0, data.dir ?? 1);
    else if (name === 'music' && G.music) G.music.cue(data.slot, data);
    G.emit('cue', { name, ...data });
  }

  // an anchor name or { x, z } -> { x, z }
  place(at) {
    if (typeof at === 'string') {
      const a = this.game.stage.anchor(at);
      if (!a) throw new Error(`director: no anchor '${at}'`);
      return { x: a.pos.x, z: a.pos.z };
    }
    if (at && at.isVector3) return { x: at.x, z: at.z };
    return { x: at.x, z: at.z };
  }

  // ---- the old waves (debug presets only) ------------------------------------------
  // exactly what wave n spawned: 1 + 2n Hoods, heavies from wave 3, out of
  // the fog down the avenue over 4-6 s, the first two the vanguard
  legacyWave(n) {
    if (!this.legacy) this.legacy = new LegacySpawner(this.game);
    this.level = n;
    this.legacy.startWave(n);
    this.begin();
  }

  // the old wave game, from wave `from`: a wave, its last man down and two
  // quiet seconds, the old intermission's eight (weapons safed, the train
  // hurried off), the next wave
  legacyWaves(from) {
    const d = this;
    return this.run(function* () {
      for (let n = from; ; n++) {
        d.legacyWave(n);
        yield d.until(() => d.done && d.game.counters.alive === 0 && d.clock > 2);
        d.lull = true;
        d.clock = 0;
        yield d.until(() => d.clock >= LEGACY_LULL);
      }
    });
  }

  // ---- per step (Game.post) -------------------------------------------------------------
  update(dt, t) {
    const G = this.game;
    this.clock += dt;
    // (while the player is down or on the title nothing moves on)
    if (G.state !== 'playing') return;
    if (this.active && !this.lull) {
      G.pacing.update(t);
      if (this.legacy) this.legacy.update(dt);
    }
    for (const S of [...this.scripts]) {
      const w = S.wait;
      if (w && w.kind === 'wait') { w.left -= dt; if (w.left > 1e-6) continue; }
      else if (w && w.kind === 'until' && !this.test(w.cond)) continue;
      if (!this.resume(S)) this.scripts.splice(this.scripts.indexOf(S), 1);
    }
    if (!this.scripts.length && !this.legacy) this.active = false;
  }
}

// The old wave spawner (Phase 2b / 3a), kept whole for legacyWave: 1 + 2n
// Hoods, heavies with Tommy guns from wave 3 (1, then one more every other
// wave), out of the fog down the avenue, from behind cars and the el's
// columns, 30-45 m from the player (out of his line of sight when
// possible), staggered over 4-6 s, at most 12 alive at once. The first two
// are the vanguard: they spawn at the near end of the band and run to cover
// at ~25 m to open fire.
const legacySize = (n) => 1 + 2 * n;
const legacyHeavies = (n) => (n >= 3 ? Math.min(3, Math.floor((n - 1) / 2)) : 0);
const MAX_ALIVE = 12;

class LegacySpawner {
  constructor(game) {
    this.game = game;
    this.rng = game.stage.rng.fork(1777);
    this.toSpawn = 0;
    this.heaviesLeft = 0;
    this.timer = 0;
    // candidate spots: open nav cells every ~3 m over the block, plus the
    // cover points (behind a car / column); scored per spawn
    const nav = game.nav;
    this.spots = [];
    const B = game.stage.colliders.bounds;
    for (let z = B.maxZ - 2; z > B.minZ + 2; z -= 3) {
      for (let x = B.minX + 1; x < B.maxX - 1; x += 3) {
        if (nav.free(x, z)) this.spots.push({ x, z, behind: false });
      }
    }
    for (const c of game.covers.points) this.spots.push({ x: c.x, z: c.z, behind: true, cover: c });
  }

  startWave(n) {
    this.toSpawn = legacySize(n);
    this.heaviesLeft = legacyHeavies(n);
    this.timer = 0.4;
    this.spawned = 0;
    // (the whole wave comes out over 4-6 s)
    this.gap = this.rng.range(4, 6) / Math.max(1, this.toSpawn - 1);
  }

  pickSpot(vanguard = false) {
    const G = this.game, p = G.eye, r = this.rng;
    const cands = [];
    const [d0, d1] = vanguard ? [30, 34] : [30, 45];
    for (const s of this.spots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < d0 || d > d1) continue;
      // not on top of another Hood
      let near = false;
      for (const h of G.stage.hoods.list) if (h.alive && Math.hypot(h.pos.x - s.x, h.pos.z - s.z) < 2.5) { near = true; break; }
      if (near) continue;
      // behind a car or a column (out of sight) first, the nearer end of the
      // band next
      cands.push({ s, d, score: (s.behind ? 2.5 : 0) + (d < 38 ? 1.5 : 0) + r.next() * 3 });
    }
    if (!cands.length && vanguard) return this.pickSpot(false);
    if (!cands.length) {
      // a short block: the farthest open spots
      let best = null, bd = 0;
      for (const s of this.spots) {
        const d = Math.hypot(s.x - p.x, s.z - p.z) + r.next() * 4;
        if (d > bd) { bd = d; best = s; }
      }
      return best;
    }
    cands.sort((a, b) => b.score - a.score);
    // prefer spots the player cannot see (out of the fog / behind cover)
    for (let i = 0; i < Math.min(6, cands.length); i++) {
      const s = cands[i].s;
      const e = new THREE.Vector3(s.x, 1.6, s.z);
      const dir = new THREE.Vector3().subVectors(p, e);
      const d = dir.length();
      dir.divideScalar(d);
      if (d > 44 || G.rays.raycast(e, dir, d - 0.5, { anyHit: true })) return s;
    }
    return cands[0].s;
  }

  update(dt) {
    if (this.toSpawn <= 0) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const alive = this.game.stage.hoods.list.filter((h) => h.alive).length;
    if (alive >= MAX_ALIVE) { this.timer = 0.5; return; }
    // the last ones are the heavies; the first two the vanguard
    const heavy = this.heaviesLeft > 0 && this.toSpawn <= this.heaviesLeft;
    const vanguard = !heavy && this.spawned < 2;
    const s = this.pickSpot(vanguard);
    if (!s) { this.timer = 0.5; return; }
    this.game.spawnHood(s.x, s.z, { heavy, vanguard });
    if (heavy) this.heaviesLeft--;
    this.toSpawn--;
    this.spawned++;
    this.timer = this.gap * this.rng.range(0.7, 1.3);
  }
}
