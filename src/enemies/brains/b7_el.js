import * as THREE from 'three';

// The gunman on the el (B7, scene 9): he stands at the deck's west rail,
// ten metres up, and fires down into the diner through its broken windows
// in bursts of his Tommy gun, his flashes up in the ironwork. He never
// moves (there is nowhere to go up there); his first burst goes wide (the
// flashes are the tell: nobody is hit by a man he could not have seen), the
// rest are aimed. Hit, he goes over the rail (the scene's onFall).
//   brain: 'b7_el', options: { deckY, onFall(hood), aim }
const _v = new THREE.Vector3();

export default {
  name: 'b7_el',
  create(game, hood, opts) {
    const { body } = opts;
    const r = body.rng;
    let next = game.time + r.range(1.4, 2.2), left = 0, shotT = 0, bursts = 0, fell = false, wounds = 0, hp0 = hood.hp;
    const aim0 = opts.aim ?? 0.85;
    hood.surface = () => opts.deckY ?? 10.72;
    return {
      state: 'el',
      update(dt, t) {
        body.stop();
        const p = body.player;
        body.faceTo(p.x, p.z, dt, 2.5);
        hood.lookAt(_v.copy(p).setY(p.y - 0.4));
        if (left > 0) {
          shotT -= dt;
          if (shotT > 0) return;
          // (the first burst is his tell: it goes into the room, not into me)
          body.aim = bursts === 0 ? 0 : aim0;
          body.fire(t);
          left--;
          shotT = r.range(0.085, 0.11);
          if (left <= 0) { bursts++; next = t + r.range(1.5, 2.4); hood.setState('idle', 0.3); }
          return;
        }
        if (t < next) return;
        hood.setState('aim', 0.2);
        left = r.int(6, 9);
        shotT = 0.45;
      },
      // (his hit points are a wall: two rounds, or one in the head, and he
      // crumples forward - over the rail, not back onto the deck)
      onHit(dir) {
        const lost = hp0 - hood.hp;
        hp0 = hood.hp;
        wounds += lost >= 900 ? 3 : 1;
        if (wounds >= 2 && hood.alive) game.killHood(hood, dir, false, 'deathKnees');
      },
      release() {
        if (fell || hood.alive) return;
        fell = true;
        if (opts.onFall) opts.onFall(hood);
      },
    };
  },
};
