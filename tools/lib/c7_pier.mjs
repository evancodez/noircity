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
      prompt: G.hud.promptShown || '', men: [], hoods: [], lit: window.__c7lit ? window.__c7lit(C.pos.x, C.pos.z) : 0,
      ans: L && L.answerer && L.answerer.name ? { up: !!L.answerer.upLvl, x: L.answerer.pos.x, z: L.answerer.pos.z, ri: L.answerer.ri, down: L.answerer.down, mode: L.answerer.mode, answering: !!L.answerer.answering } : (L && L.answerer ? { none: true } : null) };
    const d = new N.THREE.Vector3();
    if (L) for (const m of L.crew.men) {
      const c = m.eye(new N.THREE.Vector3()); c.y -= 0.35;
      d.subVectors(c, e); const Ld = d.length(); d.divideScalar(Ld);
      const seen = !m.down && !G.rays.raycast(e, d, Ld - 0.3);
      s.men.push({ name: m.name, x: m.pos.x, z: m.pos.z, down: m.down, mode: m.mode, a: m.a, yaw: m.fig.yaw, look: m.look, up: !!m.upLvl, hood: !!m.hood, hunter: !!m.spec.hunter, cx: c.x, cy: c.y, cz: c.z, L: Ld, seen, ri: m.ri, wait: m.wait, fixT: m.fixT || 0 });
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
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // [C7] 'hunt': the plan, man by man (see the profile below)
  const BACK_W = [[-9.8, -27.6], [-9.4, -33.6], [-10.1, -36.4], [-10.1, -43.3], [-5.2, -43.4]];
  const HUNT = [
    // the first man, as he turns up aisle A from the door's pool: round by
    // the wall's dark strip, in behind him before the aisle's lamp
    { name: 'sully', goWhen: (T, s) => s.z > -5 ? (T.mode === 'patrol' && T.z < -6.8 && T.z > -11 && Math.abs(wrapA(T.yaw - Math.PI)) < 0.6) : true,
      stage: (s) => s.z > -5 ? [[-13.4, -3.4], [-13.2, -7.6]] : [] },
    // aisle B's man: the switch pulled, a wait in the pocket of the next
    // stack, then in behind him while he puts it back (his back to the cross aisle)
    { name: 'bert', stage: async (s) => [...(await path(-9.3, -13.1))],
      lure: async (s) => {
        const s1 = await read(); if (!s1) return 'again';
        if (!s1.prompt.includes('switch')) { await face(s1, -8.95, 1.0, -12.1); await sleep(300); const s2 = await read(); if (!s2 || !s2.prompt.includes('switch')) { await walk([[-9.6, -13.6], [-9.2, -13.0]], { limit: 6000 }); return 'again'; } }
        // (only when aisle A's man - if he is up - is not coming my way)
        await tap('KeyE'); await sleep(1500);
        const r = await walk([[-8.2, -15.6], [-7.5, -17.55]], { limit: 10000 });
        return !(r && r.failing);
      },
      stalkIf: (T) => T.mode === 'fix' && T.fixT > 0.4 },
    // the loop's man: from the cross aisle west of aisle B, in behind him as
    // he walks east along it
    { name: 'rusty', stage: async (s) => [...(await path(-3.2, -14.7))],
      stalkIf: (T) => T.mode === 'patrol' && T.ri === 1 && T.x > 3.7 && T.x < 7.2 },
    // the strip's man: the long way round in the dark - aisle A, the west
    // wall, behind the stores - out between them, in behind him at his east stop
    { name: 'hood2', goWhen: (T, s) => s.z < -38.5 || (T.ri === 1 && T.x > 2.5),
      // (waiting behind the stores' line, not in the gap: a man coming back to
      // his round from the floor walks north toward it)
      stage: async (s) => s.z < -38.5 ? [[-2.0, -43.4], [3.2, -43.4]]
        : [...(s.z > -27 ? await path(-12.6, -24.0) : []), ...(s.z < -30 && s.x > -9 ? [[-9.3, s.z]] : []), ...BACK_W.filter(([x, z]) => z < s.z + 0.2), [-2.0, -43.4], [3.2, -43.4]],
      stalkIf: (T) => T.mode === 'patrol' && T.ri === 1 && T.wait > 0 && T.x > 6.3 },
    // the man at the stairs' foot: from behind the stores, at his back
    { name: 'hood1', stage: async (s) => s.z < -38 ? [[3.2, -43.4], [-2.0, -43.4], [-2.0, -41.0]] : [...(await path(-3.2, -43.4)), [-2.0, -43.4], [-2.0, -41.0]],
      stalkIf: (T) => true },
    // the bay's man, last: the lantern on the post put out from its dark
    // side (east of the post), a wait by the next stack's corner out of his
    // way, then in behind him while he lights it again (his back to aisle B)
    // (up the east side of aisle B between its lamp's pool and the stacks,
    // while he walks south down his aisle - the stacks between us)
    { name: 'cal', goWhen: (T) => T.mode === 'patrol' && T.ri === 0 && T.z > -25,
      stage: async (s) => [...(s.z < -35 ? [[1.0, -37.6]] : (await path(1.0, -37.6))), [2.1, -34.6], [2.1, -30.2], [2.3, -29.0], [3.95, -28.65], [4.3, -27.75]],
      lure: async (s) => {
        const s1 = await read(); if (!s1) return 'again';
        await face(s1, 3.13, 1.75, -27.8); await sleep(350);
        const s2 = await read();
        if (!s2 || !s2.prompt.includes('lantern')) { await walk([[4.15, -27.6]], { limit: 4000 }); const s3 = await read(); if (s3) await face(s3, 3.13, 1.75, -27.8); await sleep(300); const s4 = await read(); if (!s4 || !s4.prompt.includes('lantern')) return false; }
        await tap('KeyE'); await sleep(1600);
        const r = await walk([[4.0, -26.2], [2.9, -24.7]], { limit: 8000 });
        return !(r && r.failing);
      },
      stalkIf: (T) => T.mode === 'fix' && T.fixT > 0.3 },
  ];

  for (;;) {
    if (Date.now() - T0 > timeout) { log(`c7_pier ${prof}: timeout`); break; }
    let s = await read();
    if (!s) { await sleep(150); continue; }
    noteFail(s);
    if (opts.verbose && Date.now() - (out._logT || 0) > (typeof opts.verbose === "number" ? opts.verbose : 6000)) { out._logT = Date.now(); log(`c7 ${s.beat} me ${s.x.toFixed(1)},${s.z.toFixed(1)} y${s.ey.toFixed(1)} c${+s.crouch} loud ${+s.loud} al ${+s.alarm} men ${s.men.map((m) => m.name + (m.down ? 'X' : '') + ':' + m.mode + '/' + m.a.toFixed(1) + '@' + m.x.toFixed(0) + ',' + m.z.toFixed(0) + (m.seen ? '*' : '')).join(' ')} hoods ${s.hoods.map((h) => h.x.toFixed(0) + ',' + h.z.toFixed(0) + (h.seen ? '*' : '')).join(' ')}`); }
    if (s.done) { out.done = true; break; }
    if (s.failing) { await rmb(false); out._placed = false; out._stale = 0; out._for = null; s = await waitBack(); continue; }

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
      // (the way to him must keep to the dark: a man whose way crosses a pool
      // of light is left for later)
      const p = await path(bx, bz);
      const lit = await js(`(() => { const p = ${JSON.stringify(p)}; let m = 0; for (let i = 0; i < p.length; i++) m = Math.max(m, window.__c7lit ? window.__c7lit(p[i][0], p[i][1]) : 0); return m; })()`);
      if (lit > 0.3 && up.length > 1 && !out._forced) {
        out._skip = (out._skip || 0) + 1;
        const alt = up.slice(1).sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
        const pa = await path(alt.x - Math.sin(alt.yaw) * 1.05, alt.z - Math.cos(alt.yaw) * 1.05);
        const la = await js(`(() => { const p = ${JSON.stringify(pa)}; let m = 0; for (let i = 0; i < p.length; i++) m = Math.max(m, window.__c7lit ? window.__c7lit(p[i][0], p[i][1]) : 0); return m; })()`);
        if (la <= 0.3) { const n2 = pa.find(([x, z]) => Math.hypot(x - s.x, z - s.z) > 0.5) || pa[0]; await stepTo(s, n2[0], n2[1]); await sleep(40); continue; }
        // (both lit: wait in the dark for one of them to come out of it)
        await setW(false); await sleep(300);
        if (out._skip > 120) out._forced = true;
        continue;
      }
      out._skip = 0;
      const nxt = p.find(([x, z]) => Math.hypot(x - s.x, z - s.z) > 0.5) || [bx, bz];
      await stepTo(s, nxt[0], nxt[1]);
      await sleep(40);
      continue;
    }

    if (prof === 'hunt') {
      // [C7] after the critic: every man of the quiet pass by a plan a player
      // who watched the rounds would make - each man in turn, from a place in
      // the dark where his round brings his back to me, the switch for aisle
      // B's man, the dark behind the stores for the two at the stairs; the
      // stalk itself is the hunter's (still while any man is curious or
      // looks my way, E when the blow is offered)
      if (!['floor', 'lamps', 'aisle', 'stairs'].includes(s.beat)) { await setW(false); await sleep(200); continue; }
      await crouch(s, true);
      const M = (n) => s.men.find((m) => m.name === n);
      const left = HUNT.filter((h) => M(h.name) && !M(h.name).down);
      if (!left.length) {
        const r = await walk(s.up ? [[-1.0, -41.7]] : [...(await path(-3.0, -40.25)), ...toWindow], { halt: (q) => curious(q) });
        if (r && r.failing) continue;
        await sleep(400); continue;
      }
      if (s.alarm) { await setW(false); await sleep(150); continue; }
      const H = left[0], T = M(H.name);
      if (out._for !== H.name) { out._for = H.name; out._phase = 0; log(`c7 hunt: ${H.name} (${out.fails} fails so far, ${((Date.now() - T0) / 1000).toFixed(0)} s)`); }
      // (1) the staging walk: in the dark to where his round will bring him
      if (out._phase === 0) {
        if (H.goWhen && !H.goWhen(T, s)) { await setW(false); await sleep(150); continue; }
        const pts = typeof H.stage === 'function' ? await H.stage(s) : H.stage || [];
        const r = await walk(pts, { halt: (q) => curious(q) || beamOnMe(q) || (H.haltIf && H.haltIf(q)), limit: 90000 });
        if (r && r.failing) { out._for = null; continue; }
        out._phase = 1; continue;
      }
      // (2) a lure (the switch for aisle B's man)
      if (out._phase === 1) {
        if (H.lure) { const ok = await H.lure(s); if (ok === 'again') continue; if (!ok) { out._for = null; continue; } }
        out._phase = 2; continue;
      }
      // (3) wait for his back, then the stalk
      if (out._phase === 2) {
        if (H.stalkIf && !H.stalkIf(T, s)) { await setW(false); await sleep(120); continue; }
        out._phase = 3; out._stalkT = Date.now();
      }
      // (a man who turned while I came: wait in the dark again)
      if (Date.now() - out._stalkT > 45000) { out._phase = 2; out._stalkT = Date.now(); }
      if (H.stalkWhile && !H.stalkWhile(T)) { await setW(false); out._phase = 0; continue; }
      if (/knock him out/.test(s.prompt) && !s.busy) { await setW(false); await sleep(rr(120, 260)); await tap('KeyE'); out.takedowns++; await sleep(1400); continue; }
      if (s.men.some((m) => !m.down && m.name !== H.name && (m.a > 0.18 || m.mode === 'curious')) || beamOnMe({ ...s, men: s.men.filter((m) => m.name !== H.name) })) { await setW(false); await sleep(120); continue; }
      if (T.mode === 'curious' || T.a > 0.15) { await setW(false); await sleep(120); continue; }
      // (off his round - gone to look at something - he is not followed out
      // across the floor: wait in the dark for him to come back)
      if (T.mode === 'investigate' || T.mode === 'search') { await setW(false); await sleep(150); continue; }
      const bx = T.x - Math.sin(T.yaw) * 0.95, bz = T.z - Math.cos(T.yaw) * 0.95;
      const d = Math.hypot(T.x - s.x, T.z - s.z);
      const toMe = Math.atan2(s.x - T.x, s.z - T.z), off = Math.abs(Math.atan2(Math.sin(toMe - T.look), Math.cos(toMe - T.look)));
      if (off < 1.35 && d < 10) { await setW(false); await sleep(120); continue; }
      if (d < 1.9) { await face(s, T.x, s.ey - 0.3, T.z); await stepTo(s, bx, bz); await sleep(60); await setW(false); continue; }
      const p = await path(bx, bz);
      const nxt = p.find(([x, z]) => Math.hypot(x - s.x, z - s.z) > 0.45) || [bx, bz];
      // (a step into a lamp's light while another man is on his feet: not
      // taken - wait for him to come out of it)
      // (another man near it, or one I can see from here: a man who could see me in it)
      if (s.men.some((m) => !m.down && m.name !== H.name && (Math.hypot(m.x - nxt[0], m.z - nxt[1]) < 14 || (m.seen && m.L < 25)))) {
        const lit = await js(`window.__c7lit ? window.__c7lit(${nxt[0]}, ${nxt[1]}) : 0`);
        if (lit > 0.15 && s.lit < 0.15) { await setW(false); await sleep(150); continue; }
      }
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
  delete out._shotLamp; delete out._go; delete out._quietSince; delete out._pocket; delete out._waitT; delete out._placed; delete out._logT; delete out._miss; delete out._stale; delete out._hid; delete out._clear; delete out._hlog; delete out._skip; delete out._forced; delete out._for; delete out._phase; delete out._stalkT;
  return out;
}
