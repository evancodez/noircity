import * as THREE from 'three';
import { BR_ATTACKS } from '../../cast/brawl/clips.js';
import { MANNERS } from '../../cast/brawl/brain.js';
import { PIER } from '../../stages/pier9/site.js';
import { RING } from '../../stages/pier9/parts/bay.js';
import { FIRE } from '../../fx/fxTextures.js';
import { FIRE_COL } from '../../fx/Explosion.js';
import { ATLAS } from '../../fx/fxTextures.js';
import { buildProp } from '../../props/index.js';

// The second fist fight (lane R2-E, docs/story/briefs/B9_PIER_FIGHT.md): the
// foreman in Pier 9's loading bay, on the way out. The rules are the first
// fight's (game/Brawl.js, docs/story/FIGHT.md v4); this file gives them this
// room, this man, these things and this finish, as data:
//   FM_ATTACKS   his hook's two blows (added to the rules' table)
//   FM_MANNERS   what he throws, by manner, with the hook in his fist and without
//   FM_THINGS    what the bay puts in my hands (a hook, a crate lid, a chain, a lantern)
//   bayRoom(ctx) the rules' room: the ring's walls, what is in reach, what a
//                man is driven into, the loading doors he goes out through,
//                what a thing does when it is spent (the hook sticks in a
//                crate, the lid splits, the lantern burns on the floor)
//   PierFight    the fight's own life under the rules: the fire, the flying
//                boards, the splash, the rain coming in through the hole
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();

// ---- his blows with the hook -----------------------------------------------------------
// the swing: a long flat arc at arm's length and a hook's length, from his
// right across to his left. A hop aside is not enough (lateral -1.35..0.95:
// either hop from the middle stays in it); a hop back (reach: his distance
// at the tell + 0.45) or a step in, inside it (closer than 1.35 m to his
// feet at contact: the hook's point passes behind me) takes me out of it.
// The chop: the hook high over his shoulder and straight down (a hop aside
// or back). Either, hit on the hook arm while he winds up: he drops it
// (the rules' `drops`: Brawl.disarm).
export const FM_ATTACKS = {
  fm_hookSwing: { hand: 'R', kind: 'long', dmg: 17, block: null, push: 0.35, stun: 0.45, miss: { open: 'LR', t: 0.75 }, path: { lo: -1.35, hi: 0.95, reach: 2.45, over: 0.45, min: 1.35 }, heavy: true, drops: 'hook' },
  fm_hookChop: { hand: 'R', kind: 'over', dmg: 16, block: null, push: 0.25, stun: 0.4, miss: { open: 'LR', t: 0.7 }, path: { lo: -0.42, hi: 0.42, reach: 2.15, over: 0.4 }, heavy: true, drops: 'hook' },
};
for (const [k, v] of Object.entries(FM_ATTACKS)) BR_ATTACKS[k] = v;

// ---- his manners: harder and quicker than Mack's; with the hook in his fist
// the hook's blows are half of what he throws (the brain's `with`), his left
// hand the rest. He takes nothing up in the bay (the things are mine).
const noThings = { things: 0, thingKinds: [] };
export const FM_MANNERS = {
  measured: { ...MANNERS.measured, ...noThings, keep: [1.45, 1.7], speed: 2.0, gap: [0.7, 1.15], breathe: 3.2,
    with: { hook: { fm_hookSwing: 0.34, fm_hookChop: 0.14, br_jab: 0.26, br_hookL: 0.14, br_bodyL: 0.08, br_cross: 0.04 } } },
  dirty: { ...MANNERS.dirty, ...noThings, keep: [1.35, 1.6], speed: 2.2, gap: [0.55, 0.95],
    mix: { br_jab: 0.2, br_cross: 0.14, br_hook: 0.2, br_hookL: 0.18, br_body: 0.08, br_bodyL: 0.08, br_shove: 0.12 },
    with: { hook: { fm_hookSwing: 0.36, fm_hookChop: 0.2, br_jab: 0.16, br_hookL: 0.14, br_shove: 0.08, br_bodyL: 0.06 } } },
  wild: { ...MANNERS.wild, ...noThings,
    mix: { br_haymaker: 0.26, br_haymakerL: 0.2, br_hook: 0.16, br_hookL: 0.12, br_rush: 0.16, br_cross: 0.1 },
    with: { hook: { fm_hookSwing: 0.34, fm_hookChop: 0.22, br_haymakerL: 0.18, br_rush: 0.14, br_hookL: 0.12 } } },
};

