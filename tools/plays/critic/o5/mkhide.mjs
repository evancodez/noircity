// [O5 critic] writes tools/plays/critic/o5/hide_<profile>.json: up to N tries at the warehouse's
// men by my own hands (play.mjs's shoot step at a profile's pace and aim), each try in by its street
// door (good: the warehouse, then the pier office) (the set-up puts me 3 m out of it, as after a drive), E, walk in, the fight; a fall sends me
// wherever the game sends me (read and logged), and the next try comes back.   node mkhide.mjs <profile> <n>
import { writeFileSync } from 'node:fs';
const [prof, n] = [process.argv[2], +process.argv[3] || 1];
const P = { bad: { react: [650, 1100], err: 0.07, cover: false }, medium: { react: [380, 650], err: 0.04, cover: true }, good: { react: [260, 460], err: 0.025, cover: true } }[prof];
const site = (i) => (prof === 'good' && i % 2 ? 'pieroffice' : 'warehouse');
const steps = [
  { wait: 1500 },
  { clickOn: '#title .opt[data-k=begin]', taken: "G.state !== 'title'", retries: 5, every: 4000 },
  { until: "G.scenes.current && G.scenes.current.id === 'city' && G.scenes.fadeK < 0.05", timeout: 25000 },
  { eval: "(() => { window.__h = { fails: [], warns: [] }; G.on('fail', (e) => window.__h.fails.push(JSON.stringify(e).slice(0, 80))); const w0 = G.hud.warn.bind(G.hud); G.hud.warn = (t, ...a) => { if (t) window.__h.warns.push(t); return w0(t, ...a); }; return 1; })()" },
];
for (let i = 0; i < n; i++) {
  const S = `G.city.places.byId.get('${site(i)}')`;
  steps.push(
    { until: "G.state === 'playing' && !G.failing && G.scenes.fadeK < 0.05", timeout: 30000, stop: false },
    { eval: `(() => { const s = ${S}; if (s.state.cleared) return 'cleared already'; const d = s.door; const x = d.x + d.nx * 3, z = d.z + d.nz * 3; G.stage.part('stream').warmAround(x, z); N.controller.setPose(x, z, Math.atan2(d.nx, d.nz), -0.05); window.__t0 = G.time; return '${site(i)} try ${i + 1} hp ' + Math.round(G.health.hp) + ' dead so far ' + ((s.state.dead || []).length); })()` },
    { wait: 2500 },
    { key: 'KeyE', hold: 70 }, { wait: 600 },
    { walk: `(() => { const F = ${S}.frame; return [[0, -1.8]].map(([x, z]) => { const p = F.w(x, z); return [p.x, p.z]; }); })()`, timeout: 10000, stop: false },
    ...(prof === 'idle'
      ? [{ until: 'G.failing || G.health.dead', timeout: 60000, stop: false }, { wait: 1200 }, { shot: 'idle_fall' }]
      : [{ shoot: { until: `${S}.state.cleared || G.failing || G.health.dead`, cover: P.cover, react: P.react, err: P.err, timeout: 120000 } }]),
    { eval: `'try ${i + 1}: ' + (${S}.state.cleared ? 'CLEARED' : 'down') + ' in ' + (G.time - window.__t0).toFixed(0) + ' s; warns ' + window.__h.warns.slice(-3).join(' / ') + '; fails ' + window.__h.fails.slice(-1).join('') + '; line: ' + document.getElementById('hud').innerText.replace(/\\s+/g, ' ').slice(0, 120)` },
    { wait: 4000 },
    { eval: `'after: scene ' + G.scenes.beat + ' at ' + N.controller.pos.x.toFixed(0) + ',' + N.controller.pos.z.toFixed(0) + ' inside ' + (G.city.places.inside && G.city.places.inside.id) + ' hp ' + Math.round(G.health.hp) + ' state ' + G.state` },
  );
}
const play = { about: `[O5 critic] the warehouse hideout, my ${prof} hands, up to ${n} tries`, url: '/?mute=1&start=city', size: [1280, 800], out: `shots/critic_o5/hide_${prof}`, steps };
writeFileSync(new URL(`./hide_${prof}.json`, import.meta.url), JSON.stringify(play, null, 1));
