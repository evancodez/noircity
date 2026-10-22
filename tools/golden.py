#!/usr/bin/env python3
"""Golden frames: the accepted look of every preset (the QUALITY LOCK).

The renderer is deterministic: two captures of one preset are pixel-identical.
So any difference against a golden frame is a real change, and an unintended
one blocks a merge.

  python3 tools/golden.py check [name ...]     capture into shots/check/ and diff
  python3 tools/golden.py diff  [name ...]     diff what is already in shots/check/
  python3 tools/golden.py accept name [...]    shots/check/<name>.png becomes the golden
                                               (art director / integration only)
  python3 tools/golden.py add name "query"     add a preset to the manifest and capture it
  python3 tools/golden.py list

Env: NOIR_PORT (dev server, default 5173), NOIR_GOLDEN (golden dir, default
<repo>/shots/golden), ALLOW="name,name" (presets whose change is intended: they
are reported but do not fail the check).
Frames are 1440x900. The manifest is <golden>/manifest.txt, one "name|query" per line.
Exit code 1 when a frame changed that is not in ALLOW.
"""
import os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GOLD = os.environ.get('NOIR_GOLDEN') or os.path.join(ROOT, 'shots', 'golden')
CHECK = os.path.join(ROOT, 'shots', 'check')
W, H = 1440, 900


def manifest():
    out = []
    p = os.path.join(GOLD, 'manifest.txt')
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if line and not line.startswith('#') and '|' in line:
                n, q = line.split('|', 1)
                out.append((n, q))
    return out


def capture(name, query, folder):
    os.makedirs(folder, exist_ok=True)
    out = os.path.join(folder, name + '.png')
    if os.path.exists(out):
        os.remove(out)
    subprocess.run(['bash', os.path.join(ROOT, 'tools', 'shot.sh'), out, query, str(W), str(H)],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out if os.path.exists(out) else None


def compare(name):
    import numpy as np
    from PIL import Image
    g, c = os.path.join(GOLD, name + '.png'), os.path.join(CHECK, name + '.png')
    if not os.path.exists(g):
        return {'name': name, 'verdict': 'NO GOLDEN'}
    if not os.path.exists(c):
        return {'name': name, 'verdict': 'NO CAPTURE'}
    a = np.asarray(Image.open(g).convert('RGB')).astype(np.float32)
    b = np.asarray(Image.open(c).convert('RGB')).astype(np.float32)
    if a.shape != b.shape:
        return {'name': name, 'verdict': 'SIZE ' + str(b.shape)}
    d = np.abs(a - b).max(axis=2)
    h, w = d.shape
    hh, ww = h // 16 * 16, w // 16 * 16
    blk = lambda x: x.mean(axis=2)[:hh, :ww].reshape(hh // 16, 16, ww // 16, 16).mean(axis=(1, 3))
    bd = np.abs(blk(a) - blk(b))
    changed = float((d > 0).mean() * 100)
    r = {'name': name, 'mean': float(d.mean()), 'px': changed, 'px8': float((d > 8).mean() * 100),
         'blk': float(bd.max()), 'blk6': float((bd > 6).mean() * 100)}
    if changed == 0:
        r['verdict'] = 'IDENTICAL'
    elif r['px8'] == 0 and r['mean'] < 0.05:
        # [G0] a Chrome update (155, 2026-10-15) moved a few pixels by a few
        # levels in every frame: nothing a person sees. Within this noise the
        # frame counts as identical; the numbers are printed so it is seen.
        r['verdict'] = 'IDENTICAL'
        r['noise'] = True
    else:
        r['verdict'] = 'CHANGED'
        ys, xs = np.where(d > 8)
        if len(xs):
            r['box'] = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        # golden | capture | difference (x4, white = changed), half size
        heat = np.clip(d * 4, 0, 255).astype(np.uint8)
        sheet = np.concatenate([a.astype(np.uint8), b.astype(np.uint8), np.stack([heat] * 3, axis=2)], axis=1)
        Image.fromarray(sheet).resize((sheet.shape[1] // 2, sheet.shape[0] // 2), Image.LANCZOS).save(
            os.path.join(CHECK, 'diff_' + name + '.jpg'), quality=88)
    return r


def report(rows):
    allow = set(filter(None, os.environ.get('ALLOW', '').split(',')))
    print('%-16s %-10s %8s %8s %8s %8s  %s' % ('preset', 'verdict', 'px%', 'px>8%', 'mean', 'blk16', 'changed box (px>8)'))
    bad = 0
    for r in rows:
        v = r['verdict']
        if v == 'IDENTICAL':
            print('%-16s %-10s' % (r['name'], v) + ('  (noise: px%% %.3f mean %.3f)' % (r['px'], r['mean']) if r.get('noise') else ''))
            continue
        if 'mean' not in r:
            print('%-16s %-10s' % (r['name'], v)); bad += 1
            continue
        ok = r['name'] in allow
        print('%-16s %-10s %8.3f %8.3f %8.3f %8.2f  %s%s' % (r['name'], v, r['px'], r['px8'], r['mean'], r['blk'], r.get('box', ''), '  (allowed)' if ok else ''))
        if not ok:
            bad += 1
    print('%d of %d frames changed without being allowed' % (bad, len(rows)) if bad else 'golden check passed (%d frames)' % len(rows))
    print('sheets: shots/check/diff_<name>.jpg (golden | capture | difference)')
    return 1 if bad else 0


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    names = sys.argv[2:]
    M = manifest()
    if cmd == 'list':
        for n, q in M:
            print('%-16s %s' % (n, q))
        return 0
    if cmd == 'add':
        n, q = names[0], names[1]
        M = [(a, b) for a, b in M if a != n] + [(n, q)]
        os.makedirs(GOLD, exist_ok=True)
        open(os.path.join(GOLD, 'manifest.txt'), 'w').write(''.join('%s|%s\n' % e for e in M))
        print('golden', capture(n, q, GOLD))
        return 0
    sel = [(n, q) for n, q in M if not names or n in names]
    if cmd == 'accept':
        for n, _ in sel:
            shutil.copyfile(os.path.join(CHECK, n + '.png'), os.path.join(GOLD, n + '.png'))
            print('accepted', n)
        return 0
    if cmd == 'check':
        for n, q in sel:
            capture(n, q, CHECK)
    return report([compare(n) for n, _ in sel])


if __name__ == '__main__':
    sys.exit(main())
