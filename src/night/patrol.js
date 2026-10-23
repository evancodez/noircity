import * as THREE from 'three';
import { crowdOf } from '../combat/brawl/Crowd.js';
import { gunsOf } from '../guns/Guns.js';

// [O7] after the critic (B1: 'the heat cannot be lost, and nobody comes'): the
// stand-in police's answer, until O3's police system is in main. Somebody
// comes, and the heat is lost by being out of their sight - never by a clock
// alone. Built only of what main has: O4's cop (the crowd brawl's 'cop', who
// ends a fist fight with 'Hands up.') and O4's police gunmen (the gun kit's
// pistols in the police cap).
//   heat 1     a beat cop on foot, on the street within about 10 s, running at
//              me from a pavement corner out of my view; at arm's length
//              'Hands up.' (the kit's warning) and O4's fist fight with him:
//              down to him is the arrest (the black says 'Hands up.', the
//              station's cell); him down is a cop hurt (heat 4); walked off
//              30 m he gives up ('He's gone.'); a gun drawn on him: he runs
//   heat 2+    the siren first, then two police gunmen (three at heat 3 and up:
//              a detective with a Tommy gun), the gun kit's men in the open
//              city (cover from the world, the raise and the glint); down to
//              them is the station too; a man of theirs down is a cop hurt
//   the sight  a unit within 42 m with no building between (the graph's
//              lineOfSight) sees me, unless I am inside a place; while one
//              does, the quiet clock stands at 0 (police.seen)
//   the search out of every unit's sight the clock runs (standins.js LOSE): the
//              search, then a badge a while; while they search nobody new is
//              sent, the ones out look where they last saw me; seen again:
//              'Lose them.' and they come again
//   heat 0     they go off (out of my view, or a few seconds)
// G.police.units: [{ pos, kind }] (the minimap's and the map's cop marks).
export const PATROL = {
  first: [6.5, 8.5],         // s after the heat rose from 0: the first unit (heat 1: the beat cop)
  siren: 2.4,                // heat 2+: the siren this long before the men
  next: 2.2,                 // s between two units
  want: [0, 1, 2, 2, 3, 3],  // units out, by the heat
  spawn: [30, 52],           // m from me
  sight: 42,                 // m: within it, with no building between, a unit sees me
  drop: 120,                 // m: a unit this far off is gone
  again: 14,                 // s after a unit is down before the next comes
  cop: { run: 4.3, walk: 1.5, reach: 2.7, wait: 1.1, cone: 0.3 },
  area: 34,                  // the gunmen's encounter: a box this far round where it began
};
const _v = new THREE.Vector3();
// the gun kit's one encounter in the street, shared by the night's men (the police's, the wanted man):
// begun by the first, ended when the last lets go; a place's own (a hideout) is never taken over
export function kitUse(night, owner, cfg) {
  const K = gunsOf(night.game), U = night.kitUsers || (night.kitUsers = new Set());
  if (K.active && !U.size) return null;
  if (!K.active) { K.begin({ world: true, ...cfg }); U.clear(); }
  U.add(owner);
  return K;
}
export function kitFree(night, owner) {
  const K = gunsOf(night.game), U = night.kitUsers;
  if (!U || !U.has(owner)) return;
  U.delete(owner);
  if (!U.size && K.active) K.end();
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Patrol {
  constructor(night) {
    this.night = night;
    this.units = [];
    this.t = 0; this.nextAt = Infinity; this.sirenAt = null; this.lastSeen = null; this.kitMine = false;
    this.downAt = -99;
    const G = night.game;
    // (a fall ends them: the black clears the street - the arrest and the hospital clear the heat too)
    // (any other fall - the river, thrown out of a bar - they lost me in it: the search)
    G.on('fail', (e) => { this.dropAll(); const P = G.police; if (!P || !P.stand || !e) return; if ((e.to === 'station' || e.to === 'hospital') && P.clear) P.clear(); else if (P.heat > 0 && P.lost) P.lost(); });
    // (a scene entered with the heat on and nobody searching: they are sent again)
    G.on('scene:enter', () => { this.dropAll(); const P = G.police; if (P && P.stand && P.heat > 0 && !P.searching) this.dispatch(P.heat, 0); });
    G.on('night:start', () => this.dropAll());
  }
  get G() { return this.night.game; }

  // the heat rose from 0 (or was found again after a search): the units on their way
  dispatch(heat, was) {
    const G = this.G;
    if (was > 0 && this.units.length) { this.nextAt = Math.min(this.nextAt, G.time + PATROL.next); return; }
    const [a, b] = PATROL.first;
    this.nextAt = G.time + (heat >= 2 ? PATROL.siren + 1.2 : a + Math.random() * (b - a));
    if (heat >= 2) this.sirenAt = G.time;
  }

  // one fixed step (the stand-in police's): who sees me; the units' feet; more sent
  step(dt) {
    const N = this.night, G = this.G, P = G.police;
    this.t += dt;
    const heat = P ? P.heat | 0 : 0;
    const e = G.eye, R = G.city;
    const inside = !!(R && R.places && R.places.inside);
    // the siren: heard before they are seen
    if (this.sirenAt != null && G.time >= this.sirenAt) {
      this.sirenAt = null;
      const a = Math.atan2(-Math.sin(G.controller.yaw), -Math.cos(G.controller.yaw)) + Math.PI + (Math.random() - 0.5);
      if (G.sfx) G.sfx.play('n_siren', _v.set(e.x + Math.sin(a) * 70, 4, e.z + Math.cos(a) * 70), { k: 1 }, { ref: 40, roll: 0.5, max: 400, street: true });
    }
    let seen = false;
    for (const u of [...this.units]) {
      if (!this.alive(u)) { this.lost(u, u.removed ? 'gone' : 'down'); continue; }
      const p = u.pos, d = Math.hypot(p.x - e.x, p.z - e.z);
      if (d > PATROL.drop) { this.remove(u); continue; }
      u.sees = !inside && heat > 0 && d < PATROL.sight && this.los(p, e);
      if (u.fight) u.sees = true;
      if (u.sees) { seen = true; u.last = { x: e.x, z: e.z }; this.lastSeen = { x: e.x, z: e.z, t: G.time }; }
      if (u.kind === 'cop') this.stepCop(u, dt, heat);
      else if (heat <= 0) this.goOff(u, dt);
    }
    if (this.kitMine) {
      const K = gunsOf(G);
      if (!this.units.some((u) => u.kind === 'gun')) { kitFree(N, 'police'); this.kitMine = false; }
    }
    // the gun kit's warning before a fall, while the street's encounter is on (O4's shootout does the same)
    {
      const K = gunsOf(G), mine = N.kitUsers && N.kitUsers.size > 0 && K.active;
      const w = mine ? K.warning() : null;
      if (w || this.warned) { if (w !== G.hud.warnText && (w || this.warned === G.hud.warnText)) G.hud.warn(w); this.warned = w || null; }
    }
    // more sent while the heat is on and they are not searching
    if (heat > 0 && P && !P.searching && G.time >= this.nextAt && !G.failing && N.inCity) {
      const want = PATROL.want[Math.min(5, heat)];
      if (this.units.filter((u) => this.alive(u)).length < want && G.time - this.downAt > PATROL.again * (this.units.length ? 1 : 0)) {
        const kind = heat >= 2 ? 'gun' : 'cop';
        const u = this.send(kind, heat);
        this.nextAt = G.time + (u ? PATROL.next : 1.0);
      } else this.nextAt = G.time + 0.5;
    }
    if (heat <= 0) this.nextAt = Infinity;
    if (P) { P.seen = seen; P.units = this.units.map((u) => ({ pos: u.pos, kind: u.kind })); }
    return seen;
  }

  // a clear line: near, and no building between (the graph's 2D test; the gun kit's eyes for its own men)
  los(p, e) {
    const g = this.night.graph();
    if (g && g.lineOfSight(p.x, p.z, e.x, e.z) === false) return false;
    return true;
  }
  alive(u) { return u.kind === 'cop' ? !!(u.c && u.c.alive && !u.removed) : !!(u.h && u.h.alive && !u.removed); }

  // a pavement corner 30 - 52 m from me, out of my view if it can be, with a clear line to me (he runs straight in)
  spot() {
    const G = this.G, g = this.night.graph(), e = G.eye, C = this.night.C();
    if (!g) return null;
    const f = G.camera.getWorldDirection(_v);
    const fl = Math.hypot(f.x, f.z) || 1;
    const [r0, r1] = PATROL.spawn;
    const cands = [];
    for (const n of g.pnodes.values()) {
      const d = Math.hypot(n.x - e.x, n.z - e.z);
      if (d < r0 || d > r1) continue;
      if (C && C.inWater && C.inWater(n.x, n.z)) continue;
      const look = ((n.x - e.x) * f.x + (n.z - e.z) * f.z) / (d * fl);
      const clear = g.lineOfSight(n.x, n.z, e.x, e.z) !== false;
      cands.push({ n, score: (look < 0.35 ? 2 : 0) + (clear ? 1 : 0) + Math.random() * 0.5 });
    }
    cands.sort((a, b) => b.score - a.score);
    return cands.length ? cands[0].n : null;
  }

  send(kind, heat) {
    const G = this.G, n = this.spot(), e = G.eye;
    if (!n) return null;
    const yaw = Math.atan2(e.x - n.x, e.z - n.z);
    let u = null;
    if (kind === 'cop') {
      let c = null;
      try { c = G.cast.spawn('o4_cop', { at: { x: n.x, z: n.z }, yaw, name: 'beatcop' + (this.made = (this.made || 0) + 1) }); } catch (err) { return null; }
      c.noGlance = true;
      try { c.setState('run', 0.2); } catch (err) { /* */ }
      u = { kind, c, get pos() { return c.pos; }, state: 'come', t: 0, last: { x: e.x, z: e.z } };
    } else {
      const A = PATROL.area;
      if (!gunsOf(G).active) G.stage.part('bounds').navAround(e.x, e.z, A + 6);
      const K = kitUse(this.night, 'police', { area: { x0: e.x - A, x1: e.x + A, z0: e.z - A, z1: e.z + A }, to: 'station', maxFiring: 2, flankAfter: 16, settleK: 1.3, dmgK: 0.75,
        why: { open: 'Shot standing in the open.', moving: 'Shot in the open.', bare: 'Down in the open. Get behind something.' } });
      if (!K) return null;   // (a hideout's fight is on: its own men)
      this.kitMine = true;
      const ng = this.units.filter((x) => x.kind === 'gun').length;
      const tommy = heat >= 3 && ng === 2;
      // (they run in to a point a dozen metres short of me, on their side, then fight from the world's cover)
      const k = Math.min(1, 12 / Math.max(1, Math.hypot(e.x - n.x, e.z - n.z)));
      const to = { x: e.x + (n.x - e.x) * k, z: e.z + (n.z - e.z) * k, run: true };
      const h = K.spawn({ kind: tommy ? 'tommy' : 'pistol', at: { x: n.x, z: n.z }, way: { steps: [to] }, cover: true, yaw,
        variant: tommy ? { coat: 0, brim: 1, tall: 1, heavy: true } : { coat: 1, brim: 1, tall: ng % 2, cap: 'police' } });
      h.nightUnit = true;
      u = { kind, h, get pos() { return h.pos; }, state: 'come', t: 0, last: { x: e.x, z: e.z } };
    }
    this.units.push(u);
    G.emit('police:unit', { kind, at: { x: n.x, z: n.z } });
    return u;
  }

  // the beat cop: runs at me (or where he last saw me); at arm's length 'Hands up.', then the fist fight
  stepCop(u, dt, heat) {
    const G = this.G, c = u.c, e = G.eye, R = G.city, F = crowdOf(G);
    if (u.fight) return;   // (the crowd brawl moves him)
    u.t += dt;
    if (heat <= 0) { this.goOff(u, dt); return; }
    const goal = u.sees ? e : u.last;
    const dx = goal.x - c.pos.x, dz = goal.z - c.pos.z, d = Math.hypot(dx, dz);
    const me = Math.hypot(e.x - c.pos.x, e.z - c.pos.z);
    const onFoot = !(R && R.inCar) && !(R && R.places && R.places.inside) && !F.active && !G.failing;
    if (u.state === 'hands') {
      u.t2 += dt;
      this.face(c, Math.atan2(e.x - c.pos.x, e.z - c.pos.z), dt);
      if (!onFoot || me > 6) { u.state = 'come'; if (G.hud.warnText === 'Hands up.') G.hud.warn(null); return; }
      if (u.t2 >= PATROL.cop.wait) this.fight(u);
      return;
    }
    if (u.sees && onFoot && me < PATROL.cop.reach) {
      u.state = 'hands'; u.t2 = 0;
      try { c.setState('idle', 0.15); } catch (err) { /* */ }
      c.speed = 0;
      G.hud.warn('Hands up.');
      return;
    }
    if (d < 1.2) { if (c.state !== 'idle') { try { c.setState('idle', 0.3); } catch (err) { /* */ } } c.speed = 0; return; }
    const sp = u.sees ? PATROL.cop.run : PATROL.cop.walk * 1.6;
    const want = Math.atan2(dx, dz);
    if (u.ang == null || u.sees) u.ang = want;
    const x0 = c.pos.x, z0 = c.pos.z;
    const p = _v.set(x0 + Math.sin(u.ang) * sp * dt, 0, z0 + Math.cos(u.ang) * sp * dt);
    const col = c.fig && c.fig.collider;
    G.stage.colliders.resolve(p, col ? col.r : 0.35, col);
    // (a wall in his way: round it, the side he turned first)
    if (Math.hypot(p.x - x0, p.z - z0) < sp * dt * 0.3) u.ang += (u.side || (u.side = Math.random() < 0.5 ? -1 : 1)) * 2.4 * dt; else if (!u.sees) u.ang += wrap(want - u.ang) * Math.min(1, dt * 1.5);
    c.pos.x = p.x; c.pos.z = p.z;
    if (c.object) { c.object.position.x = p.x; c.object.position.z = p.z; }
    this.face(c, u.ang, dt);
    const st = u.sees ? 'run' : 'walk';
    if (c.state !== st) { try { c.setState(st, 0.2); } catch (err) { /* */ } }
    c.speed = sp;
  }
  face(c, yaw, dt) { const dy = wrap(yaw - c.yaw); c.yaw = wrap(c.yaw + Math.sign(dy) * Math.min(Math.abs(dy), 7 * dt)); }

  // O4's fist fight with the cop: down to him is the arrest
  fight(u) {
    const G = this.G, F = crowdOf(G);
    if (F.active) return;
    if (G.hud.warnText === 'Hands up.') G.hud.warn(null);
    u.fight = true; u.state = 'fight';
    F.start({ men: [{ kind: 'cop', c: u.c, name: 'COP' }], leave: true, seed: 8800 + (this.made || 0),
      onDown: () => ({ why: 'Hands up.', to: 'station' }),
      onEnd: (r) => {
        u.fight = false;
        // (him down: a cop hurt - the heat at 4, the gunmen; walked off: he gave up; a gun drawn: he ran)
        if (r === 'won') { u.out = true; this.downAt = G.time; if (G.crime) G.crime.emit('cop', { x: u.c.pos.x, z: u.c.pos.z }, 'me'); }
        else if (r === 'left' || r === 'drawn') u.removed = true;
      } });
    G.emit('police:arrest', { stage: 'fight' });
  }

  // heat 0: they go off - out of my view, or a few seconds
  goOff(u, dt) {
    const G = this.G;
    u.offT = (u.offT || 0) + dt;
    if (u.kind === 'cop' && !u.fight && u.c && u.c.alive) {
      const c = u.c;
      if (!u.offAng) { u.offAng = Math.atan2(c.pos.x - G.eye.x, c.pos.z - G.eye.z) + 0.001; try { c.setState('walk', 0.3); } catch (err) { /* */ } }
      const p = _v.set(c.pos.x + Math.sin(u.offAng) * PATROL.cop.walk * dt, 0, c.pos.z + Math.cos(u.offAng) * PATROL.cop.walk * dt);
      G.stage.colliders.resolve(p, 0.35, c.fig && c.fig.collider);
      c.pos.x = p.x; c.pos.z = p.z; if (c.object) { c.object.position.x = p.x; c.object.position.z = p.z; }
      this.face(c, u.offAng, dt); c.speed = PATROL.cop.walk;
    }
    const f = G.camera.getWorldDirection(_v), p = u.pos, d = Math.hypot(p.x - G.eye.x, p.z - G.eye.z);
    const inView = d < 60 && ((p.x - G.eye.x) * f.x + (p.z - G.eye.z) * f.z) / (d * (Math.hypot(f.x, f.z) || 1)) > 0.5;
    if ((!inView && u.offT > 1.5) || u.offT > 9) this.remove(u);
  }

  // a unit down (his body stays) or gone
  lost(u, why) {
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    if (why === 'down' && !u.counted) {
      u.counted = true; this.downAt = this.G.time;
      // (a policeman shot down by me: a cop hurt - the gun kit's men are hoods; the beat cop a fist fight's or a round's)
      if (u.kind === 'gun' && u.h && !u.removed && this.G.crime) this.G.crime.emit('cop', { x: u.h.pos.x, z: u.h.pos.z }, 'me');
    }
  }
  remove(u) {
    const G = this.G;
    u.removed = true;
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    try {
      if (u.kind === 'cop') { if (!u.fight && u.c) G.cast.remove(u.c); }
      else if (u.h && u.h.alive) G.removeHood(u.h);
    } catch (e) { /* gone with the stage */ }
  }
  dropAll() {
    for (const u of [...this.units]) this.remove(u);
    this.units = [];
    this.nextAt = Infinity; this.sirenAt = null;
    if (this.kitMine) { kitFree(this.night, 'police'); this.kitMine = false; }
    if (this.warned) { if (this.G.hud.warnText === this.warned) this.G.hud.warn(null); this.warned = null; }
    const P = this.G.police; if (P) { P.units = []; P.seen = false; }
  }
  // (an interior or the el lost me: they stop where they are; the ones in view go off)
  shake() { for (const u of [...this.units]) if (!u.fight) this.remove(u); }

  // a round of mine (the 'shot' event) at the beat cop standing (a cast figure: the gun kit's rays are the hoods')
  shotAt() {
    const G = this.G;
    for (const u of this.units) {
      if (u.kind !== 'cop' || u.fight || !this.alive(u)) continue;
      if (rayHits(G, u.c.pos)) {
        if (G.fx && G.fx.bloodFx) G.fx.bloodFx.hit(_v.set(u.c.pos.x, 1.3, u.c.pos.z), G.camera.getWorldDirection(new THREE.Vector3()), { strength: 1.1, rays: G.rays });
        u.c.ko('deathBack');
        this.lost(u, 'down');
        if (G.crime) G.crime.emit('cop', { x: u.c.pos.x, z: u.c.pos.z }, 'me');
        return true;
      }
    }
    return false;
  }
}

// a ray from the eye along the view: does it pass through a man standing at p (a cylinder 0.34 round, 0.1 - 1.85 high) before a wall?
export function rayHits(G, p, far = 60) {
  const cam = G.camera, o = cam.position, d = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
  const L2 = d.x * d.x + d.z * d.z || 1e-6;
  const t = ((p.x - o.x) * d.x + (p.z - o.z) * d.z) / L2;
  if (t <= 0 || t > far) return false;
  const hx = o.x + d.x * t - p.x, hz = o.z + d.z * t - p.z, y = o.y + d.y * t - (p.y || 0);
  if (Math.hypot(hx, hz) > 0.36 || y < 0.1 || y > 1.85) return false;
  const tl = t * Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
  return !G.rays.raycast(o, d.clone(), tl * 0.98);
}
