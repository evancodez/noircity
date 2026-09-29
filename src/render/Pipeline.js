import * as THREE from 'three';
import { LAYER } from './layers.js';
import { makeIdMaterial } from './shaders/idpass.js';
import { makeInkMaterial } from './shaders/ink.js';
import { FULLSCREEN_VERT } from './shaders/common.js';
import { TONE_GLSL, toneUniforms, EXPOSURE } from './tone.js';
import { makeBloomPrefilter, makeBloomDown, makeBloomUp, makeBloomUpWide, makeBlurMaterial, makeReflBrightMaterial } from './shaders/bloom.js';
import { makeReflPosMaterial, makeReflSplat, makeCopyLumMaterial } from './shaders/reflstreak.js';

// Explicit render pipeline (DESIGN.md §3). Per frame:
//   1. normal+id pass   -> rtId (view normal xyz, object id w) + depth texture
//   2. planar reflection-> rtRefl (half res, mirrored camera, oblique clip,
//                          + depth), EMITTERS ONLY: black clear (alpha 0 =
//                          nothing mirrored), black fog, no sky, no cones;
//                          alpha = coverage. Its frustum is the part of the
//                          view below the horizon, reaching down to 60 deg
//                          under it, so a lamp head right above the eye is
//                          still in the mirror (REFL_ROWS)
//      bright pass      -> rtStreakA (quarter of rtRefl): light above T
//      positions        -> rtReflPos (quarter of rtRefl, mipmapped): where
//                          each bright texel's emitter stands
//      street streaks   -> rtStreakB (quarter res of the view): one sheen per
//                          emitter lying on the street, from its foot toward
//                          the eye (shaders/reflstreak.js)
//   3. scene pass       -> rtScene (linear HDR, 4x MSAA); world shaders read
//                          rtId's depth for soft intersections
//   4. volume pass      -> rtVolume (half res): cones, beams; these shaders
//                          depth-test manually against rtId's depth; then a
//                          separable blur feathers every cone edge
//      rain pass        -> rtRain (FULL res, R16F): 3D rain streaks + splash rings,
//                          so the hairlines stay thin and never stair-step
//   5. bloom chain      -> bloom[0] (half res)
//   6. ink pass         -> canvas
// The viewmodel (player's gun, LAYER.VIEWMODEL) is drawn by its own camera
// (this.vm.camera: same eye, FOV ~50) into rtId and rtScene right after the
// world, its depth squeezed in front of the world's: it is inked by the same pass as the
// world (normals, ids, contours, brush) and can never clip into a wall. It is
// never reflected and never in the volume / rain passes; its muzzle flash
// sprites (LAYER.VM_FX) follow it in the scene pass only.
//
// Phase 3b performance pass (same image, see __noir.perfLegacy for the
// in-session before/after): the scene target's MSAA colour is resolved once
// per frame instead of after every render() call into it, and its depth is
// never resolved (nobody reads it); the ink pass skips its 24-tap contour
// probe on sky pixels; the street skips its rain-ring search beyond 34 m;
// far el stations, far cars and far Tommy guns take lighter builds
// (Overpass, Cars, Hood). GPU per-pass timings: __noir.gpuProfile() where
// timer queries work, else __noir.bench() (repeated passes).
// (Phase 3c performance pass: two levels, the quarter-res one mipmapped and
// read by one wide upsample - shaders/bloom.js makeBloomUpWide - in place of
// the three small levels and their six passes)
const BLOOM_LEVELS = 2;
// the mirror's rows, as a share of the view's half-res height: it covers
// from the horizon (every mirror image lies below it) down to 60 deg under
// it, ~1.24x the rows of the view's lower half at the same density
const REFL_ROWS = 1.25;
const REFL_DOWN = THREE.MathUtils.degToRad(60);

