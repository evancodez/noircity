// [O6b] Car damage, physical: the proofs by real input (tools/play.mjs's module driver).
//   { "drive": "tools/lib/o6b_damage.mjs", "mode": "ram" | "parts" | "lookten", ... }
// ram     the havoc (?start=smash&beat=ten): E into my coupe, then ram the ten
//         cars parked along Grand Ave one after another by the keys a player
//         presses (W / S / A / D, pure pursuit to a run-up and into the car: a
//         rear head-on along a parking lane, or a diagonal into a door from the
//         lane under the el), back off, the next; up the east kerb, round the
//         junction at Centre St, down the west kerb. When my car is spent
//         (smoking, on a hub, burning) E out, walk to the next whole car, E in.
//         What each car shows after its blow is recorded (and the frames named
//         in opts.shots taken from the seat as it happens); at the end the
//         parts on the road: nothing floating, nothing in a wall, all at rest
// parts   on foot from where the havoc left me: into a door lying on the road
//         (it stops me), then a car (mine) driven over a door lying (it slows it)
const COLS_X = [-116.1, -123.9];

export default async function o6b(api) {
  const m = api.opts.mode;
  if (m === 'parts') return parts(api);
  if (m === 'hang') return hang(api);
  if (m === 'awnshot') return awnShot(api);
  if (m === 'awning') return awning(api);
  if (m === 'river') return river(api);
  if (m === 'memory') return memory(api);
  return ram(api);
}

// ---- the keys of a driver ---------------------------------------------------------------------------------
function holder({ keyDown, keyUp }) {
  const held = new Set();
  const set = async (code, on) => { if (on && !held.has(code)) { held.add(code); await keyDown(code); } else if (!on && held.has(code)) { held.delete(code); await keyUp(code); } };
  const none = async () => { for (const c of [...held]) await set(c, false); };
  return { set, none, held };
}
const ST = `(() => { const c = G.city.car; return { x: c.pos.x, z: c.pos.z, yaw: c.yaw, v: c.speed, inCar: G.city.inCar, failing: !!G.failing, dmg: c.damage, state: c.smashD ? c.smashD.state : null, hubs: c.smashD ? c.smashD.hub.reduce((a, b) => a + b, 0) : 0 }; })()`;

// pure pursuit along a path by the keys; `stop(s)` ends it early (a contact)
async function follow(api, path, { speed = 9, timeout = 40000, stop = null, slowAt = null, fastFrom = null } = {}) {
  const { js, sleep } = api;
  const K = holder(api);
  const P = [];
  let fastIdx = Infinity;
  for (let i = 0; i + 1 < path.length; i++) { if (i === fastFrom) fastIdx = P.length; const [ax, az] = path[i], [bx, bz] = path[i + 1]; const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 1.0)); for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
  P.push(path[path.length - 1]);
  const T0 = Date.now();
  let idx = 0, end = null, stuckT = 0, last = Date.now(), s = null, maxV = 0;
  for (;;) {
    const now = Date.now(), dt = (now - last) / 1000; last = now;
    if (now - T0 > timeout) { end = 'timeout'; break; }
    s = await js(ST);
    if (!s || s.__exc) { await sleep(30); continue; }
    if (s.failing || !s.inCar) { end = s.failing ? 'failed' : 'out'; break; }
    if (follow.outIfBurning && s.state === 'burning') { end = 'burning'; break; }   // ([O6b] warned: a player gets out)
    maxV = Math.max(maxV, Math.abs(s.v)); (follow.trace || (follow.trace = [])).push([idx, P.length, +s.v.toFixed(1), +s.x.toFixed(1), +s.z.toFixed(1)]); if (follow.trace.length > 60) follow.trace.shift();
    if (stop && (await stop(s))) { end = 'stop'; break; }
    let best = idx, bd = Infinity;
    for (let k = idx; k < Math.min(P.length, idx + 10); k++) { const d = Math.hypot(P[k][0] - s.x, P[k][1] - s.z); if (d < bd) { bd = d; best = k; } }
    idx = best;
    if (idx >= P.length - 2) { end = 'done'; break; }
    const look = Math.min(P.length - 1, idx + Math.round(4 + Math.abs(s.v) * 0.6));
    const [tx, tz] = P[look];
    const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw);
    const ang = Math.atan2(fx * (tz - s.z) - fz * (tx - s.x), fx * (tx - s.x) + fz * (tz - s.z));
    const a0 = P[Math.min(P.length - 1, idx + 1)], a1 = P[Math.min(P.length - 1, idx + 4)], a2 = P[Math.min(P.length - 1, idx + 8)];
    const h1 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), h2 = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
    const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    // (the corner ahead: slower into it - but never on the run into the blow)
    let target = idx >= fastIdx ? speed : turn > 0.7 ? 4.5 : turn > 0.3 ? 6.5 : speed;
    if (slowAt != null && idx < slowAt) target = Math.min(target, 7);
    if (Math.abs(s.v) < 0.5 && K.held.has('KeyW')) stuckT += dt; else stuckT = 0;
    if (stuckT > 2.5) { end = 'stuck'; break; }
    // (a hand on the wheel: a dead band that widens with the speed - held full lock at speed scrubs the car down to 8 m/s)
    const on = Math.abs(ang) > 0.03 + 0.012 * Math.abs(s.v);
    await K.set('KeyD', on && ang > 0);
    await K.set('KeyA', on && ang < 0);
    const wide = Math.abs(ang) > 1.1;
    await K.set('KeyW', wide ? s.v < 2.5 : s.v < target - 0.3);
    await K.set('KeyS', s.v > target + 2.5 || (wide && s.v > 4));
    await sleep(20);
  }
  await K.none();
  return { end, s, maxV };
}
// brake to a stand (S, then off before it reverses), then back off a few metres (S held)
async function brakeAndBack(api, backMs = 900) {
  const { js, keyDown, keyUp, sleep } = api;
  await keyDown('KeyS');
  for (let i = 0; i < 80; i++) { const s = await js(ST); if (!s || Math.abs(s.v) < 0.4) break; await sleep(30); }
  await keyUp('KeyS'); await sleep(120);
  if (backMs) { await keyDown('KeyS'); await sleep(backMs); await keyUp('KeyS'); await keyDown('KeyW'); await sleep(250); await keyUp('KeyW'); }
  await sleep(250);
}

