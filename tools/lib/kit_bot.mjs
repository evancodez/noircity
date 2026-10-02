// [C1] The kit's test bed (src/scenes/92_kit.js) played by real input, for
// the three proofs (WAVE_C §7): { "drive": "tools/lib/kit_bot.mjs",
// "profile": "idle" | "bad" | "good", "stop": "expr", "timeout": ms }.
//   idle  does nothing (the man walks up to me: the warning, then the fail)
//   bad   a clumsy first-timer: slow to see him and slower to turn (0.7 to
//         1.1 s), a hand that wanders (an error up to 0.075 rad, about a metre
//         at 15 m), fires before the turn has settled two times in five,
//         never steadies with RMB, fires as fast as the gun lets him, presses a
//         wrong key now and then (F, Q, C, E)
//   good  uses what was taught: sees him in 0.3 to 0.55 s, turns onto his
//         chest in a few moves, RMB held to steady, a breath, LMB; reloads
//         (R) when the cylinder is empty
// Ends when `stop` (an expression over N, G) is true or on the timeout.
// Returns { wins, fails, shots, secs, done, warnedBeforeFail }.
export default async function drive({ js, turn, keyDown, keyUp, mouse, log, sleep, W, H, opts, cursor }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 120000;
  const prof = opts.profile || 'good';
  const rr = (a, b) => a + (b - a) * Math.random();
  const cx = W / 2, cy = H / 2;
  const until = opts.stop || 'false';
  let excLogged = false;
  let shots = 0, rmb = false, seenAt = 0, target = null, wrongAt = Date.now() + rr(2000, 4000);
  const ph = [Math.random() * 6, Math.random() * 6];
  // (a press where the cursor stands: anywhere else would turn the view)
  const at = () => (cursor ? cursor() : [cx, cy]);
  const setRmb = async (on) => { if (on !== rmb) { rmb = on; const [x, y] = at(); await mouse(on ? 'mousePressed' : 'mouseReleased', x, y, 'right'); } };
  const click = async () => { const [x, y] = at(); await mouse('mousePressed', x, y, 'left'); await sleep(40); await mouse('mouseReleased', x, y, 'left'); shots++; };
  const tap = async (code) => { await keyDown(code); await sleep(50); await keyUp(code); };
  const ST = `(() => {
    const C = N.controller, e = G.eye, Wp = G.player.weapons.active;
    const out = { done: !!(${until}), yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, failing: !!G.failing, carded: !!G.hud._carded,
      ammo: Wp ? Wp.ammo : 0, reloading: !!(Wp && Wp.reloading), wins: G.kitWins || 0, fails: G.counters.fails || 0, man: null, e: { x: e.x, y: e.y, z: e.z } };
    for (const h of G.stage.hoods.list) {
      if (!h.alive) continue;
      const c = h.bones.chest.getWorldPosition(new N.THREE.Vector3());
      out.man = { id: h.slot, x: c.x, y: c.y, z: c.z };
    }
    return out; })()`;
  for (;;) {
    const s = await js(ST);
    if (!s || s.__exc) { if (s && s.__exc && !excLogged) { excLogged = true; log(`kit_bot: ${String(s.__exc).slice(0, 300)}`); } await sleep(150); if (Date.now() - T0 > timeout) break; continue; }
    if (s.done) { await setRmb(false); const R = await js('({ warned: G.lastFail ? G.lastFail.warnedFor : null })'); return { profile: prof, wins: s.wins, fails: s.fails, shots, secs: +((Date.now() - T0) / 1000).toFixed(1), done: true, lastFailWarnedFor: R && R.warned }; }
    if (Date.now() - T0 > timeout) break;
    if (prof === 'idle' || s.failing || !s.man) { await setRmb(false); target = null; await sleep(120); continue; }
    // (a wrong key now and then: the clumsy hands)
    if (prof === 'bad' && Date.now() > wrongAt) { wrongAt = Date.now() + rr(2500, 5000); await tap(['KeyF', 'KeyQ', 'KeyC', 'KeyE'][Math.floor(Math.random() * 4)]); }
    if (s.ammo <= 0 && !s.reloading) { await setRmb(false); if (prof === 'good') await tap('KeyR'); else { await sleep(rr(400, 900)); await click(); } await sleep(300); continue; }
    if (s.reloading) { await sleep(120); continue; }
    if (target == null || target !== s.man.id) { target = s.man.id; seenAt = Date.now() + (prof === 'good' ? rr(300, 550) : rr(700, 1100)); }
    if (Date.now() < seenAt) { await sleep(40); continue; }
    // the turn onto his chest: most of the way, a settle, a hand's error
    const m = s.man, e = s.e;
    const want = Math.atan2(-(m.x - e.x), -(m.z - e.z)), pt = Math.atan2(m.y - e.y, Math.hypot(m.x - e.x, m.z - e.z));
    const t = (Date.now() - T0) / 1000;
    const err = prof === 'good' ? 0.012 : 0.075;
    const ey = prof === 'good' ? (Math.random() - 0.5) * 2 * err : err * (0.7 * Math.sin(t * 1.4 + ph[0]) + 0.5 * (Math.random() - 0.5));
    const ep = prof === 'good' ? (Math.random() - 0.5) * 2 * err * 0.6 : err * 0.6 * Math.sin(t * 1.9 + ph[1]);
    const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)) + ey, dp = pt - s.pitch + ep;
    const px = Math.round(-dy / s.sens), py = Math.round(-dp / s.sens);
    const n = Math.min(6, Math.max(2, Math.ceil(Math.hypot(px, py) / (prof === 'good' ? 60 : 35))));
    // (the clumsy hand fires before the turn has settled, two times in five)
    const early = prof === 'bad' && Math.random() < 0.4 ? Math.max(1, n - 2) : n;
    for (let i = 0; i < early; i++) { await turn(Math.round(px / n), Math.round(py / n)); await sleep(prof === 'good' ? 16 : 30); }
    if (prof === 'good') {
      const t1 = Date.now();
      await setRmb(true); await sleep(rr(220, 320));
      // (the taught hand tracks him: a second look and a small correction,
      // a hair ahead of where he is going - he runs side to side)
      const s2 = await js(ST);
      if (s2 && !s2.__exc && s2.man && !s2.failing) {
        const m2 = s2.man, dt = Math.max(0.05, (Date.now() - t1) / 1000), lead = 0.12;
        const ax = m2.x + (m2.x - m.x) / dt * lead, az = m2.z + (m2.z - m.z) / dt * lead;
        const w2 = Math.atan2(-(ax - s2.e.x), -(az - s2.e.z)), p2 = Math.atan2(m2.y - s2.e.y, Math.hypot(ax - s2.e.x, az - s2.e.z));
        const d2 = Math.atan2(Math.sin(w2 - s2.yaw), Math.cos(w2 - s2.yaw)) + (Math.random() - 0.5) * 2 * err * 0.5;
        const q2 = p2 - s2.pitch + (Math.random() - 0.5) * err * 0.5;
        await turn(Math.round(-d2 / s2.sens), Math.round(-q2 / s2.sens));
        await sleep(rr(60, 110));
      }
    } else await sleep(rr(40, 120));
    await click();
    await sleep(prof === 'good' ? rr(380, 560) : rr(300, 420));
  }
  await setRmb(false);
  log(`kit_bot ${prof}: timeout`);
  return { profile: prof, shots, secs: +((Date.now() - T0) / 1000).toFixed(1), done: false };
}
