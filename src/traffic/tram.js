import * as THREE from 'three';
import { Car } from '../vehicles/Car.js';
import { Headlamps } from '../vehicles/Vehicle.js';
import { figureInk, contactShadow } from '../vehicles/models.js';
import { lathe, merge, roundedBox, tube, V3 } from '../world/geom.js';

// The city's tram (lane O2; the base's tail/tram.js made the city's): on its
// rails down Grand Ave (two tracks in the lanes, between the el's columns,
// cityGen's rails), up the east track and back down the west, over the
// crossover at each end. Not drivable: a moving wall (Car.js treats a
// kinematic car as fixed: what meets it stops). It keeps its pace, stops at
// its stops, at a red signal, and for anything on its track ahead (the bell
// first, rung again while it waits); its lit windows, its lamp, its rumble.
//   tram.v (the body, in vehicles.list) tram.step(dt, eye) tram.s, tram.dir
const LEN = 12.4, WID = 2.5, SPEED = 7.5, X0 = -120, OFF = 1.9;
const Z_N = -404, Z_S = 410, CROSS = 16;
const STOPS = [-360, -165, 15, 195, 380];

let MODEL = null;
function geos() {
  if (MODEL) return MODEL;
  const body = [], dark = [], chrome = [], win = [];
  // the car body: rounded ends, a waist rail, the clerestory roof over it
  body.push(roundedBox(LEN - 0.6, 2.3, WID, 0.35, 2).translate(0, 1.85, 0));
  for (const s of [-1, 1]) body.push(lathe([[0.0, -1.15], [1.0, -1.15], [1.18, -0.6], [1.22, 0.6], [1.1, 1.15], [0.0, 1.15]], 18, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI).rotateZ(0).scale(0.55, 1, 1.02).translate(s * (LEN / 2 - 0.3), 1.85, 0));
  body.push(roundedBox(LEN - 0.4, 0.22, WID + 0.12, 0.08, 1).translate(0, 3.05, 0));
  body.push(roundedBox(LEN - 3.2, 0.42, WID - 0.9, 0.12, 1).translate(0, 3.32, 0));
  // the trucks under it, the fender guards at the ends
  for (const x of [-LEN / 2 + 2.2, LEN / 2 - 2.2]) { dark.push(roundedBox(2.4, 0.55, WID - 0.4, 0.08, 1).translate(x, 0.5, 0)); for (const dx of [-0.7, 0.7]) for (const z of [-0.72, 0.72]) dark.push(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 14).rotateX(Math.PI / 2).translate(x + dx, 0.38, z)); }
  dark.push(roundedBox(LEN - 0.8, 0.3, WID - 0.2, 0.06, 1).translate(0, 0.8, 0));
  for (const s of [-1, 1]) chrome.push(tube([V3(s * (LEN / 2 + 0.1), 0.6, -1.0), V3(s * (LEN / 2 + 0.28), 0.6, 0), V3(s * (LEN / 2 + 0.1), 0.6, 1.0)], 0.06, 6, 12));
  for (const z of [-WID / 2 - 0.01, WID / 2 + 0.01]) chrome.push(tube([V3(-LEN / 2 + 0.6, 1.45, z), V3(LEN / 2 - 0.6, 1.45, z)], 0.025, 5, 4));
  // the trolley pole up to the wire, its shoe
  chrome.push(tube([V3(-1.5, 3.55, 0), V3(-0.2, 4.4, 0), V3(1.4, 5.3, 0)], 0.035, 6, 10));
  chrome.push(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8).rotateX(Math.PI / 2).translate(1.45, 5.32, 0));
  // the windows, lit: the side rows and the ends' screens
  for (let x = -LEN / 2 + 1.3; x < LEN / 2 - 1.1; x += 1.05) for (const z of [-WID / 2 - 0.012, WID / 2 + 0.012]) win.push(new THREE.PlaneGeometry(0.78, 0.92).rotateY(z > 0 ? 0 : Math.PI).translate(x, 2.25, z));
  for (const s of [-1, 1]) win.push(new THREE.PlaneGeometry(1.5, 0.9).rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2).translate(s * (LEN / 2 + 0.38), 2.3, 0));
  // the number board over the screen (unlettered: a pale band)
  for (const s of [-1, 1]) win.push(new THREE.PlaneGeometry(0.9, 0.22).rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2).translate(s * (LEN / 2 + 0.36), 2.95, 0));
  const lamp = [];
  for (const s of [-1, 1]) lamp.push(new THREE.CircleGeometry(0.13, 16).rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2).translate(s * (LEN / 2 + 0.42), 1.25, 0));
  MODEL = { body: merge(body), dark: merge(dark), chrome: merge(chrome), win: merge(win), lamp: merge(lamp) };
  return MODEL;
}