// what a car shows now (the page's record of its parts)
const SHOWS = (expr) => `(() => { const v = ${expr}; const D = v && v.smashD; if (!D) return null; const st = [];
  const dents = Object.values(D.dents).reduce((a, b) => a + b, 0); if (dents) st.push('dent');
  if (D.hood && D.hood.pivot && D.hood.pivot.visible) st.push('bonnet'); if (D.hood && D.hood.off) st.push('bonnetOff');
  for (const d of D.doors) { if (d && d.pivot && d.pivot.visible) st.push('doorHang'); if (d && d.off) st.push('doorOff'); }
  for (const b of D.bumper) { if (b && b.pivot && b.pivot.visible) st.push('bumperDrag'); if (b && b.off) st.push('bumperOff'); }
  if (D.wob.some(Boolean)) st.push('wheelWobble'); if (D.hub.some(Boolean)) st.push('wheelOff');
  if (D.state === 'burning') st.push('burning'); if (D.state === 'wreck') st.push('wreck'); if (D.state === 'smoke' || D.state === 'steam') st.push(D.state);
  return { id: v.id, kind: v.kind, x: +v.pos.x.toFixed(1), z: +v.pos.z.toFixed(1), dmg: +v.damage.toFixed(2), st }; })()`;

// the havoc --------------------------------------------------------------------------------------------------
// targets: the ten parked (by where they were parked), the blow: 'rear' head-on along its parking lane, or 'door'
// a diagonal from under the el into its door
const MID = [37.85, 26.35, 14.85, 3.35, -8.15];   // (the gaps between the el's columns: the ten are parked there)
const PLAN = [
  // north, up the lane under the el: into each east car's door, a steep diagonal through the gap (the last one twice)
  { at: [-112.4, MID[0]], blow: 'door', name: 'east_sedan' },
  { at: [-112.4, MID[1]], blow: 'door', name: 'east_grey' },
  { at: [-112.9, MID[2] + 1.35], blow: 'door', name: 'east_truck', doorZ: MID[2] },
  { at: [-112.4, MID[3]], blow: 'door', name: 'east_grey2' },
  { at: [-112.4, MID[4]], blow: 'door', name: 'east_coupe', again: true },
  // round the junction at Centre St onto the west kerb, heading south
  { turn: [[-119.6, -16], [-120.2, -25], [-122.5, -31], [-126.2, -30.5], [-127.6, -25], [-127.6, -20]] },
  // south, down the west kerb: head-on into each one's tail, then by it between it and the columns
  { at: [-127.6, MID[4]], blow: 'rear', name: 'west_grey' },
  { at: [-127.6, MID[3]], blow: 'rear', name: 'west_sedan_bed' },
  { at: [-127.6, MID[2]], blow: 'rear', name: 'west_sedan' },
  { at: [-127.6, MID[1]], blow: 'rear', name: 'west_grey2' },
  { at: [-127.3, MID[0] - 1.0], blow: 'rear', name: 'lorry' },
];

