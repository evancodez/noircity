#!/usr/bin/env python3
"""[R3] CONTINUE from every save point: tools/plays/saves.json, built from
the saves a whole play wrote (tools/plays/whole.json prints them at its end:
the line `eval  JSON.stringify(__rec.saves) -> "[...]"`).

  python3 tools/lib/saves.py <whole play's log>     writes tools/plays/saves.json
  NOIR_PORT=5331 node tools/play.mjs tools/plays/saves.json

For each save point, in the story's order: the save put back as the game
wrote it, the page reloaded, CONTINUE on the title by a real click, then the
chapter must come up at that beat (or the beat the script runs on into at
once), out of the black, playing, the inventory and the flags as saved, the
music the beat's, nothing in the error log; a frame of it; then three
seconds of play by real input (a look round and a step) and the log again.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLAYS = os.path.join(ROOT, 'tools', 'plays')

ORDER = ['diner', 'fight', 'body', 'office', 'gunfight', 'watcher', 'tail', 'warehouse', 'shootout']
# the music a beat continued into should have (None: silent; '*': any)
MUSIC = {
    'diner': 'jukebox_a', 'fight': '*', 'body': 'body', 'office': 'office', 'gunfight': None,
    'watcher': '*', 'tail': 'tail', 'warehouse': '*', 'shootout': '*',
}


def saves_from_log(path):
    txt = open(path).read()
    m = re.search(r'eval  JSON\.stringify\(__rec\.saves\) -> (".*")\s*$', txt, re.M)
    if not m:
        raise SystemExit('no saves line in ' + path)
    return json.loads(json.loads(m.group(1)))


def build(saves):
    seen, pts = set(), []
    for s in saves:
        k = (s['scene'], s['beat'])
        if k in seen or s['scene'] not in ORDER or s['flags'].get('ended'):
            continue
        seen.add(k)
        pts.append(s)
    steps = [{'until': "G.state === 'title'", 'timeout': 40000}, {'wait': 1500}]
    for i, s in enumerate(pts):
        sc, b = s['scene'], s['beat']
        tag = '%02d_%s_%s' % (i, sc, b)
        beats_js = 'G.scenes.get(%s).beats' % json.dumps(sc)
        steps += [
            {'name': '---- CONTINUE at %s.%s' % (sc, b)},
            {'eval': "(G.save.enabled = false, localStorage.setItem('noir.save', %s), true)" % json.dumps(json.dumps(s))},
            {'reload': True},
            {'until': "G.state === 'title' && !document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden')", 'timeout': 40000},
            {'wait': 1200},
            {'clickOn': '#title .opt[data-k=continue]', 'taken': "G.state !== 'title'", 'retries': 5, 'every': 4000},
            {'until': "G.scenes.current && G.scenes.current.id === %s && %s.indexOf(G.scenes.beat) >= %s.indexOf(%s)" % (json.dumps(sc), beats_js, beats_js, json.dumps(b)), 'timeout': 30000},
            {'until': '!G.scenes.trans', 'timeout': 15000},
            {'wait': 1500},
            {'expect': "G.state === 'playing' && G.scenes.fadeK < 0.05 && document.pointerLockElement === N.renderer.domElement", 'label': '[%s] out of the black, playing' % tag},
            {'expect': "JSON.stringify(G.save.inventory.slice().sort()) === %s" % json.dumps(json.dumps(sorted(s['inventory']))), 'label': '[%s] the inventory as saved' % tag},
            {'expect': "Object.entries(%s).every(([k, v]) => JSON.stringify(G.save.flags[k]) === JSON.stringify(v))" % json.dumps(s['flags']), 'label': '[%s] the flags as saved' % tag},
        ]
        mu = MUSIC.get(sc)
        if mu is None:
            steps.append({'eval': "'music: ' + G.music.current"})
        elif mu != '*':
            steps.append({'expect': "G.music.current === %s" % json.dumps(mu), 'label': '[%s] the music %s' % (tag, mu)})
        steps += [
            {'eval': "({ beat: G.scenes.beat, mode: G.controller.mode, hands: G.hands.set, weapon: G.player.weapons.current, music: G.music.current, prompt: G.hud.promptShown, say: G.hud.sayShown, fov: +N.camera.fov.toFixed(1), stage: G.stage.name, hp: G.health.hp })"},
            {'shot': 'k' + tag},
            {'look': [120, 0], 'steps': 6},
            {'look': [-120, 20], 'steps': 6},
            {'key': 'KeyW', 'hold': 500},
            {'wait': 1000},
            {'expect': "!document.getElementById('errlog').textContent.trim()", 'label': '[%s] no errors' % tag},
        ]
    # the story played to THE END: the title offers no CONTINUE (BEGIN, CHAPTERS)
    ended = [s for s in saves if s['flags'].get('ended')]
    if ended:
        steps += [
            {'name': '---- the save of a story played to THE END'},
            {'eval': "(G.save.enabled = false, localStorage.setItem('noir.save', %s), true)" % json.dumps(json.dumps(ended[-1]))},
            {'reload': True},
            {'until': "G.state === 'title'", 'timeout': 40000},
            {'wait': 1200},
            {'expect': "document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden') && !document.querySelector('#title .opt[data-k=begin]').classList.contains('hidden')", 'label': '[ended] the title offers BEGIN, not CONTINUE'},
            {'shot': 'k_ended_title'},
        ]
    play = {
        'about': '[R3] CONTINUE from every save point the whole game writes (tools/lib/saves.py from a whole.json run): '
                 'the save as written, a reload, CONTINUE by a real click, the beat up out of the black with what the '
                 'story gave by then, three seconds of play. NOIR_PORT=5331 node tools/play.mjs tools/plays/saves.json',
        'url': '/?mute=1',
        'size': [1280, 800],
        'out': 'shots/play/saves',
        'steps': steps,
    }
    with open(os.path.join(PLAYS, 'saves.json'), 'w') as f:
        json.dump(play, f, indent=1)
    print('saves.json: %d save points, %d steps' % (len(pts), len(steps)))
    for s in pts:
        print('  %s.%s  inv=%s flags=%s' % (s['scene'], s['beat'], ','.join(s['inventory']), json.dumps(s['flags'])))


if __name__ == '__main__':
    build(saves_from_log(sys.argv[1]))
