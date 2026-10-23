// [O4] The men of a street fight (docs/briefs/O4_COMBAT.md §1): who they are
// and how each fights, as data. The crowd brawl (Crowd.js) reads only this
// table for a man's numbers; the blows themselves are the brawler's clips
// and their marks (src/cast/brawl/clips.js BR_ATTACKS: the tell, the strike,
// the contact, the path a blow sweeps).
//   cast     the cast kind (a costume, src/cast/kinds/o4_*.js)
//   hp       his hit points (my jab 4, my heavy 15, a counter half again)
//   speed    m/s on his feet in the ring
//   tell     x the length of his blows (a drunk's 1.35: slow and wide)
//   gap      s between his blows when he is the one in
//   guard    how often a jab into his guard is caught (the rest find him:
//            a drunk's guard is a gate left open)
//   answer   how often a punch caught in his guard is answered at once
//   open     x how long he stays open after a blow of his missed
//   breathe  s between his breaths (a hand lowered: open a moment); 0 never
//   dmg      x his blows' damage
//   breaks   my heavy into his guard breaks it (else it is caught too)
//   getUp    down once, he gets up once (slower, with a third of himself)
//   feint    how often his tell is a feint
//   combo    how often a blow that found me is followed on its heels
//   mix      his blows and how often (a man out of my sight throws only
//            the big ones, which come with the dodge cue)
//   say      what the line calls him ('the drunk', 'the cop')
export const MEN = {
  drunk: {
    cast: 'docker', name: 'DRUNK', say: 'the drunk', hp: 34, speed: 1.4, tell: 1.35, gap: [1.5, 2.3], guard: 0.3, answer: 0.25,
    open: 1.35, breathe: 2.6, dmg: 0.9, breaks: true, getUp: false, feint: 0, combo: 0.05,
    mix: { br_haymaker: 0.32, br_haymakerL: 0.24, br_hook: 0.18, br_shove: 0.14, br_jab: 0.12 },
  },
  driver: {
    cast: 'tail_trucker', name: 'DRIVER', say: 'the driver', hp: 44, speed: 1.8, tell: 1.15, gap: [1.2, 1.9], guard: 0.6, answer: 0.4,
    open: 1.15, breathe: 3.4, dmg: 1.0, breaks: true, getUp: false, feint: 0.05, combo: 0.15,
    mix: { br_jab: 0.26, br_cross: 0.14, br_hook: 0.24, br_hookL: 0.16, br_body: 0.1, br_shove: 0.1 },
  },
  gangster: {
    cast: 'couple_him', name: 'HOOD', say: 'the hood', hp: 48, speed: 2.1, tell: 1.0, gap: [0.9, 1.5], guard: 0.75, answer: 0.55,
    open: 1.0, breathe: 3.8, dmg: 1.05, breaks: true, getUp: true, feint: 0.16, combo: 0.25,
    mix: { br_jab: 0.24, br_hook: 0.2, br_hookL: 0.2, br_body: 0.14, br_cross: 0.12, br_haymaker: 0.1 },
  },
  cop: {
    cast: 'dockhand', name: 'COP', say: 'the cop', hp: 56, speed: 1.9, tell: 1.05, gap: [1.0, 1.6], guard: 0.88, answer: 0.5,
    open: 0.95, breathe: 4.2, dmg: 1.0, breaks: 2, getUp: true, feint: 0.05, combo: 0.2, grabs: true,
    mix: { br_jab: 0.26, br_cross: 0.18, br_hook: 0.16, br_shove: 0.24, br_body: 0.16 },
  },
  boxer: {
    cast: 'brawler', name: 'BOXER', say: 'the boxer', hp: 80, speed: 2.3, tell: 0.92, gap: [0.7, 1.2], guard: 0.94, answer: 0.7,
    open: 0.9, breathe: 4.6, dmg: 1.1, breaks: false, getUp: true, feint: 0.14, combo: 0.35,
    mix: { br_jab: 0.22, br_jabR: 0.08, br_cross: 0.14, br_hook: 0.16, br_hookL: 0.16, br_body: 0.12, br_bodyL: 0.12 },
  },
};
// the gym's boxer by his level (1..3): his numbers over the table's
export const BOXER_LEVELS = [
  null,
  { hp: 60, tell: 1.08, gap: [1.0, 1.6], guard: 0.85, answer: 0.5, open: 1.05, dmg: 0.9, combo: 0.2, feint: 0.08, purse: 40, bet: 10, name: 'KID LEARY' },
  { hp: 80, tell: 0.98, gap: [0.8, 1.35], guard: 0.92, answer: 0.62, open: 0.95, dmg: 1.0, combo: 0.3, feint: 0.12, purse: 100, bet: 25, name: 'SAILOR DOYLE' },
  { hp: 100, tell: 0.9, gap: [0.65, 1.15], guard: 0.95, answer: 0.72, open: 0.88, dmg: 1.12, combo: 0.38, feint: 0.16, purse: 240, bet: 60, name: 'IRON MIKE ROURKE' },
];
// the blows a man throws when he is out of my sight (they come with the cue)
export const BIG = /^br_(hook|hookL|body|bodyL|haymaker|haymakerL|shove|rush)$/;
