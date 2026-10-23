import * as THREE from 'three';
import { FIRE, ATLAS } from '../fx/fxTextures.js';
import { FIRE_COL } from '../fx/Explosion.js';
import { Fire } from '../fx/Fire.js';
import { buildWreck, wreckMaterials, WRECK_DROP } from './Wreck.js';
import { SEDAN_SHAPES } from '../world/Cars.js';
import { SURF } from '../util/RayWorld.js';

// [O6] What a car shows of what it met (lane O6; docs/seams/SMASH.md §3).
// The rule for every car of game.vehicles, mine or theirs, any kind (the
// coupe, the sedan, the truck, the wheels lane's): it is attached the first
// step a car is in the list and dropped (everything it was given put back)
// when the car leaves it.
//   by where it was hit (a knock's point in the car's frame: its corner)
//     a dent (its body pushed in there), the wing crumpled at a corner, the
//     headlamp on that side out, the glass on that side gone (a sedan's),
//     a door hanging on its hinge (a side hit), and at a hard blow - any
//     speed, as lane C3b's wreck - the corner down on its broken spring and
//     the body twisted onto it, glass grains on the road, the bonnet's steam
//   the engine (Car.damage 0 .. 4: Car.hurt, the knocks and the rounds)
//     1.5 steam, 2.5 grey smoke and the power going, 3.3 FIRE: flames at the
//     bonnet's seams and black smoke (the warning: `She's burning. Get out.`
//     when it is mine) and, FUSE s later, the blast (the flash on the wet,
//     the shards, what stands near goes over, a man near is hurt) and the
//     WRECK: a body burnt in a few strokes (destruct/Wreck.js), on its rims,
//     twisted onto its worst corner, burning down to embers; it stays,
//     solid (a wall for a car, a box for a man), never driven again
//   the tyres: a round near a wheel flattens it (that corner down, the
//     grip gone, the wheel pulling to that side; a rim sparks on the road)
//   the tram: on a car in its way it strikes sparks (bump / lean)
// A car is never wrecked by one blow from below the fire's step (Car.warnAt).
// Bullets meet a car as a box in the bullets' world riding with it (its
// hull, ud.prop: { car }) - Smash.bullet sends them here.
export const STEAM = 1.5, SMOKE = 2.5, BURN = 3.3, FUSE = 7, FUSE_HOT = 3;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _b = new THREE.Box3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CORNER_KEYS = ['fl', 'fr', 'rl', 'rr'];
const GRIP_KEYS = ['fl', 'fr', 'rl', 'rr'];
// (which meshes of a car's body are its skin: a dent pushes them in)
const SKIN = ['paint', 'chrome', 'dark', 'skirt', 'seams', 'trim'];
let WRECK = null;

export class CarDamage {
  constructor(smash) {
    this.smash = smash;
    this.list = [];
    this.byCar = new Map();
    this.fires = [];
    this.trams = [];
  }
  get stage() { return this.smash.stage; }
  get game() { return this.smash.stage.game; }

