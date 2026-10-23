// [O1b] NOIR CITY's streets: the proofs' driver (tools/play.mjs's module driver)
//   { "drive": "tools/lib/o1b_streets.mjs", "mode": "items" | "pigeons" | "props", ... }
// items    every kind of item picked up by E (the trusted key) and its count
//          seen: the eye set (a tool's teleport, between takes) 1.5 m from the
//          thing, looking at it; the prompt must be `E  take` before E; after
//          E the count changed and the line said it; the press-to-take time
//          (a page recorder: the trusted keydown to the take, ms) - a cash roll,
//          a box of rounds, a bottle, a matchbook, a paper (its front page up),
//          a gun dropped where a man fell (items.drop, as the hood:down event
//          does it); then the coupe taken by E (its glovebox)
// pigeons  the eye set 30 m from a flock on its ledge, W held toward it: the
//          flock goes up before the eye is under it (a count of flushed)
export default async function o1b(api) {
  const { opts } = api;
  if (opts.mode === 'items') return items(api);
  if (opts.mode === 'pigeons') return pigeons(api);
  if (opts.mode === 'doors') return doors(api);
  return { err: 'no mode' };
}

// doors    the cold play's finding 6: every street door of the lots round a
//          point (opts.at, opts.r) tried - the eye set 1.2 m in front of it,
//          facing it; the prompt `E  try the door` must be up; E; `locked`
//          (city:locked) must answer. Lots across a chunk line included.
async function doors(api) {
  const { js, sleep, log } = api;
  const list = await js(`(() => {
    const [x, z] = ${JSON.stringify(api.opts.at || [-201, -6])}, r = ${api.opts.r || 40};
    G.stage.part('stream').warmAround(x, z);
    const out = [];
    const S = G.stage.part('stream');
    for (const ch of S.loaded.values()) for (const d of ch.doors) if (!d.place && Math.hypot(d.x - x, d.z - z) < r) out.push([+d.x.toFixed(2), +d.z.toFixed(2), d.nx, d.nz, d.lot.chunk, G.stage.part('city').C.chunkOf(d.x, d.z)]);
    if (!window.__lockN) { window.__lockN = 0; G.on('city:locked', () => window.__lockN++); }
    return out;
  })()`);
  const out = [];
  for (const [x, z, nx, nz, lotChunk, atChunk] of list.slice(0, api.opts.max || 40)) {
    await js(`(() => { const x = ${x + nx * 1.2}, z = ${z + nz * 1.2}; N.controller.setPose(x, z, Math.atan2(${nx}, ${nz}), -0.05); return 1; })()`);
    await sleep(350);
    const p = await js(`({ prompt: G.hud.promptShown, n: window.__lockN })`);
    await press(api, 'KeyE');
    await sleep(300);
    const n = await js('window.__lockN');
    const ok = p.prompt === 'E  try the door' && n === p.n + 1;
    out.push({ at: [x, z], ok, straddles: lotChunk !== atChunk, prompt: p.prompt });
    if (!ok) log(`  door ${x},${z}: NOT OK - prompt '${p.prompt}', locked ${n - p.n}`);
  }
  const bad = out.filter((d) => !d.ok);
  log(`  doors: ${out.length} tried, ${out.filter((d) => d.straddles).length} of them on a lot across a chunk line, ${bad.length} without an answer`);
  return { tried: out.length, straddling: out.filter((d) => d.straddles).length, bad: bad.length, badAt: bad.map((d) => d.at) };
}

async function press(api, code) { await api.keyDown(code); await api.sleep(60); await api.keyUp(code); }

