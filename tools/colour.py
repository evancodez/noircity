#!/usr/bin/env python3
"""[O1b] The colour measure (docs/briefs/O1B_STREETS.md §4: colour under 2 % of
any frame's pixels, never a wash) and the tone figures the look lanes use
(paper white = luma >= 230, ink = luma < 40, mid = 64..191, in % of the frame).

  python3 tools/colour.py shots/o1b/blind/*.png

A pixel is colour when its HSV saturation is over 0.25 and its value over 0.1
(the ink keeps a scene colour whose saturation is over ~0.25: what it kept
prints saturated; a grey's sRGB rounding never reaches 0.25). Prints, per
frame: colour %, the hues it is (red, amber, blue, other), paper white, ink, mid.
"""
import sys
import numpy as np
from PIL import Image


def measure(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255.0
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0)
    col = (sat > 0.25) & (mx > 0.1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # hue bands of the registry's accents
    red = col & (r >= g) & (r >= b) & (g < r * 0.45)
    amber = col & (r >= b) & (g >= r * 0.45) & (b < g * 0.7)
    blue = col & (b >= r) & (b >= g * 0.85)
    other = col & ~(red | amber | blue)
    luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 255
    n = a.shape[0] * a.shape[1]
    pc = lambda m: 100.0 * m.sum() / n
    return {'colour': pc(col), 'red': pc(red), 'amber': pc(amber), 'blue': pc(blue), 'other': pc(other),
            'white': pc(luma >= 230), 'ink': pc(luma < 40), 'mid': pc((luma >= 64) & (luma < 192))}


if __name__ == '__main__':
    rows = []
    for p in sys.argv[1:]:
        m = measure(p)
        rows.append(m)
        print('%-40s colour %5.2f %%  (red %4.2f amber %4.2f blue %4.2f other %4.2f)  white %4.1f  ink %4.1f  mid %4.1f' % (
            p.split('/')[-1], m['colour'], m['red'], m['amber'], m['blue'], m['other'], m['white'], m['ink'], m['mid']))
    if rows:
        print('max colour %.2f %%, mean %.2f %%; over 2 %%: %d of %d' % (max(r['colour'] for r in rows), sum(r['colour'] for r in rows) / len(rows), sum(1 for r in rows if r['colour'] > 2), len(rows)))
