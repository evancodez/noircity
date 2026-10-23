import * as THREE from 'three';
import { SEE } from './crime.js';
import { PatrolCar } from './Patrol.js';
import { Badges } from './badges.js';
import { copGuns } from './standins.js';
import { streetFists } from './fists.js';

// [O3] The police system (lane O3, NOIR CITY): the spine of the city's
// answer. HEAT 0 to 5 (police.heat), raised by a crime seen (src/police/
// crime.js: a cop sees it at once; a civilian runs to a call box or a cop
// and tells it), answered by level, each answer seen coming:
//   1  a beat cop walks over: 'Hands up.' - fists, or run
//   2  a patrol car with two men, the siren heard before it is seen
//   3  two cars, and a roadblock on the road I am on (two cars nose to nose
//      across it, men behind them)
//   4  detectives with Tommy guns, a car from the side (the gun kit's men)
//   5  everything, and the riot squad's lorry
// HUNT while they see me (a cop in line of sight within 45 m, a car within
// 60 m); out of their sight the SEARCH (shown: the siren drops to a yelp,
// the cars prowl near where I was last seen, the badges blink); out of their
// sight long enough (LOSE: 20 s at 1 .. a minute at 3 .. 90 s at 5) it is
// lost: 'Clear.' Found again in the search: the heat as it was. A change of
// car where nobody sees it (police.changedCar(), O2's hijack) or a door shut
// behind me (police.lost(), O5's interiors) loses it at once, unseen.
// The ARREST is the fail when they have me: on foot a cop within 3 m with a
// line and me not running (or two within 3 m), or down in a fist fight with
// a cop; in the car, boxed - two of their cars on me (or a car and a man at
// my door) and me stopped. The warning 'Hands up.' comes first (2 s on foot,
// 4 s boxed: time to run or fight), then the black ('Arrested.') and I wake
// at the police station (the city's 'station' beat): the gun gone, the heat
// gone, the car gone, the money less a fine.
//   police.heat   police.on('heat', fn(heat, prev))   police.off
//   police.state  'clear' | 'hunt' | 'search'
//   police.raise(level, at, why)   police.report(rec, who, how)   police.witness(rec)
//   police.lost()   police.changedCar()   police.clear()
//   police.events   the record (the plays read it)
export const HEAT = {
  lose: [0, 20, 32, 60, 70, 80],     // s out of their sight to lose it, by level
  sight: { foot: 36, car: 55, carSearch: 42 },   // how far they see me (m), in line of sight (night, the rain; a car prowling sees less)
  wind: { sprint: 10, rest: 6 },     // a man on foot sprints this long, then runs until he has his breath (s)
  searchAfter: 2.5,                  // s unseen before the search begins (the siren drops)
  // [O3] after the critic (M3): 2 s from 'Hands up.' to the cuffs on foot (1.3 was
  // cuffed before a man who stopped to read the words could act)
  arrest: { r: 3.0, warn: 2.0, box: 4.0, boxR: 9 },
  // the answer, by level: men on foot, cars, a roadblock, detectives, the lorry
  cars: [0, 0, 1, 2, 2, 3],
  fine: 50,
  // (a crime seen while they already hunt me adds to the pressure: a whole
  // level more once it passes 1; at most once in pressGap s - a volley of six
  // shots is one shooting, not four levels)
  press: 0.4, pressGap: 4,
  // [O3] after the critic (M1): a shot is heard - a cop within this (m), line
  // of sight or not, knows where it was (his whistle; HEAT at the place); a
  // walker within this who ran from my gun or the shot knows who it was
  hear: { cop: 80, civ: 45 },
  // a report's place: the clock to losing them waits until one of them has
  // been there (or I am this far from it, or this long has gone)
  comeTo: { far: 90, secs: 120 },
};

export class Police {
  constructor(P) {
    this.P = P;
    this.G = P.G;
    this._heat = 0;
    this.state = 'clear';
    this.lastSeen = null;
    this.unseenT = 0;
    this.seenNow = false;
    this.pressure = 0;
    this.cops = [];
    this.cars = [];
    this.block = null;
    this.dets = [];
    this.fns = { heat: [] };
    this.events = [];
    this.t = 0;
    this.respT = 0;
    this.carT = 0;
    this.arrestT = 0;
    this.boxT = 0;
    this.warned = null;
    this.beatT = 0;
    this.blockT = -30;
    this.badges = new Badges(this.G);
    this.fists = streetFists(this);
    this.guns = copGuns(this);
    this.lineT = 0;
  }

