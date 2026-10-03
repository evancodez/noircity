# C2b: the cold player's verdict (critic)

Code played: `85a5d77` (branch `wave-c/C2b-guns`), dev server on 5342, every
run muted, by real input through `tools/play.mjs`. My plays are in
`tools/plays/critic/c2b2/`. Frames are in `docs/story/review/wave-c/C2b/critic/`.

**Verdict.** Ask 1 (the dead block nobody) is met in play. Ask 3 (the balance
is unchanged, golden identical) is met. **Ask 2 (no man spins) is not met.**
The owner's own `guns_spin` play fails on this code. Four of my six plays saw
a living man sweep 300 to 385 degrees one way in 2.5 s. Even when he does not
go all the way round, the man at a doorway jamb whips his whole body about
115 degrees one way, 170 the other and 80 back every four seconds. That is
the "body / full 360s" the user complained about. A door also shuts through
a body lying in its doorway.

(Process note: before step 6 I saw a few gate rows of the older `C2.md`
while I was looking for the plays' checks. I read `C2b.md` only after the
proofs.)

---------------------------------------------------------------------------
## Findings, most felt first

### 1. BLOCKER: men still turn full circles, and they whip round at every step out (ask 2)

**What a player sees.** The pistol man at a doorway jamb steps out, steps
back and holds, again and again. Each time he swings his body round: about
115 degrees out, about 170 degrees back the other way, about 80 degrees to
face the room again, all inside 2.5 s, every ~4 s. Sometimes the three turns
all go the same way, and then he turns right round once. Frame `03`
(observer camera, render only) shows one cycle with his yaw on each panel.

**The counter, on the final code** (the kit's own `K.spin`; `turn` is the
widest one-way sweep in 2.5 s; the owner's limit is 330; a `spin` event is
a sweep over 300):

