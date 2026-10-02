// The wave C kit's names (lane C1: hud.objective, hud.teach, hud.warn,
// game.fail; docs/story/seams/Z.md once merged) through a small shim of the
// tail's own: when the Game and the HUD have them, they are used; until
// then the tail draws its own objective line (top left, small), its teach
// line (the key as a cap, once per save), its warning (centre low), and
// fails by the scene manager's black (the why said on it, back at the beat).
// Drop this file's fallbacks once wave-c/integration has seams/Z.md.
const CSS = `
  .c3obj { position: absolute; left: 34px; top: 30px; font-size: 13px; letter-spacing: 0.3em; text-transform: uppercase; color: #d9d6cf;
    text-shadow: 0 0 6px #000, 0 0 2px #000; opacity: 0.62; transition: opacity 0.5s; white-space: nowrap; }
  .c3obj.fresh { opacity: 1; }
  .c3obj::before { content: ''; display: inline-block; width: 18px; height: 2px; background: #d9d6cf; vertical-align: middle; margin-right: 12px; opacity: 0.8; }
  .c3warn { position: absolute; left: 50%; bottom: 25%; transform: translateX(-50%); font-size: 17px; letter-spacing: 0.24em; color: #f4f1ea;
    text-shadow: 0 0 10px #000, 0 0 3px #000; white-space: nowrap; display: none; }
  .c3teach { position: absolute; left: 50%; bottom: 31%; transform: translateX(-50%); font-size: 14px; letter-spacing: 0.28em; color: #efede7;
    text-shadow: 0 0 6px #000, 0 0 2px #000; white-space: nowrap; display: none; text-transform: lowercase; }
  .c3teach .cap { display: inline-block; min-width: 26px; padding: 3px 8px; margin: 0 10px 0 0; border: 1.5px solid #e8e6df; border-radius: 4px;
    font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(0,0,0,0.55); box-shadow: 0 0 6px #000; }
  .c3teach .sep { display: inline-block; width: 22px; }
  .c3card { position: absolute; left: 50%; top: 21%; transform: translateX(-50%); text-align: center; color: #efede7; opacity: 0;
    text-shadow: 0 0 8px #000, 0 0 2px #000; white-space: nowrap; pointer-events: none; display: none; }
  .c3card .n { display: block; font-size: 13px; letter-spacing: 0.5em; margin-bottom: 6px; }
  .c3card .t { display: block; font-size: 15px; letter-spacing: 0.42em; text-transform: uppercase; }
  .c3veil { position: absolute; inset: 0; background: #000; opacity: 0; display: flex; align-items: center; justify-content: center; }
  .c3veil span { font-size: 22px; letter-spacing: 0.34em; color: #efede7; text-transform: uppercase; opacity: 0; text-shadow: 0 0 8px #000; }
  .c3aim { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%;
    background: #f1eee7; box-shadow: 0 0 0 1.5px #000, 0 0 5px rgba(0,0,0,0.9); opacity: 0; pointer-events: none; }
`;

// [2nd owner] the fail's black (until C1's game.fail): the frame goes to
// black, the why is lettered on it and held long enough to read (it was a
// subtitle over a fade that came back up in under a second), then the cut
// to the checkpoint under the black and the room fades up out of it. Module
// state: the veil outlives the Chase that failed (the new one's kit steps
// it on). Its own layer, above the objective line.
const VEIL = { out: 0.45, hold: 1.15, in: 0.75 };
let veil = null;
function veilStep(G, dt) {
  if (!veil) return;
  const V = veil;
  V.t += dt;
  const el = V.el, sp = el.firstChild && el.firstChild.firstChild;
  const smooth = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  if (V.phase === 'out') {
    el.firstChild.style.opacity = smooth(V.t / VEIL.out).toFixed(3);
    if (V.t >= VEIL.out) { V.phase = 'hold'; V.t = 0; }
  } else if (V.phase === 'hold') {
    el.firstChild.style.opacity = '1';
    if (sp) sp.style.opacity = smooth(V.t / 0.25).toFixed(3);
    if (V.t >= VEIL.hold) {
      V.phase = 'in'; V.t = 0;
      // (under the black: the cut back to the checkpoint)
      G.scenes.go('tail', { beat: V.to, fade: 'cut', card: false });
    }
  } else {
    el.firstChild.style.opacity = (1 - smooth(V.t / VEIL.in)).toFixed(3);
    if (sp) sp.style.opacity = (1 - smooth(V.t / 0.3)).toFixed(3);
    if (V.t >= VEIL.in) { el.firstChild.style.opacity = '0'; veil = null; }
  }
}
export function failing() { return !!veil; }

