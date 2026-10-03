// [C7] Pier Nine played by real input, for the proofs of WAVE_C §7
// (docs/story/briefs/C7_PIER.md "Proofs and gate"):
//   { "drive": "tools/lib/c7_pier.mjs", "profile": "hunter" | "loud" | "dark", "stop": "expr", "timeout": ms }
//   hunter  the quiet pass, taking every man out: picks the nearest man on
//           his feet, creeps up behind him by the floor's grid (crouched,
//           the mouse turning him, W held), holds still when any man grows
//           curious, E when the blow from behind is offered; caught, he goes
//           on from the checkpoint (the men he put down stay down); with
//           every man down, up the west stairs to the office window
//   loud    the loud pass, shooting out: down the west stairs on his feet
//           (seen), then the gunfight at a human pace (a reaction, a turn
//           onto the nearest man in sight a little off, LMB, a breath; R when
//           empty; down behind the stores while reloading), then to the bay
//   dark    the loud pass without being seen: a lamp shot out from the
//           catwalk, a wait while they come to the shot and give it up, then
//           crouched down the west stairs and east in the black under the
//           mezzanine to the bay, holding still whenever a man grows curious
// Ends when `stop` is true (default: the fist fight's beat) or on the timeout.
// Returns { profile, fails, whys, takedowns, lamps, shots, secs, done }.
export default async function drive({ js, turn, keyDown, keyUp, mouse, log, sleep, W, H, opts, cursor }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 400000;
  const prof = opts.profile || 'hunter';
  const stop = opts.stop || "G.scenes.beat === 'fight'";
  const rr = (a, b) => a + (b - a) * Math.random();
  const at = () => (cursor ? cursor() : [W / 2, H / 2]);
  const tap = async (code, ms = 50) => { await keyDown(code); await sleep(ms); await keyUp(code); };
  let wDown = false;
  const setW = async (on) => { if (on !== wDown) { wDown = on; await (on ? keyDown('KeyW') : keyUp('KeyW')); } };
  let rmbOn = false;
  const rmb = async (on) => { if (on !== rmbOn) { rmbOn = on; const [x, y] = at(); await mouse(on ? 'mousePressed' : 'mouseReleased', x, y, 'right'); } };
  const click = async () => { const [x, y] = at(); await mouse('mousePressed', x, y, 'left'); await sleep(45); await mouse('mouseReleased', x, y, 'left'); };
  const out = { profile: prof, fails: 0, whys: [], takedowns: 0, lamps: 0, shots: 0, secs: 0, done: false };
  const ST = `(() => {
    const C = N.controller, L = G.scenes.ctx && G.scenes.ctx.flags.live, e = G.eye, Wp = G.player.weapons.active;
    const mz = G.stage.part && G.stage.part('mezz');
    const s = { done: !!(${stop}), beat: G.scenes.beat, failing: !!G.failing || !!G.scenes.trans, x: C.pos.x, z: C.pos.z, ey: e.y, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity,
      mode: C.mode, crouch: C.sneak ? !!C.sneak.crouch : (C.crouchK || 0) > 0.5, up: !!(mz && mz.up), fails: G.counters.fails || 0, why: G.lastFail ? G.lastFail.why : null,
      loud: !!(L && L.loud), alarm: L ? L.crew.alarmT >= 0 : false, ammo: Wp ? Wp.ammo : 0, reloading: !!(Wp && Wp.reloading), busy: G.player.hands.busy || !!(L && L.approach) || C.frozen,
      prompt: G.hud.promptShown || '', men: [], hoods: [],
      ans: L && L.answerer && L.answerer.name ? { up: !!L.answerer.upLvl, x: L.answerer.pos.x, z: L.answerer.pos.z, ri: L.answerer.ri, down: L.answerer.down, mode: L.answerer.mode, answering: !!L.answerer.answering } : (L && L.answerer ? { none: true } : null) };
    const d = new N.THREE.Vector3();
    if (L) for (const m of L.crew.men) {
      const c = m.eye(new N.THREE.Vector3()); c.y -= 0.35;
      d.subVectors(c, e); const Ld = d.length(); d.divideScalar(Ld);
      const seen = !m.down && !G.rays.raycast(e, d, Ld - 0.3);
      s.men.push({ name: m.name, x: m.pos.x, z: m.pos.z, down: m.down, mode: m.mode, a: m.a, yaw: m.fig.yaw, look: m.look, up: !!m.upLvl, hood: !!m.hood, hunter: !!m.spec.hunter, cx: c.x, cy: c.y, cz: c.z, L: Ld, seen });
    }
    for (const h of G.stage.hoods.list) {
      if (!h.alive) continue;
      const c = h.bones.chest.getWorldPosition(new N.THREE.Vector3());
      d.subVectors(c, e); const Ld = d.length(); d.divideScalar(Ld);
      const hit = G.rays.raycast(e, d, Ld - 0.3);
      s.hoods.push({ x: c.x, y: c.y, z: c.z, L: Ld, seen: !hit });
    }
    return s; })()`;
  const read = async () => { const s = await js(ST); return s && !s.__exc ? s : null; };
  const face = async (s, x, y, z, err = 0) => {
    const want = Math.atan2(-(x - s.x), -(z - s.z)), pt = Math.atan2(y - s.ey, Math.hypot(x - s.x, z - s.z));
    const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)) + (Math.random() - 0.5) * 2 * err, dp = pt - s.pitch + (Math.random() - 0.5) * 2 * err * 0.6;
    const px = Math.round(-dy / s.sens), py = Math.round(-dp / s.sens);
    const n = Math.min(6, Math.max(1, Math.ceil(Math.hypot(px, py) / 60)));
    for (let i = 0; i < n; i++) { await turn(Math.round(px / n), Math.round(py / n)); await sleep(16); }
  };
  // one step toward (x, z): the mouse turns him, W held while he faces it
  const stepTo = async (s, x, z) => {
    const dx = x - s.x, dz = z - s.z;
    const want = Math.atan2(-dx, -dz), err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    if (Math.abs(err) > 0.03) await turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0);
    await setW(Math.abs(err) < 0.6);
  };
  // a walk along points by real input; stopped by halt(s) (true: hold still)
  const walk = async (pts, { halt = null, limit = 60000 } = {}) => {
    const T = Date.now() + limit;
    for (const [x, z] of pts) {
      for (;;) {
        const s = await read();
        if (!s) { await sleep(100); continue; }
        if (s.done || s.failing || Date.now() > T) { await setW(false); if (Date.now() > T) log(`c7 walk stuck at ${s.x.toFixed(2)},${s.z.toFixed(2)} y${s.ey.toFixed(1)} going to ${x},${z}`); return s; }
        if (Math.hypot(x - s.x, z - s.z) < 0.4) break;
        if (halt && halt(s)) {
          await setW(false);
          if (opts.verbose && Date.now() - (out._hlog || 0) > 4000) { out._hlog = Date.now(); log(`c7 halt at ${s.x.toFixed(1)},${s.z.toFixed(1)} ${s.men.filter((m) => !m.down).map((m) => m.name + ':' + m.mode + '/' + m.a.toFixed(2) + '@' + m.x.toFixed(1) + ',' + m.z.toFixed(1) + ' look ' + m.look.toFixed(2)).join(' ')}`); }
          await sleep(120); continue;
        }
        await stepTo(s, x, z);
        await sleep(33);
      }
    }
    await setW(false);
    return null;
  };
  const path = async (x, z) => {
    const p = await js(`(() => { const C = N.controller, q = G.stage.nav.findPath(C.pos.x, C.pos.z, ${x}, ${z}); return q && q.length ? q.map((v) => [v.x, v.z]) : null; })()`);
    return Array.isArray(p) ? p : [[x, z]];
  };
  const pathFrom = async (x0, z0, x, z) => {
    const p = await js(`(() => { const q = G.stage.nav.findPath(${x0}, ${z0}, ${x}, ${z}); return q && q.length ? q.map((v) => [v.x, v.z]) : null; })()`);
    return Array.isArray(p) ? p : [[x, z]];
  };
  const crouch = async (s, want) => { if (s.crouch !== want) { await tap('KeyC'); await sleep(250); } };
  const waitBack = async () => { await setW(false); for (let k = 0; k < 200; k++) { const s = await read(); if (s && !s.failing) return s; await sleep(100); } return null; };
  const noteFail = (s) => { if (s && s.fails > out.fails) { out.fails = s.fails; out.whys.push(s.why); log(`c7_pier ${prof}: fail ${s.fails} '${s.why}' at ${s.beat}`); } };
  const curious = (s) => s.men.some((m) => !m.down && (m.a > 0.18 || m.mode === 'curious'));
  // (a man's light coming my way, near enough to reach me: hold still in the dark)
  const beamOnMe = (s) => s.men.some((m) => {
    if (m.down) return false;
    const d = Math.hypot(s.x - m.x, s.z - m.z);
    if (d > 13) return false;
    const b = Math.atan2(s.x - m.x, s.z - m.z), off = Math.abs(Math.atan2(Math.sin(b - m.look), Math.cos(b - m.look)));
    return off < 0.6 || (d < 6 && off < 1.2);
  });
  // the way up to the office window: up the west stairs, along the catwalk
  const toWindow = [[-3.0, -40.25], [-9.0, -40.25], [-9.6, -41.55], [-1.0, -41.7]];

  for (;;) {
    if (Date.now() - T0 > timeout) { log(`c7_pier ${prof}: timeout`); break; }
    let s = await read();
    if (!s) { await sleep(150); continue; }
    noteFail(s);
    if (opts.verbose && Date.now() - (out._logT || 0) > (typeof opts.verbose === "number" ? opts.verbose : 6000)) { out._logT = Date.now(); log(`c7 ${s.beat} me ${s.x.toFixed(1)},${s.z.toFixed(1)} y${s.ey.toFixed(1)} c${+s.crouch} loud ${+s.loud} al ${+s.alarm} men ${s.men.map((m) => m.name + (m.down ? 'X' : '') + ':' + m.mode + '/' + m.a.toFixed(1) + '@' + m.x.toFixed(0) + ',' + m.z.toFixed(0) + (m.seen ? '*' : '')).join(' ')} hoods ${s.hoods.map((h) => h.x.toFixed(0) + ',' + h.z.toFixed(0) + (h.seen ? '*' : '')).join(' ')}`); }
    if (s.done) { out.done = true; break; }
    if (s.failing) { await rmb(false); out._placed = false; out._stale = 0; s = await waitBack(); continue; }

    if (prof === 'hunter') {
      if (!['floor', 'lamps', 'aisle', 'stairs'].includes(s.beat)) { await sleep(200); continue; }
      await crouch(s, true);
      const up = s.men.filter((m) => !m.down);
      if (!up.length) {
        // every man down: the office window
        const r = await walk(s.up ? [[-1.0, -41.7]] : [...(await path(-3.0, -40.25)), ...toWindow]);
        if (r && r.failing) continue;
        await sleep(400); continue;
      }
      if (s.alarm) { await setW(false); await sleep(150); continue; }
      // hold still while any of them grows curious
      if (curious(s)) { await setW(false); await sleep(150); continue; }
      // the prompt for the blow from behind: take it
      if (/knock him out/.test(s.prompt) && !s.busy) { await setW(false); await sleep(rr(120, 260)); await tap('KeyE'); out.takedowns++; await sleep(1300); continue; }
      // the nearest man on his feet: a point behind him
      up.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z));
      const T = up[0];
      const bx = T.x - Math.sin(T.yaw) * 1.05, bz = T.z - Math.cos(T.yaw) * 1.05;
      const d = Math.hypot(T.x - s.x, T.z - s.z);
      // (close: turn onto his neck so the prompt is offered)
      if (d < 1.9) { await face(s, T.x, s.ey - 0.3, T.z); await stepTo(s, bx, bz); await sleep(60); await setW(false); continue; }
      // (he is looking my way, near: wait for his back)
      const toMe = Math.atan2(s.x - T.x, s.z - T.z), off = Math.abs(Math.atan2(Math.sin(toMe - T.look), Math.cos(toMe - T.look)));
      if (off < 1.25 && d < 10) { await setW(false); await sleep(150); continue; }
      const p = await path(bx, bz);
      const nxt = p.find(([x, z]) => Math.hypot(x - s.x, z - s.z) > 0.5) || [bx, bz];
      await stepTo(s, nxt[0], nxt[1]);
      await sleep(40);
      continue;
    }

    if (prof === 'loud') {
      if (s.beat !== 'loud') { await sleep(200); continue; }
      // the targets: the gun kit's men once they have me; before that the
      // hunters with their torches (a round drops a man who does not know)
      const targets = s.loud ? s.hoods.map((h) => ({ ...h, kit: true })) : s.men.filter((m) => !m.down && m.hunter).map((m) => ({ x: m.cx, y: m.cy, z: m.cz, L: m.L, seen: m.seen }));
      if (!targets.length) {
        // all of them down: down the west stairs and across the floor to the bay
        await rmb(false);
        await crouch(s, false);
        const r = await walk(s.up ? [[-9.6, -41.55], [-9.0, -40.25], [-3.0, -40.25], ...(await pathFrom(-3.0, -40.25, 10.6, -36.0))] : await path(10.6, -36.0), { limit: 60000 });
        if (r && r.failing) continue;
        await sleep(200); continue;
      }
      // (nobody to be seen from up here for a long while: down to find them)
      if (!s.up || (out._stale && Date.now() - out._stale > 14000)) {
        await rmb(false);
        if (s.up) { const r = await walk([[-9.6, -41.55], [-9.0, -40.25], [-3.4, -40.25]], { limit: 20000 }); if (r && r.failing) continue; }
        const s5 = await read(); if (!s5) continue;
        const vis = (s5.loud ? s5.hoods : s5.men.filter((m) => !m.down && m.hunter).map((m) => ({ x: m.cx, y: m.cy, z: m.cz, L: m.L, seen: m.seen }))).filter((q) => q.seen && q.L < 30).sort((a, b) => a.L - b.L);
        if (s5.ammo <= 0 && !s5.reloading) { await tap('KeyR'); await sleep(400); continue; }
        if (s5.reloading) { await sleep(150); continue; }
        if (vis.length) { await setW(false); await sleep(rr(220, 400)); const s6 = await read(); await face(s6 || s5, vis[0].x, vis[0].y, vis[0].z, 0.015); await sleep(rr(70, 140)); await click(); out.shots++; await sleep(rr(350, 550)); continue; }
        const n = targets.sort((a, b) => a.L - b.L)[0];
        const p = await path(n.x, n.z);
        const nxt = p.find(([x, z]) => Math.hypot(x - s5.x, z - s5.z) > 0.6);
        if (nxt) { await stepTo(s5, nxt[0], nxt[1]); await sleep(200); }
        continue;
      }
      // (my place: behind the kickboards west of the window, low)
      if (s.up && Math.hypot(s.x + 4.6, s.z + 41.5) > 1.2 && !out._placed) { await rmb(false); await crouch(s, true); const r = await walk([[-4.6, -41.5]], { limit: 15000 }); if (r && r.failing) continue; out._placed = true; continue; }
      out._placed = true;
      if (s.ammo <= 0 && !s.reloading) { await rmb(false); await crouch(s, true); await tap('KeyR'); await sleep(rr(300, 500)); continue; }
      if (s.reloading) { await sleep(150); continue; }
      await crouch(s, true);
      // up over the boards: who is in sight
      await rmb(true);
      await sleep(rr(220, 320));
      const s2 = await read();
      if (!s2 || s2.failing) { await rmb(false); continue; }
      const t2 = (s2.loud ? s2.hoods.map((h) => ({ ...h })) : s2.men.filter((m) => !m.down && m.hunter).map((m) => ({ x: m.cx, y: m.cy, z: m.cz, L: m.L, seen: m.seen }))).filter((h) => h.seen && h.L < 32);
      let h = null;
      if (t2.length) { t2.sort((a, b) => a.L - b.L); h = t2[0]; out._stale = 0; }
      else {
        if (!out._stale) out._stale = Date.now();
        // nobody over the boards: on my feet a moment to look down over them
        await rmb(false);
        out._miss = (out._miss || 0) + 1;
        if (out._miss % 3 !== 0) { await sleep(rr(600, 1000)); continue; }
        await crouch(s2, false);
        await sleep(rr(300, 450));
        const s4 = await read();
        const t4 = s4 ? (s4.loud ? s4.hoods : s4.men.filter((m) => !m.down && m.hunter).map((m) => ({ x: m.cx, y: m.cy, z: m.cz, L: m.L, seen: m.seen }))).filter((q) => q.seen && q.L < 32) : [];
        if (!t4.length) {
          // (still nobody: along the catwalk to its other end)
          if (out._miss % 6 === 0) { const r = await walk([[s4 && s4.x < 0 ? 4.6 : -4.6, -41.5]], { limit: 15000 }); if (r && r.failing) continue; }
          continue;
        }
        t4.sort((a, b) => a.L - b.L); h = t4[0]; out._stale = 0;
      }
      out._miss = 0;
      const s2b = await read();
      await sleep(rr(200, 380));
      await face(s2b || s2, h.x, h.y, h.z, 0.012);
      await sleep(rr(70, 150));
      await click(); out.shots++;
      await sleep(rr(250, 400));
      // (a second at him, then down behind the boards)
      if (s2.loud && Math.random() < 0.6) { const s3 = await read(); if (s3) await face(s3, h.x, h.y, h.z, 0.012); await sleep(rr(120, 220)); await click(); out.shots++; await sleep(200); }
      await rmb(false);
      await sleep(rr(500, 900));
      continue;
    }

    if (prof === 'dark') {
      if (s.beat !== 'loud') { await sleep(200); continue; }
      await crouch(s, true);
      // (1) into the office while the man who answers the telephone comes up
      // and goes down again (behind its blinds nobody sees me)
      if (!out._hid) {
        const r = await walk([[1.85, -41.7], [1.85, -42.95], [0.2, -43.0]], { limit: 20000 });
        if (r && r.failing) continue;
        out._hid = true; continue;
      }
      if (!out._clear) {
        const a = s.ans;
        if (!a) { await sleep(250); continue; }
        if (!a.none && !a.down && (a.up || a.answering)) { await sleep(300); continue; }
        out._clear = true; await sleep(rr(600, 1200)); continue;
      }
      if (!out._shotLamp) {
        // (2) along the catwalk to its west end, up over the boards, the stairs' lamp shot out
        const r = await walk([[1.85, -42.95], [1.85, -41.7], [-6.4, -41.6]], { limit: 25000, halt: (q) => curious(q) });
        if (r && r.failing) { out._hid = out._clear = false; continue; }
        await rmb(true);
        await sleep(rr(300, 450));
        const s2 = await read();
        await face(s2, -2.4, 3.3, -37.1, 0.003);
        await sleep(250);
        await click(); out.shots++;
        await sleep(400);
        await rmb(false);
        out.lamps = await js('G.counters.c7lamps || 0');
        out._shotLamp = true;
        out._quietSince = 0;
        continue;
      }
      // (3) a wait while they come to the shot and give it up
      if (!out._go) {
        const busy = s.loud || s.men.some((m) => !m.down && (m.mode === 'investigate' || m.mode === 'search' || m.mode === 'curious' || m.a > 0.1));
        if (busy) { out._quietSince = 0; await sleep(250); continue; }
        if (!out._quietSince) out._quietSince = Date.now();
        if (Date.now() - out._quietSince < 6000) { await sleep(250); continue; }
        out._go = true;
      }
      // (4) down the west stairs, low, and east in the black under the mezzanine
      // to the bay - when nobody is near the stairs' foot
      if (s.up && s.men.some((m) => !m.down && (Math.hypot(m.x + 3.4, m.z + 40.2) < 11 || m.mode !== 'patrol'))) { await sleep(300); continue; }
      const r = await walk(s.up ? [[-9.6, -41.55], [-9.0, -40.25], [-3.2, -40.25], [-3.2, -43.6], [9.0, -43.6], [10.6, -41.0]] : [...(await path(-3.2, -43.6)), [9.0, -43.6], [10.6, -41.0]],
        { halt: (q) => curious(q) || beamOnMe(q), limit: 120000 });
      if (r && r.failing) { out._shotLamp = false; out._go = false; out._hid = false; out._clear = false; continue; }
      await sleep(300); continue;
    }
    await sleep(200);
  }
  await setW(false);
  const fin = await read();
  noteFail(fin);
  out.secs = +((Date.now() - T0) / 1000).toFixed(1);
  out.takedowns = await js('G.counters.takedowns || 0');
  out.lamps = await js('G.counters.c7lamps || 0');
  delete out._shotLamp; delete out._go; delete out._quietSince; delete out._pocket; delete out._waitT; delete out._placed; delete out._logT; delete out._miss; delete out._stale; delete out._hid; delete out._clear; delete out._hlog;
  return out;
}
