# O7 — the night: the cold player's report

The critic of lane O7 (first pass, continued), on `ow/O7-night` at fd472c1.
Played cold, before reading `docs/reports/O7.md`: by real input on a dev
server at 5377 (headless, muted, `tools/play.mjs`), keys and the fake pad.
Six frames in `docs/review/O7/critic/`. The plays are in
`tools/plays/critic/o7/` (each one has an `about` that says what it does):

| play | what it does |
| --- | --- |
| `cold.json` | the title, BEGIN, a look round, M, Tab, Esc |
| `drive_shoot.json` | E at the coupe (latency), W (latency), steer, F, out, the wheel, one shot at the sky, then 70 s hands off |
| `bounty_poke.json` | the board, the card, the first wanted man: idle 15 s at 9 m, 5 s at 1.3 m, three jabs, the revolver drawn at 1.3 m, shots |
| `poke.json` | LMB on foot with empty hands, walking into a facade, the car into a wall at 17 m/s, the map up close |
| `save.json` | E in the first seconds, out, in again, a reload, CONTINUE, then BEGIN over a save |
| `pad.json` | the pad alone: X, square in, R2 and L2, options and the pause card, circle, square out, d-pad right and R2, d-pad down for the map, circle |
| `phone_oldcar.json` | the phone box with $50, then back to the coupe I came in |

The plays use two tool-side fixes. They set `N.controller.pitch = 0`
after the first look, because the play tool's first mouse move after
`clickOn` jumps the view by the distance from the button to the centre.
This is not the game's fault. They also use the owner's teleports to the
board, the box and the station.

Every play ran with no errors in `#errlog`.

Measured latencies:

| verb | latency |
| --- | --- |
| W to the car moving | 89 ms |
| E to the seat, first time | 171 ms |
| d-pad right to the revolver | within a frame or two |
| R2 to the shot | within a frame or two |
| M to the map | within a frame or two |

---------------------------------------------------------------------------
## Findings, most felt first

### B1. BLOCKER: the heat cannot be lost and nobody comes
**Why it is a blocker:** the heat contest wins itself when the player does nothing. This is user asks 5 and 8.

**What I saw:** I drew the revolver at the start kerb, fired once at the sky and then stood still for 70 s with the gun out, in the middle of Grand Ave.
- 0 s: two shields and `Lose them.`
- 20 s: `Stay out of sight.`
- 35 s: no heat, no line.

Nothing came at any point: no car, no man, no siren, no witness. `G.police.units` stayed at 0.

The line tells me to lose a "them" that does not exist. A player who reads `Lose them.` and drives away has lost no one. He learns that the heat is a timer.

**Steps:** run `drive_shoot.json`, or by hand: BEGIN, scroll the wheel, LMB, then let go of the keys. Frame 2.

**File:** `src/night/standins.js:49`. `this.quiet += dt` counts up no matter who can see me. There are no units, no sight test and no response, so `step` always lowers the heat by itself (`LOSE` at line 23).

**The fix to make in O7, while O3 is still out of main:**
- The stand-in must answer with something that can see me and take me. O4 already has the parts in main: the cop who ends a fight with `Hands up.`, and the police gunman variants in `src/combat/guns/`.
- Heat 1: a beat cop walks over within about 10 s.
- Heat 2 and up: two men from O4's police beat arrive with a siren heard first.
- Let the quiet clock run only while none of them has line of sight.
- Getting caught goes through O4's `fall.js`: the station, with `Hands up.` as the warning.
- Until that exists, the line must not say `Lose them.`.

The owner's Left names the empty city (O2, O3, O8). I am not asking for O3. I am asking that the one thing the HUD claims (someone to lose) is true in the build the user will play next.

