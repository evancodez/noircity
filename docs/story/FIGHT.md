# The fist fight — design, version 4

The user played version 3 on 2026-09-30: "The fighting mechanics are
definitely significantly improved", and "It's almost there, but it doesn't
feel polished... you can just spam punches and you're just going to win.
You should have to dodge." Version 4 (lane B8, `docs/story/briefs/B8_FIGHT.md`)
keeps what worked in version 3 (each button an arm, the guard with two
sides, blows that hit places, a dodge that is a step, punches that land, the
room as a weapon rack, the finish through a window) and changes five things:
the way in, the wind-up, the answer to a punch into the guard, the things
he picks up and throws, and the things in my hands. It also makes the rules
take their room as data, so the second fist fight (Pier 9) is a small job.
When this document and an older one disagree, this one wins.

## 0. The feel, in one paragraph

Every press does something at once. A tap is a jab; a hold loads a hard
punch I can see and hear loading, three ticks at the fist, and it lands
three sizes bigger. He shows me when he is open and when he is about to
swing, a beat before it matters. If I punch into his guard he hits me back
straight away, unless I get out of the way; if I read him, step off the
line and hit the opening, I win. He fights with the room: he throws plates
at me (a chevron tells me which way to step) and swings stools; so can I,
and a thing hits harder than a fist.

## 1. The way in (scene 2's first beat, `start`)

After his line, one continuous move of about four seconds, no cut, the look
still mine within 0.3 rad (controller mode `brawlIn`): he stands (his stool
goes over; the room starts to clear), comes down the counter behind my
right shoulder; his left hand lands on my shoulder (his palm is solved onto
the shoulder's place every step: the hand and the forearm at the right edge
of the frame); he pulls me round on the stool to face him, stepping back
off me as he pulls and letting go, so that face to face he stands at arm's
length (1.2 m: at 0.8 m his chest filled the frame); I come up and
back a step, my left hand takes the stool I sat on by its seat (the hand
solved onto the seat's rim while it moves) and sends it skidding into the
counter's foot, where it goes over and lies (a thing in the room from now
on, in every later beat and retry); my fists come up; he gives ground and
squares up. The lesson's first card follows. A retry never plays it again.
Entered from the title (a chapter chosen, a CONTINUE) the chapter card is
up: the room comes up under it, his line said, and the move begins once the
card has gone (round 1 drew the numeral II over him as he rose). A cut from
the diner has no card and waits for nothing.
`scenes/fight/start.js`; `?scene=fight&beat=start&t=<s>` scrubs it.

## 2. Controls

| Input | Action |
| --- | --- |
| **Left / right mouse button** | that arm. Tap: a **jab**. Hold: the **wind-up**; let go: the **hard punch** |
| **A / D** | a side-step, 0.55 m in 0.10 s (held on: circling) |
| **S** | a back-step, 0.6 m (held on: backing away) |
| **W** | walk in |
| **SPACE** (held) | block |
| **E** | take the thing I am looking at and can reach |
| mouse | look; the body keeps turning to face him |

What a hand holds is used by that hand's button: a bottle, a plate, a mug
goes into the hand on its side of the frame (a click swings or smashes it,
a hold throws it); a stool or a chair is held in both hands and either
button swings it (a click a swing, a hold a bigger one); the other hand
still jabs.

## 3. My side

- **The jab** is on the press, always: contact 0.06 s after it. The other
  hand may start 0.10 s after contact. Damage **3**.
- **The wind-up.** Held past 0.12 s, the same fist goes on into the
  wind-up from the jab's return (no dead time, no second jab). It loads in
  three levels as the hold passes **0.2, 0.4 and 0.6 s**: at each the fist
  snaps back a step further (it trembles more as it goes), a white ink tick
  flicks out at the fist and stays (one, two, three), a rising knock is
  heard, the view leans back a degree or two; at full the fist flashes (a
  ring of white strokes). Let go before the first level and the fist just
  comes home. A hop or a blow cancels it; a button still held after a blow
  winds again.
- **The hard punch**, by level 1 / 2 / 3: damage **9 / 15 / 22**; the lunge
  of the view 0.04 / 0.075 / 0.12 m; the burst 140 / 185 / 245 px at 1440 x
  900; the hit stop 3 / 4 / 6 steps; the view's kick 1.2 / 1.7 / 2.4 deg;
  he is driven back 0.55 / 0.95 / 1.45 m and open (stunned) 0.6 / 0.9 /
  1.2 s. Contact 0.08 s after the release.
