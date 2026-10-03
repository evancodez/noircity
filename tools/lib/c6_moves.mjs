// [C6 3rd] Small scripted moves by real input, for the critic's findings that
// a whole run does not reach (tools/play.mjs drive):
//   { "drive": "tools/lib/c6_moves.mjs", "case": "<name>", "timeout": ms }
// Cases (each from the beat the play starts at, the chapter card gone):
//   fenceImpact  the lane: W into fence1, never pressed for; SPACE once as the
//                body hits it (in the stop) - the press is kept: the climb comes
//   doorBeside   the yard (?c6Lane=W): W into the kitchen's wall 0.95 m east of
//                the W door's middle (a step beside its frame); stopped, SPACE -
//                through the doorway
//   wellStand    over: the roofs to the light well, no press; stopped at the
//                parapet, SPACE - the standing leap onto R2, no catch, no haul
//   wallDoor     the alley: W into the east block's door (x 5, z -22.6); stopped,
//                E - it rattles, "Locked."
//   canGlance    the lane: along its south wall square into the dustbin at its
//                mouth - glanced off it, past it within a moment
// Returns { case, ok, moves: [kinds seen], said, ... }.
export default async function drive({ js, turn, keyDown, keyUp, log, sleep, opts }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 40000;
  const ST = `(() => { const C = N.controller, R = C.run; return { x: C.pos.x, z: C.pos.z, yaw: C.yaw, sens: C.sensitivity, feet: R ? R.feet : 0, v: R ? R.v : 0,
    move: R && R.move ? R.move.kind : null, standing: !!(R && R.move && R.move.standing), blocked: R && R.blocked ? R.blocked.T.id : null, said: G.hud.sayShown || '', beat: G.scenes.beat, fails: G.counters.fails || 0 }; })()`;
  const tap = async (code, ms = 45) => { await keyDown(code); await sleep(ms); await keyUp(code); };
  const seen = [];
  let W = false;
  const setW = async (on) => { if (on !== W) { W = on; if (on) await keyDown('KeyW'); else await keyUp('KeyW'); } };
  // steer the mouse onto (x, z)
  const steer = async (s, x, z, lag = 0.8) => {
    const want = Math.atan2(-(x - s.x), -(z - s.z));
    const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    if (Math.abs(err) > 0.02) await turn(Math.round(Math.max(-80, Math.min(80, -err * lag / s.sens))), 0);
    return err;
  };
  const note = (s) => { if (s.move && seen[seen.length - 1] !== s.move) seen.push(s.move); };
  const C = opts.case;
  const out = { case: C, ok: false, moves: seen };
  if (C === 'fenceImpact') {
    let pressed = false, tHit = null;
    while (Date.now() - T0 < timeout) {
      const s = await js(ST); note(s);
      await steer(s, 20, -50.0);
      await setW(true);
      if (!pressed && s.move === 'hit') { pressed = true; tHit = Date.now(); await tap('Space'); log('c6_moves: SPACE once, as the body hits fence1'); }
      if (s.move === 'climb') { out.ok = true; out.climbAfter = +((Date.now() - tHit) / 1000).toFixed(2); break; }
      if (pressed && Date.now() - tHit > 2500) break;
      await sleep(25);
    }
  } else if (C === 'doorBeside') {
    // to the W lane's head, then square at the wall a step east of the door
    let phase = 0, tStop = null, pressed = false;
    while (Date.now() - T0 < timeout) {
      const s = await js(ST); note(s);
      if (phase === 0) { await steer(s, 53.0, -51.2); await setW(true); if (s.x > 51.8) phase = 0.5; }
      else if (phase === 0.5) { await steer(s, 54.25 + 0.95, -70); await setW(true); if (s.z < -71) phase = 1; }
      else if (phase === 1) { await steer(s, 54.25 + 0.95, -86); await setW(true); if (s.v < 0.6 && s.z < -82) { phase = 2; tStop = Date.now(); log(`c6_moves: against the wall at ${s.x.toFixed(2)}, ${s.z.toFixed(2)} (blocked ${s.blocked})`); out.stoppedAt = [+s.x.toFixed(2), +s.z.toFixed(2)]; } }
      else if (phase === 2) {
        if (!pressed && Date.now() - tStop > 300) { pressed = true; await tap('Space'); log('c6_moves: SPACE against the wall beside the door'); }
        if (s.z < -84.6) { out.ok = true; out.through = [+s.x.toFixed(2), +s.z.toFixed(2)]; break; }
        if (pressed && Date.now() - tStop > 3500) break;
      }
      await sleep(25);
    }
    await setW(false);
  } else if (C === 'wellStand') {
    const pts = [[71.8, -105.0], [70.4, -105.2], [57.4, -105.25], [57.0, -108.0], [51.0, -110.9], [44.6, -110.9]];
    let i = 0, tStop = null, pressed = false;
    while (Date.now() - T0 < timeout) {
      const s = await js(ST); note(s);
      if (s.blocked === 'party') await tap('Space');
      const p = pts[Math.min(i, pts.length - 1)];
      if (i < pts.length - 1 && Math.hypot(p[0] - s.x, p[1] - s.z) < 1.2) i++;
      if (!s.move) await steer(s, p[0], p[1]);
      await setW(!pressed);
      if (s.blocked === 'edge' && !tStop) { tStop = Date.now(); log('c6_moves: stopped at the light well\'s parapet'); }
      if (tStop && !pressed && Date.now() - tStop > 250) { pressed = true; await tap('Space'); log('c6_moves: SPACE from standing'); }
      if (pressed && s.move === 'jump') out.standing = out.standing || s.standing;
      if (pressed && !s.move && s.feet < 6.0 && s.x < 41.2) { out.ok = !seen.includes('hang') && !seen.includes('haul'); out.landed = [+s.x.toFixed(2), +s.feet.toFixed(2)]; break; }
      if (pressed && Date.now() - tStop > 4000) break;
      await sleep(25);
    }
    await setW(false);
  } else if (C === 'wallDoor') {
    let tStop = null, pressed = false;
    while (Date.now() - T0 < timeout) {
      const s = await js(ST); note(s);
      if (!tStop) { await steer(s, 5.4, -22.6, 0.9); await setW(true); }
      if (!tStop && (s.blocked || (s.v < 0.3 && s.x > 4.2))) { tStop = Date.now(); await setW(false); log(`c6_moves: against the door (${s.blocked})`); }
      if (tStop && !pressed && Date.now() - tStop > 700) { pressed = true; await tap('KeyE'); log('c6_moves: E against the door'); }
      if (s.said) { out.said = s.said; out.ok = /Locked/.test(s.said); break; }
      if (pressed && Date.now() - tStop > 3000) break;
      await sleep(25);
    }
    await setW(false);
  } else if (C === 'canGlance') {
    // the lane (start=watcher.lane): to its south wall, then east along it
    // square into the dustbin at its mouth (9, -52) - glanced off, on past
    let phase = 0, tAt = null;
    while (Date.now() - T0 < timeout) {
      const s = await js(ST); note(s);
      if (phase === 0) { await steer(s, 6.2, -52.0); await setW(true); if (s.x > 5.6 && s.z < -51.6) phase = 1; }
      else {
        await steer(s, 20.0, -52.0, 0.9); await setW(true);
        if (!tAt && s.x > 7.6) { tAt = Date.now(); log(`c6_moves: at the can, ${s.x.toFixed(2)}, ${s.z.toFixed(2)}, v ${s.v.toFixed(1)}`); }
        if (s.x > 10.0) { out.ok = true; out.past = [+s.x.toFixed(2), +s.z.toFixed(2)]; out.secs = +((Date.now() - tAt) / 1000).toFixed(2); out.v = +s.v.toFixed(1); break; }
        if (tAt && Date.now() - tAt > 3000) { out.stuckAt = [+s.x.toFixed(2), +s.z.toFixed(2)]; out.v = +s.v.toFixed(1); break; }
      }
      await sleep(25);
    }
  }
  await setW(false);
  log(`c6_moves ${C}: ${JSON.stringify(out)}`);
  return out;
}
