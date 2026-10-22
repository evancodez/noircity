# NOIR EXTREME — Game Two: the action cut (the art director's plan)

Game one is what the user played on 2026-10-22: Wave C's eight chapters,
frozen at the git tag `game-one` (served at http://127.0.0.1:5339/ while
the work goes on). Nothing of it is deleted. Game two is a second
experience built from its action sections, on the branch
`game-two/integration`. His words, which are the standard on top of
`docs/story/WAVE_C.md` (read that first: its §1 rules, §2 rulebook, §3 kit
and §7 gate all still bind, word for word):

> Focus on making the game much better in all sorts of ways: interactions
> with the environment actually working, fewer glitches, the gameplay
> smoother. Adding more to it; the gameplay more fun and easier to grasp
> as somebody who's just playing it. It doesn't mean zero skill; it means
> sometimes it's hard to tell what to do, and you also don't want to
> bombard the user with exactly how to do it either. A huge thing in the
> middle.

> Really focus on the shooting sections, the chase sections, the car
> sections and the fist fighting, instead of puzzles, and get rid of the
> stealth. Game two takes those sections you already have, adds some more
> action sections, and makes all of them way smoother. You're not
> deleting the other ones: a new experience that works on its own,
> incorporating the old stuff, putting in new stuff, polishing it all up.
> Make sure it's all in the style and it looks good, feels good, plays
> good; graphics, destruction, environment, gameplay.

Read first, in this order: `reference/noir_reference.png`, `DESIGN.md`,
`docs/story/WAVE_C.md`, this file, your brief `docs/story/briefs/G<n>_*.md`,
then what the brief names. Reports of the lanes that built what you are
polishing are in `docs/story/reports/wave-c/` (their `Left` lists are
yours now).

---------------------------------------------------------------------------
## 1. Three bars on top of Wave C's rules

### A. Smooth: the feel bar
Every lane is judged first by feel, by playing its chapter with real input
and looking at the strips.
1. **Input acts the frame it is pressed.** A click fires or jabs on the
   press; a key moves me at once; nothing waits for a release or for an
   animation to finish (a wind-up is the hold after the press, never a
   delay before it). Measure it: the play tool's input to the first frame
   that shows the act, under 50 ms (3 frames at 60).
2. **The controls are mine.** No animation locks my feet or my eye for more
   than 0.25 s, unless it is a cut the chapter makes on purpose (a still,
   a seam). A vault, a slide, a reload, a door, a take: I keep steering
   through it. A context move (E steps me round a desk) is at most 0.5 s.
3. **The camera never jumps.** Eased always; no pop at a mode change, a
   checkpoint, a retry, a seam.
4. **Every hit reads three ways**: on the body (he flinches, staggers,
   slumps where he is), on the frame (the ink closing, the hit mark, a
   small kick), in the sound. Mine and theirs. A hit nobody can see did not
   happen.
5. **Nothing floats, nothing pops, nothing slides**: feet on the ground,
   bodies with weight, a thing knocked over falls like that thing.
6. **Frame rate**: 60 on the user's Mac at every moment (`shot=perf` ratio
   as before, measured at the heaviest moment; nothing added that costs
   more than it shows).

### B. The middle: the legibility rule
Not hand-holding, not a mystery. Each contest gives exactly this, and
nothing more:
1. **The objective line** (`hud.objective`) from its first second: what,
   in a few words. It changes when the goal changes.
2. **The world says where**: the way is lit, the usable thing looks
   usable, the man coming is seen or heard before he is on me.
3. **One card at the first need** (`hud.teach`, once a save): how, with
   the key drawn. In a safe second, or held (the first dodge, vault,
   crouch).
4. **The nudge.** If the player has not done the one thing that moves the
   contest for a while (the chapter sets it, 10 to 20 s of trying, never
   of watching a cutscene), the card comes once more
   (`hud.teach.again(id)`); at most once a minute; never while a card or a
   warning is up. A player who is doing it never sees it.
