#!/bin/bash
# [C10b] Plays against a build served by vite preview on NOIR_PORT, the server started here and stopped at the end
# (a dev server reloads its pages when a file is saved; the gate's long plays run on a build):
#   NOIR_PORT=5350 tools/hunts/served.sh <logdir> play1 play2 ...
cd "$(dirname "$0")/../.."
node node_modules/vite/bin/vite.js preview --port "$NOIR_PORT" --strictPort > "$1/preview.log" 2>&1 &
PV=$!
for i in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$NOIR_PORT/" && break; sleep 0.5; done
tools/hunts/chain.sh "$@"
kill $PV 2>/dev/null
wait $PV 2>/dev/null
