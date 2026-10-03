import * as THREE from 'three';
import { DESK, PAD, LAMP, SAFE, PICTURE, STAND, CABS, CAB, ROOM, COOLER, CORR, WC } from '../../stages/office/plan.js';
import { office, V, roomOf, inRoom } from './room.js';
import { live, palmOn } from './hands.js';

// [C5] Chapter III's search (WAVE_C §6 III, docs/story/briefs/C5_OFFICE.md):
// every thing on the floor that I can touch does what that thing does, fully,
// in any order. The chain that solves it:
//   the safe is found (the one picture they did not get to stands a finger
//   off the wall on its hinge side: E, it swings open on the hinge);
//   the combination is on the pad under the top sheet (the top sheet burnt:
//   its corner in the ashtray), its dents faint in the lamp's raking light
//   once the lamp is lit (its chain);
//   the pencil is in his locked drawer; the key is on him (E: my hand into
//   his waistcoat for the ring, and on his tie a moment);
//   the pad shaded (pad.js), the sheet torn off and held up at the dial
//   (safe.js); the envelope in the safe; the pieces on his desk (check.js).
// Flavour that says so quickly: his hat on the stand, the photograph of the
// two of us, the bottle and two glasses, the telephone (hung up: the line is
// dead), the cooler, the typewriter, the dust sheets, the corridor's things.
// A stall (50 s with no step on): the room points, never says - a hard small
// light flickers on the next thing, now and then.
//   const S = search(ctx, pad, safe)   S.state (the record: what is done)   S.step(dt)
export function search(ctx, pad, safe) {
  const G = ctx.game, O = office(ctx), I = ctx.interact, H = ctx.hands, C = ctx.controller;
  const st = ctx.flags.s || (ctx.flags.s = { lamp: false, ames: false, key: false, pencil: false, dents: false, ash: false, picture: false, envelope: false, checked: false, progressT: G.time, tried: {} });
  const said = ctx.flags.said || (ctx.flags.said = {});
  const once = (k, text, secs = 2.4) => { if (said[k]) return; said[k] = true; G.hud.say(text, secs); };
  const on = (k) => { if (!st[k]) { st[k] = true; st.progressT = G.time; } };
  const touch = () => { st.progressT = G.time; };
  const D = O.desk;
  const busy = () => pad.active || safe.active || G.puzzles.active || !!st.handsBusy;
  const here = (r) => () => inRoom(G, r) && !busy();

  // ---- the lamp's chain ---------------------------------------------------------------------
  const chainAt = () => O.lamp.parts.shadeG.localToWorld(V(0.03, -0.11, 0.1));
  I.add({ id: 'chain', at: chainAt, range: 1.7, cone: 0.5, prompt: 'pull the chain', when: () => here('ames')() && !D.tip, onUse: () => {
    O.setLamp(!O.lampOn);
    G.sfx.play('c5_chain', chainAt());
    O.pad.api.setLit(O.lampOn);
    if (O.lampOn) on('lamp');
  } });
  ctx.onStep(() => { const h = I.list.find((q) => q.id === 'chain'); if (h) h.prompt = O.lampOn ? 'the chain' : 'pull the chain'; });

  // ---- Ames ----------------------------------------------------------------------------------
  const amesChest = () => { const f = O.ames && O.ames.fig; if (!f) return V(4.6, 1.0, 3.7); const p = f.bones.chest.getWorldPosition(V(0, 0, 0)); return p; };
  I.add({ id: 'ames', at: () => amesChest().add(V(-0.12, -0.05, 0)), range: 1.6, cone: 0.55, prompt: 'search him', when: () => here('ames')() && !st.ames, onUse: () => searchAmes() });
  function searchAmes() {
    st.handsBusy = true;
    const c = amesChest();
    // (the view on him; I lean in)
    const e = G.eye, dx = c.x - e.x, dz = c.z - e.z;
    C.frozen = true;
    C.ease({ x: C.pos.x, z: C.pos.z, y: e.y, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(c.y - 0.05 - e.y, Math.hypot(dx, dz)) }, 0.35);
    let t = 0, keys = false;
    const fwd = V(-1, 0, 0.25).normalize();
    const fn = () => {
      t += 1 / 60;
      const ch = amesChest();
      // (the right hand into his waistcoat pocket, out with the ring; then on his tie, the knot set straight)
      if (t < 1.1) palmOn(H, 'R', ch.clone().add(V(-0.13, -0.12 + Math.min(0.08, t * 0.12), -0.06)), fwd.clone().negate(), V(0, -1, 0));
      else if (t < 2.2) palmOn(H, 'R', ch.clone().add(V(-0.14, 0.05 + (t - 1.1) * 0.06, 0.0)), fwd.clone().negate(), V(0, 1, 0.1));
      if (t > 0.15 && t < 2.2 && (!H.still || !H.still.R)) live(H, { R: 'b2liveR' });
      if (t > 0.7 && !keys) { keys = true; G.sfx.play('c5_keys', ch); }
      if (t >= 2.4) {
        live(H, {});
        C.frozen = false;
        st.handsBusy = false;
        on('ames'); on('key');
        ctx.flags._amesFn = null;
        return true;
      }
      return false;
    };
    ctx.flags._amesFn = fn;
  }
  ctx.onStep(() => { if (ctx.flags._amesFn) ctx.flags._amesFn(); });

  // ---- the desk's drawers ------------------------------------------------------------------------
  for (const d of D.drawers) {
    if (d.gone) continue;
    const at = () => d.group.parent.localToWorld(V(d.group.position.x + 0.03, d.y + 0.1, d.z));
    // (R1 open with the pencil in it: the pencil is the thing to take, not the drawer)
    const h = I.add({ id: 'drawer' + d.id, at, range: 1.5, cone: 0.45, prompt: 'open', when: () => here('ames')() && !D.tip && !(d.id === 'R1' && d.out > 0.5 && !st.pencil), onUse: () => {
      if (d.locked) {
        if (st.key) { d.locked = false; G.sfx.play('c5_unlock', at()); on('unlocked'); O.drawer(d, true); return; }
        G.sfx.play('c5_locked', at()); st.tried[d.id] = true;
        return;
      }
      O.drawer(d, d.target < 0.5);
      if (d.target > 0.5) {
        touch();
        if (d.id === 'L2') once('glasses', 'Two glasses. He had company.');
      }
    } });
    ctx.onStep(() => { h.prompt = d.locked ? (st.key ? 'unlock it' : st.tried[d.id] ? 'locked' : 'open') : d.target > 0.5 ? 'shut' : 'open'; });
  }
  // the pencil in the drawer they did not open
  const R1 = D.drawers.find((d) => d.id === 'R1');
  I.add({ id: 'pencil', at: () => (O.pencil && O.pencil.parent ? O.pencil.getWorldPosition(V(0, 0, 0)) : V(0, -9, 0)), range: 1.5, cone: 0.5, prompt: 'take the pencil', when: () => here('ames')() && !st.pencil && R1.out > 0.9, onUse: () => {
    if (O.pencil.parent) O.pencil.parent.remove(O.pencil);
    O.pencil.visible = false;
    G.sfx.play('office_pencilPick', R1.group.getWorldPosition(V(0, 0, 0)));
    on('pencil');
  } });

  // ---- the filing cabinets' drawers (every one runs all the way) --------------------------------------
  O.cabinets.forEach((c, ci) => c.drawers.forEach((d) => {
    const at = () => c.group.localToWorld(V(0, d.y + 0.2, d.group.position.z - 0.02));
    const room = c.x > 0 ? 'ames' : 'outer';
    const h = I.add({ id: 'cab' + d.id, at, range: 1.5, cone: 0.32, prompt: 'open', when: here(room), onUse: () => { O.drawer(d, d.target < 0.5); if (d.target > 0.5) touch(); } });
    ctx.onStep(() => { h.prompt = d.target > 0.5 ? 'shut' : 'open'; });
    void ci;
  }));

  // ---- the telephone, the ashtray, the pad --------------------------------------------------------
  const ph = O.phone;
  const recvAt = () => ph.recv.getWorldPosition(V(0, 0, 0));
  I.add({ id: 'phone', at: recvAt, range: 1.6, cone: 0.5, prompt: 'hang it up', when: () => here('ames')() && !D.tip, onUse: () => {
    if (!ph.hung) { ph.on(); G.sfx.play('c5_phoneHang', recvAt()); touch(); return; }
    // (lifted: the hook, nothing on the line; set down again)
    G.sfx.play('c5_phoneDead', recvAt());
    once('dead', 'Dead. They cut it.');
  } });
  ctx.onStep(() => { const h = I.list.find((q) => q.id === 'phone'); if (h) h.prompt = ph.hung ? 'lift it' : 'hang it up'; });
  // (off the hook, the receiver turns a little on its cord)
  ctx.onStep(() => { if (!ph.hung && !D.tip) ph.recv.rotation.y = 0.4 + Math.sin(G.time * 0.9) * 0.18; });
  I.add({ id: 'ash', at: () => O.furn.ashtray, range: 1.5, cone: 0.45, prompt: 'the ashtray', when: () => here('ames')() && !D.tip, onUse: () => {
    G.sfx.play('office_paperRustle', O.furn.ashtray, { k: 0.4 });
    once('ash', 'He burned the top sheet.', 2.6);
    on('ash');
  } });
  I.add({ id: 'pad', at: V(PAD.x, DESK.h + 0.02, PAD.z), range: 1.8, cone: 0.5, prompt: 'the pad', when: () => here('ames')() && !pad.done && !D.tip, onUse: () => {
    if (!O.lampOn) { G.hud.say('Too dark.', 1.8); return; }
    if (!st.pencil) { G.hud.say('Dents in it. Written hard.', 2.4); on('dents'); return; }
    pad.open();
  } });

  // ---- the picture, the safe, the envelope, the desk -----------------------------------------------
  const picAt = V(PICTURE.x + 0.1, PICTURE.y, 0.1);
  I.add({ id: 'picture', at: picAt, range: 1.9, cone: 0.55, prompt: 'the picture', when: () => here('ames')() && O.picture.target < 0.5, onUse: () => {
    O.openPicture();
    G.sfx.play('office_pictureSwing', picAt);
    on('picture');
    if (!O.safe.open && !safe.opened) ctx.hud.objective('Open the safe.');
  } });
  I.add({ id: 'safe', at: () => O.safe.centre, range: 1.7, cone: 0.55, prompt: 'the dial', when: () => here('ames')() && O.picture.target > 0.5 && !safe.opened && !safe.active && !pad.active, onUse: () => safe.open() });
  const envAt = () => (O.envelope && O.envelope.parent ? O.envelope.getWorldPosition(V(0, 0, 0)) : V(0, -9, 0));
  I.add({ id: 'envelope', at: envAt, range: 1.6, cone: 0.55, prompt: 'take it', when: () => here('ames')() && safe.opened && !st.envelope, onUse: () => {
    G.sfx.play('c5_envelope', envAt());
    if (O.envelope.parent) O.envelope.parent.remove(O.envelope);
    on('envelope');
  } });

  // ---- flavour: his hat, the photograph, the cooler, the typewriter, the dust sheets ----------------
  I.add({ id: 'hat', at: V(STAND.x - 0.17, 1.7, STAND.z), range: 1.7, cone: 0.5, prompt: 'his hat', when: here('ames'), onUse: () => once('hat', 'His hat. He never left.') });
  // (the photograph on the middle cabinet: the two of us in uniform, a lifetime ago)
  const photoAt = V(CABS[1], CAB.h + 0.12, ROOM.z1 - CAB.d / 2 - 0.02);
  I.add({ id: 'photo', at: photoAt, range: 1.8, cone: 0.5, prompt: 'a photograph', when: here('ames'), onUse: () => once('photo', 'France. He carried me out.', 2.8) });
  I.add({ id: 'cooler', at: V(COOLER.x, 1.0, COOLER.z), range: 1.6, cone: 0.5, prompt: 'a drink', when: here('outer'), onUse: () => G.sfx.play('office_coolerGlug', V(COOLER.x, 1.0, COOLER.z)) });
  I.add({ id: 'typewriter', at: () => O.suite.typewriter, range: 1.6, cone: 0.5, prompt: 'the typewriter', when: here('outer'), onUse: () => { G.sfx.play('c5_typeKey', O.suite.typewriter); once('type', 'Nobody has typed here in a month.'); } });
  for (const [i, s] of (O.sheets || []).entries()) I.add({ id: 'sheet' + i, at: s.at, range: 1.8, cone: 0.5, prompt: 'lift the sheet', when: here('305'), onUse: () => { G.sfx.play('office_paperRustle', s.at, { k: 0.6 }); once('sheet', 'Nobody has moved in.'); } });
  // the corridor and the washroom
  I.add({ id: 'liftBtn', at: () => O.suite.liftButton, range: 1.5, cone: 0.5, prompt: 'call the lift', when: () => inRoom(G, 'corr'), onUse: () => { G.sfx.play('c5_typeKey', O.suite.liftButton); G.sfx.play('c5_liftBell', O.suite.liftButton, { k: 0.3 }); once('lift', 'It’s here. It’s not going anywhere.'); } });
  I.add({ id: 'radiator', at: () => O.suite.radiator, range: 1.5, cone: 0.5, prompt: 'the radiator', when: () => inRoom(G, 'corr'), onUse: () => { G.sfx.play('office_ironStep', O.suite.radiator, { k: 1 }); once('rad', 'Stone cold.'); } });
  I.add({ id: 'cart', at: () => O.suite.cart, range: 1.5, cone: 0.5, prompt: 'the cart', when: () => inRoom(G, 'corr'), onUse: () => { G.sfx.play('office_ironStep', O.suite.cart, { k: 0.7 }); once('cart', 'The cleaner left early.'); } });
  I.add({ id: 'wcChain', at: () => O.suite.wcChain, range: 1.5, cone: 0.6, prompt: 'pull the chain', when: () => roomOf(G.eye.x, G.eye.z) === 'wc', onUse: () => { const L = O.lights.wc; L.on = !L.on; G.sfx.play('c5_chain', O.suite.wcChain); } });
  I.add({ id: 'tap', at: () => O.suite.tap, range: 1.4, cone: 0.5, prompt: 'the tap', when: () => roomOf(G.eye.x, G.eye.z) === 'wc', onUse: () => G.sfx.play('c5_tap', O.suite.tap) });

  // ---- the stall hint: a small hard light flickers on the next thing --------------------------------
  const next = () => {
    if (!inRoom(G, 'ames') && !inRoom(G, 'outer')) return null;
    if (!st.ames) return amesChest();
    if (!O.lampOn) return chainAt();
    if (!st.pencil) return R1.group.getWorldPosition(V(0, 0, 0)).add(V(0.05, 0.1, 0));
    if (!pad.done && !safe.opened) return V(PAD.x, DESK.h, PAD.z);
    if (O.picture.target < 0.5) return V(PICTURE.x, PICTURE.y, 0.05);
    if (!safe.opened) return O.safe.centre.clone();
    if (!st.envelope) return envAt();
    if (!st.checked) return V(PAD.x, DESK.h, PAD.z);
    return null;
  };
  const HL = O.lights.hint;
  let hintT = 0;
  const S = {
    state: st,
    step(dt) {
      // (no stall while a puzzle is open and being worked: its own hints)
      if (busy()) st.progressT = Math.max(st.progressT, G.time - 30);
      const idle = G.time - st.progressT;
      if (idle > 50 && !busy()) {
        hintT += dt;
        const p = next();
        if (p && hintT % 22 < 2.6) {
          if (!HL.on) {
            HL.on = true; HL.flicker = 1;
            HL.head.set(p.x - 0.4, Math.min(2.9, p.y + 1.8), p.z + 0.2);
            HL.axis.copy(p).sub(HL.head).normalize();
            HL.light.pos.copy(HL.head); HL.light.target.copy(p); HL.light.intensity = 9; HL.moved = true;
            st.hints = (st.hints || 0) + 1;
          }
        } else if (HL.on) HL.on = false;
      } else { hintT = 0; if (HL.on) HL.on = false; }
    },
    touch,
  };
  void THREE; void LAMP; void SAFE; void CORR; void WC;
  return S;
}
