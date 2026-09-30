import * as THREE from 'three';
import { hoodJoints } from '../../stages/office/build/frosted.js';
import { ROOM, DOOR, SIDE, DESK, CABS, CAB, COOLER, WIN, ESC, FAN, PICTURE } from '../../stages/office/plan.js';
import { BLIND } from '../../stages/office/build/openings.js';
import { office, V } from './room.js';

// Scene 5's machinery (lane B2): the men placed and sent, the cover I have
// from each, the frosted glass that shows them, the room answering every
// round (the blind's slats, the fan, the drawers, the picture, the paper),
// the man behind the glass who falls through it when his outline is shot,
// and the fall: ten seconds, black, back at the shadows.
// (no default export: the scene manager passes this file over)

// ---- the men -------------------------------------------------------------------------------
// the stairs' door at the corridor's south end is where the corridor men come from
const STAIRS_IN = [{ x: -1.55, z: -5.75 }, { x: -1.15, z: -4.6 }];
export const MEN = {
  // the kicker: to the door's glass, then (after the kick) in and behind the open door leaf
  kicker: { at: { x: -2.3, z: -5.8 }, path: [...STAIRS_IN, { x: -0.7, z: -1.2 }, { x: -0.4, z: 1.02 }], role: 'enter', hp: 100, aim: 0.7 },
  // the glass man: behind the sidelight
  glass: { at: { x: -2.3, z: -6.0 }, path: [...STAIRS_IN, { x: -1.4, z: -0.6 }, { x: -1.4, z: 1.9 }, { x: -0.42, z: 2.52 }], role: 'glass', hp: 100, aim: 0.65, fire: { x: -0.42, z: 2.52 } },
  // the doorway man: out of sight south of the jamb, a step into the door to fire
  doorway: { at: { x: -2.3, z: -5.8 }, path: [...STAIRS_IN, { x: -0.7, z: -0.8 }, { x: -0.6, z: 0.08 }], role: 'hall', hp: 100, aim: 0.7, hide: { x: -0.6, z: 0.08 }, fire: { x: -0.42, z: 0.98 } },
  // the Tommy gun at the fire-escape window: up the flight from the floor below
  window: { at: { x: -1.75, z: 7.62 }, path: [{ x: 0.9, z: 7.62 }, { x: 1.55, z: 7.72 }], role: 'window', heavy: true, hp: 130, aim: 0.75, hide: { x: 1.7, z: 7.74 }, fire: { x: 2.72, z: 7.72 } },
  // the last two: another at the door, the heavy on into the room
  second: { at: { x: -2.3, z: -5.8 }, path: [...STAIRS_IN, { x: -0.62, z: -0.6 }, { x: -0.6, z: 0.1 }], role: 'hall', hp: 110, aim: 0.7, hide: { x: -0.6, z: 0.1 }, fire: { x: -0.35, z: 1.05 } },
  // (on past the kicker's place, so the two do not end in one heap by the door)
  heavy: { at: { x: -2.3, z: -6.0 }, path: [...STAIRS_IN, { x: -0.9, z: -0.3 }, { x: -0.55, z: 1.02 }, { x: 0.55, z: 1.1 }, { x: 1.2, z: 2.1 }], role: 'rush', heavy: true, hp: 200, aim: 0.58 },
};

// a man sent in: spawned out of sight, his brain, his feet on the stage's floor
export function send(ctx, name, extra = {}) {
  const G = ctx.game, S = MEN[name];
  const o = { ...S, ...extra };
  // (every shot: a muzzle outside the room lights only what it can reach)
  const userFire = o.onFire || null;
  o.onFire = (hh, B) => { outsideFlash(ctx, hh); if (userFire) userFire(hh, B); };
  const h = G.spawnHood(o.at.x, o.at.z, { brain: 'office', heavy: !!o.heavy, hp: o.hp, role: o.role, path: o.path, hide: o.hide || null, fire: o.fire || null, aim: o.aim, run: !!o.run, wait0: o.wait0, onFire: o.onFire || null, state: 'idle' });
  h.surface = (x, z) => ctx.stage.surfaceY(x, z);
  const ai = G.ais.get(h);
  // (each shot's cover is kept in the flags: the headless plays read it)
  if (ai) { ai.coverK = (from) => { const k = coverFrom(ctx, from), F = ctx.flags; (F.ks || (F.ks = [])).push(Math.round(k * 100) / 100); return k; }; ai.hold = () => !!ctx.flags.down; }
  h.b2 = name;
  const F = ctx.flags;
  (F.men || (F.men = [])).push(h);
  note(ctx, 'in ' + name);
  return h;
}
export const brainOf = (G, h) => { const ai = G.ais.get(h); return ai && ai.brain ? ai : null; };

