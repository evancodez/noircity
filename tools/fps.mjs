// Real-time frame rate of the running game in headless Chrome (GPU, ANGLE
// Metal), measured with requestAnimationFrame over a few seconds, plus
// __noir.bench() and the game counters. Uses the DevTools protocol directly
// (Node >= 22 has a global WebSocket; no puppeteer needed).
//   node tools/fps.mjs "shot=battle&t=0.1&anim=1&wave=6" 1440 900 [seconds]
// The page's viewport is set to exactly width x height (Phase 3b: the
// headless window's own chrome used to eat ~90 px, so '1440 900' measured a
// 1440x813 canvas). The Phase 3b performance scenario is
//   UNCAPPED=1 node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900
// (a burning wreck, a full wave of 12 Hoods, the train, lightning).
// Phase 3b review: the perf scenario is SEEDED (shot=perf holds the Hoods
// on their feet - a fixed count, no blast kills - and the player on his
// mark, so tris / calls repeat run to run), and the GPU's own utilisation
// (ioreg 'Device Utilization %') is printed before and after: another
// process already loading the GPU (> ~30 % before the run) makes the
// absolute numbers meaningless, and the run is flagged BUSY. RUNS=<n>
// repeats the measurement n times and prints the spread.
import { spawn, execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// GPU busy % right now (macOS IOAccelerator; null elsewhere): the max of a
// few samples 150 ms apart (the counter is a short moving average)
function gpuUtil(samples = 5) {
  let best = null;
  for (let i = 0; i < samples; i++) {
    try {
      const o = execSync('ioreg -r -d 1 -w 0 -c IOAccelerator', { encoding: 'utf8' });
      const m = [...o.matchAll(/"Device Utilization %"=(\d+)/g)].map((x) => +x[1]);
      if (m.length) best = Math.max(best ?? 0, ...m);
    } catch { return null; }
    if (i < samples - 1) execSync('sleep 0.15');
  }
  return best;
}
const GPU_BUSY = +(process.env.GPU_BUSY || 30);

const QS = process.argv[2] || 'shot=battle&t=0.1&anim=1';
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const SECS = +(process.argv[5] || 6);
const RUNS = +(process.env.RUNS || 1);
const results = [];
for (let run = 0; run < RUNS; run++) results.push(await measure(run));
if (RUNS > 1) {
  const ok = results.filter((r) => r && r.fps);
  const col = (k) => ok.map((r) => r[k]);
  const spread = (a) => ({ min: Math.min(...a), max: Math.max(...a), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) });
  console.log(JSON.stringify({ runs: ok.length, busyRuns: ok.filter((r) => r.gpu.busy).length, fps: spread(col('fps')), p95Ms: spread(col('p95Ms')),
    tris: spread(col('tris')), calls: spread(col('calls')), gpuBefore: col('gpu').map((g) => g.before), gpuAfter: col('gpu').map((g) => g.after) }, null, 1));
}
process.exit(0);

async function measure(run) {
const gpuBefore = gpuUtil();
const PORT = 9300 + Math.floor(Math.random() * 500);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`, '--screen-info={0,0 2560x1600}',
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', ...(process.env.UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), `--user-data-dir=/tmp/noir-fps-${PORT}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  return new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
}
try {
  let ver;
  for (let k = 0; k < 50; k++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(100); } }
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:5173/?${QS}` }, sessionId);
  const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId)).result?.result?.value;
  for (let k = 0; k < 100; k++) { if (await evalJS('!!window.__noirReady')) break; await sleep(200); }
  await sleep(1500);
  const out = await evalJS(`(async () => {
    const N = window.__noir;
    N.perf.log = [];
    const times = [];
    let last = performance.now();
    const t0 = last;
    await new Promise((res) => { function f(now) { times.push(now - last); last = now; if (now - t0 < ${SECS * 1000}) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); });
    times.shift();
    const L = N.perf.log; N.perf.log = null;
    const q = (arr, f) => { const a = arr.slice().sort((x, y) => x - y); return +a[Math.floor(a.length * f)].toFixed(2); };
    const cpu = { simAvg: +(L.reduce((a, r) => a + r[0], 0) / L.length).toFixed(2), simP95: q(L.map((r) => r[0]), 0.95), simMax: q(L.map((r) => r[0]), 0.999),
      renderAvg: +(L.reduce((a, r) => a + r[1], 0) / L.length).toFixed(2), renderP95: q(L.map((r) => r[1]), 0.95), renderMax: q(L.map((r) => r[1]), 0.999) };
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    // (copied now: bench() below renders without resetting the counters)
    const info = { calls: N.renderer.info.render.calls, triangles: N.renderer.info.render.triangles };
    const K = N.game.counters;
    const b = await N.bench({ frames: 24, k: 6 });
    return { cpu, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(2), p95Ms: +p95.toFixed(2), p99Ms: +p99.toFixed(2), frames: times.length, calls: info.calls, tris: info.triangles,
      alive: K.alive, train: N.world.train.active, fires: N.world.cars.fires.length, strikes: N.game.storm.strikes, particles: N.game.fx.liveParticles, decals: K.decals, shots: K.shots, hoodShots: K.hoodShots, bench: b,
      size: [innerWidth, innerHeight], err: document.getElementById('errlog').textContent.slice(0, 400) };
  })()`);
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(600);
  // (Phase 3c: the throwaway profile goes with the run - ~35 MB each, and
  // hundreds of them had filled the disk)
  try { rmSync(`/tmp/noir-fps-${PORT}`, { recursive: true, force: true }); } catch {}
  const gpuAfter = gpuUtil();
  out.gpu = { before: gpuBefore, after: gpuAfter, busy: gpuBefore != null && gpuBefore > GPU_BUSY };
  if (out.gpu.busy) out.WARNING = `GPU already ${gpuBefore} % busy before the run (another process): absolute fps / ms are not a clean benchmark`;
  console.log(JSON.stringify(RUNS > 1 ? { run, ...out } : out, null, 1));
  return out;
} catch (e) {
  console.error('fps.mjs failed:', e);
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  await sleep(600);
  try { rmSync(`/tmp/noir-fps-${PORT}`, { recursive: true, force: true }); } catch {}
  return null;
}
}
