import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { gunsOf } from '../guns/Guns.js';
import { roomAs, carry, office, inkPrompt, doorsUse, roomOf, V } from './office/room.js';
import { live, palmOn } from './office/hands.js';
import { roomReacts, papers } from './office/fight.js';
import { DESK, DOOR, DOORS, OUTER, CORR, ROOM, LIFT, WIN, OPEN, SEC } from '../stages/office/plan.js';
import { POCKET } from '../player/weapons/revolver.js';

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
const HEAVY_DMGK = 0.55;
// (the flank: slower to settle - they come at my side, the time to turn; at 1.35 a good hand still lost one
// first try in five to the man who came in and round the desk)
// ([C5] after the critic: 2.0 and rounds at 0.8 for a man down in cover - the two now come at once from two sides, and
// the first-timer down behind the desk took the flank to a fourth try at 1.5 / 0.9, a good hand lost one first try in
// six at 1.7; on my feet it is STANDING's below)
const NUM_FLANK = { settleK: 2.0, dmgK: 0.8, flankAfter: 0 };
// ([C5] after the critic) the first gunfight's grace - their aim settling slower (settleK above 1) - is for the man
// who takes cover. On my feet (or down with nothing round me: the kit's lowInOpen) they settle at the difficulty
// table's floor (0.85) and their rounds weigh in full (1.0), everywhere in this chapter: standing and trading in the
// open won the door and the flank (at the kit's own 1.0 it still won the flank and the corridor, a hand's breadth
// from the fall). Read every step (the kit reads cfg.settleK and dmgK each time), so it is the stance that counts
const STANDING = { settleK: 0.85, dmgK: 1.0 };
// ([C5] after the critic) the door: a man held down behind one place for so long (the tipped desk: the three stood
// bunched in the doorway and were shot over it one by one, untouched) has one of them go round - the kit's flank,
// said ('One's going round'), to a place round the desk that sees me
const DOOR_FLANK = 5;
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
  // ([C5] after the critic: the two come at the same time from two sides - one through 305 and the connecting door (its
  // handle turns: heard, seen, 'The other door! Behind you!'), one up the corridor and in at the suite's door to the
  // opening's jamb. Both through the connecting door, one at a time out of one doorway, a man standing in the room
  // facing it won the flank; one held at its jamb, the other behind him, waited his turn. From two sides a man in
  // the open cannot face both; behind the desk, the front one is the desk's and the door's one is mine to turn to)
  { name: 'flankA', at: { x: -4.75, z: -6.3 }, way: [{ door: 'D305' }, { x: 2.9, z: -2.5, run: true }, { door: 'CONN' }, { x: 4.6, z: 1.3, run: true }] },
  { name: 'flankB', at: { x: -5.05, z: -6.75 }, way: [{ x: -4.75, z: 1.2, run: true }, { door: 'AMES' }, { x: -1.0, z: 2.0, run: true }] },
];
// (the plays: each beat's cover places for the good hand - behind it, facing the way they come - and the bad hand's open floor)
const SPOTS = {
  // (tipped: true - only with the desk over; false - only with it standing: its footprint is not a place to stand)
  shadows: [{ x: DESK.x - 0.05, z: DESK.z - 0.4, yaw: WEST, tipped: true }, { x: DESK.x - 0.05, z: DESK.z + 0.45, yaw: WEST, tipped: true }, { x: 4.85, z: 2.65, yaw: WEST, tipped: false }, { x: -0.85, z: 5.3, yaw: WEST }, { x: 0.5, z: OPEN_Z0 - 0.45, yaw: WEST + 0.3 }],
  // (the flank from the connecting door, south-east: the tipped desk's other side; north of the standing desk;
  // and, the desk over, still behind it as at the door - while the door's last man is up, that is the place)
  flank: [{ x: 2.35, z: 3.8, yaw: EAST, tipped: true }, { x: DESK.x - 0.05, z: DESK.z - 0.4, yaw: WEST, tipped: true }, { x: DESK.x - 0.05, z: DESK.z + 0.45, yaw: WEST, tipped: true },
    { x: DESK.x, z: DESK.z + DESK.w / 2 + 0.45, yaw: 0.15, tipped: false }, { x: 0.5, z: OPEN_Z0 - 0.45, yaw: EAST + 2.6 }],
  corridor: [{ x: -0.85, z: 5.3, yaw: WEST }, { x: -0.85, z: 1.4, yaw: WEST }, { x: -4.35, z: -0.05, yaw: 0 }, { x: -3.25, z: -2.05, yaw: WEST }],
};
const OPENS = { shadows: { x: 1.8, z: 3.4 }, flank: { x: 2.4, z: 2.4 }, corridor: { x: -4.8, z: 1.8 } };
// the warnings and the falls in this chapter's words (the kit's for the rest)
const WARN = { door: 'Behind you! The door!' };
const WHY = { default: 'Shot.' };
// ([C5] after play) the flank's two set off once the door's last man is down - or FLANK_WAIT s on, if he
// hangs back - and the second `late` s behind the first. With him alive in the doorway the room has no place
// covered from both the door and the connecting door: the good hand's falls in the flank were nearly all that.
const FLANK_WAIT = 10;
// ([C5] after play) a retry is a little kinder - ([C5] after the critic) from the SECOND fall at this beat, and only
// to a man in cover: from the second fall (up to two steps) they settle 15 % slower and their rounds weigh 12 % less
// while I am down behind something; on my feet in the open the beat is as tuned. (After one fall it was enough for
// the man who stood and traded to win the door: a mercy that decided it for the wrong player.) The first-timer of
// WAVE_C §7, who must get through in three, lost the flank or the corridor three tries of three in half the runs
// with none at all
function retryEase(G, name) {
  const n = Math.max(0, Math.min(2, G.fails(name, 'gunfight') - 1));
  return { n, settle: 1 + 0.15 * n, dmg: 1 - 0.12 * n };
}
// the beat's numbers into the kit by my stance (every step): down in cover - the beat's, eased on a retry; up or bare
// - the kit's own settle, no ease
function byStance(G, K, F) {
  if (!K.active || !F.num) return;
  const C = G.controller, low = (C.crouchK || 0) > 0.5 && !K.lowInOpen;
  const E = low ? (F.ease || { settle: 1, dmg: 1 }) : { settle: 1, dmg: 1 };
  K.cfg.settleK = low ? F.num.settleK * E.settle : STANDING.settleK;
  K.cfg.dmgK = F.heavyOn ? HEAVY_DMGK * E.dmg : low ? F.num.dmgK * E.dmg : STANDING.dmgK;
}
// ([C5] after the critic) the corridor's men do not go round through 305 and the connecting door into Ames's room:
// the suite is a place the corridor can be held from (its door, the opening's line), and the cart is the other. The
// doorway's cells shut in their grid (the player walks through it as ever; a man after me in 305 comes in at 305's own
// door) - again after every rebuild of the grid
function shutToMen(G, D) {
  const nav = G.nav, sp = D && D.spec;
  if (!nav || !sp) return;
  const s0 = sp.axis === 'z' ? [sp.z0, sp.z1] : [sp.x0, sp.x1];
  for (let u = s0[0] - 0.2; u <= s0[1] + 0.2; u += nav.cell * 0.5) for (let w = -0.45; w <= 0.45; w += nav.cell * 0.5) {
    const x = sp.axis === 'z' ? sp.x + w : u, z = sp.axis === 'z' ? u : sp.z + w;
    const k = nav.idx(x, z);
    if (k >= 0) nav.blocked[k] = 1;
  }
}
function corridorGrid(G, K, O) {
  if (K._c5wrap) return;
  const base = K.onRebuild;
  K._c5wrap = true;
  K.onRebuild = () => { if (base) base(); if (G.scenes.ctx && G.scenes.ctx.beat === 'corridor') shutToMen(G, O.doors.CONN); };
  shutToMen(G, O.doors.CONN);
}
const DOORNAMES = ['kicker', 'jamb', 'side', 'doorLeft'];
// (not the second held back until the first is down: the first's body in the doorway kept the second in his
// way in for good - a stand-off of 150 s in play)
function flankGo(F, G) {
  const t0 = G.time;
  let goT = null;
  return (m) => () => {
    if (goT == null && ((F.men || []).every((h) => !h.alive || !DOORNAMES.includes(h.c5)) || G.time - t0 > FLANK_WAIT)) goT = G.time;
    return goT != null && G.time - goT >= (m.late || 0);
  };
}

