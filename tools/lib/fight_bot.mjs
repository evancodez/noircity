// [C4] The fist fight played by real input, for the three proofs of WAVE_C
// §7 and the click test (docs/story/briefs/C4_FIGHT.md §3, Proofs):
//   { "drive": "tools/lib/fight_bot.mjs", "profile": "idle" | "bad" | "good" | "click",
//     "stop": "expr", "timeout": ms, "fights": n }
//   idle   hands off: nothing pressed (he puts me down, and down again)
//   bad    a clumsy first-timer: mashes jabs into his guard, sees the cue late
//          (0.22 .. 0.55 s) and goes the wrong way a third of the time (less
//          after each time he goes down: he learns), holds a punch now and
//          then at the wrong moment, presses a wrong key now and then
//   good   uses what was taught: reads the dodge cue in 0.16 .. 0.26 s and
//          slips toward the light, punishes the opening a slip leaves with a
//          loaded punch (held to the second or third tick), jabs the side he
//          drops, blocks his jab now and then, takes a bottle when it is
//          slid to him; the finish with a loaded punch
//   click  the click test: him standing with his guard down, doing nothing;
//          each button pressed 30 times at each of 60, 120, 200, 280 ms,
//          shuffled, 0.12 .. 0.55 s apart: every press must start a jab in
//          its step and reach its contact within 0.08 s
// A fight is followed to its end (won: the last blow) or `stop`; with
// fights: 2 the fight is begun again from its lesson beat after the first is
// won (a chapter retry) and played again.
// Returns { profile, fights: [{ won, time, downs, cues, lesson }], presses, ... }.
export default async function drive({ js, keyDown, keyUp, mouse, log, sleep, W, H, opts, cursor }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 400000;
  const prof = opts.profile || 'good';
  const rr = (a, b) => a + (b - a) * Math.random();
  const at = () => (cursor ? cursor() : [W / 2, H / 2]);
  const held = new Map();
  const press = async (b, ms) => { const code = 'M' + b; if (held.has(code)) return; const [x, y] = at(); await mouse('mousePressed', x, y, b); held.set(code, Date.now() + ms); };
  const down = async (code, ms) => { if (!held.has(code)) await keyDown(code); held.set(code, Date.now() + ms); };
  const tap = async (code) => { await keyDown(code); await sleep(35); await keyUp(code); };
  const release = async (all = false) => {
    const now = Date.now();
    for (const [code, t] of [...held]) {
      if (!all && now < t) continue;
      held.delete(code);
      if (code[0] === 'M') { const [x, y] = at(); await mouse('mouseReleased', x, y, code.slice(1)); } else await keyUp(code);
    }
  };
  const armB = (s) => (s === 'L' ? 'left' : 'right');
  // ---- the click test --------------------------------------------------------------------
  if (prof === 'click') {
    await js(`(() => { const B = G.brawl; B.lesson = null; B.lessonHold = true; B.holdStill = true; B.cards.card(''); { const C = G.controller, e = G.eye, lx = -Math.sin(C.yaw), lz = -Math.cos(C.yaw); B.c.place({ x: e.x + lx * 1.25, z: e.z + lz * 1.25 }, Math.atan2(-lx, -lz)); } B.stats.jabAir = 0; B.stats.landed = 0; B.stats.winds = 0; B.stats.hards = 0; B.him.taunt = 'LR'; B.him.next = 99; B.stats.clicks = []; B.stats.presses = 0; G.health.hp = 100; return 1; })()`);
    const lens = [];
    for (const b of ['left', 'right']) for (const ms of [60, 120, 200, 280]) for (let i = 0; i < (opts.n ?? 30); i++) lens.push([b, ms]);
    for (let i = lens.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lens[i], lens[j]] = [lens[j], lens[i]]; }
    let sent = 0, windsSeen = 0;
    const lensSeen = [];
    // (in to arm's length of him first: every jab within his reach)
    for (let k = 0; k < 60; k++) {
      const d = await js('Math.hypot(G.brawl.c.pos.x - G.eye.x, G.brawl.c.pos.z - G.eye.z)');
      if (d < 1.35) break;
      await keyDown('KeyW'); await sleep(120); await keyUp('KeyW');
    }
    for (const [b, ms] of lens) {
      if (Date.now() - T0 > timeout) break;
      // (he stays where he is and does nothing: a dummy for the hands)
      await js(`(() => { const B = G.brawl; { const C = G.controller, e = G.eye, lx = -Math.sin(C.yaw), lz = -Math.cos(C.yaw); if (Math.hypot(B.c.pos.x - e.x, B.c.pos.z - e.z) > 1.32 && B.him.state === 'move') B.c.place({ x: e.x + lx * 1.25, z: e.z + lz * 1.25 }, Math.atan2(-lx, -lz)); } B.him.coverT = 0; B.him.combo = 0; B.him.taunt = 'LR'; B.him.next = 99; G.health.hp = 100; B.him.hp = B.max; B.c.hp = B.max; B.him.mannerT = B.T; return 1; })()`);
      const [x, y] = at();
      await mouse('mousePressed', x, y, b);
      await sleep(ms);
      await mouse('mouseReleased', x, y, b);
      sent++;
      await sleep(rr(120, 550));
      // (the press's length as the page saw it - its events' own times: a
      // loaded machine stretches some of the bot's presses past what was asked)
      const code = b === 'left' ? 'Mouse0' : 'Mouse2';
      const r = await js(`(() => { const s = G.brawl.stamps['${code}']; return { d: s && s.up != null ? +((s.up - s.down) / 1000).toFixed(3) : null, winds: G.brawl.stats.winds || 0 }; })()`);
      if (r && !r.__exc) { lensSeen.push([ms, r.d, r.winds > windsSeen]); windsSeen = r.winds; }
    }
    await sleep(500);
    // (a click is a press up to 0.3 s as the page saw it: none of them may wind)
    const clickWinds = lensSeen.filter((x) => x[1] != null && x[1] <= 0.3 && x[2]).length;
    const stretched = lensSeen.filter((x) => x[1] != null && x[1] > 0.3).map((x) => x[1]);
    const R = await js(`(() => { const S = G.brawl.stats; const C = S.clicks || []; const lat = C.map((c) => c[3] == null ? null : +(c[3] - c[1]).toFixed(3)); const pressed = S.presses || 0;
      return { pressed, air: S.jabAir || 0, landed: S.landed, jabs: C.length, contacts: lat.filter((v) => v != null).length, late: lat.filter((v) => v == null || v > 0.08).length, max: Math.max(...lat.filter((v) => v != null)), mean: +(lat.filter((v) => v != null).reduce((a, v) => a + v, 0) / Math.max(1, lat.filter((v) => v != null).length)).toFixed(3), winds: S.winds || 0, hards: S.hards || 0 }; })()`);
    return { profile: prof, sent, ...R, clickWinds, stretched, longest: Math.max(...lensSeen.map((x) => x[1] || 0)), secs: +((Date.now() - T0) / 1000).toFixed(1) };
  }
  // ---- a fight -----------------------------------------------------------------------------------
  const fights = [];
  const nFights = opts.fights ?? 1;
  let plans = new Map(), seen = null, seenAt = 0, lastSide = 'R', lessonStep = 0, lessonAt = 0, pokeAt = 0, wrongAt = Date.now() + rr(3000, 6000), grabAt = 0;
  let downsSeen = 0;
  const ST = `(() => { const B = G.brawl; const f = { beat: G.scenes.beat, scene: G.scenes.current && G.scenes.current.id, failing: !!G.failing };
    if (!B.active) return { off: true, finished: !!B.finished, won: !!B.stats.won, ...f };
    const h = B.him, m = B.me, c = B.c, e = G.eye, cl = h.clip ? c.clip(h.clip) : null;
    return { ...f, round: B.round, state: h.state, clip: h.clip, t: h.t, tell: cl && (cl.marks.tell ?? 0), contact: cl && (cl.marks.contact ?? cl.marks.release), open: B.openSides(), missT: h.missT, atSpot: !!h.atSpot,
      me: m.act, holding: !!m.holding, reach: !!B.reachable(), his: B.stats.his || 0, d: Math.hypot(c.pos.x - e.x, c.pos.z - e.z), lesson: B.lesson ? B.lesson.step : 0, kind: B.lesson ? B.lesson.kind : null,
      cue: B.cue && !B.cue.done ? B.cue.side : null, cueId: B.cue ? B.cue.rec.t0 : null, downs: B.stats.downs, hp: G.health.hp, bounced: !!(B.lesson && B.lesson.bounced), black: B.blackT > 0 }; })()`;
  const recordFight = async () => js(`(() => { const S = G.brawl.stats, C = S.cues || {}; return { won: !!S.won, time: +S.time.toFixed(1), downs: S.downs, lesson: S.lesson ?? null, cues: [C.shown || 0, C.right || 0, C.wrong || 0, C.late || 0, C.act || 0], why: (S.downWhy || []).join(','), warned: (S.downWarned || []).map((v) => v == null ? null : +v.toFixed(2)), spared: S.spared || 0, landed: S.landed, jabs: S.jabs, hards: S.levels || [0, 0, 0], manner: G.brawl.him && G.brawl.him.manner, hp: G.brawl.him && +G.brawl.him.hp.toFixed(1) }; })()`);
  // (the bad player learns: his wrong reads fewer after each time he goes down)
  const badWrong = () => Math.max(0.12, 0.32 - 0.05 * downsSeen);
  for (;;) {
    const now = Date.now();
    await release();
    if (now - T0 > timeout) { log(`fight_bot ${prof}: timeout`); break; }
    const s = await js(ST);
    if (!s || s.__exc) { await sleep(100); continue; }
    if (opts.stop && (await js(opts.stop)) === true) { await release(true); fights.push(await recordFight()); break; }
    if (s.off) {
      if (s.won) {
        await release(true);
        fights.push(await recordFight());
        log(`fight_bot ${prof}: fight ${fights.length} won ${JSON.stringify(fights[fights.length - 1])}`);
        if (fights.length >= nFights) break;
        // (begun again, as a chapter retry would: the lesson's beat)
        await sleep(1500);
        await js(`(G.scenes.go('fight', { beat: 'lesson', fade: 'black', card: false }), 1)`);
        for (let k = 0; k < 100; k++) { await sleep(100); if ((await js('G.brawl.active && !G.scenes.trans')) === true) break; }
        plans = new Map(); downsSeen = 0;
        continue;
      }
      await sleep(80); continue;
    }
    if (s.me === 'down' || s.black) { if (s.downs > downsSeen) downsSeen = s.downs; await release(true); await sleep(60); continue; }
    if (prof === 'idle') { await sleep(120); continue; }
    // (the clumsy hands: a wrong key now and then)
    if (prof === 'bad' && now > wrongAt) { wrongAt = now + rr(4000, 9000); await tap(['KeyQ', 'KeyF', 'KeyC', 'KeyR'][Math.floor(Math.random() * 4)]); }
    // ---- the dodge cue
    if (s.cue) {
      const key = 'cue@' + s.cueId;
      if (!plans.has(key)) {
        const safe = s.cue === 'R' ? 'KeyD' : 'KeyA', wrong = s.cue === 'R' ? 'KeyA' : 'KeyD';
        let act = safe, rt = rr(160, 260);
        if (prof === 'bad') { rt = rr(200, 460); if (Math.random() < badWrong()) act = wrong; if (!s.lesson && Math.random() < 0.15) act = null; }
        if (s.lesson && prof === 'bad') rt = rr(220, 520);
        plans.set(key, { act, at: now + rt });
      }
      const P = plans.get(key);
      if (P.act && now >= P.at) { const a = P.act; P.act = null; if (held.has('KeyW')) { held.delete('KeyW'); await keyUp('KeyW'); } await tap(a); }
      await sleep(5); continue;
    }
    // ---- distance: W in to arm's length
    const want = s.state === 'reel' ? (s.atSpot ? 1.35 : 2.6) : s.kind === 'throw' ? 3.0 : 1.4;
    if (!held.has('Space') && s.d > want + 0.2) await down('KeyW', 140);
    // ---- the lesson: what each card asks, a moment after it shows
    if (['jabL', 'jabR', 'guard', 'hold'].includes(s.kind) && s.state !== 'attack') {
      if (s.lesson !== lessonStep) { lessonStep = s.lesson; lessonAt = now + (prof === 'bad' ? rr(1600, 2600) : rr(900, 1400)); }
      if (now > lessonAt && s.me === 'idle' && s.d < 1.75) {
        if (s.kind === 'hold') { if (s.open) { await press(Math.random() < 0.5 ? 'left' : 'right', prof === 'bad' && Math.random() < 0.4 ? rr(150, 380) : rr(720, 950)); lessonAt = now + 1500; } }
        else if (s.open) { await press(armB(prof === 'bad' && Math.random() < 0.3 ? (s.open[0] === 'L' ? 'R' : 'L') : s.open[0]), rr(70, 200)); lessonAt = now + rr(600, 1000); }
        else if (s.kind === 'guard' && !s.bounced) { await press(Math.random() < 0.5 ? 'left' : 'right', 90); lessonAt = now + 1000; }
      }
      await sleep(16); continue;
    }
    if (s.kind === 'grab') { if (s.reach) await tap('KeyE'); await sleep(200); continue; }
    // ---- his blow (no cue yet): a straight one is blocked or stepped from by
    // the good player a moment after its tell; the bad one mostly just takes it
    if (s.state === 'attack' && s.contact != null) {
      const key = s.clip + '@' + s.his;
      if (!plans.has(key)) {
        let act = null;
        const straight = /^br_(jab|jabR|cross|answerL|answerR)$/.test(s.clip);
        if (prof === 'good' && straight) act = Math.random() < 0.5 ? 'block' : Math.random() < 0.5 ? 'KeyA' : 'KeyD';
        if (prof === 'bad' && straight && Math.random() < 0.25) act = Math.random() < 0.5 ? 'block' : 'KeyS';
        if (s.kind === 'block') act = prof === 'bad' && Math.random() < 0.5 ? null : 'block';   // (the card asks for it)
        plans.set(key, { act, at: now + (prof === 'good' ? rr(180, 260) : rr(300, 450)) - (s.t - s.tell) * 1000 });
      }
      const P = plans.get(key);
      if (P.act && now >= P.at) {
        const a = P.act; P.act = null;
        if (a === 'block') await down('Space', Math.max(150, (s.contact - s.t + 0.2) * 1000)); else await tap(a);
      }
      // (the bad one swings into his blows; the good one waits it out)
      if (prof === 'bad' && Math.random() < 0.05 && s.me === 'idle') await press(Math.random() < 0.5 ? 'left' : 'right', rr(60, 180));
      if (s.t < s.contact + 0.05) { await sleep(10); continue; }
    }
    if (held.has('Mleft') || held.has('Mright') || held.has('Space')) { await sleep(12); continue; }
    if (s.me !== 'idle' && s.me !== 'jab' && s.me !== 'bounce') { await sleep(12); continue; }
    if (s.d > 1.75) { await sleep(16); continue; }
    // ---- out on his feet at the window: the last blow, loaded
    if (s.state === 'reel') {
      if (s.atSpot && s.me === 'idle') { if (prof === 'bad' && Math.random() < 0.5) await press(Math.random() < 0.5 ? 'left' : 'right', rr(80, 200)); else await press(Math.random() < 0.5 ? 'left' : 'right', rr(720, 950)); }
      await sleep(prof === 'bad' ? 300 : 120); continue;
    }
    // ---- the bad player mashes: a jab every 0.15 .. 0.4 s at whatever he sees
    if (prof === 'bad') {
      // (he learns, a little, each time he goes down - the black said why:
      // fewer punches thrown blind, more of them at a side he has dropped)
      const learnt = Math.min(4, downsSeen);
      if (now > pokeAt) {
        pokeAt = now + rr(150 + 90 * learnt, 420 + 140 * learnt);
        // (his guard up: after a down or two, he holds back now and then)
        if (s.open || Math.random() >= 0.2 * learnt) {
          const side = s.open && Math.random() < 0.35 + 0.13 * learnt ? s.open[0] : Math.random() < 0.5 ? 'L' : 'R';
          await press(armB(side), Math.random() < 0.05 ? rr(700, 900) : rr(60, 220));
        }
      }
      await sleep(16); continue;
    }
    // ---- the good player: the opening, seen a beat late
    const look = s.open + ':' + s.state + ':' + (s.missT > 0);
    if (look !== seen) { seen = look; seenAt = now + (s.missT > 0 ? rr(120, 200) : rr(200, 330)); }
    if (now < seenAt) { await sleep(10); continue; }
    if (s.holding && s.state !== 'attack') { await press('right', Math.random() < 0.3 ? 800 : 90); seenAt = now + 700; continue; }
    if (s.open) {
      const side = s.open.length === 2 ? (lastSide = lastSide === 'L' ? 'R' : 'L') : s.open;
      const big = s.state === 'stun' || s.missT > 0.4;
      await press(armB(side), big ? (s.state === 'stun' ? rr(720, 900) : rr(640, 800)) : rr(70, 180));
      seenAt = now + rr(200, 320);
    } else if (s.round >= 2 && s.reach && s.state === 'move' && now > grabAt) { grabAt = now + 9000; await tap('KeyE'); }
    await sleep(12);
  }
  await release(true);
  return { profile: prof, fights, won: fights.filter((f) => f.won).length, secs: +((Date.now() - T0) / 1000).toFixed(1) };
}
