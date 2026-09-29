# Wave A lane report: L3-destruction
- branch: `wave-a/L3-destruction`
- last commit: `19f766b`
- worktree: `/Users/evansmac/Downloads/eprojects/noirextreme/.claude/worktrees/wf_1ce98cce-975-3`

## Items

### P0.1a damage by bullet count (done)

Cars.js: the timer fuse is gone from play. Each car gets a limit of 26±3 points, seeded per car from its own fork (4450). Points per round: body 1, engine bay (x>0.6, under the bonnet line) 2, tank (x<-1.55, y<0.95) 3, glass/lens/tyre 0.5, a Hood's stray round x0.15. At 40% the bonnet seam gives grey smoke; if the tank took most of the points it drips fuel into a dark pool instead. At 75% the smoke turns black and thick, a small flame licks at the seam, and Game.onCarSmoking adds the hazard so the Hoods relocate. A car blows on the round that takes it past its limit. A blast within 6 m adds 12 points to a neighbouring car 0.35 s later. When a third blast comes, the oldest roaring fire is doused to embers (Fire.douse). startSmoke(car, fuse, {kind}) is kept only as the presets' staging (wreck, perf).

Presets:
- `shot=wreck&t=2.9`

### P0.1b four explosion kinds (done)

The killing round's zone picks the kind: engine A, tank B, anything else C, and one in six becomes D. A: the fireball leans up and forward, the bonnet spins up about 7 m, the car kicks and drops onto its nose. B: a low wide fireball rolls backwards, the boot lid flies, a rear wheel rolls away burning, wobbles and falls over, the rear lifts 1 m and slams, and a 3.6 m sheet of burning fuel on the street burns 12 s (FX_REFL, so it reflects). C: the windows blow out one after another over 0.4 s with tongues of fire, then a larger second blast at 0.5 s guts the car, blows a door off and stands fire up through the roof. D: a flat skirt of fire under the chassis, the car jumps and rolls onto its side and burns there. Each kind has its own fireball shape, smoke lean and debris. Chunks still print black over the flame.

Presets:
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

Builder's own critique: The fireballs still use the existing splatter sprites, so the first frames of A, B and D look alike at a glance; the kinds separate by 0.3 s. The C cook-off window flames are small at 12 m. The B fuel sheet reads as a row of separate little flames rather than one continuous sheet.

### P0.1c the burnt wreck rebuilt (done)

New src/destruct/Wreck.js builds the wreck from geometry, cached per kind. Same outline and wheelbase as the sedan. Thin side skins with the door holes cut out; roof sagged 8–13 cm on thin bent A/B pillars; a broad rear quarter panel; the rear window a torn hole in the fastback; no glass. Bonnet gone (A) or peeled up and back; boot lid gone (B). One door hangs open on its lower hinge and another is missing. Inside, the seat frames with zig-zag springs and the steering-wheel ring are thin line work. Steel rims with a torn bead arc and ribbons of tyre hanging; the car sits 9 cm lower with a 3° list. Also engine block, radiator and grille shell, and a chassis underneath (rails, axles, differential, tank, exhaust). Char black and matte, with a patchy ash vertex colour on up-facing top edges. Embers crawl along the top edges for the first 40 s. Variants: A nose down with front wheels splayed, B tail collapsed, C gutted, D on its side (ash follows the side it lies on). It reuses the car's four ink ids, so no new ids.

Presets:
- `shot=wreckstudy`
- `shot=wreckstudy&wk=A`
- `shot=wreckstudy&wk=B`
- `shot=wreckstudy&wk=C`
- `shot=wreckstudy&wk=D`
- `shot=wreck&t=40`

Builder's own critique: D on its side, seen from behind in the wreck preset, reads as a dark box; it only reads as a car when turned (wreckstudy turns it 35°). The ash dry-brush on the top edges barely shows except where fire light rakes it. Under its own fire light a wreck's top surfaces print light grey rather than char black (B at 43 s). The bonnet peeled up stands very vertical and can read as a board. The door seams on the shut doors are faint.

### P0.2 glass that shatters (partial)

