# [O3] writes the lane's plays (tools/plays/o3_*.json): one head (BEGIN, the
# city up, the people up), then the driver's stage (tools/lib/o3_people.mjs).
#   python3 tools/plays/o3/mk.py
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
HEAD = [
    {"wait": 1500},
    {"clickOn": "#title .opt[data-k=begin]", "taken": "G.state !== 'title'", "retries": 5, "every": 4000},
    {"until": "G.scenes.current && G.scenes.current.id === 'city' && G.scenes.fadeK < 0.05 && !!G.people", "timeout": 30000},
    {"wait": 1500},
]
PAD_HEAD = [
    {"until": "G.state === 'title' && N.hud.titleShown", "timeout": 40000},
    {"wait": 1500},
    {"pad": {"b": ["x"], "secs": 0.12}},
    {"wait": 400},
    {"pad": {"b": ["x"], "secs": 0.12}},
    {"until": "G.scenes.current && G.scenes.current.id === 'city' && G.scenes.fadeK < 0.05 && !!G.people", "timeout": 30000},
    {"wait": 1500},
]


def play(name, about, steps, url="/?mute=1&start=city", head=HEAD, extra=None):
    d = {"about": about, "url": url, "size": [1280, 800], "out": "shots/o3/" + name, "steps": head + steps}
    if extra:
        d.update(extra)
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump(d, f, indent=1)


D = "tools/lib/o3_people.mjs"
play('o3_punch_idle', "[O3] the walk-over arrest, idle: a man punched before a beat cop, then nothing - HEAT 1 at once, he walks over, 'Hands up.' (up over a second), 'Arrested.', the station: the gun gone, the heat gone, back in under ten seconds. Twice.",
     [{"drive": D, "mode": "punch", "then": "idle", "tries": 2, "shots": True, "check": "D.ok", "label": "punch seen, idle: warned, arrested, the station (twice)"}])
play('o3_punch_good', "[O3] the walk-over arrest, good: a man punched before a beat cop; as he comes I run (Shift) round the corner - the search, then 'Clear.'. Twice.",
     [{"drive": D, "mode": "punch", "then": "run", "tries": 2, "check": "D.ok", "label": "punch seen, good: away and lost (twice)"}])
play('o3_punch_fists', "[O3] the walk-over arrest, the fists: a man punched before a beat cop; I wait for him and punch him - the fist fight (lane O4's crowd brawl, COP), played by O4's bot with a first-timer's hands (bad); won: he lies there, HEAT 2, his gun on the pavement, taken with E.",
     [{"eval": "(G.people.hands.hasGun = false, 'staged: out of the station, no gun')"},
      {"drive": D, "mode": "punch", "then": "fists", "tries": 1, "check": "D.ok", "label": "the cop's fist fight starts"},
      {"drive": "tools/lib/o4_brawl.mjs", "profile": "bad", "beat": "roam", "tries": 1, "wins": 1, "timeout": 150000},
      {"wait": 2500},
      {"eval": "JSON.stringify({ fa: G.police.fists.active, who: window.__o3c.mode, down: window.__o3c.down, res: G.crowd.result, cmode: G.controller.mode, heat: G.police.heat, beat: G.scenes.beat, fail: G.lastFail, ev: G.police.events.slice(-6) })"},
      {"expect": "G.lastFail ? G.lastFail.why.startsWith('Arrested.') && G.scenes.beat === 'station' : (window.__o3c && window.__o3c.down && G.police.heat >= 2 && G.controller.mode === 'walk')", "label": "the fight ends: won (he lies there, HEAT 2: a cop down) or lost (arrested)"},
      {"walk": "G.lastFail ? [[G.eye.x, G.eye.z]] : (() => { const I = G.stage.part('items').list.filter(i => i.dropped && i.kind === 'weapon' && !i.taken).slice(-1)[0]; return [[I.x + 0.9, I.z]]; })()", "timeout": 6000, "into": True},
      {"look": "G.lastFail ? [0, 0] : (() => { const I = G.stage.part('items').list.filter(i => i.dropped && i.kind === 'weapon' && !i.taken).slice(-1)[0]; const C = G.controller; const want = Math.atan2(-(I.x - G.eye.x), -(I.z - G.eye.z)); const dy = Math.atan2(Math.sin(want - C.yaw), Math.cos(want - C.yaw)); return [Math.round(-dy / 0.0021), Math.round(-(-0.9 - C.pitch) / 0.0021)]; })()", "steps": 8},
      {"until": "!!G.lastFail || /^E +take/.test(G.hud.promptShown || '')", "timeout": 4000, "stop": False},
      {"key": "KeyE"},
      {"wait": 900},
      {"expect": "!!G.lastFail || G.people.hands.hasGun === true", "label": "won: his gun taken from the pavement (E)"}])
