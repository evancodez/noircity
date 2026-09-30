import * as THREE from 'three';

// The men of scene 5 (lane B2): a gunfight in a room 5.6 x 7 m, where the
// street's cover brain (cover points 10-30 m off, relocating inside 7 m)
// would only pace. Each man has a role and two marks - where he stands out
// of my sight and where he stands to shoot - and works between them:
//   'hall'    a doorway man: out of sight beside the jamb, a step into the
//             door to fire two or three, back
//   'enter'   through the door and into the room to a spot of cover, then
//             out from it to fire and back behind it
//   'glass'   behind the frosted sidelight: he fires through it at the
//             light and at me (it goes to pieces); then through the hole
//   'window'  up the fire escape to the window with a Tommy gun: bursts
//             through the curtain, a step aside out of the frame, again
//   'rush'    the heavy: in at the door and on into the room, stopping for
//             bursts, never behind anything
// Spawn options (game.spawnHood(x, z, { brain: 'office', role, path, hide,
// fire, face, wait0, cover })): path [{x, z}...] his way in (walked, or run
// with run: true), hide / fire his two marks, wait0 the pause before the
// first shot. The scene sets body.coverK(from) -> 0..1: how well I am
// covered from a shooter at that point (crouched behind the desk: 1).
// Every shot goes through the Game (Game.hoodFire): the flash, the sound,
// the round landing a moment later - wide, into the walls, or into me.
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export default {
  name: 'office',
  create(game, hood, opts) {
    const B = opts.body, G = game, h = hood, r = B.rng;
    const role = opts.role || 'hall';
    const heavy = !!opts.heavy;
    const S = {
      state: 'enter', t: 0, shots: 0, shotT: 0, cycles: 0,
      path: (opts.path || []).map((p) => V(p.x, 0, p.z)),
      hide: opts.hide ? V(opts.hide.x, 0, opts.hide.z) : null,
      fire: opts.fire ? V(opts.fire.x, 0, opts.fire.z) : null,
      wait: opts.wait0 ?? r.range(0.6, 1.2),
      onFire: opts.onFire || null,
      label: role,
    };
    const eye = () => B.player;
    const walkTo = (p, run = false) => { B.path = [p.clone()]; B.pathI = 0; B.run = run; B.stuckT = 0; B.lastPos.copy(h.pos); h.setAim(false); h.lookAt(null); };
    const at = (p, d = 0.22) => Math.hypot(h.pos.x - p.x, h.pos.z - p.z) < d;
    const look = () => { const p = eye(); h.lookAt(V(p.x, p.y - 0.25, p.z)); };
    // one shot: the cover I have from him scales his aim
    const shoot = (t) => {
      const k = B.coverK ? B.coverK(h.pos) : 0;
      B.aim = (opts.aim ?? 0.6) * (1 - 0.95 * k);
      const ok = B.fire(t);
      if (ok && S.onFire) S.onFire(h, B);
      return ok;
    };
    const brain = {
      get state() { return role + ':' + S.state; },
      onHit() {
        // (hit: he staggers - the body's stun - and goes back to his mark to hide)
        S.shots = 0;
        B.dropToken();
        if (S.state === 'fire' || S.state === 'aim' || S.state === 'out') S.state = 'back';
        S.wait = r.range(1.4, 2.4);
      },
      update(dt, t) {
        if (!h.alive) return;
        if (h.state === 'stagger') { h.speed = 0; return; }
        if (B.stun > 0) { B.stun -= dt; h.speed = 0; return; }
        if (B.hold && B.hold(S.state)) { h.speed = 0; if (S.state === 'fire' || S.state === 'aim') { S.state = 'wait'; B.dropToken(); } return; }
        const p = eye();
        S.t += dt;
        switch (S.state) {
          // his way in: walked (or run) point by point, without thinking
          case 'enter': {
            if (!B.path || B.path.length === 0 || B.pathI >= (B.path ? B.path.length : 0)) {
              const nx = S.path.shift();
              if (!nx) { B.stop(); S.state = role === 'rush' ? 'close' : 'settle'; break; }
              S.last = nx;
              walkTo(nx, !!opts.run);
            }
            if (B.follow(dt)) B.path = null;
            break;
          }
          // (the last few centimetres onto his mark: a man stops where he means to)
          case 'settle': {
            const q = S.last;
            const d = q ? Math.hypot(q.x - h.pos.x, q.z - h.pos.z) : 0;
            if (!q || d < 0.05 || S.t > 60) { S.state = 'wait'; break; }
            const k = Math.min(1, 0.7 * dt / d);
            h.pos.x += (q.x - h.pos.x) * k; h.pos.z += (q.z - h.pos.z) * k;
            B.faceTo(p.x, p.z, dt, 3);
            break;
          }
          // out of sight at his mark, a breath, then out to shoot
          case 'wait': {
            B.stop();
            B.faceTo(p.x, p.z, dt, 3);
            S.wait -= dt;
            if (S.wait > 0) break;
            if (!B.token()) { S.wait = r.range(0.3, 0.7); break; }
            if (S.fire && !at(S.fire)) { walkTo(S.fire, false); S.state = 'out'; } else { S.state = 'aim'; S.t = 0; h.setState('aim', 0.2); }
            break;
          }
          case 'out': {
            if (B.follow(dt)) { B.stop(); S.state = 'aim'; S.t = 0; h.setState('aim', 0.2); }
            break;
          }
          case 'aim': {
            h.speed = 0;
            if (h.state !== 'aim') h.setState('aim', 0.2);
            look();
            B.faceTo(p.x, p.z, dt, 7);
            if (S.t < (heavy ? 0.4 : r.range(0.35, 0.55))) break;
            S.state = 'fire';
            S.shots = heavy ? r.int(5, 8) : r.int(2, 3) + (r.chance(0.3) ? 1 : 0);
            S.shotT = 0;
            break;
          }
          case 'fire': {
            h.speed = 0;
            look();
            B.faceTo(p.x, p.z, dt, 7);
            S.shotT -= dt;
            if (S.shotT > 0) break;
            if (S.shots <= 0) { B.dropToken(); S.cycles++; S.state = S.hide ? 'back' : 'wait'; S.wait = r.range(1.1, 2.1) * (heavy ? 1.2 : 1); break; }
            shoot(t);
            S.shots--;
            S.shotT = heavy ? r.range(0.085, 0.11) : r.range(0.38, 0.55);
            break;
          }
          // back behind the jamb, the wall, the cabinet
          case 'back': {
            h.setAim(false);
            if (S.hide && !at(S.hide)) {
              if (!B.path) walkTo(S.hide, true);
              if (B.follow(dt)) B.path = null;
              break;
            }
            B.path = null;
            B.stop();
            S.state = 'wait';
            break;
          }
          // the heavy: on into the room, bursts as he comes, to arm's length
          case 'close': {
            const d = Math.hypot(p.x - h.pos.x, p.z - h.pos.z);
            if (S.wait > 0) { S.wait -= dt; h.speed = 0; if (h.state !== 'aim') h.setState('aim', 0.2); look(); B.faceTo(p.x, p.z, dt, 5); break; }
            if ((d < 3.2 || S.t > 1.6) && B.token(d < 3.2)) { S.state = 'aim'; S.t = 0; B.path = null; h.setState('aim', 0.2); break; }
            if (!B.path || B.stuckT > 1) {
              const k = Math.max(0, d - 2.6) / Math.max(d, 1e-3);
              walkTo(V(h.pos.x + (p.x - h.pos.x) * k * 0.5, 0, h.pos.z + (p.z - h.pos.z) * k * 0.5), false);
            }
            if (B.follow(dt)) B.path = null;
            break;
          }
          default: break;
        }
        // (the heavy never hides: after a burst he comes on)
        if (role === 'rush' && S.state === 'wait') { S.state = 'close'; S.t = 0; S.wait = r.range(0.6, 1.1); }
      },
      release() { B.dropToken(); },
      // (the scene sends him on: a new way in, new marks)
      send({ path = null, hide = undefined, fire = undefined, wait = null, role: rl = null } = {}) {
        if (path) { S.path = path.map((p) => V(p.x, 0, p.z)); B.path = null; S.state = 'enter'; }
        if (hide !== undefined) S.hide = hide ? V(hide.x, 0, hide.z) : null;
        if (fire !== undefined) S.fire = fire ? V(fire.x, 0, fire.z) : null;
        if (wait != null) S.wait = wait;
        void rl;
      },
      get S() { return S; },
    };
    return brain;
  },
};