New src/destruct/Shatter.js and a rewritten Glass.js. On its first hit a pane is cut into a seeded Voronoi of its outline: fine polar rings around the first impact, so the first star's rays run straight, and a jittered grid elsewhere. Cracks are walks along cell edges: 6–9 radial cracks to the frame or into another crack, plus a few ring cracks, drawn as pale ribbons with a frosted halo texture. The first round drops only the pulverised core, which leaves a real hole. Later rounds drop every group the cracks close off from the frame. At the hit limit (by size, e.g. 15 on the diner glass), or on glass.shatter, fine cracks run above the percolation line: bits near the holes, big pieces at the frame that tip out onto the pavement, and teeth left in the putty. Shards are real slab meshes cut from the cells; they flash white when they mirror the light above into the eye, land, break again on a hard landing, slide and lie (capped at 150 moving and 220 resting). glass.shatter(pane, {dir, power, at, by:'body'}) bursts a man-sized hole outward. It works on the diner panes, the façade windows (the pane leaves the owner's merged mesh via owner.paneGone and is drawn cut with the owner's material and ink id, with a black backing behind the holes), and pie-case glass (temporary panes). pane.on('state') is kept.

Presets:
- `shot=glassstudy2&hits=1`
- `shot=glassstudy2&hits=4`
- `shot=glassstudy2&hits=12`
- `shot=glassstudy2&hits=all`
- `shot=glassstudy2&hits=all&age=0.12`
- `shot=glassstudy2&hits=all&age=3`
- `shot=windowman`
- `shot=windowman&age=0.35`

Builder's own critique: Car windows still use the old crack decal and 2-hit shatter; they are not cut. The phone booth is lane 4's Props.js and not registered, so it keeps its old glass. Beyond the first star's polar cluster, cracks follow 10 cm grid-cell edges and zig-zag like lightning. Later stars get only a small drawn star, not a fine cut. The shatter has many heavy black outlines, busy at 5 m. Shards resting on the diner floor pass through tables and benches: the support is found once by a ray.

### P0.3 breakables and story fx (done)

Breakables.js rewritten, with a rigid PieceField (flies, bounces, rolls if round, settles on whatever a ray finds under it: counter, table or floor). bottle: breaks at the shoulder; held (another scene or a bone) the jagged neck takes its place in the hand (how.neck, and in the 'break' event), else the neck falls; curved ragged shards; the whisky bursts in amber and spills. plate/cup/saucer/mug: 5–8 ragged wedges, cup handle separate, bits rain down when by 'body'. tumbler: the base survives, the wall goes to bits. stool: seat off and rolling, bent column, base rolling in an arc. topple(): tips about the far base edge under gravity, a stool rolls on its side and knocks the next in its way. table: splits along its length and the halves fold in. pieCase: glass meshes (userData.glass) or the case's box shatter as panes, and anything with a prop kind slides out. jukebox: never destroyed; dent jolt, lights stutter, sparks every third hit. spill(): a pool on the support (found by rays); an edge within 30 cm sends a thin stream to a floor pool. StoryFx: pour is a real tapered amber tube falling in a swaying arc, with a splash and a rising fill; cig.wisp(tip, key) is a thin curling ribbon thread that breaks up by ~0.5 m; cig.exhale(mouth, dir) is a plume of brushed smoke cells; hit.punch is a white splatter (the muzzle flash family, 2 frames), sweat drops, and blood above power 0.7. Sounds are requested as break_<kind>, topple_<kind>, jukebox_hit.

Presets:
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

Builder's own critique: The bottle and tumbler shards are small and hard to see at 2 m. The neck-in-hand works in code, but in the stub brawler's hand it is too small to see in the frame. The exhale plume is too faint to read. The jukebox study uses my own stand-in box. The pie case, table and stool pieces are simple parametric shapes in the prop's size, not lane 5's final models, and the pie-case glass is small at this distance. The amber spill pool reads as a flat colour sticker.

### P1 the street answers bullets (partial)

