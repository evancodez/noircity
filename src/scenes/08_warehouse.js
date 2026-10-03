import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { PIER, inShed } from '../stages/pier9/site.js';
import { Crew } from './warehouse/crew.js';
import { Stealth } from './warehouse/stealth.js';
import { PierFight, bayRoom, quietCrew, crewOutOfSight, FM_MANNERS, FOREMAN, RING_START, EYE_Y } from './warehouse/fight.js';
import { HUNTERS, HOODS_LOUD, relightLamps, onShot, goLoud, atBay, sendAnswerer } from './warehouse/loud.js';
import { buildProp } from '../props/index.js';
import { gunsOf } from '../guns/Guns.js';

// Chapter VII, Pier Nine (lane B6, rebuilt by lane C7: docs/story/briefs/
// C7_PIER.md). Three passes of the same shed, each with one goal:
//   quiet   "Get to the office. Stay out of the light." - my revolver is
//           empty (LMB: the hammer on nothing, "Empty."). The rules, each in
//           the picture: light is being seen (the lamps' pools, my hands
//           printed by the light on me); a man sees what his lantern or
//           torch falls on (and arm's length in the dark); running is
//           heard, creeping (C, Ctrl held) is not; a man shows what he
//           thinks (calm, the "hm" and the turn, the walk to look, the
//           shout); from behind, unseen, E puts him down; a body in a lamp's
//           pool is found. The shout is the warning ("They've seen me."):
//           they run to where they saw me; out of their sight they lose me
//           and settle, more watchful; up close, the cosh (game.fail),
//           back at the last checkpoint with the men I put down still down.
//   office  the order through the window; the Cardinal and his men leave by
//           the back door; in by the front: Dot's photograph crossed in red
//           (the still 'photo'), the drawer, the shells: the revolver full.
//   loud    "Get out. The loading bay." - the phone rings behind me, the
//           lamps come on, the Hoods hunt with torches and pistols. Shoot my
//           way out (the gun kit, once they have me), or stay in the dark
//           and make more of it (a lamp shot out); a shot is heard.
//   fight   the foreman at the bay: his hook takes the revolver into the
//           river; the brawl's rules (FIGHT.md v5); through the planks.
//   after   out by the bay's side door, along the pier to my coupe:
//           "The diner." (ctx.next()).
// Beats (?scene=warehouse&beat=<beat>, ?start=warehouse[.<beat>]):
//   arrive  by my coupe at the gate in the rain; the side door
//   floor, lamps, aisle, stairs   the quiet pass's checkpoints (in at the
//           door; the pocket by the switch; the second stack; the last)
//   listen  under the office window: the order; his look; they leave
//   office  the office (checkpoint)
//   loud    out of the office onto the catwalk (checkpoint)
//   fight   the foreman (checkpoint); ko (a jump); after
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const BEATS = ['arrive', 'floor', 'lamps', 'aisle', 'stairs', 'listen', 'office', 'loud', 'fight', 'ko', 'after'];
const QUIET = new Set(['arrive', 'floor', 'lamps', 'aisle', 'stairs', 'listen']);
const BAY_BEATS = new Set(['fight', 'ko', 'after']);
const LINES = ['The waitress talked.', 'The diner. Tonight.', 'No one walks out.'];
const QUIET_LINE = 'Get to the office. Stay out of the light.';

// ---- the crew's rounds (designed: there is always a readable way through
// for a player who watches ten seconds) -----------------------------------------
// headings: a figure faces (sin yaw, cos yaw): north (into the shed) PI,
// south 0, east PI/2, west -PI/2
const CREW = [
  // the first man: loading the truck's tail as I come to the door; he walks
  // west through the door's pool, turns up aisle A and walks his round
  // ([C7] at its south end he looks down the aisle to the door: a player
  // who waits in the dark by the door is found - waiting is not a way in)
  { name: 'sully', kind: 'dockhand', light: 'lantern', at: [-8.1, -5.1], yaw: 2.5, start: 'wait', entry: [{ x: -10.9, z: -5.0 }],
    route: [{ x: -11.2, z: -24.6, wait: 4.0, looks: [PI, -PI / 2 - 0.3, PI] }, { x: -11.2, z: -6.6, wait: 4.2, looks: [PI / 2, 0.12, 0.12, 0.9] }] },
  // a loop round the block east of aisle B: east along the cross aisle to
  // the hoist's post, south down aisle C, west along the truck's strip,
  // north up aisle B's east side
  { name: 'rusty', kind: 'dockhand', light: 'torch', at: [6.0, -14.2], yaw: PI / 2, ri: 1,
    route: [{ x: 3.9, z: -14.2, wait: 1.6, looks: [PI / 2] }, { x: 9.2, z: -14.2, wait: 2.6, looks: [PI, 0.2] },
      { x: 10.3, z: -4.7, wait: 1.6, looks: [-PI / 2] }, { x: 2.6, z: -4.0, wait: 0 }, { x: 2.6, z: -12.6, wait: 0 }] },
  // aisle B's man (its lamps are his: when they go, he goes to the switch)
  { name: 'bert', kind: 'dockhand', light: 'lantern', at: [0, -25], yaw: PI, ri: 1, row: 'B',
    route: [{ x: 0, z: -22.6, wait: 2.4, looks: [PI / 2, -PI / 2] }, { x: 0, z: -31.0, wait: 3.2, looks: [PI / 2, -PI / 2] }] },
  // aisle C's north half and the loading bay
  { name: 'cal', kind: 'dockhand', light: 'torch', at: [11, -22], yaw: PI, ri: 2,
    route: [{ x: 11, z: -17.4, wait: 2.0, looks: [0.0, -PI / 2] }, { x: 11, z: -26, wait: 0 }, { x: 12, z: -34, wait: 3.0, looks: [PI / 2, 0.2] }, { x: 11, z: -26, wait: 0 }] },
  { name: 'hood1', kind: 'hood', light: 'torch', at: [-2.8, -37.6], yaw: 0.6, variant: { coat: 1, brim: 1, tall: 1, cig: true },
    looks: [0.65, -0.35, 0.2], lookEvery: 4.2 },
  { name: 'hood2', kind: 'hood', light: 'torch', at: [3.0, -36.4], yaw: PI / 2, ri: 1, variant: { coat: 2, brim: 0, tall: 0 }, speed: 1.1,
    route: [{ x: -0.6, z: -36.4, wait: 2.6, looks: [0.15, -0.6] }, { x: 6.8, z: -36.4, wait: 2.6, looks: [-0.1, 0.5] }] },
];
// where each checkpoint puts me (in the dark)
const START = {
  arrive: { x: PIER.start.x, z: PIER.start.z, yaw: PIER.start.yaw, pitch: 0.02 },
  floor: { x: -10.4, z: -1.2, yaw: 0.05, pitch: -0.02 },
  lamps: { x: -6.65, z: -11.1, yaw: 0.4, pitch: -0.05, crouch: true },
  aisle: { x: -7.65, z: -17.3, yaw: 2.1, pitch: -0.02, crouch: true },
  stairs: { x: -7.95, z: -33.1, yaw: 0.9, pitch: 0.05, crouch: true },
  listen: { x: -1.0, z: -41.7, yaw: 0.0, pitch: 0.2, crouch: true, up: true },
  // in the office's door, the desk and its lamp before me
  office: { x: 3.1, z: -41.45, yaw: 0.95, pitch: -0.1, up: true },
  // out of the office onto the catwalk, the shed below
  loud: { x: 3.2, z: -41.6, yaw: PI - 0.55, pitch: -0.3, crouch: true, up: true },
  fight: { x: 14.15, z: -39.85, yaw: 2.85, pitch: -0.08 },
  ko: { x: 12.9, z: -33.9, yaw: -PI / 2, pitch: -0.1 },
  after: { x: 12.6, z: -34.2, yaw: -PI / 2 - 0.3, pitch: -0.12 },
};
let LIVE = null;   // the scene's running state (its crew, its stealth, its props)
let HOOKED = null; // (the game whose scene:exit puts the hands back)
let RETRY = null;  // the checkpoint a fail sends me back to (a beat heard once is not heard again whole)
let SNAP = null;   // [C7] the men down when the last checkpoint was reached: they stay down

