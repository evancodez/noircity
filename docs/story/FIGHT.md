# The fist fight — design, version 3: ARCADE

The user played version 2 on 2026-09-30. It looks a lot better and plays
better, and it is still not fun enough. His words:

- "it just feels really slow and super, super heavy"; "you want a really
  arcadey feel";
- "it doesn't really look like your punches land";
- "when the character lets his guard down, that's when you have to strike;
  if his guard is up you can't get through"; "maybe his guard is down only
  on one side";
- "you shouldn't have that line showing you where to dodge after the
  tutorial";
- "because it's so slow it's actually harder: you see him go for the
  punch, you dodge, then you come back and the hit lands";
- "make sure it feels smooth and doesn't feel janky";
- "it's paramount that gameplay feels fun to play and not super
  stiff / scripted. Things that occur should make sense from a game
  perspective";
- bug: a stool floats in the air after I hit him with it.

Version 3 keeps what worked (each button an arm, click and hold, a fight in
a room with things to grab, the finish through a window) and changes the
feel: **fast, light, readable, fair**. When this document and an older one
disagree, this one wins.

## 0. The feel, in one paragraph

Every press does something at once. I hit fast and he reacts to every hit.
He shows me when he is open and when he is about to swing, a beat before
it matters, and then things happen quickly. A dodge is a step: I am simply
not where the blow goes. Nothing is decided by a hidden window or a dice
roll. If I read him, I win the exchange; if I mash into his guard, I get
nowhere and get hit.

## 1. Controls

| Input | Action |
| --- | --- |
| **Left mouse button** | my **left** arm. It strikes the opening on the **left of the screen** |
| **Right mouse button** | my **right** arm. It strikes the opening on the **right of the screen** |
| click | a **jab** |
| hold, then let go | a **hard punch**: power by hold time, 0 at 0.15 s to 1 at 0.6 s |
| **A / D** | a **side-step**: a quick hop 0.55 m to that side. Held on, I keep circling |
| **S** | a **back-step**: a hop 0.6 m back. Held on, I keep backing away |
| **W** | step in, walk forward |
| **SPACE** (held) | **block**: both forearms up |
| **E** | grab what I am looking at and can reach |
| mouse | look; my body keeps turning to face him |

Two punches exist, the jab and the hard punch. With something in a hand,
that hand's button uses it.

## 2. Speed (the numbers that make it arcade)

All times in seconds. "Startup" is from the press (or the release, for a
hard punch) to contact.

| Mine | Startup | Recovery | Notes |
| --- | --- | --- | --- |
| jab | 0.06 | 0.14 | the other hand may start 0.10 after contact: five jabs a second, L R L R |
| hard punch | 0.08 after release | 0.26 | the wind-up can be held; a side-step cancels it |
| side-step, back-step | the hop takes 0.10 | 0.05 | a punch may start 0.12 after the hop begins; next hop after 0.25 |
| block | up in 0.05 | down in 0.08 | |
| walking | 3.2 m/s, full speed in 0.1 | | |
| grab | 0.15 | | |

| His | Tell | Strike | Recovery | If it misses |
| --- | --- | --- | --- | --- |
| jab (either hand) | 0.30 | 0.10 | 0.35 | open on that side 0.5 |
| hook (either hand) | 0.38 | 0.12 | 0.45 | open on both sides 0.8 |
| body shot | 0.36 | 0.12 | 0.4 | open on that side 0.6 |
| haymaker, overhand | 0.50 | 0.14 | 0.6 | open on both sides 1.1, off balance |
| rush | 0.45 | 0.25 (two steps) | 0.6 | runs past me, his back to me, 1.0 |
| shove | 0.30 | 0.12 | 0.4 | open 0.5 |
| bottle thrust, stool swing, throw | 0.45 | 0.14 | 0.5 | open 0.8 |

His pace: the quiet between his attacks is 0.9 to 1.5 while he is
measured, 0.7 to 1.2 dirty, 0.4 to 0.8 wild. He often throws two in a row.
The whole fight: **60 to 100 s** for a first-time player.

Every input is taken on the step it arrives. An input that arrives while
I cannot act yet is kept for 0.15 s and fires the moment I can.

## 3. His guard: strike when it is down

He has a guard with **two sides**. On each side it is **up** or **down**.

- **Up**: the fist is at the jaw on that side, the forearm upright in
  front of the face and ribs.
- **Down**: the fist has dropped to the hip or has been thrown; that side
  of his head and body shows.
