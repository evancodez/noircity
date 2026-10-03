import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { gunsOf } from '../guns/Guns.js';
import { roomAs, carry, office, inkPrompt, doorsUse, roomOf, V } from './office/room.js';
import { live, palmOn } from './office/hands.js';
import { roomReacts, papers } from './office/fight.js';
import { DESK, DOOR, DOORS, OUTER, CORR, ROOM, LIFT, WIN, OPEN } from '../stages/office/plan.js';

// Chapter IV, The Door ([C5] wave C: the first gunfight, on lane C2's gun
// kit - docs/story/seams/GUNS.md; the brief docs/story/briefs/C5_OFFICE.md).
// The same room a minute after the check went into my coat. Beats, each a
// checkpoint (a fall is the kit's: the reason, black, back at the beat):
//   shadows   a board creaks in the corridor; the revolver comes out from
//             under my arm. The camera is taken to their shadows on the
//             frosted glass of the suite's door (three of them: their real
//             joints), then given back: a moment, and a real choice - tip
//             the desk and get low behind it (E, then C); shoot through the
//             glass at the shadows (they are there: the rounds go through and
//             hit - and they come in angry and sooner); or move (the outer
//             office's corner, the files, 305's door). Do nothing in time and
//             the door is kicked in. Movement 1, the door: the kicker comes
//             through, one works the jamb, one smashes the sidelight and fires
//             through it
//   flank     the handle of the connecting door to 305 turns (heard, seen):
//             two that way, at my side - where I was safe I am not
//   corridor  quiet. "Check the corridor." The lift's dial sweeps up to 3, the
//             cage folds open: two men (one a Tommy gun: the pin, the wait for
//             his drum); the washroom's door: one more; the stair door: the
//             heavy. Only the revolver
//   quiet     the smoke, the rain. "See if more are coming." At the street
//             window, E: chapter V (the watcher) begins on the frame through
//             the blind (lane C6's)
// The numbers a chapter may turn (GUNS.md §2): maxFiring 2, settleK 1.2 (a
// first gunfight), dmgK 0.9.
const EAST = -Math.PI / 2, WEST = Math.PI / 2;
const OPEN_Z0 = 2.5;
const AREA = { x0: -9.6, x1: 5.6, z0: -7.3, z1: 9.4 };
const NUM = { maxFiring: 2, settleK: 1.2, dmgK: 0.9 };
// (the corridor: four, the heavy last - a hair slower to settle than the room (tuned between the good hand at the
// cart, who must win it, and the hand standing in the middle of the corridor trading, who must not: at 1.4 / 0.8
// he won it); the heavy three of my rounds, not five: the first gunfight's heavy, met with a full cylinder)
const NUM_CORR = { dmgK: 0.9, settleK: 1.25 };
const HEAVY_DMGK = 0.7;
// (the flank: a little slower to settle - they come at my side, the time to turn)
const NUM_FLANK = { settleK: 1.35 };
// the door's three: where they stand at the glass (corridor side), and their way in
const DOORMEN = [
  // the kicker: through the door when it goes, into the outer office
  { name: 'kicker', at: { x: -4.42, z: 3.4 }, yaw: EAST, way: [{ door: 'AMES' }, { x: -2.7, z: 3.2, run: true }] },
  // the jamb: he works the door from its south jamb
  { name: 'jamb', at: { x: -4.55, z: 2.45 }, yaw: EAST, way: [{ door: 'AMES' }], door: 'hold' },
  // the sidelight: its glass goes, he fires through the frame
  // (a way of one step, where he stands: a man with no way fights from his first frame - `start` holds only an entry)
  { name: 'side', at: { x: -4.5, z: 4.8 }, yaw: EAST, way: [{ x: -4.5, z: 4.75 }] },
];
// the flank's two: from the corridor's south end, through 305, at the connecting door (as a pair)
const FLANKERS = [
  { name: 'flankA', at: { x: -4.75, z: -6.3 }, way: [{ door: 'D305' }, { x: 2.9, z: -2.5, run: true }, { door: 'CONN' }], door: 'hold' },
  // ([C5] after play: the second a few seconds behind the first and in through the door, not a pair working its
  // jambs - two guns at once out of a doorway at my side lost the good hand the flank three tries in four)
  { name: 'flankB', at: { x: -5.05, z: -6.75 }, way: [{ door: 'D305' }, { x: 3.6, z: -2.9, run: true }, { door: 'CONN' }, { x: 4.2, z: 1.3, run: true }], late: 2.5 },
];
// (the plays: each beat's cover places for the good hand - behind it, facing the way they come - and the bad hand's open floor)
const SPOTS = {
  // (tipped: true - only with the desk over; false - only with it standing: its footprint is not a place to stand)
  shadows: [{ x: DESK.x - 0.05, z: DESK.z - 0.4, yaw: WEST, tipped: true }, { x: DESK.x - 0.05, z: DESK.z + 0.45, yaw: WEST, tipped: true }, { x: 4.85, z: 2.65, yaw: WEST, tipped: false }, { x: -0.85, z: 5.3, yaw: WEST }, { x: 0.5, z: OPEN_Z0 - 0.45, yaw: WEST + 0.3 }],
  // (the flank from the connecting door, south-east: the tipped desk's other side; north of the standing desk)
  flank: [{ x: 2.35, z: 3.8, yaw: EAST, tipped: true }, { x: DESK.x, z: DESK.z + DESK.w / 2 + 0.45, yaw: 0.15, tipped: false }, { x: 0.5, z: OPEN_Z0 - 0.45, yaw: EAST + 2.6 }],
  corridor: [{ x: -0.85, z: 5.3, yaw: WEST }, { x: -0.85, z: 1.4, yaw: WEST }, { x: -4.35, z: -0.05, yaw: 0 }, { x: -3.25, z: -2.05, yaw: WEST }],
};
const OPENS = { shadows: { x: 1.8, z: 3.4 }, flank: { x: 2.4, z: 2.4 }, corridor: { x: -4.8, z: 1.8 } };
// the warnings and the falls in this chapter's words (the kit's for the rest)
const WARN = { door: 'Behind you! The door!' };
const WHY = { default: 'Shot.' };

