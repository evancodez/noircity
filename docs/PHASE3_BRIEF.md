# Phase 3 brief — a world that reacts, sound, and the final beauty pass

Phases 1–2 delivered the look and the fight. Phase 3 makes the block answer
to the player, adds sound, and closes the gap to the reference in every
frame. Rules from DESIGN.md still hold: only blood and fire carry colour;
tonal textures are world-anchored; Hoods stay black silhouettes at distance.
Judge every change by eye against `reference/noir_reference.png`.

Delivered in two sequential steps with their own review: **3a — reactivity
and audio**, then **3b — over-the-shoulder camera, title/end presentation,
performance and the beauty pass**.

---

## 3a. Reactivity & audio

### Destructible cars (`src/world/Cars.js`, `src/fx/Explosion.js`, `src/fx/Fire.js`)
- Damage states: headlights break (light off, glass shards), windows
  spider-crack (decal) then shatter into falling shards, body takes dark
  bullet decals, tyres hiss and sag. Enough damage → grey smoke from the
  bonnet (10 s warning, Hoods relocate away from it) → **explosion**: a
  yellow/orange fireball (the second permitted colour: saturated, bright,
  printed through the same colour keep as blood with a lift so it reads as
  fire not brown), a brief white flash `PointLight`, a shockwave ring on the
  wet street (`street.addImpact`), chunks (door, bonnet, wheel) tumbling with
  gravity and bounce, casings-style ticks. Kills Hoods within ~5 m, damages
  the player within ~8 m.
- Aftermath: a blackened wreck (same silhouette, sagging) with **fire** —
  flickering orange particle flames on the engine bay, a warm flickering
  `PointLight` (the wet street reflects the fire in a warm column: the
  reflection bright pass must keep the fire's chroma), and a rising black
  smoke column (grey/black particles, additive-free, inked as soft dark
  wash). Fire dies down over ~90 s to embers.
- Cars stay usable as cover while intact; a burning wreck is hot (small
  damage tick if the player stands in the flames).

### Lamps, windows, props
- Streetlamps: shoot the head → glass shatter, sparks, light + cone off (the
  rain inside its cone goes dark). Some lamps flicker on their own already;
  a shot lamp may buzz back on for a moment then die. Hanging lamps swing
  slightly when hit (cone swings with them).
- Façade windows: shatter on hit (shard particles, dark hole decal, the lit
  ones go dark). Steam grates puff harder when shot. Trash cans dent/tumble,
  the phone booth's glass breaks, the hydrant can be shot open into a
  white water plume (monochrome) that ripples the street.
- Puddles ripple from footsteps (player and Hoods), bullets and casings.

### The train (`src/world/Train.js`)
- Every ~40 s a train crosses the el: a dark silhouette of carriages with
  lit windows strobing light onto the street below (moving spot/point lights
  or a projected lit-window texture), sparks at the wheels on the curve, a
  deep rumble that swells and fades, the cones of the hanging lamps
  trembling. Its window light reflects in the wet street as moving columns.
  Timed so it never happens during the intermission card.

### Lightning & thunder
- Every 25–60 s: `pipeline.pulseLightning` with a brighter sky, a one-frame
  inversion feel (the ink tone curve kicks), longer rain streak visibility,
  then thunder 1–3 s later. Occasionally a double strike. Never during the
  first 5 s of a wave.

### Audio (`src/audio/Sfx.js`, all procedural Web Audio, no assets)
- Rain bed (filtered noise with drips and gusts), distant thunder, the
  Tommy gun (noise burst + low thump + mechanical click per shot, slight
  pitch variance, a tail in the street), pistol cracks (Hoods, with
  distance/reverb), ricochets, glass, the explosion (sub + noise tail +
  debris ticks), fire crackle loop, train rumble + wheel squeal, footsteps
  on wet stone for player and Hoods (distance attenuated), reload sounds,
  hit grunts and death cries (short filtered noise/formant bursts, not
  cartoonish), the heartbeat when low. A master bus with a gentle
  compressor; `M` mutes; volume persists in localStorage.
- Positional: `PannerNode` per emitter for Hood shots, footsteps, fire, train.

### Verification for 3a
- `shot=wreck&t=<s>`: a car shot to the smoke state at t=0, exploding at
  t≈3, burning after — screenshots at t=2.9, 3.1, 3.4, 8, 40 must show smoke,
  the fireball, chunks in the air, the burning wreck with its warm street
  reflection.
- `shot=train&t=<s>`: the train mid-crossing with window light on the street.
- `shot=battle&t=45` now includes at least one wreck and a shot-out lamp.
- errors.sh clean on all; fps still 60 with a burning wreck + 12 Hoods.

---

## 3b. Presentation, camera, performance, beauty pass

### Over-the-shoulder camera (`V` toggles)
- The player's own Hood-model body (a distinct variant: longer coat, the
  Tommy gun) rendered large in the bottom-left, camera behind the right
  shoulder, aim converges on the crosshair, coat and hat react to movement.
  Recreates the reference composition exactly; `shot=ots` shows it.
