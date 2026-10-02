// The tail's use of the wave C kit (lane C1, docs/story/seams/Z.md): the
// objective line (hud.objective), the teach card (hud.teach), the warning
// (hud.warn), the fail (game.fail). After the critic (3rd owner) the shim's
// own fallbacks are gone (wave-c/integration has the kit); what is left here
// is the tail's own:
//   - the aim mark (a small white dot with a black ring at the frame's middle
//     while the revolver is out of the window: the round goes down the eye's
//     line, and the barrel, low and left at arm's length, is not on it);
//   - the chapter's card lettered small over the windscreen as I pull out
//     (the cut from the foot chase into the seat has no card on black);
//   - kit.warning: the scene's own warning as last set (the plays read it).
// The objective lines of the beats are declared in 07_tail.js (defineScene
// objectives); chase.js sets a line itself only for a change inside a beat.
const CSS = `
  .c3card { position: absolute; left: 50%; top: 21%; transform: translateX(-50%); text-align: center; color: #efede7; opacity: 0;
    text-shadow: 0 0 8px #000, 0 0 2px #000; white-space: nowrap; pointer-events: none; display: none; }
  .c3card .n { display: block; font-size: 13px; letter-spacing: 0.5em; margin-bottom: 6px; }
  .c3card .t { display: block; font-size: 15px; letter-spacing: 0.42em; text-transform: uppercase; }
  .c3aim { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%;
    background: #f1eee7; box-shadow: 0 0 0 1.5px #000, 0 0 5px rgba(0,0,0,0.9); opacity: 0; pointer-events: none; }
  #hud.failing .c3card, #hud.failing .c3aim { visibility: hidden; }
`;

export function makeKit(G) {
  const H = G.hud;
  let el = null, warnText = null, cardT = 0, cardDur = 0, aimShown = 0;
  const layer = () => {
    if (el && el.isConnected) return el;
    el = H.layer('c3kit');
    if (!document.getElementById('c3kitcss')) { const st = document.createElement('style'); st.id = 'c3kitcss'; st.textContent = CSS; document.head.appendChild(st); }
    el.innerHTML = '<div class="c3card"><span class="n"></span><span class="t"></span></div><div class="c3aim"></div>';
    return el;
  };
  const q = (c) => layer().querySelector(c);
  const kit = {
    objective(text, opts) { H.objective(text, opts); },
    // text: '[W] drive  [A] [D] steer' (the kit draws the key caps)
    teach(id, text, opts = {}) { return H.teach(id, text, opts); },
    teachAgain(id, text, opts = {}) { return H.teach.again(id, text, opts); },
    warn(text) {
      const t = text || null;
      if (t === warnText) return;
      warnText = t;
      H.warn(t);
    },
    get warning() { return warnText; },
    aimMark(k) {
      if (G.shotMode && !/hud=1/.test(location.search)) return;
      const a = Math.max(0, Math.min(1, (k - 0.75) / 0.25));
      if (a === aimShown) return;
      aimShown = a;
      q('.c3aim').style.opacity = (a * 0.9).toFixed(2);
    },
    smallCard(num, name, secs = 3.4) {
      if (G.shotMode && !/hud=1/.test(location.search)) return;
      const c = q('.c3card');
      c.querySelector('.n').textContent = num || '';
      c.querySelector('.t').textContent = name || '';
      c.style.display = 'block'; c.style.opacity = '0';
      cardT = cardDur = secs;
    },
    // the one way the chapter loses (game.fail: the hard stop, black, the
    // why lettered on it, back at the beat with the world as its setup makes it)
    fail({ why, to }) {
      kit.warn(null);
      G._tailRetry = true;   // (back at a beat: no card of any size)
      if (G.fail({ why, to })) return true;
      // (shot mode has no fail: ?c3auto look development goes straight back)
      if (G.shotMode) G.scenes.go('tail', { beat: to, fade: 'cut', card: false });
      return false;
    },
    step(dt) {
      if (cardT > 0 && el) {
        cardT -= dt;
        const c = q('.c3card'), age = cardDur - cardT;
        const a = Math.max(0, Math.min(1, age / 0.6, cardT / 0.9));
        c.style.opacity = (a * a * (3 - 2 * a)).toFixed(3);
        if (cardT <= 0) c.style.display = 'none';
      }
    },
  };
  return kit;
}
