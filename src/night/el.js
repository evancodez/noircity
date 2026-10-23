import * as THREE from 'three';
import { OVERPASS } from '../world/Overpass.js';

// The el (lane O7, docs/seams/NIGHT.md §5): a ride round the loop for the
// view. At the foot of a station's stair, `E  take the el`: a breath of black
// and I am up front in the first car of the next train, the avenue and the
// iron running at me; the train pulls in at each station (the chime, the
// doors, seven seconds) and `E  get off` puts me at that station's stair
// foot on the pavement. The mouse looks round (the 'hold' mode: the eye rides
// the car). Nothing locks: E at a stop ends it, ESC pauses as anywhere.
// The train is the stage's (src/stages/noircity/parts/train.js): while I
// ride, the night steps it (pulled in at the stations, never gone after one
// loop); when I get off it runs on its own way.
// [O7] after the critic (M4: the view was 80 % black - the dark storeys at the eye's height): the eye lower at
// the window and pitched down, turned more to the street side, so the avenue, its lamps and the pavements are in
// the frame; the train a little quicker between stations
export const EL_RIDE = { vmax: 17, acc: 1.6, dwell: 7, reach: 2.6, fade: 0.35, look: 0.2, pitch: -0.18, eyeY: 2.5, out: 0.7 };
const LEN = 13.6, GAP = 0.9;
const _f = {};

export class ElRide {
  constructor(night) {
    this.night = night;
    this.riding = false;
    this.prompted = false;
    this.stops = null;
    this.rides = 0;
  }

  get G() { return this.night.game; }

  // the stops along the line (s), measured once
  setup() {
    if (this.stops) return this.stops;
    const st = this.G.stage, el = st.part && st.part('el');
    if (!el || !el.stops) return null;
    const line = el.line;
    this.line = line;
    this.stops = el.stops.map((S) => {
      let best = 0, bd = Infinity;
      for (let s = 0; s < line.len; s += 1) { line.at(s, _f); const d = Math.hypot(_f.x - S.x, _f.z - S.z); if (d < bd) { bd = d; best = s; } }
      const side = S.side === 'e' ? 1 : -1;
      // (the stair's foot on the pavement: its low end, a stride clear of it)
      return { ...S, s: best, side, foot: { x: S.stair.x, z: S.stair.z + 9.2 } };
    });
    return this.stops;
  }

  // one fixed step
  step(dt) {
    const N = this.night, G = this.G;
    if (!N.inCity || G.failing) { if (this.prompted) this.prompt(false); return; }
    if (this.fadeT != null) { this.stepFade(dt); return; }
    if (this.riding) { this.ride(dt); return; }
    const R = G.city;
    if (R && R.inCar) { if (this.prompted) this.prompt(false); return; }
    const S = this.setup();
    if (!S) return;
    const p = G.controller.pos;
    let near = null;
    for (const s of S) if (Math.hypot(p.x - s.foot.x, p.z - s.foot.z) < EL_RIDE.reach) near = s;
    this.prompt(!!near, 'E  take the el');
    if (near && G.keysDown.has('KeyE')) { G.keysDown.delete('KeyE'); this.board(near); }
  }

  prompt(on, text) {
    const H = this.G.hud;
    if (on && !this.prompted) H.prompt(text, null, 'nel');
    else if (!on && this.prompted) H.clearPrompt('nel');
    else if (on && H.promptShown !== text) H.prompt(text, null, 'nel');
    this.prompted = on;
  }

  // a breath of black, then the thing (in: board; out: get off)
  fadeTo(fn) { this.fadeT = 0; this.fadeFn = fn; this.fadeDone = false; }
  stepFade(dt) {
    this.fadeT += dt;
    const F = EL_RIDE.fade, k = this.fadeT < F ? this.fadeT / F : Math.max(0, 1 - (this.fadeT - F - 0.15) / 0.5);
    this.G.scenes.setFade(k);
    if (!this.fadeDone && this.fadeT >= F) { this.fadeDone = true; this.fadeFn(); }
    if (this.fadeT > F + 0.65) { this.fadeT = null; this.G.scenes.setFade(0); }
  }

