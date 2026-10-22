# G1 — II The Fight: smooth, in the middle, and more

Branch `game-two/G1-fight`, port 5361. Chapter II as built by lane C4
(`src/scenes/02_fight.js`, `scenes/fight/*`, the system `src/game/Brawl.js`,
`BrawlCue.js`, `BrawlLesson.js`, the rulebook `docs/story/FIGHT.md` v5.2,
the report `docs/story/reports/wave-c/C4.md` and its `Left`; lane C12's
pad note in `C12.md` Left 2). The user's words for this lane:

- **[must]** "the fist fighting section": "making the gameplay feel
  smoother", "more fun and more easy to grasp as somebody who's just
  playing it. It doesn't necessarily mean zero skill."
- **[must]** "You also don't want to bombard the user with exactly how to
  do it either. A huge thing in the middle."
- **[must]** "Adding more to it."
- Still binding from wave C: a click jabs at once; LMB the right arm, RMB
  the left; the dodge cue with the short slowdown (Arkham's spirit, not an
  arrow) for his blows and for what he throws; fleeing people go round
  me; the street door locked until he goes through the window.

Read `docs/story/FIGHT.md` whole before touching the system, and keep it
the one system (VII's foreman is the same fight in another room).

## 1. Feel (GAME_TWO §1 A), measured
1. **Latency.** Press to the first frame of the jab, the block, the dodge
   step: under 50 ms, measured with the play tool and written in the
   report. Anything in the chain that waits (a queue, a cooldown that eats
   a press, an animation that must end) is found and changed so the press
   acts and the animation catches up.
2. **Hits read three ways.** A landed blow of mine: his head or body
   snaps, a hit-stop of 60 to 90 ms on both of us, a small kick of the
   frame, the sound; a heavy that lands: longer, and he staggers a step.
   His blow on me: the frame's ink closes a touch on that side, the eye
   jolts, the sound, and my guard shows it. Judge it on the strips.
3. **The heavy makes sense.** Today a held press winds up and the player
   cannot tell what he bought. Make it one clear scheme and write it in
   FIGHT.md §2: a tap is a jab on the press; a hold past 0.25 s is a heavy
   that goes on the release (or at 0.6 s if still held), telegraphed, and
   it is what finishes an opening (a dodge, a block counter, his tiring).
   Into his guard a heavy is punished more than a jab (the lesson of C4
   stays). The viewmodel shows the wind-up so the player knows which he
   is throwing.
4. **The dodge window for a human hand.** C4 tuned the cue against bots
   (0.34 s real at a third speed). Tune it against a hand: wider at first
   (0.45 s), tightening by 0.03 s each clean dodge to a floor of 0.3; a
   late dodge still half-works (a glancing hit, less damage) rather than
   nothing. The cue's side must be unmistakable in the ink (the strip
   shows it). The same for a thrown bottle.
5. **Nothing locks me.** My feet keep moving through a jab and a block;
   a heavy slows them; a stagger from his heavy takes 0.25 s at most.
   The camera never pops (a hit-stop is a hold, not a jump).

## 2. The middle (GAME_TWO §1 B)
1. **Length and losses.** Today medium hands take 3 to 5 minutes and go
   down 6 to 10 times; slow pounders never get through. The bar: a
   `fight_medium` run wins in 90 to 150 s with 1 to 3 downs; `fight_bad`
   (the pounder who learns a little) gets through by the fourth down;
   `fight_good` in 60 to 90 s with 0 or 1; `fight_idle` loses every
   exchange, warned, and never wins. Levers: his health across the
   rounds, the opening's length, the mercy that grows his openings after
   a down (it must never land a blow for the player).
2. **He tires visibly.** After each round he is slower to close his guard
   and his openings last longer (the ink: his guard sags, his breath);
   `He's tiring.` once from the kit. A player who has been pounding his
   guard sees why hitting the opening is the way.
3. **Cards and the nudge.** The first jab, the block, the dodge, the heavy:
   one card each at its first need (the dodge held, as now), nothing
   else. The nudge (§1 B4): a player who has thrown eight punches into his
   guard without one into an opening gets the opening card again, once;
   a player who has not dodged his last three cued blows gets the dodge
   card again, once. The fail's black names the one thing: `Into his
   guard. Wait for the opening.`, `Too slow. Dodge when it slows.`, as now
   but at most six words.
4. **The reel must end.** Lane C12 saw a reel that ran ten minutes (he
   reeled, both sides open, and never reached the window). The reel is a
   state with a way out whatever I do: if I do not finish him in 12 s he
   recovers (round 3 again, warned `He's coming back.`); if I do, the
   window. Prove it with hands that stand still in the reel.

## 3. More
1. **The room in play.** The bottle he throws is in; add what I can do:
   a bottle on the counter (E takes it; LMB swings it once, it breaks on
   him for an opening; he can dodge it), a stool he kicks at my legs (the
   cue; SPACE hops it or it staggers me), a table that goes over when a
   body goes into it (Breakables), the glass of the window at the end
   (already). Each a thing the kit can do in a few strokes, physical,
   never through anything.
2. **A second man, short** (if it plays; say so if not): outside, after
   Mack goes through the window and before the matchbook, his driver
   comes at me by the car: thirty seconds of the same fight, no lesson,
   no cards (they were taught), he goes down to one heavy into an
   opening. It is the first use of the verbs without help, and it makes
   the street a place. If it does not play in the time, leave it and
   write what is missing.
3. **The pad** (`tools/plays/pad_fight*.json`) still wins by the pad.

## 4. Proofs and gate
`fight_idle`, `fight_bad`, `fight_medium` (new, the critic's medium
profile from `tools/plays/critic/`), `fight_good` twice, `fight_reel_idle`
(the reel ends by itself), the pad play; the latency numbers; the strips
of a jab, a heavy, a dodge, a hit taken, looked at; the jank walk of the
diner during the fight (the fleeing people, the tables, the door that
rattles, the window). Golden identical (the diner's frames are game one's;
if the fight's first frame changes on purpose, name it). Errors clean on
every beat. fps at the window. FIGHT.md brought to v6 with what changed.
Report `docs/story/reports/game-two/G1.md`. Hours, not a day.
