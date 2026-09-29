# Wave A lane report: L7-story
- branch: `wave-a/L7-story`
- last commit: `9ed8b99`
- worktree: `/Users/evansmac/Downloads/eprojects/noirextreme/.claude/worktrees/wf_1ce98cce-975-7`

## Items

### P0.1 Systems + HUD (done)

SceneManager: fadeIn option (scene 1 fades in over 2.5 s), keep:true (a cut from one scene into the next with no setup and the cast kept), scenes.stop(), playTime, and a guard so a scene switch in the middle of a step hands the rest of the step to the new scene. ctx.prompt takes `at` as a Vector3, an Object3D or a function. The Brawl engine is game.brawl. Game gains a virtual input (game.vin, game.held()), hitStop, slowmo/timeScale, start(save), toTitle(), endSlice(). HUD (src/ui/Hud.js, and new src/ui/inkArt.js for the canvas ink): prompt 'E  light up' low in the frame in the typewriter face, the key letter on a frayed ink dab, a paper-white brush tick at the thing; one-line subtitle, 2.2 s of game time, on a seeded torn black brush stroke; chapter card (Bodoni numeral, a torn rule, Baskerville name) faded in and out on game time. Title: NOIR EXTREME over the live diner from across the street (camera drifts from (2.5,1.6,9.5) to (1.5,1.6,7.5) and back over 70 s, looking at the door), with BEGIN and, when a save exists, CONTINUE, both on torn strokes low over the wet street. Pause card has a settings line (mouse, volume, subtitles on/off; kept in localStorage). End cards have no counters: THE END with its epitaph, and 'To be continued' (the slice end, which clicks back to the title). The crosshair and ammo show only with a gun out, health only in a fight. X (stand up / sit down) is removed.

Presets:
- `shot=title`
- `shot=end`
- `scene=diner&beat=settle&t=1&hud=1&card=chapter`
- `scene=diner&beat=order&t=1&hud=1&card=pause`
- `scene=fight&beat=outside&t=3&hud=1&card=cont`
- `scene=diner&beat=order&t=1&hud=1&say=Scotch.%20Neat.`

Builder's own critique: The red splatter on the title card now sits over the DINER blade sign, so the sign is half covered. The splat is the golden's own art and I did not move it. The chapter numeral is quite small and thin over the lit room once the fade clears. The subtitle stroke frays well on light ground but on dark ground it reads as a plain black bar. The title's key line sits on busy reflections even with the bottom gradient added.

### P0.2 Scene 1, the diner (done)

src/scenes/01_diner.js and _diner_room.js. Cast placed per the brief; jukebox_a plays from the jukebox. settle: after 4 s, E lights up. The lightUp marks drive the pack tap, the cigarette to the lips, the lighter taken from the counter (lid, wheel, flame sound), the tip lit (ember via setTip) and the lighter put back. From then on F drags (the exhale goes to fx.cig) and LMB taps the ash, and a wisp rises every 0.32 s. order: 6 s after the light, or at once on E, Dot comes down (as a job in her queue, so the room's errands wait behind it). E scotch, subtitle 'Scotch. Neat.', tumbler set down on the serve clip's down mark, bottle off the back bar, uncork, fx.pour between streamOn and streamOff with the fill following the clip time, the pour sound, the bottle back, then the slide: on release the glass travels 0.5 m to my left hand. drink: three E presses, each reachGlass, sip (fill drops across tilt..drink), putDown. room clock (seeded, from scene start): 10 s bell and Dot takes a plate to the old man; 22 s the docker walks to the jukebox (coin, mechanism, jukebox.next, needle drop) and back; 30 s and 64 s Dot tops up the old man's coffee; 38 s el train (director.cue plus d.trainPass plus trainWall sound; any ambient train also triggers trainPass); 55 s pulseLightning and lampsDip, thunder at 56.6 s through the wall; page turns, the couple change states, Mack eats and drinks; cutlery sounds; Q spins stool 3. pay: payWallet (wallet sound, register on bill); Mack's notice starts on shown and holds the look 1.2 s; his line; rise, and on its stool mark the stool topples (50% seeded: he bumps the counter, the needle scratches, the music stops). Mack walks into the aisle while a 1.2 s cutscene camera rises and turns to him, then a cut into the fight with keep:true.

Presets:
- `shot=diner_settle  (= scene=diner&beat=settle&t=4.5)`
- `shot=diner_light  (= scene=diner&beat=settle&press=KeyE@4.2&t=6.4)`
- `shot=diner_order  (= scene=diner&beat=order&t=1)`
- `shot=diner_pour  (= scene=diner&beat=order&press=KeyE@0.3&t=5.6)`
- `shot=diner_drink  (= scene=diner&beat=drink&press=KeyE@0.3&t=1.9)`
- `shot=diner_pay  (= scene=diner&beat=pay&press=KeyE@0.3&t=4.6)`
- `shot=diner_rise  (= scene=diner&beat=pay&press=KeyE@0.3&t=8.3)`
- `add &hud=1 for prompts and subtitles`

Builder's own critique: Until lanes 1, 2 and 5 merge, the frames are the stub room: rain texture on the interior walls, a flat white counter slab, no hands, and no visible amber stream (the stub fx.pour is a few debris flecks; the tumbler prints grey). On the stool the eye is only 0.4 m above the counter, so every seated frame is half counter-top; I turned each beat a little along the counter (settle toward Dot's end, pay toward Mack) to get depth, and the counter edge now runs as a strong diagonal that may read as a tilted camera. The diner_light frame shows only the stand-in cigarette and lighter at the fixed palm points, with no flame. Dot's errands can delay her arrival for the order by up to about 15 s if the player lights up just before 10 s. The cutscene rise ignores the stool and counter colliders (a pure eased track).

