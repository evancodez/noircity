import * as THREE from 'three';
import { allocInkId, markFigure, tagInk } from '../../../render/layers.js';
import { accent } from '../../../render/accents.js';
import { lathe, merge, tube, catenaryPoints, V3 } from '../../../world/geom.js';
import { ESC, YARD, SHEETS, PASSAGE, CRATES, GATE, BOARD } from '../plan.js';

// The things of the chase that move (lane B4): the drop ladder, the washing
// (lines and sheets that swing aside and close behind), the crate stacks he
// pulls down, the dog's gate, the loose board, his car's tail lamps.
//   ladder.set(k)                  0 stowed .. 1 down
//   sheets.touch(x, z, vx, vz)     a body going through: the sheets it meets swing
//   crates.pull(i) / .reset()      stack i topples into the passage (1.1 s)
//   crates.hits(x, z, r)           the fallen crates a circle overlaps
//   gate.bang(k)                   the dog hits it (it jumps on its hinges)
//   board.push(v) / .reset()       the loose board swings on its nail
//   tail.set(on)                   his tail lamps (crew red)
// Everything is reset by reset() (a retry of a stretch).
const _c = new THREE.Vector3();
const SS = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export default {
  name: 'chase', order: 130, tick: 130,
  build(stage) {
    const { M, scene } = stage;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const wood = std({ color: 0x3e3e3e, roughness: 0.88, envMap: M.envSoft, envMapIntensity: 0.12 });
    const cloth = std({ color: 0x9c9c9c, roughness: 0.96, side: THREE.DoubleSide, envMap: M.envSoft, envMapIntensity: 0.05 });
    const api = {};

    // ---- the drop ladder at L1's hatch ---------------------------------------------------
    {
      const g = new THREE.Group();
      const parts = [];
      const L = 3.3;
      for (const s of [-1, 1]) parts.push(new THREE.CylinderGeometry(0.022, 0.022, L, 8).translate(0, L / 2, s * 0.24));
      for (let y = 0.25; y < L - 0.1; y += 0.3) parts.push(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 6).rotateX(Math.PI / 2).translate(0, y, 0));
      // (the hooks over the top that hold it on the guides)
      for (const s of [-1, 1]) parts.push(tube([V3(0, L, s * 0.24), V3(0.06, L + 0.12, s * 0.24), V3(0.1, L + 0.04, s * 0.24)], 0.018, 6, 8));
      const m = new THREE.Mesh(merge(parts), M.iron);
      m.castShadow = true;
      g.add(m);
      tagInk(g);
      scene.add(g);
      const y1 = ESC.levels[2];
      const up = y1 - L + 1.45, down = 0.0;
      g.position.set(ESC.ladder.x, up, ESC.ladder.z);
      api.ladder = {
        group: g, length: L, up, down, k: 0,
        set(k) { this.k = k; g.position.y = up + (down - up) * k; g.updateMatrixWorld(true); },
      };
    }

    // ---- the washing ------------------------------------------------------------------------
    {
      const list = [];
      const r = stage.rng.fork(7070);
      const lineY = 3.0;
      for (const z of SHEETS) {
        const a = V3(YARD.x0 + 0.2, lineY, z), b = V3(YARD.x1 - 0.2, lineY, z);
        const line = new THREE.Mesh(tube(catenaryPoints(a, b, 0.22, 24), 0.008, 4, 40), M.iron);
        tagInk(line);
        line.userData.noRay = true;
        scene.add(line);
        // two or three sheets along it, gaps between them (a way through, but
        // never a clear view: they overlap from line to line)
        let x = YARD.x0 + 0.6 + r.range(0, 0.8);
        while (x < YARD.x1 - 1.4) {
          const w = r.range(1.5, 2.3), h = r.range(1.7, 2.1);
          if (x + w > YARD.x1 - 0.4) break;
          const sheet = makeSheet(w, h, cloth, r);
          const cx = x + w / 2;
          // (the line's sag at this x)
          const u = (cx - a.x) / (b.x - a.x);
          const y = lineY - 0.22 * 4 * u * (1 - u) - 0.02;
          sheet.position.set(cx, y, z);
          scene.add(sheet);
          list.push({ mesh: sheet, x0: x, x1: x + w, z, y, h, ang: 0, vel: 0, flap: r.next() * 6 });
          x += w + r.range(0.5, 1.4);
        }
      }
      api.sheets = {
        list,
        // a body at (x, z) moving (vx, vz): the sheets it is pushing through
        touch(x, z, vx, vz, k = 1) {
          for (const s of list) {
            if (x < s.x0 - 0.25 || x > s.x1 + 0.25) continue;
            const dz = z - s.z;
            // (coming at it within 0.9 m, or in it: the hem swings the way
            // the body goes, up and over, fast; the pendulum closes it behind)
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
            // a damped pendulum about the line, the wind's flutter on top
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

    // ---- the crate stacks in the passage -------------------------------------------------------
    {
      const stacks = [];
      const S = 0.62;
      for (const [i, c] of CRATES.entries()) {
        // against the wall on its side of the passage: two on the ground, one on top
        const wz = c.side > 0 ? PASSAGE.z0 + 0.36 : PASSAGE.z1 - 0.36;
        const items = [];
        const spots = [[c.x - 0.34, 0, 0.1], [c.x + 0.32, 0, -0.08], [c.x - 0.02, S, 0.22]];
        for (const [x, y, yaw] of spots) {
          const g = crateMesh(S, wood);
          scene.add(g);
          const it = { g, x0: x, y0: y, z0: wz, yaw0: yaw, t: -1 };
          items.push(it);
        }
        stacks.push({ c, wz, items, pulled: false, t: 0 });
      }
      // topple: about the bottom edge on the passage side (the top one drops
      // off the stack and slides a little), a bounce, and it lies in the way:
      // never across all of it (a gap of 0.8 m stays by the far wall)
      const place = (it, k, dir, delay) => {
        const kk = (k - delay) / 0.55;
        const u = SS(0, 1, kk);
        const ang = u * Math.PI / 2;
        const top = it.y0 > 0;
        const drop = top ? it.y0 * SS(0.15, 0.85, kk) : 0;
        const slide = dir * (top ? 0.3 : 0.08) * u;
        const bounce = 0.05 * Math.sin(Math.min(1, Math.max(0, (kk - 0.9) / 0.4)) * Math.PI);
        it.g.position.set(it.x0, it.y0 - drop + 0.5 * S * Math.sin(ang) + bounce, it.z0 + dir * 0.5 * S * (1 - Math.cos(ang)) + slide);
        it.g.rotation.set(dir * ang, it.yaw0, 0);
        it.lying = u > 0.95;
      };
      api.crates = {
        stacks,
        pull(i) { const s = stacks[i]; if (!s || s.pulled) return false; s.pulled = true; s.t = 0; return true; },
        update(dt) {
          for (const s of stacks) {
            const dir = s.c.side > 0 ? 1 : -1;
            if (s.pulled) s.t = Math.min(1.4, s.t + dt);
            s.items.forEach((it, j) => place(it, s.pulled ? s.t : 0, dir, j === 2 ? 0 : 0.12 + j * 0.1));
          }
        },
        // the fallen crates a circle at (x, z) of radius r overlaps (a stumble)
        hits(x, z, r = 0.35) {
          const out = [];
          for (const s of stacks) {
            if (!s.pulled || s.t < 0.35) continue;
            for (const it of s.items) {
              it.g.updateMatrixWorld(true);
              const c = _c.set(0, S / 2, 0).applyMatrix4(it.g.matrixWorld);
              if (Math.abs(x - c.x) < S * 0.5 + r && Math.abs(z - c.z) < S * 0.5 + r && c.y < S) out.push(it);
            }
          }
          return out;
        },
        reset() { for (const s of stacks) { s.pulled = false; s.t = 0; } this.update(0); },
      };
      api.crates.update(0);
    }

    // ---- the dog's gate ------------------------------------------------------------------------
    {
      const g = new THREE.Group();
      const parts = [];
      const w = GATE.w, h = 1.95;
      for (let x = -w / 2 + 0.07; x < w / 2 - 0.05; x += 0.16) parts.push(new THREE.BoxGeometry(0.13, h - 0.05, 0.04).translate(x + 0.06, h / 2, 0));
      for (const y of [0.3, h - 0.3]) parts.push(new THREE.BoxGeometry(w - 0.04, 0.1, 0.05).translate(0, y, 0.04));
      parts.push(tube([V3(-w / 2 + 0.1, 0.35, 0.05), V3(w / 2 - 0.1, h - 0.35, 0.05)], 0.03, 6, 2));
      const m = new THREE.Mesh(merge(parts), wood);
      m.castShadow = true;
      g.add(m);
      tagInk(g);
      g.position.set(GATE.x, 0, GATE.z + 0.03);
      scene.add(g);
      api.gate = {
        group: g, k: 0, v: 0,
        bang(k = 1) { this.v += 5 * k; },
        update(dt) {
          // it jumps toward the passage on its hinges and chain, then settles
          this.v += (-160 * this.k - 9 * this.v) * dt;
          this.k += this.v * dt;
          g.position.z = GATE.z + 0.03 + Math.max(0, this.k) * 0.06;
          g.rotation.x = this.k * 0.05;
          g.rotation.z = Math.sin(this.k * 7) * 0.01;
        },
        reset() { this.k = 0; this.v = 0; },
      };
    }

    // ---- the loose board in the dead end's fence -------------------------------------------------
    {
      const g = new THREE.Group();
      const hang = 2.1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, hang - 0.1, 0.15).translate(0, -(hang - 0.1) / 2, 0), wood);
      m.castShadow = true;
      g.add(m);
      // the nail's head
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6).translate(0.035, -0.05, 0), M.iron));
      tagInk(g);
      g.position.set(BOARD.x, hang + 0.08, BOARD.z + 0.34);
      scene.add(g);
      // its fallen neighbour, on the ground by the gap
      const fallen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 2.0).rotateY(0.25).translate(BOARD.x + 0.9, 0.03, BOARD.z - 0.5), wood);
      fallen.rotation.z = 0;
      tagInk(fallen);
      scene.add(fallen);
      api.board = {
        group: g, a: 0, v: 0,
        // a push: angular velocity about its nail (swinging in the fence's plane)
        push(v) { this.v += v; },
        update(dt) {
          this.v += (-9.8 / 1.1 * Math.sin(this.a) - 0.35 * this.v) * dt;
          this.a += this.v * dt;
          this.a = Math.max(-1.3, Math.min(1.3, this.a));
          g.rotation.x = this.a;
        },
        reset() { this.a = 0; this.v = 0; },
      };
    }

    api.reset = () => { api.ladder.set(0); api.sheets.reset(); api.crates.reset(); api.gate.reset(); api.board.reset(); };
    return api;
  },
  update(api, dt, t) {
    api.sheets.update(dt, t);
    api.crates.update(dt);
    api.gate.update(dt);
    api.board.update(dt);
  },
};

