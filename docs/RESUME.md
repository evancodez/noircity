# NOIR CITY — halted 2026-10-30 (the user's word); how to pick it up

The user, through the parent session (2026-10-30): "please wind down what
you are doing and halt all operations/work on the game, and only resume when
I tell you to." Every lane workflow was stopped mid-pass with its worktree and
branch exactly as they were; every dev server (the lanes' and the manager's
on 5370) and headless Chrome stopped; nothing launched since. Resume only on
the user's word through the parent session.

## 1. The state of main

`main` is 94d0612 plus this file's commit. Since the last push (e47f19f was
the parent's last known head):

- c93ab25: a parked car shoved into mine counts as the rammer and has a yaw
  but no `fwd` (the chase and propagation plays' "reading 'x'" at Car.js:484).
- 039453d: lane **O1c** merged (the pavement graph mended: 0 legs through a
  lot; the street answers a fist; vandal crimes; the districts' look; the near
  ground darker). Its merge check passed: errors clean at nine starts, game
  one's 40 and the city's 22 golden identical, pavecheck 0/0/0, o1b_jank,
  o1c_fist, o1c_fist_pad, o3_crowd, o6_city, mgr/seats 8/8, colour under 2 %.
- e47f19f: lane O6c's brief. 5fec69d and f61d91c: the user's words of
  2026-10-29 (the point of the game; the rooms, polish rather than immense
  scope, keep working until he stops us) at the head of `docs/OPEN_WORLD.md`
  and a [must] in every open brief; `docs/briefs/O5C_ROOMS.md` (the parent's);
  the lane rows O2b 5382, O6c 5385, O5c 5386; O9 and O2b cut to polish.
- fa10032 + 9a91ca1: lane **O8** merged (the ragdoll, a car hits a man who
  steps out, the street's variety by a seeded hash, the intention tells, the
  swell). city_o3_police and city_o3_crowd re-accepted as O1c's ground with
  O8's figures (`docs/review/mgr/o8_merge_golden.jpg`).
- 94d0612: O8's merge check passed (errors clean at ten starts and beats; o8/
  cars, carrun, intent, react; o3_crowd, o3_gangs (its play fixed: up off the
  cell's bench after the fight's arrest), o3_pad_arrest, o3_witness,
  o5_bout_good, o7/bounty_gun, o1c_fist, o5b_board; seats 8/8; colour max
  1.02 %). Routed: o5_tour's moved car (O2b), o8/falls' stoop bar, the chases'
  7 s police (O9), the drive-through's timeout (O2b).

The measures on main (9a91ca1), the baselines O9 is judged against:

| measure | Grand Ave | the market hall | the quay |
|---|---|---|---|
| things a minute (alive test) | 1 | 1 | 1 |
| people near, on average | 4.1 | 0.6 | 0.2 |
| nonsense (without a cause / outlived) | 0 / 0 | 0 / 0 | 0 / 0 |

Propagation: the quay passes (one of two near react); at the Grand stop three
people within 45 m of a shot, none react, then a cop's stop and an arrest on
foot (a patrol car 13 m off at 11 s). Every seat sees the road (5-7 % flat
black). Colour under 2 % on every frame (max 1.02 % tinted).

## 2. The open lanes (stopped mid-pass; worktrees and branches untouched)

| lane | branch | worktree (`.claude/worktrees/`) | phase when stopped | run id | on the branch |
|---|---|---|---|---|---|
| O4b weapons in hand | `ow/O4b-weapons` | `wf_7a3e9e8d-6eb-1` | fix 1 (build continued and critic 1 done) | wf_f4cca00e-0f1 | 13 commits over main, 1 file uncommitted; head 8617b01 |
| O9 alive | `ow/O9-alive` | `wf_1bd13ed3-a3d-1` | build (27 min in) | wf_1bd13ed3-a3d | no commits, 10 files uncommitted |
| O5c rooms | `ow/O5c-rooms` | `wf_4b59216e-0ae-1` | build (about an hour in) | wf_4b59216e-0ae | no commits, 13 files uncommitted |
| O6c car wear | `ow/O6c-wear` | `wf_88b37ee7-b3e-1` | build | wf_88b37ee7-b3e | 4 commits over main, 2 files uncommitted; head 2f46b31 |
| O2b wheels | `ow/O2b-wheels` | `wf_e94a1291-7dd-1` | build (paused 2026-10-29 for O5c's slot) | wf_e94a1291-7dd | no commits, 5 files uncommitted (kinds.js, its seat plays) |

O4b resumes from its run (`resumeFromRunId`: the build and the critic replay
from cache, the fix pass re-runs; same session only, the same args exactly;
the new [must]s reach its fix pass through main's brief). If the session is a
new one, run it in continue mode instead (its args with `"worktree"` set, as
below, without `resumeFromRunId`). The other four continue in their own
worktree (`lane.worktree`: "build (continued)", then the critic and the fix).
Never `SendMessage` a running Workflow agent.

## 3. The order from here

The cap is four lanes; launch only under a one-minute load of 20, nothing
while the load is over 35 for five minutes.

1. The merge check of main as it is (§6): main was verified at 94d0612, so a
   short one (errors at the starts, golden, mgr/alive) confirms the machine.
2. Relaunch, in this order, four at once: **O4b** (fix 1), **O9** (build
   continued, xhigh), **O5c** (build continued, xhigh; critic and fix high),
   **O6c** (build continued, high). **O2b** (build continued, high) takes the
   first slot that frees.
3. On each return: read the journal (`~/.claude/projects/-Users-evansmac-Downloads-eprojects-noircity/<session>/subagents/workflows/<runId>/journal.jsonl`:
   the 2nd result is the critic, the last the fix), `git merge --no-ff`, build,
   its check (§6), then "main moved: <hash>" to the parent with what a player
   can do now, what is left, and the five words (smooth, alive, populated,
   varied, fun; on theme). O4b: the transition, idle and arrest plays,
   o3_gangs, o7/gun, o7/pad_draw, o2_view, the title's keys line. O9: the
   alive and propagation plays against §1's baselines, the read and nonsense
   tests, the chases (can a player get away?). O5c: the five rooms' robbery
   plays, the first open of a door, the room's reactions out of the door.
   O6c: its wear play, o3_roadblock's `warnedFor`, o1_drive. O2b: the hull
   play, the seats (`mgr/seats`, `colour.py --blocked`), the speeds, o5_tour.
4. Then O7's second pass (the whole-game hunt, judged by the five words and
   "alive, not canned, not stiff"; its addenda in `docs/briefs/O7_NIGHT.md`),
   the stale plays (`docs/briefs/FOLLOWUPS.md` item 3), and the roadmap's
   phases 3 and 4 (the whole-game cold critic, the look pass, the perf pass on
   a quiet machine, the sound pass, the README), each brief's first [must]
   the user's words of 2026-10-29, every item finished or cut.

## 4. Open findings, routed and not yet done

- **O9**: the alive and propagation baselines of §1; the punched victim of
  o3_witness reports after 81 s; the chases from `start=city` end in an
  arrest 40 m from the start (patrol cars at 7 and 11 s after heat 2).
- **O2b** (its brief, cut to finish): the tight hull for rounds; the police
  car's and the lorry's cabins; the top speeds; traffic that sees a walker;
  the start kerb's parked taxi 66 m on; the player's car moved at four doors
  in o5_tour; hands in the hijack; the race; the far build and the
  drive-through's hitches (o1_drive: 20 frames over 50 ms and a timeout among
  the traffic); V on the title's keys line.
- **O6c**: the fire's warning on every path, the wear by kind (the manager's
  flat half in the city, 5b9bb44, is the stopgap), the blast beside a burning
  car, the dent at 20 m.
