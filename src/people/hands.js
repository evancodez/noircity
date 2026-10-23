import * as THREE from 'three';

// [O3] My hands in the street, a STAND-IN until lane O4 merges (its guns in
// open ground and its crowd brawl take these verbs over; this object is the
// seam: `people.hands`, the one place the street reads what my hands do).
// The rulebook's keys (WAVE_C §2), on foot in the city:
//   LMB  a jab at the man in front of me (the fists come up on the press;
//        the first lands on the press - 0.06 s to contact); a cop or a gang
//        man answers with the fist fight (copFists); a man of the street
//        staggers, two put him down
//   RMB  the revolver out from under the arm (0.35 s), steadied while held;
//        LMB fires it (the gun's own: src/player/weapons/revolver.js), R
//        reloads; left alone 6 s it goes back under the arm
//   E    over a man down with a gun: take it (the gun the police took back)
// Every act is told to the street: a jab is a crime ('punch'), the gun out
// is a 'menace' (the street runs; a cop who sees it 25 m off: HEAT 1), a shot
// is a 'shot' (People.onShot).
const _f = new THREE.Vector3();

export class StandinHands {
  constructor(P) {
    this.P = P;
    this.G = P.G;
    this.hasGun = true;
    this.side = 'L';
    this.fistT = 0;
    this.gunIdle = 0;
    this.menaceT = 0;
    this.footT = 0;
    this.stats = { jabs: 0, landed: 0, draws: 0, menace: 0 };
    this.lastJab = null;
  }
  get gunOut() { const W = this.G.player.weapons; return W.current === 'revolver' && W.active && W.active.phase !== 'holster' && W.active.phase !== 'away'; }
  // the man in front of me within reach (a cone of the view)
  inReach(r = 1.9) {
    const G = this.G, E = G.eye;
    G.camera.getWorldDirection(_f);
    const fl = Math.hypot(_f.x, _f.z) || 1;
    let best = null, bs = Infinity;
    for (const p of this.P.near(E.x, E.z, r + 0.5)) {
      if (!p.standing || p.armed) continue;
      const dx = p.pos.x - E.x, dz = p.pos.z - E.z, d = Math.hypot(dx, dz);
      if (d > r + p.r) continue;
      const c = (dx * _f.x + dz * _f.z) / (Math.max(0.05, d) * fl);
      if (c < 0.72) continue;
      const s = d - c;
      if (s < bs) { bs = s; best = p; }
    }
    return best;
  }

