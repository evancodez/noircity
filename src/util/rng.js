// Deterministic RNG (mulberry32). Every procedural choice in the world goes
// through one of these so ?shot= screenshots are reproducible frame to frame.
export class RNG {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; this.seed0 = this.s; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  chance(p) { return this.next() < p; }
  gauss() { // Box-Muller, mean 0 sd 1
    const u = Math.max(1e-9, this.next()), v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v);
  }
  // Independent child stream keyed by (root seed, salt): adding draws to one
  // module never reshuffles another module's layout.
  fork(salt) { return new RNG((this.seed0 ^ Math.imul(salt + 1, 0x9E3779B1)) >>> 0); }
}

export function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
