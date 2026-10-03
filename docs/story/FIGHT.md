# The fist fight — design, version 5.2

The user played version 4 in the Wave B playtest (2026-10-02) and asked to
keep the fight and tighten it (`docs/story/WAVE_C.md` §6 II, lane C4's brief
`docs/story/briefs/C4_FIGHT.md`). Version 5 keeps everything version 4 had
(each button an arm, the guard with two sides and his answer to a punch into
it, blows that hit places, a dodge that is a step, the room as a weapon rack,
the finish through a window, the rules taking their room as data) and changes
what he felt:

- **A click jabs at once**, whatever its length; the heavy punch loads from a
  hold that begins after the jab has landed (§2, §3).
- **The dodge cue**: every blow of his that must be dodged, and everything he
  throws, slows the world to about a third at its commit and inks the frame
  toward the side to go; my hands, my look and my keys stay at full speed
  (§5). It replaces the chevron and the lesson's arrow.
- **Nothing is lost for no reason**: a warning before I go down, the black
  says in a word why; the lesson is never a wall (§7, §8).
- **The room clears round me** at the start; **the street door is barred**
  while we fight and pushed open after; **on the man in the street**, Ames's
  card crossed through in red (§1, §9).

**Version 5.1** (after the cold player, `docs/story/reports/wave-c/C4_CRITIC.md`):
the lesson never waits on one right action (§7); the heavy's card says what
to do and its wind-up sits in the frame under his face (§3); a clumsy
first-timer is told in words what to change, gets the block's and the
opening's cards again, and a written mercy after repeated downs in one of his
manners, so medium hands get through (§8); his small blows' tell is drawn at
his fist (§4); a slip is judged by where my feet got to (§5); the warning
goes with his fall; the way out after the last blow is shown wherever I stand
(§9).

