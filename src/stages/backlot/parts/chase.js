import * as THREE from 'three';
import { allocInkId, markFigure, tagInk } from '../../../render/layers.js';
import { merge, tube, catenaryPoints, V3 } from '../../../world/geom.js';
import { ESC, LANES, LINES, DOG } from '../plan.js';

// The things of the chase that move and are not in its way (lane B4; the
// washing and the dog rebuilt by lane C6): the drop ladder, the washing
// (lines across each lane of the yard; sheets that swing aside and close
// behind), the dog on its chain in Tanner's Row.
//   ladder.set(k)                  0 stowed .. 1 down
//   sheets.touch(x, z, vx, vz)     a body going through: the sheets it meets swing
//   dog.lunge(toward)              the dog comes out of its kennel to the end of its chain
// Everything is reset by reset() (a retry of a stretch).
const SS = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export default {
  name: 'chase', order: 130, tick: 130,
  build(stage) {
    const { M, scene } = stage;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    // the washing's cloth: lit from either side (a wet sheet with a lamp
    // behind it glows through, and the shadow of a man between them shows on
    // it: the lamp's own shadow map, read on both faces)
    const cloth = std({ color: 0xa8a8a8, roughness: 0.96, side: THREE.DoubleSide, envMap: M.envSoft, envMapIntensity: 0.04 });
    cloth.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>',
        THREE.ShaderChunk.lights_physical_pars_fragment.replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );', 'float dotNL = abs( dot( geometryNormal, directLight.direction ) ) * 0.9;'));
    };
    cloth.customProgramCacheKey = () => 'backlotCloth';
    const api = {};

    // ---- the drop ladder at L1's hatch ---------------------------------------------------
    {
      const g = new THREE.Group();
      const parts = [];
      const L = 3.3;
      for (const s of [-1, 1]) parts.push(new THREE.CylinderGeometry(0.022, 0.022, L, 8).translate(0, L / 2, s * 0.24));
      for (let y = 0.25; y < L - 0.1; y += 0.3) parts.push(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 6).rotateX(Math.PI / 2).translate(0, y, 0));
      for (const s of [-1, 1]) parts.push(tube([V3(0, L, s * 0.24), V3(0.06, L + 0.12, s * 0.24), V3(0.1, L + 0.04, s * 0.24)], 0.018, 6, 8));
      const m = new THREE.Mesh(merge(parts), M.iron);
      m.castShadow = true;
      g.add(m);
      tagInk(g);
      scene.add(g);
      const y1 = ESC.levels[2];
      // ([C6] it comes down to its stop with its foot a metre off the flags:
      // the last of the way is a drop)
      const up = y1 - L + 1.45, down = ESC.ladderFoot - 0.25;
      g.position.set(ESC.ladder.x, up, ESC.ladder.z);
      g.rotation.y = Math.PI / 2;
      api.ladder = {
        group: g, length: L, up, down, k: 0,
        set(k) { this.k = k; g.position.y = up + (down - up) * k; g.updateMatrixWorld(true); },
      };
    }

    // ---- the washing: lines across each lane -------------------------------------------------
    {
      const list = [];
      const r = stage.rng.fork(7070);
      const lineY = 3.0;
      for (const side of ['W', 'E']) {
        const ln = LANES[side];
        const x0 = ln.x0 + 0.2, x1 = ln.x1 - 0.2;
        for (const z of LINES) {
          const a = V3(x0, lineY, z), b = V3(x1, lineY, z);
          const line = new THREE.Mesh(tube(catenaryPoints(a, b, 0.18, 24), 0.008, 4, 40), M.iron);
          tagInk(line);
          line.userData.noRay = true;
          scene.add(line);
          // two or three sheets along it, gaps between them (a way through, but
          // never a clear view: they overlap from line to line)
          let x = x0 + 0.25 + r.range(0, 0.6);
          while (x < x1 - 1.3) {
            const w = r.range(1.5, 2.2), h = r.range(2.1, 2.4);
            if (x + w > x1 - 0.15) break;
            const sheet = makeSheet(w, h, cloth, r);
            const cx = x + w / 2;
            const u = (cx - a.x) / (b.x - a.x);
            const y = lineY - 0.18 * 4 * u * (1 - u) - 0.02;
            sheet.position.set(cx, y, z);
            sheet.traverse((o) => { if (o.isMesh) o.castShadow = false; });
            scene.add(sheet);
            list.push({ mesh: sheet, x0: x, x1: x + w, z, y, h, ang: 0, vel: 0, flap: r.next() * 6, side });
            x += w + r.range(0.35, 0.9);
          }
        }
      }
      api.sheets = {
        list,
        touch(x, z, vx, vz, k = 1) {
          for (const s of list) {
            if (x < s.x0 - 0.25 || x > s.x1 + 0.25) continue;
            const dz = z - s.z;
            const toward = -Math.sign(dz) * vz > 0.3 || Math.abs(dz) < 0.3;
            if (Math.abs(dz) > 0.9 || !toward || Math.abs(vz) < 0.2) continue;
            const dir = vz < 0 ? 1 : -1;
            const want = dir * 1.25 * Math.min(1, Math.abs(vz) / 3 + 0.4) * k;
            if (Math.sign(want) !== Math.sign(s.ang) || Math.abs(want) > Math.abs(s.ang)) s.vel = (want - s.ang) * 9;
            s.hit = 0.25;
          }
        },
        update(dt, t) {
          for (const s of list) {
            s.hit = Math.max(0, (s.hit || 0) - dt);
            s.vel += (-9.8 / 1.1 * Math.sin(s.ang) - 1.6 * s.vel) * dt;
            s.ang += s.vel * dt;
            s.ang = Math.max(-1.35, Math.min(1.35, s.ang));
            const flutter = 0.035 * Math.sin(t * 1.7 + s.flap) + 0.02 * Math.sin(t * 3.9 + s.flap * 2);
            s.mesh.rotation.x = s.ang + flutter;
          }
        },
        reset() { for (const s of list) { s.ang = 0; s.vel = 0; } },
      };
    }

    // ---- the dog on its chain in Tanner's Row ---------------------------------------------------
    {
      const dogMat = std({ color: 0x0c0c0c, roughness: 0.7, envMap: M.envSoft, envMapIntensity: 0.25 });
      const dog = new THREE.Group();
      const dp = [];
      // a big black dog standing: body, a deep chest, the neck, the head with
      // a long muzzle and its ears up, the tail; [C6] the legs on their own
      // hips (they run when it lunges), the eyes' glints and a snarl's teeth
      dp.push(new THREE.CapsuleGeometry(0.15, 0.6, 6, 14).rotateZ(Math.PI / 2).scale(1, 1.08, 1.12).translate(0, 0.62, 0));
      dp.push(new THREE.SphereGeometry(0.17, 16, 12).scale(1.15, 1.2, 1.3).translate(0.34, 0.63, 0));
      dp.push(new THREE.CapsuleGeometry(0.1, 0.2, 6, 12).rotateZ(-1.05).translate(0.55, 0.8, 0));
      dp.push(new THREE.SphereGeometry(0.135, 16, 12).scale(1.1, 0.9, 1.05).translate(0.7, 0.9, 0));
      // (the muzzle: long, tapering, the jaw a little open)
      dp.push(new THREE.CylinderGeometry(0.05, 0.08, 0.24, 12).rotateZ(Math.PI / 2).translate(0.9, 0.88, 0));
      dp.push(new THREE.CylinderGeometry(0.034, 0.055, 0.2, 10).rotateZ(Math.PI / 2 + 0.3).translate(0.88, 0.81, 0));
      for (const sz of [-1, 1]) dp.push(new THREE.ConeGeometry(0.045, 0.14, 10).rotateZ(0.35).rotateX(-sz * 0.25).translate(0.65, 1.03, sz * 0.08));
      dp.push(new THREE.CapsuleGeometry(0.03, 0.34, 4, 8).rotateZ(-0.6).translate(-0.52, 0.78, 0));
      const dm = new THREE.Mesh(merge(dp), dogMat);
      dm.castShadow = true;
      dog.add(dm);
      // (the legs: each from its hip, the thigh and the shin as one long capsule)
      const legs = [];
      for (const [lx, lz, ph] of [[0.33, 0.12, 0], [0.33, -0.12, Math.PI], [-0.3, 0.11, Math.PI * 0.5], [-0.3, -0.11, Math.PI * 1.5]]) {
        const hip = new THREE.Group();
        hip.position.set(lx, 0.52, lz);
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 6, 10).translate(0, -0.265, 0), dogMat);
        leg.castShadow = true;
        hip.add(leg);
        dog.add(hip);
        legs.push({ hip, ph });
      }
      // (the eyes' glints and the teeth: pale, the only light on it)
      const pale = new THREE.MeshBasicMaterial({ color: 0xcfcfcf });
      for (const sz of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), pale);
        e.position.set(0.8, 0.93, sz * 0.064);
        dog.add(e);
      }
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.016, 0.085).translate(0.93, 0.845, 0), pale);
      dog.add(teeth);
      for (const m of [teeth]) m.userData.noRay = true;
      markFigure(dog);
      tagInk(dog);
      scene.add(dog);
      // its chain from the ring in the wall by the kennel to its collar
      const ring = V3(DOG.x + 0.7, 0.5, DOG.z - 0.25);
      const chainMesh = new THREE.Mesh(new THREE.BufferGeometry(), M.iron);
      chainMesh.userData.noRay = true;
      tagInk(chainMesh);
      scene.add(chainMesh);
      const home = { x: DOG.x, z: DOG.z + 0.75 };
      const col = stage.colliders.addCircle(home.x, home.z, 0.36, 'dog');
      api.dog = {
        group: dog, x: home.x, z: home.z, yaw: -Math.PI / 2, t: -1, lunge0: null, barkT: 0,
        // out to the end of its chain toward a point (it can reach DOG.chain from the ring)
        lunge(toward) { this.t = 0; this.lunge0 = { x: toward.x, z: toward.z }; },
        reach() { return { x: ring.x, z: ring.z, r: DOG.chain + 0.55 }; },
        update(dt, t) {
          let tx = home.x, tz = home.z;
          if (this.t >= 0) {
            this.t += dt;
            const L = this.lunge0;
            const dx = L.x - ring.x, dz = L.z - ring.z, d = Math.hypot(dx, dz) || 1;
            const out = Math.min(DOG.chain, d);
            const k = SS(0, 0.25, this.t) * (1 - SS(1.6, 2.4, this.t));
            tx = home.x + (ring.x + dx / d * out - home.x) * k;
            tz = home.z + (ring.z + dz / d * out - home.z) * k;
            if (this.t > 2.6) this.t = -1;
          }
          const x0 = this.x, z0 = this.z;
          this.x += (tx - this.x) * (1 - Math.exp(-dt * 14));
          this.z += (tz - this.z) * (1 - Math.exp(-dt * 14));
          // (its legs: a gallop while it moves, planted when it stands)
          const sp = dt > 0 ? Math.hypot(this.x - x0, this.z - z0) / dt : 0;
          this.gait = (this.gait || 0) + dt * (4 + sp * 3.2);
          const amp = Math.min(0.75, sp * 0.22);
          for (const L of legs) L.hip.rotation.z = Math.sin(this.gait + L.ph) * amp;
          const wantYaw = this.t >= 0 && this.lunge0 ? Math.atan2(-(this.lunge0.z - this.z), this.lunge0.x - this.x) : -Math.PI / 2;
          this.yaw += Math.atan2(Math.sin(wantYaw - this.yaw), Math.cos(wantYaw - this.yaw)) * (1 - Math.exp(-dt * 10));
          // (up on its hind legs at the chain's end, snapping)
          const rear = this.t >= 0 ? SS(0.15, 0.3, this.t) * (1 - SS(1.4, 1.9, this.t)) : 0;
          dog.position.set(this.x, 0, this.z);
          dog.rotation.set(0, this.yaw, rear * 0.3 + Math.sin(t * 22) * 0.04 * rear);
          col.x = this.x; col.z = this.z;
          // the chain: a sagging line from the ring to the collar
          const collar = V3(this.x + Math.cos(this.yaw) * 0.5, 0.8 + rear * 0.3, this.z - Math.sin(this.yaw) * 0.5);
          const sag = Math.max(0.02, (DOG.chain - collar.distanceTo(ring)) * 0.4);
          chainMesh.geometry.dispose();
          chainMesh.geometry = tube(catenaryPoints(ring, collar, sag, 12), 0.012, 4, 14);
        },
        reset() { this.t = -1; this.x = home.x; this.z = home.z; },
      };
      api.dog.update(0, 0);
    }

    api.reset = () => { api.ladder.set(0); api.sheets.reset(); api.dog.reset(); };
    return api;
  },
  update(api, dt, t) {
    api.sheets.update(dt, t);
    api.dog.update(dt, t);
  },
};

