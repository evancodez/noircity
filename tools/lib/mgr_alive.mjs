// [manager] the alive test and the nonsense list for every merge check (the user's rule
// of 2026-10-23, OPEN_WORLD.md 'alive, not canned, not stiff'; the proofs of O9's brief):
// stand at a corner for a minute doing nothing and list what happened; count the people
// in a reaction with no cause in sight, and the reactions that outlive their cause.
//   { "drive": "tools/lib/mgr_alive.mjs", "corner": "grand" | "hall" | "quay", "secs": 60 }
// D: { corner, secs, near: { min, avg, max }, things: [[t, what]], thingsN, joinable, carsPassed,
//      copsSeen, crimes, news, modes: { mode: n }, nonsense: { withoutCause, outlived, list } }
const REACT = new Set(['flee', 'report', 'gather', 'cower', 'dash', 'watch', 'approach', 'stopped', 'hold']);
const CORNERS = {
  grand: null,   // the start: Grand Ave under the el, on foot by the car
  hall: `(() => { const s = G.city.places.byId.get('hall'); if (!s) return null; const p = s.frame.w(0, -3.2); return [p.x, p.z, s.frame.yaw(Math.PI)]; })()`,
  quay: `[60, 437, 0]`,
};
export default async function alive(api) {
  const { js, sleep, log, opts } = api;
  const corner = opts.corner || 'grand', secs = opts.secs ?? 60;
  if (CORNERS[corner]) {
    const p = await js(CORNERS[corner]);
    if (p) await js(`(G.stage.part('stream').warmAround(${p[0]}, ${p[1]}), N.controller.setPose(${p[0]}, ${p[1]}, ${p[2]}, -0.05), 1)`);
    await sleep(2500);
  }
  await js(`(window.__al = { crimes0: (G.crime && G.crime.log ? G.crime.log.length : 0), news0: (() => { try { return G.city.news ? G.city.news.latest() : null; } catch (e) { return null; } })() }, 1)`);
  const D = { corner, secs, near: { min: 99, avg: 0, max: 0 }, things: [], joinable: 0, carsPassed: 0, copsSeen: 0, crimes: 0, news: [], modes: {}, nonsense: { withoutCause: 0, outlived: 0, list: [] } };
  const seen = new Map();   // what -> first t (distinct things)
  const reactSince = new Map();   // person id -> t the reaction began
  const carsSeen = new Set(), copsSeen = new Set(), noCause = new Set(), outlived = new Set();
  let sum = 0, n = 0, lastCause = -999;
  const T0 = Date.now();
  for (let i = 0; i < secs; i++) {
    const t = +((Date.now() - T0) / 1000).toFixed(1);
    const s = await js(`(() => {
      const me = N.controller.pos, P = G.people, out = { people: [], cars: [], units: 0, heat: G.police ? G.police.heat : 0, gun: !!(P && P.hands && P.hands.gunOut), crowd: !!(G.crowd && G.crowd.active), crimes: (G.crime && G.crime.log ? G.crime.log.length : 0), lastCrime: null, news: null, train: null };
      if (P) for (const p of P.list) { const d = Math.hypot(p.pos.x - me.x, p.pos.z - me.z); if (d < 35) out.people.push({ id: p.id ?? P.list.indexOf(p), role: p.role, mode: p.mode, d: +d.toFixed(0), kind: p.kind || (p.fig && p.fig.kind) || null }); }
      if (G.vehicles) for (const c of G.vehicles.list) { if (!c || c === G.city.car) continue; const d = Math.hypot(c.pos.x - me.x, c.pos.z - me.z); if (d < 60) out.cars.push({ id: c.id ?? c.kind + ':' + Math.round(c.pos.x) , kind: c.kind, d: +d.toFixed(0), v: +c.vel.length().toFixed(1), police: !!c.police }); }
      if (G.police) { const u = G.police.units || (G.police.marks ? G.police.marks() : []); out.units = u.length; }
      if (G.crime && G.crime.log && G.crime.log.length) { const r = G.crime.log[G.crime.log.length - 1]; out.lastCrime = { kind: r.kind, t: r.t ?? null }; }
      try { const nw = G.city.news ? G.city.news.latest() : null; out.news = nw && nw !== window.__al.news0 ? nw : null; } catch (e) {}
      try { const el = G.city.el || (G.stage.part('el') || null); out.train = el && el.train ? (el.train.state || (el.train.stopped ? 'stopped' : 'moving')) : null; } catch (e) {}
      return out; })()`);
    if (!s || s.__exc) { await sleep(1000); continue; }
    const near = s.people.length; sum += near; n++; D.near.min = Math.min(D.near.min, near); D.near.max = Math.max(D.near.max, near);
    const thing = (what, join) => { if (!seen.has(what)) { seen.set(what, t); D.things.push([t, what]); if (join) D.joinable++; } };
    for (const p of s.people) {
      D.modes[p.mode] = (D.modes[p.mode] || 0) + 1;
      if (p.role === 'cop') { if (!copsSeen.has(p.id)) { copsSeen.add(p.id); thing('a beat cop on his round', false); } }
      if (p.role === 'gang') thing('a gang\'s three at their corner', true);
      if (p.mode === 'stand' && p.role === 'walker') thing('a walker stopping (a stop, a stall, a box)', false);
      if (p.mode === 'drunk' || p.kind === 'drunk') thing('a drunk weaving', true);
      if (p.mode === 'flee') thing('someone running from something', true);
      if (p.mode === 'report') thing('a witness going to report', true);
      if (p.mode === 'gather') thing('people gathering to stare', true);
      if (p.mode === 'cower') thing('someone cowering', true);
      if (p.mode === 'dash') thing('someone dashing clear of a car', false);
      if (REACT.has(p.mode)) {
        if (!reactSince.has(p.id)) reactSince.set(p.id, t);
        // (a dash clear of a car has its cause in the car: O2's traffic)
        const cause = s.heat > 0 || s.gun || s.crowd || (s.crimes > (D._crimes0 ?? 0) && t - lastCause < 25) || (p.mode === 'dash' && s.cars.some((c) => c.v > 1.5));
        if (!cause) noCause.add(p.id + ':' + p.mode);
        if (t - reactSince.get(p.id) > 40 && !(s.heat > 0 || s.gun || s.crowd)) outlived.add(p.id + ':' + p.mode);
      } else reactSince.delete(p.id);
    }
    if (s.crimes > (D._crimesPrev ?? s.crimes)) lastCause = t;
    D._crimesPrev = s.crimes; if (D._crimes0 == null) D._crimes0 = s.crimes;
    for (const c of s.cars) { if (c.v > 1.5 && !carsSeen.has(c.id)) { carsSeen.add(c.id); D.carsPassed++; thing(c.police ? 'a police car passing' : 'a car passing', false); } }
    if (s.units > 0) thing('a police unit out', true);
    if (s.crowd) thing('a fist fight', true);
    if (s.news) { D.news.push(s.news); thing('the paper\'s news: ' + s.news, false); }
    if (s.train === 'stopped') thing('the el\'s train at the station', true);
    if (s.train === 'moving') thing('the el\'s train passing', false);
    await sleep(1000);
  }
  D.near.avg = n ? +(sum / n).toFixed(1) : 0; D.crimes = Math.max(0, (D._crimesPrev ?? 0) - (D._crimes0 ?? 0)); D.copsSeen = copsSeen.size;
  D.thingsN = D.things.length; D.nonsense.withoutCause = noCause.size; D.nonsense.outlived = outlived.size; D.nonsense.list = [...noCause].slice(0, 8).concat([...outlived].slice(0, 8).map((x) => 'outlived ' + x));
  delete D._crimes0; delete D._crimesPrev;
  log(`alive ${corner}: ${D.thingsN} things in ${secs} s (${D.joinable} to join), near ${D.near.min}-${D.near.max} (avg ${D.near.avg}), cars ${D.carsPassed}, cops ${D.copsSeen}, nonsense ${D.nonsense.withoutCause} without a cause, ${D.nonsense.outlived} outlived`);
  for (const [t, w] of D.things) log(`   ${t} s  ${w}`);
  return D;
}
