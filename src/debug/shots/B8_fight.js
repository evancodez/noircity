import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { BRAWL } from '../../game/Brawl.js';
import { BIG } from '../../player/clips/fight.js';

// [B8] The fist fight's own presets (docs/story/briefs/B8_FIGHT.md): to look
// at a moment of the fight from outside the player's eye, and at its motion
// from inside it.
//   b8spy&sc=<scene>&beat=<beat>&spy=x,y,z,yaw,pitch[,fov]&t=<s>
//       the scene's beat played for t seconds as it plays (its script, its
//       controller), drawn from a camera of its own (the player's hands
//       hidden): the room from above, the start from the side
//   b8duel&do=<what>&t=<s>   one moment of the fight (version 4), staged in
//       round 1 (or &round=2|3) and played by real input (the game's virtual
//       keys) from 1.0 s, frozen at t:
//     do=wind&arm=L|R&hold=<s>&open=L|R|LR   a press held, the wind-up's
//                                  levels, let go: the hard punch lands
//     do=answer&arm=L|R[&hop=L|R|back|block&react=<s>]  a jab into his
//                                  raised guard; he answers (always, here);
//                                  my hop (or not) &react s after
//     do=full&arm=L|R              a full-power punch into his raised guard: it breaks
//     do=throw[&hop=L|R|chev&react=<s>]   he throws a plate from 2.6 m; my hop
//     do=stoolSwing[&hop=L|R|back&react=<s>]  he swings a stool
//     do=mything&kind=chair|stool|bottle|plate&btn=L|R&hold=<s>  a thing into
//                                  my hands, then that button (clicked, or held)
const Q = () => new URLSearchParams(location.search);

