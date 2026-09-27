#!/usr/bin/env bash
# Dump runtime errors captured by the app's #errlog element (see DESIGN.md §9).
# Usage: tools/errors.sh [query-string]   e.g. tools/errors.sh "shot=street"
set -uo pipefail
QS="${1:-shot=street}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --use-angle=metal --hide-scrollbars --window-size=1200,800 \
  --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:5173/?${QS}" 2>/dev/null | python3 -c '
import sys,re,html
d=sys.stdin.read()
m=re.search(r"<div id=\"errlog\"[^>]*>(.*?)</div>",d,re.S)
f=re.search(r"data-frames=\"(\d+)\"",d)
print("FRAMES RENDERED:", f.group(1) if f else "(no data-frames attribute on #errlog)")
body=html.unescape(m.group(1)).strip() if m else None
print("ERRLOG:", (body if body else "(clean)") if m else "(no #errlog element found)")
'
