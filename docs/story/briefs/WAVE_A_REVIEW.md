# Wave A review — the art director's critique of the integrated slice

Build judged: branch `wave-a/integration`, commit `f08ba93`. Frames are in
`docs/story/review/wave-a/` (JPEG copies of the integrated captures and two
golden frames for comparison). Open every one named below before you work.

## Verdict
The slice **plays**: title, the diner, the fight, the window, the
matchbook, by real input and by autoplay, without errors. The street is
still the street the user loves, and richer. **The interior is not yet at
the street's level**, and the player's hands are the weakest drawing in the
game. The fix round is about the picture, in this order of importance:

1. the seated view of scene 1 (it is the first frame of the game);
2. the hands and the fists;
3. the light in the room (cones, pools, walls);
4. the colour accents (amber, flame, neon sheen);
5. the brawler's build and guard;
6. everything else on the lists below.

## What is good and must not change
- `s18_matchbook.jpg`: the pavement, the glass on the ground, the man in the
  rain, the red matchbook with its black bird. This is the level.
- `street.jpg`, `viewmodel.jpg`: the block, the el, the skyline, the rail
  yard through the arches, the columns sitting on the water, the new grip on
  the foregrip.
- `dinerfront.jpg`: the front, the neon letters, the old blade sign.
- The back bar in `diner_seat.jpg`: bottles as black shapes against the
  lit glass, the menu board, the cook in the hatch.
- The explosions and the burnt wreck.

## Findings, by frame

### `s02_settle.jpg`, `s03_lighter.jpg`, `s06_pour.jpg`, `s08_sip.jpg` (scene 1, my seat)
- **The frame leans.** The view is turned along the counter and pitched
  down, so the menu board and the shelves tilt and every vertical leans.
  The first frame of the game must be square and calm: looking straight
  across the counter at the back bar, horizon level, verticals upright.
- **The counter in front of me is black.** No lamp hangs over my place:
  the pendants are at z 5.6 and 3.2 and I sit at z 4.1, so the two pools
  fall either side of me (the grey rings bottom-left and bottom-right) and
  my hands lie in the dark between them. The counter top at my place is
  the stage of scene 1: it must be a pool of paper white with my hands, the
  ashtray, the pack, the lighter and the glass in it, each with a small
  shadow.
- **The near edge of the counter is out of frame** (the eye leans 0.3 m
  forward). Without the edge the counter is a floor. Its rolled steel edge
  with one broken highlight should run across the bottom of the frame.
- **The hands are white gloves.** Flat paper white with a heavy black
  outline, no light side and dark side. Skin is a light grey with a shadow
  side, white only on the knuckles nearest the lamp.
- **The smoke is a rope**: a thick solid white tube from the tip to the
  top of the frame.
- **The flame is a flat orange teardrop** with no core and no light on
  the hands.
- **The scotch is an orange can.** In Dot's hand the bottle is a large
  flat orange cylinder with no glass, no label, no shading; the glass I
  raise is a flat orange disc. Amber must be honey in glass.
- The room behind is good but too dark at the edges of the frame: Dot at
  the urns (far left) is almost lost.

### `s12_round1.jpg`, `s14_round3.jpg`, `s16_ko.jpg` (scene 2)
- **My fists are not fists.** Each reads as two crossed sticks (an A
  shape): open fingers laid over one another. They are also white gloves,
  small, and cut by the bottom edge.
- **The lamp cones are solid grey bells** with a hard stepped outline that
  cuts across the wall and the ceiling; they hide what is behind them. A
  cone is light in smoky air: soft, faint, no edge.
- **The walls are flat grey planes** with thin vertical scratches: CG, not
  ink. Compare the pavement and the wall in `s18_matchbook.jpg`.
- **The floor's pools are contour maps**: concentric blobby rings of grey.
- **Mack** has a balloon belly, ball fists held at his chest, and hunches
  over. He should be the most dangerous shape in the game.
- The blood at his mouth and chest reads well (round 3).

### `diner_wide.jpg`
- The bells again, in a row; the pie case is a glass box with no pie
  visible; the floor rings. The people at the counter read well.

### `s00_title.jpg`
- The red splat covers the blade sign; the pendant cones through the
  glass are grey bells, two of them **tinted blue** by the neon; the
  neon's sheen on the pavement is a solid blue slab.

### `dinerfront.jpg`
- The neon letters are right. Their sheen on the wet pavement is a wide
  solid blue plate, 300 px across; it should be broken blue flecks under
  the sign, no wider than the sign, fading within 2 m of the kerb.

### `street.jpg` against `golden_street.jpg`
- Accepted as the new street. Two things to regain: the columns' dashes
  should print **paper white** on their plateau (they are grey-white now;
  the golden's were white slivers with dark gaps), and the near lamp's
  column can run a little longer (to about y 800 of 900 before it is
  gone).

## Defects found by the integration builder (all confirmed as work for this round)
See `docs/story/reports/wave-a/INTEGRATION.md`.
