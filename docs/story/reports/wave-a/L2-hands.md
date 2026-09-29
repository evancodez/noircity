# Wave A lane report: L2-hands
- branch: `wave-a/L2-hands`
- last commit: `2c92c58`
- worktree: `/Users/evansmac/Downloads/eprojects/noirextreme/.claude/worktrees/wf_1ce98cce-975-2`

## Items

### P0.1 (partial)

One articulated rig per arm in src/player/HandRig.js, the left being the right one mirrored by its root. The rig has a wrist bone, four fingers of 3 joints each (MCP with spread) and a thumb of 3 joints (CMC in 3 axes). It uses the brief's proportions: the palm is a cupped signed-power slab, the fingers are tapered lathe capsules with knuckle spheres that stand proud, the thumb-index web is skinned to both bones, and the wrist is an ellipsoid. It is one SkinnedMesh per skin, with rigid weights. There are two skins on the same geometry, bare and glove. Knuckle ticks and nails are thin torus-arc geometry coloured by vertex colour: dark on the bare skin, light on the glove. Forearm pieces: coat sleeve (0.045 widening to 0.055), 8 mm white shirt cuff (bare hands), leather gauntlet (glove), a pushed-up sleeve with a rolled cuff and bare forearm (fists), and an upper arm from elbow to shoulder. Ink ids come from allocVmId(5): skinR, skinL, sleeveR, sleeveL, cuff; every held prop gets its own. Poses are data (player/handPoses.js). A pose is a frame ('cam' | 'body' | 'gun' | 'drum'), a wrist point, the finger and back-of-hand directions, joint angles and an elbow. Helpers: palm() places a pose by its palm contact; wrap(Rc) computes chord-based finger curls around a cylinder; DF computes poses from world props through the socket table. Clips are keyed poses with eases, marks, prop events and eye-motion keys (handClips.js). hands.pose(name) shows a pose, a pair ('study', 'guard') or a moment of a clip ('lightUp@2.0', 'tommyReload@1.3'). The handstudy preset has an orbit camera with a plain studio background. Not right: bare skin prints dark grey, not light grey to paper white (see selfCritique and forIntegration).

Presets:
- `shot=handstudy`
- `shot=handstudy&pose=guard`
- `shot=handstudy&pose=tommyL&orbit=270&orbitc=L`
- `shot=handstudy&pose=tommyL&orbit=0&orbitc=L`
- `shot=handstudy&pose=tommyL&orbit=90&orbitc=L`
- `shot=handstudy&pose=tommyR&orbit=90&orbitc=R`
- `shot=handstudy&orbit=0`
- `shot=handstudy&pose=lightUp@2.0`

Builder's own critique: The bare hands print as a dark mid-grey, the same as the glove. The ink pass holds every viewmodel id (1730..1779) under a 0.28 tone ceiling (ink.js, the vmF block). Lane 1 owns that shader, so I could not change it; the shirt cuff and the cigarette paper print grey for the same reason. The one exception is the lighter's flame light, which lifts the cupped hand. The fingers look a little thick and stubby at 0.3 m, and the knuckle ticks hardly show under the ceiling. For the bare sets the brush field rides the right hand's frame, so strokes slide over the left hand while it moves (you only see this in motion). The upper-arm tube is a straight lathe, with no bend at the elbow.

### P0.2 (done)

The left hand is fitted on the vertical foregrip (fitted numerically in handstudy): the palm is on the grip's left side, the knuckles form a vertical row on the front-left (index on top, just under the barrel), the fingers follow chord curls round the front and end on the right side, and the thumb (fitted by search) wraps round the back toward the right. The back of the hand faces left, and the hand tilts 25 degrees up the grip. The elbow is at (-0.27,-0.42,0.05), so the forearm enters from the bottom-left corner. The right hand uses the same rig on the pistol grip: fingers fitted to hug the grip's oval, index curled into the guard onto the trigger, thumb on the frame's left side. The gun itself is untouched: the golden diffs sit only in the arm, hand and sleeve regions (changed box x 429..1156, y 618..899).

Presets:
- `shot=viewmodel`
- `shot=hoods`
- `shot=battle&t=30`
- `shot=handstudy&pose=tommyL&orbit=270&orbitc=L`
- `shot=handstudy&pose=tommyL&orbit=0&orbitc=L`
- `shot=handstudy&pose=tommyL&orbit=90&orbitc=L`

Builder's own critique: From the eye the left hand reads as a gloved hand gripping the foregrip, but it is bigger than the old knot. The left arm is now a slim sleeve rising from the bottom, not the golden's large dark forearm mass: the frame loses some of its bottom-left black, which the reference likes. The golden showed a sliver of the right glove below the drum; that is now mostly a dark sleeve shape. At the index MCP the finger sits about 7 mm left of the trigger blade's centre. In reload poses the gloves are near-black against the dark street.