// the room at a beat's start: the gun in hand and full, the kit's encounter
function prepare(ctx, name, { reset = true } = {}) {
  const G = ctx.game, C = ctx.controller, K = gunsOf(G), O = office(ctx);
  const R = G._c5 || (G._c5 = {});
  carry(ctx, { armed: true });
  if (reset) roomAs(ctx, 'fight');
  O.door.closer = false;
  // (a retry: the room as this checkpoint had it - the door in, the sidelight gone, the desk as I left it)
  if (reset && name !== 'shadows') {
    O.door.set(1.62); O.door.locked = false;
    if (O.side.pane.state !== 'gone') ctx.stage.glass.shatter(O.side.pane, { dir: V(1, 0, 0), power: 1, by: 'body' });
    if (R.tipped) O.tipDesk({ now: true });
  }
  if (reset && name === 'corridor') { O.doors.CONN.set(1.62); O.lift.setY(-3.3); O.lift.dial(1); }
  // where I stand
  if (reset) {
    if (name === 'shadows') { C.setPose(2.9, 2.2, WEST - 0.25, -0.05); C.setMode('gun', { crouch: false }); }
    else if (name === 'flank') {
      if (R.tipped) { C.setPose(DESK.x - 0.05, DESK.z + 0.05, WEST, -0.05); C.setMode('gun', { crouch: true }); }
      else { C.setPose(2.0, 4.5, WEST + 0.2, -0.05); C.setMode('gun', { crouch: false }); }
    } else if (name === 'corridor') { C.setPose(-3.2, 3.35, WEST, 0.0); C.setMode('gun', { crouch: false }); }
    else if (name === 'quiet') { C.setPose(2.6, 3.0, EAST + 0.3, -0.05); C.setMode('gun', { crouch: false }); }
    G.eye.copy(G.camera.position);
  } else {
    const P = C.eyePose();
    C.setPose(P.x, P.z, P.yaw, P.pitch);
    C.setMode('gun', { crouch: false });
  }
  G.health.reset();
  K.arm('revolver');
  K.end();
  if (name === 'quiet') return;
  K.begin({ to: name, ...NUM, ...(name === 'corridor' ? NUM_CORR : name === 'flank' ? NUM_FLANK : {}), flankAfter: 0, area: AREA, warn: { ...WARN, ...(name === 'flank' ? { door: 'The other door! Behind you!' } : {}) }, why: WHY });
  const F = ctx.flags;
  F.men = [];
  // (the plays' record of the beat, lane C2's driver's: its cover places, where the open is, won)
  // (block: the desk's footprint as it stands or lies - a hand walks round it, not into it)
  F.c2 = { beat: name, get spots() { const t = !!O.desk.tip; return (SPOTS[name] || []).filter((sp) => sp.tipped == null || sp.tipped === t); }, open: OPENS[name] || null, won: false,
    get block() { const c = O.desk.collider; return c ? { x0: c.cx - c.hx, x1: c.cx + c.hx, z0: c.cz - c.hz, z1: c.cz + c.hz } : null; } };
  F.go = null;
  const spawn = (m, extra = {}) => { const h = K.spawn({ kind: m.kind || 'pistol', at: m.at, yaw: m.yaw ?? null, way: m.way ? { steps: m.way } : null, door: m.door || null, cover: !!m.cover, wait: m.wait ?? 0, start: m.start || null, name: m.name, hp: m.hp ?? null, ...extra }); h.c5 = m.name; F.men.push(h); return h; };
  F.spawn = spawn;
  if (name === 'shadows') for (const m of DOORMEN) spawn({ ...m, start: () => F.go != null && G.time - F.go > (m.name === 'kicker' ? 0.05 : m.name === 'jamb' ? 0.5 : 0.35) });
  if (name === 'flank') {
    // (a door man the first movement left: still at his cover in the outer office)
    for (const p of (reset ? R.doorLeft || [] : [])) spawn({ name: 'doorLeft', at: p, cover: true, wait: 1.5 });
    for (const m of FLANKERS) spawn({ ...m, wait: (m.name === 'flankA' ? 0.6 : 0.9) + (m.late || 0) });
  }
  if (name === 'corridor') corridorMen(ctx, spawn);
}