async function ram(api) {
  const { js, log, sleep, keyDown, keyUp, shot, opts } = api;
  const out = { blows: [], swaps: 0, mine: [], end: null };
  const cars = await js(`G.city.cars.map((v) => ({ id: v.id, kind: v.kind, x: v.pos.x, z: v.pos.z, yaw: v.yaw, hl: v.spec.halfL, hw: v.spec.halfW }))`);
  const byAt = (at) => cars.reduce((b, c) => (!b || Math.hypot(c.x - at[0], c.z - at[1]) < Math.hypot(b.x - at[0], b.z - at[1]) ? c : b), null);
  const press = async (code) => { await keyDown(code); await sleep(70); await keyUp(code); };
  const into = async () => { await press('KeyE'); for (let i = 0; i < 60; i++) { if (await js('G.city.inCar')) return true; await sleep(100); } return false; };
  const corners = (id) => `Object.values(G.city.cars.find((c) => c.id === ${id}).smashD.corners).reduce((a, b) => a + b, 0)`;
  const where = (id) => js(`(() => { const v = G.city.cars.find((c) => c.id === ${id}); return { x: v.pos.x, z: v.pos.z, yaw: v.yaw }; })()`);
  if (!(await into())) { out.end = 'no car'; return out; }
  follow.outIfBurning = !!opts.untilFire;
  const shots = opts.shots || {};
  let southward = false, prev = null;
  for (const step of PLAN.slice(0, opts.n ?? PLAN.length)) {
    if (step.turn) {
      const s = await js(ST);
      const r = await follow(api, [[s.x, s.z], [-119.6, s.z - 4], ...step.turn], { speed: 6, timeout: 30000 });
      log(`  the turn at Centre St: ${r.end}`);
      southward = true; prev = null;
      continue;
    }
    const T = byAt(step.at);
    // my car spent (smoking, on a hub, burning): out, and into the nearest whole car (one already rammed first)
    const spent = async () => {
    const me = await js(ST);
    if (!me || me.failing) return 'failed';
    if (me.dmg >= (opts.untilFire ? 3.0 : 2.45) || me.hubs >= 1 || me.state === 'burning') {   // ([O6b] untilFire: a smoking car still drives - power 0.8 - on until it is near the fire)
      out.mine.push(await js(SHOWS('G.city.car')));
      if (me.state !== 'burning') await brakeAndBack(api, 0);   // (on fire: E at once - moving, E brakes and gets me out as she stops)
      await press('KeyE');
      for (let i = 0; i < 60; i++) { if (!(await js('G.city.inCar'))) break; await sleep(100); }
      await sleep(600);
      // (out of a burning car: away from it first - its blast reaches a man within 8 m)
      if (me.state === 'burning') { const p = await js('[N.controller.pos.x, N.controller.pos.z]'); await walkTo(api, p[0], p[1] + (southward ? -12 : 12), 6000, true); }
      const done = out.blows.map((b) => b.id);
      const todo = cars.filter((c) => PLAN.some((p) => p.at && byAt(p.at) === c) && !done.includes(c.id)).map((c) => c.id);   // (never a car still to be rammed)
      const pick = await js(`(() => { const C = N.controller.pos, done = ${JSON.stringify(done)}; let b = null, bd = 1e9; for (const v of G.city.cars) { if (v.wrecked || v === G.city.car || v.kind === 'sedan' || ${JSON.stringify(todo)}.includes(v.id) || !v.smashD || v.smashD.state === 'burning' || v.damage > 2.9 || v.smashD.hub.some(Boolean)) continue; const d = Math.hypot(v.pos.x - C.x, v.pos.z - C.z) + (done.includes(v.id) ? 0 : 25) + (v.kind === 'truck' ? 60 : 0); if (d < bd) { bd = d; b = v; } } return b && { id: b.id, x: b.pos.x, z: b.pos.z, yaw: b.yaw, hw: b.spec.halfW, east: b.pos.x > -120 }; })()`);
      if (!pick || pick.__exc) { out.end = 'no car to take'; return 'end'; }
      // (its door on the lane's side: a car at the east kerb from its west side)
      const sd = pick.east ? -1 : 1;
      await walkTo(api, pick.x + sd * (pick.hw + 1.0), pick.z, 40000, true);
      const f = await js(`(() => { const C = N.controller; let d = Math.atan2(-(${pick.x} - C.pos.x), -(${pick.z} - C.pos.z)) - C.yaw; return { d: Math.atan2(Math.sin(d), Math.cos(d)), sens: C.sensitivity }; })()`);
      await api.turn(-f.d / f.sens, 0);
      await sleep(300);
      if (!(await into())) { out.end = 'could not take ' + pick.id; return 'end'; }
      out.swaps++;
      log(`  took car ${pick.id}`);
      // (out of its kerb into the lane I was going down: back off it, then on)
      await keyDown('KeyS'); await sleep(1300); await keyUp('KeyS'); await sleep(200);
      const s2 = await js(ST);
      const laneX = southward ? -124.9 : -119.6, zN = s2.z + (southward ? 6 : -6);
      await follow(api, [[s2.x, s2.z], [(s2.x + laneX) / 2, (s2.z + zN) / 2], [laneX, zN], [laneX, zN + (southward ? 3 : -3)]], { speed: 4, timeout: 15000 });
    }
    return 'ok';
    };
    if ((await spent()) !== 'ok') break;
    const sgn = southward ? 1 : -1;
    const fT = [Math.cos(T.yaw), -Math.sin(T.yaw)];
    const blowOnce = async (again) => {
      const s = await js(ST);
      let path, hit;
      if (step.blow === 'rear') {
        // its tail (the end facing me) where it stands now; by the last one I rammed, between it and the columns
        // its tail where it stands now, at its corner on the lane's side: down the lane between the
        // parked cars and the el's columns (by the ones rammed before), a swerve into it
        const now = await where(T.id);
        const tail = fT[1] * sgn > 0 ? -1 : 1;
        hit = [now.x + fT[0] * tail * T.hl + T.hw * 0.75, now.z + fT[1] * tail * T.hl];
        // (from the lane under the el, a long diagonal run through the gap between two columns)
        const st = [-119.6, hit[1] - sgn * 14];
        path = [[s.x, s.z], ...[[-120.4, st[1] - sgn * 6], st].filter((w) => sgn * (w[1] - s.z) > 2), hit];
      } else {
        // into its door: from the lane under the el, through the gap
        const dz = step.doorZ ?? T.z;
        hit = [T.x - T.hw * 0.92, dz + sgn * (T.kind === 'truck' ? 1.6 : 0.6)];
        if (again) path = [[s.x, s.z], hit];
        else path = [[s.x, s.z], ...[[-119.6, dz - sgn * 9], [-119.4, dz - sgn * 6]].filter((w) => sgn * (w[1] - s.z) > 2), hit];
      }
      { const a = path[path.length - 2], L = Math.hypot(hit[0] - a[0], hit[1] - a[1]) || 1; path.push([hit[0] + (hit[0] - a[0]) / L * 3, hit[1] + (hit[1] - a[1]) / L * 3]); }
      await js(`(window.__o6bC = ${corners(T.id)}, 1)`);
      const stop = async () => js(`(() => { const v = G.city.cars.find((c) => c.id === ${T.id}); return Math.hypot(v.vel.x, v.vel.z) > 1.0 || ${corners(T.id)} > window.__o6bC + 0.01; })()`);
      const kmh = step.blow === 'rear' ? opts.rearKmh ?? 45 : opts.doorKmh ?? 38;
      const r = await follow(api, path, { speed: kmh / 3.6, stop, timeout: 40000, fastFrom: again ? 0 : path.length - 3 });
      if (shots[step.name] && !again) { await sleep(shots[step.name].after ?? 200); await shot(shots[step.name].name || step.name); }
      if (r.end === 'burning') return { end: r.end, kmh: 0, max: 0 };   // (my car on fire: out at once, not a back-off first)
      await sleep(250);
      await brakeAndBack(api, step.blow === 'door' && step.again && !again ? 2600 : 1500);
      await sleep(300);
      return { end: r.end, kmh: r.s ? +(Math.abs(r.s.v) * 3.6).toFixed(0) : null, max: +((r.maxV || 0) * 3.6).toFixed(0) };
    };
    let r = await blowOnce(false);
    if (step.again) r = await blowOnce(true);
    // ([O6b] after the critic: opts.untilFire - again and again, until it burns (the havoc's
    // proof counts wrecks): a longer back-off for a run-up, my car swapped when it is spent)
    let nb = step.again ? 2 : 1, stopAll = false;
    while (opts.untilFire && nb < (opts.maxBlows || 6)) {
      const t = await js(`(() => { const v = G.city.cars.find((c) => c.id === ${T.id}); return { dmg: v.damage, wreck: !!v.wrecked, st: v.smashD && v.smashD.state }; })()`);
      if (t.wreck || t.st === 'burning') break;
      const sp = await spent();
      if (sp !== 'ok') { stopAll = true; break; }
      { await keyDown('KeyS'); await sleep(step.blow === 'door' ? 2400 : 1800); await keyUp('KeyS'); await sleep(150); }
      r = await blowOnce(true); nb++;
    }
    // (it burns: back off out of its blast and let it go - a player sees the flames - then on)
    if (opts.untilFire && !stopAll) {
      const t = await js(`(() => { const v = G.city.cars.find((c) => c.id === ${T.id}); return { wreck: !!v.wrecked, st: v.smashD && v.smashD.state }; })()`);
      if (t.st === 'burning') {
        await keyDown('KeyS'); await sleep(6000); await keyUp('KeyS'); await keyDown('Space'); await sleep(300); await keyUp('Space');
        for (let i = 0; i < 60; i++) { const u = await js(`(() => { const v = G.city.cars.find((c) => c.id === ${T.id}); const m = G.city.car; return !!v.wrecked || (m.smashD && m.smashD.state === 'burning'); })()`); if (u) break; await sleep(150); }
        await sleep(400);
      }
    }
    if (opts.trace === step.name) log(JSON.stringify(follow.trace));
    prev = T;
    const after = await js(SHOWS(`G.city.cars.find((v) => v.id === ${T.id})`));
    const mine = await js(SHOWS('G.city.car'));
    out.blows.push({ name: step.name, id: T.id, blow: step.blow, ...r, after: after && after.st, dmg: after && after.dmg, mine: mine && mine.st, myDmg: mine && mine.dmg });
    log(`  ${step.name} (${step.blow} x${nb}, ${r.end} at ${r.kmh} km/h, ${r.max} at most): it ${JSON.stringify(after && after.st)} ${after && after.dmg}; mine ${JSON.stringify(mine && mine.st)} ${mine && mine.dmg}`);
    if (stopAll) break;
  }
  out.mine.push(await js(SHOWS('G.city.car')));
  await brakeAndBack(api, 0);
  // ([O6b] after the critic: in a burning car at the end, out and away - a player warned gets out)
  { const me = await js(ST); if (me && me.inCar && me.state === 'burning') { await press('KeyE'); for (let i = 0; i < 60; i++) { if (!(await js('G.city.inCar'))) break; await sleep(100); } await sleep(400); const p = await js('[N.controller.pos.x, N.controller.pos.z]'); await walkTo(api, p[0] < -120 ? -134 : -106, p[1] + 6, 9000); out.leftBurning = true; } }
  await sleep(opts.settle ?? 5000);
  out.parts = await js(`(() => { const S = G.stage.smash, st = G.stage; const P = S.out.filter((i) => i.part); const R = { n: P.length, kinds: {}, live: 0, floating: [], inWall: [], against: [] };
    for (const it of P) { R.kinds[it.kind] = (R.kinds[it.kind] || 0) + 1; if (it.state === 'live') R.live++;
      const b = it.body; if (!b) continue; let low = Infinity; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const r = new N.THREE.Vector3(sx * b.e.x, sy * b.e.y, sz * b.e.z).applyQuaternion(it.Q); const y = b.p.y + r.y - st.surfaceY(b.p.x + r.x, b.p.z + r.z); if (y < low) low = y; }
      if (it.state === 'rest' && low > 0.06) R.floating.push([it.kind, +low.toFixed(2)]);
      // (inside a wall: its middle well inside a building's or a fence's box - O6's test; against an el column's
      // plinth, a kerb's post or another thing's box it may lie, that is touching, listed apart)
      for (const o of st.colliders.near(b.p.x, b.p.z, 1)) { if (o.gone || o === it.lie) continue; if (o.r != null) { if (Math.hypot(b.p.x - o.x, b.p.z - o.z) < o.r - 0.1) R.against.push([it.kind, o.tag]); continue; } const dx = b.p.x - o.cx, dz = b.p.z - o.cz; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx - 0.1 && Math.abs(lz) < o.hz - 0.1) (o.tag === 'wall' ? R.inWall : R.against).push([it.kind, o.tag, +b.p.x.toFixed(1), +b.p.z.toFixed(1)]); } }
    return R; })()`);
  out.cars = [];
  for (let i = 0; i < cars.length; i++) out.cars.push(await js(SHOWS(`G.city.cars[${i}]`)));
  out.states = [...new Set(out.cars.flatMap((c) => (c ? c.st : [])).concat(out.blows.flatMap((b) => [...(b.after || []), ...(b.mine || [])])))];
  out.end = out.end || 'done';
  return out;
}
const COL_Z = [-25.4, -13.9, -2.4, 9.1, 20.6, 32.1, 43.6, 55.1];
function segDist(a, b, p) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]);
}
async function walkTo({ js, keyDown, keyUp, sleep, turn }, x, z, timeout = 12000, run = false) {
  const T0 = Date.now();
  await keyDown('KeyW');
  if (run) await keyDown('ShiftLeft');
  // ([O6b] after the critic: run (Shift) to a car far off; blocked by a car or a column - no
  // way made for a second - a step aside, as a player steps round it)
  let lp = null, lt = Date.now();
  for (;;) {
    const s = await js(`(() => { const C = N.controller; const dx = ${x} - C.pos.x, dz = ${z} - C.pos.z; let d = Math.atan2(-dx, -dz) - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return { d: Math.hypot(dx, dz), dyaw: d, sens: C.sensitivity }; })()`);
    if (s.d < 0.6 || Date.now() - T0 > timeout) break;
    if (Math.abs(s.dyaw) > 0.05) await turn(-s.dyaw / s.sens * 0.7, 0);
    if (Date.now() - lt > 1000) { if (lp != null && lp - s.d < 0.4) { await keyDown('KeyD'); await sleep(550); await keyUp('KeyD'); } lp = s.d; lt = Date.now(); }
    await sleep(40);
  }
  if (run) await keyUp('ShiftLeft');
  await keyUp('KeyW');
  await sleep(200);
}

