import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { buildProp } from '../props/index.js';
import { dinerRoom, makeJobs, clip, counterAt, V, DINER, stoolZ, RING, MACK_AT, EYE_AT, BRAWL_EYE } from './_diner_room.js';

// Scene 2, the fist fight (STORY.md, lane 7's brief P0.3). The rules are
// game/Brawl.js; this file stages the room round it. Beats:
//   round1  squared up in the aisle, fists up; the room clears (the couple
//           out into the rain, the old man under the end booth's table, Dot
//           down behind the counter, the docker back against the far wall)
//   round2  (him at 68) he takes a bottle by the neck and breaks it on the
//           counter; Dot slides me a bottle; plates and stools in reach
//   round3  (him at 36) the haymaker, faster, wilder; he bleeds
//   ko      (him at 0: he reels down the aisle) my last heavy: out over the
//           end booth and through the end bay's glass onto the pavement;
//           the street's rain comes into the room; then the walk out
//   outside by him on the wet pavement in the glass: E search
//   matchbook  the red matchbook in the hand (inspect); pocketed: two shots
//           far down the pavement, the card 'To be continued'
// Losing a round is not failing: black, and up at the round's start with 60.
const ROUND_Z = { 1: MACK_AT.z, 2: MACK_AT.z - 1.0, 3: MACK_AT.z - 2.0 };

// his bottle broken by the neck (lane 3: a held bottle's break leaves the
// jagged neck in the same hand); -> the neck, or the whole bottle if the
// break left none. `bottle`: the one already in his fist (his first bottle
// attack's 'break' mark), else a fresh one. The neck made is kept as the
// pattern for a quiet re-staging (neckFrom).
function breakInFist(ctx, mack, at = null, bottle = null) {
  const { stage } = ctx;
  const b = bottle || buildProp('bottle', { variant: 'beer' });
  if (!bottle) mack.hold(b, 'R');
  const B = stage.breakables;
  if (!B || !B.add) return b;
  b.updateWorldMatrix(true, true);
  const p = at || b.getWorldPosition(V(0, 0, 0));
  const parent = b.parent;
  B.hit(B.add(b, { kind: 'bottle', solid: false }), { point: p, dir: V(0, -1, 0), power: 9, by: 'body', neck: true });
  const neck = parent && parent.children.find((o) => o.userData && o.userData.kind === 'bottleNeck');
  if (!neck) return b;
  // (the broken bottle out of his hand, the neck in it, hung as the bottle was)
  mack.hold(neck, 'R', { grip: 'hang' });
  ctx.flags.neckPattern = neck;
  return neck;
}

// the neck back in his fist without breaking anything (a retry: no sound,
// no shards): a mesh of the first neck's own geometry and material
function neckFrom(ctx, mack) {
  const P = ctx.flags.neckPattern;
  if (!P || !P.geometry) return null;
  const n = new THREE.Mesh(P.geometry, P.material);
  n.name = 'bottleNeck';
  const u = P.userData;
  Object.assign(n.userData, { kind: 'bottleNeck', inkId: u.inkId, size: u.size, weapon: u.weapon, grip: u.grip });
  n.castShadow = P.castShadow;
  mack.hold(n, 'R', { grip: 'hang' });
  return n;
}

// the room as a round finds it (the shot mode's jump, a continue; a retry,
// `retry`: under the black, quietly). Round two and three: his bottle's neck
// in his fist (the first neck's pattern when there is one; else one bottle
// broken now, hushed), mine on the counter
function stageRound(ctx, round, { retry = false } = {}) {
  const { cast, stage, controller: C, hands, game: G } = ctx;
  const d = stage.part('diner');
  dinerRoom(ctx, 'fight', { retry });
  d.stool(DINER.brawlerStool).topple(V(1, 0, -0.3));
  clearRoom(ctx, true);
  const z = ROUND_Z[round];
  const mack = cast.spawn('brawler', { at: { x: RING.x, z }, yaw: 0 });
  ctx.flags.hisBottle = null;
  if (round >= 2) {
    // (a retry of round two before his first bottle: he goes for it again)
    const had = !retry || round >= 3 || ctx.flags.neckPattern;
    if (had) {
      ctx.flags.hisBottle = neckFrom(ctx, mack);
      if (!ctx.flags.hisBottle) {
        if (G.sfx && G.sfx.hush) G.sfx.hush(0.3);
        ctx.flags.hisBottle = breakInFist(ctx, mack);
      }
    }
    const dz = nearestStool(z + 1.45);
    d.place('bottle', counterAt(dz, 0.14, 0), { name: 'bottle.reach', variant: 'beer' });
    placePlates(ctx, z);
  }
  // (round three: a split lip, the cap loose for the next blow to the head)
  if (round >= 3) { if (mack.bleed) mack.bleed(1); mack.capLoose = true; }
  C.setPose(RING.x, z + 1.45, 0, 0);
  C.setMode('brawl', { opponent: mack, ring: { x: RING.x, z: z + 1.45, r: 0.45 }, dist: 1.45, eyeY: BRAWL_EYE });
  hands.hold(null, 'R'); hands.hold(null, 'L');
  hands.equip('fists');
  return mack;
}