// the corridor's men: two in the lift (one a Tommy gun) once its cage is open,
// one out of the washroom, the heavy up the stair
function corridorMen(ctx, spawn) {
  const G = ctx.game, O = office(ctx), F = ctx.flags;
  const cx = (LIFT.x0 + LIFT.x1) / 2;
  F.liftOpen = false; F.liftCalled = null;
  spawn({ name: 'liftA', kind: 'pistol', at: { x: cx - 0.2, z: LIFT.z1 - 0.35 }, yaw: Math.PI, start: () => F.liftOpen, wait: 0.2, way: [{ x: cx, z: CORR.z0 + 1.6, run: true }] });
  spawn({ name: 'tommy', kind: 'tommy', at: { x: cx + 0.2, z: LIFT.z0 + 0.4 }, yaw: Math.PI, start: () => F.liftOpen, wait: 0.9, way: [{ x: cx + 0.3, z: CORR.z0 + 1.0 }] });
  // (a door down the hall, 306's: once the lift's two are down - the same end of the corridor as the lift and
  // the stair: the first gunfight's corridor comes at me from one way, with one cover that answers it, the cart.
  // [C5] after play: from the washroom, behind me, the good hand down at the cart was flanked 6 tries of 6)
  const liftLeft = () => (F.men || []).filter((h) => h.alive && (h.c5 === 'liftA' || h.c5 === 'tommy')).length;
  spawn({ name: 'wc', kind: 'pistol', at: { x: -2.4, z: -5.5 }, yaw: Math.PI / 2, start: () => F.liftOpen && G.time - F.liftOpen > 7 && (liftLeft() === 0 || G.time - F.liftOpen > 30), way: [{ door: 'D306' }], door: 'hold' });
  // (the heavy last: up the stair once the others are down - never the three at once and him)
  const others = () => (F.men || []).filter((h) => h.alive && h.c5 !== 'heavy').length;
  // (his start said: the gate below clanks, the line names him - the tell before the heavy)
  // (and his rounds a little lighter than the kit's heavy's - bursts at nine a second: a good hand at the cart
  // who missed him once was down 2.3 s after the first round; the first gunfight's heavy is met, not a wall)
  const heavyGo = (f) => { if (F.heavyT) return true; if (!f()) return false; F.heavyT = G.time; ctx.hud.objective('One more. On the stair.'); gunsOf(G).cfg.dmgK = HEAVY_DMGK; return true; };
  // (a breath after the last of them falls - a reload's worth - the gate below clanks open; or, the
  // corridor held to a stand-off with one of them left, he comes up anyway: nobody waits the clock out)
  spawn({ name: 'heavy', kind: 'rusher', at: { x: O.suite.flightFoot.x, z: O.suite.flightFoot.z }, yaw: -Math.PI / 2, start: () => heavyGo(() => { if (!F.liftOpen || G.time - F.liftOpen < 12) return false; if (G.time - F.liftOpen > 40 && others() <= 1) return true; if (others() > 0) { F.othersT = null; return false; } F.othersT = F.othersT || G.time; return G.time - F.othersT > 5; }), hp: 165, way: [{ door: 'GATE' }, { x: -6.4, z: -5.0 }, { door: 'STAIR' }] });
  void G;
}

