// Critic C4: the click in a real fight (not a dummy). After the lesson, while
// he fights me, a button is pressed every 0.45 .. 0.9 s at a length of 60,
// 120, 200 or 280 ms (both buttons), whatever I or he is doing then; the cue
// is answered at 0.2 s so I stay up. Each press is logged with my state and
// his before it; the page's own record of the press (Brawl stats.clicks: the
// press time, the jab's start, its contact) says whether a jab came out on
// the press and when it struck.
//   { "drive": "tools/plays/critic/c4_click.mjs", "n": 120, "timeout": ms }
export default async function drive({ js, keyDown, keyUp, mouse, log, sleep, W, H, opts, cursor }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 300000, N = opts.n ?? 120;
  const rr = (a, b) => a + (b - a) * Math.random();
  const at = () => (cursor ? cursor() : [W / 2, H / 2]);
  const lens = [60, 120, 200, 280];
  const sent = [];
  let lastCue = null, next = Date.now() + 500;
  for (;;) {
    if (Date.now() - T0 > timeout || sent.length >= N) break;
    const s = await js(`(() => { const B = G.brawl; if (!B.active) return { off: true }; const c = B.c, e = G.eye;
      return { me: B.me.act, his: B.him.state, les: !!B.lesson, cue: B.cue && !B.cue.done ? B.cue.side : null, cueT: B.cue && B.cue.rec ? B.cue.rec.t0 : null, d: Math.hypot(c.pos.x - e.x, c.pos.z - e.z), jabs: (B.stats.clicks || []).length, presses: B.stats.presses || 0, winds: B.stats.winds || 0 }; })()`);
    if (!s || s.__exc || s.off) { await sleep(100); continue; }
    if (s.les) { await sleep(100); continue; }
    if (s.cue && s.cueT !== lastCue) { lastCue = s.cueT; await sleep(200); await keyDown(s.cue === 'R' ? 'KeyD' : 'KeyA'); await sleep(40); await keyUp(s.cue === 'R' ? 'KeyD' : 'KeyA'); continue; }
    if (s.d > 1.5) { await keyDown('KeyW'); await sleep(120); await keyUp('KeyW'); continue; }
    if (s.me === 'down') { await sleep(100); continue; }
    if (Date.now() < next) { await sleep(15); continue; }
    const b = Math.random() < 0.5 ? 'left' : 'right', ms = lens[sent.length % 4];
    const [x, y] = at();
    await mouse('mousePressed', x, y, b);
    const t1 = Date.now();
    // (did a jab start on the press: the page's own count, read at once and again a frame on)
    const a1 = await js(`(G.brawl.stats.clicks || []).length`);
    await sleep(Math.max(0, ms - (Date.now() - t1)));
    await mouse('mouseReleased', x, y, b);
    sent.push({ b, ms, me: s.me, his: s.his, jabsBefore: s.jabs, jabNow: a1 > s.jabs, pressesBefore: s.presses, windsBefore: s.winds });
    next = Date.now() + rr(450, 900);
  }
  await sleep(600);
  const R = await js(`(() => { const S = G.brawl.stats; return { clicks: (S.clicks || []).map((c) => [c[0], c[1], c[2], c[3]]), presses: S.presses || 0, winds: S.winds || 0, hards: S.hards || 0 }; })()`);
  // each of my presses against the page's records
  const out = { sent: sent.length, jabbedOnPress: 0, noJab: [], late: [], lat: [], winds: R.winds, hards: R.hards };
  for (const p of sent) {
    const rec = R.clicks[p.jabsBefore];
    if (!rec) { out.noJab.push({ ms: p.ms, me: p.me, his: p.his }); continue; }
    const startLag = +(rec[2] - rec[1]).toFixed(3), hit = rec[3] == null ? null : +(rec[3] - rec[1]).toFixed(3);
    if (startLag <= 0.02) out.jabbedOnPress++;
    out.lat.push(hit);
    if (hit == null || hit > 0.08 || startLag > 0.02) out.late.push({ ms: p.ms, me: p.me, his: p.his, startLag, hit });
  }
  const L = out.lat.filter((v) => v != null);
  out.meanHit = +(L.reduce((a, v) => a + v, 0) / Math.max(1, L.length)).toFixed(3);
  out.maxHit = Math.max(...L);
  out.byMe = sent.reduce((m, p) => ((m[p.me] = (m[p.me] || 0) + 1), m), {});
  out.secs = +((Date.now() - T0) / 1000).toFixed(1);
  return out;
}
