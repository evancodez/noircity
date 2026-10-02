# The fist fight — design, version 5

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
  the same fist comes back cocked and loads in three levels as the hold
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
0.28 s after my punch). His answer and his jab have **no dodge cue**: the
body's tell alone (a cue on every jab made the fight a quick-time event).
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
  after its first, which is held). Measured in-page: the reader (0.13 .. 0.24
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
  the blow goes by where my head was (whatever the room let my feet do), he is
  open (his miss table) and my next blow is a counter (half again). The wrong
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
| 4 | both hands down | `HOLD ON AFTER THE JAB: IT LOADS.   LET GO` | a hard punch of level 2 or 3 lands |
| 5 | a right hook: the dodge cue, **held** | the kit's `[A] [D] dodge toward the light` | it misses |
| 6 | the same from his left: the cue, its lesson window | - | it misses |
| 7 | takes a plate, backs off, throws it: the cue on the plate | - | it misses me |
| 8 | jabs | `SPACE   BLOCK` | I block one |
| 9 | backs off; a bottle slides down the counter | `E   GRAB WHAT IS IN REACH` | 3 s or a grab |

Then `NOW FIGHT.` **The lesson is never a wall**: caught three times in one
of its blows' steps, the step lets me go; hands off for twelve seconds, he has
waited long enough and the fight is on. Pinned with me on top of him, he
throws from where he is.

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
- **The black says in a word what went wrong** (the kit's lettering, the HUD's
  lines and his bar off it): `Too slow.` (a cued blow not answered), `Wrong
  way.` (answered toward the dark), `Caught swinging.` (hit while punching),
  `Into his guard.` (his answer), else `Down.`. The black is 1.6 s.

## 9. The finish, and after

The finish as version 4 (out on his feet at 12 %, he reels to the nearer
window; a loaded punch or a thing is the last; the card at the window says
so: `OUT ON HIS FEET.   HOLD ON AFTER THE JAB: IT LOADS.   LET GO`).

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
open by me so that it cannot slam and the bar cannot drop.

**After the last blow** the objective says `See to him.` Two ways out:

- **The door**: E at the bar (`lift the bar`: the right hand closes on it and
  lifts it up onto its keeper), then walk into the door.
- **Over the sill** of the bay he went through: SPACE (`climb out`) - a hand
  on the sill, up and over the riser, down on the pavement beside him (not
  over him). The broken bay is no walk-through: the sill and riser stand (the
  old hole in the wall's collider is gone).

**On him** (`outside`, `matchbook`): E search; the red matchbook (THE
CARDINAL, the black bird), E; folded in it **Ames's card** comes out and turns
over in my fingers - `J. AMES`, `PRIVATE INVESTIGATIONS`, `HARBOR BLDG. RM
304`, crossed through in the crew's red with a grease pencil, the print
reading through the wax (prop `amesCard`, `props/kinds/c4.js`). E puts both
away; the objective writes in `Harbor Building. Room 304.`; the still
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
  blind - the black told him why): down five times (eight in the run
  before), mostly `Caught swinging.`, warned each time, and wins (118 s; 163 s
  the run before; the lesson included).
- `fight_good.json`: a player who uses what was taught (the cue read in 0.16
  .. 0.26 s, slips, punishes the opening with a loaded punch, blocks his jab,
  finishes loaded): wins twice in a row without going down, 78 and 73 s each
  (the lesson included), 22 cues of 23 answered.
- `fight_click.json`: 240 clicks (each button 30 times at 60, 120, 200 and 280
  ms, shuffled, 0.12 .. 0.55 s apart): 240 jabs, every contact 0.05 s after its
  press, no click wound up.
- `fight_tries.json`, `fight_out.json`, `fight_door.json`: the street door
  tried at every moment of the chapter - in the lesson while they still go
  out by it, in the lesson barred, rounds 1 to 3, the reel, after the last
  blow (barred; over the sill), out on the pavement (pulled, pushed, shut on
  its closer) - the leaf never in a body.

The in-page autoplay (`?shot=r2play&beat=lesson&seed=<n>&style=<s>&t=300`):
the reader (`player`) wins 5 of 5 in 63 to 89 s (version 4: 73 to 104), the
struggling first-timer (`rough`) 5 of 5 in 117 to 229 s with 4 to 9 downs
(version 4: 111 to 217), the masher none (43 to 44 downs), the masher who
reads the cue (`mashcue`) none (35 to 37 downs, "Caught swinging."). See the
report `docs/story/reports/wave-c/C4.md` for the whole gate.
