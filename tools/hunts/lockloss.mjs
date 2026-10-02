// [R3] which input takes the pointer lock away (the mash found the card up with no ESC pressed)
export default async function (h) {
  await h.open('/?mute=1&start=diner.settle');
  await h.begin();
  await h.wait(2500);
  const locked = () => h.js('!!document.pointerLockElement');
  for (const k of ['KeyE', 'KeyR', 'Space', 'KeyF', 'KeyC', 'KeyQ', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Tab', 'ControlLeft', 'AltLeft', 'MetaLeft', 'F5', 'Enter', 'Backspace']) {
    await h.key(k, 80); await h.wait(150);
    const l = await locked();
    h.log(`${k}: ${l ? 'locked' : 'LOCK LOST'}`);
    if (!l) { await h.resume(); }
  }
  for (const b of ['left', 'right', 'middle']) {
    await h.click(b, 80); await h.wait(150);
    const l = await locked();
    h.log(`click ${b}: ${l ? 'locked' : 'LOCK LOST'}`);
    if (!l) { await h.resume(); }
  }
  await h.look(60, 20, 4); await h.wait(150);
  h.log('look: ' + ((await locked()) ? 'locked' : 'LOCK LOST'));
}
