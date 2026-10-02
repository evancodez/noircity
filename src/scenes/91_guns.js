import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { gunsOf } from '../guns/Guns.js';
import { objective, teach, warn } from '../guns/kitStub.js';
import { DESK, HOUSE } from '../stages/killhouse/plan.js';

// The gun kit's test bed (lane C2): NOT a scene of the story (not in
// src/scenes/order.js); ?start=guns plays it, ?start=guns.<beat> one beat,
// ?scene=guns&beat=<beat> frames it. The killhouse stage. Each beat is a
// contest of its own, with its own checkpoint (a fall puts me back at its
// start, the room as it was), and on to the next when its last man is down:
//   ready      the teach: the desk over (E), get low (C), rise and aim (RMB),
//              the bottles on the cabinet, reload (R)
//   door       two men through one door: the exposure of a doorway
//   two_ways   three men from two doors: the flank
//   pin        the bar: a Tommy gunner and a pistol man (wait out the burst)
//   rush       the lobby: the heavy, in at the street door
//   street     four men and two cars, with the Tommy gun
//   street_rev the same street with the revolver
//   done       the end of the run (E: again from the door beat)
// The plays (tools/plays/guns_*.json) read G.guns and ctx.flags.c2.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EAST = -Math.PI / 2, SOUTH = Math.PI;
// where I start each beat, the gun, what the men are; `spots`: the cover the
// good player's bot uses (behind it, facing the room)
export const BEATS = {
  ready: { at: [DESK.x - 0.95, DESK.z, EAST], gun: 'revolver', obj: 'Tip the desk over. Get behind it.' },
  door: {
    at: [DESK.x + 0.02, DESK.z + 0.1, EAST], gun: 'revolver', tipped: true, crouch: false, max: 2, flankAfter: 9,
    obj: 'They are coming. Hold the room.',
    men: [
      { kind: 'pistol', at: { x: -0.4, z: -9.5 }, way: [{ door: 'BD' }, { x: -0.45, z: -6.2, run: true }, { door: 'A1' }], wait: 0.8, door: 'hold' },
      { kind: 'pistol', at: { x: -0.4, z: -9.7 }, way: [{ door: 'BD' }, { x: -0.5, z: -5.6, run: true }, { door: 'A1' }], wait: 1.2, door: 'hold' },
    ],
    spots: [{ x: DESK.x + 0.02, z: DESK.z + 0.1, yaw: EAST }, { x: DESK.x + 0.02, z: DESK.z - 0.55, yaw: EAST }, { x: -7.25, z: -2.35, yaw: EAST + 0.4 }],
  },
  two_ways: {
    at: [DESK.x + 0.02, DESK.z + 0.1, EAST], gun: 'revolver', tipped: true, crouch: false, max: 2, flankAfter: 7,
    obj: 'Three of them. Watch both doors.',
    men: [
      { kind: 'pistol', at: { x: -0.4, z: -9.5 }, way: [{ door: 'BD' }, { x: -0.45, z: -6.2, run: true }, { door: 'A1' }], wait: 0.8, door: 'hold' },
      { kind: 'pistol', at: { x: -0.4, z: -9.7 }, way: [{ door: 'BD' }, { x: -0.5, z: -5.5, run: true }, { door: 'A1' }], wait: 1.2, door: 'hold' },
      { kind: 'pistol', at: { x: -0.5, z: 9.5 }, way: [{ door: 'SD' }, { x: -4.6, z: 4.6, run: true }, { door: 'A2' }], wait: 3.0 },
    ],
    spots: [{ x: DESK.x + 0.02, z: DESK.z + 0.1, yaw: EAST }, { x: -7.25, z: -2.35, yaw: EAST + 0.6 }, { x: -6.0, z: -6.6, yaw: EAST + 0.8 }],
  },
  pin: {
    at: [4.6, -5.55, SOUTH], gun: 'revolver', crouch: false, max: 2, flankAfter: 8,
    obj: 'A Tommy gun. Stay down while it fires.',
    men: [
      { kind: 'tommy', at: { x: 4.7, z: 4.6 }, way: [{ x: 4.7, z: 2.6 }, { door: 'B2' }], wait: 1.0, door: 'hold' },
      { kind: 'pistol', at: { x: -0.4, z: -9.5 }, way: [{ door: 'BD' }, { x: -0.45, z: -2.2, run: true }, { door: 'B1' }], wait: 3.0 },
    ],
    spots: [{ x: 4.6, z: -5.55, yaw: SOUTH }, { x: 6.6, z: -5.55, yaw: SOUTH }, { x: 2.9, z: -5.6, yaw: SOUTH + 0.3 }],
  },
  rush: {
    at: [-3.5, 2.4, SOUTH], gun: 'revolver', crouch: false, max: 2, flankAfter: 0,
    obj: 'Something big at the street door.',
    men: [
      { kind: 'rusher', at: { x: -0.5, z: 10.5 }, way: [{ x: -0.5, z: 7.6 }, { door: 'SD' }], wait: 1.5 },
      { kind: 'pistol', at: { x: -7.4, z: -6.8 }, way: [{ door: 'A2' }], wait: 7.0, door: 'hold' },
    ],
    spots: [{ x: -3.5, z: 2.4, yaw: SOUTH }],
  },
  // (the brief's street: four men and the cars - I start down behind the
  // near car, they come out of the warehouse's openings across the way;
  // the street door is locked behind me: the fight is out here)
  street: {
    at: [-5.0, 7.85, SOUTH], gun: 'tommy', crouch: true, max: 2, flankAfter: 9, lock: ['SD'],
    obj: 'Four of them across the street. Cover to cover.',
    // (three there already, down behind the far cars; the fourth out of the loading door later)
    men: [
      { kind: 'pistol', at: { x: 5.3, z: 16.4 }, cover: true, wait: 1.6 },
      { kind: 'tommy', at: { x: -12.9, z: 13.5 }, cover: true, wait: 2.4 },
      { kind: 'pistol', at: { x: -15.1, z: 13.4 }, cover: true, wait: 3.2 },
      { kind: 'pistol', at: { x: 3.4, z: 20.2 }, way: [{ x: 0.2, z: 19.6 }, { x: 0.2, z: 17.5, run: true }], wait: 7.0 },
    ],
    spots: [{ x: -5.0, z: 7.85, yaw: SOUTH }, { x: -8.75, z: 9.3, yaw: EAST }, { x: -2.45, z: 9.3, yaw: -EAST }, { x: 9.6, z: 6.7, yaw: SOUTH }, { x: 14.2, z: 7.85, yaw: SOUTH }],
    open: { x: -0.6, z: 7.7 },
  },
};
BEATS.street_rev = { ...BEATS.street, gun: 'revolver', obj: 'Again, with the revolver.' };
const CONTESTS = ['door', 'two_ways', 'pin', 'rush', 'street', 'street_rev'];
const NEXT = { ready: 'door', door: 'two_ways', two_ways: 'pin', pin: 'rush', rush: 'street', street: 'street_rev', street_rev: 'done', done: 'door' };

