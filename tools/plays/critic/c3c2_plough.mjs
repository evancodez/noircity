// [C3 critic, 2nd look] through a stepplay session: my car placed (phase c: no fail) and driven by held keys
// through a thing (a row of stalls), 2 frames at a time; after every step the smash pieces found INSIDE my
// car's body (the bonnet, the cabin, the boot: a box a little inside the car's own) are counted, and a frame
// is taken the first few times one is. Also the speed and the damage.
//   node tools/plays/critic/c3c2_plough.mjs <dir> <name> <x> <z> <yaw> <kmh> <keys,comma|-> <frames> [shotEvery]
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const [DIR, NAME, X, Z, YAW, KMH, KEYS, FR, SE = '30'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastN = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')).n || 0;
async function cmd(moves) {
  writeFileSync(`${DIR}/cmd.json.tmp`, JSON.stringify(moves)); renameSync(`${DIR}/cmd.json.tmp`, `${DIR}/cmd.json`);
  for (;;) { await sleep(10); let r; try { r = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')); } catch { continue; } if ((r.n || 0) !== lastN) { lastN = r.n; return r; } }
}
const keys = KEYS === '-' ? [] : KEYS.split(',');
const place = `(() => { const C = G.scenes.ctx.flags.chase; C.my.damage = 0; C.my.place(new N.THREE.Vector3(${X}, 0, ${Z}), ${YAW}, ${+KMH / 3.6}); return 1; })()`;
const probe = `(() => { const C = G.scenes.ctx.flags.chase, m = C.my, S = m.spec, P = (N.stage.smash || G.stage.smash).pieces;
  const c = Math.cos(m.yaw), sn = Math.sin(m.yaw), gy = m.groundY ?? m.pos.y; const inside = [];
  for (const p of P) { const dx = p.pos.x - m.pos.x, dz = p.pos.z - m.pos.z; if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c, ly = p.pos.y - gy;
    const top = lx > 0.85 ? 0.98 : lx < -1.05 ? 1.0 : 1.5;
    if (Math.abs(lx) < S.halfL - 0.15 && Math.abs(lz) < S.halfW - 0.12 && ly > 0.42 && ly < top) inside.push(p.name + '@' + lx.toFixed(2) + ',' + ly.toFixed(2) + ',' + lz.toFixed(2)); }
  return [+m.pos.x.toFixed(2), +m.pos.z.toFixed(2), +(m.speed * 3.6).toFixed(1), +m.damage.toFixed(2), P.length, inside]; })()`;
let r = await cmd([{ k: [], f: 1 }, { eval: place }, { k: keys, f: 1 }]);
const rows = [];
let sh = 0, found = 0, frames = 0, minV = 999;
for (let f = 0; f < +FR; f += 2) {
  const mv = [{ k: keys, f: 2 }, { eval: probe }];
  if (f % +SE === 0) mv.push({ shot: `${NAME}_${String(sh++).padStart(2, '0')}` });
  r = await cmd(mv);
  const v = r.out.find((o) => o.eval).v;
  rows.push(v);
  minV = Math.min(minV, v[2]);
  if (v[5].length) { frames++; found = Math.max(found, v[5].length); if (frames <= 3) { const s2 = await cmd([{ shot: `${NAME}_IN${frames}` }]); console.log('inside', f, JSON.stringify(v), s2.out.map((o) => o.shot).join(' ')); } }
}
await cmd([{ k: [], f: 1 }]);
console.log(JSON.stringify({ name: NAME, start: rows[0], end: rows[rows.length - 1], minKmh: minV, framesWithPieceInside: frames, mostInside: found }));
writeFileSync(`${DIR}/plough_${NAME}.json`, JSON.stringify(rows));
