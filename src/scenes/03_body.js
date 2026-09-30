import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { V, ALLEY, XV, STOOD, SHOOTER, WOUNDS, MARKS, LIES, KNEEL, STUDY, startPose, mackOut, layVictim, evidence, clearEvidence, gutterHat, crewCar } from './body/place.js';
import { makeOutline, makeStrings, runStrings } from './body/strings.js';
import { HALVES, clearHalves } from './body/halves.js';
import { NOTE_PUZZLE, clearNote } from './body/note.js';
import { openFist, pullLadder, climbHands, handsOff, takeHalf, tableFinger } from './body/hands.js';

// Scene 3, the body (STORY.md; lane B1's brief). The side alley thirty
// metres down the pavement from the diner, under its one wall lamp.
//   approach  by Mack out cold on the pavement, two shots just heard: a
//             car's red tail lamps pull out of the alley's mouth and go;
//             the alley lamp is the only light that is a goal. His hat
//             turns in the gutter halfway; the el train goes over.
//   body      Ames on his back under the lamp. E kneel: the eye eases down
//             beside him. E what I look at: the wounds ("Two. In the chest.
//             He was standing." - the dashed outline of where he stood
//             rises), his fist (the seven wet pieces come away into my
//             hand), the two marks in the brick above him
//   strings   the line of fire: a string from each mark through its wound,
//             crossing on the fire escape's landing, where the red shows
//   landing   E the drop ladder down, W up it (two seconds), E take the
//             torn half of a Cardinal matchbook cover; down again
//   halves    on the dry step: the half against Mack's book, the bird whole
//   note      on the same step: the seven pieces, HARBOR BLDG. RM 304
//   leave     I stand. The lamp, the body, the rain. ctx.next()
// Saves at body, landing, note. Every beat has a setup (?scene=body&beat=).
const BEATS = ['approach', 'body', 'strings', 'landing', 'halves', 'note', 'leave'];
const after = (b, x) => BEATS.indexOf(b) > BEATS.indexOf(x);
const atOrAfter = (b, x) => BEATS.indexOf(b) >= BEATS.indexOf(x);

// what this scene put into the block, taken away again when it goes (a
// retry sets it anew; the next scene finds the alley dark and shut)
let LIVE = null;
function tidy(game) {
  if (!LIVE) return;
  const L = LIVE; LIVE = null;
  for (const f of L.removers) try { f(); } catch (e) { /* */ }
  const st = game.stage;
  if (L.box) { const i = st.colliders.boxes.indexOf(L.box); if (i >= 0) st.colliders.boxes.splice(i, 1); }
  const alley = st.part && st.part('alley');
  if (alley) { alley.show(false); alley.ladder.set(0); }
  const cam = game.camera;
  if (L.fov0 && Math.abs(cam.fov - L.fov0) > 1e-3) { cam.fov = L.fov0; cam.updateProjectionMatrix(); }
}

