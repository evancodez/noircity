import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { PIER, inShed } from '../stages/pier9/site.js';
import { Crew } from './warehouse/crew.js';
import { Stealth } from './warehouse/stealth.js';
import { PierFight, bayRoom, quietCrew, crewOutOfSight, FM_MANNERS, FOREMAN, RING_START, EYE_Y } from './warehouse/fight.js';
import { buildProp } from '../props/index.js';

// Scene 8, Pier Nine (lane B6; docs/story/briefs/B6_WAREHOUSE.md). Pools of
// lamp light and black between them; I stay in the black. The light on my
// hands tells me how exposed I am; the men's lights are what they see.
// Beats (?scene=warehouse&beat=<beat>, ?start=warehouse[.<beat>]):
//   arrive  outside by my car in the rain; the side door, twenty metres off
//   floor   in at the side door; the first man walks past the door's pool
//           as I come in (C crouch, taught once)                 checkpoint
//   lamps   the middle: the switch and the hoist's cord, shown by their
//           place in the light                                   checkpoint (by the hoist)
//   stairs  the two Hoods at the foot of the stairs: a bottle, or the
//           dark side                                            checkpoint
//   listen  on the catwalk under the office window: the Cardinal's order,
//           three lines; he comes to the window and looks down: I must be
//           down and still
//   out     the truck backs against the side door; along the catwalk,
//           down the far stairs into the bay                     checkpoint
//   fight   [R2-E] the foreman steps out of the dark by the bay's door, the
//           hook turning in his hand; my hand goes to the revolver and
//           comes away; the second fist fight (warehouse/fight.js, the
//           first fight's rules in this room); the last blow puts him back
//           through a loading door's planks into the river      checkpoint
//   ko      (a jump: the last blow, him out on his feet at door 1 or 2
//           - &door=2 -, my punch on its way; t= scrubs his fall)
//   after   the hole, the rain coming in; out by the bay's side door onto
//           the pier (ctx.next())
// Caught: the cosh from behind, black, back at the last checkpoint.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const BEATS = ['arrive', 'floor', 'lamps', 'aisle', 'stairs', 'listen', 'out', 'fight', 'ko', 'after'];
const BAY_BEATS = new Set(['fight', 'ko', 'after']);
const LINES = ['The diner. Tonight.', 'The waitress saw Mack talk.', 'No one leaves.'];

// ---- the crew's rounds (designed: there is always a readable way through
// for a player who watches ten seconds) -----------------------------------------
// headings: a figure faces (sin yaw, cos yaw): north (into the shed) PI,
// south 0, east PI/2, west -PI/2
const CREW = [
  // the first man: loading the truck's tail as I come to the door; he walks
  // west through the door's pool, turns up aisle A and walks his round
  // (he stands at the stack's corner facing up the aisle, so his turn to the
  // pool swings his light through the north, never across the door)
  { name: 'sully', kind: 'dockhand', light: 'lantern', at: [-8.1, -5.1], yaw: 2.5, start: 'wait', entry: [{ x: -10.9, z: -5.0 }],
    route: [{ x: -11.2, z: -24.6, wait: 4.0, looks: [PI, -PI / 2 - 0.3, PI] }, { x: -11.2, z: -6.6, wait: 2.2, looks: [PI / 2, 0.9] }] },
  // a loop round the block east of aisle B: east along the cross aisle to
  // the hoist's post, south down aisle C, west along the truck's strip,
  // north up aisle B's east side (his light never points back along the
  // cross aisle at the switch; he is the switch's nearest man)
  { name: 'rusty', kind: 'dockhand', light: 'torch', at: [6.0, -14.2], yaw: PI / 2, ri: 1,
    route: [{ x: 3.9, z: -14.2, wait: 1.6, looks: [PI / 2] }, { x: 9.2, z: -14.2, wait: 2.6, looks: [PI, 0.2] },
      { x: 10.3, z: -4.7, wait: 1.6, looks: [-PI / 2] }, { x: 2.6, z: -4.0, wait: 0 }, { x: 2.6, z: -12.6, wait: 0 }] },
  // aisle B's man (its lamps are his: when they go, he goes to the switch;
  // his round stops short of the strip: his lantern never reaches the
  // stairs' foot)
  { name: 'bert', kind: 'dockhand', light: 'lantern', at: [0, -25], yaw: PI, ri: 1, row: 'B',
    route: [{ x: 0, z: -22.6, wait: 2.4, looks: [PI / 2, -PI / 2] }, { x: 0, z: -31.0, wait: 3.2, looks: [PI / 2, -PI / 2] }] },
  // aisle C's north half and the loading bay (he looks at the loading doors)
  { name: 'cal', kind: 'dockhand', light: 'torch', at: [11, -22], yaw: PI, ri: 2,
    route: [{ x: 11, z: -17.4, wait: 2.0, looks: [0.0, -PI / 2] }, { x: 11, z: -26, wait: 0 }, { x: 12, z: -34, wait: 3.0, looks: [PI / 2, 0.2] }, { x: 11, z: -26, wait: 0 }] },
  { name: 'hood1', kind: 'hood', light: null, at: [-2.8, -37.6], yaw: 0.6, variant: { coat: 1, brim: 1, tall: 1, cig: true },
    looks: [0.65, -0.35, 0.2], lookEvery: 4.2 },
  { name: 'hood2', kind: 'hood', light: 'torch', at: [3.0, -36.4], yaw: PI / 2, ri: 1, variant: { coat: 2, brim: 0, tall: 0 }, speed: 1.1,
    route: [{ x: -0.6, z: -36.4, wait: 2.6, looks: [0.15, -0.6] }, { x: 6.8, z: -36.4, wait: 2.6, looks: [-0.1, 0.5] }] },
];
// when the truck backs in, the Hood with the torch goes down to meet it and
// stands by its tail (the strip at the stairs' foot is left to the other)
const HOOD2_TRUCK = { at: [-6.9, -5.2], yaw: -PI / 2, looks: [-PI / 2, 0.3, -PI / 2 - 0.5] };
// where each checkpoint puts me (in the dark)
const START = {
  arrive: { x: PIER.start.x, z: PIER.start.z, yaw: PIER.start.yaw, pitch: 0.02 },
  floor: { x: -10.4, z: -1.2, yaw: 0.05, pitch: -0.02 },
  lamps: { x: -6.65, z: -11.1, yaw: 0.4, pitch: -0.05, crouch: true },
  // (the pocket at the corner of the second stack, deep: the aisle's far end
  // cannot see it; I come back to it looking down aisle A at the first man's
  // back as he walks away - it faced a crate before)
  aisle: { x: -7.65, z: -17.3, yaw: 2.1, pitch: -0.02, crouch: true },
  // (the pocket in the last stack: looking out past its edge to the west
  // stairs going up under the mezzanine - it faced the bare west wall)
  stairs: { x: -7.95, z: -33.1, yaw: 0.9, pitch: 0.05, crouch: true },
  listen: { x: -1.0, z: -41.7, yaw: 0.0, pitch: 0.2, crouch: true, up: true },
  out: { x: 4.2, z: -41.7, yaw: -PI / 2, pitch: -0.1, crouch: true, up: true },
  // [R2-E] at the foot of the far stairs, looking down the bay to its door
  fight: { x: 14.15, z: -39.85, yaw: 2.85, pitch: -0.08 },
  ko: { x: 12.9, z: -33.9, yaw: -PI / 2, pitch: -0.1 },
  after: { x: 12.6, z: -34.2, yaw: -PI / 2 - 0.3, pitch: -0.12 },
};
let LIVE = null;   // the scene's running state (its crew, its stealth, its props)
let HOOKED = null; // (the game whose scene:exit puts the hands back)
let RETRY = null;  // the checkpoint the cosh sends me back to (a beat heard once is not heard again whole)

