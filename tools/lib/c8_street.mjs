// [C8] after the critic: the street's own things, played by real input (tools/play.mjs
// { "drive": "tools/lib/c8_street.mjs", "what": [...] }). Each is entered as its
// checkpoint puts me there (scenes.go); the player's damage is switched off for these
// checks only (they prove the mechanics answer the hand, not the contest - the contests
// are block_idle / block_bad / block_good).
//   drums    empty the gun and both drums by the trigger, reload by R; at the counter E:
//            Dot slides her one ("That's my last one."); then walk and crouch (it froze me
//            before); empty again: no prompt, the hint says none are left
//   switch   to the switch by the door, E: the room dark; standing in it the men have no
//            line on me; one burst and they have (the flash finds me)
//   tank     a stopped car's tank, held on until it burns and goes; the men behind it
//   kitchen  the flank: the crash, 'Kitchen!', the man up at the hatch; shot there
//   hydrant  the Cardinal by the hydrant: two rounds into it, it bursts: he is down and open
//   iron     a round into him while he is shut: sparks and the thud, no blood
export default async function drive({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts }) {
  const cx = W / 2, cy = H / 2;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ST = `(() => { const G = N.game, C = N.controller, e = G.eye; return { ex: e.x, ey: e.y, ez: e.z, x: C.pos.x, z: C.pos.z, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, ck: C.crouchK || 0, beat: G.scenes.beat, trans: !!G.scenes.trans, fade: G.scenes.fadeK, ammo: G.weapon.ammo, reloading: !!(G.player.weapons.active && G.player.weapons.active.reloading), reserve: G.b7 ? G.b7.reserve : 0, dotLeft: G.b7 ? G.b7.dotLeft : 0, cur: G.interact.current && G.interact.current.id }; })()`;
  const aim = async (s, yaw, pitch, gain = 0.6, max = 0.25) => {
    const ey = wrap(yaw - s.yaw), ep = pitch - s.pitch;
    const dy = Math.max(-max, Math.min(max, ey * gain)), dp = Math.max(-max, Math.min(max, ep * gain));
    const mx = Math.round(-dy / s.sens), my = Math.round(-dp / s.sens);
    if (mx || my) await turn(mx, my);
    return Math.hypot(ey, ep);
  };
  const lookAt = async (x, y, z, tol = 0.01) => { for (let i = 0; i < 60; i++) { const s = await js(ST); const e = await aim(s, Math.atan2(-(x - s.ex), -(z - s.ez)), Math.atan2(y - s.ey, Math.hypot(x - s.ex, z - s.ez))); if (e < tol) return true; await sleep(25); } return false; };
  const walkTo = async (x, z, tol = 0.3) => {
    for (let i = 0; i < 200; i++) {
      const s = await js(ST);
      const dx = x - s.x, dz = z - s.z;
      if (Math.hypot(dx, dz) < tol) { await keyUp('KeyW'); return true; }
      const e = await aim(s, Math.atan2(-dx, -dz), -0.05, 0.6, 0.3);
      if (e < 0.6) await keyDown('KeyW'); else await keyUp('KeyW');
      await sleep(40);
    }
    await keyUp('KeyW');
    return false;
  };
  const tap = async (code, ms = 60) => { await keyDown(code); await sleep(ms); await keyUp(code); };
  const hold = async (ms) => { await mouse('mousePressed', cx, cy, 'left'); await sleep(ms); await mouse('mouseReleased', cx, cy, 'left'); };
  const go = async (beat) => {
    await js(`(N.game.scenes.go('shootout', { beat: '${beat}', fade: 'cut', card: false }), 1)`);
    for (let i = 0; i < 40; i++) { const s = await js(ST); if (s && s.beat === beat && !s.trans && s.fade < 0.3) break; await sleep(150); }
    await sleep(500);
    await js('(N.game.health.damage = () => {}, 1)');
  };
  const rec = {};
  for (const what of opts.what || []) {
    const r = rec[what] = {};
    if (what === 'drums') {
      await go('cars');
      const s0 = await js(ST);
      r.atStart = { reserve: s0.reserve, dotLeft: s0.dotLeft, offered: s0.cur === 'b7.drums' };
      // (into the street, the trigger held: the gun dry, R, again, R, again)
      await lookAt(5, 1.2, -4, 0.05);
      for (let k = 0; k < 3; k++) {
        await hold(5000);
        const s = await js(ST);
        if (k < 2) { await tap('KeyR'); for (let i = 0; i < 40; i++) { const q = await js(ST); if (!q.reloading && q.ammo > 0) break; await sleep(150); } }
        r['afterBurst' + k] = { ammo: s.ammo, reserve: s.reserve };
      }
      const sd = await js(ST);
      r.dry = { ammo: sd.ammo, reserve: sd.reserve, hint: await js(`(document.querySelector('.b7hint') || {}).textContent || ''`) };
      // to the counter, E
      await walkTo(-13.25, 0.9, 0.3);
      await lookAt(-14.55, 1.3, 0.9, 0.04);
      await sleep(300);
      r.offered = (await js(ST)).cur;
      await tap('KeyE');
      await sleep(3600);
      const s1 = await js(ST);
      r.taken = { reserve: s1.reserve, dotLeft: s1.dotLeft, ease: await js('!!N.controller._ease'), mode: await js('N.controller.mode') };
      // walk back, crouch: the hands are mine again
      const p0 = { x: s1.x, z: s1.z };
      await tap('KeyS', 800); await sleep(300);
      const s2 = await js(ST);
      r.walked = +Math.hypot(s2.x - p0.x, s2.z - p0.z).toFixed(2);
      await tap('KeyC'); await sleep(700);
      r.crouched = +(await js(ST)).ck.toFixed(2);
      await tap('KeyC'); await sleep(400);
      // R: her drum in; the gun dry again; nothing more at the counter
      await tap('KeyR'); await sleep(3200);
      await lookAt(5, 1.2, -4, 0.05); await hold(5000);
      await walkTo(-13.25, 0.9, 0.3); await lookAt(-14.55, 1.3, 0.9, 0.04); await sleep(300);
      const s3 = await js(ST);
      r.again = { offered: s3.cur === 'b7.drums', reserve: s3.reserve, dotLeft: s3.dotLeft, hint: await js(`(document.querySelector('.b7hint') || {}).textContent || ''`) };
      await shot('drums_none_left');
    } else if (what === 'switch') {
      await go('cars');
      await walkTo(-10.95, 1.75, 0.25);
      await lookAt(-10.46, 1.42, 1.62, 0.03);
      await sleep(250);
      r.offered = (await js(ST)).cur;
      await tap('KeyE'); await sleep(400);
      r.dark = await js('!N.game.b7.lightsOn');
      // back into the room, still; the men out of their cars
      await walkTo(-12.6, 2.4, 0.3);
      for (let i = 0; i < 60; i++) { if (await js('N.game.stage.hoods.list.filter(h => h.alive && h.c8beat === "cars" && N.game.ais.has(h)).length >= 3')) break; await sleep(250); }
      await sleep(2500);
      let mx = 0; for (let i = 0; i < 16; i++) { mx = Math.max(mx, await js('N.game.guns.lineOnMe')); await sleep(200); }
      r.lineDarkStill = mx;
      await shot('switch_dark');
      // one burst at the street: the flash finds me
      await lookAt(6, 1.2, -2, 0.05); await hold(400);
      let mf = 0; for (let i = 0; i < 12; i++) { mf = Math.max(mf, await js('N.game.guns.lineOnMe')); await sleep(200); }
      r.lineAfterFire = mf;
      // light on again: they have me
      await walkTo(-10.95, 1.75, 0.25); await lookAt(-10.46, 1.42, 1.62, 0.03); await sleep(250); await tap('KeyE'); await sleep(300);
      await walkTo(-12.6, 2.4, 0.3);
      let ml = 0; for (let i = 0; i < 16; i++) { ml = Math.max(ml, await js('N.game.guns.lineOnMe')); await sleep(200); }
      r.lineLit = ml;
    } else if (what === 'tank') {
      await go('cars');
      for (let i = 0; i < 80; i++) { if (await js('!!(N.game.b7.cars.car0 && N.game.b7.cars.car0.rail.done)')) break; await sleep(250); }
      await sleep(1500);
      await walkTo(-10.9, -3.0, 0.3);
      const tank = await js('(() => { const c = N.game.b7.cars.car0; const p = new N.THREE.Vector3(-1.9, 0.62, 0.55).applyMatrix4(c.group.matrixWorld); return [p.x, p.y, p.z]; })()');
      r.menNear0 = await js(`N.game.stage.hoods.list.filter(h => h.alive && Math.hypot(h.pos.x - ${tank[0]}, h.pos.z - ${tank[2]}) < 5).length`);
      for (let k = 0; k < 30; k++) {
        await lookAt(tank[0], tank[1], tank[2], 0.008);
        await hold(450); await sleep(150);
        const st = await js('N.game.b7.cars.car0 ? N.game.b7.cars.car0.state : "gone"');
        r.state = st;
        if (st === 'burning' || st === 'dead' || st === 'gone') break;
        const q = await js(ST);
        if (q.ammo <= 0) { await tap('KeyR'); await sleep(3000); }
      }
      await sleep(4500);
      r.stateAfter = await js('N.game.b7.cars.car0 ? N.game.b7.cars.car0.state : "gone"');
      r.menNearAfter = await js(`N.game.stage.hoods.list.filter(h => h.alive && Math.hypot(h.pos.x - ${tank[0]}, h.pos.z - ${tank[2]}) < 5).length`);
      await shot('tank_burns');
    } else if (what === 'kitchen') {
      await go('flank');
      for (let i = 0; i < 120; i++) { if (await js('!!(N.game.b7.kitchen)')) break; await sleep(250); }
      r.warn = await js('N.game.hud.warnText || null');
      for (let i = 0; i < 40; i++) { if (await js('N.game.b7.kitchen.mode === "aim" || N.game.b7.kitchen.mode === "fire"')) break; await sleep(100); }
      await lookAt(-16.7, 1.55, 2.25, 0.006);
      await hold(400); await sleep(600);
      r.down = await js('!N.game.b7.kitchen.h.alive');
      if (!r.down) { await lookAt(-16.7, 1.55, 2.25, 0.006); await hold(500); await sleep(500); r.down = await js('!N.game.b7.kitchen.h.alive'); }
    } else if (what === 'hydrant') {
      await go('cardinal');
      r.near = false;
      for (let i = 0; i < 160; i++) { if (await js('(() => { const B = N.game.b7.boss; return !!(B && B.h && Math.hypot(B.h.pos.x + 6.62, B.h.pos.z + 4.35) < 1.9); })()')) { r.near = true; break; } await sleep(200); }
      r.dotSaid = await js('(N.game.hud.sayText || (document.querySelector("#say") || {}).textContent || "")');
      for (let k = 0; k < 6; k++) {
        await lookAt(-6.62, 0.42, -4.35, 0.006);
        await hold(160); await sleep(250);
        if (await js('(N.game.counters.c8hydrant || 0) > 0')) break;
      }
      r.burst = await js('N.game.counters.c8hydrant || 0');
      r.boss = await js('(() => { const B = N.game.b7.boss; return B ? { open: +B.open.toFixed(2), why: B.openWhy, hold: +(B.hold || 0).toFixed(2), knocked: !!B.c8hydrant } : null; })()');
      await sleep(400);
      await shot('hydrant_burst');
    } else if (what === 'iron') {
      await go('cardinal');
      // (his shield man first - he stands between us; then, his opening over, him while he is shut)
      for (let k = 0; k < 30; k++) {
        const sh = await js('(() => { const B = N.game.b7.boss; const s = B && B.shield && B.shield.h; if (!s || !s.alive) return null; const p = new N.THREE.Vector3().setFromMatrixPosition(s.bones.chest.matrixWorld); return [p.x, p.y, p.z]; })()');
        if (!sh) break;
        await lookAt(sh[0], sh[1], sh[2], 0.008); await hold(300); await sleep(250);
        const q = await js(ST); if (q.ammo <= 0) { await tap('KeyR'); await sleep(3000); }
      }
      for (let i = 0; i < 160; i++) { if (await js('(() => { const B = N.game.b7.boss; return !!(B && B.h && B.mode === "walk" && B.open <= 0 && !(B.hold > 0) && (!B.shield || !B.shield.h.alive)); })()')) break; await sleep(100); }
      const i0 = await js('N.game.counters.c8iron || 0');
      const w0 = await js('N.game.b7.boss.wounds');
      r.blood = 0;
      // (a short burst at his chest while he is shut, again until one lands)
      for (let k = 0; k < 6; k++) {
        for (let i = 0; i < 80; i++) { if (await js('(() => { const B = N.game.b7.boss; return !!(B && B.open <= 0 && !(B.hold > 0)); })()')) break; await sleep(100); }
        const ch = await js('(() => { const h = N.game.b7.boss.h; const p = new N.THREE.Vector3().setFromMatrixPosition(h.bones.chest.matrixWorld); return [p.x, p.y, p.z]; })()');
        await lookAt(ch[0], ch[1], ch[2], 0.005);
        const b0 = await js('N.game.fx.blood ? N.game.fx.blood.list.length : -1');
        const open0 = await js('N.game.b7.boss.open');
        await hold(200);
        await sleep(100);
        const db = (await js('N.game.fx.blood ? N.game.fx.blood.list.length : -1')) - b0;
        if (open0 <= 0) r.blood += Math.max(0, db);
        if ((await js('N.game.counters.c8iron || 0')) > i0) break;
      }
      r.iron = (await js('N.game.counters.c8iron || 0')) - i0;
      r.wounds = (await js('N.game.b7.boss.wounds')) - w0;
    }
    log(`c8 street ${what}: ${JSON.stringify(r)}`);
  }
  void H;
  return rec;
}