async function items(api) {
  const { js, sleep, log, shot } = api;
  // the page's recorder: the trusted E's time, the take's
  await js(`(() => { if (window.__o1bk) return 1; window.__o1bk = { e: 0, takes: [] }; addEventListener('keydown', (e) => { if (e.code === 'KeyE' && e.isTrusted) window.__o1bk.e = performance.now(); }, true); G.on('item:take', (e) => window.__o1bk.takes.push({ kind: e.kind, said: e.said, ms: +(performance.now() - window.__o1bk.e).toFixed(1), frame: G.counters ? 0 : 0 })); return 1; })()`);
  const out = [];
  const kinds = opts_kinds(api.opts);
  for (const kind of kinds) {
    // the thing: the spot of that kind nearest the anchor (a gun: dropped by the tool where a man would fall)
    const at = await js(`(() => {
      const P = G.stage.part('items');
      let it;
      if (${JSON.stringify(kind)} === 'weapon') { const c = G.city.car; it = P.drop('weapon', c.pos.x - 7, c.pos.z + 3.5, { gun: 'revolver' }); }
      else it = P.list.filter((q) => q.kind === ${JSON.stringify(kind)} && !q.taken).sort((a, b) => Math.hypot(a.x + 100, a.z - 40) - Math.hypot(b.x + 100, b.z - 40))[0];
      if (!it) return null;
      window.__o1bit = it;
      // (stand 1.5 m off it, on its open side, looking at it: a tool's set-up)
      const S = G.stage, C = S.part('city').C;
      let best = null;
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = it.x + Math.sin(a) * 1.5, z = it.z + Math.cos(a) * 1.5; const p = { x, y: 0, z }; S.colliders.resolve(p, 0.3); if (Math.hypot(p.x - x, p.z - z) < 0.05 && !C.inWater(x, z)) { best = [x, z]; break; } }
      if (!best) best = [it.x + 1.5, it.z];
      S.part('stream').warmAround(best[0], best[1]);
      const eyeY = S.surfaceY(best[0], best[1]) + 1.65;
      const yaw = Math.atan2(-(it.x - best[0]), -(it.z - best[1])), pitch = Math.atan2(it.y + 0.05 - eyeY, Math.hypot(it.x - best[0], it.z - best[1]));
      N.controller.setPose(best[0], best[1], yaw, pitch);
      return { x: it.x, z: it.z, kind: it.kind, from: best, place: it.place || null };
    })()`);
    if (!at || at.__exc) { out.push({ kind, ok: false, why: 'none found ' + JSON.stringify(at) }); continue; }
    await sleep(700);
    const before = await js(`({ money: G.save.money || 0, pocket: (G.player.weapons.get('revolver') || {}).pocket, bottles: G.save.flags.bottles || 0, matchbooks: Object.keys(G.save.flags.matchbooks || {}).length, inv: [...G.save.inventory], prompt: G.hud.promptShown, target: !!G.stage.part('items').target })`);
    await press(api, 'KeyE');
    await sleep(350);
    const after = await js(`({ money: G.save.money || 0, pocket: (G.player.weapons.get('revolver') || {}).pocket, bottles: G.save.flags.bottles || 0, matchbooks: Object.keys(G.save.flags.matchbooks || {}).length, inv: [...G.save.inventory], taken: window.__o1bit.taken, msg: G.hud.el.msg.textContent, paper: G.stage.part('items').paper(), take: window.__o1bk.takes[window.__o1bk.takes.length - 1] || null, held: G.player.weapons.current || null })`);
    if (api.opts.shots) await shot('item_' + kind);
    let ok = before.prompt.startsWith('E') && before.prompt.includes('take');
    if (kind === 'cash') ok = ok && after.money > before.money;
    if (kind === 'rounds') ok = ok && after.pocket > (isFinite(before.pocket) ? before.pocket : 0);
    if (kind === 'bottle') ok = ok && after.bottles === before.bottles + 1;
    if (kind === 'matchbook') ok = ok && after.matchbooks === before.matchbooks + 1;
    if (kind === 'paper') ok = ok && !!after.paper;
    if (kind === 'weapon') ok = ok && after.inv.includes('revolver') && after.held === 'revolver';
    if (kind !== 'paper') ok = ok && after.taken === true && after.msg.length > 0;
    const r = { kind, ok, prompt: before.prompt, said: after.take && after.take.said, ms: after.take && after.take.ms, before: { money: before.money, pocket: before.pocket, bottles: before.bottles, matchbooks: before.matchbooks }, after: { money: after.money, pocket: after.pocket, bottles: after.bottles, matchbooks: after.matchbooks, held: after.held }, paper: after.paper, msg: after.msg };
    out.push(r);
    log(`  ${kind}: ${ok ? 'ok' : 'NOT OK'} - prompt '${before.prompt}', said '${r.said || r.paper}', E to take ${r.ms} ms`);
  }
  // the glovebox: back to the coupe, E into it
  if (!api.opts.noCar) {
    await js(`(() => { const c = G.city.car; G.stage.part('stream').warmAround(c.pos.x, c.pos.z); N.controller.setPose(c.pos.x - Math.cos(c.yaw) * 4.7, c.pos.z + Math.sin(c.yaw) * 4.7, Math.atan2(-Math.cos(c.yaw), Math.sin(c.yaw)), -0.08); return 1; })()`);
    await sleep(700);
    await press(api, 'KeyE');
    await sleep(1500);
    const g = await js(`({ inCar: G.city.inCar, glove: !!G.city.car._glove, taken: G.stage.part('items').taken.filter((t) => t.glovebox), msg: G.hud.el.msg.textContent })`);
    out.push({ kind: 'glovebox', ok: g.inCar && g.glove, ...g });
    log(`  glovebox: in the car ${g.inCar}, searched ${g.glove}, found ${JSON.stringify(g.taken)}`);
  }
  return { items: out, bad: out.filter((r) => !r.ok).map((r) => r.kind), ms: out.filter((r) => r.ms != null).map((r) => r.ms) };
}
function opts_kinds(o) { return o.kinds || ['cash', 'rounds', 'bottle', 'matchbook', 'paper', 'weapon']; }

