// [C6 critic] The critic's own player for chapter V's foot chase (NOT the owner's
// tools/lib/c6_chase.mjs): real input through tools/play.mjs's primitives.
//   { "drive": "tools/plays/critic/c6c_drive.mjs", "profile": "good" | "bad" | "w" | "idle" | "spacer",
//     "over": "roofs" | "row", "seed": n, "stop": "expr", "timeout": ms, "shots": { name: expr } }
// Profiles:
//   idle    touches nothing (after the play's own BEGIN)
//   w       W held, the mouse steers him along the line, never SPACE / C / E
//   good    SPACE / C about a fifth of a second before each thing (+- 0.05 s), reads his lane
//   bad     a clumsy first-timer: late eyes (0.3 .. 0.6 s), a wide timing error, a third of the
//           things fumbled (none, the wrong key, far too early), W let go now and then, slow to
//           answer when stopped against a thing, a random lane of the yard (and back out of it
//           when its door is locked)
//   spacer  good, but knows only SPACE (the first card): what a first-timer does before C is taught
//           ("spaceT": how long before each thing he presses, default 0.2 s; 0.5 = a little early)
//   (good with "miss": [ids]: those things not pressed for - run into - then the right key a quarter second after)
// Eyes: the stage's own things.ahead (what lies on my way and how soon I reach it), his act and lane.
// Steering: the mouse onto a point ~3 m ahead on the line of the course's nodes (plan.js NODES).
import { NODES } from '../../../src/stages/backlot/plan.js';

