// Stand-ins for lane C1's kit (WAVE_C §3), with its signatures, used only
// while hud.objective / hud.teach / hud.warn / game.fail do not exist yet in
// this worktree. The gun kit and the test bed call them through the helpers
// below, which take C1's real ones the moment they are there:
//   objective(G, text | null)              the objective line, top left
//   teach(G, id, text, { until, key })     the teach card, once per save
//   warn(G, text | null)                   the warning before a loss
//   fail(G, { why, to, fall })             the fall, black, the reason, back at `to`
// (the stand-ins are plain inked lines in the HUD's own faces: no art pass)
const TYPE = '"American Typewriter", "Courier New", monospace';

function layer(G, name, css) {
  const L = G.hud.layer(name);
  if (!L.dataset.c2) { L.dataset.c2 = '1'; L.style.cssText += css; }
  return L;
}

export function objective(G, text) {
  if (typeof G.hud.objective === 'function') return G.hud.objective(text);
  const L = layer(G, 'c2objective', '');
  if (!text) { L.innerHTML = ''; G._c2objective = null; return; }
  if (G._c2objective === text) return;
  G._c2objective = text;
  L.innerHTML = `<div style="position:absolute;left:34px;top:30px;font:15px ${TYPE};letter-spacing:0.12em;color:#d8d6d0;text-shadow:0 0 4px #000,0 0 2px #000;border-left:2px solid #d8d6d0;padding:2px 0 2px 10px;opacity:0.82">${text}</div>`;
}

// the key drawn as a key cap: a letter in a box, the mouse buttons as words
function cap(key) {
  const label = { Mouse0: 'LMB', Mouse2: 'RMB', Space: 'SPACE', ControlLeft: 'CTRL' }[key] || key.replace(/^Key/, '');
  return `<span style="display:inline-block;min-width:30px;padding:3px 8px;margin-right:12px;border:2px solid #efede7;border-radius:4px;font-weight:bold;text-align:center;background:rgba(0,0,0,0.55)">${label}</span>`;
}

export function stubTeach(G, id, text, opts = {}) {
  const S = G.save;
  const taught = (S.flags.taught || (S.flags.taught = {}));
  if (taught[id] && !opts.again) return false;
  taught[id] = (taught[id] || 0) + 1;
  const L = layer(G, 'c2teach', '');
  const key = opts.key || 'KeyE';
  L.innerHTML = `<div style="position:absolute;left:50%;bottom:24%;transform:translateX(-50%);font:16px ${TYPE};letter-spacing:0.2em;color:#efede7;text-shadow:0 0 5px #000,0 0 2px #000;white-space:nowrap;display:flex;align-items:center">${cap(key)}<span>${text}</span></div>`;
  const t0 = G.time, until = opts.until;
  const done = () => {
    if (G.time - t0 > (opts.secs ?? 3.2)) return true;
    if (typeof until === 'function') return until() && G.time - t0 > 0.6;
    if (typeof until === 'string') return G.held(until) && G.time - t0 > 0.4;
    return false;
  };
  const fn = () => {
    if (done() || !L.isConnected) { L.innerHTML = ''; const i = G.scripts.indexOf(fn); if (i >= 0) G.scripts.splice(i, 1); }
  };
  G.scripts.push(fn);
  (G._c2taught || (G._c2taught = [])).push(id);
  return true;
}
export function teach(G, id, text, opts = {}) {
  if (typeof G.hud.teach === 'function') return G.hud.teach(id, text, opts);
  return stubTeach(G, id, text, opts);
}

export function warn(G, text) {
  if (typeof G.hud.warn === 'function') return G.hud.warn(text);
  const L = layer(G, 'c2warn', '');
  if (!text) { L.innerHTML = ''; G._c2warn = null; return; }
  if (G._c2warn === text) return;
  G._c2warn = text;
  (G._c2warned || (G._c2warned = [])).push(text);
  L.innerHTML = `<div style="position:absolute;left:50%;bottom:31%;transform:translateX(-50%);font:italic 21px Baskerville, Georgia, serif;letter-spacing:0.06em;color:#f2f0ea;text-shadow:0 0 8px #000,0 0 3px #000,0 0 2px #000">${text}</div>`;
}

// the fall: the view goes down (0.9 s), black, the reason on the black,
// back at the beat `to` (under ten seconds from the fall to the controls)
export function fail(G, { why = '', to = null, fall = true } = {}) {
  if (typeof G.fail === 'function') return G.fail({ why, to, fall });
  const S = G.scenes, C = G.controller;
  if (!S.current || G._c2failing) return;
  G._c2failing = true;
  const beat = to || S.beat;
  const F = G._c2fails || (G._c2fails = {});
  F[beat] = (F[beat] || 0) + 1;
  (G._c2why || (G._c2why = [])).push(why);
  const from = C.eyePose();
  if (fall) {
    C.setMode('cutscene', { track: (t) => {
      const u = Math.min(1, t / 0.9), e = u * u;
      return { x: from.x, y: from.y + (Math.max(0.35, G.stage.surfaceY(from.x, from.z) + 0.3) - from.y) * e, z: from.z, yaw: from.yaw + 0.3 * e, pitch: from.pitch + (0.5 - from.pitch) * e };
    } });
    G.sfx.play('grunt', null, { f0: 80, k: 0.5, dur: 0.3 }, { send: false });
    G.sfx.play('f_bodyFloor', G.eye);
  }
  G.hud.clearPrompt();
  // the reason, lettered on the black (above the fade)
  let el = document.getElementById('c2why');
  if (!el) {
    el = document.createElement('div');
    el.id = 'c2why';
    el.style.cssText = `position:fixed;left:0;right:0;top:46%;text-align:center;font:italic 26px Baskerville, Georgia, serif;letter-spacing:0.08em;color:#e8e6e0;z-index:60;pointer-events:none;opacity:0;transition:none`;
    document.body.appendChild(el);
  }
  el.textContent = why;
  let t = 0;
  const fn = (tt, dt) => {
    t += dt;
    if (t > (fall ? 0.9 : 0.1)) G.hud.fade(Math.min(1, (t - (fall ? 0.9 : 0.1)) / 0.35));
    el.style.opacity = String(Math.max(0, Math.min(1, (t - 1.2) / 0.3)) * (1 - Math.max(0, Math.min(1, (t - 3.0) / 0.3))));
    if (t > 3.1 && G._c2failing) {
      G._c2failing = false;
      el.style.opacity = '0';
      const i = G.scripts.indexOf(fn); if (i >= 0) G.scripts.splice(i, 1);
      G.health.reset();
      S.go(S.current.id, { beat, fade: 'cut', card: false });
      S.setFade(1);
      S.trans = { phase: 'in', t: 0, def: S.current, opts: {}, fadeIn: 0.7 };
    }
  };
  G.scripts.push(fn);
}
export const fails = (G, beat) => (G._c2fails && G._c2fails[beat]) || 0;
