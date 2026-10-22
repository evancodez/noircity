// [B7] Scene 9's play by real input (tools/play.mjs { "drive": ... }): a
// player at a human's pace. He walks to the counter and takes the gun, puts
// the room's lights out at the switch, and fights each beat from a window
// or the door: a new man is seen a reaction time after he shows (0.25 ..
// 0.4 s), the view is turned onto his chest by trusted mouse moves at a
// hand's speed (with a small error), a burst is held while on him; the
// recoil is pulled back by the same loop. He reloads in the lulls, fetches
// drums from the counter when he has none left, backs off the window when
// he is hurt and comes back when he has his breath, shoots at a car that
// will not stop. At the end he walks out to the hat. Returns the run's
// record (time, deaths, beats reached, the end reached).
const STATIONS = {
  counter: [-13.3, 0.62], door: [-11.35, 0.62], B4: [-11.05, -3.2], B2: [-11.3, 5.0], sw: [-11.05, 1.55],
  // backing off a window: into the room, out of the street's lines
  cover: [-13.2, -1.6],
};
const BEAT_AT = { cars: 'B4', doorways: 'B2', el: 'B4', driveby: 'door', cardinal: 'B4', end: 'door' };
const AISLE = -12.75;

// [R2-F] profiles: 'sure' (the first pass's: a quick, sure shot) and
// 'first' (a first-timer: slower to see a man and to turn onto him, a hand
// that wanders - a slow sway of the sights of `sway` rad - no lead on a
// moving man or car, longer bursts, holds a window until badly hurt, never
// finds the light switch). The step's "profile" picks one.
// [R2-F, round 2] a first-timer also has a human's attention: he does not
// know where every man is - he sees one near where he is looking (`fov`, rad
// off the line of sight) or one whose muzzle flash he catches (within
// `flashFov`, for a second after it); with no one in sight he scans the
// street slowly instead of watching the next man's spot.
const PROFILES = {
  sure: { react: [250, 420], gain: 0.55, step: 0.16, sway: 0, lead: true, burst: [300, 650], tol: 1, hurt: 38, lights: true, fov: 9, flashFov: 9, scan: 0 },
  first: { react: [550, 950], gain: 0.34, step: 0.1, sway: 0.055, lead: false, burst: [600, 1200], tol: 1.8, hurt: 25, lights: false, fov: 0.42, flashFov: 1.0, scan: 0.7 },
};

