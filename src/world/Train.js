import * as THREE from 'three';
import { allocIronId, allocInkId, LAYER, ADD_KEEP_ALPHA } from '../render/layers.js';
import { NOIR_FOG_GLSL } from '../render/fog.js';
import { makeConeMesh } from '../render/shaders/cone.js';
import { roundedBox, merge, V3 } from './geom.js';
import { OVERPASS } from './Overpass.js';

// The el train (Phase 3a). Every ~40 s four dark carriages cross the
// overpass, riding the curve (Overpass.curve). Each carriage is a black
// silhouette (inked like the el's iron: black under any lamp) with a row of
// lit windows down both sides (emissive: they bloom, and the wet street's
// emitters-only reflection carries them as moving columns). The light
// spilling from the windows onto the street below is two pre-allocated
// SpotLights riding with the carriages nearest the eye, strobing as the
// windows pass the railing posts and the column pairs; the rain inside them
// is lit through the light registry. Wheel sparks fly where the curve bends
// hardest; the hanging lamps under the deck tremble as it passes over.
//   schedule: Game drives it (update(dt, t, state)); crossing() is exposed
//   for shot=train (startAt(s)); onRumble(k, pos) / onSqueal(k, pos) feed
//   the audio.
const CAR_L = 13.6, CAR_GAP = 1.1, N_CARS = 4;
const SPEED = 15;            // m/s (~55 km/h)
const DECK_TOP = OVERPASS.deckY + OVERPASS.girderH - 0.1;
const INTERVAL = [34, 46];
const POOLS_PER_CAR = 4;

let GEO = null;
function trainGeometry() {
  if (GEO) return GEO;
  const W = 2.8, H = 3.05;
  // body: a long rounded box with a shallow clerestory roof; +x forward
  const body = merge([
    roundedBox(CAR_L, H - 0.5, W, 0.18, 3).translate(0, 0.35 + (H - 0.5) / 2, 0),
    roundedBox(CAR_L - 0.6, 0.42, W - 0.25, 0.16, 3).translate(0, H - 0.08, 0),
    roundedBox(CAR_L - 3.5, 0.26, W - 1.2, 0.1, 2).translate(0, H + 0.2, 0),
  ]);
  // bogies + wheels (two trucks)
  const under = [];
  for (const x of [-CAR_L / 2 + 2.3, CAR_L / 2 - 2.3]) {
    under.push(roundedBox(2.4, 0.4, W - 0.5, 0.06, 1).translate(x, 0.45, 0));
    for (const dx of [-0.75, 0.75]) for (const z of [-0.72, 0.72]) under.push(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 18).rotateX(Math.PI / 2).translate(x + dx, 0.42, z));
  }
  // windows: a row on each side (leave the ends for the doors)
  const win = [];
  const nW = 9;
  for (let i = 0; i < nW; i++) {
    const x = -CAR_L / 2 + 1.6 + i * ((CAR_L - 3.2) / (nW - 1));
    for (const sgn of [1, -1]) {
      win.push(new THREE.PlaneGeometry(0.95, 0.8).rotateY(sgn > 0 ? 0 : Math.PI).translate(x, 1.95, sgn * (W / 2 + 0.012)));
    }
  }
  // end windows (the lit front of the lead car shows as a small square pair)
  for (const sgn of [1, -1]) win.push(new THREE.PlaneGeometry(0.7, 0.7).rotateY(sgn * Math.PI / 2).translate(sgn * (CAR_L / 2 + 0.012), 2.0, 0));
  GEO = { body, under: merge(under), win: merge(win) };
  return GEO;
}

