import * as THREE from 'three';
import { gunsOf } from '../../guns/Guns.js';
import { accentMaterial } from '../../render/accents.js';
import { DINER } from './site.js';
import { rig } from './rig.js';
import { gunman, rebuild } from './street.js';
import { doorOut } from './carOut.js';
import { CARDINAL_OUT } from '../../cast/kinds/cardinal.js';
import { endHat } from './ending.js';

// VIII, the Cardinal (lane C8; the brief's §4): not a sponge, a problem in
// three stages, each read from the picture, no bar.
//   1 the saloon   long, black, armoured, up the near side at a walk with its
//                  lamps full in my eyes; two heavies walking behind it.
//                  Rounds spark off it. What gives: the lamps (the glare goes),
//                  the tyres (it stops where I stop it), the men
//   2 him          out of the back when it stops; wide, slow, the cane, the
//                  cigar, a big pistol; a heavy walks before him as a shield.
//                  His tell is his own: he draws on the cigar (the ember
//                  flares), the gun comes up, and that round does not miss a
//                  man in the open. A round into him counts only when he is
//                  open - just after he fires, when his shield man drops, when
//                  a car going up knocks him down; else it thuds into the iron
//                  under his coat. Three honest hits: the hat, the arm, the knee
//   3 the end      on one knee, then up, for the diner's door and Dot: ten
//                  seconds to finish it, or he is in
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const SALOON = {
  // up the near side of the road at a walk, to stop south of the door, its
  // lamps along the front (cars never pass through cars: the parked sedan
  // at (-4.3, -25) is left on the left)
  // ([C8] after the critic: it stopped by itself at the end of its rail, so the
  // tyres never mattered. Now the rail runs on to the diner's door, and a car
  // that gets there has lost me the stage: it must be stopped - two tyres)
  rail: [[-3.0, -84], [-2.0, -74], [0.3, -62], [0.5, -56], [-0.3, -44], [-1.1, -31], [-1.1, -24], [-0.9, -17], [-1.6, -13], [-2.4, -9.5], [-3.7, -5.6], [-4.7, -1.6]],
  // where it stands for a checkpoint after it (where the old rail ended), m before the end
  parkBack: 8.2,
  // where a retry of the stage starts it, m before the end (about 23 s at its walk)
  retryBack: 56,
  // (they wait by the road, out of the light, and walk up behind it once it is by)
  heavies: [
    { at: { x: 4.4, z: -49.5 }, steps: [{ x: 1.9, z: -36 }, { x: 0.6, z: -24 }, { x: -0.5, z: -13.4 }] },
    { at: { x: -5.2, z: -47.5 }, steps: [{ x: -3.2, z: -36 }, { x: -3.0, z: -24 }, { x: -4.1, z: -14.6 }] },
  ],
  // his walk: from the saloon's rear door to the pavement before the door
  path: [{ x: -4.2, z: -8.6 }, { x: -6.4, z: -5.6 }, { x: -7.9, z: -2.4 }, { x: -8.5, z: -0.6 }],
  // stage 3: up, for the door and in
  last: [{ x: -9.4, z: 0.6 }, { x: -10.9, z: 0.6 }, { x: -12.6, z: 0.4 }],
  // the shot that does not miss a man in the open
  dmg: 75, sigma: 0.0035,
  // ([C8] after the critic: in the last ten seconds his shot is the end of a man
  // standing in the open - the stander does not trade one for his two hits)
  dmgLast: 100,
  // how long he is open
  openAfterShot: 1.5, openShield: 2.6, openBlast: 3.0,
  // (the last ten seconds: he stands after his shot, open, a little longer - two openings in them)
  openLast: 2.2,
};

