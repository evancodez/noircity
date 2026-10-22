// [O1] NOIR CITY's proofs by real input (tools/play.mjs's module driver):
//   { "drive": "tools/lib/o1_city.mjs", "mode": "drive" | "latency" | "walk" | "loops", ... }
// drive    a driver drives a loop through every district by the keys a player
//          presses (W / S / A / D, SPACE): the route from the road graph
//          (stage.part('city').graph.route) between the districts' points,
//          kept to the right lane, pure pursuit on the keys; returns the
//          record: the frames over 50 ms, the chunks missing near the eye, the
//          chunks built late (close to the eye), the crashes, inside a wall
//          or not, the districts reached, the time.
// latency  W on foot (the first frame the eye moves), E into the car, W in the
//          car (the first frame it moves), A (the first frame the wheel turns):
//          ms from the trusted key event to the frame, and frames
// walk     the jank walk: into the walls, kerbs, pillars, doors, stalls of one
//          block in each district (on foot, by the keys): every walk is
//          stopped by what is there (the eye never ends inside a wall's box)
// loops    the streaming test: drive opts.loops loops (or opts.secs) and read
//          the JS heap and the renderer's memory (geometries, textures) after each
// opts: { mode, timeout, points?: [[x, z]...], secs, loops }
const DISTRICTS = [
  ['downtown', [-30, -115]], ['tenements', [240, -30]], ['river', [432, -200]], ['hill', [330, -420]],
  ['hill', [-300, -480]], ['yards', [-450, -100]], ['yards', [-450, 300]], ['docks', [-200, 330]],
  ['docks', [100, 432]], ['tenements', [150, 200]], ['downtown', [-112, 60]],
];

export default async function city(api) {
  const { opts } = api;
  if (opts.mode === 'latency') return latency(api);
  if (opts.mode === 'walk') return walkJank(api);
  return drive(api);
}

// ---- the page's recorders ------------------------------------------------------------------------
async function installRecorder(js) {
  await js(`(() => {
    if (window.__o1rec) return 1;
    const R = window.__o1rec = { n: 0, over50: 0, max: 0, last: performance.now(), dts: [], missing: 0, late: [], samples: 0, inWall: 0, on: true };
    const st = G.stage.part('stream');
    // (a chunk attached while the eye is close to it: the build came late)
    const att = st.loaded.set.bind(st.loaded);
    st.loaded.set = (k, v) => { const [i, j] = k.split(',').map(Number); const p = G.camera.position, C = 96;
      const cx = Math.max(i * C, Math.min((i + 1) * C, p.x)), cz = Math.max(j * C, Math.min((j + 1) * C, p.z));
      const d = Math.hypot(cx - p.x, cz - p.z); if (R.on && d < 110) R.late.push([k, +d.toFixed(0)]); return att(k, v); };
    const tick = () => {
      const t = performance.now(), dt = t - R.last; R.last = t;
      if (R.on) {
        R.n++; if (dt > R.max) R.max = dt; if (dt > 50) { R.over50++; R.dts.push(+dt.toFixed(0)); }
        // (every chunk within 100 m of the eye is built)
        const p = G.camera.position, C = 96;
        for (let i = Math.floor((p.x - 100) / C); i <= Math.floor((p.x + 100) / C); i++) for (let j = Math.floor((p.z - 100) / C); j <= Math.floor((p.z + 100) / C); j++) {
          const k = i + ',' + j; if (!st.index.has(k)) continue;
          const cx = Math.max(i * C, Math.min((i + 1) * C, p.x)), cz = Math.max(j * C, Math.min((j + 1) * C, p.z));
          if (Math.hypot(cx - p.x, cz - p.z) < 100 && !st.loaded.has(k)) R.missing++;
        }
        R.samples++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return 1; })()`);
}