// the alley and everything in it as the beat finds it
function stageBody(ctx, b) {
  const { game: G, stage, controller: C, hands: H } = ctx;
  tidy(G);
  if (!G._bodyHooked) {
    G._bodyHooked = true;
    G.on('scene:exit', (e) => { if (e && e.id === 'body') tidy(G); });
  }
  const alley = stage.part('alley');
  alley.show(true);
  alley.light(true);
  alley.ladder.set(atOrAfter(b, 'halves') ? 1 : 0);
  LIVE = { removers: [], fov0: G.camera.fov };
  // (the blood of an earlier try in this place goes before it is laid again)
  if (G.fx && G.fx.decals && G.fx.decals.clearIn) G.fx.decals.clearIn(new THREE.Box3(V(ALLEY.gateX, -1, ALLEY.zN), V(ALLEY.mouthX + 0.5, 3, ALLEY.zS + 0.1)));
  // what the story has given me by now
  const inv = G.save.inventory;
  if (!inv.includes('matchbook')) inv.push('matchbook');
  if (after(b, 'landing') && !inv.includes('matchbookHalf')) inv.push('matchbookHalf');
  mackOut(ctx);
  const ames = layVictim(ctx);
  LIVE.box = ctx.flags.bodyBox;
  const ev = evidence(ctx);
  LIVE.removers.push(() => clearEvidence(ctx));
  const O = ctx.flags.outline = makeOutline(stage);
  const R = ctx.flags.strings = makeStrings(stage);
  LIVE.removers.push(() => O.remove(), () => R.remove());
  // the story so far, by beat
  const F = ctx.flags;
  F.saw = { wounds: after(b, 'body'), fist: after(b, 'body'), marks: after(b, 'body') };
  if (after(b, 'body')) { const p = ames.items.get('paper'); if (p) p.visible = false; }
  if (after(b, 'strings')) { O.set(1); for (const s of R.strings) R.setTaut(s); }
  if (after(b, 'landing')) { ev.half.visible = false; F.halfTaken = true; }
  if (b === 'approach') {
    const hat = gutterHat(ctx), car = crewCar(ctx);
    F.hat = hat; F.car = car;
    LIVE.removers.push(() => hat.remove(), () => car.remove());
  }
  H.hold(null, 'R'); H.hold(null, 'L');
  H.equip('empty');
  // the player where the story has him
  const P = startPose(G);
  const at = {
    approach: { x: P.x, z: P.z, yaw: P.yaw, pitch: P.pitch },
    body: { x: -9.1, z: -25.9, yaw: 1.35, pitch: -0.38 },
    strings: { x: STUDY.x, z: STUDY.z, yaw: STUDY.yaw, pitch: STUDY.pitch },
    landing: { x: STUDY.x, z: STUDY.z, yaw: STUDY.yaw, pitch: 0.1 },
    halves: { x: ALLEY.ladder.x, z: ALLEY.zN + 1.9, yaw: Math.PI - 0.08, pitch: -0.3 },
    note: { x: ALLEY.step.x + 0.05, z: ALLEY.zS - 0.95, yaw: Math.PI, pitch: -0.55 },
    leave: { x: ALLEY.step.x + 0.05, z: ALLEY.zS - 0.95, yaw: Math.PI, pitch: -0.55 },
  }[b];
  C.setPose(at.x, at.z, at.yaw, at.pitch);
  return { alley, ames, ev, O, R };
}

const setupFor = (b) => (ctx) => { ctx.flags.env = stageBody(ctx, b); };

