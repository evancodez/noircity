import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { roomAs, carry, office, stand, V } from './office/room.js';
import { live, palmOn } from './office/hands.js';
import { PROP_KINDS } from '../props/index.js';
import { standInGun } from './office/gunHud.js';
import { MEN, send, coverFrom, glassMen, roomReacts, glassReward, fallHook, papers, note } from './office/fight.js';
import { DESK, DOOR, SIDE, SAFE, FAN, PICTURE } from '../stages/office/plan.js';

// Scene 5, The Door (lane B2's brief; STORY.md). The same room, a minute
// after the ledger went into my coat. Beats:
//   shadows  a board creaks in the corridor; a shadow on the door's frosted
//            glass, then one on the sidelight's; the music is gone; my hand
//            into my coat and out with the revolver. E tips the desk over
//            (the lamp falls and burns on from the floor; the desk is
//            cover); C ducks behind it
//   door     the door is kicked in: one man through it (behind the open
//            leaf, then out to shoot), one firing through the frosted
//            sidelight - shoot his outline and he comes through the glass -
//            and one in the doorway after them
//   window   up the fire escape: a Tommy gun at the side window (the
//            curtain shreds, the wall behind me is stitched); then two more
//            down the corridor, one of them a heavy. Six men in all
//   quiet    the last one down: smoke in the lamp's light, paper coming
//            down, the fan ticking round on a bent blade; three seconds,
//            then on (scene 6 opens in this room)
// Dying: the view goes down, black, and I am back at the shadows.
export default defineScene({
  id: 'gunfight', stage: 'office',
  beats: ['shadows', 'door', 'window', 'quiet'],
  save: ['shadows'],

  setup: {
    shadows(ctx) { fightRoom(ctx); },
    door(ctx) { fightRoom(ctx); ctx.flags.jump = 'door'; },
    window(ctx) { fightRoom(ctx); ctx.flags.jump = 'window'; },
    quiet(ctx) { fightRoom(ctx); ctx.flags.jump = 'quiet'; },
  },

  *script(ctx) {
    const { game: G, controller: C } = ctx;
    const O = office(ctx), F = ctx.flags;
    const D = G.director;
    const snd = (n, p = null, q = {}) => G.sfx.play(n, p, q);
    // (continuing straight from scene 4: the room as it stands)
    if (ctx.kept) { carry(ctx, { ledger: true }); keptRoom(ctx); }
    F.men = [];
    D.stop(); D.groups.clear();
    D.begin();
    // (an encounter on until the quiet: the HUD shows my health in a fight
    // only while the director has one running - with no script of its own
    // it stood down on its first step and the bar never showed. The lull
    // breaker it steps asks the men's brain to press, and the office brain
    // has no press: nothing else changes)
    // (it ends with the scene: a scene left any other way never leaves the
    // director running into the next one)
    D.run(function* () { while (G.scenes.ctx === ctx) yield null; });
    roomReacts(ctx);
    // (the plain revolver has no model yet: where it points, what is in it)
    standInGun(ctx);
    const shotFn = () => { F.shotAt = true; F.lastShotT = G.time; };
    const downFn = (e) => { const h = e && e.hood; void h; };
    void downFn;
    let lastK = G.counters.kills;
    ctx.onStep(() => { if (G.counters.kills !== lastK) { lastK = G.counters.kills; const dead = (F.men || []).filter((h) => !h.alive && !h._b2noted); for (const h of dead) { h._b2noted = true; note(ctx, 'down ' + h.b2); } } if (G.health.hp < (F.hpLow ?? 101) - 20) { F.hpLow = G.health.hp; note(ctx, 'hp ' + Math.round(G.health.hp)); } if (G.health.hp > (F.hpLow ?? 101) + 30) F.hpLow = G.health.hp; });
    G.on('shot', shotFn);
    const offs = [glassReward(ctx), fallHook(ctx, () => fall(ctx)), () => G.off('shot', shotFn)];
    const off = () => { for (const f of offs) f(); G.off('scene:exit', exitFn); };
    const exitFn = () => off();
    G.on('scene:exit', exitFn);
    // the corridor men's feet on the boards; the window man's on the iron
    const hs = ctx.stage.hoods, step0 = hs._b2step0 || (hs._b2step0 = hs.onStep);
    hs.onStep = (h, x, z, run) => {
      if (z > 7.1) snd('office_ironStep', V(x, h.pos.y + 0.1, z), { k: run ? 1 : 0.7 });
      else if (step0) step0(h, x, z, run);
      if (x < -0.2 && !F.creaked && z > -2) { F.creaked = true; snd('office_boardCreak', V(x, 0.1, z), { k: 1 }); }
    };
    ctx.onStep((dt) => {
      glassMen(ctx);
      // the fan's bent blade ticks once a turn
      const Fn = O.fan;
      if (Fn.bent) { Fn.tickA = (Fn.tickA || 0) + (Fn.rpm / 60) * dt; if (Fn.tickA >= 1) { Fn.tickA -= 1; snd('office_fanTick', V(FAN.x, 2.7, FAN.z), { k: 0.8 }); } }
      // the smoke hangs in the lamp's light (the room's own haze thickens with the shooting)
      F.t = (F.t || 0) + dt;
    });

    // ---- 1. the shadows ---------------------------------------------------------------
    // (a second go after a fall: nothing waited through twice - the door
    // already shut, both shapes already at its glass, the revolver out, the
    // desk over and me down behind it if I had tipped it; the door goes in
    // a breath after the black lifts)
    const retry = G._b2retry;
    G._b2retry = null;
    if (ctx.at('shadows') && !F.jump && retry) {
      yield beat('shadows');
      O.setDoor(0.035);
      if (retry.tipped) {
        O.tipDesk({ now: true });
        F.tipped = true; F.ducked = true;
        C.setPose(4.0, 3.7, 1.0, 0.0);
        C.setMode('office', { crouch: true });
      } else C.setMode('office', {});
      ctx.player.weapons.equip('revolver');
      live(ctx.hands, {});
      F.drawn = true;
      const k = send(ctx, 'kicker', { at: { x: -0.4, z: 1.02 }, path: [] });
      holdUntilKicked(ctx, k);
      const g = send(ctx, 'glass', { at: { x: -0.42, z: 2.52 }, path: [] });
      holdUntilKicked(ctx, g, 0.3);
      if (!retry.tipped) tipPrompt(ctx);
      yield wait(3.0);
    } else if (ctx.at('shadows') && !F.jump) {
      yield beat('shadows');
      ctx.music.stop(2.5);
      C.setMode('office', {});
      // the draft from the fire escape: the curtain lifts, the door swings to
      yield wait(0.4);
      O.gust = 1.4;
      if (O.door.angle > 0.2) { O.swingDoor(0.035, 0.9); snd('office_doorCreak', V(-0.07, 1.2, 1.0), { dur: 1.3, k: 0.6 }); }
      yield until(() => !O.door.moving);
      snd('office_doorBang', V(-0.07, 1.2, 1.0), { k: 0.25 });
      yield wait(0.5);
      snd('office_boardCreak', V(-1.1, 0.1, -2.2), { k: 0.9 });
      // the first shape comes up the corridor to the door's glass
      const kicker = send(ctx, 'kicker');
      holdUntilKicked(ctx, kicker);
      yield wait(0.7);
      // the hand into the coat and out with the revolver
      snd('office_draw', G.eye);
      ctx.player.weapons.equip('revolver');
      live(ctx.hands, {});
      F.drawn = true;
      yield wait(0.6);
      const glass = send(ctx, 'glass');
      holdUntilKicked(ctx, glass, 0.3);
      // one prompt: the desk (the player may ignore it)
      tipPrompt(ctx);
      // the door goes in when they are both at the glass, or when I go at it
      let t = 0;
      yield until(() => {
        t += 1 / 60;
        const atDoor = kicker.pos.distanceTo(V(-0.4, 0, 1.02)) < 0.45 && glass.pos.distanceTo(V(-0.42, 0, 2.52)) < 0.5;
        const nearDoor = G.eye.x < 1.2 && Math.abs(G.eye.z - (DOOR.z0 + DOOR.z1) / 2) < 1.1;
        return (atDoor && t > 5.5) || t > 11 || (atDoor && (nearDoor || F.shotAt));
      });
    }

    // ---- 2. the door --------------------------------------------------------------------
    if (ctx.at('door') && F.jump !== 'window' && F.jump !== 'quiet') {
      if (F.jump === 'door') jumpTo(ctx, 'door');
      yield beat('door');
      kick(ctx);
      yield wait(3.5);
      send(ctx, 'doorway');
      // the window when the door is down to one, or when it has gone on long enough
      let t = 0;
      yield until(() => { t += 1 / 60; return (alive(ctx, ['kicker', 'glass', 'doorway']) <= 1 && t > 7) || t > 20; });
    }

    // ---- 3. the window ----------------------------------------------------------------------
    if (ctx.at('window') && F.jump !== 'quiet') {
      if (F.jump === 'window') jumpTo(ctx, 'window');
      yield beat('window');
      const w = send(ctx, 'window', { onFire: (h) => curtainShot(ctx, h) });
      void w;
      // (the last two are on the stairs while he is still on the iron: a
      // crossfire if he lives long enough)
      let t = 0;
      yield until(() => { t += 1 / 60; return t > 4.5 || alive(ctx, ['window']) === 0; });
      // (the second at the sidelight if its glass is gone - the men do not all fall on one spot)
      const sideGone = O.side && O.side.pane && O.side.pane.state === 'gone';
      send(ctx, 'second', sideGone ? { path: [{ x: -1.55, z: -5.75 }, { x: -1.15, z: -4.6 }, { x: -1.3, z: -0.6 }, { x: -1.0, z: 1.95 }], hide: { x: -1.0, z: 1.95 }, fire: { x: -0.5, z: 2.4 } } : {});
      yield wait(1.5);
      send(ctx, 'heavy');
      yield until(() => alive(ctx) === 0);
    }

    // ---- 4. the quiet --------------------------------------------------------------------------
    if (ctx.at('quiet')) {
      if (F.jump === 'quiet') jumpTo(ctx, 'quiet');
      yield beat('quiet');
      D.stop();
      // (up from behind the desk to see it: the smoke in the light, the paper coming down)
      C.crouchOn = false;
      // smoke in the light, paper coming down
      const rng = ctx.stage.rng.fork(3071);
      papers(ctx, V(DESK.x - 0.6, 2.4, DESK.z), V(0, -1, 0), rng, 5);
      yield wait(3.2);
      ctx.next();
    }
  },

  auto(ctx, A) {
    if (A.prompting()) A.pressAfter('KeyE', 1.0, 2.0);
  },
});

