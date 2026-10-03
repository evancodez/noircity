#!/usr/bin/env bash
# [C4] The errors sweep of the gate (WAVE_C §7.3) over every beat of I and II,
# the fight's moments and autoplayed fights, and Pier 9's fight: tools/errors.sh
# on each, one headless Chrome at a time, a watchdog per capture.
#   NOIR_PORT=5344 tools/c4errors.sh            -> one line per beat, then "N of M clean"
set -uo pipefail
cd "$(dirname "$0")/.."
QS=(
  "scene=diner&beat=settle&t=3"
  "scene=diner&beat=order&t=3"
  "scene=diner&beat=drink&t=3"
  "scene=diner&beat=pay&t=2"
  "scene=diner&beat=pay&t=7"
  "scene=fight&beat=start&t=1"
  "scene=fight&beat=start&t=3.4"
  "scene=fight&beat=start&t=6"
  "scene=fight&beat=start&t=10"
  "scene=fight&beat=lesson&step=1&t=3"
  "scene=fight&beat=lesson&step=3&t=4"
  "scene=fight&beat=lesson&step=4&t=3"
  "scene=fight&beat=lesson&step=5&t=4"
  "scene=fight&beat=lesson&step=7&t=6"
  "scene=fight&beat=round1&t=6"
  "scene=fight&beat=round2&t=6"
  "scene=fight&beat=round3&t=6"
  "scene=fight&beat=reel&t=4"
  "scene=fight&beat=ko&t=1"
  "scene=fight&beat=ko&t=3"
  "scene=fight&beat=outside&t=2"
  "scene=fight&beat=matchbook&t=3"
  "shot=r2duel&do=br_hook&slip=none&hud=1&t=1.6"
  "shot=r2duel&do=br_hook&slip=R&react=0.45&hud=1&t=1.6"
  "shot=r2duel&do=br_haymaker&slip=L&react=0.5&hud=1&t=1.9"
  "shot=b8duel&do=throw&hud=1&t=2.0"
  "shot=b8duel&do=stoolSwing&hud=1&t=2.4"
  "shot=r2duel&do=br_answerL&hud=1&t=1.25"
  "shot=r2duel&do=hard&arm=R&hold=0.9&hud=1&t=1.8"
  "shot=r2play&beat=lesson&seed=3&style=player&t=120"
  "shot=r2play&beat=lesson&seed=3&style=mash&t=120"
  "shot=r2play&beat=lesson&seed=3&style=rough&t=120"
  "shot=r2play&beat=lesson&seed=3&style=medium&t=120"
  "shot=r2play&beat=lesson&seed=3&style=clicker&t=120"
  "shot=r2play&beat=lesson&seed=3&style=lazydodge&t=120"
  "shot=r2play&scene=warehouse&beat=fight&seed=2&style=medium&t=60"
  "scene=warehouse&beat=fight&t=6"
)
ok=0; n=0
for q in "${QS[@]}"; do
  n=$((n + 1))
  out=$(VTB=${VTB:-9000} tools/errors.sh "$q&mute=1" 2>&1 | tr '\n' ' ')
  if echo "$out" | grep -q "ERRLOG: (clean)"; then ok=$((ok + 1)); echo "clean  $q   ($(echo "$out" | grep -o 'FRAMES RENDERED: [0-9]*'))"; else echo "ERROR  $q   $out"; fi
done
echo "$ok of $n clean"
