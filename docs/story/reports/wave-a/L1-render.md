# Wave A lane report: L1-render
- branch: `wave-a/L1-render`
- last commit: `43c24c7`
- worktree: `/Users/evansmac/Downloads/eprojects/noirextreme/.claude/worktrees/wf_1ce98cce-975-1`

## Items

### P0.1 reflections that lie on the street (done)

I replaced the 40-tap screen-space column with sheens that lie on the ground. Step 2 now works like this. The emitter-only mirror is rendered in two parts plus one extra pass. Pass 1: the world, with its depth. Then a copy of that light. Pass 2: the sprites (fire, blood, sparks, Hood flashes). Pass 3: a depth-only redraw of the sprites into rtSpriteZ, with their depth writes forced on for that pass only. A position pass (shaders/reflstreak.js) gives each bright texel a world position E. It uses the mirror's own depth, or the sprite depth where sprites supplied most of the light, or a near-weighted mip / up-column pull when neither has a value. A splat pass then draws one instanced quad per texel, lying flat on the street plane. Each quad runs from the foot F toward the eye for L = clamp(1.1h+1.5,1.5,9) m. Its width is the texel's footprint and grows 6 % per metre run. It is brightest in the first third and fades smoothly to 0 at L, with a Gaussian across, and quads are MAX-blended. The ground reads the result in the same ruv space as before, so the ripple dashes, the vertical dry-brush break-up, the ink blots and the fire/blood handling are untouched. Other changes: the mirror frustum now covers from the horizon to 60 deg below it, so near lamp heads are captured. Cones are no longer in the mirror. The player's REFL_ONLY flash stand-in is left out: its sheen would sit under the eye, and its point light still lights the street. The sharp puddle mirror and the coverage cut (upside-down dark silhouettes) are removed. Ground tone thresholds were retuned so the fade prints over the whole length. Measured in reflstudy, gap between foot and streak start / length on the ground / monotonic after the first third: lit window h 3.58: 0 m / 5.75 m (model 5.44) / yes. Post lamp h 5.62: 0 / 7.25 (model 7.68) / yes. Hanging lamp h 7.68: 0 / 8.5 (model 9.0) / yes. Headlight h 0.62: 0 / 2.0 (model 2.18) / yes. Burning wreck: 0 / 5.75 / NO, because the fire is many sources at 1.9-3.5 m with different feet, so its summed profile has bumps. Debug helpers: __noir.pipeline.probeEmitters(), probeStreak([x,z]), ?rt=pos, ?gdbg=10 (a green ground mask).

Presets:
- `shot=reflstudy`
- `shot=street`
- `shot=lamp`
- `shot=cars`
- `shot=wreck&t=8`
- `shot=wreck&t=40`
- `shot=hoods`
- `shot=train&t=6`
- `shot=viewmodel`
- `shot=reflstudy&gdbg=3`

Builder's own critique: The street frames are now much darker and emptier than the loved goldens. The far lamps' long columns are gone, as the brief asks. With L capped at 9 m, the el lamps in street/cars/train mostly leave short sheens hidden behind the parked cars. The train's windows leave almost nothing visible, and shot=cars has nearly no reflections at all. The near lamp's sheen in street reads a bit like a lit rectangle: a flat top edge at the foot, fairly uniform width, about 50 px wide at 8.6 m. The fire's sheen in wreck t=8/t=40 is mostly hidden under the car, so only a short orange fringe shows in front of it. Blood in the air now leaves almost no red flecks in hoods (the 'at most' is honoured, but maybe too little). A lamp overhead in the wreck presets leaves a big white splotch at the bottom-left. Its sheen is correct by the model (source within 8 m), but it reads as a paint blob. The mirror still pays for a full-scene render for sources only, since coverage is no longer used. Its alpha and uReflRemap are kept but unread.

### P0.2 the Look indoors and out (partial)