// the room clears (at once for a jump, played out in round one)
function clearRoom(ctx, now) {
  const { cast, stage, game: G } = ctx;
  const front = stage.part('dinerFront');
  const jobs = ctx.flags.jobs;
  const her = cast.get('couple_her'), him = cast.get('couple_him'), old = cast.get('oldman'), dot = cast.get('dot'), dk = cast.get('docker');
  if (now) {
    for (const c of [her, him]) if (c) cast.remove(c);
    if (old) { old.place('diner.booth.4.b'); old.setState('cower'); }
    if (dot) { dot.place('diner.serve.3'); dot.setState('duck'); }
    if (dk) { dk.place({ x: RING.x + 0.2, z: 10.2 }, Math.PI); dk.setState('idle'); }
    return;
  }
  // played: the couple run out into the rain (the door opens for them)
  const flee = (c, delay) => jobs.add(c.name, (function* () {
    yield wait(delay);
    yield* clip(c, 'startle');
    yield* c.walkTo('diner.door.in', { run: true });
    front.door.open();
    yield* c.walkTo('diner.door.out', { run: true });
    yield* c.walkTo({ x: -8.4, z: 14 + delay * 3 }, { run: true });
    cast.remove(c);
  })());
  if (her) flee(her, 0.9);
  if (him) flee(him, 1.3);
  if (old) jobs.add('oldman', (function* () { yield wait(1.6); yield* clip(old, 'startle'); yield* old.walkTo('diner.booth.4.b'); old.setState('cower'); })());
  if (dot) jobs.add('dot', (function* () { yield wait(0.6); yield* clip(dot, 'startle'); dot.setState('duck'); })());
  if (dk) jobs.add('docker', (function* () { yield wait(2.2); yield* dk.walkTo({ x: RING.x + 0.2, z: 10.2 }); dk.face(Math.PI); dk.setState('idle'); })());
}

// plates on the counter's edge along the stretch the fight will cross
function placePlates(ctx, z) {
  const d = ctx.stage.part('diner');
  let k = 1;
  for (const i of [5, 7, 8]) {
    if (Math.abs(stoolZ(i) - z) > 4) continue;
    d.place('plate', counterAt(i, 0.16, 0.35), { name: 'plate.reach' + k++ });
  }
}
const nearestStool = (z) => Math.max(1, Math.min(9, Math.round((DINER.stools.z1 - z) / DINER.stools.step) + 1));

// what the brawl's rules may reach and be thrown into
function roomFor(ctx) {
  const { stage } = ctx;
  const d = stage.part('diner');
  const stools = d.stools.map((st, i) => ({ ...st, pos: V(DINER.stools.x, 0, stoolZ(i + 1)), handle: st.handle, i: i + 1 }));
  const J = DINER.jukebox;
  const pc = d.pieCase || null;
  return {
    stools,
    jukebox: { pos: V(J.x, 0, DINER.zMin + 0.62), hit: (p) => d.jukebox.hit(p), next: () => d.jukebox.next() },
    pieCase: pc ? { pos: pc.pos || ((pc.object || pc.group) && (pc.object || pc.group).getWorldPosition(V(0, 0, 0))), pane: pc.pane || null, handle: pc.handle || null } : null,
    items(round) {
      const out = [];
      if (round < 2) return out;
      for (const [name, o] of d.items) {
        if (name === 'bottle.reach') out.push({ name, kind: 'bottle', object: o, take: () => d.take(name) });
        else if (name.startsWith('plate.reach') || name === 'plate.mack') out.push({ name, kind: 'plate', object: o, take: () => d.take(name) });
      }
      for (const st of stools) {
        if (st.handle.toppled || st.handle.broken || st.i === DINER.playerStool) continue;
        out.push({ name: 'stool.' + st.i, kind: 'stool', object: st.object, pos: st.pos, handle: st.handle, take: () => { const o = st.object; if (o.parent) o.parent.remove(o); st.handle.broken = true; return o; } });
      }
      return out;
    },
  };
}

