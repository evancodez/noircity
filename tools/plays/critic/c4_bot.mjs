// Critic C4: the fist fight by real input, my own hands (not the owner's bot).
//   { "drive": "tools/plays/critic/c4_bot.mjs", "profile": "idle" | "holdW" | "masher" | "bad" | "good",
//     "timeout": ms, "shots": 30 }
// Reads only what a player sees on the screen: the card / teach / warning
// text, the cue (which side goes white), his guard (a side dropped), his
// swing starting, the distance; presses keys and buttons as a person would.
//   idle    nothing
//   holdW   W held the whole time
//   masher  W in, both buttons clicked alternately as fast as a person does
//           (80 .. 140 ms presses every 120 .. 220 ms); never dodges or blocks
//   bad     slow eyes: the cue answered 0.32 .. 0.5 s after it shows, one in
//           four the wrong way, one in four not at all; an opening hit
//           0.45 .. 0.7 s late, the wrong arm one in three; jabs into the
//           guard now and then; a stray S or SPACE
//   good    what the cards taught: the cue answered in 0.17 .. 0.24 s toward
//           the light; the dropped side jabbed with that side's button in
//           0.2 .. 0.3 s; a stunned man or a missed swing punished with a
//           held (loaded) punch; his straight blows blocked with SPACE
// The lesson's cards are obeyed by their words (LEFT CLICK, RIGHT CLICK,
// HOLD, SPACE, the dodge card).
export default async function drive({ js, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts, cursor }) {
  const prof = opts.profile || 'good';
  const T0 = Date.now(), timeout = opts.timeout ?? 360000;
  const rr = (a, b) => a + (b - a) * Math.random();
  const at = () => (cursor ? cursor() : [W / 2, H / 2]);
  const held = new Map();
  const press = async (b, ms) => { const code = 'M' + b; if (held.has(code)) return false; const [x, y] = at(); await mouse('mousePressed', x, y, b); held.set(code, Date.now() + ms); return true; };
  const down = async (code, ms) => { if (!held.has(code)) await keyDown(code); held.set(code, Date.now() + ms); };
  const up = async (code) => { if (!held.has(code)) return; held.delete(code); if (code[0] === 'M') { const [x, y] = at(); await mouse('mouseReleased', x, y, code.slice(1)); } else await keyUp(code); };
  const tap = async (code) => { await keyDown(code); await sleep(45); await keyUp(code); };
  const release = async (all = false) => { const now = Date.now(); for (const [code, t] of [...held]) if (all || now >= t) await up(code); };
  let shots = opts.shots ?? 30, shotN = 0;
  const snap = async (why) => { if (shots <= 0) return; shots--; const n = String(shotN++).padStart(2, '0'); log(`snap ${n} ${why}`); await shot(`${prof}_${n}_${why.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}`); };
  await js(`(() => { const R = window.__c4 = { downs: [], cues: [], hits: [], rounds: {}, texts: [], ends: [] };
    G.on('player:down', () => R.downs.push({ t: +G.time.toFixed(1), r: G.brawl.round, warn: G.hud.warnText, his: Math.round(G.brawl.him.hp) }));
    G.on('brawl:cue', (e) => R.cues.push({ t: +G.time.toFixed(2), rt: performance.now(), clip: e.clip, side: e.side }));
    G.on('brawl:round', (e) => { R.rounds[e.n] = +G.time.toFixed(1); });
    G.on('brawl:end', (e) => R.ends.push({ t: +G.time.toFixed(1), ...e }));
    R.by = {}; R.myHits = { head: 0, guard: 0, air: 0, broke: 0 };
    G.on('brawl:hit', (e) => { const B = G.brawl; if (e.by === 'him' && (e.zone === 'head' || e.zone === 'chip')) { const k = (B.him.clip || B.him.state) + (B.cue ? '' : (B.lastCue && B.lastCue.answer ? '/' + B.lastCue.answer : '')); R.by[k] = (R.by[k] || 0) + 1; }
      if (e.by === 'me' && R.myHits[e.zone] != null) R.myHits[e.zone]++; });
    return 1; })()`);
  const seen = new Set();
  const plans = new Map();
  const L = { cue: [260, 380], wrong: 0.15, miss: 0.1, poke: [1500, 3000], block: 0, open: [300, 450] };
  let probeN = 0, everyAt = Date.now() + (opts.every || 0), openSeen = null, openAt = 0, pokeAt = 0, strayAt = Date.now() + rr(3000, 6000), lastCue = null, lastState = null, fights = 0, prevDowns = 0;
  const out = { profile: prof, texts: [], fights: [] };
  for (;;) {
    const s = await js(`(() => { const B = G.brawl, h = B.him, m = B.me, c = B.c; const e = G.eye; const K = B._cards;
      const cl = h.clip && c.clip ? c.clip(h.clip) : null;
      return { act: !!B.active, fin: !!B.finished, won: !!(B.stats && B.stats.won), round: B.round, st: h.state, clip: h.clip, t: h.t,
        tell: cl && (cl.marks.tell ?? 0), contact: cl && (cl.marks.contact ?? cl.marks.release),
        open: B.active ? B.openSides() : '', missT: h.missT, atSpot: !!h.atSpot, me: m.act, holding: !!m.holding,
        d: c ? Math.hypot(c.pos.x - e.x, c.pos.z - e.z) : 9, les: B.lesson ? B.lesson.kind : null,
        cue: B.cue && !B.cue.done ? B.cue.side : null, cueT: B.cue && B.cue.rec ? B.cue.rec.t0 : null, cueHeld: !!(B.cue && B.cue.held),
        card: K ? K.shownCard : '', flash: K ? K.shownFlash : '', teach: G.hud.kit.teachCur ? G.hud.kit.teachCur.text : '',
        warn: G.hud.warnText || '', say: G.hud.sayShown, obj: G.hud.objectiveText, prompt: G.hud.promptShown, failing: !!G.failing, gst: G.state,
        hp: Math.round(G.health.hp), his: Math.round(h.hp), downs: B.stats ? B.stats.downs : 0, beat: G.scenes.beat, sc: G.scenes.current && G.scenes.current.id,
        wk: +(G.worldK ?? 1).toFixed(2) }; })()`);
    if (!s || s.__exc) { await sleep(100); if (Date.now() - T0 > timeout) break; continue; }
    // every line the screen shows, once each
    for (const [k, v] of [['card', s.card], ['flash', s.flash], ['teach', s.teach], ['warn', s.warn], ['say', s.say], ['obj', s.obj], ['prompt', s.prompt]]) {
      if (!v) continue;
      const key = k + ':' + v;
      if (seen.has(key)) continue;
      seen.add(key);
      out.texts.push(`${(s.round || 0)}|${k}: ${v}`);
      log(`TEXT ${k}: ${v}   (beat ${s.beat}, round ${s.round}, hp ${s.hp}, his ${s.his})`);
      if (k !== 'obj' && k !== 'say') await snap(k + '_' + v);
    }
    if (opts.every && Date.now() >= everyAt) { everyAt = Date.now() + opts.every; await snap('t' + Math.round((Date.now() - T0) / 1000) + '_' + s.st + '_' + (s.les || 'r' + s.round)); }
    if (s.downs > prevDowns && prof === 'learner') {
      const why = await js('(G.brawl.stats.downWhy || []).slice(-1)[0]');
      // he reads the word on the black and does better at that one thing
      if (why === 'late') { L.cue = [Math.max(200, L.cue[0] - 25), Math.max(260, L.cue[1] - 35)]; }
      else if (why === 'wrong') { L.wrong = Math.max(0.03, L.wrong / 2); }
      else if (why === 'answer') { L.poke = [L.poke[0] * 1.6, L.poke[1] * 1.6]; }
      else { L.block = Math.min(0.75, L.block + 0.25); L.open = [Math.max(220, L.open[0] - 30), Math.max(300, L.open[1] - 50)]; }
      log(`LEARN from '${why}': ${JSON.stringify(L)}`);
    }
    if (s.downs > prevDowns) { prevDowns = s.downs; log(`DOWN #${s.downs} round ${s.round} his ${s.his}`); await snap('down' + s.downs);
      // (second look: the word on the black, read off the screen once it is up)
      for (let i = 0; i < 40; i++) { const w = await js('G.brawl.downWhy || null'); if (w) { log(`BLACK #${s.downs}: ${w}`); out.blacks = (out.blacks || []).concat(w); if ((opts.blackShots ?? 3) > (out.blackN || 0)) { out.blackN = (out.blackN || 0) + 1; await sleep(250); await snap('black' + s.downs); } break; } await sleep(60); } }
    if (s.cue && s.cueT !== lastCue && shotN < 6) { await snap('cue_' + s.cue + '_' + s.clip); }
    await release();
    if (!s.act) {
      if (s.fin || s.won || s.beat === 'reel' || s.beat === 'ko' || s.beat === 'outside') { await release(true); out.fights.push({ won: s.won, beat: s.beat, secs: +((Date.now() - T0) / 1000).toFixed(1) }); break; }
      if (Date.now() - T0 > timeout) break;
      await sleep(60); continue;
    }
    if (Date.now() - T0 > timeout) { log('TIMEOUT ' + JSON.stringify(s)); break; }
    const now = Date.now();
    if (prof === 'idle') { await sleep(50); continue; }
    if (prof === 'holdW') { if (!held.has('KeyW')) await down('KeyW', 1e9); await sleep(50); continue; }
    if (s.me === 'down') { await release(true); await sleep(60); continue; }
    // the cue: the side gone white is where to go
    if (s.cue && s.cueT !== lastCue) {
      lastCue = s.cueT;
      let key = s.cue === 'R' ? 'KeyD' : 'KeyA', delay;
      if (prof === 'masher' || prof === 'masher2' || prof === 'wmash' || prof === 'lazy') key = null;
      else if (prof === 'lazydodge') delay = rr(230, 300);
      else if (prof === 'slow') { const r = Math.random(); delay = rr(300, 450); if (r < 0.1) key = null; else if (r < 0.25) key = key === 'KeyD' ? 'KeyA' : 'KeyD'; }
      else if (prof === 'bad') { const r = Math.random(); delay = rr(320, 500); if (r < 0.25) key = null; else if (r < 0.45) key = key === 'KeyD' ? 'KeyA' : 'KeyD'; }
      else if (prof === 'medium') { const r = Math.random(); delay = rr(240, 360); if (r < 0.1) key = null; else if (r < 0.25) key = key === 'KeyD' ? 'KeyA' : 'KeyD'; }
      else if (prof === 'learner') { const r = Math.random(); delay = rr(L.cue[0], L.cue[1]); if (r < L.miss) key = null; else if (r < L.miss + L.wrong) key = key === 'KeyD' ? 'KeyA' : 'KeyD'; }
      else if (prof === 'probe') { const L = opts.delays || [180, 220, 260, 300, 340]; delay = L[probeN++ % L.length]; }
      else if (prof === 'human') delay = rr(230, 300);
      else delay = rr(170, 240);
      const heldRead = opts.ignoreHeld ? (s.cueHeld && !(out.heldSeen = (out.heldSeen || 0) + 1, out.heldSeen > 1)) : s.cueHeld;
      if (s.cueHeld) { out.heldCues = (out.heldCues || []).concat([[+((Date.now() - T0) / 1000).toFixed(1), s.clip, s.wk]]); log(`HELD cue ${s.clip} worldK ${s.wk}`); }
      if (heldRead || s.les) { if (key == null) key = s.cue === 'R' ? 'KeyD' : 'KeyA'; delay = rr(600, 1200); }   // a held card: read it, then do it
      if (key) plans.set('cue', { key, at: now + delay });
    }
    const P = plans.get('cue');
    if (P && now >= P.at) { plans.delete('cue'); await up('KeyW'); await tap(P.key); log(`cue -> ${P.key} (${s.cue || 'gone'})`); }
    if (s.cue) { await sleep(10); continue; }
    // in to arm's length
    const want = s.st === 'reel' ? 1.3 : 1.45;
    if (s.d > want + 0.25 && !held.has('Space')) await down('KeyW', 140);
    // the masher: both buttons, fast
    if (prof === 'wmash' && !held.has('KeyW')) await down('KeyW', 1e9);
    // (second look: a slow random clicker - W held, a click of either button every 2 .. 3 s whatever he does; lazydodge also answers the cue)
    if (prof === 'lazy' || prof === 'lazydodge') {
      if (!held.has('KeyW') && s.d > 1.2) await down('KeyW', 300);
      if (s.les && /KEEP IT PRESSED|HOLD ON/.test((s.card + ' ' + s.teach).toUpperCase()) && s.open && now >= openAt) { await press('left', 950); openAt = now + 1500; await sleep(16); continue; }
      if (s.st === 'reel' && s.atSpot && now >= pokeAt) { pokeAt = now + rr(2000, 3000); await press(Math.random() < 0.5 ? 'left' : 'right', rr(800, 950)); await sleep(16); continue; }
      if (now >= pokeAt) { pokeAt = now + rr(2000, 3000); await press(Math.random() < 0.5 ? 'left' : 'right', rr(80, 160)); }
      await sleep(16); continue;
    }
    if (prof === 'masher' || prof === 'masher2' || prof === 'wmash') {
      if ((prof === 'masher2' || prof === 'wmash') && s.les && /KEEP IT PRESSED|HOLD ON/.test((s.card + ' ' + s.teach).toUpperCase()) && s.open && now >= openAt) { await press('left', 950); openAt = now + 1500; await sleep(16); continue; }
      if (now >= pokeAt) { pokeAt = now + rr(120, 220); await press(Math.random() < 0.5 ? 'left' : 'right', rr(80, 140)); }
      await sleep(16); continue;
    }
    // the lesson, by its words
    const words = (s.card + ' ' + s.teach).toUpperCase();
    if (s.les && s.st !== 'attack') {
      if (now >= openAt) {
        if (/KEEP IT PRESSED|HOLD ON/.test(words) && s.open) { await press(/RIGHT/.test(words) ? 'right' : 'left', rr(800, 1000)); openAt = now + 1600; }
        else if (/LEFT CLICK/.test(words) && (s.open || !/GUARD IS DOWN/.test(words))) { await press('left', rr(70, 160)); openAt = now + rr(700, 1100); }
        else if (/RIGHT CLICK/.test(words) && (s.open || !/GUARD IS DOWN/.test(words))) { await press('right', rr(70, 160)); openAt = now + rr(700, 1100); }
        else if ((/CLICK|OPENING/.test(words)) && s.open) { await press(s.open[0] === 'L' ? 'left' : 'right', rr(70, 160)); openAt = now + rr(700, 1100); }
        else if (/\bE\b|GRAB|\[E\]/.test(words) && s.d < 1.6) { await tap('KeyE'); openAt = now + 1500; }
        if (openAt < now) openAt = now + rr(1000, 1600);
      }
    }
    // his blow coming (no cue): good blocks the straight ones
    if (s.st === 'attack' && s.contact != null && !s.cue) {
      const key = s.clip + '@' + Math.round(s.t * 0 + (s.tell || 0) * 100) + '@' + (lastState || '');
      if (!plans.has('blk:' + s.clip + s.round) && s.t < s.contact) {
        plans.set('blk:' + s.clip + s.round, 1);
        if ((prof === 'good' || prof === 'human') && /jab|cross|answer|bottle/.test(s.clip) && Math.random() < 0.8) { const wait = Math.max(0, (s.tell || 0) + rr(0.18, 0.26) - s.t) * 1000; plans.set('block', { at: now + wait, until: Math.max(150, ((s.contact - s.t) + 0.2) * 1000) }); }
        else if (prof === 'learner' && /jab|cross|answer|bottle/.test(s.clip) && Math.random() < L.block) { const wait = Math.max(0, (s.tell || 0) + rr(0.24, 0.34) - s.t) * 1000; plans.set('block', { at: now + wait, until: Math.max(150, ((s.contact - s.t) + 0.2) * 1000) }); }
        else if (prof === 'slow' && /jab|cross|answer|bottle/.test(s.clip) && Math.random() < 0.35) { const wait = Math.max(0, (s.tell || 0) + rr(0.3, 0.45) - s.t) * 1000; plans.set('block', { at: now + wait, until: Math.max(150, ((s.contact - s.t) + 0.2) * 1000) }); }
        else if (prof === 'bad' && Math.random() < 0.3) plans.set('block', { at: now + rr(250, 500), until: rr(200, 400) });
      }
      void key;
    } else if (s.st !== 'attack') { for (const k of [...plans.keys()]) if (k.startsWith('blk:')) plans.delete(k); }
    const Bk = plans.get('block');
    if (Bk && now >= Bk.at) { plans.delete('block'); await up('KeyW'); await down('Space', Bk.until); }
    lastState = s.st;
    if (s.les) { await sleep(16); continue; }
    if (s.me !== 'idle' || held.has('Mleft') || held.has('Mright') || held.has('Space') || s.d > 1.8) { await sleep(16); continue; }
    // the reel to the window: the finish
    if (s.st === 'reel') { if (s.atSpot && now >= openAt) { await press(Math.random() < 0.5 ? 'left' : 'right', prof !== 'bad' ? rr(750, 900) : rr(60, 900)); openAt = now + 900; } await sleep(16); continue; }
    // an opening
    const look = s.open + ':' + s.st + ':' + (s.missT > 0);
    if (look !== openSeen) { openSeen = look; openAt = now + (prof === 'good' || prof === 'human' || prof === 'probe' ? rr(200, 300) : prof === 'medium' ? rr(300, 450) : prof === 'learner' ? rr(L.open[0], L.open[1]) : rr(450, 700)); }
    if (s.open && now >= openAt && s.st !== 'attack') {
      let side = s.open.length === 2 ? (Math.random() < 0.5 ? 'L' : 'R') : s.open[0];
      if ((prof === 'bad' && Math.random() < 0.33) || (prof === 'slow' && Math.random() < 0.25) || ((prof === 'medium' || prof === 'learner') && Math.random() < 0.15)) side = side === 'L' ? 'R' : 'L';
      const big = s.st === 'stun' || s.missT > 0.35;
      const goodish = prof === 'good' || prof === 'human' || prof === 'probe';
      const ms = goodish ? (big ? rr(650, 850) : rr(70, 150)) : (Math.random() < 0.2 ? rr(500, 900) : rr(90, 250));
      await press(side === 'L' ? 'left' : 'right', ms);
      openAt = now + (goodish ? rr(200, 320) : prof === 'medium' ? rr(300, 500) : rr(400, 700));
    } else if (!s.open && s.st === 'move' && now >= pokeAt) {
      // a jab into his guard now and then (bad often, good seldom)
      pokeAt = now + (prof === 'bad' ? rr(700, 1500) : prof === 'slow' ? rr(3000, 6000) : prof === 'medium' ? rr(1500, 3000) : prof === 'learner' ? rr(L.poke[0], L.poke[1]) : rr(2500, 4500));
      await press(Math.random() < 0.5 ? 'left' : 'right', rr(70, 200));
    }
    if ((prof === 'bad' || prof === 'slow') && now >= strayAt) { strayAt = now + rr(3000, 7000); const k = Math.random() < 0.5 ? 'KeyS' : 'Space'; await tap(k); }
    await sleep(16);
  }
  await release(true);
  const R = await js(`(() => { const R = window.__c4, B = G.brawl, S = B.stats || {}; return { downs: R.downs, ends: R.ends, rounds: R.rounds, cues: S.cues ? { shown: S.cues.shown, right: S.cues.right, wrong: S.cues.wrong, late: S.cues.late, held: S.cues.held, refused: S.cues.refused } : null,
    cueList: S.cues ? S.cues.list.map((c) => [c.clip, c.side, c.answer, c.at]) : null, landed: S.landed, taken: S.taken, dodged: S.dodged, blocked: S.myBlocked, counters: S.counters, hards: S.hards, jabs: S.jabs, time: S.time && +S.time.toFixed(1), won: !!S.won, beat: G.scenes.beat, his: Math.round(B.him.hp) }; })()`);
  const R2 = await js('({ by: window.__c4.by, myHits: window.__c4.myHits, downWhy: G.brawl.stats.downWhy, pounding: G.brawl.stats.pounding, mannerDowns: G.brawl.stats.mannerDowns })');
  return { ...out, ...R, ...R2, secs: +((Date.now() - T0) / 1000).toFixed(1) };
}