// ---- the drive-through -------------------------------------------------------------------------------
async function drive({ js, keyDown, keyUp, log, sleep, shot, opts }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 600000;
  await installRecorder(js);
  // get in if on foot
  const st0 = await js('({ inCar: G.city.inCar })');
  if (!st0.inCar) { await keyDown('KeyE'); await sleep(60); await keyUp('KeyE'); await sleep(900); }
  await js('(window.__o1rec.n = 0, window.__o1rec.over50 = 0, window.__o1rec.max = 0, window.__o1rec.dts = [], window.__o1rec.missing = 0, window.__o1rec.late = [], window.__o1rec.samples = 0, 1)');
  const pts = opts.points || DISTRICTS.map((d) => d[1]);
  // the path: the graph's routes between the points, the right lane kept
  const path = await js(`(() => {
    const g = G.stage.part('city').graph, c = G.city.car;
    // (each point onto its street's middle line: the lane is laid off that)
    const snap = ([x, z]) => { const S = g.streetAt(x, z); return S ? [S.edge.ax + S.edge.dx * S.s, S.edge.az + S.edge.dz * S.s] : [x, z]; };
    const P = [[c.pos.x, c.pos.z], ...${JSON.stringify(pts)}].map(snap);
    const out = [];
    for (let i = 0; i + 1 < P.length; i++) {
      const r = g.route({ x: P[i][0], z: P[i][1] }, { x: P[i + 1][0], z: P[i + 1][1] });
      if (!r) return { err: 'no route ' + i };
      for (let k = 0; k < r.pts.length; k++) { const p = r.pts[k]; if (out.length && Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) < 1) continue; out.push(p); }
    }
    // (densify every 3 m, then the right lane: 2 m to the right of the way)
    const D = [];
    for (let i = 0; i + 1 < out.length; i++) { const [ax, az] = out[i], [bx, bz] = out[i + 1]; const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < n; k++) D.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
    D.push(out[out.length - 1]);
    // (under the el the lane outside the columns: between them and the kerb)
    const R = [];
    for (let i = 0; i < D.length; i++) {
      const a = D[Math.max(0, i - 2)], b = D[Math.min(D.length - 1, i + 2)]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const S = g.streetAt(D[i][0], D[i][1]);
      const off = S && S.edge.el && S.d < 1 ? (S.edge.hw + 4.56) / 2 : 2.0;
      R.push([D[i][0] - dz / L * off, D[i][1] + dx / L * off]);
    }
    return R; })()`);
  if (!path || path.err) return { err: path && path.err };
  log(`drive: path ${path.length} points (${(path.length * 3 / 1000).toFixed(2)} km)`);
  const held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } };
  let idx = 0, stuckT = 0, revUntil = 0, lastT = Date.now();
  const rec = { reached: [], crashes: 0, scrapes: 0, kerbs: 0, maxKmh: 0, reverses: 0, inWall: 0 };
  const visited = new Set();
  for (;;) {
    const now = Date.now(), dt = (now - lastT) / 1000; lastT = now;
    if (now - T0 > timeout) { rec.end = 'timeout'; break; }
    const s = await js(`(() => { const c = G.city.car, C = G.stage.part('city').C; const col = G.stage.colliders;
      let inWall = false; for (const o of col.near(c.pos.x, c.pos.z, 1)) { if (o.r != null || o.tag !== 'wall') continue; const dx = c.pos.x - o.cx, dz = c.pos.z - o.cz; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx - 0.2 && Math.abs(lz) < o.hz - 0.2) inWall = true; }
      const d = C.cellAt(c.pos.x, c.pos.z);
      return { x: c.pos.x, z: c.pos.z, yaw: c.yaw, v: c.speed, crashes: c.stats.crashes, scrapes: c.stats.scrapes, inCar: G.city.inCar, failing: !!G.failing, inWall, dist: d ? d.district : null }; })()`);
    if (!s || s.__exc) { await sleep(50); continue; }
    if (s.failing || !s.inCar) { for (const c of [...held]) await set(c, false); rec.end = s.failing ? 'failed' : 'out'; break; }
    if (s.dist) visited.add(s.dist);
    if (s.inWall) rec.inWall++;
    rec.crashes = s.crashes; rec.scrapes = s.scrapes; rec.maxKmh = Math.max(rec.maxKmh, Math.abs(s.v) * 3.6);
    // progress along the path: the nearest point ahead of where we were
    let best = idx, bd = Infinity;
    for (let k = idx; k < Math.min(path.length, idx + 40); k++) { const d = Math.hypot(path[k][0] - s.x, path[k][1] - s.z); if (d < bd) { bd = d; best = k; } }
    if (Math.floor(best / 100) > Math.floor(idx / 100)) log(`  at ${best}/${path.length} (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) ${s.dist} ${(Math.abs(s.v) * 3.6).toFixed(0)} km/h, crashes ${s.crashes}`);
    idx = best;
    if (idx >= path.length - 3) { rec.end = 'done'; break; }
    // the look-ahead point (further at speed)
    const look = Math.min(path.length - 1, idx + Math.round((6 + Math.abs(s.v) * 0.6) / 3));
    const [tx, tz] = path[look];
    const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw);
    const ang = Math.atan2(fx * (tz - s.z) - fz * (tx - s.x), fx * (tx - s.x) + fz * (tz - s.z));
    // (ang + : the target is to the right of the nose in x-z with z south -> steer right (D))
    // the corner ahead: the turn over the next 30 m
    const a0 = path[Math.min(path.length - 1, idx + 2)], a1 = path[Math.min(path.length - 1, idx + 6)], a2 = path[Math.min(path.length - 1, idx + 12)];
    const h1 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), h2 = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
    let turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    const target = turn > 0.9 ? 6.5 : turn > 0.4 ? 10 : 17;
    // stuck: no speed for a while with the throttle on -> back off a little, steering the other way
    if (Math.abs(s.v) < 0.8 && held.has('KeyW')) stuckT += dt; else stuckT = 0;
    if (stuckT > 2.5) { revUntil = now + 1400; stuckT = 0; rec.reverses++; log(`  stuck at (${s.x.toFixed(0)}, ${s.z.toFixed(0)}): backing off`); }
    if (now < revUntil) {
      await set('KeyW', false); await set('KeyS', true);
      await set('KeyA', ang > 0); await set('KeyD', ang < 0);
      await sleep(30); continue;
    }
    const steerOn = Math.abs(ang) > 0.05;
    await set('KeyD', steerOn && ang > 0);
    await set('KeyA', steerOn && ang < 0);
    // (the way is behind or square to the nose: crawl round on full lock)
    const wide = Math.abs(ang) > 1.2;
    await set('KeyW', wide ? s.v < 3 : s.v < target - 0.5);
    await set('KeyS', s.v > target + 2.5 || (wide && s.v > 4));
    if (opts.shots && opts.shots[idx] && !rec['shot' + idx]) { rec['shot' + idx] = 1; await shot(opts.shots[idx]); }
    await sleep(25);
  }
  for (const c of [...held]) await set(c, false);
  const R = await js(`(() => { const R = window.__o1rec; return { frames: R.n, over50: R.over50, maxMs: +R.max.toFixed(1), dts: R.dts.slice(0, 20), missingSamples: R.missing, samples: R.samples, late: R.late.slice(0, 20), lateN: R.late.length, stream: { ...G.city.stream.stats }, mem: { ...N.renderer.info.memory } }; })()`);
  rec.districts = [...visited];
  rec.secs = +((Date.now() - T0) / 1000).toFixed(1);
  rec.km = +(idx * 3 / 1000).toFixed(2);
  return { ...rec, ...R };
}

