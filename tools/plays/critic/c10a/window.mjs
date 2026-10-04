// [C10a critic] IV's quiet into V's window, hands off once there: what happens in the first seconds of V
import { wrap, walkTo, face } from './lib.mjs';
export default async function (h0) {
  const h = wrap(h0);
  await h.open('/?mute=1&start=gunfight.quiet'); await h.begin(); await h.wait(2500);
  await h.js(`(window.FL = [], G.on('fail', (e) => FL.push(e.why)), 1)`);
  await walkTo(h, 3.1, 5.0); await walkTo(h, 4.8, 4.9); await face(h, 5.6, 4.15);
  for (let i = 0; i < 40; i++) { h.log((await h.snap()) + ' crawl=' + await h.js('G.crawl') + ' fails=' + await h.js('JSON.stringify(FL)') + ' failing=' + await h.js('G.failing && G.failing.why')); if (i === 3 || i === 8) await h.shot('win_' + i); await h.wait(200); }
}
