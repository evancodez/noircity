import * as THREE from 'three';
import { FLOOR } from '../../city/kits/interior/kit.js';
import { counter, backBar, stool, table, chair, label, sheet, crates, litWindow } from '../../city/kits/interior/pieces.js';
import { RNG } from '../../util/rng.js';
import { buildProp } from '../../props/index.js';
import { crowdOf } from '../../combat/brawl/Crowd.js';

// The two bars (brief O5 §2.3): the Tenements' (bar1: narrow, a piano by the
// door, a tin ceiling's pressed squares, the gang's corner) and the Docks'
// (bar2: a big low room for the shifts, nets and a ship's wheel on the
// walls, a pool table, the long bar down its side). In each: a drink at the
// bar (sit, E: the glass and the bottle's amber), a card game at a back
// table to watch (E sits), two men at the bar end who fall to fighting now
// and then (they trade blows, one goes down, gets up; E at one of them steps
// in - and both turn on me: O4's crowd brawl, the bottles on the bar to hand),
// and a matchbook on the bar (E: taken, one a bar - save.matchbooks). A fist
// at anyone here is answered (Places.fist).
const DRINK = 2;
export default {
  kind: 'bar',
  spawn: { x: 0, z: -1.5, yaw: 0 },
  build(K, s, P) {
    const big = s.id === 'bar2';
    s.state.glass = false;
    const b = s.lb, R0 = new RNG(big ? 0xBA2 : 0xBA1), rng = () => R0.next();
    let x0, x1, z0;
    const z1 = -0.3;
    if (big) { x0 = -7.5; x1 = Math.min(b.x1 - 0.6, 12.5); z0 = -13.5; } else { x0 = b.x0 + 0.45; x1 = b.x1 - 0.45; z0 = b.z0 + 0.45; }
    const H = big ? 4.1 : 3.3;
    const W = P.faceWindows(s, { kinds: ['shop'], y0: 0, y1: 3, x0: x0 + 0.5, x1: x1 - 0.5 });
    K.windows = W;
    K.roomRect = { x0, x1, z0, z1 };
    K.room(x0, x1, z0, z1, { h: H, floor: 'boards', wall: big ? 'concrete' : 'plaster', ceil: big ? 'dark' : 'paper', look: { haze: 0.75, ambient: 0.5, room: 'o5_bar' }, sides: { s: { holes: [...P.doorHoles(s, 's'), ...P.windowHoles(W)] } } });
    K.box('wood', x0, x1, FLOOR, FLOOR + 1.1, z0, z0 + 0.04, 0);
    // the bar: across the back (bar1) or down the right side (bar2)
    const bar = {};
    if (big) {
      const bx0 = x1 - 3.0, bz0 = z0 + 1.0, bz1 = -3.2;
      counter(K, bx0, bx0 + 0.65, bz0, bz1, { dir: 'w', h: 1.08 });
      backBar(K, bz0 + 0.5, bz1 - 0.3, x1, { dir: 'w', rows: 3, rng });
      // (a back bar along a side wall: pieces.backBar runs along x; turn it by drawing a second along z)
      bar.stools = []; for (let z = bz0 + 0.7; z < bz1 - 0.4; z += 1.1) { stool(K, bx0 - 0.75, z); bar.stools.push([bx0 - 0.75, z]); }
      bar.top = (z) => [bx0 + 0.2, FLOOR + 1.1, z]; bar.face = Math.PI / 2; bar.end = [bx0 - 0.9, bz1 + 0.6];
      bar.keep = [bx0 + 1.6, (bz0 + bz1) / 2, -Math.PI / 2];
      for (let i = 0; i < 4; i++) K.lamp(bx0 - 0.2, FLOOR + 2.9, bz0 + (bz1 - bz0) * (i + 0.5) / 4, { kind: 'pendant', power: 0.8, ceilY: FLOOR + H });
    } else {
      const bz = z0 + 1.6, bxa = x0 + 2.4, bxb = x1 - 0.3;
      counter(K, bxa, bxb, bz - 0.6, bz, { dir: 's', h: 1.08 });
      backBar(K, bxa, bxb, z0, { dir: 's', rows: 3, rng });
      bar.stools = []; for (let x = bxa + 0.5; x < bxb - 0.3; x += 1.0) { stool(K, x, bz + 0.65); bar.stools.push([x, bz + 0.65]); }
      bar.top = (x) => [x, FLOOR + 1.1, bz - 0.25]; bar.face = 0; bar.end = [bxa + 0.2, bz + 1.4];
      bar.keep = [(bxa + bxb) / 2, z0 + 0.9, Math.PI];
      for (let i = 0; i < 3; i++) K.lamp(bxa + (bxb - bxa) * (i + 0.5) / 3, FLOOR + 2.45, bz - 0.1, { kind: 'pendant', power: 0.75, ceilY: FLOOR + H });
      // the tin ceiling's pressed squares
      for (let x = x0 + 0.6; x < x1 - 0.3; x += 1.2) for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.2) K.box('plaster', x - 0.45, x + 0.45, FLOOR + H - 0.04, FLOOR + H, z - 0.45, z + 0.45, 0);
    }
    // the card game at a back table (its own low lamp)
    const ct = big ? [x0 + 2.6, z0 + 2.6] : [x0 + 1.15, z0 + 1.3];
    table(K, ct[0], ct[1], { round: true, w: 1.1, h: 0.74 });
    K.lamp(ct[0], FLOOR + 1.75, ct[1], { kind: 'pendant', power: 0.6, ceilY: FLOOR + H, drop: 1.0 });
    for (let i = 0; i < 6; i++) { const a = i * 1.05; K.box('linen', ct[0] + Math.cos(a) * 0.25 - 0.04, ct[0] + Math.cos(a) * 0.25 + 0.04, FLOOR + 0.745, FLOOR + 0.75, ct[1] + Math.sin(a) * 0.25 - 0.06, ct[1] + Math.sin(a) * 0.25 + 0.06, 3); }
    const players = big ? [[0.75, 0], [-0.75, 0], [0, -0.75]] : [[0.75, 0], [0, -0.75]];
    players.forEach(([dx, dz], i) => { chair(K, ct[0] + dx, ct[1] + dz, Math.atan2(-dx, -dz) + Math.PI, { solid: false }); K.post(ct[0] + dx, ct[1] + dz, 0.25); K.fig(i === 0 ? 'docker' : 'dockhand', ct[0] + dx, ct[1] + dz, Math.atan2(-dx, -dz), { name: 'cards' + i, state: i ? 'sitSmoke' : 'sitTalk', seat: { y: FLOOR + 0.47, name: 'stool' } }); });
    // my chair at the table: E sits me to watch the hand
    const mx = ct[0] + (big ? 0 : -0.05), mz = ct[1] + 0.8;
    chair(K, mx, mz, Math.PI, { solid: false });
    K.seat({ name: 'cards', x: mx, z: mz, yaw: 0, eyeY: FLOOR + 1.22, at: [mx, FLOOR + 0.6, mz], prompt: 'watch the game', pitch: -0.3, standAt: { x: mx + 0.2, z: mz + 0.7, yaw: 0 },
      onSit: () => { P.game.hud.message(big ? 'Stud. Nobody looks up.' : 'Five-card draw. Pennies.', 2.0); P.game.sfx.play('newspaper', K.F.v(ct[0], FLOOR + 0.8, ct[1]), {}, { ref: 2 }); } });
    // tables, chairs
    const T = big ? [[-4.5, -5.0], [-1.5, -5.0], [1.5, -5.0], [-4.5, -8.6], [-1.5, -8.6], [1.6, -9.2]] : [];
    for (const [tx, tz] of T) { table(K, tx, tz, { round: true, w: 0.8 }); chair(K, tx + 0.65, tz, -Math.PI / 2); chair(K, tx - 0.65, tz, Math.PI / 2); }
    for (const w of W) { table(K, w.lx, -1.2, { round: true, w: 0.7 }); chair(K, w.lx, -2.0, Math.PI); }
    for (let i = 0; i < T.length; i += 2) K.lamp(T[i][0], FLOOR + 2.9, T[i][1], { kind: 'bare', power: 0.4, ceilY: FLOOR + H });
    // what each bar has on its walls and floor
    if (big) {
      // a pool table under its lamp; nets and a ship's wheel on the walls; crates by the back door
      const px = 1.5, pz = -11.2;
      K.box('wood', px - 1.35, px + 1.35, FLOOR, FLOOR + 0.72, pz - 0.75, pz + 0.75, 1);
      K.box('cloth', px - 1.2, px + 1.2, FLOOR + 0.72, FLOOR + 0.8, pz - 0.6, pz + 0.6, 1);
      K.solid(px - 1.35, px + 1.35, pz - 0.75, pz + 0.75);
      K.lamp(px, FLOOR + 1.9, pz, { kind: 'pendant', power: 0.7, ceilY: FLOOR + H, drop: 1.1 });
      for (let i = 0; i < 4; i++) { const z = -3 - i * 2.5; K.box('rope', x0 + 0.02, x0 + 0.06, FLOOR + 1.6, FLOOR + 3.2, z - 0.9, z + 0.9, 3); }
      const wheel = new THREE.TorusGeometry(0.42, 0.04, 6, 20).translate(0, 0, 0);
      K.add('wood', wheel.translate(-2.0, FLOOR + 2.4, z0 + 0.06), 2);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; K.add('wood', new THREE.BoxGeometry(0.03, 1.1, 0.03).rotateZ(a).translate(-2.0, FLOOR + 2.4, z0 + 0.08), 2); }
      crates(K, x0 + 0.6, z0 + 0.6, { n: 2, s: 0.8, rng });
      label(K, 'NO CREDIT', -4.8, FLOOR + 2.4, z0, { w: 1.4, h: 0.4, dir: 's', lit: true });
    } else {
      // the piano by the door; a mirror; the gang's photographs
      const px = x0 + 0.45, pz = -2.4;
      K.box('wood', px - 0.35, px + 0.35, FLOOR, FLOOR + 1.3, pz - 0.75, pz + 0.75, 1);
      K.box('linen', px + 0.3, px + 0.42, FLOOR + 0.72, FLOOR + 0.76, pz - 0.65, pz + 0.65, 1);
      K.solid(px - 0.35, px + 0.42, pz - 0.75, pz + 0.75);
      // [O5b] (brief O5b §3: the bar's second stroke) a man at the piano: from eleven he plays his set (an
      // hour on, an hour off: the night begins at eleven), between sets he smokes on his stool
      stool(K, px + 0.95, pz, { h: 0.5 });
      K.fig('oldman', px + 0.95, pz, -Math.PI / 2, { name: 'pianist', state: 'sitTalk', seat: { y: FLOOR + 0.52, name: 'stool' } });
      K.piano = { x: px + 0.36, y: FLOOR + 0.9, z: pz };
      K.use({ at: [px + 0.36, FLOOR + 0.8, pz], prompt: 'the piano', onUse: () => {
        const G = P.game, pl = s.live && s.live.run && s.live.run.playing;
        if (pl) { G.hud.message('He nods. He does not stop.', 1.8); return; }
        G.sfx.play('o5b_piano', K.F.v(px, FLOOR + 0.9, pz), { f: 196, k: 0.8, out: 1 }, { ref: 2 });
        G.sfx.play('o5b_piano', K.F.v(px, FLOOR + 0.9, pz), { f: 233, k: 0.6, out: 1 }, { ref: 2 });
        G.hud.message('Out of tune. Somebody laughs.', 1.8);
      } });
      for (let i = 0; i < 3; i++) sheet(K, -4.0 - i * 0.7 + (x0 < -4 ? 0 : 0), FLOOR + 1.9, x0, { w: 0.4, h: 0.5, dir: 'e' });
      litWindow(K, (x0 + x1) / 2, FLOOR + 2.1, z0, { w: 1.6, h: 0.5, dir: 's', key: 'litDim' });
      label(K, 'NO TAB', x1 - 0.02, FLOOR + 2.2, -3.0, { w: 0.9, h: 0.36, dir: 'w', lit: true });
    }
    // the barman behind the bar; two men at the bar's end (the ones who fight)
    K.fig('oldman', bar.keep[0], bar.keep[1], bar.keep[2], { name: 'barman', state: 'wipe' });
    K.bar = bar;
    const e = bar.end;
    K.fig('docker', e[0] - 0.35, e[1], Math.PI / 2, { name: 'drunkA', state: 'idle' });
    K.fig('dockhand', e[0] + 0.35, e[1] + 0.05, -Math.PI / 2, { name: 'drunkB', state: 'idle' });
    // two bottles on the bar by them: a fight's things (O4's crowd takes them by E)
    s.live.things = [];
    for (const [i, d] of [[0, -0.25], [1, 0.3]]) {
      const t = bar.top(big ? e[1] + d : e[0] + 0.6 + d), o = buildProp('bottle', { variant: 'beer' });
      o.position.copy(K.F.v(t[0], t[1] - 0.02, t[2])); o.traverse((m) => { if (m.isMesh) m.userData.inkId = K.id + 3; });
      K.group.add(o);
      const it = { kind: 'bottle', name: `${s.id}_bottle${i}`, object: o, taken: false };
      it.take = () => { it.taken = true; if (o.parent) o.parent.remove(o); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); return o; };
      it.available = () => !it.taken;
      s.live.things.push(it);
    }
    // a drink at the bar: sit on a stool, E
    for (const [sx, sz] of bar.stools.slice(1, -1)) {
      const S = K.seat({ name: `stool${Math.round(sx * 10)}_${Math.round(sz * 10)}`, x: sx, z: sz, yaw: big ? -Math.PI / 2 : 0, eyeY: FLOOR + 1.62, at: [sx, FLOOR + 0.8, sz], range: 1.7, cone: 0.38, prompt: 'sit at the bar',   // [O5b] (the critic's minor 10: a stool takes E only looked at, close - never past the barman)
      standAt: big ? { x: sx - 0.7, z: sz, yaw: -Math.PI / 2 } : { x: sx, z: sz + 0.7, yaw: 0 } });
      const top = bar.top(big ? sz : sx);
      K.use({ seated: S, at: top, range: 1.7, cone: 0.7, prompt: () => (s.state.glass ? 'drink' : s.state.sore ? 'the barman' : `a whiskey: $${DRINK}`), onUse: () => drink(K, s, P, top) });
    }
    // the matchbook at the bar's end (one a bar)
    const mt = bar.top(big ? bar.stools[0][1] : bar.stools[0][0]);
    if (!(P.game.save.matchbooks || []).includes(s.id)) {
      const mb = K.prop('matchbook', mt[0], mt[1] - 0.01, mt[2], 0.5, { name: 'matchbook' });
      K.use({ at: [mt[0], mt[1], mt[2]], range: 2.3, cone: 0.45, prompt: 'a matchbook', when: () => mb.o.visible, onUse: () => {
        mb.o.visible = false;
        const L = P.game.save.matchbooks; if (!L.includes(s.id)) L.push(s.id);
        P.game.sfx.play('matchbook', null, {}, { ref: 1 });
        P.game.hud.message(`A matchbook. ${L.length} of 2.`, 2.0);
        P.game.emit('matchbook', { id: s.id, n: L.length });
      } });
    }
  },
  live(K, s, P) { return barLife(K, s, P); },
};

