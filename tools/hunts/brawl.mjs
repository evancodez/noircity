// [C10a] the fist fights played badly: ESC in the dodge cue's slow world and back; ten downs in a row
// (health to nothing in the brawl: the fight's own down, not the kit's fail) - does anything pile up,
// does the slow world or a frozen control outlive it.
//   HUNT_AT=fight.round1 NOIR_PORT=5350 node tools/hunt.mjs tools/hunts/brawl.mjs
const PILE = `(() => { let n = 0; N.scene.traverse(() => n++); const I = N.renderer.info.memory; return { objs: n, geo: I.geometries, tex: I.textures, ts: G.timeScale, wk: G.worldK, crawl: G.crawl, frozen: N.controller.frozen, mode: N.controller.mode, brawl: G.brawl.active, beat: G.scenes.beat, downs: G.brawl.stats ? G.brawl.stats.downs : null, warn: G.hud.kit.warnText, hp: Math.round(G.health.hp) }; })()`;
export default async function (h) {
  const at = process.env.HUNT_AT || 'fight.round1';
  await h.open(`/?mute=1&start=${at}`);
  h.check(`${at}: begun`, await h.begin());
  await h.wait(3500);
  // the cue: wait for the slow world, ESC in it, wait, back
  const slow = await h.until('G.worldK < 0.9', 40000, 50);
  h.log('slow world: ' + slow + ' ' + JSON.stringify(await h.js(PILE)));
  if (slow) {
    await h.pause(); await h.wait(1500);
    const p = await h.js(PILE);
    h.log('paused in the cue: ' + JSON.stringify(p));
    h.check('resume in the cue', await h.resume());
    // (the first cue of a save is the dodge's held teach card: time crawls until A or D, at most 6 s real)
    for (let k = 0; k < 9; k++) { await h.wait(1000); h.log('  ' + JSON.stringify(await h.js(`({ wk: G.worldK, crawl: G.crawl, teach: G.hud.kit.teachCur && G.hud.kit.teachCur.id, cue: !!G.brawl.cue })`))); }
    const q = await h.js(PILE);
    h.check('the world comes back to speed after the cue', q.wk === 1 || q.brawl === false, q);
  }
  const p0 = await h.js(PILE);
  h.log('pile 0 ' + JSON.stringify(p0));
  for (let k = 0; k < 10; k++) {
    await h.js('(G.health.damage(1000), 1)');
    await h.wait(300);
    // back on his feet and fighting
    const up = await h.until('G.brawl.active && !N.controller.frozen && G.health.hp > 50 && G.timeScale === 1 && G.worldK === 1', 15000);
    if (!up) { h.check(`down ${k + 1}: back up`, false, await h.js(PILE)); break; }
    await h.wait(800);
  }
  const p1 = await h.js(PILE);
  h.log('pile 10 ' + JSON.stringify(p1));
  h.check('nothing piles over ten downs', p1.objs <= p0.objs * 1.1 + 5 && p1.geo <= p0.geo * 1.1 + 5 && p1.tex <= p0.tex + 5, { p0, p1 });
  h.check('errlog clean', (await h.err()) === '', await h.err());
}
