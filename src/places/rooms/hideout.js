import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { counter, desk, chair, crates, shelves, safe, label, table, lockers } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';
import { gunsOf } from '../../guns/Guns.js';

// The gangs' hideouts on the Docks (brief O5 §2.8): the pier office (a
// shipping office on the quay by Pier 7: the counter, the store behind it,
// the stairs up to the boss's office over the front, its safe, its window
// on the river) and a warehouse (one long hall of stacked crates, the
// office in its far corner with the safe). Men inside: they watch me come
// in - "They know your face." - and, if I stay in their sight, draw (the
// base's gun kit, docs/story/seams/GUNS.md: the men from the room's nav,
// the stand-in for O4's spawn; the revolver comes out of my coat - the
// stand-in for O4's carried guns). The safe: E kicks it (twice) and it
// opens, the money in it. A back way out. Cleared, it stays cleared.
const CASH = { pieroffice: 180, warehouse: 240 };
export default {
  kind: 'hideout',
  spawn: { x: 0, z: -1.4, yaw: 0 },
  build(K, s, P) {
    const R0 = new RNG(s.id === 'warehouse' ? 0x3A2E : 0x9E2), rng = () => R0.next();
    if (s.id === 'pieroffice') pierOffice(K, s, P, rng); else warehouse(K, s, P, rng);
    // the safe: E kicks it, twice, and it swings open; then the money
    const S = K.safeAt;
    const sf = safe(K, S.x, S.z, S.yaw, { y: S.y });
    K.safe = sf;
    K.use({ at: [S.x, S.y + 0.6, S.z], range: 2.0, cone: 0.6, lvl: S.lvl,
      prompt: () => (s.state.safeOpen ? (s.state.safeTaken ? 'the safe (empty)' : 'the money') : 'kick the safe'),
      onUse: () => {
        const G = P.game;
        if (s.state.safeOpen) {
          if (s.state.safeTaken) return;
          s.state.safeTaken = true; P.money(CASH[s.id], 'from the safe'); G.sfx.play('wallet', null, {}, { ref: 1 }); P.crime('theft', K.F.v(S.x, S.y + 0.5, S.z), 2);
          return;
        }
        s.state.kicks = (s.state.kicks || 0) + 1;
        G.sfx.play('office_doorKick', K.F.v(S.x, S.y + 0.5, S.z), {}, { ref: 3 }); G.controller.shake(0.35, 0);
        if (s.state.kicks >= 2) { s.state.safeOpen = true; G.sfx.play('office_safeDoor', K.F.v(S.x, S.y + 0.5, S.z), {}, { ref: 3 }); } else G.hud.message('It gives a little.', 1.2);
        if (run && run.alarm) run.alarm('the safe');
      } });
    let run = null;
    K._setRun = (r) => { run = r; };
  },
  live(K, s, P) { const r = hideoutLife(K, s, P); K._setRun(r); return r; },
};

