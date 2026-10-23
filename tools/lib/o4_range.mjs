// [O4] The shotgun's feel on the range (src/scenes/94_o4.js 'range'), by real
// input: turn onto each man's chest (4, 10, 25 m), one barrel each, the
// reload (R) between; returns what each took and how the pellets went.
//   { "drive": "tools/lib/o4_range.mjs", "order": [0, 1, 2] }
export default async function drive({ js, turn, keyDown, keyUp, mouse, log, sleep, W, H, opts, cursor, shot }) {
  const at = () => (cursor ? cursor() : [W / 2, H / 2]);
  const click = async () => { const [x, y] = at(); await mouse('mousePressed', x, y, 'left'); await sleep(50); await mouse('mouseReleased', x, y, 'left'); };
  const tap = async (code) => { await keyDown(code); await sleep(50); await keyUp(code); };
  const out = { shots: [] };
  const ST = `(() => { const C = N.controller, e = G.eye, F = G.scenes.ctx && G.scenes.ctx.flags.o4, Wp = G.player.weapons.get('shotgun');
    return { yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, e: { x: e.x, y: e.y, z: e.z }, ammo: Wp.ammo, pocket: Wp.pocket, phase: Wp.phase,
      men: F ? F.men.map((h) => { const c = h.bones.chest.getWorldPosition(new N.THREE.Vector3()); return { d: h.o4d, x: c.x, y: c.y, z: c.z, hp: Math.round(Math.max(0, h.hp)), alive: h.alive }; }) : [] }; })()`;
  for (const i of opts.order || [0, 1, 2]) {
    for (let k = 0; k < 40; k++) { const s = await js(ST); if (s && s.phase === 'ready' && s.ammo > 0) break; if (s && s.ammo === 0 && s.phase === 'ready') await tap('KeyR'); await sleep(150); }
    // the turn onto his chest, in a few moves, then a settle
    for (let n = 0; n < 4; n++) {
      const s = await js(ST), m = s.men[i];
      const want = Math.atan2(-(m.x - s.e.x), -(m.z - s.e.z)), pt = Math.atan2(m.y - s.e.y, Math.hypot(m.x - s.e.x, m.z - s.e.z));
      const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)), dp = pt - s.pitch;
      await turn(Math.round(-dy / s.sens), Math.round(-dp / s.sens));
      await sleep(90);
    }
    const before = await js(ST);
    const t0 = Date.now();
    await click();
    await sleep(700);
    const after = await js(ST);
    const ls = await js("G.player.weapons.get('shotgun').lastShot");
    const r = { d: before.men[i].d, hpBefore: before.men[i].hp, hpAfter: after.men[i].hp, alive: after.men[i].alive, men: ls && ls.men, pellets: ls && ls.pellets.join(''), cone: ls && ls.cone, ms: Date.now() - t0 };
    out.shots.push(r);
    log(`range ${JSON.stringify(r)}`);
    if (shot) await shot(`range_${r.d}m`);
    await tap('KeyR');
    await sleep(1700);
  }
  const fin = await js(ST);
  out.pocket = fin.pocket; out.ammo = fin.ammo;
  return out;
}