// (the scripted play's probe, tools/plays/body.json: the mouse moves that
// bring the view onto a thing, the pointer onto a place; read-only)
const PROBE = {
  // the view onto a world point: [dx, dy] pixels of mouse
  aim(p) {
    const N = window.__noir, C = N.controller, e = N.game.eye;
    const yaw = Math.atan2(-(p.x - e.x), -(p.z - e.z)), pitch = Math.atan2(p.y - e.y, Math.hypot(p.x - e.x, p.z - e.z));
    const dyaw = Math.atan2(Math.sin(C.yaw - yaw), Math.cos(C.yaw - yaw));
    return [Math.round(dyaw / C.sensitivity), Math.round((C.pitch - pitch) / C.sensitivity)];
  },
  thing(name) {
    const G = window.__noir.game, c = G.cast.get('ames');
    if (name === 'chest') return c.bones.chest.getWorldPosition(V(0, 0, 0));
    if (name === 'fist') return c.bones.handR.getWorldPosition(V(0, 0, 0));
    if (name === 'marks') return MARKS[0].clone().lerp(MARKS[1], 0.5);
    if (name === 'ladder') { const a = G.stage.part('alley'); return V(ALLEY.ladder.x, a.ladder.footY() + 0.05, a.ladder.z); }
    if (name === 'climb') { const a = G.stage.part('alley'); return V(ALLEY.ladder.x, ALLEY.y + 1.4, a.ladder.z); }
    if (name === 'half') return G.scenes.ctx.flags.ev.half.getWorldPosition(V(0, 0, 0));
    if (name === 'step') return G.stage.anchor('body.step').pos.clone();
    return null;
  },
  aimAt(name) { return PROBE.aim(PROBE.thing(name)); },
  // the strings: the pointer (screen px) from where it is to the gun's
  // point on the line (every string through its wound goes there)
  toShooter() {
    const G = window.__noir.game, run = G.scenes.ctx.flags.run;
    const v = SHOOTER.clone().project(G.camera);
    return [Math.round((v.x - run.ndc.x) * innerWidth / 2), Math.round(-(v.y - run.ndc.y) * innerHeight / 2)];
  },
  // a table puzzle: the pointer's move (px) to a table point (m)
  toTable(x, z) {
    const A = window.__noir.game.puzzles.active;
    return [Math.round((x - A.pointer.x) / 0.0006), Math.round(-(z - A.pointer.z) / 0.0006)];
  },
  // a world point in the open table's coordinates (m)
  tableOf(w) {
    const A = window.__noir.game.puzzles.active, a = A.anchor, yaw = a.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw);
    const dx = w.x - a.pos.x, dz = w.z - a.pos.z;
    return [dx * c - dz * s, -dx * s - dz * c];
  },
  // the halves, as a hand would do them: onto the half, hold, onto the
  // book, let go, the right button and turn it home
  halvesPlan() {
    const A = window.__noir.game.puzzles.active, st = A.state;
    const [hx, hz] = PROBE.tableOf(st.pivot.position), [tx, tz] = PROBE.tableOf(st.tgt);
    const px = (a, b) => Math.round(a / 0.0006) - Math.round(b / 0.0006);
    const turn = Math.atan2(Math.sin(st.pivot.rotation.y - st.tgtYaw), Math.cos(st.pivot.rotation.y - st.tgtYaw));
    return [['move', px(hx, A.pointer.x), -px(hz, A.pointer.z)], ['ldown'], ['move', px(tx, hx), -px(tz, hz)], ['lup'], ['rdown'], ['move', Math.round(turn / 0.009), 0], ['rup']];
  },
  // the note: each piece in turn turned square to the first and laid
  // against it where it tore from it
  notePlan() {
    const A = window.__noir.game.puzzles.active, st = A.state, P = st.pieces;
    const ops = [];
    let ptr = [A.pointer.x, A.pointer.z];
    const go = (x, z) => { ops.push(['move', Math.round((x - ptr[0]) / 0.0006), -Math.round((z - ptr[1]) / 0.0006)]); ptr = [x, z]; };
    const p0 = P[0], r0 = p0.g.rotation.y;
    for (let j = 1; j < P.length; j++) {
      const q = P[j];
      const [qx, qz] = PROBE.tableOf(q.g.position);
      go(qx, qz);
      const turn = Math.atan2(Math.sin(q.g.rotation.y - r0), Math.cos(q.g.rotation.y - r0));
      if (Math.abs(turn) > 0.01) ops.push(['rdown'], ['move', Math.round(turn / 0.009), 0], ['rup']);
      const dx = q.c.x - p0.c.x, dy = q.c.y - p0.c.y;
      const w = p0.g.position.clone().add(new THREE.Vector3(dx, 0, -dy).applyAxisAngle(new THREE.Vector3(0, 1, 0), r0));
      const [tx, tz] = PROBE.tableOf(w);
      ops.push(['ldown']);
      go(tx, tz);
      ops.push(['lup']);
    }
    return ops;
  },
};
if (typeof window !== 'undefined') window.__body = PROBE;

