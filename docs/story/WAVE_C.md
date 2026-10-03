# NOIR EXTREME — Wave C: make it a game (the art director's plan)

The user played all nine chapters of Wave B on 2026-10-02. The look holds.
The play does not. Wave C rethinks most chapters around one idea; some are
rebuilt, some tightened, one is cut. His words, which are the standard:

> You need to think about this in terms of smooth gameplay and what makes
> the game fun. Game mechanics that the user is aware of and they're able
> to lose, but they're also able to win. It doesn't have to be a hard game,
> it just has to be fair and also comprehensible.

> In a lot of these we're throwing out completely new mechanics, or
> sometimes kind of cheating: automatically winning for the player.

> Assume players like to explore and see what happens when they do certain
> things with the tools and the environment given. Make sure you aren't
> placing people into unfinished environments or environments with bad
> layouts. Fun and responsive to the player's actions, such that they don't
> feel they lost for no reason, or were able to not play the game and still
> win.

> This is not a super long game, so don't make it super expansive, but
> there needs to be a bit less linearity: more fun, less "the game is just
> telling me what to do".

Read first, in this order: `reference/noir_reference.png` (the look),
`DESIGN.md` (the ink rules), this file, your lane's brief in
`docs/story/briefs/C<n>_*.md`, `docs/story/WAVE_B.md` §2 and §3 (what premium
means and how to work: both still bind), `docs/story/ARCHITECTURE.md` §10 (what
is built, where), `docs/story/seams/X.md` and `Y.md` (how to add a mode, a
clip, a weapon, a cast kind, a prop, a sound without editing a shared file).

The user's list is things he noticed, not the whole job. Each owner is
expected to change places, rules, animation and assets where the play needs
it, to fill the gaps with invention, and to keep every frame inside the ink
style. Be careful with what already works: do not break it.

---------------------------------------------------------------------------
## 1. The north star, as rules for every chapter

Judge every beat by three questions before you judge its look:
**can I lose, can I win, do I know how?**

1. **Nothing wins itself.** If the player puts the controls down, he loses
   that beat, in every beat that has a contest. No rubber band that hands
   him the win, no scripted crash, no automatic vault, no enemy that
   misses on purpose until the scene is over.
2. **Nothing is lost for no reason.** Every loss has a cause the player saw
   or heard coming and could have answered: a tell before every hit, a
   warning before every fail ("He's getting away." before "Lost him."),
   and the retry says in a word what went wrong.
3. **No mechanic is thrown at the player cold.** A verb is taught the first
   time it is needed, in a safe second, by one short card with the key in
   it (the kit of §3), then used again later in the game. The verbs are few
   and the same key means the same thing everywhere (§2).
4. **It is always clear what to do.** One objective line (§3) from the
   first second of every chapter, changed when the goal changes. The world
   carries the rest: what can be used looks usable, where to go is lit.
   Short words; never a wall of text, never hand-holding arrows.
5. **Choice where there can be choice.** At least two ways through every
   contest (a route, a tool, an order, loud or quiet), and each visibly
   different. A linear stretch must not feel like a corridor.
6. **No jank.** Things are physically there. Nobody walks through a person,
   a desk, a door frame or a car; nothing floats; an object does what that
   object would do (a push door is pushed; a drawer opens or is locked).
   Where the player cannot go there is a reason he can see: a locked door
   (it rattles), a chained gate, a wall, water, a parked truck. Never an
   invisible wall, never an empty edge, never an unfinished room behind a
   door that opens.
7. **Players explore.** Reward poking at things: a small answer for
   anything a curious player tries (a light switch that works, a phone
   that clicks, a bottle that breaks, a horn). Nothing they try may break
   the scene or leave them stuck.
8. **Polish.** Input acts at once; every action has a sound and a reaction;
   every seam is eased or cut on purpose; nothing pops.

Use these for every decision the list below does not make.

---------------------------------------------------------------------------
## 2. The rulebook: the same verbs all through the game

| Key | Means, everywhere it applies |
| --- | --- |
| WASD, mouse | move, look (on foot); throttle / brake / steer (car) |
| **E** | use / take / open what I am looking at |
| **LMB** | the right hand's main act: jab, fire, rub, throw |
| **RMB** | the other fist; with a gun: steady the aim (and, crouched behind cover, rise to aim over it) |
| **SPACE** | the body's big move: block in a fist fight, vault / jump on the run |
| **C** (toggle), **Ctrl** (held) | get low: crouch behind cover, crouch-walk in the dark, slide when running |
| **A / D** in a fist fight | step off the line: the dodge |
| **R** | reload |
| **Shift** | run (where walking is the default and running costs something) |
| F, Q, M, ESC | smoke, small room toys, sound, pause (as now) |

