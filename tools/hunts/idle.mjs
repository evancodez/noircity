// [R3] stand still for a minute (game time, by N.sim: the first-timer's hints, the nudges, the
// men who find him, the chase he does not run, the car that does not drive). Every chapter's
// beats by default; what the page says as the minute goes, and the errlog.
//   HUNT_ONLY=tail HUNT_SECS=60 NOIR_PORT=5332 node tools/hunt.mjs tools/hunts/idle.mjs
const STARTS = [
  'diner.settle', 'diner.order', 'diner.pay', 'fight.round1', 'body.approach', 'body.body', 'body.strings', 'body.landing', 'body.halves', 'body.note', 'body.leave',
  'office.corridor', 'office.room', 'office.pad', 'office.safe', 'office.ledger', 'gunfight.shadows', 'gunfight.quiet', 'watcher.seen', 'watcher.escape', 'watcher.run', 'watcher.car',
  'tail.start', 'tail.chase', 'tail.close', 'tail.crash', 'tail.interrogate', 'warehouse.arrive', 'warehouse.floor', 'warehouse.out', 'warehouse.fight', 'warehouse.after',
  'shootout.arrive', 'shootout.cars', 'shootout.cardinal', 'shootout.end',
];
export default async function (h) {
  const only = process.env.HUNT_ONLY;
  const secs = +(process.env.HUNT_SECS || 60);
  const chunk = 5;
  for (const at of STARTS) {
    if (only && !at.includes(only)) continue;
    await h.open(`/?mute=1&start=${at}`);
    if (!(await h.begin())) { h.check(`${at}: begun`, false); continue; }
    await h.wait(3000);
    let last = '';
    const t0 = Date.now();
    for (let t = 0; t < secs; t += chunk) {
      await h.js(`(N.sim(${chunk}), 1)`);
      const s = await h.snap();
      const key = s.replace(/at=\S+ y=\S+ /, '').replace(/fade=\S+ ?/, '');
      if (key !== last) { h.log(`  ${at} +${t + chunk}s: ${s}`); last = key; }
    }
    const e = await h.err();
    h.log(`${at}: ${secs} s of game time in ${((Date.now() - t0) / 1000).toFixed(1)} s${e ? '  ERR ' + e.slice(0, 300) : ''}`);
    h.check(`${at}: errlog clean after standing still ${secs} s`, e === '', e);
  }
}
