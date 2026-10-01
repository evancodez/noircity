#!/usr/bin/env python3
"""[R3] The whole game in one page session: tools/plays/whole.json, built from
the lanes' own plays (the title and BEGIN, then every chapter by real input
to THE END). A lane's play changes: run this again.

  python3 tools/lib/whole.py            writes tools/plays/whole.json
  NOIR_PORT=5331 node tools/play.mjs tools/plays/whole.json

Each chapter is its lane's play from the step that waits for the chapter
(its title and BEGIN dropped), its screenshots dropped (the seams' own are
taken instead: the chapter card, the first frame after the fade). At each
chapter's start the page is measured (garbage collected heap, draw calls,
programs, lights, listeners, the frame rate over two seconds) and what the
chapter finds is checked against what the last one left (the hands, the
controller's mode, the HUD's layers and prompts, the music, the inventory).
A recorder in the page keeps the chapter cards, the music cues, the beats
and every save written (window.__rec, printed at the end).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLAYS = os.path.join(ROOT, 'tools', 'plays')


def load(name):
    return json.load(open(os.path.join(PLAYS, name + '.json')))['steps']


def strip_shots(steps):
    out = []
    for s in steps:
        if 'shot' in s:
            continue
        s = json.loads(json.dumps(s))
        for k in ('fight', 'shoot'):
            if k in s and isinstance(s[k], dict):
                s[k]['shots'] = {}
        if 'drive' in s and isinstance(s['drive'], dict):
            s['drive']['shots'] = {}
        out.append(s)
    return out


def from_entry(name, scene):
    steps = load(name)
    for i, s in enumerate(steps):
        if 'until' in s and "id === '%s'" % scene in s['until']:
            return steps[i:]
    raise SystemExit('no entry step for ' + scene + ' in ' + name)


# the page's recorder: the cards, the fades, the cues, the beats, the saves
RECORDER = r"""(() => {
  const R = window.__rec = { cards: [], go: [], cues: [], beats: [], saves: [], marks: {} };
  const S = G.scenes, now = () => +N.time.toFixed(2), at = () => [now(), S.current ? S.current.id : null, S.beat];
  const card = G.hud.card.bind(G.hud);
  G.hud.card = (n, name, secs) => { R.cards.push([now(), n, name]); return card(n, name, secs); };
  const go = S.go.bind(S);
  S.go = (id, o = {}) => { R.go.push([now(), S.current ? S.current.id : null, id, o.fade || 'black', !!o.keep, o.card]); return go(id, o); };
  G.on('music:cue', (e) => R.cues.push([...at(), 'cue', e.slot]));
  const stop = G.music.stop.bind(G.music);
  G.music.stop = (f) => { if (G.music.current) R.cues.push([...at(), 'stop', G.music.current]); return stop(f); };
  G.on('scene:beat', (e) => R.beats.push([now(), +(S.playTime || 0).toFixed(1), e.id, e.beat]));
  G.on('scene:enter', (e) => { R.marks[e.id] = { t: now(), play: +(S.playTime || 0).toFixed(1), real: Date.now() }; });
  const write = G.save.write.bind(G.save);
  G.save.write = () => { const d = write(); if (d) R.saves.push(JSON.parse(JSON.stringify(d))); return d; };
  // a line or a prompt printed while the chapter card is up; the black held
  // (fadeK 1) and how long; a frame longer than 120 ms (a hitch), where
  R.over = []; R.black = []; R.hitch = []; R.glass = [];
  const gl = G.sfx.glass.bind(G.sfx);
  G.sfx.glass = (...a) => { R.glass.push(at()); return gl(...a); };
  let lastOver = '', blackT = 0;
  G.scripts.push((t, dt) => {
    // (a prompt kept out of sight under the card - #hud.carded - is not printed over it)
    const up = G.hud.cardT > 0, hid = G.hud.root.classList.contains('carded');
    const txt = (G.hud.sayShown ? 'say:' + G.hud.sayShown : '') + (G.hud.promptShown && !hid ? ' prompt:' + G.hud.promptShown : '');
    if (up && txt && txt !== lastOver) R.over.push([...at(), +G.hud.cardT.toFixed(2), txt]);
    lastOver = up ? txt : '';
    if (S.fadeK > 0.99) blackT += dt; else if (blackT > 0) { R.black.push([...at(), +blackT.toFixed(2)]); blackT = 0; }
  });
  let lastF = performance.now();
  const hf = (n) => { const d = n - lastF; lastF = n; if (d > 120 && G.state === 'playing') R.hitch.push([...at(), Math.round(d), +G.scenes.fadeK.toFixed(2)]); requestAnimationFrame(hf); };
  requestAnimationFrame(hf);
  window.__measure = () => (MEASURE);
  window.__fps = () => (FPS);
  return 'recording';
})()"""

# the page at a chapter's start (one read; no frame waited for)
MEASURE = r"""(() => {
  const I = N.renderer.info, S = G.stage;
  let objs = 0, meshes = 0, lights = 0, lit = 0, shadow = 0;
  S.scene.traverse((o) => { objs++; if (o.isMesh) meshes++; if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight) { lights++; if (o.visible && o.intensity > 0) { lit++; if (o.castShadow) shadow++; } } });
  const ev = G._events ? [...G._events.entries()].filter(([, v]) => v.length).map(([k, v]) => k + ':' + v.length).join(' ') : '';
  const nev = G._events ? [...G._events.values()].reduce((a, v) => a + v.length, 0) : 0;
  return { ch: S && G.scenes.current && G.scenes.current.id, beat: G.scenes.beat, t: +N.time.toFixed(1), play: +(G.scenes.playTime || 0).toFixed(1),
    stage: S.name, built: [...N.stages.built.keys()].join(','), calls: I.render.calls, tris: I.render.triangles, programs: I.programs ? I.programs.length : null,
    geos: I.memory.geometries, tex: I.memory.textures, objs, meshes, lights, lit, shadow, listeners: nev, ev,
    hooks: G.scenes.hooks.length, scripts: G.scripts.length, ais: G.ais.size, hoods: S.hoods.list.length, cast: S.cast.list.length,
    pending: G.pending.length, corpses: G.corpses.length, director: !!G.director.active, brawl: !!G.brawl.active,
    layers: [...document.querySelectorAll('#hud .layer')].map((l) => l.dataset.layer).join(','),
    mode: G.controller.mode, frozen: !!G.controller.frozen, hands: G.hands.set, held: [G.hands.held && G.hands.held.L ? G.hands.held.L.userData.kind : null, G.hands.held && G.hands.held.R ? G.hands.held.R.userData.kind : null],
    weapon: G.player.weapons.current, inv: G.save.inventory.join(','), flags: JSON.stringify(G.save.flags), music: G.music.current,
    prompt: G.hud.promptShown, say: G.hud.sayShown, fov: +N.camera.fov.toFixed(1), hp: G.health.hp, interact: G.interact.list ? G.interact.list.length : null,
    fade: +G.scenes.fadeK.toFixed(2), timeScale: G.timeScale, room: G._room, loops: N.sfx.loops ? [...N.sfx.loops.keys()].join(',') : null, live: !!N.sfx.live };
})()"""

# the frame rate over two seconds of play (requestAnimationFrame)
FPS = r"""(async () => { const ts = [], cs = []; let last = performance.now(); const t0 = last;
  await new Promise((res) => { const f = (n) => { ts.push(n - last); cs.push(N.renderer.info.render.calls); last = n; if (n - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  ts.shift(); const a = ts.reduce((x, y) => x + y, 0) / ts.length; ts.sort((x, y) => x - y);
  return { fps: +(1000 / a).toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), calls: Math.round(cs.reduce((x, y) => x + y, 0) / cs.length), callsMax: Math.max(...cs) }; })()"""


def chapter(n, scene, checks=(), fps=True, heap=True):
    """the steps at a chapter's start: its card, its first frame, the measure"""
    steps = [
        {'name': '==== chapter %s: %s' % (n, scene)},
        {'until': "G.scenes.current && G.scenes.current.id === '%s'" % scene, 'timeout': 30000},
        {'wait': 900},
        {'shot': 'c%02d_%s_card' % (n, scene)},
        {'until': '!G.scenes.trans', 'timeout': 10000},
    ]
    for label, expr in checks:
        steps.append({'expect': expr, 'label': '[%s] %s' % (scene, label)})
    steps.append({'eval': '__measure()'})
    if fps:
        steps.append({'eval': '__fps()'})
    if heap:
        steps.append({'heap': scene})
    steps.append({'shot': 'c%02d_%s_first' % (n, scene)})
    return steps


def build():
    rec = RECORDER.replace('(MEASURE)', MEASURE).replace('(FPS)', FPS)
    steps = [{'name': 'the recorder'}, {'until': 'N.perf.steps > 60', 'timeout': 40000}, {'eval': rec},
             {'eval': "(localStorage.removeItem('noir.save'), 'no save')"}, {'heap': 'title'}]
    # ---- I and II: the slice (the title, BEGIN, the diner, the fight) ----
    slice_ = load('slice')
    cut = next(i for i, s in enumerate(slice_) if 'until' in s and "G.state === 'end' ||" in s['until'])
    sl = strip_shots(slice_[:cut + 1])
    # (the fight's chapter: measured under the lesson's first card, which waits for me)
    k = next(i for i, s in enumerate(sl) if 'fight' in s and isinstance(s['fight'], dict))
    fight_in = [{'name': '==== chapter 2: fight (entered by a cut, under the lesson)'},
                {'eval': '__measure()'}, {'eval': '__fps()'}, {'heap': 'fight'}, {'shot': 'c02_fight_lesson'}]
    d = next(i for i, s in enumerate(sl) if 'until' in s and "G.scenes.current.id === 'diner'" in s['until'])
    diner_in = [{'name': '==== chapter 1: diner'}, {'wait': 2500}, {'eval': '__measure()'}, {'eval': '__fps()'}, {'eval': "(async () => ({ benchFrameMs: (await N.bench({ frames: 30, k: 1 })).frame, size: N.pipeline.width + 'x' + N.pipeline.height }))()"}, {'heap': 'diner'}]
    steps += sl[:d + 1] + diner_in + sl[d + 1:k] + fight_in + sl[k:]
    # ---- III the body ----
    steps += chapter(3, 'body', checks=[
        ('the hands empty, walking', "G.hands.set === 'empty' && G.controller.mode === 'walk' && !G.brawl.active"),
        ('the matchbook in my pocket', "G.save.inventory.includes('matchbook')"),
        ('no fight card left on screen', "[...document.querySelectorAll('#fightcards .fc, #fightcards .fl')].every((e) => getComputedStyle(e).display === 'none' || +getComputedStyle(e).opacity < 0.05)"),
    ])
    steps += strip_shots(from_entry('body', 'body'))
    # ---- IV room 304 ----
    steps += chapter(4, 'office', checks=[
        ('the matchbook, the torn half, the note', "['matchbook', 'matchbookHalf', 'note'].every((k) => G.save.inventory.includes(k))"),
        ('walking, nothing in the hands', "G.controller.mode === 'walk' && !G.hands.held.L && !G.hands.held.R"),
        ('the camera lens back to the walk', 'Math.abs(N.camera.fov - 68) < 0.5'),
    ])
    steps += strip_shots(from_entry('office', 'office'))
    # ---- V the door (a cut in the same room) ----
    steps += chapter(5, 'gunfight', fps=False, checks=[
        ('the ledger in my coat', "G.save.inventory.includes('ledger')"),
    ])
    steps += strip_shots(from_entry('gunfight', 'gunfight'))
    # ---- VI the watcher ----
    steps += chapter(6, 'watcher', checks=[
        ('no fight running', '!G.director.active && G.ais.size === 0'),
        ('the revolver put away', "G.player.weapons.current == null"),
    ])
    steps += strip_shots(from_entry('watcher', 'watcher'))
    # ---- VII the tail ----
    steps += chapter(7, 'tail', checks=[
        ('in the driver\'s seat', "G.controller.mode === 'drive' && G.hands.set === 'drive'"),
    ])
    steps += strip_shots(from_entry('tail', 'tail'))
    # ---- VIII pier nine (the stealth and the second fist fight) ----
    wh = from_entry('warehouse', 'warehouse')
    # (the lane's pause-card trick for its first look is a cold start's: dropped)
    j = next(i for i, s in enumerate(wh) if s.get('until') == '!G.scenes.trans')
    wh = wh[:1] + wh[j:]
    steps += chapter(8, 'warehouse', checks=[
        ('sneaking, the hands\' own set', "G.controller.mode === 'sneak' && G.hands.set === 'sneak'"),
        ('the lens back to the walk', 'Math.abs(N.camera.fov - 68) < 0.5'),
    ])
    steps += strip_shots(wh)
    # ---- IX the block ----
    steps += chapter(9, 'shootout', checks=[
        ('the window Mack went through still out', "(() => { const w = G.save.flags.window || 'B4'; return G.stage.part('dinerFront').panes[w].state === 'gone'; })()"),
        ('no fist fight left running', '!G.brawl.active'),
        ('no glass broke as the chapter came in (the window was out already)', "!__rec.glass.some((g) => g[1] === 'shootout' && g[0] - __rec.marks.shootout.t < 1.5)"),
    ])
    sh = strip_shots(from_entry('shootout', 'shootout'))
    steps += sh
    # ---- THE END ----
    steps += [
        {'name': '==== THE END'},
        {'eval': '__measure()'},
        {'heap': 'end'},
        {'shot': 'c10_the_end'},
        {'eval': 'JSON.stringify({ marks: __rec.marks, cards: __rec.cards, go: __rec.go, cues: __rec.cues })'},
        {'eval': 'JSON.stringify({ over: __rec.over, black: __rec.black, hitch: __rec.hitch, glass: __rec.glass.length })'},
        {'eval': 'JSON.stringify(__rec.beats)'},
        {'eval': 'JSON.stringify(__rec.saves)'},
        {'eval': 'JSON.stringify(window.__heap)'},
        {'expect': "__rec.cards.map((c) => c[0] != null && c[1]).join(' ') === 'I III IV V VI VII VIII IX'", 'label': 'every chapter card, in order, once (II is a cut: the way in is one move, no card)'},
        # ---- after THE END: the card's click, the title, and a second evening ----
        {'name': '==== after THE END: the title, BEGIN again'},
        {'wait': 1500},
        {'clickOn': '#endcard'},
        {'until': "G.state === 'title' && !document.getElementById('title').classList.contains('hidden')", 'timeout': 10000},
        {'wait': 2500},
        {'shot': 'c11_title_after'},
        {'eval': "({ canContinue: !document.querySelector('#title .opt[data-k=continue]').classList.contains('hidden'), hoods: G.stage.hoods.list.length, fires: G.stage.cars.fires.length, music: G.music.current, layers: document.querySelectorAll('#hud .layer').length, cars: G.stage.cars.cars.map((c) => (c.id ?? '?') + '@' + c.pos.x.toFixed(1) + ',' + c.pos.z.toFixed(1) + ':' + c.state), decals: G.fx.decals.total })"},
        {'clickOn': '#title .opt[data-k=begin]', 'taken': "G.state !== 'title'", 'retries': 5, 'every': 4000},
        {'until': "G.scenes.current && G.scenes.current.id === 'diner' && !G.scenes.trans", 'timeout': 30000},
        {'wait': 2000},
        {'shot': 'c12_second_evening'},
        {'eval': '__measure()'},
        {'eval': "(async () => ({ benchFrameMs: (await N.bench({ frames: 30, k: 1 })).frame, size: N.pipeline.width + 'x' + N.pipeline.height }))()"},
        {'heap': 'second_evening'},
        {'expect': "G.stage.hoods.list.length === 0 && G.corpses.length === 0 && G.stage.cars.fires.length === 0 && !N.sfx.loops.has('fire0')", 'label': 'a second evening: no gunman, body or burning car left on the block, no fire roaring'},
        {'expect': "G.fx.decals.total === 0", 'label': 'a second evening: the last night\'s blood and bullet holes gone from the block'},
        {'expect': "Object.values(G.stage.part('dinerFront').panes).every((p) => p.state !== 'gone') && G.save.inventory.length === 0 && G.music.current === 'jukebox_a'", 'label': 'a second evening: the glass whole, empty pockets, the first record'},
        {'expect': "G.controller.mode === 'seated' && G.hands.set === 'smoke' && G.player.weapons.current !== 'tommy' || G.hands.set === 'smoke'", 'label': 'a second evening: on the stool, the smoke set'},
    ]
    play = {
        'about': '[R3] The whole game in one page session, by real input: the title, BEGIN, the nine chapters '
                 '(each its lane\'s own play), THE END. Built by tools/lib/whole.py from the lanes\' plays. '
                 'NOIR_PORT=5331 node tools/play.mjs tools/plays/whole.json',
        'url': '/?mute=1',
        'size': [1280, 800],
        'out': 'shots/play/whole',
        'steps': steps,
    }
    with open(os.path.join(PLAYS, 'whole.json'), 'w') as f:
        json.dump(play, f, indent=1)
    print('whole.json: %d steps' % len(steps))


if __name__ == '__main__':
    build()
