// [C3 critic, 2nd look] through a stepplay session (phase c): my car placed short of each edge of the city
// and driven into it at 50 km/h, W held, then S (reverse out): frames before, at and after; the least speed,
// the damage, the height (a launch) and whether reversing frees it.
//   node tools/plays/critic/c3c2_edges.mjs <dir>
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const [DIR] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastN = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')).n || 0;
async function cmd(moves) {
  writeFileSync(`${DIR}/cmd.json.tmp`, JSON.stringify(moves)); renameSync(`${DIR}/cmd.json.tmp`, `${DIR}/cmd.json`);
  for (;;) { await sleep(10); let r; try { r = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')); } catch { continue; } if ((r.n || 0) !== lastN) { lastN = r.n; return r; } }
}
const EDGES = [
  ['west', -228, -92, Math.PI], ['south', -99, 112, -Math.PI / 2], ['north', -24, -222, Math.PI / 2], ['east_river', 100, 30, 0],
  ['northwest', -228, -242, Math.PI], ['southeast', 85, 133, 0], ['north2', 51, -222, Math.PI / 2],
];
const pick = process.argv[3] ? EDGES.filter((e) => process.argv.slice(3).includes(e[0])) : EDGES;
const probe = `(() => { const m = G.scenes.ctx.flags.chase.my; return [+m.pos.x.toFixed(1), +m.pos.z.toFixed(1), +(m.pos.y || 0).toFixed(2), +(m.speed * 3.6).toFixed(0), +m.damage.toFixed(2), +m.yaw.toFixed(2)]; })()`;
for (const [name, x, z, yaw] of pick) {
  await cmd([{ k: [], f: 1 }, { eval: `(() => { const C = G.scenes.ctx.flags.chase; C.my.damage = 0; C.my.place(new N.THREE.Vector3(${x}, 0, ${z}), ${yaw}, ${50 / 3.6}); return 1; })()` }, { k: [], f: 1 }]);
  const rows = [];
  let sh = 0;
  for (let f = 0; f < 240; f += 6) {
    const keys = f < 150 ? ['KeyW'] : ['KeyS'];
    const mv = [{ k: keys, f: 6 }, { eval: probe }];
    if (f % 30 === 0) mv.push({ shot: `edge_${name}_${String(sh++).padStart(2, '0')}` });
    const r = await cmd(mv);
    rows.push(r.out.find((o) => o.eval).v);
  }
  const maxY = Math.max(...rows.map((v) => v[2])), minV = Math.min(...rows.slice(0, 25).map((v) => v[3]));
  const atStop = rows[24], end = rows[rows.length - 1];
  console.log(JSON.stringify({ name, from: [x, z], stoppedAt: atStop, maxY, minKmhForward: minV, dmg: atStop[4], afterReverse: end, freed: Math.hypot(end[0] - atStop[0], end[1] - atStop[1]).toFixed(1) }));
}
await cmd([{ k: [], f: 1 }]);