// ---- what the bay puts in my hands (the rules' THINGS, the room's own) ----------------
//   hook     it breaks his guard, the most damage of anything here; one use:
//            it sticks in a crate
//   lid      both hands: held up (SPACE) it is a shield - it stops one blow of
//            his whatever it is, and a heavy one splits it; or swung once
//   chain    a long reach, two swings
//   lantern  swung or thrown: it breaks and the oil burns on the floor
export const FM_THINGS = {
  hook: { dmg: 40, uses: 1, hands: 1, throw: false, breaksGuard: true, level: 3 },
  lid: { dmg: 20, uses: 1, hands: 2, throw: false, breaksGuard: true, big: true, level: 3, shield: true },
  chain: { dmg: 15, uses: 2, hands: 1, throw: false, level: 2, reach: 0.7 },
  lantern: { dmg: 12, uses: 1, hands: 1, throw: true, level: 2 },
};
export const FOREMAN = { name: 'THE FOREMAN', hp: 124 };

// where the fight finds us (a retry, a jump): him toward the doors, me off
// the stairs' foot
export const RING_START = { him: { x: 12.9, z: -33.2 }, me: { x: 12.2, z: -37.4 } };
export const EYE_Y = 1.65;

// ---- the room ---------------------------------------------------------------------------
export function bayRoom(ctx, fight) {
  const { stage, game: G } = ctx;
  const bay = stage.part('bay'), shed = stage.part('shed');
  const Bk = stage.breakables;
  const items = [];
  // the things of the bay (a thing taken is gone from the bay)
  for (const r of bay.reach) {
    if (r.kind === 'rope') continue;
    const kind = r.kind === 'crateLid' ? 'lid' : r.kind === 'cargoHook' ? 'hook' : r.kind === 'chainCoil' ? 'chain' : r.kind;
    items.push({ name: r.name, kind, ref: r });
  }
  const posOf = (it) => it.ref.object.getWorldPosition(V(0, 0, 0));
  // (a thing is there to take while it lies in the room: not in a hand,
  // not in the air, not spent - one knocked out of my hand lies there again)
  const vmRoot = () => G.player.hands.vm.root;
  const taken = (it) => {
    const o = it.ref.object;
    if (it.ref.spent || !o.parent || o.parent === vmRoot() || !o.visible) return true;
    const F = stage.breakables.pieces;
    return !!(F && F.live.some((p) => p.mesh === o));
  };
  const lift = (it) => {
    const o = it.ref.object;
    it.ref.gone = true;
    fight.field(o, false);
    if (o.parent) o.parent.remove(o);
    o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.setScalar(1);
    o.visible = true;
    return o;
  };
  const room = {
    lane: 11.9,
    bounds: { ...RING },
    things: FM_THINGS,
    // the loading doors: his back to one, 0.45 m from its planks
    finishes: shed.loading.map((d, i) => ({ name: 'door' + (i + 1), spot: { x: PIER.shed.x1 - PIER.shed.t - 0.5, z: d.z }, door: d, clip: 'fm_ko_river' })),
    items() {
      const out = [];
      for (const it of items) {
        if (taken(it) || it.ref.spent) continue;
        if (it.kind === 'lantern' && !bay.lantern.hung) continue;
        const pos = posOf(it);
        out.push({ name: it.name, kind: it.kind, object: it.ref.object, pos, stand: pos, take: () => lift(it), available: () => !taken(it) });
      }
      return out;
    },
    // (he takes nothing up here: his hands are for the hook and me)
    hisItem() { return null; },
    // what a man is driven into
    knockables() {
      const out = [];
      for (const s of bay.stacks) out.push({ pos: s.pos, r: s.r, what: 'crates', s });
      for (const b of bay.barrels) if (b.pos.z > RING.z0 - 1 && b.pos.z < RING.z1 + 1) out.push({ pos: b.pos, r: b.r, what: 'barrel', b });
      out.push({ pos: bay.post.pos, r: bay.post.r, what: 'post' });
      return out;
    },
    hardAt(tag, x, z) {
      if (tag === 'wall' && x > PIER.shed.x1 - 0.6) return shed.loading.some((d) => Math.abs(d.z - z) < PIER.loadingW / 2 + 0.1) ? 'door' : 'wall';
      if (tag === 'stairs') return 'stairs';
      if (tag === 'column') return 'post';
      return tag === 'crates' ? 'crates' : 'wall';
    },
    // his back into it
    onInto(hit, dir, at, Br) {
      const w = hit.what;
      fight.knock(w, hit.obj, dir, at, Br);
      if (!hit.obj && w === 'wall') return 'br_stun';
      return 'br_into';
    },
    // me driven into it
    onBump(at, speed, Br) { fight.bump(at, speed, Br); },
    enter() {}, leave() {},
    // a thing of mine spent (Brawl.breakInWorld): the room says what it
    // becomes; true when it did it
    spent(kind, o, at, dir, Br) {
      const it = items.find((x) => x.ref.object === o);
      const done = fight.spent(kind, o, at, dir, Br);
      if (done && it) it.ref.spent = true;
      return done;
    },
    // what falls out of his hand (Brawl.dropHisProp): his hook lies where it
    // falls, a thing in reach
    onHisDrop(kind, o, w, q, Br) {
      if (kind !== 'hook') return false;
      const ref = { name: 'hisHook', kind: 'cargoHook', object: o, onFloor: true };
      items.push({ name: 'hisHook', kind: 'hook', ref });
      fight.dropHook(o, w, q, Br);
      return true;
    },
    // his feet keep out of the fire
    avoid(g) { fight.avoid(g); },
    gift() {},
  };
  return room;
}

