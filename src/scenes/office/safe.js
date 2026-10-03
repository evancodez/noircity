import * as THREE from 'three';
import { palm } from '../../player/handPoses.js';
import { SAFE, COMBO } from '../../stages/office/plan.js';
import { live, setLive, palmOn } from './hands.js';
import { office, V } from './room.js';

// Puzzle E, the safe (lane B2's brief): the dial turned by the mouse, my
// fingers on its knob. Right to the first number, left to the second,
// right to the third - by feel: every number ticks; at the right one, turned
// the right way, the click is louder and lower, the dial twitches under
// the fingers and the view gives the smallest kick (the lever has dropped
// into the wheel's gate). Turn back while the gate holds (up to three past
// it) and that number is set; turn back anywhere else and it clacks dull:
// that number is to find again - the ones already set stay set. The third
// is set by resting on it. Then the handle; the door's weight.
//   const S = safePuzzle(ctx); S.open(); each step S.step(dt); S.cracked; S.close()
// The numbers are on the sheet in my left hand, at the frame's edge.
const PER_PX = 0.075;          // numbers per pixel of mouse (a turn ~1300 px)
const GATE = 3;                // how far past the number the gate still holds
const DIRS = [-1, 1, -1];      // right (the reading falls), left, right

export function safePuzzle(ctx) {
  const G = ctx.game, H = ctx.hands, C = ctx.controller, O = office(ctx);
  const safe = O.safe;
  const S = {
    active: false, cracked: false, opened: false, stage: 0, reading: safe.dial || 0, dir: 0, run: 0, swing: 0, lastN: null,
    gate: -1, rest: 0, twitch: 0, grip: 0, regrip: 0, demo: null,
    open() {
      if (S.active) return;
      // [R3] (the E that stepped back from the dial is the press that would open it again: see pad.js)
      if (G.time - (S.closedAt ?? -9) < 0.25) return;
      S.active = true;
      S.prevPose = C.eyePose();
      // the eye before the dial, a little above it, close
      const c = safe.centre;
      // ([C5] closer, the lens narrower: the dial's figures read at a glance, the sheet held up beside it)
      const pose = { x: c.x + 0.02, y: c.y + 0.07, z: c.z + 0.5, yaw: 0.04, pitch: -0.13 };
      C.setMode('table', { pose, fov: 36, ease: 0.45 });
      live(H, { R: 'b2liveR', L: O.sheet ? 'b2liveL' : null });
      S.place();
      if (!S.taught) { S.taught = true; G.hud.prompt('MOUSE  turn the dial', null, 'safe'); S.teachT = 3.2; }
    },
    // the fingers on the knob: the hand to its right, index and thumb round
    // the rim; the wrist turns with the dial, and re-grips past 50 degrees
    place() {
      const c = safe.centre;
      const a = -S.grip;                      // (the hand's own turn about the dial's axis)
      const ca = Math.cos(a), sa = Math.sin(a);
      const rot = (x, y) => [x * ca - y * sa, x * sa + y * ca];
      // (the palm to the right of the knob, facing the wall; the fingers
      // pointing left along the dial's face to its rim, index over, thumb under)
      const [ox, oy] = rot(0.078, -0.02);
      const at = V(c.x + ox, c.y + oy, c.z + 0.075);
      const [nx, ny] = rot(-0.3, 0.05);
      const [fx, fy] = rot(-1, 0.22);
      const root = H.vm.root; root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const p = at.clone().applyMatrix4(inv);
      const n = V(nx, ny, -1).normalize().transformDirection(inv);
      const f = V(fx, fy, -0.1).normalize().transformDirection(inv);
      const lift = S.regrip > 0 ? Math.sin(Math.PI * (1 - S.regrip / 0.16)) * 0.012 : 0;
      p.addScaledVector(V(0, 0, 1).transformDirection(inv), lift);
      setLive('R', palm('cam', p.toArray(), n.toArray(), f.toArray(),
        { i: [0.55, 0.75, 0.4, -0.05], m: [0.7, 0.9, 0.5, 0], r: [0.95, 1.1, 0.6, 0.02], l: [1.05, 1.15, 0.6, 0.06], t: [0.7, 0.3, 0.6, 0.35, 0.35] }, [0.3, -0.45, 0.05]));
    },
    // the dial by the mouse, the gates, the clicks
    step(dt) {
      if (!S.active) return;
      if (S.teachT > 0 && (S.teachT -= dt) <= 0) G.hud.clearPrompt('safe');
      const dx = S.demo ? S.demo(dt) : G.mouse.dx;
      const d = -dx * PER_PX;                       // (mouse right: turn right: the reading falls)
      if (!S.cracked) S.turn(d, dt);
      // (once, a line: the order of the turns; the sheet has the numbers)
      S.inT = (S.inT || 0) + dt;
      // [R3] (the line is 42 characters at most: the long one was a warning in the log)
      if (!S.cracked && S.stage === 0 && S.inT > 28 && !S.hinted) { S.hinted = true; G.hud.say('Right to the first. Left. Right again.', 3.5); }
      S.twitch *= Math.exp(-dt * 30);
      safe.dial = S.reading;
      // (the face's figures sit a quarter turn round on its disc: 75 is at the index at rest)
      safe.dialG.rotation.z = ((S.reading - 75) / 100) * Math.PI * 2 + S.twitch;
      // the hand's grip follows the turn; past 50 degrees it lets go and takes the knob again
      if (S.regrip > 0) { S.regrip -= dt; S.grip *= Math.exp(-dt * 25); }
      else if (Math.abs(S.grip) > 0.9) S.regrip = 0.16;
      // (the handle: the hand goes from the dial to it, turns it with it, pulls
      // the door round by it, and lets go as the door swings on its weight -
      // never left in the air where the dial was)
      if (S.opening) {
        if (S.opening.t < 1.0) S.placeHandle();
        else if (!S.opening.let) { S.opening.let = true; live(H, { R: null, L: O.sheet ? 'b2liveL' : null }); }
      } else S.place();
      if (S.cracked && !S.opened) {
        if (!S.handlePrompt) { S.handlePrompt = true; G.hud.prompt('E  the handle', G.screenOf(safe.handleG.getWorldPosition(V(0, 0, 0))), 'safe'); }
        if (G.pressed('KeyE') || S.demoOpen) S.openDoor();
      }
      if (S.opening) S.stepDoor(dt);
      if (!S.cracked && G.pressed('KeyE') && !S.demo) S.close();
    },
    turn(d, dt) {
      if (Math.abs(d) < 1e-6) {
        // resting: the last number is set by resting on it in its gate
        S.rest += dt;
        if (S.stage === 2 && S.gate === 2 && S.rest > 0.35) S.set();
        return;
      }
      S.rest = 0;
      const sgn = Math.sign(d);
      // (a turn back: the way it goes changes only past a little slack)
      if (sgn !== S.dir) {
        S.swing += Math.abs(d);
        if (S.swing > 0.6 || S.dir === 0) { S.reverse(sgn); S.swing = 0; }
      } else S.swing = 0;
      const r0 = S.reading;
      S.reading = ((S.reading + d) % 100 + 100) % 100;
      S.run += Math.abs(d);
      S.grip += d * (Math.PI * 2 / 100);
      // every number the index passes: a tick; the right one, the right way: the gate
      // (a quick turn passes several in a step: each is counted)
      // ([C5] after the critic: a number is reached when the reading comes to it - rounds to it - not once it has
      // passed it: the index stopped on 36, reading 36.03 from above, set nothing. So the crossings counted are
      // each number's half a step before it, the way the dial turns)
      const u0 = r0 + 0.5 * sgn, u1 = r0 + d + 0.5 * sgn;
      const lo = Math.ceil(Math.min(u0, u1)), hi = Math.floor(Math.max(u0, u1));
      let ticked = false;
      for (let m = lo; m <= hi; m++) {
        if (m === u0) continue;
        const n = ((m % 100) + 100) % 100;
        const want = COMBO[S.stage];
        if (S.stage < 3 && n === want && S.dir === DIRS[S.stage]) {
          S.gate = S.stage;
          S.gateAt = n;
          G.sfx.play('office_dialClick', safe.centre);
          S.twitch = 0.035 * -sgn;
          C.kick(0.22, 0.25, 0.07);
        } else if (!ticked) { ticked = true; G.sfx.play('office_dialTick', safe.centre, { k: 0.7 + 0.3 * Math.random() }); }
      }
      // (past the gate by more than a few: it has let go)
      if (S.gate === S.stage && S.gate >= 0) {
        const off = Math.abs(((S.reading - S.gateAt + 150) % 100) - 50);
        if (off > GATE) S.gate = -1;
      }
    },
    reverse(sgn) {
      const was = S.dir;
      S.dir = sgn;
      if (was === 0) { S.run = 0; return; }
      // turning back in the gate of the number being found: it is set
      if (S.gate === S.stage && was === DIRS[S.stage]) S.set();
      else if (S.run > 5) G.sfx.play('office_dialWrong', safe.centre);
      S.run = 0;
    },
    set() {
      S.stage++;
      S.gate = -1;
      if (S.stage >= 3) {
        S.cracked = true;
        G.sfx.play('office_dialClick', safe.centre);
        G.hud.clearPrompt('safe');
      }
      ctx.flags.safeStage = S.stage;
    },
    // the palm on the T's right arm, the fingers round it
    placeHandle() {
      const hg = safe.handleG;
      hg.updateMatrixWorld(true);
      const p = hg.localToWorld(V(0.052, -0.012, 0.058));
      palmOn(H, 'R', p, V(-0.25, 0.35, -1).normalize().transformDirection(hg.matrixWorld), V(0.1, -1, 0).transformDirection(hg.matrixWorld),
        { i: [0.9, 1.1, 0.6, -0.03], m: [0.95, 1.15, 0.6, 0], r: [1.0, 1.2, 0.6, 0.02], l: [1.05, 1.2, 0.6, 0.05], t: [0.6, 0.3, 0.4, 0.3, 0.3] }, [0.3, -0.5, 0.05]);
    },
    // the handle down, the bolts back, the door's weight
    openDoor() {
      if (S.opening) return;
      S.opening = { t: 0 };
      // (from the dial's knob down to the handle: a short blend, not a jump)
      H.snapshot(0.16);
      G.hud.clearPrompt('safe');
      G.sfx.play('office_safeHandle', safe.centre);
    },
    stepDoor(dt) {
      const Q = S.opening;
      Q.t += dt;
      safe.handle = Math.min(1, Q.t / 0.35);
      safe.handleG.rotation.z = -safe.handle * 1.1;
      if (Q.t > 0.45 && !Q.swung) { Q.swung = true; G.sfx.play('office_safeDoor', safe.centre); }
      const u = Math.max(0, Math.min(1, (Q.t - 0.45) / 1.35));
      // (heavy: slow to start, it swings on under its own weight)
      const e = u * u * (3 - 2 * u);
      safe.open = e;
      safe.hinge.rotation.y = -1.9 * e;
      if (u >= 1 && !S.opened) { S.opened = true; S.close(); }
    },
    close() {
      if (!S.active) return;
      S.active = false;
      S.closedAt = G.time;   // [R3]
      G.hud.clearPrompt('safe');
      live(H, { R: null, L: O.sheet ? 'b2liveL' : null });
      const back = S.prevPose || C.eyePose();
      C.setMode(ctx.flags.walkMode || 'walk');
      C.ease({ ...back, pitch: Math.max(-0.5, back.pitch) }, 0.45);
    },
  };
  void SAFE;
  return S;
}

// (strips and shots: a hand that knows the numbers - right past the first
// to its gate, back, left to the second, back, right to the third, rest)
export function safeDemo(S) {
  const plan = [];
  let r = S.reading;
  const go = (to, dir) => { let d = dir < 0 ? (r - to + 100) % 100 : (to - r + 100) % 100; if (d < 8) d += 100; plan.push({ n: d + 1.2, dir }); r = to + dir * 1.2; };
  const COMBO_ = [36, 12, 57];
  go(COMBO_[0], -1); go(COMBO_[1], 1); go(COMBO_[2], -1);
  let i = 0, left = null;
  return (dt) => {
    const P = plan[i];
    if (!P) return 0;
    if (left == null) left = P.n;
    // (a hand's speed: quick far off, slow near the number)
    const v = Math.max(3, Math.min(40, left * 1.4)) * dt;
    const step = Math.min(v, left);
    left -= step;
    if (left <= 1e-6) { i++; left = null; }
    // (px of mouse: the reading moves -dx * PER_PX)
    return -(P.dir * step) / PER_PX;
  };
}