// ---- the room as a beat has it ---------------------------------------------------------
function setupAt(ctx, b) {
  const G = ctx.game, stage = ctx.stage;
  if (HOOKED !== G) { HOOKED = G; G.on('scene:exit', (e) => { if (e && e.id === 'warehouse') leaveWarehouse(); }); }
  if (LIVE) { LIVE.crew.clear(); LIVE.stealth.undress(); for (const o of LIVE.props) if (o.parent) o.parent.remove(o); if (LIVE.fight) LIVE.fight.clear(); LIVE = null; }
  if (G.brawl.active) G.brawl.stop();
  const W = stage.part('works'), shed = stage.part('shed'), mezz = stage.part('mezz'), L = stage.lamps;
  // [R2-E] the bay as it stood: its things home, the loading doors whole
  stage.part('bay').reset();
  for (const d of shed.loading) d.reset();
  if (G.sfx && G.sfx.roomOpen) G.sfx.roomOpen(0);
  // the place: lamps on, the switch up, the load hanging, the truck by the
  // big doors, the doors as the beat has them
  W.panel.throw(true); W.panel.k = 1; W.panel.drive = null;
  for (const l of L.lamps) if (l.row) { l.on = true; l.dying = null; }
  W.hoist.reset();
  W.truck.reset();
  const bayB = BAY_BEATS.has(b);
  shed.sideDoor.snap(b === 'arrive' || b === 'out' || bayB ? 0 : 1);
  shed.bayDoor.snap(0);
  blinds(stage, 0);
  if (b === 'out' || bayB) { W.truck.place(1); W.truck.lights(true); }
  // the crew (in the bay's beats they are about their rounds at the shed's
  // far end, out of it: the fight is quiet)
  const crew = new Crew(G, stage, { rng: ctx.rng.fork(81) });
  if (!bayB) for (const spec of CREW) crew.add(b === 'out' && spec.name === 'hood2' ? { ...spec, ...HOOD2_TRUCK, route: null, ri: 0, lookEvery: 3.2 } : spec);
  // (a jump past the door: the first man is already on his round)
  // (he stands in aisle A walking north, not at the truck's tail: the way
  // from there to his round's far end is through the stacks)
  if (b !== 'arrive' && b !== 'floor' && !bayB) { const s = crew.get('sully'); s.entry = null; s.c.place({ x: -11.2, z: -8.2 }, PI); s.look = s.light = s.lookWant = PI; s.setMode('patrol'); }
  // (back in the pocket by the second stack: he has just gone by it, south, his back to me)
  if (b === 'aisle') { const s = crew.get('sully'); s.c.place({ x: -11.2, z: -14.6 }, 0); s.look = s.light = s.lookWant = 0; s.ri = 1; s.wait = 0; s.path = null; }
  // the office: the Cardinal (lane B7's kind when it is here) and his two men
  const office = [];
  const cardKind = ctx.cast.has('cardinal') ? 'cardinal' : 'heavy';
  const card = ctx.cast.spawn(cardKind, { at: 'pier9.office.desk', brain: 'none', name: 'cardinal', variant: { coat: 0, brim: 1, tall: 1, cig: true, heavy: true, unarmed: true } });
  office.push(card);
  office.push(ctx.cast.spawn('hood', { at: 'pier9.office.side', brain: 'none', name: 'officeA', variant: { coat: 2, brim: 1, tall: 0 } }));
  office.push(ctx.cast.spawn('hood', { at: 'pier9.office.cab', brain: 'none', name: 'officeB', variant: { coat: 1, brim: 0, tall: 1, cig: true } }));
  for (const c of office) { c.fig.surface = () => PIER.mezz.y; c.noGlance = true; c.fig.update(0, 0); }
  card.yaw = 0; card.fig.yaw = 0;
  // the bottles on their crates
  const props = [];
  const bottles = [];
  PIER.bottles.forEach(([, , v], i) => {
    const o = stage.part('stacks').bottleAt(i, v);
    props.push(o);
    bottles.push(o);
  });
  // me
  const S = START[b] || START.arrive;
  mezz.setUp(!!S.up);
  G.controller.frozen = false;
  G.controller.setPose(S.x, S.z, S.yaw, S.pitch, S.up ? PIER.mezz.y : 0);
  G.controller.setMode('sneak', { crouch: !!S.crouch, sfx: G.sfx });
  // (the look is held while the scene comes up out of the black: the first
  // frame is the composed one)
  G.controller.lookLocked = true;
  const stealth = new Stealth(ctx, crew);
  stealth.dress();
  LIVE = { crew, stealth, props, bottles, office, card, beat: b, cp: b, retry: RETRY === b, fight: new PierFight(ctx) };
  RETRY = null;
  ctx.flags.live = LIVE;
  ctx.flags.cp = LIVE.cp;
  // (the fight is quiet: no music under it - the rain on the roof, the
  // water, our feet on the planks)
  if (!bayB) G.music.cue('warehouse');
  else G.music.stop(0.5);
  // [R2-E] the bay's beats: the foreman where the beat has him
  if (b === 'ko') stageKO(ctx, LIVE);
  if (b === 'after') stageAfter(ctx, LIVE);
  return LIVE;
}