// ---- the latency of the main verbs ------------------------------------------------------------------------
async function latency({ js, keyDown, keyUp, sleep, log }) {
  // the page stamps the key's arrival (a listener of the tool's, not the game's) and the first frame that moved
  const arm = async (what) => js(`(() => {
    const L = window.__lat = { what: ${JSON.stringify(what)}, key: 0, frame: 0, frames: 0 };
    const C = N.controller, car = G.city.car;
    const p0 = { x: C.pos.x, z: C.pos.z, cx: car.pos.x, cz: car.pos.z, steer: car.steer, yaw: C.yaw };
    const onKey = () => { if (!L.key) L.key = performance.now(); };
    addEventListener('keydown', onKey, { capture: true, once: true });
    const tick = () => {
      if (L.key) L.frames++;
      const moved = L.what === 'foot' ? Math.hypot(C.pos.x - p0.x, C.pos.z - p0.z) > 1e-4
        : L.what === 'car' ? Math.hypot(car.pos.x - p0.cx, car.pos.z - p0.cz) > 1e-4
        : Math.abs(car.steer - p0.steer) > 1e-4;
      if (L.key && moved) { L.frame = performance.now(); return; }
      if (performance.now() - (L.key || performance.now()) < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return 1; })()`);
  const read = async () => { await sleep(600); return js('(() => { const L = window.__lat; return { what: L.what, ms: L.frame && L.key ? +(L.frame - L.key).toFixed(1) : null, frames: L.frames }; })()'); };
  const out = {};
  await arm('foot'); await keyDown('KeyW'); out.foot = await read(); await keyUp('KeyW');
  await sleep(500);
  // into the car (the E prompt needs the car in front: turn to it by the scene's own look - the start faces it)
  await keyDown('KeyE'); await sleep(60); await keyUp('KeyE'); await sleep(1200);
  const inCar = await js('G.city.inCar');
  if (!inCar) { log('latency: E did not take the car'); return { ...out, err: 'not in the car' }; }
  await arm('car'); await keyDown('KeyW'); out.car = await read(); await sleep(800); await keyUp('KeyW');
  await arm('steer'); await keyDown('KeyA'); out.steer = await read(); await keyUp('KeyA');
  log(`latency: ${JSON.stringify(out)}`);
  return out;
}

