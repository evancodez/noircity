// [manager] the propagation and variety test for every merge check (the user's rules of
// 2026-10-23 in docs/briefs/O9_ALIVE.md 1b and 1c: knowledge of what I did travels like
// it would, not like a flag; nobody moves alike). One shot, and who knows, how far, how
// soon, and what each of them does about it:
//   { "drive": "tools/lib/mgr_prop.mjs", "site": "quay" | "grand", "secs": 45 }
// 'quay': the quay at night with nobody near - the shot raises no heat and draws nobody.
// 'grand': the GRAND - CENTRE stop of the el - the shot draws the stop's people, two
// reports and a patrol car; a man two blocks away never flinches; the dozen reacting do
// not all do the same thing the same way.
// D: { site, shotLogged, near45 (people within 45 m at the shot), reactors { near45, near60,
//      far120 (beyond 120 m: must be 0), stillAtEnd }, farMan { d0, flinched, gone, modes },
//      heatMax, reports { done, underWay, max }, police { events, carMinD, carMinT, siren },
//      newsAtOnce, variety { at3: { reactors, distinct, sameWay }, at6: {...}, modes, gaits,
//      speeds }, timeline: [[t, what]] }
const REACT = new Set(['flee', 'report', 'gather', 'cower', 'dash', 'watch', 'approach', 'stopped', 'hold']);
const SITES = {
  quay: `[60, 437, 0]`,
  grand: `(() => { const el = G.stage.part('el'); const S = el && el.stops ? el.stops.find((s) => /GRAND/.test(s.name)) : null; if (!S) return null;
    const P = G.people; let best = null, bd = 1e9;
    if (P && P.spots) for (const q of P.spots) { if (q.kind !== 'stop') continue; const d = Math.hypot(q.x - S.stair.x, q.z - S.stair.z); if (d < 70 && d < bd) { bd = d; best = q; } }
    const ax = best ? best.x : S.stair.x, az = best ? best.z : S.stair.z;
    const dx = S.x - ax, dz = S.z - az, l = Math.hypot(dx, dz) || 1;
    return [ax - dx / l * 6, az - dz / l * 6, Math.atan2(dx, dz), best ? 'stop' : 'stair']; })()`,
};
async function click({ mouse, cursor, sleep }, button = 'left', ms = 60) { const [x, y] = cursor(); await mouse('mousePressed', x, y, button); await sleep(ms); await mouse('mouseReleased', x, y, button); }
async function wheel(api) { await api.mouse('mouseWheel', ...api.cursor(), 'none', { deltaX: 0, deltaY: 100 }); await api.sleep(700); }
// (the wheel turns through what I own - fists, the revolver, more - so turn it until the gun is out, or until it is away)
const GUN = '!!(G.people && G.people.hands && G.people.hands.gunOut)';
async function draw(api) { for (let i = 0; i < 3; i++) { if (await api.js(GUN)) return true; await wheel(api); for (let k = 0; k < 8 && !(await api.js(GUN)); k++) await api.sleep(250); } return api.js(GUN); }
async function holster(api) { for (let i = 0; i < 4; i++) { if (!(await api.js(GUN))) return true; await wheel(api); await api.sleep(500); } return !(await api.js(GUN)); }
async function tap({ keyDown, keyUp, sleep }, code, ms = 70) { await keyDown(code); await sleep(ms); await keyUp(code); }
const waitFor = async (js, expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr)) return true; await new Promise((r) => setTimeout(r, 200)); } return false; };