for prof, about in [('idle', "hands off: down, warned ('One more and you\u2019re down.'), arrested, the station"), ('bad', "a first-timer's hands (O4's bad): it ends, won or lost, in one to four"), ('medium', "medium hands: won in one to three (O4's mercy after each fall)"), ('good', "good hands: won first time")]:
    play('o3_cop_first_' + prof, "[O3] after the critic (B1): a beat cop I punch first (a cop 5 m ahead, the only staging): the fist fight is O4's crowd brawl and it ends - " + about + ".",
         [{"drive": "tools/lib/o3_copfirst.mjs", "profile": prof, "tries": 1 if prof in ('idle', 'good') else (4 if prof == 'bad' else 3),
           "check": {"idle": "D.tries[0].result === 'down' && D.tries[0].after.fail.startsWith('Arrested.') && D.tries[0].after.beat === 'station' && D.tries[0].sentDuring === 0",
                     "bad": "D.ended && D.tries.every(t => t.sentDuring === 0)",
                     "medium": "D.won && D.wonAt <= 3 && D.tries.every(t => t.sentDuring === 0)",
                     "good": "D.won && D.wonAt === 1"}[prof],
           "label": "the cop punched first: " + about}])
play('o3_witness', "[O3] the witnesses: a punch nobody sees raises nothing; the same before a cop: HEAT 1 at once; before a civilian: he looks at me, runs to the call box, HEAT 1 when he gets there; one I catch gives it up: nothing.",
     [{"drive": D, "mode": "witness", "shots": True, "check": "D.ok", "label": "the witness rules: empty 0, cop 1, box 1, stopped 0"}])
play('o3_lose', "[O3] losing them on foot: HEAT 1 seen, away round the corner - the search shown (the badges breathe, 'Lose them.'), found again (the heat as it was), away again: 'Clear.'.",
     [{"drive": D, "mode": "lose", "shots": True, "check": "D.ok", "label": "the search shown, found again, lost: Clear."}])
play('o3_chase_idle', "[O3] the car chase at HEAT 2, idle: in my car, the patrol car comes (the siren first), stops across my nose, its men at my door - 'Hands up.', 'Arrested.'.",
     [{"drive": D, "mode": "chase", "heat": 2, "profile": "idle", "tries": 1, "shots": True, "check": "D.wins === 1", "label": "chase idle: boxed, warned, arrested"}])
play('o3_chase_medium', "[O3] the car chase at HEAT 2, medium hands (slower, 58 km/h at most, reacting a beat late): away down the streets until they lose me; up to three tries.",
     [{"drive": D, "mode": "chase", "heat": 2, "profile": "medium", "tries": 3, "secs": 150, "check": "D.wins >= 1", "label": "chase medium: lost in one to three"}])
play('o3_chase_good', "[O3] the car chase at HEAT 2, good hands: away, lost, twice.",
     [{"drive": D, "mode": "chase", "heat": 2, "profile": "good", "tries": 2, "secs": 150, "check": "D.wins === 2", "label": "chase good: lost twice"}])
play('o3_roadblock', "[O3] HEAT 3 in the car: two cars and the roadblock on my road ahead (two cars nose to nose, men behind them); medium hands: through it, round it, or away - lost in one to three.",
     [{"drive": D, "mode": "chase", "heat": 3, "profile": "medium", "tries": 3, "secs": 180, "shots": True, "check": "D.wins >= 1 && D.tries.some(t => t.ev.some(e => e.startsWith('roadblock')))", "label": "roadblock: seen, and lost in one to three"}])
