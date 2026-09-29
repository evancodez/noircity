# Wave A lane report: L4-street
- branch: `wave-a/L4-street`
- last commit: `4b8fb34`
- worktree: `/Users/evansmac/Downloads/eprojects/noirextreme/.claude/worktrees/wf_1ce98cce-975-4`

## Items

### 0 diner always there (done)

The far/near swap is gone. world/Facade.js builds one near building with the diner's void, always drawn and always solid. The plinth is broken between the diner's end pilasters (z 11.6..-6.0). Facade.setNear() is kept as a no-op. site.js dinerInSight() is now a per-step result that dinerFront.update computes with dinerSightFrom(camera): true when the eye is inside, or when the front's box is in the camera frustum within 30 m (2 m hysteresis). parts/diner.js (lane 5) reads it to keep its pendants off the lamp pool and the room from casting shadows. The fire escape's drop ladder moved from z 0.2 to -2.2 so it clears the sign.

Presets:
- `shot=street`
- `shot=lamp`
- `shot=storm`

Builder's own critique: The accepted 'last-bit' promise is not quite met. Re-cutting the mass and plinth triangles toggles single contour dashes along the plinth and building base. Measured at step 0 alone: street 0.001% of pixels over 8 levels, lamp 0.002%, storm 0.008% (107 px, max 213, all dashes of the plinth contour at the far left). Visually nothing changes, but some pixels do differ by more than 8 levels. The diner room's contents (lane 5) are still hidden beyond 30 m because diner.js hides its group with the flag, so from far off the glass shows the bare stone void.

### 1 diner street front (done)

parts/dinerFront.js is rebuilt: a stone wall round the openings; stall risers of dark glazed tile with a steel trim line; slim steel frames; B1/B2/B4 plate glass through glass.addPane using makeGlassMaterial; reeded transom bands (canvas, irregular reeds) glowing faintly. B3 is a 0.4 m vestibule with splayed side-light panes; the door leaf is 0.95x2.15, hinged at z 0.12 in the plane x -10.5, with a glazed upper pane that moves with the leaf, a push bar and a half-drawn blind. Also a bell on a coiled spring that swings when the door opens, and 714 on the transom. The fascia runs over B2/B3 with DINER in 18 mm neon tubes (accent neon), filleted strokes, electrode caps, stand-offs and an underline tube. Each letter is a breakable of kind 'neon' with an invisible proxy for bullets. The N drops out for 0.1 s every 2.5-6.5 s from a seeded fork, sometimes twice. Also a transformer box and cable, a rolled canvas awning on brackets, and a half-round gutter and downpipe (breakable 'pipe') dripping 22 drops on their own clocks. Window light lies on the pavement (makeWindowLightMaterial; a puddle-torn falloff map is added only while it is lane 1's stub) and a puddle-torn blue neon sheen. Colliders cover walls, risers, splays, pilasters, the door and regions for the vestibule, doorway and room; the only way in is the door.

Presets:
- `shot=dinerfront`
- `shot=dinerwide`
- `shot=dinerdoor`

Builder's own critique: The neon prints as thin pale-blue lines with little glow; the tube colour and bloom are lane 1's (accent stub). I took the tubes out of the planar reflection because its streak printed them as a solid blue block, so the sign has no reflection in the road, only my small sheen patch. The door's recess and splays are hard to read at night in dinerdoor: the frames are dark on dark and the stub glass is invisible. The fascia is a flat black band. At 22 m (dinerwide) the whole front is small under the dark mass. The Hopper read (room and people through glass) depends on lane 5/6's room and lane 1's glass.

### 2 edges made of things (done)

New part parts/bounds.js (order 150) and world/Works.js builders (flatbed truck, panel van, sawhorse, storm lantern, hoarding with torn-bill canvases, pipe stack, compressor, tar boiler, chain). South (z 30-36): hoardings on both pavements with bills; a black trench across the left lanes with shoring and a lumpy spoil mound with cobbles; a plank bridge chained off; sawhorses with lanterns (own tiny cones, no registry entry, no pool light); a tar boiler breathing steam (a Steam instance); a flatbed with a pipe load parked across the right lanes at an angle, tailboard toward the block. East (x=22, z 36.5..-124.5): brick plinth, 0.13 m spear-topped bars (one InstancedMesh), piers every 8.8 m with caps and balls, and locked gates at z -32.2..-27.8 with chain and padlock. Beyond it a rail yard of flat skyline-inked tones at three depths: rails, boxcars on two tracks, timber stacks, a water tower, a signal gantry with two lamps. North (z -119..-125): two flatbeds nose to tail, pipe stacks, a compressor, sawhorses with lanterns, a hoarding and rubble with a lantern between the el's columns. West: wall colliders along the building line (the near building's at the pilaster face); the cross street z -24..-30 is open 14 m (region), then a wire gate (pipe frame, barbed strands, chain, chain-link scrim) with a van behind; the far row's gaps get board fences or a locked service gate with bins. The unlit fixture of the alley wall lamp is added, with anchor block.alley.lamp. The outer net is a region (-40..24, -132..42). perimeterTest() (40 points x 72 directions, a 0.3 m circle stepping 0.1 m) returns stops by tag: none is 'bounds' (wall 592, fence 736, truck 106, barricade 93, hoarding 21, gate 58, trench 6, chain 15, boiler 17, works 35, pipes 50, plus cars, columns, props).

