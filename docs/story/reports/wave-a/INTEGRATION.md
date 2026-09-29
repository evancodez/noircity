# Wave A integration report

- branch: `wave-a/integration`
- last commit: `f08ba93`

## Defects (the integration builder's list)

- **major** | L1-render | The DINER neon prints as a large solid translucent blue slab (a tall rectangle beside/around the letters, far bigger than the tube) when the sign is seen at a grazing angle from up or down the avenue; head-on (title, dinerfront) it is fine. Likely the minPx widening along the view normal plus the blue bloom tint on edge-on tubes.
  - how to see: `?shot=street&pose=-3,-40,3.0,0.02,40 (blue slab ~70x200 px left of the blade sign); ?shot=street&pose=-3,26,0.45,0.02,40 and pose=-3,34,0.33,0.02,40 (blue block round the letters, blue bar by the blade sign). Tubes are accentMaterial('neon', { tube: 0.009 }) on LAYER.WORLD as lane 1 asked.`

- **major** | L3-destruction | The cigarette's smoke thread (fx.cig.wisp) close to the eye reads as a thick solid white rope/tube running from the tip to the top of the frame in every seated beat after the light-up; it does not thin, grey or break up by ~0.5 m.
  - how to see: `?shot=diner_pour, ?shot=diner_drink, ?scene=diner&beat=drink, shots/check/play_slice/s06_pour.png, s08_sip.png, s10_his_line.png (called every step with key 'player' as lane 3's API asks).`

- **major** | L5-interiors (needs a restore from L3) | d.reset() does not restore what lane 3's breakables broke: a broken stool stays hidden and broken, the pie case's four glass panes stay hidden and its pie stays gone (slid out into the scene), lane 3's pieces stay on the floor. So a lost round in rounds 2-3 (onRetry -> stageRound -> dinerRoom -> d.reset) or a second BEGIN after the slice replays in a broken diner. Lane 3 has no breakables.restore(handle).
  - how to see: `node tools/evalpage.mjs "scene=fight&beat=round2" 720 450 "(()=>{const S=__noir.game.stage,d=S.part('diner'),B=S.breakables,st=d.stool(7),V=st.object.position.constructor;B.hit(st.handle,{point:st.object.getWorldPosition(new V()),dir:new V(1,0,0),power:9,by:'body'});B.hit(d.pieCase.handle,{point:d.pieCase.group.getWorldPosition(new V()),dir:new V(1,0,0),power:9,by:'body'});d.reset();return [st.object.visible, st.handle.broken]})()" -> [false, true]; pie-case glass meshes all visible:false.`

- **minor** | L1-render | The neon's sheen on the wet pavement prints as a broad blotchy blue wash/slab under the front, not the broken blue flecks under the sign the fix round describes.
  - how to see: `?shot=dinerfront, ?shot=dinerwide, ?shot=title (blue slab on the pavement below the sign), ?shot=neonstudy.`

- **minor** | L1-render (with L5 props) | Amber prints as a flat saturated orange, not a rich honey darker than fire: the scotch bottle in Dot's hand reads as a big flat orange cylinder with no glass or shading, the back-bar scotch as a flat orange rectangle, the sipped tumbler as a flat orange disc.
  - how to see: `?scene=diner&beat=order&press=KeyE@0.3&t=5.8 (Dot pouring), ?shot=handclip&clip=sip&ct=1.1, ?scene=diner&beat=settle (back bar).`

- **minor** | L7-story | Beat framing does not survive lane 2's seated lean (the eye 0.3 m forward over the counter): in the drink beat the tumbler is below the frame under the left forearm; in the pay beat Mack (stool 6) is 68 degrees off the view axis and out of frame, so the frame shows Dot and the cook, not 'the big man two stools down'. The pay/drink setup turn and pitch need retuning.
  - how to see: `?scene=diner&beat=drink (no glass visible; glass is at -14.47,1.2,4.3 with the eye at -14.06,1.6,4.1, pitch -0.26); ?scene=diner&beat=pay and ?shot=diner_pay / ?shot=diner_rise (no Mack until the rise camera turns).`

- **minor** | L4-street | Frame-rate cost of the street lane: shot=perf fell from 85.4 to 79.3 fps (-7.1 %, over the 5 % budget) at its merge, draw calls 649 -> 820 (bounds, city, shops, dressing are per-material meshes). The frame is CPU-bound on submission (renderAvg ~ frame time).
  - how to see: `UNCAPPED=1 RUNS=3 node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900 on commit ba0d212 vs cddf2c8 (numbers in fps).`

- **minor** | L1-render (or L4 lanterns) | A works lantern near the eye at the south barricade leaves a round white paint blob on the road near the camera (the 'no blob at the feet' hold does not catch it: the lanterns have no lamp registry entry / proxy).
  - how to see: `?shot=street&pose=-3,34,0.33,0.02,40 (white disc bottom centre).`

