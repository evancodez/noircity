# NOIR CITY — halted 2026-10-23 at 14:54 (machine time); how to pick it up

The user asked to halt all operations on the game, resumable on his word.
Everything below was true at the halt. Nothing runs: no lane workflow, no
dev server, no headless Chrome, no watcher. The manager session (the art
director's, the one that ran the lanes) idles until told to resume.

## 1. The state of main

`main` is at **5b9bb44**; origin was at 829200f (the parent pushes the two
commits above it: 68fbeae lane O5b's merge, 5b9bb44 the wear tune).

Merged lanes, in order: O1 (the city), O6 (the destruction set), O4 (the law
and the guns), O1b (the streets), O5 (the places), O7 (the night), O3 (the
people and the police), O6b (car damage), **O2** (the fleet of seven kinds,
traffic, the hijack, the view behind the car V / R3, the garage, fares, the
race, the police hunt car; 634c47e), **O5b** (the hospital and its ward, the
wanted board in HQ's hall and the led prisoner, the rooms told apart, the
first open one frame; 68fbeae).

Verified on main after O2's merge (check of 634c47e): golden game one 40/40
and the city 19/19 identical; o2_view 13/13 (the view behind the car), the
hijack and pad plays, o6_city pass; the colour share under 2 % on five
frames. Found there and fixed in 5b9bb44: with traffic the car burned in the
drive-through (o1_drive) and in every chase (o3_chase_medium) - in the open
world a blow now wears half (Car.js hurt), and a blow from below the fire's
step stops just below it.

**Not verified** (the check was cut by the halt, nothing of it ran): O5b's
merge on main and the wear tune. `npx vite build` passes on 5b9bb44. The
first thing on resume is this check (section 5): golden 40 + the city's 22,
errors at the starts and the hospital / ward / station beats, o1_drive,
o3_chase_medium, o3_roadblock, o6b_hang, o5b_hospital, o5b_board,
o5b_wardsleep, o5_tour, o5_bar, o7/bounty_medium, the alive test.

The manager's own tools on main: `tools/plays/mgr/alive.json` (a minute at
three corners, the nonsense list), `tools/plays/mgr/propagation.json` (one
shot on the quay and one at the Grand stop: who knows, how far, how soon,
the variety), `tools/plays/mgr/seats.json` (every car kind's seat, a frame
each; the sheet `docs/review/mgr/seats_after_O2.jpg`), `tools/colour.py`
(the colour share; `--blocked` the seat frames). They run at every merge
check and their counts go in every report.

## 2. The open lanes (stopped mid-pass; worktrees and branches untouched)

The lane script is `tools/lanes/lane_ow.js` (Build -> Critic -> Fix, one
agent at a time; `lane.worktree` continues a cut-off lane in its worktree -
the continue mode; `resumeFromRunId` replays the finished agents from cache
and re-runs the rest, but only in the session that launched the run).

### O4b — weapons in hand (the state machine; the arrest keeps the gun)
- branch `ow/O4b-weapons`, worktree
  `/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_7a3e9e8d-6eb-1`,
  head 420d988 ("one state machine for what is in my hands (combat/inhand.js) ...
  the transition play (71 edges, 0 bad frames)"), untracked:
  `tools/plays/o4b/arrest.json`, `hands_pad.json`, `idle.json` (its work in progress).
- phase at the halt: **Build** (its first agent; launched 14:23 at head 829200f);
  run id `wf_7a3e9e8d-6eb`, task id w2i4z4xrr, port 5384, effort high.
- to continue (the build finishes, then the critic and the fix):
  `Workflow({ scriptPath: "tools/lanes/lane_ow.js", args: { "head": "<main's sha>", "lane": { "n": "O4b", "branch": "ow/O4b-weapons", "port": 5384, "effort": "high", "rounds": 1, "title": "weapons in hand: one state machine, no glitch between fists, nothing and the guns; the arrest keeps the gun", "brief": "docs/briefs/O4B_WEAPONS.md", "worktree": "/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_7a3e9e8d-6eb-1", "merge": "<the merge note of the launch: see the manager's note or write a fresh one naming what is in main>", "musts": ["\"Make sure there isn't a glitch when switching weapons or staying with fists raised, nothing, or gun(s).\"", "\"I don't want my gun taken away when arrested.\""] } } })`

### O8 — figures (one cast in the Hood's look, never stiff; the people's variants)
- branch `ow/O8-figures`, worktree
  `/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_a3f9e4d6-de9-1`,
  head ce4abec ("O8 after the critic: the lining's outline ..."), uncommitted:
  `docs/reports/O8.md` modified, two review frames renamed (`docs/review/O8/2_...`,
  `4_...`: the old deleted in the index, the new untracked) - its fix pass's
  report work, left as it was.
- phase at the halt: **Fix 1** (the build and the critic are done and in the
  journal); run id `wf_a3f9e4d6-de9`, task id wjcfca90y, port 5379, effort xhigh;
  launched at head a773c0a.
- to continue (the fix pass again in its worktree; it merges main first and
  reads the brief): the launch args with `"worktree"` set to the path above and
  `"head"` main's sha; the original lane args (title "figures: one cast for the
  city in the Hood's look, never stiff, never blocky; the physics layer; one rig
  for every system", brief `docs/briefs/O8_FIGURES.md`, its three [must] lines
  verbatim from the brief) are recorded in the manager's note and in the session
  transcript. Hard rule at its merge: game one's 40 golden frames identical; the
  city frames with figures re-taken and named beside the old.
- or, in the launching session only: `Workflow({ scriptPath: "tools/lanes/lane_ow.js", resumeFromRunId: "wf_a3f9e4d6-de9", args: <the original args> })`.

### O1c — the streets, the follow-up (the pavement graph, the fist, the districts' look)
- branch `ow/O1c-streets`, worktree
  `/Users/evansmac/Downloads/eprojects/noircity/.claude/worktrees/wf_ab241ddc-c50-1`,
  head 02737c7 ("the fist walk gives the cop's bin 10 s to stop rolling"), clean.
- phase at the halt: **Fix 1**; run id `wf_ab241ddc-c50`, task id wh6f11fce,
  port 5378, effort high; launched at head 7040333.
- to continue: as for O8, with `"worktree"` the path above, brief
  `docs/briefs/O1C_STREETS.md`, its five [must] lines verbatim; or
  `resumeFromRunId: "wf_ab241ddc-c50"` in the launching session.

Returned and merged before the halt: O2 (`wf_4d349f00-814`), O5b
(`wf_26b7bb78-cd1`). Their worktrees may still exist under `.claude/worktrees/`
(each with an untracked `NOTE_FROM_THE_ART_DIRECTOR.md` that was never part of
a branch); they can be cleaned.

## 3. The order from here

1. The check of main as it is (section 5); fix or route what it finds.
2. O4b's return: merge, check (its transition play, the idle play, the arrest
   play, the manager's propagation test, O3's gun plays, O7's gun and pad plays,
   o2_view; golden; the title's keys line if it changed, re-accepted and named).
3. O8's return: merge, check (game one's 40 identical is a hard rule; the city
   frames with figures re-taken and named; the alive test's "no two alike").
4. O1c's return: merge, check (the graph tool at zero, o1b_jank 20/20, the fist
   walk, the colour share, the districts' frames).
5. Launch **O9** (`docs/briefs/O9_ALIVE.md`, branch `ow/O9-alive`, port 5389,
   effort xhigh; its [must] lines verbatim; the merge note names what is in main
   and the manager's baselines of section 6). Then **O2b** (`docs/briefs/O2B_WHEELS.md`,
   `ow/O2b-wheels`, port 5382, high). Then **O6c** (the fire's warning on the crash
   path and the wear by kind; its brief is to be written from FOLLOWUPS.md item 2
   and the wear tune's commit message), then the stale plays (FOLLOWUPS.md item 3).
6. O7's second pass: the whole-game hunt, judged by "alive, not canned, not
   stiff" and the propagation / variety rules above the rest (its brief addenda
   are in `docs/briefs/O7_NIGHT.md`).
7. The roadmap's phases 3 and 4 (`docs/OPEN_WORLD.md`, `docs/briefs/FOLLOWUPS.md`;
   each brief's first [must] is the user's words of 2026-10-29, the point of the game):
   the whole-game cold critic, the look pass, the perf pass on a quiet machine
   (the drive-through's hitch bar was never proved under the lanes' load), the
   sound pass, the README.

