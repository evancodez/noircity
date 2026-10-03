#!/usr/bin/env python3
# Critic C4 (second look): writes a bot play.  c4b_mk.py <name> <start> <profile> <timeout_ms> [every_ms] [shots] [extra json]
import json, sys
name, start, prof, tmo = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
every = int(sys.argv[5]) if len(sys.argv) > 5 else 0
shots = int(sys.argv[6]) if len(sys.argv) > 6 else 30
extra = json.loads(sys.argv[7]) if len(sys.argv) > 7 else {}
STATE = "JSON.stringify({t:+G.time.toFixed(1),sc:G.scenes.current&&G.scenes.current.id,beat:G.scenes.beat,obj:G.hud.objectiveText,prompt:G.hud.promptShown,say:G.hud.sayShown,warn:G.hud.warnText,p:[+N.controller.pos.x.toFixed(2),+N.controller.pos.z.toFixed(2)],inv:G.save.inventory.join(',')})"
drive = {"drive": "tools/plays/critic/c4_bot.mjs", "profile": prof, "timeout": tmo, "shots": shots}
if every: drive["every"] = every
drive.update(extra)
play = {"about": f"Critic C4 second look: {start} from the title, profile {prof}.", "url": f"/?mute=1&start={start}", "size": [1440, 900], "out": f"shots/critic/{name}",
  "steps": [
    {"until": "G.state === 'title' && !document.getElementById('title').classList.contains('hidden')", "timeout": 30000},
    {"wait": 1500},
    {"clickOn": "#title .opt[data-k=begin]", "taken": "G.state !== 'title'", "retries": 5, "every": 4000},
    {"until": "G.scenes.current && G.brawl && G.brawl.active", "timeout": 90000},
    drive,
    {"wait": 1500},
    {"shot": "end"},
    {"eval": STATE}]}
json.dump(play, open(f"tools/plays/critic/{name}.json", "w"), indent=1)
print("wrote", name)
