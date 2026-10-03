# C9 — the stills: the cold player's report

Played on `wave-c/C9-stills` at daa51c0 (port 5349, muted), before reading
`C9.md`. Plays of my own in `tools/plays/critic/`: `c9_cold_open.json`
(BEGIN, hands off the opening, frames as it lands, the run's length, the
diner coming up), `c9_ames_inplay.json` (`?start=fight.matchbook`: the card
read in my fingers by E, the AMES. MARKED. still, on into III), `c9_poke.json`
(mashed clicks, W, mouse, 1/Q/F/M, ESC once, ESC again late). Also the
owner's `stills.json` once (17 of 17, every page looked at), `kit.json`
(19/19), `slice.json` (35/35), `golden.py check` (38 of 38 IDENTICAL: the
32 old and the 6 still pages), `CHECK=1 tools/stills.sh opening_1 end_1`
(byte-identical). No errors in any errlog. Frames:
`docs/story/review/wave-c/C9/critic/01..05`.

The three proofs (idle / bad / good) do not apply: nothing in this lane can
be won or lost. What a still can do to a player is confuse him, bore him,
or eat his input; that is what I judged.

## Findings, most felt first

### 1. BLOCKER (ask 1) — THE DINER is the tail's bonnet camera, not a composed picture
`public/stills/diner_1.jpg` (preset `still_diner_1`, `src/debug/shots/C9_stills.js`),
frame `04_the_diner_bonnet_cam.jpg`. Steps: `?still=diner&panel=0`, or
`stills.json`'s frame `s05_diner`. What I see: the view over my coupe's
bonnet down EL AVE that I drove for ten minutes in VI: the el's arches, a
row of parked cars, five lamps with their cones, a car ahead, a wall of
brush texture on the right, the neon a small blue word in the middle
distance. It is mid-grey all over, has five-plus lights, and nothing is
close: it is exactly what the user said the stills must not be ("composed
pictures, not random screenshots ... mostly shadow, abstract, or close").
Fix: close and dark. One idea: black frame, my headlamps' two cones on the
wet road only, the el's one column edge-lit, the neon small at the end of
the cones (one lamp, nothing parked). Or the bonnet ornament / one headlamp
close, the neon reflected in its chrome.

### 2. MAJOR (ask 1, 4) — The opening's first picture does not read as "a phone call" in one second
`opening_1.jpg`, frame `01_opening_page_cold.jpg` (the left top panel).
The first picture of the game. The receiver is a vertical black stick with a
ball on top held upright like a torch or a microphone; the cradle is cut off
at the bottom edge in a white blob; the hand is the rig's blocky
square-fingered mannequin hand, a third of the panel, the first thing the eye
lands on. The rain on the glass is round white dots: it reads as snow or
bubbles. The window behind is a big mid-grey square, so the panel is not
"mostly shadow". Fix: the handset lying across the hand on its side (ear
cup to the ear's place, the mouth cup down, the shape every player knows),
or no hand at all: the handset off its cradle on the desk in the lamp's cone,
the cord coiled; streaks, not dots, on the glass; the window darker.

### 3. MAJOR (ask 5) — Ames's card: bare pale hand in play, a black glove four seconds later
Frame `02_ames_play_vs_still.jpg`. Steps: `c9_ames_inplay.json`
(`?start=fight.matchbook`, BEGIN, E, E). In play I hold the card in my bare
white hand under the street lamp ("E put away"); the still that follows 4 s
later shows the same card in a black glove so big and dark it reads as
someone else's hand (one of his men?). The owner chose the glove (C9.md,
"Gloves") because the bare hand prints blocky; but the player has just been
looking at that hand. Also the still is nearly the same frame as the play
moment (card centred, lamp above, the diner's wall): it repeats, it adds no
picture. Fix: the bare hand as in play, shot so that only the thumb and two
fingertips are in (the blockiness is the knuckles), and a framing the play
cannot give: lower and darker, the card catching the only light, the
diner's door black behind.

### 4. MAJOR (ask 5) — The check in the still is not the check C5 makes me piece together
`check_1.jpg` (`tear()` in `C9_stills.js`), frame `03_check_page.jpg`. The
still's check is torn in three: one tear across between PIER 9 and MIDNIGHT,
one down through MIDNIGHT and DOT. Lane C5's puzzle (`wave-c/C5-office`,
`src/scenes/office/check.js`) tears it in seven: three across (30 %, 51 %,
69 % from the top) and one down through each of the top three bands. A
player who has just slid seven pieces together sees a different check in
the panel. Fix: draw C5's tears (its `pieces()` / `hcut` / `vcut` are fixed
and exported-able), or shoot C5's assembled puzzle on Ames's blotter.

### 5. MAJOR (ask 4, out of this lane but it decides it) — In play, only two of the six runs exist
`git grep "stills.play" wave-c/integration -- src/scenes`: only the
opening (Game.start) and `ames` (02_fight.js:551). `check` is played only on
the unmerged `wave-c/C5-office` (04_office.js:174); `photo`, `diner`, `end`
are played by no scene on any branch, and `dotPhoto` is on no desk. The
through line (the tip ... the hat) can only be followed in the panels today,
not in the game. Not this owner's code to fix, but his report's "For other
lanes" should say it as a list C10 checks: C5 `check` (there), C7 `photo` +
`dotPhoto` under the Cardinal's lamp, C8 `diner` and `end`.

