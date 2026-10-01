// [R3] scene 4: a puzzle left half done and E out. The pad and the safe are the scene's own (not
// game.puzzles): does E leave them, and stay left?
export default async function (h) {
  await h.open('/?mute=1&start=office.pad');
  await h.begin();
  await h.until(`G.scenes.ctx && G.scenes.ctx.flags.pad && G.scenes.ctx.flags.pad.active`, 15000);
  await h.wait(1500);
  await h.say();
  const F = () => h.js(`(() => { const f = G.scenes.ctx.flags; return { pad: f.pad.active, safe: f.safe.active, mode: N.controller.mode, beat: G.scenes.beat, prompt: G.hud.promptShown, y: +N.camera.position.y.toFixed(2) }; })()`);
  h.log('in the pad: ' + JSON.stringify(await F()));
  // a few strokes, then E out
  await h.mdown('left'); await h.look(120, 30, 6); await h.look(-120, 20, 6); await h.mup('left');
  await h.key('KeyE');
  await h.wait(900);
  const a = await F();
  h.log('after E: ' + JSON.stringify(a));
  h.check('E leaves the pad (and it stays left)', a.pad === false && a.mode === 'walk', a);
  await h.say();
  // and in again by the prompt, out again
  await h.wait(600);
  await h.say();
  const P = await h.js(`G.hud.promptShown`);
  h.log('prompt: ' + P);
  await h.key('KeyE'); await h.wait(900);
  const b = await F();
  h.log('E again: ' + JSON.stringify(b));
  await h.key('KeyE'); await h.wait(900);
  const c = await F();
  h.log('E third: ' + JSON.stringify(c));
  h.check('a second E leaves it again', c.pad === false, c);
  await h.say();
  // the safe by ear: the picture, the dial, E out
  await h.js(`(() => { const f = G.scenes.ctx.flags; return 1; })()`);
}
