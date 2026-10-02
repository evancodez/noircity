import * as THREE from 'three';
import { addGunClips } from '../gunClips.js';
import { chooseDeath } from '../../guns/deaths.js';
addGunClips();

// The gunman (lane C2): a brain for any room or street, from the data the
// stage gives (its nav grid, its cover, its doors), never from marks per man.
// Spawned through the gun kit (src/guns/Guns.js spawn): brain 'gunman',
// { kind: 'pistol' | 'tommy' | 'rusher', entry: { at, door?, path }, wake }.
//
// HE IS DANGEROUS, AND FAIR BY TIME, NOT BY LUCK. With a clear line on me he
// raises the gun - the tell: the arm comes up, a glint on the barrel, the
// hammer's click (RAISE) - then settles his aim (SETTLE, longer far off, when
// I move across his line, when a round has just come near him), then fires;
// a settled round at a man standing still in the open hits. His aim trails
// a moving target (LAG): moving across his line is an answer; ducking out of
// it spoils the settle (it drains while he has no line). No hidden misses.
// HE USES THE ROOM: cover to cover (crouched behind what is low, standing
// behind what is tall), out to shoot (risen, or a step to the side) and back,
// reloads behind it, moves when he is seen in it, when I have his angle.
// THEY WORK TOGETHER (the kit's director, Guns.js): at most N fire at once;
// one goes round (goFlank) while the others keep my head down.
// THE KINDS: the pistol man (the above); the Tommy gunner (he pins: long
// bursts at where I went down, chewing my cover; after each burst the drum
// is changed, out loud: my moment); the rusher (the heavy: walks at me
// firing, takes more, stops a moment at each hit, must be answered before
// he is at my cover).
//
// The numbers, in one table (a chapter may turn three of them: GUNMAN.settle,
// .pistol.dmg and the director's maxFiring - docs/story/seams/GUNS.md):
export const GUNMAN = {
  raise: 0.26,                 // s: the tell - the arm comes up, the glint, the click
  settle: [0.4, 0.9],          // s: his aim settling, at 3 m .. at 18 m
  settleMoving: 1.4,           // x while I move across his line
  settleRattled: 1.5,          // x for 1.5 s after a round came near him or hit him
  notice: 0.25,                // s: I come up (or out) into his line: he sees me, then settles
  lagT: 0.2,                   // s: his aim trails a moving target by this much
  sigma: 0.0055,               // rad: a settled round's throw (a still man in the open is hit)
  lost: 0.6,                   // s: a full settle drains in this while I am out of his line
  wait: [0.5, 1.3],            // s: behind cover between his times out
  watch: 1.3,                  // s: he holds his aim on where I went down before going back
  walk: 1.5, run: 3.0,
  pistol: { hp: 100, dmg: 17, mag: 7, burst: [2, 3], gap: [0.4, 0.52], reload: 1.7 },
  tommy: { hp: 120, dmg: 8, burst: [10, 14], rate: 10.5, climb: 0.0035, sigma0: 0.01, drum: 2.6 },
  rusher: { hp: 300, dmg: 10, burst: [5, 8], rate: 9, every: 1.2, close: 2.4, hitStop: 0.35, walk: 1.3 },
};
const T = GUNMAN;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v = V(0, 0, 0);

