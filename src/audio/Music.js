// Music slots (docs/story/CONTRACTS.md §12.3, STORY.md "Music"). No music is
// composed: the user drops real jazz into public/music/<slot>.(mp3|ogg|m4a)
// and it plays; until then a slot is silent (a jukebox slot gives a faint
// needle hiss so the room knows the record is on).
//   music.cue(slot, { fade: 1.5, diegetic?: { pos, room } })   music.stop(fade)
//   music.current -> slot | null
// Diegetic music comes from a point (the jukebox) through a small-speaker
// filter (a band-pass on its own panner).
// (FOUNDATION: working; lane 7 owns it. A missing file is quiet, never an
// error: the element's own 'error' event moves on to the next extension.)
export const MUSIC_SLOTS = ['jukebox_a', 'jukebox_b', 'jukebox_c', 'fight', 'body', 'office', 'chase', 'tail', 'warehouse', 'shootout', 'end'];
const EXTS = ['mp3', 'ogg', 'm4a'];

export class Music {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.el = null;
    this.gain = null;
  }

  get sfx() { return this.game.sfx; }

  cue(slot, { fade = 1.5, diegetic = null } = {}) {
    if (!MUSIC_SLOTS.includes(slot)) throw new Error(`music.cue: no slot '${slot}' (slots: ${MUSIC_SLOTS.join(', ')})`);
    if (slot === this.current) return;
    this.stop(fade);
    this.current = slot;
    this.game.emit('music:cue', { slot });
    const S = this.sfx;
    if (!S || !S.live) return;
    const ctx = S.ctx;
    const el = new Audio();
    el.loop = slot.startsWith('jukebox');
    el.crossOrigin = 'anonymous';
    let k = 0;
    const tryNext = () => {
      if (k >= EXTS.length) { el.removeAttribute('src'); return; }
      el.src = `music/${slot}.${EXTS[k++]}`;
      el.play().catch(() => {});
    };
    el.addEventListener('error', tryNext);
    try {
      const src = ctx.createMediaElementSource(el);
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.8, ctx.currentTime, Math.max(0.01, fade / 3));
      let node = src;
      if (diegetic && diegetic.pos) {
        // a small speaker in a room: no low end, no top
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
        node.connect(bp);
        node = bp;
        g.connect(S.dest(diegetic.pos, { ref: 2.5, roll: 1 }));
        // the needle on the record, under whatever plays (all there is
        // until a file is dropped in)
        S.loop('needle', diegetic.pos, 0.012, 'white', 5200, 1800);
      } else g.connect(S.bus);
      node.connect(g);
      this.gain = g;
    } catch (e) { /* no audio graph: the element alone (muted with the rest) */ el.muted = !!S.muted; }
    this.el = el;
    tryNext();
  }

  stop(fade = 1.5) {
    const S = this.sfx;
    if (this.el) {
      const el = this.el, g = this.gain;
      if (g && S && S.live) {
        g.gain.setTargetAtTime(0, S.ctx.currentTime, Math.max(0.01, fade / 3));
        setTimeout(() => { el.pause(); el.removeAttribute('src'); }, fade * 1000 + 200);
      } else el.pause();
    }
    if (S && S.live && S.loops.has('needle')) S.stopLoop('needle');
    this.el = null;
    this.gain = null;
    this.current = null;
  }
}
