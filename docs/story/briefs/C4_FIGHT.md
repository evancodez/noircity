# C4 — chapter II The Fight: keep it, tighten it (and the brawl rules VII's boss inherits)

Branch `wave-c/C4-fight`, port 5344. You own `src/game/Brawl.js`,
`BrawlLesson.js`, `src/cast/brawl/*`, `src/ui/fightCards.js`,
`src/scenes/02_fight.js` + `fight/*`, `src/scenes/01_diner.js` and
`_diner_room.js` (two small things only), `src/cast/extras.js`,
`src/stages/block/parts/dinerFront.js` (the door), `docs/story/FIGHT.md`.

Read `docs/story/WAVE_C.md` (all), `docs/story/seams/Z.md` (the kit: the
teach card, the objective line, the fail), `docs/story/FIGHT.md` (version 4,
what is built), `docs/story/reports/wave-b/B8.md`.

The user on this chapter: "keep, tighten". He likes the fight. Do not
redesign it. Fix exactly what he felt, with the care the rest of it had,
and make sure nothing that works gets worse (the fight's plays and its
autoplay styles are your regression net: `tools/plays/fight.json`,
`slice.json`, `?shot=r2play&style=...`).

## 1. [must] People fleeing at the start go round me
"People fleeing at the start run through me. They go round."
The couple, the old man, the docker (`cast/extras.js`, the room clearing in
`02_fight.js` / `fight/start.js`): each has a way out that avoids me, Mack,
the stools and each other (a path planned round us, with steering: a
circle each; if lane C2's `game.bodies` is on `wave-c/integration`, use
it; if not, a small steer of your own that C2's can replace). They hurry,
they turn their shoulders to pass, one may flatten against the booths as
he goes by. Watch strips of each from my eye at every place I might be
(on the stool, already turned, stepped off): nobody through me, nobody
through Mack, nobody through a stool, a table or the door frame, and no
one waits in a queue at the door like a machine.

## 2. [must] The dodge: a short slowdown and a cue, every time
"Every time I need to dodge: a short slowdown and a cue showing which side
of the screen to dodge to. In the spirit of the Arkham games' cue, not a
copy and not an arrow. A small window: somewhat hard, not easy."
"The same cue and slowdown for things he throws."

(This replaces the older rule that slow motion belongs to the lesson only,
and replaces the chevron for thrown things.)
- **When**: every blow of his that must be dodged rather than blocked or
  simply out-punched (hooks, the haymaker, the rush, a swung stool, the
  bottle neck's thrust, every thrown thing), in every manner of his and in
  the Pier 9 fight. Decide for the small blows (his jab, the answer) by
  play: if a cue on every jab makes the fight a quick-time event, keep
  those to the body's tell alone. The fight must stay a fight.
- **The slowdown**: the world drops to about a third of speed at the
  moment his blow commits (`Game.slowmo` exists) and returns the instant
  I act or the window closes; sound goes with it (a held breath, the room
  ducked, a rising tick). Short: the real-time window is small, about 0.25
  to 0.35 s to press, tuned by play so a first-timer gets about half of
  them and a practised player nearly all. Never a pause; my hands and the
  look stay live at full speed.
- **The cue**: ink, not UI. Not an arrow, not a letter, not a button
  icon. It says "go that way" by the frame itself: for instance the side
  the blow comes from goes black (ink pressing in from that edge, as a
  brush loaded and laid on) while the safe side opens up white (a flare
  of paper, two or three speed strokes drawn toward it), with his fist or
  the thrown thing rimmed in white so I see what is coming. It should feel
  like a comic panel's emphasis. Design two or three, capture strips, pick
  the one a first-timer reads without being told, and that still looks
  like this game.
- **The answer**: A or D toward the safe side inside the window is a
  clean slip: the blow passes (seen: his fist through where my head was,
  the thing past my ear and breaking behind me), he is open, and my next
  punch is a counter (the existing half-again). The wrong side, or late,
  and it lands. S (back) saves me from some blows by the old rules but is
  not the cued answer. Blocking stays SPACE with its own rules.
- **Teach it**: the lesson's dodge card becomes this (a held teach: the
  first cue holds time until A or D toward the light is pressed).
- A dodge must really avoid the blow and go away from the swinging hand
  (the user's standing rule): check every blow's path against the slip.

## 3. [must] A click jabs at once; a better scheme for the heavy punch
"A click jabs at once. Today nothing comes out until I let go, because the
press might be a wind-up. Find a better scheme for the heavy punch."
His own design stands: the left button is the left arm, the right button
the right arm; a jab and a harder punch. What he felt (find it by playing
with real presses of 60, 120, 200 and 280 ms; a person's "click" is often
150 ms and longer): a press held past `hold.min` (0.12 s) turns into the
wind-up, and let go before the first level "the fist just comes home": a
normal click shows nothing landing.
- **The rule to meet**: the fist starts on the press, in that frame, and a
  jab always goes out and lands, whatever the press's length. Prove it with
  a play that presses at those four lengths, both buttons, thirty times
  each, and counts a contact within 0.08 s of every press.
- **The heavy**, a scheme that never delays or swallows a jab. A strong
  candidate: the jab is out on the press; if the button is still held
  after the jab has landed (about 0.3 s), the same fist comes back cocked
  and loads (the three ticks, as now); letting go throws it. So a click of
  any human length is a jab, and a deliberate hold is unmistakably a
  wind-up that starts from a jab that already hit. Try it against one or
  two others (both buttons together as the heavy; a hold that begins only
  while he is open) and keep what plays best. The wind-up must stay
  clearly seen and heard, and spamming must still not win.
- Update the lesson's cards and `FIGHT.md` (version 5) to the scheme kept.

## 4. [must] The diner's street door
"The diner's street door is a push door, locked during the fight. I can
only get outside after I knock him through the window."
- It is a push door from the inside: walking into it (or E) pushes it open
  outward on its closer and it swings back; from the street it is pulled
  (E). It moves by my push at the speed I push, it has a bell, it closes
  behind me, it never passes through me or anyone.
- During the fight it is locked, with a reason seen: as the room clears,
  the last one out lets it slam and the latch drops, or Mack throws the
  bolt before he comes for me ("nobody leaves"): pick the one that plays in
  the way in without slowing it. Tried, it rattles on the bolt (a sound, the
  door gives a centimetre, one word: "Bolted.").
- After he has gone through the window: I draw the bolt (E, the hand on
  it) and push out; or I go out over the sill of the broken bay if that
  can be made good (SPACE, the body's big move: only if it is clean; else
  the bay's jagged glass is the reason not to). Either way the objective
  line says where: "See to him."

## 5. [must] The Body is cut: the hint is on him
"Remove this chapter. Instead, on the man I knocked into the street I find
a hint that another detective is a mark (a short interaction or a still).
That sends me to the office."
- Out on the wet pavement, E search, the hands as built: the red
  matchbook (THE CARDINAL, the black bird) and, folded in it, **a
  business card: `J. AMES — PRIVATE INVESTIGATIONS — HARBOR BLDG. RM
  304`, crossed through in red** (the crew's red: `accent('crew')`; a
  grease-pencil cross, bold). It turns over in my fingers under the
  street lamp so I read it: legible at 1440 x 900 without effort, the
  letters big, the cross unmistakable. A new prop kind
  (`src/props/kinds/`), `amesCard`, into the inventory with `matchbook`.
- Then the still `amesCard` of WAVE_C §5 (`game.stills.play`; the picture
  itself is lane C9's: the kit's placeholder panel until then), the
  objective "Harbor Building. Room 304.", and `ctx.next()` to chapter III.
  The two far shots down the pavement go (they belonged to the Body).
- The matchbook's old use (the Body's torn half) is gone: nothing may
  still ask for `matchbookHalf` or `tornHalf`.

## 6. The diner (I): two small things, nothing else
- Mack's line carries the story now: he is there for her, not for me.
  Replace "You're the one asking about the Cardinal." with a line of at
  most eight words that says so (`She's got nothing to say to you.` or
  better). One line, as now.
- A guest check: when I pay (`pay`), Dot's hand has written the check on
  the diner's own pad (a small printed slip, `DINER` at its head, her
  pencil); it lies by my glass and I put a coin on it. A two-second look
  at most, no new key. The player will see that slip again, torn, in Ames's
  safe (chapter III): the paper and her hand must be the same design.
  Agree its look with lane C5 through a shared prop kind (`guestCheck`,
  yours: a canvas texture drawn by a function that takes the lines to
  write, so C5 can write `PIER 9 / MIDNIGHT / — DOT` on the same paper).
  The golden frames of the diner will change in `pay` only if the slip is
  in an accepted frame: keep it out of them if you can, say so if not.

## 7. The user's old boxing game
Look briefly at https://github.com/evancodez/shittyboxing.git (clone it
outside the repository, under /tmp, read it, delete it): "2D, harder and
less cinematic than this should be; it might help, it might not apply."
Take from it only what "smooth and fair" means to him (how fast a press
becomes a punch, how a dodge is timed and rewarded, how he shows a tell)
and write three lines on it in your report.

## 8. Pier 9's fight inherits all of it
The foreman's fight (`scenes/warehouse/fight.js`, `?start=warehouse.fight`,
`tools/plays/pier_fight.json`) runs on your rules: the cue on his hook's
blows and on what he throws, the jab, the heavy. Make it pass and look
right there too; lane C7 will build around it.

## Proofs and gate
WAVE_C §7. The contests are the fight's manners: `fight_idle` (hands off:
I go down, and down again; never a win), `fight_bad` (mashes jabs, dodges
late or the wrong way half the time: goes down once or twice, can still
win by learning), `fight_good` (reads the cue, slips, counters, loads the
heavy in his openings: wins twice in a row in two to three minutes). The
click-length play of §3. The door: try it at every moment of the chapter.
`slice.json` and `pier_fight.json` pass. Report
`docs/story/reports/wave-c/C4.md`.
