import * as THREE from 'three';
import { LAYER } from '../../../render/layers.js';
import { SKY_GRAD_GLSL } from '../../../render/shaders/sky.js';

// The storm sky over the river (lane B5; [R2] its own dome): the block's
// (render/shaders/sky.js) up to 11 degrees over the horizon, where the
// towers are hazed toward it (world/Skyline.js reads the same skyGrad), and
// darker above that, toward night overhead - over the open river the
// block's paper-grey sky filled the top of every frame at the rail, and the
// last image of the chapter read as a grey day.
function makeRiverSky(U) {
  return new THREE.ShaderMaterial({
    name: 'NoirRiverSky',
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
        float g = skyGrad( e ) * mix( 1.0, 0.42, smoothstep( 0.07, 0.65, e ) );
        vec2 cp = d.xz / ( max( e, 0.0 ) + 0.45 );
        vec2 drift = vec2( uTime * 0.004, uTime * 0.0015 );
        float c = texture2D( tNoise, cp * 0.11 + drift ).g * 0.65 + texture2D( tNoise, cp * 0.31 - drift * 1.7 ).r * 0.35;
        float bb = texture2D( tBrush, cp * 0.42 + drift * 3.0 ).b;
        float clouds = smoothstep( 0.4, 0.62, c + ( bb - 0.5 ) * 0.16 );
        float horizonFade = smoothstep( 0.02, 0.3, e );
        g *= mix( 1.0, mix( 0.8, 1.1, clouds ), horizonFade );
        vec3 col = uFogColor * g;
        col += vec3( uLightning * ( 0.25 + 1.6 * clouds ) * ( 0.4 + 0.6 * horizonFade ) );
        gl_FragColor = vec4( col, 1.0 );
      }`,
  });
}

export default {
  name: 'sky', order: 10, tick: 10,
  build(stage) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), makeRiverSky(stage.U));
    mesh.layers.set(LAYER.SKY);
    mesh.frustumCulled = false;
    mesh.renderOrder = -100;
    stage.scene.add(mesh);
    return { mesh, update(camera) { mesh.position.copy(camera.position); } };
  },
  update: (sky, dt, t, camera) => sky.update(camera),
};