// ---- the room as a beat has it ---------------------------------------------------------
function setupAt(ctx, b) {
  const G = ctx.game, stage = ctx.stage;
  if (HOOKED !== G) { HOOKED = G; G.on('scene:exit', (e) => { if (e && e.id === 'warehouse') leaveWarehouse(); }); }
  if (LIVE) { if (LIVE.stepWrap && G.controller.onStep === LIVE.stepWrap) G.controller.onStep = LIVE.origOnStep; LIVE.crew.clear(); LIVE.stealth.undress(); for (const o of LIVE.props) if (o.parent) o.parent.remove(o); if (LIVE.fight) LIVE.fight.clear(); LIVE = null; }
  if (G.brawl.active) G.brawl.stop();
  const K = gunsOf(G);
  K.end();
  const W = stage.part('works'), shed = stage.part('shed'), mezz = stage.part('mezz'), L = stage.lamps;
  stage.part('bay').reset();
  for (const d of shed.loading) d.reset();
  if (G.sfx && G.sfx.roomOpen) G.sfx.roomOpen(0);
  // the place: lamps on (the shot ones whole again), the switch up, the
  // load hanging, the truck by the big doors, the doors as the beat has them
  W.panel.throw(true); W.panel.k = 1; W.panel.drive = null;
  relightLamps(stage);
  W.hoist.reset();
  W.truck.reset();
  const bayB = BAY_BEATS.has(b), loudB = b === 'loud';
  shed.sideDoor.snap(b === 'arrive' || bayB || loudB ? 0 : 1);
  shed.bayDoor.snap(0);
  blinds(stage, 0);
  // the office: shut until I open it; the back door shut; the drawer shut
  // with the shells in it until I take them
  const past = (x) => BEATS.indexOf(b) > BEATS.indexOf(x);
  mezz.officeDoor.set(past('office') ? 1 : 0);
  // (the far stairs: open on the way in; chained from the order on)
  mezz.gateE.set(past('listen') ? 1 : 0);
  mezz.backDoor.set(0);
  mezz.drawerAt.set(past('office') ? 1 : 0);
  mezz.shells.visible = !past('office');
  // the crew (in the bay's beats they are about their rounds at the shed's
  // far end, out of it: the fight is quiet)
  const crew = new Crew(G, stage, { rng: ctx.rng.fork(81) });
  if (QUIET.has(b) || b === 'office') for (const spec of CREW) crew.add(spec);
  if (loudB) {
    // (the dock hands keep back: the Hoods hunt, and three more with them)
    for (const spec of CREW) if (spec.kind === 'hood') crew.add({ ...spec, ...HOODS_LOUD[spec.name], hunter: true, ri: 0, wait0: 0 });
    for (const spec of HUNTERS) crew.add(spec);
  }
  // (a jump past the door: the first man is already on his round)
  if (b !== 'arrive' && b !== 'floor' && crew.get('sully')) { const s = crew.get('sully'); s.entry = null; s.c.place({ x: -11.2, z: -8.2 }, PI); s.look = s.light = s.lookWant = PI; s.setMode('patrol'); }
  if (b === 'aisle') { const s = crew.get('sully'); s.c.place({ x: -11.2, z: -14.6 }, 0); s.look = s.light = s.lookWant = 0; s.ri = 1; s.wait = 0; s.path = null; }
  // [C7] the men I put down before the checkpoint: down where they lay
  if (SNAP && SNAP.cp === b) {
    for (const d of SNAP.downs) {
      const m = crew.get(d.name);
      if (!m) continue;
      m.c.place({ x: d.x, z: d.z }, d.yaw);
      m.knockDown(); m.found = d.found;
    }
  }
  crew.litAt = (p) => litAt(G, p);
  // the office: the Cardinal and his two men (gone by the office's beat)
  const office = [];
  let card = null;
  if (QUIET.has(b)) {
    const cardKind = ctx.cast.has('cardinal') ? 'cardinal' : 'heavy';
    card = ctx.cast.spawn(cardKind, { at: 'pier9.office.desk', brain: 'none', name: 'cardinal', variant: { coat: 0, brim: 1, tall: 1, cig: true, heavy: true, unarmed: true } });
    office.push(card);
    office.push(ctx.cast.spawn('hood', { at: 'pier9.office.side', brain: 'none', name: 'officeA', variant: { coat: 2, brim: 1, tall: 0 } }));
    office.push(ctx.cast.spawn('hood', { at: 'pier9.office.cab', brain: 'none', name: 'officeB', variant: { coat: 1, brim: 0, tall: 1, cig: true } }));
    for (const c of office) { c.fig.surface = () => PIER.mezz.y; c.noGlance = true; c.fig.update(0, 0); }
    card.yaw = 0; card.fig.yaw = 0;
  }
  const props = [];
  // the bottles on their crates
  const bottles = [];
  if (!loudB && !bayB) PIER.bottles.forEach(([, , v], i) => { const o = stage.part('stacks').bottleAt(i, v); props.push(o); bottles.push(o); });
  // her photograph on his desk, under the lamp (taken in the office's beat)
  let photo = null;
  if (!past('office')) {
    photo = buildProp('dotPhoto');
    photo.position.set(0.25, PIER.mezz.y + 0.792, -43.86);
    photo.rotation.y = 0.12;
    stage.scene.add(photo);
    photo.traverse((o) => { if (o.isMesh) o.userData.noRay = true; });
    props.push(photo);
  }
  // me
  const S = START[b] || START.arrive;
  mezz.setUp(!!S.up);
  G.controller.frozen = false;
  G.controller.setPose(S.x, S.z, S.yaw, S.pitch, S.up ? PIER.mezz.y : 0);
  const stealth = new Stealth(ctx, crew);
  if (loudB) {
    // the revolver full (every retry gives it as it was here), the gun's mode
    G.controller.setMode('gun', { crouch: !!S.crouch });
    G.eye.copy(G.camera.position);
    K.arm('revolver');
    // (the men's grid and cover read with the level down: the posts under
    // the mezzanine are in their way, the catwalk's rails are not)
    mezz.setUp(false);
    K.begin({ to: 'loud', maxFiring: 2, flankAfter: 9, settleK: 1.15, dmgK: 0.8, area: { x0: PIER.shed.x0, x1: PIER.shed.x1, z0: PIER.shed.z0, z1: PIER.shed.z1 },
      why: { open: 'Shot standing in the light.', moving: 'Shot in the open.' } });
    mezz.setUp(true);
    stealth.loud = true;
  } else {
    G.controller.setMode('sneak', { crouch: !!S.crouch, sfx: G.sfx });
    stealth.dress();
    // [C7] the revolver as the river road left it: empty
    emptyGun(G);
  }
  // (the look is held while the scene comes up out of the black: the first
  // frame is the composed one)
  G.controller.lookLocked = true;
  LIVE = { crew, stealth, props, bottles, office, card, photo, beat: b, cp: b, retry: RETRY === b, fight: new PierFight(ctx), K };
  RETRY = null;
  ctx.flags.live = LIVE;
  ctx.flags.cp = LIVE.cp;
  if (!bayB) G.music.cue('warehouse');
  else G.music.stop(0.5);
  if (bayB) { G.player.weapons.equip(null); }
  if (b === 'ko') stageKO(ctx, LIVE);
  if (b === 'after') stageAfter(ctx, LIVE);
  if (bayB) stealth.gunGone = true;
  return LIVE;
}

