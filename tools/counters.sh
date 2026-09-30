#!/usr/bin/env bash
# Dump the game's debug counters (#counters data-json, written by main.js)
# plus the error log, headlessly. Usage: tools/counters.sh "shot=battle&t=30"
set -uo pipefail
QS="${1:-shot=battle&t=30}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# a throwaway disk cache, removed when the run ends: without it headless
# Chrome leaves ~17 MB per run under ~/Library/Caches/Google/Chrome-headless
# (scoped_dir*) and never removes it (200 GB after a few days of captures)
PROF="$(mktemp -d /tmp/noir-shot-XXXXXX)"
trap 'rm -rf "$PROF"' EXIT
"$CHROME" --headless=new --disk-cache-dir="$PROF/cache" --mute-audio --use-angle=metal --hide-scrollbars --window-size=1200,800 \
  --virtual-time-budget=${VTB:-20000} --dump-dom "http://127.0.0.1:${NOIR_PORT:-5173}/?${QS}" 2>/dev/null | python3 -c '
import sys,re,html,json
d=sys.stdin.read()
m=re.search(r"<div id=\"errlog\"[^>]*>(.*?)</div>",d,re.S)
f=re.search(r"data-frames=\"(\d+)\"",d)
c=re.search(r"id=\"counters\"[^>]*data-json=\"([^\"]*)\"",d) or re.search(r"data-json=\"([^\"]*)\"[^>]*id=\"counters\"",d)
print("FRAMES RENDERED:", f.group(1) if f else "?")
body=html.unescape(m.group(1)).strip() if m else None
print("ERRLOG:", (body if body else "(clean)") if m else "(no #errlog)")
if c:
  j=json.loads(html.unescape(c.group(1)))
  print("COUNTERS:", json.dumps(j))
else:
  print("COUNTERS: (none)")
'
# headless Chrome leaves a temp file per run in the user's temp folder: the stale ones go
find "${TMPDIR:-/tmp}" -maxdepth 1 -name '.com.google.Chrome.*' -type f -mmin +60 -delete 2>/dev/null || true
find "$HOME/Library/Caches/Google/Chrome-headless" "$HOME/Library/Application Support/Google/Chrome-headless" -maxdepth 1 -name 'scoped_dir*' -mmin +30 -exec rm -rf {} + 2>/dev/null || true