  // ---- attached to a car, dropped from it --------------------------------------------------------
  attach(v) {
    const S = v.spec;
    const D = {
      v, corners: { fl: 0, fr: 0, rl: 0, rr: 0 }, dents: { fl: 0, fr: 0, rl: 0, rr: 0 }, smashed: new Set(), lampOut: [false, false],
      tyres: [0, 0, 0, 0], state: 'whole', acc: { steam: 0, smoke: 0, flame: 0, rim: 0, spark: 0 }, fuse: null, fire: null, door: null,
      geo0: new Map(), hidden: [], added: [], proxy: null, entry: null, sagP: 0, sagR: 0, crushP: 0, crushR: 0, knockT: 0, t: 0,
      top: S.top ?? (v.kind === 'truck' ? 3.0 : 1.75), panesHit: new Map(),
    };
    v.smashD = D;
    // (never wrecked by one blow from below the fire: the warning first)
    if (v.warnAt == null) v.warnAt = BURN;
    v.on('crash', (e) => this.knock(D, e, 1));
    v.on('scrape', (e) => this.knock(D, e, 0.35));
    v.on('bump', (e) => { if (e.by && e.by.kind === 'tram') this.tramSparks(e.point, e.k ?? 0.6, D); this.knock(D, { point: e.point, k: e.k ?? 0.3, n: e.n }, 0.8); });
    v.on('lean', (e) => { if (e.by && e.by.kind === 'tram') this.tramSparks(e.point, 0.3, D); });
    v.on('post', (e) => this.knock(D, { point: new THREE.Vector3(e.thing.x, 0.6, e.thing.z), k: e.k ?? 0.5 }, 0.35));
    // the tram's own contacts (a car it shoves: Car.contact on the car finds the tram as `o` and tells it 'bump')
    if (v.kind === 'tram') v.on('bump', (e) => this.tramSparks(e.point, e.k ?? 0.6, null));
    this.addProxy(D);
    this.list.push(D);
    this.byCar.set(v, D);
    return D;
  }
  detach(D) {
    const v = D.v;
    for (const [m, g0] of D.geo0) { const g = m.geometry; m.geometry = g0; g.dispose(); }
    D.geo0.clear();
    for (const m of D.hidden) m.visible = true;
    for (const o of D.added) { if (o.parent) o.parent.remove(o); }
    if (D.fire) { const i = this.stage.cars && this.stage.cars.fires ? this.stage.cars.fires.indexOf(D.fire) : -1; if (i >= 0) this.stage.cars.fires.splice(i, 1); D.fire.dispose(); }
    if (D.proxy) { this.stage.removeSolid(D.proxy); if (D.proxy.parent) D.proxy.parent.remove(D.proxy); }
    v.sagPitch = 0; v.sagRoll = 0; v.pull = 0; v.power = 1;
    for (const k of GRIP_KEYS) v.grip[k] = 1;
    delete v.smashD;
    const i = this.list.indexOf(D); if (i >= 0) this.list.splice(i, 1);
    this.byCar.delete(v);
  }

  // the bullets' box of a car: its hull, riding with it
  addProxy(D) {
    const S = this.stage, v = D.v;
    if (!S.rays || v.kind === 'tram') return;
    const m = new THREE.Mesh(this.smash.proxyGeo, this.smash.proxyMat);
    m.visible = false;
    m.userData.prop = { carD: D };
    m.userData.surf = SURF.CAR;
    m.scale.set(v.spec.halfL * 2 * 0.97, D.top - 0.3, v.spec.halfW * 2 * 0.97);
    m.position.set(0, 0.3 + (D.top - 0.3) / 2, 0);
    v.body.add(m);
    D.proxy = m;
    v.body.updateMatrixWorld(true);
    S.addSolid(m);
    D.entry = S.rays.entries.find((e) => e.mesh === m) || null;
  }
  syncProxy(D) {
    const e = D.entry, m = D.proxy;
    if (!e || !m) return;
    m.updateMatrixWorld(true);
    e.mw.copy(m.matrixWorld); e.inv.copy(m.matrixWorld).invert(); e.inv3.setFromMatrix4(e.inv);
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    _b.copy(g.boundingBox).applyMatrix4(m.matrixWorld);
    e.min.copy(_b.min); e.max.copy(_b.max);
  }

  // ---- what it met ---------------------------------------------------------------------------------
  // a knock (a crash, a scrape, a bump, a post): at its corner, by how hard
  knock(D, e, w) {
    if (!e || !e.point || D.state === 'wreck') return;
    const v = D.v, l = v.local(e.point, _v);
    const S = v.spec;
    const k = Math.min(1, (e.k ?? 0.4)) * w;
    if (k < 0.05) return;
    const c = (l.x >= 0 ? 'f' : 'r') + (l.z >= 0 ? 'r' : 'l');
    D.corners[c] += k;
    const G0 = this.game;
    // a dent where it struck (a few a corner: each harder knock pushes in more)
    const steps = Math.floor(D.corners[c] / 0.3);
    if (steps > D.dents[c] && D.dents[c] < 4) {
      D.dents[c] = steps;
      const n = e.n ? _w.copy(e.n).negate() : _w.set(l.x, 0, l.z).normalize().negate();
      const nl = this.toLocalDir(v, n);
      this.dent(D, V(Math.max(-S.halfL, Math.min(S.halfL, l.x)), Math.max(0.45, Math.min(1.1, l.y || 0.7)), Math.max(-S.halfW, Math.min(S.halfW, l.z))), nl, 0.5, Math.min(0.16, 0.05 + 0.06 * k));
    }
    // the headlamp on that side
    if (c[0] === 'f' && D.corners[c] >= 0.35) this.lampOut(D, l.z >= 0 ? 1 : 0);
    // a side hit near the door: it hangs open
    if (Math.abs(l.x) < 1.1 && Math.abs(l.z) > S.halfW * 0.6 && k >= 0.45 && !D.door) this.hangDoor(D, l.z >= 0 ? 1 : -1);
    // a hard blow at any speed (C3b's wreck smash): the corner down, the glass, the lamp
    if ((k >= 0.55 && w >= 1) || D.corners[c] >= 0.75) this.smashCorner(D, c, e.point);
    if (G0 && w >= 1 && k > 0.3) G0.sfx.play('c3_dent', e.point, { k }, { ref: 5 });
  }
  toLocalDir(v, d) { _q.setFromAxisAngle(_w.set(0, 1, 0), -v.yaw); return d.clone().applyQuaternion(_q); }