Impacts.js: the player's rounds within 18 m leave a pale crushed-stone crater with a dark core; the third and sixth hit in one 35 cm cell knock a stone chunk loose (a real piece) with a gouge and dust. Metal gets a dent (dark pit, pale torn edge), heavy sparks that bounce on the street and die, and requests sfx 'ring'. Hoods' stray rounds and far rounds keep the old reaction, which is why hoods and muzzlesmoke stay identical. New breakable kinds: sign (pendulum on its brackets; a round near a bracket shoots it through and the sign hangs by one corner), pipe (water fan that weakens to a dribble, or a steam jet with 'hiss' for 4 s, squirting across the round's path), barrel (topples, rolls across its axis, leaks dark), crate (knocked over; the one on top is thrown off), papers (fluttering wet sheets), awning (dumps its water, sags), wire (cut into two verlet chains that fall, swing and spit sparks), neon (the letter goes dark with a pop, glass and sparks; its neighbours flicker). My own test objects are in streetstudy.

Presets:
- `shot=streetstudy&t=1.9`
- `shot=streetstudy&t=2.5`
- `shot=streetstudy&t=4`
- `shot=streetstudy&t=8`
- `shot=impacts`
- `shot=havoc`

Builder's own critique: In the streetstudy frame most test objects (crates, newsstand, awning, neon letters) are dark stand-ins far down the pavement and barely readable. The steam jet still clumps into a pale ball near the pipe. The pilaster-corner chunk is shown only on the kerb. Nothing on the block is registered with these kinds yet (lane 4). Metal dents are hard to see on black iron.

## Intended golden changes

wreck_t2.9: the preset's staged car is now at its 75% warning — black thick smoke and a small flame licking at the seam — instead of grey smoke. wreck_t3.1 / t3.4: the staged blast is kind B (the preset's shots put most points in the tank): a low wide fireball rolling back toward the camera, the boot lid and a burning rear wheel flying, the rear lifting. wreck_t8 / t40: the see-through burnt wreck (holes, bent pillars, line-work seats) with a tank fire, and at t8 the burning fuel sheet on the street in front. battle_t15/30/45, perf, end: the legacy fight diverges — cars now blow by point count and kind, façade panes crack with geometry stars instead of decals, and blasts chain. impacts: the shop-window round now leaves a geometry star crack (it used to shatter at once), a pale stone crater, and glass bits on the pavement (lower left). havoc: the façade windows show real star cracks and cut holes instead of decals and the old black hole decal (left edge, x 0–564).

## Errors

tools/errors.sh clean (ERRLOG clean, frames > 0) on every query listed in the items above that I ran through it, plus shot=wreck&t=8, shot=wreckstudy, shot=wreckstudy&wk=D, shot=glassstudy2&hits=1|4|12|all, shot=windowman, shot=streetstudy, shot=havoc, shot=impacts, shot=perf, shot=end, shot=battle&t=30, shot=breakstudy&kind=all|bottle|neck|plate|cup|saucer|tumbler|stool|topple|table|pieCase|jukebox|liquid|pour|cig|punch, and scene=diner&beat=settle, scene=diner&beat=order&t=3&anim=1, scene=fight&beat=round2, scene=fight&beat=ko&t=3, scene=fight&beat=outside. The wreckkind variants were checked at single times: A t=3.3, B t=3.3, C t=3.6, D t=3.5. npm run build: OK (only the existing chunk-size warning).

## Frame rate

UNCAPPED=1 node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900 after: 83.6 fps, avg 11.96 ms, p95 18.1 ms, p99 28.7 ms, 598 calls, 2.02 M tris, 12 Hoods, 1 fire. The tool flagged the run BUSY: GPU 81% busy before and 96% after, because other lanes were rendering, so the number is not a clean benchmark. I have no "before" number: switching the worktree's src back to 9aafdfe to measure it was refused by the permission classifier, so I did not measure it.

## Contract deviations

