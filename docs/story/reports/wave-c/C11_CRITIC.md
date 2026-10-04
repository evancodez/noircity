# C11 — the cold player's report (the look pass)

Branch `wave-c/C11-look` at bdf6e85, played on my own server (5351), muted,
by real input from the title with `?start=<id>`, 1440 x 900. I played before
I read `C11.md`. My plays are `tools/plays/critic/c11_*.json`; frames are in
`docs/story/review/wave-c/C11/critic/`. Tone figures use the owner's own
thresholds (paper white = luma >= 230, mid = 64..191) unless marked.

To compare, I also ran the same plays once on the base build (887c23e,
unpacked from git into my scratchpad and served on 5351 while my own server
was stopped).

## Findings, most felt first

### 1. BLOCKER — The Cardinal's office is still blown-out white at its door and just inside it
The art director's frame ("the inside is blown-out white") is still what a
player sees at the moment he walks in. It is not the back wall any more. It
is **the office door's lit glass pane**.
- At the door, level eye, to press E: **73.6 % of the frame is paper white**
  (before: 81.8 %). The prompt `E OPEN` is printed white on that white and
  can hardly be read. Frame `01_office_door_pane_white.jpg`.
- One step inside, turning left to the desk as anyone does: the open door's
  pane is half a metre from the eye at head height. **69 to 95 % paper
  white** (desk direction 75 %, west 95 %; before: 88 to 89 %). The pane also
  stands between the doorway and the desk, so a player's first look at the
  room is a white sheet. Frame `02_office_inside_door_white.jpg`.
- Steps: `?mute=1&start=warehouse.office`, BEGIN, walk to the door (1.85,
  -41.75) and look at it level. E. Walk in to (1.85, -42.7) and turn left
  toward the desk. Play: `tools/plays/critic/c11_pier_office.json`.
- File: `src/stages/pier9/parts/mezz.js:291`: `pane = ... M.glow('officePane', 0.5)`
  on the door's pivot. It is one-sided: it faces the catwalk when the door is
  shut and faces the incoming player when the door is open into the room.
- The owner's measurement (`pose=1.9,-42.6,0.86,-0.3`, 6.7 % white) looks
  0.3 rad down, under the pane. A player at eye level does not look that
  way. The report says the pane is "as it was"; that is the problem.
