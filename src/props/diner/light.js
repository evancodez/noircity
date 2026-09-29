import * as THREE from 'three';
import { DINER } from '../../stages/block/site.js';
import { LAYER } from '../../render/layers.js';
import { NOIR_FOG_GLSL } from '../../render/fog.js';
import { accent } from '../../render/accents.js';
import { lathe, mergeGeos, V3 } from '../lib.js';

// The diner's cinematic light (round 2, owner 3; WAVE_A_ROUND2 §3.3).
// Noir light is a few hard sources, deep black, and every figure set against
// light. The pendants' pools and the back bar's lit glass were there; what
// the room lacked is what stands BEHIND the people and what lies on the
// floor between them. None of it is a real THREE light (every real light is
// paid by every lit pixel): it is light painted onto the surfaces it falls
// on, additive quads on the effects layer (the scene pass only - the ink's
// id pass sees the wall or the floor under them, so the room's print cuts
// each into its flat values with torn edges, as it cuts a pendant's pool):
//   the sconce    a wall lamp on the end wall behind Mack's stool,
//                 throwing the scallop of a half-round shade up and down the
//                 plaster
//   the jukebox   its glow on the end wall round its arch and on the floor
//                 before it
//   (the neon's blue on the floor inside the door was taken out: see below)
//   the sheen     the pendants seen in the polished lino: short broken streaks
//                 where the floor mirrors a lamp (the floor's own material,
//                 view-dependent, broken by its wax mottle)
//   the street    the window patches (booths.js) lifted to a light that
//                 prints: a grey the booths and the aisle can be seen by
// API: lightRig.update(dt, t, dip) - dips with the pendants (lampsDip),
//      lightRig.sconces [{ pos, entry }], lightRig.patches
const D = DINER, F = D.floorY;

// ---- a light patch: the light a source throws on a flat surface ------------
// local metres from the source point on the surface (x across, y up the
// wall or along -z/+x on a floor); mode 0: a soft ellipse; 1: a sconce's
// scallop (a fan up the wall that widens and fades, a smaller one down)
function patchMaterial(U, { mode = 0, gain = 1, a = 1, b = 1, color = null } = {}) {
  const m = new THREE.ShaderMaterial({
    name: 'NoirLightPatch',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {
      uFogColor: U.uFogColor, uFogDensity: U.uFogDensity,
      uMode: { value: mode }, uGain: { value: gain }, uAB: { value: new THREE.Vector2(a, b) },
      uColor: { value: color ? color.clone() : new THREE.Color(1, 1, 1) },
    },
    vertexShader: /* glsl */`
      varying vec2 vP;
      varying vec3 vWorld;
      void main() {
        vP = uv;
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uMode, uGain;
      uniform vec2 uAB;
      uniform vec3 uColor;
      varying vec2 vP;
      varying vec3 vWorld;
      ${NOIR_FOG_GLSL}
      void main() {
        vec2 p = vP;
        float I;
        if ( uMode < 0.5 ) {
          vec2 q = p / uAB;
          float r2 = dot( q, q );
          // (compact: gone at the ellipse's edge, so the quad never shows)
          I = pow( max( 0.0, 1.0 - r2 ), 2.0 ) * ( 0.35 + 0.65 * exp( - r2 * 2.5 ) );
        } else {
          // the scallop: the shade's rim casts a parabola; inside it the
          // wall is lit, strongest just over the lamp, fading up the wall
          float y = p.y, ax = abs( p.x );
          float up = step( 0.0, y ), yy = abs( y );
          // (polish: soft - the edge a long ramp, not a cut: the room's
          // print steps it once, and the brush tears that step; a small
          // lamp's light, gone within a metre up and half that down)
          float w = mix( 0.07 + 0.16 * sqrt( yy ), 0.09 + 0.36 * sqrt( yy ), up );
          float inside = smoothstep( w, w * 0.25, ax );
          float fall = mix( exp( - yy / 0.18 ) * 0.6, exp( - yy / 0.32 ), up );
          float collar = exp( - dot( p, p ) / 0.006 ) * 0.45;
          I = inside * fall + collar;
        }
        float fogA = noirFogAmount( length( cameraPosition - vWorld ), vWorld.y, uFogDensity );
        gl_FragColor = vec4( uColor * I * uGain * ( 1.0 - fogA ), 1.0 );
      }`,
  });
  m.userData.base = gain;
  return m;
}

