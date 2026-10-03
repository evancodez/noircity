import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { roomAs, carry, office, stand, sheetOf, inkPrompt, doorsUse, V } from './office/room.js';
import { padPuzzle } from './office/pad.js';
import { safePuzzle, safeDemo } from './office/safe.js';
import { search } from './office/search.js';
import { CHECK_PUZZLE, layCheckWhole, clearCheck } from './office/check.js';
import { live, holdSheet } from './office/hands.js';
import { DOOR, PAD, DESK, SAFE, OUTER, OPEN, PICTURE_ASIDE } from '../stages/office/plan.js';
import { HAND_POSES as HP } from '../player/handPoses.js';

// Chapter III, Room 304 ([C5] wave C, docs/story/briefs/C5_OFFICE.md). The
// Harbor Building's third floor, night. I come up in the lift to see Ames
// and I am too late. Beats:
//   corridor  out of the lift, up the corridor to his frosted door: the lock
//             splintered, I push it in and it swings shut behind me on its
//             closer; the outer office
//   room      through the opening: Ames dead at his desk. The search, in any
//             order (office/search.js): the lamp's chain, the key on him, the
//             pencil in his locked drawer, the pad shaded (office/pad.js),
//             the picture on its hinge, the dial (office/safe.js), the envelope
//   pad, safe (cold starts only: the pad with the pencil in my pocket; the
//             dial with the sheet in my hand)
//   check     the torn check pieced together on his desk under the lamp
//             (office/check.js); the stills, DOT'S HAND.
//   done      Pier 9. As I turn to go: the shadows (chapter IV in this room)
// No fail: it never leaves me stuck (a stall: the room points, search.js).
// Query: ?scene=office&beat=<b>  (&demo=1: the pad rubs / the dial turns on their own)
const Q = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams(''));
const EAST = -Math.PI / 2;

