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
  r.setRenderTarget(prev);
  return performance.now() - t0;
}