### P0.3 Scene 2 + Brawl.js (done)

src/game/Brawl.js is a rules engine that reads every timing from clip marks (hands.clip / c.clip). Input: LMB jab alternating hands with one buffered; RMB wind then heavy (damage scales from the charged mark to the clip end); SPACE block while held; A/D slips (controller.slip follows the slip curve); E grabs what is in reach; LMB swings it. Resolution at contact marks, following CONTRACTS §14 and the brief: his guard is high except when he is open, stunned, reacting, reeling or recovering after contact, or has his hands down. A jab into the guard is a thud and may be countered. Three jabs in a row and he covers up. Hook: slip right or block (chip 3); slipping left into it is a hit. Haymaker: only slipped; a block staggers me 0.6 s. Bottle: a block breaks his bottle. A slipped attack opens him for 0.9 s (hits double, a heavy stuns). Rounds flow at 66 and 33; round 2 adds the bottle (he takes a beer bottle and smashes it on the counter), Dot's slideBottle, plates and upright stools in reach; round 3 adds the haymaker, a faster pace, combos, and blood on the lip and heavies. Throws into the stools, jukebox or pie case (a pie case if lane 5 exposes d.pieCase) when his back is within 1.2 m, at most one of each per round: stools topple, jukebox.hit then next record after 1.1 s, pie-case pane shattered. Hit stop 3 steps on a heavy and 1 on a jab, shake, fx.hit.punch. At 0 he reels to the end of the aisle; the next heavy is br_ko_window: 0.35x slow motion for 0.8 s, cutscene camera tracking him, flight over booth 4, glass.shatter(B4) on the glass mark with break_glass_big, landing on diner.pavement.ko, and the room's sound opens halfway to the street. Losing: fade to black with a thud; after 1.5 s the round is re-staged with 60 hp. After: walk out the door (a 'WASD  the door' nudge after 7 s idle), E search (searchBody), matchbook through inspect.open plus showMatchbook, pocketed, two pistol shots down the pavement at z -27 0.7 s apart, 2 s later the 'To be continued' card. HUD teaches once in round 1 (LMB jab, SPACE block, A · D slip, RMB hold): numbers tuned (see deviations). Autoplay fight ≈114 s, one knockdown, win.

Presets:
- `shot=fight_round1  (= scene=fight&beat=round1&t=1.9)`
- `shot=fight_round2  (= scene=fight&beat=round2&t=2)`
- `shot=fight_round3  (= scene=fight&beat=round3&t=2)`
- `shot=fight_ko  (= scene=fight&beat=ko&t=0.7; t=0.45 before the glass, t=1.4 landed)`
- `shot=fight_outside  (= scene=fight&beat=outside&t=1)`
- `shot=fight_matchbook  (= scene=fight&beat=matchbook&t=1)`
- `add &hud=1 for the health bar and prompts`