export function makeKit(G) {
  const H = G.hud;
  let el = null, warnText = null, teachT = 0, teachUntil = null, objFresh = 0, cardT = 0, cardDur = 0, aimShown = 0;
  const layer = () => {
    if (el && el.isConnected) return el;
    el = H.layer('c3kit');
    if (!document.getElementById('c3kitcss')) { const st = document.createElement('style'); st.id = 'c3kitcss'; st.textContent = CSS; document.head.appendChild(st); }
    el.innerHTML = '<div class="c3obj"></div><div class="c3warn"></div><div class="c3teach"></div><div class="c3card"><span class="n"></span><span class="t"></span></div><div class="c3aim"></div>';
    return el;
  };
  const q = (c) => layer().querySelector(c);
  const taught = () => { const f = G.save.flags; return f.taught || (f.taught = {}); };
  const kit = {
    objective(text) {
      if (H.objective) return H.objective(text);
      if (G.shotMode && !/hud=1/.test(location.search)) return;
      const o = q('.c3obj');
      if (o.textContent === (text || '')) return;
      o.textContent = text || '';
      o.style.display = text ? '' : 'none';
      o.classList.add('fresh'); objFresh = 2.5;
      kit.current = text;
    },
    // keys: [['RMB', 'aim'], ['LMB', 'fire']]  or a text with one key
    teach(id, keys, opts = {}) {
      if (H.teach) return H.teach(id, Array.isArray(keys) ? keys.map(([k, t]) => `[${k}] ${t}`).join('  ') : keys, opts);
      const T = taught();
      if (T[id] && !opts.again) return;
      T[id] = (T[id] || 0) + 1;
      const t = q('.c3teach');
      const list = Array.isArray(keys) ? keys : [[keys.split(' ')[0], keys.split(' ').slice(1).join(' ')]];
      t.innerHTML = list.map(([k, w]) => `<span class="cap">${k}</span>${w}`).join('<span class="sep"></span>');
      t.style.display = 'block';
      teachT = opts.secs ?? 4;
      teachUntil = opts.until || null;
    },
    teachAgain(id, keys, opts = {}) { return kit.teach(id, keys, { ...opts, again: true }); },
    warn(text) {
      if (H.warn) return H.warn(text);
      if (warnText === (text || null)) return;
      warnText = text || null;
      const w = q('.c3warn');
      w.textContent = text || '';
      w.style.display = text ? 'block' : 'none';
    },
    get warning() { return warnText; },
    // [2nd owner] the revolver out of the window: the round goes down the
    // eye's line, and the barrel (out at arm's length, low and left) is not
    // on it - a small mark at the frame's middle while the arm is out says
    // where it goes (k: the arm's 0..1)
    aimMark(k) {
      if (G.shotMode && !/hud=1/.test(location.search)) return;
      const a = Math.max(0, Math.min(1, (k - 0.75) / 0.25));
      if (a === aimShown) return;
      aimShown = a;
      q('.c3aim').style.opacity = (a * 0.9).toFixed(2);
    },
    // the chapter's card lettered small over the windscreen as I pull out
    // (the cut from the foot chase into the seat has no card on black)
    smallCard(num, name, secs = 3.4) {
      if (G.shotMode && !/hud=1/.test(location.search)) return;
      const c = q('.c3card');
      c.querySelector('.n').textContent = num || '';
      c.querySelector('.t').textContent = name || '';
      c.style.display = 'block'; c.style.opacity = '0';
      cardT = cardDur = secs;
    },
    // the one way the chapter loses: black, the why on it, back at the beat
    fail({ why, to }) {
      kit.warn(null);
      kit.failed = (kit.failed || 0) + 1;
      G._tailRetry = true;   // (back at a beat: no card of any size)
      if (G.fail) return G.fail({ why, to });
      if (G.shotMode) { G.scenes.go('tail', { beat: to, fade: 'cut', card: false }); return; }
      layer();
      const el = H.layer('c3veil');
      if (!el.firstChild) el.innerHTML = '<div class="c3veil"><span></span></div>';
      el.firstChild.firstChild.textContent = why;
      el.firstChild.firstChild.style.opacity = '0';
      veil = { el, t: 0, phase: 'out', why, to };
    },
    step(dt) {
      veilStep(G, dt);
      if (cardT > 0 && el) {
        cardT -= dt;
        const c = q('.c3card'), age = cardDur - cardT;
        const a = Math.max(0, Math.min(1, age / 0.6, cardT / 0.9));
        c.style.opacity = (a * a * (3 - 2 * a)).toFixed(3);
        if (cardT <= 0) c.style.display = 'none';
      }
      if (objFresh > 0) { objFresh -= dt; if (objFresh <= 0 && el) q('.c3obj').classList.remove('fresh'); }
      if (teachT > 0) {
        teachT -= dt;
        const done = teachUntil && (typeof teachUntil === 'function' ? teachUntil() : G.pressed(teachUntil));
        if (teachT <= 0 || done) { teachT = 0; if (el) q('.c3teach').style.display = 'none'; }
      }
    },
  };
  return kit;
}