// ---- [R2-E] the second fist fight (warehouse/fight.js) ------------------------------------
// the foreman: the kind of his own, on the pier's floor, the hook in his
// right fist (a pivot at its grip: the scene turns it in his hand)
function spawnForeman(ctx, at, yaw = null) {
  const c = ctx.cast.spawn('foreman', { at, yaw, name: 'foreman' });
  c.fig.surface = () => 0;
  c.noGlance = true;
  const pivot = new THREE.Group();
  pivot.name = 'foremanHook';
  const hook = buildProp('cargoHook');
  const gp = hook.userData.grip ? new THREE.Vector3().setFromMatrixPosition(hook.userData.grip) : new THREE.Vector3();
  hook.position.copy(gp).negate();
  pivot.add(hook);
  pivot.userData.kind = 'cargoHook';
  pivot.userData.grip = new THREE.Matrix4();
  c.hold(pivot, 'R', { grip: 'upright' });
  c.hookPivot = pivot; c.hookInner = hook;
  return c;
}
// into the rules: the bay as the room, the foreman as the man
function beginPierFight(ctx, fm, { manner = 'measured', hp = null, retry = false } = {}) {
  const G = ctx.game, L = LIVE;
  const room = L.room || (L.room = bayRoom(ctx, L.fight));
  const B = G.brawl;
  B.start({
    opponent: fm, manner, hp, room, rng: ctx.rng, retry, lesson: false,
    who: { name: FOREMAN.name, hp: FOREMAN.hp, manners: FM_MANNERS },
    onRetry: (m, hp2) => { const f2 = restageRing(ctx); beginPierFight(ctx, f2, { manner: m, hp: hp2, retry: true }); },
    onGlass: (w) => L.fight.burstDoor(w),
    // (the splash; he is under the black water by 0.7 s after it: gone)
    onLanded: () => { L.fight.splash(fm.bones.hips.getWorldPosition(V(0, 0, 0))); L.fight.tweens.push({ t: 0, dur: 0.72, step: () => {}, end: () => { fm.fig.object.visible = false; } }); },
  });
  // (his first bottle is the diner's rule: here he has had it)
  B.him.hadBottle = true;
  if (fm.held.R && fm.held.R === fm.hookPivot) { B.him.holding = 'hook'; B.him.prop = fm.hookPivot; }
  L.fm = fm;
  return B;
}
// the ring as a retry or a jump finds it (under the black): him toward the
// doors, me off the stairs' foot, squared up
function restageRing(ctx, { hook = null } = {}) {
  const G = ctx.game, C = G.controller, L = LIVE;
  const fm = L.fm || spawnForeman(ctx, { x: RING_START.him.x, z: RING_START.him.z });
  L.fight.putOut();
  const S = RING_START;
  fm.place({ x: S.him.x, z: S.him.z }, Math.atan2(S.me.x - S.him.x, S.me.z - S.him.z));
  if (hook === false && fm.held.R) { const o = fm.hold(null, 'R'); if (o && o.parent) o.parent.remove(o); }
  const yaw = Math.atan2(-(S.him.x - S.me.x), -(S.him.z - S.me.z));
  G.player.hands.hold(null, 'R'); G.player.hands.hold(null, 'L');
  C.setPose(S.me.x, S.me.z, yaw, -0.08);
  C.setMode('brawl', { opponent: fm, eyeY: EYE_Y, pos: S.me, yaw });
  return fm;
}
// ko (a jump): him out on his feet at a loading door, my punch on its way
function stageKO(ctx, L) {
  const G = ctx.game, C = G.controller;
  const n = parseInt(new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('door') || '1', 10) === 2 ? 1 : 0;
  L.stealth.undress();
  L.fightOn = true;
  const room = L.room || (L.room = bayRoom(ctx, L.fight));
  const w = room.finishes[n];
  const fm = spawnForeman(ctx, { x: w.spot.x, z: w.spot.z }, -PI / 2);
  const o = fm.hold(null, 'R'); if (o && o.parent) o.parent.remove(o);
  const me = { x: w.spot.x - 1.35, z: w.spot.z + 0.2 };
  const yaw = Math.atan2(-(w.spot.x - me.x), -(w.spot.z - me.z));
  C.setPose(me.x, me.z, yaw, -0.1);
  C.setMode('brawl', { opponent: fm, eyeY: EYE_Y, pos: me, yaw });
  const B = beginPierFight(ctx, fm, { manner: 'out' });
  Object.assign(B.him, { window: w, spot: w.spot, atSpot: true, state: 'reel' });
  B.ko();
}
// after: the door he went through burst, the rain coming in; me in the bay
function stageAfter(ctx, L) {
  const shed = ctx.stage.part('shed');
  L.fightOn = true;
  L.won = true;
  const d = shed.loading[0];
  for (const p of d.pieces) p.mesh.visible = false;
  d.burst = true;
  L.fight.hole = d;
  L.fight.rainIn();
  if (ctx.game.sfx && ctx.game.sfx.roomOpen) ctx.game.sfx.roomOpen(0.45);
}

