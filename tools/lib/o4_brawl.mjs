// [O4] The crowd brawl played by real input (tools/play.mjs drive): a model
// of a kind of player, reading only what the screen shows - the dodge cue's
// light side, a man's guard dropped (his hand at his hip, the tick), his fist
// cocking (the white strokes), who is stepping in, the cards - and pressing
// keys and buttons at a person's pace.
//   { "drive": "tools/lib/o4_brawl.mjs", "profile": "idle" | "bad" | "medium" | "good",
//     "beat": "brawl2", "tries": 4, "wins": 1, "timeout": ms }
// Plays the beat until it is won `wins` times or lost `tries` times (each loss
// is the kit's fail and a retry of the beat). Returns per try: the result,
// how long, my downs' words, how long the warning was up before the fall.
//   idle    nothing
//   bad     the clumsy first-timer: slow eyes (the cue answered 0.33 .. 0.5 s
//           after it shows, a quarter the wrong way, a fifth not at all),
//           jabs into the guard often, an opening hit late, seldom blocks,
//           turns to a man slowly, a stray key now and then; a little less
//           blind after each fall (the black told him why)
//   medium  the critic's medium hands: the cue in 0.24 .. 0.36 s (one in
//           seven wrong, one in ten missed), openings hit in 0.3 .. 0.45 s,
//           half of the jabs he sees blocked, now and then a jab into the
//           guard, keeps the men in front most of the time
//   good    what the cards taught: the cue in 0.17 .. 0.24 s, the opening
//           jabbed in 0.2 .. 0.3 s and a stunned or missed man given the
//           heavy, the jabs blocked, the men kept in front
export default async function drive({ js, turn, keyDown, keyUp, mouse, log, sleep, W, H, opts, cursor, shot }) {
  const prof = opts.profile || 'good';
  const T0 = Date.now(), timeout = opts.timeout ?? 300000;
  const beatName = opts.beat || 'brawl1';
  const maxTries = opts.tries ?? 4, wantWins = opts.wins ?? 1;
  const rr = (a, b) => a + (b - a) * Math.random();
  const at = () => (cursor ? cursor() : [W / 2, H / 2]);
  const held = new Map();
  const press = async (b, ms) => { const code = 'M' + b; if (held.has(code)) return false; const [x, y] = at(); await mouse('mousePressed', x, y, b); held.set(code, Date.now() + ms); return true; };
  const down = async (code, ms) => { if (!held.has(code)) await keyDown(code); held.set(code, Date.now() + ms); };
  const up = async (code) => { if (!held.has(code)) return; held.delete(code); if (code[0] === 'M') { const [x, y] = at(); await mouse('mouseReleased', x, y, code.slice(1)); } else await keyUp(code); };
  const tap = async (code) => { await keyDown(code); await sleep(45); await keyUp(code); };
  const release = async (all = false) => { const now = Date.now(); for (const [code, t] of [...held]) if (all || now >= t) await up(code); };
  let shots = opts.shots ?? 0, shotN = 0;
  const snap = async (why) => { if (shots <= 0 || !shot) return; shots--; const n = String(shotN++).padStart(2, '0'); log(`snap ${n} ${why}`); await shot(`${prof}_${beatName}_${n}_${why.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}`); };
  // the profile's numbers (a bad hand learns a little from each black)
  const P = {
    bad: { cue: [330, 500], wrong: 0.25, miss: 0.2, open: [450, 700], poke: [700, 1500], block: 0.25, heavy: 0.15, turn: [500, 900], turnErr: 0.25, stray: true },
    medium: { cue: [240, 360], wrong: 0.14, miss: 0.1, open: [300, 450], poke: [1800, 3500], block: 0.5, heavy: 0.45, turn: [250, 450], turnErr: 0.12 },
    good: { cue: [170, 240], wrong: 0.0, miss: 0.0, open: [200, 300], poke: [5000, 9000], block: 0.85, heavy: 0.9, turn: [150, 260], turnErr: 0.05 },
  }[prof] || null;
  const out = { profile: prof, beat: beatName, tries: [], texts: [] };
  const seen = new Set();
  await js(`(() => { const R = window.__o4 = { ends: [], cues: [] };
    if (!window.__o4hooked) { window.__o4hooked = true;
      G.on('crowd:end', (e) => window.__o4.ends.push({ t: +G.time.toFixed(1), result: e.result, why: e.why || null, warned: G.hud.kit.warnText ? +(G.time - (G.hud.kit.warnAt ?? G.time)).toFixed(2) : null, stats: { landed: e.stats.landed, taken: e.stats.taken, slips: e.stats.slips, missed: e.stats.missed || 0, wrong: e.stats.wrong, late: e.stats.late, cues: e.stats.cues, intoGuard: e.stats.intoGuard, counters: e.stats.counters, heavies: e.stats.heavies, jabs: e.stats.jabs, glancing: e.stats.glancing, hisBlocked: e.stats.hisBlocked, spared: e.stats.spared || 0, time: +e.stats.time.toFixed(1) } }));
      G.on('crowd:cue', (e) => window.__o4.cues.push({ t: performance.now(), side: e.side, clip: e.clip })); }
    return 1; })()`);
  let lastCueT = null, plans = new Map(), openSeen = null, openAt = 0, pokeAt = Date.now() + 2000, strayAt = Date.now() + rr(3000, 6000), turnAt = 0, lastEnds = 0, tryT0 = Date.now(), wins = 0, losses = 0;
  const ST = `(() => {
    const F = G.crowd, C = N.controller, e = G.eye, me = F.me || {};
    const look = Math.atan2(-Math.sin(C.yaw), -Math.cos(C.yaw));
    const wr = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const men = (F.men || []).map((m) => { const dx = m.c.pos.x - e.x, dz = m.c.pos.z - e.z; return { id: m.id, st: m.state, d: +Math.hypot(dx, dz).toFixed(2), rel: +wr(Math.atan2(dx, dz) - look).toFixed(3),
      open: m.openT > 0 || m.state === 'stun' || m.state === 'hurt' || m.state === 'knock', miss: +(m.missT || 0).toFixed(2), clip: m.clip, ct: +(m.clipT || 0).toFixed(3), contact: m.marks ? m.marks.contact : null, strike: m.marks ? m.marks.strike : null,
      small: !!(m.clip && /^br_(jab|jabR|cross|answerL|answerR)$/.test(m.clip)), y: m.c.bones && m.c.bones.chest ? +m.c.bones.chest.getWorldPosition(new N.THREE.Vector3()).y.toFixed(2) : 1.3 }; });
    const K = G.hud.kit;
    return { act: !!F.active, done: !!F.done, result: F.result, failing: !!G.failing, beat: G.scenes.beat, me: me.act, holding: !!me.holding,
      tgt: F.target ? F.target.id : null, men, cue: F.cue && !F.cue.done ? F.cue.side : null, cueHeld: !!(F.cue && F.cue.held), cueT: F.cue ? F.cue.atk + ':' + F.cue.m.id : null,
      yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, ey: e.y, hp: Math.round(G.health.hp), fails: G.fails(), warn: G.hud.warnText || '', teach: K && K.teachCur ? K.teachCur.text : '', obj: G.hud.objectiveText || '', ends: window.__o4.ends.length, prompt: G.hud.promptShown || '', money: G.save.money,
      free: F.active ? F.free() : true };
  })()`;
  for (;;) {
    if (Date.now() - T0 > timeout) { log('o4_brawl: timeout'); break; }
    const s = await js(ST);
    if (!s || s.__exc) { if (s && s.__exc) log('o4_brawl: ' + String(s.__exc).slice(0, 200)); await sleep(120); continue; }
    for (const [k, v] of [['teach', s.teach], ['warn', s.warn], ['obj', s.obj]]) { if (!v) continue; const key = k + ':' + v; if (seen.has(key)) continue; seen.add(key); out.texts.push(key); log(`TEXT ${key}`); }
    // a contest ended (won, or my fall - the kit's black and the retry)
    if (s.ends > lastEnds) {
      const E = await js('window.__o4.ends.slice(' + lastEnds + ')');
      lastEnds = s.ends;
      for (const e of E || []) {
        const secs = +((Date.now() - tryT0) / 1000).toFixed(1);
        out.tries.push({ result: e.result, why: e.why, warnedFor: e.warned, secs, stats: e.stats });
        log(`END ${e.result}${e.why ? ' (' + e.why + ')' : ''} after ${secs} s, warned ${e.warned} s before; ${JSON.stringify(e.stats)}`);
        await snap('end_' + e.result);
        if (e.result === 'won' || e.result === 'fled') wins++; else if (e.result === 'down') losses++;   // [O7] (fled: the wanted man ran, beaten - night/bounty.js)
        tryT0 = Date.now();
        // the clumsy hand reads the word on the black
        if (P && prof === 'bad' && e.why) {
          if (/Too slow/.test(e.why)) P.cue = [Math.max(260, P.cue[0] - 30), Math.max(340, P.cue[1] - 40)];
          else if (/Wrong/.test(e.why)) P.wrong = Math.max(0.06, P.wrong / 2);
          else if (/guard|swinging/.test(e.why)) P.poke = [P.poke[0] * 1.6, P.poke[1] * 1.6];
          else if (/jab/.test(e.why)) P.block = Math.min(0.6, P.block + 0.2);
          else if (/behind/.test(e.why)) P.turn = [Math.max(300, P.turn[0] - 100), Math.max(500, P.turn[1] - 150)];
          log(`LEARN ${JSON.stringify(P)}`);
        }
      }
      await release(true);
      if (wins >= wantWins || losses >= maxTries) break;
    }
    // (a bout is taken up with E at the ring's corner: opts.startKey)
    if (!s.act && !s.failing && s.beat === beatName && opts.startKey && s.prompt && Date.now() > (out.keyAt || 0)) { out.keyAt = Date.now() + 1500; await tap(opts.startKey); log('start: ' + opts.startKey + ' (' + s.prompt + ')'); }
    if (!s.act || s.failing || s.beat !== beatName) { await release(true); await sleep(80); continue; }
    if (prof === 'idle' || !P) { await sleep(60); continue; }
    await release();
    const now = Date.now();
    const live = s.men.filter((m) => m.st !== 'down' && m.st !== 'out' && m.st !== 'gone' && m.st !== 'rise');
    if (!live.length) { await sleep(50); continue; }
    // ---- the cue: toward the light
    if (s.cue && s.cueT !== lastCueT) {
      lastCueT = s.cueT;
      let key = s.cue === 'R' ? 'KeyD' : 'KeyA';
      let delay = rr(P.cue[0], P.cue[1]);
      const r = Math.random();
      if (r < P.miss) key = null; else if (r < P.miss + P.wrong) key = key === 'KeyD' ? 'KeyA' : 'KeyD';
      if (s.cueHeld) { key = s.cue === 'R' ? 'KeyD' : 'KeyA'; delay = rr(600, 1200); }
      if (key) plans.set('cue', { key, at: now + delay });
      await snap('cue_' + s.cue);
    }
    const Pc = plans.get('cue');
    if (Pc && now >= Pc.at) { plans.delete('cue'); await up('KeyW'); await up('Space'); await tap(Pc.key); }
    if (s.cue) { await sleep(10); continue; }
    // ---- keep them in front: turn onto the man stepping in (or the nearest), a person's pace
    const threat = live.filter((m) => m.st === 'in' || m.st === 'atk').sort((a, b) => Math.abs(a.rel) - Math.abs(b.rel))[0] || live.slice().sort((a, b) => a.d - b.d)[0];
    const tgt = live.find((m) => m.id === s.tgt) || threat;
    let face = tgt;
    if (threat && Math.abs(threat.rel) > 0.9) face = threat;
    // (a man open and near - he missed, he is stunned - is the one to turn to)
    const openNear = live.filter((m) => m.open && m.d < 2.3 && m.st !== 'ring').sort((a, b) => Math.abs(a.rel) - Math.abs(b.rel))[0];
    if (openNear && !(threat && threat.st === 'atk' && Math.abs(threat.rel) > 0.9)) face = openNear;
    if (face && Math.abs(face.rel) > 0.35 && now >= turnAt) {
      turnAt = now + rr(P.turn[0], P.turn[1]);
      const err = (Math.random() - 0.5) * 2 * P.turnErr;
      const dy = face.rel + err, steps = Math.min(6, Math.max(2, Math.ceil(Math.abs(dy) / 0.25)));
      const px = Math.round(-dy / s.sens / steps);
      for (let i = 0; i < steps; i++) { await turn(px, 0); await sleep(16); }
      continue;
    }
    // ---- his small blow coming at me (seen): SPACE
    for (const m of live) {
      if (m.st !== 'atk' || !m.small || m.contact == null || Math.abs(m.rel) > 0.9) continue;
      const k = 'blk:' + m.id + ':' + m.clip + ':' + Math.round((m.contact - m.ct) * 10);
      if (plans.has('blk:' + m.id) || m.ct > m.contact) continue;
      plans.set('blk:' + m.id, { clip: m.clip, at: 0 });
      if (Math.random() < P.block) { const wait = Math.max(0, rr(0.16, 0.26) - m.ct) * 1000; plans.set('block', { at: now + wait, until: Math.max(160, (m.contact - m.ct + 0.15) * 1000) }); }
      void k;
    }
    for (const k of [...plans.keys()]) if (k.startsWith('blk:')) { const id = +k.slice(4), m = live.find((x) => x.id === id); if (!m || m.st !== 'atk') plans.delete(k); }
    const Bk = plans.get('block');
    if (Bk && now >= Bk.at) { plans.delete('block'); await up('KeyW'); await down('Space', Bk.until); }
    if (held.has('Space')) { await sleep(16); continue; }
    // ---- a thing in reach (a bottle, a chair): the taught hand takes it
    if (opts.things && !s.holding && /take the/.test(s.prompt || '') && s.me === 'idle' && now > (out.thingAt || 0)) { out.thingAt = now + 2500; await tap('KeyE'); out.took = (out.took || 0) + 1; log('take: ' + s.prompt); }
    // ---- into reach of the one I face
    if (tgt && tgt.d > 1.75 && Math.abs(tgt.rel) < 0.5 && s.me !== 'hurt') await down('KeyW', 120);
    if (s.me !== 'idle') { await sleep(16); continue; }
    // ---- an opening: the one I face, his guard down
    const look = tgt ? tgt.id + ':' + tgt.open + ':' + tgt.st + ':' + (tgt.miss > 0) : '';
    if (look !== openSeen) { openSeen = look; openAt = now + rr(P.open[0], P.open[1]); }
    if (tgt && tgt.open && tgt.d < 1.95 && Math.abs(tgt.rel) < 0.55 && now >= openAt && (tgt.st !== 'atk' || (tgt.contact != null && tgt.ct > tgt.contact))) {
      const big = tgt.st === 'stun' || tgt.miss > 0.45;
      const ms = big && Math.random() < P.heavy ? rr(380, 520) : (prof === 'bad' && Math.random() < 0.2 ? rr(300, 600) : rr(70, 160));
      await press(Math.random() < 0.5 ? 'left' : 'right', ms);
      openAt = now + (ms > 300 ? ms + rr(150, 300) : rr(P.open[0] * 0.6, P.open[1] * 0.6));
    } else if (tgt && !tgt.open && tgt.st === 'ring' && tgt.d < 1.95 && now >= pokeAt) {
      pokeAt = now + rr(P.poke[0], P.poke[1]);
      await press(Math.random() < 0.5 ? 'left' : 'right', rr(70, 180));
    }
    if (P.stray && now >= strayAt) { strayAt = now + rr(3000, 7000); await tap(Math.random() < 0.5 ? 'KeyS' : 'Space'); }
    await sleep(16);
  }
  await release(true);
  out.wins = wins; out.losses = losses; out.secs = +((Date.now() - T0) / 1000).toFixed(1);
  return out;
}
