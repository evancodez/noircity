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
# a throwaway disk cache, removed when the run ends: without it headless
# Chrome leaves ~17 MB per run under ~/Library/Caches/Google/Chrome-headless
# (scoped_dir*) and never removes it (200 GB after a few days of captures)
PROF="$(mktemp -d /tmp/noir-shot-XXXXXX)"
trap 'rm -rf "$PROF"' EXIT
URL="http://127.0.0.1:${NOIR_PORT:-5173}/?${QS}"
mkdir -p "$(dirname "$OUT")"
# (a hung headless Chrome - it happens on a loaded machine - is killed after
# SHOT_LIMIT seconds, default 180, instead of living on at full CPU for hours)
"$CHROME" --headless=new --use-mock-keychain --password-store=basic --disk-cache-dir="$PROF/cache" --mute-audio --use-angle=metal --hide-scrollbars --force-device-scale-factor=1 \
  --window-size="${W},${H}" --virtual-time-budget=12000 --screenshot="$OUT" "$URL" 2>/dev/null &
CPID=$!
for ((i = 0; i < ${SHOT_LIMIT:-180} * 10; i++)); do kill -0 $CPID 2>/dev/null || break; sleep 0.1; done
if kill -0 $CPID 2>/dev/null; then kill -9 $CPID 2>/dev/null; echo "shot.sh: Chrome hung ${SHOT_LIMIT:-180} s, killed" >&2; fi
wait $CPID 2>/dev/null || true
echo "wrote $OUT ($(sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null | awk '/pixel/ {printf "%s ", $2}'))"
# headless Chrome leaves a temp file per run in the user's temp folder: the stale ones go
find "${TMPDIR:-/tmp}" -maxdepth 1 -name '.com.google.Chrome.*' -type f -mmin +60 -delete 2>/dev/null || true
find "$HOME/Library/Caches/Google/Chrome-headless" "$HOME/Library/Application Support/Google/Chrome-headless" -maxdepth 1 -name 'scoped_dir*' -mmin +30 -exec rm -rf {} + 2>/dev/null || true
