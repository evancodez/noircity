// [R3] chapter 1: the diner, wrong keys at the wrong times, ESC, resize
export default async function (h) {
  await h.open('/?mute=1');
  await h.begin();
  await h.say();
  await h.watch(6000, 500);
  h.log('E on nothing / mouse buttons / R / space while the intro runs');
  await h.mash(3000, { keys: ['KeyE', 'KeyR', 'Space', 'KeyW', 'KeyA', 'KeyF', 'KeyC', 'ShiftLeft'] });
  await h.releaseAll();
  await h.say();
  await h.pause(); await h.say();
  h.log('resume: ' + await h.resume());
  await h.say();
  await h.resize(900, 600); await h.wait(500); await h.say();
  await h.resize(1280, 800); await h.wait(300);
  await h.watch(4000, 500);
}
