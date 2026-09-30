import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { CAST_CLIPS } from '../../cast/clips.js';
import { buildProp } from '../../props/index.js';
import { Autoplay } from '../../game/Autoplay.js';

// Round 2, the fight's owner: presets to judge the motion by.
//   r2clip&clip=<name>&t=<s>        him alone in the diner, the clip started at
//                                   t = 0 (after a second's warm-up), so t is
//                                   the time into it
//     &at=aisle|B2|B4               where: the aisle (facing up it), or a finish
//                                   spot, his back to the glass (default aisle;
//                                   br_ko_window: B4)
//     &cam=eye|side|out|high        from my eye (1.45 m before him, 1.80 up),
//                                   from his right side, from the pavement
//                                   outside the window, from high in a corner
//     &round=3                      blood, the cap loose
//     &neck=1                       the bottle's broken neck in his right fist
//   r2room&cam=<n>                  the room as the fight has it (the booths,
//                                   B2's café tables, the finish spots)
const Q = () => new URLSearchParams(location.search);
const F = DINER.floorY;

function spot(at) {
  if (at === 'B2' || at === 'B4') return { x: DINER.finish[at].x, z: DINER.finish[at].z, yaw: -Math.PI / 2 };
  return { x: DINER.ring.x, z: DINER.ring.z - 0.72, yaw: 0 };
}

// the eye: a pose { x, z, yaw, pitch, y (eye height) } looking at p from
// `dist` along the heading `a` (a figure's: (sin a, cos a))
function lookFrom(p, a, dist, eyeY, tgtY) {
  const x = p.x + Math.sin(a) * dist, z = p.z + Math.cos(a) * dist;
  return { x, z, yaw: Math.atan2(-(p.x - x), -(p.z - z)), pitch: Math.atan2(tgtY - eyeY, dist), y: eyeY };
}

function stageClip(stage, camera, controller, game) {
  const q = Q();
  const name = q.get('clip') || 'br_guard';
  if (!CAST_CLIPS[name]) throw new Error(`r2clip: no clip '${name}'`);
  const at = q.get('at') || (name === 'br_ko_window' ? 'B4' : 'aisle');
  const S = spot(at);
  // (the booths' couple and the stools as the fight has them: the room empty)
  const d = stage.part('diner');
  if (d && d.reset) d.reset();
  for (const p of Object.values(stage.part('dinerFront').panes)) stage.glass.restore(p);
  const c = stage.cast.spawn('brawler', { at: { x: S.x, z: S.z }, yaw: S.yaw });
  if (q.get('round') === '3') { c.bleed(1); c.capLoose = true; }
  if (q.get('neck') === '1') { const b = buildProp('bottle', { variant: 'beer' }); c.hold(b, 'R', { grip: 'hang' }); b.scale.y *= 0.62; }
  const base = /^br_(reel|sway|comeRound|ko_window)/.test(name) ? 'br_reel' : 'br_guard';
  c.setState(base, 0);
  game.warmup = 1;
  game.afterWarmup = () => {
    if (name === base) return;
    const h = c.play(name, { fade: 0 });
    if (name === 'br_ko_window') h.onMark.glass = () => {
      const pane = stage.part('dinerFront').panes[at];
      const hip = c.bones.chest.getWorldPosition(new THREE.Vector3());
      if (pane) stage.glass.shatter(pane, { dir: new THREE.Vector3(1, 0.1, 0), power: 2, by: 'body', at: hip });
    };
  };
  // the eye
  const cam = q.get('cam') || 'eye';
  const ty = F + 1.2;
  let P;
  if (cam === 'side') P = lookFrom(S, S.yaw - Math.PI / 2, 2.6, F + 1.45, F + 1.0);
  else if (cam === 'out') P = { x: DINER.faceX + 2.6, z: S.z - 1.2, yaw: Math.PI / 2 + 0.42, pitch: -0.12, y: F + 1.5 };
  else if (cam === 'high') P = lookFrom(S, S.yaw + 0.7, 3.2, F + 2.7, F + 0.8);
  else P = lookFrom(S, S.yaw, 1.45, DINER.brawlEyeY, ty);
  if (name === 'br_ko_window' && cam === 'eye') P = lookFrom(S, S.yaw, 1.7, DINER.brawlEyeY, F + 1.0);
  // (the last blow from the side: along the window wall inside, the sill in
  // profile, 2.4 m off; from outside: on the pavement 3 m off, level)
  if (name === 'br_ko_window' && cam === 'side') { const e = { x: S.x - (at === 'B2' ? 1.45 : 1.1), z: S.z + (at === 'B2' ? 2.3 : 2.7) }; P = { x: e.x, z: e.z, yaw: Math.atan2(-(S.x + 0.5 - e.x), -(S.z - e.z)), pitch: -0.1, y: F + 1.25 }; }
  if (name === 'br_ko_window' && cam === 'out') { const e = { x: DINER.faceX + 3.7, z: S.z - 2.2 }; P = { x: e.x, z: e.z, yaw: Math.atan2(-(S.x + 0.8 - e.x), -(S.z - e.z)), pitch: -0.08, y: F + 1.3 }; }
  controller.setPose(P.x, P.z, P.yaw, P.pitch, P.y - 1.63);
  if (!q.get('fov')) { camera.fov = cam === 'eye' ? 68 : 58; camera.updateProjectionMatrix(); }
}

