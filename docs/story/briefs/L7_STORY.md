# Lane 7 — story and systems

Branch `wave-a/L7-story`, port 5187. You own `src/main.js`, `src/game/**`,
`src/scenes/**`, `src/ui/**`, `src/audio/**`, and you may add
`tools/play.mjs` and `tools/plays/*.json`. You turn a shooter into a story
that plays: scenes 1 and 2, the systems under them, the sound of the room,
and the means to play the whole thing without a human.

You stage other lanes' work. Their real art arrives at the merge; until
then you direct stand-ins. Drive everything through the contract APIs and
the clips' marks, never through a stub's insides, so that when the real
hands, people, room and breakage replace the stubs your scenes simply look
better.

## P0.1  Systems (CONTRACTS §3, §4, §5, §12)
Finish what the foundation stubbed: `SceneManager` (coroutines, beats,
transitions, the shot mode, checkpoints), `Interact` (one prompt, generous
cones), `Inspect`, `Director` (kept working for the old presets), `Save`,
`Music` (slots; silent when no file), and the HUD:
- prompts: `E  light up`, low centre, typewriter face, a brush tick at the
  thing;
- subtitles: one line, 42 characters at most, bottom centre, 2.2 s,
  white on a torn black brush stroke;
- chapter card: a roman numeral and a name (`I` / `The Diner`), 2.4 s, the
  title card's lettering;
- the title: NOIR EXTREME over the live picture of the diner from across
  the street in the rain (camera drifting slowly from (2.5, 1.6, 9.5)
  toward (1.5, 1.6, 7.5), looking at the door), **begin** and, when a save
  exists, **continue**;
- pause; the end-of-slice card (`To be continued`);
- health as today, shown only in a fight; the ammo counter only while a
  gun is out; no wave or kill counters anywhere.

## P0.2  Scene 1, the diner (STORY.md)
Stage `block`. The player in `seated` mode on `diner.stool.player`, set
`smoke`. Cast: Dot behind the counter at the urns; the cook in the hatch;
the brawler on stool 6; the old man on stool 9; the couple in booth 2;
the docker on stool 1. Music `jukebox_a` from the jukebox.

The script, beat by beat. Nothing forces the player's pace: every beat
waits for its key, and the room lives while it waits.
1. `settle`. Fade in over 2.5 s; the chapter card `I  The Diner`.
   After 4 s the prompt **E light up**: `hands.play('lightUp')`; on its
   marks: the lighter's sound, the flame, the ember. Afterwards **F**
   drags (`drag`), and LMB taps ash, for the rest of the scene.
2. `order`. 6 s after the cigarette is lit (or at once if E is pressed
   again) Dot walks down to `counter.serve.4`, leans. Prompt **E scotch**.
   Subtitle: `Scotch. Neat.` She sets a tumbler down (`serve`), `pour`:
   on `streamOn` start `fx.pour` from the bottle to the glass and raise the
   glass's fill to 1 over the stream's time, on `streamOff` stop it; she
   corks the bottle, `slide`s the glass: on `release` the glass travels
   0.5 m and stops at my left hand.
3. `drink`. Prompt **E drink**: `reachGlass`, `sip`, `putDown`; three
   sips empty it. Between sips I can smoke.
4. `room`, running under all of it (seeded, so a preset shows it):
   - 10 s: the cook rings the bell; Dot carries a plate to the old man;
   - 22 s: the docker goes to the jukebox, a coin, `jukebox.next()`,
     music `jukebox_b`;
   - 38 s: the el train passes: `d.trainPass(7)`, its rumble through the
     wall, the cups; rings in my glass;
   - 55 s: lightning: the windows go white for two frames
     (`pipeline.pulseLightning`), `d.lampsDip(0.5, 0.6)`, thunder 1.6 s
     later, muffled;
   - Dot tops up the old man's coffee; the couple lean together; the
     brawler eats, drinks, looks at nothing;
   - **Q** nudges the empty stool on my left: it spins and slows.
5. `pay`. When the glass is empty the prompt **E pay**: `payWallet`; on
   `shown` the brawler's `notice` starts; he holds the look 1.2 s. His
   line, subtitle: `You're the one asking about the Cardinal.` He `rise`s;
   on `stool` his stool goes over (`d.stool(6).topple`). The music stops
   with a scratch if he bumps the counter; otherwise it plays on under the
   fight. Go to scene 2 with no fade: the camera rises from the stool and
   turns to face him (`cutscene`, 1.2 s) into `brawl`.

## P0.3  Scene 2, the fist fight
`src/game/Brawl.js`: a rules engine over clips and marks (CONTRACTS §14).
- **Input**: LMB `jab` (alternating hands; a second jab can be buffered);
  RMB held `heavyWind`, released `heavyHit` (damage scales with the hold,
  0.25 to 0.7 s); SPACE `block` (held); A / D `slipL` / `slipR`; E `grab`
  when something is in reach, then LMB swings it.
- **Resolution by timing**, no physics: at an attack's `contact` mark the
  rules look at what the defender is doing. My jab lands if he is not
  guarding high or is in `br_stun`; a jab into his guard is blocked (a
  dull thud, no damage, he may counter). His `br_hook` lands unless I am
  inside the `safe` window of a slip **away from the hooking hand**, or
  blocking (then I take chip damage 3). His `br_haymaker` is only slipped;
  blocking it breaks my guard (a 0.6 s stagger). A slipped attack leaves
  him open: 0.9 s in which my hits count double and a heavy hit stuns him.