- **minor** | L5-interiors | The room is hidden (group.visible false, no rays) whenever dinerInSight is false, i.e. beyond 30 m from the front or out of the frustum: from farther than 30 m the diner's glass shows a bare void. The building itself is always drawn (no far/near swap).
  - how to see: `?shot=street&pose=-3,-40,3.0,0.02,40 -> stage.part('diner').group.visible === false.`

- **minor** | L6-characters / L7-story | br_bottle (2.0 s: take 0.35, break 0.75 on the counter edge, thrust contact 1.6) is Brawl's repeated bottle attack, so by its data every bottle attack in rounds 2-3 replays the take-and-smash although the neck is already in his fist (not checked frame by frame).
  - how to see: `?scene=fight&beat=round2&anim=1 and watch his bottle attacks (brawl.him.clip === 'br_bottle').`

- **minor** | L2-hands | The sip never calls the tumbler's setTilt, so the amber does not run to the rim; the raised glass is a large orange disc seen from above (lane 2's own critique).
  - how to see: `?shot=handclip&clip=sip&ct=1.1, shots/check/play_slice/s08_sip.png.`

- **minor** | L5-interiors | The cigarette prop has no userData.setGlow, so the drag's ember flare is a mesh scale instead of lane 1's gain (the ember material is shared through the prop cache, so a per-prop setGain needs its own material).
  - how to see: `?shot=handclip&clip=drag&ct=0.8 (ember at gain 1, scaled).`

- **minor** | L7-story (sounds) | Sounds requested by name and not in Sfx (silent): lane 3 - ring, burst_water, burst_leak, sign_drop, awning_tear, neon_pop, break_saucer, break_mug, break_pieCase, break_crate, break_barrel, break_sign, break_pipe, break_awning, break_papers, break_thing, topple_barrel, topple_crate; lane 5 - jukebox_change. (bell, doorbell, register, jukebox_hit, hiss, break_bottle/tumbler/cup/plate/stool/table, topple_stool/table exist.)
  - how to see: `node tools/evalpage.mjs "shot=street" 400 300 "(async()=>(await import('/src/audio/Sfx.js')).SOUND_NAMES.join(' '))()"`

- **minor** | L4-street | The phone booth's glass is not registered with glass.addPane, so it keeps the old crack decal instead of lane 3's geometry-true glass (lane 3's note).
  - how to see: `Shoot the phone booth on the pavement (e.g. ?shot=street, walk to it) - no Shatter cut.`

- **minor** | L7-story (my wiring) | A retry into round 2 or 3 re-stages his broken bottle by breaking a fresh one in his fist, so the break_bottle sound and a few shards play under the black of the retry.
  - how to see: `Lose round 2 (take hits without blocking) and listen as the round restarts.`

## Merges

### L1-render (a1232fe; merge 6ca9f64, wiring ba0d212)

- conflicts: None.
- wiring: src/game/Game.js enterStage: pipeline.setDry?.(stage.dry) and pipeline.setLamps?.(stage.lamps ?? null) before 'stage:enter' (replaces lane 1's __noir adapters for the stage in play). Survived the L7 merge unchanged.
- gate: npm run build OK (chunk-size warning only). errors.sh clean on street, hoods, battle&t=30, wreck&t=8, title, scene=diner&beat=settle, scene=fight&beat=round1, reflstudy, accents&drag=1, dinerlook, dinerwindow, glassstudy&t=12, windowlight&dark=1&sweep=3.3, roomstudy&lit=1, vmtone, vmtone&where=street, neonstudy, wreck&t=40, train&t=6. Golden: 28/28 CHANGED vs accepted goldens; ground-mask test (gdbg=10, dilated 3 px, px>8): every changed pixel is on the ground in 26 frames; stragglers wreck_t3.4 2 px, storm 11 px (ground seen through mist), end 1805 px (under the semi-transparent end card where the key fails). Sky, el, facade, cars, figures, gun identical.

### L4-street (4b8fb34; merge fa43c6b, wiring cddf2c8)

- conflicts: None.
- wiring: src/stages/block/parts/dinerFront.js: the DINER letters and underline use accentMaterial('neon', { tube: NEON_R }) and stay on LAYER.WORLD with userData.inkId = idNeon (were LAYER.FX with the plain accent); lane 4's hand-made additive neon sheen patch on the pavement removed (letters.sheen = null, setOn guarded). Shop panes / diner panes / window-light patches already call lane 1's makeGlassMaterial / makeWindowLightMaterial (now real); lane 4's stub-only fall-off branch ('windowLightStub') no longer fires.
- gate: build OK; errors.sh clean on the 7 gate queries plus dinerfront, dinerwide, dinerdoor, boundS/E/N/W, elfar, elplan, skyline, skylineE, skylineT&lightning=1, shoprooms, shoproomsUp, dressing, steammain, lamp, storm, train&t=40, scene=fight&beat=outside, neonstudy. Golden: 28/28 CHANGED. Delta vs the L1 stage, masked by the ground and by lane 4's own lane-only diff (its worktree captures, dilated 4 px): all changes lie on the ground or where lane 4 changed its own frames (far distance, east side, far el, the left shop windows); only leftover is 540-690 px at the left edge (x 0..230, y 283..751) in street/street_t8/lamp/hood/reload/muzzlesmoke/havoc/title and 3858 px in storm: lane 4's pawnbroker shop pane now printed with lane 1's real glass (beads, a lamp smear, a grazing sheen) instead of the stub glass - intended combination of L1 glass + L4 shop window. battle_t15/30/45 and end diverge whole-frame (lane 4's new solids take stray rounds: intended by L4).

### L5-interiors (accda9f; merge 15e15da, wiring 94e4e6e)

- conflicts: None.
- wiring: src/stages/block/parts/dinerFront.js: two extra stage.dry boxes over the front wall's thickness between the room (x -10.45) and the plate glass (x -10.12), z -6.25..B3 south edge and B3 north edge..11.85, floor to ceiling (the door bay's vestibule left out: open to the street). The pilaster reveals and inner facade faces behind the glass now print calm (lane 1: untagged in a dry box = plaster) instead of the facade's white slashes, and no rain falls behind the glass (checked before/after at eye -12.5,1.75,-4.5). Lane 5 already tags every room mesh with inkSurface and uses lane 1's window-light material.
- gate: build OK; errors.sh clean on the 7 gate queries plus every L5 preset (propsheet + 9 variants, diner_seat/left/right/wide/booth/out, diner_alive, &t=3.9, the three &train=1, the three &eye= views, scene beats diner order/drink/pay, fight round2/round3, dinerfront). propsheet and propsheet&kind=wallet... hung once in headless Chrome (0 % CPU), clean on retry. Golden: 28/28 IDENTICAL to the L4 stage (L5 intends none), also after the dry-box wiring.