- Fix direction: a frosted pane that the dark room lights only faintly (a
  dim grey with the desk lamp's glow in one corner), or no glow on its inner
  face once the door is open. Then measure at eye level, pitch 0, from the
  door and from one step inside facing the desk.

### 2. BLOCKER — The river road's ask is not met: too little white from the seat, flat grey on foot by the wreck
- **From the seat (phase b), paper white is 1.5 to 1.9 %** (r00/r01 hands-off
  from the river checkpoint, g1 mid-run). The brief asks for 5 to 8 %. The owner
  says so too (Left 1). Mid-grey is 19 to 21 %, which is fine. The sky over the
  far water is still a light-grey band left of the A-pillar, not black.
- **On foot by the wreck, mid-grey is 39 to 59 %** in the frames a player
  sees on getting out: g4 59 %, g5 57 %, at his back t1 39 %, t2 28 %. The
  brief asks for under 30 %. In g4 the near quay lamp's cone is a solid
  paper-white wedge filling the middle third. The road, the sky and the
  skyline are all light grey around it. Frame `04_wreck_on_foot_grey.jpg`. The
  owner's on-foot figure (21.8 % mid) comes from one pose.
- Steps: `?mute=1&start=tail.river`, play phase b to the crash (the good bot:
  `tools/plays/critic/c11_tail_b_good.json`), get out and look along the road
  at the wreck and the lamp.
- Files: `src/stages/city/parts/river.js:25` `RIVER_LOOK = { fog: 0.28, exposure: 1.35, refl: 1.6 }`.
  The exposure lift applies on foot as well as in the car, and on foot it
  greys the whole frame. `src/stages/city/parts/lamps.js:28,69`: the quay
  cones are x 2.4 in total (QUAY_CONE x RIVER_CONE) and blow out up close.
- Fix direction: keep the exposure lift for the seat only, or cut it on foot.
  Make the cones' x 1.5 depend on distance so a near cone is not a white
  wall. Measure white and mid from at least three on-foot views (getting out,
  at his door, at his back) as well as phase b.

### 3. MAJOR — The telephone still has no hand
The panel is a handset lying on the desk in a hard white ellipse, with an
empty cradle. It is composed, and the pool is now hard. But the brief (item
4) and WAVE_C §5 ask for **"a telephone receiver in a hand"** ("the receiver
and hand an ink shape"). There is no hand and no rain on the glass. The owner
lists it in Left 3. A first-timer reads "phone off the hook", not "a call
coming in". Frame `06_opening_stills.jpg` (top left). Steps: BEGIN from the
title with no `start`; this is the first picture of the game.
File: `src/debug/shots/C9_stills.js`, `tip()`.

### 4. MAJOR — R2's new skylight: the glass and its iron ribs disagree, and the glass is a flat white slab
At the water-tank slide on R2 (the most dramatic second of the roofs), the
new skylight fills the right of the frame. The two panes are a steep tent
(`rotateZ(±0.8)`, about 46°). The iron ribs are a shallow arch (0.48 m over
1.6 m, about 17°), so the black ribs run across and out of the white panes.
The panes are an unlit `MeshBasicMaterial` at 0.95, so they print as a flat
paper card with no frame line and no sheen. A pass-through a player sees at
speed. Frame `05_skylight_glass_vs_ribs.jpg`. Steps:
`?mute=1&start=watcher.over`, run the roofs to the tank (C to slide); or
`tools/plays/critic/c11_chase_roofs.json`. File:
`src/stages/backlot/parts/roofs.js:127-139`. Fix direction: one slope for
both (ribs following the panes' edges, or panes at the ribs' 17°), and the
glass a lit material (or a grey with the light coming up through it) so it
reads as glass and not as a card.

### 5. MINOR — The VII photograph still no longer matches the room it comes from
In play, her photograph now lies in a hard white pool on a blotter (frame
`03_office_desk_pool_good.jpg`, which is good). E `look` then cuts to the
still `photo_1.jpg`, which was not re-rendered: the photo lies in a soft
mid-grey hatched pool. The light changes at the cut. File: `public/stills/photo_1.jpg`
(C9 rig `tools/stills.sh`).

### 6. MINOR — The kitchen away from the hood lamp is one black room
The entry view is good: the hood lamp, the hard pool on the ranges, the cook,
the rest ink (k1: white 7.4 %, ink 80 %). On the run east (k2, k3) the frame is
96 to 98 % under luma 40 with 0 % white. Only the iron door's bulb remains
(which is right for the way out). "The pans catching it" is seen only in the
first second. Fine for play (the door lamp still leads), but the room's
second half is unlit dark grey walls. `src/stages/backlot/parts/kitchen.js`.

### 7. MINOR — The windscreen strip: better, but the glass is a pale card and the drops look like snow
The neon now lights the glass, the wiper's arc and the knuckles: a clear
improvement on the old near-black strip. Two things a player still notices:
- the lit part of the glass under DINER is a hard-edged pale rectangle
  between the pillars;
- the drops print as dense white specks over the whole screen, like static.

Frame `06_opening_stills.jpg` (bottom).

### 8. MINOR (from the code, not played) — the office's shootable lamp head is on the empty ceiling
`Lamps.hit` puts a lamp out only within 0.62 m of `lamp.head` (`src/world/Lamps.js:413`).
The office lamp's head is still the old ceiling point (0.2, oy1 - 0.3,
-43.9; `mezz.js:236`), while its light and bulb are now visibly the desk lamp
(0.8, oy0 + 1.12, -44.0). In the loud pass a round into the desk lamp should
do nothing, and a round into the bare ceiling above the desk should put the
desk lamp out. The bulb's distance to the head was already 1.6 m before this
lane, but now the room says the light is the desk lamp's. Worth one shot to
confirm.

### Not this lane, seen while proving it
- VI phase b, good hands (`tools/lib/c3_tail.mjs` good) with seed 11: lost
  once to "He warned them." before winning on the retry. Seed 7 won first
  time. The bad hands put him off the road in 18 s with no fail. This is the
  balance of C3's contest; no play code of it changed here.
- V from the `over` checkpoint, the good bot was blocked at the edge jump
  (its teach card lands at the jump itself). That is C6's checkpoint
  start-up.

## The proofs (mine, on the final code, by real input)
This lane changed no rule. I re-ran the contests in the places it touched:
- **VI phase b**, idle (hands off from the river checkpoint): "He's getting
  away." at 12.0 s, "Lost him." at 16.9 s (warned 4.85 s), back at the
  checkpoint. Good (seed 7): one tyre, the shunt, the line, Pier 9, a win
  with no fail. Good (seed 11): one fail, then a win. Bad: through on the
  first try.
- **V**, idle at the kitchen checkpoint: lost, warned first. W held from the
  kitchen: lost in the press, warned first. Good from the title over the
  roofs: won with no fail (100 s), into VI by the cut. Bad from the title: 9
  "Lost him."s, every one warned, through to the car in 3.5 min, never stuck.
  No fail in the kitchen.
- **VII** listen (hands off: the order through the glass reads, with the
  Cardinal a black shape on the blinds' bars), office (door, photo `E look`,
  still, drawer, shells, revolver full, "Get to the diner."): every prompt
  answered.
- Golden: `python3 tools/golden.py check` gives 38 / 38 identical (with
  `still_opening` as re-accepted). No golden frame covers the touched places,
  so this proves only that nothing else moved.
- Errors: every play ended with an empty `#errlog`.
- fps, once, GPU already 88 to 90 % busy from elsewhere: `shot=perf` 47.2,
  the office from its door 58.6 (1.24 x). The owner's report says 2.1 x for
  the same place. There is **no before reading** for the office, kitchen or
  roofs in either report, so "within 5 % of before" is not shown.

## Cheats
None in this lane's changes. I read every `src/` hunk:
- `chase.js` now writes the glow's wish instead of its scale (render only).
- The office's real light moved, but its stealth registry entry is unchanged.
- The chimneys' and roof house's visual heights changed. The sight
  raycasts at head height are blocked the same by a 2.7 m stack as by the old
  9 m column, so "Lost him." on the roofs is unaffected.
- The skylight glass is `noRay`.

## What is good and must not be broken
- **The desk under the lamp** (`03_office_desk_pool_good.jpg`): a hard pool
  on the blotter, her photograph with its red cross readable from 1.5 m, the
  desk's ends and the walls in ink, the blinds' bars on the back wall as the
  second light. It is the diner's rule and it works.
- **The listen beat through the window**: the Cardinal a black shape on the
  bright bars, the order readable. Keep the back wall's bars.
- **The chapter's first frame from the side door is unchanged** (measured
  before/after identical), so the goal across the shed is not lost.
- **The tail lamps up close**: at a graze (about 4 m), each is a lamp-sized
  red disc, no balloon. On foot after the wreck the lamps are out.
- **The kitchen's entry**: one lamp over the ranges, steam, the cook, ink
  round it.
- **The roofs' stacks at their real height** against the sky, and the lit
  skylight from R1 reading as "a lit skylight" at a distance.
- **III's corridor first frame**: darker between the globes, pools on the
  walls, the doors and STAIRS still read.
- **The telephone's hard pool and the windscreen's lit drops**: both better
  than before; keep them while adding the hand.

## The owner's Left list, as a player feels it
1. River road white 1.5 to 3 %: felt. Together with the on-foot grey (my
   finding 2), the river road is still the greyest place in VI.
2. No el lights beyond the roofs: barely felt; the skyline is there.
3. No hand on the telephone: felt at the very first picture of the game.
4. Kitchen steam grey outside the light: not noticed at a run.
5. III corridor still the greyest first beat: not felt; it reads fine.
6. fps without a before: not felt by a player, but the gate's ask is unmet.
7. The 5173 slip: not a player matter.
