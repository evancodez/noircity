// C2 critic: a player's hands in the gun kit's test bed, by real input only
// (keys, mouse buttons, mouse moves). The critic's own, not the owner's bot.
// What the hands may know is what the screen and the speakers give:
//   - a man is a target only when he is in the view and nothing solid is
//     between (a pane - clear or frosted and lit - is seen through: a shadow);
//   - his tell (the gun coming up) is seen only when he is in the view;
//   - a hit says where it came from (the splash's edge, the shot's sound):
//     the bearing of the man who fired, thrown off by +-25 degrees;
//   - the warning line's words (they are on the screen);
//   - the cover I know is what I can see in the room (spots chosen by eye
//     from the plan, below), never the men's cover points or the nav.
// opts.style:
//   'good'  C at once, down behind the cover; RMB up, a reaction of 300-550 ms,
//           a hand's aim (err 0.022 rad), one or two rounds, down; down when hit
//           or when a man in view brings his gun up; R down behind it; hurt:
//           down until it mends; a flank's word: turned that way at once, the
//           man shot; 'Move!': on to the next cover spot
//   'bad'   a first-timer: reactions 550-950 ms, err 0.045, up too long (3-5
//           rounds), forgets to duck when hit half the time, misses the
//           warning's words half the time, now and then a wrong key (E or
//           SPACE for C, a click for R); after each fall he reads the reason
//           and does that one thing better (as a person does)
//   'open'  stands in the open and trades (never C): the brief's 'bad'
// opts.beats: which beats (each from the title, ?start=guns.<beat>);
// opts.tries: lives per beat before giving up (a stuck beat is a finding)
// Returns per beat: tries, won, the reasons of the falls, hits taken, time.
const SPOTS = {
  // (behind the tipped desk; its other end; the crates by the west wall)
  door: [{ x: -4.98, z: -3.8, yaw: -Math.PI / 2 }, { x: -4.98, z: -4.5, yaw: -Math.PI / 2 }, { x: -7.2, z: -2.4, yaw: -Math.PI / 2 + 0.4 }],
  two_ways: [{ x: -4.98, z: -3.8, yaw: -Math.PI / 2 }, { x: -4.98, z: -4.5, yaw: -Math.PI / 2 }, { x: -7.2, z: -2.4, yaw: -Math.PI / 2 + 0.6 }],
  // (behind the bar counter; its east end; its west end)
  pin: [{ x: 4.6, z: -5.55, yaw: Math.PI }, { x: 6.6, z: -5.55, yaw: Math.PI }, { x: 2.9, z: -5.6, yaw: Math.PI + 0.3 }],
  // (behind the reception counter)
  rush: [{ x: -3.5, z: 2.4, yaw: Math.PI }, { x: -4.2, z: 2.4, yaw: Math.PI }],
  // (behind the near car; its other end; the crates by the east pavement)
  street: [{ x: -5.0, z: 7.85, yaw: Math.PI }, { x: -7.2, z: 7.9, yaw: Math.PI }, { x: -3.2, z: 7.9, yaw: Math.PI }],
};
SPOTS.street_rev = SPOTS.street;

