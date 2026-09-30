# Wave B, round 2: the art director's notes after round 1

Every lane's branch is merged on `wave-b/integration`: the whole story
plays from the title's CHAPTERS to THE END. Round 1 built it; round 2
makes it premium. The rules of `docs/story/WAVE_B.md` still bind (read it
again: section 2 and section 3). Each lane below is one owner, one
worktree, one branch; the lane's own report from round 1
(`docs/story/reports/wave-b/B<n>.md`, its "Second pass" and its "left"
list) is part of the brief: everything a player would feel in that list is
yours too.

What I saw in the review frames, lane by lane, most felt first. "Frame"
means the JPEG in `docs/story/review/wave-b/<lane>/`.

## R2-A  Room 304 and its gunfight (scenes 4, 5; branch `wave-b/R2-office`, port 5321)
The rooms play, but they do not look like this game yet. Frames 02, 07,
10: flat grey walls with a paper-crumple texture, no pool of light, a
white void in the window and the corridor, the wrecked room a black blot
on a white rectangle. The diner is the standard for an interior
(`shots/golden/diner_settle.png`): black ceiling, walls that fall into
ink away from the lamps, the lamps as cones in haze, every object drawn
by the light that touches it.
1. Relight Room 304 and the corridor as the diner was lit: the banker's
   lamp is the one warm pool (blotter, pad, the desk's edge); the street
   lamp and the neon through the blinds are the second light and the
   slats' shadows fall across the room and across the player's hands; the
   corridor's one ceiling lamp; everything else black or near it. Haze in
   the cones. The window is a night window: the building opposite, its
   few lit panes, the lamp post's cone, rain; never a white plane.
2. Dress it so it reads as an office turned over: papers over the floor
   (many, ink shapes), the drawers out, the chair over, the coat stand,
   the cooler, the fan's slow shadow. The tipped desk must read as a desk
   on its side (frame: drawers, its top toward the door).
3. The gunfight: the revolver is real now (B3 merged): remove the
   stand-in marks, the heave with B3's hands. Keep it hard but fair; the
   muzzle flash disc on the near wall; the curtain's holes. Lane B4's
   `seen` beat now plays in your room: make the view through the slats
   good from `office.window.street`.
4. Frame every beat again at 1440 x 900 and compare each with the diner
   frame before you call it done.

## R2-B  The hands across the game (branch `wave-b/R2-hands`, port 5322)
You own `src/player/HandRig.js`, `Hands.js`, `handPoses.js`, the ink
pass's treatment of the hands, and every hand clip in `src/player/clips/`.
1. The gun hand reads as a pale mitten with a band at the wrist (B3
   frames rev_1_rest, rev_6_fight; B5 06_gun_out). Glove it as the Tommy
   gun's hands are gloved (black leather, a rim of light, seams as lines)
   for the revolver, in the office and in the car; or, if bare, ink it:
   a knuckle line, the fingers separated, a shadow side. Bare hands
   elsewhere print one flat grey; give them two hard tones (the lit
   plane paper, the shadow plane ink, a hard terminator) as the Hoods
   have, so they stop reading as balloons in every set.
2. The revolver's rest at eye height (the brief's classic frame; B3's
   finisher left it low right), the reload's two raised fingers, the
   shut's big palm, the draw from inside the coat.
3. The other lanes' hands, all in their reports: B1's fist pry and the
   strings view with no hand; B6's sneak hands (claws) and lowering a man;
   B5's left hand holding the revolver out of the window and the lapels;
   B2's heave; B4's slat-parting fingers (01_seen: a mitten). Fit grips
   with a probe as the diner's were.
4. Mack's arm at the lens as a smooth grey tube when a blow lands (B8
   06_answer): the cast figure at 0.3 m needs the same two-tone as the
   hands, or a rim; find where the ink pass treats the cast at close
   range and fix it there.

## R2-C  The Watcher (scene 6; branch `wave-b/R2-watcher`, port 5323)
The second-pass builder of this lane was lost to the disk-full hour: its
uncommitted edits are saved as `docs/story/reports/wave-b/B4_second_pass_uncommitted.patch`.
Read it, apply what is good, and judge the rest cold, as that builder
would have (play it, strips, frames).
1. Frame 05: the washing yard is a grey sky-lit courtyard, low contrast,
   not night. Relight it: black, one lamp behind the sheets so they are
   the lit shapes and he is the shadow on one; the ground wet under it.
