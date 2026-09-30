import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { dinerRoom, makeJobs, clip, counterAt, V, DINER, stoolZ, MACK_AT, EYE_AT, BRAWL_EYE } from './_diner_room.js';
import { KO_OUT } from '../cast/brawl/clips.js';

// Scene 2, the fist fight (round 2: docs/story/FIGHT.md, the user's spec).
// The rules are game/Brawl.js (with his brain, src/cast/brawl/); this file
// stages the room round them. Beats:
//   lesson   he rises, squares up and waits: the first exchange is taught,
//            one card at a time (game/BrawlLesson.js); ?step=<1..7> jumps
//            into it. The room clears as it starts (the couple out into the
//            rain, the old man under a booth's table, Dot down behind the
//            counter, the docker back against the far wall)
//   round1   the open fight, his measured manner (100 .. 65)
//   round2   dirty (65 .. 30): the bottle broken on the counter, plates and
//            mugs thrown, the shove; Dot slides me a bottle
//   round3   wild (30 .. 12): haymakers, the rush, a stool; he bleeds, his
//            cap goes; Dot slides me another
//   reel     out on his feet (12): he reels to the nearer window, his back
//            to the glass (B2 or B4, the finish spots)
//   ko       my last hard punch: out through that window onto the pavement
//            (?win=B2 for the other); then the walk out of the door
//   outside  by him on the wet pavement in the glass: E search
//   matchbook  the red matchbook in the hand; pocketed: two shots far off
// Losing is not failing: black, and up at the start of his manner with 60.
const START = {
  // where a jump into each part of the fight finds us: him, me
  lesson: { him: MACK_AT, me: EYE_AT },
  round1: { him: MACK_AT, me: EYE_AT },
  round2: { him: { x: -12.55, z: 3.4 }, me: { x: -12.95, z: 5.0 } },
  round3: { him: { x: -12.7, z: -1.1 }, me: { x: -12.95, z: 0.55 } },
};
const MANNER_BEAT = { measured: 'round1', dirty: 'round2', wild: 'round3', out: 'reel' };
const BEAT_MANNER = { round1: 'measured', round2: 'dirty', round3: 'wild', reel: 'out' };
const BRAWL_ROUND = { round1: 1, round2: 2, round3: 3 };
const WINDOWS = ['B2', 'B4'];
const Q = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams(''));
// the window he went out of: ?win= for a jump, else the save's (a CONTINUE
// at 'outside' after a B2 finish found him outside B4: only ?win= was read)
const winOf = (ctx) => {
  const q = Q().get('win');
  if (q === 'B2' || q === 'B4') return q;
  const s = ctx.game && ctx.game.save && ctx.game.save.flags && ctx.game.save.flags.window;
  return s === 'B2' ? 'B2' : 'B4';
};

// where he lies after the last blow: out on the pavement off that window
export const landing = (w) => ({ x: DINER.finish[w].x + KO_OUT.hips, z: DINER.finish[w].z });

// the room clears (at once for a jump, played out as the fight begins)
function clearRoom(ctx, now) {
  const { cast, stage } = ctx;
  const front = stage.part('dinerFront');
  const jobs = ctx.flags.jobs;
  const her = cast.get('couple_her'), him = cast.get('couple_him'), old = cast.get('oldman'), dot = cast.get('dot'), dk = cast.get('docker');
  const hide = 'diner.booth.1.b';
  if (now) {
    for (const c of [her, him]) if (c) cast.remove(c);
    if (old) { old.place(hide); old.setState('cower'); }
    if (dot) { dot.place('diner.serve.3'); dot.setState('duck'); }
    if (dk) { dk.place({ x: -13.1, z: 10.9 }, Math.PI); dk.setState('idle'); }
    return;
  }
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
  if (old) jobs.add('oldman', (function* () { yield wait(1.6); yield* clip(old, 'startle'); yield* old.walkTo(hide); old.setState('cower'); })());
  if (dot) jobs.add('dot', (function* () { yield wait(0.6); yield* clip(dot, 'startle'); dot.setState('duck'); })());
  if (dk) jobs.add('docker', (function* () { yield wait(2.2); yield* dk.walkTo({ x: -13.1, z: 10.9 }); dk.face(Math.PI); dk.setState('idle'); })());
}

