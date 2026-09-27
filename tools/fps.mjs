// Real-time frame rate of the running game in headless Chrome (GPU, ANGLE
// Metal), measured with requestAnimationFrame over a few seconds, plus
// __noir.bench() and the game counters. Uses the DevTools protocol directly
// (Node >= 22 has a global WebSocket; no puppeteer needed).
//   node tools/fps.mjs "shot=battle&t=0.1&anim=1&wave=6" 1440 900 [seconds]
import { spawn } from 'node:child_process';

const QS = process.argv[2] || 'shot=battle&t=0.1&anim=1';
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const SECS = +(process.argv[5] || 6);
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
    const info = N.renderer.info.render;
    const K = N.game.counters;
    const b = await N.bench({ frames: 24, k: 6 });
    return { cpu, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(2), p95Ms: +p95.toFixed(2), frames: times.length, calls: info.calls, tris: info.triangles,
      alive: K.alive, particles: N.game.fx.liveParticles, decals: K.decals, shots: K.shots, hoodShots: K.hoodShots, bench: b,
      size: [innerWidth, innerHeight], err: document.getElementById('errlog').textContent.slice(0, 400) };
  })()`);
  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('fps.mjs failed:', e);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  process.exit(0);
}
