// Lane C3's critic (2026-10-02): the critic's own player for chapter VI, NOT the owner's bot.
// It drives a frozen-clock session of tools/stepplay.mjs (start that with
//   NOIR_PORT=5343 node tools/stepplay.mjs --url "/?mute=1&start=tail" --dir <dir> --size 1440x900 --status tools/plays/critic/c3c_status.js
// then: node tools/plays/critic/c3c_drive.mjs <dir> good|bad|idle|w aim|sloppy|tap|rmbspam|none [maxSec] [shotEvery] [stop: b|c|end]).
// Eyes: only his positions while he is in sight (chase.seen) make the trail it follows; it brakes for the bends
// of that trail; the gun aims by moving the mouse onto a tyre quarter (proj: his car projected on the screen).
// 'tap' = LMB alone once every 1.4 s, never aimed: the no-aim win of the critic's report.
// The critic's own player for chapter VI, through a stepplay session (cmd.json / res.json).
// node driver2.mjs <dir> <drive: good|bad|idle|w|none> <gun: aim|sloppy|tap|none> [maxSec] [shotEvery] [stopWhen: a|b|c|end]
// drive: pure pursuit on his trail (what I saw of him), brakes for the bends ahead, reverses out when stuck.
// gun (phase b): aim = RMB held when he is near, the mouse eased onto a tyre quarter with a human's lag and
// shake, LMB when the mark sits on it; sloppy = slower, shakier, fires early; tap = LMB alone every 1.4 s
// (no RMB, the mouse never moves); none = never shoots.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const [DIR, DRIVE = 'good', GUN = 'aim', MAXS = '200', SHOTE = '3', STOP = 'end'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastN = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')).n || 0;
async function cmd(moves) {
  writeFileSync(`${DIR}/cmd.json.tmp`, JSON.stringify(moves)); renameSync(`${DIR}/cmd.json.tmp`, `${DIR}/cmd.json`);
  for (;;) {
    await sleep(12);
    let r; try { r = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')); } catch { continue; }
    if ((r.n || 0) !== lastN) { lastN = r.n; return r; }
  }
}
const PROJ = readFileSync(new URL('./c3c_proj.js', import.meta.url), 'utf8');
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
let rng = +(process.env.SEED || 777); const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / Math.sqrt(0.5); };
const TICK = 4, DT = TICK / 60;
let trail = [], stuckT = 0, revT = 0, revSteer = null, shotN = 0, lastShotT = -99, wrongT = 0, wrongKey = null;
let rmb = false, onT = 0, lastFire = -9, tapT = 0, side = rand() < 0.5 ? 'rearL' : 'rearR', lmbHeld = 0;
const events = [], log = [];
let r0 = await cmd([{ status: true }]);
let st = r0.out.find((o) => o.status).status, pj = null;
const t0 = st.t;
let prevPhase = st.phase, prevFails = st.fails, prevWarn = null, prevHits = 0, prevTeach = '';
while (st.t - t0 < +MAXS) {
  if (st.scene !== 'tail') { events.push(`${st.t.toFixed(1)} scene ${st.scene}`); break; }
  if (STOP === 'b' && st.phase === 'b') break;
  if (STOP === 'c' && (st.phase === 'c' || st.phase === 'wreck')) break;
  if (st.fails !== prevFails) { events.push(`${st.t.toFixed(1)} FAIL ${st.fails.split('|').pop()} at my ${st.my} his ${st.his} phase ${prevPhase} dmg ${st.dmg} gun ${JSON.stringify(st.gun)} hisDmg ${JSON.stringify(st.hisDmg)}`); prevFails = st.fails; trail = []; revT = 0; stuckT = 0; wrongT = 0; }
  if (st.phase !== prevPhase) { events.push(`${st.t.toFixed(1)} phase ${prevPhase} -> ${st.phase} gap ${st.gap} dmg ${st.dmg} gun ${JSON.stringify(st.gun)} hisDmg ${JSON.stringify(st.hisDmg)}`); prevPhase = st.phase; }
  if ((st.warn || null) !== prevWarn) { events.push(`${st.t.toFixed(1)} warn ${st.warn} gap ${st.gap} unseen ${st.unseen}`); prevWarn = st.warn || null; }
  if (st.teach && st.teach !== prevTeach) { events.push(`${st.t.toFixed(1)} teach "${st.teach}"`); }
  prevTeach = st.teach;
  if (st.gun && st.gun.h !== prevHits) { events.push(`${st.t.toFixed(1)} HIT ${JSON.stringify(st.hisDmg)} shots ${st.gun.s} gap ${st.gap}`); prevHits = st.gun.h; }
  let k = [];
  const moves = [];
  const live = st.my && !st.failing && st.phase !== 'start' && st.phase !== 'parked';
  if (live && DRIVE !== 'idle' && DRIVE !== 'none') {
    const [x, z, yaw] = st.my; const v = st.kmh;
    if (st.seen) { const [hx, hz] = st.his; const L = trail[trail.length - 1]; if (!L || Math.hypot(L[0] - hx, L[1] - hz) > 1.5) trail.push([hx, hz]); }
    while (trail.length > 1 && Math.hypot(trail[0][0] - x, trail[0][1] - z) < 7) trail.shift();
    if (DRIVE === 'w') k = ['KeyW'];
    else if (trail.length && (st.phase === 'a' || st.phase === 'b' || st.phase === 'crash')) {
      const look = 11;
      let tgt = trail[trail.length - 1], acc = Math.hypot(trail[0][0] - x, trail[0][1] - z);
      for (let i = 0; i < trail.length; i++) { if (i) acc += Math.hypot(trail[i][0] - trail[i - 1][0], trail[i][1] - trail[i - 1][1]); if (acc >= look) { tgt = trail[i]; break; } }
      const want = Math.atan2(-(tgt[1] - z), tgt[0] - x);
      const err = wrap(want - yaw);
      let bend = 0, d = 0, h0 = null;
      for (let i = 1; i < trail.length && d < 28; i++) { const dx = trail[i][0] - trail[i - 1][0], dz = trail[i][1] - trail[i - 1][1]; d += Math.hypot(dx, dz); const h = Math.atan2(-dz, dx); if (h0 == null) h0 = h; bend = Math.max(bend, Math.abs(wrap(h - h0))); }
      bend = Math.max(bend, Math.abs(err));
      const corner = DRIVE === 'bad' ? (bend > 1.2 ? 32 : bend > 0.6 ? 42 : 62) : (bend > 1.2 ? 24 : bend > 0.6 ? 34 : 58);
      let vt = corner;
      if (st.gap < 9 && st.seen) vt = Math.min(vt, st.hkmh * 0.9);
      if (st.phase === 'b' && st.gap < 16 && st.seen) vt = Math.min(vt, st.hkmh);
      if (st.phase === 'crash') vt = 0;
      if (v < vt - 3) k.push('KeyW'); else if (v > vt + (DRIVE === 'bad' ? 10 : 6)) k.push('KeyS');
      if (err > 0.06) k.push('KeyA'); else if (err < -0.06) k.push('KeyD');
      if (DRIVE === 'good' && Math.abs(err) > 1.0 && v > 22) k.push('Space');
      if (v < 3 && k.includes('KeyW')) stuckT += DT; else if (v > 6) stuckT = 0;
      if (stuckT > 1.0 && revT <= 0) { revT = 1.6; revSteer = err > 0 ? 'KeyD' : 'KeyA'; stuckT = 0; events.push(`${st.t.toFixed(1)} stuck at ${st.my}, reversing`); }
      if (revT > 0) { revT -= DT; k = ['KeyS', revSteer]; }
      if (DRIVE === 'bad') {
        if (wrongT > 0) { wrongT -= DT; k = k.filter((c) => c !== 'KeyA' && c !== 'KeyD'); k.push(wrongKey); }
        else if (rand() < 0.003) { wrongT = 0.25 + rand() * 0.25; wrongKey = rand() < 0.5 ? 'KeyA' : 'KeyD'; }
      }
    } else if (st.phase === 'a' || st.phase === 'b') k = st.kmh < 25 ? ['KeyW'] : [];
    if (st.phase === 'c' || st.phase === 'wreck') {
      // the drive to the pier: down the river road to the yard, stop by the gate, E
      const WP = [[120, -100], [124.6, -43], [119, 5], [123, 36], [127.5, 73], [132.6, 100], [135.5, 120], [136, 141], [135, 155], [133, 166], [133, 174]];
      const PARK = [133, 176];
      let i = WP.findIndex((w) => w[1] > z + 9);
      let tgt = i < 0 ? PARK : WP[i];
      // (round his wreck on its west side when it is ahead of me)
      const [hx, hz] = st.his;
      if (hz > z - 2 && hz < z + 25 && Math.abs(hx - x) < 6) tgt = [hx - 6, hz + 7];
      const dP = Math.hypot(PARK[0] - x, PARK[1] - z);
      const want = Math.atan2(-(tgt[1] - z), tgt[0] - x);
      const err = wrap(want - yaw);
      const vt = st.phase === 'wreck' ? 0 : dP < 6 ? 0 : dP < 25 ? 14 : 45;
      k = [];
      if (v < vt - 3) k.push('KeyW'); else if (v > vt + 4) k.push('KeyS');
      if (Math.abs(v) > 2) { if (err > 0.06) k.push('KeyA'); else if (err < -0.06) k.push('KeyD'); }
      if (v < 3 && k.includes('KeyW')) stuckT += DT; else if (v > 6) stuckT = 0;
      if (stuckT > 1.0 && revT <= 0) { revT = 1.0; revSteer = err > 0 ? 'KeyD' : 'KeyA'; stuckT = 0; events.push(`${st.t.toFixed(1)} stuck (c) at ${st.my}, reversing`); }
      if (revT > 0) { revT -= DT; k = ['KeyS', revSteer]; }
      if (st.prompt && /get out/i.test(st.prompt) && Math.abs(v) < 2) { moves.push({ tap: 'KeyE' }); events.push(`${st.t.toFixed(1)} E at ${st.my} (prompt "${st.prompt}")`); }
    }
  }
  // the gun, phase b only
  if (live && st.phase === 'b' && GUN !== 'none') {
    if (GUN === 'rmbspam') {
      // RMB held once he is near, LMB every 0.5 s, the mouse never moves
      if (st.gap < 38 && !rmb) { rmb = true; moves.push({ btn: 'right', down: true }); }
      tapT -= DT;
      if (rmb && tapT <= 0) { tapT = 0.5; moves.push({ btn: 'left', down: true }); lmbHeld = 2; }
    } else if (GUN === 'tap') {
      tapT -= DT;
      if (tapT <= 0 && st.gap < 45) { tapT = 1.4; moves.push({ btn: 'left', down: true }); lmbHeld = 2; }
    } else if (pj && pj.mid && pj.mid[2]) {
      const sloppy = GUN === 'sloppy';
      const near = st.gap < (sloppy ? 30 : 38);
      if (near && !rmb) { rmb = true; moves.push({ btn: 'right', down: true }); onT = 0; }
      if (!near && rmb && st.gap > 50) { rmb = false; moves.push({ btn: 'right', down: false }); }
      if (rmb && st.gun && st.gun.aim > 0.9) {
        const tp = pj[side];
        const ex = tp[0] - pj.W / 2, ey = tp[1] - pj.H / 2;
        const gain = sloppy ? 0.22 : 0.4, shake = sloppy ? 7 : 3;
        const mx = Math.max(-60, Math.min(60, Math.round(ex * gain / 1.5 + gauss() * shake))), my = Math.max(-40, Math.min(40, Math.round(ey * gain / 1.5 + gauss() * shake * 0.6)));
        if (mx || my) moves.push({ look: [mx, my] });
        const tol = sloppy ? 26 : 9;
        if (Math.abs(ex) < tol && Math.abs(ey) < tol) onT += DT; else onT = 0;
        const reactT = sloppy ? 0.1 : 0.18;
        if (onT >= reactT && st.t - lastFire > (sloppy ? 0.45 : 0.6) && st.gun.r > 0) { lastFire = st.t; moves.push({ btn: 'left', down: true }); lmbHeld = 2; onT = 0; if (rand() < 0.5) side = side === 'rearL' ? 'rearR' : 'rearL'; }
        if (st.gun.r === 0 && st.gun.p > 0) { /* the gun reloads itself on an empty cylinder */ }
      }
    }
  } else if (rmb && st.phase !== 'b') { rmb = false; moves.push({ btn: 'right', down: false }); }
  moves.unshift({ k, f: TICK });
  if (lmbHeld > 0) { lmbHeld--; if (lmbHeld === 0) moves.push({ btn: 'left', down: false }); }
  if (st.t - lastShotT >= +SHOTE) { lastShotT = st.t; moves.push({ shot: `d${String(shotN++).padStart(3, '0')}` }); }
  if (st.phase === 'b') moves.push({ eval: PROJ });
  const r = await cmd(moves);
  const s = r.out.find((o) => o.status);
  if (s) st = s.status;
  const e = r.out.find((o) => o.eval);
  pj = e ? e.v : null;
  if (r.err) events.push(`ERR ${r.err}`);
  log.push([st.t, st.phase, st.my, st.kmh, st.his, st.gap, st.seen ? 1 : 0, st.dmg, k.join('+')]);
}
await cmd([{ k: [], f: 1 }, ...(rmb ? [{ btn: 'right', down: false }] : [])]);
writeFileSync(`${DIR}/drive2_${DRIVE}_${GUN}.json`, JSON.stringify({ events, log }, null, 0));
console.log(events.join('\n'));
console.log('end', JSON.stringify(st));