// the weapon rack (FIGHT.md §4): two bottles and three plates on the
// counter, two mugs; the stools and B2's chairs come off the floor
const RACK = [
  ['bottle', 3, 0.16, 0.1, 'fight.bottle1', 'beer'], ['bottle', 7, 0.16, -0.2, 'fight.bottle2', 'beer'],
  ['plate', 5, 0.2, 0.3, 'fight.plate1'], ['plate', 8, 0.22, 0.2, 'fight.plate2'], ['plate', 2, 0.24, -0.35, 'fight.plate3'],
  ['mug', 5, 0.18, -0.25, 'fight.mug1'], ['mug', 9, 0.2, 0.35, 'fight.mug2'],
];
function setRack(ctx) {
  const d = ctx.stage.part('diner');
  for (const [kind, i, back, dz, name, variant] of RACK) d.place(kind, counterAt(i, back, dz), { name, variant: variant || null });
}

// the room the rules fight in (Brawl.start's room)
function brawlRoom(ctx) {
  const { stage, game: G } = ctx;
  const d = stage.part('diner'), front = stage.part('dinerFront');
  const B = stage.breakables;
  const stools = d.stools.map((st, i) => ({ object: st.object, handle: st.handle, pos: V(DINER.stools.x, DINER.floorY, stoolZ(i + 1)), i: i + 1, taken: false, st }));
  const cafe = (d.booths.cafe || []).map((t) => ({ ...t, chairs: t.chairs.map((c) => ({ ...c, taken: false })) }));
  const pc = d.pieCase;
  const pa = stage.anchor('diner.piecase');
  const pcPos = pa ? pa.pos.clone() : V(DINER.counter.frontX - 0.3, DINER.counter.topY, 7);
  // (out of the room: off the floor, out of the bullets' world, its collider gone)
  const lift = (o, handle) => {
    if (handle) B.snapshot(handle);
    if (o.parent) o.parent.remove(o);
    o.traverse((m) => { if (m.isMesh) stage.removeSolid(m); });
    if (handle && handle.collider) for (const arr of [stage.colliders.circles, stage.colliders.boxes]) { const k = arr.indexOf(handle.collider); if (k >= 0) { arr.splice(k, 1); handle.colArr = arr; } }
    if (handle) handle.broken = true;
    o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.setScalar(1);
    return o;
  };
  const counterItems = () => {
    const out = [];
    for (const [name, o] of d.items) {
      const k = o.userData.kind;
      if (!name.startsWith('fight.') || name.endsWith('.sliding')) continue;
      const kind = k === 'bottle' ? 'bottle' : k === 'plate' ? 'plate' : k === 'mug' ? 'mug' : null;
      if (!kind) continue;
      const pos = o.getWorldPosition(V(0, 0, 0));
      out.push({ name, kind, object: o, pos, stand: V(-13.2, 0, pos.z), take: () => d.take(name), available: () => d.items.get(name) === o });
    }
    return out;
  };
  const floorItems = () => {
    const out = [];
    for (const s of stools) {
      if (s.taken || s.handle.toppled || s.handle.broken || s.i === DINER.playerStool) continue;
      out.push({ name: 'stool.' + s.i, kind: 'stool', object: s.object, pos: s.pos, stand: V(s.pos.x + 0.62, 0, s.pos.z), take: () => { s.taken = true; return lift(s.object, s.handle); }, available: () => !s.taken && !s.handle.toppled && !s.handle.broken });
    }
    for (const t of cafe) for (const c of t.chairs) {
      if (c.taken || c.handle.toppled || c.handle.broken) continue;
      out.push({ name: 'chair', kind: 'chair', object: c.object, pos: c.pos, stand: V(c.pos.x - 0.6, 0, c.pos.z), take: () => { c.taken = true; return lift(c.object, c.handle); }, available: () => !c.taken && !c.handle.toppled });
    }
    return out;
  };
  let slides = 0;
  return {
    stools, cafe, counterX: DINER.counter.frontX,
    bounds: { x0: DINER.backX, x1: DINER.innerX, z0: DINER.zMin, z1: DINER.zMax },
    jukebox: { pos: V(DINER.jukebox.x, 0, DINER.zMin + 0.62), hit: (p) => d.jukebox.hit(p), next: () => d.jukebox.next() },
    pieCase: { pos: pcPos, get broken() { return !!(pc && pc.handle && pc.handle.broken); }, burst: (dir) => { if (pc && pc.handle) B.hit(pc.handle, { point: pcPos.clone(), dir: dir.clone(), power: 9, by: 'body' }); } },
    windows: WINDOWS.map((name) => ({ name, spot: DINER.finish[name], pane: front.panes[name], land: landing(name) })),
    items: () => [...counterItems(), ...floorItems()],
    hisItem(kind, near) {
      const all = kind === 'stool' ? floorItems().filter((x) => x.kind === 'stool') : counterItems().filter((x) => x.kind === kind);
      let best = null, bd = 6;
      const e = G.eye;
      for (const it of all) {
        // (not one he would have to walk through me to reach)
        const sx = it.stand.x - e.x, sz = it.stand.z - e.z;
        if (Math.hypot(sx, sz) < 1.1) continue;
        const dd = Math.hypot(it.pos.x - near.x, it.pos.z - near.z);
        if (dd < bd) { bd = dd; best = it; }
      }
      return best;
    },
    // his back into the counter: what stands near flies off it, the cups jump
    counterHit(at, dir) {
      d.cupsRattle(1.2, 0.8);
      for (const [name, o] of [...d.items]) {
        const p = o.getWorldPosition(V(0, 0, 0));
        // (the weapon rack stays for the fight; the room's own china flies)
        if (name.startsWith('fight.') || Math.abs(p.z - at.z) > 0.9 || p.y < DINER.counter.topY - 0.05 || p.x < DINER.counter.frontX - 0.5) continue;
        const k = o.userData.kind;
        if (!['plate', 'cup', 'saucer', 'mug', 'bottle', 'tumbler'].includes(k)) continue;
        d.take(name);
        stage.scene.add(o); o.position.copy(p); o.updateMatrixWorld(true);
        B.hit(B.add(o, { kind: k, hp: 1, solid: false }), { point: p.clone(), dir: V(dir.x - 0.6, 0.4, dir.z).normalize(), power: 9, by: 'body' });
      }
    },
    counterBump() { d.cupsRattle(1.2, 0.7); },
    // Dot slides me a bottle down the counter (the lesson; his first bottle;
    // when he bleeds): it stops opposite me
    dotSlide(why) {
      if (slides >= 3) return;
      slides++;
      const dot = ctx.cast.get('dot');
      if (!dot) return;
      const i = Math.max(1, Math.min(9, Math.round((DINER.stools.z1 - G.eye.z) / DINER.stools.step) + 1));
      const dest = counterAt(i, 0.16, Math.max(-0.5, Math.min(0.5, (G.eye.z - stoolZ(i)) * 0.6)));
      const name = 'fight.dot' + slides;
      ctx.flags.jobs.add('dot', (function* () {
        yield wait(why === 'lesson' ? 0.4 : 0.9);
        dot.place('diner.serve.' + i);
        const b = d.place('bottle', V(DINER.serveX + 0.55, DINER.counter.topY, dest.z), { name: name + '.sliding', variant: 'beer' });
        let go = -1;
        const h = dot.play('slideBottle', { onMark: { release: () => { go = 0; G.sfx.play('glassSlide', dest); } } });
        while ((!h.done && h.t < h.duration) || (go >= 0 && go < 0.5)) {
          if (go >= 0) { go += 1 / 60; const u = Math.min(1, go / 0.5), e = 1 - Math.pow(1 - u, 2); b.position.x = DINER.serveX + 0.55 + (dest.x - DINER.serveX - 0.55) * e; }
          yield null;
        }
        d.take(name + '.sliding');
        d.place('bottle', dest, { name, variant: 'beer' });
        dot.setState('duck');
      })());
    },
  };
}