function stageSpy(stage, camera, controller, game) {
  const q = Q();
  game.scenes.shot(q.get('sc') || 'fight', q.get('beat') || null);
  const [x, y, z, yaw, pitch, fov] = (q.get('spy') || '-12.8,6,2,0,-1.2,60').split(',').map(Number);
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

function stageDuel(stage, camera, controller, game) {
  const q = Q();
  const what = q.get('do') || 'wind';
  const round = q.get('round') || '1';
  game.scenes.shot('fight', 'round' + round);
  const B = game.brawl, V = game.vin, c = B.c;
  const press = (code, secs = 1 / 60) => { V.down.add(code); V.held.add(code); const at = game.time + secs; let gone = false; game.scripts.push((t) => { if (!gone && t >= at - 1e-6) { gone = true; if (V.held.has(code)) { V.held.delete(code); V.up.add(code); } } }); };
  const once = new Set();
  const at = (t0, key, fn) => game.scripts.push((tt) => { if (tt >= t0 && !once.has(key)) { once.add(key); fn(); } });
  // (him still until the moment: no blow of his own, no breathing)
  B.him.next = 99; B.lessonHold = true;
  const open = q.get('open');
  if (open) game.scripts.push(() => { if (B.him && B.him.state === 'move') B.him.taunt = open; });
  const arm = q.get('arm') === 'L' ? 'Mouse0' : 'Mouse2';
  const hold = parseFloat(q.get('hold') || '0.66');
  const react = parseFloat(q.get('react') || '0.22');
  const hopKey = (h) => (h === 'L' ? 'KeyA' : h === 'R' ? 'KeyD' : h === 'back' ? 'KeyS' : null);
  const answerHop = () => {
    const h = q.get('hop');
    if (!h) return;
    if (h === 'block') press('Space', 0.6);
    else if (h === 'chev') { const s = B._cards && B._cards.chev && B._cards.chev.side; if (s) press(s === 'L' ? 'KeyA' : 'KeyD'); }
    else press(hopKey(h));
  };
  if (what === 'wind') at(1.0, 'press', () => press(arm, hold));
  else if (what === 'answer') {
    // (a jab into his raised guard: he answers, always, here)
    at(1.0, 'press', () => { B.lessonHold = false; B.him.next = 99; B.him.breatheT = -99; const a0 = BRAWL.answer; BRAWL.answer = 1; press(arm); game.scripts.push((tt) => { if (tt > 1.2) BRAWL.answer = a0; }); });
    at(1.0 + 0.1 + react, 'hop', answerHop);
  } else if (what === 'full') at(1.0, 'press', () => press(arm, 0.66));
  else if (what === 'throw' || what === 'stoolSwing') {
    // (him with the thing in his hand, 2.6 m off for a throw, 1.5 for a swing)
    const kind = what === 'throw' ? (q.get('kind') || 'plate') : (q.get('kind') || 'stool');
    const it = B.room.hisItem(kind, c.pos) || B.room.items().find((x) => x.kind === kind);
    const E = game.eye, d = what === 'throw' ? 2.6 : 1.5;
    const P = controller.pos, dl = Math.hypot(c.pos.x - P.x, c.pos.z - P.z) || 1, fx = (c.pos.x - P.x) / dl, fz = (c.pos.z - P.z) / dl;
    c.place({ x: P.x + fx * d, z: P.z + fz * d }, Math.atan2(-fx, -fz));
    if (it) {
      const o = it.take();
      B.him.prop = o; B.him.holding = kind;
      c.hold(o, 'R', { grip: kind === 'stool' || kind === 'chair' || kind === 'bottle' ? 'hang' : 'upright' });
    }
    B.holdStill = true;
    at(1.0, 'go', () => { B.hisAttack(what === 'throw' ? 'br_throw' : 'br_stoolSwing'); });
    at(1.0 + react, 'hop', answerHop);
  } else if (what === 'mything') {
    // (look development: &bigr= / &bigl=px,py,pz,fx,fy,fz,bx,by,bz set the
    // rest poses of a stool or a chair in both hands)
    for (const [k, side] of [['bigr', 'R'], ['bigl', 'L']]) {
      const v = q.get(k);
      if (!v) continue;
      const n = v.split(',').map(Number);
      Object.assign(BIG[side], { p: n.slice(0, 3), f: n.slice(3, 6), b: n.slice(6, 9) });
    }
    const kind = q.get('kind') || 'chair';
    const items = B.room.items().filter((x) => x.kind === kind).sort((a, b) => Math.hypot(a.pos.x - game.eye.x, a.pos.z - game.eye.z) - Math.hypot(b.pos.x - game.eye.x, b.pos.z - game.eye.z));
    // (into the hand named by btn, for a small thing: the grab picks the hand
    // on its side of the frame, so the thing is given straight to it here)
    const btn = q.get('btn') || 'L';
    if (items[0]) {
      const it = items[0], o = it.take();
      const hands = kind === 'stool' || kind === 'chair' ? 2 : 1, hand = hands === 2 ? 'R' : btn;
      B.me.holding = { kind, object: o, name: it.name, uses: kind === 'neck' ? 2 : 1, hand, hands };
      if (kind === 'chair' && !o.userData.grip) o.userData.grip = new THREE.Matrix4().makeTranslation(0.12, 0.95, -0.19);
      game.player.hands.hold(o, hand);
      B.me.h = game.player.hands.play(B.restClip());
    }
    B.him.taunt = 'LR';
    const h = q.get('hold');
    // (&then=L|R|back|block: a hop or the block with it in my hands instead)
    const then = q.get('then');
    if (then) at(1.2, 'press', () => (then === 'block' ? press('Space', 0.8) : press(hopKey(then))));
    else at(1.2, 'press', () => press(btn === 'L' ? 'Mouse0' : 'Mouse2', h ? parseFloat(h) : 1 / 60));
  }
  void DINER; void THREE;
}


// b8things (&t=300): every kind of thing, in each hand, through every way it
// can leave a hand - a hit, a blow into his guard, a miss, a throw (a
// wind-up), being hit while holding it, a knock-down and the retry after it,
// the last blow - each case staged fresh in round 1 and played by the
// virtual keys, then left 4 s; after each: what is in my hands matches what
// the rules think I hold, nothing is in the air, and every piece lies on
// something. The report: window.__b8things (and #errlog if any case fails).
function stageThings(stage, camera, controller, game) {
  const cases = [];
  for (const kind of ['bottle', 'plate', 'mug', 'stool', 'chair']) {
    const big = kind === 'stool' || kind === 'chair';
    for (const btn of big ? ['L', 'R'] : ['L', 'R']) {
      for (const act of ['hit', 'guard', 'miss', 'wind', 'hurt', 'down', 'finish']) cases.push({ kind, btn, act });
    }
  }
  const out = { cases: [], fails: [] };
  window.__b8things = out;
  let i = -1, T0 = 0, phase = 'next';
  const V = game.vin;
  const press = (code, secs = 1 / 60) => { V.down.add(code); V.held.add(code); const at = game.time + secs; let gone = false; game.scripts.push((t) => { if (!gone && t >= at - 1e-6) { gone = true; if (V.held.has(code)) { V.held.delete(code); V.up.add(code); } } }); };
  const check = (C) => {
    const B = game.brawl, H = game.player.hands, F = game.stage.breakables.field;
    const me = B.me || {};
    const errs = [];
    // (the hands hold what the rules say, and nothing else)
    for (const h of ['L', 'R']) {
      const want = me.holding && (me.holding.hand || 'R') === h ? me.holding.object : null;
      if ((H.held[h] || null) !== want) errs.push(`hand ${h} holds ${H.held[h] ? H.held[h].userData.kind : 'nothing'}, rules: ${want ? want.userData.kind : 'nothing'}`);
    }
    if (B.flying && B.flying.length) errs.push(`${B.flying.length} in the air (thrown)`);
    if (F.live.length) errs.push(`${F.live.length} pieces still moving`);
    let high = 0;
    for (const p of F.rest) {
      if (!p.mesh.parent || p.hinge) continue;
      p.mesh.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(p.mesh, true);
      const g = F.restSupport(p, b);
      if (b.min.y - g > 0.012) high++;
    }
    if (high) errs.push(`${high} pieces resting over 1 cm above what is under them`);
    const r = { ...C, held: me.holding ? me.holding.kind + (me.holding.hand || '') : null, pieces: F.rest.length, errs };
    out.cases.push(r);
    if (errs.length) { out.fails.push(r); console.warn('b8things', JSON.stringify(r)); }
  };
  const give = (C) => {
    const B = game.brawl, c = B.c;
    const items = B.room.items().filter((x) => x.kind === C.kind).sort((a, b) => Math.hypot(a.pos.x - game.eye.x, a.pos.z - game.eye.z) - Math.hypot(b.pos.x - game.eye.x, b.pos.z - game.eye.z));
    const it = items[0];
    if (!it) return false;
    const o = it.take();
    const hands = C.kind === 'stool' || C.kind === 'chair' ? 2 : 1, hand = hands === 2 ? 'R' : C.btn;
    if (C.kind === 'chair' && !o.userData.grip) o.userData.grip = new THREE.Matrix4().makeTranslation(0.12, 0.95, -0.19);
    B.me.holding = { kind: C.kind, object: o, name: it.name, uses: 1, hand, hands };
    game.player.hands.hold(o, hand);
    B.me.h = game.player.hands.play(B.restClip());
    void c;
    return true;
  };
  game.scripts.push((t) => {
    const B = game.brawl;
    if (phase === 'next') {
      i++;
      if (i >= cases.length) { phase = 'done'; out.done = true; return; }
      const C = cases[i];
      game.scenes.shot('fight', 'round1');
      const Bb = game.brawl;
      Bb.him.next = 99; Bb.lessonHold = true; Bb.him.breatheT = -99;
      game.health.hp = 100;
      if (!give(C)) { out.cases.push({ ...C, skipped: true }); return; }
      T0 = t; phase = 'act';
      return;
    }
    if (phase === 'act' && t - T0 > 0.5) {
      const C = cases[i], c = B.c, code = C.btn === 'L' ? 'Mouse0' : 'Mouse2';
      phase = 'wait';
      if (C.act === 'hit') { B.him.taunt = 'LR'; press(code); }
      else if (C.act === 'guard') press(code);
      else if (C.act === 'miss') { c.place({ x: c.pos.x, z: c.pos.z - 3.5 }); press(code); }
      else if (C.act === 'wind') { B.him.taunt = 'LR'; press(code, 0.66); }
      else if (C.act === 'hurt') { B.lessonHold = false; B.hisAttack('br_hook'); }
      else if (C.act === 'down') { game.health.hp = 4; B.lessonHold = false; B.hisAttack('br_haymaker'); }
      else if (C.act === 'finish') { B.damageHim(B.him.hp - 0.1 * B.max); B.startReel(); }
      T0 = t;
      return;
    }
    if (phase === 'wait') {
      const C = cases[i];
      // (the last blow: at the window, then the thing on him)
      if (C.act === 'finish' && B.him && B.him.atSpot && !C.sent && B.active) {
        C.sent = true;
        const E = game.controller, s = B.him.spot;
        E.setMode('brawl', { opponent: B.c, eyeY: 1.8, pos: { x: s.x - 1.3, z: s.z + 0.2 }, yaw: Math.atan2(-(s.x - (s.x - 1.3)), -(s.z - (s.z + 0.2))) });
        game.scripts.push((tt) => { if (!C.hit2 && tt > t + 0.3) { C.hit2 = true; press(C.btn === 'L' ? 'Mouse0' : 'Mouse2'); } });
      }
      if (t - T0 > (C.act === 'down' ? 6 : C.act === 'finish' ? 9 : 4.5)) { check(C); phase = 'next'; }
    }
  });
}

export const presets = {
  b8spy: { t: 1, viewmodel: false, stage: stageSpy },
  b8duel: { t: 2, viewmodel: true, stage: stageDuel },
  b8things: { t: 440, viewmodel: true, stage: stageThings },
};
