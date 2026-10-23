import * as THREE from 'three';
import { Pilot } from './pilot.js';
import { lanePath } from '../traffic/path.js';
import { lampsLit, KINDS } from './kinds.js';
import { money, pay, spend } from '../traffic/seams.js';

// The race (lane O2): at the Yards' corner (the Straight at Water St), by
// night, three cars at the line with their lamps on and a man with a flag.
// Stop by them in a car and E: a bet of $10 (or nothing, if I have nothing:
// a race for its own sake), a short black (the grid), the flag up - three,
// two, one - and down: three laps of the Yards' loop (up the Straight, along
// Centre St, down Foundry St, along Water St: all right turns, 700 m a lap),
// the others driven by the base's Pilot at three paces. The line crossed
// first after three laps is the win and the purse ($30, or $5 for glory).
// The field's lead man eases off a little against a man he has beaten (he
// has his money): a step for each loss in a row, two at most, his best
// again once he is beaten - so a fair driver wins in one to three.
// Idle loses (they finish: `They’re ahead.` first, on the last lap); off the
// course too long is out of it (`Back on the course.` first). Traffic is kept
// off the loop while it runs.
//   race.state 'idle' | 'grid' | 'run' | 'done'; race.result { won, place, time, laps }
//   race.stats { races, won, lost, out, best }
// Events: 'wheels:race' { what: 'start' | 'lap' | 'end', ... }
const LOOP = ['-4500,2400', '-4500,1500', '-4500,600', '-4500,-300', '-3700,-300', '-3700,600', '-3700,1500', '-3700,2400'];
const LAPS = 3, BET = 10, BOX = { x0: -470, x1: -350, z0: -55, z1: 265 };
const START = { x: -450, z: 222 };      // the line: on the Straight 18 m north of Water St
export const RACE = { paces: [1.04, 0.99, 0.94], ease: 0.05, kinds: ['coupe', 'saloon', 'coupe'], LAPS, BET };
const _v = new THREE.Vector3();

export class Race {
  constructor(W) {
    this.W = W;
    this.G = W.game;
    this.state = 'idle';
    this.cars = [];
    this.flag = null;
    this.stats = { races: 0, won: 0, lost: 0, out: 0, best: null };
    this.ease = 0;      // (losses in a row: the field's lead eases a step for each, two at most)
    // the course: three laps, then the run on past the line; its length a lap
    const g = W.graph;
    const ids = [];
    for (let l = 0; l < LAPS + 1; l++) for (const id of LOOP) ids.push(id);
    ids.push(LOOP[0], LOOP[1]);
    this.path = lanePath(g, ids, { vmax: 24, aLat: 7.0, aBrake: 6.5, rRight: 9, rLeft: 9, off: 1.2 });
    // the line (s0: on the Straight at START) and a lap's length (the corner's node met again)
    const P = this.path;
    this.s0 = P.pts[P.nearestAll(START.x, START.z)].s;
    const meets = P.nodes.filter((n) => n.id === LOOP[0]).map((n) => n.s);
    this.lap = meets.length > 1 ? meets[1] - meets[0] : 700;
    this.len = this.lap * LAPS;   // (the distance to run from the line)
    W.extras.push(this);
  }

