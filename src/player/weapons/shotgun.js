import * as THREE from 'three';
import { buildProp } from '../../props/index.js';
import { palm } from '../handPoses.js';
import { VM_FOV } from '../Viewmodel.js';
import { GRIP_F, PULL_F, L_CRADLE, L_OPEN, L_PINCH } from '../clips/revolver.js';

// [O4] The shotgun (docs/briefs/O4_COMBAT.md §2): a side-by-side double,
// bought at the gun shop. weapons.equip('shotgun'): two barrels, a press a
// barrel (the right first, then the left), nine pellets in a cone that reads
// on the wall - devastating close (six metres: a man down with one), less
// and less to twenty-six, nothing past it but ink on the brick. RMB brings it
// to the shoulder (the cone a third tighter, the lens 6 degrees in). R (or a
// press on two spent barrels) breaks it: the barrels drop on their hinge,
// the spent hulls fly out over the shoulder, the left hand brings two from
// the coat and thumbs them in, the barrels snap up - 1.45 s for two, 1.15 for
// one. A press during it shuts on what is in and fires. The shells are
// counted (`pocket`, the shop sells boxes of ten: save.ammo.shotgun).
// Through the gun kit in an encounter (what is solid stops a pellet, wood is
// chewed); a man takes the pellets that found him as one blow (one flinch,
// a blood burst each), and a man who took half of himself goes down hard.
export const SHOTGUN = {
  barrels: 2, gap: 0.24, buffer: 0.15, pellets: 9,
  cone: 0.058, coneSteady: 0.038, coneMove: 0.018,
  // a pellet's damage by distance: full to `near`, falling to nothing at `far`
  near: 6, far: 26, dmg: 17, head: 1.8,
  reload: 1.45, reload1: 1.15, draw: 0.4, holster: 0.35, steadyFov: 6, chew: 0.6, range: 45,
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
const HEAD = new Set(['head', 'hat']);
// the gun's places in the eye's frame (the viewmodel's lens); yaw / pitch aim its barrels
const P = (p, yaw, pitch, roll, e) => ({ p: V(...p), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), e: V(...e) });
export const SG_POSE = {
  // at the hip, low right, the barrels running in toward the middle
  // (pitched up a little so the stock runs down out of the frame under the arm)
  ready: P([0.14, -0.172, -0.42], 0.085, 0.11, 0.1, [0.28, -0.42, -0.14]),
  // at the shoulder: the rib under the eye, the bead on the middle
  steady: P([0.034, -0.118, -0.21], 0.0, 0.004, 0.0, [0.14, -0.3, -0.02]),
  // broken open, brought in and tipped: the breech up toward the eye
  open: P([0.05, -0.2, -0.32], 0.32, -0.38, 0.28, [0.22, -0.5, -0.05]),
  away: P([0.12, -0.42, -0.2], 0.4, -0.6, 0.6, [0.2, -0.7, 0.0]),
};
// the reload (s from its start): break, flick out, the hand down for two, in, shut
const RL = { brk: [0.0, 0.2], eject: 0.22, flick: [0.18, 0.32], down: [0.3, 0.52], up: [0.52, 0.74], in1: [0.74, 0.86], in2: [0.88, 1.0], shut: [1.06, 1.18], ready: [1.16, 1.45] };
const RL1 = { brk: [0.0, 0.2], eject: 0.22, flick: [0.18, 0.32], down: [0.3, 0.48], up: [0.48, 0.66], in1: [0.66, 0.8], in2: [9, 9], shut: [0.82, 0.94], ready: [0.92, 1.15] };
const CUT = { shut: 0.1, ready: 0.18 };
const EL = [-0.22, -0.56, -0.08];

