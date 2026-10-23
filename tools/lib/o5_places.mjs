// [O5] NOIR CITY's places, proved by real input (tools/play.mjs's module driver):
//   { "drive": "tools/lib/o5_places.mjs", "mode": "tour" | "memory", "sites": ["gym", ...] }
// tour     for each place: stand 3 m out from its street door facing it (a
//          set-up between visits, as a tool's teleport; the rest is keys and
//          the mouse), E - the latency from the trusted key to the first frame
//          the leaf moves -, walk in (W), inside?, the car outside still where
//          it was, the heat kept (the crimes counted, none lost), every thing
//          that looks usable tried (each door, seat, use of the room: stand
//          before it looking at it, E, the answer it gave: a message, money,
//          a seat taken, a door's state), the jank walk (into each wall of the
//          room the door opens on: stopped short, never inside a box), and out
//          by the door again; nothing loaded twice.
// memory   enter and leave every place twice (in by its door, out to 70 m):
//          the heap after a collection and the renderer's geometries and
//          textures at the start, after the first round and after the second.
export default async function places(api) {
  if (api.opts.mode === 'memory') return memory(api);
  return tour(api);
}

const press = async ({ keyDown, keyUp, sleep }, code, ms = 70) => { await keyDown(code); await sleep(ms); await keyUp(code); };

async function install(js) {
  await js(`(() => {
    if (window.__o5) return 1;
    const R = window.__o5 = { lat: [], loads: {}, drops: {}, crimes: 0, money: [], msgs: [] };
    G.on('places:load', (e) => { R.loads[e.id] = (R.loads[e.id] || 0) + 1; });
    G.on('places:drop', (e) => { R.drops[e.id] = (R.drops[e.id] || 0) + 1; });
    G.on('crime', () => { R.crimes++; });
    G.on('money', (e) => { R.money.push(e.n); });
    const m0 = G.hud.message.bind(G.hud);
    G.hud.message = (t, s) => { R.msgs.push(t); R.lastMsg = t; return m0(t, s); };
    // (the door's latency: a trusted keydown's time, then the first frame its leaf has moved)
    addEventListener('keydown', (e) => { if (e.code === 'KeyE' && R.watch) { R.watch.t0 = performance.now(); R.watch.a0 = R.watch.door.angle; } }, true);
    const tick = () => { const W = R.watch; if (W && W.t0 != null && W.t1 == null && Math.abs(W.door.angle - W.a0) > 1e-4) { W.t1 = performance.now(); W.frames = W.n; } if (W && W.t0 != null) W.n = (W.n || 0) + 1; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return 1; })()`);
}

