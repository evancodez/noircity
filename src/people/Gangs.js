import * as THREE from 'three';
import { buildProp } from '../props/index.js';

// [O3] The two gangs (lane O3, NOIR CITY): the Docks' crew (long coats,
// fedoras, the white scarf: cast kind o3_docksman) and the Tenements' boys
// (flat caps, short jackets: o3_tough), each on its own ground. They stand on
// corners in threes (and outside their bars: a corner by the bar's lot);
// they watch me (heads turn as I come within 20 m); stand with them and one
// says a word; push one or punch one and he fights (the fist fight, the
// stand-in's copFists); draw near them and they draw (their own figures to
// the gun kit: copGuns.arm - they shoot back, with every tell); shoot one and
// all of them do. Now and then (about one in ten minutes, near me when I am
// on their ground) two threes meet at the border and fight each other, fists
// then guns, which the police come to (a crime of theirs, not mine: the cars
// come to the place, no heat on me) - unless I join in.
//   gangs.posts   gangs.threes   gangs.war(at?)   gangs.step(dt)
// A place's hideout (O5) spawns its own men: gangs.three(gang, x, z, { door }).
export const GANG = {
  docks: { kind: 'o3_docksman', ground: 'docks', word: 'Lost, mister?' },
  tenements: { kind: 'o3_tough', ground: 'tenements', word: 'Something you want?' },
  near: 130, gone: 165, watch: 20, word: 3.6,
  warEvery: [480, 720],                    // s between the border fights (about one in ten minutes)
};
// the border: where the Docks meet the Tenements (Water St's east end and the
// Bowery's south end, the quay's corner)
const BORDER = [[170, 236], [250, 236], [330, 236], [160, 300], [300, 300]];
const _v = new THREE.Vector3();

export class Gangs {
  constructor(P) {
    this.P = P;
    this.G = P.G;
    this.threes = [];
    this.posts = this.makePosts();
    this.t = 0;
    this.warT = GANG.warEvery[0] * (0.5 + Math.random() * 0.5);
    this.war_ = null;
    this.stats = { words: 0, fights: 0, draws: 0, wars: 0 };
  }

  // the corners each gang holds: junction corners of its ground, spread out
  makePosts() {
    const P = this.P, out = [];
    for (const [gang, G] of Object.entries(GANG)) {
      if (!G || !G.ground) continue;
      const cands = P.pList.filter((n) => P.districtOf(n.x, n.z) === G.ground && n.edges.length >= 3);
      // (the bars' corners first: the gang outside its bar)
      const bars = P.C.lots.filter((l) => l.place && l.place.kind === 'bar' && P.districtOf(l.cx, l.cz) === G.ground);
      const picked = [];
      for (const b of bars) { let best = null, bd = 40; for (const n of cands) { const d = Math.hypot(n.x - b.cx, n.z - b.cz); if (d < bd) { bd = d; best = n; } } if (best) picked.push(best); }
      for (const n of cands) { if (picked.length >= 7) break; if (picked.every((q) => Math.hypot(q.x - n.x, q.z - n.z) > 110)) picked.push(n); }
      for (const n of picked) out.push({ gang, x: n.x, z: n.z, node: n, three: null, coolT: 0 });
    }
    return out;
  }

  dispose() { for (const T of [...this.threes]) this.drop(T); this.threes = []; }

