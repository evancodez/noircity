// The hands' clips as data (docs/story/CONTRACTS.md §7.2, §14; lane 2's
// brief): each clip's length and its named marks (seconds from its start).
// Scenes and the brawl rules read them through hands.clip(name), never as
// numbers of their own.
//   duration   seconds        marks   { name: t } (a window: name / nameEnd)
//   hold       the clip holds its last pose until the next one (guard, block)
//   blocking   hands.busy while it runs (default true; a held pose is not)
// FOUNDATION: CONTRACTS §14's timings and lane 2's; the marks the brief does
// not name (reachGlass taken, sip drink, putDown down, ash tap, payWallet
// bill, searchBody found, showMatchbook shown / pocketed, the reload's) are
// the foundation's and keep their names when lane 2 retimes them.
export const HAND_CLIPS = {
  // ---- the diner (scene 1) -------------------------------------------------------------
  lightUp: { duration: 3.2, marks: { tap: 0.5, lips: 1.2, spark: 1.9, flame: 2.0, lit: 2.5, shut: 2.9 } },
  drag: { duration: 2.4, marks: { glow: 0.8, exhale: 1.6 } },
  ash: { duration: 0.8, marks: { tap: 0.4 } },
  reachGlass: { duration: 0.8, marks: { taken: 0.5 } },
  sip: { duration: 2.0, marks: { tilt: 0.7, drink: 1.1, down: 1.6 } },
  putDown: { duration: 0.7, marks: { down: 0.5 } },
  payWallet: { duration: 2.6, marks: { open: 0.8, shown: 1.3, shownEnd: 2.2, bill: 2.3 } },
  // ---- the fist fight (scene 2; CONTRACTS §14) ---------------------------------------------
  guard: { duration: 1.0, marks: {}, hold: true, blocking: false },
  jabL: { duration: 0.24, marks: { contact: 0.09 } },
  jabR: { duration: 0.24, marks: { contact: 0.09 } },
  heavyWind: { duration: 0.7, marks: { charged: 0.25 }, hold: true },
  heavyHit: { duration: 0.5, marks: { contact: 0.12 } },
  block: { duration: 0.1, marks: { up: 0.1 }, hold: true, blocking: false },
  blockHit: { duration: 0.3, marks: {} },
  slipL: { duration: 0.42, marks: { safe: 0.05, safeEnd: 0.3 } },
  slipR: { duration: 0.42, marks: { safe: 0.05, safeEnd: 0.3 } },
  hurt: { duration: 0.5, marks: { down: 0.05, up: 0.3 } },
  grab: { duration: 0.3, marks: { taken: 0.2 } },
  swingBottle: { duration: 0.45, marks: { contact: 0.2 } },
  swingPlate: { duration: 0.45, marks: { contact: 0.2 } },
  swingStool: { duration: 0.8, marks: { contact: 0.45 } },
  searchBody: { duration: 2.0, marks: { found: 1.4 } },
  showMatchbook: { duration: 2.4, marks: { shown: 0.8, pocketed: 2.0 } },
  // ---- the Tommy gun (fixes 2 and 3) -------------------------------------------------------
  tommyReload: { duration: 2.3, marks: { latch: 0.35, drumOut: 0.8, drumIn: 1.5, bolt: 1.8 } },
  tommyHold: { duration: 1.0, marks: {}, hold: true, blocking: false },
};
