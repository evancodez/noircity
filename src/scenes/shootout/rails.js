import * as THREE from 'three';
import { makeConeMesh } from '../../render/shaders/cone.js';
import { LAYER, allocInkId } from '../../render/layers.js';
import { roundedBox, merge } from '../../world/geom.js';
import { DOORS } from './site.js';

// Cars on rails (B7, scene 9): the block's own sedan (world/Cars.js) driven
// along a path of our own. A car is spawned into stage.cars (so it takes
// bullets, smokes, burns and blows like any car on the block), then moved
// every step along a Catmull-Rom rail with a speed plan (cruise, slow for
// the bends, a hard stop at its end): it sits on the road, dips its nose on
// the brakes and rocks back, leans in the bends, and slides its tail a
// little when it swings in. Its headlamps are volumetric cones that ride
// with it (and one of the rig's two pooled SpotLights, the pair that
// matters most); its doors are leaves of our own, hinged at their front
// edges, that swing open (a man gets out behind one). A stopped car blocks
// the Hoods' nav grid and gives cover points like a parked one.
// Everything added is taken away again (remove / clear): the block is left
// as it was found.
//   rails.spawn({ rail, paint, lights, v0, cruise, stopAt, armored, id }) -> car (car.rail: its state)
//   rails.openDoor(car, 'rf' | 'rr' | 'lf' | 'lr', { speed })
//   rails.crash(car, { at, r })   off the rail into a post (the drive-by)
//   rails.update(dt, t)            rails.remove(car)   rails.clear()
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const Y = V(0, 1, 0), Z = V(0, 0, 1), X = V(1, 0, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the headlamps in the car's frame (Cars.js: the lamps at x 2.26, z +-0.6)
const LAMPS = [V(2.34, 0.98, 0.6), V(2.34, 0.98, -0.6)];
const BEAM = V(1, -0.09, 0).normalize();

// (a dim, even grey: the inside of the cab with its dome light on)
let CAB = null;
const cabLight = () => CAB || (CAB = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.1), side: THREE.DoubleSide }));
export const cabMaterial = cabLight;

export class Rails {
  constructor(game, stage) {
    this.game = game;
    this.stage = stage;
    this.list = [];
    this.spots = [];
    // one pooled SpotLight for the headlamps (b7spots=<n> for more: every
    // light is paid by every lit pixel; made once per scene entry:
    // a light added or taken away recompiles every lit material, so it is
    // done under the black of the scene's start, never in play)
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('b7spots') : null;
    const nSpots = q != null ? +q : 1;
    // [R2-F] the first is not a light of its own: it is one of the lamp
    // pool's four plain SpotLights, taken out of the pool for the scene (the
    // lamp that would have had it - the seventh nearest - is lit by its cone
    // and bulb alone meanwhile) and given back at the end. A light added to
    // the scene changed every lit material's program: each figure, shard and
    // wreck compiled again the first time it was drawn, in play (a stall at
    // every first appearance), and every lit pixel paid for one light more.
    const pool = stage.lamps && stage.lamps.pool;
    const slot = nSpots > 0 && pool ? pool.find((p) => !p.shadow) : null;
    if (slot) {
      pool.splice(pool.indexOf(slot), 1);
      const sp = slot.spot;
      this.borrowed = { slot, angle: sp.angle, penumbra: sp.penumbra, distance: sp.distance, decay: sp.decay };
      slot.lamp = null;
      sp.intensity = 0; sp.angle = 0.42; sp.penumbra = 0.55; sp.distance = 34; sp.decay = 2.0;
      this.spots.push({ light: sp, car: null, borrowed: true });
    }
    for (let i = slot ? 1 : 0; i < nSpots; i++) {
      const sp = new THREE.SpotLight(0xffffff, 0, 34, 0.42, 0.55, 2.0);
      sp.position.set(0, -60, 0); sp.target.position.set(0, -61, 0);
      stage.scene.add(sp, sp.target);
      this.spots.push({ light: sp, car: null });
    }
    this.nextId = 200;
  }

