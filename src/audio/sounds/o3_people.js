// [O3] The people's and the police's sounds (lane O3, NOIR CITY): the
// siren's wail (one rise and fall: the car plays it again as it rings out,
// heard a street away before the car is seen), the cruise's single low
// yelp (the search: the siren dropped), the beat cop's whistle (he has seen
// it), a woman's and a man's cry (a gun out, a shot), a man's 'Hey!' (pushed
// past, run at), the call box (the receiver off its hook and the bell's
// tick: the witness is calling it in), a crowd's murmur (they gather), the
// handcuffs (the arrest).
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, rng, voice } = kit;
  return {
    sounds: {
      // the siren: a two-second wail, up and down, through a horn's throat
      o3_siren(ctx, out, t0, p, R) {
        const k = p.k ?? 1, dur = p.dur ?? 2.2;
        const o = osc(ctx, 'sawtooth', 520, t0, dur);
        o.frequency.setValueAtTime(480, t0);
        o.frequency.linearRampToValueAtTime(980, t0 + dur * 0.45);
        o.frequency.linearRampToValueAtTime(500, t0 + dur);
        const o2 = osc(ctx, 'square', 523, t0, dur);
        o2.frequency.setValueAtTime(482, t0);
        o2.frequency.linearRampToValueAtTime(984, t0 + dur * 0.45);
        o2.frequency.linearRampToValueAtTime(502, t0 + dur);
        const g = gain(ctx); env(g, t0, 0.07 * k, 0.12, dur * 0.3, dur * 0.6);
        const g2 = gain(ctx, 0.35);
        chain(o2, g2, g);
        chain(o, filt(ctx, 'bandpass', 900, 0.9), filt(ctx, 'lowpass', 2600), g, out);
        void R; void burst;
        return dur + 0.1;
      },
      // the cruise: the siren dropped to one low yelp now and then (the search)
      o3_yelp(ctx, out, t0, p) {
        const k = p.k ?? 1;
        const o = osc(ctx, 'sawtooth', 380, t0, 0.5);
        o.frequency.linearRampToValueAtTime(620, t0 + 0.18);
        o.frequency.linearRampToValueAtTime(340, t0 + 0.5);
        const g = gain(ctx); env(g, t0, 0.05 * k, 0.04, 0.3, 0.12);
        chain(o, filt(ctx, 'bandpass', 700, 1.1), g, out);
        return 0.6;
      },
      // the whistle: two blasts, the pea rattling in it
      o3_whistle(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        for (const [dt, len] of [[0, 0.32], [0.42, 0.62]]) {
          const o = osc(ctx, 'sine', rng(2650, 2800), t0 + dt, len);
          const trill = osc(ctx, 'sine', rng(26, 34), t0 + dt, len);
          const tg = gain(ctx, 140); chain(trill, tg, o.frequency);
          const g = gain(ctx); env(g, t0 + dt, 0.11 * k, 0.015, len * 0.6, len * 0.35);
          chain(o, g, out);
          burst(ctx, out, R, t0 + dt, 'white', ['bandpass', 3200, 2], 0.03 * k, 0.01, len * 0.8);
        }
        return 1.2;
      },
      // a cry: a man's or a woman's (p.f0), short, up and broken off
      o3_cry(ctx, out, t0, p, R) {
        const f0 = p.f0 ?? 260, k = p.k ?? 1;
        voice(ctx, out, t0, R, { f0, f1: f0 * rng(1.25, 1.45), dur: p.dur ?? rng(0.32, 0.5), formants: [[f0 * 3.1, 6], [f0 * 4.6, 7], [2600, 5]], breath: 0.45, level: 0.32 * k, attack: 0.02 });
        return 0.6;
      },
      // 'Hey!': a man's bark, pushed past or run at
      o3_hey(ctx, out, t0, p, R) {
        const f0 = p.f0 ?? rng(120, 150), k = p.k ?? 1;
        voice(ctx, out, t0, R, { f0: f0 * 1.15, f1: f0 * 0.9, dur: 0.24, formants: [[700, 6], [1250, 7], [2500, 6]], breath: 0.35, level: 0.3 * k, attack: 0.01 });
        return 0.35;
      },
      // 'Hands up!': the cop's shout, two syllables, hard
      o3_handsup(ctx, out, t0, p, R) {
        const f0 = p.f0 ?? 118, k = p.k ?? 1;
        voice(ctx, out, t0, R, { f0: f0 * 1.2, f1: f0 * 1.05, dur: 0.22, formants: [[750, 6], [1200, 7], [2500, 6]], breath: 0.3, level: 0.34 * k, attack: 0.01 });
        voice(ctx, out, t0 + 0.27, R, { f0: f0 * 1.3, f1: f0 * 0.85, dur: 0.3, formants: [[400, 6], [1000, 7], [2400, 6]], breath: 0.3, level: 0.32 * k, attack: 0.01 });
        return 0.7;
      },
      // the call box: the receiver lifted off its hook, the bell's tick, a click
      o3_callbox(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 420, 260, 0.08, 0.03);
        burst(ctx, out, R, t0, 'white', ['bandpass', 2400, 3], 0.05, 0.002, 0.04);
        ping(ctx, out, t0 + 0.25, [[1720, 0.06, 0.3], [3400, 0.025, 0.2]]);
        ping(ctx, out, t0 + 0.45, [[1720, 0.05, 0.3], [3400, 0.02, 0.2]]);
        burst(ctx, out, R, t0 + 1.4, 'white', ['bandpass', 1800, 3], 0.04, 0.002, 0.05);
        return 1.6;
      },
      // the crowd's murmur: low voices, no words (they have gathered)
      o3_murmur(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        for (let i = 0; i < 5; i++) {
          const f0 = rng(105, 190), dt = rng(0, 1.4);
          voice(ctx, out, t0 + dt, R, { f0, f1: f0 * rng(0.85, 1.1), dur: rng(0.3, 0.6), formants: [[rng(450, 750), 4], [rng(1000, 1500), 5]], breath: 0.6, level: 0.08 * k, attack: 0.04 });
        }
        return 2.2;
      },
      // the cuffs: two ratchets closing
      o3_cuffs(ctx, out, t0, p, R) {
        for (const dt of [0, 0.32]) {
          for (let i = 0; i < 5; i++) burst(ctx, out, R, t0 + dt + i * 0.018, 'white', ['bandpass', 3600, 5], 0.05, 0.0005, 0.008);
          ping(ctx, out, t0 + dt + 0.1, [[2900, 0.04, 0.12], [5200, 0.02, 0.08]]);
        }
        return 0.8;
      },
    },
  };
};
