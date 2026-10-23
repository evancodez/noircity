// [O6] The destruction set's proofs by real input (tools/play.mjs's module driver):
//   { "drive": "tools/lib/o6_smash.mjs", "mode": "drive" | "shoot" | "burn" | "tram" | "latency" | "memory" | "city", ... }
// drive    E into the coupe, then down the bed's east pavement, across the
//          junction, up the west one and into a shop window by the keys a
//          player presses (W / S / A / D, pure pursuit on a path): every kind
//          over, the record of what went, the car never inside a standing
//          thing, nothing floating, everything resting at the end
// shoot    on foot with the Tommy gun: the mouse onto each kind (trusted
//          moves), LMB bursts: what each answered
// burn     the sedan across the road: rounds into its bonnet until it burns,
//          then back off and watch: the fire, the blast, the wreck
// tram     (the tram beat) the sedan across the rails, the tram on it: sparks
// latency  a round's first frame (LMB to the first frame a thing moved), a
//          car's (the frame it meets a bin to the frame the bin moves)
// memory   (the hundred beat) the hundred go over and are mended, opts.cycles times:
//          the heap and the renderer's memory before, between, after
// city     the city's own: down Grand Ave and through the Tenements' market by the keys
const PATHS = {
  // the bed: the east kerb line north, the junction, the west lane south, the west kerb line, a shop window
  // the city's own (start=city, at Grand Ave): up Grand Ave's east kerb (its lamps, its hydrant, the tram stop's sign),
  // east along Centre St, south down Hester St's west pavement through the Tenements' market (its stalls)
  city: [[-112.2, 30], [-110.1, 25], [-110.1, -19], [-107.6, -25], [-100, -26.6], [140, -26.6], [160, -26.6], [308, -26.6], [317, -24.5], [322, -19], [322, 22], [322.4, 27]],
  bed: [[-112.2, 30], [-110.1, 25.5], [-110.1, 10], [-110.1, -21], [-111.6, -26], [-116, -30.2], [-121, -31.2], [-125.4, -28.5], [-126.8, -22], [-126.8, -6], [-128.3, 0.5], [-130.6, 5], [-130.6, 20], [-130.6, 44.2], [-131.6, 47.4], [-132.6, 47.45]],
};

export default async function o6(api) {
  const m = api.opts.mode;
  if (m === 'shoot') return shoot(api);
  if (m === 'burn') return burn(api);
  if (m === 'tram') return tram(api);
  if (m === 'latency') return latency(api);
  if (m === 'memory') return memory(api);
  if (m === 'walkinto') return walkInto(api);
  return drive(api);
}

