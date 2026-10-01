// The tail's sounds (scene 7, lane B5): the car's cabin as a room (its bed
// is the engine, the tyres on the wet, the rain drumming on the roof; the
// street comes in through the glass, dulled), and every thing a car meets.
// The bed answers set({ speed, throttle, slide, shake }) each step and
// wipe() at each end of the blades' sweep (src/scenes/tail/tail.js).
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, noise, shaper, loopN, lfo, rng, splinter, B } = kit;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // the engine's revs from the road speed: three gears (a 1937 straight
  // eight), the revs climbing through each and falling at the change
  const revs = (v) => {
    const g = v < 8 ? [0, 8] : v < 17 ? [8, 17] : [17, 31];
    const u = clamp((v - g[0]) / (g[1] - g[0]), 0, 1);
    return 0.3 + 0.7 * (g[0] === 0 ? u : 0.35 + 0.65 * u);
  };

  function carBed(ctx, R, out) {
    const master = gain(ctx, 0.0001);
    master.connect(out);
    const srcs = [];
    const keep = (s) => { srcs.push(s); return s; };
    // the engine: a sawtooth and a square an octave up through a low-pass
    // that opens with the throttle, a sub below, the firing's flutter on it
    const eng = gain(ctx, 0.0);
    const lp = filt(ctx, 'lowpass', 260, 1.2);
    const sat = shaper(ctx, 2.4);
    chain(lp, sat, eng, master);
    const o1 = keep(ctx.createOscillator()); o1.type = 'sawtooth'; o1.frequency.value = 32; o1.start();
    const o2 = keep(ctx.createOscillator()); o2.type = 'square'; o2.frequency.value = 64; o2.start();
    const o3 = keep(ctx.createOscillator()); o3.type = 'sine'; o3.frequency.value = 16; o3.start();
    chain(o1, gain(ctx, 0.5), lp); chain(o2, gain(ctx, 0.18), lp); chain(o3, gain(ctx, 0.6), eng);
    const flut = gain(ctx, 0.0); chain(flut, eng.gain);
    const fl = keep(ctx.createOscillator()); fl.frequency.value = 12; fl.start(); chain(fl, flut);
    // the rumble: brown noise under the car, with the speed
    const rum = gain(ctx, 0.0);
    chain(loopN(ctx, R, 'brown', 0.7, srcs), filt(ctx, 'lowpass', 140), rum, master);
    // the tyres on the wet: a hiss that rises with the speed; a screech when
    // the tail steps out
    const hiss = gain(ctx, 0.0);
    const hf = filt(ctx, 'bandpass', 900, 0.6);
    chain(loopN(ctx, R, 'pink', 1.0, srcs), filt(ctx, 'highpass', 300), hf, hiss, master);
    const scr = gain(ctx, 0.0);
    const sf = filt(ctx, 'bandpass', 1300, 6);
    chain(loopN(ctx, R, 'white', 1.0, srcs), sf, scr, master);
    // the wind at speed
    const wind = gain(ctx, 0.0);
    chain(loopN(ctx, R, 'pink', 0.6, srcs), filt(ctx, 'bandpass', 520, 0.5), wind, master);
    // the rain on the roof and the glass: a drumming close over the head
    const roof = gain(ctx, 0.07);
    chain(loopN(ctx, R, 'white', 0.9, srcs), filt(ctx, 'highpass', 900), filt(ctx, 'lowpass', 5200, 0.5), roof, master);
    lfo(ctx, 0.17, 0.02, roof.gain, 'sine', srcs);
    const drops = gain(ctx, 0.03);
    chain(loopN(ctx, R, 'pink', 1.6, srcs), filt(ctx, 'bandpass', 2600, 2.5), drops, master);
    lfo(ctx, 9.1, 0.02, drops.gain, 'square', srcs);
    const now = () => ctx.currentTime;
    return {
      gain: master,
      set({ speed = 0, throttle = 0, slide = 0, shake = 0 } = {}) {
        const t = now(), v = Math.abs(speed), r = revs(v);
        const f = 26 + r * 58 + throttle * 4;
        o1.frequency.setTargetAtTime(f, t, 0.05); o2.frequency.setTargetAtTime(f * 2.01, t, 0.05); o3.frequency.setTargetAtTime(f / 2, t, 0.05);
        fl.frequency.setTargetAtTime(f / 2.3, t, 0.05);
        lp.frequency.setTargetAtTime(180 + throttle * 520 + r * 260, t, 0.06);
        eng.gain.setTargetAtTime(0.1 + throttle * 0.1 + r * 0.05, t, 0.08);
        flut.gain.setTargetAtTime(0.03 + throttle * 0.04, t, 0.08);
        rum.gain.setTargetAtTime(0.05 + v * 0.006 + shake * 0.2, t, 0.08);
        hiss.gain.setTargetAtTime(clamp(v / 28, 0, 1) * 0.16, t, 0.1);
        hf.frequency.setTargetAtTime(600 + v * 28, t, 0.1);
        scr.gain.setTargetAtTime(slide * 0.09, t, 0.05);
        wind.gain.setTargetAtTime(Math.pow(clamp(v / 28, 0, 1), 2) * 0.12, t, 0.15);
      },
      // a blade at the end of its sweep: a soft rubber thump and a squeak
      wipe(k = 1) {
        const t = now();
        thud(ctx, master, t, 150, 90, 0.05 * k, 0.05);
        const o = osc(ctx, 'triangle', rng(1500, 1900), t, 0.08);
        const g = gain(ctx); env(g, t, 0.012 * k, 0.01, 0.07);
        chain(o, filt(ctx, 'bandpass', 1700, 4), g, master);
      },
      stop() {
        const t = now();
        master.gain.setTargetAtTime(0, t, 0.12);
        setTimeout(() => { for (const s of srcs) { try { s.stop(); } catch (e) { /* */ } } try { master.disconnect(); } catch (e) { /* */ } }, 1200);
      },
    };
  }

  return {
    rooms: {
      // inside the car: the street's rain and sounds come through the glass
      // and the tin, dulled but near
      car: { inside: true, wall: 1500, wallGain: 0.45, bed: carBed },
    },
    sounds: {
      // the engine catches: the starter's whirr, a cough, the idle
      tail_start(ctx, out, t0, p, R) {
        const st = osc(ctx, 'sawtooth', 18, t0, 0.9);
        const sg = gain(ctx); env(sg, t0, 0.18, 0.02, 0.5, 0.35);
        const am = osc(ctx, 'square', 11, t0, 0.9); const ag = gain(ctx, 0.1); chain(am, ag, sg.gain);
        chain(st, filt(ctx, 'lowpass', 500), sg, out);
        burst(ctx, out, R, t0 + 0.85, 'brown', ['lowpass', 380, 1], 0.5, 0.004, 0.25);
        thud(ctx, out, t0 + 0.86, 90, 45, 0.4, 0.2);
        const idle = osc(ctx, 'sawtooth', 30, t0 + 0.9, 1.2);
        const ig = gain(ctx); env(ig, t0 + 0.9, 0.12, 0.05, 1.0);
        chain(idle, filt(ctx, 'lowpass', 300), ig, out);
        return 2.2;
      },
      // metal along a wall or a column: a grinding scrape and a shriek
      tail_scrape(ctx, out, t0, p, R) {
        const k = p.k ?? 0.5, dur = 0.25 + 0.3 * k;
        burst(ctx, out, R, t0, 'white', ['bandpass', rng(1800, 2600), 2.5], 0.35 * (0.4 + k), 0.005, dur);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 500, 1], 0.4 * (0.4 + k), 0.003, dur * 0.7);
        const o = osc(ctx, 'sawtooth', rng(700, 1100), t0, dur);
        o.frequency.exponentialRampToValueAtTime(rng(400, 600), t0 + dur);
        const g = gain(ctx); env(g, t0, 0.05 * k, 0.01, dur);
        chain(o, filt(ctx, 'bandpass', 1400, 5), g, out);
        return dur + 0.1;
      },
      // a hard stop: the thump through the frame, the crunch, a little glass
      tail_crash(ctx, out, t0, p, R) {
        const k = p.k ?? 0.8;
        thud(ctx, out, t0, 110, 38, 0.8 * (0.5 + k * 0.5), 0.35);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 900, 0.8], 0.7 * k, 0.002, 0.4);
        burst(ctx, out, R, t0 + 0.01, 'white', ['bandpass', 1800, 1.2], 0.35 * k, 0.001, 0.2);
        for (let i = 0; i < 5; i++) { const t = t0 + 0.05 + Math.random() * 0.4; ping(ctx, out, t, [[rng(2500, 6000), 0.06 * k, rng(0.03, 0.08)]]); }
        return 0.9;
      },
      // a thing thrown against the windscreen: a hard tock on the glass
      tail_screenHit(ctx, out, t0, p, R) {
        const k = p.k ?? 0.5;
        thud(ctx, out, t0, 240, 130, 0.35 * (0.4 + k), 0.06);
        burst(ctx, out, R, t0, 'white', ['bandpass', 3200, 2], 0.2 * k, 0.0005, 0.04);
        return 0.2;
      },
      // the hammer on an empty chamber; the cylinder swung out, the empties
      // out, six in, shut
      tail_click(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 3600, 3], 0.25, 0.0005, 0.02); thud(ctx, out, t0, 700, 400, 0.08, 0.02); return 0.1; },
      tail_reload(ctx, out, t0, p, R) {
        for (const [dt, f, a] of [[0, 2600, 0.14], [0.22, 1800, 0.1], [0.3, 1900, 0.08], [0.55, 3000, 0.08], [0.7, 3100, 0.07], [0.85, 3000, 0.07], [1.1, 2400, 0.16]]) burst(ctx, out, R, t0 + dt, 'white', ['bandpass', f, 3], a, 0.0005, 0.025);
        return 1.3;
      },
      tail_kerb(ctx, out, t0, p) { thud(ctx, out, t0, 95, 55, 0.18 * (p.k ?? 0.5), 0.12); return 0.2; },
      // a 1930s horn: two reeds a fourth apart, nasal
      tail_horn(ctx, out, t0, p, R) {
        const dur = p.dur ?? 0.7, low = p.low ? 0.8 : 1;
        for (const f of [330 * low, 440 * low]) {
          const o = osc(ctx, 'sawtooth', f, t0, dur);
          const g = gain(ctx); env(g, t0, 0.28 * (p.k ?? 1), 0.02, 0.08, dur - 0.1);
          chain(o, filt(ctx, 'bandpass', f * 2.2, 1.5), g, out);
        }
        return dur + 0.1;
      },
      // the horn stuck after the crash: it sounds on, then sags and dies
      tail_hornStuck(ctx, out, t0, p) {
        const dur = p.dur ?? 4;
        for (const f of [330, 440]) {
          const o = osc(ctx, 'sawtooth', f, t0, dur);
          o.frequency.setValueAtTime(f, t0 + dur * 0.55);
          o.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + dur);
          const g = gain(ctx); env(g, t0, 0.24, 0.02, dur * 0.45, dur * 0.5);
          chain(o, filt(ctx, 'bandpass', f * 2.2, 1.5), g, out);
        }
        return dur + 0.1;
      },
      // tyres sliding on the wet: a hissing wail
      tail_screech(ctx, out, t0, p, R) {
        const dur = p.dur ?? 1.6;
        burst(ctx, out, R, t0, 'white', ['bandpass', 1500, 5], 0.3, 0.05, dur);
        const o = osc(ctx, 'triangle', 1250, t0, dur);
        o.frequency.linearRampToValueAtTime(900, t0 + dur);
        const g = gain(ctx); env(g, t0, 0.05, 0.05, dur * 0.6, dur * 0.3);
        chain(o, g, out);
        return dur + 0.1;
      },
      // the tyre goes: a hard bang, then the flap of the rubber
      tail_burst(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['lowpass', 3000, 0.7], 0.55, 0.0005, 0.08);
        thud(ctx, out, t0, 140, 50, 0.6, 0.15);
        for (let i = 0; i < 8; i++) thud(ctx, out, t0 + 0.12 + i * 0.07, 90, 60, 0.12 * (1 - i / 8), 0.04);
        return 0.8;
      },
      tail_door(ctx, out, t0, p, R) {
        if (p.open) { burst(ctx, out, R, t0, 'white', ['bandpass', 1400, 3], 0.12, 0.002, 0.05); thud(ctx, out, t0 + 0.05, 180, 120, 0.12, 0.06); return 0.3; }
        thud(ctx, out, t0, 120, 70, 0.45, 0.12); burst(ctx, out, R, t0, 'brown', ['lowpass', 600, 1], 0.3, 0.002, 0.1);
        return 0.35;
      },
      // a man put against a car: the body on the tin
      tail_thud(ctx, out, t0, p, R) {
        thud(ctx, out, t0, 105, 60, 0.55, 0.14);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 700, 1], 0.35, 0.002, 0.12);
        burst(ctx, out, R, t0 + 0.02, 'pink', ['bandpass', 2400, 1.5], 0.08, 0.002, 0.2);
        return 0.4;
      },
      // [R2] his bowler into the river, three metres down: a small flat slap
      // on the water, the plop's drop in pitch, a spatter falling back
      tail_hatSplash(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'white', ['bandpass', 1400, 0.9], 0.28, 0.002, 0.09);
        thud(ctx, out, t0 + 0.004, 620, 180, 0.16, 0.12);
        burst(ctx, out, R, t0 + 0.05, 'white', ['highpass', 3200], 0.1, 0.01, 0.35);
        burst(ctx, out, R, t0 + 0.02, 'pink', ['lowpass', 500, 0.7], 0.12, 0.004, 0.18);
        return 0.6;
      },
      tail_slump(ctx, out, t0, p, R) {
        burst(ctx, out, R, t0, 'pink', ['lowpass', 900, 0.7], 0.15, 0.05, 0.5);
        thud(ctx, out, t0 + 0.45, 80, 50, 0.3, 0.12);
        return 0.8;
      },
      // things going to pieces over the hood
      smash_crate(ctx, out, t0, p, R) {
        const k = p.k ?? 0.7;
        splinter(ctx, out, t0, R, 0.6 * (0.5 + k));
        thud(ctx, out, t0, 150, 70, 0.4 * k, 0.08);
        for (let i = 0; i < 7; i++) thud(ctx, out, t0 + 0.08 + Math.random() * 0.5, rng(220, 420), 120, 0.08 * k, 0.03);
        return 0.8;
      },
      smash_barrel(ctx, out, t0, p, R) {
        const k = p.k ?? 0.7;
        thud(ctx, out, t0, 85, 45, 0.6 * k, 0.25);
        burst(ctx, out, R, t0, 'brown', ['lowpass', 500, 1.2], 0.3 * k, 0.003, 0.3);
        splinter(ctx, out, t0 + 0.01, R, 0.3 * k);
        return 0.6;
      },
      smash_stall(ctx, out, t0, p, R) {
        const k = p.k ?? 0.8;
        splinter(ctx, out, t0, R, 0.9 * k);
        burst(ctx, out, R, t0, 'pink', ['lowpass', 1800, 0.6], 0.4 * k, 0.002, 0.45);   // the canvas
        for (let i = 0; i < 12; i++) thud(ctx, out, t0 + 0.1 + Math.random() * 0.8, rng(180, 460), 110, 0.07 * k, 0.03);
        return 1.1;
      },
      smash_fence(ctx, out, t0, p, R) {
        splinter(ctx, out, t0, R, 0.8 * (p.k ?? 0.8));
        thud(ctx, out, t0, 130, 70, 0.35, 0.1);
        return 0.6;
      },
      smash_stand(ctx, out, t0, p, R) {
        splinter(ctx, out, t0, R, 0.7);
        burst(ctx, out, R, t0 + 0.02, 'pink', ['bandpass', 2800, 0.8], 0.25, 0.01, 0.9);   // the papers
        thud(ctx, out, t0, 120, 60, 0.4, 0.1);
        return 1.2;
      },
      smash_hydrant(ctx, out, t0, p, R) {
        B.clang(ctx, out, t0, { k: 0.9 }, R);
        burst(ctx, out, R, t0 + 0.05, 'white', ['highpass', 1200, 0.7], 0.35, 0.02, 1.6);
        return 2;
      },
    },
  };
};
