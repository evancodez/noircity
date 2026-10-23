// [O4] Lane O4's sounds (procedural, Sfx.js's kit), through sfx.play(name):
//   o4_shotgun   the double's report: a wide, heavy boom - a deep thump, a
//                long brown roar, a dull crack (no ring), the street's tail
//   o4_sgBreak   the top lever thrown and the barrels dropping on the hinge
//   o4_sgEject   the extractors kicking the two hulls out (two paper knocks)
//   o4_sgShell   a shell thumbed into a chamber (a soft slide and a seat)
//   o4_sgClose   the barrels snapped up: a hard double clack
//   o4_bell      the gym's ring bell (two strokes)
//   o4_till      the gun shop's till (a bell and the drawer)
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, noise, shaper, rng } = kit;
  const knock = (ctx, out, R, t, f, a) => { burst(ctx, out, R, t, 'white', ['bandpass', f, 2.4], a, 0.0008, 0.03); thud(ctx, out, t, f * 0.08, f * 0.05, a * 0.5, 0.05); };
  return {
    sounds: {
      o4_shotgun(ctx, out, t0, p, R, send) {
        const pv = p.pitch ?? rng(0.94, 1.03);
        const sat = shaper(ctx, 3.2);
        chain(sat, gain(ctx, 1.0), out);
        // the crack: broad, darker than the revolver's
        const n = noise(ctx, R, 'white', t0, 0.45, pv);
        const g1 = gain(ctx); env(g1, t0, 1.0, 0.001, 0.16);
        chain(n, filt(ctx, 'highpass', 180 * pv), filt(ctx, 'lowpass', 4800), g1, sat);
        // the thump: 90 Hz down to 30 over a third of a second
        const th = osc(ctx, 'sine', 95 * pv, t0, 0.55);
        th.frequency.setValueAtTime(95 * pv, t0); th.frequency.exponentialRampToValueAtTime(30, t0 + 0.32);
        const g2 = gain(ctx); env(g2, t0, 1.5, 0.002, 0.4);
        chain(th, g2, sat);
        // the roar: low brown noise, long
        const bm = noise(ctx, R, 'brown', t0, 0.7, pv);
        const g5 = gain(ctx); env(g5, t0, 1.4, 0.002, 0.42);
        chain(bm, filt(ctx, 'lowpass', 260), g5, sat);
        if (send) {
          const gs = gain(ctx); env(gs, t0, 1.8, 0.003, 0.3); chain(n, gs, send);
          chain(g5, gain(ctx, 1.0), send);
          const sl = noise(ctx, R, 'white', t0 + 0.2, 0.25, 0.8 * pv);
          const gsl = gain(ctx); env(gsl, t0 + 0.2, 0.5, 0.005, 0.18);
          chain(sl, filt(ctx, 'bandpass', 600, 0.7), gsl, send);
        }
        return 1.0;
      },
      o4_sgBreak(ctx, out, t0, p, R) { knock(ctx, out, R, t0, 2600, 0.5); knock(ctx, out, R, t0 + 0.07, 1500, 0.4); burst(ctx, out, R, t0 + 0.05, 'pink', ['bandpass', 1200, 1.4], 0.12, 0.01, 0.12); return 0.35; },
      o4_sgEject(ctx, out, t0, p, R) { knock(ctx, out, R, t0, 1100, 0.45); knock(ctx, out, R, t0 + 0.035, 1000, 0.4); burst(ctx, out, R, t0 + 0.01, 'pink', ['bandpass', 700, 1.2], 0.18, 0.01, 0.15); return 0.3; },
      o4_sgShell(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'pink', ['bandpass', 900, 1.5], 0.16, 0.03, 0.06); knock(ctx, out, R, t0 + 0.06, 1300, 0.35); return 0.2; },
      o4_sgClose(ctx, out, t0, p, R) { knock(ctx, out, R, t0, 2200, 0.7); knock(ctx, out, R, t0 + 0.022, 3100, 0.5); ping(ctx, out, t0 + 0.004, [[1900, 0.03, 0.08]]); return 0.3; },
      o4_bell(ctx, out, t0) {
        for (const t of [t0, t0 + 0.35]) ping(ctx, out, t, [[1180, 0.3, 1.6], [2410, 0.12, 1.1], [3570, 0.06, 0.7]]);
        return 2.2;
      },
      o4_till(ctx, out, t0, p, R) {
        ping(ctx, out, t0, [[2600, 0.18, 0.6], [3900, 0.08, 0.4]]);
        burst(ctx, out, R, t0 + 0.12, 'white', ['bandpass', 1800, 1.0], 0.15, 0.02, 0.18);
        thud(ctx, out, t0 + 0.32, 140, 80, 0.3, 0.1);
        return 0.8;
      },
    },
  };
};