Presets:
- `shot=boundS`
- `shot=boundE`
- `shot=boundN`
- `shot=boundW`

Builder's own critique: boundS reads mostly as one dark band: the spoil mound looks like a low wall rather than clay and cobbles, and the trench is only a black slot. The truck cabs are boxy close up (boundN, elfar), and their window glass prints as big light-grey panels. In boundW the chain-link scrim is barely visible and the van behind it is dim. The nearest boxcars in boundE read as a continuous grey band behind the fence. The lanterns have no rain light (no registry entry).

### 3 el clear of buildings (done)

I chose the blocks-make-way option with a terminus. The curve's points up to (-7.5,-156) are kept, so stations 0-25 are geometrically identical. The far points are now (-25,-167), (-40,-170.5), (-56,-172): the el turns west into a cross street and ends at a terminus. It could not run on out of sight, because ring-1 towers at (-22,-190), (-76,-179) and (-110,-172) block every corridor, and the old curve ran straight through the first of them. The left row skips its blocks in EL_GAP (z -143..-184) but still takes their rng draws, so every other block keeps its shape and windows. buildElStreet adds corner blocks and blocks along both sides of the cross street, each kept 2 m clear of the el's footprint, station and house. Overpass.buildStation: a north side platform along the last 46 m with a canopy, railing, brackets and a stair to the street. buildTerminus: a last column pair, a deck cap, a buffer stop with buffers and a lamp, and a brick station house on its own columns with lit windows. Train.js: a train running out brakes at 2 m/s2 into the platform, stands 14 s and goes back the way it came; a train coming in starts at rest in the terminus; a hurried train still leaves. The hanging lamp formerly at z -170 now hangs 28 m before the end. clipTest() checks deck + railing + train swept band (to deckY+girderH+4.2), platform, house and columns against buildings, far blocks, towers (rotated base footprints), lamp posts and every collider, all with 0.6 m clearance. It returns [].

Presets:
- `shot=elfar`
- `shot=elplan`

Builder's own critique: The turn out of the fixed point (-7.5,-156) is tight: about 18 m radius at its sharpest. The terminus is only ~60 m past the building line and plain (a box house with a pyramid roof). Its lit windows and platform are small from the avenue. elfar is half blocked by the north trucks right in front of the eye. The rest of the cross street west of the terminus is left open to the tower bases; there are no blocks there because the towers stand in it.

### 4 the city behind (done)

