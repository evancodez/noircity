// [C10a] Wave C's bug hunt over chapters I to VII as merged: every checkpoint of every chapter,
// played badly (the wrong keys, ESC and back, the pointer lock lost, a resize, standing still,
// a reload and CONTINUE), and ten fails in a row at one checkpoint per contest (does anything pile up).
//   HUNT_PHASE=abuse|die|cont  HUNT_ONLY=tail  NOIR_PORT=5350 node tools/hunt.mjs tools/hunts/wavec.mjs
import { LEAK } from './mkplays.mjs';

export const CHECKPOINTS = {
  diner: ['settle', 'order', 'drink', 'pay'],
  fight: ['start', 'lesson', 'round1', 'round2', 'round3', 'outside'],
  office: ['corridor', 'room', 'pad', 'safe', 'check'],
  gunfight: ['shadows', 'flank', 'corridor', 'quiet'],
  watcher: ['seen', 'escape', 'alley', 'lane', 'yard', 'kitchen', 'press', 'el', 'cut', 'over', 'street', 'market', 'car'],
  tail: ['start', 'chase2', 'river', 'pier'],
  warehouse: ['arrive', 'floor', 'lamps', 'aisle', 'stairs', 'listen', 'office', 'loud', 'fight', 'after'],
};
// one checkpoint per contest for the ten fails (fall: a man shot; else a stop)
const DIE = [
  ['fight.round1', false], ['gunfight.flank', true], ['gunfight.corridor', true], ['watcher.alley', false], ['watcher.market', false],
  ['tail.start', false], ['tail.river', false], ['warehouse.floor', false], ['warehouse.loud', true], ['warehouse.fight', false],
];
// what piles up: objects in the stage's scene, lights, programs, geometries, textures, the men, the sounds
const PILE = `(() => { let n = 0, l = 0; N.scene.traverse((o) => { n++; if (o.isLight) l++; }); const I = N.renderer.info;
  return { objs: n, lights: l, progs: I.programs ? I.programs.length : -1, geo: I.memory.geometries, tex: I.memory.textures, hoods: G.stage.hoods ? G.stage.hoods.list.length : 0,
    corpses: G.corpses.length, ais: G.ais.size, pending: G.pending.length, inter: G.interact.list.length, layers: G.hud.layers ? G.hud.layers.size : 0,
    sfx: G.sfx && G.sfx.active ? G.sfx.active.size || G.sfx.active.length || 0 : -1, fails: G.fails(), scene: G.scenes.current && G.scenes.current.id, beat: G.scenes.beat }; })()`;