setLook now blends every numeric Look field over about 0.25 s of game time. It snaps on a frozen clock or a jump, and reflect/room switch at once. Fields applied: fog, exposure, rainOverlay, rain3d (U.uRain3d on the 3D rain and splashes), grain (ink uGrain), ambient (scales the scene's HemisphereLight from its own intensity), haze (U.uHaze) and reflect ('none' skips step 2). With the exterior Look the output is exact, which the golden table confirms: the exterior frames' numbers were identical before and after this commit. Dry volumes: up to 4 boxes are shared uniforms (uDryMin/uDryMax). The 3D rain and the splashes discard fragments inside a box, and the ground's rain rings are gated too. The rain now falls outside the diner glass, not in the room. Haze: when U.uHaze > 0, the cone march uses two octaves of world-anchored noise drifting up at 0.08 m/s, and the near-eye fade shrinks to 0.3-1.1 m. Interior surface classes: userData.inkSurface ('plaster','wood','lino','metal','cloth' plus aliases) is encoded in the id pass as the normal's length (k in 1..5, n*(1+2k)). The ink prints these surfaces calm. They stay banded, and the brush field's contrast follows the screen gradient of the lit tone, so strokes gather only on a pool's falling edge. There are no strokes on ceilings, no white slashes and no lift-outs, and wood takes the horizontal family. An untagged, non-figure surface inside a dry box defaults to plaster, so the stub room is already calm.

Presets:
- `shot=dinerlook`
- `shot=dinerlook¬ag=1`
- `shot=dinerwindow`
- `scene=diner&beat=settle`
- `scene=fight&beat=round1`
- `shot=dinerlook&pose=-13.2,5.5,0.9,0.25`

Builder's own critique: The Look blends over time, not over space in the doorway. Haze curls are hard to see in the stub room. The pendant cones (lane 5's lamp parameters) are big airbrushed fans rather than 'a cone you could put your hand into'. A flat-lit interior wall now reads close to a plain CG plane with a faint texture. The balance between 'calm' and 'brush strokes, never flat CG gradients' needs the AD's eye on the real room. About 15 % of the smooth tone still shows under the bands (brushAmt 0.85), so the counter front has a soft gradient at the bottom. The façade's pilaster reveals seen from inside (outside the dry box, untagged) still carry the heavy exterior slashes; lane 4/5 must tag them. I did not verify the stroke coverage on a wall numerically (the brief asks for under 10 %).

### P0.3 accents (partial)

accents.js: ember, flame and neon are core/rim emitters. They are hot where they face the eye and their own colour at the rim; uGain pushes the core toward 'hot', and material.userData.setGain(g) changes it live. Ember prints as a deep orange point with an orange core (245,161,78) and a deep rim (239,90,36). At gain 3 its core goes warm white (245,217,170) with a halo. Flame is a pale yellow tongue with an orange edge. Amber is keyed by class, not hue: the id pass gives any material with userData.accent==='amber' class 6. The ink prints it through its own path, honey (1,.6,.17) at display 0.5-0.72, and never takes the fire lift. Neon is cold blue, about #4da8ff through the ink, with a white-hot centre from the core term. A bloom whose blue clearly leads tints its glow blue, and it leaves a blue sheen in the wet street through the new reflection. Crew and blood print the reference red.

Presets:
- `shot=accents`
- `shot=accents&drag=1`

Builder's own critique: At rest the ember has no warm glow of a few pixels. Its halo is a thin paper-white ring (the ink's air-light lift-out), not an orange glow. A warm-glow fix would have touched the fire's print in the accepted wreck frames, so I left it. The flame's 'small warm-white light on the hand' is not provided: it needs a light or a hands-lane fake. The fire cone on the test card prints pale apricot rather than deep orange (existing fire path, unchanged). I have not seen the DINER neon sign itself: lane 4's stub sign is not neon yet.

### P1.1 glass you can see through (partial)

makeGlassMaterial({wet, side, tint}) is premultiplied glass, world-anchored on the pane plane, and independent of the geometry, so lane 3 can re-cut it. It has beads that sit, grow and vanish, one in four catching a small highlight. It has runners every ~13 cm that gather, break away fast then slow down, follow crooked paths and leave a fading trail with droplets, all deterministic in game time. It also has a grey Fresnel sheen at grazing angles, small vertical paper-white smears for the nearest 6 registry lamps (broken by the water), and a dim veil plus darker trails seen from the dry side. Rain detail fades beyond 7-12 m. glass.js is bound to the shared uniforms (clock, lamps, fog) through bindGlassUniforms, which createSharedUniforms calls.

