import { defineScene, wait, until, beat } from '../game/script.js';
import { roomAs, carry, office, stand, roomLines, sheetOf, V } from './office/room.js';
import { padPuzzle } from './office/pad.js';
import { safePuzzle, safeDemo } from './office/safe.js';
import { live, holdSheet, palmOn } from './office/hands.js';
import { DOOR, PAD, DESK, SAFE, PICTURE } from '../stages/office/plan.js';
import { HAND_POSES as HP } from '../player/handPoses.js';

// Scene 4, Room 304 (lane B2's brief; STORY.md). The Harbor Building, the
// third floor, night. Beats:
//   corridor  out of the dark end by the lift toward 304's lit glass; the
//             door ajar, the lock splintered: it swings in at a touch (my
//             hand on it)
//   room      the room turned over once already; the slats' light across
//             it; what can be used shows itself in the light (the pad under
//             the lamp, the picture hung crooked); the drawers, the coat,
//             the cooler answer E with a line or none
//   pad       puzzle D: the pencil's side across the next sheet; three
//             numbers come up white; the sheet into my left hand
//   safe      the picture swung aside on its wire; puzzle E: the dial by
//             feel (the numbers on the sheet at the frame's edge)
//   ledger    E take: held up and opened (red, columns, the black bird by
//             the big sums), inside my coat; then scene 5 in the same room
// Query: ?scene=office&beat=<b>&t=  (&demo=1: the pad rubs / the dial turns
// on their own, for strips)
const Q = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams(''));

