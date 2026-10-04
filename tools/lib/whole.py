#!/usr/bin/env python3
"""[C10b] The whole game in one page session, by real input: BEGIN, the
opening stills, the eight chapters of wave C, THE END, the title again.

  python3 tools/lib/whole.py      writes tools/plays/whole.json (the good hands)
                                  and tools/plays/whole_first.json (the clumsy ones)
  NOIR_PORT=5350 node tools/play.mjs tools/plays/whole.json

Each chapter is played by its lane's own play or driver, from the step where
the chapter comes in by the story (its title, BEGIN and ?start= dropped, its
screenshots dropped): the slice (I and the way into II), the fight bot (II),
lane C5's office chain (III) and door driver (IV), lane C6's chase (V), lane
C3's tail (VI), lane C7's pier (VII: the quiet steps, the office, the loud
driver, the fist fight), lane C8's nick and block drivers (VIII). The gun
drivers run with `flow: true`: they wait for each beat to come by the story
and a retry by the game's own fail (never sent to a beat). The two plays
differ only in the hands (good / clumsy profiles, the clumsy lanes' steps).

At each chapter's start the page is measured (the garbage-collected heap,
draw calls, geometries, textures, programs, listeners, the frame rate over
two seconds) and what the chapter finds is checked against what the last one
left (WAVE_C section 4: the carry, the hands, the mode, the weapon, the
objective). A recorder in the page keeps the chapter cards, the music cues,
the beats, the teach cards as they are taught, every save, every fail.
The old wave B builder is parked as tools/plays/_wave_b/whole_wave_b.py.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLAYS = os.path.join(ROOT, 'tools', 'plays')


def load(name):
    return json.load(open(os.path.join(PLAYS, name + '.json')))['steps']


def strip(steps):
    out = []
    for s in steps:
        if 'shot' in s:
            continue
        s = json.loads(json.dumps(s))
        for k in ('fight', 'shoot', 'drive'):
            if k in s and isinstance(s[k], dict):
                s[k]['shots'] = {}
        if 'drive' in s and 'shots' in s:
            s['shots'] = {}
        out.append(s)
    return out


def idx(steps, pred, what):
    for i, s in enumerate(steps):
        if pred(s):
            return i
    raise SystemExit('no step: ' + what)


RECORDER = r"""(() => {
  const R = window.__rec = { cards: [], small: [], cues: [], beats: [], saves: [], marks: {}, taught: [], fails: [], stills: [], hitch: [], over: [] };
  const S = G.scenes, now = () => +N.time.toFixed(2), at = () => [now(), S.current ? S.current.id : null, S.beat];
  const card = G.hud.card.bind(G.hud);
  G.hud.card = (n, name, secs) => { R.cards.push([now(), n, name]); return card(n, name, secs); };
  G.on('music:cue', (e) => R.cues.push([...at(), 'cue', e.slot]));
  const stop = G.music.stop.bind(G.music);
  G.music.stop = (f) => { if (G.music.current) R.cues.push([...at(), 'stop', G.music.current]); return stop(f); };
  G.on('scene:beat', (e) => R.beats.push([now(), e.id, e.beat]));
  G.on('scene:enter', (e) => { if (!R.marks[e.id]) R.marks[e.id] = { t: now(), real: Date.now() }; });
  G.on('fail', (e) => R.fails.push([now(), e.scene, e.from, e.to, e.why]));
  G.on('stills:end', (e) => R.stills.push([now(), e.id, !!e.skipped]));
  const write = G.save.write.bind(G.save);
  G.save.write = () => { const d = write(); if (d) R.saves.push([d.scene, d.beat]); return d; };
  // the teach cards in the order they are first taught (save.flags.taught grows), with where
  let known = new Set(Object.keys((G.save.flags && G.save.flags.taught) || {}));
  let lastSmall = null;
  G.scripts.push(() => {
    const t = (G.save.flags && G.save.flags.taught) || {};
    for (const k of Object.keys(t)) if (!known.has(k)) { known.add(k); R.taught.push([...at(), k]); }
    if (G.save.flags && !G.save.flags.taught) known = new Set();
    const sc = G.smallCardShown; if (sc && sc !== lastSmall) { lastSmall = sc; R.small.push([...at(), sc.name || '']); }
  });
  let lastF = performance.now();
  const hf = (n) => { const d = n - lastF; lastF = n; if (d > 150 && G.state === 'playing' && !document.hidden) R.hitch.push([...at(), Math.round(d), +S.fadeK.toFixed(2)]); requestAnimationFrame(hf); };
  requestAnimationFrame(hf);
  window.__measure = () => (MEASURE);
  window.__fps = () => (FPS);
  return 'recording';
})()"""

MEASURE = r"""(() => {
  const T = (f) => { try { return f(); } catch (e) { return 'ERR'; } };
  const I = N.renderer.info, S = G.stage;
  let objs = 0, lights = 0;
  T(() => S.scene.traverse((o) => { objs++; if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight && o.visible && o.intensity > 0) lights++; }));
  return { ch: T(() => G.scenes.current.id), beat: G.scenes.beat, stage: T(() => S.name), built: T(() => [...N.stages.built.keys()].join(',')),
    calls: I.render.calls, tris: I.render.triangles, programs: T(() => I.programs.length), geos: I.memory.geometries, tex: I.memory.textures, objs, lights,
    listeners: T(() => [...G._events.values()].reduce((a, v) => a + v.length, 0)), scripts: T(() => G.scripts.length), hooks: T(() => G.scenes.hooks.length),
    ais: T(() => G.ais.size), hoods: T(() => S.hoods.list.length), veh: T(() => G.vehicles.list ? G.vehicles.list.length : (G.vehicles.cars || []).length),
    mode: T(() => G.controller.mode), hands: T(() => G.hands.set), weapon: T(() => G.player.weapons.current), ammo: T(() => G.player.weapons.active ? G.player.weapons.active.ammo : null),
    inv: T(() => G.save.inventory.join(',')), note: T(() => G.save.flags.note), obj: T(() => G.hud.objectiveText), music: T(() => G.music.current), hp: T(() => G.health.hp),
    loops: T(() => N.sfx.loops ? [...N.sfx.loops.keys()].join(',') : null), brawl: T(() => !!G.brawl.active), layers: T(() => [...document.querySelectorAll('#hud .layer')].map((l) => l.dataset.layer).join(',')) };
})()"""

FPS = r"""(async () => { const ts = []; let last = performance.now(); const t0 = last;
  await new Promise((res) => { const f = (n) => { ts.push(n - last); last = n; if (n - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  ts.shift(); const a = ts.reduce((x, y) => x + y, 0) / ts.length; ts.sort((x, y) => x - y);
  return { fps: +(1000 / a).toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), calls: N.renderer.info.render.calls }; })()"""


MARKS = {}


def chapter(n, scene, checks=(), wait_cond=None):
    """a chapter's start: it comes in, the card goes, the measure, the checks"""
    steps = [
        {'name': '==== chapter %s: %s' % (n, scene)},
        {'until': wait_cond or ("G.scenes.current && G.scenes.current.id === '%s'" % scene), 'timeout': 120000},
        {'wait': 900},
        {'shot': 'c%d_%s_in' % (n, scene)},
    ]
    for label, expr in checks:
        steps.append({'expect': expr, 'label': '[%s] %s' % (scene, label)})
    steps += [{'eval': '__measure()'}, {'eval': '__fps()'}, {'heap': scene}]
    return steps


HAS = lambda *k: ' && '.join("G.save.inventory.includes('%s')" % x for x in k)
NO_STALE = "(G.hud.objectiveText || '') !== ''"


def build(first, frm=None):
    rec = RECORDER.replace('(MEASURE)', MEASURE).replace('(FPS)', FPS)
    steps = [{'name': 'the recorder'}, {'until': 'N.perf.steps > 60', 'timeout': 40000},
             {'eval': "(localStorage.removeItem('noir.save'), 'no save')"}, {'eval': rec}, {'heap': 'title'}]

    # ---- the title, BEGIN, the opening stills, I, the way into II: the slice ----
    sl = load('slice')
    k_fight = idx(sl, lambda s: 'fight' in s, 'the slice\'s fight')
    k_diner = idx(sl, lambda s: 'until' in s and "G.scenes.current.id === 'diner'" in s['until'], 'the diner')
    k_end = idx(sl, lambda s: 'until' in s and "G.state === 'end' ||" in s['until'], 'the slice\'s end')
    steps += strip(sl[:k_diner + 1])
    steps += [{'name': '==== chapter 1: diner'}, {'wait': 2500}, {'eval': '__measure()'}, {'eval': '__fps()'}, {'heap': 'diner'}]
    steps += strip(sl[k_diner + 1:k_fight])
    steps += [{'name': '==== chapter 2: fight (a cut: the way in is one move, no card)'}, {'eval': '__measure()'}, {'eval': '__fps()'}, {'heap': 'fight'}]
    steps.append({'drive': 'tools/lib/fight_bot.mjs', 'profile': 'bad' if first else 'good', 'timeout': 900000,
                  'check': 'D.fights.length === 1 && D.fights[0].won', 'label': '[fight] II won by the %s hands' % ('clumsy' if first else 'good')})
    after = strip(sl[k_fight + 1:k_end + 1])
    steps += after
    steps.append({'expect': "G.stills.last && G.stills.last.id === 'ames' && !G.stills.last.skipped", 'label': '[seam II-III] the ames still was shown'})

    # ---- III Room 304 ----
    MARKS['office'] = len(steps)
    steps += chapter(3, 'office', checks=[
        ('the matchbook and Ames\'s card carried', HAS('matchbook', 'amesCard')),
        ('walking, nothing in the hands, no fist fight running', "G.controller.mode === 'walk' && !G.brawl.active"),
        ('its own line, not II\'s', "G.hud.objectiveText === 'Room 304. Ames.'"),
    ], wait_cond="G.scenes.current && G.scenes.current.id === 'office' && document.pointerLockElement === N.renderer.domElement && G.scenes.fadeK < 0.2")
    order = (['door', 'ames', 'lamp', 'search', 'drawer', 'pencil', 'padHalf', 'picture', 'dialHalf', 'corridor', 'pad', 'dial', 'envelope', 'check', 'stills', 'leave'] if first
             else ['door', 'ames', 'lamp', 'search', 'drawer', 'pencil', 'pad', 'picture', 'dial', 'envelope', 'check', 'stills', 'leave'])
    steps.append({'drive': 'tools/lib/c5_office.mjs', 'order': order, 'check': "D.fails.length === 0 && D.end.scene === 'gunfight'", 'label': '[office] the safe opened, the check read, on into IV'})

    # ---- IV The Door (the same room) ----
    MARKS['gunfight'] = len(steps)
    steps += chapter(4, 'gunfight', checks=[
        ('the check carried, PIER 9', HAS('check') + " && G.save.flags.note === 'PIER 9'"),
    ])
    prof = 'clumsy' if first else 'good'
    steps.append({'drive': 'tools/lib/c5_door.mjs', 'profile': prof, 'choice': 'desk', 'out': True, 'flow': True, 'tries': 6 if first else 3, 'beatTimeout': 170,
                  'beats': ['shadows', 'flank', 'corridor'], 'check': 'D.won === 3', 'label': '[gunfight] every movement won (%s)' % prof})
    steps += [
        {'until': "G.scenes.beat === 'quiet' && !G.failing", 'timeout': 20000},
        {'expect': "G.hud.objectiveText === 'See if more are coming.'", 'label': '[gunfight] the quiet, its line'},
        # (from wherever the corridor left me - the cart in the corridor, or the outer office - to the street window)
        # (already in Ames's room within reach of the window - behind the desk - no walk)
        {'walk': "(() => { const e = G.eye; const p = []; if (e.x > 2.2) return [[e.x, e.z]]; if (e.x < -3.9) p.push([-4.6, Math.max(0.6, Math.min(3.0, e.z))], [-4.75, 3.4]); if (e.x < -0.2) p.push([-3.1, 3.4], [-0.8, 3.4]); p.push([1.0, 3.4], [2.4, 4.95], [4.4, 5.15]); return p; })()", 'timeout': 40000, 'stop': False},
        {'eval': '(N.controller.yaw = Math.atan2(-(5.6 - G.eye.x), -(4.15 - G.eye.z)), 1)'},
        {'down': 'KeyW'},
        {'until': "G.scenes.current && G.scenes.current.id === 'watcher'", 'timeout': 8000},
        {'up': 'KeyW'},
    ]

    # ---- V The Watcher (the window's frame is both) ----
    MARKS['watcher'] = len(steps)
    steps += chapter(5, 'watcher', checks=[
        ('no gunfight left running', 'G.ais.size === 0'),
        ('the same room, at the window', "G.stage.name === 'office' && G.scenes.beat === 'seen'"),
    ])
    steps += [
        {'until': "G.scenes.current && G.scenes.current.id === 'watcher' && G.hud.promptShown.includes('fire escape')", 'timeout': 30000},
        {'wait': 1200 if first else 300},
        {'key': 'KeyE'},
        {'until': "N.controller.mode === 'escape'", 'timeout': 10000},
    ]
    if first:
        steps.append({'drive': 'tools/lib/c6_chase.mjs', 'profile': 'bad', 'seed': 9, 'over': 'row', 'stop': "G.scenes.current && G.scenes.current.id === 'tail'", 'timeout': 600000,
                      'check': 'D.done', 'label': '[watcher] the clumsy hands lose him (warned) and get through to the car'})
    else:
        steps.append({'drive': 'tools/lib/c6_chase.mjs', 'profile': 'good', 'over': 'roofs', 'stop': "G.scenes.current && G.scenes.current.id === 'tail'", 'timeout': 300000,
                      'check': 'D.done && D.fails === 0', 'label': '[watcher] through to the car, never lost'})

    # ---- VI The Tail (no fade: straight into the car) ----
    MARKS['tail'] = len(steps)
    steps += chapter(6, 'tail', checks=[
        ('in the driver\'s seat, the hands on the wheel', "G.controller.mode === 'drive' && G.hands.set === 'drive'"),
        ('no black on the way in', 'G.scenes.fadeK < 0.05'),
    ], wait_cond="G.scenes.current && G.scenes.current.id === 'tail' && G.controller.mode === 'drive'")
    steps.append({'eval': "(window.__tailFails = [], window.__c3tries = 0, 'go')"})
    steps.append({'drive': 'tools/lib/c3_tail.mjs', 'profile': 'bad' if first else 'good', 'seed': 11 if first else 7, 'timeout': 900000 if first else 420000,
                  'stop': "G.scenes.current && G.scenes.current.id !== 'tail'", 'check': 'true', 'label': '[tail] played to its end'})
    steps.append({'expect': "G.scenes.current && G.scenes.current.id === 'warehouse'", 'label': '[tail] on into VII'})

    # ---- VII Pier Nine ----
    MARKS['warehouse'] = len(steps)
    steps += chapter(7, 'warehouse', checks=[
        ('sneaking, the hands\' own set', "G.controller.mode === 'sneak' && G.hands.set === 'sneak'"),
        ('the revolver empty after VI', '!G.player.weapons.active || G.player.weapons.active.ammo === 0'),
        ('no car of VI left', '!(G.vehicles.list || []).length'),
    ])
    pier = load('pier_bad' if first else 'pier_ghost')
    a = idx(pier, lambda s: s.get('name', '').startswith('arrive'), 'the pier arrive')
    b = idx(pier, lambda s: 'until' in s and s['until'] == "G.scenes.beat === 'office'", 'the pier office')
    steps += strip(pier[a:b + 1])
    off = load('pier_office')
    o1 = idx(off, lambda s: s.get('expect', '').startswith('W().crew.alarmT < 0 && W().office.length'), 'the office unseen')
    o2 = idx(off, lambda s: s.get('until') == "G.scenes.beat === 'loud'", 'the loud beat')
    off = strip(off[o1 + 1:o2 + 1])
    steps += [{'eval': "(window.W = () => G.scenes.ctx.flags.live, window.FACE = (x, z, p) => { const c = N.controller, want = Math.atan2(-(x - c.pos.x), -(z - c.pos.z)), e = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)), ep = p == null ? 0 : p - c.pitch; document.dispatchEvent(new MouseEvent('mousemove', { movementX: Math.round(-e / c.sensitivity), movementY: Math.round(-ep / c.sensitivity) })); return e; }, 1)"},
              {'until': 'W().office.length === 0', 'timeout': 30000}]
    steps += off
    steps.append({'until': "G.scenes.beat === 'loud' && !G.scenes.trans && G.controller.mode === 'gun'", 'timeout': 15000})
    steps.append({'drive': 'tools/lib/c7_pier.mjs', 'profile': 'loud', 'timeout': 600000 if first else 400000, 'check': 'D.done', 'label': '[warehouse] the loud pass won'})
    fi = load('pier_fight')
    f0 = idx(fi, lambda s: s.get('name', '').startswith('he steps out'), 'the foreman steps out')
    ff = idx(fi, lambda s: 'fight' in s, 'the pier fight')
    # (from the loud pass the revolver is in my hand: his hook takes it on a cut first - his walk out is not the checkpoint's)
    seg = [s for s in fi[f0:ff] if 'fightT - G.scenes.startT' not in s.get('expect', '') and 'W().fm.pos.z' not in s.get('until', '')]
    for s in seg:
        if 'until' in s:
            s['timeout'] = max(s.get('timeout', 0), 30000)
    steps += strip(seg)
    steps.append({'drive': 'tools/lib/fight_bot.mjs', 'profile': 'bad' if first else 'good', 'timeout': 900000,
                  'check': 'D.fights.length === 1 && D.fights[0].won', 'label': '[warehouse] the foreman put down'})
    rest = [s for s in fi[ff + 1:] if 'G.brawl.stats.time > 88' not in s.get('expect', '')]
    steps += strip(rest)

    # ---- VIII The Block ----
    MARKS['shootout'] = len(steps)
    steps += chapter(8, 'shootout', checks=[
        ('the photograph and the shells carried, no revolver in hand', HAS('photo', 'shells')),
        ('no fist fight left running', '!G.brawl.active'),
    ], wait_cond="G.scenes.current && G.scenes.current.id === 'shootout' && G.scenes.beat === 'dot' && !G.scenes.trans && !(G.stills && G.stills.active) && !G.hud._carded")
    steps.append({'expect': "G.stills.last && G.stills.last.id === 'diner'", 'label': '[seam VII-VIII] the diner still was shown'})
    if first:
        steps.append({'drive': 'tools/lib/c8_nick.mjs', 'profile': 'bad', 'tries': 4, 'flow': True, 'check': 'D.won', 'label': '[shootout] the nick of time: through'})
    else:
        steps.append({'drive': 'tools/lib/c8_nick.mjs', 'profile': 'good', 'way': 'window', 'tries': 3, 'flow': True, 'check': 'D.won', 'label': '[shootout] the nick of time, by the window'})
    nk = load('block_nick')
    n0 = idx(nk, lambda s: s.get('until', '').startswith("G.scenes.beat === 'gun'"), 'the gun laid')
    steps += strip([s for s in nk[n0:] if 'Math.hypot(G.b7.gun' not in s.get('expect', '')])
    steps.append({'drive': 'tools/lib/c8_block.mjs', 'profile': 'bad' if first else 'good', 'flow': True, 'beats': ['cars', 'flank', 'el', 'saloon', 'cardinal', 'last'],
                  'tries': 6 if first else 3, 'beatTimeout': 200, 'check': 'D.won === 6', 'label': '[shootout] the street and him'})
    steps += [
        {'name': '==== the end: his hat in the wet street'},
        {'until': "G.scenes.beat === 'end' && !G.scenes.trans && !G.failing", 'timeout': 20000},
        {'wait': 2500},
        {'walk': "(() => { const h = G.b7.hat.rest, e = G.eye, d = Math.hypot(h.x - e.x, h.z - e.z); const k = Math.max(0, (d - 1.6) / d); return [[e.x + (h.x - e.x) * k, e.z + (h.z - e.z) * k]]; })()", 'timeout': 30000, 'stop': False},
        {'until': "G.stills.active && G.stills.run.id === 'end'", 'timeout': 60000},
        {'until': "G.state === 'end' && G.hud.endShown", 'timeout': 20000},
        {'expect': "document.querySelector('#endcard h1').textContent === 'THE END'", 'label': 'THE END'},
        {'eval': '__measure()'},
        {'heap': 'end'},
        {'shot': 'c9_the_end'},
        {'eval': 'JSON.stringify({ marks: __rec.marks, cards: __rec.cards, small: __rec.small, stills: __rec.stills })'},
        {'eval': 'JSON.stringify({ taught: __rec.taught })'},
        {'eval': 'JSON.stringify({ cues: __rec.cues })'},
        {'eval': 'JSON.stringify({ fails: __rec.fails, hitch: __rec.hitch.length, hitches: __rec.hitch.slice(0, 30) })'},
        {'eval': 'JSON.stringify({ beats: __rec.beats.map((b) => b[1] + "." + b[2] + "@" + b[0]) })'},
        {'eval': 'JSON.stringify(window.__heap)'},
        {'expect': "__rec.stills.map((s) => s[1]).join(' ') === 'opening ames check photo diner end'", 'label': 'every still once, in order, none skipped'},
        {'expect': "['diner', 'fight', 'office', 'gunfight', 'watcher', 'tail', 'warehouse', 'shootout'].every((id) => !!__rec.marks[id])", 'label': 'all eight chapters entered'},
        {'name': '==== after THE END: the title, BEGIN again'},
        {'wait': 1500},
        {'clickOn': '#endcard'},
        {'until': "G.state === 'title' && !document.getElementById('title').classList.contains('hidden')", 'timeout': 10000},
        {'wait': 2000},
        {'eval': "({ canContinue: !document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden'), music: G.music.current, layers: document.querySelectorAll('#hud .layer').length })"},
        {'clickOn': '#title .opt[data-k=begin]', 'taken': "G.state !== 'title'", 'retries': 5, 'every': 4000},
        {'until': 'G.stills.active', 'timeout': 8000},
        {'key': 'Escape'}, {'wait': 300}, {'key': 'Escape'},
        {'until': "G.scenes.current && G.scenes.current.id === 'diner' && !G.scenes.trans && !G.stills.active", 'timeout': 30000},
        {'wait': 2000},
        {'shot': 'c10_second_evening'},
        {'eval': '__measure()'},
        {'heap': 'second_evening'},
        {'expect': "G.stage.hoods.list.length === 0 && G.save.inventory.length === 0 && G.controller.mode === 'seated'", 'label': 'a second evening: no gunman left, empty pockets, on the stool'},
        {'expect': "G.hud.objectiveText === 'Light up.'", 'label': 'a second evening: the first line again'},
    ]
    name = 'whole_first' if first else 'whole'
    url = '/?mute=1'
    if frm:
        # (from a chapter on: BEGIN at ?start=<chapter>, the recorder, then the steps from its start)
        steps = steps[:5] + [{'until': "G.state === 'title' && !document.getElementById('title').classList.contains('hidden')", 'timeout': 30000}, {'wait': 1500},
                             {'clickOn': '#title .opt[data-k=begin]', 'taken': "G.state !== 'title'", 'retries': 5, 'every': 4000}] + steps[MARKS[frm]:]
        name += '_from_' + frm
        url = '/?mute=1&start=' + frm
    play = {
        'about': '[C10b] The whole game in one page session by real input, the %s hands: BEGIN, the opening stills, I to VIII, THE END, the title and BEGIN again. '
                 'Built by tools/lib/whole.py from the lanes\' plays and drivers (the gun drivers with flow: true - each beat comes by the story, a retry by the game\'s own fail). '
                 'NOIR_PORT=5350 node tools/play.mjs tools/plays/%s.json' % ('clumsy (each lane\'s first-timer)' if first else 'good (each lane\'s taught player)', name),
        'url': url,
        'size': [1280, 800],
        'out': 'shots/play/' + name,
        'steps': steps,
    }
    with open(os.path.join(PLAYS, name + '.json'), 'w') as f:
        json.dump(play, f, indent=1)
    print('%s.json: %d steps' % (name, len(steps)))


if __name__ == '__main__':
    import sys
    if '--from' in sys.argv:
        ch = sys.argv[sys.argv.index('--from') + 1]
        build('--first' in sys.argv, ch)      # writes whole[_first]_from_<chapter>.json (scratch: not committed)
    else:
        build(False)
        build(True)