async function tour(api) {
  const { js, sleep, log, opts } = api;
  await install(js);
  const ids = opts.sites || (await js('G.city.places.list.map((s) => s.id)'));
  const out = [];
  for (const id of ids) {
    const r = { id, uses: [], jank: [] };
    // stand 3 m out from the door, facing it; the car parked behind me at the kerb
    // [O5b] (its loads counted from its own turn: a place seen from further off - the hospital, 80 m - is loaded passing another's door)
    await js(`(window.__o5.loads[${JSON.stringify(id)}] = (G.city.places.byId.get(${JSON.stringify(id)}).live ? 1 : 0), 1)`);
    const setup = await js(`(() => { const P = G.city.places, s = P.byId.get(${JSON.stringify(id)}); const d = s.door;
      const x = d.x + d.nx * 3.0, z = d.z + d.nz * 3.0; G.stage.part('stream').warmAround(x, z);
      N.controller.setPose(x, z, Math.atan2(d.nx, d.nz), 0.12);   // [O5b] (looking at the door, not at a thing on the pavement before it)
      const c = G.city.car; if (c && !G.city.inCar) { c.pos.set(x + d.nx * 2.2 + d.nz * 2.0, 0, z + d.nz * 2.2 - d.nx * 2.0); c.vel.set(0, 0, 0); c.sync && c.sync(); }
      window.__o5.carAt = c ? [c.pos.x, c.pos.z] : null; window.__o5.crimes0 = window.__o5.crimes; return { x, z }; })()`);
    await sleep(2200);
    // E at the door: the latency to the leaf's first move
    await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const D = s.live && s.live.street && s.live.street[0]; window.__o5.watch = D ? { door: D } : null; return !!D; })()`);
    const prompt = await js('G.hud.promptShown');
    await press(api, 'KeyE');
    await sleep(500);
    const lat = await js('(() => { const W = window.__o5.watch; return W ? { ms: W.t1 != null ? +(W.t1 - W.t0).toFixed(1) : null, frames: W.frames ?? null, open: +W.door.angle.toFixed(2) } : null; })()');
    r.prompt = prompt; r.latency = lat;
    // walk in
    await api.keyDown('KeyW'); await sleep(1700); await api.keyUp('KeyW'); await sleep(400);
    r.inside = await js(`G.city.places.inside ? G.city.places.inside.id : null`);
    r.street = await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const D = s.live.street[0]; return { open01: +D.open01.toFixed(2), roomShown: s.live.K.group.visible }; })()`);
    // every thing that looks usable: stand before it, look at it, E
    const things = await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const K = s.live.K, F = s.frame;
      const L = [];
      for (const D of K.doors) L.push({ kind: 'door', name: D.name, at: [D.centre.x, D.centre.y + 0.2, D.centre.z], lvl: D.lvl, street: !!D.street });
      K.seats.forEach((S, i) => { if (S.tourSkip) return; const a = S.at ? F.v(S.at[0], S.at[1], S.at[2]) : F.v(S.x, S.eyeY - 0.5, S.z); L.push({ kind: 'seat', name: S.name || ('seat' + i), at: [a.x, a.y, a.z], lvl: S.lvl, i, tour: S.tourAt || null }); });
      K.uses.forEach((U, i) => { if (U.seated || U.atFn || U.tourSkip) return; const a = F.v(U.at[0], U.at[1], U.at[2]); L.push({ kind: 'use', name: typeof U.prompt === 'string' ? U.prompt : ('use' + i), at: [a.x, a.y, a.z], lvl: U.lvl, i, tour: U.tourAt || null }); });
      return L; })()`);
    for (const th of things) {
      if (th.lvl != null && th.lvl > 0) { r.uses.push({ ...th, skipped: 'upstairs (the floor plays)' }); continue; }
      // stand 1.3 m from it on the side the room is (toward the room's middle), looking at it
      const ok = await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const F = s.frame, R = s.live.K.roomRect || { x0: -2, x1: 2, z0: -6, z1: -0.3 };
        const t = F.l(${th.at[0]}, ${th.at[2]}); const c = { x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2 };
        let dx = c.x - t.x, dz = c.z - t.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        let px = t.x + dx * 1.25, pz = t.z + dz * 1.25;
        px = Math.max(R.x0 + 0.35, Math.min(R.x1 - 0.35, px)); pz = Math.max(R.z0 + 0.35, Math.min(R.z1 - 0.35, pz));
        // [O5b] (a thing out of the room's main rect - the diner's jukebox, a cell's bench, a ward's bed - says where to stand: tourAt)
        const ta = ${JSON.stringify(th.tour)}; if (ta) { px = ta[0]; pz = ta[1]; }
        const w = F.w(px, pz), q = { x: w.x, z: w.z }; G.stage.colliders.resolve(q, 0.3);
        const ey = 0.3 + 1.63, yaw = Math.atan2(-(${th.at[0]} - q.x), -(${th.at[2]} - q.z)), pitch = Math.atan2(${th.at[1]} - ey, Math.hypot(${th.at[0]} - q.x, ${th.at[2]} - q.z));
        if (G.city.places.seat) G.city.places.stand();
        N.controller.setPose(q.x, q.z, yaw, Math.max(-0.9, Math.min(0.6, pitch)), 0.3); window.__o5.lastMsg = null; window.__o5.m0 = G.save.money || 0; return 1; })()`);
      void ok;
      await sleep(450);
      const before = await js('({ prompt: G.hud.promptShown, cur: G.interact.current ? G.interact.current.prompt : null })');
      await press(api, 'KeyE');
      await sleep(900);
      const after = await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const D = ${th.kind === 'door' ? `s.live.K.doors.find((d) => d.name === ${JSON.stringify(th.name)})` : 'null'};
        return { msg: window.__o5.lastMsg, money: (G.save.money || 0) - window.__o5.m0, seated: !!G.city.places.seat, mode: N.controller.mode, door: D ? { open: !D.shut, locked: D.locked } : null, card: !!(G.night && G.night.bounty && G.night.bounty.open), sleep: !!G.city.places.sleeping }; })()`);
      // [O5b] (the hall's board opens the WANTED card: put back by E; a ward's bed is a sleep: 4 s of black)
      if (after.card) { after.msg = 'the WANTED card'; await press(api, 'KeyE'); await sleep(600); }
      if (after.sleep) { after.msg = 'a sleep (Slept. Saved.)'; for (let k = 0; k < 20 && (await js('!!G.city.places.sleeping')); k++) await sleep(400); }
      const answer = after.door ? (after.door.locked ? `rattles, locked${after.msg ? ' (' + after.msg + ')' : ''}` : after.door.open ? 'opens' : 'shuts') : after.seated ? 'sat' : after.msg ? after.msg : after.money ? `$${after.money}` : (after.mode !== 'walk' ? after.mode : 'nothing seen');
      r.uses.push({ kind: th.kind, name: th.name, prompt: before.prompt || before.cur, answer });
      log(`  ${id} ${th.kind} ${th.name}: [${before.prompt || before.cur || 'no prompt'}] -> ${answer}`);
      // (a seat: its own uses, then up again by E)
      if (after.seated) {
        const su = await js(`(() => { const S = G.city.places.seat; const K = G.city.places.byId.get(${JSON.stringify(id)}).live.K; return K.uses.filter((u) => u.seated === S).length; })()`);
        for (let k = 0; k < su; k++) {
          await js(`(() => { const S = G.city.places.seat, s = G.city.places.byId.get(${JSON.stringify(id)}), K = s.live.K, F = s.frame; const U = K.uses.filter((u) => u.seated === S)[${k}]; const a = F.v(U.at[0], U.at[1], U.at[2]); const C = N.controller; C.yaw = Math.atan2(-(a.x - G.eye.x), -(a.z - G.eye.z)); C.pitch = Math.atan2(a.y - G.eye.y, Math.hypot(a.x - G.eye.x, a.z - G.eye.z)); window.__o5.lastMsg = null; window.__o5.m0 = G.save.money || 0; return 1; })()`);
          await sleep(400);
          const p2 = await js('G.hud.promptShown');
          await press(api, 'KeyE'); await sleep(800);
          const a2 = await js('({ msg: window.__o5.lastMsg, money: (G.save.money || 0) - window.__o5.m0 })');
          r.uses.push({ kind: 'seated', name: p2, answer: a2.msg || (a2.money ? `$${a2.money}` : 'done') });
          log(`    seated: [${p2}] -> ${a2.msg || a2.money}`);
        }
        await js('(() => { const C = N.controller; C.yaw += 2.6; C.pitch = 0.4; return 1; })()');
        await sleep(300);
        await press(api, 'KeyE'); await sleep(700);
        r.uses.push({ kind: 'stand', answer: (await js('G.city.places.seat')) ? 'still seated' : 'up' });
      }
      // (a door opened: shut it again behind me)
      if (after.door && after.door.open && !th.street) { await press(api, 'KeyE'); await sleep(600); }
    }
    // the jank walk: from the room's middle into each of its walls (W held)
    const R = await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); return s.live.K.roomRect || null; })()`);
    if (R) {
      for (const [nm, tx, tz] of [['back wall', (R.x0 + R.x1) / 2, R.z0 - 1], ['left wall', R.x0 - 1, (R.z0 + R.z1) / 2], ['right wall', R.x1 + 1, (R.z0 + R.z1) / 2], ['front wall', (R.x0 + R.x1) / 2 + 2.5, R.z1 + 1]]) {
        await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}), F = s.frame, R = ${JSON.stringify(R)}; const c = F.w((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2), q = { x: c.x, z: c.z }; G.stage.colliders.resolve(q, 0.35); const t = F.w(${tx}, ${tz});
          if (G.city.places.seat) G.city.places.stand(); N.controller.setPose(q.x, q.z, Math.atan2(-(t.x - q.x), -(t.z - q.z)), 0, 0.3); return 1; })()`);
        await sleep(250);
        await api.keyDown('KeyW'); await sleep(Math.min(6000, 600 + Math.hypot(R.x1 - R.x0, R.z1 - R.z0) * 260)); await api.keyUp('KeyW'); await sleep(250);
        const j = await js(`(() => { const C = N.controller, col = G.stage.colliders; let inside = null;
          for (const o of col.near(C.pos.x, C.pos.z, 1)) { if (o.gone) continue; if (o.r != null) { if (Math.hypot(C.pos.x - o.x, C.pos.z - o.z) < o.r - 0.05) inside = o.tag; continue; } const dx = C.pos.x - o.cx, dz = C.pos.z - o.cz; const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; if (Math.abs(lx) < o.hx - 0.05 && Math.abs(lz) < o.hz - 0.05) inside = o.tag; }
          const s = G.city.places.byId.get(${JSON.stringify(id)}); const L = s.lot; const inLot = C.pos.x > L.x0 && C.pos.x < L.x1 && C.pos.z > L.z0 && C.pos.z < L.z1;
          return { inside, inLot, inRoom: G.city.places.inside === s, y: +C.groundY.toFixed(2) }; })()`);
        r.jank.push({ name: nm, ...j });
      }
    }
    // out by the street door: stand inside it, facing out, E if shut, W
    await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const d = s.door, F = s.frame; const p = F.w(0, -1.4);
      if (G.city.places.seat) G.city.places.stand(); N.controller.setPose(p.x, p.z, Math.atan2(-d.nx, -d.nz), 0, 0.3); return 1; })()`);
    await sleep(400);
    if (await js(`G.city.places.byId.get(${JSON.stringify(id)}).live.street[0].shut`)) { await press(api, 'KeyE'); await sleep(500); }
    await api.keyDown('KeyW'); await sleep(1600); await api.keyUp('KeyW'); await sleep(400);
    const end = await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const c = G.city.car, a = window.__o5.carAt; return { out: G.city.places.inside !== s, carMoved: c && a ? +Math.hypot(c.pos.x - a[0], c.pos.z - a[1]).toFixed(2) : null, crimes: window.__o5.crimes - window.__o5.crimes0, loads: window.__o5.loads[${JSON.stringify(id)}] || 0 }; })()`);
    Object.assign(r, end);
    log(`${id}: E->leaf ${lat ? lat.ms + ' ms (' + lat.frames + ' frames)' : 'n/a'}; in ${r.inside === id}; out ${end.out}; car moved ${end.carMoved} m; loads ${end.loads}; jank ${r.jank.map((j) => j.name + (j.inside ? ' INSIDE ' + j.inside : j.inLot && !j.inRoom ? ' IN THE LOT' : ' ok')).join(', ')}`);
    out.push(r);
  }
  const bad = [];
  for (const r of out) {
    if (r.inside !== r.id) bad.push(r.id + ': not inside');
    if (!r.out) bad.push(r.id + ': not out');
    if (!r.latency || r.latency.ms == null || r.latency.ms > 50) bad.push(r.id + ': latency ' + JSON.stringify(r.latency));
    if (r.loads > 1) bad.push(r.id + ': loaded ' + r.loads + ' times');
    if (r.carMoved != null && r.carMoved > 0.2) bad.push(r.id + ': the car moved');
    for (const j of r.jank) if (j.inside || (j.inLot && !j.inRoom)) bad.push(`${r.id} ${j.name}: ${j.inside ? 'inside ' + j.inside : 'out of the room into the lot'}`);
    for (const u of r.uses) if (u.answer === 'nothing seen' && u.kind !== 'stand') bad.push(`${r.id} ${u.kind} ${u.name}: no answer`);
  }
  return { sites: out.length, bad, out };
}

async function memory(api) {
  const { js, sleep, log, opts } = api;
  await install(js);
  const ids = opts.sites || (await js('G.city.places.list.map((s) => s.id)'));
  const read = async () => { await js('(() => { if (window.gc) window.gc(); return 1; })()'); await sleep(400); return js('({ heap: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, geo: N.renderer ? N.renderer.info.memory.geometries : G.pipeline.renderer.info.memory.geometries, tex: N.renderer ? N.renderer.info.memory.textures : G.pipeline.renderer.info.memory.textures, loaded: G.city.places.loaded.length, cast: G.stage.cast.list.length, hoods: G.stage.hoods.list.length, cols: G.stage.colliders.boxes.length + G.stage.colliders.circles.length, solids: G.stage.solids.length, looks: G.stage.lookVolumes.length, dry: G.stage.dry.length, lamps: G.stage.part("lamps").all.length })'); };
  const rounds = [await read()];
  for (let n = 0; n < 2; n++) {
    for (const id of ids) {
      await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const d = s.door; const x = d.x + d.nx * 3, z = d.z + d.nz * 3; G.stage.part('stream').warmAround(x, z); N.controller.setPose(x, z, Math.atan2(d.nx, d.nz), 0); return 1; })()`);
      await sleep(1400);
      await press(api, 'KeyE'); await sleep(500);
      await api.keyDown('KeyW'); await sleep(1500); await api.keyUp('KeyW'); await sleep(300);
      // away: 80 m along the street (the place is dropped)
      await js(`(() => { const s = G.city.places.byId.get(${JSON.stringify(id)}); const d = s.door; const x = d.x + d.nx * 80, z = d.z + d.nz * 80; G.stage.part('stream').warmAround(x, z); N.controller.setPose(x, z, 0, 0); return 1; })()`);
      await sleep(900);
    }
    rounds.push(await read());
    log(`memory after round ${n + 1}: ${JSON.stringify(rounds.at(-1))}`);
  }
  return { rounds };
}