export default defineScene({
  id: 'gunfight', stage: 'office',
  beats: ['shadows', 'flank', 'corridor', 'quiet'],
  save: ['flank', 'corridor', 'quiet'],
  music: { stop: 2.5 },
  objectives: { shadows: 'Someone at the door. Get ready.', flank: 'Hold the room.', corridor: 'Check the corridor.', quiet: 'See if more are coming.' },
  setup: {
    shadows(ctx) { prepare(ctx, 'shadows'); },
    flank(ctx) { prepare(ctx, 'flank'); },
    corridor(ctx) { prepare(ctx, 'corridor'); },
    quiet(ctx) { prepare(ctx, 'quiet'); office(ctx).door.set(1.62); },
  },

  *script(ctx) {
    const G = ctx.game, C = ctx.controller, K = gunsOf(G), O = office(ctx), F = ctx.flags;
    const R = G._c5 || (G._c5 = {});
    inkPrompt(ctx);
    // (straight on from III: no setup ran - the room as it stands, the gun out now)
    if (ctx.kept) prepare(ctx, ctx.beat, { reset: false });
    roomReacts(ctx);
    doorsUse(ctx, { allow: (n) => n !== 'GATE' || true });
    const D = G.director;
    // (an encounter on while the fight lasts: the HUD shows my health in a fight only while the director has one)
    D.stop(); D.groups.clear(); D.begin();
    D.run(function* () { while (G.scenes.ctx === ctx) yield null; });
    const exitFn = () => { K.end(); ctx.hud.warn(null); G.off('scene:exit', exitFn); };
    G.on('scene:exit', exitFn);
    // the warning before a fall: the kit's (none once the floor is won)
    let won = false;
    ctx.onStep(() => ctx.hud.warn(K.active && !won ? K.warning() : null));
    const alive = (names = null) => (F.men || []).filter((h) => h.alive && (!names || names.includes(h.c5))).length;
    // the shot that comes before they are in: the glass choice
    const shotFn = () => { F.shotAt = G.time; };
    G.on('shot', shotFn);
    ctx.onStep(() => { if (!G.scenes.ctx || G.scenes.ctx !== ctx) G.off('shot', shotFn); });
    // the teach at first need: rise the first time I am down; reload when the cylinder runs low in the fight
    ctx.onStep(() => {
      if (!F.roseT && (C.crouchK || 0) > 0.6 && F.go != null) { F.roseT = true; K.teach('rise'); }
      const W = G.player.weapons.active;
      if (!F.reloadT && W && Array.isArray(W.chambers) && W.chambers.filter((c) => c === 'live').length <= 2 && F.go != null) { F.reloadT = true; K.teach('reload'); }
    });
    tipPrompt(ctx);
    // ---- 1. the shadows, the moment, the door --------------------------------------------------
    if (ctx.at('shadows') && ctx.beat === 'shadows') {
      yield beat('shadows');
      const first = ctx.kept || !R.seenTake;
      R.tipped = false; R.doorLeft = null;
      O.door.closer = false;
      if (first) {
        ctx.music.stop(2.5);
        yield wait(0.6);
        // a board in the corridor; the revolver out from under my arm
        G.sfx.play('office_boardCreak', V(-4.6, 0.1, 1.2), { k: 1 });
        yield wait(0.7);
        G.sfx.play('office_draw', G.eye);
        yield wait(0.9);
        // the take: the camera to their shadows on the frosted glass, then given back
        R.seenTake = true;
        yield* take(ctx);
      } else yield wait(1.0);
      // the moment: a real choice. The kit's first card in the quiet second
      F.momentT = G.time;
      // (the revolver's first time in the story: its act, then getting low - once per save, queued one behind the other)
      if (ctx.hud.teach) ctx.hud.teach('fire', '[LMB] fire');
      if (G.fails('shadows') === 2) K.teach('crouch', { again: true }); else K.teach('crouch');
      const LEN = first ? 7.5 : 5.0;
      yield until(() => {
        const near = roomOf(G.eye.x, G.eye.z) === 'corr' || (G.eye.x < OUTER.x0 + 1.4 && Math.abs(G.eye.z - 3.4) < 2.2);
        const shot = F.shotAt != null && F.shotAt > F.momentT;
        return G.time - F.momentT > LEN || near || (shot && G.time - F.shotAt > 0.15);
      });
      // they come in: the door kicked, the sidelight's glass knocked out
      F.go = G.time;
      ctx.hud.objective('Hold the room.');
      O.door.kick();
      G.controller.shake(0.4, Math.hypot(G.eye.x - DOORS.AMES.x, G.eye.z - 3.4));
      yield wait(0.3);
      if (O.side.pane.state !== 'gone') ctx.stage.glass.shatter(O.side.pane, { dir: V(1, 0, 0), power: 1.4, by: 'body' });
      // movement 1 until the door is down to one (or it has gone on long enough)
      yield until(() => (alive(['kicker', 'jamb', 'side']) <= 1 && G.time - F.go > 6) || G.time - F.go > 40);
      R.tipped = !!O.desk.tip;
      R.doorLeft = (F.men || []).filter((h) => h.alive && ['kicker', 'jamb', 'side'].includes(h.c5)).map((h) => ({ x: h.pos.x, z: h.pos.z }));
      // ---- 2. the flank: the handle of the connecting door turns ------------------------------------
      (G._c2won || (G._c2won = [])).push('shadows');
      yield beat('flank');
      K.cfg.to = 'flank';
      K.cfg.warn = { ...WARN, door: 'The other door! Behind you!' };
      for (const m of FLANKERS) F.spawn({ ...m, wait: (m.name === 'flankA' ? 0.4 : 0.7) + (m.late || 0) });
      Object.assign(K.cfg, NUM_FLANK);
    } else if (ctx.beat === 'flank') yield beat('flank');
    if (ctx.at('flank') && ctx.beat === 'flank') {
      yield until(() => alive() === 0);
      R.tipped = !!O.desk.tip;
      (G._c2won || (G._c2won = [])).push('flank');
      yield beat('corridor');
      K.cfg.to = 'corridor';
      K.cfg.warn = { ...WARN };
      K.cfg.flankAfter = 0;
      Object.assign(K.cfg, NUM_CORR);
      corridorMen(ctx, F.spawn);
      O.lift.setY(-3.3); O.lift.setOpen(0); O.lift.dial(1);
    } else if (ctx.beat === 'corridor') yield beat('corridor');
    // ---- 3. the corridor: the lift comes up ---------------------------------------------------------
    if (ctx.at('corridor') && ctx.beat === 'corridor') {
      const t0 = G.time;
      // (quiet: I go out to look - or they come anyway)
      yield until(() => G.eye.x < OUTER.x0 + 0.5 || G.time - t0 > 16);
      O.callLift(() => { F.liftOpen = G.time; K.rebuild(); }, { from: -3.3, secs: 5.0 });
      // (a stand-off: the last of them with no line on me - the Tommy gunner pins and never comes looking, from
      // the corridor or from the lift's car. 15 s of it and he comes round to a door by me to find me)
      let lastLine = G.time, sent = -99;
      ctx.onStep(() => {
        const left = (F.men || []).filter((h) => h.alive);
        if (left.length !== 1 || !F.liftOpen) { lastLine = G.time; return; }
        const ai = G.ais.get(left[0]);
        if (!ai || !ai.brain || (ai.brain.S && ai.brain.S.entry)) { lastLine = G.time; return; }
        if (ai.brain.hasLine) lastLine = G.time;
        if (G.time - lastLine > 15 && G.time - sent > 20 && ai.brain.goRound) {
          sent = G.time; lastLine = G.time;
          // (me in the suite: to its door; me out in the corridor - down behind the cart - to 305's door beside it)
          if (roomOf(G.eye.x, G.eye.z) !== 'corr') ai.brain.goRound(O.doors.AMES, [{ x: -4.7, z: 1.2, run: true }]);
          else ai.brain.goRound(O.doors.D305, []);
        }
      });
      yield until(() => F.liftOpen && alive() === 0);
    }
    // ---- 4. the quiet: see if more are coming ---------------------------------------------------------
    if (ctx.at('quiet')) {
      if (ctx.beat !== 'quiet') { (G._c2won || (G._c2won = [])).push('corridor'); yield beat('quiet'); }
      won = true; ctx.hud.warn(null);
      K.end();
      D.stop();
      C.setMode('gun', { crouch: false });
      (G._c5won || (G._c5won = [])).push('gunfight');
      // smoke in the light, paper coming down where I look
      const rng = ctx.stage.rng.fork(3071);
      const fw = G.camera.getWorldDirection(V(0, 0, 0)).setY(0).normalize();
      papers(ctx, V(G.eye.x + fw.x * 1.9, 2.3, G.eye.z + fw.z * 1.9), V(0, -1, 0), rng, 4);
      // at the street window: E, two fingers part the slats (chapter V's first frame)
      // (at the street window, facing its blind: V takes it from there - its own E parts the slats - so the
      // window is one press, not two)
      const fv = V(0, 0, 0), wc = V(ROOM.x1 - 0.12, 1.6, (WIN.z0 + WIN.z1) / 2);
      yield until(() => { G.camera.getWorldDirection(fv); const dx = wc.x - G.eye.x, dz = wc.z - G.eye.z, d = Math.hypot(dx, dz); return d < 1.7 && (fv.x * dx + fv.z * dz) / d > 0.75; });
      // (a cut, no black, card V small over it - not `keep`: V's first beat sets itself up at this window, the
      // blind's slats and the man under the lamp (lane C6's scenes/watcher/office.js); kept, its setup never ran)
      ctx.next({ fade: 'cut', card: true });
    }
  },

  auto(ctx, A) {
    if (A.prompting()) A.pressAfter('KeyE', 1.0, 2.0);
  },
});

