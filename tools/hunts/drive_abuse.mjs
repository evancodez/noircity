// [R3] the tail by a driver who does not follow the road: hard left into the wall of the arches, hard
// right at the river's rail, reverse back down the road, stand on the brake, hold W with nothing else,
// get out in the middle (E where it asks for nothing), the car's state sampled throughout.
export default async function (h) {
  await h.open('/?mute=1&start=tail.start');
  await h.begin();
  await h.wait(3000);
  const S = () => h.js(`(() => { const T = G.scenes.ctx && G.scenes.ctx.flags.tail; if (!T || !T.my) return null; const v = T.my; const e = N.camera.position; return { state: T.state, s: +v.s.toFixed(1), d: +v.d.toFixed(1), speed: +v.speed.toFixed(1), x: +v.pos.x.toFixed(1), z: +v.pos.z.toFixed(1), yaw: +v.yaw.toFixed(2), eye: [+e.x.toFixed(1), +e.y.toFixed(2), +e.z.toFixed(1)], fail: T.failT, fade: !!T.fade, mode: N.controller.mode, prompt: G.hud.promptShown, nan: [v.pos.x, v.pos.z, v.yaw, v.speed].some((q) => !Number.isFinite(q)) }; })()`);
  const log = async (tag) => h.log(tag + ' ' + JSON.stringify(await S()));
  await log('start');
  // W, hard left (A) for 6 s
  await h.down('KeyW'); await h.down('KeyA');
  for (let i = 0; i < 6; i++) { await h.wait(1000); await log('  W+A'); }
  await h.up('KeyA'); await h.down('KeyD');
  for (let i = 0; i < 6; i++) { await h.wait(1000); await log('  W+D'); }
  await h.up('KeyD'); await h.up('KeyW');
  // reverse (S held from stopped) for 8 s
  await h.down('KeyS');
  for (let i = 0; i < 8; i++) { await h.wait(1000); await log('  S'); }
  await h.up('KeyS');
  // every key at once
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) await h.down(k);
  await h.wait(3000); await log('all keys');
  await h.releaseAll();
  // E on nothing, R with a full gun, the wrong buttons
  await h.key('KeyE'); await h.key('KeyR'); await h.click('left'); await h.click('right', 600); await h.click('middle');
  await h.wait(1000); await log('wrong keys');
  const nan = await h.js(`(() => { const T = G.scenes.ctx.flags.tail; const v = T.my; return [v.pos.x, v.pos.z, v.yaw, v.speed, N.camera.position.x, N.camera.position.y].some((q) => !Number.isFinite(q)); })()`);
  h.check('no NaN in the car or the eye', nan === false, nan);
  await h.say();
}
