#!/bin/sh
# [C3b critic] one batch of moves into a stepplay session, a compact status line out.
#   tools/plays/critic/c3b_s.sh <dir> '<moves JSON>'
node "$(dirname "$0")/c3c2_cmd.mjs" "$1" "$2" | awk '!seen[$0]++' | python3 -c '
import sys,json
SEP=(chr(44),chr(58))
for l in sys.stdin:
    if l.startswith("S "):
        s=json.loads(l[2:]); keys=["t","phase","obj","teach","warnTxt","prompt","say","lastFail","my","kmh","his","hkmh","gap","seen","dmg","hisDmg","gun","ov","mode","scene"]
        print(" ".join(f"{k}={json.dumps(s.get(k),separators=SEP)}" for k in keys if s.get(k) not in (None,"",False)))
    else: print(l.rstrip())
'
