# C3c, the cold player's findings (2026-10-03)

The critic of lane C3c (neon through the city; the line said from his seat
at the wreck). I played it before reading the owner's report, from the title
(`?start=tail`, `?start=tail.wreck`, `mute=1`), by real input through
`tools/play.mjs`, port 5343. My plays are in `tools/plays/critic/c3c_*.json`.
The frames are in `docs/story/review/wave-c/C3c/critic/`.

Verdict: the tail contest is still fair (it loses idle, the clumsy hands get
through on the third try, the good hands win twice), and the line from his
seat works. Two things stop it from being ready. **On foot at the wreck,
nothing but the two cars is solid: I walk through the river rail onto the
water and through the facades into the buildings.** And **the neon is in 5
of 12 frames of a drive, not "most"**, with none on the river road. Two
majors follow close behind them: the man's face at the window reads as a flat
mask, and E at his car does nothing.

## Findings, most felt first

### 1. BLOCKER: on foot by the wreck I walk through the river rail onto the water, and into the buildings

- **What.** Out of the car at the wreck, only the two cars stop me. I walked
  east across the river road, **through the rail and 24 m out over the
  river**, standing on the water with the quay wall and the rail behind me
  (frame 01). Going west, I walked **into the buildings' facades** and stood
  inside a block, with a black hatched screen (frame 02). What finally stops
  me is an invisible square 60 m round my car. One walk along his car's
  heading crossed the rail and stopped over the water at z 3.6, against
  nothing (the net's `maxZ` 3.98).
- **Steps.** `?start=tail.wreck`, E, turn to the river side (the side his car
  is against), hold W for 6 s. Play:
  `NOIR_PORT=5343 node tools/play.mjs tools/plays/critic/c3c_wreck_rail.json --size 1440x900`.
  It prints the eye's `d` in the road's frame: the rail is at d -9.6, and I
  ended at **d -24.1** on the east side and **d +24.1** on the west side.
  Also `c3c_wreck_line.json` part C, and `c3c_wreck_poke.json` (the "edges"
  walks).
- **Where.** `src/scenes/tail/chase.js` `walkNet` (about l. 873) widens the
  bounds by 60 m (`bounds.js walkAround`) and adds only the two cars' boxes.
  The comment at the top of `src/stages/city/parts/bounds.js` says "the lots
  and the rail as walls for a man on foot", but the file adds none of them.
  The rail (`track.js` l. 83, `'rail'`), the facades (`rect(... 'wall')`), the
  el's columns and the lamp posts exist only as the cars' track colliders.
  This came in with C3b's walking net, and C3c kept it. The owner's gate item
  5 ("his car, mine and the rail solid") is not true in play: the jank walk
  goes "along the road" for 4.5 s and never pushes into the rail or a wall.
- **Fix.** While on foot, put the track's statics within the net (tags `wall`,
  `rail`, `fence`, `column`, `post`, `truck`) into `stage.colliders` as boxes
  and circles, and take them out in `walkNet(false)`. Then close the two ends
  of the river road with something the player can see (a parked truck, the
  wharf market's stalls), or keep the net short enough that a wall or the
  rail is always what stops him. Add to `tail_jank_walk` a walk into the rail
  and into the west facade that expects the eye to stay at |d| < 9.6.

### 2. BLOCKER (ask 1, its measurable part): colour in 5 of 12 frames of a drive, and none on the river road

- **What.** I drove from the kerb to the wreck with the good hands and took a
  frame every 12 to 15 s of chase time, 12 frames in all. A sign's colour
  showed in **5 of 12**: the kerb (HOTEL blue), t36 (green), t60 (PALACE green
  with its streak), t75 (amber, small) and the crash (one blue, far). There
  was **none** in t12, t24, t48, t90 or t105, in the river road's first frame,
  or at the wreck. The river road is the chapter's climax, with the gun out
  for about 35 s. It showed no colour note in the three frames I took there
  (frame 04). The owner's six review frames were each taken at a sign, so
  they show the best case. Nothing is a carnival: the most saturated frame
  has 0.34 % of its pixels in colour.
- **Steps.** `NOIR_PORT=5343 node tools/play.mjs tools/plays/critic/c3c_cold_drive.json --size 1440x900`
  (seed 33). Look at `shots/c3c_critic/drive/d*.png`.
- **Where.** `src/stages/city/parts/neon.js` `SIGNS` (18 signs).
- **Fix.** Add 4 to 6 signs where the drive goes without one:
  - the first 30 s after the kerb, once HOTEL and BAR are behind;
  - Cooper / Market before the square, around t48;
  - the river road's middle and south stretch, between OYSTERS and the quay
    BAR (where he wrecks and where I shoot), including one far ahead on the
    river road that stays in view for seconds.

  Then judge the result by a timed sample like mine, not by frames taken at
  signs.

### 3. MAJOR: his face at the window is a flat pale mask

- **What.** At his window, the moment this ask is about, the head fills the
  frame. It is a flat, unshaded pale ball with two black eye dots, a dash for
  a mouth and a square "nose", sitting in a black window. The hand is a pale
  blob on the sill, and no hat or shoulders show (frame 03). From 4 m it
  reads as a white mask hung in the window. Nothing else in the game draws a
  face like this. The user asked for characters like the Hoods.
- **Steps.** `?start=tail.wreck`, E, walk round his car's tail to the side
  window, look at it. Play: `tools/plays/critic/c3c_wreck_line.json` part B
  (`shots/c3c_critic/line/b01..b03`).
- **Where.** `chase.js manAtWheel`: the `MeshBasicMaterial` at 0.032, the
  sphere head and the box nose and mouth (about l. 797-835).
- **Fix.** Use a cast head and hand: the watcher's kind, a bowler on, posed
  slumped against the frame and lit by the ink as every other figure is, not
  a MeshBasic disc. Or keep the face mostly in shadow (hat brim low, the lamp
  catching one cheek and the hand) so it reads as a man, not a mask. The
  owner's Left 1 names this. In play it is more visible than "simple" says.

### 4. MAJOR: E at his car does nothing

- **What.** The objective is "See to the driver.", and E means "use what I am
  looking at" everywhere else. My car stops behind his, so a first-timer
  walks straight at his boot. I was stopped there 4.1 m from his centre and
  pressed E: nothing. I clicked LMB: nothing. No prompt shows near his car.
  The line only comes within 1.5 m of a side window while looking at it, or
  once I walk away again. A player standing at the boot pressing E gets no
  answer to the one thing he is told to do.
- **Steps.** `tools/plays/critic/c3c_wreck_poke.json`. Look at the prints
  after "straight at his car's middle" and "E and LMB against his car":
  `prompt ""`, `line false`.
- **Where.** `chase.js atWreck` (the `WIN_NEAR` and `WIN_PASS` triggers only).
- **Fix.** Within about 2.5 m of his car and looking at it, show a prompt
  ("E  talk", or "E" on its own) and let E say the line. Keep the window
  trigger as it is. His head turning to me within 6 m is a good cue; give it
  a sound as well (a breath, a cough) so it reaches a player who is not
  looking.

### 5. MINOR: back in at once, and he says it from 16 m through my shut door

- **What.** E out, then E straight back in without going to him. The
  subtitle "Pier nine. Tonight." comes as the door shuts, from a man 16 m
  ahead. As a fallback it keeps the beat from getting stuck, which is fine,
  but it is not "said when I walk up".
- **Steps.** `c3c_wreck_line.json` part A (`line true`, mode drive, 0.5 s
  after getting out).
- **Where.** `chase.js getIn`: `if (!this.lineSaid) this.sayLine()`.
- **Fix.** If he was never near, do not take E at my door until I have been
  within the pass distance, with "See to the driver." still up. Or make the
  fallback the detective's own word over the radio-less quiet (for example,
  the objective going straight to "Pier 9." with no subtitle), so the line
  stays his and stays at the car.