### P0.3 (done)

The reload takes 2.6 s (Viewmodel RELOAD; Weapon WEAPON.reload follows it; the Sfx 'reload' plays with dur 2.6, so its latch, drum-in, home and bolt clicks land on the new moments). The gun tilt keeps the old 0.368 s rise, so the gun is identical at vmreload 0.85. Sequence: the left thumb reaches the latch at 0.52 (the hand rides the drum's frame). The drum slides 5 cm out, to the gun's left: that side is turned to the eye, not the right side. From 0.72 it falls under gravity in the eye's frame with a tumble (analytic, so any still is exact) and is out of frame before 1.04. The hand drops with it to below the frame. At 1.39 a clang plays (sfx 'clang'), street.addImpact makes a ripple, and a dark drum mesh stays by the right foot (at most 3; noRay, so bullets ignore it). The fresh drum rises from below the frame, tilted, the palm under its rim and the fingers along it, from 1.02. It lines up at 1.36, and the palm pushes it home at 1.42..1.56 with a small gun jolt. The hand pinches the knob at 1.9; the bolt goes back at 1.98 and home at 2.11; the hand is back on the foregrip at 2.4 and the gun goes down from 2.23. Moments: step 1 vmreload=0.52; step 2 in the air 0.8; step 2 end 1.04 (no drum anywhere); step 3 1.25; step 4 1.56; step 5 2.0.

Presets:
- `shot=reload&vmreload=0.52`
- `shot=reload&vmreload=0.8`
- `shot=reload&vmreload=1.04`
- `shot=reload&vmreload=1.25`
- `shot=reload&vmreload=1.56`
- `shot=reload&vmreload=2.0`
- `shot=handstudy&pose=tommyReload@1.3&orbit=90&orbitc=L`
- `shot=handreload&clip=tommyReload&ct=1.25`

Builder's own critique: The brief says the gun turns its right side to the eye. The kept animation turns its left side to the eye, so the drum slides out that way to stay visible. With the modest drop velocity the falling drum is only in view for about 0.15 s (10 frames). It is gone well before u = 0.40, but it is dark on a dark street and easy to miss. The latch and bolt hands are near-black shapes; they read by silhouette only. At 1.25 the rising drum is a big dark disc with the fingers under it: readable but crude.

### P0.4 (partial)

Smoke set (bare hands, coat sleeves, white cuff). In seated mode the eye leans 0.3 m forward over the counter, so the counter top fills the bottom ~40% of the frame. Rest: the left forearm lies on the counter, the right hand sits near the pack. lightUp (3.2 s): the right hand lifts the pack, taps it (mark tap), puts it down, pulls a cigarette out and puts it between the lips (1.2). The cigarette's tip then sits low in the frame, centre, pointing away. The right hand then takes the lighter (it lies by the right hand, STORY) and brings it up under the tip, and the left hand cups the flame. Thumb flick at 1.9, flame at 2.0 (accentMaterial 'flame' plus the viewmodel flash proxy as a small warm light on both hands; no new light), tip lit at 2.5, lid shut at 2.9, lighter back on the counter. drag (2.4): the hand up to the lips, the cigarette in, the ember flares, the cigarette back in the fingers, down; on exhale the hands call fx.cig.exhale unless the caller takes the mark. A lit cigarette sends up fx.cig.wisp every 0.55 s. ash (0.8): a tap over the ashtray. reachGlass / sip (3 fills of a third) / putDown: the glass comes up to the bottom centre of the frame and tilts toward the eye (amber visible), then goes back where it was taken from. payWallet (2.6): the wallet comes from the coat, is opened, is turned to the left and held (1.3..2.2); a bill goes on the counter and the wallet goes back. Clip prop events are take / put / drop / mouth / toMouth / fromMouth / flame / tip / glow / open / fill / bill. hands.hold now takes 'M' (the lips) and puts a released prop back into its old parent.

Presets:
- `shot=handclip&clip=lightUp&ct=0.5`
- `shot=handclip&clip=lightUp&ct=0.8`
- `shot=handclip&clip=lightUp&ct=1.4`
- `shot=handclip&clip=lightUp&ct=2.1`
- `shot=handclip&clip=lightUp&ct=3.2`
- `shot=handclip&clip=drag&ct=0.8`
- `shot=handclip&clip=drag&ct=2.0`
- `shot=handclip&clip=ash&ct=0.4`
- `shot=handclip&clip=sip&ct=1.1`
- `shot=handclip&clip=payWallet&ct=1.3`
- `scene=diner&beat=settle`

Builder's own critique: Deviations: the right hand lights the cigarette and the left hand cups the flame, where the brief has the left hand bring the lighter up; the lighter lies by the right hand, and a left hand reaching across made a huge diagonal sleeve. lightUp ends with the cigarette in the lips; the first drag moves it into the right hand's fingers. The brief wants it in the fingers at the end of lightUp. The hands at the lips are cheated below the frame. The ember at the lips is about 30 px, over the 12 px rule, and the flame is about 80 px tall, over 40 px, because both sit 15 cm from the eye. At 2.1 the cupped fingers look a little claw-like. In sip the glass is a large dark disc with a big orange amber surface; setTilt is not called, so the liquid does not run to the rim; the view is not bent through the glass base; the fingers lie over the top of the glass. The wallet is lane 5's stand-in box, so no licence card shows. The ash fleck is not made. When the eye swivels, the hands follow the body frame, but the stool mesh does not turn (lane 5).

### P0.5 (partial)

Fists set: bare hands, sleeves pushed up. guard is a hold: fists in the bottom corners, knuckles forward, thumbs across, the left ahead, with breath bob and weight rock. jabL / jabR snap down the centre line and turn palm-down at contact (0.09). heavyWind draws the right fist back and down out of the corner, opens the left forward, and twists the view 6 degrees right. heavyHit crosses the fist from low right to high left at 0.12 while the view swings +10 degrees and lunges 4 cm. block brings both forearms up vertical, side by side, fists at brow height. blockHit jolts them toward the eye with a view kick. slipL / slipR: eye 0.45 m sideways, 0.12 m down, 8 degree roll, fists trailing. hurt: view snaps 9 degrees yaw and 5 degrees roll, fists drop for 0.25 s, two white frames (Health.flashWhite). grab, swingBottle (overhand), swingPlate (flat from the chest, dropped at contact), swingStool (two-handed from the right shoulder). searchBody and showMatchbook are posed. All CONTRACTS §14 timings are clip marks. Eye motion runs through clip 'view' keys into controller.viewFx.

Presets:
- `shot=handclip&clip=guard&ct=0.5`
- `shot=handclip&clip=jabL&ct=0.09`
- `shot=handclip&clip=jabR&ct=0.09`
- `shot=handclip&clip=heavyWind&ct=0.5`
- `shot=handclip&clip=heavyHit&ct=0.12`
- `shot=handclip&clip=block&ct=0.3`
- `shot=handclip&clip=slipL&ct=0.2`
- `shot=handclip&clip=hurt&ct=0.1`
- `shot=handclip&clip=swingStool&ct=0.45`
- `shot=handclip&clip=searchBody&ct=1.3`
- `shot=handclip&clip=showMatchbook&ct=1.0`

Builder's own critique: The guard fists read more like half-closed hands than tight fists. They are small, grey (the ceiling again) and partly cut off by the bottom edge. The block's forearms read well. The swings were tested without props: a bottle, plate or stool held via hands.hold has not been checked in frame, and the swingStool sockets are rough. The plate's flight after release is not made (lane 7 or lane 3). searchBody is in eye space, while the stub's 'outside' camera stands about 2 m from Mack, so the hand never reaches his pocket. showMatchbook poses the pinch but holds no prop (lane 7's inspect shows the matchbook). The white flash is a HUD element, so it is invisible in shot mode with hud=0.

### P1 (partial)

seated mode: eye 0.3 m forward over the counter (opts.forward), the old lean when looking down, and past +-1.2 rad the body heading (controller.bodyYaw) swivels with the look, so the hands on the counter turn with it. brawl mode: footwork resolved against the stage's colliders (never through a stool, booth or counter) and still clamped to the ring. Every setMode except table eases the camera from the previous eye over 0.4 s, and cuts when the eye jumps more than 2.5 m. table keeps its own 0.5 s ease. setPose cuts. Walk mode, head bob and the footfall callback are unchanged (the goldens are identical).

Presets:
- `scene=diner&beat=settle`
- `scene=fight&beat=round1`

Builder's own critique: The stool mesh does not turn (lane 5 API). Leaving table mode now eases through the generic blend, but I have not looked at the table in or out ease in a frame. The brawl circling was not tested with a moving opponent.

### P2 (not started)

Idle flourishes (drumming fingers, turning the lighter, adjusting a cuff) and rain drops on the hands outdoors are not done. Only breath bob and the fists' weight rock are in.

## Intended golden changes

hoods, viewmodel, impacts, muzzlesmoke, battle_t15, perf: the changes are only in the hands and sleeves. The changed box stays in the bottom band x 426..1156, y 618..899. I checked the diff masks of viewmodel: they cover the new left forearm, the sleeve and the foregrip hand (the golden's knot at x 850, y 640 replaced by the fitted grip), plus a small patch under the stock where the golden's right glove showed. The gun, the flash and the world are pixel-identical outside that. battle_t15 and perf fall before the first reload, so only the hands differ there. reload: the reload is 2.6 s and the drum falls out of the frame instead of hanging. At vmreload 0.85 the gun pose is identical, because the tilt keeps its 0.368 s rise. The drum and left hand differ: at 0.85 the drum is just below the frame in its fall, where the golden shows it hanging. battle_t30, battle_t45, end: whole-frame changes, as the brief expects. The longer reload shifts every autopilot shot after the first one. The autopilot is lane 7's; the fight at t 40, 43, 47 and 50 has burning cars, Hoods and muzzle flashes, and t=50 is as strong as the golden. The exact t=45 frame looks at the facade in a lull, with no flash; that frame is less lively than the golden. end shows THE END over a different street moment, with 14 kills instead of 15. The spent drums lying by the player's feet (at most 3) show in the battle frames when the camera looks down.

## Errors

errors.sh on every query was clean. Frame counts: shot=handstudy 3, shot=handstudy&pose=tommyL&orbit=270 2, shot=handstudy&pose=tommyReload@1.3 3, shot=handstudy&pose=guard 3, shot=handclip&clip=lightUp&ct=2.0 3, shot=handclip&clip=payWallet&ct=1.3 3, shot=handclip&clip=heavyHit&ct=0.12 2, shot=handclip&clip=showMatchbook&ct=1.0 3, shot=handclip&clip=sip&ct=1.0 3, shot=handreload&clip=tommyReload&ct=1.25 3, shot=reload&vmreload=1.25 6, shot=viewmodel 3, shot=hoods 3, shot=battle&t=30 2, scene=diner&beat=settle 2, scene=fight&beat=round1 3, scene=fight&beat=matchbook 3. npm run build passes (only the usual chunk-size warning).

## Frame rate

88.8 fps (avg 11.26 ms, p95 12.7 ms, p99 13.4 ms; 629 calls, 2.16M tris), from UNCAPPED=1 node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900. The tool warned the GPU was already 69 % busy from other lanes before the run, so the number is not a clean benchmark. The hands are 2 skinned meshes (16 bones each) plus a few forearm lathes per arm. No new THREE lights: the flame reuses the viewmodel's existing flash proxy PointLight.

## Contract deviations

1. Reload drum side: the brief says the gun turns its right side to the eye, but the kept tilt turns its LEFT side to the eye. The drum slides out and back in on that side (gun -x) so it stays visible, and the left hand works on that face.
2. lightUp: the right hand takes the lighter, lights the cigarette, and puts the lighter back; the left hand cups the flame. The brief has the left hand bring the lighter; STORY puts the lighter by the right hand.
3. lightUp ends with the cigarette in the lips; the first drag moves it into the right hand's fingers.
4. The mouth point is Hands' own (0, -0.088, -0.07) in the eye's frame. A hand at the lips is below the frame bottom, and the cigarette rises into view from the bottom edge.
5. The seated eye leans 0.30 m forward of the stool (Controller seated `forward`, default 0.3) so the counter fills the bottom of the frame, as the brief's framing requires. With the stool at x -13.75 and the counter edge at -14.35, the eye would otherwise be 0.6 m from the edge.
6. hands.hold(prop, hand, { keep }) also takes hand 'M' (between the lips). Letting go puts the prop back into its old parent at the world place where the hand left it; keep:true just removes it.
7. Clip data gained keys, props, view, brush and flash fields. hands.pose also takes 'clip@t' and 'tommyReload@t'.
8. slipL / slipR move the eye themselves (controller.viewFx.side / down / roll). controller.slip still exists but should not also be driven, or the slip doubles.
9. The drag's exhale mark calls fx.cig.exhale only when the caller passes no onMark.exhale. The stub scene passes one, so it is called once, not twice.

## For the integration agent

1. Ink id class for skin and paper (lane 1, ink.js). Bare skin, the shirt cuff and held white paper print dark because the ink pass puts every viewmodel id (VM_LO..VM_HI) under the gun's 0.28 ceiling: the `if ( vmF > 0.5 )` block computes ceilG = 0.28 for all of them. The hands use ids from allocVmId: game.player.hands.ids = { skinR, skinL, sleeveR, sleeveL, cuff }, consecutive, allocated once at startup. The simplest patch would keep the ceiling only for the Tommy gun's own ids (VM_ID0..VM_ID0+9, e.g. `float gunF = step(-0.5, -idc - VM_ID0) * step(-idc - VM_ID0, 9.5)`, applying the ceiling only when gunF > 0.5). Lane 1 could instead reserve a skin sub-range, allocVmId handing those out on request (e.g. allocVmId(n, { paper: true })). Either way, bare hands would then print light grey to paper white under the diner pendants, as the brief asks. Every hand frame (handstudy, the diner and fist clips) needs another look after that change.
2. For lane 7 (scenes):
- Pass skip-if-held props. The hands take their own props in clips: lightUp takes the diner items 'cigarettePack' and 'lighter' and makes a new cigarette with buildProp; sip, reachGlass and putDown take items.get('glass'), falling back to kind tumbler; payWallet builds a wallet. The stub's holdCigarette calls hands.hold(c, 'R') at the 'lips' mark and swaps in its own cigarette, which works but is redundant.
- The cigarette's lit tip: the hands call setTip('lit') on their prop event at 2.5.
- The flame and the sfx 'lighter' remain the scene's to trigger (onMark flame).
- Brawl.js should not set controller.slip while playing slipL / slipR.
- hurt already asks health.flashWhite(2).
3. For lane 5 (props):
- Lane 5 may add the prop methods the hands look for (they probe for them): userData.setGlow(k) (the drag's ember flare; without it the ember mesh is scaled) and setTilt, which the hands do not yet call.
- A wallet with a visible licence window would complete payWallet.
- The hands expect the pack at body (0.14, -0.40, -0.44) and the lighter at (0.26, -0.40, -0.42) relative to the seated eye; the stub diner places them there. Anchors hands.anchor('pack') and hands.anchor('lighter') return those points.
4. hands.anchor('mouth') is now (0, -0.088, -0.07) in the eye's frame. 'cigTip' finds the cigarette in either hand or the lips.
5. New world objects:
- Weapon.dropDrum adds up to 3 spent-drum meshes per stage (stage._spentDrums; allocInkId at runtime, noRay).
- payWallet's bill event adds one small paper box on the counter (allocInkId).
6. Files touched: only src/player/* (Controller, Hands, HandRig (new), handClips, handPoses (new), Health, Viewmodel, Weapon) and src/debug/shots/L2_hands.js. Viewmodel no longer builds the gloves or sleeves (hands are Hands.js). It gained setFov(), study, reloadFreeze, flame, drumG falling physics and the RELOAD table, plus a buildDrumGeometry export. reproject() now uses the VM camera's current fov, which is 50 for the gun sets, so muzzle and casing placement are unchanged. For non-gun sets the VM camera's fov follows the main camera.

## Golden table

```
preset           verdict         px%    px>8%     mean    blk16  changed box (px>8)
street           IDENTICAL 
street_t8        IDENTICAL 
lamp             IDENTICAL 
cars             IDENTICAL 
carside          IDENTICAL 
hood             IDENTICAL 
hoodstudy        NO CAPTURE   (a headless capture hung for 20 min while the machine was shared; recaptured alone: hoodstudy IDENTICAL)
hooddeath        IDENTICAL 
hoodwalk         IDENTICAL 
hoods            CHANGED       2.217    1.941    2.056   228.54  (429, 618, 1152, 899)
viewmodel        CHANGED       2.254    1.928    2.043   220.01  (429, 618, 1156, 899)
reload           CHANGED       2.620    2.041    1.618   237.43  (602, 576, 1136, 899)
impacts          CHANGED       2.204    1.915    1.956   219.37  (429, 618, 1153, 899)
muzzlesmoke      CHANGED       2.103    1.777    1.789   217.95  (442, 618, 1152, 899)
battle_t15       CHANGED       2.059    1.734    1.985   225.98  (426, 619, 1151, 899)
battle_t30       CHANGED      82.524   67.149   59.506   249.32  (0, 0, 1439, 899)
battle_t45       CHANGED      90.533   81.069   68.191   249.34  (0, 0, 1439, 899)
wreck_t2.9       IDENTICAL 
wreck_t3.1       IDENTICAL 
wreck_t3.4       IDENTICAL 
wreck_t8         IDENTICAL 
wreck_t40        IDENTICAL 
train_t6         IDENTICAL 
havoc            IDENTICAL 
storm            IDENTICAL 
perf             CHANGED       2.047    1.738    1.586   176.59  (432, 623, 1146, 899)
title            IDENTICAL 
end              CHANGED      63.491   41.979   15.274   137.96  (0, 0, 1439, 899)
11 of 28 frames changed without being allowed
```