// into the brawl: the rules take over (a round's start, a retry)
function beginFight(ctx, round, mack, { hp = null, retry = false } = {}) {
  const { game: G, stage } = ctx;
  const B = G.brawl;
  const ko = stage.anchor('diner.pavement.ko');
  B.start({
    opponent: mack, round, hp, rng: ctx.rng, retry,
    ring: { ...RING, land: { x: ko.pos.x, z: ko.pos.z } },
    room: roomFor(ctx),
    // (a retry: the room set again under the black, without a sound)
    onRetry: (r) => {
      const m = stageRound(ctx, r, { retry: true });
      beginFight(ctx, r, m, { retry: true });
      if (r >= 2 && !ctx.flags.hisBottle) G.brawl.firstBottle();
    },
    // his first bottle (round two, br_bottle): off the counter into his
    // fist at 'take', broken on the counter's edge at 'break'
    onBottle: (mark) => {
      const m = mack;
      if (mark === 'take') {
        const b = buildProp('bottle', { variant: 'beer' });
        m.hold(b, 'R');
        G.sfx.play('f_grab_bottle', m.pos.clone().setY(1.2), {}, { ref: 2 });
        return b;
      }
      const whole = B.him && B.him.bottle;
      const neck = breakInFist(ctx, m, null, whole && whole.parent ? whole : null);
      const at = neck.getWorldPosition(V(0, 0, 0));
      G.fx.hit.punch(at, V(0, 1, 0), 0.3);
      ctx.flags.hisBottle = neck;
      return neck;
    },
    onGlass: () => {
      const pane = stage.part('dinerFront').panes.B4;
      stage.glass.shatter(pane, { dir: V(1, 0, 0), power: 2 });
      G.sfx.play('break_glass_big', V(DINER.faceX, 1.8, DINER.bays.B4));
      // the street's rain and its sound come into the room
      G.sfx.roomOpen(0.5);
    },
  });
  if (round >= 2 && ctx.flags.hisBottle) B.armBottle(ctx.flags.hisBottle);
  return B;
}

