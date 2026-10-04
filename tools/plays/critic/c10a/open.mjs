// [C10a critic] BEGIN as a first-timer: the stills hands off, then the diner hands off for 40 s, then what the screen says
import { wrap } from './lib.mjs';
export default async function (h0) {
  const h = wrap(h0);
  await h.open('/?mute=1');
  await h.begin();
  await h.watch(30000, 400);
  await h.shot('o1_diner_idle');
  await h.watch(30000, 500);
  await h.shot('o2_diner_idle60');
  // the player tries E, LMB, F at random looking at the counter
  await h.key('KeyE'); await h.wait(800); await h.say();
  await h.click('left'); await h.wait(800); await h.say();
  await h.key('KeyF'); await h.watch(6000, 300);
  await h.shot('o3_after_f');
  await h.watch(20000, 500);
  await h.key('KeyE'); await h.watch(8000, 300);
  await h.click('left'); await h.watch(8000, 300);
  await h.shot('o4');
  await h.watch(20000, 500);
}
