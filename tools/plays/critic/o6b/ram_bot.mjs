// [O6b critic] The critic's own hands at the havoc (NOT the owner's tools/lib/o6b_damage.mjs):
// a player in the seat who points the car at the next parked car and floors it.
//   { "drive": "tools/plays/critic/o6b/ram_bot.mjs", "profile": "good" | "medium" | "bad",
//     "order": [car indices], "hits": n (blows a car at most), "timeout": ms, "shotEvery": [indices of blows to shoot after] }
// Steering: A / D by the heading error to the target car's middle (bad: late, wobbly; medium: a dead band;
// good: tight), W held to a top speed by profile, a contact read as the target's damage rising or my speed
// collapsing; then S for a second (back off) and the next blow. When my car is spent (on fire, on its hubs,
// not moving under W) E out and the run ends there: what a player has left is the gun.
export default async function ram({ js, keyDown, keyUp, turn, log, sleep, opts, shot }) {
  const prof = opts.profile || 'medium';
  const P = { good: { v: opts.v || 13, band: 0.04, lag: 0 }, medium: { v: 11, band: 0.1, lag: 120 }, bad: { v: 15, band: 0.2, lag: 300 } }[prof];
  let seed = 777; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const held = new Set();
  const set = async (c, on) => { if (on && !held.has(c)) { held.add(c); await keyDown(c); } else if (!on && held.has(c)) { held.delete(c); await keyUp(c); } };
  const none = async () => { for (const c of [...held]) await set(c, false); };
  const SH = (e) => `(() => { const c = ${e}; const D = c.smashD; if (!D) return null; return { dmg: +c.damage.toFixed(2), st: D.state, hood: D.hood ? (D.hood.off ? 'off' : D.hood.pivot ? 'flap' : 'none') : 'on', doors: D.doors.map((d) => d ? (d.off ? 'off' : 'hang') : 'on'), bump: D.bumper.map((b) => b ? (b.none ? 'off' : 'drag') : 'on'), wob: D.wob.map((w) => w ? 1 : 0).join(''), hub: D.hub.join(''), wrecked: !!c.wrecked }; })()`;
  const ST = `(() => { const c = G.city.car; return { x: c.pos.x, z: c.pos.z, yaw: c.yaw, v: c.speed, inCar: G.city.inCar, failing: !!G.failing, warn: G.hud.kit.warnText || null }; })()`;
  const out = { blows: [], warns: [] };
  const T0 = Date.now();
  let blowN = 0;
  for (const i of opts.order) {
    for (let h = 0; h < (opts.hits || 2); h++) {
      if (Date.now() - T0 > (opts.timeout || 240000)) { out.end = 'timeout'; break; }
      const tg = await js(`(() => { const c = G.city.cars[${i}]; return { x: c.pos.x, z: c.pos.z, dmg: c.damage, wrecked: !!c.wrecked }; })()`);
      if (tg.wrecked) break;
      const before = tg.dmg;
      // the run-up: into the lane under the el, a car's length south of it (a player lines up before he floors it)
      if (opts.runup !== false) { const r = await goTo(-120, tg.z + (opts.runup || 9), 3.5); if (r === 'failed' || r === 'out') { out.end = r; return out; } }
      let end = null, maxV = 0, lastV = 0, stuck = 0; const t1 = Date.now();
      for (;;) {
        const s = await js(ST);
        if (!s || s.__exc) { await sleep(30); continue; }
        if (s.warn && !out.warns.includes(s.warn)) out.warns.push(s.warn);
        if (s.failing || !s.inCar) { end = s.failing ? 'failed' : 'out'; break; }
        const d = await js(`G.city.cars[${i}].damage`);
        if (d > before + 0.02) { end = 'hit'; break; }
        if (maxV > 6 && Math.abs(s.v) < maxV - 5) { end = 'stopped (something else)'; break; }
        if (Date.now() - t1 > 12000) { end = 'gave up'; break; }
        if (Math.abs(s.v) < 0.5 && Date.now() - t1 > 2500) { if (++stuck > 25) { end = 'stuck'; break; } } else stuck = 0;
        maxV = Math.max(maxV, Math.abs(s.v)); lastV = s.v;
        const want = Math.atan2(-(tg.z - s.z), tg.x - s.x);
        let err = want - s.yaw; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
        if (P.lag && rnd() < 0.3) await sleep(P.lag * rnd());
        await set('KeyA', err > P.band); await set('KeyD', err < -P.band);
        await set('KeyW', Math.abs(s.v) < P.v);
        await sleep(25);
      }
      await set('KeyA', false); await set('KeyD', false); await set('KeyW', false);
      const kmh = +(maxV * 3.6).toFixed(0);
      await sleep(250);
      const after = await js(SH(`G.city.cars[${i}]`)), mine = await js(SH('G.city.car'));
      blowN++;
      out.blows.push({ i, h, end, kmh, after, mine });
      log(`  blow ${blowN} car ${i}: ${end} at ${kmh} km/h -> it ${JSON.stringify(after)} | mine ${JSON.stringify(mine)}`);
      if (opts.shotEvery && opts.shotEvery.includes(blowN)) await shot(`blow${blowN}`);
      if (end === 'failed' || end === 'out') { out.end = end; return out; }
      // back off
      await set('KeyS', true); await sleep(1100); await set('KeyS', false); await set('Space', true); await sleep(300); await set('Space', false);
      const m = await js(`(() => { const c = G.city.car; return { st: c.smashD && c.smashD.state, hubs: c.smashD ? c.smashD.hub.reduce((a, b) => a + b, 0) : 0, dmg: c.damage, wrecked: !!c.wrecked }; })()`);
      if (opts.stay && (m.st === 'burning' || m.wrecked)) { out.end = 'burning, stayed'; await none(); return out; }
      if (!opts.stay && (m.wrecked || m.st === 'burning' || m.st === 'smoke' || (m.hubs && kmh < 15))) {
        log(`  my car is spent (${m.st}, hubs ${m.hubs}, ${kmh} km/h): out, to the next car I can take`);
        out.swaps = (out.swaps || 0) + 1;
        await set('KeyE', true); await sleep(80); await set('KeyE', false); await sleep(900);
        const nx = await js(`(() => { const me = N.controller.pos; let b = null, bd = 1e9; for (const c of G.city.cars) { if (c === G.city.car || c.wrecked || c.kind === 'sedan' || c.damage > 2.4) continue; const d = Math.hypot(c.pos.x - me.x, c.pos.z - me.z); if (d < bd) { bd = d; b = c; } } return b ? { x: b.pos.x, z: b.pos.z, kind: b.kind, d: bd, idx: G.city.cars.indexOf(b) } : null; })()`);
        if (!nx) { out.end = 'nothing left to take'; await none(); return out; }
        log(`  walking to the ${nx.kind} (${nx.idx}) ${nx.d.toFixed(1)} m`);
        await walkTo(nx.x + 1.6, nx.z);
        await set('KeyE', true); await sleep(80); await set('KeyE', false); await sleep(1200);
        const ok = await js('G.city.inCar');
        log(`  E at it: in = ${ok}`);
        if (!ok) { out.end = 'could not get in'; await none(); return out; }
      }
    }
  }
  await none();
  out.end = out.end || 'done';
  return out;
  async function goTo(x, z, r) {
    const t = Date.now();
    for (;;) {
      const s = await js(ST);
      if (!s || s.__exc) { await sleep(30); continue; }
      if (s.failing || !s.inCar) { await none(); return s.failing ? 'failed' : 'out'; }
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < r || Date.now() - t > 9000) break;
      let want = Math.atan2(-(z - s.z), x - s.x), err = want - s.yaw; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
      const back = Math.abs(err) > 2.2 && d < 8;   // (behind me and close: reverse onto it)
      if (back) { let e2 = err > 0 ? err - Math.PI : err + Math.PI; await set('KeyW', false); await set('KeyS', Math.abs(s.v) < 4); await set('KeyD', e2 > 0.1); await set('KeyA', e2 < -0.1); }
      else { await set('KeyS', false); await set('KeyA', err > P.band); await set('KeyD', err < -P.band); await set('KeyW', Math.abs(s.v) < Math.min(7, 1 + d * 0.6)); }
      await sleep(30);
    }
    await set('KeyW', false); await set('KeyA', false); await set('KeyD', false); await set('KeyS', true); await sleep(250); await set('KeyS', false);
    return 'ok';
  }
  async function walkTo(x, z) {
    const t = Date.now();
    await keyDown('KeyW');
    for (;;) {
      const s = await js(`(() => { const C = N.controller; const dx = ${x} - C.pos.x, dz = ${z} - C.pos.z; let d = Math.atan2(-dx, -dz) - C.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return { d: Math.hypot(dx, dz), dyaw: d, sens: C.sensitivity }; })()`);
      if (s.d < 0.7 || Date.now() - t > 15000) break;
      if (Math.abs(s.dyaw) > 0.05) await turn(-s.dyaw / s.sens * 0.7, 0);
      await sleep(40);
    }
    await keyUp('KeyW'); await sleep(200);
  }
}
