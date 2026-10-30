#!/usr/bin/env python3
"""The colour share of a frame (DESIGN.md's rule: the city is ink; red under 2 % of a
frame, for the police lamp, fire and the odd sign; the odd blue of a neon). A merge
check runs it on five frames and routes an excess to the look lane.
  python3 tools/colour.py --blocked shots/mgr/seats/*.png  each frame: the share of near-black in the
      windscreen band (rows 28-62 %, cols 18-82 %): what the seat's view is blocked by (a pillar,
      the dash, a bonnet up) as flat black; the accepted coupe frame reads 11 %: under 20 % the road is read, over 40 % nothing is
  python3 tools/colour.py shots/golden/city/*.png        each frame: red % (strong), red-tinted % (a cast in the wet counts), blue %, verdict (the tinted share against the limit)
A pixel is red when r > 90 and r > 1.7 * max(g, b); blue when b > 90 and b > 1.7 * max(r, g).
"""
import sys
import numpy as np
from PIL import Image
LIMIT = 2.0
def share(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 90) & (r > 1.7 * np.maximum(g, b))
    tint = (r > 40) & (r > 1.5 * np.maximum(g, b))      # (a red cast in a reflection counts too)
    blue = (b > 90) & (b > 1.7 * np.maximum(r, g))
    n = r.size
    return 100.0 * red.sum() / n, 100.0 * tint.sum() / n, 100.0 * blue.sum() / n
def blocked(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int32)
    h, w = a.shape[:2]
    band = a[int(h * 0.28):int(h * 0.62), int(w * 0.18):int(w * 0.82)]
    # flat black: a 7x7 window all under 6 - the cabin's unlit frame, a pillar, a bonnet up; the night's
    # dark has texture (rain, strokes) and is not counted. The accepted coupe seat frame reads 11 %.
    from numpy.lib.stride_tricks import sliding_window_view
    d = (band.max(axis=2) < 6).astype(np.uint8)
    flat = sliding_window_view(d, (7, 7)).min(axis=(2, 3))
    cols = flat.mean(axis=0)   # per column: the share of the band's height that is flat black
    return 100.0 * flat.mean(), 100.0 * (cols > 0.9).mean()
if __name__ == '__main__':
    if sys.argv[1:2] == ['--blocked']:
        for p in sys.argv[2:]:
            d, c = blocked(p)
            print(f"{p.split('/')[-1]:28s} flat black {d:5.1f} % of the windscreen band, {c:5.1f} % of its columns top to bottom  {'NOTHING SEEN' if d > 40 else 'blocked' if d > 20 else 'ok'}")
        sys.exit(0)
    worst = 0
    for p in sys.argv[1:]:
        rd, tn, bl = share(p)
        worst = max(worst, tn)
        print(f"{p.split('/')[-1]:28s} red {rd:5.2f} %  red-tinted {tn:5.2f} %  blue {bl:5.2f} %  {'OVER' if tn > LIMIT else 'ok'}")
    print(f"limit {LIMIT} %: {'OVER' if worst > LIMIT else 'all under'}")