No other keys. A chapter that needs a new verb maps it onto this table.

**Health** (guns): one pool of 100 (`src/player/Health.js`), the ink closing
in on the frame as it falls, hits marked at the frame's edge on the side
they came from, mending after some seconds out of fire. **Down** is a short
fall, black, one line that says why, and back at the last checkpoint with
the world as it was there, in under ten seconds. Fist fights keep their own
rule (FIGHT.md §8).

**Cover is physical.** What is solid stops a bullet, theirs and mine. Thin
wood is chewed away by fire, so cover is spent and the player must move.
Glass breaks. Men use cover too, and come from more than one side.

**Enemies are dangerous and fair.** A man who has a line on me and time to
aim will hit me. Before he fires he shows it (the raise, the glint, the
half-second), so that ducking, moving or shooting first is the answer. A
player standing in the open and doing nothing dies in a few seconds, in
every gunfight.

**Checkpoints** are frequent (every phase of a chapter) and silent.

---------------------------------------------------------------------------
## 3. The kit (lane C1 builds it; every lane uses it)

Lane C1 writes the exact API into `docs/story/seams/Z.md`. In outline:

- **The objective line**: `hud.objective(text)` — a few words, top left,
  small, inked; it writes itself in when it changes and then sits quiet.
- **The teach card**: `hud.teach(id, text)` — one line with the key drawn
  as a key cap, shown once per save at the moment of need, in a safe
  second; again only after the player has failed that thing twice.
- **The fail**: `game.fail({ why, to })` — the one way a chapter loses: the
  fall or the stop, black, `why` in a few words, back at checkpoint `to`.
  And `hud.warn(text)` for the warning that must come before it.
- **Stills**: `game.stills.play(id)` — comic panels (§5).

---------------------------------------------------------------------------
## 4. The story (a through line a player can follow with almost no words)

One night, rain all through it. The detective has a favourite diner and a
favourite waitress, Dot. Nobody needs to know who the Cardinal is: he is
the man whose colour is red, and red means his crew every time it shows.

1. **A tip.** A phone in the dark: Ames, another private detective, calls.
   The Cardinal's men are leaning on Dot at my diner.
2. **The diner (I).** I sit and watch. The big man two stools down has been
   watching her all night.
3. **The fight (II).** He goes through the window. In his waistcoat: the
   red matchbook, and **Ames's business card, crossed through in red**.
   Ames is marked. I go to his office.
4. **Room 304 (III).** Too late: Ames is dead at his desk. What he knew is
   in his safe: a **torn guest check from my diner**, in a woman's hand:
   `PIER 9 · MIDNIGHT · — DOT`. It reads as if Dot sent Ames to them. I
   come to think she is with the Cardinal.
5. **The door (IV).** They come back to clean the office. The first
   gunfight. When it is quiet I look out of the window to see if more are
   coming: a man under a lamp, under an umbrella, looking up. He runs.
6. **The watcher (V).** If he reaches the pier, they know I am coming.
   Down the fire escape and after him on foot, to the cars.
7. **The tail (VI).** Through the city after his tail lamps (red). When he
   makes for the docks I put him off the road with the revolver, and spend
   my last rounds doing it. Then I drive to Pier 9.
8. **Pier Nine (VII).** An empty gun, so: quiet. In the Cardinal's lit
   office on the mezzanine: **Dot's photograph, crossed through in red**,
   the same cross as on Ames's card, and the order through the glass: the
   diner, tonight. I had it backwards: she was Ames's witness, and she is
   next. Shells on his desk: out loud. The foreman bars the way: fists.
9. **The block (VIII).** Back to the diner in the nick of time: a gunman
   has Dot against the back bar. Then she reaches under the counter and
   lays the Tommy gun in front of me. She is the one who arms me. The
   street, the cars, the Cardinal. His hat in the wet street.

The two red crosses are the story: the first one I read right, the second
one I had read wrong until I saw it.

**Chapters** (`src/scenes/order.js`): I The Diner (`diner`), II The Fight
(`fight`), III Room 304 (`office`), IV The Door (`gunfight`), V The Watcher
(`watcher`), VI The Tail (`tail`), VII Pier Nine (`warehouse`), VIII The
Block (`shootout`). The Body (`body`) is cut; its alley part of the block
stays hidden and may be reused as a place.