// the lab (?scene=guns&beat=lab&lab=<case>): one man where a fall has
// something beside him - a wall at his back, the low cover he rose over, a
// doorway, open floor - and a round into him at 0.5 s from where I stand
// (the deaths' strips, the entries' frames); the cases:
export const LAB = {
  wall: { man: [-5.9, 0.62, Math.PI], me: [-5.9, -2.2, 0] },
  over: { man: [-3.5, 2.6, 0], me: [-3.5, 5.4, 0], state: 'aim' },
  door: { man: [-1.2, -4.1, -Math.PI / 2], me: [-4.2, -3.6, -Math.PI / 2], open: 'A1' },
  open: { man: [5.2, -2.6, 0], me: [5.2, 0.4, 0] },
  kneel: { man: [-3.5, 2.5, 0], me: [-3.5, 5.6, 0], state: 'kneel', alive: true },
};
function lab(ctx) {
  const G = ctx.game, q = new URLSearchParams(location.search), L = LAB[q.get('lab') || 'wall'] || LAB.wall;
  room(ctx, 'ready');
  for (const h of [...G.world.hoods.list]) G.removeHood(h);
  const K = gunsOf(G);
  const [mx, mz, my] = L.man, [ex, ez] = L.me;
  ctx.controller.setPose(ex, ez, Math.atan2(-(mx - ex), -(mz - ez)), -0.12);
  const h = K.spawn({ kind: 'pistol', at: { x: mx, z: mz }, yaw: my, start: () => false, wait: 1e9 });
  // (a figure for the frames: his brain held still - no cover taken, no shot)
  { const ai = G.ais.get(h); if (ai && ai.brain && ai.brain.S) ai.brain.S.state = 'watch'; }
  if (L.open) ctx.stage.part('house').doors[L.open].set(-1.62);
  if (L.state) h.setState(L.state, 0);
  h.lookAt(G.eye.clone());
  if (L.alive) return;
  let done = false;
  G.scripts.push(() => {
    if (done || G.time - ctx.flags.c2.t0 < 0.5) return;
    done = true;
    const c = h.bones.chest.getWorldPosition(V(0, 0, 0));
    const d = c.clone().sub(G.eye).normalize();
    G.fx.bloodFx.hit(c, d, { strength: 1.1, rays: G.rays });
    G.killHood(h, d, false, q.get('kind') || null);
    ctx.flags.c2.lab = { kind: h.state, at: [h.pos.x, h.pos.z] };
  });
}

