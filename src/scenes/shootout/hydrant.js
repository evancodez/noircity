import * as THREE from 'three';
import { hydrantGeo } from '../../stages/riverroad/smashKinds.js';
import { allocInkId } from '../../render/layers.js';
import { rig } from './rig.js';
import { SALOON } from './boss.js';

// VIII, the street's own weapon (lane C8, after the critic: "no hydrant
// anywhere usable"): a hydrant on the kerb before the diner, on the
// Cardinal's walk to the door and on the pavement the men come up. Two of my
// rounds into it and its cap goes: a column of white water bursts up and
// out, and whoever is within a long step of it is thrown down - a man of
// theirs is down for good (the street's kit men take it as a blow they do
// not get up from), the Cardinal is knocked off his feet and open (his
// opening of the brief: "when the hydrant knocks him down"). Once a beat:
// each checkpoint has it whole again. Sparks and a clang for the first round,
// so a curious player learns it is iron before it goes.
// (no default export: not a scene)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const HYDRANT = { x: -6.62, z: -4.35, r: 0.2, reach: 2.5, hits: 2, gush: 24 };

export function makeHydrant(ctx) {
  const G = ctx.game, S = ctx.stage;
  const y0 = S.surfaceY(HYDRANT.x, HYDRANT.z);
  const mat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0.55 });
  const mesh = new THREE.Mesh(hydrantGeo(), mat);
  mesh.name = 'c8.hydrant';
  mesh.position.set(HYDRANT.x, y0, HYDRANT.z);
  mesh.rotation.y = 0.4;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.inkId = allocInkId();
  mesh.userData.c8hydrant = true;
  S.scene.add(mesh);
  S.addSolid(mesh);
  // (its cap: a dome that flies when it goes)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  cap.userData.inkId = mesh.userData.inkId; cap.userData.noRay = true;
  S.scene.add(cap);
  // (solid, but not a place the gun kit's men hold: tagged 'hydrant' it drew a
  // man to stand behind a 20 cm post four metres from the window - the stander's gift)
  const col = S.colliders.addCircle(HYDRANT.x, HYDRANT.z, HYDRANT.r, 'post');
  const st = { mesh, cap, col, hits: 0, burst: false, t: 0, acc: 0, capV: null, said: false };
  const at = V(HYDRANT.x, y0, HYDRANT.z);
  const reset = () => {
    st.hits = 0; st.burst = false; st.t = 0; st.acc = 0; st.capV = null; st.said = false;
    cap.position.set(HYDRANT.x, y0 + 0.7, HYDRANT.z); cap.rotation.set(0, 0, 0); cap.visible = true;
    if (G.sfx && G.sfx.stopLoop) try { G.sfx.stopLoop('hydrant'); } catch { /* */ }
  };
  reset();
  const onShot = ({ hit }) => {
    if (!hit || hit.mesh !== mesh || st.burst) return;
    st.hits++;
    if (st.hits < HYDRANT.hits) { G.sfx.play('c2_woodHit', hit.point, { k: 0.6, pitch: 1.6 }, { ref: 2 }); return; }
    burst(hit.point);
  };
  G.on('shot', onShot);
  function burst(p) {
    st.burst = true; st.t = 0;
    st.capV = V(ctx.rng.range(-1, 1), 7.5, ctx.rng.range(-1, 1));
    if (G.sfx.hydrant) G.sfx.hydrant(at.clone().setY(0.6)); else G.sfx.play('hydrant', at, { dur: 3 }, { ref: 4 });
    G.counters.c8hydrant = (G.counters.c8hydrant || 0) + 1;
    const R = rig();
    // the men within its reach: thrown down
    for (const h of [...S.hoods.list]) {
      if (!h.alive) continue;
      const d = Math.hypot(h.pos.x - at.x, h.pos.z - at.z);
      if (d > HYDRANT.reach) continue;
      const dir = V(h.pos.x - at.x, 0.3, h.pos.z - at.z).normalize();
      if (h.c8boss) {
        const B = R && R.boss;
        if (B && !B.down) { B.c8hydrant = true; B.hold = 1.8; B.open = Math.max(B.open, SALOON.openBlast); B.openWhy = 'hydrant'; if (h.stagger) h.stagger(); ctx.hud.say('He’s down. He’s open.', 2.0); }
        continue;
      }
      G.killHood(h, dir, false, 'deathBack');
    }
    void p;
  }
  const step = (dt) => {
    // (Dot says it once, the first time he comes by it whole)
    const R = rig(), B = R && R.boss;
    if (!st.burst && !st.said && B && B.h && !B.down && Math.hypot(B.h.pos.x - at.x, B.h.pos.z - at.z) < 2.6) { st.said = true; ctx.hud.say('Dot: The hydrant, by him!', 2.0); }
    if (!st.burst) return;
    st.t += dt;
    if (st.capV) {
      st.capV.y -= 9.8 * dt;
      cap.position.addScaledVector(st.capV, dt);
      cap.rotation.x += dt * 9; cap.rotation.z += dt * 6;
      if (cap.position.y < y0 + 0.05) { cap.position.y = y0 + 0.05; st.capV = null; }
    }
    if (st.t > HYDRANT.gush) return;
    const k = Math.min(1, st.t / 0.3) * (st.t > HYDRANT.gush - 6 ? Math.max(0, (HYDRANT.gush - st.t) / 6) : 1);
    st.acc += dt * 110 * k;
    const r = ctx.rng;
    while (st.acc >= 1) {
      st.acc -= 1;
      G.fx.splash.spawn({ pos: at.clone().setY(y0 + 0.75), vel: V(r.gauss() * 0.7, r.range(6, 10.5) * k, r.gauss() * 0.7), life: r.range(1.0, 1.6), size: [0.03, 0.09], stretch: 0.06,
        col: [0.6, 0.6, 0.6], alpha: 0.9, cell: 4, gravity: 9.8, ground: y0, fadeOut: 0.2 });
    }
  };
  const remove = () => {
    G.off('shot', onShot);
    S.scene.remove(mesh, cap);
    S.removeSolid(mesh);
    const i = S.colliders.circles.indexOf(col);
    if (i >= 0) S.colliders.circles.splice(i, 1);
    if (G.sfx && G.sfx.stopLoop) try { G.sfx.stopLoop('hydrant'); } catch { /* */ }
  };
  return { st, reset, step, remove, at };
}