export default defineScene({
  id: 'fight', stage: 'block', title: 'II', name: 'The Fight',
  beats: ['round1', 'round2', 'round3', 'ko', 'outside', 'matchbook'],
  save: ['round1', 'round2', 'round3', 'outside'],

  setup: {
    round1(ctx) { ctx.flags.jobs = makeJobs(); ctx.flags.mack = stageRound(ctx, 1); },
    round2(ctx) { ctx.flags.jobs = makeJobs(); ctx.flags.mack = stageRound(ctx, 2); },
    round3(ctx) { ctx.flags.jobs = makeJobs(); ctx.flags.mack = stageRound(ctx, 3); },
    // the last blow: he has reeled back to the end of the aisle; the heavy
    // is on its way (t= scrubs his flight: the glass goes at ~0.55 s)
    ko(ctx) {
      ctx.flags.jobs = makeJobs();
      const m = stageRound(ctx, 3);
      m.place({ x: RING.x, z: RING.koZ }, 0);
      ctx.controller.setMode('brawl', { opponent: m, ring: { x: RING.x, z: RING.koZ + 1.45, r: 0.45 }, dist: 1.45, eyeY: BRAWL_EYE });
      ctx.controller.setPose(RING.x, RING.koZ + 1.45, 0, 0);
      ctx.controller.setMode('brawl', { opponent: m, ring: { x: RING.x, z: RING.koZ + 1.45, r: 0.45 }, dist: 1.45, eyeY: BRAWL_EYE });
      const B = beginFight(ctx, 3, m, { hp: 0 });
      B.startReel();
      B.him.z = RING.koZ;
      B.ko();
      ctx.flags.mack = m;
    },
    outside(ctx) {
      ctx.flags.jobs = makeJobs();
      mackOutside(ctx);
      ctx.hands.equip('empty');
      // on the pavement by the end bay, looking down at him in the glass
      ctx.controller.setMode('walk', { pose: { x: -8.0, y: 0.15 + 1.65, z: -1.7, yaw: 0.62, pitch: -0.55 } });
    },
    matchbook(ctx) {
      ctx.flags.jobs = makeJobs();
      const mack = mackOutside(ctx);
      ctx.hands.equip('empty');
      // knelt by him, the matchbook up in the hand
      ctx.controller.setMode('walk', { pose: { x: -8.2, y: 0.15 + 1.05, z: -2.5, yaw: 0.5, pitch: -0.35 } });
      openMatchbook(ctx, mack);
    },
  },

  *script(ctx) {
    const { game: G, hands: H, stage, cast } = ctx;
    const B = G.brawl;
    const d = stage.part('diner');
    const jobs = ctx.flags.jobs || (ctx.flags.jobs = makeJobs());
    ctx.onStep((dt) => jobs.step(dt));
    const mack = () => cast.get('mack');

    // ---- the rounds -----------------------------------------------------------------
    if (ctx.at('round3')) {
      if (ctx.from === 'round1' || ctx.from === 'round2' || ctx.from === 'round3') {
        // (a cut straight from the diner: the room goes on as it stands)
        if (ctx.kept) {
          const m = mack();
          ctx.controller.setMode('brawl', { opponent: m, ring: { x: RING.x, z: m.pos.z + 1.45, r: 0.45 }, dist: 1.45, eyeY: BRAWL_EYE });
          H.hold(null, 'R'); H.hold(null, 'L');
          H.equip('fists');
          m.face(0);
        }
        beginFight(ctx, ctx.from === 'round3' ? 3 : ctx.from === 'round2' ? 2 : 1, mack());
      }
      if (ctx.at('round1')) {
        yield beat('round1');
        clearRoom(ctx, false);
        yield until(() => B.round >= 2 || !B.active);
      }
      if (ctx.at('round2')) {
        yield beat('round2');
        if (ctx.from !== 'round2') yield* roundTwo(ctx);
        yield until(() => B.round >= 3 || !B.active);
      }
      yield beat('round3');
      if (ctx.from !== 'round3') {
        // he bleeds: a split lip opens with the round
        const m = mack();
        G.fx.hit.punch(m.bones.head.getWorldPosition(V(0, 0, 0)), V(0, -0.3, 1), 0.9);
        if (m.bleed) m.bleed(1);
        m.capLoose = true;
      }
      yield until(() => B.finished);
    }

    // ---- the last blow, and the walk out ----------------------------------------------------
    if (ctx.at('ko')) {
      yield beat('ko');
      yield until(() => !B.active);
      H.equip('empty');
      const P = G.controller.eyePose();
      G.controller.setMode('walk', { pose: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: Math.max(-0.2, P.pitch) } });
      G.save.flags.won = true;
      const ko = stage.anchor('diner.pavement.ko');
      // (a nudge if he stands about: the door)
      let idle = 0;
      yield until(() => {
        idle += 1 / 60;
        if (idle > 7 && G.eye.x < DINER.innerX) G.hud.prompt('WASD  the door', G.screenOf(V(DINER.faceX, 1.3, 0.6)), 'scene');
        else G.hud.clearPrompt('scene');
        return G.eye.x > DINER.faceX && Math.hypot(G.eye.x - ko.pos.x, G.eye.z - ko.pos.z) < 2.8;
      });
      G.hud.clearPrompt('scene');
    }

    // ---- outside: the search ------------------------------------------------------------------
    if (ctx.at('outside')) {
      yield beat('outside');
      if (ctx.from !== 'matchbook') {
        const m = mack();
        yield* ctx.prompt({ text: 'search', at: () => m.bones.chest.getWorldPosition(V(0, 0, 0)) });
        G.sfx.play('crouch');
        const s = H.play('searchBody', { onMark: { found: () => G.sfx.play('clothRustle') } });
        yield until(() => s.done);
      }
    }

    // ---- the matchbook ---------------------------------------------------------------------------
    if (ctx.at('matchbook')) {
      yield beat('matchbook');
      if (!G.inspect.active) openMatchbook(ctx, mack());
      let pocketed = false;
      G.inspect.active.onDone = () => { pocketed = true; };
      yield until(() => pocketed);
      const pk = H.play('showMatchbook', { onMark: { pocketed: () => G.sfx.play('pocket') } });
      pk.t = H.clip('showMatchbook').marks.pocketed - 0.1;
      const mb = mack() && mack().items.get('matchbook');
      if (mb) mb.visible = false;
      if (!G.save.inventory.includes('matchbook')) G.save.inventory.push('matchbook');
      ctx.flags.pocketed = true;
      G.save.write();
      // two shots far down the pavement to the north, the second 0.7 s on
      yield wait(0.8);
      const far = V(-9, 1.5, -27);
      G.sfx.pistol(far, G.eye.distanceTo(far));
      yield wait(0.7);
      G.sfx.pistol(far, G.eye.distanceTo(far));
      ctx.flags.shots = 2;
      // the view is free; 2 s later the slice ends
      yield wait(2);
      G.endSlice();
    }
  },

  // the autoplay driver: the fight read by its marks, then out and search
  auto(ctx, A) {
    const G = ctx.game;
    if (G.brawl.active) { A.fight(G.brawl); return; }
    if (ctx.beat === 'ko') {
      const ko = ctx.stage.anchor('diner.pavement.ko');
      A.walkPath([[RING.x, 0.9], [DINER.innerX - 0.9, 0.6], [DINER.faceX + 0.9, 0.6], [ko.pos.x + 0.9, ko.pos.z + 1.9]]);
      return;
    }
    A.stopWalk();
    if (A.prompting() || G.inspect.active) A.pressAfter('KeyE', 1.0, 2.2);
  },
});