// ---- what lives under the beats: the crew, me, the things E reaches ----------------------
function live(ctx) {
  const G = ctx.game, stage = ctx.stage, I = G.interact;
  const W = stage.part('works'), shed = stage.part('shed');
  const L = LIVE;
  const { crew, stealth } = L;
  // the crew hears my feet
  G.controller.onFootfall = (x, z, f) => { if (!f.crouch) crew.noise(V(x, 0, z), f.run ? 8 : 3, 'step'); };
  // caught: the cosh, black, the checkpoint
  crew.onCaught = () => {
    stealth.cosh(() => {
      const cp = ctx.flags.cp || 'floor';
      RETRY = cp;
      G.scenes.go('warehouse', { beat: cp, fade: 'black', card: false, fadeIn: 0.9 });
      if (G.scenes.trans) G.scenes.trans.t = 0.6;
      G.counters.caught = (G.counters.caught || 0) + 1;
    });
  };
  // ---- the things of the place
  // (what a pull takes hold of: the grip's place along the thing's path, a
  // few points the hand's clip keys run through - sn_pull; the scene moves
  // the thing itself on the same clock, so the hand never leaves it)
  const grip = () => { const o = new THREE.Object3D(); o.userData = { kind: 'lever', grip: new THREE.Matrix4() }; return o; };
  const aimPath = (list) => { const H = G.player.hands; H.snPath = list; H.snTarget = list[0]; return list; };
  // the knife switch's handle along its swing (k 1 up .. 0 thrown), the
  // hand's frame turned with the blade
  const leverPath = (P) => {
    const lv = P.lever, z0 = lv.rotation.z, out = [];
    const face = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, P.face, 0));
    let q0inv = null;
    for (const k of [1, 2 / 3, 1 / 3, 0]) {
      lv.rotation.z = 0.35 - (1 - k) * 2.4;
      lv.updateMatrixWorld(true);
      const q = lv.getWorldQuaternion(new THREE.Quaternion());
      if (!q0inv) q0inv = q.clone().invert();
      const o = grip();
      o.position.copy(lv.localToWorld(V(0.03, 0.3, 0)));
      o.quaternion.copy(q).multiply(q0inv).multiply(face);
      o.updateMatrixWorld(true);
      out.push(o);
    }
    lv.rotation.z = z0;
    lv.updateMatrixWorld(true);
    return out;
  };
  // the hoist's cord hitched on its cleat: taken there, pulled off it and
  // out toward me
  const cordPath = (c) => [[0, 0, 0], [0.05, 0.04, 0], [0.16, -0.02, 0], [0.26, -0.14, 0]].map(([dx, dy]) => {
    const o = grip(); o.position.set(c.x + dx, c.y + dy, c.z); o.rotation.set(0, -PI / 2, 0); o.updateMatrixWorld(true); return o;
  });
  // E on a thing: I step in to arm's length and square up to it, then the
  // hand goes out (a press at the prompt's edge, 1.5 m off, stretched an
  // arm to it or closed a hand short of it). The step is a quarter second
  // at most and starts at once; the controls come back when the hand has it.
  const approach = (at, near, then, hold = 0.35, rise = false) => {
    const C = G.controller;
    const p0 = typeof at === 'function' ? at() : at;
    const d = Math.hypot(p0.x - C.pos.x, p0.z - C.pos.z);
    C.frozen = true;
    C.vel.x = C.vel.z = 0;
    L.approach = { at, near, then, hold, rise, t: 0, dur: Math.min(0.26, Math.max(0.1, (d - near) / 2.6)), fx: C.pos.x, fz: C.pos.z, y0: C.yaw, p0: C.pitch };
    // (the blow from behind is struck standing: I come up out of the crouch
    // as I step in, and go down again with him - takeDown)
    if (rise && C.sneak && C.sneak.crouch) { C.sneak.crouch = false; L.recrouch = true; } else if (rise) L.recrouch = false;
  };
  const busy = () => G.player.hands.busy || !!L.approach;
  // the side door (from outside)
  I.add({ id: 'b6door', at: V(PIER.sideDoor.x + 0.4, 1.05, 0.15), range: 2.4, cone: 1.1, prompt: 'open', when: () => !shed.sideDoor.isOpen && ctx.beat === 'arrive',
    onUse: () => { shed.sideDoor.open(1); G.sfx.play('creak', V(PIER.sideDoor.x, 1.2, 0), {}, { ref: 3 }); } });
  // the bottles
  L.bottles.forEach((b, i) => {
    I.add({ id: 'b6bottle' + i, at: () => b.getWorldPosition(new THREE.Vector3()).add(V(0, 0.15, 0)), range: 1.55, cone: 0.95, prompt: 'bottle',
      when: () => !stealth.bottle && b.parent && b.parent !== G.vm.root && !busy() && stealth.coshT < 0,
      onUse: () => approach(b.getWorldPosition(new THREE.Vector3()).add(V(0, 0.12, 0)), 0.45, () => stealth.take(b), 0.34) });
  });
  // the knife switch: the middle aisle's lamps go dark; a man comes to put it back
  const P = W.panel;
  I.add({ id: 'b6switch', at: () => P.pos, range: 1.8, cone: 1.2, prompt: 'pull the switch',
    when: () => P.on && !L.fixer && !busy() && !stealth.aiming,
    onUse: () => approach(P.lever.localToWorld(V(0.03, 0.3, 0)), 0.55, () => {
      aimPath(leverPath(P));
      L.pull = { t: 0 };
      G.player.hands.play(stealth.bottle ? 'sn_pullL' : 'sn_pull', { onMark: { pulled: () => {
        P.throw(false);
        G.sfx.play('switch', P.pos, {}, { ref: 3 });
        G.sfx.play('lampsOff', V(0, 4.3, -21), {}, { ref: 8 });
        for (const l of stage.lamps.rows.get('B')) stage.lamps.dim(l, false, { flicker: 0.15 + 0.2 * ctx.rng.next() });
        crew.noise(P.pos, 6, 'step');
        L.fixDue = G.time + 1.2;
      } } });
    }, 0.6) });
  // the hoist's cord: the load down at the far end of the aisle
  const HO = W.hoist;
  HO.onLand = (p) => {
    G.sfx.play('crash', p, {}, { ref: 8 });
    const F = G.fx, r = ctx.rng;
    if (F && F.dust) for (let k = 0; k < 18; k++) F.dust.spawn({ pos: p.clone().add(V(r.gauss() * 0.6, 0.1, r.gauss() * 0.6)), vel: V(r.gauss() * 1.2, r.next() * 0.8, r.gauss() * 1.2), life: 1.4 + r.next(), size: [0.3, 0.3], grow: 0.6 });
    if (F && F.debris) for (let k = 0; k < 12; k++) F.debris.spawn({ pos: p.clone().add(V(0, 0.3, 0)), vel: V(r.gauss() * 2.5, 1 + r.next() * 2, r.gauss() * 2.5), life: 1.2, size: [0.05, 0.02], rot: r.next() * 6.28, spin: r.gauss() * 8, col: [0.2, 0.2, 0.2], cell: 12, gravity: 9.8, ground: 0.02, fadeOut: 0.3 });
    G.controller.shake(0.25, G.eye.distanceTo(p));
    crew.sendNearest(p, 2, 'crash', 40);
  };
  I.add({ id: 'b6hoist', at: () => HO.cleat, range: 1.8, cone: 1.2, prompt: 'let the load go', when: () => HO.up && !busy() && !stealth.aiming,
    onUse: () => approach(HO.cleat, 0.5, () => {
      aimPath(cordPath(HO.cleat.clone().add(V(0.02, 0.02, 0))));
      G.player.hands.play(stealth.bottle ? 'sn_pullL' : 'sn_pull', { onMark: { pulled: () => { HO.drop(); G.sfx.play('hoist', HO.cleat, {}, { ref: 5 }); } } });
    }, 0.6) });
  // a man from behind (only one who has not noticed me)
  for (const m of crew.men) {
    I.add({ id: 'b6ko_' + m.name, at: () => m.eye(new THREE.Vector3()).add(V(0, -0.35, 0)), range: 1.75, cone: 0.55, prompt: 'knock him out',
      when: () => !L.approach && canTakeDown(m, G), onUse: () => approach(() => m.eye(new THREE.Vector3()).add(V(0, -0.3, 0)), 0.8, () => takeDown(ctx, m), null, true) });
  }
  // the bay's side door (only once there is a reason to leave)
  // (the bay's side door: the way out, once the foreman is in the river)
  I.add({ id: 'b6bay', at: V(PIER.shed.x1 - 0.2, 1.05, PIER.bayDoor.z - 0.4), range: 2.2, cone: 1.1, prompt: 'open', when: () => !shed.bayDoor.isOpen && ctx.beat === 'after',
    onUse: () => { shed.bayDoor.open(1); G.sfx.play('creak', V(PIER.shed.x1, 1.2, PIER.bayDoor.z), {}, { ref: 3 }); } });

  ctx.onStep((dt) => {
    if (!LIVE || LIVE !== L) return;
    if (G.controller.lookLocked && !G.scenes.trans && ctx.sceneTime > 0.5) G.controller.lookLocked = false;
    // [R2-E] the fight's life: his walk out of the dark, the hook turning in
    // his hand, the fire, the boards, the rain through the hole
    L.fight.step(dt);
    if (L.jobs) for (let i = L.jobs.length - 1; i >= 0; i--) if (L.jobs[i].next().done) L.jobs.splice(i, 1);
    if (L.fm && L.fm.hookInner) {
      L.spinA = (L.spinA || 0) + dt * 9 * (L.spin || 0);
      if (!L.spin) L.spinA = Math.round(L.spinA / (Math.PI * 2)) * Math.PI * 2 + (L.spinA % (Math.PI * 2)) * Math.exp(-dt * 10);
      L.fm.hookPivot.rotation.x = L.spinA;
    }
    // (standing in the burning oil hurts; so does being knocked into it)
    if (L.fightOn && G.brawl.active && !G.brawl.finished) {
      const heat = L.fight.heatAt(G.eye.x, G.eye.z);
      if (heat > 0.2) { G.health.damage(heat * 9 * dt); L.burnT = (L.burnT || 0) + dt; if (L.burnT > 0.5) { L.burnT = 0; G.controller.shake(0.12, 0); } }
      const fm = L.fm, him = G.brawl.him;
      if (fm && him && him.state !== 'ko' && him.state !== 'reel') {
        const h2 = L.fight.heatAt(fm.pos.x, fm.pos.z);
        if (h2 > 0.25) { G.brawl.damageHim(h2 * 7 * dt); L.hisBurn = (L.hisBurn || 0) + dt; }
      }
    }
    if (!L.fightOn || L.won) stealth.step(dt);
    crew.step(dt, G.time);
    // the step in to a thing E took (approach): glide, square up, then the hand
    const A = L.approach;
    if (A && stealth.coshT >= 0) L.approach = null;
    else if (A) {
      const C = G.controller;
      A.t += dt;
      const p = typeof A.at === 'function' ? A.at() : A.at;
      const dx = A.fx - p.x, dz = A.fz - p.z, d = Math.hypot(dx, dz) || 1;
      const tx = d > A.near ? p.x + (dx / d) * A.near : A.fx, tz = d > A.near ? p.z + (dz / d) * A.near : A.fz;
      const u = sstep(0, 1, A.t / A.dur);
      C.pos.x = A.fx + (tx - A.fx) * u;
      C.pos.z = A.fz + (tz - A.fz) * u;
      C.vel.x = C.vel.z = 0;
      const wantY = Math.atan2(-(p.x - C.pos.x), -(p.z - C.pos.z));
      const wantP = Math.atan2(p.y - G.eye.y, Math.max(0.3, Math.hypot(p.x - C.pos.x, p.z - C.pos.z)));
      C.yaw = A.y0 + Math.atan2(Math.sin(wantY - A.y0), Math.cos(wantY - A.y0)) * u;
      C.pitch = A.p0 + (wantP - A.p0) * (A.rise ? 0.9 : 0.6) * u;
      if (A.t >= A.dur) {
        L.approach = null;
        if (A.hold != null) L.thawAt = G.time + A.hold;
        A.then();
      }
    }
    if (L.thawAt && G.time >= L.thawAt) { L.thawAt = 0; if (stealth.coshT < 0) G.controller.frozen = false; }
    // the switch's blade goes down with the hand on it (the pull's clock:
    // closed on it at 0.34 s, thrown at 0.58 s)
    if (L.pull) {
      L.pull.t += dt;
      const u = Math.min(1, Math.max(0, (L.pull.t - 0.34) / 0.24));
      P.drive = 1 - u;
      if (L.pull.t > 0.62) { L.pull = null; P.drive = null; }
    }
    // the switch's fixer: the nearest free man walks over
    if (L.fixDue && G.time >= L.fixDue) {
      L.fixDue = 0;
      // (the dark row's own man, if he is free; else the nearest)
      const free = crew.men.filter((m) => !m.down && m.mode !== 'alarm' && !m.hood && (m.mode === 'patrol' || m.mode === 'hold' || m.mode === 'return' || m.mode === 'wait'))
        .sort((a, b) => (b.spec.row === 'B') - (a.spec.row === 'B') || Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) - Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z));
      const m = free[0];
      if (m) {
        L.fixer = m;
        m.fixing = { face: P.face, dur: 8.0, onDone: () => {
          P.throw(true);
          G.sfx.play('switch', P.pos, {}, { ref: 3 });
          for (const l of stage.lamps.rows.get('B')) stage.lamps.dim(l, true);
          L.fixer = null;
          L.switchBack = true;
        } };
        m.setMode('fix');
        m.go(P.stand.x, P.stand.z);
      }
    }
    if (L.fixer && (L.fixer.down || L.fixer.mode === 'alarm')) { L.fixer = null; if (!P.on) L.fixDue = G.time + 2; }
  });
}

