// [C8] VIII's nick of time by real input (tools/play.mjs { "drive": "tools/lib/c8_nick.mjs",
// "profile": ..., "way": ..., "tries": n }). The page is put at the kerb (the beat 'dot',
// as its checkpoint) and a player of the profile plays it until Sal is down or `tries`
// falls; the record says each try's end (won / the fall's reason), its time, the warning
// up before the fall, the way taken.
//   idle    does nothing at the kerb
//   good    a way, done by a hand that knows it ('window', 'door', 'bottle'):
//           window  along the wall to Mack's window, over the sill (SPACE), low (C)
//                   round the counter's end, up the aisle behind him, E
//           door    low along the wall behind the man at the door, E; up; the door
//                   pulled (E) and in at a run; a blow over the counter (LMB)
//           bottle  a bottle from the crate (E), thrown up the avenue into the road
//                   (hold LMB, the arc's ring on it); the man at the door goes to look;
//                   in at the door at a run; a blow
//   bad     the first-timer: straight up the pavement to the door and pulls it
//           (the man at the door is right there: seen); next try he takes the man
//           down but walks in (the bell: too slow); the third the window, slowly
export default async function drive({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts }) {
  const profile = opts.profile || 'good';
  const tries = opts.tries ?? 3;
  const cx = W / 2, cy = H / 2;
  const rr = (a, b) => a + (b - a) * Math.random();
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const held = new Set();
  const down = async (c) => { if (!held.has(c)) { held.add(c); if (c === 'LMB') await mouse('mousePressed', cx, cy, 'left'); else await keyDown(c); } };
  const up = async (c) => { if (held.has(c)) { held.delete(c); if (c === 'LMB') await mouse('mouseReleased', cx, cy, 'left'); else await keyUp(c); } };
  const releaseAll = async () => { for (const c of [...held]) await up(c); };
  const tap = async (c, ms = 55) => { await keyDown(c); await sleep(ms); await keyUp(c); };
  const click = async () => { await mouse('mousePressed', cx, cy, 'left'); await sleep(45); await mouse('mouseReleased', cx, cy, 'left'); };
  const ST = `(() => { const G = N.game, C = N.controller, sc = G.scenes, R = G.b7, Nk = R && R.nick, st = Nk && Nk.st;
    return { scene: sc.current && sc.current.id, beat: sc.beat, trans: !!sc.trans, fade: sc.fadeK, failing: !!G.failing, x: C.pos.x, z: C.pos.z, ex: G.eye.x, ey: G.eye.y, ez: G.eye.z, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, mode: C.mode,
      crouch: !!(C.sneak && C.sneak.crouch), cur: G.interact.current && G.interact.current.id, busy: G.player.hands.busy, bottle: !!(Nk && Nk.hands && Nk.hands.bottle),
      sal: Nk && Nk.sal ? { x: Nk.sal.pos.x, z: Nk.sal.pos.z, down: !!Nk.sal.c8down } : null, nicky: Nk && Nk.nicky ? { x: Nk.nicky.pos.x, z: Nk.nicky.pos.z, down: !!Nk.nicky.c8down || !Nk.nicky.alive, mode: st && st.nickyMode } : null,
      salMode: st && st.salMode, done: !!(st && st.done), how: G.counters.c8how || null, nFails: G.counters.fails || 0, why: G.lastFail ? G.lastFail.why : null, warnedFor: G.lastFail ? G.lastFail.warnedFor : null, warn: G.hud.kit.warnText || null, t: st ? st.t : 0 };
  })()`;
  const aim = async (s, yaw, pitch, gain = 0.6, max = 0.3) => {
    const ey = wrap(yaw - s.yaw), ep = pitch - s.pitch;
    const dy = Math.max(-max, Math.min(max, ey * gain)), dp = Math.max(-max, Math.min(max, ep * gain));
    const mx = Math.round(-dy / s.sens), my = Math.round(-dp / s.sens);
    if (mx || my) await turn(mx, my);
    return Math.hypot(ey, ep);
  };
  const yawTo = (s, x, z) => Math.atan2(-(x - s.ex), -(z - s.ez));
  const pitchTo = (s, x, y, z) => Math.atan2(y - s.ey, Math.hypot(x - s.ex, z - s.ez));
  const lookAt = async (x, y, z, tol = 0.03) => { for (let i = 0; i < 50; i++) { const s = await js(ST); if (await aim(s, yawTo(s, x, z), pitchTo(s, x, y, z)) < tol) return true; await sleep(25); } return false; };
  // walk the points by W and the mouse; false when a fall came or the beat moved on
  const walk = async (pts, { run = false, tol = 0.3, slow = 1 } = {}) => {
    for (const p of pts) {
      for (let i = 0; i < 400; i++) {
        const s = await js(ST);
        if (s.failing || s.done || s.beat !== 'dot') { await up('KeyW'); await up('ShiftLeft'); return false; }
        const d = Math.hypot(p[0] - s.x, p[1] - s.z);
        if (d < tol) break;
        const err = await aim(s, Math.atan2(-(p[0] - s.x), -(p[1] - s.z)), -0.05, 0.7, 0.35);
        if (err < 0.5) { if (run) await down('ShiftLeft'); await down('KeyW'); } else await up('KeyW');
        await sleep(30 * slow);
      }
    }
    await up('KeyW'); await up('ShiftLeft');
    return true;
  };
  const waitFor = async (pred, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await js(ST); if (pred(s)) return s; await sleep(60); } return null; };
  const rec = { profile, way: opts.way || null, tries: [] };

  // ---- the ways ----------------------------------------------------------------------------------
  const ways = {
    async window(slow = 1) {
      if (!(await walk([[-8.4, -8.6], [-9.45, -3.8]], { slow }))) return;
      let s = await js(ST);
      await lookAt(-10.15, 1.35, -3.8, 0.05);
      s = await waitFor((q) => q.cur === 'c8.sill', 1500);
      if (!s) { log('c8 nick: no sill prompt'); return; }
      await tap('Space'); await sleep(1300);
      await tap('KeyC'); await sleep(350);
      if (!(await walk([[-13.1, -4.6], [-14.75, -4.45], [-15.45, -1.0]], { slow }))) return;
      s = await js(ST);
      await lookAt(s.sal.x, 1.2, s.sal.z, 0.05);
      s = await waitFor((q) => q.cur === 'c8.ko.sal', 1500);
      if (s) await tap('KeyE'); else log('c8 nick: no takedown prompt');
    },
    async door(slow = 1, runIn = true) {
      if (!(await walk([[-8.4, -8.6], [-8.6, -3.6]], { slow }))) return;
      await tap('KeyC'); await sleep(300);
      if (!(await walk([[-9.85, -1.2], [-9.85, 1.25]], { tol: 0.2, slow }))) return;
      let s = await js(ST);
      if (s.nicky && !s.nicky.down) {
        await lookAt(s.nicky.x, 1.3, s.nicky.z, 0.05);
        s = await waitFor((q) => q.cur === 'c8.ko.nicky', 1500);
        if (s) { await tap('KeyE'); await sleep(1500); } else log('c8 nick: no takedown prompt on the man at the door');
      }
      await tap('KeyC'); await sleep(300);
      await this.pullAndIn(runIn);
    },
    async pullAndIn(runIn = true) {
      // to the door's handle, from the street side: E pulls it; then in, at a run, to the counter
      if (!(await walk([[-9.45, 1.35]], { tol: 0.2 }))) return;
      await lookAt(-10.5, 1.3, 0.75, 0.05);
      const s0 = await waitFor((q) => q.cur === 'diner.door.pull', 1500);
      if (!s0) { log('c8 nick: no pull prompt'); return; }
      await tap('KeyE');
      await sleep(runIn ? 380 : 900);
      if (!(await walk([[-9.6, 0.6], [-11.2, 0.62], [-13.85, 0.5]], { run: runIn, tol: 0.35, slow: runIn ? 0.5 : 1.6 }))) return;
      const s = await js(ST);
      await lookAt(s.sal.x, 1.35, s.sal.z, 0.04);
      await click(); await sleep(600);
    },
    async bottle() {
      if (!(await walk([[-8.95, -7.9]]))) return;
      await lookAt(-9.78, 0.55, -7.15, 0.05);
      let s = await waitFor((q) => q.cur === 'c8.crate', 1500);
      if (!s) { log('c8 nick: no crate prompt'); return; }
      await tap('KeyE');
      s = await waitFor((q) => q.bottle && !q.busy, 3000);
      if (!s) { log('c8 nick: no bottle in hand'); return; }
      if (!(await walk([[-8.3, -3.4]]))) return;
      // up the avenue into the road, past the door: hold LMB, the ring onto the target, let go
      const T = { x: -3.2, z: 5.5 };
      await lookAt(T.x, 3.0, T.z, 0.05);
      await down('LMB'); await sleep(250);
      for (let i = 0; i < 40; i++) {
        const q = await js(`(() => { const Nk = N.game.b7.nick; const tr = Nk.hands.trace(); return { x: tr.end.x, z: tr.end.z, s: ${ST} }; })()`);
        const dx = T.x - q.x, dz = T.z - q.z;
        if (Math.hypot(dx, dz) < 1.0) break;
        const s2 = q.s;
        const dist0 = Math.hypot(q.x - s2.ex, q.z - s2.ez), dist1 = Math.hypot(T.x - s2.ex, T.z - s2.ez);
        await aim(s2, yawTo(s2, T.x, T.z), s2.pitch + Math.max(-0.08, Math.min(0.08, (dist1 - dist0) * 0.02)), 0.5, 0.08);
        await sleep(40);
      }
      await up('LMB');
      await sleep(900);
      s = await waitFor((q) => q.nicky && (q.nicky.mode === 'look' || q.nicky.down), 2500);
      log('c8 nick: the bottle broke; the man at the door ' + (s ? s.nicky.mode : 'did not go'));
      await sleep(1200);
      await this.pullAndIn(true);
    },
  };

  for (let k = 0; k < tries; k++) {
    await releaseAll();
    await js(`(N.game.scenes.go('shootout', { beat: 'dot', fade: 'cut', card: false }), 1)`);
    await sleep(600);
    const s0 = await waitFor((q) => q.beat === 'dot' && !q.trans && !q.failing && q.sal, 15000);
    const t0 = Date.now(), fails0 = s0 ? s0.nFails : 0;
    let way = opts.way || 'window';
    if (profile === 'bad') way = k === 0 ? 'blunder' : k === 1 ? 'doorSlow' : 'windowSlow';
    rec.tries.push({ way });
    if (profile === 'idle') { /* hands off */ }
    else if (way === 'blunder') await ways.pullAndIn(false);
    else if (way === 'doorSlow') await ways.door(1.4, false);
    else if (way === 'windowSlow') await ways.window(1.6);
    else await ways[way]();
    await releaseAll();
    // the end of the try: Sal down (the beat moves on), or the fall
    const end = await waitFor((q) => q.beat === 'gun' || q.nFails > fails0, profile === 'idle' ? 70000 : 20000);
    const tr = rec.tries[rec.tries.length - 1];
    if (!end) { tr.won = false; tr.why = 'timeout'; }
    else if (end.beat === 'gun' || end.done) { tr.won = true; tr.how = end.how; }
    else { const f = await waitFor((q) => !q.failing && q.beat === 'dot', 15000); void f; const q = await js(ST); tr.won = false; tr.why = q.why; tr.warnedFor = q.warnedFor; tr.warned = q.warnedFor != null && q.warnedFor >= 1; }
    tr.secs = +((Date.now() - t0) / 1000).toFixed(1);
    log(`c8 nick ${profile} try ${k + 1}: ${JSON.stringify(tr)}`);
    if (tr.won) break;
  }
  await releaseAll();
  rec.won = rec.tries.some((t) => t.won);
  rec.wonFirst = !!(rec.tries[0] && rec.tries[0].won);
  rec.falls = rec.tries.filter((t) => !t.won).map((t) => t.why);
  rec.allWarned = rec.tries.filter((t) => !t.won && t.why !== 'timeout').every((t) => t.warned);
  void shot; void H; void rr;
  return rec;
}
