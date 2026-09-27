# Phase 2 brief — combat: the Hoods, the Tommy gun, blood

The environment (Phase 1/1b) is the stage. Phase 2 puts the men in it. The
user's single most important requirement: **the enemies must look really
good** — unmistakably men in fedoras and trench coats, black silhouettes with a
lit rim, moving like people. Not capsules, not blocky, not stiff. Look at the
two figures in `reference/noir_reference.png` (the man being shot, centre; the
shooter by the car, right) and the shooter in the foreground.

Phase 2 is delivered in two sequential steps, each with its own review:
**2a — the Hood** (model + animation + study preset), then **2b — combat**
(weapon, AI, blood, damage, waves, HUD).

---

## 2a. The Hood (`src/enemies/Hood.js`)

### Skeleton
A named joint hierarchy of `THREE.Bone`s (or Object3Ds) so procedural
`AnimationClip`s can target `<joint>.quaternion`:
```
root > hips > spine > chest > neck > head > hat
              chest > shoulderL/R > upperArmL/R > forearmL/R > handL/R (> gun)
       hips > thighL/R > shinL/R > footL/R
```
Proportions (metres, adult male): total 1.82 with hat; eye 1.66; shoulder
width 0.46; hips 0.34; upper arm 0.30; forearm 0.27; thigh 0.44; shin 0.42.

### Mesh (every part smooth; no visible facets at 2 m)
- **Head**: sphere scaled (1, 1.12, 1.02) + a smaller jaw sphere; neck cylinder.
  A short cigarette (thin cylinder) on some Hoods. No face detail — the ink pass
  makes it a silhouette anyway; a subtle nose bump helps profile views.
- **Fedora** (`LatheGeometry`): crown 0.11 m tall tapering in, then scale x 0.85
  for an oval, and sink the top along the front-back centre line for the
  pinch/teardrop; band as a dark torus; brim radius 0.17 with the front edge
  displaced down ~0.02 and the back edge up ~0.015 (snap brim). Brim thickness
  ≥ 0.006 so it reads as a line from the side.
- **Coat** (`LatheGeometry`, profile from shoulder r 0.25 → waist r 0.20 →
  hem r 0.36 at 0.55 m above ground), scaled z 0.7 so the torso is wider than
  deep; a raised **collar** (tilted lathe ring), **lapels** (two thin extruded
  wedges on the chest), **belt** (torus at the waist), a **back vent** is
  unnecessary. Shoulders: two spheres at the shoulder joints under the coat
  surface so the shoulders are square and broad. Sleeves are wider than the
  arms (r 0.075 / 0.07) and end at the wrists.
- **Arms/legs**: `CapsuleGeometry` with sphere joints inside; hands as
  flattened spheres with a thumb bump; shins visible below the hem; **shoes**
  (elongated flattened ellipsoids with a heel).
