# B8 — The fist fight, version 4, and how it starts

Read `docs/story/WAVE_B.md` first (the standard and the way of working),
then `docs/story/FIGHT.md` (version 3, the design as built) and
`docs/story/reports/wave-a/ARCADE.md`. You own the fight end to end:
`src/game/Brawl*.js`, `src/cast/brawl/**`, `src/player/clips/fight.js`,
`src/ui/fightCards.js`, `src/scenes/02_fight.js`, the last beat of
`src/scenes/01_diner.js`, the brawl mode in `Controller.js`, the plays.
Branch `wave-b/B8-fight`, dev port 5318. Lane B3 is redrawing the hands'
surface at the same time (same rig, same poses): do not edit `HandRig.js`.

The user played version 3 on 2026-09-30: "The fighting mechanics are
definitely significantly improved", and: "It's almost there, but it
doesn't feel polished. The fights could be more balanced and a little bit
more fun, because right now it's kind of like, you can just spam punches
and you're just going to win. You should have to dodge." His list is
below, each with what to build. When you are done, rewrite `FIGHT.md` as
version 4 so it says what the fight now is.

## 1. How it starts (the user: "your character just immediately comes up
from his chair and then walks to the other character; it should be a
smoother transition; the other guy maybe grabs you on the shoulder, and
you pull the other chair, clearly beckoning for a fight")

After his line, in one continuous eased move of about four seconds, no
cut, no teleport, the player's look free within a small range:
he stands (his stool goes over), comes down the counter; his hand lands
on my shoulder (seen at the edge of the frame: the hand, the forearm; the
view is pulled round on the stool with it); I come up off the stool, my
hand takes the stool beside me by its seat and sends it skidding away
across the floor (it falls and lies where it stops: it is now something
in the room), the floor between us is clear, my fists come up, he squares
up. Then the lesson's first card. Author it object first (his hand on the
shoulder's place, my hand on the stool's seat). A retry of the fight
skips it.

## 2. Holding must wind up, and be felt (the user: "I don't think holding
down winds up your punch for more damage like it should")

First find out whether it is a bug (a release swallowed during the jab's
recovery, power not reaching the damage) and fix that. Then make the
wind-up unmistakable:
- While held, that fist draws back further and further and trembles; a
  rising sound; three white ink ticks flick at the fist as the power
  passes 0.33, 0.66 and full (at 0.2, 0.4 and 0.6 s), and at full the
  fist flashes once. The view leans back a degree or two with it.
- On release the punch is visibly bigger by level: the lunge, the burst,
  the hit stop, how far he goes back, and the bite out of his bar.
  Damage: jab 3; hard punch 9, 15, 22 at the three levels.
- A full-power punch into a raised guard breaks it on its own (he is open
  on both sides for a second) instead of bouncing off.
- Keep the jab on the press (it must stay instant). A press that becomes
  a hold flows from that jab's return straight into the wind-up, with no
  dead time and no second jab. Say in the lesson what happens: tap to
  jab, hold to load.

## 3. Punching into his guard is punished (the user: "when you punch and
he's blocking, you should get punished for that; he should generally, not
always, strike back pretty quickly")

A punch of mine that is blocked: about three times in four he answers at
once from the side that blocked, with a short tell (0.2 s) and a fast
blow, while I am still in my recovery. I can still get out if I am quick
(a hop, or SPACE), so it is a lesson, not a tax. A blocked hard punch
leaves me open longer than a blocked jab. With this, a player who mashes
both buttons must lose clearly, and a player who waits for the opening
and steps off the line must win. Prove both with the autoplayers.

## 4. He uses the room (the user: "it'd be cool if he picked up objects
more frequently to throw them at you or to hit you with them, and you had
to dodge; you get a little indicator of which side to dodge when he
throws something; when he's punching or hitting you with an object it's
the normal dodging, you've got to dodge the other way")

- In every manner from "measured" on, when something is within his reach
  and I am not on top of him, he takes it: bottles, plates and mugs to
  throw, a bottle by the neck, a stool or a chair to swing. About one of
  his actions in four is with a thing while things last.
- **A throw**: he draws back with the thing in his hand (the tell, 0.45
  s), and **a small inked chevron** shows low at the side of the frame I
  should step to. This indicator stays in the game after the lesson, for
  thrown things only. The thing flies on a real arc along a lane aimed
  where I stood when the tell began; a hop to either side leaves it; it
  bursts on whatever is behind me and its pieces come to rest.
- **A swing with a thing** follows the rule for fists (step away from the
  hand that swings, or back), with no indicator, and reaches further than
  a fist. Add one step to the lesson for the throw.

## 5. Things in my hands (the user: "when you pick up a chair in your left
hand, it only breaks when you throw a punch with your right hand; there's
stuff like that"; "hitting him with an object does more damage")

- Whatever a hand holds is used by that hand's button. A stool or a chair
  is held in both hands and either button swings it. Go through every
  kind of thing, in each hand, for a hit, a block, a miss, a throw, being
  hit while holding it, a knock-down, a retry and the finish. Nothing may
  be left in a hand that cannot use it or in the air.
- A thing beats a fist and is seen to: bottle 22 and its neck 14 twice,
  a plate or a mug 12, a stool or a chair 35 and it breaks his guard.
  The burst, the hit stop and his reaction scale with it.

## 6. Smoother (the user: "the fighting just could be a little smoother";
"it doesn't feel polished")

Play it and watch strips for every seam: my hands between any two
actions, his body between any two states (his arms still fling wide on a
knock-back: fix), the tell's glint (it is too small to read: make the
cocked fist itself the tell, bigger and held), his steps (no sliding),
the view (no pops when a hop meets a wall or a stool). Lengths: no seeded
fight under 60 s or over 110 s for the human-paced autoplayer.

## 7. One fight system, two rooms

A second fist fight is coming at Pier 9 (a loading bay, a dock foreman
with a cargo hook, things to pick up, the finish through a plank door
into the river). It is not in this lane, but make it a small job: the
brawl takes its room as data (the ring, the walls, the finish spots and
what a finish does, what can be picked up and what each thing does, who
the man is and his manners), and scene 2 is the first user of that. No
diner names inside the rules.

## Judged by play
Autoplayers, ten seeds each, muted: the human-paced reader wins eight or
more in 60 to 110 s; the masher loses eight or more; the player who never
steps loses; a player who only uses things wins faster than fists alone.
Strips at 30 frames a second: the start (the shoulder to fists up), a
full wind-up and its release landing, a blocked punch and his answer, his
throw with the chevron and my hop, his stool swing, a chair in my left
hand breaking on him by the left button. The plays (`slice`, `autoplay`,
`continue`) updated and passing twice in a row.
