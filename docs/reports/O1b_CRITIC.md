# O1b — the cold player's report (the critic, second pass)

Played cold on `ow/O1b-streets` at cae4413, before reading `docs/reports/O1b.md`.
Everything below is from headless plays by real input (trusted keys and mouse,
`node tools/play.mjs`), muted, at 1440 x 900, on the user's laptop at load
20 to 178 (other lanes). My plays are in `tools/plays/critic/o1b/` (c1 to c10);
six frames in `docs/review/O1b/critic/`. Where I placed the eye by `setPose` or
`pos` to save walking, the step that mattered (the walk, the look, the E, the
car) was by real input.

**Verdict: two blockers, six majors.** The lane is real and much of it is good
(section 2), but the user's "add items" is not felt (he will not find them),
the firehouse is a red wash pasted over shop fronts, and "populate the city"
and "a bit more color" are not met as a player sees them.

---------------------------------------------------------------------------
## 1. Findings, most felt first

### B1 (blocker) — The items are invisible and the prompt does not come as a man walks
User ask 1 ("def add ... items"). There are 148 in the whole city (42 cash, 24
rounds, 60 bottles, 6 matchbooks, 16 papers): the nearest roll of cash is 177 m
from the Grand Ave start, the nearest box of rounds 215 m. And when you are at one:
- **Seen from 4 m** (frame `3_items_at_four_metres.jpg`, each item at the frame's
  centre): the box of rounds and the bottle cannot be seen at all, the roll of
  cash is a two-pixel glint by the drums, the matchbook is a small white fleck.
  They are dark grey on a black-and-grey brush-field ground (`parts/items.js`
  line 22 the rounds `0x8c8c8c`, line 27 the bottle `0x3a3a3a`).
- **Walked straight at with a man's gaze** (eye 7 degrees down, W held,
  `c10_walkover.json`): the roll of cash: blocked by the drums at 1.9 m, **no
  prompt ever**; the bottle: walked right over it and 8.6 m past, **no prompt
  ever**; the box of rounds: the prompt came at 2.1 m. The cone is 0.55 rad
  round the eye's line within 2.7 m (`parts/items.js` line 15, `REACH`,
  `CONE`), so a thing on the ground at 2 m is only found by a man who looks at
  his shoes.
- When I did aim at them (`c4_items.json`), every take worked: the prompt
  `E TAKE`, E on the press (about 75 ms from key down to the count, polled),
  the line said (`$14 - $14`, `12 ROUNDS - 12 IN THE POCKET`,
  `THE ROSELAND - MATCHBOOK 1 OF 6`, `A BOTTLE`).

Fix, as I would want it as a player: each item gets a tell that reads in the
ink at 6 to 10 m (a paper-white rim or glint that catches the nearest lamp, or
the thing put in a lit spot: a doorstep under a bracket lamp, a crate top under
a pool), the cone measured downwards (a thing at the feet within reach is
"looked at" when it is anywhere in the lower half of the frame), and a few
more near where a player starts and walks (the starts' blocks, alleys off
Grand Ave). Prove it with a walk-over play like mine: the prompt comes for
each kind without aiming.

### B2 (blocker) — The firehouse: a red wash, pasted over shop fronts, a bicycle through its door
Baxter St, east face, x -39 z -51 (`?start=city`, walk south-east to Baxter St
and Centre St). Frames `1_firehouse_at_arms_length.jpg` and
`2_firehouse_from_across_baxter.jpg`.
- **The colour rule broken**: at arm's length the red doors are **47.6 %** of the
  frame (`tools/colour.py`), flat saturated red; from across the street 1.7 %,
  all in one block. The brief's "never a wash" fails the moment a player walks
  up to the one red thing he will walk up to.
- **The doors are a decal on a shop front**: the lot keeps its shop boards
  (HARDWARE, SHOES, CAFE) hung over the doors, its iron pilasters drawn across
  them (four red panels, not two doors), a red lamp under the CAFE board. From
  the street it reads as three shops painted red under `ENGINE CO. 7`.
  `src/city/kits/uniques.js` line 106 (the doors at z 0.06 on the face) and
  `src/city/kits/dress.js` (the boards and fronts are laid on the lot without
  asking whether a unique stands there).
- **A bicycle stands through the door**: its two wheels are drawn half inside
  the red panel (bottom left of frame 1). `src/world/dressing.js` places its
  wall props on the lot's face without the unique's span (`UNIQUE_W`, line
  499) kept clear.
- Check every one of the 27 uniques for the same three things (boards over,
  fronts through, props in the doorway), not only this one.

### M1 (major; blocker against the user's words, but routed) — The city is still empty
User ask 2 ("I assume you are going to populate the city"). In my ten blind
frames, the start, the walk and the drive: **not one person and not one other
car**, moving or parked, except the coupe at the start. That is O2 and O3 (not
merged into this branch), but the user will read this lane's report as the
answer to his sentence. The report must say plainly in its first lines: the
people and the traffic are O3's and O2's, not here yet. Pigeons (two flocks
flushed in my drive) and steam are the only life.