// ---- the fight's life ------------------------------------------------------------------
export class PierFight {
  constructor(ctx) {
    this.ctx = ctx;
    this.G = ctx.game;
    this.stage = ctx.stage;
    this.fires = [];
    this.tweens = [];
    this.rain = null;
    this.boards = [];
    this.stuck = [];
    this.flot = [];
  }

  get bay() { return this.stage.part('bay'); }
  // where a thing is in the world - one just let go of by my hand is
  // parentless with its place in the viewmodel's frame (Hands.hold keep)
  heldWorld(o) {
    const p = V(0, 0, 0), q = new THREE.Quaternion(), s = V(1, 1, 1);
    if (o.parent) { o.updateMatrixWorld(true); o.matrixWorld.decompose(p, q, s); return { p, q }; }
    const vm = this.G.player.hands.vm.root;
    vm.updateMatrixWorld(true);
    new THREE.Matrix4().compose(o.position, o.quaternion, o.scale).premultiply(vm.matrixWorld).decompose(p, q, s);
    return { p, q };
  }
  get rng() { return this.ctx.rng; }
  sfx(name, pos, p = {}, opts = {}) { const S = this.G.sfx; if (S && S.play) S.play(name, pos, p, { ref: 3, ...opts }); }

  // a thing let fall under gravity to rest on what is under it
  field(o, add = true, vel = V(0, 0, 0), spin = V(0, 0, 0)) {
    const F = this.stage.breakables.field;
    if (!add) { F.drop((p) => p.mesh === o, new Set([o])); return; }
    if (o.parent !== this.stage.scene) { const w = o.getWorldPosition(V(0, 0, 0)), q = o.getWorldQuaternion(new THREE.Quaternion()); if (o.parent) o.parent.remove(o); this.stage.scene.add(o); o.position.copy(w); o.quaternion.copy(q); }
    o.updateMatrixWorld(true);
    return F.add(o, vel, spin, {});
  }

  // ---- a man driven into something
  knock(what, obj, dir, at, Br) {
    const G = this.G, r = this.rng, bay = this.bay;
    if (what === 'crates' && obj && obj.s) {
      const s = obj.s;
      // the top crate comes down, off the far side
      if (s.top && !s.top.down) {
        s.top.down = true;
        const o = s.top.object;
        Br.later(0.1, () => {
          const v = V(dir.x * r.range(1.2, 2.0), r.range(0.6, 1.3), dir.z * r.range(1.2, 2.0));
          this.field(o, true, v, V(r.gauss() * 2.5, r.gauss() * 1.5, r.gauss() * 2.5));
          this.sfx('crash', o.getWorldPosition(V(0, 0, 0)), {}, { delay: 0.35 });
        });
      }
      this.splinters(at.clone().setY(0.9), dir, 5);
      Br.sfx('bodyThud', at, { k: 1 });
      this.sfx('b9crate', at);
      return;
    }
    if (what === 'post') {
      const L = bay.lantern;
      Br.sfx('bodyThud', at, { k: 1 });
      this.sfx('b9post', bay.post.pos.clone().setY(1.5));
      if (L.hung) {
        L.knocks++;
        L.swing(-dir.x * 1.6 + r.gauss() * 0.3, -dir.z * 1.6 + r.gauss() * 0.3);
        // (the second time the post is hit the lantern jumps off its nail)
        if (L.knocks >= 2) Br.later(0.12, () => this.lanternFalls());
      }

      return;
    }
    if (what === 'barrel' && obj && obj.b) { this.jolt(obj.b.object, dir, 0.05); Br.sfx('bodyThud', at, { k: 0.8 }); this.sfx('b9barrel', at); return; }
    if (what === 'door') {
      // the loading door takes his back: it shudders on its bar, dust off it
      const d = this.stage.part('shed').loading.find((x) => Math.abs(x.z - at.z) < 1.4);
      if (d) for (const p of d.pieces) this.jolt(p.mesh, V(1, 0, 0), 0.02);

      Br.sfx('bodyThud', at, { k: 1 });
      this.sfx('b9door', at);
      return;
    }
    Br.sfx('bodyThud', at, { k: 0.9 });
  }
  bump(at, speed, Br) {
    const bay = this.bay;
    if (Math.hypot(at.x - bay.post.pos.x, at.z - bay.post.pos.z) < 0.9 && bay.lantern.hung) bay.lantern.swing((at.x - bay.post.pos.x) * 0.8, (at.z - bay.post.pos.z) * 0.8);
  }

