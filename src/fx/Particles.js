import * as THREE from 'three';
import { NOIR_FOG_GLSL } from '../render/fog.js';

// A small instanced billboard particle system (one draw call per system).
// CPU integrates (gravity, drag, ground contact); the GPU faces each quad to
// the camera and, for `stretch` particles, aligns it with the particle's
// screen-space velocity and lengthens it with speed (blood streaks, sparks).
// Colours are linear HDR; alpha comes from an atlas cell and is cut crisp by
// default (ink shapes, not soft CG sprites). Fogged like the world.
//
// spawn({ pos, vel, life, size: [w, h], stretch, rot, spin, col: [r,g,b],
//         alpha, cell, gravity, drag, grow, fadeIn, ground, onGround })

const QUAD = (() => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
})();

export class Particles {
  // alphaFromR: the map stores coverage in R with alpha = 1 (the soft puff
  //   of render/textures.js, shared with the steam); sampling .a there drew
  //   every smoke / dust puff as an opaque rotated square
  // keepChroma: blood. The fog only attenuates its colour (full coverage
  //   kept) instead of mixing it toward the grey fog colour, which
  //   desaturated a drop at 15-25 m to a half-grey the ink pass printed pink
  // occlude: smoke (Phase 3a). The volume pass paints the lamps' air light
  //   over the inked image from the opaque depth alone, so a translucent
  //   puff in front of a lit cone or the lit mist was washed out by the glow
  //   behind it (the warning smoke vanished against the mist). With occlude
  //   = k a second mesh (same instance data) is drawn LAST into the volume
  //   buffer, multiplying the air light by (1 - k * coverage): the smoke
  //   stands in front of the light like any dark mass.
  // distDim [near, far, k]: fire (Phase 3a review). Its HDR is far above what
  //   the ink needs to print it (full flame from ~0.3 up), and the surplus is
  //   what feeds the bloom: at 20-30 m the halo (a constant width in pixels)
  //   outgrew the small flames and read as a CG glow sprite. Past `near` m
  //   the scene colour is scaled toward k by `far` m (the print stays the
  //   same, only the bloom goes); the planar reflection keeps full strength.
  // spark (Phase 3c review, the train's wheel sparks): no atlas cell - a
  //   solid round HEAD at the particle and a thin tapered LINE for its tail
  //   (the stretched part of the quad), drawn procedurally. The atlas cells
  //   cut crisp had holes, and over the el's girder every hole fell back to
  //   the ink's black iron: a bloomed smear peppered with black dots
  constructor(world, { max = 512, map, cells = [1, 1], blending = 'normal', layer = 3, crisp = true, name = 'particles', renderOrder = 2, reflGain = 1, cut = [0.38, 0.62], alphaFromR = false, keepChroma = false, occlude = 0, fogFade = 0, distDim = null, occLayer = 7, occMark = false, spark = false } = {}) {
    this.world = world;
    this.max = max;
    this.list = [];
    this.free = [];
    const g = new THREE.InstancedBufferGeometry();
    g.index = QUAD.index;
    g.setAttribute('position', QUAD.getAttribute('position'));
    g.setAttribute('uv', QUAD.getAttribute('uv'));
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.aPos = mk(3); this.aVel = mk(3); this.aSize = mk(3); this.aRot = mk(1); this.aCol = mk(4); this.aCell = mk(1);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iVel', this.aVel); g.setAttribute('iSize', this.aSize);
    g.setAttribute('iRot', this.aRot); g.setAttribute('iCol', this.aCol); g.setAttribute('iCell', this.aCell);
    g.instanceCount = 0;
    this.geo = g;
    const U = world.U;
    this.mat = new THREE.ShaderMaterial({
      name: 'NoirParticles_' + name,
      defines: spark ? { SPARK: 1 } : {},
      transparent: true,
      depthWrite: false,
      blending: blending === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        tMap: { value: map },
        uCells: { value: new THREE.Vector2(cells[0], cells[1]) },
        uCrisp: { value: crisp ? 1 : 0 },
        // crisp edge window on the atlas alpha (thin spikes fade in the
        // small mips: flashes use a lower window so they survive at range)
        uCut: { value: new THREE.Vector2(cut[0], cut[1]) },
        uAdd: { value: blending === 'add' ? 1 : 0 },
        uAlphaR: { value: alphaFromR ? 1 : 0 },
        uKeepChroma: { value: keepChroma ? 1 : 0 },
        uFogFade: { value: fogFade },
        uDistDim: { value: new THREE.Vector3(...(distDim || [1e4, 2e4, 1])) },
        // in the planar reflection (uUseDepth == 0) the wet street keeps only
        // light above its bright-pass threshold: blood is boosted there so a
        // burst leaves a red streak in the water like every lit thing
        uReflGain: { value: reflGain },
        uUseDepth: U.uUseDepth,
        uFogColor: U.uFogColor,
        uFogDensity: U.uFogDensity,
      },
      vertexShader: /* glsl */`
        attribute vec3 iPos, iVel, iSize;
        attribute float iRot, iCell;
        attribute vec4 iCol;
        uniform vec2 uCells;
        varying vec2 vUv;
        varying vec4 vCol;
        varying vec3 vView;
        varying float vWY;
        #ifdef SPARK
        varying float vHead;
        #endif
        void main() {
          vec4 mv = modelViewMatrix * vec4( iPos, 1.0 );
          vec2 ax = vec2( 1.0, 0.0 ), ay = vec2( 0.0, 1.0 );
          float h = iSize.y;
          vec2 q = position.xy;
          if ( iSize.z > 0.0 ) {
            // streak: the quad's long axis follows the projected velocity,
            // its tail trails behind the particle
            vec3 vv = ( modelViewMatrix * vec4( iVel, 0.0 ) ).xyz;
            float sl = length( vv.xy );
            if ( sl > 1e-4 ) { ay = vv.xy / sl; ax = vec2( ay.y, -ay.x ); }
            float L = sl * iSize.z;
            h += L;
            mv.xy -= ay * ( L * 0.5 );
          } else {
            float c = cos( iRot ), s = sin( iRot );
            ax = vec2( c, s ); ay = vec2( -s, c );
          }
          #ifdef SPARK
          // (the head's share of the quad's length: the rest is the tail)
          vHead = iSize.y / max( h, 1e-6 );
          #endif
          mv.xy += ax * q.x * iSize.x + ay * q.y * h;
          gl_Position = projectionMatrix * mv;
          float cx = mod( iCell, uCells.x ), cy = floor( iCell / uCells.x );
          vUv = ( vec2( cx, uCells.y - 1.0 - cy ) + uv ) / uCells;
          #ifdef SPARK
          vUv = uv;
          #endif
          vCol = iCol;
          vView = mv.xyz;
          vWY = iPos.y;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tMap;
        uniform float uCrisp, uAdd, uReflGain, uUseDepth, uAlphaR, uKeepChroma, uFogFade;
        uniform vec2 uCut;
        uniform vec3 uDistDim;
        varying vec2 vUv;
        varying vec4 vCol;
        varying vec3 vView;
        varying float vWY;
        #ifdef SPARK
        varying float vHead;
        #endif
        ${NOIR_FOG_GLSL}
        void main() {
          #ifdef SPARK
          // head: a disc at the front end (uv.y = 1 is the front); tail: a
          // line a third of the head's width, tapering to nothing at its end
          float hy = 1.0 - vHead * 0.5;
          vec2 hd = vec2( ( vUv.x - 0.5 ) * 2.0, ( vUv.y - hy ) / max( vHead * 0.5, 1e-4 ) );
          float head = step( length( hd ), 1.0 );
          float ty = clamp( vUv.y / max( 1.0 - vHead * 0.5, 1e-4 ), 0.0, 1.0 );
          float tail = step( abs( vUv.x - 0.5 ), 0.17 * ty ) * step( vUv.y, hy );
          float a = max( head, tail ) * vCol.a;
          #else
          vec4 tx = texture2D( tMap, vUv );
          float t = uAlphaR > 0.5 ? tx.r : tx.a;
          float a = mix( t, smoothstep( uCut.x, uCut.y, t ), uCrisp ) * vCol.a;
          #endif
          vec3 c = vCol.rgb * ( uUseDepth < 0.5 ? uReflGain : mix( 1.0, uDistDim.z, smoothstep( uDistDim.x, uDistDim.y, length( vView ) ) ) );
          vec4 nf = noirFog( length( vView ), vWY, uFogDensity, uFogColor );
          if ( a < 0.01 ) discard;
          #ifdef SPARK
          // (a hair blue - the ink's tag for an emitter over the el's iron:
          // it prints the spark, partly covered pixels too, instead of
          // holding it to the black iron; never kept as colour, sat ~0.08)
          c *= vec3( 0.92, 0.92, 1.0 );
          #endif
          c = ( uAdd > 0.5 || uKeepChroma > 0.5 ) ? c * ( 1.0 - nf.a ) : mix( c, nf.rgb, nf.a );
          // (soft washes - smoke - thin out into the haze instead of printing
          // as pale fog-coloured ghosts over the dark towers behind them)
          a *= 1.0 - uFogFade * nf.a;
          gl_FragColor = vec4( c * ( uAdd > 0.5 ? a : 1.0 ), uAdd > 0.5 ? 1.0 : a );
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(layer);
    this.mesh.renderOrder = renderOrder;
    this.mesh.name = name;
    world.scene.add(this.mesh);
    if (occlude > 0) {
      const om = this.mat.clone();
      om.uniforms = { ...this.mat.uniforms, uOcc: { value: occlude } };
      om.fragmentShader = this.mat.fragmentShader.replace('uniform float uCrisp', 'uniform float uOcc;\n        uniform float uCrisp')
        .replace('gl_FragColor = vec4( c * ( uAdd > 0.5 ? a : 1.0 ), uAdd > 0.5 ? 1.0 : a );', 'gl_FragColor = vec4( 0.0, 0.0, 0.0, clamp( a * uOcc * ( 1.0 - nf.a ), 0.0, 1.0 ) );');
      // dst.rgb *= 1 - srcA ; alpha untouched
      // (and the coverage into its ALPHA, cleared to 1: dstA *= 1 - srcA; the
      // ink pass reads 1 - alpha as 'smoke covers this pixel')
      Object.assign(om, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, depthTest: false });
      // occMark (the muzzle puff, Phase 3c): its coverage is also laid into
      // the volume buffer's BLUE channel (unused by the air light: r = cone
      // light, g = its share on the surface), premultiplied 'over' - the ink
      // pass prints the puff in flat banded washes by it
      if (occMark) {
        om.fragmentShader = om.fragmentShader.replace('gl_FragColor = vec4( 0.0, 0.0, 0.0, clamp( a * uOcc * ( 1.0 - nf.a ), 0.0, 1.0 ) );',
          'float oa = clamp( a * uOcc * ( 1.0 - nf.a ), 0.0, 1.0 );\n          gl_FragColor = vec4( 0.0, 0.0, oa, oa );');
        om.blendSrc = THREE.OneFactor;
      }
      this.occ = new THREE.Mesh(g, om);
      this.occ.frustumCulled = false;
      this.occ.layers.set(occLayer);   // LAYER.MIST (default): the volume pass only, never the reflection
      this.occ.renderOrder = 50;
      this.occ.name = name + 'Occ';
      world.scene.add(this.occ);
    }
  }

  spawn(o) {
    let p;
    if (this.list.length >= this.max) {
      // reuse the oldest
      p = this.list.shift();
    } else p = this.free.pop() || { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
    p.pos.copy(o.pos);
    if (o.vel) p.vel.copy(o.vel); else p.vel.set(0, 0, 0);
    p.life = o.life ?? 1;
    p.age = 0;
    p.w = o.size ? o.size[0] : 0.05;
    p.h = o.size ? o.size[1] : p.w;
    p.stretch = o.stretch ?? 0;
    p.rot = o.rot ?? 0;
    p.spin = o.spin ?? 0;
    p.r = o.col ? o.col[0] : 1; p.g = o.col ? o.col[1] : 1; p.b = o.col ? o.col[2] : 1;
    p.alpha = o.alpha ?? 1;
    p.cell = o.cell ?? 0;
    p.gravity = o.gravity ?? 0;
    p.drag = o.drag ?? 0;
    p.grow = o.grow ?? 0;
    p.fadeIn = o.fadeIn ?? 0;
    p.fadeOut = o.fadeOut ?? 0.35;   // share of the life spent fading
    p.ground = o.ground ?? null;     // y of the ground (null = no contact)
    p.onGround = o.onGround || null;
    p.bounce = o.bounce ?? 0;
    p.hold = false;
    p.anchor = o.anchor ?? null;
    // colour over life (Phase 3: a fireball's white-hot -> orange -> soot):
    // col -> colEnd along pow(age / life, colPow)
    p.col2 = o.colEnd || null;
    p.colPow = o.colPow ?? 1;
    // lit: a brief extra brightness at birth, fading over litT s (muzzle
    // smoke caught by the flash light)
    p.lit = o.lit ?? 0;
    p.litT = o.litT ?? 0.1;
    this.list.push(p);
    return p;
  }

  clear() { for (const p of this.list) this.free.push(p); this.list.length = 0; this.geo.instanceCount = 0; }

  update(dt) {
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (!p.hold) {
        p.age += dt;
        if (p.age >= p.life) { this.free.push(p); continue; }
        p.vel.y -= p.gravity * dt;
        if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        p.rot += p.spin * dt;
        p.w += p.grow * dt; p.h += p.grow * dt;
        if (p.ground !== null && p.pos.y <= p.ground) {
          p.pos.y = p.ground;
          if (p.onGround && p.onGround(p) === false) { this.free.push(p); continue; }
          if (p.bounce > 0 && p.vel.y < -0.5) { p.vel.y *= -p.bounce; p.vel.x *= 0.5; p.vel.z *= 0.5; } else { this.free.push(p); continue; }
        }
      }
      L[w++] = p;
    }
    L.length = w;
    this.write();
  }

  write() {
    const L = this.list, n = L.length;
    const P = this.aPos.array, V = this.aVel.array, S = this.aSize.array, R = this.aRot.array, C = this.aCol.array, T = this.aCell.array;
    for (let i = 0; i < n; i++) {
      const p = L[i];
      const u = p.age / p.life;
      let a = p.alpha;
      if (p.fadeIn > 0) a *= Math.min(1, u / p.fadeIn);
      if (p.fadeOut > 0) a *= Math.min(1, (1 - u) / p.fadeOut);
      P[i * 3] = p.pos.x; P[i * 3 + 1] = p.pos.y; P[i * 3 + 2] = p.pos.z;
      V[i * 3] = p.vel.x; V[i * 3 + 1] = p.vel.y; V[i * 3 + 2] = p.vel.z;
      S[i * 3] = p.w; S[i * 3 + 1] = p.h; S[i * 3 + 2] = p.stretch;
      R[i] = p.rot;
      let cr = p.r, cg = p.g, cb = p.b;
      if (p.col2) {
        const k = Math.pow(Math.min(1, u), p.colPow);
        cr += (p.col2[0] - cr) * k; cg += (p.col2[1] - cg) * k; cb += (p.col2[2] - cb) * k;
      }
      if (p.lit > 0 && p.age < p.litT) { const k = 1 + p.lit * (1 - p.age / p.litT); cr *= k; cg *= k; cb *= k; }
      C[i * 4] = cr; C[i * 4 + 1] = cg; C[i * 4 + 2] = cb; C[i * 4 + 3] = a;
      T[i] = p.cell;
    }
    if (n > 0 || this.geo.instanceCount > 0) {
      for (const a of [this.aPos, this.aVel, this.aSize, this.aRot, this.aCol, this.aCell]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, Math.max(1, n) * a.itemSize);
        a.needsUpdate = true;
      }
    }
    this.geo.instanceCount = n;
    // (Phase 3c performance: an empty system is not drawn at all - three
    // binds the program and issues a zero-instance draw in every pass that
    // sees its layer; ~a dozen of the systems are empty most frames)
    this.mesh.visible = n > 0;
    if (this.occ) this.occ.visible = n > 0;
  }
}
