import * as THREE from 'three';
import { Person } from './Person.js';
import { Crime, SEE } from '../police/crime.js';
import { Police, HEAT } from '../police/Police.js';
import { Gangs } from './Gangs.js';
import { StandinHands } from './hands.js';
import { districtAt } from '../world/plan.js';
import { figureGeometry } from '../cast/tailor.js';
import { COSTUMES } from '../cast/costumes.js';
import { castBank } from '../cast/castAnim.js';
import { LOOKS, PED_LOOKS, COP_LOOKS, TEC_LOOKS, GANG_LOOKS, hash, pickWeighted } from './costumes.js';
import { wake } from '../combat/fall.js';
import { owns } from '../combat/money.js';

// [O3] The city's people (lane O3, NOIR CITY): the crowd on the pavements,
// the witnesses, and the systems that live on them - the police (src/police/)
// and the gangs. One per game in the city (game.people), stepped by the free
// roam (src/scenes/city.js installs it).
//
// THE CROWD. Pedestrians who are the city's weather: on O1's pavement graph,
// walking somewhere (a random walk along the kerbs and over the crossings,
// keeping right), standing (under the awnings, at the stops, at the call
// boxes, watching the street), going in at a street door, coming out of one.
// They come on out of my sight - behind me, round a corner, out of a door -
// and go when out of it (or in at a door): never a pop. How many by the
// district (downtown the most, the Hill and the Yards the fewest), never
// more than CROWD.cap (the figures' budget: O1's 64 ink slots are the
// people's and the cars' together).
// They react (People.witness, People.alarm): a gun drawn near them - they run,
// with a cry, the umbrella dropped; a shot - they scatter; a fist fight -
// they back off in a ring and cower, some watch; a body or a wreck - after a
// while they gather at a distance and murmur; a car coming at them - the dash
// clear (the tail's walkers' rule), and a car that comes too fast to clear
// knocks them down (hurt, or dead over 9 m/s: a death seen is heat). A crime
// seen by one of them: he looks at me, then runs to the nearest call box (O1's
// boxes) or a cop in sight and tells it - seen, and he can be stopped (put
// down, or caught: I stand at his side and he gives it up).
//   people.spawn(kind, x, z, yaw, role, opts) -> Person   people.release(p)
//   people.near(x, z, r)   people.alarm(kind, at, r)   people.witness(rec)
//   people.list   people.stats   people.crime (game.crime)   people.police (game.police)
export const CROWD = {
  cap: 18,                          // the walkers at once (the cops and the gangs come on top)
  ring: [34, 70],                   // a walker comes on this far from me (out of sight)
  gone: 95,                         // and goes past this (out of sight 5 s past the ring)
  // walkers wanted round me, by district
  want: { downtown: 16, tenements: 14, docks: 9, yards: 4, hill: 6, river: 4 },
  // (who walks where: src/people/costumes.js PED_LOOKS, by district, picked
  // by a seeded hash of where he comes on; the newsboy downtown and in the
  // Tenements now and then)
  newsboy: { downtown: 0.08, tenements: 0.1 },
  umbrella: 0.35,                   // a share of them under an open umbrella
};
const _v = new THREE.Vector3(), _f = new THREE.Vector3();
// the pool's size: figures waiting for a man of their look (no ink slot held)
const POOL = 40;

export class People {
  constructor(G, stage) {
    this.G = G;
    this.stage = stage;
    const city = stage.part('city');
    this.C = city.C;
    this.graph = city.graph;
    this.list = [];
    this.pool = new Map();
    this.grid = new Map();
    this.spawnT = 0;
    this.t = 0;
    this.rng = stage.rng.fork(3303);
    this.stats = { spawned: 0, made: 0, released: 0, reports: 0, stopped: 0, hitByCar: 0, dashes: 0, killed: 0, knocked: 0 };
    this.pList = [...this.graph.pnodes.values()];
    this.boxes = this.C.props.filter((p) => p.kind === 'callbox');
    // (where a man stands a while: the tram's stops, the stalls, the benches,
    // the call boxes, the newsstands - a place on the pavement beside it)
    this.spots = this.C.props.filter((p) => p.kind === 'stop' || p.kind === 'stall' || p.kind === 'bench' || p.kind === 'callbox' || p.kind === 'newsstand');
    this.SB = new Map();
    for (const q of this.spots) { const k = Math.floor(q.x / 32) * 4096 + Math.floor(q.z / 32); if (!this.SB.has(k)) this.SB.set(k, []); this.SB.get(k).push(q); }
    // the systems on the people
    this.crime = new Crime(this);
    G.crime = this.crime;
    this.police = new Police(this);
    G.police = this.police;
    this.gangs = new Gangs(this);
    this.hands = new StandinHands(this);
    this.hook();
    this.prewarm();
  }
  // every look's body cut and its clips made now (under the fade in), never
  // at a man's first step out of a door
  prewarm() {
    const t0 = performance.now();
    const kinds = new Set([...Object.keys(LOOKS), 'o3_newsboy', 'o3_patrolman', 'o3_docksman', 'o3_tough']);
    for (const k of kinds) {
      const c = COSTUMES[k];
      if (!c) continue;
      for (let l = 0; l < 3; l++) figureGeometry(c, l);
      try { const B = castBank(k); for (const n of ['idle', 'walk', 'run', 'cower', 'watch', 'koFall', 'ko', 'carry', 'o4_getUp']) if (B.has(n)) B.ensure(n); } catch (e) { /* */ }
    }
    // (the hands' programs: the fists and the revolver drawn once out of sight,
    // compiled, put away - the first jab or draw in the street never stalls)
    const G = this.G, r = G.pipeline && G.pipeline.renderer;
    if (r && r.compile && G.vm && !G.shotMode) {
      const W = G.player.weapons, H = G.player.hands, vis = G.vmWanted;
      try {
        G.vm.visible = true; G.pipeline.vm.visible = true;
        H.equip('fists'); r.compile(G.vm.scene, G.vm.cam);
        W.equip('revolver'); r.compile(G.vm.scene, G.vm.cam);
        W.equip(null); H.equip('empty');
      } catch (e) { /* its first draw will */ }
      G.setViewmodelVisible(vis);
    }
    this.prewarmMs = performance.now() - t0;
  }