// ---- on foot into a door lying; a car over one -----------------------------------------------------------------
async function parts(api) {
  const { js, log, sleep, keyDown, keyUp, turn } = api;
  const out = { walks: [] };
  // a door (or a bonnet) lying: on foot into it, W held 3 s; the eye watched every frame
  const L = await js(`(() => { const S = G.stage.smash, C = N.controller; let best = null, bd = 1e9; for (const it of S.out) { if (!it.part || !it.lie || it.state !== 'rest') continue; const d = Math.hypot(it.lie.cx - C.pos.x, it.lie.cz - C.pos.z); if (d < bd) { bd = d; best = it; } } if (!best) return null; const b = best.lie; return { kind: best.kind, cx: b.cx, cz: b.cz, hx: b.hx, hz: b.hz, c: b.c, s: b.s, id: best.id }; })()`);
  if (!L) return { err: 'nothing lying' };
  const nx = L.s, nz = L.c;
  const from = [L.cx + nx * (L.hz + 3), L.cz + nz * (L.hz + 3)], to = [L.cx - nx * (L.hz + 3), L.cz - nz * (L.hz + 3)];
  await walkTo(api, from[0], from[1], 20000);
  await js(`(() => { const W = window.__o6bin = { min: 9, inside: 0 }; const b = G.stage.smash.items.find((i) => i.id === ${L.id}).lie; const tick = () => { const p = N.controller.pos; const dx = p.x - b.cx, dz = p.z - b.cz; const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c; const d = Math.max(Math.abs(lx) - b.hx, Math.abs(lz) - b.hz); W.min = Math.min(W.min, d); if (d < -0.05) W.inside++; if (!W.stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
  const s = await js(`(() => { const C = N.controller; let d = Math.atan2(-(${to[0]} - C.pos.x), -(${to[1]} - C.pos.z)) - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return { dyaw: d, sens: C.sensitivity }; })()`);
  await turn(-s.dyaw / s.sens, 0);
  await sleep(100);
  await keyDown('KeyW'); await sleep(3000); await keyUp('KeyW');
  const r = await js('(() => { const W = window.__o6bin; W.stop = true; return { min: +W.min.toFixed(2), inside: W.inside }; })()');
  out.walks.push({ kind: L.kind, ...r });
  log(`walk into the ${L.kind}: ${JSON.stringify(r)}`);
  if (api.opts.over === false) return out;
  // into my coupe (its left side), then north up the lane over the door lying in it
  const car = await js(`(() => { const v = G.city.cars[0]; return { id: v.id, x: v.pos.x, z: v.pos.z, yaw: v.yaw, hw: v.spec.halfW }; })()`);
  await walkTo(api, car.x - Math.sin(car.yaw) * (car.hw + 0.9), car.z - Math.cos(car.yaw) * (car.hw + 0.9), 25000);
  const f = await js(`(() => { const C = N.controller; let d = Math.atan2(-(${car.x} - C.pos.x), -(${car.z} - C.pos.z)) - C.yaw; return { d: Math.atan2(Math.sin(d), Math.cos(d)), sens: C.sensitivity }; })()`);
  await turn(-f.d / f.sens, 0);
  await sleep(300);
  await keyDown('KeyE'); await sleep(70); await keyUp('KeyE');
  for (let i = 0; i < 50 && !(await js('G.city.inCar')); i++) await sleep(100);
  const door = await js(`(() => { const it = G.stage.smash.out.find((i) => i.kind === 'cardoor' && i.state === 'rest'); return it && { id: it.id, x: it.body.p.x, z: it.body.p.z }; })()`);
  if (!door) { out.over = { err: 'no door lying' }; return out; }
  await js(`(() => { const W = window.__o6bOver = { log: [], hits: [] }; const c = G.city.car; c.on('smash', (e) => { if (e.item && e.item.kind) W.hits.push([e.item.kind, +G.time.toFixed(2), +c.speedAbs.toFixed(2)]); }); const tick = () => { if (Math.abs(c.pos.z - ${door.z}) < 7) W.log.push([+c.pos.z.toFixed(2), +c.speedAbs.toFixed(2)]); if (!W.stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return 1; })()`);
  const r2 = await follow(api, [[car.x, car.z], [door.x, door.z + 14], [door.x, door.z], [door.x, door.z - 16]], { speed: 8.5, timeout: 30000 });
  await brakeAndBack(api, 0);
  await sleep(3000);
  const W = await js(`(() => { const W = window.__o6bOver; W.stop = true; const it = G.stage.smash.items.find((i) => i.id === ${door.id}); return { log: W.log, hits: W.hits, moved: it && it.body ? +Math.hypot(it.body.p.x - ${door.x}, it.body.p.z - ${door.z}).toFixed(2) : null, state: it ? it.state : 'gone' }; })()`);
  // the speed before it and at the bump
  const hit = W.hits.find((h) => h[0] === 'cardoor');
  const before = W.log.filter((e) => e[0] > door.z + 3.2).map((e) => e[1]);
  const vBefore = before.length ? before[before.length - 1] : null;
  out.over = { end: r2.end, hit: !!hit, vBefore, vAt: hit ? hit[2] : null, moved: W.moved, state: W.state };
  log(`over the door: ${JSON.stringify(out.over)}`);
  return out;
}

// ---- aim the eye at a world point by trusted mouse moves --------------------------------------------------------
async function aimAt({ js, turn, sleep }, p) {
  for (let k = 0; k < 8; k++) {
    const s = await js(`(() => { const C = N.controller, e = G.camera.position; const dx = ${p[0]} - e.x, dy = ${p[1]} - e.y, dz = ${p[2]} - e.z; const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz)); let dyaw = yaw - C.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); return { dyaw, dpitch: pitch - C.pitch, sens: C.sensitivity }; })()`);
    if (Math.abs(s.dyaw) < 0.004 && Math.abs(s.dpitch) < 0.004) return true;
    const px = -s.dyaw / s.sens, py = -s.dpitch / s.sens;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(px), Math.abs(py)) / 60));
    for (let i = 0; i < n; i++) { await turn(px / n, py / n); await sleep(16); }
    await sleep(60);
  }
  return false;
}

// ---- the el's hung lamp shot out (the bed, under the el) -------------------------------------------------------
async function hang(api) {
  const { js, log, sleep, mouse, shot, cursor } = api;
  const L = await js(`(() => { const S = G.stage.smash, C = N.controller.pos; let b = null, bd = 1e9; for (const it of S.items) { if (it.kind !== 'hanglamp' || it.dark) continue; const d = Math.hypot(it.x - C.x, it.z - C.z); if (d < bd) { bd = d; b = it; } } return b && { id: b.id, x: b.x, z: b.z, head: b.lamp.head.toArray() }; })()`);
  if (!L) return { err: 'no hung lamp' };
  await walkTo(api, L.x + 1.5, L.z + 6.5, 20000);
  await aimAt(api, L.head);
  await sleep(300);
  const before = await js(`(() => { const it = G.stage.smash.items.find((i) => i.id === ${L.id}); const l = it.lamp; return { dead: !!l.dead, cone: !!(l.cone && l.cone.mesh.visible && l.cone.mesh.material.uniforms.uIntensity.value > 0) }; })()`);
  await shot('h1_hung_lamp_lit');
  const [cx, cy] = cursor();
  let bursts = 0;
  for (; bursts < 4; bursts++) {
    await mouse('mousePressed', cx, cy, 'left'); await sleep(260); await mouse('mouseReleased', cx, cy, 'left');
    await sleep(500);
    if (await js(`G.stage.smash.items.find((i) => i.id === ${L.id}).dark`)) break;
    await aimAt(api, L.head);
  }
  await sleep(3000);
  const after = await js(`(() => { const it = G.stage.smash.items.find((i) => i.id === ${L.id}); const l = it.lamp; const sp = G.stage.part('lamps').pool.find((s) => s.lamp === l); return { dark: !!it.dark, dead: !!l.dead, on: l.on, cone: !!(l.cone && l.cone.mesh.visible && l.cone.mesh.material.uniforms.uIntensity.value > 0.01), light: sp ? +sp.spot.intensity.toFixed(1) : 0 }; })()`);
  await shot('h2_hung_lamp_out');
  log(`hung lamp ${L.id}: before ${JSON.stringify(before)} after ${bursts + 1} bursts ${JSON.stringify(after)}`);
  return { before, after, bursts: bursts + 1 };
}

// ---- [O6b] after the critic (m8): a city awning shot (Fifth St's north side: the street's canvas, O1b's dressing) ------------------
async function awnShot(api) {
  const { js, log, sleep, mouse, shot, cursor } = api;
  const A = await js(`(() => { const C = N.controller.pos; let b = null, bd = 1e9; for (const i of G.stage.smash.items) { if (i.kind !== 'awning' || !i.rec || !i.rec.d || i.state !== 'stand' || !(i.z > 49 && i.z < 53 && i.x < -128 && i.x > -175)) continue; const d = Math.hypot(i.x - C.x, i.z - C.z); if (d < bd) { bd = d; b = i; } } if (!b) return null; const r = b.rec, ox = Math.sin(r.yaw), oz = Math.cos(r.yaw); return { id: b.id, x: r.x, z: r.z, y: b.y0, ox, oz, d: bd, mid: [r.x + ox * r.d * 0.5, b.y0, r.z + oz * r.d * 0.5] }; })()`);
  if (!A) return { err: 'no awning' };
  // (across the pavement from it, 7 m out from the wall, a little along)
  await walkTo(api, A.x + A.ox * 7, A.z + A.oz * 7, 30000, true);
  await aimAt(api, A.mid);
  await sleep(300);
  await shot('a1_awning_aimed');
  const [cx, cy] = cursor();
  let bursts = 0;
  for (; bursts < 5; bursts++) {
    await mouse('mousePressed', cx, cy, 'left'); await sleep(260); await mouse('mouseReleased', cx, cy, 'left');
    await sleep(500);
    if (await js(`G.stage.smash.items.find((i) => i.id === ${A.id}).state !== 'stand'`)) break;
    await aimAt(api, A.mid);
  }
  await sleep(2500);
  const after = await js(`(() => { const it = G.stage.smash.items.find((i) => i.id === ${A.id}); return { state: it.state, hits: it.hits, torn: it.torn || 0, shots: G.stage.smash.events.filter((e) => e.what === 'shot').slice(-6).map((e) => [e.kind, e.id]) }; })()`);
  await shot('a2_awning_shot');
  log(`awning ${A.id}: after ${bursts + 1} bursts ${JSON.stringify(after)}`);
  return { after, bursts: bursts + 1 };
}

// ---- a lorry onto the pavement under the city's awnings (the bed's lorry, Fifth St) ----------------------------
async function awning(api) {
  const { js, log, sleep, keyDown, keyUp, shot, opts } = api;
  const lorry = await js(`(() => { const v = G.city.cars.find((c) => c.kind === 'truck'); return v && { id: v.id, x: v.pos.x, z: v.pos.z, yaw: v.yaw, hw: v.spec.halfW }; })()`);
  if (!lorry) return { err: 'no lorry' };
  // the awnings along the way (records of the city's near build: the set's items)
  const aws = await js(`G.stage.smash.items.filter((i) => i.kind === 'awning' && i.rec && i.z > 49 && i.z < 53 && i.x < -128 && i.x > -175).map((i) => ({ id: i.id, x: +i.x.toFixed(1), z: +i.z.toFixed(1), y: +i.y0.toFixed(2), w: i.rec.w }))`);
  log(`awnings on Fifth St's north side: ${JSON.stringify(aws)}`);
  // to its door (its left: -z of its frame), E
  const lx = lorry.x - Math.sin(lorry.yaw) * (lorry.hw + 0.9), lz = lorry.z - Math.cos(lorry.yaw) * (lorry.hw + 0.9);
  await walkTo(api, lx, lz, 25000);
  const f = await js(`(() => { const C = N.controller; let d = Math.atan2(-(${lorry.x} - C.pos.x), -(${lorry.z} - C.pos.z)) - C.yaw; return { d: Math.atan2(Math.sin(d), Math.cos(d)), sens: C.sensitivity }; })()`);
  await api.turn(-f.d / f.sens, 0);
  await sleep(300);
  await keyDown('KeyE'); await sleep(70); await keyUp('KeyE');
  for (let i = 0; i < 50 && !(await js('G.city.inCar')); i++) await sleep(100);
  if (!(await js(`G.city.inCar && G.city.car.id === ${lorry.id}`))) return { err: 'not in the lorry' };
  const t0 = await js('G.time');
  // out of Grand Ave west into Fifth St, up onto its north pavement under the shop fronts
  const z = opts.z ?? 52.7;
  await js(`(window.__o6bAw = { min: 99, at: null }, (() => { const tick = () => { const v = G.city.car, W = window.__o6bAw; for (const a of ${JSON.stringify(aws)}) { const d = Math.hypot(v.pos.x - a.x, v.pos.z - a.z); if (d < W.min) { W.min = +d.toFixed(2); W.at = [+v.pos.x.toFixed(2), +v.pos.z.toFixed(2), +(v.groundY || 0).toFixed(2)]; } } if (!W.stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); })(), 1)`);
  const r = await follow(api, [[lorry.x, lorry.z], [-128, 58.5], [-136, 56.5], [-143, z], [-152, z], [-170, z]], { speed: 6, timeout: 45000 });
  log(`the lorry passed the awnings at ${JSON.stringify(await js('(window.__o6bAw.stop = true, window.__o6bAw)'))}`);
  await brakeAndBack(api, 0);
  await sleep(opts.settle ?? 5000);
  const torn = await js(`G.stage.smash.events.filter((e) => e.kind === 'awning' && e.t >= ${t0}).map((e) => [e.what, e.by, e.id])`);
  const rest = await js(`G.stage.smash.items.filter((i) => i.kind === 'awning' && i.rec && i.state !== 'stand').map((i) => [i.id, i.state, +i.P.y.toFixed(2), i.body ? +i.body.p.y.toFixed(2) : null, +(i.t || 0).toFixed(1)])`);
  await shot('a1_awning_down');
  log(`the lorry: ${r.end}; awnings: ${JSON.stringify(torn)} ${JSON.stringify(rest)}`);
  return { end: r.end, torn, rest, n: aws.length };
}