**What the detective carries**: after II the matchbook and Ames's crossed
card; after III the check (`flags.note = 'PIER 9'`); the revolver from IV
(it was always under his arm); empty after VI; the shells from VII; the
Tommy gun in VIII.

---------------------------------------------------------------------------
## 5. Stills (comic panels)

Few, short, almost wordless, and composed: mostly shadow, an abstract
shape, or close on one character or one object. Each is a picture made for
the purpose (a small staged tableau rendered through the ink pipeline and
kept as an image), never a screenshot of play. A caption is at most six
words, hand-lettered capitals in a box, as in a comic. A still stays two to
four seconds, a click moves on, and the whole run can be skipped.

| Where | Panels (the picture; the caption) |
| --- | --- |
| Before I | 1. a telephone receiver in a hand, a desk lamp's cone, rain on the glass: `A TIP. AMES.` 2. three hats in a doorway's light, a small white apron between them: `HIS MEN. MY DINER.` 3. the diner's neon through a wet windscreen: no words |
| End of II | Ames's card in my wet fingers, the red cross: `AMES. MARKED.` |
| III, the check assembled | the check close, Dot's hand: `DOT'S HAND.` then her shape behind the counter, the face lost: `SHE SENT HIM TO THEM.` |
| VII, the office | her photograph under the desk lamp, the red cross: `NOT HIS GIRL. HIS NEXT.` |
| VIII, before the diner | my headlamps on the wet avenue, the el above: `THE DINER.` |
| The end | his hat in the wet street, the cigar's ember: no words |

A lane may add one where it truly helps, or cut one that does not.

---------------------------------------------------------------------------
## 6. The chapters

Lines marked **[must]** are the user's own. The rest is the direction; the
owner designs inside it and judges it by play.

### I The Diner — keep
The opening stills go before it. Mack's one line now carries the story: he
is there for her, not for me (`She's got nothing to say to you.` or
better). Nothing else changes.

### II The Fight — keep, tighten (lane C4)
- **[must]** People fleeing at the start go round me, not through me.
- **[must]** Every time I need to dodge: a short slowdown and a cue showing
  which side of the screen to dodge to. In the spirit of the Arkham games'
  cue, not a copy and not an arrow. A small window: somewhat hard.
- **[must]** The same cue and slowdown for things he throws.
- **[must]** A click jabs at once. (He felt nothing come out until he let
  go, because the press might be a wind-up.) A better scheme for the heavy
  punch.
- **[must]** The diner's street door is a push door, locked during the
  fight. I get outside only after he goes through the window.
- **[must]** The Body is cut: on the man in the street I find the hint that
  another detective is a mark (Ames's crossed card). That sends me to the
  office.
- Look briefly at the user's old 2D boxing game for what smooth and fair
  mean to him: https://github.com/evancodez/shittyboxing.git (harder and
  less cinematic than this should be; it may not apply).

### III Room 304 — a real puzzle (lane C5)
- I arrive too late: Ames is dead.
- **[must]** A real puzzle; today there barely is one.
- **[must]** I can shade enough of the paper to actually read the safe's
  combination.
- **[must]** Keep the safe. Inside is a torn note I piece together, and it
  gives my next place. It must be legible (the old torn-note puzzle was too
  faint to read).
- **[must]** No silly interactions (drawers already open that open a little
  more).

### IV The Door — the first gunfight (lane C5, on lane C2's gun kit)
- **[must]** The door closes behind me when I enter the room.
- **[must]** Keep the pause: the camera is taken to their shadow on the
  door glass. Then I have a moment: tip the desk and crouch behind it, or
  shoot through the glass. If I do neither in time, they burst in and try
  to kill me.
- **[must]** Enemies who really try to kill me.
- **[must]** Remove the man shooting from outside the window.
- **[must]** A bigger office, more men (the first shootout: not a crowd),
  and they do not all file through one door to be shot. A second way in;
  or I step into the corridor to check and they come out of other rooms.
  Only the revolver.
- **[must]** Nobody clips through furniture or door frames. Dying men slump
  where they are.
- It ends when I look out of the window to see if more are coming, and see
  a man watching.

### V The Watcher — the foot chase (lane C6)
- **[must]** No automatic vaults. I press SPACE or I hit the thing.
  Perhaps slides under things too.
- **[must]** I can lose: not on one miss, but on several, or when he gets
  too far ahead.