- Must not compromise first-person: the body is hidden in first-person
  except for the viewmodel.

### Title / end presentation
- Title card: "NOIR EXTREME" in a condensed serif over an ink splatter, the
  street live behind it with a slow camera drift, rain audible; "click to
  begin". Wave cards. "THE END" card with kills/waves and a one-line noir
  epitaph chosen at random. All ink-styled DOM, no colour except a single
  red splatter accent.
- Pause on pointer-lock loss with a dimmed ink card.

### Performance pass
- Profile with `__noir.bench()`; target 60 fps at 1440×900 with a burning
  wreck, 12 Hoods, blood, train and lightning. Typical wins: half-res
  volume pass already; consider quarter-res rain buffer, LOD for far Hoods
  (exists), decal pooling, shadow map count, skipping the id pass on the
  viewmodel where possible, fewer bloom levels. Report before/after.

### Beauty pass (with the art director)
- Compare `street`, `hoods`, `battle&t=30`, `ots` against the reference one
  last time: tone, edge quality, rain, reflections, cones, figures. Fix
  whatever still snags the eye. This is the last look at the game as a
  piece of art.

### Verification for 3b
- `shot=ots`, `shot=title` (title card over the live street), `shot=end`.
- A two-minute autopilot session (`shot=battle&t=120`) renders, errors.sh
  clean, counters sensible, fps numbers reported.

---

## Preamble for 3a — leftovers from the combat review (do these first, quickly)
1. **Staged `hoods` preset composition**: move the dying man ~1.5 m left and
   3–4 m deeper and re-aim the scripted burst so the player's flash sits clear
   of the red burst (60–80 px gap); keep both in the lamp cone.
2. **Hood muzzle flash at distance**: beyond ~15 m use the spiky starburst
   variant with a ~48 px screen-size floor, no random off-centre rotation,
   anchored to the gun-hand bone, so the far shooter shows a crisp white spike
   at the pistol like the reference.
3. **Wave pacing**: no 20 s lull. Spawn at 30–45 m (or behind nearer cars),
   stagger a wave over 4–6 s, let the first two Hoods run to 25 m and fire a
   volley from the first cover, so shots resume within ~6 s of the wave card.
4. **Damage splatter vs HUD**: keep the screen splatters clear of the wave/kills
   and health boxes (or layer the HUD above), and draw them from the jagged
   canvas splatter generator, not flat discs with drips.
5. **Muzzle smoke**: a visible soft grey puff (~0.3 m, mid-grey with the brush
   texture as alpha, lit by the flash light for ~100 ms) after each burst.

---

## Preamble for 3b — polish left over from the 3a review (do first, quickly)
1. **Train light on the street**: raise the near-car spot and pool strobe for
   cars within ~30 m and brighten the shaft cone so the strobe lands on the
   street and its reflection; give the two nearest cars' wheel sparks a small
   floor so a mid-crossing frame shows them.
2. **Fireball glow rim**: modulate the fireball's glow with the world-space
   brush alpha and cut the halo radius ~40 %, keeping the white-hot core, so
   it reads as ink rather than a bloom aura.
3. **Blast smoke lobes**: spawn the first-frame smoke with the brush puff
   texture used by the fire column (fewer, larger, ragged lobes, alpha ~0.6).
4. **Muzzle smoke**: mid-grey puff (col ~0.35, alpha 0.35–0.45, 0.25–0.35 m)
   lit by the flash for ~100 ms; add a `vmpuff=<s>` param to the viewmodel
   preset so a post-burst puff can be captured.
5. **Explosion loudness**: bring the offline peak to ~0.9 (scale the sub +
   noise tail ~0.85 or add a per-voice limiter).
6. **Fire taper**: start the taper at ~25 s so t=40 reads as a lower, hotter-
   cored blaze.
7. **Performance headroom is thin** (uncapped ~72 fps avg with 10 Hoods, one
   wreck, particles; bench 23.3 ms): this is the 3b performance pass.
