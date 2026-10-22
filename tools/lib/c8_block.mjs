// [C8] Chapter VIII, The Block - the street and the Cardinal, by real input: lane C5's
// gun driver (tools/lib/c5_door.mjs, itself lane C2's) made for the block. Its beats: cars,
// flank, el (the street's movements), saloon, cardinal, last (him).
// (tools/play.mjs { "drive": "tools/lib/c8_block.mjs", "profile": ..., "beats": [...] }).
// For each beat named, the page is sent to it (scenes.go, as a checkpoint would)
// and a player of the profile plays it until it is won or lost `tries` times;
// the record says, per beat, each try's end (won / the fall's reason), its time,
// the warning seen before a fall, the shots fired and landed.
//   idle   does nothing at all (where the beat puts him: at the counter)
//   bad    the brief's block_bad: stands at a window and holds the trigger on
//          whatever shows; dies, and LEARNS: the retry is the clumsy hand's (cover,
//          bursts, slow) - fails some, gets through, never stuck
//   good   moves, uses cover (under the windows' sills, behind the counter,
//          the booths), rises (RMB) on a man's tell, a short burst, down;
//          reloads down; leaves a spent spot; answers the heavy at once; the
//          drums from Dot when low; him: down through his draw, up when he
//          has fired (he is open), and his shield man first
//   clumsy the first-timer of WAVE_C §7 (as lane C2's)
const PROFILES = {
  idle: { act: false },
  bad: { act: true, cover: false, hold: true, react: [450, 800], errM: 0.4, settle: [120, 260], gap: [250, 450], renotice: 600, learns: true, becomes: 'clumsy' },
  good: { act: true, cover: true, react: [300, 550], errM: 0.29, settle: [60, 120], gap: [380, 620], burst: [1, 1], down: [450, 800], shadows: true, duck: [120, 260], watchFlank: true },
  clumsy: { act: true, cover: true, react: [550, 900], errM: 0.42, settle: [100, 220], gap: [420, 700], burst: [1, 2], down: [350, 700],
    upLong: 0.35, standReload: 0.3, crouchLate: [500, 1400], wrongKey: 0.12, lateMove: true, duck: [300, 550], learns: true },
};