// the room at a beat's start: the gun in hand and full, the kit's encounter
function prepare(ctx, name, { reset = true } = {}) {
  const G = ctx.game, C = ctx.controller, K = gunsOf(G), O = office(ctx);
  const R = G._c5 || (G._c5 = {});
  carry(ctx, { armed: true });
  if (reset) roomAs(ctx, 'fight');
  O.door.closer = false;
  // ([C5] after the critic) 305's corridor door stands open from IV's start (they came up and tried it): a man sent
  // round by the grid walks his way's points, and a shut door between two of them stopped him for good - the door's
  // man the kit sent round stood behind it until the movement's 40 s ran out
  if (O.doors.D305 && O.doors.D305.shut && !O.doors.D305.moving) O.doors.D305.set(1.62);
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
  // [C13] after the critic: the box of rounds on the secretary's desk, as it was when this checkpoint was reached
  boxAt(ctx, name, reset);
  K.end();
  if (name === 'quiet') return;
  const base = { ...NUM, flankAfter: name === 'shadows' ? DOOR_FLANK : 0, ...(name === 'corridor' ? NUM_CORR : name === 'flank' ? NUM_FLANK : {}) };
  const E = retryEase(G, name);
  K.begin({ to: name, ...base, area: AREA, warn: { ...WARN, ...(name === 'flank' ? { door: 'The other door! Behind you!' } : {}) }, why: WHY });
  const F = ctx.flags;
  F.ease = E; F.num = base; F.heavyOn = false;
  // (a fresh grid: the corridor's wrap is for this encounter's)
  K._c5wrap = false;
  if (name === 'corridor') corridorGrid(G, K, O);
  F.men = [];
  // (the plays' record of the beat, lane C2's driver's: its cover places, where the open is, won)
  // (block: the desk's footprint as it stands or lies - a hand walks round it, not into it; standing, its east
  // side is shut: Ames's chair closes the gap to the radiator)
  F.c2 = c2rec(O, name);
  F.go = null;
  const spawn = (m, extra = {}) => { const h = K.spawn({ kind: m.kind || 'pistol', at: m.at, yaw: m.yaw ?? null, way: m.way ? { steps: m.way } : null, door: m.door || null, cover: !!m.cover, wait: m.wait ?? 0, start: m.start || null, name: m.name, hp: m.hp ?? null, ...extra }); h.c5 = m.name; F.men.push(h); return h; };
  F.spawn = spawn;
  if (name === 'shadows') for (const m of DOORMEN) spawn({ ...m, start: () => F.go != null && G.time - F.go > (m.name === 'kicker' ? 0.05 : m.name === 'jamb' ? 0.5 : 0.35) });
  if (name === 'flank') {
    // (a door man the first movement left: back at the door, working it from its jamb as the jamb man did -
    // [C5] after play: put back where he stood, he could be three metres off by the opening with a line on
    // me as the retry began, and no first-timer got past that)
    for (let i = 0; i < (reset ? (R.doorLeft || []).length : 0); i++) spawn({ ...DOORMEN[1], name: 'doorLeft', wait: 1.5 });
    const go = flankGo(F, G);
    for (const m of FLANKERS) spawn({ ...m, wait: m.name === 'flankA' ? 0.6 : 0.9, start: go(m) });
  }
  if (name === 'corridor') corridorMen(ctx, spawn);
}