// the revolver's chambers all spent (the tail's last rounds), the gun away
function emptyGun(G) {
  const rv = G.player.weapons.impls.revolver;
  if (rv && Array.isArray(rv.chambers)) { rv.chambers = rv.chambers.map(() => 'spent'); rv.top = 0; }
}

// how lit a point is by the shed's lamps (not the men's own lights), 0..1
const _lv = new THREE.Vector3();
function litAt(G, p) {
  const X = G.exposure, S = G.stage;
  let sum = 0;
  for (const e of S.lights.entries) {
    if (e.torch || !e.enabled || !(e.intensity > 0)) continue;
    let k = X.lampAt(e, p);
    if (k <= 0.01) continue;
    _lv.subVectors(p, e.position);
    const d = _lv.length();
    _lv.divideScalar(d);
    if (G.rays.raycast(e.position, _lv, d - 0.3, { anyHit: true })) k = 0;
    sum += k;
  }
  return Math.min(1, sum);
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
// his jacket: by its collar in his left hand, or laid over the barrel by
// the door (the barrel's top, the drape toward the ring)
const JACKET_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI);
function jacketOn(ctx, c = null) {
  const L = LIVE, bay = ctx.stage.part('bay');
  const J = buildProp('jacket', { variant: c ? null : 'draped' });
  J.traverse((o) => { if (o.isMesh) o.userData.noRay = true; });
  if (c) c.hold(J, 'L', { grip: 'hang' });
  else { ctx.stage.scene.add(J); J.position.copy(bay.jacketAt); J.quaternion.copy(JACKET_Q); }
  if (L) L.props.push(J);
  return J;
}
// laid from his hand onto the barrel: the cloth's own path (object first),
// its shape going from hanging to laid over the rim as it goes
function layJacket(ctx, c) {
  const L = LIVE, J = c.held.L, G = ctx.game;
  if (!J) return;
  J.updateMatrixWorld(true);
  const p0 = J.getWorldPosition(V(0, 0, 0)), q0 = J.getWorldQuaternion(new THREE.Quaternion());
  c.hold(null, 'L');
  ctx.stage.scene.add(J); J.position.copy(p0); J.quaternion.copy(q0); J.scale.setScalar(1);
  const p1 = ctx.stage.part('bay').jacketAt.clone(), geo = J.children[0] && J.children[0].geometry;
  G.sfx.play('clothRustle', p1, {}, { ref: 2 });
  L.fight.tweens.push({ t: 0, dur: 0.4, step: (u) => {
    const e = u * u * (3 - 2 * u);
    J.position.lerpVectors(p0, p1, e); J.position.y += Math.sin(u * Math.PI) * 0.12;
    J.quaternion.copy(q0).slerp(JACKET_Q, e);
    if (geo && geo.userData.shape) geo.userData.shape(e);
  }, end: () => { J.position.copy(p1); J.quaternion.copy(JACKET_Q); if (geo && geo.userData.shape) geo.userData.shape(1); } });
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
    onGlass: (w) => { L.fight.burstDoor(w); L.fight.watchFall(w, fm); },
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
  jacketOn(ctx);
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
  jacketOn(ctx);
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
  const W = stage.part('works'), shed = stage.part('shed'), mezz = stage.part('mezz');
  const L = LIVE;
  const { crew, stealth } = L;
  // the crew hears my feet (the sneak's, or [C7] the gun mode's: a step
  // heard by its pace - a run far, a walk near, a creep not at all)
  G.controller.onFootfall = (x, z, f) => { if (!f.crouch) crew.noise(V(x, 0, z), f.run ? 8 : 3, 'step'); };
  if (L.stealth.loud) wrapSteps(G, L);
  // [C7] caught: the blow from behind, then the kit's fail (its black, its
  // words), back at the last checkpoint - the men I put down stay down
  crew.onCaught = () => {
    stealth.cosh(() => {
      const cp = ctx.flags.cp || 'floor';
      RETRY = cp;
      G.counters.caught = (G.counters.caught || 0) + 1;
      G.fail({ why: 'They caught you.', to: cp });
    });
  };
  // the shout is the warning; [C7] in the loud pass it is the gunfight
  crew.onAlarm = () => { if (L.stealth.loud) goLoud(ctx, L); };
  // ---- the things of the place
  const grip = () => { const o = new THREE.Object3D(); o.userData = { kind: 'lever', grip: new THREE.Matrix4() }; return o; };
  const aimPath = (list) => { const H = G.player.hands; H.snPath = list; H.snTarget = list[0]; return list; };
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
  const cordPath = (c) => [[0, 0, 0], [0.05, 0.04, 0], [0.16, -0.02, 0], [0.26, -0.14, 0]].map(([dx, dy]) => {
    const o = grip(); o.position.set(c.x + dx, c.y + dy, c.z); o.rotation.set(0, -PI / 2, 0); o.updateMatrixWorld(true); return o;
  });
  // E on a thing: I step in to arm's length and square up to it, then the hand goes out
  const approach = (at, near, then, hold = 0.35, rise = false) => {
    const C = G.controller;
    const p0 = typeof at === 'function' ? at() : at;
    const d = Math.hypot(p0.x - C.pos.x, p0.z - C.pos.z);
    C.frozen = true;
    C.vel.x = C.vel.z = 0;
    L.approach = { at, near, then, hold, rise, t: 0, dur: Math.min(0.26, Math.max(0.1, (d - near) / 2.6)), fx: C.pos.x, fz: C.pos.z, y0: C.yaw, p0: C.pitch };
    if (rise && C.sneak && C.sneak.crouch) { C.sneak.crouch = false; L.recrouch = true; } else if (rise) L.recrouch = false;
  };
  L.approachFn = approach;
  const busy = () => G.player.hands.busy || !!L.approach;
  const sneaking = () => !!G.controller.sneak;
  // the side door (from outside)
  I.add({ id: 'b6door', at: V(PIER.sideDoor.x + 0.4, 1.05, 0.15), range: 2.4, cone: 1.1, prompt: 'open', when: () => !shed.sideDoor.isOpen && ctx.beat === 'arrive',
    onUse: () => { shed.sideDoor.open(1); G.sfx.play('creak', V(PIER.sideDoor.x, 1.2, 0), {}, { ref: 3 }); } });
  // the bottles
  L.bottles.forEach((b, i) => {
    I.add({ id: 'b6bottle' + i, at: () => b.getWorldPosition(new THREE.Vector3()).add(V(0, 0.15, 0)), range: 1.55, cone: 0.95, prompt: 'bottle',
      when: () => sneaking() && !stealth.bottle && b.parent && b.parent !== G.vm.root && !busy() && stealth.coshT < 0,
      onUse: () => approach(b.getWorldPosition(new THREE.Vector3()).add(V(0, 0.12, 0)), 0.45, () => stealth.take(b), 0.34) });
  });
  // the knife switch: the middle aisle's lamps go dark; a man comes to put it back
  const P = W.panel;
  I.add({ id: 'b6switch', at: () => P.pos, range: 1.8, cone: 1.2, prompt: 'pull the switch',
    when: () => sneaking() && P.on && !L.fixer && !busy() && !stealth.aiming,
    onUse: () => approach(P.lever.localToWorld(V(0.03, 0.3, 0)), 0.55, () => {
      aimPath(leverPath(P));
      L.pull = { t: 0 };
      G.player.hands.play(stealth.bottle ? 'sn_pullL' : 'sn_pull', { onMark: { pulled: () => {
        P.throw(false);
        G.sfx.play('switch', P.pos, {}, { ref: 3 });
        G.sfx.play('lampsOff', V(0, 4.3, -21), {}, { ref: 8 });
        for (const l of stage.lamps.rows.get('B')) if (!l.dead) stage.lamps.dim(l, false, { flicker: 0.15 + 0.2 * ctx.rng.next() });
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
  I.add({ id: 'b6hoist', at: () => HO.cleat, range: 1.8, cone: 1.2, prompt: 'let the load go', when: () => sneaking() && HO.up && !busy() && !stealth.aiming,
    onUse: () => approach(HO.cleat, 0.5, () => {
      aimPath(cordPath(HO.cleat.clone().add(V(0.02, 0.02, 0))));
      G.player.hands.play(stealth.bottle ? 'sn_pullL' : 'sn_pull', { onMark: { pulled: () => { HO.drop(); G.sfx.play('hoist', HO.cleat, {}, { ref: 5 }); } } });
    }, 0.6) });
  // a man from behind (only one who has not noticed me)
  for (const m of crew.men) {
    I.add({ id: 'b6ko_' + m.name, at: () => m.eye(new THREE.Vector3()).add(V(0, -0.35, 0)), range: 1.75, cone: 0.55, prompt: 'knock him out',
      when: () => !L.approach && !L.loud && canTakeDown(m, G), onUse: () => approach(() => m.eye(new THREE.Vector3()).add(V(0, -0.3, 0)), 0.8, () => takeDown(ctx, m), null, true) });
  }
  // ---- [C7] the office: its door, her photograph, the drawer, the shells
  const OD = PIER.office.door, my = PIER.mezz.y;
  I.add({ id: 'c7odoor', at: V((OD.x0 + OD.x1) / 2, my + 1.05, PIER.office.z1 + 0.02), range: 1.7, cone: 1.0, prompt: 'open',
    when: () => ctx.beat === 'office' && mezz.officeDoor.k < 0.05 && mezz.up && !busy(),
    onUse: () => { L.doorOpen = { t: 0 }; G.sfx.play('creak', V((OD.x0 + OD.x1) / 2, my + 1.2, PIER.office.z1), {}, { ref: 3 }); } });
  if (L.photo) {
    const ph = L.photo;
    I.add({ id: 'c7photo', at: () => ph.getWorldPosition(new THREE.Vector3()).add(V(0, 0.06, 0)), range: 1.6, cone: 1.0, prompt: 'look',
      when: () => ctx.beat === 'office' && !!ph.parent && ph.parent !== G.vm.root && !busy() && sneaking(),
      onUse: () => approach(ph.getWorldPosition(new THREE.Vector3()).add(V(0, 0.05, 0)), 0.55, () => takePhoto(ctx, ph), 0.4) });
  }
  I.add({ id: 'c7drawer', at: () => V(1.1, my + 0.6, -43.42 + 0.3 * (L.drawerK || 0)), range: 1.5, cone: 1.1, prompt: 'open the drawer',
    when: () => ctx.beat === 'office' && L.photoSeen && !L.drawerOpen && !busy(),
    onUse: () => { L.drawerOpen = { t: 0 }; G.sfx.play('b9plank', V(1.1, my + 0.6, -43.4), {}, { ref: 2 }); } });
  I.add({ id: 'c7shells', at: () => V(1.1, my + 0.6, -43.42 + 0.3), range: 1.5, cone: 1.1, prompt: 'take the shells',
    when: () => ctx.beat === 'office' && L.drawerK >= 0.98 && mezz.shells.visible && !busy(),
    onUse: () => approach(V(1.1, my + 0.58, -43.25), 0.5, () => takeShells(ctx), 0.4) });
  // the bay's side door (the way out, once the foreman is in the river)
  I.add({ id: 'b6bay', at: V(PIER.shed.x1 - 0.2, 1.05, PIER.bayDoor.z - 0.4), range: 2.2, cone: 1.1, prompt: 'open', when: () => !shed.bayDoor.isOpen && ctx.beat === 'after',
    onUse: () => { shed.bayDoor.open(1); G.sfx.play('creak', V(PIER.shed.x1, 1.2, PIER.bayDoor.z), {}, { ref: 3 }); } });
  // [C7] my coupe: the way to the diner
  I.add({ id: 'c7car', at: V(PIER.car.x, 1.0, PIER.car.z), range: 3.8, cone: 1.3, prompt: 'get in', when: () => ctx.beat === 'after' && L.won && !L.inCar,
    onUse: () => { L.inCar = true; G.controller.frozen = true; G.sfx.play('creak', V(PIER.car.x, 1, PIER.car.z), {}, { ref: 2 }); } });

  // [C7] my rounds: a lamp's head on the line goes out, a hunter who did not
  // have me goes down, and the shot is heard (the loud pass)
  const shotFn = (e) => {
    if (!LIVE || LIVE !== L || !L.stealth.loud || !e || e.weapon !== 'revolver') return;
    const cam = G.camera;
    const o = cam.getWorldPosition(new THREE.Vector3()), d = V(0, 0, -1).transformDirection(cam.matrixWorld);
    const wall = G.rays.raycast(o, d, 90);
    if (!L.loud) onShot(ctx, L, { o, d, far: wall ? wall.t : 90 });
    else onShot(ctx, L, { o, d, far: wall ? wall.t : 90, lampsOnly: true });
  };
  G.on('shot', shotFn);
  const offShot = (e) => { if (e && e.id === 'warehouse') { G.off('shot', shotFn); G.off('scene:exit', offShot); } };
  G.on('scene:exit', offShot);

  ctx.onStep((dt) => {
    if (!LIVE || LIVE !== L) return;
    if (G.controller.lookLocked && !G.scenes.trans && ctx.sceneTime > 0.5) G.controller.lookLocked = false;
    L.fight.step(dt);
    if (L.jobs) for (let i = L.jobs.length - 1; i >= 0; i--) if (L.jobs[i].next().done) L.jobs.splice(i, 1);
    if (L.fm && L.fm.hookInner) {
      L.spinA = (L.spinA || 0) + dt * 9 * (L.spin || 0);
      if (!L.spin) L.spinA = Math.round(L.spinA / (Math.PI * 2)) * Math.PI * 2 + (L.spinA % (Math.PI * 2)) * Math.exp(-dt * 10);
      L.fm.hookPivot.rotation.x = L.spinA;
    }
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
    // [C7] inside the office, behind its blinds, nobody on the floor sees me
    const C0 = G.controller;
    crew.player.hidden = mezz.up && C0.pos.x > PIER.office.x0 && C0.pos.x < PIER.office.x1 && C0.pos.z < PIER.office.z1 - 0.1;
    crew.step(dt, G.time);
    // the warning before the cosh: the shout, and its line while they hunt me
    if (!L.stealth.loud && !L.fightOn) ctx.hud.warn(crew.alarmT >= 0 ? 'They’ve seen me.' : null);
    else if (L.stealth.loud && !L.fightOn) ctx.hud.warn(L.loud && L.K.active ? L.K.warning() : crew.alarmT >= 0 ? 'They’ve seen me.' : null);
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
    if (L.thawAt && G.time >= L.thawAt) { L.thawAt = 0; if (stealth.coshT < 0 && !L.holdFrozen) G.controller.frozen = false; }
    // the switch's blade goes down with the hand on it
    if (L.pull) {
      L.pull.t += dt;
      const u = Math.min(1, Math.max(0, (L.pull.t - 0.34) / 0.24));
      P.drive = 1 - u;
      if (L.pull.t > 0.62) { L.pull = null; P.drive = null; }
    }
    // [C7] the office's door swinging in, the drawer sliding out
    if (L.doorOpen) { L.doorOpen.t += dt; mezz.officeDoor.set(sstep(0, 0.7, L.doorOpen.t)); if (L.doorOpen.t > 0.7) L.doorOpen = null; }
    if (L.doorClose) { L.doorClose.t += dt; mezz.officeDoor.set(1 - sstep(0, 0.6, L.doorClose.t)); if (L.doorClose.t > 0.6) L.doorClose = null; }
    if (L.drawerOpen) { L.drawerOpen.t += dt; L.drawerK = sstep(0, 0.35, L.drawerOpen.t); mezz.drawerAt.set(L.drawerK); }
    // the switch's fixer: the nearest free man walks over
    if (L.fixDue && G.time >= L.fixDue) {
      L.fixDue = 0;
      const free = crew.men.filter((m) => !m.down && m.mode !== 'alarm' && !m.hood && (m.mode === 'patrol' || m.mode === 'hold' || m.mode === 'return' || m.mode === 'wait'))
        .sort((a, b) => (b.spec.row === 'B') - (a.spec.row === 'B') || Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) - Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z));
      const m = free[0];
      if (m) {
        L.fixer = m;
        m.fixing = { face: P.face, dur: 8.0, onDone: () => {
          P.throw(true);
          G.sfx.play('switch', P.pos, {}, { ref: 3 });
          for (const l of stage.lamps.rows.get('B')) if (!l.dead) stage.lamps.dim(l, true);
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
      const L = ctx.flags.live;
      if (L && L.recrouch && G.controller.sneak) { G.controller.sneak.crouch = true; L.recrouch = false; }
    },
  } });
  ctx.flags.takedowns = (ctx.flags.takedowns || 0) + 1;
  G.counters.takedowns = (G.counters.takedowns || 0) + 1;
}

// [C7] her photograph: it comes up into my hand under the lamp; the still
function takePhoto(ctx, ph) {
  const G = ctx.game, H = G.player.hands, L = LIVE;
  H.snTarget = ph;
  L.holdFrozen = true;
  G.controller.frozen = true;
  H.play('sn_take', { onMark: { take: () => {
    H.hold(ph, 'R');
    G.sfx.play('kit_paper', null, {}, { send: false, gain: 0.7 });
    L.photoUp = G.time;
  } } });
}

// [C7] the box of shells: the cylinder filled, the rest in my pocket
function takeShells(ctx) {
  const G = ctx.game, mezz = ctx.stage.part('mezz'), L = LIVE;
  mezz.shells.visible = false;
  G.sfx.play('pocket', null, {}, { send: false });
  L.stealth.undress();
  const Ws = G.player.weapons;
  emptyGun(G);
  Ws.equip('revolver');
  const W = Ws.active;
  // (drawn, then the cylinder out and six rounds in, by the hands: the gun's own reload)
  L.reloadAt = G.time + 0.5;
  L.shellsT = G.time;
  if (!G.save.inventory.includes('shells')) G.save.inventory.push('shells');
  void W;
}

// ---- the office: the order, and the Cardinal at the window -------------------------------
function* listenBeat(ctx) {
  const G = ctx.game, L = LIVE;
  const card = L.card;
  const win = ctx.stage.anchor('pier9.office.window.in');
  yield wait(0.8);
  // (back at the window after the cosh: the order is not heard twice)
  for (let i = L.retry && L.beat === 'listen' ? LINES.length - 1 : 0; i < LINES.length; i++) {
    L.said = i + 1;
    yield* ctx.say(LINES[i], 3.0);
    yield wait(i === LINES.length - 1 ? 0.6 : 1.0);
  }
  G.sfx.play('step', win.pos.clone().setY(PIER.mezz.y), { run: false, k: 0.5 }, { ref: 2 });
  yield* walkFig(card, win.pos.x, win.pos.z + 0.1, 0.9);
  card.fig.yaw = 0;
  L.looking = true;
  G.sfx.play('newspaper', win.pos.clone().setY(PIER.mezz.y + 1.6), {}, { ref: 2 });
  const LOOK = 3.2;
  for (let t = 0; t < LOOK; t += 1 / 60) {
    blinds(ctx.stage, sstep(0, 0.35, t));
    const pl = L.crew.player;
    const near = Math.hypot(pl.feet.x - win.pos.x, pl.feet.z - (win.pos.z + 1)) < 5.5 && ctx.stage.part('mezz').up;
    if (near && t > 1.0 && (!pl.crouch || pl.speed > 0.45)) {
      L.crew.alarm({ eye: () => win.pos.clone().setY(PIER.mezz.y + 1.6), name: 'cardinal' });
      // (the office's men come out at me: the cosh, the window again)
      L.crew.known = pl.feet.clone();
      yield wait(1.2);
      L.crew.onCaught && L.crew.onCaught();
      break;
    }
    yield null;
  }
  L.looking = false;
  if (L.crew.alarmT >= 0) { yield until(() => false); return; }
  G.sfx.play('newspaper', win.pos.clone().setY(PIER.mezz.y + 1.6), {}, { ref: 2, gain: 0.6 });
  for (let t = 0; t < 0.4; t += 1 / 60) { blinds(ctx.stage, 1 - sstep(0, 0.4, t)); yield null; }
  blinds(ctx.stage, 0);
  // [C7] "Let's go.": out by the back door to the outside stair and his car
  yield wait(0.6);
  yield* ctx.say('Let’s go. Lock up.', 1.6);
  const mezz = ctx.stage.part('mezz');
  // [C7] his man locks the far stairs: out by the front door, along the
  // catwalk to their gate, the chain through it, and back in (a man in his
  // way, or up on his feet near him, is seen: the shout, the cosh)
  const man = L.office[2];
  const spotted = () => {
    const pl = L.crew.player, f = man.fig.pos;
    const d = Math.hypot(pl.feet.x - f.x, pl.feet.z - f.z);
    if (!mezz.up || L.crew.alarmT >= 0) return false;
    const ahead = Math.cos(Math.atan2(pl.feet.x - f.x, pl.feet.z - f.z) - man.fig.yaw) > 0.3;
    return d < 1.3 || (ahead && d < 3.2 && !pl.crouch) || (ahead && d < 2.0);
  };
  const caughtBy = function* () {
    L.crew.alarm({ eye: () => man.fig.pos.clone().setY(PIER.mezz.y + 1.6), name: 'officeB' });
    L.crew.known = L.crew.player.feet.clone();
    yield wait(1.4);
    if (L.crew.onCaught) L.crew.onCaught();
    yield until(() => false);
  };
  yield* walkFig(man, 1.85, -42.85, 1.1);
  L.doorOpen = { t: 0 };
  G.sfx.play('creak', V(1.85, PIER.mezz.y + 1.2, -42.3), {}, { ref: 3 });
  yield wait(0.75);
  for (const [x, z] of [[1.85, -41.55], [6.6, -41.55], [7.35, -40.3]]) { if (yield* walkFig(man, x, z, 1.15, spotted)) { yield* caughtBy(); return; } }
  man.fig.yaw = PI / 2;
  yield wait(0.3);
  G.sfx.play('b9chain', V(7.9, PIER.mezz.y + 0.6, -40.2), {}, { ref: 3 });
  for (let t = 0; t < 0.8; t += 1 / 60) { mezz.gateE.set(sstep(0, 0.8, t)); yield null; }
  G.sfx.play('b9clatter', V(7.9, PIER.mezz.y + 0.6, -40.2), {}, { ref: 3 });
  yield wait(0.6);
  for (const [x, z] of [[6.6, -41.55], [1.85, -41.55], [1.85, -42.85]]) { if (yield* walkFig(man, x, z, 1.15, spotted)) { yield* caughtBy(); return; } }
  L.doorClose = { t: 0 };
  G.sfx.play('creak', V(1.85, PIER.mezz.y + 1.2, -42.3), {}, { ref: 3, gain: 0.7 });
  yield wait(0.8);
  const door = { x: -1.75, z: -44.5 };
  const order = [L.office[1], L.office[0], L.office[2]];
  // (one after another along the back of the desk to the door; it opens on
  // the first, each steps through into the black and is gone)
  for (const c of L.office) c.setState('idle', 0.2);
  G.sfx.play('creak', V(door.x, PIER.mezz.y + 1.2, -44.8), {}, { ref: 3 });
  for (let t = 0; t < 0.5; t += 1 / 60) { mezz.backDoor.set(sstep(0, 0.5, t)); yield null; }
  for (const c of order) {
    yield* walkFig(c, c.fig.pos.x, -44.5, 1.1);
    yield* walkFig(c, door.x, door.z, 1.1);
    yield* walkFig(c, door.x, -44.95, 0.9);
    c.fig.object.visible = false;
    G.sfx.play('step', V(door.x, PIER.mezz.y - 0.5, -45.3), { run: false, k: 0.6 }, { ref: 3 });
  }
  for (let t = 0; t < 0.5; t += 1 / 60) { mezz.backDoor.set(1 - sstep(0, 0.5, t)); yield null; }
  G.sfx.play('b9thunk', V(door.x, PIER.mezz.y + 1.2, -44.8), {}, { ref: 3 });
  for (const c of L.office) ctx.cast.remove(c);
  L.office = [];
  // (down the outside stair; a car door, the engine, away along the pier)
  yield wait(1.6);
  G.sfx.play('engine', V(-6, 1, -52), { dur: 6 }, { ref: 12 });
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

// a figure walked to a point at his pace (the office's); [C7] stop(): true
// stops him (and the walk returns true)
function* walkFig(c, x, z, speed, stop = null) {
  const F = c.fig;
  c.setState('walk', 0.25);
  for (let n = 0; n < 600; n++) {
    const dx = x - F.pos.x, dz = z - F.pos.z, d = Math.hypot(dx, dz);
    if (stop && stop()) { F.speed = 0; c.setState('idle', 0.2); return true; }
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
  save: ['floor', 'lamps', 'aisle', 'stairs', 'listen', 'office', 'loud', 'fight'],
  // [C7] every beat's line (seams/Z.md §1): the scene's own, order.js's
  // stand-ins no longer apply
  objectives: {
    arrive: QUIET_LINE, floor: QUIET_LINE, lamps: QUIET_LINE, aisle: QUIET_LINE, stairs: QUIET_LINE,
    listen: 'Stay down. Listen.', office: 'Search his office.', loud: 'Get out. The loading bay.',
    fight: 'Put him down.', ko: 'Put him down.', after: 'Get to the car.',
  },
  setup: Object.fromEntries(BEATS.map((b) => [b, (ctx) => setupAt(ctx, b)])),
  *script(ctx) {
    const G = ctx.game, stage = ctx.stage;
    if (!LIVE || !ctx.flags.live) setupAt(ctx, ctx.from || 'arrive');
    live(ctx);
    const L = LIVE, crew = L.crew, C = G.controller, hud = ctx.hud, mezz = stage.part('mezz');
    const inside = () => inShed(C.pos.x, C.pos.z) && C.pos.z < -0.7;
    // a checkpoint: where a fail sends me back, with the men down as they lie
    // (only while they are calm: a checkpoint is never taken with a man on
    // to me - it waits for the calm)
    const calm = () => crew.alarmT < 0 && !crew.men.some((m) => !m.down && (m.a > 0.3 || m.mode === 'search'));
    const cpNow = (b) => {
      ctx.flags.cp = b; L.cp = b; L.cpPending = null;
      SNAP = { cp: b, downs: crew.men.filter((m) => m.down).map((m) => ({ name: m.name, x: m.pos.x, z: m.pos.z, yaw: m.fig.yaw, found: !!m.found })) };
    };
    const cp = (b) => { if (L.stealth.loud || L.fightOn || calm()) cpNow(b); else L.cpPending = b; };
    ctx.onStep(() => { if (L.cpPending && calm()) cpNow(L.cpPending); });
    // the quiet pass's cards (once per save): low and quiet as he comes; the
    // blow from behind the first time one is in reach
    const teachQuiet = () => {
      if (L.stealth.loud || L.fightOn) return;
      if (!L.taughtKo && G.interact.current && /^b6ko_/.test(G.interact.current.id || '')) { L.taughtKo = true; hud.teach('takedown', '[E] from behind: put him down', { until: 'KeyE', secs: 4 }); }
    };
    ctx.onStep(teachQuiet);

    if (ctx.at('arrive')) {
      yield beat('arrive');
      cp('floor');
      yield until(() => inside());
    }
    if (ctx.at('floor')) {
      yield beat('floor');
      cp('floor');
      const sully = crew.get('sully');
      yield wait(ctx.from === 'floor' ? 1.4 : 0.5);
      if (sully && sully.mode === 'wait') sully.setMode('patrol');
      // the creep: taught once, while he is near and I am standing
      let taught = false;
      while (!(C.pos.z < -12.3 || (C.pos.x > -2.5 && C.pos.z < -6.5) || mezz.up)) {
        const near = sully && Math.hypot(sully.pos.x - C.pos.x, sully.pos.z - C.pos.z) < 11;
        if (!taught && near && C.sneak && !C.sneak.crouch && L.stealth.coshT < 0 && crew.alarmT < 0) {
          taught = true;
          hud.teach('creep', '[C] creep: quiet, low', { until: ['KeyC', 'ControlLeft'], secs: 5 });
        }
        yield null;
      }
      if (G.fails('floor') === 2) hud.teach.again('creep');
    }
    if (ctx.at('lamps')) {
      yield beat('lamps');
      cp('lamps');
      yield until(() => (L.switchBack && C.pos.z < -16.3) || C.pos.z < -25 || mezz.up);
    }
    if (ctx.at('aisle')) {
      yield beat('aisle');
      cp('aisle');
      yield until(() => C.pos.z < -33.2 || mezz.up);
    }
    if (ctx.at('stairs')) {
      yield beat('stairs');
      cp('stairs');
      const win = stage.anchor('pier9.office.window');
      yield until(() => mezz.up && Math.hypot(C.pos.x - win.pos.x, C.pos.z - win.pos.z) < 1.4);
    }
    if (ctx.at('listen')) {
      yield beat('listen');
      cp('listen');
      yield* listenBeat(ctx);
    }
    if (ctx.at('office')) {
      yield beat('office');
      cp('office');
      // in by the door; her photograph under his lamp
      yield until(() => !!L.photoUp && !G.player.hands.busy);
      yield wait(0.35);
      const h = G.stills.play('photo');
      yield until(() => h.done);
      // (the print into my coat)
      G.player.hands.hold(null, 'R');
      if (L.photo && L.photo.parent) L.photo.parent.remove(L.photo);
      if (!G.save.inventory.includes('photo')) G.save.inventory.push('photo');
      L.photoSeen = true;
      L.holdFrozen = false;
      G.controller.frozen = false;
      hud.objective('Get to the diner.');
      // the drawer, the shells, the revolver full
      yield until(() => !!L.shellsT);
      yield until(() => G.time > L.reloadAt);
      const W = G.player.weapons.active;
      if (W && W.reload) W.reload();
      yield wait(0.4);
      yield until(() => !(G.player.weapons.active && G.player.weapons.active.reloading));
      gunsOf(G).arm('revolver');
      // out of his office: behind me, his telephone (or a shot of mine)
      yield until(() => C.pos.z > PIER.office.z1 + 0.25 || (G.counters.shots || 0) > (L.shots0 ?? (L.shots0 = G.counters.shots || 0)));
      G.sfx.play('c7phone', V(0.6, PIER.mezz.y + 0.9, -44.0), {}, { ref: 3 });
      yield wait(1.4);
      // the loud pass begins where I stand (its setup is for a retry)
      cp('loud');
      enterLoud(ctx, L);
      yield beat('loud');
    }
    if (ctx.at('loud')) {
      if (ctx.from === 'loud') yield beat('loud');
      cp('loud');
      // (the director's encounter while the pass lasts: the HUD's health)
      G.director.stop(); G.director.begin();
      G.director.run(function* () { while (G.scenes.ctx === ctx && ctx.beat === 'loud') yield null; });
      gunsOf(G).teach('crouch');
      const tL = G.time;
      // (a lamp shot out: taught once, the first time one hangs in my sight
      // while nobody has me)
      let lampCard = false;
      yield until(() => {
        if (!lampCard && !L.loud && G.player.weapons.active) {
          const cam = G.camera, o = cam.getWorldPosition(V(0, 0, 0)), d = V(0, 0, -1).transformDirection(cam.matrixWorld);
          for (const l of stage.lamps.lamps) {
            if (l.torch || l.dead || !l.on || !l.name) continue;
            const t = (l.head.x - o.x) * d.x + (l.head.y - o.y) * d.y + (l.head.z - o.z) * d.z;
            if (t < 2 || t > 26) continue;
            if (Math.hypot(o.x + d.x * t - l.head.x, o.y + d.y * t - l.head.y, o.z + d.z * t - l.head.z) < 0.9) { lampCard = true; hud.teach('lampout', '[LMB] shoot the lamp out: make it dark', { until: 'Mouse0', secs: 4 }); break; }
          }
        }
        if (!L.answerer && G.time - tL > 6 && !L.loud) L.answerer = sendAnswerer(ctx, L) || true;
        return atBay(stage, C);
      });
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
      // out by the bay's side door, along the pier to my coupe
      yield until(() => L.inCar);
      hud.objective(null);
      yield wait(0.5);
      yield* ctx.say('The diner.', 1.6);
      G.music.stop(2);
      ctx.flags.done = true;
      ctx.next();
    }
  },
  auto(ctx, A) {
    const G = ctx.game;
    if (G.brawl.active) { A.fight(G.brawl); return; }
    A.stopWalk();
  },
});

// [C7] into the loud pass from the office, as it stands: the lamps on along
// the aisles, the dock hands gone back to the doors, the Hoods out with
// torches and three more in at the big doors; me in the gun's mode, the
// revolver full; the gun kit's encounter (its fall goes back to 'loud')
function enterLoud(ctx, L) {
  const G = ctx.game, stage = ctx.stage, crew = L.crew, mezz = stage.part('mezz'), K = gunsOf(G);
  // the lamps (those I shot stay dead; the switch goes up)
  const W = stage.part('works');
  if (!W.panel.on) { W.panel.throw(true); G.sfx.play('switch', W.panel.pos, {}, { ref: 3 }); }
  for (const l of stage.lamps.lamps) if (!l.torch && l.name && !l.dead) { l.on = true; l.dying = null; }
  G.sfx.play('lampsOff', V(0, 4.3, -21), {}, { ref: 8 });
  // the dock hands keep back (out of the shed by the big doors: gone)
  for (const m of [...crew.men]) {
    if (m.down || m.hood) continue;
    m.remove(); ctx.cast.remove(m.c); crew.men.splice(crew.men.indexOf(m), 1);
  }
  // the Hoods hunt
  for (const m of crew.men) {
    if (m.down || !HOODS_LOUD[m.name]) continue;
    m.route = HOODS_LOUD[m.name].route; m.spec = { ...m.spec, hunter: true }; m.ri = 0; m.wait = 0; m.a = 0;
    m.setMode('patrol');
  }
  for (const spec of HUNTERS) crew.add(spec);
  crew.alarmT = -1; crew.watch = 1;
  // me: the gun's mode, crouched; the revolver full; the kit's encounter
  const C = G.controller, P = C.eyePose();
  L.stealth.undress();
  L.stealth.loud = true;
  C.setMode('gun', { crouch: true });
  C.pos.x = P.x; C.pos.z = P.z; C.yaw = P.yaw; C.pitch = P.pitch;
  K.arm('revolver');
  mezz.setUp(false);
  K.begin({ to: 'loud', maxFiring: 2, flankAfter: 9, settleK: 1.15, dmgK: 0.8, area: { x0: PIER.shed.x0, x1: PIER.shed.x1, z0: PIER.shed.z0, z1: PIER.shed.z1 },
    why: { open: 'Shot standing in the light.', moving: 'Shot in the open.' } });
  mezz.setUp(true);
  wrapSteps(G, L);
  G.counters.c7loudAt = G.time;
}

// the gun mode's footfalls to the crew's ears (a walk heard near, a run
// far, a crouch not at all); undone when the scene goes
function wrapSteps(G, L) {
  const C = G.controller;
  if (L.stepWrap && C.onStep === L.stepWrap) return;
  const prev = L.origOnStep = C.onStep;
  L.stepWrap = (x, z, v) => {
    if (prev) prev(x, z, v);
    const crouch = (C.crouchK || 0) > 0.5, sp = Math.hypot(C.vel.x, C.vel.z);
    if (!crouch && C.onFootfall) C.onFootfall(x, z, { run: sp > 3.6, crouch, speed: sp });
  };
  C.onStep = L.stepWrap;
}

// the fight's beat: he steps out of the dark by the door, the hook turning
// in his hand; I come to the ring (the look eased round to him, my hand to
// the revolver and away); the fight; the last blow; on my feet again
function* pierFight(ctx) {
  const G = ctx.game, C = G.controller, L = LIVE, stage = ctx.stage, H = G.player.hands;
  const B = G.brawl;
  L.fightOn = true;
  ctx.hud.warn(null);
  // [C7] the loud pass ends at the bay: the kit's encounter over, its men gone
  const K = gunsOf(G);
  if (K.active) K.end();
  for (const h of [...G.world.hoods.list]) G.removeHood(h);
  if (ctx.from !== 'fight') quietCrew(ctx, L);
  // [C1] (the music rule: beat 'fight' cues the `fight` slot over the
  // warehouse's, scenes/order.js beatMusic; it was stopped here, silent)
  // (look development, ?quick=1: the ring as a retry stages it, the fight
  // at once - the review's moments, b9duel)
  if (G.shotMode && typeof location !== 'undefined' && new URLSearchParams(location.search).get('quick') === '1') {
    L.stealth.undress();
    jacketOn(ctx);
    const f0 = restageRing(ctx);
    beginPierFight(ctx, f0);
    L.fightT = G.time;
    yield until(() => !B.active);
    L.won = true;
    backToFeet(ctx);
    return;
  }
  // ---- he steps out
  const fm = spawnForeman(ctx, 'pier9.bay.foreman');
  jacketOn(ctx, fm);
  L.fm = fm;
  const mark = { x: 13.25, z: -32.7 }, layAt = { x: 13.22, z: -29.98 };
  G.sfx.play('step', V(14.2, 0.1, -30.4), { run: false, k: 0.7 }, { ref: 3 });
  G.sfx.play('b9hookScrape', V(14.2, 1.1, -30.4), {}, { ref: 3 });
  L.spin = 1;
  let arrived = false;
  const over = (name) => { try { fm.fig.anim.setOverlay(name, 0.25); } catch (e) { /* */ } };
  // (out of the dark along the south crates to the barrel by the door; he
  // waits there till he has seen my hand go to the coat, lays his jacket
  // over the barrel, and comes on into the ring)
  L.jobs = [(function* () {
    over('fm_hookJacket');
    yield* walkFig(fm, layAt.x, layAt.z, 1.05);
    over('fm_hookJacket');
    const bz = ctx.stage.part('bay').jacketAt;
    const face = Math.atan2(bz.x - fm.pos.x, bz.z - fm.pos.z) - 0.75;
    for (let k = 0; k < 20; k++) { fm.fig.yaw += Math.atan2(Math.sin(face - fm.fig.yaw), Math.cos(face - fm.fig.yaw)) * 0.2; yield null; }
    const w0 = G.time;
    while (!(L.coatAt != null && G.time > L.coatAt + 0.4) && G.time - w0 < 5) yield null;
    over(null);
    const h = fm.play('fm_jacket', { fade: 0.15, onMark: { lay: () => layJacket(ctx, fm) } });
    while (!h.done && h.t < h.duration) yield null;
    over('fm_hookLow');
    L.spin = 0;
    yield* walkFig(fm, mark.x, mark.z, 1.25);
    arrived = true;
    over(null);
    fm.face(Math.atan2(G.eye.x - fm.pos.x, G.eye.z - fm.pos.z));
    fm.setState('br_guard', 0.4);
  })()];
  // ---- I come down to him (or he comes on): at most a few seconds
  const t0 = G.time;
  yield until(() => { crewOutOfSight(ctx, L); return (C.groundY < 0.3 && C.pos.z > -40.9 && C.pos.x > 9.9) || G.time - t0 > 6; });
  L.stealth.undress();
  // [C7] the revolver in my hand: his hook takes it out of the fight at once
  // - a cut on its black, the gun skittering off the planks into the water,
  // my hand stinging; whoever was still hunting me is gone with the cut
  const armed = !!G.player.weapons.active;
  if (armed) {
    G.hud.fade(1);
    G.sfx.play('b9hookScrape', G.eye.clone(), {}, { ref: 2 });
    G.sfx.play('blow', null, {}, { send: false, gain: 0.8 });
    G.player.weapons.equip(null);
    G.player.hands.hold(null, 'R'); G.player.hands.hold(null, 'L');
    G.controller.shake(0.5, 0);
    yield wait(0.22);
    G.hud.fade(0);
    G.sfx.play('b9plop', V(15.6, PIER.waterY, -33.5), {}, { ref: 4 });
    if (G.fx && G.fx.splash) G.fx.splash.spawn({ pos: V(15.8, PIER.waterY + 0.05, -33.5), vel: V(0, 2, 0), life: 0.6, size: [0.14, 0.14] });
    G.save.inventory = G.save.inventory.filter((k) => k !== 'revolver');
    L.gunLost = true;
  }
  // ---- one eased move: into the ring, facing him, my hand to the revolver
  // and away (the look stays mine within 0.3 rad)
  const P0 = C.eyePose();
  const me = { x: Math.max(11.2, Math.min(12.6, C.pos.x)), z: Math.max(-37.4, Math.min(-35.6, C.pos.z)) };
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
  if (!armed) { H.play('sn_coat'); G.sfx.play('pocket', null, {}, { send: false }); }
  L.coatAt = G.time;
  yield wait(armed ? 0.6 : 0.9);
  // (he saw it: the jacket over the barrel; he comes on)
  yield until(() => arrived || G.time - t0 > 11);
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
  // (inside the shed, by the hole: never out over the water; [R2-E round 2]
  // the look eased up from the water, not cut - setPose snapped it)
  C.pos.set(Math.min(14.2, P.x), 0, P.z);
  C.yaw = P.yaw; C.pitch = Math.max(-0.25, P.pitch);
  C.vel.set(0, 0, 0);
  C.setMode('sneak', { crouch: false, sfx: G.sfx, ease: 0.8 });
  L.stealth.dress();
  L.stealth.gunGone = true;
  L.won = true;
  if (L.fm) { L.fm.fig.object.visible = false; }
}

// (the scene leaving: the hands and their light back as they were)
export function leaveWarehouse() {
  if (HOOKED) { const C = HOOKED.controller; C.onFootfall = null; if (LIVE && LIVE.stepWrap && C.onStep === LIVE.stepWrap) C.onStep = LIVE.origOnStep; gunsOf(HOOKED).end(); }
  if (LIVE) { LIVE.crew.clear(); LIVE.stealth.undress(); for (const o of LIVE.props) if (o.parent) o.parent.remove(o); if (LIVE.fight) LIVE.fight.clear(); if (LIVE.fightOn && HOOKED && HOOKED.brawl.active) HOOKED.brawl.stop(); LIVE = null; }
  SNAP = null;
}
