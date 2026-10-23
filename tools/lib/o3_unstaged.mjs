// [O3] after the critic (M1): unstaged crimes on Grand Avenue, by real input,
// `tries` times in a row (each ending in the arrest, or after `secs`, and the
// next from where I woke): the nearest walker punched down, or the gun drawn
// (RMB) among the walkers and two shots - then hands off, standing at the place.
//   { "drive": "tools/lib/o3_unstaged.mjs", "mode": "punch" | "shoot", "tries": 3, "secs": 90 }
// Per try: when the city first answered with something a player sees or hears
// (a witness going to tell it, a whistle, a patrol car), when the heat came,
// whether it ever went back to 0 while I stood there unfound, how it ended.
const SENS = 0.0021;
const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(js, expr, ms, every = 100) { const T = Date.now() + ms; while (Date.now() < T) { if ((await js(expr)) === true) return true; await sleepP(every); } return false; }
async function turnTo(api, x, z, pitch = -0.1) {
  const s = await api.js(`({ x: G.eye.x, z: G.eye.z, yaw: G.controller.yaw, pitch: G.controller.pitch })`);
  const want = Math.atan2(-(x - s.x), -(z - s.z));
  const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
  const dx = Math.round(-dy / SENS), dp = Math.round(-(pitch - s.pitch) / SENS);
  for (let i = 0; i < 6; i++) { await api.turn(Math.round(dx / 6), Math.round(dp / 6)); await sleepP(16); }
}
async function chase(api, near, ms) {
  const { js, keyDown, keyUp, turn } = api;
  const T = Date.now() + ms; let ok = false, lastP = null, lastT = 0, side = 1;
  await keyDown('KeyW');
  while (Date.now() < T) {
    const s = await js(`(() => { const p = window.__u; if (!p || !p.standing) return null; return { x: G.eye.x, z: G.eye.z, yaw: G.controller.yaw, px: p.pos.x, pz: p.pos.z }; })()`);
    if (!s || s.__exc) break;
    if (Math.hypot(s.px - s.x, s.pz - s.z) < near) { ok = true; break; }
    const want = Math.atan2(-(s.px - s.x), -(s.pz - s.z));
    const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    await turn(Math.round(-dy * 0.6 / SENS), 0);
    const now = Date.now();
    if (!lastP || now - lastT > 600) {
      if (lastP && Math.hypot(s.x - lastP[0], s.z - lastP[1]) < 0.3) { const k = (side = -side) > 0 ? 'KeyD' : 'KeyA'; await keyDown(k); await sleepP(350); await keyUp(k); }
      lastP = [s.x, s.z]; lastT = now;
    }
    await sleepP(60);
  }
  await keyUp('KeyW');
  return ok;
}
async function click(api, button = 'left', ms = 70) { const [x, y] = api.cursor(); await api.mouse('mousePressed', x, y, button); await sleepP(ms); await api.mouse('mouseReleased', x, y, button); }