// ---- the jank walk ---------------------------------------------------------------------------------------
// opts.walks: [{ name, from: [x, z], to: [x, z] }] - each a walk straight at
// something solid; the eye must stop short (never inside a wall's box) and
// the record says where it stopped and what stopped it
async function walkJank({ js, keyDown, keyUp, sleep, log, opts }) {
  const out = [];
  for (const w of opts.walks || []) {
    // stand at `from` facing `to` (a set-up between walks, as a tool's teleport; the walk itself is the keys)
    await js(`(() => { const [x, z] = ${JSON.stringify(w.from)}, [tx, tz] = ${JSON.stringify(w.to)}; G.stage.part('stream').warmAround(x, z); N.controller.setPose(x, z, Math.atan2(-(tx - x), -(tz - z)), 0); return 1; })()`);
    await sleep(300);
    await keyDown('KeyW'); if (w.run) await keyDown('ShiftLeft');
    await sleep(w.ms || 4000);
    if (w.run) await keyUp('ShiftLeft');
    await keyUp('KeyW');
    await sleep(200);
    const r = await js(`(() => { const C = N.controller, col = G.stage.colliders, [tx, tz] = ${JSON.stringify(w.to)};
      let inside = null; for (const o of col.near(C.pos.x, C.pos.z, 1)) { if (o.r != null) { if (Math.hypot(C.pos.x - o.x, C.pos.z - o.z) < o.r - 0.05) inside = o.tag; continue; } const dx = C.pos.x - o.cx, dz = C.pos.z - o.cz; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx - 0.05 && Math.abs(lz) < o.hz - 0.05) inside = o.tag; }
      let by = null, bd = 9; for (const o of col.near(C.pos.x, C.pos.z, 1.5)) { let d; if (o.r != null) d = Math.hypot(C.pos.x - o.x, C.pos.z - o.z) - o.r; else { const dx = C.pos.x - o.cx, dz = C.pos.z - o.cz; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; d = Math.hypot(Math.max(0, Math.abs(lx) - o.hx), Math.max(0, Math.abs(lz) - o.hz)); } if (d < bd) { bd = d; by = o.tag; } }
      return { at: [+C.pos.x.toFixed(2), +C.pos.z.toFixed(2)], left: +Math.hypot(tx - C.pos.x, tz - C.pos.z).toFixed(2), inside, by, gap: +bd.toFixed(2), y: +C.groundY.toFixed(2) }; })()`);
    out.push({ name: w.name, ...r });
    log(`  walk ${w.name}: stopped ${r.left} m short by ${r.by} (${r.gap} m), inside: ${r.inside}`);
  }
  return { walks: out, insideAny: out.filter((w) => w.inside).map((w) => w.name) };
}