  // ---- a car ---------------------------------------------------------------------------
  spawn({ rail, paint = 'paint', lights = true, v0 = 13, cruise = 13, decel = 8, accel = 4, stop = true, armored = false, lat = 6.5 } = {}) {
    const S = this.stage, C = S.cars, G = this.game;
    const pts = rail.map(([x, z]) => V(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength();
    const p0 = curve.getPointAt(0), t0 = curve.getTangentAt(0);
    const yaw0 = Math.atan2(-t0.z, t0.x);
    const car = C.spawn({ pos: p0.clone(), yaw: yaw0, lights: false, paint });
    car.id = this.nextId++;
    C.cars.push(car);
    // (its meshes join the bullets' world as they would have at the build)
    car.group.traverse((o) => { if (o.isMesh && o.layers.mask & 3 && !o.userData.noRay) S.addSolid(o); });
    // [R2-F] its own wheels: the front pair steers on the rail
    const wheels = ownWheels(car, C.T);
    if (armored) { car.limit = 1e9; car.armored = true; }
    const R = car.rail = {
      curve, L, s: 0, v: v0, plan: plan(curve, L, { cruise, v0, decel, accel, stop, lat }), stopped: false, done: false,
      pitch: 0, pv: 0, roll: 0, rv: 0, slip: 0, sv: 0, lastV: v0, lastYaw: yaw0, wheels, steer: 0, steerDrawn: 0,
      lights, lit: lights, doors: {}, cones: [], entry: null, engine: true, sound: 'b7car' + car.id, nav: null, covers: [], cols: [],
      crash: null, onStop: null, riders: [],
    };
    if (lights) {
      for (let i = 0; i < 2; i++) {
        const cone = makeConeMesh(S.U, { apex: V(0, -50, 0), axis: BEAM.clone(), tan: 0.2, height: 14, r0: 0.1, intensity: 0.55, fadeEnd: 0.9, edgeSoft: 0.45, seed: car.id * 3 + i });
        cone.layers.set(LAYER.VOLUME);
        cone.userData.noRay = true;
        S.scene.add(cone);
        R.cones.push(cone);
      }
      R.entry = S.lights.add({ position: V(0, -50, 0), direction: BEAM.clone(), halfAngle: 0.3, range: 16, intensity: 0.7 });
    }
    this.list.push(car);
    this.place(car, 0);
    return car;
  }

  // where the rail puts it, and how it sits (the nose on the brakes, the
  // lean in a bend, the tail's slide)
  place(car, dt) {
    const R = car.rail;
    const u = Math.min(1, R.s / R.L);
    const p = R.curve.getPointAt(u), tg = R.curve.getTangentAt(u);
    const yawT = Math.atan2(-tg.z, tg.x);
    if (dt > 0) {
      // (the body's own motion: springs driven by the car's accelerations)
      const aLong = (R.v - R.lastV) / dt;
      const yawRate = wrap(yawT - R.lastYaw) / dt;
      const aLat = R.v * yawRate;
      R.lastV = R.v; R.lastYaw = yawT;
      const k = 70, c = 9;
      R.pv += (-k * (R.pitch - Math.max(-0.07, Math.min(0.05, aLong * 0.0065))) - c * R.pv) * dt; R.pitch += R.pv * dt;
      R.rv += (-k * (R.roll - Math.max(-0.05, Math.min(0.05, -aLat * 0.0055))) - c * R.rv) * dt; R.roll += R.rv * dt;
      // the tail steps out when it swings in hard and braking
      const want = Math.max(-0.35, Math.min(0.35, -yawRate * 0.12 * Math.min(1, Math.max(0, -aLong) / 5)));
      R.sv += (-40 * (R.slip - want) - 8 * R.sv) * dt; R.slip += R.sv * dt;
      // [R2-F] the front wheels: along the path the car is on (the bend over
      // the wheelbase), against the slide when the tail steps out; held
      // where they were once it stops (it stands with its wheels turned)
      // (the last metres before a stop are not steered: the rail's end wiggle
      // at a walking pace would throw the wheels over the other way)
      if (R.v > 2) this.steerTo(car, Math.atan(3.1 * yawRate / R.v) - R.slip, dt);
    }
    car.pos.set(p.x, 0, p.z);
    car.yaw = yawT + R.slip;
    this.pose(car);
  }

  // [R2-F] the front wheels turned toward `want` (rad, + to the left), eased
  // as hands on a wheel would; their vertices are redrawn only when the
  // angle has moved (no draw of their own)
  steerTo(car, want, dt) {
    const R = car.rail;
    want = Math.max(-0.6, Math.min(0.6, want));
    R.steer += (want - R.steer) * Math.min(1, dt * 9);
    if (Math.abs(R.steer - R.steerDrawn) < 0.004 || !R.wheels) return;
    R.steerDrawn = R.steer;
    turnWheels(R.wheels, R.steer);
  }

  // the group's transform (the intact car of Cars.pose, and our pitch and roll)
  pose(car) {
    const R = car.rail, g = car.group, s = car.sag, D = 0.09;
    const fl = s[0] * D, fr = s[1] * D, rl = s[2] * D, rr = s[3] * D;
    const drop = (fl + fr + rl + rr) / 4;
    const pitch = Math.atan2((rl + rr) / 2 - (fl + fr) / 2, 3.1) + R.pitch;
    const roll = Math.atan2((fl + rl) / 2 - (fr + rr) / 2, 1.56) + R.roll;
    g.position.set(car.pos.x, car.pos.y - drop + (R.bump || 0), car.pos.z);
    g.quaternion.setFromAxisAngle(Y, car.yaw).multiply(_q.setFromAxisAngle(Z, pitch)).multiply(_q2.setFromAxisAngle(X, roll));
    g.updateMatrixWorld(true);
    const G = this.game;
    if (G) for (const m of Object.values(car.meshes)) if (m.visible) G.rays.refresh(m);
    for (const d of Object.values(R.doors)) if (d.mesh.visible) G.rays.refresh(d.mesh);
    // its collider follows
    const b = car.collider;
    if (b) { b.cx = car.pos.x; b.cz = car.pos.z; b.angle = car.yaw; b.c = Math.cos(car.yaw); b.s = Math.sin(car.yaw); }
  }

  // ---- doors --------------------------------------------------------------------------------
  // a leaf of the car's side between its seams (a panel to the belt line, a
  // window frame above it), hinged at its front edge; it swings out
  openDoor(car, key, { speed = 4.5, to = 1.15 } = {}) {
    const R = car.rail, D = DOORS[key];
    if (!R || R.doors[key]) return R && R.doors[key];
    const S = this.stage, M = S.M;
    const len = D.hinge[0] - D.back;
    const panel = [];
    // (the leaf in the hinge's frame: along -x from the hinge, its outer
    // face at +side z; slightly bowed like the body's side)
    panel.push(roundedBox(len - 0.04, 0.56, 0.05, 0.02, 2).translate(-len / 2, 0.79, 0));
    // the window frame: two posts and the top rail (the glass is gone: the
    // men wound it down to shoot over)
    const top = 1.56;
    panel.push(roundedBox(0.045, top - 1.07, 0.035, 0.012, 2).translate(-0.05, (1.07 + top) / 2, -0.01));
    panel.push(roundedBox(0.045, top - 1.07, 0.035, 0.012, 2).translate(-len + 0.06, (1.07 + top) / 2 - 0.02, -0.01));
    panel.push(roundedBox(len - 0.12, 0.04, 0.035, 0.012, 2).translate(-len / 2, top, -0.01));
    const geo = merge(panel);
    const mesh = new THREE.Mesh(geo, M[car.paintKey || 'paint'] || M.paint);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const id = car.ids.glassId;
    Object.assign(mesh.userData, { inkId: id, inkFigure: true, part: 'body', car });
    const hinge = new THREE.Group();
    hinge.position.set(D.hinge[0], 0, D.hinge[1] + D.side * 0.04);
    hinge.add(mesh);
    car.group.add(hinge);
    // the opening it leaves in the side: [second pass] the cab's dome light
    // on inside it, a dim grey panel (a black hole on a black car read as
    // nothing at night: the lit opening draws the open door and the man in it)
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.08, 0.95).translate(0, 1.02, 0), cabLight());
    hole.position.set(D.hinge[0] - len / 2, 0, D.side * 0.715);
    if (D.side < 0) hole.rotation.y = Math.PI;
    hole.userData.noRay = true;
    Object.assign(hole.userData, { inkId: id, inkFigure: true });
    hole.visible = false;
    car.group.add(hole);
    car.group.updateMatrixWorld(true);
    S.addSolid(mesh);
    const d = R.doors[key] = { key, D, hinge, mesh, hole, a: 0, to, speed, len, col: null };
    return d;
  }

