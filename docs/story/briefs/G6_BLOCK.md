# G6 — VIII The Block: the kitchen finished, the street with real cover play, the Cardinal

Branch `game-two/G6-block`, port 5366. Chapter VIII as built by lane C8
(`src/scenes/09_shootout.js`, `scenes/shootout/{nick,street,boss,rails,rig,room,carOut,hydrant,ending}.js`,
the block `src/stages/block/`; report `C8.md` and its `Left`; C10b's
fixes to its retries and its geometry). Lane C8b built the diner's
kitchen as a room with the back way and the flank through its doors,
gated (golden 38/38 identical) and handed over on branch
`wave-c/C8b-kitchen` (its report is on that branch:
`docs/story/reports/wave-c/C8b.md`; its brief `C8B_KITCHEN.md`).
**Before you build: `git merge wave-c/C8b-kitchen` into your branch,
resolve (C10b touched the same scene: the saloon's tick, the rails'
dispose), build, play it; its `Left` is yours.** Lane G2's gun kit feel
is merged: build on it. The user's words:

- **[must]** "the shooting sections": "way smoother", "more fun", "easy
  to grasp"; "destruction", "environment", "interactions actually
  working, fewer glitches".
- Still binding from wave C: the nick of time and the waitress twist
  (she arms me); the street shootout with cover and strategy; cars never
  through cars; men enter the frame naturally; the head man fun to take
  out, not trivial, not a sponge.

## 1. Feel (G2's numbers hold; the Tommy gun is this lane's)
The Tommy gun on the press, its bursts climbing (a long burst walks
up: short bursts are the skill), the recoil in the frame, the cases,
the hits reading on men and on things (the cars' metal, the glass, the
plaster, the hydrant); the reload (the drum) with the feet free; no
lock, no pop. The street's cover: the cars (chewed, their glass going),
the hydrant, the el's columns, the newsstand, the diner's doorway; C to
drop behind, RMB to rise. Dot out of my way behind the counter (C8
Left 3: her keep-off closes the aisle: a place for her that is not the
aisle, or a smaller keep-off).

## 2. The middle
`block_medium` through the nick, the street, the flank, the cars and
the Cardinal in one to three tries each; `block_good` twice; `block_bad`
by the fourth; `block_idle` dies, warned, at each. Cards: `[LMB] fire`
as the Tommy gun is taken (as now), `[C] get low` again only if the
player stands in the street under fire 4 s (the nudge); the fail's black
names the fix. The objective line through the chapter: `Dot.` / `The
street.` / `Behind you: the kitchen.` / `His car.` / `The Cardinal.` or
better words. Fewer than C8's five minutes for a sure hand is fine;
longer for a medium hand is fine.

## 3. Everything works and the street's play
1. Cars never through cars (C8 Left 6: `rails.ahead()` sweeps only
   ahead; a car swinging into one beside it is not checked: fix it), nor
   through men or me (a car that would hit me is the fail, warned by its
   lamps and its horn); men come into the frame from doors, the alley's
   mouth, the el's stair, a car's door, never spawned in view.
2. The flank through the kitchen (C8b) finished: the swing door, the
   back door's bolt (the choice), the man through it; the hatch stays a
   hatch.
3. The Cardinal: his car, his two men, then him: a fight with a shape
   (he moves between covers; his tell; one thing of his own, say the
   cigar's ember in the dark giving him away). Not a sponge: the kit's
   numbers, more cover, not more health. His hat in the wet street: the
   last still as WAVE_C §5.
4. The interaction walk of the diner and the street: the phone, the
   jukebox, the door, the counter's things, the cars' doors, the
   hydrant (shot: water), the newsstand, the alley's door; bodies never
   block feet; the jank walk of the kitchen and the street with men and
   cars coming.
5. Destruction seen: the cars' glass and metal, the diner's window, the
   hydrant, the newsstand's papers, the el's lamp; capped; fps at the
   flank and at the cars.

## 4. Proofs and gate
`block_idle`, `block_bad`, `block_medium`, `block_good` twice,
`block_nick` with the kitchen way, `block_bolt`, `block_jank` (the
kitchen and the street), a cars-beside bench; the seam from VII
(`c10b_seam_loud_nick`) and the end; the latency numbers; the
interaction walk; golden identical (C8b kept it); errors on every beat;
the pad play. Report `docs/story/reports/game-two/G6.md`. Hours, not a
day.
