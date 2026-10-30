# O9 — alive: the city as a living place, reactions that make sense, nothing canned or stiff

Branch `ow/O9-alive`, port 5389. After O2 (wheels), O3 (people), O7 (the
night) and O8 (figures) are merged: the lane that turns the systems into
a city that feels alive. The user's words after playing (2026-10-23,
midday):

- **[must]** (the user, 2026-10-29, the point of the game; every brief and
  merge is judged by it) "The point of this game is a fun open world that feels smooth, alive, populated and on theme. Make it look varied, feel alive and populated, and have fun gameplay." Smooth, alive, populated, varied, fun,
  and on theme (the ink).
- **[must]** (the user, 2026-10-29, the direction for what is left)
  "Buildings you can enter, interiors without a loading screen, and things
  to do in them, destructible / physics objects, stores to rob etc. is a
  thing to have, if you haven't started on that. Not every interior. In
  general, things like destruction, environment objects, or NPCs reacting
  to you is a good idea. Once again, the goal is polish rather than
  immense scope (apply that to the entire world and the other things you
  are working on), but it should still be pretty cool and varied. Work
  your way up. Keep working until I stop you."
- **[must]** "The city doesn't feel alive, and NPC reactions, police
  etc., are often too stiff or nonsensical."
- **[must]** "It's possible the car hitboxes are too big, as bullets seem
  to hit the cars sometimes. Also some first-person car views, like the
  police car's, are blocked." (Lane O2b's since 2026-10-29, §0:
  judged at O2b's merge; your report names where it stands.)
- **[must]** "Basically make the city feel more alive and less canned and
  stiff. That's a general goal."
- **[must]** "Alive means robust systems of reaction and procedural stuff
  happening. Not: I shot a person and everybody in the entire map knows.
  Not the opposite either: you shoot somebody and you see NPCs not
  caring. Not everyone with the same animation, running the same way.
  All are bad. Find a way to have it feel alive."

What you build on: O3's people and police (`docs/reports/O3.md`,
`src/people/`, `src/police/`: the walkers, the witnesses, the heat, the
responses, and its `Left`: the beat cop sidesteps rather than paths, a
second cop does not join, witnesses slow where the box is far, a patrol
car can stall), O8's cast (`docs/reports/O8.md`, `docs/seams/CAST.md`:
the rig, the layers, the ragdoll, the intention read), O2's traffic and
cars (`docs/reports/O2.md`), O7's night (`docs/seams/NIGHT.md`: the
news, the things, the radio), O1's graphs (`docs/seams/WORLD.md`), the
perf audit's budget table (`docs/reports/PERF_AUDIT.md`: forty figures,
thirty cars, what is left at 60 fps).

## 0. Scope: polish rather than immense scope (the user, 2026-10-29)
Fewer things, each done completely, seen working in the street by a cold
player. Cut from this brief on 2026-10-29 by the manager: the cars' hull
for rounds and the seats' views (lane O2b owns them: `docs/briefs/O2B_WHEELS.md`),
the city's sound bed (the phase 4 sound pass; a reaction keeps the cry, the
whistle or the horn the base already has), and every event past the six
below. The walkers' reasons: three or four per district, done so a player
can follow one man to where he goes and see him do it. The rooms' people
are lane O5c's (`docs/briefs/O5C_ROOMS.md`), building beside you: your
propagation and variety rules (§1b, §1c) are what its rooms read; name the
seam (the function a room calls to pass a reaction out of its door) in
your report and in `docs/seams/`.

## 1. Alive: density with purpose, and things that happen on their own
- **Walkers with somewhere to go**: each walker has a destination and a
  reason (the el's stair to a bar's door and in; a stall to a stop; a
  stoop to the corner shop and back with a bag), picked by district and
  hour; groups of two or three who walk and talk; queues at the theatre
  and the stop; a shoeshine; a man under an awning lighting a cigarette;
  a cop on his beat with its stops. The budget is the audit's (forty in
  view at the busiest street: the light figure beyond the ten nearest,
  the outline beyond that), and the near street is never empty.
- **Cars with people**: a parked car that a man walks to, gets into and
  drives off in; a taxi that stops and drops a fare who walks to a door.
  Two, done so they read from across the street.
- **Events on a clock, by district**: six, each seen or heard from a
  block away, each something the player can walk into and each done
  completely (its start, its people, its end, what it does when the player
  steps in): a drunk thrown out of a bar's door; two men fighting in an
  alley (join either side); a paperboy calling the headline (the news
  line); a gang's three at their corner; a train on the el every few
  minutes with its sparks; once a night a fire engine passing flat out
  with its red lamp. Never the same event twice in a row at the same
  place; never one the player cannot interrupt.

