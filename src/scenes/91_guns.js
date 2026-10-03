import * as THREE from 'three';
import { defineScene, wait, until, beat } from '../game/script.js';
import { gunsOf } from '../guns/Guns.js';
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
    // ([C2] after the critic's second look: down behind the desk, as the ready beat left me - it reset the crouch at the cut)
    at: [DESK.x + 0.02, DESK.z + 0.1, EAST], gun: 'revolver', tipped: true, crouch: true, max: 2, flankAfter: 9,
    obj: 'They are coming. Hold the room.',
    // [C2] after the critic: three through the one door - two who work it
    // together from its jambs, and a third some seconds behind them (two were
    // a fair duel for a man standing up and shooting fast: he won it)
    area: { x0: HOUSE.x0, x1: HOUSE.x1, z0: HOUSE.z0, z1: HOUSE.z1 - 0.2 },
    men: [
      // ([C2] after the critic's second look - won standing on the room's floor 9 sessions of 10, each man shot as he
      // stepped into the lit doorway with his gun down: the two stack on A1 and come in as a pair, guns up; the third
      // 5 s behind them, was 8)
      { kind: 'pistol', at: { x: -0.4, z: -9.5 }, way: [{ door: 'BD' }, { x: -0.45, z: -6.2, run: true }, { door: 'A1' }], wait: 0.8, door: 'hold' },
      { kind: 'pistol', at: { x: -0.4, z: -9.7 }, way: [{ door: 'BD' }, { x: -0.5, z: -5.6, run: true }, { door: 'A1' }], wait: 1.2, door: 'hold' },
      { kind: 'pistol', at: { x: -0.2, z: -9.9 }, way: [{ door: 'BD' }, { x: -0.4, z: -6.0, run: true }, { door: 'A1' }], wait: 5.0, door: 'hold' },
    ],
    spots: [{ x: DESK.x + 0.02, z: DESK.z + 0.1, yaw: EAST }, { x: DESK.x + 0.02, z: DESK.z - 0.55, yaw: EAST }, { x: -7.25, z: -2.35, yaw: EAST + 0.4 }],
    open: { x: -3.6, z: -2.4 },
  },
  two_ways: {
    // ([C2] after the critic: flankAfter 7 -> 9 - with the men's way of fighting sharpened, the first-timer
    // was flanked behind the desk three tries running)
    at: [DESK.x + 0.02, DESK.z + 0.1, EAST], gun: 'revolver', tipped: true, crouch: true, max: 2, flankAfter: 9,
    obj: 'Three of them. Watch both doors.',
    // ([C2] after the critic's second look: the third man's door, opening at my back, is said as it opens)
    warn: { door: 'The other door! Behind you!' },
    area: { x0: HOUSE.x0, x1: HOUSE.x1, z0: HOUSE.z0, z1: HOUSE.z1 - 0.2 },
    men: [
      { kind: 'pistol', at: { x: -0.4, z: -9.5 }, way: [{ door: 'BD' }, { x: -0.45, z: -6.2, run: true }, { door: 'A1' }], wait: 0.8, door: 'hold' },
      { kind: 'pistol', at: { x: -0.4, z: -9.7 }, way: [{ door: 'BD' }, { x: -0.5, z: -5.5, run: true }, { door: 'A1' }], wait: 1.2, door: 'hold' },
      // ([C2] after the critic's second look - the first-timer lost it 15 tries of 15: the third came in at my back at
      // ~10 s, straight into its frame, while the two at A1 worked their jambs - now he comes a little later, works
      // A2 from its jamb as the others work A1, and his door is said as it opens)
      { kind: 'pistol', at: { x: -0.5, z: 9.5 }, way: [{ door: 'SD' }, { x: -4.6, z: 4.6, run: true }, { door: 'A2' }], wait: 5.0, door: 'hold' },
    ],
    spots: [{ x: DESK.x + 0.02, z: DESK.z + 0.1, yaw: EAST }, { x: -7.25, z: -2.35, yaw: EAST + 0.6 }, { x: -6.0, z: -6.6, yaw: EAST + 0.8 }],
    open: { x: -3.6, z: -2.4 },
  },
  pin: {
    at: [4.6, -5.55, SOUTH], gun: 'revolver', crouch: false, max: 2, flankAfter: 8,
    obj: 'Down through the burst. Up when he reloads.',
    area: { x0: HOUSE.x0, x1: HOUSE.x1, z0: HOUSE.z0, z1: HOUSE.z1 - 0.2 },
    men: [
      // ([C2] after the critic: the first thing met is the burst - the Tommy
      // gunner at the glazed door, raking where I stand; then two pistol men
      // working B1 from the corridor's side of it while he changes his drum:
      // guns from two ways on a man standing up)
      { kind: 'pistol', at: { x: -0.4, z: -9.5 }, way: [{ door: 'BD' }, { x: -0.45, z: -2.2, run: true }, { door: 'B1' }], wait: 0.4, door: 'hold' },
      { kind: 'pistol', at: { x: -0.4, z: -9.8 }, way: [{ door: 'BD' }, { x: -0.5, z: -3.0, run: true }, { door: 'B1' }], wait: 1.0, door: 'hold' },
      // (he waits out of the bar's sight - the lobby's west end, behind the corridor's wall - and comes along the glass)
      { kind: 'tommy', at: { x: -2.2, z: 4.4 }, way: [{ x: 2.6, z: 3.0 }, { door: 'B2' }], wait: 0.3, door: 'hold' },
    ],
    spots: [{ x: 4.6, z: -5.55, yaw: SOUTH }, { x: 6.6, z: -5.55, yaw: SOUTH }, { x: 2.9, z: -5.6, yaw: SOUTH + 0.3 }],
    open: { x: 1.6, z: -5.45 },
  },
  rush: {
    at: [-3.5, 2.4, SOUTH], gun: 'revolver', crouch: false, max: 2, flankAfter: 0,
    obj: 'Something big at the street door.', afterHeavy: 'One more. Find him.',
    // (the fight is in the house: no cover out on the pavement)
    area: { x0: HOUSE.x0, x1: HOUSE.x1, z0: HOUSE.z0, z1: HOUSE.z1 - 0.2 },
    men: [
      { kind: 'rusher', at: { x: -0.5, z: 10.5 }, way: [{ x: -0.5, z: 7.6 }, { door: 'SD' }], wait: 1.5 },
      // ([C2] after the critic: wait 7 -> 14 - his rounds now reach me past A2's jamb, and with the heavy still
      // up the first-timer lost the rush to him three tries running; he is the 'One more. Find him.')
      { kind: 'pistol', at: { x: -7.4, z: -6.8 }, way: [{ door: 'A2' }], wait: 14.0, door: 'hold' },
    ],
    spots: [{ x: -3.5, z: 2.4, yaw: SOUTH }],
    open: { x: -5.3, z: 3.0 },
  },
  // (the brief's street: four men and the cars - I start down behind the
  // near car, they come out of the warehouse's openings across the way;
  // the street door is locked behind me: the fight is out here)
  street: {
    at: [-5.0, 7.85, SOUTH], gun: 'tommy', crouch: true, max: 2, flankAfter: 11, lock: ['SD'],
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
// ([C2] after the critic: the street with six rounds against four - their aim a tenth slower to settle, the
// difficulty table's settleK; good hands lost it to flanks while reloading)
BEATS.street_rev = { ...BEATS.street, gun: 'revolver', obj: 'Again, with the revolver.', settleK: 1.1 };
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

// a door's use point (Interact `at`): where the view's line meets the
// doorway's plane, kept inside the doorway (its width, knee to head height) -
// up against a door, at its knob or its panel, the point is where I look
function doorPoint(G, d) {
  const s = d.spec, along = s.axis === 'z';
  const s0 = (along ? s.z0 : s.x0) + 0.08, s1 = (along ? s.z1 : s.x1) - 0.08;
  const y0 = d.centre.y + 0.3, y1 = d.centre.y + 2.0;
  const out = V(0, 0, 0), f = V(0, 0, 0);
  return () => {
    const cam = G.camera, o = cam.position;
    f.set(0, 0, -1).transformDirection(cam.matrixWorld);
    // (the plane: x = s.x for a door along z, z = s.z for one along x)
    const n = along ? f.x : f.z, w = along ? s.x - o.x : s.z - o.z;
    let k = Math.abs(n) > 1e-4 ? w / n : -1;
    if (!(k > 0)) k = Math.abs(w);
    const px = o.x + f.x * k, py = o.y + f.y * k, pz = o.z + f.z * k;
    const u = Math.min(s1, Math.max(s0, along ? pz : px));
    if (along) out.set(s.x, Math.min(y1, Math.max(y0, py)), u);
    else out.set(u, Math.min(y1, Math.max(y0, py)), s.z);
    return out;
  };
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
  // [C2] after the critic: the eye where the beat puts me now, not where the
  // last beat left it (the street's men read their cover against it as they
  // are placed: against the lobby's eye they stood up in their first frames,
  // in my line - the false "They have your angle")
  G.eye.copy(G.camera.position);
  // [C2] after the critic's second look: the gun as it was at the checkpoint
  // - full - on every retry (the revolver came back with what was left in it)
  const K = gunsOf(G);
  K.arm(B.gun || 'revolver');
  K.end();
  K.begin({ maxFiring: B.max ?? 2, flankAfter: B.flankAfter ?? 7, to: name, area: B.area || null, settleK: B.settleK || 1, dmgK: B.dmgK || 1, warn: B.warn || null });
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
  // (each beat's line, set as it begins, a retry included; the ready beat's
  // later lines are its script's)
  objectives: { ...Object.fromEntries(Object.entries(BEATS).map(([k, b]) => [k, b.obj])), done: 'Every beat won. E: again.', lab: null },
  // (going down in a contest is the kit's fall - its words, K.why() - and
  // the warning before it is the kit's, K.warning(), set every step below)
  setup: { ...Object.fromEntries(['ready', 'door', 'two_ways', 'pin', 'rush', 'street', 'street_rev', 'done'].map((b) => [b, (ctx) => room(ctx, b === 'done' ? 'ready' : b)])), lab: (ctx) => lab(ctx) },

  *script(ctx) {
    const G = ctx.game, K = gunsOf(G), house = ctx.stage.part('house'), C = ctx.controller;
    const F = ctx.flags;
    const alive = () => (F.c2 ? F.c2.men.filter((h) => h.alive).length : 0);
    // (a director's encounter while the scene lasts: the HUD shows the health in it)
    G.director.stop(); G.director.begin();
    G.director.run(function* () { while (G.scenes.ctx === ctx) yield null; });
    const exitFn = () => { K.end(); G.off('scene:exit', exitFn); ctx.hud.warn(null); };
    G.on('scene:exit', exitFn);
    // the doors: E opens and shuts them (a locked one rattles). [C2] after the
    // critic: the use point is where on the doorway I am looking (up against
    // it, at its knob, at its panel: the prompt is there); a door stopped ajar
    // (against a man) is opened on, not shut
    const ajar = (d) => !d.shut && !d.moving && d.target !== 0 && d.open01 < 0.85;
    const doorH = Object.entries(house.doors).map(([name, d]) => ({ d, h: ctx.interact.add({ id: 'door' + name, at: doorPoint(G, d), range: 1.7, cone: 0.6, prompt: 'open', onUse: () => { if (d.locked) d.tried = true; if (d.shut || ajar(d)) d.open(G.eye); else d.close(); } }) }));
    // ([C2] after the critic's second look: a locked door, once tried, says so)
    ctx.onStep(() => { for (const { d, h } of doorH) h.prompt = d.locked && d.tried ? 'locked' : d.shut || ajar(d) ? 'open' : 'shut'; });
    // the warning before a fall: the kit's, for the moment (the heavy close,
    // my cover shot through, hurt with a man on me, hurt and safe) - none once
    // the room is won
    let won = false;
    ctx.onStep(() => ctx.hud.warn(K.active && !won ? K.warning() : null));

    // ---- ready: the teach -----------------------------------------------------------------------
    if (ctx.at('ready') && ctx.beat === 'ready') {
      yield beat('ready');
      const hud = ctx.hud, desk = house.desk;
      // [C2] after the critic: it goes over toward the door (A1), its top a
      // wall between me and where they come from, from whichever side I push
      // it - but never onto me: from the door's side, a step back first (the
      // prompt shows only out of where it lands)
      const landing = () => G.eye.x > DESK.x + 0.2 && G.eye.x < DESK.x + DESK.d / 2 + DESK.h + 0.55 && Math.abs(G.eye.z - DESK.z) < DESK.w / 2 + 0.45;
      ctx.interact.add({ id: 'tip', at: V(DESK.x, DESK.h + 0.25, DESK.z), range: 2.1, cone: 0.85, prompt: 'tip the desk over', when: () => !desk.tip && !landing(), onUse: () => {
        if (desk.tipOver(1)) ctx.interact.remove('tip');
      } });
      yield until(() => !!desk.tip && desk.tip.done);
      // (behind it: on the side away from the door, near enough that it hides
      // me - where the tip leaves me, 1.4 m back, counts: the rise looks 2.4 m
      // ahead, so RMB from there clears its top)
      const behind = () => { const b = desk.back(), ax = (G.eye.x - b.x) * desk.dir; return Math.abs(G.eye.z - b.z) < 1.1 && ax < 0.15 && ax > -1.7; };
      K.teach('crouch');
      // (down but not behind it: the line says where)
      let said = false;
      yield until(() => {
        const low = (C.crouchK || 0) > 0.6;
        if (low && !behind() && !said) { said = true; hud.objective('Behind the desk. Get close to it.'); }
        return low && behind();
      });
      hud.objective('Rise over it. Shoot the bottles.');
      yield wait(0.4);
      K.teach('rise');
      yield until(() => house.teachBottles.filter((b) => b.h.broken).length >= 2 || G.time - F.c2.t0 > 60);
      hud.objective('Reload behind the desk.');
      K.teach('reload');
      yield until(() => !!(ctx.player.weapons.active && ctx.player.weapons.active.reloading) || G.time - F.c2.t0 > 75);
      yield until(() => !(ctx.player.weapons.active && ctx.player.weapons.active.reloading));
      yield wait(0.8);
      // ([C2] after the critic's second look: the ready's last line goes as the picture does - it showed dimmed over the door's fade-in)
      ctx.hud.objective(null);
      G.scenes.go('guns', { beat: 'door', fade: 'black', card: false });
      return;
    }
    // ---- a contest --------------------------------------------------------------------------------
    const name = ctx.beat;
    if (name === 'done') {
      yield beat('done');
      yield* ctx.prompt({ text: 'again', key: 'KeyE' });
      G.scenes.go('guns', { beat: 'door', fade: 'black', card: false });
      return;
    }
    if (!CONTESTS.includes(name)) return;
    yield beat(name);
    // (failed it twice: the card that answers it, once more - the crouch;
    // fails() is 2 for the one try after the second fall)
    if (G.fails(name) === 2) K.teach('crouch', { again: true });
    // (a beat played cold - ?start=guns.<beat> - teaches what it needs too:
    // the cards come once per save, so after the ready beat these are nothing)
    else K.teach('crouch');
    let rose = false, n0 = alive(), heavy = false;
    const Bt = BEATS[name];
    yield until(() => {
      if (!rose && (C.crouchK || 0) > 0.6) { rose = true; K.teach('rise'); }
      // [C2] after the critic: the line follows the fight - the heavy down,
      // the last man left (it named the heavy for a minute after he fell)
      const n = alive();
      if (n < n0 && n > 0) {
        const hv = F.c2.men.some((h) => !h.alive && h.gunKind === 'rusher');
        if (hv && !heavy) { heavy = true; ctx.hud.objective(Bt.afterHeavy || (n === 1 ? 'The big one is down. One more.' : 'The big one is down.')); }
        else if (n === 1) ctx.hud.objective(Bt.last || 'One left.');
      }
      n0 = n;
      return n === 0;
    });
    F.c2.won = true;
    won = true; ctx.hud.warn(null);
    (G._c2won || (G._c2won = [])).push(name);
    ctx.hud.objective('Clear.');
    yield wait(1.8);
    // ('Clear.' goes as the picture does: the next beat writes its own line in)
    ctx.hud.objective(null);
    G.scenes.go('guns', { beat: NEXT[name], fade: 'black', card: false });
  },
});
