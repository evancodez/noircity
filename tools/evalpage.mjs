// Evaluate a JS expression in the running game (headless Chrome, GPU) after
// it is ready, print the JSON result. Look development / profiling helper.
//   node tools/evalpage.mjs "shot=perf&t=1&anim=1" 1440 900 "await __noir.gpuProfile(3)"
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
const QS = process.argv[2] || 'shot=street';
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const EXPR = process.argv[5] || '__noir.renderer.info.render';
const WAIT = +(process.env.WAIT || 1500);
const PORT = 9800 + Math.floor(Math.random() * 150);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, ['--headless=new', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', ...(process.env.UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), `--user-data-dir=/tmp/noir-eval-${PORT}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
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
  const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); return r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description } : r.result?.result?.value; };
  for (let k = 0; k < 100; k++) { if (await evalJS('!!window.__noirReady')) break; await sleep(200); }
  await sleep(WAIT);
  console.log(JSON.stringify(await evalJS(`(async () => { const N = window.__noir; return (${EXPR}); })()`), null, 1));
} catch (e) { console.error(e); }
try { ws && ws.close(); } catch {}
chrome.kill('SIGKILL');
await sleep(600);
try { rmSync(`/tmp/noir-eval-${PORT}`, { recursive: true, force: true }); } catch {}
process.exit(0);
