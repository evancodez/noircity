// C2 critic: a film of a moment in slow time (the page at ?speed=<k>), the
// hands off: from when `from` (an expression) is first true, a frame every
// `every` real ms, n frames; each frame logged with the game time, health,
// the warning and the men's states. Used for the tell (the gun coming up
// before the first round), an entry through a door, a death.
export default async function ({ js, shot, log, sleep, mouse, send, opts }) {
  const PORT = process.env.NOIR_PORT || 5173;
  if (opts.url) {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${opts.url}` });
    await sleep(800);
    for (let k = 0; k < 100; k++) { if (await js('!!window.__noirReady') === true) break; await sleep(200); }
    await sleep(1500);
    for (let k = 0; k < 4; k++) {
      const r = await js(`(() => { const e = document.querySelector('#title .opt[data-k=begin]'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      if (r) { await mouse('mousePressed', r[0], r[1]); await sleep(40); await mouse('mouseReleased', r[0], r[1]); }
      let ok = false;
      for (let w = 0; w < 14 && !ok; w++) { await sleep(250); ok = await js(`G.state === 'playing' && !!G.scenes.current`) === true; }
      if (ok) break;
    }
  }
  if (opts.before) for (const e of opts.before) await js(e);
  const T = Date.now() + (opts.timeout ?? 60000);
  while (Date.now() < T) { if (await js(opts.from) === true) break; await sleep(40); }
  const S = `(() => ({ t: +G.time.toFixed(2), hp: Math.round(G.health.hp), warn: G.hud.kit.warnText,
    men: [...G.ais.values()].map((a) => a.brain.kind + ':' + a.brain.S.state + (a.brain.S.line ? 'L' : '') + ' r' + (a.brain.S.raiseT || 0).toFixed(2) + ' s' + (a.brain.S.settle || 0).toFixed(2) + ' @' + a.h.pos.x.toFixed(1) + ',' + a.h.pos.z.toFixed(1) + (a.h.alive ? '' : ' DEAD ' + a.h.state)) }))()`;
  for (let i = 0; i < (opts.n ?? 8); i++) {
    log(`f${i}: ${JSON.stringify(await js(S))}`);
    await shot(`${opts.tag || 'f'}${String(i).padStart(2, '0')}`);
    await sleep(opts.every ?? 250);
  }
  return null;
}
