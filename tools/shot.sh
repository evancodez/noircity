#!/usr/bin/env bash
# Headless WebGL screenshot of the running dev server (http://127.0.0.1:$NOIR_PORT, default 5173).
# Usage: tools/shot.sh <out.png> [query-string] [width] [height]
#   e.g. tools/shot.sh shots/street.png "shot=street&t=2" 1600 1000
# The game must honor URL params (see DESIGN.md "Debug/screenshot mode").
set -euo pipefail
OUT="${1:-shots/shot.png}"
QS="${2:-shot=default}"
W="${3:-1600}"
H="${4:-1000}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="http://127.0.0.1:${NOIR_PORT:-5173}/?${QS}"
mkdir -p "$(dirname "$OUT")"
"$CHROME" --headless=new --mute-audio --use-angle=metal --hide-scrollbars --force-device-scale-factor=1 \
  --window-size="${W},${H}" --virtual-time-budget=12000 --screenshot="$OUT" "$URL" 2>/dev/null
echo "wrote $OUT ($(sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null | awk '/pixel/ {printf "%s ", $2}'))"
