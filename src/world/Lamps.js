import * as THREE from 'three';
import { LAYER, tagInk, markFigure } from '../render/layers.js';
import { makeConeMesh } from '../render/shaders/cone.js';
import { lathe, merge, tube, V3 } from './geom.js';
import { STREET } from './Street.js';
import { OVERPASS } from './Overpass.js';

// Streetlamps: gooseneck posts along the left pavement and down the middle,
// lamps hung from the overpass girders, and far "fake" lamps (no real light,
// just head + cone) that carry the rhythm of light into the mist.
// Each lamp = volumetric cone + emissive bulb + registry entry (rain/steam/rim
// lighting). "Real" lamps also describe a SpotLight; a small pool of actual
// three.js SpotLights (3 with shadows) is handed to the real lamps nearest the
// player every 0.25 s, with a short cross-fade (see buildPool/updatePool).
// Flat downward-facing emitter disc (normal -y) for a lamp's mouth.
function emitterDisc(r) {
  return new THREE.CircleGeometry(r, 40).rotateX(Math.PI / 2);
}

const CONE_HALF = 0.42;    // visual cone half-angle (rad): narrow beams like the reference
// SpotLight outer angle (rad): much wider than the visible cone, with a
// near-total penumbra, so the pool on walls and street is a soft grey wash
// with no edge (a tight angle projects a razor-edged polygon onto the stone)
const LIGHT_ANGLE = 0.85;
const LIGHT_PENUMBRA = 0.95;

export class Lamps {
  constructor(world) {
    this.world = world;
    this.lamps = [];
    this.rng = world.rng.fork(41);
    this._poolTimer = 0;
    this._fwd = new THREE.Vector3();
    const post = this.postGeometry();
    this.geo = post;

    // left pavement posts (arm reaches over the road, +x)
    const lx = STREET.kerbX - 0.7;
    for (const z of [16, -17.5, -44, -70, -96]) this.addPost(V3(lx, STREET.pavementTop, z), 0, { real: true });
    for (const z of [-126, -152, -178, -204, -230]) this.addPost(V3(lx, STREET.pavementTop, z), 0, { real: false });
    // centre posts between the road and the overpass columns (arm toward -x)
    const ov = world.overpass;
    for (const z of [-33, -62, -91, -125]) {
      const f = ov.frameAt(ov.sAtZ(z));
      const p = f.P.clone().addScaledVector(f.N, -OVERPASS.halfW - 2.3);
      this.addPost(V3(p.x, 0, p.z), Math.PI, { real: z > -110 });
    }
    // wall sconces on the near façade: grazing light on the wet stone
    this.addSconce(V3(STREET.facadeX + 0.05, 4.7, -3.0));
    this.addSconce(V3(STREET.facadeX + 0.05, 4.7, 21.5));
    // lamps hung under the street-side girder, mid-span
    for (const z of [26, -2, -30, -58, -86, -114, -142, -170]) {
      const s0 = ov.sAtZ(z);
      const k = Math.round(s0 / OVERPASS.span - 0.5) + 0.5; // snap to mid-span
      const f = ov.frameAt(k * OVERPASS.span);
      const p = f.P.clone().addScaledVector(f.N, -OVERPASS.halfW + 0.15);
      this.addHanging(V3(p.x, OVERPASS.deckY, p.z), { real: z < 0 && z > -100 });
    }
    this.buildPool();
  }

  // A fixed pool of real SpotLights follows the player: the nearest lamps get
  // one (the three nearest with shadows), the rest are lit only by their
  // cones, bulbs and wet reflections. A constant light count means three.js
  // never recompiles, and the per-pixel light loop stays short.
  buildPool() {
    const { scene } = this.world;
    this.pool = [];
    const mk = (shadow) => {
      const spot = new THREE.SpotLight(0xffffff, 0, 26, LIGHT_ANGLE, LIGHT_PENUMBRA, 2.0);
      spot.castShadow = shadow;
      if (shadow) {
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0004;
        spot.shadow.normalBias = 0.02;
        spot.shadow.radius = 5;   // soft ledge / post shadows, never crisp black parallelograms
        spot.shadow.camera.near = 0.3;
        spot.shadow.camera.far = 26;
      }
      spot.position.set(0, -50, 0);
      scene.add(spot, spot.target);
      const slot = { spot, lamp: null, k: 0, shadow };
      this.pool.push(slot);
      return slot;
    };
    for (let i = 0; i < 3; i++) mk(true);
    for (let i = 0; i < 4; i++) mk(false);
  }