The cap is four lanes; launch only under a one-minute load of 20, nothing
while the load is over 35 for five minutes. Effort: xhigh only for 3D, physics,
AI and O8 / O9 as briefed; high for everything else and every fix pass. Every
run muted; verification headless only (tools/play.mjs, tools/evalpage.mjs,
tools/golden.py): never the desktop app's browser, Chrome, the terminal tools or
the simulator, never the user's mouse. Pushing is the parent session's: the
manager says "main moved" with the hash. Commit messages end with
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## 4. Open findings, routed and not yet done

- **O6c** (urgent after the chases): the fire's warning on the crash path
  (`o3_roadblock`: the car went up with no warning); the wear by kind; the wear
  tune of 5b9bb44 is the manager's stopgap (half wear in the open world, a blow
  from below the fire's step stops just below it).
- **O2b**: the tight hull for rounds against a car (the user: "car hitboxes may
  be too big"); the police car's cabin a box with a heavy header and pillars,
  the lorry's seat with no frame; top speeds; the far build; the fare bot; the
  race too easy; hands in the hijack; traffic that parks; V on the title's line.
- **O9** (the alive rule, measured on main before it): the alive test counts
  1 to 2 things a minute at each corner with traffic (cars passing, a dash clear
  of one), the near street empty at moments, nobody to join; the propagation
  test: a shot at the Grand stop is seen by a cop and ends in an arrest within
  a minute standing still, two of three near react, both the same way (every
  runner the same gait at 4 to 4.7 m/s); cops "wedged" and dropped two or three
  times a minute; the paper knows a shot the same second (the rule: next
  edition); the stream keeps nobody beyond ~95 m, so "a man two blocks away" is
  only the count beyond 120 m.
- **O4b** owns: the hands' idle holster (the manager's hands.js fix is the
  symptom's), the arrest keeping the guns (on main as a small fix in
  `src/combat/fall.js` and `People.js`; the cell wake of O5b calls the same wake).
- **The stale plays**: `o3_unstaged_shoot` (the city arrests a standing shooter
  in seconds; the rule is right, the play is not), O7's heat plays against O3's
  police, `o7/bounty_good`, `_bad`, `_gun` tails (not re-run after O5b's led man).
- **Perf**: the drive-through's hitch count (692 of 20638 frames over 50 ms at
  load 22-36 in O2's run; never measured on a quiet machine); a room's first
  build still one 40-60 ms frame at its load radius (O5b's m1).
- **Tools**: in the manager's plays under a load over 100 a key tap falls between
  two frames (hold keys a second); the controller's forward is (-sin yaw, -cos
  yaw) (`N.controller.setPose`'s yaw: O2's play helper has it right); the
  `start=city` error sweep hits a 240 s watchdog under load; `golden.py` needs
  `NOIR_PORT=5370`.

## 5. The merge check (the recipe)

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