### B2. BLOCKER: the bounty is a contest that cannot be lost
**What I saw:**
- At the board, `E  the wanted board` opens a WANTED card with three good posters (frame: the card works).
- I was put 9 m from the first man, a Tenements hood standing on a corner. He stood with his back to me for 15 s.
- I stood 1.3 m behind him for 5 s. Nothing happened.
- I jabbed him three times with LMB. Nothing happened: no swing was drawn, he did not react, no brawl started, no heat.
- I drew the revolver at 1.3 m. Nothing happened.
- Three shots put him down. `b0: down`, then heat 2 and `Lose them.`
- At the board, `E  collect  $150` paid the full reward for a kill.

He never turns, runs, draws or fights. A wanted man who lets you walk up and shoot him in the back is a coin on the ground, not a contest. It fails "can I lose?", and the idle, bad, medium and good proofs mean nothing for it.

**Steps:** run `bounty_poke.json`. Frame 1 shows the revolver at point-blank behind his back.

**File:** `src/night/bounty.js:123`, `spawn()`. The man is made with `ai: false, state: 'idle'`.

**The fix:**
- Give him O4's gang gunman: cover from the world, the raise and the glint before he fires. Or give him the crowd brawl's hood when I come at him with fists.
- He turns when I come within about 8 m, or when I draw. He runs if the fight goes against him.
- My fall goes through O4's `fall.js` (the hospital), with one line that names the cause.
- THINGS_TO_DO §5 (in the owner's own Left) also asks that a kill is paid half and a man taken in is paid in full. Do that now: it is a few lines in `use()` and it gives the fists a reason.
- Then run the four proofs on it:
  - idle: he shoots me, with a warning first;
  - bad: through by the third try;
  - medium: through in one to three tries;
  - good: twice in a row.

### B3. BLOCKER: LMB on foot with empty hands does nothing
**What I saw:** after BEGIN, on foot on Grand Ave, with no gun drawn, I pressed LMB. No fist was drawn, no swing, no sound, no hit. The input was swallowed. Then, in the next quiet second, the card `[WHEEL] the revolver` came up (frame 3).

The user's first words about this game are "get into shootouts, fist fight". A first-timer clicks to punch before he has read anything. In the street the click is dead, and the same is true with the bounty man at arm's length (B2).

The title's keys line says `LMB FIRE`, so the press is documented as gun-only. That is not enough: the rulebook (WAVE_C §2) gives LMB as "the right hand's main act: jab, fire".

**Steps:** run `poke.json`, steps `jab90` and `jab400`.

**File:** `src/scenes/city.js`. On foot in the city nothing takes `Mouse0` while `weapons.current` reports the base's `tommy` under empty hands. That stale `tommy` is the one O5 noted.

**The fix:**
- Bare-hand LMB on foot in the city throws O4's jab, so the hands, the swing sound and the whiff show on the press.
- A jab that lands on a man starts O4's crowd brawl with him and calls `crime.emit('punch')`, as O5's rooms already do.

### B4. BLOCKER: after the phone box, the car I came in is dead
**What I saw:**
- $50 at a call box, `A car is coming.`, then 35 s later `Your car.` with its ring on the minimap. The ring is good.
- I walked back to the coupe I had arrived in and stood at its door, looking at it.
- No `E  get in`. E did nothing. The car stands there, intact, and is now furniture.

This breaks "what looks usable is usable". With no traffic in main, the night has exactly one car you can enter.

**Steps:** run `phone_oldcar.json`. Frame 4 shows the old coupe with no prompt.

**Files:**
- `src/night/phone.js:98` (`G.city.car = car`).
- `src/scenes/city.js:278` and on: only `R.car` is ever offered E.

**The fix:** every intact car the night has spawned stays enterable. The simplest way is for city.js to offer E at the nearest of a small list (the old car and the phoned one), and for `R.car` to become the one I get into. Or the old one is driven away. It must not be left as a prop.

### B5. BLOCKER: the first car of the night is not saved
**What I saw:**
- At BEGIN the coupe is 4.7 m away and the card says `[E] get in`.
- I pressed it 4.5 s after the night began, which is what every first-timer does.
- `night.saver.skipped = 'too soon'` and nothing was written to localStorage.
- I drove, got out and fired. Then I reloaded: the title offers BEGIN alone.
- In the same play, out and in again 7 s later: saved, and CONTINUE puts me back in that seat (that part is good).

The quiet autosave fires only on getting into a car. So a player who gets in once and drives for half an hour has no save at all. If he then closes the tab, CONTINUE is not offered, or it is offered at an old car door. That is "a save that strands", from user ask 1.

**Steps:** run `save.json`. The first `eval` after E logs `skipped=too soon autos=0`.

**File:** `src/night/save.js:16` (`AUTOSAVE.after: 6`) and line 67.

**The fix:**
- Drop the `after` rule for the car. The kerb is already where BEGIN puts me, so a save there costs nothing.
- Also write the quiet autosave every few minutes while the heat is 0 and I am out of fights, in the car or on foot. The rule is already in `blocked()`; only the trigger is missing.
- Write it when entering any place's room with the heat at 0.

### M1. MAJOR: BEGIN is first and focused over CONTINUE, and it wipes the night without a word
**What I saw:** a returning player's title reads `BEGIN  CONTINUE`, with the brush under BEGIN (frame 5). BEGIN over a save started a new night: money 77 became 0, and the matchbooks, the bounty and the found places would all be gone. The next car autosave overwrites the old save for good. There is no "a new night?" step.

**File:** `src/ui/Hud.js:232`, the title's options.

**The fix:**
- When a v3 save exists, put CONTINUE first and focus it.
- BEGIN over a save asks once, in the kit's own lettering: `A new night? The old one is lost.` with BEGIN and back.

### M2. MAJOR: the first E into the car is 171 ms
GAME_TWO A1 asks for under 50 ms. The second E is fine; the owner measures 13 to 31 ms. The owner's Left already has this (one long frame, 75 to 140 ms on his machine). I measured 171 ms at a load of 16.

It is the first verb of the night, so it is the first thing the user feels.

**Steps:** run `drive_shoot.json`, the `E->inCar` line.

**The fix:** prewarm the cabin under the BEGIN fade, as the title already does for the city. Find out whether it is the geometry or GC with one performance trace before guessing.

### M3. MAJOR: the situation line is too small and sits on the signs
`LOSE THEM.` and `STAY OUT OF SIGHT.` are small, letter-spaced, and drawn over whatever lies at the top left. On Grand Ave that is the lit TAILOR sign, and the line is lost on it (frame 2). This is the one line an open world gives, so it must read at a glance from a moving car.

**File:** `src/night/hud.js`, the line's style.

**The fix:** give it the kit's torn ink backing, as the money and the struck-through `A CAR IS COMING.` already have. Make it a size larger.

### M4. MAJOR: the el ride's "view" is black
From the front of the first car, the frame is about 80 % black: the train's roof and the dark storeys (frame 6). There is no street below and no avenue with its neon. The ride from Grand to Bowery-Clock took about 44 s of sitting.

The el is sold as "a view". As it is, it is a dark tunnel.

**File:** `src/night/el.js`, the hold pose.

**The fix:**
- Seat the eye at the front window, lower, pitched down about 8 degrees so the street and its lamps are in the frame.
- Or put the eye on the open end platform.
- Check one frame against the reference: the reference's el is the city seen from beside it.

### m1. Minor: circle does not close the map or the wanted card on the pad
With the map up from d-pad down, circle did nothing (`open true`). Only d-pad down again closed it. On a PS5 pad, circle is "back" by convention, and in the pause card it already resumes. Make it close the map and the WANTED card too.

**Files:** `src/input/Pad.js`, `src/night/map.js`, `bounty.js:181`.

### m2. Minor: `MATCHBOOKS 0 / 6` and six empty dotted boxes on the pause card read as a checklist
User ask 2 is that nothing lists what to do, and an empty counter is a quiet to-do list. Show only the covers taken, and no count and no empty boxes until the first one is found.

### m3. Minor: no `E  get in` when I turned back to the car after getting out
Out of the coupe, turned to face it at its door: `promptShown` was empty, although E worked.

**File:** `src/scenes/city.js:291` (the `T.inCard` logic).

### m4. Minor: hidden HUD text stays in the DOM
`SAVED`, `$50 FOR A CAR` and `YOUR CAR.` stay in `#hud`'s text after they fade. It does not show on screen. It only matters to tools and screen readers.

### m5. Minor: the map card's paper has a grey bar outside its edge
At the left and under the bottom-left, a grey rectangle sits outside the map card (the M frame). It looks like a background panel offset from the paper.

**File:** `src/night/map.js`.

---------------------------------------------------------------------------
## Cheats (code that wins for the player or loses without a tell)

- `src/night/bounty.js:123`: the wanted man is `ai: false, state: 'idle'`. He never sees, turns, fights or flees, so a kill is free (B2).
- `src/night/bounty.js:137`: a kill is paid in full. The design (THINGS_TO_DO §5) pays a kill half.
- `src/night/standins.js:49`: the stand-in's quiet clock runs whether anyone sees me or not. Nobody is ever sent, so the heat always drains by itself in about 23 s a badge. Idle wins (B1).
- `src/places/Places.js:548` (O5's, made total by the stand-in): 20 s inside any room calls `police.lost()`, which clears all five badges at once. OPEN_WORLD wants an interior to lose them, so keep the rule. With a real response, it should be "out of their sight inside". Today a door is a heat-5 eraser.

None found that loses without a tell. There are no fails in the lane's own code. The falls are O4's and O5's.

---------------------------------------------------------------------------
## The four proofs, mine

| contest | idle | bad | medium | good |
| --- | --- | --- | --- | --- |
| the heat (stand-in) | **wins**: gone in 35 s, nothing came (B1) | cannot fail | cannot fail | n/a |
| the bounty | nothing happens (he stands) | cannot fail (B2) | cannot fail | wins, but never at risk |
| the phone box | n/a (no loss is possible, by design; fine) | $0: `$50 for a car`, clear | works | works |
| the el | n/a | n/a | E on, about 44 s, E off at the next station: works | works |

The lane has no contest that can be lost today. The two it presents as
contests (the heat and the bounty) win themselves or cannot be lost.

---------------------------------------------------------------------------
## The user's asks, with what I saw

1. **"A full open world game", from the title through an hour with no
   seam, no save that strands: NOT MET.**
   - No seam broke: title to city, car, foot, map, pause, the el, the phone and CONTINUE ran clean with no errors.
   - The save strands the natural first drive (B5).
   - The phone strands the old car (B4).
   - Systems do not know each other: a jab at a man is nothing (B3), and a shot is heard by a timer (B1).
2. **"No story mode or outright missions": MET, with one nit.**
   - Nothing lists what to do. The WANTED card has no arrow and no count, and the line is the player's situation.
   - The nit is the `0 / 6` matchbooks on the pause card (m2).
3. **"Keep it very much this same aesthetic": MET.**
   - The title over the live city with the red splatter.
   - The torn ink minimap.
   - The struck-through line as it changes.
   - The brushed shields.
   - The WANTED posters drawn in ink.
   - The pause card with its pad glyphs.

   All are one hand. Only the line's size and contrast fall short (M3).
4. **The three bars over the whole: NOT MET.**
   - Smooth: W in 89 ms is within a frame or two, but the first E is 171 ms (M2).
   - The middle: the line is right in kind, but it lies under the stand-in (B1) and is hard to read (M3). The cards come once, with pad glyphs on the pad. That is good.
   - Everything works: no (B3, B4).
5. **"This city should really react to player interaction": NOT MET.**
   - A shot gets shields, a line and the paper's `SHOTS FIRED`, and nothing physical.
   - A jab gets nothing.
   - A wanted man shot in the back gets nothing back from him.
   - Main has no people and no traffic. That is O2, O3 and O8, and the owner's Left says so. But O7's own stand-in could answer with O4's cops today (B1).
6. **Cohesive, not cluttered, attention to detail: PARTLY MET.**
   - The HUD is spare and in one language: the minimap, the shields, the line, the money only when it moves, and Tab for the rest.
   - The radio's dial name, the `saved` tick and the phone's ring are good details.
   - Cohesion fails where systems should meet: the fist (B3), the bounty (B2) and the second car (B4).
7. **The minimap bottom left: MET.**
   - A torn-paper patch, small, in the game's ink.
   - The streets named, heading up, my arrow.
   - The phone car's ring.
   - Hidden on the title and under the WANTED card and the pause.
   - M still opens the full map (on the pause card with the map at its side; d-pad down on the pad).
   - The cops' marks could not be seen, because no cop exists.
8. **"GTA but noir, freedom to cause havoc, a city that reacts": NOT MET.**
   - The verbs are not locked: I could shoot, drive into walls and leave the car anywhere.
   - But the city answers with a HUD timer and nothing physical, and the first verb a player tries on foot (a punch) is dead.

---------------------------------------------------------------------------
## The owner's report (read last): what a player would feel

- **Covered in the Left:**
  - "The city is still empty", the stand-in heat, and "the first E" are honest. A player feels them at once: the first E as a hitch, the empty streets in the first minute.
  - The "bounty pays a kill in full" item is there. The fact that he never fights is not; it is only called "standing still". That is the felt part.
- **Not in the Left:**
  - The dead first autosave (B5).
  - BEGIN wiping a save (M1).
  - The dead old car after the phone (B4). The code calls it intended ("the old one stays where I left it").
  - The dead LMB on foot (B3).
  - The el's black view (M4).
- §1 "What the user should feel" says: "the city answers the shot within the second (the shields, `Lose them.`, ...)". In play that is true of the HUD only, and a player feels the difference within the first minute.

---------------------------------------------------------------------------
## Good: keep it, do not break it

- **The title is the live city:** the coupe at the kerb under the el, NOIR CITY on its brush with the red splatter. BEGIN puts you at that kerb with no pop. CONTINUE appears only for a v3 save and puts you back in the seat.
- **The minimap:**
  - a torn ink patch with named streets, heading up;
  - the phone's ring;
  - hidden on the title, the WANTED card and the pause.
- **The line's strike-through as it changes** (`A CAR IS COMING.` struck as `Your car.` comes) and the brushed shields with the half-tone while they search.
- **Tab:**
  - the shields;
  - the car's state (`THE COUPE · SOUND`);
  - the distance;
  - the hour (11:05 PM);
  - `NO HEAT`;
  - the rounds.

  It goes on release.
- **The cards:**
  - `[E] get in` at the car;
  - `W DRIVE S BRAKE SPACE HANDBRAKE` in the seat;
  - `[WHEEL] the revolver` in a quiet second on foot;
  - pad glyphs when the pad is in use (square, R2, L2, X).

  One at a time, none in danger.
- **The pad:**
  - X wakes the pad and begins;
  - square gets in and out;
  - R2 and L2 drive;
  - options opens the pause card (the map at its side, keys in glyphs, settings, matchbooks);
  - circle resumes;
  - d-pad right draws the revolver and R2 fires;
  - d-pad down opens the map.

  No keyboard or mouse event was used in the pad play.
- **The phone box:**
  - `E  the phone` with no money clicks and says `$50 for a car`;
  - with $50, `A car is coming.`, then `Your car.` with a ring;
  - the line goes when I am in.
- **The el:** `E  take the el`, the ride, the chime, and E off at the next station's stair foot with the controls mine.
- **The WANTED card:** three different inked faces with names, districts and rewards. E opens it and puts it back. Paid gets `PAID` stamped on the poster.
- **The radio's dial name** (`1170 WJZZ`) on F, and the small `SAVED` tick bottom right.
- **No errors** in any of the seven plays.
