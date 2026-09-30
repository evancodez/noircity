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
    this.carSide = { x: rz.x * side, z: rz.z * side };   // out of his car's side
    return this.man;
  }

  // ---- getting out of my car ------------------------------------------------------------------
  *getOut() {
    const G = this.game, T = this.tail, my = T.my, C = G.controller;
    const from = C.eyePose();
    // standing by my door, looking at his car
    const at = my.seat(new THREE.Vector3(-0.35, 0, -1.45), new THREE.Vector3());
    const gy = G.stage.surfaceY(at.x, at.z);
    const to = new THREE.Vector3(at.x, gy + 1.65, at.z);
    const tgt = T.his.pos;
    const yaw = Math.atan2(-(tgt.x - to.x), -(tgt.z - to.z));
    G.sfx.play('tail_door', my.pos, { open: 1 }, { ref: 3 });
    DRIVE.car = null;
    G.player.hands.equip('empty');
    // (out through the door: down and out, then up to standing)
    const dur = 1.25;
    C.setMode('cutscene', {
      track: (t) => {
        const u = clamp(t / dur, 0, 1), e = ease(u);
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
    const lx = clamp(l.x, -1.6, 1.4);
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
    // the rail behind his car: past its end nearest me, then to the rail
    const lend = lx > 0 ? 2.1 : -2.1;
    const P1 = his.seat(new THREE.Vector3(lend + Math.sign(lend) * 0.9, 0, this.side * -(his.spec.halfW + 0.3)), new THREE.Vector3());
    const pr = project(P1.x, P1.z, his.s, {});
    this.path = [this.pin.clone(), roadPoint(pr.s, Math.max(pr.d, 6.8)), roadPoint(pr.s, ROAD.rail - 0.42)];
    // (the water beyond him, out where the far lights lie on it: the eyes
    // on it put him in the lower frame, bent over the rail, the river behind)
    this.water = roadPoint(pr.s + 2, ROAD.rail + 14, ROAD.waterY);
    this.railS = pr.s;
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
    // is the eye on the water? (the angle between the look and the water)
    const eye = G.camera.position;
    const fwd = _w.set(0, 0, -1).transformDirection(G.camera.matrixWorld);
    const toW = new THREE.Vector3().subVectors(this.water, eye).normalize();
    const on = fwd.dot(toW);
    // (and toward the river at all: the eyes past his shoulder)
    const k = clamp((on - 0.82) / 0.14, 0, 1);
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
    this.hd = this.hd == null ? this.face : this.hd + Math.atan2(Math.sin(heading - this.hd), Math.cos(heading - this.hd)) * (1 - Math.exp(-dt * 5));
    man.place({ x: at.x, z: at.z }, this.hd);
    // (the bend: back over the rail - his clip - as the walk ends)
    if (bend > 0.02 && !this.bent) { this.bent = true; man.play('tail_overRail', { fade: 0.55 }); G.sfx.play('tail_thud', at, { k: 0.6 }, { ref: 3 }); G.controller.kick(1.2, 0.8, 0.12); }
    LAPELS.bend = bend;
    // the eye: in front of him, leaning over him as he goes back
    const fx = Math.sin(this.hd), fz = Math.cos(this.hd);   // his forward (toward me)
    const gy = G.stage.surfaceY(at.x, at.z);
    H.at.set(at.x + fx * (0.64 - bend * 0.12), gy + 1.68 - bend * 0.12, at.z + fz * (0.64 - bend * 0.12));
    H.face = Math.atan2(fx, fz);
    if (this.p >= 1 && !this.broken) { this.broken = true; return true; }
    return false;
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
      if (H && back) { const u = ease(Math.min(1, t / 1.2)); const fx = Math.sin(this.hd), fz = Math.cos(this.hd); H.at.set(back.x + fx * 0.45 * u, back.y + 0.12 * u, back.z + fz * 0.45 * u); }
      yield null;
    }
  }
}
export { until };