function drink(K, s, P, top) {
  const G = P.game;
  if (s.state.glass) { G.sfx.play('sip', null, {}, { ref: 1 }); G.hud.message('It burns going down.', 1.4); G.health.hp = Math.min(100, G.health.hp + 15); s.state.glass = false; if (K._glass) K._glass.o.visible = false; return; }
  if (!P.buy(s, DRINK, 'whiskey', 'The barman pours. One. On the house.')) return;
  s.state.glass = true;
  K._glass = K.prop('tumbler', top[0], top[1] - 0.02, top[2], 0, { name: 'glass' });
  K._bottle = K.prop('bottle', top[0] + 0.22, top[1] - 0.02, top[2] - 0.08, 0.4, { variant: 'scotch', name: 'bottle' });
  G.sfx.play('pour', K.F.v(top[0], top[1], top[2]), {}, { ref: 2 });
}

// the two men at the bar's end: now and then they fall to fighting (a shove,
// blows traded, one goes down and gets up a while later); E at one steps in
// [O5b] the pianist's set: a slow blues, the left hand walking, the right hand's chords on two and
// four and a lick now and then; each note the procedural piano's (o5b_piano), a little out of tune
const BLUES = [0, 0, 5, 0, 7, 5, 0, 7];   // (the bars' roots, semitones over G)
const WALK = [0, 4, 7, 9, 10, 9, 7, 4];
function pianoSet(K, s, P) {
  const G = P.game;
  const hz = (semi) => 98 * Math.pow(2, semi / 12);
  const st = { t: 0, beat: 0, on: false };
  const at = () => K.F.v(K.piano.x, K.piano.y, K.piano.z);
  const note = (semi, k, oct = 1) => { try { G.sfx.play('o5b_piano', at(), { f: hz(semi) * oct, k, out: (Math.random() - 0.5) * 0.03 }, { ref: 3 }); } catch (e) { /* */ } };
  return {
    get on() { return st.on; },
    step(dt, playing) {
      st.on = playing;
      if (!playing) { st.t = 0; return; }
      st.t -= dt;
      if (st.t > 0) return;
      // a swung beat: long, short
      const b = st.beat++, bar = Math.floor(b / 4) % BLUES.length, r = BLUES[bar], k = b % 4;
      st.t = (b % 2 ? 0.27 : 0.43);
      note(r + WALK[(b * 2) % WALK.length] - 12, 0.55);
      if (k === 1 || k === 3) for (const c of [4, 10, 15]) note(r + c, 0.3);
      if (k === 2 && Math.random() < 0.35) { const lick = [15, 17, 18, 19, 22][Math.floor(Math.random() * 5)]; note(r + lick, 0.35); }
    },
  };
}

