// Lightning & thunder (Phase 3a). Every 25-60 s a strike: the pipeline's
// lightning envelope (a double flicker: pipeline.pulseLightning) floods the
// sky, kicks the ink tone curve (render/shaders/ink.js uLightning: the
// exposure jumps and, on the first frame, the mid-tones snap toward
// paper - the one-frame inversion feel) and lengthens the rain (the lit
// streaks show everywhere, not only inside the cones). Thunder follows
// 1-3 s later (further strikes: later, softer, longer). About one strike in
// four is a double. Never during the first 5 s of a wave (the wave card
// owns that moment); the Game passes `quiet` then.
export class Storm {
  constructor(world, pipeline) {
    this.world = world;
    this.pipeline = pipeline;
    this.rng = world.rng.fork(2525);
    this.next = this.rng.range(12, 30);
    this.queue = [];           // pending { t, fn }
    this.strikes = 0;
    this.onThunder = null;     // (delay s, strength 0..1, dist 0..1)
    this.time = 0;
    this.rainBoost = 0;
  }

  strike(strength = 1, double = null) {
    const r = this.rng, t = this.time;
    this.strikes++;
    const far = r.next();                       // 0 near .. 1 far
    const s = strength * (0.75 + 0.35 * (1 - far));
    this.pipeline.pulseLightning(t, s, 0.35 + 0.15 * r.next());
    this.rainBoost = 1;
    const dbl = double ?? r.chance(0.25);
    if (dbl) this.queue.push({ t: t + r.range(0.45, 0.8), fn: () => { this.pipeline.pulseLightning(this.time, s * 0.85, 0.3); this.rainBoost = 1; } });
    const delay = 1 + far * 2;
    if (this.onThunder) this.queue.push({ t: t + delay, fn: () => this.onThunder(s, far, dbl) });
    this.last = { t, s, far, dbl, delay };
  }

  update(dt, t, { quiet = false } = {}) {
    this.time = t;
    for (let i = this.queue.length - 1; i >= 0; i--) if (t >= this.queue[i].t) { const q = this.queue[i]; this.queue.splice(i, 1); q.fn(); }
    this.rainBoost = Math.max(0, this.rainBoost - dt * 0.8);
    this.next -= dt;
    if (this.next <= 0) {
      if (quiet) this.next = 1;
      else { this.strike(); this.next = this.rng.range(25, 60); }
    }
  }
}
