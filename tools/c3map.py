#!/usr/bin/env python3
"""Lane C3: draw the city's plan (tools/c3map.mjs's JSON) as a PNG map.
   python3 tools/c3map.py plan.json map.png [scale]"""
import json, sys
from PIL import Image, ImageDraw

d = json.load(open(sys.argv[1]))
out = sys.argv[2]
S = float(sys.argv[3]) if len(sys.argv) > 3 else 2.2
X0, X1, Z0, Z1 = -300, 260, -360, 230
W, H = int((X1 - X0) * S), int((Z1 - Z0) * S)
im = Image.new('RGB', (W, H), (40, 40, 40))
g = ImageDraw.Draw(im)
P = lambda x, z: ((x - X0) * S, (z - Z0) * S)
# the water
g.rectangle([P(-300, -360), P(260, -258)], fill=(20, 30, 60))
g.polygon([P(x + 10, z) for x, z in d['river']] + [P(260, 230), P(260, -360)], fill=(20, 30, 60))
for x0, x1, z0, z1 in d['slabs']:
    g.rectangle([P(x0, z0), P(x1, z1)], fill=(90, 90, 90))
for b in d['blocks']:
    col = (150, 120, 70) if b['kind'] == 'square' else (120, 120, 120)
    g.rectangle([P(b['x0'], b['z0']), P(b['x1'], b['z1'])], fill=col, outline=(200, 200, 200))
for x0, x1, z0, z1 in d.get('lots', []):
    g.rectangle([P(x0, z0), P(x1, z1)], outline=(170, 170, 170))
import math
for x, z, yaw in d.get('parked', []):
    c, s_ = math.cos(yaw), math.sin(yaw)
    pts = [(x + lx * c + lz * s_, z - lx * s_ + lz * c) for lx, lz in [(2.45, 0.95), (2.45, -0.95), (-2.45, -0.95), (-2.45, 0.95)]]
    g.polygon([P(px, pz) for px, pz in pts], fill=(70, 70, 110))
for x, z in d.get('columns', []):
    g.ellipse([P(x - 0.66, z - 0.66), P(x + 0.66, z + 0.66)], fill=(0, 0, 0))
for x, z in d.get('posts', []):
    g.ellipse([P(x - 0.4, z - 0.4), P(x + 0.4, z + 0.4)], fill=(255, 255, 255))
for e in d['edges']:
    pts = [P(x, z) for x, z in e['pts']]
    g.line(pts, fill=(60, 160, 60), width=2)
for n in d['nodes']:
    x, y = P(n['x'], n['z'])
    g.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 0))
cols = [(255, 60, 60), (60, 120, 255)]
for i, p in enumerate(d['paths']):
    pts = p['pts']
    for k in range(1, len(pts)):
        v = pts[k][2]
        c = cols[i % 2]
        c = tuple(int(cc * (0.4 + 0.6 * min(1, v / 16))) for cc in c)
        g.line([P(pts[k - 1][0], pts[k - 1][1]), P(pts[k][0], pts[k][1])], fill=c, width=3 - i)
s = d['start']
for k, c in [('my', (255, 255, 255)), ('his', (255, 0, 0))]:
    x, y = P(s[k]['x'], s[k]['z'])
    g.rectangle([x - 4, y - 8, x + 4, y + 8], fill=c)
pr = d['pier']
g.rectangle([P(pr['yard']['x0'], pr['yard']['z0']), P(pr['yard']['x1'], pr['yard']['z1'])], outline=(255, 200, 0), width=2)
g.rectangle([P(pr['shed']['x0'], pr['shed']['z0']), P(pr['shed']['x1'], pr['shed']['z1'])], fill=(100, 80, 40))
if len(sys.argv) > 4:
    x0, z0, x1, z1 = map(float, sys.argv[4].split(','))
    im = im.crop((int((x0 - X0) * S), int((z0 - Z0) * S), int((x1 - X0) * S), int((z1 - Z0) * S)))
im.save(out)
print('wrote', out, W, H, 'paths', [(p['pick'], round(p['len'])) for p in d['paths']])