function pierOffice(K, s, P, rng) {
  const b = s.lb;
  const x0 = -4.5, x1 = 5.0, zf = -5.5, z1 = -0.3, Hf = 3.0, up = FLOOR + 3.2;
  const sx0 = Math.max(b.x0 + 0.5, -13.4), sx1 = Math.min(b.x1 - 0.5, 12.0), sz0 = Math.max(b.z0 + 0.5, -18.0);
  K.roomRect = { x0: sx0, x1: sx1, z0: sz0, z1 };
  // ---- the front office (floor 0)
  K.at(0);
  K.room(x0, x1, zf, z1, { h: Hf, floor: 'boards', wall: 'plaster', look: { ambient: 0.5, haze: 0.4, room: 'o5_big' }, sides: { s: { holes: P.doorHoles(s, 's') }, n: { holes: [{ a: 3.0, b: 4.0, top: FLOOR + 2.05 }] } } });
  counter(K, x0, 1.8, -3.0, -2.4, { dir: 's', h: 1.05 });
  desk(K, -3.6, -2.0, -4.9, -4.1); chair(K, -2.8, -4.4 + 0.6, 0);
  shelves(K, -4.4, -2.0, x0, { dir: 'e', h: 1.6, n: 3, depth: 0.45, fill: 'linen', rng });
  label(K, 'HARBOR SHIPPING CO.', -1.4, FLOOR + 2.4, zf, { w: 2.4, h: 0.32, dir: 's', dark: true });
  K.lamp(-1.0, FLOOR + 2.3, -2.4, { kind: 'pendant', power: 0.7, ceilY: FLOOR + Hf });
  K.door({ x: 3.0, z: zf - 0.12, axis: 'x', w: 1.0, name: 'store0' });
  // ---- the store behind it (floor 0, high)
  const Hs = 6.2;
  K.room(sx0, sx1, sz0, zf - 0.24, { h: Hs, floor: 'concrete', wall: 'concrete', ceil: 'dark', look: { ambient: 0.4, haze: 0.5, room: 'o5_big' }, sides: { s: false, w: { holes: P.doorHoles(s, 'w') } } });
  // (the store's front wall each side of the front office)
  K.at(null);
  K.wall('x', zf - 0.12, sx0, x0 - 0.24, FLOOR, FLOOR + Hs, { key: 'concrete' });
  K.wall('x', zf - 0.12, x1 + 0.24, sx1, FLOOR, FLOOR + Hs, { key: 'concrete' });
  K.wall('x', zf - 0.12, x0 - 0.24, x1 + 0.24, up + Hf - 0.2, FLOOR + Hs, { key: 'concrete', solid: false });
  K.at(0);
  for (const [cx, cz, n] of [[-9.5, -9.0, 3], [-9.5, -13.5, 2], [-5.0, -11.0, 3], [-1.0, -14.5, 2], [3.0, -10.5, 2], [6.5, -14.0, 3], [9.5, -10.0, 2], [-12.0, -16.5, 2]]) {
    if (cx < sx0 + 0.8 || cx > sx1 - 0.8 || cz < sz0 + 0.8) continue;
    crates(K, cx, cz, { n, s: 1.1, rng });
    K.cols.at(-1).tag = 'crates';
  }
  for (const [x, z] of [[-7, -8.2], [1.0, -12.0], [8.0, -12.5]]) K.lamp(x, FLOOR + Hs - 1.2, z, { kind: 'cage', power: 0.8, ceilY: FLOOR + Hs });
  // the stairs up along the store's front wall to the landing at the office's door
  const lz0 = zf - 1.45, lz1 = zf - 0.24;
  K.stairs(5.4, Math.min(11.6, sx1 - 0.2), lz0, lz1, FLOOR, up, 'w', { key: 'wood', lvl: 0 });
  K.solid(8.0, Math.min(11.6, sx1 - 0.2), lz0 - 0.1, lz0 + 0.02, { lvl: 0 });
  K.at(1);
  K.floor(2.6, 5.4, lz0, lz1, up, 'wood', { slab: 0.15, lvl: 1 });
  K.rail(2.6, lz0, 5.4, lz0, up, { lvl: 1 });
  K.rail(2.6, lz0, 2.6, lz1, up, { lvl: 1 });
  K.rail(5.4, lz0, Math.min(11.6, sx1 - 0.2), lz0, FLOOR + 0.9, { h: 0.95, lvl: 1, solid: false });
  // ---- the boss's office upstairs, over the front office: its window on the quay, the safe
  const W = P.faceWindows(s, { kinds: ['win'], y0: up + 0.4, y1: up + 3.0, x0: x0 + 0.6, x1: x1 - 0.6 }).slice(0, 1);
  K.windows = W;
  K.room(x0, x1, zf, z1, { y: up, h: Hf - 0.2, floor: 'boards', wall: 'plaster', look: { ambient: 0.45, haze: 0.3, room: 'o5_big' }, sides: { s: { holes: P.windowHoles(W) }, n: { holes: [{ a: 3.0, b: 4.0, top: up + 2.05 }] } } });
  K.door({ x: 3.0, z: zf - 0.12, axis: 'x', w: 1.0, y: up, name: 'office1' });
  desk(K, -2.4, 0.4, -3.4, -2.4, { y: up }); chair(K, -1.0, -3.9, 0, { y: up });
  K.lamp(-1.0, up + 1.15, -2.9, { kind: 'pendant', power: 0.6, ceilY: up + 1.2, drop: 0.95 });
  K.lamp(1.8, up + 2.3, -1.6, { kind: 'bare', power: 0.4, ceilY: up + Hf - 0.2 });
  lockers(K, -4.4, -2.2, z1, { dir: 'n', y: up, h: 1.7 });
  K.safeAt = { x: x0 + 0.6, z: zf + 0.7, yaw: Math.PI / 2, y: up, lvl: 1 };
  K.at(null);
  // the men: two in the front office, two in the store (one upstairs would stand on the office's floor)
  K.men = [
    { kind: 'pistol', x: -2.6, z: -4.0 }, { kind: 'pistol', x: 2.8, z: -1.6 },
    { kind: 'pistol', x: -6.0, z: -8.6 }, { kind: 'tommy', x: 4.0, z: -13.0 },
  ];
  K.area = { x0: sx0, x1: sx1, z0: sz0, z1 };
}