play('o3_heat4', "[O3] HEAT 4 on foot: the detectives' car, the Tommy gun and the pistol out of it (the gun kit's men, every tell); idle: down, warned, the hospital; good (the chase driver in my car): away.",
     [{"drive": D, "mode": "chase", "heat": 4, "profile": "good", "tries": 1, "secs": 180, "check": "D.wins === 1", "label": "HEAT 4 in the car: away and lost"}])
play('o3_heat4_idle', "[O3] HEAT 4 on foot, idle: the detectives' car comes, the Tommy gun and the pistol out of it (the gun kit's men: the raise, the glint, the settle); a man who stands there goes down - warned first ('You're hit. Get to cover.') - and wakes at the hospital.",
     [{"drive": D, "mode": "chase", "heat": 4, "profile": "idle", "onFoot": True, "tries": 1, "shots": True, "check": "D.wins === 1", "label": "HEAT 4 idle on foot: warned, down, the hospital"}])
play('o3_heat5', "[O3] HEAT 5 on foot, idle: everything - the detectives' car, the patrol cars, the riot squad's lorry and its three; down, warned, the hospital.",
     [{"drive": D, "mode": "chase", "heat": 5, "profile": "idle", "onFoot": True, "tries": 1, "check": "D.wins === 1", "label": "HEAT 5 idle on foot: warned, down, the hospital"},
      {"eval": "JSON.stringify(G.police.events.filter(e => e.what === 'car').map(e => e.role))"}])
play('o3_gangs', "[O3] the gangs: a three on a Tenements corner, three men not one; I walk up - the word; I push one (a jab) - the fist fight; the Docks' three draw when I draw at 15 m; the border fight (fists, then guns) seen from 30 m, the police car to it, no heat on me.",
     [{"drive": D, "mode": "gangs", "gang": "tenements", "draw": True, "war": True, "shots": True, "check": "D.ok", "label": "the gang's word, the push, the fight; the Docks draw when I draw; the border fight seen, the police to it"}])
play('o3_crowd', "[O3] the jank walk through the busiest crowd (Grand Ave under the el, the crowd at its cap): nobody through anybody, nobody in a wall, the eye never in a man; my car into four people in the road: they clear, never through; the gun out among six: they run; a shot: they scatter; the car flat out at two stepping into the road: down.",
     [{"drive": D, "mode": "crowd", "min": 14, "car": True, "gun": True, "fast": True, "shots": True, "check": "D.ok", "label": "the crowd: nothing through anything; the gun out, they run; a shot, they scatter; a car too fast, down"}])
play('o3_latency', "[O3] the latency: LMB on foot to the fist's first frame (seven), E at a police car to the seat (five): the median under 50 ms (the machine loaded: a stall frame now and then is the machine's, the record lists every frame).",
     [{"drive": D, "mode": "latency", "n": 7, "nE": 5, "check": "D.ok", "label": "fists and E: under 50 ms"}])

for what, about in [('arrest', "the arrest: the punch, the cop coming face on, 'Hands up.', the black, the station"),
                    ('witness', "a witness: he looks at me, he runs, the call box, HEAT 1"),
                    ('roadblock', "the roadblock: HEAT 3 in the car, the two cars across the road ahead, the men behind them")]:
    play('o3_strip_' + what, "[O3] the strip of " + about + " (shots s_00.. tiled by tools/plays/o3/tile.py; not a proof)",
         [{"drive": D, "mode": "strip", "what": what, "check": "D.ok", "label": "the strip's frames"}])

play('o3_pad_arrest', "[O3] the pad alone (the fake pad; no key, no mouse): R2 jabs a man before a beat cop (HEAT 1), then nothing - 'Hands up.', 'Arrested.', the station.",
     [{"drive": D, "mode": "punch", "then": "idle", "tries": 1, "check": "D.ok", "label": "pad: punch seen, arrested, the station"}],
     url="/?mute=1&padfake=1&start=city", head=PAD_HEAD, extra={"input": "pad"})