export class Tram {
  constructor(W) {
    this.W = W;
    this.game = W.game;
    const stage = W.stage, M = stage.M;
    const G = geos();
    const g = new THREE.Group();
    g.name = 'tram';
    const mk = (geo, mat, name, em = false) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = false; m.receiveShadow = true; if (em) { m.userData.emitter = true; m.userData.noRay = true; } g.add(m); return m; };
    this.meshes = {
      body: mk(G.body, M.paintGrey, 'body'), dark: mk(G.dark, M.rubber, 'dark'), chrome: mk(G.chrome, M.chrome, 'chrome'),
      win: mk(G.win, new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(1.5) }), 'win', true), lamp: mk(G.lamp, M.headlamp, 'lamp', true),
    };
    contactShadow(g, LEN + 1, WID + 0.8);
    stage.scene.add(g);
    const model = { group: g, meshes: this.meshes, kind: 'tram' };
    // the loop: up the east track (north), the crossover, down the west, the crossover
    const pts = [];
    const add = (x, z) => pts.push([x, z]);
    // (a double-ended car: at each end it stops and runs back the other way over the crossover)
    add(X0 + OFF, Z_S - CROSS); add(X0 + OFF, Z_N + CROSS); add(X0 - OFF, Z_N); add(X0 - OFF, Z_S); add(X0 + OFF, Z_S - CROSS);
    this.legs = [];
    let s = 0;
    for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const L = Math.hypot(bx - ax, bz - az); this.legs.push({ ax, az, bx, bz, L, s0: s }); s += L; }
    this.len = s;
    this.s = 40;
    const p = this.at(this.s);
    const v = new Car(W.V, 'truck', model, { pos: new THREE.Vector3(p.x, 0, p.z), yaw: p.yaw, spec: { halfL: LEN / 2 + 0.3, halfW: WID / 2, mass: 30 } });
    v.inkSlot = figureInk(g);
    v.kind = 'tram';
    v.solid = true;
    const self = this;
    v.driver = { kinematic: true, drive(car, dt) { self.drive(car, dt); } };
    W.V.list.push(v);
    this.v = v;
    this.lamps = new Headlamps(stage, v, [new THREE.Vector3(LEN / 2 + 0.4, 1.25, -0.25), new THREE.Vector3(LEN / 2 + 0.4, 1.25, 0.25)], { reach: 24, intensity: 120, cone: 0.15 });
    v.lamps = this.lamps;
    this.light = stage.lights.add({ position: new THREE.Vector3(), direction: new THREE.Vector3(0, -1, 0), halfAngle: Math.PI, range: 9, intensity: 0.5 });
    this.speed = 0; this.dwell = 0; this.bellT = 0; this.waitT = 0; this.stopIdx = -1;
    this.stats = { stops: 0, waits: 0, bells: 0 };
  }

  at(s, out = {}) {
    s = ((s % this.len) + this.len) % this.len;
    let L = this.legs[0];
    for (const l of this.legs) if (s >= l.s0) L = l;
    const u = Math.min(1, (s - L.s0) / L.L);
    out.x = L.ax + (L.bx - L.ax) * u; out.z = L.az + (L.bz - L.az) * u;
    out.yaw = Math.atan2(-(L.bz - L.az), L.bx - L.ax);
    out.fx = (L.bx - L.ax) / L.L; out.fz = (L.bz - L.az) / L.L;
    return out;
  }

  // its way: its pace, its stops, the signals, what is on the track ahead
  drive(car, dt) {
    const W = this.W, here = this.at(this.s), G = this.game;
    let want = SPEED;
    // (the crossovers slow; at a leg's end that turns it back, a stop and a dwell)
    const sl = ((this.s % this.len) + this.len) % this.len;
    const li = Math.max(0, this.legs.findIndex((l) => sl >= l.s0 && sl < l.s0 + l.L));
    const leg = this.legs[li], next = this.legs[(li + 1) % this.legs.length];
    if (Math.abs(leg.bx - leg.ax) > 0.5) want = 2.2;
    const rev = ((leg.bx - leg.ax) * (next.bx - next.ax) + (leg.bz - leg.az) * (next.bz - next.az)) < 0;
    if (rev) { const toEnd = leg.s0 + leg.L - sl; want = Math.min(want, Math.sqrt(2 * 1.4 * Math.max(0, toEnd - 0.05))); if (toEnd < 0.12 && this.dwell <= 0 && this.revAt !== li) { this.revAt = li; this.dwell = 7; this.s = leg.s0 + leg.L + 0.02; } }
    // anything on its track ahead (a car, a man): stop, the bell
    let block = Infinity;
    for (const o of W.V.list) {
      if (o === car || !o.solid) continue;
      const l = car.local(o.pos, this._l || (this._l = new THREE.Vector3()));
      if (l.x > LEN / 2 - 1 && l.x < LEN / 2 + 16 && Math.abs(l.z) < WID / 2 + (o.spec ? o.spec.halfW : 1) - 0.2) block = Math.min(block, l.x - LEN / 2 - (o.spec ? o.spec.halfL : 1));
    }
    for (const b of W.parked.bodies) { const l = car.local(b.pos, this._l); if (l.x > 0 && l.x < LEN / 2 + 14 && Math.abs(l.z) < WID / 2 + b.spec.halfW - 0.2) block = Math.min(block, l.x - LEN / 2 - b.spec.halfL); }
    const man = W.manPoint();
    if (man) { const l = car.local(man, this._l); if (l.x > 0 && l.x < LEN / 2 + 14 && Math.abs(l.z) < WID / 2 + 0.5) block = Math.min(block, l.x - LEN / 2 - 0.4); }
    if (block < Infinity) {
      want = Math.min(want, Math.max(0, Math.sqrt(Math.max(0, 2 * 2.5 * (block - 2.0)))));
      if (block < 14) { this.bellT -= dt; if (this.bellT <= 0) { this.bellT = 2.2; this.stats.bells++; G.sfx.play('c3_bell', car.pos, { k: 1 }, { ref: 9 }); } }
    }
    // a red signal at the junction ahead (the city's signals, as a car)
    const nz = here.z + here.fz * (LEN / 2 + 1);
    for (const n of W.signals.nodes) {
      if (Math.abs(n.x - X0) > 3) continue;
      const ahead = (n.z - nz) * here.fz;
      if (ahead < 0 || ahead > 30) continue;
      const e = n.edges.find((x) => x.street === 'grand' && Math.sign(here.fz) === Math.sign(((x.a === n.id ? x.bz : x.az) - n.z) * -1));
      const st = W.signals.state(n, e || n.edges.find((x) => x.street === 'grand'));
      const line = ahead - (Math.max(...n.edges.map((x) => x.hw)) + 1.5);
      if (st !== 'go' && line > 1.5) want = Math.min(want, Math.sqrt(Math.max(0, 2 * 2.5 * (line - 0.5))));
      break;
    }
    // its stops: in, a dwell, the bell, away
    if (this.dwell > 0) { this.dwell -= dt; want = 0; if (this.dwell <= 0) { G.sfx.play('c3_bell', car.pos, { k: 0.8 }, { ref: 9 }); } }
    else {
      for (let i = 0; i < STOPS.length; i++) {
        const d = (STOPS[i] - here.z) * here.fz;
        if (Math.abs(leg.bx - leg.ax) > 0.5) break;
        if (d > 0 && d < 40) { want = Math.min(want, Math.sqrt(2 * 1.6 * Math.max(0, d - 0.3))); if (d < 0.6 && this.stopIdx !== i * Math.sign(here.fz)) { this.stopIdx = i * Math.sign(here.fz); this.dwell = 6; this.stats.stops++; } }
      }
    }
    const a = want > this.speed ? 1.2 : 3.0;
    this.speed += Math.max(-a * dt, Math.min(a * dt, want - this.speed));
    if (this.speed < 0.05 && want < 0.05) this.speed = 0;
    this.waitT = this.speed < 0.1 ? this.waitT + dt : 0;
    this.s += this.speed * dt;
    const p = this.at(this.s);
    // (the yaw eased round the crossover: no snap; a double-ended car runs
    // either way along its length, so the nearer of the two headings)
    let dyaw = Math.atan2(Math.sin(p.yaw - car.yaw), Math.cos(p.yaw - car.yaw));
    if (Math.abs(dyaw) > Math.PI / 2) dyaw -= Math.sign(dyaw) * Math.PI;
    car.yaw += dyaw * Math.min(1, dt * 3);
    car.vel.set(p.x - car.pos.x, 0, p.z - car.pos.z).multiplyScalar(1 / Math.max(dt, 1e-4));
    car.pos.set(p.x, 0, p.z);
    car.yawRate = 0;
  }

  step(dt, eye) {
    const v = this.v;
    v.step(dt);
    this.light.position.set(v.pos.x, 2.6, v.pos.z);
    const S = this.game.sfx, d = Math.hypot(v.pos.x - eye.x, v.pos.z - eye.z);
    if (S && S.live && d < 140 && this.speed > 0.5) S.loop('c3_tram', v.pos, 0.25 * Math.min(1, this.speed / SPEED), 'brown', 110 + this.speed * 6, 0, true);
    else if (S && S.loops && S.loops.has('c3_tram')) S.stopLoop('c3_tram');
  }

  dispose() {
    const W = this.W;
    const i = W.V.list.indexOf(this.v);
    if (i >= 0) W.V.list.splice(i, 1);
    this.lamps.dispose();
    W.stage.lights.remove(this.light);
    if (this.v.body.parent) this.v.body.parent.remove(this.v.body);
  }
}
