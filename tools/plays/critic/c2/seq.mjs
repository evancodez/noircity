// C2 critic: a first-timer's hands as a list of plain inputs, the screen's
// words logged after each (what the objective, the card, the prompt, the
// warning say; health; men alive). opts.seq: strings
//   "k KeyE [ms]"   a key tapped (held ms)      "d KeyW" / "u KeyW"  down / up
//   "w ms"          wait                         "s name"            a frame
//   "l dx dy [n]"   a look (mouse move)          "c left|right [ms]" a click
//   "md right" / "mu right"   a button held / let go
//   "st"            log the state                "watch ms [every]"  log the state every half second for ms (frames every `every`)
//   "e expr"        log an expression (observation only)
//   "face x z"      turn toward a point (mouse moves only)
export const STATE = `(() => { const K = G.hud.kit, H = G.health, sc = G.scenes.current, C = N.controller, W = G.player && G.player.weapons && G.player.weapons.active;
    const men = G.stage && G.stage.hoods ? G.stage.hoods.list.filter((h) => h.alive) : [];
    return { t: +G.time.toFixed(1), sc: sc && sc.id, beat: G.scenes.beat, hp: H && Math.round(H.hp),
      obj: K.objectiveText, warn: K.warnText, teach: K.teachCur ? (K.teachCur.id || K.teachCur.text || 1) : null, prompt: G.hud.promptShown,
      failing: G.failing ? G.failing.why : null, fails: G.fails(), men: men.length,
      crouch: +(C.crouchK || 0).toFixed(2), ammo: W ? W.ammo : null, wpn: W ? W.name || W.id : null, mode: C.mode,
      pos: [+C.pos.x.toFixed(2), +C.pos.z.toFixed(2)], yaw: +C.yaw.toFixed(2) }; })()`;
export default async function ({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, opts, cursor }) {
  const st = async () => { const s = await js(STATE); log(JSON.stringify(s)); return s; };
  for (const line of opts.seq) {
    const [op, a, b, c] = line.split(/\s+/);
    if (op === 'k') { await keyDown(a); await sleep(+(b || 60)); await keyUp(a); }
    else if (op === 'd') await keyDown(a);
    else if (op === 'u') await keyUp(a);
    else if (op === 'w') await sleep(+a);
    else if (op === 's') await shot(a);
    else if (op === 'l') { const n = +(c || 8); for (let i = 0; i < n; i++) { await turn(Math.round(+a / n), Math.round(+b / n)); await sleep(16); } }
    else if (op === 'c') { const [x, y] = cursor(); await mouse('mousePressed', x, y, a); await sleep(+(b || 50)); await mouse('mouseReleased', x, y, a); }
    else if (op === 'md') { const [x, y] = cursor(); await mouse('mousePressed', x, y, a); }
    else if (op === 'mu') { const [x, y] = cursor(); await mouse('mouseReleased', x, y, a); }
    else if (op === 'st') await st();
    else if (op === 'e') log('e ' + JSON.stringify(await js(line.slice(2))));
    else if (op === 'watch') {
      const T = Date.now(); let last = -1e9, k = 0;
      while (Date.now() - T < +a) { await st(); if (b && Date.now() - last >= +b) { last = Date.now(); await shot(`${c || 'wt'}${String(k++).padStart(2, '0')}`); } await sleep(500); }
    } else if (op === 'aim') {
      // the view onto a point (x y z), a hand's error `c` rad (mouse moves only)
      const [x, y, z] = a.split(',').map(Number), err = +(b || 0.01);
      for (let i = 0; i < 4; i++) {
        const s = await js(`({ e: [G.eye.x, G.eye.y, G.eye.z], yaw: N.controller.yaw, pitch: N.controller.pitch, sens: N.controller.sensitivity })`);
        const yw = Math.atan2(-(x - s.e[0]), -(z - s.e[2])), pt = Math.atan2(y - s.e[1], Math.hypot(x - s.e[0], z - s.e[2]));
        const dy = Math.atan2(Math.sin(yw - s.yaw), Math.cos(yw - s.yaw)) + (Math.random() - 0.5) * 2 * err, dp = pt - s.pitch + (Math.random() - 0.5) * 2 * err;
        if (Math.abs(dy) < 0.01 && Math.abs(dp) < 0.01) break;
        const px = Math.round(-dy / s.sens), py = Math.round(-dp / s.sens), n = Math.max(2, Math.ceil(Math.hypot(px, py) / 60));
        for (let j = 0; j < n; j++) { await turn(Math.round(px / n), Math.round(py / n)); await sleep(16); }
        await sleep(40);
      }
    } else if (op === 'face') {
      for (let i = 0; i < 6; i++) {
        const s = await js(`({ x: N.controller.pos.x, z: N.controller.pos.z, yaw: N.controller.yaw, sens: N.controller.sensitivity })`);
        const want = Math.atan2(-(+a - s.x), -(+b - s.z)); const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
        if (Math.abs(err) < 0.03) break;
        await turn(Math.round(Math.max(-60, Math.min(60, -err / s.sens))), 0); await sleep(30);
      }
    }
  }
  return await js(STATE);
}