// a sheet on the line: a plane hung from its top edge (rotation about x at
// the line), a little sag and a few folds, its hem uneven
function makeSheet(w, h, mat, r) {
  const geo = new THREE.PlaneGeometry(w, h, 12, 10);
  const p = geo.getAttribute('position');
  const k1 = r.range(0, 6), k2 = r.range(0, 6);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const v = (h / 2 - y) / h;               // 0 at the line, 1 at the hem
    const fold = 0.09 * Math.sin(x * 5.3 + k1) * (0.3 + v) + 0.04 * Math.sin(x * 11 + k2) * v + 0.03 * Math.sin(x * 2.1 + y * 3 + k2);
    const sag = -0.06 * (1 - (2 * x / w) ** 2) * (1 - v);
    p.setXYZ(i, x, y - h / 2 + sag + 0.03 * Math.sin(x * 3 + k2) * v * v, fold);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.inkId = allocInkId();
  m.userData.noRay = true;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

// a slatted crate: its frame, the slats, a little bevel
function crateMesh(S, mat) {
  const parts = [];
  const t = 0.035;
  // (the box, and a raised frame round each face's edge: the ink reads it as a crate)
  parts.push(new THREE.BoxGeometry(S - 0.02, S - 0.02, S - 0.02).translate(0, S / 2, 0));
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(new THREE.BoxGeometry(t * 2, S, t * 2).translate(sx * (S / 2 - t), S / 2, sz * (S / 2 - t)));
  for (const y of [t, S - t]) for (const s of [1, -1]) {
    parts.push(new THREE.BoxGeometry(S, t * 2, t * 2).translate(0, y, s * (S / 2 - t)));
    parts.push(new THREE.BoxGeometry(t * 2, t * 2, S).translate(s * (S / 2 - t), y, 0));
  }
  parts.push(new THREE.BoxGeometry(S + 0.01, 0.07, S + 0.01).translate(0, S / 2, 0));
  const m = new THREE.Mesh(merge(parts), mat);
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  markFigure(g);
  tagInk(g);
  return g;
}
