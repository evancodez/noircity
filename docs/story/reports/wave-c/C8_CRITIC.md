# C8 — VIII The Block: the cold player's findings

The critic of lane C8 (did not build it). Played on `14eb9e9` (wave-c/C8-block),
dev server on 5348, every run muted, by real input (`tools/play.mjs`; the
owner's drivers `tools/lib/c8_nick.mjs` / `c8_block.mjs` for the bots, my own
plays for the rest: `tools/plays/critic/c8_*.json`). Frames:
`docs/story/review/wave-c/C8/critic/`. Played first, read the owner's report
last.

## The proofs, mine (one run each on this code)

| contest | idle (hands off) | bad (stands at a window holding the trigger, then the clumsy hand) | good, twice |
| --- | --- | --- | --- |
| the nick (`dot`) | lost: 'He's going to shoot her!' up 7.5 s, **Too late.** | seen at the door (**They saw you. Too late.**, warned 1.4 s), too slow through the bell (**Too slow.**, warned 2 s), through by the window on try 3 | door 25 s, bottle 13-15 s, window 9-11 s, each first try |
| `cars` | down in 21 s, warned 4.2 s | died standing (try 1), won as clumsy (try 2) | won, 44 s / 49 s |
| `flank` | down, warned 6.6 s | died (1), won (2) | won, 30 s / 27 s |
| `el` | down, warned 13.7 s | died (1), won (2) | won, 45 s / 36 s |
| `saloon` | down, warned 2 s | **won on the first try by the stander** (53 s, 20 hp left) | won, 61 s / 68 s |
| `cardinal` | down, warned 1.6 s ('His gun! Get down!') | died (1, 2), won (3) | won, 45 s / 52 s |
| `last` | **He got to Dot.**, warned 10 s | won first try in 3.9 s | won, 6 s / 5 s |

Good: 0 falls in both runs, ~4 min 05 s of fighting each (game time, from the
kerb; the driver jumps the `gun` beat and the end), so a whole run is about
five minutes. Every play's errlog clean. Golden 38/38 identical. Frame rate:
`scene=shootout&beat=el` (the drive-by, the el gunman) 58.9 fps against
`shot=perf` 59.6 at the same moment: 0.99 x (both at the vsync cap, the GPU
65-93 % busy from elsewhere: only the ratio means anything).

## Findings, most felt first

### 1. BLOCKER — a drum from Dot freezes me where I stand until I am shot dead, and the fall gives the wrong reason
Steps (`tools/plays/critic/c8_drums_switch.json`, reproduced 2 of 2):
`?start=shootout.cars`, look down at the counter: `E a drum` is up at once;
E (Dot slides it, reserve 3). Hold LMB until the drum is empty, R. Look at the
counter, E again (she slides another; on this take the step-in moves me to
x -13.3). Now W, A, S, D and C do nothing: position fixed at (-13.30, 0.85),
`crouchK` 0, `controller._ease` still set. Health 100 -> 83 -> 0 in about three
seconds standing; the black says **They came round on you.** (frame 01). I
could not move, so the reason is false and the loss is for no reason.
Why (code): `Controller.ease()` holds the eye at its pose until something
clears it, and `Controller.js:404` clears it only in `'walk'` mode. The drum
take (`09_shootout.js` `drumsGen`: `hold()` at 484 every frame, the step-in at
384, the final `C.ease(...)` at 527) runs in `'gun'` mode and nothing clears
the ease after it (the gun take is saved by its `C.setMode('gun')` at 355).
Very likely every drum take freezes, the first too (I did not try to move
after the first). The owner's good bot never needed a drum, which is why no
proof caught it. Fix: clear the ease at the end of `drumsGen` (or end the
step-in with `setPose`), then play: take a drum, walk, crouch, take a second,
walk.

### 2. BLOCKER (ask 3) — drums are not few: Dot's are endless and offered at the first second
Same play: the fight starts with 2 drums carried and the maximum is 3, so
`E a drum` is up the moment the first fight begins, at the checkpoint's own
spot (frame 02); after every reload it is up again; each time she says
"Dot: Last ones." and it never is the last. Ammunition is never a decision;
going back to the counter costs a few steps from where the checkpoint puts
me. (`09_shootout.js` `registerProps` `b7.drums.when`: `R.reserve <
RESERVE.max` and nothing else; `rig.js:26` `RESERVE = { start: 2, max: 3,
slide: 1 }`.) Make them few: a count of slides for the chapter (two or three,
said by her: "Two left." ... "That's the last."), offered only when I have no
drum left, or start the fight with one.

### 3. BLOCKER (ask 3) — two of the street's named things are not in it: the kitchen flank and the hydrant
- **No flank through the kitchen.** The ask: men from more than one side
  *including the flank through the kitchen, with a warning*. Built instead: a
  man round the corner from the alley, up the pavement, in at the front door
  (the bell, "Dot: The door!") and two down the north pavement. The man
  through the front door is a fine flank, but it is the same door I watch;
  nothing ever comes from behind the room. The hatch behind the counter is a
  painted backdrop (owner's Left 2). Either build a back door (a door in the
  back wall at the counter's south end that crashes open, "Dot: Kitchen!", a
  man through it from the alley) or take the substitution to the user as a
  named change. As it stands the ask is not met.