  stepDoors(car, dt) {
    const R = car.rail;
    for (const d of Object.values(R.doors)) {
      if (d.a >= d.to) continue;
      // (flung open: fast, then checked by the hinge)
      d.v = (d.v || 0) + d.speed * 6 * dt;
      d.a = Math.min(d.to, d.a + d.v * dt);
      if (d.a >= d.to) { d.a = d.to; if (!d.bounced) { d.bounced = true; d.to *= 0.94; d.a = d.to; } }
      d.hinge.rotation.y = -d.D.side * d.a;
      d.hole.visible = d.a > 0.05;
      d.hinge.updateMatrixWorld(true);
      if (this.game) this.game.rays.refresh(d.mesh);
    }
  }

  // an open door's collider (a thin box along the leaf) and its cover
  doorBox(car, d) {
    if (d.col) return d.col;
    const S = this.stage;
    d.hinge.updateMatrixWorld(true);
    const a = V(0, 0, 0).applyMatrix4(d.hinge.matrixWorld), b = V(-d.len, 0, 0).applyMatrix4(d.hinge.matrixWorld);
    const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, ang = Math.atan2(-(b.z - a.z), b.x - a.x);
    d.col = S.colliders.addBox(cx, cz, d.len / 2, 0.06, ang, 'car');
    car.rail.cols.push(d.col);
    return d.col;
  }

