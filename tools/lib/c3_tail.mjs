// Lane C3: chapter VI by real input (tools/play.mjs's module driver: the
// step { "drive": "tools/lib/c3_tail.mjs", "profile": "good", ... }).
// The hands are a player's (src/scenes/tail/bot.js decides each game step
// what a player holds: W / S / A / D / SPACE, RMB, the mouse onto his car,
// LMB); this driver presses and lets go of them by trusted input events,
// E at the pier's gate. Across a fail it waits out the black and takes the
// wheel again at the checkpoint (a first-timer's next try: the bad hands
// learn a little each time). Ends when chapter VII begins, or on `until`,
// or the timeout. Returns the record: the tries (what failed, where), the
// time to each phase, the shots, the damage, the hands' profile.
//   opts: { profile: 'idle'|'bad'|'good', until?, timeout, seed, maxTries,
//           shots: { name: expr } (a screenshot the first time expr holds) }
export default async function tail({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts }) {
  const profile = opts.profile || 'good';
  const timeout = opts.timeout ?? 420000;
  const until = opts.stop || 'false';
  const T0 = Date.now();
  const held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } };
  const cx = W / 2, cy = H / 2;
  let rmb = false, lmbAt = 0, lastE = 0;
  const done = new Set();
  const rec = { profile, tries: [], fails: [], phases: {}, shots: 0, hits: 0, end: null };
  let tries = 0, chaseId = null, lastPhase = null;
  const release = async () => { for (const c of [...held]) await set(c, false); if (rmb) { rmb = false; await mouse('mouseReleased', cx, cy, 'right'); } };
  for (;;) {
    if (await js(until) === true) { rec.end = 'until'; break; }
    if (Date.now() - T0 > timeout) { rec.end = 'timeout'; break; }
    for (const [name, expr] of Object.entries(opts.shots || {})) if (!done.has(name) && await js(expr) === true) { done.add(name); await release(); await shot(name); }
    const s = await js(`(() => { const sc = G.scenes, C = sc.ctx && sc.ctx.flags && sc.ctx.flags.chase;
      if (!sc.current) return { none: true };
      if (sc.current.id !== 'tail') return { scene: sc.current.id };
      if (!C || !C.my) return { none: true };
      if (!C.bot) { const a = (window.__c3tries = (window.__c3tries || 0)); C.useBot(${JSON.stringify(profile)}, { seed: ${opts.seed ?? 7} + a * 13, attempt: a }); window.__c3tries = a + 1; C._botId = Math.random(); }
      const k = C.botKeys || {}, a = C.botAim, gun = C.gun;
      return { id: C._botId, phase: C.phase, beat: sc.beat, fade: sc.fadeK || 0, failing: !!C.failing, k, a, prompt: G.hud.promptShown, sens: N.controller.sensitivity,
        gap: +C.gap().toFixed(1), unseen: +C.unseen.toFixed(1), dmg: +C.my.damage.toFixed(2), shots: gun ? gun.shots : 0, hits: gun ? gun.hits : 0, warn: C.kit.warning, t: +C.t.toFixed(1) }; })()`);
    if (!s || s.__exc) { await sleep(60); continue; }
    if (s.scene && s.scene !== 'tail') { rec.end = 'next:' + s.scene; break; }
    if (s.none || s.failing || s.fade > 0.5) { await release(); await sleep(80); continue; }
    if (s.id !== chaseId) {
      // a new try (the scene's start, or back at a checkpoint after a fail)
      if (chaseId) rec.tries.push({ ended: lastPhase });
      chaseId = s.id; tries++;
      log(`try ${tries}: beat ${s.beat} (${profile})`);
    }
    if (s.phase !== lastPhase) { rec.phases[`${tries}:${s.phase}`] = +((Date.now() - T0) / 1000).toFixed(1); log(`phase ${s.phase} at ${s.t}s (gap ${s.gap}, dmg ${s.dmg})`); lastPhase = s.phase; }
    rec.shots = Math.max(rec.shots, s.shots); rec.hits = Math.max(rec.hits, s.hits);
    const k = s.k || {};
    for (const code of ['W', 'S', 'A', 'D']) await set('Key' + code, !!k[code]);
    await set('Space', !!k.Space);
    // the gun
    const a = s.a;
    if (a && a.rmb && !rmb) { rmb = true; await mouse('mousePressed', cx, cy, 'right'); }
    else if ((!a || !a.rmb) && rmb) { rmb = false; await mouse('mouseReleased', cx, cy, 'right'); }
    if (a && a.rmb && (Math.abs(a.dyaw) > 0.002 || Math.abs(a.dpitch) > 0.002)) {
      const px = Math.round(Math.max(-70, Math.min(70, a.dyaw * 0.8 / s.sens))), py = Math.round(Math.max(-50, Math.min(50, -a.dpitch * 0.8 / s.sens)));
      if (px || py) await turn(px, py);
    }
    if (a && a.fire && Date.now() - lmbAt > 250) { lmbAt = Date.now(); await mouse('mousePressed', cx, cy, 'left'); await sleep(40); await mouse('mouseReleased', cx, cy, 'left'); }
    // the pier: E to get out
    if (/get out/.test(s.prompt || '') && Date.now() - lastE > 1500) { lastE = Date.now(); await release(); await sleep(350); await keyDown('KeyE'); await sleep(70); await keyUp('KeyE'); }
    await sleep(30);
  }
  await release();
  rec.tries.push({ ended: lastPhase });
  rec.fails = await js('(window.__tailFails || []).slice()');
  rec.secs = +((Date.now() - T0) / 1000).toFixed(1);
  return rec;
}