export default async function drive({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts }) {
  const P = PROFILES[opts.profile || 'good'];
  const beats = opts.beats || ['cars', 'flank', 'el', 'saloon', 'cardinal', 'last'];
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
    const RIG = G.b7, BOSS = RIG && RIG.boss;
    for (const h of G.stage.hoods.list) {
      if (!h.alive || h.c8gone || !(h.c8beat === sc.beat || h.c8boss)) continue;
      const a = G.ais.get(h);
      const c = new V().setFromMatrixPosition(h.bones.chest.matrixWorld);
      const hd = new V().setFromMatrixPosition(h.bones.head.matrixWorld);
      const S = a && a.brain && a.brain.S;
      const see = K && K.see(e, c, 0.3);
      const kind = (a && a.brain && a.brain.kind) || (h.c8boss ? 'cardinal' : h.c8dot ? 'dotman' : h.gunKind || 'pistol');
      let st = S ? S.state : h.state;
      if (h.c8boss && BOSS) st = BOSS.open > 0 ? 'open' : BOSS.mode;
      let line = a && a.brain ? !!a.brain.hasLine : !!(K && K.see(new V(h.pos.x, h.pos.y + 1.6, h.pos.z), e, 0.3));
      // [C8] after the critic: the man at the kitchen's hatch - up and aiming, or down below the pass
      if (h.c8kitchen && RIG.kitchen) { const km = RIG.kitchen.mode; st = km === 'fire' ? 'fire' : km === 'aim' || km === 'rise' ? 'aim' : 'hold'; line = !!RIG.kitchen.line; }
      men.push({ id: h.slot, x: c.x, y: c.y, z: c.z, hy: hd.y, fx: h.pos.x, fz: h.pos.z, see, seeH: K && K.see(e, hd, 0.2), shade: false,
        kind, st, line, entry: !!(S && S.entry) || !!h.b7climb, d: Math.hypot(c.x - e.x, c.z - e.z), inside: h.pos.x < -10.45, boss: !!h.c8boss });
    }
    const BEATS = ['cars', 'flank', 'el', 'saloon', 'cardinal', 'last'];
    // [C8] after the critic: his car, coming on to the door - its lamps (the glare) and its tyres, where I can see them
    const SAL = RIG && RIG.cars && RIG.cars.saloon;
    let saloon = null;
    if (SAL && sc.beat === 'saloon' && SAL.rail && !SAL.c8flat && !SAL.rail.done && SAL.group) {
      const M = SAL.group.matrixWorld, pts = [];
      const vis = (p) => { const d = p.clone().sub(e); const L = d.length(); d.divideScalar(L); const hh = G.rays.raycast(e, d, L + 0.3); return !!hh && hh.point.distanceTo(p) < 0.38; };
      [[1.55, 0.78], [1.55, -0.78], [-1.55, 0.76], [-1.55, -0.76]].forEach(([x, z], i) => { if (SAL.tyres && SAL.tyres[i]) return; const p = new V(x, 0.36, z * 1.06).applyMatrix4(M); pts.push({ kind: 'tyre', x: p.x, y: p.y, z: p.z, vis: vis(p), d: p.distanceTo(e) }); });
      [[2.307, 0.98, 0.6], [2.307, 0.98, -0.6]].forEach(([x, y, z], i) => { if (SAL.lensBroken[i]) return; const p = new V(x + 0.03, y, z).applyMatrix4(M); pts.push({ kind: 'lamp', x: p.x, y: p.y, z: p.z, vis: vis(p), d: p.distanceTo(e) }); });
      saloon = { pts, glare: RIG.glareK || 0, left: SAL.rail.L - SAL.rail.s };
    }
    return { scene: sc.current && sc.current.id, beat: sc.beat, trans: !!sc.trans, fade: sc.fadeK, failing: !!G.failing, dead: G.health.dead, hp: G.health.hp,
      x: C.pos.x, z: C.pos.z, ex: e.x, ey: e.y, ez: e.z, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, mode: C.mode, ck: C.crouchK || 0, rk: C.riseK || 0, on: !!C.crouchOn,
      reserve: RIG ? RIG.reserve : 0, dotLeft: RIG ? (RIG.dotLeft || 0) : 0, drumsUp: !!(N.game.interact.current && N.game.interact.current.id === 'b7.drums'), ammo: W ? W.ammo : 0, reloading: !!(W && W.reloading), gun: G.player.weapons.current, men, spots: F ? F.spots : [], open: F ? F.open : null, won: !!(F && F.won), block: F ? F.block : null,
      flankId: K && K.flank && !K.flank.done && K.flank.ai.h.alive ? K.flank.ai.h.slot : null,
      broke: K ? K.events.filter((q) => q.what === 'break' && G.time - q.t < 1.2 && q.at && Math.hypot(q.at[0] - e.x, q.at[1] - e.z) < 2.2).length : 0, wins: (G._c2won || []).length, moment: !!(sc.ctx && sc.ctx.flags.momentT != null && sc.ctx.flags.go == null), go: !!(sc.ctx && sc.ctx.flags.go != null), fails: Object.fromEntries(BEATS.map((b) => [b, G.fails(b, 'shootout')])), why: G.lastFail ? G.lastFail.why : null, warnedFor: G.lastFail ? G.lastFail.warnedFor : null, nFails: G.counters.fails || 0, shots: G.counters.shots, hits: G.counters.hits, warn: G.hud.warnText || null, saloon };
  })()`;
  // the beat's cover spot hidden from the most men as they stand now (then the nearest)
  // [C8] (nobody seen for a while, they are still up: the spot that sees most of them, standing)
  const HUNT = `(() => { const G = N.game, K = G.guns, F = G.scenes.ctx && G.scenes.ctx.flags.c2, V = N.THREE.Vector3;
    if (!F || !F.spots.length) return null;
    const men = G.stage.hoods.list.filter((h) => h.alive && (h.c8beat === G.scenes.beat || h.c8boss));
    let best = null;
    for (const sp of F.spots) {
      const eye = new V(sp.x, G.stage.surfaceY(sp.x, sp.z) + 1.6, sp.z);
      let n = 0;
      for (const h of men) if (K.see(eye, new V().setFromMatrixPosition(h.bones.chest.matrixWorld), 0.3)) n++;
      const sc = -n * 10 + Math.hypot(sp.x - G.eye.x, sp.z - G.eye.z) * 0.3;
      if (n > 0 && (!best || sc < best.sc)) best = { x: sp.x, z: sp.z, yaw: sp.yaw, sc, n, via: sp.via ? sp.via.map((q) => ({ ...q })) : null };
    }
    return best; })()`;
  const BEST = `(() => { const G = N.game, K = G.guns, F = G.scenes.ctx && G.scenes.ctx.flags.c2, V = N.THREE.Vector3;
    if (!F || !F.spots.length) return null;
    const men = G.stage.hoods.list.filter((h) => h.alive && (h.c8beat === G.scenes.beat || h.c8boss));
    let best = null;
    // [C5] (where I stand counts only when it is one of the beat's cover places: the open floor is no cover)
    const atSpot = F.spots.some((q) => Math.hypot(q.x - G.controller.pos.x, q.z - G.controller.pos.z) < 0.6);
    // [C8] after the critic: the man on the el and the man at the kitchen's hatch see by their own rules
    const EL = G.b7 && G.b7.el && G.b7.el.h.alive ? G.b7.el : null, KI = G.b7 && G.b7.kitchen && G.b7.kitchen.h.alive ? G.b7.kitchen : null;
    for (const sp of [...F.spots, ...(atSpot ? [{ x: G.controller.pos.x, z: G.controller.pos.z, here: true }] : [])]) {
      const eye = new V(sp.x, G.stage.surfaceY(sp.x, sp.z) + 0.66, sp.z);
      let n = 0;
      for (const h of men) if (EL && h === EL.h ? EL.can(eye) || EL.can(eye.clone().setY(eye.y + 0.35)) : KI && h === KI.h ? KI.can(eye) : K.see(new V(h.pos.x, h.pos.y + 1.55, h.pos.z), eye, 0.3)) n++;
      // (where I am is worse once it is spent: hit down there, or its cover shot through - window.C2SPENT)
      const sc = n * 10 + Math.hypot(sp.x - G.eye.x, sp.z - G.eye.z) + (sp.here ? -1 + (window.C2SPENT ? 12 : 0) : 0);
      if (!best || sc < best.sc) best = { x: sp.x, z: sp.z, yaw: sp.yaw, sc, n, here: !!sp.here, via: sp.via ? sp.via.map((q) => ({ ...q })) : null };
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
  // (the desk in the way - standing or on its side - is walked round, by the end nearer the goal: a
  // person does not walk into it. s.block is its footprint; null: nothing in the way)
  const crosses = (b, ax, az, bx, bz) => {
    // (the segment against the box, grown by a body's width: slab test)
    const m = 0.25, x0 = b.x0 - m, x1 = b.x1 + m, z0 = b.z0 - m, z1 = b.z1 + m;
    // (a goal hard against it - the cover places behind it - is walked to straight)
    if (bx > x0 && bx < x1 && bz > z0 && bz < z1) return false;
    let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[ax, bx - ax, x0, x1], [az, bz - az, z0, z1]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
      let u = (lo - p) / d, v = (hi - p) / d; if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
    }
    return true;
  };
  // (the shortest way round by its four corners - a side the block says is shut, the standing desk's east
  // where Ames's chair closes the gap, has none; the first corner on that way is where to walk now)
  const roundBlock = (s, x, z) => {
    const b = s.block;
    if (!b || !crosses(b, s.x, s.z, x, z)) return null;
    const nodes = [{ x: s.x, z: s.z }];
    for (const sx of ['W', 'E']) for (const sz of ['S', 'N']) {
      if ((b.shut || []).includes(sx)) continue;
      const c = { x: sx === 'W' ? b.x0 - 0.45 : b.x1 + 0.45, z: sz === 'S' ? b.z0 - 0.62 : b.z1 + 0.62 };
      if (Math.hypot(c.x - s.x, c.z - s.z) > 0.3) nodes.push(c);
    }
    nodes.push({ x, z });
    const n = nodes.length, goal = n - 1, dist = Array(n).fill(Infinity), prev = Array(n).fill(-1), done = Array(n).fill(false);
    dist[0] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === goal) break;
      done[u] = true;
      for (let v = 1; v < n; v++) {
        if (done[v] || crosses(b, nodes[u].x, nodes[u].z, nodes[v].x, nodes[v].z)) continue;
        const d = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].z - nodes[u].z);
        if (d < dist[v]) { dist[v] = d; prev[v] = u; }
      }
    }
    if (dist[goal] === Infinity) return null;
    let v = goal;
    while (prev[v] > 0) v = prev[v];
    return v === goal ? null : nodes[v];
  };
  // walk toward (x, z) by W and the mouse; true once there
  const walkTo = async (s, x, z, tol = 0.3) => {
    const dx0 = x - s.x, dz0 = z - s.z;
    if (Math.hypot(dx0, dz0) < tol) { await set('KeyW', false); return true; }
    const via = roundBlock(s, x, z);
    const dx = via ? via.x - s.x : dx0, dz = via ? via.z - s.z : dz0;
    const err = await aim(s, Math.atan2(-dx, -dz), -0.05, 0.6, 0.3);
    await set('KeyW', err < 0.6);
    return false;
  };

  // [C5] the moment's choice, by real input
  const press = async (code) => { await keyDown(code); await sleep(55); await keyUp(code); };
  const lookAtP = async (x, y, z, tol = 0.05) => { for (let i = 0; i < 30; i++) { const q = await js(ST); const e = await aim(q, yawTo(q, x, z), pitchTo(q, x, y, z), 0.6, 0.3); if (e < tol) return true; await sleep(30); } return false; };
  const lookAt = async (x, y, z, tol = 0.02) => { for (let i = 0; i < 40; i++) { const s = await js(ST); const e = await aim(s, yawTo(s, x, z), pitchTo(s, x, y, z), 0.6, 0.25); if (e < tol) return true; await sleep(30); } return false; };
  const choose = async (c) => {
    if (c === 'desk') {
      for (const [x, z] of [[4.0, 2.25], [4.85, 2.45]]) { for (let i = 0; i < 120; i++) { const s = await js(ST); if (await walkTo(s, x, z, 0.25)) break; await sleep(40); } }
      await set('KeyW', false);
      await lookAt(3.9, 0.85, 3.72, 0.05); await sleep(150);
      const cur = await js('N.game.interact.current && N.game.interact.current.id');
      if (cur === 'tip') await press('KeyE'); else log('c5 door: no tip prompt (' + cur + ')');
      await sleep(1300);
      for (let i = 0; i < 120; i++) { const s = await js(ST); if (await walkTo(s, 3.9, 3.25, 0.22)) break; await sleep(40); }
      await set('KeyW', false);
      await lookAt(-3.9, 1.2, 3.4, 0.1);
      await press('KeyC'); await sleep(300);
    } else if (c === 'move') {
      for (const [x, z] of [[1.0, 3.4], [-0.6, 3.6], [-0.85, 5.25]]) { for (let i = 0; i < 150; i++) { const s = await js(ST); if (await walkTo(s, x, z, 0.25)) break; await sleep(40); } }
      await set('KeyW', false);
      await lookAt(-3.9, 1.2, 3.4, 0.1);
      await press('KeyC'); await sleep(300);
    } else if (c === 'glass') {
      // (the shadows on the glass: aim at each, a round or two through it)
      for (let n = 0; n < 6; n++) {
        const s = await js(ST);
        const m = s.men.filter((q) => q.shade || q.see).sort((a, b) => a.d - b.d)[n % 3] || s.men[n % Math.max(1, s.men.length)];
        if (!m) break;
        await lookAt(m.x, m.y, m.z, 0.008);
        await sleep(rr(120, 260));
        await click(); await sleep(rr(350, 500));
        const q = await js(ST); if (q.go) break;
      }
      // (then to cover: behind his desk, its chair side, the desk between me and the opening)
      for (const [x, z] of [[3.0, 2.1], [4.8, 2.2], [4.85, 2.65]]) { for (let i = 0; i < 120; i++) { const s = await js(ST); if (await walkTo(s, x, z, 0.25)) break; await sleep(40); } }
      await set('KeyW', false);
      await lookAt(0.0, 1.2, 3.4, 0.1);
      await press('KeyC');
    }
    log('c5 door: chose ' + c);
  };
  const P0 = { ...P };
  for (const beat of beats) {
    const B = rec.beats[beat] = { tries: [] };
    // (a new contest: the hand as it was; what a fall taught it is for the retries of that contest)
    Object.assign(P, P0);
    for (let k = 0; k < tries; k++) {
      await releaseAll();
      // to the beat, as a checkpoint puts me there
      // ([C10b] opts.flow: the whole play - the beat comes by the story, a retry by the game's own fail; never sent)
      if (!opts.flow) await js(`(N.game.scenes.go('shootout', { beat: '${beat}', fade: 'cut', card: false }), 1)`);
      else for (let w = 0; w < 1200; w++) { const q = await js(`(() => { const sc = N.game.scenes; return sc.current && sc.current.id === 'shootout' && sc.beat === '${beat}' && !sc.trans && !N.game.failing && sc.fadeK < 0.5; })()`); if (q === true) break; await sleep(100); }
      await sleep(400);
      const t0 = Date.now();
      const g0 = await js('N.game.time');
      let s0 = await js(ST);
      const fails0 = s0.nFails, shots0 = s0.shots, hits0 = s0.hits, wins0 = s0.wins;
      const dbg = {}, noticed = new Map(), visAt = new Map(); let lastSeenAt = null, tellAt = 0, lastUp = Date.now(), upAt = 0, snapT = 0, target = null, seenAt = 0, onSpot = null, goTo = null, moveCool = 0, downUntil = 0, burstLeft = 0, lastShot = 0, warnedBefore = false, lowHp = 100, prevHp = 100, duckAt = 0, holdUpUntil = 0, hitTimes = [], outThere = false, answerUntil = 0, answerId = null, traceT = 0;
      let end = null, anySeenAt = Date.now();
      // [C5] the moment before the door: the choice (once the take has given the view back)
      if (beat === 'shadows' && P.act && opts.choice && opts.choice !== 'none') {
        for (let w = 0; w < 80; w++) { const q = await js(ST); if (q && (q.moment || q.go)) break; await sleep(100); }
        await choose(opts.choice);
      }
      // [C5] the corridor: the good hand looks out (the lift's dial sweeping up: they are coming), then
      // holds the outer office from behind the secretary's desk - they must come in at the door (opts.out: the cart instead)
      if (beat === 'corridor' && P.act && P.cover) {
        const route = opts.out ? [[-4.6, 3.3], [-4.6, 0.6], [-4.35, -0.05]] : [[-4.5, 3.35], [-2.6, 3.6], [-0.85, 5.3]];
        for (const [x, z] of route) { for (let i = 0; i < 160; i++) { const q = await js(ST); if (await walkTo(q, x, z, 0.25)) break; await sleep(40); } }
        await set('KeyW', false);
        if (opts.out) await lookAt(-4.78, 1.2, -7.0, 0.1); else await lookAt(-3.88, 1.2, 3.4, 0.1);
        await press('KeyC');
        log('c5 door: ' + (opts.out ? 'out to the cart' : 'behind the secretary\'s desk'));
      }
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
        // ([C8] the scene gone on to a later beat: this one was won - its record was missed)
        { const B8 = ['cars', 'flank', 'el', 'saloon', 'cardinal', 'last', 'end']; if (B8.indexOf(s.beat) > B8.indexOf(beat)) { end = { won: true, flowedOn: s.beat }; break; } }
        if (s.scene !== 'shootout') { end = { won: false, why: 'left the scene (page reloaded?)' }; break; }
        if (!P.act || s.trans || s.fade > 0.5) { await sleep(120); dbg['idle'] = (dbg['idle'] || 0) + 1; continue; }
        const now = Date.now();
        // [C5] ---- the good hand tops up in a lull: low, nobody in sight, a second and a half since the last round
        // (and with nobody left on their feet - everyone down, the next not come yet - it fills the cylinder: one round gone is one)
        const allQuiet = !s.men.some((m) => m.st !== 'wait');
        if (P.cover && !P.standReload && s.ammo > 0 && (s.ammo < 5 || (allQuiet && s.ammo < 6)) && !s.reloading && !s.men.some((m) => m.see || m.line) && Date.now() - lastShot > 1500) {
          await set('RMB', false);
          if (s.ck < 0.5 && !s.on) await tap('KeyC');
          await tap('KeyR'); await sleep(rr(200, 350)); dbg['lullReload'] = (dbg['lullReload'] || 0) + 1; continue;
        }
        // ---- reload: empty -> down (good) and R
        // [C8] out of drums: back to the counter, E - Dot slides one up (a good hand goes before it is dry)
        // ([C8] after the critic: only while she has one for this movement - none left, the hand fights with what is in the gun)
        if (P.act && s.reserve <= 0 && s.dotLeft > 0 && s.ammo < (P.cover ? 12 : 1) && !s.reloading && !s.men.some((m) => m.line && m.see)) {
          await set('RMB', false); if (s.on) await tap('KeyC');
          const tz = Math.max(-3.0, Math.min(8.0, s.z));
          let got = false;
          // (behind the counter: out round its end first - she slides it across from her side)
          if (s.x < -14.9) for (const [x, z] of [[-15.35, -4.6], [-13.3, -4.75]]) for (let i = 0; i < 120; i++) { const q = await js(ST); if (q.failing || q.dead || await walkTo(q, x, z, 0.35)) break; await sleep(40); }
          for (let i = 0; i < 160 && !got; i++) {
            const q = await js(ST);
            if (q.failing || q.dead) break;
            if (await walkTo(q, -13.25, tz, 0.3)) { await set('KeyW', false); await lookAtP(-14.6, 1.3, tz); await sleep(250); const q2 = await js(ST); if (q2.drumsUp) { await tap('KeyE'); await sleep(2600); got = true; } else { await sleep(200); } }
            await sleep(40);
          }
          onSpot = null; goTo = null; dbg['drums'] = (dbg['drums'] || 0) + 1; continue;
        }
        if (s.ammo <= 0 && !s.reloading) {
          await set('RMB', false);
          if (P.cover && s.ck < 0.5 && !s.on && !(P.standReload && Math.random() < P.standReload)) await tap('KeyC');
          await tap('KeyR'); await sleep(rr(200, 350)); dbg['reloadTap'] = (dbg['reloadTap'] || 0) + 1; continue;
        }
        if (s.reloading) { await set('RMB', false); await sleep(100); dbg['reloading'] = (dbg['reloading'] || 0) + 1; continue; }
        if (!P.cover && s.on) { await tap('KeyC'); await sleep(60); continue; }
        // (the bad player out into the open first, where the beat has one: the street's pavement)
        if (!P.cover && s.open && !outThere) { if (await walkTo(s, s.open.x, s.open.z, 0.4)) outThere = true; else { await sleep(40); continue; } }
        // [C8] after the critic: his car must be stopped - a hand that has learned the street (good, clumsy) shoots its
        // lamps when they glare, then its tyres, up over the sill; down through a Tommy gun's burst
        if (P.cover && beat === 'saloon' && s.saloon && s.saloon.pts.length && !(s.men.some((m) => m.kind === 'tommy' && m.st === 'fire' && m.line) && s.saloon.left > 18) && now > downUntil) {
          const S2 = s.saloon;
          const angle = (q) => Math.hypot(wrap(yawTo(s, q.x, q.z) - s.yaw), pitchTo(s, q.x, q.y, q.z) - s.pitch);
          const lamps = S2.pts.filter((q) => q.kind === 'lamp' && q.vis), tyres = S2.pts.filter((q) => q.kind === 'tyre' && q.vis && q.d < 34);
          const pick = (S2.glare > 0.2 && lamps.length ? lamps : tyres).sort((a, b) => angle(a) - angle(b))[0];
          // (nothing of it in sight from here - the bins and the pilaster hide the avenue from the south window's
          // end: the hand goes to the window's north end, which sees down it)
          if (!pick && Math.hypot(s.x + 10.85, s.z + 2.45) > 0.45) {
            await set('RMB', false); onSpot = { x: -10.85, z: -2.45 }; goTo = null;
            // (from behind the counter: round its south end first)
            if (s.x < -14.9) { const v = s.z > -4.2 ? { x: -15.35, z: -4.6 } : { x: -13.3, z: -4.75 }; await walkTo(s, v.x, v.z, 0.35); }
            else await walkTo(s, -10.85, -2.45, 0.35);
            await sleep(40); dbg['salWalk'] = (dbg['salWalk'] || 0) + 1; continue;
          }
          await set('KeyW', false);
          if (s.on && s.rk < 0.85) { await set('RMB', true); await sleep(40); dbg['salRise'] = (dbg['salRise'] || 0) + 1; continue; }
          if (pick) {
            if (!target || target.id !== 'sal:' + pick.kind) target = { id: 'sal:' + pick.kind, err: [(Math.random() - 0.5) * 2 * P.errM / Math.max(2, pick.d) * 0.5, (Math.random() - 0.5) * 2 * P.errM / Math.max(2, pick.d) * 0.5] };
            const e2 = await aim(s, yawTo(s, pick.x, pick.z) + target.err[0], pitchTo(s, pick.x, pick.y, pick.z) + target.err[1], 0.65, 0.25);
            if (e2 < 0.006 + 0.05 / Math.max(2, pick.d) && now - lastShot > rr(P.gap[0], P.gap[1])) {
              await sleep(rr(P.settle[0], P.settle[1]));
              await mouse('mousePressed', cx, cy, 'left'); await sleep(rr(150, 260)); await mouse('mouseReleased', cx, cy, 'left');
              lastShot = Date.now(); target = null; dbg['salShot'] = (dbg['salShot'] || 0) + 1;
            }
            await sleep(30); continue;
          }
        }
        const men = s.men.filter((m) => !m.entry || m.see);
        // ---- the good player: cover first
        let threat = null;
        if (P.cover) {
          // the men who have a line on me and whom I can see (a flanker in the open)
          // (a man who has me while I am DOWN: one who has my side - not one who sees me because I rose to shoot)
          // (a man coming in through a door with a line on me is one too)
          const threats = s.rk < 0.3 ? s.men.filter((m) => m.line && m.see && !(m.boss && m.st !== 'open')) : [];
          // (the warning says move: a man has my angle, one is going round, my cover is going - the good hand moves)
          const pressed = P.lateMove ? (threats.length >= 2 || (threats.length >= 1 && s.hp < 25)) : threats.length >= 2 || (threats.length >= 1 && s.hp < 40) || s.broke > 0 || (s.warn && /cover|angle|going round|Behind/.test(s.warn));
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
            // [C8] (a spot behind the counter is reached round its end: its way's points first)
            // (in or out from behind the counter: round its south end, the points in the order the side asks)
            if (goTo && !goTo.route && (s.x > -14.9) !== (goTo.x > -14.9)) goTo.route = s.x > -14.9 ? [{ x: -13.3, z: -4.75 }, { x: -15.35, z: -4.6 }] : [{ x: -15.35, z: -4.6 }, { x: -13.3, z: -4.75 }];
            // [C8] after the critic: a hand that walks into a chair or a man and gets no further does not go on
            // pressing W into it - after a second and a half it fights from where it stands
            if (goTo) {
              if (!goTo.prog || Math.hypot(s.x - goTo.prog.x, s.z - goTo.prog.z) > 0.25) goTo.prog = { x: s.x, z: s.z, t: now };
              else if (now - goTo.prog.t > 1500) { await set('KeyW', false); goTo = null; onSpot = { x: s.x, z: s.z }; moveCool = now + 6000; dbg['stuck'] = (dbg['stuck'] || 0) + 1; continue; }
            }
            if (goTo && goTo.route && goTo.route.length) { const v = goTo.route[0]; if (await walkTo(s, v.x, v.z, 0.35)) goTo.route.shift(); await sleep(40); dbg['walking'] = (dbg['walking'] || 0) + 1; continue; }
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
        // [C8] (the good hand goes looking when nobody has shown for a while: up to the spot that sees them)
        if (visible.length || s.men.some((m) => m.line)) anySeenAt = now;
        else if (P.cover && s.men.length && now - anySeenAt > 8000 && !goTo) { const hg = await js(HUNT); if (hg) { goTo = hg; onSpot = null; anySeenAt = now; dbg['hunt'] = (dbg['hunt'] || 0) + 1; await set('RMB', false); continue; } }
        // (bad: out of sight a moment and back: a new reaction before the shot)
        if (P.renotice) for (const m of visible) { if (now - (visAt.get(m.id) || 0) > P.renotice) noticed.set(m.id, now + rr(P.react[0], P.react[1])); visAt.set(m.id, now); }
        // (the man I am answering, first: not the one across the street)
        if (answerId != null) { const a = visible.find((q) => q.id === answerId); if (a) { visible.length = 0; visible.push(a); } }
        // (where each was last seen: the angle a player holds - the doorway he peeks from)
        for (const m of visible) lastSeenAt = { x: m.x, y: m.see ? m.y : m.hy - 0.05, z: m.z, t: now };
        const heavy = s.men.find((m) => m.kind === 'rusher' && m.d < 9);
        if (opts.trace && now - (traceT || 0) > opts.trace) { traceT = now; log(`trace ${JSON.stringify({ t: Math.round((now - t0) / 100) / 10, hp: Math.round(s.hp), ammo: s.ammo, res: s.reserve, rl: s.reloading, dbg, rk: +s.rk.toFixed(2), x: +s.x.toFixed(1), z: +s.z.toFixed(1), thr: threat && threat.id, ans: answerId, goTo: !!goTo, vis: visible.map((q) => q.id + q.kind[0]), men: s.men.map((q) => q.id + q.kind[0] + ":" + q.st + (q.line ? "!" : "") + (q.see ? "*" : "")) })}`); }
        // [C8] Dot's cry: a man in at the door for her - every hand turns to him, up off the floor to get a line
        const dm = s.men.find((m) => m.kind === 'dotman' && m.inside);
        if (dm) {
          if (s.on && !(dm.see || dm.seeH)) await tap('KeyC');
          const e2 = await aim(s, yawTo(s, dm.x, dm.z), pitchTo(s, dm.x, dm.y, dm.z), 0.7, 0.35);
          if (e2 < 0.04 && (dm.see || dm.seeH) && Date.now() > (seenAt || 0)) { await mouse('mousePressed', cx, cy, 'left'); await sleep(rr(220, 380)); await mouse('mouseReleased', cx, cy, 'left'); lastShot = Date.now(); }
          else if (!seenAt || Date.now() - seenAt > 3000) seenAt = Date.now() + rr(P.react[0], P.react[1]);
          await sleep(30); dbg['dot'] = (dbg['dot'] || 0) + 1; continue;
        }
        const tommyFiring = s.men.some((m) => (m.kind === 'tommy' && m.st === 'fire') || (m.boss && m.st === 'draw' && m.line));
        // [C8] him: a round into him counts only when he is open - the good hand holds its fire on him otherwise
        if (P.cover) for (let i = visible.length - 1; i >= 0; i--) if (visible[i].boss && visible[i].st !== 'open') visible.splice(i, 1);
        const dotMan = s.men.find((m) => m.kind === 'dotman' && m.inside && (m.see || m.seeH));
        const openBoss = s.men.find((m) => m.boss && m.st === 'open' && (m.see || m.seeH));
        if (dotMan || openBoss) { visible.length = 0; visible.push(dotMan || openBoss); holdUpUntil = Date.now() + 900; }
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
          // ([C8] after the critic: he is open only after his shot - a hand that knows it comes up at the bang)
          const bossOpen = s.men.some((m) => m.boss && m.st === 'open');
          const wantUp = (now < holdUpUntil && now > downUntil) || (bossOpen && !s.men.some((m) => m.kind === 'tommy' && m.st === 'fire' && m.line)) || (!tommyFiring && now > downUntil && ((tellAt && now >= tellAt) || heavy || look || s.rk > 0.5 || now < answerUntil));
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
          if (s.gun === 'tommy') { await mouse('mousePressed', cx, cy, 'left'); await sleep(P.hold ? rr(1400, 2200) : rr(180, 320)); await mouse('mouseReleased', cx, cy, 'left'); }
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
      if (opts.dbg) tr.dbg = dbg;
      if (beat === 'saloon') tr.saloon = await js('(() => { const c = N.game.b7 && N.game.b7.cars.saloon; return c ? { flat: (c.tyres || []).filter(Boolean).length, lamps: c.lensBroken.filter(Boolean).length, stopped: !!c.c8flat } : null; })()');
      // (the flank: where the door's last man stood when the door went quiet - the checkpoint puts him back at the door's jamb)
      if (beat === 'flank') tr.doorLeft = await js('((N.game._c5 && N.game._c5.doorLeft) || []).map((p) => [+p.x.toFixed(1), +p.z.toFixed(1)])');
      B.tries.push(tr);
      log(`c8 ${rec.profile} ${beat} try ${k + 1}: ${JSON.stringify(tr)}`);
      // (the first-timer reads the fall's words and does that one thing better on the retry:
      // the retry says in a word what went wrong - WAVE_C §1 rule 2)
      if (P.learns && !end.won && end.why) {
        const w = end.why;
        // [C8] the one who stood at the window holding the trigger learns the whole lesson: cover
        if (P.becomes) { const b = P.becomes; Object.assign(P, PROFILES[b]); P.becomes = null; log(`c8 ${rec.profile} learns from '${w}': plays as ${b} now`); }
        if (/angle|Flanked|came round/.test(w)) P.lateMove = false;
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
