// C2 critic: hands off (or W held) in the test bed, from the title.
// Logs what the screen says (objective, warning, teach card, prompt, fail
// words) and health every half second; a shot every `every` ms.
// opts: { dur: ms, every: ms, hold: 'KeyW' | null, tag: 'i' }
export default async function ({ js, keyDown, keyUp, shot, log, sleep, opts }) {
  const dur = opts.dur ?? 60000, every = opts.every ?? 4000, tag = opts.tag || 'w';
  const S = `(() => { const K = G.hud.kit, H = G.health, sc = G.scenes.current;
    const men = G.stage && G.stage.hoods ? G.stage.hoods.list.filter((h) => h.alive).length : -1;
    return { t: +G.time.toFixed(1), st: G.state, sc: sc && sc.id, beat: G.scenes.beat, hp: H && Math.round(H.hp), dead: H && H.dead,
      obj: K.objectiveText, warn: K.warnText, teach: K.teachCur ? (K.teachCur.id || K.teachCur) : null, prompt: G.hud.promptShown,
      failing: G.failing ? G.failing.why : null, last: G.lastFail ? G.lastFail.why + '@' + G.lastFail.from + ' warned ' + G.lastFail.warnedFor : null,
      fails: G.fails(), men, crouch: +(N.controller.crouchK || 0).toFixed(2), mode: N.controller.mode,
      pos: [+N.controller.pos.x.toFixed(2), +N.controller.pos.z.toFixed(2)] }; })()`;
  const T0 = Date.now();
  let k = 0, lastShot = -1e9, prev = '';
  if (opts.hold) await keyDown(opts.hold);
  const rec = [];
  while (Date.now() - T0 < dur) {
    const s = await js(S);
    const line = JSON.stringify({ ...s, t: undefined });
    if (line !== prev || (Date.now() - T0) % 3000 < 500) { log(JSON.stringify(s)); prev = line; }
    rec.push(s);
    if (Date.now() - lastShot >= every) { lastShot = Date.now(); await shot(`${tag}${String(k++).padStart(2, '0')}`); }
    await sleep(500);
  }
  if (opts.hold) await keyUp(opts.hold);
  const fails = rec.filter((r, i) => r.failing && !(rec[i - 1] && rec[i - 1].failing)).map((r) => r.failing + ' @' + r.beat);
  return { fails, last: rec[rec.length - 1] };
}
