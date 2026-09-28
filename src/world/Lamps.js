import * as THREE from 'three';
import { LAYER, tagInk, markFigure, allocInkId } from '../render/layers.js';
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
    this.buildInstances();
  }

  // Phase 3c performance pass: the posts and the hanging lamps were three
  // meshes each (iron, shade, bulb), drawn in the id, reflection and scene
  // passes (and the shadow maps): ~190 draw calls for 22 lamps. Each kind
  // is now drawn as instanced meshes - iron, shade, the live bulbs and the
  // dead ones - one draw per pass each; every instance keeps its lamp's own
  // ink id (the id pass adds gl_InstanceID to the base, and the lamps of a
  // kind were tagged with consecutive ids), so the contours are the same.
  // The per-lamp groups stay in the scene graph, hidden (group.visible =
  // false), as the bullets' ray targets (world.solids, userData.lamp) and
  // the carriers of the lamp's state; the instances follow them: a swing
  // (swingStep), a bulb going out or dying (update).
  buildInstances() {
    const { M, scene } = this.world;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.inst = [];
    for (const kind of ['post', 'hang']) {
      const list = this.lamps.filter((l) => l.kind === kind);
      if (!list.length) continue;
      const n = list.length, L0 = list[0];
      let base = L0.iron.userData.inkId;
      if (!list.every((l, i) => l.iron.userData.inkId === base + i)) base = allocInkId(n);
      const mk = (geo, mat, name, figure, cast) => {
        const im = new THREE.InstancedMesh(geo, mat, n);
        im.name = name;
        im.userData.inkId = base;
        im.userData.noRay = true;
        if (figure) im.userData.inkFigure = true;
        im.castShadow = cast;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(im);
        return im;
      };
      const I = {
        kind, list,
        iron: mk(L0.iron.geometry, M.lampIron, `lamps_${kind}_iron`, false, true),
        shade: mk(L0.shade.geometry, M.lampShade, `lamps_${kind}_shade`, true, true),
        bulb: mk(L0.bulb.geometry, M.bulb, `lamps_${kind}_bulb`, false, false),
        dead: mk(L0.bulb.geometry, M.bulbDead, `lamps_${kind}_bulbDead`, false, false),
        zero,
      };
      list.forEach((l, i) => {
        l.inst = I; l.instIdx = i; l._bstate = -1;
        l.group.visible = false;
        l.group.updateMatrixWorld(true);
        for (const im of [I.iron, I.shade, I.bulb, I.dead]) im.setMatrixAt(i, l.group.matrixWorld);
      });
      // (the bounds over every lamp of the kind - a hanging lamp swings a
      // few cm inside them - then the bulbs start hidden until update())
      for (const im of [I.iron, I.shade, I.bulb, I.dead]) { im.computeBoundingSphere(); im.boundingSphere.radius += 0.6; im.instanceMatrix.needsUpdate = true; }
      list.forEach((l, i) => { I.bulb.setMatrixAt(i, zero); I.dead.setMatrixAt(i, zero); });
      this.inst.push(I);
    }
  }

  // the instances of one lamp follow its (hidden) group
  syncInstance(l, moved) {
    const I = l.inst;
    if (!I) return;
    const i = l.instIdx, m = l.group.matrixWorld;
    const state = !l.bulb.visible ? 0 : l.bulb.material === this.world.M.bulbDead ? 2 : 1;
    if (moved) {
      I.iron.setMatrixAt(i, m); I.shade.setMatrixAt(i, m);
      I.iron.instanceMatrix.needsUpdate = I.shade.instanceMatrix.needsUpdate = true;
    }
    if (moved || state !== l._bstate) {
      l._bstate = state;
      I.bulb.setMatrixAt(i, state === 1 ? m : I.zero);
      I.dead.setMatrixAt(i, state === 2 ? m : I.zero);
      I.bulb.instanceMatrix.needsUpdate = I.dead.instanceMatrix.needsUpdate = true;
    }
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
    Object.assign(lamp, { kind: 'post', iron, shade });
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
    // a hanging lamp swings on its rod (hit, the train passing overhead)
    lamp.hanging = true;
    Object.assign(lamp, { kind: 'hang', iron, shade });
    lamp.anchor = anchor.clone();
    lamp.swing = { x: 0, z: 0, vx: 0, vz: 0 };
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
      coneBase: 0.12, _k: 1, head0: head.clone(), axis0: axis.clone(), target0: target.clone() };
    g.traverse((o) => { if (o.isMesh) o.userData.lamp = lamp; });
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
      head0: head.clone(), axis0: axis.clone(), target0: target.clone(),
    };
    group.traverse((o) => { if (o.isMesh) o.userData.lamp = lamp; });
    this.lamps.push(lamp);
    return lamp;
  }

  setOn(lamp, on) {
    lamp.on = on;
  }

  // ---- Phase 3a: shooting the lamps ----------------------------------------
  bind(game) { this.game = game; }

  // a round hit one of this lamp's meshes: only the head (shade + glass)
  // puts it out; the iron post just sparks
  hit(lamp, hit, dir) {
    const G = this.game;
    if (!G) return null;
    if (hit.point.distanceTo(lamp.head) > (lamp.sconce ? 0.45 : 0.62)) return null;
    // (a round knocks it into a slight swing, ~8 degrees, away from the shot)
    if (lamp.hanging) { lamp.swing.vx += dir.x * 0.35; lamp.swing.vz += dir.z * 0.35; }
    if (lamp.dead) return null;
    this.shootOut(lamp, dir);
    return null;
  }

  shootOut(lamp, dir = new THREE.Vector3(0, 0, -1)) {
    const G = this.game, r = this.rng, F = G.fx;
    lamp.dead = true;
    lamp.on = true;             // still lit through the buzz; off when it dies
    // a shot lamp may buzz back on for a moment, then die
    lamp.buzz = r.chance(0.6) ? { t: 0, at: r.range(0.25, 0.6), len: r.range(0.25, 0.7) } : null;
    lamp.deadT = 0;
    lamp.dieNow = true;
    const p = lamp.head;
    // glass: pale shards falling out of the shade's mouth
    for (let k = 0; k < 18; k++) {
      const s = r.range(0.025, 0.07);
      F.debris.spawn({
        pos: p.clone().add(new THREE.Vector3(r.gauss() * 0.15, -0.05, r.gauss() * 0.15)),
        vel: new THREE.Vector3(r.gauss() * 1.2 + dir.x * 0.8, r.range(-0.5, 1.2), r.gauss() * 1.2 + dir.z * 0.8),
        life: r.range(0.9, 1.6), size: [s, s * 0.6], rot: r.next() * 6.28, spin: r.gauss() * 12,
        col: [0.4, 0.4, 0.4], cell: 12, gravity: 9.8, ground: 0.02, fadeOut: 0.15, lit: 3, litT: 0.15,
      });
    }
    // a shower of white sparks off the filament
    for (let k = 0; k < 26; k++) {
      const v = new THREE.Vector3(r.gauss(), r.range(-1.2, 0.6), r.gauss()).normalize().multiplyScalar(r.range(2, 6));
      F.sparks.spawn({ pos: p.clone(), vel: v, life: r.range(0.25, 0.8), size: [0.01, 0.016], stretch: 0.04, col: [6, 6, 6], cell: 4, gravity: 9.8, ground: 0.02, fadeOut: 0.4 });
    }
    G.sfx.glass(p, 0.8);
    G.sfx.zap(p);
    G.counters.lampsOut++;
  }

  // per fixed step (game/React.js): the buzz and death of shot lamps, the
  // hanging lamps' swing
  react(dt, t) {
    const G = this.game;
    for (const l of this.lamps) {
      if (l.dead) {
        l.deadT += dt;
        let k = 0;
        if (l.buzz) {
          const b = l.buzz;
          if (l.deadT >= b.at && l.deadT < b.at + b.len) {
            // a failing arc: hard flicker
            const n = Math.sin(t * 91) * Math.sin(t * 37 + 1.3);
            k = n > 0.1 ? 0.9 : n > -0.4 ? 0.25 : 0;
            if (!b.sounded) { b.sounded = true; if (G) G.sfx.buzz(l.head, b.len); }
          }
        }
        l.deadK = k;
        if (l.deadT > (l.buzz ? l.buzz.at + l.buzz.len : 0) + 0.05 && l.on) {
          l.on = false;
          l.bulb.material = this.world.M.bulbDead;
          l.bulb.visible = true;
        }
      }
      if (l.hanging) this.swingStep(l, dt);
    }
  }

  // damped pendulum on the rod; the head, cone, light and rain entry follow
  swingStep(l, dt) {
    const S = l.swing;
    const w2 = 9.8 / 1.6;
    S.vx += (-w2 * S.x - 0.9 * S.vx) * dt;
    S.vz += (-w2 * S.z - 0.9 * S.vz) * dt;
    S.x += S.vx * dt; S.z += S.vz * dt;
    S.x = Math.max(-0.5, Math.min(0.5, S.x)); S.z = Math.max(-0.5, Math.min(0.5, S.z));
    if (Math.abs(S.x) + Math.abs(S.z) + Math.abs(S.vx) + Math.abs(S.vz) < 1e-4 && !l._swung) return;
    l._swung = Math.abs(S.x) + Math.abs(S.z) > 1e-4;
    // S.x, S.z: the bob's displacement (m per m of rod) along world x / z
    const g = l.group;
    // (rotation about x by -S.z swings the bob toward +z; about z by +S.x
    // toward +x: the rod hangs along -y)
    g.rotation.set(-S.z, 0, S.x);
    g.updateMatrixWorld(true);
    this.syncInstance(l, true);
    const q = g.quaternion;
    const rod = l.head0.clone().sub(l.anchor).applyQuaternion(q);
    l.head.copy(l.anchor).add(rod);
    l.axis.copy(l.axis0).applyQuaternion(q);
    const cone = l.cone;
    cone.position.copy(l.head);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), l.axis);
    cone.material.uniforms.uApex.value.copy(l.head);
    cone.material.uniforms.uAxis.value.copy(l.axis);
    l.entry.position.copy(l.head);
    l.entry.direction.copy(l.axis);
    // the real SpotLight follows only a real swing (a hit): the train's
    // tremble moves the cone, the bulb and the lit rain, but a moving spot
    // re-renders its shadow map every frame (Pipeline shadow cache)
    if (l.light) {
      const big = Math.abs(S.x) + Math.abs(S.z) > 0.03;
      if (big || l._spotMoved) {
        l._spotMoved = big;
        const hp = big ? l.head : l.head0, ax = big ? l.axis : l.axis0;
        l.light.pos.copy(hp);
        l.light.target.copy(hp).addScaledVector(ax, hp.y / Math.max(0.3, -ax.y));
        for (const slot of this.pool) if (slot.lamp === l) { slot.spot.position.copy(l.light.pos); slot.spot.target.position.copy(l.light.target); slot.spot.target.updateMatrixWorld(); }
      }
    }
  }

  // the train overhead: every hanging lamp near it trembles
  tremble(x, z, k = 1) {
    const r = this.rng;
    for (const l of this.lamps) {
      if (!l.hanging) continue;
      const d = Math.hypot(l.anchor.x - x, l.anchor.z - z);
      if (d > 30) continue;
      const a = k * (1 - d / 30) * 0.05;
      l.swing.vx += r.gauss() * a; l.swing.vz += r.gauss() * a;
    }
  }

  update(dt, t, camera) {
    const camPos = camera.position;
    camera.getWorldDirection(this._fwd);
    for (const l of this.lamps) {
      let k = l.on ? 1 : 0;
      if (l.dead) k = l.on ? (l.deadK || 0) : 0;
      if (l.flicker > 0 && l.on) {
        const n = Math.sin(t * 23.0 + l.flickerSeed) * Math.sin(t * 7.3 + l.flickerSeed * 2.1);
        const dip = (Math.sin(t * 0.7 + l.flickerSeed) > 0.6 && n > 0.2) ? 0.15 : 1.0;
        k *= dip;
      }
      l.cone.material.uniforms.uIntensity.value = l.coneBase * k;
      l._k = k;
      l.bulb.visible = k > 0.05 || (l.dead && !l.on);
      l.entry.intensity = k;
      if (l.inst) this.syncInstance(l, false);
    }
    this.updatePool(dt, camPos, this._fwd);
  }
}
