# [C3b critic] build a moves JSON for a stepplay session: argv = moves JSON in which the string "PROJ"
# becomes {"eval": <c3c2_proj.js>} (his car projected on the screen).
import sys, json, os
proj = open(os.path.join(os.path.dirname(__file__), 'c3c2_proj.js')).read()
mv = json.loads(sys.argv[1])
print(json.dumps([{"eval": proj} if m == "PROJ" else m for m in mv]))