function barLife(K, s, P) {
  const G = P.game, Cr = crowdOf(G);
  const piano = K.piano ? pianoSet(K, s, P) : null;
  let playing = null;
  const st = { t: 0, next: 25 + Math.random() * 20, fight: null, mine: false, pend: [] };
  const man = (n) => s.live.cast.find((c) => c.name === `${s.id}_${n}`);
  const later = (secs, fn) => st.pend.push({ t: secs, fn });
  const run = {
    get playing() { return !!(piano && piano.on); },
    step(dt) {
      // [O5b] the pianist: his set by the night's hour (eleven, one, three), his hands' state; a fist,
      // a shot, a brawl in the room stops him
      if (piano) {
        const c = man('pianist'), hr = G.night && G.night.clock ? G.night.clock.hour : 23;
        const set = (hr === 23 || hr === 1 || hr === 3) && c && c.alive && !c.down && !s.state.sore && !Cr.active;
        if (c && set !== playing) { playing = set; try { c.setState(set ? 'sitTalk' : 'sitSmoke', 0.5); } catch (e) { /* */ } }
        piano.step(dt, !!set && P.inside === s);
      }
      for (const p of [...st.pend]) { p.t -= dt; if (p.t <= 0) { st.pend.splice(st.pend.indexOf(p), 1); try { p.fn(); } catch (e) { /* a man gone */ } } }
      const A = man('drunkA'), B = man('drunkB');
      // (my fight with them is O4's crowd's: when it is over they are where it left them)
      if (st.mine) { if (!Cr.active) st.mine = false; return; }
      if (!A || !B || !A.alive || !B.alive || A.down || B.down) return;
      if (P.inside !== s || Cr.active) return;
      st.t += dt;
      if (run.__forceNext) { run.__forceNext = false; st.t = st.next; }
      if (!st.fight && st.t > st.next) {
        st.fight = { t: 0, n: 0, next: 0.6 };
        A.lookAt(null); B.lookAt(null);
        A.setState('br_guard', 0.3); B.setState('br_guard', 0.3);
        G.stage.cast.attention(A.pos.clone().setY(1.5), 3);
        P.crime('brawl', A.pos.clone(), 1);
        G.hud.message('A fight at the bar.', 1.6);
      }
      const F = st.fight;
      if (!F) return;
      F.t += dt;
      if (F.done) {
        // (the loser comes round and gets up; they go back to their drinks)
        if (F.t > F.done + 7) { const L = F.loser; L.down = false; A.setState('idle', 0.5); B.setState('idle', 0.4); st.fight = null; st.t = 0; st.next = 70 + Math.random() * 40; }
        return;
      }
      if (F.t > F.next) {
        const hit = F.n % 2 ? A : B, by = F.n % 2 ? B : A;
        by.play(F.n % 3 === 2 ? 'br_hook' : 'br_jab', { fade: 0.1 });
        later(0.38, () => { hit.play(F.n % 2 ? 'br_hitHeadL' : 'br_hitHeadR', { fade: 0.05 }); G.sfx.play('f_heavy', hit.pos.clone().setY(1.6), { k: 0.5 }, { ref: 3 }); });
        F.n++; F.next = F.t + 0.9 + Math.random() * 0.7;
        if (F.n >= 6) { F.done = F.t + 0.6; F.loser = hit; later(0.6, () => { hit.play('koFall', { fade: 0.1, hold: true }); hit.down = true; G.sfx.play('f_bodyFloor', hit.pos.clone(), {}, { ref: 3 }); }); }
      }
    },
    // E at a fighter: I step in - and both of them turn on me (O4's crowd brawl, Places.brawl)
    stepIn(c) {
      const A = man('drunkA'), B = man('drunkB');
      st.mine = true; st.fight = null;
      for (const m of [A, B]) if (m) { m.down = false; }
      P.brawl(s, [c, c === A ? B : A].filter(Boolean));
    },
    dispose() { if (st.mine && Cr.active) Cr.stop('gone'); },
  };
  for (const n of ['drunkA', 'drunkB']) K.use({ atFn: () => { const c = man(n); return c ? c.pos.clone().setY(1.4) : null; }, range: 2.2, cone: 0.5, prompt: 'step in', when: () => !!st.fight && !st.fight.done && !Cr.active, onUse: () => run.stepIn(man(n)) });
  // (uses added after the wiring: wire them now)
  P.wireLate(s);
  return run;
}