### L3-destruction (19f766b; merge 1f33422, wiring cc824a3)

- conflicts: None.
- wiring: src/stages/block/parts/dressing.js: steam main registered with { fluid: 'steam' }; TAILOR/BARBER sign groups re-based so their origin is the bracket line (local x along it) and registered with { w: 0.95, h: 0.6 }; newsstand kind 'paper' -> lane 3's 'papers'; each overhead wire registered with its two pinned ends { a, b } (src/world/Props.js wires() now keeps them in mesh.userData.ends; without them a hit threw on A.clone()); awning registered with its { w, d }. src/stages/block/parts/dinerFront.js: awning re-based (origin on the roll's axis, local x along it, +z to the street) for lane 3's awning dump; and its roll was rotated the wrong way (it ran from z -1.8 to -11.0, past the end pilaster): rotateX(+PI/2) so it runs over B2..B3 with its flap. src/destruct/Glass.js: the black backing behind a shared facade pane is hidden when the owner opened a room there (pane.roomOpen), and parts/shops.js hides it at once when Facade.openRoom succeeds (the old paneHole covered lane 4's upper rooms). src/props/diner/counter.js: the pie case's four glass planes are separate meshes flagged userData.glass (were one merged mesh: lane 3's pieCase break could not find or hide them). New src/fx/ground.js groundY(stage, x, z, y): stage.surfaceY inside a dry volume, Street.groundAt outside; Impacts, Explosion (5 calls), Casings, Blood (3 calls) use it. Runtime test: bullets on both signs, the awning, two wires (cut), papers, all five pipes, and a body into the pie case: all answer, errlog empty.
- gate: build OK; errors.sh clean on the 7 gate queries plus all 60+ L3 presets (wreck t=2.9 and all 16 wreckkind A-D times, wreckstudy x5, wreck&t=40, glassstudy2 x6, windowman x2, breakstudy x21, streetstudy x4, impacts, havoc, perf, end) and shoprooms/shoproomsUp/dressing/steammain/dinerfront/diner_wide. Golden vs the L5 stage: changed exactly lane 3's list (impacts, battle_t15/30/45, wreck_t2.9/3.1/3.4/8/40, havoc, perf, end); every other frame IDENTICAL. Changed pixels outside the ground and outside lane 3's own lane-only diff: 0 in impacts, wreck_t2.9, wreck_t3.1; 56-675 px in wreck_t3.4/t8/t40/havoc/perf at the left shop window (lane 4's pane under lane 3's light); battle_t30 had no lane-3 reference capture (its lane run hung), battle/end are whole-frame divergences as intended.

### L6-characters (755e83e; merge b0f1a41, wiring 11fb992)

- conflicts: None.
- wiring: src/cast/Cast.js: removed the cook's forced x = backX - 0.42 (it put him behind lane 5's lit kitchen back wall at x -17); he now stands at lane 5's 'diner.hatch' anchor (x -16.73) inside the kitchen box and shows through the hatch (checked in diner_seat). Unused DINER import dropped.
- gate: build OK; errors.sh clean on the 7 gate queries plus every L6 preset (caststudy x2, castlab x21, castdiner cview 0-4, brawlstudy x11, brawlstrip x4) and the scene beats. Golden: 28/28 IDENTICAL to the L3 stage (L6 intends none).