// the room at the start of the fight (entered cold, or after a fall)
function fightRoom(ctx) {
  carry(ctx, { ledger: true });
  const O = roomAs(ctx, 'taken');
  O.setDoor(1.45);
  const a = ctx.stage.anchor('office.safe');
  stand(ctx, a.pos.x + 0.35, a.pos.z + 0.55, 0.35, -0.02);
  ctx.controller.setMode('office', {});
  ctx.player.weapons.equip(null);
  ctx.game.health.reset();
  void SAFE;
}
// straight on from scene 4 (the room as it stands; the eye where it was)
function keptRoom(ctx) {
  const C = ctx.controller;
  const P = C.eyePose();
  C.setPose(P.x, P.z, P.yaw, P.pitch);
  C.setMode('office', {});
  ctx.game.health.reset();
}

// a jump into a later beat (?scene=gunfight&beat=door): the men as they would stand
function jumpTo(ctx, b) {
  const G = ctx.game, O = office(ctx), F = ctx.flags;
  ctx.controller.setMode('office', {});
  ctx.player.weapons.equip('revolver');
  F.drawn = true;
  tipPrompt(ctx);
  if (b === 'door') {
    O.setDoor(0.035);
    const k = send(ctx, 'kicker', { at: { x: -0.4, z: 1.02 }, path: [] });
    holdUntilKicked(ctx, k);
    const g = send(ctx, 'glass', { at: { x: -0.42, z: 2.52 }, path: [] });
    holdUntilKicked(ctx, g, 0.9);
  }
  if (b === 'window') { O.kickDoor(); O.door.angle = 1.72; O.door.hinge.rotation.y = 1.72; O.doorCollider(); }
  void G;
}

