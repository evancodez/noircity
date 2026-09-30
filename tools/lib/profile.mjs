// Throwaway Chrome profiles: every tool starts headless Chrome on a profile
// of its own under /tmp/noir-*, about 200 MB each. Left behind, a few
// hundred runs fill the disk (19 GB on 2026-09-29), so: a tool removes its
// profile when it ends, and sweeps any stale one (older than 20 minutes,
// from a run that was killed) when it starts.
import { rmSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

// (polish: an hour - a long autoplay run in parallel keeps its profile
// busy for more than 20 minutes, and the sweep must never take a live one)
export function sweepProfiles(maxAgeMin = 60) {
  const now = Date.now();
  let names = [];
  try { names = readdirSync('/tmp').filter((n) => n.startsWith('noir-')); } catch { return; }
  for (const n of names) {
    const p = '/tmp/' + n;
    try { if (now - statSync(p).mtimeMs > maxAgeMin * 60000) rmSync(p, { recursive: true, force: true }); } catch {}
  }
}

// kill Chrome, give it a moment to let go of its files, remove the profile
export function endChrome(chrome, dir) {
  try { chrome.kill('SIGKILL'); } catch {}
  try { execSync('sleep 0.4'); } catch {}
  for (let k = 0; k < 3; k++) {
    try { rmSync(dir, { recursive: true, force: true }); return; } catch { try { execSync('sleep 0.3'); } catch {} }
  }
}

// (polish, the bug hunt: parallel runs drew the DevTools port from a range
// of 150 to 500 and could collide - two Chromes on one port and one profile
// dir, one of them never answering. A port the OS says is free, from a wide
// range)
import { createServer } from 'node:net';
export async function freePort(lo = 20000, span = 20000) {
  for (let k = 0; k < 40; k++) {
    const p = lo + Math.floor(Math.random() * span);
    const ok = await new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.listen(p, '127.0.0.1', () => s.close(() => res(true))); });
    if (ok) return p;
  }
  return lo + Math.floor(Math.random() * span);
}
// how long to wait for a headless Chrome to open its DevTools endpoint: a
// loaded machine took more than the old 5 s (steps of 100 ms)
export const CHROME_WAIT_STEPS = 300;
