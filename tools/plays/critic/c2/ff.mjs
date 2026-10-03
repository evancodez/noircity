// C2 critic: do their rounds hit each other in play (the 2.2x of Guns.js
// hoodRound)? A wrapper on game.damageHood (observation only: it calls the
// original) counts the calls that come from a gunman's round; the player
// plays with the hands of opts.style (or none: idle) for opts.dur.
export default async function ({ js, sleep, log, send, mouse, opts }) {
  const PORT = process.env.NOIR_PORT || 5173;
  const out = {};
  for (const b of opts.beats || ['pin', 'street']) {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?mute=1&start=guns.${b}` });
    await sleep(800);
    for (let k = 0; k < 100; k++) { if (await js('!!window.__noirReady') === true) break; await sleep(200); }
    await sleep(1500);
    for (let k = 0; k < 4; k++) {
      const r = await js(`(() => { const e = document.querySelector('#title .opt[data-k=begin]'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      if (r) { await mouse('mousePressed', r[0], r[1]); await sleep(40); await mouse('mouseReleased', r[0], r[1]); }
      let ok = false;
      for (let w = 0; w < 14 && !ok; w++) { await sleep(250); ok = await js(`G.state === 'playing' && G.scenes.beat === '${b}'`) === true; }
      if (ok) break;
    }
    await js(`(() => { const G0 = G; if (G0._ffWrapped) return 1; const f = G0.damageHood.bind(G0); window.__ff = []; G0._ffWrapped = true;
      G0.damageHood = (h, dmg, dir, o) => { const st = new Error().stack; if (/hoodRound/.test(st)) window.__ff.push({ t: +G0.time.toFixed(1), dmg: Math.round(dmg), alive: h.alive, hp: Math.round(h.hp ?? -1), kind: h.gunKind }); return f(h, dmg, dir, o); }; return 1; })()`);
    await sleep(opts.dur ?? 20000);
    const r = await js(`({ ff: window.__ff, dead: G.stage.hoods.list.filter((h) => !h.alive).map((h) => h.gunKind), fails: G.fails() })`);
    out[b] = r;
    log(`${b}: ${JSON.stringify(r)}`);
  }
  return out;
}