- A punch into a side that is **up is blocked**: a dull knock, a puff of
  grey dust at his forearm, my fist bounces back, no damage, no hit stop.
  I have wasted the beat and he may answer.
- A punch into a side that is **down lands**.
- **Which hand**: the opening on the left of the screen takes my left;
  on the right, my right. With both sides down either lands, and
  alternating hands builds a combo.

When a side comes down (each of these is something the player can see and
learn):

| Cause | Which side | How long |
| --- | --- | --- |
| he **attacks**: the hand that swings has left its guard | that hand's side, from the start of the tell until he has recovered | the attack's own length |
| his attack **misses** me | see the table in §2 | 0.5 to 1.1 |
| he **breathes**: between attacks he lowers one hand, shakes it out, rolls a shoulder, wipes his mouth | one side | 0.6 to 1.0, more often and longer as he tires (every 2.5 s measured, 1.8 s dirty; wild: one side hangs low almost all the time) |
| I land a **hard punch** on an open side | both | **stunned** 1.2: he sways, arms loose |
| I **break** his guard: three hard punches blocked within 4 s | both | 1.0 |
| he is **out on his feet** | both | until the finish |

A blow that lands while he is in the **tell** of a jab, hook, body shot
or shove is a **counter**: it stops his attack and counts half again. A
haymaker, a rush and a swing with a stool do not stop for a jab; a hard
punch stops anything.

**Showing it.** The opening is drawn by his body: the dropped fist, the
lowered shoulder, the head exposed. For the first 0.15 s of an opening a
small white ink tick flicks at the open side of his jaw. No arrows, no
text, no outline.

**Combos.** Hits on an open man chain: each hit within 0.5 s of the last
is one more in the combo; the second does 1.2 x, the third 1.4 x and
knocks him back a step; after the fourth he covers up and steps away.

## 4. His attacks: told, fast, and avoidable by moving

- **The tell** is a pose he snaps into and holds: the fist cocked back
  beyond his outline, the shoulder dropped. On the first frame of a tell a
  white glint flicks on the fist that will swing, and he grunts. After the
  tell the blow is quick.
- **A blow hits a place, not a man.** Each blow has a reach and a path:
  - a straight (jab, thrust) covers a lane 0.35 m wide in front of him,
    to 1.5 m;
  - a swing from **his right** hand sweeps from **my left** across the
    middle; it covers my left and centre, to 1.4 m;
  - a swing from **his left** sweeps from **my right**;
  - an overhand covers the lane in front of him and a little to each
    side, to 1.6 m.
  He aims where I am when the tell ends. During the strike he cannot
  re-aim. If at contact I stand outside the path, it misses.
- So **a side-step away from the swinging hand gets me out** (his right
  hand swings: I step right, D). A step **toward** the swing keeps me in
  its path and it lands a quarter harder. A straight is left by a step to
  either side or back. Once I have stepped I am out; nothing drags me
  back in. A back-step leaves any blow except the rush.
- **Blocking** (SPACE) stops jabs and straights; takes a hook or a body
  shot for a quarter of its damage; a haymaker, a stool or a shove breaks
  the block and staggers me 0.5.
- He turns to face me at 5 rad/s between attacks and during a tell.
- **After the lesson nothing on the screen tells me which way to go.**
  The arrow and the slow motion belong to the lesson only.

## 5. Punches that land

When my punch lands on an open man, all of this happens on the same
frame:

1. **The fist is there.** My fist is drawn reaching his jaw or his ribs on
   the screen: the punch's end point is his head (or body) as the eye sees
   it, and the fist grows smaller as it goes out, so it arrives on him,
   not in the air in front of me.
2. **Hit stop**: the world holds 2 steps for a jab, 4 for a hard punch.
3. **Impact**: a white ink burst at the point of contact, 90 px for a jab
   to 220 px for a full hard punch at 1440 x 900, jagged, two frames,
   then a few flung drops of sweat.
4. **He takes it**: the head snaps away from the blow (30 degrees for a
   jab, 60 for a hard punch), overshoots and comes back in 0.25 s; the
   shoulders follow; a hard punch bends him and drives him back 0.6 to
   1.5 m; the cap jumps.
5. **The view**: a kick of 1.5 degrees and a push-in of 2 degrees of
   field of view for 0.1 s on a hard punch; half that on a jab.
6. **The sound**: a sharp crack over a low thud; a blocked punch is a
   dull knock; a miss is a whiff of air. Three clearly different sounds.
7. **His health** drops on a thin ink bar at the top of the frame, with
   his name, MACK; the lost part flashes white and drains. Mine is at
   the bottom left as now.