export default async function propagation(api) {
  const { js, sleep, log, opts } = api;
  const site = opts.site || 'grand', secs = opts.secs ?? 45;
  const D = { site, shotLogged: false, near45: 0, reactors: { near45: 0, near60: 0, far120: 0, stillAtEnd: 0 }, farMan: null, heatMax: 0, reports: { done: 0, underWay: 0, max: 0 }, police: { events: [], carMinD: 999, carMinT: null, siren: false }, newsAtOnce: null, variety: { at3: null, at6: null, modes: [], gaits: [], speeds: null }, timeline: [] };
  await waitFor(js, '!G.failing', 15000);
  if (await js('G.city && G.city.inCar')) { await tap(api, 'KeyE'); await waitFor(js, '!G.city.inCar', 5000); await sleep(800); }
  if (await js('G.police && G.police.heat > 0')) { await js(`(G.police.clear('test'), 1)`); await sleep(500); }
  await holster(api);
  // (the test's precondition: the revolver in the coat with rounds - an arrest at the site before takes it)
  await js(`(() => { const S = G.save; S.inventory = S.inventory || []; if (!S.inventory.includes('revolver')) S.inventory.push('revolver'); S.ammo = S.ammo || {}; if (!(S.ammo.revolver > 0)) S.ammo.revolver = 12; return 1; })()`);
  const p = await js(SITES[site]);
  if (!p) { log(`propagation ${site}: no site found`); D.error = 'no site'; return D; }
  D.at = p.slice(0, 2).map((v) => +v.toFixed(0)); D.stood = p[3] || site;
  await js(`(G.stage.part('stream').warmAround(${p[0]}, ${p[1]}), N.controller.setPose(${p[0]}, ${p[1]}, ${p[2]}, -0.05), 1)`);
  await sleep(site === 'grand' ? 9000 : 4000);   // (the street fills: the stop's people stand)
  if (opts.empty) {   // (the rule's premise 'with nobody near': the people within 70 m let go before the shot)
    for (let k = 0; k < 3; k++) { const n = await js(`(() => { const me = N.controller.pos, P = G.people; let n = 0; if (P) for (const q of [...P.list]) { if (Math.hypot(q.pos.x - me.x, q.pos.z - me.z) < 70) { P.release(q); n++; } } return n; })()`); D.released = (D.released || 0) + n; if (!n) break; await sleep(1500); }
  }
  D.state0 = await js(`({ mode: N.controller.mode, frozen: !!N.controller.frozen, inCar: !!(G.city && G.city.inCar), crowd: !!(G.crowd && G.crowd.active), inv: G.save.inventory, ammo: G.save.ammo && G.save.ammo.revolver, beat: G.beat || null, state: G.state, weapon: G.player.weapons.current, phase: G.player.weapons.active && G.player.weapons.active.phase, copsNear: (() => { const me = N.controller.pos; let n = 0; for (const c of (G.police && G.police.cops) || []) if (c.standing && Math.hypot(c.pos.x - me.x, c.pos.z - me.z) < 45) n++; return n; })(), heat: G.police ? G.police.heat : 0 })`);
  // before the shot: who is where (a tag on each, since the list's order moves)
  const before = await js(`(() => { const me = N.controller.pos, P = G.people; window.__mgN = window.__mgN || 0; const out = { near45: 0, far: null, crimes: (G.crime && G.crime.log ? G.crime.log.length : 0), reports: P ? P.stats.reports : 0, events: G.police && G.police.events ? G.police.events.length : 0, news: null };
    try { out.news = G.city.news ? G.city.news.latest() : null; } catch (e) {}
    let bd = 1e9; if (P) for (const q of P.list) { if (!q.standing) continue; q.__mg = q.__mg || ++window.__mgN; const d = Math.hypot(q.pos.x - me.x, q.pos.z - me.z); if (d < 45) out.near45++; if (q.role === 'walker' && d > 150 && d < 320 && d < bd && !${JSON.stringify([...REACT])}.includes(q.mode)) { bd = d; out.far = { id: q.__mg, d0: +d.toFixed(0), mode: q.mode }; } }
    return out; })()`);
  D.near45 = before.near45; D.farMan = before.far ? { ...before.far, flinched: false, gone: false, modes: [before.far.mode] } : null;
  // the draw, then the shot
  const drawn = await draw(api);
  if (!drawn) { D.state1 = await js(`({ mode: N.controller.mode, frozen: !!N.controller.frozen, crowd: !!(G.crowd && G.crowd.active), inv: G.save.inventory, ammo: G.save.ammo && G.save.ammo.revolver, weapon: G.player.weapons.current, phase: G.player.weapons.active && G.player.weapons.active.phase, heat: G.police ? G.police.heat : 0, state: G.police ? G.police.state : null, events: G.police && G.police.events ? G.police.events.slice(-6).map((e) => e.what) : [] })`); D.timeline.push([0, 'the wheel did not draw: before ' + JSON.stringify(D.state0) + ' after ' + JSON.stringify(D.state1)]); }
  await sleep(600);
  const onDraw = await js(`(() => { const me = N.controller.pos, P = G.people; let n = 0; if (P) for (const q of P.list) { if (!q.standing) continue; const d = Math.hypot(q.pos.x - me.x, q.pos.z - me.z); if (d < 45 && ${JSON.stringify([...REACT])}.includes(q.mode)) n++; } return n; })()`);
  D.reactOnDraw = onDraw;
  await click(api, 'left', 60);
  const T0 = Date.now();
  const seen = { near45: new Set(), near60: new Set(), far120: new Set() }, reporting = new Set(), sigs = { 3: null, 6: null };
  const modes = new Set(), gaits = new Set(); let spMin = 99, spMax = 0, still = 0, lastTimelineKey = '';
  for (let i = 0; i <= secs; i++) {
    const t = +((Date.now() - T0) / 1000).toFixed(1);
    const s = await js(`(() => { const me = N.controller.pos, P = G.people, at = { x: ${p[0]}, z: ${p[1]} }, out = { people: [], heat: G.police ? G.police.heat : 0, reports: P ? P.stats.reports : 0, crimes: (G.crime && G.crime.log ? G.crime.log.length : 0), events: [], carMinD: 999, siren: false, news: null, far: null };
      if (P) for (const q of P.list) { if (!q.standing) continue; q.__mg = q.__mg || ++window.__mgN; const d = Math.hypot(q.pos.x - at.x, q.pos.z - at.z); if (d < 320) out.people.push({ id: q.__mg, role: q.role, d: +d.toFixed(0), mode: q.mode, gait: q.gaitNow, st: q.c && q.c.state, sp: q.fig ? +(q.fig.speed || 0).toFixed(1) : 0 }); }
      if (G.police) { if (G.police.events) out.events = G.police.events.slice(${before.events}).map((e) => e.what + (e.how ? ':' + e.how : '') + (e.kind ? '(' + e.kind + ')' : '')); for (const pc of (G.police.cars || [])) { const d = Math.hypot(pc.pos.x - at.x, pc.pos.z - at.z); if (d < out.carMinD) out.carMinD = +d.toFixed(0); if (pc.siren) out.siren = true; } }
      try { const nw = G.city.news ? G.city.news.latest() : null; out.news = nw !== ${JSON.stringify(before.news)} ? nw : null; } catch (e) {}
      return out; })()`);
    if (!s || s.__exc) { await sleep(1000); continue; }
    if (i === 0) D.shotLogged = s.crimes > before.crimes;
    D.heatMax = Math.max(D.heatMax, s.heat || 0);
    D.reports.done = s.reports - before.reports;
    if (s.carMinD < D.police.carMinD) { D.police.carMinD = s.carMinD; D.police.carMinT = t; }
    if (s.siren) D.police.siren = true;
    D.police.events = s.events; D.police.wedged = s.events.filter((e) => e.startsWith('wedged')).length;
    if (s.news && D.newsAtOnce == null) D.newsAtOnce = { t, line: s.news };
    let reactingNow = 0; const reactorsNow = [];
    for (const q of s.people) {
      if (D.farMan && q.id === D.farMan.id) { if (!D.farMan.modes.includes(q.mode)) D.farMan.modes.push(q.mode); if (REACT.has(q.mode)) D.farMan.flinched = true; }
      if (!REACT.has(q.mode) || q.role !== 'walker') continue;
      reactingNow++; reactorsNow.push(q);
      if (q.d < 45) seen.near45.add(q.id); if (q.d < 60) seen.near60.add(q.id); if (q.d > 120) seen.far120.add(q.id);
      if (q.mode === 'report') reporting.add(q.id);
      modes.add(q.mode); if (q.gait) gaits.add(q.gait); if (q.sp > 0.5) { spMin = Math.min(spMin, q.sp); spMax = Math.max(spMax, q.sp); }
    }
    if (D.farMan && !s.people.some((q) => q.id === D.farMan.id)) D.farMan.gone = true;
    for (const k of [3, 6]) if (t >= k && !sigs[k]) { const S = new Set(reactorsNow.map((q) => q.mode + '|' + (q.gait || '-') + '|' + (q.st || '-') + '|' + Math.round(q.sp * 2) / 2)); sigs[k] = { reactors: reactorsNow.length, distinct: S.size, sameWay: reactorsNow.length - S.size, what: [...S].slice(0, 12) }; }
    still = reactingNow;
    const key = `${reactingNow}|${s.heat}|${s.reports}|${s.events.length}|${s.carMinD < 60}`;
    if (key !== lastTimelineKey) { lastTimelineKey = key; D.timeline.push([t, `${reactingNow} reacting, heat ${s.heat}, reports ${s.reports - before.reports}, police ${s.events.slice(-2).join(' ') || '-'}, car ${s.carMinD} m`]); }
    await sleep(1000);
  }
  D.reactors.near45 = seen.near45.size; D.reactors.near60 = seen.near60.size; D.reactors.far120 = seen.far120.size; D.reactors.stillAtEnd = still;
  D.reports.underWay = reporting.size; D.reports.max = Math.max(D.reports.done, D.reports.underWay);
  D.variety.at3 = sigs[3]; D.variety.at6 = sigs[6]; D.variety.modes = [...modes]; D.variety.gaits = [...gaits]; D.variety.speeds = spMax > 0 ? { min: spMin, max: spMax } : null;
  // holster: the next site starts calm
  await holster(api);
  log(`propagation ${site} (${D.stood} at ${D.at}${D.released ? ', ' + D.released + ' let go first' : ''}): shot ${D.shotLogged ? 'logged' : 'NOT logged'}, ${D.near45} within 45 m before it (${D.reactOnDraw} reacting to the draw); reactors ${D.reactors.near45} within 45 m, ${D.reactors.near60} within 60 m, ${D.reactors.far120} beyond 120 m; heat max ${D.heatMax}; reports ${D.reports.done} done / ${D.reports.underWay} under way; police ${D.police.events.join(' ') || 'nothing'}, nearest car ${D.police.carMinD} m at ${D.police.carMinT} s${D.police.siren ? ', siren' : ''}, cops wedged ${D.police.wedged || 0}; still reacting at ${secs} s: ${D.reactors.stillAtEnd}; news ${D.newsAtOnce ? 'at ' + D.newsAtOnce.t + ' s: ' + D.newsAtOnce.line : 'none'}`);
  log(`   the far man: ${D.farMan ? (D.farMan.d0 + ' m away, ' + (D.farMan.flinched ? 'FLINCHED' : 'never flinched') + (D.farMan.gone ? ' (left the stream)' : '') + ', modes ' + D.farMan.modes.join('/')) : 'nobody kept between 150 and 320 m (the stream keeps people near me: the far count is the proof)'}`);
  if (D.variety.at3) log(`   variety at 3 s: ${D.variety.at3.reactors} reacting, ${D.variety.at3.distinct} distinct ways, ${D.variety.at3.sameWay} the same way; at 6 s: ${D.variety.at6 ? D.variety.at6.reactors + ' / ' + D.variety.at6.distinct + ' / ' + D.variety.at6.sameWay : '-'}; modes ${D.variety.modes.join(',')}; gaits ${D.variety.gaits.join(',')}; speeds ${D.variety.speeds ? D.variety.speeds.min + '-' + D.variety.speeds.max : '-'}`);
  for (const [t, w] of D.timeline.slice(0, 14)) log(`   ${t} s  ${w}`);
  return D;
}
