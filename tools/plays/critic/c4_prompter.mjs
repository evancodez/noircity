// Critic C4: a first-timer in a scene with prompts (chapter I): reads the
// objective, the spoken line and the prompt; presses the key the prompt names
// (E, SPACE, a click) a human moment after it shows; with no prompt for a
// while, looks about slowly (the mouse) to find one; a still is clicked on.
// Frames at every new line. Stops when `done` holds or on the timeout.
//   { "drive": "tools/plays/critic/c4_prompter.mjs", "done": "expr", "timeout": ms, "shots": 30 }
export default async function drive({ js, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts, cursor, turn }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 240000;
  const at = () => (cursor ? cursor() : [W / 2, H / 2]);
  const seen = new Set();
  let shots = opts.shots ?? 30, n = 0, quiet = Date.now(), lastPrompt = '', sweep = 1, swept = 0;
  const snap = async (why) => { if (shots-- <= 0) return; await shot(`p${String(n++).padStart(2, '0')}_${why.replace(/[^a-z0-9]+/gi, '_').slice(0, 28)}`); };
  const lines = [];
  for (;;) {
    if (Date.now() - T0 > timeout) { log('prompter: timeout'); break; }
    const s = await js(`(() => ({ done: !!(${opts.done || 'false'}), sc: G.scenes.current && G.scenes.current.id, beat: G.scenes.beat, obj: G.hud.objectiveText, say: G.hud.sayShown, prompt: G.hud.promptShown, msg: +G.hud.el.msg.style.opacity > 0 ? G.hud.el.msg.textContent : '', teach: G.hud.kit.teachCur ? G.hud.kit.teachCur.text : '', stills: !!(G.stills && G.stills.active), st: G.state, mode: N.controller.mode }))()`);
    if (!s || s.__exc) { await sleep(200); continue; }
    if (s.done) break;
    for (const [k, v] of [['obj', s.obj], ['say', s.say], ['prompt', s.prompt], ['msg', s.msg], ['teach', s.teach]]) {
      if (!v || seen.has(k + v)) continue;
      seen.add(k + v);
      lines.push(`${s.sc}/${s.beat} ${k}: ${v}`);
      log(`LINE ${s.sc}/${s.beat} ${k}: ${v}`);
      await snap(k + '_' + v);
    }
    if (s.stills) { await sleep(2600); const [x, y] = at(); await mouse('mousePressed', x, y, 'left'); await sleep(50); await mouse('mouseReleased', x, y, 'left'); continue; }
    if (s.prompt) {
      quiet = Date.now(); swept = 0;
      if (s.prompt !== lastPrompt) { lastPrompt = s.prompt; await sleep(700); continue; }
      const key = s.prompt.split(/\s+/)[0].toUpperCase();
      if (key === 'E' || key === 'SPACE' || key === 'C' || key === 'R' || key === 'F') { const code = key === 'SPACE' ? 'Space' : 'Key' + key; await keyDown(code); await sleep(70); await keyUp(code); }
      else if (key === 'LMB' || key === 'CLICK' || key === 'RMB') { const [x, y] = at(); const b = key === 'RMB' ? 'right' : 'left'; await mouse('mousePressed', x, y, b); await sleep(80); await mouse('mouseReleased', x, y, b); }
      else log('prompter: a prompt with no key I know: ' + s.prompt);
      lastPrompt = ''; await sleep(900); continue;
    }
    // nothing to do on the screen: wait a little, then look about
    if (Date.now() - quiet > 3500 && s.mode !== 'cutscene') {
      if (turn) { await turn(60 * sweep, swept % 2 ? 0 : 0); }
      swept++;
      if (swept % 40 === 0) sweep = -sweep;
    }
    await sleep(120);
  }
  return { lines, secs: +((Date.now() - T0) / 1000).toFixed(1) };
}
