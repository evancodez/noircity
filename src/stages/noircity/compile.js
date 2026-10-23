import * as THREE from 'three';

// [O1] Every shader program the city will draw with, compiled once as the
// free roam begins (under its fade in from black), so no material met for
// the first time down a street - a landmark's stone, the neon's atlas, the
// water - stalls a frame while driving. What Stages.warm does a slice a
// frame for a stage warmed ahead (src/stages/index.js), all at once here
// for a stage entered cold (?start=city): the place's lights in a scene of
// their own, every mesh compiled against them into the pipeline's scene
// target, and one id-pass variant a kind of mesh. Not a part (no default
// export).
export function compileAll(stage, game) {
  if (stage._compiled) return 0;
  stage._compiled = true;
  const r = game.pipeline && game.pipeline.renderer, cam = game.camera, P = game.pipeline;
  if (!r || !r.compile) return 0;
  const t0 = performance.now();
  const LS = new THREE.Scene();
  LS.fog = stage.scene.fog; LS.environment = stage.scene.environment;
  stage.scene.traverseVisible((o) => { if (o.isLight) { const c = o.clone(false); c.layers.mask = o.layers.mask; LS.add(c); } });
  const prev = r.getRenderTarget();
  const seen = new Set(), kinds = new Set();
  // (the near chunks' materials too, though no chunk round the start uses
  // them yet - the washing's, the street names': a stand-in mesh each, its
  // uv and its colours there, so the Tenements' first chunk compiles nothing)
  const S = stage.part('stream');
  const stand = [];
  // ([O1b] the dressing's materials too: its props, relief, boards, lights)
  const D = stage.part('dressing');
  if (S && S.mats) for (const m of [...Object.values(S.mats), ...(D && D.mats ? Object.values(D.mats) : [])]) {
    const g = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    const o = new THREE.Mesh(g, m);
    o.position.set(0, -60, 0); o.receiveShadow = true; o.userData.noRay = true;
    stage.scene.add(o); stand.push(o);
  }
  const idMat = P && P.idMat;
  stage.scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const k = [mats.map((m) => m.uuid).join(), !!o.isInstancedMesh, !!o.isSkinnedMesh].join('|');
    if (!seen.has(k)) {
      seen.add(k);
      r.setRenderTarget((P && P.rtScene) || prev);
      try { r.compile(o, cam, LS); } catch (e) { /* its first frame will */ }
    }
    if (idMat && o.isMesh) {
      const kk = [!!o.isInstancedMesh, !!o.isSkinnedMesh, !!o.isBatchedMesh, !!(o.morphTargetInfluences && o.morphTargetInfluences.length), !!o.instanceColor, !!(o.geometry && o.geometry.attributes.color)].join();
      if (!kinds.has(kk)) { kinds.add(kk); const m0 = o.material; o.material = idMat; r.setRenderTarget((P && P.rtScene) || prev); try { r.compile(o, cam, LS); } catch (e) { /* */ } o.material = m0; }
    }
  });
  // (and every buffer on the GPU: one draw of the whole city, nothing culled,
  // into a small target - the far tiles' masses and lights are uploaded here,
  // not the first time each turns into view)
  const rt = new THREE.WebGLRenderTarget(64, 64);
  const culled = [];
  stage.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  const mask = cam.layers.mask;
  cam.layers.enableAll();
  r.setRenderTarget(rt);
  try { r.render(stage.scene, cam); } catch (e) { /* its first frame will */ }
  cam.layers.mask = mask;
  for (const o of culled) o.frustumCulled = true;
  r.setRenderTarget(prev);
  rt.dispose();
  for (const o of stand) { stage.scene.remove(o); o.geometry.dispose(); }
  return performance.now() - t0;
}
