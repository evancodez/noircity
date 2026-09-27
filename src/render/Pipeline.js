import * as THREE from 'three';
import { LAYER } from './layers.js';
import { makeIdMaterial } from './shaders/idpass.js';
import { makeInkMaterial } from './shaders/ink.js';
import { FULLSCREEN_VERT } from './shaders/common.js';
import { TONE_GLSL, toneUniforms, EXPOSURE } from './tone.js';
import { makeBloomPrefilter, makeBloomDown, makeBloomUp, makeStreakMaterial, makeBlurMaterial, makeReflBrightMaterial } from './shaders/bloom.js';

// Explicit render pipeline (DESIGN.md §3). Per frame:
//   1. normal+id pass   -> rtId (view normal xyz, object id w) + depth texture
//   2. planar reflection-> rtRefl (half res, mirrored camera, oblique clip),
//                          EMITTERS ONLY: black clear (alpha 0 = nothing
//                          mirrored), black fog, no sky; alpha = coverage
//      bright pass      -> rtStreakA (quarter res, mipmapped): light above T
//      long streak      -> rtStreakB (quarter res): one column per emitter
//   3. scene pass       -> rtScene (linear HDR, 4x MSAA); world shaders read
//                          rtId's depth for soft intersections
//   4. volume pass      -> rtVolume (half res): cones, beams; these shaders
//                          depth-test manually against rtId's depth; then a
//                          separable blur feathers every cone edge
//      rain pass        -> rtRain (FULL res): 3D rain streaks + splash rings,
//                          so the hairlines stay thin and never stair-step
//   5. bloom chain      -> bloom[0] (half res)
//   6. ink pass         -> canvas
// The viewmodel (player's gun, LAYER.VIEWMODEL) is drawn by its own camera
// (this.vm.camera: same eye, FOV ~50) into rtId and rtScene right after the
// world, its depth squeezed in front of the world's: it is inked by the same pass as the
// world (normals, ids, contours, brush) and can never clip into a wall. It is
// never reflected and never in the volume / rain passes; its muzzle flash
// sprites (LAYER.VM_FX) follow it in the scene pass only.
const BLOOM_LEVELS = 5;

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
    this.shadowCache = opts.shadowCache ?? true;
    this._shadowLights = null;

    const hf = THREE.HalfFloatType;
    this.rtId = new THREE.WebGLRenderTarget(1, 1, {
      type: hf,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    this.rtId.texture.name = 'rtId';
    this.rtScene = new THREE.WebGLRenderTarget(1, 1, { type: hf, samples: 4 });
    this.rtScene.texture.name = 'rtScene';
    this.rtRefl = new THREE.WebGLRenderTarget(1, 1, { type: hf });
    this.rtVolume = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false });
    this.rtVolume.texture.name = 'rtVolume';
    this.rtVolTmp = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false });
    this.rtRain = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false });
    this.rtRain.texture.name = 'rtRain';
    this.rtStreakA = new THREE.WebGLRenderTarget(1, 1, {
      type: hf, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.rtStreakB = new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false });
    this.bloom = [];
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      this.bloom.push(new THREE.WebGLRenderTarget(1, 1, { type: hf, depthBuffer: false }));
    }

    this.idMat = makeIdMaterial();
    this.inkMat = makeInkMaterial(tex, { uFogColor: U.uFogColor, uFogDensity: U.uFogDensity });
    this.prefilterMat = makeBloomPrefilter();
    this.downMat = makeBloomDown();
    this.upMat = makeBloomUp();
    this.streakMat = makeStreakMaterial();
    this.reflBrightMat = makeReflBrightMaterial();
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
    };
    this._clearColor = new THREE.Color();
    // debug/bench: skip individual passes to measure their cost (__noir.bench())
    this.skip = { id: false, refl: false, shadows: false, scene: false, vol: false, bloom: false, ink: false };
    this.repeat = {}; // bench: extra executions of a pass ({ ink: 10 })
    // debug: ?rt=refl|reflA|bright|streak shows an intermediate buffer through
    // the ink tone curve instead of the final image
    this.debugRT = opts.debugRT || null;
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

  setSize(cssW, cssH) {
    const w = Math.max(2, Math.floor(cssW * this.pixelRatio));
    const h = Math.max(2, Math.floor(cssH * this.pixelRatio));
    this.width = w; this.height = h;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(cssW, cssH, true);
    this.rtId.setSize(w, h);
    this.rtScene.setSize(w, h);
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    this.rtRefl.setSize(hw, hh);
    this.rtVolume.setSize(hw, hh);
    this.rtVolTmp.setSize(hw, hh);
    this.rtRain.setSize(w, h);
    const qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
    this.rtStreakA.setSize(qw, qh);
    this.rtStreakB.setSize(qw, qh);
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

    const tm = this.U.uReflMatrix.value;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(rc.projectionMatrix);
    tm.multiply(rc.matrixWorldInverse);
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
  updateShadowFlags(scene) {
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
      let sig = '';
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
          if (c.moving) need = true;
          sig += c.id + ',';
        }
      }
      if (sig !== L._shSig) need = true;
      L._shSig = sig;
      if (this.shadowDirty) need = true;
      if (need) L.shadow.needsUpdate = true;
    }
  }

  render(scene, camera, time) {
    const r = this.renderer, U = this.U;
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

    // ---- 1. normal + id --------------------------------------------------
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
    // What remains: lamp heads, cones, windows, headlights, lit surfaces;
    // opaque geometry writes alpha 1.
    this.updateReflectionCamera(camera);
    const reflHidden = this.reflHide ? this.reflHide(camera) : null;
    if (reflHidden) for (const o of reflHidden) o.visible = false;
    this.reflCam.layers.set(LAYER.WORLD);
    this.reflCam.layers.enable(LAYER.FX_REFL);
    this.reflCam.layers.enable(LAYER.VOLUME);
    this.reflCam.layers.enable(LAYER.REFL_ONLY);
    U.uUseDepth.value = 0;
    this._fogSave.copy(U.uFogColor.value);
    U.uFogColor.value.setRGB(0, 0, 0);
    if (scene.fog) { this._sceneFogSave.copy(scene.fog.color); scene.fog.color.setRGB(0, 0, 0); }
    r.setRenderTarget(this.rtRefl);
    r.setClearColor(0x000000, 0);
    r.clear();
    if (!S.refl) for (let k = 0; k <= (this.repeat.refl || 0); k++) r.render(scene, this.reflCam);
    U.uFogColor.value.copy(this._fogSave);
    if (scene.fog) scene.fog.color.copy(this._sceneFogSave);
    U.uUseDepth.value = 1;
    if (reflHidden) for (const o of reflHidden) o.visible = true;
    // bright pass: half -> quarter res; keep = max(0, lum - T)
    const bp = this.reflBrightMat.uniforms;
    bp.tSrc.value = this.rtRefl.texture;
    bp.uTexel.value.set(1 / this.rtRefl.width, 1 / this.rtRefl.height);
    bp.uThreshold.value = this.reflThreshold;
    const rpm = this.reflCam.projectionMatrix.elements;
    bp.uFocal.value.set(rpm[0], rpm[5]);
    bp.uCamRot.value.setFromMatrix4(this.reflCam.matrixWorld);
    bp.uEyeH.value = Math.max(0.3, this._v.camPos.y - this._v.planePos.y);
    this.blit(this.reflBrightMat, this.rtStreakA);
    // long vertical streak: each emitter leaves one column down the frame
    const sm = this.streakMat.uniforms;
    sm.tSrc.value = this.rtStreakA.texture;
    sm.uTexel.value.set(1 / this.rtStreakA.width, 1 / this.rtStreakA.height);
    this.blit(this.streakMat, this.rtStreakB);
    U.tRefl.value = this.rtRefl.texture;
    U.tReflBlur.value = this.rtStreakB.texture;

    // ---- 3. scene -----------------------------------------------------------
    camera.layers.enableAll();
    camera.layers.disable(LAYER.VOLUME);
    camera.layers.disable(LAYER.MIST);
    camera.layers.disable(LAYER.RAIN);
    camera.layers.disable(LAYER.VIEWMODEL);
    camera.layers.disable(LAYER.VM_FX);
    camera.layers.disable(LAYER.REFL_ONLY);
    r.shadowMap.autoUpdate = !S.shadows;
    if (this.shadowCache && !S.shadows) { this.updateShadowFlags(scene); this.shadowDirty = false; }
    r.setRenderTarget(this.rtScene);
    r.setClearColor(this.fogColor, 1);
    r.clear();
    // the gun first (see the id pass: the world under it is depth-rejected,
    // most of all the expensive wet street), then the world, then the flash
    // sprites on the gun (only while there are any: every render call into
    // this MSAA target costs a full-screen resolve)
    r.autoClear = false;
    if (vm) drawVm(LAYER.VIEWMODEL);
    if (!S.scene) {
      r.render(scene, camera);
      r.shadowMap.autoUpdate = false;
      for (let k = 0; k < (this.repeat.scene || 0); k++) { r.clear(); if (vm) drawVm(LAYER.VIEWMODEL); r.render(scene, camera); }
    }
    r.shadowMap.autoUpdate = false;
    if (vm && (!vm.fxLive || vm.fxLive())) drawVm(LAYER.VM_FX);
    r.autoClear = ac0;

    // ---- 4. volume light (half res) + rain (full res) --------------------------
    r.shadowMap.autoUpdate = false;
    camera.layers.set(LAYER.VOLUME);
    camera.layers.enable(LAYER.MIST);
    U.uRes.value.set(this.rtVolume.width, this.rtVolume.height);
    r.setRenderTarget(this.rtVolume);
    r.setClearColor(0x000000, 1);
    r.clear();
    if (!S.vol) for (let k = 0; k <= (this.repeat.vol || 0); k++) r.render(scene, camera);
    // feather: cones must dissolve into the rain, never end in a ruled edge
    const bu = this.blurMat.uniforms;
    bu.tSrc.value = this.rtVolume.texture;
    bu.uDir.value.set(1 / this.rtVolume.width, 0);
    this.blit(this.blurMat, this.rtVolTmp);
    bu.tSrc.value = this.rtVolTmp.texture;
    bu.uDir.value.set(0, 1 / this.rtVolume.height);
    this.blit(this.blurMat, this.rtVolume);
    camera.layers.set(LAYER.RAIN);
    U.uRes.value.set(this.width, this.height);
    r.setRenderTarget(this.rtRain);
    r.setClearColor(0x000000, 1);
    r.clear();
    if (!S.vol) r.render(scene, camera);
    camera.layers.mask = savedMask;

    // ---- 5. bloom -------------------------------------------------------------
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
      this.upMat.uniforms.tSrc.value = src.texture;
      this.upMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      // wider mips count for less: a tight hot halo, not a fog of glow
      this.upMat.uniforms.uScale.value = 0.55;
      this.blit(this.upMat, this.bloom[i], false);
    }

    // ---- 6. ink -----------------------------------------------------------------
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
    iu.uRain.value = 1 + 2.2 * Math.min(1, this.lightning) + 1.2 * (this.rainBoost || 0);
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
      const src = { refl: this.rtRefl, reflA: this.rtRefl, bright: this.rtStreakA, streak: this.rtStreakB, vol: this.rtVolume }[this.debugRT];
      if (src) {
        this.debugMat.uniforms.tSrc.value = src.texture;
        this.debugMat.uniforms.uMode.value = this.debugRT === 'reflA' ? 1 : 0;
        this.blit(this.debugMat, null);
      }
    }

    r.setClearColor(this._clearColor, savedAlpha);
    scene.background = savedBg;
  }
}