function canTakeDown(m, G) {
  if (m.down || m.mode === 'alarm' || m.a > 0.3 || m.mode === 'curious') return false;
  if (G.player.hands.busy || !G.controller.sneak) return false;
  const dx = G.eye.x - m.pos.x, dz = G.eye.z - m.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > 1.7) return false;
  // behind him: more than 110 degrees off where he faces and looks
  const ang = Math.atan2(dx, dz);
  const off = (a) => Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a)));
  return off(m.fig.yaw) > 1.9 && off(m.look) > 1.7;
}

function takeDown(ctx, m) {
  const G = ctx.game, H = G.player.hands;
  G.controller.frozen = true;
  H.play('sn_blow', { onMark: {
    hit: () => { m.knockDown(); G.sfx.play('blow', m.eye(new THREE.Vector3()), {}, { ref: 2 }); G.sfx.play('gasp', m.eye(new THREE.Vector3()), {}, { ref: 2 }); G.sfx.play('fold', m.pos.clone(), {}, { ref: 2, delay: 0.2 }); },
    lowered: () => {
      G.controller.frozen = false;
      // (down with him: crouched again if I was)
      const L = ctx.flags.live;
      if (L && L.recrouch && G.controller.sneak) { G.controller.sneak.crouch = true; L.recrouch = false; }
    },
  } });
  ctx.flags.takedowns = (ctx.flags.takedowns || 0) + 1;
}