// the fight's own record (plain text in the flags: the headless tools read it)
export function note(ctx, what) {
  const F = ctx.flags;
  F.log = (F.log || '') + `${ctx.sceneTime.toFixed(1)} ${what}; `;
}

// ---- the cover I have from a shooter at `from` (0 none .. 1 all) -----------------------------
// crouched, with the desk (tipped or not), a cabinet or the cooler between
// him and me, near it: covered. The rounds that come anyway hit what I am
// behind (Game.resolveShot rays them).
const _seg = { ax: 0, az: 0, bx: 0, bz: 0 };
function segBox(b, pad) {
  const { ax, az, bx, bz } = _seg;
  const tl = (x, z) => [(x - b.cx) * b.c - (z - b.cz) * b.s, (x - b.cx) * b.s + (z - b.cz) * b.c];
  const [lx0, lz0] = tl(ax, az), [lx1, lz1] = tl(bx, bz);
  const dx = lx1 - lx0, dz = lz1 - lz0;
  let t0 = 0, t1 = 1;
  for (const [p, d, h] of [[lx0, dx, b.hx + pad], [lz0, dz, b.hz + pad]]) {
    if (Math.abs(d) < 1e-9) { if (Math.abs(p) > h) return false; continue; }
    let a = (-h - p) / d, e = (h - p) / d;
    if (a > e) { const q = a; a = e; e = q; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, e);
    if (t0 > t1) return false;
  }
  return true;
}
export function coverFrom(ctx, from) {
  // (the desk lamp shot out: the room is the slats' light alone, darker for them too)
  const k = coverRaw(ctx, from);
  const L = office(ctx).lights.desk;
  return L && L.dead ? 1 - (1 - k) * 0.7 : k;
}
function coverRaw(ctx, from) {
  const G = ctx.game, C = ctx.controller, e = G.eye;
  // (a shot from behind the cover shows me over it for a moment: a second after each)
  const shown = Math.max(0, 1 - (G.time - (ctx.flags.lastShotT ?? -9)) / 1.1);
  const k = (C.crouchK || 0) * (1 - 0.8 * shown);
  if (k < 0.45) return 0;
  _seg.ax = from.x; _seg.az = from.z; _seg.bx = e.x; _seg.bz = e.z;
  for (const b of ctx.stage.colliders.boxes) {
    if (b.tag !== 'booth' && b.tag !== 'crates' && b.tag !== 'can') continue;
    const d = Math.hypot(e.x - b.cx, e.z - b.cz) - Math.max(b.hx, b.hz);
    if (d > 1.3) continue;
    // (down behind it my hat still shows over its edge: most, not all)
    if (segBox(b, 0.05)) return 0.85 * k;
  }
  return 0.3 * k;
}

// ---- a flash outside the room ------------------------------------------------------------
// The Hoods' muzzle flash carries a short point light (fx/MuzzleFlash.js,
// no shadow): fired from the corridor behind the frosted glass, or from the
// fire escape behind the curtain, it lit the room's own walls through the
// wall as a hard white disc. A muzzle outside the room (and not in the open
// doorway) keeps its sprite and loses its light; the frosted pane he fires
// through flashes white round the muzzle instead (the curtain does its own).
export function outsideFlash(ctx, h) {
  const G = ctx.game, O = office(ctx), MF = G.fx && G.fx.flash;
  if (!MF || !MF.pool || !MF.pool.length) return;
  const P = MF.pool[(MF.poolNext - 1 + MF.pool.length) % MF.pool.length];
  if (!P || P.t !== 0) return;
  const q = P.light.position;
  const inRoom = q.x > 0.02 && q.x < ROOM.x1 && q.z > ROOM.z0 && q.z < ROOM.z1;
  const inDoor = q.x > -0.7 && Math.abs(q.z - (DOOR.z0 + DOOR.z1) / 2) < 0.42 && O.door.angle > 0.8;
  if (inRoom || inDoor) return;
  P.i0 = 0; P.light.intensity = 0; if (P.entry) P.entry.intensity = 0;
  // (the pane between him and the room: its frost lit round his muzzle)
  if (q.x < 0.05) {
    for (const f of [O.frosted[0], O.frosted[1]]) {
      const U = f && f.frost && f.frost.uniforms;
      if (!U || !U.uFl) continue;
      const c = U.uC.value;
      if (Math.abs(q.z - c.z) < 0.9) { U.uFl.value.copy(h.pos).setY(1.35); U.uFl.value.x = Math.min(U.uFl.value.x, -0.1); U.uFlK.value = 1; }
    }
  }
}

