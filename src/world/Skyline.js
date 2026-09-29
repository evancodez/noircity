import * as THREE from 'three';
import { allocSkylineId } from '../render/layers.js';
import { merge, lathe, V3 } from './geom.js';
import { linearFor, EXPOSURE } from '../render/tone.js';
import { SKY_GRAD_GLSL } from '../render/shaders/sky.js';

// the street preset's eye (debug/Shots.js street), for the avenue sector
const STREET_EYE = { x: -3.8, z: -9.0 };

// Art-directed tower tone per ring, in display values. Phase 1c: the towers
// are flat fogged silhouettes, 0.30-0.38 display (the reference's skyline is
// soft flat grey a little under its ~0.48 sky, never a dark cutout), and each
// ring is hazed toward the sky value right behind it (ROW_HAZE) so the step
// against the sky is a soft 0.06-0.10.
const ROW_TONE = [0.30, 0.32, 0.33, 0.34];
const ROW_HAZE = [0.08, 0.12, 0.16, 0.2];
// Lit windows print as soft paper-grey (never bloom-white), a little dimmer
// with each ring so they sink into the haze with their towers.
const WINDOW_TONE = [0.66, 0.62, 0.58, 0.54];
// Chance that a tier face shows a cluster of lit windows at all: the
// reference has only a handful of lit windows in the whole skyline.
const WINDOW_FACE_P = [0.42, 0.3, 0.2, 0.1];
// Lit windows are tiny flecks (2-4 px at 1600 wide), mostly in vertical pairs.
const WINDOW_SCALE = 0.5;
// Minimum azimuth between two window clusters as seen from the avenue, so
// no two clusters line up into a column of lights.
const MIN_AZ_GAP = 0.007;