export default async function unstaged(api) {
  const { js, opts, log, shot } = api;
  const mode = opts.mode || 'punch', n = opts.tries || 3, secs = opts.secs || 90;
  const R = { mode, tries: [] };
  for (let k = 0; k < n; k++) {
    await waitFor(js, '!G.failing && G.state === "playing" && G.scenes.fadeK < 0.05 && G.police.heat === 0', 30000);
    const fails0 = await js('G.counters.arrests || 0'), beat0 = await js('G.scenes.beat');
    // (the street fills round me as it does: at least 8 walkers)
    await waitFor(js, `G.people.list.filter(p => p.role === 'walker' && p.standing).length >= 8`, 30000);
    // (one I can walk to: in my line of sight on the pavements, within 30 m)
    await waitFor(js, `G.people.list.some(p => p.role === 'walker' && p.standing && p.mode !== 'report' && Math.hypot(p.pos.x - G.eye.x, p.pos.z - G.eye.z) < 30 && G.people.graph.lineOfSight(G.eye.x, G.eye.z, p.pos.x, p.pos.z))`, 40000, 250);
    await sleepP(1500);
    const T = { k, at: await js('[+G.eye.x.toFixed(0), +G.eye.z.toFixed(0)]') };
    await js(`(() => { let b = null, bd = 1e9; for (const p of G.people.list) { if (p.role !== 'walker' || !p.standing || p.mode === 'report') continue; const d = Math.hypot(p.pos.x - G.eye.x, p.pos.z - G.eye.z) + (G.people.graph.lineOfSight(G.eye.x, G.eye.z, p.pos.x, p.pos.z) ? 0 : 1000); if (d < bd) { bd = d; b = p; } } window.__u = b; return b ? +bd.toFixed(1) : null; })()`);
    T.near = await js('window.__u ? +Math.hypot(window.__u.pos.x - G.eye.x, window.__u.pos.z - G.eye.z).toFixed(1) : null');
    const ev0 = await js('G.police.events.length'), cr0 = await js('G.crime.n');
    if (mode === 'punch') {
      await chase(api, 1.5, 30000);
      for (let i = 0; i < 6; i++) {
        const q = await js('window.__u ? [window.__u.pos.x, window.__u.pos.z, window.__u.down, Math.hypot(window.__u.pos.x - G.eye.x, window.__u.pos.z - G.eye.z)] : null');
        if (!q || q[2]) break;
        if (q[3] > 1.8) await chase(api, 1.3, 3000);
        await turnTo(api, q[0], q[1]); await click(api); await sleepP(380);
      }
    } else {
      // (the station kept the gun: the only staging - a gun found again, as a man down gives one)
      T.gunGiven = await js('G.people.hands.hasGun ? false : (G.people.hands.hasGun = true, true)');
      await chase(api, 8, 20000);
      await click(api, 'right', 600);
      T.fled = await js(`G.people.list.filter(p => p.role === 'walker' && p.mode === 'flee').length + '/' + G.people.list.filter(p => p.role === 'walker').length`);
      await sleepP(800);
      await api.turn(0, -200); await sleepP(100);
      const [x, y] = api.cursor();
      await api.mouse('mousePressed', x, y, 'right'); await sleepP(400); await click(api); await sleepP(500); await click(api); await api.mouse('mouseReleased', x, y, 'right');
    }
    const t0 = await js('G.time');
    T.crime = await js(`G.crime.log.filter(r => r.id > ${cr0}).map(r => r.kind + ':' + (r.seen || '-') + (r.heard ? ':heard' : '') + ':' + r.reporters)`);
    if (opts.shots && k === 0) await shot(`${mode}_after`);
    // hands off, at the place: what comes, and when
    let seenAt = null, heatAt = null, dropped = false, maxHeat = 0, end = 'time', firstSeen = null;
    const tEnd = Date.now() + secs * 1000;
    while (Date.now() < tEnd) {
      const s = await js(`({ t: G.time, heat: G.police.heat, st: G.police.state, fail: G.failing ? G.failing.phase : null, beat: G.scenes.beat, warn: G.hud.warnText,
        going: G.people.list.filter(p => p.mode === 'report' && p.phase === 'go').length, ev: G.police.events.slice(${ev0}).filter(e => ['seen', 'heard', 'report', 'car', 'send', 'handsup', 'arrest', 'clear', 'found'].includes(e.what)).map(e => e.what + '@' + (e.t - ${t0}).toFixed(1)), cars: G.police.cars.length,
        stopped: G.people.stats.stopped, rep: G.people.list.filter(p => p.mode === 'report').map(p => [p.phase, p.reportTo && p.reportTo.box ? 'box' : 'cop', +(p.reportTo && p.reportTo.box ? Math.hypot(p.reportTo.box.x - p.pos.x, p.reportTo.box.z - p.pos.z) : p.reportTo && p.reportTo.cop ? Math.hypot(p.reportTo.cop.pos.x - p.pos.x, p.reportTo.cop.pos.z - p.pos.z) : -1).toFixed(0), p.path ? p.path.length + '/' + p.pi : '-', p.stuckN || 0, p.gaitNow, +p.t.toFixed(0)]) })`);
      if (opts.trace && s.rep && s.rep.length && Date.now() % 3000 < 260) log(`  rep ${+(s.t - t0).toFixed(1)} ${JSON.stringify(s.rep)} heat ${s.heat}`);
      if (!s || s.__exc) { await sleepP(250); continue; }
      const dt = +(s.t - t0).toFixed(1);
      if (seenAt == null && (s.going || s.ev.some((e) => /^(seen|heard|car|send)@/.test(e)))) { seenAt = dt; firstSeen = s.going ? 'a witness going' : s.ev.find((e) => /^(seen|heard|car|send)@/.test(e)); }
      if (heatAt == null && s.heat > 0) heatAt = dt;
      maxHeat = Math.max(maxHeat, s.heat);
      if (heatAt != null && s.heat === 0 && !s.fail) { dropped = true; }
      if (s.fail) { end = s.ev.some((e) => e.startsWith('arrest@')) || (await js('G.counters.arrests || 0')) > fails0 ? 'arrested' : 'fail'; T.events = s.ev; break; }
      T.events = s.ev; T.stopped = s.stopped;
      await sleepP(250);
    }
    Object.assign(T, { seenAt, firstSeen, heatAt, maxHeat, droppedWhileThere: dropped, end });
    T.lastFail = await js('G.lastFail ? G.lastFail.why : null');
    R.tries.push(T);
    log(`unstaged ${mode} ${k}: ${JSON.stringify(T)}`);
    await waitFor(js, '!G.failing', 20000);
    await sleepP(2500);
  }
  R.answered = R.tries.filter((t) => t.seenAt != null && t.seenAt <= 12 && t.heatAt != null && !t.droppedWhileThere).length;
  return R;
}