// ---- the frosted glass shows the men in the corridor -------------------------------------
export function glassMen(ctx) {
  const O = office(ctx), F = ctx.flags;
  // (the sidelight's glass gone: the blood and the holes that were on it go
  // with it - a splash of red must not hang in the empty frame)
  const sp = O.side && O.side.pane;
  if (sp && sp.state === 'gone' && !F._sideSwept) {
    F._sideSwept = true;
    const G = ctx.game;
    if (G.fx && G.fx.decals) G.fx.decals.clearIn(new THREE.Box3(V(-0.3, SIDE.y0 - 0.04, SIDE.z0 - 0.04), V(0.1, SIDE.y1 + 0.04, SIDE.z1 + 0.04)));
  }
  // (the panes' flashes die in a few frames)
  for (const f of [O.frosted[0], O.frosted[1]]) {
    const U = f && f.frost && f.frost.uniforms;
    if (U && U.uFlK && U.uFlK.value > 0) { U.uFlK.value *= 0.55; if (U.uFlK.value < 0.02) U.uFlK.value = 0; }
  }
  // (a man going down fades off the glass as he falls - his outline lying
  // down, the hat drawn on a head that is on the floor, read as a blot)
  const kOf = (h) => (h.alive ? 1 : Math.max(0, 1 - Math.max(0, h._deathT ?? 9) / 0.7));
  const men = (F.men || []).filter((h) => kOf(h) > 0 && h.pos.x < -0.16 && h.pos.x > -2.0);
  const panes = [O.frosted[0], O.frosted[1]];
  for (const f of panes) {
    const L = f.frost.userData.figures;
    L.length = 0;
    for (const h of men) {
      if (L.length >= 3) break;
      if (!h._b2j) h._b2j = hoodJoints(h);
      L.push({ k: kOf(h), joints: h._b2j });
    }
  }
  // the man on the fire escape: his outline on the curtain (the light-well behind him)
  const C = O.curtain.frost.userData.figures;
  C.length = 0;
  for (const h of F.men || []) {
    if (C.length >= 2 || h.pos.z < 7.1 || kOf(h) <= 0) continue;
    if (!h._b2j) h._b2j = hoodJoints(h);
    C.push({ k: kOf(h), joints: h._b2j });
  }
}

// ---- the room answers every round (the player's and theirs) ---------------------------------
export function roomReacts(ctx) {
  const G = ctx.game, O = office(ctx), R = G.react;
  if (!R || R._b2) return;
  R._b2 = true;
  const rng = ctx.stage.rng.fork(3057);
  const b0 = R.bullet.bind(R);
  R.bullet = (hit, dir, opts = {}) => {
    // (their stray rounds go wide of the desk lamp: it is mine to shoot out)
    if (opts.weak && hit && hit.mesh && hit.mesh.userData.lamp === O.lights.desk) return null;
    try { roomHit(ctx, O, hit, dir, rng, opts); } catch (e) { console.error(e); }
    return b0(hit, dir, opts);
  };
}
const inside = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
function roomHit(ctx, O, hit, dir, rng) {
  const G = ctx.game, m = hit.mesh, ud = m.userData;
  const pt = hit.point;
  // the street window: the round came through the blind first
  if (ud.pane && (ud.pane === O.window.up || ud.pane === O.window.lo)) {
    const t = (BLIND.x - pt.x) / (dir.x || 1e-6);
    const bp = pt.clone().addScaledVector(dir, t);
    if (O.blind.pierce(bp, rng)) G.sfx.play('office_blindRattle', bp);
    // (the street's noise in through the holes)
    if (G.sfx.roomOpen) G.sfx.roomOpen(Math.min(0.6, (G.sfx.openK || 0) + 0.12));
    return;
  }
  // the fan: a blade bent, it clips its housing every turn after
  if (m.name === 'fan_blade') {
    const b = O.fan.blades.find((q) => q.mesh === m);
    if (b && b.bent < 2) { b.bent++; b.mesh.rotation.x += (rng.next() - 0.5) * 0.5; b.mesh.rotation.z += 0.12 + rng.next() * 0.15; O.fan.rpm = Math.max(14, O.fan.rpm * 0.65); O.fan.bent = true; }
    for (let k = 0; k < 8; k++) G.fx.sparks.spawn({ pos: pt.clone(), vel: V(rng.gauss() * 1.5, rng.range(-0.5, 1), rng.gauss() * 1.5), life: rng.range(0.1, 0.3), size: [0.008, 0.012], stretch: 0.03, col: [5, 5, 5], cell: 4, gravity: 9.8, ground: 0.01, fadeOut: 0.3 });
    return;
  }
  // a filing cabinet: a drawer jolts out (and the paper in it goes up)
  for (const c of O.cabinets) {
    if (!inside(m, c.group)) continue;
    const d = c.drawers.reduce((a, q) => (Math.abs(q.y + 0.15 - pt.y) < Math.abs(a.y + 0.15 - pt.y) ? q : a), c.drawers[0]);
    d.group.position.z -= 0.05 + rng.next() * 0.08;
    G.sfx.play('break_cabinet', pt);
    papers(ctx, pt, dir, rng, 3);
    return;
  }
  // the picture: it jumps on its wire
  if (inside(m, O.picture.nail)) {
    O.picture.vel += (rng.next() - 0.5) * 6;
    O.picture.swinging = true;
    return;
  }
  // the desk and what is on it: paper
  if (inside(m, O.desk.pivot)) { papers(ctx, pt, dir, rng, 4); return; }
}