function warehouse(K, s, P, rng) {
  const b = s.lb;
  const x0 = b.x0 + 0.5, x1 = b.x1 - 0.5, z0 = b.z0 + 0.5, z1 = -0.3, H = Math.min(7.5, s.lot.h - 1.0);
  K.roomRect = { x0, x1, z0, z1 };
  K.at(0);
  K.room(x0, x1, z0, z1, { h: H, floor: 'concrete', wall: 'concrete', ceil: 'dark', look: { ambient: 0.35, haze: 0.55, room: 'o5_big' }, sides: { s: { holes: P.doorHoles(s, 's') }, e: { holes: P.doorHoles(s, 'e') } } });
  // the crates in their rows down the hall (cover), a lane down the middle
  for (let z = -5.0; z > z0 + 6; z -= 4.6) for (const x of [-10.0, -6.0, 5.5, 9.5]) {
    if (x < x0 + 1 || x > x1 - 1) continue;
    if (rng() < 0.2) continue;
    crates(K, x + (rng() - 0.5) * 0.6, z + (rng() - 0.5) * 0.6, { n: 1 + Math.floor(rng() * 3), s: 1.2, rng });
    K.cols.at(-1).tag = 'crates';
  }
  for (let z = -4; z > z0 + 2; z -= 7) K.lamp(0, FLOOR + H - 1.4, z, { kind: 'cage', power: 0.9, ceilY: FLOOR + H });
  // the office in the far corner: its walls, its door, its desk, the safe
  const ox0 = x1 - 5.6, oz1 = z0 + 5.0;
  K.wall('x', oz1 + 0.12, ox0, x1, FLOOR, FLOOR + 3.0, { key: 'plaster', holes: [{ a: ox0 + 0.8, b: ox0 + 1.8, top: FLOOR + 2.05 }] });
  K.wall('z', ox0 - 0.12, z0, oz1 + 0.24, FLOOR, FLOOR + 3.0, { key: 'plaster', holes: [{ a: z0 + 2.0, b: z0 + 3.2, bottom: FLOOR + 1.0, top: FLOOR + 2.0, win: true }] });
  K.ceil(ox0 - 0.24, x1, z0, oz1 + 0.24, FLOOR + 3.0);
  K.door({ x: ox0 + 0.8, z: oz1 + 0.12, axis: 'x', w: 1.0, name: 'office' });
  K.volume(ox0, x1, z0, oz1, FLOOR, FLOOR + 3.0, { ambient: 0.4, haze: 0.3, room: 'o5_big' });
  desk(K, ox0 + 1.4, ox0 + 3.4, z0 + 1.2, z0 + 2.1); chair(K, ox0 + 2.4, z0 + 0.7, Math.PI);
  table(K, ox0 + 0.9, z0 + 3.8, { w: 0.7, d: 0.7 });
  K.lamp(ox0 + 2.4, FLOOR + 2.3, z0 + 1.6, { kind: 'pendant', power: 0.6, ceilY: FLOOR + 3.0 });
  label(K, 'BONDED', 0, FLOOR + 4.5, z0, { w: 3.0, h: 0.8, dir: 's', dark: true });
  K.safeAt = { x: x1 - 0.6, z: z0 + 2.6, yaw: -Math.PI / 2, y: FLOOR, lvl: 0 };
  K.at(null);
  K.men = [
    { kind: 'pistol', x: -3.0, z: -7.0 }, { kind: 'pistol', x: 3.5, z: -11.5 },
    { kind: 'pistol', x: -8.0, z: -16.0 }, { kind: 'tommy', x: 7.5, z: -20.0 }, { kind: 'pistol', x: ox0 + 2.0, z: z0 + 3.0 },
  ];
  K.area = { x0, x1, z0, z1 };
}