  // ---- off the rail: into a post -------------------------------------------------------------
  crash(car, { at, r = 0.3 } = {}) {
    const R = car.rail;
    if (R.crash || R.done) return;
    const p0 = car.pos.clone(), h = V(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
    // the skid: from here toward the post, the nose swinging into it
    const dir = V(at.x - p0.x, 0, at.z - p0.z);
    const dist = Math.max(1, dir.length() - 2.3 - r);
    dir.normalize();
    const yaw1 = Math.atan2(-dir.z, dir.x) + 0.35 * Math.sign(h.x * dir.z - h.z * dir.x || 1);
    R.crash = { t: 0, p0, h, dir, dist, yaw0: car.yaw, yaw1, v0: Math.max(4, R.v), hit: false, at: V(at.x, 0, at.z) };
  }

  stepCrash(car, dt) {
    const R = car.rail, C = R.crash;
    C.t += dt;
    // decelerating along a curve from the heading into the post
    const T = (2 * C.dist) / C.v0;
    const u = Math.min(1, C.t / T), e = 1 - (1 - u) * (1 - u);
    const along = e * C.dist;
    // (the path bends from the old heading into the post's direction)
    const bend = u * u * (3 - 2 * u);
    _v.copy(C.h).lerp(C.dir, bend).normalize();
    car.pos.set(C.p0.x + (C.h.x * (1 - bend) + C.dir.x * bend) * along, 0, C.p0.z + (C.h.z * (1 - bend) + C.dir.z * bend) * along);
    car.yaw = C.yaw0 + wrap(C.yaw1 - C.yaw0) * bend;
    R.v = C.v0 * (1 - u);
    // [R2-F] (the wheels hauled over into the swerve)
    const yr = dt > 0 ? wrap(car.yaw - (C.lastYaw ?? car.yaw)) / dt : 0;
    C.lastYaw = car.yaw;
    if (R.v > 0.6) this.steerTo(car, Math.atan(3.1 * yr / R.v) * 1.3, dt);
    R.pitch = -0.06 * Math.sin(Math.PI * Math.min(1, u * 1.3));
    if (u >= 1 && !C.hit) {
      C.hit = true;
      R.done = true; R.stopped = true; R.v = 0;
      R.pitch = -0.08; R.pv = 1.6;
      if (R.onCrash) R.onCrash(car, C.at);
    }
    this.pose(car);
  }

  // ---- per step -----------------------------------------------------------------------------------
  update(dt, t) {
    for (const car of this.list) {
      const R = car.rail;
      if (!R) continue;
      const burning = car.state === 'burning';
      if (!burning) {
        if (R.crash && !R.crash.hit) {
          // [C8] (into the post - but never through a car, a man or me on the way: it stops against it)
          const gap = this.ahead(car);
          if (gap < 0.35 && R.crash.t > 0.1) { R.crash.t = 1e9; R.crash.hit = true; R.done = true; R.stopped = true; R.v = 0; R.pitch = -0.08; R.pv = 1.6; if (R.onCrash) R.onCrash(car, car.pos.clone()); this.pose(car); }
          else this.stepCrash(car, dt);
        } else if (!R.done) {
          R.v = sampleV(R.plan, R.s);
          // [C8] cars are solid (WAVE_C §6 VIII, the user's own words: cars never
          // pass through cars): whatever stands ahead on its way - a car, a
          // wreck, an open door, a column, a lamp post, a man, me - it brakes for
          // and stops short of; held up, the rail's onBlocked says so (the
          // drive-by stops and they get out)
          const gap = this.ahead(car);
          const vmax = Math.sqrt(2 * 7 * Math.max(0, gap - 0.6));
          if (vmax < R.v) { R.v = vmax; R.held = (R.held || 0) + dt; } else R.held = 0;
          if (R.held > 1.2 && R.onBlocked && !R.blockedSaid) { R.blockedSaid = true; R.onBlocked(car); }
          R.s = Math.min(R.L, R.s + (R.v < 0.05 ? 0 : Math.max(0.25, R.v)) * dt);
          if (R.s >= R.L - 0.02) {
            R.s = R.L; R.v = 0; R.done = true; R.stopped = true;
            if (R.onStop) R.onStop(car);
          }
          this.place(car, dt);
        } else if (Math.abs(R.pitch) > 1e-4 || Math.abs(R.pv) > 1e-3 || Math.abs(R.slip) > 1e-4 || Math.abs(R.roll) > 1e-4 || R.bumpV) {
          // settling after the stop: the nose comes back up past level and down
          R.pv += (-70 * R.pitch - 7 * R.pv) * dt; R.pitch += R.pv * dt;
          R.rv += (-70 * R.roll - 7 * R.rv) * dt; R.roll += R.rv * dt;
          R.sv += (-40 * R.slip - 10 * R.sv) * dt; R.slip += R.sv * dt;
          if (R.bumpV != null) { R.bumpV += (-120 * (R.bump || 0) - 10 * R.bumpV) * dt; R.bump = (R.bump || 0) + R.bumpV * dt; if (Math.abs(R.bump) < 1e-4 && Math.abs(R.bumpV) < 1e-3) { R.bump = 0; R.bumpV = null; } }
          if (Math.abs(R.pitch) < 1e-4 && Math.abs(R.pv) < 1e-3) { R.pitch = 0; R.pv = 0; }
          this.pose(car);
        } else if (car.tyres.some((x, i) => car.sag[i] !== x)) this.pose(car);
        this.stepDoors(car, dt);
      } else if (!R.holesOut) {
        // (a burnt-out cab has no light in it)
        R.holesOut = true;
        for (const d of Object.values(R.doors)) d.hole.visible = false;
      }
      this.lamps(car);
      this.engine(car, dt, burning);
      for (const f of R.riders) f(car, dt, t);
    }
    this.assignSpots();
  }

  // [C8] how far the way ahead of the car is clear (m from its nose, along
  // its heading, the width of the car): the first thing solid - another car
  // (its body, its open doors, a wreck), a column, a post, a hydrant, a man
  // standing, me. Infinity when nothing within its stopping distance
  ahead(car) {
    const S = this.stage, G = this.game, R = car.rail, C = S.colliders;
    const hx = Math.cos(car.yaw), hz = -Math.sin(car.yaw), px = -hz, pz = hx;
    const look = Math.max(4, (R.v * R.v) / (2 * 7) + 3);
    const nose = 2.5, mine = new Set([car.collider, ...(R.cols || [])]);
    const near = (x, z, r) => Math.abs(x - car.pos.x) < look + nose + r + 3 && Math.abs(z - car.pos.z) < look + nose + r + 3;
    const boxes = C.boxes.filter((b) => !mine.has(b) && b.tag !== 'door' && near(b.cx, b.cz, Math.max(b.hx, b.hz)));
    const circles = C.circles.filter((c) => c.r > 0.05 && near(c.x, c.z, c.r));
    const e = G && G.eye;
    for (let s = 0; s <= look; s += 0.4) {
      for (const w of [-0.92, 0, 0.92]) {
        const x = car.pos.x + hx * (nose + s) + px * w, z = car.pos.z + hz * (nose + s) + pz * w;
        for (const b of boxes) {
          const dx = x - b.cx, dz = z - b.cz;
          const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
          if (Math.abs(lx) < b.hx + 0.1 && Math.abs(lz) < b.hz + 0.1) { R.what = b.tag + '@' + b.cx.toFixed(1) + ',' + b.cz.toFixed(1); return s; }
        }
        for (const c of circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.15) ** 2) { R.what = c.tag + '@' + c.x.toFixed(1) + ',' + c.z.toFixed(1); return s; }
        if (e && (x - e.x) ** 2 + (z - e.z) ** 2 < 0.45 * 0.45 && e.y < 3) { R.what = 'me'; return s; }
      }
    }
    return Infinity;
  }