  assign(slot, lamp) {
    slot.lamp = lamp;
    slot.k = 0;
    const s = slot.spot, L = lamp.light;
    s.position.copy(L.pos);
    s.target.position.copy(L.target);
    s.target.updateMatrixWorld();
    s.angle = L.angle;
    s.penumbra = L.penumbra;
    s.distance = L.distance;
    if (slot.shadow) s.shadow.camera.far = L.distance;
  }

  updatePool(dt, camPos, camFwd) {
    this._poolTimer -= dt;
    if (this._poolTimer <= 0) {
      this._poolTimer = 0.25;
      const cands = this.lamps.filter((l) => l.light && l.on);
      for (const l of cands) {
        const dx = l.head.x - camPos.x, dz = l.head.z - camPos.z;
        const d = Math.hypot(dx, dz);
        const ahead = (dx * camFwd.x + dz * camFwd.z) / Math.max(d, 1e-3);
        l._score = d * (ahead < -0.2 ? 1.6 : 1.0);
      }
      cands.sort((a, b) => a._score - b._score);
      const shadowSlots = this.pool.filter((p) => p.shadow);
      const plainSlots = this.pool.filter((p) => !p.shadow);
      this._want = new Set(cands.slice(0, this.pool.length));
      this._wantShadow = new Set(cands.slice(0, shadowSlots.length));
    }
    if (!this._want) return;
    const held = new Set(this.pool.map((p) => p.lamp).filter(Boolean));
    for (const slot of this.pool) {
      const wanted = slot.lamp && (slot.shadow ? this._wantShadow.has(slot.lamp) : this._want.has(slot.lamp));
      if (slot.lamp && !wanted) {
        slot.k = Math.max(0, slot.k - dt * 4);
        if (slot.k === 0) { held.delete(slot.lamp); slot.lamp = null; }
      } else if (slot.lamp) slot.k = Math.min(1, slot.k + dt * 4);
      if (!slot.lamp) {
        const pick = [...(slot.shadow ? this._wantShadow : this._want)].find((l) => !held.has(l));
        if (pick) { this.assign(slot, pick); held.add(pick); }
      }
      const L = slot.lamp;
      slot.spot.intensity = L ? L.light.intensity * slot.k * L._k : 0;
      slot.spot.visible = true;
    }
  }

