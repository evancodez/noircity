# Phase 1c polish — art director's list (do in order, keep it tight)

The environment passes. These are the visible flaws that remain in every
frame; fix them without disturbing what works (dark road with light columns,
thin lattice el, lamp cones, rain, façade, car silhouettes). Judge by eye
against `reference/noir_reference.png`.

1. **Skyline towers must be flat fogged silhouettes.** Every far tower currently
   carries the façade's white dry-brush slashes and a crisp contour at ~0.22
   tone (street x 700–1250 y 110–400; worst in the lamp preset). The reference
   towers are soft flat grey with a handful of window flecks and no line work.
   `ink.js`: zero stroke coverage and no contour/edge for skyline ids (give the
   skyline its own id range or a flag in the id buffer); `Skyline.js`: tones
   0.30–0.38 display, mixed toward the fog colour with distance so the step
   against the sky is a soft 0.06–0.10, not a dark cutout. Lift the sky/fog
   colour ~0.06 display (reference sky ≈ 0.48) and re-check the step.
2. **Near cars always print black.** In the lamp preset the car under the el lamp
   (x 1350–1560, y 700–830) and the crate beside it print as light-grey outline
   art. `Cars.js`: cap the body's diffuse response so a lit body never exceeds
   ~0.10 display (very low albedo, high roughness), keeping only the specular
   rim; `Props.js`: crate gets the unlit black material. Check every car in
   street/lamp/cars stays a black silhouette with fine rim highlights.
3. **Road column density.** Street x 500–1100 has six or seven columns side by
   side; the reference has about four with clear dark road between. In the
   bright pass (`Pipeline.js`) weight small/distant emitters down (windows and
   hanging lamps beyond ~30 m leave thinner, dimmer columns), or scale the
   column term in `ground.js` by ~0.5 beyond 30 m.
4. **Near-field water.** Cars preset x 0–750, y 700–1000: the grey wash is all
   6:1 hard-edged horizontal streaks. Build the near blot mask from thresholded
   low-frequency fbm / cellular noise (~1.5:1 aspect, ragged edges) and cut
   dash density inside the wash band to ~30 %; keep the ripple rings.
5. **Far mist pools.** Cap 0.55 → 0.48 and shrink pool radius to ~4 m for lamps
   beyond 40 m so the far plate under the vanishing point stays separate pools,
   not one bright patch (street x 740–900, y 560–610 should read ~0.37).
6. **Façade stroke density.** Strokes cover every block at the same density.
   Gate the stroke field with a low-frequency world-space mask (3–5 m cells,
   ~40 % coverage) so strokes gather on some blocks and others stay flat dark
   grey. (World-anchored sampling only — see DESIGN.md §3.4.)
7. Cars preset nit: nudge the camera x +0.4, yaw −0.05 so the column clears the
   near sedan's rear. Do not return to the old framing.

Verify with `tools/errors.sh` and fresh `street`, `lamp`, `cars` shots at
1600×1000, viewed next to the reference.