- **A full-power punch into his raised guard breaks it** on its own: his
  arms knocked apart, open on both sides for a second, no bounce. (Three
  lesser hard punches blocked within 4 s still break it too.)
- **A press that could not act yet** waits 0.15 s, or for as long as the
  button is held: it then goes straight into the wind-up. Nothing is
  swallowed.
- **Things** (`Brawl.js THINGS`; a room adds its own kinds): bottle **22**
  (it breaks on him and its neck stays in the fist), neck **14** (twice),
  plate or mug **12**, stool or chair **35** and it breaks his guard. They
  count at level 2 or 3 for everything a blow does to him. His guard stops
  a bottle, a plate, a mug (it breaks on his forearm); nothing stops a stool.
  A thing swung at the air stays in the hand. Hit for 12 or more, knocked
  down, or at the end of the fight, what is in my hands falls and lies.
- Counters (a blow landing in his tell) count half again; a hard punch or
  a thing in his tell stops his blow; **a jab stops nothing** (version 3's
  jab stopped straights: a masher bought himself out of every blow).
  Combos: the second hit within 0.5 s 1.2 x, the third 1.4 x and a knock,
  after the fourth he covers up and steps away.
- My health 100; a retry starts at 60.

## 4. His guard and his answer

His guard has two sides (named by my screen: L is his right side). A side
comes down when he swings with that hand, after a blow of his misses me
(0.5 to 1.1 s), while he breathes (a hand dropped and shaken out), when a
hard punch lands (the stun above), when his guard is broken, when he is out
on his feet. A punch into a side that is up is **blocked**: a dull knock,
grey dust, my fist bounces back.

**The answer.** About three times in four a blocked punch is answered at
once, from the side that blocked: his fist cocks (a 0.2 s tell) and comes
straight in (contact 0.28 s after my punch landed). A blocked jab leaves me
able to hop or block after 0.12 s and to punch again after 0.4 s; a blocked
hard punch 0.3 s and 0.56 s: quick hands get out of a jab's answer, a
blocked hard punch is paid for. His guard stays up through the answer (a
jab into it bounces too). Pounded three times in 1.5 s, he answers with a
hook. Answer damage 8.

## 5. His blows

Told, fast, avoidable by moving (version 3 §4, unchanged in its rules):
the tell is a held pose, the fist cocked back beyond his outline; each blow
has a path aimed where I stood when the tell began; a hop out of the path
is a miss and opens him. A swing is left by a step away from the hand that
swings; a straight by a step either way or back; the block stops straights
and takes a quarter of a hook; a haymaker, a stool swing, a shove break it.

| His | Tell | Contact | Damage |
| --- | --- | --- | --- |
| jab (either hand) | 0.30 | 0.40 | 6 |
| answer (either hand) | 0.20 | 0.28 | 8 |
| cross | 0.32 | 0.42 | 9 |
| hook (either hand) | 0.38 | 0.50 | 13 |
| body (either hand) | 0.36 | 0.48 | 10 |
| haymaker (either hand) | 0.50 | 0.64 | 22 |
| rush | 0.45 | 0.70 | 22 |
| shove | 0.30 | 0.42 | 3 and a push |
| bottle neck thrust | 0.45 | 0.59 | 16 |
| stool / chair swing | 0.45 | 0.59 | 24 |
| throw | 0.45 | release 0.59 | 10 |

(His damage is about a third up on version 3's: a player who never steps
off the line must lose.) **Caught punching** (a fist out, bounced off his
guard, or winding) his blow lands half again: trading blows with him is a
losing game. A blow that lands, he presses: a second on its heels 35 / 45 /
55 % of the time by manner.

## 6. He uses the room

From his measured manner on, he goes for a thing on **0.4 of his free
choices** while things last (his answers and his follow-ups are not
choices), when one stands within 3.2 m of him and I am not on top of him
(1.05 m): a plate, a mug or a bottle to throw, a stool or a chair to swing.
In the seeded fights he takes up three to eight things in a fight, about
one of his blows in five or six: what is within his reach, not the rule,
is what limits it. His first bottle in his dirty manner is still broken on
the counter's edge and used by the neck.

