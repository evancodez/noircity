# C7 — chapter VII Pier Nine: quiet, then loud, then fists

Branch `wave-c/C7-pier`, port 5347. You own `src/stages/pier9/**`, the
warehouse scene (`src/scenes/*_warehouse.js`, `warehouse/*`), the `sneak`
mode, the pier's cast, props, sounds and hands. The loud pass is built on
lane C2's gun kit (`docs/story/seams/GUNS.md`, `?start=guns`); the boss
fight on lane C4's brawl (`docs/story/FIGHT.md` version 5: the dodge cue,
the jab, the heavy).

Read `docs/story/WAVE_C.md` (all), `docs/story/seams/Z.md`,
`ARCHITECTURE.md` §10 (pier9, the stealth, the bay fight), the old lane's
reports `docs/story/reports/wave-b/B6.md`.

## What the user said
- **[must]** Clear from the moment I enter what I am to do.
- **[must]** First pass is stealth (take the men out quietly, or get past
  them to a place). Simple stealth rules, but ones I can read.
- **[must]** Then an escalation: a second pass where I can go loud (I find
  a gun, say).
- **[must]** Then a boss fist fight.

The warehouse looks right. What failed: he did not know what he was
there to do, and the rules of being seen lived in the code, not on the
screen. The place stays; the chapter is restructured into three passes of
the same shed, each with one clear goal.

## The story here (WAVE_C §4)
I come with an empty revolver (I spent it stopping the watcher), so it is
quiet by need. In the Cardinal's lit office on the mezzanine I find
**Dot's photograph crossed through in red** and hear the order: I had it
backwards; she is next. Shells in his desk. Out, loud if I like. The
foreman bars the way out at the loading bay: fists. Then to the car.

## Pass one: "Get to the office. Stay out of the light."
- **From the first second**: I come in at the door from the pier (where
  chapter VI parked me: the same gate, my coupe dark behind me). The
  first frame shows the goal: across the black shed, up on the mezzanine,
  the one warm-lit window with a wide shape moving on its blind. The
  objective line says it. If I press LMB: the hammer falls on an empty
  chamber and my hand puts the gun away ("Empty."): the reason for
  quiet, shown not told.
- **The rules, readable** (keep them to these; every one visible in the
  picture):
  1. **Light is being seen, dark is safe.** The floor is pools and black.
     My own hands show how lit I am (as built). Add what is needed so no
     player ever wonders whether he is hidden.
  2. **A man sees what his light shows.** Give every man who matters a
     lantern or a torch whose beam is his sight: what its cone falls on,
     he can see; outside it and out of the lamps, he cannot (keep a small
     honest margin at arm's length). So his vision is drawn on the floor
     for me to walk round.
  3. **Running is heard, creeping is not** (C / Ctrl: the same key that got me
     low behind the desk in chapter IV; here it is the quiet walk). A
     heard man turns his lantern to the sound.
  4. **They show what they think**, in posture and one sound each: calm
     (the round, a whistled bar), "what was that" (stops, lantern swings
     to it: I have a second or two to be elsewhere), searching (walks to
     where it was), sure (the shout). No meters, no icons: a body and a
     beam.
  5. **From behind, close and unseen: E** puts a man down quietly (and I
     lower him: the hands take his weight). A body left in a pool of
     light is found; in the dark it is not.
  6. **Things I can use**: a bottle thrown to turn a head (hold LMB for
     the arc, as built); the knife switch that kills a row of lamps; the
     hoist's load let go; a lantern I can put out. Each taught by its own
     prompt once.
- **Choice**: three ways across (the aisles; along the stacks' tops by a
  ladder; round by the loading bay's shadow) and two stairs. Take every
  man out, or touch no one: both must work, and feel different.
- **Caught**: the shout is the warning ("They've seen me."): I have a
  moment to break the line and get into the dark (they search, then
  settle, more watchful); if they close on me, the cosh, black, the last
  checkpoint (a few, silent). An idle player standing in a pool is caught
  within seconds; one who never leaves the dark and waits is never caught
  and never gets anywhere: the rounds must bring a lantern past every
  hiding place in time, so waiting is not a way to win.

## The office: the turn of the story
Through the window from the catwalk, then in by the door when he has
gone down the far stair to his car (I see the saloon's red lamps leave
through the big doors: he is on his way to the diner). On his desk under
the lamp: the photograph (E: it comes up into my hands: a waitress's cap
and curl, the apron, the face lost in the print's shadow; the red cross):
the still `photo` (WAVE_C §5: `NOT HIS GIRL. HIS NEXT.`). The order is
heard before he leaves, three subtitles at most ("The waitress talked."
"The diner. Tonight." "No one walks out."). And in the desk's drawer
(shut; it opens): **a box of shells**. E: the cylinder is filled, the rest
in my pocket: the revolver of the gun kit, full.
Objective: "Get to the diner."

## Pass two: out, loud if I like
The same shed, changed: a telephone rings in the office behind me, or a
man finds one I laid down, or I am simply seen: lamps come on along the
main aisle and the crew is looking for me with guns now (dock hands with
hooks keep back; the Hoods and two or three hands with pistols hunt).
"Get out. The loading bay."
- I may shoot my way out on the gun kit's rules (crates are wood and are
  chewed; steel drums and the hoist's block are not; a Tommy gunner on
  the catwalk pins the aisle), or
- I may still go quiet: the dark is still the dark, and **I can make
  more of it: lamps can be shot out** (a round spent for a pool of black:
  the two rule sets meeting: light is being seen). A shot is heard: they
  come to it.
- Fair both ways: the proofs below.

## Pass three: the foreman
At the loading bay my way out is his. He takes the gun out of the fight
at once with the hook (a cut on its black, the revolver skittering off
the planks into the water, my hand stinging): fists, as built
(`warehouse/fight.js`, the bay's things, the plank doors over the water),
on lane C4's rules: **the dodge cue on his hook's swings and on what he
throws**, the jab at once, the heavy. No lesson; the rules were learnt in
the diner. Check the difficulty as the second fight of a game: harder
than Mack, fair, two to three minutes, and losing is the brawl's own
rule. He goes through the planks into the river. Out by the side door to
the pier; my coupe; "The diner." `ctx.next()`.

## Proofs and gate
WAVE_C §7. `pier_idle` (stand in the door's pool: caught; stand in the
dark forever: a lantern finds me), `pier_bad` (runs, walks through a
pool: caught once or twice, gets there), `pier_ghost` (touches no one,
reaches the office), `pier_hunter` (takes them all, reaches the office),
`pier_loud` (shoots out: wins at a human pace, twice), `pier_dark` (pass
two without being seen, a lamp or two shot out), `pier_loud_idle`
(stands in the lit aisle: down in seconds), the fist fight's three
(idle, bad, good). The jank walk: every aisle, stair, ladder, door and
edge of the pier (water is an edge: a rail or a drop I cannot take).
Report `docs/story/reports/wave-c/C7.md`.