- **FOLLOWUPS item 3**: o8/falls round 1 (the stoop's body settles at 4.98 s
  against its 4.5 s bar); o3_unstaged_shoot; O7's heat plays; the bounty tails.
- **Left by O1c**: the Hill's lamp columns and cones carry no hue (the
  renderer's); a bicycle lying between the pools reads faintly. **By O8**: a
  body on his side away from a lamp at 12 m is hard to see; the coat's cut
  from behind.
- **Tools**: under a load over 100 a key tap falls between frames (hold keys
  a second); the controller's forward is (-sin yaw, -cos yaw); `golden.py`
  needs `NOIR_PORT=5370`; start the dev server as its own background task with
  no pipe (a `| head` killed it by SIGPIPE); plays that teleport after an
  arrest must get up off the cell's bench by E first.

## 5. The exact calls

O4b (same session; otherwise drop `resumeFromRunId`, it already carries
`"worktree"`):

```json
{
 "scriptPath": "/Users/evansmac/Downloads/eprojects/noircity/tools/lanes/lane_ow.js",
 "resumeFromRunId": "wf_f4cca00e-0f1",
 "args": {
  "head": "6b91505",
  "lane": {
   "n": "O4b",
   "branch": "ow/O4b-weapons",
   "port": 5384,
   "effort": "high",
   "rounds": 1,
   "title": "weapons in hand: one state machine, no glitch between fists, nothing and the guns; the arrest keeps the gun",
   "brief": "docs/briefs/O4B_WEAPONS.md",
   "worktree": "/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_7a3e9e8d-6eb-1",
   "merge": "You continue your own build after a halt (docs/RESUME.md on main tells the state): your worktree holds your commit 420d988 and three untracked plays under tools/plays/o4b/ - your own work in progress, keep and finish them. main is at 6b91505: O2 (the fleet, the view behind the car; getting into a car holsters) and O5b (the ward wake, the led prisoner; the cell wake calls src/combat/fall.js) are merged since your launch. The manager's small fixes on main are yours to make right: fall.js keeps every gun at the station; hands.js's idle holster resets on a fresh draw (the cause is yours: no idle holster at all). Keep the manager's tests passing (tools/plays/mgr/propagation.json, o3_crowd, o3_witness, o3_punch_idle, o3_gangs, o7/gun, o7/pad_draw, o4/*, o2_view). Headless verification only, muted, NOIR_PORT=5384. Game one's 40 golden frames and the city's 22 identical, or the frame named (the title's keys line, re-accepted). Hours, not a day.",
   "musts": [
    "\"Make sure there isn't a glitch when switching weapons or staying with fists raised, nothing, or gun(s).\"",
    "\"I don't want my gun taken away when arrested.\""
   ]
  }
 }
}
```

