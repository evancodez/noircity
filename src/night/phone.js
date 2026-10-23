import * as THREE from 'three';

// The phone box (lane O7, docs/seams/NIGHT.md §5): E at a call box (O1's
// furniture) with $50: the dial, a voice's buzz, and a car brought to the
// kerb beside the box a little later (`A car is coming.`, then `Your car.`
// with its ring on the minimap until I am in it). Without the money the
// phone still clicks: `$50 for a car`. The car brought is the one I take
// (the free roam's car: game.city.car); the old one stays where I left it.
// (O2's car at a point when it merges: a man drives it in; until then it is
// set at the kerb out of my sight.)
export const PHONE = { cost: 50, wait: 35, reach: 1.9, lookMax: 25 };
const _v = new THREE.Vector3();

export class PhoneBox {
  constructor(night) {
    this.night = night;
    this.boxes = null;
    this.order = null;   // { box, t, bay }
    this.prompted = false;
    this.calls = 0;
    night.game.on('city:in', (e) => { if (this.order && this.order.car && e && e.car === this.order.car) this.done(); });
    night.game.on('scene:enter', () => { this.order = null; this.prompted = false; });
  }
  get G() { return this.night.game; }

  setup() {
    if (this.boxes) return this.boxes;
    const C = this.night.C();
    if (!C) return null;
    this.boxes = C.props.filter((p) => p.kind === 'callbox');
    return this.boxes;
  }

  step(dt) {
    const N = this.night, G = this.G;
    if (!N.inCity || G.failing || N.el.riding) { if (this.prompted) this.prompt(false); return; }
    if (this.order) this.wait(dt);
    const R = G.city;
    if (R && R.inCar) { if (this.prompted) this.prompt(false); return; }
    const B = this.setup();
    if (!B) return;
    const p = G.controller.pos;
    let near = null, nd = PHONE.reach;
    for (const b of B) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < nd) { nd = d; near = b; } }
    // (looking at it, roughly)
    if (near) {
      const f = G.camera.getWorldDirection(_v);
      const tx = near.x - G.eye.x, tz = near.z - G.eye.z, tl = Math.max(0.05, Math.hypot(tx, tz)), fl = Math.max(1e-3, Math.hypot(f.x, f.z));
      if ((tx * f.x + tz * f.z) / (tl * fl) < 0.5) near = null;
    }
    const text = this.order ? 'E  the phone' : G.save.money >= PHONE.cost ? `E  call for a car  $${PHONE.cost}` : 'E  the phone';
    this.prompt(!!near, text);
    if (near && G.keysDown.has('KeyE')) { G.keysDown.delete('KeyE'); this.use(near); }
  }

  prompt(on, text) {
    const H = this.G.hud;
    if (on && (!this.prompted || H.promptShown !== text)) H.prompt(text, null, 'nphone');
    else if (!on && this.prompted) H.clearPrompt('nphone');
    this.prompted = on;
  }

  use(box) {
    const G = this.G;
    if (G.sfx) G.sfx.play('n_phone', new THREE.Vector3(box.x, 1.4, box.z), {}, { ref: 1.5, send: false });
    if (this.order) { G.hud.message('it is on its way', 1.6); return; }
    if (G.save.money < PHONE.cost) { G.hud.message(`$${PHONE.cost} for a car`, 1.8); return; }
    G.save.money -= PHONE.cost;
    this.calls++;
    this.order = { box, t: 0, car: null };
    this.night.take('phone', 'A car is coming.');
    G.emit('phone:call', { box });
  }

  wait(dt) {
    const O = this.order, G = this.G, N = this.night;
    O.t += dt;
    if (O.car) {
      // (the ring stays until I get in, or a minute)
      if (O.t > 60) this.done();
      return;
    }
    if (O.t < PHONE.wait) return;
    // the kerb by the box, out of my sight if it can be (a man drove it there)
    const g = N.graph();
    if (!g) return;
    const bays = g.baysNear(O.box.x, O.box.z, 60);
    const e = G.eye, f = G.camera.getWorldDirection(_v);
    const seen = (b) => { const tx = b.x - e.x, tz = b.z - e.z, tl = Math.max(0.05, Math.hypot(tx, tz)); return tl < 10 || (tx * f.x + tz * f.z) / tl > 0.55; };
    // (the kerb by the box: a bay in the box's own street, no building between)
    const near = bays.filter((b) => g.lineOfSight(O.box.x, O.box.z, b.x, b.z) !== false);
    let bay = near.find((b) => !seen(b) && !this.taken(b));
    if (!bay && O.t > PHONE.wait + PHONE.lookMax) bay = near.find((b) => !this.taken(b)) || bays.find((b) => !this.taken(b));
    if (!bay) return;
    const V = G.vehicles;
    const car = V.spawn('coupe', { at: new THREE.Vector3(bay.x, 0, bay.z), yaw: bay.yaw, lights: true });
    if (car.lamps && car.lamps.setOn) car.lamps.setOn(false);
    car.driver = null;
    if (G.city) G.city.car = car;
    O.car = car; O.t = 0;
    N.target = { x: bay.x, z: bay.z, kind: 'phone' };
    N.take('phone', 'Your car.');
    G.emit('phone:car', { car, bay });
  }
  taken(b) { return this.G.vehicles.list.some((v) => Math.hypot(v.pos.x - b.x, v.pos.z - b.z) < 4); }

  done() {
    this.order = null;
    if (this.night.target && this.night.target.kind === 'phone') this.night.target = null;
    this.night.take('phone', null);
  }
}
