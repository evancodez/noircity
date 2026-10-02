# C2 — the cold player's report (critic, 2026-10-02)

Branch `wave-c/C2-guns` at `79a685f` (the owner's last commit), port 5342.
I did not build it. I played the test bed from the title (`?start=guns`,
`?start=guns.<beat>`, BEGIN clicked, `mute=1`) by real input only, with plays
and hands of my own (`tools/plays/critic/c2_*.json`, drivers in
`tools/plays/critic/c2/`), looked at the frames, then read the code, and only
then the owner's report. Frames: `docs/story/review/wave-c/C2/critic/`.

My hands (`c2/hands.mjs`) see only what a player sees: a man is a target only
in the view with nothing solid between; his gun coming up only when he is in
the view; a hit gives the bearing of the man who fired it, thrown +-25
degrees (the splash, the sound); the warning's words; cover spots I chose by
eye from the room. Three styles: **good** (C at once, RMB up, one or two
rounds, down; down when hit or when a man in view brings his gun up; R down
behind cover; hurt: down until it mends; turned at once on a flank's word;
reactions 300-550 ms, aim error 0.022 rad), **bad** (550-950 ms, error 0.045,
up for 3-5 rounds, ducks when hit half the time, reads half the warnings, a
wrong key now and then, and after each fall does the one thing its words
name a little better), **open** (never down, never risen: stands and trades).

## The three proofs, mine

| contest | (a) idle (hands off / W held) | (b) bad (clumsy) | (c) good, run 1 / run 2 | open (stand and trade) |
| --- | --- | --- | --- | --- |
| door | lost 9.8 s / 9.9 s, "Get down!" 1.7-1.9 s before, "Shot standing in the open." | won try 1 | won try 1 / try 1 | **won**, 3 sessions of 3 (tries 2, 1, 1) |
| two_ways | lost 9.7 / 9.9 s, same | fell 2 ("Up over the cover too long.", "They had your angle."), won try 3 | won / won | lost 3/3, every session |
| pin | lost 10.6 / 10.7 s, "Get down!" | won try 1 | won / won | **won**, 6 sessions of 6 (tries 1, 2, 1, 3, 2, 2) |
| rush | lost 7.9 / 8.3 s, "Stop him!" ~2 s before, "He walked right up to you." | won try 1 (60.6 s) | won (19.1 s) / won (56.7 s) | lost 3/3, every session |
| street | lost 17.9 / 18.3 s, "One's going round on your right." then "Behind you!" 7 s before, "Flanked." | fell 1, won try 2 | won / won | lost 3/3 (see the note) |
| street_rev | lost 17.9 / 18.3 s, same | fell 2 ("Up over the cover too long.", "Flanked."), won try 3 | won / won | lost 3/3 (see the note) |

Idle loses everything, warned, with its reason, back in about three seconds.
Good wins everything on the first try, twice in a row (0-13 hits taken).
Bad is never stuck and gets through in at most three tries. So no contest
wins itself and none is unwinnable. What fails is the strategy: standing up
and trading wins two of the six (finding 1).

(Note on the street's open result: my open hands aim at a man's chest, and
from behind the near car the car's roof hides every chest across the street,
so they died in ~8 s without firing. That shows standing there loses to a
player who cannot see a target, nothing more: the street's stand-and-trade is
not proven either way by me. The first beat of my early sessions also began
with the view tipped up by the harness - its first mouse move after the
click on BEGIN - which only made the good and bad results harder; fixed in
`hands.mjs` for `c2_open3`.)

## Findings, most felt first

### 1. BLOCKER (ask 3) - the pin and the door are won standing up
**Steps:** `?start=guns.pin`, BEGIN, never press C. Stand behind the bar
counter, aim at the glazed door B2. The Tommy gunner walks into its lit frame
and stands there bringing the gun up (frame `01`); three revolver rounds
(120 hp / 55) before his burst and he is down; then the pistol man from B1.
My open hands won the pin in 6 sessions of 6, within 3 tries each (tries to
win 1, 2, 1, 3, 2, 2; one win without a hit taken), and the door in 3 of 3
(tries 2, 1, 1). Standing loses two_ways and rush every time, so the rule
exists; it does not hold in these two. The pin's own line, "Down through the
burst. Up when he reloads.", is never needed: the burst can be prevented
from standing. The user's words for the old street: "I just stand and shoot,
and it is neither hard nor fun."
**Why, as far as I can read it:** the entry's `frame` phase
(`src/enemies/brains/gunman.js`, `case 'entry'`, `E.ph === 'frame'`) stands
the man in the doorway while he raises (0.26 s) and settles (0.4-0.9 s, x0.6
on a still standing mark), lit from behind - a clean, framed, still target
for 0.6-1 s; and every hit on a pistol man knocks him off his aim and back to
cover (`onHit`, `S.state = 'back'`), so two rounds into each doorway man win
the door. The owner calls the door's win "holding the doorway: the beat's
lesson" (C2.md Left 2); if the desk is to matter in IV The Door, standing
behind it has to lose there too.
**Fix (the owner's call):** the Tommy gunner must not enter through a frame
he stands still in (work B2 from beside its jamb as the pistol men do, or
rake through the frosted glass first, so the first thing the player meets
is the burst); a standing player in the pin and the door should be under two
guns at once and eat a burst before he can drop the gunner. Prove it with
`tools/plays/critic/c2_open3.json` (stand and trade) and `c2_pin_stand.json` (the open style; run each beat three times).

### 2. MAJOR - doors that open toward me jam against me; up against a door, E does nothing
**Steps (frames `02`, `03`):** `?start=guns`, BEGIN. Walk to about a metre
in front of door A1 (room A's side), look at it: "E open". Press E: the leaf
swings into the room toward me and stops at about 30 % against my body
(`src/stages/killhouse/door.js`, `blocked()`), the prompt turns to "E shut",
the gap past the leaf is ~0.2 m so I cannot get through, and E now shuts it.
I have to back off to ~1.4 m from the hinge and press E twice. A1 (from room
A), A2 (from room A), B2 (from the bar) and BD (from the corridor) all open
toward the player who opens them. Second, walk up to a shut door until it
stops you (what people do) and press E: no prompt and nothing happens,
level or looking 20 degrees down - the use point is the door's middle 1.1 m
up with a 0.7 rad cone and a 1.5 m range (`91_guns.js` door interacts), so
from 0.4 m it is 56 degrees below the view. Probes:
`tools/plays/critic/c2_door_swing.json`, `c2_door_e.json`.
GUNS.md tells lanes C5, C7 and C8 to build their doors as `door.js`; IV The
Door's "the door closes behind me" will meet this first.
**Fix:** a player's E opens a door away from him (or, one-way, he is stepped
back out of the sweep first, as the men are); the use point/cone so that a
man standing against a door, looking at it, gets the prompt.

### 3. MAJOR (ask 2) - the street opens with a false "They have your angle. Move!"
**Steps (frame `05`):** win the rush and let the street fade in (or start
`guns.street`: the same line is up, hidden under the chapter card). Over the
fade-in: "CLEAR." still at the top, and "They have your angle. Move!" - while
nobody fires: the first raise comes ~5 s later and, hands off, the first
round into me at 12.6 s, from the flanker. A first-timer obeys and leaves the
car the line has just told him is cover. (The retry after a fall does not
show it.) `c2_street_probe.json` logs two pistol men with a line on my
crouched head in the first frames, gone a second later.
**Cause (my reading):** men placed with `cover: true` stand at full height
for the first frames before they kneel (`S.low`), so `K.warning()`'s
`down && hasLine` gives 'angle', and the warning is held a second.
**Fix:** no 'angle' line before a man with the line has raised, or for the
first second of a beat; place the street's men already kneeling.

### 4. MAJOR - the last man hides and nothing happens for 40 seconds (rush, and the door and pin at times)
**Steps (frame `04`):** `?start=guns.rush`. Kill the heavy at the street door
(five rounds from behind the reception counter; easy). The pistol man who
comes in through A2 at 7 s walks through the lobby, out of the street door
the heavy left open, and holds outside on the pavement (around -2.9, 7.9:
behind the hydrant and the wall between the window and the door). He raises
every ~5 s without a line on me; from the reception nobody is in sight; the
objective still says "Something big at the street door." My rush wins took
57, 61 and 57 s (19 s once). The same at the door beat's last man (15-17 s
beside A1's jamb with only his hand showing at its edge, in my first runs)
and the pin's pistol man by the crates (15 s). "Nobody waits out the clock"
(the `open` state's seek after 9 s without a line) never fires, because a man
in `hold` at a cover point peeks forever.
**Fix:** a man in `hold` long without a line pushes in or seeks too; no cover
point outside the room the beat is about (the pavement, for the rush); the
objective changes when the heavy is down ("One more. Find him.").

### 5. MAJOR - the ready beat: "[C] get low" where I stand does nothing
**Steps (frame `06`):** `?start=guns`, BEGIN, E: the desk goes over away from
me and the C card shows. Press C where you are: I am down, 1.4 m behind the
desk's back, but the objective stays "Tip the desk over. Get behind it.", no
rise card comes, RMB does not lift me over the desk (the rise plans only
1.3 m ahead, `gun.js GUN_MODE.look`) and my two rounds went into the desk.
Nothing says "closer". In my first play I sat there 30 s.
**Cause:** `91_guns.js` `behind()` wants the eye within 1.0 m of the desk's
back; the beat starts me 0.95 m from the desk's middle and the desk tips away
from me, so I start 1.4 m from its back.
**Fix:** start a step closer, or count 1.6 m as behind, or say "Closer." when
he is down too far back.

### 6. MINOR - stale lines
"Clear." stays up through the fade into the next beat (every run-through,
frame `05`); "Stay down. Let it mend." stays over the street's "CLEAR." as it
fades to black; "One's going round on your left/right." stays up while I kill
the man it is about (two_ways, door); after the heavy is down the rush's line
still names him.

### 7. MINOR - a hit from straight ahead splashes over the objective
A round from the doorway in front puts the edge splash in the top-left corner
over the objective line, unreadable (frame `07`). From ahead the edge is
decided by small offsets; the top-left corner is the objective's place.

### 8. MINOR - the tell is small
In slow time (`c2_tell.json`, `c2_tell2.json`, speed 0.25) the raise reads
as a pale hand coming up in front of a dark coat in the lit doorway (frame
`08`); in the bar the Tommy gunner's raise is a dark arm in a dark doorway
(frame `01`). I found no glint in any frame taken through its 0.12 s; the
cock and bolt I could not hear (muted). Raise to round: ~0.6 s standing.

### 9. MINOR - the desk's things are glued, then vanish
Tipping the desk (`c2_tip.json`, slow time): the blotter, the telephone and
the lamp ride the top at 45 degrees without sliding, and are hidden when it
lands (`house.js` `landed()`: `loose.visible = false`); the comment says they
slide off. The player mostly sees the glue, not the vanishing (the top faces
away).

### 10. MINOR (code read, not played) - the desk tipped from the door's side faces the wall
`91_guns.js` tips it away from the eye (`dir = Math.sign(DESK.x - G.eye.x)`):
from the door's side it goes over toward the west wall and "behind it" then
puts the door at my back. The contests reset it; the ready beat does not.

## The code, read for cheats

Nothing wins for the player: no rubber band, no timer that ends a contest (a
beat ends only when its last man is down), no automatic action, no aim fudge
standing in for cover (rounds are rays; a pistol round's throw is a constant
0.0055 rad: no miss streak). What I would name:
- `src/guns/Guns.js` line 467: their rounds into each other hurt 2.2 times
  what they would do to me (`dmg * 2.2 * res.k`: 37 a pistol round). A man
  can kill his mate for the player, unseen as a cause. Not seen in play
  (`c2_ff.json`: 3 x 25 s, no such hit), but nothing written down says why.
- `src/game/Game.js` line 564 (lane C1's, written in Z.md): a killing hit
  leaves 1 hp unless the warning has been up a second. A written mercy; it
  does not win.
- `src/enemies/brains/gunman.js` `GUNMAN.behind` (0.45 s more for a man who
  has me from off my screen): a written fairness delay, with "Behind you!".
- `gunman.js` `onHit`: every hit on a pistol man knocks him off his aim and
  back to cover. Fair as "a hit reads", but it is half of finding 1.
- Loses without a tell: the Tommy gunner's suppress (no line, rakes where I
  went down, through frosted glass, a door or wood) has no visible raise
  when he is behind the glass; the bolt's sound is the tell. The reason is
  said after ("The Tommy gun chewed through." / "Your cover was shot away.").

## The user's asks, as I saw them in play

1. **Enemies who really try to kill me: met.** Standing still in the open: down 3.5 s after the first round in the door and two_ways, in 2 s once the heavy reaches me, 8 s standing in the street; every contest lost hands off.
2. **Fair: not met.** The raise is there (small, finding 8), the splash marks the side, "Behind you!" and the flank's side are said in time; but the street opens telling me to leave good cover while nobody is shooting (finding 3).
3. **Strategy, standing loses: not met.** Standing up wins the pin and the door (finding 1); it loses two_ways and rush. Cover is physical (rounds from too far back go into the desk; "Your cover won't hold" when it is shot through).
4. **Not one door, cover, a flank with a warning: met.** two_ways A1 + A2; pin B2 + B1; rush SD + A2; street three places and the loading bay; men work jambs, cars, the hydrant; "One's going round on your right." then "Behind you!".
5. **Nobody clips: met as far as I saw.** Into the desk, crates, armchair, steel cabinet, the car: stopped, slid along. Men beside a jamb show a hand at its edge (ambiguous at that size, not through). The doors jam instead (finding 2).
6. **Dying men slump where they are: met.** Nine falls filmed in slow time (`c2_deaths.json`): every body stayed exactly where it fell (0.00 m over 1.4 s), on free floor; none through the desk or a car.
7. **Men come in naturally: met.** Doors open, men framed in them, the heavy through the street door, a flanker round the car's end, the fourth out of the loading bay. The street's first three are there when it opens (owner's Left 5), not appearing mid-play.
8. **Taught, not cold: met, with finding 5.** C after the tip, RMB (a mouse cap) once behind the desk, R after the bottles, C again after two falls; a cold contest teaches C and RMB.
9. **Premium, not janky: met for the shooting.** Rise and drop are quick, hits show on the man (blood, the flinch back), golden 32 of 32 identical (train_t6 differed once when a second Chrome of mine ran beside the check; alone, identical). The jank is the doors (finding 2).

## The owner's Left list, as a player would feel it

1. Not played by a person - still true; this report is plays and frames.
   The tell at a distance in the dark: small (finding 8).
2. `guns_bad` at the edge - **felt**: the pin and the door are won standing
   (finding 1). It is not noise: 9 sessions of 9.
3. Noisy proofs - not felt.
4. 69-77 % landing - not felt.
5. The street's men there at the start - barely felt; but their first frames
   standing make the false warning (finding 3).
6. A leaf through a body - not felt (no door shuts in a contest). The leaf
   against the living player is (finding 2).
7. Both-ways doors untested - and the one-way doors jam (finding 2).
8. Looks - the frosted glass reads; fine for a test bed.
9. `game.bodies` unused - not felt.
Not in the list and felt: findings 2, 3, 4, 5, 6.

## What is good and must not be broken

- Hands off, every contest is lost in 8-18 s, warned ("Get down!", "Stop
  him!", "One's going round on your right.", "Behind you!"), the reason on the
  black ("Shot standing in the open.", "He walked right up to you.",
  "Flanked.", "Reloading in the open.", "Up over the cover too long."), back
  at the beat's start in about three seconds.
- Good play wins every contest on the first try, twice; clumsy play falls
  some and always gets through; nothing gets stuck.
- The ready beat's three cards, each at its moment, with the key drawn.
- The rise over cover (fast, the gun honest) and the drop.
- Doorways framing the men as shapes against the lit corridor; the heavy
  reading as the heavy; the street with its towers.
- The flank: a man going round, the side named, then "Behind you!", the
  splash on that edge.
- The falls: in place, fitted to the floor.
- The golden frames and a clean `#errlog` in every one of my plays.

## Plays (all `tools/plays/critic/`)

`c2_idle_all` / `c2_idle_w` (a: hands off, W held), `c2_good` (c, run it
twice; `deathShots`), `c2_bad` (b), `c2_open`, `c2_open2`, `c2_open3` (stand
and trade), `c2_pin_stand`, `c2_ready` / `c2_ready2` (the first-timer's ready
beat), `c2_tell` / `c2_tell2` (slow time), `c2_deaths` (slow-time falls),
`c2_street_probe`, `c2_street_retry`, `c2_ff` (their rounds into each other),
`c2_door_e`, `c2_door_swing`, `c2_door_probe`, `c2_tip`, `c2_rush_dbg`,
`c2_walk` / `c2_walk2` (the walk: their door steps are broken by my own
early `face` bug and the door jam - use `c2_door_swing` and `c2_door_e`).
Run: `NOIR_PORT=5342 node tools/play.mjs tools/plays/critic/<play>.json`.