// the men: spawned with the place (out of sight behind its shut door), held
// by their start() until they turn on me; the warning, then the fight
function hideoutLife(K, s, P) {
  const G = P.game, F = s.frame;
  const st = { hostile: false, seen: 0, warned: false, men: [], begun: false, t: 0 };
  const Kt = gunsOf(G);
  const A = K.area, box = F.box(A.x0, A.x1, A.z0, A.z1);
  const begin = () => {
    if (st.begun || s.state.cleared) return;
    st.begun = true;
    const c = F.w((A.x0 + A.x1) / 2, (A.z0 + A.z1) / 2);
    G.stage.part('bounds').navAround(c.x, c.z, Math.max(A.x1 - A.x0, A.z1 - A.z0) / 2 + 3);
    Kt.end();
    Kt.begin({ to: 'roam', area: box, maxFiring: 2, flankAfter: 8, settleK: 1.1, why: { open: 'Shot standing in the open.', moving: 'Shot in the open.' } });
    for (const m of K.men) {
      if (s.state.dead && s.state.dead.includes(m)) continue;
      const p = F.w(m.x, m.z), e = F.w(0, 0);
      const h = Kt.spawn({ kind: m.kind, at: p, start: () => st.hostile, yaw: Math.atan2(e.x - p.x, e.z - p.z) });
      h._o5 = m;
      st.men.push(h);
    }
  };
  const alive = () => st.men.filter((h) => h.alive);
  const run = {
    alarm(why) { if (!st.hostile && st.begun) { st.hostile = true; G.hud.warn(null); P.crime('hideout', G.eye.clone(), 2); arm(); void why; } },
    step(dt) {
      st.t += dt;
      if (!st.begun && !s.state.cleared) begin();
      if (!st.begun) return;
      const inside = P.inside === s;
      if (!st.hostile) {
        // seen: a man with a line on me, within 14 m
        let seen = false;
        if (inside) for (const h of alive()) { const d = Math.hypot(h.pos.x - G.eye.x, h.pos.z - G.eye.z); if (d < 14 && Kt.see && Kt.see(new THREE.Vector3(h.pos.x, (h.pos.y || 0) + 1.55, h.pos.z), G.eye, 0.25)) { seen = true; h.lookAt && h.lookAt(G.eye.clone()); } }
        st.seen = seen ? st.seen + dt : Math.max(0, st.seen - dt * 0.5);
        if (st.seen > 0.3 && !st.warned) { st.warned = true; G.hud.warn('They know your face.'); }
        if (!seen && st.warned && st.seen <= 0) { st.warned = false; G.hud.warn(null); }
        // (a shot of mine anywhere in here, or a man hit: at once)
        if (st.seen > 2.2 || alive().length < st.men.length) this.alarm('seen');
      }
      if (st.hostile && !alive().length && !s.state.cleared) {
        s.state.cleared = true; G.hud.warn(null);
        G.hud.message('Quiet. Just the rain on the roof.', 2.2);
        Kt.end();
        G.emit('hideout:cleared', { id: s.id });
      }
      // (gone out of the place while they hunt me: they stay inside; it ends when I am well away)
    },
    leave() { if (!st.hostile && st.warned) { st.warned = false; G.hud.warn(null); st.seen = 0; } },
    dispose() {
      // the dead stay dead (a count kept); the living go with the place
      const dead = st.men.filter((h) => !h.alive).map((h) => h._o5);
      s.state.dead = [...new Set([...(s.state.dead || []), ...dead])];
      for (const h of st.men) { try { G.removeHood(h); } catch (e) { /* */ } }
      st.men = [];
      if (st.begun && Kt.active) Kt.end();
      if (st.warned) G.hud.warn(null);
    },
  };
  // the revolver out of my coat (the stand-in for O4's carried guns)
  const arm = () => {
    if (G.player.weapons.current) return;
    Kt.arm('revolver');
    if (G.controller.mode === 'walk') G.controller.setMode('gun', { crouch: false });
    G.setViewmodelVisible(true);
    G.hud.teach('fire', '[LMB] fire', { secs: 2.5 });
  };
  // (a shot of mine while they watch)
  const onShot = () => { if (s.live && st.begun && P.inside === s) run.alarm('shot'); };
  G.on('shot', onShot);
  const d0 = run.dispose;
  run.dispose = () => { G.off('shot', onShot); d0(); };
  return run;
}
