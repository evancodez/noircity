// [O5 critic] writes tools/plays/critic/o5/bout_<profile>.json: N bouts in a row at the gym by my
// own hands (c4_bot.mjs's profiles): in by the street door (E, walk), to the man by the ring,
// E, the bout, the result; the next bout from the man again.   node mkbout.mjs <profile> <n>
import { writeFileSync } from 'node:fs';
const [prof, n] = [process.argv[2], +process.argv[3] || 1];
const steps = [
  { wait: 1500 },
  { clickOn: '#title .opt[data-k=begin]', taken: "G.state !== 'title'", retries: 5, every: 4000 },
  { until: "G.scenes.current && G.scenes.current.id === 'city' && G.scenes.fadeK < 0.05", timeout: 25000 },
  { eval: "(() => { const s = G.city.places.byId.get('gym'), d = s.door; const x = d.x + d.nx * 3, z = d.z + d.nz * 3; G.stage.part('stream').warmAround(x, z); N.controller.setPose(x, z, Math.atan2(d.nx, d.nz), -0.05); window.__m0 = G.save.money || 0; window.__res = []; G.on('bout', (e) => { if (e.over) window.__res.push({ t: +G.time.toFixed(0), won: G.brawl.stats && G.brawl.stats.won, lv: e.level, downs: G.brawl.stats && G.brawl.stats.downs, warned: G.brawl.stats && G.brawl.stats.downWarned }); }); return 1; })()" },
  { wait: 2500 },
  { key: 'KeyE', hold: 70 }, { wait: 700 },
  { walk: "(() => { const F = G.city.places.byId.get('gym').frame; return [[0, -1.8]].map(([x, z]) => { const p = F.w(x, z); return [p.x, p.z]; }); })()", timeout: 10000 },
];
for (let i = 0; i < n; i++) {
  steps.push(
    { walk: "(() => { const s = G.city.places.byId.get('gym'), F = s.frame, K = s.live.K; const p = F.w(K.man.x - 1.2, K.man.z + 0.9); return [[p.x, p.z]]; })()", timeout: 25000, stop: false },
    { look: "(() => { const s = G.city.places.byId.get('gym'), F = s.frame, K = s.live.K, a = F.v(K.man.x, 1.75, K.man.z); const dx = a.x - G.eye.x, dz = a.z - G.eye.z, dy = a.y - G.eye.y; const w = Math.atan2(-dx, -dz); const e = Math.atan2(Math.sin(w - N.controller.yaw), Math.cos(w - N.controller.yaw)); const p = Math.atan2(dy, Math.hypot(dx, dz)); return [Math.round(-e / N.controller.sensitivity), Math.round(-(p - N.controller.pitch) / N.controller.sensitivity)]; })()", steps: 6 },
    { wait: 500 },
    { eval: "'prompt: ' + G.hud.promptShown" },
    { key: 'KeyE', hold: 70 },
    { until: 'G.brawl.active', timeout: 8000, stop: false },
    { wait: 700 },
    ...(i === 0 ? [{ eval: "'first second of the bout: ' + document.getElementById('hud').innerText.replace(/\\s+/g, ' ').slice(0, 300)" }] : []),
    { drive: 'tools/plays/critic/c4_bot.mjs', profile: prof, timeout: 300000, shots: 0 },
    { until: "!G.city.places.byId.get('gym').live.run.busy", timeout: 30000, stop: false },
    { wait: 800 },
    { eval: "JSON.stringify(window.__res.at(-1)) + ' $' + ((G.save.money || 0) - window.__m0) + ' hud: ' + document.getElementById('hud').innerText.replace(/\\s+/g, ' ').slice(0, 160)" },
  );
}
const play = { about: `[O5 critic] ${n} bout(s) at the gym, my ${prof} hands (c4_bot), in by the door`, url: '/?mute=1&start=city', size: [1280, 800], out: `shots/critic_o5/bout_${prof}`, steps };
writeFileSync(new URL(`./bout_${prof}.json`, import.meta.url), JSON.stringify(play, null, 1));