// ---- into the river (the city: a coupe down the slipway at the foot of Pier Street) ----------------------------
async function river(api) {
  const { js, log, sleep, keyDown, keyUp, shot } = api;
  if (!(await js('G.city.inCar'))) return { err: 'not in a car' };
  await keyDown('KeyW');
  let sinkT = null;
  for (let i = 0; i < 160; i++) { await sleep(50); const s = await js('({ sink: G.city.sinkT || 0, fail: !!G.failing })'); if (s.sink || s.fail) { sinkT = s.sink; break; } }
  await keyUp('KeyW');
  await sleep(420);
  await shot('w1_splash');
  const mid = await js(`(() => { const D = G.stage.smash.cars; return { rings: (D._rings || []).filter((r) => r.visible).length, shape: (D._sunk || []).some((s) => s.visible), sinking: (D.sinking || []).length, failing: !!G.failing }; })()`);
  // the black, the words, ashore at the steps
  let why = null;
  for (let i = 0; i < 100; i++) { await sleep(100); const s = await js('({ f: !!G.failing, why: G.lastFail ? G.lastFail.why : null, beat: G.scenes.beat })'); if (s.why) why = s.why; if (!s.f && s.beat === 'ashore') break; }
  await sleep(1200);
  // look back at the water where it went down
  const sh = await js(`(() => { const s = (G.stage.smash.cars._sunk || []).find((x) => x.visible); return s && [s.position.x, s.position.z]; })()`);
  if (sh) await aimAt(api, [sh[0], -2.1, sh[1]]);
  await sleep(400);
  await shot('w2_the_shape_under_the_water');
  const end = await js(`(() => { const s = (G.stage.smash.cars._sunk || []).find((x) => x.visible); return { shape: !!s, glow: s ? +s.userData.glows[0].material.opacity.toFixed(2) : 0, beat: G.scenes.beat, inCar: G.city.inCar }; })()`);
  log(`river: sink at ${sinkT}, mid ${JSON.stringify(mid)}, why ${why}, end ${JSON.stringify(end)}`);
  return { sinkT, mid, why, end };
}

