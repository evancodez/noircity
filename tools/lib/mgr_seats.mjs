// [manager, AD-hotfix] the view from every car kind's seat on main (the user: "a first-person car view
// error, like you can't see anything"): my coupe whole and after O6b's damage (the bonnet up, a door
// hanging), a sedan, a truck, a police car; a frame from each, straight ahead, and the numbers the
// frames are judged by (tools/colour.py's blocked share, run after).
//   { "drive": "tools/lib/mgr_seats.mjs" }  (O2's fleet: coupe, saloon, taxi, police, hearse, van, lorry)
const tap = async ({ keyDown, keyUp, sleep }, code, ms = 3000) => { await keyDown(code); await sleep(ms); await keyUp(code); };   // (a long press: under a load of 100-200 the page runs a frame every few hundred ms, and a short tap falls between two)
const waitFor = async (js, expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr)) return true; await new Promise((r) => setTimeout(r, 150)); } return false; };
export default async function seats(api) {
  const { js, sleep, log, shot } = api;
  const D = { frames: [], in: {}, out: {} };
  // (me at the car's left door, 1.7 m out from its centre line, facing it: the near-car rule picks it)
  // (me 3.6 m out from the car's centre line at its left door, facing it in the controller's own yaw
  // convention - forward is (-sin yaw, -cos yaw), as O2's play helper has it - then a real step toward it)
  const face = async (expr) => js(`(() => { const c = ${expr}; if (!c) return null; const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), lx = -0.2, lz = -3.6; const px = c.pos.x + lx * cy + lz * sy, pz = c.pos.z - lx * sy + lz * cy; N.controller.setPose(px, pz, Math.atan2(-(c.pos.x - px), -(c.pos.z - pz)), -0.03); window.__seatTarget = c; return [+px.toFixed(1), +pz.toFixed(1)]; })()`);
  const getIn = async (name, expr) => {
    await face(expr);
    await sleep(400);
    await api.keyDown('KeyW'); await sleep(700); await api.keyUp('KeyW');   // (a step to the door)
    await sleep(500);
    for (let k = 0; k < 3 && !(await js('!!(G.city && G.city.inCar)')); k++) {
      const held = await js(`({ prompt: (G.hud && G.hud.promptText) || (document.querySelector('#prompt') || {}).textContent || null })`);
      await tap(api, 'KeyE', 70);   // (as O2's plays tap it; the break-in at a parked car runs 2 s after)
      await waitFor(js, 'G.city && G.city.inCar', 3500);
      if (!(await js('!!(G.city && G.city.inCar)'))) log(`   E try ${k + 1}: ` + JSON.stringify({ ...held, ...(await js(`({ prompt: (G.hud && G.hud.promptText) || (document.querySelector('#prompt') || {}).textContent || null, mode: N.controller.mode, d: (() => { const c = window.__seatTarget, me = N.controller.pos; return c ? +Math.hypot(c.pos.x - me.x, c.pos.z - me.z).toFixed(2) : null; })() })`)) }));
    }
    // (E not taken: the seat by hand - what getIn does for the frame: the player's car, the cabin on it, the city's seat)
    if (!(await js('!!(G.city && G.city.inCar)'))) {
      const r = await js(`(() => { const car = window.__seatTarget; if (!car) return 'no target'; window.__seatCar0 = window.__seatCar0 || G.vehicles.player; G.vehicles.setPlayer(car); car.input.hold = 0; if (car.lamps && car.lamps.setOn) car.lamps.setOn(true); G.city.car = car; G.city.cabin.attach(car, { ease: 0.001, eye: G.eye.clone().set(-0.02, 1.5, -0.34), fov: 64, pitch: -0.01, ...(car.seatOpts || {}) }); G.city.inCar = true; G.emit('city:in', { car }); return 'seated by hand'; })()`);
      log('   ' + r); D.byHand = (D.byHand || 0) + 1;
    }
    // (the eye in the seat before the frame: the cut eases, and under load it takes seconds)
    await waitFor(js, `(() => { const c = G.city.car; return !!c && N.controller.mode === 'drive' && Math.hypot(G.eye.x - c.pos.x, G.eye.z - c.pos.z) < (c.kind === 'lorry' || c.kind === 'van' || c.kind === 'truck' ? 2.4 : 1.0) && G.eye.y > 1.2; })()`, 9000);
    D.in[name] = await js(`(() => { const c = G.city.car; return { inCar: !!G.city.inCar, kind: c && c.kind, same: c === window.__seatTarget, mode: N.controller.mode, eye: [+G.eye.x.toFixed(2), +G.eye.y.toFixed(2), +G.eye.z.toFixed(2)], carPos: c ? [+c.pos.x.toFixed(2), +c.pos.y.toFixed(2), +c.pos.z.toFixed(2)] : null, seated: !!c && Math.hypot(G.eye.x - c.pos.x, G.eye.z - c.pos.z) < (c.kind === 'lorry' || c.kind === 'van' || c.kind === 'truck' ? 2.4 : 1.0) }; })()`);   // (a lorry's cab sits well ahead of its centre)
    await sleep(1600);
    await shot(name); D.frames.push(name);
    log(`${name}: ${JSON.stringify(D.in[name])}`);
  };
  const getOut = async (name) => {
    for (let k = 0; k < 2 && (await js('!!(G.city && G.city.inCar)')); k++) { await tap(api, 'KeyE', 1200); await waitFor(js, '!(G.city && G.city.inCar)', 4000); }
    if (await js('!!(G.city && G.city.inCar)')) {   // (out by hand: the walk beside the car, the drive hands away)
      await js(`(() => { const car = G.city.car; const cy = Math.cos(car.yaw), sy = Math.sin(car.yaw), lx = -0.2, lz = -2.6; const px = car.pos.x + lx * cy + lz * sy, pz = car.pos.z - lx * sy + lz * cy; N.controller.setMode('walk', { pose: { x: px, z: pz, yaw: 0, pitch: -0.05 }, ease: 0.2 }); G.player.hands.equip('empty'); G.setViewmodelVisible(false); G.city.inCar = false; if (window.__seatCar0) { G.vehicles.setPlayer(window.__seatCar0); G.city.car = window.__seatCar0; } G.emit('city:out', { car }); return 1; })()`);
      await waitFor(js, "N.controller.mode === 'walk'", 3000);
    }
    D.out[name] = await js('!(G.city && G.city.inCar)');
    await sleep(900);
  };
  await waitFor(js, '!G.failing', 15000);
  if (await js('G.city && G.city.inCar')) await getOut('start');
  // the ring of spawn places: on the road ahead of my coupe, and me on the pavement beside each
  await js(`(() => { const c = G.city.car, me = N.controller.pos; const fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw); window.__seat = { c0: { x: c.pos.x, z: c.pos.z, yaw: c.yaw }, fx, fz, off: { x: me.x - c.pos.x, z: me.z - c.pos.z } }; return 1; })()`);
  // 1. a coupe (spawned like the others: my own car's door zone is its own rule), 2. the same coupe after
  // O6b's damage (the bonnet sprung, the left door hanging), 3. a sedan, 4. a truck: each on the road 14 m
  // ahead of my car, me at its left door
  const fleet = await js('!!(G.wheels && G.wheels.carAt)');
  const KINDS = fleet ? ['coupe', 'coupe_damaged', 'saloon', 'taxi', 'police', 'hearse', 'van', 'lorry'] : ['coupe', 'coupe_damaged', 'sedan', 'truck'];
  log(`kinds: ${KINDS.join(', ')} (${fleet ? "O2's fleet" : 'the base'})`);
  for (const kind of KINDS) {
    if (kind === 'coupe_damaged') {
      const dmg = await js(`(() => { const S = G.stage.smash && G.stage.smash.cars, c = window.__seatCar; if (!S || !c) return 'no smash or car'; const Dm = S.byCar.get(c) || S.attach(c); try { S.popHood(Dm, 0.8); } catch (e) { return 'popHood: ' + e.message; } try { S.hangDoor(Dm, 0); } catch (e) { return 'hangDoor: ' + e.message; } return { hood: !!Dm.hood, door: !!Dm.doors[0] }; })()`);
      log('damage: ' + JSON.stringify(dmg));
      await sleep(1200);
      await getIn('seat_' + kind, 'window.__seatCar');
      await getOut('seat_' + kind);
      await js(`(() => { const v = window.__seatCar; if (v) G.vehicles.remove(v); window.__seatCar = null; return 1; })()`);
      await sleep(600);
      continue;
    }
    const r = await js(`(() => { const W = window.__seat; const at = { x: W.c0.x + W.fx * 14, z: W.c0.z + W.fz * 14 }; const v = G.wheels && G.wheels.carAt ? G.wheels.carAt(at.x, at.z, '${kind}', { yaw: W.c0.yaw, lights: true }) : G.vehicles.spawn('${kind}', { at, yaw: W.c0.yaw, lights: true }); window.__seatCar = v; N.controller.setPose(at.x + W.off.x, at.z + W.off.z, 0, -0.03); return { kind: v && v.kind, variant: v && (v.variant || v.look || null), at: [+at.x.toFixed(1), +at.z.toFixed(1)] }; })()`);
    log(`spawned ${JSON.stringify(r)}`);
    await sleep(800);
    await getIn('seat_' + kind, 'window.__seatCar');
    await getOut('seat_' + kind);
    if (kind === 'coupe') continue;   // (kept for the damage frame)
    await js(`(() => { const v = window.__seatCar; if (v) G.vehicles.remove(v); window.__seatCar = null; N.controller.setPose(window.__seat.c0.x + window.__seat.off.x, window.__seat.c0.z + window.__seat.off.z, 0, -0.03); return 1; })()`);
    await sleep(600);
  }
  // 5. the base's police car (a patrol sedan) where there is no fleet
  if (!fleet) {
  const pr = await js(`(() => { const W = window.__seat; if (!G.police || !G.police.spawnCarAt) return 'no police.spawnCarAt'; const at = { x: W.c0.x + W.fx * 14, z: W.c0.z + W.fz * 14 }; const pc = G.police.spawnCarAt(at.x, at.z, W.c0.yaw, 'patrol'); try { pc.park(); pc.mode = 'stopped'; pc.stopT = pc.t; pc.siren = false; } catch (e) {} window.__seatPc = pc; window.__seatCar = pc.v || pc.vehicle || pc; N.controller.setPose(at.x + W.off.x, at.z + W.off.z, 0, -0.03); return { role: pc.role, kind: (pc.v || {}).kind, crew: pc.crew && pc.crew.length }; })()`);
  log(`police car ${JSON.stringify(pr)}`);
  await sleep(1500);
  await getIn('seat_police', 'window.__seatCar');
  await getOut('seat_police');
  await js(`(() => { const pc = window.__seatPc; try { if (pc && pc.dispose) pc.dispose(); } catch (e) {} if (G.police) G.police.clear('test'); return 1; })()`);
  }
  D.errlog = await js(`(document.getElementById('errlog') || {}).textContent || '(clean)'`);
  log(`frames ${D.frames.join(', ')}; in the right car's seat ${Object.values(D.in).filter((x) => x && x.inCar && x.same && x.seated).length}/${D.frames.length} (${D.byHand || 0} seated by hand); errlog ${D.errlog.slice(0, 200)}`);
  return D;
}