### 6. MINOR (C3b's, not this lane's code): the good hands lost the river road's first try in 2 of 3 runs

- **What.** Both runs got through in the end:
  - In `tail_good` run 1, phase b began, the gun was never drawn, and
    "Lost him." came with my car at (55, -224). That is about 55 m west of
    the river road, 135 m behind him, with him unseen for 15 s. The hands
    left his route at the river road's start.
  - In my cold drive (seed 33), "He warned them." at 117 s, then a win on the
    retry.

  The owner's run had no fail. Either the good bot misreads the turn onto the
  river road, or a player would too. Worth one look by whoever owns the route
  (not a C3c change).
- **Steps.** `tools/plays/tail_good.json` (the fail list it prints).

## The three proofs (mine, on this branch's code, by real input)

| contest | idle | bad | good |
| --- | --- | --- | --- |
| the tail (streets, then the river road) | **loses**, hands off from the title: "He's getting away." at 17 s, "Lost him." at 19 s, back at the kerb (`critic/tail_idle_title`). The river with lazy hands does not win: W, RMB and LMB spammed with no aim (`critic/tail_b_wram` 2/2), and LMB with no aim (`critic/tail_b_noaim` 3/3). | **fails, then gets through**: "Lost him." in the streets at 53.6 s (warning at 47.6 s), "He warned them." on the river at 65.8 s (warnings "He's pulling away." and "He's nearly at the pier."), then a win on the 3rd try and chapter VII (`critic/c3c_bad`, 2/2). Never stuck, each loss with its word. | **wins twice**: `tail_good` 7/7 (run 1 after one river retry, run 2 clean); my seed 33 also got to the wreck. |
| the wreck (no contest: walk up, the line) | sitting still: nothing happens, "See to the driver." stays, "E  get out" stays. Fine. | E out and straight back in: he still says it (finding 5). | at his side window the line comes at once, "Pier 9." comes, E at my door, the pier. |