// ---- the office: the order, and the Cardinal at the window -------------------------------
function* listenBeat(ctx) {
  const G = ctx.game, L = LIVE;
  const card = L.card;
  const win = ctx.stage.anchor('pier9.office.window.in');
  yield wait(0.8);
  // (back at the window after the cosh: the order is not heard twice - his
  // last line, and he comes to the window)
  for (let i = L.retry ? LINES.length - 1 : 0; i < LINES.length; i++) {
    L.said = i + 1;
    yield* ctx.say(LINES[i], 3.0);
    yield wait(i === LINES.length - 1 ? 0.6 : 1.0);
  }
  // he comes to the window: his steps, his shape on the blinds
  G.sfx.play('step', win.pos.clone().setY(PIER.mezz.y), { run: false, k: 0.5 }, { ref: 2 });
  yield* walkFig(card, win.pos.x, win.pos.z + 0.1, 0.9);
  card.fig.yaw = 0;
  L.looking = true;
  // (the tell: the blinds go up a hand's width with a rattle and the light
  // falls out of the office in a slab across the catwalk: he is looking.
  // A second from the rattle before standing or moving under it counts)
  G.sfx.play('newspaper', win.pos.clone().setY(PIER.mezz.y + 1.6), {}, { ref: 2 });
  // he looks down at the floor for three seconds: I must be down and still
  const LOOK = 3.2;
  for (let t = 0; t < LOOK; t += 1 / 60) {
    blinds(ctx.stage, sstep(0, 0.35, t));
    const pl = L.crew.player;
    const near = Math.hypot(pl.feet.x - win.pos.x, pl.feet.z - (win.pos.z + 1)) < 5.5 && ctx.stage.part('mezz').up;
    if (near && t > 1.0 && (!pl.crouch || pl.speed > 0.45)) {
      L.crew.alarm({ eye: () => win.pos.clone().setY(PIER.mezz.y + 1.6), name: 'cardinal' });
      break;
    }
    yield null;
  }
  L.looking = false;
  if (L.crew.alarmT >= 0) { yield until(() => false); return; }
  // (the blinds let down again)
  G.sfx.play('newspaper', win.pos.clone().setY(PIER.mezz.y + 1.6), {}, { ref: 2, gain: 0.6 });
  for (let t = 0; t < 0.4; t += 1 / 60) { blinds(ctx.stage, 1 - sstep(0, 0.4, t)); yield null; }
  blinds(ctx.stage, 0);
  yield* walkFig(card, ctx.stage.anchor('pier9.office.desk').pos.x, ctx.stage.anchor('pier9.office.desk').pos.z, 0.9);
  card.fig.yaw = 0;
}

