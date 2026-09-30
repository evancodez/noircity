import { PROP_KINDS } from '../../props/index.js';
import { REVOLVER } from '../../player/weapons/revolver.js';

// The plain revolver's stand-in marks (lane B2, second pass): until lane B3's
// revolver lands (its model, its hands, its own inked cylinder) the gun the
// gunfight is built on has no model at all, so a player cannot see where it
// points, how many rounds are left or that it is being reloaded. While the
// revolver is out and has no model, a scene layer shows the least that
// makes the fight playable: a small dot at the view's centre (where the
// round goes) and six chambers at the lower right (full ones pale, spent
// ones black; they fill in pairs during the reload), and the first time the
// cylinder runs dry, one prompt: R reload.
// It retires on its own: once a 'revolver' prop exists (B3's buildProp),
// standInGun() does nothing.
//   standInGun(ctx)   in the scene's script (the layer goes with the scene)
export function standInGun(ctx) {
  if (PROP_KINDS.includes('revolver')) return;
  const G = ctx.game;
  const L = ctx.hud.layer('b2gun');
  L.innerHTML = `
    <div class="b2dot" style="position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#f2f2f2;box-shadow:0 0 0 1px rgba(0,0,0,0.85);display:none"></div>
    <canvas class="b2cyl" width="152" height="152" style="position:absolute;right:34px;bottom:26px;width:76px;height:76px;display:none"></canvas>`;
  const dot = L.querySelector('.b2dot'), cv = L.querySelector('.b2cyl');
  const g = cv.getContext('2d');
  let last = '', promptT = 0;
  // (a brush's wobble, fixed per chamber so it does not crawl)
  const jit = [0.9, -0.6, 0.4, -1.1, 0.7, -0.3];
  const draw = (full, turning) => {
    g.clearRect(0, 0, 152, 152);
    const cx = 76, cy = 76;
    // the cylinder's face: an ink disc with a paler rim, the flutes between the chambers
    g.save();
    g.translate(cx, cy);
    g.rotate(turning);
    g.fillStyle = '#0b0b0b';
    g.beginPath(); g.arc(0, 0, 66, 0, Math.PI * 2); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#8c8c8a';
    g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#2a2a2a';
    for (let i = 0; i < 6; i++) {
      const a = (i + 0.5) / 6 * Math.PI * 2 - Math.PI / 2;
      g.beginPath(); g.arc(Math.cos(a) * 60, Math.sin(a) * 60, 9, 0, Math.PI * 2); g.fill();
    }
    // the chambers: a round's pale rim and dark primer, or an empty black hole
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 38 + jit[i] * 0.6, y = Math.sin(a) * 38 - jit[(i + 2) % 6] * 0.6;
      if (i < full) {
        g.fillStyle = '#e9e7e0';
        g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#b9b7b0';
        g.beginPath(); g.arc(x, y, 9.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1a1a1a';
        g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = '#000';
        g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fill();
        g.lineWidth = 2.5; g.strokeStyle = '#555';
        g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.stroke();
      }
    }
    // the centre pin
    g.fillStyle = '#6e6e6c';
    g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  let turn = 0, turnTo = 0, prevAmmo = null;
  ctx.onStep((dt) => {
    const W = G.player.weapons, R = W.current === 'revolver' ? W.active : null;
    const mode = G.controller.mode;
    const on = !!R && G.state === 'playing' && mode !== 'cutscene';
    dot.style.display = on && !R.reloading ? 'block' : 'none';
    cv.style.display = on ? 'block' : 'none';
    if (!on) return;
    // (a shot turns the cylinder a sixth)
    if (prevAmmo != null && R.ammo < prevAmmo) turnTo += Math.PI / 3;
    prevAmmo = R.ammo;
    turn += (turnTo - turn) * Math.min(1, dt * 22);
    // (the reload: the rounds go in by pairs as it runs)
    const full = R.reloading ? Math.min(6, 2 * Math.floor(3 * (1 - R.reloadLeft / REVOLVER.reload))) : R.ammo;
    const key = full + ':' + turn.toFixed(2);
    if (key !== last) { draw(full, turn % (Math.PI * 2)); last = key; }
    // (the first time it runs dry: how to fill it)
    if (!G._b2reloadTaught && R.ammo === 0 && !R.reloading) { G._b2reloadTaught = true; G.hud.prompt('R  reload', null, 'b2reload'); promptT = 2.4; }
    if (promptT > 0 && ((promptT -= dt) <= 0 || R.reloading)) { promptT = 0; G.hud.clearPrompt('b2reload'); }
  });
}
