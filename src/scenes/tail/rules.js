// The tail's rules in numbers (chase.js applies them; the headless runs in
// tools/lib/c3city.mjs read the same): judged by the bots' proofs
// (tools/plays/tail_idle, tail_bad, tail_good).
export const RULES = {
  unseenWarn: 3.0, unseenLost: 7.0,     // s out of my sight
  farWarn: 85, farLost: 135, farT: 5,   // m behind (and for how long past farWarn + 15)
  gateWarnZ: 110, gateZ: 150,           // his z on the river road: the warning, the pier's gate ([C3b] 70: the window's line comes first)
  wreckWarn: 2.6,                       // [4th owner] my damage: "She won't take much more." (a wreck at 4)
};
// [C3b] what my rounds cost him (chase.js hisHit): his hold on the car
// (control) goes 1 .. HIT.floor and never under - no number of rounds alone
// ends it (the user, 2026-10-03: the gun hurts him, the ram finishes him).
//   a tyre goes on ONE round (the bang, the quarter down, the rim sparking):
//     -HIT.tyre; then he is slower than me and weaves;
//   the man ducks (a round while he is down goes over him), -HIT.man each;
//   the tank leaks, smokes at HIT.tankSmoke, burns at HIT.tankFire (slower);
//   the body a little.
// Hurt (chase.hurt(): a tyre gone, the tank smoking or the man hit), he can
// no longer pull away from me, and a shunt on his back corner spins him.
export const HIT = {
  tyre: 0.4, rim: 0.05, man: [0.15, 0.12, 0.08], tank: 0.08, body: 0.04,
  tankSmoke: 2, tankFire: 4,
  floor: 0.35,
};
// [C3b] the shunt (chase.js rammed): my front wing into his back corner,
// pushing across - the contact behind RAM.behind (m, his frame: his rear
// axle is at -1.55, his tail at -2.45), on a side (|z| > RAM.side), my
// heading RAM.yaw0 .. RAM.yaw1 rad off his and turned into him, closing at
// RAM.imp m/s or more (or held into him RAM.lean s). Hurt: he spins
// (RAM.spin rad/s on his yaw and RAM.shove m/s across, his hands gone:
// the crash on the cars' own
// physics). Whole: a fishtail he catches (RAM.stagger) and he pulls away.
// A straight bump from behind is only a shove.
// [C3b, after the critic] the straight push counts too: my nose square on
// his back CORNER (|z| > RAM.corner: off the middle of his bumper, on the
// corner itself) is the same shunt as the angled one - a first-timer pushes
// the corner straight; only a push on the middle of his bumper is a shove.
export const RAM = { behind: -0.9, side: 0.3, corner: 0.5, yaw0: 0.2, yaw1: 1.15, imp: 1.0, lean: 0.35, spin: 4.2, shove: 5.5, stagger: 0.7 };
// [C3b] he pulls away when I close (phase a, and a whole car in phase b):
// within PULL.near m behind him (PULL.react s: his eyes in the mirror)
// he floors it for PULL.t s (his car briefly
// faster than mine: PULL.vmax, PULL.accel), then falls back to his pace;
// not again for PULL.cool s - unless I am still on him (within PULL.near):
// then at once ([C3b, after the critic] the critic held his bumper 5 s
// through a cool-down). A whole car is PULL.mass heavy to my nose (a graze
// jolts it, never turns it off its line).
export const PULL = { near: 10, react: 0.25, t: 3.2, cool: 2.0, vmax: 26, accel: 9.5, pathV: 25, aLat: 7.2, aBrake: 6.5, mass: 2.6 };
// [C3b] phase b's window: he runs the river road at RIVER_B.cruise m/s
// (less as he is hurt: x (0.55 + 0.45 control)); from RIVER_B.warn s he
// finds speed - the limp and the smoke still on him - toward RIVER_B.away
// (over my coupe's top, 22.5, hurt or whole), all of it by RIVER_B.t s; once
// he is out-running me (or RIVER_B.pullGap m off) "He's pulling away.";
// "Lost him." only when he is really gone: RIVER_B.lostGap m clear. (The
// pier's gate, if he reaches it first: "He warned them.")
// ([C3b, after the critic] the fail was a timer whatever the gap, and a hurt
// car's getaway was slower than my coupe: "Lost him." with him 15 m ahead)
// (and the warning up RIVER_B.warnRead s at least before the fail: held up
// behind a slow car he can go from near to gone in a second)
export const RIVER_B = { cruise: 10, away: 26, warn: 16, t: 23, pullGap: 20, lostGap: 42, warnRead: 2.5 };
// [3rd owner] the teach cards (the kit draws [X] as a key cap, [LMB] / [RMB]
// as a mouse; seams/Z.md §2)
export const TEACH = {
  drive: '[W] drive  [A] [D] steer  [S] brake',
  handbrake: '[SPACE] handbrake: swing round a tight corner',
  gun: '[RMB] lean out and aim  [LMB] fire',
  // [C3b] (the first time he is hurt: the shunt finishes him)
  ram: '[A] [D] ram his back corner',
};