  // ---- the corner: the cars, the flag ---------------------------------------------------------------
  site() {
    const W = this.W, eye = this.G.camera.position;
    const d = Math.hypot(eye.x - START.x, eye.z - START.z);
    if (this.state === 'idle' && d < 230 && !this.cars.length) this.setUp();
    if (this.state === 'idle' && d > 300 && this.cars.length) this.takeDown();
    void W;
  }
  // (the grid: two by two across the Straight, the line before them)
  slot(i) {
    const p = this.path.pts[0], q = this.path.pts[6];
    const fx = (q.x - p.x), fz = (q.z - p.z), l = Math.hypot(fx, fz);
    const ux = fx / l, uz = fz / l, rx = -uz, rz = ux;
    const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    return { x: START.x - ux * (2 + row * 7) + rx * side * 1.9, z: START.z - uz * (2 + row * 7) + rz * side * 1.9, yaw: Math.atan2(-uz, ux) };
  }
  // (waiting: one behind another at the kerb on the right, short of the line)
  kerb(i) {
    const p = this.path.pts[0], q = this.path.pts[6];
    const fx = (q.x - p.x), fz = (q.z - p.z), l = Math.hypot(fx, fz);
    const ux = fx / l, uz = fz / l, rx = -uz, rz = ux;
    const S = this.W.graph.streetAt(START.x, START.z), e = S && S.edge;
    const off = e ? (e.park || Math.max(3.2, (e.hw || 7) - 1.15)) : 4.2;
    return { x: START.x - ux * (3 + i * 6.6) + rx * off, z: START.z - uz * (3 + i * 6.6) + rz * off, yaw: Math.atan2(-uz, ux) };
  }
  setUp() {
    const W = this.W;
    for (let i = 0; i < 3; i++) {
      const s = this.kerb(i);
      const v = W.carAt(s.x, s.z, RACE.kinds[i], { yaw: s.yaw, lights: true, look: [{ variant: 2, paint: 'paint', white: true }, { variant: 1, paint: 'paintGrey', white: false }, { variant: 1, paint: 'paintPale', white: true }][i] });
      v.racer = true; v.parked = true;   // (at the kerb till the flag: a parked car to the traffic)
      if (v.model.meshes.bust) v.model.meshes.bust.visible = true;
      v.input.brake = 1; v.input.hold = 1;
      this.W.ownLamps(v);
      this.cars.push({ v, pace: RACE.paces[i], s: 0, done: false });
    }
    // the man with the flag at the kerb up ahead of the line, facing the grid (seen from the pole)
    const p = this.path.pts[0];
    try {
      const c = W.stage.cast.spawn('o2_fare', { at: { x: START.x + 7.4, z: START.z - 16 }, yaw: Math.atan2(-7.4, 20), name: 'o2flag' });
      c.hold(flagProp(W.stage), 'R');
      c.play('o2_flagUp');
      this.flag = c;
    } catch (e) { this.flag = null; }
    void p;
  }
  takeDown() {
    for (const c of this.cars) { if (this.G.rays && c.v.model.meshes.body) this.G.rays.remove(c.v.model.meshes.body); this.W.V.remove(c.v); }
    this.cars = [];
    if (this.flag) { try { this.W.stage.cast.remove(this.flag); } catch (e) { /* gone */ } this.flag = null; }
  }

  // ---- each step --------------------------------------------------------------------------------------
  step(dt) {
    const G = this.G, R = G.city, hud = G.hud, W = this.W;
    this.site();
    // (the frame rate's bed: &racego=1 - the race started under me at once)
    if (this.state === 'idle' && this.cars.length && R && R.inCar && typeof location !== 'undefined' && new URLSearchParams(location.search).get('racego') && !this.bedDone) { this.bedDone = true; this.start(R.car); }
    for (const c of this.cars) if (c.v.driver && c.v.driver !== 'player') c.v.step(dt);
    else if (this.state !== 'run') { c.v.input.brake = 1; c.v.input.throttle = 0; c.v.step(dt); }
    if (this.fade) {
      this.fade.t += dt;
      const t = this.fade.t, k = t < 0.35 ? t / 0.35 : t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
      hud.fade(k);
      if (t >= 0.35 && !this.fade.done) { this.fade.done = true; this.grid(); }
      if (t > 1.0) { hud.fade(0); this.fade = null; }
    }
    if (this.state === 'idle') {
      const v = R && R.inCar ? R.car : null;
      const near = !!v && this.cars.length && Math.hypot(v.pos.x - START.x, v.pos.z - START.z) < 26 && v.speedAbs < 1.5;
      if (near !== !!this.shown) { this.shown = near; if (near) hud.prompt(money(G) >= BET ? `E  race them  $${BET}` : 'E  race them', null, 'o2race'); else hud.clearPrompt('o2race'); }
      if (near && G.pressed('KeyE')) this.start(v);
      return;
    }
    if (this.state === 'grid') {
      this.t += dt;
      const v = R.car;
      // (held on the line: a jumped start is held back, and told)
      v.input.throttle = 0; v.input.brake = 1;
      if ((G.held('KeyW') || G.held('ArrowUp')) && this.t > 0.6 && !this.jumped) { this.jumped = true; hud.warn('Wait for the flag.'); }
      if (this.t > 3.4) this.go();
      return;
    }
    if (this.state === 'run') this.run(dt);
    if (this.state === 'done') {
      for (const c of this.cars) if (c.pilot && !c.pulled && c.pilot.s > this.s0 + this.len + 4) { c.pulled = true; c.pilot.offset = 2.6; }
      this.doneT += dt; if (this.doneT > 6) this.reset();
    }
  }

