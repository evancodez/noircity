import * as THREE from 'three';
import { linearFor, EXPOSURE } from '../render/tone.js';

// Car paint: the base layer (diffuse + its broad specular) is capped so a lit
// body never prints above ~0.10 display, i.e. inside the first ink band: a car
// under a lamp stays a black silhouette. The clearcoat's broad sky sheen is
// capped the same way (seen side-on at 40 m it printed a whole body as a
// 0.25-0.4 grey with an ink outline); only its grazing Fresnel rim and the
// bright glints of lamps (far above the cap) survive: the fine highlights.
const BODY_CAP = linearFor(0.10) / EXPOSURE;
const GLINT = 0.12;   // clearcoat reflections brighter than this are lamp glints
function capBody(mat) {
  const cap = BODY_CAP.toFixed(6);
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
      `vec3 outgoingLight = min( totalDiffuse + totalSpecular + totalEmissiveRadiance, vec3( ${cap} ) );`,
    ).replace(
      '( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;',
      `( clearcoatSpecularDirect + noirCoat( clearcoatSpecularIndirect, dotNVcc ) ) * material.clearcoat;`,
    ).replace(
      'void main() {',
      `vec3 noirCoat( vec3 c, float nv ) {
        vec3 kept = min( c, vec3( ${cap} ) ) + max( c - ${GLINT.toFixed(3)}, 0.0 );
        return mix( kept, c, smoothstep( 0.12, 0.02, nv ) );   // the grazing rim
      }
      void main() {`,
    );
  };
  mat.customProgramCacheKey = () => 'noirBodyCap';
  return mat;
}

// Material library. Everything is greyscale; only blood and fire (Phase 2/3)
// may carry chroma, because the ink pass keeps colour purely by saturation.

