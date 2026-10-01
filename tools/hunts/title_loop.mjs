// [R3] the title again: a chapter picked from CHAPTERS, the story left to the title (what the last
// card's click does), BEGIN: where does it start? And what is left of the story's last scene.
export default async function (h) {
  await h.open('/?mute=1');
  h.check('CHAPTERS -> body', await h.chapter('body'));
  await h.wait(2500);
  await h.say();
  // to the title as the end card's click does it
  await h.js('(G.toTitle(), 1)');
  await h.js('(document.exitPointerLock(), 1)');
  await h.wait(800);
  h.log('on the title: ' + await h.snap());
  const st = await h.js(`({ state: G.state, scene: G.scenes.current && G.scenes.current.id, hands: G.hands.set, mode: N.controller.mode, titled: G.hud.titleShown, fov: N.camera.fov, vm: G.vm.visible, frozen: N.controller.frozen, layers: G.hud.layers ? [...G.hud.layers.keys()] : [] })`);
  h.log('title state: ' + JSON.stringify(st));
  h.check('the title is up, no scene running', st.state === 'title' && st.scene === null && st.titled === true, st);
  // BEGIN: the story from its first scene
  await h.startVia('#title .opt[data-k=begin]');
  await h.wait(3000);
  await h.say();
  const sc = await h.js(`G.scenes.current && G.scenes.current.id`);
  h.check('BEGIN after a chapter was picked starts the diner (the story from its first scene)', sc === 'diner', sc);
  const err = await h.err();
  h.check('errlog clean', err === '', err);
}
