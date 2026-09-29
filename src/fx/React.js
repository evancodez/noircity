import * as THREE from 'three';
import { SURF } from '../util/RayWorld.js';

// The reactive world (Phase 3a): every bullet that hits the block is routed
// here first. The owner of the surface reacts (a car's pane cracks, a lamp
// goes out, a window shatters, a trash can tumbles, the hydrant bursts, a
// grate puffs) and says whether its own effect replaces the generic impact
// (fx/Impacts: chips, sparks, splash, a dark mark).
//   bullet(hit, dir, { weak })  - weak: a Hood's stray round (cosmetic
//                                 damage only: it never blows up a car or
//                                 kills a lamp)
//   update(dt, t)               - cars (smoke, blast, fire), lamps, props,
//                                 hazards (the burning wreck's damage tick)
export class React {
  constructor(game) {
    this.game = game;
    const W = game.world;
    this.world = W;
    for (const k of ['cars', 'lamps', 'facade', 'props']) if (W[k] && W[k].bind) W[k].bind(game);
    this.hazards = [];     // { pos, r, kind: 'smoke' | 'fire', car }
    this.hotT = 0;
    this.counts = { glass: 0, lamps: 0, windows: 0, props: 0, cars: 0 };
  }

  bullet(hit, dir, { weak = false } = {}) {
    const G = this.game, W = this.world;
    const ud = hit.mesh.userData;
    let res = null;
    if (ud.car) res = W.cars.hit(ud.car, hit, dir, { weak });
    else if (ud.lamp && W.lamps.hit) res = weak ? null : W.lamps.hit(ud.lamp, hit, dir);
    // a pane of its own (destruct/Glass.js) and anything breakable
    // (destruct/Breakables.js)
    else if (ud.pane && W.glass) res = W.glass.hit(ud.pane, { point: hit.point, normal: hit.normal, dir, power: weak ? 0.5 : 1, by: 'bullet' });
    else if (ud.breakable && W.breakables) { W.breakables.hit(ud.breakable, { point: hit.point, dir, power: weak ? 0.3 : 1, by: 'bullet' }); res = null; }
    else if (ud.facadeGlass && W.facade.hit) res = W.facade.hit(hit, dir);
    else if (ud.prop && W.props.hit) res = W.props.hit(ud.prop, hit, dir, { weak });
    else if (hit.surf === SURF.WATER || hit.surf === SURF.PAVE) {
      // a round into the street by a grate: the vent coughs
      const gr = W.props.nearGrate && W.props.nearGrate(hit.point.x, hit.point.z);
      if (gr) W.props.puffGrate(gr, 0.7);
    }
    if (res !== 'glass' && res !== 'done') G.fx.impacts.at(hit, dir);
    if (res === null && (hit.surf === SURF.IRON || hit.surf === SURF.CAR) && G.rng.chance(0.35)) G.sfx.ricochet(hit.point);
    return res;
  }

  update(dt, t) {
    const G = this.game, W = this.world;
    W.cars.update(dt, t);
    if (W.lamps.react) W.lamps.react(dt, t);
    if (W.props.update) W.props.update(dt, t);
    // hazards follow their cars' state
    this.hazards = this.hazards.filter((h) => h.car.state !== 'intact' && h.car.state !== 'dead');
    for (const h of this.hazards) {
      if (h.car.state === 'burning') { h.kind = 'fire'; h.r = h.car.fire && h.car.fire.intensity() > 0.3 ? 3.6 : 2.6; }
    }
    // the burning wreck is hot: a small damage tick standing in the flames
    this.hotT -= dt;
    if (this.hotT <= 0 && G.live) {
      this.hotT = 0.25;
      const p = G.eye;
      for (const f of W.cars.fires) {
        const I = f.intensity();
        if (I < 0.3) continue;
        const d = Math.hypot(p.x - f.pos.x, p.z - f.pos.z);
        if (d < 2.4) { G.health.damage(Math.round(2 + 3 * I * (1 - d / 2.4))); G.counters.burnTicks = (G.counters.burnTicks || 0) + 1; }
      }
    }
  }

  // is (x, z) inside a hazard (a smoking car about to go, a burning wreck)?
  hazardAt(x, z, pad = 0) {
    for (const h of this.hazards) if (Math.hypot(x - h.pos.x, z - h.pos.z) < h.r + pad) return h;
    return null;
  }
}
