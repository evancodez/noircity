# G8 — the whole of game two: by hand and by the whole play, the seams, the middle everywhere, the documents

Branch `game-two/G8-whole`, port 5368. The last lane, after G1 to G6 are
merged. Lane C10's brief (`docs/story/briefs/C10_WHOLE.md`) and its two
reports (`C10a.md`, `C10b.md`) are the pattern; the whole play tool is
`tools/lib/whole.py` (it writes `tools/plays/whole.json`), the hunts
`tools/hunts/*.mjs`, the frame table `tools/fpstable`. The user's words:

- **[must]** "a new experience that works on its own": game two plays
  from the title to the end with no seam that breaks, no save that
  strands, no chapter that does not know the one before it.
- **[must]** "easy to grasp... a huge thing in the middle": the same rule
  of cards, nudges and fails everywhere, and no more words than that.
- **[must]** "fewer glitches", "it all looks good".

## 1. The whole play
Bring `whole.py` to game two's order (no office, VI The Run) and run the
whole game from BEGIN to the end by real input, twice: once by the good
hands, once by the medium ones. Every seam (I to II, II to III's
corridor, III's window to IV, IV into the car, V's wreck into VI, VI's
gate into VII, VII's car into VIII, VIII's end): no fade that was not
meant, the carry right (the check, the revolver and its count, the
shells, the Tommy gun), the music rule, the stills where WAVE_C §5 and
GAME_TWO §2 put them. CONTINUE at every checkpoint of every chapter
(`tools/hunts/mksaves.mjs`): the world as it was. A save from game one
at the parked office continues at III. The title's CHAPTERS shows the
eight. The pad through the whole game by `?padfake=1`.

## 2. The middle, audited
One table in the report: every card id, the chapter and moment it is
first taught, its nudge rule, the fails whose black names it. The whole
game teaches at most a dozen cards. Any place a player can stand not
knowing what to do for 10 s without a nudge is a finding to fix (with
that chapter's owner's levers, marked `[G8]`). Any card that comes in
danger, or twice at once, or writes a key as text, fixed.

## 3. The hunt
The hunts (`wavec.mjs`, `pile.mjs`, `edges.mjs`, `brawl.mjs`) on the new
and changed chapters: ten retries at every checkpoint (nothing piles up:
GPU geometries, listeners, timers), the edges of every place (nothing
unfinished), the bodies (nothing blocks feet), the cars (nothing through
anything), the doors (nothing through a body). Errors clean on every beat
of every chapter. The fps table at every chapter's heaviest moment
against `shot=perf`, with the number before (the lanes' reports) and
after.

## 4. The look, once over the new places
The Run's streets, the pier's yard and gate, the fight's street, the
chase's new stretches: each first frame against the reference (pools and
ink, paper white 5 to 8 %, no grey); fix what a lane left (its `left`)
if it is an hour's work, else write it.

## 5. The documents
`README.md` (how to play game two by hand: what to press in each
chapter, in order; game one at its tag and port), `docs/story/STORY.md`
(game two as built), `docs/story/ARCHITECTURE.md` §12 (game two as
built: the parked scenes, the new chapter, the gun kit's post, the car's
damage, the destruction set), `docs/story/MUSIC.md`, `GUNS.md`,
`FIGHT.md` consistent with the code. Nothing deleted: the parked office
and stealth stay in the tree and are listed as parked.

## 6. Gate
Build; golden identical or every change named and shown; the whole play
twice; errors on every beat; the saves; the pad; the fps table; the
report `docs/story/reports/game-two/G8.md` with "What the user should
feel", "Found and fixed", "The middle, audited", "Left". Hours, not a
day.
