// The revolver's sounds (lane B3), procedural as the rest (Sfx.js's kit):
//   revolver    the .38's report: deeper and rounder than the Hoods'
//               pistols (a heavier thump, a slower crack), the room's tail
//               on the send and a slap off the far wall
//   revDry      the hammer falling on an empty chamber: one hard click
//   revOpen     the latch, the crane swinging out (a short metal slide)
//   revEject    the rod's stroke, then six cases falling out (their rings on
//               the floor are the casings' own ticks)
//   revRound    a pair of rounds pushed home
//   revShut     the cylinder swung shut: a snap and its lock
//   revDraw / revHolster   cloth and leather, the gun out of / into the coat
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, noise, shaper, rng } = kit;
  // a small mechanical click: a bandpassed tick with a low knock under it
  const click = (ctx, out, R, t, f, a, body = 0.35) => {
    burst(ctx, out, R, t, 'white', ['bandpass', f, 3.2], a, 0.0005, 0.016);
    const o = osc(ctx, 'triangle', f * 0.27, t, 0.05);
    const g = gain(ctx); env(g, t, a * body, 0.001, 0.028);
    chain(o, g, out);
  };
  return {
    sounds: {
      revolver(ctx, out, t0, p, R, send) {
        const pv = p.pitch ?? rng(0.95, 1.04);
        const sat = shaper(ctx, 2.6);
        chain(sat, gain(ctx, 0.95), out);
        // the crack: band-limited noise, a darker presence than the Tommy's
        const n = noise(ctx, R, 'white', t0, 0.3, pv);
        const g1 = gain(ctx); env(g1, t0, 0.95, 0.001, 0.11);
        const pk = filt(ctx, 'peaking', 1400 * pv, 1.1); pk.gain.value = 6;
        chain(n, filt(ctx, 'highpass', 300 * pv), filt(ctx, 'lowpass', 7000), pk, g1, sat);
        // the thump: a sine from 120 Hz down to 36 over 0.22 s (the chest)
        const th = osc(ctx, 'sine', 120 * pv, t0, 0.4);
        th.frequency.setValueAtTime(120 * pv, t0);
        th.frequency.exponentialRampToValueAtTime(36, t0 + 0.22);
        const g2 = gain(ctx); env(g2, t0, 1.25, 0.002, 0.28);
        chain(th, g2, sat);
        // the boom: low brown noise, the blast's pressure
        const bm = noise(ctx, R, 'brown', t0, 0.35, pv);
        const g5 = gain(ctx); env(g5, t0, 1.15, 0.001, 0.24);
        chain(bm, filt(ctx, 'lowpass', 190), g5, sat);
        // the bark: a saw sweep, the low-mid punch
        const bk = osc(ctx, 'sawtooth', 210 * pv, t0, 0.1);
        bk.frequency.exponentialRampToValueAtTime(70 * pv, t0 + 0.07);
        const g3 = gain(ctx); env(g3, t0, 0.6, 0.001, 0.06);
        chain(bk, filt(ctx, 'lowpass', 1100), g3, sat);
        // the gun's own metal: a short ring of the frame
        ping(ctx, out, t0 + 0.004, [[2300 * pv, 0.05, 0.09], [3900 * pv, 0.03, 0.05]]);
        // the room (or the street) answers: a long send and a slap
        if (send) {
          const gs = gain(ctx); env(gs, t0, 1.5, 0.002, 0.16); chain(n, gs, send);
          chain(g2, gain(ctx, 0.9), send);
          chain(g5, gain(ctx, 0.7), send);
          const sl = noise(ctx, R, 'white', t0 + 0.16, 0.16, 0.85 * pv);
          const gsl = gain(ctx); env(gsl, t0 + 0.16, 0.45, 0.004, 0.11);
          chain(sl, filt(ctx, 'bandpass', 700, 0.8), gsl, send);
        }
        return 0.7;
      },
      revDry(ctx, out, t0, p, R) { click(ctx, out, R, t0, 2800, 0.5, 0.5); click(ctx, out, R, t0 + 0.012, 1700, 0.2); return 0.1; },
      revCock(ctx, out, t0, p, R) { click(ctx, out, R, t0, 3300, 0.3); click(ctx, out, R, t0 + 0.07, 2500, 0.42, 0.5); return 0.14; },
      revOpen(ctx, out, t0, p, R) {
        click(ctx, out, R, t0, 3000, 0.4);
        const n = noise(ctx, R, 'white', t0 + 0.02, 0.14);
        const bp = filt(ctx, 'bandpass', 2400, 3); bp.frequency.setValueAtTime(2400, t0 + 0.02); bp.frequency.linearRampToValueAtTime(1500, t0 + 0.12);
        const g = gain(ctx); env(g, t0 + 0.02, 0.24, 0.01, 0.09);
        chain(n, bp, g, out);
        click(ctx, out, R, t0 + 0.12, 1900, 0.32);
        return 0.2;
      },
      revEject(ctx, out, t0, p, R) {
        // the rod driven home by the palm: a knock and a scrape
        thud(ctx, out, t0, 190, 90, 0.35, 0.06);
        const n = noise(ctx, R, 'white', t0, 0.08);
        const g = gain(ctx); env(g, t0, 0.2, 0.002, 0.05);
        chain(n, filt(ctx, 'bandpass', 3000, 2), g, out);
        // six cases sliding out and knocking together
        for (let i = 0; i < 6; i++) {
          const t = t0 + 0.02 + i * 0.011 + Math.random() * 0.01;
          const f = rng(4200, 6400);
          ping(ctx, out, t, [[f, rng(0.04, 0.08), 0.03], [f * 2.7, 0.02, 0.02]]);
        }
        return 0.25;
      },
      revRound(ctx, out, t0, p, R) {
        const n = noise(ctx, R, 'white', t0, 0.06);
        const g = gain(ctx); env(g, t0, 0.12, 0.003, 0.04);
        chain(n, filt(ctx, 'bandpass', 3600, 2.5), g, out);
        click(ctx, out, R, t0 + 0.035, 2400, 0.3, 0.3);
        click(ctx, out, R, t0 + 0.046, 2700, 0.26, 0.3);
        return 0.1;
      },
      revShut(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 240, 110, 0.4, 0.05);
        click(ctx, out, R, t0, 2600, 0.45, 0.5);
        click(ctx, out, R, t0 + 0.018, 3400, 0.22);
        return 0.12;
      },
      revDraw(ctx, out, t0, p, R) {
        // the coat's cloth, the leather of the holster, the gun out
        const n = noise(ctx, R, 'pink', t0, 0.3);
        const g = gain(ctx); env(g, t0, 0.3, 0.03, 0.18);
        chain(n, filt(ctx, 'bandpass', 900, 0.9), g, out);
        const l = noise(ctx, R, 'brown', t0 + 0.12, 0.18, 1.6);
        const gl = gain(ctx); env(gl, t0 + 0.12, 0.42, 0.01, 0.1);
        chain(l, filt(ctx, 'bandpass', 520, 1.4), gl, out);
        click(ctx, out, R, t0 + 0.3, 3100, 0.22, 0.3);
        return 0.4;
      },
      revHolster(ctx, out, t0, p, R) {
        const l = noise(ctx, R, 'brown', t0 + 0.05, 0.2, 1.6);
        const gl = gain(ctx); env(gl, t0 + 0.05, 0.4, 0.01, 0.12);
        chain(l, filt(ctx, 'bandpass', 480, 1.4), gl, out);
        const n = noise(ctx, R, 'pink', t0 + 0.12, 0.25);
        const g = gain(ctx); env(g, t0 + 0.12, 0.26, 0.03, 0.15);
        chain(n, filt(ctx, 'bandpass', 900, 0.9), g, out);
        return 0.4;
      },
    },
  };
};
