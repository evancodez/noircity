# G5 — VII Pier Nine: loud from the gate (the stealth parked), the catwalk gunner, the foreman

Branch `game-two/G5-pier`, port 5365. Chapter VII as built by lane C7
(`src/scenes/08_warehouse.js`, `scenes/warehouse/{crew,fight,loud,stealth}.js`,
the pier `src/stages/pier9/`; report `C7.md` and its `Left`; C13's ammo
rows; C10b's seam fixes). Lane G2's gun kit feel is merged before you
start: build on it, do not redo it. Lane G4's VI The Run ends at the
pier's gate: VII begins there with no cutscene (read `G4.md` for the
seam: where the car stops, what I carry). The user's words:

- **[must]** "get rid of the stealth": the quiet pass is parked (its code
  stays, reachable by `?start=warehouse.<its beat>` only), not deleted.
- **[must]** "the shooting sections": "way smoother", "more fun", "easy to
  grasp"; "destruction", "environment".
- Still binding from wave C: clear from the first moment what I am to do;
  then a boss fist fight; the photograph crossed in red (the twist) and
  the order through the glass; the shells; the hook takes the gun.

## 1. The chapter, loud from the gate
They know I am coming (VI: they saw). The chapter is a fight through
the pier to the office and back out through the foreman:
1. `gate`: out of the car at the gate's lamp; the objective `The office.
   Find what they have.` (or better); the first two men at the gate shed
   come out shooting (the tell), the car and the gate's posts my cover;
   a fork seen: the big doors, or the side door down the wall.
2. `yard`: crates, the truck, the drums as cover (thin wood chewed, the
   drums ring); three men who use it and come round; a man with a torch
   on the water side who runs for the shed to warn (`He's going for the
   others.`: a choice, not a fail: he fetches one more man).
3. `floor`: the shed's aisles and stacks; **the catwalk gunner** (C7's
   Left 1): a man posted on the catwalk with the Tommy gun who pins the
   aisle (his tell: the muzzle swings, the sound; his bursts chew the
   stacks), killable from the floor when he shows, or from the stair's
   top; the dark lane under the mezzanine is the other way (he cannot
   see down it). Two or three floor men. The gun kit gets a **post**: a
   man who holds a place on a second level and fires from it (the kit's
   men walk the floor's grid only today: write the post into GUNS.md
   §4, marked `[G5]`, the simplest honest way: a fixed node, a line of
   sight, the tell, the death where he stands).
4. `office`: the mezzanine office: the photograph under the lamp (the
   still: `NOT HIS GIRL. HIS NEXT.`), the shells on the desk (the count),
   the order heard through the glass (the diner, tonight) as the men
   below regroup; the objective `Get out. The diner.`
5. `foreman`: he bars the stair: fists (the one fight system, FIGHT.md
   v6 after lane G1: merge G1 if it has merged before your fight work;
   if not, build on v5.2 and say so). The boss: harder than Mack in his
   blows, not longer: `foreman_medium` wins in 60 to 120 s with 1 to 3
   downs (C7 Left 4: 260 hp was 5 minutes for a medium hand). One thing
   of his own (a crate he shoves at me: the cue; the catwalk's rail he
   uses), the room in play. The hook takes the gun at the end as the
   story has it; the revolver's loss is seen.
6. `after`: out to the car; VIII begins (C10b's seam).

## 2. Feel and the middle
G2's numbers hold here (latency, the read, cover). Cards: none new
(fire, low, steady, reload are taught; the foreman's fight has its
cards from II); the nudge: a player pinned by the catwalk gunner for
8 s without moving gets the objective re-struck (`Under the catwalk, or
the stair.`) once; the fail's black names the fix (`The catwalk. Get
under it.`, `Get low.`). `pier_medium` through each contest in one to
three tries; `pier_good` twice; `pier_bad` by the fourth; `pier_idle`
dies at the gate, warned. The men's count: eight to ten across the
chapter, in groups, never a crowd on me at once.

## 3. Everything works
The interaction walk of the pier: every door (the gate shed, the side
door, the big doors, the office, the cold store if any), the truck, the
crane's lever if it is there (an honest answer), the switch panel, the
phone in the office; the jank walk with men coming through every door
and the gunner on the catwalk; bodies never block feet; the stacks are
solid; the water is water (a fall is the fail, warned at the edge by
the look of it, not a wall). Destruction seen: the drums, the crates,
the office's glass, the lamp on the catwalk shot out (the gunner's light
goes: a choice). fps at the floor with the gunner firing.

## 4. Proofs and gate
`pier_idle`, `pier_bad`, `pier_medium`, `pier_good` twice, `pier_post`
(the gunner taken both ways), `foreman_idle/medium/good`; the seams
from VI (by `?start=run.gate` once G4 is merged, else `?start=warehouse`)
and into VIII (`c10b_seam_loud_nick`); the latency numbers; the
interaction walk; golden (the pier's arrive frame will change: name it
and show it); errors on every beat; the pad play. Report
`docs/story/reports/game-two/G5.md`. Hours, not a day.
