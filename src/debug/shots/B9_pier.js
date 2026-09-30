import * as THREE from 'three';
import { Autoplay } from '../../game/Autoplay.js';

// Lane R2-E (docs/story/briefs/B9_PIER_FIGHT.md): the second fist fight in
// Pier 9's loading bay, judged by play.
//   b9play&seed=<n>&style=<player|mash|nododge|fists|things|rough>&t=<s>
//        the fight from its beat (the foreman steps out, the fight), played
//        by the autoplay at a human's pace for t seconds; then read
//        window.__b9 (the fight's record: won, time, downs, disarms, what
//        was used)
//   b9duel&do=<what>&t=<s>   one moment, staged in the ring and played by the
//        game's virtual keys at set times:
//     do=swingBack   his hook swing, my hop back out of it (S)
//     do=swingSide   the same, a hop aside (D): not enough - it finds me
//     do=swingIn     the same, a step in (W): inside it
//     do=disarm      his hook swing's wind-up, my left jab on his hook arm:
//                    the hook out of his fist, on the floor
//     do=lid         the crate lid in my hands, held up (SPACE): his swing
//                    stopped, the lid splits
//     do=lantern     the lantern knocked off its post (him driven into it
//                    twice): it burns on the floor
//     do=hook        the hook in my hand, on him: it sticks in a crate
//     do=chain       the chain swung from 2.4 m
//     do=crates      a hard punch drives him into the stack: the top crate comes down
//     do=finish      out on his feet at a loading door (&door=2), my punch:
//                    through the planks, into the river
//   b9spy&spy=x,y,z,yaw,pitch[,fov]  a duel moment from outside the eye (&do= as above)
const Q = () => new URLSearchParams(location.search);

function stagePlay(stage, camera, controller, game) {
  const q = Q();
  game.scenes.shot('warehouse', q.get('beat') || 'fight');
  game.autoplay = new Autoplay(game, { seed: parseInt(q.get('seed') || '1937', 10) });
  const R = window.__b9 = { t0: null, done: false };
  game.scripts.push((t) => {
    const B = game.brawl;
    if (B.active && R.t0 == null) R.t0 = t;
    if (B.stats && R.t0 != null) {
      const S = B.stats;
      Object.assign(R, { won: !!S.won, time: +(S.time || 0).toFixed(1), downs: S.downs, disarms: S.disarms || 0, shielded: S.shielded || 0, held: S.held || [], landed: S.landed, taken: S.taken,
        manner: B.him && B.him.manner, hp: B.him && +B.him.hp.toFixed(1), manners: S.manners, hurtBy: S.hurtBy, dmgBy: S.dmgBy, window: S.window, into: S.into, clips: S.clips, levels: S.levels });
    }
    if (B.finished && !R.done) { R.done = true; R.at = +(t - R.t0).toFixed(1); }
  });
}

