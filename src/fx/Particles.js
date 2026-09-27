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
  constructor(world, { max = 512, map, cells = [1, 1], blending = 'normal', layer = 3, crisp = true, name = 'particles', renderOrder = 2, reflGain = 1, cut = [0.38, 0.62], alphaFromR = false, keepChroma = false } = {}) {
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
          mv.xy += ax * q.x * iSize.x + ay * q.y * h;
          gl_Position = projectionMatrix * mv;
          float cx = mod( iCell, uCells.x ), cy = floor( iCell / uCells.x );
          vUv = ( vec2( cx, uCells.y - 1.0 - cy ) + uv ) / uCells;
          vCol = iCol;
          vView = mv.xyz;
          vWY = iPos.y;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tMap;
        uniform float uCrisp, uAdd, uReflGain, uUseDepth, uAlphaR, uKeepChroma;
        uniform vec2 uCut;
        varying vec2 vUv;
        varying vec4 vCol;
        varying vec3 vView;
        varying float vWY;
        ${NOIR_FOG_GLSL}
        void main() {
          vec4 tx = texture2D( tMap, vUv );
          float t = uAlphaR > 0.5 ? tx.r : tx.a;
          float a = mix( t, smoothstep( uCut.x, uCut.y, t ), uCrisp ) * vCol.a;
          vec3 c = vCol.rgb * ( uUseDepth < 0.5 ? uReflGain : 1.0 );
          vec4 nf = noirFog( length( vView ), vWY, uFogDensity, uFogColor );
          if ( a < 0.01 ) discard;
          c = ( uAdd > 0.5 || uKeepChroma > 0.5 ) ? c * ( 1.0 - nf.a ) : mix( c, nf.rgb, nf.a );
          gl_FragColor = vec4( c * ( uAdd > 0.5 ? a : 1.0 ), uAdd > 0.5 ? 1.0 : a );
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(layer);
    this.mesh.renderOrder = renderOrder;
    this.mesh.name = name;
    world.scene.add(this.mesh);
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
      C[i * 4] = p.r; C[i * 4 + 1] = p.g; C[i * 4 + 2] = p.b; C[i * 4 + 3] = a;
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
  }
}