  start(v) {
    const G = this.G;
    G.hud.clearPrompt('o2race'); this.shown = false;
    this.bet = spend(G, BET) ? BET : 0;
    this.me = v;
    this.state = 'grid'; this.t = -0.6; this.jumped = false;
    this.fade = { t: 0, done: false };
    this.stats.races++;
    G.emit('wheels:race', { what: 'start', bet: this.bet });
  }
  // (under the black: me on the grid's pole, the traffic off the loop)
  grid() {
    const G = this.G, W = this.W, v = this.me;
    const s = this.slot(0);
    v.place(new THREE.Vector3(s.x, 0, s.z), s.yaw, 0);
    for (let i = 0; i < this.cars.length; i++) { const q = this.slot(i + 1); this.cars[i].v.place(new THREE.Vector3(q.x, 0, q.z), q.yaw, 0); }
    for (const c of [...W.traffic.cars]) if (inBox(c.v.pos)) W.traffic.drop(c);
    W.traffic.avoid = inBox;
    G.hud.objective(`Three laps.`);
    if (this.flag) this.flag.play('o2_flagUp');
    G.hud.teach('o2_race', '[W] go when the flag drops', { until: false, secs: 2.6 });
  }
  go() {
    const G = this.G;
    this.state = 'run'; this.t = 0;
    G.hud.warn(null);
    if (this.flag) this.flag.play('o2_flagDown');
    G.sfx.play('tail_horn', this.flag ? this.flag.fig.pos : this.me.pos, { k: 0.6, dur: 0.15 }, { ref: 8 });
    const ease = Math.min(2, this.ease) * RACE.ease;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      c.pace = RACE.paces[i] - ease;
      const p = new Pilot(this.path, { pace: c.pace, vmax: 24, keep: 4, bodies: () => this.W.bodiesFor(c.v), overtake: true });
      // (the course goes round the same streets three times: found on its first lap)
      p.i = this.path.nearest(c.v.pos.x, c.v.pos.z, 0, 120); p.s = this.path.pts[p.i].s;
      // (each stops past the line at the end: the run on is the path's last stretch)
      p.o.stopAt = this.s0 + this.len + 60;
      c.v.driver = p; c.v.input.hold = 0; c.pilot = p; c.v.parked = false;
    }
    this.mine = { s: 0, i: this.path.nearest(this.me.pos.x, this.me.pos.z, 0, 120), lap: 0, off: 0 };
    this.lastLap = 0;
  }
  run(dt) {
    const G = this.G, hud = G.hud, R = G.city, v = this.me, P = this.path;
    this.t += dt;
    // (a car of the traffic come onto the course while it runs, out of my sight: gone)
    for (const c of [...this.W.traffic.cars]) if (inBox(c.v.pos) && this.W.traffic.hidden(G.camera.position, c.v.pos.x, c.v.pos.z, Math.hypot(c.v.pos.x - G.camera.position.x, c.v.pos.z - G.camera.position.z))) this.W.traffic.drop(c);
    // my place on the course
    const M = this.mine;
    M.i = P.nearest(v.pos.x, v.pos.z, M.i, 40);
    const p = P.pts[M.i];
    // (the way run from the line; never back: a car turned round runs no laps)
    if (p.s - this.s0 - M.s < 30) M.s = Math.max(M.s, p.s - this.s0);
    const off = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
    M.off = off > 22 ? M.off + dt : 0;
    for (const c of this.cars) c.s = c.pilot ? c.pilot.s - this.s0 : 0;
    const lap = Math.min(LAPS, Math.floor(M.s / this.lap) + 1);
    const place = 1 + this.cars.filter((c) => c.s > M.s).length;
    const word = ['First.', 'Second.', 'Third.', 'Last.'][place - 1];
    const line = lap >= LAPS ? `Last lap. ${word}` : `Lap ${lap} of ${LAPS}. ${word}`;
    if (line !== this.line) { this.line = line; hud.objective(line, { strike: false }); }
    if (lap !== this.lastLap) { this.lastLap = lap; G.emit('wheels:race', { what: 'lap', lap }); }
    // the warnings before the loss: off the course; behind on the last lap
    const away = M.off > 0.5 || !R.inCar || R.car !== v;
    const behind = lap >= LAPS && place > 1 && this.cars.some((c) => c.s > this.len - 0.45 * this.lap);
    hud.warn(away ? 'Back on the course.' : behind ? 'They’re ahead.' : null);
    if (M.off > 8 || (!R.inCar && this.t > 1)) { this.end(false, 'Out of the race.'); this.stats.out++; return; }
    if (M.s >= this.len - 1.5) { this.end(true); return; }
    const first = this.cars.find((c) => c.s >= this.len - 1.5);
    if (first) this.end(false, 'Beaten.');
  }
  end(won, why = null) {
    const G = this.G;
    this.state = 'done'; this.doneT = 0;
    G.hud.warn(null);
    G.hud.objective(null);
    const place = 1 + this.cars.filter((c) => c.s > this.mine.s).length;
    this.result = { won, place, time: +this.t.toFixed(1), laps: Math.min(LAPS, Math.floor((this.mine.s + 2) / this.lap)), why };
    this.ease = won ? 0 : Math.min(2, this.ease + 1);
    if (won) { this.stats.won++; this.stats.best = Math.min(this.stats.best ?? 1e9, this.t); pay(G, this.bet ? this.bet * 3 : 5, 'the purse'); G.hud.message('Won.', 2.4); }
    else { this.stats.lost++; G.hud.message(why || 'Beaten.', 2.4); }
    // (the others run their laps out, over the line, pull in to the kerb past it and stop, one behind another)
    const order = this.cars.filter((c) => c.pilot).sort((a, b) => b.pilot.s - a.pilot.s);
    order.forEach((c, i) => { c.pilot.o.stopAt = Math.min(this.path.len - 2, this.s0 + this.len + 45 - 9 * i); c.pulled = false; });
    this.W.traffic.avoid = null;
    G.emit('wheels:race', { what: 'end', ...this.result });
  }
  // the corner set again for the next (when I am away from it and it is out of my sight)
  reset() {
    const eye = this.G.camera.position;
    const d = Math.hypot(eye.x - START.x, eye.z - START.z);
    const seen = (x, z) => !this.W.traffic.hidden(eye, x, z, Math.hypot(eye.x - x, eye.z - z));
    if (d < 60 || seen(START.x, START.z) || this.cars.some((c) => seen(c.v.pos.x, c.v.pos.z))) { this.doneT = 5; return; }
    this.takeDown();
    this.state = 'idle';
  }
  detach() { this.takeDown(); this.state = 'idle'; this.fade = null; this.W.traffic.avoid = null; }
}
const inBox = (p) => p.x > BOX.x0 && p.x < BOX.x1 && p.z > BOX.z0 && p.z < BOX.z1;

// the race's flag: a white cloth on a short stick
let FLAG = null;
function flagProp(stage) {
  if (!FLAG) {
    const stick = new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6).translate(0, 0.35, 0);
    const cloth = new THREE.PlaneGeometry(0.42, 0.3, 4, 2).translate(0.22, 0.55, 0);
    FLAG = { stick, cloth };
  }
  const g = new THREE.Group();
  const s = new THREE.Mesh(FLAG.stick, stage.M.iron), c = new THREE.Mesh(FLAG.cloth, new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.8, side: THREE.DoubleSide }));
  for (const m of [s, c]) { m.userData.noRay = true; g.add(m); }
  g.userData = { kind: 'flag', grip: new THREE.Matrix4(), size: new THREE.Vector3(0.04, 0.7, 0.04) };
  return g;
}
export const _unusedK = KINDS; export const _unusedL = lampsLit; export const _unusedV = _v;