- **A throw.** He backs off to 2.4 m or more (pressed, he throws from
  where he is after 1.2 s: holding a thing is never a reason to stand and
  take it), draws back with the thing (the tell, 0.45 s) and
  **a small inked chevron shows low at the side of the frame to step to**:
  away from the throwing hand unless a wall or the counter is that way.
  The chevron stays in the game after the lesson, for thrown things only.
  The thing flies on a real arc (12.5 m/s) along a lane aimed where I stood
  when the tell began; a hop to either side leaves it; it bursts on
  whatever is behind me (the room, the floor) and its pieces come to rest.
  In the air it is inked on the frame with three speed lines trailing back
  along the way it comes, and nothing else: the ring and the white rim round
  it were loud (round 2). The plate itself is lighter: a plate or a mug in
  his hand comes up paper-white over the tell (a clone of its china, its
  albedo and an emissive lifted with the tell's 0.4 s, so nothing pops at the
  release), stays white in the air, and goes back to china when it bursts,
  falls or he is struck off it (a dark plate against the dark room at five
  metres was not seen at all). A bottle stays dark: the lines carry it.
- **A swing with a thing** follows the rule for fists (step away from the
  hand that swings, or back), with no indicator, and reaches further (a
  stool 2.05 m).
- Going for a thing he keeps his guard up; only the reach and the take
  open him. Struck off an errand, he fights with his fists for 5 s.

## 7. The lesson (the first exchange)

One card at a time, low in the frame; the game does not pause. Blows in the
lesson do half damage; his health stays at 70 % and is full when it ends.

| # | What he does | Card | Ends when |
| --- | --- | --- | --- |
| 1 | lowers his right hand | `HIS GUARD IS DOWN   LEFT CLICK` | my left jab lands |
| 2 | lowers the other | `RIGHT CLICK` | my right jab lands |
| 3 | guard up; answers my first punch into it (slowed) | `GUARD UP: HE ANSWERS A PUNCH INTO IT.   WAIT FOR AN OPENING` | a hand drops and I land one |
| 4 | both hands down | `TAP TO JAB.   HOLD TO LOAD, THEN LET GO` | a hard punch of level 2 or 3 lands |
| 5 | a slow right hook, the arrow | `D   STEP AWAY FROM THE HAND THAT SWINGS` | it misses |
| 6 | the same from his left | `A` | it misses |
| 7 | takes a plate, backs off, throws it (slowed), the chevron | `A + D   HE THROWS: STEP WHERE THE MARK POINTS` | it misses me |
| 8 | jabs | `SPACE   BLOCK` | I block one |
| 9 | backs off; a bottle slides down the counter | `E   GRAB WHAT IS IN REACH` | 3 s or a grab |

Then `NOW FIGHT.` The lesson takes 20 to 30 s for the autoplayer, a little
more for a first-timer.

## 8. The open fight

His health is **116**; his manners change at 65 %, 30 % and 12 % of it:
measured, dirty, wild, out on his feet. What he does in each is version
3's (§7 there), plus the things above. Two rules keep the fight's length
fair:

- **Hurt fast** (16 % of him in 4 s) he covers up and gives ground a
  moment; and **a manner holds 9 s**: in its first nine seconds a run of
  blows takes him no further than the edge of the next. A run of luck does
  not end the fight in a breath. After that, no blow takes him past the
  next manner: he is always wild before he is out on his feet.
- **Losing is not failing**: at 0 I go down, black, and up again with 60;
  he has got his breath back a little (8 % of him each time, never past the
  start of his manner). From the third down in the same manner I come up
  whole (100): the fight gives a little to the man who keeps getting up.
  A life spent pounding his guard (more than 30 punches into it a minute:
  a masher throws about 45, a first-timer who struggles 10 to 19) is paid
  for as version 4 had it: 8, 16, 24 %... of him back, up with 60.
  Failing costs about ten seconds. (Version 4's first cut gave him back 8,
  16, 24 %... and a player who struggled was held in one manner for good;
  and 65 % of him read back as his measured manner, so a down in his dirty
  one could put him back at the top of his first. Both are gone.)

Blows move people and the room takes them (the stools, the counter, the
jukebox, the pie case, the café tables); a blow's own travel never carries
him through the counter or a wall (it is pushed back out every step). The
service aisle behind the counter is shut while we fight, and the street
door stays shut (it swung into the ring whenever the eye came within 2 m
of it) (`room.enter`).

## 9. The finish