// the room as a part of the fight finds it (a jump, a retry under the black)
function stageFight(ctx, part, { retry = false } = {}) {
  const { cast, stage, controller: C, hands } = ctx;
  const d = stage.part('diner');
  dinerRoom(ctx, 'fight', { retry });
  // (the café tables and chairs as they stood; the rack on the counter)
  for (const t of d.booths.cafe || []) { stage.breakables.restore(t.handle); for (const c of t.chairs) stage.breakables.restore(c.handle); }
  d.stool(DINER.brawlerStool).topple(V(1, 0, -0.3));
  clearRoom(ctx, true);
  setRack(ctx);
  ctx.flags.room = null;
  const S = START[part] || START.round1;
  const mack = cast.spawn('brawler', { at: { x: S.him.x, z: S.him.z }, yaw: Math.atan2(S.me.x - S.him.x, S.me.z - S.him.z) });
  if (part === 'round3') { if (mack.bleed) mack.bleed(1); mack.capLoose = true; }
  hands.hold(null, 'R'); hands.hold(null, 'L');
  hands.equip('fists');
  const yaw = Math.atan2(-(S.him.x - S.me.x), -(S.him.z - S.me.z));
  C.setPose(S.me.x, S.me.z, yaw, -0.08);
  C.setMode('brawl', { opponent: mack, eyeY: BRAWL_EYE, pos: S.me, yaw });
  ctx.flags.mack = mack;
  return mack;
}

