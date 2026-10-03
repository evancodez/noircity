import * as THREE from 'three';
import { LAYER } from '../../../render/layers.js';
import { SKY_GRAD_GLSL } from '../../../render/shaders/sky.js';

// The night over the pier ([C7]): the river road's storm sky (chapter VI
// cuts straight into this chapter, so the night must go on as it was), a
// grey band low over the water where the freighter and the shed's roof are
// black against it, and black overhead - the block's paper-grey dome read
// as a grey day in the first frame.
function makePierSky(U) {
  return new THREE.ShaderMaterial({
    name: 'NoirPierSky',
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uFogColor: U.uFogColor, uTime: U.uTime, uLightning: U.uLightning, tNoise: U.tNoise, tBrush: U.tBrush },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uFogColor;
      uniform float uTime, uLightning;
      uniform sampler2D tNoise, tBrush;
      varying vec3 vDir;
      ${SKY_GRAD_GLSL}
      void main() {
        vec3 d = normalize( vDir );
        float e = d.y;
        // (the band over the water, then night: darker and sooner than the river road's)
        float g = skyGrad( e ) * mix( 0.85, 0.12, smoothstep( 0.03, 0.42, e ) );
        vec2 cp = d.xz / ( max( e, 0.0 ) + 0.45 );
        vec2 drift = vec2( uTime * 0.004, uTime * 0.0015 );
        float c = texture2D( tNoise, cp * 0.11 + drift ).g * 0.65 + texture2D( tNoise, cp * 0.31 - drift * 1.7 ).r * 0.35;
        float bb = texture2D( tBrush, cp * 0.42 + drift * 3.0 ).b;
        float clouds = smoothstep( 0.42, 0.64, c + ( bb - 0.5 ) * 0.16 );
        float horizonFade = smoothstep( 0.02, 0.3, e );
        g *= mix( 1.0, mix( 0.75, 1.15, clouds ), horizonFade );
        vec3 col = uFogColor * g;
        col += vec3( uLightning * ( 0.25 + 1.6 * clouds ) * ( 0.4 + 0.6 * horizonFade ) );
        gl_FragColor = vec4( col, 1.0 );
      }`,
  });
}

export default {
  name: 'sky', order: 10, tick: 10,
  build(stage) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), makePierSky(stage.U));
    mesh.layers.set(LAYER.SKY);
    mesh.frustumCulled = false;
    mesh.renderOrder = -100;
    stage.scene.add(mesh);
    return { mesh, update(camera) { mesh.position.copy(camera.position); } };
  },
  update: (sky, dt, t, camera) => sky.update(camera),
};