// the kicker and the glass man wait at the glass until the door goes in
function holdUntilKicked(ctx, h, delay = 0) {
  const G = ctx.game, F = ctx.flags;
  const ai = G.ais.get(h);
  if (!ai) return;
  ai.hold = (state) => (state !== 'enter' && state !== 'settle' && (F.kicked == null || G.time - F.kicked < delay)) || !!F.down;
}

// E: the desk over on its front, the lamp thrown off it; then C to duck
function tipPrompt(ctx) {
  const G = ctx.game, O = office(ctx), F = ctx.flags;
  ctx.interact.add({ id: 'tip', at: V(DESK.x + 0.1, DESK.h + 0.1, DESK.z), range: 1.9, cone: 0.55, prompt: 'tip the desk', when: () => !O.desk.tip, onUse: () => {
    if (!O.tipDesk()) return;
    G.sfx.play('office_deskTip', V(DESK.x, 0.6, DESK.z));
    F.tipped = true;
    heave(ctx);
    ctx.interact.remove('tip');
    // (then, once: how to get behind it)
    F.duckT = 1.4;
  } });
  ctx.onStep((dt) => {
    if (F.duckT > 0) { F.duckT -= dt; if (F.duckT <= 0 && !F.ducked) { G.hud.prompt('C  duck', null, 'duck'); F.duckShown = G.time; } }
    if (F.duckShown && !F.ducked && (ctx.controller.crouchK > 0.5 || G.time - F.duckShown > 4)) { F.ducked = true; G.hud.clearPrompt('duck'); }
  });
}

