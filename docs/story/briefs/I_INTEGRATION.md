# Integration brief, Wave A (step 4)

Seven lanes built in parallel against stubs. You put them together so that
the game plays scenes 1 and 2 with every lane's real work in it, and every
fix from the user's list shows on the block. One agent, in order, with a
gate after every merge.

Read first: `docs/story/CONTRACTS.md` (with its Deviations),
`docs/story/ARCHITECTURE.md`, `docs/story/STORY.md`, every lane brief in
`docs/story/briefs/`, and the lane reports the art director gives you
(what each lane built, its presets, its notes for you).

## Where
The main checkout, `/Users/evansmac/Downloads/eprojects/noirextreme`, on a
new branch `wave-a/integration` cut from `main`. The dev server on port
5173 is yours. Do not push; do not touch `main`; never run
`golden.py accept`.

## Merge order and the gate
Order: lane 1 (render), 4 (street), 5 (interiors), 3 (destruction),
6 (characters), 2 (hands), 7 (story). For each lane:
1. `git merge --no-ff wave-a/L<n>-<name>` (use the branch and commit the
   art director lists; a fix-round branch replaces the lane's first one).
2. Resolve conflicts. Ownership makes them rare; where two lanes touched
   one file, the owner's version wins and the other lane's intent is
   re-applied by hand on top.
3. **Wire it.** A lane built against stubs; now the real thing is there.
   Make every cross-lane call meet its real counterpart: signatures, mark
   names, anchor names, prop kinds, accent keys, surface tags, breakable
   kinds, sound names. You may edit any file for wiring, the frozen ones
   included. Keep wiring thin: a call, an adapter, a renamed mark. If a
   lane's work is wrong or missing, do not rebuild it: record it for the
   fix round.
4. **Gate**: `npm run build`; `bash tools/errors.sh` on `street`, `hoods`,
   `battle&t=30`, `wreck&t=8`, `title`, `scene=diner&beat=settle`,
   `scene=fight&beat=round1`, and the merged lane's own presets; then
   `python3 tools/golden.py check` with `ALLOW` set to the union of the
   intended changes of the lanes merged so far. A frame that changed
   and is in nobody's intended list is a defect of the merge: find it.
5. Commit the merge and its wiring as separate commits.

## After the last merge
- Every preset of every lane renders clean (`tools/errors.sh`).
- `node tools/playtest.mjs` passes; `node tools/play.mjs
  tools/plays/slice.json` plays the title, scene 1 and scene 2 by real
  input to the matchbook, every expectation true.
- `?autoplay=1` plays the slice on its own.
- The diner is always drawn (no far / near swap of the building).
- Frame rate on a quiet machine: `UNCAPPED=1 RUNS=3 node tools/fps.mjs
  "shot=perf&t=1&anim=1" 1440 900` and the same for
  `scene=fight&beat=round2&anim=1` and `shot=dinerwide&anim=1`. The target
  is 60 fps at 1440x900 with headroom (the foundation measured 91 on the
  street). If a merge costs more than 5 %, find which lane's work costs it
  and say so.
- Capture into `shots/check/`: every golden preset, every lane preset,
  every beat of scenes 1 and 2.

## Report
- per merge: conflicts, what you wired, the gate's result;
- the final golden table and, for every changed frame, which lane changed
  it and whether the change is confined to where that lane's brief says;
- defects you found and did not fix, each with a preset or a way to see
  it, and the lane it belongs to;
- frame rates;
- the full list of presets and beats with their query strings.