  // ---- the game's hooks (no shared file edited for these) -------------------------------------
  hook() {
    const G = this.G;
    // the near people cast shadows as the cast does (the pipeline's casters)
    if (!G._o3shadow) {
      const base = G.shadowFigures.bind(G);
      G._o3shadow = true;
      G.shadowFigures = () => { const P = G.people; return P && P.stage === G.stage ? base().concat(P.shadowFigs()) : base(); };
      const pipe = G.pipeline, rh = pipe.reflHide;
      // (the far people out of the wet street's mirror, as the far Hoods are)
      pipe.reflHide = (cam) => { const L = rh(cam); const P = G.people; if (P && P.stage === G.stage) for (const p of P.list) if (p.object.visible && p.pos.distanceToSquared(cam.position) > 20 * 20) L.push(p.object); return L; };
    }
    // every shot of the player's is a crime (O4's guns call crime.emit
    // themselves; the same shot told twice is one: crime.js)
    this._shot = (e) => this.onShot(e);
    G.on('shot', this._shot);
    this._in = (e) => this.police.onIn(e && e.car);
    G.on('city:in', this._in);
    // lane O4's crowd brawl tells its own ('crime' { kind: 'draw' | 'shot', by, at, cop }):
    // into the bus (the bus's own records carry an id and come back here: passed over)
    this._o4crime = (e) => {
      if (!e || e.id || !e.at || !this.G.city) return;
      const k = e.kind === 'draw' ? 'menace' : e.kind === 'shot' ? (e.cop ? 'cophurt' : 'shot') : null;
      if (k) this.crime.emit(k, e.at, e.by || 'player');
    };
    G.on('crime', this._o4crime);
    // lane O6's destruction set ('smash' { kind, pos, by }): what is someone's (a shop's
    // glass, a stall, a newsstand) broken by my car or my fist is a crime ('smash', 1)
    this._smash = (e) => {
      if (!e || !e.pos || !this.G.city || this.G.stage !== this.stage) return;
      if (!(e.kind === 'glass' || e.kind === 'stall' || e.kind === 'newsstand')) return;
      const R = this.G.city;
      const mine = e.by === 'fist' || (e.by === 'car' && R.inCar && R.car && Math.hypot(R.car.pos.x - e.pos.x, R.car.pos.z - e.pos.z) < 7);
      if (mine) this.crime.emit('smash', e.pos, 'player');
    };
    G.on('smash', this._smash);
  }
  shadowFigs() { const out = []; for (const p of this.list) if (p.object.visible && p.pos.distanceToSquared(this.G.eye) < 26 * 26) out.push(p.fig); return out; }

  dispose() {
    this.G.off('shot', this._shot);
    this.G.off('city:in', this._in);
    this.G.off('crime', this._o4crime);
    this.G.off('smash', this._smash);
    this.police.dispose();
    this.gangs.dispose();
    for (const p of this.list) p.dispose();
    for (const L of this.pool.values()) for (const p of L) p.dispose();
    this.list = []; this.pool.clear();
    if (this.G.crime === this.crime) this.G.crime = null;
    if (this.G.police === this.police) this.G.police = null;
  }

  // after a fail's black (the station, the hospital, the river): the police
  // stood down, the street round the old place let go, the arrest's costs
  afterFail(why) {
    const G = this.G;
    this.police.reset();
    if (G.city) G.city.ownCar = null;
    for (const T of [...this.gangs.threes]) this.gangs.drop(T);
    this.gangs.war_ = null;
    for (const p of [...this.list]) this.release(p);
    this._later = [];
    this.spawnT = 1.2;
    // (lane O4's rules of the fall, src/combat/fall.js: the station keeps the guns
    // and fines a fifth, $10 at least; the hospital keeps nothing but a tenth)
    if (why === 'arrest') {
      const had = ['revolver', 'shotgun', 'tommy'].some((g) => owns(G, g));
      const { cost } = wake(G, 'station');
      if (G.player.weapons.current) G.player.weapons.equip(null);
      G.hud.say(`Released.${cost ? ` Fined $${cost}.` : ''}${had ? ' They kept the gun.' : ''}`, 3.4, { always: true });
    } else if (why === 'hospital') {
      const { cost } = wake(G, 'hospital');
      G.hud.say(cost ? `Patched up. $${cost} for the stitches.` : 'Patched up. On your feet.', 2.8, { always: true });
    }
    this.police.event('wake', { why });
  }

  // ---- the frames' tableaux (shot mode: ?scene=city&beat=roam&people=1&o3stage=<name>) ----------
  // fixed people at fixed places on the Grand Ave start, the same every capture
  // (the golden frames city_o3_crowd and city_o3_police; look development)
  stageShot(name) {
    this.hold = true;
    const walk = (kind, x, z, yaw, gait = 'walk', umbrella = false) => {
      const p = this.spawn(kind, x, z, yaw, 'walker', { umbrella });
      p.side = 0.5; p.mode = 'walk';
      p.goTo([[x + Math.sin(yaw) * 40, z + Math.cos(yaw) * 40]], { gait });
      return p;
    };
    if (name === 'crowd') {
      // the east pavement under the el: toward me, away from me, two under umbrellas
      walk('o3_fedora_b', -108.4, 14, 0, 'walk', true);
      walk('o3_woman_a', -107.2, 4, 0, 'stroll', true);
      walk('oldman', -108.9, -6, 0, 'walk');
      walk('o3_fedora_d', -107.5, 24, Math.PI, 'walk');
      walk('o3_newsboy', -109.4, 27.5, Math.PI, 'hurry');
      walk('o3_fedora_g', -108.2, -16, 0, 'stroll', true);
      // across the avenue under the marquee, waiting out the rain
      this.dbgWalker(-130.4, 21.5, -Math.PI / 2, 'o3_woman_c');
      this.dbgWalker(-130.6, 23.2, -Math.PI / 2 + 0.5, 'o3_fedora_c');
      // a beat cop coming down the pavement
      const c = this.dbgCop(-108.3, -26, 0); c.mode = 'walk'; c.goTo([[-108.3, 30]], { gait: 'stroll' });
    } else if (name === 'police') {
      // a man down in the road, the patrol car stopped crooked by him, a cop
      // over him, another at the car, the street watching from the kerb
      const pc = this.police.spawnCarAt(-116.5, 12, Math.PI / 2 + 0.5);
      pc.park(); pc.mode = 'stopped'; pc.siren = false;
      const v = this.dbgWalker(-113.2, 14.5, 0.8, 'o3_fedora_e'); v.knock(null, { why: 'punch' });
      const c1 = this.dbgCop(-112.3, 15.8, -2.2, 'hold'); c1.look({ x: -113.2, z: 14.5, y: -1 });
      const c2 = this.dbgCop(-118.6, 14.2, 2.4, 'hold');
      void c2;
      this.dbgWalker(-108.6, 18.5, -1.9, 'o3_woman_b').watch({ x: -113.2, z: 14.5 }, 999);
      this.dbgWalker(-108.2, 16.2, -1.6, 'oldman').watch({ x: -113.2, z: 14.5 }, 999);
      this.dbgWalker(-108.9, 11.8, -1.3, 'o3_fedora_h').watch({ x: -113.2, z: 14.5 }, 999);
    }
  }

  // ---- the plays' staging (tools/plays/o3_*: a beat's setup, like the kit's debug hooks) ---------
  // the street round me emptied, the police stood down (the start of a proof)
  dbgClear() { this.afterFail('reset'); this.hold = true; }
  // me at my car's door, looking at it (the next E gets in)
  dbgAtCar() {
    const R = this.G.city, c = R && R.car;
    if (!c || R.inCar) return false;
    const p = c.world(-0.3, -(c.spec.halfW + 0.95), new THREE.Vector3());
    this.stage.colliders.resolve(p, 0.4);
    this.G.controller.setPose(p.x, p.z, Math.atan2(-(c.pos.x - p.x), -(c.pos.z - p.z)), -0.1);
    return true;
  }
  // a walker standing at a place (held there until let go: p.mode 'stand', long)
  dbgWalker(x, z, yaw = 0, kind = null) {
    const p = this.spawn(kind || this.pedLook(x, z), x, z, yaw, 'walker');
    p.mode = 'stand'; p.until = 9999; p.t = 0; p.stop();
    return p;
  }
  // a beat cop at a place, looking along yaw
  dbgCop(x, z, yaw = 0, job = 'beat') {
    const c = this.spawn(this.copLook(), x, z, yaw, 'cop');
    c.job = job; c.mode = 'stand'; c.until = 9999; c.t = 0; c.stop();
    this.police.cops.push(c);
    return c;
  }