  step(dt) {
    const G = this.G, C = G.controller, H = G.player.hands, W = G.player.weapons;
    if (!G.city || G.city.inCar || G.brawl.active || G.failing || G.state !== 'playing') return;
    if (C.mode !== 'walk' || C.frozen) return;
    this.footT += dt;
    // (the hands in the frame only while they hold something up: the fists, the gun)
    const up = H.set === 'fists' || W.current === 'revolver';
    if (up !== !!G.vmWanted) G.setViewmodelVisible(up);
    // the keys, once: on foot a few seconds, nothing else up
    if (this.footT > 7 && !this.taught && !G.hud.kit.warnText) { this.taught = true; G.hud.teach('o3_hands', '[LMB] punch  [RMB] the gun', { until: ['Mouse0', 'Mouse2'], secs: 4 }); }
    const gun = this.gunOut;
    // RMB: the gun out
    if (G.pressed('Mouse2') && W.current !== 'revolver') {
      if (this.hasGun) { W.equip('revolver'); this.gunIdle = 0; this.stats.draws++; this.menace(true); }
      else if (G.time - (this.noGunT ?? -9) > 3) { this.noGunT = G.time; G.hud.message('no gun', 1.4); }
      return;
    }
    if (gun) {
      if (G.held('Mouse2') || G.pressed('Mouse0')) this.gunIdle = 0; else this.gunIdle += dt;
      const R = W.active;
      if (this.gunIdle > 6 && R.phase === 'ready' && R.holster) R.holster();
      // a gun pointed at people: they run; a cop who sees it: HEAT 1
      this.menaceT -= dt;
      if (this.menaceT <= 0) { this.menaceT = 1.2; this.menace(false); }
      return;
    }
    // LMB: a jab
    if (G.pressed('Mouse0')) this.jab();
    if (H.set === 'fists') { this.fistT += dt; if (this.fistT > 3.5) { H.equip('empty'); G.setViewmodelVisible(false); } }
    // E over a man down with a gun: take it
    if (!this.hasGun) {
      const p = this.gunNear();
      const k = p ? 'o3gun' : null;
      if (k !== this.gunPrompt) { this.gunPrompt = k; if (k) G.hud.prompt('E  take the gun', null, 'o3gun'); else G.hud.clearPrompt('o3gun'); }
      if (p && G.pressed('KeyE')) { this.hasGun = true; G.hud.clearPrompt('o3gun'); this.gunPrompt = null; G.sfx.play('pocket', null, {}, { send: false }); G.hud.message('the gun', 1.2); if (p.gunProp && p.gunProp.parent) p.gunProp.parent.remove(p.gunProp); p.gunTaken = true; }
    }
  }
  // a man down near me who carried a gun (a cop, a gang man)
  gunNear() {
    const E = this.G.eye;
    for (const h of this.G.stage.hoods.list) {
      if (h.alive || !h.person || h.person.gunTaken) continue;
      if (Math.hypot(h.pos.x - E.x, h.pos.z - E.z) < 1.8) return h.person;
    }
    for (const p of this.P.near(E.x, E.z, 2)) if (!p.standing && (p.role === 'cop' || p.gunProp) && !p.gunTaken && Math.hypot(p.pos.x - E.x, p.pos.z - E.z) < 1.8) return p;
    return null;
  }
  menace(first) {
    const G = this.G, P = this.P, E = G.eye;
    G.camera.getWorldDirection(_f);
    // (the people in front of the gun, and anyone close)
    let any = false;
    for (const p of P.list) {
      if (!p.standing || p.role !== 'walker') continue;
      const dx = p.pos.x - E.x, dz = p.pos.z - E.z, d = Math.hypot(dx, dz);
      if (d > 20) continue;
      const c = (dx * _f.x + dz * _f.z) / Math.max(0.1, d * Math.hypot(_f.x, _f.z));
      if (d < 7 || (c > 0.8 && d < 20)) { if (p.mode !== 'flee' && p.mode !== 'report') { p.flee(E, 6 + Math.random() * 3); any = true; } }
    }
    if (first || any) { this.stats.menace++; P.crime.emit('menace', E, 'player', { level: 0 }); }
    // a cop who sees the gun out 25 m off: HEAT 1
    const police = P.police;
    if (!police.heat) for (const c of police.cops) if (c.standing && P.sees(c.pos, E, 25)) { c.say('o3_whistle'); police.event('seen', { kind: 'gun', by: 'cop' }); police.raise(1, E, 'gun'); break; }
  }
  jab() {
    const G = this.G, H = G.player.hands, P = this.P;
    if (H.set !== 'fists') H.equip('fists');
    this.fistT = 0;
    const side = this.side; this.side = side === 'L' ? 'R' : 'L';
    try { H.play(side === 'L' ? 'jabL' : 'jabR'); } catch (e) { /* */ }
    this.stats.jabs++;
    const p = this.inReach();
    this.lastJab = { t: G.time, who: p ? p.role : null };
    if (!p) { G.sfx.fight('whiff', null, {}); return; }
    this.stats.landed++;
    G.sfx.fight('jab', null, { k: 1 });
    G.controller.kick(0.7, 1, 0.1);
    const dir = new THREE.Vector3(p.pos.x - G.eye.x, 0, p.pos.z - G.eye.z).normalize();
    // a cop, a gang man: the fist fight (and the cop saw it: it is his)
    if (p.role === 'cop') {
      P.crime.emit('punch', p.pos, 'player', { victim: p });
      P.police.raise(1, G.eye, 'punch a cop');
      P.police.fists.start(p, { why: 'punched' });
      return;
    }
    if (p.role === 'gang') {
      P.crime.emit('punch', p.pos, 'player', { victim: p });
      P.gangs.stats.fights++;
      P.police.fists.start(p, { why: 'gang' });
      return;
    }
    // a man of the street: he staggers; two inside 3 s put him down
    p.hits = G.time - (p.hitT ?? -9) < 3 ? p.hits + 1 : 1;
    p.hitT = G.time;
    if (p.hits >= 2) { p.knock(dir, { why: 'punch' }); P.stats.knocked++; G.sfx.fight('bodyPavement', p.pos.clone().setY(0.3), { k: 0.8 }); }
    else {
      // (the first: the head snaps, a step back, a beat of shock - then he runs)
      p.fig.flinch(dir); p.say('o3_hey'); p.fig.pos.x += dir.x * 0.3; p.fig.pos.z += dir.z * 0.3;
      if (p.role === 'walker') { p.stop(); p.mode = 'dash'; p.t = 0; p.until = 1.5; p.path = null; p.face(G.eye.x, G.eye.z); p.after = null; P.later(0.8, () => { if (p.standing && p.mode === 'dash') p.flee(G.eye, 5); }); }
    }
    P.crime.emit('punch', p.pos, 'player', { victim: p });
  }
}