  // a knock on the car (a body on its roof): it bounces on its springs
  bump(car, v = -0.6) { const R = car.rail; if (!R) return; R.bumpV = (R.bumpV || 0) + v; }

  // the headlamps: cones and the registry entry ride with the car; out with
  // a broken lens, a wreck, or the lights switched off
  lamps(car) {
    const R = car.rail;
    if (!R.cones.length) return;
    const g = car.group;
    const on = R.lit && car.state !== 'burning';
    for (let i = 0; i < 2; i++) {
      const cone = R.cones[i];
      const lit = on && !car.lensBroken[i];
      cone.visible = lit;
      if (!lit) continue;
      const apex = _v.copy(LAMPS[i]).applyMatrix4(g.matrixWorld);
      const ax = _w.copy(BEAM).transformDirection(g.matrixWorld);
      cone.position.copy(apex);
      cone.quaternion.setFromUnitVectors(V(0, -1, 0), ax);
      const U = cone.material.uniforms;
      U.uApex.value.copy(apex); U.uAxis.value.copy(ax);
    }
    const E = R.entry;
    const n = on ? car.lensBroken.filter((b) => !b).length : 0;
    E.intensity = 0.35 * n;
    E.position.set(2.2, 1.05, 0).applyMatrix4(g.matrixWorld);
    E.direction.copy(BEAM).transformDirection(g.matrixWorld);
  }

