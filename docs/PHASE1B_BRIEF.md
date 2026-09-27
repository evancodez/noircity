# Phase 1b brief — from the art director

The Phase 1 build is a strong foundation: mid-grey storm sky, black ironwork,
lamp heads and cones, lit rain, dry-brush façade, 1930s car silhouettes, and
the cars-preset skyline are all right. Three things stop the street preset
from passing as the reference, and they have resisted two rounds of tuning
because they are *model* problems, not parameter problems. Fix the model.

Judge with your eyes against `reference/noir_reference.png`. Pixel statistics
are only for confirming a visual read, never a target to chase.

---

## 1. The wet street (highest priority)

### What is wrong
`shots/crit2_street.png` bottom-centre: the road is a white lake with black
holes. The reference road is the opposite: **dark asphalt** with a **distinct
white column under each light**, the columns broken into short horizontal
dashes, and only sparse pale dashes elsewhere. Root cause in
`src/render/Pipeline.js` + `src/render/shaders/ground.js`:
- the reflection RT is cleared to the fog colour and rendered with fog, so the
  grey sky and the fogged-out distance come back as "light" across the whole
  road;
- `rBlur * smoothstep(0.07, 0.19, ...)` lets that sky/mist through;
- the `rCol` horizon-compression hack (`mix(uReflHorizon.y, ruv.y, 0.3)`) turns
  everything near the horizon into a column, so the entire road width earns one;
- the dash gate then prints it all as white foam.

### The model to implement (replace the rBlur / rCol / dash / sheen tangle)
**A. Reflection source = emitters only.**
Render the mirrored scene with clear colour **black** and, for that pass only,
fog colour black (swap `U.uFogColor` and the scene fog colour to black around
the reflection render, restore after). Keep rendering cones/mist/lamp heads/
lit windows/headlights into it. Then a **bright pass**: `keep = max(0, lum - T)`
with `T` set just above the linear value of lamp-lit stone (so only emitters,
cone cores and hot lit spots survive; a wet dark car body does not).

**B. Long vertical streak filter** (replace `makeStreakMaterial`'s 21-tap
blur): ~40 taps stepping in the screen-down direction (toward the viewer; check
the RT's flip) with geometrically growing step so the kernel reaches ~45 % of
the frame height, weights `exp(-3.5 * i/N)`, plus a 2–3 px horizontal spread.
Quarter res is fine. Result: every emitter leaves one column, brightest at the
emitter and fading smoothly down the frame; the sky leaves nothing.

**C. Ground shader composition** (`ground.js`):
```
base    = dark asphalt: display ~0.06–0.12 with grain; ink blobs dead black
sheen   = fogColour * fresnel(grazing) * 0.15, * (puddle ? 1.0 : 0.35)
          -> the dark-grey wet look between streaks; in puddles multiply by
             (1 - coverage) where coverage = reflection RT alpha (geometry = 1,
             cleared = 0) so the water under a car or column goes BLACK
column  = streakTex(ruv + rippleDistortion)          // from B
dash    = horizontal ripple dashes, world-anchored (row pitch ~0.2–0.35 m in z
          so rows are taller near the camera and compress with distance; fade
          the mask to its mean when a row is < 2 px), ragged ends via the brush
          texture; coverage ≈ 55 % inside columns, ≈ 12 % elsewhere
refl    = column * (0.55 + 0.45 * dash)   // a column stays a column; dashes texture it
        + sheen * (0.4 + 1.2 * dash)      // sparse pale dashes on dark asphalt
        + rSharp * puddle * 0.5           // puddles: sharp mirror, including dark shapes
final   = ambient*base + direct(wetBRDF) + refl, then fog
```
Give the ground **4 ink bands** in `ink.js` (not 2) so dark grey survives
between black gaps and white dashes. Target read: 60–70 % of the road area is
dark (display < 0.15); one unmistakable column under the near lamp, one under
each hanging lamp and headlight; sparse horizontal dashes; near-field ripple
rings visible as thin light arcs within ~10 m; ink-splatter blobs visible in
the bottom of the frame like the reference.

## 2. Far mist / white wall
`crit2_street` x≈600–1100, y≈540–600 is a flat white wall. In the reference
the far street is a *soft mid-grey mist* and the far car and columns are still
legible against it. In `src/render/shaders/mist.js` / `fx/GroundMist.js`: cap
the mist at ~0.55 display, make it pool under lamps (Gaussian radius 4–6 m)
instead of a uniform band from 28 m, billow with low-frequency noise. Because
the reflection now uses a bright pass, the mist will no longer flood the road;
keep it under `T` except in the lamp pools.

## 3. The elevated railway
`crit2_street` top-right is an opaque black slab covering ~30 % of the frame,
the deck edge runs off the top, no sky between members. Reference: the el is
**further away** (nearest columns ~15–25 m from the camera), it sits in the
upper third, its deck is a **thin band** (~1.2 m) with an **open lattice
railing** above it (sky visible through posts and diagonals), and beyond the
nearest span it is dark grey, not pure black (aerial perspective).
- `src/world/Overpass.js`: shift the curve ~8 m to +x near the player so the
  nearest column pair is ≥ 14 m right of the street-preset camera (e.g. control
  points `(48,170) (30,100) (19,45) (13.5,0) (10,-40) (6,-80) (1,-118)` then the
  existing far points), keep it crossing over the avenue far ahead. `deckY`
  ≈ 9.5. Solid band (girder web + slab) ≤ 1.2 m tall total; lattice railing
  1.3 m tall with 0.08 m posts every 1.7 m and 0.06 m X-diagonals, top rail.
- `src/render/shaders/ink.js` line ~163: let iron lift toward 0.25–0.3 display
  beyond ~20 m (the two nearest columns stay pure black).
- `src/debug/Shots.js` street preset: recompose so the deck top edge and railing
  are inside the frame, the el occupies the top-right third, the vanishing
  point sits ~45 % across and ~55 % down, camera eye height ~1.7 m.

## 4. Skyline in the street preset
Straight down the avenue there are only a few tiny spires (x≈770–800,
y≈230–300). The reference has a cluster of tall deco towers filling the centre
between the lamp and the el, soft dark-grey with a handful of window flecks —
exactly what the cars preset already shows. Find out why they are absent
straight ahead (ring gap? fogged to invisibility? occluded by the mist slab?)
and fix it: in the street preset the vanishing point must be backed by towers
spanning ~35–60 % of the frame width and rising to ~15–40 % from the top, at
display tone 0.3–0.45, fogged (soft, unlined) edges.

## 5. Secondary (do after 1–4, cheaply)
- Façade: it is the brightest large surface (~#4a). Darken to ~0.12–0.2 display
  with the lighter dry-brush strokes on top; ledges should not be heavy black
  bars — thin shadow lines with ragged ends.
- Hanging-lamp cones (`Lamps.js addHanging`, `cone.js`): they read as lit
  canvas tents with a uniform fill to the floor. Use the street-lamp cone
  falloff: brightest near the apex, fading to nothing by ~65 % of the height,
  softer edges.
- Rain over near black surfaces: outside cones it should be barely visible
  (the reference rain only lights up inside beams).

## Verification
`bash tools/errors.sh "shot=street"` clean; then `tools/shot.sh` for
`street`, `lamp`, `cars`, and `street&t=8` at 1600×1000; view each next to the
reference. Do not report done until the street preset shows: dark road with
distinct light columns, a thin open el in the top-right third, towers behind
the vanishing point, and a soft grey (not white) far end.
