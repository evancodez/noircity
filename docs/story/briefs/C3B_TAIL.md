# C3b — chapter VI The Tail: what the user felt when he played it (2026-10-03)

Branch `wave-c/C3b-tail`, port 5343. The city and the tail are merged
(`docs/story/reports/wave-c/C3.md`; the rules in `src/scenes/tail/rules.js`,
applied by `chase.js`; the shunt `rammed`, the gun `gun.js`, his driving
`his.js`). The user played it by hand and wants five things changed. This
is a short, precise lane: do these, prove them, stop. Do not redesign
anything else; do not touch the look.

His words: "we need the enemy car to speed up if you catch up to it (a
bit of dynamic play): you can graze the bumper but that's it until you
start the shooter section. The car should be a bit easier to stop with
your gun but not trivial, and if not the gun, make it so shunting the
back corner works (it seems impossible at the moment). I think just have
it so you need to ram the other car to crash, and make it look cool if
you get that to happen (remember this is gameplay, not a cutscene). Then
you get out and see him crouched over; you don't need an interrogation
scene, but he tells you to go to Pier 9. Then you drive there, and there
is no cutscene in between: you're just there and the next mission starts.
The fail state should be: the car gets away if you aren't able to ram or
shoot it after enough time; it speeds away."

## 1. Phase a: he pulls away when I get close
In the street chase (before the river road), when I close to within a
car's length or two he answers: a burst of speed (his car can go faster
than mine for a few seconds, then it falls back to his pace; the engine
note rises, the tail lamps brighten, the tyres chirp on the wet), a late
turn I did not expect, a cut through traffic. Grazing his bumper is
possible and does nothing to him but a jolt and a sound; I cannot ram him
off the road in phase a, and I cannot get past him. Tune it so a good
driver sits two to five lengths back and a great one gets the graze; the
rest of phase a is as it is (lose him by sight and distance).

## 2. Phase b: the gun hurts him, the ram finishes him
- **The gun**: a bit easier, not trivial. A tyre goes on **one** round
  (the hiss, the quarter down, the rim sparking): then he is slower than
  me and weaves, and I can catch him. The man ducks as now. The tank
  smokes, then burns, as now, but **no number of rounds alone ends it**:
  the fire and the tyres and the man only wear his hold down to a limp
  (control floor about 0.35: slow, weaving, catchable), never to the
  crash. (`HIT`: tyre to about 0.4 per round, cap `control` at the floor;
  remove the `lose` end from rounds.)
- **The ram** ends it, and it must be reachable: once he is hurt (any
  tyre gone, or the tank smoking, or the man hit) **a shunt on his back
  corner from a quarter-on angle spins him** (the PIT: my front wing into
  his rear quarter, pushing across). Make the detection honest but
  generous: contact behind his rear axle line, my heading 15 to 60
  degrees off his, a closing speed above a small threshold; a straight
  rear-end is a shove that moves him and costs me a little, not a spin.
  Un-hurt, the same shunt only staggers him (a fishtail he catches) and
  he pulls away as in phase a. Let the player feel that the gun earns
  the ram.
- **The crash looks like something, and it is physics, not a cutscene**:
  he spins (his car on the same physics, the tail stepping out, the
  lamps sweeping the wet, steam), hits what is there (a lamp post that
  bends and goes out, a stall that bursts, the river rail that holds), and
  comes to rest on its wheels or its side; my car keeps going under my
  control (no camera taken from me; at most a short slowdown, under a
  second, as he goes past my windscreen). A horn stuck and dying, his
  lamps going out one after the other, as now.
- Keep the teach cards short: the gun card at the river road; the ram
  card the first time he is hurt (`[A] [D] shunt his back corner`).

## 3. After the crash: no interrogation
I stop and get out (**E** near the wreck: the door, the eye out and up;
a walk mode on the road, nothing else to do there). He is **crouched
over by his wreck**, a hand on the road, the bowler gone. When I walk up
to him (within two metres, looking at him), one line from him, subtitle
only, and his arm pointing down the river road: "Pier nine. Tonight." (or
better, at most five words). No holding, no question, no camera move;
if I walk off without going to him, the line comes anyway as I pass
within six metres. Then **E** at my car's door to get back in (the same
cut into the seat as the chase's), objective "Pier 9.", and phase c as
it is. The old `hold` mode and the question's clips are not used here.

## 4. Arriving: no cutscene, the next mission starts
Stopped at the pier's bay, **E get out**: the door, the eye out, and I am
**standing at Pier 9 with the chapter VII card lettered small over the
picture**, no black, no full card. Chapter VII's first beat must come up
under me without a hitch (warm its stage during phase c as the city was
warmed: `game.stages.warm('pier9')` each frame from the river road on).
Lane C7 will own the first frame of VII; your job is that the cut is not
felt (`ctx.next({ fade: 'cut', card: 'small' })` or whatever the kit's
manager offers: if it offers no small card on a cut, add that one option
to `SceneManager.go`, marked `[C3b]`, as the tail's own small card
already does it).

## 5. The fail: he gets away
Phase b loses by time, not by the gate: he speeds away. From the first
frame of phase b he has a window of about forty-five seconds (tune it: a
good hand needs twenty, a clumsy one most of it); as the window closes
he is visibly getting away (he is small and far, the warning "He's
pulling away." at about two thirds), and when it is gone he is a pair of
red lamps swallowed by the rain and the fail says "Lost him." Back at
phase b's start, him hurt as he was not. Keep "He warned them." only if
the gate is reached first; the window is the rule.

## Proofs and gate
`tail_idle` (hands off in a and in b: lost, warned first), `tail_bad`
(clumsy: through on the second or third try), `tail_good` (wins twice:
one tyre, catch him, the shunt, the line, the pier), `tail_ram_whole`
(the shunt on a whole car does not spin him), `tail_gun_only` (rounds
alone never end it), `tail_graze` (a bumper graze in phase a jolts and
nothing more). Golden check identical; errors clean on every beat;
strips of the spin and the crash, looked at. Report: a "C3b" section
appended to `docs/story/reports/wave-c/C3.md`. **This lane should take
hours, not a day**: the user is waiting to play it again.