O9:

```json
{
 "scriptPath": "/Users/evansmac/Downloads/eprojects/noircity/tools/lanes/lane_ow.js",
 "args": {
  "head": "94d0612",
  "lane": {
   "n": "O9",
   "branch": "ow/O9-alive",
   "port": 5389,
   "effort": "xhigh",
   "rounds": 1,
   "title": "alive: the city as a living place, reactions that make sense, nothing canned or stiff",
   "brief": "docs/briefs/O9_ALIVE.md",
   "worktree": "/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_1bd13ed3-a3d-1",
   "musts": [
    "(the user, 2026-10-29, the point of the game; every brief and merge is judged by it) \"The point of this game is a fun open world that feels smooth, alive, populated and on theme. Make it look varied, feel alive and populated, and have fun gameplay.\" Smooth, alive, populated, varied, fun, and on theme (the ink).",
    "(the user, 2026-10-29, the direction for what is left) \"Buildings you can enter, interiors without a loading screen, and things to do in them, destructible / physics objects, stores to rob etc. is a thing to have, if you haven't started on that. Not every interior. In general, things like destruction, environment objects, or NPCs reacting to you is a good idea. Once again, the goal is polish rather than immense scope (apply that to the entire world and the other things you are working on), but it should still be pretty cool and varied. Work your way up. Keep working until I stop you.\"",
    "\"The city doesn't feel alive, and NPC reactions, police etc., are often too stiff or nonsensical.\"",
    "\"It's possible the car hitboxes are too big, as bullets seem to hit the cars sometimes. Also some first-person car views, like the police car's, are blocked.\" (Lane O2b's since 2026-10-29, §0: judged at O2b's merge; your report names where it stands.)",
    "\"Basically make the city feel more alive and less canned and stiff. That's a general goal.\"",
    "\"Alive means robust systems of reaction and procedural stuff happening. Not: I shot a person and everybody in the entire map knows. Not the opposite either: you shoot somebody and you see NPCs not caring. Not everyone with the same animation, running the same way. All are bad. Find a way to have it feel alive.\""
   ],
   "merge": "You continue your own build after the halt of 2026-10-30 (docs/RESUME.md on main tells the state): your worktree holds your work in progress (commits and uncommitted edits): judge it by playing, keep what is good, finish it, commit. Main has moved since your launch: merge it in first. The manager's baselines on 9a91ca1 (tools/plays/mgr/alive.json and propagation.json; your gate re-runs both): the alive test counts one thing a minute at Grand Ave, the market hall and the quay (a car passing), nobody to join, the near street averaging 4.1, 0.6 and 0.2 people; a shot at the Grand stop with three people within 45 m gets no reaction from any of them, then a cop's stop and an arrest on foot. The punched victim of o3_witness reports after 81 s; in o3_chase_medium and o3_roadblock the patrol cars arrive 7 and 11 s after heat 2 and the medium hands are arrested 40 m from the start (can a player get away?). Lane O5c (rooms) reads your propagation rules: name the seam a room calls to pass a reaction out of its door. O2b owns the cars' hull and views. Keep game one's 40 golden frames identical and the city's 22 identical except the frames you change, each named and shown beside the old. Hours, not days."
  }
 }
}
```

