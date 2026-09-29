# The fist fight — design (the user's spec, 2026-09-29)

This replaces the fight rules of CONTRACTS §14 and lane 7's brief. The user
played the first version and found it linear ("you just push the guy back
and he falls out a window"), badly taught, and wonky in motion. What follows
is his specification, filled in by the art director.

## 1. Controls

| Input | Action |
| --- | --- |
| **Left mouse button** | my **left** arm |
| **Right mouse button** | my **right** arm |
| a short click (released within 0.20 s) | a **jab** with that arm |
| hold, then let go | that arm **winds up**; letting go throws the **hard punch**. The longer the hold, the harder it lands (power 0 at 0.20 s to 1 at 1.0 s) |
| W A S D | **move**, freely, anywhere in the room |
| SPACE + A / D | **slip** left / right |
| SPACE alone, or + S | **lean back** out of reach |
| SHIFT (held) | **cover up**: both forearms in front of the face |
| E | **grab** what is in reach (bottle, plate, mug, stool) |
| mouse | look; the body keeps turning to face him |

Only two punches exist: the jab and the hard punch. Each arm is its own
button. With something in the right hand, the right button uses it: a click
strikes with it, a wind-up smashes or throws it.

While an arm winds up, that side of my guard is open (his blows land a
quarter harder). A wound-up arm can be held; past 1.0 s the fist trembles
and the power stays at 1.

**How hard it will land is visible**: the winding fist draws further back
and lower as it charges, the view turns a little with the shoulder (up to
6 degrees), and a short brush stroke beside the fist grows from grey to
paper white. No bar, no numbers.

## 2. Dodging: away from the hand that swings

I face him, so **his right hand is on my left**.
- A swing from **his right** hand comes from **my left**: I slip **right**
  (SPACE + D).
- A swing from **his left** hand comes from **my right**: I slip **left**
  (SPACE + A).
- Slipping **into** the swing is worse than standing still: it lands a
  quarter harder.
- Straight blows (his jab, his straight) can be slipped either way or
  leaned away from. An overhand is leaned away from or slipped away from
  its hand. Covering up stops jabs, takes a hook for chip damage, and is
  broken by a haymaker (I stagger 0.6 s).
- A blow I slip the right way leaves him **open** for 0.9 s: my hits count
  double and a hard punch stuns him.

His tells show the hand: the shoulder on that side drops and the elbow
goes back beyond his outline before the fist comes round. Both of his
hands attack (the first version only hooked with the right).

## 3. Teaching it: the first exchange is the lesson

He rises, squares up, and **waits**: in the lesson he does not attack
until I have been shown how to answer. One card at a time, low in the
frame, in the typewriter face with a small inked picture of the mouse or
the key. The game does not pause; he circles and feints.

| Step | Card | Ends when |
| --- | --- | --- |
| 1 | `LEFT CLICK   left jab` | a left jab lands |
| 2 | `RIGHT CLICK   right jab` | a right jab lands |
| 3 | `HOLD, THEN LET GO   the longer the wind-up, the harder it lands` | a hard punch of power 0.5 or more lands |
| 4 | he throws a slow right hook; the world runs at 0.4 x during its tell; an inked arrow points from his swinging hand to my safe side. `SPACE + D   slip away from the hand that swings` | I slip it; then `HE IS OPEN` for 0.9 s |
| 5 | the same from his left: `SPACE + A` | I slip it |
| 6 | he jabs: `SHIFT   cover up` | I block one |
| 7 | `W A S D  move      E  grab what is in reach` (4 s, while he backs off and Dot slides a bottle down the counter) | 4 s, or I move 1 m |

Then `NOW FIGHT.` for one second and the fight opens. A step I perform
before it is asked counts as taught. The whole lesson takes under 45 s.
His health is put back to 100 when the lesson ends. A retry skips the
lesson. After the lesson the HUD is silent.

## 4. The open fight

It is a fight in a **room**, not along a line.

- **We both move.** He closes, backs off, circles, steers round the
  furniture. Reach matters: my punches land only when he is within 1.75 m
  and within 35 degrees of where I look. I can put a stool or the counter
  between us.
- **Blows move people.** A hard punch knocks him back 0.6 to 1.5 m along
  the line of the punch. Whatever stands behind him takes him: a row of
  stools goes down one after another, the jukebox skips, the pie case
  bursts, plates fly off the counter, a café table tips. He shoves me
  too: my back hits the counter and the cups jump.
- **The room is a weapon rack.** Two bottles and three plates on the
  counter, mugs, four stools that come off the floor; Dot slides me a
  bottle twice (when he first takes one, and when he bleeds). A bottle
  breaks on its first blow and its neck is good for two more. He arms
  himself as well.
- **He changes as he is hurt** (no round cards, the fight flows):

| His health | His manner | What he does |
| --- | --- | --- |
| 100 to 65 | measured | jab, right hook, left hook, body shot; keeps 1.4 to 1.8 m |
| 65 to 30 | dirty | takes a bottle and breaks it on the counter, thrusts with the neck; throws a plate or a mug from 3 m (slip or cover); shoves; feints |
| 30 to 12 | wild | haymakers, rushes (two quick steps and an overhand), picks up a stool and swings it; he bleeds, his cap is gone |
| 12 and under | out on his feet | see §5 |

- **Hit feel**: hit stop (3 steps on a hard punch, 1 on a jab), a view
  kick, the white ink burst at the fist, his head and body reacting to
  the side the blow came from, a stagger step. My own view snaps away
  from a blow I take.
- **Losing is not failing**: at 0 I go down, black, and come up at the
  start of his current manner with 60.
- A first-time player wins in 90 to 150 s.

## 5. The finish: out through a window, wherever we are

- The window wall has two **finish spots**: the clear floor in front of
  the plate glass of bay **B2** (z 5.0) and of bay **B4** (z -3.8). No
  booth, table or bench stands between a finish spot and its glass.
  From anywhere in the room one of them is within 6 m.
- At 12 health he is **out on his feet**: arms down, swaying. He reels
  to the nearer finish spot (three seconds at most, stumbling, catching a
  stool on the way) and stands with his back to the glass.
- My next **hard punch** (power 0.5 or more) is the last. Slow motion,
  0.35 x for 0.8 s. He goes back: the backs of his thighs meet the sill
  (0.75 m above the floor), his shoulders go into the glass, the pane
  bursts **outwards** around him, he folds backwards over the sill, his
  legs follow, and he lands on his back on the wet pavement 1.2 m
  outside. Rain and the street's sound come into the room.
- Jabs only make him sway. Left alone for 6 s he comes round with 20.
- **Glass**: every shard ends lying on something (pavement, sill, floor)
  or is removed. Nothing hangs in the air. Teeth stay in the putty.

## 6. The room for it (changes to the site plan)

| Bay | Was | Now |
| --- | --- | --- |
| B1 (z 9.4) | one booth | two booths (tables at z 10.3 and 8.5); the couple sits at z 8.5 |
| B2 (z 5.0) | one booth | **finish spot**: clear floor 2.4 m wide at the middle of the pane; a small round café table with two chairs against each pilaster (z 6.5 and 3.5), all breakable, the chairs can be grabbed |
| B3 (z 0.6) | the door, a booth by its side light | the door; no booth |
| B4 (z -3.8) | one booth | **finish spot**: clear floor; the coat rack at the pilaster; the jukebox and the cigarette machine on the end wall |

## 7. Motion rules (what made the first version wonky)

- **No spinning.** His torso turned full circles when the fight began and
  when he lay on the pavement. Every heading difference is wrapped to
  plus or minus 180 degrees before it is used; every bone blend takes
  the short way round; a man who is down looks at nothing.
- **Feet stay where they are put.** No sliding: a step moves the body,
  standing keeps the feet still.
- **Every change of pose is blended** (0.12 s or more). Nothing pops.
- **Both of his hands have fingers.** Fists are fists.
- Proof is a film strip (`tools/strip.py`), not a single frame.
