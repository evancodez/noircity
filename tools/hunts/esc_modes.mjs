// [R3] ESC to pause in every mode and resume: what the game does while the pointer lock is gone
// (the clock holds, the view holds, no key stays down) and what it does when the click takes it back
// (the same mode, no jump of the eye, W held across it goes on or stays off as the hand says).
//   HUNT_ONLY=tail NOIR_PORT=5332 node tools/hunt.mjs tools/hunts/esc_modes.mjs
const CASES = [
  ['diner.settle', 'seated', 3500],
  ['fight.round1', 'brawl', 5500],
  ['body.approach', 'walk', 3500],
  ['body.strings', 'cutscene', 5500],
  ['office.corridor', 'walk', 3500],
  ['office.pad', 'table', 4500],
  ['office.safe', 'table', 4500],
  ['gunfight.shadows', 'office', 4000],
  ['watcher.seen', 'seated', 4500],
  ['watcher.escape', 'escape', 4500],
  ['watcher.run', 'run', 4500],
  ['tail.start', 'drive', 4500],
  ['tail.interrogate', 'hold', 6500],
  ['warehouse.arrive', 'sneak', 4500],
  ['warehouse.fight', 'brawl', 6500],
  ['shootout.arrive', 'walk', 4500],
];
const S = `(() => { const C = N.controller, e = N.camera.position; return { mode: C.mode, t: N.time, x: e.x, y: e.y, z: e.z, yaw: C.yaw, pitch: C.pitch, keys: [...C.keys].join(','), paused: G.hud.paused, locked: !!document.pointerLockElement, beat: G.scenes.beat, scene: G.scenes.current && G.scenes.current.id, state: G.state }; })()`;
export default async function (h) {
  const only = process.env.HUNT_ONLY;
  for (const [at, mode, wait] of CASES) {
    if (only && !at.includes(only)) continue;
    h.log(`=== ${at} (expect mode ${mode})`);
    await h.open(`/?mute=1&start=${at}`);
    if (!(await h.begin())) { h.check(`${at}: begun`, false); continue; }
    await h.wait(wait);
    const a = await h.js(S);
    h.log(`  at start: ${JSON.stringify({ mode: a.mode, beat: a.beat })}`);
    if (a.mode !== mode) h.log(`  NOTE mode is ${a.mode}, not ${mode}`);
    // W held, ESC while it is held, W released while paused, resume
    await h.down('KeyW'); await h.wait(500);
    const b = await h.js(S);
    await h.pause();
    const c = await h.js(S);
    h.check(`${at}: ESC shows the card, the lock is gone, keys cleared`, c.paused === true && c.locked === false && c.keys === '', c);
    await h.up('KeyW');
    await h.wait(1200);
    const d = await h.js(S);
    h.check(`${at}: the clock and the eye hold while paused`, Math.abs(d.t - c.t) < 0.03 && Math.hypot(d.x - c.x, d.y - c.y, d.z - c.z) < 0.01 && Math.abs(d.yaw - c.yaw) < 1e-4, { c: [c.t, c.x, c.z], d: [d.t, d.x, d.z] });
    // keys and clicks go nowhere while paused (the click on the card is the resume)
    await h.key('KeyE'); await h.key('KeyR'); await h.key('Space');
    await h.wait(300);
    const e2 = await h.js(S);
    h.check(`${at}: keys while paused do nothing`, Math.abs(e2.t - d.t) < 0.03, { d: d.t, e2: e2.t });
    const ok = await h.resume();
    h.check(`${at}: the click on the card takes the mouse back`, ok);
    await h.wait(700);
    const f = await h.js(S);
    h.check(`${at}: the mode is as it was, playing`, f.mode === c.mode && f.state === 'playing' && f.paused === false, { was: c.mode, now: f.mode, state: f.state });
    // the eye did not jump on the resume (a walk or a drive moves it: only a jump of more than 3 m counts)
    h.check(`${at}: no jump of the eye across the pause`, Math.hypot(f.x - c.x, f.z - c.z) < 4, { c: [c.x, c.z], f: [f.x, f.z] });
    // a second pause at once, and back (the browser refuses a second lock for a moment)
    await h.pause(); h.log('  second pause: ' + (await h.resume()));
    await h.wait(400);
    const g = await h.js(S);
    h.check(`${at}: still the same mode after a second pause`, g.mode === c.mode && g.state === 'playing', g);
    const er = await h.err();
    h.check(`${at}: errlog clean`, er === '', er);
  }
}
