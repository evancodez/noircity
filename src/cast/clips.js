// The cast's clips as data (docs/story/CONTRACTS.md §6, §14): a clip's
// length and its named marks (seconds from its start). The rules (lane 7's
// scenes and the brawl) read the numbers from here through c.clip(name), so
// art can retime a clip without breaking a fight.
//   duration   seconds (a clip with hold: true keeps its last pose until
//              the next play / setState)
//   marks      { name: t }; a window is two marks, e.g. open / openEnd
//   pose       the stand-in pose the foundation's Character holds for it
//              (src/cast/Character.js POSES); lane 6 replaces poses with
//              real procedural clips and keeps the names and marks
// FOUNDATION: the starting values of CONTRACTS §14 and lane 6's brief;
// lane 6 owns this file and retimes it (every tell at least 0.3 s before
// its contact).
export const CAST_CLIPS = {
  // ---- the brawler's fight (CONTRACTS §14) -------------------------------------
  br_guard: { duration: 1.2, marks: {}, pose: 'guard', loop: true },
  br_jab: { duration: 0.7, marks: { tell: 0.0, contact: 0.38 }, pose: 'jabL' },
  br_hook: { duration: 1.0, marks: { tell: 0.0, contact: 0.62 }, pose: 'hookR' },
  br_haymaker: { duration: 1.4, marks: { tell: 0.0, contact: 0.95 }, pose: 'haymaker' },
  br_bottle: { duration: 1.2, marks: { tell: 0.0, break: 0.3, contact: 0.75 }, pose: 'jabR' },
  br_hitHeadL: { duration: 0.35, marks: {}, pose: 'hitHead' },
  br_hitHeadR: { duration: 0.35, marks: {}, pose: 'hitHead' },
  br_hitBody: { duration: 0.35, marks: {}, pose: 'hitBody' },
  br_stun: { duration: 1.3, marks: { open: 0.1, openEnd: 1.2 }, pose: 'stun' },
  br_into_stools: { duration: 1.6, marks: { impact: 0.5 }, pose: 'thrown' },
  br_into_jukebox: { duration: 1.6, marks: { impact: 0.5 }, pose: 'thrown' },
  br_into_piecase: { duration: 1.6, marks: { impact: 0.5 }, pose: 'thrown' },
  br_ko_window: { duration: 2.2, marks: { glass: 0.55 }, pose: 'thrown', hold: true },

  // ---- the brawler at the counter (lane 6 P0.3) ----------------------------------
  notice: { duration: 2.0, marks: { turned: 0.9 }, pose: 'sit' },
  rise: { duration: 1.6, marks: { stool: 0.7, up: 1.3 }, pose: 'rise' },

  // ---- the waitress ----------------------------------------------------------------
  serve: { duration: 1.2, marks: { down: 0.8 }, pose: 'reach' },
  pour: { duration: 3.2, marks: { take: 0.5, uncork: 0.9, streamOn: 1.3, streamOff: 2.6 }, pose: 'pour' },
  slide: { duration: 1.2, marks: { release: 0.6 }, pose: 'reach' },
  slideBottle: { duration: 1.0, marks: { release: 0.5 }, pose: 'reach' },
  wipe: { duration: 2.0, marks: {}, pose: 'reach', loop: true },
  lean: { duration: 3.0, marks: {}, pose: 'lean', loop: true },
  duck: { duration: 0.6, marks: { down: 0.4 }, pose: 'duck', hold: true },

  // ---- the cook in the hatch ---------------------------------------------------------
  ring: { duration: 1.0, marks: { ring: 0.4 }, pose: 'reach' },
  plateUp: { duration: 1.4, marks: { down: 0.9 }, pose: 'reach' },

  // ---- civilians in the fight ---------------------------------------------------------
  startle: { duration: 0.8, marks: {}, pose: 'hitBody' },
  cower: { duration: 1.0, marks: { down: 0.6 }, pose: 'duck', hold: true },
  flee: { duration: 1.0, marks: {}, pose: null, state: 'run' },

  // ---- seated (held, looping) ------------------------------------------------------------
  sit: { duration: 4, marks: {}, pose: 'sit', loop: true },
  sitEat: { duration: 4, marks: { bite: 1.6 }, pose: 'sitEat', loop: true },
  sitDrink: { duration: 4, marks: { sip: 1.8 }, pose: 'sitDrink', loop: true },
  sitRead: { duration: 6, marks: { page: 4.5 }, pose: 'sitRead', loop: true },
  sitSmoke: { duration: 5, marks: { drag: 1.5 }, pose: 'sitDrink', loop: true },
  sitTalk: { duration: 4, marks: {}, pose: 'sitEat', loop: true },
};
