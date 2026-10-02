// The tail's rules in numbers (chase.js applies them; the headless runs in
// tools/lib/c3city.mjs read the same): judged by the bots' proofs
// (tools/plays/tail_idle, tail_bad, tail_good).
export const RULES = {
  unseenWarn: 3.0, unseenLost: 7.0,     // s out of my sight
  farWarn: 85, farLost: 135, farT: 5,   // m behind (and for how long past farWarn + 15)
  gateWarnZ: 70, gateZ: 150,            // his z on the river road: the warning, the pier's gate
};
// [3rd owner] the teach cards (the kit draws [X] as a key cap, [LMB] / [RMB]
// as a mouse; seams/Z.md §2)
export const TEACH = {
  drive: '[W] drive  [A] [D] steer  [S] brake',
  handbrake: '[SPACE] handbrake: swing round a tight corner',
  gun: '[RMB] lean out and aim  [LMB] fire',
};