- CONTRACTS §8.3: glass.hit takes a pane that the owner shares; on its first hit the shared pane leaves the owner's merged mesh (pane.kind becomes 'cut', owner.paneGone(pane, oldKind)) and Glass draws it itself. Glass.update(dt) runs from fx/React.js because World.js (frozen) does not call it. The diner panes' mesh and ray twin get world-space geometry (their own transform is reset to the parent's inverse) and are restored by restore(). Added: pane.limit, pane.cut, and glass.shatter({ at, by:'body' }).
- §8.2: breakables.add takes extra per-kind options (fluid, w, h, a, b, ...) kept as h.opts. hit() accepts { neck } to force keeping a bottle's neck. Added breakables.spill(pos, { accent, amount }), breakables.jet(at, dir, fluid, follow) and breakables.field (the PieceField). 'break' events carry neck. hit returns 'break' for wire and neon, which are marked out but not hidden.
- Cars: the fuse is gone from play; startSmoke(car, fuse, { kind }) remains only as preset staging (wreck, perf). car.health is now a getter derived from points. New: cars.wreckNow(car, kind, { fire, rollSgn }), setDebugWreckKind (URL wreckkind=, read in my preset file because Shots.js is frozen), SEDAN_SHAPES and wreckMotion exports. Game.onCarSmoking now fires at 75%, not at the start of smoke. The dud/fizzle mechanic is removed.
- Fire: constructor takes { sources, toWorld, pool, seed }; old callers without sources behave as before; added douse().
- Explosions.blast takes { kind, phase, local }.
- Fx: the fire particle cap is raised 700 -> 1200 (the B fuel sheet). Fx.update now also runs cig.update and hit.update.
- Impacts.at(hit, dir, { weak }): React passes weak; weak or far (>18 m) rounds keep the old reaction.

## For the integration agent

- No files outside my ownership were edited. Mine: src/fx/{Explosion,Fire,Fx,Impacts,React,StoryFx}.js, src/destruct/{Glass,Breakables,Shatter,Wreck}.js, src/world/Cars.js, src/debug/shots/L3_destruction.js.
- New preset names: wreckstudy, glassstudy2, windowman, breakstudy, streetstudy. The core wreck preset also reads &wreckkind=A|B|C|D.
- New sound names requested and silent until lane 7 makes them: break_<kind>, topple_<kind>, jukebox_hit, ring, hiss, burst_water, burst_leak, sign_drop, awning_tear, neon_pop.
- Lane 4: register street things with kinds sign (origin on the bracket line, local x along it, opts w,h), pipe (opts fluid 'water'|'steam'), barrel, crate (stacked), papers, awning (opts w,d; front edge local +z), wire (opts a,b world ends), neon (one breakable per letter). Register the phone booth panes through glass.addPane if the booth should shatter geometry-true. pane.on('state') fires 'cracked' | 'holed' | 'gone'.
- Lane 5: a pie case breaks via breakables.add(case, { kind:'pieCase' }); flag its glass meshes userData.glass = true; children with userData.kind slide out. A held bottle broken with breakables.hit(bottle, { by, neck:true }) (or when it sits under a bone or in another scene) leaves how.neck in the same parent.
- Lane 2/7: fx.cig.wisp(tip, key) must be called every step while the cigarette burns; fx.pour.start raises the target's fill (option fill:false turns this off).
- Draws come only from new forks (4450–4452, 734, 6162, 7101–7103, 8311, 8312), so the accepted frames keep theirs. The ShardField allocates one ink id at runtime, at the first shatter.
- My shared-scratchpad helper scripts are in scratchpad/l3tools (not in the repo).

## Golden table

```
Full run (the two NO CAPTURE entries are headless Chrome hangs under load that I killed; they were rechecked or are intended frames):
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
hoods            CHANGED       0.000    0.000    0.000     0.04  (517, 520, 517, 520)   -> fixed, recheck: IDENTICAL
viewmodel        IDENTICAL
reload           IDENTICAL
impacts          CHANGED       0.728    0.311    0.259   122.12  (186, 373, 340, 899)
muzzlesmoke      NO CAPTURE   -> recheck after the fix: IDENTICAL
battle_t15       CHANGED      76.247   58.184   40.929   231.79  (0, 0, 1439, 899)
battle_t30       NO CAPTURE   (changed in the first full run: 82.538 px%; errors.sh clean)
battle_t45       CHANGED      83.827   70.744   61.107   248.98  (0, 0, 1439, 899)
wreck_t2.9       CHANGED       7.981    5.863    3.556   129.13  (420, 133, 808, 899)
wreck_t3.1       CHANGED      74.171   47.654   33.736   222.33  (0, 0, 1439, 899)
wreck_t3.4       CHANGED      56.576   32.978   27.640   185.49  (0, 0, 1439, 899)
wreck_t8         CHANGED      46.685   21.096   14.787   222.21  (0, 0, 1439, 899)
wreck_t40        CHANGED      41.009   18.940   10.844   229.91  (0, 0, 1438, 899)
train_t6         IDENTICAL
havoc            CHANGED       0.889    0.732    0.600   149.82  (0, 187, 564, 899)
storm            IDENTICAL
perf             CHANGED      22.987    9.439    4.505   150.04  (0, 0, 1434, 899)
title            IDENTICAL
end              CHANGED      66.417   54.381   19.462   140.05  (0, 0, 1439, 899)
Recheck after the last commit (19f766b): hoods IDENTICAL, muzzlesmoke IDENTICAL, impacts CHANGED (intended).
Every changed frame is in the brief's intended list: wreck_t2.9 wreck_t3.1 wreck_t3.4 wreck_t8 wreck_t40 havoc battle_t15 battle_t30 battle_t45 perf end impacts.
```