- **No hydrant.** Searched the block in play and the code: no hydrant you can
  shoot, none on his way (owner's Left 4). The ask lists it with the burning
  car and the light switch as "the street's own weapons that matter".
- (Also not played by me, built by rule only: the light switch's dark room and
  a car shot until it burns - the owner did not play them by real input either,
  Left 9. My walk to the switch from the counter was stopped by finding 1 before
  I reached it. Someone must play both by hand before the user does.)

### 4. BLOCKER (ask 8) — the last frame has neither Dot at the broken window nor the diner in it
`?start=shootout.end`, hands off: 'WASD out to him' after 9 s, then the eye
goes down by the hat. The frame (frame 04) looks down the avenue *away* from
the diner: the hat at the bottom edge, the ember a small orange point, parked
cars and the el. Dot walks to the window (`dotToWindow`) but is behind the
camera; no train in the frame 6 s in. The ask: "his hat in the wet street, the
ember, Dot at the broken window, the el going away". `theFrame`
(`09_shootout.js` 804-838) picks the eye from the hat's `view` direction;
turn it so the diner's front is behind the hat (the hat in the foreground, the
broken window with her shape in it beyond, the el overhead), and cue the train
so it is in the frame when the camera settles. The still `end` (hat, ember) is
fine as it is.

### 5. MAJOR (ask 6) — the Cardinal's first stage is won by standing and spraying; the lamps and the tyres do not matter
The stander (window, trigger held) won `saloon` on his first try. Reason: the
saloon stops by itself at the end of its rail (`boss.js:34`, rail ends at
(-2.4, -9.5); `saloonBeat` waits for `stopped || c8flat || held`) so its tyres
never need shooting, the glare only costs aim, and the stage is "kill two
Tommy heavies" (hp 220 each) who walk up the open road behind it. Make the car
the problem: it does not stop by itself (it rolls up to the door, its lamps in
the room, the heavies firing from behind its armour until the tyres or the
lamps are shot; or it drives into the front and the stage is lost), so that the
lamps and tyres are what you must do, not what you may do.

