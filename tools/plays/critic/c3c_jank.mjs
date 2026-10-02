// node jank.mjs <dir> <name> <x> <z> <yaw> <kmh> <keys,comma> <frames> <targetExpr|-> [shotEvery]
// Places my car (phase c: no fail), holds the keys, steps 2 frames at a time; records my speed, damage,
// height, roll / pitch, the least distance to the target (an expression giving [x, z]), and a few frames.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const [DIR, NAME, X, Z, YAW, KMH, KEYS, FR, TGT = '-', SE = '20'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastN = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')).n || 0;
async function cmd(moves) {
  writeFileSync(`${DIR}/cmd.json.tmp`, JSON.stringify(moves)); renameSync(`${DIR}/cmd.json.tmp`, `${DIR}/cmd.json`);
  for (;;) { await sleep(10); let r; try { r = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')); } catch { continue; } if ((r.n || 0) !== lastN) { lastN = r.n; return r; } }
}
const keys = KEYS === '-' ? [] : KEYS.split(',');
const place = `(() => { const C = G.scenes.ctx.flags.chase; C.my.damage = 0; C.my.place(new N.THREE.Vector3(${X}, 0, ${Z}), ${YAW}, ${+KMH / 3.6}); return 1; })()`;
const probe = `(() => { const C = G.scenes.ctx.flags.chase, m = C.my; const t = ${TGT === '-' ? 'null' : TGT};
  return [+m.pos.x.toFixed(2), +m.pos.z.toFixed(2), +(m.pos.y || 0).toFixed(2), +(m.speed * 3.6).toFixed(1), +m.damage.toFixed(2), +(m.roll || 0).toFixed(2), +(m.pitch || 0).toFixed(2), t ? +Math.hypot(t[0] - m.pos.x, t[1] - m.pos.z).toFixed(2) : null, +m.yaw.toFixed(2)]; })()`;
let r = await cmd([{ k: [], f: 1 }, { eval: place }, { k: keys, f: 1 }, { eval: probe }]);
const rows = [];
let minD = Infinity, maxY = -9, minV = 999, sh = 0;
for (let f = 0; f < +FR; f += 2) {
  const mv = [{ k: keys, f: 2 }, { eval: probe }];
  if (f % +SE === 0) mv.push({ shot: `${NAME}_${String(sh++).padStart(2, '0')}` });
  r = await cmd(mv);
  const v = r.out.find((o) => o.eval).v;
  rows.push(v);
  if (v[7] != null) minD = Math.min(minD, v[7]);
  maxY = Math.max(maxY, v[2]);
}
await cmd([{ k: [], f: 1 }]);
const first = rows[0], last = rows[rows.length - 1];
let maxDmg = 0; for (const v of rows) maxDmg = Math.max(maxDmg, v[4]);
console.log(JSON.stringify({ name: NAME, start: first, end: last, minDist: minD, maxY, maxDmg, maxRoll: Math.max(...rows.map((v) => Math.abs(v[5]))), maxPitch: Math.max(...rows.map((v) => Math.abs(v[6]))) }));
writeFileSync(`${DIR}/jank_${NAME}.json`, JSON.stringify(rows));
