// [C10a critic] shared bits: a snap that adds what the screen says (objective, warn, teach, prompt)
export const K = `(() => { const k = G.hud.kit; const t = document.querySelector('#hud .kteach, .kteach'); return ' OBJ[' + (G.hud.objectiveText || '') + '] WARN[' + (G.hud.warnText || '') + '] TEACH[' + (t && t.offsetParent ? t.innerText.replace(/\\s+/g, ' ') : '') + '] inv=' + (G.save && G.save.inventory || []).join('/'); })()`;
export function wrap(h) {
  const base = h.snapExpr;
  h.snapExpr = `(${base}) + (${K})`;
  return h;
}
// walk to a point by real input (W held, the mouse turns him), as play.mjs's walk
export async function walkTo(h, x, z, ms = 15000) {
  const T = Date.now() + ms; let w = false;
  const setW = async (on) => { if (on !== w) { w = on; await (on ? h.down('KeyW') : h.up('KeyW')); } };
  for (;;) {
    const s = await h.js(`({ x: N.controller.pos.x, z: N.controller.pos.z, yaw: N.controller.yaw, sens: N.controller.sensitivity })`);
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d < 0.4 || Date.now() > T) { await setW(false); return d < 0.4; }
    const want = Math.atan2(-dx, -dz);
    const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    if (Math.abs(err) > 0.03) await h.turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0);
    await setW(Math.abs(err) < 0.6);
    await h.wait(33);
  }
}
// face a point (yaw only)
export async function face(h, x, z) {
  for (let k = 0; k < 40; k++) {
    const s = await h.js(`({ x: N.controller.pos.x, z: N.controller.pos.z, yaw: N.controller.yaw, sens: N.controller.sensitivity })`);
    const want = Math.atan2(-(x - s.x), -(z - s.z));
    const err = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    if (Math.abs(err) < 0.04) return true;
    await h.turn(Math.round(Math.max(-40, Math.min(40, -err * 0.6 / s.sens))), 0); await h.wait(30);
  }
  return false;
}
// what a finished scene may leave behind, and what the new one starts with
export const AFTER = `JSON.stringify({ scene: G.scenes.current && G.scenes.current.id, beat: G.scenes.beat, mode: N.controller.mode, frozen: N.controller.frozen, hands: G.hands.set, weap: G.player.weapons.current, vehicles: G.vehicles ? (G.vehicles.list || []).length : -1, hoods: G.world.hoods.list.length, ais: G.ais.size, brawl: G.brawl.active, obj: G.hud.objectiveText, warn: G.hud.warnText, prompt: G.hud.promptShown, say: G.hud.sayShown, inv: G.save.inventory, note: G.save.flags && G.save.flags.note, ts: G.timeScale, crawl: G.crawl, save: (JSON.parse(localStorage.getItem('noir.save') || 'null') || {}).scene + '.' + (JSON.parse(localStorage.getItem('noir.save') || 'null') || {}).beat })`;