  // ---- the seam ---------------------------------------------------------------------------------
  get heat() { return this._heat; }
  on(name, fn) { (this.fns[name] || (this.fns[name] = [])).push(fn); return fn; }
  off(name, fn) { const L = this.fns[name]; if (L) { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); } }
  event(what, data = {}) {
    this.events.push({ t: +this.G.time.toFixed(2), what, heat: this._heat, ...data });
    if (this.events.length > 300) this.events.splice(0, 100);
  }
  setHeat(h, why = '') {
    h = Math.max(0, Math.min(5, Math.round(h)));
    const prev = this._heat;
    if (h === prev) return;
    this._heat = h;
    if (this.G.save) this.G.save.heat = h;
    this.event('heat', { from: prev, to: h, why });
    this.badges.set(h, this.state);
    for (const fn of this.fns.heat) fn(h, prev);
    this.G.emit('heat', { heat: h, prev, why });
    // the line (O7's; the objective until then): HEAT n, then 'Lose them.'
    const hud = this.G.hud;
    if (h > prev) { hud.objective(`HEAT ${h}`); this.lineT = 2.8; }
  }

  // a crime seen: the heat to at least its level; while they already hunt
  // me, more of the same pushes it a level higher
  raise(level, at, why = '') {
    if (!level) return;
    const h = this._heat;
    if (level > h) this.setHeat(level, why);
    else if (this.t - (this.pressT ?? -99) > HEAT.pressGap) { this.pressT = this.t; this.pressure += level * HEAT.press; if (this.pressure >= 1 && h < 5) { this.pressure = 0; this.setHeat(h + 1, why + '+'); } }
    if (at) this.lastSeen = { x: at.x, z: at.z, t: this.G.time };
    // (they come to the place first: the clock to losing them waits until one of them is there)
    if (at && !this.seenNow) this.comeTo = { x: at.x, z: at.z, t: this.t };
    this.state = 'hunt';
    this.unseenT = 0;
    this.badges.set(this._heat, this.state);
  }
  // a cop sees the crime (in line of sight within 40 m; a car's men 50 m)
  witness(rec) {
    const at = { x: rec.x, z: rec.z };
    let by = null;
    for (const c of this.cops) {
      if (!c.standing || c === rec.victim) continue;
      if (this.P.sees(c.pos, at, SEE.cop)) { by = c; break; }
    }
    if (!by) for (const pc of this.cars) if (pc.mode !== 'block' || true) { if (this.P.sees(pc.pos, at, SEE.cop + 10)) { by = pc; break; } }
    if (!by) return this.heard(rec);
    this.event('seen', { kind: rec.kind, by: by.role || 'car' });
    // (the beat cop's whistle: he has seen it)
    if (by.say) by.say('o3_whistle');
    this.raise(rec.level, this.G.eye, rec.kind);
    return true;
  }
  // [O3] after the critic (M1): a shot nobody of theirs saw is still heard -
  // the nearest cop on foot within HEAT.hear.cop blows his whistle and runs to
  // the place: the heat at the place (they know where, not who: the search
  // there, and the clock waits until they have been)
  heard(rec) {
    if (rec.kind !== 'shot' && rec.kind !== 'death' && rec.kind !== 'cophurt') return false;
    const at = { x: rec.x, z: rec.z };
    let by = null, bd = HEAT.hear.cop;
    for (const c of this.cops) {
      if (!c.standing || c === rec.victim || c.mode === 'fight' || c.armed) continue;
      const d = Math.hypot(c.pos.x - at.x, c.pos.z - at.z);
      if (d < bd) { bd = d; by = c; }
    }
    if (!by) return false;
    this.event('heard', { kind: rec.kind, d: +bd.toFixed(0) });
    by.say('o3_whistle');
    const h0 = this._heat;
    this.raise(rec.level, at, rec.kind + ':heard');
    // (heard, not seen: they know the place, not me - the search there, shown, until one of them sees me)
    if (!h0 && !this.seenNow) { this.state = 'search'; this.unseenT = HEAT.searchAfter; this.badges.set(this._heat, this.state); }
    // (he is the one who comes: at a run to the place)
    if (by.job === 'beat') { by.job = 'respond'; by.mode = 'chase'; by.t = 0; by.path = null; by.repath = 0; }
    rec.heard = true;
    return true;
  }
  // a civilian told it (at a call box, or to a cop)
  report(rec, who, how) {
    // (a crime a cop saw or heard is theirs already: told again, it is nothing new)
    if (rec.seen === 'cop' || rec.heard) { this.event('report', { kind: rec.kind, how, known: true }); return; }
    this.event('report', { kind: rec.kind, how });
    this.raise(rec.level, { x: rec.x, z: rec.z }, rec.kind + ':' + how);
    // (they know where it was, not where I am: they come to the place and
    // search there; the clock to losing them starts once one of them has been
    // there - [O3] after the critic: never while I stand at the place unfound)
    if (!this.seenNow) { this.state = 'search'; this.unseenT = HEAT.searchAfter; this.comeTo = { x: rec.x, z: rec.z, t: this.t }; }
  }
  // a door shut behind me (O5) or a car changed (O2), unseen: lost at once
  lost() { if (this._heat && !this.seenNow) { this.clear('lost'); return true; } return false; }
  changedCar() { return this.lost(); }
  clear(why = 'lost') {
    if (!this._heat && this.state === 'clear') return;
    this.pressure = 0;
    this.state = 'clear';
    this.setHeat(0, why);
    this.badges.set(0, 'clear');
    this.event('clear', { why });
    const hud = this.G.hud;
    if (why !== 'arrest' && why !== 'reset') { hud.objective('Clear.'); this.lineT = -3.2; }
    this.stand();
  }
  // the answer stood down: the cars go, the men walk off
  stand() {
    for (const pc of this.cars) { pc.siren = false; pc.mode = 'leave'; }
    for (const c of this.cops) if (c.job !== 'beat') { c.job = 'leave'; c.mode = 'walk'; }
    if (this.guns.active) this.guns.end();
    this.warn(null);
    this.arrestT = 0; this.boxT = 0;
  }
  // everything of the police gone at once (the station, the hospital: under the black)
  reset() {
    for (const pc of this.cars) pc.dispose();
    this.cars = [];
    for (const c of [...this.cops]) this.P.release(c);
    this.cops = [];
    if (this.block) this.block = null;
    this.guns.end(true);
    this.fists.stop();
    this._heat = 0; this.state = 'clear'; this.pressure = 0; this.unseenT = 0; this.lastSeen = null;
    if (this.G.save) this.G.save.heat = 0;
    this.badges.set(0, 'clear');
    this.warn(null);
    // (the line, if it is the heat's)
    const ot = this.G.hud.objectiveText;
    if (ot && (/^HEAT \d$/.test(ot) || ot === 'Lose them.' || ot === 'Clear.')) this.G.hud.objective(null, { now: true });
    this.lineT = 0;
    this.arrestT = 0; this.boxT = 0;
    this.event('reset');
  }
  dispose() { this.reset(); this.badges.dispose(); }

  // [O3] the nearest cop on foot within r, seen or not (a witness shouts for him)
  copNear(pos, r = 100) {
    let best = null, bd = r;
    for (const c of this.cops) {
      if (!c.standing || c.armed || c.mode === 'fight' || (c.job !== 'beat' && c.job !== 'respond')) continue;
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  copInSight(pos, r = 60) {
    let best = null, bd = r;
    for (const c of this.cops) {
      if (!c.standing) continue;
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (d < bd && this.P.graph.lineOfSight(pos.x, pos.z, c.pos.x, c.pos.z)) { bd = d; best = c; }
    }
    return best;
  }
  warn(text) {
    if (this.warned === text) return;
    this.warned = text;
    const hud = this.G.hud;
    // (a warning is danger: no card under it, no other line - the car's 'E get in' goes too)
    if (text) { hud.teach.dismiss(); hud.clearPrompt('cityin'); hud.clearPrompt('cityout'); }
    hud.warn(text);
  }

  // ---- one step ------------------------------------------------------------------------------------
  step(dt) {
    const G = this.G, P = this.P;
    this.t += dt;
    if (G.failing) return;
    const inCar = !!(G.city && G.city.inCar);
    const me = inCar && G.city.car ? G.city.car.pos : G.eye;
    // do they see me? (every fifth of a second)
    this.seeT = (this.seeT || 0) - dt;
    if (this.seeT <= 0) {
      this.seeT = 0.2;
      this.seenNow = false;
      if (this._heat) {
        for (const c of this.cops) if (c.standing && c.job !== 'leave' && P.sees(c.pos, me, HEAT.sight.foot)) { this.seenNow = true; break; }
        if (!this.seenNow) for (const pc of this.cars) if (pc.mode !== 'leave' && P.sees(pc.pos, me, this.state === 'search' ? HEAT.sight.carSearch : HEAT.sight.car)) { this.seenNow = true; break; }
        if (!this.seenNow && this.guns.active) for (const h of this.guns.men()) if (h.alive && P.sees(h.pos, me, HEAT.sight.foot)) { this.seenNow = true; break; }
      }
    }
    if (this._heat) {
      if (this.seenNow) {
        this.lastSeen = { x: me.x, z: me.z, t: G.time };
        this.unseenT = 0; this.comeTo = null;
        if (this.state !== 'hunt') { this.state = 'hunt'; this.event('found'); for (const pc of this.cars) if (pc.mode === 'search') { pc.mode = 'drive'; pc.siren = true; } }
      } else {
        // (a report: the clock waits for them to get there)
        const CT = this.comeTo;
        if (CT && (this.t - CT.t > HEAT.comeTo.secs || Math.hypot(me.x - CT.x, me.z - CT.z) > HEAT.comeTo.far
          || this.cops.some((c) => c.standing && c.job === 'respond' && Math.hypot(c.pos.x - CT.x, c.pos.z - CT.z) < 10)
          || this.cars.some((pc) => pc.mode !== 'leave' && Math.hypot(pc.pos.x - CT.x, pc.pos.z - CT.z) < 14))) this.comeTo = null;
        if (!this.comeTo) this.unseenT += dt;
        if (this.state === 'hunt' && this.unseenT > HEAT.searchAfter) { this.state = 'search'; this.event('search'); for (const pc of this.cars) { if (pc.mode === 'drive') pc.mode = 'search'; pc.siren = false; } }
        if (this.unseenT > HEAT.lose[this._heat]) this.clear('lost');
      }
      this.badges.set(this._heat, this.state);
    }
    // the line: 'HEAT n' for a moment, then 'Lose them.'; 'Clear.' goes after a while
    if (this.lineT > 0) { this.lineT -= dt; if (this.lineT <= 0 && this._heat) G.hud.objective('Lose them.'); }
    else if (this.lineT < 0) { this.lineT += dt; if (this.lineT >= 0 && !this._heat) G.hud.objective(null); }
    this.badges.step(dt);
    this.stepBeat(dt);
    this.offerCar();
    this.stepResponse(dt);
    for (const pc of [...this.cars]) this.stepCar(pc, dt);
    this.guns.step(dt);
    this.fists.step(dt);
    this.stepArrest(dt, inCar);
    // the two real headlamp lights to the nearest lit cars (nothing else deals them yet: O2's traffic will)
    this.dealT = (this.dealT || 0) - dt;
    if (this.dealT <= 0) { this.dealT = 0.25; if (this.cars.length) G.vehicles.dealLights(); }
  }

  // ---- the beat: a few cops walking it round me, by district ------------------------------------
  stepBeat(dt) {
    if (this.P.hold) return;
    this.beatT -= dt;
    if (this.beatT > 0) return;
    this.beatT = 1.2;
    const P = this.P, E = this.G.eye;
    const dist = P.districtOf(E.x, E.z);
    const want = { downtown: 3, hill: 2, tenements: 2, docks: 1, yards: 1 }[dist] ?? 1;
    const beat = this.cops.filter((c) => c.job === 'beat');
    // (gone when far and out of sight; a cop busy with me stays)
    for (const c of beat) {
      const d = Math.hypot(c.pos.x - E.x, c.pos.z - E.z);
      // (a cop a witness is running to stays: he is the answer coming)
      if (d > 110 && !P.inView(c.pos.x, c.pos.z) && !c.summonedBy) this.dropCop(c);
    }
    if (beat.length >= want) return;
    const n = this.spawnOnFoot(45, 100, 'beat');
    if (n) n.goTo(P.pavWalk(P.nearestP(n.pos.x, n.pos.z), 6), { gait: 'stroll' });
  }
  // a man on foot out of my sight, on the pavement in a ring round me
  spawnOnFoot(r0, r1, job, kind = null) {
    const P = this.P, E = this.G.eye;
    for (let k = 0; k < 14; k++) {
      const n = P.pList[Math.floor(Math.random() * P.pList.length)];
      const d = Math.hypot(n.x - E.x, n.z - E.z);
      if (d < r0 || d > r1 || P.inView(n.x, n.z)) continue;
      const c = P.spawn(kind || P.copLook(k), n.x, n.z, 0, 'cop');
      c.job = job; c.mode = 'walk';
      this.cops.push(c);
      this.event('cop', { job });
      return c;
    }
    return null;
  }
  dropCop(c) {
    const i = this.cops.indexOf(c);
    if (i >= 0) this.cops.splice(i, 1);
    this.P.release(c);
  }

  // ---- the answer by level ------------------------------------------------------------------------
  stepResponse(dt) {
    const G = this.G, P = this.P, h = this._heat;
    this.respT -= dt;
    if (this.respT > 0) return;
    this.respT = 0.5;
    const E = G.eye, inCar = !!(G.city && G.city.inCar);
    if (!h) {
      // stood down: the cars and the men gone once out of my sight
      for (const pc of [...this.cars]) if (pc.mode === 'leave') {
        const d = Math.hypot(pc.pos.x - E.x, pc.pos.z - E.z);
        if (pc.crew.some((c) => c.standing && c.mode !== 'gone')) { for (const c of pc.crew) if (c.standing && !this.cops.includes(c)) continue; }
        if (d > 70 && !P.inView(pc.pos.x, pc.pos.z) || d > 180) this.dropCar(pc);
        else if (!pc.left) { pc.left = true; const away = this.awayRoad(pc.pos, E); if (away) pc.driveTo(away, { vmax: 12 }); }
      }
      for (const c of [...this.cops]) if (c.job === 'leave' && !P.inView(c.pos.x, c.pos.z) && Math.hypot(c.pos.x - E.x, c.pos.z - E.z) > 35) this.dropCop(c);
      return;
    }
    // 1: a man on foot to make the arrest (the nearest cop on the beat, or one sent)
    // ([O3] after the critic, B1: the man in my fist fight is the man on foot - never sent again)
    const foot = this.cops.filter((c) => c.standing && (c.job === 'respond' || c.job === 'arrest' || c.job === 'fight'));
    // (HEAT 4 and up: no man walks over to cuff me - the detectives come, and the men on foot draw)
    if (h >= 4) foot.push(null);
    // (the first time a man comes for me: what I can do about it, once, while he is still coming)
    if (foot.length && foot[0] && !this.taught && !inCar) {
      const c = foot[0], d = Math.hypot(c.pos.x - E.x, c.pos.z - E.z);
      if (d < 40 && d > 8 && P.sees(c.pos, E, 40) && !G.hud.kit.warnText && !G.hud.sayShown) { this.taught = true; G.hud.teach('o3_runfight', '[SHIFT] run   [LMB] fight', { until: () => !!G.hud.kit.warnText || G.held('ShiftLeft') || G.held('Mouse0'), secs: 3.5 }); }
    }
    if (!foot.length) {
      let best = null, bd = 130;
      for (const c of this.cops) if (c.standing && c.job === 'beat' && c.mode !== 'fight') { const d = Math.hypot(c.pos.x - E.x, c.pos.z - E.z); if (d < bd) { bd = d; best = c; } }
      if (!best && !inCar) best = this.spawnOnFoot(40, 75, 'respond');
      if (best) { best.job = 'respond'; best.mode = 'approach'; best.t = 0; best.path = null; best.repath = 0; this.event('send', { who: 'foot', d: +bd.toFixed(0) }); }
    }
    // 2+: the cars
    this.carT -= 0.5;
    const want = HEAT.cars[h];
    const live = this.cars.filter((pc) => pc.mode !== 'leave' && pc.role !== 'block');
    if (live.length < want && this.carT <= 0) {
      const role = h >= 4 && !this.cars.some((pc) => pc.role === 'detectives' && pc.mode !== 'leave') ? 'detectives' : h >= 5 && !this.cars.some((pc) => pc.role === 'riot') ? 'riot' : 'patrol';
      const pc = this.spawnCar(role);
      this.carT = pc ? 7 : 1.5;
    }
    // 3: the roadblock on the road ahead of my car
    // (only while they see me: a roadblock is put on the road they watch me take)
    if (h >= 3 && inCar && !this.block && this.state === 'hunt' && this.seenNow && this.t - this.blockT > 35) this.makeBlock();
    if (this.block) this.stepBlock();
  }
  // a car comes on out of my sight, on the roads 110 - 170 m off
  // [O2] a patrol car wedged for good, out of my sight: gone, and another sent
  replaceCar(pc) {
    const i = this.cars.indexOf(pc);
    if (i >= 0) this.cars.splice(i, 1);
    if (this.block && this.block.cars.includes(pc)) this.block.cars.splice(this.block.cars.indexOf(pc), 1);
    pc.dispose();
    this.event('replaced', { role: pc.role });
    this.stats && (this.stats.replaced = (this.stats.replaced || 0) + 1);
    return this.spawnCar(pc.role);
  }
  spawnCar(role) {
    const P = this.P, G = this.G, E = G.eye, graph = P.graph;
    for (let k = 0; k < 24; k++) {
      const a = Math.random() * Math.PI * 2, r = 110 + Math.random() * 60;
      const L = graph.nearestLane(E.x + Math.sin(a) * r, E.z + Math.cos(a) * r);
      if (!L || L.d > 12 || L.edge.bridge || L.edge.tram) continue;
      const d = Math.hypot(L.x - E.x, L.z - E.z);
      if (d < 95 || P.inView(L.x, L.z)) continue;
      // (clear of another car there)
      if (G.vehicles.list.some((v) => Math.hypot(v.pos.x - L.x, v.pos.z - L.z) < 8)) continue;
      // (facing the way it will go: its lane toward the first junction of its route to me)
      let yaw = L.heading;
      const rt = graph.route({ x: L.x, z: L.z }, E);
      if (rt && rt.nodes.length) {
        const e = L.edge, ns = rt.nodes, n = graph.nodeAt(ns[0] === e.a || ns[0] === e.b ? (ns.length > 1 && (ns[1] === e.a || ns[1] === e.b) ? ns[1] : ns[0]) : ns[0]);
        const sx = Math.sign((n.x - L.x) * e.dx + (n.z - L.z) * e.dz) || 1;
        const off = e.lanes[0] || 2, mx = e.ax + e.dx * L.s, mz = e.az + e.dz * L.s;
        // (the lane on that way's right)
        L.x = mx - e.dz * sx * off; L.z = mz + e.dx * sx * off;
        yaw = Math.atan2(-(e.dz * sx), e.dx * sx);
      }
      const pc = new PatrolCar(this, { x: L.x, z: L.z, yaw, role, crew: role === 'riot' ? 3 : 2, kind: role === 'riot' ? 'truck' : 'sedan', crewKind: null });
      pc.mode = 'drive';
      this.cars.push(pc);
      this.chase(pc);
      this.event('car', { role, d: +d.toFixed(0) });
      return pc;
    }
    return null;
  }
  // (the plays' staging: a police car standing where they say)
  spawnCarAt(x, z, yaw, role = 'patrol') { const pc = new PatrolCar(this, { x, z, yaw, role }); this.cars.push(pc); return pc; }
  dropCar(pc) {
    for (const c of pc.crew) if (this.cops.includes(c) && c.mode !== 'gone') { c.job = 'leave'; }
    const i = this.cars.indexOf(pc);
    if (i >= 0) this.cars.splice(i, 1);
    pc.dispose();
  }
  // a road point away from me (a car leaving)
  awayRoad(pos, from) {
    const dx = pos.x - from.x, dz = pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    return { x: pos.x + dx / d * 160, z: pos.z + dz / d * 160 };
  }
  // a car after me: where I am while they see me, round where I was seen while they search
  chase(pc) {
    const G = this.G;
    const inCar = !!(G.city && G.city.inCar);
    let tgt;
    if (this.state === 'search' && this.comeTo) {
      // (a report: to the place itself first)
      tgt = { x: this.comeTo.x, z: this.comeTo.z };
    } else if (this.state === 'search' && this.lastSeen) {
      const a = Math.random() * Math.PI * 2, r = 25 + Math.random() * 45;
      tgt = { x: this.lastSeen.x + Math.sin(a) * r, z: this.lastSeen.z + Math.cos(a) * r };
    } else {
      const me = inCar && G.city.car ? G.city.car : null;
      // (in a car: a little ahead of mine, on its way; on foot: where I stand)
      tgt = me ? { x: me.pos.x + me.vel.x * 1.2, z: me.pos.z + me.vel.z * 1.2 } : { x: G.eye.x, z: G.eye.z };
    }
    const fast = this.state === 'hunt';
    pc.driveTo(tgt, { vmax: fast ? (pc.role === 'riot' ? 13 : 19.5) : 11, pace: fast ? 1.15 : 0.8 });
  }
  stepCar(pc, dt) {
    const G = this.G, E = G.eye;
    const inCar = !!(G.city && G.city.inCar);
    pc.step(dt);
    if (pc.mode === 'leave' || pc.mode === 'block') return;
    if (pc.scene && !this._heat) { this.stepScene(pc); return; }
    const myCar = inCar && G.city.car ? G.city.car : null;
    const me = myCar ? myCar.pos : E;
    const d = Math.hypot(pc.pos.x - me.x, pc.pos.z - me.z);
    pc.routeT += dt;
    if (pc.mode === 'stopped') {
      // the men out; back in and after me if I drive off
      if (inCar && d > 30 && pc.t - pc.stopT > 3) { pc.mode = 'drive'; pc.siren = this.state === 'hunt'; this.chase(pc); }
      return;
    }
    // on foot near me: it stops, its men get out
    if (!inCar && d < 16 && this.state === 'hunt') {
      pc.park(); pc.mode = 'stopped'; pc.stopT = pc.t; pc.siren = false;
      if (pc.role === 'detectives') this.guns.carOut(pc);
      else pc.crewOut('respond').forEach((c) => { c.mode = 'chase'; c.t = 0; });
      this.event('stop', { role: pc.role, d: +d.toFixed(1) });
      return;
    }
    // in a car, stopped or nearly: it pulls up across my nose (the box)
    if (myCar && d < 22 && Math.abs(myCar.speed) < 4 && this.state === 'hunt' && pc.mode === 'drive' && (pc.pull || this.P.graph.lineOfSight(pc.pos.x, pc.pos.z, myCar.pos.x, myCar.pos.z))) {
      if (!pc.pull) {
        pc.pull = myCar.world(myCar.spec.halfL + 3.2, -1.6, new THREE.Vector3());
        pc.driveDirect(pc.pull, { vmax: 7 });
        pc.routeT = 0;
      }
      if ((d < 7.5 && myCar.local(pc.pos, new THREE.Vector3()).x > 1) || (pc.pilot && pc.pilot.done) || Math.hypot(pc.pos.x - pc.pull.x, pc.pos.z - pc.pull.z) < 2.5 || pc.stuckT > 2) { pc.park(); pc.mode = 'box'; pc.boxT = 0; pc.pull = null; }
      return;
    }
    pc.pull = null;
    // re-routed as I move (every 2.5 s hunting, at its end searching), or when stuck
    const done = pc.pilot && pc.pilot.done;
    // [O2] a unit stuck for good (wedged three times running) is replaced as a man on foot is:
    // out of my sight it goes, and another is sent from out of sight
    if (pc.stuckT > 4) { pc.stuckN = (pc.stuckN || 0) + 1; if (pc.stuckN >= 3 && !this.P.inView(pc.pos.x, pc.pos.z) && !pc.crew.length) { this.replaceCar(pc); return; } }
    else if (pc.routeT > 2 && Math.abs(pc.v.speed) > 3) pc.stuckN = 0;
    if (pc.routeT > (this.state === 'hunt' ? 2.5 : 9) || done || pc.stuckT > 4) { pc.stuckT = 0; this.chase(pc); }
    if (pc.mode === 'box') {
      pc.boxT += dt;
      // (a moment stopped across my nose: the men out and at my doors)
      if (pc.boxT > 0.8 && !pc.crew.length) for (const c of pc.crewOut('respond')) { c.mode = 'chase'; c.t = 0; c.atCar = true; }
      if (!myCar || Math.abs(myCar.speed) > 3 || d > 12) {
        pc.mode = 'drive'; this.chase(pc);
        // (the men back in: off the street with the car)
        for (const c of pc.crew) if (c.standing && this.cops.includes(c)) this.dropCop(c);
        pc.crew = [];
      }
    }
  }

  // ---- a police car I can take: parked, its men out (the city's E takes it: city.js) -------------
  // (until O2's hijack: the free roam's car is the one E gets into; the
  // police car stood empty nearest me is offered in its place, and taking
  // it is a hijack the men see)
  offerCar() {
    const G = this.G, R = G.city;
    if (!R || R.inCar) return;
    const E = G.eye;
    let best = null, bd = 4.2;
    for (const pc of this.cars) {
      if (pc.v.driver || pc.mode === 'leave') continue;
      const d = Math.hypot(pc.pos.x - E.x, pc.pos.z - E.z);
      if (d < bd) { bd = d; best = pc; }
    }
    if (best) {
      if (R.car !== best.v) { if (!R.ownCar || R.car && !R.car.police) R.ownCar = R.car; R.car = best.v; }
    } else if (R.car && R.car.police && R.ownCar && !R.car.taken) R.car = R.ownCar;
  }
  // I got into a car: a police car is taken (a hijack: its men, any cop in sight, see it)
  onIn(car) {
    if (!car || !car.police) return;
    const pc = this.cars.find((q) => q.v === car);
    car.taken = true;
    if (pc) {
      const i = this.cars.indexOf(pc);
      if (i >= 0) this.cars.splice(i, 1);
      pc.siren = false;
      for (const c of pc.crew) if (c.job === 'block' || c.job === 'scene') c.job = 'respond';
      if (this.block && this.block.cars.includes(pc)) this.block.cars.splice(this.block.cars.indexOf(pc), 1);
    }
    this.event('stolen', { role: pc ? pc.role : '?' });
    this.P.crime.emit('hijack', car.pos, 'player');
  }

  // ---- the gangs' border fight: a car to the place (their crime, not mine: no heat) -------------
  gangWar(W) {
    this.event('gangwar', { x: +W.x.toFixed(0), z: +W.z.toFixed(0) });
    const pc = this.spawnCar('patrol');
    if (pc) { pc.scene = { x: W.x, z: W.z, t: this.t }; pc.driveTo(pc.scene, { vmax: 18 }); }
    return pc;
  }
  stepScene(pc) {
    const S = pc.scene, d = Math.hypot(pc.pos.x - S.x, pc.pos.z - S.z);
    if (pc.mode === 'drive' && d < 16) {
      pc.park(); pc.mode = 'stopped'; pc.stopT = pc.t; pc.siren = false;
      for (const c of pc.crewOut('scene')) { c.mode = 'walk'; c.goTo({ x: S.x + (Math.random() - 0.5) * 5, z: S.z + (Math.random() - 0.5) * 5 }, { gait: 'hurry' }); }
    }
    if (pc.routeT > 6 && pc.mode === 'drive') { pc.routeT = 0; pc.driveTo(S, { vmax: 18 }); }
    pc.routeT += 1 / 60;
    // (a minute there, then they go)
    if (this.t - S.t > 60) { pc.scene = null; pc.mode = 'leave'; for (const c of pc.crew) c.job = 'leave'; }
  }

  // ---- the roadblock: two cars nose to nose across the road ahead, men behind them --------------
  makeBlock(force = null) {
    const G = this.G, P = this.P, graph = P.graph;
    const car = G.city.car;
    if (!car || (!force && Math.abs(car.speed) < 4)) return;
    const fx = Math.cos(car.yaw), fz = -Math.sin(car.yaw);
    for (const ahead of force ? [force] : [110, 90, 140, 75]) {
      const L = graph.nearestLane(car.pos.x + fx * ahead, car.pos.z + fz * ahead);
      if (!L || L.d > 8 || L.edge.bridge || L.edge.cls === 'lane') continue;
      const e = L.edge;
      // the street's middle at that point, the cars across it
      let s = Math.max(14, Math.min(e.len - 14, L.s));
      // [O3] after the critic (m3): under the nearest street lamp along the street
      // within 25 m (its pool on the two cars: they read from far off)
      {
        let best = null, bd = 25;
        for (const l of P.C.lamps || []) {
          if (Math.abs(l.x - (e.ax + e.dx * s)) > 40 || Math.abs(l.z - (e.az + e.dz * s)) > 40) continue;
          const u = (l.x - e.ax) * e.dx + (l.z - e.az) * e.dz, off = Math.abs((l.x - e.ax) * -e.dz + (l.z - e.az) * e.dx);
          if (off > e.hw + 4 || u < 14 || u > e.len - 14) continue;
          if (Math.abs(u - s) < bd) { bd = Math.abs(u - s); best = u; }
        }
        if (best != null) s = best;
      }
      const mx = e.ax + e.dx * s, mz = e.az + e.dz * s;
      if (Math.hypot(mx - car.pos.x, mz - car.pos.z) < (force ? force * 0.6 : 60)) continue;
      // (both lanes: two cars nose to nose across its width)
      const nx = -e.dz, nz = e.dx;
      const across = Math.atan2(-nz, nx);   // a car's heading along the normal
      const half = Math.max(2.4, e.hw - 2.4);
      const cars = [];
      for (const sg of [-1, 1]) {
        const cx = mx + nx * sg * half, cz = mz + nz * sg * half;
        const pc = new PatrolCar(this, { x: cx, z: cz, yaw: sg > 0 ? across + Math.PI : across, role: 'block', crew: 1 });
        pc.mode = 'block'; pc.park(); pc.siren = false;
        this.cars.push(pc);
        cars.push(pc);
      }
      // the men behind them (on the far side from me)
      const bx = -e.dx * Math.sign((car.pos.x - mx) * e.dx + (car.pos.z - mz) * e.dz || 1), bz = -e.dz * Math.sign((car.pos.x - mx) * e.dx + (car.pos.z - mz) * e.dz || 1);
      for (const pc of cars) for (const c of pc.crewOut('block')) {
        c.fig.pos.x = pc.pos.x + bx * 3.2; c.fig.pos.z = pc.pos.z + bz * 3.2;
        c.mode = 'hold'; c.holdAt = { x: c.pos.x, z: c.pos.z }; c.face(mx, mz);
      }
      this.block = { cars, x: mx, z: mz, edge: e.id, t: this.t };
      this.blockT = this.t;
      this.event('roadblock', { x: +mx.toFixed(0), z: +mz.toFixed(0), street: e.name, ahead });
      return;
    }
  }
  stepBlock() {
    const E = this.G.eye, B = this.block;
    const d = Math.hypot(B.x - E.x, B.z - E.z);
    // (left behind: gone when I am well past it and it is out of sight)
    if (this.t - B.t > 20 && d > 150 && !this.P.inView(B.x, B.z)) {
      for (const pc of B.cars) { for (const c of pc.crew) { c.job = 'leave'; } this.dropCar(pc); }
      this.block = null;
    }
  }

  // ---- the men on foot (Person brains with role 'cop') ---------------------------------------------
  stepCop(c, dt) {
    const G = this.G, P = this.P, E = G.eye;
    if (!c.standing) { if (!P.inView(c.pos.x, c.pos.z) && Math.hypot(c.pos.x - E.x, c.pos.z - E.z) > 50) this.dropCop(c); return; }
    if (c.mode === 'fight' || c.job === 'hold') return;
    const inCar = !!(G.city && G.city.inCar);
    const d = Math.hypot(c.pos.x - E.x, c.pos.z - E.z);
    // [O3] after the critic: a man wedged on his way (a lot's corner the pavement's
    // line cuts) and out of my sight is let go - the beat gets another, the answer
    // sends another (a responder wedged for a minute 35 m off was the police never coming)
    if (c.stuckN >= 2 && c.job !== 'block' && c.job !== 'scene' && !P.inView(c.pos.x, c.pos.z)) { this.event('wedged', { job: c.job }); this.dropCop(c); return; }
    // (wedged over and over in my sight - his steps round it no use: he gives it up and
    // walks off, and the answer sends another - never a man walking into a wall for a minute)
    if (c.stuckN >= 4 && (c.job === 'respond' || c.job === 'arrest')) { this.event('wedged', { job: c.job, seen: true }); c.job = 'leave'; c.mode = 'walk'; c.path = null; c.stuckN = 0; return; }
    if (c.job === 'beat' && c.summonedBy) {
      // [O3] a man of the street shouting for him: he goes to meet him (hurrying), and hears him out
      const w = c.summonedBy;
      if (!w.standing || w.mode !== 'report' || this.G.time - c.summonedT > 60) { c.summonedBy = null; c.path = null; }
      else {
        const dw = Math.hypot(w.pos.x - c.pos.x, w.pos.z - c.pos.z);
        c.repath = (c.repath || 0) - dt;
        if (dw > 2.2) { if (c.repath <= 0 || !c.path) { c.repath = 1; c.path = P.sees(c.pos, w.pos, 60) ? [[w.pos.x, w.pos.z]] : (P.graph.pavementRoute(c.pos, w.pos) || { pts: [] }).pts.concat([[w.pos.x, w.pos.z]]); c.pi = 0; c.mode = 'walk'; } c.gait = 'hurry'; }
        else { c.stop(); c.face(w.pos.x, w.pos.z); c.look(w.pos); }
        return;
      }
    }
    if (c.job === 'beat') {
      // walking the beat; at a corner now and then a stop; he watches me if I am close
      if (!c.path) {
        if (Math.random() < 0.35) {
          c.mode = 'stand'; c.t = 0; c.until = 4 + Math.random() * 6; c.stop();
          // (a word with a man of the street: the two of them face each other a while)
          const w = P.near(c.pos.x, c.pos.z, 7).find((q) => q.role === 'walker' && q.standing && (q.mode === 'walk' || q.mode === 'stand') && !q.pair);
          if (w) { c.face(w.pos.x, w.pos.z); c.look(w.pos); w.stop(); w.mode = 'stand'; w.t = 0; w.until = c.until; w.face(c.pos.x, c.pos.z); w.look(c.pos); c.talkTo = w; }
        } else { c.talkTo = null; c.goTo(P.pavWalk(P.nearestP(c.pos.x, c.pos.z), 5), { gait: 'stroll' }); }
      }
      if (c.mode === 'stand' && c.t > c.until) c.mode = 'walk';
      if (d < 9 && !this._heat) { c.look(E); c.lookingMe = true; } else if (c.lookingMe && !c.talkTo) { c.look(null); c.lookingMe = false; }
      return;
    }
    if (c.job === 'scene') {
      // (at the gangs' fight: they stand over it, and watch me)
      if (!c.path) { c.stop(); if (d < 25) { c.face(E.x, E.z); c.look(E); } }
      return;
    }
    if (c.job === 'leave') {
      if (!c.path) c.goTo(P.awayPath(c.pos, E, 40), { gait: 'walk' });
      return;
    }
    if (c.job === 'block') {
      // behind his car; he steps out at me if I stop on foot near it
      if (!inCar && d < 25 && this._heat) { c.job = 'respond'; c.mode = 'chase'; }
      else { c.face(E.x, E.z); c.look(E); if (c.holdAt && Math.hypot(c.pos.x - c.holdAt.x, c.pos.z - c.holdAt.z) > 1) c.goTo(c.holdAt); }
      return;
    }
    // respond: after me while they see me, a look round where I was while they search
    if (!this._heat) { c.job = 'leave'; return; }
    if (this.state === 'search') {
      // (to the place first, at a run; then a look round it)
      const L = this.comeTo || this.lastSeen || E;
      const dL = Math.hypot(c.pos.x - L.x, c.pos.z - L.z);
      if (c.mode !== 'search' || !c.path || c.t > 12) {
        c.mode = 'search'; c.t = 0;
        const far = dL > 18;
        const tgt = far ? { x: L.x, z: L.z } : { x: L.x + (Math.random() - 0.5) * 30, z: L.z + (Math.random() - 0.5) * 30 };
        const R = P.graph.pavementRoute(c.pos, tgt);
        c.goTo(R ? R.pts.concat([[tgt.x, tgt.z]]) : tgt, { gait: far ? 'run' : 'walk' });
        c.mode = 'search';
      }
      return;
    }
    // (in a car: to my door if it stands; else he stands and watches it go)
    if (inCar) {
      const car = G.city.car;
      if (car && Math.abs(car.speed) < 2 && d < 20) {
        const door = car.world(-0.3, -(car.spec.halfW + 0.7), new THREE.Vector3());
        c.path = [[door.x, door.z]]; c.pi = 0; c.gait = 'run'; c.mode = 'chase';
        if (Math.hypot(door.x - c.pos.x, door.z - c.pos.z) < 0.9) { c.stop(); c.face(car.pos.x, car.pos.z); }
      } else { c.stop(); c.face(E.x, E.z); }
      c.look(E);
      return;
    }
    // (HEAT 4 and up: a man on foot who sees me draws - the gun kit's tells, its cover)
    if (this._heat >= 4 && d < 35 && P.sees(c.pos, E, 35)) { this.guns.arm(c, 'pistol', 'police'); return; }
    // (at HEAT 1 he walks over - the walk is the warning's time; he runs when I run, or at 2 and up)
    const V = G.controller.vel, mySp = Math.hypot(V.x, V.z);
    const run = c.mode === 'chase' || this._heat >= 2 || d > 45 || (mySp > 3.4 && d > 5);
    c.mode = run ? 'chase' : 'approach';
    // (his wind: a sprint of ten seconds, then a run until he has his breath back)
    const W = HEAT.wind;
    if (run && c.gaitNow === 'sprint') c.sprintT = (c.sprintT || 0) + dt; else c.sprintT = Math.max(0, (c.sprintT || 0) - dt * W.sprint / W.rest);
    if (c.sprintT > W.sprint) c.blown = true; else if (c.sprintT <= 0) c.blown = false;
    const fast = c.blown ? 'run' : 'sprint';
    c.gait = run ? fast : 'hurry';
    if (d > 1.6) {
      // (straight at me where he can see me, by the pavements where he cannot; a step
      // round a thing in his way is walked before the way is made again)
      if (!(c.sideUntil > G.time && c.path && c.pi < c.path.length) && (!c.path || !(c.repath > 0) || c.pi >= c.path.length)) {
        c.repath = 0.6;
        // (a man who wedged once going straight takes the pavements' way)
        c.path = P.sees(c.pos, E, 60) && !(c.stuckN > 0) ? [[E.x, E.z]] : (P.graph.pavementRoute(c.pos, E) || { pts: [[E.x, E.z]] }).pts.concat([[E.x, E.z]]);
        c.pi = 0;
      }
      c.repath -= dt;
      c.gait = run ? fast : 'hurry';
    } else { c.stop(); c.face(E.x, E.z); }
    c.look(E);
    // he runs: the whistle once
    if (run && !c.whistled) { c.whistled = true; c.say('o3_whistle'); }
  }

  // ---- the arrest -------------------------------------------------------------------------------------
  stepArrest(dt, inCar) {
    const G = this.G, P = this.P, E = G.eye;
    const fight = G.brawl.active || (G.crowd && G.crowd.active);
    if (!this._heat || fight) { if (!fight) { this.arrestT = 0; this.boxT = 0; this.warn(null); } return; }
    if (!inCar) {
      this.boxT = 0;
      let n = 0, nearest = null;
      for (const c of this.cops) {
        if (!c.standing || c.job === 'leave' || c.job === 'beat' || c.mode === 'fight') continue;
        const d = Math.hypot(c.pos.x - E.x, c.pos.z - E.z);
        if (d < HEAT.arrest.r + 0.4) { n++; if (!nearest || d < nearest.d) nearest = { c, d }; }
      }
      const V = G.controller.vel, sp = Math.hypot(V.x, V.z);
      if (n) {
        if (this.warned !== 'Hands up.') { this.warn('Hands up.'); nearest.c.say('o3_handsup'); this.event('handsup', { n }); }
        // (standing, or walking off with him at my elbow, or boxed in by two:
        // the cuffs come; running away - Shift - or a fist in his face: not)
        const caught = sp < 3.2 || n >= 2 || (nearest.d < 1.9 && sp < 5);
        this.arrestT = caught ? this.arrestT + dt : Math.max(0, this.arrestT - dt * 1.5);
        if (this.arrestT >= HEAT.arrest.warn) this.arrest('foot');
      } else {
        this.arrestT = Math.max(0, this.arrestT - dt * 2);
        let far = true;
        for (const c of this.cops) if (c.standing && c.job !== 'beat' && Math.hypot(c.pos.x - E.x, c.pos.z - E.z) < 5) far = false;
        if (far && this.warned === 'Hands up.') this.warn(null);
      }
      return;
    }
    // boxed in the car: two of their cars on me (or one and a man at my door), me stopped
    const car = G.city.car;
    if (!car) return;
    let cars = 0, men = 0;
    for (const pc of this.cars) if (pc.mode !== 'leave' && Math.hypot(pc.pos.x - car.pos.x, pc.pos.z - car.pos.z) < HEAT.arrest.boxR) cars++;
    for (const c of this.cops) if (c.standing && c.job !== 'beat' && Math.hypot(c.pos.x - car.pos.x, c.pos.z - car.pos.z) < 4) men++;
    const boxed = Math.abs(car.speed) < 1.5 && (cars >= 2 || (cars >= 1 && men >= 1));
    this.boxT = boxed ? this.boxT + dt : Math.max(0, this.boxT - dt * 2);
    if (this.boxT > 1.0 && this.warned !== 'Hands up.') { this.warn('Hands up.'); this.event('handsup', { boxed: true, cars, men }); }
    if (this.boxT < 0.3 && this.warned === 'Hands up.') this.warn(null);
    if (this.boxT >= HEAT.arrest.box) this.arrest('boxed');
  }
  arrest(how) {
    const G = this.G;
    if (G.failing) return;
    this.event('arrest', { how });
    G.counters.arrests = (G.counters.arrests || 0) + 1;
    G.sfx.play('o3_cuffs', null, {}, { send: false });
    this.warned = null;
    G.fail({ why: 'Arrested.', to: 'station', fall: false, hold: 1.4 });
  }
}
