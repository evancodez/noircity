// [R3] every beat of every chapter started cold (?start=<scene>.<beat>): the errlog, the mode, a
// prompt or a line that should be there, and a few wrong keys (E on nothing, R, SPACE, every
// button) before the beat has done anything.
//   HUNT_ONLY=tail NOIR_PORT=5332 node tools/hunt.mjs tools/hunts/beats.mjs
const BEATS = {
  diner: ['settle', 'order', 'drink', 'pay'],
  fight: ['start', 'lesson', 'round1', 'round2', 'round3', 'reel', 'ko', 'outside', 'matchbook'],
  body: ['approach', 'body', 'strings', 'landing', 'halves', 'note', 'leave'],
  office: ['corridor', 'room', 'pad', 'safe', 'ledger'],
  gunfight: ['shadows', 'door', 'window', 'quiet'],
  watcher: ['seen', 'escape', 'run', 'car'],
  tail: ['start', 'chase', 'close', 'shot', 'crash', 'interrogate'],
  warehouse: ['arrive', 'floor', 'lamps', 'aisle', 'stairs', 'listen', 'out', 'fight', 'ko', 'after'],
  shootout: ['arrive', 'cars', 'doorways', 'el', 'driveby', 'cardinal', 'end'],
};
export default async function (h) {
  const only = process.env.HUNT_ONLY;
  const mash = +(process.env.HUNT_MASH || 2500);
  for (const [scene, beats] of Object.entries(BEATS)) {
    for (const b of beats) {
      const at = `${scene}.${b}`;
      if (only && !at.includes(only)) continue;
      await h.open(`/?mute=1&start=${at}`);
      if (!(await h.begin())) { h.check(`${at}: begun`, false); continue; }
      await h.wait(4500);
      const s1 = await h.snap();
      const e1 = await h.err();
      h.log(`${at}: ${s1}${e1 ? '  ERR ' + e1.slice(0, 200) : ''}`);
      h.check(`${at}: errlog clean after 4.5 s`, e1 === '', e1);
      await h.mash(mash, { look: true });
      await h.releaseAll();
      await h.wait(500);
      const s2 = await h.snap();
      const e2 = await h.err();
      h.log(`    after the wrong keys: ${s2}`);
      h.check(`${at}: errlog clean after the wrong keys`, e2 === '', e2);
    }
  }
}