// the ring, the fight begun, him held off his blows until the moment
function ring(game, { hook = true, manner = 'measured' } = {}) {
  game.scenes.shot('warehouse', 'fight');
  // (the approach skipped: the fight as a retry finds it)
  const ctx = game.scenes.ctx, L = ctx.flags.live;
  L.stealth.undress();
  L.fightOn = true;
  const B = game.brawl;
  return { ctx, L, B };
}
function stageDuel(stage, camera, controller, game) {
  const q = Q();
  const what = q.get('do') || 'swingBack';
  const V = game.vin;
  const press = (code, secs = 1 / 60) => { V.down.add(code); V.held.add(code); const at = game.time + secs; let gone = false; game.scripts.push((t) => { if (!gone && t >= at - 1e-6) { gone = true; if (V.held.has(code)) { V.held.delete(code); V.up.add(code); } } }); };
  const at = (t0, fn) => { let done = false; game.scripts.push((t) => { if (!done && t >= t0 - 1e-6) { done = true; fn(t); } }); };
  const { L } = ring(game);
  const S = window.__b9duel = { what };
  const go = () => {
    const B = game.brawl;
    if (!B.active) return false;
    B.him.next = 99; B.lessonHold = true; B.him.breatheT = -99;
    return true;
  };
  // (wait for the approach to hand over to the fight, then stage)
  let staged = false;
  game.scripts.push((t) => {
    if (staged || !game.brawl.active) return;
    staged = true;
    go();
    const B = game.brawl, c = B.c, G = game;
    const t0 = t;
    // (him squared up 1.6 m before me, in the ring's middle; &dist= another)
    {
      const d = parseFloat(q.get('dist') || '1.6');
      const e = G.eye, C = G.controller;
      const me = { x: 11.6, z: -36.6 };
      C.pos.set(me.x, 0, me.z);
      const hx = me.x + 0.25, hz = me.z + d;
      c.place({ x: hx, z: hz }, Math.atan2(me.x - hx, me.z - hz));
      C.faceYaw = Math.atan2(-(hx - me.x), -(hz - me.z));
      void e;
    }
    const hisBlow = (clip, when) => at(t0 + when, () => { B.lessonHold = false; B.hisAttack(clip); B.lessonHold = true; });
    if (what === 'swingBack' || what === 'swingSide' || what === 'swingIn') {
      hisBlow('fm_hookSwing', 0.8);
      const key = what === 'swingBack' ? 'KeyS' : what === 'swingSide' ? 'KeyD' : 'KeyW';
      at(t0 + 0.8 + 0.3, () => press(key, what === 'swingIn' ? 0.4 : 1 / 60));
    } else if (what === 'disarm') {
      hisBlow('fm_hookSwing', 0.8);
      at(t0 + 0.8 + 0.22, () => press('Mouse0'));
    } else if (what === 'lid' || what === 'hook' || what === 'chain' || what === 'lantern2') {
      const kind = what === 'lantern2' ? 'lantern' : what;
      const it = B.room.items().find((x) => x.kind === kind);
      if (it) {
        const o = it.take();
        const T = B.room.things[kind];
        const hand = T.hands === 2 ? 'R' : 'R';
        B.me.holding = { kind, object: o, name: it.name, uses: T.uses, hand, hands: T.hands };
        G.player.hands.hold(o, hand);
        B.me.h = G.player.hands.play(B.restClip());
      }
      if (what === 'lid') { hisBlow('fm_hookSwing', 0.9); at(t0 + 0.9 + 0.2, () => press('Space', 1.0)); }
      else { B.him.taunt = 'LR'; at(t0 + 0.8, () => press('Mouse2', what === 'chain' ? 1 / 60 : 1 / 60)); }
      if (what === 'chain') { c.place({ x: c.pos.x + (c.pos.x - G.eye.x) * 0.5, z: c.pos.z + (c.pos.z - G.eye.z) * 0.5 }); }
    } else if (what === 'lantern') {
      // him driven into the post twice
      const post = B.room.knockables().find((k) => k.what === 'post');
      at(t0 + 0.5, () => { B.into({ s: 0.3, what: 'post', obj: post }, new THREE.Vector3(1, 0, -0.3).normalize()); });
      at(t0 + 2.2, () => { B.into({ s: 0.3, what: 'post', obj: post }, new THREE.Vector3(1, 0, -0.3).normalize()); });
    } else if (what === 'crates') {
      B.him.taunt = 'LR';
      at(t0 + 0.6, () => press('Mouse0', 0.7));
    } else if (what === 'finish') {
      B.damageHim(B.him.hp - 0.1 * B.max); B.startReel();
    }
    S.staged = true;
  });
  void L; void controller; void camera; void stage;
}

// a moment seen from outside the eye
function stageSpy(stage, camera, controller, game) {
  const q = Q();
  if (q.get('beat')) game.scenes.shot('warehouse', q.get('beat'));
  else stageDuel(stage, camera, controller, game);
  const [x, y, z, yaw, pitch, fov] = (q.get('spy') || '11,2.5,-39.6,2.8,-0.3,60').split(',').map(Number);
  // (after the scene has moved the eye this step, the picture is taken from
  // the spy's place: the rules still see the player where he is)
  const put = () => {
    camera.position.set(x, y, z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, 0);
    if (fov && Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  };
  game.scenes.ctx.onStep(put);
  put();
  game.setViewmodelVisible(false);
}

export const presets = {
  b9play: { t: 3, viewmodel: true, stage: stagePlay },
  b9duel: { t: 3, viewmodel: true, stage: stageDuel },
  b9spy: { t: 3, viewmodel: false, stage: stageSpy },
};