### M2 (major) — "A bit more color": in most streets there is none; where there is some it is a flood
User ask 2. `tools/colour.py` on my 21 frames: **mean 0.19 %**, and **7 of the 10
blind frames under 0.1 %** (Dock Rd 0.00, the Straight 0.00, Canal St 0.01,
Mott St 0.02, the Bowery 0.03, Houston St 0.05, Pell Ln 0.05). The only frames
where a player sees colour without hunting: the title (blue DINER), the Grand
Ave start (the theatre's red and amber, 0.45 %), Doyers Ln's pawnshop balls and
red reflection (1.32 %, the best frame of the lane), Rivington Ln's blue
(0.31 %). Then the firehouse at 47 % (B2). The user asked for "a bit more,
still the vast majority black and white": aim for every street having one
accent a driver sees (a red blade, a lit amber window, a blue sign) at about
0.3 to 1.5 % of the seat's frame, and nothing over 2 % at arm's length.

### M3 (major) — The shop windows' displays stand out of the wall into the street
Every lit shop front. `src/city/kits/dress.js` line 517 moves each display
`translate(0, 0, 0.12)` **out** of the face, and the pieces have depth (the
shoe shelves 0.25 m, `DISPLAY.shoes`), so the shelves, the radio's counter, the
jeweler's case stand 0 to 0.25 m proud of the facade, on the pavement side of
the window. Seen side-on from the pavement beside any shop (frame
`4_shop_shelves_out_of_the_wall.jpg`: FINE SHOES on Grand Ave's west side at
x -134 z 42, the shelves out past the white back card; again in my run into a
sandwich board at x -107 z 11). A man pressed to the wall stands in them. Put
them behind the window plane (negative z), the back card further in.

### M4 (major) — Things that look usable answer nothing
GAME_TWO C1, WAVE_C rule 7. E at each, looked at from 2.5 m (`c8_poke.json`): the
**phone booth** (x -201 z 54), the **mailbox** (x -110 z -42), the
**firehouse's doors**, the **ballroom's door** (a flat white card, frame-filling,
no prompt): no prompt, no sound, no line. A phone booth is the most usable-
looking thing in a city; at least `E  the phone` with a click and a dial tone
(O7's phone-box car comes later), the firehouse's doors rattling locked like
every other door, the mailbox a clank.

### M5 (major) — What I pick up means nothing I can see
- The **bottle**: `A BOTTLE`, then nothing (no throw, no count anywhere). The
  owner's Left 7 knows it; a player feels it the first time.
- The **box of rounds** with **no gun**: `12 ROUNDS - 12 IN THE POCKET` while
  `G.save.inventory` is `[]` (`src/world/items.js` line 31 `rounds()` puts them in
  the revolver's pocket whether or not I have the revolver). It reads as a
  promise of a gun I never get.
- **Money and matchbooks are said once for 2.4 s and then shown nowhere**: Tab
  showed nothing, and Escape opened no pause card in my run (state stayed
  `playing`). O7 draws them later; until then the line should at least stay
  longer, or Tab should show `$` (the rulebook's Tab is "the heat and the money
  for a moment").

### M6 (major) — Streets told apart: the districts yes, the streets in a district only partly
The blind test, mine (`c2_blind.json`: ten streets drawn by a seeded hash,
named before I read the key; frame `5_blind_ten_streets.jpg`): **districts 8 of
10** right. The two I missed were Tenements streets that read downtown: the
Bowery at Park Row (7: wide, tall brick, the el) and Clock St by the police
lamps (8). Inside the Tenements, Mott St, Pell Ln, Doyers Ln and Rivington Ln
(1, 5, 6, 9) read alike: narrow, black, the same washing and pennant lines;
only Doyers' red pawn balls and Pell's water tower tell them apart. And the
trades repeat: **two DRUGS stores facing each other** on Canal St (frame
`6_two_drugstores_facing_on_canal.jpg`: CASSIDY DRUGS left, DRUGS right, MORELLI
CAFE beside it), DRUGS and CAFE again together on Houston St (frame 3).
`src/world/streets.js` (Canal's and Houston's trade lists overlap; no rule
stops the same trade facing itself). The Docks and the Yards (2 and 10) read
at once.

### m1 (minor) — The new street things are dark on dark where no lamp falls
A bicycle against a wall 3.6 m away under no lamp: I could not see it
(`c5_smash.json` frame bike_before). The dressing counts 1,873 things; a
good share of them are invisible at night away from the pools. A lighter
rim or a placement bias towards the lamps' pools would make "more stuff" seen.

### m2 (minor) — Fists do nothing to the new things
Three jabs into a bicycle: nothing (no wobble, no sound, no smash event).
Walking into a sandwich board at a run knocks it over (good), so the fist
should at least rock it. (O6's code path; the owner's Left 2 names it.)

### m3 (minor) — The swim says nothing
Off Pier 5's end: the swim mode, the eye at the water, no fade (good). The page
text at 1.5 s, 9 s, 28 s and 68 s in the water was empty: I did not see the
card `[W] swim to the steps` (`src/world/swim.js` line 49 asks for it). The
pier's steps and their lamp are visible from the water when you turn round,
which is enough once you know; the card is what a first-timer needs. Hands off
for 60 s in the water: nothing happens (fine: the swim is not a contest).
The water is a flat black band with a ruled horizon (frames of
`c6_swim.json`); a few ripple strokes would help.

### m4 (minor) — The near ground is still the grey camouflage wash
The street at the bottom of most frames (blind 2, 4, 5; Canal St frame 6):
mid-grey blotches. Better than the first cold play, not gone (the cold
play's finding 3).

---------------------------------------------------------------------------
## 2. The four proofs

This lane has **no contest** (nothing to win or lose): items, the swim, the
train, the pigeons, the street things. So idle / bad / medium / good apply as
"does it answer every hand":
- **idle**: nothing in this lane wins or loses by itself. The swim never loses
  ("never a loss", `swim.js` line 12): hands off in the water for 60 s, nothing.
  Not a blocker, since it is not a contest.
- **bad** (wrong angle, walking past): the items do not answer (B1).
- **medium / good** (looking at the thing, E): every take works first press.

## 3. Cheats (code read)

Nothing that wins a contest. Two that lie a little to the player:
- `src/world/items.js` line 31 `rounds()`: rounds banked for a revolver the
  player does not hold, said as "in the pocket".
- `src/stages/noircity/parts/items.js` (the update's respawn loop): a taken
  roll of cash comes back after 300 s where nobody looks, so money is endless
  by farming one alley. Harmless now (money buys nothing yet), but O4's gun shop
  will meet it.

## 4. The user's asks, each as I saw it in play

1. **"More distinct from street to street, add more stuff (destructibility and
   items)"**: **partly met.** Districts read (8 of 10 blind), streets in a district
   partly (M6). More stuff: yes, 1,873 things, and they go over when the car
   takes them (7 shop panes, a bench and a sandwich board in one run up the
   Grand Ave pavement at 47 to 59 km/h, the car dented 4 %). Items: **not met as
   felt** (B1).
2. **"Populate the city and add a bit more color"**: **not met.** No people and no
   traffic (M1, routed to O2 and O3); colour mostly under 0.1 % of the frame, one
   47 % flood (M2, B2).
3. **"To completion, super awesome, fun, cool, and polished"**: **not yet.** Good
   bones, but B1, B2, M3 and M4 are the kind of thing the user notices in his
   first five minutes.

## 5. What is good and must not be broken

- The Grand Ave start: the coupe, the el overhead, the theatre's marquee with
  red and amber, the shop boards with real names (ESPOSITO TAILOR, BRUNO RADIO,
  FINE SHOES, NOLAN SHOES, JEWELER) in different letterings.
- Driving up the pavement: shop glass breaks, benches and boards go over, the
  car shows it; E into the coupe acts at once and the teach line
  `W DRIVE  S BRAKE  SPACE HANDBRAKE` is one line, then gone.
- The take itself: on the press, the line with the count, the feet never held.
  The paper's card (`THE EVENING STAR`, `RAIN TO LAST THE NIGHT`) is a lovely
  thing; keep it exactly.
- The matchbook line `THE ROSELAND - MATCHBOOK 1 OF 6` (a collection a player
  understands at once).
- Doyers Ln (the pawnshop's red balls, the laundry board, the red in the wet
  street) is the best street frame of the lane: that is the colour dose to copy.
- The Yards' Straight (telegraph wires, a bare tree, the fence) and Dock Rd's
  warehouses: districts recognised in one look.
- Off a pier's end the swim is the eye at the water, no fade, no fail.
- The pad play (`tools/plays/o1b_pad.json`) passes: the pad alone takes every
  kind, 0 key or mouse events.
- No errors in any of my eleven runs.
- Frame rate at the five busiest spots against `shot=perf` measured at the same
  moment (`MOMENTS=city node tools/fpstable.mjs 4`, load 130 to 178, GPU 93 to
  100 %): Grand Ave from the car **1.20 x**, the el's corner 1.88 x, Broadway to
  the clock 1.27 x, the Bowery 1.53 x, the quay 1.78 x. Do not spend this room on
  the fixes above: they are placement and material, not geometry.

## 6. The owner's Left, read after playing: what a player would feel

- **Left 1 (the drive's hitch bar not proved)**: felt if it is real; my fps
  reading at the five spots is at or over `perf`, so I did not feel a slow
  frame in my drives, but I did not run the ten-minute drive.
- **Left 3 (the colour is a touch)**: felt: it is M2. "By design" no colour in
  the Docks, the Yards and on the Hill is too little against the user's words.
- **Left 7 (the bottle does nothing)**: felt the first time a bottle is taken (M5).
- **Left 12 (awnings, boards, displays, uniques are relief)**: felt once a car
  goes up the pavement: the glass breaks but the awning over it and the board
  stay; less felt than M3 (the displays out of the wall).
- **Left 13 (the dish lamps' white wedges)**: seen in the Yards (blind 10), mild.
- Not in the Left and should be: B1 (the items unseen), B2 (the firehouse), M3
  (the displays proud of the wall), M4 (the booth and mailbox silent), the twin
  trades (M6), and a plain line that people and traffic are O2's and O3's (M1).
