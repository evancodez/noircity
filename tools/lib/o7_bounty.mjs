// [O7] after the critic (B2): the wanted man by real input (tools/play.mjs drive).
//   { "drive": "tools/lib/o7_bounty.mjs", "profile": "idle" | "bad" | "medium" | "good", "tries": 3, "wins": 1, "timeout": ms }
// Each try: put 9 m from the first man on the board ('b0') on his corner, looking at him (a tool's
// teleport: the walk there is not the contest), then hands at the profile's pace: idle does nothing
// (he notices me watching him and comes); the others walk at him (W) and fight O4's crowd brawl with
// O4's brawl bot (tools/lib/o4_brawl.mjs); when he runs (beaten once, he gets up and runs) they run
// him down (W and Shift held, turned onto him, LMB at arm's length); beaten: E takes him in. A fall
// (the hospital) is a try lost; the next try begins at his corner again.
// Returns { tries: [{ result: 'taken' | 'down' | 'away', secs, why }], wins, losses, taken }.
import brawl from './o4_brawl.mjs';

export default async function drive(ctx) {
  const { js, turn, keyDown, keyUp, mouse, log, sleep, W, H, opts } = ctx;
  const prof = opts.profile || 'medium';
  const maxTries = opts.tries ?? 3, wantWins = opts.wins ?? 1;
  const T0 = Date.now(), timeout = opts.timeout ?? 400000;
  const out = { profile: prof, tries: [], wins: 0, losses: 0, taken: 0 };
  const tap = async (code) => { await keyDown(code); await sleep(50); await keyUp(code); };
  const st = () => js(`(() => { const B = G.night.bounty, b = B.names()[0], M = B.men.get('b0'), e = G.eye, C = N.controller;
    const p = M ? M.pos : null; const d = p ? Math.hypot(p.x - e.x, p.z - e.z) : null;
    const rel = p ? Math.atan2(Math.sin(Math.atan2(-(p.x - e.x), -(p.z - e.z)) - C.yaw), Math.cos(Math.atan2(-(p.x - e.x), -(p.z - e.z)) - C.yaw)) : 0;
    return { state: b.state, mode: M ? M.mode : null, d, rel, sens: C.sensitivity, failing: !!G.failing, why: G.failing ? G.failing.why : null, beat: G.scenes.beat, fade: G.scenes.fadeK, act: G.crowd.active, prompt: G.hud.promptShown || '', money: G.save.money }; })()`);
  const put = () => js(`(() => { const b = G.night.bounty.names()[0]; G.stage.part('stream').warmAround(b.x, b.z); const g = G.night.graph(); let px = b.x + 9, pz = b.z;
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, q = new N.THREE.Vector3(b.x + Math.cos(a) * 9, 0, b.z + Math.sin(a) * 9); const q0 = q.clone(); G.stage.colliders.resolve(q, 0.4); if (q.distanceTo(q0) < 0.05 && g.lineOfSight(q.x, q.z, b.x, b.z) && !G.stage.part('city').C.inWater(q.x, q.z)) { px = q.x; pz = q.z; break; } }
    N.controller.setPose(px, pz, Math.atan2(-(b.x - px), -(b.z - pz)), -0.02); G.stage.part('bounds').navAround(px, pz, 24); return [b.name, Math.round(px), Math.round(pz)]; })()`);
  const face = async (rel, sens) => { const steps = Math.min(6, Math.max(1, Math.ceil(Math.abs(rel) / 0.25))); const px = Math.round(-rel / sens / steps); for (let i = 0; i < steps; i++) { await turn(px, 0); await sleep(16); } };
  while (out.wins < wantWins && out.losses < maxTries && Date.now() - T0 < timeout) {
    // a try: by his corner
    let s = await st();
    while ((s.failing || s.fade > 0.05) && Date.now() - T0 < timeout) { await sleep(300); s = await st(); }
    if (s.state !== 'out') { log('o7_bounty: he is ' + s.state); break; }
    log('o7_bounty: try ' + (out.tries.length + 1) + ' at ' + JSON.stringify(await put()));
    const t0 = Date.now();
    await sleep(600);
    s = await st();
    if (prof !== 'idle') {
      // walk at him until he comes or the fight starts
      await keyDown('KeyW');
      for (let i = 0; i < 80 && !s.act && !s.failing; i++) { if (s.rel && Math.abs(s.rel) > 0.12) await face(s.rel, s.sens); if (s.d != null && s.d < 3.0) break; await sleep(100); s = await st(); }
      await keyUp('KeyW');
    }
    // the fight: O4's bot plays it at the profile's pace (idle: nothing)
    for (let i = 0; i < 125 && !s.act && !s.failing; i++) { await sleep(200); s = await st(); }
    if (!s.act && !s.failing) { out.tries.push({ result: 'none:' + s.mode, secs: +((Date.now() - t0) / 1000).toFixed(1), why: 'no fight began' }); log('o7_bounty: no fight began (' + s.mode + ', ' + (s.d && s.d.toFixed(1)) + ' m)'); break; }
    const B = await brawl({ ...ctx, opts: { profile: prof, beat: s.beat, tries: 1, wins: 1, timeout: Math.max(30000, timeout - (Date.now() - T0)) } });
    s = await st();
    let result = null, why = null;
    if (B.tries.length && B.tries[B.tries.length - 1].result === 'down') { result = 'down'; why = B.tries[B.tries.length - 1].why; }
    // he runs: run him down
    if (!result && s.mode === 'run') {
      await keyDown('KeyW'); await keyDown('ShiftLeft');
      const tr = Date.now();
      while (Date.now() - tr < 18000) {
        s = await st();
        if (s.mode !== 'run') break;
        if (Math.abs(s.rel) > 0.08) await face(s.rel, s.sens);
        if (s.d != null && s.d < 1.7) { const [x, y] = [W / 2, H / 2]; await mouse('mousePressed', x, y, 'left'); await sleep(60); await mouse('mouseReleased', x, y, 'left'); }
        await sleep(60);
      }
      await keyUp('ShiftLeft'); await keyUp('KeyW');
      s = await st();
    }
    if (!result && s.mode === 'beaten') {
      for (let i = 0; i < 30 && s.prompt !== 'E  take him in'; i++) { if (Math.abs(s.rel) > 0.2) await face(s.rel, s.sens); await keyDown('KeyW'); await sleep(120); await keyUp('KeyW'); s = await st(); }
      if (s.prompt === 'E  take him in') { await tap('KeyE'); await sleep(500); s = await st(); }
      if (s.state === 'taken') result = 'taken';
    }
    if (!result) result = s.state === 'dead' ? 'dead' : s.failing ? 'down' : s.mode === 'gone' ? 'away' : 'none:' + s.mode;
    const secs = +((Date.now() - t0) / 1000).toFixed(1);
    out.tries.push({ result, secs, why });
    log(`o7_bounty: try ${out.tries.length}: ${result}${why ? ' (' + why + ')' : ''} after ${secs} s`);
    if (result === 'taken') { out.wins++; out.taken++; }
    else if (result === 'down') out.losses++;
    else if (result === 'away') { out.losses++; await sleep(500); }
    else break;
    // (a man taken in: the next try is a new night's man - the tool puts b0 out again for a second win)
    if (result === 'taken' && out.wins < wantWins) await js(`(() => { const B = G.night.bounty; const b = B.names()[0]; B.drop(B.men.get('b0')); B.men.delete('b0'); b.state = 'out'; b.awayT = null; return 1; })()`);
    if (result === 'away') await js(`(() => { const b = G.night.bounty.names()[0]; b.awayT = null; return 1; })()`);
  }
  return out;
}
