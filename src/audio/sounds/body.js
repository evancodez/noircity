// The body's sounds (scene 3, lane B1): the alley's own room (the rain in a
// narrow place: the gutters running, the drain, drips off the fire
// escape), the car that pulls away, the strings, the ladder, the paper.
export default (k) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, noise, tear, rng } = k;
  return {
    sounds: {
      // a string drawn taut through the wound: a dry low pluck, the pin ticking
      stringTaut(ctx, out, t0, p, R) {
        const f = 150 + rng(-8, 8);
        const o = osc(ctx, 'triangle', f, t0, 0.5);
        o.frequency.setValueAtTime(f * 1.25, t0); o.frequency.exponentialRampToValueAtTime(f, t0 + 0.04);
        const g = gain(ctx); env(g, t0, 0.24, 0.002, 0.42);
        chain(o, filt(ctx, 'lowpass', 1400, 1.2), g, out);
        burst(ctx, out, R, t0, 'white', ['bandpass', 3200, 2], 0.08, 0.001, 0.03);
        ping(ctx, out, t0 + 0.005, [[2600, 0.04, 0.05]]);
        return 0.6;
      },
      // a fingertip on wet paper, on card
      paperTouch(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 2400, 0.9], 0.05, 0.004, 0.06); return 0.1; },
      // two torn edges meeting: a soft wet pat and a small tick
      paperJoin(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'pink', ['bandpass', 900, 0.8], 0.12, 0.003, 0.08);
        ping(ctx, out, t0 + 0.01, [[1800, 0.05, 0.03]]);
        return 0.15;
      },
      noteWhole(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'pink', ['bandpass', 700, 0.7], 0.1, 0.02, 0.35); return 0.4; },
      // the half of the cover home on the book: a card's click
      matchSnap(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 4200, 2.2], 0.22, 0.0008, 0.018);
        thud(ctx, out, t0, 420, 260, 0.08, 0.03);
        ping(ctx, out, t0 + 0.002, [[3100, 0.05, 0.02]]);
        return 0.1;
      },
      // the paper folded and into the coat
      foldNote(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 2000, 0.8], 0.08, 0.01, 0.12);
        burst(ctx, out, R, t0 + 0.22, 'white', ['bandpass', 1600, 0.8], 0.06, 0.01, 0.1);
        burst(ctx, out, R, t0 + 0.5, 'white', ['bandpass', 1900, 0.8], 0.06, 0.03, 0.22);
        return 0.8;
      },
      // his fingers opened, the wet paper peeled off his palm
      fistOpen(ctx, out, t0, p, R) {
        tear(ctx, out, t0 + 0.15, R, 0.35, 900, 2600, 0.6, 30);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 500, 0.7], 0.06, 0.05, 0.2);
        return 0.6;
      },
      // the drop ladder let down: iron sliding in its guides, the clatter
      // of its feet on the flags, a bounce, the ring of it
      ladderDrop(ctx, out, t0, p, R) {
        const sl = noise(ctx, R, 'white', t0, 0.42);
        const bp = filt(ctx, 'bandpass', 1400, 1.4);
        bp.frequency.setValueAtTime(900, t0); bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.4);
        const g = gain(ctx); env(g, t0, 0.18, 0.05, 0.35);
        chain(sl, bp, g, out);
        const hit = t0 + 0.42;
        thud(ctx, out, hit, 160, 70, 0.55, 0.25);
        burst(ctx, out, R, hit, 'white', ['bandpass', 1700, 1.2], 0.35, 0.001, 0.12);
        ping(ctx, out, hit, [[410, 0.2, 0.9], [1130, 0.12, 0.6], [2380, 0.06, 0.4]]);
        thud(ctx, out, hit + 0.16, 180, 90, 0.2, 0.12);
        ping(ctx, out, hit + 0.16, [[640, 0.08, 0.4], [1500, 0.05, 0.3]]);
        return 1.6;
      },
      // a hand or a foot on a rung
      rung(ctx, out, t0, p, R) {
        const f = (p && p.f) || rng(380, 520);
        ping(ctx, out, t0, [[f, 0.09, 0.35], [f * 2.76, 0.04, 0.2]]);
        burst(ctx, out, R, t0, 'white', ['bandpass', 2200, 1.5], 0.05, 0.001, 0.02);
        return 0.4;
      },
      // a knee on the wet stone
      kneel(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 2100, 0.8], 0.05, 0.05, 0.3);
        thud(ctx, out, t0 + 0.28, 120, 80, 0.12, 0.08);
        burst(ctx, out, R, t0 + 0.28, 'pink', ['lowpass', 900], 0.08, 0.002, 0.08);
        return 0.5;
      },
      // the brass case turned over on the grating
      casingTick(ctx, out, t0) { ping(ctx, out, t0, [[3900, 0.06, 0.12], [6100, 0.03, 0.06]]); return 0.15; },
      // the car pulling out of the alley and away: the engine caught and
      // taken up through the gears, the tyres hissing on the wet
      carAway(ctx, out, t0, p, R) {
        const dur = 7.5;
        const e = osc(ctx, 'sawtooth', 38, t0, dur);
        e.frequency.setValueAtTime(34, t0);
        e.frequency.linearRampToValueAtTime(58, t0 + 1.6);
        e.frequency.linearRampToValueAtTime(44, t0 + 1.9);
        e.frequency.linearRampToValueAtTime(70, t0 + 4.0);
        e.frequency.linearRampToValueAtTime(60, t0 + dur);
        const eg = gain(ctx); eg.gain.setValueAtTime(0.0001, t0); eg.gain.linearRampToValueAtTime(0.14, t0 + 0.3); eg.gain.setValueAtTime(0.14, t0 + 2.5); eg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        chain(e, filt(ctx, 'lowpass', 320, 1.5), eg, out);
        const h = noise(ctx, R, 'pink', t0, dur);
        const hg = gain(ctx); hg.gain.setValueAtTime(0.0001, t0); hg.gain.linearRampToValueAtTime(0.08, t0 + 2.0); hg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        chain(h, filt(ctx, 'bandpass', 1300, 0.6), hg, out);
        return dur;
      },
    },
    rooms: {
      // the alley: out in the rain, but narrow: the gutters and the drain
      // under it, drips off the iron
      alley: {
        inside: false,
        bed(ctx, R, out, kk) {
          const srcs = [];
          const g = kk.gain(ctx, 0.0001);
          g.connect(out);
          // the drain: water falling into the dark, a hollow gurgle
          const d = kk.loopN(ctx, R, 'brown', 1.6, srcs);
          const dg = kk.gain(ctx, 0.07);
          kk.chain(d, kk.filt(ctx, 'bandpass', 380, 3), dg, g);
          kk.lfo(ctx, 0.7, 0.03, dg.gain, 'sine', srcs);
          // the gutter running: a thin bright trickle
          kk.chain(kk.loopN(ctx, R, 'pink', 1.9, srcs), kk.filt(ctx, 'bandpass', 2900, 1.8), kk.gain(ctx, 0.022), g);
          // drips off the fire escape: a plinking square LFO on a ping-ish band
          const dp = kk.gain(ctx, 0.0);
          kk.chain(kk.loopN(ctx, R, 'white', 1, srcs), kk.filt(ctx, 'bandpass', 4200, 9), dp, g);
          kk.lfo(ctx, 2.3, 0.05, dp.gain, 'square', srcs);
          return { gain: g, stop() { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch (e) { /* */ } setTimeout(() => { for (const s of srcs) { try { s.stop(); } catch (e) { /* */ } } try { g.disconnect(); } catch (e) { /* */ } }, 600); } };
        },
      },
    },
  };
};
