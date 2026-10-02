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
`;

export function makeKit(G) {
  const H = G.hud;
  let el = null, warnText = null, teachT = 0, teachUntil = null, objFresh = 0;
  const layer = () => {
    if (el && el.isConnected) return el;
    el = H.layer('c3kit');
    if (!document.getElementById('c3kitcss')) { const st = document.createElement('style'); st.id = 'c3kitcss'; st.textContent = CSS; document.head.appendChild(st); }
    el.innerHTML = '<div class="c3obj"></div><div class="c3warn"></div><div class="c3teach"></div>';
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
    // the one way the chapter loses: black, the why on it, back at the beat
    fail({ why, to }) {
      kit.warn(null);
      kit.failed = (kit.failed || 0) + 1;
      if (G.fail) return G.fail({ why, to });
      H.say(why, 2.4);
      G.scenes.go('tail', { beat: to, fade: 'black', card: false, fadeIn: 0.8 });
    },
    step(dt) {
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
