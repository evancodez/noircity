// [C10a] VI hands off at the kerb, in real time: when the beat moves, what is saved, the warning, the fail.
//   HUNT_AT=tail.start HUNT_SECS=70 NOIR_PORT=5350 node tools/hunt.mjs tools/hunts/tailidle.mjs
export default async function (h) {
  const at = process.env.HUNT_AT || 'tail.start';
  const secs = +(process.env.HUNT_SECS || 70);
  await h.open(`/?mute=1&start=${at}`);
  h.check('begun', await h.begin());
  await h.js(`(window.__ev = [], G.on('scene:beat', (e) => window.__ev.push([+N.time.toFixed(1), e.beat, JSON.parse(localStorage.getItem('noir.save')).beat])), G.on('fail', (e) => window.__ev.push([+N.time.toFixed(1), 'FAIL ' + e.why + ' -> ' + e.to])), 1)`);
  let last = '';
  for (let k = 0; k < secs; k++) {
    await h.wait(1000);
    const s = await h.js(`JSON.stringify({ beat: G.scenes.beat, phase: G.scenes.ctx && G.scenes.ctx.flags.chase && G.scenes.ctx.flags.chase.phase, leg: G.scenes.ctx && G.scenes.ctx.flags.chase && G.scenes.ctx.flags.chase.driver.legIndex, warn: G.hud.kit.warnText, failing: G.failing && G.failing.phase, save: JSON.parse(localStorage.getItem('noir.save')).beat })`);
    if (s !== last) { h.log(`${k}s ${s}`); last = s; }
  }
  h.log('events ' + JSON.stringify(await h.js('window.__ev')));
}