  // ---- making and letting go of people (a pool by kind: no figure made twice) --------------------
  spawn(kind, x, z, yaw = 0, role = 'walker', opts = {}) {
    const L = this.pool.get(kind);
    let p = null;
    while (L && L.length && !p) { const q = L.pop(); if (q.fig.alive) p = q; else q.dispose(); }
    if (p) {
      p.role = role;
      p.reset(x, z, yaw);
      if (opts.umbrella && !p.umb) { /* (an umbrella only on a figure made with one) */ }
      if (!opts.umbrella && p.umb) p.umb.group.visible = false, p.umb.state = 'rest';
    } else {
      p = new Person(this, { kind, x, z, yaw, role, umbrella: !!opts.umbrella });
      this.stats.made++;
    }
    p.role = role;
    this.list.push(p);
    this.stats.spawned++;
    return p;
  }
  release(p) {
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
    // [O3] after the critic (M1): a witness let go out of my sight on his way to
    // a box still gets there (his walk out of sight is not seen: the call comes
    // when he would have made it) - a report is never lost to the crowd's cap
    const rec = p.mode === 'report' && p.reportOf;
    if (rec && !rec.reported && p.reportTo && p.reportTo.box) {
      const b = p.reportTo.box, left = Math.hypot(b.x - p.pos.x, b.z - p.pos.z) / 3 + 2.6;
      this.later(left, () => { if (rec.reported) return; rec.reported = true; this.stats.reports++; this.police.report(rec, null, 'box'); });
    }
    if (p.onRelease) { const f = p.onRelease; p.onRelease = null; f(p); }
    p.hide();
    this.stats.released++;
    // (a dead man's figure is not used again: its skeleton is let go)
    if (!p.fig.alive) { p.dispose(); return; }
    // the pool: its figures hold no ink slot, and it holds at most POOL of
    // them (the oldest let go: a skeleton's bone texture, its mixer)
    p.giveSlot();
    if (!this.pool.has(p.kind)) this.pool.set(p.kind, []);
    this.pool.get(p.kind).push(p);
    p.pooledAt = this.t;
    let n = 0;
    for (const L of this.pool.values()) n += L.length;
    while (n > POOL) {
      let oldest = null, ok = null;
      for (const [k, L] of this.pool) for (const q of L) if (!oldest || q.pooledAt < oldest.pooledAt) { oldest = q; ok = k; }
      const L = this.pool.get(ok); L.splice(L.indexOf(oldest), 1);
      oldest.dispose(); n--;
      this.stats.disposed = (this.stats.disposed || 0) + 1;
    }
  }
  // the people near a point (a 4 m bucket grid, made each step)
  near(x, z, r, out = this._nearOut || (this._nearOut = [])) {
    out.length = 0;
    for (let i = Math.floor((x - r) / 4); i <= Math.floor((x + r) / 4); i++) for (let j = Math.floor((z - r) / 4); j <= Math.floor((z + r) / 4); j++) {
      const L = this.grid.get(i * 4096 + j);
      if (L) for (const p of L) out.push(p);
    }
    return out;
  }
  regrid() {
    this.grid.clear();
    for (const p of this.list) {
      const k = Math.floor(p.pos.x / 4) * 4096 + Math.floor(p.pos.z / 4);
      let L = this.grid.get(k);
      if (!L) this.grid.set(k, (L = []));
      L.push(p);
    }
  }

  // ---- what I see ---------------------------------------------------------------------------------
  // in my view: in front within the lens's width and not behind a building
  inView(x, z, eye = this.G.eye) {
    const cam = this.G.camera;
    cam.getWorldDirection(_f);
    const dx = x - eye.x, dz = z - eye.z, d = Math.hypot(dx, dz);
    if (d < 6) return true;
    const fl = Math.hypot(_f.x, _f.z) || 1;
    if ((dx * _f.x + dz * _f.z) / (d * fl) < 0.45) return false;
    return this.graph.lineOfSight(eye.x, eye.z, x, z);
  }
  sees(a, b, range) {
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    return d <= range && this.graph.lineOfSight(a.x, a.z, b.x, b.z);
  }

