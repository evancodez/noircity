// [O7] The night's feel measure (GAME_TWO §1 A1): the latency of its verbs,
// from the trusted key event to the first frame that shows the act:
//   M     the map on the pause card (the card drawn, the game held)
//   Tab   the heat, the money, the car, the hour (Tab's lines up)
//   F     the radio's dial (in the car: the station's name up)
//   E     into the car (city.js; the autosave rides on it: the frame the seat is taken)
// { "drive": "tools/lib/o7_night.mjs", "check": "D.map.ms < 50 && ..." }
export default async function night({ js, keyDown, keyUp, sleep, log }) {
  const arm = async (what, cond) => js(`(() => {
    const L = window.__lat = { what: ${JSON.stringify(what)}, key: 0, frame: 0, frames: 0 };
    const onKey = () => { if (!L.key) L.key = performance.now(); };
    addEventListener('keydown', onKey, { capture: true, once: true });
    const done = () => (${cond});
    const tick = () => {
      if (L.key) L.frames++;
      if (L.key && done()) { L.frame = performance.now(); return; }
      if (performance.now() - (L.key || performance.now()) < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return 1; })()`);
  const read = async () => { await sleep(500); return js('(() => { const L = window.__lat; return { what: L.what, ms: L.frame && L.key ? +(L.frame - L.key).toFixed(1) : null, frames: L.frames }; })()'); };
  const press = async (code, hold = 60) => { await keyDown(code); await sleep(hold); await keyUp(code); };
  const out = {};
  await arm('map', "G.night.map.open && !document.querySelector('#pausecard').classList.contains('hidden')");
  await keyDown('KeyM'); out.map = await read(); await keyUp('KeyM');
  await sleep(300); await press('KeyM'); await sleep(500);
  await arm('tab', "!!document.querySelector('#hud .ntab.up')");
  await keyDown('Tab'); out.tab = await read(); await keyUp('Tab');
  await sleep(500);
  await js("(N.controller.yaw = Math.atan2(-(G.city.car.pos.x - N.controller.pos.x), -(G.city.car.pos.z - N.controller.pos.z)), 1)");
  await sleep(400);
  await arm('in', 'G.city.inCar');
  await keyDown('KeyE'); out.in = await read(); await keyUp('KeyE');
  await sleep(1200);
  await arm('radio', "!!document.querySelector('#hud .nradio.up')");
  await keyDown('KeyF'); out.radio = await read(); await keyUp('KeyF');
  log(`latency: ${JSON.stringify(out)}`);
  return out;
}