- **Numbers to start from**: he has 100; my jab 3, heavy 9 to 16, bottle
  22, plate 12, stool 30. I have 100; his jab 6, hook 12, haymaker 22,
  bottle 18. Tune so a first-time player wins in 90 to 150 s with a
  third of his health left.
- **Rounds** (they flow, no bell): round one to 66 (jab, hook; slow; the
  HUD teaches once: `SPACE block`, `A D slip` at his first hook, `hold RMB`
  after my third jab); round two to 33 (adds `br_bottle` and mixes; Dot's
  `slideBottle` puts a bottle in reach at the start of the round; plates
  and a stool are in reach when I stand by them); round three to 0 (adds
  `br_haymaker`, faster, wilder, he bleeds).
- **The room takes part.** The ring moves with us along the aisle. A heavy
  hit that lands while his back is within 1.2 m of the stools, the
  jukebox or the pie case throws him into it (`br_into_*`; on `impact`:
  `breakables.topple` the stools, `jukebox.hit`, `glass.shatter` the pie
  case). At most one of each per round.
- **Hit feel**: on a landed heavy hit freeze the simulation 3 frames (hit
  stop), `controller.shake`, `fx.hit.punch`, a thud with a low body; on a
  jab 1 frame. Slow everything to 0.35 x for the 0.8 s of the last blow.
- **The end**: at 0 my next heavy hit is the last: `br_ko_window`; on
  `glass` call `glass.shatter(pane B4, { dir: +x })`: the sound of the
  street and the rain comes in (the room's ambience opens from `diner` to
  half `street`). The mode returns to `walk`.
- **Losing**: at 0 health, `hurt`, the frame goes black with a thud;
  after 1.5 s I am on my feet at the start of the round with 60 health.
  No fail screen.
- **After**: the door. Outside, the brawler on his back in the glass on
  the pavement. Prompt **E search** (`searchBody`), then `showMatchbook`
  through `inspect.open({ prop: 'matchbook' })`: the red matchbook, THE
  CARDINAL. When it is pocketed: two gunshots far down the pavement to
  the north (z about -27), the second 0.7 s after the first; the view is
  free; 2 s later the card `To be continued`. The slice ends.
- Beats for the shot mode: `round1`, `round2`, `round3`, `ko`, `outside`,
  `matchbook`.

## P0.4  Sound (all procedural; no music is composed)
Add to `Sfx.js` and to the `audioTest` table:
- **The room** (`sfx.room('diner')`): rain on plate glass (soft, close,
  no low end), a room tone, the refrigerator's hum with a slow beat, the
  fans, cutlery on china now and then, a murmur of two voices as
  filtered noise without words, the urns' hiss. The street's rain, thunder
  and the train are heard through the wall: low-passed at 600 Hz, 12 dB
  down. Through the broken window and the open door they come in full.
- **Objects**: the lighter's lid, wheel and flame; the drag's faint
  crackle; a glass set on the counter; the cork; the pour (a glug that
  rises in pitch as the glass fills); a sip; the bell in the hatch; the
  door's bell; the jukebox's coin, mechanism, needle drop, needle hiss,
  skip; a stool's swivel squeak; the register; a newspaper page; the
  wallet's leather.
- **The fight**: a jab (a short slap with a knock under it), a heavy
  punch (a deep thud, a grunt from him), a blocked blow (dull, on the
  forearms), a whiff of air for a miss, my own grunt when hit; footwork
  on linoleum; `break_bottle`, `break_plate`, `break_cup`,
  `break_stool`, `break_table`, `break_glass_big` (the plate-glass
  window: a crack like a shot, then a long fall of glass on stone), a
  body into the stools, a body on the pavement.
- **Music slots**: `music.cue('jukebox_a', { diegetic: { pos:
  jukebox, room: 'diner' } })` and so on. With no file the jukebox plays
  its needle hiss only. `docs/story/MUSIC.md`: a table of every slot,
  where it plays, how long the scene runs, what mood it wants, the file
  name to drop into `public/music/`.

## P0.5  The game plays itself
- `?autoplay=1`: a driver that plays what a player would: it waits a
  human moment at each prompt and presses the key, smokes now and then,
  fights (blocks the jab, slips the hook, punishes), walks out, searches.
  Each scene exports `auto(ctx)` beside its script.
- `tools/play.mjs <play.json>`: drives the real page through the DevTools
  protocol with trusted input events (as `tools/playtest.mjs` does): a
  play is a list of steps (`wait`, `key`, `mouse`, `look`, `until`
  (an expression over `window.__noir`), `shot` (a screenshot to a named
  file), `expect` (an expression that must be true)). Deliver
  `tools/plays/slice.json`: the title, begin, the whole of scenes 1 and 2
  by real input, a screenshot at every beat, and expectations (the
  cigarette is lit; the glass is empty; the fight started; it ended; the
  matchbook was shown; no errors in `#errlog`).
- Counters for the headless tools (`#counters`): scene, beat, the fight's
  state (both healths, round, hits landed and taken, throws), the play
  time.

## P1
Save and continue across a reload of the page; the pause card over any
scene; a settings line on the pause card (mouse sensitivity, volume);
subtitles can be turned off.

## Presets you must deliver
`scene=diner&beat=settle|order|drink|pay` and
`scene=fight&beat=round1|round2|round3|ko|outside|matchbook`, each at a
`t` that shows its moment (list the best `t` for each), plus `title`.

## Intended golden changes
`title` and `end` (the new cards). Everything else identical.