export class Pipeline {
  constructor(renderer, tex, U, opts = {}) {
    this.renderer = renderer;
    this.tex = tex;
    this.U = U;
    this.pixelRatio = opts.pixelRatio || 1;
    this.width = 1;
    this.height = 1;
    this.lightning = 0;       // 0..1+, read by the sky (clouds flood white) and the ink tone curve
    this._bolt = null;        // active pulseLightning() envelope
    this.rimLamps = []; // [{ position: Vector3, strength }]
    this.view = opts.view || 0;
    this.fogColor = U.uFogColor.value;
    this.vm = null;          // { scene, camera, frameInv: Matrix4 (view -> gun local), visible }
    // Combat hooks (game/Game.js):
    //   reflHide(camera) -> objects left out of the planar reflection (Hoods
    //     beyond ~25 m: a speck in the mirrored emitters, a full skinned draw)
    //   shadowCasters() -> [{ id, x, y, z, moving }] the dynamic shadow casters
    // Shadow cache: the lamps' shadow maps are re-rendered only when they can
    // have changed (the light was re-assigned or moved, a moving caster is in
    // its range, or the set of casters in range changed). The world itself
    // is static, so a quiet street renders them once.
    this.reflHide = null;
    this.shadowCasters = null;
    this.shadowLod = null;     // (on) => light builds into the shadow maps
    this.volPost = null;       // () => true while a muzzle puff hangs (LAYER.VOL_POST)
    this.shadowCache = opts.shadowCache ?? true;
    this.shadowThrottle = opts.shadowThrottle ?? true;
    this._shadowLights = null;

    const hf = THREE.HalfFloatType;
    this.rtId = new THREE.WebGLRenderTarget(1, 1, {
      type: hf,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    this.rtId.texture.name = 'rtId';
    // (Phase 3b performance pass) nothing reads the scene target's depth (the
    // ink pass takes rtId's), so its multisampled depth is never resolved;
    // and three resolves the MSAA colour after EVERY render() call into it,
    // but only the last one of the frame matters: holdResolve() hides the
    // samples from three's resolve for the calls before the last (the gun,
    // and the world when the gun's flash sprites follow) - each skipped
    // resolve is a 1440x900x4 half-float blit
    // (and it is R11G11B10F, not RGBA16F: nothing reads the scene's alpha,
    // its colour is never negative, and 6-5 bits of mantissa per channel
    // are well under a display step through the log tone curve; half the
    // bytes of every 4x multisampled pixel stored, loaded and resolved)
    this.rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedInt101111Type, format: THREE.RGBFormat, samples: 4, resolveDepthBuffer: false });
    this.rtScene.texture.name = 'rtScene';
    {
      const rt = this.rtScene;
      let samples = rt.samples;
      rt._holdResolve = false;
      Object.defineProperty(rt, 'samples', { get: () => (rt._holdResolve ? 0 : samples), set: (v) => { samples = v; }, configurable: true });
      // (a render() that updates the shadow maps re-binds the scene target
      // after them, reading `samples`: the hold may only begin after that,
      // so it is armed from the shadow map's own render - see holdAfterShadows)
      const sm = renderer.shadowMap, smRender = sm.render.bind(sm);
      this._armHold = false;
      this.deferResolve = true;
      // (Phase 3c performance pass: a shadow map re-rendered for a moving
      // Hood drew the el's stations and the cars at full detail - ~300k
      // triangles a map; they cast it from their light builds, which print
      // the same soft PCF pools - this.shadowLod, set by the Game)
      sm.render = (lights, scene, camera) => {
        let lod = false;
        if (this.shadowLod && sm.enabled) for (const L of lights) if (L.castShadow && (L.shadow.autoUpdate || L.shadow.needsUpdate)) { lod = true; break; }
        if (lod) this.shadowLod(true);
        smRender(lights, scene, camera);
        if (lod) this.shadowLod(false);
        if (this._armHold) rt._holdResolve = true;
      };
    }
    this.rtRefl = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
    this.rtRefl.texture.name = 'rtRefl';
    this.rtReflOpq = new THREE.WebGLRenderTarget(1, 1, { type: hf, format: THREE.RedFormat, depthBuffer: false });
    this.rtSpriteZ = new THREE.WebGLRenderTarget(1, 1, { format: THREE.RedFormat, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
    this._spriteMats = [];
    this.rtReflPos = new THREE.WebGLRenderTarget(1, 1, {
      type: hf, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.rtVolume = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false });
    this.rtVolume.texture.name = 'rtVolume';
    this.rtVolTmp = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false });
    // (Phase 3c performance pass: one channel - R16F, a quarter of the
    // RGBA16F's bytes to clear, store and sample - but FULL res: at half res
    // the 1.5 px hairlines doubled into soft 3 px bars)
    this.rtRain = new THREE.WebGLRenderTarget(1, 1, { type: hf, format: THREE.RedFormat, depthBuffer: false });
    this.rtRain.texture.name = 'rtRain';
    this.rtStreakA = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false });
    this.rtStreakB = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false });
    this.bloom = [];
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const last = i === BLOOM_LEVELS - 1;
      this.bloom.push(new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false,
        ...(last ? { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter } : {}) }));
    }

    this.idMat = makeIdMaterial();
    this.inkMat = makeInkMaterial(tex, { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity });
    this.prefilterMat = makeBloomPrefilter();
    this.downMat = makeBloomDown();
    this.upMat = makeBloomUp();
    this.upWideMat = makeBloomUpWide();
    this.reflBrightMat = makeReflBrightMaterial();
    this.reflPosMat = makeReflPosMaterial();
    this.copyLumMat = makeCopyLumMaterial();
    this.splat = null;                 // the street streaks' instanced quads (setSize)
    this.splatScene = new THREE.Scene();
    // Bright-pass threshold T (scene-linear luminance): just above lamp-lit
    // stone in the (black-fogged) reflection, so only emitters, cone cores and
    // hot lit spots leave a column; a wet dark car body or the mist does not.
    this.reflThreshold = 0.06;    // lamp-lit stone in the reflection: q99.5 ~0.026
    this._fogSave = new THREE.Color();
    this._sceneFogSave = new THREE.Color();
    this.blurMat = makeBlurMaterial();

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.inkMat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // reflection camera state (see three/addons/objects/Reflector.js)
    this.reflCam = new THREE.PerspectiveCamera();
    this.reflCam.matrixAutoUpdate = true;
    this._v = {
      normal: new THREE.Vector3(0, 1, 0), planePos: new THREE.Vector3(), camPos: new THREE.Vector3(),
      rot: new THREE.Matrix4(), look: new THREE.Vector3(), view: new THREE.Vector3(), target: new THREE.Vector3(),
      plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4(), tmp: new THREE.Vector3(),
      f: new THREE.Vector3(), u: new THREE.Vector3(), d: new THREE.Vector3(), vp: new THREE.Matrix4(),
      win: { xL: -1, xR: 1, yB: -1, yT: 1 },
    };
    this._clearColor = new THREE.Color();
    // debug/bench: skip individual passes to measure their cost (__noir.bench())
    this.skip = { id: false, refl: false, shadows: false, scene: false, vol: false, bloom: false, ink: false };
    this.repeat = {}; // bench: extra executions of a pass ({ ink: 10 })
    // debug: ?rt=refl|reflA|bright|streak shows an intermediate buffer through
    // the ink tone curve instead of the final image
    this.debugRT = opts.debugRT || null;
    this.look = null;              // the Look in force (setLook)
    this.exposureOverride = null;  // exposure=<v> (look development)
    this.debugMat = new THREE.ShaderMaterial({
      name: 'DebugRT', depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uMode: { value: 0 }, uExposure: { value: EXPOSURE }, ...toneUniforms() },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform int uMode; uniform float uExposure;
        varying vec2 vUv;
        ${TONE_GLSL}
        void main() {
          vec4 c = texture2D( tSrc, vUv );
          float l = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
          gl_FragColor = vec4( vec3( uMode == 1 ? c.a : toneCurve( l * uExposure ) ), 1.0 );
        }`,
    });
  }

  // The Look (docs/story/CONTRACTS.md §9.1), called every frame with
  // stage.lookAt(eye): { fogDensity, fogColor, exposure, rainOverlay,
  // rain3d, grain, ambient, reflect, haze, room }. The block's exterior Look
  // is today's frame (world/World.js BASE_LOOK): its values are the ones
  // every uniform already holds, so applying it changes nothing.
  // (FOUNDATION STUB, lane 1: fog, exposure and the screen rain overlay are
  // applied, switched by the volume the eye is in; rain3d, grain, ambient,
  // reflect and haze are kept for lane 1, and nothing is blended yet)
  setLook(look) { this.look = look; }

  applyLook(scene) {
    const L = this.look;
    if (!L) return;
    if (scene.fog) { scene.fog.color.copy(L.fogColor); scene.fog.density = L.fogDensity; }
    this.U.uFogColor.value.copy(L.fogColor);
    this.U.uFogDensity.value = L.fogDensity;
    // (exposure=<v>, main.js: a look-development override wins)
    this.inkMat.uniforms.uExposure.value = this.exposureOverride ?? L.exposure;
  }

  // (debug) read a render target back as floats: { w, h, data: Float32Array rgba }
  readTarget(rt) {
    const w = rt.width, h = rt.height, n = w * h * 4;
    const u16 = new Uint16Array(n);
    this.renderer.readRenderTargetPixels(rt, 0, 0, w, h, u16);
    const data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = THREE.DataUtils.fromHalfFloat(u16[i]);
    return { w, h, data };
  }

  // (debug, fix 8) the street's emitters as the sheen pass sees them: bright
  // texels of the mirror with their world positions, clustered by foot
  // (0.5 m cells). -> [{ foot: [x, z], h, n, lum, rgb, D }]
  probeEmitters(minLum = 0.004) {
    const B = this.readTarget(this.rtStreakA), Pz = this.readTarget(this.rtReflPos);
    const eye = this._v.camPos, cells = new Map();
    for (let i = 0; i < B.w * B.h; i++) {
      const r = B.data[i * 4], g = B.data[i * 4 + 1], b = B.data[i * 4 + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const w = Pz.data[i * 4 + 3];
      if (l < minLum || !(w > 0)) continue;
      const x = eye.x + Pz.data[i * 4] / w, y = eye.y + Pz.data[i * 4 + 1] / w, z = eye.z + Pz.data[i * 4 + 2] / w;
      const k = Math.round(x * 2) + ',' + Math.round(z * 2);
      const c = cells.get(k) || { sx: 0, sz: 0, sy: 0, n: 0, lum: 0, rgb: [0, 0, 0] };
      c.sx += x; c.sz += z; c.sy += y; c.n++; c.lum = Math.max(c.lum, l); c.rgb[0] += r; c.rgb[1] += g; c.rgb[2] += b;
      cells.set(k, c);
    }
    return [...cells.values()].map((c) => ({ foot: [+(c.sx / c.n).toFixed(2), +(c.sz / c.n).toFixed(2)], h: +(c.sy / c.n).toFixed(2), n: c.n, lum: +c.lum.toFixed(3),
      rgb: c.rgb.map((v) => +(v / c.n).toFixed(3)), D: +Math.hypot(c.sx / c.n - eye.x, c.sz / c.n - eye.z).toFixed(2) })).sort((a, b) => b.n - a.n);
  }

  // (debug, fix 8) the sheen along one emitter's axis, from its foot F = [x,
  // z] toward the eye: [[s (m), luminance]] every `step` m from s = -1 m.
  // Also the gap (m) between F and the first sample above 5 % of the peak,
  // the length (m) to the last sample above 2 % of it, and whether the
  // luminance falls monotonically after the first third of that length.
  probeStreak(foot, step = 0.25) {
    const T = this.readTarget(this.rtStreakB), M = this.U.uReflMatrix.value, eye = this._v.camPos;
    const F = new THREE.Vector3(foot[0], this._v.planePos.y, foot[1]);
    const u = new THREE.Vector3(eye.x - F.x, 0, eye.z - F.z);
    const D = u.length(); u.normalize();
    const out = [], p = new THREE.Vector4();
    for (let s = -1; s <= Math.min(D, 12); s += step) {
      p.set(F.x + u.x * s, F.y, F.z + u.z * s, 1).applyMatrix4(M);
      const x = Math.floor(p.x / p.w * T.w), y = Math.floor(p.y / p.w * T.h);
      if (x < 0 || y < 0 || x >= T.w || y >= T.h) { out.push([+s.toFixed(2), null]); continue; }
      const i = (y * T.w + x) * 4;
      out.push([+s.toFixed(2), +(0.2126 * T.data[i] + 0.7152 * T.data[i + 1] + 0.0722 * T.data[i + 2]).toFixed(5)]);
    }
    const vals = out.filter((o) => o[1] !== null);
    const peak = Math.max(...vals.map((o) => o[1]));
    const first = vals.find((o) => o[1] > 0.05 * peak), last = [...vals].reverse().find((o) => o[1] > 0.02 * peak);
    const len = last ? last[0] : 0;
    let mono = true, prev = Infinity;
    for (const o of vals) if (o[0] >= len / 3 && o[0] <= len) { if (o[1] > prev * 1.02 + 1e-5) mono = false; prev = o[1]; }
    return { D: +D.toFixed(2), peak: +peak.toFixed(4), gap: first ? Math.max(0, first[0]) : null, length: len, monotonic: mono, samples: out };
  }

  // the scene target's format: R11G11B10F (default) or RGBA16F (Phase 3a)
  setSceneFormat(compact) {
    const t = this.rtScene.texture;
    const type = compact ? THREE.UnsignedInt101111Type : THREE.HalfFloatType, format = compact ? THREE.RGBFormat : THREE.RGBAFormat;
    if (t.type === type && t.format === format) return;
    t.type = type; t.format = format;
    this.rtScene.dispose();
  }

  setSize(cssW, cssH) {
    const w = Math.max(2, Math.floor(cssW * this.pixelRatio));
    const h = Math.max(2, Math.floor(cssH * this.pixelRatio));
    this.width = w; this.height = h;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(cssW, cssH, true);
    this.rtId.setSize(w, h);
    this.rtScene.setSize(w, h);
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    const rh = Math.max(2, Math.round(hh * REFL_ROWS));
    this.rtRefl.setSize(hw, rh);
    this.rtReflOpq.setSize(hw, rh);
    this.rtSpriteZ.setSize(hw, rh);
    const sw = Math.max(2, hw >> 1), sh = Math.max(2, rh >> 1);
    this.rtReflPos.setSize(sw, sh);
    this.rtVolume.setSize(hw, hh);
    this.rtVolTmp.setSize(hw, hh);
    this.rtRain.setSize(w, h);
    const qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
    this.rtStreakA.setSize(sw, sh);
    this.rtStreakB.setSize(qw, qh);
    // one splat instance per source texel
    if (!this.splat || this.splat.geometry.instanceCount !== sw * sh) {
      if (this.splat) { this.splatScene.remove(this.splat); this.splat.geometry.dispose(); this.splat.material.dispose(); }
      this.splat = makeReflSplat(sw * sh);
      this.splatScene.add(this.splat);
    }
    this.splat.material.uniforms.uSrcSize.value.set(sw, sh);
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      this.bloom[i].setSize(Math.max(2, w >> (i + 1)), Math.max(2, h >> (i + 1)));
    }
    this.U.uRes.value.set(w, h);
    this.inkMat.uniforms.uRes.value.set(w, h);
  }

  blit(material, target, clear = true) {
    const r = this.renderer;
    this.quad.material = material;
    r.setRenderTarget(target);
    const ac = r.autoClear;
    r.autoClear = clear;
    r.render(this.quadScene, this.quadCam);
    r.autoClear = ac;
  }

  updateReflectionCamera(camera) {
    const v = this._v, rc = this.reflCam;
    v.camPos.setFromMatrixPosition(camera.matrixWorld);
    v.rot.extractRotation(camera.matrixWorld);
    v.view.subVectors(v.planePos, v.camPos).reflect(v.normal).negate().add(v.planePos);
    v.look.set(0, 0, -1).applyMatrix4(v.rot).add(v.camPos);
    v.target.subVectors(v.planePos, v.look).reflect(v.normal).negate().add(v.planePos);
    rc.position.copy(v.view);
    rc.up.set(0, 1, 0).applyMatrix4(v.rot).reflect(v.normal);
    rc.lookAt(v.target);
    rc.near = camera.near; rc.far = camera.far;
    rc.updateMatrixWorld();
    rc.projectionMatrix.copy(camera.projectionMatrix);

    // the street plane -> the view's own window (the ground reads its
    // streaks there: uReflMatrix), and the same in clip space for the splat
    const tm = this.U.uReflMatrix.value;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(rc.projectionMatrix);
    tm.multiply(rc.matrixWorldInverse);
    v.vp.multiplyMatrices(rc.projectionMatrix, rc.matrixWorldInverse);

    // The mirror's own window (street fix 8): every mirror image lies below
    // the horizon, so the view's upper part is never rendered; and a lamp
    // head a few metres off mirrors to far below the frame's bottom edge
    // while its foot and its streak are in view, so the window reaches down
    // to REFL_DOWN under the horizon. Same eye, same x window: the ground
    // maps the view's uv to the mirror's by an affine remap of v
    // (uReflRemap), for the coverage it still reads there.
    {
      const e = camera.projectionMatrix.elements;
      const sy = e[5], oy = e[9];
      const yB0 = (-1 - oy) / sy, yT0 = (1 - oy) / sy;
      v.f.set(0, 0, -1).applyMatrix4(v.rot);
      v.u.set(0, 1, 0).applyMatrix4(v.rot);
      const fx = v.f.x, fz = v.f.z, fl = Math.hypot(fx, fz) || 1;
      const tanOf = (cy, sn) => {        // a direction (horizontal forward * cy, down * sn) in the camera's tan y
        v.d.set(fx / fl * cy, -sn, fz / fl * cy);
        return v.d.dot(v.u) / Math.max(v.d.dot(v.f), 0.05);
      };
      const yH = tanOf(1, 0);
      const yD = tanOf(Math.cos(REFL_DOWN), Math.sin(REFL_DOWN));
      let yT = Math.min(yT0, yH + 0.02), yB = Math.min(yB0, yD);
      if (yT < yB + 0.1) yT = yB + 0.1;
      const n = camera.near;
      const xL = (-1 - e[8]) / e[0], xR = (1 - e[8]) / e[0];
      rc.projectionMatrix.makePerspective(xL * n, xR * n, yT * n, yB * n, n, camera.far);
      const W = v.win; W.xL = xL; W.xR = xR; W.yB = yB; W.yT = yT;
      const v0 = (yB0 - yB) / (yT - yB), v1 = (yT0 - yB) / (yT - yB);
      this.U.uReflRemap.value.set(v1 - v0, v0);
    }
    // Oblique near plane = the street plane, so nothing below ground leaks in.
    v.plane.setFromNormalAndCoplanarPoint(v.normal, v.planePos);
    v.plane.applyMatrix4(rc.matrixWorldInverse);
    v.clip.set(v.plane.normal.x, v.plane.normal.y, v.plane.normal.z, v.plane.constant);
    const pm = rc.projectionMatrix.elements;
    v.q.x = (Math.sign(v.clip.x) + pm[8]) / pm[0];
    v.q.y = (Math.sign(v.clip.y) + pm[9]) / pm[5];
    v.q.z = -1.0;
    v.q.w = (1.0 + pm[10]) / pm[14];
    v.clip.multiplyScalar(2.0 / v.clip.dot(v.q));
    pm[2] = v.clip.x; pm[6] = v.clip.y; pm[10] = v.clip.z + 1.0 - 0.003; pm[14] = v.clip.w;
    rc.projectionMatrixInverse.copy(rc.projectionMatrix).invert();
  }

  // Lightning: a double flicker (flash, dip, flash) that decays over
  // `duration` seconds of sim time. Phase 3 adds thunder + scheduling.
  pulseLightning(time, strength = 1, duration = 0.35) {
    this._bolt = { t0: time, strength, duration };
  }

  updateLightning(time) {
    const b = this._bolt;
    this.kick = 0;
    if (!b) return;
    const u = (time - b.t0) / b.duration;
    if (u < 0 || u > 1) { this._bolt = null; this.lightning = 0; return; }
    const flick = u < 0.12 ? 1 : u < 0.22 ? 0.25 : u < 0.34 ? 0.9 : Math.pow(1 - (u - 0.34) / 0.66, 2) * 0.6;
    this.lightning = b.strength * flick;
    // the first frame of a strike: the ink tone curve kicks (Phase 3a)
    // (kickHold: a screenshot of that first frame, shot=storm)
    if (!b.kicked || this.kickHold) { b.kicked = true; this.kick = Math.min(1, b.strength); }
  }

  // a static caster moved (a wreck settling, a trash can knocked over):
  // every shadow map is re-rendered once (Phase 3a)
  dirtyShadows() { this.shadowDirty = true; }

  // flag the shadow maps that must be re-rendered this frame (see above)
  // Phase 3c performance pass: a map that must follow a MOVING caster (a
  // Hood walking or fighting in the light's range) is refreshed every other
  // frame - the three shadowed lamps staggered, so ~1.5 maps a frame instead
  // of 3 - and one that only sees far casters (> 20 m from the eye: a man
  // ~70 px tall) every fourth; a light that moved or was re-assigned, a
  // caster entering or leaving its range, or dirtyShadows() still refresh it
  // at once. A shadow at most one frame late (three for a far man) is
  // invisible under the ink's soft PCF pools.
  updateShadowFlags(scene, camera = null) {
    this._shFrame = (this._shFrame || 0) + 1;
    if (!this._shadowLights) {
      this._shadowLights = [];
      scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow) this._shadowLights.push(o); });
      for (const L of this._shadowLights) { L.shadow.autoUpdate = false; L.shadow.needsUpdate = true; L._shKey = null; L._shSig = ''; }
    }
    const casters = this.shadowCasters ? this.shadowCasters() : null;
    for (const L of this._shadowLights) {
      const t = L.target ? L.target.position : L.position;
      const key = [L.position.x, L.position.y, L.position.z, t.x, t.y, t.z, L.shadow.camera.far, L.angle ?? 0, L.visible ? 1 : 0].join(',');
      let need = key !== L._shKey;
      L._shKey = key;
      let sig = '', moveNear = false, moveFar = false;
      if (casters) {
        // inside the light's shadow frustum (a spot's cone, a ~1.3 m sphere
        // round the man): a man outside the cone never touches its map
        const far = L.shadow.camera.far, R = 1.3;
        let ax = 0, ay = -1, az = 0, cosA = -1, sinA = 0;
        if (L.isSpotLight) {
          ax = t.x - L.position.x; ay = t.y - L.position.y; az = t.z - L.position.z;
          const al = Math.hypot(ax, ay, az) || 1;
          ax /= al; ay /= al; az /= al;
          cosA = Math.cos(L.angle); sinA = Math.sin(L.angle);
        }
        for (const c of casters) {
          const dx = c.x - L.position.x, dy = c.y - L.position.y, dz = c.z - L.position.z;
          const d = Math.hypot(dx, dy, dz);
          if (d > far + R) continue;
          if (L.isSpotLight && d > R) {
            // sphere vs cone: the angle to the axis minus the sphere's
            // angular radius must be inside the cone's half-angle
            const along = dx * ax + dy * ay + dz * az;
            const perp = Math.sqrt(Math.max(0, d * d - along * along));
            if (along * sinA - perp * cosA < -R && along < d * cosA) continue;
          }
          if (c.moving) {
            const far = c.slow || (camera && Math.hypot(c.x - camera.position.x, c.z - camera.position.z) > 20);
            if (far) moveFar = true; else moveNear = true;
          }
          sig += c.id + ',';
        }
      }
      if (sig !== L._shSig) need = true;
      L._shSig = sig;
      if (this.shadowDirty) need = true;
      const li = this._shadowLights.indexOf(L), f = this._shFrame + li;
      if (!this.shadowThrottle) { if (moveNear || moveFar) need = true; }
      else if (moveNear ? (f & 1) === 0 : moveFar && (f & 3) === 0) need = true;
      if (need) L.shadow.needsUpdate = true;
    }
  }

  render(scene, camera, time) {
    const r = this.renderer, U = this.U;
    this.applyLook(scene);
    this.updateLightning(time);
    camera.updateMatrixWorld();
    U.uNear.value = camera.near;
    U.uFar.value = camera.far;
    U.uLightning.value = this.lightning;
    const savedMask = camera.layers.mask;
    const savedBg = scene.background;
    scene.background = null;
    r.getClearColor(this._clearColor);
    const savedAlpha = r.getClearAlpha();
    // GPU stage timings (debug/GpuProf.js, __noir.gpuProfile): off by default
    const P = this.prof;

    // ---- 1. normal + id --------------------------------------------------
    if (P) P.begin('id');
    camera.layers.set(LAYER.WORLD);
    camera.layers.enable(LAYER.GROUND);
    const S = this.skip;
    scene.overrideMaterial = this.idMat;
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.rtId);
    r.setClearColor(0x000000, 0);
    const vm = this.vm && this.vm.visible ? this.vm : null;
    if (vm) vm.camera.updateMatrixWorld();
    // The gun is drawn FIRST, then the world into the same depth (no clear
    // in between): the viewmodel camera's projection squeezes its depth into
    // [0, 5e-4] of the range (Viewmodel.js), so it always wins, and the
    // world's fragments under it are rejected by the early depth test instead
    // of being shaded and then painted over (the same pixels either way).
    const drawVm = (layer, override = null) => {
      vm.camera.layers.set(layer);
      vm.scene.overrideMaterial = override;
      r.render(vm.scene, vm.camera);
      vm.scene.overrideMaterial = null;
    };
    const ac0 = r.autoClear;
    r.autoClear = false;
    for (let k = 0; k <= (S.id ? 0 : (this.repeat.id || 0)); k++) {
      r.clear();
      if (vm) drawVm(LAYER.VIEWMODEL, this.idMat);
      if (!S.id) r.render(scene, camera);
    }
    r.autoClear = ac0;
    scene.overrideMaterial = null;
    U.tDepth.value = this.rtId.depthTexture;
    U.tNormalId.value = this.rtId.texture;

    // ---- 2. planar reflection (emitters only) + bright pass + streak -------
    // The street must not mirror the storm sky or the fogged-out distance as
    // 'light' (that turned the whole road into a white lake): clear to black
    // with alpha 0, and swap the fog colour to black for this pass only, so
    // the distance recedes into nothing. The sky dome is on its own layer and
    // never drawn here, nor is the ground mist (LAYER.MIST: its pools summed
    // with the far columns into a white plate under the vanishing point).
    // What remains: lamp heads, windows, headlights, fire, flashes, blood in
    // the air, lit surfaces; opaque geometry writes alpha 1. (The cones stay
    // out: air light has no place on the street to stand on - each lamp's
    // sheen comes from its head, placed by the mirror's depth.)
    if (P) P.begin('refl');
    this.updateReflectionCamera(camera);
    const reflHidden = this.reflHide ? this.reflHide(camera) : null;
    if (reflHidden) for (const o of reflHidden) o.visible = false;
    // (Phase 3b: the half-res, emitters-only mirror takes the light builds of
    // the el's stations and of the cars - black occluders there)
    if (this.reflLod && this.deferResolve) this.reflLod(true);
    U.uUseDepth.value = 0;
    this._fogSave.copy(U.uFogColor.value);
    U.uFogColor.value.setRGB(0, 0, 0);
    if (scene.fog) { this._sceneFogSave.copy(scene.fog.color); scene.fog.color.setRGB(0, 0, 0); }
    r.setRenderTarget(this.rtRefl);
    r.setClearColor(0x000000, 0);
    r.clear();
    const reflOn = !S.refl && (!this.look || this.look.reflect !== 'none');
    // In three parts: the world (opaque; its depth is where its light
    // stands), a copy of its light, then the sprites (fire, blood, sparks, a
    // Hood's flash: they write no depth - over the skyline a flame read as a
    // light 170 m away). What the sprites added is what the copy lacks; for
    // that light the position pass reads the sprites' OWN depth, drawn once
    // more into rtSpriteZ with their depth writes forced on (and nothing
    // else: that depth never touches the mirror's, so a lamp seen through
    // steam keeps its own place).
    // (The player's own flash stand-in, LAYER.REFL_ONLY, stays out: its
    // foot is under the gun, its sheen under the eye, out of the frame; its
    // point light still flashes the street.)
    if (reflOn) {
      this.reflCam.layers.set(LAYER.WORLD);
      for (let k = 0; k <= (this.repeat.refl || 0); k++) r.render(scene, this.reflCam);
      this.copyLumMat.uniforms.tSrc.value = this.rtRefl.texture;
      this.blit(this.copyLumMat, this.rtReflOpq);
      r.setRenderTarget(this.rtRefl);
      this.reflCam.layers.set(LAYER.FX_REFL);
      const acR = r.autoClear;
      r.autoClear = false;
      r.render(scene, this.reflCam);
      r.autoClear = acR;
      const mats = this._spriteMats;
      mats.length = 0;
      const bit = 1 << LAYER.FX_REFL;
      scene.traverseVisible((o) => {
        const m = o.material;
        if (m && !Array.isArray(m) && (o.layers.mask & bit) && !m.depthWrite) { mats.push(m, m.colorWrite); m.depthWrite = true; m.colorWrite = false; }
      });
      r.setRenderTarget(this.rtSpriteZ);
      r.clear();
      if (mats.length) r.render(scene, this.reflCam);
      for (let i = 0; i < mats.length; i += 2) { mats[i].depthWrite = false; mats[i].colorWrite = mats[i + 1]; }
    }
    U.uFogColor.value.copy(this._fogSave);
    if (scene.fog) scene.fog.color.copy(this._sceneFogSave);
    U.uUseDepth.value = 1;
    if (reflHidden) for (const o of reflHidden) o.visible = true;
    if (this.reflLod && this.deferResolve) this.reflLod(false);
    // bright pass: half -> quarter res; keep = max(0, lum - T)
    if (P) P.begin('reflPost');
    const bp = this.reflBrightMat.uniforms;
    bp.tSrc.value = this.rtRefl.texture;
    bp.uTexel.value.set(1 / this.rtRefl.width, 1 / this.rtRefl.height);
    bp.uThreshold.value = this.reflThreshold;
    this.blit(this.reflBrightMat, this.rtStreakA);
    // where each bright texel's emitter stands (the mirror's depth)
    const pp = this.reflPosMat.uniforms;
    pp.tSrc.value = this.rtRefl.texture;
    pp.tOpq.value = this.rtReflOpq.texture;
    pp.tSpriteZ.value = this.rtSpriteZ.depthTexture;
    pp.tDepth.value = this.rtRefl.depthTexture;
    pp.uTexel.value.set(1 / this.rtRefl.width, 1 / this.rtRefl.height);
    pp.uProjInv.value.copy(this.reflCam.projectionMatrixInverse);
    pp.uCamWorld.value.copy(this.reflCam.matrixWorld);
    pp.uEye.value.copy(this._v.camPos);
    this.blit(this.reflPosMat, this.rtReflPos);
    // the street's sheens: one per emitter, from its foot toward the eye
    const su = this.splat.material.uniforms, W = this._v.win;
    su.tBright.value = this.rtStreakA.texture;
    su.tPos.value = this.rtReflPos.texture;
    su.uVP.value.copy(this._v.vp);
    su.uProjInvR.value.copy(this.reflCam.projectionMatrixInverse);
    su.uCamWorldR.value.copy(this.reflCam.matrixWorld);
    su.uEye.value.copy(this._v.camPos);
    su.uPlaneY.value = this._v.planePos.y;
    su.uTexelTan.value = (W.xR - W.xL) / this.rtStreakA.width;
    r.setRenderTarget(this.rtStreakB);
    r.setClearColor(0x000000, 0);
    r.clear();
    if (reflOn) r.render(this.splatScene, this.quadCam);
    U.tRefl.value = this.rtRefl.texture;
    U.tReflBlur.value = this.rtStreakB.texture;

    // ---- 3. scene -----------------------------------------------------------
    if (P) P.begin('scene');
    camera.layers.enableAll();
    camera.layers.disable(LAYER.VOLUME);
    camera.layers.disable(LAYER.MIST);
    camera.layers.disable(LAYER.RAIN);
    camera.layers.disable(LAYER.VIEWMODEL);
    camera.layers.disable(LAYER.VM_FX);
    camera.layers.disable(LAYER.REFL_ONLY);
    camera.layers.disable(LAYER.VOL_POST);
    r.shadowMap.autoUpdate = !S.shadows;
    if (this.shadowCache && !S.shadows) { this.updateShadowFlags(scene, camera); this.shadowDirty = false; }
    r.setRenderTarget(this.rtScene);
    r.setClearColor(this.fogColor, 1);
    r.clear();
    // the gun first (see the id pass: the world under it is depth-rejected,
    // most of all the expensive wet street), then the world, then the flash
    // sprites on the gun (only while there are any: every render call into
    // this MSAA target costs a full-screen resolve)
    r.autoClear = false;
    const vmFx = vm && (!vm.fxLive || vm.fxLive());
    // (the gun's own scene has no shadow casting lights: its hold is simple;
    // the world's render arms the hold behind its shadow maps)
    const hold = (on) => { this.rtScene._holdResolve = on && this.deferResolve; };
    if (vm) { hold(!S.scene || vmFx); drawVm(LAYER.VIEWMODEL); hold(false); }
    if (!S.scene) {
      this._armHold = vmFx && this.deferResolve;
      r.render(scene, camera);
      this._armHold = false;
      hold(false);
      r.shadowMap.autoUpdate = false;
      for (let k = 0; k < (this.repeat.scene || 0); k++) { r.clear(); if (vm) drawVm(LAYER.VIEWMODEL); r.render(scene, camera); }
    }
    r.shadowMap.autoUpdate = false;
    if (vmFx) drawVm(LAYER.VM_FX);
    r.autoClear = ac0;

    // ---- 4. volume light (half res) + rain (full res) --------------------------
    if (P) P.begin('vol');
    r.shadowMap.autoUpdate = false;
    camera.layers.set(LAYER.VOLUME);
    camera.layers.enable(LAYER.MIST);
    U.uRes.value.set(this.rtVolume.width, this.rtVolume.height);
    r.setRenderTarget(this.rtVolume);
    r.setClearColor(0x000000, 1);
    r.clear();
    if (!S.vol) for (let k = 0; k <= (this.repeat.vol || 0); k++) r.render(scene, camera);
    // feather: cones must dissolve into the rain, never end in a ruled edge
    if (P) P.begin('volBlur');
    const bu = this.blurMat.uniforms;
    bu.tSrc.value = this.rtVolume.texture;
    bu.uDir.value.set(1 / this.rtVolume.width, 0);
    this.blit(this.blurMat, this.rtVolTmp);
    bu.tSrc.value = this.rtVolTmp.texture;
    bu.uDir.value.set(0, 1 / this.rtVolume.height);
    this.blit(this.blurMat, this.rtVolume);
    // the muzzle puff's occluder after the feather (LAYER.VOL_POST): the air
    // light behind it is cut at its own frayed edge (only while one hangs)
    if (this.volPost && this.volPost()) {
      camera.layers.set(LAYER.VOL_POST);
      r.setRenderTarget(this.rtVolume);
      const ac1 = r.autoClear;
      r.autoClear = false;
      r.render(scene, camera);
      r.autoClear = ac1;
    }
    if (P) P.begin('rain');
    camera.layers.set(LAYER.RAIN);
    U.uRes.value.set(this.width, this.height);
    r.setRenderTarget(this.rtRain);
    r.setClearColor(0x000000, 1);
    r.clear();
    if (!S.vol) r.render(scene, camera);
    camera.layers.mask = savedMask;

    // ---- 5. bloom -------------------------------------------------------------
    if (P) P.begin('bloom');
    const pf = this.prefilterMat.uniforms;
    pf.tSrc.value = this.rtScene.texture;
    pf.uTexel.value.set(1 / this.width, 1 / this.height);
    this.blit(this.prefilterMat, this.bloom[0]);
    for (let i = 1; i < (S.bloom ? 0 : BLOOM_LEVELS); i++) {
      const src = this.bloom[i - 1];
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.blit(this.downMat, this.bloom[i]);
    }
    for (let i = S.bloom ? -1 : BLOOM_LEVELS - 2; i >= 0; i--) {
      const src = this.bloom[i + 1];
      // (the last level: the wide upsample over its mips)
      const m = i + 2 === BLOOM_LEVELS ? this.upWideMat : this.upMat;
      m.uniforms.tSrc.value = src.texture;
      m.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      // wider mips count for less: a tight hot halo, not a fog of glow
      m.uniforms.uScale.value = 0.55;
      this.blit(m, this.bloom[i], false);
    }

    // ---- 6. ink -----------------------------------------------------------------
    if (P) P.begin('ink');
    const iu = this.inkMat.uniforms;
    iu.tScene.value = this.rtScene.texture;
    iu.tBloom.value = this.bloom[0].texture;
    iu.tVolume.value = this.rtVolume.texture;
    iu.tRainBuf.value = this.rtRain.texture;
    iu.tNormalId.value = this.rtId.texture;
    iu.tDepth.value = this.rtId.depthTexture;
    iu.uTime.value = time;
    iu.uBoil.value = Math.floor(time * 8) / 8;
    iu.uNear.value = camera.near;
    iu.uFar.value = camera.far;
    iu.uProjInv.value.copy(camera.projectionMatrixInverse);
    if (vm) {
      iu.uProjInvVM.value.copy(vm.camera.projectionMatrixInverse);
      iu.uVmFrame.value.copy(vm.frameInv);
    }
    iu.uViewInv.value.copy(camera.matrixWorld);
    iu.uLightning.value = this.lightning;
    iu.uKick.value = this.kick || 0;
    // lightning shows the rain everywhere, not only inside the cones
    iu.uRain.value = (1 + 2.2 * Math.min(1, this.lightning) + 1.2 * (this.rainBoost || 0)) * (this.look ? this.look.rainOverlay : 1);
    iu.uRain3.value = 1 + 1.5 * Math.min(1, this.lightning);
    iu.uView.value = this.view;
    const pxPerRad = this.height / THREE.MathUtils.degToRad(camera.fov);
    iu.uBrushPan.value.set(-camera.rotation.y * pxPerRad + time * 2.0, camera.rotation.x * pxPerRad + time * 1.3);
    for (let i = 0; i < 4; i++) {
      const L = this.rimLamps[i];
      const out = iu.uRimLamps.value[i];
      if (L) {
        this._v.tmp.copy(L.position).applyMatrix4(camera.matrixWorldInverse);
        out.set(this._v.tmp.x, this._v.tmp.y, this._v.tmp.z, L.strength);
      } else out.set(0, 0, 0, 0);
    }
    if (!S.ink) for (let k = 0; k <= (this.repeat.ink || 0); k++) this.blit(this.inkMat, null);
    if (this.debugRT) {
      const src = { refl: this.rtRefl, reflA: this.rtRefl, bright: this.rtStreakA, streak: this.rtStreakB, pos: this.rtReflPos, vol: this.rtVolume }[this.debugRT];
      if (src) {
        this.debugMat.uniforms.tSrc.value = src.texture;
        this.debugMat.uniforms.uMode.value = this.debugRT === 'reflA' ? 1 : 0;
        this.blit(this.debugMat, null);
      }
    }

    r.setClearColor(this._clearColor, savedAlpha);
    scene.background = savedBg;
    if (P) P.frame();
  }
}