  // the two pooled spots go to the lit cars nearest the eye (a moving car first)
  assignSpots() {
    const eye = this.game.camera.position;
    const cands = this.list.filter((c) => c.rail && c.rail.lit && c.state !== 'burning' && c.lensBroken.some((b) => !b));
    cands.sort((a, b) => (a.rail.done ? 1 : 0) - (b.rail.done ? 1 : 0) || a.pos.distanceToSquared(eye) - b.pos.distanceToSquared(eye));
    this.spots.forEach((S, i) => {
      const car = cands[i];
      const L = S.light;
      if (!car) { L.intensity = 0; S.car = null; return; }
      S.car = car;
      const g = car.group;
      L.position.set(2.75, 1.0, 0).applyMatrix4(g.matrixWorld);
      L.target.position.set(16, -0.6, 0).applyMatrix4(g.matrixWorld);
      L.target.updateMatrixWorld();
      L.intensity = 42 * car.lensBroken.filter((b) => !b).length / 2;
    });
  }

  engine(car, dt, dead) {
    const R = car.rail, sfx = this.game.sfx;
    if (!sfx || !sfx.live) return;
    if (dead || !R.engine) { if (sfx.loops.has(R.sound)) sfx.stopLoop(R.sound); return; }
    const k = Math.min(1, R.v / 14);
    _v.set(car.pos.x, 0.8, car.pos.z);
    sfx.loop(R.sound, _v, 0.14 + 0.5 * k, 'brown', 180 + 260 * k, 28, true);
    sfx.loop(R.sound + 'h', _v, 0.03 + 0.08 * k, 'pink', 500 + 900 * k, 220, true);
  }

  // ---- the car stopped: it is in the Hoods' way, and it is cover ------------------------------
  settle(car) {
    const R = car.rail, S = this.stage, nav = S.nav;
    if (!R.nav) R.nav = [];
    R.stamped = R.stamped || new Set();
    const stamp = (b) => {
      if (R.stamped.has(b)) return;
      R.stamped.add(b);
      const inflate = 0.45, rx = b.hx + inflate + 0.5, rz = b.hz + inflate + 0.5, rr = Math.hypot(rx, rz);
      for (let z = b.cz - rr; z <= b.cz + rr; z += nav.cell * 0.5) for (let x = b.cx - rr; x <= b.cx + rr; x += nav.cell * 0.5) {
        const k = nav.idx(x, z);
        if (k < 0 || nav.blocked[k]) continue;
        const i = k % nav.nx, j = (k / nav.nx) | 0;
        const cx = nav.x0 + (i + 0.5) * nav.cell, cz = nav.z0 + (j + 0.5) * nav.cell;
        const dx = cx - b.cx, dz = cz - b.cz;
        const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
        const qx = Math.max(0, Math.abs(lx) - b.hx), qz = Math.max(0, Math.abs(lz) - b.hz);
        if (qx * qx + qz * qz < inflate * inflate) { nav.blocked[k] = 1; R.nav.push(k); }
      }
    };
    const add = (x, z, obs, value) => {
      if (!nav.free(x, z)) return;
      const c = { x, z, obs, tag: 'car', value, taken: null, b7: true };
      S.covers.points.push(c);
      R.covers.push(c);
    };
    // the car: its footprint off the grid, cover points round it (CoverSet's
    // rule for a box: both long faces, the ends)
    if (!R.stamped.has(car.collider)) {
      stamp(car.collider);
      const b = car.collider, pad = 0.6;
      const obs = { kind: 'box', b };
      for (const sz of [-1, 1]) for (const f of [-0.62, 0, 0.62]) { const lx = f * b.hx, lz = sz * (b.hz + pad); add(b.cx + lx * b.c + lz * b.s, b.cz - lx * b.s + lz * b.c, obs, 0.9); }
      for (const sx of [-1, 1]) { const lx = sx * (b.hx + pad); add(b.cx + lx * b.c, b.cz - lx * b.s, obs, 0.9); }
    }
    // each open door: off the grid, and a man's place behind it
    for (const d of Object.values(R.doors)) {
      if (!d.col || R.stamped.has(d.col)) continue;
      stamp(d.col);
      const db = d.col;
      for (const sz of [-1, 1]) add(db.cx + sz * 0.62 * db.s, db.cz + sz * 0.62 * db.c, { kind: 'box', b: db }, 0.8);
    }
  }

