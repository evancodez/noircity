#!/usr/bin/env bash
# A watchdog for a headless run that can hang (a loaded machine: errors.sh,
# play.mjs, shot.sh sometimes sit at 0 % CPU for ever, C13's left 9).
# Usage: tools/wd.sh <seconds> <command...>   runs the command in its own
# process group; if it is still running after <seconds>, the whole group
# (Chrome included) is killed and the exit code is 124.
set -m
secs="$1"; shift
"$@" & pid=$!
for ((i = 0; i < secs; i++)); do
  sleep 1
  if ! kill -0 "$pid" 2>/dev/null; then wait "$pid"; exit $?; fi
done
kill -- -"$pid" 2>/dev/null; sleep 1; kill -9 -- -"$pid" 2>/dev/null
echo "WATCHDOG: killed after ${secs}s: $*"
exit 124