function stageRoom(stage, camera, controller) {
  const q = Q();
  const d = stage.part('diner');
  if (d && d.reset) d.reset();
  const n = parseInt(q.get('cam') || '0', 10);
  const views = [
    // over the finish spot at B2, down the window wall to the booths
    { x: -13.6, z: 1.0, yaw: Math.atan2(-0.5, -0.85), pitch: -0.2, y: 2.3 },
    // from the counter end at B4, up the room
    { x: -12.4, z: -5.2, yaw: Math.atan2(0.2, -1), pitch: -0.16, y: 1.8 },
    // the B2 finish spot from the aisle
    { x: -13.2, z: 5.0, yaw: -Math.PI / 2, pitch: -0.12, y: 1.8 },
  ];
  const P = views[n] || views[0];
  controller.setPose(P.x, P.z, P.yaw, P.pitch, P.y - 1.63);
  camera.fov = 70; camera.updateProjectionMatrix();
}

// r2play&beat=<fight beat>&t=<s>[&seed=n][&step=n]: the fight from that
// beat, played by the autoplay (a human's pace) for t seconds, then frozen:
// strips of the real fight's motion
function stagePlay(stage, camera, controller, game) {
  const q = Q();
  game.scenes.shot('fight', q.get('beat') || 'lesson');
  game.autoplay = new Autoplay(game, { seed: parseInt(q.get('seed') || '1937', 10) });
}

