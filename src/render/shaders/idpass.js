import * as THREE from 'three';

// Interior surface classes (story pass, CONTRACTS §9.1 / lane 1 P0.2):
// mesh.userData.inkSurface (or its material's userData.inkSurface) =
// 'plaster' | 'wood' | 'lino' | 'metal' | 'cloth' (and the aliases below).
// The ink pass prints them calm: flat washes that follow the light.
// In the hands (viewmodel ids 1730..1769) the same tag names what a held
// thing is made of: 'skin' | 'paper' | 'cloth' | 'metal' | 'glass' (classes
// 7, 8, 5, 4, 9; the ink prints each by its own tone rule, untagged = skin).
export const SURFACE = { plaster: 1, wall: 1, ceiling: 1, wood: 2, panel: 2, panelling: 2, lino: 3, linoleum: 3, floor: 3, metal: 4, enamel: 4, chrome: 4, cloth: 5, leather: 5, fabric: 5,
  skin: 7, paper: 8, glass: 9 };

// Normal + object-id pass (used as scene.overrideMaterial).
// Output: rgb = view-space normal, a = object id (integer, exact in half float).
// The id comes from mesh.userData.inkId, pushed per draw from onBeforeRender.
// Instanced meshes add gl_InstanceID so every lamp post / railing post / column
// is its own silhouette for the contour detector.
export function makeIdMaterial() {
  const mat = new THREE.ShaderMaterial({
    name: 'NoirIdPass',
    side: THREE.DoubleSide,
    uniforms: { uId: { value: 1 }, uPerInstance: { value: 1 }, uFigure: { value: 0 }, uSurf: { value: 1 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      uniform float uId;
      uniform float uPerInstance;
      varying vec3 vN;
      varying float vId;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vN = transformedNormal;
        #ifdef USE_INSTANCING
          vId = uId + float( gl_InstanceID ) * uPerInstance;
        #else
          vId = uId;
        #endif
      }`,
    fragmentShader: /* glsl */`
      uniform float uFigure, uSurf;
      varying vec3 vN;
      varying float vId;
      void main() {
        vec3 n = normalize( vN );
        n = gl_FrontFacing ? n : -n;
        // (an interior surface class: the ink reads it off the length)
        if ( uSurf > 1.5 ) n *= uSurf;
        float id = mod( floor( vId + 0.5 ), 2048.0 );
        gl_FragColor = vec4( n, uFigure > 0.5 ? - id : id );
      }`,
  });
  mat.onBeforeRender = (renderer, scene, camera, geometry, object) => {
    mat.uniforms.uId.value = object.userData.inkId || 1;
    mat.uniforms.uPerInstance.value = object.userData.inkPerInstance === false ? 0 : 1;
    mat.uniforms.uFigure.value = object.userData.inkFigure ? 1 : 0;
    const om = Array.isArray(object.material) ? object.material[0] : object.material;
    const oud = om && om.userData;
    // (an accent printed by its own rule, not by its hue: the scotch's amber
    // has the fire's hue and must never be lifted to flame: class 6)
    // (the ember, class 10: the ink gives it a warm glow of its own, keyed
    // by the class, not by hue - the fire keeps its accepted print)
    const sc = oud && oud.accent === 'amber' ? 6 : oud && oud.accent === 'ember' ? 10 : SURFACE[object.userData.inkSurface ?? (oud && oud.inkSurface)] || 0;
    mat.uniforms.uSurf.value = 1 + 2 * sc;
    mat.uniformsNeedUpdate = true;
  };
  return mat;
}
