// C2 after the critic's second look: the critic's idle driver (critic/c2/idle_all.mjs), and
// opts.stand: up out of the crouch the beat starts in (C once), then hands off - standing
// still in the open. Adds per beat: downIn (the first round to the fall) and wordFirst (the
// first warning's lead over the first round, s; + is before it).
// (the critic's header:) the idle proof of every contest of the test bed, each from the
// title (?start=guns.<beat>, BEGIN clicked), hands off - or W held (opts.hold).
// For each: when the first hit lands, the warning's words and how long it was
// up before the fall, the fall's words, the time to the fall; frames at the
// first hit, the warning and the fall's black.
export default async function ({ js, keyDown, keyUp, mouse, shot, log, sleep, send, opts }) {
  const PORT = process.env.NOIR_PORT || 5173;
  const beats = opts.beats || ['door', 'two_ways', 'pin', 'rush', 'street', 'street_rev'];
  const dur = opts.dur ?? 40000;
  const out = {};
  for (const b of beats) {
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?mute=1${opts.query || ''}&start=guns.${b}` });
    await sleep(800);
    for (let k = 0; k < 100; k++) { if (await js('!!window.__noirReady') === true) break; await sleep(200); }
    await sleep(1500);
    for (let k = 0; k < 4; k++) {
      const r = await js(`(() => { const e = document.querySelector('#title .opt[data-k=begin]'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      if (r) { await mouse('mousePressed', r[0], r[1]); await sleep(40); await mouse('mouseReleased', r[0], r[1]); }
      let ok = false;
      for (let w = 0; w < 14 && !ok; w++) { await sleep(250); ok = await js(`G.state === 'playing' && !!G.scenes.current && G.scenes.beat === '${b}'`) === true; }
      if (ok) break;
    }
    const T0 = Date.now();
    if (opts.stand && await js('!!N.controller.crouchOn') === true) { await keyDown('KeyC'); await sleep(60); await keyUp('KeyC'); }
    if (opts.hold) await keyDown(opts.hold);
    const R = { firstHit: null, warns: [], fall: null, fallAt: null, hits: 0, men: [] };
    let hp0 = 100, lastWarn = null, warnAt = null, shotHit = false, shotWarn = false;
    const t0 = await js('G.time');
    while (Date.now() - T0 < dur) {
      const s = await js(`(() => { const K = G.hud.kit, H = G.health; const men = G.stage.hoods.list.filter((h) => h.alive);
        return { t: G.time, hp: H.hp, warn: K.warnText, fail: G.failing ? G.failing.why : null, fails: G.fails(), beat: G.scenes.beat,
          men: men.map((h) => [h.kind || h.opts && h.opts.kind || '', +h.pos.x.toFixed(1), +h.pos.z.toFixed(1)]) }; })()`);
      if (!s || s.__exc) { await sleep(300); continue; }
      const t = +(s.t - t0).toFixed(1);
      if (s.hp < hp0 - 0.5 && !s.fail) { R.hits++; if (R.firstHit == null) { R.firstHit = t; if (!shotHit) { shotHit = true; await shot(`${b}_hit1`); } } }
      hp0 = s.hp;
      if (s.warn !== lastWarn) { if (s.warn) { R.warns.push(`${t}s hp${Math.round(s.hp)} "${s.warn}"`); warnAt = t; if (R.firstWarn == null) R.firstWarn = t; if (!shotWarn) { shotWarn = true; await shot(`${b}_warn`); } } lastWarn = s.warn; }
      if (s.fail && R.fall == null) { R.fall = s.fail; R.fallAt = t; R.warnedFor = warnAt != null ? +(t - warnAt).toFixed(1) : null; R.downIn = R.firstHit != null ? +(t - R.firstHit).toFixed(1) : null; R.wordFirst = R.firstHit != null && R.firstWarn != null ? +(R.firstHit - R.firstWarn).toFixed(1) : null; await shot(`${b}_fall`); break; }
      await sleep(100);
    }
    if (opts.hold) await keyUp(opts.hold);
    const last = await js(`({ pos: [N.controller.pos.x, N.controller.pos.z].map((v) => +v.toFixed(2)), lastFail: G.lastFail })`);
    out[b] = { ...R, end: last };
    // (opts.rec: the men's brains through the fight, every quarter second - ?c2rec=1 in opts.query)
    if (opts.rec) { const rec = await js(`(window.__c2rec || []).filter((r, i, a) => i === 0 || Math.floor(r[0] * 4) !== Math.floor(a[i - 1][0] * 4)).map((r) => r.join(' '))`); log(`${b} rec:\n` + (Array.isArray(rec) ? rec.join('\n') : JSON.stringify(rec))); const ev = await js(`G.guns.events.filter((e) => e.what !== 'miss').slice(-60).map((e) => JSON.stringify(e))`); log(`${b} events:\n` + (Array.isArray(ev) ? ev.join('\n') : JSON.stringify(ev))); }
    log(`${b}: ${JSON.stringify(out[b])}`);
    await sleep(1200);
    await shot(`${b}_black`);
  }
  return out;
}
