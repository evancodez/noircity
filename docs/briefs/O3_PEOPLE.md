# O3 — people: pedestrians, witnesses, gangs, beat cops, the police system, arrest, the station

Branch `ow/O3-people`, port 5373. Built on the city (lane O1 is merged:
read `docs/reports/O1.md` "For other lanes" and `docs/seams/WORLD.md`
first: the pavement graph, the random walk, the line of sight, the call
boxes and the stops the plan places, the budget O1 leaves you), on the
combat (lane O4, `docs/reports/O4.md`: the crowd brawl and how a system
spawns a fight, the gun kit's men in open ground and how they come from
the pavement's graph) and, when it has merged, on the wheels (lane O2,
`docs/reports/O2.md`: the police car's model, lamp, siren and hunting
pilot, `traffic.alarm`, the hijack's events; until then a stand-in
patrol car on the base's `Car.js` and `pilot.js`, dropped when O2
merges). The user's words:

- **[must]** "there should be a police system too."
- **[must]** "everything works": nobody walks through anyone; a man a
  car hits goes down; a body is solid to things, not to feet (lane
  C2b's rule); where a crowd stands I go round or push through, seen.
- **[must]** The three bars (GAME_TWO §1): the police are dangerous and
  fair (a warning before every arrest, a tell before every shot), the
  heat is read on the frame without a word, nothing locks me.

What you build on: the cast (`src/cast/`: `Figure.js`, `Character.js`,
`costumes.js` (everyone told by the outline at 20 m), `kinds/`,
`extras.js`, `castAnim.js`, `clips.js`), the walkers of the tail
(`src/scenes/tail/walkers.js`: people under umbrellas who jump clear of
a car), the Hood (`src/enemies/Hood.js`, `HoodAI.js`, `HoodBrains.js`,
`Nav.js`: the gunman), the brawl brain (`src/cast/brawl/brain.js`), the
kit (`docs/story/seams/Z.md`: `game.fail` is the arrest and the
hospital), reports `docs/story/reports/wave-c/C2b.md`, `C3.md`, `C4.md`
and their `Left`.

## 1. Pedestrians (`src/people/`)
The city's weather. A **crowd figure** cheaper than the cast's (the base
budgets eight full figures a frame: the crowd needs forty in view at the
busiest street; a lighter rig with the same silhouettes, the ink reads
the outline; the cast's full figure for the ten nearest), of kinds told
at 20 m: men in coats and hats, women in coats and cloches, a docker, a
newsboy, a drunk, a man with a paper, a couple under one umbrella. On
O1's pavement graph: walking somewhere, standing under awnings in the
rain, at the stalls, at the stops, on stoops, at the bar doors. They
come on out of my sight and go when out of it; never a pop.
They **react**: step round me and each other; a car coming: the dash
clear (the walkers' rule); hit by a car: down, hurt or dead (a death
seen is heat); a gun drawn near them: flee, with a cry; a fist fight:
cower back in a ring, some watch; a shot: scatter; a wreck or a body:
gather at a distance after a while; a crime seen by one of them: **the
run to a call box** (O1's boxes) or to a cop in sight: the witness's
walk is seen (he looks at me, he goes), and can be stopped. Solid to
me and to cars (a man in the road is stood on the brake for, by
traffic; by me, he is down).

## 2. The police system (`src/police/`)
- **`HEAT`** 0 to 5 in `police.heat` (and `save.heat`), with
  `police.on('heat', fn)`: the seam O7's badges draw; until O7, a
  stand-in row of badges top right in the HUD's ink (`[O3]`, replaced
  by O7). **A crime seen** by a witness raises it: a punch 1, a hijack
  1, a shot 2, a death 3, a cop hurt 4 (`crime.emit(kind, point, by)`
  from O2's hijack, O4's guns and brawl, O6's smash of what is someone's;
  a crime unseen is nothing: write who can see (a cop in line of sight
  within 40 m; a civilian within 25 m who then reaches a box or a cop)).
- **The response** by level, each seen coming: 1 a beat cop walks over
  (`Hands up.`: fists, or run); 2 a patrol car with two men (the siren
  heard before it is seen); 3 two cars and a roadblock on the road I am
  on (two cars nose to nose, men behind them: O1's graph gives the
  road); 4 detectives with Tommy guns, cars from the sides; 5
  everything, and the riot squad's lorry. The men are O4's kinds (cop,
  detective) with the kit's tells; the cars are O2's police car on its
  hunting pilot (the stand-in until then). They take cover, flank, box
  a car in (two cars on me and stopped for 4 s on foot or in the car:
  the arrest comes).
- **Losing it**: out of their sight for a while (the time by level: 20 s
  at 1, a minute at 3): the **search state**, shown (the siren drops to
  the cruise, the cars prowl the streets near where I was last seen,
  the men look); a change of car where no one sees; an interior (O5's
  seam: `police.lost()` from a door). Found again: the heat as it was.
  The HUD line (O7's; `hud.objective` until then) at each change: `HEAT
  2`, `Lose them.`, `Clear.`
- **Arrest** is the fail when they have me cornered on foot (two men
  within 3 m with a line, or down in a brawl with a cop): the warning
  `Hands up.` (a second to run or fight), the black (`game.fail({ why:
  'Arrested.' })`), and I wake at the police station (O5's room when it
  merges: until then the pavement outside the police HQ, O1's
  landmark), the gun gone, the heat gone, the car gone, the money less
  a fine. **Death** is the hospital (O4's rule). Both fair: the tells,
  the warnings, the retry in under ten seconds.

## 3. Gangs and beat cops
- Two **gangs** with turf (the Docks, the Tenements), told apart by
  costume (one in long coats, one in caps and jackets): they stand on
  corners in threes, outside their bars, at their hideouts' doors (O5's);
  they watch me (heads turn), they say a word if I stand with them, they
  draw if I draw, they fight me with fists if I push one (O4's brawl),
  they shoot back; now and then (one in ten minutes) two threes meet at
  the border and fight each other, fists then guns, which the police
  come to. Each gang's men are O4's gang kinds with their costumes.
- **Beat cops** walk a beat on the pavement graph (Downtown and the
  Hill most, the Docks least), stand at corners, talk to a civilian; a
  cop who sees a crime is the witness; at heat 0 a cop lets me by.

## 4. Proofs and gate
The heat proofs: a punch seen (1: the walk-over arrest: idle arrested,
warned; good runs or wins the fists twice), a hijack in a car at 2 (a
car chase: idle boxed and arrested; medium lost in one to three; good
twice), 3 (the roadblock: through it, round it, or on foot through an
alley: medium one to three), 4 and 5 (hard and fair: can I lose, can I
win, do I know how), the witness proof (a punch in an empty alley raises
nothing; the same before a cop raises 1; a civilian who reaches the box
raises it, one stopped does not), the losing proof (out of sight, the
search shown, `Clear.`; found again), the arrest proof (the station,
the gun gone), the gangs' border fight seen and a push of a gang man;
the jank walk through the busiest crowd (nothing through anyone, a
body never blocking feet) and a car driven into a crowd (they clear or
go down, never through); the latency of the fists and of E on a cop's
car; the strips of an arrest, of a witness running, of the roadblock;
fps at the busiest street with the crowd at its cap and at heat 4;
memory flat after ten minutes at heat 3; golden identical (the base's,
O1's, O4's, O6's and O2's frames) plus two of yours; errors clean at
every landmark with the crowd on; the pad play of an arrest and a car
chase. Edits to shared files marked `// [O3]`. Report
`docs/reports/O3.md` with "For other lanes" (`crime.emit`, `police.heat`
and its event, `police.lost`, how a place spawns a gang, the crowd's
budget). Hours, not days.