  // ---- ways on the pavements ------------------------------------------------------------------------
  nearestP(x, z) {
    let best = null, bd = Infinity;
    for (const p of this.pList) { const d = Math.abs(p.x - x) + Math.abs(p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  // a walk from a pavement node: n steps along the kerbs and over the crossings, never straight back
  pavWalk(node, n = 4) {
    const G = this.graph, out = [[node.x, node.z]];
    let prev = null, cur = node;
    for (let k = 0; k < n; k++) {
      let opts = cur.edges.map((e) => (e.a === cur.id ? e.b : e.a)).filter((id) => id !== (prev && prev.id));
      if (!opts.length) break;
      const id = opts[Math.floor(this.rng.next() * opts.length) % opts.length];
      prev = cur; cur = G.pnodes.get(id);
      if (!this.inWall(cur.x, cur.z)) out.push([cur.x, cur.z]);
    }
    return out;
  }
  // a way away from a point: along the pavements, each corner the one farther from it
  awayPath(pos, from, dist = 35) {
    const G = this.graph, out = [];
    let cur = this.nearestP(pos.x, pos.z);
    if (!cur) return [[pos.x + (pos.x - from.x), pos.z + (pos.z - from.z)]];
    const dFrom = (n) => Math.hypot(n.x - from.x, n.z - from.z);
    // (the first point: the corner of the nearest that is away from it, not back past it)
    const ax = pos.x - from.x, az = pos.z - from.z, al = Math.hypot(ax, az) || 1;
    let len = 0;
    const seen = new Set([cur.id]);
    if ((cur.x - pos.x) * ax + (cur.z - pos.z) * az < -0.5 * Math.hypot(cur.x - pos.x, cur.z - pos.z) * al) {
      // the nearest corner is toward the danger: out along its edge the other way
      let best = null, bs = -Infinity;
      for (const e of cur.edges) { const o = G.pnodes.get(e.a === cur.id ? e.b : e.a); const s = dFrom(o); if (s > bs) { bs = s; best = o; } }
      if (best) { cur = best; seen.add(cur.id); }
    }
    out.push([cur.x, cur.z]); len += Math.hypot(cur.x - pos.x, cur.z - pos.z);
    for (let k = 0; k < 6 && len < dist; k++) {
      let best = null, bs = -Infinity;
      for (const e of cur.edges) {
        const id = e.a === cur.id ? e.b : e.a;
        if (seen.has(id)) continue;
        const o = G.pnodes.get(id), s = dFrom(o) - dFrom(cur) + this.rng.next() * 3;
        if (s > bs) { bs = s; best = o; }
      }
      if (!best || bs < -2) break;
      len += Math.hypot(best.x - cur.x, best.z - cur.z);
      cur = best; seen.add(cur.id);
      out.push([cur.x, cur.z]);
    }
    return out;
  }
  // a point inside a building's walls (a corner of the walk that cuts a lot's corner)
  inWall(x, z, pad = 0.35) {
    for (const o of this.stage.colliders.near(x, z, 1)) {
      if (o.r != null || (o.tag !== 'wall' && o.tag !== 'edge' && o.tag !== 'stair')) continue;
      const dx = x - o.cx, dz = z - o.cz, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      if (Math.abs(lx) < o.hx + pad && Math.abs(lz) < o.hz + pad) return true;
    }
    return false;
  }
  callBoxNear(x, z, r = 220) {
    let best = null, bd = r;
    for (const b of this.boxes) { const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  // ---- the street reacts ---------------------------------------------------------------------------
  // kind: 'gun' (a gun out: run) 'shot' (scatter) 'fight' (back off, cower, watch)
  // 'body' / 'wreck' (gather, later) 'car' (a car among them: clear)
  alarm(kind, at, r = 20, { by = null, skip = null } = {}) {
    const E = this.G.eye;
    for (const p of this.list) {
      if (!p.standing || p === skip || p.role !== 'walker') continue;
      const d = Math.hypot(p.pos.x - at.x, p.pos.z - at.z);
      if (d > r) continue;
      const line = d < 6 || this.graph.lineOfSight(p.pos.x, p.pos.z, at.x, at.z);
      if (!line) continue;
      if (p.mode === 'report' && kind !== 'shot') continue;
      if (kind === 'gun') { if (p.mode !== 'flee') p.flee(by || E, 6 + Math.random() * 4); }
      else if (kind === 'shot') p.flee(at, 8 + Math.random() * 5);
      else if (kind === 'fight') {
        // (the ring: the near ones back off and cower, the others stop and watch)
        if (d < 5) p.flee(at, 1.6, { cry: false }), p.after = () => p.cower(at, 3 + Math.random() * 3);
        else if (this.rng.next() < 0.75) p.watch(at, 6 + Math.random() * 6);
        else p.flee(at, 4);
      } else if (kind === 'body' || kind === 'wreck') {
        if (p.mode === 'flee' || p.mode === 'report') continue;
        const a = Math.atan2(p.pos.x - at.x, p.pos.z - at.z) + (this.rng.next() - 0.5) * 0.8, rr = 4 + this.rng.next() * 3;
        p.mode = 'gather'; p.t = 0; p.gatherAt = { x: at.x, z: at.z };
        p.goTo({ x: at.x + Math.sin(a) * rr, z: at.z + Math.cos(a) * rr }, { gait: 'walk', then: (q) => { q.mode = 'stand'; q.watch(at, 10 + Math.random() * 8); } });
        p.mode = 'gather';
      }
    }
  }

  // a crime: the street sees it (src/police/crime.js emits through here)
  witness(rec, opts = {}) {
    const at = { x: rec.x, z: rec.z };
    const E = this.G.eye;
    const victim = opts.victim || null;
    if (rec.kind === 'menace') this.alarm('gun', at, 22, { by: E, skip: victim });
    else if (rec.kind === 'shot') this.alarm('shot', at, 45, { skip: victim });
    else if (rec.kind === 'punch' || rec.kind === 'assault') this.alarm('fight', at, 16, { skip: victim });
    else if (rec.kind === 'death' || rec.kind === 'cophurt') { this.alarm('shot', at, 30, { skip: victim }); this.later(9, () => this.alarm('body', at, 40)); }
    else if (rec.kind === 'hijack' || rec.kind === 'smash') this.alarm('fight', at, 12, { skip: victim });
    else if (rec.kind === 'wreck') this.later(5, () => this.alarm('wreck', at, 40));
    else if (rec.kind === 'body') this.later(6, () => this.alarm('body', at, 40));
    if (rec.by !== 'player' || !rec.level) return;
    // the police: a cop who sees it raises the heat at once
    if (this.police.witness(rec)) { rec.seen = 'cop'; return; }
    // a civilian who saw it goes to tell it (one, two for a death or a shot)
    // [O3] after the critic (M1): a shot is heard - a walker within HEAT.hear.civ
    // who ran from my gun or from the shot knows who it was (the draw does not
    // clear the witnesses: it makes them)
    const want = rec.level >= 2 ? 2 : 1;
    const loud = rec.kind === 'shot' || rec.kind === 'death' || rec.kind === 'cophurt';
    const G = this.G, cands = [];
    for (const p of this.list) {
      if (p.role !== 'walker' || !p.standing || p === victim || p.mode === 'report') continue;
      const d = Math.hypot(p.pos.x - rec.x, p.pos.z - rec.z);
      const saw = d <= SEE.civ && (d < 5 || this.graph.lineOfSight(p.pos.x, p.pos.z, rec.x, rec.z));
      const knew = loud && d <= HEAT.hear.civ && p.fledT != null && G.time - p.fledT < 30;
      if (!saw && !knew) continue;
      cands.push([d, p]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (const [, p] of cands.slice(0, want)) this.startReport(p, rec);
    if (cands.length) rec.seen = 'civ';
  }

  // the witness's walk: he looks at me, then goes for the box (or a cop in sight)
  startReport(p, rec) {
    const box = this.callBoxNear(p.pos.x, p.pos.z);
    // [O3] after the critic (M1): a cop in sight, or one on his beat within earshot
    // (100 m: he shouts for him, and the cop comes to meet him) when he is nearer
    // than the box - the answer within seconds where the beat walks
    const cop = this.police.copInSight(p.pos, 60) || this.police.copNear(p.pos, 100);
    const toCop = cop && (!box || Math.hypot(cop.pos.x - p.pos.x, cop.pos.z - p.pos.z) < Math.hypot(box.x - p.pos.x, box.z - p.pos.z) * 1.4);
    if (!box && !toCop) return;
    rec.reporters++;
    p.mode = 'report'; p.t = 0; p.reportOf = rec; p.reportTo = toCop ? { cop } : { box }; p.phase = 'look'; p.detour = false;
    // (a shooting: a glance and he runs for it; a punch: a look, then a jog - seen going, catchable)
    p.lookFor = rec.level >= 2 ? 0.5 : 0.9; p.reportGait = rec.level >= 2 ? 'run' : 'jog';
    p.path = null; p.setGait('idle', 0.15);
    p.face(this.G.eye.x, this.G.eye.z); p.look(this.G.eye);
    this.G.emit('witness', { who: p, rec, to: toCop ? 'cop' : 'box' });
  }
  // the witness's way to his box (made again if he wedges): the pavements, then the box's front
  boxWay(p) {
    // (the nearest box whose way along the pavements can be walked: every leg of it in
    // the clear - the pavement graph has a few legs that cut a block; up to three boxes tried)
    const way = (b) => { const R = this.graph.pavementRoute(p.pos, b); return R ? R.pts.filter(([x, z]) => !this.inWall(x, z)) : []; };
    const clear = (pts) => { let x = p.pos.x, z = p.pos.z; for (const [px, pz] of pts) { if (Math.hypot(px - x, pz - z) > 3 && !this.graph.lineOfSight(x, z, px, pz)) return false; x = px; z = pz; } return true; };
    let box = p.reportTo.box, pts = way(box);
    if (!clear(pts)) {
      const others = this.boxes.map((b) => [Math.hypot(b.x - p.pos.x, b.z - p.pos.z), b]).filter(([d, b]) => b !== box && d < 220).sort((a, b) => a[0] - b[0]).slice(0, 3);
      for (const [, b] of others) { const w = way(b); if (clear(w)) { box = b; pts = w; p.reportTo.box = b; break; } }
    }
    // (not back to a corner behind him)
    while (pts.length > 1 && Math.hypot(pts[0][0] - p.pos.x, pts[0][1] - p.pos.z) < 6 && Math.hypot(pts[1][0] - p.pos.x, pts[1][1] - p.pos.z) < Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])) pts.shift();
    // (out of the pavement's line to the box's front)
    const fx = box.x + Math.sin(box.yaw || 0) * 0.9, fz = box.z + Math.cos(box.yaw || 0) * 0.9;
    pts.push([fx, fz]);
    // (a jog: he is seen going, and a man who runs after him catches him)
    p.goTo(pts, { gait: p.reportGait || 'jog', then: (q) => { q.phase = 'call'; q.t = 0; q.face(box.x, box.z); q.say('o3_callbox'); } });
  }
  stepReport(p, dt) {
    const rec = p.reportOf, to = p.reportTo, E = this.G.eye;
    if (p.phase === 'look') {
      p.face(E.x, E.z);
      if (p.t > (p.lookFor || 0.9)) {
        p.look(null);
        p.phase = 'go';
        if (to.box) this.boxWay(p);
        else {
          // (he shouts for him as he goes - the cop turns and comes to meet him)
          p.say('o3_hey', { f0: 150 + Math.random() * 40 });
          to.cop.summonedBy = p; to.cop.summonedT = this.G.time;
          p.goTo({ x: to.cop.pos.x, z: to.cop.pos.z }, { gait: p.reportGait || 'jog' });
          p.copRouteT = 0;
        }
        p.mode = 'report';
      }
      return;
    }
    // caught: I come to his side - he gives it up (cowers, then walks off).
    // [O3] after the critic: caught by a man who came after him (moving), not by
    // one he passes as he goes (his way to the box can run by where I stand)
    const dE = Math.hypot(p.pos.x - E.x, p.pos.z - E.z);
    const V = this.G.controller.vel, mine = Math.hypot(V.x, V.z);
    if (mine > 1.0) p.chasedT = this.G.time;
    if (dE < 1.9 && p.t > 1.2 && this.G.time - (p.chasedT ?? -9) < 0.6) {
      p.caughtT = (p.caughtT || 0) + dt;
      if (p.caughtT > 0.35) { this.stopReport(p, 'caught'); p.cower(E, 4); return; }
    } else p.caughtT = 0;
    // a way to the box he cannot walk (he stands, wedged, his way used up in my sight):
    // off away from me along the pavements - out of my sight he is let go and still
    // calls (release); still in my sight at the end of that, he gives it up
    if (p.phase === 'go' && to.box && !p.path) {
      if (!p.detour) { p.detour = true; p.goTo(this.awayPath(p.pos, E, 40), { gait: p.reportGait || 'jog' }); p.mode = 'report'; }
      else { this.stopReport(p, 'lost'); return; }
    }
    if (p.phase === 'go' && to.cop) {
      const c = to.cop;
      // (the cop gone - down, in a fight, off his beat: another within earshot, or the box)
      if (!c.standing || c.mode === 'fight' || c.mode === 'gone' || !this.police.cops.includes(c)) {
        if (c.summonedBy === p) c.summonedBy = null;
        const c2 = this.police.copNear(p.pos, 100), box = this.callBoxNear(p.pos.x, p.pos.z);
        if (c2 && c2 !== c) { p.reportTo = { cop: c2 }; c2.summonedBy = p; c2.summonedT = this.G.time; p.path = null; p.copAt = null; }
        else if (box) { p.reportTo = { box }; p.phase = 'look'; p.t = p.lookFor || 0.9; }
        else this.stopReport(p, 'cop down');
        return;
      }
      // (straight to him where he can see him, by the pavements where he cannot: the
      // way made again only when he has moved on or it is walked)
      if (this.sees(p.pos, c.pos, 60)) { p.path = [[c.pos.x, c.pos.z]]; p.pi = 0; p.copAt = null; }
      else if (!p.path || p.pi >= p.path.length || !p.copAt || Math.hypot(c.pos.x - p.copAt.x, c.pos.z - p.copAt.z) > 6) {
        p.copAt = { x: c.pos.x, z: c.pos.z };
        const R = this.graph.pavementRoute(p.pos, c.pos);
        const pts = (R ? R.pts : []).concat([[c.pos.x, c.pos.z]]);
        // (not back to a corner behind him)
        while (pts.length > 1 && Math.hypot(pts[0][0] - p.pos.x, pts[0][1] - p.pos.z) < 6 && Math.hypot(pts[1][0] - p.pos.x, pts[1][1] - p.pos.z) < Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])) pts.shift();
        p.path = pts; p.pi = 0;
      }
      p.gait = p.reportGait || 'jog';
      if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 2.6) { p.phase = 'call'; p.t = 0; p.stop(); p.face(c.pos.x, c.pos.z); }
    }
    if (p.phase === 'call') {
      p.setGait('idle');
      if (p.t > (to.cop ? 1.4 : 2.6)) {
        if (to.cop) to.cop.summonedBy = null;
        this.stats.reports++;
        rec.reported = true;
        this.police.report(rec, p, to.cop ? 'cop' : 'box');
        // (the cop he told is the one who comes: to the place, then after me)
        if (to.cop && to.cop.standing && to.cop.job === 'beat') { to.cop.job = 'respond'; to.cop.mode = 'approach'; to.cop.t = 0; to.cop.path = null; to.cop.repath = 0; }
        this.stopReport(p, null);
        p.goTo(this.pavWalk(this.nearestP(p.pos.x, p.pos.z), 3), { gait: 'walk' });
      }
    }
    if (p.t > 70) this.stopReport(p, 'late');
  }
  stopReport(p, why) {
    if (p.reportTo && p.reportTo.cop && p.reportTo.cop.summonedBy === p) p.reportTo.cop.summonedBy = null;
    if (why) { this.stats.stopped++; this.G.emit('witness:stopped', { who: p, why }); }
    p.mode = 'walk'; p.reportOf = null; p.reportTo = null; p.phase = null; p.t = 0;
  }

  later(s, fn) { (this._later || (this._later = [])).push({ at: this.t + s, fn }); }

  // the player's shot (the revolver's, the Tommy gun's: Game 'shot'): a crime, and who it hit
  onShot(e) {
    const G = this.G;
    if (!G.city) return;
    const cam = G.camera;
    cam.getWorldDirection(_f);
    const o = cam.position.clone(), dir = _f.clone();
    const wallT = e && e.hit && e.hit.t != null && !e.hit.hood ? e.hit.t : 120;
    const figs = this.list.filter((p) => !p.dead && p.object.visible).map((p) => p.fig);
    const hit = figs.length ? G.rays.raycastHoods(o, dir, Math.min(120, wallT), figs) : null;
    this.crime.emit('shot', { x: G.eye.x, z: G.eye.z }, 'player');
    if (hit && !(e && e.hit && e.hit.hood && e.hit.t < hit.t)) {
      const p = hit.hood.person;
      if (p) this.shoot(p, hit, dir);
    }
  }
  // a round in a person: down; dead in the head or the second
  shoot(p, hit, dir) {
    const G = this.G;
    const head = hit.joint === 'head' || hit.joint === 'hat';
    G.fx.bloodFx.hit(hit.point, dir, { strength: head ? 1.3 : 1.05, rays: G.rays });
    p.hits++;
    const dead = head || p.hits >= 2 || p.down || Math.random() < 0.5;
    if (p.role === 'cop' || p.role === 'gang') { if (p.onShot && p.onShot(hit, dir, dead) === false) return; }
    p.knock(dir, { dead, why: 'shot' });
    if (p.role === 'cop') this.police.fists.dropGun(p);
    if (dead) { this.stats.killed++; G.sfx.death(p.pos.clone().setY(1.5)); } else G.sfx.grunt(p.pos.clone().setY(1.5));
    const kind = p.role === 'cop' ? 'cophurt' : dead ? 'death' : 'shot';
    if (kind !== 'shot') this.crime.emit(kind, p.pos, 'player', { victim: p });
    // (a gang man shot: the rest of his three draw)
    if (p.gang && !p.gang.war) this.gangs.hostile(p.gang, 'shot');
  }

  // ---- the crowd's own brain ---------------------------------------------------------------------
  // a walker's look: the district's table, by a seeded hash of where and when
  // (no two alike in a frame: a look met within 30 m is passed over)
  pedLook(x, z) {
    const dist = this.districtOf(x, z), n = this.stats.spawned;
    if (this.rng.next() < (CROWD.newsboy[dist] || 0)) return 'o3_newsboy';
    const T = PED_LOOKS[dist] || PED_LOOKS.downtown;
    // (a look waiting in the pool, if this street wears it and none of it is near: no figure made)
    if (this.rng.next() < 0.65) for (const [look, L] of this.pool) {
      if (!L.length || !T[look]) continue;
      if (!this.list.some((p) => p.kind === look && Math.hypot(p.pos.x - x, p.pos.z - z) < 30)) return look;
    }
    for (let k = 0; k < 4; k++) {
      const look = pickWeighted(T, hash(x, z, n, k));
      if (!this.list.some((p) => p.kind === look && Math.hypot(p.pos.x - x, p.pos.z - z) < 30)) return look;
    }
    return pickWeighted(T, hash(z, x, n));
  }
  copLook(n = 0) { const L = COP_LOOKS.concat(['o3_patrolman']); return L[Math.floor(hash(this.stats.spawned, n, 7) * L.length) % L.length]; }
  tecLook(n = 0) { return TEC_LOOKS[Math.floor(hash(this.stats.spawned, n, 9) * TEC_LOOKS.length) % TEC_LOOKS.length]; }
  gangLooks(gang, x, z) {
    const L = GANG_LOOKS[gang].concat([gang === 'docks' ? 'o3_docksman' : 'o3_tough']);
    // (three men, three looks: a seeded order of the four)
    const o = L.map((k, i) => [hash(x, z, i), k]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    return o.slice(0, 3);
  }

  districtOf(x, z) {
    const d = districtAt(x, z);
    return d ? d.id : 'downtown';
  }
  wanted() {
    const E = this.G.eye;
    const dist = this.districtOf(E.x, E.z);
    let n = CROWD.want[dist] ?? 8;
    // (the river road and the quay: a few)
    if (this.C.inWater && Math.abs(E.z - 432) < 25) n = CROWD.want.river;
    return Math.min(CROWD.cap, n);
  }
  walkers() { let n = 0; for (const p of this.list) if (p.role === 'walker') n++; return n; }

  spawnWalkers(dt) {
    if (this.hold) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 0.3;
    const want = this.wanted();
    if (this.walkers() >= want) return;
    const E = this.G.eye, R = CROWD.ring, G = this.graph;
    // (the pavements in the ring round me: a point along one of their edges, out of my sight)
    const cands = [];
    for (const n of this.pList) { const d = Math.hypot(n.x - E.x, n.z - E.z); if (d > R[0] - 25 && d < R[1] + 10) cands.push(n); }
    if (!cands.length) return;
    for (let tries = 0; tries < 12; tries++) {
      const n = cands[Math.floor(this.rng.next() * cands.length) % cands.length];
      const e = n.edges[Math.floor(this.rng.next() * n.edges.length) % n.edges.length];
      if (!e || e.kind === 'cross') continue;
      const o = G.pnodes.get(e.a === n.id ? e.b : e.a);
      const u = this.rng.next();
      const x = n.x + (o.x - n.x) * u, z = n.z + (o.z - n.z) * u;
      const d = Math.hypot(x - E.x, z - E.z);
      if (d < R[0] || d > R[1]) continue;
      if (this.inView(x, z)) continue;
      if (this.near(x, z, 2.5).length || this.inWall(x, z, 0.5)) continue;
      const kind = this.pedLook(x, z);
      const umb = kind !== 'o3_newsboy' && kind !== 'docker' && this.rng.next() < CROWD.umbrella;
      // (on along the edge one way or the other, then a walk on from there)
      const first = this.rng.next() < 0.5 ? o : n;
      const way = [[first.x, first.z], ...this.pavWalk(first, 5).slice(1)];
      const p = this.spawn(kind, x, z, 0, 'walker', { umbrella: umb });
      p.face(way[0][0], way[0][1]); p.fig.yaw = p.wantYaw; p.fig._prevYaw = p.wantYaw;
      p.goTo(way, { gait: kind === 'o3_newsboy' ? 'hurry' : this.rng.next() < 0.3 ? 'stroll' : 'walk' });
      p.mode = 'walk';
      p.drunk = false; p.pair = null; p.pairLead = null;
      const dist = this.districtOf(x, z), u2 = this.rng.next();
      // (now and then a drunk, in the Tenements and the Docks: slow, weaving)
      if ((dist === 'tenements' || dist === 'docks') && u2 < 0.12 && kind !== 'o3_newsboy' && !kind.startsWith('o3_woman') && kind !== 'couple_her') { p.drunk = true; p.paceK *= 0.75; p.gait = 'stroll'; }
      // (a couple under one umbrella, downtown and on the Hill: she at his side, his umbrella over them both)
      else if ((dist === 'downtown' || dist === 'hill') && u2 < 0.16 && umb && !kind.startsWith('o3_woman') && kind !== 'couple_her') {
        const herKind = this.rng.next() < 0.5 ? 'couple_her' : 'o3_woman_' + 'abcd'[Math.floor(this.rng.next() * 4) % 4];
        const q = this.spawn(herKind, x + Math.cos(p.yaw) * 0.6, z - Math.sin(p.yaw) * 0.6, p.yaw, 'walker');
        q.mode = 'walk'; q.pair = p; q.pairLead = false; p.pair = q; p.pairLead = true;
        q.goTo(way, { gait: p.gait }); q.side = p.side + 0.6;
      }
      return;
    }
  }

  stepWalker(p, dt) {
    const E = this.G.eye;
    const d = Math.hypot(p.pos.x - E.x, p.pos.z - E.z);
    // gone: far, and out of my sight a moment (a body stays while it is seen)
    if (d > CROWD.ring[1] + 4) {
      const seen = d < 120 && this.inView(p.pos.x, p.pos.z);
      p.outT = seen ? 0 : p.outT + dt;
      if (d > CROWD.gone && p.outT > 0.5 || p.outT > 5) { this.release(p); return false; }
    } else p.outT = 0;
    // [O3] after the critic (m5): a man knocked down, not dead, gets up after a few
    // seconds (lane O4's get-up clip), backs off from me and - if it was me who
    // put him down - goes to tell it (M1: the victim reports)
    if (!p.standing) { if (p.mode === 'down' && p.t > (p.upAfter || (p.upAfter = 3.5 + this.rng.next() * 2.5))) p.getUp(); return true; }
    if (p.mode === 'rise') { if (p.t > 1.45) this.afterUp(p); return true; }
    // (wedged - his way blocked a long while: out of my sight he goes; in it, back the way he came)
    if (p.stuckN >= 2) {
      p.stuckN = 0;
      if (!this.inView(p.pos.x, p.pos.z)) { this.release(p); return false; }
      // ([O3] after the critic: a witness wedged in my sight keeps his errand - he steps
      // round what stands there and goes on; out of my sight he is let go and still calls)
      if (p.mode !== 'report') p.goTo(this.awayPath(p.pos, { x: p.pos.x + Math.sin(p.yaw), z: p.pos.z + Math.cos(p.yaw) }, 20), { gait: 'walk' });
    }
    if (p.mode === 'report') { this.stepReport(p, dt); return true; }
    if (p.mode === 'flee') {
      if (!p.path || p.t > p.until) {
        if (p.after) { const f = p.after; p.after = null; f(p); return true; }
        if (p.t > p.until) { p.mode = 'walk'; p.goTo(this.awayPath(p.pos, p.from, 30), { gait: 'hurry' }); }
        else p.path = this.awayPath(p.pos, p.from, 30), p.pi = 0;
      }
      return true;
    }
    if (p.mode === 'cower' || p.mode === 'watch') {
      if (p.mode === 'watch' && p.watchAt) p.face(p.watchAt.x, p.watchAt.z);
      if (p.t > p.until) { p.mode = 'walk'; p.c.setState('idle', 0.3); p.gaitNow = 'idle'; p.goTo(this.pavWalk(this.nearestP(p.pos.x, p.pos.z), 4), { gait: 'walk' }); }
      return true;
    }
    if (p.mode === 'gather') { if (!p.path && p.t > 25) p.mode = 'walk'; return true; }
    if (p.mode === 'dash') {
      if (p.t > p.until) { p.mode = 'walk'; if (!p.path) p.goTo(this.pavWalk(this.nearestP(p.pos.x, p.pos.z), 4)); }
      return true;
    }
    if (p.mode === 'stand') {
      if (p.t > (p.until || 4)) { p.mode = 'walk'; p.goTo(this.pavWalk(this.nearestP(p.pos.x, p.pos.z), 5), { gait: 'walk' }); }
      return true;
    }
    // walking: at the end of the way, a stop at a spot near (a stop, a stall,
    // a bench, the call box) now and then, a look round, or on
    if (!p.path) {
      const r = this.rng.next();
      const spot = r < 0.35 ? this.spotNear(p.pos.x, p.pos.z, 26) : null;
      if (spot) {
        p.goTo([[spot.x, spot.z]], { gait: 'walk', then: (q) => { q.mode = 'stand'; q.t = 0; q.until = 6 + this.rng.next() * 14; q.stop(); q.watch({ x: spot.lx, z: spot.lz }, q.until); } });
      } else if (r < 0.5) { p.mode = 'stand'; p.t = 0; p.until = 3 + this.rng.next() * 6; p.stop(); if (this.rng.next() < 0.5) p.watch({ x: p.pos.x + Math.sin(p.yaw) * 5, z: p.pos.z + Math.cos(p.yaw) * 5 }, p.until); }
      else p.goTo(this.pavWalk(this.nearestP(p.pos.x, p.pos.z), 5), { gait: p.gait === 'run' ? 'walk' : p.gait });
    }
    // (a drunk weaves: his line wanders across the pavement)
    if (p.drunk && p.mode === 'walk') p.side = 0.6 + Math.sin(p.life * 0.9 + p.id) * 0.75;
    // (a couple keep together: she walks his way, at his side)
    if (p.pair && p.pair.standing && p.mode === 'walk' && p.pairLead === false) {
      const L = p.pair;
      if (L.path) { p.path = L.path; p.pi = L.pi; p.gait = L.gait; p.side = L.side + 0.6; }
      const lag = Math.hypot(L.pos.x - p.pos.x, L.pos.z - p.pos.z);
      p.paceK = lag > 1.2 ? 1.15 : lag < 0.6 ? 0.85 : 1;
    }
    return true;
  }
  // up on his feet: a few strides away from me, then the box (if it was me), or off
  afterUp(p) {
    const E = this.G.eye, rec = p.victimOf;
    p.victimOf = null; p.upAfter = null;
    p.mode = 'walk'; p.gaitNow = null; p.hits = 0;
    if (rec && !rec.reported && rec.reporters < 2 && this.G.time - rec.t < 90 && rec.by === 'player' && rec.seen !== 'cop' && !rec.heard) {
      p.flee(E, 2.2, { cry: false });
      p.after = (q) => { if (q.standing && !rec.reported) this.startReport(q, rec); };
    } else p.flee(E, 5, { cry: false });
  }
  // a spot to stand at near a place: a point on the pavement beside the thing, the thing to look at
  spotNear(x, z, r) {
    let best = null, bd = r;
    for (let i = Math.floor((x - r) / 32); i <= Math.floor((x + r) / 32); i++) for (let j = Math.floor((z - r) / 32); j <= Math.floor((z + r) / 32); j++) {
      for (const q of this.SB.get(i * 4096 + j) || []) {
        const d = Math.hypot(q.x - x, q.z - z);
        if (d >= bd || d < 3) continue;
        if (this.near(q.x, q.z, 1.6).length) continue;
        bd = d; best = q;
      }
    }
    if (!best) return null;
    // (beside it, toward the pavement's walk line; facing the street)
    const n = this.nearestP(best.x, best.z);
    const dx = n.x - best.x, dz = n.z - best.z, L = Math.hypot(dx, dz) || 1;
    const sx = best.x + dx / L * 1.1, sz = best.z + dz / L * 1.1;
    if (this.inWall(sx, sz, 0.3)) return null;
    const S = this.graph.streetAt(sx, sz);
    const lx = S ? S.edge.ax + S.edge.dx * S.s : sx + dx, lz = S ? S.edge.az + S.edge.dz * S.s : sz + dz;
    return { x: sx, z: sz, lx, lz, kind: best.kind };
  }

  // ---- cars among people: the dash clear, and a car that hits ------------------------------------
  stepCars(dt) {
    const V = this.G.vehicles ? this.G.vehicles.list : [];
    for (const v of V) {
      const sp = Math.hypot(v.vel.x, v.vel.z);
      if (sp < 1.2) continue;
      const c = Math.cos(v.yaw), s = Math.sin(v.yaw), hl = v.spec.halfL, hw = v.spec.halfW;
      for (const p of this.near(v.pos.x, v.pos.z, sp * 1.2 + 6)) {
        if (!p.standing && !p.down) continue;
        // in its box now: hit (down, or dead over 9 m/s)
        const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (p.standing && Math.abs(lx) < hl + p.r * 0.6 && Math.abs(lz) < hw + p.r * 0.6) { this.hitByCar(p, v, sp); continue; }
        // [O3] after the critic: a man lying in the road is solid to a car (not to feet):
        // shoved out of its way to the side he lies on, the car jolted a little
        if (!p.standing && Math.abs(lx) < hl + 0.3 && Math.abs(lz) < hw + 0.3) {
          const sd = lz >= 0 ? 1 : -1, out = hw + 0.45 - Math.abs(lz);
          // (local z is the car's right: world (-s, c)... the side he lies on, out of the box)
          p.fig.pos.x += s * sd * out; p.fig.pos.z += c * sd * out;
          this.stage.colliders.resolve(p.fig.pos, 0.3);
          if (p.fig.object) { p.fig.object.position.x = p.fig.pos.x; p.fig.object.position.z = p.fig.pos.z; }
          v.vel.multiplyScalar(0.97);
          if (this.G.time - (p.shoveT ?? -9) > 0.6) { p.shoveT = this.G.time; if (this.G.sfx) this.G.sfx.play('c3_dent', p.pos.clone().setY(0.4), { k: Math.min(0.6, sp / 20) }, { ref: 3 }); }
          continue;
        }
        if (!p.standing || p.mode === 'dash' || (p.role !== 'walker' && p.role !== 'cop')) continue;
        // coming at him in the next second: the dash clear (the tail's rule)
        let tHit = null;
        for (const tt of [0.25, 0.5, 0.8, 1.1]) {
          const fx = dx - v.vel.x * tt, fz = dz - v.vel.z * tt;
          const ax = fx * c - fz * s, az = fx * s + fz * c;
          if (Math.abs(ax) < hl + 1.0 && Math.abs(az) < hw + 1.0) { tHit = tt; break; }
        }
        if (tHit == null) continue;
        // (too late to clear: a man needs a third of a second to see it and
        // start; a car coming over 18 m/s gives him less than 0.6 s - the driver's doing)
        if (tHit < 0.35 || (tHit < 0.6 && sp > 18)) continue;
        const side = lz >= 0 ? 1 : -1;
        let rx = s * side, rz = c * side;
        const T = this.stage.track, J = 2.6;
        if (T.blocked(p.pos.x, p.pos.z, p.pos.x + rx * J, p.pos.z + rz * J, ['wall', 'fence', 'rail', 'barrier'])) { rx = -rx; rz = -rz; }
        p.mode = 'dash'; p.t = 0; p.until = 1.6; p.path = [[p.pos.x + rx * J, p.pos.z + rz * J]]; p.pi = 0; p.gait = 'run';
        p.fig.yaw = Math.atan2(rx, rz); p.wantYaw = p.fig.yaw;
        this.stats.dashes++;
        if (Math.random() < 0.5) p.say('o3_hey');
      }
    }
  }
  hitByCar(p, v, sp) {
    const dir = new THREE.Vector3(v.vel.x, 0, v.vel.z).normalize();
    const dead = sp > 9;
    // (thrown along the car's way a little, onto the street)
    p.fig.pos.x += dir.x * Math.min(2.5, sp * 0.12); p.fig.pos.z += dir.z * Math.min(2.5, sp * 0.12);
    this.stage.colliders.resolve(p.fig.pos, 0.3, p.fig.collider);
    p.knock(dir.clone().negate(), { dead, why: 'car', by: v === this.G.vehicles.player ? 'player' : 'traffic' });
    this.stats.hitByCar++;
    if (this.G.sfx) { this.G.sfx.play('c3_dent', p.pos.clone().setY(0.8), { k: Math.min(1, sp / 14) }, { ref: 4 }); this.G.sfx.grunt(p.pos.clone().setY(1.2)); }
    // (the car takes it: a jolt off its speed)
    v.vel.multiplyScalar(dead ? 0.82 : 0.9);
    if (v === this.G.vehicles.player && this.G.controller.shake) this.G.controller.shake(0.25, 0);
    if (p.role === 'cop') this.police.fists.dropGun(p);
    if (v === this.G.vehicles.player) {
      const kind = p.role === 'cop' ? 'cophurt' : dead ? 'death' : 'punch';
      const rec = this.crime.emit(kind, p.pos, 'player', { victim: p });
      // (a man knocked down, not dead, tells it himself once he is up)
      if (!dead && rec) p.victimOf = rec;
    }
  }

  // ---- I walk into them: they give way (a shoulder, a word) ---------------------------------------
  stepBumps() {
    const G = this.G;
    if (G.city && G.city.inCar) return;
    const E = G.eye, V = G.controller.vel, sp = Math.hypot(V.x, V.z);
    for (const p of this.near(E.x, E.z, 1.4)) {
      if (!p.standing) continue;
      // (a gang man shouldered at a run: he turns and squares up - the fist fight)
      if (p.role === 'gang') {
        const d = Math.hypot(p.pos.x - E.x, p.pos.z - E.z);
        if (sp > 2.6 && d < p.r + 0.7 && !p.armed && !this.police.fists.active && !(p.gang && p.gang.war)) { p.say('o3_hey', { f0: 100 }); this.crime.emit('punch', p.pos, 'player', { victim: p, level: 0 }); this.gangs.stats.fights++; this.police.fists.start(p, { why: 'push' }); }
        continue;
      }
      const dx = p.pos.x - E.x, dz = p.pos.z - E.z, d = Math.hypot(dx, dz);
      if (d > p.r + 0.62 || sp < 1.5) continue;
      if ((dx * V.x + dz * V.z) / (d * sp) < 0.4) continue;
      // (pushed aside, out of my way: the flinch and a word)
      if (G.time - (p.bumpT ?? -9) < 1.2) continue;
      p.bumpT = G.time;
      const side = (V.x * dz - V.z * dx) >= 0 ? 1 : -1;
      const px = -V.z / sp * side, pz = V.x / sp * side;
      p.fig.pos.x += px * 0.35; p.fig.pos.z += pz * 0.35;
      p.fig.flinch(new THREE.Vector3(V.x, 0, V.z).normalize());
      if (sp > 4 || Math.random() < 0.35) p.say('o3_hey');
      p.look(E);
      this.stats.bumps = (this.stats.bumps || 0) + 1;
      G.emit('people:bump', { who: p, speed: sp });
    }
  }

  // ---- one step ------------------------------------------------------------------------------------
  step(dt) {
    const G = this.G;
    if (G.state !== 'playing' || G.failing && G.failing.phase === 'black') { this.regrid(); return; }
    this.t += dt;
    if (this._later) for (let i = this._later.length - 1; i >= 0; i--) if (this.t >= this._later[i].at) { const L = this._later.splice(i, 1)[0]; L.fn(); }
    this.regrid();
    this.hands.step(dt);
    this.spawnWalkers(dt);
    for (const p of [...this.list]) {
      if (p.role === 'walker' && !this.stepWalker(p, dt)) continue;
      if (p.role === 'cop') this.police.stepCop(p, dt);
      if (p.role === 'gang') this.gangs.stepMan(p, dt);
      if (p.mode === 'gone' || p.mode === 'fight') continue;
      p.step(dt);
    }
    this.stepCars(dt);
    this.stepBumps();
    this.police.step(dt);
    this.gangs.step(dt);
    // the poses: every step for the near ones; past 38 m every other step
    // (their time kept: a far man in the fog moves at 30 Hz, half the cost)
    const cam = G.camera, t = G.time, E = G.eye;
    this.frame = (this.frame || 0) + 1;
    for (const p of this.list) {
      const far = dt > 0 && Math.abs(p.pos.x - E.x) + Math.abs(p.pos.z - E.z) > 52 && p.pos.distanceToSquared(E) > 38 * 38;
      if (far && ((this.frame + p.id) & 1)) { p.owed = (p.owed || 0) + dt; continue; }
      p.update(dt + (p.owed || 0), t, cam);
      p.owed = 0;
    }
  }
}
