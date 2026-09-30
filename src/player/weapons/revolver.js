import * as THREE from 'three';
import { buildProp } from '../../props/index.js';
import { palm } from '../handPoses.js';
import { VM_FOV } from '../Viewmodel.js';
import { GRIP_F, PULL_F, COCK_F, COCKED_F, L_OPEN, L_CRADLE, L_STRIKE, L_PINCH, GUN_READY } from '../clips/revolver.js';
import { drawCount } from './_revolverHud.js';

// The detective's .38 (lane B3; the wave B front kept: weapons.equip
// ('revolver'), six rounds, LMB, R). One press, one shot, on the press:
// the hammer falls, the flash lights the room, the muzzle climbs hard and is
// back in a quarter of a second; the thumb cocks the hammer and the
// cylinder turns (seen). About 0.3 s between shots; a press in the last
// 0.15 s of that is kept and fires when it ends; holding does not repeat.
// The rounds go through the Tommy gun's bullet path (the Hoods first, then
// the world through react.bullet). A body hit (55) staggers a Hood and two
// put him down, the head one; a heavy (170) takes four.
// Aim: where the eye's centre is, a little spread from the hip; RMB steadies:
// the gun comes up to the eye's line (the sights on the centre), the lens
// tightens 7 degrees, the spread closes. No crosshair.
// Reload (R, or a press on an empty gun), 1.7 s: the gun comes in and turns
// its left side up, the left hand swings the cylinder out, the muzzle goes
// up and the palm strikes the ejector (six cases fall and ring), the muzzle
// down, the left hand up from the coat with six rounds and three pairs go in
// (the cylinder turned between), a push shuts it. A press during it shuts
// the cylinder on what is in it and fires.
// Draw and put away: the hand into the coat and out, 0.35 s each way
// (equip() draws; holster() puts it away and then empties the hands).
// The count: a small inked cylinder face bottom right while it is in hand.
// The gun is a prop (props/kinds/revolver.js) held in the right hand's
// socket (clips/revolver.js); every step this file authors the gun's place
// in the eye's frame and the hands are solved onto it (the set's pose hook,
// Hands.js), so what the hand holds never floats about the wrist.
export const REVOLVER = {
  rounds: 6, gap: 0.3, buffer: 0.15, reload: 1.7, range: 120, dmgBody: 55,
  draw: 0.35, holster: 0.35,
  spreadHip: 0.011, spreadSteady: 0.0012, spreadMove: 0.008,
  steadyFov: 7,
};
const HEAD = new Set(['head', 'hat']);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
// (the shot's climb: up at once, peaking at TAU, all but gone by 0.25 s)
const TAU = 0.042;
// the climb's peak (radians, about the wrist) and the shove back (metres)
const RECOIL = { climb: 0.3 };
const climbK = (t) => (t < 0 ? 0 : (t / TAU) * Math.exp(1 - t / TAU));

// The gun's places in the eye's frame (+x right, +y up, -z ahead; the
// viewmodel's lens, VM_FOV). yaw / pitch aim its barrel, roll cants it
// about the barrel; e is the right elbow.
const P = (p, yaw, pitch, roll, e) => ({ p: V(...p), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), e: V(...e) });
const POSE = {
  // low right, the barrel running into the picture toward the centre,
  // canted in (clips/revolver.js GUN_READY)
  ready: P(GUN_READY.p, GUN_READY.yaw, GUN_READY.pitch, GUN_READY.roll, [0.22, -0.4, -0.1]),
  // steadied: up on the eye's line, square, the front sight on the centre
  steady: P([0.0, -0.078, -0.45], 0, 0, 0, [0.06, -0.22, -0.26]),
  // in the coat (the shoulder holster, under the left arm): just under the
  // frame's bottom edge left of centre, the muzzle to the left - the draw
  // crosses the body and is in frame by its second step (second pass: it
  // came from far below the right edge, nothing showed for 0.15 s)
  holster: P([-0.02, -0.2, -0.26], 1.3, -0.25, 1.2, [0.14, -0.5, -0.02]),
  // the reload (each place fitted with the eyes' dip to it counted: at a
  // third of a metre the frame shows only 16 cm below the eye's line).
  // (Second pass: the gun is side-on through the reload - its left side,
  // where the cylinder swings out, turned to the eye, the muzzle down and
  // left, low in the middle of the frame, the right forearm lying in from
  // the right - so the cylinder swung out toward the eye, the rounds going
  // into its rear face and the shut all read; the first version held it
  // muzzle-ahead and the hands covered it)
  present: P([0.03, -0.13, -0.33], 1.15, -0.2, 0.15, [0.25, -0.5, -0.05]),
  // the muzzle up for the ejector's stroke, the rear face down (low: the
  // left palm on the rod stays in the lower half)
  eject: P([0.05, -0.24, -0.35], 1.0, 1.1, 0.1, [0.25, -0.55, -0.05]),
  // the muzzle down and left to feed the chambers: the swung-out cylinder's
  // rear face turned up to the eye, the left hand under it
  load: P([0.02, -0.14, -0.33], 0.9, -0.35, 0.5, [0.25, -0.5, -0.05]),
};
// the left elbow through the reload (true eye-frame): low, under the hands
// (second pass: it stood out left, and the left sleeve lay across the frame)
const EL = [-0.2, -0.6, -0.1];
// (second pass) the left hand's cradle from under the cylinder, the push
// that shuts it, and the elbow for the strike (under the hand: the forearm
// rises from the frame's bottom edge instead of lying across it)
const LH = { under: 0.75, shutUnder: 0.3, eStrike: [-0.1, -0.65, -0.1] };
// the reload, seconds from its start (the sounds land on the same marks)
export const RL = {
  dur: 1.7, look: 0.17,
  present: [0.0, 0.16], lUp: [0.03, 0.15], open: [0.13, 0.25],
  tipUp: [0.24, 0.36], strike: [0.34, 0.4], drop: 0.4, starBack: [0.44, 0.52],
  lDown: [0.4, 0.52], tipDown: [0.42, 0.58], lRounds: [0.54, 0.72],
  pairs: [[0.72, 0.8], [0.94, 1.02], [1.16, 1.24]], turns: [[0.82, 0.92], [1.04, 1.14]],
  close: [1.28, 1.38], snap: 1.38, lAway: [1.38, 1.54], ready: [1.36, 1.62], cock: [1.5, 1.64],
};
// the cut (a press during the reload): shut on what is in, up, and fire
const CUT = { close: 0.1, ready: 0.18 };

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = V(0, 0, 0), _v2 = V(0, 0, 0), _e = new THREE.Euler();

