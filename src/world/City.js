import * as THREE from 'three';
import { allocSkylineId, LAYER } from '../render/layers.js';
import { linearFor, EXPOSURE } from '../render/tone.js';
import { makeTowerMaterial } from './Skyline.js';
import { merge, lathe, V3 } from './geom.js';

// The city behind the block (lane 4's brief 4, fix 7): between the block
// and the four rings of towers, a roofscape 45-140 m out (tenement roofs
// with water tanks on stilts, chimney stacks and their smoke leaning on the
// wind, skeletal billboard frames, a church spire, a gasometer's drum and
// lattice, laundry-line poles), each side of the block its own; a
// suspension bridge far off beyond the rail yard with lights crossing it
// now and then; and life in the sky: two searchlights sweeping the cloud
// base, a beacon pulsing on the tallest spire, low scud crossing the tops,
// veils of heavier rain drifting across the distance, lit windows going on
// and off. Everything is a flat fogged silhouette (the towers' own
// material and ink class: no line work), darker than the towers, lighter
// with distance.
// All of it moves on the step's clock (t), from forks of its own.

// the walkable block and its edges, the rail yard, the left row and the
// cross street under the el, the block behind the start: no roof stands
// on them
const KEEP_OUT = [
  [-30, 52, -128, 40],        // the block, its edges, the rail yard
  [-30, -8, -270, 125],       // the left row (and the block behind the start)
  [-122, -30, -48, 2],        // the cross street's flanks
  [-170, -8, -215, -138],     // the el's cross street and its blocks
  [-12, 30, -600, -120],      // the avenue on into the mist (the street view's vanishing point)
  [-12, 30, 36, 400],         // and behind the start
];

export class City {
  constructor(world) {
    this.world = world;
    const rng = world.rng.fork(1600);
    this.group = new THREE.Group();
    this.group.name = 'city';
    world.scene.add(this.group);
    this.t = 0;
    const sky = world.part ? world.part('skyline') : world.skyline;
    this.towers = (sky && sky.boxes) || [];
    this.buildRoofscape(rng.fork(1));
    this.buildBridge(rng.fork(2));
    this.buildSmoke(rng.fork(3));
    this.buildScud(rng.fork(4));
    this.buildVeils(rng.fork(5));
    this.buildSearchlights(rng.fork(6));
    this.buildBeacon(sky);
    this.buildWindowLife(sky, rng.fork(7));
  }

  // ---- the roofscape ------------------------------------------------------------
  inTower(x, z, pad) {
    for (const t of this.towers) {
      const dx = x - t.x, dz = z - t.z;
      if (dx * dx + dz * dz < (t.r + pad) ** 2) return true;
    }
    return false;
  }

