export const meta = {
  name: 'noir-city-lane',
  description: 'One NOIR CITY lane: an Opus owner builds it in its own worktree, a cold player judges it (smooth, the middle, everything works; can I lose, can I win, do I know how), the owner fixes what was found. One agent at a time.',
  phases: [
    { title: 'Build', detail: 'the owner builds the lane: whole, fair and smooth first', model: 'opus' },
    { title: 'Critic', detail: 'a cold player and code reader judges it against the standard', model: 'opus' },
    { title: 'Fix', detail: 'the owner fixes what the critic found; the gate', model: 'opus' },
  ],
}
const L = args.lane
const HEAD = args.head
const ROOT = '/Users/evansmac/Downloads/eprojects/noircity'
const INTEG = 'main'
const REPORT = 'docs/reports/' + L.n + '.md'
const CRIT = 'docs/reports/' + L.n + '_CRITIC.md'

const HOUSE = (where) => [
  '',
  'House rules (the machine is the user own laptop and it has been overloaded before):',
  '- ' + where,
  '- Your dev server: NOIR_PORT=' + L.port + ' npx vite --port ' + L.port + ' --strictPort, in the background, started from inside your worktree (first: ln -s ' + ROOT + '/node_modules node_modules, if the link is not there). NOIR_PORT=' + L.port + ' on every tool (tools/shot.sh, errors.sh, play.mjs, strip.py, golden.py, fps.mjs). Ports 5173, 5190, 5339, 5340 and 5361 to 5368 belong to the user other projects and servers: never use them.',
  '- Never kill a process you did not start (no pkill, no killall, nothing by pattern). At most ONE headless Chrome of yours at a time; no capture loops; fps only once at the end, as a ratio to shot=perf measured at the same moment.',
  '- Every run muted (the tools do it; any URL you open yourself carries mute=1).',
  '- NEVER use the desktop app tools that act on the user screen: no mcp__Claude_Browser__* (the app browser pane), no mcp__claude-in-chrome__* (the user Chrome), no mcp__terminal__* (the user terminal panel), no simulator. They move the user own mouse and open things in front of him. Everything you need is the repository headless tools (tools/play.mjs, shot.sh, strip.py, errors.sh, evalpage.mjs, probe.mjs, stepplay.mjs), run with Bash.',
  '- Another lane saving files can make a dev server reload its pages under your play. If a play dies that way, run plays and the gate against a build instead: npx vite build, then NOIR_PORT=' + L.port + ' npx vite preview --port ' + L.port + ' --strictPort (stop it when done). Never save source files while your own headless play runs.',
  '- The kit is in the tree: docs/story/seams/Z.md is its contract (hud.objective, hud.teach, hud.teach.again, hud.warn, game.fail, game.stills) and src/scenes/92_kit.js a working example. Use it; never roll your own black, prompt line or retry. The gun kit is docs/story/seams/GUNS.md; the fist fight is docs/story/FIGHT.md; the pad (src/input/Pad.js) must keep working: every key you read goes through the game input, never navigator or window listeners of your own, and a pad play of your lane (?padfake=1) must pass.',
  '- Commit early and often on your branch (' + L.branch + '); every commit message ends with the line: Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>',
  '- Never push. Never merge INTO ' + INTEG + ', never touch another worktree or the main checkout at ' + ROOT + ' (read-only for you).',
  '- Keep ' + REPORT + ' current as you go: it is your handover. A later agent continues this lane knowing only the code, the brief and that report.',
  '- STORAGE. The user disk is his own: delete every capture, strip, probe frame, diff sheet and play log the moment you no longer need it (shots/check after a golden check, your strips once looked at, PNG frames once the JPEG for the report is made); keep only the JPEG frames the report shows (1440 x 900, quality 85, under docs/review/' + L.n + '/, at most six). Never leave PNGs in shots/ or docs/.',
  '- WATCHDOG. tools/wd.sh <secs> <command...> kills a headless run that hangs (a loaded machine does this): wrap every play, shot, errors and golden run in it (tools/wd.sh 300 node tools/play.mjs ...).',
  '- When you stop: stop your own dev server, leave no Chrome of yours running, commit.',
  '- SPEED. Do the brief, prove it, stop. Grey but whole in the first hours; each proof play run ONCE on the final code (twice only where it is flaky); one golden check, one errors sweep, one fps reading; no new tooling when an existing tool will do; no long investigations of things outside your lane (write them in left). Prefer the simplest mechanism that plays well.',
  '- Your final answer is the structured result; be exact and honest in left: an unfinished thing named is worth more than a finished thing claimed.',
].join('\n')

