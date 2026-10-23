# O6b - the cold player's findings (car damage physical; awnings and hung lamps; the river's splash)

The critic plays the lane cold, by real input, before reading the owner's report
(`docs/reports/O6b.md`), and stands in for the user, who plays it by hand next.
Branch `ow/O6b-damage` at 7d3b069. Port 5380. The machine was at load 12 to 30, with
the GPU 100 % busy from other processes, the whole time.

My plays are in `tools/plays/critic/o6b/`. `ram_bot.mjs` is my own driver, not the
owner's `tools/lib/o6b_damage.mjs`. It points the car at the next parked car and
floors it: A / D by the heading error, W up to a top speed set by the profile, a
run-up in the lane under the el, S to back off. When my car is spent I get out,
walk to the next car I can take and E in.

| play | what |
| --- | --- |
| `cold_city.json` | the title, BEGIN, E, W down Grand Ave into whatever is ahead (the real game: `/?mute=1`) |
| `ram_medium.json` | the havoc on `?start=smash.ten`, medium hands, all ten cars, three blows each |
| `ram_good.json` | the havoc, good hands: a 22 m run-up and a diagonal into the door at speed |
| `ram_pad.json` | the havoc on the fake pad alone (`?padfake=1`) |
| `burn_idle.json` | ram until my car burns, then hands off in the seat |
| `parts_poke.json`, `parts_door.json`, `parts_door2.json` | the door and bonnet lying (`&ten=parts`): walk into them, across them, at them |
| `hanglamp.json` | aim at the nearest hung lamp under the el, a short burst |
| `river.json` | W held off the slip at the docks (`start=city&car=0,428,-1.5708`) |
| `lat.json` | key press to the first frame that shows it (page clock) |

Frames are in `docs/review/O6b/critic/` (1440 x 900).

---------------------------------------------------------------------------
## Findings (the most felt first)

### 1. BLOCKER - the havoc cannot be won by ramming: my car is spent long before any parked car is a wreck (user ask 3)

**What a player sees.** I took the coupe and rammed the parked cars on Grand Ave
by hand, for 4.5 minutes with medium hands (30 blows) and with good hands (a long
run-up, 40 km/h into the door). No parked car got anywhere near a wreck. **None of
them even steamed.** My own car was smoking or burning after two to four real blows
every time.

| run | blows | what my car took | most damaged parked car |
| --- | --- | --- | --- |
| medium (`ram_medium`) | 27 in 4.5 min | 0 to 2.54 (smoke) by blow 14, then the truck (already on a hub from my own earlier ram: 4 km/h, spent at once), then the lorry | the lorry 1.30, a sedan 0.95, the rest 0 to 0.6; 4 parts on the road |
| good (`ram_good`, 40 km/h into a door) | 1 | 0 to 1.35 (bonnet sprung, bumper dragging, a wheel wobbling) | that sedan 0.61 (a bumper and a wobble, **no door**) |
| good, then idle (`burn_idle`) | 13 | burning at blow 13 | 0.68 at most; the lorry took **0** from four rams at 22 to 26 km/h |

**Why, as far as I can read it.**
- The blow is split against the rammer. In `src/vehicles/Car.js:466-469`, my car
  takes `0.14 x (imp - 5)` head-on, but the car it meets takes `0.1 x (imp - 5)`.
  The per-corner extras in `CarDamage.knock` come on top of that, for my car too.
- `imp` is only the closing speed along the contact normal. The bed parks every
  car in a gap between two el columns, so from the lane under the el a car can only
  be reached on a diagonal. On that diagonal the normal speed is mostly under
  5 m/s, which means **zero** engine damage. The door may still hang at
  `k >= 0.3`, and nothing else happens.
- A tail ram along the parking lane has about 6.7 m of run-up (the gap to the next
  car), so 20 to 28 km/h is the most a player gets.
- Wrecks do not chain. A blast hurts cars within 6.5 m by 1.4
  (`CarDamage.js:1015`). Fire needs 3.3, and the parked cars stand 11.5 m apart. So
  my car going up next to them does not take any of them with it.
- There are only three cars a player can take: the coupe, the truck and the
  lorry. Every sedan is locked. My first rams had already put the truck on a hub.

**Steps to see it.** `/?mute=1&start=smash.ten`, BEGIN, E, then ram the sedans
with W / A / D, any way you like. After the coupe burns, take the truck and the
lorry. Count the wrecks: zero. `node tools/play.mjs tools/plays/critic/o6b/ram_medium.json`
replays it.

**The owner's report says so** (left 4: "harder rams were proved only by
staging"). The havoc proof's `check` asks for the damage states between the ten
cars, not for wrecks. The user's words were "ram every car until each is a
wreck". That is not possible as a player plays it.

**The fix wanted.**
- A car-to-car blow hurts the car that is hit at least as much as the rammer (a
  parked car is the soft one). Use the closing speed, not only the normal
  component, for a side blow.
