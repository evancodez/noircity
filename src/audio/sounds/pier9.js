// Pier 9's sounds (lane B6, scene 8), procedural like the rest (Sfx.js KIT),
// and the warehouse's room: a big timber shed over the river, rain on its
// roof, the water slapping the piles under the floor, the timbers ticking.
// No voices: a man's "hm" is a breath through a closed mouth, low.
//   whistle   the alarm: two sharp blasts on a police-style whistle
//   hm        curious: a low hum through the nose
//   shrug     giving up: a slow breath out
//   switch    the knife switch thrown: a heavy clack and an arc's snap
//   lampsOff  the row going dark: the filaments' tick, a fading hum
//   hoist     the hoist let go: the cord running, the chain rattling up the block
//   crash     the load landing: a deep boom, splintering, a rattle of chain
//   bottleSmash  a bottle landing and breaking (the throw's)
//   throw     the arm's whoosh
//   blow      the cosh from behind, or mine: a dull heavy thud
//   fold      a man going down: his knees, a slump on the boards
//   creak     a door on old hinges
//   engine    the truck starting, idling, backing (7 s)
//   gasp      a man hit from behind: a short breath out
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, noise, shaper, loopN, lfo, splinter, glassFall } = kit;
  return {
    sounds: {
      whistle(ctx, out, t0) {
        for (const [a, d] of [[0, 0.32], [0.42, 0.5]]) {
          const o = osc(ctx, 'sine', 2950, t0 + a, d);
          const tr = osc(ctx, 'sine', 38, t0 + a, d);
          const tg = gain(ctx, 160); chain(tr, tg, o.frequency);
          const g = gain(ctx); env(g, t0 + a, 0.22, 0.01, 0.08, d - 0.1);
          chain(o, g, out);
          const o2 = osc(ctx, 'sine', 3310, t0 + a, d);
          const g2 = gain(ctx); env(g2, t0 + a, 0.08, 0.01, 0.08, d - 0.1);
          chain(o2, g2, out);
        }
        return 1.0;
      },
      hm(ctx, out, t0, p, R) {
        const d = 0.55;
        const o = osc(ctx, 'sawtooth', 105, t0, d);
        o.frequency.setValueAtTime(112, t0); o.frequency.linearRampToValueAtTime(96, t0 + d);
        const g = gain(ctx); env(g, t0, 0.06, 0.08, 0.3, 0.15);
        chain(o, filt(ctx, 'lowpass', 380, 1.2), filt(ctx, 'bandpass', 250, 1.1), g, out);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 500, 0.9], 0.015, 0.05, 0.4);
        return d + 0.1;
      },
      shrug(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'pink', ['bandpass', 650, 0.7], 0.05, 0.25, 0.9); return 1.2; },
      switch(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 190, 70, 0.4, 0.09);
        ping(ctx, out, t0, [[820, 0.12, 0.08], [1650, 0.06, 0.05], [2300, 0.04, 0.04]]);
        burst(ctx, out, R, t0 + 0.01, 'white', ['bandpass', 4200, 1.2], 0.18, 0.001, 0.07);
        return 0.3;
      },
      lampsOff(ctx, out, t0, p, R) {
        for (let i = 0; i < 3; i++) burst(ctx, out, R, t0 + i * 0.07, 'white', ['highpass', 5200], 0.05, 0.001, 0.02);
        const o = osc(ctx, 'sawtooth', 120, t0, 0.6);
        const g = gain(ctx); env(g, t0, 0.03, 0.005, 0.55);
        chain(o, filt(ctx, 'lowpass', 900), g, out);
        return 0.7;
      },
      hoist(ctx, out, t0, p, R) {
        // the cord hissing through the pulleys, then the chain running
        burst(ctx, out, R, t0, 'white', ['bandpass', 1500, 1.2], 0.12, 0.02, 0.5);
        for (let i = 0; i < 18; i++) {
          const t = t0 + 0.12 + i * 0.03 + Math.random() * 0.01;
          ping(ctx, out, t, [[2400 + Math.random() * 900, 0.04, 0.03], [4100 + Math.random() * 600, 0.02, 0.02]]);
        }
        return 0.8;
      },
      crash(ctx, out, t0, p, R, send) {
        thud(ctx, out, t0, 90, 34, 0.9, 0.5);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 380], 0.9, 0.002, 0.7);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 900, 0.8], 0.4, 0.002, 0.35);
        splinter(ctx, out, t0 + 0.02, R, 1.2, 12);
        for (let i = 0; i < 10; i++) ping(ctx, out, t0 + 0.05 + i * 0.045, [[1700 + Math.random() * 1400, 0.05, 0.05]]);
        if (send) { const s = gain(ctx, 0.6); out.connect(s); s.connect(send); }
        return 1.4;
      },
      bottleSmash(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 200, 110, 0.25, 0.04);
        glassFall(ctx, out, t0, R, 1.0, 0.45, 14);
        burst(ctx, out, R, t0 + 0.01, 'white', ['highpass', 2600], 0.3, 0.001, 0.14);
        return 0.7;
      },
      throw(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 1100, 0.8], 0.09, 0.06, 0.2); return 0.3; },
      blow(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 140, 55, 0.7, 0.16);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 500], 0.5, 0.001, 0.12);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1200, 0.9], 0.15, 0.001, 0.05);
        return 0.35;
      },
      gasp(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'pink', ['bandpass', 800, 1.2], 0.09, 0.01, 0.22); return 0.3; },
      fold(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 110, 70, 0.25, 0.1);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 420], 0.25, 0.005, 0.2);
        thud(ctx, out, t0 + 0.55, 90, 55, 0.3, 0.14);
        burst(ctx, out, R, t0 + 0.55, 'pink', ['bandpass', 700, 0.7], 0.1, 0.01, 0.3);
        return 1.0;
      },
      creak(ctx, out, t0, p, R) {
        const d = 0.9;
        const o = osc(ctx, 'sawtooth', 190, t0, d);
        o.frequency.setValueAtTime(170, t0); o.frequency.linearRampToValueAtTime(240, t0 + d * 0.6); o.frequency.linearRampToValueAtTime(205, t0 + d);
        const am = osc(ctx, 'square', 23, t0, d); const ag = gain(ctx, 0.5); chain(am, ag);
        const g = gain(ctx); env(g, t0, 0.07, 0.1, 0.5, d - 0.6);
        ag.connect(g.gain);
        chain(o, filt(ctx, 'bandpass', 900, 3), g, out);
        return d + 0.1;
      },
      engine(ctx, out, t0, p, R) {
        const d = p.dur ?? 7;
        const o = osc(ctx, 'sawtooth', 32, t0, d);
        o.frequency.setValueAtTime(18, t0); o.frequency.linearRampToValueAtTime(38, t0 + 0.6); o.frequency.setValueAtTime(38, t0 + d - 1); o.frequency.linearRampToValueAtTime(26, t0 + d);
        const g = gain(ctx); env(g, t0, 0.28, 0.4, 0.8, d - 1.2);
        chain(o, shaper(ctx, 3), filt(ctx, 'lowpass', 260, 1), g, out);
        burst(ctx, out, R, t0 + 0.1, 'brown', ['lowpass', 300], 0.3, 0.05, 0.6);
        const n = noise(ctx, R, 'pink', t0, d);
        const ng = gain(ctx); env(ng, t0, 0.05, 0.4, 0.8, d - 1.2);
        chain(n, filt(ctx, 'bandpass', 180, 1.5), ng, out);
        return d + 0.2;
      },
      // ---- [R2-E] the second fist fight in the bay ------------------------------------
      // the hook dragged along a post as he steps out of the dark: a steel scrape
      b9hookScrape(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 3400, 4], 0.12, 0.05, 0.45);
        ping(ctx, out, t0 + 0.02, [[2900, 0.05, 0.4], [4350, 0.03, 0.3]]);
        return 0.6;
      },
      // a man driven into a stack of crates: the boards' boom, their creak
      b9crate(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 120, 50, 0.7, 0.22);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 700, 0.8], 0.3, 0.002, 0.18);
        splinter(ctx, out, t0 + 0.03, R, 0.5, 5);
        return 0.5;
      },
      // into the post: the timber's knock, the lantern's bail rattling on its nail
      b9post(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 160, 70, 0.6, 0.12);
        for (let i = 0; i < 5; i++) ping(ctx, out, t0 + 0.04 + i * 0.07, [[1800 + i * 90, 0.05, 0.05], [3100, 0.02, 0.04]]);
        return 0.6;
      },
      b9barrel(ctx, out, t0) { thud(ctx, out, t0, 95, 60, 0.5, 0.3); ping(ctx, out, t0, [[210, 0.08, 0.4]]); return 0.6; },
      // his back into a loading door: the planks shudder on their bar
      b9door(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 85, 40, 0.8, 0.3);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 500], 0.5, 0.002, 0.25);
        for (let i = 0; i < 4; i++) thud(ctx, out, t0 + 0.06 + i * 0.05, 180 - i * 10, 120, 0.12, 0.04);
        return 0.6;
      },
      // the hook into a crate's face: a hard bite in the wood
      b9thunk(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 240, 90, 0.5, 0.06);
        burst(ctx, out, R, t0, 'white', ['bandpass', 2600, 1.5], 0.25, 0.001, 0.05);
        ping(ctx, out, t0 + 0.005, [[1450, 0.06, 0.18]]);
        return 0.35;
      },
      // the lid splitting on his hook
      b9split(ctx, out, t0, p, R) {
        splinter(ctx, out, t0, R, 1.2, 10);
        thud(ctx, out, t0, 200, 80, 0.5, 0.07);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1400, 1], 0.35, 0.001, 0.12);
        return 0.6;
      },
      // the chain let fall: links on the planks
      b9chain(ctx, out, t0) {
        for (let i = 0; i < 14; i++) ping(ctx, out, t0 + i * 0.035 + Math.random() * 0.02, [[2200 + Math.random() * 1500, 0.05, 0.06], [4800, 0.02, 0.03]]);
        thud(ctx, out, t0 + 0.1, 130, 80, 0.25, 0.1);
        return 0.8;
      },
      // his hook knocked out of his fist lands on the planks
      b9clatter(ctx, out, t0) {
        ping(ctx, out, t0, [[1700, 0.12, 0.3], [2650, 0.06, 0.25]]);
        ping(ctx, out, t0 + 0.12, [[1750, 0.06, 0.2]]);
        thud(ctx, out, t0, 220, 120, 0.2, 0.04);
        return 0.5;
      },
      // the lantern's oil catching: a soft rush and a whoomph
      b9whoomph(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'brown', ['lowpass', 380], 0.7, 0.04, 0.5);
        burst(ctx, out, R, t0 + 0.02, 'pink', ['bandpass', 900, 0.6], 0.25, 0.06, 0.4);
        return 0.8;
      },
      // the fire's crackle, a few pops (played again and again while it burns)
      b9crackle(ctx, out, t0, p, R) {
        const k = p.k ?? 1;
        for (let i = 0; i < 5; i++) burst(ctx, out, R, t0 + Math.random() * 0.3, 'white', ['bandpass', 2000 + Math.random() * 3000, 2], 0.07 * k, 0.001, 0.015);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 300], 0.12 * k, 0.1, 0.25);
        return 0.4;
      },
      // the loading door burst outward: planks tearing, a crash, splinters
      b9burst(ctx, out, t0, p, R, send) {
        thud(ctx, out, t0, 70, 30, 1.0, 0.5);
        splinter(ctx, out, t0, R, 1.6, 16);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 420], 1.0, 0.002, 0.6);
        burst(ctx, out, R, t0, 'pink', ['bandpass', 1100, 0.7], 0.5, 0.002, 0.3);
        if (send) { const s = gain(ctx, 0.5); out.connect(s); s.connect(send); }
        return 1.2;
      },
      // a man into the river from a height: the smack, the heavy slosh, the
      // water falling back
      b9splash(ctx, out, t0, p, R, send) {
        burst(ctx, out, R, t0, 'white', ['lowpass', 2600], 0.9, 0.002, 0.25);
        thud(ctx, out, t0, 60, 35, 0.8, 0.4);
        burst(ctx, out, R, t0 + 0.05, 'pink', ['bandpass', 600, 0.6], 0.7, 0.05, 1.1);
        burst(ctx, out, R, t0 + 0.5, 'white', ['bandpass', 3500, 0.8], 0.25, 0.1, 0.9);
        if (send) { const s = gain(ctx, 0.6); out.connect(s); s.connect(send); }
        return 1.8;
      },
      // a board off the pier's edge; a board onto the water
      b9plank(ctx, out, t0) { thud(ctx, out, t0, 170, 90, 0.35, 0.08); return 0.2; },
      b9plop(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'pink', ['bandpass', 800, 0.8], 0.3, 0.005, 0.35); thud(ctx, out, t0, 110, 60, 0.2, 0.1); return 0.5; },
      // the lantern creaking on its nail as it swings
      b9creak(ctx, out, t0) {
        const d = 0.35;
        const o = osc(ctx, 'sawtooth', 520, t0, d);
        o.frequency.setValueAtTime(480, t0); o.frequency.linearRampToValueAtTime(610, t0 + d);
        const g = gain(ctx); env(g, t0, 0.025, 0.05, 0.2, 0.1);
        chain(o, filt(ctx, 'bandpass', 1800, 4), g, out);
        return d + 0.1;
      },
      // [C7] the office telephone: two rings of its bell (the clapper's
      // trill between two gongs), 3.2 s
      c7phone(ctx, out, t0) {
        for (const r0 of [0, 1.7]) for (let i = 0; i < 22; i++) ping(ctx, out, t0 + r0 + i * 0.048, [[i % 2 ? 1480 : 1860, 0.07, 0.07], [i % 2 ? 2950 : 3720, 0.025, 0.04]]);
        return 3.2;
      },
    },
    rooms: {
      // the shed: the rain drumming on the roof far overhead (dull, big),
      // the river under the boards, the timbers' ticks; the street's rain
      // comes through the walls dark and low
      warehouse: {
        wall: 450, wallGain: 0.3,
        bed(ctx, R, out) {
          const g = gain(ctx, 0.0001), srcs = [];
          g.connect(out);
          const roof = gain(ctx, 0.09); chain(loopN(ctx, R, 'pink', 0.9, srcs), filt(ctx, 'lowpass', 1400), filt(ctx, 'highpass', 180), roof, g);
          lfo(ctx, 0.07, 0.03, roof.gain, 'sine', srcs);
          const drum = gain(ctx, 0.03); chain(loopN(ctx, R, 'white', 0.6, srcs), filt(ctx, 'bandpass', 2600, 0.6), drum, g);
          lfo(ctx, 5.3, 0.012, drum.gain, 'square', srcs);
          // the water under the floor: a slow slap and suck
          const water = gain(ctx, 0.07); chain(loopN(ctx, R, 'brown', 0.5, srcs), filt(ctx, 'lowpass', 300), water, g);
          lfo(ctx, 0.19, 0.05, water.gain, 'sine', srcs);
          // the big room's tone
          chain(loopN(ctx, R, 'brown', 0.7, srcs), filt(ctx, 'lowpass', 120), gain(ctx, 0.12), g);
          return { gain: g, stop() { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.15); setTimeout(() => { for (const s of srcs) { try { s.stop(); } catch (e) { /* */ } } try { g.disconnect(); } catch (e) { /* */ } }, 1500); } };
        },
      },
    },
  };
};