Cheats read (the lane's diff: `chase.js`, `07_tail.js`, `bot.js`,
`accents.js`, `neon.js`): nothing that wins for the player. No mercy, no
rubber band, no automatic action. The bot's walk changes live in `bot.js`,
which only the plays use. The only automatic thing is the fallback line on
getting back in (finding 5), which decides nothing.

## The user's asks

1. **Neon, colour notes in most frames, no carnival, glow + wall + streak,
   fps within 5 %: partly met.**
   - Each sign glows. Its streak in the wet road shows clearly (PALACE's
     green, the green sign at t36).
   - The wall gets a grey wash, not a coloured pool. The owner explains why:
     the ink floors saturated colour, and it reads fine.
   - It is never a carnival.
   - Not met: colour in only 5 of 12 timed frames, none on the river road
     (finding 2).
   - fps: see the gate below.
2. **The line from his seat when I walk up; nobody gets out; walking past
   brings it; E at my door and "Pier 9.": met in play.** Nobody is spawned.
   At his window the line comes within 1.5 m, and walking off within 4 m
   brings it (`tail_window_pass` 2/2). "Pier 9." comes at once, E at my door
   gets me in, and on to the pier. The face is a mask (finding 3), E at the
   car is silent (finding 4), and the line also comes from 16 m on getting
   back in (finding 5).
3. **Nothing else about the tail changed: met, except the walk.**
   `tail_good` 7/7, `tail_jank_walk` 4/4, golden (below). But the jank walk
   at the wreck does not hold when a player walks into the rail or a facade
   (finding 1). The owner's play does not walk there.

## Gate readings (mine)

- errors: every play above ended "no errors in #errlog". That covers the
  tail's start, chase2, river, wreck and pier, and VII's arrival.
- golden: 38 of 38 identical (37 on the full run; `still_photo` got no capture because headless Chrome hung under load, and it was IDENTICAL on its own re-run).
- fps, one session with the GPU busy from another process (`UNCAPPED=1`, 1440 x 900):
  - `shot=perf`: 47.2 fps, 782 calls.
  - The market square (`scene=tail&beat=start&t=1&tailAt=-150,-160,0.79,9`):
    **44.9 fps with the neon** (401 calls), **47.9 without** (`noneon=1`, 377
    calls). That is 0.95x against 1.01x perf: **6 % slower with the neon** in
    this reading. The owner's reading went the other way.
  - Both differences are inside a busy GPU's noise. The 5 % is not shown
    either way. The 24 calls are the cost. Measure again on an idle GPU
    before claiming it.
  - The river road was not measured (one reading only, by the house rules).

## What is good and must not be broken

- The tail contest as it stands. Idle loses with the warning first. Clumsy
  hands lose with a word and get through. Good hands win twice. Lazy river
  hands do not win.
- Nobody gets out of his car, and nothing is spawned. His head comes up and
  turns to me as I come near. The line comes at a side window, and as I walk
  off. "Pier 9." comes at once.
- The neon's restraint: blue, green and amber, no red, small boards, the
  streak in the road (frame 05, PALACE). It adds colour without fighting the
  ink. Keep it this quiet, just in more places.
- The two cars are solid on foot: never inside either car (`tail_jank_walk`,
  `tail_window`).
