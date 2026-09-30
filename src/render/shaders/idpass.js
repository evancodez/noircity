import * as THREE from 'three';

// Interior surface classes (story pass, CONTRACTS §9.1 / lane 1 P0.2):
// mesh.userData.inkSurface (or its material's userData.inkSurface) =
// 'plaster' | 'wood' | 'lino' | 'metal' | 'cloth' (and the aliases below).
// The ink pass prints them calm: flat washes that follow the light.
// In the hands (viewmodel ids 1730..1769) the same tag names what a held
// thing is made of: 'skin' | 'paper' | 'cloth' | 'metal' | 'glass' (classes
// 7, 8, 5, 4, 9; the ink prints each by its own tone rule, untagged = skin).
// 'amberGlass' (class 11, fix round A5): the glass of a vessel that holds
// scotch - the id pass sees the glass, not the liquid behind it, so the ink
// reads the amber through it by its hue there (and prints the empty glass
// above the fill line dark).
// 'metal' / 'chrome' (class 12, fix round A3): bare metal and glass in a
// room print as black with broken highlights (the counter's rolled edge,
// the stools' chrome), not as a calm enamel wash (enamel stays class 4).
// 'lit' (class 13): a lit panel of a room (the back bar's glass, the
// kitchen's wall, the jukebox's pilasters): its own flat light, unbanded.
// 'castFig' (class 14, round 2): a figure of the cast printed as the Hoods
// are (a flat dark mass with a rim) with its light shapes (an apron, bare
// forearms, a paper hat): the id pass reads the figure's albedo off its
// vertex colour and adds its light share t (0..1) to the length, 29 + 1.8 t,
// so the ink knows the shapes (it decodes class 14 or 15 and t from it).
export const SURFACE = { plaster: 1, wall: 1, ceiling: 1, wood: 2, panel: 2, panelling: 2, lino: 3, linoleum: 3, floor: 3, enamel: 4, cloth: 5, leather: 5, fabric: 5,
  skin: 7, paper: 8, glass: 9, amberGlass: 11, metal: 12, chrome: 12, lit: 13, castFig: 14, amberIn: 16,
  // [R2-B] (class 18) the detective's black leather gloves in the hands
  // (the revolver, the wheel, the lapels): ink with a white sheen
  glove: 18 };

// Normal + object-id pass (used as scene.overrideMaterial).
// Output: rgb = view-space normal, a = object id (integer, exact in half float).
// The id comes from mesh.userData.inkId, pushed per draw from onBeforeRender.
// Instanced meshes add gl_InstanceID so every lamp post / railing post / column
// is its own silhouette for the contour detector.
export function makeIdMaterial() {
  const mat = new THREE.ShaderMaterial({
    name: 'NoirIdPass',
    side: THREE.DoubleSide,
    // (the vertex colour is read only for a cast figure's light share; a
    // mesh without colours gets the default white and never uses it)
    vertexColors: true,
    uniforms: { uId: { value: 1 }, uPerInstance: { value: 1 }, uFigure: { value: 0 }, uSurf: { value: 1 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      uniform float uId;
      uniform float uPerInstance;
      varying vec3 vN;
      varying float vId;
      varying float vAlb;
      void main() {
        #ifdef USE_COLOR
          vAlb = color.r;
        #else
          vAlb = 0.0;
        #endif
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
      varying float vAlb;
      void main() {
        vec3 n = normalize( vN );
        n = gl_FrontFacing ? n : -n;
        // (an interior surface class: the ink reads it off the length)
        // (a cast figure, class 14: its light share rides on top, from the
        // albedo - the dark cloth 0 .. 0.05, the light shapes 0.2 .. 0.72)
        float sL = uSurf;
        if ( abs( uSurf - 29.0 ) < 0.5 ) sL += 1.8 * clamp( ( vAlb - 0.05 ) / 0.65, 0.0, 1.0 );
        if ( uSurf > 1.5 ) n *= sL;
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
    // (the lighter's flame, class 17 (polish): an emitter the bloom keeps
    // even in the hands, where skin gives it none)
    const sc = object.userData.inkSurface === 'amberIn' ? 16 : oud && oud.accent === 'amber' ? 6 : oud && oud.accent === 'ember' ? 10 : oud && oud.accent === 'flame' ? 17 : SURFACE[object.userData.inkSurface ?? (oud && oud.inkSurface)] || 0;
    mat.uniforms.uSurf.value = 1 + 2 * sc;
    mat.uniformsNeedUpdate = true;
    // (a clear pane the ink should see THROUGH - the pie case's glass: it
    // leaves no id, normal or depth, so what stands behind it keeps its own
    // contours and tone; its frame draws the box. The state is set per draw:
    // three applies the material's write masks after this hook.)
    const skip = !!object.userData.inkSkip;
    mat.colorWrite = !skip;
    mat.depthWrite = !skip;
  };
  return mat;
}