  buildRoofscape(rng) {
    const U = this.world.U;
    // three depth bands, each one flat tone (display 0.22 near .. 0.28 far),
    // hazed a little toward the sky
    const bands = [
      { d: [40, 70], tone: 0.22, haze: 0.02, parts: [] },
      { d: [70, 105], tone: 0.25, haze: 0.04, parts: [] },
      { d: [105, 145], tone: 0.28, haze: 0.06, parts: [] },
    ];
    const rectDist = (x, z) => {
      const dx = Math.max(-12 - x, 0, x - 22), dz = Math.max(-125 - z, 0, z - 36);
      return Math.hypot(dx, dz);
    };
    const out = (x, z, r) => KEEP_OUT.some(([x0, x1, z0, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
    const placed = [];
    this.chimneys = [];
    this.roofs = [];
    const box = (P, w, h, d, x, y, z, rot = 0) => P.push(new THREE.BoxGeometry(w, h, d).rotateY(rot).translate(x, y, z));
    // the church spire (west) and the gasometer (east): one each
    {
      const B = bands[1].parts;
      const c = this.findSpot(rng, placed, out, -78, -10, 14);
      if (c) {
        const [x, z] = c;
        box(B, 9, 22, 9, x, 11, z);
        box(B, 7.5, 6, 7.5, x, 25, z);
        B.push(new THREE.CylinderGeometry(0.2, 5.4, 26, 8, 1).rotateY(Math.PI / 8).translate(x, 41, z));
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) B.push(new THREE.CylinderGeometry(0.1, 0.8, 5, 4).translate(x + sx * 3.6, 30.5, z + sz * 3.6));
        box(B, 18, 14, 24, x - 14, 7, z + 2);
        B.push(new THREE.CylinderGeometry(0.1, 12, 7, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1.3).translate(x - 14, 17.5, z + 2));
        this.spire = V3(x, 54, z);
      }
      const g = this.findSpot(rng, placed, out, 128, -128, 20);
      if (g) {
        const [x, z] = g;
        const B2 = bands[2].parts;
        const r = 17, hh = 26;
        B2.push(new THREE.CylinderGeometry(r, r, hh, 40, 1).translate(x, hh / 2, z));
        B2.push(lathe([[0, hh + 2.2], [r * 0.5, hh + 1.8], [r, hh], [0, hh]], 40).translate(x, 0, z));
        // the guide frame: columns round the drum, rings, crossed bracing
        const n = 12, R = r + 1.4, H = hh + 8;
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2;
          box(B2, 0.6, H, 0.6, x + Math.cos(a) * R, H / 2, z + Math.sin(a) * R);
        }
        for (const y of [H * 0.35, H * 0.68, H]) B2.push(new THREE.TorusGeometry(R, 0.25, 4, 48).rotateX(Math.PI / 2).translate(x, y, z));
        for (let i = 0; i < n; i++) {
          const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
          for (const [y0, y1] of [[0, H * 0.35], [H * 0.35, H * 0.68], [H * 0.68, H]]) {
            const p0 = V3(x + Math.cos(a0) * R, y0, z + Math.sin(a0) * R), p1 = V3(x + Math.cos(a1) * R, y1, z + Math.sin(a1) * R);
            const mid = p0.clone().lerp(p1, 0.5), len = p0.distanceTo(p1);
            const bar = new THREE.BoxGeometry(0.2, len, 0.2);
            bar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), p1.clone().sub(p0).normalize()));
            bar.translate(mid.x, mid.y, mid.z);
            B2.push(bar);
          }
        }
        this.gasometer = V3(x, H, z);
      }
    }
    let tries = 0;
    while (placed.length < 150 && tries++ < 4000) {
      // around the block: pick a side, then a spot on it
      const a = rng.next() * Math.PI * 2;
      const R = rng.range(45, 150);
      const x = 5 + Math.sin(a) * R * 0.9, z = -45 + Math.cos(a) * R * 1.35;
      const d = rectDist(x, z);
      if (d < 40 || d > 145) continue;
      const w = rng.range(12, 24), dp = rng.range(10, 20);
      const rad = Math.hypot(w, dp) / 2;
      if (out(x, z, rad) || this.inTower(x, z, rad)) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < (p.rad + rad) * 0.8)) continue;
      const band = bands.find((b) => d >= b.d[0] && d < b.d[1]) || bands[2];
      // the side of the block it stands on sets its character
      const side = Math.abs(x - 5) * 1.35 > Math.abs(z + 45) * 0.9 ? (x > 5 ? 'E' : 'W') : (z > -45 ? 'S' : 'N');
      // (east, beyond the rail yard, the roofs stand low and back: the el's
      // arches keep framing mist over a low dark roofline, not walls)
      if (side === 'E' && d < 62) continue;
      const h = side === 'N' ? rng.range(10, 18) : side === 'E' ? rng.range(7, 15) : rng.range(13, 28);
      const rot = rng.range(-0.25, 0.25);
      const P = band.parts;
      box(P, w, h, dp, x, h / 2, z, rot);
      box(P, w + 0.7, 0.6, dp + 0.7, x, h + 0.3, z, rot);
      const q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), rot);
      const on = (lx, lz) => V3(lx, 0, lz).applyQuaternion(q).add(V3(x, 0, z));
      // roof things
      const tankP = side === 'N' ? 0.6 : side === 'W' ? 0.45 : 0.25;
      if (rng.chance(tankP)) {
        const p = on(rng.range(-w, w) * 0.3, rng.range(-dp, dp) * 0.3);
        const th = rng.range(3.5, 5), tr = rng.range(1.6, 2.3), leg = rng.range(3, 5);
        P.push(lathe([[0, 0], [tr, 0], [tr, th], [tr * 0.8, th + 0.6], [0.2, th + 1.3], [0, th + 1.35]], 16).translate(p.x, h + leg, p.z));
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) box(P, 0.22, leg, 0.22, p.x + sx * tr * 0.7, h + leg / 2, p.z + sz * tr * 0.7);
        box(P, tr * 1.6, 0.15, 0.15, p.x, h + leg * 0.5, p.z);
      }
      const nCh = side === 'S' ? rng.int(2, 5) : rng.int(0, 3);
      for (let k = 0; k < nCh; k++) {
        const p = on(rng.range(-0.45, 0.45) * w, rng.range(-0.45, 0.45) * dp);
        const ch = side === 'S' && k === 0 ? rng.range(8, 16) : rng.range(1.8, 3.6);
        const cw = side === 'S' && k === 0 ? rng.range(1.4, 2.2) : rng.range(0.8, 1.4);
        if (side === 'S' && k === 0) P.push(new THREE.CylinderGeometry(cw * 0.35, cw * 0.55, ch, 12).translate(p.x, h + ch / 2, p.z));
        else box(P, cw, ch, cw * 0.7, p.x, h + ch / 2, p.z, rot);
        box(P, cw * 1.25, 0.3, cw * 0.95, p.x, h + ch + 0.15, p.z, rot);
        this.chimneys.push({ pos: V3(p.x, h + ch + 0.4, p.z), big: side === 'S' && k === 0, d });
      }
      if (side === 'E' ? rng.chance(0.18) : rng.chance(0.05)) {
        // a billboard frame: a lattice of struts facing the block, no board
        const bw = rng.range(9, 14), bh = rng.range(4, 6), by = h + 2.2;
        const face = Math.atan2(5 - x, -45 - z);
        const c = Math.cos(face), s = Math.sin(face);
        const at = (u, y) => V3(x + c * u, y, z - s * u);
        for (let u = -bw / 2; u <= bw / 2 + 0.01; u += bw / 4) { const p = at(u, 0); box(P, 0.18, bh + 2.2, 0.18, p.x, h + (bh + 2.2) / 2, p.z); }
        for (const y of [by, by + bh * 0.5, by + bh]) { const p = at(0, y); P.push(new THREE.BoxGeometry(bw, 0.16, 0.16).rotateY(face - Math.PI / 2).translate(p.x, y, p.z)); }
        for (let u = -bw / 2; u < bw / 2 - 0.01; u += bw / 4) {
          const p0 = at(u, by), p1 = at(u + bw / 4, by + bh);
          const mid = p0.clone().lerp(p1, 0.5), len = p0.distanceTo(p1);
          const g = new THREE.BoxGeometry(0.1, len, 0.1);
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), p1.clone().sub(p0).normalize()));
          g.translate(mid.x, mid.y, mid.z);
          P.push(g);
        }
      }
      if (rng.chance(side === 'W' ? 0.25 : 0.1)) {
        // laundry-line poles: two masts with a sagging line between
        for (const u of [-0.35, 0.35]) { const p = on(u * w, 0); box(P, 0.1, 3.2, 0.1, p.x, h + 1.6, p.z); }
      }
      placed.push({ x, z, rad, h, side });
      this.roofs.push({ x, z, h, w, d: dp, rot, side });
    }
    const id = allocSkylineId();
    for (const b of bands) {
      if (!b.parts.length) continue;
      const m = new THREE.Mesh(merge(b.parts), makeTowerMaterial(U, b.tone, b.haze));
      // (roofs are low: the towers' ground mist, 22 m deep, would lift them
      // lighter than the towers behind; theirs lies only round their feet)
      m.material.uniforms.uMistH.value = 4;
      m.userData.inkId = id;
      m.userData.noRay = true;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.roofId = id;
  }

  // a free spot near (x, z) for a big thing of radius r
  findSpot(rng, placed, out, x0, z0, r) {
    for (let k = 0; k < 60; k++) {
      const x = x0 + rng.range(-25, 25), z = z0 + rng.range(-40, 40);
      if (out(x, z, r) || this.inTower(x, z, r)) continue;
      placed.push({ x, z, rad: r, h: 30, side: 'X' });
      return [x, z];
    }
    return null;
  }

  // ---- the bridge beyond the rail yard ------------------------------------------
  buildBridge(rng) {
    const U = this.world.U;
    const P = [];
    const X = 330, towerZ = -40, deckY = 46, H = 128;
    const box = (w, h, d, x, y, z) => P.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
    // one tower: two legs, portal struts
    for (const s of [-1, 1]) {
      P.push(new THREE.CylinderGeometry(1.8, 2.6, H, 4, 1).rotateY(Math.PI / 4).translate(X + s * 11, H / 2, towerZ));
    }
    for (const y of [deckY - 4, 80, 112, H - 3]) box(24, 3, 3, X, y, towerZ);
    // the deck: a long thin band along z, and its truss's depth
    box(22, 2.2, 900, X, deckY, towerZ - 60);
    box(20, 3.5, 900, X, deckY - 2.8, towerZ - 60);
    // the main cables: from the tower tops sagging to the deck mid-span
    // either side, and on to the anchorages
    const cable = (a, b, sag) => {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
      return pts;
    };
    const lines = [];
    for (const s of [-1, 1]) {
      lines.push(cable(V3(X + s * 11, H, towerZ), V3(X + s * 11, deckY + 4, towerZ - 420), 60));
      lines.push(cable(V3(X + s * 11, H, towerZ), V3(X + s * 11, deckY + 4, towerZ + 300), 40));
    }
    for (const pts of lines) {
      P.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.7, 4, false));
      // suspenders: a few, far apart (thin as hairs at this distance)
      for (let i = 4; i < pts.length - 2; i += 4) if (pts[i].y - deckY > 3) box(0.3, pts[i].y - deckY, 0.3, pts[i].x, (pts[i].y + deckY) / 2, pts[i].z);
    }
    const m = new THREE.Mesh(merge(P), makeTowerMaterial(U, 0.33, 0.2));
    m.userData.inkId = allocSkylineId();
    m.userData.noRay = true;
    m.frustumCulled = false;
    this.group.add(m);
    // tiny lights crossing it now and then: a car's lamps, one way or the
    // other, every 6-14 s
    const n = 6;
    const lm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(linearFor(0.62) / EXPOSURE), fog: false }), n);
    lm.userData.inkId = m.userData.inkId;
    lm.userData.noRay = true;
    lm.frustumCulled = false;
    this.group.add(lm);
    this.bridge = { X, deckY, z0: towerZ + 300, z1: towerZ - 420, lights: lm, cars: [] };
    let t = rng.range(0, 4);
    for (let i = 0; i < 40; i++) { this.bridge.cars.push({ t0: t, dir: rng.chance(0.5) ? 1 : -1, lane: rng.chance(0.5) ? -4 : 4, v: rng.range(14, 20) }); t += rng.range(6, 14); }
  }

  // ---- smoke from the chimneys: puffs rising and leaning on the wind -------------
  buildSmoke(rng) {
    const tex = this.world.tex.puff;
    const src = this.chimneys.filter((c) => c.big || rng.chance(0.18)).slice(0, 16);
    const per = 7;
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(linearFor(0.2) / EXPOSURE), alphaMap: tex, transparent: true, depthWrite: false, opacity: 0.55 });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, Math.max(1, src.length * per));
    im.layers.set(LAYER.FX);
    im.frustumCulled = false;
    im.userData.noRay = true;
    this.group.add(im);
    this.smoke = { im, src, per, seeds: Array.from({ length: src.length * per }, () => [rng.next(), rng.range(0.8, 1.2)]) };
  }

  // ---- low scud crossing the tops -----------------------------------------------
  buildScud(rng) {
    const tex = this.world.tex.puff;
    const n = 14;
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(linearFor(0.36) / EXPOSURE), alphaMap: tex, transparent: true, depthWrite: false, opacity: 0.7 });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n);
    im.layers.set(LAYER.FX);
    im.frustumCulled = false;
    im.userData.noRay = true;
    this.group.add(im);
    const clouds = [];
    for (let i = 0; i < n; i++) {
      const a = rng.range(-Math.PI, Math.PI), R = rng.range(260, 520);
      clouds.push({ a, R, y: rng.range(105, 175), w: rng.range(140, 260), h: rng.range(22, 40), v: rng.range(0.0012, 0.0024) * (rng.chance(0.5) ? 1 : 1) });
    }
    this.scud = { im, clouds };
  }

  // ---- veils of heavier rain drifting across the distance ------------------------
  buildVeils(rng) {
    // (a canvas of long, uneven streaks, soft at top and bottom)
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.25, 'rgba(255,255,255,1)'); gr.addColorStop(0.85, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, 256, 512);
    for (let i = 0; i < 900; i++) {
      const u = rng.range(0, 256), v = rng.range(-100, 512), l = rng.range(40, 160);
      x.strokeStyle = `rgba(255,255,255,${rng.range(0.05, 0.25).toFixed(2)})`;
      x.lineWidth = rng.range(0.6, 1.6);
      x.beginPath(); x.moveTo(u, v); x.lineTo(u - l * 0.12, v + l); x.stroke();
    }
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = gr; x.fillRect(0, 0, 256, 512);
    // (and soft at the sides)
    const gs = x.createLinearGradient(0, 0, 256, 0);
    gs.addColorStop(0, 'rgba(255,255,255,0)'); gs.addColorStop(0.3, 'rgba(255,255,255,1)'); gs.addColorStop(0.7, 'rgba(255,255,255,1)'); gs.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gs; x.fillRect(0, 0, 256, 512);
    const t = new THREE.CanvasTexture(c);
    t.wrapT = THREE.RepeatWrapping;
    const n = 7;
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(linearFor(0.52) / EXPOSURE), map: t, transparent: true, depthWrite: false, opacity: 0.35, blending: THREE.AdditiveBlending, fog: false });
    const veils = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.layers.set(LAYER.FX);
      m.frustumCulled = false;
      m.userData.noRay = true;
      this.group.add(m);
      veils.push({ m, a: rng.range(-Math.PI, Math.PI), R: rng.range(170, 330), w: rng.range(90, 170), h: rng.range(140, 220), v: rng.range(0.004, 0.008) });
    }
    this.veils = { list: veils, tex: t };
  }

  // ---- two searchlights sweeping the cloud base ----------------------------------
  buildSearchlights(rng) {
    const len = 520;
    const geo = new THREE.CylinderGeometry(24, 1.2, len, 24, 1, true).translate(0, len / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uGain: { value: 0.005 } },
      vertexShader: /* glsl */`
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          vH = position.y / ${len.toFixed(1)};
          vec4 wp = modelMatrix * vec4( position, 1.0 );
          vN = normalize( mat3( modelMatrix ) * normal );
          vV = normalize( cameraPosition - wp.xyz );
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform float uGain;
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          // brightest along the beam's axis (seen side-on), fading up its
          // length into the cloud and at its foot behind the towers
          float axis = pow( abs( dot( normalize( vN ), normalize( vV ) ) ), 1.5 );
          float along = smoothstep( 0.0, 0.12, vH ) * ( 1.0 - smoothstep( 0.55, 1.0, vH ) );
          gl_FragColor = vec4( vec3( uGain * axis * along ), 1.0 );
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const beams = [];
    for (const [x, z, ph] of [[-260, -470, 0], [300, -430, 2.4]]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 30, z);
      m.layers.set(LAYER.FX);
      m.frustumCulled = false;
      m.userData.noRay = true;
      this.group.add(m);
      beams.push({ m, ph, period: rng.range(34, 46), tilt: rng.range(0.75, 0.95) });
    }
    this.beams = beams;
  }

  // ---- the beacon on the tallest spire -----------------------------------------
  buildBeacon(sky) {
    let top = null;
    if (sky) sky.group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) if (!top || p.getY(i) > top.y) top = V3(p.getX(i), p.getY(i), p.getZ(i));
    });
    if (!top) return;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), fog: false }));
    m.position.copy(top).add(V3(0, 1.0, 0));
    m.userData.inkId = this.roofId;
    m.userData.noRay = true;
    m.frustumCulled = false;
    this.group.add(m);
    this.beacon = { m, on: new THREE.Color().setScalar(linearFor(0.9) / EXPOSURE * 3), off: new THREE.Color().setScalar(linearFor(0.3) / EXPOSURE) };
  }

  // ---- lit windows going on and off over a minute -------------------------------
  buildWindowLife(sky, rng) {
    const im = sky && sky.windowMesh;
    if (!im || !im.instanceColor) return;
    const n = im.count, pick = [];
    for (let k = 0; k < Math.min(10, n); k++) pick.push(rng.int(0, n - 1));
    const base = pick.map((i) => { const mm = new THREE.Matrix4(); im.getMatrixAt(i, mm); return mm; });
    // (each switches at its own times, all after the first 12 s: a shot
    // of the first seconds is the accepted skyline)
    this.winLife = { im, pick, base, times: pick.map(() => { const ts = []; let t = rng.range(12, 40); for (let j = 0; j < 12; j++) { ts.push(t); t += rng.range(18, 60); } return ts; }), state: pick.map(() => 1) };
  }

  // ---- per step --------------------------------------------------------------------
  update(dt, t, camera) {
    this.t = t;
    const cam = camera.position;
    const m = _m, q = camera.quaternion;
    // smoke: each puff rises 5 m over its life, leaning downwind (+x, a
    // little -z), growing and thinning
    const S = this.smoke;
    if (S && S.src.length) {
      for (let i = 0; i < S.src.length; i++) {
        const c = S.src[i];
        for (let k = 0; k < S.per; k++) {
          const j = i * S.per + k, [ph, sc] = S.seeds[j];
          const life = c.big ? 14 : 10;
          const u = ((t / life) + k / S.per + ph * 0.13) % 1;
          const rise = (c.big ? 16 : 8) * u, lean = (c.big ? 26 : 12) * u * u;
          const size = (c.big ? 3 : 1.6) * (0.6 + 2.2 * u) * sc;
          _p.set(c.pos.x + lean, c.pos.y + rise, c.pos.z - lean * 0.3);
          m.compose(_p, q, _s.set(size * 1.4, size, 1));
          S.im.setMatrixAt(j, m);
        }
      }
      S.im.instanceMatrix.needsUpdate = true;
      S.im.material.opacity = 0.5;
    }
    // scud: sheets orbiting slowly round the city at cloud-base height,
    // facing the eye (only their horizontal turn)
    const C = this.scud;
    for (let i = 0; i < C.clouds.length; i++) {
      const c = C.clouds[i];
      const a = c.a + c.v * t;
      _p.set(5 + Math.sin(a) * c.R, c.y, -45 + Math.cos(a) * c.R);
      const yaw = Math.atan2(cam.x - _p.x, cam.z - _p.z);
      m.compose(_p, _qq.setFromAxisAngle(_up, yaw), _s.set(c.w, c.h, 1));
      C.im.setMatrixAt(i, m);
    }
    C.im.instanceMatrix.needsUpdate = true;
    // rain veils: drifting round, facing the eye, the streaks falling
    for (const v of this.veils.list) {
      const a = v.a + v.v * t * 0.2;
      v.m.position.set(5 + Math.sin(a) * v.R, v.h / 2 - 10, -45 + Math.cos(a) * v.R);
      v.m.rotation.set(0, Math.atan2(cam.x - v.m.position.x, cam.z - v.m.position.z), 0);
      v.m.scale.set(v.w, v.h, 1);
    }
    this.veils.tex.offset.y = (t * 0.35) % 1;
    // searchlights: slow sweeps, never in step
    for (const b of this.beams) {
      const s = Math.sin(t * Math.PI * 2 / b.period + b.ph);
      b.m.rotation.set(0, 0, 0);
      b.m.rotateY(s * 0.5 + b.ph);
      b.m.rotateX(-b.tilt);
    }
    // the beacon: a short bright pulse every 2 s
    if (this.beacon) {
      const u = t % 2;
      this.beacon.m.material.color.copy(u < 0.35 ? this.beacon.on : this.beacon.off);
    }
    // the bridge's traffic
    const B = this.bridge;
    if (B) {
      let k = 0;
      for (const c of B.cars) {
        const L = B.z0 - B.z1, dt0 = t - c.t0;
        if (dt0 < 0 || k >= B.lights.count) continue;
        const d = dt0 * c.v;
        if (d > L) continue;
        const z = c.dir > 0 ? B.z0 - d : B.z1 + d;
        m.makeTranslation(B.X + c.lane, B.deckY + 1.8, z);
        B.lights.setMatrixAt(k++, m);
      }
      for (; k < B.lights.count; k++) B.lights.setMatrixAt(k, _zero);
      B.lights.instanceMatrix.needsUpdate = true;
    }
    // windows: a few go on and off
    const W = this.winLife;
    if (W) {
      let dirty = false;
      W.pick.forEach((idx, i) => {
        let st = 1;
        for (const ts of W.times[i]) if (t >= ts) st = 1 - st;
        if (st !== W.state[i]) {
          W.state[i] = st;
          W.im.setMatrixAt(idx, st ? W.base[i] : _zero);
          dirty = true;
        }
      });
      if (dirty) W.im.instanceMatrix.needsUpdate = true;
    }
  }
}
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _qq = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
