// [R3] Frame rate, chapter by chapter, in one headless Chrome (one quiet
// session): each chapter's heaviest moment measured between two runs of the
// perf scenario (shot=perf&t=1&anim=1), uncapped, at 1440 x 900, so its
// ratio to perf holds whatever else the machine is doing.
//   NOIR_PORT=5331 node tools/fpstable.mjs [seconds] [only,these,labels]
// Prints one JSON line per measurement and the table at the end (fps, p95
// ms, the draw calls a frame (mean / max), triangles, lit lights, ratio).
import { spawn, execSync } from 'node:child_process';
import { sweepProfiles, endChrome, freePort, CHROME_WAIT_STEPS } from './lib/profile.mjs';
sweepProfiles();

const SECS = +(process.argv[2] || 5);
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const W = 1440, H = 900;
const PERF = 'shot=perf&t=1&anim=1';
// each chapter's heaviest moment (the lanes' own, where they named one)
const MOMENTS = [
  ['I diner: the room alive, Dot pouring', 'scene=diner&beat=order&t=14&anim=1'],
  ['II fight: round 3, his haymakers', 'scene=fight&beat=round3&t=3&anim=1'],
  ['III body: the approach, the car and the train', 'scene=body&beat=approach&t=5.5&anim=1'],
  ['IV office: the room, the lamp and the slats', 'scene=office&beat=room&t=2&anim=1'],
  ['V door: the kick, the glass man, the flashes', 'scene=gunfight&beat=door&t=1.8&anim=1'],
  ['VI watcher: the fire escape', 'scene=watcher&beat=escape&t=2&anim=1'],
  ['VII tail: the market at 24 m/s', 'scene=tail&beat=chase&tailAt=520,2.2,24,30&tailCruise=1&t=1&anim=1'],
  ['VIII pier: the lamps beat', 'scene=warehouse&beat=lamps&t=3&anim=1'],
  ['VIII pier: the foreman, the oil burning', 'shot=b9duel&do=lantern&t=3.4&anim=1'],
  ['IX block: the cars beat', 'scene=shootout&beat=cars&t=10&anim=1'],
].filter(([l]) => !ONLY || ONLY.some((o) => l.startsWith(o)));

function gpuUtil() {
  try { const o = execSync('ioreg -r -d 1 -w 0 -c IOAccelerator', { encoding: 'utf8' }); const m = [...o.matchAll(/"Device Utilization %"=(\d+)/g)].map((x) => +x[1]); return m.length ? Math.max(...m) : null; } catch { return null; }
}
const load = () => { try { return execSync('sysctl -n vm.loadavg', { encoding: 'utf8' }).trim().split(' ')[1]; } catch { return null; } };

const PORT = await freePort();
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--use-mock-keychain', '--password-store=basic', '--mute-audio', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`, '--screen-info={0,0 2560x1600}',
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-gpu-vsync', '--disable-frame-rate-limit', `--user-data-dir=/tmp/noir-fpst-${PORT}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0, sid;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId: sid })); });
const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

async function measure(label, qs) {
  const gpu0 = gpuUtil();
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}/?${qs}` });
  await sleep(800);
  for (let k = 0; k < 300; k++) { if (await evalJS('!!window.__noirReady')) break; await sleep(200); }
  await sleep(1500);
  const r = await evalJS(`(async () => {
    const N = window.__noir, I = N.renderer.info;
    const ts = [], calls = [], tris = [];
    let last = performance.now(); const t0 = last;
    await new Promise((res) => { const f = (n) => { ts.push(n - last); calls.push(I.render.calls); tris.push(I.render.triangles); last = n; if (n - t0 < ${SECS * 1000}) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    ts.shift(); calls.shift(); tris.shift();
    const avg = ts.reduce((a, b) => a + b, 0) / ts.length; const s = ts.slice().sort((a, b) => a - b);
    let lit = 0, lights = 0; N.stage.scene.traverse((o) => { if (o.isLight && !o.isHemisphereLight && !o.isAmbientLight) { lights++; if (o.visible && o.intensity > 0) lit++; } });
    return { fps: +(1000 / avg).toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), frames: ts.length,
      calls: Math.round(calls.reduce((a, b) => a + b, 0) / calls.length), callsMax: Math.max(...calls), tris: +(tris.reduce((a, b) => a + b, 0) / tris.length / 1e6).toFixed(2),
      lights, lit, programs: I.programs.length, sim: +N.perf.sim.toFixed(2), render: +N.perf.render.toFixed(2), stage: N.stage.name,
      err: document.getElementById('errlog').textContent.slice(0, 300) };
  })()`);
  const out = { label, qs, ...(r || { fps: null }), gpu: gpu0, load: load() };
  console.log(JSON.stringify(out));
  return out;
}

const rows = [];
try {
  let ver;
  for (let k = 0; k < CHROME_WAIT_STEPS; k++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(100); } }
  if (!ver) throw new Error('headless Chrome did not open DevTools');
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  ({ result: { sessionId: sid } } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  let perfPrev = await measure('perf', PERF);
  for (const [label, qs] of MOMENTS) {
    const m = await measure(label, qs);
    const perfNext = await measure('perf', PERF);
    const pf = [perfPrev.fps, perfNext.fps].filter(Boolean);
    const pm = pf.reduce((a, b) => a + b, 0) / Math.max(1, pf.length);
    rows.push({ ...m, perf: +pm.toFixed(1), ratio: m.fps && pm ? +(m.fps / pm).toFixed(2) : null, perfCalls: perfNext.calls });
    perfPrev = perfNext;
  }
} catch (e) {
  console.error('fpstable failed:', e);
} finally {
  try { ws && ws.close(); } catch { /* */ }
  endChrome(chrome, `/tmp/noir-fpst-${PORT}`);
}
console.log('\n| moment | fps | perf (around it) | ratio | p95 ms | calls (mean / max) | perf calls | tris (M) | lit lights | GPU % before |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) console.log(`| ${r.label} | ${r.fps} | ${r.perf} | ${r.ratio} | ${r.p95} | ${r.calls} / ${r.callsMax} | ${r.perfCalls} | ${r.tris} | ${r.lit} | ${r.gpu} |`);
process.exit(0);
