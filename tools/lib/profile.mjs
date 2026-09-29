// Throwaway Chrome profiles: every tool starts headless Chrome on a profile
// of its own under /tmp/noir-*, about 200 MB each. Left behind, a few
// hundred runs fill the disk (19 GB on 2026-09-29), so: a tool removes its
// profile when it ends, and sweeps any stale one (older than 20 minutes,
// from a run that was killed) when it starts.
import { rmSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

export function sweepProfiles(maxAgeMin = 20) {
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
