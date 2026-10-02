(() => {
  // [C3 critic, 2nd look] the status a stepplay session prints after each move: what the screen says
  // (the kit's objective, teach card, warning, the prompt, the fail) and where the cars are.
  const sc = G.scenes, C = sc.ctx && sc.ctx.flags && sc.ctx.flags.chase, K = G.hud.kit;
  const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const o = { scene: sc.current && sc.current.id, beat: sc.beat, state: G.state, t: +N.time.toFixed(2), mode: G.controller.mode,
    obj: K && K.obj ? K.obj.text + ':' + K.obj.phase : null,
    teach: K && K.teachCur ? K.teachCur.text || K.teachCur.id : null,
    warnTxt: K && vis(K.warnEl) ? K.warnEl.textContent.trim() : '',
    prompt: G.hud.promptShown, say: G.hud.sayShown, failing: !!G.failing,
    lastFail: G.lastFail ? G.lastFail.why + '@' + (+G.lastFail.t).toFixed(1) : null };
  if (C && C.my) {
    const g = C.gun;
    Object.assign(o, { phase: C.phase, my: [+C.my.pos.x.toFixed(1), +C.my.pos.z.toFixed(1), +C.my.yaw.toFixed(3)], kmh: +(C.my.speed * 3.6).toFixed(0),
      his: [+C.his.pos.x.toFixed(1), +C.his.pos.z.toFixed(1), +C.his.yaw.toFixed(3)], hkmh: +((C.his.speed || 0) * 3.6).toFixed(0),
      gap: +C.gap().toFixed(1), seen: C.seen, unseen: +(C.unseen || 0).toFixed(1), dmg: +C.my.damage.toFixed(2),
      cfail: !!C.failing, warn: C.kit && C.kit.warning, wrecked: !!C.wrecked,
      hisDmg: C.hisDmg ? JSON.parse(JSON.stringify(C.hisDmg)) : null,
      gun: g ? { r: g.rounds, p: g.pocket, s: g.shots, h: g.hits, aim: +(g.aimK || 0).toFixed(2), up: +(g.upK || g.raiseK || 0).toFixed(2) } : null,
      fails: (globalThis.__tailFails || []).map((f) => f.why).join('|'), bot: !!C.bot });
  }
  // (every pair of cars on wheels: the deepest overlap of their boxes, metres - the bodies are
  // a little smaller than the boxes, so a few cm is a touch; 0.2 m and more is one car inside another)
  const L = (G.vehicles && G.vehicles.list) || [];
  let ov = 0, ovp = null;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; if (!a.spec || !b.spec) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; if (dx * dx + dz * dz > 49) continue;
    const ax = [[Math.cos(a.yaw), -Math.sin(a.yaw)], [Math.sin(a.yaw), Math.cos(a.yaw)], [Math.cos(b.yaw), -Math.sin(b.yaw)], [Math.sin(b.yaw), Math.cos(b.yaw)]];
    const ext = (v, n) => { const f = [Math.cos(v.yaw), -Math.sin(v.yaw)], r = [Math.sin(v.yaw), Math.cos(v.yaw)]; return v.spec.halfL * Math.abs(f[0] * n[0] + f[1] * n[1]) + v.spec.halfW * Math.abs(r[0] * n[0] + r[1] * n[1]); };
    let pen = Infinity;
    for (const n of ax) { const d = ext(a, n) + ext(b, n) - Math.abs(dx * n[0] + dz * n[1]); pen = Math.min(pen, d); }
    if (pen > ov) { ov = pen; ovp = [a === (C && C.my) ? 'me' : a === (C && C.his) ? 'his' : 'car', b === (C && C.my) ? 'me' : b === (C && C.his) ? 'his' : 'car']; }
  }
  o.ov = +ov.toFixed(2); o.ovp = ovp;
  return o; })()