export default (game) => {
  const G = game;
  const rng = G.world.rng.fork(4404);
  const _v = V(0, 0, 0), _v2 = V(0, 0, 0), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
  const W = {
    name: 'shotgun', set: 'shotgun', mag: 2,
    chambers: ['live', 'live'], next: 0,
    phase: 'away', t: 0, cool: 0, buffered: -1, sinceShot: 9, steady: 0, cut: null,
    sway: { x: 0, y: 0, vx: 0, vy: 0 }, lastYaw: null, lastPitch: null, kickR: 0,
    prop: null, shells: null, gunM: new THREE.Matrix4(), eR: V(0.24, -0.42, -0.05), FR: GRIP_F, poseL: null,
    fovBase: null, zoom: 0, pocket: Infinity, lastShot: null,
    get ammo() { return this.chambers.filter((c) => c === 'live').length; },
    get reloading() { return this.phase === 'reload'; },
    get drawn() { return this.phase !== 'away'; },
    // the counts: { rounds (in the barrels), pocket } - an endless pocket on a test bed by default
    setCounts({ rounds = 2, pocket = this.pocket } = {}) {
      this.chambers = [rounds > 0 ? 'live' : 'empty', rounds > 1 ? 'live' : 'empty']; this.next = 0;
      this.pocket = pocket; this.buffered = -1; this.saidEmpty = false; this.keep();
    },
    armCounts(opts = {}) { if (opts.keep) return; this.setCounts({ rounds: opts.rounds ?? 2, pocket: opts.pocket ?? this.pocket }); },
    // (the counts into the save: save.ammo.shotgun - the city's, lane O7's saves)
    keep() { const S = G.save; if (!S || this.pocket === Infinity) return; const A = S.ammo || (S.ammo = {}); A.shotgun = this.pocket; A.shotgunIn = this.ammo; },

    equip() {
      if (!this.prop) this.prop = buildProp('shotgun');
      const H = G.hands;
      if (H.held.R !== this.prop) H.hold(this.prop, 'R', { keep: true });
      this.phase = 'draw'; this.t = 0; this.cool = 0; this.buffered = -1; this.steady = 0; this.cut = null; this.from = null;
      this.sway.x = this.sway.y = this.sway.vx = this.sway.vy = 0; this.lastYaw = null;
      this.prop.userData.setShells(this.chambers); this.prop.userData.setOpen(0);
      G.sfx.play('revDraw', null, {}, { send: false, gain: 0.8 });
      this.update(0, G.time);
    },
    unequip() {
      const H = G.hands;
      if (this.prop && H.held.R === this.prop) H.hold(null, 'R', { keep: true });
      if (this.shells && H.held.L === this.shells) H.hold(null, 'L', { keep: true });
      if (this.phase === 'reload') this.endReload(true);
      this.phase = 'away'; this.poseL = null;
      this.setZoom(0, true);
      G.hud.dropLayer('shotgun'); this.hud = null;
    },
    holster() {
      if (this.phase === 'away' || this.phase === 'holster') return false;
      if (this.phase === 'reload') this.endReload(true);
      this.from = this.curPose(); this.phase = 'holster'; this.t = 0;
      G.sfx.play('revHolster', null, {}, { send: false, gain: 0.8 });
      return true;
    },
    trigger(down, pressed) {
      if (!pressed) return;
      if (this.phase === 'reload') { this.cutReload(); return; }
      if (this.phase === 'draw' || this.cool > 0) { if (this.phase === 'draw' || this.cool <= SHOTGUN.buffer + 1e-6) this.buffered = G.time; return; }
      if (this.phase === 'ready') this.fire();
    },
    // one barrel: the right, then the left
    fire() {
      if (this.phase !== 'ready' || this.cool > 0) return false;
      const i = this.chambers[0] === 'live' ? 0 : this.chambers[1] === 'live' ? 1 : -1;
      this.cool = SHOTGUN.gap;
      if (i < 0) {
        // both spent: the hammer falls on nothing; it breaks to load, if there is anything to load
        G.sfx.play('revDry', null, {}, { send: false, gain: 0.9 });
        if (this.pocket <= 0) { this.sayEmpty(); return false; }
        this.reload();
        return false;
      }
      this.chambers[i] = 'spent';
      this.keep();
      this.sinceShot = 0; this.lastBarrel = i;
      const cam = G.camera, time = G.time;
      cam.updateMatrixWorld();
      G.counters.shots++;
      const moving = G.controller.vel.length() > 1;
      const cone = SHOTGUN.cone + (SHOTGUN.coneSteady - SHOTGUN.cone) * this.steady + (moving ? SHOTGUN.coneMove : 0);
      const fwd = V(0, 0, -1).transformDirection(cam.matrixWorld);
      const right = V(1, 0, 0).transformDirection(cam.matrixWorld), up = V(0, 1, 0).transformDirection(cam.matrixWorld);
      const origin = cam.position.clone();
      const mz = this.muzzle(i);
      G.fx.flash.player(mz.vm, mz.world, fwd.clone(), time, mz.fwd);
      G.sfx.play('o4_shotgun', null, {}, { gain: 1.0 });
      G.sfx.duck(0.6, 0.6);
      this.kickR = rng.range(-1, 1);
      // the pellets: an even spread in the cone (a ring of eight round one), jittered
      const hits = new Map(), walls = [];
      const out = { pellets: [], men: 0 };
      for (let k = 0; k < SHOTGUN.pellets; k++) {
        const ring = k === 0 ? 0 : 0.55 + 0.45 * rng.next();
        const a = k === 0 ? 0 : (k - 1) / (SHOTGUN.pellets - 1) * Math.PI * 2 + rng.range(-0.3, 0.3);
        const r = ring * cone;
        const d = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
        const res = this.pellet(origin, d);
        out.pellets.push(res ? res.kind : 'air');
        if (res && res.hood) {
          const h = res.hood.hood, head = HEAD.has(res.hood.joint);
          const dist = res.hood.point.distanceTo(origin);
          const k1 = 1 - ss(SHOTGUN.near, SHOTGUN.far, dist);
          const dmg = SHOTGUN.dmg * k1 * (head ? SHOTGUN.head : 1) * (res.k ?? 1);
          if (dmg > 0.2) {
            const e = hits.get(h) || { dmg: 0, n: 0, head: false, dir: d.clone(), point: res.hood.point.clone(), joint: res.hood.joint };
            e.dmg += dmg; e.n++; e.head = e.head || head; hits.set(h, e);
            G.fx.bloodFx.hit(res.hood.point, d, { strength: 0.55 + 0.5 * k1, rays: G.rays });
          }
        } else if (res && res.wall && walls.length < 5) walls.push(res);
      }
      // each man takes what found him as one blow
      for (const [h, e] of hits) {
        if (!h.alive) continue;
        G.counters.hits++;
        out.men++;
        const kill = e.dmg >= h.hp;
        G.damageHood(h, e.dmg, e.dir, { head: kill && e.head, joint: e.joint, time });
        if (h.alive) {
          const ai = G.ais.get(h);
          // (half of a man in one blow: he is thrown back a step, whatever he is)
          if (e.dmg >= 40 && h.state !== 'stagger' && !(ai && ai.brain && ai.brain.kind === 'rusher')) h.stagger();
          if (ai && ai.onHit && !(ai.brain && ai.brain.kind)) ai.onHit(e.dir.clone(), e.dmg >= 40);
        }
      }
      this.lastShot = { t: time, ...out, cone: +cone.toFixed(3) };
      G.emit('shot', { weapon: 'shotgun', men: out.men, pellets: out.pellets });
      this.syncProp();
      return true;
    },
    // a pellet: through the gun kit when an encounter is on (cover is cover),
    // else the Tommy gun's path; { hood, wall, k, kind }
    pellet(origin, dir) {
      const K = G.guns;
      if (K && K.active) {
        const cam = G.camera, down = V(0, -1, 0).transformDirection(cam.matrixWorld);
        const muzzle = origin.clone().addScaledVector(dir, 0.55).addScaledVector(down, this.steady > 0.5 ? 0.05 : 0.12);
        const md = _v.subVectors(muzzle, origin); const ml = md.length(); md.divideScalar(ml);
        const blocked = G.rays.raycast(origin, md, ml, { anyHit: false });
        const res = blocked ? K.trace(blocked.point.clone().addScaledVector(md, -0.05), dir, { far: 2, by: 'player', chew: SHOTGUN.chew })
          : K.trace(muzzle, dir, { far: SHOTGUN.range, by: 'player', chew: SHOTGUN.chew });
        // (the men the pellet passed near: rattled)
        const end = res.hood ? res.hood.point : res.wall ? res.wall.point : origin.clone().addScaledVector(dir, 30);
        for (const [h, ai] of G.ais) {
          if (!h.alive || !ai.brain || !ai.brain.shotNear || (res.hood && res.hood.hood === h)) continue;
          const c = _v2.set(h.pos.x, h.pos.y + 1.3, h.pos.z);
          if (segDist(origin, end, c) < 1.2) ai.brain.shotNear(0.5);
        }
        return { hood: res.hood || null, wall: res.wall || null, k: res.k ?? 1, kind: res.hood ? 'man' : res.wall ? 'wall' : 'air' };
      }
      const hood = G.rays.raycastHoods(origin, dir, SHOTGUN.range, G.world.hoods.list);
      const wall = G.rays.raycast(origin, dir, hood ? hood.t : SHOTGUN.range);
      if (hood && (!wall || hood.t < wall.t)) return { hood, wall: null, k: 1, kind: 'man' };
      if (wall) { G.react.bullet(wall, dir.clone(), { weak: true }); return { hood: null, wall, k: 1, kind: 'wall' }; }
      return null;
    },
    reload() {
      if (this.phase !== 'ready' && this.phase !== 'draw') return false;
      if (this.ammo === 2) return false;
      if (this.pocket <= 0) { if (this.ammo === 0) this.sayEmpty(); return false; }
      this.from = this.curPose();
      this.phase = 'reload'; this.t = 0; this.cut = null; this.buffered = -1;
      this.toLoad = Math.min(2 - this.ammo, this.pocket);
      this.R = this.toLoad >= 2 ? RL : RL1;
      this.loaded = 0; this.ejected = false; this.heard = {};
      return true;
    },
    cutReload() {
      this.buffered = G.time;
      if (this.cut) return;
      this.cut = { at: this.t };
    },
    sayEmpty() {
      if (this.saidEmpty) return;
      this.saidEmpty = true;
      if (G.hud && G.hud.say) G.hud.say('No shells.', 1.6, { always: true });
    },
    endReload(abandon = false) {
      const H = G.hands;
      if (this.shells && H.held.L === this.shells) H.hold(null, 'L', { keep: true });
      this.poseL = null;
      if (this.prop) { this.prop.userData.setOpen(0); this.prop.userData.setLift(0); this.prop.userData.setShells(this.chambers); }
      if (!abandon) { this.from = this.curPose(); this.phase = 'ready'; this.t = 0; }
      this.cut = null; this.cool = 0;
      if (this.ammo > 0) this.saidEmpty = false;
      this.keep();
    },
    stepReload() {
      const t = this.t, R = this.R, ud = this.prop.userData, H = G.hands;
      const hear = (k, at, name, gain = 0.9) => { if (!this.heard[k] && t >= at) { this.heard[k] = true; G.sfx.play(name, null, {}, { send: false, gain }); } };
      hear('brk', R.brk[0] + 0.02, 'o4_sgBreak');
      if (!this.ejected && t >= R.eject) {
        this.ejected = true;
        // the spent hulls fly out back over the shoulder (the world's casings)
        for (let i = 0; i < 2; i++) if (this.chambers[i] === 'spent') { this.dropHull(i); this.chambers[i] = 'empty'; }
        ud.setShells(this.chambers);
        G.sfx.play('o4_sgEject', null, {}, { send: false, gain: 0.8 });
      }
      if (t >= R.down[1] && t < R.shut[0] && !this.shells) this.shells = buildProp('shellsHand');
      if (t >= R.down[1] && t < R.shut[0] && this.shells && H.held.L !== this.shells) { H.hold(this.shells, 'L', { keep: true }); this.shells.userData.setCount(this.toLoad - this.loaded); }
      for (const [k, iv] of [[0, R.in1], [1, R.in2]]) {
        if (this.loaded <= k && k < this.toLoad && t >= iv[1]) {
          const c = this.chambers[0] !== 'live' ? 0 : 1;
          this.chambers[c] = 'live'; this.loaded++; this.pocket--;
          ud.setShells(this.chambers);
          if (this.shells) this.shells.userData.setCount(this.toLoad - this.loaded);
          G.sfx.play('o4_sgShell', null, {}, { send: false, gain: 0.8 });
          this.keep();
        }
      }
      if (t >= R.shut[0] && this.shells && H.held.L === this.shells) H.hold(null, 'L', { keep: true });
      hear('shut', R.shut[1] - 0.03, 'o4_sgClose', 1);
      if (t >= R.ready[1]) this.endReload();
      // the cut: shut on what is in and up into the aim
      if (this.cut && t - this.cut.at >= CUT.ready) { hear('shut', 0, 'o4_sgClose', 1); this.endReload(); }
    },
    dropHull(i) {
      const fx = G.fx, cam = G.camera;
      if (!fx || !fx.casings) return;
      const p = this.prop.userData.chamberAt(i, V(0, 0, 0)).applyMatrix4(this.gunM);
      const right = V(0.5, 0, 0).transformDirection(cam.matrixWorld).multiplyScalar(0.14);
      const up = V(0, 1, 0).multiplyScalar(0.22);
      const back = V(0, 0, 1).transformDirection(cam.matrixWorld).multiplyScalar(0.2);
      fx.casings.eject(this.toWorld(p, 0.42), right, up, back);
    },

    update(dt, t) {
      const C = G.controller;
      this.cool = Math.max(0, this.cool - dt);
      this.sinceShot += dt;
      if (this.phase === 'away') return;
      this.t += dt;
      // the look drags the gun behind it (a long gun: heavier than the revolver)
      const S = this.sway;
      if (this.lastYaw !== null && dt > 0) {
        let dy = C.yaw - this.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        S.vx += -(dy) * 2.4; S.vy += -(C.pitch - this.lastPitch) * 2.4;
      }
      this.lastYaw = C.yaw; this.lastPitch = C.pitch;
      if (dt > 0) {
        S.vx += (-90 * S.x - 13 * S.vx) * dt; S.x += S.vx * dt;
        S.vy += (-90 * S.y - 13 * S.vy) * dt; S.y += S.vy * dt;
        S.x = Math.max(-0.12, Math.min(0.12, S.x)); S.y = Math.max(-0.1, Math.min(0.1, S.y));
      }
      const can = this.phase === 'ready' && G.live && !G.inspect.active && !G.puzzles.active;
      const want = can && G.held('Mouse2') ? 1 : 0;
      if (dt > 0) this.steady += (want - this.steady) * (1 - Math.exp(-dt * (want ? 14 : 12)));
      if (this.steady < 1e-3 && !want) this.steady = 0;
      if (this.phase === 'draw' && this.t >= SHOTGUN.draw) { this.phase = 'ready'; this.t = 0; }
      if (this.phase === 'holster' && this.t >= SHOTGUN.holster) { G.weapons.equip(null); return; }
      if (this.phase === 'reload') this.stepReload(dt);
      if (this.buffered >= 0 && this.phase === 'ready' && this.cool <= 0) { this.buffered = -1; if (G.live) this.fire(); }
      if (this.buffered >= 0 && this.phase === 'ready' && G.time - this.buffered > 0.6) this.buffered = -1;
      this.pose(dt);
      this.syncProp();
      this.setZoom(this.steady * SHOTGUN.steadyFov);
      this.drawHud();
      const VF = C.viewFx || (C.viewFx = { yaw: 0, pitch: 0, roll: 0, fwd: 0, side: 0, down: 0, eyes: 0 });
      const eyes = this.phase === 'reload' && !this.cut ? -0.12 * ss(0, 0.2, this.t) * (1 - ss(this.R.ready[0], this.R.ready[1], this.t)) : 0;
      VF.eyes = eyes;
      G.hands.pose3();
      VF.eyes = eyes;
      // the kick: a hard shove up and back, a little to the side; down in a third of a second
      const st = this.sinceShot, kv = st < 0.36 ? (st / 0.035) * Math.exp(1 - st / 0.035) * (1 - ss(0.18, 0.36, st)) : 0;
      VF.pitch += 0.045 * (1 - 0.3 * this.steady) * kv;
      VF.yaw += 0.008 * this.kickR * kv;
      VF.fwd -= 0.03 * kv;
    },
    curPose() { return { p: this.base ? this.base.p.clone() : SG_POSE.ready.p.clone(), q: this.base ? this.base.q.clone() : SG_POSE.ready.q.clone(), e: this.base ? this.base.e.clone() : SG_POSE.ready.e.clone() }; },
    pose() {
      const base = this.base || (this.base = { p: V(0, 0, 0), q: new THREE.Quaternion(), e: V(0, 0, 0) });
      const mix = (A, B, k, out) => { out.p.lerpVectors(A.p, B.p, k); out.q.slerpQuaternions(A.q, B.q, k); out.e.lerpVectors(A.e, B.e, k); return out; };
      const aim = { p: V(0, 0, 0), q: new THREE.Quaternion(), e: V(0, 0, 0) };
      mix(SG_POSE.ready, SG_POSE.steady, ss(0, 1, this.steady), aim);
      const t = this.t, ud = this.prop.userData;
      this.poseL = null;
      let open = 0, lift = 0;
      if (this.phase === 'draw') mix(SG_POSE.away, aim, easeOut(clamp01(t / SHOTGUN.draw)), base);
      else if (this.phase === 'holster') mix(this.from || aim, SG_POSE.away, ss(0, 1, t / SHOTGUN.holster), base);
      else if (this.phase === 'reload') {
        const R = this.R, cutAt = this.cut ? this.cut.at : null;
        open = ss(R.brk[0], R.brk[1], t) * (1 - ss(R.shut[0], R.shut[1], t));
        lift = ss(R.brk[1] - 0.02, R.eject, t) * (1 - ss(R.eject, R.eject + 0.08, t));
        const toOpen = ss(R.brk[0], R.brk[1] + 0.05, t), back = ss(R.shut[0], R.ready[1], t);
        mix(this.from || aim, SG_POSE.open, toOpen, base);
        // (the flick that throws the hulls: the muzzle snapped down and back)
        const fl = ss(R.flick[0], R.flick[0] + 0.05, t) * (1 - ss(R.flick[0] + 0.05, R.flick[1], t));
        base.q.multiply(_q.setFromAxisAngle(V(1, 0, 0), -0.22 * fl));
        if (back > 0) mix(base, aim, back, base);
        if (cutAt != null) {
          const u = t - cutAt, k = ss(0, CUT.ready, u);
          const snap = this.cutFrom || (this.cutFrom = { p: base.p.clone(), q: base.q.clone(), e: base.e.clone(), open });
          mix(snap, aim, k, base);
          open = snap.open * (1 - ss(0, CUT.shut, u));
        } else this.cutFrom = null;
        this.gunTmp = this.gunTmp || new THREE.Matrix4();
        this.gunTmp.compose(base.p, base.q, _v2.set(1, 1, 1));
        this.poseL = cutAt != null ? null : this.leftReload(t, R);
      } else {
        const u = this.from ? ss(0, 0.2, t) : 1;
        if (this.from && u >= 1) this.from = null;
        if (this.from) mix(this.from, aim, u, base); else { base.p.copy(aim.p); base.q.copy(aim.q); base.e.copy(aim.e); }
      }
      ud.setOpen(open); ud.setLift(lift);
      // the kick: up about the grip and back into the shoulder, a roll; the sway, the bob, the breath
      const st = this.sinceShot, k = st < 0.4 ? (st / 0.04) * Math.exp(1 - st / 0.04) : 0;
      const p = _v.copy(base.p), q = _q.copy(base.q);
      const C = G.controller, bp = C.bobPhase || 0, ba = (C.bobAmp || 0) * (1 - 0.5 * this.steady);
      const T = G.time || 0, br = Math.sin(T * 1.4) * 0.002 * (1 - 0.6 * this.steady);
      const S = this.sway;
      p.x += Math.cos(bp) * 0.012 * ba + S.x * 0.12;
      p.y += -Math.abs(Math.sin(bp)) * 0.014 * ba + br + S.y * 0.12;
      p.addScaledVector(_v2.set(0, 0, 1).applyQuaternion(q), 0.07 * k);
      _e.set(0.32 * k + S.y * 0.4 + br * 0.5, S.x * 0.5 + 0.03 * k * this.kickR, -S.x * 0.3 - 0.05 * k * this.kickR + Math.cos(bp) * 0.01 * ba, 'YXZ');
      q.multiply(_q2.setFromEuler(_e));
      this.gunM.compose(p, q, _v2.set(1, 1, 1));
      this.eR.copy(base.e);
      this.FR = st < 0.08 ? PULL_F : GRIP_F;
      // the left hand on the fore-end, but in the reload
      if (this.phase === 'ready' || this.phase === 'draw' || (this.phase === 'reload' && this.cut)) this.poseL = this.onFore(this.gunM);
    },
    // the left hand under the fore-end (the palm up, the fingers round its right side)
    onFore(M, F = L_CRADLE, back = 0) {
      const ud = this.prop.userData;
      const at = ud.fore.clone().add(V(0, 0, back)).applyMatrix4(M);
      const n = V(0, 1, 0).transformDirection(M), across = V(1, 0, 0).transformDirection(M).addScaledVector(V(0, 0, -1).transformDirection(M), 0.3).normalize();
      return palm('cam', at.toArray(), n.toArray(), across.toArray(), F, EL);
    },
    // the reload's left hand: off the fore-end, down to the coat, up with two, into the breech, back
    leftReload(t, R) {
      const M = this.gunTmp, ud = this.prop.userData;
      const below = { frame: 'cam', p: [-0.08, -0.5, -0.28], f: [0.3, 0.8, -0.5], b: [-0.6, 0.2, 0.7], F: L_OPEN, e: [-0.14, -0.9, -0.1] };
      const lerpPose = (A, B, k) => { const L = (a, b) => a.map((v, i) => v + (b[i] - v) * k); const F = {}; for (const n of ['i', 'm', 'r', 'l', 't']) F[n] = L(A.F[n], B.F[n]); return { frame: 'cam', p: L(A.p, B.p), f: L(A.f, B.f), b: L(A.b, B.b), F, e: L(A.e, B.e) }; };
      const fore = this.onFore(M);
      // at the breech: the pair held over the chambers, `lift` behind them, pushed in as it goes to 0
      const feed = (lift) => {
        const a = ud.chamberAt(0, V(0, 0, 0)).applyMatrix4(M), b = ud.chamberAt(1, V(0, 0, 0)).applyMatrix4(M);
        const bx = V(0, 0, 0); this.prop.userData.parts.barrels.updateMatrix();
        const axis = V(0, 0, 1).applyQuaternion(_q.setFromRotationMatrix(_m.copy(M).multiply(this.prop.userData.parts.barrels.matrix))).normalize();
        const x = b.clone().sub(a).normalize(), z = new THREE.Vector3().crossVectors(x, axis).normalize();
        const mid = a.add(b).multiplyScalar(0.5).addScaledVector(axis, lift + 0.035);
        void bx;
        return { o: true, m: new THREE.Matrix4().makeBasis(x, axis, z).setPosition(mid), F: L_PINCH, e: EL };
      };
      if (t < R.brk[1]) return fore;
      if (t < R.down[0]) return lerpPose(fore, below, ss(R.brk[1], R.down[0], t));
      if (t < R.down[1]) return below;
      const H = G.hands;
      if (t < R.shut[0] && this.shells && H.held.L === this.shells) {
        if (t < R.up[1]) { const f0 = feed(0.06); const low = new THREE.Matrix4().copy(f0.m).setPosition(-0.1, -0.44, -0.28); const k = easeOut(ss(R.up[0], R.up[1], t)); const pa = V(), pb = V(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), s = V(); low.decompose(pa, qa, s); f0.m.decompose(pb, qb, s); return { ...f0, m: new THREE.Matrix4().compose(pa.lerp(pb, k), qa.slerp(qb, k), s.set(1, 1, 1)) }; }
        if (t < R.in1[1]) return feed(0.06 * (1 - ss(R.in1[0], R.in1[1], t)));
        if (t < R.in2[1]) return feed(0.03 * (1 - ss(R.in2[0], R.in2[1], t)));
        return feed(0);
      }
      if (t < R.shut[1]) return lerpPose(below, fore, ss(R.shut[0] - 0.06, R.shut[1], t));
      return fore;
    },
    syncProp() { if (this.prop) this.prop.userData.setShells(this.chambers); },
    muzzle(i = 0) {
      const ud = this.prop.userData, vmRoot = G.vm.root;
      vmRoot.updateMatrixWorld(true);
      const local = ud.muzzles[i].clone().applyMatrix4(this.gunM);
      const vm = local.clone().applyMatrix4(vmRoot.matrixWorld);
      const world = this.toWorld(local, 0.9);
      const fwd = V(0, 0, -1).transformDirection(this.gunM).transformDirection(vmRoot.matrixWorld);
      return { vm, world, fwd };
    },
    toWorld(p, depth) {
      const cam = G.camera;
      const tv = Math.tan(THREE.MathUtils.degToRad(VM_FOV) / 2), tm = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      const nx = p.x / (-p.z * tv), ny = p.y / (-p.z * tv);
      return V(nx * tm * depth, ny * tm * depth, -depth).applyMatrix4(cam.matrixWorld);
    },
    setZoom(z, force = false) {
      const cam = G.camera;
      if (this.zoom === 0 && z <= 0 && !force) return;
      if (this.fovBase == null || Math.abs(cam.fov - (this.fovBase - this.zoom)) > 0.05) this.fovBase = cam.fov + this.zoom;
      if (force && z <= 0) { if (this.zoom) { cam.fov = this.fovBase; cam.updateProjectionMatrix(); } this.zoom = 0; this.fovBase = null; return; }
      this.zoom = z; cam.fov = this.fovBase - z; cam.updateProjectionMatrix();
      if (z <= 0) this.fovBase = null;
    },
    handPose(H, side, out) {
      if (this.phase === 'away' || !this.prop) return false;
      if (side === 'R') {
        if (H.held.R !== this.prop) return false;
        return H.resolve(H.poseForProp('R', this.prop, this.gunM, 'cam', this.FR, this.eR.toArray()), 'R', out);
      }
      const L = this.poseL;
      if (!L) return false;
      if (L.o) { if (!H.held.L) return false; return H.resolve(H.poseForProp('L', H.held.L, L.m, 'cam', L.F, L.e), 'L', out); }
      return H.resolve(L, 'L', out);
    },
    // ---- the count (bottom right): the two barrels' shells, and the coat's
    drawHud() {
      const hud = G.hud;
      if (!hud || !hud.visible) return;
      if (!this.hud || !this.hud.isConnected) { this.hud = hud.layer('shotgun'); this.hudKey = null; }
      const key = this.chambers.join() + '|' + this.pocket + '|' + this.phase;
      if (key === this.hudKey) return;
      this.hudKey = key;
      drawShells(this.hud, this.chambers, this.pocket, this.phase === 'holster');
    },
  };
  return W;
};