O5c:

```json
{
 "scriptPath": "/Users/evansmac/Downloads/eprojects/noircity/tools/lanes/lane_ow.js",
 "args": {
  "head": "94d0612",
  "lane": {
   "n": "O5c",
   "branch": "ow/O5c-rooms",
   "port": 5386,
   "effort": "xhigh",
   "rounds": 1,
   "title": "rooms that answer: stores to rob, things that break inside, people inside who react; never a loading screen",
   "brief": "docs/briefs/O5C_ROOMS.md",
   "worktree": "/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_4b59216e-0ae-1",
   "musts": [
    "\"The point of this game is a fun open world that feels smooth, alive, populated and on theme. Make it look varied, feel alive and populated, and have fun gameplay.\"",
    "\"Buildings you can enter, interiors without a loading screen, and things to do in them, destructible / physics objects, stores to rob etc. is a thing to have. Not every interior.\"",
    "\"In general, things like destruction, environment objects, or NPCs reacting to you is a good idea.\"",
    "\"The goal is polish rather than immense scope (apply that to the entire world), but it should still be pretty cool and varied.\""
   ],
   "merge": "You continue your own build after the halt of 2026-10-30 (docs/RESUME.md on main tells the state): your worktree holds your work in progress (commits and uncommitted edits): judge it by playing, keep what is good, finish it, commit. Main has moved since your launch: merge it in first. The third pass on places after O5, O5b, O8 (the cast: docs/seams/CAST.md) and O1c (the street answers a fist) merged: read docs/reports/O5.md, O5b.md and O8.md. Lane O9 (alive: the propagation and variety rules, docs/briefs/O9_ALIVE.md 1b and 1c) builds beside you and is NOT in main: use O3's witnesses until it lands and name the seam a room calls to pass a reaction out of its door. Five rooms done completely, not fifteen done a little. Keep game one's 40 golden frames identical and the city's 22 identical except the frames you change, each named and shown beside the old. Hours, not days."
  }
 }
}
```

O6c:

