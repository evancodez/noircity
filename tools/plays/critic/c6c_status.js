(() => {
  // [C6 critic] what the screen says after each move: the kit's lines (objective, teach card,
  // warning, prompt, the fail) and where I stand. Generic: nothing of the chase's own state.
  const sc = G.scenes, K = G.hud.kit, C = N.controller;
  const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05;
  const p = C && (C.position || (C.body && C.body.position) || (N.camera && N.camera.position));
  return { scene: sc.current && sc.current.id, beat: sc.beat, state: G.state, t: +N.time.toFixed(2), mode: C && C.mode,
    obj: K && K.obj ? K.obj.text : null,
    teach: K && K.teachCur ? (K.teachCur.text || K.teachCur.id) : null,
    warn: K && vis(K.warnEl) ? K.warnEl.textContent.trim() : '',
    prompt: G.hud.promptShown, say: G.hud.sayShown, failing: !!G.failing,
    lastFail: G.lastFail ? G.lastFail.why + '@' + (+G.lastFail.t).toFixed(1) : null,
    pos: N.camera ? [+N.camera.position.x.toFixed(1), +N.camera.position.y.toFixed(2), +N.camera.position.z.toFixed(1)] : null,
    yaw: C ? +(+C.yaw).toFixed(2) : null };
})()