  // the skin pushed in round a point (car frame), along n (into the car), a falloff of r
  dent(D, p, n, r, depth) {
    const v = D.v, M = v.model && v.model.meshes ? v.model.meshes : null;
    if (!M) return;
    for (const key of SKIN) {
      const m = M[key];
      if (!m || !m.isMesh || !m.geometry || m.position.lengthSq() > 1e-6 || m.quaternion.w < 0.9999) continue;
      if (!D.geo0.has(m)) { D.geo0.set(m, m.geometry); m.geometry = m.geometry.clone(); }
      const A = m.geometry.getAttribute('position'), a = A.array;
      const r2 = r * r;
      let moved = false;
      for (let i = 0; i < a.length; i += 3) {
        const dx = a[i] - p.x, dy = a[i + 1] - p.y, dz = a[i + 2] - p.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r2) continue;
        const f = 1 - Math.sqrt(d2) / r, k = depth * f * f;
        a[i] += n.x * k; a[i + 1] += n.y * k * 0.5 - k * 0.25; a[i + 2] += n.z * k;
        moved = true;
      }
      if (moved) { A.needsUpdate = true; m.geometry.computeBoundingSphere(); }
    }
  }

  // C3b's smash of a corner: down on its broken spring, the body twisted
  // onto it, the wing crumpled, the lamp out, the glass on that side gone
  // and grains of it on the road, steam out of the bonnet
  smashCorner(D, c, point) {
    if (D.smashed.has(c)) return;
    D.smashed.add(c);
    const v = D.v, S = v.spec, G0 = this.game;
    const front = c[0] === 'f', right = c[1] === 'r';
    D.crushR += (right ? 1 : -1) * 0.045; D.crushP += (front ? -1 : 1) * 0.035;
    this.dent(D, V(front ? S.halfL - 0.15 : -S.halfL + 0.15, 0.85, (right ? 1 : -1) * (S.halfW - 0.1)), V(front ? -0.7 : 0.7, -0.2, right ? -0.7 : 0.7).normalize(), 0.7, 0.2);
    if (front) this.lampOut(D, right ? 1 : 0);
    // a sedan's glass on that side and the screen at that end (world/Cars' panes: the sides 0..3, +z first; the screen 4, 5; the rear 6)
    const C = this.stage.cars;
    if (v.car && v.car.panes && C && C.shatter) {
      try { for (const i of [...(right ? [0, 1] : [2, 3]), front ? (right ? 4 : 5) : 6]) if (v.car.panes[i] && !v.car.panes[i].broken) C.shatter(v.car, i, 1.2); } catch (e) { /* its glass */ }
    }
    // grains of glass under the corner
    const at = v.world(front ? S.halfL : -S.halfL, (right ? 1 : -1) * S.halfW, _v).clone();
    at.y = (v.groundY || 0) + 0.6;
    const sm = this.smash;
    for (let i = 0; i < 16; i++) { const s = sm.rnd(0.02, 0.05); sm.pieces.spawn('shard', at.clone().add(_w.set(sm.gauss() * 0.3, sm.rnd(0, 0.3), sm.gauss() * 0.3)), sm.randQ(), _w.set(s, s, 1), V(v.vel.x * 0.3 + sm.gauss() * 1.2, sm.rnd(0.3, 1.5), v.vel.z * 0.3 + sm.gauss() * 1.2), sm.spin(1), { r: 0.02, bounce: 0.15 }); }
    if (G0) G0.sfx.glass(at, 0.8);
    // (the bonnet sprung: a step of the engine's damage, the steam's tell)
    if (front) v.damage = Math.min(BURN - 0.3, v.damage + 0.5);
    void point;
  }

  lampOut(D, side) {
    if (D.lampOut[side]) return;
    D.lampOut[side] = true;
    const v = D.v, G0 = this.game, C = this.stage.cars;
    if (v.car && v.car.lensBroken && C && C.breakLens) { try { if (!v.car.lensBroken[side ? 0 : 1]) C.breakLens(v.car, side ? 0 : 1); } catch (e) { /* */ } }
    else if (v.model && v.model.meshes && v.model.meshes.lens) {
      // (the coupe's lenses: one mesh, two discs - that side's collapsed)
      const m = v.model.meshes.lens;
      if (!D.geo0.has(m)) { D.geo0.set(m, m.geometry); m.geometry = m.geometry.clone(); }
      const a = m.geometry.getAttribute('position').array;
      for (let i = 0; i < a.length; i += 3) if ((a[i + 2] >= 0) === (side === 1)) { a[i] = 2.3; a[i + 1] = 0.98; a[i + 2] = side ? 0.6 : -0.6; }
      m.geometry.getAttribute('position').needsUpdate = true;
    }
    const p = v.world(v.spec.halfL, (side ? 1 : -1) * 0.6, _v).clone(); p.y = (v.groundY || 0) + 0.98;
    this.smash.glassBits(p, v.fwd.clone(), 8);
    if (G0) G0.sfx.glass(p, 0.4);
  }

  // a door on its hinge, hanging open and swinging as the car moves
  hangDoor(D, side) {
    const v = D.v, M = v.model && v.model.meshes;
    const mat = (M && M.paint && M.paint.material) || this.stage.M.paint;
    const pivot = new THREE.Group();
    pivot.position.set(0.55, 0.52, side * (v.spec.halfW + 0.01));
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 0.045).translate(-0.575, 0.31, 0), mat);
    door.userData.inkId = M && M.paint ? M.paint.userData.inkId : 1;
    door.userData.inkFigure = true;
    door.userData.noRay = true;
    pivot.add(door);
    v.body.add(pivot);
    D.added.push(pivot);
    D.door = { pivot, side, ang: 0.35, w: 2.5 };
    if (this.game) this.game.sfx.play('tail_door', door.getWorldPosition(_v), { open: true }, { ref: 3 });
  }

  // ---- a round into it (Smash.bullet -> here) -----------------------------------------------------------
  bullet(D, hit, dir, weak) {
    const v = D.v, G0 = this.game, S = v.spec;
    if (D.state === 'wreck') return null;
    const l = v.local(hit.point, _v).clone();
    l.y = hit.point.y - (v.groundY || 0);
    // a tyre (near a wheel)
    const wheels = [[S.a, -S.halfW * 0.85], [S.a, S.halfW * 0.85], [-S.b, -S.halfW * 0.85], [-S.b, S.halfW * 0.85]];
    for (let i = 0; i < 4; i++) {
      const [wx, wz] = wheels[i];
      if (Math.hypot(l.x - wx, l.y - 0.375, (l.z - wz) * 0.6) < 0.42) {
        if (!weak) this.flat(D, i, hit.point);
        return null;
      }
    }
    // a headlamp
    if (l.x > S.halfL - 0.45 && l.y > 0.75 && l.y < 1.25 && Math.abs(Math.abs(l.z) - 0.6) < 0.25) { if (!weak) this.lampOut(D, l.z >= 0 ? 1 : 0); return 'glass'; }
    // a sedan's glass: the nearest pane, two rounds and it goes
    const C = this.stage.cars;
    if (v.car && v.car.panes && l.y > 1.1 && C && C.T) {
      let bi = -1, bd = Infinity;
      v.car.panes.forEach((p, i) => { if (p.broken) return; const d = C.T.panes[i].c.distanceToSquared(l); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0 && bd < 0.8) {
        const n = (D.panesHit.get(bi) || 0) + 1; D.panesHit.set(bi, n);
        if (n >= 2) C.shatter(v.car, bi, 1); else { G0.sfx.glass(hit.point, 0.35); this.smash.glassBits(hit.point, dir, 4); }
        return 'glass';
      }
    }
    if (weak) return null;
    // the engine, the tank, the body
    const zone = l.x > S.halfL * 0.3 && l.y < 1.16 ? 'engine' : l.x < -S.halfL * 0.6 && l.y < 0.95 ? 'tank' : 'body';
    v.hurt(zone === 'engine' ? 0.24 : zone === 'tank' ? 0.2 : 0.07, hit.point);
    if (zone === 'tank' && !D.leak) D.leak = true;
    return null;
  }

  // a tyre shot flat: the corner down, its grip gone, the wheel pulling to it
  flat(D, i, at) {
    if (D.tyres[i]) return;
    D.tyres[i] = 1;
    const v = D.v;
    v.grip[GRIP_KEYS[i]] = 0.35;
    if (i < 2) v.pull += (i === 0 ? 1 : -1) * 0.04;     // (a front one pulls the wheel to its side: + left)
    if (this.game) this.game.sfx.tyre(at);
    this.smash.sparksAt(at.clone(), v.fwd.clone(), 0.3);
  }

  // ---- the engine: steam, smoke, fire, the blast ----------------------------------------------------------
  engine(D, dt) {
    const v = D.v, G0 = this.game, sm = this.smash;
    const dmg = v.damage;
    if (D.state === 'wreck') return;
    if (dmg >= BURN && D.state !== 'burning') {
      D.state = 'burning';
      D.fuse = dmg >= 4 ? FUSE_HOT : FUSE;
      D.burnT = 0;
      if (G0) G0.sfx.hiss(v.pos);
      if (G0 && G0.emit) G0.emit('car:burning', { car: v });
    } else if (D.state !== 'burning') D.state = dmg >= SMOKE ? 'smoke' : dmg >= STEAM ? 'steam' : 'whole';
    if (D.state === 'burning') {
      D.burnT += dt;
      if (dmg >= 4 && D.fuse > FUSE_HOT) D.fuse = FUSE_HOT;
      D.fuse -= dt;
      v.power = Math.max(0, 0.55 - D.burnT * 0.08);
      if (D.fuse <= 0) { this.blast(D); return; }
    } else v.power = D.state === 'smoke' ? 0.8 : 1;
    if (!G0 || D.state === 'whole') return;
    // the seam at the bonnet's front, where it comes out
    const S = v.spec, hot = D.state === 'burning';
    const seam = (x, y, z) => v.body.localToWorld(_v.set(x, y, z)).clone();
    const rate = hot ? 16 : D.state === 'smoke' ? 9 : 7;
    D.acc.smoke += dt * rate;
    while (D.acc.smoke >= 1) {
      D.acc.smoke -= 1;
      const p = seam(S.halfL * 0.62 + sm.gauss() * 0.25, 1.1, sm.gauss() * 0.25);
      if (D.state === 'steam') {
        const g = sm.rnd(1.0, 1.35);
        G0.fx.dust.spawn({ pos: p, vel: V(sm.gauss() * 0.25 + v.vel.x * 0.5, sm.rnd(0.7, 1.4), sm.gauss() * 0.25 + v.vel.z * 0.5), life: sm.rnd(1.0, 1.6), size: [0.4, 0.35], grow: 0.9, rot: sm.rnd(0, 6.28), col: [g, g, g], alpha: 0.2, drag: 0.8, fadeOut: 0.7 });
      } else {
        const s = sm.rnd(0.5, 0.9) * (hot ? 1.2 : 1);
        const g = hot ? sm.rnd(0.004, 0.012) : 0.16 * sm.rnd(0.6, 1.2);
        G0.fx.smoke.spawn({ pos: p, vel: V(sm.gauss() * 0.3 + 0.35 + v.vel.x * 0.4, sm.rnd(1.4, 2.4), sm.gauss() * 0.3 + v.vel.z * 0.4), life: sm.rnd(2.2, 3.4), size: [s, s], grow: sm.rnd(0.4, 0.7), rot: sm.rnd(0, 6.28), spin: sm.gauss() * 0.3,
          col: [g, g, g], colEnd: [g * 1.5, g * 1.5, g * 1.5], alpha: sm.rnd(0.7, 0.85), drag: 0.3, fadeIn: 0.05, fadeOut: 0.5, cell: FIRE.SMOKE[Math.floor(sm.rnd(0, 3.99))] });
      }
    }
    if (hot) {
      // the flames licking out of the seams, growing as it cooks
      const grow = Math.min(1, D.burnT / 3);
      D.acc.flame += dt * (8 + 14 * grow);
      while (D.acc.flame >= 1) {
        D.acc.flame -= 1;
        const s = sm.rnd(0.25, 0.5) * (0.7 + 0.8 * grow);
        const p = seam(S.halfL * 0.55 + sm.gauss() * 0.3, 1.06, (sm.rnd() < 0.5 ? 1 : -1) * sm.rnd(0.15, 0.5));
        G0.fx.fire.spawn({ pos: p.add(_w.set(0, s * 0.3, 0)), vel: V(sm.gauss() * 0.1 + 0.2, sm.rnd(0.6, 1.3), sm.gauss() * 0.1), life: sm.rnd(0.18, 0.36), size: [s * 0.7, s], grow: 0.2, rot: sm.gauss() * 0.15,
          col: sm.rnd() < 0.5 ? FIRE_COL.yellow : FIRE_COL.orange, colEnd: FIRE_COL.deep, colPow: 1.3, cell: FIRE.FLAME[Math.floor(sm.rnd(0, 3.99))], fadeIn: 0.04, fadeOut: 0.3 });
      }
      // (its light: the fire light while it burns, flickering)
      const L = this.stage.fxLights && this.stage.fxLights.fire[0];
      if (L && (!this._litBy || this._litBy === D || !this._litBy.fire && this._litBy.state !== 'burning')) {
        this._litBy = D;
        L.position.copy(seam(S.halfL * 0.6, 1.8, 0));
        L.intensity = (25 + 35 * grow) * (0.75 + 0.25 * Math.sin(D.burnT * 23) * Math.sin(D.burnT * 7.1));
        L.distance = 14;
      }
    }
    // a hit tank: a dark drip under it
    if (D.leak) {
      D.acc.drip = (D.acc.drip || 0) + dt * 6;
      while (D.acc.drip >= 1) { D.acc.drip -= 1; const p = seam(-S.halfL * 0.8, 0.5, sm.gauss() * 0.2); G0.fx.splash.spawn({ pos: p, vel: V(0, -0.3, 0), life: 0.4, size: [0.012, 0.03], stretch: 0.03, col: [0.02, 0.02, 0.02], alpha: 1, cell: ATLAS.DROP, gravity: 9.8, ground: (v.groundY || 0) + 0.01, fadeOut: 0.1 }); }
    }
  }

  // it goes: the flash on the wet, the shards, the push; the wreck in its place
  blast(D) {
    const v = D.v, G0 = this.game, S = v.spec, sm = this.smash;
    const L = (x, y, z) => v.body.localToWorld(V(x, y, z));
    const at = L(S.halfL * 0.6, 1.0, 0);
    D.state = 'wreck';
    if (G0) {
      // (the frame rate's limit: two fires roaring; a third blast sinks the oldest to embers)
      const F = this.stage.cars && this.stage.cars.fires ? this.stage.cars.fires : this.fires;
      const roaring = F.filter((f) => !f.doused && (f.age < 1 || f.intensity() >= 0.45));
      if (roaring.length >= 2) roaring.sort((a, b) => b.age - a.age)[0].douse();
      G0.fx.explosions.blast(at, { yaw: v.yaw, kind: 'A', local: L });
      // what stands near goes over; what lies is thrown
      sm.blast(at, 7, 1);
      // (the cars near take it too)
      for (const o of this.list) if (o !== D && o.state !== 'wreck' && Math.hypot(o.v.pos.x - v.pos.x, o.v.pos.z - v.pos.z) < 6.5) o.v.hurt(1.4, at);
      const mine = G0.vehicles && G0.vehicles.player === v && G0.city && G0.city.inCar;
      G0.onCarExploded({ pos: v.pos.clone(), id: -1, smash: true }, at);
      G0.emit('car:wreck', { car: v, at, mine });
      if (mine) G0.fail({ why: 'She went up with you in her.', fall: false });
      else if (G0.health && G0.health.dead && !G0.health.onDeath) G0.fail({ why: 'Too close when she went.', fall: false });
    }
    this.toWreck(D);
  }

  toWreck(D) {
    const v = D.v, S = v.spec, st = this.stage, G0 = this.game;
    v.frozen = true; v.vel.set(0, 0, 0); v.yawRate = 0; v.wrecked = true; v.power = 0;
    v.input.throttle = 0; v.input.brake = 0;
    if (v.lamps && v.lamps.setOn) v.lamps.setOn(false);
    if (v.tail) v.tail.visible = false;
    // everything of it hidden but its shadow on the road and its bullets' box
    v.body.traverse((o) => {
      if (!o.isMesh || o === D.proxy || !o.visible) return;
      if (o.renderOrder >= 1 && o.layers && o.layers.mask === 4) return;   // (the contact shadow: LAYER.FX)
      o.visible = false; D.hidden.push(o);
    });
    // (a sedan's glass all gone)
    const C = st.cars;
    if (v.car && v.car.panes && C && C.shatter) { try { v.car.panes.forEach((p, i) => { if (!p.broken) C.shatter(v.car, i, 2); }); } catch (e) { /* */ } }
    // the burnt body: the wreck's shell, cut to its length and width, down on its rims
    if (!WRECK) WRECK = { B: buildWreck('A', SEDAN_SHAPES, 0), M: wreckMaterials(st.M) };
    const g = new THREE.Group();
    g.scale.set(S.halfL / 2.45, 1, S.halfW / 0.95);
    g.position.y = -WRECK_DROP;
    const id = v.model && v.model.meshes && v.model.meshes.paint ? v.model.meshes.paint.userData.inkId : 1;
    for (const [geo, mat] of [[WRECK.B.shell, WRECK.M.shell], [WRECK.B.lines, WRECK.M.lines], [WRECK.B.rims, WRECK.M.rims], [WRECK.B.doors, WRECK.M.shell]]) {
      if (!geo) continue;
      const m = new THREE.Mesh(geo, mat);
      m.userData.inkId = id; m.userData.inkFigure = true; m.userData.noRay = true;
      m.castShadow = false; m.receiveShadow = true;
      g.add(m);
    }
    v.body.add(g);
    D.added.push(g);
    if (D.door) D.door.pivot.visible = false;
    // twisted onto its worst corner
    let worst = 'fl';
    for (const k of CORNER_KEYS) if (D.corners[k] > D.corners[worst]) worst = k;
    D.crushR = (worst[1] === 'r' ? 1 : -1) * 0.06; D.crushP = (worst[0] === 'f' ? -1 : 1) * 0.045;
    // the fire on the wreck (fx/Fire.js: it roars, then dies to embers)
    if (G0) {
      const src = [{ kind: 'bay', at: V(S.halfL * 0.6, 0.92, 0), rx: 0.42, rz: 0.36 }, { kind: 'cabin', at: V(-0.4, 0.85, 0), rx: 0.35, rz: 0.35, noEmber: true, k: 0.8 }];
      const fire = new Fire(st, G0.fx, { pos: v.body.localToWorld(V(S.halfL * 0.6, 0.92, 0)), yaw: v.yaw, sources: src, toWorld: (p) => _w.copy(p).applyMatrix4(v.body.matrixWorld), seed: 7900 + Math.round(v.pos.x * 3 + v.pos.z) });
      D.fire = fire;
      if (st.cars && st.cars.fires) { st.cars.fires.push(fire); if (st.cars.assignFireLights) st.cars.assignFireLights(); }
      else this.fires.push(fire);
      if (this._litBy === D) this._litBy = null;
      G0.sfx.play('fire', v.pos, { dur: 3 }, { ref: 5 });
    }
    // (frozen: its own step no longer poses it - once here)
    v.sagPitch = D.crushP + D.sagP; v.sagRoll = D.crushR + D.sagR;
    v.pose(0);
  }

  // ---- the tram strikes sparks on a car in its way ------------------------------------------------------------
  tramSparks(point, k = 0.6, D = null) {
    const G0 = this.game, sm = this.smash;
    if (!G0 || !point) return;
    const t = G0.time;
    if (t - (this._sparkT ?? -9) < 0.06) return;
    this._sparkT = t;
    const p = point.clone(); p.y = Math.max(p.y, 0.5);
    const n = Math.round(14 + 30 * k);
    for (let i = 0; i < n; i++) {
      const vv = V(sm.gauss() * 2.5, sm.rnd(0.4, 3), sm.gauss() * 2.5);
      G0.fx.sparks.spawn({ pos: p.clone().add(_w.set(sm.gauss() * 0.1, sm.rnd(0, 0.5), sm.gauss() * 0.1)), vel: vv, life: sm.rnd(0.15, 0.6), size: [0.009, 0.015], stretch: 0.04, col: [7, 7, 7], cell: ATLAS.DROP, gravity: 9.8, ground: this.stage.surfaceY(p.x, p.z) + 0.01, fadeOut: 0.3 });
    }
    if (t - (this._screechT ?? -9) > 0.5) { this._screechT = t; G0.sfx.play('tail_scrape', p, { k: Math.max(0.5, k) }, { ref: 5 }); G0.sfx.play('clang', p, { k: 0.8 }, { ref: 4 }); }
    this.sparkCount = (this.sparkCount || 0) + 1;
    if (D) D.tramT = t;
    G0.emit('smash:tram', { at: p, k });
  }

  // ---- per step -------------------------------------------------------------------------------------------------
  update(dt, t) {
    const G0 = this.game;
    if (!G0 || !G0.vehicles) return;
    const L = G0.vehicles.list;
    for (const v of L) if (!v.smashD && v.spec && v.local && v.body) this.attach(v);
    for (let i = this.list.length - 1; i >= 0; i--) { const D = this.list[i]; if (!L.includes(D.v)) this.detach(D); }
    for (const D of this.list) {
      const v = D.v;
      D.t += dt;
      if (v.kind === 'tram') continue;
      this.engine(D, dt);
      // the lean of what it carries: flat tyres, a smashed corner
      let sp = 0, sr = 0;
      const S = v.spec;
      for (let i = 0; i < 4; i++) if (D.tyres[i]) { const sx = i < 2 ? 1 : -1, sz = i % 2 ? 1 : -1; sp += -sx * 0.09 / (S.wheelbase || 3.1); sr += sz * 0.09 / ((S.halfW || 0.95) * 1.7); }
      D.sagP = sp; D.sagR = sr;
      if (D.state !== 'wreck') { v.sagPitch = D.sagP + D.crushP; v.sagRoll = D.sagR + D.crushR; }
      // a rim on the road sparks as it goes
      if (D.tyres.some((x) => x) && v.speedAbs > 4 && D.state !== 'wreck') {
        D.acc.rim += dt * Math.min(30, v.speedAbs * 1.5);
        while (D.acc.rim >= 1) {
          D.acc.rim -= 1;
          const i = D.tyres.findIndex((x) => x);
          const p = v.world(i < 2 ? S.a : -S.b, (i % 2 ? 1 : -1) * S.halfW * 0.85, _v).clone(); p.y = (v.groundY || 0) + 0.05;
          G0.fx.sparks.spawn({ pos: p, vel: V(-v.vel.x * 0.3 + this.smash.gauss(), this.smash.rnd(0.3, 1.2), -v.vel.z * 0.3 + this.smash.gauss()), life: this.smash.rnd(0.1, 0.3), size: [0.008, 0.012], stretch: 0.03, col: [5, 5, 5], cell: ATLAS.DROP, gravity: 9.8, ground: p.y - 0.04, fadeOut: 0.3 });
        }
      }
      // the hanging door swings with the car's moves
      if (D.door && D.state !== 'wreck') {
        const Dd = D.door;
        const push = -(v.accel || 0) * 0.35 + (v.yawRate || 0) * Dd.side * 0.8;
        Dd.w += ((0.55 - Dd.ang) * 14 - Dd.w * 1.6 + push) * dt;
        Dd.ang = Math.max(0.05, Math.min(1.3, Dd.ang + Dd.w * dt));
        Dd.pivot.rotation.y = Dd.side * Dd.ang;
      }
      // a lamp out: its beam's cone that side gone
      if (v.lamps && v.lamps.cones && v.lamps.on) for (let s = 0; s < 2; s++) if (D.lampOut[s] && v.lamps.cones[s]) v.lamps.cones[s].visible = false;
      if (v.lamps && v.lamps.spot && v.lamps.on && (D.lampOut[0] || D.lampOut[1])) v.lamps.spot.intensity = v.lamps.intensity * (2 - D.lampOut.filter(Boolean).length) / 2;
      this.syncProxy(D);
      // a wreck's fire light after the roar: Cars' assigner
      if (D.fire && !(this.stage.cars && this.stage.cars.fires)) D.fire.update(dt, t);
    }
    if (this._litBy && this._litBy.state !== 'burning') { const Lf = this.stage.fxLights && this.stage.fxLights.fire[0]; if (Lf && !(this.stage.cars && this.stage.cars.fires.some((f) => f.light === Lf))) Lf.intensity = 0; this._litBy = null; }
    // the player's: warned while it burns and he sits in it
    const me = G0.vehicles.player, D = me && me.smashD, inCar = !!(G0.city && G0.city.inCar);
    const want = D && D.state === 'burning' && inCar ? 'She’s burning. Get out.' : null;
    if (want !== (this._warned || null)) { this._warned = want; if (G0.hud && G0.hud.warn) { if (want) { if (G0.hud.teach && G0.hud.teach.dismiss) G0.hud.teach.dismiss(); G0.hud.warn(want); } else G0.hud.warn(null); } }
  }
}
