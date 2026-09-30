import * as THREE from 'three';
import { LAYER } from '../../render/layers.js';
import { HAND_POSES } from '../../player/handPoses.js';
import { SNEAK_REST } from '../../player/clips/sneak.js';
import { PIER, inShed } from '../../stages/pier9/site.js';

// Me in the dark (lane B6, scene 8): what my body and hands do in Pier Nine.
//   - the hands ('sneak' set) printed by the light on me: paper white in a
//     pool or a beam, ink in the dark (the exposure, shown: their skin and
//     cuffs take a material whose direct light and fill follow it)
//   - C crouches (the controller's sneak mode): quieter, lower, slower; the
//     hands come forward and down with me
//   - footfalls go to the crew's ears (walking heard within 3 m, running 8)
//   - E: the things of the place (a bottle, the switch, the hoist's cord, a
//     door, a man from behind: the scene adds them to game.interact)
//   - with a bottle: hold LMB to aim (an inked arc and where it lands),
//     let go to throw; it breaks, the nearest men go to look
//   - without one: LMB - my hand goes to the revolver in the coat and comes
//     away (a shot here brings the whole pier)
//   - caught: the cosh from behind, black, back at the last checkpoint
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const THROW = { speed: 10.5, lift: 0.3, g: 9.8, dt: 1 / 60 };

