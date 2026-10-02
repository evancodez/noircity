// [R3] one chapter, started from the title's CHAPTERS, then abused: the wrong keys at the
// wrong times, ESC and back, the window resized, standing still, a reload and CONTINUE.
//   HUNT_CH=tail NOIR_PORT=5332 node tools/hunt.mjs tools/hunts/chapter.mjs
export default async function (h) {
  const ch = process.env.HUNT_CH || 'diner';
  const stillMs = +(process.env.HUNT_STILL || 20000);
  await h.open('/?mute=1');
  h.check(`${ch}: started from CHAPTERS`, await h.chapter(ch));
  await h.wait(2500);
  await h.say();
  // the first six seconds, left alone
  await h.watch(6000, 700);
  h.check(`${ch}: errlog clean after the first beat`, (await h.err()) === '', await h.err());
  // the wrong keys at the wrong times
  h.log('--- mash: E on nothing, every mouse button, R, SPACE, WASD, C, F, Shift, Tab');
  const n = await h.mash(5000);
  await h.releaseAll();
  h.log(`    ${n} inputs`);
  await h.say();
  h.check(`${ch}: errlog clean after the mash`, (await h.err()) === '', await h.err());
  // ESC and back
  await h.pause();
  const s1 = await h.snap();
  h.check(`${ch}: ESC shows the pause card`, /PAUSED/.test(s1), s1);
  // time must not run while paused
  const t0 = await h.js('N.time');
  await h.wait(1500);
  const t1 = await h.js('N.time');
  h.check(`${ch}: the game holds while paused`, Math.abs(t1 - t0) < 0.05, { t0, t1 });
  // keys and buttons while paused go nowhere (but may be held across the resume)
  await h.key('KeyE'); await h.key('KeyW', 200); await h.click('left');
  h.check(`${ch}: resume`, await h.resume());
  await h.wait(600);
  await h.say();
  // resize
  await h.resize(900, 560); await h.wait(500);
  const a1 = await h.js('N.camera.aspect');
  h.check(`${ch}: resize keeps the aspect`, Math.abs(a1 - 900 / 560) < 0.01, a1);
  await h.resize(1920, 1080); await h.wait(500);
  await h.resize(1280, 800); await h.wait(300);
  // stand still
  h.log(`--- standing still ${stillMs / 1000} s`);
  await h.watch(stillMs, 1000);
  h.check(`${ch}: errlog clean after standing`, (await h.err()) === '', await h.err());
  // reload mid-scene, then CONTINUE
  h.log('--- reload mid-scene, CONTINUE');
  const was = await h.js(`G.scenes.current && G.scenes.current.id + '.' + G.scenes.beat`);
  await h.reload();
  await h.wait(1500);
  const can = await h.js(`!document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden')`);
  h.check(`${ch}: CONTINUE is offered after the reload (was ${was})`, can === true);
  if (can) {
    h.check(`${ch}: CONTINUE took the mouse`, await h.cont());
    await h.wait(2500);
    await h.say();
    await h.watch(3000, 700);
  }
  const err = await h.err();
  h.check(`${ch}: errlog clean at the end`, err === '', err);
}
