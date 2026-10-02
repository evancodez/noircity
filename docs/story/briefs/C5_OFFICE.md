# C5 — the Harbor Building: chapter III Room 304 (a real puzzle) and chapter IV The Door (the first gunfight)

Branch `wave-c/C5-office`, port 5345. You own `src/stages/office/**`, the
office and gunfight scenes (`src/scenes/*_office.js`, `*_gunfight.js`,
`src/scenes/office/*`), the office's props, sounds and hands. The gunfight
is built on lane C2's gun kit: read `docs/story/seams/GUNS.md` and play its
test bed (`?start=guns`) before you design the fight.

Read `docs/story/WAVE_C.md` (all), `docs/story/seams/Z.md` (the kit),
`ARCHITECTURE.md` §10 (the office stage and its API), the old lane's report
`docs/story/reports/wave-b/B2.md`.

The rooms look right now (round 2 relit them like the diner: the banker's
lamp the one pool, the slats' shadows). Keep that light. What changes is
the size of the place and everything the player does in it.

## The place: the third floor, bigger and finished
"A bigger office, more men, and they do not all file through one door to
be shot. A second way in; or I step into the corridor to check and they
come out of other rooms."
- **Room 304 becomes a suite**: the outer office (the frosted door `J.
  AMES — INVESTIGATIONS`, a client's bench, a secretary's desk, files) and
  Ames's own room beyond it through a wide opening or a second glazed
  door (his desk, the safe's wall, the street window with the blind, the
  side window onto the fire escape). And **a connecting door to 305**
  (the next office: empty, dust sheets, its own corridor door): the second
  way in.
- **The corridor** is a place: the lift with its brass floor dial and
  cage, the stair door, 301 to 306, a radiator, a cleaner's cart, a fire
  bucket, the one globe (and a second at the far end, so there is a pool
  and a dark between). Every door answers: open and finished behind
  (305, the stair's landing down to a locked gate, a washroom), or locked
  and it rattles. Nothing opens onto nothing.
- Sized for a gunfight with the gun kit: lines of sight between the two
  rooms, things that are cover (and what kind: the desk and the bench are
  wood and get chewed; the safe's wall, the radiator and the lift's cage
  are not), room for a man to go round.
- The fire escape window stays (chapter V leaves by it). **The man who
  shot from outside it is gone** ([must]).

## Chapter III, Room 304: I arrive too late
Objective lines in quotes. The whole chapter is about six to eight
minutes for a first-timer and has no fail; it must never leave him stuck
(a hint after a long stall: the lamp flickers at the thing, never a
sentence that solves it).

**[must] "The door closes behind me when I enter the room."** The lock is
splintered; I push the door in; it swings shut behind me on its closer
(the click, the glass shivering in its frame). It is shut from then on.

**Ames is dead.** At his desk, in his chair, the telephone's receiver
hanging off its cord and swinging a little (the call in the opening still
was his). The `victim` cast kind exists (Ames: thin, hatless, rumpled
suit): pose him slumped, lit by the lamp's edge, the face lost. The room
was searched in a hurry and they did not find what they wanted.
"Find what Ames had."

**[must] A real puzzle; [must] no silly interactions.** Every thing I can
touch does what that thing does, fully: a drawer is shut and opens all
the way (and has something in it, or is plainly empty), or is locked
(and something opens it); a lamp has a chain; a telephone can be hung up
(and the line is dead); a picture swings. No thing is half open and
opens a little more. Things can be examined in any order; the chain
below is what solves it, and the room should hold two or three things
that are only flavour and say so quickly (his hat on the stand; a
photograph of the two of us in uniform years ago, if you want one beat of
who he was to me; his bottle and two glasses).

The chain (make it better by play; the test is that a first-timer says
"oh" at least twice and never "what does it want"):
1. **The safe is found, not given.** The crew pulled half the room apart
   looking for it and were disturbed. Where is it? Design a find that is
   an inference from what I see (the one picture they did not get to hangs
   a little out from the wall on its hinge side; or the floor safe under
   the rug his chair stands on: he died sitting on it; or behind a false
   back in the filing cabinet whose bottom drawer will not shut): pick
   one, make its clue a thing in the picture, not a prompt. "Keep the
   safe" is the user's word: the wall safe, its dial and its handle exist
   (`office/safe.js`): keep them and move them if the find is better
   elsewhere.
2. **The combination is on the pad, and nobody can see it yet.** The top
   sheet is gone (a burnt corner of it in the ashtray: he got rid of it).
   Under the banker's lamp, once it is lit (its chain), the next sheet
   shows faint dents in the raking light: the hint that there is
   something to bring up.
3. **The pencil** is in the desk's locked drawer with his other small
   things; **the key** is on him (E search: a key ring from his waistcoat,
   and my hand shuts his eyes, or straightens his tie: one human touch,
   no words).
4. **[must] "I can shade enough of the paper to actually read the safe
   combination."** Hold LMB and rub the pencil's side across the sheet
   (as built), but now the figures come up **big, white and whole**: three
   numbers and the way to turn for each (curved arrows, drawn, not
   letters), readable at a glance at 1440 x 900 when about two thirds of
   the sheet is shaded, and the rest of the sheet shades too so that the
   player can do it thoroughly if he likes. No percentage threshold that
   ends it while it is still unreadable. The sheet tears off into my hand
   and is held up beside the dial when I am at the safe (so nobody has to
   remember numbers).
5. **The dial**: turned by the mouse, with numbers I can read on the dial
   in the close view (bigger figures, a clear index mark), a click and a
   twitch at each right number as now; a wrong turn past resets that
   number only. E the handle.
6. **[must] The torn note.** Inside: an envelope of torn paper. On the
   desk under the lamp I piece it together (the table-puzzle code of the
   old Body chapter exists: `scenes/body/note.js`, `halves.js`; LMB
   slides, RMB or the wheel turns, a piece near home pulls in): six to
   eight pieces of **a guest check from my diner** (the printed slip of
   chapter I's pay beat: the prop kind `guestCheck` from lane C4 draws
   the paper and takes the lines to write; if C4 is not merged, draw to
   the same description and reconcile after), written in a woman's pencil,
   in bold dark strokes on pale paper, letters two centimetres high in
   the view: `PIER 9` / `MIDNIGHT` / `— DOT`. **Legible**: the old
   torn note was too faint to read; this one is read from a metre away
   while the pieces are still apart. A piece's edge and its writing both
   help to place it.
7. The stills `check` of WAVE_C §5 (the kit's placeholder panels until
   lane C9's pictures): `DOT'S HAND.` / `SHE SENT HIM TO THEM.` Into the
   inventory: `check`; `flags.note = 'PIER 9'`. Objective: "Pier 9." And
   as I turn to go: the shadows.

## Chapter IV, The Door: the first gunfight
The cut from III is in the same room with no black (as built: card IV
comes small). The revolver comes out from under my arm. Teach as the kit's
helper offers: `[C] get low`, `[RMB] rise and aim`, `[R] reload`: the
first in the quiet second below, the others at first need.

**[must] The pause.** The camera is taken to their shadows on the frosted
glass of the door (keep it: the outlines from their real joints, as
built), then given back. Now I have a moment, and it is a real choice with
real consequences:
- **Tip the desk and get low behind it** (E at the desk: the heave as
  built; then C). Wood: it will be chewed.
- **Shoot through the glass** at the shadows: the men are really there,
  the rounds really go through and hit: one down or wounded before the
  door opens, the others break left and right and come in angry and
  sooner, and the door's glass is gone (so I see them and they see me).
- **Or move**: into the outer office's corner, behind the files, to the
  connecting door. A player who thinks of a third thing should find it
  works by the same rules.
- **Do nothing in time** and they burst in and try to kill me, and
  against a man standing in the middle of the room they succeed.
  ([must] "If I do neither in time, they burst in and try to kill me.")

**The fight** ([must] "Enemies who really try to kill me." [must] "They do
not all file through one door." [must] "Only the revolver." "The first
shootout: not a crowd."): eight or nine men in all, never more than three
or four alive at once, in three movements with a checkpoint at each:
1. *The door*: three men: the kicker and two behind him who do not
   follow him through the same gap: one fires from the jamb, one through
   the sidelight.
2. *The second way in*: while I am busy with the door, the handle of the
   connecting door to 305 turns (I can hear it, I can see it): two men
   that way: the flank. Now where I was safe I am not.
3. *The corridor*: quiet. "Check the corridor." I go out with a loaded
   gun: the lift's dial is sweeping up to 3. The cage opens: two men
   (one with a Tommy gun: the pin, the wait for his drum); a door down
   the hall opens: one more; the stair door: the last (the heavy). The
   corridor's cover is doorways, the radiator, the cart, the cage.
The kit's rules do the rest; your job is the room: entries as doors that
open, cover with its kinds, nav that no man can clip ([must] "Nobody clips
through furniture or door frames."), bodies that slump where they are
([must]), light that shows me who is where (a man in the dark doorway is
a shape against the corridor's globe; my desk lamp can be shot out, by
them or by me, and then the room is the blind's slats only: harder for
both sides, and fair because I can see it happen).
Six in the cylinder and what is in my pocket (enough for the fight if I
aim, not enough to spray): reloading behind cover is the rhythm.

**The end.** Quiet; the smoke; the rain. "See if more are coming." At the
street window, E: two fingers part the slats (as built in the old
watcher's first beat: `scenes/watcher/office.js`, `blind.js`; lane C6
owns what follows): a man under the lamp across the street, under an
umbrella, looking up. That frame is the end of your chapter and the first
of chapter V: hand it over with `ctx.next({ fade: 'cut', card: true,
keep: true })` or as lane C6 asks.

## Proofs and gate
WAVE_C §7. III has no contest: its proof is a play that solves it by real
input in any two orders of search, a play that tries every thing in the
room before the right ones, and the stuck test (leave each sub-puzzle
half done, E out, come back; walk out to the corridor and back). IV:
`gunfight_idle` (stand still at the pause: down within seconds of the
door), `gunfight_bad` (stands and trades: dies in each movement, retries,
gets through), `gunfight_good` by each first choice (desk; glass; move):
wins twice in a row at a human pace. The jank walk through the whole
floor, during the fight too (stand in every doorway while men come).
Report `docs/story/reports/wave-c/C5.md`.
