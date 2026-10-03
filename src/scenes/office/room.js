import * as THREE from 'three';
import { buildProp } from '../../props/index.js';
import { DESK, SAFE, CHAIR, PICTURE_ASIDE, DOORS, OUTER, ROOM, CORR } from '../../stages/office/plan.js';
import { doorPoint } from '../../stages/office/build/door.js';
import { live } from './hands.js';

// The Harbor Building's third floor as chapters III and IV find it, and the
// small machinery both direct it with (lane B2; [C5] wave C). Shared by
// scenes/04_office.js and 05_gunfight.js (no default export: the scene
// manager passes this file over).
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const office = (ctx) => ctx.stage.part('office');

// what the detective carries by the start of each (WAVE_C §4): III the red
// matchbook and Ames's crossed card from II; IV also the torn check (PIER 9)
// and the revolver that was always under his arm
export function carry(ctx, { armed = false } = {}) {
  const inv = ctx.save.inventory || (ctx.save.inventory = []);
  for (const k of ['matchbook', 'amesCard', ...(armed ? ['check', 'revolver'] : [])]) if (!inv.includes(k)) inv.push(k);
  if (armed) ctx.save.flags.note = 'PIER 9';
}

// the floor as it stands at a point of the story:
//   'found'  III: the room turned over, the lamp off, Ames in his chair, the
//            pencil in his locked drawer, the key on him, the picture shut on
//            its hinge, the safe shut with the envelope in it
//   'open'   the safe open (the envelope taken), the lamp on, the drawer open
//   'fight'  IV: as 'open', the check in my coat
export function roomAs(ctx, phase = 'found') {
  const O = office(ctx), G = ctx.game;
  ctx.cast.clear();
  for (const h of [...G.world.hoods.list]) G.removeHood(h);
  G.corpses.length = 0;
  G.pending.length = 0;
  G.fx.clear();
  O.reset();
  const later = phase !== 'found';
  // Ames, dead in his chair (the desk's chair side, facing the desk)
  const ames = ctx.cast.spawn('ames', { at: { x: CHAIR.x + 0.04, z: CHAIR.z }, yaw: -Math.PI / 2 + 0.25, brain: 'none', name: 'ames' });
  O.ames = ames;
  // (he is solid: a circle where he sits - the chair's own is under him)
  // the things of the room that the scenes move: the pencil in the locked drawer, his bottle and two glasses
  const R1 = O.desk.drawers.find((d) => d.id === 'R1'), L2 = O.desk.drawers.find((d) => d.id === 'L2');
  const pc = O.pencil || (O.pencil = buildProp('pencil'));
  if (pc.parent) pc.parent.remove(pc);
  pc.position.set(-0.2, 0.03, 0.06); pc.rotation.set(0, 0.3, 0); pc.visible = true;
  R1.group.add(pc);
  if (!O.bottle) {
    O.bottle = new THREE.Group();
    const b = buildProp('bottle', { variant: 'rye' }); b.rotation.z = Math.PI / 2; b.position.set(-0.25, 0.06, -0.04);
    const t1 = buildProp('tumbler'); t1.position.set(-0.52, 0.012, 0.08);
    const t2 = buildProp('tumbler'); t2.position.set(-0.6, 0.012, -0.08);
    O.bottle.add(b, t1, t2);
    O.bottle.traverse((m) => { if (m.isMesh) m.userData.noRay = true; });
  }
  L2.group.add(O.bottle);
  // the envelope in the safe (until it is taken)
  if (O.envelope && O.envelope.parent) O.envelope.parent.remove(O.envelope);
  if (!later) {
    const E = O.envelope || (O.envelope = envelope());
    E.position.set(SAFE.x - 0.02, SAFE.y - SAFE.h / 2 + 0.03, -SAFE.depth / 2 - 0.02);
    E.rotation.set(0, 0.1, 0);
    ctx.stage.scene.add(E);
  }
  if (later) {
    O.setLamp(true);
    R1.locked = false; R1.out = R1.target = 1; R1.group.position.x = DESK.d / 2 + R1.max;
    if (pc.parent) pc.parent.remove(pc);
    O.picture.angle = O.picture.target = PICTURE_ASIDE; O.picture.hang.rotation.y = -PICTURE_ASIDE;
    O.safe.open = 1; O.safe.hinge.rotation.y = -1.9;
  }
  // the hands: nothing in them yet
  const H = ctx.hands;
  live(H, {});
  H.hold(null, 'R', { keep: true }); H.hold(null, 'L', { keep: true });
  H.equip('empty');
  ctx.player.weapons.current = null;
  return O;
}

