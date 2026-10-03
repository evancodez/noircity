import * as THREE from 'three';
import { Cabin } from '../../vehicles/cabin.js';
import { poolMaterial } from '../../vehicles/Vehicle.js';
import { tailLamps, COUPE } from '../../vehicles/models.js';
import { makeUmbrella } from './umbrella.js';

// The seam into chapter VI (lane C6; lane C3's report, Left 1): what the cut
// into the coupe's seat would otherwise make at once, made ahead, a piece a
// frame, once the city stands (game.stages.warm('city') returned true):
//   the cabin (kept: the tail's chase takes the stage's _cabin: its build,
//   its windscreen); his tail lamps' glow sprite; my headlamps' pool.
//   Compiled into the pipeline's scene target as the stage's own warm does,
//   with the city's lights in a scene of their own.
//   const it = seamWarm(game, city); it.next() each frame until done
export function* seamWarm(G, city) {
  const r = G.renderer, cam = G.camera, P = G.pipeline;
  if (!r || !r.compile || !city) return;
  const LS = new THREE.Scene();
  LS.fog = city.scene.fog; LS.environment = city.scene.environment;
  city.scene.traverseVisible((o) => { if (o.isLight) { const c = o.clone(false); c.layers.mask = o.layers.mask; LS.add(c); } });
  const idMat = P && P.idMat;
  const compile = (o) => {
    const prev = r.getRenderTarget();
    r.setRenderTarget((P && P.rtScene) || prev);
    try {
      r.compile(o, cam, LS);
      // (the id pass: its variant for a skinned mesh)
      if (idMat) o.traverse((m) => { if (m.isMesh && m.isSkinnedMesh) { const m0 = m.material; m.material = idMat; try { r.compile(m, cam, LS); } catch (e) { /* */ } m.material = m0; } });
    } catch (e) { /* its first frame will */ }
    r.setRenderTarget(prev);
  };
  // the cabin: made with the city as its stage (its constructor reads the
  // game's stage, which is still this chapter's)
  if (!city._cabin) {
    const fake = Object.create(G);
    Object.defineProperty(fake, 'stage', { value: city });
    city._cabin = new Cabin(fake);
  }
  if (city._cabin.screen && city._cabin.screen.mesh) compile(city._cabin.screen.mesh);
  yield 'cabin';
  // (the walkers' programs are not made here: a program is made for the
  // lights it is lit by, and the city's lights at the cut - my car's lamps
  // spawned, the pool dealt round the seat - are not yet the city's lights
  // here; measured, tools/plays/watcher_seam.json: each was made again at the
  // cut. What the cut still costs is held inside the door frame's black.)
  void makeUmbrella;
  // his tail lamps' glow, my headlamps' pool
  {
    const g = new THREE.Group();
    tailLamps(g, COUPE.tail);
    compile(g);
    yield 'tail';
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), poolMaterial(COUPE.lamps, 26, 0.5));
    compile(pool);
    pool.geometry.dispose();
    yield 'pool';
  }
}