  unsettle(car) {
    const R = car.rail, S = this.stage;
    if (R.nav) for (const k of R.nav) S.nav.blocked[k] = 0;
    R.nav = null; R.stamped = null;
    const P = S.covers.points;
    for (const c of R.covers) { const i = P.indexOf(c); if (i >= 0) P.splice(i, 1); }
    R.covers.length = 0;
  }

  // ---- taking it away --------------------------------------------------------------------------------
  remove(car) {
    const S = this.stage, C = S.cars, G = this.game, R = car.rail;
    const i = this.list.indexOf(car);
    if (i >= 0) this.list.splice(i, 1);
    if (R) {
      this.unsettle(car);
      for (const cone of R.cones) { S.scene.remove(cone); cone.geometry.dispose(); cone.material.dispose(); }
      if (R.entry) S.lights.remove(R.entry);
      for (const b of R.cols) { const k = S.colliders.boxes.indexOf(b); if (k >= 0) S.colliders.boxes.splice(k, 1); }
      if (G && G.sfx && G.sfx.live) { G.sfx.stopLoop(R.sound); G.sfx.stopLoop(R.sound + 'h'); }
      for (const S2 of this.spots) if (S2.car === car) { S2.car = null; S2.light.intensity = 0; }
    }
    const k = C.cars.indexOf(car);
    if (k >= 0) C.cars.splice(k, 1);
    if (car.fire) { const f = C.fires.indexOf(car.fire); if (f >= 0) C.fires.splice(f, 1); car.fire.dispose(); car.fire = null; C.assignFireLights(); }
    C.chains = C.chains.filter((c) => c.car !== car);
    const bi = S.colliders.boxes.indexOf(car.collider);
    if (bi >= 0) S.colliders.boxes.splice(bi, 1);
    if (G && G.react) G.react.hazards = G.react.hazards.filter((h) => h.car !== car);
    if (G && G.fx) for (let p = 0; p < car.panes.length; p++) G.fx.decals.hideOwner('car' + car.id + ':' + p);
    car.group.traverse((o) => { if (o.isMesh) S.removeSolid(o); });
    if (R && R.wheels) for (const w of R.wheels) w.mesh.geometry.dispose();
    // [C10b] the car's own body, glass and doors (Cars.spawn's merges, openDoor's leaves) off the GPU with it:
    // every retry of VIII spawns its cars again (+~25 geometries a retry before); a geometry shared with
    // another car is only uploaded again on its next draw
    car.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    S.scene.remove(car.group);
    if (car.shadow && car.shadow.parent) car.shadow.parent.remove(car.shadow);
    car.state = 'dead';
  }

  clear() { for (const car of [...this.list]) this.remove(car); }

  // the rig itself goes (the scene ends): its spots out of the scene
  dispose() {
    this.clear();
    for (const S of this.spots) if (!S.borrowed) { this.stage.scene.remove(S.light, S.light.target); S.light.dispose(); }
    // [R2-F] the lamp pool's light back as it was
    const B = this.borrowed;
    if (B) {
      const sp = B.slot.spot;
      Object.assign(sp, { angle: B.angle, penumbra: B.penumbra, distance: B.distance, decay: B.decay, intensity: 0 });
      B.slot.lamp = null; B.slot.k = 0;
      const pool = this.stage.lamps && this.stage.lamps.pool;
      if (pool && !pool.includes(B.slot)) pool.push(B.slot);
      this.borrowed = null;
    }
    this.spots.length = 0;
  }
}

