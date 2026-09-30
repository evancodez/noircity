import * as THREE from 'three';
import { LAYER, allocInkId } from '../../../render/layers.js';
import { makeGroundMaterial } from '../../../render/shaders/ground.js';
import { NOIR_FOG_GLSL } from '../../../render/fog.js';
import { HASH_GLSL } from '../../../render/shaders/common.js';
import { PIER } from '../site.js';
import { makeKit, worldUV } from '../kit.js';

// The pier's ground (lane B6): the wet concrete at the pier's root and the
// apron along the east wall (the block's wet street material: every light
// leaves its column in it), the shed's plank deck inside, the black river
// all round, the pier's edge timbers and piles. The walking surface is 0
// everywhere on the pier (the mezzanine and the stairs add theirs); the
// water's edges are walls.
// the river: black, a slow swell, the lights in it as broken vertical
// streaks (additive glints under each light that reaches it)
function waterMaterial(U) {
  return new THREE.ShaderMaterial({
    name: 'PierWater',
    uniforms: { ...U },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() { vec4 wp = modelMatrix * vec4( position, 1.0 ); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform sampler2D tNoise;
      varying vec3 vWorld;
      ${HASH_GLSL}
      ${NOIR_FOG_GLSL}
      void main() {
        vec2 p = vWorld.xz;
        float n = texture2D( tNoise, p * 0.05 + vec2( uTime * 0.01, 0.0 ) ).r;
        float sw = texture2D( tNoise, p * vec2( 0.3, 0.9 ) + vec2( 0.0, uTime * 0.03 ) ).g;
        // the swell's long dull sheen of the sky: the faintest grey, broken
        float v = 0.0035 + 0.006 * smoothstep( 0.55, 0.8, n * 0.6 + sw * 0.4 );
        float fogA = noirFogAmount( length( cameraPosition - vWorld ), vWorld.y, uFogDensity );
        gl_FragColor = vec4( mix( vec3( v ), uFogColor, fogA * 0.85 ), 1.0 );
      }`,
  });
}

// a light's column on the water: an additive quad lying on the river,
// broken into horizontal dashes by the swell (the lamp in the reference's
// wet street, in a river's scale)
export function glintMaterial(U, { gain = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    name: 'PierGlint',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, uGain: { value: gain } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vWorld;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4( position, 1.0 ); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uGain;
      uniform sampler2D tNoise;
      varying vec2 vUv; varying vec3 vWorld;
      ${NOIR_FOG_GLSL}
      void main() {
        float across = 1.0 - smoothstep( 0.0, 1.0, abs( vUv.x - 0.5 ) * 2.0 );
        float along = smoothstep( 0.0, 0.08, vUv.y ) * ( 1.0 - smoothstep( 0.35, 1.0, vUv.y ) );
        float d = texture2D( tNoise, vec2( vWorld.x * 0.6, vWorld.z * 3.5 + uTime * 0.25 ) ).r;
        float d2 = texture2D( tNoise, vec2( vWorld.x * 1.3 + 0.3, vWorld.z * 7.0 - uTime * 0.4 ) ).g;
        float dash = smoothstep( 0.5, 0.62, d * 0.6 + d2 * 0.4 );
        float I = across * across * along * dash * uGain;
        float fogA = noirFogAmount( length( cameraPosition - vWorld ), vWorld.y, uFogDensity );
        gl_FragColor = vec4( vec3( I * ( 1.0 - fogA ) ), 1.0 );
      }`,
  });
  return m;
}

export default {
  name: 'ground', order: 20,
  build(stage) {
    const g = new THREE.Group();
    g.name = 'pier9_ground';
    stage.scene.add(g);
    const kit = makeKit(stage, g);
    const { M } = kit;
    const S = PIER.shed, L = PIER.land, A = PIER.apron;

    // ---- the wet concrete outside (the block's wet street: reflections)
    const wet = makeGroundMaterial(stage.U, { paving: 0 });
    const plane = (x0, x1, z0, z1, mat) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2), mat);
      m.layers.set(LAYER.GROUND);
      m.receiveShadow = true;
      m.userData.inkId = allocInkId();
      g.add(m);
      return m;
    };
    const land = plane(L.x0, L.x1, L.z0, L.z1, wet);
    const apron = plane(A.x0, A.x1, A.z0, A.z1, wet);
    land.name = 'pier_land'; apron.name = 'pier_apron';

    // ---- the plank deck inside the shed
    kit.piece();
    const fl = worldUV(new THREE.PlaneGeometry(S.x1 - S.x0, S.z1 - S.z0).rotateX(-Math.PI / 2).translate((S.x0 + S.x1) / 2, 0.002, (S.z0 + S.z1) / 2), 1);
    const floor = kit.add(fl, M.floor, { cast: false });
    floor.name = 'pier_floor';

    // ---- the river
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2).translate(0, PIER.waterY, -60), waterMaterial(stage.U));
    water.userData.inkId = allocInkId();
    water.userData.noRay = true;
    water.name = 'pier_water';
    g.add(water);

    // ---- the pier's edges: a timber fascia and the piles below it, round
    // the shed's west, north and east walls and the apron
    kit.piece();
    const fas = [];
    const edge = (x0, x1, z0, z1) => fas.push(kit.box(x0, x1, PIER.waterY + 0.3, 0.0, z0, z1));
    edge(S.x0 - 0.4, S.x0, S.z0 - 0.4, S.z1);          // west
    edge(S.x0 - 0.4, S.x1 + 0.4, S.z0 - 0.4, S.z0);    // north
    edge(S.x1, S.x1 + 0.4, S.z0 - 0.4, A.z0);          // east, north of the apron
    edge(A.x1, A.x1 + 0.4, A.z0 - 0.4, 0);             // the apron's outer edge
    edge(A.x0, A.x1 + 0.4, A.z0 - 0.4, A.z0);          // the apron's end
    edge(L.x0, S.x0 - 0.4, -0.4, 0);                   // the land's edge either side
    edge(A.x1 + 0.4, L.x1, -0.4, 0);
    kit.addMerged(fas, M.timber, { cast: false });
    kit.piece();
    const piles = [];
    const pile = (x, z) => piles.push(new THREE.CylinderGeometry(0.17, 0.2, 3.2, 12).translate(x, PIER.waterY - 1.0, z));
    for (let z = S.z1 - 2; z > S.z0; z -= 3) { pile(S.x0 - 0.2, z); pile(S.x1 + 0.2, z); }
    for (let x = S.x0; x <= S.x1; x += 3) pile(x, S.z0 - 0.2);
    for (let z = -2; z > A.z0; z -= 3) pile(A.x1 + 0.2, z);
    kit.addMerged(piles, M.timber, { cast: false });

    // ---- the walking surface: the pier's deck at 0, the river off it ([R2-E]:
    // a thing that goes out over the edge - a board of a burst loading door -
    // falls to the water and lies on it; nobody walks there, the edges hold)
    const onDeck = (x, z) => (z > -0.45 && x > L.x0 && x < L.x1 && z < L.z1)
      || (x > S.x0 - 0.45 && x < S.x1 + 0.45 && z > S.z0 - 0.45 && z < S.z1)
      || (x >= S.x1 && x < A.x1 + 0.45 && z > A.z0 - 0.45 && z < 0);
    stage.addSurface((x, z) => (onDeck(x, z) ? 0 : PIER.waterY));

    // ---- the water's edges hold me (and the outer net)
    const C = stage.colliders;
    C.setBounds(-24, 24, -47, 33);
    // (the river west, north and east of the shed; the apron's outer edge;
    // the land's edge either side of the shed)
    C.addBox(A.x1 + 0.3, (A.z0 + 0) / 2, 0.3, -A.z0 / 2 + 0.2, 0, 'edge');
    C.addBox((A.x0 + A.x1) / 2, A.z0 - 0.3, (A.x1 - A.x0) / 2 + 0.3, 0.3, 0, 'edge');
    C.addBox((L.x0 + S.x0) / 2, -0.3, (S.x0 - L.x0) / 2, 0.3, 0, 'edge');
    C.addBox((A.x1 + L.x1) / 2 + 0.3, -0.3, (L.x1 - A.x1) / 2, 0.3, 0, 'edge');
    C.addBox(0, L.z1 + 0.3, 40, 0.3, 0, 'edge');
    C.addBox(L.x0 - 0.3, L.z1 / 2, 0.3, L.z1 / 2, 0, 'edge');
    C.addBox(L.x1 + 0.3, L.z1 / 2, 0.3, L.z1 / 2, 0, 'edge');
    return { group: g, land, apron, floor, water, wet, glint: (U) => glintMaterial(U) };
  },
};