export default defineScene({
  id: 'body', stage: 'block',
  beats: BEATS,
  save: ['body', 'landing', 'note'],
  setup: Object.fromEntries(BEATS.map((b) => [b, setupFor(b)])),

  *script(ctx) {
    const { game: G, stage, controller: C, hands: H, interact: I } = ctx;
    const F = ctx.flags;
    const env = F.env || (F.env = stageBody(ctx, ctx.from || 'approach'));
    const { alley, ames, ev, O, R } = env;
    const snd = (name, pos = null, p = {}) => G.sfx.play(name, pos, p);
    if (G.music) G.music.cue('body', { fade: 2 });
    G.puzzles.define(HALVES);
    G.puzzles.define(NOTE_PUZZLE);
    const chest = () => ames.bones.chest.getWorldPosition(V(0, 0, 0));
    const fist = () => ames.bones.handR.getWorldPosition(V(0, 0, 0));
    const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    // (shot mode, the strips: act=kneel@0.3,fist@1.5,... does what E would
    // at those scene times - the look development of each moment)
    const ACT = G.shotMode && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('act') || '').split(',').filter(Boolean).map((a) => { const [n, t] = a.split('@'); return { n, t: +t || 0 }; }) : [];
    const acted = (n) => ACT.some((a) => a.n === n && ctx.sceneTime >= a.t - 1e-6);

    // ---- under every beat ------------------------------------------------------------
    ctx.onStep((dt) => {
      if (F.hat) F.hat.step(dt);
      if (F.car) F.car.step(dt);
      O.step(dt);
      for (const s of R.strings) if (s.taut && !F.run) R.drawTaut(s);
      if (F.run) F.run.step(dt);
      if (F.ladderAnim) {
        const A = F.ladderAnim;
        A.t += dt;
        // it falls the rest of the way under its own weight in the guides,
        // hits, bounces once
        const T = 0.34, u = Math.min(1, A.t / T);
        let k = A.from + (1 - A.from) * u * u;
        if (A.t > T) { const b = A.t - T; k = 1 - 0.035 * Math.max(0, Math.sin(b / 0.16 * Math.PI)) * (b < 0.16 ? 1 : 0); }
        alley.ladder.set(k);
        if (A.t > T + 0.3) { alley.ladder.set(1); F.ladderAnim = null; }
      }
      // my hands on the rungs while I am on the ladder
      if (C.mode === 'climb') { F.climbS = F.climbS || { onRung: (side) => snd('rung', V(ALLEY.ladder.x + (side === 'R' ? 0.13 : -0.13), G.eye.y, alley.ladder.z), { f: side === 'R' ? 420 : 470 }) }; climbHands(ctx, alley.ladder, F.climbS); }
      else if (F.climbS) { F.climbS = null; handsOff(H); }
      // my fingertip on the step's puzzles
      const PA = G.puzzles.active;
      if (PA && (PA.id === 'body.halves' || PA.id === 'body.note')) { F.finger = F.finger || {}; tableFinger(ctx, F.finger, PA.pointer.world, PA.pointer.down); }
      else if (F.finger) { F.finger = null; handsOff(H); }
    });

    // ---- 1. the approach ---------------------------------------------------------------
    if (ctx.at('approach')) {
      yield beat('approach');
      // (the fade in, the chapter card; then the car pulls out of the mouth)
      yield wait(1.5);
      if (F.car) { F.car.go(); snd('carAway', V(-15, 1, -28.2), {}); }
      // the el train over the avenue as I walk
      yield wait(1.4);
      if (stage.train && !stage.train.active && G.director) G.director.cue('train', { z: -14, ahead: -70, dir: 1 });
      // down the pavement to him
      yield until(() => flat(G.eye, chest()) < 3.6);
    }

    // ---- 2. the body ---------------------------------------------------------------------
    if (ctx.at('body')) {
      yield beat('body');
      // E kneel, beside him
      let knelt = false;
      I.add({ id: 'body.kneel', at: () => chest(), range: 3.2, cone: 0.7, prompt: 'kneel', onUse: () => { knelt = true; } });
      yield until(() => knelt || acted('kneel'));
      I.remove('body.kneel');
      snd('kneel');
      const anchor = { pos: V(KNEEL.x, 0, KNEEL.z), yaw: KNEEL.yaw, eyeY: KNEEL.eyeY };
      C.setMode('seated', { anchor, yawRange: [-1.75, 1.75], pitchRange: [-1.25, 0.8], lean: 0.05, forward: 0, pitch: -0.5, ease: 0.9 });
      // (the eye stays where the mode put it: a kneel's own pitch)
      C.pitch = -0.5;
      yield wait(0.9);
      // what I look at: E on it
      const look = (pose, secs = 0.7) => { C.ease(pose, secs); F.releaseEase = G.time + secs + 0.05; };
      const aimAt = (p) => { const e = G.eye; return { x: e.x, y: e.y, z: e.z, yaw: Math.atan2(-(p.x - e.x), -(p.z - e.z)), pitch: Math.atan2(p.y - e.y, Math.hypot(p.x - e.x, p.z - e.z)) }; };
      ctx.onStep(() => { if (F.releaseEase && G.time >= F.releaseEase) { F.releaseEase = 0; C._ease = null; } });
      let busy = false;
      I.add({ id: 'body.wounds', at: () => chest(), range: 2.4, cone: 0.36, prompt: 'the wounds', when: () => !F.saw.wounds && !busy,
        onUse: () => { F.saw.wounds = true; busy = true; F.do = 'wounds'; } });
      I.add({ id: 'body.fist', at: () => fist(), range: 2.0, cone: 0.36, prompt: 'his hand', when: () => !F.saw.fist && !busy,
        onUse: () => { F.saw.fist = true; busy = true; F.do = 'fist'; } });
      I.add({ id: 'body.marks', at: () => MARKS[0].clone().lerp(MARKS[1], 0.5), range: 3.0, cone: 0.3, prompt: 'the marks', when: () => !F.saw.marks && !busy,
        onUse: () => { F.saw.marks = true; busy = true; F.do = 'marks'; } });
      while (!(F.saw.wounds && F.saw.fist && F.saw.marks) || busy) {
        for (const n of ['wounds', 'fist', 'marks']) if (!busy && !F.saw[n] && acted(n)) { F.saw[n] = true; busy = true; F.do = n; }
        if (F.do === 'wounds') {
          F.do = null;
          look(aimAt(chest()), 0.5);
          yield* ctx.say('Two. In the chest. He was standing.', 3.0);
          // where he stood, raised: the view goes to it
          O.raise(true);
          look(aimAt(V(XV, 1.3, STOOD.z)), 0.9);
          yield wait(1.2);
          busy = false;
        } else if (F.do === 'fist') {
          F.do = null;
          // my hand into his: the fingers worked open, the wet paper out
          snd('fistOpen', fist());
          yield* openFist(ctx, ames, { onPaper: () => { F.havePieces = true; } });
          snd('pocket');
          busy = false;
        } else if (F.do === 'marks') {
          F.do = null;
          look(aimAt(MARKS[0].clone().lerp(MARKS[1], 0.5)), 0.6);
          yield wait(0.7);
          // (the rounds went through him: the line from the marks through
          // his chest, if the outline stands there)
          if (O.want > 0) look(aimAt(V(XV, 1.5, STOOD.z)), 0.8);
          yield wait(0.9);
          busy = false;
        } else yield null;
      }
      I.remove('body.wounds'); I.remove('body.fist'); I.remove('body.marks');
      O.raise(true);
      yield wait(0.5);
    }

    // ---- 3. the strings ----------------------------------------------------------------------
    if (ctx.at('strings')) {
      yield beat('strings');
      if (O.k < 1) O.raise(true);
      const run = F.run = runStrings(ctx, R, O, {});
      LIVE && LIVE.removers.push(() => run.end());
      let solvedLight = false;
      ctx.onSolvedStrings = () => {
        // the lightning shows it: the lines crossing on the landing, the red
        if (G.storm && G.storm.strike) G.storm.strike(0.7);
        solvedLight = true;
      };
      yield wait(1.1);
      G.hud.prompt('MOUSE  the string through the wound', null, 'scene');
      yield until(() => run.done);
      void solvedLight;
      run.end();
      F.run = null;
      G.hud.clearPrompt('scene');
      // I stand where I worked it out, walking again
      const P = C.eyePose();
      C.setMode('walk', { pose: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: Math.min(0.2, P.pitch) } });
    }

    // ---- 4. the landing ------------------------------------------------------------------------
    if (ctx.at('landing')) {
      yield beat('landing');
      const L = ALLEY.ladder, lz = alley.ladder.z;
      // E: the drop ladder down (its foot is a reach over my head)
      if (alley.ladder.down < 0.99) {
        let pulled = false;
        I.add({ id: 'body.ladder', at: () => V(L.x, alley.ladder.footY() + 0.05, lz), range: 3.0, cone: 0.5, prompt: 'pull the ladder down', onUse: () => { pulled = true; } });
        yield until(() => pulled || acted('pull'));
        I.remove('body.ladder');
        // my hand up for its lowest rung, down with it, let go: it drops
        yield* pullLadder(ctx, alley.ladder, { onLetGo: () => { F.ladderAnim = { t: 0, from: alley.ladder.down }; snd('ladderDrop', V(L.x, 2, lz)); } });
        yield until(() => !F.ladderAnim);
      }
      // W: up it
      let up = false;
      // (W held at the foot of it: a man walking into a ladder goes up it)
      I.add({ id: 'body.climb', key: 'KeyW', hold: 0.12, at: () => V(L.x, ALLEY.y + 1.4, lz), range: 1.9, cone: 0.9, prompt: 'climb', onUse: () => { up = true; } });
      yield until(() => up || acted('climb'));
      I.remove('body.climb');
      const zc = lz + 0.42, top = ALLEY.esc.y1 + 1.65, y0 = ALLEY.y + 1.65;
      const path = (u) => {
        // up the face of it, then over onto the landing
        const a = Math.min(1, u / 0.8), b = Math.max(0, (u - 0.8) / 0.2);
        const y = y0 + (top + 0.08 - y0) * a - 0.08 * b * b;
        const z = zc - (zc - (ALLEY.zN + 0.55)) * (b * b * (3 - 2 * b));
        const x = L.x + 0.45 * (b * b * (3 - 2 * b));
        return { x, y, z };
      };
      C.setMode('climb', { path, u: 0, speed: 0.34, face: 0, drive: acted('climb') && !up ? 1 : null });
      C.pitch = 0.02;
      yield until(() => C.climb && C.climb.u >= 1);
      // on the landing, under the rain, over the alley: along it to where
      // he stood (the casings, the red)
      const stand = { pos: V(XV - 0.5, 0, ALLEY.zN + 0.55), yaw: -Math.PI / 2 + 0.12, eyeY: ALLEY.esc.y1 + 1.62 };
      C.setMode('seated', { anchor: stand, yawRange: [-2.2, 2.2], pitchRange: [-1.3, 0.8], lean: 0.05, forward: 0, pitch: -0.6, ease: 0.9 });
      C.pitch = -0.6;
      let taken = false;
      I.add({ id: 'body.half', at: () => ev.half.getWorldPosition(V(0, 0, 0)), range: 2.6, cone: 0.45, prompt: 'take', onUse: () => { taken = true; } });
      yield until(() => taken || acted('take'));
      I.remove('body.half');
      yield* takeHalf(ctx, ev.half, { onTaken: () => snd('matchbook', ev.half.position) });
      // held up and turned: the crew's red, half the black bird, the torn
      // edge (E puts it away)
      let away = false;
      ev.half.visible = true;
      G.inspect.open({ prop: ev.half, options: { spin: [1.05, 0.5], dist: 0.24, scale: 2.6 }, onDone: () => { away = true; } });
      yield until(() => away || !G.inspect.active || acted('pocket'));
      if (G.inspect.active) G.inspect.close(false);
      ev.half.visible = false;
      snd('pocket');
      if (!G.save.inventory.includes('matchbookHalf')) G.save.inventory.push('matchbookHalf');
      F.halfTaken = true;
      yield wait(0.5);
      // back along the landing and down the ladder, on its own
      C.setMode('climb', { path, u: 1, speed: 0.4, face: 0, drive: -1, ease: 0.7 });
      C.yaw = 0; C.pitch = -0.1;
      yield until(() => C.climb && C.climb.u <= 0);
      const P = C.eyePose();
      C.setMode('walk', { pose: { x: P.x, y: P.y, z: P.z + 0.1, yaw: Math.PI - 0.15, pitch: -0.25 }, ease: 0.6 });
    }

    // ---- 5. the halves ---------------------------------------------------------------------------
    const stepAt = () => { const a = stage.anchor('body.step'); return a.pos.clone(); };
    const standAtStep = () => ({ x: ALLEY.step.x + 0.05, y: ALLEY.y + 1.65, z: ALLEY.zS - 0.95, yaw: Math.PI, pitch: -0.5 });
    if (ctx.at('halves')) {
      yield beat('halves');
      let go = false;
      I.add({ id: 'body.step', at: () => stepAt(), range: 2.6, cone: 0.85, prompt: 'the matchbook', onUse: () => { go = true; } });
      yield until(() => go);
      I.remove('body.step');
      yield null;   // (the E that brought me here must not leave the puzzle)
      let done = false;
      G.puzzles.open('body.halves', { onSolved: () => { done = true; } });
      yield until(() => done || !G.puzzles.active);
      if (!done) {
        // (E left it: the step is still there, and so is the puzzle)
        while (!done) {
          let again = false;
          I.add({ id: 'body.step', at: () => stepAt(), range: 2.6, cone: 0.85, prompt: 'the matchbook', onUse: () => { again = true; } });
          yield until(() => again);
          I.remove('body.step');
          yield null;
          G.puzzles.open('body.halves', { onSolved: () => { done = true; } });
          yield until(() => done || !G.puzzles.active);
        }
      }
      clearHalves(F.halvesSt);
      snd('pocket');
    }

    // ---- 6. the note ---------------------------------------------------------------------------------
    if (ctx.at('note')) {
      yield beat('note');
      let done = false;
      const open = () => {
        G.puzzles.open('body.note', { onSolved: () => { done = true; } });
        // (from the halves the eye is still down at the step: when it leaves
        // it rises to where I stand)
        if (G.puzzles.active) G.puzzles.active.prevPose = standAtStep();
      };
      if (!G.puzzles.active) open();
      yield until(() => done || !G.puzzles.active);
      while (!done) {
        let again = false;
        I.add({ id: 'body.step', at: () => stepAt(), range: 2.6, cone: 0.85, prompt: 'the note', onUse: () => { again = true; } });
        yield until(() => again);
        I.remove('body.step');
        yield null;
        open();
        yield until(() => done || !G.puzzles.active);
      }
      // folded into my coat
      snd('foldNote');
      clearNote(F.noteSt);
      if (!G.save.inventory.includes('note')) G.save.inventory.push('note');
      G.save.flags.note = 'HARBOR BLDG. RM 304';
      G.save.write();
      yield wait(0.6);
    }

    // ---- 7. leave ----------------------------------------------------------------------------------------
    if (ctx.at('leave')) {
      yield beat('leave');
      // I stand: the lamp, the body, the rain (the eye rises and turns to him;
      // the strings and the outline were the working, they go)
      const P0 = C.eyePose();
      O.raise(false);
      F.stringsFade = 1;
      ctx.onStep((dt) => {
        if (!F.stringsFade) return;
        F.stringsFade = Math.max(0, F.stringsFade - dt / 1.2);
        R.group.traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uOpacity) o.material.uniforms.uOpacity.value = Math.min(o.material.uniforms.uOpacity.value, F.stringsFade); });
        if (!F.stringsFade) R.group.visible = false;
      });
      // (back across the alley to the foot of the fire escape: the lamp high
      // on the wall, its one cone in the rain, him at its edge)
      const to = V(-11.85, ALLEY.y + 1.85, ALLEY.zS - 0.4);
      const P1 = { x: -11.85, y: ALLEY.y + 1.74, z: ALLEY.zN + 0.45 };
      P1.yaw = Math.atan2(-(to.x - P1.x), -(to.z - P1.z));
      P1.pitch = Math.atan2(to.y - P1.y, Math.hypot(to.x - P1.x, to.z - P1.z)) - 0.06;
      const DUR = 3.6;
      C.setMode('cutscene', { track: (t) => {
        const u = Math.min(1, t / DUR), k = u * u * (3 - 2 * u);
        const Lr = (a, b) => a + (b - a) * k;
        const dy = Math.atan2(Math.sin(P1.yaw - P0.yaw), Math.cos(P1.yaw - P0.yaw));
        return { x: Lr(P0.x, P1.x), y: Lr(P0.y, P1.y), z: Lr(P0.z, P1.z), yaw: P0.yaw + dy * k, pitch: Lr(P0.pitch, P1.pitch) };
      } });
      yield wait(DUR + 2.2);
      ctx.next();
    }
  },

  // the autoplay driver (game/Autoplay.js): E at every prompt
  auto(ctx, A) {
    A.stopWalk();
    if (A.prompting()) A.pressAfter('KeyE', 1.0, 2.0);
  },
});
