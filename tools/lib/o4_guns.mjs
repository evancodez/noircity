// [O4] A copy of the gun kit's driver (tools/lib/c2_guns.mjs, lane C2) for
// lane O4's street shootout (src/scenes/94_o4.js 'street'): the scene is an
// option (opts.scene, default 'o4'), and a 'medium' profile (the critic's
// medium hands: between the good and the clumsy). The rest is C2's, as the
// seam says (copy it for a contest's own proofs).
// [C2] The gun kit's test bed (src/scenes/91_guns.js) by real input
// (tools/play.mjs { "drive": "tools/lib/c2_guns.mjs", "profile": ..., "beats": [...] }).
// For each beat named, the page is sent to it (scenes.go, as a checkpoint
// would) and a player of the profile plays it until it is won or lost
// `tries` times; the record says, per beat, each try's end (won / the
// fall's reason), its time, the warning seen before a fall, the shots
// fired and landed.
//   idle  the player does nothing at all
//   bad   stands where he is put and trades shots in the open: sees a man
//         0.4 .. 0.75 s after he shows, turns onto him at a hand's pace with
//         a wide error, fires, never gets down, reloads standing
//   good  gets behind the beat's cover, down (C), rises (RMB held) when a man
//         shows over it, fires 1 - 2 aimed rounds, drops; reloads down;
//         moves to the next cover when a man has his angle down there;
//         keeps down through a Tommy gun's burst and rises when it stops;
//         answers the heavy at once. Reactions 300 .. 550 ms; the aim's
//         error tuned for 60 - 70 % of aimed rounds landing.
//   clumsy the first-timer of WAVE_C §7 (who was taught the cover, and
//         uses it badly): slow (reactions 550 .. 900 ms), a wide hand, now
//         and then stays up over the cover a second too long, reloads where
//         he stands, gets down late on a new spot, presses a wrong key, moves
//         only when it is bad - fails some, gets through in three tries
const PROFILES = {
  idle: { act: false },
  bad: { act: true, cover: false, react: [450, 800], errM: 0.4, settle: [120, 260], gap: [250, 450], renotice: 600 },
  good: { act: true, cover: true, react: [300, 550], errM: 0.29, settle: [60, 120], gap: [380, 620], burst: [1, 1], down: [450, 800], shadows: true, duck: [120, 260], watchFlank: true },
  clumsy: { act: true, cover: true, react: [550, 900], errM: 0.42, settle: [100, 220], gap: [420, 700], burst: [1, 2], down: [350, 700],
    upLong: 0.35, standReload: 0.3, crouchLate: [500, 1400], wrongKey: 0.12, lateMove: true, duck: [300, 550], learns: true },
  // [O4] the critic's medium hands: slower than good, not clumsy
  medium: { act: true, cover: true, react: [420, 700], errM: 0.35, settle: [80, 170], gap: [400, 650], burst: [1, 2], down: [400, 750],
    upLong: 0.15, standReload: 0.1, crouchLate: [300, 800], duck: [200, 420], learns: true, watchFlank: true },
};
PROFILES.bad = PROFILES.clumsy;