// a quad on a wall facing +z (the end wall zMin) or on the floor, with uvs
// in metres from the source
function wallQuad(cx, cy, z, x0, x1, y0, y1) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, x0 + uv.getX(i) * (x1 - x0), y0 + uv.getY(i) * (y1 - y0));
  g.translate(cx + (x0 + x1) / 2, cy + (y0 + y1) / 2, z);
  return g;
}
function floorQuad(cx, cz, x0, x1, z0, z1, y = F + 0.007) {
  // (u along x, v along -z so the ellipse reads the same from the aisle)
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, x0 + uv.getX(i) * (x1 - x0), z0 + (1 - uv.getY(i)) * (z1 - z0));
  g.translate(cx + (x0 + x1) / 2, y, cz + (z0 + z1) / 2);
  return g;
}

function addPatch(kit, geo, mat, order = 2) {
  const m = new THREE.Mesh(geo, mat);
  m.layers.set(LAYER.FX);
  m.renderOrder = order;
  m.userData.noRay = true;
  m.frustumCulled = true;
  kit.g.add(m);
  return m;
}

// ---- the floor's sheen: the pendants mirrored in the polished lino ------------
// Added to the floor's own material as emitted light: the view ray reflected
// off the floor is compared with the direction to each lamp's shade; a tight
// lobe (the wax is polished) that the floor's dull patches break up, so it
// prints as a few short torn streaks toward the eye, like the wet street's
// columns in a room's scale.
export function sheenFloor(floorMat, n = 8) {
  const U = {
    uSheenLamp: { value: Array.from({ length: n }, () => new THREE.Vector3(0, -99, 0)) },
    uSheenK: { value: new Array(n).fill(0) },
  };
  floorMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSheenW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSheenW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSheenW;
        uniform vec3 uSheenLamp[ ${n} ];
        uniform float uSheenK[ ${n} ];`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 Vd = normalize( vSheenW - cameraPosition );
          vec3 Rd = reflect( Vd, vec3( 0.0, 1.0, 0.0 ) );
          float s = 0.0;
          // (the polish is rubbed along the aisle: the lamp's image is
          // tight across and drawn out toward the eye - a short streak, as
          // the wet street draws a lamp into a column, in a room's scale)
          vec2 rh = normalize( Rd.xz + 1e-5 );
          float re = asin( clamp( Rd.y, -1.0, 1.0 ) );
          for ( int i = 0; i < ${n}; i ++ ) {
            vec3 Ld = normalize( uSheenLamp[ i ] - vSheenW );
            float dh = 1.0 - dot( rh, normalize( Ld.xz + 1e-5 ) );
            float de = re - asin( clamp( Ld.y, -1.0, 1.0 ) );
            s += uSheenK[ i ] * exp( - dh / 0.0004 - de * de / 0.08 ) * 0.55;
          }
          // (a polished floor mirrors most at a grazing look, little
          // straight down)
          s *= 0.15 + 0.85 * pow( 1.0 - abs( Vd.y ), 2.0 );
          // the wax's dull patches break the sheen (the roughness map's
          // mottle: the polish is 0.24, a dull patch 0.75)
          float wax = smoothstep( 0.4, 0.26, roughnessFactor );
          totalEmissiveRadiance += vec3( s * wax );
        }`);
  };
  floorMat.customProgramCacheKey = () => 'dinerSheen' + n;
  floorMat.needsUpdate = true;
  return U;
}

// ---- a wall sconce: a half-round shade on a bracket ----------------------------
function sconceGeo() {
  // (a half bowl open at the top and the bottom: its rim casts the scallops)
  const bowl = lathe([[0.075, -0.1], [0.11, -0.06], [0.13, 0.0], [0.135, 0.05], [0.12, 0.09]], 24, Math.PI, 0);
  bowl.rotateY(Math.PI / 2);
  const plate = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 20).rotateX(Math.PI / 2).translate(0, 0.12, 0.005);
  return { bowl, plate };
}