// into the rules: a part's start, a retry, the lesson
function beginFight(ctx, mack, { manner = 'measured', hp = null, lesson = false, retry = false } = {}) {
  const { game: G, stage } = ctx;
  const B = G.brawl;
  const room = ctx.flags.room || (ctx.flags.room = brawlRoom(ctx));
  B.start({
    opponent: mack, manner, hp, rng: ctx.rng, retry, lesson, room,
    // (a retry: the room set again under the black, without a sound; the
    // lesson is not taught twice)
    onRetry: (m) => {
      const part = m === 'out' ? 'round3' : MANNER_BEAT[m];
      const mk = stageFight(ctx, part, { retry: true });
      beginFight(ctx, mk, { manner: m, hp: m === 'out' ? 12 : null, retry: true });
    },
    onManner: (m) => { if (m === 'wild') room.dotSlide('bleeds'); },
    onGlass: (w) => {
      if (!w) return;
      const hip = mack.bones.chest.getWorldPosition(V(0, 0, 0));
      stage.glass.shatter(w.pane, { dir: V(1, 0.15, 0), power: 2, by: 'body', at: hip });
      // (the hole he made is a way out: the wall opens there)
      const fr = stage.part('dinerFront'); if (fr && fr.openBay) fr.openBay(w.name);
      G.sfx.play('break_glass_big', V(DINER.faceX, 1.8, DINER.bays[w.name]));
      // the street's rain and its sound come into the room
      G.sfx.roomOpen(0.5);
      ctx.flags.window = w.name;
      if (G.save && G.save.flags) G.save.flags.window = w.name;
    },
  });
  return B;
}

