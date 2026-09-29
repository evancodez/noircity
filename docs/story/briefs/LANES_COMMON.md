# Wave A — what every lane does (read before your own brief)

You are one of seven builders working in parallel, each in your own git
worktree, each owning its own files. The art director (Fable) wrote the
briefs and will judge your frames against `reference/noir_reference.png` and
the golden frames. An integration agent merges the lanes afterwards in the
order 1, 4, 5, 3, 6, 2, 7.

## Read first
1. `reference/noir_reference.png` (look at it; look again whenever you judge
   a frame)
2. `DESIGN.md`
3. `docs/story/STORY.md`
4. `docs/story/CONTRACTS.md` (binding) and `docs/story/ARCHITECTURE.md` (how
   the foundation actually built it)
5. your own brief, then the code you own

## Set up
```
cd <your worktree>
git switch -c wave-a/<your branch>          # named in your brief
npm ci
NOIR_PORT=<your port> npm run dev &         # your own dev server
export NOIR_PORT=<your port>                # every tool reads it
python3 tools/golden.py check street        # sanity: IDENTICAL
```

## Rules
- Edit only the files you own (CONTRACTS §1). Presets go in
  `src/debug/shots/L<n>_*.js`.
- Other lanes' systems exist as **stubs** from the foundation. Build against
  the API, not against the stub's insides. If an optional API may be missing,
  call it with `?.`.
- The look is locked. Run `python3 tools/golden.py check` before you finish;
  every changed frame must be a change your brief lists as intended. Never
  run `golden.py accept`.
- Determinism, procedural assets, no new dependencies, no new real lights
  without measuring (CONTRACTS §0).
- Work in priority order: **P0** first and completely, then P1, then P2.
  A finished P0 that looks right beats a half-done everything.
- Judge with your eyes. Take the screenshot, open it, compare it with the
  reference and with what the brief describes, fix what is wrong, repeat.
  Crop and enlarge details (`python3` with PIL is available) when a shape is
  small. Do not report a thing done that you have not looked at.
- Ink discipline: smooth forms (lathes, bevels, capsules; no facets at
  arm's length), black masses with a few light ticks, no gloss, no modelled
  faces, no regular grids or stripes as shading. When in doubt, make it
  black and let the contour and one highlight carry it.
- Commit on your branch as you go; message ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Do not push. Do not merge. Do not touch `main`.

## Your report (structured)
- what you built, by priority item, and what you did not finish
- presets: the exact query strings that show each item
- the golden table (paste it) and which changed frames are intended
- `tools/errors.sh` result for each of your presets
- frame rate if you touched anything per-pixel or added geometry
  (`UNCAPPED=1 node tools/fps.mjs "shot=perf&t=1&anim=1" 1440 900`)
- contract deviations and anything the integration agent must know
- your branch name and last commit hash
