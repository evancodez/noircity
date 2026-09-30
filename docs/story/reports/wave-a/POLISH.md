# Wave A polish pass (round 3)

- branch `wave-a/r3-polish`, last commit `c5b1873 Polish pass WIP: the light shape's contour rides the ink's own probe (frame rate); the goal's push throttled (5 commits on top of c6e0717; not pushed, not merged)`

### AD1 white halo round my hands (done)

Cause: The halo was bloom. The bare hands (viewmodel ids 1730..1769) are lit several times paper white by the viewmodel's proxies of the nearest lamp spots. At the open window the street lamps take over those proxies. The bloom prefilter took that bright skin and spread a soft white glow over the background and back over the fists. On top of that, the skin rule let the exposure pick the lit value, so the whole hand went to the pale value at the window.

bloom.js: the prefilter masks bare-hand pixels (keepW, reading tId). Emitters in the hand keep their bloom: the ember (class 10) and the lighter flame, which idpass.js now tags as class 17. ink.js: no bloom is laid over bare-hand pixels (the flame's warmth on the fingers stays, via uFlame). The skin's lit/shadow split now follows the form: lit value 0.56..0.68, shadow 0.30..0.36, weighted 80 % form and 20 % light.

Proof: `shots/r3/base/strip_ko_B4.jpg vs shots/r3/i1_ko_B4.jpg (scene=fight&beat=ko, t 0.2..3.0)`, `shots/r3/base/strip_light.jpg vs shots/r3/i1_light.jpg (t 4.4..8.6)`, `shots/r3/final/koB4.png, shots/r3/pairs_d.jpg`

Own critique: The glow is gone at the window and at the lighter. The hands still do not print quite the same everywhere. Looking down at the pavement their tops face the light and fall into the ink's 0.75 band, while indoors in guard they sit at about 0.5. That comes from form and band quantisation, not a glow, but the values differ.

### AD2 the blue disc on the floor (done)

Cause: The neon floor patch in props/diner/light.js is additive blue at a tiny gain. The ink's colour-keep rule prints any kept colour at display 0.45 or more, with no brush (the rule that keeps blood and fire vivid). A faint blue wash therefore cannot exist: at any gain that shows at all it printed as a saturated blue ellipse.

I removed the patch; the brief allows that. The neon stays on its tubes and on the wet pavement outside.

Proof: `shots/r3/pairs_c.jpg (diner_wide, diner_left base | final)`, `shots/r3/pairs_b.jpg (round2 base | final)`, `shots/r3/final/diner_left.png, diner_wide.png, round2.png`

Own critique: This is a removal, not a faint torn wash. Making it sit would need a new low-value colour path in the ink, which I judged out of scope.

### AD3 the cigarette in my lips (done)

Cause: The light-up clip dropped the eyes 0.34 rad to the flame (the 'eyes' view key). That lifted the whole 8 cm cigarette, 13 to 15 cm from the eye, into the frame as a fat white post from the bottom edge. The lips direction also drooped only 3 degrees.

Removed the eyes key from lightUp. The lips direction now droops 5.7 degrees (MOUTH_DIR 0.02, -0.1, -1), the same in Hands.js and clips/diner.js, so lighterAtTip follows. Only the tip end, with its ember, shows at the bottom centre. At the flame, the tip and flame rise just into the bottom of the frame.

Proof: `shots/r3/i3_light.jpg (t 6.4..11.0)`, `shots/r3/pairs_a.jpg (light80, pay: base | final)`, `shots/r3/i3/pay_crop.png`

Own critique: Its length is now about 30 to 45 px at 1440 x 900, so the under-40 px target is only partly met. It is still about 35 px wide, because a real 8 mm cigarette 13 cm from the eye is that wide. It reads as a short nub, not a thin line. At the flame, the lighter hand is mostly under the frame edge, so the light-up gesture itself reads less.

### AD4 the smoke over dark ground (done)

Cause: The thread's width was fixed in metres (1 mm half width). That is 3 px at arm's length but a thick bar 15 cm from the eye (cigarette in the lips). Its core of 0.22 x 0.6 over the dark wall was stepped to paper by the room print (grey from display 0.45, paper from 0.86). Its gaps made it dashed. From the lips it rose straight up the middle of the view.

StoryFx Thread: the width is set in screen pixels (2.2 to 2.8 px at any distance), grey is 0.085 (about 0.4 over black), there are no gaps (side strands thin smoothly), and it fades between 0.3 and 0.6 m. Points from a cigarette in the lips drift forward and to the right (wisp(..., { lips })), so the thread curls away from the eye.

Proof: `shots/r3/pairs_a.jpg (lightrest, pay: base | final)`, `shots/r3/i3/rest_crop.png, shots/r3/i3/pay_crop.png`, `shots/r3/final/pour15.png`

Own critique: Over the white counter it prints as two faint parallel dark edges rather than one darker hair. Over the dark wall it is faint, close to invisible in places. It is never white or dashed, but it is a quieter element than before.

### AD5 glass on the ground (done)

Cause: A shard that came to rest was moved to the world layer with a pale sheen material. The ink then printed each piece as a surface of its own: its sheen was stepped to paper by the street's bands and it got the heavy ink outline. The result was flat white sheets.

Resting shards stay on the effects layer. Each is a 10 % dark, see-through film with a thin light edge (a line of its own). About 30 % of the pieces over 30 cm² get one small glint sprite at a corner. A shard that falls again gets its flying look back.

Proof: `shots/r3/pairs_c.jpg (outside, matchbook: base | final)`, `shots/r3/i5b/outside.png, shots/r3/i5b/matchbook.png`

Own critique: The big pieces now read as a web of light hairlines on the pavement, more like cracks than loose glass. The glints are so small they hardly register. Overlapping pieces still stack a slightly darker patch.

### AD6 he comes too close (done)

Cause: His ring round my eye was 0.78 m, and it was measured on his root only. A haymaker or overhand throws his chest and head well past his feet. A travelling clip also re-sets his root from the clip's origin every step, so the clamp never held on screen: the camera ended up almost inside him. And any walking figure's collider let my eye come within about 0.65 m.

brain.js KEEP_OFF: his root stays at least 1.1 m from my eye, 1.2 m during a rush, and in attack states he goes back further by however far his chest or head leans in toward me (body 1.0 m). A travelling clip's origin now moves back with him, and the figure is drawn at the clamped position the same frame. While walking he may pass at 0.85 m: see the extra item on the aisle deadlock. Controller.keepOff stops my own step closer than 1.1 m to any standing cast figure (not Hoods, not a man lying down), and never shoves me.

Proof: `shots/r3/base/round3.png vs shots/r3/i6_round3_final.jpg (scene=fight&beat=round3 t 1..8)`, `shots/r3/pairs_b.jpg`

Own critique: No frame has the camera inside him any more. At 1.1 to 1.2 m a 1.96 m man still fills the frame's height; round1 at t=3 is noticeably bigger than the base frame, which had him at about 2 m. While walking or passing he may come to 0.85 m. The walking-figure rule is not applied to Dot across the counter, who stands about 1 m from the seat by design.

### AD7 Mack's arms (done)

Cause: Each light shape printed as one flat value, chosen only by the light level. A forearm under or against a lamp was therefore one grey slab with no form, and there was no contour between the shape and the dark mass (one mesh, one id).

ink.js castF path: the split between a shape's lit value and its shadow value comes from the form, the normal against a key made from the nearest rim lamp lifted toward up and the eye, with a torn brush edge. The light level only sets how light the lit side is. A thin contour where a light shape meets the dark mass is computed inside the existing 8-tap contour probe, at no extra taps. Creases such as the fist's knuckle groove and the wrist come from the probe's own normal edges.

Proof: `shots/r3/i7d/lesson_cmp.png (base | final, lesson1)`, `shots/r3/i7c/mb_cmp.png (hands at rest on the pavement)`, `shots/r3/final/round1.png`

Own critique: The forearms now have a lit face and a torn shadow flank. The knuckle line is faint at 1.5 m, and it comes from the geometry's grooves, not a drawn tick. The change applies to every cast light shape (Dot's apron, the cook's hat), and Mack's shirt V prints a little lighter than before.

### AD8 the sconce (done)

Cause: The scallop patch was a 3 m fan with a sharp edge, which the room print cut into one hard grey vase shape. The dark back plate of the bracket faced the room and printed as a black dot in the lamp.

Smaller shade, no back plate. The scallop is soft (long edge ramp), shorter (about 1 m up, half that down) and a little dimmer, so it prints as a small light shape above and below a small lamp.

Proof: `shots/r3/i8_sconce_base.png vs shots/r3/i8/sconce.png`, `shots/r3/final/round1.png, diner_left.png`

Own critique: It reads as a small wall lamp now. The scallop still has the room print's stepped edge rather than a real soft falloff, and it is modest as a backlight behind Mack.

### AD9 the tumbler (done)

Cause: The ink printed the empty glass (class 11, above the fill line) at 0.42 of what lay behind it: a grey opaque wall, like a can. The fill was already right: setFill(1) is two fifths of the glass.

Clear glass: what is behind shows through at 0.82, going dark only where the wall turns edge-on (its sides and the rim's ellipse), both in the hand and in the room.

Proof: `shots/r3/i9_tumbler_base.png vs shots/r3/i9/tumbler.png`, `shots/r3/pairs_d.jpg (sip04, pour15)`

Own critique: It reads as a glass with a rim ellipse now. The amber band is still a bright flat orange, and the thick base is still hard to read at counter distance.

### AD10 the first frames of a beat (done)

Cause: The room's pendants are off while out of sight. The real-light pool follows the eye but re-deals only every 0.25 s and fades each light in over 0.25 s. At a jump into a beat, the pool was still on the street lamps when the diner switched its lamps on, so the counter printed black for about half a second.

Lamps.updatePool deals the pool at once, at full light, when the eye jumps more than 2 m in a step or when the set of lit lamps changes (a room coming into sight).

Proof: `shots/r3/base/sip04.png vs shots/r3/i10/sip04.png (scene=diner&beat=drink&press=KeyE@0.3&t=0.4)`, `shots/r3/pairs_d.jpg`

Own critique: Walking in through the diner's door now switches its lights in one step instead of a quarter-second fade: a small pop.

### AD11 the lesson's cards (done)

Cause: The backing was sized as 15 px a character, but the text is spaced 0.3 em a letter, so the words ran past it and over the dark room. The mouse was drawn 33 px. The arrow was a clean filled vector shape.

The backing is measured from the text, picture and gaps, 96 px tall, black, torn, 85 % opaque. The mouse is 48 px tall, drawn at twice that. Key dabs sit in a 66 px box. The arrow is a dry brush: 11 bristles along the bowed path, each with its own width and alpha, skips and running dry. The head is two pressed ragged strokes meeting at the point, over a darker underlayer.

Proof: `shots/r3/i11/cards.png, shots/r3/i11/arrow.png`, `shots/r3/final/lesson4.png, lesson1.png`

Own critique: The arrow reads as brushed. Its head is a light chevron rather than a solid pressed wedge. The backing only shows where there is something lighter behind it.

### AD12 the pendant heads (done)

Cause: Each head's 'bulb' mesh included a 30 cm glow disc filling the shade's whole mouth at glow 9, and the shade's inside glowed at 2.5. The head printed as a large hard white oval with bloom.

The mouth disc is now 10 cm (the bulb's diffuser), and the inside of the shade glows at 0.32. A head prints as a dark cone with a small white disc and a tight glow.

Proof: `shots/r3/pairs_b.jpg (round1, round2: base | final)`, `shots/r3/i12/round1.png, shots/r3/i12/diner_wide.png`

Own critique: Read up close they look like lamps now. The shafts under them are unchanged; their tops now start from a smaller source.

### BUG1 [blocker] lesson hangs at step 4/5 (done)

Cause: As the bug hunt said: Lesson.attackAt was set to Infinity when the slow hook started, and only onHisBlow set it again. A hard punch of mine that knocked him out of the hook meant its contact never came, so he never attacked again.

BrawlLesson tracks a pending blow. If the step's blow is no longer playing (cut off by a knock, react or stun) before its contact, the arrow is cleared and he goes again 1.6 s later.

Proof: `shots/r3/plays/f12.log (the bug hunt's f12_hook_hard: after the hard punch in the tell he throws br_hook again at lesson t 7.2, 14.2, 18.2, 25.1 s)`, `shots/r3/plays/auto_summary_c.txt (seed 2024, which hung for 1442 s before, wins in 134.8 s)`

Own critique: The fix is at the root. In f12 the play never slips, so it stays on step 4, which is correct: he keeps throwing the hook.

### BUG2 [major] E never takes the counter's things (done)

Cause: reachable() took the nearest item by distance. The stools stand at the counter's foot, always nearer than the bottles, plates and mugs on its top, so the counter's weapon rack could never be grabbed while the stools stood.

The choice now scores distance plus the 3D angle from where I look (capped at a right angle), minus a preference of 0.9 m for things on the counter. The counter's reach is now 1.5 m. Looking down at a stool takes the stool; looking level, or away, takes the thing on the counter.

Proof: `shots/r3/reach2.out (aisle grid: bottles, plates, mugs each win 250 to 550 cells in every look direction; before 0)`, `shots/r3/plays/f7.log (bottle, plate, mug, stool and chair are each taken at their stand points)`

Own critique: The weights are hand-set. Near the counter a stool now needs a deliberate look down at it to be chosen.

### BUG3 [major] the fight leaves the diner by the door (done)

Cause: Brawl mode resolved only against the colliders, and the door's gap is open in the collider net.

Brawl.start hands the room's bounds to the controller (brawlBounds), and brawl mode clamps my eye inside the room's walls. Brawl.stop clears it.

Proof: `shots/r3/plays/f14.log (holding S from (-11.6,0.6): the eye stops at x -10.76, room 'diner' throughout)`

Own critique: It is a hard invisible wall at the door's line while fighting. The door itself is not shut.

### BUG4 [minor] the stool wind-up blinds the view (done)

Cause: With a stool or chair in the right hand, the wind-up used windItem (the bottle's over-the-shoulder pose), which put the seat right before the eye.

New windBig clip (clips/fight.js): the stool is drawn back low on the right, its legs trailing back out of the frame. A wound stool strike uses a new swingBig clip from that pose, across and into him. New debug preset: r2duel&do=mystool|mybottle&hold=s.

Proof: `shots/r3/base/strip_mystool.jpg vs shots/r3/d4_mystool.jpg (shot=r2duel&do=mystool)`

Own critique: The view is clear through the wind-up, but the right hand leaves the frame while winding. The seat still sweeps across the frame for a few frames of the strike, which is intended.

### BUG5 [minor] the burst window is an invisible wall (done)

Cause: The front's wall colliders are two long boxes running across every bay, and nothing opened them when a pane burst.

dinerFront.openBay(name) opens a gap in the wall boxes (Colliders boxes now accept holes along z) plus a region of the collider net through the wall's thickness. 02_fight opens it in onGlass and when setting up at 'outside' or 'matchbook'. It closes again when the pane is restored.

Proof: `shots/r3/plays/g1.log (walking from (-12,-3.8) toward (-9,-3.8) now reaches (-8.3,-3.86) on the street; the later steps of that play then fail because they assumed the wall was there)`, `shots/r3/plays/out_g1_postfight_walls/`

Own critique: You walk through the 0.9 m sill with no climb or step animation. The eye passes over it, but it is a step-through, not a climb.

### BUG6 [minor] CONTINUE at fight/outside ignores the window (done)

Cause: setup.outside, matchbook and ko read only ?win=, never the saved flags.window.

winOf(ctx): ?win= first, then game.save.flags.window, then B4.

Proof: `shots/r3/plays/g3.log (window B2 saved: mackPos (-9.31, 5); B4: (-9.31,-3.8))`

Own critique: None.

### BUG7 [minor] autoplay fights under 90 s (partly)

Cause: Seed variance in how fast the autoplay's reads land. There is no single plain cause, and I did not retune the fight's numbers.

After this pass's changes (keep-off, grab choice, input buffer, steering) the same seeds run at 99.0 (9), 91.7 (88), 101.5 (3), 134.8 (2024), 97.7 (1937), 87.2 (1), 94.9 (2) and 90.8 (101) s: 7 of 8 in 90..150. The gate's autoplay.json passes. The real-input slice fight ranged 65.2 / 89.5 / 97.9 / 136.1 s over four runs.

Proof: `shots/r3/plays/auto_summary_a.txt, auto_summary_b.txt, auto_summary_c.txt (final)`, `shots/r3/gate/slice.log (65.2 s), shots/r3/gate/slice_r1.log (136.1), slice_r2.log (97.9)`

Own critique: Not tuned, only measured. Seed 1 is still short (87.2 s), and the real-input driver, which is not seeded, won once in 65 s with 0 blows taken. That failed the slice's 85..175 check in one of four runs.

### BUG8 [minor] the cigarette left in the lips after lighting up (done)

Cause: After lightUp nothing took the cigarette out of the lips until F. Its thread rose straight up the middle of the view from 15 cm in front of the eye.

Half a second after lightUp, 01_diner plays the drag on its own, with its sounds and exhale. The hand takes the cigarette and rests with it on the counter. When it is in the lips (paying), the thread drifts off (AD4) and the nub is small (AD3).

Proof: `shots/r3/pairs_a.jpg (lightrest: base | final)`, `shots/r3/i3_light.jpg`

Own critique: The first drag is no longer the player's choice. The F drag and the ash still work after it (playtest and slice pass).

### BUG9 [minor] blown-out white bloom at the last blow (done)

Cause: Flying shards glinted with emissive up to 3.5 and opacity 1 whatever their size. The big sheets of the burst lit whole and bloomed into a white mass in the window, and the fist's halo (AD1) added to it.

The glint falls with the piece's size (/(1 + area/0.006)), peaks at 2.4 and opacity 0.32 + 1.6g. Small pieces still flash; the sheets do not.

Proof: `shots/r3/d9_ko_B4_eye.jpg (before) vs shots/r3/d9_ko_B4_eye_b.jpg (after), shot=r2clip&clip=br_ko_window&at=B4&cam=eye t 0.5..1.0`

Own critique: A few mid-size pale sheets still print light grey as they tip at t 0.8 to 0.9.

### BUG10 [minor] a mashed second button is dropped (done)

Cause: A press was taken only while idle or late in a jab (t > 0.13 s). Anything earlier was discarded.

A press made while the hands are busy is buffered for 0.3 s and thrown as soon as they are free. It becomes a jab or a wind-up by whether the button is still held.

Proof: `shots/r3/plays/f10.log (the bug hunt's alternating mash: the lesson now reaches step 4; before it stayed on step 2)`

Own critique: None.

### BUG11 [minor] 'WASD the door' drawn mid-screen (done)

Cause: The prompt shows at the HUD's fixed place. Its tick followed screenOf(door) even when the door was behind me or off to the side.

The hint only shows while the door is inside the frame (6 % margins), with its tick on the door.

Proof: `shots/r3/plays/out_g1_postfight_walls/g1_b4_in.png (door not in frame, no hint) vs the bug hunt's g1_b4_in.jpg`

Own critique: The prompt text itself still sits at the HUD's place. Only its tick is on the door.

### BUG12 [minor] tooling: Chrome profiles fill the disk; launches fail (done)

Cause: Profile cleanup was already fixed in f176951, before this pass. What remained: DevTools ports drawn from ranges of 150 to 500, so parallel runs could collide on one port and one profile dir; a 5 s wait for Chrome; and a 20-minute stale sweep that could delete a long run's live profile.

tools/lib/profile.mjs: freePort() (an OS-checked free port from 20000..40000), CHROME_WAIT_STEPS 30 s with a clear error, sweep age 60 min. play, playtest, evalpage, fps, probe and waitdom all use them.

Proof: `All runs in this pass: 2 plays in parallel with captures, 0 noir-* profiles left in /tmp at the end`

Own critique: shot.sh and errors.sh (plain headless screenshots) are unchanged. errors.sh hung once in this pass. shots/r3/errs.py retries with a timeout, which the repo's own tool does not.

### EXTRA the lesson deadlock in the narrow aisle (done)

Cause: This came from my own AD6 change; I found it in the slice gate. The kept fight starts with me in the gap between the stools and the counter. His goal at arm's length could fall on a stool or the counter, and the new 1.1 m ring round my eye walled him into the corner by the counter in a 1.1 m aisle. He stood at 2.37 m for good, never in reach, and the lesson waited for ever. Also, my first keepOff shoved me away whenever another figure walked past (the old man going to hide).

His goal is pushed out of the furniture (colliders.resolve, throttled to 0.2 s or 12 cm). If he is wedged for 1.5 s he steps out into the aisle. While walking his ring is 0.85 m, and the 1.1 m and body rules apply to attacks. keepOff only stops my own step.

Proof: `shots/r3/plays/lk2.log (positions: he escapes the corner and circles at about 1.5 m)`, `shots/r3/gate/slice_r1.log, slice_r2.log (24/24)`

Own critique: The escape is diner-shaped: it heads toward counterX + 1.5, the open aisle.

## plays

Final gate run: node tools/playtest.mjs 30/30; tools/plays/slice.json 23/24 (the one failure: the unseeded real-input driver won the fight in 65.2 s, below the check's 85 s), rerun twice at 24/24 (fight 136.1 s and 97.9 s); tools/plays/autoplay.json 3/3; tools/plays/continue.json 7/7. All muted. Logs: shots/r3/gate/{playtest,slice,slice_r1,slice_r2,autoplay,continue}.log and summary.txt. Seeded autoplay fights (speed 4): 99.0, 91.7, 101.5, 134.8, 97.7, 87.2, 94.9, 90.8 s (shots/r3/plays/auto_summary_c.txt). Bug-hunt repro plays rerun: f12, f14, f7, f10, g1, g3 (shots/r3/plays/*.log).

## errors

npm run build OK (chunk-size warning only). tools/errors.sh clean (FRAMES RENDERED 2 to 5, errlog empty) on 24 queries: shot=street, hoods, battle&t=30, title, every diner beat, fight lesson (and step 4 with the HUD), round1..3, reel, ko, ko&win=B2, outside, matchbook, the light-up press, r2duel&do=mystool, smokestudy, diner_wide, castrow, perf&t=1 (shots/r3/gate/errors.txt). golden.py accept was never run. src/enemies/** is untouched. No new npm dependencies and no new real THREE lights; the only lighting-logic change is how the existing spot pool is dealt. Both dev servers (5198 and the base on 5291) are stopped, and the base copy in the scratchpad is removed.

## fps

A/B in the same session against a dev server of the base c6e0717 on port 5291, UNCAPPED=1, 1440x900, 3 rounds x 2 runs alternating. scene=fight&beat=round1&anim=1: base 93.10 vs r3 93.27. shot=perf&t=1&anim=1: base 75.92 vs r3 76.03 (shots/r3/fps_ab_round1.txt, fps_ab_perf.txt; the earlier single-server base is in shots/r3/fps_base_*.txt). An intermediate version measured 91.6; the cost was a 4-tap loop in the cast print, now folded into the ink's existing contour probe.