  // a thing given a knock that rocks it and settles
  jolt(o, dir, amp) {
    const p0 = o.position.clone();
    this.tweens.push({ t: 0, dur: 0.4, step: (u) => { o.position.copy(p0).addScaledVector(dir, amp * Math.sin(u * Math.PI * 5) * (1 - u)); }, end: () => o.position.copy(p0) });
  }

  dust(at, n = 8, up = 0.3) {
    const F = this.G.fx, r = this.rng;
    if (!F || !F.dust) return;
    for (let k = 0; k < Math.ceil(n / 3); k++) F.dust.spawn({ pos: at.clone().add(V(r.gauss() * 0.3, r.next() * up, r.gauss() * 0.3)), vel: V(r.gauss() * 0.3, -0.3 + r.next() * 0.2, r.gauss() * 0.3), life: 0.8 + r.next() * 0.5, size: [0.16, 0.16], grow: 0.3, alpha: 0.35 });
  }
  splinters(at, dir, n = 10) {
    const F = this.G.fx, r = this.rng;
    if (!F || !F.debris) return;
    for (let k = 0; k < n; k++) F.debris.spawn({ pos: at.clone(), vel: V(dir.x * 2 + r.gauss() * 1.6, 0.8 + r.next() * 2, dir.z * 2 + r.gauss() * 1.6), life: 1.0, size: [0.07, 0.015], rot: r.next() * 6.28, spin: r.gauss() * 10, col: [0.18, 0.18, 0.18], cell: 12, gravity: 9.8, ground: 0.01, fadeOut: 0.3 });
  }

  // ---- what a thing of mine becomes when it is spent
  spent(kind, o, at, dir, Br) {
    if (kind === 'hook') { this.stickHook(o, at, dir); return true; }
    if (kind === 'lid') { this.splitLid(o, at, dir); return true; }
    if (kind === 'chain') {
      const { p, q } = this.heldWorld(o);
      this.stage.scene.add(o); o.position.copy(p); o.quaternion.copy(q); o.scale.setScalar(1); o.updateMatrixWorld(true);
      this.field(o, true, V(dir.x * 0.6, 0.3, dir.z * 0.6), V(this.rng.gauss() * 3, this.rng.gauss() * 3, this.rng.gauss() * 3));
      this.sfx('b9chain', at);
      return true;
    }
    if (kind === 'lantern') { this.smashLantern(o, at, dir); return true; }
    return false;
  }

  // the hook goes on past him from my hand and sticks in what is behind him
  // (a crate's face, the post, the wall, else the planks)
  stickHook(o, at, dir) {
    const G = this.G, S = this.stage;
    const d = V(dir.x, 0, dir.z).normalize();
    const from = at.clone();
    let hit = G.rays ? G.rays.raycast(from.clone().addScaledVector(d, 0.35), d, 3.2) : null;
    // (not into him: past his body)
    let to, q = new THREE.Quaternion();
    if (hit && hit.point) {
      // its point into the face, the handle out of it
      const n = hit.normal ? hit.normal.clone().setY(0).normalize() : d.clone().negate();
      to = hit.point.clone().addScaledVector(n, 0.2);
      to.y = Math.max(0.45, Math.min(1.6, to.y));
      const z = n.clone().negate(), y = V(0, 1, 0), x = y.clone().cross(z).normalize();
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    } else {
      // into the planks: point down, the handle up
      to = from.clone().addScaledVector(d, 1.2); to.y = 0.2;
      const z = V(0, -1, 0), x = V(d.z, 0, -d.x), y = z.clone().cross(x).normalize();
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    }
    S.scene.add(o); o.position.copy(from); o.updateMatrixWorld(true);
    const p0 = from.clone(), q0 = o.quaternion.clone();
    this.tweens.push({ t: 0, dur: 0.16, step: (u) => { o.position.lerpVectors(p0, to, u); o.position.y += Math.sin(u * Math.PI) * 0.12; o.quaternion.copy(q0).slerp(q, Math.min(1, u * 1.4)); o.updateMatrixWorld(true); },
      end: () => { o.position.copy(to); o.quaternion.copy(q); o.updateMatrixWorld(true); this.sfx('b9thunk', to); this.splinters(to, d.clone().negate(), 6); } });
    this.stuck.push(o);
  }