const INTRO = 'NOIR CITY is an open-world first-person noir game (Three.js r186 + Vite) in which every frame must look like a hand-inked black-and-white reference (reference/noir_reference.png: look at it). It is cloned from NOIR EXTREME (a chaptered game whose renderer, ink, cast, vehicles, gun kit, fist fight, pad and tools it keeps) and it has no story and no missions: one new city, one endless night, systems (driving, hijacking, shootouts, fist fights, the police and its heat, destruction), places to enter and things to do that a player finds by looking. The standard is docs/OPEN_WORLD.md, on the rules of docs/story/WAVE_C.md sections 1 and 2 and the three bars of docs/story/GAME_TWO.md section 1 (smooth, the middle, everything works): read all of them before anything else. Judge every system by: is it smooth, do I know what to do without being told twice, does everything I touch work; can I lose, can I win, do I know how.'

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' }, worktree: { type: 'string', description: 'absolute path of the worktree you worked in (pwd)' }, head: { type: 'string' },
    changed: { type: 'array', items: { type: 'string' }, description: 'what exists now, as a player would feel it' },
    plays: { type: 'array', items: { type: 'string' }, description: 'the plays (proofs) and their last result' },
    feel: { type: 'string', description: 'the input-to-act latency of the main verbs, measured' },
    gate: { type: 'string' },
    goldenChanged: { type: 'array', items: { type: 'string' } },
    sharedEdits: { type: 'array', items: { type: 'string' } },
    forOtherLanes: { type: 'array', items: { type: 'string' }, description: 'what another lane must know or call (APIs, anchors, seams)' },
    left: { type: 'array', items: { type: 'string' }, description: 'still open, most felt first' },
  },
  required: ['branch', 'worktree', 'head', 'changed', 'plays', 'feel', 'gate', 'goldenChanged', 'sharedEdits', 'forOtherLanes', 'left'],
}
const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    musts: { type: 'array', items: { type: 'object', properties: { must: { type: 'string' }, met: { type: 'boolean' }, saw: { type: 'string' } }, required: ['must', 'met', 'saw'] } },
    findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, what: { type: 'string' }, steps: { type: 'string' }, where: { type: 'string' } }, required: ['severity', 'what', 'steps'] } },
    cheats: { type: 'array', items: { type: 'string' }, description: 'code that wins for the player or loses without a tell: file, line, what it does' },
    good: { type: 'array', items: { type: 'string' }, description: 'what works and must not be broken by the fixes' },
    summary: { type: 'string' },
  },
  required: ['musts', 'findings', 'cheats', 'good', 'summary'],
}
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' }, worktree: { type: 'string' }, head: { type: 'string' },
    answered: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, status: { type: 'string', enum: ['fixed', 'partly', 'not fixed', 'disagree'] }, note: { type: 'string' } }, required: ['finding', 'status'] } },
    plays: { type: 'array', items: { type: 'string' } },
    feel: { type: 'string' },
    gate: { type: 'string' },
    goldenChanged: { type: 'array', items: { type: 'string' } },
    sharedEdits: { type: 'array', items: { type: 'string' } },
    forOtherLanes: { type: 'array', items: { type: 'string' } },
    left: { type: 'array', items: { type: 'string' } },
  },
  required: ['branch', 'worktree', 'head', 'answered', 'plays', 'feel', 'gate', 'goldenChanged', 'sharedEdits', 'forOtherLanes', 'left'],
}

