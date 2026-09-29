# Foundation pass A: what was built (the builder's own report)

Read with `docs/story/CONTRACTS.md` ("Deviations"). Pass B turns this into `docs/story/ARCHITECTURE.md`.


## A1

Third person removed. Deleted src/player/PlayerBody.js. Game.js no longer has ots, setOts, aimRef (the camera is the aim), the body in prewarm or shadowCasters, the flinch hooks, the V key or the moving crosshair. main.js: dropped ots=1 and otslook. Shots.js: dropped the OTS import, stageOts and SHOTS.ots. layers.js: dropped PLAYER_SLOT, PLAYER_HEAD and HERO; allocHoodSlot() now takes the first free of all 64 slots. ink.js: removed the uHero uniform, isHeroId/isHeroCoat, the whole hero block, every hero term in flashF, contours, rim, halo, glow, and views 10/11. Hood.js: removed the player variant paths (TORSO_PLAYER, buildYoke, buildEar, playerPartGeometry, the ribbon hat, the boxy fist, ghost, PLAYER_Q/HAT/BRIM, COAT_HEM[3]); what the Hoods get is arithmetically identical. Viewmodel.js: dropped buildTommyParts and the split geometry. Also cleaned Weapon.js (the OTS fire path), MuzzleFlash.js (playerWorld, playerOts), Hud.js (aimX/aimY, 'V camera' in the key list), HoodAI.js (aimRef), Casings.js (a comment), README.md, DESIGN.md §2/§9/§11 and tools/playtest.mjs (the V checks). A bug came up and was fixed: after simplifying the ink's per-slot brush offset (the yoke-to-body remap) to float(slot), 10 pixels in hoodstudy and 1 in hooddeath moved by one level. Bisecting the 18 shader edits pinned it on that line: the compiler folds the offset into the sum differently and it rounds differently in the last bit. The offset is now a select that is never taken (slot < 0 ? 0.0 : float(slot)), with a comment saying why, and every frame is identical again.


## A2

Waves removed. Deleted src/enemies/Spawner.js. New src/game/Director.js implements CONTRACTS §5: run(generator), wait, until (a function, 'dead:g', 'alive:g<=n', 'zone:anchor'), spawn, alive(group), cue (lightning, train, music, emits 'cue'), stop, and car (throws 'wave B'). legacyWave(n) holds the old spawner unchanged inside it (same spots, same order, rng fork 1777, the vanguard, the 12-alive cap). legacyWaves(from) chains waves for the battle, perf and end presets with the old timing: the wave, its last man down and 2 s, then the old 8 s gap as director.lull, then the next wave. Game.live (state playing and no lull) replaces the old checks for the 'playing' state in the weapon update, the Hoods' hit chance, blast damage, the React burn tick and the Autopilot. The train and storm pacing now read director.startT/active/done/lull. The fire tokens and the lull breaker moved to HoodPacing in HoodAI.js (game.pacing); the token cap reads director.level. Removed from the HUD: the wave/kills box, the wave card and showWave; the end card shows kills only. Health, Storm, Train, main.js (the waves= and card=wave params, the intermission pause states, the stats line) and the playtest checks were updated. battle, perf and end are marked prewarm:true, replacing main.js's wavesOn condition. The battle start-wave param is now legacywave=. Game.start() puts the player on the empty block; the scene link comes in pass B. Added game.stage and game.on/off/emit. The battle_t45 counters match the pre-refactor run exactly (spawned 22, alive 10, shots 90, hits 27, ...).


## A3

World.js is now the Stage base (export Stage, plus World as an alias). It keeps the engine services in the same construction order (materials, light registry, colliders, fog, hemi light, flash light, fire light). It builds the parts sorted by order and exposes each as stage[name] and stage.part(name). Then it collects solids, builds the cast (stage.hoods) and the place's own systems (rays, nav, covers, fx), and creates react on bind(game). New on the stage: anchors (addAnchor/anchor), surfaceY/addSurface, addSolid/removeSolid (RayWorld gained add/remove), dry[], look/lookAt/addLook, onReflLod/onShadowLod, and a no-op street. The part updaters run in tick order, which reproduces the old World.update order (sky, overpass, cars, lamps, rain). src/stages/index.js is the registry (import.meta.glob of ./*/index.js; Stages.get(name) builds on first use; .names). src/stages/block/index.js globs its parts. There are 12 parts, in today's build order: sky 10, street 20 (adds the surface plus the anchors block.player.start and block.alley.mouth), overpass 30 (the refl/shadow LOD hooks), facade 40, lamps 50, skyline 60, cars 70 (the shadow LOD hook), props 80, steam 90, mist 100, rain 110, train 120. Game takes { stages, stage } and enterStage(nameOrStage) re-binds the controller, the viewmodel's world and flash scene, the fx sfx hooks, the train sounds and hoods.onStep, then emits 'stage:enter'. game.fx/rays/nav/covers/react/hoods are getters on the current stage, and the pipeline hooks read game.stage. main.js builds the block into its scene through the Stages registry; the loop, focus=, perfLegacy and window.__noir read game.stage (__noir.world, .stage, .scene are getters; __noir.stages was added). Moved src/game/React.js to src/fx/React.js. Street.surfaceY holds the controller's old kerb formula; the Controller walks on stage.surfaceY(x, z). lamps.addCustom (§2.4) uses its own rng fork (42), and the bulb calls tolerate a null bulb. A probe confirmed stages.names=[block], the part list, addCustom, addSolid/removeSolid raycasts, surfaceY -8 → 0.15 and 0 → 0, anchors and lookAt.


