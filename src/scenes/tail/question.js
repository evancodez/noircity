import * as THREE from 'three';
import { wait, until } from '../../game/script.js';
import { ROAD, roadPoint, frameAt, project } from '../../stages/riverroad/road.js';
import { DRIVE } from '../../player/clips/drive.js';
import { LAPELS } from '../../player/clips/lapels.js';

// The question (scene 7's last beats): out of my car, the watcher crawls
// out of his, I take him by the lapels and put him against his car; the one
// question is asked with a look at the river three metres behind him. As
// the eyes go to the water I walk him to the rail and bend him back over
// it; he breaks: "Pier nine." I let go; he slides down the railing.
// (the watcher is lane B4's kind when it is here, else couple_him)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const F = {};
const ease = (u) => u * u * (3 - 2 * u);

export class Question {
  constructor(tail) {
    this.tail = tail;
    this.ctx = tail.ctx;
    this.game = tail.game;
    this.p = 0;
    this.stareT = 0;
  }

  // the watcher at his door, crawling out (his car: tail.his)
  spawnWatcher() {
    const C = this.ctx.cast, his = this.tail.his;
    if (his.driverFig) his.driverFig.visible = false;
    const kind = C.has('watcher') ? 'watcher' : 'couple_him';
    // his door: the side of his car toward the road
    const c = Math.cos(his.yaw), s = Math.sin(his.yaw);
    const rz = { x: s, z: c };   // the car's +z (its right) in the world
    frameAt(his.s, F);
    const toRoad = -(rz.x * F.rx + rz.z * F.rz) > 0 ? 1 : -1;   // +1: its +z faces the road
    const side = toRoad;
    this.side = side;
    const door = his.seat(new THREE.Vector3(-0.1, 0, side * 1.45), new THREE.Vector3());
    // (facing away from his car, toward the road: a heading)
    const out = { x: rz.x * side, z: rz.z * side };
    const yaw = Math.atan2(out.x, out.z);
    this.man = C.spawn(kind, { at: { x: door.x, z: door.z }, yaw });
    this.man.play('tail_crawl', { hold: true, fade: 0.05 });
    // [R2] his raincoat soaked through: a pale coat (scene 6's, the runner
    // the eye follows in the alleys) printed at the rail as a flat paper
    // plate filling the frame; wet, it is a dark grey the lamp above picks
    // out on the shoulders and the brim. (The ink reads a figure's print off
    // its albedo, the geometry's colours: his own copies of the three LODs,
    // the costume's are shared with scene 6's man)
    const fig = this.man.fig;
    if (fig && fig.lods && fig.mesh) {
      const cur = fig.lods.indexOf(fig.mesh.geometry);
      fig.lods = fig.lods.map((g) => {
        const c = g.clone();
        const col = c.getAttribute('color');
        if (col) { for (let i = 0; i < col.array.length; i++) col.array[i] *= 0.42; col.needsUpdate = true; }
        return c;
      });
      fig.mesh.geometry = fig.lods[Math.max(0, cur)];
      this._wetLods = fig.lods;
    }
    this.carSide = { x: rz.x * side, z: rz.z * side };   // out of his car's side
    return this.man;
  }