// the take: the camera to their shadows on the door's frosted glass (the
// lens narrowing on it across the outer office), held, and given back
function* take(ctx) {
  const G = ctx.game, C = ctx.controller, cam = G.camera;
  const P = C.eyePose();
  const glass = V(DOORS.AMES.x, 1.5, 3.9);
  const yaw1 = Math.atan2(-(glass.x - P.x), -(glass.z - P.z));
  const pitch1 = Math.atan2(glass.y - P.y, Math.hypot(glass.x - P.x, glass.z - P.z));
  const fov0 = cam.fov, fov1 = Math.max(16, Math.min(40, 2 * Math.atan(1.6 / Math.hypot(glass.x - P.x, glass.z - P.z)) * 180 / Math.PI));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const dy = wrap(yaw1 - P.yaw);
  const ease = (u) => u * u * (3 - 2 * u);
  const T = 3.0;
  C.setMode('cutscene', { track: (t) => {
    const u = t < 0.7 ? ease(t / 0.7) : t < T - 0.6 ? 1 : ease(Math.max(0, (T - t) / 0.6));
    cam.fov = fov0 + (fov1 - fov0) * u; cam.updateProjectionMatrix();
    return { x: P.x, y: P.y, z: P.z, yaw: P.yaw + dy * u, pitch: P.pitch + (pitch1 - P.pitch) * u };
  } });
  yield wait(T);
  cam.fov = fov0; cam.updateProjectionMatrix();
  C.setPose(P.x, P.z, P.yaw, P.pitch);
  C.setMode('gun', { crouch: false });
}