New world/City.js + parts/city.js (order 160, own rng forks, skyline ink ids). Roofscape: about 150 tenement masses 40-145 m from the block in three flat tones (display 0.22/0.25/0.28, towers' material, mist kept at their feet), outside keep-out rects that include the avenue's vanishing-point corridor. Each side has its own character: water tanks on stilts (N/W), chimney stacks and tall factory stacks (S), skeletal billboard frames (E), laundry poles (W). Also a church spire with nave (W), a gasometer drum with its column/ring/brace lattice (E, far), and a suspension bridge beyond the rail yard (tower, deck, sagging cables, suspenders) with car lights crossing every 6-14 s. Life: chimney smoke puffs leaning downwind (instanced billboards); 14 scud sheets orbiting at 105-175 m; 7 drifting rain veils with falling streaks; two very faint searchlight beams (gain 0.005) sweeping on 34-46 s periods; a white beacon on the highest skyline vertex pulsing 0.35 s every 2 s; 10 tower windows switching on and off, first switch after 12 s. Lightning: the tower shader now hazes toward a lit sky by layer and cancels the exposure kick on the masses, so under a strike the nearest layers are darkest; at rest the maths is the same haze as before.

Presets:
- `shot=skyline`
- `shot=skylineE`
- `shot=skylineT&lightning=1`

Builder's own critique: The west roofscape is hidden behind the left row from the avenue, so the skyline preset shows little of it. The bridge is hard to find (thin, far, hazed). Scud and veils are so subtle I cannot point to them in a still. The beacon is white, because red would be a colour outside the registry. In cars and street the east arches now frame a low dark roofline, the fence and the rail yard instead of open mist: it is richer, but the golden's airy right third is heavier. The gasometer lattice reads as a zigzag fence at its size.

### 5 rooms behind the glass (done)

Facade mass either side of the diner is now layered by massGeo(): a core, a room layer and a skin, with boxes round rectangular holes via holey(). Ten SHOP_BAYS each get a 3.5 m room, or a roller shutter at 27.0 and -21.4. New part parts/shops.js (order 170): per-shop dressing (tailor dress forms, cutting table and bolts; barber chair, framed mirror, coat stand; pawnbroker shelves of clocks, radios, horns, violin, grilled counter; empty shop ladder, tins, trestles, dust sheet; florist urns with palms and a bench of pots). Plaster, boards and ceiling linings sit inside the stone. Everything is inked as a figure, so a room prints black with contours and light ticks: with wall inking the dry-brush lift-outs made the rooms read as lit grey caves, and the street view's shop windows lost their black. Each shop has its own pane (glass.addPane with room, makeGlassMaterial dark tint), breakable. Upper floors: a shared pane that goes calls Facade.openRoom(), which cuts its room into the mass (geometry rebuilt, rays refreshed, shadows dirtied); shops.dressRoom adds linings, a door outline, a curtain edge and a lamp shade.

Presets:
- `shot=shoprooms`
- `shot=shoproomsUp`

Builder's own critique: With the stub glass a whole pane and a broken one look identical in shoprooms: the difference is lane 1's glass. The upper-floor room is built (probe confirms 9 rooms after the break), but the foundation glass stub's paneHole decal still draws its black hole over it until lane 3's glass lands, so shoproomsUp shows almost nothing. The rooms are very dark (lit only by the pool lights and hemi), so in the street frame the tailor/pawn contents are barely there. The shutters' seams are thin, uneven lines.

### 6 dressing that reacts (done)

New part parts/dressing.js (order 180). Registered with lane 3's kinds: 'pipe' for 4 drainpipes (hopper, brackets, shoe) on every second pilaster where no accepted camera looks (38, 29.2, 20.4, -6.0), a steam main with clamps and collars along the el's street-side columns behind the start, and the diner gutter/downpipe. 'sign' for TAILOR and BARBER boards on scroll brackets. 'crate' and 'barrel' for stacks at the south works and north pipe job, colliders beyond the nav grid. 'paper' for the newsstand's papers (Props exposes papers). 'wire' for each overhead wire (Props splits the merged wire mesh into one mesh per wire, same id). 'awning' for the diner awning.

Presets:
- `shot=dressing`
- `shot=steammain`

Builder's own critique: Drainpipes hide on the pilaster flanks and barely read. The brief's 'every second pilaster' is only honoured where no golden camera looks. Break behaviour is the lane 3 stub (the whole thing vanishes in debris). No crate stacks or barrels were added inside the block, because they would change the Hoods' nav grid.

## Intended golden changes

Every exterior frame changes in the intended places, and I compared them at full size and side by side with the goldens:
(a) Sky and far distance, whole width: faint scud, rain veils, the searchlight beams (gain 0.005; a pale beam can still be seen top right of street), the beacon, bridge lights, and smoke on the roofscape.
(b) East side through the arches (street, cars, lamp, hood*, viewmodel, reload, impacts, muzzlesmoke, train, wreck*, havoc, perf, title): the iron railing and piers at x=22, the rail yard (boxcars, water tower, gantry with two lamps) and a low roofscape behind. The arches now frame a low dark roofline over mist instead of empty mist.
(c) The far el past z -118: the curve and the columns beyond station 25 moved, the terminus, the hanging lamp moved from z -170. At the VP this is almost invisible (checked in a 4x crop of street); the north pipe-job trucks show faintly at the VP.
(d) Near building's shop windows at the left edge (street, lamp, hood*, wreck*): the bay -17.0 window now looks into the pawnbroker's room, inked black with contours; the bay -21.4 window is a roller shutter. In the golden both were one black reflective glass.
(e) The mass re-cut into other triangles: single contour dashes along the plinth.
(f) storm: the lightning frame now shows layered tower silhouettes (the tower-shader change); at rest the shader is the same maths.
(g) carside: a thin vertical contour from a board fence closing a gap in the far row.
(h) battle_t15/30/45 and end diverge completely. The diner's four old shop panes are gone (the brief allows this), and new solids (fence, trucks, shop panes, signs, dressing) now take stray rounds. The game rng then runs a different fight (a car burns earlier, etc.). The Hoods' nav grid and the legacy spawner are unchanged: colliders.bounds is untouched and nothing new stands inside the nav rectangle.
Not changed on purpose: the road, the lamps (except the far hanging one), the near el, the cars, the figures, the near façade's stone.

## Errors

tools/errors.sh: FRAMES RENDERED 2-4, ERRLOG (clean) on every one of: shot=dinerfront, dinerwide, dinerdoor, boundS, boundE, boundN, boundW, elfar, elplan, skyline, skylineE, skylineT&lightning=1, shoprooms, shoproomsUp, dressing, steammain, street, train&t=40, scene=diner&beat=settle, scene=fight&beat=outside. npm run build: succeeds (only the existing chunk-size warning). Proofs via node tools/evalpage.mjs "shot=street": stage.part('overpass').clipTest() -> []; stage.part('bounds').perimeterTest().byTag has no 'bounds' and no 'none'. errors.sh does not print data-probe, so the probes ran through evalpage.

## Frame rate

UNCAPPED=1 node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900 gave 73.6 fps, avg 13.59 ms, p95 23.4 ms, 834 calls, 2.61M tris. The tool warned the GPU was already 73% busy (seven lanes on one machine), so this is not a clean benchmark. shot=street: 766 draw calls, 2.31M triangles. No baseline taken on this machine state. The added cost is mostly draw calls (per-material meshes for bounds things, shop rooms, city); no new THREE lights (lanterns, beacon and station lights are emitters only).

## Contract deviations

1. colliders.bounds (setBounds) is unchanged at (-9.7..18.5, -118..30). The Hoods' NavGrid (L6) and the legacy spawner (L7) size their grids from it, and moving it would have reshuffled every AI preset. The outer net is instead a region 'net' (-40..24, -132..42) beyond all barriers, and every new collider stands outside the nav rectangle. The brief says setBounds moves out; this keeps its name for the nav only.
2. Fix 5 takes the blocks-make-way option but ends the line at a terminus instead of running out of sight. The ring towers left no clear corridor west or south of the fixed point (-7.5,-156), and the old curve ran through tower (-22,-190). The train now reverses at the terminus (world/Train.js).
3. The DINER neon tubes are on LAYER.FX, so they are not in the planar reflection; the reflection streak printed the coloured emitter as a solid blue rectangle. The pavement sheen is my own additive, puddle-torn patch.
4. dinerInSight(eye) is now fed each step by dinerFront.update (DINER_SIGHT.state), so its result is the frustum/30 m rule rather than a pure function of the eye position.
5. Shop rooms and upper rooms are inked as figures (userData.inkFigure).
6. Facade SHOP_BAYS shop windows are no longer shared façade panes: they are own panes created by parts/shops.js.

## For the integration agent

New parts, all after the accepted ones, from their own rng forks: bounds 150, city 160 (tick 160), shops 170, dressing 180. dinerFront keeps order 130 but now allocates ink ids, so lane 5's diner.js ids shift up (harmless: ids only matter for inequality and range).
New APIs: stage.part('bounds').perimeterTest(); stage.part('overpass').clipTest({clear, from}), .station {s0,s1}, .terminus; Facade.farBlocks, Facade.holes, Facade.massGeo(), Facade.openRoom(pane), exported SHOP_BAYS and EL_GAP; site.js dinerSightFrom(camera, was) and DINER_SIGHT.state; dinerFront api adds sign {letters, setOn}, awning, door.bell; stage.part('shops').shops [{z, kind, pane, room}]; stage.part('dressing') {pipes, signs, crates, barrels, awning}; Props.papers and Props.wireMeshes; Skyline.boxes, Skyline.windowMesh, exported makeTowerMaterial (now reads U.uLightning); anchor block.alley.lamp (unlit fixture at (-12.5,4.2,-24.3) for wave B).
Lane 1: the neon tube colour/glow and its road reflection, the window-light patch (I set a soft map only while the material is the stub 'windowLightStub'), and shop glass all need your materials.
Lane 3: breakables of kinds neon, pipe, sign, crate, barrel, paper, wire, awning are registered. The foundation Glass stub's paneHole decal covers the room Facade.openRoom cuts behind an upper-floor pane; the geometry-true glass should drop that decal for shared façade panes. Shop panes are own panes with room.
Lane 5: diner.js reads dinerInSight; its room group is still hidden beyond 30 m / out of view.
Lane 6/7: nav and spawns unchanged. The battle presets diverge only through new solids and the diner panes.
Train: startAt(null, -1) now starts in the terminus; the train=... preset behaves as before.
I edited no file outside CONTRACTS §1 lane 4 ownership besides src/debug/shots/L4_street.js; I made no docs edits. Untracked helpers live in shots/ (gitignored).

## Golden table

```
preset           verdict         px%    px>8%     mean    blk16  changed box (px>8)
street           CHANGED       9.558    6.176    2.719   116.19  (0, 0, 1439, 898)
street_t8        CHANGED       9.617    6.372    2.757   116.57  (0, 0, 1439, 894)
lamp             CHANGED       9.030    3.836    1.407    92.06  (0, 0, 1439, 899)
cars             CHANGED       9.629    8.317    5.130   142.13  (54, 40, 1439, 832)
carside          CHANGED       0.067    0.053    0.016     7.75  (345, 246, 1022, 806)
hood             CHANGED       9.497    6.161    2.713   116.19  (0, 0, 1439, 898)
hoodstudy        CHANGED       7.140    5.646    2.456    95.42  (0, 0, 1439, 899)
hooddeath        CHANGED       7.025    5.501    2.219    71.29  (0, 0, 1433, 897)
hoodwalk         CHANGED       4.484    3.562    1.575    68.93  (510, 23, 1439, 796)
hoods            CHANGED       9.384    6.067    2.646   115.47  (0, 0, 1439, 874)
viewmodel        CHANGED       9.428    6.154    2.709   116.19  (0, 0, 1439, 887)
reload           CHANGED       9.350    6.112    2.697   116.19  (0, 0, 1439, 895)
impacts          CHANGED       9.444    6.144    2.713   116.19  (0, 0, 1439, 899)
muzzlesmoke      CHANGED       9.475    6.162    2.717   116.19  (0, 0, 1439, 887)
battle_t15       CHANGED      82.199   71.709   60.842   248.75  (0, 0, 1439, 899)
battle_t30       CHANGED      83.422   72.062   63.504   248.37  (0, 0, 1439, 899)
battle_t45       CHANGED      87.424   77.388   66.964   250.71  (0, 0, 1439, 899)
wreck_t2.9       CHANGED      10.111    6.661    2.984    97.97  (17, 0, 1439, 876)
wreck_t3.1       CHANGED      10.213    6.602    3.002   102.26  (0, 0, 1439, 899)
wreck_t3.4       CHANGED       9.603    6.549    2.957   104.86  (0, 0, 1439, 888)
wreck_t8         CHANGED      11.224    7.337    3.232   103.95  (0, 0, 1439, 899)
wreck_t40        CHANGED      10.127    6.574    3.080   108.64  (0, 1, 1439, 899)
train_t6         CHANGED       8.813    6.033    2.237    84.78  (0, 0, 1439, 898)
havoc            CHANGED       9.582    6.266    3.010   131.61  (0, 0, 1439, 895)
storm            CHANGED      14.297    5.947    3.342   193.82  (0, 2, 1439, 899)
perf             CHANGED       9.802    6.847    3.847   130.77  (0, 0, 1439, 895)
title            CHANGED       6.197    3.395    1.119    76.58  (0, 64, 1439, 899)
end              CHANGED      63.880   52.361   19.248   141.76  (0, 0, 1439, 899)
28 of 28 frames changed without being allowed
```