export default {
  name: 'gunman',
  create(game, hood, opts) {
    const B = opts.body, G = game, h = hood, r = B.rng;
    const kind = opts.kind || (opts.heavy ? 'tommy' : 'pistol');
    const K = T[kind];
    const kit = () => G.guns;
    const S = {
      state: opts.way ? 'wait' : 'hold', t: 0, wait: opts.wait ?? 0,
      cover: null, fire: null, settle: 0, raiseT: 0, lineT: 0, lostT: 0, losT: 0, line: false,
      aimP: V(0, 0, 0), aimOk: false, target: null, rattledT: 0, shots: 0, shotT: 0, mag: kind === 'pistol' ? K.mag : 999,
      entry: opts.way ? { ...opts.way, i: 0, opened: false, framed: 0 } : null,
      flank: null, lastSeen: null, burstN: 0, stopT: 0, coverT: 0, low: false,
    };
    const brain = {
      kind, S,
      get state() { return kind + ':' + S.state; },
      get hasLine() { return S.line && h.alive; },
      get flanking() { return !!S.flank; },
      // ---- the kit's director asks -------------------------------------------------------
      canFlank() { return (kind === 'pistol' || (kind === 'tommy' && alone())) && !S.flank && (S.state === 'hold' || S.state === 'back' || S.state === 'move' || S.state === 'open') && S.mag > 2 && !S.entry; },
      goFlank(spot) {
        S.flank = spot; brain.drop();
        // (his cover let go: he fights from where the flank takes him)
        if (S.cover) { S.cover.taken = null; S.cover = null; S.fire = null; }
        moveTo(spot.x, spot.z, true); S.state = 'move';
        G.sfx.play('c2_flank', h.pos.clone().setY(h.pos.y + 1.0), {}, { ref: 3 });
      },
      shotNear(k) { S.rattledT = 1.5; S.settle *= 1 - k * 0.6; },
      playerDown() { brain.drop(); if (S.state === 'aim' || S.state === 'fire') { S.state = 'watch'; S.t = 0; } },
      drop() { const K2 = kit(); if (K2) K2.drop(B); },
      onHit(dir) {
        S.settleKeep = S.settle; S.settle = 0; S.rattledT = 1.5;
        if (kind === 'rusher') { S.stopT = K.hitStop; S.settle = Math.max(0, (S.settleKeep || 0) * 0.5); return; }
        // (hit: he is knocked off his aim; back down behind his cover)
        if (S.state === 'aim' || S.state === 'fire') { brain.drop(); S.state = 'back'; S.t = 0; }
        S.wait = r.range(0.8, 1.4);
        void dir;
      },
      release() { brain.drop(); if (S.cover) S.cover.taken = null; },
      // (Game.killHood asks: the fall by what is beside him)
      deathKind(dir, head, kind0) { return chooseDeath(G, h, dir, head, kind0); },
      pickCover: (pref) => pickCover(pref),   // (for the plays and the probes: where he would go now)
      update(dt, t) { if (!h.alive) return; step(dt, t); },
    };

    // ---- what he sees -----------------------------------------------------------------------
    const headY = () => h.pos.y + (S.low && S.state !== 'aim' && S.state !== 'fire' ? 1.0 : 1.58) * h.scale;
    const eyeOf = (out = V(0, 0, 0)) => out.set(h.pos.x, headY(), h.pos.z);
    // the point of me he can see (my chest, my head, my belly), or null
    const visiblePoint = () => {
      const Kt = kit(), Bd = Kt.playerBody(), e = eyeOf(_e);
      for (const p of [Bd.chest, Bd.head, Bd.belly]) if (Kt.see(e, p, 0.15)) return p;
      return null;
    };
    const _e = V(0, 0, 0);
    // (a look every 0.1 - 0.15 s: the line, where he last saw me, his aim's trail)
    const look = (dt) => {
      S.losT -= dt;
      if (S.losT <= 0) {
        S.losT = r.range(0.09, 0.15);
        const p = G.health.dead ? null : visiblePoint();
        S.line = !!p;
        if (p) { S.target = p.clone(); S.lastSeen = { p: p.clone(), t: G.time }; }
      }
      if (S.line && S.target) {
        // the trailing aim: snapped on when he first has me, then following
        if (!S.aimOk) { S.aimP.copy(S.target); S.aimOk = true; }
        else S.aimP.lerp(S.target, 1 - Math.exp(-dt / T.lagT));
        S.lineT += dt; S.lostT = 0;
      } else { S.lostT += dt; if (S.lostT > 0.3) S.lineT = 0; if (S.lostT > 1.2) S.aimOk = false; }
    };
    const dist = () => Math.hypot(G.eye.x - h.pos.x, G.eye.z - h.pos.z);
    const alone = () => { for (const o of G.ais.keys()) if (o !== h && o.alive) return false; return true; };
    const settleTime = () => {
      const d = dist();
      let s = T.settle[0] + (T.settle[1] - T.settle[0]) * Math.min(1, Math.max(0, (d - 3) / 15));
      // (my move across his line: the eye's speed across it)
      const v = G.controller.vel, dx = G.eye.x - h.pos.x, dz = G.eye.z - h.pos.z, L = Math.hypot(dx, dz) || 1;
      const across = Math.abs(v.x * (-dz / L) + v.z * (dx / L));
      if (across > 1.0) s *= T.settleMoving;
      if (S.rattledT > 0) s *= T.settleRattled;
      const Kc = kit() && kit().cfg;
      return s * (Kc && Kc.settleK ? Kc.settleK : 1);
    };
    // (I come up over cover or out round it: he sees me a moment late; standing in the room I am seen at once)
    const noticeOf = () => ((G.controller.crouchK || 0) > 0.5 ? T.notice : T.notice * 0.3);
    const face = (dt, rate = 6) => { const p = S.target || G.eye; B.faceTo(p.x, p.z, dt, rate); };

    // ---- moving --------------------------------------------------------------------------------
    const moveTo = (x, z, run) => {
      if (!B.go(x, z, run)) { B.path = [V(x, 0, z)]; B.pathI = 0; B.run = run; }
      B.stuckT = 0; B.lastPos.copy(h.pos);
      h.setAim(false);
    };
    // (the body's path walking: turns, 1.5 m/s walking, 2.9 running, a new
    // path when he is stuck; the colliders keep him out of everything)
    const follow = (dt) => B.follow(dt);
    const stand = (crouch) => {
      h.speed = 0;
      S.low = !!crouch;
      const want = crouch ? 'kneel' : 'idle';
      if (h.state !== want && h.state !== 'stagger') h.setState(want, 0.22);
    };

    // ---- his cover ------------------------------------------------------------------------------
    // pref: { near: {x, z} (prefer cover close to it), side: {x, z}, door } -
    // the cover on this side of that door (a man working a doorway)
    const pickCover = (pref = null) => {
      const Kt = kit(), C = Kt.covers, e = G.eye, nav = G.nav;
      if (!C || !C.points.length) return null;
      const others = [...G.ais.values()].filter((a) => a !== B && a.h && a.h.alive && a.brain && a.brain.S && a.brain.S.cover).map((a) => a.brain.S.cover);
      const want = pref && pref.advance ? 4.2 : kind === 'tommy' ? 8 : 6.5;
      let sideOf = null;
      if (pref && pref.door) {
        const D = pref.door, o = D.spec.outside, i = D.spec.inside;
        const nx = o.x - i.x, nz = o.z - i.z, c0 = D.centre;
        sideOf = (p) => Math.sign((p.x - c0.x) * nx + (p.z - c0.z) * nz);
        sideOf.want = sideOf(pref.side);
      }
      const cands = [];
      for (const p of C.points) {
        if (p.taken && p.taken !== B) continue;
        if (pref && pref.advance && p === S.cover) continue;
        const d = Math.hypot(p.x - e.x, p.z - e.z);
        if (d < 3.2 || d > 17) continue;
        if (pref && pref.advance && S.cover && d > Math.hypot(S.cover.x - e.x, S.cover.z - e.z) - 1) continue;
        if (sideOf && (sideOf(p) !== sideOf.want || Math.hypot(p.x - pref.near.x, p.z - pref.near.z) > 2.6)) continue;
        const travel = Math.hypot(p.x - h.pos.x, p.z - h.pos.z);
        if (travel > 14) continue;
        let crowd = 0;
        for (const o of others) {
          if (Math.hypot(o.x - p.x, o.z - p.z) < 2.2) crowd += 4;
          // (spread round me: not all on one line)
          const a1 = Math.atan2(o.x - e.x, o.z - e.z), a2 = Math.atan2(p.x - e.x, p.z - e.z);
          if (Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) < 0.35) crowd += 1.5;
        }
        cands.push({ p, pre: travel * 0.3 + Math.abs(d - want) * 0.35 + crowd + r.next() * 0.6 });
      }
      cands.sort((a, b) => a.pre - b.pre);
      let best = null;
      const why = S.pickWhy = { n: cands.length, open: 0, nofire: 0, nopath: 0 };
      let paths = 0;
      for (const c of cands.slice(0, 32)) {
        if (paths >= 8) break;
        if (best && c.pre > best.score) break;
        const st = C.state(c.p, e);
        if (st === 'open') { why.open++; continue; }
        const f = C.fire(c.p, e, st);
        if (!f) { why.nofire++; continue; }
        // (the way there: by the nav grid, not as the crow flies through a wall)
        paths++;
        const path = nav.findPath(h.pos.x, h.pos.z, c.p.x, c.p.z, 16000);
        if (!path) { why.nopath++; continue; }
        let L = 0, px = h.pos.x, pz = h.pos.z;
        for (const q of path) { L += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
        const score = c.pre + (L - Math.hypot(c.p.x - h.pos.x, c.p.z - h.pos.z)) * 0.3 - (st === 'tall' ? 0.4 : 0);
        if (!best || score < best.score) best = { p: c.p, st, f, score };
      }
      return best;
    };
    const takeCover = (run, pref = null) => {
      const c = pickCover(pref);
      if (S.cover) S.cover.taken = null;
      if (!c) { S.cover = null; S.fire = null; return false; }
      c.p.taken = B;
      S.cover = c.p; S.fire = c.f; S.fireFrom = { x: G.eye.x, z: G.eye.z }; S.coverLow = c.st === 'low';
      moveTo(c.p.x, c.p.z, run);
      S.state = 'move'; S.t = 0;
      return true;
    };
    // is my cover still cover (from where the player is now)?
    const coverHolds = () => {
      if (!S.cover) return false;
      const st = kit().covers.state(S.cover, G.eye);
      if (st === 'open') return false;
      S.coverLow = st === 'low';
      // (where he shoots from, judged again when I have moved: a spot that had me may not now)
      if (!S.fire || !S.fireFrom || Math.hypot(G.eye.x - S.fireFrom.x, G.eye.z - S.fireFrom.z) > 0.8) { S.fire = kit().covers.fire(S.cover, G.eye, st); S.fireFrom = { x: G.eye.x, z: G.eye.z }; }
      return !!S.fire;
    };

    // (on his way, in the open, with me standing in his line near enough: he
    // stops and shoots - the gun up, the settle, as ever - then goes on)
    const snap = (dt) => {
      if (kind === 'rusher' || S.flank || (G.controller.crouchK || 0) > 0.5) return false;
      if (!S.line || S.lineT < 0.3 || dist() > 9 || G.time - (S.snapT || -9) < 3) return false;
      if (!kit().token(B)) return false;
      S.snapT = G.time; B.path = null; S.resume = S.state === 'entry' ? 'entry' : 'move';
      raise();
      return true;
    };
    // ---- his gun ------------------------------------------------------------------------------------
    const glint = () => {
      const m = h.muzzleWorld(V(0, 0, 0));
      G.fx.sparks.spawn({ pos: m, life: 0.12, size: [0.07, 0.07], rot: r.next() * 6.28, col: [3.5, 3.5, 3.5], alpha: 1, cell: 7, fadeOut: 0.6 });
      G.sfx.play(kind === 'pistol' ? 'c2_cock' : 'c2_bolt', m, {}, { ref: 3, roll: 1.3 });
    };
    // (raised: how long the gun has been coming up already - a step out with it up)
    const raise = (raised = 0) => {
      const from = S.state;
      S.peeks = (S.peeks || 0) + 1;
      S.state = 'aim'; S.t = 0; S.raiseT = Math.min(T.raise, raised); S.low = false;
      h.setState('aim', T.raise * 0.9);
      h.lookAt(S.target || G.eye);
      if (!raised) glint();
      const Kt = kit();
      if (Kt) Kt.events.push({ t: +G.time.toFixed(2), what: 'raise', kind, from, at: [+h.pos.x.toFixed(2), +h.pos.z.toFixed(2)], line: S.line });
    };
    const shoot = (suppress = false) => {
      const Kt = kit();
      const tgt = suppress ? (S.lastSeen ? S.lastSeen.p : G.eye) : S.aimP;
      let sigma = T.sigma;
      let dmg = K.dmg * ((Kt.cfg && Kt.cfg.dmgK) || 1);
      if (kind !== 'pistol') { sigma = K.sigma0 ?? 0.012; sigma += (S.burstN || 0) * (K.climb ?? 0.004); }
      if (suppress) sigma += 0.02;
      Kt.hoodRound(B, tgt, sigma, dmg, { tommy: kind !== 'pistol' });
      h.fire();
      B.lastShot = G.time;
      S.burstN = (S.burstN || 0) + 1;
      if (kind === 'pistol') S.mag--;
    };

    // ---- one step --------------------------------------------------------------------------------
    function step(dt, t) {
      void t;
      const Kt = kit();
      if (!Kt || !Kt.active) { h.speed = 0; return; }
      if (h.state === 'stagger') { h.speed = 0; return; }
      S.t += dt;
      S.rattledT = Math.max(0, S.rattledT - dt);
      if (G.health.dead && S.state !== 'watch') { brain.playerDown(); }
      look(dt);
      switch (S.state) {
        case 'wait': {
          h.speed = 0;
          S.wait -= dt;
          const w = opts.start;
          const awake = S.wait <= 0 && (!w || (typeof w === 'function' ? w(G, h) : true));
          if (awake) { S.state = 'entry'; S.t = 0; if (kind === 'tommy') S.lastSeen = { p: kit().playerBody().chest.clone(), t: G.time }; }
          break;
        }
        // his way in, step by step: points walked to; a door gone up to from
        // his side, opened (it moves: he pushes it), through, a moment
        // standing in its frame (exposed: fair for me too) - and when the
        // doorway is taken by the man before him, he waits his turn
        case 'entry': {
          const E = S.entry, steps = E.steps || [];
          const st = steps[E.i];
          const near = (p, d) => Math.hypot(h.pos.x - p.x, h.pos.z - p.z) < d;
          if (!st) {
            S.entry = null;
            if (kind === 'rusher') { S.state = 'rush'; S.t = 0; break; }
            if (!takeCover(true)) { S.state = 'open'; S.t = 0; }
            break;
          }
          if (!st.door) {
            if (snap(dt)) break;
            if (!B.path) moveTo(st.x, st.z, !!st.run);
            if (follow(dt) || near(st, 0.35)) { B.path = null; E.i++; }
            break;
          }
          const D = Kt.door(st.door);
          if (!D) { E.i++; break; }
          const last = !steps.slice(E.i + 1).some((q) => q.door);
          if (!E.ph) {
            const a = D.spec.inside, b = D.spec.outside;
            const ab = Math.hypot(h.pos.x - a.x, h.pos.z - a.z) < Math.hypot(h.pos.x - b.x, h.pos.z - b.z);
            E.from = ab ? a : b; E.to = ab ? b : a; E.ph = 'up'; E.t = 0; B.path = null;
          }
          E.t += dt;
          if (E.ph === 'up') {
            if (!B.path) moveTo(E.from.x, E.from.z, false);
            if (follow(dt) || near(E.from, 0.4)) { B.path = null; E.ph = 'open'; E.t = 0; stand(false); }
            break;
          }
          if (E.ph === 'open') {
            h.speed = 0;
            B.faceTo(D.centre.x, D.centre.z, dt, 6);
            if (D.open01 < 0.7 && !D.moving && E.t > 0.25) { D.locked = false; D.open(h.pos); }
            if (D.open01 > 0.72 || E.t > 3) { E.ph = 'through'; E.t = 0; }
            break;
          }
          if (E.ph === 'through' && last && (opts.door === 'hold' || E.hold) && !E.noHold) {
            // (he works the doorway from his side of it: beside the jamb, a
            // step into the opening to shoot, back - he does not walk in to be
            // shot; with nothing beside it to work it from, he goes through)
            if (takeCover(false, { near: E.from, side: E.from, door: D })) { E.i = steps.length; S.entry = null; break; }
            E.noHold = true; S.state = 'entry';
          }
          if (E.ph === 'through') {
            // (the doorway taken: the man before him still in it)
            const taken = [...G.ais.values()].some((a) => a !== B && a.h && a.h.alive && Math.hypot(a.h.pos.x - D.centre.x, a.h.pos.z - D.centre.z) < 0.75);
            if (taken && E.t < 4) { B.path = null; stand(false); face(dt, 3); break; }
            if (!B.path) moveTo(D.centre.x, D.centre.z, false);
            if (follow(dt) || near(D.centre, 0.3)) { B.path = null; E.ph = 'frame'; E.t = 0; stand(false); }
            break;
          }
          if (E.ph === 'frame') {
            h.speed = 0;
            face(dt, 5);
            // (he has me from the doorway: up comes the gun)
            if (last && S.line && E.t > 0.2 && Kt.token(B)) { E.i = steps.length; S.entry = null; raise(); break; }
            if (E.t > (last ? (opts.frame ?? 0.4) : 0.05)) { E.ph = 'past'; E.t = 0; }
            break;
          }
          if (E.ph === 'past') {
            if (!B.path) moveTo(E.to.x, E.to.z, false);
            if (follow(dt) || near(E.to, 0.45)) { B.path = null; E.i++; E.ph = null; }
            break;
          }
          break;
        }
        case 'move': {
          if (S.flank) {
            const F = S.flank;
            if (follow(dt) || Math.hypot(h.pos.x - F.x, h.pos.z - F.z) < 0.4) {
              B.path = null; stand(false);
              // there: he has me from here; he shoots from here
              S.state = 'open'; S.t = 0;
            }
            // (on his way round, a snap shot if he has me close)
            break;
          }
          if (S.cover && snap(dt)) break;
          if (follow(dt)) { B.path = null; stand(S.coverLow); S.state = 'hold'; S.t = 0; S.wait = r.range(0.25, 0.6); break; }
          break;
        }
        // behind his cover: down, the wait, then out to shoot
        case 'hold': {
          stand(S.coverLow);
          face(dt, 3);
          S.coverT += dt;
          if (S.t > 0.35 && !coverHolds()) { if (!takeCover(true)) { S.state = 'open'; S.t = 0; } break; }
          if (kind === 'pistol' && S.mag <= 0) { S.state = 'reload'; S.t = 0; G.sfx.play('c2_magOut', h.pos.clone().setY(h.pos.y + 1.1), {}, { ref: 3 }); break; }
          // (one of them going out: the others go with him - two guns at once on the man who stands to answer)
          const mate = [...G.ais.values()].some((a) => a !== B && a.brain && a.brain.S && (a.brain.S.state === 'out' || a.brain.S.state === 'aim') && a.h.alive);
          if (mate && kind === 'pistol' && S.wait > 0.3) S.wait = 0.3;
          if (S.line && (G.controller.crouchK || 0) < 0.5 && S.wait > 0.3) S.wait = 0.3;
          S.wait -= dt;
          if (S.wait > 0) break;
          // (out from here a few times and no nearer: on to cover nearer me - nobody hides out the clock)
          if ((kind === 'pistol' || alone()) && (S.peeks || 0) >= (S.pushAt || (S.pushAt = r.int(3, 5))) && !(Kt.flank && Kt.flank.ai === B)) {
            S.peeks = 0; S.pushAt = 0;
            if (takeCover(true, { advance: true })) { Kt.events.push({ t: +G.time.toFixed(2), what: 'push', kind, at: [+S.cover.x.toFixed(1), +S.cover.z.toFixed(1)] }); break; }
            if (S.lostT > 6) { if (S.cover) S.cover.taken = null; S.cover = null; S.fire = null; S.state = 'open'; S.t = 0; S.seekT = 0; S.wait = 0.5; break; }
          }
          // (the Tommy gunner keeps my head down: he fires at where I went down, line or not)
          const suppress = kind === 'tommy' && !S.line && S.lastSeen && G.time - S.lastSeen.t < 12;
          if (!S.line && !suppress && !mate && S.t < (S.peekT || (S.peekT = r.range(2.5, 4)))) { S.wait = r.range(0.25, 0.5); break; }
          S.peekT = 0;
          if (!Kt.token(B, kind === 'tommy')) { S.wait = r.range(0.3, 0.6); break; }
          // (the Tommy gunner with no line rakes where I went down from where he stands: through frosted glass, a door, a crate)
          if (S.fire && !S.fire.rise && !suppress && Math.hypot(S.fire.x - h.pos.x, S.fire.z - h.pos.z) > 0.2) {
            // (the gun comes up as he steps out: the tell shows as he appears)
            B.path = [V(S.fire.x, 0, S.fire.z)]; B.pathI = 0; B.run = false; S.state = 'out'; S.t = 0; S.raiseT = 0;
            h.setAim(true); glint();
          } else raise();
          break;
        }
        case 'out': {
          S.raiseT += dt;
          if (S.raiseT >= T.raise && S.line && S.lineT >= noticeOf()) S.settle += dt / settleTime();
          else if (!S.line) S.settle = Math.max(0, S.settle - dt / T.lost);
          if (S.target) h.lookAt(S.aimP);
          if (follow(dt) || S.t > 1.2) { B.path = null; h.speed = 0; raise(S.raiseT); }
          break;
        }
        // the tell, then the settle
        case 'aim': {
          if (kind === 'rusher') rushOn(dt);
          else { h.speed = 0; if (h.state !== 'aim') h.setState('aim', 0.15); }
          face(dt, 7);
          if (S.target) h.lookAt(S.aimP);
          S.raiseT += dt;
          if (S.raiseT < T.raise) break;
          const suppress = kind === 'tommy' && !S.line && S.lastSeen && G.time - S.lastSeen.t < 12;
          // (I come up into his line: he has to see me first, then settle)
          if (S.line && S.lineT >= noticeOf()) S.settle += dt / settleTime();
          else S.settle = Math.max(0, S.settle - dt / T.lost);
          if (S.settle >= 1 || (suppress && S.raiseT > T.raise + 0.3)) { S.state = 'fire'; S.t = 0; S.shots = burstOf(); S.shotT = 0; S.burstN = 0; break; }
          // (I stayed down: he watches the spot a moment, then goes back)
          if (!S.line && S.lostT > T.watch && !suppress) { brain.drop(); S.state = 'back'; S.t = 0; }
          break;
        }
        case 'fire': {
          if (kind === 'rusher') rushOn(dt); else h.speed = 0;
          face(dt, 7);
          if (S.target) h.lookAt(S.aimP);
          if (kind === 'pistol' && !S.line) {
            // (lost me between rounds: the settle drains, he holds the aim)
            S.settle = Math.max(0, S.settle - dt / T.lost);
            if (S.lostT > T.watch) { brain.drop(); S.state = 'back'; S.t = 0; break; }
            if (S.settle < 1) break;
          }
          // (he lost me between rounds and has me again: settle again first)
          if (kind === 'pistol' && S.settle < 1) { S.state = 'aim'; S.raiseT = T.raise; break; }
          S.shotT -= dt;
          if (S.shotT > 0) break;
          if (S.shots <= 0 || (kind === 'pistol' && S.mag <= 0)) { brain.drop(); afterBurst(); break; }
          const suppress = kind !== 'pistol' && !S.line;
          shoot(suppress);
          S.shots--;
          S.shotT = kind === 'pistol' ? r.range(K.gap[0], K.gap[1]) : 1 / K.rate;
          break;
        }
        case 'back': {
          if (S.flank) { S.flank = null; if (Kt.flank && Kt.flank.ai === B) Kt.flank.done = true; }
          if (!S.cover) { if (!takeCover(S.rattledT > 0)) { S.state = 'open'; S.t = 0; S.wait = r.range(0.5, 1.0); } break; }
          if (Math.hypot(S.cover.x - h.pos.x, S.cover.z - h.pos.z) > 0.25) {
            if (!B.path) { B.path = [V(S.cover.x, 0, S.cover.z)]; B.pathI = 0; B.run = S.rattledT > 0; }
            if (!follow(dt) && S.t < 1.6) break;
          }
          B.path = null; stand(S.coverLow);
          S.state = 'hold'; S.t = 0; S.wait = r.range(T.wait[0], T.wait[1]);
          break;
        }
        case 'reload': {
          // (back down behind his cover first)
          if (B.path) { if (!follow(dt) && S.t < 1.2) break; B.path = null; }
          if (!S.exposedReload) stand(true);
          h.speed = 0;
          if (S.t > (kind === 'pistol' ? K.reload : K.drum)) { S.mag = kind === 'pistol' ? K.mag : 999; S.exposedReload = false; if (S.cover && Math.hypot(S.cover.x - h.pos.x, S.cover.z - h.pos.z) > 0.25) { S.state = 'back'; S.t = 0; } else { S.state = 'hold'; S.t = 0; S.wait = r.range(0.2, 0.5); } G.sfx.play('c2_magIn', h.pos.clone().setY(h.pos.y + 1.1), {}, { ref: 3 }); }
          break;
        }
        // no cover to be had (or a flank's end): he fights from where he stands
        case 'open': {
          h.speed = 0;
          face(dt, 4);
          if (h.state !== 'idle' && h.state !== 'aim') h.setState('idle', 0.2);
          S.wait -= dt;
          if (kind === 'pistol' && S.mag <= 0) { S.state = 'reload'; S.t = 0; G.sfx.play('c2_magOut', h.pos.clone().setY(h.pos.y + 1.1), {}, { ref: 3 }); break; }
          if (S.t > 2.5 && !S.flank && S.t % 3 < dt && takeCover(true)) break;
          if (S.line && S.wait <= 0 && Kt.token(B)) { raise(); break; }
          // (no line on me for a while: on to a place that has one)
          if (!S.line && S.lostT > 3 && (S.seekT = (S.seekT || 0) - dt) <= 0) {
            S.seekT = 2;
            const e = G.eye; let bx = 0, bz = 0;
            for (const [o] of G.ais) if (o.alive) { bx += o.pos.x - e.x; bz += o.pos.z - e.z; }
            let spot = Kt.flankSpot(B, Math.atan2(bx, bz) + Math.PI, Kt.playerBody(), 0, 1.0);
            // (no place that sees me, or none but where he stands: in at me, by the way there is)
            S.seeks = (S.seeks || 0) + 1;
            if (!spot || S.seeks > 2) {
              const path = G.nav.findPath(h.pos.x, h.pos.z, e.x, e.z, 16000);
              if (path && path.length) { let k = path.length - 1; while (k > 0 && Math.hypot(path[k].x - e.x, path[k].z - e.z) < 2.2) k--; spot = { x: path[k].x, z: path[k].z }; S.seeks = 0; }
            }
            if (spot) { moveTo(spot.x, spot.z, true); S.flank = spot; S.state = 'move'; S.t = 0; Kt.events.push({ t: +G.time.toFixed(2), what: 'seek', kind, at: [+spot.x.toFixed(1), +spot.z.toFixed(1)] }); }
          }
          break;
        }
        // the heavy: at me, walking, stopping for bursts
        case 'rush': {
          if (S.stopT > 0) { S.stopT -= dt; h.speed = 0; if (h.state === 'walk') h.setState('idle', 0.12); break; }
          const d = dist();
          S.rushT = (S.rushT || 0) + dt;
          if (S.line && (S.rushT > K.every || d < K.close) && Kt.token(B, true)) { S.rushT = 0; B.path = null; raise(); break; }
          S.repathT = (S.repathT || 0) - dt;
          if (S.repathT <= 0 || !B.path) {
            S.repathT = 0.7;
            const e = G.eye, dx = h.pos.x - e.x, dz = h.pos.z - e.z, L = Math.hypot(dx, dz) || 1;
            const k = Math.min(1, 1.6 / L);
            moveTo(e.x + dx * k, e.z + dz * k, false);
          }
          follow(dt);
          h.speed = K.walk;
          h.setAim(true);
          if (S.target) h.lookAt(S.aimP);
          break;
        }
        case 'watch': { h.speed = 0; break; }
        default: break;
      }
    }
    // (the heavy's walk at me, gun up, through his aim and his burst: stopped
    // only by a hit, a moment, or by being on top of me)
    function rushOn(dt) {
      if (S.stopT > 0) { S.stopT -= dt; h.speed = 0; if (h.state === 'walk') h.setState('idle', 0.12); return; }
      if (dist() < 1.9) { h.speed = 0; if (h.state === 'walk') h.setState('idle', 0.2); return; }
      S.repathT = (S.repathT || 0) - dt;
      if (S.repathT <= 0 || !B.path) {
        S.repathT = 0.7;
        const e = G.eye, dx = h.pos.x - e.x, dz = h.pos.z - e.z, L = Math.hypot(dx, dz) || 1;
        const k = Math.min(1, 1.6 / L);
        moveTo(e.x + dx * k, e.z + dz * k, false);
      }
      follow(dt);
      h.speed = K.walk * 0.85;
      h.setAim(true);
    }
    const burstOf = () => (kind === 'pistol' ? r.int(K.burst[0], K.burst[1]) : r.int(K.burst[0], K.burst[1]));
    function afterBurst() {
      S.burstN = 0;
      if (kind === 'tommy') {
        // the drum: down behind his cover, out with it, a new one in (out loud)
        S.state = 'reload'; S.t = 0; S.exposedReload = true; B.path = null;
        h.setState('idle', 0.25);
        G.sfx.play('c2_drumOut', h.pos.clone().setY(h.pos.y + 1.0), {}, { ref: 4 });
        G.sfx.play('c2_drumIn', h.pos.clone().setY(h.pos.y + 1.0), {}, { ref: 4, delay: K.drum * 0.62 });
        return;
      }
      if (kind === 'rusher') { S.state = 'rush'; S.t = 0; h.setState('walk', 0.2); return; }
      if (S.resume === 'entry' && S.entry) { S.resume = null; S.state = 'entry'; S.t = 0; return; }
      if (S.resume === 'move' && S.cover) { S.resume = null; moveTo(S.cover.x, S.cover.z, true); S.state = 'move'; S.t = 0; return; }
      S.resume = null;
      if (S.flank) { S.flank = null; const F = kit().flank; if (F && F.ai === B) F.done = true; S.state = 'open'; S.t = 0; S.wait = r.range(0.4, 0.9); return; }
      S.state = 'back'; S.t = 0;
    }
    // (opts.cover: he is there already when it starts - down behind the
    // cover point nearest where he was put, his first time out after `wait`)
    if (opts.cover && !opts.way) {
      const C = kit() && kit().covers;
      let best = null, bd = 1.3;
      for (const p of (C && C.points) || []) { const d = Math.hypot(p.x - h.pos.x, p.z - h.pos.z); if (d < bd && !p.taken) { bd = d; best = p; } }
      if (best) {
        best.taken = B; S.cover = best;
        const st = C.state(best, G.eye);
        S.coverLow = st === 'low'; S.fire = st === 'open' ? null : C.fire(best, G.eye, st);
        h.pos.x = best.x; h.pos.z = best.z;
        S.low = S.coverLow; h.setState(S.coverLow ? 'kneel' : 'idle', 0);
      }
    }
    return brain;
  },
};