// the hands' skin and cuffs in this scene: their lamps' light scaled by how
// lit I am, a flat fill added in the light, the ambient cut in the dark
const EXPO_U = { uLit: { value: 0 }, uFill: { value: 0 }, uAmb: { value: 0.35 } };
function exposedMaterial(src) {
  const m = src.clone();
  m.name = src.name + '_b6';
  m.userData = { ...src.userData, inkSurface: 'paper' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, EXPO_U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLit, uFill, uAmb;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse *= uLit;
        reflectedLight.directSpecular *= uLit;
        reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse * uAmb + diffuseColor.rgb * uFill;`);
  };
  m.customProgramCacheKey = () => 'b6Exposed';
  m.needsUpdate = true;
  return m;
}

export class Stealth {
  constructor(ctx, crew) {
    this.ctx = ctx;
    this.G = ctx.game;
    this.crew = crew;
    this.bottle = null;       // the bottle in my hand
    this.aiming = false;
    this.flying = [];         // bottles in the air
    this.coshT = -1;
    this.coatT = 0;
    this.taught = ctx.game.save.flags.b6taught || (ctx.game.save.flags.b6taught = {});
    this.expo = 0;
    this.feet = V(0, 0, 0);
    // the arc: dots along the path and a ring where it lands
    this.arc = this.makeArc();
  }

  // ---- the hands in this scene -----------------------------------------------------
  // (the set, the lit skin; undone when the scene ends: undress)
  dress() {
    const H = this.G.player.hands;
    for (const h of H.clips) h.done = true;
    H.clips = [];
    for (const k of ['R', 'L']) H.hold(null, k, { keep: true });
    this.G.player.weapons.equip(null);
    H.equip('sneak');
    if (!this.saved) {
      this.saved = [];
      for (const side of ['R', 'L']) {
        const r = H.rig[side];
        for (const mesh of [r.bare, r.cuff]) {
          this.saved.push({ mesh, mat: mesh.material });
          mesh.material = mesh === r.cuff ? (Stealth.cuffMat || (Stealth.cuffMat = exposedMaterial(mesh.material))) : (Stealth.skinMat || (Stealth.skinMat = exposedMaterial(mesh.material)));
        }
      }
    }
  }
  undress() {
    this.G.controller.lookLocked = false;
    if (this.saved) for (const s of this.saved) s.mesh.material = s.mat;
    this.saved = null;
    this.arc.group.visible = false;
    if (this.arc.group.parent) this.arc.group.parent.remove(this.arc.group);
    for (const f of this.flying) if (f.obj.parent) f.obj.parent.remove(f.obj);
    this.flying = [];
    const H = this.G.player.hands;
    if (this.bottle) { H.hold(null, 'R', { keep: true }); this.bottle = null; }
  }

  // ---- per step ------------------------------------------------------------------------
  step(dt) {
    const G = this.G, C = G.controller, H = G.player.hands;
    const S = C.sneak;
    // C: crouch (taught once, by the scene's prompt)
    if (S && G.pressed('KeyC') && this.coshT < 0) { S.crouch = !S.crouch; G.sfx.play('crouch', null, {}, { send: false, gain: 0.5 }); if (S.crouch) this.taught.crouch = true; }
    // what the crew sees of me
    const eye = G.eye;
    const E = G.exposure.player.value;
    this.expo = E;
    this.feet.set(C.pos.x, 0, C.pos.z);
    const P = this.crew.player;
    P.eye.copy(eye); P.head.copy(eye);
    P.chest.copy(eye).setY(eye.y - (S && S.crouch ? 0.25 : 0.42));
    P.feet.copy(this.feet);
    P.crouch = !!(S && S.crouch); P.exposure = E; P.speed = S ? S.speed : 0;
    P.lampLit = this.lampLit(P.head, P.chest);
    // the hands: how lit they print (a quick ease: the light on them is
    // the light on me, 0.15 s behind as the exposure is)
    const lit = sstep(0.12, 0.55, E);
    EXPO_U.uLit.value = 0.02 + 1.1 * lit;
    EXPO_U.uFill.value = 0.55 * lit;
    EXPO_U.uAmb.value = 0.05 + 0.5 * lit;
    // the rest poses follow the crouch
    if (S) {
      const k = S.k;
      for (const side of ['R', 'L']) {
        const P = HAND_POSES['sneak' + side], R = SNEAK_REST[side];
        const sx = side === 'L' ? -1 : 1;
        for (let i = 0; i < 3; i++) P.p[i] = (R.stand[i] + (R.crouch[i] - R.stand[i]) * k) * (i === 0 ? sx : 1);
      }
    }
    // LMB: the bottle's aim and throw; without one, the reach for the gun
    const busy = H.busy || this.coshT >= 0;
    // (the throw is taught once, the first time a bottle is in my hand; a
    // thing E can reach takes the line while it is in reach)
    if (this.teachThrow && this.bottle && !G.interact.current) G.hud.prompt('hold LMB  throw', null, 'b6');
    else if (this.teachThrow) G.hud.clearPrompt('b6');
    if (this.bottle) {
      if (!this.aiming && G.held('Mouse0') && !busy) { this.aiming = true; H.play('sn_aim'); this.taught.throw = true; this.teachThrow = false; G.hud.clearPrompt('b6'); }
      if (this.aiming) {
        // (let go: the throw goes where the arc was drawn a step ago - the
        // release is a hand opening, not a turn of the head)
        if (!G.held('Mouse0')) this.throw();
        else { this.aimQ = (this.aimQ || new THREE.Quaternion()).copy(G.camera.quaternion); this.aimP = (this.aimP || V(0, 0, 0)).copy(G.camera.position); this.drawArc(); }
      }
    } else if (G.pressed('Mouse0') && !busy && this.G.time > this.coatT) {
      this.coatT = this.G.time + 1.2;
      H.play('sn_coat');
      G.sfx.play('pocket', null, {}, { send: false });
    }
    if (!this.aiming) this.arc.group.visible = false;
    // bottles in the air
    for (let i = this.flying.length - 1; i >= 0; i--) if (this.fly(this.flying[i], dt)) this.flying.splice(i, 1);
    // the cosh
    if (this.coshT >= 0) this.coshStep(dt);
  }

  // how lit I am by the lamps alone (the crew's own torches left out: a
  // torch on me is its man's beam), the chest and the head, each lamp's
  // line tested; smoothed as the exposure is
  lampLit(head, chest) {
    const G = this.G, X = G.exposure, S = G.stage;
    let best = 0;
    for (const p of [head, chest]) {
      let sum = 0;
      for (const e of S.lights.entries) {
        if (e.torch || !e.enabled || !(e.intensity > 0)) continue;
        let k = X.lampAt(e, p);
        if (k <= 0.01) continue;
        _v.subVectors(p, e.position);
        const d = _v.length();
        _v.divideScalar(d);
        if (G.rays.raycast(e.position, _v, d - 0.3, { anyHit: true })) k = 0;
        sum += k;
      }
      best = Math.max(best, Math.min(1, sum));
    }
    const dt = this.G.time - (this._llT ?? -1);
    this._llT = this.G.time;
    this._ll = this._ll == null || dt > 0.5 ? best : this._ll + (best - this._ll) * (1 - Math.exp(-Math.max(0, dt) / 0.15));
    return this._ll;
  }

  // ---- the bottle -------------------------------------------------------------------------
  take(obj) {
    const G = this.G, H = G.player.hands;
    if (this.bottle || H.busy) return;
    const tgt = obj;
    H.snTarget = tgt;
    H.play('sn_take', { onMark: { take: () => {
      H.hold(tgt, 'R');
      this.bottle = tgt;
      G.sfx.play('f_grab_bottle', null, {}, { send: false });
      this.teachThrow = !this.taught.throw;
    } } });
  }

  // where the throw starts (the hand going over) and its first velocity
  launch(out = { p: V(0, 0, 0), v: V(0, 0, 0) }, fromAim = false) {
    const cam = this.G.camera;
    const q = fromAim && this.aimQ ? this.aimQ : cam.quaternion;
    const f = _v.set(0, 0, -1).applyQuaternion(q);
    const r = _w.set(1, 0, 0).applyQuaternion(q);
    out.p.copy(fromAim && this.aimP ? this.aimP : cam.position).addScaledVector(f, 0.35).addScaledVector(r, 0.18);
    out.p.y -= 0.05;
    // (the aim: the view's direction lifted, so a level look lobs it)
    const pitch = Math.asin(Math.max(-1, Math.min(1, f.y)));
    const yaw = Math.atan2(f.x, f.z);
    const a = Math.min(1.0, pitch + THROW.lift);
    out.v.set(Math.sin(yaw) * Math.cos(a), Math.sin(a), Math.cos(yaw) * Math.cos(a)).multiplyScalar(THROW.speed);
    return out;
  }

  // the path it will take: [points], and where it stops
  trace(maxT = 3) {
    const L = this.launch(), G = this.G;
    const p = L.p.clone(), v = L.v.clone(), pts = [p.clone()];
    const d = V(0, 0, 0);
    for (let t = 0; t < maxT; t += THROW.dt * 2) {
      const q = p.clone().addScaledVector(v, THROW.dt * 2);
      v.y -= THROW.g * THROW.dt * 2;
      d.subVectors(q, p);
      const len = d.length();
      const hit = len > 1e-4 ? G.rays.raycast(p, d.clone().divideScalar(len), len) : null;
      if (hit) { pts.push(hit.point.clone()); return { pts, end: hit.point.clone(), normal: hit.normal ? hit.normal.clone() : V(0, 1, 0) }; }
      const floor = this.floorAt(q.x, q.z);
      if (q.y <= floor) { q.y = floor; pts.push(q.clone()); return { pts, end: q.clone(), normal: V(0, 1, 0) }; }
      p.copy(q);
      pts.push(p.clone());
    }
    return { pts, end: p.clone(), normal: V(0, 1, 0) };
  }

  floorAt(x, z) {
    // (the pier's deck; beyond its edges, the river)
    const onDeck = inShed(x, z) || (z > 0 && x > PIER.land.x0 && x < PIER.land.x1) || (x > PIER.apron.x0 && x < PIER.apron.x1 && z > PIER.apron.z0 && z < 0);
    return onDeck ? 0.03 : PIER.waterY;
  }

  makeArc() {
    const g = new THREE.Group();
    g.name = 'b6_arc';
    const n = 40;
    const dotGeo = new THREE.SphereGeometry(0.018, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.9), transparent: true, opacity: 0.8, depthWrite: false });
    const dots = new THREE.InstancedMesh(dotGeo, mat, n);
    dots.layers.set(LAYER.FX); dots.frustumCulled = false; dots.userData.noRay = true;
    g.add(dots);
    // (where it lands: a ring a man's stride across, read from the strip's end)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.32, 32).rotateX(-Math.PI / 2), mat);
    ring.layers.set(LAYER.FX); ring.userData.noRay = true;
    g.add(ring);
    g.visible = false;
    return { group: g, dots, ring, n };
  }

  drawArc() {
    const A = this.arc, S = this.G.stage;
    if (A.group.parent !== S.scene) S.scene.add(A.group);
    const tr = this.trace();
    // (dots every ~0.35 m along the path; none within 1.6 m of the hand -
    // a dot at arm's length is a white ball over the view, not a mark on
    // the room)
    const pts = tr.pts;
    let acc = 0, k = 0;
    const m = _m;
    for (let i = 1; i < pts.length && k < A.n; i++) {
      acc += pts[i].distanceTo(pts[i - 1]);
      if (acc < 0.35) continue;
      acc = 0;
      if (pts[i].distanceTo(pts[0]) < 1.6) continue;
      const s = 0.6 + 0.4 * Math.min(1, i / 8);
      m.makeScale(s, s, s).setPosition(pts[i]);
      A.dots.setMatrixAt(k++, m);
    }
    A.dots.count = k;
    A.dots.instanceMatrix.needsUpdate = true;
    A.ring.position.copy(tr.end).addScaledVector(tr.normal, 0.02);
    A.ring.quaternion.setFromUnitVectors(V(0, 1, 0), tr.normal);
    A.group.visible = true;
  }

  throw() {
    const G = this.G, H = G.player.hands;
    this.aiming = false;
    this.arc.group.visible = false;
    const b = this.bottle;
    H.play('sn_throw', { onMark: { release: () => {
      if (!b) return;
      // (its place in the world, from the hand's scene: the same place, the eye's lens)
      b.updateMatrixWorld(true);
      const at = V(0, 0, 0), rot = new THREE.Quaternion();
      b.matrixWorld.decompose(at, rot, _w);
      H.hold(null, 'R', { keep: true });
      this.bottle = null;
      const L = this.launch(undefined, true);
      b.position.copy(at);
      b.quaternion.copy(rot);
      b.scale.setScalar(1);
      b.matrixAutoUpdate = true;
      G.stage.scene.add(b);
      // (it flies from where the hand let it go along the aimed path)
      this.flying.push({ obj: b, p: at.clone(), v: L.v.clone(), spin: V(7, 2, 3), t: 0, from: V(this.G.controller.pos.x, 0, this.G.controller.pos.z) });
      G.sfx.play('throw', null, {}, { send: false });
    } } });
  }

  fly(f, dt) {
    const G = this.G;
    const q = f.p.clone().addScaledVector(f.v, dt);
    f.v.y -= THROW.g * dt;
    const d = q.clone().sub(f.p), len = d.length();
    const hit = len > 1e-5 ? G.rays.raycast(f.p, d.divideScalar(len), len) : null;
    const floor = this.floorAt(q.x, q.z);
    f.t += dt;
    // (a man in its way: it breaks on him - it never flies through a body -
    // and he knows where it came from)
    const man = this.manOn(f.p, q, hit ? hit.distance : len);
    if (man) {
      this.smash(f.obj, man.at, false);
      this.crew.struck(man.m, f.from);
      return true;
    }
    if (hit || q.y <= floor || f.t > 4) {
      const at = hit ? hit.point.clone() : q.setY(Math.max(q.y, floor));
      this.smash(f.obj, at, floor < 0);
      return true;
    }
    f.p.copy(q);
    f.obj.position.copy(q);
    f.obj.rotation.x += f.spin.x * dt; f.obj.rotation.y += f.spin.y * dt; f.obj.rotation.z += f.spin.z * dt;
    return false;
  }

  // the first standing man the path p -> q passes through (his body a
  // column 0.3 m round from his knees to the top of his head), within maxD
  manOn(p, q, maxD) {
    const L = p.distanceTo(q);
    let best = null;
    for (const m of this.crew.men) {
      if (m.down) continue;
      const top = m.eye(_w).y + 0.15;
      for (let k = 1; k <= 4; k++) {
        const u = k / 4;
        const x = p.x + (q.x - p.x) * u, y = p.y + (q.y - p.y) * u, z = p.z + (q.z - p.z) * u;
        if (u * L > maxD) break;
        if (y < 0.35 || y > top) continue;
        if (Math.hypot(x - m.pos.x, z - m.pos.z) < 0.3) { if (!best || u * L < best.d) best = { m, d: u * L, at: V(x, y, z) }; break; }
      }
    }
    return best;
  }

  smash(obj, at, water) {
    const G = this.G, F = G.fx, r = this.ctx.rng;
    if (obj.parent) obj.parent.remove(obj);
    if (water) { G.sfx.play('drip', at, { k: 1 }, { ref: 3 }); if (F && F.splash) F.splash.spawn({ pos: at.clone(), vel: V(0, 2, 0), life: 0.5, size: [0.1, 0.1] }); }
    else {
      G.sfx.play('bottleSmash', at, {}, { ref: 4 });
      if (F && F.debris) for (let k = 0; k < 14; k++) {
        const s = 0.012 + r.next() * 0.03;
        F.debris.spawn({ pos: at.clone().add(V(0, 0.05, 0)), vel: V(r.gauss() * 1.5, 0.8 + r.next() * 2, r.gauss() * 1.5), life: 0.8 + r.next() * 0.8,
          size: [s, s * 0.6], rot: r.next() * 6.28, spin: r.gauss() * 10, col: [0.35, 0.35, 0.35], cell: 12, gravity: 9.8, ground: 0.02, fadeOut: 0.2, lit: 2, litT: 0.1 });
      }
    }
    // the nearest men go to the sound (two, within 16 m)
    this.crew.sendNearest(at, 2, 'bottle', water ? 10 : 16);
    this.lastSmash = { at: at.clone(), t: G.time };
  }

  // ---- the cosh (caught) ------------------------------------------------------------------
  cosh(onDone) {
    if (this.coshT >= 0) return;
    const G = this.G;
    this.coshT = 0;
    this.onCoshDone = onDone;
    this.aiming = false;
    G.controller.frozen = true;
    // (no line left over the black: the crouch prompt stood on it)
    G.hud.clearPrompt('b6c'); G.hud.clearPrompt('b6');
    this.teachThrow = false;
    G.player.hands.play('sn_cosh');
  }
  coshStep(dt) {
    const G = this.G;
    const t0 = this.coshT;
    this.coshT += dt;
    if (t0 < 0.07 && this.coshT >= 0.07) { G.sfx.play('blow', null, {}, { send: false, gain: 1.2 }); G.controller.shake(0.8, 0); }
    if (t0 < 0.3 && this.coshT >= 0.3) G.hud.fade(1);
    if (t0 < 1.1 && this.coshT >= 1.1 && this.onCoshDone) { const f = this.onCoshDone; this.onCoshDone = null; f(); }
  }
}

