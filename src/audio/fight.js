// The fight's new sounds (round 2, the fight's owner): procedural Web Audio,
// merged into the sound table of Sfx.js (each is (ctx, out, t0, p, R) ->
// seconds, as every sound there; 'f_' names are the fight's, played by
// sfx.fight(name)).
//   f_shove    his two hands into my chest: a dull thump, the coat's rustle
//   f_cups     my back into the counter: the cups and saucers jump and clink
//   f_counter  his back into the counter's edge: the thump and the china
const rnd = (a, b) => a + (b - a) * Math.random();
function noiseBuf(ctx, secs) {
  const n = Math.max(1, Math.round(ctx.sampleRate * secs));
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { last = last * 0.86 + (Math.random() * 2 - 1) * 0.14; d[i] = last * 3; }
  return b;
}
function thump(ctx, out, t0, f0, f1, peak, dur) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
function rustle(ctx, out, t0, peak, dur, f = 1200) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, dur + 0.05);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.7;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bp).connect(g).connect(out); s.start(t0); s.stop(t0 + dur + 0.05);
}
function clink(ctx, out, t0, f, peak) {
  for (const [m, k] of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak * k, t0 + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12 / m + 0.05);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + 0.3);
  }
}

export const FIGHT_SOUNDS = {
  f_shove(ctx, out, t0, p) {
    const k = (p && p.k) ?? 1;
    thump(ctx, out, t0, 120, 55, 0.5 * k, 0.22);
    rustle(ctx, out, t0, 0.12 * k, 0.28, 900);
    return 0.35;
  },
  f_cups(ctx, out, t0, p) {
    const k = (p && p.k) ?? 1;
    const n = 5 + Math.round(3 * k);
    for (let i = 0; i < n; i++) clink(ctx, out, t0 + rnd(0, 0.22), rnd(1700, 3300), 0.05 * k);
    return 0.5;
  },
  f_counter(ctx, out, t0, p) {
    const k = (p && p.k) ?? 1;
    thump(ctx, out, t0, 95, 45, 0.7 * k, 0.3);
    rustle(ctx, out, t0, 0.1 * k, 0.2, 600);
    for (let i = 0; i < 6; i++) clink(ctx, out, t0 + rnd(0.02, 0.3), rnd(1500, 3000), 0.04 * k);
    return 0.6;
  },
};
