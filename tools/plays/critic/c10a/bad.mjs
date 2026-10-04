// [C10a critic] playing badly by real input: (1) ten real deaths in a row at IV's flank, hands off
// (no G.fail by eval): the why and the warning each time, and what piles up; (2) the wrong keys in the
// modes the hunts do not mash with a card up (a held teach card, a puzzle open, the car), ESC and back
// in each; (3) the pointer lock lost in a held teach card's crawl and in the brawl's dodge cue.
//   NOIR_PORT=5350 node tools/hunt.mjs tools/plays/critic/c10a/bad.mjs   (PART=1|2|3)
import { wrap, AFTER } from './lib.mjs';
const part = process.env.PART ? +process.env.PART : 0;
const PILE = `(() => { let n = 0; N.scene.traverse(() => n++); const I = N.renderer.info; return JSON.stringify({ objs: n, geo: I.memory.geometries, tex: I.memory.textures, progs: I.programs ? I.programs.length : -1, hoods: G.world.hoods.list.length, ais: G.ais.size, corpses: G.corpses.length, inter: G.interact.list.length, veh: G.vehicles.list.length }); })()`;
export default async function (h0) {
  const h = wrap(h0);
  if (!part || part === 1) {
    for (const at of ['gunfight.flank', 'warehouse.loud']) {
      h.log(`=== 1: ten real deaths at ${at}, hands off`);
      await h.open(`/?mute=1&start=${at}`); await h.begin(); await h.wait(3000);
      const p0 = await h.js(PILE); h.log('  pile 0 ' + p0);
      let deaths = 0; const T = Date.now() + 360000;
      while (deaths < 10 && Date.now() < T) {
        const went = await h.until('!!G.failing', 70000, 200);
        if (!went) { h.log('  no death in 70 s hands off: ' + await h.snap()); break; }
        deaths++;
        h.log(`  death ${deaths}: ${await h.js('JSON.stringify(G.lastFail)')}`);
        await h.until('!G.failing && G.state === "playing"', 15000);
        if (deaths === 1 || deaths === 10) await h.shot(`bad1_${at}_${deaths}`);
      }
      const p1 = await h.js(PILE); h.log('  pile ' + deaths + ' ' + p1);
      h.check(`${at}: hands off dies (${deaths} in a row)`, deaths >= 3);
      const e = await h.err(); h.check(`${at}: errlog clean`, e === '', e);
    }
  }
  if (!part || part === 2) {
    h.log('=== 2: the wrong keys with a puzzle open (III safe), ESC in it');
    await h.open('/?mute=1&start=office.safe'); await h.begin(); await h.wait(3000);
    h.log('  ' + await h.snap());
    for (let k = 0; k < 10 && !(await h.js('!!G.puzzles.active')); k++) { await h.look(90, 0, 4); await h.wait(150); if (/dial|safe|open/.test(await h.js('G.hud.promptShown || ""'))) { await h.key('KeyE'); await h.wait(800); } }
    h.log('  puzzle? ' + await h.snap());
    await h.mash(3000, { look: true }); await h.releaseAll(); await h.wait(500); h.log('  after mash ' + await h.snap());
    await h.key('Escape'); await h.wait(600); h.log('  after Escape key ' + await h.snap());
    await h.pause(); await h.wait(500); h.log('  lock lost ' + await h.snap());
    h.check('2: resume from the puzzle', await h.resume()); await h.wait(600); h.log('  resumed ' + await h.snap());
    const e = await h.err(); h.check('2: errlog clean', e === '', e);

    h.log('=== 2b: the car: every wrong key at speed, ESC, the lock lost, resume');
    await h.open('/?mute=1&start=tail'); await h.begin(); await h.wait(3500);
    await h.down('KeyW'); await h.wait(2500);
    for (const k of ['Space', 'KeyC', 'KeyR', 'KeyF', 'KeyQ', 'KeyE', 'ShiftLeft', 'ControlLeft', 'KeyM', 'Tab']) { await h.key(k, 200); await h.wait(150); }
    await h.click('left'); await h.click('right', 400);
    h.log('  ' + await h.js(AFTER));
    await h.up('KeyW');
    await h.pause(); await h.wait(1500); const t0 = await h.js('N.time'); await h.wait(1000);
    h.check('2b: paused in the car: the clock held', Math.abs((await h.js('N.time')) - t0) < 0.05);
    h.check('2b: resume', await h.resume()); await h.wait(1500); h.log('  ' + await h.snap());
    const e2 = await h.err(); h.check('2b: errlog clean', e2 === '', e2);
  }
  if (!part || part === 3) {
    h.log('=== 3: the lock lost under a held teach card (V: the first vault, time crawling)');
    await h.open('/?mute=1&start=watcher.alley'); await h.begin();
    const held = await h.until('G.crawl < 0.5', 25000, 100);
    h.log('  held card? ' + held + ' ' + await h.snap() + ' crawl=' + await h.js('G.crawl'));
    if (held) {
      await h.pause(); await h.wait(3000);
      h.log('  paused ' + await h.snap() + ' crawl=' + await h.js('G.crawl'));
      await h.resume(); await h.wait(300);
      h.log('  resumed ' + await h.snap() + ' crawl=' + await h.js('G.crawl'));
      await h.key('Space'); await h.wait(1500);
      h.log('  after SPACE ' + await h.snap() + ' crawl=' + await h.js('G.crawl'));
    }
    h.log('=== 3b: the lock lost in the brawl dodge cue (II round 1)');
    await h.open('/?mute=1&start=fight.round1'); await h.begin();
    const cue = await h.until('G.timeScale < 0.9', 40000, 50);
    h.log('  cue? ' + cue + ' ts=' + await h.js('G.timeScale'));
    if (cue) {
      await h.pause(); await h.wait(2500); h.log('  paused ts=' + await h.js('G.timeScale') + ' ' + await h.snap());
      await h.resume(); await h.wait(100); h.log('  resumed ts=' + await h.js('G.timeScale'));
      await h.key('KeyA', 120); await h.wait(1500); h.log('  after A ' + await h.snap() + ' ts=' + await h.js('G.timeScale'));
    }
    const e = await h.err(); h.check('3: errlog clean', e === '', e);
  }
}
