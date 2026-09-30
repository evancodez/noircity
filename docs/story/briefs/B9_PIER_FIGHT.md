# B9 — The second fist fight: the foreman, Pier 9's loading bay

Read `docs/story/WAVE_B.md` first, then `docs/story/FIGHT.md` (version 4:
the rules), the fight owner's report `docs/story/reports/wave-b/B8.md` and
the warehouse owner's `B6.md`. The user asked for a second fist fight
later in the story. It goes at the end of scene 8 (`warehouse`), in the
loading bay, on the way out. Branch `wave-b/B9-pier-fight`.

## Why fists
A shot here brings the whole pier. My hand goes to the revolver and comes
away. He sees it and smiles, and hangs his jacket on a crate.

## The man
The foreman: as big as Mack, quieter. A flat cap, a short jacket off, braces
over a collarless shirt, a cargo hook (cast kind of your own on the dock
hands' costume; an outline that is not Mack's: narrower in the hips, longer
arms, the hook the signature). He does not talk.

## What makes this fight different from the first
The player knows the rules now: no lesson, no cards. The fight is harder
and shorter (50 to 80 s), and the room is different:
- **He starts with the hook.** Its swings are long arcs with reach: a step
  to the side is not enough, I go back or inside. Hit on the hook arm
  while he winds up, he drops it; it can be picked up (mine: it breaks his
  guard and does the most damage of anything in the bay; one use, it
  sticks in a crate).
- **The bay's things**: a crate lid (held in both hands it is a shield:
  it stops one hook swing and splits; or it is swung once), bottles, a
  coil of chain (a long reach, two swings), a hanging lantern (knocked
  down it burns on the floor in a small pool: the fire accent, a place
  neither of us wants to stand, and the bay's light changes).
- **The floor**: wet planks, the water under them seen through the gaps;
  crate stacks that come down when a man is driven into them.
- **The finish**: at the end he is out on his feet by one of the two
  plank loading doors (`pier9.bay.finish.1`, `.2`); the last hard punch
  puts him through the planks and into the river: the boards burst
  outward, a beat of silence, the splash, the rain coming in through the
  hole. Every board comes to rest or goes into the water.
- Quiet matters to the look and sound: no jukebox, only the rain on the
  roof, the water, our feet on the planks, and a lamp swinging after the
  first time someone hits the post it hangs from.

## How
The fight takes its room as data (the fight owner built that): give it
this room, this man, these things, this finish. Anything the rules lack
for this (a weapon that can be knocked out of his hand, a shield, a fire
on the floor) goes into the rules properly, and must not change the first
fight. Stage the start in one eased move from the stealth (I come down the
far stairs into the bay; he steps out of the dark by the door, the hook
turning in his hand) and the end into the scene's exit (I go out by the
side door onto the pier; `ctx.next()`).

## Judged by play
The human-paced autoplayer wins most of ten seeds in 50 to 80 s; the
masher loses; a player who uses the bay wins faster. Strips: the start,
the hook swing missed by a back-step, the hook knocked out of his hand,
the lid stopping a swing, the lantern coming down, the finish through the
planks and the splash. `tools/plays/warehouse.json` extended through the
fight to the scene's end.