```json
{
 "scriptPath": "/Users/evansmac/Downloads/eprojects/noircity/tools/lanes/lane_ow.js",
 "args": {
  "head": "94d0612",
  "lane": {
   "n": "O6c",
   "branch": "ow/O6c-wear",
   "port": 5385,
   "effort": "high",
   "rounds": 1,
   "title": "car wear, the second pass: the fire's warning on every path, the wear by kind",
   "brief": "docs/briefs/O6C_WEAR.md",
   "worktree": "/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_88b37ee7-b3e-1",
   "musts": [
    "(the user, 2026-10-29, the point of the game; every brief and merge is judged by it) \"The point of this game is a fun open world that feels smooth, alive, populated and on theme. Make it look varied, feel alive and populated, and have fun gameplay.\" Smooth, alive, populated, varied, fun, and on theme (the ink).",
    "(the user, 2026-10-29, the direction for what is left) \"Buildings you can enter, interiors without a loading screen, and things to do in them, destructible / physics objects, stores to rob etc. is a thing to have, if you haven't started on that. Not every interior. In general, things like destruction, environment objects, or NPCs reacting to you is a good idea. Once again, the goal is polish rather than immense scope (apply that to the entire world and the other things you are working on), but it should still be pretty cool and varied. Work your way up. Keep working until I stop you.\"",
    "O6b's rule is that `She's burning. Get out.` always fires first, with time to get out. The crash path to the fire skipped it: a chase at heat 3 into the roadblock burned the car after two crashes with no warning (`tools/plays/o3_roadblock.json`: `warnedFor` null, then 'She went up with you in her.'). The manager's stopgap in `Car.hurt` (5b9bb44) stops a blow from below the fire's step just below it; make it the rule by every path (a crash, a blast, rounds, a wall at speed): the warning, then a fuse long enough to get out (O6b's FUSE), never the fire in the same frame as the blow that earned it.",
    "The traffic's knocks must not burn the car. On main as it was after O2 the drive-through burned the car on the bot's scrapes (O1c's run: 1 crash and 5 scrapes, 'failed' by wear; the manager's: 132 scrapes and 6 crashes at a load of 590) and O3's chase burned it every try. The stopgap halves every blow in the city, flat. Own it by kind: a scrape costs no wear; a glance a fraction of a step; a square blow about a step; the blows to the fire by kind measured and tabled (a coupe, a saloon, the lorry, the hearse) with the masses (O6b's `impC * mr`), and the stopgap's flat half removed (`Car.hurt`, the `city` branch) once yours is in. Game one's numbers stand: its tail, `shots/golden`'s 40 frames and O6's own plays identical."
   ],
   "merge": "You continue your own build after the halt of 2026-10-30 (docs/RESUME.md on main tells the state): your worktree holds your work in progress (commits and uncommitted edits): judge it by playing, keep what is good, finish it, commit. Main has moved since your launch: merge it in first. A follow-up of O6 and O6b after O2's traffic, the manager's wear tune (5b9bb44), O1c and O8 merged: read docs/reports/O6b.md (sections 0 and 7), docs/seams/SMASH.md and git show 5b9bb44. Lanes O2b (the kinds' specs and cabins), O9 and O5c build beside you and are NOT in main: keep your edits in Car.hurt, Car.contact's wear and CarDamage. On main o3_roadblock and o3_chase_medium end in an arrest 40 m from the start (the police's pace: O9's), so prove the warning with your own wear play as well. Keep game one's 40 golden frames identical and the city's 22 identical except the frames you change, each named and shown beside the old. Hours, not days."
  }
 }
}
```

O2b (the first slot that frees):

```json
{
 "scriptPath": "/Users/evansmac/Downloads/eprojects/noircity/tools/lanes/lane_ow.js",
 "args": {
  "head": "94d0612",
  "lane": {
   "n": "O2b",
   "branch": "ow/O2b-wheels",
   "port": 5382,
   "effort": "high",
   "rounds": 1,
   "title": "wheels, the second pass: the tight hull for rounds, each kind's cabin drawn as the coupe's, the speeds, traffic that sees walkers",
   "brief": "docs/briefs/O2B_WHEELS.md",
   "worktree": "/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_e94a1291-7dd-1",
   "musts": [
    "(the user, 2026-10-29, the point of the game; every brief and merge is judged by it) \"The point of this game is a fun open world that feels smooth, alive, populated and on theme. Make it look varied, feel alive and populated, and have fun gameplay.\" Smooth, alive, populated, varied, fun, and on theme (the ink).",
    "(the user, 2026-10-29, the direction for what is left) \"Buildings you can enter, interiors without a loading screen, and things to do in them, destructible / physics objects, stores to rob etc. is a thing to have, if you haven't started on that. Not every interior. In general, things like destruction, environment objects, or NPCs reacting to you is a good idea. Once again, the goal is polish rather than immense scope (apply that to the entire world and the other things you are working on), but it should still be pretty cool and varied. Work your way up. Keep working until I stop you.\"",
    "\"the car hitboxes may be too big (bullets seem to hit cars sometimes)\": a tight hull for rounds against a car - body and cabin boxes inside the silhouette, glass that a round goes through (and cracks), a tyre its own target; a round past a car's wing never stops. O2 left this at the hull's box (`docs/reports/O2.md` §6: \"the gun kit (kitUse) would be the next step\").",
    "\"some first-person car views (the police car's) are blocked\": O2's seats see the road from every kind (the manager's sheet `docs/review/mgr/seats_after_O2.jpg`), but the police car's cabin is a box with a heavy header and pillars (the top quarter and the left third of the frame black) and the lorry's seat has no frame at all. Each kind's cabin drawn as the coupe's is: pillars a hand wide, the header a strip, the dash low, two fifths of the frame at most (the cold play's finding 4), a frame from each seat in the report."
   ],
   "merge": "You continue your own build after the halt of 2026-10-30 (docs/RESUME.md on main tells the state): your worktree holds your work in progress (commits and uncommitted edits): judge it by playing, keep what is good, finish it, commit. Main has moved since your launch: merge it in first. Your brief was cut to finish on 2026-10-29 (its section 1): read it again before going on. A follow-up of O2 after O5b, the wear tune, O1c and O8 merged: read docs/reports/O2.md (sections 5 and 6) and the manager's sheet docs/review/mgr/seats_after_O2.jpg. Lanes O6c (car wear), O9 and O5c build beside you: the wear and the fire are O6c's. Keep game one's 40 golden frames identical and the city's 22 identical except the frames you change, each named and shown beside the old. Hours, not days."
  }
 }
}
```

## 6. The merge check (the recipe)

```bash
NOIR_PORT=5370 npx vite --port 5370 --strictPort      # muted runs: every play's url has mute=1
```
Then, with `NOIR_PORT=5370` exported: `python3 tools/golden.py check` (game
one's 40), `NOIR_GOLDEN=shots/golden/city python3 tools/golden.py check` (the
city's 22; `accept <name>` only with the change named in the commit); the error
sweep `WAIT=8000 tools/wd.sh 300 node tools/evalpage.mjs "/?<query>&mute=1" 1280 800 "({ errlog: (document.getElementById('errlog')||{}).textContent || '(clean)' })"`
at the starts (`scene=city&beat=roam`, `start=city`, `...&traffic=1`, the beats
hospital / ward / station, `scene=smash&beat=bed`); the plays
`tools/wd.sh 900 node tools/play.mjs tools/plays/<x>.json` (the lane's own, the
neighbours' it touches, the manager's three, the colour share on five frames);
the counts and the frames looked at; the report to the user in plain words at
each merge: what a player can do now, what is left, "main moved: <hash>".
The shared running note of the manager:
`~/Library/Application Support/Claude/side-session-notes/local_2f92f832-1487-4131-98f0-a98f4db29654/noircity-manager-status.md`.