### L2-hands (2c92c58; merge bde9f74, wiring 3818f21)

- conflicts: None.
- wiring: src/player/Hands.js: material tags for lane 1's viewmodel classes: bare 'skin', cuff 'paper', sleeve 'cloth' (if untagged), glove 'metal' (keeps the gloves at the gun's 0.28 ceiling as in the goldens). hands.hold now maps a held prop's room surface class to the hands' classes (prop_paper/paperLight/atlas/atlasDecal/china -> paper; prop_glass/glassThick/glassDark/bottleDark -> glass; metal/enamel/chrome -> metal; cloth/leather/wood/lino -> cloth; accents untouched) as a mesh-level userData.inkSurface, saved in _handSave and restored on release. The bill laid on the counter (a world mesh using the cuff material) gets inkSurface 'plaster'. Result: bare hands, cuffs and cigarette paper print light/paper white (checked handclip lightUp/sip/payWallet/guard).
- gate: build OK; errors.sh clean on the 7 gate queries plus all 46 L2 presets (handstudy x8, reload x6, handreload, handclip x21, viewmodel, vmtone x2, scene=fight&beat=matchbook). Golden vs the L6 stage: changed exactly lane 2's list (hoods, viewmodel, reload, impacts, muzzlesmoke, battle_t15, perf inside the hands/sleeve box x 426..1156, y 576..899; battle_t30, battle_t45, end whole-frame); 0 changed pixels outside ground + lane 2's own diff in every in-frame preset (battle_t15 7 px).

### L7-story (9ed8b99; merge 6d22dc0, wiring f08ba93)