// ---- stage 1: the saloon --------------------------------------------------------------------
export function saloonIn(ctx, { retry = false } = {}) {
  const G = ctx.game, S = ctx.stage, R = rig();
  const car = R.rails.spawn({ rail: SALOON.rail, lights: true, v0: 2.4, cruise: 2.4, decel: 1.6, lat: 3, armored: true });
  car.c8beat = 'saloon';
  car.c8saloon = true;
  R.cars.saloon = car;
  car.meshes.lens.material = S.M.headlamp;
  if (retry) { car.rail.s = Math.max(0, car.rail.L - SALOON.retryBack); R.rails.place(car, 0); }
  // (it stops where I stop it: two tyres gone)
  car.rail.riders.push((c) => {
    if (c.rail.done) return;
    const flat = (c.tyres || []).filter(Boolean).length;
    // ([C8] after the critic: one tyre gone, it limps on at half its walk - the
    // first is seen to tell; the second stops it)
    if (flat === 1 && !c.c8limp) { c.c8limp = true; const v = c.rail.plan.v; for (let i = 0; i < v.length; i++) v[i] *= 0.5; G.sfx.play('b7_brake', c.pos.clone().setY(0.4), { k: 0.5 }); }
    if (flat >= 2 && !c.c8flat) {
      c.c8flat = true;
      c.rail.plan.v.fill(0); c.rail.done = true; c.rail.stopped = true;
      G.sfx.play('b7_brake', c.pos.clone().setY(0.4));
      if (c.rail.onStop) c.rail.onStop(c);
    }
  });
  return car;
}
export function saloonMen(ctx, car) {
  return SALOON.heavies.map((m) => { const h = gunman(ctx, { kind: 'tommy', at: m.at, steps: m.steps.map((p) => ({ ...p, run: false })), wait: 0.2, hp: 150, start: () => !car || car.pos.z > m.at.z + 2 }); h.c8beat = 'saloon'; return h; });
}

// the glare: his lamps in my eyes (a white bloom over the frame where they
// are, by how straight they come at me) - shoot them out and it goes
export function glare(ctx) {
  const G = ctx.game, R = rig();
  const L = G.hud.layer('c8glare');
  if (!L.firstChild) L.innerHTML = '<div style="position:absolute;inset:0;pointer-events:none"></div>';
  const el = L.firstChild;
  const cam = G.camera, p = V(0, 0, 0), f = V(0, 0, 0);
  return () => {
    const car = R.cars.saloon;
    let k = 0, sx = 0.5, sy = 0.5;
    if (car && car.rail && car.state !== 'burning' && R.rails.list.includes(car)) {
      const lit = car.lensBroken.filter((b) => !b).length / 2;
      if (lit > 0) {
        p.set(2.35, 0.98, 0).applyMatrix4(car.group.matrixWorld);
        f.set(1, 0, 0).transformDirection(car.group.matrixWorld);
        const to = V(G.eye.x - p.x, G.eye.y - p.y, G.eye.z - p.z), d = to.length(); to.divideScalar(d);
        const into = Math.max(0, f.dot(to));
        const v = p.clone().project(cam);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3;
        if (onScreen && into > 0.55 && d < 34 && !G.rays.raycast(G.eye, p.clone().sub(G.eye).normalize(), d - 0.4, { anyHit: true, skip: (e) => !!(e.mesh.userData.pane || e.mesh.userData.car) })) {
          k = lit * Math.pow((into - 0.55) / 0.45, 1.5) * Math.min(1, 14 / Math.max(6, d));
          sx = (v.x + 1) / 2; sy = (1 - v.y) / 2;
        }
      }
    }
    R.glareK = k;
    el.style.display = k > 0.02 ? '' : 'none';
    if (k > 0.02) el.style.background = `radial-gradient(circle at ${(sx * 100).toFixed(1)}% ${(sy * 100).toFixed(1)}%, rgba(255,255,255,${(0.97 * k).toFixed(3)}) 0%, rgba(245,245,245,${(0.85 * k).toFixed(3)}) 12%, rgba(230,230,230,${(0.45 * k).toFixed(3)}) 32%, rgba(220,220,220,0) 62%)`;
  };
}

