#!/bin/bash
# [C10b] Plays run one after another (one headless Chrome at a time), each to its own log:
#   NOIR_PORT=5350 tools/hunts/chain.sh <logdir> play1 play2 ...
# Prints one line per play: its name, passes / fails, seconds.
dir="$1"; shift
mkdir -p "$dir"
for p in "$@"; do
  t0=$(date +%s)
  node tools/play.mjs "tools/plays/$p.json" > "$dir/$p.log" 2>&1
  t1=$(date +%s)
  echo "$p: $(grep -c '  PASS  ' "$dir/$p.log") pass, $(grep -c '  FAIL  ' "$dir/$p.log") fail, $((t1 - t0)) s"
done