At 12 % he is out on his feet and reels to the nearer finish spot (the
room's `finishes`: in the diner the clear floor before the glass of bays
B2 and B4); my next hard punch of level 2 or more, or a thing, is the last:
slow motion, out through the glass, onto his back on the pavement. Standing
in his way, I am shouldered out of it. If he cannot get to either window
(held up three times, or 12 s) he comes round and fights on: a fight that
cannot end is a bug.

**The card at the window** (round 2). Nothing told a player that only a
loaded punch (or a thing) ends it, and a player who mashes jabs a swaying
man for ever. So when he stands at the window, 0.7 s after he gets there, a
card low in the frame, in the lesson's hand: `OUT ON HIS FEET.   HOLD TO
LOAD, THEN LET GO` (the mouse inked). It stays 6 s. It does not come for a
player who has loaded a punch (level 2 or more, blocked or not) in the last
30 s: he knows. If I go on jabbing the swaying man, six blows, it comes
again for 4 s. It goes with him (the last blow, or his coming round).

## 10. One fight system, two rooms

`game.brawl.start({ opponent, room, who, manner, lesson, ... })`. The rules
(`src/game/Brawl.js`, `BrawlLesson.js`, `src/cast/brawl/*`) name no diner
thing; the room is data (scene 2's `brawlRoom` in `src/scenes/02_fight.js`
is the first user):

| room. | what |
| --- | --- |
| `bounds` | { x0, x1, z0, z1 }: the fight stays inside |
| `enter()`, `leave()` | the room made ready for the fight and given back (the diner shuts its service aisle and keeps its street door shut) |
| `items()` | what can be picked up now: { name, kind, object, pos, stand, take(), available() } |
| `hisItem(kind, near)` | the nearest thing of a kind he may go for |
| `things` | kinds of its own for `THINGS` (dmg, uses, hands, throw, then, breaksGuard, big, level) |
| `knockables()` | what stands on the floor to be knocked into: { pos, r, what, catch?, spin? } |
| `hardAt(tag, x, z)` | the name of a hard thing by its collider's tag (the counter, the pie case, the jukebox) |
| `onInto(hit, dir, at, brawl)` | what his back into it does; returns his clip (`br_into`, `br_into_stools`) |
| `onBump(at, speed, brawl)` | me driven into something |
| `finishes` | the finish spots: { name, spot, pane, land, clip } |
| `gift(why)` | someone slides me a thing ('lesson', 'first', 'bleeds') |
| `lane` | the x of the room's open aisle (his reel path, his way out of a corner) |

`who = { name, hp, manners }`: the bar's name, his hit points, his table by
manner (`src/cast/brawl/brain.js MANNERS` by default). Pier 9 adds a
room object, its things (a crate lid, a hook, a chain, a lantern), its
finishes (the plank doors, with their own clip) and its man.

## 11. Judged by play

The in-page autoplayer (`?shot=r2play&beat=lesson&seed=<n>&style=<s>&t=300`,
ten seeds each, the lesson included; second pass, final code): the
human-paced reader (`player`) wins 10 of 10, all in 60 to 110 s (73 to 104,
mean 86, 0 or 1 down); a first-timer who struggles (`rough`: half his reads
wrong or late, a punch into the guard every second or two) wins 10 of 10 in
111 to 217 s (mean 167, 3 to 8 downs); the masher (`mash`) wins none (4 to
32 downs: two held in his measured manner, one in dirty, two in wild, five
got him out on his feet at 72 to 286 s and could not finish him); the
player who never steps (`nododge`) wins none (10 to 12 downs, all held in
his measured manner); a player who takes whatever is in reach (`things`,
mean 82 s) wins faster than one who never picks anything up (`fists`,
91 s). No seed skips his wild manner. Round 2 adds two masher styles, for
the question "does a player who mostly mashes but lands a loaded punch still
reach his wild manner and the finish": `mashone` mashes the whole fight and
holds once, out on his feet at the window, after a few seconds of jabbing a
man who only sways (wins 4 of 10, in 84 to 226 s; his wild manner comes in 7
of 10, out on his feet in 5 of 10, and every one of those 5 ends but the one
the clock stopped at the window), `mashload` holds a button every 14 to 24 s
among the mashing (wins 8 of 10 in 102 to 275 s, 6 to 25 downs; wild in 9,
out on his feet in 9). The plain masher still wins none. Strips of each exchange: `?shot=b8duel` (`src/debug/shots/B8_fight.js`).
The plays `slice`, `fight`, `autoplay`, `continue` pass by real input, each
twice in a row.