// Towers are not lit by the scene: their value is set by the ring (aerial
// perspective), lifted toward the lamp-lit ground mist at their feet, with a
// little face shading and vertical weathering so they read as masses.
export function makeTowerMaterial(U, tone, haze) {
  return new THREE.ShaderMaterial({
    name: 'NoirTower',
    uniforms: {
      tNoise: U.tNoise,
      uFogColor: U.uFogColor,
      uTone: { value: linearFor(tone) / EXPOSURE },
      uHaze: { value: haze },
      uMistH: { value: 22 },
      uLightning: U.uLightning,
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      varying vec3 vN;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vW = wp.xyz;
        vN = normalize( mat3( modelMatrix ) * normal );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tNoise;
      uniform vec3 uFogColor;
      uniform float uTone, uHaze, uMistH, uLightning;
      varying vec3 vW;
      varying vec3 vN;
      ${SKY_GRAD_GLSL}
      void main() {
        vec3 n = normalize( vN );
        // flat masses: only a whisper of face shading (the city glow comes
        // from the avenue side) and of vertical weathering
        float face = 1.0 + 0.08 * n.x * sign( - vW.x + 1e-3 ) + 0.05 * max( n.y, 0.0 );
        float streak = texture2D( tNoise, vec2( ( vW.x + vW.z ) * 0.045, vW.y * 0.003 ) ).r;
        float c = uTone * face * ( 0.94 + 0.12 * streak );
        // aerial perspective: haze toward the sky right behind this pixel
        float e = normalize( vW - cameraPosition ).y;
        float skyL = uFogColor.g * skyGrad( e ) * SKY_CLOUD_MEAN;
        // (lightning: the flash lights the air between the layers, not the
        // masses - each layer keeps its print against the white sky, the
        // exposure kick cancelled, and the haze toward the lit sky grows
        // with distance: the nearest layer darkest; at rest this is the
        // plain haze above, to the bit)
        float L = uLightning;
        skyL = skyL + L * uFogColor.g * 0.9;
        c = mix( c, skyL, min( 1.0, uHaze * ( 1.0 + 2.0 * L ) ) ) / ( 1.0 + 2.5 * L );
        float mist = exp( - max( vW.y, 0.0 ) / uMistH );
        c = mix( c, uFogColor.g * 1.05, mist * 0.9 );
        gl_FragColor = vec4( vec3( c ), 1.0 );
      }`,
  });
}

// Layered art-deco skyline: 4 rings of towers 150–560 m out. Each tower is a
// stack of set-back tiers with corner piers, crowned by a spire, a stepped
// ziggurat, a needle or a lantern, plus finials. They are black; the scene fog
// alone makes each ring lighter than the one in front (aerial perspective).
// A few small lit windows glow through the mist.
export class Skyline {
  constructor(world) {
    this.world = world;
    const rng = world.rng.fork(77);
    const { M, scene } = world;
    this.group = new THREE.Group();
    this.group.name = 'skyline';
    scene.add(this.group);
    const center = V3(0, 0, -40);
    // near rings: many set-back deco towers; far rings: fewer, taller masses
    const rows = [
      { R: 165, n: 30, h: [50, 115], w: [16, 28] },
      { R: 250, n: 28, h: [75, 165], w: [16, 30] },
      { R: 360, n: 24, h: [120, 240], w: [22, 36] },
      { R: 520, n: 22, h: [160, 300], w: [26, 42] },
    ];
    this.windows = [];   // { matrix, ring }
    this._az = [];       // azimuths of placed window clusters (from the avenue)
    // windows draw from their own stream, so window art direction can change
    // without reshuffling the (approved) tower silhouettes
    this.wrng = world.rng.fork(78);
    rows.forEach((row, ri) => {
      const parts = [];
      for (let i = 0; i < row.n; i++) {
        // denser straight down the avenue and over the cross street
        const u = (i + rng.range(0.1, 0.9)) / row.n;
        const ang = (u - 0.5) * Math.PI * 2;
        const a = ang + Math.PI; // 0 => -z
        const R = row.R * rng.range(0.9, 1.1);
        const x = center.x + Math.sin(a) * R;
        const z = center.z + Math.cos(a) * R;
        const behind = Math.cos(ang) < -0.2; // behind the player: shorter
        const h = rng.range(row.h[0], row.h[1]) * (behind ? 0.6 : 1.0);
        this.tower(parts, rng, x, z, h, rng.range(row.w[0], row.w[1]) * 1.2, ri, false, this.inAvenueSector(x, z) ? i * 31 + ri * 7 + 1 : 0);
      }
      const mesh = new THREE.Mesh(merge(parts), makeTowerMaterial(world.U, ROW_TONE[ri], ROW_HAZE[ri]));
      mesh.userData.inkId = allocSkylineId();
      mesh.frustumCulled = false;
      this.group.add(mesh);
    });
    this.buildAvenueCluster(world);
    this.buildWindows();
  }

  // Straight down the avenue the rings alone put only ~2 towers per ring in
  // the 30-degree sector behind the vanishing point, mostly thin spires, and
  // (Phase 1) the el crossed right in front of them. The reference backs its
  // VP with a CLUSTER of tall deco masses between the near lamp and the el,
  // soft dark grey with a handful of lit windows. So a dedicated cluster:
  // azimuths from the street view (0 = straight down the avenue, + = toward
  // the el), distances 230-390 m, heights chosen so the tops land 12-30
  // degrees up (15-40 % from the top of the street preset), no ink lines
  // (fog eats them).
  // Phase 1b review: the cluster read as a faint ghost of needle spires
  // (0.29 against the 0.33 sky). The reference's masses are BROAD-SHOULDERED
  // stepped slabs with flat crowns and a single mast, ~0.08 darker than the
  // sky, with a few lit window flecks. So most of the cluster is now slabs
  // (slab: true), the rest keep deco/stepped crowns (no spires), the tones
  // drop ~0.06, and the two tallest carry a scatter of lit windows.
  buildAvenueCluster(world) {
    const rng = world.rng.fork(79);
    const eye = V3(-5, 0, -9.5);
    const T = [
      { az: -15, d: 330, el: 11, w: 30 },
      { az: -11, d: 262, el: 15, w: 30, slab: true },
      { az: -6.5, d: 300, el: 21, w: 30 },
      { az: -2.5, d: 236, el: 27, w: 30, slab: true, lit: 9 },
      { az: 2.5, d: 335, el: 19, w: 38, slab: true },
      { az: 6.5, d: 268, el: 24, w: 32, slab: true, lit: 7 },
      { az: 11, d: 355, el: 17, w: 34 },
      { az: 15, d: 292, el: 21, w: 32, slab: true },
      { az: 20, d: 385, el: 13, w: 36 },
    ];
    const byTone = new Map();
    const wrng = world.rng.fork(80);
    for (const t of T) {
      const a = THREE.MathUtils.degToRad(t.az);
      const x = eye.x + Math.sin(a) * t.d;
      const z = eye.z - Math.cos(a) * t.d;
      // tier stack height ~80 % of the total: the crown adds the rest
      const h = Math.tan(THREE.MathUtils.degToRad(t.el)) * t.d * (t.slab ? 0.92 : 0.82);
      // (0.21 / 0.25 / 0.3 printed ~0.30 once the near lamp's bloom and the
      // rain were laid over them: a 0.03 step from the 0.33 sky, a ghost.
      // The reference's cluster sits ~0.08 under its sky.)
      // (Phase 1c: flat fogged silhouettes, 0.30-0.34 + haze toward the sky)
      const tone = t.d < 280 ? 0.3 : t.d < 340 ? 0.31 : 0.33;
      if (!byTone.has(tone)) byTone.set(tone, []);
      if (t.slab) {
        const info = this.slabTower(byTone.get(tone), rng, x, z, h, t.w);
        if (t.lit) this.clusterWindows(wrng, x, z, info, t.lit);
      } else {
        this.tower(byTone.get(tone), rng, x, z, h, t.w, t.d < 280 ? 1 : 2, true);
      }
    }
    for (const [tone, parts] of byTone) {
      const mesh = new THREE.Mesh(merge(parts), makeTowerMaterial(world.U, tone, tone < 0.305 ? 0.1 : tone < 0.32 ? 0.13 : 0.16));
      mesh.userData.inkId = allocSkylineId();
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  // A broad-shouldered deco slab: a wide base block (~half the height), then
  // 2-3 setbacks that step in modestly (shoulders, not a needle), shallow
  // vertical piers on the front, a flat parapet crown and ONE slim mast.
  // Returns the tier boxes (for window placement).
  slabTower(parts, rng, x, z, h, w) {
    let tw = w * rng.range(1.0, 1.15);
    let td = tw * rng.range(0.6, 0.8);
    const rot = rng.range(-0.12, 0.12);
    (this.boxes || (this.boxes = [])).push({ x, z, hw: tw / 2 + 0.1, hd: td / 2 + 0.8, rot, r: Math.hypot(tw, td) / 2 + 0.8, h: h * 1.2 });
    const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), rot);
    const put = (geo, px, py, pz) => {
      const o = V3(px, 0, pz).applyQuaternion(q);
      geo.applyQuaternion(q);
      geo.translate(x + o.x, py, z + o.z);
      parts.push(geo);
    };
    const n = rng.int(3, 4);
    const tiers = [];
    let y = 0;
    for (let t = 0; t < n; t++) {
      const th = t === n - 1 ? h - y : t === 0 ? h * rng.range(0.46, 0.56) : (h - y) * rng.range(0.42, 0.58);
      put(new THREE.BoxGeometry(tw, th, td), 0, y + th / 2, 0);
      // two shallow piers on the front face, rising a little above the tier
      for (const sx of [-0.28, 0.28]) {
        const pw = tw * 0.07;
        put(new THREE.BoxGeometry(pw, th + 1.5, 0.9), sx * tw, y + (th + 1.5) / 2, td / 2 + 0.3);
      }
      tiers.push({ y0: y, th, tw, td });
      y += th;
      tw *= rng.range(0.72, 0.84);
      td *= rng.range(0.78, 0.9);
    }
    const lt = tiers[tiers.length - 1];
    // flat crown: parapet + small penthouse, then a single mast
    put(new THREE.BoxGeometry(lt.tw * 1.04, 1.4, lt.td * 1.04), 0, y + 0.7, 0);
    const ph = rng.range(3, 6);
    put(new THREE.BoxGeometry(lt.tw * 0.36, ph, lt.td * 0.4), 0, y + 1.4 + ph / 2, 0);
    const mh = h * rng.range(0.07, 0.1);
    put(new THREE.CylinderGeometry(0.12, 0.45, mh, 6), 0, y + 1.4 + ph + mh / 2, 0);
    return { q, tiers };
  }

  // A scatter of lit window flecks on the front (+z, toward the avenue) face
  // of a cluster slab: single windows and vertical pairs on random floors of
  // the upper tiers, ~0.9 x 1.3 m (2-4 px from the street preset), at the
  // ring-1 window tone (just above the reflection's bright pass, so each
  // leaves a faint thread in the wet street).
  clusterWindows(rng, x, z, info, count) {
    const { q, tiers } = info;
    for (let i = 0; i < count; i++) {
      // favour the upper tiers
      const t = tiers[Math.min(tiers.length - 1, Math.floor(Math.pow(rng.next(), 0.6) * tiers.length))];
      const floors = Math.max(1, Math.floor(t.th / 3.6) - 1);
      const f = rng.int(1, floors);
      const lx = rng.range(-0.4, 0.4) * t.tw;
      const pair = rng.chance(0.4);
      for (let k = 0; k < (pair ? 2 : 1); k++) {
        const p = V3(lx, t.y0 + (f + k) * 3.6, t.td / 2 + 0.35).applyQuaternion(q);
        const sc = rng.range(0.85, 1.15);
        this.windows.push({
          matrix: new THREE.Matrix4().compose(V3(x + p.x, p.y, z + p.z), q, V3(0.9 * sc, 1.3 * sc, 1)),
          ring: 1,
          dim: rng.range(0.9, 1.0),
        });
      }
    }
  }

  // Straight down the avenue from the street view (azimuth -22..+31 deg,
  // + toward the el) the ring towers must back the vanishing point as
  // broad-shouldered masses: a needle spire there was the tallest, most
  // prominent shape behind the VP (Phase 1b review: 'spiky needles').
  inAvenueSector(x, z) {
    const az = THREE.MathUtils.radToDeg(Math.atan2(x - STREET_EYE.x, -(z - STREET_EYE.z)));
    return az > -22 && az < 31;
  }

  // noSpireSeed > 0 (the avenue sector): gentle setbacks and a short mast,
  // and a spire crown is swapped for a stepped deco crown drawn from its OWN
  // stream (after burning the spire's one draw), so every other tower in the
  // ring keeps its approved silhouette.
  tower(parts, rng, x, z, h, w, ri, decoOnly = false, noSpireSeed = 0) {
    const broad = noSpireSeed > 0;
    // no tower is a plain slab: slender footprints, 3-4 set-back tiers on the
    // near rings (2-3 on the far ones), always crowned
    w *= rng.range(0.7, 1.05);
    let d = w * rng.range(0.7, 1.05);
    const rot = rng.range(-0.3, 0.3);
    // (its footprint for the el's clipTest: the base tier, turned, with
    // its rib)
    (this.boxes || (this.boxes = [])).push({ x, z, hw: w / 2 + 0.1, hd: d / 2 + 0.9, rot, r: Math.hypot(w, d) / 2 + 0.9, h: h * 1.25 });
    const tiers = ri <= 1 ? rng.int(3, 4) : rng.int(2, 3);
    let y = 0;
    let tw = w, td = d;
    const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), rot);
    const put = (geo, px, py, pz) => {
      geo.applyQuaternion(q);
      geo.translate(x + px, py, z + pz);
      parts.push(geo);
    };
    const rel = (lx, lz) => V3(lx, 0, lz).applyQuaternion(q);
    for (let t = 0; t < tiers; t++) {
      const th = t === 0 ? h * rng.range(0.38, 0.52) : (h - y) * rng.range(0.38, 0.58);
      put(new THREE.BoxGeometry(tw, th, td), 0, y + th / 2, 0);
      // corner piers rising a little above the tier
      const pier = Math.min(tw, td) * 0.12;
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const o = rel(sx * (tw / 2 - pier / 2), sz * (td / 2 - pier / 2));
        const ph = th + rng.range(1.5, 5);
        put(new THREE.BoxGeometry(pier, ph, pier), o.x, y + ph / 2, o.z);
      }
      // central vertical rib on the long faces (deco pinstripe)
      if (rng.chance(0.6)) {
        const o = rel(0, td / 2);
        put(new THREE.BoxGeometry(tw * 0.14, th * 0.96, 0.8), o.x, y + th * 0.48, o.z);
      }
      this.windowsFor(rng, x, z, q, tw, td, y, th, ri);
      y += th;
      // (in the avenue sector the SAME draws are remapped to gentle
      // setbacks, 0.8-0.9: broad shoulders instead of a tapering pencil)
      const kw = rng.range(0.58, 0.74), kd = rng.range(0.58, 0.74);
      tw *= broad ? 0.8 + (kw - 0.58) * 0.625 : kw;
      td *= broad ? 0.8 + (kd - 0.58) * 0.625 : kd;
    }
    // Crowns: mostly stepped deco tops with short masts (the reference skyline
    // reads as Empire State / Chrysler masses, not gothic spires)
    const crown = decoOnly
      ? rng.pick(['stepped', 'deco', 'deco', 'lantern', 'stepped'])   // (cluster: no needle spires)
      : ri <= 1
        ? rng.pick(['stepped', 'deco', 'deco', 'lantern', 'spire', 'spire'])
        : rng.pick(['stepped', 'deco', 'spire', 'lantern', 'flat']);
    const top = Math.max(tw, td);
    if (crown === 'spire' && noSpireSeed > 0) {
      rng.range(0.1, 0.2);   // (the spire's draw: keeps the ring's stream aligned)
      const cr = this.world.rng.fork(500 + noSpireSeed);
      // a broad stepped crown: shoulders set back in 3 steps, one short mast
      let s = top;
      let yy = y;
      for (let k = 0; k < 3; k++) {
        const sh = cr.range(4, 8);
        put(new THREE.BoxGeometry(s, sh, s * cr.range(0.85, 1.0)), 0, yy + sh / 2, 0);
        yy += sh; s *= cr.range(0.7, 0.82);
      }
      put(new THREE.CylinderGeometry(0.08, 0.35, h * 0.06, 6), 0, yy + h * 0.03, 0);
    } else if (crown === 'spire') {
      const sh = h * rng.range(0.1, 0.2);
      put(new THREE.CylinderGeometry(0.4, top * 0.45, sh, 4, 1).rotateY(Math.PI / 4), 0, y + sh / 2, 0);
      put(new THREE.CylinderGeometry(0.05, 0.35, sh * 0.45, 6), 0, y + sh + sh * 0.22, 0);
    } else if (crown === 'stepped' || crown === 'deco') {
      let s = top;
      const steps = crown === 'deco' ? 4 : 3;
      for (let k = 0; k < steps; k++) {
        const sh = rng.range(3, 7);
        put(new THREE.BoxGeometry(s, sh, s * rng.range(0.85, 1.0)), 0, y + sh / 2, 0);
        y += sh; s *= rng.range(0.66, 0.8);
      }
      if (crown === 'deco') {
        const mh = h * rng.range(0.08, 0.14);
        put(new THREE.CylinderGeometry(s * 0.3, s * 0.42, mh * 0.35, 8), 0, y + mh * 0.175, 0);
        const nh = mh * ( broad ? 0.3 : 0.65 );   // (a short mast, not a needle, down the avenue)
        put(new THREE.CylinderGeometry(0.06, 0.3, nh, 6), 0, y + mh * 0.35 + nh / 2, 0);
      } else {
        // every stepped top ends in a mast / finial
        put(new THREE.CylinderGeometry(0.08, 0.35, h * 0.08, 6), 0, y + h * 0.04, 0);
      }
    } else if (crown === 'flat') {
      put(new THREE.BoxGeometry(tw * 1.04, 1.2, td * 1.04), 0, y + 0.6, 0);
      put(new THREE.BoxGeometry(tw * 0.3, rng.range(3, 6), td * 0.3), rng.range(-0.2, 0.2) * tw, y + 2, rng.range(-0.2, 0.2) * td);
    } else {
      const lh = rng.range(6, 12);
      put(new THREE.CylinderGeometry(top * 0.3, top * 0.36, lh, 8), 0, y + lh / 2, 0);
      put(new THREE.SphereGeometry(top * 0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, y + lh, 0);
      put(new THREE.CylinderGeometry(0.05, 0.4, h * 0.1, 6), 0, y + lh + top * 0.3 + h * 0.05, 0);
    }
    // finials at the corners of the top tier
    if (rng.chance(ri <= 1 ? 0.45 : 0.25)) {
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const o = rel(sx * tw * 0.45, sz * td * 0.45);
        const fh = rng.range(2, 5);
        put(new THREE.CylinderGeometry(0.05, 0.6, fh, 4), o.x, y + fh / 2, o.z);
      }
    }
  }

  // Replays the draws the original window placer took from the TOWER stream,
  // so every tower keeps the exact silhouette it had when it was approved.
  burnLegacyWindowDraws(rng, tw, td, th, ri) {
    const floors = Math.floor(th / 3.6);
    if (floors < 2) return;
    for (const face of [[0, 1], [1, 0], [-1, 0]]) {
      if (!rng.chance([0.5, 0.42, 0.32, 0.22][ri])) continue;
      const halfW = face[0] === 0 ? tw / 2 : td / 2;
      const cols = Math.floor((halfW * 2) / 3.0);
      if (cols < 1) continue;
      const nClusters = rng.chance(0.2) ? 2 : 1;
      for (let k = 0; k < nClusters; k++) {
        const kind = rng.pick(['run', 'run', 'stack', 'single', 'pair']);
        const n = kind === 'single' ? 1 : kind === 'pair' ? 2 : rng.int(2, 4);
        let f = rng.int(1, floors - 1), c = rng.int(0, cols - 1);
        for (let i = 0; i < n; i++) {
          if (f < 1 || f >= floors || c < 0 || c >= cols) break;
          rng.range(0.7, 1.4);
          if (kind === 'stack') rng.range(0.6, 0.9); else rng.range(0.75, 1.4);
          rng.range(0.85, 1.0);
          if (kind === 'stack') f += rng.chance(0.6) ? 1 : 2;
          else if (kind === 'run' || kind === 'pair') c += rng.chance(0.8) ? 1 : 2;
        }
      }
    }
  }

  windowsFor(towerRng, x, z, q, tw, td, y0, th, ri) {
    this.burnLegacyWindowDraws(towerRng, tw, td, th, ri);
    const rng = this.wrng;
    // A few CLUSTERS of lit windows, not a lattice: most tier faces are dark;
    // a lit face gets one (rarely two) small group - a run along a floor, a
    // stack up a corner, or a lone window - with irregular sizes.
    const floors = Math.floor(th / 3.6);
    if (floors < 2) return;
    for (const face of [[0, 1], [1, 0], [-1, 0]]) {
      if (!rng.chance(WINDOW_FACE_P[ri])) continue;
      const halfW = face[0] === 0 ? tw / 2 : td / 2;
      const cols = Math.floor((halfW * 2) / 3.0);
      if (cols < 1) continue;
      // one cluster per face: mostly a vertical pair, sometimes a lone fleck
      // or a short run
      const kind = rng.pick(['stack', 'stack', 'stack', 'single', 'pair']);
      const n = kind === 'single' ? 1 : 2;
      let f = rng.int(1, floors - 1), c = rng.int(0, cols - 1);
      const faceYaw = face[0] === 0 ? 0 : face[0] * Math.PI / 2;
      const wq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), faceYaw));
      const along0 = -halfW + (c + 0.5) * (halfW * 2 / cols);
      const p0 = V3(face[0] === 0 ? along0 : face[0] * (tw / 2 + 0.6), 0, face[0] === 0 ? td / 2 + 0.6 : along0).applyQuaternion(q);
      // seen from the avenue (0, -10): skip if another cluster sits in the
      // same screen column
      const az = Math.atan2(x + p0.x, -(z + p0.z + 10));
      if (this._az.some((a) => Math.abs(a - az) < MIN_AZ_GAP)) continue;
      this._az.push(az);
      for (let i = 0; i < n; i++) {
        if (f < 1 || f >= floors || c < 0 || c >= cols) break;
        const along = -halfW + (c + 0.5) * (halfW * 2 / cols);
        const lx = face[0] === 0 ? along : face[0] * (tw / 2 + 0.6);
        const lz = face[0] === 0 ? td / 2 + 0.6 : along;
        const p = V3(lx, y0 + f * 3.6, lz).applyQuaternion(q);
        const sc = rng.range(0.8, 1.3) * WINDOW_SCALE;
        const aspect = rng.range(0.9, 1.4);
        this.windows.push({
          matrix: new THREE.Matrix4().compose(V3(x + p.x, p.y, z + p.z), wq, V3(1.1 * sc, 1.5 * sc * aspect, 1)),
          ring: ri,
          dim: rng.range(0.85, 1.0),
        });
        if (kind === 'stack') f += 1;
        else c += 1;
      }
    }
  }

  buildWindows() {
    if (!this.windows.length) return;
    // unfogged: each ring's window value is art-directed directly (display
    // tone -> linear), and stays below the bloom threshold
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, this.windows.length);
    const c = new THREE.Color();
    this.windows.forEach((w, i) => {
      im.setMatrixAt(i, w.matrix);
      c.setScalar(linearFor(WINDOW_TONE[w.ring]) / EXPOSURE * w.dim);
      im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
    im.userData.inkId = allocSkylineId();
    im.userData.inkPerInstance = false;
    im.frustumCulled = false;
    this.group.add(im);
    this.windowCount = this.windows.length;
    // (world/City.js turns a few of them on and off over a minute)
    this.windowMesh = im;
  }
}