- **Guns**: a snub revolver / automatic for most Hoods (bevelled extrusions,
  no boxes with hard edges), a Tommy gun for the heavy variant (reuse the
  player's model at lower detail).
- Variants: 3 coat lengths, 2 hat brim widths, 2 heights (±4 %), with/without
  cigarette, so a group never looks cloned.
- Coat hem secondary motion: a spring on the hem lathe's lower ring
  (shear the hem opposite to acceleration, swing on turns), clamp small.

### Animation (`src/enemies/HoodAnim.js`)
Procedurally build `AnimationClip`s on the joint names and play them through
an `AnimationMixer` with cross-fades (0.15–0.3 s):
- `idle` (breath, weight shift, slow head turn), `walk` (1.0 m/s, 1.1 s cycle,
  legs ±28°, arms ±18° counter-phase, hips bob 3 cm, slight torso twist, hat
  stays level), `run` (2.9 m/s, bigger arm pump, forward lean 8°),
  `aim` (right arm straight at the target, chest turned 30°, knees bent, left
  hand supporting or in coat pocket), `fire` (5-frame recoil: arm up 6°, chest
  back, hat nod), `flinch` (torso twists away from the hit direction, arm
  flails, one step back), `stagger`, and **deaths**: `deathBack` (the
  reference's centre man: chest thrown out, arms up and back, head back, hat
  flies, fall onto the back), `deathKnees` (drop to knees, sway, face-down),
  `deathSpin` (half turn, crumple sideways). Deaths run ~0.9 s, then hold a
  ground pose (no clipping through the street; feet/hips/head at y ≈ 0.1).
- Upper-body layering: `aim`/`fire`/`flinch` blend on the spine-up joints over
  `walk`/`idle` legs (additive or masked clip).
- Look-at: head and chest yaw toward the target within limits.

### Rendering
- **Brush field on moving figures.** The ink pass samples its dry-brush
  texture in world space (`brushWorld()` in `src/render/shaders/ink.js`) so
  strokes stay on surfaces while the player walks. A walking Hood would have
  world-anchored strokes sliding over its body, so give figures an object
  anchor: keep a uniform table `uFigAnchor[64]` (world position of each
  Hood's root, indexed by its negative id) and, for figure pixels, sample
  `brushWorld(wpos - anchor, ...)`. Cars keep anchor 0 (static). Nothing in
  the ink pass may go back to screen-space sampling.
- Grey materials like the world; the ink pass already has a "figure" path
  (negative ids). Give each Hood a unique negative id; make sure contours
  separate a Hood from a black column/car behind it (id edge) and the white
  rim on the lamp-facing side is stronger on figures than on the world.
- At 20–40 m the Hood must be a clean black silhouette with the fedora and
  coat readable; at 2 m the coat must show dry-brush texture like the
  foreground shooter in the reference.

### Study preset `shot=hoodstudy` (required for review)
Five Hoods 4 m from the camera in a row under a lamp, facing yaw 0°, 45°, 90°,
135°, 180°, in states idle / walk / aim / flinch / deathBack respectively; `t=`
scrubs the animation clock. Plus `shot=hood` (one at 5 m in `aim` facing the
camera, one at 25 m walking) and `shot=hoods` (a staged firefight: 4 Hoods at
8–30 m in mixed states, one mid-`deathBack` with blood at t≈0.4 s, one firing
with the muzzle flash held) — `hoods` is completed in 2b.

Acceptance for 2a: in `hoodstudy` every figure reads instantly as a man in a
fedora and coat from every angle, the walk looks human (no sliding feet, no
robotic symmetry), the death pose matches the reference's centre figure, and
nothing is faceted or intersecting visibly.

---

## 2b. Combat

### Player weapon (`src/player/Weapon.js`, `src/player/Viewmodel.js`)
- Thompson M1928: finned barrel, Cutts compensator, drum magazine, vertical
  foregrip, wooden stock; right glove on the grip, left on the foregrip.
  Bevelled extrusions and lathes, smooth. Rendered with a separate viewmodel
  camera (FOV ~50) drawn into the same scene + id targets after a depth clear
  (so it is inked like everything else and never clips the world); excluded
  from the reflection pass. Composed low-right; sway, bob, recoil kick +
  climb, reload animation (drum out/in, bolt), ADS not needed.
- 50-round drum, 11 rounds/s, hitscan raycast with spread that grows while
  firing; head shots kill; body shots 2–3 to kill a normal Hood.
- **Muzzle flash**: 4–6 canvas-generated white starburst/splatter sprites
  (jagged, irregular, a few flung droplets), random rotation/scale, 2 frames,
  plus the pre-allocated `world.flash` PointLight at the muzzle (intensity high
  for ~60 ms) so the street and nearby figures light up; a small smoke puff.
  Shell casings eject and bounce with a tick.
- Impact effects: dark ink chips + a dark impact decal on stone; brief white
  sparks on iron/cars; water splash + ripple ring on the street
  (`world.street.addImpact`); blood on Hoods.

### Blood (`src/fx/Blood.js`, `src/fx/Decals.js`)
- Hit: a burst of 20–40 saturated red particles (small elongated splatter
  quads, canvas texture), flung along the shot direction, gravity, short life;
  a red splatter decal on whatever is behind/below within 2 m (ground, wall,
  car), random splatter texture, random rotation, persistent (cap ~200, reuse
  oldest).
- Corpse pool: a decal under the body that grows over ~5 s to ~1.2 m with a
  noisy edge and stays. Pools and splatters on the street are visible in the
  wet-street reflection.
- The ink pass must print blood as **vivid red** (like the reference's
  #c8102e), never maroon or black: for chroma pixels bypass the black crush and
  map value with a gentle curve floored at ~0.45.

### Enemy AI (`src/enemies/HoodAI.js`, `src/enemies/Spawner.js`)
- Cover graph: generate cover points from the world's cars, el columns,
  hydrant, phone booth (positions from `world`), each with a "peek" point.
- Behaviour loop: spawn out of the fog / from behind cars at 40–60 m → advance
  from cover to cover toward the player (walk beyond 25 m, run between covers
  under fire) → at 10–20 m pop out, `aim`, fire 2–4 shots (visible muzzle flash
  and a `PointLight` from a small shared pool), duck back → relocate if the
  player closes or its cover car is burning. Heavies rush with the Tommy gun.
  Line-of-sight via raycast against `world.solids`; steering around
  `world.colliders`; never walk through cars, columns, or each other.
- Their bullets: hitscan with a short delay and accuracy that depends on
  distance and whether the player is moving; player damage 8–14.

### Player damage & game loop (`src/player/Health.js`, `src/game/Game.js`)
- Health 100, regenerates after 6 s without damage. Damage feedback: blood
  splatter on the screen edges (red, fading), a heavy heartbeat vignette
  (monochrome) when low. Death → "THE END" card with kills and waves; click to
  restart.
- Waves: 3, 5, 7, 9…; heavies from wave 3; 8 s intermission with a wave card
  ("WAVE 2" in the title-card style). `waves=1` enables spawning in shot mode.

### HUD (`src/ui/Hud.js`)
Monochrome, ink-styled DOM overlay: ammo (drum count) bottom right in a
typewriter face (`"American Typewriter", "Courier New"`), wave/kills top left
in a condensed serif (`"Baskerville", Georgia`), a thin ink health bar that
bleeds red when low, a tiny dot crosshair. Hidden in shot mode unless `hud=1`.

### Presets
Complete `shot=hoods` (above), add `shot=viewmodel` (street composition with
the Tommy gun visible and a muzzle flash held at t = 0.03 s).

Acceptance for 2b: `hoods` looks like the reference with the figures; firing
the Tommy gun in the browser feels weighty (flash lights the wet street, casings,
recoil), Hoods use cover, flinch and die in varied ways, blood is vivid red and
persists, 60 fps holds with 12 Hoods on screen.
