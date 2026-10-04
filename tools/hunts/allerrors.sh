#!/usr/bin/env bash
# [C10b] The errors sweep of the gate (WAVE_C §7.3) over every beat of every chapter, I to VIII,
# in shot mode (tools/errors.sh on each, one headless Chrome at a time).
#   NOIR_PORT=5350 tools/hunts/allerrors.sh       -> one line per beat, then "N of M clean"
set -uo pipefail
cd "$(dirname "$0")/../.."
QS=(
  "scene=diner&beat=settle&t=3" "scene=diner&beat=order&t=3" "scene=diner&beat=drink&t=3" "scene=diner&beat=pay&t=3"
  "scene=fight&beat=start&t=3" "scene=fight&beat=lesson&t=3" "scene=fight&beat=round1&t=6" "scene=fight&beat=round2&t=6"
  "scene=fight&beat=round3&t=6" "scene=fight&beat=reel&t=4" "scene=fight&beat=ko&t=2" "scene=fight&beat=outside&t=2" "scene=fight&beat=matchbook&t=3"
  "scene=office&beat=corridor&t=3" "scene=office&beat=room&t=3" "scene=office&beat=pad&t=3" "scene=office&beat=safe&t=3"
  "scene=office&beat=check&t=3" "scene=office&beat=done&t=3"
  "scene=gunfight&beat=shadows&t=6" "scene=gunfight&beat=flank&t=10" "scene=gunfight&beat=corridor&t=10" "scene=gunfight&beat=quiet&t=3"
  "scene=watcher&beat=seen&t=4" "scene=watcher&beat=escape&t=3" "scene=watcher&beat=alley&t=4" "scene=watcher&beat=lane&t=4"
  "scene=watcher&beat=yard&t=4" "scene=watcher&beat=kitchen&t=4" "scene=watcher&beat=press&t=4" "scene=watcher&beat=el&t=4"
  "scene=watcher&beat=cut&t=4" "scene=watcher&beat=over&t=4" "scene=watcher&beat=street&t=4" "scene=watcher&beat=market&t=4" "scene=watcher&beat=car&t=3"
  "scene=tail&beat=start&t=6" "scene=tail&beat=chase2&t=6" "scene=tail&beat=river&t=6" "scene=tail&beat=wreck&t=4" "scene=tail&beat=pier&t=4"
  "scene=warehouse&beat=arrive&t=3" "scene=warehouse&beat=floor&t=6" "scene=warehouse&beat=lamps&t=6" "scene=warehouse&beat=aisle&t=6"
  "scene=warehouse&beat=stairs&t=6" "scene=warehouse&beat=listen&t=6" "scene=warehouse&beat=office&t=4" "scene=warehouse&beat=loud&t=8"
  "scene=warehouse&beat=fight&t=6" "scene=warehouse&beat=ko&t=2" "scene=warehouse&beat=after&t=3"
  "scene=shootout&beat=dot&t=12" "scene=shootout&beat=gun&t=6" "scene=shootout&beat=cars&t=15" "scene=shootout&beat=flank&t=20"
  "scene=shootout&beat=el&t=16" "scene=shootout&beat=saloon&t=26" "scene=shootout&beat=cardinal&t=10" "scene=shootout&beat=last&t=5" "scene=shootout&beat=end&t=12"
)
ok=0; n=0
for q in "${QS[@]}"; do
  n=$((n + 1))
  out=$(VTB=${VTB:-9000} tools/errors.sh "$q&mute=1" 2>&1 | tr '\n' ' ')
  if echo "$out" | grep -q "ERRLOG: (clean)"; then ok=$((ok + 1)); echo "clean  $q   ($(echo "$out" | grep -o 'FRAMES RENDERED: [0-9]*'))"; else echo "ERROR  $q   $out"; fi
done
echo "$ok of $n clean"