  board(stop) {
    const G = this.G, tr = G.stage.train || G.stage.part('train');
    if (!tr) return;
    this.prompt(false);
    if (G.sfx) G.sfx.play('n_chime', null, {}, { send: false });
    this.fadeTo(() => {
      this.riding = true; this.rides++;
      this.tr = tr;
      this.dir = 1;
      // the train stands at this stop, its first car at the platform
      this.s = stop.s + this.dir * (LEN / 2);
      this.v = 0;
      this.dwell = EL_RIDE.dwell * 0.6;
      this.at = stop;
      tr.run(this.s, this.dir);
      tr.beam.visible = false; tr.halo.visible = false;
      // the night drives it while I ride (Game.post calls tr.update: it only places the cars)
      this.trUpdate = tr.update;
      this.trRumble = tr.onRumble; tr.onRumble = null;
      const me = this;
      // (no camera: the part's shake and rumble are for a man under the el, not one in it - the ride has its own)
      tr.update = function (dt, t, opts) { this.s = me.s; this.run0 = me.s; return me.trUpdate.call(this, 0, t, { ...opts, camera: null }); };
      const eye = this.eyeAt(new THREE.Vector3());
      G.controller.setMode('hold', { at: eye, face: this.face(), yaw: 0, pitch: EL_RIDE.pitch });
      // (THINGS_TO_DO §6: a man chased onto the el is lost at the next station if they did not see him board)
      const P = G.police; this.unseen = !!(P && P.heat > 0 && P.searching);
      G.emit('el:board', { stop: stop.name });
      this.night.hud.lines.taken = null;
    });
  }

  // the eye: at a window of the first car, its front end, on the side its
  // track runs (the outer rail: the street, the lamps and the shop fronts
  // below, the iron going by), looking out ahead and down at the avenue
  eyeAt(out) {
    const line = this.line;
    line.at(this.s - this.dir * 3.0, _f);
    const deck = OVERPASS.deckY + OVERPASS.girderH - 0.1;
    const tr = (1.7 + 1.25 + EL_RIDE.out) * (this.dir > 0 ? 1 : -1);
    return out.set(_f.x - _f.nx * tr, deck + EL_RIDE.eyeY, _f.z - _f.nz * tr);
  }
  // (the travel's way turned out toward the window's side)
  face() { this.line.at(this.s, _f); return Math.atan2(-_f.fx * this.dir, -_f.fz * this.dir) + EL_RIDE.look; }

  ride(dt) {
    const G = this.G, line = this.line;
    // the next stop ahead and the distance to where the car pulls in
    let ahead = Infinity, next = null;
    for (const st of this.stops) {
      const want = st.s + this.dir * (LEN / 2);
      let d = ((want - this.s) * this.dir) % line.len; if (d < 0) d += line.len;
      // (the station just left is behind me, not a metre ahead)
      if (this.dwell <= 0 && st === this.left && (d < 2 || d > line.len - 2)) continue;
      if (d < ahead) { ahead = d; next = st; }
    }
    if (this.dwell > 0) {
      this.dwell -= dt;
      this.v = 0;
      this.prompt(true, 'E  get off');
      if (G.keysDown.has('KeyE')) { G.keysDown.delete('KeyE'); this.getOff(this.at); return; }
      if (this.dwell <= 0) { this.prompt(false); this.left = this.at; this.at = null; if (G.sfx) G.sfx.play('n_chime', null, { k: 0.6 }, { send: false }); }
    } else {
      // brake for the stop: v^2 = 2 a d
      const vStop = Math.sqrt(2 * EL_RIDE.acc * Math.max(0, ahead - 0.3));
      this.v = Math.min(EL_RIDE.vmax, this.v + EL_RIDE.acc * dt, vStop);
      this.s += this.dir * this.v * dt;
      if (ahead < 0.4 && this.v < 0.6) { this.dwell = EL_RIDE.dwell; this.at = next; this.v = 0; if (G.sfx) G.sfx.play('n_chime', null, {}, { send: false }); G.emit('el:stop', { stop: next.name }); const P = G.police; if (P && P.heat > 0 && this.unseen && P.searching && P.lost) { P.lost(); this.unseen = false; } }
    }
    const H = G.controller.hold;
    if (H) { this.eyeAt(H.at); H.face = this.face(); }
    // the car's rumble under me, by the speed; a little sway, never a shake
    if (G.sfx) G.sfx.train(0.25 + 0.35 * (this.v / EL_RIDE.vmax), H ? H.at : G.eye);
    if (this.v > 1 && Math.random() < 0.02 * this.v / EL_RIDE.vmax) G.controller.shake(0.02, 0);
    if (G.controller.mode !== 'hold') this.end();
  }

  getOff(stop) {
    const G = this.G;
    this.prompt(false);
    this.fadeTo(() => {
      this.end();
      // (the stair runs north from its foot: I come off it facing south, down the pavement)
      G.controller.setPose(stop.foot.x, stop.foot.z, Math.PI, -0.04);
      G.stage.part('bounds').navAround(stop.foot.x, stop.foot.z, 14);
      G.emit('el:off', { stop: stop.name });
    });
  }

  end() {
    const tr = this.tr;
    this.riding = false;
    if (tr && this.trUpdate) { tr.update = this.trUpdate; this.trUpdate = null; tr.onRumble = this.trRumble; tr.run0 = tr.s; tr.beam.visible = true; tr.halo.visible = true; }
    if (this.G.sfx) this.G.sfx.train(0);
    this.prompt(false);
  }
}