// (the plays' record, for a beat - [C13] after the critic: again when the chapter runs on into the next movement by
// itself; it kept the first movement's cover places, and a hand played in flow went to the door's places in the flank
// and to Ames's room from the cart in the corridor)
function c2rec(O, name) {
  return { beat: name, get spots() { const t = !!O.desk.tip; return (SPOTS[name] || []).filter((sp) => sp.tipped == null || sp.tipped === t); }, open: OPENS[name] || null, won: false,
    get block() { const c = O.desk.collider; return c ? { x0: c.cx - c.hx, x1: c.cx + c.hx, z0: c.cz - c.hz, z1: c.cz + c.hz, shut: O.desk.tip ? [] : ['E'] } : null; } };
}
// the corridor's men: two in the lift (one a Tommy gun) once its cage is open,
// one out of the washroom, the heavy up the stair
function corridorMen(ctx, spawn) {
  const G = ctx.game, O = office(ctx), F = ctx.flags;
  const cx = (LIFT.x0 + LIFT.x1) / 2;
  F.liftOpen = false; F.liftCalled = null;
  // ([C5] after the critic: out to the corridor's west wall by the stair door, not in front of the Tommy gunner - in
  // front he stood in his mate's line and the Tommy held his fire: a man standing in the corridor met one gun at a time)
  spawn({ name: 'liftA', kind: 'pistol', at: { x: cx - 0.2, z: LIFT.z1 - 0.35 }, yaw: Math.PI, start: () => F.liftOpen, wait: 0.2, way: [{ x: CORR.x0 + 0.4, z: -4.2, run: true }] });
  spawn({ name: 'tommy', kind: 'tommy', at: { x: cx + 0.2, z: LIFT.z0 + 0.4 }, yaw: Math.PI, start: () => F.liftOpen, wait: 0.9, way: [{ x: cx + 0.3, z: CORR.z0 + 1.0 }] });
  // (a door down the hall, 306's: once the lift's two are down - the same end of the corridor as the lift and
  // the stair: the first gunfight's corridor comes at me from one way, with one cover that answers it, the cart.
  // [C5] after play: from the washroom, behind me, the good hand down at the cart was flanked 6 tries of 6)
  const liftLeft = () => (F.men || []).filter((h) => h.alive && (h.c5 === 'liftA' || h.c5 === 'tommy')).length;
  spawn({ name: 'wc', kind: 'pistol', at: { x: -2.4, z: -5.5 }, yaw: Math.PI / 2, start: () => F.liftOpen && G.time - F.liftOpen > 7 && (liftLeft() === 0 || G.time - F.liftOpen > 30), way: [{ door: 'D306' }], door: 'hold' });
  // (the heavy last: up the stair once the others are down - never the three at once and him)
  const others = () => (F.men || []).filter((h) => h.alive && h.c5 !== 'heavy').length;
  // (his start said: the gate below clanks, the line names him - the tell before the heavy)
  // (and his rounds lighter than the kit's heavy's - bursts at nine a second: a good hand at the cart who
  // missed him once was down 2.3 s after the first round, and at 0.7 the first-timer met him three tries of
  // three; the first gunfight's heavy is three of my rounds walking at me, not a wall)
  // ([C5] after the critic: the line says what is left - 'One more' only when he is the last)
  // ([C5] after the critic) me in the suite: his way goes on up the corridor and in at its door, as a way in (the
  // door's frame, then at me) - by the grid he cut the doorway's corner from the corridor and stood against the jamb
  // for good, broad as he is (two corridor runs of 120 s, no line either way)
  const heavyWay = [{ door: 'GATE' }, { x: -6.4, z: -5.0 }, { door: 'STAIR' }];
  const heavyGo = (f) => {
    if (F.heavyT) return true; if (!f()) return false;
    F.heavyT = G.time; ctx.hud.objective(others() === 0 ? 'One more. On the stair.' : 'And the stair.'); F.heavyOn = true;
    const r = roomOf(G.eye.x, G.eye.z);
    // (and met at three metres in at the door, not seven up the corridor: two of my rounds, not three)
    if (r === 'outer' || r === 'ames') { heavyWay.push({ x: -4.75, z: 1.4 }, { x: -4.75, z: 2.9 }, { door: 'AMES' }); const hv = (F.men || []).find((q) => q.c5 === 'heavy'); if (hv) hv.hp = Math.min(hv.hp, 110); }
    return true;
  };
  // (a breath after the last of them falls - a reload's worth - the gate below clanks open; or, the
  // corridor held to a stand-off with one of them left, he comes up anyway: nobody waits the clock out)
  spawn({ name: 'heavy', kind: 'rusher', at: { x: O.suite.flightFoot.x, z: O.suite.flightFoot.z }, yaw: -Math.PI / 2, start: () => heavyGo(() => { if (!F.liftOpen || G.time - F.liftOpen < 12) return false; if (G.time - F.liftOpen > 40 && others() <= 1) return true; if (others() > 0) { F.othersT = null; return false; } F.othersT = F.othersT || G.time; return G.time - F.othersT > 5; }), hp: 165, way: heavyWay });
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
    ctx.onStep(() => { if (!won) byStance(G, K, F); });
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
    boxPrompt(ctx);
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
      // (the kit's clock for the one who goes round starts at the kick, not while I waited down in the moment: the
      // move's place behind the secretary's desk had one sent round the moment they were in)
      if (K.post) K.post.t = 0;
      ctx.hud.objective('Hold the room.');
      O.door.kick();
      G.controller.shake(0.4, Math.hypot(G.eye.x - DOORS.AMES.x, G.eye.z - 3.4));
      yield wait(0.3);
      if (O.side.pane.state !== 'gone') ctx.stage.glass.shatter(O.side.pane, { dir: V(1, 0, 0), power: 1.4, by: 'body' });
      // movement 1 until the door is down to one (or it has gone on long enough)
      // ([C5] after the critic: a man of the three gone round - the kit sends one round when the doorway is held by a man
      // standing in the room - is still in it: the movement waits for him too. Counted as gone, he left the man who stood
      // and traded one gun to beat, and the door won)
      const roundUp = () => (F.men || []).some((h) => h.alive && ['kicker', 'jamb', 'side'].includes(h.c5) && G.ais.get(h) && G.ais.get(h).brain && G.ais.get(h).brain.S && G.ais.get(h).brain.S.goneRound);
      yield until(() => (alive(['kicker', 'jamb', 'side']) <= 1 && !roundUp() && G.time - F.go > 6) || alive(['kicker', 'jamb', 'side']) === 0 || G.time - F.go > 40);
      R.tipped = !!O.desk.tip;
      R.doorLeft = (F.men || []).filter((h) => h.alive && ['kicker', 'jamb', 'side'].includes(h.c5)).map((h) => ({ x: h.pos.x, z: h.pos.z }));
      // ---- 2. the flank: the handle of the connecting door turns ------------------------------------
      (G._c2won || (G._c2won = [])).push('shadows');
      yield beat('flank');
      F.c2 = c2rec(O, 'flank');
      K.cfg.to = 'flank';
      K.cfg.warn = { ...WARN, door: 'The other door! Behind you!' };
      const go = flankGo(F, G);
      for (const m of FLANKERS) F.spawn({ ...m, wait: m.name === 'flankA' ? 0.4 : 0.7, start: go(m) });
      Object.assign(K.cfg, NUM_FLANK);
      F.num = { ...NUM, ...NUM_FLANK }; F.ease = retryEase(G, 'flank');
    } else if (ctx.beat === 'flank') yield beat('flank');
    if (ctx.at('flank') && ctx.beat === 'flank') {
      yield until(() => alive() === 0);
      R.tipped = !!O.desk.tip;
      (G._c2won || (G._c2won = [])).push('flank');
      yield beat('corridor');
      F.c2 = c2rec(O, 'corridor');
      K.cfg.to = 'corridor';
      K.cfg.warn = { ...WARN };
      K.cfg.flankAfter = 0;
      Object.assign(K.cfg, NUM_CORR);
      F.num = { ...NUM, ...NUM_CORR, flankAfter: 0 }; F.ease = retryEase(G, 'corridor'); F.heavyOn = false;
      K._c5wrap = false; corridorGrid(G, K, O);
      corridorMen(ctx, F.spawn);
      O.lift.setY(-3.3); O.lift.setOpen(0); O.lift.dial(1);
    } else if (ctx.beat === 'corridor') yield beat('corridor');
    // ---- 3. the corridor: the lift comes up ---------------------------------------------------------
    if (ctx.at('corridor') && ctx.beat === 'corridor') {
      const t0 = G.time;
      // (quiet: I go out to look - or they come anyway)
      yield until(() => G.eye.x < OUTER.x0 + 0.5 || G.time - t0 > 16);
      O.callLift(() => { F.liftOpen = G.time; K.rebuild(); }, { from: -3.3, secs: 5.0 });
      // (a stand-off: one of them with no line on me - the Tommy gunner pins and never comes looking, from the
      // corridor or from the lift's car. 15 s of it and he comes round to a door by me to find me.
      // [C5] after the critic: any one of them, not only the last - the Tommy gunner stood 80 s in the lift's mouth
      // while the 306 man and the heavy came and died; one man at a time, 20 s apart, his run heard)
      const lastLine = new Map();
      let sent = -99;
      ctx.onStep(() => {
        if (!F.liftOpen) return;
        for (const h of (F.men || [])) {
          if (!h.alive || h.c5 === 'heavy') continue;
          const ai = G.ais.get(h);
          if (!ai || !ai.brain || (ai.brain.S && ai.brain.S.entry) || ai.brain.hasLine || !lastLine.has(h)) { lastLine.set(h, G.time); continue; }
          if (G.time - lastLine.get(h) > 15 && G.time - sent > 20 && ai.brain.goRound) {
            sent = G.time; lastLine.set(h, G.time);
            // (me in the suite: to its door; me out in the corridor - down behind the cart - to 305's door beside it)
            if (roomOf(G.eye.x, G.eye.z) !== 'corr') ai.brain.goRound(O.doors.AMES, [{ x: -4.7, z: 1.2, run: true }]);
            else ai.brain.goRound(O.doors.D305, []);
            // (he comes to find me at a door I can see: not a flank - a fall to him is not 'Flanked.')
            Object.defineProperty(ai.brain, 'flanking', { get: () => !!ai.brain.S.flank, configurable: true });
            break;
          }
        }
        // ([C5] after the critic) the line follows who is left: the heavy down and men still up - not 'On the stair.'
        const heavy = (F.men || []).find((h) => h.c5 === 'heavy');
        if (F.heavyT && heavy && !heavy.alive && !F.heavySaid) {
          const left = (F.men || []).filter((h) => h.alive);
          if (left.length) { F.heavySaid = true; ctx.hud.objective(left.length > 1 ? 'Check the corridor.' : left[0].c5 === 'tommy' ? 'One more. The Tommy gun.' : 'One more.'); }
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
      // ([C10a] after the critic: 2.6 m, was 1.7 - Ames's desk stands between the room and the blind, and a
      // player walking straight at it stopped at 2.3 m with the blind filling the view and nothing happened)
      yield until(() => { G.camera.getWorldDirection(fv); const dx = wc.x - G.eye.x, dz = wc.z - G.eye.z, d = Math.hypot(dx, dz); return d < 2.6 && (fv.x * dx + fv.z * dz) / d > 0.75; });
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
// lens narrowing on it across the outer office), held, and given back -
// ([C5] after the critic) given back turned onto his desk, the lamp's pool and
// 'E tip the desk over' on it (from where I stand: the moment's first choice in
// the frame, the cards the others): the desk was behind me and its prompt came
// only from its chair side, and no first-timer found it in 7.5 s
function* take(ctx) {
  const G = ctx.game, C = ctx.controller, cam = G.camera;
  const P = C.eyePose();
  const glass = V(DOORS.AMES.x, 1.5, 3.9);
  const yaw1 = Math.atan2(-(glass.x - P.x), -(glass.z - P.z));
  const pitch1 = Math.atan2(glass.y - P.y, Math.hypot(glass.x - P.x, glass.z - P.z));
  const fov0 = cam.fov, fov1 = Math.max(16, Math.min(40, 2 * Math.atan(1.6 / Math.hypot(glass.x - P.x, glass.z - P.z)) * 180 / Math.PI));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // (the end: the desk's top, if it stands and I am by it; else where I was looking)
  const dk = V(DESK.x, DESK.h, DESK.z), dd = Math.hypot(dk.x - P.x, dk.z - P.z);
  const toDesk = !office(ctx).desk.tip && dd < 3.2 && dd > 0.6;
  const yaw2 = toDesk ? Math.atan2(-(dk.x - P.x), -(dk.z - P.z)) : P.yaw;
  const pitch2 = toDesk ? Math.atan2(dk.y - P.y, dd) : P.pitch;
  const dy1 = wrap(yaw1 - P.yaw), dy2 = wrap(yaw2 - yaw1);
  const ease = (u) => u * u * (3 - 2 * u);
  const T = 3.2;
  C.setMode('cutscene', { track: (t) => {
    const u = t < 0.7 ? ease(t / 0.7) : 1, v = t < T - 0.8 ? 0 : ease(Math.min(1, (t - (T - 0.8)) / 0.8));
    const z = u * (1 - v);
    cam.fov = fov0 + (fov1 - fov0) * z; cam.updateProjectionMatrix();
    return { x: P.x, y: P.y, z: P.z, yaw: P.yaw + dy1 * u + dy2 * v, pitch: P.pitch + (pitch1 - P.pitch) * u + (pitch2 - pitch1) * v };
  } });
  yield wait(T);
  cam.fov = fov0; cam.updateProjectionMatrix();
  C.setPose(P.x, P.z, yaw2, pitch2);
  C.setMode('gun', { crouch: false });
}

// E: the desk over on its front (the lamp thrown off it), the heave; then C to get low
// ([C5] after the critic) from any side within reach: from its chair's side at once, as before; from in front of it
// or its ends, a quick step round to its end first (round its corner, 0.2 - 0.5 s, the view on the desk) - it goes
// over away from that side, toward the opening, as it always did. The prompt is the moment's first choice
function tipPrompt(ctx) {
  const G = ctx.game, O = office(ctx), C = ctx.controller;
  const behind = () => G.eye.x > DESK.x - 0.1 && G.eye.x < DESK.x + DESK.d / 2 + 1.0 && Math.abs(G.eye.z - DESK.z) < DESK.w / 2 + 0.5;
  const tip = () => {
    if (!O.tipDesk()) return;
    G.sfx.play('office_deskTip', V(DESK.x, 0.6, DESK.z));
    heave(ctx);
    ctx.interact.remove('tip');
  };
  ctx.interact.add({ id: 'tip', at: V(DESK.x + 0.1, DESK.h + 0.1, DESK.z), range: 2.7, cone: 0.85, prompt: 'tip the desk over', when: () => !O.desk.tip && !ctx.flags.tipStep && roomOf(G.eye.x, G.eye.z) === 'ames' && ctx.beat !== 'quiet', onUse: () => {
    if (behind()) { tip(); return; }
    // the step round: to the end of the desk nearer me, by its corner on my side
    const e = G.eye, south = e.z < DESK.z;
    const endZ = south ? DESK.z - DESK.w / 2 - 0.34 : DESK.z + DESK.w / 2 + 0.34;
    const end = { x: DESK.x + 0.05, z: endZ };
    const legs = [];
    if (e.x < DESK.x - DESK.d / 2 - 0.05 && Math.abs(e.z - DESK.z) < DESK.w / 2 + 0.3) legs.push({ x: DESK.x - DESK.d / 2 - 0.36, z: endZ });
    legs.push(end);
    const look = (p) => ({ yaw: Math.atan2(-(DESK.x - p.x), -(DESK.z - p.z)), pitch: -0.42 });
    const P0 = C.eyePose();
    let from = { ...P0 }, i = 0, t = 0;
    const segT = (a, b) => Math.max(0.16, Math.hypot(b.x - a.x, b.z - a.z) / 3.4);
    ctx.flags.tipStep = true;
    C.frozen = true;
    ctx.onStep((dt) => {
      if (i >= legs.length) return;
      const to = legs[i], L = segT(from, to);
      t = Math.min(L, t + dt);
      const u = t / L, k = u * u * (3 - 2 * u), lk = look(to);
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      C.ease({ x: from.x + (to.x - from.x) * k, y: P0.y, z: from.z + (to.z - from.z) * k, yaw: from.yaw + wrap(lk.yaw - from.yaw) * k, pitch: from.pitch + (lk.pitch - from.pitch) * k }, 1e-3);
      if (t < L) return;
      from = { x: to.x, y: P0.y, z: to.z, ...lk }; i++; t = 0;
      if (i < legs.length) return;
      C.frozen = false;
      C.setPose(to.x, to.z, lk.yaw, lk.pitch);
      C.setMode('gun', { crouch: false });
      ctx.flags.tipStep = false;
      tip();
    });
  } });
}

// [C13] after the critic: a box of .38s on the secretary's desk (POCKET.gunfight.box rounds), taken with E - the
// counted pocket's one way to more rounds in IV (it was a fall: a retry was never under 6 + 18). A player in flow
// came to the corridor with 13 - 16 rounds for a movement that takes a good hand 12 - 14. It is there from the
// first second (on the desk's front edge, pale on the dark top, seen from the suite's door and the opening); taken,
// it is gone for the chapter. A checkpoint gives it back as it was when reached - and, the guard, a retry whose
// rounds are under POCKET.gunfight.guard in all finds it on the desk again (fetched with E: no checkpoint is a
// dead end, and nothing goes into the pocket by itself)
const BOX = { x: SEC.x - SEC.d / 2 + 0.12, y: SEC.h, z: SEC.z + 0.22, yaw: 0.35 };
function boxState(G) {
  const f = G.save && G.save.flags;
  if (!f) return { taken: false, cp: {} };
  const B = f.ivBox && typeof f.ivBox === 'object' ? f.ivBox : (f.ivBox = { taken: false, cp: {} });
  if (!B.cp || typeof B.cp !== 'object') B.cp = {};
  return B;
}
function boxMesh(ctx) {
  const G = ctx.game, O = office(ctx);
  if (!O.c13box) {
    const g = new THREE.Group();
    const card = new THREE.MeshStandardMaterial({ color: 0xd9d3c2, roughness: 0.9 });
    card.name = 'c13_box'; card.userData.inkSurface = 'paper';
    const band = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.8 });
    band.name = 'c13_box_band';
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.1).translate(0, 0.025, 0), card));
    // a thin dark band round it (the maker's label)
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.007, 0.102).translate(0, 0.016, 0), band));
    g.traverse((m) => { if (m.isMesh) { m.userData.noRay = true; m.castShadow = true; } });
    g.position.set(BOX.x, BOX.y, BOX.z); g.rotation.y = BOX.yaw;
    O.c13box = g;
    // (the stage is III's too: the box is IV's only)
    if (!G._c13boxHook) { G._c13boxHook = true; G.on('scene:enter', (e) => { if (e && e.id !== 'gunfight' && O.c13box) O.c13box.visible = false; }); }
    // (a beat begun is a checkpoint reached: the box as it is then is what a retry there gives back)
    G.on('scene:beat', (e) => { if (e && e.id === 'gunfight' && e.beat) { const B = boxState(G); B.cp[e.beat] = !!B.taken; } });
  }
  if (O.c13box.parent !== ctx.stage.scene) ctx.stage.scene.add(O.c13box);
  return O.c13box;
}
function boxAt(ctx, name, reset) {
  const G = ctx.game, B = boxState(G), m = boxMesh(ctx), row = POCKET.gunfight;
  if (reset) {
    if (name === 'shadows') { B.taken = false; B.cp = {}; }
    else B.taken = !!B.cp[name];
    const rv = G.player.weapons.impls.revolver;
    // (the guard: a checkpoint reached short, the box gone - it is on the desk again, to be fetched)
    if (B.taken && rv && Number.isFinite(rv.pocket) && rv.ammo + rv.pocket < row.guard) { B.taken = false; G.counters.c13guard = (G.counters.c13guard || 0) + 1; }
  }
  m.visible = !B.taken;
}
function boxPrompt(ctx) {
  const G = ctx.game, B = boxState(G), m = boxMesh(ctx);
  m.visible = !B.taken;
  ctx.interact.add({ id: 'c13box', at: V(BOX.x, BOX.y + 0.04, BOX.z), range: 1.7, cone: 0.7, prompt: 'take the rounds',
    when: () => m.visible && !B.taken && ctx.beat !== 'quiet',
    onUse: () => {
      const rv = G.player.weapons.impls.revolver;
      if (!rv || !Number.isFinite(rv.pocket)) return;
      B.taken = true; m.visible = false;
      rv.pocket += POCKET.gunfight.box; rv.saidEmpty = false; rv.keep();
      G.sfx.play('pocket', null, {}, { send: false });
      G.counters.c13box = (G.counters.c13box || 0) + 1;
      ctx.interact.remove('c13box');
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
