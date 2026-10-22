import * as THREE from 'three';
import { DINER, SITE } from './site.js';
import { Stealth } from '../warehouse/stealth.js';
import { mackWindow } from './room.js';
import { knockOut, rig } from './rig.js';
import { allocInkId as allocId } from '../../render/layers.js';

// VIII, the nick of time (lane C8; docs/story/briefs/C8_BLOCK.md §2). I come
// on foot the last metres, unarmed. Through the plate glass: the room lit,
// the stools empty, Sal with his gun on Dot behind the counter at the back
// bar; Nicky out on the pavement under the awning by the door, smoking,
// watching the street. More than one way in, each with what the game has
// taught:
//   the door      the bell: Sal turns. A second and a half to be on him at
//                 the counter - a blow knocks the gun hand (LMB). Nicky must
//                 not be by the door when it rings: E from behind (the pier's
//                 takedown), or drawn off with a bottle
//   a bottle      from the crate of empties at the kerb (E), thrown (hold
//                 LMB: the arc): where it breaks, Nicky goes to look and
//                 Sal's head turns; the bell is half lost under it
//   the window    Mack's window, out since the fight: over the sill (SPACE),
//                 low (C) round the end of the counter, behind him, E
// The rules, each read from the picture: Nicky sees the road and the
// pavement before him, never the strip along the wall at his back; Sal has
// his back to the room. Each hears a man running, and a man walking close
// (3 m); a man down low (C) goes unheard. The warning is in the room: Sal's
// lines run on a clock, and he cocks the gun ("Last time, sister."): too
// slow, the shot - Too late. Seen, or caught coming at him: the same.
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = V(0, 0, 0), _w = V(0, 0, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const NICK = {
  // ([C8] after the critic: from 15 m off the first frame showed nothing of
  // it. Now the kerb by the crate of empties: through Mack's broken window
  // the lit room, Sal's gun on Dot at the back bar; Nicky under the awning
  // beyond, looking out at the road - not at me, not yet)
  start: { x: -7.0, z: -6.6, yaw: 2.25 },
  sal: { x: -15.3, z: 0.3 },
  dot: { x: -16.45, z: 1.45 },
  nicky: { x: -9.2, z: 2.05, yaw: Math.PI / 2 },
  // the crate of empties against the wall by the bins, south of Mack's window
  crate: { x: -9.78, z: -7.15 },
  clock: { lines: [[5, 'Where is it, sister?'], [14, 'Nobody’s coming for you.'], [25, 'I’m done asking.']], cock: 36, shot: 43.5 },
  // Sal's turn on me: from the bell (or hearing me) to his round
  turn: 2.0, turnSlow: 3.2,
  // the reach of a blow over the counter (m, from my eye to his chest, flat)
  reach: 1.75,
};

// ---- the people ---------------------------------------------------------------------------------
export function placeNick(ctx) {
  const G = ctx.game, S = ctx.stage;
  const sal = G.spawnHood(NICK.sal.x, NICK.sal.z, { ai: false, variant: { coat: 1, brim: 1, tall: 1, cig: false }, yaw: Math.atan2(NICK.dot.x - NICK.sal.x, NICK.dot.z - NICK.sal.z), state: 'aim' });
  sal.surface = (x, z) => S.surfaceY(x, z);
  sal.setAim(true, 0);
  sal.c8name = 'sal';
  const nicky = G.spawnHood(NICK.nicky.x, NICK.nicky.z, { ai: false, variant: { coat: 0, brim: 0, tall: 0, cig: true }, yaw: NICK.nicky.yaw, state: 'idle' });
  nicky.surface = (x, z) => S.surfaceY(x, z);
  nicky.c8name = 'nicky';
  if (nicky.addCigarette) try { nicky.addCigarette(); } catch { /* (a figure without one) */ }
  return { sal, nicky };
}

// ---- the crate of empties against the wall by the bins (the diner's: the
// bottles go out the back door to it), six necks standing up out of it -----
export function makeCrate(ctx) {
  const S = ctx.stage, G = ctx.game;
  const g = new THREE.Group();
  g.name = 'c8.crate';
  const wood = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.88 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.15, metalness: 0.2 });
  const W = 0.62, D = 0.42, Hh = 0.3, t = 0.02;
  const parts = [];
  for (const [w, h, d, x, y, z] of [[W, 0.025, D, 0, 0.012, 0], [W, Hh, t, 0, Hh / 2, D / 2 - t / 2], [W, Hh, t, 0, Hh / 2, -D / 2 + t / 2], [t, Hh, D, W / 2 - t / 2, Hh / 2, 0], [t, Hh, D, -W / 2 + t / 2, Hh / 2, 0], [t, Hh * 0.8, D - 2 * t, 0, Hh * 0.4, 0]]) parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const box = new THREE.Mesh(mergeGeo(parts), wood);
  box.castShadow = true; box.receiveShadow = true;
  g.add(box);
  const necks = [];
  const bottle = new THREE.CylinderGeometry(0.032, 0.034, 0.2, 10).translate(0, 0.1, 0);
  const neck = new THREE.CylinderGeometry(0.012, 0.02, 0.08, 8).translate(0, 0.24, 0);
  const geo = mergeGeo([bottle, neck]);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(geo, glass);
    m.position.set(-0.2 + (i % 3) * 0.2, 0.06, i < 3 ? -0.09 : 0.09);
    m.rotation.z = (i % 2 ? 0.06 : -0.05);
    m.castShadow = true;
    g.add(m); necks.push(m);
  }
  const id = allocId();
  g.traverse((m) => { if (m.isMesh) { m.userData.inkId = id; m.userData.noRay = true; } });
  g.position.set(NICK.crate.x, S.surfaceY(NICK.crate.x, NICK.crate.z), NICK.crate.z);
  g.rotation.y = 0.12;
  S.scene.add(g);
  const col = S.colliders.addBox(NICK.crate.x, NICK.crate.z, W / 2 + 0.02, D / 2 + 0.02, -0.12, 'crate');
  void G;
  return { g, necks, col, remove() { S.scene.remove(g); const i = S.colliders.boxes.indexOf(col); if (i >= 0) S.colliders.boxes.splice(i, 1); } };
}
function mergeGeo(list) {
  let n = 0;
  for (const q of list) n += q.index ? q.index.count : q.attributes.position.count;
  const pos = [], nor = [];
  for (const q of list) {
    const g = q.index ? q.toNonIndexed() : q;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  void n;
  return out;
}

// ---- my hands in this beat: the pier's sneak (C low, the bottle's arc) -------------------------
class BlockHands extends Stealth {
  floorAt(x, z) { return this.G.stage.surfaceY(x, z); }
}

// the beat, as a generator (the scene's: yield* nick(ctx, N))
export function* nick(ctx, N) {
  const G = ctx.game, S = ctx.stage, C = ctx.controller, H = G.player.hands, hud = ctx.hud;
  const front = S.part('dinerFront'), door = front.door;
  const { sal, nicky } = N;
  const dot = ctx.cast.get('dot');
  const st = { t: 0, salMode: 'threat', salT: 0, salFace: sal.yaw, nickyMode: 'watch', notice: 0, heard: null, lookAt: null, said: 0, cocked: false,
    done: false, how: null, failing: false, bottleAt: null, distractT: 0, nickyGo: null };
  N.st = st;
  // the pier's hands and ears, on the block
  const P = { eye: V(0, 0, 0), head: V(0, 0, 0), chest: V(0, 0, 0), feet: V(0, 0, 0), crouch: false, exposure: 0, speed: 0, lampLit: 0 };
  const crew = {
    player: P, men: [],
    sendNearest: (at) => smashed(at),
    struck: () => {},
  };
  const hands = N.hands = new BlockHands(ctx, crew);
  hands.dress();
  hands.coatT = 1e12;          // (no revolver to reach for: it is in the river)
  // footfalls: who hears them
  C.onFootfall = (x, z, { run, crouch }) => {
    if (crouch || st.done) return;
    const near = (h, r) => h.alive && !h.c8down && Math.hypot(h.pos.x - x, h.pos.z - z) < r;
    if (near(nicky, run ? 8 : 2.6)) heardBy('nicky', V(x, 0, z));
    // (Sal hears the room only: the glass and the rain are between him and the street)
    if (x < DINER.innerX && near(sal, run ? 8 : 3.0)) heardBy('sal', V(x, 0, z));
  };
  N.cleanup = () => { C.onFootfall = null; hands.undress(); ctx.interact.remove('c8.crate'); ctx.interact.remove('c8.sill'); ctx.interact.remove('c8.ko.sal'); ctx.interact.remove('c8.ko.nicky'); };

  // ---- E: the bottle from the crate, the takedowns, over the sill ----------------------
  const RR = rig();
  const crate = RR.crate || (RR.crate = makeCrate(ctx));
  for (const q of crate.necks) q.visible = true;
  const bottleProp = () => {
    const d = S.part('diner');
    const left = crate.necks.find((q) => q.visible);
    if (left) left.visible = false;
    const name = 'c8.bottle.' + (N.bottleN = (N.bottleN || 0) + 1);
    return d.place('bottle', V(NICK.crate.x, 0.7, NICK.crate.z), { name, variant: 'beer' });
  };
  ctx.interact.add({ id: 'c8.crate', at: V(NICK.crate.x, 0.62, NICK.crate.z), range: 2.4, cone: 0.85, prompt: 'take a bottle',
    when: () => !hands.bottle && !H.busy && !st.done && crate.necks.some((q) => q.visible), onUse: () => hands.take(bottleProp()) });
  const canKo = (h, look) => {
    if (!h.alive || h.c8down || H.busy || st.done) return false;
    const dx = G.eye.x - h.pos.x, dz = G.eye.z - h.pos.z, d = Math.hypot(dx, dz);
    if (d > 1.75) return false;
    const ang = Math.atan2(dx, dz);
    return Math.abs(wrap(ang - h.yaw)) > 1.9 && Math.abs(wrap(ang - look)) > 1.7;
  };
  for (const [id, h] of [['sal', sal], ['nicky', nicky]]) {
    ctx.interact.add({ id: 'c8.ko.' + id, at: () => h.pos.clone().setY(h.pos.y + 1.25), range: 1.85, cone: 0.6, prompt: 'put him down',
      when: () => canKo(h, id === 'sal' ? st.salFace : h.yaw) && (id !== 'sal' || st.salMode !== 'aimMe'), onUse: () => takeDown(h, id) });
  }
  // (the card for it, the first time a man can be put down: the pier's)
  // over the sill of Mack's window (SPACE), from the pavement into the room
  // [C10b] the window way is always B4's (09_shootout.js breaks it when Mack went out by B2)
  const w = 'B4', bayZ = DINER.bays[w], half = DINER.window.w / 2 - 0.3;
  const sillZ = () => Math.max(bayZ - half, Math.min(bayZ + half, G.eye.z));
  let climbing = null;
  ctx.interact.add({ id: 'c8.sill', key: 'Space', at: () => V(DINER.faceX + 0.05, DINER.window.sill + 0.45, sillZ()), range: 1.9, cone: 0.9, prompt: 'climb in',
    when: () => !climbing && !st.done && G.eye.x > DINER.faceX && front.panes[w] && front.panes[w].broken && !H.busy,
    onUse: () => {
      const P0 = C.eyePose(), z = sillZ();
      const crouched = C.sneak && C.sneak.crouch;
      const tx = DINER.innerX - 0.75, ty = DINER.floorY + (crouched ? 1.0 : 1.63);
      climbing = { t: 0 };
      G.sfx.play('clothRustle', null, {}, { send: false });
      C.setMode('cutscene', { track: (t) => {
        const u = Math.min(1, t / 1.0), e = u * u * (3 - 2 * u);
        return { x: P0.x + (tx - P0.x) * e, y: P0.y + (ty - P0.y) * e + 0.32 * Math.sin(Math.PI * Math.min(1, u * 1.15)), z: P0.z + (z - P0.z) * e, yaw: P0.yaw + wrap(-Math.PI / 2 - P0.yaw) * Math.min(1, u * 1.4), pitch: -0.3 * Math.sin(Math.PI * u) };
      } });
      // (the glass on the sill crunches: within 2.5 m of him, Nicky hears it)
      if (nicky.alive && !nicky.c8down && Math.hypot(nicky.pos.x - DINER.faceX, nicky.pos.z - z) < 2.5) heardBy('nicky', V(DINER.faceX, 0, z));
      climbing.done = () => {
        C.setMode('sneak', { crouch: !!crouched, sfx: G.sfx, pose: { x: tx, y: ty, z, yaw: -Math.PI / 2, pitch: -0.05 } });
        if (!C.sneak) C.setMode('sneak', { crouch: !!crouched, sfx: G.sfx });
        C.setPose(tx, z, Math.PI / 2, -0.05);
        if (crouched && C.sneak) C.sneak.crouch = true;
        G.sfx.play('f_bodyFloor', null, { k: 0.3 });
        climbing = null;
      };
    } });

  // a blow (LMB, no bottle in my hand): the gun hand knocked aside, he folds
  const blowAt = () => {
    if (H.busy || hands.bottle || hands.aiming) return;
    const h = sal;
    const dx = h.pos.x - G.eye.x, dz = h.pos.z - G.eye.z, d = Math.hypot(dx, dz);
    const look = V(0, 0, -1).applyQuaternion(G.camera.quaternion);
    const facing = (look.x * dx + look.z * dz) / (Math.hypot(look.x, look.z) * d || 1);
    const hit = h.alive && !h.c8down && d < NICK.reach && facing > 0.72;
    G.counters.c8blows = (G.counters.c8blows || 0) + 1;
    H.play('sn_blow', { onMark: { hit: () => {
      if (!hit || !h.alive || h.c8down || st.failing) { G.sfx.play('clothRustle', null, { k: 0.5 }, { send: false }); return; }
      // (the gun goes out of his hand onto the back bar's floor; he goes over)
      G.sfx.play('blow', h.pos.clone().setY(1.4), {}, { ref: 2 });
      G.sfx.play('b7_gunDown', h.pos.clone().setY(0.4), {}, { ref: 2, delay: 0.25 });
      knock(h, V(dx, 0, dz).normalize());
      win('blow');
    } } });
  };

  // ---- what they hear and see ---------------------------------------------------------------
  function heardBy(who, at) {
    if (st.done || st.failing) return;
    if (who === 'nicky' && st.nickyMode === 'watch') { st.nickyMode = 'turn'; st.nickyTurn = at.clone(); st.nickyT = 0; }
    if (who === 'sal' && (st.salMode === 'threat' || st.salMode === 'distracted')) alertSal(at, st.salMode === 'distracted' ? NICK.turnSlow : NICK.turn, 'heard');
  }
  function alertSal(at, T, why) {
    if (st.salMode === 'alert' || st.salMode === 'aimMe' || !sal.alive || sal.c8down) return;
    st.salMode = 'alert'; st.salT = 0; st.salDue = T; st.salAt = at.clone(); st.alertWhy = why;
    G.counters.c8alerts = (G.counters.c8alerts || 0) + 1;
  }
  // a bottle broke somewhere: they look
  function smashed(at) {
    if (st.done) return;
    st.bottleAt = at.clone(); st.distractT = 0;
    // (a bottle that meets the plate glass breaks it: the crash is the glass's)
    if (!N.inSmash && Math.abs(at.x - DINER.faceX) < 0.6) {
      for (const p of Object.values(front.panes)) {
        if (p.broken || p.state === 'gone' || !p.centre) continue;
        const c = p.centre.clone();
        if (p.parent) p.parent.localToWorld(c);
        if (Math.abs(at.z - c.z) < (p.w || 1) / 2 + 0.05 && Math.abs(at.y - c.y) < (p.h || 1) / 2 + 0.05) {
          N.inSmash = true;
          try { S.glass.shatter(p, { dir: V(-1, 0, 0), power: 0.9, at: at.clone() }); } finally { N.inSmash = false; }
          break;
        }
      }
    }
    // Nicky goes to look where it broke (within 20 m): along the pavement, never into the road past the kerb
    if (nicky.alive && !nicky.c8down && st.nickyMode !== 'caught' && Math.hypot(at.x - nicky.pos.x, at.z - nicky.pos.z) < 20) {
      const gx = Math.max(-9.6, Math.min(-6.6, at.x)), gz = at.z;
      st.nickyMode = 'look'; st.nickyGo = { x: gx, z: gz }; st.nickyT = 0;
    }
    // Sal: a crash of glass he can hear (the room, the windows, or near the front)
    const near = at.x < DINER.faceX + 6 && Math.abs(at.z - 2) < 14;
    if (sal.alive && !sal.c8down && near && st.salMode === 'threat') { st.salMode = 'distracted'; st.salT = 0; st.salLook = Math.atan2(at.x - sal.pos.x, at.z - sal.pos.z); }
  }
  // a bottle into a pane of the front breaks it (the glass's own crash: they hear that too)
  const onGlass = ({ pane }) => {
    if (st.done || !pane || !Object.values(front.panes).includes(pane)) return;
    const c = pane.centre ? pane.centre.clone() : V(DINER.faceX, 1.6, 2);
    if (pane.parent && pane.centre) pane.parent.localToWorld(c);
    smashed(c.setX(DINER.faceX));
  };
  G.on('glass:shatter', onGlass);
  // the door's bell (the door's listeners cannot be taken off: one of ours,
  // pointed at the beat that is running)
  const onOpen = () => {
    if (st.done) return;
    // (Nicky, at the door, hears it: he turns)
    if (nicky.alive && !nicky.c8down && Math.hypot(nicky.pos.x - DINER.faceX, nicky.pos.z - 0.6) < 4) heardBy('nicky', V(DINER.faceX, 0, 0.6));
    if (sal.alive && !sal.c8down) alertSal(V(DINER.innerX, 0, 0.6), st.salMode === 'distracted' ? NICK.turnSlow : NICK.turn, 'bell');
  };
  if (!door._c8on) { door._c8on = true; door.on('open', () => { if (door._c8) door._c8(); }); }
  door._c8 = onOpen;
  const cleanup0 = N.cleanup;
  N.cleanup = () => { cleanup0(); G.off('glass:shatter', onGlass); if (door._c8 === onOpen) door._c8 = null; };

  function takeDown(h, who) {
    const look0 = C.eyePose();
    C.frozen = true;
    H.play('sn_blow', { onMark: {
      hit: () => { knock(h, V(h.pos.x - G.eye.x, 0, h.pos.z - G.eye.z).normalize()); G.sfx.play('blow', h.pos.clone().setY(1.4), {}, { ref: 2 }); G.sfx.play('gasp', h.pos.clone().setY(1.5), {}, { ref: 2 }); G.sfx.play('fold', h.pos.clone(), {}, { ref: 2, delay: 0.2 }); },
      lowered: () => { C.frozen = false; },
    } });
    void look0;
    G.counters.takedowns = (G.counters.takedowns || 0) + 1;
    if (who === 'sal') win('behind');
  }
  // down and out (not a round fired: the fold, quiet)
  function knock(h, dir) {
    if (h.c8down) return;
    h.c8down = true;
    h.setAim(false);
    h.lookAt(null);
    // (he folds away from the blow)
    h.yaw = Math.atan2(-dir.x, -dir.z);
    knockOut(G, h, 'deathKnees');
  }
  function win(how) {
    if (st.done) return;
    st.done = true; st.how = how;
    hud.warn(null);
    G.counters.c8how = how;
  }
  // Sal's shot, at Dot or at me: the end of it
  function shot(at, why, fall) {
    if (st.failing || st.done) return;
    st.failing = true;
    const m = sal.fire();
    if (m) {
      const dir = at.clone().sub(m).normalize();
      G.fx.flash.hood(sal, m, dir, G.time, false);
      G.sfx.pistol(m, m.distanceTo(G.eye));
    }
    if (!fall && dot) dot.setState('duck', 0.1);
    G.fail({ why, to: 'dot', fall });
  }

  // ---- the beat --------------------------------------------------------------------------------
  // (the first second: how it stands - read from the glass)
  hud.teach('crouch', '[C] get low');
  let koTaught = false;
  while (!st.done) {
    const dt = 1 / 60;
    st.t += dt;
    if (climbing) { climbing.t += dt; if (climbing.t >= 1.0 && climbing.done) climbing.done(); }
    if (G.pressed('Mouse0') && !hands.bottle && !climbing && !C.frozen) blowAt();
    if (!koTaught && G.interact.current && /^c8\.ko\./.test(G.interact.current.id || '')) { koTaught = true; hud.teach('takedown', '[E] from behind: put him down', { until: 'KeyE', secs: 4 }); }
    // pier's hands: crouch, the bottle's arc and throw
    hands.step(dt);
    stepNicky(dt);
    stepSal(dt);
    // the one warning for this moment, most urgent first (the kit's: it is
    // up a second before any fall)
    if (!st.failing && !st.done) {
      const salOn = st.salMode === 'alert' || st.salMode === 'aimMe';
      hud.warn(st.nickyMode === 'caught' ? 'He’s seen you!'
        : salOn ? (st.alertWhy === 'bell' ? 'The bell. He’s turning!' : st.alertWhy === 'seen' ? 'He’s seen you. Hit him!' : 'He heard you. Hit him!')
          : st.notice > 0.12 ? 'The man at the door. Out of his sight!'
            : st.cocked ? 'He’s going to shoot her!' : null);
    }
    if (st.failing) { yield null; continue; }
    yield null;
  }
  // (the room is mine: the hands as they were, Nicky gone if he is up)
  N.cleanup();
  return st.how;

  // ---- Nicky ----------------------------------------------------------------------------------------
  function stepNicky(dt) {
    const h = nicky;
    if (!h.alive || h.c8down || st.failing) return;
    st.nickyT = (st.nickyT || 0) + dt;
    // what he looks at
    let face = NICK.nicky.yaw;
    if (st.nickyMode === 'turn' && st.nickyTurn) face = Math.atan2(st.nickyTurn.x - h.pos.x, st.nickyTurn.z - h.pos.z);
    if (st.nickyMode === 'look' && st.nickyGo) {
      const g = st.nickyGo, d = Math.hypot(g.x - h.pos.x, g.z - h.pos.z);
      face = Math.atan2(g.x - h.pos.x, g.z - h.pos.z);
      if (d > 0.6 && st.nickyT < 9) { if (h.state !== 'walk') h.setState('walk', 0.25); h.speed = 1.5; }
      else { h.speed = 0; if (h.state !== 'idle') h.setState('idle', 0.3); face = Math.atan2(st.bottleAt.x - h.pos.x, st.bottleAt.z - h.pos.z); if (st.nickyT > 9) { st.nickyMode = 'back'; st.nickyT = 0; } }
    }
    if (st.nickyMode === 'back') {
      const g = NICK.nicky, d = Math.hypot(g.x - h.pos.x, g.z - h.pos.z);
      face = Math.atan2(g.x - h.pos.x, g.z - h.pos.z);
      if (d > 0.3) { if (h.state !== 'walk') h.setState('walk', 0.25); h.speed = 1.3; } else { h.speed = 0; h.setState('idle', 0.3); st.nickyMode = 'watch'; }
    }
    h.yaw += wrap(face - h.yaw) * Math.min(1, dt * (st.nickyMode === 'turn' ? 5 : 3));
    if (h.speed > 0) { h.pos.x += Math.sin(h.yaw) * h.speed * dt; h.pos.z += Math.cos(h.yaw) * h.speed * dt; }
    // he sees: before him (70 deg either side), a clear line, within 16 m (a man low, 8 m)
    const low = !!(C.sneak && C.sneak.crouch);
    const ex = G.eye.x - h.pos.x, ez = G.eye.z - h.pos.z, d = Math.hypot(ex, ez);
    const off = Math.abs(wrap(Math.atan2(ex, ez) - h.yaw));
    let sees = d < (low ? 8 : 16) && off < 1.22;
    if (sees) { _v.set(h.pos.x, h.pos.y + 1.6, h.pos.z); sees = G.gunsSee ? G.gunsSee(_v, G.eye) : !G.rays.raycast(_v, _w.subVectors(G.eye, _v).normalize(), Math.max(0.1, _v.distanceTo(G.eye) - 0.3), { anyHit: true, skip: (e) => !!e.mesh.userData.pane }); }
    const rate = sees ? (low ? 0.9 : 2.2) * (d < 4 ? 2 : 1) : -0.6;
    st.notice = Math.max(0, Math.min(1.2, st.notice + rate * dt));
    if (st.notice >= 1 && st.nickyMode !== 'caught') {
      st.nickyMode = 'caught'; st.caughtT = 0;
      h.setAim(true); h.lookAt(G.eye.clone());
      hud.say('Hey! Sal!', 1.6);
    }
    if (st.nickyMode === 'caught') {
      h.lookAt(G.eye.clone());
      st.caughtT += dt;
      if (st.caughtT > 1.25) shot(V(NICK.dot.x, 1.3, NICK.dot.z), 'They saw you. Too late.', false);
    }
    // (turned to a sound and nothing there: back to the street)
    if (st.nickyMode === 'turn' && st.nickyT > 2.2 && !sees) st.nickyMode = 'watch';
  }

  // ---- Sal -------------------------------------------------------------------------------------------
  function stepSal(dt) {
    const h = sal;
    if (!h.alive || h.c8down || st.failing) return;
    st.salT += dt;
    // his lines, on the clock
    const Cl = NICK.clock;
    while (st.said < Cl.lines.length && st.t >= Cl.lines[st.said][0]) { hud.say(Cl.lines[st.said][1], 2.6); st.said++; }
    if (!st.cocked && st.t >= Cl.cock) {
      st.cocked = true;
      G.sfx.play('revCock', h.pos.clone().setY(1.4), {}, { ref: 3 });
      hud.say('Last time, sister.', 2.6);
    }
    if (st.t >= Cl.shot && st.salMode !== 'alert' && st.salMode !== 'aimMe') { shot(V(NICK.dot.x, 1.3, NICK.dot.z), 'Too late.', false); return; }
    let face = Math.atan2(NICK.dot.x - h.pos.x, NICK.dot.z - h.pos.z);
    if (st.salMode === 'threat') h.lookAt(V(NICK.dot.x, 1.35, NICK.dot.z));
    if (st.salMode === 'distracted') {
      face = st.salLook;
      h.lookAt(V(h.pos.x + Math.sin(face) * 5, 1.4, h.pos.z + Math.cos(face) * 5));
      // (he sees me if I am before him now)
      if (seesMe(h, face, 1.0, 14)) alertSal(G.eye.clone(), NICK.turn, 'seen');
      if (st.salT > 6) { st.salMode = 'threat'; st.salT = 0; }
    }
    if (st.salMode === 'alert' || st.salMode === 'aimMe') {
      face = Math.atan2(G.eye.x - h.pos.x, G.eye.z - h.pos.z);
      h.lookAt(G.eye.clone().setY(G.eye.y - 0.3));
      if (st.salT > 0.45) st.salMode = 'aimMe';
      if (st.salT >= st.salDue) { shot(G.eye.clone(), st.alertWhy === 'bell' ? 'Too slow.' : 'He heard you coming.', true); return; }
    }
    h.yaw += wrap(face - h.yaw) * Math.min(1, dt * (st.salMode === 'alert' || st.salMode === 'aimMe' ? 7 : 3));
    st.salFace = h.yaw;
  }
  function seesMe(h, face, cone, far) {
    const ex = G.eye.x - h.pos.x, ez = G.eye.z - h.pos.z, d = Math.hypot(ex, ez);
    if (d > far || Math.abs(wrap(Math.atan2(ex, ez) - face)) > cone) return false;
    _v.set(h.pos.x, h.pos.y + 1.6, h.pos.z);
    return !G.rays.raycast(_v, _w.subVectors(G.eye, _v).normalize(), Math.max(0.1, _v.distanceTo(G.eye) - 0.3), { anyHit: true, skip: (e) => !!e.mesh.userData.pane });
  }
}

export { SITE };
