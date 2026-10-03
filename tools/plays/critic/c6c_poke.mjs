// [C6 critic] The jank walk's hands: run (W held, the mouse turned onto it) at each point
// in turn, for at most `secs` each, and say where I ended and what stopped me; a frame at
// each stop. { "drive": "tools/plays/critic/c6c_poke.mjs", "points": [[x, z, "label", secs?, "key"?]] }
// A point's optional key is tapped when I stop (SPACE / KeyC / KeyE: what a player tries).
// The chase's rules are the play's business (a play may switch them off to look round).
export default async function poke({ js, turn, keyDown, keyUp, log, sleep, opts, shot }) {
  const out = [];
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ST = `(() => { const C = N.controller, R = C.run; return { x: C.pos.x, z: C.pos.z, y: C.groundY, yaw: C.yaw, pitch: C.pitch, mode: C.mode,
    blocked: R && R.blocked ? R.blocked.T.id : null, move: R && R.move ? R.move.kind : null, v: R ? R.v : Math.hypot(C.vel.x, C.vel.z),
    fail: G.failing ? 1 : 0, warn: G.hud.kit && G.hud.kit.warnText || null, beat: G.scenes.beat, scene: G.scenes.current && G.scenes.current.id }; })()`;
  for (const [x, z, label, secs = 6, key] of opts.points) {
    let st = await js(ST);
    const t0 = Date.now();
    let stuck = 0, last = [st.x, st.z], minD = 1e9;
    await keyDown('KeyW');
    while (Date.now() - t0 < secs * 1000) {
      st = await js(ST);
      if (st.scene !== 'watcher') break;
      const want = Math.atan2(-(x - st.x), -(z - st.z));
      const dy = Math.max(-0.25, Math.min(0.25, wrap(want - st.yaw)));
      const dp = Math.max(-0.1, Math.min(0.1, -0.05 - st.pitch));
      if (Math.abs(dy) > 0.01 || Math.abs(dp) > 0.03) await turn(Math.round(-dy / 0.0021), Math.abs(dp) > 0.03 ? Math.round(-dp / 0.0021) : 0);
      const d = Math.hypot(x - st.x, z - st.z);
      minD = Math.min(minD, d);
      if (d < 0.8) break;
      const moved = Math.hypot(st.x - last[0], st.z - last[1]);
      stuck = moved < 0.03 ? stuck + 1 : 0;
      last = [st.x, st.z];
      if (stuck > 25) break;
      await sleep(40);
    }
    await keyUp('KeyW');
    if (key) { await sleep(150); await keyDown(key); await sleep(60); await keyUp(key); await sleep(900); }
    await sleep(250);
    st = await js(ST);
    const rec = { label, to: [x, z], at: [+st.x.toFixed(2), +st.z.toFixed(2), +st.y.toFixed(2)], left: +Math.hypot(x - st.x, z - st.z).toFixed(1), blocked: st.blocked, move: st.move, mode: st.mode, beat: st.beat, warn: st.warn, fail: st.fail };
    out.push(rec);
    log(`poke ${label}: ${rec.left < 1 ? 'reached' : 'stopped ' + rec.left + ' m short'} at ${rec.at} ${st.blocked ? 'against ' + st.blocked : ''} beat=${st.beat}`);
    await shot('poke_' + label.replace(/[^a-z0-9]+/gi, '_'));
  }
  return out;
}
