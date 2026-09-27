#!/usr/bin/env bash
# Dump runtime errors captured by the app's #errlog element (see DESIGN.md §9).
# Usage: tools/errors.sh [query-string]   e.g. tools/errors.sh "shot=street"
# With "audiotest=1" it also prints the offline audio table (#errlog data-audio:
# every procedural sound rendered through an OfflineAudioContext, Phase 3a).
set -uo pipefail
QS="${1:-shot=street}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# (audiotest=1 renders on the audio thread, which a virtual-time budget does
# not wait for: that page is loaded in real time until data-audio appears)
if [[ "$QS" == *audiotest=1* ]]; then
  DUMP() { node "$(dirname "$0")/waitdom.mjs" "$QS" audio 90; }
else
  DUMP() { "$CHROME" --headless=new --use-angle=metal --hide-scrollbars --window-size=1200,800 \
    --virtual-time-budget=${VTB:-8000} --dump-dom "http://127.0.0.1:5173/?${QS}" 2>/dev/null; }
fi
DUMP | python3 -c '
import sys,re,html,json
d=sys.stdin.read()
m=re.search(r"<div id=\"errlog\"[^>]*>(.*?)</div>",d,re.S)
f=re.search(r"data-frames=\"(\d+)\"",d)
a=re.search(r"data-audio=\"([^\"]*)\"",d)
print("FRAMES RENDERED:", f.group(1) if f else "(no data-frames attribute on #errlog)")
body=html.unescape(m.group(1)).strip() if m else None
print("ERRLOG:", (body if body else "(clean)") if m else "(no #errlog element found)")
if a:
  raw=html.unescape(a.group(1))
  try:
    rows=json.loads(raw)
    print("AUDIO: %d sounds" % len(rows))
    print("  %-10s %7s %8s %7s" % ("name","peak","rms","secs"))
    for r in rows:
      if "error" in r: print("  %-10s ERROR %s" % (r.get("name"), r["error"]))
      else: print("  %-10s %7.3f %8.4f %7.2f" % (r["name"], r["peak"], r["rms"], r["seconds"]))
  except Exception as e:
    print("AUDIO:", raw)
elif "audiotest=1" in sys.argv[1] if len(sys.argv)>1 else False:
  print("AUDIO: (no data-audio yet: raise VTB)")
' "$QS"
