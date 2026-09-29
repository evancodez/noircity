# Wave A lane report: L5-interiors
- branch: `wave-a/L5-interiors`
- last commit: `accda9f`
- worktree: `/Users/evansmac/Downloads/eprojects/noirextreme/.claude/worktrees/wf_1ce98cce-975-5`

## Items

### P0.1 The room (done)

The foundation's stub room is replaced with a built room: src/stages/block/parts/diner.js assembles it from src/props/diner/{kit,room,counter,booths,jukebox,fixtures,extras}.js.
- Floor: dark lino (albedo sRGB ~6/255) with a 512x1024 albedo map and a roughness map across the whole floor, so nothing repeats. Polish mottle gives a short broken sheen under the pendants. Scuffed paths run along the aisle, from the door to the counter and behind the counter. Wet footprints go from the door to stool 4. The wet mat is inside the door. The light inlay line runs 0.3 m out from the counter base and turns round both ends.
- Ceiling: y 3.55, dark. Two ceiling fans turn at 40 rpm.
- Walls: dark panelling with stiles at uneven spacing, a skirting board and a dado rail 1.1 m up. Above the rail, vertex-painted plaster fades to black toward the ceiling. The inner face of the front wall is lined round L4's openings, with wooden sills.
- Pictures: plain dark rectangles with a light frame.
- Coat rack by the door end: a hook board, two fedoras and a hanging coat that drips (debris particles) into a glossy puddle.
- Counter: dark front with a steel panel strip and a groove, formica top at y 1.20 (0.62 deep), a rolled steel edge along the front and ends, and a brass foot rail on 8 brackets at y 0.43.
- Counter items: at stool 4 an ashtray, pack, lighter, napkin box and sugar. Elsewhere plates, cups and saucers, fork and knife, a menu and a newspaper. A pie case sits at the door end (breakable kind 'pieCase'). The cash register is at the far end: dark nickel box, keys, flag window, crank, and a drawer that slides out on register.open().
- Stools: 9, a chrome pedestal with a flared foot and a padded seat with piping, a button and a seam. The seat swivels (a child group). Each stool is a breakable of kind 'stool'.
- Back bar against x -17:
  - lit grey glass behind two shelves of bottle silhouettes, in 5 shapes (squat, tall, square, flask, round), each with one light tick
  - the scotch at serve 4 is the only amber
  - stacked inverted tumblers and cups hung on hooks
  - two tall urns with sight gauges and spigots that breathe puff-particle steam
  - a menu board: COFFEE 5, PIE 10, HASH 25, EGGS 20
  - a round clock over the hatch that starts at 11:40 and runs on the fixed step, second hand moving