async function pigeons(api) {
  const { js, sleep, log, keyDown, keyUp, shot } = api;
  const out = [];
  for (let n = 0; n < (api.opts.n || 2); n++) {
    // a ledge with a flock on it: stand 26 m off it along its street, facing it
    const at = await js(`(() => {
      const A = G.stage.part('ambience');
      const f = A.flocks.find((q) => q.ledge && !q.up && q.n > 0 && !(window.__o1bf || []).includes(q.ledge));
      if (!f) return null;
      (window.__o1bf || (window.__o1bf = [])).push(f.ledge);
      const l = f.ledge, S = G.stage;
      // (out on its pavement, along the face)
      for (const s of [1, -1]) { const x = l.x + l.nx * 2.2 + l.ux * 24 * s, z = l.z + l.nz * 2.2 + l.uz * 24 * s; const p = { x, y: 0, z }; S.colliders.resolve(p, 0.3); if (Math.hypot(p.x - x, p.z - z) < 0.05) { N.controller.setPose(x, z, Math.atan2(-(l.x - x), -(l.z - z)), 0.12); return { x, z, ledge: [l.x, l.y, l.z], n: f.n, flushed: A.flushed }; } }
      return null;
    })()`);
    if (!at) { out.push({ ok: false, why: 'no flock' }); continue; }
    await sleep(500);
    await keyDown('KeyW');
    let r = null;
    for (let k = 0; k < 60; k++) {
      await sleep(150);
      r = await js(`(() => { const A = G.stage.part('ambience'), p = N.controller.pos; const l = ${JSON.stringify(at.ledge)}; return { flushed: A.flushed, d: +Math.hypot(p.x - l[0], p.z - l[2]).toFixed(1) }; })()`);
      if (r.flushed > at.flushed) break;
    }
    await sleep(500);
    if (api.opts.shots && n === 0) await shot('pigeons_up');
    await keyUp('KeyW');
    const ok = r && r.flushed > at.flushed;
    out.push({ ok, at: at.ledge, birds: at.n, upAt: r && r.d });
    log(`  pigeons ${n}: ${ok ? 'up' : 'NOT UP'} (${at.n} birds, at ${r && r.d} m)`);
    await sleep(800);
  }
  return { flocks: out, bad: out.filter((f) => !f.ok).length };
}