export default async function drive({ js, turn, keyDown, keyUp, log, sleep, opts, shot }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 300000;
  const prof = opts.profile || 'good';
  let seed = (opts.seed ?? 12345) >>> 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) / Math.sqrt(0.5); };
  const until = opts.stop || 'false';
  const held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } };
  const tap = async (code, ms = 50) => { await keyDown(code); await sleep(ms); await keyUp(code); };
  const shots = opts.shots || {};
  const shotDone = new Set();
  const N_ = { ...NODES, myDoor: [-2.25, 0.15, -91.3] };
  const LINE = (lane, over) => ['foot', 'alleyEnd', 'laneIn', 'laneOut',
    ...(lane === 'E' ? ['eIn', 'eDoor', 'eIn2', 'eK'] : ['wIn', 'wDoor', 'wIn2', 'wK', 'kMid']),
    'kDoor', 'pIn', 'pA', 'pB', 'pC', 'pD', 'dock', 'avS', 'avN', 'aIn', 'aMid', 'aOut',
    ...(over === 'row' ? ['passIn', 'passOut', 'dog', 'bay', 'truck', 'rowEnd', 'rowOut'] : ['stairIn', 'stairFoot', 'stairTop', 'roofIn', 'party', 'edge', 'r2In', 'tank', 'shedTop', 'eave', 'dropped']),
    'cross', 'gateway', 'aisleN', 'aisleS', 'crossW', 'gate', 'pave', 'myDoor'];
  const over = opts.over || 'roofs';
  let lane = null, line = null, li = 0;
  const pts = () => line.map((n) => N_[n]);
  const ST = `(() => {
    const C = N.controller, R = C.run, S = G.scenes, ctx = S.ctx, CH = ctx && ctx.flags && ctx.flags.chase && ctx.flags.chase.course ? ctx.flags.chase : null;
    const K = G.hud.kit;
    const out = { done: !!(${until}), mode: C.mode, beat: S.beat, scene: S.current && S.current.id, yaw: C.yaw, pitch: C.pitch, x: C.pos.x, z: C.pos.z,
      feet: R ? R.feet : C.groundY, v: R ? R.v : 0, failing: !!G.failing, warn: K && K.warnText || null, fails: (G.counters && G.counters.fails) || 0,
      prompt: G.hud.promptShown || '', move: R && R.move ? R.move.kind : null, blocked: R && R.blocked ? { id: R.blocked.T.id, kind: R.blocked.T.kind } : null,
      lane: CH ? CH.lane : null, his: CH ? CH.act : null, gap: CH ? +CH.gapNow.toFixed(1) : null, stretch: CH ? CH.stretch : null,
      teach: K && K.teachCur ? (K.teachCur.text || K.teachCur.id) : null, t: +N.time.toFixed(2), card: G.hud.cardT || 0,
      hx: CH && CH.fig ? +CH.fig.pos.x.toFixed(1) : null, hz: CH && CH.fig ? +CH.fig.pos.z.toFixed(1) : null, seen: CH ? CH.seen : null };
    if (R && C.mode === 'run') {
      const th = N.stage.part('things');
      const q = th && th.ahead(C.pos, C.vel, R.level, 0.36);
      if (q) out.q = { id: q.T.id, kind: q.T.kind, d: +q.d.toFixed(3), t: +q.t.toFixed(3), c: +q.c.toFixed(2) };
    }
    return out; })()`;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const rec = { profile: prof, over, seed: opts.seed ?? 12345, fails: [], warns: 0, teach: [], stretches: [], blocked: [], presses: 0, tail: null, secs: null, laneTried: [] };
  let st = await js(ST), lastStretch = null, lastWarn = null, lastTeach = null, lastFails = st.fails, runT0 = null;
  let plan = new Map(), blockT = null, blockPlan = null, wOffUntil = 0, nextWOff = Date.now() + rr(5000, 9000), drift = 0;
  let laneChosen = null, eKey = 0, lastE = 0;
  const reset = () => { plan = new Map(); blockT = null; blockPlan = null; li = 0; line = null; laneChosen = null; };
  while (Date.now() - T0 < timeout) {
    st = await js(ST);
    if (!st || st.__exc) { await sleep(100); continue; }
    for (const [name, expr] of Object.entries(shots)) if (!shotDone.has(name) && (await js(expr)) === true) { shotDone.add(name); await shot(name); }
    if (st.scene !== 'watcher') { rec.tail = st.scene; log(`scene ${st.scene}: out of the chase`); break; }
    if (st.done) break;
    // the record
    if (st.stretch !== lastStretch && st.stretch) { rec.stretches.push([st.stretch, st.t]); log(`stretch ${st.stretch} t=${st.t} gap=${st.gap} pitch=${(+st.pitch).toFixed(2)}`); lastStretch = st.stretch; }
    if (st.warn !== lastWarn) { if (st.warn) { rec.warns++; log(`WARN "${st.warn}" stretch=${st.stretch} gap=${st.gap} me=${st.x.toFixed(1)},${st.z.toFixed(1)}`); } else log('warn off'); lastWarn = st.warn; }
    if (st.teach && st.teach !== lastTeach) { rec.teach.push([st.teach, st.t]); log(`TEACH ${st.teach}`); }
    lastTeach = st.teach;
    if (st.fails !== lastFails) {
      const lf = await js('G.lastFail ? { why: G.lastFail.why, to: G.lastFail.to, warnedFor: G.lastFail.warnedFor } : null');
      rec.fails.push({ ...lf, stretch: st.stretch, at: [+st.x.toFixed(1), +st.z.toFixed(1)] });
      log(`FAIL ${JSON.stringify(lf)} at ${st.x.toFixed(1)},${st.z.toFixed(1)}`);
      lastFails = st.fails;
      for (const k of [...held]) await set(k, false);
      reset();
    }
    if (prof === 'idle') { await sleep(80); continue; }
    if (st.failing || st.card > 0.1) { for (const k of [...held]) await set(k, false); await sleep(60); continue; }
    // the window: E at the prompts
    if (st.mode === 'seated' || st.mode === 'cutscene') {
      if (/look out|fire escape/.test(st.prompt) && Date.now() - lastE > 1500 && prof !== 'w') { await sleep(prof === 'bad' ? rr(600, 1500) : 250); await tap('KeyE'); lastE = Date.now(); }
      await sleep(60); continue;
    }
    if (st.mode === 'escape') { await set('KeyW', true); await sleep(60); continue; }
    if (st.mode !== 'run' && st.mode !== 'walk') { await sleep(60); continue; }
    if (runT0 == null && st.mode === 'run') runT0 = st.t;
    // my line (the lane: good reads his; bad guesses)
    if (st.lane && !laneChosen) {
      laneChosen = prof === 'bad' ? (rnd() < 0.5 ? 'W' : 'E') : st.lane;
      rec.laneTried.push(laneChosen);
    }
    if (!line) { line = LINE(laneChosen || st.lane || 'W', over); li = 0; }
    // the nearest segment ahead of where I was on the line
    const P = pts();
    let best = li, bd = 1e9;
    const lo = li === 0 ? 0 : Math.max(0, li - 1), hi = li === 0 ? P.length - 1 : Math.min(P.length - 1, li + 4);
    for (let i = lo; i < hi; i++) {
      const a = P[i], b = P[i + 1];
      const tx = b[0] - a[0], tz = b[2] - a[2], L2 = tx * tx + tz * tz || 1e-6;
      const k = Math.max(0, Math.min(1, ((st.x - a[0]) * tx + (st.z - a[2]) * tz) / L2));
      const dy = Math.abs((st.feet || 0) - (a[1] + (b[1] - a[1]) * k));
      const d = Math.hypot(st.x - (a[0] + tx * k), st.z - (a[2] + tz * k)) + dy * 2;
      if (d < bd) { bd = d; best = i; }
    }
    li = best;
    // a point ~3 m ahead along the line
    let need = 3.0, i = li, cx = st.x, cz = st.z;
    { const a = P[i], b = P[i + 1]; const tx = b[0] - a[0], tz = b[2] - a[2], L2 = tx * tx + tz * tz || 1e-6; const k = Math.max(0, Math.min(1, ((st.x - a[0]) * tx + (st.z - a[2]) * tz) / L2)); cx = a[0] + tx * k; cz = a[2] + tz * k; }
    let tx = cx, tz = cz;
    while (i < P.length - 1) {
      const b = P[i + 1];
      const d = Math.hypot(b[0] - cx, b[2] - cz);
      if (d >= need) { tx = cx + (b[0] - cx) * need / d; tz = cz + (b[2] - cz) * need / d; break; }
      need -= d; cx = b[0]; cz = b[2]; tx = cx; tz = cz; i++;
    }
    const dDoor = Math.hypot(st.x - N_.myDoor[0], st.z - N_.myDoor[2]);
    const atEnd = (line[li + 1] === 'myDoor' || line[li] === 'myDoor') && dDoor < 1.6;
    if (atEnd && prof !== 'w') {
      // at my coupe: the eye onto its kerb-side handle, a step at a time, E when it asks
      const hx = -3.34, hz = -90.8;
      const dy = wrap(Math.atan2(-(hx - st.x), -(hz - st.z)) - st.yaw);
      const dp = Math.atan2(1.0 - (st.feet + 1.63), Math.hypot(hx - st.x, hz - st.z)) - st.pitch;
      if (Math.abs(dy) > 0.02 || Math.abs(dp) > 0.02) await turn(Math.round(-dy / 0.0021 * 0.6), Math.round(-dp / 0.0021 * 0.6));
      await set('KeyW', false);
      if (/drive/.test(st.prompt) && Date.now() - lastE > 700) { await sleep(prof === 'bad' ? rr(300, 900) : 120); await tap('KeyE'); lastE = Date.now(); log('E at my car'); }
      else if (!/drive/.test(st.prompt) && Math.abs(dy) < 0.15 && dDoor > 0.7) { await tap('KeyW', 120); }
      await sleep(60); continue;
    }
    // the car: at my door, E
    if (/drive/.test(st.prompt) && prof !== 'w') {
      await set('KeyW', false);
      if (Date.now() - lastE > 900) { await sleep(prof === 'bad' ? rr(300, 900) : 150); await tap('KeyE'); lastE = Date.now(); log('E at my car'); }
      await sleep(60); continue;
    }
    // steer
    if (prof === 'bad') drift += (gauss() * 0.06 - drift * 0.1);
    const want = Math.atan2(-(tx - st.x), -(tz - st.z)) + (prof === 'bad' ? drift : 0);
    let dyaw = wrap(want - st.yaw);
    const maxT = prof === 'bad' ? 0.12 : 0.22;
    dyaw = Math.max(-maxT, Math.min(maxT, dyaw));
    const dpit = opts.noPitch ? 0 : Math.max(-0.1, Math.min(0.1, (-0.06 - st.pitch)));
    if (Math.abs(dyaw) > 0.01 || Math.abs(dpit) > 0.03) await turn(Math.round(-dyaw / 0.0021), Math.abs(dpit) > 0.03 ? Math.round(-dpit / 0.0021) : 0);
    // W
    let wOn = true;
    if (prof === 'bad') {
      if (Date.now() > nextWOff) { wOffUntil = Date.now() + rr(400, 1100); nextWOff = Date.now() + rr(6000, 11000); log('bad: W let go a moment'); }
      if (Date.now() < wOffUntil) wOn = false;
    }
    await set('KeyW', wOn);
    // stopped against a thing
    if (st.blocked) {
      if (!blockT) {
        blockT = Date.now(); rec.blocked.push([st.blocked.id, st.blocked.kind, st.stretch]);
        log(`blocked at ${st.blocked.id} (${st.blocked.kind})`);
        const right = st.blocked.kind === 'under' ? 'KeyC' : st.blocked.kind === 'locked' ? null : 'Space';
        blockPlan = prof === 'good' ? { at: 250, key: right } : prof === 'spacer' ? { at: 300, key: 'Space' } : prof === 'bad' ? { at: rr(500, 1500), key: rnd() < 0.3 ? (right === 'KeyC' ? 'Space' : 'KeyC') : right, then: right } : null;
      }
      if (st.blocked.kind === 'locked' && prof === 'bad' && Date.now() - blockT > rr(700, 1400)) {
        // the wrong lane: back out and round to the other
        const other = laneChosen === 'W' ? 'E' : 'W';
        log(`bad: ${laneChosen} lane's door locked: round to ${other}`);
        laneChosen = other; rec.laneTried.push(other);
        const back = other === 'E' ? ['wDoor', 'wIn', 'eIn', 'eDoor', 'eIn2', 'eK'] : ['eDoor', 'eIn', 'wIn', 'wDoor', 'wIn2', 'wK', 'kMid'];
        line = [...back, ...LINE(other, over).slice(LINE(other, over).indexOf('kDoor'))]; li = 0;
        await turn(Math.round(Math.PI / 0.0021 / 2), 0); await sleep(120); await turn(Math.round(Math.PI / 0.0021 / 2), 0);
        blockT = null; blockPlan = null;
        await sleep(60); continue;
      }
      if (blockPlan && blockPlan.key && Date.now() - blockT > blockPlan.at) {
        await tap(blockPlan.key); rec.presses++;
        log(`  pressed ${blockPlan.key} against ${st.blocked.id}`);
        if (blockPlan.then && blockPlan.then !== blockPlan.key) blockPlan = { at: Date.now() - blockT + rr(500, 1000), key: blockPlan.then };
        else blockPlan = { at: Date.now() - blockT + (prof === 'good' ? 600 : rr(700, 1400)), key: blockPlan.key };
      }
      await sleep(40); continue;
    }
    blockT = null; blockPlan = null;
    // what comes on my way
    const q = st.q;
    if (q && prof !== 'w' && !st.move && q.c > 0.45) {
      let p = plan.get(q.id);
      if (!p) {
        const right = q.kind === 'under' || q.kind === 'slope' ? 'KeyC' : q.kind === 'locked' ? null : 'Space';
        if (prof === 'good' && (opts.miss || []).includes(q.id)) p = { t: -1, key: null, why: 'missed on purpose' };
        else if (prof === 'good') p = { t: 0.2 + gauss() * 0.04, key: right };
        else if (prof === 'spacer') p = { t: (opts.spaceT ?? 0.2) + gauss() * 0.02, key: right === 'KeyC' ? 'Space' : right };
        else {
          const r = rnd();
          if (r < 0.12) p = { t: -1, key: null, why: 'none' };
          else if (r < 0.24) p = { t: 0.25, key: right === 'KeyC' ? 'Space' : right === 'Space' ? 'KeyC' : null, why: 'wrong key' };
          else if (r < 0.34) p = { t: rr(0.7, 1.1), key: right, why: 'far too early' };
          else p = { t: Math.max(-0.05, 0.22 + gauss() * 0.16), key: right, why: 'timing' };
        }
        if (q.kind === 'slope' && p.key === 'KeyC') p.t = Math.max(p.t, 0.4);
        plan.set(q.id, p);
        if (prof === 'bad' && p.why !== 'timing') log(`bad: ${q.id} -> ${p.why}`);
      }
      if (!p.done && p.key && q.t <= p.t) { p.done = true; await tap(p.key); rec.presses++; }
    }
    await sleep(prof === 'bad' ? 55 : 30);
  }
  for (const k of [...held]) await set(k, false);
  rec.secs = +((Date.now() - T0) / 1000).toFixed(1);
  rec.runSecs = runT0 != null ? +((await js('N.time')) - runT0).toFixed(1) : null;
  rec.met = await js('(G.scenes.ctx && G.scenes.ctx.flags && G.scenes.ctx.flags.chase && G.scenes.ctx.flags.chase.met || []).map((m) => m[0] + ":" + m[1])');
  rec.lost = await js('(G._c6lost || []).map((r) => ({ s: r.stretch, gap: r.gap, unseen: r.unseen, me: r.me, blocked: r.blocked, move: r.move, lane: r.lane }))');
  return rec;
}
