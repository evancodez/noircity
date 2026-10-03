#!/usr/bin/env bash
# C2: one play on its own dev server (port 5342), the server only as long as
# the play: started from this worktree, killed (its own PID) when the play ends.
#   tools/plays/c2fix2/run.sh <play.json> [play.mjs args...]
#   C2_TOOL=fps|golden|errors|shot ... runs that tool instead (see below)
set -uo pipefail
cd "$(dirname "$0")/../../.."
export NOIR_PORT=5342
if lsof -nP -iTCP:5342 -sTCP:LISTEN >/dev/null 2>&1; then OWN=0; else
  node node_modules/vite/bin/vite.js --port 5342 --strictPort > /tmp/c2_vite_5342.log 2>&1 &
  VP=$!; OWN=1
  for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:5342/ && break; sleep 0.5; done
fi
case "${C2_TOOL:-play}" in
  play) node tools/play.mjs "$@" ;;
  golden) python3 tools/golden.py "$@" ;;
  errors) for q in "$@"; do echo "== $q"; tools/errors.sh "$q"; done ;;
  shot) tools/shot.sh "$@" ;;
  fps) node tools/fps.mjs "$@" ;;
  *) "$@" ;;
esac
RC=$?
if [ "$OWN" = 1 ]; then kill "$VP" 2>/dev/null; wait "$VP" 2>/dev/null; fi
exit $RC