// ---- memory flat over cycles: the ten cars given every part's damage, then put back ----------------------------
async function memory(api) {
  const { js, sleep, log, opts } = api;
  const read = async () => js('(() => { if (window.gc) window.gc(); const m = performance.memory; const R = N.renderer.info.memory; const S = G.stage.smash; return { heap: m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : null, geo: R.geometries, tex: R.textures, prog: N.renderer.info.programs ? N.renderer.info.programs.length : null, out: S.out.length, items: S.items.length, scene: G.stage.scene.children.length, cut: S.cars.list.reduce((a, d) => a + d.cutGeos.length, 0) }; })()');
  const out = [await read()];
  const n = opts.cycles ?? 50;
  for (let k = 0; k < n; k++) {
    await js(`(() => { const S = G.stage.smash, C = S.cars; for (const v of G.city.cars) { if (v === G.city.car) continue; const d = v.smashD; if (!d) continue;
      const P = (x, z) => { const p = v.world(x, z); p.y = 0.6; return p; };
      C.knock(d, { point: P(1.2, -0.95), k: 0.7, n: null }, 0.6); C.popHood(d, 1); C.hangDoor(d, -1); C.doorOff(d, 0); C.hangDoor(d, 1);
      C.looseBumper(d, 0, 1); C.bumperOff(d, 0); C.looseBumper(d, 1, -1); C.wobble(d, 0); C.wheelOff(d, 0); C.wobble(d, 3); C.hoodOff(d, 1); }
      return S.out.length; })()`);
    await sleep(opts.hold ?? 700);
    // (put back: each car out of the list a step - its damage dropped, everything it was given disposed - and in again whole)
    await js('(() => { const L = G.vehicles.list; window.__kept = G.city.cars.filter((v) => v !== G.city.car && L.includes(v)); for (const v of window.__kept) L.splice(L.indexOf(v), 1); return window.__kept.length; })()');
    await sleep(120);
    await js('(() => { for (const v of window.__kept) G.vehicles.list.push(v); G.stage.smash.mendAll(); return 1; })()');
    await sleep(120);
    if ((k + 1) % 10 === 0) { await sleep(300); const r = await read(); out.push(r); log(`memory after ${k + 1}: ${JSON.stringify(r)}`); }
  }
  return { reads: out };
}