  // the lid splits in two on the blow and its halves fall
  splitLid(o, at, dir) {
    const S = this.stage, r = this.rng;
    const { p: w, q } = this.heldWorld(o);
    if (o.parent) o.parent.remove(o);
    const mat = findMat(o);
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.32, 0.024, 0.64);
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.userData.inkId = o.userData.inkId ?? null;
      m.position.copy(V(s * 0.17, 0.02, 0).applyQuaternion(q).add(w));
      m.quaternion.copy(q);
      S.scene.add(m);
      this.field(m, true, V(dir.x * 1.2 + s * r.range(0.4, 1.0), r.range(0.3, 1.2), dir.z * 1.2 + r.gauss() * 0.6), V(r.gauss() * 5, r.gauss() * 5, r.gauss() * 5));
      this.boards.push(m);
    }
    this.splinters(w, dir, 14);
    this.sfx('b9split', w);
  }

  // ---- his hook out of his fist: it falls and lies where it lands
  dropHook(o, w, q, Br) {
    const r = this.rng;
    this.stage.scene.add(o);
    o.position.copy(w); o.quaternion.copy(q); o.scale.setScalar(1); o.visible = true;
    o.updateMatrixWorld(true);
    const c = Br.c, side = V(Math.cos(c.fig.yaw), 0, -Math.sin(c.fig.yaw));
    this.field(o, true, V(-side.x * r.range(0.8, 1.6), r.range(0.8, 1.5), -side.z * r.range(0.8, 1.6)), V(r.gauss() * 6, r.gauss() * 6, r.gauss() * 6));
    this.sfx('b9clatter', w, {}, { delay: 0.45 });
  }

  // ---- the lantern: knocked off its nail, or broken on him, or thrown:
  // its glass goes and the oil burns on the floor in a small pool
  lanternFalls() {
    const L = this.bay.lantern;
    if (!L.hung) return;
    L.hung = false;
    const o = L.prop;
    const w = o.getWorldPosition(V(0, 0, 0));
    const r = this.rng;
    this.field(o, true, V(r.gauss() * 0.4, 0.2, r.gauss() * 0.4), V(r.gauss() * 3, r.gauss() * 2, r.gauss() * 3));
    // (it hits the planks under the nail about 0.55 s later)
    this.tweens.push({ t: 0, dur: 0.55, step: () => {}, end: () => { this.smashLantern(o, o.getWorldPosition(V(0, 0, 0)), V(-1, 0, 0), true); } });
    void w;
  }
  smashLantern(o, at, dir, fell = false) {
    const L = this.bay.lantern;
    if (o === L.prop) L.lit = false;
    o.visible = false;
    if (o.parent && !fell) o.parent.remove(o);
    this.field(o, false);
    const p = V(at.x, 0, at.z);
    // (inside the ring: a thing broken against the wall burns at its foot)
    p.x = Math.max(RING.x0 + 0.3, Math.min(RING.x1 - 0.3, p.x)); p.z = Math.max(RING.z0 + 0.3, Math.min(RING.z1 - 0.3, p.z));
    this.sfx('break_bottle', at);
    this.sfx('b9whoomph', p, {}, { delay: 0.05 });
    const F = this.G.fx, r = this.rng;
    if (F && F.chips) for (let k = 0; k < 12; k++) F.chips.spawn({ pos: at.clone(), vel: V(r.gauss() * 1.6, 0.6 + r.next() * 1.4, r.gauss() * 1.6), life: 0.8, size: [0.02, 0.02], col: [0.7, 0.7, 0.7], gravity: 9.8, ground: 0.01, fadeOut: 0.2 });
    this.startFire(p);
    this.G.emit('b9:lantern', { at: p });
  }

  // ---- a small pool of burning oil on the planks: the fire accent, a place
  // neither of us wants to stand; the bay's light changes (its own light,
  // low and flickering)
  startFire(p) {
    const L = this.stage.lamps;
    const lamp = L.addCustom({ head: p.clone().setY(1.4), axis: V(0, -1, 0), height: 2.2, half: 1.15, real: true, strength: 0.9, fadeEnd: 0.8, edgeSoft: 0.6, tag: 'fire' });
    if (lamp.cone) lamp.cone.visible = false;
    if (lamp.light) { lamp.light.intensity = 0; lamp.light.distance = 7; }
    const f = { at: p.clone(), t: 0, life: 22, r: 0.62, lamp, acc: 0, accT: 0 };
    this.fires.push(f);
    return f;
  }
  stepFire(f, dt) {
    const F = this.G.fx, r = this.rng;
    f.t += dt;
    const k = Math.min(1, f.t / 0.5) * Math.max(0, Math.min(1, (f.life - f.t) / 4));
    const fl = 0.75 + 0.15 * Math.sin(f.t * 13.1) + 0.1 * Math.sin(f.t * 29.7);
    if (f.lamp.light) f.lamp.light.intensity = 38 * k * fl;
    f.lamp.on = k > 0.01;
    if (f.lamp.entry) f.lamp.entry.intensity = 0.6 * k * fl;
    if (k <= 0 || !F || !F.fire) return;
    // a low sheet of flame with a ragged edge, tongues licking out of it
    f.acc += dt * 38 * (0.4 + 0.6 * k);
    while (f.acc >= 1) {
      f.acc -= 1;
      const a = r.next() * Math.PI * 2, d = Math.sqrt(r.next()) * f.r * (0.6 + 0.4 * k);
      const w = r.range(0.28, 0.5) * (0.6 + 0.4 * k), h = r.range(0.14, 0.26) * (0.7 + 0.3 * k);
      const ball = r.chance(0.35);
      F.fire.spawn({ pos: V(f.at.x + Math.cos(a) * d, 0.02 + h * (ball ? 0.3 : 0.42), f.at.z + Math.sin(a) * d), vel: V(r.gauss() * 0.05, r.range(0.08, 0.25), r.gauss() * 0.05),
        life: r.range(0.3, 0.55), size: [w, ball ? h * 0.6 : h], grow: 0.1, rot: r.gauss() * 0.05, spin: 0,
        col: r.chance(0.4) ? FIRE_COL.white : FIRE_COL.yellow, colEnd: FIRE_COL.deep, colPow: 1.4, cell: ball ? FIRE.BALL[r.int(0, 3)] : FIRE.FLAME[r.int(0, 3)], fadeIn: 0.06, fadeOut: 0.3, drag: 0.8 });
    }
    f.accT += dt * 12 * (0.4 + 0.6 * k);
    while (f.accT >= 1) {
      f.accT -= 1;
      const a = r.next() * Math.PI * 2, d = Math.sqrt(r.next()) * f.r * 0.8, s = r.range(0.2, 0.42) * (0.6 + 0.4 * k);
      F.fire.spawn({ pos: V(f.at.x + Math.cos(a) * d, 0.1 + s * 0.4, f.at.z + Math.sin(a) * d), vel: V(r.gauss() * 0.1, r.range(0.35, 0.8), r.gauss() * 0.1),
        life: r.range(0.22, 0.42), size: [s * 0.8, s], grow: 0.2, rot: r.gauss() * 0.2, spin: r.gauss() * 0.3,
        col: FIRE_COL.yellow, colEnd: FIRE_COL.deep, colPow: 1.4, cell: FIRE.FLAME[r.int(0, 3)], fadeIn: 0.06, fadeOut: 0.3, drag: 0.6 });
    }
  }
  // (is a point in a fire? how hot: 0..1)
  heatAt(x, z, pad = 0) {
    let h = 0;
    for (const f of this.fires) {
      const k = Math.min(1, f.t / 0.5) * Math.max(0, Math.min(1, (f.life - f.t) / 4));
      if (k <= 0.05) continue;
      const d = Math.hypot(x - f.at.x, z - f.at.z);
      if (d < f.r + pad) h = Math.max(h, k * (1 - Math.max(0, d - f.r * 0.5) / (f.r * 0.5 + pad)));
    }
    return Math.max(0, Math.min(1, h));
  }
  // his steering's goal kept out of the fire (the rules' room.avoid)
  avoid(g) {
    for (const f of this.fires) {
      if (f.t > f.life - 1) continue;
      const dx = g.x - f.at.x, dz = g.z - f.at.z, d = Math.hypot(dx, dz), R = f.r + 0.55;
      if (d < R) { const k = d > 1e-3 ? R / d : 0; g.x = f.at.x + (d > 1e-3 ? dx * k : R); g.z = f.at.z + dz * k; }
    }
  }
  putOut() {
    for (const f of this.fires) { f.lamp.on = false; if (f.lamp.light) f.lamp.light.intensity = 0; if (f.lamp.entry) f.lamp.entry.intensity = 0; }
    this.fires = [];
  }

  // ---- the last blow: the door's planks burst out over the river
  burstDoor(w, dir = V(1, 0, 0)) {
    const d = w && w.door;
    if (!d || d.burst) return;
    d.burst = true;
    const r = this.rng;
    for (const p of d.pieces) {
      const m = p.mesh;
      m.updateMatrixWorld(true);
      const up = m.position.y;
      const v = V(r.range(3.2, 6.2) * (0.7 + 0.3 * (1 - up / PIER.loadingH)), r.range(0.4, 2.4), (m.position.z - d.z) * r.range(1.2, 2.6) + r.gauss() * 0.5);
      // (out over the river: its own flight, onto the water, where it lies
      // flat and drifts - the pieces' field stands a long board on its end)
      const wp = m.getWorldPosition(V(0, 0, 0)), wq = m.getWorldQuaternion(new THREE.Quaternion());
      if (m.parent) m.parent.remove(m);
      this.stage.scene.add(m); m.position.copy(wp); m.quaternion.copy(wq);
      this.flot.push({ m, v, w: V(r.gauss() * 4, r.gauss() * 3, r.gauss() * 4), state: 'fly', t: 0, ph: r.next() * 6.28 });
      this.boards.push(m);
    }
    const at = V(PIER.shed.x1, 1.2, d.z);
    this.splinters(at, dir, 22);
    this.sfx('b9burst', at, {}, { ref: 5 });
    this.hole = d;
  }
  // he goes into the river: the splash, then the rain coming in through
  // the hole (and its sound: the river and the rain, the room opened)
  splash(at) {
    const F = this.G.fx, r = this.rng;
    const p = V(at.x, PIER.waterY + 0.02, at.z);
    // the crown: a white column of spray thrown up round him and falling
    // back, a sheet of it, drops; then rings going out on the black water
    const spray = (n, up, out, size, delay = 0) => {
      if (!F || !F.splash) return;
      for (let k = 0; k < n; k++) {
        const a = r.next() * Math.PI * 2, s = r.range(out[0], out[1]);
        F.splash.spawn({ pos: p.clone().add(V(Math.cos(a) * 0.35, 0.05, Math.sin(a) * 0.35)), vel: V(Math.cos(a) * s, r.range(up[0], up[1]), Math.sin(a) * s), life: r.range(0.7, 1.4) + delay, size: [size * r.range(0.6, 1.2), size * r.range(1.6, 2.6)], stretch: 0.07, col: [0.9, 0.9, 0.9], alpha: 1, cell: ATLAS.DROP, gravity: 9.8, ground: PIER.waterY, fadeOut: 0.12 });
      }
    };
    spray(110, [3.0, 7.5], [0.4, 1.6], 0.05);
    spray(40, [1.5, 3.5], [1.5, 3.2], 0.09);
    this.tweens.push({ t: 0, dur: 0.35, step: () => {}, end: () => spray(40, [1.2, 3.2], [0.2, 1.0], 0.045) });
    for (let i = 0; i < 3; i++) this.ripple(p, 0.25 * i, 1.4 + i * 0.5, 2.2 + i * 1.3);
    this.sfx('b9splash', p, {}, { ref: 6 });
    this.G.emit('b9:splash', { at: p });
    this.rainIn();
  }
  // a ring going out on the water, white ink thinning as it widens
  ripple(p, delay, dur, R) {
    const S = this.stage;
    const mat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 48).rotateX(-Math.PI / 2), mat);
    m.position.set(p.x, PIER.waterY + 0.012, p.z);
    m.userData.noRay = true;
    m.visible = false;
    S.scene.add(m);
    this.boards.push(m);
    this.tweens.push({ t: -delay, dur, step: (u) => {
      if (u <= 0) return;
      m.visible = true;
      const e = 1 - Math.pow(1 - u, 2);
      m.scale.setScalar(0.3 + R * e);
      mat.opacity = 0.9 * (1 - u);
    }, end: () => { m.visible = false; } });
  }
  // rain coming in through the hole: streaks falling past the doorway and
  // blown in onto the planks
  rainIn() {
    const d = this.hole;
    if (!d || this.rain) return;
    this.rain = { d, acc: 0 };
    if (this.G.sfx && this.G.sfx.roomOpen) this.G.sfx.roomOpen(0.45);
  }
  stepRain(dt) {
    const R = this.rain, F = this.G.fx, r = this.rng;
    if (!R || !F || !F.splash) return;
    R.acc += dt * 70;
    while (R.acc >= 1) {
      R.acc -= 1;
      const x = PIER.shed.x1 + r.range(-0.6, 1.8), z = R.d.z + r.range(-1.1, 1.1);
      const inside = x < PIER.shed.x1;
      F.splash.spawn({ pos: V(x, inside ? r.range(1.6, 2.6) : r.range(2.4, 3.2), z), vel: V(-r.range(0.4, 1.4), -r.range(5, 7), r.gauss() * 0.2), life: 0.7, size: [0.008, 0.06], stretch: 0.06, col: [0.55, 0.55, 0.55], alpha: 0.7, cell: ATLAS.DROP, gravity: 4, ground: inside ? 0.0 : PIER.waterY, fadeOut: 0.1 });
    }
  }

  step(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const T = this.tweens[i];
      T.t += dt;
      const u = Math.min(1, T.t / T.dur);
      T.step(u);
      if (u >= 1) { this.tweens.splice(i, 1); if (T.end) T.end(); }
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      this.stepFire(f, dt);
      if (f.t > f.life) { f.lamp.on = false; this.fires.splice(i, 1); }
    }
    this.stepRain(dt);
    this.stepBoards(dt);
  }

  // the door's boards: flying out, glancing off the pier's edge, onto the
  // water (they lie flat on it, bob and drift slowly off); one that falls
  // inside lies on the planks
  stepBoards(dt) {
    const WY = PIER.waterY, edge = PIER.shed.x1 + 0.4;
    for (const b of this.flot) {
      const m = b.m;
      b.t += dt;
      if (b.state === 'fly') {
        b.v.y -= 9.8 * dt;
        m.position.addScaledVector(b.v, dt);
        if (b.w.lengthSq() > 1e-6) { _q.setFromAxisAngle(_a.copy(b.w).normalize(), b.w.length() * dt); m.quaternion.premultiply(_q); }
        const x = m.position.x;
        if (x > PIER.shed.x1 && x < edge && m.position.y < 0.06 && b.v.y < 0) { m.position.y = 0.06; b.v.y = Math.abs(b.v.y) * 0.25; b.v.x = Math.max(b.v.x, 1.2); this.sfx('b9plank', m.position.clone(), {}, { ref: 3 }); }
        else if (x < PIER.shed.x1 && m.position.y < 0.03) { b.state = 'rest'; m.position.y = 0.03; this.flatten(m, 1); }
        else if (x >= edge && m.position.y <= WY + 0.02) {
          b.state = 'float'; b.t = 0; m.position.y = WY + 0.02; b.v.multiplyScalar(0.2); b.v.y = 0; b.w.multiplyScalar(0.1);
          this.plop(m.position.clone());
        }
      } else if (b.state === 'float') {
        this.flatten(m, Math.min(1, dt * 3));
        b.v.x += (0.14 - b.v.x) * Math.min(1, dt * 0.4); b.v.z *= Math.exp(-dt * 0.6);
        m.position.x += b.v.x * dt; m.position.z += b.v.z * dt;
        m.position.y = WY + 0.012 + 0.012 * Math.sin(b.t * 1.6 + b.ph);
      }
    }
  }
  // a board laid flat: its thin axis (local x) turned upright, its length
  // kept where it points
  flatten(m, k) {
    const up = _a.set(1, 0, 0).applyQuaternion(m.quaternion);
    const tgt = _b.set(0, up.y >= 0 ? 1 : -1, 0);
    _q.setFromUnitVectors(up, tgt);
    m.quaternion.premultiply(new THREE.Quaternion().slerp(_q, k));
  }
  plop(p) {
    const F = this.G.fx, r = this.rng;
    if (F && F.splash) for (let k = 0; k < 14; k++) { const a = r.next() * 6.28, s = r.range(0.3, 1.1); F.splash.spawn({ pos: p.clone(), vel: V(Math.cos(a) * s, r.range(1.0, 2.6), Math.sin(a) * s), life: 0.6, size: [0.03, 0.06], stretch: 0.05, col: [0.8, 0.8, 0.8], alpha: 0.9, cell: ATLAS.DROP, gravity: 9.8, ground: PIER.waterY, fadeOut: 0.1 }); }
    this.sfx('b9plop', p, {}, { ref: 4 });
  }

  // the room as it was (a beat's setup)
  clear() {
    this.putOut();
    this.tweens = [];
    for (const m of this.boards) if (m.parent) m.parent.remove(m);
    this.boards = [];
    this.flot = [];
    this.rain = null;
    this.hole = null;
  }
}

