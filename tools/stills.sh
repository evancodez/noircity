#!/usr/bin/env bash
# The stills' pictures (lane C9, docs/story/briefs/C9_STILLS.md): every panel's
# preset (src/debug/shots/C9_stills.js, shot=still_<id>_<n>) rendered through
# the game's own ink pipeline at its panel's aspect (the page's layout at
# 16:10, src/game/Stills.js layout()), written as public/stills/<id>_<n>.jpg
# (JPEG quality 88, progressive, under 300 KB): rendered 1600 px wide and
# kept at 1440 px for a panel shown alone or the wide strip, 1200 px for one
# of two or the top two of three (the page shows them at most ~1500 and ~820
# px wide; at 1600 px the ink's grain took a JPEG of q88 to 340-410 KB).
# The renderer is pixel-deterministic: run again, it writes the same files.
#   NOIR_PORT=5349 tools/stills.sh                 every panel
#   NOIR_PORT=5349 tools/stills.sh end_1 photo_1   these
#   CHECK=1 NOIR_PORT=5349 tools/stills.sh         render to shots/stills/ and
#                                                  compare with the committed files
# One headless Chrome at a time (tools/shot.sh).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# name  width  height  kept-width   (the panel's aspect: one on a page 1.75,
# two 1.09, three: the top two 1.58, the wide one under them 3.51)
PANELS="opening_1 1600 1012 1200
opening_2 1600 1012 1200
opening_3 1600 456 1440
ames_1 1600 914 1440
check_1 1600 1468 1200
check_2 1600 1468 1200
photo_1 1600 914 1440
diner_1 1600 914 1440
end_1 1600 914 1440"
OUT="$ROOT/public/stills"
[[ -n "${CHECK:-}" ]] && OUT="$ROOT/shots/stills"
mkdir -p "$OUT" "$ROOT/shots/stills"
fail=0
while read -r name w h keep; do
  if [[ $# -gt 0 ]]; then
    want=0
    for a in "$@"; do [[ "$a" == "$name" ]] && want=1; done
    [[ $want -eq 0 ]] && continue
  fi
  png="$ROOT/shots/stills/$name.png"
  rm -f "$png"
  bash "$ROOT/tools/shot.sh" "$png" "shot=still_$name" "$w" "$h" >/dev/null </dev/null
  if [[ ! -f "$png" ]]; then echo "stills: $name: no capture"; fail=1; continue; fi
  python3 - "$png" "$OUT/$name.jpg" "$keep" <<'EOF' || fail=1
import sys, os
from PIL import Image
src, dst, keep = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
im = im.resize((keep, round(im.height * keep / im.width)), Image.LANCZOS)
im.save(dst, 'JPEG', quality=88, optimize=True, progressive=True)
kb = os.path.getsize(dst) / 1024
print(f"{os.path.basename(dst)} {im.size[0]}x{im.size[1]} {kb:.0f} KB" + ("  (over 300 KB)" if kb > 300 else ""))
sys.exit(1 if kb > 300 else 0)
EOF
  if [[ -n "${CHECK:-}" ]]; then
    if cmp -s "$OUT/$name.jpg" "$ROOT/public/stills/$name.jpg"; then echo "  $name: identical"; else echo "  $name: DIFFERS from public/stills/$name.jpg"; fail=1; fi
  fi
done <<< "$PANELS"
exit $fail