// a sheet on the line: a plane hung from its top edge (rotation about x at
// the line), a little sag and a few folds, its hem uneven
function makeSheet(w, h, mat, r) {
  const geo = new THREE.PlaneGeometry(w, h, 20, 16);
  const p = geo.getAttribute('position');
  const k1 = r.range(0, 6), k2 = r.range(0, 6), k3 = r.range(0, 6);
  const folds = r.range(2.2, 3.4), belly = r.range(0.08, 0.16) * (r.chance(0.5) ? 1 : -1);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = x / w + 0.5;
    const v = Math.min(1, Math.max(0, (h / 2 - y) / h));
    const peg = 0.035 * Math.abs(Math.sin(u * Math.PI * 2)) * (1 - v) * (1 - v);
    const fold = (0.05 + 0.07 * v) * Math.sin(u * Math.PI * 2 * folds + k1) + 0.025 * v * Math.sin(u * 17 + k2);
    const bel = belly * Math.sin(Math.PI * u) * Math.pow(v, 0.8);
    const hem = v * v * (0.06 * Math.sin(u * 7 + k3) + 0.05 * (u - 0.5));
    p.setXYZ(i, x * (1 - 0.04 * v), y - h / 2 - peg - hem, fold + bel);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.inkId = allocInkId();
  m.userData.noRay = true;
  const g = new THREE.Group();
  g.add(m);
  for (const u of [0.02, 0.5, 0.98]) {
    const peg = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07, 0.03).translate((u - 0.5) * w, -0.01, 0), mat);
    peg.userData.inkId = m.userData.inkId; peg.userData.noRay = true;
    g.add(peg);
  }
  return g;
}