// r2duel&do=<what>&t=<s>: one moment of the fight, staged and played by
// real input (the game's virtual keys), frozen at t:
//   do=<his attack clip>&slip=L|R|lean|cover|none   his blow at 1.0 s, my answer
//                                                    as a player's, just before it lands
//   do=stools     my hard punch throws him back into the row of stools
//   do=bottle     (dirty) he goes for a bottle on the counter, breaks it, thrusts
//   do=stool      (wild) he picks up a stool and swings it
//   do=reel       he is out on his feet: the reel to the nearer window
//   do=jab|hard   my own blows (&arm=L|R)
function stageDuel(stage, camera, controller, game) {
  const q = Q();
  const what = q.get('do') || 'br_hook';
  const manner = what === 'bottle' ? 'round2' : what === 'stool' || what === 'reel' ? 'round3' : 'round1';
  game.scenes.shot('fight', manner);
  const B = game.brawl, V = game.vin;
  const press = (code, secs = 1 / 60) => { V.down.add(code); V.held.add(code); const at = game.time + secs; game.scripts.push((t) => { if (t >= at - 1e-6 && V.held.has(code)) { V.held.delete(code); V.up.add(code); } }); };
  const c = B.c;
  if (what === 'stools') {
    // (him between me and the stools, near stool 5)
    const z = 2.8;
    c.place({ x: -13.12, z }, Math.PI / 2);
    controller.setMode('brawl', { opponent: c, eyeY: DINER.brawlEyeY, pos: { x: -11.72, z }, yaw: Math.PI / 2 });
  }
  if (what === 'bottle' || what === 'stool') {
    // (close to the thing he goes for, me a step off it: the moment is seen)
    const it = B.room.hisItem(what, { x: -13.0, z: what === 'bottle' ? 5.4 : 3.2 }) || B.room.hisItem(what, c.pos);
    if (it) {
      const st = it.stand;
      c.place({ x: st.x + 0.15, z: st.z - 0.55 }, 0);
      const me = { x: st.x + 0.75, z: st.z - 2.0 };
      controller.setMode('brawl', { opponent: c, eyeY: DINER.brawlEyeY, pos: me, yaw: Math.atan2(-(c.pos.x - me.x), -(c.pos.z - me.z)) });
    }
  }
  let done = false;
  B.him.next = 99; B.lessonHold = true;
  // (him where the moment wants him: he holds his ground until it starts)
  if (what === 'stools') B.holdStill = true;
  // (the arcade pass: &open=L|R|LR holds that side of his guard down - the
  // side of MY screen - for the whole moment)
  const open = q.get('open');
  if (open) game.scripts.push(() => { if (B.him && B.him.state === 'move') B.him.taunt = open; });
  const hold = parseFloat(q.get('hold') || '0.5');
  // (&burst=<px>: a held burst at his jaw from 1.0 s - the burst's look)
  if (q.get('burst')) game.scripts.push((t) => { if (!stageDuel._b && t >= 1.0) { stageDuel._b = true; const h = c.bones.head.getWorldPosition(new THREE.Vector3()); const at = game.eye.clone().lerp(h, 0.85); game.fx.hit.punch(at, new THREE.Vector3(0, 0, 1), 1, { px: +q.get('burst'), camera: game.camera, hold: true }); } });
  const once = new Set();
  const at = (t0, key, fn) => game.scripts.push((tt) => { if (tt >= t0 && !once.has(key)) { once.add(key); fn(); } });
  game.scripts.push((t) => {
    if (done || t < 1.0) return;
    done = true;
    B.lessonHold = false;
    if (what === 'stools') game.scripts.push((tt) => { if (tt > 3.5) B.holdStill = false; });
    if (what === 'stools' || what === 'hard') press(q.get('arm') === 'L' ? 'Mouse0' : 'Mouse2', hold);
    else if (what === 'jab') press(q.get('arm') === 'R' ? 'Mouse2' : 'Mouse0');
    // do=combo: L R L R jabs 0.17 s apart into an open man; do=break: three
    // hard punches into his guard
    else if (what === 'combo') { B.him.taunt = 'LR'; ['Mouse0', 'Mouse2', 'Mouse0', 'Mouse2'].forEach((b, i) => at(1.0 + i * 0.17, 'c' + i, () => press(b))); }
    else if (what === 'break') { for (let i = 0; i < 3; i++) at(1.0 + i * 0.75, 'b' + i, () => press(i % 2 ? 'Mouse0' : 'Mouse2', 0.3)); }
    else if (what === 'bottle') { B.him.next = 0; B.him.manner = 'dirty'; }
    else if (what === 'stool') { const it = B.room.hisItem('stool', c.pos); if (it) { B.him.task = { kind: 'stool', item: it, t: 0 }; B.him.state = 'arm'; } }
    else if (what === 'reel') { B.damageHim(B.him.hp - 12); B.startReel(); }
    // (polish: do=mystool|mybottle - a stool or a bottle into my right hand,
    // then the right button held &hold s (default 1.0) and let go)
    else if (what === 'mystool' || what === 'mybottle') {
      const k = what === 'mystool' ? 'stool' : 'bottle';
      const it = B.room.items().filter((x) => x.kind === k).sort((a, b) => Math.hypot(a.pos.x - game.eye.x, a.pos.z - game.eye.z) - Math.hypot(b.pos.x - game.eye.x, b.pos.z - game.eye.z))[0];
      if (it) B.grab(it);
      game.scripts.push((tt) => { if (!B._mySent && tt >= 1.6) { B._mySent = true; press('Mouse2', q.get('click') ? 1 / 60 : hold); } });
    }
    else {
      // his blow at 1.0 s; my answer &react s after its tell starts (a
      // human's 0.22 by default): &slip=L|R (a hop: A / D), back (S), block
      // (SPACE held), counter (a jab into the side his swing opens), none
      B.hisAttack(what);
      const slip = q.get('slip') || 'none';
      const react = parseFloat(q.get('react') || '0.22');
      at(1.0 + react, 'answer', () => {
        if (slip === 'L' || slip === 'R') press(slip === 'L' ? 'KeyA' : 'KeyD');
        else if (slip === 'back') press('KeyS');
        else if (slip === 'block' || slip === 'cover') press('Space', 0.6);
        else if (slip === 'counter') press(/L$/.test(what) ? 'Mouse2' : 'Mouse0');
      });
    }
  });
}

export const presets = {
  r2duel: { t: 2, viewmodel: true, stage: stageDuel },
  r2play: { t: 10, viewmodel: true, stage: stagePlay },
  r2clip: { viewmodel: false, x: -12.85, z: 1.73, y: 0.17, yaw: 0, pitch: -0.2, fov: 68, t: 0.5, stage: stageClip },
  r2room: { x: -13.6, z: 1.0, y: 0.6, yaw: 0, pitch: -0.2, fov: 70, t: 0.3, stage: stageRoom },
};