- About three good blows (35 to 50 km/h) should take a parked car to fire. Fewer
  from a lorry.
- A blast should reach and hurt the cars parked either side (at least 2.0 within
  8 m), so a burning car next to two others is the GTA chain.
- Either more cars a player can take, or the takeable ones parked out of the ram
  line, so the second car is not already spent.
- Prove it with a play whose `check` counts **wrecks**, not states.

**A note for the art director.** The real game (the title's BEGIN into the city)
has **no other car at all** in this branch: `G.city.cars` is undefined there, and
the traffic is O2's. So the user will meet car damage only on his own car against
walls and el columns, unless he opens `?start=smash.ten`. One crash at 68 km/h
into the el took my coupe from 0 to 2.54 (smoke, the power going). A second took
it to 3.13: the bonnet torn off, a bumper dragging, a wheel off.

### 2. MAJOR - a door lying in the road stands upright on its edge like a tombstone (frame c1)

**What I saw.** On `&ten=parts` the door lies at rest with its centre 0.30 m up.
Its box is `e = [0.46, 0.30, 0.02]` and its quaternion is about the identity, so it
is a panel 0.6 m tall and 4.5 cm thick, standing on its bottom edge in the middle
of the lane. From the pavement it reads as a black slab standing up (c1).

**Why.** `Smash.settle()` (`src/destruct/Smash.js` about line 1001) squares a part
up on whichever local axis is nearest the vertical. Only `K.topple` (the wheel,
line 949) tips a part over off its edge, and `cardoor` has no topple. A door torn
off in play leaves with its hinge vertical and only a little spin
(`CarDamage.js:591`), so it can land the same way. I did not see a door come off in
my own rams, because no door tore (see 1).

**Steps to see it.** `/?mute=1&start=smash.ten&ten=parts`, then walk to (-119.6, 46)
and look north.

**The fix.** A thin plate (door, bonnet, bumper) always comes to rest on its
broadest face: the wheel's topple, or settle picking the smallest extent as the up
axis.

**What is right.** The man is stopped by it. He met it at 0.33 m, slid along it
and went round its end (`parts_door2`): solid, no pass-through.

### 3. MAJOR - damage does not read from the street in the dark (frame c3)

**What I saw.** Ten cars in the ten states (`&ten=states`), seen from the lane under
the el 10 to 20 m away. Only the two burning ones read. Dents, a hanging door, a
dragging bumper and a wheel off are black on black against the kerb. From the seat
during the havoc (c2) a victim's damage reads only when it drops (a wheel off) or
burns.

**Why it matters.** GAME_TWO 1 A.4: a hit nobody can see did not happen. The
owner names this as left 1 (the ink draws no contour between the parts of one
car).

**The fix wanted.** Every loose part carries its paper rim on the car (not only
once it lies on the road). The white mark at the break should stay on the part for
a few seconds. A shader lane gives a loose part its own ink id.

### 4. MAJOR - slow contacts break the rammer's car fast

In the second medium run, two attempts that never went above 15 km/h (stuck
against a sedan and an el column) left my coupe at 0.5 damage. By then it already
had the bonnet sprung and flapping, the front bumper dragging and a front wheel
wobbling. The pad run was the same: 15 km/h and two contacts gave the same three
parts. A player who scrapes a column while parking gets a flapping bonnet in front
of the screen.

The cause is probably the per-corner sum `D.corners[c] >= 0.75` reaching
`smashCorner` from repeated low contacts (`CarDamage.js:297`), which pops the
bonnet, loosens the bumper and wobbles the wheel all at once.

**The fix.** A smashed corner should need one blow of `k >= 0.55`, or a sum of
blows over a threshold, not a pile of nudges.

### 5. MINOR - `E GET IN` shows by distance, not by look (bed)

On the bed, standing by the coupe and looking straight up at a hung lamp, the
prompt `E GET IN` stays on. The bed picks the nearest car by distance only
(`src/scenes/smash.js` about line 450). GAME_TWO 1 C.1: the prompt comes when I
look at it and goes when I look away.

### 6. MINOR - a burning fail on the bed resets the whole havoc

After 13 blows my car burned. I was warned (`She's burning. Get out.`, 7 s
ahead), it blew, and the fail said `She went up with you in her.`. Then the retry
put every one of the ten cars back whole. Two minutes of havoc are gone. It is a
test bed, but it is where the user will try the havoc.

### 7. MINOR - the pedals card stays up into the first ram

`W DRIVE  S BRAKE  SPACE HANDBRAKE` is still on screen 5 s after the first W, at
the moment of the first blow (`ram_good`, blow 1). GAME_TWO 1 B.6: never a card in
danger. The card should go the moment W acts.

---------------------------------------------------------------------------
## The four proofs, mine

- **The havoc** (there is no fail; the win is ten wrecks):
  - idle: nothing happens, which is right for a sandbox.
  - bad, medium and good: **cannot be won** (finding 1). **Blocker.**
- **My car burning** (the havoc's own end; O6's warning):
  - idle: lost, warned 7 s ahead with the reason, the fail line says why, the
    retry in about 12 s. **Pass.**
  - good (get out): O6 proved it. Not re-run.
- **The river** (W held, 32 km/h): `The river.` 1.3 s before the drop. The splash
  is white for a quarter second from the seat (c4), then black and
  `THE RIVER TOOK IT.` at 0.65 s. **Pass.**
  - I could not see the sunk shape from the seat.
  - The ashore half was proved by the O1 critic and the owner. My play's wait for
    the fail missed the flag; the fail card was on screen.
- **The hung lamp:** aimed by the mouse, three rounds: dark, its cone out, a puff
  at the head (c5). **Pass.**
- **The pad:** E in, the pedals, the steer, the rams, E out, all on the fake pad;
  0 key or mouse events. **Pass.**
- **Latency:** E to the seat 22 ms (1 frame); W to the car moving 14 ms (1 frame).
  **Pass.**
- **fps:** measured once, with the GPU 100 % busy from other processes, so only the
  ratio means anything.
  - The ten states in view (`ten=states`, `pose=-120,-21`): 36.3 fps.
  - `shot=perf` straight after: 29.2 fps.
  - Ratio **1.24 x**. **Pass.**
  - The draw calls are 1,599 against perf's 728 (each loose part is a mesh per
    material while it hangs). Watch this when O2's traffic brings more cars.

