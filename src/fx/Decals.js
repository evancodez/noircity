import * as THREE from 'three';
import { NOIR_FOG_GLSL } from '../render/fog.js';
import { LAYER } from '../render/layers.js';
import { ATLAS, GLASS } from './fxTextures.js';

// Persistent decals: blood splatter, corpse pools, dark bullet/chip marks.
// Two instanced quad pools (one draw call each), ring buffers that reuse the
// oldest decal when full (~200 each):
//   ground  - on the street / pavements (LAYER.FX: scene pass only; a stain
//             ON the water plane is not mirrored by it)
//   surface - walls, cars, columns (LAYER.FX_REFL: the wet street mirrors
//             blood on a car door or a column like any lit object)
// Pools grow over ~5 s: the atlas' graded POOL field is thresholded by the
// pool's age, so the stain spreads with a ragged, noisy rim.

const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _s = new THREE.Vector3(), _p = new THREE.Vector3();

class DecalPool {
  constructor(world, map, max, layer, name, reflGain = 1, cells = [ATLAS.cols, ATLAS.rows]) {
    this.max = max;
    this.next = 0;
    this.count = 0;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aInfo = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    geo.setAttribute('iCol', this.aCol);
    geo.setAttribute('iInfo', this.aInfo);
    const U = world.U;
    this.mat = new THREE.ShaderMaterial({
      name: 'NoirDecals_' + name,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
      uniforms: {
        tMap: { value: map },
        uCells: { value: new THREE.Vector2(cells[0], cells[1]) },
        uTime: U.uTime,
        uReflGain: { value: reflGain },
        uUseDepth: U.uUseDepth,
        uFogColor: U.uFogColor,
        uFogDensity: U.uFogDensity,
      },
      vertexShader: /* glsl */`
        attribute vec4 iCol, iInfo;
        uniform vec2 uCells;
        varying vec2 vUv, vLocal;
        varying vec4 vCol, vInfo;
        varying vec3 vView;
        varying float vWY;
        void main() {
          vec4 wp = modelMatrix * instanceMatrix * vec4( position, 1.0 );
          vec4 mv = viewMatrix * wp;
          gl_Position = projectionMatrix * mv;
          float cell = iInfo.x;
          float cx = mod( cell, uCells.x ), cy = floor( cell / uCells.x );
          vUv = ( vec2( cx, uCells.y - 1.0 - cy ) + uv ) / uCells;
          vLocal = uv;
          vCol = iCol;
          vInfo = iInfo;
          vView = mv.xyz;
          vWY = wp.y;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tMap;
        uniform float uTime, uReflGain, uUseDepth;
        varying vec2 vUv, vLocal;
        varying vec4 vCol, vInfo;
        varying vec3 vView;
        varying float vWY;
        ${NOIR_FOG_GLSL}
        void main() {
          // keep inside the atlas cell (mip bleed)
          vec2 e = abs( vLocal - 0.5 );
          if ( max( e.x, e.y ) > 0.49 ) discard;
          float t = texture2D( tMap, vUv ).a;
          float a;
          if ( vInfo.w > 0.5 ) {
            // pool: grows over vInfo.z seconds from vInfo.y, fast at first
            float g = clamp( ( uTime - vInfo.y ) / max( vInfo.z, 1e-3 ), 0.0, 1.0 );
            g = 1.0 - ( 1.0 - g ) * ( 1.0 - g );
            float th = mix( 0.97, 0.06, g );
            a = smoothstep( th, th + 0.035, t );
          } else {
            a = smoothstep( 0.4, 0.6, t );
          }
          a *= vCol.a;
          if ( a < 0.02 ) discard;
          vec4 nf = noirFog( length( vView ), vWY, uFogDensity, uFogColor );
          vec3 c = vCol.rgb * ( uUseDepth < 0.5 ? uReflGain : 1.0 );
          // blood (chromatic) is only attenuated by the fog: mixed toward the
          // grey fog colour it desaturated and printed pink at range
          float chroma = step( 0.5, ( vCol.r - vCol.g ) / max( vCol.r, 1e-5 ) );
          gl_FragColor = vec4( mix( mix( c, nf.rgb, nf.a ), c * ( 1.0 - nf.a ), chroma ), a );
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.count = 0;
    // (an empty pool is not drawn: Phase 3c performance)
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(layer);
    this.mesh.renderOrder = 1;
    this.mesh.name = 'decals_' + name;
    world.scene.add(this.mesh);
    this.owner = new Array(max).fill(null);
  }

  // hide every decal tagged with `owner` (a shattered pane takes its cracks)
  hideOwner(owner) {
    let n = 0;
    for (let i = 0; i < this.max; i++) if (this.owner[i] === owner) { this.aCol.setW(i, 0); this.owner[i] = null; n++; }
    if (n) this.aCol.needsUpdate = true;
  }

  add(pos, normal, size, rot, cell, col, alpha, pool = null, time = 0, owner = null) {
    const i = this.next;
    this.owner[i] = owner;
    this.next = (this.next + 1) % this.max;
    this.count = Math.min(this.max, this.count + 1);
    _z.copy(normal).normalize();
    _x.set(1, 0, 0);
    if (Math.abs(_z.x) > 0.9) _x.set(0, 0, 1);
    _x.addScaledVector(_z, -_x.dot(_z)).normalize();
    _y.crossVectors(_z, _x);
    const c = Math.cos(rot), s = Math.sin(rot);
    const xr = _p.copy(_x).multiplyScalar(c).addScaledVector(_y, s);
    _y.crossVectors(_z, xr);
    _m.makeBasis(xr, _y, _z);
    _q.setFromRotationMatrix(_m);
    if (Array.isArray(size)) _s.set(size[0], size[1], 1); else _s.set(size, size, 1);
    _m.compose(pos, _q, _s);
    this.mesh.setMatrixAt(i, _m);
    this.aCol.setXYZW(i, col[0], col[1], col[2], alpha);
    this.aInfo.setXYZW(i, cell, pool ? time : 0, pool ? pool.grow : 0, pool ? 1 : 0);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aInfo.needsUpdate = true;
    this.mesh.count = this.count;
    this.mesh.visible = true;
    return i;
  }

  clear() { this.next = 0; this.count = 0; this.mesh.count = 0; this.mesh.visible = false; }
}

export const BLOOD_DECAL = [0.085, 0.00034, 0.0034];   // prints ~#c8102e
export const BLOOD_POOL = [0.05, 0.0002, 0.002];      // a touch deeper
const INK = [0.0035, 0.0035, 0.0035];
// fracture lines: a pale grey that prints as broken white lines on dark glass
const CRACK_COL = [0.16, 0.16, 0.16];

export class Decals {
  constructor(world, atlas, glassAtlas = null) {
    this.world = world;
    this.ground = new DecalPool(world, atlas, 220, LAYER.FX, 'ground');
    this.surface = new DecalPool(world, atlas, 200, LAYER.FX_REFL, 'surface', 6);
    this.pools = new DecalPool(world, atlas, 40, LAYER.FX, 'pools');
    // Phase 3a: cracks and holes in glass (car windows, the façade, the
    // phone booth), their own atlas (fxTextures GLASS)
    if (glassAtlas) this.glass = new DecalPool(world, glassAtlas, 90, LAYER.FX, 'glass', 1, [GLASS.cols, GLASS.rows]);
    this.rng = world.rng.fork(907);
  }

  // spider crack (pale fracture lines) or a punched hole (black blot with
  // cracks) on a pane; `owner` lets the pane take them back when it goes
  crack(pos, normal, size = 0.35, owner = null) {
    const r = this.rng;
    const p = _p.copy(pos).addScaledVector(normal, 0.006);
    return this.glass.add(p.clone(), normal, size * r.range(0.8, 1.2), r.next() * Math.PI * 2, GLASS.CRACK[r.int(0, 1)], CRACK_COL, 0.95, null, 0, owner);
  }
  hideOwner(owner) { if (this.glass) this.glass.hideOwner(owner); }
  // a shot-out pane: a black jagged hole the pane's size (w x h, local x
  // horizontal), glass teeth left round the frame
  paneHole(pos, normal, w, h) {
    const r = this.rng;
    const p = _p.copy(pos).addScaledVector(normal, 0.008);
    return this.glass.add(p.clone(), normal, [w * 1.02, h * 1.02], r.gauss() * 0.02, GLASS.PANE[r.int(0, 3)], INK, 1);
  }
  hole(pos, normal, size = 0.5, owner = null, alpha = 1) {
    const r = this.rng;
    const p = _p.copy(pos).addScaledVector(normal, 0.008);
    return this.glass.add(p.clone(), normal, size * r.range(0.85, 1.15), r.next() * Math.PI * 2, GLASS.HOLE[r.int(0, 1)], INK, alpha, null, 0, owner);
  }

  // blood splatter on any surface; `up` normals go to the ground pool
  blood(pos, normal, size = 0.5, alpha = 1) {
    const r = this.rng;
    const pool = normal.y > 0.8 && pos.y < 0.3 ? this.ground : this.surface;
    const p = _p.copy(pos).addScaledVector(normal, pool === this.ground ? 0.004 : 0.012);
    const col = BLOOD_DECAL.map((c) => c * r.range(0.8, 1.15));
    return pool.add(p.clone(), normal, size * r.range(0.8, 1.2), r.next() * Math.PI * 2, ATLAS.SPLAT[r.int(0, 3)], col, alpha);
  }

  drop(pos, size = 0.08) {
    const r = this.rng;
    const p = _p.copy(pos); p.y += 0.004;
    const col = BLOOD_DECAL.map((c) => c * r.range(0.75, 1.1));
    return this.ground.add(p.clone(), _z.set(0, 1, 0).clone(), size * r.range(0.7, 1.4), r.next() * Math.PI * 2, r.chance(0.5) ? ATLAS.DROPS : ATLAS.SPLAT[r.int(0, 3)], col, 1);
  }

  // dark impact mark (stone chips, bullet holes)
  ink(pos, normal, size = 0.12) {
    const r = this.rng;
    const ground = normal.y > 0.8 && pos.y < 0.3;
    const pool = ground ? this.ground : this.surface;
    const p = _p.copy(pos).addScaledVector(normal, ground ? 0.004 : 0.01);
    return pool.add(p.clone(), normal, size * r.range(0.7, 1.3), r.next() * Math.PI * 2, r.chance(0.6) ? ATLAS.CHIP : ATLAS.DROPS, INK, 0.95);
  }

  // corpse pool: grows over `grow` s to `size` m
  pool(pos, size = 1.2, grow = 5, time = this.world.time) {
    const r = this.rng;
    const p = _p.copy(pos); p.y += 0.003;
    return this.pools.add(p.clone(), _z.set(0, 1, 0).clone(), size, r.next() * Math.PI * 2, ATLAS.POOL, BLOOD_POOL, 1, { grow }, time);
  }

  clear() { this.ground.clear(); this.surface.clear(); this.pools.clear(); if (this.glass) this.glass.clear(); }
  get total() { return this.ground.count + this.surface.count + this.pools.count + (this.glass ? this.glass.count : 0); }
}