Presets:
- `shot=glassstudy`
- `shot=glassstudy&t=12`
- `shot=dinerwindow`
- `shot=dinerfront`

Builder's own critique: The view through the glass is dimmer but not softer or bent: there is no scene copy or refraction offset. The runner trails' wiggle is a sum of sines and still looks a little regular. Several runners are visible at once as thin parallel wavy lines. I have not tested it against lane 3's broken pieces.

### P1.2 window light with rain shadows (done)

makeWindowLightMaterial({w,h,slats,strength}): an additive patch with soft edges and the pane's water shadows crawling down it (the same rain function, stretched). With slats > 0, a half-lowered blind shadows the upper half. userData.sweep(t0, speed) runs a bright bar across it in game time. Display lift is about 0.2 on a dark floor.

Presets:
- `shot=windowlight&dark=1&sweep=3.3`
- `shot=windowlight&dark=1&sweep=3.3&pose=-13.2,-0.5,0.2,-0.5`
- `shot=windowlight`

Builder's own critique: On a floor already lit by the pendants the patch is almost invisible (shot=windowlight). Bead shadows print as a scatter of dark dots, close to splatter. The caller must shape the perspective quad itself: the preset builds a trapezoid by hand.

### P2 rooms behind far windows (partial)

makeRoomMaterial({seed, lit, depth}): an interior-mapped box behind a pane in the pane's own frame, with the eye position set per draw in onBeforeRender. It has a dark back wall with a pool when lit, darker side walls, floor and ceiling, a hashed door crack of light, and a curtain edge.

Presets:
- `shot=roomstudy&lit=1`
- `shot=roomstudy`

Builder's own critique: Unlit rooms print pure black (invisible on the black façade). Lit ones print as a mostly flat grey plate, and the depth steps barely survive the ink's bands. I only tested them on panes laid over the façade (the study preset), not on lane 3's breaking windows.

## Intended golden changes

All 28 frames change, as the brief intends for P0.1 ('every exterior frame, on the ground only'). title and end show the street under their cards. I proved the changes are on the ground with a mask: gdbg=10 prints the street and pavements pure green, dilated 2 px, and shots/l1/groundmask.py counts the changed pixels inside and outside it. On-ground vs off-ground changed pixels: street 98978/51, street_t8 102972/8, lamp 45375/0, cars 157347/2, carside 222213/0, hood 95637/46, hoodstudy 210448/0, hooddeath 239259/6, hoodwalk 207355/0, hoods 81693/5, viewmodel 67213/8, reload 72520/491, impacts 67961/9, muzzlesmoke 68817/56, battle_t15 171345/20, battle_t30 151011/7, battle_t45 166147/5, wreck_t2.9 149066/20, wreck_t3.1 265843/54, wreck_t3.4 192708/10, wreck_t8 169161/19, wreck_t40 149981/5, train_t6 154470/69, havoc 56408/52, storm 92928/226, perf 134967/146, title 60588/0, end 111726/4463. The off-ground stragglers differ by 1-4 levels at most (reload max 4, train_t6 1, wreck_t40 1, wreck_t2.9 2). They are the bloom halo of the changed street light spreading onto neighbouring pixels, plus ground under lit mist or smoke where the mask colour washes out. end's 4463 are under its semi-transparent card, where the green mask is tinted and fails the test. Sky, el, façade, cars, figures and the gun are otherwise identical. The P0.2-P2 commit left the exterior frames exactly as the P0.1 commit had them (same px% on every frame), so the Look, dry-volume, interior, accent and glass work moved no accepted pixel. Why the ground changed, all intended by P0.1: the long columns are replaced by sheens that start at each emitter's foot, run toward the eye and fade within L; the sharp puddle mirror and the mirrored dark silhouettes (coverage) are removed; the column thresholds were retuned so the fade prints; the cones and the player's flash stand-in no longer feed the reflection.

## Errors