### 6. MAJOR (ask 1, 2) — The end and the opening's strip are busy city frames, not one light
`end_1.jpg` (frame `05_end_red_taillamp.jpg`) and `opening_3.jpg` (frame 01,
the bottom strip). The end: the hat is a glossy cylinder-crowned pot with a
hard specular, a quarter of the frame, against a full avenue of parked cars
and six lamps; the road is grey-and-white "cow pattern" blotches; the cigar
in the foreground is as big as the hat's crown and reads as a crayon. The
strip: the darkest and busiest of the nine (the owner says so): pillars,
dash, wiper, wheel, brush noise everywhere, the eye finds the neon only
because it is the one colour. Fix: the end close and low on the hat alone,
the brim's edge rim-lit by one lamp behind, the street black with one
reflection, the ember small beside it; the strip with the cabin black
(pure silhouette of the wiper and the wheel's top) and the neon bleeding
through the wet glass.

### 7. MINOR (ask 2) — Stray red in the end panel and on the check
`end_1.jpg` has a parked car's red tail lamp and its smear in the wet road
(right, x ~1240-1340, y ~450-690 of the 1440 file): a second red besides the
ember, and red means his crew everywhere else. `check_1.jpg` carries the
slip's printed red (`No 4417`, the red margin rule through PIER 9): it is
the game's own prop, so acceptable, but on Dot's check a red line through
her words is a false cross to a player taught that red = marked. Fix: the
tail lamp off or out of frame; consider printing the check's rule and
number grey (lane C4's prop: a shared file, ask C4/C5).

### 8. MINOR — The second panel's hats, the "714"
`opening_2.jpg`: the best of the nine (the apron the one white shape, the
two coats framing it). But the front men's hats sink into the black window
band (no edge light on the crowns), so "three hats" reads as "three coats";
and the big "714" over the door is the brightest flat thing in the panel and
pulls the eye first. Fix: a rim on the hat brims from the room's light; the
number darker or out.

### 9. MINOR (kit, C1's file the lane edited) — "esc again skips" stays after it stops being true
`src/game/Stills.js:153-156`: two ESCs within 1.2 s skip; after one ESC the
hint changes to `ESC AGAIN SKIPS · CLICK GOES ON` and stays. A player who
reads it and presses ESC 2.5 s later gets nothing (`c9_poke.json`: the run
ended by itself, `skipped: false`). Fix: put the hint back after 1.2 s, or
let the second ESC count while the hint says so.

### 10. MINOR — The photograph is small in its frame
`photo_1.jpg`: the photo is a quarter of the panel's width; most of the
frame is a flat grey desk pool. It reads in a second as "a crossed-out
photograph", less fast as "of the waitress" (cap and apron are small). Fix:
closer, the photo a half of the frame, the desk black past the pool.

## The user's asks for this lane

1. Composed, mostly shadow, close, one light, no faces, one second:
   **not met** for `diner_1`, `end_1`, `opening_3`, and `opening_1` (does not
   read); met for `opening_2`, `check_1`, `check_2`, `photo_1`, and `ames_1`
   (composed, but a repeat of play). No face is shown anywhere.
2. The same hand, black and paper white, one accent with meaning: **met,
   with exceptions**: everything is the ink pipeline (byte-reproducible by
   `tools/stills.sh`), the crosses and the ember are the accents; the blue
   neon is DESIGN.md's own accent; the end's red tail lamp and the check's
   printed red are strays (finding 7).
3. Few and short: **met**. Three panels on the opening page, one or two
   elsewhere; captions at most five words; the opening hands off ran
   9.75 s (under ten, by a quarter second); a click moves on, four mashed
   clicks moved one panel only (the 0.4 s guard); ESC ESC skips; W, the
   mouse, 1/Q/F/M under a run neither skip nor move a panel.
4. A through line from the panels alone: **met in the panels, not in the
   game** (finding 5). One wrinkle a stranger trips on: `A TIP. AMES.` then
   `HIS MEN.` reads as Ames's men (the captions are WAVE_C's; a red accent on
   the crew in panel 2, a hat band, would tie "his" to the red that follows).
5. The game's own props: **partly**: Ames's card is the prop (but held in
   a different hand, finding 3); the check's tears differ from C5's
   (finding 4); `dotPhoto` exists but nobody has put it on a desk yet.
6. Nothing else changed: **met**. `kit.json` 19/19, `slice.json` 35/35,
   golden 38/38 identical (32 old + 6 pages), errlogs clean. The two shared
   edits (`drawGuestCheck` fit, `Stills.js` redraw) are fixes and marked.

## Cheats
None: the lane has no contest. The `Stills.js` change only redraws a loaded
picture; a still holds the game still, so nothing is won or lost under it.

## Good, keep it
- Every picture is rendered through the game's ink and reproduced byte for
  byte by `tools/stills.sh`; the six pages are golden.
- `opening_2` (the apron the one white shape between two black coats),
  `check_2` (her back-lit shape, the face lost, the clock), and the check's
  words (PIER 9 / MIDNIGHT / — DOT legible at a glance).
- The two red crosses are drawn by the same strokes (`crewCross`): the card
  and the photograph rhyme.
- The run's feel: panels land with a paper sound, the drift is unnoticed,
  a mashed click never skips one unseen, ESC ESC skips, the diner comes up
  out of the black with "LIGHT UP." and control at once.
- The opening under ten seconds.
