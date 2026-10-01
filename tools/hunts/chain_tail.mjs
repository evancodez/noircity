// [R3] the seam watcher -> tail, played as the chain (the lanes' plays start the tail cold):
// what the watcher leaves in the controller and the hands when the tail begins.
export default async function (h) {
  await h.open('/?mute=1&start=watcher.car');
  h.check('begun', await h.begin());
  await h.until(`G.scenes.beat === 'car' && !G.scenes.trans`, 15000);
  await h.say();
  // to my car's door (the play walks there; the pose is set at it)
  await h.until(`G.interact.list.some((i) => i.id === 'drive')`, 20000);
  const door = await h.js(`(() => { const i = G.interact.list.find((x) => x.id === 'drive'); const p = typeof i.at === 'function' ? i.at() : i.at; return [p.x, p.z]; })()`);
  h.log('the door at ' + JSON.stringify(door));
  await h.js(`(() => { N.controller.setPose(${door[0] - 1.5}, ${door[1]}, -Math.PI / 2, -0.1); return 1; })()`);
  await h.wait(800);
  await h.say();
  await h.until(`G.hud.promptShown.includes('drive')`, 6000);
  await h.say();
  await h.key('KeyE');
  await h.until(`G.scenes.current && G.scenes.current.id === 'tail'`, 12000);
  await h.wait(3500);
  await h.say();
  const v = await h.js(`({ frozen: N.controller.frozen, mode: N.controller.mode, hands: G.hands.set, clip: G.hands.current, fov: N.camera.fov, prompt: G.hud.promptShown })`);
  h.log('tail start: ' + JSON.stringify(v));
  h.check('the controls are free in the tail (not frozen by the watcher)', v.frozen === false, v);
  await h.shot('chain_tail_start');
  // drive a little
  await h.down('KeyW'); await h.wait(3000);
  await h.say();
  await h.up('KeyW');
}