// the office's blinds raised by k (0 down, 1 up a hand's width): the slats
// gather under the head rail, the light through them on the catwalk goes
// from bars to a slab
function blinds(stage, k) {
  const mz = stage.part('mezz');
  if (!mz || !mz.slats) return;
  const top = PIER.mezz.y + PIER.office.win.y1;
  const s = 1 - 0.42 * k;
  mz.slats.scale.y = s;
  mz.slats.position.y = top * (1 - s);
  mz.slats.updateMatrixWorld(true);
  const u = mz.barsQ && mz.barsQ.material.uniforms;
  if (u && u.uOpen) u.uOpen.value = k;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// a figure walked to a point at his pace (the office's)
function* walkFig(c, x, z, speed) {
  const F = c.fig;
  c.setState('walk', 0.25);
  for (let n = 0; n < 600; n++) {
    const dx = x - F.pos.x, dz = z - F.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.08) break;
    const want = Math.atan2(dx, dz);
    let e = want - F.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
    F.yaw += Math.sign(e) * Math.min(Math.abs(e), 4 / 60);
    F.speed = Math.min(speed, d * 60);
    yield null;
  }
  F.speed = 0;
  c.setState('idle', 0.3);
}

export default defineScene({
  id: 'warehouse', stage: 'pier9',
  beats: BEATS,
  save: ['floor', 'lamps', 'aisle', 'stairs', 'listen', 'out', 'fight'],
  setup: Object.fromEntries(BEATS.map((b) => [b, (ctx) => setupAt(ctx, b)])),
  *script(ctx) {
    const G = ctx.game, stage = ctx.stage;
    if (!LIVE || !ctx.flags.live) setupAt(ctx, ctx.from || 'arrive');
    live(ctx);
    const L = LIVE, crew = L.crew, C = G.controller;
    const inside = () => inShed(C.pos.x, C.pos.z) && C.pos.z < -0.7;
    const cp = (b) => { ctx.flags.cp = b; L.cp = b; };

    if (ctx.at('arrive')) {
      yield beat('arrive');
      yield until(() => inside());
    }
    if (ctx.at('floor')) {
      yield beat('floor');
      cp('floor');
      // the first man leaves the truck and walks his round, through the
      // door's pool, as I come in
      const sully = crew.get('sully');
      yield wait(ctx.from === 'floor' ? 1.4 : 0.5);
      if (sully.mode === 'wait') sully.setMode('patrol');
      // C crouch: taught once, while he is near and I am standing
      const tau = L.stealth.taught;
      while (!(C.pos.z < -12.3 || (C.pos.x > -2.5 && C.pos.z < -6.5))) {
        const near = Math.hypot(sully.pos.x - C.pos.x, sully.pos.z - C.pos.z) < 11;
        if (!tau.crouch && near && C.sneak && !C.sneak.crouch && L.stealth.coshT < 0 && crew.alarmT < 0) G.hud.prompt('C  crouch', null, 'b6c');
        else G.hud.clearPrompt('b6c');
        yield null;
      }
      G.hud.clearPrompt('b6c');
    }
    if (ctx.at('lamps')) {
      yield beat('lamps');
      cp('lamps');
      // (on up the aisle once the switch is back - or past the second stack)
      yield until(() => (L.switchBack && C.pos.z < -16.3) || C.pos.z < -25 || stage.part('mezz').up);
    }
    if (ctx.at('aisle')) {
      yield beat('aisle');
      cp('aisle');
      yield until(() => C.pos.z < -33.2 || stage.part('mezz').up);
    }
    if (ctx.at('stairs')) {
      yield beat('stairs');
      cp('stairs');
      const win = stage.anchor('pier9.office.window');
      yield until(() => stage.part('mezz').up && Math.hypot(C.pos.x - win.pos.x, C.pos.z - win.pos.z) < 1.4);
    }
    if (ctx.at('listen')) {
      yield beat('listen');
      cp('listen');
      yield* listenBeat(ctx);
    }
    if (ctx.at('out')) {
      yield beat('out');
      cp('out');
      // the way I came is shut: the truck backs against the side door
      const W = stage.part('works'), shed = stage.part('shed');
      if (ctx.from !== 'out') {
        shed.sideDoor.close();
        W.truck.back(7);
        G.sfx.play('engine', V(PIER.truck.from.x, 1, PIER.truck.from.z), { dur: 8 }, { ref: 10 });
        // (the engine calls the Hood with the torch down to it)
        yield wait(1.6);
        const h2 = crew.get('hood2');
        if (h2) h2.sendTo(HOOD2_TRUCK.at[0], HOOD2_TRUCK.at[1], HOOD2_TRUCK.yaw, HOOD2_TRUCK.looks);
      }
      // [R2-E] down the far stairs (or round by the gap at the bay's door):
      // the bay
      yield until(() => nearBay(stage, C));
    }
    if (ctx.at('fight')) {
      yield beat('fight');
      cp('fight');
      yield* pierFight(ctx);
    }
    if (ctx.at('ko') && ctx.from === 'ko') {
      yield beat('ko');
      yield until(() => !G.brawl.active);
      backToFeet(ctx);
    }
    if (ctx.at('after')) {
      yield beat('after');
      // out by the bay's side door onto the pier in the rain
      yield until(() => C.pos.x > PIER.shed.x1 + 0.4 && C.pos.z > PIER.bayDoor.z - 1.5);
      // (out on the apron, a few steps from the door: the scene ends on the
      // pier in the rain)
      yield until(() => C.pos.x > PIER.shed.x1 + 0.4 && Math.hypot(C.pos.x - (PIER.shed.x1 + 0.6), C.pos.z - PIER.bayDoor.z) > 3.2);
      G.music.stop(2);
      ctx.flags.done = true;
      ctx.next();
    }
  },
  // the autoplay driver: the fight read by its marks (the stealth is not
  // autoplayed: tools/plays/warehouse.json plays it by real input)
  auto(ctx, A) {
    const G = ctx.game;
    if (G.brawl.active) { A.fight(G.brawl); return; }
    A.stopWalk();
  },
});

