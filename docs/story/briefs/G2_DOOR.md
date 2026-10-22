# G2 — III The Door: Room 304 as a walk, the gunfight bigger and smoother, and the gun kit's feel

Branch `game-two/G2-door`, port 5362. Chapter III of game two is wave C's
IV (`src/scenes/05_gunfight.js`, the Harbor Building `src/stages/office/`,
lane C5's report `docs/story/reports/wave-c/C5.md` and its `Left`; the
ammo of lane C13, `C13.md` Left 1 and 3) with the office's walk folded
into its start (`src/scenes/04_office.js` is parked: `order.js` no longer
lists it; its stage, its corridor, Ames at his desk and the safe are
yours to reuse). The gun kit (`docs/story/seams/GUNS.md`, `src/guns/`,
`src/enemies/`, `src/player/modes/gun.js`, `src/player/weapons/`) is
shared by III, VII and VIII: **this lane owns its feel**, and lanes G5
and G6 build on what you merge. The user's words:

- **[must]** "really focus on the shooting sections": "smoother", "more
  fun", "easy to grasp as somebody who's just playing it", "interactions
  with the environment actually working, less glitches".
- **[must]** "instead of puzzles": Room 304's puzzle is out of game two
  (parked, not deleted).
- Still binding from wave C: the door closes behind me; the shadow on the
  glass and the choice (the desk, or shoot through the glass, or they
  burst in); men who really try to kill me, from more than one way;
  nobody clips; dying men slump where they are; it ends at the window
  with the watcher; the pocket is counted.

## 1. Room 304, forty seconds, no puzzle
The chapter card `III THE DOOR`, then the corridor as the office had it
(lit to 304, the other doors locked and rattling), the door ajar, the
room: Ames dead at his desk, the safe **open** (its door swung, the lamp
on it), in it the check (E: the two stills of the check, `DOT'S HAND.` /
`SHE SENT HIM TO THEM.`, `flags.note = 'PIER 9'`, the check carried). The
objective line `Find what Ames knew.` then `Get out.` A curious player
gets honest answers (the phone clicks, the drawers are locked, the
window shows the street, the lamp switches). As I go for the door with
the check: the door closes (as C5 has it) and the shadow comes. Beats:
`corridor`, `room`, `shadows`, `flank`, `corridor2` (name them as you
like; the old `shadows` onward keep their checkpoints). A player who
dawdles in the room is not punished; the shadow waits on the check.

## 2. The gunfight, smoother (the gun kit's feel: GAME_TWO §1 A)
1. **Latency**: LMB to the muzzle flash and the round, RMB to the steady,
   C to the crouch (the eye drops at once, eased 0.12 s), R to the first
   frame of the reload: under 50 ms each, measured and in the report.
2. **The shot reads**: a kick of the frame and the viewmodel, the flash
   (one ink flare, no glow), the sound, the case; on a hit, the man's
   flinch or stagger at once (his body answers the round where it
   struck: a shoulder, a leg that gives), the slump where he stands; on
   a miss, the round's mark where it went (plaster, wood chewed, glass
   broken). A hit mark at the frame's edge for theirs.
3. **Cover feels like cover**: crouched behind the desk the eye is low and
   the desk's edge is in the frame; RMB rises to aim over it in 0.15 s;
   rounds that hit the desk sound and chew it (thin wood spent). Standing
   in the open is death in a few seconds (the stander's win is C5's Left
   1: make it a loss in play, every time, with the tell first).
4. **The reload**: I keep moving; it fills only the empty chambers (C13);
   it can be cut short by firing what is in. `Empty.` once when dry.
5. **Bodies**: dead men never block my feet or theirs (lane C2b's rule:
   check it holds in this room and the corridor). Nobody clips a frame,
   a desk, a door. Doors stop on bodies.
6. **Men**: the half-second tell before they fire, every time; they use
   cover and come from two ways; no spin, no whip (C2b's `turnSafe` on
   every man here). Their lines short.

## 3. The middle (GAME_TWO §1 B)
`gunfight_medium` through in one to three tries at each of the door, the
flank and the corridor; `gunfight_good` twice; `gunfight_bad` by the
fourth try; `gunfight_idle` dies, warned. Cards: `[LMB] fire` and `[C]
get low` in the safe second (as now), `[RMB] steady` at the first time I
am behind the desk, `[R] reload` at the first empty cylinder; the nudge:
a player standing in the open for 4 s under fire gets `[C] get low`
again, once; a dry player who has not reloaded in 3 s gets `[R] reload`
again. The box of rounds on the secretary's desk (C13 Left 3) is lit and
its E prompt comes from further; the fail's black names the fix (`Get
low.`, `They came round. Watch the door.`, `Reload.`).

## 4. Bigger
A second way into the suite that is seen (the fire-stairs door at the
corridor's end: a man comes through it in the flank; its glass shows his
shadow first); the suite's third room used (a man at its door as well as
305's); the corridor fight with the cart and the lift as cover both ways.
The count of men: five to seven across the three contests, not a crowd.
Destruction a player sees: the glass of the door and the partition, the
plaster, the lamp shot out (its pool goes), the desk's wood, a chair.
The ammo row for III: the cylinder plus 18, the box on the desk +6
(keep C13's rule that the good hand reaches the window with rounds
left; the medium hand too).

## 5. Proofs and gate
The four proofs for each contest; `c13_iv_flow` (now from the corridor
walk) once; the latency numbers; the interaction walk of the suite
(every door, drawer, phone, lamp, window, the lift: the answer each
gives); the jank walk with men coming through every door; golden (the
office's frames stand: the scene file is parked, `?scene=office` still
draws; the gunfight's own frames identical or named); errors on every
beat; fps at the flank. GUNS.md gets a "Feel" section with the numbers.
Report `docs/story/reports/game-two/G2.md`. Hours, not a day.
