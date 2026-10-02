(() => {
  const sc = G.scenes, C = sc.ctx && sc.ctx.flags && sc.ctx.flags.chase;
  const q = (s) => { const e = document.querySelector(s); return e && getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > 0.05 ? e.textContent.trim() : ''; };
  const o = { scene: sc.current && sc.current.id, beat: sc.beat, state: G.state, t: +N.time.toFixed(2), mode: G.controller.mode,
    obj: q('.c3obj'), warnTxt: q('.c3warn'), teach: q('.c3teach'), veil: q('.c3veil span'), prompt: G.hud.promptShown, say: G.hud.sayShown };
  if (C && C.my) {
    const g = C.gun;
    Object.assign(o, { phase: C.phase, my: [+C.my.pos.x.toFixed(1), +C.my.pos.z.toFixed(1), +C.my.yaw.toFixed(3)], kmh: +(C.my.speed * 3.6).toFixed(0),
      his: [+C.his.pos.x.toFixed(1), +C.his.pos.z.toFixed(1), +C.his.yaw.toFixed(3)], hkmh: +((C.his.speed || 0) * 3.6).toFixed(0),
      gap: +C.gap().toFixed(1), seen: C.seen, unseen: +C.unseen.toFixed(1), dmg: +C.my.damage.toFixed(2), failing: !!C.failing,
      leg: C.driver && C.driver.legIndex, dstate: C.driver && C.driver.state, warn: C.kit && C.kit.warning, wrecked: !!C.wrecked, wreck: C.wreck ? true : false,
      hisDmg: C.hisDmg ? JSON.parse(JSON.stringify(C.hisDmg)) : null,
      gun: g ? { r: g.rounds, p: g.pocket, s: g.shots, h: g.hits, aim: +(g.aimK || 0).toFixed(2) } : null,
      fails: (globalThis.__tailFails || []).map((f) => f.why).join('|'), bot: !!C.bot });
  }
  return o; })()