export default defineScene({
  id: 'office', stage: 'office',
  beats: ['corridor', 'room', 'pad', 'safe', 'check', 'done'],
  save: ['room', 'check'],
  objectives: {
    corridor: 'Room 304. Ames.', room: 'Find what Ames had.', pad: 'Find what Ames had.', safe: 'Open the safe.',
    check: 'Lay it out on his desk.', done: 'Pier 9.',
  },

  setup: {
    corridor(ctx) {
      carry(ctx);
      roomAs(ctx, 'found');
      const a = ctx.stage.anchor('office.corridor.start');
      stand(ctx, a.pos.x, a.pos.z, a.yaw, 0.02);
    },
    room(ctx) {
      carry(ctx);
      roomAs(ctx, 'found');
      // (in the opening from the outer office: him at his desk in the slats' light)
      stand(ctx, 0.35, 3.55, EAST + 0.05, -0.12);
    },
    pad(ctx) {
      carry(ctx);
      const O = roomAs(ctx, 'found');
      const F = ctx.flags.s = { lamp: true, ames: true, key: true, pencil: true, dents: true, ash: true, picture: false, envelope: false, checked: false, progressT: ctx.game.time, tried: {} };
      void F;
      O.setLamp(true); O.pad.api.setLit(true);
      const R1 = O.desk.drawers.find((d) => d.id === 'R1');
      R1.locked = false; R1.out = R1.target = 1; R1.group.position.x = DESK.d / 2 + R1.max;
      if (O.pencil.parent) O.pencil.parent.remove(O.pencil);
      O.pencil.visible = false;
      const a = ctx.stage.anchor('office.desk');
      stand(ctx, a.pos.x, a.pos.z, a.yaw, -0.55);
      ctx.flags.openPad = true;
    },
    safe(ctx) {
      carry(ctx);
      const O = roomAs(ctx, 'found');
      ctx.flags.s = { lamp: true, ames: true, key: true, pencil: true, dents: true, ash: true, picture: true, envelope: false, checked: false, progressT: ctx.game.time, tried: {} };
      O.setLamp(true);
      const R1 = O.desk.drawers.find((d) => d.id === 'R1');
      R1.locked = false; R1.out = R1.target = 1; R1.group.position.x = DESK.d / 2 + R1.max;
      if (O.pencil.parent) O.pencil.parent.remove(O.pencil);
      giveSheet(ctx, O, true);
      O.picture.angle = O.picture.target = PICTURE_ASIDE; O.picture.hang.rotation.y = -PICTURE_ASIDE; O.picture.swinging = false;
      const a = ctx.stage.anchor('office.safe');
      stand(ctx, a.pos.x, a.pos.z, a.yaw, -0.1);
      ctx.flags.openSafe = true;
      ctx.flags.padDone = true;
    },
    check(ctx) {
      carry(ctx);
      const O = roomAs(ctx, 'open');
      ctx.flags.s = { lamp: true, ames: true, key: true, pencil: true, dents: true, ash: true, picture: true, envelope: true, checked: false, progressT: ctx.game.time, tried: {} };
      ctx.flags.padDone = true; ctx.flags.safeDone = true;
      void O;
      stand(ctx, DESK.x - DESK.d / 2 - 0.55, 3.4, EAST + Math.PI, -0.5);
    },
    done(ctx) {
      carry(ctx, { armed: true });
      roomAs(ctx, 'open');
      ctx.flags.s = { lamp: true, ames: true, key: true, pencil: true, picture: true, envelope: true, checked: true, progressT: ctx.game.time, tried: {} };
      ctx.flags.padDone = true; ctx.flags.safeDone = true;
      stand(ctx, DESK.x - DESK.d / 2 - 0.55, 3.4, EAST + Math.PI, -0.3);
    },
  },

  *script(ctx) {
    const { game: G, hands: H, controller: C } = ctx;
    const O = office(ctx);
    const F = ctx.flags;
    const demo = Q().get('demo') === '1';
    inkPrompt(ctx);
    G.puzzles.define(CHECK_PUZZLE);
    const pad = F.pad = padPuzzle(ctx);
    const safe = F.safe = safePuzzle(ctx);
    if (F.padDone) pad.done = true;
    if (F.safeDone) safe.opened = true;
    const S = F.search = search(ctx, pad, safe);
    const st = S.state;
    doorsUse(ctx);
    // (the gate below the stair and the corridor's offices answer; the suite's door has its closer)
    ctx.onStep((dt) => {
      pad.step(dt); safe.step(dt); S.step(dt);
      // the torn sheet in my left hand: at the frame's lower left, higher at the dial (to be read beside it)
      if (O.sheet && H.held.L === O.sheet && (!H.clips[0] || H.clips[0].done || H.clips[0].name !== 'b2_tear')) {
        const at = safe.active ? { pos: [-0.215, -0.1, -0.6], face: [0.24, 0.12, 1], foot: [-0.06, -1, 0.1] } : {};
        if (safe.opened) { F.stow = Math.min(1, (F.stow || 0) + 1 / 60 / 0.45); at.down = F.stow; }
        holdSheet(H, O.sheet, at);
        if (F.stow >= 1) { H.hold(null, 'L', { keep: true }); if (O.sheet.parent) O.sheet.parent.remove(O.sheet); O.sheet = null; live(H, {}); G.sfx.play('pocket'); return; }
        if (!H.still || H.still.L !== HP.b2liveL) live(H, { R: H.still && H.still.R ? 'b2liveR' : null, L: 'b2liveL' });
      }
      // the pad done: the sheet in my left hand from here
      if (pad.done && pad.tore && !F.gaveSheet) { F.gaveSheet = true; giveSheet(ctx, O, false); S.touch(); }
      if (safe.stage !== F.lastStage) { F.lastStage = safe.stage; S.touch(); }
    });

    // ---- 1. the corridor: out of the lift, to his door -----------------------------------------
    if (ctx.at('corridor') && ctx.beat === 'corridor') {
      yield beat('corridor');
      ctx.music.cue('office', { fade: 2.5 });
      // (the suite's door: the lock splintered, it gives at a push - E, or walking into it)
      const D = O.door;
      D.closer = true;
      yield until(() => D.open01 > 0.3 || G.eye.x > OUTER.x0 + 0.3);
      // in the outer office: the door draws itself shut behind me on its closer
      yield until(() => G.eye.x > OUTER.x0 + 0.6);
      // through the opening into his room: him
      yield until(() => G.eye.x > -0.35 && G.eye.z > OPEN.z0 - 0.4 && G.eye.z < OPEN.z1 + 0.4);
    }

    // ---- 2. the room: the search, in any order ------------------------------------------------
    if (ctx.at('room') || ctx.beat === 'pad' || ctx.beat === 'safe') {
      if (ctx.beat === 'corridor') yield beat('room');
      else if (ctx.beat === 'room') yield beat('room');
      if (F.openPad) pad.open();
      if (F.openSafe) safe.open();
      if (demo && F.openPad) pad.demo = true;
      if (demo && F.openSafe) { safe.demo = safeDemo(safe); safe.demoOpen = true; }
      if (O.picture.target > 0.5 && !safe.opened) ctx.hud.objective('Open the safe.');
      yield until(() => st.envelope);
      yield beat('check');
    }

    // ---- 3. the check: the pieces on his desk under the lamp ------------------------------------
    if (ctx.at('check') && !st.checked) {
      if (ctx.beat !== 'check') yield beat('check');
      if (!O.lampOn) O.setLamp(true);
      let solved = false;
      // (the pad pushed aside off the blotter: the pieces go down in the lamp's pool)
      // (and the lamp eased down for the close look, as at the pad: a hand's length from the bulb its pool printed the blotter white)
      const padAside = (on) => { O.pad.block.visible = !on; O.pad.mesh.visible = !on; O.lampDimTo = on ? 1 : 0; };
      ctx.onStep(() => { if (!G.puzzles.active && O.lampDimTo > 0 && !(F.pad && F.pad.active)) O.lampDimTo = 0; else if (G.puzzles.active) O.lampDimTo = 1; });
      // ([C5] after the critic: the pieces go down with the kit's cards - the drag, then the turn: a join needs a piece
      // turned to within 14 degrees, and nothing said how until the second idle hint)
      const lay = () => {
        if (G.puzzles.active) return;
        padAside(true); G.puzzles.open('office.check', { onSolved: () => { solved = true; } });
        ctx.hud.objective('Piece it together.');
        if (G.hud.teach) { G.hud.teach('piece', '[LMB] drag a piece', { until: 'Mouse0' }); G.hud.teach('turnPiece', '[RMB] hold to turn it', { until: 'Mouse2', secs: 4 }); }
      };
      // (opened a step after the E that asked for it: the puzzle reads E as "step back")
      let layNext = false;
      ctx.onStep(() => { if (layNext && !G.pressed('KeyE')) { layNext = false; lay(); } });
      ctx.interact.add({ id: 'lay', at: V(PAD.x, DESK.h + 0.02, PAD.z), range: 1.8, cone: 0.6, prompt: 'lay them out', when: () => !solved && !G.puzzles.active && !layNext, onUse: () => { layNext = true; G.sfx.play('c5_envelope', V(PAD.x, DESK.h, PAD.z)); } });
      if (Q().get('whole') === '1') { lay(); layCheckWhole(F.checkSt); }
      yield until(() => solved);
      st.checked = true;
      clearCheck(F.checkSt);
      // the stills: her hand; she sent him to them
      const h = G.stills.play('check');
      yield until(() => h.done);
      const inv = ctx.save.inventory;
      if (!inv.includes('check')) inv.push('check');
      ctx.save.flags.note = 'PIER 9';
      G.sfx.play('pocket');
      yield beat('done');
    }

    // ---- 4. done: Pier 9. As I turn to go - the shadows (IV, in this room) ------------------------
    if (ctx.at('done')) {
      if (ctx.beat !== 'done') yield beat('done');
      let t = 0;
      const yaw0 = C.yaw;
      yield until(() => { t += 1 / 60; return t > 6 || (t > 1.2 && Math.abs(Math.atan2(Math.sin(C.yaw - yaw0), Math.cos(C.yaw - yaw0))) > 0.6) || C.vel.length() > 0.6; });
      // chapter IV in the same room, its card small over the picture: no black
      ctx.next({ fade: 'cut', keep: true, card: true });
    }
  },

  // the autoplay driver: a human moment at each prompt
  auto(ctx, A) {
    if (A.prompting() || ctx.game.inspect.active) A.pressAfter('KeyE', 1.0, 2.0);
  },
});

// the torn sheet in my left hand, its face at the frame's edge
function giveSheet(ctx, O, fresh) {
  const H = ctx.hands;
  if (fresh || !O.sheet) {
    if (fresh) O.pad.api.rubbedAll();
    O.sheet = sheetOf(O);
    if (fresh) O.pad.api.reset();
    ctx.stage.scene.add(O.sheet);
  }
  if (H.held.L !== O.sheet) H.hold(O.sheet, 'L');
  live(H, { R: H.still && H.still.R ? 'b2liveR' : null, L: 'b2liveL' });
  void SAFE; void PAD; void DOOR; void THREE;
}