// the room for a beat: everything mended, the men gone, me where I start
function room(ctx, name) {
  const G = ctx.game, B = BEATS[name] || BEATS.ready;
  const house = ctx.stage.part('house');
  for (const h of [...G.world.hoods.list]) G.removeHood(h);
  G.corpses.length = 0; G.pending.length = 0;
  G.fx.clear();
  house.reset();
  for (const n of B.lock || []) house.doors[n].locked = true;
  G.health.reset();
  const C = ctx.controller;
  // (the desk over first: the mode's first step pushes me out of whatever stands where I am)
  if (B.tipped) house.desk.tipOver(1, true);
  C.setPose(B.at[0], B.at[1], B.at[2], -0.05);
  // (?c2pose=stand: the beat from standing - the review frames' look over the cover)
  C.setMode('gun', { crouch: !!B.crouch && new URLSearchParams(location.search).get('c2pose') !== 'stand' });
  ctx.player.weapons.equip(B.gun || 'revolver');
  if (B.gun === 'tommy') G.weapon.reset();
  const K = gunsOf(G);
  K.end();
  K.begin({ maxFiring: B.max ?? 2, flankAfter: B.flankAfter ?? 7, to: name });
  ctx.flags.c2 = { beat: name, men: [], won: false, t0: G.time, spots: B.spots || [], open: B.open || null };
  for (const m of B.men || []) {
    const h = K.spawn({ kind: m.kind, at: m.at, way: m.way ? { steps: m.way } : null, wait: m.wait ?? 0, hp: m.hp, door: m.door, cover: !!m.cover, yaw: m.yaw ?? null });
    ctx.flags.c2.men.push(h);
  }
}

