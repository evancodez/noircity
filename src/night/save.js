// The open world's save (lane O7, docs/seams/NIGHT.md §3; the format is
// src/game/Save.js's v3). Where I am (the place and the way I face, the car
// and its state, in it or not, the hour), the heat, the money, the garage,
// the matchbooks, the cards taught, the places found.
// Written:
//   - at the hotel's bed (O5 calls game.save.write(): Save asks night.snapshot())
//   - the quiet autosave: as I get into a car (city:in) with the heat at 0,
//     never under fire (no hit in the last 8 s, no warning up), never in a
//     fight (no brawl, no director's encounter), never in the first seconds
//     of the night (the kerb is where BEGIN puts me anyway), at most once
//     every 20 s; a small tick bottom right says it was written, nothing else
// CONTINUE (the title): the save read, the night started from it; the city's
// roam beat takes the place up (city.js setup: night.takeResume()): the car
// where it stood, in its seat if I was, the world drawn afresh (the traffic
// and the people are the city's, never the save's).
export const AUTOSAVE = { quietHit: 8, every: 20, after: 6 };
export const NEW_NIGHT = { rounds: 12 };   // [O7] the revolver's rounds in the coat on BEGIN

export class NightSave {
  constructor(night) {
    this.night = night;
    this.resume = null;      // the save CONTINUE started from, until the roam beat takes it
    this.lastAuto = -1e9;
    this.autos = 0;
    this.skipped = null;     // why the last autosave was not written (the plays read it)
    const G = night.game;
    // [O7] a new night in the city: the man in the coat with a revolver under his arm (OPEN_WORLD §1) - a cylinder and a dozen in the coat (O4's arms)
    G.on('night:start', (e) => { if (e && !e.from && e.scene === 'city') { if (!G.save.inventory.includes('revolver')) G.save.inventory.push('revolver'); G.save.ammo = { revolver: NEW_NIGHT.rounds, revolverIn: 6, ...(G.save.ammo || {}) }; } });
    G.on('night:start', (e) => { this.resume = e && e.from ? e.from : null; this.lastAuto = -1e9; this.started = G.time; if (this.resume && this.resume.city && this.resume.city.hour != null) night.clock.set(this.resume.city.hour); else night.clock.set(0); });
    G.on('city:in', () => this.auto());
  }

  // the place, as a record (Save.write asks for it)
  snapshot() {
    const G = this.night.game, R = G.city, ctl = G.controller;
    const car = R && R.car && R.car.solid !== false ? R.car : null;
    const inCar = !!(R && R.inCar && car);
    const yaw = inCar ? car.yaw - Math.PI / 2 : ctl.yaw;
    const p = inCar ? car.pos : ctl.pos;
    return {
      pos: { x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +yaw.toFixed(3) },
      car: car ? { kind: car.kind, x: +car.pos.x.toFixed(2), z: +car.pos.z.toFixed(2), yaw: +car.yaw.toFixed(3), damage: +(car.damage || 0).toFixed(2) } : null,
      inCar, hour: Math.round(this.night.clock.min),
    };
  }

  // the quiet autosave (the rule above); returns the data or null
  auto() {
    const N = this.night, G = N.game;
    const why = this.blocked();
    this.skipped = why;
    if (why) return null;
    const d = G.save.write({ reason: 'car' });
    if (d) { this.lastAuto = G.time; this.autos++; N.hud.saved(); }
    return d;
  }
  blocked() {
    const N = this.night, G = N.game;
    if (!N.inCity) return 'not in the city';
    const P = G.police;
    if (P && P.heat > 0) return 'heat';
    if (G.brawl && G.brawl.active) return 'brawl';
    if (G.director && G.director.active) return 'fight';
    if (G.health && G.health.sinceHit < AUTOSAVE.quietHit) return 'under fire';
    if (G.hud.warnText) return 'warned';
    if (G.failing) return 'failing';
    if (G.time - (this.started ?? -1e9) < AUTOSAVE.after) return 'too soon';
    if (G.time - this.lastAuto < AUTOSAVE.every) return 'recent';
    return null;
  }

  // (city.js's roam setup) the save's place, once: { car, carYaw, kind, damage, pos, yaw, inCar }
  take() {
    const d = this.resume;
    this.resume = null;
    if (!d || !d.city) return null;
    if (d.beat && d.beat !== 'roam') return null;   // (O5's hotel: its beat wakes me in the room)
    const C = d.city, car = C.car;
    if (!car) {
      // (no car in the save: one at the kerb nearest me, as the starts have it)
      return null;
    }
    const inCar = !!C.inCar;
    // on foot: where I stood; in the car: beside its door, seated by the setup
    const pos = inCar ? { x: car.x + Math.sin(car.yaw) * 2.3, z: car.z + Math.cos(car.yaw) * 2.3 } : { x: C.pos.x, z: C.pos.z };
    return { car: { x: car.x, z: car.z }, carYaw: car.yaw, kind: ['coupe', 'sedan', 'truck'].includes(car.kind) ? car.kind : 'coupe', damage: car.damage || 0, pos, yaw: C.pos.yaw, inCar };
  }
}