Builder's own critique: Mack is still the stub Hood in a fedora and trench coat, so from 1.45 m it is not obvious that he faces me (I checked: he does), and his guard, hook and jab stand-in poses read weakly. Only the haymaker's both-arms-up tell reads. The KO flight is my stand-in, not a clip: the figure is lifted and tilted back about its feet (rotation.x on c.object) and snaps to the deathBack lying pose on landing; at t=0.45 he looks like a man leaning off the booth back. After landing the camera frames him low with the pilaster taking the right third. An expert reactive player (tools/play.mjs's fight step) wins in about 27 s; the 90 to 150 s target holds only for the human-paced autoplay (about 114 s). The E grab prompt still appears in rounds 2 and 3 (the first two times something is in reach), which bends 'the HUD never says what to press after the first round'. Held stools and bottles draw at the stub palm point, so a grabbed stool fills the view. Round 3 bleeding is one burst at the round's start plus the blood on heavies; he has no lasting mark at the mouth.

### P0.4 Sound + music slots (done)

Sfx.js: 60 new procedural builders, all in the offline audioTest table (87 sounds render, no errors, peaks at most about 1.0 except the unchanged tommy and pistol). Diner objects: packTap, lighter, lighterShut, cigCatch, drag, exhale, ashTap, glassDown, cork, pour (glugs rising in pitch), glassSlide, sip, plateDown, cutlery, bell, doorbell (hooked to door.on('open')), register, wallet, newspaper, stoolSqueak, stoolFall, coin, jukeboxMech, needleDrop, needleScratch, jukebox_hit, coffeePour, trainWall, crouch, clothRustle, matchbook, pocket. Fight: f_jab, f_heavy, f_hisGrunt, f_myGrunt, f_blocked, f_punchMe (with ear ring), f_guardBreak, f_whiff, f_wind, f_scuff and f_tell (linoleum footwork), f_grab_*, f_stun, f_bodyThud, f_bodyStools, f_bodyFloor, f_bodyPavement. Breaks: break_bottle, break_tumbler, break_cup, break_plate, break_stool, break_table, break_glass_big (a crack like a shot, then 2.2 s of glass on stone), topple_stool, topple_table. Room: sfx.room('diner') builds a live bed (rain on the plate glass, room tone, a 120/120.6 Hz fridge beat, fans, a two-voice murmur as band-passed noise, urn hiss). The street's rain beds, thunder, train and pistol shots now go through a wall low-pass: 600 Hz and -12 dB indoors, open outside, and roomOpen(0.5) once the window is out. Footsteps on linoleum indoors. docs/story/MUSIC.md lists every slot: where it plays, scene length, mood, file name.

Presets:
- `shot=street&audiotest=1 (tools/errors.sh prints the table)`

Builder's own critique: The live room bed and the wall filter are checked only by expectations in the plays (the bed exists and the room is 'diner'); nobody has listened to them. The offline table covers the one-shots only. Sound variation still uses Math.random (audio only, never game state). The murmur is plain band-passed noise with amplitude swings and may sound like wind rather than voices. The fight has no score cue: jukebox_b and jukebox_c carry it, as MUSIC.md says.

### P0.5 Autoplay + tools/play.mjs + counters (done)

?autoplay=1 (game/Autoplay.js; each scene exports auto(ctx, A)) begins from the title and plays the whole slice through game.vin. It waits a human moment at each prompt, drags now and then, spins the stool, and fights by the marks with seeded misses and reaction delays. Result: fight about 114 s with one knockdown, walk out, search, pocket, card. ?speed=k runs the sim faster for tests. tools/play.mjs drives the real page through CDP with trusted keys and mouse. Steps: wait, key, down/up, mouse, look, until, shot, expect, eval, walk (turns by mouse, W held), clickOn, reload, and fight (reads his clip and marks and blocks, slips and punishes by real input). Delivered tools/plays/slice.json (title, BEGIN, all of scenes 1 and 2 by real input, a screenshot at each beat): 17 of 17 PASS, covering cigarette lit, glass full then empty, fight started and ended, matchbook shown and pocketed, 'To be continued', #errlog clean. tools/plays/continue.json (P1 save/continue across reload, the walk out, the end card back to title with CONTINUE): 7 of 7 PASS. tools/plays/autoplay.json: PASS. #counters now carries scene, beat, fight {round, me, him, hisState, hisClip, myState, landed, taken, blocked, slipped, throws, downs, time}, play time, prompt, subtitle, and the scene's plain flags.

Presets:
- `node tools/play.mjs tools/plays/slice.json`
- `node tools/play.mjs tools/plays/continue.json`
- `node tools/play.mjs tools/plays/autoplay.json`
- `?autoplay=1[&speed=2]`

Builder's own critique: --virtual-time-budget does not advance play mode, so tools/counters.sh cannot run autoplay; use play.mjs. The play tool's view turns are trusted mouse moves until the cursor reaches the window edge, then fall back to a page-level mousemove event on the same handler. The fight in slice.json is a fast reactive loop (about 16 ms polls), so it plays like an expert. Screenshots from play.mjs are 1280x800 and the timing is real time on a busy machine.

### P1 (done)

Save and continue across a page reload (checkpoints at scene entry and the beats in def.save; CONTINUE on the title restores flags and inventory; verified by continue.json). The pause card over any scene (pointer lock lost pauses the sim). Settings line on the pause card: mouse sensitivity, volume, subtitles on/off, persisted. Subtitles can be turned off.

Presets:
- `scene=diner&beat=order&t=1&hud=1&card=pause`

Builder's own critique: The settings line is small, low-contrast text; the minus and plus controls have small hit areas.

## Intended golden changes

title: the whole frame is new. The title camera now looks at the diner from across the street (drift from (2.5, 1.6, 9.5) toward (1.5, 1.6, 7.5), gaze on the door); the card is moved up over the dark stone with the lit bays and the wet street below; BEGIN (and CONTINUE when a save exists) sit on torn strokes low in the frame; the key line is new; a bottom gradient is added. end: the 3D frame underneath is identical. Only the card changed: the '15 KILLS' line is gone (no counters anywhere), so the splat, THE END, the epitaph and 'click to try again' re-centre vertically. The box (112,86)-(1344,696) is the card alone.

## Errors

tools/errors.sh: (clean) on shot=title, shot=end, shot=diner_settle, shot=diner_light, shot=diner_order, shot=diner_pour, shot=diner_drink, shot=diner_pay, shot=diner_rise, shot=fight_round1, shot=fight_round2, shot=fight_round3, shot=fight_ko, shot=fight_outside, shot=fight_matchbook, scene=diner&beat=settle&puzzle=demo; shot=street&audiotest=1: clean, 87 sounds render. npm run build: OK (only the existing chunk-size warning).

## Frame rate

Not measured. I added nothing per-pixel and no always-on geometry: a few props per round, one Character-transform override during the KO, and HUD canvases drawn once per line. The machine was shared with six other lanes, so a number taken now would not be trustworthy anyway.

## Contract deviations

1) Brawl numbers are tuned from the brief's starting values (allowed by the brief). Mine: jab 2.5, heavy 8..13, bottle 18, plate 10, stool 24, a heavy into his guard 30%. His damage is unchanged (6/12/22/18) with chip damage 3/6/4. His pace per round: gaps 1.3–2.1 / 1.0–1.6 / 0.6–1.1 s. 2) The KO flight is staged by Brawl, not the clip: c.place along a path, c.object.position.y and c.object.rotation.x (order 'YXZ') set each step, c.ko('deathBack') on landing with the fall fast-forwarded. 3) Brawl writes controller.modeOpts.ring every step: a tight ring (r 0.45) around where I should stand, 1.45 m from him along the aisle, so the ring moves with the fight and slips never drift out of the aisle. This is lane 2's controller state; I found no API for moving the ring. 4) Hud.showEnd(kills) is now showEnd({ kind: 'end' | 'cont', title, sub, epi, go }), and showTitle(text, { canContinue }). The title choice fires on mousedown, not click. 5) docs/story/MUSIC.md was written although docs/** is frozen, because the brief asks for exactly that file. 6) Beat 'ko' starts at the last blow (the flight), not the aftermath; the walk out runs inside 'ko', and 'outside' begins by Mack on the pavement. 7) Scene 2 is entered from scene 1 with fade 'cut', card false, keep true (no chapter card 'II'). 8) main.js adds URL params: press=<code>@<t> (a key at game time t in shot mode; presets may carry `press`), speed=<k>, autoplay=1, card=chapter|cont, say=<text>. Scenes may export auto(ctx, A).

## For the integration agent

New APIs other lanes may call or should know: game.brawl (Brawl: start/stop/active/finished/round/him/me/stats/state, armBottle, reachable, later); game.vin {held, down, up} and game.held(code) (an input source next to the keyboard); game.hitStop (simulation steps to skip; main.js simStep honours it); game.slowmo(k, s) / game.timeScale; game.start(save), game.toTitle(), game.endSlice(); scenes.go(id, { fadeIn, keep }), scenes.stop(), scenes.playTime; sfx.fight(name), sfx.roomOpen(k), sfx.dest(pos, { street }), sfx.loop(..., street), sfx.step(pos, run, player, lino); hud.tickCard, hud.promptShown / sayShown, hud.subtitles, hud.settings. Events I emit: brawl:round, brawl:hit, brawl:tell, brawl:throw, brawl:reel, brawl:end. Clips and marks I depend on (retime freely, keep the names). Hands: lightUp (tap, lips, spark, lit, shut), drag (glow, exhale), ash (tap), reachGlass (taken), sip (tilt, drink), putDown (down), payWallet (open, shown, bill), guard, jabL/R (contact), heavyWind (charged; the clip's duration is the max hold), heavyHit (contact), block, blockHit, slipL/R (safe, safeEnd), hurt, grab (taken), swingBottle/Plate/Stool (contact), searchBody (found), showMatchbook (shown, pocketed). Cast: serve (down), pour (take, uncork, streamOn, streamOff), slide (release), slideBottle (release), ring (ring), notice, rise (stool), br_* per §14 (tell, contact, open/openEnd, impact, glass), startle, cower, duck, lean, sit*. Lane 6: my KO flight overrides c.object position and rotation.x until landing; if br_ko_window gets real root motion, delete stepKO's transform lines in Brawl.js. Lane 2: I write controller.modeOpts.ring each step in brawl, and controller.slip. Lane 5: optional d.pieCase ({ pos | object, pane | handle }) is used for the pie-case throw; I call d.take/place on items named glass, lighter, scotch, coffeePot, plate.oldman, bottle.reach, plate.reach1..3, and d.stools[i].handle for grabs and topples. The door's bell is hooked with dinerFront door.on('open'). Merge order: I touch only L7-owned files plus src/debug/shots/L7_story.js, tools/play.mjs, tools/plays/*.json and docs/story/MUSIC.md.

## Golden table

```
preset           verdict         px%    px>8%     mean    blk16  changed box (px>8)
street           IDENTICAL 
street_t8        IDENTICAL 
lamp             IDENTICAL 
cars             IDENTICAL 
carside          IDENTICAL 
hood             IDENTICAL 
hoodstudy        IDENTICAL 
hooddeath        IDENTICAL 
hoodwalk         IDENTICAL 
hoods            IDENTICAL 
viewmodel        IDENTICAL 
reload           IDENTICAL 
impacts          IDENTICAL 
muzzlesmoke      IDENTICAL 
battle_t15       IDENTICAL 
battle_t30       IDENTICAL 
battle_t45       IDENTICAL 
wreck_t2.9       IDENTICAL 
wreck_t3.1       IDENTICAL 
wreck_t3.4       IDENTICAL 
wreck_t8         IDENTICAL 
wreck_t40        IDENTICAL 
train_t6         IDENTICAL 
havoc            IDENTICAL 
storm            IDENTICAL 
perf             IDENTICAL   (recaptured alone: in the full run my headless Chrome hung on a busy machine -> NO CAPTURE; `golden.py check perf title end street` then gave perf IDENTICAL)
title            CHANGED      93.125   74.239   51.381   235.89  (0, 0, 1439, 899)
end              CHANGED       8.935    5.646    5.212   232.67  (112, 86, 1344, 696)
2 of 28 frames changed without being allowed (title, end: both intended)
```
