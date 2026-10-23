# O2 wheels: the cold critic (2026-10-23)

Played cold from the title (`/?mute=1`, BEGIN, no `&start`), then on the
proof beds, by trusted input only (`tools/play.mjs`; my plays and a small
driver in `tools/plays/critic/o2/`). Read `docs/reports/O2.md` only after
the play. The machine was shared with other lanes' captures throughout.
Frames: `docs/review/O2/critic/` (five).

Severity: **blocker** (a user ask not met, a contest that wins itself or
cannot be won or lost fairly, a pass-through a player sees, not knowing what
to do), **major** (felt by most players), **minor** (polish).

---------------------------------------------------------------------------
## 1. Findings, most felt first

### B1. blocker: a fare's destination cannot be found
- **What.** In a taxi the fare gets in and the objective line says a name:
  `The Hill.`, `Grand Ave.`, `The river road.`, `Clock Square.`. He pays only
  when the cab stops **within 28 m of one unmarked point** (O1's start-car
  spot for that name, `plan.js` STARTS). The Hill is a 1200 x 300 m district;
  the point is somewhere on Bridge St. The map (M) shows only me and my car:
  no mark for the fare. Nothing tells me I am getting warmer or colder, and
  nobody says "Here." A lost driver also never loses: while the cab moves the
  idle clock runs down at twice its speed, so the fare rides for ever. That is
  neither a win nor a loss. The owner's fare bots drive the road graph's
  route to the exact point, which a player does not know.
- **Steps.** `/?mute=1&start=city&ckind=taxi`, E in, take the first hail,
  drive to the middle of the place the line names and stop: no pay. Open M:
  no mark.