// ---- walk into what lies: a stall, a newsstand, a bench over on the pavement stops a man ---------------------------
async function walkInto(api) {
  const { js, log, sleep, keyDown, keyUp, turn, opts } = api;
  const out = [];
  const kinds = opts.kinds || ['stall', 'newsstand', 'bench', 'callbox'];
  for (const kind of kinds) {
    const L = await js(`(() => { const S = G.stage.smash, C = N.controller; let best = null, bd = 1e9; for (const it of S.out) { if (it.kind !== '${kind}' || !it.lie || it.state !== 'rest') continue; const d = Math.hypot(it.lie.cx - C.pos.x, it.lie.cz - C.pos.z); if (d < bd) { bd = d; best = it; } } if (!best) return null; const b = best.lie; return { cx: b.cx, cz: b.cz, hx: b.hx, hz: b.hz, c: b.c, s: b.s, id: best.id }; })()`);
    if (!L) { out.push({ kind, err: 'none lying' }); continue; }
    // (from 3.5 m off its long side, straight through its middle)
    const nx = L.s, nz = L.c;    // (the box's local z in the world: its short side's normal)
    const from = [L.cx + nx * (L.hz + 3), L.cz + nz * (L.hz + 3)], to = [L.cx - nx * (L.hz + 3), L.cz - nz * (L.hz + 3)];
    await walkTo(api, from[0], from[1], 15000);
    // face it, then W held at it for 3 s; the eye checked every frame
    await js(`(() => { const W = window.__o6in = { min: 9, inside: 0 }; const b = G.stage.smash.items.find((i) => i.id === ${L.id}).lie; const tick = () => { const p = N.controller.pos; const dx = p.x - b.cx, dz = p.z - b.cz; const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c; const d = Math.max(Math.abs(lx) - b.hx, Math.abs(lz) - b.hz); W.min = Math.min(W.min, d); if (d < -0.05) W.inside++; if (!W.stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
    const s = await js(`(() => { const C = N.controller; let d = Math.atan2(-(${to[0]} - C.pos.x), -(${to[1]} - C.pos.z)) - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return { dyaw: d, sens: C.sensitivity }; })()`);
    await turn(-s.dyaw / s.sens, 0);
    await sleep(100);
    await keyDown('KeyW'); await sleep(3000); await keyUp('KeyW');
    const r = await js('(() => { const W = window.__o6in; W.stop = true; return { min: +W.min.toFixed(2), inside: W.inside }; })()');
    out.push({ kind, ...r });
    log(`walk into the ${kind}: ${JSON.stringify(r)}`);
  }
  return { walks: out };
}

// ---- driving a path by the keys ------------------------------------------------------------------------
async function followPath({ js, keyDown, keyUp, log, sleep }, path, { speed = 9, timeout = 120000, onStep = null, stopAt = null } = {}) {
  const T0 = Date.now();
  // (densify every 1.5 m)
  const P = [];
  for (let i = 0; i + 1 < path.length; i++) { const [ax, az] = path[i], [bx, bz] = path[i + 1]; const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 1.5)); for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
  P.push(path[path.length - 1]);
  const held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } };
  let idx = 0, stuckT = 0, revUntil = 0, last = Date.now();
  const rec = { reverses: 0, end: null, maxKmh: 0 };
  for (;;) {
    const now = Date.now(), dt = (now - last) / 1000; last = now;
    if (now - T0 > timeout) { rec.end = 'timeout'; break; }
    const s = await js(`(() => { const c = G.city.car; return { x: c.pos.x, z: c.pos.z, yaw: c.yaw, v: c.speed, inCar: G.city.inCar, failing: !!G.failing, wrecked: !!c.wrecked, dmg: c.damage, clog: c.stats.log ? c.stats.log.slice(-3) : [] }; })()`);
    if (!s || s.__exc) { await sleep(40); continue; }
    if (s.failing || !s.inCar || s.wrecked) { rec.end = s.failing ? 'failed' : s.wrecked ? 'wrecked' : 'out'; break; }
    rec.maxKmh = Math.max(rec.maxKmh, Math.abs(s.v) * 3.6);
    if (s.dmg !== rec._d) { rec._d = s.dmg; (rec.trace || (rec.trace = [])).push([+s.x.toFixed(1), +s.z.toFixed(1), +(s.v * 3.6).toFixed(0), +s.dmg.toFixed(2), JSON.stringify(s.clog[s.clog.length - 1] || '')]); }
    let best = idx, bd = Infinity;
    for (let k = idx; k < Math.min(P.length, idx + 14); k++) { const d = Math.hypot(P[k][0] - s.x, P[k][1] - s.z); if (d < bd) { bd = d; best = k; } }
    idx = best;
    if (onStep) await onStep(s, idx, P);
    if (idx >= P.length - 2 || (stopAt != null && idx >= stopAt)) { rec.end = 'done'; break; }
    const look = Math.min(P.length - 1, idx + Math.round((3.5 + Math.abs(s.v) * 0.35) / 1.5));
    const [tx, tz] = P[look];
    const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw);
    const ang = Math.atan2(fx * (tz - s.z) - fz * (tx - s.x), fx * (tx - s.x) + fz * (tz - s.z));
    // (the corner ahead: slower into it)
    const a0 = P[Math.min(P.length - 1, idx + 1)], a1 = P[Math.min(P.length - 1, idx + 4)], a2 = P[Math.min(P.length - 1, idx + 8)];
    const h1 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), h2 = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
    const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    const target = turn > 0.7 ? 5 : turn > 0.3 ? 7 : speed;
    if (Math.abs(s.v) < 0.6 && held.has('KeyW')) stuckT += dt; else stuckT = 0;
    if (stuckT > 2.0) { revUntil = now + 1100; stuckT = 0; rec.reverses++; log(`  stuck at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}): backing off`); }
    if (now < revUntil) { await set('KeyW', false); await set('KeyS', true); await set('KeyA', ang > 0); await set('KeyD', ang < 0); await sleep(30); continue; }
    const on = Math.abs(ang) > 0.04;
    await set('KeyD', on && ang > 0);
    await set('KeyA', on && ang < 0);
    const wide = Math.abs(ang) > 1.1;
    await set('KeyW', wide ? s.v < 2.5 : s.v < target - 0.4);
    await set('KeyS', s.v > target + 2.5 || (wide && s.v > 4));
    await sleep(25);
  }
  for (const c of [...held]) await set(c, false);
  rec.idx = idx; rec.n = P.length;
  return rec;
}

// the page's watch over the set: every frame, is the car inside a standing thing; at the end, nothing floating
async function installWatch(js) {
  await js(`(() => {
    if (window.__o6w) return 1;
    const W = window.__o6w = { frames: 0, inside: [], over50: 0, maxMs: 0, last: performance.now(), on: true };
    const S = G.stage.smash;
    const tick = () => {
      const t = performance.now(), dt = t - W.last; W.last = t;
      if (W.on) {
        W.frames++; if (dt > 50) W.over50++; if (dt > W.maxMs) W.maxMs = dt;
        // (a car's box over a standing thing that is not giving this frame: passed through)
        for (const v of G.vehicles.list) {
          if (v.kind === 'tram') continue;
          for (const it of S.near(v.pos.x, v.pos.z, 4)) {
            if (it.state !== 'stand' || it.K.high || it.K.pane) continue;
            const r = it.K.round ? it.K.r * 0.5 : 0;
            const ok = it.K.round ? v.overlaps(new v.pos.constructor(it.x, v.pos.y + 0.5, it.z), -it.K.r * 0.5 + 0.05, -1, 3)
              : S.boxOverlap(v, it.x, it.z, Math.max(0.01, it.fp.hx - 0.15), Math.max(0.01, it.fp.hz - 0.15), it.yaw);
            if (ok && W.inside.length < 20) W.inside.push([it.kind, it.id, +it.x.toFixed(1), +it.z.toFixed(1), +v.speedAbs.toFixed(1)]);
            void r;
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return 1; })()`);
}
// what lies: everything out of its merge at rest, nothing floating, nothing inside a wall
const RESTING = `(() => {
  const S = G.stage.smash, C = G.stage.colliders;
  const out = { out: S.out.length, live: 0, rest: 0, floating: [], inWall: [], pieces: S.pieces.count, piecesLive: S.pieces.live.length };
  for (const it of S.out) {
    if (!it.body || it.gone) continue;
    if (it.state === 'live') { out.live++; (out.liveL || (out.liveL = [])).push([it.kind, +it.t.toFixed(1), it.body.lean ? 'lean' : +it.body.v.length().toFixed(2), it.body.lean ? +it.body.ang.toFixed(2) : +it.body.w.length().toFixed(2), +it.body.p.y.toFixed(2)]); continue; }
    out.rest++;
    if (it.body.lean) continue;
    // its lowest corner against the ground under it
    let low = Infinity;
    const b = it.body;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const r = new b.p.constructor(sx * b.e.x, sy * b.e.y, sz * b.e.z).applyQuaternion(it.Q); const g = G.stage.surfaceY(b.p.x + r.x, b.p.z + r.z); low = Math.min(low, b.p.y + r.y - g); }
    if (Math.abs(low) > 0.06) out.floating.push([it.kind, +low.toFixed(3)]);
    for (const o of C.near(b.p.x, b.p.z, 1)) { if (o.r != null || o.gone || o.tag !== 'wall') continue; const dx = b.p.x - o.cx, dz = b.p.z - o.cz; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx - 0.1 && Math.abs(lz) < o.hz - 0.1) out.inWall.push([it.kind]); }
  }
  return out; })()`;

// ---- drive: through the bed's whole set -------------------------------------------------------------------
async function drive(api) {
  const { js, keyDown, keyUp, log, sleep, shot, opts } = api;
  await installWatch(js);
  // into the coupe: the start faces it
  const s0 = await js('({ inCar: G.city.inCar, n: G.stage.smash.items.length })');
  log(`drive: ${s0.n} items registered`);
  if (!s0.inCar) { await keyDown('KeyE'); await sleep(70); await keyUp('KeyE'); await sleep(1000); }
  if (!(await js('G.city.inCar'))) return { err: 'E did not take the coupe' };
  await js('(window.__o6w.frames = 0, window.__o6w.over50 = 0, window.__o6w.maxMs = 0, window.__o6w.inside = [], 1)');
  let shotN = 0;
  const shots = opts.shots || {};
  const r = await followPath(api, (typeof opts.path === 'string' ? PATHS[opts.path] : opts.path) || PATHS.bed, { speed: opts.speed ?? 9.5, timeout: opts.timeout ?? 150000, onStep: async (s, idx) => {
    for (const [k, name] of Object.entries(shots)) if (idx >= +k && !shots['_' + k]) { shots['_' + k] = 1; await js('(window.__o6w.on = false, 1)'); await shot(name); shotN++; await js('(window.__o6w.last = performance.now(), window.__o6w.on = true, 1)'); }
  } });
  log(`drive: ${JSON.stringify(r)}`);
  // (the path's end: on into what is ahead - the shop window - W held a moment more)
  if (opts.into && r.end === 'done') { await keyDown('KeyW'); await sleep(opts.into); await keyUp('KeyW'); await keyDown('KeyS'); await sleep(400); await keyUp('KeyS'); }
  // let it all come to rest
  await sleep(opts.settle ?? 4000);
  const res = await js(`(() => {
    const S = G.stage.smash, W = window.__o6w;
    const kinds = {};
    for (const e of S.events) if (e.by === 'car' && (e.what === 'over' || e.what === 'break')) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    const c = G.city.car;
    return { lastFail: G.lastFail || null, kinds, frames: W.frames, over50: W.over50, maxMs: +W.maxMs.toFixed(0), inside: W.inside, stats: { ...S.stats }, damage: +c.damage.toFixed(2), corners: c.smashD ? Object.fromEntries(Object.entries(c.smashD.corners).map(([k, v]) => [k, +v.toFixed(2)])) : null, state: c.smashD ? c.smashD.state : null, log: c.stats.log ? c.stats.log.slice(0, 8) : [] };
  })()`);
  const rest = await js(RESTING);
  return { ...r, ...res, rest };
}

// ---- shoot: every kind answers a round ---------------------------------------------------------------------------
// aim the eye at a world point by trusted mouse moves (the controller's sensitivity), then a burst
async function aimAt({ js, turn, sleep }, p) {
  for (let k = 0; k < 6; k++) {
    const s = await js(`(() => { const C = N.controller, e = G.camera.position; const dx = ${p[0]} - e.x, dy = ${p[1]} - e.y, dz = ${p[2]} - e.z; const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz)); let dyaw = yaw - C.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); return { dyaw, dpitch: pitch - C.pitch, sens: C.sensitivity }; })()`);
    if (Math.abs(s.dyaw) < 0.004 && Math.abs(s.dpitch) < 0.004) return true;
    const px = -s.dyaw / s.sens, py = -s.dpitch / s.sens;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(px), Math.abs(py)) / 60));
    for (let i = 0; i < n; i++) { await turn(px / n, py / n); await sleep(16); }
    await sleep(60);
  }
  return false;
}
async function burst(api, ms = 220) {
  const { mouse, sleep, cursor } = api;
  const [x, y] = cursor();
  await mouse('mousePressed', x, y, 'left'); await sleep(ms); await mouse('mouseReleased', x, y, 'left');
  await sleep(250);
}
async function walkTo({ js, keyDown, keyUp, sleep, turn }, x, z, timeout = 12000) {
  const T0 = Date.now();
  await keyDown('KeyW');
  for (;;) {
    const s = await js(`(() => { const C = N.controller; const dx = ${x} - C.pos.x, dz = ${z} - C.pos.z; let d = Math.atan2(-dx, -dz) - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return { d: Math.hypot(dx, dz), dyaw: d, sens: C.sensitivity }; })()`);
    if (s.d < 0.6 || Date.now() - T0 > timeout) break;
    if (Math.abs(s.dyaw) > 0.05) await turn(-s.dyaw / s.sens * 0.7, 0);
    await sleep(40);
  }
  await keyUp('KeyW');
  await sleep(200);
}
async function shoot(api) {
  const { js, log, sleep, shot, opts, keyDown, keyUp } = api;
  // the targets: each kind of the bed, from where I stand on the east pavement (x, y, z of the aim, kind)
  const T = opts.targets || [
    { kind: 'lamp', aim: 'head', id: [-110.3, 14], from: [-116.5, 27] },
    { kind: 'hydrant', at: [-110.45, 0.55, 20.6] },
    { kind: 'newsstand', at: [-109.9, 1.2, 24.0], n: 1 },
    { kind: 'crate', at: [-110.15, 0.3, 15.35], n: 2 },
    { kind: 'stall', at: [-109.9, 1.0, 17.6], n: 3 },
    { kind: 'callbox', at: [-110.4, 1.5, 6.5], from: [-116.5, 4] },
    { kind: 'bin', at: [-110.35, 0.6, 3.4] },
    { kind: 'bench', at: [-109.95, 0.6, 1.2] },
    { kind: 'stop', at: [-110.5, 2.3, -13.3], n: 3, from: [-116.5, -8] },
    { kind: 'fence', at: [-107.6, 1.0, -18.6], n: 3 },
    { kind: 'glass', at: [-133.9, 1.5, 17.0], from: [-127.4, 19.5] },
    { kind: 'awning', at: [-133.4, 3.1, 27.0], n: 3 },
    { kind: 'namesign', at: [-129.8, 2.5, 50.2], n: 3, from: [-127.4, 40] },
    { kind: 'car', at: 'sedan', n: 3, from: [-125.6, 16.5] },
  ];
  const res = {};
  let from = null;
  for (const t of T) {
    if (t.from && (!from || from[0] !== t.from[0] || from[1] !== t.from[1])) { await walkTo(api, t.from[0], t.from[1]); from = t.from; }
    let p = t.at;
    if (t.aim === 'head') p = await js(`(() => { const l = G.stage.lamps.all.find((l) => Math.abs(l.x - ${t.id[0]}) < 0.1 && Math.abs(l.z - ${t.id[1]}) < 0.1); return l ? [l.head.x, l.head.y - 0.12, l.head.z] : null; })()`);
    if (p === 'sedan') p = await js('(() => { const c = G.city.cars[2], f = c.fwd; return [c.pos.x + f.x * 1.7, 0.75, c.pos.z + f.z * 1.7]; })()');
    if (!p) { res[t.kind] = 'no target'; continue; }
    const before = await js('G.stage.smash.events.length');
    const ok = await aimAt(api, p);
    for (let k = 0; k < (t.n || 1); k++) { await burst(api, t.burst || 120); if (await js('G.weapon && G.weapon.ammo < 8')) { await keyDown('KeyR'); await sleep(60); await keyUp('KeyR'); await sleep(2600); } }
    await sleep(500);
    const ev = await js(`G.stage.smash.events.slice(${before}).map((e) => e.kind + ':' + e.what)`);
    // (the shop glass answers through its pane, the sedan through its own record)
    if (t.kind === 'glass') ev.push(...(await js(`G.stage.smash.items.filter((i) => i.kind === 'glass' && i.pane && i.pane.state !== 'whole').map((i) => 'glass:' + i.pane.state)`)));
    if (t.kind === 'car') ev.push(await js(`(() => { const D = G.city.cars[2].smashD; return D ? 'car:' + D.state + ':tyres ' + D.tyres.join('') + ':lamps ' + D.lampOut.map(Number).join('') : 'car:none'; })()`));
    res[t.kind] = { aimed: ok, ev: [...new Set(ev)] };
    if (opts.shots && opts.shots[t.kind]) await shot(opts.shots[t.kind]);
    log(`shoot ${t.kind}: ${JSON.stringify(res[t.kind])}`);
  }
  const state = await js(`(() => { const S = G.stage.smash; const o = {}; for (const it of S.items) { if (it.state === 'stand' && !it.dark && !it.torn && !(it.pane && it.pane.state !== 'whole')) continue; o[it.kind] = (o[it.kind] || 0) + 1; } const sd = G.city.cars[2].smashD; return { changed: o, sedan: sd ? { tyres: sd.tyres, lampOut: sd.lampOut, damage: +G.city.cars[2].damage.toFixed(2) } : null, shot: S.stats.shot }; })()`);
  return { res, ...state };
}

// ---- burn: the sedan to its wreck ------------------------------------------------------------------------------------
async function burn(api) {
  const { js, log, sleep, shot, opts, keyDown, keyUp } = api;
  const rec = { t: [] };
  if (opts.from) await walkTo(api, opts.from[0], opts.from[1]);
  const T0 = Date.now();
  const st = async () => js('(() => { const c = G.city.cars[2], D = c.smashD; return { dmg: +c.damage.toFixed(2), state: D ? D.state : null, fuse: D && D.fuse != null ? +D.fuse.toFixed(1) : null, wreck: !!c.wrecked, fires: G.stage.cars.fires.length, fail: !!G.failing, hp: G.health.hp }; })()');
  // into its bonnet from across the road until it burns
  for (let k = 0; k < 20; k++) {
    const s = await st();
    if (s.state === 'burning' || s.wreck) break;
    const p = await js('(() => { const c = G.city.cars[2]; const f = c.fwd; return [c.pos.x + f.x * 1.7, 0.85, c.pos.z + f.z * 1.7]; })()');
    await aimAt(api, p);
    await burst(api, 250);
    if (await js('G.weapon && G.weapon.ammo < 10')) { await keyDown('KeyR'); await sleep(60); await keyUp('KeyR'); await sleep(2600); }
  }
  let s = await st();
  rec.t.push(['burning', +((Date.now() - T0) / 1000).toFixed(1), s]);
  log(`burn: ${JSON.stringify(s)}`);
  if (opts.shots && opts.shots.burning) await shot(opts.shots.burning);
  // back off (S) and watch it go
  await keyDown('KeyS'); await sleep(1600); await keyUp('KeyS');
  for (let k = 0; k < 40; k++) {
    s = await st();
    if (s.wreck) break;
    await sleep(250);
  }
  rec.t.push(['wreck', +((Date.now() - T0) / 1000).toFixed(1), s]);
  if (opts.shots && opts.shots.blast) await shot(opts.shots.blast);
  await sleep(opts.after ?? 3000);
  if (opts.shots && opts.shots.wreck) await shot(opts.shots.wreck);
  rec.end = await st();
  rec.events = await js('G.stage.smash.events.filter((e) => e.by === \'blast\').length');
  return rec;
}

// ---- tram: sparks on the car in its way ---------------------------------------------------------------------------------
async function tram(api) {
  const { js, sleep, shot, opts, log } = api;
  const T0 = Date.now();
  let first = null;
  for (;;) {
    const s = await js('(() => { const C = G.stage.smash.cars, c = G.city.cars[2]; return { sparks: C.sparkCount || 0, tz: +G.city.tram.pos.z.toFixed(1), cz: +c.pos.z.toFixed(1), cx: +c.pos.x.toFixed(1), dmg: +c.damage.toFixed(2) }; })()');
    if (s.sparks && !first) { first = s; log(`tram: first sparks ${JSON.stringify(s)}`); if (opts.shots && opts.shots.sparks) await shot(opts.shots.sparks); }
    if (first && Date.now() - T0 > 2500 + (first ? 0 : 0) && s.tz > first.tz + 8) return { first, last: s };
    if (Date.now() - T0 > (opts.timeout ?? 20000)) return { first, last: s, err: 'timeout' };
    await sleep(100);
  }
}

// ---- latency: a round's first frame, a car's ------------------------------------------------------------------------------
async function latency(api) {
  const { js, mouse, sleep, cursor, log, keyDown, keyUp, opts } = api;
  if (opts.from) await walkTo(api, opts.from[0], opts.from[1]);
  await sleep(400);
  // a round at the bin: the trusted press to the first frame the bin left its place
  await aimAt(api, [-110.35, 0.6, 3.4]);
  await js(`(() => { const L = window.__lat = { key: 0, frame: 0 }; const S = G.stage.smash; const it = S.items.find((i) => i.kind === 'bin' && Math.abs(i.x + 110.35) < 0.01 && Math.abs(i.z - 3.4) < 0.01);
    addEventListener('mousedown', () => { if (!L.key) L.key = performance.now(); }, { capture: true, once: true });
    const s0 = G.counters.shots;
    const tick = () => { if (L.key && !L.shot && G.counters.shots > s0) { L.shot = performance.now(); L.shots = G.counters.shots - s0; } if (L.key && it.state !== 'stand' && !L.frame) { L.frame = performance.now(); L.shotsAt = G.counters.shots - s0; return; } if (!L.frame) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
  const [x, y] = cursor();
  await mouse('mousePressed', x, y, 'left'); await sleep(90); await mouse('mouseReleased', x, y, 'left');
  await sleep(700);
  const round = await js('(() => { const L = window.__lat; return { ms: L.frame && L.key ? +(L.frame - L.key).toFixed(1) : null, shotMs: L.shot && L.key ? +(L.shot - L.key).toFixed(1) : null, roundsTo: L.shotsAt }; })()');
  log(`latency round: ${JSON.stringify(round)}`);
  // a car into a crate: the frame it met it (its state changed) is the frame drawn moving (the step's own: 0 frames)
  return { round };
}

// ---- memory: a hundred over and mended, cycles times ------------------------------------------------------------------------
async function memory(api) {
  const { js, sleep, log, opts } = api;
  const read = async () => js('(() => { if (window.gc) window.gc(); const m = performance.memory; const R = N.renderer.info.memory; return { heap: m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : null, geo: R.geometries, tex: R.textures, out: G.stage.smash.out.length, pieces: G.stage.smash.pieces.count, solids: G.stage.solids.length, rays: G.rays.entries.length }; })()');
  const out = [await read()];
  const n = opts.cycles ?? 100;
  for (let k = 0; k < n; k++) {
    await js(`(() => { const S = G.stage.smash; for (const r of G.stage._hundred.recs) { const it = S.itemOf(r); if (it && it.state === 'stand') S.hit(it, null, new it.P.constructor((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12), 'blast'); } return 1; })()`);
    await sleep(opts.hold ?? 700);
    await js('(G.stage.smash.mendAll(), 1)');
    if ((k + 1) % 25 === 0) { await sleep(300); const r = await read(); out.push(r); log(`memory after ${k + 1}: ${JSON.stringify(r)}`); }
  }
  return { reads: out };
}
