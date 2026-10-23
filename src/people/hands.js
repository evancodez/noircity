import * as THREE from 'three';
import { owns, give, arms, wallet } from '../combat/money.js';

// [O3] My hands in the street (lane O4's crowd brawl takes over the moment a
// fight starts; its guns' money.js says what I own: this object is the seam,
// `people.hands`, the one place the street reads what my hands do).
// The rulebook's keys (WAVE_C §2), on foot in the city:
//   LMB  a jab at the man in front of me (the fists come up on the press;
//        the first lands on the press - 0.06 s to contact); a cop or a gang
//        man answers with the fist fight (copFists); a man of the street
//        staggers, two put him down
//   RMB  the revolver out from under the arm (0.35 s), steadied while held;
//        LMB fires it (the gun's own: src/player/weapons/revolver.js), R
//        reloads; left alone 6 s it goes back under the arm. Only a gun I own
//        (O4's save.inventory: given once a save as the city first starts,
//        taken at the station, taken back from a man down with E - lane O1b's
//        items); with none, RMB says 'no gun'.
// Every act is told to the street: a jab is a crime ('punch'), the gun out
// is a 'menace' (the street runs; a cop who sees it 25 m off: HEAT 1), a shot
// is a 'shot' (People.onShot).
const _f = new THREE.Vector3();

export class StandinHands {
  constructor(P) {
    this.P = P;
    this.G = P.G;
    this.side = 'L';
    this.fistT = 0;
    this.gunIdle = 0;
    this.menaceT = 0;
    this.footT = 0;
    this.stats = { jabs: 0, landed: 0, draws: 0, menace: 0 };
    this.lastJab = null;
  }
  get hasGun() { return owns(this.G, 'revolver'); }
  // (the plays' staging: the revolver given or taken)
  set hasGun(v) { const S = this.G.save; if (v) give(this.G, 'revolver'); else S.inventory = (S.inventory || []).filter((k) => k !== 'revolver'); }
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
    if (!G.city || G.city.inCar || G.brawl.active || (G.crowd && G.crowd.active) || G.failing || G.state !== 'playing') return;
    // [manager, after O7] the wheel's draw puts the controller in the gun mode (city.js [O5/O7]): the
    // street's hands (the menace, the rounds' count) run there too
    if ((C.mode !== 'walk' && C.mode !== 'gun') || C.frozen) return;
    this.footT += dt;
    // (the hands in the frame only while they hold something up: the fists, the gun)
    const up = H.set === 'fists' || W.current === 'revolver';
    if (up !== !!G.vmWanted) G.setViewmodelVisible(up);
    // the keys, once a save (the kit's): on foot a few seconds, nothing else up;
    // [O3] after the critic (M2): the card says what is true - the draw only with a gun of mine
    if (this.footT > 5 && !this.taught && !G.hud.kit.warnText && !G.hud.sayShown && !(G.police && G.police.heat)) {
      this.taught = true;
      // [manager, after O7] the draw is the wheel's (O7's card '[WHEEL] the revolver', city.js); this card says the fist
      G.hud.teach('o3_punch', '[LMB] punch', { until: ['Mouse0'], secs: 3.4 });
    }
    const gun = this.gunOut;
    // (the gun's rounds kept in the coat's count as they go: a draw again loads what is left - O4's arms)
    if (W.current === 'revolver' && W.active && Number.isFinite(W.active.pocket)) { const A = wallet(G).ammo; A.revolver = W.active.pocket; A.revolverIn = W.active.ammo; }
    // [manager, after O7] RMB no longer draws: the wheel does (city.js [O7], O4's arms; the title's keys line:
    // 'WHEEL the revolver, RMB steady'); with nothing drawn RMB is O7's jab (night/fist.js)
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
    // (a gun from a man down is lane O1b's item: E over it - his gun lies by him, items.drop)
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
    const down = p.hits >= 2;
    if (down) { p.knock(dir, { why: 'punch' }); P.stats.knocked++; G.sfx.fight('bodyPavement', p.pos.clone().setY(0.3), { k: 0.8 }); }
    else {
      // (the first: the head snaps, a step back, a beat of shock - then he runs)
      // [O3] after the critic (m4): the step back is out of what stands behind him (a post, a wall, a stall)
      p.fig.flinch(dir); p.say('o3_hey'); p.fig.pos.x += dir.x * 0.3; p.fig.pos.z += dir.z * 0.3;
      G.stage.colliders.resolve(p.fig.pos, p.r, p.fig.collider);
      if (p.role === 'walker') { p.stop(); p.mode = 'dash'; p.t = 0; p.until = 1.5; p.path = null; p.face(G.eye.x, G.eye.z); p.after = null; P.later(0.8, () => { if (p.standing && p.mode === 'dash') p.flee(G.eye, 5); }); }
    }
    const rec = P.crime.emit('punch', p.pos, 'player', { victim: p });
    // (the man I put down tells it himself once he is up - [O3] after the critic, M1)
    if (down && rec) p.victimOf = rec;
  }
}