---------------------------------------------------------------------------
## The user's asks, as played

1. **"car damage (would be cool for some physical stuff within reason)"**
   **Met in part.**
   - Seen in play:
     - dents
     - the bonnet sprung, flapping, torn off (my coupe, in the city)
     - a door hanging (the lorry, a sedan)
     - bumpers dragging and coming off
     - wheels wobbling and coming off, the car on its hub at 4 to 13 km/h
     - smoke, fire, the blast
   - Not seen in my play: a door coming **off** (none tore at 20 to 40 km/h).
   - The parts lie as things. But a lying door can stand on its edge (finding 2),
     and from the street the damage is black on black (finding 3).
2. **"everything works"** **Met in part.**
   - The parts are solid to a man (he slides round a door), the river answers,
     the hung lamps answer, and fps holds.
   - A door standing on its edge (finding 2).
   - Slow nudges break a car (finding 4).
3. **"freedom to cause havoc ... ram every car on Grand Ave until each is a
   wreck"** **Not met** (finding 1).
   - The street answers in sparks, dents and the odd part, but no car becomes a
     wreck by ramming.
   - The rammer burns first.
   - In the real city there are no other cars yet.

---------------------------------------------------------------------------
## Cheats (code that wins for the player, or loses without a tell)

None that win for the player. The one that loses without a fair chance is the
arithmetic of finding 1:
- `src/vehicles/Car.js:466` (the rammer takes 0.14 head-on)
- `src/vehicles/Car.js:469` (the victim takes 0.1, by the normal speed only)

The havoc proof `tools/plays/o6b_ram.json` checks the damage states, not wrecks, so
it passes while the user's ask is not met. The owner's left 4 names this.

---------------------------------------------------------------------------
## The owner's left list, as a player would feel it

| left | felt? |
| --- | --- |
| 1, black on black | Yes: finding 3. |
| 2, the sunk car's shape | Not felt: the fail's black comes first from the seat. |
| 3, a wheel inside a column's plinth | Not met in my runs. |
| 4, harder rams only by staging | Yes, it is the blocker: finding 1. |
| 5, generic shapes once off | Not felt at play distance. |
| 6, the far build | Not felt with ten cars. |
| 7, city awnings cannot be shot | A player who shoots an awning gets nothing: felt, minor. |
| 8, 9 | Not felt. |

---------------------------------------------------------------------------
## What is good and must not be broken

- Input on the press: E 22 ms, W 14 ms; the pad drives the whole havoc.
- The parts on a car move as parts:
  - the bonnet sprung and torn off over the roof
  - a bumper dragging
  - a wheel wobbling and then off, the car dropping onto its hub and crawling
  - from the seat the sprung bonnet is seen and the torn one clears the view
- A door lying stops a man (no pass-through).
- Nothing floating and nothing in a wall in any of my runs: 4 parts in the medium
  run, all at rest.
- The burning warning, 7 s ahead, with the reason; the fail line says what did
  it.
- The river: warned, the splash in ink, the words.
- The el's hung lamps go out to a burst; the shot-out head is dark.
- No errors in any of the twelve plays' `#errlog`.
- The frame rate with ten damaged cars in view: 1.24 x `shot=perf`.