A blocked punch and a miss each look and sound unlike a hit, so that
after ten seconds a player knows which is which without thinking.

## 6. The lesson (the first exchange)

He squares up and **waits**; he does not hurt me until step 5. One card
at a time, low in the frame. The game does not pause. The arrow and the
slow motion exist only here.

| Step | What he does | Card | Ends when |
| --- | --- | --- | --- |
| 1 | lowers his left hand (the left of the screen is open) | `HIS GUARD IS DOWN   LEFT CLICK` | my left jab lands |
| 2 | lowers the other | `RIGHT CLICK` | my right jab lands |
| 3 | guard up, both sides | `GUARD UP: YOUR PUNCHES BOUNCE OFF.  WAIT FOR AN OPENING` | I have had one punch blocked, or 3 s; then he lowers a hand and I land one |
| 4 | lowers both hands, taunting | `HOLD, THEN LET GO   THE LONGER, THE HARDER` | a hard punch of power 0.5 or more lands |
| 5 | a slow right hook, the world at 0.4 x through the tell, an inked arrow from his fist to my safe side | `D   STEP AWAY FROM THE HAND THAT SWINGS` | it misses; `HE IS OPEN` while he is |
| 6 | the same from his left | `A` | it misses |
| 7 | jabs | `SPACE   BLOCK` | I block one |
| 8 | backs off; Dot slides a bottle down the counter | `E   GRAB WHAT IS IN REACH` | 3 s, or I grab something |

Then `NOW FIGHT.` for one second. A step already performed is skipped.
The lesson takes 25 to 40 s. His health is full when it ends. A retry
skips it.

## 7. The open fight

As in version 2, and faster:

- **We both move**, anywhere in the room, but never out of it: the door
  is shut while we fight.
- **Blows move people.** A hard punch knocks him back; whatever stands
  behind him takes him: stools go down one after another, the jukebox
  skips, the pie case bursts, plates fly off the counter, a café table
  tips. He shoves me too.
- **The room is a weapon rack**: bottles, plates and mugs on the counter,
  stools and chairs; Dot slides me a bottle. **E takes the thing I am
  looking at.** A bottle breaks on its first blow and its neck is good
  for two more; a plate or a mug is thrown and breaks; a stool or a chair
  is good for one swing and **comes apart on him**: its pieces fall,
  bounce and lie still. Whatever leaves a hand, mine or his, falls under
  gravity and comes to rest. Nothing ever hangs in the air.
- His guard stops a bottle or a plate; a stool or a chair breaks his
  guard.
- **He changes as he is hurt**:

| His health | Manner | What he does |
| --- | --- | --- |
| 100 to 65 | measured | jabs, hooks from both hands, body shots; tight guard, short breathers |
| 65 to 30 | dirty | takes a bottle and breaks it on the counter, thrusts with the neck; throws a plate or a mug from 3 m; shoves; feints (a tell with no blow: the glint is grey, not white) |
| 30 to 12 | wild | haymakers, rushes, picks up a stool; one hand hangs low; he bleeds, his cap is gone |
| 12 and under | out on his feet | §8 |

- **Damage**: he has 100. Jab 3, hard punch 7 to 15 by power, bottle 16,
  neck 10, plate or mug 8, stool or chair 22. Counter x 1.5, on a man
  open after a miss x 1.5, combo as in §3. I have 100: his jab 5, hook
  10, body shot 8, haymaker 18, thrust 14, thrown plate 8, stool 20,
  shove 3 and a stagger.
- **Losing is not failing**: at 0 I go down, the frame goes black, and I
  come up at the start of his current manner with 60.

## 8. The finish: out through a window, wherever we are

Unchanged from version 2. Two finish spots, the clear floor in front of
the plate glass of bays B2 and B4. At 12 health he is out on his feet and
reels to the nearer one; my next hard punch of power 0.5 or more is the
last: slow motion, he goes back over the sill and through the glass, which
bursts outwards, and lands on his back on the wet pavement. Every shard
comes to rest. Nothing floats.

## 9. Smooth, never janky

- Every action of mine starts on the step of its input.
- My hands blend between poses in 0.05 s or more; his body in 0.08 s or
  more. Nothing pops, nothing teleports.
- His feet do not slide: a step moves the body, standing keeps the feet
  still. His knock-back is a stagger with steps.
- No spinning: headings are wrapped, bones blend the short way.
- The view never enters a body, a wall or a piece of furniture.
- 60 frames a second through the whole fight.
- Proof is a film strip at 30 frames a second of each exchange
  (`tools/strip.py`), and a played fight.