export default (game) => {
  const G = game;
  const rng = G.world.rng.fork(3303);
  const dir = V(0, 0, 0);
  const W = {
    name: 'revolver', set: 'revolver', mag: REVOLVER.rounds,
    // the six chambers ('live' | 'spent' | 'empty'); `top` the one under
    // the hammer (the next to fire)
    chambers: ['live', 'live', 'live', 'live', 'live', 'live'], top: 0,
    phase: 'away', t: 0,
    cool: 0, buffered: -1, sinceShot: 9, steady: 0, cut: null,
    sway: { x: 0, y: 0, vx: 0, vy: 0 }, lastYaw: null, lastPitch: null,
    kickR: 0, kickY: 0,
    prop: null, rounds: null,
    gunM: new THREE.Matrix4(), eR: V(0.25, -0.3, -0.2), FR: GRIP_F, poseL: null,
    turnVis: 0, hammerVis: 1, fovBase: null, zoom: 0,
    // (the poses, for fitting in the page)
    POSE, EL, LH,
    get ammo() { return this.chambers.filter((c) => c === 'live').length; },
    get reloading() { return this.phase === 'reload'; },
    get drawn() { return this.phase !== 'away'; },

    // ---- the front ---------------------------------------------------------------------
    equip() {
      if (!this.prop) this.prop = buildProp('revolver');
      const H = G.hands;
      if (H.held.R !== this.prop) H.hold(this.prop, 'R', { keep: true });
      this.phase = 'draw'; this.t = 0; this.cool = 0; this.buffered = -1; this.steady = 0; this.cut = null;
      this.sway.x = this.sway.y = this.sway.vx = this.sway.vy = 0; this.lastYaw = null;
      this.syncProp(true);
      G.sfx.play('revDraw', null, {}, { send: false, gain: 0.8 });
      this.update(0, G.time);
    },
    unequip() {
      const H = G.hands;
      if (this.prop && H.held.R === this.prop) H.hold(null, 'R', { keep: true });
      if (this.rounds && H.held.L === this.rounds) H.hold(null, 'L', { keep: true });
      if (this.phase === 'reload') this.finishReload(true);
      this.phase = 'away'; this.poseL = null;
      this.setZoom(0, true);
      G.hud.dropLayer('revolver'); this.hud = null;
    },
    // put it away (0.35 s), then the hands are empty
    holster() {
      if (this.phase === 'away' || this.phase === 'holster') return false;
      if (this.phase === 'reload') this.finishReload(true);
      this.from = this.curPose(); this.phase = 'holster'; this.t = 0;
      G.sfx.play('revHolster', null, {}, { send: false, gain: 0.8 });
      return true;
    },
    trigger(down, pressed) {
      if (!pressed) return;
      if (this.phase === 'reload') { this.cutReload(); return; }
      if (this.phase === 'draw' || this.cool > 0) {
        // (kept: any press in the draw - Q then the button at once is one
        // move - or one in the last 0.15 s before the hammer is back, fires
        // the moment it can)
        if (this.phase === 'draw' || this.cool <= REVOLVER.buffer + 1e-6) this.buffered = G.time;
        return;
      }
      if (this.phase === 'ready') this.fire();
    },
    fire() {
      if (this.phase !== 'ready' || this.cool > 0) return false;
      const ch = this.chambers[this.top];
      this.cool = REVOLVER.gap;
      this.sinceShot = 0;
      this.hammerVis = 0;
      // (the thumb's cock after the shot turns the next chamber up)
      this.turnFrom = this.top;
      if (ch !== 'live') {
        // the hammer falls on nothing: a click, and the gun is reloaded
        G.sfx.play('revDry', null, {}, { send: false, gain: 0.9 });
        this.dry = true;
        if (this.ammo === 0) { this.cool = 0.12; this.reloadAfter = 0.12; }
        return false;
      }
      this.dry = false;
      this.chambers[this.top] = 'spent';
      const cam = G.camera, time = G.time;
      cam.updateMatrixWorld();
      G.counters.shots++;
      // the round: down the eye's centre, spread from the hip, closed steadied
      const moving = G.controller.vel.length() > 1;
      const cone = REVOLVER.spreadHip + (REVOLVER.spreadSteady - REVOLVER.spreadHip) * this.steady + (moving ? REVOLVER.spreadMove * (1 - 0.6 * this.steady) : 0);
      const fwd = _v.set(0, 0, -1).transformDirection(cam.matrixWorld).clone();
      const right = V(1, 0, 0).transformDirection(cam.matrixWorld), up = V(0, 1, 0).transformDirection(cam.matrixWorld);
      const a = rng.next() * Math.PI * 2, rr = Math.sqrt(rng.next()) * cone;
      dir.copy(fwd).addScaledVector(right, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * rr).normalize();
      const origin = cam.position.clone();
      // the flash at the muzzle as the eye sees it (the viewmodel's), its
      // stand-in in the world for the wet street's mirror, the light
      const mz = this.muzzle();
      G.fx.flash.player(mz.vm, mz.world, fwd.clone(), time, mz.fwd);
      G.sfx.play('revolver', null, {}, { gain: 1.0 });
      G.sfx.duck(0.7, 0.45);
      // (the view's kick is the shot's own clock: update() lays it on the
      // hands' viewFx, never on the lens - controller.kick pins the fov for
      // its length, and the steady's zoom would drift off it)
      this.kickR = rng.range(-1, 1); this.kickY = rng.range(-1, 1);
      // the shot: the Tommy gun's path
      const hood = G.rays.raycastHoods(origin, dir, REVOLVER.range, G.world.hoods.list);
      const wall = G.rays.raycast(origin, dir, hood ? hood.t : REVOLVER.range);
      const onHood = hood && (!wall || hood.t < wall.t);
      if (onHood) {
        const h = hood.hood, head = HEAD.has(hood.joint);
        G.counters.hits++;
        if (head) G.counters.headshots++;
        G.fx.bloodFx.hit(hood.point, dir, { strength: head ? 1.35 : 1.1, rays: G.rays });
        G.damageHood(h, head ? 999 : REVOLVER.dmgBody, dir.clone(), { head, joint: hood.joint, time });
        // (a .38 in the body stops a man: he staggers, whatever he was doing)
        if (h.alive) {
          if (h.state !== 'stagger') h.stagger();
          const ai = G.ais.get(h);
          if (ai && ai.onHit) ai.onHit(dir.clone(), true);
        }
      } else if (wall) G.react.bullet(wall, dir.clone());
      // the Hoods the round passed near duck (the Tommy gun's rule)
      for (const ai of G.ais.values()) {
        const h = ai.h || ai.hood;
        if (!h || !h.alive) continue;
        const to = _v2.set(h.pos.x - origin.x, h.pos.y + 1.1 - origin.y, h.pos.z - origin.z);
        const d = to.length();
        if (to.dot(dir) / d > Math.cos(Math.atan2(2.0, d))) ai.underFire = 2.5;
      }
      G.emit('shot', { weapon: 'revolver', hit: onHood ? hood : wall });
      this.syncProp();
      return true;
    },
    reload() {
      if (this.phase !== 'ready' && this.phase !== 'draw') return false;
      if (this.ammo === REVOLVER.rounds) return false;
      this.from = this.curPose();
      this.phase = 'reload'; this.t = 0; this.cut = null; this.cutL = null; this.buffered = -1;
      this.loaded = 0; this.dropped = false; this.fed = 0; this.snapped = false;
      // (what is spent or live goes out: a dump, as a man does in a fight)
      this.feedTurn0 = this.top;
      this.heard = {};
      return true;
    },
    // a press during the reload: shut on what is in and fire (once a pair is in)
    cutReload() {
      this.buffered = G.time;
      if (this.cut) return;
      // (second pass: a press once the cylinder is closing no longer waits
      // for the whole 1.7 s: the gun comes straight up and fires 0.18 s
      // later; the left hand goes its own way out)
      if (this.t >= RL.close[0]) { this.cut = { at: this.t, late: true, shut: this.snapped }; return; }
      this.cut = { at: this.loaded > 0 ? this.t : null };
    },
    finishReload(abandon = false) {
      const H = G.hands;
      if (this.rounds && H.held.L === this.rounds) H.hold(null, 'L', { keep: true });
      this.poseL = null;
      if (abandon && !this.dropped) { /* the old rounds stay in */ }
      this.prop.userData.setOpen(0); this.prop.userData.setEject(0);
    },

    // ---- per step -----------------------------------------------------------------------
    update(dt, t) {
      const C = G.controller;
      this.cool = Math.max(0, this.cool - dt);
      const st0 = this.sinceShot;
      this.sinceShot += dt;
      // (the thumb's cock after a shot: two clicks as the hammer comes back)
      if (this.turnFrom != null && st0 < 0.13 && this.sinceShot >= 0.13) G.sfx.play('revCock', null, {}, { send: false, gain: 0.8 });
      if (this.reloadAfter > 0) { this.reloadAfter -= dt; if (this.reloadAfter <= 0) { this.reloadAfter = 0; this.reload(); } }
      if (this.phase === 'away') return;
      this.t += dt;
      // the look drags the gun a little behind it (springs, as the Tommy gun)
      const S = this.sway;
      if (this.lastYaw !== null && dt > 0) {
        let dy = C.yaw - this.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const dp = C.pitch - this.lastPitch;
        S.vx += -dy * 2.0; S.vy += -dp * 2.0;
      }
      this.lastYaw = C.yaw; this.lastPitch = C.pitch;
      if (dt > 0) {
        const k = 110, c = 15;
        S.vx += (-k * S.x - c * S.vx) * dt; S.x += S.vx * dt;
        S.vy += (-k * S.y - c * S.vy) * dt; S.y += S.vy * dt;
        S.x = Math.max(-0.1, Math.min(0.1, S.x)); S.y = Math.max(-0.08, Math.min(0.08, S.y));
      }
      // RMB steadies (only with the gun up and ready)
      const canSteady = this.phase === 'ready' && G.live && !G.inspect.active && !G.puzzles.active;
      const want = canSteady && G.held('Mouse2') ? 1 : 0;
      if (dt > 0) this.steady += (want - this.steady) * (1 - Math.exp(-dt * (want ? 16 : 13)));
      if (this.steady < 1e-3 && !want) this.steady = 0;
      // phases
      if (this.phase === 'draw' && this.t >= REVOLVER.draw) { this.phase = 'ready'; this.t = 0; }
      if (this.phase === 'holster' && this.t >= REVOLVER.holster) { G.weapons.equip(null); return; }
      if (this.phase === 'reload') this.stepReload(dt);
      // a kept press fires the moment the gun can
      if (this.buffered >= 0 && this.phase === 'ready' && this.cool <= 0) {
        this.buffered = -1;
        if (G.live) this.fire();
      }
      // (a kept press waits out the draw and a cut reload, however long the
      // first pair takes: it is dropped only if the gun stood ready and
      // could not fire - the game not live)
      if (this.buffered >= 0 && this.phase === 'ready' && G.time - this.buffered > 0.6) this.buffered = -1;
      this.pose(dt);
      this.syncProp();
      this.setZoom(this.steady * REVOLVER.steadyFov);
      this.drawHud();
      // the eyes drop to the gun through the reload (the head and what it
      // holds stay put: the hands' 'eyes' view, Hands.frames), and come up
      // with it
      const eyes = this.phase === 'reload' ? -RL.look * (this.cut ? 1 - ss(0, CUT.ready, this.t - (this.cut.at ?? this.t)) : ss(0, 0.2, this.t) * (1 - ss(RL.ready[0], RL.ready[1], this.t))) : 0;
      const VF = C.viewFx || (C.viewFx = { yaw: 0, pitch: 0, roll: 0, fwd: 0, side: 0, down: 0, eyes: 0 });
      VF.eyes = eyes;
      // lay the hands now: the gun's place of this step, not the last one's
      G.hands.pose3();
      VF.eyes = eyes;
      // the view kicks with the shot (1.1 degrees up, 0.7 steadied, a hair
      // sideways; up at once and back in a fifth of a second); the aim itself
      // is never moved
      const kv = this.dry ? 0 : climbK(this.sinceShot) * (1 - ss(0.12, 0.26, this.sinceShot));
      VF.pitch += 0.019 * (1 - 0.35 * this.steady) * kv;
      VF.yaw += 0.004 * this.kickY * kv;
    },

    // the reload's moments that change the gun (its pose is pose()'s)
    stepReload(dt) {
      const t = this.t, ud = this.prop.userData, H = G.hands;
      // the cut: shut on what is in, once a pair is in (else after the first)
      if (this.cut && this.cut.at == null && this.loaded > 0) this.cut.at = t;
      if (this.cut && this.cut.at != null) {
        const u = t - this.cut.at;
        if (!this.cut.shut && u >= CUT.close) { this.cut.shut = true; G.sfx.play('revShut', null, {}, { send: false, gain: 1 }); this.closeOn(); }
        if (u >= CUT.ready) this.endReload();
        return;
      }
      // (each sound on its moment, so a cut reload does not play the rest)
      const hear = (k, at, name, gain = 0.9) => { if (!this.heard[k] && t >= at) { this.heard[k] = true; G.sfx.play(name, null, {}, { send: false, gain }); } };
      hear('open', RL.open[0], 'revOpen');
      hear('eject', RL.strike[0], 'revEject');
      if (!this.dropped && t >= RL.drop) {
        this.dropped = true;
        this.dropCases();
      }
      // the rounds come up out of the coat in the left hand
      if (t >= RL.lRounds[0] && !this.rounds) this.rounds = buildProp('roundsHand');
      if (t >= RL.lRounds[0] && t < RL.close[0] && this.rounds && H.held.L !== this.rounds) { H.hold(this.rounds, 'L', { keep: true }); this.rounds.userData.setCount(6); }
      for (let k = 0; k < 3; k++) {
        if (this.fed <= k && t >= RL.pairs[k][1]) {
          this.fed = k + 1;
          const [a, b] = this.feedPair(k);
          this.chambers[a] = 'live'; this.chambers[b] = 'live';
          this.loaded += 2;
          this.rounds.userData.setCount(6 - 2 * (k + 1));
          G.sfx.play('revRound', null, {}, { send: false, gain: 0.8 });
        }
      }
      if (t >= RL.close[0] && this.rounds && H.held.L === this.rounds) H.hold(null, 'L', { keep: true });
      if (!this.snapped && t >= RL.snap) { this.snapped = true; G.sfx.play('revShut', null, {}, { send: false, gain: 1 }); this.closeOn(); }
      if (t >= RL.dur) this.endReload();
    },
    // the pair of chambers fed k-th (the two at the feed spot as the
    // cylinder stands then)
    feedPair(k) { const a = (this.feedTurn0 + 2 * k) % 6; return [a, (a + 1) % 6]; },
    // shut: the first live chamber under the hammer
    closeOn() {
      for (let i = 0; i < 6; i++) { const j = (this.feedTurn0 + i) % 6; if (this.chambers[j] === 'live') { this.top = j; break; } }
    },
    endReload() {
      const H = G.hands;
      if (this.rounds && H.held.L === this.rounds) H.hold(null, 'L', { keep: true });
      this.poseL = null;
      this.prop.userData.setOpen(0); this.prop.userData.setEject(0);
      this.from = this.curPose();
      this.phase = 'ready'; this.t = 0; this.cut = null;
      this.hammerVis = 1;
      this.cool = 0;
    },
    // the spent cases and any rounds fall out (the world's casings: they
    // bounce and ring on the floor)
    dropCases() {
      const fx = G.fx, cam = G.camera;
      if (!fx || !fx.casings) { this.chambers = this.chambers.map(() => 'empty'); return; }
      const right = V(1, 0, 0).transformDirection(cam.matrixWorld).multiplyScalar(0.12);
      const up = V(0, -1, 0).multiplyScalar(0.18);
      const fwd = V(0, 0, -1).transformDirection(cam.matrixWorld).multiplyScalar(0.25);
      for (let i = 0; i < 6; i++) {
        if (this.chambers[i] === 'empty') continue;
        const p = this.chamberCam(i, V(0, 0, 0));
        fx.casings.eject(this.toWorld(p, 0.42), right, up, fwd);
        this.chambers[i] = 'empty';
      }
    },

    // ---- the gun's place ------------------------------------------------------------
    curPose() { return { p: this.base ? this.base.p.clone() : POSE.ready.p.clone(), q: this.base ? this.base.q.clone() : POSE.ready.q.clone(), e: this.base ? this.base.e.clone() : POSE.ready.e.clone() }; },
    pose(dt) {
      const ud = this.prop.userData;
      const base = this.base || (this.base = { p: V(0, 0, 0), q: new THREE.Quaternion(), e: V(0, 0, 0) });
      const mix = (A, B, k, out) => { out.p.lerpVectors(A.p, B.p, k); out.q.slerpQuaternions(A.q, B.q, k); out.e.lerpVectors(A.e, B.e, k); return out; };
      const aim = { p: V(0, 0, 0), q: new THREE.Quaternion(), e: V(0, 0, 0) };
      mix(POSE.ready, POSE.steady, ss(0, 1, this.steady), aim);
      let F = GRIP_F;
      this.poseL = null;
      const t = this.t;
      if (this.phase === 'draw') {
        // up out of the coat: fast, settling into the aim
        const u = easeOut(clamp01(t / REVOLVER.draw));
        mix(POSE.holster, aim, u, base);
      } else if (this.phase === 'holster') {
        const u = clamp01(t / REVOLVER.holster);
        mix(this.from || aim, POSE.holster, u * u * (3 - 2 * u), base);
      } else if (this.phase === 'reload') {
        this.reloadPose(t, aim, base);
        F = this.reloadF || GRIP_F;
      } else {
        // ready: from where the last move ended into the aim (a short ease)
        const u = this.from ? ss(0, 0.2, t) : 1;
        if (this.from && u >= 1) this.from = null;
        if (this.from) mix(this.from, aim, u, base); else { base.p.copy(aim.p); base.q.copy(aim.q); base.e.copy(aim.e); }
      }
      // the shot: the muzzle climbs about the grip and comes back (a
      // quarter of a second); the index pulls, the thumb cocks the hammer
      const st = this.sinceShot, k = this.dry ? 0.12 * climbK(st) : climbK(st) * (1 - 0.25 * this.steady);
      const p = _v.copy(base.p), q = _q.copy(base.q);
      // walk bob, breath, the look's drag
      const C = G.controller, bp = C.bobPhase || 0, ba = (C.bobAmp || 0) * (1 - 0.5 * this.steady);
      const T = G.time || 0, br = Math.sin(T * 1.6) * 0.0018 * (1 - 0.6 * this.steady);
      const S = this.sway;
      p.x += Math.cos(bp) * 0.01 * ba + S.x * 0.1;
      p.y += -Math.abs(Math.sin(bp)) * 0.012 * ba + br + S.y * 0.1;
      // (the shove back into the hand, and the wrist breaking up: the gun
      // turns about the wrist, 6 cm behind and 3 below the grip, so the
      // whole gun lifts as the muzzle climbs; a little roll to the right)
      p.addScaledVector(_v2.set(0, 0, 1).applyQuaternion(q), 0.042 * k);
      p.y += 0.008 * k;
      _e.set(RECOIL.climb * k + S.y * 0.35 + br * 0.6, S.x * 0.45 + 0.03 * k * this.kickY, -S.x * 0.25 - 0.06 * k + 0.03 * k * this.kickR + Math.cos(bp) * 0.008 * ba, 'YXZ');
      _q2.setFromEuler(_e);
      // (the pivot, in the gun's frame, carried round by the turn)
      const piv = _v2.set(0, -0.03, 0.06);
      const pw = piv.clone().applyQuaternion(q);
      const pr = piv.applyQuaternion(q.clone().multiply(_q2));
      p.add(pw).sub(pr);
      q.multiply(_q2);
      this.gunM.compose(p, q, _v2.set(1, 1, 1));
      this.eR.copy(base.e);
      this.eR.y += 0.02 * k;
      // fingers: the index pulls at the shot; the thumb goes up to the spur
      // and draws the hammer back after it (the cylinder turns with it)
      if (this.phase === 'ready' || this.phase === 'draw') {
        if (st < 0.07) F = PULL_F;
        else if (st < 0.13) F = COCK_F;
        else if (st < 0.26) F = COCKED_F;
      }
      this.FR = F;
      void dt; void ud;
    },
    // the hammer and the cylinder as the shot and the cock have them
    syncProp(snap = false) {
      if (!this.prop) return;
      const ud = this.prop.userData, st = this.sinceShot;
      let hammer = 1, trig = 0;
      if (this.phase !== 'reload' && this.turnFrom != null) {
        // the hammer down at the shot; back with the thumb 0.13 .. 0.24 s,
        // and the cylinder turns with it: the fired chamber goes round, the
        // next comes up under the hammer
        hammer = ss(0.13, 0.24, st);
        trig = st < 0.05 ? 1 : 1 - ss(0.05, 0.14, st);
        const k = ss(0.13, 0.24, st);
        ud.setTurn((this.turnFrom + k) * Math.PI / 3);
        if (st >= 0.24) { this.top = (this.turnFrom + 1) % 6; this.turnFrom = null; }
      } else if (this.phase !== 'reload') ud.setTurn(this.top * Math.PI / 3);
      if (this.phase === 'reload') hammer = this.t < RL.cock[0] ? 0.0 : ss(RL.cock[0], RL.cock[1], this.t);
      if (this.phase === 'reload' && this.cut && this.cut.at != null) hammer = Math.max(hammer, ss(CUT.close, CUT.ready, this.t - this.cut.at));
      ud.setHammer(hammer);
      ud.setTrigger(trig);
      ud.setChambers(this.chambers);
      void snap;
    },
    // the reload's gun place and the left hand
    reloadPose(t, aim, out) {
      const ud = this.prop.userData;
      const mix = (A, B, k, o) => { o.p.lerpVectors(A.p, B.p, k); o.q.slerpQuaternions(A.q, B.q, k); o.e.lerpVectors(A.e, B.e, k); return o; };
      const from = this.from || POSE.ready;
      const cutAt = this.cut && this.cut.at != null ? this.cut.at : null;
      // the path: to present, muzzle up, muzzle down (the feed), present, ready
      let A = from, B = POSE.present, k = ss(RL.present[0], RL.present[1], t);
      if (t >= RL.tipUp[0]) { A = POSE.present; B = POSE.eject; k = ss(RL.tipUp[0], RL.tipUp[1], t); }
      if (t >= RL.tipDown[0]) { A = POSE.eject; B = POSE.load; k = ss(RL.tipDown[0], RL.tipDown[1], t); }
      if (t >= RL.close[0]) { A = POSE.load; B = POSE.present; k = ss(RL.close[0], RL.close[1], t); }
      if (t >= RL.ready[0]) { A = mix(POSE.load, POSE.present, ss(RL.close[0], RL.close[1], t), { p: V(0, 0, 0), q: new THREE.Quaternion(), e: V(0, 0, 0) }); B = aim; k = ss(RL.ready[0], RL.ready[1], t); }
      mix(A, B, k, out);
      // the strike's jolt: the gun pushed down its own axis a little
      const jolt = ss(RL.strike[0], RL.strike[1], t) * (1 - ss(RL.strike[1], RL.strike[1] + 0.1, t));
      out.p.addScaledVector(_v.set(0, 0, 1).applyQuaternion(out.q), 0.012 * jolt);
      // the cylinder: out, turned, the star's stroke
      let open = ss(RL.open[0], RL.open[1], t) * (1 - ss(RL.close[0], RL.close[1], t));
      let turn = this.feedTurn0 * Math.PI / 3;
      for (let k2 = 0; k2 < 2; k2++) turn += (2 * Math.PI / 3) * ss(RL.turns[k2][0], RL.turns[k2][1], t);
      const strike = ss(RL.strike[0], RL.strike[1], t) * (1 - ss(RL.starBack[0], RL.starBack[1], t));
      // the cut: from where it stands, shut and up into the aim
      if (cutAt != null) {
        const u = t - cutAt;
        const snapshot = this.cutFrom || (this.cutFrom = { p: out.p.clone(), q: out.q.clone(), e: out.e.clone(), open, turn });
        mix(snapshot, aim, ss(0, CUT.ready, u), out);
        open = snapshot.open * (1 - ss(0, CUT.close, u));
        turn = snapshot.turn;
      } else this.cutFrom = null;
      ud.setOpen(open);
      // (at the shut the first loaded chamber comes under the hammer)
      ud.setTurn(open < 0.02 && (this.snapped || (this.cut && this.cut.shut)) ? this.top * Math.PI / 3 : turn);
      ud.setEject(strike);
      this.openVis = open;
      // the left hand, relative to the gun (as it will stand this step)
      this.gunTmp = this.gunTmp || new THREE.Matrix4();
      this.gunTmp.compose(out.p, out.q, _v2.set(1, 1, 1));
      this.reloadF = GRIP_F;
      this.poseL = cutAt != null && !this.cut.late ? this.leftCut(t - cutAt) : this.leftHand(t);
    },
    // a point of the gun (its own frame) in the eye's frame, as it stands in gunTmp
    gunPt(x, y, z, out = V(0, 0, 0)) { return out.set(x, y, z).applyMatrix4(this.gunTmp); },
    gunDir(x, y, z, out = V(0, 0, 0)) { return out.set(x, y, z).transformDirection(this.gunTmp); },
    // the cylinder's frame (in the eye's) as the gun stands in gunTmp
    cylM(out = new THREE.Matrix4()) {
      const by = this.prop.userData.parts;
      by.crane.updateMatrix(); by.cyl.updateMatrix();
      return out.copy(this.gunTmp).multiply(by.crane.matrix).multiply(by.cyl.matrix);
    },
    chamberCam(i, out) {
      const D = this.prop.userData.dims, th = i * Math.PI / 3;
      return out.set(-Math.sin(th) * D.CR, Math.cos(th) * D.CR, 0).applyMatrix4(this.cylM(_m2));
    },
    // the left hand through the reload (true eye-frame poses)
    leftHand(t) {
      const D = this.prop.userData.dims;
      const E = EL;
      const below = { frame: 'cam', p: [-0.06, -0.52, -0.3], f: [0.3, 0.8, -0.5], b: [-0.6, 0.2, 0.7], F: L_OPEN, e: [-0.12, -0.9, -0.1] };
      // on the cylinder: the palm under its left side (as the gun is turned:
      // toward the eye), the fingers round it, pushing it out
      const cyl = (F = L_CRADLE, under = LH.under) => this.onCylinder(F, E, 0.004, under);
      // the strike: the palm flat on the ejector rod's tip (muzzle up)
      const strike = (d) => {
        const tip = this.gunPt(0, D.CA, D.Z0 - (D.FR1 + 0.045) + 0.0, V(0, 0, 0));
        const M = this.cylM(_m);
        const ax = V(0, 0, -1).transformDirection(M);
        const tipC = V(0, 0, -(D.FR1 + 0.045 - 0.0)).applyMatrix4(M);
        void tip;
        const at = tipC.addScaledVector(ax, 0.003 + d);
        const f = V(1, 0, 0).transformDirection(this.gunTmp);
        return palm('cam', at.toArray(), ax.clone().negate().toArray(), f.toArray(), L_STRIKE, LH.eStrike);
      };
      // the rounds: the front pair over the two chambers at the feed spot,
      // `lift` above the rear face, pushed in as lift goes to 0
      const feed = (k, lift) => {
        const [a, b] = this.feedPair(k);
        const ca = this.chamberCam(a, V(0, 0, 0)), cb = this.chamberCam(b, V(0, 0, 0));
        const M = this.cylM(_m);
        const back = V(0, 0, 1).transformDirection(M);
        const x = cb.clone().sub(ca).normalize();
        const z = new THREE.Vector3().crossVectors(x, back).normalize();
        const mid = ca.clone().add(cb).multiplyScalar(0.5).addScaledVector(back, lift);
        const m = new THREE.Matrix4().makeBasis(x, back, z).setPosition(mid);
        return { o: true, m, F: L_PINCH, e: E };
      };
      if (t < RL.lUp[0]) return null;
      if (t < RL.lUp[1]) return lerpPose(below, cyl(), ss(RL.lUp[0], RL.lUp[1], t));
      if (t < RL.strike[0] - 0.06) return cyl();
      if (t < RL.strike[0]) return lerpPose(cyl(), strike(0.03), ss(RL.strike[0] - 0.06, RL.strike[0], t));
      if (t < RL.strike[1] + 0.03) return strike(0.03 * (1 - ss(RL.strike[0], RL.strike[1], t)));
      if (t < RL.lDown[1]) return lerpPose(strike(0.0), below, ss(RL.strike[1] + 0.03, RL.lDown[1], t));
      if (t < RL.lRounds[0]) return null;
      // up from the coat with the rounds, then three pairs in
      const H = G.hands;
      if (!this.rounds || H.held.L !== this.rounds) return null;
      const lifted = 0.05;
      if (t < RL.lRounds[1]) {
        const f0 = feed(0, lifted);
        const low = new THREE.Matrix4().copy(f0.m).setPosition(-0.08, -0.46, -0.3);
        return { ...f0, m: lerpM(low, f0.m, easeOut(ss(RL.lRounds[0], RL.lRounds[1], t))) };
      }
      for (let k = 0; k < 3; k++) {
        const [p0, p1] = RL.pairs[k];
        if (t < p0) return feed(k, lifted);
        if (t < p1) return feed(k, lifted * (1 - ss(p0, p1, t)));
        const next = RL.pairs[k + 1];
        // (back up off the pair just in; the cylinder turns under the hand)
        if (next && t < next[0]) return feed(k + 1, lifted * ss(p1, p1 + 0.08, t));
      }
      // the push that shuts it: the fingers on the cylinder's side
      if (t < RL.lAway[1]) {
        const c = cyl(L_CRADLE, LH.shutUnder);
        if (t < RL.close[1]) return c;
        return lerpPose(c, below, ss(RL.lAway[0], RL.lAway[1], t));
      }
      return null;
    },
    // the left hand on the swung-out cylinder: the palm on its outer side
    // (away from the frame), facing in, the fingers round it toward the
    // muzzle's side, the thumb on its near side
    onCylinder(F, E, out = 0.004, under = 0) {
      const D = this.prop.userData.dims;
      const M = this.cylM(_m);
      const c = V(0, 0, -0.02).applyMatrix4(M);
      const ax = V(0, 0, -1).transformDirection(M);
      // outward: from the gun's bore line (the frame) to the cylinder's axis
      const bore = this.gunPt(0, D.BORE, D.Z0 - 0.02, V(0, 0, 0));
      const o = c.clone().sub(bore); o.addScaledVector(ax, -o.dot(ax));
      if (o.lengthSq() < 1e-8) o.copy(this.gunDir(-1, 0, 0));
      o.normalize();
      // (shut, the cylinder's outside is its left: the gun's -x)
      const left = this.gunDir(-1, 0, 0);
      const k = clamp01(this.openVis ?? 0);
      const oo = left.clone().lerp(o, k).normalize();
      // (second pass: `under` turns the palm round under the cylinder - the
      // eye's down, across the axis - so the hand cradles it from below and
      // never covers the chambers from the eye)
      if (under > 0) {
        const dn = V(0, -1, 0).addScaledVector(ax, ax.y);
        if (dn.lengthSq() > 1e-6) oo.lerp(dn.normalize(), under).normalize();
      }
      const at = c.clone().addScaledVector(oo, D.CYL_R + out);
      const across = new THREE.Vector3().crossVectors(ax, oo).normalize();
      // (the fingers point across it to the right: the left arm comes from
      // the left edge)
      if (across.x < 0) across.negate();
      return palm('cam', at.toArray(), oo.clone().negate().toArray(), across.addScaledVector(ax, 0.25).normalize().toArray(), F, E);
    },
    // the cut: the left hand slaps the cylinder shut and drops away
    // (second pass: the hand is laid on the cylinder where it stood at the
    // press and then drops straight down out of the frame, keeping its
    // turn; it used to swing through a lerp toward a pose turned the other
    // way, and for 0.1 s an open palm and a sleeve stood up mid-frame)
    leftCut(u) {
      if (u > CUT.ready + 0.08) { this.cutL = null; return null; }
      if (G.hands.held.L === this.rounds && this.rounds) G.hands.hold(null, 'L', { keep: true });
      const on = this.cutL || (this.cutL = this.onCylinder(L_CRADLE, EL, 0.004, LH.shutUnder));
      const k = ss(0.03, CUT.ready + 0.08, u);
      const F = {};
      for (const n of ['i', 'm', 'r', 'l', 't']) F[n] = on.F[n].map((v, i) => v + (L_OPEN[n][i] - v) * k);
      return { ...on, p: [on.p[0] - 0.03 * k, on.p[1] - 0.3 * k * k, on.p[2] + 0.03 * k], F };
    },

    // the muzzle: the viewmodel's world point, the world's stand-in (the
    // same screen point at 0.9 m through the eye's lens), the barrel's way
    muzzle() {
      const ud = this.prop.userData;
      const vmRoot = G.vm.root;
      vmRoot.updateMatrixWorld(true);
      const local = ud.muzzle.clone().applyMatrix4(this.gunM);                // eye frame
      const vm = local.clone().applyMatrix4(vmRoot.matrixWorld);
      const world = this.toWorld(local, 0.9);
      const fwd = V(0, 0, -1).transformDirection(this.gunM).transformDirection(vmRoot.matrixWorld);
      return { vm, world, fwd };
    },
    // an eye-frame point of the viewmodel -> the world point at `depth` seen
    // at the same place on the screen through the eye's own lens
    toWorld(p, depth) {
      const cam = G.camera;
      const tv = Math.tan(THREE.MathUtils.degToRad(VM_FOV) / 2), tm = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      const nx = p.x / (-p.z * tv), ny = p.y / (-p.z * tv);
      return V(nx * tm * depth, ny * tm * depth, -depth).applyMatrix4(cam.matrixWorld);
    },

    // the lens tightens with the steady (and is given back)
    setZoom(z, force = false) {
      const cam = G.camera;
      if (this.zoom === 0 && z <= 0 && !force) return;
      if (this.fovBase == null || Math.abs(cam.fov - (this.fovBase - this.zoom)) > 0.05) this.fovBase = cam.fov + this.zoom;
      if (force && z <= 0) { if (this.zoom) { cam.fov = this.fovBase; cam.updateProjectionMatrix(); } this.zoom = 0; this.fovBase = null; return; }
      this.zoom = z;
      cam.fov = this.fovBase - z;
      cam.updateProjectionMatrix();
      if (z <= 0) this.fovBase = null;
    },

    // ---- the hands (the set's pose hook: Hands.pose3) ------------------------------------
    handPose(H, side, out) {
      if (this.phase === 'away' || !this.prop) return false;
      if (side === 'R') {
        if (H.held.R !== this.prop) return false;
        const P = H.poseForProp('R', this.prop, this.gunM, 'cam', this.FR, this.eR.toArray());
        return H.resolve(P, 'R', out);
      }
      const L = this.poseL;
      if (!L) return false;
      if (L.o) {
        if (!H.held.L) return false;
        return H.resolve(H.poseForProp('L', H.held.L, L.m, 'cam', L.F, L.e), 'L', out);
      }
      return H.resolve(L, 'L', out);
    },

    // ---- the count (bottom right) ----------------------------------------------------
    drawHud() {
      const hud = G.hud;
      if (!hud || !hud.visible) return;
      if (!this.hud || !this.hud.isConnected) { this.hud = hud.layer('revolver'); this.hudKey = null; }
      const key = this.chambers.join() + '|' + this.top + '|' + (this.phase === 'reload' ? Math.round((this.prop.userData.turn || 0) * 100) : '') + '|' + (this.phase === 'holster' ? 'h' : '');
      if (key === this.hudKey) return;
      this.hudKey = key;
      drawCount(this.hud, { chambers: this.chambers, top: this.top, turn: this.phase === 'reload' ? this.prop.userData.turn : this.top * Math.PI / 3, fading: this.phase === 'holster' });
    },
  };
  return W;
};

// a pose between two (true eye-frame defs), for the left hand's moves
function lerpPose(A, B, k) {
  const L = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
  const F = {};
  for (const n of ['i', 'm', 'r', 'l', 't']) F[n] = L(A.F[n], B.F[n]);
  return { frame: 'cam', p: L(A.p, B.p), f: L(A.f, B.f), b: L(A.b, B.b), F, e: L(A.e, B.e) };
}
function lerpM(A, B, k) {
  const pa = V(0, 0, 0), pb = V(0, 0, 0), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), s = V(0, 0, 0);
  A.decompose(pa, qa, s); B.decompose(pb, qb, s);
  return new THREE.Matrix4().compose(pa.lerp(pb, k), qa.slerp(qb, k), s.set(1, 1, 1));
}
