// C2b critic: a player's hands in a gunfight by real input, with the
// bodies and the men's turns watched. Ops (opts.seq):
//   everything of ../c2/seq.mjs (k, d, u, w, s, l, c, md, mu, st, e, watch, aim, go, face, pitch)
//   "kill ms [err]"   down behind cover (C held as crouch), rise (RMB) when a
//                     man is seen, aim at his chest at a hand's error, fire;
//                     until one more man is down or ms runs out
//   "standkill ms [err]" the same standing in the open (no crouch)
//   "over i [ms]"     walk (W held, mouse turns) to corpse i and 1.6 m past it
//                     on the same line; logs the speed through it and the eye's step
//   "bodies"          log the corpses and the living men
//   "trace ms"        log each living man every 100 ms: pos, speed, state, yaw (for the body crossings)
import seq from '../c2/seq.mjs';
export default async function (A) {
  const { js, turn, keyDown, keyUp, mouse, shot, log, sleep, opts, cursor } = A;
  const out = [];
  let rest = [];
  const flush = async () => { if (rest.length) { await seq({ ...A, opts: { ...opts, seq: rest } }); rest = []; } };
  const MEN = `(() => { const K = G.guns, e = G.eye, V = N.THREE.Vector3; const r = [];
    for (const [h, a] of G.ais) { if (!h.alive) continue; const c = new V().setFromMatrixPosition(h.bones.chest.matrixWorld);
      r.push({ id: h.slot, x: c.x, y: c.y, z: c.z, see: !!(K && K.see(e, c, 0.3)), st: a.brain && a.brain.S && a.brain.S.state }); }
    return { men: r, e: [e.x, e.y, e.z], yaw: N.controller.yaw, pitch: N.controller.pitch, sens: N.controller.sensitivity, ammo: G.player.weapons.active ? G.player.weapons.active.ammo : 0, hp: Math.round(G.health.hp), beat: G.scenes.beat, failing: !!G.failing }; })()`;
  const aimAt = async (m, err) => {
    for (let i = 0; i < 3; i++) {
      const s = await js(`({ e: [G.eye.x, G.eye.y, G.eye.z], yaw: N.controller.yaw, pitch: N.controller.pitch, sens: N.controller.sensitivity })`);
      const yw = Math.atan2(-(m.x - s.e[0]), -(m.z - s.e[2])), pt = Math.atan2(m.y - s.e[1], Math.hypot(m.x - s.e[0], m.z - s.e[2]));
      const dy = Math.atan2(Math.sin(yw - s.yaw), Math.cos(yw - s.yaw)) + (Math.random() - 0.5) * 2 * err, dp = pt - s.pitch + (Math.random() - 0.5) * 2 * err;
      if (Math.abs(dy) < 0.01 && Math.abs(dp) < 0.01) break;
      const px = Math.round(-dy / s.sens), py = Math.round(-dp / s.sens), n = Math.max(2, Math.ceil(Math.hypot(px, py) / 50));
      for (let j = 0; j < n; j++) { await turn(Math.round(px / n), Math.round(py / n)); await sleep(16); }
      await sleep(60);
    }
  };
  const kill = async (ms, err, crouch, react = 350) => {
    const T = Date.now() + ms;
    const n0 = (await js(MEN)).men.length;
    const [cx, cy] = cursor();
    if (crouch) { await keyDown('KeyC'); await sleep(50); await keyUp('KeyC'); }
    let up = false;
    while (Date.now() < T) {
      const s = await js(MEN);
      if (s.failing || s.men.length < n0 || !s.men.length) break;
      if (s.ammo === 0) { if (up) { await mouse('mouseReleased', cx, cy, 'right'); up = false; } await keyDown('KeyR'); await sleep(50); await keyUp('KeyR'); await sleep(1800); continue; }
      let m = s.men.filter((q) => q.see).sort((a, b) => Math.hypot(a.x - s.e[0], a.z - s.e[2]) - Math.hypot(b.x - s.e[0], b.z - s.e[2]))[0];
      if (!m && crouch && !up) {
        // look over the cover for him
        const any = s.men[0];
        await mouse('mousePressed', cx, cy, 'right'); up = true; await sleep(450);
        const s2 = await js(MEN); m = s2.men.filter((q) => q.see)[0];
        if (!m) { await aimAt(any, 0.05); await sleep(300); await mouse('mouseReleased', cx, cy, 'right'); up = false; await sleep(700); continue; }
      }
      if (!m) { await aimAt(s.men[0], 0.05); await sleep(300); continue; }
      if (crouch && !up) { await mouse('mousePressed', cx, cy, 'right'); up = true; await sleep(300); }
      await sleep(react + Math.random() * react * 0.7);   // a hand's reaction
      await aimAt(m, err);
      await mouse('mousePressed', cx, cy, 'left'); await sleep(40); await mouse('mouseReleased', cx, cy, 'left');
      await sleep(react);
      if (crouch && Math.random() < 0.5) { await mouse('mouseReleased', cx, cy, 'right'); up = false; await sleep(600); }
    }
    if (up) await mouse('mouseReleased', cx, cy, 'right');
    const s = await js(MEN);
    log(`kill -> men ${n0} -> ${s.men.length}, hp ${s.hp}, beat ${s.beat}, failing ${s.failing}`);
  };
  const over = async (i, ms) => {
    const c = await js(`(() => { const c = G.guns.corpses[${i}]; return c ? [c.x, c.z] : null; })()`);
    if (!c) { log(`over ${i}: no such corpse`); return; }
    const p0 = await js(`[N.controller.pos.x, N.controller.pos.z]`);
    const dx = c[0] - p0[0], dz = c[1] - p0[1], L = Math.hypot(dx, dz) || 1;
    const tgt = [c[0] + dx / L * 1.6, c[1] + dz / L * 1.6];
    await js(`(window.__OV = [], window.__OVF = () => window.__OV.push([G.time, N.controller.pos.x, N.controller.pos.z, G.eye.y, N.controller._overBody || 0]), G.scripts.push(window.__OVF), 1)`);
    const T = Date.now() + (ms || 8000); let w = false, last = null, still = 0;
    for (;;) {
      const s = await js(`({ x: N.controller.pos.x, z: N.controller.pos.z, yaw: N.controller.yaw, sens: N.controller.sensitivity })`);
      const ex = tgt[0] - s.x, ez = tgt[1] - s.z, d = Math.hypot(ex, ez);
      if (d < 0.3) break;
      if (last && Math.hypot(s.x - last[0], s.z - last[1]) < 0.01) still++; else still = 0;
      last = [s.x, s.z];
      if (Date.now() > T || still > 30) { log(`over STOPPED at ${s.x.toFixed(2)},${s.z.toFixed(2)} (${d.toFixed(2)} m short)`); break; }
      const want = Math.atan2(-ex, -ez), err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
      if (Math.abs(err) > 0.03) await turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0);
      const on = Math.abs(err) < 0.6; if (on !== w) { w = on; await (on ? keyDown('KeyW') : keyUp('KeyW')); }
      await sleep(33);
    }
    if (w) await keyUp('KeyW');
    const R = await js(`(() => { G.scripts.splice(G.scripts.indexOf(window.__OVF), 1); const T = window.__OV; const c = [${c[0]}, ${c[1]}];
      let near = 9, vmin = 99, vmax = 0; const ys = T.map((r) => r[3]);
      for (let i = 1; i < T.length; i++) { const d = Math.hypot(T[i][1] - c[0], T[i][2] - c[1]); near = Math.min(near, d);
        if (d < 1.0) { let j = i; while (j > 0 && T[i][0] - T[j][0] < 0.2) j--; if (T[i][0] - T[j][0] > 0.15) { const v = Math.hypot(T[i][1] - T[j][1], T[i][2] - T[j][2]) / (T[i][0] - T[j][0]); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); } } }
      return { near: +near.toFixed(2), vmin: +vmin.toFixed(2), vmax: +vmax.toFixed(2), eyeStep: +(Math.max(...ys) - Math.min(...ys)).toFixed(3), ob: +Math.max(...T.map((r) => r[4])).toFixed(2), n: T.length }; })()`);
    log(`over ${i} at ${c.map((q) => q.toFixed(2))}: ${JSON.stringify(R)}`);
    out.push(R);
  };
  for (const line of opts.seq) {
    const [op, a, b, c3] = line.split(/\s+/);
    if (op === 'kill' || op === 'standkill') { await flush(); await kill(+a, +(b || 0.02), op === 'kill', +(c3 || 350)); }
    else if (op === 'over') { await flush(); await over(+a, +(b || 8000)); }
    else if (op === 'bodies') { await flush(); log('bodies ' + JSON.stringify(await js(`({ corpses: G.guns.corpses.map((c) => [+c.x.toFixed(2), +c.z.toFixed(2)]), men: [...G.ais.keys()].filter((h) => h.alive).map((h) => [h.slot, +h.pos.x.toFixed(2), +h.pos.z.toFixed(2), G.ais.get(h).brain.S.state]), spin: G.guns.spin && { sec: Math.round(G.guns.spin.sec * 57.3), rev: Math.round(G.guns.spin.rev * 57.3), turn: Math.round(G.guns.spin.turn * 57.3) } })`))); }
    else if (op === 'trace') {
      await flush();
      const T = Date.now() + +a;
      while (Date.now() < T) {
        log('tr ' + JSON.stringify(await js(`[...G.ais.keys()].filter((h) => h.alive).map((h) => [h.slot, +h.pos.x.toFixed(2), +h.pos.z.toFixed(2), +h.speed.toFixed(2), G.ais.get(h).brain.S.state, +h.yaw.toFixed(2)])`)));
        await sleep(100);
      }
    } else rest.push(line);
  }
  await flush();
  return out;
}