export class Train {
  constructor(world) {
    this.world = world;
    const { scene, M } = world;
    const ov = world.overpass;
    this.ov = ov;
    this.rng = world.rng.fork(9191);
    const G = trainGeometry();
    // windows: a warm-less white light, bright enough to bloom and to clear
    // the reflection's bright pass
    this.winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.6) });
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6, metalness: 0.3, envMap: M.envSoft, envMapIntensity: 0.4 });
    this.cars = [];
    const ironId = allocIronId(), winId = allocInkId();
    for (let i = 0; i < N_CARS; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(G.body, this.bodyMat);
      const under = new THREE.Mesh(G.under, M.ironDark);
      const win = new THREE.Mesh(G.win, this.winMat);
      body.userData.inkId = ironId; under.userData.inkId = ironId;
      win.userData.inkId = winId;
      // (never a bullet / line-of-sight solid: it moves, and RayWorld's
      // entries are static - a car parked at the origin blocked every ray)
      for (const m of [body, under, win]) { m.castShadow = false; m.receiveShadow = false; m.userData.noRay = true; }
      g.add(body, under, win);
      g.visible = false;
      g.name = 'trainCar' + i;
      scene.add(g);
      this.cars.push({ group: g, s: 0 });
    }
    // the spill of window light onto the street (no shadows: never a
    // shader recompile, never a shadow-map re-render)
    // ... plus a shaft of that light falling through the rain (a volume
    // cone: it also leaves a column in the wet street's reflection, which
    // travels with the train)
    // (not a real SpotLight: two more lights cost every lit pixel of the
    // frame; the shaft, its column in the street and the lit rain carry it)
    this.spots = [0, 1].map((i) => {
      const sp = { intensity: 0, position: new THREE.Vector3(0, -50, 0), target: new THREE.Object3D() };
      const entry = world.lights.add({ position: new THREE.Vector3(0, -50, 0), direction: new THREE.Vector3(0, -1, 0), halfAngle: 0.6, range: 13, intensity: 0 });
      const cone = makeConeMesh(world.U, { apex: new THREE.Vector3(0, 12, 0), axis: new THREE.Vector3(0, -1, 0), tan: 0.42, height: 12.5, r0: 0.9, intensity: 0, seed: 3.1 + i * 2.7, fadeEnd: 0.9, edgeSoft: 0.15 });
      cone.layers.set(LAYER.VOLUME);
      cone.frustumCulled = false;
      cone.visible = false;
      scene.add(cone);
      return { sp, entry, cone };
    });
    // the lit windows' light on the street: a row of soft pools per car,
    // thrown out from under the el onto the road, sliding with the train and
    // strobing as the windows pass the railing posts and the column pairs.
    // Drawn in the scene pass (a lit wash on the wet asphalt) AND in the
    // planar reflection, where they sit on the mirror plane itself: the
    // bright pass and the long streak turn each one into a column running
    // down the road toward the viewer - moving columns, like the lamps'.
    this.pools = this.makePools(world, N_CARS * POOLS_PER_CAR);
    // the run: from behind the player (z ~ +60) to far down the avenue
    this.s0 = ov.sAtZ(70);
    this.s1 = ov.sAtZ(-250);
    this.head = -1;            // arc length of the lead car's nose; < 0 = no train
    this.dir = 1;              // +1: toward -z (away down the avenue); -1: coming in
    this.next = this.rng.range(18, 26);
    this.crossings = 0;
    this.onRumble = null;      // (k 0..1, nearest point) per step while crossing
    this.onSqueal = null;      // (k, pos) where the wheels bite the curve
    this.onPass = null;        // () when a crossing starts
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
  }

  makePools(world, max) {
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    const aI = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);   // x, z, yaw, intensity
    aI.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPool', aI);
    g.instanceCount = 0;
    const U = world.U;
    const mat = new THREE.ShaderMaterial({
      name: 'NoirTrainPools',
      transparent: true, depthWrite: false,
      // (the mirrored camera sees the pools from below the street plane)
      side: THREE.DoubleSide,
      ...ADD_KEEP_ALPHA,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uUseDepth: U.uUseDepth, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uSize: { value: new THREE.Vector2(1.7, 1.1) } },
      vertexShader: /* glsl */`
        attribute vec4 iPool;
        uniform vec2 uSize;
        varying vec2 vUvP;
        varying float vI;
        varying vec3 vView;
        void main() {
          float c = cos( iPool.z ), s = sin( iPool.z );
          vec2 q = position.xz * uSize;
          vec3 wp = vec3( iPool.x + c * q.x + s * q.y, 0.03, iPool.y - s * q.x + c * q.y );
          vUvP = uv;
          vI = iPool.w;
          vec4 mv = viewMatrix * vec4( wp, 1.0 );
          vView = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uUseDepth;
        varying vec2 vUvP;
        varying float vI;
        varying vec3 vView;
        ${NOIR_FOG_GLSL}
        void main() {
          // a soft window-shaped pool, brighter in the middle
          vec2 d = abs( vUvP - 0.5 ) * 2.0;
          float m = ( 1.0 - smoothstep( 0.35, 1.0, d.x ) ) * ( 1.0 - smoothstep( 0.2, 1.0, d.y ) );
          float fog = noirFogAmount( length( vView ), 0.0, uFogDensity );
          // in the reflection (uUseDepth 0) it must clear the bright pass
          float k = uUseDepth < 0.5 ? 0.85 : 0.14;
          gl_FragColor = vec4( vec3( m * vI * k * ( 1.0 - fog ) ), 1.0 );
        }`,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.layers.set(LAYER.FX_REFL);
    mesh.renderOrder = 2;
    mesh.name = 'trainPools';
    world.scene.add(mesh);
    return { mesh, aI, max };
  }

  get active() { return this.head >= 0; }
  get length() { return N_CARS * CAR_L + (N_CARS - 1) * CAR_GAP; }

  // start a crossing with the lead car's nose at arc length s (shot=train)
  startAt(s = null, dir = null) {
    this.dir = dir ?? (this.rng.chance(0.5) ? 1 : -1);
    this.head = s ?? (this.dir > 0 ? this.s0 : this.s1);
    this.crossings++;
    this.hurry = false;
    for (const c of this.cars) c.group.visible = true;
    if (this.onPass) this.onPass(this.dir);
    this.place();
  }

  // the Game calls this every step; `canStart` gates a new crossing (no
  // train during the intermission card, see Game)
  update(dt, t, { canStart = true, camera = null, hurry = false } = {}) {
    if (!this.active) {
      this.next -= dt;
      if (this.next <= 0) {
        if (canStart) this.startAt();
        else this.next = 2;
      }
      return;
    }
    // (a wave's last man down: the train clears the view before the card)
    if (hurry) this.hurry = true;
    const v = SPEED * (this.hurry ? 8 : 1);
    this.head += this.dir * v * dt;
    const tail = this.head - this.dir * this.length;
    if ((this.dir > 0 && tail > this.s1) || (this.dir < 0 && tail < this.s0)) {
      this.head = -1;
      this.next = this.rng.range(INTERVAL[0], INTERVAL[1]);
      for (const c of this.cars) c.group.visible = false;
      for (const S of this.spots) { S.sp.intensity = 0; S.sp.position.set(0, -50, 0); S.entry.intensity = 0; S.cone.visible = false; }
      this.pools.mesh.geometry.instanceCount = 0;
      if (this.onRumble) this.onRumble(0, null);
      return;
    }
    this.place(dt, t, camera);
  }

  frame(s) {
    const ov = this.ov;
    const u = THREE.MathUtils.clamp(s / ov.length, 0, 1);
    const P = ov.curve.getPointAt(u, this._p.clone());
    const T = ov.curve.getTangentAt(u, this._t.clone()).setY(0).normalize();
    return { P, T };
  }

  place(dt = 0, t = 0, camera = null) {
    const W = this.world, r = this.rng;
    const cam = camera ? camera.position : null;
    let best = [], nearest = null, nd = Infinity;
    for (let i = 0; i < N_CARS; i++) {
      const c = this.cars[i];
      // the car's two truck points on the curve: position = their midpoint,
      // heading = the chord between them (it rides the curve like a car)
      const sMid = this.head - this.dir * (i * (CAR_L + CAR_GAP) + CAR_L / 2);
      const a = this.frame(sMid + CAR_L * 0.33), b = this.frame(sMid - CAR_L * 0.33);
      const mid = a.P.clone().add(b.P).multiplyScalar(0.5);
      const fwd = a.P.clone().sub(b.P).setY(0).normalize();
      c.group.position.set(mid.x, DECK_TOP, mid.z);
      c.group.rotation.set(0, Math.atan2(-fwd.z, fwd.x), 0);
      c.group.updateMatrixWorld(true);
      c.s = sMid;
      c.mid = mid;
      c.fwd = fwd;
      if (cam) {
        const d = Math.hypot(mid.x - cam.x, mid.z - cam.z);
        // (the cars in front of the eye first: a shaft behind it is wasted)
        const fx = camera.matrixWorld.elements;
        const ahead = -((mid.x - cam.x) * fx[8] + (mid.z - cam.z) * fx[10]);
        best.push({ c, d, score: d + (ahead < 0 ? 40 : 0) });
        if (d < nd) { nd = d; nearest = mid; }
      }
      // wheel sparks where the curve bends: curvature from the tangent turn
      if (dt > 0) {
        const k = Math.abs(a.T.x * b.T.z - a.T.z * b.T.x) / (CAR_L * 0.66);   // 1/m
        const bite = THREE.MathUtils.smoothstep(k, 0.004, 0.012);
        if (bite > 0 && r.chance(dt * 40 * bite)) {
          // on the OUTER rail (away from the centre of the turn)
          const turn = Math.sign(a.T.x * b.T.z - a.T.z * b.T.x) || 1;
          const side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(-turn * 0.72);
          const wheel = mid.clone().addScaledVector(fwd, (r.chance(0.5) ? 1 : -1) * (CAR_L / 2 - 2.3)).add(side).setY(DECK_TOP + 0.3);
          const F = W.fxRef;
          if (F) {
            for (let n = 0; n < 5; n++) {
              const v = fwd.clone().multiplyScalar(-this.dir * r.range(1, 4)).add(side.clone().normalize().multiplyScalar(r.range(0.5, 2.5))).add(new THREE.Vector3(r.gauss() * 0.6, r.range(0.2, 2.2), r.gauss() * 0.6));
              F.sparks.spawn({ pos: wheel.clone(), vel: v, life: r.range(0.35, 0.9), size: [0.012, 0.02], stretch: 0.05, col: [7, 7, 7], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.4 });
            }
          }
          if (this.onSqueal) this.onSqueal(bite, wheel);
        }
      }
    }
    // window light spill: the two cars nearest the eye each carry a spot,
    // hung just outside the street-side girder and aimed down and out at the
    // street; strobing as the windows pass the railing posts (every 1.7 m)
    // and the column pairs (every 11.5 m)
    best.sort((x, y) => x.score - y.score);
    this.spots.forEach((S, i) => {
      const e = best[i];
      if (!e) { S.sp.intensity = 0; S.entry.intensity = 0; S.cone.visible = false; return; }
      const c = e.c;
      const f = this.frame(c.s);
      const N = new THREE.Vector3(-f.T.z, 0, f.T.x);
      const p = c.mid.clone().addScaledVector(N, -(OVERPASS.halfW + 0.7)).setY(DECK_TOP + 1.6);
      const tgt = p.clone().addScaledVector(N, -3.9).setY(0);
      S.sp.position.copy(p);
      S.sp.target.position.copy(tgt);
      S.sp.target.updateMatrixWorld();
      // strobe: the lit windows sweep past the railing posts and the gaps
      // between the column pairs' portal arches
      const post = 0.5 + 0.5 * Math.cos((c.s / OVERPASS.railBay) * Math.PI * 2 + t * 0.0);
      const colGap = THREE.MathUtils.smoothstep(Math.abs(((c.s / OVERPASS.span) % 1 + 1) % 1 - 0.5), 0.06, 0.18);
      const strobe = (0.4 + 0.6 * post) * (0.3 + 0.7 * colGap);
      const near = 1 - THREE.MathUtils.smoothstep(e.d, 30, 70);
      S.sp.intensity = 260 * strobe * near;
      const ax = tgt.clone().sub(p).normalize();
      S.entry.position.copy(p);
      S.entry.direction.copy(ax);
      S.entry.intensity = 1.4 * strobe * near;
      const cn = S.cone;
      cn.visible = near > 0.01;
      cn.position.copy(p);
      cn.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), ax);
      cn.updateMatrixWorld();
      cn.material.uniforms.uApex.value.copy(p);
      cn.material.uniforms.uAxis.value.copy(ax);
      cn.material.uniforms.uIntensity.value = 0.55 * strobe * near;
    });
    // the pools: per car, spaced along it, thrown out onto the road
    const P = this.pools, A = P.aI.array;
    let n = 0;
    for (const c of this.cars) {
      if (!c.mid) continue;
      if (cam && Math.hypot(c.mid.x - cam.x, c.mid.z - cam.z) > 75) continue;
      for (let k = 0; k < POOLS_PER_CAR; k++) {
        const u = (k + 0.5) / POOLS_PER_CAR - 0.5;
        const sP = c.s + this.dir * u * (CAR_L - 2.4);
        const f = this.frame(sP);
        const N = new THREE.Vector3(-f.T.z, 0, f.T.x);
        const out = OVERPASS.halfW + 3.4 + 0.6 * Math.sin(k * 2.1 + c.s * 0.3);
        const x = f.P.x - N.x * out, z = f.P.z - N.z * out;
        const post = 0.5 + 0.5 * Math.cos((sP / OVERPASS.railBay) * Math.PI * 2);
        const colGap = THREE.MathUtils.smoothstep(Math.abs(((sP / OVERPASS.span) % 1 + 1) % 1 - 0.5), 0.05, 0.16);
        A[n * 4] = x; A[n * 4 + 1] = z; A[n * 4 + 2] = Math.atan2(f.T.x, f.T.z) + Math.PI / 2;
        // (hard strobe: the posts and the column pairs cut the light off)
        A[n * 4 + 3] = THREE.MathUtils.smoothstep(post, 0.25, 0.75) * colGap;
        n++;
      }
    }
    P.mesh.geometry.instanceCount = n;
    P.aI.needsUpdate = true;
    if (this.onRumble && cam) this.onRumble(1 - THREE.MathUtils.smoothstep(nd, 15, 140), nearest);
    // the hanging lamps under it tremble
    if (W.lamps && W.lamps.tremble && dt > 0) for (const c of this.cars) if (r.chance(dt * 6)) W.lamps.tremble(c.mid.x, c.mid.z, 1);
  }

  // shot=train: the train with its lead car `ahead` m past the point of the
  // curve nearest z (mid-crossing in the street view)
  stage(z = -25, ahead = 18, dir = 1) {
    const s = this.ov.sAtZ(z);
    this.startAt(s + dir * ahead, dir);
  }
}