- **[must]** Longer, more interactive, more cinematic: more of a game.
- **[must]** No fade into the drive. The chase runs straight into the car.

### VI The Tail — rebuilt in a new place (lane C3)
- **[must]** A city, not a straight road. Real turns. Better driving.
- **[must]** I really tail him and can lose him.
- **[must]** Traffic and obstacles that are not trivial to dodge; some
  destruction. Not super fast.
- **[must]** When it comes to shooting his car, my shots cause the crash.
  It never crashes by itself.
- **[must]** Then I drive to Pier 9, which is a place on this map.
- After playing the first build (2026-10-03, lane C3b): he speeds up when
  I catch up in the streets (a graze of the bumper and no more); the gun
  hurts him but the finish is a shunt on his back corner that spins him
  (physics, not a cutscene, and it looks like something); no
  interrogation: he is crouched by the wreck and says "Pier 9"; no
  cutscene at the pier, the next mission just starts; the fail is that he
  gets away after enough time.

### VII Pier Nine (lane C7)
- **[must]** Clear from the moment I enter what I am to do.
- **[must]** First pass is stealth (take the men out quietly, or get past
  them to a place). Simple stealth rules, but ones I can read.
- **[must]** Then an escalation: a second pass where I can go loud (I find
  a gun, say).
- **[must]** Then a boss fist fight.

### VIII The Block — the diner and the street (lane C8)
- **[must]** Danger at the diner; I arrive just in time; the waitress twist.
- **[must]** The street shootout gets strategy: cover and other mechanics.
  Today I just stand and shoot, and it is neither hard nor fun.
- **[must]** Cars never pass through cars. Men come into the frame in a
  natural way. The head man is fun to take out, not trivial and not a
  bullet sponge.

---------------------------------------------------------------------------
## 7. Lanes and how to work

One owner per lane, end to end, judged by playing it. At most three
builders at once on this machine.

| Lane | What | Branch | Port |
| --- | --- | --- | --- |
| C1 | the kit (§3), the chapter order, saves, stills player | `wave-c/C1-kit` | 5341 |
| C2 | the gun kit: cover, crouch, dangerous fair gunmen, bodies that are solid | `wave-c/C2-guns` | 5342 |
| C3 | the city, the driving, VI The Tail | `wave-c/C3-city` | 5343 |
| C4 | II The Fight (and the brawl rules for VII's boss) | `wave-c/C4-fight` | 5344 |
| C5 | the Harbor Building: III Room 304 and IV The Door | `wave-c/C5-office` | 5345 |
| C6 | V The Watcher | `wave-c/C6-chase` | 5346 |
| C7 | VII Pier Nine | `wave-c/C7-pier` | 5347 |
| C8 | VIII The Block | `wave-c/C8-block` | 5348 |
| C9 | the stills (the pictures) | `wave-c/C9-stills` | 5349 |
| C10 | the whole game: play-through, bug hunt, documents | `wave-c/C10-whole` | 5350 |

WAVE_B.md §3 is still the way of working (grey but whole first; play after
every change that touches feel; look at every strip; your own files; your
own server on your port, `NOIR_PORT` on every tool; muted; tidy; commit
early and often; never push, never merge into integration). Mark an edit to a shared
file `// [C<n>]`. Report: `docs/story/reports/wave-c/C<n>.md`, review frames
in `docs/story/review/wave-c/C<n>/`.

**The gate**, before the last commit:
1. `npm run build`.
2. `python3 tools/golden.py check`: identical, or you say which frame you
   changed on purpose and why it is as good or better.
3. `tools/errors.sh` clean on every beat of your chapter.
4. **The three proofs**, as plays by real input (`tools/plays/`), for every
   contest in your chapter:
   - `<id>_idle`: the player does nothing (or holds W) and **loses**, with
     the warning first and the reason said;
   - `<id>_bad`: a clumsy first-timer (slow hands, wrong keys now and then)
     fails some and gets through on a second or third try, never stuck;
   - `<id>_good`: a player who uses what was taught **wins**, twice in a row.
5. The jank walk: walk into every wall, door, piece of furniture and person
   in your place; try every door; stand in every doorway while men come
   through. Nothing passes through anything, nothing is unfinished.
6. Frames per second at your heaviest moment against `shot=perf` measured
   at the same moment.

**The machine is the user's own**: one headless Chrome of yours at a time,
no capture loops, never kill a process you did not start (no pkill or
killall by pattern), port 5173 belongs to another project, every run muted.