**Version 5.2** (after the cold player's second look, same file): the mercy
is earned only by what the fight teaches against his blows - a cue slipped or
a blow blocked in that life - and never wins (§8); **his guard matters**: it
is up while he throws (a punch into his wind-up is jammed on his shoulder and
caught), a hook, the bottle's thrust or a throw that misses opens only the
side it came from (the big ones both), and a punch into his guard is answered
three times in four whatever the mercy, from his recovery after a miss too
(§4); the matchbook is held in the fingers until E; a fight begun on a save
with no lesson teaches the punch and the heavy (§7); the warning goes while he
reels (§8); the street door slams in my face while the last of them go out,
catches me in front of it when walked into at a slant, and the eyes go down to
the bar as it is lifted (§9).

When this document and an older one disagree, this one wins.

## 0. The feel, in one paragraph

Every press does something at once: a jab, its fist out in the step the press
arrives and on him 0.05 s later. Keep the button held past the jab and the
same fist comes back cocked and loads - three ticks at the fist, a rising
knock - and lands three sizes bigger when let go. He shows me when he is open
and when he is about to swing, a beat before it matters; when his big blow
commits the world drops to a third, the side it comes from goes black and the
other opens up white: a step to the light and it goes by where my head was,
and he is open. If I punch into his guard he hits me back straight away. He
fights with the room: he throws plates and swings stools; so can I, and a
thing hits harder than a fist.

## 1. The way in (scene 2's first beat, `start`)

As version 4 (`scenes/fight/start.js`): after his line, one continuous move
of about four seconds - he stands (his stool goes over), comes down the
counter, his hand on my shoulder pulls me round, I come up and send my stool
skidding, fists up, he squares up. A retry never plays it again.

**The room clears round us** (`scenes/fight/flee.js`, version 5). As he
rises: the old man (nearest the door) is out first; the couple run from
their booth down the open side of the aisle - between us and the café
tables - and out; the docker backs to the far wall at the north end; Dot
ducks behind the counter. Each runs a way planned round me, Mack, the stools
and the tables, and steers off every body on the way: a circle each (me 0.38
m, Mack 0.42, the others 0.3), bent round on the side the runner is already
on; squeezing past one (within 0.35 m) he slows to two thirds and turns his
shoulders (the spine and chest twisted a quarter, after the clip's pose); the
furniture is kept out by the stage's colliders; held up two seconds, he goes
on to his next point. Nobody passes through anybody (measured: the nearest
any two came, body to body, 0.19 m). The street door is pushed open by whoever
reaches it (§9) and **the last one out lets it slam: its bar drops across
it** (the slam knocks the bar off its keeper). A jump or a retry finds the
room as it ends: the couple and the old man gone, the docker at the far
wall, Dot down, the door barred.

## 2. Controls

| Input | Action |
| --- | --- |
| **Left / right mouse button** | that arm. **Every press is a jab, at once.** Keep it held past the jab (0.34 s): the **wind-up**; let go: the **hard punch** |
| **A / D** | a side-step, 0.55 m in 0.10 s (held on: circling). **Under the dodge cue: the step toward the light is the slip** |
| **S** | a back-step, 0.6 m (held on: backing away) |
| **W** | walk in |
| **SPACE** (held) | block |
| **E** | take the thing I am looking at and can reach |
| mouse | look; the body keeps turning to face him |

What a hand holds is used by that hand's button: a bottle, a plate, a mug in
the hand on its side of the frame; in his reach a press swings it at once,
out of his reach a press draws it back and letting go throws it; held on, it
loads (a throw or a bigger swing). A stool or a chair is held in both hands
and either button swings it at once (held: a bigger swing).

## 3. My side

- **The jab is on the press, always**: the fist starts in the step the press
  arrives, contact 0.06 s after it (0.05 measured by real input), whatever the
  press's length - a click of 60, 120, 200 or 280 ms is a jab (version 4 made
  a press held past 0.12 s into the wind-up, and a normal click let go before
  its first level showed nothing landing). A press that comes while a fist is
  still out sends that blow home first (its contact is never lost) and jabs
  again - from the block, a hop, the other fist's wind-up, a fist bounced off
  his guard. Only a blow of his that has me reeling holds a press, and then it
  jabs as soon as I can (up to 0.35 s later). Damage **3**.
- **The wind-up.** The button still held when the jab is home (**0.34 s**: a
  loaded machine stretches some presses, and a 280 ms click must never load),
  the same fist comes back cocked - **up by my jaw, in the lower middle of the
  frame under his face** (5.1: version 5 drew it back and down into the bottom
  corner, missed by a player watching him; `player/clips/c4.js c4wind*`) - and
  loads in three levels as the hold
  passes **0.42, 0.62 and 0.82 s**: at each the fist snaps back a step further,
  a white ink tick flicks out at the fist and stays, a rising knock, the view
  leans back; at full the fist flashes. Let go before the first level: the
  fist comes home (the jab has already landed). A hop or a blow cancels it; a
  button still held after a blow winds again. The hold is timed by the mouse
  events' own times, so a slow frame never adds to it.
- **The hard punch**, by level 1 / 2 / 3: damage **9 / 15 / 22**, as version 4
  (the lunge, the burst, the hit stop, the kick, the knock back and the stun
  grow with it). Contact 0.08 s after the release.
- **A full-power punch into his raised guard breaks it** on its own; three
  lesser hard punches blocked within 4 s too (version 4).
- **Things** (`Brawl.js THINGS`): as version 4 (bottle 22 → neck 14, plate or
  mug 12, stool or chair 35 and it breaks his guard).
- Counters, combos, caught punching, my health 100, a retry at 60: version 4.
- **Spamming still does not win**: a masher's jabs go into his guard and he
  answers three times in four (in-page seeds: the masher wins none, 42 to 44
  downs in 300 s).

## 4. His guard and his answer

As version 4: two sides; a punch into a raised side is blocked and about
three times in four answered at once from that side (a 0.2 s tell; contact
0.28 s after my punch). 5.2: **three times in four whatever the mercy** (5.1
cut it to 0.15 after repeated downs, and random clicks into his guard went
unpunished); the mercy slows it instead, 0.07 s a level (`MERCY.answerLate`),
time to get out or cover. Its damage is its own 8 - not half again for the
fist still coming back (it always is).

**5.2: his guard is up while he throws.** His chin is tucked behind the
shoulder that loads, the other hand at his jaw: through his tell and his
strike nothing of him is open to a fist (version 5 left the swinging side open,
and a click every two or three seconds at random reached his head half the
time). A punch into his wind-up meets his shoulder and the fist is **jammed**
(`BRAWL.bounce.jammed`: 0.34 s before my feet or my block come back): his blow
catches me there, and the black says `Caught swinging. Hit when he's open.`.
Open to me: a breath (a hand lowered between his blows, drawn by his body and
ticked at his jaw), **a blow that missed** (the miss table), a stun, a broken
guard, his tired hand (wild). And a hook, the bottle's thrust, a throw that
misses leave open **only the side the swinging arm left - the side it came
from, the cue's dark side**: hit back there; the other hand still guards, and
from his recovery he answers a punch into it (the haymaker, the rush, the
shove, a stool throw his weight past me and leave both). Still open in his
wind-up: a thing swung in my hand (it comes round the shoulder) and the
foreman's weapon arm (a jab on it knocks the hook out of his fist). A full
loaded punch into his raised guard breaks it, in his wind-up too (it stops
the blow). His answer and
his jab have **no dodge cue** (a cue on every jab made the fight a quick-time
event), but (5.1) **their tell is drawn**: as the fist cocks, three short white
strokes flick out round it for a fifth of a second (`FightCards.tellMark`) -
his jab, his cross, his answer, a feint. Blocked with SPACE they do nothing.
**Pounded** (three punches into his guard in 1.5 s) he answers every time, and
with that fast straight - version 4 answered pounding with a hook, and a hook
now comes with the dodge cue: a masher who slipped it was handed the opening.

## 5. His blows, and the dodge cue

Told, fast, avoidable by moving, as version 4: the tell is a held pose; each
blow has a path aimed where I stood when the tell began; out of the path at
contact it misses and he is open. The table of his blows is version 4's.

**The dodge cue** (`game/BrawlCue.js`, `FightCards.cue`). Every blow of his
that must be dodged rather than blocked or out-punched - his hooks and body
hooks, the haymaker, the rush, the shove, a swung stool, the bottle's thrust
and its first break, every thrown thing, a room's blow marked `cue` or of kind
`long` (the foreman's hook) - and that is coming at me where I stand:

- **When**: at its commit, `CUE.k * CUE.window` of world time before contact
  (after the tell; a thrown thing: that long before it reaches me).
- **The slowdown**: the world (him, what he threw, the room, the rain) drops
  to about a third (`game.worldK`; main.js steps the stage and the world's
  half of post with `dt * worldK`) while my hands, my look and my keys run at
  full speed (`pre` takes the real step). Never a pause. It comes back the
  instant I act or the window closes. Sound: a held breath drawn in, a rising
  tick, the room ducked (`f_c4cue`).
- **The window**: **0.34 s of real time** (`CUE.window`; 0.46 in the lesson
  after its first, which is held); 5.1: 0.05 s more after each down that the
  black called `Too slow.`, at most 0.2 s more (`MERCY.cue`). Measured in-page: the reader (0.13 .. 0.24
  s to react) answers nearly all; the struggling first-timer (0.2 .. 0.42 s,
  the wrong way three times in ten) about half.
- **The cue on the frame**: ink, not UI. The side the blow comes from goes
  black - a loaded brush laid on from that edge, its inner edge torn, bristles
  dragged inward (27 % of the width at its deepest); the safe side opens up
  white - paper torn open at that edge, white bristles, and three brush
  strokes drawn toward it, sliding out as the window runs; his fist is marked
  with three white strokes trailing it from the dark side, as a comic draws a
  fist on its way (a thrown thing has its own speed lines and is lit white).
  Two other designs were drawn and compared (`?cue=wash`: the dark half a soft
  wash and one big stroke to the light; `?cue=lines`: speed lines from the
  dark edge converging on the fist): the ink and paper one read at once, the
  other two did not say where to go.
- **The side**: away from the hand that swings (a swing's own path leaves
  only that side); a blow that comes straight at me (an overhand, a rush, a
  shove, the bottle's thrust, a throw) is aimed a hand's width (0.25 m) to the
  dark side at its tell, so the light side leaves it and the dark side does
  not, and the side is the one with room (away from its hand first).
- **The answer**: A or D toward the light inside the window is a clean slip:
  the blow goes by where my head was, he is open (his miss table) and my next
  blow is a counter (half again). 5.1: unless the room stopped my feet - a
  hop toward the light that a wall or the counter cut short (under half of its
  way) is no slip, and the blow is judged where I stand (`Brawl.hopBlocked`;
  the black: `No room. Get off the wall.`). The wrong
  side, or late, and it lands (into a swing a quarter harder, as ever). S, the
  block, a punch, E end the slowdown and the old rules judge.
- **Taught**: the first cue of a save, wherever it comes (the lesson's first
  hook; Pier 9 for a player who began there), holds time with the kit's teach
  card `[A] [D] dodge toward the light` (held: time crawls until the key toward
  the light is pressed, the other not taken, at most 6 s). Down twice off a
  blow the cue told me of (or caught twice in the lesson's dodge steps): the
  card once more at the next cue, not held.
- Measured (`tools/plays`, in-page `r2duel`): each cued blow - both hooks,
  both body hooks, both haymakers, the rush, the shove - answered toward the
  light was dodged and toward the dark landed.

## 6. He uses the room

As version 4, but **the chevron is gone**: a thrown thing gets the dodge cue
in its flight, the lane aimed a hand's width to the dark side of me. The
plate in his hand still comes up white over the tell; its speed lines in the
air.

## 7. The lesson (the first exchange)

One card at a time, low in the frame. Blows in the lesson do half damage and
**never put me down** (my health is held at 30 and up); his health stays at
70 % and both are full when it ends.

| # | What he does | Card | Ends when |
| --- | --- | --- | --- |
| 1 | lowers his right hand | `HIS GUARD IS DOWN   LEFT CLICK` | my left jab lands |
| 2 | lowers the other | `RIGHT CLICK` | my right jab lands |
| 3 | guard up; answers my first punch into it (slowed) | `GUARD UP: HE ANSWERS A PUNCH INTO IT.   WAIT FOR AN OPENING` | a hand drops and I land one |
| 4 | both hands down | `KEEP IT PRESSED: IT LOADS.   LET GO TO HIT` (5.1) | a hard punch of level 2 or 3 lands |
| 5 | a right hook: the dodge cue, **held** | the kit's `[A] [D] dodge toward the light`; it misses: `OPEN WHERE IT CAME FROM` (5.2) | it misses |
| 6 | the same from his left: the cue, its lesson window | - | it misses |
| 7 | takes a plate, backs off, throws it: the cue on the plate | - | it misses me |
| 8 | jabs | `SPACE   HOLD TO BLOCK HIS JAB` (5.1) | I block one |
| 9 | backs off; a bottle slides down the counter | `E   GRAB WHAT IS IN REACH` | 3 s or a grab |

Then `NOW FIGHT.` **The lesson is never a wall**: caught three times in one
of its blows' steps, the step lets me go; hands off for twelve seconds, he has
waited long enough and the fight is on. Pinned with me on top of him, he
throws from where he is. **5.1: no step waits on one right action**
(`BrawlLesson PATIENCE`): pressing, but not what the card asks, the step
flashes what it wants once (`KEEP IT PRESSED` at the fourth press of the HOLD
step) and lets me go after ten presses or fifteen seconds; a step whose blow
never came (he was kept busy, I stood on him) lets me go after its fifteen
seconds. The fight teaches what was let go: the heavy's card at his first
opening worth it (stunned, or open after a miss) for a man who has never
loaded a punch, the block's after his jab put me down. A clicker who never
holds was walled in at the HOLD card for seven minutes in version 5.

**5.2: a fight begun with no lesson** (a save that never saw II - Pier 9 from
the chapter list): the dodge card at the first cue (held), as before; then
the kit's `[LMB] [RMB] hit only where his guard is down` at his first opening
in the fight (a breath or a miss, a second and a half in at the earliest,
never over the cue nor at his reel), and the heavy's card at his first opening
worth it, after the punch's - one card at a time, once a save. The lesson sets
the save's flags `c4punch` and `c4heavy` (the heavy only if its step was done;
let go, the fight teaches it).

## 8. The open fight

As version 4 (his 116 hit points, his manners at 65 / 30 / 12 %, the manner
hold, hurt fast he covers up; losing is not failing: down, black, up again
with 60, he gets back 8 % of himself, from the third down in a manner I come
up whole, a life spent pounding his guard paid for as before). Version 5 adds:

- **The warning before I go down** (WAVE_C §1 rule 2): `One more and you’re
  down.` (the kit's warning line) under 30 health, gone over 40. **Nobody goes
  down unwarned**: a blow that would take the last of me while the warning has
  not been up a second leaves one, and puts it up (measured: every down of the
  idle and the clumsy proofs warned 1.9 to 12.5 s before).
- **The black says what went wrong, and what to change** (5.1; the kit's
  lettering, the HUD's lines and his bar off it), by cause in this order:
  `No room. Get off the wall.` (a slip the room stopped), `Too slow.` (a cued
  blow not answered), `Wrong way.` (answered toward the dark), `Into his
  guard. Wait for an opening.` (his answer to a punch into his guard),
  `Caught swinging. Hit when he’s open.` (hit while punching), `Block his
  jab.` (his jab or cross, not blocked), `Get out of the big ones.` (a big
  blow taken, or blocked when it breaks the block), else `Down.`. The black is
  1.6 s. Version 5 said `Down.` for his jab and `Caught swinging.` for his
  answer.
- **The cards again** (5.1): as the black lifts after his jab put me down, the
  kit's `[SPACE] hold to block his jab` (once a save - a lesson let go or a
  save begun at Pier 9 never saw it - and again after every two more such
  downs); after his answer or a blow that caught me punching, `[LMB] [RMB] hit
  only where his guard is down`. After two downs off a cued blow, the dodge
  card at the next cue (version 5).
- **A written mercy** (5.1, `Brawl.js MERCY`; 5.2 below), for a man who is
  **trying**: 5.2, a down counts toward it only when in that life I **slipped
  a cue toward the light or blocked a blow** - what the fight teaches against
  his blows - and was not pounding his guard (more than 30 punches into it a
  minute). Landed punches alone are not trying (5.1 counted three landed: a
  never-dodging slow clicker, W held, qualified on random hits and won by
  downs that cost him nothing - the critic's second look, B1). For each such
  down in his present manner (up to three, and one for every three in his
  manners before) his answer to a punch into his guard comes a beat later
  (0.07 s a level - never rarer: §4), he presses a blow that found me less
  often, breathes and stays open after a miss a quarter longer each, and waits
  0.15 s more between his blows; he gets back half of his 8 % at the first
  such down in a manner and none after (my work is kept); I come up whole from
  the second such down in a manner. Any other down - by `Too slow.`, `Wrong
  way.`, `Block his jab.`, `Into his guard.` with no slip and no block in that
  life - gives him his 8 % back, up at 60, his pace as ever. It wins nothing by
  itself: a man who stands there, leans on W or clicks now and then whatever
  he does gets none of it, and a man who pounds his guard is answered every
  time.
- **5.2: the warning goes while he reels** (he cannot hit me out on his feet;
  it lay across the loading fist) and comes back if he comes round; the
  loaded fist's ticks are drawn under the card, as art under a caption box.

## 9. The finish, and after

The finish as version 4 (out on his feet at 12 %, he reels to the nearer
window; a loaded punch or a thing is the last; the card at the window says
so: `OUT ON HIS FEET.   KEEP IT PRESSED, LET GO TO HIT`). 5.1: the warning
goes with his fall (it stayed through the reel, the KO and out on the
pavement: the fight's last step put it back up after the fight had stopped).

**The street door** (`stages/block/parts/dinerFront.js`, version 5) is a push
door opening outward onto the pavement on its closer. From inside it is
pushed: walking into it (or E, `push`) swings it open as far and as fast as I
push, never through me or anyone (its leaf is kept clear of every body near
it, its collider follows it at every angle); from the street it is pulled (E,
`pull`). Let go, the closer brings it back - never through a body - and it
shuts with a knock and the bell. **Barred while we fight**: the bar - an iron
flat bar on a pivot at the latch jamb, stowed upright on a keeper - dropped
across it when the last one out let it slam. Walked into or tried, it gives a
centimetre, the bar knocks in its brackets, the bell shivers: `Barred.` -
once as I come against it, not again while I stay pinned to it. In a fist
fight my body opens it not at all: in the lesson's first seconds, while the
last of them still go out by it, the shut leaf stops my back as a door does
(the fight's bounds hold the doorway, as in version 4), and it is never held
open by me so that it cannot slam and the bar cannot drop. 5.2: the doorway
clear of them and me coming at it (2 m), the last one out lets it go - it
slams shut in a quarter second (`door.slamShut()`) and the bar drops: no open
doorway with the fight's wall in it (the owner's Left 1, the critic's m8). And
from the room the splayed side lights make two shallow pockets beside the
door: their mouths are held at the room's wall line and the door's posts stand
a little proud of the leaf on the room side, so a man walking at the door at a
slant is caught in front of it, with its prompt (he slid along the leaf onto
the side glass: m3).

**After the last blow** the objective says `See to him.` Two ways out:

- **The door**: E at the bar (`lift the bar`: the right hand closes on it and
  lifts it up onto its keeper; 5.2: the eyes go down to it with the hand and
  come back - at eye level the hand dropped out of the frame to a bar below
  the view), then walk into the door. 5.1: the prompt shows
  wherever I look at the door, from up against it to 2.5 m back (it sits on
  the point of the leaf my view crosses); walked into after the last blow, the
  door shows the prompt, not `Barred.`.
- **Over the sill** of the bay he went through: SPACE (`climb out`) - a hand
  on the sill, up and over the riser, down on the pavement beside him (not
  over him). 5.1: the prompt wherever I stand at the broken bay (in the hole,
  at chest height, in front of me), so at the end of the last blow, looking
  down at him, SPACE takes me out; never onto him (a body's width off where
  he lies). The broken bay is no walk-through: the sill and riser stand.
- **The room after** (5.1, WAVE_C §1 rule 7): the docker (`Not my fight,
  mister.`), Dot, who gets up from behind the counter (`You’d better go.
  They’ll send more.`), the cook in his hatch (`Kitchen’s closed.`, his bell)
  answer E; the jukebox plays its next record; a stool walked into turns.
  (5.2: the cook only looked at - a narrow cone, 0.28 rad - his prompt came up
  looking down the empty aisle behind the counter.)

**On him** (`outside`, `matchbook`): E search; the red matchbook (THE
CARDINAL, the black bird) - 5.2: brought up out of his waistcoat in my right
hand's fingers, turned over, held under the lamp until E (`c4readMatchbook`,
the kind `c4matchbook`: the inspect view held it up in the air after the
hand had gone), E: into the coat; folded in it **Ames's card** comes out and turns
over in my fingers - `J. AMES`, `PRIVATE INVESTIGATIONS`, `HARBOR BLDG. RM
304`, crossed through in the crew's red with a grease pencil, the print
reading through the wax (prop `amesCard`, `props/kinds/c4.js`; 5.2: the name
in the card's heavy print, pressed, the cross from under its corners - its
Didot hairlines broke up in the hand). 5.1: in the
right hand's fingers by its edge (`c4readCard`: brought up with its back to
me and turned over), never hung in the air; its face unlit, so every word and
the cross read under the lamp. E puts both away; the objective writes in `Harbor Building. Room 304.`; the still
`AMES. MARKED.`; chapter III. The two far shots (the Body's) are gone.

## 10. One fight system, two rooms

As version 4 (`game.brawl.start({ opponent, room, who, manner, lesson, ... })`,
the room as data). The cue is the rules', so it is the same in every room:
Pier 9's foreman's hook (`kind: 'long'`) is cued, and its arc now ends 0.45 m
on the light side so the step toward the light leaves it (back out of it, or
in inside it, as before).

## 11. Judged by play

The three proofs of WAVE_C §7, by real input (`tools/lib/fight_bot.mjs`):

- `fight_idle.json`: hands off - the lesson waits twelve seconds and the
  fight is on; down three times in 61 s, each warned 1.9 to 8.8 s before,
  `Too slow.` on each black; never a win.
- `fight_bad.json`: a clumsy first-timer (mashes jabs at random sides, sees
  the cue late and goes the wrong way a third of the time, holds now and then
  at the wrong time, a wrong key now and then; after each down a little less
  blind - the black told him why): 5.1 - down four times and six, warned each
  time, and wins (104 s and 145 s, the lesson included; version 5: 155 s with
  six downs).
- `fight_good.json`: a player who uses what was taught (the cue read in 0.16
  .. 0.26 s, slips, punishes the opening with a loaded punch, blocks his jab,
  finishes loaded): wins twice in a row without going down - 5.1, two runs:
  57, 59, 60 and 66 s (the lesson included).
- `fight_click.json`: 240 clicks (each button 30 times at 60, 120, 200 and 280
  ms, shuffled, 0.12 .. 0.55 s apart): 240 jabs, every contact 0.05 s after its
  press, no click wound up.
- `fight_tries.json`, `fight_out.json`, `fight_door.json`: the street door
  tried at every moment of the chapter - in the lesson while they still go
  out by it, in the lesson barred, rounds 1 to 3, the reel, after the last
  blow (barred; over the sill), out on the pavement (pulled, pushed, shut on
  its closer) - the leaf never in a body.

5.1: the cold player's hands (`tools/plays/critic/c4_bot.mjs`), the yardstick
of version 5.1 - medium hands won II in 181 s with five downs (21 downs and
stuck in version 5) and Pier 9 in 164 s with five (18 downs, the foreman
never hurt); the learner in 178 s with three; slow eyes who pound his guard
in 463 s with sixteen; the masher and the W-masher go through the lesson and
never win; the W-holder goes down ten times in six minutes (twice in version
5). Report: `docs/story/reports/wave-c/C4.md`, After the critic.

The in-page autoplay (`?shot=r2play&beat=lesson&seed=<n>&style=<s>&t=300`):
the reader (`player`) wins 5 of 5 in 63 to 89 s (version 4: 73 to 104), the
struggling first-timer (`rough`) 5 of 5 in 117 to 229 s with 4 to 9 downs
(version 4: 111 to 217), the masher none (43 to 44 downs), the masher who
reads the cue (`mashcue`) none (35 to 37 downs, "Caught swinging."). See the
report `docs/story/reports/wave-c/C4.md` for the whole gate.