// ---- [R2-F] the front wheels ------------------------------------------------------------------------
// The block's sedan (world/Cars.js) draws its four wheels inside five merged
// meshes (the tyres with the running boards, the whitewalls, the hub discs,
// the caps, the dark discs with the grille). A car on a rail gets its own
// copy of those five geometries - the same five draws - and the front wheels'
// vertices (the triangles whose middle lies in a front wheel's round) are
// turned about the wheel's upright as the rail bends. The bullets keep the
// shared template (userData.rayGeo: its BVH is already built); the far build
// (Cars.lodUpdate, shadowLod) passes these meshes by: they are kept under
// keys of the car's own.
const WHEEL_KEYS = ['rubber', 'white', 'hubs', 'caps', 'dark'];
const FRONT = [[1.55, 0.78], [1.55, -0.78]];
const WHEEL_Y = 0.375;
const FRONT_SEL = new Map();
function frontOf(geo) {
  let sel = FRONT_SEL.get(geo);
  if (sel) return sel;
  const pa = geo.getAttribute('position');
  sel = FRONT.map(([cx, cz]) => {
    const idx = [];
    for (let t = 0; t + 2 < pa.count; t += 3) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) { x += pa.getX(t + k); y += pa.getY(t + k); z += pa.getZ(t + k); }
      x /= 3; y /= 3; z /= 3;
      if (Math.abs(x - cx) < 0.42 && Math.abs(y - WHEEL_Y) < 0.42 && Math.abs(z - cz) < 0.2) idx.push(t, t + 1, t + 2);
    }
    // (contiguous runs: only they are uploaded again)
    const ranges = [];
    for (const i of idx) { const r = ranges[ranges.length - 1]; if (r && r[0] + r[1] === i) r[1]++; else ranges.push([i, 1]); }
    return { cx, cz, idx: Int32Array.from(idx), ranges };
  });
  FRONT_SEL.set(geo, sel);
  return sel;
}
function ownWheels(car, T) {
  const out = [];
  for (const k of WHEEL_KEYS) {
    const m = car.meshes[k], src = T[k];
    if (!m || !src || !src.getAttribute('normal')) continue;
    const sel = frontOf(src);
    if (!sel.some((s) => s.idx.length)) continue;
    const geo = new THREE.BufferGeometry();
    const pos = src.getAttribute('position').clone(), nor = src.getAttribute('normal').clone();
    pos.setUsage(THREE.DynamicDrawUsage); nor.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pos); geo.setAttribute('normal', nor);
    if (!src.boundingSphere) src.computeBoundingSphere();
    geo.boundingSphere = src.boundingSphere.clone();
    if (src.boundingBox) geo.boundingBox = src.boundingBox.clone();
    m.geometry = geo;
    m.userData.rayGeo = src;
    delete car.meshes[k];
    car.meshes['b7' + k] = m;
    out.push({ mesh: m, pos, nor, p0: src.getAttribute('position').array, n0: src.getAttribute('normal').array, sel });
  }
  return out;
}
function turnWheels(W, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (const w of W) {
    const P = w.pos.array, N = w.nor.array, P0 = w.p0, N0 = w.n0;
    w.pos.clearUpdateRanges(); w.nor.clearUpdateRanges();
    for (const S of w.sel) {
      const I = S.idx;
      for (let j = 0; j < I.length; j++) {
        const i = I[j] * 3;
        const dx = P0[i] - S.cx, dz = P0[i + 2] - S.cz;
        P[i] = S.cx + dx * c + dz * s; P[i + 2] = S.cz - dx * s + dz * c;
        const nx = N0[i], nz = N0[i + 2];
        N[i] = nx * c + nz * s; N[i + 2] = -nx * s + nz * c;
      }
      for (const [st, n] of S.ranges) { w.pos.addUpdateRange(st * 3, n * 3); w.nor.addUpdateRange(st * 3, n * 3); }
    }
    w.pos.needsUpdate = true; w.nor.needsUpdate = true;
  }
}

// ---- the speed plan along a rail -----------------------------------------------------------------
// samples every half metre: the cruise, slower through the bends (lateral
// grip `lat` m/s^2), braking at `decel` into the stop, accelerating at `accel`
function plan(curve, L, { cruise, v0, decel, accel, stop, lat }) {
  const ds = 0.5, n = Math.max(2, Math.ceil(L / ds) + 1);
  const v = new Float32Array(n);
  const prev = new THREE.Vector3(), cur = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u0 = Math.max(0, (i - 1) * ds / L), u1 = Math.min(1, (i + 1) * ds / L);
    prev.copy(curve.getTangentAt(u0)); cur.copy(curve.getTangentAt(u1));
    const ang = Math.acos(Math.max(-1, Math.min(1, prev.dot(cur))));
    const kappa = ang / Math.max(1e-3, (u1 - u0) * L);
    v[i] = Math.min(cruise, kappa > 1e-4 ? Math.sqrt(lat / kappa) : cruise);
  }
  if (stop) v[n - 1] = 0;
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * decel * ds));
  v[0] = Math.min(v[0], v0);
  for (let i = 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * accel * ds));
  return { v, ds, n };
}
function sampleV(P, s) {
  const f = s / P.ds, i = Math.min(P.n - 2, Math.floor(f)), u = Math.min(1, f - i);
  return P.v[i] + (P.v[i + 1] - P.v[i]) * u;
}

export { allocInkId };
