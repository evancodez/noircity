// Evaluate a JS expression in the running game (headless Chrome, real time,
// GPU) after it is ready, and print the JSON result. For profiling and
// inspection: `N` is window.__noir inside the expression.
//   node tools/probe.mjs "<query>" "<expr over N>" [width] [height] [waitSec]
// Env: UNCAPPED=1 disables vsync / the frame-rate limit.
import { spawn } from 'node:child_process';

const QS = process.argv[2] || 'shot=street';
const EXPR = process.argv[3] || 'N.renderer.info.render';
const W = +(process.argv[4] || 1440), H = +(process.argv[5] || 900);
const WAIT = +(process.argv[6] || 1.5);
const PORT = 9300 + Math.floor(Math.random() * 500);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--mute-audio', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`, '--screen-info={0,0 2560x1600}',
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', ...(process.env.UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), `--user-data-dir=/tmp/noir-probe-${PORT}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
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
  // the exact viewport (the headless window's chrome eats ~90 px otherwise)
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}/?${QS}` }, sessionId);
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.result?.exceptionDetails) return { exception: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
    return r.result?.result?.value;
  };
  for (let k = 0; k < 150; k++) { if (await evalJS('!!window.__noirReady')) break; await sleep(200); }
  await sleep(WAIT * 1000);
  const out = await evalJS(`(async () => { const N = window.__noir; const THREE = N.THREE; return (${EXPR}); })()`);
  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('probe.mjs failed:', e);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  process.exit(0);
}
