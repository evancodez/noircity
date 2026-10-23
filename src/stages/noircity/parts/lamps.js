import * as THREE from 'three';
import { LAYER } from '../../../render/layers.js';
import { makeConeMesh } from '../../../render/shaders/cone.js';
import { lampHead } from '../../../city/kits/street.js';
import { EL } from '../../../world/plan.js';

// The city's lamps (lane O1): ~650 posts, hung lamps under the el; far too
// many for a cone, a rain entry and a light each. So a budget, dealt to the
// nearest every quarter second (the block's pooled SpotLights, taken further):
//   CONES   volumetric cones (the beam in the rain) for the nearest lamps in
//           front of the eye; each lamp keeps its own cone while it holds one
//   ENTRIES the light registry's entries (the lit rain, the rim, exposure)
//           ride with the cones
//   POOL    five real SpotLights (two with shadows) for the very nearest
// Every lamp's glowing mouth is the far city's (always drawn); its post is
// the near chunk's. A lamp: { x, z, yaw, kind, head, on, dead, _k, cone,
// entry } (stage.lamps.lamps lists the dealt ones: the pipeline's sheens,
// the viewmodel's light read it).
//   api (stage.lamps): lamps, all, pool, setOn(lamp, on), near(x, z, r), hit, react, tremble, update
const N_CONES = 30;
const CONE_HALF = 0.42, LIGHT_ANGLE = 0.85, LIGHT_PENUMBRA = 0.95;
const DEAL = 0.25;

