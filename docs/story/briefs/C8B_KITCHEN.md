# C8b — the diner's kitchen is a room, and the back way in

Branch `wave-c/C8b-kitchen`, port 5348. Chapter VIII (lane C8, merged:
`src/scenes/09_shootout.js`, `scenes/shootout/{nick,street,boss,rig,rails}.js`,
report `docs/story/reports/wave-c/C8.md`) left two things short of the
brief: the kitchen is a painted hatch, so (1) the nick of time has no
"round by the alley and the kitchen's back door" way in, and (2) the
flank is a man up at the hatch rather than a man through a door behind
me. Build the room; keep everything else.

## 1. The kitchen (the block stage, `src/stages/block/parts/`)
Behind the diner's back wall, through the hatch and a swing door at the
counter's north end: a small kitchen (ranges under a hood, a prep table,
shelves of pans, a cold store door that is locked and rattles, a single
lamp over the ranges: the look of the chase's kitchen, one light and
ink) and **a back door onto the alley** (the alley part exists:
`parts/alley.js`, hidden until a scene shows it; show the stretch from
the alley's mouth to the back door, with its wall lamp and bins). Both
doors are the kit's doors (open, close, 'hold'): the swing door swings
both ways and comes to rest; the back door opens outward onto the alley
and has a bolt on the inside. The cook is not there tonight (the room is
empty, a pot still on). Sized so a man can come through it and so the
player can go round the counter's north end into it; the counter's
south end stays the only other way behind the counter.
The golden frames of the diner must not change: nothing new is drawn
where the accepted frames look (ARCHITECTURE §9: the kitchen is behind the
hatch wall; check `diner_settle`, `diner_order`, the street frames, and
hide the kitchen's interior until VIII as the alley is hidden).

## 2. The nick of time's third way (nick.js)
From the kerb: down the alley's mouth (it reads: the wall lamp, the bins,
the crate of empties already there), the back door (E: unbolted from
outside? no: it is on the latch tonight, it opens), through the kitchen
low (C), the swing door eased open a hand's width (E holds it; the hatch
shows Sal's back), and E from behind. Nicky at the front never sees this
way; Sal hears a run in the kitchen (the pans) as he hears one in the
room. Keep the door way and the window way as they are; the bottle way
may now also draw Nicky to the alley's mouth.

## 3. The flank through the kitchen (street.js, the flank beat)
The kitchen man comes **through the back door and the swing door**: the
back door's crash (heard), Dot's "Kitchen!", the warning, then the swing
door bangs open and he is in the aisle behind the counter with a line on
me and on Dot. A player who bolted the back door from inside beforehand
(E on the bolt during the gun beat: a choice) hears him kick it twice
and come round the front instead, later. The hatch stays a hatch.

## 4. Proofs
`block_nick` gains the kitchen way (won by real input); `block_idle` and
`block_good` unchanged in result; a jank walk through the kitchen (the
swing door never through me or a man, the back door's leaf stops on a
body, the cold store rattles, the hood and table solid); `block_bolt`
(the bolted door: he comes round the front). Golden identical; errors
clean on VIII's beats; fps at the flank beat against perf.
Report: a "C8b" section appended to `docs/story/reports/wave-c/C8.md`.
Hours, not a day.
