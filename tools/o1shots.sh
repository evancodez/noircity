#!/usr/bin/env bash
# [O1] A few frames of the city in one go (one headless Chrome at a time):
#   tools/o1shots.sh <listfile> [outdir] [w] [h]
# listfile: one "name|query" per line (# comments). Each frame is
# tools/shot.sh under tools/wd.sh. Run with NOIR_PORT set.
set -uo pipefail
LIST="$1"; OUT="${2:-shots/o1}"; W="${3:-1440}"; H="${4:-900}"
cd "$(dirname "$0")/.."
while IFS='|' read -r name q; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  tools/wd.sh 200 tools/shot.sh "$OUT/$name.png" "$q" "$W" "$H"
done < "$LIST"