  // a three at a corner (out of my sight), standing round a point
  three(gang, x, z, { post = null, walkTo = null } = {}) {
    const P = this.P, looks = P.gangLooks(gang, x, z);
    const T = { gang, x, z, men: [], post, hostile: false, sayT: -99, nearT: 0, t: 0 };
    for (let i = 0; i < 3; i++) {
      const kind = looks[i] || GANG[gang].kind;
      const a = i * 2.1 + Math.random() * 0.4, r = 0.95;
      const mx = x + Math.sin(a) * r, mz = z + Math.cos(a) * r;
      const p = P.spawn(kind, mx, mz, a + Math.PI, 'gang');
      p.gang = T; p.mode = 'hold'; p.holdAt = { x: mx, z: mz };
      p.face(x, z); p.fig.yaw = p.wantYaw;
      p.onBeaten = (q) => this.onBeaten(q);
      T.men.push(p);
    }
    if (walkTo) for (const p of T.men) { p.mode = 'walk'; p.goTo({ x: walkTo.x + (p.pos.x - x), z: walkTo.z + (p.pos.z - z) }, { gait: 'walk' }); }
    this.threes.push(T);
    if (post) post.three = T;
    return T;
  }
  drop(T) {
    for (const p of T.men) if (!p.armed && this.P.list.includes(p)) this.P.release(p);
    const i = this.threes.indexOf(T);
    if (i >= 0) this.threes.splice(i, 1);
    if (T.post) { T.post.three = null; T.post.coolT = 30; }
  }

  // ---- a man of theirs beaten in a fist fight: the others draw ---------------------------------
  onBeaten(p) {
    const T = p.gang;
    if (!T) return;
    this.hostile(T, 'beaten');
  }
  hostile(T, why) {
    if (T.hostile) return;
    T.hostile = true;
    this.stats.draws++;
    this.P.police.event('gang', { gang: T.gang, why });
    const guns = this.P.police.guns;
    // [O8] (each man's hand goes into his coat first - seen - and the gun comes out of it a breath later)
    T.men.forEach((p, i) => {
      if (!(p.standing && !p.armed && p.mode !== 'fight')) return;
      const kind = T.gang === 'docks' && i === 0 ? 'tommy' : 'pistol';
      if (!p.gesture || !p.gesture('o8_reach', 0.95)) { guns.arm(p, kind, T.gang); return; }
      p.face(this.G.eye.x, this.G.eye.z);
      this.P.later(0.5 + 0.14 * i, () => { if (p.standing && !p.armed && p.mode !== 'fight') { p.gestureName = null; guns.arm(p, kind, T.gang); } });
    });
  }

  // ---- one step: the threes on their corners, the border fight ---------------------------------
  step(dt) {
    const P = this.P, G = this.G, E = G.eye;
    this.t += dt;
    if (G.failing) return;
    // the corners near me get their three (out of my sight); far ones go
    this.postT = (this.postT || 0) - dt;
    if (this.postT <= 0) {
      this.postT = 1;
      for (const post of this.posts) {
        post.coolT = Math.max(0, post.coolT - 1);
        const d = Math.hypot(post.x - E.x, post.z - E.z);
        if (!post.three && !P.hold && d < GANG.near && d > 35 && post.coolT <= 0 && !P.inView(post.x, post.z)) this.three(post.gang, post.x, post.z, { post });
      }
      for (const T of [...this.threes]) {
        const d = Math.hypot(T.x - E.x, T.z - E.z);
        const alive = T.men.some((p) => p.standing && !p.armed);
        if ((d > GANG.gone && !P.inView(T.x, T.z)) || (!alive && d > 60 && !P.inView(T.x, T.z))) this.drop(T);
      }
    }
    // a gun drawn near a three: they draw (they see it within 22 m)
    const H = P.hands, gunOut = H.gunOut;
    for (const T of this.threes) {
      if (T.hostile || T.war) continue;
      const d = Math.hypot(T.x - E.x, T.z - E.z);
      if (gunOut && d < 22 && P.graph.lineOfSight(E.x, E.z, T.x, T.z)) { this.hostile(T, 'gun'); continue; }
      // close: they watch; closer, a word
      T.nearT = d < GANG.word ? T.nearT + dt : 0;
      if (T.nearT > 1.4 && G.time - T.sayT > 14) { T.sayT = G.time; this.stats.words++; const m = T.men.find((p) => p.standing); if (m) { m.say('o3_hey', { f0: 105 }); G.hud.say(GANG[T.gang].word, 2.2); } }
    }
    this.stepWar(dt);
  }
  stepMan(p, dt) {
    const E = this.G.eye, T = p.gang;
    if (!p.standing || p.mode === 'fight') return;
    if (T && T.war) { this.warMan(p, dt); return; }
    const d = Math.hypot(p.pos.x - E.x, p.pos.z - E.z);
    if (p.mode === 'walk') { if (!p.path) { p.mode = 'hold'; p.holdAt = { x: p.pos.x, z: p.pos.z }; } return; }
    // holding the corner: facing in, heads turning to me as I come
    if (p.holdAt && Math.hypot(p.pos.x - p.holdAt.x, p.pos.z - p.holdAt.z) > 0.8) { if (!p.path) p.goTo(p.holdAt, { gait: 'walk' }); return; }
    if (d < GANG.watch) { p.look(E); if (d < 6) p.face(E.x, E.z); }
    else { p.look(null); if (T) p.face(T.x, T.z); }
  }

