import * as THREE from 'three';

// Normal + object-id pass (used as scene.overrideMaterial).
// Output: rgb = view-space normal, a = object id (integer, exact in half float).
// The id comes from mesh.userData.inkId, pushed per draw from onBeforeRender.
// Instanced meshes add gl_InstanceID so every lamp post / railing post / column
// is its own silhouette for the contour detector.
export function makeIdMaterial() {
  const mat = new THREE.ShaderMaterial({
    name: 'NoirIdPass',
    side: THREE.DoubleSide,
    uniforms: { uId: { value: 1 }, uPerInstance: { value: 1 }, uFigure: { value: 0 } },
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
      uniform float uFigure;
      varying vec3 vN;
      varying float vId;
      void main() {
        vec3 n = normalize( vN );
        n = gl_FrontFacing ? n : -n;
        float id = mod( floor( vId + 0.5 ), 2048.0 );
        gl_FragColor = vec4( n, uFigure > 0.5 ? - id : id );
      }`,
  });
  mat.onBeforeRender = (renderer, scene, camera, geometry, object) => {
    mat.uniforms.uId.value = object.userData.inkId || 1;
    mat.uniforms.uPerInstance.value = object.userData.inkPerInstance === false ? 0 : 1;
    mat.uniforms.uFigure.value = object.userData.inkFigure ? 1 : 0;
    mat.uniformsNeedUpdate = true;
  };
  return mat;
}
