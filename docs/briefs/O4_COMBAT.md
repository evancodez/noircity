# O4 — combat: the crowd brawl, the guns in open ground, the shotgun, the gym and the gun shop

Branch `ow/O4-combat`, port 5374. Built and proven on the base's test
beds until the city (lane O1) merges: the kit's bed (`?start=kit`), the
gun range (`?start=guns`, `src/scenes/91_guns.js`, the killhouse
`src/stages/killhouse/`), the diner and the block (`src/stages/block/`)
for a street. The user's words:

- **[must]** "get into shootouts, fist fight (please change these
  mechanics to work better and smoother)".
- **[must]** The three bars (GAME_TWO §1): smooth (under 50 ms on the
  press, nothing locks me, hits read three ways), the middle, everything
  works.

What you build on: the gun kit (`docs/story/seams/GUNS.md`, `src/guns/`,
`src/enemies/`, `src/player/modes/gun.js`, `src/player/weapons/`), the
fist fight (`docs/story/FIGHT.md` v5.2, `src/game/Brawl.js`,
`BrawlCue.js`, `BrawlLesson.js`), the cast (`src/cast/`, kinds and
costumes), the pad. NOIR EXTREME's game two is bringing the fight to v6
at the same time (its brief `docs/story/briefs/G1_FIGHT.md`: the heavy
as a hold past 0.25 s released, the dodge window for a human hand (0.45 s
tightening to 0.3, a glancing late step), a hit-stop, nothing locking
over 0.25 s, the reel that ends, he tires): build those rules into yours
rather than waiting for them.

## 1. The crowd brawl (`src/combat/brawl/`)
One fight system for one to four opponents:
- **The one I face** is the one I look at (a soft lock within a cone;
  looking at another switches in 0.2 s, eased); the others circle at a
  ring (2 to 3 m), one steps in at a time (two at most at once, each
  with the cue), and a man behind me is announced (his sound, the cue
  from that side, the ink closing on that side).
- The verbs are the rulebook's (LMB / RMB the fists, a tap a jab, a hold
  the heavy; SPACE block; A / D the dodge with the cue and its short
  slowdown; E takes a bottle or a chair, LMB swings it once). Counters
  after a clean dodge or a blocked heavy; the opening is where the
  heavy goes; the lesson's logic of FIGHT.md §7 is kept as the cards'
  logic (once a save).
- Opponents of kinds: a drunk (slow, wild), a driver (the base's), a
  gangster (fast, feints), a cop (blocks well, grabs: `Hands up.` at the
  end if I am down), a boxer (the gym's: the best). Each tells before
  each blow; each goes down and stays down (or gets up once, slower).
- The fight ends by knockouts, by my fall (the hospital, or the station
  if a cop), or by my leaving (they do not chase for ever: a run of 30 m
  and they give up, warned `He's coming.` before and `He's gone.` after).
- The middle: `brawl_1v1 / 1v2 / 1v3` each `idle / bad / medium / good`;
  medium wins 1v2 in one to three tries; 1v3 is hard and fair.

## 2. The guns in open ground (`src/combat/guns/`)
- Cover from the world, not from a place's data: a function that finds
  cover (a solid between a man and his target, waist high or full) from
  the world's colliders (cars, pillars, crates, walls, doorways), used
  by me (crouch behind anything: the eye drops, RMB rises) and by them
  (the kit's men plan on it). Until O1 merges, the base's stages give
  the solids.
- Enemy kinds for the city: gang men (two costumes, revolvers and a
  Tommy gun among them), cops (uniform, a revolver; detectives with
  Tommy guns), each with the kit's tells, cover and flanks; they come
  from the pavement's graph when O1 merges (a seam named in your
  report), from the stage's nav until then.
- **The shotgun** (new, `src/player/weapons/shotgun.js`): two barrels,
  a spread that reads, a reload of two shells, devastating close and
  nothing far; its own ink in the viewmodel and the HUD.
- Health mends slowly out of fire (the base's rule); the hospital is the
  fail (`game.fail` with `why: 'Shot.'`, back on the pavement outside
  the hospital with the gun kept, the money less a little).
- The four proofs of a street shootout against four (the base's block
  street until the city): idle dies warned, medium through in one to
  three, good twice, bad by the fourth.

## 3. The gym and the gun shop (rules; the rooms are O5's)
- The gym's bout: a ring, a boxer of a level (three levels), a bet of
  `$`; win: the purse; the cards' logic once; a bot that fights fair.
  Until O5, a test ring in your bed.
- The gun shop: `$` for the shotgun, for boxes of rounds; the counter's
  prompt (E) and a card of prices in the game's lettering.
- `$` lives in `save.money` (seam for O7's HUD).

## 4. Proofs and gate
The brawl proofs, the shootout proofs, the shotgun's feel on the range,
the latency numbers (jab, block, dodge, fire, crouch, reload), the strips
of a jab, a heavy, a dodge with the cue, a shotgun blast, a man taking
cover; the jank walk of a fight in the diner (the furniture, the
bodies never blocking feet); golden identical (the base's frames; add
two of yours); errors clean on every bed; fps at 1v3 and at the four-man
street; the pad play of a brawl and a shootout. Report
`docs/reports/O4.md` with "For other lanes" (how a place starts a bout,
how a system spawns a fight, how cover is asked of the world). Hours, not
days.