// ---- stage 2 and 3: him --------------------------------------------------------------------------
const FLARE = { on: null, off: null };
export function cardinalOut(ctx, car, { at = null, stage = 2, hatGone = false, onDown, onDoor } = {}) {
  const G = ctx.game, S = ctx.stage, K = gunsOf(G), R = rig();
  let p, yaw;
  if (at) { p = at; yaw = Math.atan2(SALOON.path[0].x - at.x, SALOON.path[0].z - at.z); }
  else { const o = doorOut(car, 'rr'); p = { x: o.x, z: o.z }; yaw = o.yaw; }
  const c = ctx.cast.spawn('cardinal', { at: { x: p.x, z: p.z }, yaw });
  const h = c.fig;
  c.own = false;
  S.hoods.list.push(h);
  h.hp = 1e6;
  h.heavy = false;
  h.b7char = c;
  h.c8beat = ctx.beat;
  h.c8boss = true;
  h.c8why = 'He doesn’t miss a man in the open.';
  h.surface = (x, z) => S.surfaceY(x, z);
  R.cardinal = h;
  const cig = h.b7cigar, ember = cig && cig.userData.ember;
  if (!FLARE.on) { FLARE.on = accentMaterial('ember', { gain: 3.2 }); FLARE.off = ember ? ember.material : accentMaterial('ember', { gain: 1 }); }
  const own = (n) => h.anim && h.anim.bank && h.anim.bank.has(n);
  const clip = (name, fade = 0.3) => { if (h._c8clip === name) return; h._c8clip = name; if (own(name)) h.anim.play(name, { fade }); };
  const B = {
    stage, wounds: hatGone ? 1 : 0, mode: at ? 'walk' : 'out', t: 0, i: 0, open: 0, openWhy: '', fireAt: stage === 3 ? 1.0 : 3.2, shield: null, aim: false, said: {}, hatGone,
    // ([C8] the car may stop anywhere now: his walk is the part of it ahead of him)
    path: stage === 3 ? SALOON.last : (() => { const q = SALOON.path.filter((w) => w.z > p.z + 0.5); return q.length ? q : [SALOON.path[SALOON.path.length - 1]]; })(),
  };
  if (hatGone && h.launchHat) { try { h.hatFlies = true; h.launchHat(); } catch { /* */ } }
  // (his own: not in the Game's table of brains - the director's pacing reads those)
  const ai = { h, heavy: false, brain: { kind: 'cardinal', S: { state: 'walk' } } };
  h.c8onHit = () => hit();
  // out of the car first
  if (!at && own('cardinal_carOut')) { h.anim.play('cardinal_carOut', { fade: 0 }); h._c8clip = 'cardinal_carOut'; B.t = -CARDINAL_OUT; }
  else B.mode = 'walk';
  // the shield man: a heavy before him, between us
  if (stage === 2) {
    const sh = G.spawnHood(p.x + 0.9, p.z + 1.2, { ai: false, heavy: true, variant: { coat: 1, brim: 1, tall: 1, heavy: true }, state: 'idle', hp: 250 });
    sh.scale *= 1.08; sh.object.scale.setScalar(sh.scale);
    sh.surface = (x, z) => S.surfaceY(x, z);
    sh.c8beat = ctx.beat; sh.gunKind = 'rusher';
    sh.onMove = (hh) => { if (K.active) K.resolveMan(hh); };
    B.shield = { h: sh, ai: { h: sh, heavy: true, brain: { kind: 'rusher', S: { state: 'hold' } } }, mode: 'walk', t: 0, n: 0 };
  }
  let hp0 = h.hp;
  function hit() {
    const lost = hp0 - h.hp; hp0 = h.hp;
    if (lost <= 0 || B.down) return;
    // ([C8] after the critic: the last ten seconds too - he is open only
    // after his shot there as well, no longer the whole time)
    if (B.open <= 0) {
      // the iron under his coat: a thud, no blood - not now
      G.sfx.play('c2_woodHit', h.pos.clone().setY(1.3), { k: 0.5 }, { ref: 2 });
      G.counters.c8iron = (G.counters.c8iron || 0) + 1;
      if (!B.said.iron && G.counters.c8iron >= 3) { B.said.iron = true; ctx.hud.say('Iron under his coat. Wait for it.', 3.0); }
      return;
    }
    B.wounds++;
    // (one wound an opening while he walks at the diner; in the last ten
    // seconds the opening after his shot is the time to finish it)
    if (B.stage < 3) B.open = 0;
    G.counters.c8wounds = B.wounds;
    if (B.stage === 3 && B.wounds >= 5) { fall(); return; }
    if (B.stage === 3) { stagger(0.45); return; }
    // each shows on him: the hat goes; the gun arm; a knee
    if (B.wounds === 1) { if (h.launchHat) try { h.hatFlies = true; h.launchHat(); } catch { /* */ } B.hatGone = true; stagger(0.9); }
    else if (B.wounds === 2) { stagger(1.1); B.slow = true; }
    else { B.knee = true; knee(); }
  }
  function stagger(T) {
    B.hold = T; h.speed = 0;
    if (h.stagger) h.stagger();
    G.sfx.play('grunt', h.pos.clone().setY(1.5), { f0: 70, k: 0.5, dur: 0.3 });
  }
  function knee() {
    B.hold = 1.8; h.speed = 0;
    if (own('cardinal_knee')) { h._c8clip = 'cardinal_knee'; h.anim.play('cardinal_knee', { fade: 0.12 }); }
    G.sfx.play('grunt', h.pos.clone().setY(1.2), { f0: 66, k: 0.6, dur: 0.4 });
    B.toLast = true;
  }
  function fall() {
    if (B.down) return;
    B.down = true;
    if (ember) ember.material = FLARE.off;
    const d0 = V(h.pos.x - G.eye.x, 0, h.pos.z - G.eye.z).normalize();
    G.killHood(h, d0, false, 'deathBack');
    endHat(ctx, h, { forward: false });
    if (onDown) onDown();
  }
  B.fall = fall;
  // ---- per step ----------------------------------------------------------------------------
  R.ticks.push((dt) => {
    if (B.down || !h.alive) return false;
    if (G.failing) return true;
    B.t += dt;
    B.open = Math.max(0, B.open - dt);
    ai.brain.S.state = B.open > 0 ? 'open' : B.mode;
    stepShield(dt);
    if (B.t < 0) return true;
    if (B.mode === 'out') { B.mode = 'walk'; h._c8clip = null; }
    if (B.hold > 0) { B.hold -= dt; h.speed = 0; if (B.hold <= 0) { h._c8clip = null; if (B.toLast && B.stage === 2) { B.stage = 3; B.toLast = false; B.path = SALOON.last.map((q) => q); B.i = 0; B.lastT = 0; B.fireAt = B.t + 1.0; ctx.flags.c8last = true; } } return true; }
    const e = G.eye;
    const body = K.playerBody();
    const eyeH = V(h.pos.x, h.pos.y + 1.7, h.pos.z);
    const line = K.see(eyeH, body.chest, 0.15) || K.see(eyeH, body.head, 0.15);
    B.noLine = line ? 0 : (B.noLine || 0) + dt;
    if (B.stage === 3) {
      B.lastT = (B.lastT || 0) + dt;
      if (B.lastT > 10 || (B.i >= B.path.length)) { if (onDoor) onDoor(); return false; }
    }
    // the tell, the shot, the opening after it
    // (with no line on me a while he fires anyway, into what I hide behind: that opens him too)
    // ([C8] after the critic: the rule said once - he fires into what I hide behind, and after it he is open)
    if (B.mode === 'walk' && B.t >= B.fireAt && (line || B.noLine > 4.5 || B.stage === 3) && Math.hypot(h.pos.x - e.x, h.pos.z - e.z) < 30) {
      B.mode = 'draw'; B.mt = 0; h.speed = 0; if (ember) ember.material = FLARE.on; G.sfx.play('b7_hiss', h.pos.clone().setY(1.8), { k: 0.4 }, { ref: 3 });
      if (!line && !B.said.blind && B.stage === 2) { B.said.blind = true; ctx.hud.say('He fires at the wood. After it, he’s open.', 3.0); }
    }
    if (B.mode === 'draw') {
      B.mt += dt;
      faceTo(e.x, e.z, dt, 4);
      clip('cardinal_aim', 0.25);
      h.aiming = true;
      h.lookAt(V(e.x, e.y - 0.3, e.z));
      if (B.mt > 0.55 && ember && ember.material === FLARE.on) ember.material = FLARE.off;
      if (B.mt > 1.05) {
        // the round: from his pistol at my chest - a man in the open is hit
        const tgt = body.chest.clone();
        K.hoodRound(ai, tgt, SALOON.sigma, B.stage === 3 ? SALOON.dmgLast : SALOON.dmg, { tommy: false });
        h.fire && h.fire();
        B.mode = 'after'; B.mt = 0; B.open = B.stage === 3 ? SALOON.openLast : SALOON.openAfterShot; B.openWhy = 'shot';
        G.counters.c8bossShots = (G.counters.c8bossShots || 0) + 1;
      }
      return true;
    }
    if (B.mode === 'after') {
      B.mt += dt;
      if (B.mt > (B.stage === 3 ? SALOON.openLast : SALOON.openAfterShot)) { B.mode = 'walk'; h.aiming = false; B.fireAt = B.t + (B.stage === 3 ? 2.4 : 3.6 + ctx.rng.next() * 1.2); }
      return true;
    }
    // walk at the diner; nothing hurries him
    const wp = B.path[B.i];
    if (!wp) { h.speed = 0; clip('cardinal_aim'); faceTo(e.x, e.z, dt, 3); h.lookAt(V(e.x, e.y - 0.3, e.z)); return true; }
    const d = Math.hypot(wp.x - h.pos.x, wp.z - h.pos.z);
    if (d < 0.35) { B.i++; return true; }
    faceTo(wp.x, wp.z, dt, 2.2);
    const far = Math.hypot(h.pos.x - DINER.faceX, h.pos.z) > 22;
    const pace = far ? 1.25 : B.stage === 3 ? 0.9 : B.slow ? 0.62 : 0.85;
    h.speed = pace;
    clip('cardinal_walk', 0.35);
    h.pos.x += Math.sin(h.yaw) * pace * dt; h.pos.z += Math.cos(h.yaw) * pace * dt;
    if (K.active) K.resolveMan(h);
    h.lookAt(V(e.x, e.y - 0.3, e.z));
    return true;
  });
  function faceTo(x, z, dt, k) { const y = Math.atan2(x - h.pos.x, z - h.pos.z); h.yaw += Math.atan2(Math.sin(y - h.yaw), Math.cos(y - h.yaw)) * Math.min(1, dt * k); }
  // the shield: a step before him toward me; a burst with its tell when he has me
  function stepShield(dt) {
    const Sh = B.shield;
    if (!Sh) return;
    const s = Sh.h;
    if (!s.alive) {
      if (!Sh.dropped) { Sh.dropped = true; B.open = Math.max(B.open, SALOON.openShield); B.openWhy = 'shield'; ctx.hud.say('His man is down. He’s open.', 2.2); stagger(0.6); }
      return;
    }
    if (G.failing || B.t < -0.4) return;
    Sh.t += dt;
    const e = G.eye;
    const to = V(e.x - h.pos.x, 0, e.z - h.pos.z); const L = to.length() || 1; to.divideScalar(L);
    const want = V(h.pos.x + to.x * 1.15, 0, h.pos.z + to.z * 1.15);
    const dx = want.x - s.pos.x, dz = want.z - s.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 0.08) { const sp = Math.min(1.6, dd * 3); s.pos.x += dx / dd * sp * dt; s.pos.z += dz / dd * sp * dt; s.speed = sp; if (Sh.mode === 'walk' && s.state !== 'walk' && sp > 0.4) s.setState('walk', 0.25); }
    else { s.speed = 0; if (Sh.mode === 'walk' && s.state !== 'idle') s.setState('idle', 0.3); }
    if (s.onMove) s.onMove(s);
    s.yaw = Math.atan2(e.x - s.pos.x, e.z - s.pos.z);
    s.lookAt(V(e.x, e.y - 0.3, e.z));
    const body = K.playerBody();
    const eyeS = V(s.pos.x, s.pos.y + 1.7, s.pos.z);
    const line = K.see(eyeS, body.chest, 0.15);
    if (Sh.mode === 'walk' && line && Sh.t > 2.2) { Sh.mode = 'raise'; Sh.t = 0; s.setAim(true); Sh.ai.brain.S.state = 'aim'; G.sfx.play('c2_cock', eyeS, {}, { ref: 3 }); }
    else if (Sh.mode === 'raise' && Sh.t > 0.7) { Sh.mode = 'fire'; Sh.t = 0; Sh.n = 0; Sh.ai.brain.S.state = 'fire'; }
    else if (Sh.mode === 'fire' && Sh.t > 0.11) {
      Sh.t = 0; Sh.n++;
      K.hoodRound(Sh.ai, body.chest.clone(), 0.03 + Sh.n * 0.005, 9, { tommy: true });
      s.fire();
      if (Sh.n >= 7) { Sh.mode = 'walk'; Sh.t = -0.6; s.setAim(false); Sh.ai.brain.S.state = 'hold'; }
    }
  }
  B.h = h;
  return B;
}

// a car going up near him: down, and open (the street's own weapon)
export function blastNear(B, at) {
  if (!B || B.down || !B.h) return;
  const d = Math.hypot(B.h.pos.x - at.x, B.h.pos.z - at.z);
  if (d > 7.5) return;
  B.hold = 1.6; B.open = SALOON.openBlast; B.openWhy = 'blast';
  if (B.h.stagger) B.h.stagger();
}

export { DINER, rebuild };