export default defineScene({
  id: 'fight', stage: 'block', title: 'II', name: 'The Fight',
  beats: ['lesson', 'round1', 'round2', 'round3', 'reel', 'ko', 'outside', 'matchbook'],
  save: ['lesson', 'round1', 'round2', 'round3', 'outside'],

  setup: {
    lesson(ctx) {
      ctx.flags.jobs = makeJobs();
      stageFight(ctx, 'lesson');
      ctx.flags.startLesson = parseInt(Q().get('step') || '1', 10) || 1;
    },
    round1(ctx) { ctx.flags.jobs = makeJobs(); stageFight(ctx, 'round1'); },
    round2(ctx) { ctx.flags.jobs = makeJobs(); stageFight(ctx, 'round2'); },
    round3(ctx) { ctx.flags.jobs = makeJobs(); stageFight(ctx, 'round3'); },
    reel(ctx) { ctx.flags.jobs = makeJobs(); stageFight(ctx, 'round3'); },
    // the last blow: he stands reeling at the window, my hard punch is on its
    // way (t= scrubs his flight: the glass goes at ~0.34 s)
    ko(ctx) {
      ctx.flags.jobs = makeJobs();
      const w = winOf(ctx);
      const m = stageFight(ctx, 'round3');
      const s = DINER.finish[w];
      m.place({ x: s.x, z: s.z }, -Math.PI / 2);
      const me = { x: s.x - 1.35, z: s.z + 0.25 };
      const yaw = Math.atan2(-(s.x - me.x), -(s.z - me.z));
      ctx.controller.setPose(me.x, me.z, yaw, -0.1);
      ctx.controller.setMode('brawl', { opponent: m, eyeY: BRAWL_EYE, pos: me, yaw });
      const B = beginFight(ctx, m, { manner: 'out', hp: 12 });
      const win = ctx.flags.room.windows.find((x) => x.name === w);
      Object.assign(B.him, { window: win, spot: win.spot, atSpot: true, state: 'reel' });
      B.ko();
    },
    outside(ctx) {
      ctx.flags.jobs = makeJobs();
      const w = winOf(ctx);
      mackOutside(ctx, w);
      ctx.hands.equip('empty');
      ctx.controller.setMode('walk', { pose: outsidePose(w) });
    },
    matchbook(ctx) {
      ctx.flags.jobs = makeJobs();
      const w = winOf(ctx);
      const mack = mackOutside(ctx, w);
      ctx.hands.equip('empty');
      const L = landing(w), sg = w === 'B2' ? -1 : 1;
      ctx.controller.setMode('walk', { pose: { x: L.x + 1.1, y: 0.15 + 1.05, z: L.z + sg * 1.3, yaw: w === 'B2' ? 2.64 : 0.5, pitch: -0.35 } });
      openMatchbook(ctx, mack);
    },
  },

  *script(ctx) {
    const { game: G, hands: H, cast } = ctx;
    const B = G.brawl;
    const jobs = ctx.flags.jobs || (ctx.flags.jobs = makeJobs());
    ctx.onStep((dt) => jobs.step(dt));
    const mack = () => cast.get('mack');
    const fighting = ['lesson', 'round1', 'round2', 'round3', 'reel'];

    // ---- into the fight: the lesson (the first time), or the part jumped to
    if (ctx.kept) {
      // (a cut straight from the diner: the room goes on as it stands; he
      // squares up from where he stood, turning to me the short way)
      const m = mack();
      setRack(ctx);
      const P = G.controller.eyePose();
      G.controller.setMode('brawl', { opponent: m, eyeY: BRAWL_EYE, pos: { x: P.x, z: P.z }, yaw: P.yaw });
      H.hold(null, 'R'); H.hold(null, 'L');
      H.equip('fists');
      beginFight(ctx, m, { lesson: true });
      clearRoom(ctx, false);
    } else if (fighting.includes(ctx.from)) {
      if (ctx.from === 'lesson') beginFight(ctx, mack(), { lesson: ctx.flags.startLesson || 1 });
      else if (ctx.from === 'reel') beginFight(ctx, mack(), { manner: 'out', hp: 12 });
      else beginFight(ctx, mack(), { manner: BEAT_MANNER[ctx.from] });
    }
    // (the cut from the diner arrives as 'round1' kept: it is the lesson)
    const taught = ctx.kept || ctx.at('lesson');
    if (ctx.at('reel') || ctx.kept) {
      if (taught) {
        yield beat('lesson');
        yield until(() => !B.lesson || !B.active);
      }
      for (const b of ['round1', 'round2', 'round3']) {
        if (!ctx.at(b) && !ctx.kept) continue;
        yield beat(b);
        yield until(() => !B.active || B.round > BRAWL_ROUND[b]);
      }
      yield beat('reel');
      yield until(() => B.finished);
    }

    // ---- the last blow, and the walk out -----------------------------------------------------
    if (ctx.at('ko')) {
      yield beat('ko');
      yield until(() => !B.active);
      H.equip('empty');
      const P = G.controller.eyePose();
      G.controller.setMode('walk', { pose: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: Math.max(-0.2, P.pitch) } });
      G.save.flags.won = true;
      const L = landing(ctx.flags.window || B.stats.window || 'B4');
      let idle = 0;
      yield until(() => {
        idle += 1 / 60;
        // (polish, the bug hunt: only while the door is in the frame - its
        // tick on the door; with the door behind me or off to the side the
        // hint drew mid-screen, pointing at nothing)
        const at = idle > 7 && G.eye.x < DINER.innerX ? G.screenOf(V(DINER.faceX, 1.3, 0.6)) : null;
        const inFrame = at && at.x > innerWidth * 0.06 && at.x < innerWidth * 0.94 && at.y > innerHeight * 0.06 && at.y < innerHeight * 0.94;
        if (inFrame) G.hud.prompt('WASD  the door', at, 'scene');
        else G.hud.clearPrompt('scene');
        return G.eye.x > DINER.faceX && Math.hypot(G.eye.x - L.x, G.eye.z - L.z) < 2.8;
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
      yield wait(0.8);
      const far = V(-9, 1.5, -27);
      G.sfx.pistol(far, G.eye.distanceTo(far));
      yield wait(0.7);
      G.sfx.pistol(far, G.eye.distanceTo(far));
      ctx.flags.shots = 2;
      yield wait(2);
      // (on to the next scene of the story's order; with none yet, the
      // "to be continued" card)
      ctx.next();
    }
  },

  // the autoplay driver: the fight read by its marks, then out and search
  auto(ctx, A) {
    const G = ctx.game;
    if (G.brawl.active) { A.fight(G.brawl); return; }
    if (ctx.beat === 'ko') {
      const L = landing(ctx.flags.window || G.brawl.stats.window || 'B4');
      const path = [[-12.6, 0.6], [DINER.innerX - 0.9, 0.6], [DINER.faceX + 0.9, 0.6], [L.x + 1.2, L.z + (L.z > 0.6 ? -1.6 : 1.6)]];
      A.walkPath(path);
      return;
    }
    A.stopWalk();
    if (A.prompting() || G.inspect.active) A.pressAfter('KeyE', 1.0, 2.2);
  },
});

// on the pavement off the window he went through
function outsidePose(w) {
  const L = landing(w);
  return w === 'B2' ? { x: L.x + 1.3, y: 0.15 + 1.65, z: L.z - 2.1, yaw: 2.52, pitch: -0.55 } : { x: L.x + 1.3, y: 0.15 + 1.65, z: L.z + 2.1, yaw: 0.62, pitch: -0.55 };
}

// after the last blow: that window's glass gone, Mack on his back on the
// pavement outside it, out cold
function mackOutside(ctx, w = 'B4') {
  const { cast, stage } = ctx;
  dinerRoom(ctx, 'fight');
  const d = stage.part('diner');
  d.stool(DINER.brawlerStool).topple(V(1, 0, -0.3));
  clearRoom(ctx, true);
  const pane = stage.part('dinerFront').panes[w];
  if (!pane.broken && stage.game) stage.glass.shatter(pane, { dir: V(1, 0.15, 0), power: 2, by: 'body', at: V(DINER.faceX - 0.1, 1.5, DINER.finish[w].z) });
  { const fr = stage.part('dinerFront'); if (fr && fr.openBay && pane.broken) fr.openBay(w); }
  const L = landing(w);
  const mack = cast.spawn('brawler', { at: { x: L.x, z: L.z }, yaw: -Math.PI / 2 });
  mack.setState('br_down', 0);
  mack.down = true; mack.state = 'ko'; mack.base = 'ko';
  for (let i = 0; i < 30; i++) mack.fig.update(1 / 60, 0);
  ctx.flags.window = w;
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