export default async function ({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, send, opts, cursor }) {
  const PORT = process.env.NOIR_PORT || 5173;
  const style = opts.style || 'good';
  const beats = opts.beats || ['door', 'two_ways', 'pin', 'rush', 'street', 'street_rev'];
  const maxTries = opts.tries ?? 4;
  const rr = (a, b) => a + (b - a) * Math.random();
  const now = () => Date.now();
  const out = {};
  const held = new Set();
  const kd = async (c) => { if (!held.has(c)) { held.add(c); await keyDown(c); } };
  const ku = async (c) => { if (held.has(c)) { held.delete(c); await keyUp(c); } };
  const tap = async (c, ms = 50) => { await keyDown(c); await sleep(ms); await keyUp(c); };
  let rmb = false;
  const rmbOn = async (on) => { const [x, y] = cursor(); if (on && !rmb) { rmb = true; await mouse('mousePressed', x, y, 'right'); } else if (!on && rmb) { rmb = false; await mouse('mouseReleased', x, y, 'right'); } };
  const fire = async () => { const [x, y] = cursor(); await mouse('mousePressed', x, y, 'left'); await sleep(40); await mouse('mouseReleased', x, y, 'left'); };
  const letGo = async () => { for (const c of [...held]) await ku(c); await rmbOn(false); };

  const READ = `(() => { const C = N.controller, e = G.eye, H = G.health, W = G.player.weapons.active, K = G.guns, cam = N.camera;
    const out = { t: G.time, beat: G.scenes.beat, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, ck: C.crouchK || 0, rk: C.riseK || 0, on: !!C.crouchOn,
      x: C.pos.x, z: C.pos.z, ey: e.y, hp: H.hp, dead: H.dead, failing: G.failing ? G.failing.why : null, warn: G.hud.kit.warnText,
      ammo: W ? W.ammo : 0, reloading: !!(W && W.reloading), wpn: W ? W.name : '', mode: C.mode, men: [], hitBy: null, hitT: K && K.lastKill ? K.lastKill.t : -1 };
    if (K && K.lastKill && K.lastKill.ai && K.lastKill.ai.h) { const p = K.lastKill.ai.h.pos; out.hitBy = [p.x, p.z]; }
    const d = new N.THREE.Vector3();
    for (const h of G.stage.hoods.list) {
      if (!h.alive) continue;
      const c = h.bones.chest.getWorldPosition(new N.THREE.Vector3());
      const hd = h.bones.head.getWorldPosition(new N.THREE.Vector3());
      const p = c.clone().project(cam);
      const inView = p.z < 1 && Math.abs(p.x) < 0.92 && Math.abs(p.y) < 0.92;
      d.subVectors(c, e); const L = d.length(); d.divideScalar(L);
      let o = e.clone(), left = L, seen = true, glass = false;
      for (let k = 0; k < 4 && seen; k++) { const hit = G.rays.raycast(o, d, left - 0.25); if (!hit) break; if (hit.mesh.userData.pane) { glass = true; o = hit.point.clone().addScaledVector(d, 0.02); left -= hit.t + 0.02; } else seen = false; }
      const ai = G.ais.get(h), st = ai && ai.brain && ai.brain.S ? ai.brain.S.state : '';
      out.men.push({ st: st + (ai && ai.brain && ai.brain.S ? ':' + (ai.brain.S.line ? 'L' : '') + (ai.brain.S.cover ? 'c' : '') + Math.round(ai.brain.S.mag) : ''), id: h.slot, kind: ai && ai.brain ? ai.brain.kind : '', x: c.x, y: c.y, z: c.z, hy: hd.y, L, seen, glass, inView, up: inView && seen && (st === 'aim' || st === 'fire' || st === 'out') });
    }
    return out; })()`;

  for (const b of beats) {
    // from the title, as a player starts it
    await letGo();
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?mute=1${opts.query || ""}&start=guns.${b}` });
    await sleep(800);
    for (let k = 0; k < 100; k++) { if (await js('!!window.__noirReady') === true) break; await sleep(200); }
    await sleep(1500);
    for (let k = 0; k < 4; k++) {
      const r = await js(`(() => { const e = document.querySelector('#title .opt[data-k=begin]'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      if (r) { await mouse('mousePressed', r[0], r[1]); await sleep(40); await mouse('mouseReleased', r[0], r[1]); }
      let ok = false;
      for (let w = 0; w < 14 && !ok; w++) { await sleep(250); ok = await js(`G.state === 'playing' && !!G.scenes.current && G.scenes.beat === '${b}'`) === true; }
      if (ok) break;
    }
    // (the view as the beat set it: the click on BEGIN left the cursor on the
    // button, so the harness's first mouse move would jump the view - a
    // person's mouse never does; the view is put back where it was)
    { const v0 = await js(`({ yaw: N.controller.yaw, pitch: N.controller.pitch, sens: N.controller.sensitivity })`);
      await turn(0, 0); await sleep(120);
      const v1 = await js(`({ yaw: N.controller.yaw, pitch: N.controller.pitch })`);
      await turn(Math.round(-(Math.atan2(Math.sin(v0.yaw - v1.yaw), Math.cos(v0.yaw - v1.yaw))) / v0.sens), Math.round((v1.pitch - v0.pitch) / v0.sens)); await sleep(60);
      const v2 = await js(`({ yaw: N.controller.yaw, pitch: N.controller.pitch })`);
      log(`${b}: view put back (jump ${(v1.yaw - v0.yaw).toFixed(2)}, ${(v1.pitch - v0.pitch).toFixed(2)} rad; now off ${(v2.yaw - v0.yaw).toFixed(3)}, ${(v2.pitch - v0.pitch).toFixed(3)})`); }
    const R = { tries: 1, won: false, falls: [], hits: 0, shots: 0, time: 0, kills: 0 };
    const T0 = now();
    // the hands' state for this life
    let life = null;
    const learnt = { duck: 0, flank: 0, mend: 0, reload: 0, move: 0 };   // (bad: what the falls taught)
    const newLife = () => {
      life = { phase: 'start', t: now(), target: null, seenAt: 0, aimed: 0, upAt: 0, shotsUp: 0, wantUp: 0, downUntil: 0, lastShot: 0,
        hp: 100, spot: 0, moving: null, turnTo: null, warnSeen: null, warnAt: 0, wrongKey: false, scanAt: now() + rr(2500, 4000), lastHitT: -1 };
    };
    newLife();
    let wonAt = null, prevFail = null;
    const P = style === 'good' ? { react: [300, 550], err: 0.022, burst: [1, 2], duckHit: 1, readWarn: 1, wrong: 0, downFor: [550, 1000], mendAt: 45 }
      : style === 'bad' ? { react: [550, 950], err: 0.045, burst: [3, 5], duckHit: 0.5, readWarn: 0.5, wrong: 0.12, downFor: [300, 700], mendAt: 25 }
      : { react: [350, 600], err: 0.03, burst: [99, 99], duckHit: 0, readWarn: 0, wrong: 0, downFor: [0, 0], mendAt: 0 };
    for (;;) {
      if (now() - T0 > (opts.timeout ?? 240000)) { log(`${b}: timeout`); break; }
      const s = await js(READ);
      if (!s || s.__exc) { await sleep(150); continue; }
      if (s.beat !== b) { if (!R.won) { R.won = true; wonAt = now(); R.time = +((now() - T0) / 1000).toFixed(1); log(`${b}: WON on try ${R.tries} (${R.time} s)`); await shot(`${b}_${style}_won`); } break; }
      // a fall: its words; the next life
      if (s.failing) {
        if (prevFail !== s.failing || !life.failed) {
          life.failed = true; prevFail = s.failing;
          R.falls.push(s.failing);
          log(`${b}: FELL (${s.failing}) try ${R.tries}`);
          await letGo();
          if (R.falls.length <= 2) await shot(`${b}_${style}_fall${R.falls.length}`);
          // (bad: the reason read; that one thing done better next time)
          if (style === 'bad') {
            const w = s.failing;
            if (/open|Get down|standing/i.test(w)) learnt.duck++;
            if (/Flank|Behind/i.test(w)) learnt.flank++;
            if (/too long|risen|over the cover/i.test(w)) learnt.duck++;
            if (/Reload/i.test(w)) learnt.reload++;
            if (/chew|shot away|angle/i.test(w)) learnt.move++;
            if (/walked right up/i.test(w)) learnt.flank++;
          }
        }
        await sleep(200);
        continue;
      }
      if (life.failed) {
        R.tries++;
        if (R.tries > maxTries) { log(`${b}: gave up after ${maxTries} tries`); break; }
        newLife();
        await sleep(rr(300, 600));
        continue;
      }
      if (s.mode !== 'gun') { await sleep(100); continue; }
      const t = now();
      // (a man down: a frame as he falls and one as he lies - opts.deathShots)
      { const ids = new Set(s.men.map((m) => m.id));
        if (life.ids) for (const id of life.ids) if (!ids.has(id)) { R.kills++; if (opts.deathShots && (R.deathN = (R.deathN || 0) + 1) <= 6) { await shot(`${b}_${style}_death${R.deathN}a`); life.deathAt = t; life.deathN = R.deathN;
          // (opts.deathFilm: [n, ms] - a film of the fall, the hands still, his body's place logged each frame)
          if (opts.deathFilm) { for (let i = 0; i < opts.deathFilm[0]; i++) { await sleep(opts.deathFilm[1]); log(`  death ${R.deathN} f${i}: ` + JSON.stringify(await js(`G.stage.hoods.list.filter((h) => !h.alive).map((h) => [h.state, +h.pos.x.toFixed(2), +h.pos.z.toFixed(2), +G.time.toFixed(2)])`))); await shot(`${b}_${style}_death${R.deathN}_f${i}`); } }
        } }
        life.ids = ids;
        if (life.deathAt && t - life.deathAt > 1600) { await shot(`${b}_${style}_death${life.deathN}b`); life.deathAt = 0; } }
      if (opts.debug && t - (life.dbgS || 0) > 3000) { life.dbgS = t; await shot(`${b}_dbg_${String(Math.round((t - T0) / 1000)).padStart(3, '0')}_${life.phase}`); }
      if (opts.debug && t - (life.dbg || 0) > 1500) { life.dbg = t; log(`  ${life.phase} hp${Math.round(s.hp)} ck${s.ck.toFixed(1)} rk${s.rk.toFixed(1)} ammo${s.ammo} yaw${s.yaw.toFixed(2)} warn=${s.warn} men=${s.men.map((m) => `${m.kind}[${m.st}]@${m.x.toFixed(1)},${m.z.toFixed(1)}${m.seen ? 'S' : ''}${m.inView ? 'V' : ''}${m.up ? 'U' : ''}`).join(' ')}`); }
      const k = style === 'bad' ? { duck: Math.min(1, P.duckHit + 0.25 * learnt.duck), warn: Math.min(1, P.readWarn + 0.25 * learnt.flank), react: P.react, burst: [Math.max(1, P.burst[0] - learnt.duck), Math.max(2, P.burst[1] - learnt.duck)], reloadDown: Math.min(1, 0.4 + 0.3 * learnt.reload), move: Math.min(1, 0.3 + 0.35 * learnt.move) }
        : { duck: P.duckHit, warn: P.readWarn, react: P.react, burst: P.burst, reloadDown: style === 'good' ? 1 : 0, move: style === 'good' ? 1 : 0 };
      // a hit: where from (the splash, the sound)
      const hurt = s.hp < life.hp - 0.5;
      if (hurt) R.hits++;
      life.hp = s.hp;
      // the warning's words, read (or not)
      if (s.warn && s.warn !== life.warnSeen) { life.warnSeen = s.warn; life.warnRead = Math.random() < k.warn; life.warnAt = t + rr(k.react[0], k.react[1]); }
      if (!s.warn) life.warnSeen = null;
      const warn = life.warnRead && t >= life.warnAt ? s.warn : null;
      const good = style === 'good', open = style === 'open';
      const down = async () => { await rmbOn(false); if (!s.on && !open) await tap('KeyC'); };
      const bearing = (x, z) => Math.atan2(-(x - s.x), -(z - s.z));
      const angTo = (m) => { const yw = bearing(m.x, m.z), pt = Math.atan2(m.y - s.ey, Math.hypot(m.x - s.x, m.z - s.z));
        return { dy: Math.atan2(Math.sin(yw - s.yaw), Math.cos(yw - s.yaw)), dp: pt - s.pitch }; };
      const flick = async (dy, dp = 0, steps = 3) => { const px = Math.round(-dy / s.sens), py = Math.round(-dp / s.sens), n = Math.max(steps, Math.ceil(Math.hypot(px, py) / 90)); for (let i = 0; i < n; i++) { await turn(Math.round(px / n), Math.round(py / n)); await sleep(16); } };
      // ---- the start: C, as taught (the open style never)
      if (life.phase === 'start') {
        if (!open && !s.on) { if (P.wrong && Math.random() < P.wrong) await tap(Math.random() < 0.5 ? 'KeyE' : 'Space'); await sleep(rr(k.react[0], k.react[1])); await tap('KeyC'); }
        // (the open style stands up where a beat starts him down - the street)
        if (open && s.on) { await sleep(rr(300, 500)); await tap('KeyC'); }
        life.phase = 'down'; life.downUntil = t + rr(400, 900);
        await sleep(100); continue;
      }
      // ---- the men I can see now (in the view, nothing solid between)
      const visible = s.men.filter((m) => m.seen && m.inView);
      for (const m of visible) life.lastSeen = { x: m.x, y: m.y, z: m.z, t };
      // ---- a strafe to the next spot (crouched; the view kept on the room)
      if (life.moving) {
        const m = life.moving, dx = m.x - s.x, dz = m.z - s.z, D = Math.hypot(dx, dz);
        const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
        if (D < 0.3 || t > m.until || visible.length) { for (const c of keys) await ku(c); life.moving = null; life.downUntil = t + rr(200, 450); }
        else {
          // (the local frame: forward (-sin yaw, -cos yaw), right (cos yaw, -sin yaw))
          const f = dx * -Math.sin(s.yaw) + dz * -Math.cos(s.yaw), r = dx * Math.cos(s.yaw) + dz * -Math.sin(s.yaw);
          const want = new Set();
          if (f > 0.15) want.add('KeyW'); if (f < -0.15) want.add('KeyS'); if (r > 0.15) want.add('KeyD'); if (r < -0.15) want.add('KeyA');
          for (const c of keys) { if (want.has(c)) await kd(c); else await ku(c); }
          await sleep(40); continue;
        }
      }
      // ---- reloading: down behind it while it goes
      if (s.reloading) { if (!open && life.reloadDown) await down(); await sleep(80); continue; }
      const mag = s.wpn === 'tommy' ? 50 : 6;
      const nearSeen = visible.some((m) => m.L < 7);
      if (s.ammo <= 0 || (good && s.wpn !== 'tommy' && s.ammo <= 2 && !visible.length) || (good && s.wpn === 'tommy' && s.ammo <= 12 && !visible.length)) {
        if (s.ammo < mag) {
          life.reloadDown = Math.random() < k.reloadDown;
          if (!open && life.reloadDown) { await down(); await sleep(rr(150, 300)); }
          if (P.wrong && Math.random() < P.wrong) { await fire(); await sleep(rr(300, 600)); }
          await tap('KeyR'); R.reloads = (R.reloads || 0) + 1;
          await sleep(rr(200, 350)); continue;
        }
      }
      void nearSeen;
      // ---- a hit: down (good always, bad sometimes); from off the screen, the view turned to it
      if (hurt) {
        life.hitAt = t;
        if (!open && Math.random() < k.duck && rmb && !visible.some((m) => m.L < 4.5)) { await down(); life.phase = 'down'; life.downUntil = t + rr(P.downFor[0], P.downFor[1]) + 200; }
        if (s.hitBy) {
          const err = Math.atan2(Math.sin(bearing(s.hitBy[0], s.hitBy[1]) - s.yaw), Math.cos(bearing(s.hitBy[0], s.hitBy[1]) - s.yaw));
          if (Math.abs(err) > 0.75 && Math.random() < k.warn) { await sleep(rr(k.react[0], k.react[1]) * 0.6); await flick(err + rr(-0.35, 0.35)); life.target = null; }
        }
        continue;
      }
      // ---- the warning's words: behind me / going round: the view turned that way
      if (warn && /Behind you|going round/.test(warn) && life.turnedFor !== warn && !visible.some((m) => m.up)) {
        life.turnedFor = warn;
        const ms = s.men.filter((m) => !m.inView).sort((a, c) => a.L - c.L);
        let dy = null;
        // (behind: the steps and the shots say where; going round: the side named)
        if (/Behind/.test(warn) && ms.length) dy = angTo(ms[0]).dy + rr(-0.4, 0.4);
        else if (/right/.test(warn)) dy = -rr(0.9, 1.3);
        else if (/left/.test(warn)) dy = rr(0.9, 1.3);
        if (dy != null) { await flick(dy); life.target = null; life.phase = 'up'; life.upAt = t; life.shotsUp = 0; life.wantUp = 3; }
        continue;
      }
      if (!warn || !/Behind you|going round/.test(warn)) life.turnedFor = null;
      // ---- 'Move!': along the cover to the next spot (nobody in the sights)
      if (warn && /Move!/.test(warn) && !visible.length && life.movedFor !== warn && SPOTS[b] && Math.random() < k.move) {
        life.movedFor = warn;
        life.spot = (life.spot + 1) % SPOTS[b].length;
        const sp = SPOTS[b][life.spot];
        await down();
        life.moving = { ...sp, until: t + 3500 };
        continue;
      }
      if (!warn || !/Move!/.test(warn)) life.movedFor = null;
      // ---- hurt and nothing in the sights: stay down while it mends
      const urgent = warn && /Stop him|Behind/.test(warn);
      if (!open && !visible.length && !urgent && s.hp < P.mendAt + (style === 'bad' ? 10 * learnt.duck : 0)) { if (life.phase !== 'mend') { await down(); life.phase = 'mend'; } }
      if (life.phase === 'mend') { if (s.hp >= 80 || urgent || visible.length) { life.phase = 'down'; life.downUntil = t; } else { await sleep(100); continue; } }
      // ---- down: a breath, then up (RMB) - a standing player is 'up' at once
      if (life.phase === 'down') {
        if (open || !s.on || visible.some((m) => m.L < 4.5)) { life.phase = 'up'; life.upAt = t; life.shotsUp = 0; life.wantUp = k.burst[0] + Math.floor(Math.random() * (k.burst[1] - k.burst[0] + 1)); }
        else if (t >= life.downUntil) {
          await rmbOn(true); life.phase = 'up'; life.upAt = t; life.shotsUp = 0;
          life.wantUp = k.burst[0] + Math.floor(Math.random() * (k.burst[1] - k.burst[0] + 1));
        }
        await sleep(60); continue;
      }
      // ---- up: find a man, a reaction, the aim, fire; down after the burst or at his tell
      if (life.phase === 'up') {
        if (!open && s.on && !rmb) await rmbOn(true);
        const upFor = t - life.upAt;
        if (!visible.length) {
          life.target = null;
          // (the sights held on where a man was last seen - the jamb he went behind)
          const ls = good && life.lastSeen && t - life.lastSeen.t < 8000 ? life.lastSeen : null;
          if (ls && !life.held) {
            life.held = true;
            const A = angTo(ls);
            if (Math.hypot(A.dy, A.dp) < 1.3) await flick(A.dy, A.dp);
          }
          if (!open && upFor > (ls ? rr(1800, 2600) : rr(900, 1400))) { await rmbOn(false); life.phase = 'down'; life.held = false; life.downUntil = t + rr(500, 1100); }
          if (t > life.scanAt) {
            life.scanAt = t + rr(3500, 5500);
            if (SPOTS[b] && !ls) { const sp = SPOTS[b][life.spot], d = Math.atan2(Math.sin(sp.yaw - s.yaw), Math.cos(sp.yaw - s.yaw)); if (Math.abs(d) > 0.4) await flick(d + rr(-0.3, 0.3)); }
          }
          await sleep(60); continue;
        }
        life.held = false;
        // the man to shoot: the heavy, then one with his gun up, then the nearest the middle of the view
        visible.sort((a, c) => (c.kind === 'rusher') - (a.kind === 'rusher') || (c.up - a.up) || Math.hypot(angTo(a).dy, angTo(a).dp) - Math.hypot(angTo(c).dy, angTo(c).dp));
        const m = visible[0];
        if (life.target !== m.id) {
          life.target = m.id;
          const A0 = angTo(m), near = Math.hypot(A0.dy, A0.dp) < 0.12;
          life.seenAt = t + (near && good ? rr(220, 380) : rr(k.react[0], k.react[1]));
        }
        // his gun up and my round not ready: down (good) - the tell read
        if (good && !open && m.up && m.L > 4.5 && life.shotsUp >= 1 && s.on && t - life.lastShot > 250 && Math.random() < 0.5) {
          await rmbOn(false); life.phase = 'down'; life.downUntil = t + rr(P.downFor[0], P.downFor[1]); await sleep(60); continue;
        }
        if (t < life.seenAt) { await sleep(40); continue; }
        const A = angTo(m);
        const e1 = (Math.random() - 0.5) * 2 * P.err * (m.glass ? 1.4 : 1), e2 = (Math.random() - 0.5) * 2 * P.err;
        await flick(A.dy + e1, A.dp + e2, 2);
        await sleep(rr(50, 110));
        const gap = s.wpn === 'tommy' ? 0 : 330;
        if (now() - life.lastShot < gap) await sleep(gap - (now() - life.lastShot));
        if (s.wpn === 'tommy') { const [x, y] = cursor(); await mouse('mousePressed', x, y, 'left'); await sleep(rr(250, 450)); await mouse('mouseReleased', x, y, 'left'); }
        else await fire();
        R.shots++; life.lastShot = now(); life.shotsUp++;
        await sleep(rr(150, 280));
        if (!open && life.shotsUp >= life.wantUp && !visible.some((mm) => mm.L < 4.5 || mm.kind === 'rusher')) { await rmbOn(false); life.phase = 'down'; life.downUntil = now() + rr(P.downFor[0], P.downFor[1]); }
        continue;
      }
      await sleep(60);
    }
    await letGo();
    const kills = await js(`G.guns ? G.guns.events.filter((e) => e.what === 'down' || e.what === 'shot').length : 0`);
    void kills;
    if (!R.won) R.time = +((now() - T0) / 1000).toFixed(1);
    out[b] = R;
    log(`${b}: ${JSON.stringify(R)}`);
    if (wonAt) await sleep(500);
  }
  return out;
}
