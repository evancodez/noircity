// [C10a] the in-between moments played badly: every mouse button and key during a still, a chapter card,
// a fail's fall and black and a held teach card; ESC and a resize in the middle of each; does the game
// come back where it should, with nothing fired, nothing skipped unseen and nothing stuck.
//   NOIR_PORT=5350 node tools/hunt.mjs tools/hunts/edges.mjs
const ST = `JSON.stringify({ st: G.state, scene: G.scenes.current && G.scenes.current.id, beat: G.scenes.beat, stills: G.stills.active ? (G.stills.run && G.stills.run.id) + ':' + (G.stills.run && G.stills.run.panel) : null, card: +(G.hud.cardT || 0).toFixed(2), failing: G.failing ? G.failing.phase : null, paused: G.hud.paused, locked: !!document.pointerLockElement, fade: +G.scenes.fadeK.toFixed(2), mode: N.controller.mode, frozen: N.controller.frozen, teach: G.hud.kit.teachCur ? G.hud.kit.teachCur.id : null, crawl: G.crawl, hp: Math.round(G.health.hp), shots: G.counters.shots, t: +N.time.toFixed(2) })`;
export default async function (h) {
  const S = async (tag) => { const v = JSON.parse(await h.js(ST)); h.log(`${tag}: ${JSON.stringify(v)}`); return v; };
  const buttons = async () => { await h.click('left'); await h.wait(120); await h.click('right'); await h.wait(120); await h.click('middle'); await h.wait(120); for (const k of ['KeyR', 'KeyC', 'KeyF', 'KeyQ', 'ShiftLeft', 'KeyW']) await h.key(k, 50); };

  // ---- 1. the opening stills: every button, then ESC once (the run stays), a resize, ESC twice (skipped)
  await h.open('/?mute=1');
  h.check('begun', await h.begin());
  await h.wait(800);
  let a = await S('stills up');
  h.check('the opening stills are up', !!a.stills, a);
  await h.click('right'); await h.click('middle'); await h.key('KeyR'); await h.key('KeyC'); await h.wait(300);
  const b = await S('after RMB, MMB, R, C');
  h.check('RMB, MMB, R, C do not move the stills on', b.stills === a.stills, [a.stills, b.stills]);
  await h.resize(1000, 640); await h.wait(300); await h.resize(1280, 800);
  await h.key('Escape'); await h.wait(250);
  const c = await S('one ESC');
  h.check('one ESC keeps the run (two skip)', !!c.stills, c);
  await h.key('Escape'); await h.wait(60); await h.key('Escape'); await h.wait(600);
  const d = await S('ESC ESC');
  h.check('ESC twice skips the run', !d.stills, d);
  // the chapter card: buttons and keys under it
  await h.until('!G.stills.active', 4000);
  if (!(await h.js('!!document.pointerLockElement'))) { await h.clickOn('canvas'); await h.wait(400); }
  await S('card');
  await buttons();
  await h.wait(2500);
  const e = await S('card gone');
  h.check('the diner after the card, playing, nothing stuck', e.scene === 'diner' && e.st === 'playing' && !e.frozen, e);
  h.check('errlog clean (stills, card)', (await h.err()) === '', await h.err());

  // ---- 2. a fail's fall and black in IV: ESC in the fall, buttons under the black, a resize, back
  await h.open('/?mute=1&start=gunfight.flank');
  h.check('IV begun', await h.begin());
  await h.wait(3000);
  await h.js(`(G.fail({ why: 'Hunt.', fall: true }), 1)`);
  await h.wait(400);
  const f0 = await S('in the fall');
  await h.pause();
  await h.wait(1500);
  const f1 = await S('paused in the fall');
  h.check('the fall holds while paused', f1.failing === f0.failing && f1.paused, [f0.failing, f1.failing, f1.paused]);
  h.check('resume in the fall', await h.resume());
  await h.until(`G.failing && G.failing.phase === 'black'`, 4000);
  const shots0 = (await S('black')).shots;
  await buttons(); await h.resize(900, 600); await h.wait(200); await h.resize(1280, 800);
  await h.until('!G.failing', 8000);
  await h.wait(1200);
  const f2 = await S('back');
  h.check('back at the checkpoint, playing, controls free', f2.beat === 'flank' && f2.st === 'playing' && !f2.frozen && f2.fade < 0.1 && f2.hp >= 99, f2);
  h.check('nothing fired under the black', f2.shots === shots0, [shots0, f2.shots]);
  // ESC under the black itself
  await h.js(`(G.fail({ why: 'Hunt.', fall: false }), 1)`);
  await h.until(`G.failing && G.failing.phase === 'black'`, 4000);
  await h.pause(); await h.wait(2500);
  const g0 = await S('paused under the black');
  h.check('resume under the black', await h.resume());
  await h.until('!G.failing', 8000); await h.wait(1200);
  const g1 = await S('back again');
  h.check('back again after a pause under the black', g1.beat === 'flank' && g1.st === 'playing' && !g1.frozen && g1.fade < 0.1, g1);
  h.check('errlog clean (IV fails)', (await h.err()) === '', await h.err());

  // ---- 3. a held teach card (time crawls) in V: ESC on it, resume; then the key it waits for
  await h.open('/?mute=1&start=watcher.alley');
  h.check('V begun', await h.begin());
  const held = await h.until(`!!G.hud.kit.teachCur`, 15000);
  const t0 = await S('teach up');
  if (held) {
    await h.pause(); await h.wait(1200);
    const t1 = await S('paused on the card');
    h.check('the card stays through the pause', t1.teach === t0.teach, [t0.teach, t1.teach]);
    h.check('resume on the card', await h.resume());
    await h.wait(400);
    await h.key('Space', 80); await h.key('KeyC', 80);
    await h.wait(1500);
    const t2 = await S('after the keys');
    h.check('the time comes back after the card', t2.crawl === 1, t2);
  }
  h.check('errlog clean (V)', (await h.err()) === '', await h.err());

  // ---- 4. VI: the lock lost mid-drive, W held across it
  await h.open('/?mute=1&start=tail.chase2');
  h.check('VI begun', await h.begin());
  await h.wait(3500);
  await h.down('KeyW'); await h.wait(1200);
  const v0 = JSON.parse(await h.js(`JSON.stringify({ sp: G.vehicles.player ? +G.vehicles.player.speedAbs.toFixed(2) : null, t: N.time })`));
  await h.js(`(window.dispatchEvent(new Event('blur')), document.exitPointerLock(), 1)`); await h.wait(1500);
  const v1 = JSON.parse(await h.js(`JSON.stringify({ sp: G.vehicles.player ? +G.vehicles.player.speedAbs.toFixed(2) : null, t: N.time, paused: G.hud.paused, keys: [...N.controller.keys].join(',') })`));
  h.log(`drive: ${JSON.stringify(v0)} -> ${JSON.stringify(v1)}`);
  h.check('the drive holds when the lock goes (paused, no key held)', v1.paused && Math.abs(v1.t - v0.t) < 0.2 && v1.keys === '', v1);
  await h.up('KeyW');
  h.check('resume the drive', await h.resume());
  await h.wait(1500);
  await S('driving again');
  h.check('errlog clean (VI)', (await h.err()) === '', await h.err());
}
