# NOIR EXTREME — Art Direction & Technical Design

A first-person noir game set on one rain-soaked city block beneath an elevated
railway, rendered in real time to look like a hand-inked black-and-white noir
illustration. The **only** colour in the world is blood (red) and fire (orange /
yellow, from burning cars and explosions). Everything else is ink: black, grey
paper-tones, white light.

The reference image is `reference/noir_reference.png`. **Look at it before you
write any code, and look at it again every time you judge a screenshot.** The
goal is that every frame of the game could be mistaken for a panel from the same
artist.

---

## 1. The look, decomposed

Study the reference and match these properties, in priority order:

1. **Tonal structure (most important).** The sky is a *mid grey* (~#7a7a7a), not
   black. Distant skyline = soft dark-grey silhouettes, lighter with distance
   (aerial perspective into grey fog). Near structure (overpass ironwork, cars,
   figures) = near-solid black. Light sources (lamp heads, cones, muzzle flash,
   lit windows) = white. Wet street = dark base with bright vertical streak
   reflections of every light. Value range is used fully: real blacks, real whites.
2. **Ink edges.** Silhouettes have rough, dry-brush contours — not clean vector
   outlines and not pixel-perfect Sobel lines. Lines wobble slightly and vary in
   thickness. Far objects have *soft* edges (fog eats the line work); near
   objects have crisp black contours.
3. **Brush-texture shading.** Mid-tones are rendered as organic brush strokes /
   dry-brush texture (see the coat in the reference), **never** as regular
   cross-hatch lines, dot screens or grids. Anything that reads as "graph paper"
   or "halftone dots" is wrong.
4. **Rain.** Fine, slightly diagonal streaks over the whole frame, lighter than
   the sky, plus rain that is visibly *lit* inside each lamp's light cone. Water
   ripples and ink-splatter blobs on the street.
5. **Wet-street reflections.** Every light (lamp, window, flash, fire) smears
   downward in a long vertical reflection, broken by ripple noise. This is the
   single most "noir" element after the tonal structure.
6. **Lamp light cones.** Each streetlamp casts a soft visible cone of light.
   Soft edges, brighter core, fades before the ground. Rain inside is brighter.
7. **Muzzle flash** = big white ink splatter / starburst with jagged edges. It
   lights the surroundings for a frame or two (the wet street flashes).
8. **Blood** = the only saturated red. Splatter particles in the air, splatter
   decals on ground/walls, spreading pools under bodies, reflected in the wet
   street.
9. **Depth & atmosphere.** Grey fog with distance, steam rising from grates,
   lit windows in the far towers, the elevated railway curving through the
   scene with arched spans and columns.

### Anti-goals (the user was explicit)
- Not blocky. No visible polygon facets on characters, cars or lamps. Use high
  segment counts, smooth normals, bevels, lathes and capsules. Boxes are only
  acceptable for building masses that are far away or in silhouette.
- Enemies must not look like "blue nanomole" placeholder capsules. They must
  read instantly as *men in fedoras and trench coats*, with convincing
  silhouettes and motion.
- No graph paper / regular hatching / halftone dots / scanline effects.
- No default Three.js look: no grey-lit Lambert scene with a plain outline
  pass, no visible skybox seams, no untextured flat ground.
- No colour leaks: nothing but blood and fire may show chroma.

---

## 2. Camera & composition

- First-person. Vertical FOV ~70°, camera height 1.65 m. The viewmodel (right
  glove + Tommy gun) sits low and to the right, so the left of the frame is
  open to the street like the reference. Weapon bob, sway, recoil.
- First person only: the player is never seen, only his hands and the gun.

---

## 3. Rendering architecture (Three.js, WebGL2)

Do **not** use `EffectComposer` boilerplate blindly; build an explicit,
readable pipeline in `src/render/Pipeline.js` with named render targets.

### 3.1 Scene pass
- Render the full 3D scene in **linear colour** to a float/half-float
  `WebGLRenderTarget` with a `DepthTexture`.
- All world materials are greyscale (`MeshStandardMaterial`/`MeshPhysical` with
  grey albedo, tuned roughness) **except** blood and fire, which are saturated.
  The post pass keys colour on saturation: any pixel with chroma keeps it;
  everything else becomes ink. Because only blood/fire have chroma, this is exact.
- Lights: dim cool hemisphere for the ambient paper-tone, a `PointLight`/
  `SpotLight` per streetlamp (a handful, with shadow maps on the nearest 2–3),
  car headlights as spotlights, a muzzle-flash `PointLight` that flashes for
  ~60 ms, fire lights that flicker. Use `renderer.shadowMap` with PCF soft
  shadows on the lamp lights closest to the player.
- Render a **normal + object-id pass** (override material, or MRT if you can
  make it work cleanly) for edge detection. Object id lets us draw contours
  between overlapping silhouettes of the same tone (a black figure in front of
  a black column still needs a rim/edge).

### 3.2 Planar reflection for the wet street
- The street is a single plane. Render a mirrored camera view into a
  reflection RT (like `three/addons/objects/Reflector.js`, but write a custom
  ground `ShaderMaterial`). The ground shader:
  - Base: dark asphalt with subtle procedural texture (noise, not a repeating
    checker) and ink-splatter blobs (darker irregular blobs, see reference).
  - Puddle mask from low-frequency noise: puddles reflect strongly and sharply;
    the rest of the surface reflects weakly and blurrily.
  - Reflection sampled with **vertical smear**: multiple taps along screen-space
    Y (downwards) so lights become long streaks, plus ripple distortion from
    animated normal noise and expanding rain-ring ripples.
  - Wet sheen: the ground is glossy; specular highlights from lamps.
- The reflection render can be at half resolution and can skip rain/particles.

### 3.3 Volumetric lamp cones
- A cone mesh per lamp with an additive `ShaderMaterial`: radial falloff from
  the axis, falloff along height, fresnel-ish edge fade, soft intersection with
  scene geometry using the depth texture, and a slow flicker/breathing. Rain
  streaks inside the cone are brightened (see 3.5).
- Lamp head: small emissive sphere/disc with bloom so it blooms white.

### 3.4 Ink post-process (the heart of the look), single full-screen pass
Inputs: scene colour, depth, normals/ids, time, noise textures.
1. **Bloom first** (cheap 2–3 mip additive bloom on bright pixels) so lamp
   heads, cones, flashes and fire glow in linear light.
2. **Fog**: mix toward paper-grey by distance (exponential) and a little by
   height. Sky is the fog colour with subtle vertical gradient and clouds.
3. **Luminance + tone curve**: filmic S-curve; crush shadows below ~0.1 to true
   black, push highlights above ~0.85 to paper white. Preserve enough
   mid-tones that the scene reads as grey ink wash, not as a 2-tone threshold.
4. **Brush quantisation**: quantise into ~5–6 tonal bands, but break each band
   boundary with a **dry-brush noise texture** (generate on a canvas at startup:
   thousands of short overlapping strokes with random alpha, length, angle
   bias; also a fine paper-grain layer). Threshold tone against this texture
   in the mid-bands so shading becomes brush strokes. **Sample the brush
   texture in world space** (triplanar on the reconstructed world position,
   two octaves chosen by distance so a tile always spans a constant number
   of screen pixels, cross-faded with contrast restored — see `brushWorld()`
   in `ink.js`). Never sample it in screen space: a screen-anchored field
   slides over the world as the player walks and reads as noise glued to the
   lens (the user reported exactly this). The same rule applies to the
   contour wobble and any other tonal texture; only time-varying film grain
   and the falling rain overlay may live in screen space, and the paper
   texture must stay faint.
5. **Contours**: edge = depth discontinuity (threshold scaled by depth) OR
   normal discontinuity OR object-id change. Jitter the sampling UV by a
   low-frequency noise (wobble) and vary line width by a second noise so lines
   look hand-drawn. Edge strength fades with fog so far silhouettes are soft.
   Contours are pure black; add a faint white *inner rim* on the lit side of
   near objects where the normal faces the nearest lamp (rim light in ink).
6. **Colour keep**: if `saturation(sceneColor) > 0.25`, output the actual colour
   (with the same tone curve on its luminance) — blood and fire survive.
7. **Rain overlay**: 2–3 parallax layers of screen-space streak texture
   (generate on canvas: thin diagonal lines, ~80° from horizontal, varying
   length/alpha), scrolling downward at different speeds, additive, light grey.
   Keep it subtle — the 3D rain does most of the work.
8. **Grain, vignette, paper**: subtle animated film grain, gentle vignette,
   faint paper fibre. Finish with a barely-there chromatic-free sharpen so
   line work stays crisp.
Also handle **lightning**: occasional whole-frame flash that inverts/whitens
the sky and kicks the tone curve for 2 frames, followed by thunder.

### 3.5 Rain (3D)
- `InstancedMesh` of thin elongated quads (or `LineSegments`) — 6–10k streaks
  in a box that follows the player. Each falls fast with slight wind lean; when
  it drops below the ground it respawns at the top. In the vertex/fragment
  shader, brighten each streak by proximity to lamp positions (pass lamp
  positions/cone params as uniforms) so rain lights up inside the cones and is
  nearly invisible elsewhere. Splash rings on the ground at random points.

### 3.6 Performance targets
- 60 fps at 1440×900 on an Apple Silicon Mac. Half-res reflection, capped
  shadow maps, one ink pass, one bloom chain. Use `renderer.info` in a debug
  overlay (`?debug=1`).

---

## 4. The world (one block, ~120 m × 60 m playable)

- **Street**: a wide wet avenue running away from the player, with a kerb and
  pavement on the left, a dark stone building façade on the left (foreground
  wall in the reference: big blocks, wet), and open space to the right where
  the elevated railway curves in from the top right and crosses overhead.
- **Elevated railway**: build parametrically along a `CatmullRomCurve3`:
  tapered riveted columns every ~10 m, arched steel spans between columns
  (proper arches, lathe/torus segments — see reference), a deck with railing
  and lamp posts. It must feel massive and very black.
- **Streetlamps**: ~6–8 tall curved lamp posts (the reference has the classic
  curved-arm "gooseneck" with a conical shade) and a couple of lamps hanging
  from the railway. Each = light + cone + emissive head.
- **Skyline**: 3–4 layered rows of 2D-profiled art-deco towers (setbacks,
  spires, finials) extruded, placed 150–600 m away, each row lighter in fog.
  A few small lit windows scattered on the towers (emissive quads).
- **Cars**: 1930s sedans (rounded hood, sloped cabin, separate pontoon
  fenders, running boards, round headlamps, spare-tyre bulge). Build from
  extruded/lathed 2D profiles with bevels and high segment counts. Smooth
  normals. 4–6 parked at angles. Headlights on some (spot light + cones + wet
  reflections). Cars are destructible (Phase 3).
- **Dressing**: steam grates with rising grey steam, a fire hydrant, a
  newspaper stand, trash cans, puddles, a phone booth, wire fences, hanging
  wires, a diner sign (unlit, monochrome). Enough clutter that the silhouettes
  layer nicely; use it as cover.
- **Boundaries**: invisible walls at the block edges, plus fog so it looks
  like the city continues.

---

## 5. Enemies — "the Hoods"

This is the element the user cares most about. They must look like the men in
the reference: fedora, long coat, pistol or Tommy gun, black silhouette with a
lit rim, and they must move like people.

### 5.1 Model (procedural, smooth, no art assets)
Build a `Hood` class producing a `THREE.Group` hierarchy with a proper joint
tree: `root > hips > spine > chest > neck > head > hat; chest > shoulderL/R >
upperArm > forearm > hand (> gun)`; `hips > thighL/R > shin > foot`. Every
mesh part is smooth: `CapsuleGeometry` limbs with overlapping sphere joints,
`LatheGeometry` torso that flares into the **coat** (the coat hem hangs to
mid-shin and flares; add a second lathe for the coat's shoulder cape/collar and
lapels as thin extruded shapes), `LatheGeometry` fedora (crown with a pinch,
wide brim with a slight downward curve at the front), a scarf/tie strip, and
shoes. Aim for a silhouette that is unmistakable from 40 m away. Wire the coat
hem to swing with velocity and turns (simple spring).

If you can do a `SkinnedMesh` with procedurally computed bone weights for the
coat (weights by distance to bones), do it; if not, rigid hierarchical parts
with generous joint spheres are acceptable because the ink shader flattens
them to silhouettes.

### 5.2 Animation (procedural)
- Idle (breathing, weight shifts), walk, run (arms pumping), aim (right arm
  extended, left hand supporting, slight crouch), fire (recoil + hat bob),
  flinch (hit reaction: torso twists away from the shot direction, arm flails),
  stagger, **death** (several: fall backward with arms thrown up like the
  reference; crumple forward to knees then face-down; spin and drop). Deaths
  should be a scripted pose-blend over ~0.8 s with a ground-contact settle, not
  a physics ragdoll. Bodies stay on the ground with a blood pool spreading.
- Blend between states with short cross-fades; drive with a small state machine.
- Hats can fly off on head shots.

### 5.3 AI
- Spawn out of the fog / from behind cars / from the alley, as the encounter
  director's script sends them (`src/game/Director.js`).
- Behaviour: advance toward the player using cover points (behind cars,
  columns, the hydrant), stop at ~10–20 m, pop out, fire 2–4 shots with visible
  muzzle flash (their bullets deal player damage with a small delay), duck back.
  Some rush with a Tommy gun. Retreat/relocate when the cover car is about to
  explode. Simple nav: a small waypoint/cover graph on the block, plus steering
  to avoid props.
- Hit detection: raycast against limb capsules; head shots kill instantly.

### 5.4 Rendering
Same materials as the world (grey), but with a per-object id so contours
separate them from background, and a slightly stronger rim light so they pop
against black backgrounds like the reference's mid-ground man.

---

## 6. Player weapon
- Thompson M1928 look: finned barrel, Cutts compensator, drum magazine,
  vertical foregrip, wooden stock. Lathes + capsules + bevelled extrusions.
  A right glove/hand on the grip, left hand on the foregrip.
- 50-round drum, ~11 rounds/s, reload animation (drum out, drum in, bolt),
  reserve ammo effectively infinite but reload matters.
- Muzzle flash: procedurally generated splatter/starburst sprite (canvas:
  random spiky polygon with jagged, ink-splatter edges, 4–6 variations),
  scaled randomly, plus a `PointLight` at the muzzle for one or two frames,
  plus a small smoke puff. Shell casings eject and bounce.
- Hit effects: ink chips off walls (small dark particles + a dark impact decal),
  sparks on metal (white, brief), water splash on street, blood on Hoods.

---

## 7. World reactivity (Phase 3)
- Cars: headlights break, windows spider-crack then shatter into falling
  shards, body gets bullet decals; enough damage → smoke, then **explosion**
  (orange/yellow fireball particles, bright point light, shockwave ring on the
  wet street, chunks), then a burning wreck with flickering fire light and a
  black smoke column. Nearby Hoods die.
- Streetlamps: shoot the head → flicker and go dark (cone off, light off,
  glass shards). Some flicker on their own.
- Windows in the left façade break. Steam grates puff when shot.
- Puddles ripple from footsteps and shots. Rain intensity gusts.
- A **train** rumbles across the overpass every ~40 s: lit windows strobe
  light onto the street below, sparks at the wheels, deep rumble. Its light
  reflects in the wet street.
- Lightning + thunder every so often (see 3.4).
- Blood pools spread under corpses over ~5 s and stay.

---

## 8. Game loop, HUD, audio
- Title card "NOIR EXTREME" in a condensed serif with an ink-splatter behind
  it; "click to begin" → pointer lock. Ammo (bottom right, typewriter-ish
  font) while a gun is out, health shown as an ink bar that bleeds red when
  low; damage vignette in red. No counters and no cards between fights.
  "THE END" card on death, with the kills and "click to try again".
- Fights are scripted encounters (`src/game/Director.js`).
- Audio: all procedural Web Audio — rain bed (filtered noise + drips), thunder,
  Tommy gun (noise burst + low thump, per-shot pitch variance), pistol crack,
  ricochet, glass, explosion (sub + noise tail), fire crackle, train rumble,
  footsteps on wet stone, distant sirens/jazz? (skip jazz; keep it sparse).
  Master volume + a mute key `M`.

---

## 9. Debug / screenshot mode (required — the builders and critics rely on it)
The dev server runs at http://127.0.0.1:5173 and `tools/shot.sh` takes a
headless screenshot: `tools/shot.sh shots/name.png "shot=street" 1600 1000`.
The app must honour these URL params:
- `shot=<preset>`: skip title screen, no pointer lock needed, deterministic RNG
  seed, place the camera at a named preset. Provide at least:
  `street` (reference-like view down the avenue under the overpass),
  `lamp` (close to a lamp cone with rain), `cars` (a couple of cars, 6 m away),
  `hood` (a Hood 5 m away in aim pose, facing the camera, plus one at 25 m),
  `hoods` (a firefight staged: 4 Hoods at 8–30 m in mixed poses, one dying
  with blood), `wreck` (a burning car).
- `t=<seconds>`: fast-forward the simulation clock by that many seconds after
  load (run fixed-step updates) so staged effects are in a known state.
- `hud=0` hides the HUD. `debug=1` shows the stats overlay.
Also expose `window.__noir` with the scene, pipeline, and a `spawnHood(pos)`
helper for manual poking in the browser console.

**Error capture (required):** `main.js` creates a hidden `<div id="errlog">`
and appends every `window.onerror`, `unhandledrejection`, and `console.error` /
`console.warn` message to it (wrap the console methods; Three.js reports shader
compile/link failures through `console.error`). It also sets
`errlog.dataset.frames` to the number of frames rendered so far. `tools/errors.sh
"shot=street"` dumps both headlessly; run it after every significant change.

---

## 10. Code layout
```
src/
  main.js                 bootstrap, resize, loop, url params
  render/Pipeline.js      render targets, passes, resize
  render/shaders/*.js     GLSL strings: ink.js, ground.js, cone.js, rain.js, bloom.js
  render/textures.js      canvas-generated noise/brush/paper/streak/splatter textures
  world/World.js          the Stage base: engine services, parts, anchors, surface, look
  stages/<name>/          a place: index.js + parts/*.js (the block: street, overpass, facade, ...)
  world/*.js              one module per structure
  fx/*.js                 MuzzleFlash, Blood, Decals, Particles, Explosion, Steam, Lightning
  player/Controller.js    movement, look, pointer lock, collision with props
  player/Weapon.js        Tommy gun logic + Viewmodel.js
  enemies/Hood.js         model + procedural animation
  enemies/HoodAI.js       state machine, cover, shooting
  game/Director.js        encounters (scripted fights)
  audio/Sfx.js            procedural sounds
  ui/Hud.js               DOM overlay (title, hud, end card)
  debug/Shots.js          camera presets + staged scenes for ?shot=
```
Plain ES modules, no TypeScript, no framework. Keep functions small; comment
the *why* of shader tricks.

---

## 11. Phasing & acceptance
- **Phase 1 – Foundation & environment**: pipeline, ink post, ground
  reflections, lamps + cones, 3D rain, overpass, façade, skyline, static cars,
  fog, first-person movement. Accept when `shot=street` looks like the
  reference with the figures removed.
- **Phase 2 – Combat**: Hoods (model, animation, AI), Tommy gun viewmodel,
  muzzle flash, blood, hit reactions, deaths, player damage, HUD.
  Accept when `shot=hoods` looks like the reference *with* the figures.
- **Phase 3 – Reactivity & polish**: destructible cars/lamps/windows,
  explosions and fire, decals, train, lightning, audio, title/end cards,
  performance. Accept when a 2-minute play session
  feels alive and stays at 60 fps.

Every builder must take its own screenshots with `tools/shot.sh`, look at them
next to the reference, and iterate before declaring done. "It runs" is not
done; "it looks like the reference" is done.