// the envelope from the safe: brown paper, the flap tucked in, thick with torn paper
export function envelope() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x8a7e66, roughness: 0.95 });
  m.name = 'office_envelope'; m.userData.inkSurface = 'paper';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.11), m);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.002, 0.05).translate(0, 0.007, -0.03), m);
  g.add(body, flap);
  g.traverse((o) => { if (o.isMesh) { o.userData.noRay = true; o.castShadow = true; } });
  return g;
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

// (round 2) the prompt's words read over the lamp's pool and the slats
export function inkPrompt(ctx) {
  const L = ctx.hud.layer('b2ink');
  if (L.firstChild) return;
  const s = document.createElement('style');
  s.textContent = '#hud .prompt .t { padding: 7px 18px; margin-left: -8px; background: radial-gradient(closest-side, rgba(0,0,0,0.62), rgba(0,0,0,0.42) 62%, rgba(0,0,0,0)); '
    + 'text-shadow: 0 0 9px #000, 0 0 5px #000, 0 0 3px #000, 0 0 2px #000, 0 0 1px #000; }';
  L.appendChild(s);
}

// the player standing at a place of the floor
export function stand(ctx, x, z, yaw, pitch = 0, mode = 'walk') {
  const C = ctx.controller;
  C.setPose(x, z, yaw, pitch);
  if (mode !== 'walk') C.setMode(mode, {});
}

// which room a point is in (for the things that answer E: never through a wall)
export function roomOf(x, z) {
  if (x > ROOM.x0 - 0.05 && z > ROOM.z0 - 0.05 && z < ROOM.z1 && x < ROOM.x1) return 'ames';
  if (x > OUTER.x0 - 0.05 && x < ROOM.x0 && z > -0.05 && z < OUTER.z1) return 'outer';
  if (x > OUTER.x0 - 0.05 && z < -0.05 && z > -5) return '305';
  if (x > CORR.x0 - 0.05 && x < OUTER.x0 && z > CORR.z0 - 0.1 && z < CORR.z1 + 0.05) return 'corr';
  if (z > CORR.z1) return 'wc';
  if (x < CORR.x0) return 'landing';
  return 'corr';
}
export const inRoom = (G, r) => roomOf(G.eye.x, G.eye.z) === r;

// every door answers E: open, shut, or locked (it rattles, and says so once tried);
// the corridor's locked offices too. `allow(name)`: a door this beat lets me use
export function doorsUse(ctx, { allow = () => true } = {}) {
  const O = office(ctx), G = ctx.game;
  const ajar = (d) => !d.shut && !d.moving && d.target !== 0 && d.open01 < 0.85;
  const hs = [];
  for (const [name, d] of Object.entries(O.doors)) {
    const h = ctx.interact.add({ id: 'door' + name, at: doorPoint(G, d), range: 1.7, cone: 0.6, prompt: 'open', when: () => allow(name), onUse: () => {
      if (d.locked) { d.tried = true; d.rattle(); return; }
      if (d.shut || ajar(d)) d.open(G.eye); else d.close();
    } });
    hs.push({ d, h });
  }
  ctx.onStep(() => { for (const { d, h } of hs) h.prompt = d.locked && d.tried ? 'locked' : d.shut || ajar(d) ? 'open' : 'shut'; });
  // the locked offices: a rattle, 'locked'
  for (const o of O.others) {
    const tried = { v: false };
    const at = V(o.centre.x + (o.east ? -0.08 : 0.08), 1.0, o.z);
    const h = ctx.interact.add({ id: 'locked' + o.num, at, range: 1.6, cone: 0.55, prompt: 'open', onUse: () => { tried.v = true; h.prompt = 'locked'; G.sfx.play('c2_doorRattle', at, {}, { ref: 3 }); } });
  }
  void DOORS;
}