// E: the desk over on its front (the lamp thrown off it), the heave; then C to get low
function tipPrompt(ctx) {
  const G = ctx.game, O = office(ctx);
  // (from its chair's side, behind it: it goes over away from me, toward the opening)
  const behind = () => G.eye.x > DESK.x - 0.1 && G.eye.x < DESK.x + DESK.d / 2 + 1.0 && Math.abs(G.eye.z - DESK.z) < DESK.w / 2 + 0.5;
  ctx.interact.add({ id: 'tip', at: V(DESK.x + 0.1, DESK.h + 0.1, DESK.z), range: 2.0, cone: 0.85, prompt: 'tip the desk over', when: () => !O.desk.tip && behind() && ctx.beat !== 'quiet', onUse: () => {
    if (!O.tipDesk()) return;
    G.sfx.play('office_deskTip', V(DESK.x, 0.6, DESK.z));
    heave(ctx);
    ctx.interact.remove('tip');
  } });
}

// the heave: the left palm on the desk's near edge as it goes up and over (object first)
function heave(ctx) {
  const G = ctx.game, O = office(ctx), H = ctx.hands, e = G.eye;
  const d = O.desk;
  const edgeX = DESK.x + DESK.d / 2;
  const zc = Math.max(DESK.z - DESK.w / 2 + 0.3, Math.min(DESK.z + DESK.w / 2 - 0.3, e.z));
  d.pivot.updateMatrixWorld(true);
  const at = d.pivot.worldToLocal(V(edgeX - 0.03, DESK.h + 0.005, zc + 0.22));
  const pin = () => {
    const p = d.pivot.localToWorld(at.clone());
    palmOn(H, 'L', p, V(0, -1, 0).transformDirection(d.pivot.matrixWorld), V(-1, 0, -0.18).transformDirection(d.pivot.matrixWorld));
  };
  pin();
  live(H, { L: 'b2liveL' });
  let t = 0, off = false;
  const fn = () => {
    if (off) return;
    t += 1 / 60;
    if (d.tipped < 0.08 && t < 0.24) { pin(); return; }
    off = true; live(H, {});
  };
  ctx.onStep(fn);
}
void THREE; void DOOR; void OPEN; void CORR;
