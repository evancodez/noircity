// [R3] scene 4's safe: E out of the dial, in again, and the hint a first-timer gets after standing at it
export default async function (h) {
  await h.open('/?mute=1&start=office.safe');
  await h.begin();
  await h.until(`G.scenes.ctx && G.scenes.ctx.flags.safe && G.scenes.ctx.flags.safe.active`, 15000);
  await h.wait(1500);
  const F = () => h.js(`(() => { const f = G.scenes.ctx.flags; return { safe: f.safe.active, mode: N.controller.mode, prompt: G.hud.promptShown, say: G.hud.sayShown, stage: f.safe.stage }; })()`);
  h.log('in the safe: ' + JSON.stringify(await F()));
  await h.key('KeyE'); await h.wait(900);
  const a = await F();
  h.log('after E: ' + JSON.stringify(a));
  h.check('E leaves the dial (and it stays left)', a.safe === false && a.mode === 'walk', a);
  await h.wait(500);
  await h.key('KeyE'); await h.wait(900);
  const b = await F();
  h.log('E at the prompt: ' + JSON.stringify(b));
  h.check('E at the dial prompt goes back to the dial', b.safe === true, b);
  // stand at the dial a minute without turning it: the hint (28 s) must not be a warning
  await h.js('(N.sim(32), 1)');
  const c = await F();
  h.log('after 32 s at the dial: ' + JSON.stringify(c));
  const e = await h.err();
  h.check('no warning from the hint line', e === '', e);
}