Clean (ERRLOG: (clean), 2-3 frames rendered) on: shot=reflstudy, shot=accents&drag=1, shot=dinerlook, shot=dinerwindow, shot=glassstudy&t=12, shot=windowlight&dark=1&sweep=3.3, shot=roomstudy&lit=1, scene=diner&beat=settle, scene=fight&beat=round1, shot=street, shot=wreck&t=40. npm run build succeeds (only the existing chunk-size warning).

## Frame rate

The machine was busy for every measurement (GPU 71-72 % busy before each run, other lanes rendering), so none of these are clean benchmarks. After the change: UNCAPPED=1 node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900 gives 81.4 fps, p95 13.4 ms, 609 calls, 2.31 M tris (flagged BUSY). __noir.gpuProfile, perf, before -> after under similar load: refl 3.34 -> 3.20 ms, reflPost (bright + streak / bright + positions + splat) 1.90 -> 1.88 ms. The refl/id ratio stayed about 1.25 across runs. I did not get a clean before fps number. The added work per frame: a luminance copy of the half-res mirror, a second render call for the FX_REFL sprites, a depth-only redraw of those sprites, a quarter-res position pass, and a ~101k-instance splat, where most instances are culled in the vertex shader. That replaces the old 40-tap x 5-fetch streak. The mirror target is 1.25x the rows of the old half-res target but no longer renders the cones.

## Contract deviations

- CONTRACTS §9.1: the Look is blended over time (about 0.25 s of game time as the eye crosses a volume boundary), not spatially across the doorway. stage.lookAt still switches by volume.
- §9.2: pipeline.setDry(boxes) is a new API; up to 4 boxes are used. Until the Game calls it, the pipeline reads globalThis.__noir.game.stage.dry each frame. That is an adapter in my own file, and L7 should call pipeline.setDry(stage.dry) on stage:enter.
- The ink treats any untagged, non-figure surface inside a dry box as 'plaster'.
- §9.3: amber is keyed by ink class 6. The id pass sets it from material.userData.accent === 'amber' (accentMaterial('amber') does this).
- Surface classes ride on the id pass's normal length: userData.inkSurface on the mesh or on material.userData.
- The reflection no longer includes LAYER.VOLUME (cones, headlight beams, the train's shafts) or LAYER.REFL_ONLY (the player's flash stand-in). The rtRefl alpha (coverage) is no longer read by the ground.
- The mirror camera's projection is now its own off-axis window. U.uReflMatrix still maps the street to the view's own window. The new shared uniform U.uReflRemap maps that to the mirror texture.
- accentMaterial for ember, flame and neon now returns a ShaderMaterial (unlit, skinning-safe) with material.userData.setGain(g), not a MeshBasicMaterial.
- makeWindowLightMaterial adds a `strength` option.

## For the integration agent