// the distance from point c to the segment a-b
function segDist(a, b, c) {
  const ab = _s1.subVectors(b, a), ac = _s2.subVectors(c, a);
  const L = ab.lengthSq() || 1e-6;
  const u = Math.max(0, Math.min(1, ac.dot(ab) / L));
  return _s3.copy(a).addScaledVector(ab, u).distanceTo(c);
}
const _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _s3 = new THREE.Vector3();

// two shell heads side by side as the eye sees the breech (live: a paper
// head and its primer; spent: a dark hull in a ring; empty: a black bore),
// and the coat's shells as rows of five small inked hulls (the gone ones hollow)
const NS = 'http://www.w3.org/2000/svg';
function drawShells(el, chambers, pocket, fading) {
  let svg = el.querySelector('svg.sg');
  if (!svg) {
    el.innerHTML = '';
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sg');
    svg.setAttribute('viewBox', '-56 -34 112 68');
    svg.setAttribute('width', '96'); svg.setAttribute('height', '58');
    svg.style.cssText = 'position:absolute; right:34px; bottom:34px; overflow:visible; filter: drop-shadow(0 0 1.5px #000) drop-shadow(0 0 3px rgba(0,0,0,0.7)); transition: opacity 0.3s;';
    // the breech's figure-eight, inked
    svg.innerHTML = `<path d="M -2 -28 C -30 -30 -52 -18 -52 0 C -52 18 -30 30 -2 28 L 2 28 C 30 30 52 18 52 0 C 52 -18 30 -30 2 -28 Z" fill="#0b0b0b" stroke="#e9e7e1" stroke-width="3" stroke-linejoin="round"/>
      <g class="b0" transform="translate(-25 0)"><circle class="rim" r="21"/><circle class="head" r="16.5"/><circle class="pr" r="5"/></g>
      <g class="b1" transform="translate(25 0)"><circle class="rim" r="21"/><circle class="head" r="16.5"/><circle class="pr" r="5"/></g>`;
    el.appendChild(svg);
  }
  svg.style.opacity = fading ? '0' : '1';
  for (let i = 0; i < 2; i++) {
    const g = svg.querySelector('.b' + i), s = chambers[i];
    const rim = g.children[0], head = g.children[1], pr = g.children[2];
    if (s === 'live') { rim.setAttribute('fill', '#e9e7e1'); head.setAttribute('fill', '#d6d3cb'); pr.setAttribute('fill', '#2a2a2a'); pr.style.display = ''; }
    else if (s === 'spent') { rim.setAttribute('fill', '#6a6864'); head.setAttribute('fill', '#161616'); pr.setAttribute('fill', '#6a6864'); pr.style.display = ''; }
    else { rim.setAttribute('fill', '#2a2a2a'); head.setAttribute('fill', '#050505'); pr.style.display = 'none'; }
  }
  let pk = el.querySelector('svg.sgp');
  if (!Number.isFinite(pocket)) { if (pk) pk.remove(); return; }
  if (!pk) {
    pk = document.createElementNS(NS, 'svg');
    pk.setAttribute('class', 'sgp');
    pk.style.cssText = 'position:absolute; right:140px; bottom:38px; overflow:visible; filter: drop-shadow(0 0 1.5px #000) drop-shadow(0 0 3px rgba(0,0,0,0.7));';
    el.appendChild(pk);
  }
  const p = Math.max(0, Math.floor(pocket)), rows = Math.min(4, Math.max(1, Math.ceil(p / 5))), top = p === 0 ? 0 : p - 5 * (rows - 1);
  const w = 9, h = 20, gap = 4, row = 24;
  pk.setAttribute('viewBox', `-2 -2 ${5 * w + 4 * gap + 4} ${rows * row + 2}`);
  pk.setAttribute('width', String(5 * w + 4 * gap + 4)); pk.setAttribute('height', String(rows * row + 2));
  let out = '';
  for (let r = 0; r < rows; r++) {
    const n = r === 0 ? Math.min(5, top) : 5, y = r * row;
    for (let i = 0; i < 5; i++) {
      const x = i * (w + gap);
      out += i < n ? `<rect x="${x}" y="${y}" width="${w}" height="${h - 5}" rx="1.5" fill="#d6d3cb" stroke="#0b0b0b" stroke-width="0.8"/><rect x="${x - 0.5}" y="${y + h - 6}" width="${w + 1}" height="6" fill="#e9e7e1" stroke="#0b0b0b" stroke-width="0.8"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#0b0b0b" stroke="#a9a69e" stroke-width="1.3"/>`;
    }
  }
  pk.innerHTML = out;
}
