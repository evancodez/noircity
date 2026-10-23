// [O4] The feel measure (GAME_TWO §1 A1): the input-to-act latency of lane
// O4's main verbs, by real input. A test hook in the page notes, with
// performance.now(), the step each act starts on (the crowd brawl's own
// 'crowd:me' event; the gun mode's crouch and the weapon's reload and shot
// read once a step from game.scripts); the driver notes performance.now()
// just before it dispatches the press. The act is drawn at the end of that
// step's frame. { "drive": "tools/lib/o4_latency.mjs", "part": "fists" | "guns", "n": 12 }
export default async function drive({ js, keyDown, keyUp, mouse, log, sleep, W, H, opts, cursor }) {
  const at = () => (cursor ? cursor() : [W / 2, H / 2]);
  const n = opts.n ?? 12;
  await js(`(() => { window.__lat = []; const C = N.controller;
    if (!window.__latHooked) { window.__latHooked = true;
      G.on('crowd:me', (e) => window.__lat.push({ act: e.act, t: performance.now() }));
      G.on('crowd:hit', (e) => { if (e.by === 'me') window.__lat.push({ act: 'contact', t: performance.now() }); });
      G.on('shot', (e) => window.__lat.push({ act: 'shot:' + e.weapon, t: performance.now() }));
      let low = !!C.crouchOn, rel = false;
      G.scripts.push(() => { const w = G.player.weapons.active; const r = !!(w && w.reloading);
        if (!!C.crouchOn !== low) { low = !!C.crouchOn; window.__lat.push({ act: 'crouch', t: performance.now() }); }
        if (r && !rel) window.__lat.push({ act: 'reload', t: performance.now() }); rel = r; }); }
    return 1; })()`);
  const now = () => js('performance.now()');
  const first = async (t0, act, wait = 400) => {
    await sleep(wait);
    const L = await js('window.__lat');
    const e = (L || []).find((x) => x.t >= t0 && x.act === act);
    return e ? +(e.t - t0).toFixed(1) : null;
  };
  const stats = (a) => { const v = a.filter((x) => x != null).sort((p, q) => p - q); if (!v.length) return null; return { n: v.length, mean: +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1), max: v[v.length - 1], median: v[Math.floor(v.length / 2)] }; };
  const out = {};
  if ((opts.part || 'fists') === 'fists') {
    const jab = [], contact = [], block = [], hop = [], heavyWind = [], heavyGo = [];
    for (let i = 0; i < n; i++) {
      const b = i % 2 ? 'right' : 'left';
      const [x, y] = at();
      let t0 = await now(); await mouse('mousePressed', x, y, b); await sleep(70); await mouse('mouseReleased', x, y, b);
      jab.push(await first(t0, 'jab', 250)); contact.push(await first(t0, 'contact', 10));
      await sleep(250);
      t0 = await now(); await keyDown('Space'); await sleep(200); await keyUp('Space');
      block.push(await first(t0, 'block', 50));
      await sleep(200);
      t0 = await now(); await keyDown(i % 2 ? 'KeyA' : 'KeyD'); await sleep(50); await keyUp(i % 2 ? 'KeyA' : 'KeyD');
      hop.push(await first(t0, 'hop', 250));
      await sleep(300);
      // the heavy: held past 0.25 s (the wind), let go at 0.42 s (the blow)
      t0 = await now(); await mouse('mousePressed', x, y, b); await sleep(420);
      const t1 = await now(); await mouse('mouseReleased', x, y, b);
      heavyWind.push(await first(t0, 'wind', 10)); heavyGo.push(await first(t1, 'heavy', 300));
      await sleep(400);
    }
    Object.assign(out, { jab: stats(jab), jabContact: stats(contact), block: stats(block), hop: stats(hop), heavyWindFromPress: stats(heavyWind), heavyFromRelease: stats(heavyGo) });
  } else {
    const fire = [], crouch = [], reload = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = at();
      let t0 = await now(); await mouse('mousePressed', x, y, 'left'); await sleep(60); await mouse('mouseReleased', x, y, 'left');
      const w = await js('G.player.weapons.current');
      fire.push(await first(t0, 'shot:' + w, 400));
      await sleep(250);
      t0 = await now(); await keyDown('KeyC'); await sleep(50); await keyUp('KeyC');
      crouch.push(await first(t0, 'crouch', 250));
      await sleep(300);
      t0 = await now(); await keyDown('KeyR'); await sleep(50); await keyUp('KeyR');
      reload.push(await first(t0, 'reload', 300));
      await sleep(2000);
    }
    Object.assign(out, { weapon: await js('G.player.weapons.current'), fire: stats(fire), crouch: stats(crouch), reload: stats(reload) });
  }
  log('latency ' + JSON.stringify(out));
  return out;
}