// the heave: from the chair's side, both palms on the desk's near edge as it
// goes up and over, off it as it falls away (object first: the edge's path
// is the desk's; the palms ride it). While the revolver has no model its
// hands' set is hidden, so the bare hands are put up for the heave and the
// revolver's set given back after; with a model only the left hand heaves.
function heave(ctx) {
  const G = ctx.game, O = office(ctx), H = ctx.hands, e = G.eye;
  const d = O.desk;
  // (only from behind it, within an arm: anywhere else it goes over on its own)
  const edgeX = DESK.x + DESK.d / 2;
  if (e.x < edgeX - 0.05 || e.x - edgeX > 0.85 || Math.abs(e.z - DESK.z) > DESK.w / 2 + 0.2) return;
  const bare = !PROP_KINDS.includes('revolver');
  if (bare) H.equip('empty');
  // (the two grips on the near top edge, a shoulder's width apart, in the desk's own frame)
  const zc = Math.max(DESK.z - DESK.w / 2 + 0.3, Math.min(DESK.z + DESK.w / 2 - 0.3, e.z));
  d.pivot.updateMatrixWorld(true);
  const at = { R: d.pivot.worldToLocal(V(edgeX - 0.03, DESK.h + 0.005, zc - 0.22)), L: d.pivot.worldToLocal(V(edgeX - 0.03, DESK.h + 0.005, zc + 0.22)) };
  const sides = bare ? ['R', 'L'] : ['L'];
  const pin = () => {
    for (const s of sides) {
      const p = d.pivot.localToWorld(at[s].clone());
      // (palm down on the top, fingers over toward the far side; as it rises, into its underside)
      const n = V(0, -1, 0).transformDirection(d.pivot.matrixWorld);
      const f = V(-1, 0, s === 'R' ? 0.18 : -0.18).transformDirection(d.pivot.matrixWorld);
      palmOn(H, s, p, n, f);
    }
  };
  pin();
  live(H, bare ? { R: 'b2liveR', L: 'b2liveL' } : { L: 'b2liveL' });
  // (the view dips with the heave - the body bends to it - and comes back up:
  // the hands on the edge are in the frame, not under it)
  const C = ctx.controller;
  let dipped = 0;
  const dip = (want) => { const k = Math.max(-0.02, Math.min(0.02, want - dipped)); C.pitch += k; dipped += k; };
  let t = 0, off = -1;
  const stepFn = () => {
    t += 1 / 60;
    dip(off < 0 ? -0.26 * Math.min(1, t / 0.14) : 0);
    if (off < 0) {
      // (the first 15 degrees: after that the edge goes up and away out of reach)
      if (d.tipped < 0.17 && t < 0.5) { pin(); return; }
      // (let go: the hands drop away)
      off = t;
      live(H, {});
    } else if (bare && off > 0 && t - off > 0.26) {
      // (the revolver's set back once they are down out of the frame)
      off = 0;
      if (ctx.player.weapons.current === 'revolver' && H.set === 'empty') H.equip('revolver');
    }
  };
  ctx.onStep(stepFn);
}

