import * as THREE from 'three';
import { KINDS, PAINTS, repaint } from './kinds.js';
import { money, spend } from '../traffic/seams.js';

// The garage (lane O2; the room is O5's): in the Yards (plan PLACES 'garage',
// its street door: places.doors). Its rules:
//   in a car, stopped by its door      E  into the garage: the car is kept
//                                      (save.garage, up to three), mended for
//                                      $10 a step of damage if I have it (else kept
//                                      as it is), and I am on the pavement
//   on foot at its door                E  the garage: the card - my cars kept
//                                      there; W / S choose, A / D its grey (one
//                                      of three, $10), E brought out to the kerb
//                                      (a short black: the door's roll), walking
//                                      off closes it
// save.garage: [{ kind, paint, damage, full }] (a CONTINUE keeps it). [O2] after O5's room: the
// street door is the room's; inside, the mechanic (rooms/garage.js) brings a kept car out
// (wheels.garage.open(): the card) when mine is not at the kerb outside.
// Events: 'wheels:garage' { what: 'in' | 'out', car }.
const MAX = 3, MEND = 10, PAINT = 10;
const NAMES = { paint: 'black', paintGrey: 'dark grey', paintPale: 'pale grey' };

export class Garage {
  constructor(W) {
    this.W = W;
    this.G = W.game;
    const places = W.stage.part('places');
    this.door = places && places.doors.find((d) => d.place === 'garage');
    this.card = null;
    this.stats = { stored: 0, fetched: 0, mended: 0, repainted: 0 };
    // the street door's E on foot (the free roam's city:door)
    this.G.on('city:door', (e) => { if (e.door && e.door.place === 'garage' && this.W.stage === this.G.stage) { e.handled = true; this.open(); } });
    W.extras.push(this);
  }
  // [O2] the save's own list (O7's v3 save keeps save.garage); an older save's flags.garage taken over
  get list() {
    const S = this.G.save;
    if (!Array.isArray(S.garage)) S.garage = [];
    if (S.flags && Array.isArray(S.flags.garage) && S.flags.garage.length) { S.garage.push(...S.flags.garage); S.flags.garage = []; }
    return S.garage;
  }
  // the kerb in front of the door, and its way along the street
  front() {
    const D = this.door, p = { x: D.x + D.nx * 4.5, z: D.z + D.nz * 4.5 };
    const L = this.W.graph.nearestLane(p.x, p.z);
    return { x: p.x, z: p.z, yaw: L ? L.heading : 0 };
  }
  // in a car: stopped at the door, E takes it in (the free roam asks first)
  inCar(ctx, R) {
    if (!this.door || !R.car) return false;
    const v = R.car, f = this.front();
    const near = Math.hypot(v.pos.x - f.x, v.pos.z - f.z) < 9 && v.speedAbs < 1.2;
    if (near !== !!this.shown) { this.shown = near; if (near) ctx.hud.prompt('E  into the garage', null, 'o2garage'); else ctx.hud.clearPrompt('o2garage'); }
    if (!near) return false;
    if (ctx.pressed('KeyE')) { this.store(ctx, R); return true; }
    return true;
  }
  store(ctx, R) {
    const G = this.G, v = R.car, hud = ctx.hud;
    hud.clearPrompt('o2garage'); this.shown = false;
    if (this.list.length >= MAX) { hud.message('The garage is full.', 2); return; }
    // mended for money, if I have it
    const steps = Math.ceil(v.damage || 0), cost = steps * MEND;
    let mended = steps === 0;
    if (steps && spend(G, cost)) { mended = true; this.stats.mended++; }
    const rec = { kind: v.kind, paint: (v.model && v.model.paint) || 'paint', variant: (v.model && v.model.variant) || 0, white: !!(v.model && v.model.white), damage: mended ? 0 : v.damage, full: !(v.model && v.model.fleet) };
    this.list.push(rec);
    this.stats.stored++;
    G.save.write();
    this.W.exit(v);
    // (the car kept is the garage's: it goes in behind me - out of the world when I look away)
    this.W.forgetLeft(v);
    v.stored = true; v.solid = true;
    this.goneOf = v;
    hud.message(steps && !mended ? 'Kept. No money for the mending.' : steps ? `Kept and mended. $${cost}` : 'Kept.', 2.4);
    G.emit('wheels:garage', { what: 'in', car: v });
  }
  open() {
    const G = this.G;
    if (!this.list.length) { G.hud.message('Nothing of mine in there.', 1.8); return; }
    this.card = { i: 0, paints: this.list.map((r) => r.paint), at: G.controller.pos.clone() };
    G.controller.frozen = true;
    this.draw();
  }
  close() {
    this.card = null;
    this.G.controller.frozen = false;
    this.G.hud.dropLayer('o2garage');
  }
  draw() {
    const C = this.card, el = this.G.hud.layer('o2garage');
    const rows = this.list.map((r, i) => {
      const p = C.paints[i], ch = p !== r.paint ? `  (to ${NAMES[p]}: $${PAINT})` : '';
      return `<div style="opacity:${i === C.i ? 1 : 0.55}">${i === C.i ? '&#9656;' : '&nbsp;'} ${r.kind.toUpperCase()} &nbsp; ${NAMES[r.paint] || r.paint}${ch}${r.damage ? ' &nbsp;(knocked about)' : ''}</div>`;
    }).join('');
    el.innerHTML = `<div style="position:absolute;left:50%;top:34%;transform:translateX(-50%);min-width:420px;padding:22px 30px;background:rgba(6,6,6,0.88);border:1px solid rgba(230,230,220,0.35);color:#e8e6dc;font-family:'Courier New',monospace;letter-spacing:0.12em;font-size:15px;line-height:1.9">
      <div style="font-size:13px;opacity:0.7;margin-bottom:8px">GARAGE &nbsp; $${money(this.G)}</div>${rows}
      <div style="font-size:12px;opacity:0.6;margin-top:12px">W S &nbsp;choose &nbsp;&nbsp; A D &nbsp;the grey &nbsp;&nbsp; E &nbsp;bring it out</div></div>`;
  }
  step(dt) {
    const G = this.G, R = G.city;
    // the kept car goes in when it is out of my sight (never a pop in the frame)
    const v = this.goneOf;
    if (v && (!R || R.car !== v || !R.inCar)) {
      const e = G.camera.position, f = G.camera.getWorldDirection(new THREE.Vector3());
      const dx = v.pos.x - e.x, dz = v.pos.z - e.z, d = Math.hypot(dx, dz);
      if (d > 25 || (dx * f.x + dz * f.z) / Math.max(d, 0.1) < 0.2) {
        if (R && R.car === v) R.car = null;
        this.W.V.remove(v); this.goneOf = null;
      }
    }
    if (this.fade) {
      this.fade.t += dt;
      const t = this.fade.t, k = t < 0.35 ? t / 0.35 : t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.4);
      G.hud.fade(k);
      if (t >= 0.35 && !this.fade.done) { this.fade.done = true; this.bring(this.fade.i); }
      if (t > 1.05) { G.hud.fade(0); this.fade = null; G.controller.frozen = false; }
      return;
    }
    const C = this.card;
    if (!C) return;
    if (!R || R.inCar || G.controller.pos.distanceTo(C.at) > 1.2) { this.close(); return; }
    const pr = (k) => G.pressed(k);
    if (pr('KeyW') || pr('ArrowUp')) { C.i = (C.i + this.list.length - 1) % this.list.length; this.draw(); }
    if (pr('KeyS') || pr('ArrowDown')) { C.i = (C.i + 1) % this.list.length; this.draw(); }
    if (pr('KeyA') || pr('KeyD')) { const j = PAINTS.indexOf(C.paints[C.i]); C.paints[C.i] = PAINTS[(j + (pr('KeyD') ? 1 : PAINTS.length - 1)) % PAINTS.length]; this.draw(); G.sfx.play('c3_switch', null, {}); }
    if (pr('KeyE')) {
      const i = C.i, rec = this.list[i], want = C.paints[i];
      if (want !== rec.paint) { if (spend(G, PAINT)) { rec.paint = want; this.stats.repainted++; } else G.hud.message('Not the money for the paint.', 1.8); }
      G.hud.dropLayer('o2garage');
      this.card = null;
      this.fade = { t: 0, i, done: false };
    }
    if (pr('Escape')) this.close();
  }
  // brought out: at the kerb before the door, its way along the street
  bring(i) {
    const rec = this.list.splice(i, 1)[0];
    if (!rec) return;
    const f = this.front();
    const v = this.W.V.spawn(rec.kind, { at: new THREE.Vector3(f.x, 0, f.z), yaw: f.yaw, lights: !!rec.full, fleet: !rec.full, fleetPaint: rec.paint, look: { variant: rec.variant || 0, white: !!rec.white } });
    v.damage = rec.damage || 0;
    if (v.lamps && v.lamps.setOn) v.lamps.setOn(false);
    if (this.G.rays && v.model.meshes.body && !rec.full) this.G.rays.add(v.model.meshes.body);
    this.W.leave(v);
    this.stats.fetched++;
    this.G.save.write();
    this.G.sfx.play('tail_door', null, { open: false });
    this.G.emit('wheels:garage', { what: 'out', car: v });
    void KINDS; void repaint;
  }
  detach() { if (this.card) this.close(); if (this.goneOf) { this.goneOf = null; } this.fade = null; this.G.hud.fade(0); }
}
