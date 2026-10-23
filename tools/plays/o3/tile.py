# [O3] tiles a play's strip shots (shots/o3/<play>/s_*.png) into one sheet
#   python3 tools/plays/o3/tile.py shots/o3/o3_strip_arrest out.jpg [cols]
import glob, os, sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
files = sorted(glob.glob(os.path.join(src, 's_*.png')))
W, H = 480, 300
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H), (0, 0, 0))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((W, H))
    ImageDraw.Draw(im).text((8, 6), str(i), fill=(255, 255, 255))
    sheet.paste(im, ((i % cols) * W, (i // cols) * H))
sheet.save(out, quality=82)
print(out, len(files))