// the door kicked in: the heel, the bang, its glass, the kicker through it
function kick(ctx) {
  const G = ctx.game, O = office(ctx), F = ctx.flags;
  F.kicked = G.time;
  G.sfx.play('office_doorKick', V(-0.1, 1.0, 1.2));
  O.kickDoor();
  G.controller.shake(0.45, Math.hypot(G.eye.x, G.eye.z - 1));
  const p = O.door.pane;
  if (p.state !== 'gone') ctx.stage.glass.shatter(p, { dir: V(1, 0, 0.2), power: 1.6, by: 'body' });
  // splinters off the jamb where the lock was
  const r = ctx.stage.rng.fork(3063);
  for (let k = 0; k < 14; k++) G.fx.debris.spawn({ pos: V(-0.04, 1.0 + r.gauss() * 0.1, DOOR.z1 - 0.02), vel: V(r.range(0.8, 2.6), r.range(0, 1.6), r.gauss() * 0.8), life: r.range(0.6, 1.2), size: [0.02, 0.006], rot: r.next() * 6, spin: r.gauss() * 12, col: [0.12, 0.12, 0.12], cell: 12, gravity: 9.8, ground: 0.01, fadeOut: 0.2 });
  // the kicker: in through the door and behind its open leaf, out from it to shoot
  const k = (F.men || []).find((h) => h.b2 === 'kicker');
  const ai = k && G.ais.get(k);
  // (he comes in two steps and stands his ground: the first of them, in the open)
  if (ai && ai.brain.send) ai.brain.send({ path: [{ x: 0.35, z: 1.02 }, { x: 0.95, z: 1.45 }], hide: null, fire: { x: 0.95, z: 1.45 }, wait: 0.35 });
}

// the Tommy gun through the curtain: holes where his rounds pass through it
function curtainShot(ctx, h) {
  const G = ctx.game, O = office(ctx), F = ctx.flags;
  // (the muzzle: his hands' height, a step toward me - the bones' own muzzle can lag a frame)
  const e = G.eye;
  const m = h.pos.clone(); m.y += 1.3;
  { const dx = e.x - m.x, dz = e.z - m.z, L = Math.hypot(dx, dz) || 1; m.x += dx / L * 0.45; m.z += dz / L * 0.45; }
  O.curtain.flash(m);
  const zc = O.curtain.mesh.position.z;
  if ((m.z - zc) * (e.z - zc) >= 0) return;
  const t = (zc - m.z) / (e.z - m.z);
  const r = F.cr || (F.cr = ctx.stage.rng.fork(3067));
  const p = V(m.x + (e.x - m.x) * t + r.gauss() * 0.12, m.y + (e.y - m.y) * t + r.gauss() * 0.15, zc);
  O.curtain.tear(p, r);
}

// the living men (of the named ones, or all)
function alive(ctx, names = null) {
  let n = 0;
  for (const h of ctx.flags.men || []) if (h.alive && (!names || names.includes(h.b2))) n++;
  return n;
}

// the fall: the view goes down, black, back at the shadows (ten seconds at most)
function fall(ctx) {
  const G = ctx.game, C = ctx.controller, F = ctx.flags;
  if (F.down) return;
  F.down = true;
  // (each fall's record kept on the game for the headless plays: the log, the cover per shot)
  (G._b2falls || (G._b2falls = [])).push(`${F.log || ''}| ks ${(F.ks || []).join(' ')}`);
  // (the next go starts where this one was fought from)
  G._b2retry = { tipped: !!office(ctx).desk.tip };
  const from = C.eyePose();
  C.setMode('cutscene', { track: (t) => {
    const u = Math.min(1, t / 0.9), e = u * u;
    return { x: from.x, y: from.y + (0.35 - from.y) * e, z: from.z, yaw: from.yaw + 0.3 * e, pitch: from.pitch + (0.5 - from.pitch) * e };
  } });
  G.sfx.play('grunt', null, { f0: 80, k: 0.5, dur: 0.3 }, { send: false });
  G.sfx.play('f_bodyFloor', G.eye);
  ctx.hud.clearPrompt();
  // (after a second on the floor: black, the room set again, up at the shadows)
  let t = 0;
  ctx.onStep((dt) => {
    t += dt;
    if (t > 1.1 && !F.goneBlack) {
      F.goneBlack = true;
      G.health.reset();
      G.scenes.go('gunfight', { beat: 'shadows', fade: 'black', card: false, fadeIn: 0.8 });
    }
  });
}
void THREE; void SIDE; void PICTURE; void MEN; void coverFrom;