- **Where.** `src/vehicles/fares.js:92` (`d < 28` of `F.dest`), `:79`
  (`F.best` is worked out and never used), `:87` (the idle clock falls while
  moving), `src/scenes/city.js:189` (the map's marks: me and my car only).
- **Fix.** Mark the drop-off: on the map (M) now and on O7's minimap later,
  and in the world (a lit kerb, a man waiting, the fare saying "Here." as you
  come close). Or pay anywhere on the named street or square. Add a "Wrong
  way." when the distance has grown for about 15 s.

### B2. blocker: the gang saloon's hijack wins itself if you sit still
- **What.** I took the gang's saloon (`E take it`), then sat in the seat with
  my hands off for 20 s. The two men drew (the raise, then rounds every second
  or so). Six rounds: one hit of 9 hp (three red hit marks on the frame),
  health mended back to 100 by 11 s, the men `gone`. The car was mine, with
  nothing pressed. The car's tin stops their rounds and the gunman gives up
  after six whatever I do. There is no idle proof of this contest in the
  owner's set (only `o2_gangster_good`).
- **Steps.** `tools/plays/critic/o2/gangster_idle.json` (bed
  `&start=city&held=1&again=1&come=saloon:gangster`; a walk to his door, E,
  then 20 s of nothing). Frame `02_gangster_idle_wins.jpg`.
- **Where.** `src/vehicles/answers.js:68-79` (`P.shots < 6`, then done and
  running).
- **Fix.** Idle must lose, with a warning first. They come to the glass (the
  side window is not tin), or one opens my door and hauls me out into the gun
  or the fist. A short `They're drawing.` comes before the first round. The
  fail is the hospital (O3/O7's `game.fail`) with a few words saying why.

### B3. blocker: the race course is a secret on the first race
- **What.** E at the corner, a black, and I am **on pole**: nobody ahead to
  follow. The only words are `Three laps.` and then `Lap 1 of 3. First.`.
  Nothing in the world says the loop turns right at Centre St, Foundry St and
  Water St: no flags, flares, barrels, men or chalk at the corners. Miss a turn
  and after 22 m `Back on the course.` comes up with no direction. 8 s later I
  am `Out of the race.`. The bots drive the path's own points, so the proofs
  never meet this. On top of that, a race is about 3 minutes (3 x 680 m): an
  idle player sits 184 s for his `Beaten.`.
- **Steps.** `tools/plays/o2_race_idle.json` and the grid frame
  `03_race_grid_no_course.jpg`. Then drive it yourself without knowing the
  loop.
- **Where.** `src/vehicles/race.js:155-161` (the grid: me in slot 0),
  `:198-209` (off 22 m, the bare warning).
- **Fix.** Put me at the back of the grid, so the field shows the way on the
  first lap. Mark each corner in the world (a man with a lamp, flares, a
  sawhorse with an arrow), lit and the same at every corner. Make the warning
  point the way (`Back on the course: right at Centre St.`). Think about two
  laps.

### B4. blocker (by the numbers, not by four played races): bad hands can never win the race
- **What.** The owner's `o2_race_bad` runs **one** race and checks only "never
  stuck". The bar is "bad gets through by the third or fourth try". On the
  final code bad hands finished at 1682 m of 2040 when the leader crossed:
  0.82 of the leader's distance. The lead's easing after losses is at most
  two steps of 0.05, which takes the leader's pace from 1.04 to 0.94 (0.90 of
  where it started). At bad's 0.82 he is still well behind on the third and
  fourth tries. Medium was beaten by 88 m on its first race (the owner's
  medium won its third). I did not play four bad races in a row; the owner
  should, and tune until bad wins by the fourth.
- **Where.** `src/vehicles/race.js:27` (paces, ease), `:172`.

### B5. blocker (seen in the code, not caught on a frame): cars go through people
- **What.** A car collides with statics, other cars, the parked bodies and
  the smashables (`Car.js:270-300`). No person is in any of those lists: the
  hailing fare, the flag man, the man pulled from his car, the gangsters (the
  base's Hoods). A man who moves himself (the fleeing civilian) is pushed out
  of the car's box by `colliders.resolve`, so he **slides** aside rather than
  being hit. In my run-at-him play he slid to 1.74 m off the car's centre,
  beside the door, and then vanished (see m4). A man standing still (the
  fare on the pavement, the flag man) is driven straight through. User ask 3
  says "cars never through people". O3's walkers will make this common.
- **Steps.** In a taxi, mount the kerb at the man hailing; or drive at the
  race's flag man on Water St.
- **Where.** `src/vehicles/Car.js:270-300`, `src/vehicles/hijack.js:198-203`.
- **Fix.** The figures near a car go into the car's contact list. A man hit
  goes down (O3's or O4's knock-down), the car takes a bump and the crime is
  emitted (a death or a hurt man).

### B6. blocker when main is merged in: no third-person view in the car
- `docs/briefs/O2_WHEELS.md` on `main` (01f97ff, after this branch was cut)
  has a **must**: V in a car (the pad's R3) switches between the seat and a
  spring-follow camera behind the car. On the branch, V does nothing. The
  owner must take it when he merges main.

### M1. major: the owner's own bench fails on the final code
- `tools/plays/o2_bench.json`, run once by me on the final code: **FAIL**.
  S backed me only **0.73 m** off the saloon and **0.86 m** off the lorry in
  1.6 s (the report says 4.0 - 4.2 m off every one), and 2.25 m off the taxi.
  The crash count did not go up for the hearse, the van or the lorry. The run
  ended on `touchT` (something else touched), so those three may never have
  been hit. Overlap stayed at 0 throughout. Reverse that crawls off a heavy
  car is the "collision that sticks" the user ruled out. Re-run, find out
  what stops the run-up short, and make S pull clear of a saloon or a lorry
  at once.

### M2. major: after a crash the car turns on the spot by itself
- **What.** From BEGIN, W held with no steer: the coupe hit the parked car 20 m
  ahead at 14.7 m/s (damage 1.4). Then, with W still held, it **turned 90
  degrees on the spot in 1.4 s** (yaw 1.58 to 0.06, position moving under
  0.3 m) to face the shop front. It reads as a car sliding round on its own.
  The side it turns to is random, so it can turn you into a wall.
- **Steps.** `tools/plays/critic/o2/drive2.json` (the trace is in its eval
  lines). Frame `01_pivot_after_start_crash.jpg`.
- **Where.** `src/vehicles/Car.js:502` (`unstick`: 1.2 rad/s, its direction
  picked at random when there is no steer).
- **Fix.** Without steer, back off a little (as the comment says) and turn
  only toward the open side. Never a full pirouette on the spot.

### M3. major: the first W of the game crashes
- BEGIN puts me by a coupe parked at the kerb on Grand Ave, with another car
  parked **20 m ahead in its line**. A first-timer's first W (the card says
  `W drive`) runs into it at about 50 km/h within 3 s. A headlamp goes, then
  M2's spin. Clear the kerb ahead of the start's car for 40 m, or set the car
  in the lane.

### M4. major: a moving car to take is a long wait
- On foot in Grand Ave's lane at BEGIN (the city's main avenue), **42 s**
  passed before a car came up my lane. It stopped 3.9 m short (good), and
  `E take it` worked from the natural traffic (good). But 40 s of standing in
  the road is the first hijack a player tries. More traffic on the avenues
  near the player, or spawns biased into the street he stands in, would fix
  it (`Traffic.js:23` MAX 14; spawns at 105 - 200 m).

### m1. minor: the race's field and flag man answer nothing on foot
- `E race them` shows only in a car within 26 m (`race.js:123`). On foot, E
  at the man with the flag or a racer does nothing (seen in the code; my
  on-foot play at the corner started in the car and missed it). Give him a
  line: "Bring a car."
- **Where.** `src/vehicles/race.js:123`.

### m2. minor: the cop pulled from a police car is a trucker
- `hijack.js:30` (`cop: ['tail_trucker']`). The owner names it in his Left
  list. A player who takes a police car sees a coat, not a uniform.

### m3. minor: the man shoved out vanishes beside you
- A civilian is dropped once he has been out of the forward view for 3 s
  (`hijack.js:202`), and "out of view" includes standing 1.7 m off my door. In
  my play he vanished at 4.7 s with the car still beside him. Drop him only
  when he is out of sight **and** far away.

### m4. minor: the race decides a tie for me
- `race.js:211-213`: my finish is checked before the field's in the same
  frame. Harmless, but it is a thumb on the scale.

---------------------------------------------------------------------------
## 2. Cheats (code that wins for the player, or loses without a tell)
- `src/vehicles/answers.js:68-79`: the gunman fires six rounds and leaves
  whatever I do. Sitting in the car wins (B2).
- `src/vehicles/race.js:27, :172`: the field's lead eases 0.05 for each race
  lost in a row (up to 0.10), and nothing on screen says so: a hidden rubber
  band. The owner calls it "a tuning rule, not shown". It does not hand bad
  hands the win (B4); it only makes the third race silently easier.
- `src/vehicles/race.js:211-213`: a tie goes to me (m4).
- `src/vehicles/fares.js:87`: the fare's idle clock falls while the cab moves,
  so a lost fare never ends (no loss, and no win either: B1).

---------------------------------------------------------------------------
## 3. The user's asks, as played
1. **"You should be able to drive around."** Met. E at BEGIN's coupe, the
   seat eased, one card (`W drive S brake SPACE handbrake`); the avenue, the
   Yards, the river road. The quay rail stops the car and it slides along
   (`05_river_rail_good.jpg`).
2. **"Hijack cars and various cars."** Met, with M4. A parked saloon broken
   into in 2.0 s (the pad play); a coupe stopped for me in natural traffic
   and I took the taxi behind it (`E take it`, the civilian ran, the crime
   logged as seen); the gang saloon; a van at the Yards. Kinds and greys
   vary.
3. **"Everything works."** Not met. Cars against cars are clean: three
   full-throttle rams, overlap 0, the other car shoved (3 to 7.9 m/s) and its
   damage shown (2.31), S backing 5.7 - 5.8 m. But people are not in the
   cars' world (B5), the owner's bench fails on reverse (M1), and the car
   spins on the spot after a crash (M2).
4. **Car.js feel.** Mostly met. Trusted key to the first frame of the act:
   E 6.8 ms, W 5.2, A 9.0, SPACE 16.2, Q 15.6 (all under 50). The handbrake
   bites; the horn sounds on Q (by the event; the runs are muted, so I could
   not judge the engine's note). "Reverse always gets me out" is not proven
   (M1), and the unstick pivot is random (M2).

---------------------------------------------------------------------------
## 4. Good, and must not be broken by the fixes
- Input on the press: E, W, A, SPACE, Q all well under 50 ms.
- Getting in from BEGIN: no prompt clutter, one card with the keys drawn
  (`04_seat_card_good.jpg`), `E get out` only when stopped.
- Traffic stops for a man standing in its lane (3.9 m short) and goes round
  him later; `E take it` at the driver's door; a civilian runs; the hijack
  is seen.
- Car against car: no overlap at full throttle; the other car is shoved and
  shows its damage; my car wrecks (damage 4.5) and the controls stay mine.
- The river road's rail: where you cannot drive, you see why.
- The pad play passes on the pad alone (0 key or mouse events).
- `#errlog` was empty in every play I ran (cold, drive, stand in the road,
  run-over, gangster, ram, latency, bench, pad, river, race idle, bad and
  medium).
- Race idle loses (`Beaten.`, fourth); the fighter's hijack warns
  (`He's coming back.`) before he has me out (owner's proof, consistent with
  the code).

---------------------------------------------------------------------------
## 5. What a player would feel in the owner's Left list (`O2.md` section 5)
- "Three laps are 2.5 - 3 minutes, long for a first race": felt, and worse
  with the unmarked course (B3).
- "The fares' places are not on a map (O7)": this is not O7's polish. It is
  B1, and the fare cannot be won knowingly without it.
- "No hands in the hijack": the tween reads, but no hands is felt in first
  person. Major once O4's hands exist.
- "The traffic never parks or pulls out": felt as a city on rails, minor
  today.
- "A traffic car's man is the cast's stand-in when it is a cop": m2.
- "The frame's hitches ... not shown clean": not measured by me (no fps run:
  the time box went to the contests).
- Not in the Left list, and should be: B2 (gangster idle), B5 (people), M1
  (bench failing now), M2 (the pivot), M3 (the start's parked car), M4 (the
  wait), B6 (the third-person must from main).

Plays: `tools/plays/critic/o2/` (`cold`, `drive1`, `drive2`, `standroad`,
`runover`, `runman`, `gangster_idle`, `ram`, `river`, `flag`;
the driver `cold.mjs`).