  // ---- the border fight -------------------------------------------------------------------------
  war(at = null) {
    const P = this.P, E = this.G.eye;
    if (this.war_) return null;
    // (a place on the border near me, out of my sight; or where I say)
    let spot = at;
    if (!spot) {
      const cands = BORDER.map(([x, z]) => ({ x, z, d: Math.hypot(x - E.x, z - E.z) })).filter((c) => c.d > 30 && c.d < 160).sort((a, b) => a.d - b.d);
      spot = cands[0] || null;
    }
    if (!spot) return null;
    const n = P.nearestP(spot.x, spot.z);
    const x = n.x, z = n.z;
    // the two threes come from either side, 10 m apart, and meet
    const a = Math.random() * Math.PI;
    const A = this.three('docks', x + Math.sin(a) * 9, z + Math.cos(a) * 9, { walkTo: { x: x + Math.sin(a) * 1.4, z: z + Math.cos(a) * 1.4 } });
    const B = this.three('tenements', x - Math.sin(a) * 9, z - Math.cos(a) * 9, { walkTo: { x: x - Math.sin(a) * 1.4, z: z - Math.cos(a) * 1.4 } });
    const W = { x, z, A, B, t: 0, phase: 'meet', shots: 0 };
    A.war = W; B.war = W;
    this.war_ = W;
    this.stats.wars++;
    this.P.police.event('war', { x: +x.toFixed(0), z: +z.toFixed(0) });
    return W;
  }
  stepWar(dt) {
    const G = this.G, P = this.P;
    this.warT -= dt;
    const E = G.eye;
    if (this.warT <= 0 && !this.war_) {
      this.warT = GANG.warEvery[0] + Math.random() * (GANG.warEvery[1] - GANG.warEvery[0]);
      const g = P.districtOf(E.x, E.z);
      if (g === 'docks' || g === 'tenements') this.war();
    }
    const W = this.war_;
    if (!W) return;
    W.t += dt;
    const men = [...W.A.men, ...W.B.men].filter((p) => p.standing && !p.armed);
    if (W.phase === 'meet' && (W.t > 9 || W.A.men.every((p) => !p.path))) { W.phase = 'fists'; W.t = 0; this.G.emit('gang:war', { phase: 'fists', x: W.x, z: W.z }); P.crime.emit('punch', W, 'gang', { level: 0 }); }
    if (W.phase === 'fists' && W.t > 7) {
      W.phase = 'guns'; W.t = 0;
      this.G.emit('gang:war', { phase: 'guns', x: W.x, z: W.z });
      // (a crime of theirs: the street scatters, the police come to the place - no heat on me)
      P.police.gangWar(W);
    }
    // over: the last of one side down (or 30 s of it); they go
    const aUp = W.A.men.some((p) => p.standing), bUp = W.B.men.some((p) => p.standing);
    if (W.phase === 'guns' && (!aUp || !bUp || W.t > 30)) { W.phase = 'over'; W.t = 0; }
    if (W.phase === 'over' && W.t > 2) {
      for (const T of [W.A, W.B]) { T.war = null; for (const p of T.men) if (p.standing && !p.armed) { p.mode = 'walk'; p.goTo(P.awayPath(p.pos, W, 50), { gait: 'run' }); } }
      this.war_ = null;
    }
    void men;
  }
  // a man in the border fight: at the man opposite him
  warMan(p, dt) {
    const W = p.gang.war, T = p.gang;
    if (W.phase === 'meet') return;
    const foes = (T === W.A ? W.B : W.A).men.filter((q) => q.standing);
    if (!foes.length) { p.stop(); return; }
    let foe = p.foe && p.foe.standing ? p.foe : null;
    if (!foe) { foe = foes[Math.floor(Math.random() * foes.length)]; p.foe = foe; }
    const d = Math.hypot(foe.pos.x - p.pos.x, foe.pos.z - p.pos.z);
    p.face(foe.pos.x, foe.pos.z);
    p.look(foe.pos);
    if (W.phase === 'fists') {
      if (d > 1.3) { p.goTo({ x: foe.pos.x, z: foe.pos.z }, { gait: 'hurry' }); return; }
      p.stop();
      p.swingT = (p.swingT ?? Math.random()) - dt;
      if (p.swingT <= 0) {
        p.swingT = 1.1 + Math.random() * 0.9;
        try { p.c.play(Math.random() < 0.5 ? 'br_jab' : 'br_hook', { fade: 0.08 }); } catch (e) { /* */ }
        this.later(foe, 0.4, () => { try { foe.c.play(Math.random() < 0.5 ? 'br_hitHeadL' : 'br_hitBody', { fade: 0.05 }); } catch (e) { /* */ } foe.say('f_punchMe', { k: 0.6 }); });
      }
      return;
    }
    if (W.phase === 'guns') {
      // back off a few steps, gun up, a shot now and then (the street's own fight: none at me)
      if (d < 6) { p.goTo({ x: p.pos.x - (foe.pos.x - p.pos.x) / d * 3, z: p.pos.z - (foe.pos.z - p.pos.z) / d * 3 }, { gait: 'run' }); return; }
      if (!p.drawn) { p.drawn = true; this.giveGun(p); }
      p.stop();
      p.fireT = (p.fireT ?? 0.6 + Math.random() * 1.2) - dt;
      if (p.fireT <= 0) {
        p.fireT = 0.9 + Math.random() * 1.4;
        const G = this.G;
        const muzzle = p.fig.fire ? p.fig.fire() : null;
        if (muzzle) {
          const dir = new THREE.Vector3(foe.pos.x - muzzle.x, foe.pos.y + 1.2 - muzzle.y, foe.pos.z - muzzle.z).normalize();
          G.fx.flash.hood(p.fig, muzzle, dir, G.time, false);
          G.sfx.pistol(muzzle, muzzle.distanceTo(G.eye));
          W.shots++;
          if (Math.random() < 0.3) { foe.knock(dir, { dead: true, by: 'gang', why: 'shot' }); G.fx.bloodFx.hit(foe.pos.clone().setY(1.3), dir, { strength: 1, rays: G.rays }); this.P.crime.emit('death', foe.pos, 'gang', { level: 0, victim: foe }); }
        }
      }
    }
  }
  giveGun(p) {
    {
      const gun = buildProp('revolver');
      gun.traverse((o) => { if (o.isMesh) { o.userData.inkId = p.fig.inkId; o.userData.inkFigure = true; o.userData.noRay = true; } });
      try { p.c.hold(gun, 'R'); } catch (e) { p.fig.bones.handR.add(gun); }
      p.gunProp = gun;
      try { p.fig.setAim(true); } catch (e) { /* */ }
    }
  }
  later(p, s, fn) { this.P.later(s, () => { if (p.standing) fn(); }); }
}
void _v;
