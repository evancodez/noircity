import * as THREE from 'three';
import { gunsOf } from '../guns/Guns.js';
import { makeBrain } from '../enemies/HoodBrains.js';
import { buildProp } from '../props/index.js';

// [O3] The gunfights the people start (the fist fights are lane O4's crowd
// brawl since it merged: src/police/fists.js). The seam is this object, the
// only place this lane hands a man of the street a gun:
//
//   copGuns(police)   -> { arm(person, kind, side), carOut(car), men(), step(dt), end(now), active }
//     a man of the street who draws (a detective out of his car, a gang man
//     who answers my gun): his own figure handed to the base's gun kit
//     (src/guns/Guns.js, the gunman brain: the raise, the glint, the settle,
//     cover, flanks - every tell of GUNS.md), the revolver into his fist (or
//     the Tommy gun), the encounter begun round me (O1's navAround and a nav
//     grid there, re-made as the fight moves). Going down in it: the
//     hospital (the city's 'hospital' beat; O4's rule). The man keeps his own
//     figure as he draws (no change of look); O4's K.spawn makes new men of its
//     variants for a system that has none standing (a hideout's: O5).
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function copGuns(police) {
  const G = police.G, P = police.P;
  const S = {
    active: false, list: [], centre: null, rebuildT: 0,
    ensure() {
      const K = gunsOf(G);
      if (K.active) { S.active = true; return K; }
      const E = G.eye;
      G.stage.part('bounds').navAround(E.x, E.z, 34);
      K.begin({
        to: 'hospital', maxFiring: 2, flankAfter: 9, settleK: 1.1, dmgK: 1,
        why: { rush: 'He walked right up to you.', reload: 'Reloading in the open.', flank: 'Flanked.', risen: 'Up too long.', tommy: 'The Tommy gun chewed through.', cover: 'Your cover was shot away.', bare: 'Down, but in the open.', angle: 'They had your angle.', moving: 'Shot in the open.', open: 'Shot standing in the open.' },
      });
      S.active = true; S.centre = { x: E.x, z: E.z }; S.rebuildT = 0;
      police.event('guns', {});
      return K;
    },
    // a man of the street draws: his figure handed to the gun kit
    arm(p, kind = 'pistol', side = 'police') {
      if (!p || !p.standing || p.armed) return null;
      const K = S.ensure();
      const h = p.fig;
      const i = P.list.indexOf(p);
      if (i >= 0) P.list.splice(i, 1);
      const ci = police.cops.indexOf(p);
      if (ci >= 0) police.cops.splice(ci, 1);
      p.armed = true; p.mode = 'gun'; p.path = null;
      p.c.lookAt(null);
      h.hp = kind === 'tommy' ? 120 : 100;
      h.heavy = kind !== 'pistol';
      h.gunKind = kind; h.turnSafe = true;
      h.surface = (x, z) => G.stage.surfaceY(x, z);
      h.o3side = side; h.person = p;
      G.stage.hoods.list.push(h);
      G.counters.spawned++;
      const B = makeBrain(G, h, 'gunman', { kind, heavy: kind !== 'pistol', wait: 0.5 });
      G.ais.set(h, B);
      h.onMove = (hh) => K.resolveMan(hh);
      if (B) B.kit = K;
      // the gun into his fist: seen (he draws)
      if (kind === 'tommy') { h.addTommy(); if (h.tommy) { h.tommy.userData.inkId = h.inkId; h.tommy.userData.inkFigure = true; } }
      else {
        const gun = buildProp('revolver');
        gun.traverse((o) => { if (o.isMesh) { o.userData.inkId = h.inkId; o.userData.inkFigure = true; o.userData.noRay = true; } });
        try { p.c.hold(gun, 'R'); } catch (e) { h.bones.handR.add(gun); }
      }
      S.list.push(h);
      police.event('draw', { side, kind });
      return h;
    },
    // detectives out of their car: Tommy guns
    carOut(pc) {
      const v = pc.v;
      for (let i = 0; i < 2; i++) {
        const sd = i % 2 ? 1 : -1;
        const q = v.world(0.2, sd * (v.spec.halfW + 0.6), V(0, 0, 0));
        G.stage.colliders.resolve(q, 0.35);
        const man = P.spawn(P.tecLook(i), q.x, q.z, v.yaw - Math.PI / 2 * sd, 'cop');
        man.job = 'gun';
        S.arm(man, i === 0 ? 'tommy' : 'pistol', 'police');
      }
      pc.crewN = 0;
      G.sfx.play('tail_door', v.pos.clone().setY(1), { open: true }, { ref: 4 });
    },
    men() { return S.list; },
    step(dt) {
      // (the men stood down: their guns away, gone once out of my sight)
      if (S.retire && S.retire.length) for (const h of [...S.retire]) {
        if (!G.stage.hoods.list.includes(h)) { S.retire.splice(S.retire.indexOf(h), 1); continue; }
        const d = Math.hypot(h.pos.x - G.eye.x, h.pos.z - G.eye.z);
        if (d > 45 && !P.inView(h.pos.x, h.pos.z) || d > 120) { G.removeHood(h); S.retire.splice(S.retire.indexOf(h), 1); }
      }
      if (!S.active) return;
      const K = G.guns;
      if (!K || !K.active) { S.active = false; return; }
      // the fight moves with me: its ground re-made round me (at most every 3 s)
      S.rebuildT -= dt;
      const E = G.eye;
      if (S.rebuildT <= 0 && S.centre && Math.hypot(E.x - S.centre.x, E.z - S.centre.z) > 18) {
        S.rebuildT = 3;
        G.stage.part('bounds').navAround(E.x, E.z, 34);
        K.rebuild();
        S.centre = { x: E.x, z: E.z };
      }
      // (the dead stay where they lie; the living far behind me give it up)
      for (const h of [...S.list]) {
        if (!h.alive) continue;
        const d = Math.hypot(h.pos.x - E.x, h.pos.z - E.z);
        if (d > 90 && !P.inView(h.pos.x, h.pos.z)) { G.removeHood(h); S.list.splice(S.list.indexOf(h), 1); }
      }
      // nobody left with a gun: the encounter ends (the bodies stay)
      if (!S.list.some((h) => h.alive)) S.end();
    },
    end(now = false) {
      const K = G.guns;
      if (K && K.active) K.end();
      S.active = false;
      if (now) { for (const h of S.list) if (G.stage.hoods.list.includes(h)) G.removeHood(h); S.list = []; S.retire = []; return; }
      // the living put their guns away and stand: no brain, no shot
      S.retire = S.retire || [];
      for (const h of S.list) if (h.alive) {
        const ai = G.ais.get(h);
        if (ai) ai.release();
        G.ais.delete(h);
        h.onMove = null;
        try { h.setAim(false); h.speed = 0; h.setState('idle', 0.3); } catch (e) { /* */ }
        S.retire.push(h);
      }
      S.list = [];
    },
  };
  return S;
}
