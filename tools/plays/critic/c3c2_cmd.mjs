// [C3 critic, 2nd look] one batch of moves into a tools/stepplay.mjs session, its answer printed.
//   node tools/plays/critic/c3c2_cmd.mjs <dir> '<JSON array of moves>'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
const [DIR, MOVES] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const n0 = existsSync(`${DIR}/res.json`) ? (JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')).n || 0) : 0;
writeFileSync(`${DIR}/cmd.json.tmp`, MOVES); renameSync(`${DIR}/cmd.json.tmp`, `${DIR}/cmd.json`);
for (;;) {
  await sleep(20);
  let r; try { r = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')); } catch { continue; }
  if ((r.n || 0) !== n0 || r.quit) {
    for (const o of r.out || []) {
      if (o.status) console.log('S', JSON.stringify(o.status));
      else if (o.shot) console.log('shot', o.shot);
      else console.log('E', JSON.stringify(o.v).slice(0, 2000));
    }
    if (r.err) console.log('ERR', r.err);
    break;
  }
}