## 1b. Who knows what: the propagation model (the user's own rule)
Knowledge of what I did travels like it would, not like a flag:
- **Perception**: a man sees what is in his line of sight within his
  range (about 40 m, less in rain, none through a wall) and hears what
  carries (a shot 120 m, a scream 60 m, a horn 80 m, a punch 15 m, with
  walls halving it); each NPC keeps what he himself perceived, with a
  position and an age.
- **Spread**: a witness tells the people he passes for a minute (they
  look toward where it was; some go to look); a scream makes the street
  turn and the near ones react, the far ones only look; a cop who saw
  it, or who was told, calls it in (then the patrol knows the place and
  my description: the coat, the car), and the news knows it next
  edition; nobody beyond that knows anything. A player who shoots in an
  empty alley and walks out calm is a man walking out of an alley.
- **Decay**: reactions fade with time and distance: the crowd disperses
  in a minute, the stare ends, the fear becomes a glance; the cop who
  lost me gives up; the police remember my car and my coat for the
  heat's life, nothing after.
- **Proportion**: the answer fits the act: a shove gets a word, a punch
  a ring and maybe a cop, a shot the street scattering and a report, a
  death a crowd and the siren. The proof: a shot on the quay at night
  with nobody near raises no heat and draws nobody; the same shot on
  Grand Ave at the stop draws the stop's people, two reports and a
  patrol car; a man two blocks away never flinches.

## 1c. Nobody moves alike (the variety rule)
Every reaction picks from a set by kind and by a seeded temperament
(bold, nervous, slow, drunk, young, old): one freezes, one runs, one
ducks behind a car, one shouts, one films nothing (no phones: one
stares), one walks off fast; the runs differ (a sprint, a scuttle, a
limp, a run with a hand on the hat), the speeds differ, the clips are
offset and blended so no two walkers are in step, the lines differ.
The proof: a strip of a dozen people reacting to one shot shows no two
doing the same thing the same way.

## 2. Reactions that make sense (the intention model)
Every NPC has a state the player can read, with human delays (0.3 to
0.8 s), eased transitions (no snap, no spin: the body turns), short
lines that vary (never the same line twice running):
`unaware → notices (the head turns, a glance) → reacts by kind`.
- A civilian: step aside / stare / back away from a drawn gun before a
  shot / flee a shot / cower in a fight's ring / gather at a wreck /
  report a crime he saw (and only one he saw).
- A cop: watch → warn (`Put that away.` to a drawn gun; `Move along.` to
  a loiterer at heat 0) → act (the walk-over, the hand up, the cuffs);
  he paths on the pavement graph (never sidesteps), runs at the corner
  he saw me turn (not at my coordinates), calls a second cop who joins;
  the search reads (lamps sweeping, cars prowling, cops on foot asking
  people, who point if they saw me).
- A gang man: watch → talk (`You lost, pal?`) → square up → fists or
  guns by what I did; they back their own.
- A driver: a horn, a swerve, a brake, a curse out of the window, out
  of the car with fists if I hit his car twice.
- To what I drive: a police car makes cops wave and civilians stare; a
  hearse makes people take off their hats.
- To my heat: at 3 the street clears ahead of me; at 5 nobody is out.
**Nonsense killers** (each a proof): no arrest without a cause I saw;
no witness for an unseen crime; nobody walks into a wall or another man;
no reaction without a cause; no reaction that outlives its cause (a
crowd that stares for ever, a cop who warns a man who has left); no
line that does not fit (a cop saying `Hands up.` to a man already down).

## 3. Cars and 4. Sound: cut (see §0)
The hull for rounds and the seats' views are lane O2b's; the sound bed is
the phase 4 sound pass's. The user's words on both stand above as musts:
O2b meets them; your report names where.

## 5. Proofs and gate
- **The alive test**: a cold critic stands at three corners (Grand Ave
  under the el, Hester St by the market, the quay) for a minute each,
  doing nothing, and lists what happened: at least six distinct things
  a minute, none repeated, half of them something he could join.
- **The read test**: strips of ten NPCs in reaction; the critic names
  each one's state before the act.
- **The nonsense test**: the list in §2 as plays; none produces an absurd
  reaction; the police proofs of O3 still pass (idle / bad / medium /
  good at heat 1 to 3).
- fps at the busiest street with the crowd, traffic and an event
  against `shot=perf`; memory flat over ten minutes; golden identical
  (named where the crowd changed a frame); errors clean at every start
  and every event. Report `docs/reports/O9.md`. Hours, not days.
