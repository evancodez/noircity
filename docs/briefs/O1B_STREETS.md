# O1b — the streets, distinct; more in them; items; a touch of colour

Branch `ow/O1b-streets`, port 5378. A second pass on the city after the
user's first drive (2026-10-23). His words:

- **[must]** "Overall nice. Think you could make things look a bit more
  distinct from street to street, and add a bit more stuff (def add
  destructibility and items etc)."
- **[must]** "I assume you are going to populate the city and add a bit
  more color (still the vast majority just black and white)."
- **[must]** "Keep on making this to completion and just making it
  super awesome, fun, cool, and polished."

What you build on: the city (lane O1: `docs/reports/O1.md`, its `Left`
7 (variety), 5 (the el's train), 6 (the swim), 9 (stoops); `src/world/`,
`src/city/kits/`, `docs/seams/WORLD.md`), the destruction set (lane O6,
`docs/seams/SMASH.md`: register what you place), the neon registry of
the base (`src/stages/city/parts/` neon, lane C3c's report), the
combat's counts (lane O4, `docs/reports/O4.md`: money and ammo seams),
the renderer's tone measure (paper white 5 to 8 %, `tools/tone` or the
look lanes' scripts in `docs/story/reports/wave-c/C11.md`). Populating
the city with people and cars is lanes O3 and O2; the minimap is O7's.

## 1. Every street its own (the blind test)
Each street in the plan gets a **character** record the generator reads:
its kit mix and materials (brick, stone, clapboard, tile, iron), its
shop fronts with something behind the glass (a tailor's dummy, a
butcher's hooks, a bookshop's shelves, a pawnshop's three balls, a
barber's pole, a florist's buckets, a radio shop's set, a laundry's
steam), its signs in their own letterings and awnings in their own
stripes, its lamp type (gooseneck, globe, hung, wall bracket), its
furniture mix, its trees or none, its tram or el or neither, and **one
thing mid-block that is only there** (a church, a firehouse, a
bathhouse, a cinema, a bank's columns, a hotel's canopy, a lit clock, a
water tower, a billboard, a stair down to a cellar bar, a yard's gate).
The Hill gets a curving lane; the Yards' sheds get sawtooth roofs; the
trees get a shape. The test: ten frames of ten streets from a car,
unnamed, and the critic names the district and tells the streets
apart. Nothing of this may cost the drive-through its hitch bar or the
busiest junction its 60 fps (budget it: instanced, LOD'd, the far chunk
still a mass).

## 2. More in the streets
Props by rule, denser and placed as a city would: carts, crates and
barrels by loading doors, milk churns, mailboxes, phone booths, fruit
stands, sandwich boards, bicycles against walls, dustbins in alleys,
rain barrels, washing, steam from grates and from the laundries' vents,
the el's drip under its track, pigeons as ink on ledges that go up when
I pass. Everything that can break is registered with lane O6's set
(`smash.register`) and goes over when a car or a man takes it; the lamp
heads can be shot out (`stage.lamps.hit`: O1 Left 4). The el's train
pulls in and waits at its stations (O1 Left 5). A man in the river
swims to the steps (a short swim, the eye at the water, not a fade: O1
Left 6).

## 3. Items (`src/world/items.js`)
Things I pick up with E that mean something, placed by rule and
replaced over time: a roll of cash in an alley or a hijacked car's
glovebox (`save.money`), a box of rounds behind a bar's counter or in a
police car (the revolver's and the Tommy gun's pockets), a weapon
dropped by a man who fell (his gun lies where he fell: E takes it), a
bottle (a weapon in a brawl), a matchbook in every bar (a collection on
the pause card: O7 draws it), a newspaper at every stand whose headline
is **the city's own news of what I did last** (`news.say(line)` from
the police system's events: `GUNFIGHT ON GRAND AVE`, `TAXI STOLEN
UNDER COP'S NOSE`; a seam O3 and O7 feed; until then three lines of
the night). The E prompt is the kit's (`E  take`), the take is 0.2 s
and never locks my feet.

## 4. A touch of colour
The rule, measured: colour under 2 % of any frame's pixels, never a
wash. A small palette of accents, each where a noir frame would have
it: the neon's blue (there), **red** (the police car's lamp, a fire's
ember, one sign in ten, the barber's pole, a firehouse's doors), **a
warm amber** (a theatre marquee's bulbs, a cigar's ember, a cellar
bar's window). Nothing else coloured: the rain, the street, the people
and the cars stay ink. Every accent through the registry so the tone
measure can count it.

## 5. Proofs and gate
The blind test (§1); the drive-through (`o1_drive.json`) still under
its hitch bar; fps at the busiest junction and the densest street
against `shot=perf`; the jank walk of the new props (nothing through
anything, everything registered goes over); the items' proofs (each
kind picked up by E and its count seen); the train waits; the swim; the
colour measure on ten frames; the city's golden frames re-taken with
each change named and shown as better; errors clean at every start.
Report `docs/reports/O1b.md`. Hours, not days.