// sheets of paper up off a hit, drifting down (they settle and stay)
const PAPER = { mat: null };
export function papers(ctx, at, dir, rng, n = 5) {
  const B = ctx.stage.breakables;
  // (a sheet's paper, not a light: at 0x9a one in the floor lamp's beam printed as a glowing card)
  const mat = PAPER.mat || (PAPER.mat = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.9, side: THREE.DoubleSide }));
  mat.userData.inkSurface = 'plaster';
  for (let k = 0; k < n; k++) {
    // (its face on local y: the field lays a thin piece down on local y - an
    // unturned plane came to rest standing on its edge, a white card in the air)
    const g = new THREE.PlaneGeometry(rng.range(0.16, 0.22), rng.range(0.2, 0.28)).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(at).add(V(rng.gauss() * 0.08, rng.range(0, 0.08), rng.gauss() * 0.08));
    m.rotation.set(rng.next() * 6, rng.next() * 6, rng.next() * 6);
    m.userData.inkId = 3; m.userData.noRay = true;
    B.field.add(m, V(rng.gauss() * 0.9, rng.range(1.6, 3.2), rng.gauss() * 0.9).addScaledVector(dir, 0.5), V(rng.gauss() * 3, rng.gauss() * 3, rng.gauss() * 3), { paper: true, thin: true });
  }
  ctx.game.sfx.play('office_papers', at);
}

// ---- the man behind the glass: shoot his outline and he comes through it ----------------------
export function glassReward(ctx) {
  const G = ctx.game, O = office(ctx), F = ctx.flags;
  const fn = (e) => {
    if (!e || e.weapon !== 'revolver' || !e.hit || !e.hit.mesh) return;
    const pane = e.hit.mesh.userData.pane;
    if (pane !== O.side.pane && pane !== O.door.pane) return;
    const cam = G.camera, dir = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
    const men = (F.men || []).filter((h) => h.alive && h.pos.x < -0.14);
    if (!men.length) return;
    const hit = G.rays.raycastHoods(cam.position, dir, 30, men);
    if (!hit) return;
    const h = hit.hood;
    G.fx.bloodFx.hit(hit.point, dir, { strength: 1.2, rays: G.rays });
    G.counters.hits++;
    // (through the glass: forward, onto his knees and down through it)
    G.killHood(h, dir.clone(), false, 'deathKnees');
    F.throughGlass = (F.throughGlass || 0) + 1;
    const chest = h.bones.chest.getWorldPosition(V(0, 0, 0));
    ctx.stage.glass.shatter(pane, { dir: V(1, -0.1, 0), power: 2.2, by: 'body', at: chest.setX(-0.07) });
    G.sfx.play('break_glass_big', V(-0.07, 1.6, (SIDE.z0 + SIDE.z1) / 2));
  };
  G.on('shot', fn);
  return () => G.off('shot', fn);
}

// ---- the fall: black, and back at the shadows -----------------------------------------------
export function fallHook(ctx, onFall) {
  const G = ctx.game, Hh = G.health;
  const prev = Hh.onDeath;
  Hh.onDeath = () => {
    G.counters.deaths++;
    G.emit('player:down', {});
    onFall();
  };
  return () => { Hh.onDeath = prev; };
}
void ROOM; void DOOR; void DESK; void CABS; void CAB; void COOLER; void WIN; void ESC; void FAN; void PICTURE;