function findMat(o) { let m = null; o.traverse((x) => { if (!m && x.isMesh) m = x.material; }); return m; }

// ---- the crew kept out of it: the fight is quiet (fists), the men at the
// far end of the shed go on with their rounds; a man who could see the bay
// is taken off where he cannot be seen go, the rest keep to the north
export function quietCrew(ctx, L) {
  const G = ctx.game, cam = G.camera;
  const crew = L.crew;
  G.controller.onFootfall = null;
  crew.onCaught = null;
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  for (const m of [...crew.men]) {
    m.perceive = () => 0;
    m.hear = () => {};
    const p = m.eye(V(0, 0, 0));
    const seen = frustum.containsPoint(p) && p.distanceTo(G.eye) < 22;
    if (!seen) { m.c.fig.object.visible = false; m.remove(); ctx.cast.remove(m.c); crew.men.splice(crew.men.indexOf(m), 1); }
    else { m.gone = true; }
  }
}
// (the men still in sight when the fight began: taken off once they are not)
export function crewOutOfSight(ctx, L) {
  const G = ctx.game, cam = G.camera, crew = L.crew;
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  for (const m of [...crew.men]) {
    const p = m.eye(V(0, 0, 0));
    if (frustum.containsPoint(p) && p.distanceTo(G.eye) < 22) continue;
    m.remove(); ctx.cast.remove(m.c); crew.men.splice(crew.men.indexOf(m), 1);
  }
}

export { buildProp };