- conflicts: None (my Game.js setDry/setLamps lines merged cleanly with lane 7's Game.js).
- wiring: src/scenes/01_diner.js: lightUp - lane 2's clip takes pack, cigarette and lighter and puts them back itself, so the scene's stand-in cigarette at the 'lips' mark and its own lighter take/hold/put were removed (marks now only sound + flags; flags.cig = hands.cigarette()); fx.cig.wisp(tip, 'player') called every step while lit (lane 3's thread wants every step; was every 0.32 s); sip no longer hands.hold()s the glass a second time (lane 2's reachGlass/sip take it); Dot fetches the old man's plate at the pass beside 'diner.bell' from the service aisle (lane 5's 'diner.hatch' is now the cook's spot inside the kitchen); the coffee pot goes back to where it stood. src/scenes/_diner_room.js: cook setState('hatch'); the docker takes 'mug.docker' off the counter into his hand (lane 6's sitDrink); door 'open' also calls game.cast.attention(door). src/scenes/02_fight.js: breakInFist() - his bottle is broken through lane 3's Breakables with neck:true and the jagged 'bottleNeck' is re-held ('hang' grip) and armed (round two, and any jump/retry into rounds 2-3); duplicate break_bottle sound removed; round three calls mack.bleed(1) and capLoose = true (script and stageRound); pie case position taken from lane 5's pieCase.group (was undefined: the throw into the pie case could never fire). src/game/Brawl.js: controller.slip no longer driven (lane 2's slipL/R move the eye through viewFx; it would double); tryThrow turns his back to the target before br_into_*; stepKO rewritten: the stand-in flight (c.place + object position/rotation.x every step, deathBack on landing) removed, lane 6's br_ko_window carries him to diner.pavement.ko by root motion, landing sound/shake on the clip's 'land' mark, c.ko() after the clip (breathing 'ko' loop), brawl:end at max(land+1 s, clip end). tools/playtest.mjs updated to the story flow (BEGIN; real beats; walk mode set from the page since X is gone; 2.6 s reload; end card without counters; try again back on the stool at 'pay'; E pay into the fight). Verified at runtime: round two jump holds kind 'bottleNeck', brawl.him.bottle set, br_bottle attacks fire.
- gate: build OK; errors.sh clean on all L7 presets (title, end, diner_settle..diner_rise, fight_round1..fight_matchbook incl. fight_ko&t=0.45/1.4, the four &hud=1 card/say variants, scene=diner&beat=settle&puzzle=demo, all 10 scene beats, scene=fight&beat=ko&t=3). shot=street&audiotest=1: 87 sounds render, no errors. Golden vs the L2 stage: only title and end changed (lane 7's intended; end's changed box (106,86)-(1344,708) is the card). playtest 23/23, play.mjs slice.json 17/17, continue.json 7/7, autoplay.json 2/2.

## Changed golden frames

Method: after each merge I captured all 28 presets and diffed against the previous stage (not only the goldens), masking by the ground (gdbg=10 key, dilated 3 px, px>8) and by the merged lane's own lane-only diff from its worktree captures (dilated 4 px).
- street, street_t8, lamp, cars, carside, hood, hoodstudy, hooddeath, hoodwalk, train_t6, storm: L1 (ground only: reflections v2) + L4 (far distance, rail yard / fence / roofscape through the east arches, far el and terminus, the left shop windows now pawnbroker room / shutter, plinth contour dashes, storm's layered towers, carside's board-fence contour). Confined as the briefs say. Only non-attributed pixels: 540-690 px at the left edge (x 0..230, y 283..751) = lane 4's shop pane printed with lane 1's real glass (beads, lamp smear, grazing sheen) instead of the stub - the intended combination of both lanes; storm 3858 px same window. The Hoods' frames change nowhere but the ground (L1), the background (L4) and, for hoods, the hands (L2).
- hoods, viewmodel, reload, impacts, muzzlesmoke: L1 ground + L4 background + L2 inside the hands/sleeves box (x 426..1156, y 576..899; gun and flash identical); impacts also L3 (geometry star crack in the shop window, stone crater, glass bits lower left: 0 unexplained pixels). All as briefed.
- wreck_t2.9/t3.1/t3.4/t8/t40: L1 ground + L4 background + L3 (75 % warning smoke, kind B blast, the see-through wreck, the fuel sheet). As briefed; stragglers 56-675 px at the left shop window (lane 4's pane under lane 3's fire light).
- havoc: L1 + L4 + L3 (real star cracks and cut holes in the facade windows, x 0..571). As briefed.
- battle_t15, battle_t30, battle_t45, perf: whole-frame divergence, intended by L3 (cars by bullet count, blasts chain), L4 (new solids take stray rounds, the diner panes are the diner's) and L2 (the 2.6 s reload shifts the autopilot; t15 and perf changed only in the hands at the L2 step). At the final build battle_t30 looks at the facade in a lull (less lively than the golden, as lane 2 reported).
- title: L1 ground + L4 background at first, then L7 (the whole new title over the live diner). As briefed.
- end: L1/L2/L3/L4 divergence of the 3D frame underneath + L7 (card without the kill counter; the L7 step changed only the card box).
No frame changed at the L5 or L6 merges (both intend none): 28/28 IDENTICAL to the previous stage, including after my wiring commits.

## Plays

node tools/playtest.mjs: 23/23 PASS after updating its checks to the story flow (title BEGIN, real beats settle->order->drink x3->pay, walk mode set from the page since the X key is gone, out through the door and back, the front wall stops him, mouse look, Tommy fire, R reload 2.6 s, M mute, pause/resume, death -> THE END without counters, try again back on the stool at 'pay' with the smoke set, E pay -> the fight in brawl mode with fists against the brawler, errlog empty).
node tools/play.mjs tools/plays/slice.json: 17 passed, 0 failed by real input - title, BEGIN, seated/smoke, diner sound bed, cigarette lit, F drag, 'Scotch. Neat.', glass poured full, Q spins the stool, three sips empty it, the fight started locked on him, fight won (landed 12, taken 1, blocked 2, slipped 4, throws 2, 26.4 s), out through the glass, walk out, matchbook shown and pocketed, 'To be continued', errlog clean. Screenshots: shots/check/play_slice/s00..s19.
node tools/play.mjs tools/plays/continue.json: 7/7 (CONTINUE after reload, checkpoint at the last blow, walk out, matchbook, end card back to the title with CONTINUE).
?autoplay=1 (tools/plays/autoplay.json, speed=2): plays the whole slice on its own - order 7.6 s, drink, pay, fight 108.9 s of game time (landed 21, taken 8, slipped 21, throws 2, downs 0, won), ko, outside, matchbook, state 'end'; 2/2 PASS, errlog clean. Shots in shots/check/play_autoplay.

## Frame rate

Quiet machine (fps.mjs flagged no run busy), UNCAPPED=1 RUNS=3, 1440x900.
Final build f08ba93: shot=perf&t=1&anim=1 76.7 fps (13.03 ms avg, p95 15.2, 815 calls, 2.84 M tris, CPU renderAvg 12.45 ms); scene=fight&beat=round2&anim=1 81.0 fps (p95 14.7, 1327 calls); shot=dinerwide&anim=1 92.2-93.6 fps (p95 12.0, 1432 calls). All above 60 with headroom.
shot=perf per merge stage (each stage exported and served on its own vite port, same session): foundation main 233a06e 87.6 (the foundation's 91 was a different session) -> L1 ba0d212 85.4 (-2.5 %) -> L4 cddf2c8 79.3 (-7.1 %, calls 649 -> 820: over budget, lane 4) -> L5 94e4e6e 79.8 (0) -> L3 cc824a3 78.8 (-1.3 %) -> L6 11fb992 78.9 (0) -> L2 3818f21 77.0 (-2.3 %) -> L7 f08ba93 76.7 (-0.5 %). Total -12.4 % against the foundation; lane 4's draw calls are most of it (note the perf fight itself diverges from L4 on).

## Notes

Where things are: branch wave-a/integration in /Users/evansmac/Downloads/eprojects/noirextreme. It has 7 --no-ff merges, each followed by its wiring commit; L5 has none of its own, since its dry-box wiring 94e4e6e comes after it. Nothing was pushed, main is untouched, golden.py accept was never run, and the lane worktrees were not edited. The dev server on 5173 is still running.

Captures in shots/check/ (git-ignored):
- the 28 golden presets with their diff_*.jpg;
- shots/check/presets/: all 256 lane presets and scene beats;
- shots/check/play_slice, play_autoplay, play_continue: the play screenshots.

errors.sh is clean on all 256 queries in the presets list, and on audiotest (87 sounds).

The diner is always drawn: lane 4 removed the far/near swap, and Facade.setNear is a no-op. Only lane 5's room contents hide beyond 30 m or out of view (listed as a defect).

What I see in the scene beats (full size, final build):
- **settle:** the real lane 5 room. The back bar has bottle silhouettes against the lit glass, the menu board, and the lit kitchen hatch with the cook's paper cap in it. Dot, in a white apron, leans at the urns on the left. My hands are bare and print light: the left forearm lies on the counter in a dark sleeve with a white cuff, and the right hand is by the pack and lighter. The scotch on the back bar is the only amber. There is no rain indoors: the 3D rain is depth-tested and dropped inside the dry boxes, the screen rain is 0, and the soft marks on the back wall are the world-space brush.
- **order:** Dot stands in front of me across the counter. The cigarette is in my right hand with an orange ember at the tip, and its smoke thread rises as a white rope (defect).
- **drink:** the room with my light hands and the lit cigarette. The tumbler is off-frame under the left forearm (defect). In the sip clip the glass comes up as an amber disc.
- **pay:** the hatch, Dot and the cook. Mack is out of frame (defect).
- **round1:** Mack is the real lane 6 brawler, squared up in the aisle under the pendant cones. He wears a flat cap, rolled sleeves and a waistcoat, with pale fists up. My bare fists are in the bottom corners, light. Rain falls beyond the plate glass on the right.
- **round2:** the same, with the jagged neck in his fist, lane 3's real break.
- **round3:** as round2, plus red blood at his mouth and on his shirt.
- **ko:** he is lifted over booth 4 by lane 6's clip toward the B4 glass. At t=1.4 the glass bursts outward in lane 3's pieces.
- **outside:** he is on his back on the wet pavement in the broken glass, with blood at the mouth. There is rain and a lit street.
- **matchbook:** my light bare hand holds the red THE CARDINAL matchbook with its black bird.

The amber (the scotch, the pour stream, the glass), the ember (the tip and its glow on the lighter clip) and the neon outside (the title and dinerfront) all print. The neon is wrong at grazing angles (first defect).

Two lane bugs I fixed because the fixes were one token each:
- lane 4's awning roll ran the wrong way, 9 m past the diner to z -11;
- lane 5/L7's pie-case throw could never fire (the pie case's position was undefined).

Tool edits (frozen files):
- tools/playtest.mjs: checks updated to the story flow.
- src/fx/ground.js: a new thin adapter file in lane 3's folder.

Wave B needs:
- lane 3: a breakables.restore;
- lane 7: the missing sounds;
- lane 1: the neon at grazing angles.

## Presets and beats that render clean

- `shot=street`
- `shot=street&t=8`
- `shot=lamp`
- `shot=cars`
- `shot=cars_v1`
- `shot=carside`
- `shot=car34`
- `shot=hood`
- `shot=hoodstudy`
- `shot=hooddeath`
- `shot=hoodwalk`
- `shot=hoodlab&hs=idle&hy=30`
- `shot=hoods`
- `shot=viewmodel`
- `shot=viewmodel&vmpuff=0.3`
- `shot=reload&vmreload=0.85`
- `shot=impacts`
- `shot=muzzlesmoke&smokeage=1`
- `shot=battle&t=15`
- `shot=battle&t=30`
- `shot=battle&t=45`
- `shot=wreck&t=2.9`
- `shot=wreck&t=3.1`
- `shot=wreck&t=3.4`
- `shot=wreck&t=8`
- `shot=wreck&t=40`
- `shot=train&t=6`
- `shot=havoc`
- `shot=storm`
- `shot=storm&strikeage=0.1`
- `shot=perf`
- `shot=title`
- `shot=end`
- `shot=start`
- `shot=reflstudy`
- `shot=reflstudy&gdbg=3`
- `shot=accents`
- `shot=accents&drag=1`
- `shot=dinerlook`
- `shot=dinerlook¬ag=1`
- `shot=dinerwindow`
- `shot=dinerlook&pose=-13.2,5.5,0.9,0.25`
- `shot=glassstudy`
- `shot=glassstudy&t=12`
- `shot=windowlight&dark=1&sweep=3.3`
- `shot=windowlight&dark=1&sweep=3.3&pose=-13.2,-0.5,0.2,-0.5`
- `shot=windowlight`
- `shot=roomstudy&lit=1`
- `shot=roomstudy`
- `shot=vmtone`
- `shot=vmtone&where=street`
- `shot=neonstudy`
- `shot=dinerfront`
- `shot=dinerwide`
- `shot=dinerdoor`
- `shot=boundS`
- `shot=boundE`
- `shot=boundN`
- `shot=boundW`
- `shot=elfar`
- `shot=elplan`
- `shot=skyline`
- `shot=skylineE`
- `shot=skylineT&lightning=1`
- `shot=shoprooms`
- `shot=shoproomsUp`
- `shot=dressing`
- `shot=steammain`
- `shot=train&t=40`
- `shot=propsheet`
- `shot=propsheet&kind=tumbler&fill=0.5`
- `shot=propsheet&kind=bottle&variant=scotch`
- `shot=propsheet&kind=lighter&open=1`
- `shot=propsheet&kind=matchbook&open=0.6`
- `shot=propsheet&kind=wallet&open=1&turn=1.57`
- `shot=propsheet&kind=cigarette&tip=ash`
- `shot=propsheet&kind=cigarettePack`
- `shot=propsheet&kind=ashtray`
- `shot=propsheet&kind=stool`
- `shot=diner_seat`
- `shot=diner_left`
- `shot=diner_right`
- `shot=diner_wide`
- `shot=diner_booth`
- `shot=diner_out`
- `shot=diner_alive`
- `shot=diner_alive&t=3.9`
- `shot=diner_wide&train=1`
- `shot=diner_left&train=1`
- `shot=diner_right&train=1`
- `shot=diner_seat&eye=-12.9,1.5,-3.6,0,-0.12,45`
- `shot=diner_seat&eye=-14.9,1.75,-3.2,-0.2,-0.2,60`
- `shot=diner_seat&eye=-13.0,1.75,9.6,3.14,-0.15,60`
- `shot=wreck&t=3.05&wreckkind=A`
- `shot=wreck&t=3.3&wreckkind=A`
- `shot=wreck&t=8&wreckkind=A`
- `shot=wreck&t=43&wreckkind=A`
- `shot=wreck&t=3.05&wreckkind=B`
- `shot=wreck&t=3.3&wreckkind=B`
- `shot=wreck&t=8&wreckkind=B`
- `shot=wreck&t=43&wreckkind=B`
- `shot=wreck&t=3.25&wreckkind=C`
- `shot=wreck&t=3.6&wreckkind=C`
- `shot=wreck&t=8&wreckkind=C`
- `shot=wreck&t=43&wreckkind=C`
- `shot=wreck&t=3.05&wreckkind=D`
- `shot=wreck&t=3.5&wreckkind=D`
- `shot=wreck&t=8&wreckkind=D`
- `shot=wreck&t=43&wreckkind=D`
- `shot=wreckstudy`
- `shot=wreckstudy&wk=A`
- `shot=wreckstudy&wk=B`
- `shot=wreckstudy&wk=C`
- `shot=wreckstudy&wk=D`
- `shot=glassstudy2&hits=1`
- `shot=glassstudy2&hits=4`
- `shot=glassstudy2&hits=12`
- `shot=glassstudy2&hits=all`
- `shot=glassstudy2&hits=all&age=0.12`
- `shot=glassstudy2&hits=all&age=3`
- `shot=windowman`
- `shot=windowman&age=0.35`
- `shot=breakstudy&kind=all&t=1`
- `shot=breakstudy&kind=bottle&t=2.02`
- `shot=breakstudy&kind=bottle&t=2.4`
- `shot=breakstudy&kind=bottle&t=5`
- `shot=breakstudy&kind=neck&t=2.4`
- `shot=breakstudy&kind=plate&t=2.4`
- `shot=breakstudy&kind=cup&t=2.4`
- `shot=breakstudy&kind=saucer&t=2.4`
- `shot=breakstudy&kind=tumbler&t=2.4`
- `shot=breakstudy&kind=stool&t=2.3`
- `shot=breakstudy&kind=stool&t=5`
- `shot=breakstudy&kind=topple&t=2.6`
- `shot=breakstudy&kind=topple&t=4.5`
- `shot=breakstudy&kind=table&t=2.6`
- `shot=breakstudy&kind=pieCase&t=2.4`
- `shot=breakstudy&kind=jukebox&t=2.05`
- `shot=breakstudy&kind=liquid&t=3`
- `shot=breakstudy&kind=pour&t=2.4`
- `shot=breakstudy&kind=cig&t=1.6`
- `shot=breakstudy&kind=cig&t=3`
- `shot=breakstudy&kind=punch&t=2.02`
- `shot=streetstudy&t=1.9`
- `shot=streetstudy&t=2.5`
- `shot=streetstudy&t=4`
- `shot=streetstudy&t=8`
- `shot=caststudy`
- `shot=caststudy&far=1`
- `shot=castlab&kind=brawler&hy=20&focus=0,2.0,0,1.6,40`
- `shot=castlab&kind=waitress&hy=0&focus=0,2.6,25,1.5,36`
- `shot=castlab&kind=docker&hy=0&focus=0,2.6,90,1.6,36`
- `shot=castdiner&cview=0`
- `shot=castdiner&cview=1`
- `shot=castdiner&cview=2`
- `shot=castdiner&cview=3`
- `shot=castdiner&cview=4`
- `shot=castlab&kind=brawler&hy=0&matchbook=1&blood=1&focus=0,1.9,20,1.6,40`
- `shot=castlab&kind=waitress&hs=carry`
- `shot=castlab&kind=waitress&hs=pour&t=4.4`
- `shot=castlab&kind=waitress&hs=serve&t=4.7`
- `shot=castlab&kind=waitress&hs=slide&t=4.5`
- `shot=castlab&kind=waitress&hs=duck&t=4.6`
- `shot=castlab&kind=oldman&hs=sitRead&hy=-140`
- `shot=castlab&kind=oldman&hs=cower&t=5.2&hy=40&focus=0,2.2,60,1.2,40`
- `shot=castlab&kind=brawler&hs=sitEat&hy=-130`
- `shot=castlab&kind=brawler&hs=rise&hy=-130&t=4.6`
- `shot=castlab&kind=brawler&hs=notice&hy=-150&t=5`
- `shot=castlab&kind=couple_him&hs=run`
- `shot=castlab&kind=docker&hs=watch&hy=30`
- `shot=castlab&kind=cook&hs=hatch&hy=30`
- `shot=brawlstudy&clip=br_guard&t=0.5`
- `shot=brawlstudy&clip=br_jab&t=0.2`
- `shot=brawlstudy&clip=br_hook&t=0.3`
- `shot=brawlstudy&clip=br_haymaker&t=0.3`
- `shot=brawlstudy&clip=br_bottle&t=1.0`
- `shot=brawlstudy&clip=br_stun&t=0.5`
- `shot=brawlstudy&hit=head&round=3&t=0.25`
- `shot=brawlstudy&clip=br_into_stools&t=1.5`
- `shot=brawlstudy&clip=br_ko_window&t=0.8`
- `shot=brawlstudy&clip=br_ko_window&t=1.05`
- `shot=brawlstudy&clip=br_jab&t=0.38&side=1`
- `shot=brawlstrip&clip=br_jab`
- `shot=brawlstrip&clip=br_hook`
- `shot=brawlstrip&clip=br_haymaker`
- `shot=brawlstrip&clip=br_bottle`
- `shot=castlab&kind=hood&hs=leanDoor&hy=40`
- `shot=castlab&kind=hood&hs=stepOut&t=4.6&hy=40`
- `shot=castlab&kind=hood&hs=sitCar`
- `shot=handstudy`
- `shot=handstudy&pose=guard`
- `shot=handstudy&pose=tommyL&orbit=270&orbitc=L`
- `shot=handstudy&pose=tommyL&orbit=0&orbitc=L`
- `shot=handstudy&pose=tommyL&orbit=90&orbitc=L`
- `shot=handstudy&pose=tommyR&orbit=90&orbitc=R`
- `shot=handstudy&orbit=0`
- `shot=handstudy&pose=lightUp@2.0`
- `shot=reload&vmreload=0.52`
- `shot=reload&vmreload=0.8`
- `shot=reload&vmreload=1.04`
- `shot=reload&vmreload=1.25`
- `shot=reload&vmreload=1.56`
- `shot=reload&vmreload=2.0`
- `shot=handstudy&pose=tommyReload@1.3&orbit=90&orbitc=L`
- `shot=handreload&clip=tommyReload&ct=1.25`
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
- `shot=diner_settle`
- `shot=diner_light`
- `shot=diner_order`
- `shot=diner_pour`
- `shot=diner_drink`
- `shot=diner_pay`
- `shot=diner_rise`
- `shot=fight_round1`
- `shot=fight_round2`
- `shot=fight_round3`
- `shot=fight_ko`
- `shot=fight_ko&t=0.45`
- `shot=fight_ko&t=1.4`
- `shot=fight_outside`
- `shot=fight_matchbook`
- `scene=diner&beat=settle&t=1&hud=1&card=chapter`
- `scene=diner&beat=order&t=1&hud=1&card=pause`
- `scene=fight&beat=outside&t=3&hud=1&card=cont`
- `scene=diner&beat=order&t=1&hud=1&say=Scotch.%20Neat.`
- `scene=diner&beat=settle`
- `scene=diner&beat=order`
- `scene=diner&beat=drink`
- `scene=diner&beat=pay`
- `scene=fight&beat=round1`
- `scene=fight&beat=round2`
- `scene=fight&beat=round3`
- `scene=fight&beat=ko`
- `scene=fight&beat=outside`
- `scene=fight&beat=matchbook`
- `scene=diner&beat=settle&puzzle=demo`
- `shot=street&audiotest=1`
- `?autoplay=1 (tools/plays/autoplay.json at speed=2)`