2. The `seen` beat now plays in the real office (B2 merged): the slats,
   the man under the lamp, the umbrella dropping and his run; the way
   out through the fire-escape window; the cut into the tail (B5: the
   kerb where my car stands). Make the seams smooth.
3. Everything in B4's own open list a player feels.

## R2-D  The Tail (scene 7; branch `wave-b/R2-tail`, port 5324)
The cabin and the road are strong (02). The ending is not (10): a grey
sky, a flat grey river, a stand-in man.
1. The river at night: black water with the lamps' and the far bank's
   lights in it (the reflection model exists for emitters), the far bank
   as scattered lights in fog, not a row of cutouts; the interrogation
   under one lamp post from above (hard light on the brim, the rail, the
   water). The man is the `watcher` kind now (B4 merged): his hat into
   the river when he breaks.
2. The revolver is B3's prop now: hold it in the left hand out of the
   window (`revolverGripL`, with lane R2-B if the pose needs work) and
   make the gun-out frame a silhouette, not a black blob; the flash must
   not cover his car.
3. Windscreen framing: the road ahead is a 12 % band; raise the eye or
   lower the dash so the road is the picture and the dash the frame.
4. B5's own open list: cars lifted off the road, headlamp pools nothing
   blocks, the market's blobs, the train unseen.

## R2-E  Pier Nine and the second fist fight (scene 8; branch `wave-b/R2-pier`, port 5325)
The warehouse reads (02, 07). Now the fight: build `docs/story/briefs/B9_PIER_FIGHT.md`
on B8's fight (it takes its room as data: read `docs/story/FIGHT.md` v4
and B8's report). The Cardinal is real now (B7 merged): use him at the
window. B6's open list: the grey between the pools (find the ink pass's
grain on dark faces and give this stage a darker floor), lowering a man,
the first frame (car, freighter), the Hood at the stairs with no light.

## R2-F  The Block (scene 9; branch `wave-b/R2-shootout`, port 5326)
The frames are the reference (03, 07, 10). What is left is feel and
frame rate: men who climb out of the cars (the Hood's `sitCar` and
`stepOut` clips exist) instead of appearing beside them; the cars'
front wheels steering on their rails; the gun's stock sweeping the lens
on the take; difficulty for a first-timer, not a sure shot (a player at
0.5 to 0.6 hit rate should win in four to six minutes, dying once or
twice); and frames per second at the cars beat: profile it on a quiet
machine (draw calls, the glass, the flashes, the pooled lights) and get
it to perf's rate. The el train over the last frame, the drive-by's
second pass: captured and looked at.

## R2-G  The Body (scene 3; branch `wave-b/R2-body`, port 5327)
Frames 02 and 05 are right. B1's open list: the table views (halves,
note) are flat grey close-ups: frame them under the lamp with the
doorway and the pool in the picture; the strings view's missing hand and
the red fleck (make the half's glint read at 7 m: a bigger red, a
lightning flash on it); his fist closed on nothing; the ladder pull's
view; the approach (the alley lamp a speck at 30 m: give the player a
line to it: its cone and its streak on the wet, the hat in the gutter
on the way); frames per second (draw the street's shops and rooms only
when they can be seen from the alley, as `dinerInSight` does for the
diner). Cut the two subtitles that always show unless they are needed.

## R2-H  The fight's small things (scenes 1, 2; branch `wave-b/R2-fight`, port 5328)
From B8's own list: the ring and rim drawn round a thrown thing are loud
(07): speed lines only, or a lighter plate; the chapter card II drawn over
him as he rises (delay the card to the black, or the rise to after it);
a masher gets him out on his feet but cannot finish (fine) — make sure
the wild manner and the finish still come for a player who mostly
mashes but lands one loaded punch; nothing else unless it is a bug.

## For every lane
- Branch from `wave-b/integration` at the commit named in your prompt.
- Your own server on your port; `NOIR_PORT` on every tool. The tools now
  clean up after headless Chrome; keep captures modest and delete them
  when done. Muted, always.
- The gate of WAVE_B.md section 3.7 (build, goldens identical except a
  frame you changed on purpose and say so, errors clean on every beat of
  your scene, your play twice, the slice play, fps against perf).
- Report: append "Round 2" to your lane's report (what changed, what is
  left) and refresh the review frames that changed. Commit on your
  branch; do not push, do not merge.