| Play (all by real input) | worst `turn` | `spin` events |
| --- | --- | --- |
| `tools/plays/guns_spin.json` (the owner's proof, clumsy) | **345** (pistol, `hold`, door beat, at -0.72, -3.69) | 1 (302) |
| `critic/c2b2/guns_idle_spin.json` (hands off) | **360** (pistol, `hold`) | 2: 301 (`back`, at -0.45, -4.81, two_ways), 300 (`move`, at 0.07, -0.68) |
| `critic/c2b2/guns_good_spin.json` run 1 | **339** (Tommy gunner, `move`, street) | 1: 305 at -11.58, 15.42 |
| `critic/c2b2/door_hand.json` (my hands, door beat) | **385** (the flanker, `aim`) | 1: 302 at -7.52, 1.93 |
| `critic/c2b2/guns_good_spin.json` run 2 | 278 | 0 |
| `critic/c2b2/guns_bad_spin.json` | 272 | 0 |

`guns_spin.json` ends with **FAIL: no man turns a full circle (330 degrees
in 2.5 s)**. It passed for the owner because the clumsy profile happened to
dodge it in that run; it is not a proof. `sec` (at most 272 in a second) and
`rev` (at most 232) stayed under their limits in every play.

**Why it happens.** `spin_trace.json` is deterministic: hands off, door then
two_ways. Twice it gave the same spin at G.time 43.08. The man at A1's
corridor jamb (-0.87, -4.74), yaw by state:
`hold -1.35` → `out` up to +0.65 (+2.0 rad) → `back` +0.46 → +3.90 → `hold`
on to +4.49 and still turning: **5.84 rad (335 degrees) one way in 1.8 s**.
Each leg is under the unwind threshold in `HoodAI.faceTo`
(`src/enemies/HoodAI.js`, the `if (err > 2.4)` branch, ~137 degrees). So
each leg takes its own short way, and here those short ways all point the
same way round. The unwind only catches one single big turn, not a chain of
mid-sized turns that add up to a circle. The owner's Left says "180 degrees
out and back now, never on round". Both halves are wrong in play: it does
go on round, and the 180-degree out-and-back whip is itself what a player
reads as a man spinning.

**What to fix (the owner decides how).**
- `out` and `back` are steps of under ~1.5 m from his jamb or cover. In
  them, keep the body facing the target (me, or the doorway he is working)
  and move him sideways or backwards. A walk clip played backwards, or legs
  that follow the path while the hips face the target, is enough: no turn at
  all. This removes the 115 / 170 / 80 whip, which is what the user
  actually saw.
- In `faceTo`, make the unwind rule read the sum. If his recent turning
  (`_turnAcc`) plus this turn would pass about pi, take the other way,
  whatever the size of this turn.
- Make the proof real. Run the counter on idle, bad, good and clumsy (my
  `critic/c2b2/guns_*_spin.json` copies do it: they are the owner's plays
  with three evals added), each once. No `spin` event and `turn` < 330 in
  every one.

### 2. MAJOR: a door shuts through a body lying in its doorway

**Steps.** `?start=guns.lab&lab=door&mute=1` (or any beat where a man dies
in A1: the door beat's three all come through it). Walk to A1, press E.
The leaf swings shut and the body's legs go through the closed door to the
other side (frame `01`; `critic/c2b2/door_body.json`, `open01` 1 → 0).

**Why.** `blocked()` in `src/stages/killhouse/door.js` (~line 169) tests
only living men and me. The owner's report says this on purpose ("the
doors' leaves stop only on the living"). The user's own words were the
opposite: "have enemies and the player not collide with dead enemies (**but
other things do**)". A door is one of those other things. The same goes for
a man pushing a door open onto a body behind it.

**Fix.** In `blocked(a)`, a body whose head-to-feet segment (`K.corpses`,
`ax az bx bz`) the leaf would cut stops the leaf, as a living man does: the
door stays ajar against him, with the door's knock.

### 3. MINOR: a man's pace flickers at the end of a short path

In the traces, during `out` and `back` his speed flips between 0.45 and
1.5 m/s every 0.1 to 0.2 s (e.g. `0.45 0.45 0.45 1.5 1.5 1.5 1.5 0.45`).
The new path-end slowdown in `HoodAI.go` switches `speed * 0.3` on and off
as `err` crosses 0.5. I saw it only in the trace, not as a visible pop in
the strips. Ease it (a lerp toward the wanted pace) instead of switching.
It may disappear anyway once finding 1's side-step is in.

### 4. MINOR: the step over a body exists only in the gun mode

`src/player/modes/gun.js` (~line 121) lifts the eye only in mode `gun` with
`K.active`. In the lab the player is in `walk` and passes through a body
dead flat (`critic/c2b2/wall_body.json`: `_overBody` 0 standing on his
legs). That does not matter in the test bed's beats, which are all `gun`.
Any chapter that leaves kit bodies on the floor while the player is in
another mode (a stealth pass, a walk after the fight) gets no step. Owner:
note it in GUNS.md, or read `K.overBody` in the walk mode too.

---------------------------------------------------------------------------
## The three proofs (mine, on `85a5d77`)

| Profile | Result |
| --- | --- |
| idle (`critic/c2b2/guns_idle_spin.json`) | **PASS**. All six lost, each warned 3.0 to 10.0 s before, each with its reason: door "Flanked.", two_ways "Flanked.", pin "Shot standing in the open.", rush "He walked right up to you.", street and street_rev "They had your angle." |
| bad (`critic/c2b2/guns_bad_spin.json`) | **PASS**. Lost 5 of 6 (won the rush at 32 hp), each by a fall with its reason, warned 2.2 to 13.9 s before. Never stuck. |
| clumsy (`guns_spin.json`) | Lost door ("Up over the cover too long.") and two_ways ("They had your angle.") once each, then won them on the second try. Won pin, rush, street and street_rev on the first. Never stuck. |
| good (`critic/c2b2/guns_good_spin.json` x2, `good_bodies.json` x1) | **PASS three runs in a row**: 6/6 on the first try each time (lowest health in a beat 32 to 100). |

Golden: `tools/golden.py check` gives **38/38 IDENTICAL**. The errlog was
clean at the end of every play.

## The user's asks

1. **Through the dead: MET in play.** In the rush, by my hands, I shot the
   heavy and then walked over him and back with W held. My line came within
   0.31 and 0.06 m of his length, with no stop and an eye step of 8 to 9 cm
   (with the walk's bob in it) and the cloth sound. Over a whole good run
   (`good_bodies.json`, six beats), living men were within 0.5 m of a body
   for 974 frames, 283 of them walking a path. Only 4 frames show a man
   slow by a body, and those are the first frames of a step out, not the
   body. Nobody went round a body, waited at one or got stuck on one.
   Bodies stay where they slumped: across the A1 threshold (frame `02`) and
   down the wall. (The door that shuts through one is finding 2.)
2. **No man spins: NOT MET.** See finding 1: a FAIL of the owner's own play,
   4 of 6 plays over the limit, and the 115 / 170 / 80 whip every ~4 s.
3. **Balance unchanged, golden identical: MET.** idle 6/6 lost, bad 5/6
   lost, good 6/6 first try three times, golden 38/38. This is in the band
   of the earlier C2 numbers.

## Cheats read

I read the C2b diff (`HoodAI.faceTo` / `go`, `Hood.js` look fade,
`gunman.js` aim turn 7 → 5.5 rad/s, `Guns.overBody` / `stepBodies` /
`stepSpin`, `gun.js`). **Nothing wins for the player.** The slower aiming
turn and the path-end slowdown make men a little slower to come onto a line.
The idle, bad and good results show that this did not move the balance.
Nothing loses without a tell: every fall I saw was warned and given a
reason.

## The owner's report and its Left (step 6), as a player would feel them

- "a man still turns his back for a step to his cover (180 degrees out and
  back now, never on round)": a player feels this, every four seconds, at
  every jamb. It is the thing the user asked to remove, and "never on
  round" is not true in play (finding 1).
- "`guns_spin` 5/5, worst 265 degrees": not reproducible. My run of the
  same play gave 345 and a `spin` event.
- "the doors' leaves stop only on the living": felt as finding 2.
- "the good / bad balance swings between runs": in my runs good won 3/3
  first-try and bad lost 5/6. I did not feel the swing.
- "the turn rule is opt-in (`h.turnSafe`)": the battle's men (chapter VIII)
  keep the old turning. The user will meet the same spins there. That is
  C8's lane, but the user's ask was not limited to the test bed.

## What is good and must not be broken

- Walking over bodies: no stop, a small step of the eye, a soft cloth sound.
  It reads as stepping over, not as a wall.
- The living walk through the dead on their line, at their pace, in every
  beat.
- Bodies stay where they fell (doorway, wall, cover). Rounds still stop in
  them.
- The balance: idle loses every beat with a warning and a reason, bad loses
  most, clumsy gets through on a second try, good wins first try. Golden
  identical.
- The turn counter `K.spin` and the `spin` event: they are good tools. They
  just have to be run on more than one profile.

## Frames

- `01_door_shut_through_the_body.jpg`: E on A1 with a body across the
  threshold. The leaf is shut and his legs are on the other side of it.
- `02_body_across_the_doorway.jpg`: the same body before that, resting
  across the threshold (good).
- `03_strip_out_back_hold_whip.jpg`: the jamb man's out / back / hold
  cycle, his yaw on each panel.