5. **The fail says the fix** in six words at most (`game.fail({ why })`),
   and the card for that fix comes again on the retry if it was not
   answered. The retry is in under ten seconds, at the start of that
   contest, with the world as it was.
6. **Never two cards at once, never a card in danger, never a wall of
   text, never a key written as text.** The rulebook's keys stay what they
   are (WAVE_C §2) and the pad mirrors them (`src/input/Pad.js`, lane C12).
7. **Tuned to the middle hand.** The proofs of WAVE_C §7 stay; add one:
   `<id>_medium`, the critic's medium hands (slower than good, not clumsy:
   `tools/plays/critic/` has the profiles). The bar for every contest:
   idle loses, warned; medium gets through in **one to three tries**; good
   wins first time, twice; clumsy gets through by the third or fourth try
   and is never stuck. A contest where medium hands need five tries is too
   hard and is tuned, not explained.

### C. Everything works: the interaction bar
1. **What looks usable is usable**, and the answer is the honest one: a
   door opens or rattles locked, a drawer opens or is locked, a switch
   lights, a bottle breaks, a phone clicks, a horn sounds, a car's door
   opens. The E prompt comes when I look at it and goes when I look away.
2. **Nothing passes through anything** (the jank walk of WAVE_C §7 is run
   in every lane, and against every new thing). Dead men do not block me
   or the living (lane C2b's rule: a body is solid to things, not to
   feet). Cars never through cars, people or walls. Doors never through a
   body: they stop on it.