export default async function (h) {
  const only = process.env.HUNT_ONLY;
  const phase = process.env.HUNT_PHASE || 'abuse';
  const dump = async (tag) => { const v = JSON.parse(await h.js(LEAK)); h.log(`${tag}: ${JSON.stringify({ scene: v.scene, beat: v.beat, st: v.st, mode: v.mode, frozen: v.frozen, lookLocked: v.lookLocked, hands: v.hands, weap: v.weap, rev: v.rev, vm: v.vm, ts: v.ts, hp: v.hp, brawl: v.brawl, layers: v.layers, fade: v.fade, prompt: v.prompt, paused: v.paused, locked: v.locked, inv: v.inv, music: v.music })}`); return v; };
  const kit = `JSON.stringify({ obj: G.hud.kit.objectiveText, warn: G.hud.kit && G.hud.kit.warnText, teach: G.counters.teach, failing: G.counters.failing })`;

  if (phase === 'abuse') {
    for (const [sc, beats] of Object.entries(CHECKPOINTS)) for (const bt of beats) {
      const at = `${sc}.${bt}`;
      if (only && !at.includes(only)) continue;
      h.log(`=== ${at}`);
      await h.open(`/?mute=1&start=${at}`);
      if (!(await h.begin())) { h.check(`${at}: begun`, false); continue; }
      await h.wait(3500);
      const a = await dump('  start');
      h.log('  kit ' + await h.js(kit));
      // the wrong keys at the wrong times
      await h.mash(3500); await h.releaseAll(); await h.wait(300);
      await h.say();
      // ESC and back
      await h.pause();
      const p = await h.js(`({ paused: G.hud.paused, t: N.time, keys: [...N.controller.keys].join(',') })`);
      await h.key('KeyE'); await h.click('right'); await h.wait(900);
      const t1 = await h.js('N.time');
      h.check(`${at}: ESC: the card, the clock held, no key down`, p.paused === true && Math.abs(t1 - p.t) < 0.05 && p.keys === '', { p, t1 });
      h.check(`${at}: resume`, await h.resume());
      await h.wait(500);
      // the lock lost by the browser mid-beat (alt-tab): a blur and the lock gone
      await h.js(`(window.dispatchEvent(new Event('blur')), document.exitPointerLock(), 1)`); await h.wait(400);
      const q = await h.js(`({ paused: G.hud.paused, free: !document.pointerLockElement })`);
      h.check(`${at}: lock lost: paused or mouse-free line`, q.free && q.paused, q);
      await h.resume(); await h.wait(300);
      // resize
      await h.resize(900, 560); await h.wait(400);
      const asp = await h.js('N.camera.aspect');
      h.check(`${at}: resize keeps the aspect`, Math.abs(asp - 900 / 560) < 0.02, asp);
      await h.resize(1280, 800); await h.wait(300);
      // stand still 40 s of game time
      await h.js(`(N.sim(40), 1)`);
      await h.wait(300);
      h.log('  after 40 s still: ' + await h.snap() + ' ' + await h.js(kit));
      const e1 = await h.err();
      h.check(`${at}: errlog clean after mash, ESC, resize, standing`, e1 === '', e1);
      // reload, CONTINUE: the save's scene and beat
      const sv = await h.js(`JSON.parse(localStorage.getItem('noir.save') || 'null')`);
      await h.reload(); await h.wait(1200);
      const can = await h.js(`!document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden')`);
      h.check(`${at}: CONTINUE offered (save ${sv && sv.scene}.${sv && sv.beat})`, can === true);
      if (can) {
        h.check(`${at}: CONTINUE took the mouse`, await h.cont());
        await h.wait(3500);
        const c = await dump('  continued');
        h.check(`${at}: CONTINUE came back at the save (${sv.scene}.${sv.beat})`, c.scene === sv.scene && c.beat === sv.beat, { scene: c.scene, beat: c.beat });
        h.log('  kit ' + await h.js(kit));
        await h.down('KeyW'); await h.wait(600); await h.up('KeyW');
      }
      const e2 = await h.err();
      h.check(`${at}: errlog clean at the end`, e2 === '', e2);
    }
  }

  if (phase === 'die') {
    for (const [at, fall] of DIE) {
      if (only && !at.includes(only)) continue;
      h.log(`=== ${at}: ten fails`);
      await h.open(`/?mute=1&start=${at}`);
      if (!(await h.begin())) { h.check(`${at}: begun`, false); continue; }
      await h.wait(4000);
      const p0 = await h.js(PILE);
      h.log('  pile 0: ' + JSON.stringify(p0));
      const ft = [];
      for (let k = 0; k < 10; k++) {
        await h.js(`(G.fail({ why: 'Hunt.', fall: ${fall} }), 1)`);
        const back = await h.until(`!G.failing && G.state === 'playing' && !G.scenes.trans`, 12000);
        if (!back) { h.check(`${at}: fail ${k + 1} came back`, false, await h.snap()); break; }
        await h.wait(1500);
        // a little play between: W and a click
        await h.down('KeyW'); await h.click('left'); await h.wait(500); await h.up('KeyW');
        const f = await h.js(`(() => { const t0 = performance.now(); return new Promise((r) => { let n = 0; const s = () => { if (++n < 30) requestAnimationFrame(s); else r((performance.now() - t0) / 30); }; requestAnimationFrame(s); }); })()`);
        ft.push(+f.toFixed(1));
      }
      const p1 = await h.js(PILE);
      h.log('  pile 10: ' + JSON.stringify(p1));
      h.log('  frame ms after each: ' + ft.join(' '));
      const grew = Object.keys(p0).filter((k) => typeof p0[k] === 'number' && k !== 'fails' && p1[k] > p0[k] * 1.15 + 3);
      h.check(`${at}: nothing piles up over ten fails`, grew.length === 0, grew.map((k) => `${k} ${p0[k]}->${p1[k]}`).join(', '));
      await dump('  after');
      const e = await h.err();
      h.check(`${at}: errlog clean`, e === '', e);
    }
  }
}
