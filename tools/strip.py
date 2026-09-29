#!/usr/bin/env python3
"""A film strip of one motion: the same query captured at several times and
tiled into one sheet, so an animation can be judged frame by frame (a pour,
a punch, a man going through a window).

  python3 tools/strip.py out.jpg "<query with {t}>" t0 t1 n [cols] [width] [height]

  e.g. python3 tools/strip.py shots/strips/pour.jpg \
         "scene=diner&beat=order&press=KeyE@0.3&t={t}" 3.0 7.0 8

The query's {t} is replaced by each time (seconds, 2 decimals). Frames are
captured at width x height (default 960 x 600) through tools/shot.sh, so
NOIR_PORT applies, and tiled cols wide (default 4) with the time printed on
each. Headless Chrome is muted (tools/shot.sh).
"""
import os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) < 6:
        print(__doc__)
        return 2
    out, query = sys.argv[1], sys.argv[2]
    t0, t1, n = float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5])
    cols = int(sys.argv[6]) if len(sys.argv) > 6 else 4
    w = int(sys.argv[7]) if len(sys.argv) > 7 else 960
    h = int(sys.argv[8]) if len(sys.argv) > 8 else 600
    from PIL import Image, ImageDraw
    times = [t0 + (t1 - t0) * i / max(1, n - 1) for i in range(n)]
    tmp = tempfile.mkdtemp(prefix='noir-strip-')
    frames = []
    for i, t in enumerate(times):
        p = os.path.join(tmp, 'f%02d.png' % i)
        q = query.replace('{t}', '%.2f' % t)
        subprocess.run(['bash', os.path.join(ROOT, 'tools', 'shot.sh'), p, q, str(w), str(h)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(p):
            frames.append((t, Image.open(p).convert('RGB')))
        else:
            print('no frame at t=%.2f' % t)
    if not frames:
        return 1
    tw = 640
    th = int(tw * h / w)
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw, rows * th), (30, 30, 30))
    for i, (t, im) in enumerate(frames):
        im = im.resize((tw, th), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 92, 22], fill=(0, 0, 0))
        d.text((6, 5), 't = %.2f' % t, fill=(255, 255, 255))
        sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out, quality=90)
    shutil.rmtree(tmp, ignore_errors=True)
    print('wrote', out, sheet.size, '%d frames' % len(frames))
    return 0


if __name__ == '__main__':
    sys.exit(main())