export function buildDinerLight(kit, { windowLight = [], jukebox = null, lamps = [], floor = null } = {}) {
  const { stage, M } = kit;
  const U = stage.U;
  const patches = [];
  const zW = D.zMin + 0.004;

  // ---- the sconces on the end wall, behind Mack's stool and the jukebox
  // (x -13.4: on the line from the player's stool through Mack's head, so
  // at his line he is a black shape on its scallop; one only - a second by
  // the coat rack glared through the B4 glass onto the pavement outside)
  const sconces = [];
  const sg = sconceGeo();
  const shadeMat = M.glow('sconceShade', 1.4, { side: THREE.DoubleSide });
  for (const [x, y] of [[-13.4, F + 2.2]]) {
    kit.piece();
    const g = new THREE.Group();
    g.position.set(x, y, D.zMin);
    kit.g.add(g);
    // (polish: no back plate - its dark disc facing the room printed as a
    // black dot in the lamp; a smaller shade)
    const bowl = kit.add(sg.bowl.clone().scale(0.7, 0.7, 0.7).translate(0, 0, 0.004), shadeMat, { parent: g, cast: false });
    bowl.userData.noRay = true;
    // the scallops on the plaster
    const mat = patchMaterial(U, { mode: 1, gain: 0.2 });
    patches.push(addPatch(kit, wallQuad(x, y, zW, -0.9, 0.9, -0.8, Math.min(1.4, D.ceilY - y)), mat));
    // (no lamp of the light registry: an omni entry lit the rain over the
    // roof through the ceiling; the pendants keep the figures' rims)
    sconces.push({ pos: V3(x, y, D.zMin + 0.15), group: g });
  }

  // ---- the jukebox's glow round its arch and before it on the floor
  const J = D.jukebox;
  const jbMatW = patchMaterial(U, { mode: 0, gain: 0.2, a: 1.15, b: 1.25 });
  patches.push(addPatch(kit, wallQuad(J.x, F + 1.05, zW + 0.001, -1.6, 1.6, -1.05, 1.9), jbMatW));
  const jbMatF = patchMaterial(U, { mode: 0, gain: 0.11, a: 0.8, b: 0.9 });
  patches.push(addPatch(kit, floorQuad(J.x, D.zMin + 0.75, -1.4, 1.4, -1.5, 1.5), jbMatF));

  // ---- the cigarette machine's lit windows at the far end: a low glow on
  // the end wall and the floor before it, so the far end reads as a lit
  // ground behind the last stools and not as nothing
  const mz = D.zMax - 0.004;
  const cmW = patchMaterial(U, { mode: 0, gain: 0.09, a: 0.85, b: 1.0 });
  patches.push(addPatch(kit, wallQuad(-13.75, F + 1.0, mz, -1.2, 1.2, -1.0, 1.4), cmW));
  const cmF = patchMaterial(U, { mode: 0, gain: 0.07, a: 0.7, b: 0.9 });
  patches.push(addPatch(kit, floorQuad(-13.75, D.zMax - 0.9, -1.0, 1.0, -1.2, 1.2), cmF));

  // (polish: the neon's blue patch inside the door is gone. The ink keeps a
  // colour only at display 0.45 or more (its colour rule, ink.js: blood and
  // fire print bright or not at all), so a faint blue wash cannot print: at
  // any gain that shows at all it printed as a saturated blue disc lying on
  // the floor like a plate. The neon stays where it can be bright - the
  // tubes over the door and their light on the wet pavement outside.)
  void accent;

  // ---- the street's light through the windows: lifted to print (it was
  // a wash under the ink's crush: a grey the aisle is seen by now, the
  // water's shadows crawling in it)
  for (const m of windowLight) if (m.material && m.material.uniforms && m.material.uniforms.uStrength) m.material.uniforms.uStrength.value = 7.5;

  // ---- the sheen
  const sheen = floor ? sheenFloor(floor.material, lamps.length) : null;

  const rig = {
    sconces, patches, sheen,
    // the pendants' sag (lampsDip) takes the sconces and the glows with it;
    // the sheen follows each lamp's head as it swings
    update(near, dip = 1) {
      for (const p of patches) p.material.uniforms.uGain.value = p.material.userData.base * dip;
      if (sheen) {
        lamps.forEach((l, i) => {
          sheen.uSheenLamp.value[i].copy(l.head).y -= 0.08;
          sheen.uSheenK.value[i] = near && l.on !== false && !l.dead ? dip * (l.kind === 'booth' ? 0.6 : 1) : 0;
        });
      }
    },
  };
  void jukebox; void mergeGeos;
  return rig;
}
