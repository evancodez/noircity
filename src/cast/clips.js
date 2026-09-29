// The cast's clips as data (docs/story/CONTRACTS.md §6, §14): a clip's
// length and its named marks (seconds from its start). The rules (lane 7's
// scenes and the brawl) read the numbers from here through c.clip(name), so
// art can retime a clip without breaking a fight. The poses themselves are
// src/cast/castAnim.js, authored to these numbers.
//   duration   seconds
//   marks      { name: t }; a window is two marks, e.g. open / openEnd
//   loop       a looping state (setState keeps it until the next)
//   hold       a one-shot that keeps its last pose until the next play / setState
//   state      the Hood's locomotion under it (flee: run), overlay: per kind
// Retimed by lane 6 from the contract's starting values (each tell at least
// 0.3 s before its contact); the names of the marks are kept:
//   br_bottle 1.2 -> 2.0 (take 0.35 off the counter, break 0.75 on its
//   edge, contact 1.6), br_hitHead* 0.35 -> 0.4, br_hitBody 0.35 -> 0.5,
//   br_into_stools 1.6 -> 2.2 (down with them, up off one knee),
//   br_ko_window 2.2 -> 2.4 (glass 0.55 -> 1.0: two steps back and over the
//   booth table first; land 1.45), pour 3.2 -> 4.2 (she turns to the back
//   bar for the bottle: take 0.8, uncork 1.7, streamOn 2.2, streamOff 3.4).
export const CAST_CLIPS = {
  // ---- the brawler's fight (CONTRACTS §14) -------------------------------------
  br_guard: { duration: 2.4, marks: {}, loop: true },
  br_jab: { duration: 0.7, marks: { tell: 0.0, contact: 0.38 } },
  br_hook: { duration: 1.0, marks: { tell: 0.0, contact: 0.62 } },
  br_haymaker: { duration: 1.4, marks: { tell: 0.0, contact: 0.95 } },
  br_bottle: { duration: 2.0, marks: { tell: 0.0, take: 0.35, break: 0.75, contact: 1.6 } },
  br_hitHeadL: { duration: 0.4, marks: {} },
  br_hitHeadR: { duration: 0.4, marks: {} },
  br_hitBody: { duration: 0.5, marks: {} },
  br_stun: { duration: 1.3, marks: { open: 0.1, openEnd: 1.2 } },
  br_into_stools: { duration: 2.2, marks: { impact: 0.5, down: 0.9 } },
  br_into_jukebox: { duration: 1.6, marks: { impact: 0.5 } },
  br_into_piecase: { duration: 1.6, marks: { impact: 0.5 } },
  br_ko_window: { duration: 2.4, marks: { glass: 1.0, land: 1.45 }, hold: true },
  // out cold (c.ko() puts him there): breathing on his back
  ko: { duration: 3.2, marks: {}, loop: true },
  koFall: { duration: 1.15, marks: { land: 0.8 }, hold: true },

  // ---- the brawler at the counter (lane 6 P0.3) ----------------------------------
  notice: { duration: 2.0, marks: { turned: 0.9 }, hold: true },
  rise: { duration: 1.6, marks: { stool: 0.7, up: 1.3 }, hold: true },

  // ---- the waitress ----------------------------------------------------------------
  serve: { duration: 1.2, marks: { down: 0.8 } },
  pour: { duration: 4.2, marks: { take: 0.8, uncork: 1.7, streamOn: 2.2, streamOff: 3.4 } },
  slide: { duration: 1.2, marks: { release: 0.6 } },
  slideBottle: { duration: 1.0, marks: { release: 0.5 } },
  wipe: { duration: 2.4, marks: {}, loop: true },
  lean: { duration: 9, marks: {}, loop: true },
  duck: { duration: 0.6, marks: { down: 0.4 }, hold: true },

  // ---- the cook in the hatch ---------------------------------------------------------
  hatch: { duration: 8, marks: {}, loop: true },
  ring: { duration: 1.0, marks: { ring: 0.4 } },
  plateUp: { duration: 1.4, marks: { down: 0.9 } },

  // ---- civilians in the fight ---------------------------------------------------------
  startle: { duration: 0.8, marks: {} },
  cower: { duration: 1.0, marks: { down: 0.6 }, hold: true },
  flee: { duration: 1.0, marks: {}, state: 'run', overlay: { couple_him: 'fleeLead', couple_her: 'fleeLed' } },
  watch: { duration: 8, marks: {}, loop: true },

  // ---- seated (held, looping) ------------------------------------------------------------
  sit: { duration: 7, marks: {}, loop: true },
  sitEat: { duration: 4, marks: { bite: 1.6 }, loop: true },
  sitDrink: { duration: 4.6, marks: { sip: 1.8 }, loop: true },
  sitRead: { duration: 7, marks: { page: 4.5 }, loop: true },
  sitSmoke: { duration: 5, marks: { drag: 1.5 }, loop: true },
  sitTalk: { duration: 6, marks: {}, loop: true },
  // ---- the Hoods' entries (wave B): in a doorway, out of it; in a car ---------------
  leanDoor: { duration: 10, marks: {}, loop: true },
  stepOut: { duration: 1.2, marks: { off: 0.3, out: 0.85 }, then: 'idle' },
  sitCar: { duration: 8.8, marks: {}, loop: true },

  // standing, reading (the old man in the study)
  read: { duration: 7, marks: { page: 4.5 }, loop: true },
};
