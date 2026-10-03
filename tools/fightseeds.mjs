// [C4] The fist fight's rules measured in the page: the autoplay's hands
// (src/game/Autoplay.js styles) fight from a beat, the simulation stepped
// as fast as it goes (no rendering between steps: __noir.sim), one headless
// Chrome for every run, one run after another. For tuning; the proofs are
// the real-input plays (tools/plays, tools/play.mjs).
//   NOIR_PORT=5344 node tools/fightseeds.mjs <styles,...> <seeds: 1-6 | 1,4,9> [limit s of fight] [scene.beat]
//   e.g. node tools/fightseeds.mjs lazy,lazydodge,medium 1-4 900 fight.lesson
//        node tools/fightseeds.mjs medium 1-3 600 warehouse.fight
// Prints one line per run and a JSON line (won, fight time, downs and their
// words, what landed and why, what went into his guard and was answered).
import { spawn } from 'node:child_process';
import { sweepProfiles, endChrome, freePort, CHROME_WAIT_STEPS } from './lib/profile.mjs';
import { rmSync } from 'node:fs';
sweepProfiles();
const styles = (process.argv[2] || 'medium').split(',');
const seedArg = process.argv[3] || '1-3';
const seeds = seedArg.includes('-') ? (() => { const [a, b] = seedArg.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); })() : seedArg.split(',').map(Number);
const LIMIT = +(process.argv[4] || 600);
const [SCENE, BEAT] = (process.argv[5] || 'fight.lesson').split('.');
const EXTRA = process.env.QS ? '&' + process.env.QS : '';
const PORT = await freePort();
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dir = `/tmp/noir-seeds-${PORT}`;
const chrome = spawn(CHROME, ['--headless=new', '--use-mock-keychain', '--password-store=basic', '--mute-audio', '--use-angle=metal', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=960,600',
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const out = [];
try {
  let ver;
  for (let k = 0; k < CHROME_WAIT_STEPS; k++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(100); } }
  if (!ver) throw new Error('no DevTools');
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); return r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description } : r.result?.result?.value; };
  for (const style of styles) for (const seed of seeds) {
    const t0 = Date.now();
    await send('Page.navigate', { url: `http://127.0.0.1:${process.env.NOIR_PORT || 5173}/?shot=r2play&scene=${SCENE}&beat=${BEAT}&seed=${seed}&style=${style}&t=0.5&mute=1&hud=1${EXTRA}` }, sessionId);
    await sleep(800);
    let ready = false;
    for (let k = 0; k < 300; k++) { if (await evalJS('!!window.__noirReady')) break; await sleep(200); }
    // (the beat may begin its fight a moment in: stepped until it has)
    for (let k = 0; k < 120; k++) { if (await evalJS('(() => { const G = window.__noir.game; if (G.brawl.active) return true; window.__noir.sim(0.5); return false; })()')) { ready = true; break; } }
    if (!ready) { console.log(`${style} seed ${seed}: the fight never began (${Math.round((Date.now() - t0) / 1000)} s)`); continue; }
    // (stepped in slices: the fight's time is the brawl's own clock - stats.time - not the page's)
    const R = await evalJS(`(async () => { const N = window.__noir, G = N.game, B = G.brawl;
      const S = () => B.stats || {};
      const hits = { head: 0, guard: 0, air: 0, broke: 0 }; G.on('brawl:hit', (e) => { if (e.by === 'me' && hits[e.zone] != null) hits[e.zone]++; });
      let wall = performance.now();
      for (let i = 0; i < 4000; i++) {
        N.sim(5);
        if (S().won || (B.him && B.him.state === 'ko') || G.scenes.beat === 'ko' || G.scenes.beat === 'outside') break;
        if ((S().time || 0) > ${LIMIT}) break;
        if (performance.now() - wall > 240000) break;
        if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
      }
      const s = S(), why = {}; for (const w of s.downWhy || []) why[w] = (why[w] || 0) + 1;
      const C = s.cues || {};
      return { won: !!s.won || (B.him && B.him.state === 'ko'), t: +(s.time || 0).toFixed(0), downs: s.downs, why, round: B.round, his: B.him ? Math.round(B.pct(B.him.hp)) : null,
        landed: s.landed, intoGuard: s.myBlocked, answers: s.answers || 0, hits, dmgBy: s.dmgBy, counters: s.counters,
        cues: { shown: C.shown, right: C.right, wrong: C.wrong, late: C.late }, blocked: s.blocked, trying: s.mannerDowns, idle: s.idleDowns, pounding: s.pounding,
        hurtBy: s.hurtBy, caught: s.caught || 0, taken: s.taken, dmgTaken: Math.round(s.dmgTaken || 0), mercy: B.mercy ? B.mercy() : null, cardsBack: s.cardsBack, heavyCard: s.heavyCard,
        lessonEnd: s.lessonEnd, wallS: +((performance.now() - wall) / 1000).toFixed(0) }; })()`);
    const line = { style, seed, ...R, secs: Math.round((Date.now() - t0) / 1000) };
    out.push(line);
    console.log(`${style.padEnd(10)} seed ${String(seed).padStart(2)}  ${R && R.won ? 'WON ' : 'lost'} t ${String(R && R.t).padStart(4)}  downs ${String(R && R.downs).padStart(3)}  round ${R && R.round} his ${R && R.his}%  landed ${R && R.landed}  guard ${R && R.intoGuard} ans ${R && R.answers}  ${JSON.stringify(R && R.why)}  (${line.secs}s)`);
    console.log('  ' + JSON.stringify(R));
  }
} catch (e) { console.error(e); }
try { ws && ws.close(); } catch {}
endChrome(chrome, dir);
await sleep(600);
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
