# O3 people: the cold player's report (critic)

Played cold, headless, by real input (`tools/play.mjs`) on `ow/O3-people` at
a9ded77, dev server on 5373, every run muted. I played before I read
`docs/reports/O3.md`. My plays are in `tools/plays/critic/o3/`, with one small
driver of my own (`cold.mjs`: it walks to whoever the city put nearest, punches,
draws, shoots, and logs the heat, the police state and the words on screen
every 250 ms). Where a contest needed a man in a certain place I used the
owner's staging hooks (`dbgCop`, the `o3_people.mjs` punch and chase
staging). Everything after the staging was keys and the mouse. Frames are in
`docs/review/O3/critic/` (four JPEGs).

Severity: **blocker** = a user ask not met, a stuck state, a contest that
cannot end. **major** = most players feel it. **minor** = polish.

---------------------------------------------------------------------------
## 1. Findings, most felt first

### B1 (blocker): a fist fight with a cop I punch first freezes for good. I can neither win nor lose, and my controls stay in the fight.
The first thing a player does to test a police system is walk up to a
beat cop and hit him. The fight starts ("COP" bar, the fight's camera), then the cop
freezes mid-blow and stays that way.
- **Idle hands** (`cop_fists_idle.json`): a cop is put 5 m ahead. I walk up and give
  one LMB, then let go of the controls. In the first 5 s he lands 4 blows (100 to 69). From
  then on, for 95 s, nothing more happens. The fight's record stays
  at `hisState: attack, hisClip: br_hookL, taken: 4`, and he stands with his
  arms down (frame `1_cop_fight_frozen.jpg`).
- **First-timer hands** (`cop_fists_fight.json`, play.mjs's `fight` step): after 150 s
  the result is `FAIL the fight ended in time`, with `landed 0, taken 5, his state attack
  br_cross, his state clock t = 144 s`. The fight cannot be won either.
- An unstaged run (I ran to a real beat cop and punched him) gave the same
  freeze (`br_hookL`, 75 s, 2 taken).
- **Cause (from the log, then the code):** 0.14 s after the event `fists`
  comes `send foot d:2`. `Police.stepResponse`
  (`src/police/Police.js:321-323`) looks for the nearest cop whose `job ===
  'beat'`, and the man I am fighting still has that job (copFists only sets
  his *mode* to `'fight'`). So he is sent to arrest me: `mode = 'approach'`,
  `path = null`. From then on `People.step` no longer skips him
  (`src/people/People.js:793` skips only `mode === 'fight'`), so he is stepped
  as a walker. His locomotion clips replace the brawl's attack clip, and
  `Brawl.stepHim`'s `case 'attack': if (clipDone)` (`src/game/Brawl.js:1328`)
  never comes true. The owner's `o3_punch_fists` proof does not catch it
  because the cop there is already `respond` (a walker is punched first).
- **Fix to prove:** copFists.start sets the man's job to something
  stepResponse never picks (or stepResponse skips `mode === 'fight'`). The same
  check is needed for a gang man (`hands.js` → `fists.start(p, {why:'gang'})`)
  and for the run-into push (`People.js:760`). Also add a safety net in the
  stand-in: an attack state older than 3 s goes back to guard. Then play
  idle, bad, medium and good with a **beat cop punched first**.

### M1 (major): unstaged crimes downtown get no police answer, or a late and uncertain one. Drawing the gun first erases the witnesses.
None of these were staged. I walked to whoever was nearest on Grand Avenue
at the start.
- **A walker punched down** (2 tries, `cold_punch.json`). Try 1: nothing on
  screen for 35 s, then `HEAT 1` and `LOSE THEM.` while I stood at the spot
  (the police state was already `search`; a cop was 25 m off). Try 2: nothing at all in
  120 s (`reports: 0`, nobody saw it). The man I punched never tells anyone
  (`src/police/crime.js:16`: "he is no witness of his own").
- **The gun out (RMB) and two shots among 16 walkers** (`gun_crowd.json`,
  `gun_witness.json`, 3 tries). The street does run (1, then 6 of 16 fled).
  Try 1: no heat in 45 s. Try 2: two witnesses jogged to a call box. `HEAT 2`
  came 30 to 45 s after the shots, and it was back to `0` within 15 to 30 s while I
  stood still at the spot. No car was seen near me. Try 3: `seen: null` on
  both shots, so no heat in 60 s. **Why:** the RMB draw is a 'menace' that sends
  everyone within 7 m (and 20 m in front) running (`src/people/hands.js`
  `menace()`). By the time I fire, nobody is within `SEE.civ` 25 m in line of
  sight (`People.js:427`), so the shot has no witness.
  Drawing first is a free way to make a shooting unseen.
- The north star asks that "a shot scatters the street and sends a witness
  running for a call box", "within seconds, in a way he can see". The
  scatter works. The police side, for a player who has not found a cop
  first, is a coin toss and half a minute late.
- **Fix to prove:** a shot is heard, not seen. Anyone within about 45 m who
  fled the menace or the shot counts as a witness (one of the fleeing goes for the box). The
  victim of a punch, once up, reports too. While the heat is that of a report
  and I stand at the place, the first car or cop must reach the place and
  find me there before the heat can die. Re-play: punch, then shoot, unstaged,
  three tries each on Grand Avenue. Each must answer within about 10 s with
  something seen (a witness seen going, a whistle, a siren), and the heat must hold
  while I wait at the spot.

### M2 (major): the keys card is wrong after an arrest, and the title disagrees with the street about RMB.
- After the station (`Released. Fined $50. They kept the gun.`), 4 s later
  the card `[L] PUNCH [R] THE GUN` comes **again**, but the gun is gone (RMB
  now says `no gun`). That is a card shown twice, and the second time it is
  false (`hands.js:61`: `this.taught` is not the save's once).
- The title's key line says `RMB STEADY, OTHER FIST` and has no "draw".
  In the street RMB *draws* the gun (a menace that clears the street). A first-timer who
  reads the title right-clicks for the other fist and scatters Grand Avenue.
  The card is the right one. The title is O7's, but the rule is this lane's:
  one key, one meaning, said the same everywhere.
- The card's own wording, `THE GUN`, is not a verb. `DRAW` reads.

### M3 (major): the arrest's warning on foot is 1.28 s.
`Hands up.` comes and the black follows 1.28 s later (`HEAT.arrest.warn 1.3`).
This is fair *only* because the cop walks over first and the card `[SHIFT]
run [LMB] fight` comes once. On the second arrest of the night there is no
card. A man who stops to look at the cop (most players do the first time)
is cuffed before he has read the words. Frame `2_hands_up.jpg` reads well:
the words are centred and the cop is close. 2 s would be the middle hand's
time. Keep the warning text exactly as it is.

### m1 (minor): the station wake is a dark wall.
I wake facing a blank black facade with one lamp. Only the line says where I
am (frame `3_station_wake.jpg`). Turn the eye to the headquarters' door or
its lamp, so the frame itself says "station".

### m2 (minor): `E GET IN` shows during the fist fight.
In the frozen fight (frame 1) the car prompt sits under the COP bar. A prompt
during danger breaks GAME_TWO B6. And if E works there, I can climb into a
car mid-fight. Clear the city's prompts while the brawl is on (as `warn()`
already does for the warning).

### m3 (minor): the roadblock does not read.
In the chase frame at the moment the roadblock is made (River Rd), it is two
dark specks about 80 m off with no red lamps lit. The first a player knows of it is the
stop. Light their domes (the red is in the palette) and stand them under a lamp.

### m4 (minor): the stagger moves a man through things (code, not seen).
`src/people/hands.js:152`: the first jab moves him 0.3 m (`p.fig.pos.x +=
dir.x * 0.3`) with no `colliders.resolve`. A man standing with his back to a
lamp post, a wall or a stall can be pushed into it. hitByCar resolves (line 737).
The jab should too.

### m5 (minor): a man punched down lies there until I look away (the owner's left 6).
He lies there with no get-up. Players will stand over him and wait. That is
fine for a body, odd for a man who was only hit twice.

Not measured by me (time): input latency (the first LMB landed on the press
in every run; `hits` counted on the click), the pad play, fps.

---------------------------------------------------------------------------
## 2. The four proofs (mine)

| contest | idle | bad / first-timer | medium | good |
| --- | --- | --- | --- | --- |
| **walk-over arrest** (walker punched before a cop, owner's staging) | LOSES, warned: `Hands up.` at 6.96 s, `Arrested.` 1.28 s later, station in 2.9 s, heat 0, the gun gone | - | - | - |
| **fist fight with a cop who came to arrest me** | - | WON by play.mjs's first-timer in 43.7 s (3 rounds, 17 landed, 10 taken); he lies there, HEAT 2, `E TAKE THE GUN`, a patrol car | - | - |
| **after that win, hands off** | LOSES, warned: search, then found by a sent cop at 130 m, `Hands up.` 94.9 s, arrested 96.2 s | | | |
| **fist fight with a beat cop I punch first** | **NEVER ENDS** (B1) | **CANNOT WIN** (B1) | - | - |
| **car chase at HEAT 3** (owner's chase driver) | LOSES, warned: boxed by two cars, `Hands up.` 3 s before the cuffs (frame 4) | - | 1 win of 2 (try 1 arrested at the River Rd roadblock after a crash, warned; try 2 lost them in 70 s, `Clear.`) | not run |
| **a shooting downtown** (unstaged) | the heat never comes, or comes and goes (M1) | | | |

---------------------------------------------------------------------------
## 3. Code that wins for the player or loses without a tell

- `src/police/Police.js:321-323`: a cop in my fist fight is picked as the
  "foot" responder (job still `beat`), which freezes the fight (B1).
- `src/people/hands.js` `menace()` + `src/people/People.js:427`: the draw
  clears the witnesses before the shot, so drawing first makes the shooting unseen (M1).
- `src/police/crime.js:16` (`victim ... no witness of his own`): a man I
  punch never reports, even after he gets up and walks off.
- `src/police/Police.js` `report()`: a reported crime puts the police straight
  into `search`, and the heat can die while I stand at the very place (seen
  once, M1).

---------------------------------------------------------------------------
## 4. The user's asks for this lane

1. **"react to player interaction (dynamic police), fun shootouts,
   brawls"**: **not met.** A punch before a cop: yes, at once. A shot with no
   cop near: half a minute late, or never (M1). A brawl with a cop I punch
   first: frozen (B1).
2. **"GTA but noir... freedom to cause havoc... one that reacts"**: **not
   met.** The verbs work (punch, draw, shoot, take the car). The answer to
   havoc downtown is uncertain (M1), and the most natural havoc (hit a cop) ends in a
   stuck fight (B1).
3. **"a police system"**: **met.** HEAT 1 to 3 seen, shields top right, `HEAT
   n` then `LOSE THEM.`, a beat cop walking over, patrol cars, a roadblock,
   boxed in the car, the arrest and the station, `Clear.`.
4. **"everything works"**: **partly.** The crowd walk: 1,785 frames, 0 people
   through people, 0 in walls, 0 eye-in-man. A car into four walkers: all four
   dashed clear (none hit, so "a man a car hits goes down" is not shown in my
   play). Bodies are not solid to feet or to cars (the owner's left 6). The jab's push has no
   collider (m4).
5. **The three bars**: **not met.** A warning before every arrest: yes (1.28 s
   on foot is short: M3). The heat read on the frame without a word: yes (the
   shields). Nothing locks me: **no** (B1). The `E GET IN` prompt in danger
   (m2).

---------------------------------------------------------------------------
## 5. The owner's left list: what a player would feel

- **Left 3, no traffic** is the biggest felt gap of the night, but it is O2's.
  The streets hold only my car and theirs, so there is no driver to pull out, and a
  chase is me against an empty city.
- **Left 6, a man down stays down until out of sight** is felt at once by
  anyone who punches someone (m5).
- **Left 1, the crowd hard to see in the dark**: I agree. A witness going to
  a box is rarely seen, which is part of M1's "the heat comes from nowhere".
- **Left 7, the arrest is a cut**: fine as a cut. Pair it with M3 (a beat
  longer) and m1 (wake facing the station).
- **Left 11, roadblock rammed is a dead stop**: in medium try 1 the bot
  stopped at the roadblock after a crash and was cuffed (warned). That is fair, but the
  block was not seen coming (m3).

---------------------------------------------------------------------------
## 6. Good: must not be broken by the fixes

- The walk-over arrest: the cop walks (time to choose), `Hands up.` centred
  and close, the cuffs, the black, the station in under 3 s, and the line
  `Released. Fined $50. They kept the gun.`
- The fight with a cop who came to arrest me is winnable by a first-timer
  (43.7 s), and the win reads: he falls where he stands, his whistle, HEAT 2, `E TAKE THE GUN`.
- The car chase: boxed reads (two cars, the red dome, `Hands up.` 3 s, frame
  4). Medium hands lose them in two tries; idle hands are cuffed.
- The crowd's bodies: no pass-through in a 1,785-frame walk through 18
  walkers. The dash clear from a car.
- The street runs from a drawn gun (visible, with cries). The revolver drum appears
  bottom right.
- The heat on the frame: shields top right, `HEAT n` for a moment, then
  `LOSE THEM.`, then `Clear.`.
- No errors in `#errlog` in any of my runs.
