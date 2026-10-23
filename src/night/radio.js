// The car radio (lane O7, docs/seams/NIGHT.md §4). In a car, F (the pad's
// R1; F is the rulebook's small hand act, and Q is the horn) turns the dial:
// off -> WJZZ 1170 -> KBLU 880 -> WBND 1450 -> off. A station is a file the
// user drops into public/music/<id>.(mp3|ogg|m4a) (real jazz, blues, a big
// band); until then a station is the needle's hiss and the carrier's hum,
// which is how a set sounds tuned to a quiet station at night. The sound
// comes from the dashboard's speaker (a band-pass, on a panner that rides
// the dash), fades as I get out and is gone with the door; a car keeps its
// station (in again, it plays on where it was). The dial's name shows
// bottom right for a moment, in the typewriter face.
export const STATIONS = [
  { id: 'wjzz', dial: '1170', name: 'WJZZ', what: 'jazz' },
  { id: 'kblu', dial: '880', name: 'KBLU', what: 'blues' },
  { id: 'wbnd', dial: '1450', name: 'WBND', what: 'big band' },
];
const EXTS = ['mp3', 'ogg', 'm4a'];
const TYPE = '"American Typewriter", "Courier New", monospace';

export class Radio {
  constructor(night) {
    this.night = night;
    const G = night.game;
    this.G = G;
    this.station = -1;       // the car I am in: its station (-1 off)
    this.cur = null;         // { el, src, gain, pan, hiss } playing
    this.turns = 0;
    const st = document.createElement('style');
    st.textContent = `
      #hud .nradio { position: absolute; right: 38px; bottom: 30px; font-family: ${TYPE}; font-size: 14px; letter-spacing: 0.35em; color: #e6e3dc; text-transform: uppercase;
        text-shadow: 0 0 4px #000, 0 0 2px #000; opacity: 0; transition: opacity 0.4s; pointer-events: none; white-space: nowrap; }
      #hud .nradio.up { opacity: 1; transition: opacity 0.1s; }
      #hud .nradio b { font-weight: normal; font-size: 22px; letter-spacing: 0.08em; margin-right: 12px; }
      #hud .nmoney.up ~ .nradio { bottom: 104px; }
      #hud.titled .nradio, #hud.nnocity .nradio { display: none; }
    `;
    document.head.appendChild(st);
    this.el = document.createElement('div');
    this.el.className = 'nradio';
    G.hud.root.appendChild(this.el);
    this.showT = 0;
    G.on('city:in', (e) => { const car = e && e.car; this.station = car && car.radio != null ? car.radio : -1; if (this.station >= 0) this.play(this.station, 0.8); });
    G.on('city:out', () => this.fadeOut(0.6));
    G.on('scene:exit', () => this.fadeOut(0.3));
    G.on('fail', () => this.fadeOut(0.3));
  }

  get car() { const R = this.G.city; return R && R.inCar ? R.car : null; }
  get name() { return this.station >= 0 ? STATIONS[this.station].name : null; }

  // one fixed step: F in the car turns the dial
  step() {
    const G = this.G;
    if (!this.night.inCity || !this.car || G.failing) return;
    if (G.keysDown.has('KeyF') || G.vin.down.has('KeyF')) this.turn();
  }

  turn() {
    const car = this.car;
    this.turns++;
    this.station = this.station + 1 >= STATIONS.length ? -1 : this.station + 1;
    if (car) car.radio = this.station;
    if (this.G.sfx) this.G.sfx.play('n_dial', this.dash(), {}, { ref: 1.2, send: false });
    if (this.station < 0) { this.fadeOut(0.25); this.show('radio off'); return; }
    this.play(this.station, 0.35);
    const S = STATIONS[this.station];
    this.show(`<b>${S.dial}</b>${S.name}`);
    this.night.taughtRadio = true;
  }

  show(html) { this.el.innerHTML = html; this.el.classList.add('up'); this.showT = 2.2; }

  // the dashboard's speaker, in the world
  dash() {
    const car = this.car || (this.G.city && this.G.city.car);
    if (!car) return null;
    const p = car.world(0.95, 0);
    p.y = 0.95;
    return p;
  }

  play(i, fade = 0.5) {
    this.fadeOut(0.2);
    const S = this.G.sfx;
    if (!S || !S.live) { this.cur = { id: STATIONS[i].id, silent: true }; return; }
    const ctx = S.ctx, R = S.R;
    const pos = this.dash();
    const pan = S.dest(pos, { ref: 1.4, roll: 1, max: 60 });
    const out = ctx.createGain(); out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, Math.max(0.02, fade / 3));
    // the speaker: no low end, no top, a little bite
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.55;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260;
    bp.connect(hp).connect(out).connect(pan);
    // the needle's hiss and the carrier's hum, under whatever plays (all there is until a file is dropped in)
    const hiss = ctx.createBufferSource(); hiss.buffer = R.white; hiss.loop = true; hiss.start(ctx.currentTime, Math.random());
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 4800; hf.Q.value = 0.8;
    const hg = ctx.createGain(); hg.gain.value = 0.018;
    hiss.connect(hf).connect(hg).connect(out);
    const hum = ctx.createOscillator(); hum.frequency.value = 120; hum.start();
    const humG = ctx.createGain(); humG.gain.value = 0.006;
    hum.connect(humG).connect(out);
    const el = new Audio();
    el.loop = true;
    el.crossOrigin = 'anonymous';
    let k = 0;
    const id = STATIONS[i].id;
    const tryNext = () => { if (k >= EXTS.length) { el.removeAttribute('src'); return; } el.src = `music/${id}.${EXTS[k++]}`; el.play().catch(() => {}); };
    el.addEventListener('error', tryNext);
    let src = null;
    try { src = ctx.createMediaElementSource(el); src.connect(bp); } catch (e) { el.muted = !!S.muted; }
    tryNext();
    this.cur = { id, el, src, out, pan, srcs: [hiss, hum] };
  }

  fadeOut(secs = 0.5) {
    const C = this.cur;
    this.cur = null;
    if (!C || C.silent) return;
    const S = this.G.sfx;
    try {
      C.out.gain.setTargetAtTime(0, S.ctx.currentTime, Math.max(0.02, secs / 3));
      setTimeout(() => {
        try { C.el.pause(); C.el.removeAttribute('src'); } catch (e) { /* */ }
        for (const s of C.srcs) { try { s.stop(); } catch (e) { /* */ } }
        try { C.out.disconnect(); C.pan.disconnect(); } catch (e) { /* */ }
      }, secs * 1000 + 300);
    } catch (e) { /* no audio */ }
  }

  // per rendered frame: the speaker rides the dash; the dial's name goes
  frame(dt) {
    if (this.showT > 0) { this.showT -= dt; if (this.showT <= 0) this.el.classList.remove('up'); }
    const C = this.cur;
    if (C && !C.silent && C.pan && C.pan.positionX) {
      const p = this.dash();
      if (p) { const t = this.G.sfx.ctx.currentTime; C.pan.positionX.setTargetAtTime(p.x, t, 0.03); C.pan.positionY.setTargetAtTime(p.y, t, 0.03); C.pan.positionZ.setTargetAtTime(p.z, t, 0.03); }
    }
  }
}
