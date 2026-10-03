// [C3 critic, 2nd look] through a stepplay session (phase c): my car placed `back` m before walker i along
// his pavement's line (offset `off` m toward the road), at kmh, W held; every 2 frames the walker's place,
// his least distance to my car's body (in its frame), and frames. Says where he went: along, into the road,
// or into the building line (the facade: `wallX` for a N-S pavement, given by the caller).
//   node tools/plays/critic/c3c2_walker.mjs <dir> <i> <back> <off> <kmh> <frames> [shotEvery]
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const [DIR, I, BACK, OFF, KMH, FR, SE = '10'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastN = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')).n || 0;
async function cmd(moves) {
  writeFileSync(`${DIR}/cmd.json.tmp`, JSON.stringify(moves)); renameSync(`${DIR}/cmd.json.tmp`, `${DIR}/cmd.json`);
  for (;;) { await sleep(10); let r; try { r = JSON.parse(readFileSync(`${DIR}/res.json`, 'utf8')); } catch { continue; } if ((r.n || 0) !== lastN) { lastN = r.n; return r; } }
}
const place = `(() => { const C = G.scenes.ctx.flags.chase, w = C.walkers.list[${I}], p = w.c.fig.pos, s = w.seg;
  const L = Math.hypot(s[2] - s[0], s[3] - s[1]), ux = (s[2] - s[0]) / L, uz = (s[3] - s[1]) / L;
  // (the road side of the pavement: toward the street's middle, i.e. away from the facade - the caller's sign)
  const nx = -uz, nz = ux, o = ${+OFF};
  const x = p.x - ux * ${+BACK} + nx * o, z = p.z - uz * ${+BACK} + nz * o;
  const yaw = Math.atan2(-uz, ux);
  C.my.damage = 0; C.my.place(new N.THREE.Vector3(x, 0, z), yaw, ${+KMH / 3.6});
  window.__w0 = [p.x, p.z, ux, uz, nx, nz]; return [x, z, yaw, p.x, p.z]; })()`;
const probe = `(() => { const C = G.scenes.ctx.flags.chase, w = C.walkers.list[${I}], p = w.c.fig.pos, m = C.my, S = m.spec;
  const c = Math.cos(m.yaw), sn = Math.sin(m.yaw), dx = p.x - m.pos.x, dz = p.z - m.pos.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  const out = Math.max(Math.abs(lx) - S.halfL, Math.abs(lz) - S.halfW, 0);
  const W0 = window.__w0, ax = (p.x - W0[0]) * W0[4] + (p.z - W0[1]) * W0[5];
  return [+p.x.toFixed(2), +p.z.toFixed(2), +ax.toFixed(2), +out.toFixed(2), +(m.speed * 3.6).toFixed(1), w.mode, +m.pos.x.toFixed(1), +m.pos.z.toFixed(1)]; })()`;
let r = await cmd([{ k: [], f: 1 }, { eval: place }, { k: ['KeyW'], f: 1 }]);
console.log('placed', JSON.stringify(r.out.find((o) => o.eval).v));
const rows = [];
let sh = 0;
for (let f = 0; f < +FR; f += 2) {
  const mv = [{ k: ['KeyW'], f: 2 }, { eval: probe }];
  if (f % +SE === 0) mv.push({ shot: `walker${I}_${OFF}_${String(sh++).padStart(2, '0')}` });
  r = await cmd(mv);
  rows.push(r.out.find((o) => o.eval).v);
}
await cmd([{ k: [], f: 1 }]);
const minOut = Math.min(...rows.map((v) => v[3]));
const axs = rows.map((v) => v[2]);
console.log(JSON.stringify({ walker: I, off: +OFF, minGapToMyBody: minOut, sideMove: [Math.min(...axs), Math.max(...axs)], modes: [...new Set(rows.map((v) => v[5]))], end: rows[rows.length - 1] }));
writeFileSync(`${DIR}/walker_${I}_${OFF}.json`, JSON.stringify(rows));