3. **Destruction is a thing I do and see.** Glass breaks where the round
   went; wood is chewed by fire; a crate, a stall, a lamp, a hydrant, a
   bin goes over when a car takes it and lies where it fell; a car that is
   hit shows it (`src/destruct/`: Glass, Shatter, Breakables, Wreck). It
   is physical (it can stop a man, a car, a round) and it never costs the
   frame rate (caps, pooling, the ink style's own economy: a few strokes).
4. **Where I cannot go, I see why.** Locked, chained, parked, water, a
   wall. Never an invisible wall; never a door that opens on nothing.
5. **Nothing I try breaks the scene** or leaves me stuck: every explore
   ends with the objective still winnable.

---------------------------------------------------------------------------
## 2. The story (the same night, the action cut)

The through line is Wave C §4 with the puzzle and the stealth taken out
and one chapter put in. One night, rain all through it, the Cardinal's
colour red.

1. **The tip** (the opening stills). Ames calls: the Cardinal's men are
   leaning on Dot at my diner.
2. **I The Diner.** I sit and watch. Mack, two stools down, has been
   watching her all night. (Kept as it is; it is short.)
3. **II The Fight.** Mack goes through the window. On him: the red
   matchbook and Ames's card, crossed through in red. Ames is marked.
4. **III The Door.** Room 304: Ames is dead at his desk, his safe open,
   in it the torn guest check in Dot's hand: `PIER 9 · MIDNIGHT · — DOT`.
   I have it wrong: I think she sent him. Then the shadow on the door's
   glass: they have come to clean the office. The first gunfight. When it
   is quiet, the window: a man under an umbrella, looking up. He runs.
5. **IV The Watcher.** Down the fire escape and after him, two minutes on
   foot, to the cars.
6. **V The Tail.** Through the city after his red tail lamps; I put him
   off the road and he says "Pier 9." from the wreck.
7. **VI The Run** (new). They saw. Two of the Cardinal's cars come for me
   as I pull away: a pursuit through the city to the pier's gate, rams,
   a man leaning out with a gun, the streets coming apart as we go. I get
   there, or I do not.
8. **VII Pier Nine.** They know I am coming: out loud from the gate. The
   shed, the stacks, the catwalk gunner, the mezzanine office: Dot's
   photograph crossed in red. Not his girl: his next. The foreman bars the
   way: fists.
9. **VIII The Block.** Back to the diner in the nick of time; Dot lays the
   Tommy gun in front of me; the street, the cars, the Cardinal. His hat
   in the wet street.

**Chapters** (`src/scenes/order.js`): I `diner`, II `fight`, III
`gunfight` (The Door, Room 304 folded into its start), IV `watcher`, V
`tail`, VI `run` (new), VII `warehouse` (loud from the gate), VIII
`shootout`. Parked, not deleted, still reachable by `?start=`: `office`
(the puzzle) and the warehouse's stealth pass (`scenes/warehouse/stealth.js`).

**What I carry**: after II the matchbook and the crossed card; from III
the check and the revolver (loaded, a pocket: the ammo table in
`src/player/weapons/revolver.js` gets game two's rows); V spends the last
of it on his car; VI: a box of rounds in my own glovebox (E in the car as
the pursuit begins, the first reload); VII arrives with what VI left plus
the shells in the office; VIII the Tommy gun.

**Stills**: as WAVE_C §5, with the office's two (the check close, Dot's
shape) played in III at the safe, and one new one before VI (their
headlamps in my mirror: `THEY SAW.`). Few, short, skippable.

---------------------------------------------------------------------------
## 3. The chapters, what each lane does (the briefs have the rest)

| Ch | Lane | In one line |
| --- | --- | --- |
| II The Fight | G1 | the fist fight smooth and in the middle: hits that read, a dodge window a hand can feel, the heavy that makes sense, the room in play, shorter and fairer, a second man |
| III The Door | G2 | Room 304 as a forty-second walk, then the gunfight bigger and smoother; the gun kit's feel for every gunfight after |
| IV The Watcher | G3 | the chase to two minutes (lane C6b's stretches finished), every vault and slide answering the hand |
| V The Tail, VI The Run | G4 | the car's feel and damage; the new pursuit chapter with destruction; the tail's polish |
| VII Pier Nine | G5 | loud from the gate: the shed as a fight with cover, flanks and the catwalk gunner; the foreman |
| VIII The Block | G6 | the kitchen (lane C8b's room finished), the street with real cover play, the Cardinal; cars and men that never clip |
| the whole | G8 | the whole game by hand and by the whole play: seams, saves, the middle rule everywhere, the docs |

Waves: G1, G2, G4 first (disjoint files); then G3, G5, G6 (on G2's gun
kit); then G8. Three builders at a time at most, as before.

---------------------------------------------------------------------------
## 4. Lanes and how to work

| Lane | Branch | Port |
| --- | --- | --- |
| G1 | `game-two/G1-fight` | 5361 |
| G2 | `game-two/G2-door` | 5362 |
| G3 | `game-two/G3-chase` | 5363 |
| G4 | `game-two/G4-cars` | 5364 |
| G5 | `game-two/G5-pier` | 5365 |
| G6 | `game-two/G6-block` | 5366 |
| G8 | `game-two/G8-whole` | 5368 |

Everything in WAVE_C §7 binds (one owner end to end, grey but whole
first, play after every change that touches feel, your own port, muted,
never push, never merge into integration; `// [G<n>]` on an edit to a
shared file). The report is `docs/story/reports/game-two/G<n>.md`, the
frames `docs/story/review/game-two/G<n>/`.

**The gate** is WAVE_C §7's, with these additions:
1. the `_medium` proof (§1 B7) for every contest, beside idle, bad, good;
2. the feel measure (§1 A1): the input-to-act latency of the chapter's
   main verbs, in the report;
3. the interaction walk (§1 C): every usable thing tried, every door,
   every edge, in the report as a list with the answer each gave;
4. game one's golden frames (`python3 tools/golden.py check`): identical,
   or the changed frame named and shown as good or better. A parked
   chapter's frames are not re-taken.

**Speed.** Hours, not a day. Do the brief, prove it, stop; proofs once on
the final code; no new tooling where a tool exists; what is outside the
lane goes in `left`.