const buildPrompt = [
  'You own lane ' + L.n + ' of NOIR CITY: ' + L.title + '.',
  INTRO,
  '',
  'You are in a fresh git worktree. First: git log --oneline -1 must show ' + HEAD + ' (if not: git reset --hard ' + INTEG + '). Then: git checkout -b ' + L.branch + '.',
  'Read, in this order: reference/noir_reference.png, DESIGN.md, docs/OPEN_WORLD.md, your brief ' + L.brief + ' (it is your lane: every [must] in it is the user own words and is not optional), docs/story/WAVE_C.md sections 1, 2 and 7, docs/story/GAME_TWO.md section 1, then what the brief tells you to read.' + (L.merge ? ' Before you build: ' + L.merge : ''),
  '',
  'You are the owner end to end: the place, the people, the hands, the rules, the sound, and above all how it plays and how it feels. The brief is the direction, not a checklist: where the play needs a thing the brief did not think of, invent it inside the ink style; where the brief is wrong in play, do what plays better and say so in the report. Reuse what the base already does well (its kits, its cast, its cars, its tools) and build new where the brief says new.',
  'Order of work: grey but whole and FAIR first (the proofs of your lane passing by real input), commit; then make it good in the order a player feels it. Play after every change that touches feel and look at what you captured.',
  'Finish the whole brief and run the whole gate.',
  HOUSE('You work in the worktree you were started in (pwd). Stay in it.'),
].join('\n')

const continuePrompt = (wt) => [
  'You are the owner of lane ' + L.n + ' of NOIR CITY: ' + L.title + '. The session that ran you was cut off in the middle of your build; you continue your own work.',
  INTRO,
  '',
  'Work only in the existing worktree ' + wt + ' on branch ' + L.branch + ' (cd there in every command; do not create another worktree or branch). First: git status; git log --oneline -12. Uncommitted edits are your own work in progress: judge them by playing, keep what is good, finish or drop the rest, commit. If ' + INTEG + ' has moved (git log --oneline HEAD..' + INTEG + ' shows commits), merge it INTO your branch now, resolve, build.',
  'Read: docs/OPEN_WORLD.md, your brief ' + L.brief + ', then your own handover ' + REPORT + ' (what is done, what is left). Then play the lane cold before you change anything more. Finish the whole brief and run the whole gate, and bring the report up to date.',
  HOUSE('You work only in ' + wt + '.'),
].join('\n')

const criticPrompt = (wt, round) => [
  'You are the cold player of lane ' + L.n + ' of NOIR CITY: ' + L.title + '. You did not build it. You stand in for the user, who will play it by hand next, who explores, and who wants an open world that is smooth, clear without hand-holding, and in which everything he touches works.' + (round > 1 ? ' This is your second look: the owner has answered a first list of findings (' + CRIT + '). Check each was truly fixed in play, then look for what is still wrong.' : ''),
  INTRO,
  '',
  'Work only in the existing worktree ' + wt + ' (branch ' + L.branch + '; cd there in every command; no other worktree or branch). You do NOT edit anything under src/. You may add plays under tools/plays/critic/ and write your findings.',
  'Do, in this order:',
  '1. Play before you read the owner report. Start the game as a player would (the lane report says how: a ?start= or the title, with mute=1) by real input (node tools/play.mjs with plays of your own; tools/shot.sh and tools/strip.py for frames and film strips: LOOK at them). As a first-timer who knows no keys: at each moment, what does the screen tell me? Is it too much, or too little (GAME_TWO section 1 B: the middle)? Note every input that is swallowed or late (measure the latency of the main verbs), every lock of the controls, every pop of the camera, every hit that does not read, every moment something passes through something, floats or slides.',
  '2. The four proofs, yours, not the owner own: for every contest in the lane, (a) idle: hands off: do I lose, with a warning first and a reason said? (b) bad: slow hands, wrong keys now and then: do I fail some and get through by the third or fourth try, never stuck? (c) medium: through in one to three tries? (d) good: using what was taught: do I win twice in a row? A contest that idle play wins is a blocker. A contest good play cannot win is a blocker.',
  '3. Explore like a player who pokes at things: every door, every edge, everything that looks usable, walking and driving into every wall, piece of furniture, person, car and body. What is unfinished, what is an invisible wall, what answers nothing, what gets me stuck?',
  '4. Read the lane code for cheats: anything that wins for the player, or that loses without a tell. Name the file and line.',
  '5. The user own asks for this lane, each met or not, with what you saw in play (not what the code says):',
  ...L.musts.map((m, i) => '   ' + (i + 1) + '. ' + m),
  '6. Only now read ' + REPORT + ' and its left list: what in it would a player feel?',
  'Time box: about ninety minutes of work. Plays by the existing drivers and profiles (tools/plays/critic/ has bots to reuse); no elaborate new tooling; at most six frames. Severity: blocker = a user ask not met, a contest that wins itself or cannot be won or lost fairly, a stuck state, a pass-through or pop a player sees in normal play, not knowing what to do, an input that does not act on the press. major = felt by most players, not fatal. minor = polish.',
  'Write ' + CRIT + ' (findings most felt first: what, the steps to see it, the file if you know it, the severity; then what is good and must not be broken) with at most six frames as JPEG under docs/review/' + L.n + '/critic/. Commit those (and your plays) on the branch. Be concrete and be hard: the owner fixes exactly what you write.',
  HOUSE('You work only in ' + wt + '.'),
].join('\n')