### 6. MAJOR — the el: "Stay down. Let it mend." while the man on the el kills me down there
`?start=shootout.el`, C at the checkpoint (behind the counter's end): the
kit's hint "Stay down. Let it mend." comes up while the el gunman's bursts take
me 60 -> 28 -> 0 crouched (frame 03; his own warning "Up on the el! Get under
something!" shows a moment later). Two lines tell me opposite things in the
same second and the one that came first is wrong here. Silence the kit's
"stay down" hint while the el gunman has a line on me (or make it "Not from
him. Under the ceiling!"). The checkpoint itself puts me where he can kill me
crouched: give `AT.el` a place under the front wall's head.

### 7. MAJOR — rounds into the Cardinal when he is not open still draw blood
From the code and the owner's Left 5 (I saw the iron line once in the bad
runs, not the splash close): a round that "thuds into the iron" draws the gun
kit's blood splash before `c8damage` turns it away. The picture says *hit*
when the rule says *not now*; the clumsy hand landed 32 of 72 rounds on him
and still died on that try. The rule must read from the picture: no blood
when he is shut, a spark or a dull puff on his coat; the blood only when he is
open.

### 8. MAJOR — the nick of time: from the kerb the screen tells me only "Get to Dot." and "[C] get low"
First control (frame 05): the kerb, the diner 15 m up the street, the room
not visible, Sal and Dot not visible, Nicky a dark figure under the awning.
Nothing on screen says there is a broken window, a crate of empties or a man
I may take from behind; the prompts come only within 2.4 m of each. A
first-timer walks up to the door, is seen ("The man at the door. Out of his
sight!") and shot 1.25 s later; the retry says "They saw you. Too late." -
fair, but the takedown card returns only on the second fall. The brief's "the
warning is in the room" is a HUD line from 15 m away. Cheap answers: start
the kerb closer, where the lit room and Sal's gun on Dot are in the first
frame (the picture is the objective), light the crate (a lamp over the bins)
and let the broken window's glass glint on the pavement.

### 9. MINOR — the last ten seconds are a gimme
`last`: he is open the whole time (`boss.js:210` sets `B.open = 9` every
step) and needs two hits; the good hand took 5-6 s and 3-6 rounds, the
clumsy one 3.9 s. Idle loses, so it is not self-winning, but there is nothing
to solve. Keep the shield man's last burst, or let him stagger only on hits
to the legs, or give him the door's frame as cover for half the ten seconds.

### 10. MINOR (ask 7) — the good run is about five minutes, not six to nine
~4 min 05 s of fighting twice; with the gun, the moves between beats and the
end, about five minutes. Not a defect in itself; it is the sum of findings 5
and 9 (two stages that take seconds).

### 11. MINOR — after the window way the gun is laid 3.5 m up the aisle, out of reach, with 'Take the gun.' already up
Window way, then hands off: I am in the aisle at (-15.46, -0.7), the gun
lands at (-14.51, 2.83), no prompt until I walk past Sal's body to it (the
walk passed within 0.2 m of where he went down without being stopped).
Small, but the twist is better if she lays it in front of me where I stand.

## Cheats read (none wins a contest)
- `shootout/street.js:117-129` `beginFight`: each fall in a beat gives the men
  +22 % settle and 10 % less damage a round (three falls at most); after one
  fall nobody is sent round; after two, one fewer fires at once. Written down,
  graded, they still kill a man in the open: an allowed mercy.
- `shootout/street.js:205, 221-242` `suppress`: each man out of a car spends
  his first rounds on the windows (two for a pistol man, nine for the Tommy
  gunner) instead of at me. A scripted miss, but short and loud: it is the
  tell that the glass will not hide me. Allowed; keep it short.
- `shootout/boss.js:215`: with no line for 4.5 s the Cardinal fires anyway
  into my cover and that opens him. It makes hiding a valid way through stage
  2 (wait behind the counter, rise after his shot): fine as a rule, but the
  player is never told it; say it once ("He'll fire at the wood. Then he's
  open.").
- `09_shootout.js:632-635`: a drive-by that drives off down the avenue takes
  its two men with it (removed, not counted). Not a win, the movement still
  needs everyone else down.
- Nothing loses without a tell in what I played except finding 1.

## The user's asks
1. **Met.** Idle at the kerb loses ('Too late.' after 7.5 s of 'He's going to
   shoot her!'); three ways each won first try by a good hand (Mack's window
   low and E from behind, a bottle, straight in at the door with a blow after
   taking Nicky from behind); the clumsy hand failed twice, got through. (The
   ask's "bottle through the window" is a bottle into the road; the
   "round the back" is Mack's window. See 8 for what a first-timer knows.)
2. **Met.** She reaches under the counter, lays the Tommy gun and two drums,
   one line ("Dot: Ames said you'd come."), E to take it (frame 06).
3. **Not met.** Standing at one window and holding the trigger lost the first
   fight, the flank and the el on the first try; cover is spent (the panes go);
   the Tommy gunner pins; Dot is threatened once ('They got Dot.'). But the
   kitchen flank and the hydrant are missing (3), drums are endless (2), and
   a drum take freezes me (1).
4. **Met in what I saw.** The drive-by ran round the parked cars and was held
   by a barricade and a car ahead (`rail.what`), the two cars stood apart, no
   body through a body. Caveat: `rails.ahead()` sweeps only ahead of the nose;
   a tail swinging into a car beside it is not checked.
5. **Met.** Out of car doors (climbing out), round the corner from the alley,
   down the north pavement, the el gunman walking up to the rail, Nicky's
   flight down the avenue. I did not see anyone pop.
6. **Not met.** Three stages, no bar, the ember tell said aloud, three honest
   hits that show (hat, arm, knee), about two minutes for the good hand. But
   stage 1 is a spray (5), the shut hits bleed (7), the last is a gimme (9).
7. **Partly.** Idle loses all seven contests with a warning and a reason; the
   clumsy hand died and got through in five of seven but won `saloon` and
   `last` first try; the good hand won twice with no fall in about five
   minutes, not six to nine; checkpoints at every beat.
8. **Partly.** The still `diner` before, the still `end` after, THE END, music
   `shootout` from the first car and `end` at the hat. The last frame lacks Dot
   and the diner (4).
9. **Met.** Every frame I took is the ink; golden 38/38 identical; 0.99 x perf
   at the el.

## What is good and must not be broken
- The nick of time as a stealth contest: three real ways, each using a verb
  from the pier, Sal's clock said aloud, the cock and "Last time, sister." as
  the warning, every fall naming its cause ('They saw you.', 'Too slow.',
  'He heard you coming.'), back at the kerb in seconds.
- The twist frame (06): Dot behind the counter, the gun laid, `E take it`.
- Idle loses everything, with the reason: keep `RR.warn` and the kit's
  warnings exactly as they are.
- The stander dies in the first three movements; the clumsy hand gets
  through on the second try: the mercy in `beginFight` is the right size.
- The Cardinal's rule (open after his shot, after his shield drops, after a
  blast; iron otherwise; "Iron under his coat. Wait for it.") and the ember
  tell with "His gun! Get down!": the fix is the picture of a shut hit, not
  the rule.
- Cars that brake for what is ahead and the drive-by that stops and lets its
  men out (`rails.ahead`, `onBlocked`).
- Golden frames identical; no errors in any play.

## Plays left (`tools/plays/critic/`)
`c8_cold` (from the title, hands off), `c8_nick_all` (idle, bad, door,
bottle, window), `c8_idle`, `c8_bad`, `c8_good` (the street and him by the
owner's driver), `c8_flow` (nick by the window, the gun, the first cars, no
jumps), `c8_driveby_end` (the drive-by's rail, the end and THE END),
`c8_drums_switch` (finding 1), `c8_explore` (a naive walker: stuck behind
Dot in the aisle, little else learned; not worth rerunning).
