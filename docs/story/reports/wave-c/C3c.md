# Wave C lane report: C3c, the city after the user played it (2026-10-03)

- branch `wave-c/C3c-city` (from `wave-c/integration` 2240c35), port 5343
- the brief: `docs/story/briefs/C3C_CITY_NEON.md`; the full report is the
  "C3c" section at the end of `docs/story/reports/wave-c/C3.md` (this file is
  the short handover; code marks `[C3c]`)

## Where things are

- The neon: `src/stages/city/parts/neon.js` (one part, order 195, tick 65:
  after the buildings and the sight). `SIGNS` is the list (x, z on the
  facade, its outward normal, kind blade / flat / window, text, colour, height,
  symbol, flicker). The colours are registry keys: `neon` (blue), and two
  new ones, `neonGreen`, `neonAmber` (`src/render/accents.js`, marked `[C3c]`).
- The line at the car: `src/scenes/tail/chase.js` `manAtWheel` / `wheelStep`
  (the man at his wheel), `atWreck` (the line's two triggers: `WIN_NEAR` 1.5
  m at his window looking at it, `WIN_PASS` 4 m walking off), `sayLine`.
  `manOut` and the crouched man are gone; `tail_crouched` / `tail_point`
  clips (cast/kinds/tail_trucker.js) are unused now.
- The hands: `src/scenes/tail/bot.js` `walkMark` / `walkLook` (to
  `chase.winAt`, eyes on `chase.winP`); `tools/lib/c3_tail.mjs` presses E at
  "get in" only once the line was said.
- Plays: `tail_window` (new), `tail_window_pass` (new), `tail_jank_walk`
  and `tail_good` (updated).

## How to look at it

- A frame from the seat anywhere in the city:
  `tools/shot.sh out.png "mute=1&scene=tail&beat=start&t=1&tailAt=x,z,yaw,0" 1440 900`
  (yaw 0 east, PI/2 north, PI west, -PI/2 south).
- The wreck: `?start=tail.wreck`, E, walk to his window.

See C3.md "C3c" for what plays, the numbers, the gate and Left.
