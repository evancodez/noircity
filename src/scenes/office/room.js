import * as THREE from 'three';
import { buildProp } from '../../props/index.js';
import { ROOM, DOOR, DESK, PAD, SAFE, PICTURE, WIN, CABS, COOLER, STAND, ESC, CORR } from '../../stages/office/plan.js';
import { live } from './hands.js';

// Room 304 as scenes 4 and 5 find it, and the small machinery both direct
// it with (lane B2). Shared by scenes/04_office.js and 05_gunfight.js (no
// default export: the scene manager passes this file over).
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const office = (ctx) => ctx.stage.part('office');

// what the detective carries by the start of each (WAVE_B.md §4): the
// red matchbook, the torn half, the note; from scene 5 the ledger too
export function carry(ctx, { ledger = false } = {}) {
  const inv = ctx.save.inventory || (ctx.save.inventory = []);
  for (const k of ['matchbook', 'matchbookHalf', 'note', ...(ledger ? ['ledger'] : [])]) if (!inv.includes(k)) inv.push(k);
}

// the room as it stands at a point of the story:
//   'found'   scene 4: turned over, the door ajar, the pad whole, the safe shut
//   'rubbed'  the sheet torn off the pad (in my left hand)
//   'open'    the picture aside, the safe open, the ledger in it
//   'taken'   the ledger gone into my coat (scene 5's start)
export function roomAs(ctx, phase = 'found') {
  const O = office(ctx), G = ctx.game;
  ctx.cast.clear();
  for (const h of [...G.world.hoods.list]) G.removeHood(h);
  G.corpses.length = 0;
  G.pending.length = 0;
  G.fx.clear();
  O.reset();
  const P = ['found', 'rubbed', 'open', 'taken'];
  const at = P.indexOf(phase);
  if (at >= 1) O.pad.api.reset();
  if (at >= 2) {
    O.picture.angle = O.picture.target = 1.05; O.picture.hang.rotation.z = 1.05;
    O.safe.open = 1; O.safe.hinge.rotation.y = -1.9;
  }
  // the ledger in the safe (until it is taken)
  if (O.ledger && O.ledger.parent) O.ledger.parent.remove(O.ledger);
  if (at <= 2) {
    const L = O.ledger || (O.ledger = buildProp('ledger'));
    L.position.set(SAFE.x, SAFE.y - SAFE.h / 2 + 0.02, -SAFE.depth / 2 - 0.01);
    L.rotation.set(0, Math.PI / 2, 0);
    L.userData.setOpen(0);
    ctx.stage.scene.add(L);
  }
  // the pencil on the blotter
  if (O.pencil && O.pencil.parent) O.pencil.parent.remove(O.pencil);
  const pc = O.pencil || (O.pencil = buildProp('pencil'));
  pc.position.copy(O.pencilAt);
  pc.rotation.set(0, 2.6, 0);
  O.desk.body.attach(pc);
  // the hands: nothing in them yet
  const H = ctx.hands;
  live(H, {});
  H.hold(null, 'R', { keep: true }); H.hold(null, 'L', { keep: true });
  H.equip('empty');
  ctx.player.weapons.current = null;
  // the sheet in the left hand, from 'rubbed' until scene 4 ends
  return O;
}

// the torn sheet: a copy of the pad's drawing as it was when it came off
export function sheetOf(O) {
  const s = buildProp('padSheet');
  const c = document.createElement('canvas');
  c.width = O.pad.api.canvas.width; c.height = O.pad.api.canvas.height;
  c.getContext('2d').drawImage(O.pad.api.canvas, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  s.userData.setPaper(t);
  s.userData.canvas = c;
  return s;
}

// the player standing at a place of the room (walk mode, or the office's own)
export function stand(ctx, x, z, yaw, pitch = 0, mode = 'walk') {
  const C = ctx.controller;
  C.setPose(x, z, yaw, pitch);
  if (mode !== 'walk') C.setMode(mode, {});
}

// the room's things that answer E with a line or none (the room is a room)
export function roomLines(ctx) {
  const O = office(ctx), G = ctx.game, I = ctx.interact;
  const said = ctx.flags.said || (ctx.flags.said = {});
  const once = (k, text, secs = 2.4) => { if (said[k]) return; said[k] = true; G.hud.say(text, secs); };
  // the filing cabinets: somebody was here first (a drawer run in and out)
  O.cabinets.forEach((c, i) => {
    I.add({ id: 'cab' + i, at: V(c.x, 1.0, c.z - 0.5), range: 1.9, cone: 0.6, prompt: 'the drawers', onUse: () => {
      const d = c.drawers.find((q) => q.out > 0.1) || c.drawers[0];
      d.group.position.z -= 0.08;
      G.sfx.play('office_drawer', V(c.x, d.y + 0.2, c.z - 0.5));
      G.sfx.play('office_paperRustle', V(c.x, d.y + 0.3, c.z - 0.6), { k: 0.8 });
      once('drawers', 'Somebody was here first.');
      I.remove('cab' + i);
    } });
  });
  // the coat on the stand: his; the pockets turned out
  I.add({ id: 'coat', at: V(STAND.x + 0.1, 1.3, STAND.z), range: 1.8, cone: 0.55, prompt: 'the coat', onUse: () => {
    G.sfx.play('office_paperRustle', V(STAND.x, 1.3, STAND.z), { k: 0.6 });
    once('coat', 'Pockets inside out. They were thorough.');
    I.remove('coat');
  } });
  // the water cooler: a paper cup, a glug (no line)
  I.add({ id: 'cooler', at: V(COOLER.x, 1.0, COOLER.z), range: 1.6, cone: 0.5, prompt: 'a drink', onUse: () => { G.sfx.play('office_coolerGlug', V(COOLER.x, 1.0, COOLER.z)); } });
  void ROOM; void DOOR; void DESK; void PAD; void PICTURE; void WIN; void CABS; void ESC; void CORR;
}