// A tiny environment for glossy things (car paint, chrome, glass, wet iron):
// grey storm sky, black wet street, a ring of lamp highlights. Pre-filtered
// with PMREM so reflections have the right blur per roughness.
function makeEnvMap(renderer, withBulbs = true) {
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float up = smoothstep(-0.02, 0.5, d.y);
          float horizon = exp(-abs(d.y) * 10.0);
          float v = mix(0.003, 0.05, up) + horizon * 0.045;
          gl_FragColor = vec4(vec3(v), 1.0);
        }`,
    }),
  );
  scene.add(sky);
  const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(30) });
  for (let i = 0; i < (withBulbs ? 9 : 0); i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8), bulb);
    m.position.set(Math.cos(a) * 30, 6 + (i % 3) * 5, Math.sin(a) * 30);
    scene.add(m);
  }
  // a soft overhead strip (the lit underside of cloud)
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(60, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.12, 0.12), side: THREE.DoubleSide }));
  strip.position.set(0, 30, 0);
  strip.rotation.x = Math.PI / 2;
  scene.add(strip);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.01);
  pm.dispose();
  return rt.texture;
}

export function makeMaterials(renderer, tex) {
  const env = makeEnvMap(renderer, true);       // cars, chrome, glass: sparkle
  const envSoft = makeEnvMap(renderer, false);  // architecture & iron: sky only (no blobs on walls)
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const hdr = (v) => new THREE.Color(v, v, v);
  const M = {
    env,
    envSoft,
    iron: std({ color: 0x080808, roughness: 0.55, metalness: 0.35, envMap: envSoft, envMapIntensity: 0.55 }),  // the el: massive, very black
    ironDark: std({ color: 0x040404, roughness: 0.7, metalness: 0.3, envMap: envSoft, envMapIntensity: 0.2 }),
    lampIron: std({ color: 0x0d0d0d, roughness: 0.35, metalness: 0.7, envMap: envSoft, envMapIntensity: 0.6 }),
    // lamp shades: a dead-black matte silhouette (no env sheen, no specular),
    // double sided so its inside never shows as a glowing ring
    lampShade: std({ color: 0x040404, roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide }),
    stone: std({
      // matte: no block may catch its own specular (the old bevelled, glossy
      // blocks read as a plastic tile mosaic); the wet look comes from the
      // streaks in the albedo and from the ink pass, not from highlights
      // (0xe4: the façade was the brightest large surface in the street
      // view, ~0.24-0.29 display; the reference's wall is a dark 0.12-0.2
      // with lighter dry-brush strokes on top)
      color: 0xe4e4e4, map: tex.stone.map, bumpMap: tex.stone.bump, bumpScale: 0.35,
      roughness: 0.9, metalness: 0.0, envMap: envSoft, envMapIntensity: 0.35,
    }),
    // ledges, sills, window heads: the stone's own tone (dark 0x2a trim
    // printed every ledge as a heavy black bar across the façade); they now
    // read by their thin unlit undersides and the ink line, with ragged ends
    stoneTrim: std({ color: 0x484848, roughness: 0.85, envMap: envSoft, envMapIntensity: 0.3 }),
    kerb: std({ color: 0x161616, roughness: 0.65, envMap: envSoft, envMapIntensity: 0.08 }),  // (a glossy kerb face grazes the sky into a white stripe)
    brickFar: std({ color: 0x151515, roughness: 0.9 }),
    tower: std({ color: 0x0a0a0a, roughness: 1.0 }),
    // (Phase 1c: very low albedo, a rough base layer, capped: see capBody)
    paint: capBody(new THREE.MeshPhysicalMaterial({
      color: 0x030303, roughness: 0.65, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05,
      envMap: env, envMapIntensity: 1.0,
    })),
    paintGrey: capBody(new THREE.MeshPhysicalMaterial({
      color: 0x101010, roughness: 0.65, clearcoat: 1.0, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 0.8,
    })),
    chrome: std({ color: 0x9a9a9a, roughness: 0.16, metalness: 1.0, envMap: env, envMapIntensity: 1.0 }),
    rubber: std({ color: 0x080808, roughness: 0.75, metalness: 0.0, envMap: env, envMapIntensity: 0.2 }),
    // hub: a dark disc (the wheel must not become a bright target), with a
    // small chrome cap dot at its centre
    hubcap: std({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.2, envMap: env, envMapIntensity: 0.6 }),
    // whitewall: a thin, dimmed ring, a pick-out rather than a white donut
    whitewall: std({ color: 0x8a8a8a, roughness: 0.6, metalness: 0.0, envMap: env, envMapIntensity: 0.6 }),
    // car windows: glossy panes that mirror the storm sky, so they print as a
    // grey pane framed by the black body, pillars and contour
    // (a metal's reflectance IS its colour: the pane must be light for the
    // dim storm-sky environment to print as a grey pane at all)
    carGlass: std({ color: 0xa0a0a0, roughness: 0.08, metalness: 1.0, envMap: envSoft, envMapIntensity: 2.2 }),
    // door seams / panel gaps: a thin light line, as an inker picks out the
    // panel edges of a black car
    seam: std({ color: 0x8a8a8a, roughness: 0.2, metalness: 0.9, envMap: envSoft, envMapIntensity: 2.0 }),
    glass: std({ color: 0x1a1a1a, roughness: 0.04, metalness: 0.9, envMap: env, envMapIntensity: 1.0 }),
    glassDark: std({ color: 0x050505, roughness: 0.06, metalness: 0.8, envMap: envSoft, envMapIntensity: 1.4 }),
    wood: std({ color: 0x1a1a1a, roughness: 0.7, envMap: envSoft, envMapIntensity: 0.2 }),
    paintedMetal: std({ color: 0x222222, roughness: 0.45, metalness: 0.3, envMap: envSoft, envMapIntensity: 0.5 }),
    bulb: new THREE.MeshBasicMaterial({ color: hdr(8) }),
    bulbHot: new THREE.MeshBasicMaterial({ color: hdr(90) }),
    bulbDim: new THREE.MeshBasicMaterial({ color: hdr(8) }),
    shadeInner: new THREE.MeshBasicMaterial({ color: hdr(2.5), side: THREE.BackSide }),
    headlamp: new THREE.MeshBasicMaterial({ color: hdr(30) }),
    windowLit: new THREE.MeshBasicMaterial({ color: hdr(0.24) }),
    windowLitDim: new THREE.MeshBasicMaterial({ color: hdr(0.16) }),
    windowFar: new THREE.MeshBasicMaterial({ color: hdr(2.2) }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
  };
  return M;
}