export default async function drive({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts }) {
  const P = PROFILES[opts.profile || 'good'];
  const beats = opts.beats || ['street'];
  const SCENE = opts.scene || 'o4';
  const tries = opts.tries ?? 3, beatTimeout = (opts.beatTimeout ?? 120) * 1000;
  const rr = (a, b) => a + (b - a) * Math.random();
  const cx = W / 2, cy = H / 2;
  const held = new Set();
  const set = async (code, on) => {
    if (on && !held.has(code)) { held.add(code); if (code === 'RMB') await mouse('mousePressed', cx, cy, 'right'); else await keyDown(code); }
    else if (!on && held.has(code)) { held.delete(code); if (code === 'RMB') await mouse('mouseReleased', cx, cy, 'right'); else await keyUp(code); }
  };
  const tap = async (code) => { await keyDown(code); await sleep(45); await keyUp(code); };
  const click = async () => { await mouse('mousePressed', cx, cy, 'left'); await sleep(40); await mouse('mouseReleased', cx, cy, 'left'); };
  const releaseAll = async () => { for (const c of [...held]) await set(c, false); };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const rec = { profile: opts.profile || 'good', beats: {} };
  // the page's state, one read
  const ST = `(() => {
    const G = N.game, C = N.controller, e = G.eye, sc = G.scenes, K = G.guns, W = G.player.weapons.active;
    const V = N.THREE.Vector3, F = sc.ctx && sc.ctx.flags.c2;
    const men = [];
    for (const [h, a] of G.ais) {
      if (!h.alive) continue;
      const c = new V().setFromMatrixPosition(h.bones.chest.matrixWorld);
      const hd = new V().setFromMatrixPosition(h.bones.head.matrixWorld);
      const S = a.brain && a.brain.S;
      const see = K && K.see(e, c, 0.3);
      // (his shadow on a frosted pane: nothing but glass between us, and the
      // pane near him shows him - a person shoots the shadow through it)
      let shade = false;
      if (K && !see) { const d = c.clone().sub(e); const L = d.length(); d.divideScalar(L); shade = !G.rays.raycast(e, d, L - 0.3, { anyHit: true, skip: (q) => !!q.mesh.userData.pane }) && !!G.rays.raycast(e, d, L - 0.3, { anyHit: true }); }
      men.push({ id: h.slot, x: c.x, y: c.y, z: c.z, hy: hd.y, fx: h.pos.x, fz: h.pos.z, see, seeH: K && K.see(e, hd, 0.2), shade,
        kind: a.brain && a.brain.kind, st: S && S.state, line: !!(a.brain && a.brain.hasLine), entry: !!(S && S.entry), d: Math.hypot(c.x - e.x, c.z - e.z) });
    }
    const BEATS = ${JSON.stringify(beats)};
    return { scene: sc.current && sc.current.id, beat: sc.beat, trans: !!sc.trans, fade: sc.fadeK, failing: !!G.failing, dead: G.health.dead, hp: G.health.hp,
      x: C.pos.x, z: C.pos.z, ex: e.x, ey: e.y, ez: e.z, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, mode: C.mode, ck: C.crouchK || 0, rk: C.riseK || 0, on: !!C.crouchOn,
      ammo: W ? W.ammo : 0, reloading: !!(W && W.reloading), gun: G.player.weapons.current, men, spots: F ? F.spots : [], open: F ? F.open : null, won: !!(F && F.won),
      flankId: K && K.flank && !K.flank.done && K.flank.ai.h.alive ? K.flank.ai.h.slot : null,
      broke: K ? K.events.filter((q) => q.what === 'break' && G.time - q.t < 1.2 && q.at && Math.hypot(q.at[0] - e.x, q.at[1] - e.z) < 2.2).length : 0, wins: (G._c2won || []).length, fails: Object.fromEntries(BEATS.map((b) => [b, G.fails(b, '${SCENE}')])), why: G.lastFail ? G.lastFail.why : null, warnedFor: G.lastFail ? G.lastFail.warnedFor : null, nFails: G.counters.fails || 0, shots: G.counters.shots, hits: G.counters.hits, warn: G.hud.warnText || null, aimSlot: N.pad && N.pad.aimed && N.pad.aimedHood ? N.pad.aimedHood.slot : null };   // [O7] (the pad's aim help holding a man)
  })()`;
  // the beat's cover spot hidden from the most men as they stand now (then the nearest)
  const BEST = `(() => { const G = N.game, K = G.guns, F = G.scenes.ctx && G.scenes.ctx.flags.c2, V = N.THREE.Vector3;
    if (!F || !F.spots.length) return null;
    const men = [...G.ais.keys()].filter((h) => h.alive);
    let best = null;
    for (const sp of [...F.spots, { x: G.controller.pos.x, z: G.controller.pos.z, here: true }]) {
      const eye = new V(sp.x, G.stage.surfaceY(sp.x, sp.z) + 0.66, sp.z);
      let n = 0;
      for (const h of men) if (K.see(new V(h.pos.x, h.pos.y + 1.55, h.pos.z), eye, 0.3)) n++;
      // (where I am is worse once it is spent: hit down there, or its cover shot through - window.C2SPENT)
      const sc = n * 10 + Math.hypot(sp.x - G.eye.x, sp.z - G.eye.z) + (sp.here ? -1 + (window.C2SPENT ? 12 : 0) : 0);
      if (!best || sc < best.sc) best = { x: sp.x, z: sp.z, yaw: sp.yaw, sc, n, here: !!sp.here };
    }
    return best; })()`;
  const yawTo = (s, x, z) => Math.atan2(-(x - s.ex), -(z - s.ez));
  const pitchTo = (s, x, y, z) => Math.atan2(y - s.ey, Math.hypot(x - s.ex, z - s.ez));
  // turn toward (yaw, pitch) at a hand's pace; returns the error left
  const aim = async (s, yaw, pitch, gain = 0.6, max = 0.22) => {
    const ey = wrap(yaw - s.yaw), ep = pitch - s.pitch;
    const dy = Math.max(-max, Math.min(max, ey * gain)), dp = Math.max(-max, Math.min(max, ep * gain));
    const mx = Math.round(-dy / s.sens), my = Math.round(-dp / s.sens);
    if (mx || my) await turn(mx, my);
    return Math.hypot(ey, ep);
  };
  // walk toward (x, z) by W and the mouse; true once there
  const walkTo = async (s, x, z, tol = 0.3) => {
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d < tol) { await set('KeyW', false); return true; }
    const err = await aim(s, Math.atan2(-dx, -dz), -0.05, 0.6, 0.3);
    await set('KeyW', err < 0.6);
    return false;
  };

  const P0 = { ...P };
  for (const beat of beats) {
    const B = rec.beats[beat] = { tries: [] };
    // (a new contest: the hand as it was; what a fall taught it is for the retries of that contest)
    Object.assign(P, P0);
    for (let k = 0; k < tries; k++) {
      await releaseAll();
      // to the beat, as a checkpoint puts me there
      await js(`(N.game.o4stay = true, N.game.scenes.go('${SCENE}', { beat: '${beat}', fade: 'cut', card: false }), 1)`);
      await sleep(400);
      const t0 = Date.now();
      const g0 = await js('N.game.time');
      let s0 = await js(ST);
      const fails0 = s0.nFails, shots0 = s0.shots, hits0 = s0.hits, wins0 = s0.wins;
      const dbg = {}, noticed = new Map(), visAt = new Map(); let lastSeenAt = null, tellAt = 0, lastUp = Date.now(), upAt = 0, snapT = 0, target = null, seenAt = 0, onSpot = null, goTo = null, moveCool = 0, downUntil = 0, burstLeft = 0, lastShot = 0, warnedBefore = false, lowHp = 100, prevHp = 100, duckAt = 0, holdUpUntil = 0, hitTimes = [], outThere = false, answerUntil = 0, answerId = null, traceT = 0;
      let end = null;
      while (!end) {
        const s = await js(ST);
        if (!s || s.__exc) { await sleep(150); dbg['exc'] = (dbg['exc'] || 0) + 1; continue; }
        lowHp = Math.min(lowHp, s.hp);
        // (hit while up over the cover: a person's reflex is down - a reaction later)
        if (s.hp < prevHp - 0.5) hitTimes.push(Date.now());
        while (hitTimes.length && Date.now() - hitTimes[0] > 1500) hitTimes.shift();
        if (P.duck && s.hp < prevHp - 0.5 && s.rk > 0.5 && (answerId == null || hitTimes.length >= 2) && !duckAt) duckAt = Date.now() + rr(P.duck[0], P.duck[1]);
        prevHp = s.hp;
        if (duckAt && Date.now() >= duckAt) { duckAt = 0; holdUpUntil = 0; answerUntil = 0; answerId = null; await set('RMB', false); downUntil = Date.now() + rr(500, 900); tellAt = 0; }
        // (opts.snaps: a frame every so many seconds, to look at what the play did)
        if (opts.snaps && Date.now() - (snapT || 0) > opts.snaps * 1000) { snapT = Date.now(); await shot(`${rec.profile}_${beat}_${k}_${Math.round((Date.now() - t0) / 1000)}`); log(`snap ${JSON.stringify({ hp: Math.round(s.hp), ck: +s.ck.toFixed(2), rk: +s.rk.toFixed(2), on: s.on, x: +s.x.toFixed(2), z: +s.z.toFixed(2), ammo: s.ammo, men: s.men.map((m) => `${m.st}${m.line ? '!' : ''}${m.see ? '*' : ''}@${m.fx.toFixed(1)},${m.fz.toFixed(1)}`), dbg })}`); }
        if (s.warn) warnedBefore = true;
        if (Date.now() - t0 > beatTimeout) { end = { won: false, why: 'timeout', men: s.men.map((q) => `${q.kind}:${q.st}@${q.fx.toFixed(1)},${q.fz.toFixed(1)}`), hpMen: await js('[...N.game.ais.keys()].filter(h => h.alive).map(h => Math.round(h.hp))') }; break; }
        if (s.nFails > fails0 || s.failing || s.dead) {
          // the fall (game.fail): the warning's time up before it, the reason, the way back
          await releaseAll();
          const f = await js(ST);
          for (let w = 0; w < 30; w++) { const q = await js(ST); if (q && !q.failing && !q.dead && q.beat === beat && q.fade < 0.5) break; await sleep(250); }
          // (how fast it went: the first round into me to the fall, in game seconds, and how many)
          const hd = await js(`(() => { const E = N.game.guns.events; const h = E.filter((e) => e.what === 'hit' && e.t >= ${g0}); const d = E.filter((e) => e.what === 'down' && e.t >= ${g0}); return { first: h.length ? h[0].t : null, down: d.length ? d[0].t : null, n: h.length }; })()`);
          end = { won: false, why: f.why, warnedFor: f.warnedFor, warned: f.warnedFor != null && f.warnedFor >= 1, downIn: hd && hd.first != null && hd.down != null ? +(hd.down - hd.first).toFixed(1) : null, hitsTaken: hd ? hd.n : null };
          break;
        }
        // (won: the scene's own record of it; a page that went back to the title is no win)
        if (s.wins > wins0) { end = { won: true }; break; }
        if (s.scene !== SCENE) { end = { won: false, why: 'left the scene (page reloaded?)' }; break; }
        if (!P.act || s.trans || s.fade > 0.5) { await sleep(120); dbg['idle'] = (dbg['idle'] || 0) + 1; continue; }
        const now = Date.now();
        // ---- reload: empty -> down (good) and R
        if (s.ammo <= 0 && !s.reloading) {
          await set('RMB', false);
          if (P.cover && s.ck < 0.5 && !s.on && !(P.standReload && Math.random() < P.standReload)) await tap('KeyC');
          await tap('KeyR'); await sleep(rr(200, 350)); dbg['reloadTap'] = (dbg['reloadTap'] || 0) + 1; continue;
        }
        if (s.reloading) { await set('RMB', false); await sleep(100); dbg['reloading'] = (dbg['reloading'] || 0) + 1; continue; }
        if (!P.cover && s.on) { await tap('KeyC'); await sleep(60); continue; }
        // (the bad player out into the open first, where the beat has one: the street's pavement)
        if (!P.cover && s.open && !outThere) { if (await walkTo(s, s.open.x, s.open.z, 0.4)) outThere = true; else { await sleep(40); continue; } }
        const men = s.men.filter((m) => !m.entry || m.see);
        // ---- the good player: cover first
        let threat = null;
        if (P.cover) {
          // the men who have a line on me and whom I can see (a flanker in the open)
          // (a man who has me while I am DOWN: one who has my side - not one who sees me because I rose to shoot)
          // (a man coming in through a door with a line on me is one too)
          const threats = s.rk < 0.3 ? s.men.filter((m) => m.line && m.see) : [];
          // (the warning says move: a man has my angle, one is going round, my cover is going - the good hand moves)
          const pressed = P.lateMove ? (threats.length >= 2 || (threats.length >= 1 && s.hp < 25)) : threats.length >= 2 || (threats.length >= 1 && s.hp < 40) || s.broke > 0 || (s.warn && /cover|angle|going round/.test(s.warn));
          if (!onSpot || (pressed && now > moveCool)) {
            // the spot hidden best from the men as they stand now, near
            if (!goTo || pressed) {
              // ([C2] after the critic: the warning that the cover will not hold says this spot is spent, as a break or a hit down here does)
              const spent = s.broke > 0 || (hitTimes.length > 0 && s.rk < 0.3) || !!(s.warn && /won.t hold/.test(s.warn));
              goTo = await js(`(window.C2SPENT = ${spent ? 1 : 0}, ${BEST})`); moveCool = now + (P.lateMove ? 7000 : 4500);
              // (better where I am than anywhere else: I stay and answer them)
              if (goTo && goTo.here && onSpot) goTo = null;
              else { onSpot = null; await set('RMB', false); }
            }
            if (goTo && !(await walkTo(s, goTo.x, goTo.z, 0.35))) { await sleep(40); dbg['walking'] = (dbg['walking'] || 0) + 1; continue; }
            onSpot = goTo || onSpot || { x: s.x, z: s.z }; goTo = null;
            await set('KeyW', false);
          }
          if (!s.on) {
            if (P.crouchLate) { if (!onSpot.lateT) onSpot.lateT = now + rr(P.crouchLate[0], P.crouchLate[1]); if (now < onSpot.lateT) { await sleep(60); continue; } }
            if (P.wrongKey && Math.random() < P.wrongKey) { await tap(Math.random() < 0.5 ? 'KeyV' : 'KeyX'); await sleep(rr(200, 400)); }
            await tap('KeyC'); await sleep(60); dbg['crouchTap'] = (dbg['crouchTap'] || 0) + 1; continue;
          }
          // a man who has me from the open: answered from where I am (no need to rise)
          threat = threats.sort((a, b) => a.d - b.d)[0] || null;
        }
        // ---- the target: the nearest that shows (from risen, for the good player: what he would see over it)
        // (a shadow on frosted glass is a target for a hand that was shown it: profile.shadows)
        const visible = men.filter((m) => m.see || m.seeH || (P.shadows && m.shade));
        // (bad: out of sight a moment and back: a new reaction before the shot)
        if (P.renotice) for (const m of visible) { if (now - (visAt.get(m.id) || 0) > P.renotice) noticed.set(m.id, now + rr(P.react[0], P.react[1])); visAt.set(m.id, now); }
        // (the man I am answering, first: not the one across the street)
        if (answerId != null) { const a = visible.find((q) => q.id === answerId); if (a) { visible.length = 0; visible.push(a); } }
        // (where each was last seen: the angle a player holds - the doorway he peeks from)
        for (const m of visible) lastSeenAt = { x: m.x, y: m.see ? m.y : m.hy - 0.05, z: m.z, t: now };
        const heavy = s.men.find((m) => m.kind === 'rusher' && m.d < 9);
        if (opts.trace && now - (traceT || 0) > opts.trace) { traceT = now; log(`trace ${JSON.stringify({ t: Math.round((now - t0) / 100) / 10, hp: Math.round(s.hp), rk: +s.rk.toFixed(2), x: +s.x.toFixed(1), z: +s.z.toFixed(1), thr: threat && threat.id, ans: answerId, goTo: !!goTo, vis: visible.map((q) => q.id + q.kind[0]), men: s.men.map((q) => q.id + q.kind[0] + ":" + q.st + (q.line ? "!" : "") + (q.see ? "*" : "")) })}`); }
        const tommyFiring = s.men.some((m) => m.kind === 'tommy' && m.st === 'fire');
        if (P.cover && threat) { answerUntil = now + 1400; answerId = threat.id; }
        // (the man I am answering: while he lives and has me, I stay up on him)
        if (answerId != null && s.men.some((m) => m.id === answerId && m.line)) answerUntil = Math.max(answerUntil, now + 500);
        else if (answerId != null && now > answerUntil) answerId = null;
        if (P.cover && threat) {
          // (a man who has me while I am down is on my side of what I hide
          // behind: answered from where I am, down - rising would show me to
          // the rest of them; only when I cannot see him from down, up)
          if (!threat.see) { await set('RMB', true); if (s.rk < 0.85) { await sleep(40); continue; } }
          visible.length = 0; visible.push(threat);
        } else if (P.cover) {
          // down, listening: a man's tell (the gun coming up, the click) - a
          // reaction time later, up over the cover onto him; down through a
          // Tommy gun's burst; now and then up for a look
          const tells = s.men.filter((m) => !m.entry && (m.st === 'out' || m.st === 'aim' || m.st === 'fire') && m.kind !== 'tommy' || (m.kind === 'tommy' && m.st === 'reload'));
          if (tells.length && !tellAt) tellAt = now + rr(P.react[0], P.react[1]);
          for (const m of tells) if (!noticed.has(m.id)) noticed.set(m.id, tellAt);
          if (!tells.length) tellAt = 0;
          const look = now - lastUp > 4200;
          const wantUp = (now < holdUpUntil && now > downUntil) || (!tommyFiring && now > downUntil && ((tellAt && now >= tellAt) || heavy || look || s.rk > 0.5 || now < answerUntil));
          await set('RMB', wantUp);
          if (wantUp && s.rk < 0.2) upAt = now;
          if (!wantUp || s.rk < 0.85) {
            // (down: turned to where they are, ready to come up onto them)
            // (a man going round me: I watch him, to answer him as he comes round)
            const fl = P.watchFlank && s.flankId != null ? s.men.find((m) => m.id === s.flankId) : null;
            const any = fl || tells[0] || s.men.filter((m) => !m.entry).sort((a, b) => a.d - b.d)[0];
            if (any) await aim(s, yawTo(s, any.x, any.z), Math.max(-0.1, pitchTo(s, any.x, any.y, any.z)), fl ? 0.55 : 0.35, fl ? 0.2 : 0.12);
            target = null; await sleep(50); dbg['down'] = (dbg['down'] || 0) + 1; continue;
          }
          lastUp = now;
          // up: look along the room for someone
          if (!visible.length) {
            const any = lastSeenAt && now - lastSeenAt.t < 9000 ? lastSeenAt : (tells[0] || s.men.filter((m) => !m.entry).sort((a, b) => a.d - b.d)[0]);
            if (any) await aim(s, yawTo(s, any.x, any.z), pitchTo(s, any.x, any.y, any.z), 0.45, 0.18);
            if (now - upAt > 1900) { downUntil = now + rr(450, 800); await set('RMB', false); tellAt = 0; }
            await sleep(50); dbg['upLook'] = (dbg['upLook'] || 0) + 1; continue;
          }
        } else if (!visible.length) {
          const any = s.men.sort((a, b) => a.d - b.d)[0];
          if (any) await aim(s, yawTo(s, any.x, any.z), pitchTo(s, any.x, any.y, any.z), 0.35, 0.12);
          await sleep(80); dbg['badLook'] = (dbg['badLook'] || 0) + 1; continue;
        }
        const m = heavy && heavy.see ? heavy : visible.sort((a, b) => Math.hypot(wrap(yawTo(s, a.x, a.z) - s.yaw), pitchTo(s, a.x, a.y, a.z) - s.pitch) - Math.hypot(wrap(yawTo(s, b.x, b.z) - s.yaw), pitchTo(s, b.x, b.y, b.z) - s.pitch))[0];
        // (the hand's error: so many centimetres at the man, whatever his distance)
        const errOf = () => { const e0 = P.errM / Math.max(2, m.d); return [(Math.random() - 0.5) * 2 * e0, (Math.random() - 0.5) * 2 * e0]; };
        if (!noticed.has(m.id)) noticed.set(m.id, now + rr(P.react[0], P.react[1]));
        if (!target || target.id !== m.id) target = { id: m.id, err: errOf() };
        // [O7] (by the pad, the aim help holding him takes the hand's error: the sight sits on his chest)
        if (s.aimSlot != null && s.aimSlot === m.id) target.err = [0, 0];
        const yNow = yawTo(s, m.x, m.z);
        if (target.py != null && now > target.pt) { const w = wrap(yNow - target.py) / ((now - target.pt) / 1000); target.w = target.w == null ? w : target.w * 0.5 + w * 0.5; }
        target.py = yNow; target.pt = now;
        const lead = Math.max(-0.12, Math.min(0.12, (target.w || 0) * 0.12));
        seenAt = noticed.get(m.id);
        const ty = m.see || m.shade ? m.y : m.hy - 0.05;
        const e = await aim(s, yNow + lead + target.err[0], pitchTo(s, m.x, ty, m.z) + target.err[1], 0.65, 0.25);
        if (now < seenAt) { await sleep(30); dbg['react'] = (dbg['react'] || 0) + 1; continue; }
        if (e < 0.012 + 0.08 / Math.max(2, m.d) && now - lastShot > rr(P.gap[0], P.gap[1])) {
          await sleep(rr(P.settle[0], P.settle[1]));
          // (the Tommy gun: a short burst held; the revolver: a press)
          if (s.gun === 'tommy') { await mouse('mousePressed', cx, cy, 'left'); await sleep(rr(180, 320)); await mouse('mouseReleased', cx, cy, 'left'); }
          else await click();
          lastShot = Date.now();
          target.err = errOf();
          if (P.cover && !heavy && !(answerId != null && m.id === answerId)) {
            burstLeft = (burstLeft || Math.round(rr(P.burst[0], P.burst[1]))) - 1;
            if (burstLeft <= 0) {
              burstLeft = 0; answerUntil = 0;
              // (the clumsy hand stays up a second too long now and then, looking - a hit still sends it down)
              if (P.upLong && Math.random() < P.upLong) holdUpUntil = Date.now() + rr(800, 1500);
              else { downUntil = Date.now() + rr(P.down[0], P.down[1]); await set('RMB', false); }
            }
          }
        }
        await sleep(30);
      }
      await releaseAll();
      const sN = await js(ST);
      // (where the rounds into me came from: my pose, the man's kind, a flanker's, through my cover)
      const took = await js(`(() => { const o = {}; for (const e of N.game.guns.events) if (e.what === 'hit' && e.t >= ${g0}) { const k = e.pose + ':' + e.by + (e.flank ? ':flank' : '') + (e.through ? ':through' : ''); o[k] = (o[k] || 0) + e.dmg; } return o; })()`);
      const tr = { ...end, secs: +((Date.now() - t0) / 1000).toFixed(1), shots: sN.shots - shots0, hits: sN.hits - hits0, lowHp: Math.round(lowHp), took };
      B.tries.push(tr);
      log(`c2 ${rec.profile} ${beat} try ${k + 1}: ${JSON.stringify(tr)}`);
      // (the first-timer reads the fall's words and does that one thing better on the retry:
      // the retry says in a word what went wrong - WAVE_C §1 rule 2)
      if (P.learns && !end.won && end.why) {
        const w = end.why;
        if (/angle|Flanked/.test(w)) P.lateMove = false;
        if (/too long/.test(w)) P.upLong = (P.upLong || 0) * 0.4;
        if (/chewed|shot away/.test(w)) P.lateMove = false;
        if (/Reloading/.test(w)) P.standReload = 0;
        if (/in the open/.test(w)) P.crouchLate = [200, 500];
        if (/walked right up/.test(w)) P.react = [P.react[0] * 0.85, P.react[1] * 0.85];
        log(`c2 ${rec.profile} learns from '${w}': ${JSON.stringify({ lateMove: P.lateMove, upLong: P.upLong, standReload: P.standReload, crouchLate: P.crouchLate, react: P.react })}`);
      }
      if (end.won) break;
      if (opts.oneTry) break;
    }
    B.won = B.tries.some((t) => t.won);
    B.wonFirst = !!(B.tries[0] && B.tries[0].won);
  }
  await releaseAll();
  const all = Object.values(rec.beats).flatMap((b) => b.tries);
  rec.shots = all.reduce((a, t) => a + t.shots, 0); rec.hits = all.reduce((a, t) => a + t.hits, 0);
  rec.hitRate = rec.shots ? +(rec.hits / rec.shots).toFixed(2) : null;
  rec.won = Object.values(rec.beats).filter((b) => b.won).length;
  rec.wonFirst = Object.values(rec.beats).filter((b) => b.wonFirst).length;
  rec.lost = Object.values(rec.beats).filter((b) => !b.won).length;
  rec.falls = all.filter((t) => !t.won).map((t) => t.why);
  // (every fall had its warning up a second or more before it: WAVE_C §1 rule 2, seams/Z.md §3)
  rec.allWarned = all.filter((t) => !t.won && t.why !== 'timeout').every((t) => t.warned);
  void shot; void H;
  return rec;
}