Merge notes for wave-a/L1-render (2 commits on 9aafdfe, files only in src/render/** and src/debug/shots/L1_render.js):
1. Golden frames: all 28 change on the ground only (intended by P0.1). The AD must accept them after reviewing: shots/l1/*_sheet.jpg in this worktree are golden|new side-by-sides, and shots/check/diff_*.jpg. Lanes merged after this one will diff against the old goldens, so their ground pixels will all show as changed unless the new goldens are accepted first.
2. L7 (Game/main.js): call pipeline.setDry(stage.dry) on stage enter. Until then my adapter reads __noir.game.stage.dry. pipeline.setLook(stage.lookAt(eye)) should keep being called every frame, and render(scene, camera, time) must keep receiving game time, because the blend uses it.
3. L5: tag interior meshes with mesh.userData.inkSurface = 'plaster'|'wood'|'lino'|'metal'|'cloth' (aliases: wall, ceiling, panel, floor, enamel, chrome, leather, fabric), or set it on material.userData.inkSurface. Anything untagged inside the diner's dry box prints as plaster. Use accentMaterial('amber') for the scotch liquid; the id-pass class depends on it. Pendant cones get the smoke automatically from Look.haze. Their size and intensity (lamps.addCustom params) decide whether they read as a small soft cone.
4. L4/L5: the pilaster reveals and inner façade faces seen from inside lie partly outside the room's dry box and still carry the exterior slashes. Tag them, or extend the dry box.
5. L2/L3/L5: ember material: accentMaterial('ember').userData.setGain(3) during a drag. The flame's warm light on the hand is not provided by me.
6. L3: makeGlassMaterial is geometry-independent (world-anchored on the pane plane), so it survives re-cutting into pieces. Panes stay on LAYER.FX.
7. Any lane that draws something bright near the street should know it gets a sheen automatically if it is on LAYER.WORLD or FX_REFL. Sprites (depthWrite false) are placed by their own depth, via a forced depth-write redraw of FX_REFL objects each frame (the pipeline toggles material.depthWrite/colorWrite temporarily, only during that pass).
8. New debug hooks: pipeline.probeEmitters(minLum), pipeline.probeStreak([x,z], step), pipeline.readTarget(rt), ?rt=pos, ?gdbg=10 (green ground mask). My helper scripts are under the git-ignored shots/l1/ (cmp.py, groundmask.py).
9. No files outside my ownership were touched. No new lights and no new dependencies.

## Golden table

```
preset           verdict         px%    px>8%     mean    blk16  changed box (px>8)
street           CHANGED       7.641    4.940    5.268   227.05  (351, 515, 1439, 899)
street_t8        CHANGED       7.946    5.233    5.519   226.87  (359, 515, 1439, 899)
lamp             CHANGED       3.501    2.329    2.141   205.93  (489, 675, 1439, 899)
cars             CHANGED      12.141    8.608    7.603   225.10  (0, 412, 1439, 899)
carside          CHANGED      17.146   13.368   10.690   218.02  (0, 458, 1439, 899)
hood             CHANGED       7.383    4.779    5.114   227.05  (351, 515, 1439, 899)
hoodstudy        CHANGED      16.238   10.286   10.048   219.40  (0, 378, 1439, 899)
hooddeath        CHANGED      18.462   11.807   12.197   227.28  (0, 375, 1439, 899)
hoodwalk         CHANGED      16.000    9.862    9.273   227.40  (0, 380, 1439, 899)
hoods            CHANGED       6.304    4.270    4.419   203.18  (351, 517, 1439, 899)
viewmodel        CHANGED       5.187    3.312    3.368   192.96  (347, 515, 1439, 899)
reload           CHANGED       5.634    3.466    3.538   197.44  (351, 515, 1439, 899)
impacts          CHANGED       5.245    3.328    3.388   195.31  (351, 515, 1439, 899)
muzzlesmoke      CHANGED       5.314    3.402    3.504   227.05  (351, 514, 1439, 899)
battle_t15       CHANGED      13.223   10.088   11.079   232.36  (0, 445, 1439, 899)
battle_t30       CHANGED      11.653    7.421    7.699   198.07  (0, 452, 1439, 899)
battle_t45       CHANGED      12.820    7.774    7.848   198.11  (0, 458, 1439, 899)
wreck_t2.9       CHANGED      11.504    7.211    6.893   203.31  (24, 522, 1439, 899)
wreck_t3.1       CHANGED      20.517   14.474   15.280   207.75  (0, 516, 1439, 899)
wreck_t3.4       CHANGED      14.870   10.041   11.634   209.80  (24, 521, 1439, 899)
wreck_t8         CHANGED      13.054    8.597    9.184   200.49  (25, 522, 1439, 899)
wreck_t40        CHANGED      11.573    7.525    8.014   199.04  (25, 522, 1439, 899)
train_t6         CHANGED      11.924    8.684   10.042   227.47  (359, 515, 1439, 899)
havoc            CHANGED       4.356    3.006    3.074   227.03  (391, 515, 1439, 899)
storm            CHANGED       7.188    4.509    2.829   192.25  (338, 518, 1439, 899)
perf             CHANGED      10.425    6.850    7.333   239.49  (66, 453, 1438, 899)
title            CHANGED       4.675    3.224    2.957   186.34  (386, 538, 1439, 899)
end              CHANGED       8.965    5.705    3.312   122.57  (413, 460, 1439, 899)
28 of 28 frames changed without being allowed
sheets: shots/check/diff_<name>.jpg (golden | capture | difference)
```
