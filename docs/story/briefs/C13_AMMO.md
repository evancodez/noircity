# C13 — the revolver's pocket is counted (and the small rules the lanes left)

Branch `wave-c/C13-ammo`, port 5353. Short lane on merged work.

## 1. The pocket
Today R reloads the revolver from an endless pocket (`src/player/weapons/revolver.js`,
the HUD's cylinder `hud.layer('revolver')`). That is a cheat by WAVE_C §1
and it breaks the story (VI: "I spend my last rounds"; VII: the empty gun,
the shells). Count it:
- `weapons.revolver.pocket` (rounds in reserve), shown beside the inked
  cylinder as a small count or a row of cartridge ticks (the ink style:
  six little shells, greyed as they go), hidden when the gun is away.
- A reload takes from the pocket; with the pocket empty the hammer falls
  on nothing on a press (the dry click the pier already has) and the HUD
  says `Empty.` once.
- What each chapter gives (one table in the revolver file, read by the
  scenes through `gunsOf(G).arm('revolver', { pocket })`): IV The Door
  starts with the cylinder full and 18 in the pocket (enough for the
  fight if I aim, not to spray: check the good proof still wins and the
  clumsy one gets through; raise to 24 if not); IV's quiet carries what
  is left into V and VI; VI's gun phase begins with the cylinder plus
  **6** (the story: the last rounds; today it is 6 + 6: keep the balance
  the tail's proofs have); VII arrives empty, the shells box gives 6 + 18;
  the hook takes the gun. A chapter picked from CHAPTERS gets its table
  row. Saves carry the counts (`save.flags.ammo`).
- Reloading also only fills the chambers that are empty (a partial
  reload costs what it fills).
Prove: `gunfight_good_desk`, `gunfight_bad`, `tail_good`, `tail_gun_only`,
`pier_loud` once each; a play that runs IV dry and shows the dry click
and the line; the HUD count in frames.

## 2. Small things left by the lanes, each with a play
- The teach card that shows faintly under a chapter card (lane C10a's
  frame a05: `[LMB] fire` under VII PIER NINE): the kit must hold it
  unseen until the card has gone (`src/ui/kit.js`).
- VII picked cold: its revolver cards come as the phone rings; move them
  to the shells (the first moment the gun is loaded and nobody is onto
  me).
- The tail's "He warned them." when a hurt car reaches the gate: keep,
  but its warning line must come first (`He's nearly at the pier.`) in
  every case (lane C3b's left 1).

Gate: build; golden check identical; errors clean on IV, VI, VII beats;
the plays above. Report `docs/story/reports/wave-c/C13.md`. Hours.
