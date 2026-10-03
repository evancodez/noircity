// [C6] Chapter V's foot chase played by real input (tools/play.mjs drive), for
// the proofs of WAVE_C §7: { "drive": "tools/lib/c6_chase.mjs", "profile":
// "idle" | "w" | "bad" | "good", "over": "roofs" | "row", "stop": "expr",
// "timeout": ms, "seed": n }.
//   idle  touches nothing
//   w     holds W and steers with the mouse, never presses SPACE, C or E
//   bad   a clumsy first-timer: sees a thing late (0.25 .. 0.45 s), presses
//         its key with a wide error, half the time out of the window (too
//         early, too late, or not at all), now and then the wrong key or W let
//         go for a moment; picks a lane of the yard at random (and, in the
//         wrong one, finds its door locked and goes back round)
//   good  uses what was taught: SPACE / C a quarter second before each thing,
//         reads which lane he took, takes `over` at the fork
// Steering: the mouse turns him onto the next point of his line (the course's
// nodes for his choices, scenes/watcher/course.js), W held.
// Ends when `stop` is true or on the timeout. Returns { profile, fails,
// warned, met: [[thing, how]], lost: [stretch], secs, done, ... }.
export default async function drive({ js, turn, keyDown, keyUp, log, sleep, opts, shot }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 240000;
  const prof = opts.profile || 'good';
  let seed = opts.seed ?? Math.floor(Math.random() * 1e6);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  // (the clumsy hands' fumbles are drawn per thing and per try from the seed,
  // not from the order of the loop's draws, so a seed fumbles the same things
  // each time it is played)
  const seed0 = seed >>> 0;
  const rndOf = (key) => {
    let h = (seed0 ^ 0x9e3779b9) >>> 0;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 2654435761) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  const until = opts.stop || 'false';
  const held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } };
  const tap = async (code, ms = 45) => { await keyDown(code); await sleep(ms); await keyUp(code); };
  const shots = opts.shots || {};
  const shotDone = new Set();
  // the line: node names in order for my choices (lane is read when the yard comes)
  const LINE = (lane, over) => ['foot', 'alleyEnd', 'laneIn', 'laneOut', lane === 'E' ? 'eIn' : 'wIn', lane === 'E' ? 'eDoor' : 'wDoor', lane === 'E' ? 'eIn2' : 'wIn2', lane === 'E' ? 'eK' : 'wK', 'kMid', 'rollOut',
    ...(over === 'row' ? ['passIn', 'passOut', 'dog', 'bay', 'truck', 'rowEnd', 'rowOut'] : ['stairFoot', 'stairTop', 'roofIn', 'party', 'edge', 'r2In', 'tank', 'shedTop', 'eave', 'dropped']),
    'cross', 'gateway', 'aisleN', 'aisleS', 'crossW', 'gate', 'pave', 'myDoor'];
  let line = null, li = 0, lane = null, over = opts.over || 'roofs', laneTried = null;
  let plan = new Map();          // thing id -> { at: t to press, key, skip }
  let wrongAt = Date.now() + rr(3000, 6000), wOffUntil = 0;
  let lastBeat = null, fails = 0, warned = 0, lastWarn = null;
  const ST = `(() => {
    const C = N.controller, R = C.run, S = G.scenes, ctx = S.ctx, CH0 = ctx && ctx.flags.chase, CH = CH0 && CH0.course ? CH0 : null;
    const out = { done: !!(${until}), mode: C.mode, beat: S.beat, scene: S.current && S.current.id, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity,
      x: C.pos.x, z: C.pos.z, feet: R ? R.feet : C.groundY, v: R ? R.v : 0, failing: !!G.failing, warn: G.hud.kit.warnText || null,
      fails: G.counters.fails || 0, crawl: G.crawl, prompt: G.hud.promptShown || '', move: R && R.move ? R.move.kind : null, blocked: R && R.blocked ? { id: R.blocked.T.id, kind: R.blocked.T.kind } : null,
      lane: CH ? CH.lane : null, his: CH ? CH.act : null, gap: CH ? +CH.gapNow.toFixed(1) : null, stretch: CH ? CH.stretch : null, teach: G.hud.kit.teachCur ? G.hud.kit.teachCur.id : null };
    if (R && C.mode === 'run') {
      const th = N.stage.part('things');
      const q = th.ahead(C.pos, C.vel, R.level, 0.36);
      if (q) out.q = { id: q.T.id, kind: q.T.kind, d: +q.d.toFixed(3), t: +q.t.toFixed(3), c: +q.c.toFixed(2) };
    }
    const nodes = {};
    for (const k of ${JSON.stringify(['foot', 'alleyEnd', 'laneIn', 'laneOut', 'wIn', 'wDoor', 'wIn2', 'wK', 'eIn', 'eDoor', 'eIn2', 'eK', 'kMid', 'rollOut', 'passIn', 'passOut', 'dog', 'bay', 'truck', 'rowEnd', 'rowOut', 'stairFoot', 'stairTop', 'roofIn', 'party', 'edge', 'r2In', 'tank', 'shedTop', 'eave', 'dropped', 'cross', 'gateway', 'aisleN', 'aisleS', 'crossW', 'gate', 'pave'])}) {
      const n = CH && CH.course && CH.course.nodes.get(k); if (n) nodes[k] = [n.x, n.z];
    }
    const cars = N.stage.part && N.stage.part('cars');
    if (cars && cars.mine && cars.mine.handleAt) { const h = cars.mine.handleAt(); const o = cars.mine.handleOut(); nodes.myDoor = [h.x + o.x * 0.95, h.z + o.z * 0.95]; out.handle = [h.x, h.y, h.z]; }
    out.nodes = nodes;
    return out; })()`;
  let excLogged = false, nodes = null;
  const result = (done) => ({ profile: prof, over, fails, warned, lane, secs: +((Date.now() - T0) / 1000).toFixed(1), done });
  for (;;) {
    const s = await js(ST);
    if (!s || s.__exc) { if (s && s.__exc && !excLogged) { excLogged = true; log(`c6_chase: ${String(s.__exc).slice(0, 300)}`); } await sleep(120); if (Date.now() - T0 > timeout) break; continue; }
    for (const [name, expr] of Object.entries(shots)) if (!shotDone.has(name) && await js(expr) === true) { shotDone.add(name); await shot(name); }
    if (s.warn && s.warn !== lastWarn) warned++;
    lastWarn = s.warn;
    if (s.done) { for (const c of [...held]) await set(c, false); return result(true); }
    if (Date.now() - T0 > timeout) break;
    if (s.fails !== fails) {
      fails = s.fails;
      const why = await js('JSON.stringify((G._c6lost || []).slice(-1)[0] || (G.lastFail || {}))');
      log(`c6_chase ${prof}: a fail (${fails}) in ${lastBeat}: ${String(why).slice(0, 900)}`);
      line = null; plan.clear(); laneTried = null; if (prof === 'bad') lane = null;
    }
    if (s.beat !== lastBeat) {
      const met = await js(`JSON.stringify(((G.scenes.ctx && G.scenes.ctx.flags.chase && G.scenes.ctx.flags.chase.met) || []).slice(-5).map((m) => m[0] + '=' + m[1]))`);
      log(`c6_chase ${prof}: beat ${s.beat} (gap ${s.gap}, his ${s.his}, lane ${s.lane}) met ${met} tricks ${await js("JSON.stringify((G.scenes.ctx && G.scenes.ctx.flags.chase && G.scenes.ctx.flags.chase.evLog) || [])")}`);
      lastBeat = s.beat;
    }
    if (prof === 'idle' || s.failing || s.scene !== 'watcher') { for (const c of [...held]) await set(c, false); await sleep(100); continue; }
    if (s.mode !== 'run' && s.mode !== 'walk' && s.mode !== 'escape') { for (const c of [...held]) await set(c, false); await sleep(60); continue; }
    if (s.mode === 'escape') { await set('KeyW', true); await sleep(60); continue; }
    nodes = s.nodes;
    // the line: rebuilt on a retry and when the yard tells me his lane
    if (!line || (s.lane && lane !== s.lane && !laneTried)) {
      if (prof === 'good' || prof === 'w') lane = s.lane || 'W';
      else if (!lane || !laneTried) lane = laneTried || (rnd() < 0.5 ? 'W' : 'E');
      line = LINE(lane, over);
      // (from where I stand: the first point of the line still ahead of me)
      let best = 0, bd = Infinity;
      for (let i = 0; i < line.length; i++) { const n = nodes[line[i]]; if (!n) continue; const d = Math.hypot(n[0] - s.x, n[1] - s.z); if (d < bd) { bd = d; best = i; } }
      li = best;
      const n0 = nodes[line[li]], n1 = nodes[line[li + 1]];
      if (n0 && n1) { const ax = n1[0] - n0[0], az = n1[1] - n0[1]; if ((s.x - n0[0]) * ax + (s.z - n0[1]) * az > 0) li++; }
    }
    // (in the wrong lane: its door is locked - back out of it and into the other)
    if (s.blocked && s.blocked.kind === 'locked') {
      laneTried = lane === 'W' ? 'E' : 'W';
      lane = laneTried;
      line = LINE(lane, over);
      const back = ['laneOut', lane === 'E' ? 'eIn' : 'wIn'];
      line = [...back, ...line.slice(line.indexOf(lane === 'E' ? 'eIn' : 'wIn') + 1)];
      li = 0;
      log(`c6_chase ${prof}: the ${lane === 'W' ? 'E' : 'W'} door is locked; round to the other lane`);
    }
    // the next point
    let tgt = nodes[line[li]];
    while (tgt && li < line.length - 1) {
      const d = Math.hypot(tgt[0] - s.x, tgt[1] - s.z);
      const nx = nodes[line[li + 1]];
      // (reached, or already past it along the way to the next)
      const passed = nx && ((s.x - tgt[0]) * (nx[0] - tgt[0]) + (s.z - tgt[1]) * (nx[1] - tgt[1])) > 0 && d < 3.0;
      if (d < 1.1 || passed) { li++; tgt = nodes[line[li]]; } else break;
    }
    if (!tgt) { await sleep(50); continue; }
    // the car: at my coupe's door, the eyes on its handle, E
    if (s.beat === 'car' && s.handle && Math.hypot(s.handle[0] - s.x, s.handle[2] - s.z) < 2.3) {
      await set('KeyW', false);
      const hy = Math.atan2(-(s.handle[0] - s.x), -(s.handle[2] - s.z)), he = Math.atan2(Math.sin(hy - s.yaw), Math.cos(hy - s.yaw));
      const hp = Math.atan2(s.handle[1] - (s.feet + 1.63), Math.hypot(s.handle[0] - s.x, s.handle[2] - s.z));
      if (Math.abs(he) > 0.05 || Math.abs(hp - s.pitch) > 0.08) await turn(Math.round(Math.max(-60, Math.min(60, -he * 0.7 / s.sens))), Math.round(Math.max(-40, Math.min(40, -(hp - s.pitch) * 0.7 / s.sens))));
      if (/drive/.test(s.prompt) && prof !== 'w') { await sleep(prof === 'good' ? rr(100, 250) : rr(300, 700)); await tap('KeyE'); await sleep(700); }
      await sleep(40);
      continue;
    }
    // steer: the mouse onto the point (a little lead into the next)
    const nx = nodes[line[li + 1]];
    let ax = tgt[0], az = tgt[1];
    const dT = Math.hypot(tgt[0] - s.x, tgt[1] - s.z);
    if (nx && dT < 2.5) { const k = 1 - dT / 2.5; ax += (nx[0] - tgt[0]) * 0.35 * k; az += (nx[1] - tgt[1]) * 0.35 * k; }
    const want = Math.atan2(-(ax - s.x), -(az - s.z));
    let err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    const lag = prof === 'good' ? 0.75 : 0.42; if (prof === 'bad') err += Math.sin(Date.now() / 700) * 0.06;
    if (Math.abs(err) > 0.025 || Math.abs(s.pitch + 0.02) > 0.05) await turn(Math.round(Math.max(-60, Math.min(60, -err * lag / s.sens))), Math.round(Math.max(-30, Math.min(30, (s.pitch + 0.02) * 0.4 / s.sens))));
    // W: held (let go now and then by the clumsy hands; at the car, near the door)
    let w = Math.abs(err) < 1.0 || s.v < 2;
    if (prof === 'bad' && Date.now() < wOffUntil) w = false;
    if (prof === 'bad' && Date.now() > wrongAt) {
      wrongAt = Date.now() + rr(3500, 7000);
      if (rnd() < 0.5) wOffUntil = Date.now() + rr(250, 600);
      else await tap(['KeyF', 'KeyQ', 'KeyE'][Math.floor(rnd() * 3)]);
    }
    if (s.beat === 'car' && line[li] === 'myDoor' && dT < 0.9) w = false;
    await set('KeyW', w);
    // the thing ahead: SPACE or C, on the profile's timing
    if (prof !== 'w' && s.q) {
      const q = s.q;
      const key = q.kind === 'under' || q.kind === 'slope' ? 'KeyC' : q.kind === 'locked' ? null : 'Space';
      let P = plan.get(q.id);
      if (!P || P.used) {
        if (!P) {
          // the plan for this thing: when to press (seconds before reaching it)
          if (prof === 'good') P = { at: q.kind === 'slope' ? 0.45 : q.kind === 'jump' ? 0.2 : 0.24 + rr(-0.04, 0.04), key };
          else {
            const k = `${q.id}:${fails}:`, u = rndOf(k + 'u');
            const r = rndOf(k + 'r');
            P = r < 0.42 ? { at: 0.24 + (u - 0.5) * 0.26, key } : r < 0.66 ? { at: 0.62 + u * 0.38, key } : r < 0.84 ? { at: -0.08, key } : { at: null, key };
            if (rndOf(k + 'w') < 0.12 && key) P.key = key === 'Space' ? 'KeyC' : 'Space';
            P.react = 0.25 + rndOf(k + 't') * 0.2;
          }
          P.seenAt = Date.now();
          plan.set(q.id, P);
        }
      }
      if (P && !P.used && P.key && P.at != null && q.d > -0.2) {
        const ready = !P.react || Date.now() - P.seenAt > P.react * 1000;
        // (late: press only at contact)
        const now = P.at < 0 ? q.d <= 0.05 : q.t <= P.at;
        if (ready && now) { P.used = true; await tap(P.key); if (opts.verbose) log(`c6_chase ${prof}: ${q.id} ${P.key} at t ${q.t} (plan ${P.at})`); }
      }
    }
    // pressed against a thing after a hit: the key that gets me over / under / through it
    if (prof !== 'w' && s.blocked && s.blocked.kind !== 'locked') {
      const k = s.blocked.kind === 'under' ? 'KeyC' : 'Space';
      await sleep(prof === 'good' ? rr(80, 160) : rr(250, 600));
      await tap(k);
      plan.delete(s.blocked.id);
    }
    // (a fresh pass over a thing a hit made me take twice)
    if (s.move == null && s.q == null) for (const [id, P] of plan) if (P.used && id !== (s.q && s.q.id)) plan.delete(id);
    await sleep(prof === 'good' ? 25 : 40);
  }
  for (const c of [...held]) await set(c, false);
  log(`c6_chase ${prof}: timeout`);
  return result(false);
}
