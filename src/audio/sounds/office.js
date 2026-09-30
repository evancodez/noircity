// The office's sounds (lane B2): the building (boards, hinges, the lift's
// shaft), the desk's things (the pencil's side on paper, a sheet torn off,
// the safe's dial and bolt and door), the room coming apart (the desk going
// over, the lamp on the floor, the bent fan), the fire escape's iron; and
// two rooms: 'office' (rain on the window, the fan, the building's hum, the
// HOTEL's neon buzzing across the street) and 'corridor' (the hum, the rain
// far off, the lift shaft breathing).
export default (kit) => {
  const { burst, thud, ping, chain, osc, gain, env, filt, noise, loopN, lfo, splinter, tear, rng, B } = kit;
  // a stick-slip creak: a sawtooth whose pitch wanders, through a wooden body
  const creak = (ctx, out, t0, R, { f0 = 180, f1 = 260, dur = 0.6, k = 1, grain = 34, body = 900 } = {}) => {
    const o = osc(ctx, 'sawtooth', f0, t0, dur);
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.linearRampToValueAtTime(f1, t0 + dur * 0.6);
    o.frequency.linearRampToValueAtTime(f0 * 1.1, t0 + dur);
    const am = osc(ctx, 'square', grain, t0, dur); const ga = gain(ctx, 0.5);
    const g = gain(ctx); env(g, t0, 0.16 * k, 0.03, dur * 0.7, dur * 0.2);
    chain(am, ga); ga.connect(g.gain);
    chain(o, filt(ctx, 'bandpass', body, 3.5), filt(ctx, 'lowpass', 2600), g, out);
    burst(ctx, out, R, t0, 'brown', ['bandpass', body * 0.6, 1.2], 0.06 * k, 0.02, dur * 0.8);
  };
  const S = {
    // a board in the corridor under a man's weight
    office_boardCreak(ctx, out, t0, p, R) { creak(ctx, out, t0, R, { f0: 95, f1: 140, dur: 0.55, k: p.k ?? 1, grain: 22, body: 520 }); return 0.7; },
    // the door on its hinges: a long rising creak (k: how fast it goes)
    office_doorCreak(ctx, out, t0, p, R) { const d = p.dur ?? 1.1; creak(ctx, out, t0, R, { f0: 340, f1: 620, dur: d, k: p.k ?? 0.8, grain: 41, body: 1500 }); return d + 0.1; },
    // the door flung against the wall: the bang, its glass shivering in the frame
    office_doorBang(ctx, out, t0, p, R) {
      const k = p.k ?? 1;
      thud(ctx, out, t0, 150, 60, 0.7 * k, 0.25);
      burst(ctx, out, R, t0, 'brown', ['lowpass', 900], 0.5 * k, 0.002, 0.22);
      for (let i = 0; i < 5; i++) ping(ctx, out, t0 + 0.01 + i * 0.03, [[rng(2600, 4200), 0.05 * k, 0.05]]);
      return 0.45;
    },
    // the kick: a heel on the lock rail, the jamb splitting
    office_doorKick(ctx, out, t0, p, R) {
      thud(ctx, out, t0, 110, 45, 1.0, 0.3);
      burst(ctx, out, R, t0, 'brown', ['lowpass', 700], 0.8, 0.001, 0.2);
      splinter(ctx, out, t0 + 0.01, R, 1.1, 10);
      return 0.6;
    },
    // a hand on the door, the latch free (it was never shut)
    office_doorPush(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'brown', ['bandpass', 400, 1], 0.2, 0.004, 0.06); creak(ctx, out, t0 + 0.12, R, { f0: 300, f1: 560, dur: 1.2, k: 0.7, grain: 38, body: 1400 }); return 1.4; },
    // the pencil: a grain of lead on paper (k: pressure x speed); one step's worth
    office_pencilRub(ctx, out, t0, p, R) {
      const k = p.k ?? 1, d = p.dur ?? 0.09;
      const n = noise(ctx, R, 'pink', t0, d, 1.4 + Math.random() * 0.4);
      const g = gain(ctx); env(g, t0, 0.22 * k, 0.012, d * 0.8, d * 0.1);
      chain(n, filt(ctx, 'bandpass', 2200 + 900 * (p.f ?? 0.5), 0.9), filt(ctx, 'highpass', 900), g, out);
      burst(ctx, out, R, t0, 'white', ['bandpass', 5200, 2], 0.03 * k, 0.005, d);
      return d + 0.05;
    },
    office_pencilPick(ctx, out, t0, p, R) { ping(ctx, out, t0, [[1850, 0.05, 0.03], [3400, 0.03, 0.02]]); burst(ctx, out, R, t0, 'white', ['bandpass', 2600, 2], 0.05, 0.001, 0.03); return 0.1; },
    // the sheet torn off the pad
    office_sheetTear(ctx, out, t0, p, R) { tear(ctx, out, t0, R, 0.32, 3200, 1800, 0.9, 52); tear(ctx, out, t0 + 0.28, R, 0.12, 2400, 2000, 0.5, 60); return 0.5; },
    office_paperRustle(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 3400, 1.2], 0.08 * (p.k ?? 1), 0.02, 0.18); burst(ctx, out, R, t0 + 0.11, 'white', ['bandpass', 2700, 1.2], 0.06 * (p.k ?? 1), 0.02, 0.14); return 0.35; },
    // the safe's dial: a tick every number; at the right one a louder,
    // lower click (the lever falling into the wheel's gate)
    office_dialTick(ctx, out, t0, p) { ping(ctx, out, t0, [[4200 + Math.random() * 300, 0.035 * (p.k ?? 1), 0.012], [2100, 0.012, 0.01]]); return 0.05; },
    office_dialClick(ctx, out, t0, p, R) {
      ping(ctx, out, t0, [[1250, 0.22, 0.05], [2600, 0.08, 0.03], [640, 0.12, 0.08]]);
      thud(ctx, out, t0, 260, 140, 0.18, 0.06);
      burst(ctx, out, R, t0, 'white', ['bandpass', 1800, 2.5], 0.12, 0.0005, 0.02);
      return 0.15;
    },
    // a number set wrong: a dull clack, nothing caught
    office_dialWrong(ctx, out, t0, p, R) { thud(ctx, out, t0, 180, 120, 0.12, 0.05); burst(ctx, out, R, t0, 'brown', ['bandpass', 600, 2], 0.1, 0.001, 0.04); return 0.1; },
    // the handle turns and the bolts draw back
    office_safeHandle(ctx, out, t0, p, R) {
      B.clang(ctx, out, t0, { k: 0.25 }, R);
      burst(ctx, out, R, t0 + 0.05, 'white', ['bandpass', 1600, 1.5], 0.12, 0.05, 0.25);
      thud(ctx, out, t0 + 0.32, 220, 160, 0.3, 0.08);
      ping(ctx, out, t0 + 0.33, [[980, 0.12, 0.15], [1900, 0.06, 0.1]]);
      return 0.6;
    },
    // the door's weight: a low groan on its hinges, the air of the box
    office_safeDoor(ctx, out, t0, p, R) {
      creak(ctx, out, t0, R, { f0: 70, f1: 95, dur: 1.4, k: 1.2, grain: 16, body: 380 });
      burst(ctx, out, R, t0, 'brown', ['lowpass', 300], 0.18, 0.2, 1.0);
      return 1.6;
    },
    office_ledgerTake(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'brown', ['bandpass', 700, 1], 0.15, 0.01, 0.12); burst(ctx, out, R, t0 + 0.08, 'white', ['bandpass', 2900, 1.2], 0.06, 0.02, 0.2); return 0.35; },
    // the ledger opened: stiff pages
    office_pages(ctx, out, t0, p, R) { for (let i = 0; i < 3; i++) burst(ctx, out, R, t0 + i * 0.09, 'white', ['bandpass', 3000 + i * 300, 1.4], 0.07, 0.01, 0.07); return 0.4; },
    // the picture swung aside on its wire
    office_pictureSwing(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 5200, 3], 0.05, 0.02, 0.25); thud(ctx, out, t0 + 0.3, 240, 170, 0.12, 0.05); return 0.5; },
    // a filing drawer run out on its rollers
    office_drawer(ctx, out, t0, p, R) {
      const d = 0.4;
      const n = noise(ctx, R, 'pink', t0, d, 0.9);
      const g = gain(ctx); env(g, t0, 0.18, 0.02, d * 0.7, d * 0.3);
      const am = osc(ctx, 'square', 26, t0, d); const ga = gain(ctx, 0.35); chain(am, ga); ga.connect(g.gain);
      chain(n, filt(ctx, 'bandpass', 1300, 1.2), g, out);
      B.clang(ctx, out, t0 + d, { k: 0.2 }, R);
      return d + 0.4;
    },
    // the desk going over: its weight on its edge, the crash, what was on it
    office_deskTip(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'brown', ['bandpass', 300, 1], 0.3, 0.05, 0.3); creak(ctx, out, t0, R, { f0: 60, f1: 110, dur: 0.4, k: 0.8, grain: 18, body: 350 }); return 0.5; },
    office_deskFall(ctx, out, t0, p, R) {
      thud(ctx, out, t0, 90, 38, 1.1, 0.45);
      burst(ctx, out, R, t0, 'brown', ['lowpass', 600], 0.9, 0.002, 0.5);
      splinter(ctx, out, t0 + 0.005, R, 0.6, 6);
      for (let i = 0; i < 7; i++) B.clang(ctx, out, t0 + 0.08 + Math.random() * 0.5, { k: 0.12 + Math.random() * 0.15 }, R);
      return 1.0;
    },
    office_lampFall(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 4200, 2], 0.05, 0.01, 0.15); return 0.2; },
    office_lampLand(ctx, out, t0, p, R) { B.clang(ctx, out, t0, { k: 0.4 }, R); ping(ctx, out, t0 + 0.02, [[3100, 0.08, 0.2], [5200, 0.04, 0.1]]); return 0.4; },
    // the fan's bent blade clipping its housing, once a turn
    office_fanTick(ctx, out, t0, p) { ping(ctx, out, t0, [[1600, 0.05 * (p.k ?? 1), 0.03], [3300, 0.03, 0.02]]); return 0.06; },
    office_coolerGlug(ctx, out, t0, p, R) { for (let i = 0; i < 3; i++) { const t = t0 + i * 0.22; const o = osc(ctx, 'sine', 160, t, 0.15); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.12); const g = gain(ctx); env(g, t, 0.15, 0.01, 0.12); chain(o, g, out); } return 0.8; },
    // iron underfoot: the fire escape under a man coming up it
    office_ironStep(ctx, out, t0, p, R) { B.clang(ctx, out, t0, { k: 0.18 * (p.k ?? 1) }, R); thud(ctx, out, t0, 120, 80, 0.15 * (p.k ?? 1), 0.08); return 0.35; },
    // the hand into the coat and out with the gun
    office_draw(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 1700, 0.8], 0.08, 0.03, 0.18); burst(ctx, out, R, t0 + 0.2, 'brown', ['bandpass', 900, 1.5], 0.12, 0.004, 0.05); ping(ctx, out, t0 + 0.24, [[2400, 0.06, 0.05]]); return 0.4; },
    // a round through the blind: the slats' rattle
    office_blindRattle(ctx, out, t0, p, R) { for (let i = 0; i < 6; i++) ping(ctx, out, t0 + i * 0.018 + Math.random() * 0.01, [[rng(2200, 3600), 0.05, 0.025]]); burst(ctx, out, R, t0, 'white', ['bandpass', 3000, 1], 0.06, 0.001, 0.08); return 0.25; },
    // plaster: a round into the wall
    office_plaster(ctx, out, t0, p, R) { burst(ctx, out, R, t0, 'white', ['bandpass', 1500, 0.9], 0.3, 0.0008, 0.05); burst(ctx, out, R, t0 + 0.01, 'brown', ['lowpass', 900], 0.2, 0.002, 0.12); return 0.2; },
    // paper in the air: a flutter
    office_papers(ctx, out, t0, p, R) { for (let i = 0; i < 5; i++) burst(ctx, out, R, t0 + i * 0.07 + Math.random() * 0.05, 'white', ['bandpass', rng(2400, 4200), 1.5], 0.05, 0.01, 0.08); return 0.6; },
    break_cabinet(ctx, out, t0, p, R) { B.clang(ctx, out, t0, { k: 0.5 }, R); return 0.5; },
  };

  // ---- the rooms --------------------------------------------------------------------------
  // the office: rain on the street window, close and bright; the fan's slow
  // whoosh; the building's hum; the neon's buzz across the street (faint);
  // the radiator's odd tick
  function officeBed(ctx, R, out) {
    const master = gain(ctx, 0.0001); master.connect(out);
    const srcs = [];
    const rg = gain(ctx, 0.045); chain(loopN(ctx, R, 'white', 1, srcs), filt(ctx, 'highpass', 1800), filt(ctx, 'lowpass', 7000, 0.5), rg, master);
    lfo(ctx, 0.11, 0.018, rg.gain, 'sine', srcs);
    const pt = gain(ctx, 0.018); chain(loopN(ctx, R, 'pink', 1.25, srcs), filt(ctx, 'bandpass', 4200, 1.3), pt, master);
    lfo(ctx, 6.1, 0.01, pt.gain, 'square', srcs);
    chain(loopN(ctx, R, 'brown', 0.7, srcs), filt(ctx, 'lowpass', 220), gain(ctx, 0.1), master);
    for (const [f, a] of [[60, 0.012], [120, 0.009], [120.4, 0.007]]) { const o = ctx.createOscillator(); o.frequency.value = f; o.start(); srcs.push(o); chain(o, gain(ctx, a), master); }
    // the fan: a slow beat of moved air (38 rpm, four blades: ~2.5 Hz)
    const fg = gain(ctx, 0.02); chain(loopN(ctx, R, 'pink', 0.6, srcs), filt(ctx, 'lowpass', 380), fg, master);
    lfo(ctx, 2.53, 0.012, fg.gain, 'sine', srcs);
    // the neon: a thin 120 Hz buzz with its edge, through the glass
    const nb = ctx.createOscillator(); nb.type = 'sawtooth'; nb.frequency.value = 120; nb.start(); srcs.push(nb);
    const ng = gain(ctx, 0.0025); chain(nb, filt(ctx, 'bandpass', 2400, 4), ng, master);
    lfo(ctx, 0.31, 0.0015, ng.gain, 'sine', srcs);
    return { gain: master, stop() { const t = ctx.currentTime; master.gain.setTargetAtTime(0, t, 0.15); setTimeout(() => { for (const s of srcs) { try { s.stop(); } catch (e) { /* */ } } try { master.disconnect(); } catch (e) { /* */ } }, 1500); } };
  }
  function corridorBed(ctx, R, out) {
    const master = gain(ctx, 0.0001); master.connect(out);
    const srcs = [];
    chain(loopN(ctx, R, 'brown', 0.6, srcs), filt(ctx, 'lowpass', 180), gain(ctx, 0.13), master);
    for (const [f, a] of [[60, 0.01], [180, 0.003]]) { const o = ctx.createOscillator(); o.frequency.value = f; o.start(); srcs.push(o); chain(o, gain(ctx, a), master); }
    // the lift shaft breathing: a low hollow wind that swells and falls
    const wg = gain(ctx, 0.03); chain(loopN(ctx, R, 'pink', 0.5, srcs), filt(ctx, 'bandpass', 240, 2.2), wg, master);
    lfo(ctx, 0.07, 0.02, wg.gain, 'sine', srcs);
    return { gain: master, stop() { const t = ctx.currentTime; master.gain.setTargetAtTime(0, t, 0.15); setTimeout(() => { for (const s of srcs) { try { s.stop(); } catch (e) { /* */ } } try { master.disconnect(); } catch (e) { /* */ } }, 1500); } };
  }
  return {
    sounds: S,
    rooms: {
      office: { wall: 900, wallGain: 0.3, bed: officeBed },
      corridor: { wall: 380, wallGain: 0.1, bed: corridorBed },
    },
  };
};