// round two: his next attack is the bottle, the first time (br_bottle: he
// takes one off the counter and breaks it on the edge; the fight's
// onBottle does it on the clip's marks); Dot comes up and slides one to me
// along the counter
function* roundTwo(ctx) {
  const { game: G, cast, stage } = ctx;
  const d = stage.part('diner');
  const m = cast.get('mack');
  G.brawl.firstBottle();
  placePlates(ctx, m.pos.z);
  // Dot: up from behind the counter, the slide, down again
  const dot = cast.get('dot');
  const i = nearestStool(G.eye.z);
  const dest = counterAt(i, 0.14, 0);
  ctx.flags.jobs.add('dot', (function* () {
    yield wait(0.8);
    dot.place('diner.serve.' + i);
    const b = d.place('bottle', V(DINER.serveX + 0.55, DINER.counter.topY, dest.z), { name: 'bottle.reach', variant: 'beer' });
    let go = -1;
    const h = dot.play('slideBottle', { onMark: { release: () => { go = 0; G.sfx.play('glassSlide', dest); } } });
    while ((!h.done && h.t < h.duration) || (go >= 0 && go < 0.5)) {
      if (go >= 0) { go += 1 / 60; const u = Math.min(1, go / 0.5), e = 1 - Math.pow(1 - u, 2); b.position.x = DINER.serveX + 0.55 + (dest.x - DINER.serveX - 0.55) * e; }
      yield null;
    }
    b.position.copy(dest);
    dot.setState('duck');
  })());
  yield null;
}

// after the last blow: the end bay's glass gone, Mack on his back on the
// pavement outside, out cold
function mackOutside(ctx) {
  const { cast, stage } = ctx;
  dinerRoom(ctx, 'fight');
  const d = stage.part('diner');
  d.stool(DINER.brawlerStool).topple(V(1, 0, -0.3));
  clearRoom(ctx, true);
  const pane = stage.part('dinerFront').panes.B4;
  if (!pane.broken && stage.game) stage.glass.shatter(pane, { dir: V(1, 0, 0), power: 2 });
  const ko = stage.anchor('diner.pavement.ko');
  const mack = cast.spawn('brawler', { at: { x: ko.pos.x, z: ko.pos.z }, yaw: -Math.PI / 2 });
  mack.ko('deathBack');
  // (he has been lying there a while: the fall is over)
  for (let i = 0; i < 120; i++) mack.fig.update(1 / 60, 0);
  if (stage.game) stage.game.sfx.roomOpen(0.5);
  return mack;
}

// the matchbook comes up in the hand: red, THE CARDINAL, a black bird
function openMatchbook(ctx, mack) {
  const { game: G, hands: H } = ctx;
  const mb = mack.items.get('matchbook');
  mb.visible = true;
  H.play('showMatchbook', { onMark: { shown: () => G.sfx.play('matchbook') } });
  G.inspect.open({ prop: mb, options: { spin: [0.95, 0.35], dist: 0.3 } });
}
