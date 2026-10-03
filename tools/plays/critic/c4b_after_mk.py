#!/usr/bin/env python3
# Critic C4 (second look): after the last blow, as a player who pokes about.
import json
ST = "JSON.stringify({t:+G.time.toFixed(1),beat:G.scenes.beat,p:[+G.eye.x.toFixed(2),+G.eye.y.toFixed(2),+G.eye.z.toFixed(2)],yaw:+N.controller.yaw.toFixed(2),mode:N.controller.mode,msg:+G.hud.el.msg.style.opacity>0?G.hud.el.msg.textContent:'',prompt:G.hud.promptShown,obj:G.hud.objectiveText,say:G.hud.sayShown,warn:G.hud.warnText,win:G.brawl&&G.brawl.stats&&G.brawl.stats.window,inv:G.save.inventory.join(',')})"
def S(): return {"eval": ST}
def shot(n): return [S(), {"shot": n}]
TITLE = [{"until": "G.state === 'title' && !document.getElementById('title').classList.contains('hidden')", "timeout": 30000}, {"wait": 1500},
  {"clickOn": "#title .opt[data-k=begin]", "taken": "G.state !== 'title'", "retries": 5, "every": 4000}]
def face(x, z):  # turn to a point (yaw by mouse)
  return {"look": f"(() => {{ const yw = Math.atan2(-({x} - G.eye.x), -({z} - G.eye.z)); const d = Math.atan2(Math.sin(yw - N.controller.yaw), Math.cos(yw - N.controller.yaw)); return [Math.round(-d / (N.controller.sensitivity || 0.0021)), 0]; }})()", "steps": 8}
plays = {}
# 1. the door after the KO: turn round, walk to it, into it, E, push out
st = TITLE + [{"until": "G.scenes.current && G.scenes.current.id==='fight' && G.scenes.beat==='ko' && N.controller.mode==='walk'", "timeout": 60000}, {"wait": 800}]
st += shot('d00_ko')
st += [{"look": [700, 0], "steps": 10}, {"wait": 400}] + shot('d01_turned_away')
st += [{"walk": [[-12.0, 0.9], [-11.4, 0.62]], "timeout": 20000, "stop": False}, face(-10.4, 0.62), {"wait": 500}] + shot('d02_door_1m')
st += [{"down": "KeyW"}, {"wait": 900}, {"up": "KeyW"}, {"wait": 200}] + shot('d03_door_walked_into')
st += [{"look": [0, 250], "steps": 6}, {"wait": 300}] + shot('d04_door_look_down')
st += [{"look": [0, -250], "steps": 6}, {"look": [180, 0], "steps": 4}, {"wait": 300}] + shot('d05_door_look_side')
st += [{"look": [-180, 0], "steps": 4}, {"wait": 300}, {"key": "KeyE"}, {"wait": 500}] + shot('d06_E_lift') + [{"wait": 1200}] + shot('d07_lifted')
st += [{"down": "KeyW"}, {"wait": 600}] + shot('d08_push1') + [{"wait": 700}] + shot('d09_push2') + [{"wait": 900}, {"up": "KeyW"}] + shot('d10_out')
st += [{"until": "G.scenes.beat === 'outside'", "timeout": 8000, "stop": False}] + shot('d11_outside')
plays['c4b_after_door'] = {"about": "Critic C4 second look: after the KO, turn away from the window, find the street door, walk into it, E, push out.", "url": "/?mute=1&start=fight.ko", "size": [1440, 900], "out": "shots/critic/c4b_after_door", "steps": st}
# 2. the sill: from the far end of the broken bay, back two metres, beside a stool
st = TITLE + [{"until": "G.scenes.current && G.scenes.current.id==='fight' && G.scenes.beat==='ko' && N.controller.mode==='walk'", "timeout": 60000}, {"wait": 800}]
st += shot('s00_ko')
st += [{"down": "KeyS"}, {"wait": 1200}, {"up": "KeyS"}, {"wait": 300}] + shot('s01_backed_off')
st += [{"down": "KeyA"}, {"wait": 900}, {"up": "KeyA"}, {"wait": 300}] + shot('s02_aside')
st += [{"key": "Space"}, {"wait": 300}] + shot('s03_space') + [{"wait": 500}] + shot('s04_space2') + [{"wait": 900}] + shot('s05_after')
plays['c4b_after_sill'] = {"about": "Critic C4 second look: after the KO, back off and aside, then SPACE where the prompt is.", "url": "/?mute=1&start=fight.ko", "size": [1440, 900], "out": "shots/critic/c4b_after_sill", "steps": st}
for k, v in plays.items():
  json.dump(v, open(f"tools/plays/critic/{k}.json", "w"), indent=1); print('wrote', k)