play('o3_pad_chase', "[O3] the pad alone: square into the car, HEAT 2, R2 / L2 and the stick away down the streets until they lose me.",
     [{"drive": D, "mode": "chase", "heat": 2, "profile": "medium", "tries": 1, "secs": 180, "check": "D.tries[0].drive.km > 0.3 && !D.tries[0].drive.failed || D.wins === 1", "label": "pad: the chase driven by the pad (lost, or at least away and not taken)"}],
     url="/?mute=1&padfake=1&start=city", head=PAD_HEAD, extra={"input": "pad"})

play('o3_soak', "[O3] memory: ten minutes at HEAT 3 (in the car, chased, boxed, arrested and back, the heat put back each time it falls): the heap after a collection, the renderer's geometries and textures, the people made and pooled, read every two minutes - flat.",
     [{"drive": D, "mode": "soak", "secs": 600, "check": "D.ok", "label": "ten minutes at HEAT 3: memory flat"}])

play('o3_frames', "[O3] the review frames at 1440 x 900 (not a proof): 'Hands up.' face on, the roadblock ahead from the car, the gang's word",
     [{"drive": D, "mode": "frames", "check": "D.ok", "label": "the frames"}], extra={"size": [1440, 900]})
# [O3] after the critic (M1): the unstaged crimes on Grand Avenue, three in a row each
for mode, about in [('punch', "the nearest walker punched down"), ('shoot', "the gun drawn (RMB) among the walkers and two shots")]:
    play('o3_unstaged_' + mode, "[O3] after the critic (M1): unstaged on Grand Avenue, three times in a row (each from where the last ended): " + about + ", then hands off at the place - answered within about 10 s with something seen or heard (a witness going, a whistle, a car), the heat comes, and it never dies while I stand there unfound.",
         [{"drive": "tools/lib/o3_unstaged.mjs", "mode": mode, "tries": 3, "secs": 90, "check": "D.answered === 3", "label": "three of three answered, the heat held at the place"}])
# [O3] after the critic: the review frames of the fixes (1440 x 900, not a proof)
play('o3_frames_after', "[O3] after the critic: the review frames - a beat cop punched first, the fist fight on (O4's crowd brawl); the station wake facing the door; the roadblock's beacons under a lamp from 75 m.",
     [{"eval": "(() => { const E = G.eye, y = G.controller.yaw, fx = -Math.sin(y), fz = -Math.cos(y); window.__o3cop = G.people.dbgCop(E.x + fx * 5, E.z + fz * 5, Math.atan2(-fx, -fz)); return 1; })()"},
      {"down": "KeyW"}, {"until": "Math.hypot(window.__o3cop.pos.x - G.eye.x, window.__o3cop.pos.z - G.eye.z) < 1.8", "timeout": 6000}, {"up": "KeyW"},
      {"look": "(() => { const C = G.controller, c = window.__o3cop; const want = Math.atan2(-(c.pos.x - G.eye.x), -(c.pos.z - G.eye.z)); const dy = Math.atan2(Math.sin(want - C.yaw), Math.cos(want - C.yaw)); return [Math.round(-dy / 0.0021), Math.round(-(-0.05 - C.pitch) / 0.0021)]; })()", "steps": 6},
      {"mouse": "click", "button": "left"},
      {"until": "G.crowd.active && G.crowd.liveT > 3.2 && G.crowd.men[0] && G.crowd.men[0].state === 'atk'", "timeout": 20000},
      {"shot": "f_cop_fight"},
      {"until": "!!G.failing", "timeout": 120000},
      {"until": "!G.failing && G.scenes.beat === 'station' && G.scenes.fadeK < 0.05", "timeout": 20000},
      {"wait": 700},
      {"shot": "f_station_wake"},
      {"eval": "(() => { const P = G.people; P.dbgClear(); P.dbgAtCar(); return 1; })()"}, {"wait": 300},
      {"key": "KeyE"}, {"wait": 1600},
      {"eval": "(G.police.raise(3, G.city.car.pos, 'staged'), G.police.makeBlock(85), G.police.block && Math.hypot(G.police.block.x - G.city.car.pos.x, G.police.block.z - G.city.car.pos.z))"},
      {"wait": 1200},
      {"shot": "f_roadblock"}],
     extra={"size": [1440, 900]})