  // ---- getting out of my car ------------------------------------------------------------------
  *getOut() {
    const G = this.game, T = this.tail, my = T.my, C = G.controller;
    const from = C.eyePose();
    // out of my door and a step up past the front wing, looking at his car
    // (my car a wall behind me now: it stands in the way of a man on foot)
    const at = my.seat(new THREE.Vector3(0.9, 0, -1.5), new THREE.Vector3());
    if (!my.walled) { my.walled = true; G.stage.colliders.addBox(my.pos.x, my.pos.z, my.spec.halfL, my.spec.halfW, my.yaw, 'car'); }
    const gy = G.stage.surfaceY(at.x, at.z);
    const to = new THREE.Vector3(at.x, gy + 1.65, at.z);
    const tgt = T.his.pos;
    const yaw = Math.atan2(-(tgt.x - to.x), -(tgt.z - to.z));
    G.sfx.play('tail_door', my.pos, { open: 1 }, { ref: 3 });
    DRIVE.car = null;
    G.player.hands.equip('empty');
    // (out through the door: down and out, then up to standing)
    const dur = 1.25;
    // [R2] (the lens eases from the car's back to a man's on foot: the drive
    // mode gives the lens back at once as it lets go, and from the spin's
    // push-in that was a 24 degree jump on the first frame out of the seat)
    const cam = G.camera, fovFrom = from.fov, fovTo = C.drive ? C.drive.fov0 : cam.fov;
    C.setMode('cutscene', {
      track: (t) => {
        const u = clamp(t / dur, 0, 1), e = ease(u);
        const f = fovFrom + (fovTo - fovFrom) * e;
        if (Math.abs(cam.fov - f) > 1e-3) { cam.fov = f; cam.updateProjectionMatrix(); }
        const dip = Math.sin(u * Math.PI) * 0.18;
        return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - dip, z: from.z + (to.z - from.z) * e,
          yaw: from.yaw + Math.atan2(Math.sin(yaw - from.yaw), Math.cos(yaw - from.yaw)) * e, pitch: from.pitch + (-0.12 - from.pitch) * e };
      },
      ease: 0.001,
    });
    yield wait(dur);
    G.sfx.play('tail_door', my.pos, { open: 0 }, { ref: 3 });
    C.setPose(to.x, to.z, yaw, -0.12);
    // (the room is the street's again: my cabin's look moves off with the car)
    T.cabinBox.min.set(1e5, 1e5, 1e5); T.cabinBox.max.set(1e5, 1e5, 1e5);
    T.out = true;
  }

  // ---- the grab: both hands on his lapels, him against his car ---------------------------------
  *grab() {
    const G = this.game, man = this.man, his = this.tail.his, C = G.controller;
    // he stands a hand off his car's side, facing me
    const eye = G.camera.position;
    const cs = this.carSide;
    const side = his.seat(new THREE.Vector3(0, 0, 0), new THREE.Vector3());
    // (the point on his car's side nearest me)
    const l = his.local(eye, new THREE.Vector3());
    // (at the end of his car nearest me: the rail and the river are a
    // step round its corner, so the walk to them is short and faces them)
    const lx = l.x >= 0 ? 1.75 : -1.9;
    const wall = his.seat(new THREE.Vector3(lx, 0, this.side * (his.spec.halfW + 0.36)), new THREE.Vector3());
    void side;
    const face = Math.atan2(cs.x, cs.z);   // his heading: away from the car
    man.place({ x: wall.x, z: wall.z }, face);
    man.play('tail_pinned', { fade: 0.12 });
    this.pin = wall.clone();
    this.face = face;
    // the eye: a forearm's length in front of him, looking at him
    const at = new THREE.Vector3(wall.x + cs.x * 0.64, G.stage.surfaceY(wall.x, wall.z) + 1.68, wall.z + cs.z * 0.64);
    const lookYaw = Math.atan2(cs.x, cs.z);   // (the eye's yaw looks along -(sin, cos): back at him)
    C.setMode('hold', { at, face: lookYaw, pitch: -0.1, ease: 0.28 });
    LAPELS.man = man; LAPELS.k = 1; LAPELS.camera = G.camera;
    G.player.hands.equip('lapels');
    G.sfx.play('tail_thud', wall, { k: 1 }, { ref: 3 });
    C.kick(2.2, 1.5, 0.14);
    C.shake(0.3, 0);
    // the rail beside his car: along the pavement past its end nearest me,
    // then up to the rail (the walk never turns back on itself)
    const pin = project(wall.x, wall.z, his.s, {});
    const ends = [his.seat(new THREE.Vector3(2.4, 0, 0), new THREE.Vector3()), his.seat(new THREE.Vector3(-2.4, 0, 0), new THREE.Vector3())]
      .map((e) => project(e.x, e.z, his.s, {}));
    const eyeS = project(eye.x, eye.z, his.s, {}).s;
    const near = Math.abs(ends[0].s - eyeS) < Math.abs(ends[1].s - eyeS) ? ends[0] : ends[1];
    const sRail = near.s + Math.sign(near.s - pin.s || 1) * 1.1;
    const pr = { s: sRail, d: ROAD.rail - 0.45 };
    this.path = [this.pin.clone(), roadPoint(sRail, Math.min(Math.max(pin.d, 6.4), ROAD.rail - 1.4)), roadPoint(sRail, ROAD.rail - 0.45)];
    // (the water past the rail where he is being walked: to the side of him
    // as the question starts, so a look at him is not a look at it; the far
    // lights lie on it)
    this.water = roadPoint(sRail + Math.sign(sRail - pin.s || 1) * 1.5, ROAD.rail + 8, ROAD.waterY);   // (8 m out: a look at it takes in the river and the far bank, not the stones at my feet)
    this.railS = pr.s;
    // [R2] the bent lamp's shade on the spot where he will go over the rail
    // (on the water ahead of me as I look at it past him: the cone falls
    // from over my shoulder into the frame, past him onto the river)
    // (a stride along past him, so the lit water is seen beside him from
    // over his shoulders, not behind them: his hat comes down in it)
    if (this.tail.wreck) this.tail.wreck.aimAt = roadPoint(sRail + Math.sign(sRail - pin.s || 1) * 2.5, ROAD.quay + 2.4, ROAD.waterY + 0.3);
    yield wait(0.35);
  }

  // where along the path (0 .. 1 of the walk) -> his place
  placeAt(w) {
    const P = this.path;
    const L1 = P[0].distanceTo(P[1]), L2 = P[1].distanceTo(P[2]), L = L1 + L2;
    const d = w * L;
    return d < L1 ? _v.lerpVectors(P[0], P[1], d / L1) : _v.lerpVectors(P[1], P[2], (d - L1) / Math.max(1e-3, L2));
  }

  // ---- the look: each step while held -----------------------------------------------------------
  // returns true once he has broken
  step(dt) {
    const G = this.game, C = G.controller, H = C.hold, man = this.man;
    if (!H || !this.path) return false;
    // (look development, ?tailLookRiver=1: the eyes go to the water by
    // themselves, a second after he is taken - the shot mode has no mouse)
    if (this.autoLook === undefined) this.autoLook = typeof location !== 'undefined' && new URLSearchParams(location.search).get('tailLookRiver') === '1';
    if (this.autoLook && (this.heldT = (this.heldT || 0) + dt) > 0.9) {
      const e = G.camera.position, w = this.water;
      // (on the way, the eyes lift off the water a little, toward the far
      // bank: still inside the look's cone, and the river reads as a river)
      const yaw = Math.atan2(-(w.x - e.x), -(w.z - e.z)) - H.face, pitch = Math.atan2(w.y - e.y, Math.hypot(w.x - e.x, w.z - e.z)) + (this.p > 0.35 ? 0.03 : 0);
      const k = 1 - Math.exp(-dt * 3);
      H.look.yaw += (Math.atan2(Math.sin(yaw), Math.cos(yaw)) - H.look.yaw) * k;
      H.look.pitch += (pitch - H.look.pitch) * k;
    }
    // is the eye on the water? (the angle between the look and the water)
    const eye = G.camera.position;
    const fwd = _w.set(0, 0, -1).transformDirection(G.camera.matrixWorld);
    const toW = new THREE.Vector3().subVectors(this.water, eye).normalize();
    const on = fwd.dot(toW);
    // (and at the water rather than at him: once he stands between me and
    // it, at the rail, either will do)
    const toM = new THREE.Vector3(man.pos.x - eye.x, man.pos.y + 1.3 - eye.y, man.pos.z - eye.z).normalize();
    const atHim = fwd.dot(toM);
    // (the water lies below and beyond him: the eyes must go down past his
    // shoulder to it, ~20 degrees round it; a look at his face is not one)
    const k = clamp((on - 0.935) / 0.05, 0, 1) * (this.p > 0.03 || atHim < 0.965 ? 1 : 0);
    if (k > 0) { this.p = Math.min(1, this.p + dt * (0.18 + 0.32 * k)); this.stareT = 0; }
    else this.stareT += dt;
    // after a while of staring at him: the one small prompt
    if (this.stareT > 5.5 && this.p < 0.95 && !this.broken) G.hud.prompt('MOUSE  look at the river', null, 'tail');
    else G.hud.clearPrompt('tail');
    // walk (0 .. 0.72 of p), then the bend back (0.72 .. 1)
    const w = ease(clamp(this.p / 0.72, 0, 1));
    const bend = ease(clamp((this.p - 0.72) / 0.28, 0, 1));
    const at = this.placeAt(w).clone();
    // his heading: back first, toward the rail (he walks backward, I push)
    const P = this.path;
    const dir = w < 0.999 ? new THREE.Vector3().subVectors(this.placeAt(Math.min(1, w + 0.02)).clone(), at) : new THREE.Vector3().subVectors(P[2], P[1]);
    if (dir.lengthSq() < 1e-6) dir.subVectors(P[2], P[1]);
    dir.y = 0; dir.normalize();
    const heading = Math.atan2(-dir.x, -dir.z);   // (he faces away from where he is going)
    // [2nd pass] he turns as he is walked, not before: over his first metre
    // back (he was turned a quarter round at once as the question began, and
    // the eye in front of him swung round with him)
    const moved = this.lastAt ? Math.hypot(at.x - this.lastAt.x, at.z - this.lastAt.z) : 0;
    this.hd = this.hd == null ? this.face : this.hd + Math.atan2(Math.sin(heading - this.hd), Math.cos(heading - this.hd)) * (1 - Math.exp(-moved * 2.6));
    // (our feet on the wet stones as I walk him back: a step each way)
    if (this.lastAt) { this.stepAcc = (this.stepAcc || 0) + this.lastAt.distanceTo(at); if (this.stepAcc > 0.5) { this.stepAcc = 0; G.sfx.step(at.clone(), false, false); G.sfx.step(null, false, true); } }
    (this.lastAt || (this.lastAt = new THREE.Vector3())).copy(at);
    man.place({ x: at.x, z: at.z }, this.hd);
    // (the bend: back over the rail - his clip - as the walk ends)
    if (bend > 0.02 && !this.bent) { this.bent = true; man.play('tail_overRail', { fade: 0.55 }); G.sfx.play('tail_thud', at, { k: 0.6 }, { ref: 3 }); G.controller.kick(1.2, 0.8, 0.12); }
    LAPELS.bend = bend;
    // the eye: in front of him, leaning over him as he goes back
    const fx = Math.sin(this.hd), fz = Math.cos(this.hd);   // his forward (toward me)
    const gy = G.stage.surfaceY(at.x, at.z);
    // [R2] (over him: my weight goes onto him as he goes back, so my eye
    // stands over his feet and looks down on his brim, the rail and the
    // water - his bend is deep now, and a step back from it left my fists a
    // metre out)
    const lean = 0.64 - bend * 0.4;
    H.at.set(at.x + fx * lean, gy + 1.68 - bend * 0.03, at.z + fz * lean);
    // [2nd pass] the look stays where the player put it in the world as he
    // is walked round (it was kept relative to him, so the view swung with
    // him and the eyes slid off the water they had found)
    const face = Math.atan2(fx, fz), dFace = Math.atan2(Math.sin(face - H.face), Math.cos(face - H.face));
    H.look.yaw = clamp(H.look.yaw - dFace, -1.9, 1.9);
    H.face = face;
    // [R2] over the rail he fights it for a breath (his clip's struggle, his
    // feet scraping the stones, the jolts in my arms), then breaks: the
    // bend's end was the break, and the struggle was never seen
    if (this.p >= 1 && !this.broken) {
      const o0 = this.overT || 0;
      this.overT = o0 + dt;
      for (const at2 of [0.3, 0.75]) if (o0 < at2 && this.overT >= at2) { G.sfx.step(man.pos.clone(), false, false); G.controller.kick(0.5, 0.4, 0.1); }
      if (this.overT >= 1.1) {
        this.broken = true;
        man.play('tail_broken', { fade: 0.35 });
        this.hatOff();
        return true;
      }
    }
    return false;
  }

  // (his own copies of the figure's geometry go with the scene)
  dispose() { if (this._wetLods) for (const g of this._wetLods) g.dispose(); this._wetLods = null; }

  // ---- [R2] his hat into the river as he breaks ---------------------------------------------------
  // The bowler goes off the back of his head over the water: it turns over
  // in the air, drops the three metres to the river, slaps down (a ring on
  // the water under the lamp, the plop), rights itself crown up and rides
  // off on the current, rocking. His own flight for a knocked-off hat lands
  // it on the ground he stands on; this one's ground is the river.
  hatOff() {
    const fig = this.man && this.man.fig;
    if (!fig || !fig.bones || !fig.bones.hat || fig.hat || !fig.throwCover) return;
    fig.throwCover(new THREE.Vector3(0, 0, 0));
    if (!fig.hat) return;
    fig.hat.rest = true;
    const hat = fig.hat.bone, obj = fig.object;
    obj.updateMatrixWorld(true);
    const at = hat.getWorldPosition(new THREE.Vector3());
    // back, away from me (his heading faces me), and up off his head
    const away = new THREE.Vector3(-Math.sin(this.hd), 0, -Math.cos(this.hd));
    frameAt(this.railS, F);
    const out = new THREE.Vector3(F.rx, 0, F.rz);
    // (and off to the side of him, past his shoulder: straight back it fell
    // behind him, hidden by his own shoulders)
    const side = new THREE.Vector3(F.fx, 0, F.fz).multiplyScalar(Math.sign(this.water ? project(this.water.x, this.water.z, this.railS, {}).s - this.railS : 1) || 1);
    const dir = away.clone().lerp(out, 0.5).normalize().addScaledVector(side, 0.65).normalize();
    // [R2] (off his head and well out over the water, as his head jerks
    // back: it tumbled 1 m out and fell behind his own shoulders, and the
    // eyes that went down after it found his coat)
    this.hatS = {
      hat, obj, at, vel: dir.multiplyScalar(2.5).add(new THREE.Vector3(0, 1.25, 0)),
      axis: new THREE.Vector3(dir.z, 0, -dir.x).normalize(), spin: 7.5, t: 0, wet: false, drift: new THREE.Vector3(F.fx, 0, F.fz).multiplyScalar(-0.35).addScaledVector(out, 0.12),
      q: hat.getWorldQuaternion(new THREE.Quaternion()),
    };
    // (where it will come down on the water: into the bent lamp's light on
    // the river, where a black hat reads against the lit ripples - on the
    // black water beyond it, it was lost; the eyes go to it as it falls)
    {
      const H = this.hatS, g = 9.8, h0 = H.at.y - (ROAD.waterY + 0.02);
      const tl = (H.vel.y + Math.sqrt(H.vel.y * H.vel.y + 2 * g * Math.max(0, h0))) / g;
      const W = this.tail.wreck && this.tail.wreck.aimAt;
      if (W) {
        const vx = (W.x - H.at.x) / tl, vz = (W.z - H.at.z) / tl, sp = Math.hypot(vx, vz), k = sp > 4.5 ? 4.5 / sp : 1;
        H.vel.x = vx * k; H.vel.z = vz * k;
      }
      H.land = new THREE.Vector3(H.at.x + H.vel.x * tl, ROAD.waterY, H.at.z + H.vel.z * tl);
      H.tLand = tl;
    }
    this.ctx.onStep((dt) => this.hatStep(dt));
  }
  hatStep(dt) {
    const H = this.hatS;
    if (!H || dt <= 0) return;
    const G = this.game;
    H.t += dt;
    if (!H.wet) {
      H.vel.y -= 9.8 * dt;
      H.at.addScaledVector(H.vel, dt);
      // (the quay: it clears the edge before it drops below the stones)
      const pr = project(H.at.x, H.at.z, this.railS, {});
      if (pr.d < ROAD.quay + 0.25 && H.at.y < ROAD.pave + 0.2) { const p = roadPoint(pr.s, ROAD.quay + 0.25, H.at.y); H.at.x = p.x; H.at.z = p.z; }
      H.q.premultiply(new THREE.Quaternion().setFromAxisAngle(H.axis, H.spin * dt));
      if (H.at.y <= ROAD.waterY + 0.02) {
        H.wet = true; H.at.y = ROAD.waterY + 0.02; H.tWet = H.t;
        G.sfx.play('tail_hatSplash', H.at.clone(), {}, { ref: 5 });
        const W = G.stage.street && G.stage.street.water;
        if (W && W.material.uniforms.uDrop) W.material.uniforms.uDrop.value.set(H.at.x, H.at.z, G.stage.U.uTime.value, 1.2);
        const r = this.ctx.rng;
        for (let i = 0; i < 26; i++) G.fx.sparks.spawn({ pos: H.at.clone(), vel: new THREE.Vector3(r.gauss() * 0.8, r.range(1.0, 2.8), r.gauss() * 0.8), life: r.range(0.3, 0.6), size: [0.014, 0.022], stretch: 0.04, col: [3, 3, 3], cell: 4, gravity: 9.8, fadeOut: 0.3 });
      }
    } else {
      // afloat: crown up, rocking, carried off on the current
      const u = H.t - H.tWet;
      H.at.addScaledVector(H.drift, dt);
      H.at.y = ROAD.waterY + 0.02 + Math.sin(u * 3.1) * 0.012 * Math.exp(-u * 0.4);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(H.q);
      H.q.premultiply(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0)), Math.min(1, dt * 6)));
      H.q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.4));
      const rock = new THREE.Quaternion().setFromAxisAngle(H.axis, Math.sin(u * 2.3) * 0.08 * Math.exp(-u * 0.3));
      H.qShow = H.q.clone().premultiply(rock);
    }
    // (the eyes go down with it, as they went with his spin: its fall and the
    // splash under the lamp are the moment he breaks - then they are the
    // player's again)
    const C = G.controller, HL = C.hold;
    if (HL && H.t < H.tLand + 0.8) {
      // [R2] (the eyes go down to where it will land, as it goes up off his
      // head, and only down: the splash sits in the lower part of the frame
      // beside him, the water and its lights above it - followed as it
      // flew, the eyes rose with it off the water, then fell to his coat)
      const e = G.camera.position, L = H.land;
      if (H.pitch0 == null) H.pitch0 = HL.look.pitch;
      const yaw = Math.atan2(-(L.x - e.x), -(L.z - e.z)) - HL.face;
      const pitch = Math.min(H.pitch0, Math.atan2(L.y - e.y, Math.hypot(L.x - e.x, L.z - e.z)) + 0.27);
      const k = 1 - Math.exp(-dt * 3.5);
      HL.look.yaw += Math.atan2(Math.sin(yaw - HL.look.yaw), Math.cos(yaw - HL.look.yaw)) * k * 0.45;
      HL.look.pitch += (Math.max(-0.62, pitch) - HL.look.pitch) * k;
    }
    // (into the man's frame: the hat bone hangs from his root now)
    const h = H.hat, o = H.obj;
    o.updateMatrixWorld(true);
    h.position.copy(o.worldToLocal(H.at.clone()));
    const oq = o.getWorldQuaternion(new THREE.Quaternion()).invert();
    h.quaternion.copy(oq.multiply(H.qShow && H.wet ? H.qShow : H.q));
    h.updateMatrixWorld(true);
  }

  // ---- I let go: he slides down the railing ---------------------------------------------------------
  *release() {
    const G = this.game, man = this.man;
    LAPELS.k = 0;
    LAPELS.man = null;
    G.player.hands.equip('empty');
    // (I step back from him as he goes down)
    const H = G.controller.hold;
    const back = H ? H.at.clone() : null;
    man.play('tail_slide', { hold: true, fade: 0.2 });
    G.sfx.play('tail_slump', man.pos, {}, { ref: 3 });
    for (let t = 0; t < 1.4; t += 1 / 60) {
      if (H && back) { const u = ease(Math.min(1, t / 1.3)); const fx = Math.sin(this.hd), fz = Math.cos(this.hd); H.at.set(back.x + fx * 1.7 * u, back.y + 0.06 * u, back.z + fz * 1.7 * u); }
      // [2nd pass] the eyes go down with him: the last image is him slumped
      // against the rail with the river behind him (the eyes stayed on the
      // far bank and he dropped out of the frame, as if gone)
      if (H) {
        const e = G.camera.position, m = man.pos;
        const wy = Math.atan2(-(m.x - e.x), -(m.z - e.z)) - H.face;
        // (to his chest as he sits: he is in the frame's lower half, the
        // rail and the black water above him)
        // [R2] (a little over him: he sits in the lower half, the rail across
        // the frame, the black river and its lights above him)
        const wp = Math.atan2(m.y + 0.5 - e.y, Math.hypot(m.x - e.x, m.z - e.z)) + 0.14;
        const k = 1 - Math.exp(-(1 / 60) * 3.2);
        H.look.yaw += Math.atan2(Math.sin(wy - H.look.yaw), Math.cos(wy - H.look.yaw)) * k;
        H.look.pitch += (clamp(wp, -0.5, 0.35) - H.look.pitch) * k;
      }
      yield null;
    }
  }
}
export { until };