const fixPrompt = (wt, c) => [
  'You are the owner of lane ' + L.n + ' of NOIR CITY again: ' + L.title + '. A cold player has played your lane and written what is wrong with it. Fix it.',
  INTRO,
  '',
  'Work only in the existing worktree ' + wt + ' (branch ' + L.branch + '; cd there in every command; no other worktree or branch). First: git status, git log --oneline -8. If ' + INTEG + ' has moved (git log --oneline HEAD..' + INTEG + ' shows commits), merge it INTO your branch first, resolve, build, and drop any shim that stood in for what it brought.',
  'Read: docs/OPEN_WORLD.md, the brief ' + L.brief + ', the handover ' + REPORT + ', then the findings ' + CRIT + ' and its frames. The findings, as data:',
  JSON.stringify({ musts_not_met: c.musts.filter((m) => !m.met), findings: c.findings, cheats: c.cheats, keep: c.good }, null, 1),
  '',
  'Fix every blocker and every major, and the minors that are cheap, in the order a player feels them; remove every cheat; do not break what the critic says is good. Where you disagree with a finding, play it yourself first; if you still disagree, say why in your answer rather than ignoring it. Verify each fix in play, not by reading. Then the gate, once, and bring ' + REPORT + ' up to date (a section "After the critic").',
  HOUSE('You work only in ' + wt + '.'),
].join('\n')

phase('Build')
let b = L.worktree
  ? await agent(continuePrompt(L.worktree), { label: L.n + ' build (continued)', phase: 'Build', model: 'opus', effort: L.effort || 'high', schema: BUILD_SCHEMA })
  : await agent(buildPrompt, { label: L.n + ' build', phase: 'Build', model: 'opus', effort: L.effort || 'high', isolation: 'worktree', schema: BUILD_SCHEMA })
if (!b) return { lane: L.n, failed: 'build', note: 'the builder died: find the worktree of branch ' + L.branch + ' with git worktree list and continue it there (lane.worktree)' }
const WT = b.worktree
log(L.n + ' built at ' + b.head + ' in ' + WT)
let last = b
const rounds = []
const N = L.rounds || 1
for (let r = 1; r <= N; r++) {
  const c = await agent(criticPrompt(WT, r), { label: L.n + ' critic ' + r, phase: 'Critic', model: 'opus', effort: 'high', schema: CRITIC_SCHEMA })
  if (!c) { log(L.n + ': the critic died in round ' + r); rounds.push({ round: r, critic: null }); break }
  const hard = c.findings.filter((f) => f.severity !== 'minor').length + c.musts.filter((m) => !m.met).length + c.cheats.length
  log(L.n + ' critic ' + r + ': ' + c.findings.length + ' findings (' + hard + ' hard), ' + c.musts.filter((m) => !m.met).length + ' asks not met')
  if (r > 1 && hard === 0) { rounds.push({ round: r, critic: c, fix: null }); break }
  const fx = await agent(fixPrompt(WT, c), { label: L.n + ' fix ' + r, phase: 'Fix', model: 'opus', effort: L.effort || 'high', schema: FIX_SCHEMA })
  rounds.push({ round: r, critic: c, fix: fx })
  if (fx) last = fx
  if (!fx || hard === 0) break
}
return { lane: L.n, branch: L.branch, worktree: WT, build: b, last, rounds }
