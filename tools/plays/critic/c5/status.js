(() => {
  const C = N.controller, H = G.hud, K = H.kit || H, I = G.interact, hp = G.player && G.player.health;
  const men = []; if (G.ais) for (const [h, a] of G.ais) men.push([h.slot, h.alive ? 1 : 0, +h.pos.x.toFixed(1), +h.pos.z.toFixed(1), a.brain && a.brain.S && a.brain.S.state]);
  return { scene: G.scenes.current && G.scenes.current.id, beat: G.scenes.beat, state: G.state, t: +N.time.toFixed(1),
    pos: [+C.pos.x.toFixed(2), +C.pos.y.toFixed(2), +C.pos.z.toFixed(2)], yaw: +C.yaw.toFixed(2), pitch: +C.pitch.toFixed(2), frozen: C.frozen, mode: C.mode,
    obj: K.objectiveText, teach: K.teachCur && (K.teachCur.text || K.teachCur.id || JSON.stringify(K.teachCur).slice(0,80)), warn: K.warnText,
    prompt: H.promptShown, say: H.sayShown, cur: I && I.current ? I.current.id : null, hp: hp ? +hp.hp.toFixed(0) : null,
    puzzle: G.puzzles && G.puzzles.active ? G.puzzles.active.id : null, men: men.length ? men : undefined };
})()