export default async function drive({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts }) {
  const T0 = Date.now(), timeout = opts.timeout ?? 900000;
  const rr = (a, b) => a + (b - a) * Math.random();
  const P = PROFILES[opts.profile || 'sure'];
  const ph = [0, 1, 2, 3].map(() => Math.random() * 6.28);
  const sway = () => { const t = (Date.now() - T0) / 1000; return [P.sway * (0.6 * Math.sin(t * 1.3 + ph[0]) + 0.4 * Math.sin(t * 3.1 + ph[1])), 0.6 * P.sway * (0.6 * Math.sin(t * 1.7 + ph[2]) + 0.4 * Math.sin(t * 2.9 + ph[3]))]; };
  const cx = W / 2, cy = H / 2;
  const rec = { beats: [], deaths: 0, shots: 0, lights: false, drums: 0, ended: false };
  let wDown = false, fireUntil = 0, firing = false, target = null, seenAt = 0, route = null, mode = 'go', lastBeat = null;
  let coverUntil = 0, reloadAt = 0, eAt = 0, lastDeaths = 0, shotsTaken = new Set();
  const setW = async (on) => { if (on !== wDown) { wDown = on; await (on ? keyDown('KeyW') : keyUp('KeyW')); } };
  const fire = async (on) => {
    if (on === firing) return;
    firing = on;
    await mouse(on ? 'mousePressed' : 'mouseReleased', cx, cy, 'left');
  };
  const tap = async (code) => { await keyDown(code); await sleep(50); await keyUp(code); };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // the page's state, one read a loop
  const ST = `(() => {
    const S = G.stage, C = N.controller, e = G.eye, Wp = G.weapon, sc = G.scenes, R = G.b7;
    const V = N.THREE.Vector3;
    const skip = (en) => !!(en.mesh.userData.pane);
    const men = [];
    for (const h of S.hoods.list) {
      if (!h.alive) continue;
      const c = new V().setFromMatrixPosition(h.bones.chest.matrixWorld);
      const d = c.clone().sub(e), L = d.length(); d.divideScalar(L);
      const hit = G.rays.raycast(e, d, Math.max(0.1, L - 0.4), { anyHit: true, skip });
      men.push({ i: h.__b7id || (h.__b7id = (G.__b7n = (G.__b7n || 0) + 1)), x: c.x, y: c.y, z: c.z, d: L, los: !hit && L < 55, vx: h._vel ? h._vel.x : 0, vz: h._vel ? h._vel.z : 0, fl: G.time - (h.__b7fl ?? -99) });
    }
    const cars = S.cars.cars.filter((c) => c.rail && !c.rail.done && c.state !== 'burning' && !c.rail.crash && c.rail.v > 3).map((c) => {
      const p = new V(1.45, 0.95, 0).applyMatrix4(c.group.matrixWorld);
      const d = p.clone().sub(e), L = d.length();
      return { x: p.x, y: p.y, z: p.z, d: L, vx: Math.cos(c.yaw) * c.rail.v, vz: -Math.sin(c.yaw) * c.rail.v, pts: c.pts };
    });
    return {
      scene: sc.current && sc.current.id, beat: sc.beat, trans: !!sc.trans, state: G.state, end: G.hud.endShown,
      x: C.pos.x, z: C.pos.z, ex: e.x, ey: e.y, ez: e.z, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, mode: C.mode, frozen: C.frozen,
      ammo: Wp.ammo, reloading: Wp.reloading, set: G.hands.set, hp: G.health.hp, prompt: G.hud.promptShown,
      reserve: R ? R.reserve : 0, taken: R ? R.gunTaken : false, lights: R ? R.lightsOn : true, dying: !!(R && R.dying),
      hat: R && R.hat ? [R.hat.rest.x, R.hat.rest.z] : null, deaths: G.counters.deaths, men, cars,
    };
  })()`;
  // turn the view toward (yaw, pitch) at a hand's pace; returns the error
  const aimAt = async (s, yaw, pitch, gain = 0.55, maxStep = 0.16) => {
    const ey = wrap(yaw - s.yaw), ep = pitch - s.pitch;
    const dy = Math.max(-maxStep, Math.min(maxStep, ey * gain)) + (Math.random() - 0.5) * 0.004;
    const dp = Math.max(-maxStep, Math.min(maxStep, ep * gain)) + (Math.random() - 0.5) * 0.003;
    const mx = Math.round(-dy / s.sens), my = Math.round(-dp / s.sens);
    if (mx || my) await turn(mx, my);
    return Math.hypot(ey, ep);
  };
  const lookYaw = (s, x, z) => Math.atan2(-(x - s.ex), -(z - s.ez));
  const lookPitch = (s, x, y, z) => Math.atan2(y - s.ey, Math.hypot(x - s.ex, z - s.ez));
  // a route inside the room: out to the aisle, along it, in to the place
  const routeTo = (s, [x, z]) => {
    const pts = [];
    const inRoom = (px) => px < -10.5;
    if (inRoom(s.x) && inRoom(x) && Math.abs(z - s.z) > 1.2) { pts.push([AISLE, s.z], [AISLE, z]); }
    pts.push([x, z]);
    return pts;
  };
  const walkStep = async (s) => {
    if (!route || !route.length) { await setW(false); return true; }
    const [x, z] = route[0];
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d < 0.35) { route.shift(); if (!route.length) { await setW(false); return true; } return false; }
    const err = await aimAt(s, Math.atan2(-dx, -dz), Math.max(-0.2, Math.min(0.1, s.pitch)) * 0.5, 0.5, 0.2);
    await setW(err < 0.5);
    return false;
  };

  // (the play's own instruments, in the page: each man's last muzzle flash,
  // and the men's aimed rounds - rolled to hit, and landed)
  await js(`(() => { if (G.__b7inst) return; G.__b7inst = { aimed: 0, rolled: 0, landed: 0 };
    const fl = G.fx.flash, h0 = fl.hood.bind(fl); fl.hood = (h, ...a) => { h.__b7fl = G.time; return h0(h, ...a); };
    const rs = G.resolveShot.bind(G); G.resolveShot = (s) => { const n = G.counters.hoodHits; rs(s); if (s.hit) G.__b7inst.rolled++; if (G.counters.hoodHits > n) G.__b7inst.landed++; };
    const hf = G.hoodFire.bind(G); G.hoodFire = (ai, t) => { G.__b7inst.aimed++; return hf(ai, t); }; })()`);
  const noticed = new Set();
  while (Date.now() - T0 < timeout) {
    const s = await js(ST);
    if (!s || s.__exc) { await sleep(200); continue; }
    if (s.end || s.state === 'end') { rec.ended = true; break; }
    if (s.scene !== 'shootout' || s.trans || s.dying) { await setW(false); await fire(false); target = null; route = null; await sleep(120); continue; }
    if (s.deaths > lastDeaths) { lastDeaths = s.deaths; rec.deaths++; route = null; mode = 'go'; log(`b7 play: down in ${s.beat}`); }
    if (s.beat !== lastBeat) { rec.at = rec.at || {}; rec.at[s.beat] = { t: +((Date.now() - T0) / 1000).toFixed(0), K: await js('(() => { const K = G.counters; return [K.damageTaken, K.hoodShots, K.hoodHits, K.kills, K.shots]; })()') }; lastBeat = s.beat; rec.beats.push(s.beat); route = null; mode = 'go'; log(`b7 play: beat ${s.beat} at ${((Date.now() - T0) / 1000).toFixed(0)} s`); if (!shotsTaken.has(s.beat)) { shotsTaken.add(s.beat); await shot('b7_' + s.beat); } }
    if (s.frozen || s.mode === 'cutscene') { await setW(false); await fire(false); await sleep(100); continue; }
    const now = Date.now();
    // ---- the gun on the counter ------------------------------------------------------
    if (!s.taken) {
      if (!route && mode === 'go') route = routeTo(s, STATIONS.counter);
      if (!(await walkStep(s))) { await sleep(33); continue; }
      mode = 'take';
      await aimAt(s, Math.PI / 2, -0.55);
      if (s.prompt.includes('take it') && now > eAt) { eAt = now + 1500; await sleep(rr(350, 700)); await tap('KeyE'); }
      await sleep(33);
      continue;
    }
    // ---- the lights, once ------------------------------------------------------------------
    if (P.lights && s.lights && !rec.lights && (s.beat === 'arrive' || s.beat === 'cars')) {
      if (mode !== 'lights') { mode = 'lights'; route = routeTo(s, STATIONS.sw); }
      if (!(await walkStep(s))) { await sleep(33); continue; }
      await aimAt(s, lookYaw(s, -10.46, 1.62), lookPitch(s, -10.46, 1.42, 1.62));
      if (s.prompt.includes('lights') && now > eAt) { eAt = now + 1200; await sleep(rr(250, 500)); await tap('KeyE'); rec.lights = true; mode = 'go'; route = null; }
      await sleep(33);
      continue;
    }
    // ---- the end: out to the hat -----------------------------------------------------------
    if (s.beat === 'end' && s.hat && !s.men.length) {
      await fire(false);
      if (mode !== 'out') { mode = 'out'; route = [...routeTo(s, STATIONS.door), [-9.2, 0.62], [s.hat[0] - 0.4, s.hat[1] + 1.2]]; }
      await walkStep(s);
      await sleep(33);
      continue;
    }
    // ---- drums from the counter --------------------------------------------------------------
    if (s.reserve === 0 && s.ammo < 12 && !s.reloading && mode !== 'drums' && !s.men.some((m) => m.los && m.d < 9)) { mode = 'drums'; route = routeTo(s, STATIONS.counter); await fire(false); }
    if (mode === 'drums') {
      if (!(await walkStep(s))) { await sleep(33); continue; }
      await aimAt(s, Math.PI / 2, -0.4);
      if (s.prompt.includes('drums') && now > eAt) { eAt = now + 1500; await sleep(rr(200, 400)); await tap('KeyE'); }
      if (s.reserve > 0) { rec.drums++; mode = 'go'; route = null; if (s.ammo < 50) await tap('KeyR'); }
      await sleep(33);
      continue;
    }
    // ---- hurt: back off the window until the breath comes back -----------------------------
    if (s.hp < P.hurt && mode !== 'cover') { mode = 'cover'; route = routeTo(s, STATIONS.cover); coverUntil = now + 9000; await fire(false); }
    if (mode === 'cover') {
      const arrived = await walkStep(s);
      if (arrived && s.ammo < 50 && !s.reloading && s.reserve > 0 && now > reloadAt) { reloadAt = now + 3000; await tap('KeyR'); }
      if (arrived) { const m = s.men.find((q) => q.los && q.d < 8); if (m) await engage(s, m); else await fire(false); }
      if ((s.hp > 82 || now > coverUntil + 6000) && now > coverUntil - 6000) { mode = 'go'; route = null; }
      await sleep(33);
      continue;
    }
    // ---- to the beat's place -----------------------------------------------------------------
    const st = STATIONS[BEAT_AT[s.beat] || 'door'];
    if (mode === 'go') { route = routeTo(s, st); mode = 'walk'; }
    if (mode === 'walk') {
      // (a man close by is dealt with on the way)
      const close = s.men.find((m) => m.los && m.d < 7);
      if (close) { await setW(false); await engage(s, close); await sleep(33); continue; }
      if (await walkStep(s)) mode = 'fight';
      await sleep(33);
      continue;
    }
    // ---- fighting from the place -----------------------------------------------------------
    // a car that will not stop: its engine
    const car = s.cars.filter((c) => c.d < 32).sort((a, b) => a.d - b.d)[0];
    // (what he has noticed: near where he looks, or a flash he caught)
    const off = (q) => Math.hypot(wrap(lookYaw(s, q.x, q.z) - s.yaw), lookPitch(s, q.x, q.y, q.z) - s.pitch);
    for (const q of s.men) if (q.los && (off(q) < P.fov || (q.fl < 1.0 && off(q) < P.flashFov) || q.d < 7)) noticed.add(q.i);
    const seen = s.men.filter((q) => q.los && noticed.has(q.i)).sort((a, b) => a.d - b.d);
    let m = null;
    if (target != null) m = seen.find((q) => q.i === target) || null;
    if (!m && seen.length) { m = seen[0]; if (target !== m.i) { target = m.i; seenAt = now + rr(P.react[0], P.react[1]); } }
    if (!m) target = null;
    if (car && (!m || m.d > 12)) {
      // (lead it a little)
      const lead = P.lead ? car.d / 60 + 0.12 : 0;
      const px = car.x + car.vx * lead, pz = car.z + car.vz * lead;
      const [sy, sp] = sway();
      const err = await aimAt(s, lookYaw(s, px, pz) + sy, lookPitch(s, px, car.y, pz) + sp, P.gain + 0.05, P.step + 0.04);
      await fire(err < 0.05 && s.ammo > 0);
    } else if (m && now > seenAt) {
      await engage(s, m);
    } else {
      await fire(false);
      // the lull: reload, or look out at the street
      if (s.ammo < 25 && !s.reloading && s.reserve > 0 && now > reloadAt) { reloadAt = now + 3200; await tap('KeyR'); }
      else if (!s.reloading) {
        // (a first-timer scans the street slowly for the next man)
        const sc = P.scan * Math.sin((now - T0) / 1000 * 0.45);
        await aimAt(s, -Math.PI / 2 + (s.beat === 'el' ? 0.2 : 0) + sc, (s.beat === 'el' ? 0.3 : 0.02) + 0.08 * Math.abs(sc), 0.25, 0.08);
      }
    }
    await sleep(33);
  }
  await setW(false); await fire(false);
  rec.time = +((Date.now() - T0) / 1000).toFixed(0);
  rec.K = await js('(() => { const K = G.counters; return { damageTaken: K.damageTaken, hoodShots: K.hoodShots, hoodHits: K.hoodHits, kills: K.kills, shots: K.shots, hits: K.hits, deaths: K.deaths, explosions: K.explosions, windows: K.windows }; })()');
  rec.profile = opts.profile || 'sure';
  rec.inst = await js('G.__b7inst');
  rec.hitRate = rec.K && rec.K.shots ? +(rec.K.hits / rec.K.shots).toFixed(3) : null;
  rec.gameTime = await js(`(() => { const e = document.getElementById('counters'); const K = e ? JSON.parse(e.dataset.json || '{}') : {}; return K.play != null ? +(+K.play).toFixed(1) : null; })()`);
  return rec;

  // hold a burst on a man's chest while on him
  async function engage(s, m) {
    const lead = P.lead ? m.d / 80 : 0;
    const px = m.x + m.vx * lead, pz = m.z + m.vz * lead;
    const [sy, sp] = sway();
    const err = await aimAt(s, lookYaw(s, px, pz) + sy, lookPitch(s, px, m.y, pz) + sp, P.gain, P.step + 0.02);
    const now = Date.now();
    if (s.ammo === 0) { await fire(false); if (!s.reloading && s.reserve > 0 && now > reloadAt) { reloadAt = now + 3200; await tap('KeyR'); } return; }
    if (err < (0.035 + 0.3 / Math.max(4, m.d) * 0.1) * P.tol) { if (!firing) { fireUntil = now + rr(P.burst[0], P.burst[1]); rec.shots++; } await fire(true); }
    if (firing && now > fireUntil) { await fire(false); await sleep(rr(120, 260)); }
  }
}
