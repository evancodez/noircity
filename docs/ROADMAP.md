# NOIR CITY — the roadmap (2026-10-23)

The plan to build it to completion, as the art director runs it. The
standard is `docs/OPEN_WORLD.md`; the lanes are `docs/briefs/O*.md`; the
reports `docs/reports/`. The user plays each push and his words go into
the briefs as `[must]` lines.

## Phase 0, done: the city
Lane O1 (merged, pushed): the 1.2 km city from a hand-written plan, five
districts, the el, the river and the bridge, streaming at 60 fps, a car
to drive, the map. The title says NOIR CITY and BEGIN drops you in.

## Phase 1, running now: the systems (the first playable)
Five lanes at once, each an Opus owner, a cold critic, a fix pass:
- **O4 combat**: the crowd brawl (one to four men), guns in the open with
  cover from the world, the shotgun, the gym's bouts, the gun shop.
- **O6 smash**: the destruction set (hydrants, lamps, stalls, glass...),
  physical car damage within reason (dents where hit, parts that come
  off and lie on the road, fire, the wreck).
- **O2 wheels**: eight car kinds in variants, traffic, parking, the
  hijack, the garage, taxi fares, the race.
- **O3 people**: pedestrians who react, witnesses who run for a call
  box, two gangs with turf, beat cops, HEAT 1 to 5 with its five
  responses, arrest and the station.
- **O1b streets**: every street distinct (a blind test), more props,
  items picked up with E, the newspaper with the city's news of you,
  the train that waits, a touch of colour under 2 %.
When these five are merged: **the first playable**. Drive, hijack,
fight, shoot, break the street, and the police come for you, through
streets that do not repeat. Pushed as each lands (today, Oct 23).

## Phase 2, next: the places and the night
- **O5 places**: the interior kit and a dozen buildings with a use each
  (the gym, the diner, two bars, the gun shop, the garage, the hotel
  with its save, the police station, two hideouts, the market hall, the
  theatre, the tenement stairs to the roofs).
- **O8 figures** (after people and combat merge): one cast on one rig
  for every system in the Hood's look (the face in the brim's shadow,
  nothing blocky, nothing balloon), a dozen kinds in seeded variants,
  blended clips over procedural layers, a light ragdoll for falls and
  car hits within reason, AI whose intention a player reads before the
  act; never stiff, never glitchy.
- **O7 the night**: the HUD (heat badges, money, the minimap bottom
  left), the full map on M, saves, the car radio and the city's sound,
  the title with the live city behind it, the pad through everything,
  the things to do tied together (the race, fares, the el, the bounty
  board, the matchbooks), and the whole-game havoc hunt.
Target: the weekend (Oct 24 to 25).

## Phase 3: the rounds (without waiting for the user)
The user said not to wait for him to play: phases 3 and 4 run on the
art director's own judgement and the critics' findings; his words, when
they come, go into the briefs. What a critic or the merge check finds
becomes short follow-up lanes (`O2b`, `O6b`, ... ) at `high` effort: the feel of a thing, a
system that answers too little, a place that is not fun. A lane that
landed short of a `[must]` gets its follow-up without waiting for him.

## Phase 4: to completion, polished
- A whole-game cold critic (the havoc play from every district, every
  system poked, every place entered).
- A look pass over every district against the reference (pools, ink,
  the colour measure).
- A performance pass (the busiest junction at heat 5 with the crowd and
  the traffic at their caps: 60 fps; memory flat over an hour).
- A sound pass (every action sounds; the radio's stations; the city's
  bed by district).
- The final golden set, the README (how to play, every key), the docs.
Done means: a player who knows nothing can sit down, drive off, cause
havoc, lose the police, buy a shotgun, win a bout, and want to keep
playing; and nothing he tries breaks it.

## How the machine is run
- At most five lanes at once; a launch only with the one-minute load
  under 20; none while it has sat over 35.
- Thinking modes (the user's rule): `xhigh` only for the lanes that are
  3D (O1, O1b), physics (O2, O6) or AI and mechanics (O3, O4); `high`
  for places (O5), the night (O7), every fix pass, every critic and
  every follow-up; Sonnet or lower for docs and mechanical pieces.
- `main` is pushed to GitHub after every merge; game two of NOIR
  EXTREME is paused at the user's word.