export default defineScene({
  id: 'office', stage: 'office',
  beats: ['corridor', 'room', 'pad', 'safe', 'ledger'],
  save: ['room', 'pad', 'safe', 'ledger'],

  setup: {
    corridor(ctx) {
      carry(ctx);
      roomAs(ctx, 'found');
      const a = ctx.stage.anchor('office.corridor.start');
      stand(ctx, a.pos.x, a.pos.z, a.yaw, 0.02);
    },
    room(ctx) {
      carry(ctx);
      const O = roomAs(ctx, 'found');
      O.setDoor(1.45);
      stand(ctx, 0.55, 1.1, -Math.PI / 2 + 0.25, -0.08);
    },
    pad(ctx) {
      carry(ctx);
      const O = roomAs(ctx, 'found');
      O.setDoor(1.45);
      const a = ctx.stage.anchor('office.desk');
      stand(ctx, a.pos.x, a.pos.z, a.yaw, -0.55);
      ctx.flags.openPad = true;
    },
    safe(ctx) {
      carry(ctx);
      const O = roomAs(ctx, 'rubbed');
      O.setDoor(1.45);
      giveSheet(ctx, O, true);
      O.swingPicture();
      O.picture.angle = O.picture.target; O.picture.hang.rotation.z = O.picture.angle; O.picture.swinging = false;
      const a = ctx.stage.anchor('office.safe');
      stand(ctx, a.pos.x, a.pos.z, a.yaw, -0.1);
      ctx.flags.openSafe = true;
    },
    ledger(ctx) {
      carry(ctx);
      const O = roomAs(ctx, 'open');
      O.setDoor(1.45);
      // (the sheet went into a pocket when the safe came open)
      const a = ctx.stage.anchor('office.safe');
      stand(ctx, a.pos.x + 0.05, a.pos.z + 0.1, a.yaw, -0.28);
    },
  },

  *script(ctx) {
    const { game: G, hands: H, controller: C } = ctx;
    const O = office(ctx);
    const F = ctx.flags;
    const demo = Q().get('demo') === '1';
    ctx.music.cue('office', { fade: 2.5 });
    const pad = F.pad = padPuzzle(ctx);
    const safe = F.safe = safePuzzle(ctx);
    ctx.onStep((dt) => {
      pad.step(dt); safe.step(dt);
      // the torn sheet in my left hand: held up at the frame's lower left (higher at the dial, to be read)
      if (O.sheet && H.held.L === O.sheet && (!H.clips[0] || H.clips[0].done || H.clips[0].name !== 'b2_tear')) {
        // (at the dial the lens is narrower: the sheet further off, higher, its figures by the dial)
        const at = safe.active ? { pos: [-0.25, -0.115, -0.64], face: [0.22, 0.12, 1], foot: [-0.06, -1, 0.1] } : {};
        // (the safe open: the numbers have done their work, the sheet goes down into a pocket)
        if (safe.opened) { F.stow = Math.min(1, (F.stow || 0) + 1 / 60 / 0.45); at.down = F.stow; }
        holdSheet(H, O.sheet, at);
        if (F.stow >= 1) { H.hold(null, 'L', { keep: true }); if (O.sheet.parent) O.sheet.parent.remove(O.sheet); O.sheet = null; live(H, {}); G.sfx.play('pocket'); return; }
        if (!H.still || H.still.L !== HP.b2liveL) live(H, { R: H.still && H.still.R ? 'b2liveR' : null, L: 'b2liveL' });
      }
    });

    // ---- 1. the corridor ------------------------------------------------------------------
    if (ctx.at('corridor')) {
      yield beat('corridor');
      // a touch: walked into, or E at it; the hand on the leaf, the door swings in
      const leaf = () => O.door.hinge.localToWorld(V(0, 1.1, O.door.W * 0.8));
      let near = 0;
      yield until(() => {
        const e = G.eye, p = leaf();
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        const toward = C.vel.x > 0.25 || (G.eye.x > -0.75 && Math.abs(e.z - (DOOR.z0 + DOOR.z1) / 2) < 0.6);
        near = d < 1.6 ? near + 1 / 60 : 0;
        if (near > 1.4) G.hud.prompt('E  push', G.screenOf(p), 'scene'); else G.hud.clearPrompt('scene');
        return (d < 0.95 && toward) || (d < 1.6 && ctx.pressed('KeyE'));
      });
      G.hud.clearPrompt('scene');
      // (object first: the palm goes onto the leaf where it is, rides it
      // while it is pushed, and lets go as it swings on on its own weight)
      const T = O.door.W * 0.8;
      const touch = () => O.door.hinge.localToWorld(V(0, 1.36, T));
      const into = () => { const n = V(1, 0, 0).transformDirection(O.door.hinge.matrixWorld); const p = touch(); if (n.x * (p.x - G.eye.x) + n.z * (p.z - G.eye.z) < 0) n.negate(); return n; };
      // (out of arm's reach: a short step in first, the eye on the door)
      {
        const e = G.eye, p = touch(), dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
        if (d > 0.7) { const k = (d - 0.62) / d; C.ease({ x: e.x + dx * k, y: e.y, z: e.z + dz * k, yaw: Math.atan2(-dx, -dz), pitch: -0.2 }, 0.2); yield wait(0.2); }
      }
      const up = V(0, 1, 0);
      palmOn(H, 'R', touch(), into(), up);
      live(H, { R: 'b2liveR' });
      let t = 0, pushed = false;
      yield until(() => {
        t += 1 / 60;
        // (the reach: the palm arrives; then the push: the leaf goes with it)
        if (!pushed && t > 0.2) { pushed = true; O.swingDoor(O.door.angle + 0.32, 0.95); G.sfx.play('office_doorPush', V(-0.07, 1.1, 1.0)); }
        palmOn(H, 'R', touch(), into(), up.clone().addScaledVector(into(), -0.15));
        return t > 0.5;
      });
      // (let go: it swings in on its own weight, the hand drops away)
      O.swingDoor(1.45, 2.2);
      live(H, {});
      yield wait(0.25);
    }

    // ---- 2. the room -----------------------------------------------------------------------
    if (ctx.at('room')) yield beat('room');
    if (ctx.at('safe')) {
      roomLines(ctx);
      // the pad (under the lamp) and the picture (crooked in the slats' light)
      ctx.interact.add({ id: 'pad', at: V(PAD.x, DESK.h + 0.02, PAD.z), range: 1.8, cone: 0.55, prompt: 'the pad', when: () => !pad.done && !pad.active && !safe.active, onUse: () => pad.open() });
      ctx.interact.add({ id: 'picture', at: V(PICTURE.x, PICTURE.y, 0.05), range: 1.9, cone: 0.6, prompt: 'the picture', when: () => !O.picture.target || O.picture.target < 0.5, onUse: () => { O.swingPicture(); G.sfx.play('office_pictureSwing', V(PICTURE.x, PICTURE.y, 0.05)); ctx.interact.remove('picture'); } });
      ctx.interact.add({ id: 'safe', at: () => O.safe.centre, range: 1.7, cone: 0.55, prompt: 'the dial', when: () => O.picture.target > 0.5 && !safe.opened && !safe.active && !pad.active, onUse: () => safe.open() });
      if (F.openPad) pad.open();
      if (F.openSafe) safe.open();
      if (demo && F.openPad) pad.demo = true;
      if (demo && F.openSafe) safe.demo = safeDemo(safe);
      if (demo && F.openSafe) safe.demoOpen = true;
      // the pad is done (or never done: the safe can be found by ear)
      yield until(() => pad.active || safe.active || safe.opened);
      if (pad.active) { yield beat('pad'); yield until(() => !pad.active); }
      // the sheet stays in my left hand from here
      if (pad.done) giveSheet(ctx, O, false);
      yield until(() => safe.active || safe.opened);
      if (ctx.beat !== 'safe') yield beat('safe');
      yield until(() => safe.opened);
    }

    // ---- 5. the ledger ---------------------------------------------------------------------
    if (ctx.at('ledger')) {
      yield beat('ledger');
      yield* ctx.prompt({ text: 'take it', at: () => O.ledger && O.ledger.getWorldPosition(V(0, 0, 0)) });
      // (a quick hand: the sheet, if it is not in the pocket yet, goes now - both hands take the book)
      if (O.sheet) { H.hold(null, 'L', { keep: true }); if (O.sheet.parent) O.sheet.parent.remove(O.sheet); O.sheet = null; live(H, {}); }
      const L = O.ledger;
      G.sfx.play('office_ledgerTake', L.getWorldPosition(V(0, 0, 0)));
      const tk = H.play('b2_take');
      yield until(() => tk.t >= H.clip('b2_take').marks.take);
      // held up and opened: columns, sums, the bird by the big ones
      let put = false;
      // (square to me, its spine up the middle of the view: held up, open)
      L.rotation.set(0, 0, 0);
      const I = G.inspect.open({ prop: L, options: { dist: 0.52, spin: [1.15, 0.0], scale: 0.95 }, onDone: () => { put = true; } });
      I.pivot.rotation.set(1.15, 0.0, 0);
      let t = 0;
      // (object first: held in both hands by its lower corners, the palms
      // under its boards, riding it however the mouse turns it - not a book
      // hanging in the air)
      const lw = 0.21;
      const grip = () => {
        L.updateMatrixWorld(true);
        const up = V(0, 1, 0).transformDirection(L.matrixWorld);
        const Rp = L.localToWorld(V(0.06, -0.004, 0.105)), Rf = V(-0.35, 0, -1).transformDirection(L.matrixWorld);
        palmOn(H, 'R', Rp, up, Rf);
        // (the left on the front board's outside: it swings the board open and
        // holds it there, the palm riding it from over the book to under it)
        const cv = L.getObjectByName('cover');
        if (cv) {
          cv.updateMatrixWorld(true);
          palmOn(H, 'L', cv.localToWorld(V(lw - 0.07, 0.004, 0.105)), V(0, -1, 0).transformDirection(cv.matrixWorld), V(0.35, 0, -1).transformDirection(cv.matrixWorld));
        }
      };
      grip();
      live(H, { R: 'b2liveR', L: 'b2liveL' });
      yield until(() => {
        t += 1 / 60;
        L.userData.setOpen(Math.min(1, Math.max(0, (t - 0.35) / 0.6)));
        if (t > 0.4 && t < 0.45) G.sfx.play('office_pages', G.eye);
        grip();
        return put;
      });
      live(H, {});
      // inside my coat
      if (L.parent) L.parent.remove(L);
      O.ledger = null;
      const co = H.play('b2_coat', { onMark: { in: () => G.sfx.play('pocket') } });
      if (!ctx.save.inventory.includes('ledger')) ctx.save.inventory.push('ledger');
      yield until(() => co.done);
      // (the sheet goes into a pocket too)
      if (O.sheet) { H.hold(null, 'L', { keep: true }); O.sheet = null; }
      live(H, {});
      yield wait(1.2);
      // scene 5 in the same room: no fade, its card over the room
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
  void SAFE;
}
