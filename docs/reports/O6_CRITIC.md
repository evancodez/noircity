# O6 smash: the cold player's report (critic)

Played cold on `ow/O6-smash` at 55b3341, by real input (`tools/play.mjs`,
headless, muted, port 5376), before reading `docs/reports/O6.md`. The plays
are mine, in `tools/plays/critic/o6/` (a small driver, `poke.mjs`, with
modes `foot`, `seen`, `lamp2`, `ram`, `fire`, `firebeat`, `tram`, `lat`,
`selfburn`, plus `drive_kerb`, `city_kerb`, `city_lookback`, `burn_near`,
`hitch` and the four fire-beat proofs `fire_idle|bad|medium|good`). Frames:
`docs/review/O6/critic/` (four). The machine's GPU was 98 to 100 % busy
from other work during every run. Read the fps numbers as ratios only.

Where I started: `?start=smash` (the bed: Grand Ave under the el, a coupe
at the kerb, the Tommy gun) and `?start=city` (the coupe at the same kerb
in the real city). The title still says NOIR EXTREME (O7's, not this lane).

---------------------------------------------------------------------------
## Findings, most felt first

### 1. BLOCKER: the destruction often cannot be seen ("seen" is not met)
What: in the dark stretches of Grand Ave, which is most of the bed's
east pavement, what I break reads as nothing or as a grey lump. From the
cabin, my first kerb run put 13 things over (`drive_kerb.json`: over 9,
broken 4). Frame by frame, I could not point to one of them going over.
On foot, I shot the hydrant at (-110.45, 20.6) from 4 m: three hits
landed (`hydrant:shot`), and the frame shows its black silhouette against
a lit window with no water I can see, at 0.0, 0.5 and 2.0 s. The stall at
(-109.9, 17.6) went over at the seventh round, and the frame shows a dark
hump with a few white pixels. The `hundred` beat from where it puts me
(12 m off) looks like an empty road with a small fire
(`c3_the_hundred_from_12m_reads_empty.jpg`).
Steps: `node tools/play.mjs tools/plays/critic/o6/drive_kerb.json`, then
look at its frames 01 to 06. Also `seen.json` (the hydrant).
Files: `src/destruct/smashKinds.js` (the kinds' `mat`: `kerb`, `tree` and
`wood` are near-black in the ink), `src/destruct/Smash.js` (`geyser`,
`jet`, `goodsBurst`, `papers`, `chipsAt`).
Fix, as I'd want it played: every break needs a white stroke where it
happens. Draw the hydrant's fan and column in a white that holds against
black. Give the splinters, papers and goods a white edge. Make a stall's
canvas pale. The car's headlamps should catch what flies. A break needs
a white event or it did not happen (GAME_TWO §1 A.4: "a hit nobody can
see did not happen"). Your report lists this as left item 2. As a player I
rate it the most felt thing in the lane, not a polish item.
Frame: `c2_kerb_from_the_cabin_dark_on_dark.jpg`.

### 2. BLOCKER: the burning wreck kills me with the wrong advice and the wrong reason
What: in the `burn` beat I walked up to the burning sedan (2.7 m, fuse
2.3 s), pressed E (nothing happens, and that is right), and stood there.
The blast took me from 100 to 51. I kept standing, and the wreck's fire
took me to 28, then 6, then down, 6 s after the blast. During those 6 s
the line on screen was the gun kit's **"You're hit. Get to cover."**, which
is the wrong fix: cover does not help, and crouching behind the wreck is
what a player would try. The fail then said **"Too close when she went."**,
but the blast did not kill me. The fire did, six seconds later.
Steps: `node tools/play.mjs tools/plays/critic/o6/burn_near.json` (the
evals print hp, the warning and `lastFail`).
Files: `src/scenes/smash.js:214` and `:308` (the scene has no `lowWarn`, so
`src/game/Game.js:564` falls back to "Get to cover"),
`src/destruct/CarDamage.js:366` (the reason is always the blast's).
Fix: give the scene, and the city, a `lowWarn` that knows about fire:
near a burning car or wreck, `Too hot. Get back.`. The fail should name
what killed: `Burnt. Stay off the fire.` when it was the fire after the
blast. Also before the blast: on foot within ~4 m of a car that is
burning, the same `Get back.` line. Today nothing on foot warns me before
a blast that takes half my health at 2.5 m (and more, closer).
Frame: `c4_blast_at_2m5_then_the_wreck_kills.jpg`.

### 3. MAJOR: a shot-out lamp keeps its glowing head
What: one burst into the lamp head at (-110.3, 14) puts out its cone,
its light and its pool (`dark: true`, `dead: true`, `on: false`). The
head's white disc stays fully lit at 0.3, 1.2, 3.2 and 3.5 s (the
crosshair patch's maximum stays 255). A dead lamp that still shows a lit
bulb reads as "nothing happened" from any distance. Your report §1 says
"its glowing mouth in the far city go dark". In play it does not, at least
not for this lamp of the bed.
Steps: `node tools/play.mjs tools/plays/critic/o6/lamp2.json`.
Files: `src/destruct/Smash.js:255` (`bulbLevel`, the `color` slots),
`src/stages/noircity/parts/far.js:92` (the mouths' ranges). Either the
lamp's slot is not found, or another glow (the pipeline's lamp sheen or
halo, which reads `stage.lamps`) still draws it.
Frame: `c1_lamp_shot_out_head_still_lit.jpg` (before and after).

### 4. MAJOR: a car shrugs off iron at speed
What: in the city (`?start=city`, E, W and a touch right onto Grand
Ave's east kerb), the coupe took two lamp posts, a stop sign and a
hydrant, and its speed went 42 to 46 to 61 km/h. It was never slower
after a post than before it, and it had only 1.05 damage (not even
steam). In the bed, the car went 22, 26, 30, 41 km/h through a newsstand,
a hydrant, a stall, crates, a call box, a bin and a bench. The thing
flies, but the car does not feel it: no felt drop, no camera jolt I could
see in the frames. "Destruction is physical (it stops ... a car)." Below
the give speed, a post stops the car (right). Above it, a fifth of the
speed is lost and the throttle has it back within a second.
Steps: `city_kerb.json`, `drive_kerb.json` (the speed is printed after
each segment).
Files: `src/destruct/smashKinds.js` (`drag`: lamp 0.8, stall 0.7,
hydrant 0.88), `Smash.collide` / `carHit` (`Smash.js:477`, `:972`).
Fix: a lamp post at 40 km/h should cost half the speed and a visible
jolt, and a stall a third. The second lamp in a row should hurt the car
enough that the player notices steam. It is fun to knock things over. It
should still be a choice that costs something.

### 5. MAJOR: the blast is a hitch
What: in the `hundred` beat, the rAF frame deltas around the sedan's
blast were 16.7, 33.3, 33.4, 16.6, 33.4, **99.9**, 33.4, 16.7 ms. The
worst frame of the second before was 50 ms. On the loaded GPU, the
blast's own frame is two to three frames long. Your report's 72 ms worst
step is the same thing. A player feels it as a stutter at every car blast,
and car blasts are the climax of a chase. "It never costs the frame
rate." The average holds (below), but the moment that matters stutters.
Steps: `node tools/play.mjs tools/plays/critic/o6/hitch.json` (prints
`around`: the deltas each side of the wreck's first frame).
Files: `CarDamage.blast` (`CarDamage.js:347` onward: `sm.blast(at, 7, 1)`,
`fx.explosions.blast`, `toWreck`, the wreck's build in the blast frame).
Fix: build the wreck shell ahead of time (when the car starts to burn,
not in the blast frame), and spread the blast's push and its pieces over
more frames.

### 6. MAJOR: the bed's tram carries a man 175 m unhurt
What: I stood on the west rails at (-121.9, 20) and did nothing. The tram
came, rang its bell, met me, and pushed me ahead of its nose from z 20
to z -156 at 30 km/h for 20 s, through the whole bed. I took no hit and
no fall, and hp stayed at 100. Then it ran out of the bed and left me
there. That is a pass-through of a kind: the tram is a moving wall that
does not hurt.
Steps: `node tools/play.mjs tools/plays/critic/o6/tram_foot.json`.
File: `src/scenes/smash.js:163` (the tram's `drive`: it sweeps
`smash.collide` but a man is only pushed).
Fix: a man in its way is knocked aside and down (a hurt, a fall to one
side, the bell's warning first when it is within 15 m and I stand on its
rails). This is bed-only today, but O2's tram will inherit the rule.

### 7. MAJOR (outside this lane: O1's roam / O2's car): the empty coupe drives itself backwards
What: in the city, I braked with S for 1.8 s, let go (the car was at -3
km/h), and pressed E to get out. The empty coupe kept reversing and
picked up speed to -14 / -15 km/h: from z -0.4 to z 36.7 in about 8 s,
with nobody in it, down Grand Ave. Seen once (`city_lookback.json`, evals
2 to 4).
Files: `src/scenes/city.js` (the roam's E out), `src/vehicles/Car.js` (a
car with no driver should brake to a stop).

### 8. MAJOR (from your left list, not replayed by me): the city's shop glass and awnings are not things
Your left item 1. A player in the city who shoots a shop window, the
first thing anyone shoots in a noir street, gets nothing. In the bed, the
glass is the best-reading thing in the set (one burst holes it, the hole
reads on the lit pane, walking into it stops me at the facade). Bring the
bed's glass to the city's lit shop fronts before anything else from that
list.

### 9. MINOR
- Walking into a standing bin, call box or newsstand: I stop 0.66 to
  1.0 m from it, but nothing gives (no nudge, no sound). A bin at a
  walking push could rock or clang (`Smash.hit(..., 'body')` exists and
  nothing calls it).
- The bed's sedan cannot be entered and shows no E prompt
  (`smash.js:355`, `c === R.cars[2]`). A player who walks to the one
  car across the road gets no answer. Give it a locked rattle, or let him
  in.
- Seen once in `ram.json` (the first run, before I logged warnings): the
  coupe was back whole at its kerb and I was on foot at (-128.4, 17.1),
  with no fail line I captured. That was after my car sat steaming on the
  rails at (-121.3, 10.8) as the tram came. I did not reproduce it (my
  later tries missed the rails). Check what a tram does to a car with a
  man in it on the rails.
- The press-to-answer latency is fine: a round's thing answers in the
  first frame after the press (`lat.json`: 1 frame each for the bin, the
  bench and the call box; the wall-clock 16 to 104 ms is the loaded
  machine's frame time, not the set).

---------------------------------------------------------------------------
## The contests: my four proofs

The lane has one loss, the fire beat (`?start=smash.fire`: my coupe
burning at the kerb). The burning car on foot (`burn`) is the other way
to lose.

| | Hands | What happened |
| --- | --- | --- |
| idle | E in, sit | `She's burning. Get out.` the moment I am in it (t 4.9). The fail at t 9.8 after 4.93 s warned: `She went up with you in her.` Fair. |
| bad | E in, out at 4.2 s, 0.9 s to react, a slow walk | out with the fuse nearly gone. The blast caught me at ~2.5 m (hp 45), and I lived. Through in one try. |
| medium | E in, out at 2.2 s, walk | hp 92, through first try. |
| good | E in, out at 0.7 s, run | hp 100, the car goes 23.7 m behind me. Twice (with `o6_fire`'s own good). |
| on foot, idle by a burning car (`burn_near`) | walk up, stand | no warning before the blast (hp 100 to 51 at 2.5 m), then the wrong line and the wrong reason (finding 2). |

Nothing wins itself. Idle in the car loses, warned 4.9 s ahead with the
reason. Bad hands get through a little too easily (hp 45, first try). That
is acceptable for a beat that is a lesson about fire, not a fight.

---------------------------------------------------------------------------
## The user's asks

1. **"some destruction"**: met. In the city, the coupe on Grand Ave's
   kerb put two lamps, a stop sign and a hydrant over (`lamp:over`,
   `stop:over`, `hydrant:over`), and they lie where they fell (y 0.15,
   `rest`). In the bed, every kind answers a round (lamp out, hydrant
   leak, stall over at round 7, glass holed then gone, crates, bin,
   bench, call box) and a car (13 over in one kerb run). Six shop panes
   went when I scraped the coupe along the west fronts. A car rammed at
   37 km/h dents (sedan damage 1.03). A car shot in the bonnet steams,
   smokes, burns 6.6 s, blows (flash, shards, hurt) and lies a burnt
   wreck.
2. **"everything works"**: not met.
   - Physical: partly. A lying stall stops a man (closest 1.02 m from
     its middle). A standing newsstand stops a man (0.98 m). The shop
     front stops a man and a car (the car scrapes along it and never got
     past the facade line: `ram.json`, `past: 0`). A car is barely slowed
     by what it hits (finding 4). I did not prove that what lies stops a
     round.
   - Seen: not met (findings 1 and 3). The fire, the blast and the shop
     glass read very well. A stall, a hydrant, a crate in the dark and a
     shot lamp's head do not.
   - Frame rate: the average holds (the `hundred` with `all=2.5` at 48.4
     fps against `shot=perf` at 36.0 at the same moment: 1.34 x). The
     blast's frame is a hitch (finding 5).

---------------------------------------------------------------------------
## Your report's left list, as a player feels it

1. City shop glass and awnings not breakable: felt by everyone. Make it
   major, first after the blockers (my finding 8).
2. Dark on dark: this is my blocker 1. It is not polish.
3. Gun latency 9 to 143 ms: I measured one frame from the press to the
   thing's answer. Not felt beyond the machine's frame time.
4. The one car: when it is wrecked I walk. Fine with O2's cars. Outside
   the bed, the burning-car death's words have the same wrong-reason
   problem as finding 2.
5. Dents as vertices: not felt. Dents read at the silhouette.
6. The lorry's seat with no wheel: seen. Minor.
7. Fists do nothing to the set: a player who punches a bin gets nothing.
   O4 should call `smash.hit(..., 'fist')`. Not testable on the bed (the
   Tommy gun only).
8. The coupe with no glass: not felt.
9. The `hundred` errors dump: not a player's.

---------------------------------------------------------------------------
## What is good and must not be broken by the fixes

- The fire beat as a contest: the warning the instant I sit in a burning
  car, 4.9 s to act, the fail's words, and the retry. Idle loses, good
  walks away with full health.
- The fire and the blast look right: orange ink flames at the bonnet's
  seams, black smoke, the flash and the splash of shards, the red hit
  marks at the frame's edge, the burnt shell that keeps burning.
- Shop glass: one burst holes the pane where the round went, the hole
  reads on the lit window, and a scrape along the fronts breaks pane
  after pane. The facade stops a man and a car behind the broken glass.
- Things in the city answer a car (lamps over, a hydrant sheared, a sign
  bent) and lie where they fell, resting on the ground.
- A lying stall and a standing newsstand stop a man. Nothing I walked or
  drove into let me through.
- Input: a round's hit answers in the first frame. The pad play
  (`tools/plays/o6_pad.json`) passes 4/4 by the pad alone.
- Errors: none in `#errlog` on any of my 20-odd runs.
- The average frame rate at the `hundred`: 1.34 x `shot=perf` at the same
  moment.
