// The city's traffic in the tail (lane C3): a few cars with their own
// headlamps going about (they keep their lane, stop at a junction, brake for
// me, sound the horn, and are solid), put where the chase is going so the
// road ahead is never empty and never the same twice. (A stub until its
// pass: no cars yet.)
export class Traffic {
  constructor(chase) { this.chase = chase; this.cars = []; }
  step() {}
  dispose() {}
}
