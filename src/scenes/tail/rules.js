// The tail's rules in numbers (chase.js applies them; the headless runs in
// tools/lib/c3city.mjs read the same): judged by the bots' proofs
// (tools/plays/tail_idle, tail_bad, tail_good).
export const RULES = {
  unseenWarn: 3.0, unseenLost: 7.0,     // s out of my sight
  farWarn: 85, farLost: 135, farT: 5,   // m behind (and for how long past farWarn + 15)
  gateWarnZ: 70, gateZ: 150,            // his z on the river road: the warning, the pier's gate
};
// [4th owner] what my rounds cost him (chase.js hisHit), and the ends they
// make: his hold on the car (control) goes 1 .. 0, and at HIT.lose or under
// he has lost it. Each way off the road is a thing he shows first:
//   two tyres gone (one a side; a tyre takes two rounds: the first and it
//     hisses and goes soft, the quarter dipping half way; the second blows
//     it - the quarter down, the rim sparking),
//   the man three times (he ducks after the first and a round while he is
//     down goes over him: wait for him to come up),
//   the tank four times (a leak, smoke at two, thick at three, fire at four:
//     the fire takes him FIRE_T s later),
//   or his hold worn down by a mix.
// The critic, 2nd look: three hits anywhere (tyre 0.4 + rim 0.25 + tank 0.22)
// finished him, sloppy aim won first try in 8 to 12 s.
export const HIT = {
  nick: 0.08, tyre: 0.2, rim: 0.06, man: [0.1, 0.2], tank: 0.08, body: 0.04,
  tankSmoke: 2, tankFire: 4, fireT: 2.5,
  lose: 0.15,
};
// [4th owner] the shunt (chase.js rammed): my car into his back quarter from
// the side - pushed across, behind his middle - when he is really hurt (a
// tyre gone, the man hit twice, his tank smoking, or his hold at HURT.control
// or under) puts him off the road; anywhere else, or whole, it only jolts
// him. A straight bump from behind never does (the critic's blocker: one
// round anywhere and a touch from behind ended it).
export const RAM = { imp: 2.5, across: 0.6, behind: -0.6, flank: 0.55, hurtControl: 0.5, jolt: 0.06 };
// [3rd owner] the teach cards (the kit draws [X] as a key cap, [LMB] / [RMB]
// as a mouse; seams/Z.md §2)
export const TEACH = {
  drive: '[W] drive  [A] [D] steer  [S] brake',
  handbrake: '[SPACE] handbrake: swing round a tight corner',
  gun: '[RMB] lean out and aim  [LMB] fire',
  // [4th owner] (the gun dry and he still going, hurt: the shunt)
  ram: '[A] [D] out of rounds: shunt his back corner from the side',
};