export default defineScene({
  id: 'guns', stage: 'killhouse', title: '', name: 'The Killhouse',
  beats: ['ready', 'door', 'two_ways', 'pin', 'rush', 'street', 'street_rev', 'done', 'lab'],
  save: [],
  setup: { ...Object.fromEntries(['ready', 'door', 'two_ways', 'pin', 'rush', 'street', 'street_rev', 'done'].map((b) => [b, (ctx) => room(ctx, b === 'done' ? 'ready' : b)])), lab: (ctx) => lab(ctx) },

  *script(ctx) {
    const G = ctx.game, K = gunsOf(G), house = ctx.stage.part('house'), C = ctx.controller;
    const F = ctx.flags;
    const alive = () => (F.c2 ? F.c2.men.filter((h) => h.alive).length : 0);
    // (a director's encounter while the scene lasts: the HUD shows the health in it)
    G.director.stop(); G.director.begin();
    G.director.run(function* () { while (G.scenes.ctx === ctx) yield null; });
    const exitFn = () => { K.end(); G.off('scene:exit', exitFn); for (const n of ['c2objective', 'c2teach', 'c2warn']) G.hud.dropLayer(n); };
    G.on('scene:exit', exitFn);
    // the doors: E opens and shuts them (a locked one rattles)
    const doorH = Object.entries(house.doors).map(([name, d]) => ({ d, h: ctx.interact.add({ id: 'door' + name, at: d.centre.clone().setY(1.1), range: 1.5, cone: 0.7, prompt: 'open', onUse: () => { if (d.shut) d.open(G.eye); else d.close(); } }) }));
    ctx.onStep(() => { for (const { d, h } of doorH) h.prompt = d.shut ? 'open' : 'shut'; });
    // the warning before a fall: hurt with a man on me; the heavy close
    ctx.onStep(() => {
      if (!K.active || G.health.dead) return;
      const heavy = (F.c2 ? F.c2.men : []).find((h) => h.alive && h.gunKind === 'rusher' && Math.hypot(h.pos.x - G.eye.x, h.pos.z - G.eye.z) < 4.2);
      const through = K.lastKill && G.time - K.lastKill.t < 1.2 && K.lastKill.through && (C.crouchK || 0) > 0.5;
      if (heavy) warn(G, 'Stop him!');
      else if (through) warn(G, 'Your cover won\'t hold. Move!');
      else if (G.health.hp < 45 && K.lineOnMe > 0) warn(G, (C.crouchK || 0) > 0.6 ? 'They have your angle. Move!' : 'Get down!');
      else if (G.health.hp < 45) warn(G, null);
      else warn(G, null);
    });

    // ---- ready: the teach -----------------------------------------------------------------------
    if (ctx.at('ready') && ctx.beat === 'ready') {
      yield beat('ready');
      objective(G, BEATS.ready.obj);
      const desk = house.desk;
      ctx.interact.add({ id: 'tip', at: V(DESK.x, DESK.h + 0.25, DESK.z), range: 2.1, cone: 0.85, prompt: 'tip the desk over', when: () => !desk.tip, onUse: () => {
        const dir = Math.sign(DESK.x - G.eye.x) || 1;
        if (desk.tipOver(dir)) ctx.interact.remove('tip');
      } });
      yield until(() => !!desk.tip && desk.tip.done);
      teach(G, 'low', 'get low', { key: 'KeyC', until: () => (C.crouchK || 0) > 0.6 });
      yield until(() => (C.crouchK || 0) > 0.6);
      objective(G, 'Rise over it. Shoot the bottles.');
      yield wait(0.4);
      teach(G, 'rise', 'rise and aim', { key: 'Mouse2', until: () => (C.riseK || 0) > 0.7 });
      yield until(() => house.teachBottles.filter((b) => b.h.broken).length >= 2 || G.time - F.c2.t0 > 60);
      teach(G, 'reload', 'reload, down behind it', { key: 'KeyR', until: () => !!(ctx.player.weapons.active && ctx.player.weapons.active.reloading) });
      objective(G, 'Reload behind the desk.');
      yield until(() => !!(ctx.player.weapons.active && ctx.player.weapons.active.reloading) || G.time - F.c2.t0 > 75);
      yield until(() => !(ctx.player.weapons.active && ctx.player.weapons.active.reloading));
      yield wait(0.8);
      G.scenes.go('guns', { beat: 'door', fade: 'black', card: false });
      return;
    }
    // ---- a contest --------------------------------------------------------------------------------
    const name = ctx.beat;
    if (name === 'done') {
      yield beat('done');
      objective(G, 'Every beat won. E: again.');
      yield* ctx.prompt({ text: 'again', key: 'KeyE' });
      G.scenes.go('guns', { beat: 'door', fade: 'black', card: false });
      return;
    }
    if (!CONTESTS.includes(name)) return;
    yield beat(name);
    objective(G, BEATS[name].obj);
    yield until(() => alive() === 0);
    F.c2.won = true;
    (G._c2won || (G._c2won = [])).push(name);
    objective(G, null);
    warn(G, null);
    yield wait(1.8);
    G.scenes.go('guns', { beat: NEXT[name], fade: 'black', card: false });
  },
});
void HOUSE;
