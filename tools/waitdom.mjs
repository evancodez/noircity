// Load the game in headless Chrome in REAL time (no virtual-time budget) and
// print #errlog's outer HTML once a condition holds, for checks whose work
// runs off the main thread (the offline audio renders of ?audiotest=1 finish
// on the audio thread, which --virtual-time-budget does not wait for).
//   node tools/waitdom.mjs "<query>" [attr=audio] [timeoutSec=60]
// Prints the #errlog element as dump-dom would (tools/errors.sh parses it).
import { spawn } from 'node:child_process';

const QS = process.argv[2] || 'shot=street&audiotest=1';
const ATTR = process.argv[3] || 'audio';
const TIMEOUT = +(process.argv[4] || 60);
const PORT = 9800 + Math.floor(Math.random() * 400);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--use-angle=metal', '--hide-scrollbars', '--window-size=1200,800', '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', `--user-data-dir=/tmp/noir-wait-${PORT}`, 'about:blank',
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
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}/?${QS}` }, sessionId);
  const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result?.result?.value;
  const t0 = Date.now();
  let html = null;
  while (Date.now() - t0 < TIMEOUT * 1000) {
    await sleep(500);
    const done = await evalJS(`(() => { const e = document.getElementById('errlog'); return !!(e && e.dataset && e.dataset['${ATTR}']); })()`);
    if (done) break;
  }
  html = await evalJS(`(() => { const e = document.getElementById('errlog'); return e ? e.outerHTML : ''; })()`);
  console.log(html || '');
} catch (e) {
  console.error('waitdom.mjs failed:', e);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  process.exit(0);
}
