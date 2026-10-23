// [O1c critic] a player's approach, not the bot's setup: stand ~3.5 m off a thing
// facing it, hold W and swing LMB every 350 ms from the start (a first-timer
// swings early), until the street answers or 3.5 s pass; then let go and watch.
// Per target: presses whiffed before the land, the press->swing latency of each,
// whether the walk was stopped by it, what it did after the settle.
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../../lib/o1c_fist.mjs', import.meta.url), 'utf8');
const HELPERS = src.slice(src.indexOf('const HELPERS = `') + 17, src.indexOf('})()`;') + 4);
export default async function ({ js, keyDown, keyUp, mouse, sleep, log, opts, cursor, shot }) {
  await js(HELPERS);
  await js(`(window.__lat = [], document.addEventListener('mousedown', () => { window.__d0 = performance.now(); }, true), G.on('city:swing', () => { if (window.__d0) window.__lat.push(+(performance.now() - window.__d0).toFixed(1)); window.__d0 = null; }), 1)`);
  const out = [];
  for (const T of opts.targets) {
    if (T.waitFind) for (let k = 0; k < T.waitFind && !(await js(`!!(${T.find})`)); k++) await sleep(1000);
    const tg = await js(`(() => { const t = ${T.find}; if (!t) return null; window.__t = t; const it = t.it || null;
      const r = it ? (it.K.round ? it.K.r : Math.max(it.fp ? Math.min(it.fp.hx, it.fp.hz) : 0.3, 0.2)) : (t.r || 0.3);
      const st = t.stand || window.__standBy(t.x, t.z, r, 0.75); if (!st) return null;
      G.stage.part('stream').warmAround(st[0], st[1]);
      const ax = t.x - st[0], az = t.z - st[1], al = Math.hypot(ax, az) || 1, back = ${T.back ?? 2.8};
      const bx = st[0] - ax / al * back, bz = st[1] - az / al * back;
      N.controller.setPose(bx, bz, Math.atan2(-ax, -az), ${T.pitch ?? -0.1});
      window.__fl0 = window.__fistLog.length; window.__ev0 = G.stage.smash.events.length; window.__cr0 = G.crime ? G.crime.log.length : 0; window.__lat.length = 0;
      return { kind: it ? it.kind : t.kind, x: +t.x.toFixed(1), z: +t.z.toFixed(1) }; })()`);
    if (!tg) { log(`  ${T.name}: not found`); continue; }
    await sleep(400);
    await keyDown('KeyW');
    if (T.kick) await keyDown('KeyC');
    const [cx, cy] = cursor();
    let presses = 0, landedAt = null; const t0 = Date.now();
    while (Date.now() - t0 < 3500) {
      await mouse('mousePressed', cx, cy, 'left'); await sleep(50); await mouse('mouseReleased', cx, cy, 'left'); presses++;
      await sleep(300);
      const n = await js(`window.__fistLog.slice(window.__fl0).filter((e) => e.thing).length`);
      if (n > 0) { landedAt = Date.now() - t0; break; }
    }
    await keyUp('KeyW'); if (T.kick) await keyUp('KeyC');
    if (T.burst) { let t = 0; for (const ms of T.burst) { await sleep(Math.max(0, ms - t)); t = ms; await shot(T.name.replace(/\W+/g, '_') + '_' + ms); } }
    if (T.shot) { await sleep(250); await shot(T.shot); }
    await sleep(T.settle ?? 3000);
    if (T.shot2) { await keyDown('KeyS'); await sleep(900); await keyUp('KeyS'); await sleep(300); log('  rest at ' + await js(`JSON.stringify({P: window.__t.it ? [+window.__t.it.P.x.toFixed(2), +window.__t.it.P.y.toFixed(2), +window.__t.it.P.z.toFixed(2)] : null, me: [+N.controller.pos.x.toFixed(2), +N.controller.pos.z.toFixed(2)]})`)); await js(`(() => { const t = window.__t, it = t.it; const p = it ? it.P : { x: t.x, z: t.z }; const e = G.eye; N.controller.yaw = Math.atan2(-(p.x - e.x), -(p.z - e.z)); N.controller.pitch = -Math.atan2(1.6, Math.hypot(p.x - e.x, p.z - e.z)); return 1; })()`); await sleep(300); await shot(T.shot2); }
    const r = await js(`(() => { const t = window.__t, it = t.it || null, S = G.stage.smash;
      const fl = window.__fistLog.slice(window.__fl0).map((e) => (e.thing || 'whiff') + (e.how ? ':' + e.how : '') + (e.hurt ? ':hurt' : '') + (e.kick ? ':kick' : ''));
      const ev = S.events.slice(window.__ev0).filter((e) => !it || e.id === it.id).map((e) => e.what + ':' + e.by);
      const cr = G.crime ? G.crime.log.slice(window.__cr0).map((c) => c.kind + (c.seen ? '@' + c.seen : '')) : [];
      const gap = Math.hypot(N.controller.pos.x - t.x, N.controller.pos.z - t.z);
      return { fl, ev, cr, state: it ? it.state : null, rest: it && it.state !== 'stand' && !it.gone ? window.__rest(it) : null, lat: window.__lat.slice(), gap: +gap.toFixed(2), mode: N.controller.mode, heat: G.police ? G.police.heat : null }; })()`);
    log(`  ${T.name} (${tg.kind} ${tg.x},${tg.z}): presses ${presses}, landed at ${landedAt} ms; fist [${r.fl.join(' ')}] set [${r.ev.join(' ')}] ${r.state || ''} rest ${r.rest} crimes [${r.cr.join(',')}] lat ${JSON.stringify(r.lat)} end gap ${r.gap} mode ${r.mode} heat ${r.heat}`);
    out.push({ name: T.name, presses, landedAt, ...r });
  }
  return { out };
}