// [R2-E] am I at the bay: on the far stairs' lower half going down, or on
// its floor, or in the gap by its door
function nearBay(stage, C) {
  if (stage.part('mezz').up && !(C.pos.x > 11.2 && Math.abs(C.pos.z - PIER.stairs.E.z) < 0.7)) return false;
  const onStairs = C.pos.x > 11.2 && C.pos.x < PIER.stairs.E.foot + 0.1 && Math.abs(C.pos.z - PIER.stairs.E.z) < 0.7;
  const inBay = C.pos.x > 9.9 && C.pos.z > -41.2 && C.pos.z < -28.3 && C.groundY < 0.5;
  return onStairs || inBay;
}

// the fight's beat: he steps out of the dark by the door, the hook turning
// in his hand; I come to the ring (the look eased round to him, my hand to
// the revolver and away); the fight; the last blow; on my feet again
function* pierFight(ctx) {
  const G = ctx.game, C = G.controller, L = LIVE, stage = ctx.stage, H = G.player.hands;
  const B = G.brawl;
  L.fightOn = true;
  if (ctx.from !== 'fight') quietCrew(ctx, L);
  G.music.stop(2.5);
  // ---- he steps out
  const fm = spawnForeman(ctx, 'pier9.bay.foreman');
  L.fm = fm;
  const mark = { x: 13.25, z: -32.7 };
  G.sfx.play('step', V(14.2, 0.1, -30.4), { run: false, k: 0.7 }, { ref: 3 });
  G.sfx.play('b9hookScrape', V(14.2, 1.1, -30.4), {}, { ref: 3 });
  L.spin = 1;
  let arrived = false;
  L.jobs = [(function* () { yield* fm.walkTo(mark, { speed: 1.1 }); arrived = true; fm.face(Math.atan2(G.eye.x - fm.pos.x, G.eye.z - fm.pos.z)); fm.setState('br_guard', 0.4); })()];
  try { fm.fig.anim.setOverlay('fm_hookLow', 0.3); } catch (e) { /* */ }
  // ---- I come down to him (or he comes on): at most a few seconds
  const t0 = G.time;
  yield until(() => { crewOutOfSight(ctx, L); return (C.groundY < 0.3 && C.pos.z > -40.9 && C.pos.x > 9.9) || G.time - t0 > 6; });
  L.stealth.undress();
  // ---- one eased move: into the ring, facing him, my hand to the revolver
  // and away (the look stays mine within 0.3 rad)
  const P0 = C.eyePose();
  const me = { x: Math.max(11.0, Math.min(13.0, C.pos.x)), z: Math.max(-38.9, Math.min(-35.6, C.pos.z)) };
  const dur = 1.1;
  C.setMode('brawlIn', { look: [0.3, 0.2], track: (t) => {
    const u = Math.min(1, t / dur), e = u * u * (3 - 2 * u);
    const x = P0.x + (me.x - P0.x) * e, z = P0.z + (me.z - P0.z) * e;
    const hx = fm.bones.chest.getWorldPosition(_hv);
    const ty = Math.atan2(-(hx.x - x), -(hx.z - z)), tp = Math.atan2(hx.y - (EYE_Y + 0.02), Math.max(0.6, Math.hypot(hx.x - x, hx.z - z)));
    const y = P0.y + (EYE_Y - P0.y) * e;
    return { x, y, z, yaw: P0.yaw + Math.atan2(Math.sin(ty - P0.yaw), Math.cos(ty - P0.yaw)) * e, pitch: P0.pitch + (tp - P0.pitch) * e };
  } });
  H.equip('sneak');
  H.play('sn_coat');
  G.sfx.play('pocket', null, {}, { send: false });
  yield wait(0.9);
  // (he saw it: the hook stops turning; he comes on)
  L.spin = 0;
  yield until(() => arrived || G.time - t0 > 9);
  try { fm.fig.anim.setOverlay(null, 0.25); } catch (e) { /* */ }
  // ---- the fight
  const Pm = C.eyePose();
  const yaw = Math.atan2(-(fm.pos.x - Pm.x), -(fm.pos.z - Pm.z));
  C.setMode('brawl', { opponent: fm, eyeY: EYE_Y, pos: { x: Pm.x, z: Pm.z }, yaw, ease: 0.3 });
  beginPierFight(ctx, fm);
  L.fightT = G.time;
  yield until(() => B.finished || !B.active);
  yield until(() => !B.active);
  L.won = true;
  backToFeet(ctx);
  if (!ctx.at('after') || true) { /* on into the walk out */ }
}
const _hv = new THREE.Vector3();

// after the last blow: on my feet again in the bay, the hands mine
function backToFeet(ctx) {
  const G = ctx.game, C = G.controller, L = LIVE;
  const P = C.eyePose();
  // (inside the shed, by the hole: never out over the water)
  C.setPose(Math.min(14.2, P.x), P.z, P.yaw, Math.max(-0.25, P.pitch));
  C.setMode('sneak', { crouch: false, sfx: G.sfx });
  L.stealth.dress();
  L.won = true;
  if (L.fm) { L.fm.fig.object.visible = false; }
}

// (the scene leaving: the hands and their light back as they were)
export function leaveWarehouse() {
  if (LIVE) { LIVE.crew.clear(); LIVE.stealth.undress(); for (const o of LIVE.props) if (o.parent) o.parent.remove(o); if (LIVE.fight) LIVE.fight.clear(); if (LIVE.fightOn && HOOKED && HOOKED.brawl.active) HOOKED.brawl.stop(); LIVE = null; }
}