- Kitchen hatch: a lit box behind the opening with a pan rack and a shelf of pots seen as black shapes, a steel frame, a pass shelf, a ticket rail with 3 tickets, and a bell. The cook stands back-lit. There is also a fly-paper ribbon that turns.
- Booths: high-backed benches with buttons and wooden caps and end panels. Each table is a breakable of kind 'table' with a napkin box, an ashtray and a ketchup bottle on it. Booth 3 is short: a bench, a table and a stool.
- Blind: half down over B2 (the couple's booth).
- Window light: patches on the floor and tables projected from a street light through each opening, using lane 1's makeWindowLightMaterial. B2's patch has slats: 12.
- Jukebox: an arched cabinet 1.5 m tall. Lit white pilasters run round the arch; the arched top and side panels are lit grey. A lit well shows the record (black with a pale label) turning at 78 rpm and the tone arm. A speaker grille with curved ribs and a soft glow on the floor.
- Pendants: 8 enamel cone shades (0.34 m, dark outside, white inside) on cords, through lamps.addCustom real:true. The pool light is retuned (115 cd over the counter, 55 over the booths, angle 0.62, penumbra 0.6, distance 4.6), so the counter goes paper white under each lamp and falls to dark between. The floor stays near black apart from sheen.
- Look: interior (fog x0.35, rainOverlay 0, haze 0.6, reflect 'floor', room 'diner'), plus the dry volume and the floor surface.

Presets:
- `shot=diner_seat`
- `shot=diner_left`
- `shot=diner_right`
- `shot=diner_wide`
- `shot=diner_booth`
- `shot=diner_out`
- `scene=diner&beat=settle`
- `shot=diner_seat&eye=-12.9,1.5,-3.6,0,-0.12,45`

Builder's own critique: - Every dark wall, the ceiling and the counter front still carry the façade's heavy white dry-brush slashes. I tagged every mesh with userData.inkSurface ('plaster', 'wood', 'lino', 'metal', 'enamel', 'cloth') and kept albedos low, but until lane 1's calm interior surfaces land the room looks like wet stone inside, worst on the ceiling. The lit back-bar glass and the kitchen wall also take brush bands.
- Lane 1's stub window-light material (additive 0.05) prints the window patches as large mid-grey slabs over the floor (visible in diner_wide, diner_left and fight round1/round2). It drowns the footprints and the floor's sheen. Lane 1's real material (a lift of 0.1 to 0.2) should fix it; I did not override its strength.
- Rain still falls indoors (lane 1's dry volumes).
- The fans hang above the lamp heads, so their blades cannot shadow the cones as the brief asks. They only turn in silhouette against the dark ceiling.
- The kitchen is only 0.55 m deep: L4's near facade build fills x < -17 with stone (see forIntegration).
- The pay phone and the rest-room door print nearly black: nothing lights them.
- The booth benches read as black masses, and the button dimples are not visible.
- diner_booth is dominated by dark bench masses.
- The nearest pendant's bulb and inner shade bloom into a big white ellipse in diner_wide.
- The cup-hook cups read as blobs.
- The coat on the rack is a rough lathe, black on black.

### P0.2 The part's API (done)

stage.part('diner') returns:
- anchors: every anchor of the site plan, plus register, piecase, bell, restroom, phone and cigmachine. 'hatch' now stands inside the kitchen at x -16.73; 'till' is at the far end by the register.
- stool(i) → { object, seat, spin(impulse), topple(dir), upright() }
- items (Map), place(kind, anchor|Vector3, { name, variant, yaw }) and take(name). Solids are added and removed at runtime.
- jukebox: play(slot); next() (the arm lifts, the record drops into the mechanism, a new one rises, 2 s); hit(power) (the needle skips; the third hit darkens it for 1 s, then next()).
- bell.ring() (the plunger bounces), doorBell.ring(), register.open() / close()
- clock { time, seconds, hands }, fans [{ rotor, rpm, speed }]
- lamps[]: each pendant has swing(impulse), a damped pendulum on its cord. The shade, cone uniforms, rain/smoke entry and light.pos/target follow it.
- cupsRattle(strength, s): items tremble and liquids ripple.
- lampsDip(depth, s)
- trainPass(s, { at }): 4 carriage light bars sweep the floor, the counter front and the back bar through the openings as additive FX-layer quads, the pendants tremble, and cupsRattle runs with it.
- reset(): stools upright, the counter set again, a broken table or pie case restored, a shot-out pendant relit, the drawer shut, swings stopped.
- Also exposed: pieCase and booths.
Everything runs on the fixed step, and the steam, drips and tremble draw from stage.rng.fork(5150). Every call was exercised live (stool spin and topple, pendant swing and shootOut, jukebox next and hits, register, bell, trainPass, cupsRattle, lampsDip, a tilted and half-filled tumbler, a cigarette ticking, reset) with an empty errlog.

Presets:
- `shot=diner_alive`
- `shot=diner_alive&t=3.9`
- `shot=diner_wide&train=1`
- `shot=diner_left&train=1`

Builder's own critique: - The pool spotlight does not follow a pendant's swing live. I update lamp.light.pos/target, but the pooled SpotLight is only re-aimed when the pool reassigns (at most every 0.25 s), because I did not reach into Lamps.pool. A hard swing lags.
- Toppled stools use lane 3's stub topple, which lays them over with the seat floating a little.
- The train bars are hard-edged rectangles with a feathered map, not a true projection, and their skew is a guess.
- The ripple on liquids is a small wobble of the rim and centre, not concentric rings.

### P0.3 The prop library (done)

buildProp builds every CONTRACTS §8.1 kind with smooth lathes, fluted lathes, bevelled slabs and tubes. The files are src/props/index.js, kinds.js, lib.js and liquid.js.
- Each prop gets size (measured after its init), grip, rest, inkIds, and consecutive ink ids per part where a contour should separate parts. Parts that share a material, parent and id are merged into one mesh (a stool is 3 draws).
- tumbler: 8.5 x 7.5 cm, a 1.4 cm base, 10 cut flutes on the lower half. The amber liquid is its own mesh: setFill (full = 40 % of the height), setTilt(q) keeps the surface level in the world, ripple.
- bottle: scotch (28 cm, squat shoulders, a paper label from a procedural canvas atlas, cork, amber to its fill line, setFill / setTilt), rye, gin (square), beer, ketchup, milk; userData.neck.
- cigarette: 8 cm; setTip unlit / lit (ember accent) / ash; setAsh, dropAsh, tick(dt, drag) to burn it; tipPos.
- cigarettePack: soft, torn corner, two cigarettes standing proud.
- lighter: flip-top lid on a side hinge via setOpen, perforated chimney, knurled wheel with strike(), wick; userData.flame.
- matchbook: crew accent, a comb of matches, a cover that opens (setOpen), a black cardinal and THE CARDINAL as an alpha decal.
- wallet: opens like a book (setOpen). The licence card sits behind a celluloid window framed in leather, with a dark oval photo, three lines and PRIVATE INVESTIGATOR.
- plate, cup and mug (coffee liquids), saucer.
- coffeePot: glass globe, dark band and handle, near-black coffee (setFill).
- pie: in its tin with a slice cut out.
- ashtray: cut glass with three rest notches, butts and ash.
- stool, napkinBox, sugar (ribbed glass jar, chrome cap with spout), menu, newspaper (plus variant 'open'), fork, knife.

Presets:
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

Builder's own critique: - Under the counter's lamp pool, anything with more albedo than sRGB ~0x0c prints paper white. So china, paper, labels and the licence card are white shapes with contours, and the printed marks (pack band, licence lines, newspaper headline bars) are faint at sheet distance. They should read better in the hands' own light.
- The propsheet is a little wide: the leftmost plate and the rightmost newspaper touch the frame edges.
- The fork's tines do not read at 0.6 m.
- The tumbler's thick base prints as a white wedge under the amber.
- Amber prints as a light orange: that is lane 1's accent stub.
- The newspaper 'open' variant is untested in a figure's hands.

### P1 The room is alive (done)

All brief P1 items move on the fixed step:
- the urns breathe steam puffs (game.fx.puff)
- the clock runs from 11:40 with the second hand ticking
- the fans turn
- the register drawer slides
- the bell's plunger bounces; the door bell calls sfx
- the fly-paper ribbon turns
- the coat drips
- the jukebox record turns and changes
- cups rattle and liquids wobble with the train pass
- a pie sits under the glass on a stand

Presets:
- `shot=diner_alive`
- `shot=diner_alive&t=3.9`
- `shot=diner_right&train=1`

Builder's own critique: - The steam and drips are small and hard to see in the stills.
- The 'rings spreading in the liquids' are a rim wobble, not visible rings.

### P2 rest room door, pay phone, cigarette machine (done)

src/props/diner/extras.js adds:
- a panelled rest-room door on the -z end wall with a REST ROOM sign, a bright slit under the leaf and an additive spill on the floor
- a pay phone on the wall by the jukebox: dial, handset on its hook, coiled cord, shelf, hanging directory
- a cigarette machine at the +z end: lit pack windows, pull knobs, a mirror panel and a tray, with its own collider
Anchors restroom, phone and cigmachine are registered.

Presets:
- `shot=diner_seat&eye=-14.9,1.75,-3.2,-0.2,-0.2,60`
- `shot=diner_seat&eye=-13.0,1.75,9.6,3.14,-0.15,60`

Builder's own critique: The pay phone and the door print nearly black with no light on them; only the sign, the gap and the machine's windows read.

## Intended golden changes

None. As the brief states, no golden frame changed, and all 28 are IDENTICAL.

## Errors

tools/errors.sh gave ERRLOG (clean) on every query below:
shot=propsheet, shot=propsheet&kind=tumbler, shot=propsheet&kind=wallet&open=1, shot=diner_seat, diner_left, diner_right, diner_wide, diner_booth, diner_out, diner_alive, each diner_* with &train=1, scene=diner&beat=settle|order|drink|pay, scene=fight&beat=round1|round2|round3|outside, shot=dinerfront. The diner_* presets were each run with shot= in front.
npm run build succeeds (only the existing chunk-size warning).

## Frame rate

The machine was busy: 7 lanes, and fps.mjs reported the GPU 73-85 % busy before each run, so these numbers are not a clean benchmark.
- UNCAPPED=1 node tools/fps.mjs "shot=diner_wide&anim=1" 1440 900 (with the settle cast in place, after the last performance pass): 88.7 fps, 998 draw calls, 2.31M tris.
- An earlier run on the same machine gave 47 fps; that was before I cut the shadow casters and merged the prop parts (1098 calls).
- shot=perf&t=1&anim=1 on the same busy machine: 65.5 fps, 664 calls.
- The diner itself is about 280 meshes and 217k triangles, drawn only while dinerInSight. No new THREE lights are added.

## Contract deviations

- The kitchen hatch is cut in a partition flush with the back-bar cabinets (x -16.45), not in the wall at x -17.0. Behind the hatch is a lit kitchen box 0.55 m deep. The reason: L4's near facade build (src/world/Facade.js) fills x < -17 with a stone slab whose +x face would cover a kitchen behind -17. The 'diner.hatch' anchor now stands the cook inside that box at x -16.73.
- 'diner.till' has moved to the far end (z ~8.2), by the cash register, as the brief places the register. The stub had it at the door end.
- Anchors added: diner.register, diner.piecase, diner.bell, diner.restroom, diner.phone, diner.cigmachine.
- Pendant lamps carry my own state: lamp.swing(impulse) is a function, and the state is in lamp.sw / lamp.pivot / lamp.cordLen. That is safe because Lamps only uses lamp.swing as an object when lamp.hanging, which pendants are not. Their lamp.light intensity, angle, penumbra and distance are overridden after addCustom.
- reset() reaches into lane 3's breakable handles to restore a broken table or pie case, because Breakables has no restore(): it sets broken=false, hp=hp0, visible, and re-adds solids. It also revives a shot-out pendant by setting lamp.dead=false, on, and the bulb material.
- My props sit in the prop library (src/props/**), and the room's furniture builders live in src/props/diner/*.js, because a helper file in parts/ would be globbed as a part.
- Props: userData.size is measured after the kind's init. Kind-specific extras exist (listed in the header comment of src/props/index.js): cigarette setAsh / dropAsh / tick / tipPos, lighter strike / flame, bottle neck, coffeePot spout, wallet card, liquid ripple.

## For the integration agent

- Merge order is fine: I touch only src/stages/block/parts/diner.js, src/props/** (index, kinds, lib, liquid, and the new diner/ folder) and src/debug/shots/L5_diner.js. Nothing outside my ownership.
- Lane 4: if Facade's near build left a kitchen void (x -19.6..-17, z 0.6..3.8), the hatch partition could move back to x -17 for a deeper kitchen. Today it is self-contained at x -16.45.
- Lane 1:
  - Every diner mesh and material carries userData.inkSurface ('plaster', 'wood', 'lino', 'metal', 'enamel', 'cloth'). The room is currently drowned in the façade's lift-out slashes, and lane 1's interior surfaces will make or break these frames.
  - Window light: buildWindowLight uses makeWindowLightMaterial({ w, h, slats }) on LAYER.FX patches (B2 has slats 12). The stub's opacity 0.05 prints far too strong; the brief's lift of 0.1 to 0.2 display is right.
  - The back-bar glow, kitchen wall and jukebox panels are MeshBasic 'glow' materials (diner_mirror, diner_kitchen, jukeLit...) that should stay flat light, not brush-banded.
  - The train bars (diner_trainBar), the jukebox floor glow and the rest-room spill are additive FX-layer quads.
- Lane 7:
  - The scene can call d.trainPass(7) and d.lampsDip, as the stub already did. d.jukebox.next() now animates a 2 s change and then advances the music slot. d.bell.ring() bounces the bell mesh.
  - Hands can call cigarette.userData.tick(dt, drag) to burn a cigarette, and dropAsh() returns a world point for lane 3's ash flake.
  - Sounds asked for but not built: 'jukebox_change', 'register' (plus the existing bell / doorbell / jukebox_hit).
- Lane 3: breakable kinds registered are stool (9), table (4), jukebox and pieCase. The pie case is a Group with glass panes (PM glass) and a pie on a stand.
- Lane 6: the cook's 'diner.hatch' anchor is inside the kitchen box (x -16.73); a cook deeper than about 0.5 m will clip the lit back wall at x -17.
- Presets:
  - shot=propsheet (&kind=<k>&variant=&open=&fill=&tip=&turn=)
  - shot=diner_seat / diner_left / diner_right / diner_wide / diner_booth / diner_out, each with &train=1 for the mid pass, and &eye=x,y,z,yaw,pitch[,fov] for any other eye in the room
  - shot=diner_alive, where t scrubs the staged API events
- The room presets run scene diner beat settle for the cast and hold the eye in the controller's cutscene mode.

## Golden table

```
preset           verdict         px%    px>8%     mean    blk16  changed box (px>8)
street           IDENTICAL 
street_t8        IDENTICAL 
lamp             IDENTICAL 
cars             IDENTICAL 
carside          IDENTICAL 
hood             IDENTICAL 
hoodstudy        NO CAPTURE   (its headless Chrome hung for 35 min on the shared machine; I killed it and re-ran it alone:)
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
perf             IDENTICAL 
title            IDENTICAL 
end              IDENTICAL 
--- python3 tools/golden.py check hoodstudy:
hoodstudy        IDENTICAL 
golden check passed (1 frames)
(An earlier full run on commit 96ed584 passed all 28 frames IDENTICAL.)
```
