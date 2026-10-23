// [O5 critic] poke at everything in a place by real input (a play's module driver):
//   { "drive": "tools/plays/critic/o5/poke.mjs", "site": "theatre1", "only": "uses|seats|doors|all", "shots": true }
// For each thing that looks usable in the room (its kit's uses, seats and
// doors), on the floor I am on: walk to 1.2 m short of it by W and the mouse
// (no teleport: a thing I cannot walk to is reported as such), turn the view
// onto it, read the prompt, E, read what answered (a message, the money, a
// seat taken, a door's angle), E again if it sat me down. Returns the list.
export default async function poke(api) {
  const { js, turn, keyDown, keyUp, sleep, shot, opts } = api;
  const id = JSON.stringify(opts.site);
  await js(`(() => { if (window.__pk) return 1; const R = window.__pk = { msgs: [] };
    const m0 = G.hud.message.bind(G.hud); G.hud.message = (t, s) => { R.msgs.push(t); return m0(t, s); }; return 1; })()`);
  const items = await js(`(() => { const s = G.city.places.byId.get(${id}), K = s.live.K, F = s.frame, out = [];
    const lv = G.city.places.level ?? 0;
    const at = (a) => { const p = F.v(a[0], a[1], a[2]); return [p.x, p.y, p.z]; };
    if (${JSON.stringify(opts.only || 'all')} !== 'doors') {
      K.uses.forEach((u, i) => { if (u.at && !u.atFn && (u.lvl ?? 0) === lv) out.push({ k: 'use', i, at: at(u.at) }); });
      K.seats.forEach((u, i) => { if (u.at && (u.lvl ?? 0) === lv) out.push({ k: 'seat', i, name: u.name, at: at(u.at) }); });
    }
    if (${JSON.stringify(opts.only || 'all')} !== 'uses') K.doors.forEach((d, i) => { if ((d.lvl ?? 0) === lv && d.centre) out.push({ k: 'door', i, name: d.name, at: [d.centre.x, 1.2 + (d.centre.y || 0), d.centre.z] }); });
    return out; })()`);
  const res = [];
  const look = async (ax, ay, az) => {
    for (let k = 0; k < 12; k++) {
      const s = await js(`({ yaw: N.controller.yaw, pitch: N.controller.pitch, sens: N.controller.sensitivity, ex: G.eye.x, ey: G.eye.y, ez: G.eye.z })`);
      const dx = ax - s.ex, dy = ay - s.ey, dz = az - s.ez;
      const want = Math.atan2(-dx, -dz), wp = Math.atan2(dy, Math.hypot(dx, dz));
      const e1 = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)), e2 = wp - s.pitch;
      if (Math.abs(e1) < 0.02 && Math.abs(e2) < 0.02) break;
      await turn(Math.round(Math.max(-60, Math.min(60, -e1 * 0.8 / s.sens))), Math.round(Math.max(-60, Math.min(60, -e2 * 0.8 / s.sens))));
      await sleep(30);
    }
  };
  const walkTo = async (x, z, ms = 12000) => {
    const T = Date.now() + ms; let w = false, last = null, still = 0;
    for (;;) {
      const s = await js(`({ x: N.controller.pos.x, z: N.controller.pos.z, yaw: N.controller.yaw, sens: N.controller.sensitivity })`);
      const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
      if (d < 0.35) break;
      if (last && Math.hypot(s.x - last[0], s.z - last[1]) < 0.01 && w) still++; else still = 0;
      last = [s.x, s.z];
      if (Date.now() > T || still > 25) { if (w) await keyUp('KeyW'); return { stuck: true, d: +d.toFixed(2) }; }
      const want = Math.atan2(-dx, -dz), err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
      if (Math.abs(err) > 0.03) await turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0);
      const on = Math.abs(err) < 0.6; if (on !== w) { w = on; await (on ? keyDown('KeyW') : keyUp('KeyW')); }
      await sleep(33);
    }
    if (w) await keyUp('KeyW');
    return { stuck: false };
  };
  for (const it of items) {
    const me = await js('[N.controller.pos.x, N.controller.pos.z]');
    const [ax, ay, az] = it.at;
    const dx = me[0] - ax, dz = me[1] - az, L = Math.hypot(dx, dz) || 1;
    const sx = ax + dx / L * 1.2, sz = az + dz / L * 1.2;
    const w = await walkTo(sx, sz);
    await look(ax, ay, az);
    await sleep(350);
    const before = await js(`({ p: G.hud.promptShown || '', m: G.save.money || 0, n: window.__pk.msgs.length, seat: !!G.city.places.seat, a: (() => { const s = G.city.places.byId.get(${id}); const d = ${it.k === 'door' ? `s.live.K.doors[${it.i}]` : 'null'}; return d ? +(d.open01 ?? 0).toFixed(2) : null; })() })`);
    await keyDown('KeyE'); await sleep(70); await keyUp('KeyE');
    await sleep(1100);
    const after = await js(`({ p: G.hud.promptShown || '', m: G.save.money || 0, msgs: window.__pk.msgs.slice(${before.n}), seat: !!G.city.places.seat, st: G.state, a: (() => { const s = G.city.places.byId.get(${id}); const d = ${it.k === 'door' ? `s.live.K.doors[${it.i}]` : 'null'}; return d ? +(d.open01 ?? 0).toFixed(2) : null; })(), locked: ${it.k === 'door' ? `!!G.city.places.byId.get(${id}).live.K.doors[${it.i}].locked` : 'null'} })`);
    if (opts.shots) await shot(`${opts.site}_${it.k}${it.i}`);
    const r = { k: it.k, i: it.i, name: it.name, walk: w.stuck ? `stuck ${w.d} m short` : 'ok', prompt: before.p, money: after.m - before.m, msgs: after.msgs, seated: after.seat };
    if (it.k === 'door') r.door = `${before.a}->${after.a}${after.locked ? ' locked' : ''}`;
    if (after.st !== 'playing') r.state = after.st;
    res.push(r);
    if (after.seat) { await sleep(opts.sitMs || 600); await keyDown('KeyE'); await sleep(70); await keyUp('KeyE'); await sleep(900); r.up = !(await js('!!G.city.places.seat')); }
  }
  return res;
}