  postGeometry() {
    // base + shaft + collars as one lathe; gooseneck arm, scroll and shade separate
    const base = lathe([
      [0, 0], [0.3, 0], [0.3, 0.1], [0.25, 0.16], [0.23, 0.5], [0.17, 0.6], [0.17, 0.88], [0.13, 0.96],
      [0.1, 1.04], [0.085, 2.6], [0.105, 2.64], [0.105, 2.74], [0.08, 2.78], [0.068, 4.9], [0.09, 4.95],
      [0.09, 5.05], [0.065, 5.1], [0.06, 5.6], [0.075, 5.66], [0.04, 5.8], [0, 5.86],
    ], 28);
    const armPts = [V3(0, 5.0, 0), V3(0, 5.55, 0), V3(0.1, 6.02, 0), V3(0.42, 6.3, 0), V3(0.9, 6.34, 0), V3(1.26, 6.2, 0), V3(1.46, 5.98, 0)];
    const arm = tube(armPts, 0.042, 10, 72);
    // decorative scroll under the arm (the reference's curl)
    const sc = [];
    const cx = 0.36, cy = 5.72;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = Math.PI * 1.0 + t * Math.PI * 2.6;
      const r = 0.3 * (1 - t * 0.78);
      sc.push(V3(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 0));
    }
    const scroll = tube(sc, 0.016, 6, 80);
    // shade: bell/cone
    const shade = lathe([[0.03, 0.12], [0.07, 0.08], [0.12, 0.0], [0.24, -0.12], [0.36, -0.24], [0.43, -0.3], [0.44, -0.33], [0.41, -0.33]], 36);
    shade.translate(1.46, 5.98 - 0.02, 0);
    const iron = merge([base, arm, scroll]);
    // the emitter is a small flat disc at the shade's mouth: from below it is
    // the reference's soft white disc under a black shade (no bulb sphere,
    // no lit inner cone making a second ring); from the side it is hidden
    const bulb = emitterDisc(0.35).translate(1.46, 5.96 - 0.29, 0);
    return { iron, shade, bulb, head: V3(1.46, 5.64, 0) };
  }

  addPost(base, yaw, { real = true } = {}) {
    const { M, scene } = this.world;
    const g = new THREE.Group();
    g.position.copy(base);
    g.rotation.y = yaw;
    const iron = new THREE.Mesh(this.geo.iron, M.lampIron);
    iron.castShadow = true;
    const shade = new THREE.Mesh(this.geo.shade, M.lampShade);
    shade.castShadow = true;
    const bulb = new THREE.Mesh(this.geo.bulb, M.bulb);
    g.add(iron, shade, bulb);
    tagInk(g);
    // the shade is inked like a figure: a solid black bell that the lamp's
    // own bloom and cone light are painted around, never over
    markFigure(shade);
    scene.add(g);
    g.updateMatrixWorld(true);
    const head = this.geo.head.clone().applyMatrix4(g.matrixWorld);
    // aim slightly outward over the road
    const out = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    const target = head.clone().addScaledVector(out, 0.9).setY(0);
    const lamp = this.finish(g, head, target, { real, bulb, heightToGround: head.y });
    if (real || base.z > -140) this.world.colliders.addCircle(base.x, base.z, 0.25, 'lamp');
    return lamp;
  }

  addHanging(anchor, { real = true } = {}) {
    const { M, scene } = this.world;
    const g = new THREE.Group();
    g.position.copy(anchor);
    const drop = 1.45;
    const parts = [
      new THREE.CylinderGeometry(0.03, 0.03, drop, 8).translate(0, -drop / 2, 0),
      new THREE.CylinderGeometry(0.1, 0.06, 0.12, 16).translate(0, -0.06, 0),
    ];
    const iron = new THREE.Mesh(merge(parts), M.lampIron);
    iron.castShadow = true;
    const shade = new THREE.Mesh(lathe([[0.03, 0.1], [0.06, 0.06], [0.1, 0.0], [0.22, -0.12], [0.33, -0.24], [0.39, -0.3], [0.4, -0.33], [0.37, -0.33]], 36).translate(0, -drop, 0), M.lampShade);
    shade.castShadow = true;
    const bulb = new THREE.Mesh(emitterDisc(0.32).translate(0, -drop - 0.29, 0), M.bulb);
    g.add(iron, shade, bulb);
    tagInk(g);
    markFigure(shade);
    scene.add(g);
    g.updateMatrixWorld(true);
    const head = V3(anchor.x, anchor.y - drop - 0.32, anchor.z);
    const target = head.clone().setY(0);
    // the street-lamp falloff: brightest under the shade, gone by ~65 % of
    // the height, soft edges (it read as a lit canvas tent to the floor)
    const lamp = this.finish(g, head, target, { real, bulb, heightToGround: head.y, fadeEnd: 0.62, edgeSoft: 0.05 });
    // narrower pool: the columns either side stay black, like the reference
    // (the ink pass keeps the ironwork black; the glow lives in the volume)
    if (lamp.light) { lamp.light.angle = 0.62; lamp.light.penumbra = 0.95; lamp.light.intensity = 70; }
    return lamp;
  }

  // Gooseneck wall lamp: bracket from the wall, small dish shade, light aimed
  // down and slightly outward so it rakes across the stone blocks.
  addSconce(wall) {
    const { M, scene } = this.world;
    const g = new THREE.Group();
    g.position.copy(wall);
    const armPts = [V3(0, 0, 0), V3(0.25, 0.08, 0), V3(0.55, 0.12, 0), V3(0.78, 0.02, 0), V3(0.84, -0.14, 0)];
    const parts = [
      tube(armPts, 0.03, 8, 32),
      new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16).rotateZ(Math.PI / 2).translate(0.02, 0, 0),
    ];
    const iron = new THREE.Mesh(merge(parts), M.lampIron);
    iron.castShadow = true;
    const shade = new THREE.Mesh(lathe([[0.02, 0.06], [0.05, 0.03], [0.12, -0.04], [0.22, -0.12], [0.26, -0.15], [0.24, -0.15]], 28).translate(0.84, -0.12, 0), M.lampShade);
    const bulb = new THREE.Mesh(emitterDisc(0.2).translate(0.84, -0.25, 0), M.bulbDim);
    g.add(iron, shade, bulb);
    tagInk(g);
    markFigure(shade);
    scene.add(g);
    const head = V3(wall.x + 0.84, wall.y - 0.28, wall.z);
    const target = V3(wall.x + 1.6, 0, wall.z - 0.6);
    const { U, lights } = this.world;
    const axis = target.clone().sub(head).normalize();
    const cone = makeConeMesh(U, { apex: head, axis, tan: Math.tan(0.55), height: 4.4, r0: 0.2, intensity: 0.12, seed: this.rng.next() * 10 });
    cone.layers.set(LAYER.VOLUME);
    scene.add(cone);
    const light = { pos: head.clone(), target, angle: 1.05, penumbra: 0.85, distance: 14, intensity: 55 };
    const entry = lights.add({ position: head.clone(), direction: axis.clone(), halfAngle: 0.55, range: 4.4, intensity: 0.6 });
    const lamp = { group: g, head, axis, cone, light, bulb, entry, real: true, sconce: true, on: true, flicker: 0, flickerSeed: this.rng.next() * 100,
      coneBase: 0.12, _k: 1 };
    this.lamps.push(lamp);
    return lamp;
  }

  finish(group, head, target, { real, bulb, heightToGround, fadeEnd = 1.0, edgeSoft = 0.3 }) {
    const { scene, U, lights } = this.world;
    const axis = target.clone().sub(head).normalize();
    const height = heightToGround / Math.max(0.3, -axis.y) * 0.98;
    const cone = makeConeMesh(U, { apex: head, axis, tan: Math.tan(CONE_HALF), height, r0: 0.3, intensity: real ? 0.42 : 0.38, seed: this.rng.next() * 10, fadeEnd, edgeSoft });
    cone.layers.set(LAYER.VOLUME);
    scene.add(cone);
    const light = real ? { pos: head.clone(), target: target.clone(), angle: LIGHT_ANGLE, penumbra: LIGHT_PENUMBRA, distance: 26, intensity: 90 } : null;
    const entry = lights.add({ position: head.clone(), direction: axis.clone(), halfAngle: CONE_HALF, range: height, intensity: 1.0 });
    const lamp = {
      group, head, axis, cone, light, bulb, entry, real,
      base: 1.0, on: true, flicker: 0, flickerSeed: this.rng.next() * 100, _k: 1,
      coneBase: cone.material.uniforms.uIntensity.value,
    };
    this.lamps.push(lamp);
    return lamp;
  }

  setOn(lamp, on) {
    lamp.on = on;
  }

  update(dt, t, camera) {
    const camPos = camera.position;
    camera.getWorldDirection(this._fwd);
    for (const l of this.lamps) {
      let k = l.on ? 1 : 0;
      if (l.flicker > 0 && l.on) {
        const n = Math.sin(t * 23.0 + l.flickerSeed) * Math.sin(t * 7.3 + l.flickerSeed * 2.1);
        const dip = (Math.sin(t * 0.7 + l.flickerSeed) > 0.6 && n > 0.2) ? 0.15 : 1.0;
        k *= dip;
      }
      l.cone.material.uniforms.uIntensity.value = l.coneBase * k;
      l._k = k;
      l.bulb.visible = k > 0.05;
      l.entry.intensity = k;
    }
    this.updatePool(dt, camPos, this._fwd);
  }
}