export default {
  name: 'lamps', order: 50, tick: 40,
  build(stage) {
    const { scene, U, lights } = stage;
    const C = stage.part('city').C;
    const el = stage.part('el');
    const all = C.lamps.map((l) => {
      const head = lampHead(l);
      return { ...l, src: l, head, on: true, dead: false, _k: 1, cone: null, entry: null, height: head.y * 0.98 / Math.cos(0.3), kind: l.kind };
    });
    // the el's hung lamps: under the deck's middle every other span
    if (el) {
      let acc = 0;
      for (let s = 0; s < el.line.len; s += 2) {
        acc += 2;
        if (acc < 23) continue;
        acc = 0;
        const f = el.line.at(s, {});
        all.push({ x: f.x, z: f.z, yaw: 0, kind: 'hang', head: new THREE.Vector3(f.x, EL.deckY - 1.45 - 0.32, f.z), on: true, dead: false, _k: 1, cone: null, entry: null, hanging: true });
      }
    }
    // the pool of cones (one material each: its apex, axis and strength are its own)
    const cones = [];
    for (let i = 0; i < N_CONES; i++) {
      const c = makeConeMesh(U, { apex: new THREE.Vector3(0, -50, 0), axis: new THREE.Vector3(0.3, -1, 0).normalize(), tan: Math.tan(CONE_HALF), height: 8, r0: 0.3, intensity: 0.42, seed: i * 1.7, fadeEnd: 1.0, edgeSoft: 0.3 });
      c.layers.set(LAYER.VOLUME);
      c.visible = false;
      scene.add(c);
      const entry = lights.add({ position: new THREE.Vector3(0, -50, 0), direction: new THREE.Vector3(0, -1, 0), halfAngle: CONE_HALF, range: 8, intensity: 0, enabled: false });
      cones.push({ mesh: c, entry, lamp: null, base: c.material.uniforms.uIntensity.value });
    }
    // the hung lamps' cone: shorter falloff, softer edge (the el's)
    // the pool of real lights: 2 with shadows, 3 plain (the track keeps two for the cars)
    const pool = [];
    const mk = (shadow) => {
      const spot = new THREE.SpotLight(0xffffff, 0, 26, LIGHT_ANGLE, LIGHT_PENUMBRA, 2.0);
      spot.castShadow = shadow;
      if (shadow) {
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.02; spot.shadow.radius = 5;
        spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 26;
      }
      spot.position.set(0, -50, 0);
      scene.add(spot, spot.target);
      pool.push({ spot, lamp: null, k: 0, shadow });
    };
    for (let i = 0; i < 2; i++) mk(true);
    for (let i = 0; i < 3; i++) mk(false);
    // lamps bucketed by 64 m (the deal looks at the buckets round the eye)
    const B = 64, buckets = new Map();
    for (const l of all) { const k = Math.floor(l.x / B) * 4096 + Math.floor(l.z / B); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(l); }
    const nearList = (x, z, r) => {
      const out = [];
      for (let i = Math.floor((x - r) / B); i <= Math.floor((x + r) / B); i++) for (let j = Math.floor((z - r) / B); j <= Math.floor((z + r) / B); j++) for (const l of buckets.get(i * 4096 + j) || []) out.push(l);
      return out;
    };
    const fwd = new THREE.Vector3(), _a = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);
    let dealT = 0, lastCam = null;
    const api = {
      all, lamps: [], pool, cones,
      setOn(lamp, on) { lamp.on = on; dealT = 0; },
      near(x, z, r = 6) { let best = null, bd = r; for (const l of nearList(x, z, r)) { const d = Math.hypot(l.x - x, l.z - z); if (d < bd && !l.bent) { bd = d; best = l; } } return best; },
      // (a round at a lamp's head: O6's to answer; the head is not a mesh of its own here)
      hit() { return null; },
      react() {},
      tremble() {},
      bind(game) { this.game = game; },
      update(dt, t, camera) {
        const p = camera.position;
        camera.getWorldDirection(fwd);
        const jump = !lastCam || Math.hypot(p.x - lastCam.x, p.z - lastCam.z) > 6;
        (lastCam || (lastCam = p.clone())).copy(p);
        dealT -= dt;
        if (dealT <= 0 || jump) {
          dealT = DEAL;
          // the candidates: lit lamps within 170 m, the ones ahead first
          const cand = nearList(p.x, p.z, 170).filter((l) => l.on && !l.dead);
          for (const l of cand) {
            const dx = l.head.x - p.x, dz = l.head.z - p.z, d = Math.hypot(dx, dz);
            const ahead = (dx * fwd.x + dz * fwd.z) / Math.max(d, 1e-3);
            l._score = d * (ahead < -0.3 ? 3 : ahead < 0.3 ? 1.5 : 1);
          }
          cand.sort((a, b) => a._score - b._score);
          const want = new Set(cand.slice(0, N_CONES));
          // (a lamp that keeps its cone keeps it: no flicker as the deal changes)
          for (const c of cones) if (c.lamp && !want.has(c.lamp)) { c.lamp.cone = null; c.lamp = null; c.mesh.visible = false; c.entry.enabled = false; c.entry.intensity = 0; }
          const free = cones.filter((c) => !c.lamp);
          for (const l of want) {
            if (l.cone) continue;
            const c = free.pop();
            if (!c) break;
            c.lamp = l; l.cone = c;
            // aim: down and a little out over the road (a post), straight down (a hung lamp)
            const axis = l.hanging ? _down.clone() : _a.set(Math.cos(l.yaw) * 0.18, -1, -Math.sin(l.yaw) * 0.18).normalize().clone();
            const h = l.head.y / Math.max(0.3, -axis.y) * 0.98;
            const M = c.mesh;
            M.position.copy(l.head);
            M.quaternion.setFromUnitVectors(_down, axis);
            M.scale.set(1, h / 8, 1);
            M.material.uniforms.uApex.value.copy(l.head);
            M.material.uniforms.uAxis.value.copy(axis);
            if (M.material.uniforms.uHeight) M.material.uniforms.uHeight.value = h;
            M.visible = true;
            c.entry.position.copy(l.head); c.entry.direction.copy(axis); c.entry.range = h; c.entry.enabled = true; c.entry.intensity = 1;
            l.axis = axis;
          }
          this.lamps = cand.slice(0, N_CONES);
          // the real lights: the nearest few
          const near = this.lamps.slice(0, pool.length);
          const held = new Set(pool.map((s) => s.lamp).filter(Boolean));
          for (const s of pool) if (s.lamp && !near.includes(s.lamp)) { held.delete(s.lamp); s.lamp = null; s.k = 0; }
          for (const s of pool) {
            if (s.lamp) continue;
            const l = near.find((x) => !held.has(x));
            if (!l) continue;
            held.add(l); s.lamp = l; s.k = jump ? 1 : 0;
            s.spot.position.copy(l.head);
            s.spot.target.position.copy(l.head).addScaledVector(l.axis || _down, 6); s.spot.target.position.y = 0;
            s.spot.target.updateMatrixWorld();
            s.spot.angle = l.hanging ? 0.62 : LIGHT_ANGLE; s.spot.penumbra = LIGHT_PENUMBRA; s.spot.distance = 26;
          }
        }
        // the cones' strength (a lamp switched off goes dark at once); a cone
        // close to the eye is dimmed (x 0.4 at 4 m, whole by 18 m: the old
        // city's rule - driving the kerb lane through them, each was a white wall)
        for (const c of cones) {
          if (!c.lamp) continue;
          const k = c.lamp.on && !c.lamp.dead ? 1 : 0;
          c.lamp._k = k;
          const d = Math.hypot(c.lamp.head.x - p.x, c.lamp.head.z - p.z);
          const near = 0.25 + 0.75 * Math.min(1, Math.max(0, (d - 3) / 17));
          c.mesh.material.uniforms.uIntensity.value = c.base * k * near;
          c.entry.intensity = k;
        }
        for (const s of pool) {
          s.k = s.lamp ? Math.min(1, s.k + dt * 4) : 0;
          s.spot.intensity = s.lamp && s.lamp.on && !s.lamp.dead ? (s.lamp.hanging ? 70 : 90) * s.k : 0;
        }
      },
    };
    return api;
  },
  update: (L, dt, t, camera) => L.update(dt, t, camera),
};
