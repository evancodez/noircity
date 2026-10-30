# O5c — rooms that answer: stores to rob, things that break inside, people inside who react; never a loading screen

Branch `ow/O5c-rooms`, port 5386, effort xhigh for the build (mechanics,
physics, the AI inside), high for the critic and the fix. The third pass on
places, after O5 (`docs/reports/O5.md`) and O5b (`docs/reports/O5b.md`), on
main after O8's cast and, if it has landed, O9's propagation model. The
user's words (2026-10-29), which bind:

- **[must]** "The point of this game is a fun open world that feels smooth,
  alive, populated and on theme. Make it look varied, feel alive and
  populated, and have fun gameplay."
- **[must]** "Buildings you can enter, interiors without a loading screen,
  and things to do in them, destructible / physics objects, stores to rob
  etc. is a thing to have. Not every interior."
- **[must]** "In general, things like destruction, environment objects, or
  NPCs reacting to you is a good idea."
- **[must]** "The goal is polish rather than immense scope (apply that to the
  entire world), but it should still be pretty cool and varied."

So: **five rooms done completely**, not fifteen done a little. The rest of
the rooms keep what O5 and O5b gave them and gain only what §1 and §4 give
every room for free.

What you build on: the rooms (`src/places/rooms/*.js`, `Places.js`: `K.room`,
`K.use({ at, prompt, onUse })`, `K.fig(kind, x, z, yaw, { state, seat })`,
`places.owns(door)`; the room built at ~34 m and dropped past ~62 m; the
first open one frame), O6's set (`docs/seams/SMASH.md`: `S.register(target,
kind, opts)`, `smashKinds.js`, the caps of §4, O6b's parts), O3's police
(`src/police/Police.js`: `witness(rec)`, `heard(rec)`, `report(rec, who,
how)`, `raise(level, at, why)`, `event(what, data)`; `crime.js`), O7's
things and money (`docs/seams/NIGHT.md` §5a: `G.things.start / line / end /
done`, `G.money.add / take`, the news line through `end`), O4's guns and
the brawl (`src/combat/`; the hands' state machine of O4b when merged:
`combat/inhand.js`), O8's cast (`docs/seams/CAST.md`: the kinds, the layers,
the ragdoll), O9's propagation and variety rules (`docs/briefs/O9_ALIVE.md`
§1b, §1c; if O9 is not on main yet, O3's witnesses, and leave the seam O9
will fill, named in the report).

## 1. Never a loading screen (every room)
- The approach's long frame goes (O5b Left 4: 40 to 60 ms when a place comes
  inside its radius): the room is built over steps (the shell one step, the
  merge the next, the dressing, then the people), each under 4 ms, on the
  approach, so the door's first open stays one frame and nothing before it
  hitches. Proof: the tour (`o5_tour.json`) and a run at every open door on a
  quiet machine: no frame over 20 ms at the radius or the open.
- Nothing fades at a door. The hotel room's fade is the sleep's only.
- The street stays alive through the glass both ways: from inside, the
  street's people and cars pass the windows (keep it); from the street at
  night, a lit window shows the room's lamp and a figure that moves.
- In and out at a run, mid-brawl or mid-chase, never locks: the door is a
  door. The cops follow to the door at heat 2; two come in at heat 3 and up
  (O3's men, the room's cover).

## 2. Stores to rob (five, done well)
The five: **the gun shop** (the till and the glass case), **the diner** (the
register), **the Docks bar** and **the Tenements bar** (the till behind the
bar), **the hotel** (the desk's cash box). Not the stairwells, the theatre,
the hospital, HQ, the garage, the market hall (it has no till; its crowd is
O9's). The pier office and the warehouse already have their safes: leave them.

One shape, five tellings:
- **The start**: a gun drawn on the man behind the counter within 4 m, or a
  punch landed on him. He raises his hands (the cast's hands-up, 0.3 s, a
  read), with a line of his own per place (never the same twice running:
  `Take it. Just take it.` / `Don't. Please.` / `You'll hang for this.`).
  The room reacts by O9's rules: the customers freeze, then go out of the
  door one by one (not all at once, not all the same way); the drunk does
  not notice; the cook ducks behind the hatch.
- **The take**: `E  the till` at the counter: he empties it over 2.5 s, the
  money counting up on the HUD (`G.money.add`): the gun shop $60 to $120,
  the diner $15 to $30, a bar $25 to $50, the hotel $40 to $80; the gun
  shop's case with a second E (a box of rounds; a revolver if I carry none).
  Walking off with the gun still on him keeps him still; holstering, or
  looking away for 3 s, frees his hands.
- **The risk, by place** (the tells a player learns): the gun shop man has a
  shotgun under the counter and goes for it the moment the gun is off him;
  the Tenements bar's gang at its back table stands up (a brawl, or a
  shootout if I fire); the diner's cook comes out of the kitchen with a
  cleaver (a brawl); the hotel's clerk has a bell under the desk: a beat
  cop within 120 m comes to the door in 20 to 40 s; the Docks bar's men
  are dockers: two of them square up when the gun is away. Each place's
  risk is seeded so it is not the same every night, but the kind is fixed:
  a player who robbed the diner twice knows the cook.
- **The law**: `police.witness` with the crime `robbery` from the first
  witness (heat 2; 3 at a shot), the report line, the news line through
  `G.things.end('rob:<place>', { money, news, weight })`
  (`STICK-UP AT THE GRAND HOTEL`, `GUN SHOP ROBBED, OWNER SHOT`). The cops
  come to the street door first: every robbable room gets **a back way**
  (the kitchen door, the yard, the cellar stair) that exists already or is
  cut now, lit so it reads.
- **After**: the place is shut for the rest of the night (the shutter, a
  `CLOSED` card in the door, the door locked, a cop at it for an hour of
  the game's time), open the next day with the man wary (`You again.`: he
  reaches sooner, the take is smaller). The save remembers (`things.done`).
- **With fists only**: a punch puts him down (O8's ragdoll); the till the
  same; the crime `assault`, heat 1, and the room's men come at me.

## 3. Things that break inside (the five rooms, the gym, the hideouts)
Register the rooms' loose things with O6's set so they go over, break and
scatter, within O6's caps (a dozen loose bodies in a room at 60 fps; the
merged dressing stays merged):
- the bars: the bottles on the back shelf (a round: shards and the spill, a
  burst of the Tommy gun sweeps the shelf end to end), the glasses on the
  bar, the stools and chairs (a fight knocks them; a thrown man takes them
  with him), the tables over, the pool table's balls scattered by a shot or
  a shove, the piano's lid, the jukebox (shot: the record skips, then dies),
  the hanging lamps swing when hit and go out when shot (the room darker:
  the lamp is real);
- the gun shop: the glass case (shards), the racked guns stay (merged);
- the diner: the pie case, the counter's pies and cups, the stools, the
  pendants;
- the hotel: the palm, the bell, the armchairs, the desk's lamp;
- the gym: the heavy bags swing when hit, the bell rings when shot, the
  benches over;
- the hideouts: the crates chip under rounds (a cover that wears: O6's kind).
The brawl inside: a man thrown against the bar takes the glasses; the fight's
ring moves the stools; nothing through a wall. The shootout inside: a table
on its side is cover (O4's cover marks on the tipped table).

## 4. People inside who react (every room, by O8's cast and O9's rules)
- The barman wipes and looks up when I come in; the clerk straightens; the
  cook calls an order; the drunk mutters. A drawn gun: a step back, then the
  door; a shot: the room empties but the drunk and the man with his hands
  up; a fight: a ring forms or they leave; a body on the floor: a stare, a
  line, someone goes for a cop.
- A room's reactions go out of its door: a fleeing customer tells the street
  (O9's spread), a cop at the corner hears a shot through the door at half
  range, the street's people look at the door.
- No two react alike (O9 §1c): the strip of a bar's dozen under a drawn gun
  shows no two doing the same thing the same way.

## 5. Proofs and gate
- **The door play**: every open door approached at a walk and at a run on a
  quiet machine: no frame over 20 ms; in and out mid-brawl and mid-chase.
- **The robbery plays**, each of the five: idle (the gun drawn, nothing
  done: the man or the cop ends it), bad, medium (the till, out the back,
  lost round the corner: a win in one to three), good; the fists' one; a
  second robbery of the same place the next night (harder, read).
- **The smash play**: a burst along the Docks bar's shelf (the count of
  bottles gone), a brawl of three in the bar (the stools over), fps at 60
  with everything over against `shot=perf`.
- **The reaction strip**: a dozen in the Docks bar under a drawn gun, no two
  alike; the street outside reacting to the door.
- golden: game one's 40 identical (the hard rule); the city's with the rooms
  re-taken and named beside the old; errors clean at every room's start and
  every robbery's end; the save remembers; memory flat over ten minutes in
  and out of the five.
Report `docs/reports/O5c.md`. Hours, not days: five rooms, done completely.
