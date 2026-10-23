// [O2 critic] a cold player's hands in the natural city (no &come, no &held, no &park):
//   standroad  walk into the nearest traffic lane, stand facing the oncoming way, wait for a
//              car; log what it does (stops? where? honks? goes round? hits me?); then
//              (opts.take) walk to its driver's door at a human pace and E; what happens
// Every key and turn is trusted input; the page is only read.
export default async function cold(api) {
  const { js, turn, keyDown, keyUp, sleep, log, opts } = api;
  const held = new Set();
  const set = async (c, on) => { if (on && !held.has(c)) { held.add(c); await keyDown(c); } else if (!on && held.has(c)) { held.delete(c); await keyUp(c); } };
  const tap = async (c, h = 70) => { await keyDown(c); await sleep(h); await keyUp(c); };
  const st = () => js(`(() => { const C = N.controller, R = G.city || {}; return { x: C.pos.x, z: C.pos.z, yaw: C.yaw, sens: C.sensitivity, mode: C.mode, inCar: !!R.inCar, prompt: G.hud.promptShown, warn: G.hud.kit && G.hud.kit.warnText, hp: G.health ? G.health.hp : null, fight: !!(G.brawl && G.brawl.active), failing: !!G.failing }; })()`);
  const walkTo = async (x, z, timeout = 15000, near = 0.5) => {
    const T = Date.now() + timeout;
    for (;;) {
      const s = await st(); const dx = x - s.x, dz = z - s.z;
      if (Math.hypot(dx, dz) < near) break;
      if (Date.now() > T) { await set('KeyW', false); return false; }
      const want = Math.atan2(-dx, -dz), err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
      if (Math.abs(err) > 0.03) await turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0);
      await set('KeyW', Math.abs(err) < 0.6); await sleep(33);
    }
    await set('KeyW', false); return true;
  };
  const faceYaw = async (want) => { for (let i = 0; i < 40; i++) { const s = await st(); const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)); if (Math.abs(err) < 0.05) return; await turn(Math.round(Math.max(-60, Math.min(60, -err * 0.7 / s.sens))), 0); await sleep(30); } };
  const out = { log: [] };
  if (opts.mode === 'standroad') {
    const s0 = await st();
    const L = await js(`(() => { const L = G.wheels.graph.nearestLane(${s0.x}, ${s0.z}); return L ? { x: L.x, z: L.z, h: L.heading, d: L.d } : null; })()`);
    out.lane = L;
    if (!L) return { err: 'no lane' };
    await walkTo(L.x, L.z, 15000, 0.8);
    // face the traffic coming up this lane: the way it drives is h (a heading); look back down it
    const h = L.h; // heading as atan2? log it
    const me = await st();
    out.stood = [+me.x.toFixed(1), +me.z.toFixed(1)];
    // the man looks along the street both ways: pick the way a car comes from later
    const T0 = Date.now(); let car = null, minD = 99, stopD = null, honk = false, hit = false, hp0 = me.hp;
    const watch = Date.now() + (opts.watch || 60000);
    let traceT = 0;
    while (Date.now() < watch) {
      const c = await js(`(() => { const p = N.controller.pos; let b = null; for (const t of G.wheels.traffic.cars) { const v = t.v; const l = v.local(p.clone ? p.clone() : p, new v.pos.constructor()); if (l.x < -3 || l.x > 40 || Math.abs(l.z) > 3) continue; if (!b || l.x < b.ahead) b = { ahead: +l.x.toFixed(1), side: +l.z.toFixed(1), v: +v.speed.toFixed(1), kind: t.kind, who: t.driver && t.driver.kind, st: t.state, manT: +(t.manT||0).toFixed(1), honk: !!t.manHonk, round: +(t.roundT||0).toFixed(1), id: G.wheels.traffic.cars.indexOf(t) }; } return b; })()`);
      const s = await st();
      if (s.hp != null && hp0 != null && s.hp < hp0 - 0.5) hit = true;
      if (c) {
        if (!car) { car = c; out.log.push({ t: Date.now() - T0, first: c }); }
        minD = Math.min(minD, c.ahead);
        if (c.honk) honk = true;
        if (Math.abs(c.v) < 0.2 && stopD == null && c.ahead < 20) { stopD = c.ahead; out.log.push({ t: Date.now() - T0, stopped: c }); if (opts.take) break; }
        if (Date.now() - traceT > 500) { traceT = Date.now(); out.log.push({ t: Date.now() - T0, c, me: [+s.x.toFixed(1), +s.z.toFixed(1)], hp: s.hp }); }
      }
      await sleep(80);
    }
    out.minD = minD; out.stopD = stopD; out.honk = honk; out.hit = hit; out.found = !!car;
    if (opts.take && stopD != null) {
      await sleep(opts.react || 600);
      const door = await js(`(() => { const t = G.wheels.traffic.cars[${car ? 'G.wheels.traffic.cars.findIndex((x) => Math.hypot(x.v.pos.x - N.controller.pos.x, x.v.pos.z - N.controller.pos.z) < 22 && Math.abs(x.v.speed) < 0.5)' : -1}]; if (!t) return null; const v = t.v, co = Math.cos(v.yaw), si = Math.sin(v.yaw), hw = v.spec.halfW + 0.85; return { x: v.pos.x, z: v.pos.z, door: [v.pos.x + -0.2 * co + -hw * si, v.pos.z - -0.2 * si + -hw * co], kind: t.kind, who: t.driver && t.driver.kind }; })()`);
      out.door = door;
      if (door) {
        const t1 = Date.now();
        const ok = await walkTo(door.door[0], door.door[1], 12000, 0.6);
        const s = await st();
        const want = Math.atan2(-(door.x - s.x), -(door.z - s.z)); await faceYaw(want);
        const s2 = await st();
        out.atDoor = { ok, ms: Date.now() - t1, prompt: s2.prompt, carV: await js(`(() => { let b = 99; for (const t of G.wheels.traffic.cars) { const d = Math.hypot(t.v.pos.x - N.controller.pos.x, t.v.pos.z - N.controller.pos.z); if (d < 6) b = +t.v.speed.toFixed(1); } return b; })()`) };
        if (api.shot) await api.shot('at_door');
        await tap('KeyE');
        const t2 = Date.now(); let inMs = null;
        for (let i = 0; i < 60; i++) { const q = await st(); if (q.inCar) { inMs = Date.now() - t2; break; } await sleep(50); }
        out.inMs = inMs;
        await sleep(400);
        if (api.shot) await api.shot('taken');
        // what follows, 8 s: warnings, a fight, men
        const T2 = Date.now(); const seen = [];
        while (Date.now() - T2 < (opts.after || 8000)) { const q = await st(); const w = q.warn; if (w && !seen.includes(w)) seen.push(w); if (q.fight && !seen.includes('FIGHT')) seen.push('FIGHT'); await sleep(150); }
        out.after = { seen, stats: await js('({ ...G.wheels.hijack.stats, men: G.wheels.hijack.men.map((m) => m.state), crime: G.crime && G.crime.log ? G.crime.log.slice(-3) : null })'), me: await st() };
      }
    }
    await set('KeyW', false);
    return out;
  }
  if (opts.mode === 'runover') {
    // in the taxi: wait for a fare's hail, then drive at him (W held, A / D toward him) and see what the car does to a man
    const T0 = Date.now();
    let f = null;
    while (Date.now() - T0 < 40000) { f = await js(`(() => { const F = G.wheels.fares; return F.state === 'hail' && F.fare && F.fare.c ? { x: F.fare.c.fig.pos.x, z: F.fare.c.fig.pos.z } : null; })()`); if (f) break; await sleep(200); }
    if (!f) return { err: 'no hail' };
    out.hailAt = f;
    let minD = 99, passed = false, shotDone = false;
    const T1 = Date.now();
    await set('KeyW', true);
    while (Date.now() - T1 < 20000) {
      const q = await js(`(() => { const c = G.city.car, F = G.wheels.fares; const m = F.fare && F.fare.c ? F.fare.c.fig.pos : null; return { cx: c.pos.x, cz: c.pos.z, yaw: c.yaw, v: c.speed, m: m ? [m.x, m.z] : null, st: F.state, dmg: c.damage }; })()`);
      if (!q.m) { out.log.push({ t: Date.now() - T1, gone: q.st }); break; }
      const dx = q.m[0] - q.cx, dz = q.m[1] - q.cz, d = Math.hypot(dx, dz);
      minD = Math.min(minD, d);
      const fx = Math.cos(q.yaw), fz = -Math.sin(q.yaw);
      const ahead = dx * fx + dz * fz, ang = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
      if (Date.now() % 4 === 0 || d < 4) if (d < 3.2 || out.log.length < 2) out.log.push({ t: Date.now() - T1, d: +d.toFixed(2), ahead: +ahead.toFixed(1), v: +q.v.toFixed(1), man: q.m.map((x) => +x.toFixed(1)), st: q.st, dmg: +q.dmg.toFixed(2) });
      if (d < 2.2 && !shotDone && api.shot) { shotDone = true; await api.shot('runover_close'); }
      if (ahead < -6) { passed = true; break; }
      await set('KeyD', ang > 0.04); await set('KeyA', ang < -0.04);
      await sleep(40);
    }
    await set('KeyW', false); await set('KeyA', false); await set('KeyD', false);
    out.minD = +minD.toFixed(2); out.passed = passed;
    out.end = await js(`({ fare: G.wheels.fares.state, man: G.wheels.fares.fare && G.wheels.fares.fare.c ? [G.wheels.fares.fare.c.fig.pos.x, G.wheels.fares.fare.c.fig.pos.z] : null, car: [G.city.car.pos.x, G.city.car.pos.z], dmg: G.city.car.damage })`);
    return out;
  }
  if (opts.mode === 'ram') {
    // in a car: chase the nearest car of the traffic at full throttle and hit it; how deep do the two
    // bodies go into each other, does it show (its damage), does S back me off; then again
    const pen = `(a, o) => { const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z; const ca = Math.cos(a.yaw), sa = Math.sin(a.yaw), cb = Math.cos(o.yaw), sb = Math.sin(o.yaw); let p = 9; for (const [x, z] of [[ca, -sa], [sa, ca], [cb, -sb], [sb, cb]]) { const ra = a.spec.halfL * Math.abs(ca * x - sa * z) + a.spec.halfW * Math.abs(sa * x + ca * z); const rb = (o.spec ? o.spec.halfL : o.hx) * Math.abs(cb * x - sb * z) + (o.spec ? o.spec.halfW : o.hz) * Math.abs(sb * x + cb * z); p = Math.min(p, ra + rb - Math.abs(dx * x + dz * z)); } return p; }`;
    const hits = [];
    for (let n = 0; n < (opts.n || 3); n++) {
      const T1 = Date.now(); let tgtId = null, hit = null, worst = 0, maxV = 0;
      await set('KeyW', true);
      while (Date.now() - T1 < 30000) {
        const q = await js(`(() => { const pen = ${pen}; const c = G.city.car, TC = G.wheels.traffic.cars; let t = ${tgtId} != null ? TC.find((x) => x.id === ${tgtId}) : null; if (!t) { let bd = 90; for (const x of TC) { const d = Math.hypot(x.v.pos.x - c.pos.x, x.v.pos.z - c.pos.z); if (d < bd) { bd = d; t = x; } } } if (!t) return { none: true, v: c.speed }; const o = t.v; return { id: t.id, kind: t.kind, ox: o.pos.x, oz: o.pos.z, ov: o.speed, cx: c.pos.x, cz: c.pos.z, yaw: c.yaw, v: c.speed, p: pen(c, o), touch: c.touchT, dmg: c.damage, odmg: o.damage || 0 }; })()`);
        if (q.none) { await sleep(200); continue; }
        tgtId = q.id; maxV = Math.max(maxV, Math.abs(q.v));
        if (q.p > -0.05 && !hit) { hit = { at: Date.now() - T1, kind: q.kind, v: +q.v.toFixed(1), ov: +q.ov.toFixed(1) }; if (api.shot && n === 0) await api.shot('ram_hit'); }
        if (hit) { worst = Math.max(worst, q.p); if (Date.now() - T1 - hit.at > 1500) { hit.worst = +worst.toFixed(2); hit.dmg = +q.dmg.toFixed(2); hit.odmg = +q.odmg.toFixed(2); hit.ovAfter = +q.ov.toFixed(1); break; } }
        const dx = q.ox - q.cx, dz = q.oz - q.cz, fx = Math.cos(q.yaw), fz = -Math.sin(q.yaw);
        const ang = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
        await set('KeyD', ang > 0.04); await set('KeyA', ang < -0.04);
        await sleep(35);
      }
      await set('KeyW', false); await set('KeyA', false); await set('KeyD', false);
      // S: backed off?
      const a = await js('[G.city.car.pos.x, G.city.car.pos.z]');
      await set('KeyS', true); await sleep(2000); await set('KeyS', false);
      const b = await js('[G.city.car.pos.x, G.city.car.pos.z]');
      if (hit) hit.backed = +Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(1);
      hits.push(hit || { miss: true, maxV });
      log('  ram ' + JSON.stringify(hits[hits.length - 1]));
      await sleep(800);
    }
    out.hits = hits;
    return out;
  }
  if (opts.mode === 'pullsit') {
    // the staged car (&come=...&held=1) stopped by me: to its door, E, then sit hands off and watch hp, the men, their rounds
    let c = null;
    for (let i = 0; i < 300; i++) { c = await js(`(() => { const c = G.wheels.traffic.cars.find((x) => x.stopBy); if (!c) return null; const v = c.v, co = Math.cos(v.yaw), si = Math.sin(v.yaw), hw = v.spec.halfW + 0.85; return { who: c.driver.kind, by: Math.hypot(v.pos.x - c.stopBy.pos.x, v.pos.z - c.stopBy.pos.z), x: v.pos.x, z: v.pos.z, v: v.speed, door: [v.pos.x + -0.2 * co + -hw * si, v.pos.z - -0.2 * si + -hw * co] }; })()`); if (c && Math.abs(c.v) < 0.2 && c.by < 14) break; await sleep(100); }
    if (!c) return { err: 'no car' };
    await sleep(600);
    out.walked = await walkTo(c.door[0], c.door[1], 20000, 0.4);
    const s = await st(); await faceYaw(Math.atan2(-(c.x - s.x), -(c.z - s.z)));
    out.prompt = (await st()).prompt;
    await tap('KeyE');
    await sleep(300);
    if (opts.run) {
      // the man shoved out runs up the street ahead: W, and steer at him
      const T1 = Date.now(); let minD = 99;
      await set('KeyW', true);
      while (Date.now() - T1 < 8000) {
        const q = await js(`(() => { const c = G.city.car, m = G.wheels.hijack.men[0]; const f = m && m.c ? m.c.fig.pos : null; return { cx: c.pos.x, cz: c.pos.z, yaw: c.yaw, v: c.speed, m: f ? [f.x, f.z] : null, st: m ? m.state : null }; })()`);
        if (!q.m) { out.log.push({ t: Date.now() - T1, gone: true }); break; }
        const dx = q.m[0] - q.cx, dz = q.m[1] - q.cz, d = Math.hypot(dx, dz), fx = Math.cos(q.yaw), fz = -Math.sin(q.yaw);
        const ahead = dx * fx + dz * fz, ang = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
        minD = Math.min(minD, d);
        if (d < 3.2 || out.log.length < 2) out.log.push({ t: Date.now() - T1, d: +d.toFixed(2), ahead: +ahead.toFixed(2), side: +(dx * -fz + dz * fx).toFixed(2), v: +q.v.toFixed(1), st: q.st });
        if (d < 2.0 && api.shot && !out.shot) { out.shot = true; await api.shot('through_him'); }
        if (ahead < -5) break;
        await set('KeyD', ang > 0.03); await set('KeyA', ang < -0.03);
        await sleep(40);
      }
      await set('KeyW', false); await set('KeyA', false); await set('KeyD', false);
      out.minD = +minD.toFixed(2);
      out.end = await js(`({ men: G.wheels.hijack.men.map((m) => m.state), hp: G.health.hp })`);
      return out;
    }
    const T = Date.now();
    while (Date.now() - T < (opts.sitMs || 20000)) {
      const q = await js(`({ hp: G.health.hp, inCar: G.city.inCar, fight: !!(G.brawl && G.brawl.active), warn: G.hud.kit && G.hud.kit.warnText, men: G.wheels.hijack.men.map((m) => m.state + ':' + (m.gun ? m.gun.shots : '-')), failing: !!G.failing })`);
      out.log.push({ t: Date.now() - T, ...q });
      if (out.log.length === 8 && api.shot) await api.shot('sitting');
      await sleep(700);
    }
    return out;
  }
  return { err: 'no mode' };
}
