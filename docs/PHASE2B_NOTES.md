# Phase 2b notes — art director's additions to the combat brief

Read together with `docs/PHASE2_BRIEF.md` §2b. The Hood (2a) is accepted at
close range: silhouette, walk, aim, flinch and the deathBack all read. Do the
small character polish items below FIRST (they are quick), then build combat.

## Hood polish (from the 2a review; all in `src/enemies/`)
1. **Pistol in profile**: lengthen the slide/barrel so ≥ 0.10 m projects past
   the fist, thin the fist ~15 %, add a grip stub under the heel of the hand;
   let the top of the slide catch a thin rim so it separates from the fist.
2. **Settled deathBack pose**: chest ~0.20 m off the ground (ribcage pitched
   ~12°, shoulders back), asymmetric arms (one up beside the head with a bent
   forearm, the other out at ~70° palm up), head rolled ~25°; no plank, no
   cross symmetry.
3. **Coat back**: remove the bright vertical seam down the spine (weld the
   lathe's closing edge / continuous normal) so only the front shows the
   lapel V and "is he facing me" reads at a glance.
4. **Flinch step**: ~6 cm lateral separation on the stepping foot so shins
   never overlap in silhouette; lit trouser surfaces capped lower so a shin
   never prints as a pale slot.
5. **Head profile**: a small nose so profile views carry face direction.

## Ink rules that now exist (do not undo)
- Brush field is world-anchored (`brushWorld()` in `ink.js`); Hoods sample it
  in their own root frame via `uFigAnchor`.
- On Hood pixels the air light (bloom, cones, mist) is painted around the
  figure, never over it (`hoodF` in `ink.js`); rim, crease lines and lift-outs
  fade on Hoods beyond ~10 m so a far Hood is a clean black silhouette.

## Combat verification tooling (required)
- `shot=battle&t=<s>`: the REAL game loop with waves on, a deterministic seed,
  and an **autopilot player** that turns toward the nearest visible Hood,
  fires in bursts, reloads, and strafes between two cover points. After `t`
  seconds of fixed-step simulation the frame shows genuine combat: Hoods in
  cover/advancing/aiming/firing/flinching/dying, muzzle flashes (hold the last
  flash for the frame), blood in the air and on the street, corpses with
  pools, casings. `t=6`, `t=15`, `t=30`, `t=60` must all render and errors.sh
  must stay clean at each. Also expose `window.__noir.sim(seconds)` for the
  same fast-forward from the console.
- `shot=hoods`: the staged reference firefight (brief §2a) — four Hoods at
  8–30 m in mixed states, one mid-deathBack with blood at t≈0.4 s, one firing
  with the flash held. Compose it like the reference (el top right, lamp left).
- `shot=viewmodel`: the street composition with the Tommy gun in frame and a
  muzzle flash held at t = 0.03 s.
- A console/`?debug=1` counter for Hoods alive, shots fired, hits, kills, so
  the critic can confirm the AI actually engages (a battle at t=30 with zero
  Hood shots fired is a failure).

## Performance
12 Hoods + blood + flashes at 1440×900 must hold 60 fps on this Mac (use
`__noir.bench()` and the debug overlay; report numbers).