## A4

Shots.js keeps the core and today's presets. It auto-registers every src/debug/shots/*.js (import.meta.glob, eager) that exports { presets: { name: {...} } }, and a name defined twice throws. Added the scene shot mode ?scene=<id>&beat=<name>&t=<s> (sceneShot, default t 1 s, viewmodel shown). applyShot calls game.scenes.shot(id, beat), then applies pose= and fov= over the camera the beat placed. Also a new standalone fov=<deg> override for any preset. Until pass B adds game.scenes, a scene URL reports 'no scene manager (game.scenes) yet' in the errlog. The foundation's own preset is src/debug/shots/F_stage.js: shot=start, the block.player.start anchor, which proves the auto-registration.


## A5

I checked first: probing the scene in street, battle t=45 and wreck t=40, the block's highest world ink id is 83. allocInkId now wraps at 1729. allocVmId(n) hands out 1730..1769 and wraps inside that range. layers.js exports VM_LO 1730 and VM_HI 1779, and VM_ID0 stays 1770 for the Tommy gun. The ink pass's isVM() covers -1730..-1779; the wood test still keys off VM_ID0. The full id-range table is written in layers.js. The foundation's pass A deviations were appended under 'Deviations' in CONTRACTS.md. Only that appended hunk was committed; the orchestrator's own uncommitted §15 edits in that file are still in the working tree, untouched. The playtest tool passes 17/17. A live probe of director.run/spawn/wait/cue/until worked.


## Notes for the next builders

- For the next builder (pass B): src/debug/Shots.js applyShot expects game.scenes.shot(id, beat) to enter the stage, place the player and run setup[beat]. pose= and fov= are applied after it.
- Game.start() leaves the player on the empty block at block.player.start's pose; wire the title into the first scene there.
- game.on/off/emit exist, and enterStage emits 'stage:enter' {name}.
- d.spawn({who: <cast kind>}) calls game.cast.spawn, which is still missing.
- stage.cast is still missing; stage.hoods is the Hoods.
- The HUD has no end-of-fight card any more. Hud.showEnd(kills) takes one argument.
- Never reorder the block's parts: the build order is what keeps ink ids, RNG draws and the scene graph identical. A new part takes an order after 120, or one in between only if it allocates no ink ids and draws from no shared rng.
- Part update ticks: sky 10, overpass 20, cars 30, lamps 40, rain 50.
- Parts are reachable as stage.part('overpass') or stage.overpass; stage.part('bounds') etc. will exist once a lane adds that part file.
- Each stage owns its own fx, rays, nav, covers and react; read them through game.* getters and never cache them across a stage change. The controller, the viewmodel (vm.world) and the flash scene are re-bound on enter.
- stage.addSolid(mesh) / removeSolid(mesh) keep the ray world in sync; don't push to stage.solids by hand after construction.
- The walking surface is stage.surfaceY(x, z). A part adds a provider with stage.addSurface(fn); fn returns undefined outside its footprint, and the last provider to answer wins. The effects (Blood, Impacts, Explosion, Casings) still use Street.groundAt(x): L3 must switch them to stage.surfaceY for interiors.
- lamps.addCustom({head, axis, height, half, real, bulb, fadeEnd, edgeSoft, strength, tag}) draws from its own rng fork. Adding pendants cannot shift the block's lamp draws, but each real custom lamp competes for the 7 pooled SpotLights (nearest win).
- Ink ids: allocInkId gives world ids 2..1729 (the block uses 2..83). allocVmId(n) gives 1730..1769 for hands and held props; those meshes must set userData.inkFigure = true (viewmodel ids are written negative), and isVM covers 1730..1779.
- Hood figure slots: all 64 belong to the cast. The ink keeps a select that is never taken in the per-slot brush offset (slot < 0 ? 0.0 : float(slot)). Do not 'simplify' it: without it every frame with a man in it moves one level on a few pixels.
- The battle/perf/end presets call game.director.legacyWaves(n); the query param is now legacywave=<n>, not wave=. Presets that need all Hood variants and combat programs compiled first set prewarm: true.
- Lane preset files go in src/debug/shots/L<n>_*.js and export { presets }. Duplicate names throw at load.
- The shot=start preset (src/debug/shots/F_stage.js) shows the play start pose.
- docs/story/*.md (STORY, CONTRACTS, the briefs) still mention third person and waves because they describe the change; I left them alone. The historical docs/progress/*ots*.jpg images also remain.
