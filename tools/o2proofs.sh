#!/usr/bin/env bash
# [O2] The wheels' proofs one after another (one headless Chrome at a time):
#   NOIR_PORT=5372 tools/o2proofs.sh <out.log> play [play ...]
# each play (tools/plays/<play>.json) under tools/wd.sh; its PASS / FAIL lines
# and its driver's result line appended to the log.
set -uo pipefail
LOG="$1"; shift
cd "$(dirname "$0")/.."
for p in "$@"; do
  echo "=== $p" >> "$LOG"
  tools/wd.sh 900 node tools/play.mjs "tools/plays/$p.json" 2>&1 | grep -E "PASS|FAIL|drive tools|WATCHDOG|passed|failed" | cut -c1-1800 >> "$LOG"
done
echo "=== done" >> "$LOG"
