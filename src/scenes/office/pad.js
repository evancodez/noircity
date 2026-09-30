import * as THREE from 'three';
import { palm, OPEN } from '../../player/handPoses.js';
import { PAD, DESK } from '../../stages/office/plan.js';
import { live, holdAt, setLive, toCam, place } from './hands.js';
import { office, sheetOf, V } from './room.js';

// Puzzle D, the pad (lane B2's brief): the top sheet is gone; the pencil's
// side rubbed across the next one brings up what was written on it. The
// view looks down on the pad from the chair's side of the desk; the pencil
// is in my right hand, its lead's side on the paper where the mouse puts
// it; LMB held presses it down and every move then lays graphite. My left
// hand holds the pad's corner. When enough of the numbers reads: a beat,
// and the sheet comes off into my left hand.
//   const P = padPuzzle(ctx); P.open(); each step P.step(dt); P.done; P.close()
// (a demo driver for strips and shots: P.demo = true scrubs on its own)
const _w = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3();
const TOP = DESK.h + 0.0215;

export function padPuzzle(ctx) {
  const G = ctx.game, H = ctx.hands, C = ctx.controller, O = office(ctx);
  const pad = O.pad.api;
  const P = {
    active: false, done: false, solvedT: -1, tore: false, demo: false, taught: false,
    tip: V(PAD.x + 0.03, TOP, PAD.z - 0.02), prev: null, press: 0, lift: 0.012, idle: 0, checkT: 0, shown: 0,
    rubT: 0, strokes: 0, ph: 0,
    open() {
      if (P.active || P.done) return;
      P.active = true;
      P.prevPose = C.eyePose();
      // the eye over the pad from the chair's side, looking down on it
      const pose = { x: PAD.x + 0.44, y: DESK.h + 0.56, z: PAD.z + 0.03, yaw: Math.PI / 2, pitch: -1.02 };
      C.setMode('table', { pose, fov: 52, ease: 0.45 });
      // the pencil from the blotter into my hand (it goes where the hand takes it)
      const pc = O.pencil;
      H.equip('empty');
      H.hold(pc, 'R');
      // the left hand flat on the pad's far left corner, holding it still
      live(H, { R: 'b2liveR', L: 'b2liveL' });
      P.leftHand();
      P.place(0);
      G.sfx.play('office_pencilPick', O.pencilAt);
      if (!P.taught) { P.taught = true; G.hud.prompt('LMB  hold and rub', null, 'pad'); P.teachT = 3.5; }
    },
    // the left hand on the pad (palm down on its far left corner, fingers away)
    leftHand() {
      const at = V(PAD.x - 0.07, TOP + 0.004, PAD.z + 0.1);
      const m = toCam(H, place(at, V(0, 1, 0), V(-1, 0, 0.3)));
      const p = V().setFromMatrixPosition(m);
      const n = V(0, -1, 0).transformDirection(m.clone().setPosition(0, 0, 0)).normalize();
      void n;
      // (palm(): the palm's surface point, the way it faces, the fingers' way - in the eye's frame)
      const root = H.vm.root; root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const down = V(0, -1, 0).transformDirection(inv);
      const fwd = V(-0.85, 0, 0.5).normalize().transformDirection(inv);
      const pose = palm('cam', [-p.x, p.y, p.z], [-down.x, down.y, down.z], [-fwd.x, fwd.y, fwd.z], { ...OPEN, i: [0.12, 0.15, 0.1, -0.06], l: [0.2, 0.25, 0.15, 0.12], t: [0.35, 0.3, 0.1, 0.1, 0.1] }, [0.26, -0.5, 0.0]);
      setLive('L', pose);
    },
    // the pencil at the tip: its lead's side down on the paper (or lifted),
    // its length laid low, the point away and a little left; the hand on it
    place(dt) {
      const pc = O.pencil;
      const lift = P.lift * (1 - P.press);
      // (a scrubbing hand rolls the pencil a little with the stroke)
      const roll = Math.sin(P.ph) * 0.05 * P.press;
      const axis = V(-0.86, -0.26, 0.42).normalize();
      const up = V(0.18 + roll, 1, 0.12).normalize();
      // the lead's flank (local (0, 0.0006, 0.073)) on the tip
      const M = place(V(0, 0, 0), up, axis);
      const off = V(0, 0.0006, 0.073).applyMatrix4(new THREE.Matrix4().extractRotation(M));
      M.setPosition(_w.copy(P.tip).setY(TOP + lift).sub(off));
      holdAt(H, 'R', pc, M, { i: [0.35, 0.45, 0.25, -0.03], m: [0.55, 0.7, 0.4, 0], r: [0.8, 0.95, 0.5, 0], l: [0.9, 1.0, 0.5, 0.05], t: [0.55, 0.35, 0.55, 0.25, 0.3] }, [0.3, -0.5, -0.05]);
      void dt;
    },
    // the sheet's canvas coordinates of a point on it
    uv(p) { return [0.5 - (p.z - PAD.z) / PAD.w, 0.5 + (p.x - PAD.x) / PAD.d]; },
    step(dt) {
      if (!P.active) return;
      if (P.teachT > 0 && (P.teachT -= dt) <= 0) G.hud.clearPrompt('pad');
      // the mouse moves the pencil over the sheet (right: -z, up the sheet: -x)
      const m = G.mouse;
      let dx = m.dx, dy = m.dy, down = G.held('Mouse0');
      if (P.demo) { const d = P.demoStep(dt); dx = d[0]; dy = d[1]; down = d[2]; }
      const k = 0.00042;
      P.prev = (P.prev || P.tip.clone()).copy(P.tip);
      if (P.solvedT < 0) {
        P.tip.z -= dx * k; P.tip.x += dy * k;
        P.tip.x = Math.max(PAD.x - PAD.d / 2 - 0.02, Math.min(PAD.x + PAD.d / 2 + 0.02, P.tip.x));
        P.tip.z = Math.max(PAD.z - PAD.w / 2 - 0.03, Math.min(PAD.z + PAD.w / 2 + 0.03, P.tip.z));
      }
      // pressing: down in 0.06 s, up in 0.1
      P.press = down && P.solvedT < 0 ? Math.min(1, P.press + dt / 0.06) : Math.max(0, P.press - dt / 0.1);
      const moved = _d.subVectors(P.tip, P.prev).length();
      if (P.press > 0.6 && moved > 1e-5) {
        const [u0, v0] = P.uv(P.prev), [u1, v1] = P.uv(P.tip);
        pad.rub(u0, v0, u1 - u0, v1 - v0, P.press);
        P.ph += moved * 90;
        P.strokes += moved;
        // the sound of it: a grain a step while it moves, as loud as it is fast
        P.rubT -= dt;
        if (P.rubT <= 0) { P.rubT = 0.06; G.sfx.play('office_pencilRub', P.tip, { k: Math.min(1, moved * 60), f: Math.min(1, moved * 40), dur: 0.09 }); }
        P.idle = 0;
      } else P.idle += dt;
      pad.flush();
      P.place(dt);
      // what reads (measured four times a second)
      P.checkT -= dt;
      if (P.checkT <= 0 && P.solvedT < 0) {
        P.checkT = 0.25;
        P.shown = pad.shown();
        if (P.shown > 0.58) { P.solvedT = 0; G.sfx.play('office_paperRustle', P.tip, { k: 0.3 }); }
      }
      if (P.solvedT >= 0) {
        P.solvedT += dt;
        // (the beat: the pencil lifts, the numbers are read; then the tear)
        if (P.solvedT > 0.9 && !P.tore) P.tear();
      }
      if (P.tore && P.tearH && P.tearH.done) P.finish();
      // E steps back from the desk (the rubbing kept)
      if (!P.tore && P.solvedT < 0 && G.pressed('KeyE') && !P.demo) P.close();
    },
    // the sheet off the pad into my left hand
    tear() {
      P.tore = true;
      const sheet = sheetOf(O);
      O.sheet = sheet;
      // (it lies where the pad's top sheet lies; the hand closes on its edge there)
      const at = place(V(PAD.x, TOP + 0.001, PAD.z), V(0, 1, 0), V(1, 0, 0));
      ctx.stage.scene.add(sheet);
      sheet.position.setFromMatrixPosition(at);
      sheet.quaternion.setFromRotationMatrix(at);
      sheet.updateMatrixWorld(true);
      holdAt(H, 'L', sheet, at.clone(), { i: [0.25, 0.3, 0.15, 0], m: [0.3, 0.35, 0.18, 0], r: [0.4, 0.45, 0.22, 0], l: [0.5, 0.5, 0.25, 0], t: [0.7, 0.3, 0.5, 0.15, 0.1] }, [-0.26, -0.5, -0.1]);
      H.hold(sheet, 'L');
      // (the pencil down on the pad as the left hand takes the sheet)
      P.press = 1;
      P.place(0);
      H.hold(null, 'R');
      live(H, { R: null, L: null });
      P.tearH = H.play('b2_tear', { onMark: { tear: () => { G.sfx.play('office_sheetTear', V(PAD.x, TOP, PAD.z)); pad.reset(); } } });
    },
    finish() {
      P.done = true;
      live(H, { R: null, L: 'b2sheetL' });
      P.close();
    },
    close() {
      if (!P.active) return;
      P.active = false;
      G.hud.clearPrompt('pad');
      if (!P.tore) {
        // the pencil back down on the blotter
        P.press = 1; P.place(0);
        H.hold(null, 'R');
        live(H, {});
      }
      const back = P.prevPose || C.eyePose();
      C.setMode(ctx.flags.walkMode || 'walk');
      C.ease({ ...back, y: back.y, pitch: Math.max(-0.5, back.pitch) }, 0.45);
    },
    // (strips and shots: a hand scrubbing back and forth across the numbers)
    demoStep(dt) {
      P.dT = (P.dT || 0) + dt;
      const t = P.dT;
      const sweep = Math.sin(t * 7.5) * 26;          // side to side (px of mouse)
      const creep = t < 0.3 ? -30 : 2.2;              // up the sheet slowly
      return [sweep, creep, t > 0.3];
    },
  };
  return P;
}
