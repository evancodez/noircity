import * as THREE from 'three';

// Sky dome: paper-grey storm sky. Horizon = fog colour (so fogged towers melt
// into it), darker overhead, slow rolling cloud mottling, and a lightning term
// that floods the clouds white.
export function makeSkyMaterial(U) {
  return new THREE.ShaderMaterial({
    name: 'NoirSky',
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { ...U },
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
      void main() {
        vec3 d = normalize( vDir );
        float e = d.y;
        // storm sky with a real vertical gradient: ~#5e overhead, lifting to
        // ~#8c in the mist band at the horizon (display values)
        float g = mix( 1.0, 0.47, smoothstep( 0.0, 0.55, e ) );
        g *= 1.0 + 0.1 * exp( - max( e, 0.0 ) * 8.0 );
        // big soft cloud masses, sampled on a low dome so they don't streak
        vec2 cp = d.xz / ( max( e, 0.0 ) + 0.45 );
        vec2 drift = vec2( uTime * 0.004, uTime * 0.0015 );
        float c = texture2D( tNoise, cp * 0.11 + drift ).g * 0.65 + texture2D( tNoise, cp * 0.31 - drift * 1.7 ).r * 0.35;
        // cloud edges are dragged out by a horizontal dry brush, not a
        // smooth noise iso-line
        float bb = texture2D( tBrush, cp * 0.42 + drift * 3.0 ).b;
        float clouds = smoothstep( 0.4, 0.62, c + ( bb - 0.5 ) * 0.16 );
        float horizonFade = smoothstep( 0.02, 0.3, e );
        g *= mix( 1.0, mix( 0.75, 1.15, clouds ), horizonFade );
        vec3 col = uFogColor * g;
        col += vec3( uLightning * ( 0.25 + 1.6 * clouds ) * ( 0.4 + 0.6 * horizonFade ) );
        gl_FragColor = vec4( col, 1.0 );
      }`,
  });
}
