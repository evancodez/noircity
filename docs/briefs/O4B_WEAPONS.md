# O4b — weapons in hand: one state machine, no glitch between fists, nothing and the guns; the arrest keeps the gun

Branch `ow/O4b-weapons`, port 5384, effort high. A short follow-up on
O4 (combat), O7 (the night: the wheel draws and holsters) and O3 (the
police: the arrest). The user's words (2026-10-23):

- **[must]** "Make sure there isn't a glitch when switching weapons or
  staying with fists raised, nothing, or gun(s)."
- **[must]** "I don't want my gun taken away when arrested."
- Still binding: input acts on the press; nothing locks me; the HUD and
  the hands always agree.

What you build on: `src/player/Weapons.js`, `Weapon.js`, `weapons/*`,
`Hands.js`, `HandRig.js`, `Viewmodel.js`, the modes (`src/player/modes/
gun.js`, `brawlIn.js`, `run.js`), O4's `src/combat/` (the brawl's fists,
the shotgun), O7's `src/night/fist.js` and the wheel's draw/holster in
`src/night/` (its idle auto-holster after six seconds left the player in
the gun mode with nothing in hand: the manager fixed the symptom; you
own the cause), O3's arrest in `src/police/`, the pad (`src/input/Pad.js`).

## 1. One state machine for what is in my hands
States: `nothing` (hands down, walking), `fists` (up, the brawl's
stance), `revolver`, `tommy`, `shotgun` (each drawn, the viewmodel's
own). Transitions, every one of them on the press and eased in the
viewmodel (a draw 0.3 s, a holster 0.25 s, fists up 0.15 s), never
stuck, never two at once, interruptible by the next press (a holster
cut by a draw goes back up from where it was):
- the wheel (and the pad's d-pad) cycles `nothing → revolver → tommy →
  shotgun → nothing` through what I carry (an empty slot skipped);
- `1` / `2` / `3` go straight to a gun, `4` to fists, `Q` or the wheel
  back to nothing (write the keys in the rulebook: OPEN_WORLD.md §1);
- LMB with nothing in hand throws a jab and raises the fists (O7's
  rule), RMB the other fist; SPACE blocks only with fists up; a landed
  jab starts the brawl;
- getting into a car holsters (the gun back to the state it had on
  getting out); the window gun is the drawn gun; a cutscene or a fail
  returns me to `nothing` with the carried guns intact;
- **no automatic holster on idle**: a drawn gun stays drawn until I put
  it away (the police warn about it: that is the game's answer).
The HUD agrees at every frame (the cylinder and pocket for the gun in
hand, nothing for fists), the hands never show two things, the
viewmodel never pops, no state is reachable in which the input does
nothing.

## 2. The arrest keeps my guns
`game.fail({ why: 'Arrested.' })` wakes me outside headquarters with
every gun I carried and their rounds; the heat gone, the fine, the car
replaced as O3 has it. The station's cell (O5b) is the room I wake in
when it renders; until then the pavement. The same for the hospital.

## 3. Proofs and gate
A transition play that walks every edge of the machine from every
state by key and by pad (wheel, 1 to 4, Q, LMB, RMB, E into and out of
a car, a fail, a brawl start and end), checking after each the state,
the HUD and the viewmodel agree and that the next press acts within 50
ms; the idle play (a drawn gun held for sixty seconds stays drawn; a
raised fist too); the arrest play (arrested with the revolver and the
shotgun: both in hand after the wake, with their rounds); the brawl
proofs of O4 and the heat-1 proofs of O3 still pass; the pad play;
golden identical; errors clean on the night bed and the city starts.
Report `docs/reports/O4b.md`. Hours, not a day.
